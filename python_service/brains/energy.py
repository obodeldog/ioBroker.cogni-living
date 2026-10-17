import os
import pickle
import pandas as pd
import numpy as np
import json
import math
import time
from datetime import datetime

# Dr.-Ing. Update: PERSISTENTE SPEICHERUNG & SANITY CHECKS (v0.18.27)
ADAPTER_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(ADAPTER_DIR)), 'iobroker-data', 'cogni-living')

if not os.path.exists(DATA_DIR):
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
    except:
        DATA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ENERGY_MODEL_PATH = os.path.join(DATA_DIR, "energy_model.pkl")

class EnergyBrain:
    def __init__(self):
        self.scores = {}
        self.heating = {}
        self.is_ready = False
        self.last_state = {}
        # RL: Feedback Loops - Stores { "Room_Hour": penalty_score }
        self.penalties = {}

    def load_brain(self):
        try:
            if os.path.exists(ENERGY_MODEL_PATH):
                with open(ENERGY_MODEL_PATH, 'rb') as f:
                    data = pickle.load(f)
                    self.scores = data.get('scores', {})
                    self.heating = data.get('heating', {})
                    self.penalties = data.get('penalties', {})
                self.is_ready = True
            return True
        except:
            return False

    def save_brain(self):
        try:
            with open(ENERGY_MODEL_PATH, 'wb') as f:
                pickle.dump({
                    'scores': self.scores,
                    'heating': self.heating,
                    'penalties': self.penalties
                }, f)
        except Exception as e: print(f"[ERROR] Save Brain: {e}")

    # --- RL-FEEDBACK MECHANISM ---
    def train_penalty(self, room):
        """
        Received negative reward (User manually overrode MPC).
        Learn that 'room' at 'current_hour' is sensitive.
        """
        try:
            now = datetime.now()
            hour = now.hour
            key = f"{room}_{hour}"
            self.penalties[key] = 1.0
            self.save_brain()
            return True, f"Penalty learned for {key}"
        except Exception as e:
            return False, str(e)

    def get_penalties(self):
        return self.penalties

    def train(self, points):
        try:
            if not points: return False, "No Data"
            df = pd.DataFrame(points)
            if 'ts' in df.columns: df['ts'] = pd.to_datetime(df['ts'], unit='ms')

            has_valves = 'valve' in df.columns
            results_insu = {}
            results_heat = {}

            for room, group in df.groupby('room'):
                if len(group) < 2: continue

                group = group.sort_values('ts')
                group['dt_h'] = group['ts'].diff().dt.total_seconds() / 3600.0
                group['d_temp'] = group['t_in'].diff()

                valid = group[group['dt_h'] > 0.01].copy()
                if len(valid) < 1: continue

                valid['gradient'] = valid['d_temp'] / valid['dt_h']

                # --- SANITY CHECK / PHYSICS CAP ---
                # Wir filtern unrealistische Extremwerte (Rebound/Fenster) VOR dem Training.
                # Heizen: Alles über +8.0 ist Rebound/Fehler.
                # Kühlen: Alles unter -2.5 ist offenes Fenster.
                valid = valid[(valid['gradient'] > -2.5) & (valid['gradient'] < 8.0)]
                # ----------------------------------

                if has_valves:
                    cooling_phase = valid[valid['valve'] < 5]
                    heating_phase = valid[valid['valve'] >= 5]
                else:
                    cooling_phase = valid
                    heating_phase = valid

                # Isolation
                cooling_events = cooling_phase[cooling_phase['gradient'] < -0.01]
                if len(cooling_events) >= 1:
                    results_insu[room] = float(cooling_events['gradient'].median())

                # Power (Heizkörper)
                heating_events = heating_phase[heating_phase['gradient'] > 0.1]
                if len(heating_events) >= 1:
                    val = float(heating_events['gradient'].median())
                    if val > 0: results_heat[room] = val
                else:
                    if room in self.heating:
                        results_heat[room] = self.heating[room]
                    else:
                        results_heat[room] = 3.0

            self.scores.update(results_insu)
            self.heating.update(results_heat)

            self.save_brain()

            self.is_ready = True
            return True, json.dumps({'insulation': self.scores, 'heating': self.heating})
        except Exception as e: return False, str(e)

    def _get_effective_temp(self, t_out, t_forecast):
        if t_forecast is None: return t_out
        return (t_out + t_forecast) / 2

    def check_ventilation(self, current_temps):
        alerts = []
        now = time.time()
        for room, t_now in current_temps.items():
            if room in self.last_state:
                last_entry = self.last_state[room]
                t_last = last_entry['val']
                ts_last = last_entry['ts']
                dt_hours = (now - ts_last) / 3600.0
                if dt_hours > 0.08:
                    d_temp = t_now - t_last
                    gradient = d_temp / dt_hours
                    # Hinweis: Der Ventilation Check sieht weiterhin die "echten" extremen Werte,
                    # um Alarm zu schlagen. Das Training sieht sie nicht mehr.
                    if gradient < -5.0:
                        alerts.append({
                            'room': room,
                            'gradient': round(gradient, 2),
                            'drop': round(d_temp, 1),
                            'msg': f"Starker Temperatursturz ({round(gradient,1)}°C/h). Fenster offen?"
                        })
            self.last_state[room] = {'ts': now, 'val': t_now}
        return alerts

    # --- HYBRID INTELLIGENCE UPDATE ---
    def calculate_warmup_times(self, current_temps, targets_config=None, pinn_brain=None, t_out=10.0, is_sunny=False, solar_flags=None):
        """
        Berechnet Zeit bis Zieltemperatur.
        Return: (final_times, sources, details_dict)
        """
        if targets_config is None: targets_config = {}
        if solar_flags is None: solar_flags = {}

        warmup_times = {}
        sources = {}
        details = {}

        default_target = targets_config.get("default", 21.0)

        for room, t_in in current_temps.items():
            target = targets_config.get(room, default_target)
            diff = target - t_in

            details[room] = { "phys": 0, "ai": None }

            if diff <= 0:
                warmup_times[room] = 0
                sources[room] = "TargetReached"
                continue

            # --- A. PHYSICS CALCULATION (Fallback) ---
            power_phys = self.heating.get(room, 3.0)
            if power_phys <= 0.1: power_phys = 1.0
            minutes_phys = int((diff / power_phys) * 60)
            if minutes_phys > 720: minutes_phys = 720

            final_minutes = minutes_phys
            final_source = "Physics"
            details[room]["phys"] = minutes_phys

            # --- B. PINN CALCULATION (AI) ---
            if pinn_brain and pinn_brain.is_ready:
                solar_active = is_sunny and solar_flags.get(room, False)
                predicted_rate = pinn_brain.predict(t_in, t_out, valve=100.0, solar=solar_active)

                if predicted_rate > 0.2 and predicted_rate < 10.0:
                    minutes_ai = int((diff / predicted_rate) * 60)
                    if minutes_ai > 720: minutes_ai = 720

                    details[room]["ai"] = minutes_ai

                    final_minutes = minutes_ai
                    final_source = "AI (PINN)"

            warmup_times[room] = final_minutes
            sources[room] = final_source

        return warmup_times, sources, details

    def predict_cooling(self, current_temps, t_out, t_forecast=None, is_sunny=False, solar_flags=None):
        if not self.is_ready: return {}
        if solar_flags is None: solar_flags = {}
        t_eff = self._get_effective_temp(t_out, t_forecast)
        forecasts = {}
        for room, t_in in current_temps.items():
            k = self.scores.get(room, -0.2)
            rate = k
            if is_sunny and solar_flags.get(room, False): rate += 0.5
            if t_eff > t_in:
                if rate < 0: rate = abs(rate) * 0.5
            t_1h = t_in + rate
            t_4h = t_in + (rate * 4)
            forecasts[room] = { "1h": round(t_1h, 1), "4h": round(t_4h, 1), "solar_bonus": is_sunny and solar_flags.get(room, False) }
        return forecasts

    def get_optimization_advice(self, current_temps, t_out, targets=None, t_forecast=None):
        if not self.is_ready: return []
        if targets is None: targets = {}
        t_eff = self._get_effective_temp(t_out, t_forecast)
        proposals = []

        current_hour = datetime.now().hour

        for room, t_in in current_temps.items():
            # --- RL CHECK ---
            penalty_key = f"{room}_{current_hour}"
            if self.penalties.get(penalty_key, 0) > 0.5:
                continue
            # ----------------

            t_target = targets.get(room, 21.0)
            if t_in <= t_target: continue
            base_k = self.scores.get(room, -0.5)
            if base_k >= 0: base_k = -0.5
            loss_per_hour = abs(base_k)
            buffer = t_in - t_target
            hours_left = buffer / loss_per_hour
            minutes_left = int(hours_left * 60)
            delta_now = t_in - t_out
            delta_eff = t_in - t_eff
            if delta_eff != 0 and delta_now != 0:
                factor = delta_now / delta_eff
                minutes_left = int(minutes_left * factor)
            if minutes_left > 15:
                if minutes_left > 240: minutes_left = 240
                proposals.append({ "room": room, "minutes_safe": minutes_left, "target": t_target, "current": t_in, "savings_msg": f"Heizung kann {minutes_left} min ausbleiben." })

        proposals.sort(key=lambda x: x['minutes_safe'], reverse=True)
        return proposals