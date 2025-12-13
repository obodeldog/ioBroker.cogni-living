import sys
import json
import time
import os

# LOGGING
VERSION = "0.16.0 (Modular Micro-Kernel)"
def log(msg):
    print(f"[LOG] {msg}")
    sys.stdout.flush()

def send_result(type, payload):
    msg = {"type": type, "payload": payload}
    print(f"[RESULT] {json.dumps(msg)}")
    sys.stdout.flush()

# --- DYNAMIC IMPORTS ---
# Wir fügen das aktuelle Verzeichnis zum Pfad hinzu, damit 'brains' gefunden wird
sys.path.append(os.path.dirname(__file__))

LIBS_AVAILABLE = False
try:
    from brains.security import SecurityBrain
    from brains.health import HealthBrain
    from brains.energy import EnergyBrain
    from brains.comfort import ComfortBrain
    import numpy as np # Check if core libs exist
    LIBS_AVAILABLE = True
except ImportError as e:
    log(f"⚠️ Import Error (Modules or Libs missing): {e}")
except Exception as e:
    log(f"⚠️ Critical Startup Error: {e}")

# SINGLETONS
if LIBS_AVAILABLE:
    security_brain = SecurityBrain()
    health_brain = HealthBrain()
    energy_brain = EnergyBrain()
    comfort_brain = ComfortBrain()
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
            log("⚠️ Befehl ignoriert (System läuft im Safe Mode ohne ML-Libs)")
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

        # 2. HEALTH (Family Link)
        elif cmd == "TRAIN_HEALTH":
            success, details = health_brain.train(data.get("digests", []))
            send_result("HEALTH_TRAIN_RESULT", {"success": success, "details": details})
        elif cmd == "ANALYZE_HEALTH":
            res, details = health_brain.predict(data.get("digest", {}))
            send_result("HEALTH_RESULT", {"is_anomaly": (res == -1), "details": details})
        elif cmd == "ANALYZE_GAIT":
            trend = health_brain.analyze_gait_speed(data.get("sequences", []))
            if trend is not None: send_result("GAIT_RESULT", {"speed_trend": trend})

        # 3. ENERGY
        elif cmd == "TRAIN_ENERGY":
            success, details = energy_brain.train(data.get("points", []))
            send_result("ENERGY_TRAIN_RESULT", {"success": success, "details": details})
        elif cmd == "PREDICT_ENERGY":
            forecast = energy_brain.predict_cooling(data.get("current_temps", {}), data.get("t_out", 0))
            send_result("ENERGY_PREDICT_RESULT", {"forecast": forecast})

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

    while True:
        try:
            line = sys.stdin.readline()
            if not line: break
            process_message(line.strip())
        except: break