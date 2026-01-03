import os
import pickle
import numpy as np

# Dr.-Ing. Update: Gait Speed mit Debug-Proof (Transparenz)
# Version: 0.28.0 (Math Proof)

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
                for i in range(30, 80): vec[i] = int(count / 50)
            data.append(vec)
        return np.array(data)

    def train(self, digests):
        try:
            from sklearn.ensemble import IsolationForest
            X = self._prepare_features(digests)
            if len(X) < 2: return False, "Need > 2 days data"
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
            res = self.model.predict(X)[0]
            score = self.model.score_samples(X)[0]
            return res, f"Anomaly Score: {score:.3f}"
        except Exception as e: return 0, str(e)

    def analyze_gait_speed(self, sequences):
        """
        Berechnet Trend, Sensoren UND einen mathematischen Beweis.
        Output: (percent_change, list_of_sensors, debug_proof_string)
        """
        try:
            durations = []
            used_sensors = set()

            for seq in sequences:
                steps = seq.get('steps', [])
                if len(steps) < 2: continue

                is_hallway = False
                seq_sensors = []

                for step in steps:
                    loc = step['loc'].lower()
                    if any(x in loc for x in ['flur', 'diele', 'gang']):
                        is_hallway = True
                        seq_sensors.append(step['loc'])

                if is_hallway:
                    duration = steps[-1]['t_delta']
                    if duration > 1 and duration < 20:
                        durations.append(duration)
                        for s in seq_sensors: used_sensors.add(s)

            if len(durations) < 5:
                return None, [], "Zu wenig Datenpunkte (<5 Sequenzen)"

            # Mathematik (Lineare Regression)
            x = np.arange(len(durations))
            y = np.array(durations)
            slope, intercept = np.polyfit(x, y, 1)

            start_val = intercept
            end_val = (slope * (len(durations)-1)) + intercept

            if start_val == 0: start_val = 0.01
            percent_change = ((end_val - start_val) / start_val) * 100

            # --- DER BEWEIS ---
            # Wir formatieren die letzten 5 Messwerte und die Regressions-Parameter
            last_5 = [round(d, 2) for d in durations[-5:]]
            proof = (f"n={len(durations)} Events. Regression y=mx+b: m={slope:.4f}, b={intercept:.2f}. "
                     f"Letzte 5 Messwerte (Sekunden): {last_5}")

            return percent_change, list(used_sensors), proof
        except Exception as e: return None, [], f"Error: {str(e)}"

    def analyze_activity_trend(self, values):
        try:
            if not values or len(values) < 3:
                return 0.0, "Insufficient Data (<3 Days)"
            y = np.array(values, dtype=float)
            x = np.arange(len(y))
            slope, intercept = np.polyfit(x, y, 1)
            start_val = intercept
            end_val = (slope * (len(values)-1)) + intercept
            if start_val <= 0.1: start_val = 0.1
            change_percent = ((end_val - start_val) / start_val) * 100.0
            trend_desc = "Stabil"
            if change_percent > 5: trend_desc = "Steigend"
            elif change_percent < -5: trend_desc = "Fallend"
            return change_percent, f"{trend_desc} ({change_percent:.1f}%)"
        except Exception as e:
            return 0.0, f"Error: {str(e)}"