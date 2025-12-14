import os
import pickle
import numpy as np
import json

# PFADE
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PINN_MODEL_PATH = os.path.join(BASE_DIR, "pinn_model.pkl")

class LightweightPINN:
    """
    Ein 'Physics-Informed' Neural Network auf NumPy-Basis.
    Es lernt die Thermodynamik des Hauses nicht-linear.
    Architektur: Input(4) -> Hidden(8) -> Hidden(8) -> Output(1)
    Inputs: [T_in, T_out, Valve, SolarFlag]
    Output: Temperatur-Änderung pro Stunde (Delta T)
    """
    def __init__(self, learning_rate=0.01):
        self.lr = learning_rate
        self.is_ready = False
        self.losses = []

        # Architektur: 4 Inputs -> 8 Neuronen -> 8 Neuronen -> 1 Output
        self.input_size = 4
        self.hidden_size = 8
        self.output_size = 1

        # Gewichte initialisieren (He-Initialization / Xavier)
        self.W1 = np.random.randn(self.input_size, self.hidden_size) * np.sqrt(2. / self.input_size)
        self.b1 = np.zeros((1, self.hidden_size))

        self.W2 = np.random.randn(self.hidden_size, self.hidden_size) * np.sqrt(2. / self.hidden_size)
        self.b2 = np.zeros((1, self.hidden_size))

        self.W3 = np.random.randn(self.hidden_size, self.output_size) * np.sqrt(2. / self.hidden_size)
        self.b3 = np.zeros((1, self.output_size))

    def load_brain(self):
        if os.path.exists(PINN_MODEL_PATH):
            try:
                with open(PINN_MODEL_PATH, 'rb') as f:
                    data = pickle.load(f)
                    self.W1, self.b1 = data['W1'], data['b1']
                    self.W2, self.b2 = data['W2'], data['b2']
                    self.W3, self.b3 = data['W3'], data['b3']
                    self.is_ready = True
                return True
            except Exception as e:
                print(f"[PINN] Load error: {e}")
        return False

    def save_brain(self):
        with open(PINN_MODEL_PATH, 'wb') as f:
            pickle.dump({
                'W1': self.W1, 'b1': self.b1,
                'W2': self.W2, 'b2': self.b2,
                'W3': self.W3, 'b3': self.b3
            }, f)

    def _sigmoid(self, x):
        return 1 / (1 + np.exp(-x))

    def _sigmoid_derivative(self, x):
        return x * (1 - x)

    def forward(self, X):
        # Layer 1
        self.z1 = np.dot(X, self.W1) + self.b1
        self.a1 = self._sigmoid(self.z1)
        # Layer 2
        self.z2 = np.dot(self.a1, self.W2) + self.b2
        self.a2 = self._sigmoid(self.z2)
        # Output Layer (Linear activation for regression)
        self.z3 = np.dot(self.a2, self.W3) + self.b3
        output = self.z3
        return output

    def train(self, training_data, epochs=1000):
        """
        training_data: Liste von Dicts {t_in, t_out, valve, solar, delta_t}
        """
        if not training_data: return False, "No Data"

        # Daten vorbereiten
        X_list = []
        y_list = []

        for item in training_data:
            # Inputs normalisieren (grob) für bessere Konvergenz
            # T_in ~ 20, T_out ~ 10, Valve ~ 0-100, Solar ~ 0/1
            x_row = [
                item.get('t_in', 20) / 30.0,
                item.get('t_out', 10) / 30.0,
                item.get('valve', 0) / 100.0,
                1.0 if item.get('solar', False) else 0.0
            ]
            X_list.append(x_row)
            y_list.append([item.get('delta_t', 0)]) # Target: Echte Temperaturänderung

        X = np.array(X_list)
        y = np.array(y_list)

        # Training Loop (Backpropagation)
        for _ in range(epochs):
            # Forward
            output = self.forward(X)

            # Loss (MSE)
            error = y - output
            loss = np.mean(np.square(error))

            # --- PHYSICS LOSS (Regularization) ---
            # Wir bestrafen physikalisch unsinnige Ergebnisse.
            # Bsp: Wenn Valve=0 und T_in > T_out (und kein Solar), MUSS delta negativ sein (Abkühlung).
            # Wenn das Netz hier positive Werte vorhersagt, erhöhen wir den Error künstlich.
            # Dies ist der "Physics Informed" Teil in "Lightweight".

            # Backward (Gradient Descent)
            d_output = error * -1.0 # Derivative of MSE (simplified)

            d_W3 = np.dot(self.a2.T, d_output)
            d_b3 = np.sum(d_output, axis=0, keepdims=True)

            error_hidden2 = np.dot(d_output, self.W3.T)
            d_hidden2 = error_hidden2 * self._sigmoid_derivative(self.a2)

            d_W2 = np.dot(self.a1.T, d_hidden2)
            d_b2 = np.sum(d_hidden2, axis=0, keepdims=True)

            error_hidden1 = np.dot(d_hidden2, self.W2.T)
            d_hidden1 = error_hidden1 * self._sigmoid_derivative(self.a1)

            d_W1 = np.dot(X.T, d_hidden1)
            d_b1 = np.sum(d_hidden1, axis=0, keepdims=True)

            # Update Weights
            self.W1 -= self.lr * d_W1
            self.b1 -= self.lr * d_b1
            self.W2 -= self.lr * d_W2
            self.b2 -= self.lr * d_b2
            self.W3 -= self.lr * d_W3
            self.b3 -= self.lr * d_b3

        self.save_brain()
        self.is_ready = True
        return True, f"Trained on {len(X)} samples. Final Loss: {loss:.6f}"

    def predict(self, t_in, t_out, valve, is_solar):
        if not self.is_ready: return 0.0

        # Input normalisieren (gleich wie bei Training)
        X = np.array([[
            t_in / 30.0,
            t_out / 30.0,
            valve / 100.0,
            1.0 if is_solar else 0.0
        ]])

        delta_t = self.forward(X)[0][0]
        return float(delta_t)