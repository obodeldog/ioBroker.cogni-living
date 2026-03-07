import os
import pickle
import numpy as np
import json
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "security_model.keras")
SCALER_PATH = os.path.join(BASE_DIR, "security_scaler.pkl")
VOCAB_PATH = os.path.join(BASE_DIR, "security_vocab.pkl")
GRAPH_MODEL_PATH = os.path.join(BASE_DIR, "graph_behavior.pkl")
CONFIG_PATH = os.path.join(BASE_DIR, "security_config.json")
# IsolationForest-Modell für Sequenz-Anomalie (trainiert aus dailyDigests)
IF_MODEL_PATH = os.path.join(BASE_DIR, "security_if_model.pkl")
DEFAULT_THRESHOLD = 0.05

class SecurityBrain:
    def __init__(self):
        self.model = None; self.scaler = None; self.vocab_encoder = None
        self.max_seq_len = 20; self.dynamic_threshold = DEFAULT_THRESHOLD; self.is_ready = False
        self.graph = GraphEngine()
        # IsolationForest als primärer Anomalie-Detektor (ersetzt LSTM-Placeholder)
        self.if_model = None
        self._load_if_model()

        # --- NEW: RAPID ADAPTATION LAYER (Few-Shot Overlay) ---
        self.learning_mode_active = False
        self.learning_mode_end = 0
        self.learning_label = "none"
        # Der Buffer speichert 'erlaubte' Sequenzen/Muster als Vektoren oder Hashes
        # Für dieses einfache LSTM speichern wir die Roh-Sequenzen oder vereinfachte Signaturen.
        self.whitelist_buffer = []
        self.last_clean_time = 0

    def _load_if_model(self):
        """Lädt den IsolationForest sofern bereits trainiert."""
        try:
            if os.path.exists(IF_MODEL_PATH):
                with open(IF_MODEL_PATH, 'rb') as f:
                    self.if_model = pickle.load(f)
        except Exception:
            self.if_model = None

    def _train_if_model(self, digests):
        """
        Trainiert IsolationForest auf Tages-Aktivitätsvektoren aus den dailyDigests.
        Wird bei TRAIN_SECURITY automatisch aufgerufen.
        """
        try:
            from sklearn.ensemble import IsolationForest
            vectors = []
            for d in digests:
                vec = d.get('activityVector', None)
                if vec and len(vec) == 96:
                    vectors.append(vec)
                else:
                    count = d.get('eventCount', 0)
                    v = [0] * 96
                    for i in range(30, 80): v[i] = int(count / 50)
                    vectors.append(v)
            if len(vectors) < 3:
                return False
            X = np.array(vectors)
            clf = IsolationForest(random_state=42, contamination=0.1)
            clf.fit(X)
            with open(IF_MODEL_PATH, 'wb') as f:
                pickle.dump(clf, f)
            self.if_model = clf
            return True
        except Exception:
            return False

    def _if_score(self, sequence):
        """
        Berechnet Anomalie-Score aus IsolationForest (0.0=normal, 1.0=stark anomal).
        Kodiert die Sequenz als 96-dim Vektor (Stunden × Transitionen).
        """
        if self.if_model is None:
            return None
        try:
            vec = [0] * 96
            for step in (sequence or []):
                room = str(step).lower() if isinstance(step, str) else str(step.get('loc', '')).lower()
                h = hash(room) % 96
                if vec[h] < 5: vec[h] += 1
            X = np.array([vec])
            raw = self.if_model.score_samples(X)[0]
            return max(0.0, min(1.0, -raw))
        except Exception:
            return None

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
            self._load_if_model()
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
        """
        Trainiert den IsolationForest auf Sequenz-Daten.
        sequences kann dailyDigests oder Raumsequenzen sein.
        """
        try:
            digests = sequences if isinstance(sequences, list) else []
            trained = self._train_if_model(digests)
            msg = "IsolationForest trained" if trained else "Not enough data (<3 days)"
            return True, msg, DEFAULT_THRESHOLD
        except Exception as e:
            return False, str(e), DEFAULT_THRESHOLD

    def predict(self, sequence):
        self.check_learning_status()

        try:
            # IsolationForest-Score (personalisiert, trainiert auf eigenen Daten)
            if_score = self._if_score(sequence)

            if if_score is not None:
                anomaly_score = if_score
            else:
                # Kein trainiertes Modell: KEIN Alarm ausloesen
                # Erst nach erfolgreichem Training sinnvoll
                anomaly_score = 0.1
                return anomaly_score, False, "Kein Modell trainiert - bitte Training starten"
            is_anomaly = anomaly_score > self.dynamic_threshold
            explanation = f"IF Score: {anomaly_score:.3f}" if if_score is not None else "Fallback score"

            # Overlay: Lernmodus vetoed Anomalien
            if is_anomaly and self.learning_mode_active:
                if self._is_whitelisted(sequence):
                    is_anomaly = False
                    anomaly_score = self.dynamic_threshold * 0.9
                    explanation = f"Whitelisted by {self.learning_label} mode"
                else:
                    self._add_to_whitelist(sequence)
                    is_anomaly = False
                    anomaly_score = 0.0
                    explanation = f"Learned new pattern ({self.learning_label})"

            return anomaly_score, is_anomaly, explanation

        except Exception as e:
            return 0.1, False, str(e)

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