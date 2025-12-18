import os
import pickle
import pandas as pd
import numpy as np
import json
import math
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENERGY_MODEL_PATH = os.path.join(BASE_DIR, "energy_model.pkl")

class EnergyBrain:
    def __init__(self):
        self.scores = {}
        self.heating = {}
        self.is_ready = False
        self.last_state = {}

    def load_brain(self):
        try:
            if os.path.exists(ENERGY_MODEL_PATH):
                with open(ENERGY_MODEL_PATH, 'rb') as f:
                    data = pickle.load(f)
                    self.scores = data.get('scores', {})
                    self.heating = data.get('heating', {})
                self.is_ready = True
            return True
        except:
            return False

    def train(self, points):
        try:
            if not points: return False, "No Data"
            df = pd.DataFrame(points)
            if 'ts' in df.columns: df['ts'] = pd.to_datetime(df['ts'], unit='ms')

            has_valves = 'valve' in df.columns
            results_insu = {}
            results_heat = {}

            # Wir gehen Raum für Raum durch
            for room, group in df.groupby('room'):
                # FIX: Schon ab 2 Datenpunkten rechnen (für schnelles Feedback)
                if len(group) < 2: continue

                group = group.sort_values('ts')
                group['dt_h'] = group['ts'].diff().dt.total_seconds() / 3600.0
                group['d_temp'] = group['t_in'].diff()

                # Nur Zeitabstände > 1 min betrachten (Rauschen filtern)
                valid = group[group['dt_h'] > 0.01].copy()
                if len(valid) < 1: continue

                valid['gradient'] = valid['d_temp'] / valid['dt_h']

                # RADIATOR FIX: Filter massiv erweitert!
                # Heizkörper können 20-30 Grad pro Stunde schaffen.
                # Wir erlauben [-10 (Lüften) bis +50 (Power-Heizen)]
                valid = valid[(valid['gradient'] > -15) & (valid['gradient'] < 50)]

                if has_valves:
                    # Cooling: Ventil muss zu sein (< 5%)
                    cooling_phase = valid[valid['valve'] < 5]

                    # Heating: Ventil offen (> 5%)
                    heating_phase = valid[valid['valve'] >= 5]
                else:
                    cooling_phase = valid
                    heating_phase = valid

                # --- 1. ISOLATION ---
                cooling_events = cooling_phase[cooling_phase['gradient'] < -0.01]
                if len(cooling_events) >= 1:
                    results_insu[room] = float(cooling_events['gradient'].median())

                # --- 2. POWER (Heizkörper) ---
                heating_events = heating_phase[heating_phase['gradient'] > 0.1]

                if len(heating_events) >= 1:
                    val = float(heating_events['gradient'].median())
                    if val > 0: results_heat[room] = val
                else:
                    # FALLBACK: Wenn keine Daten da sind, nehmen wir alte Werte
                    if room in self.heating:
                        results_heat[room] = self.heating[room]
                    else:
                        # Startwert für Heizkörper: 3.0 °C/h (Aggressiver als FBH)
                        results_heat[room] = 3.0

            # Speichern
            self.scores.update(results_insu)
            self.heating.update(results_heat)

            with open(ENERGY_MODEL_PATH, 'wb') as f:
                pickle.dump({'scores': self.scores, 'heating': self.heating}, f)

            self.is_ready = True
            return True, json.dumps({'insulation': self.scores, 'heating': self.heating})
        except Exception as e: return False, str(e)

    def _get_effective_temp(self, t_out, t_forecast):
        if t_forecast is None: return t_out
        return (t_out + t_forecast) / 2

    # --- VENTILATION DETECTIVE ---
    def check_ventilation(self, current_temps):
        alerts = []
        now = time.time()
        for room, t_now in current_temps.items():
            if room in self.last_state:
                last_entry = self.last_state[room]
                t_last = last_entry['val']
                ts_last = last_entry['ts']
                dt_hours = (now - ts_last) / 3600.0
                if dt_hours > 0.08: # > 5 min
                    d_temp = t_now - t_last
                    gradient = d_temp / dt_hours
                    # Heizkörper kühlen auch schneller ab beim Lüften
                    if gradient < -5.0:
                        alerts.append({
                            'room': room,
                            'gradient': round(gradient, 2),
                            'drop': round(d_temp, 1),
                            'msg': f"Starker Temperatursturz ({round(gradient,1)}°C/h). Fenster offen?"
                        })
            self.last_state[room] = {'ts': now, 'val': t_now}
        return alerts

    # --- SMART WARM-UP (Rückkehr-Rechner) ---
    def calculate_warmup_times(self, current_temps, target_temp_default=21.0):
        warmup_times = {}

        for room, t_in in current_temps.items():
            target = target_temp_default

            # WICHTIG: Wenn Ist >= Soll -> 0 Minuten
            if t_in >= target:
                warmup_times[room] = 0
                continue

            # Power holen (oder Fallback 3.0 für Heizkörper)
            power = self.heating.get(room, 3.0)
            if power <= 0.1: power = 1.0

            diff = target - t_in
            hours_needed = diff / power
            minutes_needed = int(hours_needed * 60)

            if minutes_needed > 720: minutes_needed = 720
            warmup_times[room] = minutes_needed

        return warmup_times

    # (Methoden predict_cooling und get_optimization_advice bleiben gleich...)
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
        for room, t_in in current_temps.items():
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