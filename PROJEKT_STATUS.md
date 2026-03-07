# PROJEKT_STATUS - cogni-living (NUUKANNI / AURA)

> **Übergabeprotokoll für die nächste Sitzung**
> Letzte Aktualisierung: 07.03.2026 | Aktuelle Version: **v0.30.89**

---

## ✅ Aktueller Stand - Was haben wir in dieser Sitzung abgeschlossen?

| # | Ergebnis | Version |
|---|----------|---------|
| 1 | **Architektur-Refactoring: Typ-basierte Fenster/Tür-Erkennung** — `saveDailyHistory` filtert jetzt nach `e.type === 'contact'` statt fragiler Keyword-Liste (`fenster`, `haustür`, `tuer`...). Snapshot speichert `windowOpenCounts: { sensorName: anzahl }`. Admin UI liest direkt aus Snapshot — kein String-Matching mehr möglich | v0.30.87 |
| 2 | **Bad-Nutzung Label korrigiert** — "Besuche" war irreführend (es waren Präsenz-Minuten mit aktiver Bewegung, keine Einzelbesuche). Label jetzt "Min." | v0.30.87 |
| 3 | **Wochentag im Tooltip** — Alle Chart-Kacheln zeigen neben dem Datum den deutschen Wochentag (Mo/Di/.../So). Zeitzonen-sichere Berechnung via lokaler `Date(year, month-1, day)`. Gilt für Haupt-Chart (YYYY-MM-DD) und Mini-Charts (MM-DD) | v0.30.88 |
| 4 | **Zeitraum in jede Kachel-Subtitle eingebaut** — Jede Kachel zeigt jetzt direkt in der Untertitel-Zeile den Betrachtungszeitraum: Nacht-Unruhe `· 22–08 Uhr`, alle anderen `· 0–24 Uhr` | v0.30.89 |
| 5 | **Tooltip "min aktiv"** — Raum-Mobilität-Tooltip zeigt jetzt "EG Schlafen: 24 min aktiv" statt "24 min" — macht klar dass es Bewegungsminuten sind, nicht Aufenthaltszeit | v0.30.89 |
| 6 | **Bad-Nutzung erklärt** — Analysiert: 65 "Besuche" waren kein Thermostat-Bug. `roomHistory` wird via `integrateRoomTime()` befüllt, das ausschließlich `dev.type === 'motion'` berücksichtigt. 65 = ca. 1 Stunde Bewegungsminuten im Bad pro Tag (Dusche + WC + Zähneputzen) — vollständig plausibel |  |

---

## 🏗️ Funktionierende Basis - Was läuft bereits fehlerfrei?

### Backend (Node.js + Python)
- **Bewegungserkennung & Sensor-Fusion** — alle PIR-Sensoren werden ausgewertet
- **Schlafanalyse** — Nacht-Events (22:00–08:00), Bad-Frequenz, Heuristik
- **IsolationForest-Anomalie-Erkennung** — Tag UND Nacht, personalisiertes Modell
- **Security-Erkennung** — kein Fallback-Alarm-Spam mehr, 1h Cooldown, verständliche Meldungen
- **Dynamische Tagesbeginn-Erkennung** — erste Bewegung in Nicht-Nacht-Sensor-Raum nach 05:00, Cap 08:00
- **Nacht-Sensor Checkbox** — Bad/WC/Schlafzimmer konfigurierbar von Tagesbeginn-Erkennung ausschließbar
- **Auto-Training IsolationForest** — startet automatisch nach saveDailyHistory wenn ≥3 Tage vorhanden
- **Briefing-Scheduler** — Pushover-Briefing kommt korrekt zur konfigurierten Uhrzeit (lokale Zeit via setInterval-Check)
- **saveDailyHistory** — speichert vollständige Snapshots: todayVector, roomHistory, geminiNight/DayTs, windowOpenCounts, gaitSpeed, eventHistory
- **todayVector Fallback** — berechnet sich aus eventHistory wenn rawEventLog leer ist

### Admin UI (React)
- **Zeitstempel auf Nacht/Tages-Kacheln** — zeigt wann KI-Bericht zuletzt generiert wurde, auch im Archiv-Modus
- **Aktivitäts-Belastung** — ComposedChart: blaue Balken (Tageswert) + anthrazit Linie (7-Tage-Schnitt)
- **Alle Mini-Charts** — einheitliches Garmin-Style: farbige Balken + anthrazite Trendlinie
- **Frischluft-Tooltip** — zeigt alle geöffneten Kontaktsensoren mit Häufigkeit (jetzt typ-basiert, nicht keyword-basiert)
- **Raum-Mobilität-Tooltip** — zeigt Top-5 aktive Räume mit Minuten
- **Wochentag im Tooltip** — alle Kacheln
- **Zeitraum-Anzeige** — alle Kacheln zeigen Betrachtungszeitraum in Subtitle
- **Graph-Brain** — zeigt trainierte Übergangswahrscheinlichkeiten (nicht mehr Binary-Fallback)
- **Security Tab** — Drift-Monitor mit adaptiver Baseline

### PWA (Mobile App)
- **KI-Berichte** — Nacht-Protokoll + Tages-Situation mit Zeitstempel
- **Cloudflare Tunnel** — erreichbar von außen

---

## 🔧 Offene Baustellen

| Priorität | Problem | Beschreibung |
|-----------|---------|--------------|
| 🟡 Mittel | **Ganggeschwindigkeit unplausibel** | Werte wirken zu hoch/unrealistisch. Ursache noch nicht analysiert — könnte an der Sensor-Sequenz-Logik in `recorder.js` liegen |
| 🟡 Mittel | **Nacht-Unruhe: Schlafzimmer-Filter noch keyword-basiert** | `nightEvents` filtert noch via `(e.location \|\| e.name).includes('schlaf')` — sollte wie Fenster/Türen auf `isNightSensor`-Flag aus `config.devices` umgestellt werden (gleiche Architektur-Logik wie v0.30.87) |
| 🟡 Mittel | **Bad-Nutzung: Raum-Identifikation noch keyword-basiert** | `bathroomVisits` filtert via `/bad\|wc\|toilet/i` auf Raumnamen — sollte auf Raum-Typ aus Konfiguration umgestellt werden |
| 🟢 Klein | **Debug-Zeile in Aktivitätsbelastung** — "30 Tage geladen \| Wertebereich: X%–Y%" ist noch sichtbar. War für Diagnose gedacht, sollte nach stabilem Betrieb entfernt oder hinter ein Toggle gelegt werden |
| 🟢 Klein | **Raum-Mobilität zählt nicht Aufenthaltszeit** — PIR-Sensoren erkennen keine schlafende Person → Schlafzimmer hat immer sehr wenig Minuten. Konzeptuell korrekt, aber für Nutzer erklärungsbedürftig |
| 🔵 Idee | **Echte Besuchszählung Bad** — Würde echte Einzelbesuche (Türkontakt öffnet/schließt) benötigen statt PIR-Minuten |

---

## 🎯 Nächster logischer Schritt

**Architektur-Konsolidierung: Nacht-Unruhe und Bad-Nutzung auf typ-basierte Filterung umstellen**

Wir haben in v0.30.87 das Keyword-Matching für Fenster/Türen durch `e.type === 'contact'` ersetzt. Dasselbe Muster sollte konsequent auf die verbleibenden keyword-basierten Filter angewendet werden:

1. **Nacht-Unruhe** (`nightEvents`): Statt `includes('schlaf')` → prüfe `isNightSensor === true` aus `adapter.config.devices`, vorberechnet in `saveDailyHistory` als `nightMotionCount`
2. **Bad-Nutzung** (`bathroomVisits`): Statt `/bad|wc|toilet/i` → konfigurierbare Raum-Markierung (z.B. eigene Checkbox "🚿 Bad-Raum?" analog zur "🌙 Nacht?"-Checkbox)

**Danach:** Ganggeschwindigkeit analysieren — warum sind die Werte unplausibel?

---

## 📦 Versionshistorie dieser Sitzung

| Version | Inhalt |
|---------|--------|
| v0.30.87 | Typ-basierte Fenster/Tür-Erkennung (kein Keyword-Matching), windowOpenCounts im Snapshot, Bad-Label korrigiert |
| v0.30.88 | Wochentag im Tooltip aller Kacheln |
| v0.30.89 | Zeitraum in alle Kachel-Subtitles, Tooltip "min aktiv" |

---

## 🔑 Wichtige Architektur-Prinzipien (gelernte Lektionen)

| Problem | Falsch | Richtig |
|---------|--------|---------|
| Sensor-Typ erkennen | `name.includes('fenster')` | `device.type === 'contact'` aus `config.devices` |
| Nacht-Raum erkennen | `name.includes('schlaf')` | `device.isNightSensor === true` aus `config.devices` |
| Bad-Raum erkennen | `/bad\|wc\|toilet/i` | Konfigurierbare "Bad-Raum"-Checkbox (noch zu bauen) |
| Zeitplanung | `node-schedule` RecurrenceRule (UTC-Bug) | `setInterval` mit lokalem `getHours()`-Check |
| Sensor-Daten persistieren | In State lassen, UI neu berechnen | Vorberechnet in `saveDailyHistory` Snapshot speichern |
