import sys
import json
import time
import os
from datetime import datetime

# VERSUCH: Externe KI-Libs laden
try:
    import numpy as np
    import pandas as pd
    LIBS_AVAILABLE = True
except ImportError:
    LIBS_AVAILABLE = False

# KONFIGURATION
VERSION = "0.3.0 (Communication Ready)"

def log(msg):
    """Sendet Logs an Node.js via stdout mit Prefix"""
    ts = datetime.now().strftime("%H:%M:%S")
    # Wir nutzen ein spezielles Prefix, das Node.js parsen kann
    print(f"[LOG] {msg}")
    sys.stdout.flush()

def send_result(type, payload):
    """Sendet Ergebnisse als JSON an Node.js"""
    msg = {
        "type": type,
        "payload": payload
    }
    # WICHTIG: JSON muss in einer einzigen Zeile stehen!
    print(f"[RESULT] {json.dumps(msg)}")
    sys.stdout.flush()

def process_message(msg):
    """Verarbeitet eingehende Befehle von Node.js"""
    try:
        data = json.loads(msg)
        cmd = data.get("command")

        if cmd == "PING":
            log(f"Ping empfangen. Antworte mit Pong...")
            send_result("PONG", {"timestamp": time.time()})

        elif cmd == "CALC_STATS":
            # Simulation einer Berechnung (Später hier: Pandas/Numpy)
            values = data.get("values", [])
            if LIBS_AVAILABLE and len(values) > 0:
                mean = np.mean(values)
                median = np.median(values)
                send_result("STATS_RESULT", {"mean": mean, "median": median})
            else:
                log("Keine Libs oder keine Daten.")

        else:
            log(f"Unbekannter Befehl: {cmd}")

    except Exception as e:
        log(f"Fehler beim Verarbeiten der Nachricht: {e}")

def main():
    log(f"Service gestartet. Version: {VERSION}")

    if LIBS_AVAILABLE:
        log("Math-Engine (Numpy/Pandas) bereit.")
    else:
        log("Math-Engine FEHLT (Nur Basic Mode).")

    # HAUPTSCHLEIFE: Warten auf Input von Node.js (via stdin)
    while True:
        try:
            # Liest eine Zeile von stdin (blockierend)
            line = sys.stdin.readline()

            if not line:
                # End of Stream (Node.js hat Prozess beendet)
                break

            line = line.strip()
            if line:
                process_message(line)

        except KeyboardInterrupt:
            break
        except Exception as e:
            log(f"Loop Fehler: {e}")

if __name__ == "__main__":
    main()