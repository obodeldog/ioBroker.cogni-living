# PROJEKT_STATUS - cogni-living (NUUKANNI / AURA)

> **Übergabeprotokoll für die nächste Sitzung**
> Letzte Aktualisierung: 07.03.2026 | Aktuelle Version: **v0.30.94**

---

## ✅ Aktueller Stand - Was haben wir in dieser Sitzung abgeschlossen?

| # | Ergebnis | Version |
|---|----------|---------|
| 1 | **Architektur-Refactoring: Typ-basierte Fenster/Tür-Erkennung** — `saveDailyHistory` filtert nach `e.type === 'door'` statt Keyword-Liste. Snapshot speichert `windowOpenCounts: { sensorName: anzahl }`. Admin UI liest direkt aus Snapshot | v0.30.87/90 |
| 2 | **Frischluft-Bug behoben** — v0.30.87 hatte fälschlich `type === 'contact'` statt `type === 'door'` (so heißt der Typ in SensorList). In v0.30.90 korrigiert | v0.30.90 |
| 3 | **Wochentag im Tooltip** — Alle Chart-Kacheln zeigen Datum + Wochentag (Mo/Di/.../So). Zeitzonen-sichere Berechnung | v0.30.88 |
| 4 | **Zeitraum in jede Kachel-Subtitle** — Nacht-Unruhe `· 22–08 Uhr`, alle anderen `· 0–24 Uhr` | v0.30.89 |
| 5 | **Fundament vollständig sauber: Nacht-Unruhe + Bad-Nutzung** — `isNightSensor`-Flag statt `includes('schlaf')`, neue `isBathroomSensor`-Checkbox statt `/bad|wc|toilet/`. Snapshot enthält `nightMotionCount`, `bathroomMinutes`, `nightSensorLocations`, `bathroomLocations` | v0.30.91 |
| 6 | **SensorList komplett überarbeitet** — Alle 6 Checkbox-Spalten mit farbigen Icons (aktiv) / ausgegraut (inaktiv). `stickyHeader` — Kopfzeile bleibt beim Scrollen sichtbar. `tableLayout: fixed` — volle Breite ausgenutzt. Löschen-Button als rotes Icon | v0.30.92/93 |
| 7 | **Debug-Zeile entfernt** — "X Tage geladen | Wertebereich..." aus Aktivitätsbelastung entfernt | v0.30.94 |
| 8 | **Ganggeschwindigkeit grundlegend korrigiert** — Fehler war: `percent_change` (%) wurde als Geschwindigkeit gespeichert → völlig unplausible Werte. Jetzt: **Median der Flur-Transitzeiten in Sekunden** (z.B. 8.5 Sek.). Höher = langsamer = mögliche Verschlechterung. Flur-Erkennung nutzt `isHallway`-Flag mit Keyword-Fallback | v0.30.94 |

---

## 🏗️ Funktionierende Basis - Was läuft bereits fehlerfrei?

### Architektur-Prinzipien (vollständig umgesetzt)
| Sensor-Typ | Erkennung |
|---|---|
| Fenster/Türen | `e.type === 'door'` |
| Nacht-Räume | `isNightSensor`-Checkbox in Config |
| Bad-Räume | `isBathroomSensor`-Checkbox in Config |
| Flur-Räume | `isHallway`-Checkbox in Config |
| Kein Keyword-Matching mehr für Sensor-Kategorisierung | ✅ |

### Backend (Node.js + Python)
- **Bewegungserkennung & Sensor-Fusion** — alle PIR-Sensoren werden ausgewertet
- **Schlafanalyse** — Nacht-Events (22:00–08:00), Bad-Frequenz, Heuristik
- **IsolationForest-Anomalie-Erkennung** — Tag UND Nacht, personalisiertes Modell
- **Security-Erkennung** — kein Fallback-Alarm-Spam, 1h Cooldown, verständliche Meldungen
- **Dynamische Tagesbeginn-Erkennung** — erste Bewegung in Nicht-Nacht-Sensor-Raum nach 05:00, Cap 08:00
- **Auto-Training IsolationForest** — startet nach saveDailyHistory wenn ≥3 Tage vorhanden
- **Briefing-Scheduler** — Pushover kommt korrekt zur konfigurierten Uhrzeit
- **saveDailyHistory** — vollständiger Snapshot: todayVector, roomHistory, geminiNight/DayTs, windowOpenCounts, nightMotionCount, bathroomMinutes, nightSensorLocations, bathroomLocations, gaitSpeed, eventHistory
- **Ganggeschwindigkeit** — Median der Flur-Transitzeiten in Sekunden (physikalisch plausibel)

### Admin UI (React)
- **Sensor-Konfigurationstabelle** — Icons für alle Spalten, stickyHeader, volle Breite
- **Alle Mini-Charts** — Garmin-Style: farbige Balken + anthrazite Trendlinie
- **Wochentag im Tooltip** — alle Kacheln
- **Zeitraum-Anzeige** — alle Kacheln in Subtitle-Zeile
- **Frischluft-Tooltip** — pro Sensor mit Häufigkeit (typ-basiert)
- **Raum-Mobilität-Tooltip** — Top-5 aktive Räume mit "X min aktiv"
- **Aktivitätsbelastung** — ohne Debug-Zeile, sauber

---

## 🔧 Offene Baustellen

| Priorität | Problem | Beschreibung |
|-----------|---------|--------------|
| 🟡 Mittel | **Ganggeschwindigkeit: Erste echte Daten abwarten** | Die Korrektur (avg_duration statt percent_change) wirkt erst nach der nächsten ANALYZE_GAIT Auswertung. Alte Snapshot-Werte sind percent_change-Werte und werden in der Chart-Übersicht noch falsch dargestellt bis neue Analysen laufen |
| 🟡 Mittel | **isBathroomSensor / isNightSensor noch nicht gesetzt** | Nutzer muss einmalig in Admin → Sensoren die neuen Checkboxen für Bad/WC und Schlafzimmer setzen, damit die typ-basierte Erkennung greift |
| 🟢 Klein | **Ganggeschwindigkeit: analyze_gait_speed_longterm** nutzt `d.get('gaitSpeed', 0)` — alte Snapshots mit percent_change-Werten verfälschen noch den Longterm-Trend. Löst sich automatisch nach ~7 Tagen neuer Daten |
| 🔵 Idee | **Wochenzusammenfassung per Pushover** — Jeden Sonntag automatisch: Aktivität, unruhige Nächte, Trend. Echter Pflegemehrwert |
| 🔵 Idee | **Tagesvergleich-Ansicht** — "Heute vs. gleicher Wochentag letzte Woche" |

---

## 🎯 Nächster logischer Schritt

**Einmalige Konfiguration + Validierung (Nutzer-Aktion + ggf. Code):**

1. **Sensor-Checkboxen setzen**: In Admin → Sensoren: Bad/WC-Räume mit 🚿 markieren, Schlafzimmer/Bad mit 🌙 markieren, Flur/Diele mit 🚶 markieren
2. **Analyse neu triggern**: "System prüfen" klicken → erste Ganggeschwindigkeits-Daten mit neuem System sammeln
3. **Nach 3–7 Tagen** prüfen ob Ganggeschwindigkeit-Chart plausible Werte (3–15 Sek.) zeigt

**Dann Feature-Arbeit:**
- Wochenzusammenfassung per Pushover (jeden Sonntag)

---

## 📦 Versionshistorie (vollständig)

| Version | Inhalt |
|---------|--------|
| v0.30.87 | Typ-basierte Fenster/Tür-Erkennung (kein Keyword-Matching) |
| v0.30.88 | Wochentag im Tooltip aller Kacheln |
| v0.30.89 | Zeitraum in alle Kachel-Subtitles, Tooltip "min aktiv" |
| v0.30.90 | Frischluft-Bug: contact → door als Sensor-Typ |
| v0.30.91 | Fundament komplett: isNightSensor + isBathroomSensor typ-basiert |
| v0.30.92 | SensorList: fehlende Bad-Checkbox + Layout-Fix |
| v0.30.93 | SensorList: Icons für alle Checkboxen + stickyHeader + full-width |
| v0.30.94 | Ganggeschwindigkeit fix (Sek. statt %), Debug-Zeile entfernt |

---

## 🔑 Architektur-Prinzipien (gelernte Lektionen)

| Problem | Falsch ❌ | Richtig ✅ |
|---------|-----------|-----------|
| Fenster/Tür erkennen | `name.includes('fenster')` | `e.type === 'door'` |
| Nacht-Raum erkennen | `name.includes('schlaf')` | `device.isNightSensor === true` |
| Bad-Raum erkennen | `/bad\|wc\|toilet/i` | `device.isBathroomSensor === true` |
| Flur erkennen | `name.includes('flur')` | `device.isHallway === true` |
| Gesundheits-Metrik | Abstraktes percent_change | Physikalischer Messwert (Sekunden) |
| Zeitplanung | `node-schedule` RecurrenceRule | `setInterval` mit lokalem `getHours()` |
| Sensor-Daten in UI | Live aus eventHistory filtern | Vorberechnet in Snapshot speichern |
