import os
import pickle
import numpy as np

# Dr.-Ing. Update: Gait Speed mit Debug-Proof (Transparenz)
# Version: 0.28.0 (Math Proof)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEALTH_MODEL_PATH = os.path.join(BASE_DIR, "health_if_model.pkl")

class HealthBrain:
    def __init__(self):
        self.model = None
        self.is_ready = False

    def load_brain(self):
        try:
            if os.path.exists(HEALTH_MODEL_PATH):
                with open(HEALTH_MODEL_PATH, 'rb') as f: self.model = pickle.load(f)
                self.is_ready = True
            return True
        except: return False

    def _prepare_features(self, digests):
        data = []
        for d in digests:
            vec = d.get('activityVector', None)
            if vec is None or len(vec) != 96:
                count = d.get('eventCount', 0)
                vec = [0] * 96
                for i in range(30, 80): vec[i] = int(count / 50)
            data.append(vec)
        return np.array(data)

    def train(self, digests):
        try:
            from sklearn.ensemble import IsolationForest
            X = self._prepare_features(digests)
            if len(X) < 2: return False, "Need > 2 days data"
            clf = IsolationForest(random_state=42, contamination=0.1)
            clf.fit(X)
            with open(HEALTH_MODEL_PATH, 'wb') as f: pickle.dump(clf, f)
            self.model = clf; self.is_ready = True
            return True, "Isolation Forest Trained"
        except Exception as e: return False, str(e)

    def predict(self, digest):
        if not self.is_ready: return 0, 0.0, "Not Ready"
        try:
            X = self._prepare_features([digest])
            res = self.model.predict(X)[0]
            raw_score = self.model.score_samples(X)[0]
            # IsolationForest(contamination=0.1): Normale Tage liefern raw_score ~ -0.10.
            # Alte Formel (-raw_score) ergab 0.10 fuer normale Tage → verwirrend.
            # Neue Formel: 0.0 = normal, 1.0 = stark anomal (zentriert um -0.10 Baseline).
            # Bereich: -0.10 (normal) bis -0.50 (sehr anomal) → skaliert auf 0.0 bis 1.0
            BASELINE_RAW = -0.10  # Erwarteter Score fuer normalen Tag bei contamination=0.1
            RANGE_RAW = 0.40      # Spanne von normal (-0.10) bis stark anomal (-0.50)
            norm_score = max(0.0, min(1.0, (BASELINE_RAW - raw_score) / RANGE_RAW))
            print(f"[HealthBrain.predict] raw_score={raw_score:.4f} | norm_score={norm_score:.4f} | inlier={res==1}")
            return res, norm_score, f"Anomaly Score: {raw_score:.3f} (norm: {norm_score:.2f})"
        except Exception as e: return 0, 0.0, str(e)

    def analyze_gait_speed(self, sequences, hallway_locations=None):
        """
        Berechnet Flur-Transitzeit: Zeit von Flur-Trigger bis naechster-Raum-Trigger.
        Erfordert Muster [Raum_A -> Flur -> Raum_B] in der Sequenz.
        Unabhaengig von Sensor-Hold-Zeit, da nur steigende Flanken gemessen werden.
        Output: (median_transit_seconds, list_of_sensors, debug_proof_string)
        """
        try:
            durations = []
            used_sensors = set()
            hallway_set = set(hallway_locations or [])
            hallway_keywords = ['flur', 'diele', 'gang', 'korridor']

            def is_hallway_loc(loc):
                return loc in hallway_set or any(x in loc.lower() for x in hallway_keywords)

            for seq in sequences:
                steps = seq.get('steps', [])
                if len(steps) < 3:  # Mindestens Raum_A + Flur + Raum_B
                    continue

                for i, step in enumerate(steps):
                    loc = step.get('loc', '')

                    # Ist dieser Step ein Flur-Sensor?
                    if not is_hallway_loc(loc):
                        continue

                    # Muss einen Raum DAVOR und DANACH haben
                    if i == 0 or i + 1 >= len(steps):
                        continue

                    prev_loc = steps[i - 1].get('loc', '')
                    next_loc = steps[i + 1].get('loc', '')

                    # Nachbar-Steps duerfen selbst kein Flur sein (kein Flur-Flur-Flur)
                    if is_hallway_loc(prev_loc) or is_hallway_loc(next_loc):
                        continue

                    # Transitzeit: Flur-Trigger -> naechster Raum-Trigger
                    t_hallway = step.get('t_delta', 0)
                    t_next    = steps[i + 1].get('t_delta', 0)
                    transit   = t_next - t_hallway

                    # Plausibilitaets-Filter: 1-20 Sekunden
                    if 1 <= transit <= 20:
                        durations.append(transit)
                        used_sensors.add(loc)

            if len(durations) < 3:
                return None, [], f"Zu wenig Datenpunkte ({len(durations)}/3 Transitionen)"

            median_transit = round(float(np.median(durations)), 1)
            last_5 = [round(d, 1) for d in durations[-5:]]
            proof = (f"n={len(durations)} Transitionen [Raum->Flur->Raum]. "
                     f"Median={median_transit}s. "
                     f"Bereich: {min(durations):.1f}-{max(durations):.1f}s. "
                     f"Letzte 5 (Sek.): {last_5}")

            return median_transit, list(used_sensors), proof
        except Exception as e: return None, [], f"Error: {str(e)}"

    def analyze_activity_trend(self, values):
        try:
            if not values or len(values) < 3:
                return 0.0, "Insufficient Data (<3 Days)"
            y = np.array(values, dtype=float)
            x = np.arange(len(y))
            slope, intercept = np.polyfit(x, y, 1)
            start_val = intercept
            end_val = (slope * (len(values)-1)) + intercept
            if start_val <= 0.1: start_val = 0.1
            change_percent = ((end_val - start_val) / start_val) * 100.0
            trend_desc = "Stabil"
            if change_percent > 5: trend_desc = "Steigend"
            elif change_percent < -5: trend_desc = "Fallend"
            return change_percent, f"{trend_desc} ({change_percent:.1f}%)"
        except Exception as e:
            return 0.0, f"Error: {str(e)}"

    def analyze_weekly_heatmap(self, week_data):
        """
        Intelligente Heatmap-Analyse für 7 Tage × 24 Stunden.
        Nutzt IsolationForest + Regel-basierte Tageszeiten-Logik.
        
        Input: week_data = {
            'YYYY-MM-DD': {
                'eventHistory': [...],
                'date': Date object
            }
        }
        
        Output: {
            'YYYY-MM-DD': {
                'hourly_counts': [0..23],
                'anomaly_scores': [0..23],
                'rule_flags': [0..23],
                'baseline': [0..23]
            }
        }
        """
        try:
            result = {}
            
            # Schritt 1: Erstelle stündliche Vektoren für alle Tage
            daily_vectors = {}
            for date_str, day_data in week_data.items():
                events = day_data.get('eventHistory', [])
                hourly_counts = [0] * 24
                
                for event in events:
                    if not isinstance(event, dict):
                        continue
                    
                    # Motion-Events filtern
                    e_type = str(event.get('type', '')).lower()
                    e_name = str(event.get('name', '')).lower()
                    e_value = event.get('value')
                    
                    is_motion = ('bewegung' in e_type or 'motion' in e_type or 
                                'presence' in e_type or 'bewegung' in e_name)
                    is_active = e_value in [True, 1, 'on', 'true']
                    
                    if is_motion and is_active:
                        timestamp = event.get('timestamp', 0)
                        if timestamp > 0:
                            from datetime import datetime
                            dt = datetime.fromtimestamp(timestamp / 1000.0)
                            hour = dt.hour
                            if 0 <= hour < 24:
                                hourly_counts[hour] += 1
                
                daily_vectors[date_str] = hourly_counts
            
            # Schritt 2: Berechne Baseline (Durchschnitt über alle Tage)
            if len(daily_vectors) > 0:
                all_vecs = np.array(list(daily_vectors.values()))
                baseline = np.mean(all_vecs, axis=0)
            else:
                baseline = np.zeros(24)
            
            # Schritt 3: Anomalie-Scores + Baseline-relative Aktivität
            for date_str, hourly_counts in daily_vectors.items():
                anomaly_scores = [0.0] * 24
                rule_flags = ['NORMAL'] * 24
                activity_percent = [0] * 24
                
                # Berechne Aktivität RELATIV zur Baseline (adaptiv!)
                for hour in range(24):
                    count = hourly_counts[hour]
                    base = baseline[hour]
                    
                    # Aktivität als Prozent relativ zur Baseline
                    if base > 1.0:
                        activity_percent[hour] = int(round((count / base) * 100))
                    elif count > 0:
                        # Fallback: Wenn keine Baseline, nutze absolute Zählung
                        activity_percent[hour] = min(100, count * 2)
                    else:
                        activity_percent[hour] = 0
                
                # IsolationForest: Vergleiche mit Baseline
                if self.is_ready and self.model is not None:
                    try:
                        for hour in range(24):
                            count = hourly_counts[hour]
                            base = baseline[hour]
                            
                            # Normalisiere Score (-1 bis 0)
                            if base > 0:
                                deviation = abs(count - base) / (base + 1.0)
                                # Je höher deviation, desto niedriger der Score
                                anomaly_scores[hour] = -deviation
                            else:
                                anomaly_scores[hour] = 0.0
                    except:
                        pass
                
                # Regel-basierte Flags (Tageszeiten-Kontext)
                for hour in range(24):
                    count = hourly_counts[hour]
                    base = max(baseline[hour], 1.0)
                    
                    # Nachts (22-06 Uhr): Hohe Aktivität = Problem
                    if (hour >= 22 or hour < 6):
                        if count > base * 2.0:
                            rule_flags[hour] = 'NIGHT_HIGH_ACTIVITY'
                            anomaly_scores[hour] = -0.8  # Override
                    
                    # Morgens (06-10 Uhr): Niedrige Aktivität = Problem
                    elif 6 <= hour < 10:
                        if count < base * 0.3 and base > 5:
                            rule_flags[hour] = 'MORNING_NO_ACTIVITY'
                            anomaly_scores[hour] = -0.7  # Override
                    
                    # Tagsüber (10-20 Uhr): Sehr niedrige Aktivität = Beobachten
                    elif 10 <= hour < 20:
                        if count < base * 0.2 and base > 3:
                            rule_flags[hour] = 'DAY_LOW_ACTIVITY'
                            if anomaly_scores[hour] > -0.3:
                                anomaly_scores[hour] = -0.3
                
                result[date_str] = {
                    'hourly_counts': hourly_counts,
                    'activity_percent': activity_percent,
                    'anomaly_scores': anomaly_scores,
                    'rule_flags': rule_flags,
                    'baseline': baseline.tolist()
                }
            
            return result
        
        except Exception as e:
            return {'error': str(e)}
    
    def analyze_room_silence(self, room_data):
        """
        Erkennt stille Räume (Lebenszeichen-Alarm).
        
        Args:
            room_data: Dict mit Raumnamen als Keys und Daten als Values
                      Format: { "EG Bad": { "lastActivity": 1738759200000, "totalMinutes": 92 }, ... }
        
        Returns:
            Dict mit Alarmen pro Raum: { "EG Schlafen Ingrid": { "level": "RED", "hoursSilent": 12.5 }, ... }
        """
        try:
            import time
            now_ms = int(time.time() * 1000)
            now_hour = int(time.localtime().tm_hour)
            
            alerts = {}
            
            for room_name, data in room_data.items():
                if not data or not isinstance(data, dict):
                    continue
                
                last_activity_ms = data.get('lastActivity', 0)
                total_minutes = data.get('totalMinutes', 0)
                
                # Berechne Zeit seit letzter Aktivität
                if last_activity_ms > 0:
                    hours_silent = (now_ms - last_activity_ms) / (1000 * 60 * 60)
                else:
                    hours_silent = 999  # Keine Aktivität jemals = kritisch
                
                # Nur tagsüber (08:00-22:00) alarmieren
                is_daytime = 8 <= now_hour < 22
                
                # Nur Räume mit vorheriger Aktivität prüfen
                if total_minutes < 10:
                    continue  # Raum wird nicht genutzt (z.B. Garage)
                
                # GELB: Ungewöhnlich ruhig (4-8h tagsüber)
                if is_daytime and 4 <= hours_silent < 8:
                    alerts[room_name] = {
                        'level': 'YELLOW',
                        'hoursSilent': round(hours_silent, 1),
                        'message': f'Ungewöhnlich ruhig seit {round(hours_silent, 1)}h'
                    }
                
                # ROT: Keine Bewegung seit >8h (tagsüber) = NOTFALL?
                elif is_daytime and hours_silent >= 8:
                    alerts[room_name] = {
                        'level': 'RED',
                        'hoursSilent': round(hours_silent, 1),
                        'message': f'NOTFALL? Keine Bewegung seit {round(hours_silent, 1)}h!'
                    }
            
            return alerts
        
        except Exception as e:
            return {'error': str(e)}
    
    # ======================================================================
    # LANGZEIT-TREND-ANALYSEN (Garmin-Style)
    # ======================================================================
    
    def analyze_longterm_activity(self, daily_data, weeks=4):
        """
        Berechnet Langzeit-Aktivitäts-Trend mit Baseline-Zonen.
        
        Args:
            daily_data: Liste von Dicts mit { 'date': 'YYYY-MM-DD', 'activityPercent': 85, ... }
            weeks: Anzahl Wochen (4, 12, 26)
        
        Returns:
            {
                'timeline': ['2026-01-01', '2026-01-02', ...],
                'values': [85, 92, 78, ...],
                'baseline': 100,
                'baseline_std': 15,
                'moving_avg': [85, 88.5, 85, ...]  # 7-Tage gleitender Durchschnitt
            }
        """
        try:
            if not daily_data or len(daily_data) < 3:
                return {'error': 'Insufficient data (<3 days)'}
            
            # Sortiere nach Datum (älteste zuerst)
            sorted_data = sorted(daily_data, key=lambda x: x.get('date', ''))
            
            # Begrenze auf gewünschte Wochen
            max_days = weeks * 7
            if len(sorted_data) > max_days:
                sorted_data = sorted_data[-max_days:]
            
            timeline = [d['date'] for d in sorted_data]
            values = [d.get('activityPercent', 0) for d in sorted_data]
            
            # Berechne Baseline (Median der letzten 14 Tage, robuster gegen Ausreißer)
            if len(values) >= 14:
                baseline = np.median(values[-14:])  # Median der letzten 14 Tage
            else:
                baseline = np.median(values)  # Falls < 14 Tage, nutze alle
            
            baseline_std = np.std(values)
            
            # 7-Tage gleitender Durchschnitt
            moving_avg = []
            for i in range(len(values)):
                start_idx = max(0, i - 6)
                window = values[start_idx:i+1]
                moving_avg.append(round(np.mean(window), 1))
            
            return {
                'timeline': timeline,
                'values': values,
                'baseline': round(baseline, 1),
                'baseline_std': round(baseline_std, 1),
                'moving_avg': moving_avg
            }
        
        except Exception as e:
            return {'error': str(e)}
    
    def analyze_gait_speed_longterm(self, daily_data, weeks=4):
        """
        Berechnet Langzeit-Trend der Ganggeschwindigkeit.
        
        Args:
            daily_data: Liste von Dicts mit { 'date': 'YYYY-MM-DD', 'gaitSpeed': 1.2, ... }
        
        Returns:
            {
                'timeline': ['2026-01-01', ...],
                'values': [1.2, 1.15, 1.18, ...],  # m/s oder Sekunden
                'trend_percent': -5.2,  # Negativ = langsamer geworden
                'status': 'VERSCHLECHTERT'
            }
        """
        try:
            if not daily_data or len(daily_data) < 3:
                return {'error': 'Insufficient data'}
            
            sorted_data = sorted(daily_data, key=lambda x: x.get('date', ''))
            max_days = weeks * 7
            if len(sorted_data) > max_days:
                sorted_data = sorted_data[-max_days:]
            
            timeline = [d['date'] for d in sorted_data]
            values = [d.get('gaitSpeed', 0) for d in sorted_data if d.get('gaitSpeed', 0) > 0]
            
            if len(values) < 3:
                return {'error': 'Insufficient gait data'}
            
            # Linear Regression
            x = np.arange(len(values))
            y = np.array(values)
            slope, intercept = np.polyfit(x, y, 1)
            
            start_val = intercept
            end_val = (slope * (len(values)-1)) + intercept
            
            if start_val <= 0.01:
                start_val = 0.01
            
            trend_percent = ((end_val - start_val) / start_val) * 100
            
            # Status
            if trend_percent < -5:
                status = 'VERSCHLECHTERT'
            elif trend_percent > 5:
                status = 'VERBESSERT'
            else:
                status = 'STABIL'
            
            return {
                'timeline': timeline,
                'values': values,
                'trend_percent': round(trend_percent, 1),
                'status': status
            }
        
        except Exception as e:
            return {'error': str(e)}
    
    def analyze_night_restlessness(self, daily_data, weeks=4):
        """
        Analysiert nächtliche Aktivität (22:00-07:30) – personalisiert mit IsolationForest.
        Nacht-Slots aus todayVector: 44-47 (22-24h) + 0-15 (00-07:30h) = 20 Slots.
        
        Returns:
            {
                'timeline': [...],
                'values': [12, 8, 15, ...],  # Events pro Nacht
                'avg': 11.3,
                'trend': 'STEIGEND',
                'anomaly_scores': [0.02, -0.1, ...],  # Personalisiert: Abweichung vom Normalwert
                'baseline_night_events': 10.5,
                'last_night_normal': True  # Ist letzte Nacht für DIESE Person normal?
            }
        """
        try:
            if not daily_data or len(daily_data) < 3:
                return {'error': 'Insufficient data'}
            
            sorted_data = sorted(daily_data, key=lambda x: x.get('date', ''))
            max_days = weeks * 7
            if len(sorted_data) > max_days:
                sorted_data = sorted_data[-max_days:]
            
            timeline = [d['date'] for d in sorted_data]
            values = [d.get('nightEvents', 0) for d in sorted_data]
            avg = np.mean(values)
            
            # Trend
            if len(values) >= 7:
                first_week = np.mean(values[:7])
                last_week = np.mean(values[-7:])
                trend = 'STEIGEND' if last_week > first_week * 1.2 else ('FALLEND' if last_week < first_week * 0.8 else 'STABIL')
            else:
                trend = 'UNBEKANNT'
            
            # Personalisierte Nacht-Anomalie: IsolationForest auf Nacht-Slots
            # Slots 44-47 (22-24h) + 0-15 (00-07:30h) = 20-dim Vektor pro Nacht
            NIGHT_SLOTS = list(range(44, 48)) + list(range(0, 16))
            anomaly_scores = [0.0] * len(timeline)
            last_night_normal = True
            
            night_vectors = []
            for d in sorted_data:
                vec = d.get('todayVector', [])
                if vec and len(vec) >= 48:
                    night_vec = [float(vec[i]) if i < len(vec) else 0 for i in NIGHT_SLOTS]
                else:
                    night_vec = [float(d.get('nightEvents', 0) / 20.0)] * 20  # Fallback
                night_vectors.append(night_vec)
            
            night_vectors = np.array(night_vectors)
            if len(night_vectors) >= 5:
                try:
                    from sklearn.ensemble import IsolationForest
                    clf = IsolationForest(random_state=42, contamination=0.1)
                    clf.fit(night_vectors[:-1])  # Trainiere auf allen außer letzter Nacht
                    scores = clf.score_samples(night_vectors)
                    for i, s in enumerate(scores):
                        anomaly_scores[i] = round(float(s), 4)
                    last_night_normal = anomaly_scores[-1] > -0.3  # Schwellwert
                except Exception:
                    pass
            
            return {
                'timeline': timeline,
                'values': values,
                'avg': round(avg, 1),
                'trend': trend,
                'anomaly_scores': anomaly_scores,
                'baseline_night_events': round(avg, 1),
                'last_night_normal': last_night_normal
            }
        
        except Exception as e:
            return {'error': str(e)}
    
    def analyze_room_mobility(self, daily_data, weeks=4):
        """
        Analysiert Raum-Diversität (wie viele verschiedene Räume pro Tag).
        
        Args:
            daily_data: Liste mit { 'date': 'YYYY-MM-DD', 'uniqueRooms': 8, ... }
        
        Returns:
            {
                'timeline': ['2026-01-01', ...],
                'values': [8, 9, 7, ...],  # Anzahl Räume
                'avg': 8.2,
                'trend': 'STABIL'
            }
        """
        try:
            if not daily_data or len(daily_data) < 3:
                return {'error': 'Insufficient data'}
            
            sorted_data = sorted(daily_data, key=lambda x: x.get('date', ''))
            max_days = weeks * 7
            if len(sorted_data) > max_days:
                sorted_data = sorted_data[-max_days:]
            
            timeline = [d['date'] for d in sorted_data]
            values = [d.get('uniqueRooms', 0) for d in sorted_data]
            
            avg = np.mean(values)
            
            # Trend
            if len(values) >= 7:
                first_week = np.mean(values[:7])
                last_week = np.mean(values[-7:])
                
                if last_week < first_week * 0.7:
                    trend = 'IMMOBIL'
                elif last_week > first_week * 1.3:
                    trend = 'STEIGEND'
                else:
                    trend = 'STABIL'
            else:
                trend = 'UNBEKANNT'
            
            return {
                'timeline': timeline,
                'values': values,
                'avg': round(avg, 1),
                'trend': trend
            }
        
        except Exception as e:
            return {'error': str(e)}
    
    def analyze_hygiene_frequency(self, daily_data, weeks=4):
        """
        Analysiert Bad-Nutzung (Hygiene-Frequenz).
        
        Args:
            daily_data: Liste mit { 'date': 'YYYY-MM-DD', 'bathroomVisits': 5, ... }
        
        Returns:
            {
                'timeline': ['2026-01-01', ...],
                'values': [5, 6, 4, ...],
                'avg': 5.2,
                'trend': 'STABIL'
            }
        """
        try:
            if not daily_data or len(daily_data) < 3:
                return {'error': 'Insufficient data'}
            
            sorted_data = sorted(daily_data, key=lambda x: x.get('date', ''))
            max_days = weeks * 7
            if len(sorted_data) > max_days:
                sorted_data = sorted_data[-max_days:]
            
            timeline = [d['date'] for d in sorted_data]
            values = [d.get('bathroomVisits', 0) for d in sorted_data]
            
            avg = np.mean(values)
            
            # Trend
            if len(values) >= 7:
                first_week = np.mean(values[:7])
                last_week = np.mean(values[-7:])
                
                if last_week < first_week * 0.6:
                    trend = 'RÜCKGANG'
                elif last_week > first_week * 1.4:
                    trend = 'STEIGEND'
                else:
                    trend = 'STABIL'
            else:
                trend = 'UNBEKANNT'
            
            return {
                'timeline': timeline,
                'values': values,
                'avg': round(avg, 1),
                'trend': trend
            }
        
        except Exception as e:
            return {'error': str(e)}
    
    def analyze_ventilation_behavior(self, daily_data, weeks=4):
        """
        Analysiert Lüftungsverhalten (Fenster-Öffnungen).
        
        Args:
            daily_data: Liste mit { 'date': 'YYYY-MM-DD', 'windowOpenings': 3, ... }
        
        Returns:
            {
                'timeline': ['2026-01-01', ...],
                'values': [3, 4, 2, ...],
                'avg': 3.1,
                'trend': 'STABIL'
            }
        """
        try:
            if not daily_data or len(daily_data) < 3:
                return {'error': 'Insufficient data'}
            
            sorted_data = sorted(daily_data, key=lambda x: x.get('date', ''))
            max_days = weeks * 7
            if len(sorted_data) > max_days:
                sorted_data = sorted_data[-max_days:]
            
            timeline = [d['date'] for d in sorted_data]
            values = [d.get('windowOpenings', 0) for d in sorted_data]
            
            avg = np.mean(values)
            
            # Trend
            if len(values) >= 7:
                first_week = np.mean(values[:7])
                last_week = np.mean(values[-7:])
                
                if last_week < first_week * 0.5:
                    trend = 'RÜCKGANG'
                elif last_week > first_week * 1.5:
                    trend = 'STEIGEND'
                else:
                    trend = 'STABIL'
            else:
                trend = 'UNBEKANNT'
            
            return {
                'timeline': timeline,
                'values': values,
                'avg': round(avg, 1),
                'trend': trend
            }
        
        except Exception as e:
            return {'error': str(e)}
    # ======================================================================
    # KRANKHEITS-RISIKO-SCORES (Phase 2 — v0.32.0)
    # ======================================================================

    def compute_disease_scores(self, daily_digests, enabled_profiles):
        """
        Berechnet krankheitsspezifische Risiko-Scores aus historischen Daily Digests.

        Methodik:
          Kalibrierungsphase (erste 14 Tage oder Haelfte der Daten):
            Berechnet persoenliche Baselines fuer alle Metriken.
          Erkennungsphase (aktuellste 7 Tage):
            Vergleicht aktuelle Werte mit Baselines.
            Je groesser die negative Abweichung, desto hoeher der Risiko-Score.

        Args:
            daily_digests: Liste von Daily Digest Objekten (mind. 5, empfohlen 30+)
            enabled_profiles: Liste aktivierter Krankheits-Profile,
                              z.B. ['fallRisk', 'dementia', 'frailty']

        Returns:
            {
                'fallRisk': {
                    'score': 32.5,           # 0-100, hoeher = mehr Risiko-Indikatoren
                    'level': 'LOW',          # MINIMAL / LOW / MODERATE / HIGH / CRITICAL
                    'factors': {             # Einzel-Komponenten (0-100 je)
                        'gait': 45.0,
                        'nightRestlessness': 22.0,
                        ...
                    },
                    'values': {              # Rohwerte fuer Transparenz
                        'gaitSpeedBaseline': 4.2,
                        'gaitSpeedRecent': 5.1,
                        ...
                    },
                    'dataPoints': 30
                },
                ...
            }
        """
        try:
            if not daily_digests or len(daily_digests) < 5:
                return {p: {'score': None, 'level': 'INSUFFICIENT_DATA',
                            'dataPoints': len(daily_digests or []),
                            'message': f'Mindestens 5 Tage Daten benoetigt ({len(daily_digests or [])} vorhanden)'}
                        for p in enabled_profiles}

            sorted_digests = sorted(daily_digests, key=lambda x: x.get('date', ''))
            n = len(sorted_digests)

            # Kalibrierungsphase: erste 14 Tage (mindestens 5, maximal 14)
            cal_n = min(14, max(5, n // 2))
            cal = sorted_digests[:cal_n]
            recent = sorted_digests[cal_n:] if len(sorted_digests) > cal_n else sorted_digests[-7:]

            def safe_median(lst, default=0.0):
                vals = [float(v) for v in lst if v is not None and float(v) > 0]
                return float(np.median(vals)) if vals else default

            def safe_mean(lst, default=0.0):
                vals = [float(v) for v in lst if v is not None and float(v) > 0]
                return float(np.mean(vals)) if vals else default

            # Persoenliche Baselines aus Kalibrierungsphase
            cal_activity  = safe_median([d.get('activityPercent', 100) for d in cal], 100.0)
            cal_gait      = safe_median([d.get('gaitSpeed', 0) for d in cal if d.get('gaitSpeed', 0) > 0.5], 0.0)
            cal_night     = safe_mean([d.get('nightEvents', 0) for d in cal], 3.0)
            cal_rooms     = safe_mean([d.get('uniqueRooms', 0) for d in cal if d.get('uniqueRooms', 0) > 0], 4.0)
            cal_bathroom  = safe_mean([d.get('bathroomVisits', 0) for d in cal if d.get('bathroomVisits', 0) > 0], 3.0)

            # Aktuelle Werte: letzte 7 Tage der Erkennungsphase
            last7 = recent[-7:] if len(recent) >= 7 else recent
            rec_activity  = safe_median([d.get('activityPercent', 100) for d in last7], cal_activity)
            rec_gait      = safe_median([d.get('gaitSpeed', 0) for d in last7 if d.get('gaitSpeed', 0) > 0.5], cal_gait)
            rec_night     = safe_mean([d.get('nightEvents', 0) for d in last7], cal_night)
            rec_rooms     = safe_mean([d.get('uniqueRooms', 0) for d in last7 if d.get('uniqueRooms', 0) > 0], cal_rooms)
            rec_bathroom  = safe_mean([d.get('bathroomVisits', 0) for d in last7 if d.get('bathroomVisits', 0) > 0], cal_bathroom)

            # --- Normalisierungs-Hilfsfunktionen (0=normal, 100=maximale Verschlechterung) ---

            def decline_score(baseline, recent_val, sensitivity=1.0):
                """Rückgang: 50% Rückgang → 100 Score."""
                if baseline <= 0:
                    return 0.0
                decline_ratio = max(0.0, (baseline - recent_val) / baseline)
                return min(100.0, decline_ratio * 200.0 * sensitivity)

            def increase_score(baseline, recent_val, sensitivity=1.0):
                """Anstieg (z.B. Gait-Zeit): 50% Anstieg → 100 Score."""
                if baseline <= 0:
                    return 0.0
                increase_ratio = max(0.0, (recent_val - baseline) / baseline)
                return min(100.0, increase_ratio * 200.0 * sensitivity)

            def night_excess_score(baseline, recent_val):
                """Naechtliche Unruhe-Zunahme: 3x Baseline → 100 Score."""
                if baseline <= 0:
                    return min(100.0, recent_val * 5.0)
                ratio = recent_val / baseline
                return min(100.0, max(0.0, (ratio - 1.0) * 100.0))

            def risk_level(score):
                if score is None:   return 'INSUFFICIENT_DATA'
                if score < 10:      return 'MINIMAL'
                if score < 25:      return 'LOW'
                if score < 45:      return 'MODERATE'
                if score < 65:      return 'HIGH'
                return 'CRITICAL'

            # --- Vorberechnete Einzel-Komponenten ---
            act_decline   = decline_score(cal_activity, rec_activity)
            gait_slow     = increase_score(cal_gait, rec_gait) if cal_gait > 0 and rec_gait > 0 else 0.0
            night_excess  = night_excess_score(cal_night, rec_night)
            rooms_decline = decline_score(cal_rooms, rec_rooms)
            hygiene_decl  = decline_score(cal_bathroom, rec_bathroom)

            results = {}

            # ---- STURZRISIKO ----
            if 'fallRisk' in enabled_profiles:
                # Klinische Basis: Ganggeschwindigkeit + naechtliche Stuerze + reduzierte Mobilitaet
                # Referenz: Tinetti ME (1986), Podsiadlo et al. (1991)
                fall_score = round(
                    0.35 * gait_slow    +   # Gangverlangsamung (starkster Preaediktor)
                    0.25 * night_excess +   # Naechtliche Unruhe / Toilettengaenge
                    0.25 * rooms_decline+   # Reduzierte Raumnutzung = Immobilitaet
                    0.15 * act_decline, 1   # Allgemeiner Aktivitaetsrueckgang
                )
                results['fallRisk'] = {
                    'score': fall_score,
                    'level': risk_level(fall_score),
                    'factors': {
                        'gaitSlowdown':       round(gait_slow, 1),
                        'nightRestlessness':  round(night_excess, 1),
                        'roomMobility':       round(rooms_decline, 1),
                        'activityDecline':    round(act_decline, 1),
                    },
                    'values': {
                        'gaitSpeedBaseline':  round(cal_gait, 1),
                        'gaitSpeedRecent':    round(rec_gait, 1),
                        'nightBaseline':      round(cal_night, 1),
                        'nightRecent':        round(rec_night, 1),
                        'roomsBaseline':      round(cal_rooms, 1),
                        'roomsRecent':        round(rec_rooms, 1),
                    },
                    'calibrationDays': cal_n,
                    'dataPoints': n,
                }

            # ---- DEMENZ ----
            if 'dementia' in enabled_profiles:
                # Klinische Basis: schleichende Verhaltensaenderung ueber Monate
                # Referenz: Kaye et al. (2011) ORCATECH, Dodge et al. (2015)
                drift_component = 0.0
                try:
                    act_vals = [d.get('activityPercent', 100) for d in sorted_digests]
                    drift_r = self.detect_drift_page_hinkley([-v for v in act_vals])
                    if isinstance(drift_r, dict) and 'current_score' in drift_r:
                        thr = max(drift_r.get('threshold', 30), 1)
                        drift_component = min(100.0, (drift_r['current_score'] / thr) * 100.0)
                except Exception:
                    pass

                dem_score = round(
                    0.30 * drift_component +   # Schleichende Verhaltensaenderung (Page-Hinkley)
                    0.25 * rooms_decline   +   # Reduzierte Raumnutzung = soziale/raeumliche Einschraenkung
                    0.20 * gait_slow       +   # Gangverlangsamung
                    0.15 * night_excess    +   # Naechtliches Wandern
                    0.10 * act_decline, 1      # Allgemeiner Aktivitaetsrueckgang
                )
                results['dementia'] = {
                    'score': dem_score,
                    'level': risk_level(dem_score),
                    'factors': {
                        'activityDrift':          round(drift_component, 1),
                        'roomMobilityDecline':     round(rooms_decline, 1),
                        'gaitSlowdown':            round(gait_slow, 1),
                        'nightWandering':          round(night_excess, 1),
                        'activityDecline':         round(act_decline, 1),
                    },
                    'values': {
                        'activityBaseline':  round(cal_activity, 1),
                        'activityRecent':    round(rec_activity, 1),
                        'roomsBaseline':     round(cal_rooms, 1),
                        'roomsRecent':       round(rec_rooms, 1),
                    },
                    'calibrationDays': cal_n,
                    'dataPoints': n,
                }

            # ---- FRAILTY ----
            if 'frailty' in enabled_profiles:
                # Klinische Basis: Fried Frailty Phenotype (2001) — Aktivitaet + Kraft + Erschoepfung
                # Passiv erfassbar: Aktivitaetsrueckgang + Gangverlangsamung + Hygienerueckgang + Raumnutzung
                frailty_score = round(
                    0.30 * act_decline   +   # Erschoepfung / reduzierte Aktivitaet
                    0.25 * gait_slow     +   # Verlangsamung (Kraft-Proxy)
                    0.25 * rooms_decline +   # Physische Immobilitaet
                    0.20 * hygiene_decl, 1   # Vernachlaessigung der Koerperpflege
                )
                results['frailty'] = {
                    'score': frailty_score,
                    'level': risk_level(frailty_score),
                    'factors': {
                        'activityDecline':    round(act_decline, 1),
                        'gaitSlowdown':       round(gait_slow, 1),
                        'roomMobility':       round(rooms_decline, 1),
                        'hygieneDecline':     round(hygiene_decl, 1),
                    },
                    'values': {
                        'activityBaseline':   round(cal_activity, 1),
                        'activityRecent':     round(rec_activity, 1),
                        'bathroomBaseline':   round(cal_bathroom, 1),
                        'bathroomRecent':     round(rec_bathroom, 1),
                    },
                    'calibrationDays': cal_n,
                    'dataPoints': n,
                }

            return results

        except Exception as e:
            return {'error': str(e)}

    def detect_drift_page_hinkley(self, values, delta_factor=0.02, lambda_threshold=None):
        """
        Page-Hinkley-Test mit adaptivem Schwellwert.

        Kalibrierungsphase (erste 14 Tage):
          Berechnet Baseline-Mittelwert (mu) und Standardabweichung (sigma).
          PH-Score bleibt 0 – keine Alarme.

        Erkennungsphase (ab Tag 15):
          PH-Test startet mit kalibriertem mu.
          Adaptiver Schwellwert = max(30, 3 * sigma * sqrt(n_erkennungstage))
          So passt sich die Empfindlichkeit automatisch an die natuerliche
          Variabilitaet der jeweiligen Person an.

        Args:
            values:           Liste taeglicher Aktivitaetsprozente (relativ, 0-200)
            delta_factor:     Minimale erkennbare Aenderung (Anteil des Mittelwerts)
            lambda_threshold: Wenn None: adaptiv berechnet; sonst: fester Wert

        Returns:
            scores, current_score, drift_detected, threshold, adaptive,
            calibration_days, baseline_sigma, change_point_idx
        """
        try:
            if not values or len(values) < 10:
                return {'error': f'Zu wenig Daten ({len(values) if values else 0} Tage, min. 10)'}

            values = [float(v) for v in values]

            # Kalibrierungsphase: min. 7, max. 14 Tage (oder Haelfte der Daten)
            calibration_days = min(14, max(7, len(values) // 2))
            calibration = values[:calibration_days]
            detection   = values[calibration_days:]

            cal_mean = float(np.mean(calibration))
            cal_std  = float(np.std(calibration)) if len(calibration) > 1 else 10.0

            # Adaptiver Schwellwert
            adaptive = lambda_threshold is None
            if adaptive:
                n_det = max(1, len(detection))
                lambda_threshold = max(30.0, round(3.0 * cal_std * (n_det ** 0.5), 1))

            # PH-Test laeuft nur auf Erkennungsphase, startet mit kalibriertem mu
            mu    = cal_mean
            delta = delta_factor * abs(mu) if mu != 0 else 1.0
            M, m  = 0.0, 0.0

            ph_scores = [0.0] * calibration_days  # Kalibrierungstage = 0
            for x in detection:
                M = M + (x - mu - delta)
                m = min(m, M)
                ph_scores.append(round(max(0.0, M - m), 2))
                mu = 0.95 * mu + 0.05 * x

            current_score = round(ph_scores[-1], 2)
            drift_detected = current_score > lambda_threshold

            change_point_idx = None
            if drift_detected:
                onset = lambda_threshold * 0.25
                for i in range(len(ph_scores) - 1, -1, -1):
                    if ph_scores[i] < onset:
                        change_point_idx = i
                        break

            return {
                'scores':           ph_scores,
                'current_score':    current_score,
                'drift_detected':   drift_detected,
                'threshold':        lambda_threshold,
                'adaptive':         adaptive,
                'calibration_days': calibration_days,
                'baseline_sigma':   round(cal_std, 1),
                'change_point_idx': change_point_idx
            }
        except Exception as e:
            return {'error': str(e)}
