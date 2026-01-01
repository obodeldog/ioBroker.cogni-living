import os
import pickle
import numpy as np

# Dr.-Ing. Update: Echte Trendberechnung via Linearer Regression
# Version: 0.22.1 (Math Fix)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEALTH_MODEL_PATH = os.path.join(BASE_DIR, "health_if_model.pkl")

class HealthBrain:
    def __init__(self):
        self.model = None
        self.is_ready = False

    def load_brain(self):
        try:
            if os.path.exists(HEALTH_MODEL_PATH):
                with open(HEALTH_MODEL_PATH, 'rb') as f: self.model = pickle.load(f)
                self.is_ready = True
            return True
        except: return False

    def _prepare_features(self, digests):
        data = []
        for d in digests:
            vec = d.get('activityVector', None)
            if vec is None or len(vec) != 96:
                count = d.get('eventCount', 0)
                vec = [0] * 96
                # Fallback: Gleichmäßige Verteilung simulieren, falls Vektor fehlt
                for i in range(30, 80): vec[i] = int(count / 50)
            data.append(vec)
        return np.array(data)

    def train(self, digests):
        try:
            from sklearn.ensemble import IsolationForest
            X = self._prepare_features(digests)
            if len(X) < 2: return False, "Need > 2 days data"
            # Contamination 0.1 bedeutet: Wir erwarten ca. 10% Anomalien im Datensatz
            clf = IsolationForest(random_state=42, contamination=0.1)
            clf.fit(X)
            with open(HEALTH_MODEL_PATH, 'wb') as f: pickle.dump(clf, f)
            self.model = clf; self.is_ready = True
            return True, "Isolation Forest Trained"
        except Exception as e: return False, str(e)

    def predict(self, digest):
        if not self.is_ready: return 0, "Not Ready"
        try:
            X = self._prepare_features([digest])
            res = self.model.predict(X)[0] # 1 = Normal, -1 = Anomalie
            score = self.model.score_samples(X)[0] # Je niedriger, desto anomaler
            return res, f"Anomaly Score: {score:.3f}"
        except Exception as e: return 0, str(e)

    def analyze_gait_speed(self, sequences):
        """
        Berechnet den Trend der Gehgeschwindigkeit (Gait Speed) über die Zeit.
        Nutzt Lineare Regression auf den Zeitdifferenzen im Flur.
        """
        try:
            durations = []
            for seq in sequences:
                steps = seq.get('steps', [])
                if len(steps) < 2: continue
                # Prüfen ob die Sequenz im Flur stattfand (Topologie-Check)
                is_hallway = all(any(x in step['loc'].lower() for x in ['flur', 'diele', 'gang']) for step in steps)
                if is_hallway:
                    duration = steps[-1]['t_delta']
                    # Filter: Nur plausible Geh-Zeiten (kein Rennen, kein Stehenbleiben)
                    if duration > 1 and duration < 20: durations.append(duration)

            if len(durations) < 5: return None

            # Lineare Regression (y = mx + b)
            x = np.arange(len(durations))
            y = np.array(durations)
            slope, intercept = np.polyfit(x, y, 1)

            start_val = intercept
            end_val = (slope * (len(durations)-1)) + intercept

            if start_val == 0: start_val = 0.01
            percent_change = ((end_val - start_val) / start_val) * 100

            # Negativer Wert bei Duration bedeutet SCHNELLER (gut),
            # aber für die GUI wollen wir Speed (m/s).
            # Hier geben wir die Änderung der Dauer zurück.
            return percent_change
        except: return None

    def analyze_activity_trend(self, values):
        """
        NEU: Berechnet den generellen Trend der Aktivität (Vital-Werte).
        Input: Liste von Integern (0-100), die das tägliche Aktivitätsniveau repräsentieren.
        Output: Prozentuale Veränderung (Float) und Debug-String.
        """
        try:
            # Wir brauchen mindestens 3 Datenpunkte für einen sinnvollen Trend
            if not values or len(values) < 3:
                return 0.0, "Insufficient Data (<3 Days)"

            # Daten vorbereiten
            y = np.array(values, dtype=float)
            x = np.arange(len(y))

            # Lineare Regression (Grad 1)
            slope, intercept = np.polyfit(x, y, 1)

            # Start- und Endpunkt auf der Regressionsgeraden berechnen
            start_val = intercept
            end_val = (slope * (len(values)-1)) + intercept

            # Division durch Null abfangen
            if start_val <= 0.1: start_val = 0.1

            # Prozentuale Änderung berechnen
            change_percent = ((end_val - start_val) / start_val) * 100.0

            trend_desc = "Stabil"
            if change_percent > 5: trend_desc = "Steigend"
            elif change_percent < -5: trend_desc = "Fallend"

            return change_percent, f"{trend_desc} ({change_percent:.1f}%)"

        except Exception as e:
            return 0.0, f"Error: {str(e)}"