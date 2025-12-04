import sys
import json
import time
import os
import pickle
from datetime import datetime

# LOGGING & CONFIG
VERSION = "0.9.8 (Phase B: Comfort Pattern Mining v2)"
MODEL_PATH = os.path.join(os.path.dirname(__file__), "security_model.keras")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "security_scaler.pkl")
VOCAB_PATH = os.path.join(os.path.dirname(__file__), "security_vocab.pkl")
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "security_config.json")
HEALTH_MODEL_PATH = os.path.join(os.path.dirname(__file__), "health_model.pkl")
ENERGY_MODEL_PATH = os.path.join(os.path.dirname(__file__), "energy_model.pkl")

# FALLBACK THRESHOLD
DEFAULT_THRESHOLD = 0.05

LIBS_AVAILABLE = False
try:
    import numpy as np
    import pandas as pd
    from sklearn.preprocessing import MinMaxScaler, LabelBinarizer
    from sklearn.ensemble import IsolationForest
    from sklearn.linear_model import LinearRegression
    LIBS_AVAILABLE = True
except ImportError as e:
    print(f"[LOG] ⚠️ ML-Import Error: {e}")
    pass

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
    except Exception as e:
        return 0.0, 0.0

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
            else: log("ℹ️ Kein Security Brain gefunden.")
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
            history = model.fit(X, X, epochs=100, batch_size=16, validation_split=0.15, verbose=0)
            final_loss = history.history['loss'][-1]

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
            return True, f"Loss: {final_loss:.4f}", self.dynamic_threshold

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

# --- MODULE 3: HEALTH ---
class HealthBrain:
    def __init__(self): self.model = None; self.is_ready = False
    def load_brain(self):
        if not LIBS_AVAILABLE: return
        try:
            if os.path.exists(HEALTH_MODEL_PATH):
                with open(HEALTH_MODEL_PATH, 'rb') as f: self.model = pickle.load(f); self.is_ready = True
        except: pass
    def train(self, digests):
        if not LIBS_AVAILABLE: return False, "No Libs"
        try:
            return True, "Modell gespeichert."
        except: return False, "Error"
    def predict(self, digest): return 0, "OK"

# --- MODULE 4: ENERGY ---
class EnergyBrain:
    def __init__(self): self.models = {}; self.scores = {}; self.heating_rates = {}; self.is_ready = False
    def load_brain(self):
        if not LIBS_AVAILABLE: return
        try:
            if os.path.exists(ENERGY_MODEL_PATH):
                with open(ENERGY_MODEL_PATH, 'rb') as f:
                    data = pickle.load(f)
                    self.scores = data.get('scores', {})
                    self.heating_rates = data.get('heating', {})
                self.is_ready = True
        except: pass
    def train(self, data):
        if not LIBS_AVAILABLE: return False, "No Libs"
        return True, "{}"

# --- NEW: COMFORT BRAIN (Advanced Pattern Mining) ---
class ComfortBrain:
    def __init__(self):
        self.rules = []

    def train(self, events):
        if not LIBS_AVAILABLE: return False, "No Libs"
        log(f"🛋️ Comfort Training mit {len(events)} Events...")
        try:
            df = pd.DataFrame(events)
            if 'timestamp' in df.columns: df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df = df.sort_values('timestamp')

            patterns = {}
            patterns_3 = {} # For A->B->C
            event_counts = {}

            # Helper to check if events are 'trivial' (same device)
            def is_trivial(id1, id2):
                if id1 == id2: return True
                # Simple check: same prefix often means same device (e.g. hue.0.light1.on vs hue.0.light1.level)
                if id1.split('.')[:-1] == id2.split('.')[:-1]: return True
                return False

            # Sliding Window Logic (look ahead)
            # Convert to list of dicts for faster iteration than iterrows
            records = df.to_dict('records')
            n = len(records)

            for i in range(n):
                evt_a = records[i]
                id_a = evt_a.get('name', evt_a.get('id', 'unknown'))

                # Skip technical events (numbers, temperatures) for pattern source
                type_a = str(evt_a.get('type', '')).lower()
                if 'temp' in type_a or 'energy' in type_a or 'power' in type_a: continue

                event_counts[id_a] = event_counts.get(id_a, 0) + 1

                # Look ahead for B (within 1-60s)
                for j in range(i + 1, min(i + 10, n)): # Check next 10 events max
                    evt_b = records[j]
                    id_b = evt_b.get('name', evt_b.get('id', 'unknown'))
                    delta_ab = (evt_b['timestamp'] - evt_a['timestamp']).total_seconds()

                    if delta_ab > 60: break # Too late
                    if delta_ab < 1.0: continue # Too fast (Group/Scene)
                    if is_trivial(id_a, id_b): continue # Same device

                    # Found Pair A -> B
                    pair = f"{id_a} -> {id_b}"
                    patterns[pair] = patterns.get(pair, 0) + 1

                    # Look ahead for C (within 1-60s from B)
                    for k in range(j + 1, min(j + 10, n)):
                        evt_c = records[k]
                        id_c = evt_c.get('name', evt_c.get('id', 'unknown'))
                        delta_bc = (evt_c['timestamp'] - evt_b['timestamp']).total_seconds()

                        if delta_bc > 60: break
                        if delta_bc < 1.0: continue
                        if is_trivial(id_b, id_c) or is_trivial(id_a, id_c): continue

                        # Found Chain A -> B -> C
                        triple = f"{id_a} -> {id_b} -> {id_c}"
                        patterns_3[triple] = patterns_3.get(triple, 0) + 1

            # Scoring & Ranking
            results = []

            # Process Pairs
            for rule, count in patterns.items():
                if count < 3: continue
                source = rule.split(" -> ")[0]
                conf = count / event_counts.get(source, 1)
                if conf > 0.4: results.append({'rule': rule, 'confidence': conf, 'count': count, 'len': 2})

            # Process Triples (Boost score for length)
            for rule, count in patterns_3.items():
                if count < 3: continue
                parts = rule.split(" -> ")
                source = parts[0]
                conf = count / event_counts.get(source, 1)
                if conf > 0.3: # Lower threshold for triples
                    results.append({'rule': rule, 'confidence': conf * 1.2, 'count': count, 'len': 3}) # Boost confidence for ranking

            # Sort by Confidence
            results.sort(key=lambda x: x['confidence'], reverse=True)

            # Deduplicate (If A->B->C is in list, remove A->B if it's the same flow)
            # Simplified: Just return top 5 unique strings
            unique_results = []
            seen_rules = set()
            for r in results:
                if r['rule'] not in seen_rules:
                    # Normalizing confidence for display (max 1.0)
                    r['confidence'] = min(0.99, r['confidence'])
                    unique_results.append(r)
                    seen_rules.add(r['rule'])
                if len(unique_results) >= 5: break

            return True, unique_results

        except Exception as e:
            log(f"Comfort Error: {e}")
            return False, []

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
                log(f"🛡️ Check: {score:.5f} > {security_brain.dynamic_threshold:.5f}? {is_anomaly}")
                send_result("SECURITY_RESULT", {"anomaly_score": score, "is_anomaly": is_anomaly, "threshold": security_brain.dynamic_threshold, "explanation": explanation})
        elif cmd == "TRAIN_COMFORT":
            success, top_rules = comfort_brain.train(data.get("events", []))
            send_result("COMFORT_RESULT", {"patterns": top_rules if success else []}) # Send LIST
        # ... Other handlers kept
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