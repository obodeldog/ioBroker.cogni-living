import os
import pickle
import numpy as np
import json
import time # WICHTIG für Zeitstempel

# PFAD-LOGIK: Gehe einen Ordner hoch (zurück zu python_service/)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "security_model.keras")
SCALER_PATH = os.path.join(BASE_DIR, "security_scaler.pkl")
VOCAB_PATH = os.path.join(BASE_DIR, "security_vocab.pkl")
GRAPH_MODEL_PATH = os.path.join(BASE_DIR, "graph_behavior.pkl")
CONFIG_PATH = os.path.join(BASE_DIR, "security_config.json")
DEFAULT_THRESHOLD = 0.05

class SecurityBrain:
    def __init__(self):
        self.model = None; self.scaler = None; self.vocab_encoder = None
        self.max_seq_len = 20; self.dynamic_threshold = DEFAULT_THRESHOLD; self.is_ready = False
        self.graph = GraphEngine()

        # --- NEW: RAPID ADAPTATION LAYER (Few-Shot Overlay) ---
        self.learning_mode_active = False
        self.learning_mode_end = 0
        self.learning_label = "none"
        # Der Buffer speichert 'erlaubte' Sequenzen/Muster als Vektoren oder Hashes
        # Für dieses einfache LSTM speichern wir die Roh-Sequenzen oder vereinfachte Signaturen.
        self.whitelist_buffer = []
        self.last_clean_time = 0

    def load_brain(self):
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
            self.graph.load_behavior()
            return True
        except Exception as e: return False

    # --- NEW: LEARNING CONTROL ---
    def set_learning_mode(self, active, duration_minutes=0, label="manual"):
        """
        Aktiviert oder Deaktiviert den Few-Shot Lernmodus (Overlay).
        """
        if active:
            self.learning_mode_active = True
            self.learning_mode_end = time.time() + (duration_minutes * 60)
            self.learning_label = label
            # Wir löschen den Buffer NICHT sofort beim Start, falls man verlängert.
            # Aber wenn der Label wechselt (z.B. Party -> Urlaub), resetten wir.
            print(f"[SEC] Learning Mode STARTED: {label} for {duration_minutes} min.")
        else:
            self.learning_mode_active = False
            self.learning_mode_end = 0
            self.whitelist_buffer = [] # Hard Reset bei Stop
            print(f"[SEC] Learning Mode STOPPED. Buffer cleared.")

    def check_learning_status(self):
        """Prüft ob Zeit abgelaufen ist (TTL)"""
        if self.learning_mode_active and time.time() > self.learning_mode_end:
            print("[SEC] Learning Mode EXPIRED. Switching back to strict mode.")
            self.set_learning_mode(False)

    def _add_to_whitelist(self, sequence):
        """Fügt ein Muster zur Whitelist hinzu (Few-Shot Learning)"""
        # Wir speichern vereinfacht den letzten Raum oder die Signatur
        # In einer komplexeren Version wäre das ein Embedding-Vektor.
        if not sequence: return

        # Einfache Signatur: Letzter Raum + Vorletzter Raum (Transition)
        # sequence ist z.B. ['kitchen', 'living', 'bath']
        if len(sequence) >= 1:
            signature = sequence[-1] # Der aktuelle Raum ist oft das Wichtigste
            if len(sequence) >= 2:
                signature = f"{sequence[-2]}->{sequence[-1]}"

            if signature not in self.whitelist_buffer:
                self.whitelist_buffer.append(signature)
                # Begrenzung des Buffers, damit er nicht explodiert
                if len(self.whitelist_buffer) > 50:
                    self.whitelist_buffer.pop(0)
                # print(f"[SEC] Learned new pattern: {signature}")

    def _is_whitelisted(self, sequence):
        """Prüft gegen den Overlay-Buffer"""
        if not sequence: return False

        signature = sequence[-1]
        signature_trans = ""
        if len(sequence) >= 2:
            signature_trans = f"{sequence[-2]}->{sequence[-1]}"

        # Check
        if signature in self.whitelist_buffer: return True
        if signature_trans and signature_trans in self.whitelist_buffer: return True

        return False

    def train(self, sequences):
        try:
            # Placeholder for complex LSTM training logic to keep file small for now
            # In a real scenario, you'd paste the full training logic here.
            return True, "Training Simulated (Architecture Split)", 0.05
        except Exception as e: return False, str(e), 0.05

    def predict(self, sequence):
        # 0. Maintenance
        self.check_learning_status()

        if not self.is_ready: return 0.0, False, "Model not ready"

        try:
            # --- 1. SIMULATION LSTM PREDICTION (Placeholder Logic) ---
            # Hier würde normal self.model.predict() stehen.
            # Wir simulieren eine Anomalie für Testzwecke, wenn 'Unknown' drin ist.
            anomaly_score = 0.01
            is_anomaly = False
            explanation = "Normal behavior"

            # Dummy-Logik für "Unbekannt" -> Anomalie
            if sequence and 'Unknown' in sequence:
                anomaly_score = 0.9
                is_anomaly = True
                explanation = "Unknown location sequence"

            # --- 2. LSTM DECISION ---
            # Wenn Score > Threshold -> Anomalie
            if anomaly_score > self.dynamic_threshold:
                is_anomaly = True
                explanation = f"High Reconstruction Error ({anomaly_score:.4f})"

            # --- 3. OVERLAY CHECK (VETO-LOGIK) ---
            if is_anomaly and self.learning_mode_active:
                # Wir prüfen: Kennen wir das schon von heute Abend?
                if self._is_whitelisted(sequence):
                    # VETO!
                    is_anomaly = False
                    explanation = f"Whitelisted by {self.learning_label} mode"
                    # Wir senken den Score künstlich für das Protokoll
                    anomaly_score = self.dynamic_threshold * 0.9
                else:
                    # Noch nicht bekannt, aber wir sind im Lernmodus?
                    # Strategie: Im Lernmodus sind wir toleranter.
                    # Wir fügen es hinzu FÜR DAS NÄCHSTE MAL (One-Shot Learning),
                    # aber beim allerersten Mal geben wir vielleicht noch eine Warnung oder sind still.
                    # HIER: Wir akzeptieren es sofort (agil), wenn es nicht total absurd ist.
                    self._add_to_whitelist(sequence)
                    is_anomaly = False # Sofortige Amnestie
                    explanation = f"Learned new pattern ({self.learning_label})"
                    anomaly_score = 0.0

            return anomaly_score, is_anomaly, explanation

        except Exception as e: return 0.0, False, str(e)

class GraphEngine:
    def __init__(self):
        self.rooms = []; self.adj_matrix = None; self.behavior_matrix = None; self.norm_laplacian = None; self.ready = False

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
        except: pass

    def load_behavior(self):
        if os.path.exists(GRAPH_MODEL_PATH):
            try:
                with open(GRAPH_MODEL_PATH, 'rb') as f: self.behavior_matrix = pickle.load(f)
            except: pass

    def propagate_signal(self, start_room):
        if not self.ready or start_room not in self.rooms: return {}
        # Simple propagation simulation
        n = len(self.rooms)
        x = np.zeros(n)
        if start_room in self.rooms:
            idx = self.rooms.index(start_room)
            x[idx] = 1.0
            scores = self.norm_laplacian.dot(x)
            result = {}
            for i, val in enumerate(scores):
                if self.rooms[i] != start_room and val > 0.05: result[self.rooms[i]] = float(round(val, 3))
            return dict(sorted(result.items(), key=lambda item: item[1], reverse=True))
        return {}