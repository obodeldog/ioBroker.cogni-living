import sys
import json
import time
import os
import pickle
from datetime import datetime

# LOGGING & CONFIG
VERSION = "0.5.0 (Hybrid: Guardian Core + Security LSTM Skeleton)"
MODEL_PATH = os.path.join(os.path.dirname(__file__), "security_model.keras")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "security_scaler.pkl")

# VERSUCH: Externe KI-Libs laden
LIBS_AVAILABLE = False
try:
    import numpy as np
    import pandas as pd
    from sklearn.preprocessing import MinMaxScaler
    # TensorFlow laden wir erst bei Bedarf (Lazy Loading), um den Start zu beschleunigen
    LIBS_AVAILABLE = True
except ImportError:
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
        self.is_ready = False

    def load_brain(self):
        """Versucht, ein existierendes Modell zu laden"""
        if not LIBS_AVAILABLE: return
        try:
            import tensorflow as tf
            if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
                self.model = tf.keras.models.load_model(MODEL_PATH)
                with open(SCALER_PATH, 'rb') as f:
                    self.scaler = pickle.load(f)
                self.is_ready = True
                log("✅ Security Brain (LSTM) erfolgreich geladen.")
            else:
                log("ℹ️ Kein Security Brain gefunden. Training erforderlich.")
        except Exception as e:
            log(f"Fehler beim Laden des Brains: {e}")

    def train(self, sequences):
        """
        Trainiert den Autoencoder mit den gesammelten Sequenzen.
        Dies ist rechenintensiv!
        """
        if not LIBS_AVAILABLE:
            log("❌ Kann nicht trainieren: Bibliotheken fehlen.")
            return False

        import tensorflow as tf
        from tensorflow.keras.models import Sequential
        from tensorflow.keras.layers import LSTM, Dense, RepeatVector, TimeDistributed

        log(f"🚀 Starte Training mit {len(sequences)} Sequenzen...")

        try:
            # 1. Datenaufbereitung (Feature Engineering)
            # Wir extrahieren nur die Zeit-Deltas (Rhythmus) für den Anfang
            # Später: One-Hot-Encoding der Räume hinzufügen
            data = []
            max_len = 0

            # Finde maximale Länge einer Sequenz
            for seq in sequences:
                steps = seq.get('steps', [])
                if len(steps) > max_len: max_len = len(steps)

            # Padding & Extraction
            # Wir nehmen hier vereinfacht nur die 't_delta' Zeiten
            # Ziel: Das Netz soll den "Rhythmus" des Hauses lernen.
            for seq in sequences:
                steps = seq.get('steps', [])
                deltas = [s['t_delta'] for s in steps]

                # Padding mit 0, falls kürzer als max_len
                while len(deltas) < max_len:
                    deltas.append(0)

                data.append(deltas)

            # Normalisierung
            dataset = np.array(data)
            self.scaler = MinMaxScaler()
            scaled_data = self.scaler.fit_transform(dataset)

            # Reshape für LSTM [Samples, Timesteps, Features]
            X = scaled_data.reshape((scaled_data.shape[0], scaled_data.shape[1], 1))

            # 2. Modell-Architektur (Autoencoder)
            model = Sequential([
                LSTM(64, activation='relu', input_shape=(X.shape[1], X.shape[2]), return_sequences=True),
                LSTM(32, activation='relu', return_sequences=False),
                RepeatVector(X.shape[1]),
                LSTM(32, activation='relu', return_sequences=True),
                LSTM(64, activation='relu', return_sequences=True),
                TimeDistributed(Dense(X.shape[2]))
            ])

            model.compile(optimizer='adam', loss='mse')

            # 3. Training
            history = model.fit(X, X, epochs=50, batch_size=32, validation_split=0.1, verbose=0)
            loss = history.history['loss'][-1]

            log(f"✅ Training abgeschlossen. Final Loss: {loss:.4f}")

            # 4. Speichern
            model.save(MODEL_PATH)
            with open(SCALER_PATH, 'wb') as f:
                pickle.dump(self.scaler, f)

            self.model = model
            self.is_ready = True
            return True

        except Exception as e:
            log(f"Training Crash: {e}")
            return False

# SINGLETON INSTANCE
security_brain = SecurityBrain()

def process_message(msg):
    try:
        data = json.loads(msg)
        cmd = data.get("command")

        if cmd == "PING":
            send_result("PONG", {"timestamp": time.time()})

        elif cmd == "ANALYZE_TREND":
            # Bestehende Health-Logik
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
            # NEU: Trigger für das Training
            sequences = data.get("sequences", [])
            if len(sequences) < 10:
                log("Zu wenig Daten für Training (min 10).")
                send_result("TRAINING_COMPLETE", {"success": False, "reason": "Not enough data"})
            else:
                success = security_brain.train(sequences)
                send_result("TRAINING_COMPLETE", {"success": success})

        elif cmd == "ANALYZE_SEQUENCE":
            # Live-Check (Placeholder bis Modell trainiert ist)
            log("SECURITY Check: Sequenz empfangen. (Inferenz noch inaktiv)")
            send_result("SECURITY_RESULT", {"anomaly_score": 0, "is_anomaly": False})

        else:
            log(f"Unbekannter Befehl: {cmd}")

    except Exception as e:
        log(f"Fehler: {e}")

def main():
    log(f"Hybrid-Engine gestartet. {VERSION}")

    if LIBS_AVAILABLE:
        log("✅ ML-Bibliotheken geladen.")
        # Versuche beim Start, ein altes Modell zu laden
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