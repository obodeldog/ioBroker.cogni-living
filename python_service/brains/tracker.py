import numpy as np
import os
import pickle
import time
import json

# PFAD-LOGIK (Konsistent mit energy.py/security.py)
# Wir navigieren vom brains-Ordner zwei Ebenen hoch zum Adapter-Root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Wir speichern den State im persistenten ioBroker-Data Ordner, um Reboots zu überleben
# Pfad: /opt/iobroker/iobroker-data/cogni-living/tracker_state.pkl
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(BASE_DIR)), 'iobroker-data', 'cogni-living')

# Fallback, falls der Ordner nicht existiert oder keine Rechte da sind
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
        self.adj_matrix = None    # Numpy Array (N x N) - Adjazenzmatrix
        self.particles = None     # Array der Länge N (speichert Raum-Indizes der Partikel)
        self.weights = None       # Array der Länge N (Gewicht jedes Partikels)
        self.is_ready = False
        self.last_update = 0

    def load_brain(self):
        """Lädt den letzten bekannten Zustand (Position der Personen)"""
        try:
            if os.path.exists(TRACKER_STATE_PATH):
                with open(TRACKER_STATE_PATH, 'rb') as f:
                    state = pickle.load(f)
                    self.rooms = state.get('rooms', [])
                    self.adj_matrix = state.get('matrix', None)
                    self.particles = state.get('particles', None)
                    self.weights = state.get('weights', None)

                    # Wenn wir Partikel haben, sind wir bereit
                    if self.particles is not None and len(self.rooms) > 0:
                        self.is_ready = True
                        # Safety check für Dimensionen
                        if len(self.particles) != self.num_particles:
                             self._initialize_particles()
            return True
        except Exception as e:
            return False

    def save_brain(self):
        """Persistiert den Zustand (damit wir nach Neustart wissen, wo du warst)"""
        try:
            state = {
                'rooms': self.rooms,
                'matrix': self.adj_matrix,
                'particles': self.particles,
                'weights': self.weights
            }
            with open(TRACKER_STATE_PATH, 'wb') as f:
                pickle.dump(state, f)
        except:
            pass

    def _initialize_particles(self):
        """Verteilt Partikel gleichmäßig (Global Localization / Kidnapped Robot)"""
        if not self.rooms:
            return
        num_rooms = len(self.rooms)
        self.particles = np.random.choice(num_rooms, self.num_particles)
        self.weights = np.ones(self.num_particles) / self.num_particles
        self.is_ready = True

    def set_topology(self, rooms, matrix_raw):
        """
        Initialisiert die Weltkarte.
        rooms: Liste der Raumnamen ['Flur', 'Bad', ...]
        matrix_raw: 2D Array (Adjazenz) aus der GraphEngine
        """
        self.rooms = rooms
        self.adj_matrix = np.array(matrix_raw, dtype=float)

        # Diagonale auf 1 setzen (Man kann im Raum bleiben)
        np.fill_diagonal(self.adj_matrix, 1.0)

        # Wenn sich die Raumzahl geändert hat oder noch keine Partikel da sind -> Reset
        if self.particles is None or len(self.rooms) != len(rooms):
            self._initialize_particles()

        self.is_ready = True
        self.last_update = time.time()
        self.save_brain()

    def _resample(self):
        """
        Survival of the fittest: Partikel mit hohem Gewicht vermehren sich.
        Systematic Resampling Algorithmus für O(N) Performance.
        """
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
        self.weights.fill(1.0 / self.num_particles) # Reset Gewichte nach Resampling

    def update(self, event_room_name, delta_t=0.0):
        """
        Der Kern-Algorithmus (Stone Soup).
        event_room_name: Name des Raums, in dem Bewegung war (oder None für 'Stille')
        delta_t: Zeit seit letztem Update in Sekunden
        """
        if not self.is_ready or self.adj_matrix is None:
            return {}

        num_rooms = len(self.rooms)

        # --- 1. PREDICTION (Diffusion / Random Walk) ---
        # Partikel bewegen sich basierend auf der Adjazenz-Matrix.
        # Je mehr Zeit (delta_t) vergeht, desto weiter können sie diffundieren.

        if delta_t > 0:
            # Wir machen nur Schritte, wenn signifikant Zeit vergangen ist
            # Heuristik: Alle 2 Sekunden ein virtueller Schritt im Graphen
            steps = max(1, int(delta_t / 2.0))

            for _ in range(steps):
                # Wir wechseln mit 20% Wahrscheinlichkeit in einen Nachbarraum (Rauschen)
                # Nur 20% der Partikel bewegen sich pro Schritt, um Trägheit zu simulieren
                move_mask = np.random.random(self.num_particles) < 0.2
                affected_indices = np.where(move_mask)[0]

                # Für die betroffenen Partikel einen neuen Raum würfeln
                for idx in affected_indices:
                    current_room_idx = self.particles[idx]
                    # Finde Nachbarn (wo Matrix > 0)
                    neighbors = np.where(self.adj_matrix[current_room_idx] > 0)[0]
                    if len(neighbors) > 0:
                        self.particles[idx] = np.random.choice(neighbors)

        # --- 2. UPDATE (Correction / Measurement) ---

        if event_room_name and event_room_name in self.rooms:
            # A. POSITIVE INFORMATION (Bewegungssensor feuert)
            target_idx = self.rooms.index(event_room_name)

            # Boolesche Masken
            is_target = (self.particles == target_idx)

            # Gewichtung:
            # Partikel im Sensor-Raum bekommen massiven Bonus (Faktor 50)
            # Partikel anderswo werden bestraft (Faktor 0.02)
            # Dies zwingt die Wolke schnell in den neuen Raum
            self.weights[is_target] *= 50.0
            self.weights[~is_target] *= 0.02

        else:
            # B. NEGATIVE INFORMATION (Stille / Sensor Clear)
            # Das ist das "Stone Soup" Feature.
            # Im Moment verlassen wir uns auf die Topologie:
            # Wenn du im Wohnzimmer bist und der Flur-Sensor NICHT feuert,
            # können die Partikel das Wohnzimmer physikalisch nicht verlassen
            # (da der Weg durch den Flur führen würde, was unwahrscheinlich ist, wenn dort Stille herrscht).
            # Wir lassen hier vorerst nur die Diffusion wirken.
            pass

        # Normalisierung der Gewichte (Summe muss 1 sein)
        weight_sum = np.sum(self.weights)
        if weight_sum > 0:
            self.weights /= weight_sum
        else:
            # Fallback bei numerischem Underflow: Reset weights
            self.weights.fill(1.0 / self.num_particles)

        # --- 3. RESAMPLE ---
        # Wenn die effektive Partikelzahl zu gering ist (Degenerierung), resamplen
        neff = 1.0 / np.sum(np.square(self.weights))
        if neff < self.num_particles / 2.0:
            self._resample()

        # --- 4. STATE ESTIMATION (Ergebnis berechnen) ---
        room_counts = np.bincount(self.particles, minlength=num_rooms)
        probabilities = room_counts / self.num_particles

        result = {}
        for i, prob in enumerate(probabilities):
            # Rauschfilter: Nur Wahrscheinlichkeiten > 1% melden
            if prob > 0.01:
                result[self.rooms[i]] = float(round(prob, 3))

        # Sortieren nach Wahrscheinlichkeit (höchste zuerst)
        sorted_result = dict(sorted(result.items(), key=lambda item: item[1], reverse=True))

        # Persistieren (nur alle 60s, um SD-Karte zu schonen)
        if time.time() - self.last_update > 60:
            self.save_brain()
            self.last_update = time.time()

        return sorted_result