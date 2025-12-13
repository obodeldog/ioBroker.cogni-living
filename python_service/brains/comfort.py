import pandas as pd
import numpy as np

class ComfortBrain:
    def __init__(self): pass

    def train(self, events):
        try:
            if not events: return False, []
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
        except: return False, []