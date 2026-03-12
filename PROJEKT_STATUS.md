# PROJEKT STATUS - ioBroker Cogni-Living (AURA)
**Letzte Aktualisierung:** 12.03.2026 | **Version:** 0.31.6 (Phase 1: Medizinische Perspektive)

---

## 🗓️ Sitzung 12.03.2026 — Phase 1: Medizinische Perspektive (v0.31.6)

### ✅ Abgeschlossen

**1a — Datenmodell `healthProfiles` in `io-package.json`:**
- 14 Krankheitsprofile als native Config angelegt: `fallRisk`, `dementia`, `frailty`, `depression`, `diabetes2`, `sleepDisorder`, `cardiovascular`, `parkinson`, `copd`, `socialIsolation`, `epilepsy`, `diabetes1`, `longCovid`, `bipolar`
- Jedes Profil: `{ enabled: false, sensitivity: "medium" }`

**1b — Sensor-Validierungslogik (`diseaseProfiles.ts`):**
- Neues Modul: `src-admin/src/components/medical/diseaseProfiles.ts`
- 14 vollständige Krankheitsprofile mit klinischer Evidenz (Literaturzitate)
- Sensor-Anforderungen (required + optional) pro Krankheitsbild
- `validateDiseaseReadiness()`: prüft vorhandene Sensoren gegen Anforderungen
- `validateAllProfiles()`: validiert alle 14 Profile auf einmal
- Markt-Scores (Einperson + Mehrperson), Machbarkeit-Flags, FP2-Empfehlung

**1c + 1d — MedicalTab.tsx (neue "Medizinische Perspektive"):**
- Neuer Tab "Medizinisch" (MedicalServicesIcon, pink #e91e63) in `app.tsx`
- Sidebar (320px): Krankheiten gruppiert nach Senioren/Erwachsene/Kinder
- Toggle-Switch pro Krankheit mit Ampel-Badge (🟢/🟡/🔴)
- Kollabierbare Sensor-Schnellansicht pro Karte
- Rechtes Panel: Disease-Dashboard mit:
  - Sensor-Bereitschaft Progress-Bar
  - Fehlende/vorhandene Sensoren Banner
  - Klinische Evidenz
  - Relevante Metriken-Karten (verknüpft mit Gesundheit-Tab)
  - Mehrpersonen-Machbarkeit-Hinweis
  - Markt-Score Visualisierung
- Sensor-Validierungs-Dialog mit vollständiger Checkliste + Kaufhinweisen
- FP2-Empfehlung für Krankheiten die Multi-Person-Tracking benötigen
- Wichtiger Disclaimer: kein Diagnose-System

**Build & Deploy:**
- `npm run build` ✅ (Vite 7.2.4, 8.45s)
- `npm run build:backend:dev` ✅
- `iobroker upload cogni-living` ✅

### 🔧 Offene Baustellen
- Phase 2: Krankheits-Risiko-Score Aggregation in `HealthBrain.compute_disease_scores()` (Python)
- Phase 2: Disease-spezifische Dashboard-Kacheln mit echten ioBroker-States
- Phase 3: Proaktives Screening / Reverse-Diagnose
- Phase 4: Aqara FP2 als neuer Sensortyp `presence_radar_zoned` im Recorder

### 🎯 Nächster logischer Schritt
- Phase 2: Backend — `compute_disease_scores()` im HealthBrain implementieren
- Sturzrisiko + Demenz + Frailty als erste drei vollständige Profile mit echten Score-Werten

### 📊 Medizinische Perspektive — Krankheitsprofile

| Krankheit | Zielgruppe | Score 1P | Score MP | Machbarkeit MP |
|-----------|-----------|---------|---------|----------------|
| Sturzrisiko | Senior | 98 | 90 | Sehr gut |
| Demenz | Senior | 97 | 49 | Schwierig |
| Frailty | Senior | 92 | 46 | Schwierig |
| Diabetes T2 | Senior | 80 | 60 | Eingeschränkt |
| Schlafstörungen | Alle | 78 | 59 | Eingeschränkt |
| Depression | Erwachsene | 75 | 38 | Schwierig |
| Herzinsuffizienz | Senior | 75 | 38 | Schwierig |
| COPD | Senior | 72 | 36 | Schwierig |
| Soz. Isolation | Senior | 70 | 7 | N/A |
| Epilepsie | Kinder | 68 | 76 | Sehr gut |
| Parkinson | Senior | 65 | 52 | Eingeschränkt |
| Diabetes T1 | Kinder | 65 | 72 | Sehr gut |
| Long-COVID | Erwachsene | 62 | 31 | Schwierig |
| Bipolar | Erwachsene | 58 | 29 | Schwierig |

---

## Session 02.03.2026 - Version 0.31.5 + 0.31.6

### Abgeschlossen

**Fresh Air Stoesslueftungs-Erkennung gefixt (v0.31.5):**
- reshAirLongCount (>= 5 Min Lueftung) war in processEvents und loadWeekData nicht berechnet
- Fix: vollstaendige Open/Close-Pairing-Logik in HealthTab.tsx implementiert
- doorOpenMap trackt geoeffnete Sensoren per sensorId, bei Schliessen wird Dauer geprueft
- Noch-offene Fenster mit >= 5 Min zaehlen ebenfalls als Stoesslueftung

**Tageszeit-Normalisierung im Aktivitaets-Belastungsdiagramm (v0.31.6):**
- Problem: heutiger Balken verglich Teilaktivitaet (z.B. 08:00-11:30) mit vollen 24h der Vortage
- Ansatz B umgesetzt in LongtermTrendsView.tsx:
  - currentSlot = floor((Stunde*60 + Minute) / 30) berechnet aktuelle 30-Min-Periode
  - Alle Tage: nur 	odayVector.slice(0, currentSlot+1) summiert (fair vergleichbar)
  - Normalisierung (Median = 100%) basiert ebenfalls auf partiellen Summen
- Visuelles Kennzeichen fuer heutigen Balken: tuerkiser Rand + halbtransparent + Tooltip "Bis HH:MM Uhr (laufend)"
- Cell-Komponente aus Recharts fuer individuelle Balkenfarben importiert
- Build erfolgreich, keine Linter-Fehler

### Offene Baustellen

| Problem | Prioritaet | Beschreibung |
|---|---|---|
| Python Bridge Timeout | MITTEL | python_bridge.js hat 10s Timeout, Frontend wartet 30s - Drift kann abbrechen |
| LSTM stuendliche Erwartung | NIEDRIG | Geplant - zeitlich-bewusstes Anomalie-Modell |

### Naechster logischer Schritt

1. Adapter in ioBroker neu starten (damit io-package.json v0.31.6 geladen wird)
2. Admin UI neu laden (Strg+F5) - Build ist bereits in dmin/ abgelegt
3. KI-Analyse triggern ("System pruefen") - dann ist heutiges History-File aktuell
4. Aktivitaets-Balkendiagramm pruefen: heutiger Balken sollte tuerkisen Rand haben

---

---

## 🗓️ Sitzung 12.03.2026 — Version 0.31.4

### ✅ Abgeschlossen

**Morning Briefing Root-Cause gefunden und behoben (seit Wochen offen!):**
- `subscribeStates('analysis.triggerBriefing')` fehlte komplett in `main.js`
- ioBroker ruft `onStateChange` nur für subscribed States auf — da nie subscribed, wurde der Handler nie aufgerufen
- Gleiches Problem für `analysis.triggerWeeklyBriefing`
- Fix: beide subscribeStates in `src/main.js` ergänzt (Zeile 142-143)

**Obfuskierung reaktiviert:**
- `src/` war veraltet — Sync von aktuellen `lib/` und root `main.js` → `src/`
- `npm run build:backend:prod` ausgeführt → alle `.js`-Dateien in `main.js` + `lib/` unleserlich
- Workflow ab jetzt: Quellcode in `src/` bearbeiten, dann `npm run build:backend:prod` vor Commit

### 🔧 Offene Baustellen

| Problem | Priorität | Beschreibung |
|---|---|---|
| `freshAirLong` in `loadWeekData` | 🟡 MITTEL | Wochenansicht berechnet Stoßlüftung noch nicht |
| Python Bridge Timeout | 🟡 MITTEL | 10s Timeout vs. 30s Frontend → Drift kann abbrechen |
| Aktivitäts-Balken Tagesvergleich | 🟡 MITTEL | Balken nur bis aktuelle Uhrzeit vergleichen |

### 🎯 Nächster logischer Schritt

1. Adapter v0.31.4 von GitHub laden, neu starten
2. Warten bis 08:00 Uhr morgen → Morning Briefing sollte jetzt kommen
3. Im ioBroker-Log bei Adapter-Start nach `Briefing geplant für 8:00` suchen
4. Danach: `freshAirLong` in `loadWeekData` + Python Bridge Timeout

---

## 🗓️ Sitzung 12.03.2026 — Version 0.31.3

### ✅ Abgeschlossen

**Root-Cause des "falschen Builds" gefunden — Fresh Air endlich wirklich gefixt:**
- ioBroker serviert Admin UI aus `admin/`, Vite baute aber immer in `src-admin/build/`
- Deshalb lud ioBroker stets `index-DaLhtVVS.js` (ALT) — egal was wir in `src-admin/build/` änderten
- Fix: `vite.config.mjs` → `outDir: '../admin'` (zukünftige Builds gehen direkt ins richtige Verz.)
- `admin/assets/index-DaLhtVVS.js` entfernt, `index-CBIshDQD.js` dorthin kopiert
- `.gitignore`: `src-admin/build/` wird nicht mehr getrackt

**Repo-Bereinigung:**
- 62 temporäre `_*.js`, `_*.ps1`, `old_*.*` Skripte aus dem Repo entfernt

**Score-Normalisierung verbessert:**
- `health.py predict()`: Neue Formel → `0.0 = normal, 0.5 = mäßig anomal, 1.0 = stark anomal`
- Beweis-Logging: `[HealthBrain.predict] raw_score=... | norm_score=... | inlier=...` im ioBroker-Log sichtbar
- Alter Score `0.10` für normale Tage war kein Bug, aber missverständlich skaliert

**PROJEKT_STATUS.md auf Append-Only umgestellt:**
- Cursor Rule aktualisiert: neue Sitzungen werden oben eingefügt, alte bleiben erhalten
- Vollständiges Langzeit-Gedächtnis über Kontext-Resets hinweg

### 🔧 Offene Baustellen

| Problem | Priorität | Beschreibung |
|---|---|---|
| Morning Briefing Uhrzeit | 🔴 HOCH | User bekommt Pushover-Briefing nicht um 08:00 Uhr — mehrfach besprochen, noch nicht zuverlässig gelöst |
| `freshAirLong` in `loadWeekData` | 🟡 MITTEL | Berechnung in HealthTab.tsx fehlt für den Weekly-Data-Pfad (~Zeile 464) |
| Python Bridge Timeout | 🟡 MITTEL | `python_bridge.js` hat 10s Timeout, Frontend wartet 30s → Drift-Berechnung kann abbrechen |
| Aktivitäts-Belastung Tagesvergleich | 🟡 MITTEL | User-Idee: Balken nur bis aktuelle Uhrzeit vergleichen (Time-of-Day Normalisierung) |
| LSTM stündliche Erwartung | 🟢 NIEDRIG | Geplant — zeitlich-bewusstes Anomalie-Modell |

### 🎯 Nächster logischer Schritt

1. Adapter v0.31.3 von GitHub laden, neu starten
2. Admin UI öffnen → Fresh Air Kachel sollte jetzt korrekt zählen
3. Im ioBroker-Log nach `[HealthBrain.predict]` suchen → Score-Beweis sichtbar
4. Danach: `freshAirLong` in `loadWeekData` berechnen + Morning Briefing debuggen

---

## 🗓️ Sitzung 12.03.2026 — Version 0.31.2

### ✅ Abgeschlossen

**Root-Cause Fresh Air "0x" behoben:**
- `processEvents` in `HealthTab.tsx` crashte bei `evt.name.toLowerCase()` wenn `evt.name == null`
- Fix: `(evt.name || '').toLowerCase()` an Zeilen 752 + 757
- Dead Code (alte Keyword-Matching-Logik) und doppelter `setFreshAirLongCount`-Aufruf entfernt
- `lib/main.js`: Doppelter `const FRESH_AIR_MIN_MS` Block entfernt (SyntaxError)

**Bestätigter Datenfluss:**
- `events.history` enthält Door-Events: `type: "door"`, `value: 1` (numerisch) ✅
- `processEvents` Filter: `evt.type === 'door' && evt.value === 1` korrekt ✅

### 🔧 Offene Baustellen (zum damaligen Zeitpunkt)
- Browser lud noch alten Build (Index-DaLhtVVS.js) trotz Inkognito → Root-Cause unklar (→ in v0.31.3 gelöst)

---

## 🗓️ Sitzung 11.03.2026 — Version 0.31.0 / 0.31.1

### ✅ Abgeschlossen

- Fresh Air: Sensor-Typ-basierte Erkennung (`evt.type === 'door'`) statt Keyword-Matching
- Stoßlüftung ≥5 Min Zähler (`freshAirLongCount`) berechnet und angezeigt
- Drift-Monitor: X-Achse zeigt jetzt Kalenderdaten (TT.MM) statt Indices
- KI-Analyse Auto-Trigger: täglich 08:05 + 20:00 Uhr via `node-schedule`
- "Flur-Räume" TextField aus Settings entfernt
- PROJEKT_STATUS.md Cursor Rule erstellt

### 🔧 Offene Baustellen (zum damaligen Zeitpunkt)
- Morning Briefing kommt immer noch nicht um 08:00 (mehrfach besprochen)
- Fresh Air zeigt noch 0x (→ Root-Cause in v0.31.2 / v0.31.3 gefunden)

---

## 🗓️ Sitzung 10.03.2026 — Version 0.30.74

### ✅ Abgeschlossen

- Feature-Module-Status Tab im System-Bereich (Übersicht aller Algorithmen mit Status-Icons)
- Garmin-Style Drift-Monitor mit Page-Hinkley-Test (CUSUM-ähnlich)
- Aktivitäts-Level-Normalisierung: persönlicher Median = 100%
- Drift-Monitor v2: 4 Metriken (Aktivität, Ganggeschwindigkeit, Nacht-Unruhe, Raum-Mobilität)
- Farbkodierung: Drift-Monitor-Linien stimmen mit den Kachel-Farben überein
- Layout-Verbesserung: Kacheln gruppiert, Drift-Monitor als Zusammenfassung abgesetzt
- Tooltip-Erklärtexte für alle Kacheln (Fragezeichen-Icon)

---

## 🏗️ Funktionierende Basis (Stand v0.31.3)

| Feature | Status | Version |
|---|---|---|
| Sensor-Typ-System (`type: "door"`) | ✅ | recorder.js |
| Frischluft-Zählung (Öffnungen heute) | ✅ | v0.31.2 |
| Stoßlüftung ≥5 Min Zähler | ✅ | v0.31.1 |
| Admin UI baut korrekt nach `admin/` | ✅ | v0.31.3 |
| Obfuskierung (main.js + lib/) | ✅ | v0.31.4 |
| Drift-Monitor mit Datumsachse | ✅ | v0.31.0 |
| KI-Analyse Auto-Trigger (08:05 + 20:00) | ✅ | v0.31.0 |
| Tages/Nacht Anomalie-Score | ✅ | v0.30.x |
| Ganggeschwindigkeit (Flur-Transit) | ✅ | v0.28.0 |
| Raum-Mobilität Kachel | ✅ | v0.30.x |
| Nacht-Unruhe Kachel | ✅ | v0.30.x |
| Bad-Nutzung Kachel | ✅ | v0.28.0 |
| Feature-Module-Status Tab | ✅ | v0.30.74 |
| Garmin-Style Drift-Monitor | ✅ | v0.30.74 |
| Pushover Briefing (08:00 + 20:00) | ✅ | v0.31.4 — subscribeStates fehlte (Root-Cause gefunden) |

---

## 📦 Versionshistorie

| Version | Datum | Hauptänderung |
|---|---|---|
| **0.31.4** | 12.03.2026 | **FIX**: Morning Briefing subscribeStates fehlte → Briefing nie gefeuert; Obfuskierung reaktiviert |
| 0.31.3 | 12.03.2026 | Vite outDir → `admin/` (falsches Build gefixt); Score-Normalisierung; 62 temp-Dateien entfernt |
| 0.31.2 | 12.03.2026 | processEvents TypeError (null name) → Fresh Air 0x; lib/main.js SyntaxError |
| 0.31.1 | 12.03.2026 | Fresh Air type-basiert; Stoßlüftung ≥5 Min; freshAirLongCount |
| 0.31.0 | 11.03.2026 | Drift-Monitor Datum-Achse; Auto-KI-Analyse; Flur-Räume entfernt |
| 0.30.74 | 10.03.2026 | Relative Aktivitäts-Normalisierung; Page-Hinkley Drift-Monitor; Feature-Tab |
| 0.30.73 | ~08.03.2026 | Sparkline Tooltip fixes; Nacht-Text JSON-Parsing |
| 0.30.x | Feb/März 2026 | Diverse Kacheln, Layout, Farben, Tooltips |
| 0.28.0 | Jan 2026 | Ganggeschwindigkeit, Bad-Nutzung, Frischluft |
| 0.25.x | Dez 2025 | KI-Berichte (Gemini), Pushover |

---

## 🔑 Architektur-Grundsätze

- **Backend**: Node.js (ioBroker Adapter) → `main.js` ist Einstiegspunkt (NICHT `lib/main.js`)
- **Python-Service**: Scikit-Learn, NumPy — IsolationForest, lineare Regression, Page-Hinkley
- **Admin UI**: React + TypeScript + Recharts — baut nach `admin/` (seit v0.31.3)
- **ioBroker serviert**: `admin/` Verzeichnis (NICHT `src-admin/build/`)
- **Obfuskierung**: Nur Backend (`main.js` / `lib/`) via `javascript-obfuscator` bei `npm run build:prod`
- **Sensor-Typen**: `type: "door"` für Türen/Fenster, kein Keyword-Matching
- **Versionierung**: Immer beide `package.json` UND `io-package.json` bumpen
