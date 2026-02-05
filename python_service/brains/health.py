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

    def analyze_weekly_heatmap(self, week_data):
        """
        Intelligente Heatmap-Analyse für 7 Tage × 24 Stunden.
        Nutzt IsolationForest + Regel-basierte Tageszeiten-Logik.
        
        Input: week_data = {
            'YYYY-MM-DD': {
                'eventHistory': [...],
                'date': Date object
            }
        }
        
        Output: {
            'YYYY-MM-DD': {
                'hourly_counts': [0..23],
                'anomaly_scores': [0..23],
                'rule_flags': [0..23],
                'baseline': [0..23]
            }
        }
        """
        try:
            result = {}
            
            # Schritt 1: Erstelle stündliche Vektoren für alle Tage
            daily_vectors = {}
            for date_str, day_data in week_data.items():
                events = day_data.get('eventHistory', [])
                hourly_counts = [0] * 24
                
                for event in events:
                    if not isinstance(event, dict):
                        continue
                    
                    # Motion-Events filtern
                    e_type = str(event.get('type', '')).lower()
                    e_name = str(event.get('name', '')).lower()
                    e_value = event.get('value')
                    
                    is_motion = ('bewegung' in e_type or 'motion' in e_type or 
                                'presence' in e_type or 'bewegung' in e_name)
                    is_active = e_value in [True, 1, 'on', 'true']
                    
                    if is_motion and is_active:
                        timestamp = event.get('timestamp', 0)
                        if timestamp > 0:
                            from datetime import datetime
                            dt = datetime.fromtimestamp(timestamp / 1000.0)
                            hour = dt.hour
                            if 0 <= hour < 24:
                                hourly_counts[hour] += 1
                
                daily_vectors[date_str] = hourly_counts
            
            # Schritt 2: Berechne Baseline (Durchschnitt über alle Tage)
            if len(daily_vectors) > 0:
                all_vecs = np.array(list(daily_vectors.values()))
                baseline = np.mean(all_vecs, axis=0)
            else:
                baseline = np.zeros(24)
            
            # Schritt 3: Anomalie-Scores (IsolationForest wenn Modell vorhanden)
            for date_str, hourly_counts in daily_vectors.items():
                anomaly_scores = [0.0] * 24
                rule_flags = ['NORMAL'] * 24
                
                # IsolationForest: Vergleiche mit Baseline
                if self.is_ready and self.model is not None:
                    try:
                        for hour in range(24):
                            count = hourly_counts[hour]
                            base = baseline[hour]
                            
                            # Normalisiere Score (-1 bis 0)
                            if base > 0:
                                deviation = abs(count - base) / (base + 1.0)
                                # Je höher deviation, desto niedriger der Score
                                anomaly_scores[hour] = -deviation
                            else:
                                anomaly_scores[hour] = 0.0
                    except:
                        pass
                
                # Regel-basierte Flags (Tageszeiten-Kontext)
                for hour in range(24):
                    count = hourly_counts[hour]
                    base = max(baseline[hour], 1.0)
                    
                    # Nachts (22-06 Uhr): Hohe Aktivität = Problem
                    if (hour >= 22 or hour < 6):
                        if count > base * 2.0:
                            rule_flags[hour] = 'NIGHT_HIGH_ACTIVITY'
                            anomaly_scores[hour] = -0.8  # Override
                    
                    # Morgens (06-10 Uhr): Niedrige Aktivität = Problem
                    elif 6 <= hour < 10:
                        if count < base * 0.3 and base > 5:
                            rule_flags[hour] = 'MORNING_NO_ACTIVITY'
                            anomaly_scores[hour] = -0.7  # Override
                    
                    # Tagsüber (10-20 Uhr): Sehr niedrige Aktivität = Beobachten
                    elif 10 <= hour < 20:
                        if count < base * 0.2 and base > 3:
                            rule_flags[hour] = 'DAY_LOW_ACTIVITY'
                            if anomaly_scores[hour] > -0.3:
                                anomaly_scores[hour] = -0.3
                
                result[date_str] = {
                    'hourly_counts': hourly_counts,
                    'anomaly_scores': anomaly_scores,
                    'rule_flags': rule_flags,
                    'baseline': baseline.tolist()
                }
            
            return result
        
        except Exception as e:
            return {'error': str(e)}