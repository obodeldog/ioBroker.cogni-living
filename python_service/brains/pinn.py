import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import os
import pickle

# Dr.-Ing. Update: PERSISTENTE SPEICHERUNG
# Wir speichern das Modell nicht mehr im Adapter-Ordner (der bei Updates gelöscht wird),
# sondern im sicheren ioBroker-Data Verzeichnis.

# Pfad zum Adapter-Root
ADAPTER_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Pfad zum sicheren Daten-Verzeichnis (/opt/iobroker/iobroker-data/cogni-living)
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(ADAPTER_DIR)), 'iobroker-data', 'cogni-living')

# Falls der Ordner nicht existiert, erstellen wir ihn
if not os.path.exists(DATA_DIR):
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
    except:
        # Fallback, falls Berechtigungen fehlen: Zurück ins Temp-Verzeichnis
        DATA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MODEL_PATH = os.path.join(DATA_DIR, "pinn_model.pth")
SCALER_PATH = os.path.join(DATA_DIR, "pinn_scaler.pkl")

class PINN(nn.Module):
    def __init__(self):
        super(PINN, self).__init__()
        self.fc1 = nn.Linear(4, 16)
        self.fc2 = nn.Linear(16, 16)
        self.fc3 = nn.Linear(16, 1)
        self.act = nn.Tanh()

    def forward(self, x):
        x = self.act(self.fc1(x))
        x = self.act(self.fc2(x))
        return self.fc3(x)

class LightweightPINN:
    def __init__(self):
        self.model = PINN()
        self.optimizer = optim.Adam(self.model.parameters(), lr=0.005)
        self.is_ready = False

        self.scalers = {
            'mean': np.array([20.0, 10.0, 50.0, 0.5]),
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
        safe_std = np.maximum(self.scalers['std'], 1.0)
        return (X - self.scalers['mean']) / safe_std

    def train(self, data_points):
        if not data_points: return False, "No Data"

        X_list = []
        y_list = []

        for d in data_points:
            if np.isnan(d['t_in']) or np.isnan(d['delta_t']): continue
            val = d['t_in']
            out = d['t_out']
            vlv = d.get('valve', 0)
            sol = 1.0 if d.get('solar') else 0.0
            target = d['delta_t']

            if abs(target) > 10.0: continue

            X_list.append([val, out, vlv, sol])
            y_list.append([target])

        if len(X_list) < 10: return False, "Not enough clean data"

        X = np.array(X_list, dtype=np.float32)
        y = np.array(y_list, dtype=np.float32)

        self.scalers['mean'] = X.mean(axis=0)
        self.scalers['std'] = X.std(axis=0)

        try:
            with open(SCALER_PATH, 'wb') as f:
                pickle.dump(self.scalers, f)
        except Exception as e:
            return False, f"Save Error (Perms?): {str(e)}"

        X_norm = self._normalize(X)
        inputs = torch.tensor(X_norm)
        targets = torch.tensor(y)

        self.model.train()
        criterion = nn.MSELoss()

        final_loss = 999.0

        for epoch in range(200):
            self.optimizer.zero_grad()
            outputs = self.model(inputs)
            loss = criterion(outputs, targets)

            if torch.isnan(loss):
                return False, "Loss is NaN"

            loss.backward()
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
            self.optimizer.step()
            final_loss = loss.item()

        torch.save(self.model.state_dict(), MODEL_PATH)
        self.is_ready = True
        return True, f"Training success. Final Loss: {final_loss:.4f}"

    def predict(self, t_in, t_out, valve=0.0, solar=False):
        if not self.is_ready: return 0.0
        try:
            X = np.array([[t_in, t_out, valve, 1.0 if solar else 0.0]], dtype=np.float32)
            X_norm = self._normalize(X)
            with torch.no_grad():
                pred = self.model(torch.tensor(X_norm))
            val = float(pred.item())
            if val < -5.0: val = -5.0
            if val > 5.0: val = 5.0
            return val
        except:
            return 0.0