import sys
import json
import time
import os
import pandas as pd

# LOGGING
VERSION = "0.28.0 (Proof Transport)"
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
    from brains.pinn import LightweightPINN
    from brains.tracker import ParticleFilter
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
    pinn_brain = LightweightPINN()
    tracker_brain = ParticleFilter()
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
            rooms = data.get('rooms', [])
            matrix = data.get('matrix', [])
            monitored = data.get('monitored', [])
            tracker_brain.set_topology(rooms, matrix, monitored)
            send_result("TOPOLOGY_ACK", {"success": True})

        elif cmd == "SIMULATE_SIGNAL":
            room = data.get("room")
            neighbors = security_brain.graph.propagate_signal(room)
            send_result("SIGNAL_RESULT", {"room": room, "propagation": neighbors})

        elif cmd == "SET_LEARNING_MODE":
            active = data.get("active", False)
            duration = data.get("duration", 0)
            label = data.get("label", "manual")
            security_brain.set_learning_mode(active, duration, label)
            log(f"Security Learning Mode set to {active} ({label})")

        elif cmd == "TRACK_EVENT":
            room = data.get("room")
            dt = data.get("dt", 0.0)
            probs = tracker_brain.update(room, dt)
            send_result("TRACKER_RESULT", {"probabilities": probs})

        # 2. HEALTH
        elif cmd == "TRAIN_HEALTH":
            success, details = health_brain.train(data.get("digests", []))
            send_result("HEALTH_TRAIN_RESULT", {"success": success, "details": details})

        elif cmd == "ANALYZE_HEALTH":
            res, details = health_brain.predict(data.get("digest", {}))
            send_result("HEALTH_RESULT", {"is_anomaly": (res == -1), "details": details})

        # --- UPDATE: GAIT PROOF ---
        elif cmd == "ANALYZE_GAIT":
            trend, sensors, proof = health_brain.analyze_gait_speed(data.get("sequences", []))
            if trend is not None:
                send_result("GAIT_RESULT", {
                    "speed_trend": trend,
                    "sensors": sensors,
                    "proof": proof # Der Beweis
                })
        # ---------------------------

        elif cmd == "ANALYZE_TREND":
            values = data.get("values", [])
            tag = data.get("tag", "Activity")
            trend_percent, debug_msg = health_brain.analyze_activity_trend(values)
            log(f"Trend Analysis ({tag}): {debug_msg}")
            send_result("HEALTH_TREND_RESULT", {
                "trend_percent": trend_percent,
                "details": debug_msg,
                "is_anomaly": False
            })

        # 3. ENERGY
        elif cmd == "TRAIN_ENERGY":
            points = data.get("points", [])
            success, details = energy_brain.train(points)
            log(f"Classic Energy Train: {success}")

            if points and len(points) > 20:
                try:
                    df = pd.DataFrame(points)
                    df['ts'] = pd.to_datetime(df['ts'], unit='ms')
                    pinn_data = []
                    for room, group in df.groupby('room'):
                        group = group.sort_values('ts')
                        group['dt_h'] = group['ts'].diff().dt.total_seconds() / 3600.0
                        group['d_temp'] = group['t_in'].diff()
                        valid = group[(group['dt_h'] > 0.1) & (group['dt_h'] < 2.0)].copy()
                        for idx, row in valid.iterrows():
                            t_in = row['t_in']
                            t_out = 10.0
                            valve = row.get('valve', 0)
                            solar = False
                            rate = row['d_temp'] / row['dt_h']
                            pinn_data.append({ 't_in': t_in, 't_out': t_out, 'valve': valve, 'solar': solar, 'delta_t': rate })
                    p_success, p_msg = pinn_brain.train(pinn_data)
                    log(f"PINN Training: {p_msg}")
                except Exception as e: log(f"PINN Train Error: {e}")
            send_result("ENERGY_TRAIN_RESULT", {"success": success, "details": details})

        elif cmd == "TRAIN_RL_PENALTY":
            room = data.get("room")
            success, msg = energy_brain.train_penalty(room)
            log(f"RL Penalty: {msg}")
            send_result("RL_PENALTY_UPDATE", {"penalties": energy_brain.get_penalties()})

        elif cmd == "PREDICT_ENERGY":
            current_temps = data.get("current_temps", {})
            t_out = data.get("t_out", 0)
            is_sunny = data.get("is_sunny", False)
            solar_flags = data.get("solar_flags", {})
            warmup_targets = data.get("warmup_targets", {})

            forecast = energy_brain.predict_cooling(current_temps, t_out, data.get("t_forecast", None), is_sunny, solar_flags)
            send_result("ENERGY_PREDICT_RESULT", {"forecast": forecast})

            vent_alerts = energy_brain.check_ventilation(current_temps)
            send_result("VENTILATION_ALERT", {"alerts": vent_alerts})

            times, sources, details = energy_brain.calculate_warmup_times(
                current_temps,
                warmup_targets,
                pinn_brain,
                t_out,
                is_sunny,
                solar_flags
            )
            send_result("WARMUP_RESULT", {"times": times, "sources": sources, "details": details})

            pinn_results = {}
            for room, t_in in current_temps.items():
                solar_active = is_sunny and solar_flags.get(room, False)
                rate = pinn_brain.predict(t_in, t_out, 0.0, solar_active)
                pinn_results[room] = { "rate_per_hour": round(rate, 2), "predicted_1h": round(t_in + rate, 1) }
            if pinn_results: send_result("PINN_PREDICT_RESULT", {"forecast": pinn_results})

            send_result("RL_PENALTY_UPDATE", {"penalties": energy_brain.get_penalties()})

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
        pinn_brain.load_brain()
        tracker_brain.load_brain()

    while True:
        try:
            line = sys.stdin.readline()
            if not line: break
            process_message(line.strip())
        except: break