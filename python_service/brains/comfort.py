import pandas as pd
import numpy as np
import sys

# Helper for logging to ioBroker
def log(msg):
    print(f"[LOG] [Comfort] {msg}")
    sys.stdout.flush()

class ComfortBrain:
    def __init__(self): pass

    def _is_valid_action(self, tech_id, device_map):
        """
        Prüft anhand der Technischen ID (hm-rpc.0...), ob das Gerät ein Aktor ist.
        """
        if not tech_id or tech_id not in device_map:
            # Fallback: Wenn wir die ID nicht kennen, ignorieren wir sie (Sicherheit).
            return False

        dtype = device_map[tech_id]

        # WHITELIST (Nur diese Typen dürfen automatisch geschaltet werden)
        allowed_actors = [
            'light',    # Licht / Schalter
            'dimmer',   # Dimmer
            'blind',    # Rollladen / Jalousie
            'lock',     # Schloss
            'thermostat', # Thermostat (Setpoint)
            'switch',   # Allgemeiner Schalter
            'plug'      # Steckdose
        ]

        return dtype in allowed_actors

    def train(self, events, device_map=None):
        try:
            if not events:
                log("Keine Events zum Trainieren erhalten.")
                return False, []

            if device_map is None: device_map = {}

            log(f"Starte Training mit {len(events)} Events und {len(device_map)} bekannten Geräten.")

            df = pd.DataFrame(events)
            if 'timestamp' in df.columns:
                df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')

            df = df.sort_values('timestamp')

            patterns_2 = {}
            event_counts = {}
            records = df.to_dict('records')
            n = len(records)

            ignored_count = 0

            for i in range(n):
                evt_a = records[i]
                # A (Trigger) darf alles sein. Wir nutzen den Namen für die Anzeige.
                name_a = evt_a.get('name', evt_a.get('id', 'unknown'))

                # Zähle Vorkommen für Konfidenz
                event_counts[name_a] = event_counts.get(name_a, 0) + 1

                # Look ahead (Fenster: 10 Events)
                for j in range(i + 1, min(i + 10, n)):
                    evt_b = records[j]

                    # WICHTIG: Wir holen ID für den Check, Name für die Anzeige
                    id_b_tech = evt_b.get('id') # z.B. hm-rpc.0.LEQ12345
                    name_b = evt_b.get('name', id_b_tech) # z.B. "Licht Flur"

                    delta_ab = (evt_b['timestamp'] - evt_a['timestamp']).total_seconds()

                    if delta_ab > 45: break # Zeitfenster 45s
                    if delta_ab < 1.0 or name_a == name_b: continue # Entprellen

                    # --- SEMANTISCHER FILTER (FIX) ---
                    # Wir prüfen die technische ID in der Map
                    if not self._is_valid_action(id_b_tech, device_map):
                        # Optional: Zählen wie oft wir filtern (für Debug)
                        # ignored_count += 1
                        continue
                    # ---------------------------------

                    pair = f"{name_a} -> {name_b}"
                    if pair not in patterns_2: patterns_2[pair] = []
                    patterns_2[pair].append(delta_ab)

            # Auswertung
            results = []
            for rule, delays in patterns_2.items():
                count = len(delays)
                if count < 3: continue # Mindestens 3x aufgetreten

                source = rule.split(" -> ")[0]
                conf = count / event_counts.get(source, 1)

                # Konfidenz > 40%
                if conf > 0.4:
                    avg = float(np.mean(delays))
                    results.append({
                        'rule': rule,
                        'confidence': conf,
                        'count': count,
                        'timeInfo': f"Ø +{avg:.1f}s"
                    })

            results.sort(key=lambda x: x['confidence'], reverse=True)
            log(f"Training beendet. {len(results)} gültige Muster gefunden (nach Filterung).")

            return True, results[:5]

        except Exception as e:
            log(f"CRITICAL ERROR in train(): {e}")
            return False, []