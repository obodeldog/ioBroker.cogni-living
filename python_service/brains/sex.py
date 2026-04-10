"""
SexBrain — KI-Klassifikation von Intimacy-Sessions (Stufe 3)

Stufe 1+2 laufen in JS (threshold-basiert, per-Typ-Kalibrierung).
Stufe 3:  Hier — sklearn RandomForest auf extrahierten Session-Features.

Aktivierungsbedingung:
  - mind. MIN_PER_CLASS Samples pro Klasse (vaginal + oral_hand)
  - mind. MIN_TOTAL Samples gesamt
  → Solange nicht erfuellt: is_trained=False, Fallback auf JS-Stufe-1/2
"""

MIN_PER_CLASS = 2   # Mindest-Samples pro Klasse fuer Training
MIN_TOTAL     = 5   # Mindest-Samples gesamt


class SexBrain:
    """Klassifikation von Intimacy-Sessions: vaginal / oral_hand / intim."""

    def __init__(self):
        self.clf        = None
        self.is_trained = False
        self.class_counts = {}
        self.n_samples  = 0
        self.status_msg = 'Noch nicht trainiert'

    # ------------------------------------------------------------------
    # Feature-Extraktion
    # ------------------------------------------------------------------
    def _feat(self, s):
        """Feature-Vektor (normiert) aus Session-Dict berechnen."""
        peak    = float(s.get('peak',    0)) / 100.0
        dur     = float(s.get('durSlots',0)) / 24.0   # max 24 Slots = 120 Min
        avg     = float(s.get('avgPeak', 0)) / 100.0
        var     = float(s.get('variance',0)) / 2500.0  # max ~50^2
        tier_b  = 1.0 if s.get('tierB', 0) else 0.0
        return [peak, dur, avg, var, tier_b]

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------
    def train(self, samples):
        """
        samples: Liste von Dicts mit Keys:
            peak, durSlots, avgPeak, variance, tierB, label
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
            self.status_msg = f'Noch {needed} Label(s) benoetigt (min. {MIN_TOTAL} gesamt)'
            return False, counts, self.status_msg

        if len(counts) < 2:
            only = list(counts.keys())[0] if counts else '?'
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
            n_estimators=20, max_depth=4,
            random_state=42, class_weight='balanced'
        )
        self.clf.fit(X, y)
        self.is_trained = True
        self.status_msg = f'Aktiv — {len(X)} Trainings-Sessions'
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
            import numpy as np
            feat = [self._feat(session)]
            pred  = self.clf.predict(feat)[0]
            proba = self.clf.predict_proba(feat)[0]
            classes = self.clf.classes_.tolist()
            conf  = float(proba[classes.index(pred)])
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
            'results': [{'type': str|None, 'confidence': float}, ...]
        }
        """
        trained, counts, msg = self.train(train_samples)
        results = []
        for s in predict_sessions:
            typ, conf = self.predict(s)
            results.append({'type': typ, 'confidence': conf})
        return {
            'trained':      trained,
            'class_counts': counts,
            'status_msg':   msg,
            'n_samples':    self.n_samples,
            'results':      results,
        }
