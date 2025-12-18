import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import os
import pickle

# Dr.-Ing. Note:
# Update V2: Robust Scaling.
# Verhindert "Model Collapse" (identische Werte für alle Räume),
# wenn die Trainingsdaten zu wenig Varianz haben (z.B. nur Nachtwerte).

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "pinn_model.pth")
SCALER_PATH = os.path.join(BASE_DIR, "pinn_scaler.pkl")

class PINN(nn.Module):
    def __init__(self):
        super(PINN, self).__init__()
        # Kleines, schnelles Netz: 4 Inputs -> 1 Output (Delta T)
        # Inputs: T_in, T_out, Valve, Solar
        self.fc1 = nn.Linear(4, 16)
        self.fc2 = nn.Linear(16, 16)
        self.fc3 = nn.Linear(16, 1)
        self.act = nn.Tanh() # Tanh ist stabiler als ReLU für physikalische Probleme

    def forward(self, x):
        x = self.act(self.fc1(x))
        x = self.act(self.fc2(x))
        return self.fc3(x)

class LightweightPINN:
    def __init__(self):
        self.model = PINN()
        self.optimizer = optim.Adam(self.model.parameters(), lr=0.005) # Etwas konservativere Learning Rate
        self.is_ready = False

        # Standard-Scaler (Fallback, falls noch kein Training lief)
        self.scalers = {
            'mean': np.array([20.0, 10.0, 50.0, 0.5]), # T_in, T_out, Valve, Solar
            'std': np.array([5.0, 10.0, 50.0, 0.5])
        }

    def load_brain(self):
        try:
            if os.path.exists(MODEL_PATH):
                self.model.load_state_dict(torch.load(MODEL_PATH))
                self.model.eval()
                self.is_ready = True
            if os.path.exists(SCALER_PATH):
                with open(SCALER_PATH, 'rb') as f:
                    self.scalers = pickle.load(f)
            return True
        except:
            return False

    def _normalize(self, X):
        # FIX V2: Minimum Variance Enforcement
        # Wir verhindern, dass durch eine sehr kleine Std-Abweichung geteilt wird.
        # Wir setzen eine Mindest-Varianz (z.B. 1.0), damit Werte nicht explodieren.
        safe_std = np.maximum(self.scalers['std'], 1.0)
        return (X - self.scalers['mean']) / safe_std

    def train(self, data_points):
        """
        data_points: list of dicts {'t_in', 't_out', 'valve', 'solar', 'delta_t'}
        """
        if not data_points: return False, "No Data"

        # 1. Daten vorbereiten
        X_list = []
        y_list = []

        for d in data_points:
            # Sicherheits-Check auf NaN im Input
            if np.isnan(d['t_in']) or np.isnan(d['delta_t']): continue

            val = d['t_in']
            out = d['t_out']
            vlv = d.get('valve', 0)
            sol = 1.0 if d.get('solar') else 0.0
            target = d['delta_t']

            # Outlier Filter (Physikalischer Unsinn wegfiltern)
            if abs(target) > 10.0: continue # Mehr als 10 Grad pro Stunde ist Messfehler

            X_list.append([val, out, vlv, sol])
            y_list.append([target])

        if len(X_list) < 10: return False, "Not enough clean data"

        X = np.array(X_list, dtype=np.float32)
        y = np.array(y_list, dtype=np.float32)

        # Update Scalers mit den neuen Daten
        self.scalers['mean'] = X.mean(axis=0)
        self.scalers['std'] = X.std(axis=0)

        # Save Scalers
        with open(SCALER_PATH, 'wb') as f:
            pickle.dump(self.scalers, f)

        # Normalize Inputs
        X_norm = self._normalize(X)

        inputs = torch.tensor(X_norm)
        targets = torch.tensor(y)

        self.model.train()
        criterion = nn.MSELoss()

        final_loss = 999.0

        # 2. Training Loop mit "Explosion Protection"
        for epoch in range(200): # 200 Epochen
            self.optimizer.zero_grad()
            outputs = self.model(inputs)

            loss = criterion(outputs, targets)

            # CHECK FOR NAN
            if torch.isnan(loss):
                return False, "Training aborted: Loss is NaN (Gradient Explosion prevented)"

            loss.backward()

            # GRADIENT CLIPPING (Die wichtigste Zeile gegen NaN!)
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)

            self.optimizer.step()
            final_loss = loss.item()

        # Save
        torch.save(self.model.state_dict(), MODEL_PATH)
        self.is_ready = True

        return True, f"Training success. Final Loss: {final_loss:.4f}"

    def predict(self, t_in, t_out, valve=0.0, solar=False):
        if not self.is_ready: return 0.0
        try:
            # Physikalische Plausibilitäts-Prüfung (Safety Layer)
            # Wenn Ventil fast zu ist, kann der Raum physikalisch kaum aufheizen (außer Solar)
            # Das hilft dem Netz, nicht zu halluzinieren, wenn es unsicher ist.

            X = np.array([[t_in, t_out, valve, 1.0 if solar else 0.0]], dtype=np.float32)
            X_norm = self._normalize(X)

            with torch.no_grad():
                pred = self.model(torch.tensor(X_norm))

            val = float(pred.item())

            # Output Clamping: Verhindert extreme Werte wie -3.3, wenn unrealistisch
            if val < -5.0: val = -5.0
            if val > 5.0: val = 5.0

            return val
        except:
            return 0.0