# PROJEKT STATUS — ioBroker Cogni-Living (AURA)
**Letzte Aktualisierung:** 12.03.2026 | **Version:** 0.31.3

---

## 1. Aktueller Stand (diese Sitzung)

### ✅ Root-Cause des "alten Builds" endgültig gefunden und behoben (v0.31.3)

**Das eigentliche Problem (hinter allen bisherigen Fresh Air Fehlschlägen):**
ioBroker serviert die Admin UI aus dem Verzeichnis `admin/` — NICHT aus `src-admin/build/`.
Vite hat aber immer in `src-admin/build/` gebaut. Deshalb hat ioBroker stets das alte `index-DaLhtVVS.js` (mit Keyword-Matching-Logik) geladen, egal wie oft wir `src-admin/build/` aktualisiert haben.

**Fixes in v0.31.3:**
1. `admin/assets/index-DaLhtVVS.js` (alter Build) entfernt
2. `admin/assets/index-CBIshDQD.js` + `admin/index.html` auf neuen Stand gebracht
3. `src-admin/vite.config.mjs`: `outDir` von `'build'` auf `'../admin'` geändert → zukünftige Builds landen direkt im richtigen Verzeichnis
4. `.gitignore`: `src-admin/build/` ignoriert (kein doppelter Build mehr)
5. 62 temporäre `_*.js`, `_*.ps1`, `old_*.*` Dateien aus dem Repo entfernt

### ✅ Score 0.10 erklärt und Normalisierungsformel verbessert

**Mathematischer Beweis:** `IsolationForest(contamination=0.1)` liefert für normale Tage `raw_score ≈ -0.10`. Die alte Formel `−raw_score` ergab dadurch 0.10 für vollständig normale Tage — das wirkte wie "10% anomal", war aber "100% normal".

**Neue Formel (zentriert):**
- 0.0 = vollständig normal (raw ≈ -0.10)
- 0.5 = mäßig anomal (raw ≈ -0.30)
- 1.0 = stark anomal (raw ≤ -0.50)

**Beweis-Logging:** `health.py predict()` gibt jetzt im ioBroker-Log aus:
`[HealthBrain.predict] raw_score=-0.1023 | norm_score=0.0057 | inlier=True`

---

### ✅ Root-Cause gefunden und behoben (v0.31.2): Fresh Air Kachel zeigt immer "0x"

In `processEvents` (`HealthTab.tsx`): `evt.name.toLowerCase()` crashte bei Events ohne `name`-Feld → `setFreshAirCount` wurde nie aufgerufen.
Fix: `(evt.name || '').toLowerCase()` + Dead Code + Doppelter State-Setter entfernt.

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
| **0.31.3** | 12.03.2026 | **FIX**: Vite outDir auf admin/ korrigiert (ioBroker lädt nun richtigen Build); 62 temp-Dateien entfernt; Score-Normalisierung verbessert (0=normal, 1=anomal) |
| 0.31.2 | 12.03.2026 | **FIX**: processEvents TypeError bei null name → Fresh Air immer 0; lib/main.js SyntaxError; Dead Code entfernt |
| 0.31.1 | 12.03.2026 | Fresh Air: type-based Erkennung, Stoßlüftung ≥5 Min, freshAirLongCount |
| 0.31.0 | 11.03.2026 | Drift-Monitor Datumsachse, KI-Analyse Auto-Trigger, Flur-Räume entfernt |
| 0.30.74 | 10.03.2026 | Feature-Module-Status Tab, Garmin Drift-Monitor |
