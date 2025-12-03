import sys
import json
import time
import os
import pickle
from datetime import datetime

# LOGGING & CONFIG
VERSION = "0.9.3 (Phase B: Dynamic Threshold Upgrade)"
MODEL_PATH = os.path.join(os.path.dirname(__file__), "security_model.keras")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "security_scaler.pkl")
VOCAB_PATH = os.path.join(os.path.dirname(__file__), "security_vocab.pkl")
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "security_config.json")
HEALTH_MODEL_PATH = os.path.join(os.path.dirname(__file__), "health_model.pkl")
ENERGY_MODEL_PATH = os.path.join(os.path.dirname(__file__), "energy_model.pkl")

# FALLBACK THRESHOLD (wird durch Training überschrieben)
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

# --- MODULE 1: CORE HELPERS ---
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
        log(f"Math Error: {e}")
        return 0.0, 0.0

# --- MODULE 2: SECURITY (LSTM) ---
class SecurityBrain:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.vocab_encoder = None
        self.max_seq_len = 20
        self.dynamic_threshold = DEFAULT_THRESHOLD
        self.is_ready = False

    def load_brain(self):
        if not LIBS_AVAILABLE: return
        try:
            import tensorflow as tf
            if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH) and os.path.exists(VOCAB_PATH):
                self.model = tf.keras.models.load_model(MODEL_PATH)
                with open(SCALER_PATH, 'rb') as f: self.scaler = pickle.load(f)
                with open(VOCAB_PATH, 'rb') as f: self.vocab_encoder = pickle.load(f)

                # Load Configuration & Threshold
                if os.path.exists(CONFIG_PATH):
                    with open(CONFIG_PATH, 'r') as f:
                        conf = json.load(f)
                        self.max_seq_len = conf.get('max_seq_len', 20)
                        self.dynamic_threshold = conf.get('threshold', DEFAULT_THRESHOLD)

                self.is_ready = True
                log(f"✅ Security Brain geladen. (SeqLen: {self.max_seq_len}, Threshold: {self.dynamic_threshold:.5f})")
            else:
                log("ℹ️ Kein Security Brain gefunden. Bitte Training starten.")
        except Exception as e:
            log(f"Fehler beim Laden des Security Brains: {e}")
            self.is_ready = False

    def train(self, sequences):
        if not LIBS_AVAILABLE: return False, "Bibliotheken fehlen"
        import tensorflow as tf
        from tensorflow.keras.models import Sequential
        from tensorflow.keras.layers import LSTM, Dense, RepeatVector, TimeDistributed, Dropout, Input

        log(f"🚀 Starte Security Training mit {len(sequences)} Sequenzen...")
        try:
            # A. Feature Engineering
            all_locations = set()
            max_len_found = 0
            for seq in sequences:
                steps = seq.get('steps', [])
                if len(steps) > max_len_found: max_len_found = len(steps)
                for step in steps:
                    loc = step.get('loc', 'Unknown')
                    all_locations.add(loc)

            self.max_seq_len = max(10, min(max_len_found, 50))
            self.vocab_encoder = LabelBinarizer()
            self.vocab_encoder.fit(list(all_locations))
            n_classes = len(self.vocab_encoder.classes_)

            log(f"🔍 Training Setup: MaxLen={self.max_seq_len}, Locations={n_classes}")

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
                else:
                    seq_vector = np.array(seq_vector[:self.max_seq_len])
                processed_data.append(seq_vector)

            X = np.array(processed_data)
            times = X[:, :, 0].flatten().reshape(-1, 1)
            self.scaler = MinMaxScaler()
            times_scaled = self.scaler.fit_transform(times)
            X[:, :, 0] = times_scaled.reshape(X.shape[0], X.shape[1])

            # B. Model
            input_dim = X.shape[2]
            timesteps = X.shape[1]

            model = Sequential([
                Input(shape=(timesteps, input_dim)),
                LSTM(64, activation='relu', return_sequences=True),
                Dropout(0.2),
                LSTM(32, activation='relu', return_sequences=False),
                RepeatVector(timesteps),
                LSTM(32, activation='relu', return_sequences=True),
                Dropout(0.2),
                LSTM(64, activation='relu', return_sequences=True),
                TimeDistributed(Dense(input_dim))
            ])
            model.compile(optimizer='adam', loss='mse')

            # C. Train
            history = model.fit(X, X, epochs=100, batch_size=16, validation_split=0.15, verbose=0)
            final_loss = history.history['loss'][-1]

            # D. Dynamic Threshold Calculation (mu + 3*sigma)
            log("📊 Berechne dynamischen Threshold...")
            reconstructions = model.predict(X, verbose=0)
            # MSE per sample (axis 1=timesteps, 2=features)
            train_mse = np.mean(np.power(X - reconstructions, 2), axis=(1, 2))
            mean_mse = np.mean(train_mse)
            std_mse = np.std(train_mse)

            # Formel: Mean + 3 * StdDev
            self.dynamic_threshold = float(mean_mse + 3 * std_mse)

            # Safety Fallback: Nicht unter 0.01 gehen, um False Positives bei sehr sauberen Daten zu vermeiden
            if self.dynamic_threshold < 0.01:
                self.dynamic_threshold = 0.01

            log(f"🎯 Neuer Threshold: {self.dynamic_threshold:.5f} (Mean: {mean_mse:.5f}, Std: {std_mse:.5f})")

            # E. Save
            model.save(MODEL_PATH)
            with open(SCALER_PATH, 'wb') as f: pickle.dump(self.scaler, f)
            with open(VOCAB_PATH, 'wb') as f: pickle.dump(self.vocab_encoder, f)
            with open(CONFIG_PATH, 'w') as f:
                json.dump({
                    'max_seq_len': self.max_seq_len,
                    'threshold': self.dynamic_threshold
                }, f)

            # F. FORCE RELOAD
            self.load_brain()

            return True, f"Loss: {final_loss:.4f} | Threshold: {self.dynamic_threshold:.4f}"

        except Exception as e:
            log(f"❌ Training Crash: {e}")
            return False, str(e)

    def predict(self, sequence):
        if not self.is_ready: return None, False, "Model not ready"
        try:
            import numpy as np
            steps = sequence.get('steps', [])
            seq_vector = []
            n_classes = len(self.vocab_encoder.classes_)

            for step in steps:
                t_delta = step.get('t_delta', 0)
                loc = step.get('loc', 'Unknown')
                if loc in self.vocab_encoder.classes_:
                    loc_vec = self.vocab_encoder.transform([loc])[0]
                else:
                    loc_vec = np.zeros(n_classes)
                step_vec = np.hstack(([t_delta], loc_vec))
                seq_vector.append(step_vec)

            curr_len = len(seq_vector)
            feature_dim = 1 + n_classes
            if curr_len < self.max_seq_len:
                padding = np.zeros((self.max_seq_len - curr_len, feature_dim))
                if curr_len > 0: seq_vector = np.vstack((seq_vector, padding))
                else: seq_vector = padding
            else:
                seq_vector = np.array(seq_vector[:self.max_seq_len])

            X = np.array([seq_vector])
            time_col = X[:, :, 0].flatten().reshape(-1, 1)
            time_scaled = self.scaler.transform(time_col)
            X[:, :, 0] = time_scaled.reshape(1, self.max_seq_len)

            reconstruction = self.model.predict(X, verbose=0)
            mse = np.mean(np.power(X - reconstruction, 2))

            # COMPARE AGAINST DYNAMIC THRESHOLD
            is_anomaly = float(mse) > self.dynamic_threshold

            return float(mse), is_anomaly, "OK"
        except Exception as e:
            return 0.0, False, str(e)

# --- MODULE 3: HEALTH (Isolation Forest) ---
class HealthBrain:
    def __init__(self):
        self.model = None
        self.is_ready = False
        self.activity_map = {'sehr niedrig': 1, 'niedrig': 2, 'normal': 3, 'hoch': 4, 'sehr hoch': 5}

    def load_brain(self):
        if not LIBS_AVAILABLE: return
        try:
            if os.path.exists(HEALTH_MODEL_PATH):
                with open(HEALTH_MODEL_PATH, 'rb') as f:
                    self.model = pickle.load(f)
                self.is_ready = True
                log("✅ Health Brain geladen.")
            else:
                log("ℹ️ Kein Health Brain gefunden.")
        except Exception as e:
            log(f"Fehler Health Load: {e}")

    def _prepare_features(self, digests):
        data = []
        for d in digests:
            lvl_str = d.get('activityLevel', 'normal').lower()
            lvl = self.activity_map.get(lvl_str, 3)
            count = d.get('eventCount', 0)
            health_data = d.get('health', {})
            sleep = 0
            if health_data and 'sleepScore' in health_data:
                sleep = health_data['sleepScore'] or 0
            data.append([lvl, count, sleep])
        return np.array(data)

    def train(self, digests):
        if not LIBS_AVAILABLE: return False, "No Libs"
        log(f"🩺 Starte Health Training mit {len(digests)} Tagen...")
        try:
            X = self._prepare_features(digests)
            clf = IsolationForest(random_state=42, contamination='auto')
            clf.fit(X)
            with open(HEALTH_MODEL_PATH, 'wb') as f: pickle.dump(clf, f)
            self.model = clf
            self.is_ready = True
            return True, "Modell gespeichert."
        except Exception as e:
            return False, str(e)

    def predict(self, digest):
        if not self.is_ready: return 0, "Not Ready"
        try:
            X = self._prepare_features([digest])
            res = self.model.predict(X)[0]
            score = self.model.score_samples(X)[0]
            return res, f"Score: {score:.3f}"
        except Exception as e:
            return 0, str(e)

# --- MODULE 4: ENERGY (Linear Regression PER ROOM + HEATING) ---
class EnergyBrain:
    def __init__(self):
        self.models = {}
        self.scores = {}
        self.heating_rates = {} # Neu: Aufheiz-Speed
        self.is_ready = False

    def load_brain(self):
        if not LIBS_AVAILABLE: return
        try:
            if os.path.exists(ENERGY_MODEL_PATH):
                with open(ENERGY_MODEL_PATH, 'rb') as f:
                    data = pickle.load(f)
                    self.models = data.get('models', {})
                    self.scores = data.get('scores', {})
                    self.heating_rates = data.get('heating', {}) # Laden
                self.is_ready = True
                log(f"✅ Energy Brain geladen. (Räume: {len(self.scores)})")
            else:
                log("ℹ️ Kein Energy Brain gefunden.")
        except Exception as e:
            log(f"Fehler Energy Load: {e}")

    def train(self, data_points):
        if not LIBS_AVAILABLE: return False, "No Libs"
        log(f"🍃 Starte Energy Training (Isolation & Heating) mit {len(data_points)} Punkten...")

        try:
            df = pd.DataFrame(data_points)
            df['ts'] = pd.to_datetime(df['ts'], unit='ms')
            room_groups = df.groupby('room')

            new_scores = {}
            new_models = {}
            new_heating_rates = {}
            processed_rooms = 0

            for room_name, group_df in room_groups:
                group_df = group_df.sort_values('ts')
                group_df['dt_sec'] = group_df['ts'].diff().dt.total_seconds()
                group_df['temp_change'] = group_df['t_in'].diff()

                # A. ISOLATION (Abkühlung)
                cooling = group_df[(group_df['temp_change'] < 0) & (group_df['dt_sec'] > 300) & (group_df['dt_sec'] < 3600)].copy()

                if len(cooling) >= 10:
                    cooling['rate_per_hour'] = (cooling['temp_change'] / cooling['dt_sec']) * 3600
                    cooling['delta_t'] = cooling['t_in'] - cooling['t_out']

                    X = cooling[['delta_t']].values
                    y = cooling['rate_per_hour'].values

                    reg = LinearRegression()
                    reg.fit(X, y)
                    new_models[room_name] = reg
                    new_scores[room_name] = round(reg.coef_[0], 4)
                    processed_rooms += 1
                else:
                    log(f"  -> {room_name}: Zu wenig Cooling-Daten.")

                # B. HEATING (Aufheizung)
                # Wir suchen positive Temp-Änderungen
                heating = group_df[(group_df['temp_change'] > 0) & (group_df['dt_sec'] > 300) & (group_df['dt_sec'] < 3600)].copy()
                if len(heating) >= 5:
                    heating['rate_per_hour'] = (heating['temp_change'] / heating['dt_sec']) * 3600
                    # Wir nehmen den Median als robusten Schätzer für "Wie schnell heizt es typischerweise auf?"
                    median_heat_rate = heating['rate_per_hour'].median()
                    new_heating_rates[room_name] = round(median_heat_rate, 2)

            if processed_rooms == 0 and len(new_heating_rates) == 0:
                return False, "Keine Räume mit genügend Daten."

            with open(ENERGY_MODEL_PATH, 'wb') as f:
                pickle.dump({'models': new_models, 'scores': new_scores, 'heating': new_heating_rates}, f)

            self.models = new_models
            self.scores = new_scores
            self.heating_rates = new_heating_rates
            self.is_ready = True

            # Kombiniertes Resultat zurückgeben
            result_json = json.dumps({
                "insulation": new_scores,
                "heating": new_heating_rates
            })

            return True, result_json

        except Exception as e:
            log(f"Energy Train Error: {e}")
            return False, str(e)

# SINGLETONS
security_brain = SecurityBrain()
health_brain = HealthBrain()
energy_brain = EnergyBrain()

def process_message(msg):
    try:
        data = json.loads(msg)
        cmd = data.get("command")

        if cmd == "PING":
            send_result("PONG", {"timestamp": time.time()})
        elif cmd == "ANALYZE_TREND":
            values = data.get("values", [])
            tag = data.get("tag", "General")
            slope, change = calculate_trend(values)
            diagnosis = "Stabil"
            if change < -10: diagnosis = "Signifikanter Abfall"
            elif change < -5: diagnosis = "Leichter Abfall"
            elif change > 5: diagnosis = "Anstieg (Positiv)"
            send_result("TREND_RESULT", {"tag": tag, "slope": round(slope, 4), "change_percent": round(change, 2), "diagnosis": diagnosis})
        elif cmd == "TRAIN_SECURITY":
            sequences = data.get("sequences", [])
            if len(sequences) < 5:
                send_result("TRAINING_COMPLETE", {"success": False, "reason": "Not enough data"})
            else:
                success, details = security_brain.train(sequences)
                send_result("TRAINING_COMPLETE", {"success": success, "details": details})
        elif cmd == "ANALYZE_SEQUENCE":
            sequence = data.get("sequence", {})
            score, is_anomaly, msg = security_brain.predict(sequence)
            if score is not None:
                log(f"🛡️ SECURITY CHECK: Score {score:.5f} -> {'ANOMALY' if is_anomaly else 'OK'}")
                # SEND THE DYNAMIC THRESHOLD BACK
                send_result("SECURITY_RESULT", {
                    "anomaly_score": score,
                    "is_anomaly": is_anomaly,
                    "threshold": security_brain.dynamic_threshold
                })
        elif cmd == "TRAIN_HEALTH":
            digests = data.get("digests", [])
            if len(digests) < 3:
                send_result("HEALTH_TRAIN_RESULT", {"success": False, "reason": "Min 3 days needed"})
            else:
                success, details = health_brain.train(digests)
                send_result("HEALTH_TRAIN_RESULT", {"success": success, "details": details})
        elif cmd == "ANALYZE_HEALTH":
            digest = data.get("digest", {})
            res, details = health_brain.predict(digest)
            send_result("HEALTH_RESULT", {"is_anomaly": (res == -1), "details": details})
        elif cmd == "TRAIN_ENERGY":
            points = data.get("points", [])
            if len(points) < 20:
                log("Zu wenig Thermo-Daten (min 20).")
                send_result("ENERGY_TRAIN_RESULT", {"success": False, "reason": "Min 20 points needed"})
            else:
                success, details = energy_brain.train(points)
                send_result("ENERGY_TRAIN_RESULT", {"success": success, "details": details})
        else:
            log(f"Unbekannt: {cmd}")
    except Exception as e:
        log(f"Fehler: {e}")

def main():
    log(f"Hybrid-Engine gestartet. {VERSION}")
    if LIBS_AVAILABLE:
        log("✅ ML-Bibliotheken verfügbar.")
        security_brain.load_brain()
        health_brain.load_brain()
        energy_brain.load_brain()
    else:
        log("⚠️ ML-Libs fehlen.")
    while True:
        try:
            line = sys.stdin.readline()
            if not line: break
            process_message(line.strip())
        except KeyboardInterrupt:
            break
        except Exception as e:
            log(f"Loop Fehler: {e}")

if __name__ == "__main__":
    main()