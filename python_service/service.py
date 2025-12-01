import sys
import json
import time
import os
import pickle
from datetime import datetime

# LOGGING & CONFIG
VERSION = "0.7.0 (Phase B: Live Inference Active)"
MODEL_PATH = os.path.join(os.path.dirname(__file__), "security_model.keras")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "security_scaler.pkl")
VOCAB_PATH = os.path.join(os.path.dirname(__file__), "security_vocab.pkl")
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "security_config.json")

# THRESHOLD FÜR ALARM (Kann später dynamisch werden)
ANOMALY_THRESHOLD = 0.05

# VERSUCH: Externe KI-Libs laden
LIBS_AVAILABLE = False
try:
    import numpy as np
    import pandas as pd
    from sklearn.preprocessing import MinMaxScaler, LabelBinarizer
    # TensorFlow laden wir erst bei Bedarf (Lazy Loading)
    LIBS_AVAILABLE = True
except ImportError as e:
    print(f"[LOG] ⚠️ ML-Import Error: {e}")
    pass

def log(msg):
    """Sendet Logs an Node.js"""
    print(f"[LOG] {msg}")
    sys.stdout.flush()

def send_result(type, payload):
    """Sendet Ergebnisse als JSON an Node.js"""
    msg = {"type": type, "payload": payload}
    print(f"[RESULT] {json.dumps(msg)}")
    sys.stdout.flush()

# --- MODULE 1: HEALTH (Trend Analysis) ---
def calculate_trend(values):
    """Berechnet lineare Regression für Vitalitäts-Trends"""
    if not LIBS_AVAILABLE or len(values) < 2:
        return 0.0, 0.0
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

# --- MODULE 2: SECURITY (LSTM Autoencoder) ---
class SecurityBrain:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.vocab_encoder = None # LabelBinarizer für Räume
        self.max_seq_len = 20 # Standard, wird beim Training angepasst
        self.is_ready = False

    def load_brain(self):
        """Versucht, ein existierendes Modell und Metadaten zu laden"""
        if not LIBS_AVAILABLE: return
        try:
            import tensorflow as tf

            # Check if all artifacts exist
            if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH) and os.path.exists(VOCAB_PATH):

                # 1. Load Model
                self.model = tf.keras.models.load_model(MODEL_PATH)

                # 2. Load Scaler
                with open(SCALER_PATH, 'rb') as f:
                    self.scaler = pickle.load(f)

                # 3. Load Vocab (Locations)
                with open(VOCAB_PATH, 'rb') as f:
                    self.vocab_encoder = pickle.load(f)

                # 4. Load Config (Max Len)
                if os.path.exists(CONFIG_PATH):
                    with open(CONFIG_PATH, 'r') as f:
                        conf = json.load(f)
                        self.max_seq_len = conf.get('max_seq_len', 20)

                self.is_ready = True
                log(f"✅ Security Brain geladen. (SeqLen: {self.max_seq_len}, Classes: {len(self.vocab_encoder.classes_)})")
            else:
                log("ℹ️ Kein Security Brain gefunden. Bitte Training starten.")
        except Exception as e:
            log(f"Fehler beim Laden des Brains: {e}")
            self.is_ready = False

    def train(self, sequences):
        """Trainiert den Autoencoder."""
        if not LIBS_AVAILABLE:
            log("❌ Kann nicht trainieren: Bibliotheken fehlen.")
            return False, "Bibliotheken fehlen"

        import tensorflow as tf
        from tensorflow.keras.models import Sequential
        from tensorflow.keras.layers import LSTM, Dense, RepeatVector, TimeDistributed, Dropout, Input

        log(f"🚀 Starte Training mit {len(sequences)} Sequenzen...")

        try:
            # --- A. FEATURE ENGINEERING ---
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
                    try:
                        loc_vec = self.vocab_encoder.transform([loc])[0]
                    except:
                        loc_vec = np.zeros(n_classes)
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

            # --- B. MODELL ARCHITEKTUR ---
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

            # --- C. TRAINING ---
            history = model.fit(X, X, epochs=100, batch_size=16, validation_split=0.15, verbose=0)
            final_loss = history.history['loss'][-1]

            log(f"✅ Training abgeschlossen. Final Loss (MSE): {final_loss:.5f}")

            # --- D. SPEICHERN ---
            model.save(MODEL_PATH)
            with open(SCALER_PATH, 'wb') as f: pickle.dump(self.scaler, f)
            with open(VOCAB_PATH, 'wb') as f: pickle.dump(self.vocab_encoder, f)
            with open(CONFIG_PATH, 'w') as f: json.dump({'max_seq_len': self.max_seq_len}, f)

            self.model = model
            self.is_ready = True
            return True, f"Loss: {final_loss:.4f}"

        except Exception as e:
            log(f"❌ Training Crash: {e}")
            return False, str(e)

    def predict(self, sequence):
        """Prüft eine einzelne Sequenz auf Anomalie."""
        if not self.is_ready:
            return None, False, "Model not ready"

        try:
            # 1. Preprocessing (exakt wie beim Training)
            steps = sequence.get('steps', [])
            seq_vector = []
            n_classes = len(self.vocab_encoder.classes_)

            for step in steps:
                t_delta = step.get('t_delta', 0)
                loc = step.get('loc', 'Unknown')

                # Robustes Transform (Unbekannte Räume abfangen)
                if loc in self.vocab_encoder.classes_:
                    loc_vec = self.vocab_encoder.transform([loc])[0]
                else:
                    # Fallback für neuen/unbekannten Raum -> Null-Vektor
                    loc_vec = np.zeros(n_classes)

                step_vec = np.hstack(([t_delta], loc_vec))
                seq_vector.append(step_vec)

            # Padding / Truncating
            curr_len = len(seq_vector)
            feature_dim = 1 + n_classes

            if curr_len < self.max_seq_len:
                padding = np.zeros((self.max_seq_len - curr_len, feature_dim))
                if curr_len > 0:
                    seq_vector = np.vstack((seq_vector, padding))
                else:
                    seq_vector = padding
            else:
                seq_vector = np.array(seq_vector[:self.max_seq_len])

            # Input Shape [1, Timesteps, Features]
            X = np.array([seq_vector])

            # Skalierung der Zeit (Feature 0)
            time_col = X[:, :, 0].flatten().reshape(-1, 1)
            time_scaled = self.scaler.transform(time_col)
            X[:, :, 0] = time_scaled.reshape(1, self.max_seq_len)

            # 2. Inferenz (Vorhersage)
            reconstruction = self.model.predict(X, verbose=0)

            # 3. Fehlerberechnung (MSE)
            mse = np.mean(np.power(X - reconstruction, 2))

            is_anomaly = float(mse) > ANOMALY_THRESHOLD

            return float(mse), is_anomaly, "OK"

        except Exception as e:
            log(f"Predict Error: {e}")
            return 0.0, False, str(e)

# SINGLETON INSTANCE
security_brain = SecurityBrain()

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

            send_result("TREND_RESULT", {
                "tag": tag,
                "slope": round(slope, 4),
                "change_percent": round(change, 2),
                "diagnosis": diagnosis
            })

        elif cmd == "TRAIN_SECURITY":
            sequences = data.get("sequences", [])
            if len(sequences) < 5:
                log("Zu wenig Daten für Training (min 5).")
                send_result("TRAINING_COMPLETE", {"success": False, "reason": "Not enough data (<5)"})
            else:
                success, details = security_brain.train(sequences)
                send_result("TRAINING_COMPLETE", {"success": success, "details": details})

        elif cmd == "ANALYZE_SEQUENCE":
            # LIVE CHECK (Scharf geschaltet)
            sequence = data.get("sequence", {})
            score, is_anomaly, msg = security_brain.predict(sequence)

            if score is None:
                log(f"Inferenz nicht möglich: {msg}")
            else:
                log(f"🛡️ Security Check: MSE={score:.5f} | Anomaly={is_anomaly}")
                send_result("SECURITY_RESULT", {
                    "anomaly_score": score,
                    "is_anomaly": is_anomaly,
                    "threshold": ANOMALY_THRESHOLD
                })

        else:
            log(f"Unbekannter Befehl: {cmd}")

    except Exception as e:
        log(f"Fehler: {e}")

def main():
    log(f"Hybrid-Engine gestartet. {VERSION}")

    if LIBS_AVAILABLE:
        log("✅ ML-Bibliotheken verfügbar.")
        security_brain.load_brain()
    else:
        log("⚠️ ML-Libs fehlen. Werden installiert...")

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