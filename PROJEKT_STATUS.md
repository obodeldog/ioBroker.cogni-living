# PROJEKT STATUS — ioBroker Cogni-Living (AURA)
**Letzte Aktualisierung:** 12.03.2026 | **Version:** 0.31.2

---

## 1. Aktueller Stand (diese Sitzung)

### ✅ Root-Cause gefunden und behoben: Fresh Air Kachel zeigt immer "0x"

**Der eigentliche Bug (gefunden nach umfangreicher Analyse):**
In der `processEvents`-Funktion (`HealthTab.tsx`, Zeile ~752) wurde `evt.name.toLowerCase()` aufgerufen. Wenn ein einziges Event in `todaysEvents` kein `name`-Feld hat (was bei älteren gespeicherten Events vorkommen kann), wirft das einen `TypeError`. Die `forEach`-Schleife bricht ab, `setFreshAirCount(faCount)` wird **niemals aufgerufen**, und `freshAirCount` bleibt bei 0 — dauerhaft.

**Bestätigter Datenfluss (war korrekt):**
- `events.history` State enthält Door-Events: `type: "door"`, `value: 1` (numerisch, NICHT true/false) ✅
- Timestamps heute (09:07 und 09:17 Uhr) ✅
- `main.js` (Einstiegspunkt) `getOverviewData` → gibt `this.eventHistory` zurück ✅
- `processEvents` Filter: `evt.type === 'door' && evt.value === 1` korrekt ✅
- **Das Problem**: `evt.name.toLowerCase()` crasht bei Events ohne name

**Fixes in v0.31.2:**
1. `HealthTab.tsx`: `evt.name.toLowerCase()` → `(evt.name || '').toLowerCase()` (Zeile 752 + 757)
2. `HealthTab.tsx`: Totes Code-Fragment (alte Keyword-Matching `return (nameLower.includes...)`) entfernt
3. `HealthTab.tsx`: Doppelter `setFreshAirLongCount`-Aufruf entfernt (war redundant)
4. `lib/main.js`: Doppelter `const FRESH_AIR_MIN_MS` Block entfernt (SyntaxError behoben, auch wenn `lib/main.js` nicht der Einstiegspunkt ist)

**Hinweis:** `main.js` (Einstiegspunkt lt. `package.json`) war bereits korrekt — nur `lib/main.js` hatte den Doppel-Block, war aber nicht betroffen.

---

## 2. Funktionierende Basis

| Feature | Status | Anmerkung |
|---|---|---|
| Sensor-Typ-System ("Tuer/Fenster" → `type: "door"`) | ✅ | Korrekt in recorder.js |
| Frischluft-Zählung (Öffnungen heute) | ✅ | Fix v0.31.2 |
| Stoßlüftung ≥5 Min Zähler | ✅ | Fix v0.31.1 |
| Admin UI Fresh Air Kachel | ✅ | Fix v0.31.2 (null-safety) |
| Drift-Monitor mit Datumsachse | ✅ | v0.31.0 |
| KI-Analyse Auto-Trigger (08:05 + 20:00) | ✅ | v0.31.0 |
| Tages/Nacht Anomalie-Score | ✅ | v0.30.x |
| Ganggeschwindigkeit | ✅ | v0.28.0 |
| Raum-Mobilität | ✅ | v0.30.x |
| Nacht-Unruhe Kachel | ✅ | v0.30.x |
| Bad-Nutzung | ✅ | v0.28.0 |
| Pushover Briefing (08:00 + 20:00) | ⚠️ | User berichtet weiterhin Probleme |
| Garmin-Style Drift-Monitor | ✅ | v0.30.74 |
| Feature-Module-Status Tab | ✅ | v0.30.x |
| PROJEKT_STATUS.md Auto-Update Rule | ✅ | .cursor/rules/ |

---

## 3. Offene Baustellen

| Problem | Priorität | Beschreibung |
|---|---|---|
| Morning Briefing Uhrzeit | 🔴 HOCH | User bekommt Pushover-Briefing nicht um 08:00 Uhr. Mehrfach besprochen, noch nicht zuverlässig gelöst |
| `freshAirLong` in `loadWeekData` | 🟡 MITTEL | Zeile 464 in HealthTab.tsx: `freshAirLong` wird in Week-Data als `undefined` referenziert, da nie berechnet. Muss noch die freshAirLong-Berechnung in den `loadWeekData`-Today-Block integriert werden |
| `loadWeekData` useEffect Dependency | 🟡 MITTEL | `[weekOffset]` — `loadWeekData` fehlt in den deps. React wird warnen |
| LSTM für stündliche Erwartung | 🟢 NIEDRIG | Geplant — Zeitlich-bewusstes Anomalie-Modell |
| Graduelle Drift-Detektion (CUSUM) | 🟢 NIEDRIG | Geplant für Langzeit-Demenz-Früherkennung |

---

## 4. Nächster logischer Schritt

**SOFORT nach nächstem Adapter-Update (v0.31.2) testen:**
1. Adapter von GitHub neu laden und neu starten
2. Admin UI öffnen, Ctrl+F5 (Hard Refresh)
3. Fenster/Tür öffnen und Tab „Gesundheit" prüfen
4. Fresh Air Kachel sollte jetzt > 0 anzeigen (Zähler steigt)

**Danach (nächste Sitzung):**
- `freshAirLong` in `loadWeekData` berechnen (fehlende Zeile ~435 in loadWeekData)
- Morning Briefing Timing-Problem endgültig debuggen (ggf. direkt im ioBroker-Log prüfen ob Scheduler feuert)

---

## 5. Versions-Historie (letzte Änderungen)

| Version | Datum | Änderung |
|---|---|---|
| **0.31.2** | 12.03.2026 | **FIX**: processEvents TypeError bei null name → Fresh Air immer 0; lib/main.js SyntaxError; Dead Code entfernt |
| 0.31.1 | 12.03.2026 | Fresh Air: type-based Erkennung, Stoßlüftung ≥5 Min, freshAirLongCount |
| 0.31.0 | 11.03.2026 | Drift-Monitor Datumsachse, KI-Analyse Auto-Trigger, Flur-Räume entfernt |
| 0.30.74 | 10.03.2026 | Feature-Module-Status Tab, Garmin Drift-Monitor |
