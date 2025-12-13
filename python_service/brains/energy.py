import os
import pickle
import pandas as pd
import numpy as np
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENERGY_MODEL_PATH = os.path.join(BASE_DIR, "energy_model.pkl")

class EnergyBrain:
    def __init__(self):
        self.scores = {}; self.heating = {}; self.is_ready = False

    def load_brain(self):
        try:
            if os.path.exists(ENERGY_MODEL_PATH):
                with open(ENERGY_MODEL_PATH, 'rb') as f:
                    data = pickle.load(f)
                    self.scores = data.get('scores', {})
                    self.heating = data.get('heating', {})
                self.is_ready = True
            return True
        except: return False

    def train(self, points):
        try:
            if not points: return False, "No Data"
            df = pd.DataFrame(points)
            if 'ts' in df.columns: df['ts'] = pd.to_datetime(df['ts'], unit='ms')
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
                cooling = valid[valid['gradient'] < -0.05]
                if len(cooling) > 5: results_insu[room] = float(cooling['gradient'].median())
                heating = valid[valid['gradient'] > 0.1]
                if len(heating) > 5: results_heat[room] = float(heating['gradient'].median())
            self.scores = results_insu
            self.heating = results_heat
            with open(ENERGY_MODEL_PATH, 'wb') as f: pickle.dump({'scores': self.scores, 'heating': self.heating}, f)
            self.is_ready = True
            return True, json.dumps({'insulation': self.scores, 'heating': self.heating})
        except Exception as e: return False, str(e)

    def predict_cooling(self, current_temps, t_out):
        if not self.is_ready: return {}
        forecasts = {}
        for room, t_in in current_temps.items():
            k = self.scores.get(room, -0.2)
            rate = k
            if t_in > t_out and rate > 0: rate = -0.1
            if t_in < t_out and rate < 0: rate = 0.1
            forecasts[room] = { "1h": round(t_in + rate, 1), "4h": round(t_in + (rate * 4), 1) }
        return forecasts