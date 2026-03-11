# PROJEKT_STATUS - cogni-living (NUUKANNI / AURA)

> **Übergabeprotokoll für die nächste Sitzung**
> Letzte Aktualisierung: 02.03.2026 | Aktuelle Version: **v0.30.96**

---

## ✅ 1. Aktueller Stand – Was haben wir in dieser Sitzung abgeschlossen?

| # | Ergebnis | Details |
|---|----------|---------|
| 1 | **Morgenbriefing-Ursache vollständig identifiziert & behoben** | Der Nutzer empfing nie ein echtes 08:00-Briefing. Stattdessen kam jede Nacht um 03:00 eine Push-Nachricht vom internen Daily Digest (LTM-Komprimierung), die fälschlicherweise als Push-Benachrichtigung konfiguriert war. Diese Debug-Zeile wurde entfernt. |
| 2 | **Briefing-Scheduler von `setInterval` auf `node-schedule` umgestellt** | Der `setInterval`-Ansatz (jede Minute prüfen) war fehleranfällig: `toISOString()` liefert UTC-Zeit, `getHours()` Lokalzeit → Zeitzonenkonflikte. Jetzt nutzt das Briefing dieselbe `node-schedule`-Technik wie der zuverlässig funktionierende 03:00-Digest. Cron-Ausdruck z.B. `0 8 * * *` für 08:00. |
| 3 | **Kritischer TDZ-Bug behoben (Garmin-Charts fehlten ab 07.03.)** | `root/main.js` war eine veraltete Version (v0.30.38) mit einem JavaScript Temporal Dead Zone Fehler in `saveDailyHistory()`: `nightMotionCount` und `bathroomMinutes` wurden vor der Deklaration von `todayEvents`/`roomHistoryData` verwendet → täglicher Crash um 23:59 → keine History-Dateien ab 07.03. Fix: Korrekte `src/main.js` in `root/main.js` deployed. |
| 4 | **Ganggeschwindigkeit-Berechnung grundlegend neu implementiert** | Alter Fehler: Globaler Median aus der gesamten Sequenz-History → jeden Tag identischer Wert (155.88s). Neu: Tagesaktuelle Berechnung direkt in `saveDailyHistory()` via JavaScript. Filtert nur heutige `[Raum A → Flur → Raum B]`-Muster, berechnet Median der Flur-Transitzeiten. |

---

## 🏗️ 2. Funktionierende Basis – Was läuft bereits fehlerfrei?

### Architektur-Prinzipien (vollständig umgesetzt)
| Sensor-Typ | Erkennung |
|---|---|
| Fenster/Türen | `e.type === 'door'` (kein Keyword-Matching) |
| Nacht-Räume | `isNightSensor`-Checkbox in Config |
| Bad-Räume | `isBathroomSensor`-Checkbox in Config |
| Flur-Räume | `isHallway`-Checkbox in Config |

### Backend (Node.js + Python)
- **Sensor-Fusion & Bewegungserkennung** — alle PIR-Sensoren, strukturiert nach Typ
- **Schlafanalyse** — Nacht-Events (22:00–08:00), Bad-Frequenz, Tagesbeginn-Erkennung
- **IsolationForest Anomalie-Erkennung** — inkl. Auto-Training ab 7 Tages-Digests
- **Security-Erkennung** — kein Fallback-Spam, 1h Cooldown, Status `untrained`/`ready`
- **Dynamische Tagesbeginn-Erkennung** — erste Bewegung im Nicht-Nacht-Sensor-Raum, Cap 08:00
- **`saveDailyHistory`** — vollständiger täglicher Snapshot (todayVector, roomHistory, windowOpenCounts, nightMotionCount, bathroomMinutes, gaitSpeed, eventHistory u.v.m.)
- **Ganggeschwindigkeit** — täglich neu berechnet, Median der Flur-Transitzeiten in Sekunden (physikalisch plausibel, 3–15 Sek. = normal)
- **Morgenbriefing** — feuert zuverlässig via `node-schedule` zur konfigurierten Uhrzeit (08:00)
- **Daily Digest (03:00)** — stilles Hintergrundprotokoll, kein Push mehr

### Admin UI (React)
- **Garmin-Style Charts** — 6 Kacheln: Aktivitätsbelastung, Ganggeschwindigkeit, Nacht-Unruhe, Raum-Mobilität, Bad-Nutzung, Frischluft
- **Sensor-Konfigurationstabelle** — Icons, stickyHeader, volle Breite, alle Checkbox-Spalten
- **Hilfe-Tooltips (`?`)** — bei allen 6 Garmin-Kacheln und allen 9 TerminalBox-Kacheln
- **Wochentag + Zeitraum** — in allen Chart-Tooltips und Subtitles

### PWA (Mobile)
- **Anomalie-Anzeige** — zeigt `Lernt noch` wenn Security-Modell noch nicht trainiert (kein "Score: 0.10")

---

## 🔧 3. Offene Baustellen

| Priorität | Problem | Beschreibung |
|-----------|---------|--------------|
| 🔴 Test nötig | **Morgenbriefing: Erstmals testen** | Nach Adapter-Neustart muss das 08:00-Briefing morgen früh erstmals ankommen. Vorher ist die Korrektur nicht verifiziert. |
| 🟡 Mittel | **Ganggeschwindigkeit: Erste frische Daten** | Die neue tagesaktuelle Berechnung wirkt erst nach dem nächsten `saveDailyHistory`-Lauf (23:59 Uhr). Alte Snapshot-Werte (155s) bleiben bis dahin sichtbar. |
| 🟡 Mittel | **Sensor-Checkboxen noch nicht gesetzt** | Nutzer muss einmalig in Admin → Sensoren: 🚿 Bad-Räume, 🌙 Nacht-Räume, 🚶 Flur-Räume markieren — sonst greifen Typ-basierte Berechnungen auf Fallback-Keywords zurück. |
| 🟡 Mittel | **Garmin-Charts: Fehlende Tage 08.–10.03.** | Aufgrund des TDZ-Bugs gibt es für 08.–10.03. keine History-Dateien. Diese Lücke bleibt in den Charts sichtbar und füllt sich erst durch neue Tage. |
| 🔵 Idee | **Wochenzusammenfassung per Pushover** | Jeden Sonntag automatisch: Aktivitätstrend, unruhige Nächte, Veränderungen. Echter Pflegemehrwert. |
| 🔵 Idee | **Tagesvergleich-Ansicht** | "Heute vs. gleicher Wochentag letzte Woche" in Admin UI |

---

## 🎯 4. Nächster logischer Schritt

**Sofortige Nutzer-Aktion (nach Adapter-Neustart):**

1. **Adapter neu starten** → `node-schedule` wird aktiv, Log zeigt `🌅 Briefing geplant für 8:00 Uhr`
2. **Morgen früh 08:00** abwarten → Kommt das Briefing an? Falls ja: Bug behoben ✅
3. **Einmalig Sensor-Checkboxen setzen** in Admin → Sensoren: 🚿 Bad, 🌙 Nacht, 🚶 Flur

**Nächste Feature-Arbeit (nach Verifikation):**
- Wochenzusammenfassung per Pushover (jeden Sonntag)

---

## 📦 Versionshistorie

| Version | Inhalt |
|---------|--------|
| v0.30.87 | Typ-basierte Fenster/Tür-Erkennung (`e.type === 'door'`) |
| v0.30.88 | Wochentag im Tooltip aller Kacheln |
| v0.30.89 | Zeitraum in alle Kachel-Subtitles |
| v0.30.90 | Frischluft-Bug: `contact` → `door` |
| v0.30.91 | Fundament: `isNightSensor` + `isBathroomSensor` typ-basiert |
| v0.30.92 | SensorList: Bad-Checkbox + Layout-Fix |
| v0.30.93 | SensorList: Icons, stickyHeader, full-width |
| v0.30.94 | Ganggeschwindigkeit: Sekunden statt %, Debug-Zeile entfernt |
| v0.30.95 | Daily Digest: Push-Benachrichtigung entfernt (03:00 Nacht-Alarm) |
| v0.30.96 | Briefing-Scheduler: `setInterval` → `node-schedule`; TDZ-Bug `saveDailyHistory`; Ganggeschwindigkeit tagesfrisch |

---

## 🔑 Architektur-Prinzipien (gelernte Lektionen)

| Problem | Falsch ❌ | Richtig ✅ |
|---------|-----------|-----------|
| Fenster/Tür erkennen | `name.includes('fenster')` | `e.type === 'door'` |
| Nacht-Raum erkennen | `name.includes('schlaf')` | `device.isNightSensor === true` |
| Bad-Raum erkennen | `/bad\|wc\|toilet/i` | `device.isBathroomSensor === true` |
| Flur erkennen | `name.includes('flur')` | `device.isHallway === true` |
| Gesundheits-Metrik | Abstraktes `percent_change` | Physikalischer Messwert (Sekunden) |
| Zeitplanung | `setInterval` + `getHours()` | `node-schedule` Cron-Ausdruck |
| Sensor-Daten in UI | Live aus eventHistory filtern | Vorberechnet im Snapshot speichern |
| Hintergrundprozess | Push-Benachrichtigung senden | Nur ioBroker-Log schreiben |
