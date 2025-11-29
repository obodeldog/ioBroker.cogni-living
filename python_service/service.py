import time
import sys
import json
import os
from datetime import datetime

# VERSUCH: Externe KI-Libs laden
try:
    import numpy as np
    import pandas as pd
    import schedule
    LIBS_AVAILABLE = True
except ImportError as e:
    LIBS_AVAILABLE = False
    IMPORT_ERROR = str(e)

# KONFIGURATION
VERSION = "0.2.0 (Hybrid Test)"
HB_INTERVAL = 60

def log(msg):
    """Einfacher Logger -> Geht via StdOut an ioBroker"""
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] [PYTHON-AI] {msg}")
    sys.stdout.flush()

def main():
    log(f"Service gestartet. Version: {VERSION}")

    # DIAGNOSE: Können wir Mathe?
    if LIBS_AVAILABLE:
        log("✅ ERFOLG: Numpy, Pandas & Schedule erfolgreich geladen!")

        # Kleiner Beweis: Wir berechnen etwas mit Numpy
        test_array = np.array([10, 20, 30, 40, 50])
        mean_val = np.mean(test_array)
        log(f"🧠 KI-Test: Numpy berechnet Mittelwert von [10..50] = {mean_val}")

    else:
        log(f"❌ FEHLER: Bibliotheken nicht gefunden. Python läuft 'nackt'.")
        log(f"❌ Detail: {IMPORT_ERROR}")
        log("HINWEIS: Evtl. müssen Libs global installiert werden (sudo pip3 ...)")

    log("Warte auf Daten-Input...")

    while True:
        try:
            # Hier würde später schedule.run_pending() stehen
            time.sleep(HB_INTERVAL)

        except KeyboardInterrupt:
            log("Service wird beendet.")
            break
        except Exception as e:
            log(f"KRITISCHER FEHLER: {e}")
            time.sleep(60)

if __name__ == "__main__":
    main()