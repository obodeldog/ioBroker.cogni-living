# PROJEKT_STATUS — cogni-living (NUUKANNI / AURA)

> **Übergabeprotokoll für die nächste Sitzung**
> Letzte Aktualisierung: 07.03.2026 | Aktuelle Version: **v0.30.81**

---

## ✅ Aktueller Stand — Was haben wir in dieser Sitzung abgeschlossen?

| # | Ergebnis | Version |
|---|----------|---------|
| 1 | **Nacht-Sensor Checkbox**: Sensor-Tabelle hat neue Spalte "🌙 Nacht?" — Bad, WC, Schlafzimmer können markiert werden und werden für die Tagesbeginn-Erkennung ignoriert | v0.30.79 |
| 2 | **Dynamische Tagesbeginn-Erkennung**: KI-Tagesbericht startet nicht mehr starr um 08:00 Uhr, sondern bei der ersten Bewegung nach 05:00 aus einem Nicht-Nacht-Sensor-Raum. Fallback 08:00 bleibt | v0.30.79 |
| 3 | **Bug-Fix "seit 08:00 Uhr"**: PWA zeigte um 07:40 Uhr "Bisher keine Aktivität seit 08:00 Uhr" — Text durch generische Formulierung ersetzt | v0.30.79 |
| 4 | **Security-Alarm Spam behoben**: IsolationForest war nie trainiert → Fallback-Score 0.1 > Threshold 0.05 → jede Analyse löste Alarm aus. Ohne trainiertes Modell werden jetzt **keine Alarme** mehr gesendet | v0.30.80 |
| 5 | **Security-Alarm Cooldown**: Auch wenn ein echter Alarm ausgelöst wird, max. 1 Pushover pro Stunde. Alarm-Text sagt jetzt "Aktivitätsmuster um 15:14 Uhr ist leicht ungewöhnlich (Score: 23%)" statt rohem Zahlenwert | v0.30.80 |
| 6 | **Briefing-Timing-Bug behoben**: Pushover-Briefing kam um 03:00 Uhr statt 08:00 Uhr. Ursache: UTC-Konvertierungs-Fehler in RecurrenceRule. Ersetzt durch minütlichen Interval-Check der lokale Systemzeit prüft — kein UTC-Problem mehr möglich | v0.30.80 |
| 7 | **Zeitstempel in Admin UI**: NACHT-PROTOKOLL und TAGES-SITUATION Kacheln zeigen jetzt "Stand: 06.03. 08:30 Uhr" — klar ersichtlich wann der KI-Bericht zuletzt erzeugt wurde | v0.30.81 |
| 8 | **Zeitstempel in PWA**: Tages- und Nacht-Kachel in der mobilen App zeigen ebenfalls den Bericht-Zeitstempel | v0.30.80 |
| 9 | **Aktivitäts-Belastung Diagnose**: AreaChart durch BarChart ersetzt + Debug-Zeile "X Tage geladen | Wertebereich: Y%–Z%" sichtbar — ermöglicht sofortige Diagnose ob Datenproblem oder Darstellungsproblem vorliegt | v0.30.81 |
| 10 | **todayVector Fallback**: Wenn `rawEventLog` leer ist (häufigste Ursache für 0%-Werte), berechnet `saveDailyHistory` den Aktivitätsvektor jetzt direkt aus `eventHistory` — ab heute Nacht schreiben History-Dateien korrekte Daten | v0.30.80 |

---

## 🟢 Funktionierende Basis — Was läuft bereits fehlerfrei?

### Backend (Node.js + Python)
- **Bewegungserkennung & Sensor-Fusion** — alle PIR-Sensoren werden ausgewertet
- **Schlafanalyse** — Nacht-Events (22:00–08:00), Bad-Frequenz, Heuristik
- **IsolationForest-Anomalie-Erkennung** — Tag UND Nacht, personalisiertes Modell
- **KI-Berichte via Gemini Pro** — dynamischer Tagesbeginn, konfigurierbarer Kontext, Fließtext
- **Inaktivitäts-Alarm** — konfigurierbarer Schwellwert, Pushover-Benachrichtigung
- **Langzeit-Trendanalyse** — lineare Regression über 7/30/180 Tage
- **Page-Hinkley Drift-Erkennung** — adaptiver Schwellwert, Kalibrierungsphase 14 Tage
- **Briefing-Scheduler** — tagliche Pushover-Zusammenfassung zur konfigurierten Lokalzeit
- **Cloudflare Tunnel** — stabile Verbindung mit Auto-Restart, Healthcheck

### Admin UI (React/TypeScript)
- **Health Dashboard** — Tages-/Nacht-Status mit Zeitstempel, Bad-Nutzung, Frischluft, Raum-Charts
- **7-Tage-Übersicht** — mit KI-Zusammenfassung pro Tag
- **Langzeit-Trends** — BarChart mit Debug-Zeile, Ganggeschwindigkeit, Schlaf, Raum-Mobilität, Bad, Frischluft
- **Drift-Monitor** — adaptiver Schwellwert, zeitfenster-unabhängig
- **Sensor-Verwaltung** — inkl. Nacht-Sensor-Checkbox für dynamische Tageszeit-Erkennung

### PWA (Mobile Family App)
- **"Auf einen Blick"-Ansicht** — Bad, Frischluft, Letzte Aktivität
- **Tages-Status + Nacht-Kachel** — beide mit Bericht-Zeitstempel sichtbar
- **Sparkline 7 Tage** — JS-Touch-Tooltip, funktioniert auf Mobilgeräten
- **KI Analyse on Demand** — Polling bis Analyse abgeschlossen

### Alarmierung
- **Security-Alarme** — nur wenn IsolationForest trainiert, max. 1 Alarm/Stunde, verständlicher Text
- **Inaktivitäts-Alarm** — läuft unabhängig, Pushover

---

## 🔴 Offene Baustellen — Bekannte Probleme & bewusste Verschiebungen

| Priorität | Problem | Notiz |
|-----------|---------|-------|
| 🔴 Hoch | **Aktivitäts-Belastung Chart zeigt möglicherweise 0%** | Erst nach heute Nacht (23:59) prüfen ob der todayVector-Fallback greift. Debug-Zeile im Chart zeigt sofort ob Daten vorhanden sind |
| 🔴 Hoch | **Security IsolationForest nie trainiert** | Kein manueller Button sichtbar — Training läuft automatisch nach ~3 Tagen Daten. Bis dahin: keine Security-Alarme (gewollt) |
| 🟡 Mittel | **Nacht-Sensor-Checkbox noch nicht konfiguriert** | Marc muss in Admin → Einstellungen → Sensoren die Bad/WC/Schlafzimmer-Sensoren als "Nacht?" markieren — sonst bleibt Tagesbeginn auf 08:00 Fallback |
| 🟡 Mittel | **Drift-Monitor**: Score über Schwelle ("Möglicher Drift") | Normal in der Einlaufphase. Beobachten bis ca. Woche 6–8 |
| 🟡 Mittel | **AURA MONITOR Versionsanzeige** zeigt "v0.30.68" | Hartkodiert in HealthTab.tsx — noch nicht angepasst |
| 🟡 Mittel | **Graph-Brain zeigt 100% überall** | Normal bei wenig Daten — jeder Weg wird nur 1x gegangen = 100%. Normalisiert sich über Wochen |
| 🟢 Niedrig | **Cloudflare-Link** erscheint nicht immer sofort | Tab-Wechsel + Aktualisieren als Workaround |
| 🔲 Geplant | **Fourier-Analyse** für zirkadianen Rhythmus | Geplant, kein Zeitdruck |

---

## 🎯 Nächster logischer Schritt — Exakte Aufgabe für die nächste Sitzung

### Schritt 1 — Sofort nach Adapter-Neustart prüfen (heute Nacht)
**Aktivitäts-Belastung**: Morgen früh die Debug-Zeile im Langzeit-Trends-Chart lesen:
- Wenn "Wertebereich: 0%–0%" → Datenproblem besteht noch (dann tiefer debuggen)
- Wenn "Wertebereich: 45%–180%" → Daten sind da, BarChart sollte sichtbare Balken zeigen

### Schritt 2 — Nacht-Sensoren konfigurieren (5 Minuten)
In Admin → Einstellungen → Sensoren: Bei allen Bad-, WC- und Schlafzimmer-Sensoren die "🌙 Nacht?"-Checkbox aktivieren. Erst dann greift die dynamische Tagesbeginn-Erkennung.

### Option A — Drift-Reset-Button (30 Min)
Reset-Button in Admin UI einbauen damit der Drift-Score nach der Einlaufphase manuell zurückgesetzt werden kann ohne Code-Eingriff.

### Option B — Fourier-Analyse (3–4 Stunden)
Erkennt ob sich der Tagesrhythmus der Person verschiebt (früher aufstehen, später schlafen).

---

## 📁 Wichtige Dateien

| Datei | Zweck |
|-------|-------|
| `src/lib/pwa_server.js` | PWA-Backend: Datenaggregation, Sparkline, Touch-Tooltips, Timestamps |
| `src/lib/ai_agent.js` | Gemini-Prompts mit dynamischem Tagesbeginn + `livingContext` |
| `src/lib/scheduler.js` | Briefing-Scheduler (Interval-basiert, lokale Systemzeit) |
| `src/lib/python_bridge.js` | Security-Alarm mit Cooldown + verständlichem Text |
| `src/main.js` | Adapter-Einstiegspunkt, todayVector-Fallback aus eventHistory |
| `python_service/brains/health.py` | IsolationForest, Page-Hinkley |
| `python_service/brains/security.py` | Security-Anomalie: kein Alarm ohne trainiertes Modell |
| `src-admin/src/components/settings/SensorList.tsx` | Sensor-Tabelle mit isNightSensor-Checkbox |
| `src-admin/src/components/tabs/HealthTab.tsx` | Admin Health Dashboard mit Bericht-Zeitstempeln |
| `src-admin/src/components/tabs/LongtermTrendsView.tsx` | BarChart + Debug-Zeile für Aktivitäts-Belastung |
| `io-package.json` | ioBroker-Manifest — **Versionsnummer hier** (nicht package.json!) |

---

## 🔬 Algorithmen-Status (Health-Säule)

| Zeile | Algorithmus | Status |
|-------|-------------|--------|
| 1–8 | Sensor-Fusion, Schlaf, Aktivität, Bad, Frischluft | ✅ Produktiv |
| 9–10 | KI-Berichte (Gemini, dynamischer Tagesbeginn, Nacht-Sensor-Filter) | ✅ Produktiv |
| 11 | Inaktivitäts-Alarm | ✅ Produktiv |
| 12–13 | Lineare Regression + LLM-Drift | ✅ Produktiv |
| 14 | Aktivitäts-Normalisierung (persönlicher Median) | ⚠️ Daten-Fallback läuft, Validierung morgen |
| 15 | Fourier-Analyse (Zirkadianer Rhythmus) | 🔲 Geplant |
| 16 | Page-Hinkley Drift-Erkennung (adaptiver Schwellwert) | ✅ Produktiv (Einlaufphase) |
| 17 | Security IsolationForest Anomalie-Erkennung | ⏳ Wartet auf Trainingsdaten (~3 Tage) |

---

## ⚠️ Wichtige Lernpunkte für zukünftige Sitzungen

| Thema | Merke |
|-------|-------|
| **Versionierung** | Immer **beide** Dateien: `package.json` UND `io-package.json`. ioBroker liest aus `io-package.json`! |
| **Build-Workflow** | `src/lib/` → `lib/` (Backend-Copy). `src-admin/` → `npm run build` → `admin/` (React-Build). Beides vor Commit! |
| **`src/` ist gitignored** | Nur `lib/`, `main.js`, `admin/` sind tracked — nicht `src/` direkt |
| **KI-Kontext** | `livingContext` = UI-Feld für Gemini-Prompts. `aiContext` gibt es nicht im UI → nie verwenden |
| **Security-Alarme** | Kein trainiertes Modell = keine Alarme (gewollt). Graph-Brain 100% bei wenig Daten = normal |
| **Aktivitäts-Chart** | Debug-Zeile "Wertebereich" zeigt sofort ob Daten-Problem oder Darstellungs-Problem vorliegt |
| **Briefing-Timing** | RecurrenceRule niemals für lokale Zeit nutzen — immer Interval-Check mit `getHours()`/`getMinutes()` |
