import os
import pickle
import numpy as np
import json

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

    def train(self, sequences):
        try:
            # Placeholder for complex LSTM training logic to keep file small for now
            # In a real scenario, you'd paste the full training logic here.
            return True, "Training Simulated (Architecture Split)", 0.05
        except Exception as e: return False, str(e), 0.05

    def predict(self, sequence):
        if not self.is_ready: return 0.0, False, "Model not ready"
        try:
            # Placeholder logic until full LSTM inference code is moved here
            return 0.01, False, "Architecture Split OK"
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