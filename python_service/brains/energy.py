import os
import pickle
import pandas as pd
import numpy as np
import json

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
        """
        Trainiert das Thermodynamik-Modell.
        UPGRADE v0.16.1: Nutzt jetzt Ventil-Daten (falls vorhanden), um
        echte Isolations-Werte (Heizung AUS) von Heiz-Phasen zu trennen.
        """
        try:
            if not points:
                return False, "No Data"

            df = pd.DataFrame(points)

            # Timestamp Konvertierung
            if 'ts' in df.columns:
                df['ts'] = pd.to_datetime(df['ts'], unit='ms')

            # Prüfen, ob wir Ventil-Daten haben (Upgrade Check)
            has_valves = 'valve' in df.columns

            results_insu = {}
            results_heat = {}

            for room, group in df.groupby('room'):
                if len(group) < 10:
                    continue

                group = group.sort_values('ts')

                # Physik-Berechnung: Gradienten (dT/dt)
                group['dt_h'] = group['ts'].diff().dt.total_seconds() / 3600.0
                group['d_temp'] = group['t_in'].diff()
                group['gradient'] = group['d_temp'] / group['dt_h']

                # Filterung unmöglicher Sprünge (Messfehler)
                valid = group[(group['gradient'] > -5) & (group['gradient'] < 5) & (group['dt_h'] > 0.1)].copy()

                if len(valid) < 5:
                    continue

                # --- LOGIK UPGRADE: DATEN-TRENNUNG ---
                if has_valves:
                    # 1. Isolations-Check: Nur wenn Heizung AUS ist (Ventil < 5%)
                    # Denn wenn geheizt wird, können wir die Isolation nicht messen.
                    cooling_phase = valid[valid['valve'] < 5]

                    # 2. Heiz-Check: Nur wenn Heizung AN ist (Ventil > 20%)
                    heating_phase = valid[valid['valve'] > 20]
                else:
                    # Fallback für alte Daten ohne Ventil-Info
                    cooling_phase = valid
                    heating_phase = valid

                # A) Berechnung Isolation (Cooling)
                # Wir suchen negative Gradienten (Abkühlung)
                cooling_events = cooling_phase[cooling_phase['gradient'] < -0.05]
                if len(cooling_events) > 5:
                    # Median ist robuster gegen Ausreißer (z.B. Fenster kurz auf)
                    results_insu[room] = float(cooling_events['gradient'].median())

                # B) Berechnung Heiz-Power (Heating)
                # Wir suchen positive Gradienten (Aufwärmen)
                heating_events = heating_phase[heating_phase['gradient'] < -0.05] # Warte, heating muss positiv sein!
                # KORREKTUR: Heating muss > 0.1 sein
                heating_events = heating_phase[heating_phase['gradient'] > 0.1]

                if len(heating_events) > 5:
                    results_heat[room] = float(heating_events['gradient'].median())

            # Speichern der Ergebnisse
            self.scores = results_insu
            self.heating = results_heat

            with open(ENERGY_MODEL_PATH, 'wb') as f:
                pickle.dump({'scores': self.scores, 'heating': self.heating}, f)

            self.is_ready = True
            return True, json.dumps({'insulation': self.scores, 'heating': self.heating})

        except Exception as e:
            return False, str(e)

    def predict_cooling(self, current_temps, t_out):
        if not self.is_ready:
            return {}

        forecasts = {}
        for room, t_in in current_temps.items():
            # Hole den gelernten k-Wert (Verlustrate)
            k = self.scores.get(room, -0.2) # Default -0.2 (Gute Dämmung) als Fallback

            # Newtonsche Abkühlung (Vereinfacht): dT/dt = k * (T_in - T_out)
            # Da k bei uns schon der Gradient ist (z.B. -0.5), skalieren wir das leicht
            # Adaptiver Ansatz: Wenn es draußen sehr kalt ist, fällt Temp schneller.
            # Unser k ist der "Basis-Verlust".

            rate = k

            # Physik-Check: Wir können nur abkühlen, wenn T_in > T_out
            if t_in > t_out and rate > 0:
                rate = -0.1 # Fallback, falls k falsch gelernt wurde

            # Physik-Check: Wir wärmen uns auf, wenn T_in < T_out (Sommer)
            if t_in < t_out and rate < 0:
                rate = 0.1

            # Prognose
            forecasts[room] = {
                "1h": round(t_in + rate, 1),
                "4h": round(t_in + (rate * 4), 1)
            }

        return forecasts