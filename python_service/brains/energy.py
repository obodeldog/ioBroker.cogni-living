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
                if len(group) < 10: continue
                group = group.sort_values('ts')
                group['dt_h'] = group['ts'].diff().dt.total_seconds() / 3600.0
                group['d_temp'] = group['t_in'].diff()
                group['gradient'] = group['d_temp'] / group['dt_h']

                valid = group[(group['gradient'] > -5) & (group['gradient'] < 5) & (group['dt_h'] > 0.1)].copy()
                if len(valid) < 5: continue

                if has_valves:
                    cooling_phase = valid[valid['valve'] < 5]
                    heating_phase = valid[valid['valve'] > 20]
                else:
                    cooling_phase = valid
                    heating_phase = valid

                # Cooling (Verlust)
                cooling_events = cooling_phase[cooling_phase['gradient'] < -0.05]
                if len(cooling_events) > 5:
                    results_insu[room] = float(cooling_events['gradient'].median())

                # Heating (Power) - muss positiv sein
                heating_events = heating_phase[heating_phase['gradient'] > 0.1]
                if len(heating_events) > 5:
                    results_heat[room] = float(heating_events['gradient'].median())

            self.scores = results_insu
            self.heating = results_heat
            with open(ENERGY_MODEL_PATH, 'wb') as f:
                pickle.dump({'scores': self.scores, 'heating': self.heating}, f)

            self.is_ready = True
            return True, json.dumps({'insulation': self.scores, 'heating': self.heating})
        except Exception as e: return False, str(e)

    def predict_cooling(self, current_temps, t_out):
        if not self.is_ready: return {}
        forecasts = {}
        for room, t_in in current_temps.items():
            k = self.scores.get(room, -0.2)
            rate = k
            # Physik-Check
            if t_in > t_out and rate > 0: rate = -0.1
            if t_in < t_out and rate < 0: rate = 0.1
            forecasts[room] = { "1h": round(t_in + rate, 1), "4h": round(t_in + (rate * 4), 1) }
        return forecasts

    # --- MPC UPGRADE v0.16.3: Forecast Aware ---
    def get_optimization_advice(self, current_temps, t_out, targets=None, t_forecast=None):
        """
        Berechnet Coasting Time.
        t_forecast: Die vorhergesagte Außentemperatur in 1-2h.
        """
        if not self.is_ready: return []
        if targets is None: targets = {}

        # Wenn wir keinen Forecast haben, nehmen wir die aktuelle Temperatur (konservativ)
        # Wenn Forecast da ist, nutzen wir den Mittelwert aus Jetzt und Später für die Simulation
        effective_t_out = t_out
        if t_forecast is not None:
            effective_t_out = (t_out + t_forecast) / 2

        proposals = []

        for room, t_in in current_temps.items():
            t_target = targets.get(room, 21.0)

            # Nur wenn wir wärmer als Ziel sind
            if t_in <= t_target: continue

            # Verlustrate (Score) gilt für Delta T = 1 Kelvin (vereinfacht)
            # Wir müssen skalieren: Verlust ist höher, wenn es draußen kälter ist.
            # dT/dt = k * (T_in - T_out)
            # Unser 'k' im Model ist bereits dT/dt für den Durchschnitt.
            # Wir verfeinern das:

            base_k = self.scores.get(room, -0.5)
            if base_k >= 0: base_k = -0.5 # Safety

            # Simulation: Wie verhält sich der Raum JETZT bei effective_t_out?
            # Wir nehmen an, base_k wurde bei ca. 10 Grad Delta gelernt.
            # Scaling Factor (Physik-Näherung)
            current_delta = t_in - effective_t_out
            if current_delta < 1: current_delta = 1 # Vermeide Division/Logic Fehler im Sommer

            # Dynamische Verlustrate für die aktuelle Situation
            # Wenn Delta riesig (Winter), verlieren wir schneller.
            # Wir nehmen base_k als Referenz (z.B. bei Delta 15)
            # estimated_loss = base_k * (current_delta / 15.0)
            # Einfacher: Wir nutzen base_k direkt, da es der Median aller Messungen ist.

            loss_per_hour = abs(base_k)

            # Buffer berechnen
            buffer = t_in - t_target
            hours_left = buffer / loss_per_hour
            minutes_left = int(hours_left * 60)

            # Forecast Bonus: Wenn es draußen wärmer wird als jetzt, hält es länger
            if t_forecast is not None and t_forecast > t_out:
                minutes_left += int((t_forecast - t_out) * 10) # Bonus Minuten

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