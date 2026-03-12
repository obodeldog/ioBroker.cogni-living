# PROJEKT_STATUS — cogni-living (NUUKANNI / AURA)

> **Übergabeprotokoll für die nächste Sitzung**
> Letzte Aktualisierung: **02.03.2026** | Aktuelle Version: **v0.31.1** | Letzter Commit: ausstehend

---

## ✅ 1. Aktueller Stand — Was haben wir in dieser Sitzung abgeschlossen?

| # | Version | Feature / Fix | Details |
|---|---------|---------------|---------|
| 1 | v0.31.1 | **Fresh Air: Live-Pfad Fix (HealthTab)** | Live-Berechnung in `HealthTab.tsx` (beim Klick auf "System prüfen") nutzte noch altes Keyword-Matching (`haustür`, `terrasse`). Jetzt korrekt: `e.type === 'door'`. |
| 2 | v0.31.1 | **Stoßlüftungs-Zähler (≥5 Min)** | Backend berechnet `freshAirLongCount`: Anzahl Tür-Öffnungen die ≥5 Minuten dauerten (OPEN/CLOSE-Paare). Frontend zeigt "davon 2× ≥5 Min (Empf.: 3×)" in oranger/grüner Farbe. Wenn Öffnungen < 5 Min: rote Warnung "Zu kurz – Stoßlüftung ≥5 Min empfohlen". |
| 3 | v0.31.0 | **Fresh Air: Typ-System statt Keywords** | `freshAirCount` nutzt jetzt `e.type === 'door'` (aus Sensorliste: Tür/Fenster). Vorher: Keyword-Matching auf Sensornamen → unzuverlässig. |
| 2 | v0.31.0 | **Flur-Räume-Textfeld entfernt** | War toter Code: UI-Feld vorhanden, aber `config.flurRooms` wurde nirgendwo gelesen. Aus `Settings.tsx`, State-Interface und `io-package.json` entfernt. |
| 3 | v0.31.0 | **Versionsnummer auf 0.31.0** | Ab sofort wird nach jedem Feature-Commit die Version hochgezählt. Sichtbar in ioBroker-Adapter-Ansicht. |
| 4 | v0.30.x | **Auto KI-Analyse (08:05 + 20:00)** | Täglich um 08:05 (Nacht-Protokoll) und 20:00 (Tages-Situation) wird `analysis.training.triggerHealth` automatisch gesetzt → Gemini generiert frische Texte ohne manuellen Klick. |
| 5 | v0.30.x | **Briefing-Trigger-Reihenfolge** | Bug: `analysis.triggerBriefing` wurde von generischer Bedingung abgefangen → `sendMorningBriefing` nie aufgerufen. Fix: spezifische Checks vor generischem `analysis.trigger`. |
| 6 | v0.30.x | **Score 0.10 Fix** | `analysis.security.lastScore` wurde nie gesetzt (ANALYZE_SEQUENCE nirgendwo aufgerufen). Fix: `HEALTH_RESULT` setzt jetzt beide States. HealthTab liest `health.anomalyScore` primär. |
| 7 | v0.30.x | **Drift-Monitor X-Achse: Kalenderdaten** | Python gibt `dates` und `gait_dates` zurück. Frontend baut `chartData` mit `TT.MM` statt Index-Nummern. **Braucht Adapter-Neustart zum Aktivieren.** |
| 8 | v0.30.x | **Wochenbericht (Sonntag 09:00)** | `node-schedule` Cron, sendet Aktivitätstrend + Schlafdaten per Pushover. |
| 9 | v0.30.x | **Modul-Status Dashboard** | System-Tab: Accordion mit allen 16 Algorithmen, 4 Säulen (Gesundheit/Sicherheit/Komfort/Energie), Pro/Free-Badges, Status-Chips mit Tooltips. |
| 10 | — | **Cursor-Regel angelegt** | `.cursor/rules/update-projekt-status.mdc` — KI updatet PROJEKT_STATUS.md automatisch nach jedem Push. |

---

## 🏗️ 2. Funktionierende Basis — Was läuft bereits fehlerfrei?

### Backend (Node.js + Python)

| Modul | Status | Anmerkung |
|-------|--------|-----------|
| Sensor-Fusion (PIR) | ✅ | `isHallway`, `isBathroomSensor`, `isNightSensor`, `type==='door'` |
| `saveDailyHistory` (23:59) | ✅ | TDZ-Bug behoben; Ganggeschwindigkeit täglich frisch |
| Fresh Air Zählung | ✅ | Via `e.type === 'door'` — kein Keyword-Matching mehr. Auch Live-Pfad (HealthTab) gefixt. |
|| Fresh Air Stoßlüftungs-Zähler | ✅ | `freshAirLongCount` = Öffnungen ≥5 Min. Gespeichert im Daily-Snapshot, in Kachel angezeigt. |
| IsolationForest (Tag + Nacht) | ✅ | Auto-Training ab 7 Digests |
| Sicherheits-Anomalie | ✅ | Kein Fallback-Spam, 1h Cooldown |
| Morgenbriefing (08:00) | ✅ | `node-schedule`, korrekter Trigger zu `sendMorningBriefing` |
| Auto KI-Analyse (08:05 + 20:00) | ✅ | Nacht-Protokoll und Tages-Situation täglich frisch |
| Wochenbericht (Sonntag 09:00) | 👁️ | Implementiert, erster Test nächsten Sonntag |
| Drift-Monitor (PH-Test) | 👁️ | Kalibrierungsphase ~10–14 Tage; X-Achse-Fix braucht Neustart |

### Admin UI (React v0.31.0)

| Bereich | Status |
|---------|--------|
| Langzeit-Trends: 6 Garmin-Kacheln | ✅ |
| Drift-Monitor: 4 Metriken, 0–100% normalisiert | ✅ |
| Drift-Monitor X-Achse | ⏳ nach Adapter-Neustart aktiv |
| Gruppen-Container (Drift-Analyse + Hygiene) | ✅ |
| System-Tab: Modul-Status Accordion | ✅ |
| Settings: Flur-Räume-Feld entfernt | ✅ |
| Sensor-Konfiguration: Typ-System | ✅ |

### PWA NUUKANNI

| Feature | Status |
|---------|--------|
| Tages-Status, Anomalie-Score | ✅ |
| Score: zeigt Health-Score statt 0.10 | ✅ (nach LTM-Digest um 03:00) |
| KI-Analyse (Fließtext, kein JSON) | ✅ |

---

## 🔧 3. Offene Baustellen

| Priorität | Problem | Beschreibung |
|-----------|---------|--------------|
| 🔴 Verifizieren | **Morgenbriefing testen** | User hat Adapter neugestartet und Briefing aktiviert. Nächster Test: morgen 08:00. Im Log prüfen: `🌅 Briefing geplant für 8:0 Uhr`. |
| 🔴 Verifizieren | **Wochenbericht** | Erst nächsten Sonntag testbar. |
| 🟡 Neustart | **Drift-Monitor Kalender-Datum** | Fix deployed, aber Adapter muss neugestartet werden damit Python-Service `dates`-Feld liefert. |
| 🟡 Mittel | **IsolationForest Trainingsphase** | Beide Modelle zeigen `⚠️ Warnung` bis 7+ Digests vorhanden — normal, kein Bug. |
| ✅ Erledigt | **Fresh Air: Stoßlüftungs-Zähler** | `freshAirLongCount` = Öffnungen ≥5 Min. Kachel zeigt "davon Nx ≥5 Min (Empf.: 3×)". Forschungsbasis: DIN EN 15251, Pettenkofer-Zahl. |
| 🟡 Mittel | **Aktivitätsbelastung 100%-Formel** | Alle Balken zeigen 100% — Rolling-Median-Normalisierung noch falsch. Roadmap: `⚠️ Teilweise`. |
| 🔵 Langfristig | **LSTM Sequenz-Vorhersage** | Nächstes großes ML-Feature. Roadmap: `🔬 Geplant`. |
| 🔵 Info | **Hallway Keywords Fallback** | `['flur','diele','gang','korridor']` als Fallback behalten — `isHallway`-Checkbox ist primär. Kein Bug, keine Kollision. |

---

## 🎯 4. Nächster logischer Schritt

**Sofortmaßnahmen (kein Code nötig):**
1. **Adapter neu starten** → Drift-Monitor X-Achse zeigt Kalenderdaten
2. **Log prüfen nach Neustart**: `🌅 Briefing geplant für 8:0 Uhr` und `🤖 Tägliche KI-Analyse geplant`
3. **Morgen 08:00 abwarten** → Pushover-Briefing testen

**Nächstes Feature:**
> **Aktivitätsbelastung-Normalisierung reparieren** — Alle Balken zeigen 100%. Das ist das letzte `⚠️`-Item in der Gesundheits-Roadmap und ein sauberer, isolierter Fix.
> **Naechster Schritt: Aktivitaetsbelastung-Normalisierung** — Alle Balken zeigen 100%. Letztes ⚠️-Item in der Gesundheits-Roadmap.

---

## 📦 Versionshistorie

| Version | Commit | Inhalt |
|---------|--------|--------|
|| **v0.31.1** | ausstehend | Fresh Air Live-Pfad Fix; Stoßlüftungs-Zähler (≥5 Min) |
| **v0.31.0** | `6e2d231` | Fresh Air auf Typ-System; Flur-Räume entfernt; Version hochgezählt |
| v0.30.x | `1a23c24` | Auto-KI-Analyse (08:05+20:00); Briefing-Trigger-Fix; Score 0.10 behoben |
| v0.30.x | `926bc52` | Drift-Monitor X-Achse: Kalenderdaten (braucht Neustart) |
| v0.30.x | `ac12356` | Modul-Status nach Säulen (Gesundheit/Sicherheit/Komfort/Energie) + Pro/Free + Tooltips |
| v0.30.x | `de56a54` | Gruppen-Container Drift-Analyse + Hygiene (Option B) |
| v0.30.x | `9130dfc` | Drift-Monitor Layout-Fix + Nacht-Unruhe 0%-Bug |
| v0.30.x | `a7d03df` | DRIFT-MONITOR: Page-Hinkley, 4 Metriken, Pushover-Alarm |
| v0.30.x | `89e5980` | Wochenbericht jeden Sonntag per Pushover |
| v0.30.x | `fd409f3` | Briefing-Scheduler: `setInterval` → `node-schedule` |

---

## 🔑 Architektur-Prinzipien (nie wieder rückgängig machen!)

| Problem | Falsch ❌ | Richtig ✅ |
|---------|-----------|-----------|
| Fenster/Tür erkennen | `name.includes('fenster')` | `e.type === 'door'` |
| Nacht-Raum erkennen | `name.includes('schlaf')` | `device.isNightSensor === true` |
| Bad-Raum erkennen | `/bad\|wc\|toilet/i` | `device.isBathroomSensor === true` |
| Flur erkennen | Keyword-Textfeld | `device.isHallway === true` (+ Keywords als Fallback) |
| Fresh Air zählen | Keyword auf Sensorname | `e.type === 'door'` aus eventHistory |
| Zeitplanung | `setInterval` + `getHours()` | `node-schedule` Cron-Ausdruck |
| Debug-Output | Push-Benachrichtigung | Nur ioBroker-Log |
| Trigger-Reihenfolge | Generisch vor Spezifisch | **Spezifisch vor Generisch** (triggerBriefing vor analysis.trigger) |
| Drift-Metriken | Rohe Event-Counts | Normalisiert auf pers. Baseline (0–100%) |
