"""
SexBrain — KI-Klassifikation von Intimacy-Sessions (Stufe 3)

Feature-Set (12 Dimensionen):
  Vibration (5): peak, durSlots, avgPeak, variance, tierB
  Zeit      (2): hourSin, hourCos  (zirkulär kodiert, kein fixer Cutoff)
  Kontext   (5): lightOn, presenceOn, roomTemp, bathBefore, bathAfter

Fehlende Sensor-Werte werden mit Sentinel -1 kodiert.
Baumbasierte Modelle (RF) können damit umgehen — kein harter Ausschluss.

Aktivierungsbedingung (Stufe 3):
  - mind. MIN_PER_CLASS Samples pro Klasse (vaginal + oral_hand)
  - mind. MIN_TOTAL Samples gesamt
  Sonst: is_trained=False, Fallback auf JS-Stufe-1/2
"""

MIN_PER_CLASS = 2   # Mindest-Samples pro Klasse fuer Training
MIN_TOTAL     = 5   # Mindest-Samples gesamt


class SexBrain:
    """Klassifikation von Intimacy-Sessions: vaginal / oral_hand / intim."""

    FEATURE_NAMES = [
        # Vibrations-Features
        'peak_norm',      # peakStrength / 100
        'dur_norm',       # durSlots / 24
        'avg_norm',       # avgPeak / 100
        'var_norm',       # variance / 2500
        'tier_b',         # 1=Pfad B, 0=Pfad A
        # Zeit (zirkulaer)
        'hour_sin',       # sin(2π * stunde/24)
        'hour_cos',       # cos(2π * stunde/24)
        # Kontext (-1 = Sensor nicht vorhanden)
        'light_on',       # 0=aus, 1=an, -1=kein Sensor
        'presence_on',    # 0=leer, 1=jemand da, -1=kein Sensor
        'room_temp_norm', # roomTemp / 30  (-1 wenn unbekannt)
        'bath_before',    # 1=Bad-Bewegung <60min vorher, 0=nein
        'bath_after',     # 1=Bad-Bewegung <60min nachher, 0=nein
    ]

    def __init__(self):
        self.clf        = None
        self.is_trained = False
        self.class_counts = {}
        self.n_samples  = 0
        self.status_msg = 'Noch nicht trainiert'

    # ------------------------------------------------------------------
    # Feature-Extraktion (Sentinel -1 fuer fehlende Kontext-Sensoren)
    # ------------------------------------------------------------------
    def _feat(self, s):
        """12-dimensionaler Feature-Vektor aus Session-Dict."""
        def _v(key, scale=1.0, default=-1.0):
            val = s.get(key)
            return float(val) / scale if val is not None else default

        return [
            # Vibration
            _v('peak',       100.0, 0.0),
            _v('durSlots',    24.0, 0.0),
            _v('avgPeak',    100.0, 0.0),
            _v('variance',  2500.0, 0.0),
            1.0 if s.get('tierB') else 0.0,
            # Zeit (zirkulaer) — kein Sentinel, immer verfuegbar
            float(s.get('hourSin', 0.0)),
            float(s.get('hourCos', 1.0)),
            # Kontext
            _v('lightOn',    1.0),      # 0/1/-1
            _v('presenceOn', 1.0),      # 0/1/-1
            _v('roomTemp',  30.0),      # normiert
            float(s.get('bathBefore', 0)),
            float(s.get('bathAfter',  0)),
        ]

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------
    def train(self, samples):
        """
        samples: Liste von Session-Dicts mit Feldern:
            peak, durSlots, avgPeak, variance, tierB, label,
            hourSin, hourCos,
            lightOn, presenceOn, roomTemp, bathBefore, bathAfter
        label: 'vaginal' oder 'oral_hand'

        Gibt (success, class_counts, status_msg) zurueck.
        """
        from collections import Counter
        try:
            from sklearn.ensemble import RandomForestClassifier
        except ImportError:
            self.is_trained = False
            self.status_msg = 'sklearn nicht installiert'
            return False, {}, self.status_msg

        X, y = [], []
        for s in samples:
            lbl = (s.get('label') or '').strip().lower()
            if lbl not in ('vaginal', 'oral_hand'):
                continue
            X.append(self._feat(s))
            y.append(lbl)

        counts = dict(Counter(y))
        self.class_counts = counts
        self.n_samples    = len(X)

        # Mindest-Anforderungen pruefen
        if len(X) < MIN_TOTAL:
            needed = MIN_TOTAL - len(X)
            self.is_trained = False
            self.status_msg = f'Noch {needed} Label(s) benoetigt (mind. {MIN_TOTAL} gesamt)'
            return False, counts, self.status_msg

        if len(counts) < 2:
            only    = list(counts.keys())[0] if counts else '?'
            missing = 'oral_hand' if only == 'vaginal' else 'vaginal'
            self.is_trained = False
            self.status_msg = f'Beide Typen benoetigt — mind. {MIN_PER_CLASS}x {missing} fehlt noch'
            return False, counts, self.status_msg

        short = [f'{k}: {v}/{MIN_PER_CLASS}' for k, v in counts.items() if v < MIN_PER_CLASS]
        if short:
            self.is_trained = False
            self.status_msg = f'Zu wenig Samples: {", ".join(short)}'
            return False, counts, self.status_msg

        self.clf = RandomForestClassifier(
            n_estimators=20, max_depth=5,
            random_state=42, class_weight='balanced'
        )
        self.clf.fit(X, y)
        self.is_trained = True

        # Wichtigste Features loggen (fuer Debug)
        imp = sorted(zip(self.FEATURE_NAMES, self.clf.feature_importances_),
                     key=lambda x: -x[1])
        top3 = ', '.join(f'{n}={v:.2f}' for n, v in imp[:3])
        self.status_msg = f'Aktiv — {len(X)} Sessions | Top-Features: {top3}'
        return True, counts, self.status_msg

    # ------------------------------------------------------------------
    # Vorhersage
    # ------------------------------------------------------------------
    def predict(self, session):
        """
        Gibt (type_str, confidence_float) zurueck.
        type_str = None wenn kein Modell vorhanden.
        """
        if not self.is_trained or self.clf is None:
            return None, 0.0
        try:
            feat   = [self._feat(session)]
            pred   = self.clf.predict(feat)[0]
            proba  = self.clf.predict_proba(feat)[0]
            classes = self.clf.classes_.tolist()
            conf   = float(proba[classes.index(pred)])
            return pred, round(conf, 3)
        except Exception:
            return None, 0.0

    # ------------------------------------------------------------------
    # Kombinierter Aufruf: Trainieren + Vorhersagen in einem Schritt
    # ------------------------------------------------------------------
    def classify_sessions(self, train_samples, predict_sessions):
        """
        Trainiert auf train_samples, sagt predict_sessions vorher.

        Rueckgabe:
        {
            'trained':       bool,
            'class_counts':  dict,
            'status_msg':    str,
            'n_samples':     int,
            'feature_names': list,
            'results': [{'type': str|None, 'confidence': float}, ...]
        }
        """
        trained, counts, msg = self.train(train_samples)
        results = []
        for s in predict_sessions:
            typ, conf = self.predict(s)
            results.append({'type': typ, 'confidence': conf})
        return {
            'trained':       trained,
            'class_counts':  counts,
            'status_msg':    msg,
            'n_samples':     self.n_samples,
            'feature_names': self.FEATURE_NAMES,
            'results':       results,
        }
