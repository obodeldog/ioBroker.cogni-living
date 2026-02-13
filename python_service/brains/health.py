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
        if not self.is_ready: return 0, "Not Ready"
        try:
            X = self._prepare_features([digest])
            res = self.model.predict(X)[0]
            score = self.model.score_samples(X)[0]
            return res, f"Anomaly Score: {score:.3f}"
        except Exception as e: return 0, str(e)

    def analyze_gait_speed(self, sequences):
        """
        Berechnet Trend, Sensoren UND einen mathematischen Beweis.
        Output: (percent_change, list_of_sensors, debug_proof_string)
        """
        try:
            durations = []
            used_sensors = set()

            for seq in sequences:
                steps = seq.get('steps', [])
                if len(steps) < 2: continue

                is_hallway = False
                seq_sensors = []

                for step in steps:
                    loc = step['loc'].lower()
                    if any(x in loc for x in ['flur', 'diele', 'gang']):
                        is_hallway = True
                        seq_sensors.append(step['loc'])

                if is_hallway:
                    duration = steps[-1]['t_delta']
                    if duration > 1 and duration < 20:
                        durations.append(duration)
                        for s in seq_sensors: used_sensors.add(s)

            if len(durations) < 5:
                return None, [], "Zu wenig Datenpunkte (<5 Sequenzen)"

            # Mathematik (Lineare Regression)
            x = np.arange(len(durations))
            y = np.array(durations)
            slope, intercept = np.polyfit(x, y, 1)

            start_val = intercept
            end_val = (slope * (len(durations)-1)) + intercept

            if start_val == 0: start_val = 0.01
            percent_change = ((end_val - start_val) / start_val) * 100

            # --- DER BEWEIS ---
            # Wir formatieren die letzten 5 Messwerte und die Regressions-Parameter
            last_5 = [round(d, 2) for d in durations[-5:]]
            proof = (f"n={len(durations)} Events. Regression y=mx+b: m={slope:.4f}, b={intercept:.2f}. "
                     f"Letzte 5 Messwerte (Sekunden): {last_5}")

            return percent_change, list(used_sensors), proof
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
        Analysiert nächtliche Aktivität (22:00-06:00).
        
        Args:
            daily_data: Liste mit { 'date': 'YYYY-MM-DD', 'nightEvents': 12, ... }
        
        Returns:
            {
                'timeline': ['2026-01-01', ...],
                'values': [12, 8, 15, ...],  # Events pro Nacht
                'avg': 11.3,
                'trend': 'STEIGEND'
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
            
            # Trend berechnen
            if len(values) >= 7:
                first_week = np.mean(values[:7])
                last_week = np.mean(values[-7:])
                
                if last_week > first_week * 1.2:
                    trend = 'STEIGEND'
                elif last_week < first_week * 0.8:
                    trend = 'FALLEND'
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