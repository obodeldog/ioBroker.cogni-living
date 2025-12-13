import os
import pickle
import numpy as np

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
        try:
            durations = []
            for seq in sequences:
                steps = seq.get('steps', [])
                if len(steps) < 2: continue
                is_hallway = all(any(x in step['loc'].lower() for x in ['flur', 'diele', 'gang']) for step in steps)
                if is_hallway:
                    duration = steps[-1]['t_delta']
                    if duration > 1 and duration < 20: durations.append(duration)
            if len(durations) < 5: return None
            x = np.arange(len(durations))
            y = np.array(durations)
            slope, intercept = np.polyfit(x, y, 1)
            start_val = intercept
            end_val = (slope * (len(durations)-1)) + intercept
            if start_val == 0: start_val = 0.01
            percent_change = ((end_val - start_val) / start_val) * 100
            return percent_change
        except: return None