import sys
import json
import time
from datetime import datetime

# VERSUCH: Externe KI-Libs laden
try:
    import numpy as np
    import pandas as pd
    LIBS_AVAILABLE = True
except ImportError:
    LIBS_AVAILABLE = False

# KONFIGURATION
VERSION = "0.4.0 (Guardian Core: Trend Analysis)"

def log(msg):
    """Sendet Logs an Node.js"""
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[LOG] {msg}")
    sys.stdout.flush()

def send_result(type, payload):
    """Sendet Ergebnisse als JSON an Node.js"""
    msg = {
        "type": type,
        "payload": payload
    }
    print(f"[RESULT] {json.dumps(msg)}")
    sys.stdout.flush()

def calculate_trend(values):
    """
    Kernfunktion des Wächters (Phase 3):
    Berechnet die Steigung (Trend) einer Zeitreihe mittels linearer Regression.
    Nutzt numpy.polyfit für mathematische Präzision.
    """
    if not LIBS_AVAILABLE or len(values) < 2:
        return 0.0, "Insufficient Data"

    try:
        # x-Achse: Einfach 0, 1, 2, 3... (Tage/Einheiten)
        x = np.arange(len(values))
        y = np.array(values)

        # Lineare Regression (Grad 1) -> y = mx + b
        # m (Steigung) ist unser "Trend"
        slope, intercept = np.polyfit(x, y, 1)

        # Umrechnung in lesbare Prozent (ungefähr):
        # Wenn wir bei 100 starten und bei 90 enden, ist das ein negativer Trend.
        start_val = (slope * 0) + intercept
        end_val = (slope * (len(values)-1)) + intercept

        if start_val == 0: start_val = 0.001 # Div/0 Schutz

        percent_change = ((end_val - start_val) / start_val) * 100

        return slope, percent_change

    except Exception as e:
        log(f"Mathe-Fehler: {e}")
        return 0.0, str(e)

def process_message(msg):
    """Verarbeitet Befehle"""
    try:
        data = json.loads(msg)
        cmd = data.get("command")

        if cmd == "PING":
            send_result("PONG", {"timestamp": time.time()})

        elif cmd == "ANALYZE_TREND":
            # Hier kommt der "Medical Need":
            # Node.js schickt uns z.B. die täglichen Aktivitäts-Scores der letzten 14 Tage.
            # Wir prüfen: Geht es bergab?
            values = data.get("values", [])
            tag = data.get("tag", "General")

            log(f"Analysiere Trend für '{tag}' mit {len(values)} Datenpunkten...")

            slope, change = calculate_trend(values)

            # Interpretation (Diagnose)
            diagnosis = "Stabil"
            if change < -10: diagnosis = "Signifikanter Abfall (Achtung)"
            elif change < -5: diagnosis = "Leichter Abfall"
            elif change > 5: diagnosis = "Anstieg (Positiv)"

            send_result("TREND_RESULT", {
                "tag": tag,
                "slope": round(slope, 4),
                "change_percent": round(change, 2),
                "diagnosis": diagnosis
            })

        else:
            log(f"Unbekannter Befehl: {cmd}")

    except Exception as e:
        log(f"Fehler beim Verarbeiten: {e}")

def main():
    log(f"Guardian Engine gestartet. Version: {VERSION}")

    if LIBS_AVAILABLE:
        log("✅ Math-Engine (Numpy) bereit für Trend-Diagnose.")
    else:
        log("❌ FEHLER: Numpy fehlt. Guardian läuft im Blindflug.")

    # HAUPTSCHLEIFE
    while True:
        try:
            line = sys.stdin.readline()
            if not line: break
            process_message(line.strip())
        except KeyboardInterrupt:
            break
        except Exception as e:
            log(f"Loop Fehler: {e}")

if __name__ == "__main__":
    main()