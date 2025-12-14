import os
import pickle
import pandas as pd
import numpy as np
import json
import math

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENERGY_MODEL_PATH = os.path.join(BASE_DIR, "energy_model.pkl")

class EnergyBrain:
    def __init__(self):
        self.scores = {}
        self.heating = {}
        self.is_ready = False

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

            for room, group in df.groupby('room'):
                # TWEAK: Min Samples reduziert von 10 auf 5 für schnelleres Feedback
                if len(group) < 5: continue
                group = group.sort_values('ts')
                group['dt_h'] = group['ts'].diff().dt.total_seconds() / 3600.0
                group['d_temp'] = group['t_in'].diff()
                group['gradient'] = group['d_temp'] / group['dt_h']

                valid = group[(group['gradient'] > -5) & (group['gradient'] < 5) & (group['dt_h'] > 0.1)].copy()
                if len(valid) < 3: continue

                if has_valves:
                    cooling_phase = valid[valid['valve'] < 5]
                    # TWEAK: Schwelle gesenkt von 20 auf 15, damit auch träge Heizungen zählen
                    heating_phase = valid[valid['valve'] > 15]
                else:
                    cooling_phase = valid
                    heating_phase = valid

                # Cooling (Verlust)
                cooling_events = cooling_phase[cooling_phase['gradient'] < -0.05]
                if len(cooling_events) > 3:
                    results_insu[room] = float(cooling_events['gradient'].median())

                # Heating (Power)
                # TWEAK: Auch hier Samples reduziert
                heating_events = heating_phase[heating_phase['gradient'] > 0.1]
                if len(heating_events) > 3:
                    results_heat[room] = float(heating_events['gradient'].median())

            self.scores = results_insu
            self.heating = results_heat
            with open(ENERGY_MODEL_PATH, 'wb') as f:
                pickle.dump({'scores': self.scores, 'heating': self.heating}, f)

            self.is_ready = True
            return True, json.dumps({'insulation': self.scores, 'heating': self.heating})
        except Exception as e: return False, str(e)

    def _get_effective_temp(self, t_out, t_forecast):
        if t_forecast is None: return t_out
        return (t_out + t_forecast) / 2

    def predict_cooling(self, current_temps, t_out, t_forecast=None, is_sunny=False, solar_flags=None):
        if not self.is_ready: return {}
        if solar_flags is None: solar_flags = {}

        t_eff = self._get_effective_temp(t_out, t_forecast)
        forecasts = {}
        for room, t_in in current_temps.items():
            k = self.scores.get(room, -0.2)
            rate = k

            if is_sunny and solar_flags.get(room, False):
                rate += 0.5

            if t_eff > t_in:
                if rate < 0: rate = abs(rate) * 0.5
            else:
                if rate > 0: pass

            t_1h = t_in + rate
            t_4h = t_in + (rate * 4)

            forecasts[room] = {
                "1h": round(t_1h, 1),
                "4h": round(t_4h, 1),
                "solar_bonus": is_sunny and solar_flags.get(room, False)
            }
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
                proposals.append({
                    "room": room,
                    "minutes_safe": minutes_left,
                    "target": t_target,
                    "current": t_in,
                    "savings_msg": f"Heizung kann {minutes_left} min ausbleiben."
                })

        proposals.sort(key=lambda x: x['minutes_safe'], reverse=True)
        return proposals