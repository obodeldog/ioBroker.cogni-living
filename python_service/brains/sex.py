import os
import pickle

# Persistenz-Pfad (identisches Muster wie energy.py, health.py, etc.)
_ADAPTER_DIR   = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_DATA_DIR      = os.path.join(os.path.dirname(os.path.dirname(_ADAPTER_DIR)), 'iobroker-data', 'cogni-living')
if not os.path.exists(_DATA_DIR):
    try:
        os.makedirs(_DATA_DIR, exist_ok=True)
    except Exception:
        _DATA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEX_MODEL_PATH = os.path.join(_DATA_DIR, 'sex_model.pkl')

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
        'bath_before',       # 1=Bad-Bewegung <60min vorher, 0=nein
        'bath_after',        # 1=Bad-Bewegung <60min nachher, 0=nein
        'nearby_room_motion',# 1=Bewegung in Hop<=2-Raum waehrend Session, 0=nein, -1=keine Topologie
    ]

    def __init__(self):
        self.clf                = None
        self.is_trained         = False
        self.class_counts       = {}
        self.n_samples          = 0
        self.status_msg         = 'Noch nicht trainiert'
        self.feature_importances = []
        self.loo_accuracy       = None
        self.model_date         = None  # Datum des letzten gespeicherten Modells

    # ------------------------------------------------------------------
    # Persistenz (identisches Muster wie EnergyBrain, HealthBrain, etc.)
    # ------------------------------------------------------------------
    def load_brain(self):
        """Laedt trainiertes Modell von Disk (sex_model.pkl). Gibt True zurueck wenn erfolgreich."""
        try:
            if os.path.exists(SEX_MODEL_PATH):
                with open(SEX_MODEL_PATH, 'rb') as f:
                    data = pickle.load(f)
                self.clf               = data.get('clf')
                self.is_trained        = data.get('is_trained', False)
                self.class_counts      = data.get('class_counts', {})
                self.n_samples         = data.get('n_samples', 0)
                self.status_msg        = data.get('status_msg', 'Modell von Disk geladen')
                self.feature_importances = data.get('feature_importances', [])
                self.loo_accuracy      = data.get('loo_accuracy')
                self.model_date        = data.get('model_date')
                if self.is_trained:
                    print(f'[SexBrain] Modell geladen ({self.model_date}) — {self.n_samples} Samples, trained={self.is_trained}')
            return self.is_trained
        except Exception as e:
            print(f'[SexBrain] load_brain Fehler: {e}')
            return False

    def save_brain(self):
        """Speichert trainiertes Modell auf Disk (sex_model.pkl)."""
        try:
            from datetime import datetime
            self.model_date = datetime.now().strftime('%Y-%m-%d %H:%M')
            with open(SEX_MODEL_PATH, 'wb') as f:
                pickle.dump({
                    'clf':                self.clf,
                    'is_trained':         self.is_trained,
                    'class_counts':       self.class_counts,
                    'n_samples':          self.n_samples,
                    'status_msg':         self.status_msg,
                    'feature_importances': self.feature_importances,
                    'loo_accuracy':       self.loo_accuracy,
                    'model_date':         self.model_date,
                }, f)
            print(f'[SexBrain] Modell gespeichert ({self.model_date})')
        except Exception as e:
            print(f'[SexBrain] save_brain Fehler: {e}')

    # ------------------------------------------------------------------
    # Feature-Extraktion (Sentinel -1 fuer fehlende Kontext-Sensoren)
    # ------------------------------------------------------------------
    def _feat(self, s):
        """13-dimensionaler Feature-Vektor aus Session-Dict."""
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
            _v('nearbyRoomMotion', 1.0),  # 0=ruhig, 1=Bewegung in Nachbarraum, -1=keine Topologie
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
            if lbl not in ('vaginal', 'oral_hand', 'nullnummer'):
                continue
            X.append(self._feat(s))
            y.append(lbl)

        counts = dict(Counter(y))
        self.class_counts = counts
        self.n_samples    = len(X)

        # Mindest-Anforderungen pruefen (nur fuer positive Klassen vaginal + oral_hand)
        pos_counts = {k: v for k, v in counts.items() if k in ('vaginal', 'oral_hand')}

        if len(X) < MIN_TOTAL:
            needed = MIN_TOTAL - len(X)
            self.is_trained = False
            self.status_msg = f'Noch {needed} Label(s) benoetigt (mind. {MIN_TOTAL} gesamt)'
            return False, counts, self.status_msg

        if len(pos_counts) < 2:
            only    = list(pos_counts.keys())[0] if pos_counts else '?'
            missing = 'oral_hand' if only == 'vaginal' else 'vaginal'
            self.is_trained = False
            self.status_msg = f'Beide Typen benoetigt — mind. {MIN_PER_CLASS}x {missing} fehlt noch'
            return False, counts, self.status_msg

        # Nullnummer braucht kein Mindest-Count — auch 1 Nullnummer-Sample ist wertvoll
        short = [f'{k}: {v}/{MIN_PER_CLASS}' for k, v in pos_counts.items() if v < MIN_PER_CLASS]
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

        # Feature-Importance berechnen + speichern
        imp_pairs = sorted(zip(self.FEATURE_NAMES, self.clf.feature_importances_),
                           key=lambda x: -x[1])
        self.feature_importances = [
            {'name': n, 'importance': round(float(v), 4)} for n, v in imp_pairs
        ]
        top3 = ', '.join(f'{n}={v:.2f}' for n, v in imp_pairs[:3])

        # Leave-One-Out Genauigkeit (nur bei >=5 Samples sinnvoll)
        self.loo_accuracy = None
        if len(X) >= 5:
            try:
                from sklearn.model_selection import LeaveOneOut
                loo    = LeaveOneOut()
                X_arr  = [self._feat(s) for s in [sp for sp in samples if (sp.get('label') or '').strip().lower() in ('vaginal', 'oral_hand')]]
                y_arr  = [lbl for lbl in y]
                n_correct = 0
                for train_idx, test_idx in loo.split(X_arr):
                    clf_loo = RandomForestClassifier(
                        n_estimators=20, max_depth=5,
                        random_state=42, class_weight='balanced'
                    )
                    X_train = [X_arr[i] for i in train_idx]
                    y_train = [y_arr[i] for i in train_idx]
                    if len(set(y_train)) < 2:
                        continue  # LOO-Fold ohne beide Klassen überspringen
                    clf_loo.fit(X_train, y_train)
                    pred_loo = clf_loo.predict([X_arr[test_idx[0]]])[0]
                    if pred_loo == y_arr[test_idx[0]]:
                        n_correct += 1
                self.loo_accuracy = round(n_correct / len(X_arr), 3)
            except Exception:
                self.loo_accuracy = None

        nn = counts.get('nullnummer', 0)
        nn_info = f' | {nn}x Nullnummer' if nn > 0 else ''
        self.status_msg = f'Aktiv — {len(X)} Sessions{nn_info} | Top-Features: {top3}'
        self.save_brain()  # Modell persistent auf Disk speichern
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
        # Zustand vor dem Training sichern (falls neu trainieren scheitert)
        _prev_clf         = self.clf
        _prev_trained     = self.is_trained
        _prev_fi          = self.feature_importances
        _prev_loo         = self.loo_accuracy
        _prev_counts      = self.class_counts
        _prev_date        = self.model_date

        trained, counts, msg = self.train(train_samples)

        # Wenn Neutraining scheitert, aber gespeichertes Modell vorhanden: weiter nutzen
        if not trained and _prev_trained and _prev_clf is not None:
            self.clf              = _prev_clf
            self.is_trained       = True
            self.feature_importances = _prev_fi
            self.loo_accuracy     = _prev_loo
            self.class_counts     = _prev_counts
            trained               = True
            msg = f'Gespeichertes Modell ({_prev_date}) — zu wenig neue Daten fuer Neutraining'

        results = []
        for s in predict_sessions:
            typ, conf = self.predict(s)
            results.append({'type': typ, 'confidence': conf})
        return {
            'trained':              trained,
            'class_counts':         self.class_counts,
            'status_msg':           msg,
            'n_samples':            self.n_samples,
            'feature_names':        self.FEATURE_NAMES,
            'feature_importances':  getattr(self, 'feature_importances', []),
            'loo_accuracy':         getattr(self, 'loo_accuracy', None),
            'model_date':           getattr(self, 'model_date', None),
            'results':              results,
        }
