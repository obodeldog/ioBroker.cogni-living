import sys
import json
import time
import os
import pandas as pd

# LOGGING
VERSION = "0.17.0 (PINN Neural Core)"
def log(msg):
    print(f"[LOG] {msg}")
    sys.stdout.flush()

def send_result(type, payload):
    msg = {"type": type, "payload": payload}
    print(f"[RESULT] {json.dumps(msg)}")
    sys.stdout.flush()

sys.path.append(os.path.dirname(__file__))

LIBS_AVAILABLE = False
try:
    from brains.security import SecurityBrain
    from brains.health import HealthBrain
    from brains.energy import EnergyBrain
    from brains.comfort import ComfortBrain
    from brains.pinn import LightweightPINN # NEU
    import numpy as np
    LIBS_AVAILABLE = True
except ImportError as e:
    log(f"⚠️ Import Error: {e}")
except Exception as e:
    log(f"⚠️ Critical Startup Error: {e}")

if LIBS_AVAILABLE:
    security_brain = SecurityBrain()
    health_brain = HealthBrain()
    energy_brain = EnergyBrain()
    comfort_brain = ComfortBrain()
    pinn_brain = LightweightPINN() # NEU
else:
    security_brain = None

def process_message(msg):
    try:
        data = json.loads(msg)
        cmd = data.get("command")

        if cmd == "PING":
            send_result("PONG", {"timestamp": time.time()})
            return

        if not LIBS_AVAILABLE:
            return

        # 1. SECURITY
        if cmd == "TRAIN_SECURITY":
            success, details, thresh = security_brain.train(data.get("sequences", []))
            send_result("TRAINING_COMPLETE", {"success": success, "details": details, "threshold": thresh})
        elif cmd == "ANALYZE_SEQUENCE":
            score, is_anomaly, explanation = security_brain.predict(data.get("sequence", {}))
            send_result("SECURITY_RESULT", {"anomaly_score": score, "is_anomaly": is_anomaly, "explanation": explanation})
        elif cmd == "SET_TOPOLOGY":
            security_brain.graph.update_topology(data)
            send_result("TOPOLOGY_ACK", {"success": True})
        elif cmd == "SIMULATE_SIGNAL":
            room = data.get("room")
            neighbors = security_brain.graph.propagate_signal(room)
            send_result("SIGNAL_RESULT", {"room": room, "propagation": neighbors})

        # 2. HEALTH
        elif cmd == "TRAIN_HEALTH":
            success, details = health_brain.train(data.get("digests", []))
            send_result("HEALTH_TRAIN_RESULT", {"success": success, "details": details})
        elif cmd == "ANALYZE_HEALTH":
            res, details = health_brain.predict(data.get("digest", {}))
            send_result("HEALTH_RESULT", {"is_anomaly": (res == -1), "details": details})
        elif cmd == "ANALYZE_GAIT":
            trend = health_brain.analyze_gait_speed(data.get("sequences", []))
            if trend is not None: send_result("GAIT_RESULT", {"speed_trend": trend})

        # 3. ENERGY (Classic & PINN)
        elif cmd == "TRAIN_ENERGY":
            # Klassisches Modell trainieren
            points = data.get("points", [])
            success, details = energy_brain.train(points)
            
            # NEU: PINN parallel trainieren
            # Wir bereiten die Daten für das NN vor
            # Wir brauchen Delta T (Temperaturänderung) als Target
            if points and len(points) > 50:
                try:
                    df = pd.DataFrame(points)
                    df['ts'] = pd.to_datetime(df['ts'], unit='ms')
                    pinn_data = []
                    
                    for room, group in df.groupby('room'):
                        group = group.sort_values('ts')
                        group['dt_h'] = group['ts'].diff().dt.total_seconds() / 3600.0
                        group['d_temp'] = group['t_in'].diff()
                        
                        # Filtern valider Schritte
                        valid = group[(group['dt_h'] > 0.1) & (group['dt_h'] < 2.0)].copy()
                        
                        for idx, row in valid.iterrows():
                            # Feature Extraction
                            t_in = row['t_in']
                            t_out = 10.0 # Standardwert falls fehlt (ToDo: Historische Wetterdaten mitspeichern)
                            valve = row.get('valve', 0)
                            solar = False # ToDo: Historische Solardaten
                            
                            # Target: Änderung pro Stunde
                            rate = row['d_temp'] / row['dt_h']
                            
                            pinn_data.append({
                                't_in': t_in, 't_out': t_out, 
                                'valve': valve, 'solar': solar, 
                                'delta_t': rate
                            })
                            
                    p_success, p_msg = pinn_brain.train(pinn_data)
                    log(f"PINN Training: {p_msg}")
                except Exception as e:
                    log(f"PINN Train Error: {e}")

            send_result("ENERGY_TRAIN_RESULT", {"success": success, "details": details})

        elif cmd == "PREDICT_ENERGY":
            current_temps = data.get("current_temps", {})
            t_out = data.get("t_out", 0)
            is_sunny = data.get("is_sunny", False)
            solar_flags = data.get("solar_flags", {})
            
            # 1. Klassische Physik
            forecast = energy_brain.predict_cooling(
                current_temps, t_out,
                data.get("t_forecast", None),
                is_sunny, solar_flags
            )
            send_result("ENERGY_PREDICT_RESULT", {"forecast": forecast})
            
            # 2. NEU: PINN Prediction (Vergleichswert)
            pinn_results = {}
            for room, t_in in current_temps.items():
                # Wir nehmen Valve=0 an (Auskühl-Test)
                # Solar nur wenn Flag gesetzt
                solar_active = is_sunny and solar_flags.get(room, False)
                
                rate = pinn_brain.predict(t_in, t_out, 0.0, solar_active)
                
                # Hochrechnung auf 1h
                pinn_results[room] = {
                    "rate_per_hour": round(rate, 2),
                    "predicted_1h": round(t_in + rate, 1)
                }
            
            # Senden als separates Event oder Log
            if pinn_results:
                send_result("PINN_PREDICT_RESULT", {"forecast": pinn_results})

        elif cmd == "OPTIMIZE_ENERGY":
            proposals = energy_brain.get_optimization_advice(
                data.get("current_temps", {}),
                data.get("t_out", 0),
                data.get("targets", {}),
                data.get("t_forecast", None)
            )
            send_result("ENERGY_OPTIMIZE_RESULT", {"proposals": proposals})

        # 4. COMFORT
        elif cmd == "TRAIN_COMFORT":
            success, top_rules = comfort_brain.train(data.get("events", []))
            send_result("COMFORT_RESULT", {"patterns": top_rules if success else []})

    except Exception as e: log(f"Err processing: {e}")

if __name__ == "__main__":
    log(f"Cogni-Living Engine started. {VERSION}")
    if LIBS_AVAILABLE:
        security_brain.load_brain()
        health_brain.load_brain()
        energy_brain.load_brain()
        pinn_brain.load_brain() # Load NN

    while True:
        try:
            line = sys.stdin.readline()
            if not line: break
            process_message(line.strip())
        except: break