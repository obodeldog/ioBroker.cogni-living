import sys
import json
import time
import os
import pickle
import math
from datetime import datetime

# LOGGING & CONFIG
VERSION = "0.15.4 (Phase C: Energy Training Fix)"
BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE_DIR, "security_model.keras")
SCALER_PATH = os.path.join(BASE_DIR, "security_scaler.pkl")
VOCAB_PATH = os.path.join(BASE_DIR, "security_vocab.pkl")
CONFIG_PATH = os.path.join(BASE_DIR, "security_config.json")
HEALTH_MODEL_PATH = os.path.join(BASE_DIR, "health_model.pkl")
ENERGY_MODEL_PATH = os.path.join(BASE_DIR, "energy_model.pkl")
GRAPH_MODEL_PATH = os.path.join(BASE_DIR, "graph_behavior.pkl")

DEFAULT_THRESHOLD = 0.05
LIBS_AVAILABLE = False

def log(msg):
    print(f"[LOG] {msg}")
    sys.stdout.flush()

def send_result(type, payload):
    msg = {"type": type, "payload": payload}
    print(f"[RESULT] {json.dumps(msg)}")
    sys.stdout.flush()

# --- IMPORTS ---
try:
    import numpy as np
    import pandas as pd
    from sklearn.preprocessing import MinMaxScaler, LabelBinarizer
    from sklearn.ensemble import IsolationForest
    from sklearn.linear_model import LinearRegression
    LIBS_AVAILABLE = True
except ImportError as e:
    log(f"⚠️ CRITICAL: ML-Libs fehlen/defekt: {e}")
    pass
except Exception as e:
    log(f"⚠️ CRITICAL: Unbekannter Fehler beim Import: {e}")
    pass

# --- MODULE 1: HELPERS ---
def calculate_trend(values):
    if not LIBS_AVAILABLE or len(values) < 2: return 0.0, 0.0
    try:
        x = np.arange(len(values))
        y = np.array(values)
        slope, intercept = np.polyfit(x, y, 1)
        start_val = (slope * 0) + intercept
        end_val = (slope * (len(values)-1)) + intercept
        if start_val == 0: start_val = 0.001
        percent_change = ((end_val - start_val) / start_val) * 100
        return slope, percent_change
    except: return 0.0, 0.0

# --- MODULE 2: SECURITY (LSTM) ---
class SecurityBrain:
    def __init__(self):
        self.model = None; self.scaler = None; self.vocab_encoder = None
        self.max_seq_len = 20; self.dynamic_threshold = DEFAULT_THRESHOLD; self.is_ready = False

    def load_brain(self):
        if not LIBS_AVAILABLE: return
        try:
            import tensorflow as tf
            if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH) and os.path.exists(VOCAB_PATH):
                self.model = tf.keras.models.load_model(MODEL_PATH)
                with open(SCALER_PATH, 'rb') as f: self.scaler = pickle.load(f)
                with open(VOCAB_PATH, 'rb') as f: self.vocab_encoder = pickle.load(f)
                if os.path.exists(CONFIG_PATH):
                    with open(CONFIG_PATH, 'r') as f:
                        conf = json.load(f)
                        self.max_seq_len = conf.get('max_seq_len', 20)
                        self.dynamic_threshold = conf.get('threshold', DEFAULT_THRESHOLD)
                self.is_ready = True
                log(f"✅ Security Brain geladen. (Threshold: {self.dynamic_threshold:.5f})")
        except Exception as e: log(f"Fehler Load: {e}")

    def train(self, sequences):
        if not LIBS_AVAILABLE: return False, "No Libs", DEFAULT_THRESHOLD
        import tensorflow as tf
        from tensorflow.keras.models import Sequential
        from tensorflow.keras.layers import LSTM, Dense, RepeatVector, TimeDistributed, Dropout, Input

        try:
            all_locations = set()
            max_len_found = 0
            for seq in sequences:
                steps = seq.get('steps', [])
                if len(steps) > max_len_found: max_len_found = len(steps)
                for step in steps: all_locations.add(step.get('loc', 'Unknown'))

            self.max_seq_len = max(10, min(max_len_found, 50))
            self.vocab_encoder = LabelBinarizer()
            self.vocab_encoder.fit(list(all_locations))
            n_classes = len(self.vocab_encoder.classes_)

            processed_data = []
            for seq in sequences:
                steps = seq.get('steps', [])
                seq_vector = []
                for step in steps:
                    t_delta = step.get('t_delta', 0)
                    loc = step.get('loc', 'Unknown')
                    try: loc_vec = self.vocab_encoder.transform([loc])[0]
                    except: loc_vec = np.zeros(n_classes)
                    step_vec = np.hstack(([t_delta], loc_vec))
                    seq_vector.append(step_vec)

                curr_len = len(seq_vector)
                feature_dim = 1 + n_classes
                if curr_len < self.max_seq_len:
                    padding = np.zeros((self.max_seq_len - curr_len, feature_dim))
                    seq_vector = np.vstack((seq_vector, padding))
                else: seq_vector = np.array(seq_vector[:self.max_seq_len])
                processed_data.append(seq_vector)

            X = np.array(processed_data)
            times = X[:, :, 0].flatten().reshape(-1, 1)
            self.scaler = MinMaxScaler()
            X[:, :, 0] = self.scaler.fit_transform(times).reshape(X.shape[0], X.shape[1])

            input_dim = X.shape[2]; timesteps = X.shape[1]
            model = Sequential([
                Input(shape=(timesteps, input_dim)),
                LSTM(64, activation='relu', return_sequences=True), Dropout(0.2),
                LSTM(32, activation='relu', return_sequences=False),
                RepeatVector(timesteps),
                LSTM(32, activation='relu', return_sequences=True), Dropout(0.2),
                LSTM(64, activation='relu', return_sequences=True),
                TimeDistributed(Dense(input_dim))
            ])
            model.compile(optimizer='adam', loss='mse')
            model.fit(X, X, epochs=100, batch_size=16, validation_split=0.15, verbose=0)

            reconstructions = model.predict(X, verbose=0)
            train_mse = np.mean(np.power(X - reconstructions, 2), axis=(1, 2))
            mean_mse = np.mean(train_mse)
            std_mse = np.std(train_mse)
            self.dynamic_threshold = float(mean_mse + 3 * std_mse)
            if self.dynamic_threshold < 0.01: self.dynamic_threshold = 0.01

            model.save(MODEL_PATH)
            with open(SCALER_PATH, 'wb') as f: pickle.dump(self.scaler, f)
            with open(VOCAB_PATH, 'wb') as f: pickle.dump(self.vocab_encoder, f)
            with open(CONFIG_PATH, 'w') as f: json.dump({'max_seq_len': self.max_seq_len, 'threshold': self.dynamic_threshold}, f)

            self.load_brain()
            return True, "OK", self.dynamic_threshold

        except Exception as e: return False, str(e), DEFAULT_THRESHOLD

    def predict(self, sequence):
        if not self.is_ready: return None, False, "Model not ready"
        try:
            import numpy as np
            steps = sequence.get('steps', [])
            seq_vector = []
            n_classes = len(self.vocab_encoder.classes_)
            step_locations = [s.get('loc', 'Unknown') for s in steps]

            for step in steps:
                t_delta = step.get('t_delta', 0)
                loc = step.get('loc', 'Unknown')
                if loc in self.vocab_encoder.classes_: loc_vec = self.vocab_encoder.transform([loc])[0]
                else: loc_vec = np.zeros(n_classes)
                seq_vector.append(np.hstack(([t_delta], loc_vec)))

            curr_len = len(seq_vector)
            feature_dim = 1 + n_classes
            if curr_len < self.max_seq_len:
                padding = np.zeros((self.max_seq_len - curr_len, feature_dim))
                if curr_len > 0: seq_vector = np.vstack((seq_vector, padding))
                else: seq_vector = padding
            else: seq_vector = np.array(seq_vector[:self.max_seq_len])

            X = np.array([seq_vector])
            time_col = X[:, :, 0].flatten().reshape(-1, 1)
            X[:, :, 0] = self.scaler.transform(time_col).reshape(1, self.max_seq_len)

            reconstruction = self.model.predict(X, verbose=0)
            mse_per_step = np.mean(np.power(X - reconstruction, 2), axis=2)[0]

            relevant_steps = min(len(steps), self.max_seq_len)
            if relevant_steps > 0:
                mse_relevant = mse_per_step[:relevant_steps]
                max_error_idx = np.argmax(mse_relevant)
                culprit_loc = step_locations[max_error_idx] if max_error_idx < len(step_locations) else "Unknown"
            else: culprit_loc = "Unknown"

            total_mse = np.mean(mse_per_step)
            is_anomaly = float(total_mse) > self.dynamic_threshold
            explanation = ""
            if is_anomaly: explanation = f"Unerwartetes Event: {culprit_loc}"

            return float(total_mse), is_anomaly, explanation

        except Exception as e: return 0.0, False, str(e)

# --- MODULE 2.2: GRAPH ENGINE ---
class GraphEngine:
    def __init__(self):
        self.rooms = []
        self.adj_matrix = None
        self.behavior_matrix = None
        self.norm_laplacian = None
        self.ready = False
        self.load_behavior()

    def update_topology(self, payload):
        try:
            self.rooms = payload.get('rooms', [])
            matrix_raw = payload.get('matrix', [])
            if not self.rooms or not matrix_raw: return
            self.adj_matrix = np.array(matrix_raw, dtype=float)
            np.fill_diagonal(self.adj_matrix, 1.0)
            D = np.diag(np.sum(self.adj_matrix, axis=1))
            with np.errstate(divide='ignore'): D_inv_sqrt = np.power(D, -0.5)
            D_inv_sqrt[np.isinf(D_inv_sqrt)] = 0.
            self.norm_laplacian = D_inv_sqrt.dot(self.adj_matrix).dot(D_inv_sqrt)
            self.ready = True
            log(f"GraphEngine: Topology updated. {len(self.rooms)} Nodes.")
        except Exception as e: log(f"GraphEngine Error: {e}")

    def train_behavior(self, sequences):
        if not self.ready or not sequences: return
        try:
            n = len(self.rooms)
            if n == 0: return
            count_matrix = np.zeros((n, n))
            for seq in sequences:
                steps = seq.get('steps', [])
                for i in range(len(steps) - 1):
                    loc_a = steps[i].get('loc'); loc_b = steps[i+1].get('loc')
                    if loc_a in self.rooms and loc_b in self.rooms:
                        idx_a = self.rooms.index(loc_a); idx_b = self.rooms.index(loc_b)
                        count_matrix[idx_a][idx_b] += 1
            row_sums = count_matrix.sum(axis=1, keepdims=True)
            prob_matrix = np.divide(count_matrix, row_sums, out=np.zeros_like(count_matrix), where=row_sums!=0)
            mask = (self.adj_matrix > 0).astype(float)
            self.behavior_matrix = np.multiply(prob_matrix, mask)
            row_sums_2 = self.behavior_matrix.sum(axis=1, keepdims=True)
            self.behavior_matrix = np.divide(self.behavior_matrix, row_sums_2, out=np.zeros_like(self.behavior_matrix), where=row_sums_2!=0)
            with open(GRAPH_MODEL_PATH, 'wb') as f: pickle.dump(self.behavior_matrix, f)
            log(f"🧠 GraphEngine: Behavior Matrix trained.")
        except Exception as e: log(f"Graph Training Error: {e}")

    def load_behavior(self):
        if os.path.exists(GRAPH_MODEL_PATH):
            try:
                with open(GRAPH_MODEL_PATH, 'rb') as f: self.behavior_matrix = pickle.load(f)
            except: pass

    def propagate_signal(self, start_room):
        if not self.ready or start_room not in self.rooms: return {}
        n = len(self.rooms)
        x = np.zeros(n)
        idx = self.rooms.index(start_room)
        x[idx] = 1.0
        scores = np.zeros(n)
        if self.behavior_matrix is not None and self.behavior_matrix.shape == (n, n): scores = np.dot(x, self.behavior_matrix)
        else: scores = self.norm_laplacian.dot(x)
        result = {}
        for i, val in enumerate(scores):
            if self.rooms[i] != start_room and val > 0.05: result[self.rooms[i]] = float(round(val, 3))
        return dict(sorted(result.items(), key=lambda item: item[1], reverse=True))

# --- MODULE 3: HEALTH ---
class HealthBrain:
    def __init__(self): self.model = None; self.is_ready = False
    def load_brain(self):
        if not LIBS_AVAILABLE: return
        try:
            if os.path.exists(HEALTH_MODEL_PATH):
                with open(HEALTH_MODEL_PATH, 'rb') as f: self.model = pickle.load(f); self.is_ready = True
        except: pass

    def _prepare_features(self, digests):
        data = []
        for d in digests:
            vec = d.get('activityVector', None)
            if vec is None or len(vec) != 96:
                count = d.get('eventCount', 0)
                vec = [0] * 96
                for i in range(32, 80): vec[i] = int(count / 48)
            data.append(vec)
        return np.array(data)

    def train(self, digests):
        if not LIBS_AVAILABLE: return False, "No Libs"
        try:
            X = self._prepare_features(digests)
            if len(X) < 2: return False, "Not enough data"
            clf = IsolationForest(random_state=42, contamination='auto')
            clf.fit(X)
            with open(HEALTH_MODEL_PATH, 'wb') as f: pickle.dump(clf, f)
            self.model = clf; self.is_ready = True
            return True, "Modell gespeichert."
        except Exception as e: return False, str(e)

    def predict(self, digest):
        if not self.is_ready: return 0, "Not Ready"
        try:
            X = self._prepare_features([digest])
            res = self.model.predict(X)[0]
            score = self.model.score_samples(X)[0]
            return res, f"Score: {score:.3f}"
        except Exception as e: return 0, str(e)

    def analyze_gait_speed(self, sequences):
        if not LIBS_AVAILABLE: return None
        durations = []
        for seq in sequences:
            steps = seq.get('steps', [])
            if len(steps) < 2: continue
            is_hallway = all(any(x in step['loc'].lower() for x in ['flur', 'corridor', 'hall', 'diele', 'gang', 'treppe']) for step in steps)
            if is_hallway:
                duration = steps[-1]['t_delta']
                if duration > 1 and duration < 20: durations.append(duration)
        if len(durations) < 5: return None
        slope, change = calculate_trend(durations)
        return change

# --- MODULE 4: ENERGY ---
class EnergyBrain:
    def __init__(self): self.scores = {}; self.heating = {}; self.is_ready = False
    def load_brain(self):
        if not LIBS_AVAILABLE: return
        try:
            if os.path.exists(ENERGY_MODEL_PATH):
                with open(ENERGY_MODEL_PATH, 'rb') as f:
                    data = pickle.load(f)
                    self.scores = data.get('scores', {})
                    self.heating = data.get('heating', {})
                self.is_ready = True
        except: pass

    def train(self, points):
        """
        Berechnet Isolationswerte (Negativer Slope) und Heizleistung (Positiver Slope).
        Simple Lineare Regression pro Raum.
        """
        if not LIBS_AVAILABLE or not points: return False, "No Data"
        try:
            df = pd.DataFrame(points)
            if 'ts' in df.columns: df['ts'] = pd.to_datetime(df['ts'], unit='ms')

            # Gruppieren nach Raum
            results_insu = {}
            results_heat = {}

            for room, group in df.groupby('room'):
                if len(group) < 10: continue
                group = group.sort_values('ts')

                # Wir berechnen Delta T pro Stunde
                # Einfachheitshalber nutzen wir Zeitfenster wo T_out < T_in (Heizperiode/Winter)

                # Differenz zum Vorherigen
                group['dt_h'] = group['ts'].diff().dt.total_seconds() / 3600.0
                group['d_temp'] = group['t_in'].diff()
                group['gradient'] = group['d_temp'] / group['dt_h'] # Grad pro Stunde

                # Filter: Valide Gradients (-5 bis +5 Grad/h)
                valid = group[(group['gradient'] > -5) & (group['gradient'] < 5) & (group['dt_h'] > 0.1)].copy()

                if len(valid) < 5: continue

                # 1. Isolation (Kühlung): Wenn Gradient < 0 (Es wird kälter)
                cooling = valid[valid['gradient'] < -0.05]
                if len(cooling) > 5:
                    # Durchschnittlicher Verlust pro Stunde
                    # Besser: Regression gegen (T_in - T_out)
                    # Hier simpel: Median
                    results_insu[room] = float(cooling['gradient'].median())

                # 2. Heizung: Wenn Gradient > 0 (Es wird wärmer)
                heating = valid[valid['gradient'] > 0.1]
                if len(heating) > 5:
                    results_heat[room] = float(heating['gradient'].median())

            # Speichern
            self.scores = results_insu
            self.heating = results_heat

            with open(ENERGY_MODEL_PATH, 'wb') as f:
                pickle.dump({'scores': self.scores, 'heating': self.heating}, f)

            self.is_ready = True

            return True, json.dumps({'insulation': self.scores, 'heating': self.heating})

        except Exception as e: return False, str(e)

    def predict_cooling(self, current_temps, t_out):
        if not self.is_ready: return {}
        forecasts = {}
        for room, t_in in current_temps.items():
            k = self.scores.get(room, -0.2) # Default Fallback
            rate = k # Hier vereinfacht konstant, später k * (t_in - t_out)

            # Physik-Check
            if t_in > t_out and rate > 0: rate = -0.1
            if t_in < t_out and rate < 0: rate = 0.1

            t_1h = t_in + rate
            t_4h = t_in + (rate * 4)
            forecasts[room] = { "1h": round(t_1h, 1), "4h": round(t_4h, 1) }
        return forecasts

# --- MODULE 5: COMFORT ---
class ComfortBrain:
    def __init__(self): self.rules = []

    def train(self, events):
        if not LIBS_AVAILABLE: return False, "No Libs"
        log(f"🛋️ Comfort Training mit {len(events)} Events...")
        try:
            df = pd.DataFrame(events)
            if 'timestamp' in df.columns: df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df = df.sort_values('timestamp')
            patterns_2 = {}; event_counts = {}

            records = df.to_dict('records')
            n = len(records)

            for i in range(n):
                evt_a = records[i]
                id_a = evt_a.get('name', evt_a.get('id', 'unknown'))
                event_counts[id_a] = event_counts.get(id_a, 0) + 1

                for j in range(i + 1, min(i + 10, n)):
                    evt_b = records[j]
                    id_b = evt_b.get('name', evt_b.get('id', 'unknown'))
                    delta_ab = (evt_b['timestamp'] - evt_a['timestamp']).total_seconds()

                    if delta_ab > 45: break
                    if delta_ab < 1.0 or id_a == id_b: continue

                    pair = f"{id_a} -> {id_b}"
                    if pair not in patterns_2: patterns_2[pair] = []
                    patterns_2[pair].append(delta_ab)

            results = []
            for rule, delays in patterns_2.items():
                count = len(delays)
                if count < 3: continue
                source = rule.split(" -> ")[0]
                conf = count / event_counts.get(source, 1)
                if conf > 0.4:
                    avg = float(np.mean(delays))
                    results.append({'rule': rule, 'confidence': conf, 'count': count, 'timeInfo': f"Ø +{avg:.1f}s"})

            results.sort(key=lambda x: x['confidence'], reverse=True)
            return True, results[:5]
        except: return False, []

# SINGLETONS
security_brain = SecurityBrain()
health_brain = HealthBrain()
energy_brain = EnergyBrain()
comfort_brain = ComfortBrain()
graph_brain = GraphEngine()

def process_message(msg):
    try:
        data = json.loads(msg)
        cmd = data.get("command")

        if cmd == "PING":
            send_result("PONG", {"timestamp": time.time()})

        elif cmd == "TRAIN_SECURITY":
            success, details, thresh = security_brain.train(data.get("sequences", []))
            graph_brain.train_behavior(data.get("sequences", []))
            send_result("TRAINING_COMPLETE", {"success": success, "details": details, "threshold": thresh})

        elif cmd == "ANALYZE_SEQUENCE":
            score, is_anomaly, explanation = security_brain.predict(data.get("sequence", {}))
            if score is not None:
                send_result("SECURITY_RESULT", {"anomaly_score": score, "is_anomaly": is_anomaly, "threshold": security_brain.dynamic_threshold, "explanation": explanation})

        elif cmd == "TRAIN_COMFORT":
            success, top_rules = comfort_brain.train(data.get("events", []))
            send_result("COMFORT_RESULT", {"patterns": top_rules if success else []})

        elif cmd == "TRAIN_HEALTH":
            success, details = health_brain.train(data.get("digests", []))
            send_result("HEALTH_TRAIN_RESULT", {"success": success, "details": details})

        elif cmd == "ANALYZE_HEALTH":
            res, details = health_brain.predict(data.get("digest", {}))
            send_result("HEALTH_RESULT", {"is_anomaly": (res == -1), "details": details})

        elif cmd == "ANALYZE_GAIT":
            trend = health_brain.analyze_gait_speed(data.get("sequences", []))
            if trend is not None: send_result("GAIT_RESULT", {"speed_trend": trend})

        # --- FIX: TRAIN ENERGY HANDLER ADDED ---
        elif cmd == "TRAIN_ENERGY":
            success, details = energy_brain.train(data.get("points", []))
            send_result("ENERGY_TRAIN_RESULT", {"success": success, "details": details})

        elif cmd == "PREDICT_ENERGY":
            forecast = energy_brain.predict_cooling(data.get("current_temps", {}), data.get("t_out", 0))
            send_result("ENERGY_PREDICT_RESULT", {"forecast": forecast})

        elif cmd == "SET_TOPOLOGY":
            graph_brain.update_topology(data)
            send_result("TOPOLOGY_ACK", {"success": True})

        elif cmd == "SIMULATE_SIGNAL":
            room = data.get("room")
            neighbors = graph_brain.propagate_signal(room)
            send_result("SIGNAL_RESULT", {"room": room, "propagation": neighbors})

    except Exception as e: log(f"Err processing: {e}")

if __name__ == "__main__":
    log(f"Cogni-Living Engine started. {VERSION}")
    if LIBS_AVAILABLE:
        security_brain.load_brain()
        health_brain.load_brain()
        energy_brain.load_brain()
        graph_brain.load_behavior()
    else:
        log("⚠️ Critical: ML-Libs not available.")

    while True:
        try:
            line = sys.stdin.readline()
            if not line: break
            process_message(line.strip())
        except: break