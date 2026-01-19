import pandas as pd
import numpy as np

class ComfortBrain:
    def __init__(self): pass

    # NEW: Accept device_map for strict typing
    def _is_valid_action(self, name_id, device_map):
        """
        Semantic Filter using Configuration Map (Source of Truth).
        Replaces 'guessing by name' with 'checking config type'.
        """
        # 1. Lookup Type in Map
        # Note: IDs in map match the ioBroker IDs exactly
        dtype = device_map.get(name_id)

        if not dtype:
            # Fallback: If unknown, we are conservative and block it.
            # "Custom" types also fall here (safe by default).
            return False

        # 2. WHITELIST (Allowed Actors)
        allowed_actors = [
            'light',    # Licht / Schalter
            'dimmer',   # Dimmer
            'blind',    # Rollladen / Jalousie
            'lock',     # Schloss
            'thermostat' # Thermostat (Setpoint)
        ]

        if dtype in allowed_actors:
            return True

        # 3. BLACKLIST (Explicit Sensors - just for documentation, actually covered by default return)
        # 'motion', 'door', 'fire', 'temperature' -> return False

        return False

    def train(self, events, device_map=None):
        try:
            if not events: return False, []

            # Ensure device_map exists
            if device_map is None: device_map = {}

            df = pd.DataFrame(events)
            if 'timestamp' in df.columns: df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df = df.sort_values('timestamp')

            patterns_2 = {}; event_counts = {}
            records = df.to_dict('records')
            n = len(records)

            for i in range(n):
                evt_a = records[i]
                id_a = evt_a.get('name', evt_a.get('id', 'unknown'))
                event_counts[id_a] = event_counts.get(id_a, 0) + 1

                for j in range(i + 1, min(i + 10, n)):
                    evt_b = records[j]
                    id_b = evt_b.get('name', evt_b.get('id', 'unknown'))
                    delta_ab = (evt_b['timestamp'] - evt_a['timestamp']).total_seconds()

                    if delta_ab > 45: break
                    if delta_ab < 1.0 or id_a == id_b: continue

                    # --- REFINED FILTER ---
                    # Use the Map passed from Node.js
                    if not self._is_valid_action(id_b, device_map):
                        continue
                    # ----------------------

                    pair = f"{id_a} -> {id_b}"
                    if pair not in patterns_2: patterns_2[pair] = []
                    patterns_2[pair].append(delta_ab)

            results = []
            for rule, delays in patterns_2.items():
                count = len(delays)
                if count < 3: continue
                source = rule.split(" -> ")[0]
                conf = count / event_counts.get(source, 1)
                if conf > 0.4:
                    avg = float(np.mean(delays))
                    results.append({'rule': rule, 'confidence': conf, 'count': count, 'timeInfo': f"Ø +{avg:.1f}s"})

            results.sort(key=lambda x: x['confidence'], reverse=True)
            return True, results[:5]
        except Exception as e:
            print(f"[ComfortBrain Error] {e}")
            return False, []