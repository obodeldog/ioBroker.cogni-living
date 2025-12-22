import numpy as np
import os
import pickle
import time
import json

# PFAD-LOGIK (Konsistent mit energy.py/security.py)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(BASE_DIR)), 'iobroker-data', 'cogni-living')

if not os.path.exists(DATA_DIR):
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
    except:
        DATA_DIR = BASE_DIR

TRACKER_STATE_PATH = os.path.join(DATA_DIR, "tracker_state.pkl")

class ParticleFilter:
    def __init__(self, num_particles=1000):
        self.num_particles = num_particles
        self.rooms = []           # Liste der Raumnamen (Strings)
        self.adj_matrix = None    # Numpy Array (N x N)
        self.particles = None     # Array der Länge N (Raum-Indizes)
        self.weights = None       # Array der Länge N (Gewichte)
        self.monitored_mask = None # Boolean Array (True = Raum hat Bewegungsmelder)
        self.is_ready = False
        self.last_update = 0

    def load_brain(self):
        try:
            if os.path.exists(TRACKER_STATE_PATH):
                with open(TRACKER_STATE_PATH, 'rb') as f:
                    state = pickle.load(f)
                    self.rooms = state.get('rooms', [])
                    self.adj_matrix = state.get('matrix', None)
                    self.particles = state.get('particles', None)
                    self.weights = state.get('weights', None)
                    self.monitored_mask = state.get('monitored_mask', None)

                    if self.particles is not None and len(self.rooms) > 0:
                        self.is_ready = True
                        if len(self.particles) != self.num_particles:
                             self._initialize_particles()
            return True
        except Exception as e:
            return False

    def save_brain(self):
        try:
            state = {
                'rooms': self.rooms,
                'matrix': self.adj_matrix,
                'particles': self.particles,
                'weights': self.weights,
                'monitored_mask': self.monitored_mask
            }
            with open(TRACKER_STATE_PATH, 'wb') as f:
                pickle.dump(state, f)
        except:
            pass

    def _initialize_particles(self):
        if not self.rooms:
            return
        num_rooms = len(self.rooms)
        self.particles = np.random.choice(num_rooms, self.num_particles)
        self.weights = np.ones(self.num_particles) / self.num_particles
        self.is_ready = True

    def set_topology(self, rooms, matrix_raw, monitored_rooms=[]):
        self.rooms = rooms
        self.adj_matrix = np.array(matrix_raw, dtype=float)
        np.fill_diagonal(self.adj_matrix, 1.0)

        self.monitored_mask = np.zeros(len(rooms), dtype=bool)
        for r in monitored_rooms:
            if r in rooms:
                idx = rooms.index(r)
                self.monitored_mask[idx] = True

        if self.particles is None or len(self.rooms) != len(rooms):
            self._initialize_particles()

        self.is_ready = True
        self.last_update = time.time()
        self.save_brain()

    def _resample(self):
        positions = (np.arange(self.num_particles) + np.random.random()) / self.num_particles
        indexes = np.zeros(self.num_particles, 'i')
        cumulative_sum = np.cumsum(self.weights)
        i, j = 0, 0
        while i < self.num_particles:
            if positions[i] < cumulative_sum[j]:
                indexes[i] = j
                i += 1
            else:
                j += 1
        self.particles = self.particles[indexes]
        self.weights.fill(1.0 / self.num_particles)

    def update(self, event_room_name, delta_t=0.0):
        if not self.is_ready or self.adj_matrix is None:
            return {}

        num_rooms = len(self.rooms)

        # --- 1. PREDICTION (Diffusion) ---
        if delta_t > 0:
            # Virtuelle Schritte (Diffusions-Geschwindigkeit)
            steps = max(1, int(delta_t / 2.0))

            for _ in range(steps):
                # 20% der Partikel bewegen sich pro Schritt
                move_mask = np.random.random(self.num_particles) < 0.2
                affected_indices = np.where(move_mask)[0]

                for idx in affected_indices:
                    current_room_idx = self.particles[idx]
                    neighbors = np.where(self.adj_matrix[current_room_idx] > 0)[0]
                    if len(neighbors) > 0:
                        self.particles[idx] = np.random.choice(neighbors)

            # --- NEGATIVE INFORMATION PENALTY (Sanftes Vergessen) ---
            if self.monitored_mask is not None:
                silent_mask = self.monitored_mask.copy()

                # Wenn gerade ein Event in einem Raum ist, ist er NICHT leise
                if event_room_name and event_room_name in self.rooms:
                    active_idx = self.rooms.index(event_room_name)
                    silent_mask[active_idx] = False

                # Finde Partikel in "leisen aber überwachten" Räumen
                particles_in_silent_monitored_rooms = silent_mask[self.particles]

                # FIX v0.18.6: Faktor entschärft! (0.05 -> 0.95)
                # Das verhindert, dass die Wahrscheinlichkeit sofort auf 0 fällt.
                self.weights[particles_in_silent_monitored_rooms] *= 0.95

        # --- 2. UPDATE (Correction) ---
        if event_room_name and event_room_name in self.rooms:
            # POSITIVE INFORMATION (Sensor hat gefeuert)
            target_idx = self.rooms.index(event_room_name)
            is_target = (self.particles == target_idx)

            # Starker Bonus für den aktiven Raum
            self.weights[is_target] *= 50.0
            self.weights[~is_target] *= 0.02

        else:
            pass

        # Normalisierung
        weight_sum = np.sum(self.weights)
        if weight_sum > 0:
            self.weights /= weight_sum
        else:
            self.weights.fill(1.0 / self.num_particles)

        # --- 3. RESAMPLE ---
        neff = 1.0 / np.sum(np.square(self.weights))
        if neff < self.num_particles / 2.0:
            self._resample()

        # --- 4. STATE ESTIMATION ---
        room_counts = np.bincount(self.particles, minlength=num_rooms)
        probabilities = room_counts / self.num_particles

        result = {}
        for i, prob in enumerate(probabilities):
            if prob > 0.01:
                result[self.rooms[i]] = float(round(prob, 3))

        sorted_result = dict(sorted(result.items(), key=lambda item: item[1], reverse=True))

        if time.time() - self.last_update > 60:
            self.save_brain()
            self.last_update = time.time()

        return sorted_result