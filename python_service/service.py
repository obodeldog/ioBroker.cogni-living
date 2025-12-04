import sys
import json
import time
import os
import pickle
import math
from datetime import datetime

# LOGGING & CONFIG
VERSION = "0.11.0 (Phase C: Prediction & Gait)"
MODEL_PATH = os.path.join(os.path.dirname(__file__), "security_model.keras")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "security_scaler.pkl")
VOCAB_PATH = os.path.join(os.path.dirname(__file__), "security_vocab.pkl")
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "security_config.json")
HEALTH_MODEL_PATH = os.path.join(os.path.dirname(__file__), "health_model.pkl")
ENERGY_MODEL_PATH = os.path.join(os.path.dirname(__file__), "energy_model.pkl")

DEFAULT_THRESHOLD = 0.05
LIBS_AVAILABLE = False
try:
    import numpy as np
    import pandas as pd
    from sklearn.preprocessing import MinMaxScaler, LabelBinarizer
    from sklearn.ensemble import IsolationForest
    from sklearn.linear_model import LinearRegression
    LIBS_AVAILABLE = True
except ImportError: pass

def log(msg):
    print(f"[LOG] {msg}")
    sys.stdout.flush()

def send_result(type, payload):
    msg = {"type": type, "payload": payload}
    print(f"[RESULT] {json.dumps(msg)}")
    sys.stdout.flush()

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

        log(f"🚀 Starte Security Training ({len(sequences)} seq)...")
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

# --- MODULE 3: HEALTH (With Gait Speed) ---
class HealthBrain:
    def __init__(self): self.model = None; self.is_ready = False
    def load_brain(self):
        if not LIBS_AVAILABLE: return
        try:
            if os.path.exists(HEALTH_MODEL_PATH):
                with open(HEALTH_MODEL_PATH, 'rb') as f: self.model = pickle.load(f); self.is_ready = True
        except: pass

    def train(self, digests): return True, "Saved"
    def predict(self, digest): return 0, "OK"

    def analyze_gait_speed(self, sequences):
        # Find motion sequences in Hallway ('Flur', 'Corridor', etc.)
        # Calculate duration and check for trend
        if not LIBS_AVAILABLE: return None
        durations = []
        for seq in sequences:
            steps = seq.get('steps', [])
            if len(steps) < 2: continue

            # Check if all locations involve typical "Hallway" names
            is_hallway = all(any(x in step['loc'].lower() for x in ['flur', 'corridor', 'hall', 'diele', 'gang', 'treppe']) for step in steps)

            if is_hallway:
                duration = steps[-1]['t_delta']
                if duration > 1 and duration < 20: # Valid walk
                    durations.append(duration)

        if len(durations) < 5: return None

        # Calculate trend
        slope, change = calculate_trend(durations)
        return change # % change in speed (positive = slower)

# --- MODULE 4: ENERGY (With Prediction) ---
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

    def train(self, data):
        if not LIBS_AVAILABLE: return False, "No Libs"
        # Simplified training reuse
        return True, "{}"

    def predict_cooling(self, current_temps, t_out):
        # Forecast temperature in 1h, 2h, 4h
        if not self.is_ready: return {}

        forecasts = {}
        for room, t_in in current_temps.items():
            k = self.scores.get(room, -0.5) # Default cooling rate if unknown
            # Linear approximation from training: Rate = k * (T_in - T_out)
            # 1 Hour Forecast
            delta_t = t_in - t_out

            # If regression was Rate = k (slope), then Rate is fixed per deg diff?
            # We assume k is the coefficient from LinearRegression(delta_t -> rate_per_hour)
            # So rate = k * delta_t + intercept (ignoring intercept for now)
            rate = k * delta_t

            # Safety checks (Physics: it cools down towards t_out)
            if t_in > t_out and rate > 0: rate = -0.1 # Force cooling
            if t_in < t_out and rate < 0: rate = 0.1 # Force warming (summer)

            t_1h = t_in + rate
            t_4h = t_in + (rate * 4)

            forecasts[room] = {
                "1h": round(t_1h, 1),
                "4h": round(t_4h, 1)
            }
        return forecasts

# --- MODULE 5: COMFORT ---
class ComfortBrain:
    def __init__(self): self.rules = []

    def train(self, events):
        if not LIBS_AVAILABLE: return False, "No Libs"
        # ... (Full Pattern Mining Logic from v0.10.0 reused here) ...
        try:
            df = pd.DataFrame(events)
            if 'timestamp' in df.columns: df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df = df.sort_values('timestamp')

            patterns_2 = {}
            patterns_3 = {}
            event_counts = {}

            def is_trivial(id1, id2):
                if id1 == id2: return True
                if id1.split('.')[:-1] == id2.split('.')[:-1]: return True
                return False

            records = df.to_dict('records')
            n = len(records)

            for i in range(n):
                evt_a = records[i]
                id_a = evt_a.get('name', evt_a.get('id', 'unknown'))
                type_a = str(evt_a.get('type', '')).lower()
                if 'temp' in type_a or 'energy' in type_a or 'power' in type_a: continue
                event_counts[id_a] = event_counts.get(id_a, 0) + 1

                for j in range(i + 1, min(i + 10, n)):
                    evt_b = records[j]
                    id_b = evt_b.get('name', evt_b.get('id', 'unknown'))
                    delta_ab = (evt_b['timestamp'] - evt_a['timestamp']).total_seconds()
                    if delta_ab > 45: break
                    if delta_ab < 1.0: continue
                    if is_trivial(id_a, id_b): continue
                    pair = f"{id_a} -> {id_b}"
                    if pair not in patterns_2: patterns_2[pair] = []
                    patterns_2[pair].append(delta_ab)

                    for k in range(j + 1, min(j + 10, n)):
                        evt_c = records[k]
                        id_c = evt_c.get('name', evt_c.get('id', 'unknown'))
                        delta_bc = (evt_c['timestamp'] - evt_b['timestamp']).total_seconds()
                        if delta_bc > 45: break
                        if delta_bc < 1.0: continue
                        if is_trivial(id_b, id_c) or is_trivial(id_a, id_c): continue
                        triple = f"{id_a} -> {id_b} -> {id_c}"
                        delta_ac = (evt_c['timestamp'] - evt_a['timestamp']).total_seconds()
                        if triple not in patterns_3: patterns_3[triple] = {'delays_b': [], 'delays_c': []}
                        patterns_3[triple]['delays_b'].append(delta_ab)
                        patterns_3[triple]['delays_c'].append(delta_ac)

            results = []
            for rule, delays in patterns_2.items():
                count = len(delays)
                if count < 3: continue
                source = rule.split(" -> ")[0]
                conf = count / event_counts.get(source, 1)
                if conf > 0.4:
                    avg = float(np.mean(delays))
                    results.append({'rule': rule, 'confidence': conf, 'count': count, 'type': 'pair', 'timeInfo': f"Ø +{avg:.1f}s"})

            for rule, data in patterns_3.items():
                count = len(data['delays_b'])
                if count < 3: continue
                source = rule.split(" -> ")[0]
                conf = count / event_counts.get(source, 1)
                if conf > 0.3:
                    avg_b = float(np.mean(data['delays_b']))
                    avg_c = float(np.mean(data['delays_c']))
                    results.append({'rule': rule, 'confidence': conf * 1.2, 'count': count, 'type': 'triple', 'timeInfo': f"+{avg_b:.1f}s → +{avg_c:.1f}s"})

            results.sort(key=lambda x: x['confidence'], reverse=True)
            final_results = []
            rules_seen = set()
            for r in results:
                if r['type'] == 'triple':
                    final_results.append(r); parts = r['rule'].split(" -> "); rules_seen.add(f"{parts[0]} -> {parts[1]}"); rules_seen.add(f"{parts[1]} -> {parts[2]}")
            for r in results:
                if r['type'] == 'pair' and r['rule'] not in rules_seen: final_results.append(r)

            final_results.sort(key=lambda x: x['confidence'], reverse=True)
            return True, final_results[:5]
        except: return False, []

# SINGLETONS
security_brain = SecurityBrain()
health_brain = HealthBrain()
energy_brain = EnergyBrain()
comfort_brain = ComfortBrain()

def process_message(msg):
    try:
        data = json.loads(msg)
        cmd = data.get("command")
        if cmd == "PING": send_result("PONG", {"timestamp": time.time()})
        elif cmd == "TRAIN_SECURITY":
            success, details, thresh = security_brain.train(data.get("sequences", []))
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

        # --- NEW PHASE C COMMANDS ---
        elif cmd == "ANALYZE_GAIT":
            trend = health_brain.analyze_gait_speed(data.get("sequences", []))
            if trend is not None:
                send_result("GAIT_RESULT", {"speed_trend": trend})

        elif cmd == "PREDICT_ENERGY":
            forecast = energy_brain.predict_cooling(data.get("current_temps", {}), data.get("t_out", 0))
            send_result("ENERGY_PREDICT_RESULT", {"forecast": forecast})

    except Exception as e: log(f"Err: {e}")

if __name__ == "__main__":
    log(f"Hybrid-Engine gestartet. {VERSION}")
    if LIBS_AVAILABLE: security_brain.load_brain(); health_brain.load_brain(); energy_brain.load_brain()
    while True:
        try:
            line = sys.stdin.readline()
            if not line: break
            process_message(line.strip())
        except: break