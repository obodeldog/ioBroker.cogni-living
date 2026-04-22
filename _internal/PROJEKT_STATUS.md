# PROJEKT STATUS - ioBroker Cogni-Living (AURA)
**Letzte Aktualisierung:** 22.04.2026 | **Version:** 0.33.194

---

## 📍 Sitzung 22.04.2026 — Version 0.33.194

### ✅ Abgeschlossen
- **[bedEntryTs] "Ins Bett gegangen"-Erkennung in `computePersonSleep`**: Neues Feld `bedEntryTs` erkennt den Zeitpunkt, zu dem eine Person das Bett betritt — unabhängig vom Einschlafzeitpunkt. Priorität: FP2/Radar (erste `isFP2Bed`-Event ab 18 Uhr) → Vibration (erste Aktivität mit Folge-Event ≤5 Min) → PIR (erste Schlafzimmer-Bewegung ohne Abgang innerhalb 10 Min). Dient als Balken-Startpunkt im Frontend (gelbes "Wachliegen"-Segment vor der Einschlafzeit).
- **[OC-31 Stage 2] Zustandsmaschine in `computePersonSleep`**: Neue `_smWakePhases`-Berechnung erkennt alle Abwesenheiten NACH `sleepStart` (min. 5 Min Außerhalb-Aktivität → Rückkehr ins Schlafzimmer). Der `sleepStart` bleibt dabei eingefroren — jede Abwesenheit (kurz oder lang) wird als "Wachphase" erfasst. Dies löst das "PC-um-Mitternacht"-Szenario: 21:30 ins Bett → 22:08 eingeschlafen → 23:50-02:30 am PC → sleepStart bleibt 22:08, PC-Zeit als Wake-Phase sichtbar.
- **[UI] Gelbes Vor-Schlaf-Segment**: Im Schlafbalken erscheint ein gelbes "Wachliegen"-Segment von `bedEntryTs` bis `sleepStart`, wenn die Differenz >5 Min beträgt. Label zeigt "🛏 HH:MM" (Ins-Bett-Zeit) an der linken Seite der Zeitachse.
- **[UI] Wake-Phasen-Overlay**: Lange Abwesenheiten nach `sleepStart` werden als gelbe Blöcke (`smWakePhases`) per `position:absolute`-Overlay auf dem Schlafbalken dargestellt mit Tooltip "Wachphase: HH:MM – HH:MM (N Min)".
- **[Version] Bump auf 0.33.194** in `io-package.json` + `package.json`.

### Nächster logischer Schritt
- OC-31 Stage 2 beobachten: Erkennt die Zustandsmaschine die PC-Abwesenheit korrekt als Wachphase?
- `bedEntryTs` validieren: Stimmt der erkannte "Ins-Bett"-Zeitpunkt mit der Wahrnehmung überein?
- Ggf. OC-31 Stage 3 (LSTM/HMM) vorbereiten wenn Trainingsdaten vorhanden

---

## 📍 Sitzung 22.04.2026 — Version 0.33.191

### ✅ Abgeschlossen
- **[OC-31 Stage 1] Nacht-Aufstehen-Filter in `computePersonSleep`**: Neuer regelbasierter Pre-Filter erkennt kurze nächtliche Abwesenheiten (Toilettengang, Medikament etc.) und entfernt die dadurch verursachten Motion-Kandidaten aus dem Einschlaf-Pool. Abgang: Motion-Sensor außerhalb Schlafzimmer ≤4 Hops (personTag-unabhängig, Shared-Sensoren eingeschlossen). Rückkehr: Motion in bedroomLocations innerhalb 20 Min. Garmin/FP2/vib_refined (prio ≤ 3) werden nie gefiltert. Funktioniert identisch für Ein- und Mehrpersonenhaushalt.
- **[OC-31 UI] Debug-Badge in HealthTab**: Unterhalb der Einschlafzeit-Kachel erscheint ein blaues 🚶-Badge das erkannte `kurzNachtaufstehen`-Events mit Uhrzeiten anzeigt (Entwicklungsmodus).
- **[OC-31 Doku] HANDBUCH.md**: Vollständige Algorithmus-Dokumentation mit ASCII-Diagramm, Schritt-für-Schritt-Ablauf, Ein-/Mehrpersonenhaushalt-Vergleich und bekannten Einschränkungen.
- **[OC-31 Testing] TESTING.md**: 10 Testfälle in Testbereich 21 (T-NA1 bis T-NA10) für alle Szenarien.
- **[BRAINSTORMING] OC-31 Stage 2+3**: Stage 2 (Zustandsmaschine) und Stage 3 (LSTM/HMM) dokumentiert mit Architekturhinweisen und Datenbedarf.
- **[BRAINSTORMING] OC-32**: Topologie-Matrix sensor-aware machen — Problem und Lösungsansatz für `hopToNearestSensor()` dokumentiert.
- **[BRAINSTORMING] Hop-Lücken-Hinweis**: Architekturhinweis für alle Hop-basierten Algorithmen zur großzügigen N-Wahl bei Transiträumen ohne Sensoren.

### Nächster logischer Schritt
- Roberts nächste Nacht beobachten: OC-31 sollte 02:44-02:51 als kurzNachtaufstehen erkennen und filtern → sleepStart bleibt bei 21:30

---

## ⛔ PFLICHT-REGEL FÜR DEN AI-ASSISTENTEN

**Keine Code-Änderungen ohne explizite Bestätigung des Nutzers.**

- Algorithmus-Änderungen (Prioritäten, Schwellwerte, Logik-Entscheidungen): IMMER erst erklären, diskutieren, Zustimmung einholen — dann erst umsetzen.
- Ausnahme: reine Dokumentations-/Formatänderungen, Versionsbumps nach besprochener Änderung.
- Bei Bugs oder Auffälligkeiten: Analyse und Erklärung liefern, Lösungsvorschlag machen — aber WARTEN bis der Nutzer "ja, mach das" sagt.

---

## ✅ Sitzung 22.04.2026 — Version 0.33.190

### ✅ Abgeschlossen
- **[Fix] vib_refined als trusted Fallback im Cluster-Algorithmus**: Wenn kein Garmin/FP2/fp2_vib vorhanden ist UND `vib_refined` (Matratze-Stillheit-Sensor) einen Zeitstempel hat → wird dieser direkt als Einschlafzeit übernommen, ohne Clustering. Verhindert dass Bewegungsereignisse anderer Personen im Mehrpersonenhaushalt (z.B. Ingrid aktiv um 01:58/02:46) die korrekte frühe Einschlafzeit (Robert vib_refined 21:30) überschreiben. Reale Fallanalyse: Gondelsheim 22.04.2026 — Robert korrekt um 21:30 im Bett, Algorithmus hatte fälschlicherweise 02:46 gewählt.

### Nächster logischer Schritt
- Adapter updaten und nächste Nacht beobachten: Roberts Einschlafzeit sollte ~21:30 zeigen statt 02:46

---
## ✅ Sitzung 21.04.2026 — Version 0.33.189

### ✅ Abgeschlossen
- **[OC-16] MAE-Ranking Sensorquellen**: In `saveDailyHistory()` wird nach jedem Kalibrierungseintrag ein MAE-Ranking berechnet (ab 7 Referenz-Nächten). Für jede Einschlaf- und Aufwachquelle wird der mittlere absolute Fehler (in Minuten) vs. Garmin/Override-Referenz berechnet und in `analysis.health.sleepCalibrationMAE` gespeichert. Im HealthTab erscheint eine aufklappbare Sektion "QUELLEN-GENAUIGKEIT" mit Medaillen-Ranking (🥇🥈🥉) für Einschlaf- und Aufwachzeit getrennt.
- **[OC-30 Stufe 1] Override-Zähler**: Wenn ein Nutzer manuell eine Einschlafquelle überschreibt, wird der Zähler für diese Quelle in `analysis.health.sourceOverrideHistory` inkrementiert (abgeleitet aus dem Kalibrierungslog). Im HealthTab sichtbar als grüne Chips ("Radar+Vibration: 3×").
- **[OC-30 Stufe 2] Override als Ground Truth**: Kalibrierungseinträge haben jetzt ein neues Feld `referenceSource` ('garmin' | 'manual_override' | null) und `absDeltaToRefMin` (Deltas gegen Garmin ODER manuellen Override). Wenn kein Garmin vorhanden aber Override gesetzt: wird der Override-Zeitstempel als Referenz behandelt — Nutzer ohne Smartwatch kalibrieren über ihre eigenen Korrekturen.

### Nächster logischer Schritt
- Nach 7 Nächten mit Garmin oder manuellen Overrides: Sektion erscheint automatisch in HealthTab

---
## ✅ Sitzung 21.04.2026 — Version 0.33.188

### ✅ Abgeschlossen
- **[Freeze-Fix] Sleep-Abend-Sperre fuer Multi-Person ohne Garmin/Vibration**: In `saveDailyHistory()` wird jetzt eine neue Freeze-Bedingung geprüft: wenn die bestehende JSON eine vollständige Nacht hat (sleepWindowStart + sleepWindowEnd vor 14:00, Mindestdauer 3h) UND die aktuelle Uhrzeit zwischen 18:00 und 22:00 liegt UND keine neuen Bett-Events (isFP2Bed / isVibrationBed / isBedroomMotion) in der neuen Nacht-Periode vorhanden sind -> Datei wird NICHT überschrieben. Behebt den Bug dass bei Multi-Person-Haushalten ohne Garmin/Vibration die tägliche JSON um 18:00 mit einer leeren Abend-Analyse überschrieben wurde -> "Bett war leer" für Heute und Vortag.
- **[TESTING.md] Testbereiche 18-20 hinzugefügt**: OC-24 Sensor-Rauschen, OC-12 Gateway-Ausfall, OC-11 Gelernte Raumübergangszeiten, Sleep-Freeze Abend-Sperre — je 4-7 Testfälle mit ID, Erwartungswert, Prüfdatum-Spalte.

### Nächster logischer Schritt
- Nächste Nacht abwarten: um 19:00 Uhr sollte der Freeze-Log erscheinen, HealthTab zeigt korrekte Vorherige Nacht statt "Bett war leer"

---
## ✅ Sitzung 21.04.2026 — Version 0.33.187

### ✅ Abgeschlossen
- **[OC-12] Gateway-Cluster-Erkennung**: In `checkSensorHealth()` werden offline Sensoren nach Gateway-Prefix (`adapter.instance`) gruppiert. Wenn >= 2 Sensoren desselben Gateways gleichzeitig offline sind -> einzelne Sensor-Alerts werden zu einem gebündelten 'Gateway X ausgefallen'-Alert zusammengefasst. State `analysis.safety.gatewayOutage` (JSON). Im HealthTab erscheint ein oranges 🔌-Banner 'Gateway-Ausfall erkannt — Schlafanalyse evtl. unvollständig' mit Gateway-Name und betroffenen Sensoren.
- **[OC-11] Gelernte Raumübergangszeiten**: In `_checkSpatialImpossibility()` wird fuer jedes Raum-Paar der Zeitdelta jeder Transition aufgezeichnet (`this._roomTransitionTimes`). Ab 5 Samples: adaptiver Schwellwert = p90 * 1.3 statt festem 5s-Wert. Persistiert in `LTM.roomTransitionTimes` (JSON) nach jedem History-Save. Beim Start geladen. Loest das Problem dass kleine Wohnungen mit kurzen Wegen falsche Mehrpersonen-Erkennungen ausloesen.

---

## ✅ Sitzung 21.04.2026 — Version 0.33.186

### ✅ Abgeschlossen
- **[OC-24] Sensor-Rauschen-Erkennung**: In `saveDailyHistory()` wird das Schlaffenster (22:00-08:00) ausgewertet. Sensoren die >= 3x den Median aller Sensoren feuern UND mindestens 10 Events haben, werden als `noisySensor` eingestuft. Werden in `analysis.safety.noisySensors` (JSON) gespeichert, im taeglich JSON-Snapshot unter `noisySensors[]` archiviert, und temporaer aus der `haus_still`-Berechnung ausgeschlossen (`noisySensorIds` Parameter in `computePersonSleep`). Im Gesundheits-Tab erscheint ein oranges Warnsymbol (Blitz) mit Sensor-Name, Ausloeseanzahl und Hinweis 'temporaer aus haus_still'.
- **[Docs] OC-7 vollstaendig markiert**: Schlafphasen-Timeline (horizontal, Tief/Leicht/REM/Wachliegen) ist implementiert und bestaetigt (Screenshot 21.04.2026). Status in BRAINSTORMING.md auf 'vollstaendig' aktualisiert.
- **[Docs] OC-26 auf NIEDRIG/Nice-to-have gesetzt**: Sensor-Onboarding-Assistent ist kein akutes Problem, erst relevant wenn Produkt an unerfahrene Kunden verkauft wird.

### Naechster Schritt
- Adapter neu starten. Noisy-Sensor-Detection laeuft ab naechstem `saveDailyHistory`-Aufruf (jede Stunde und nach Nacht-Abschluss)

---

## ✅ Sitzung 21.04.2026 — Version 0.33.185

### ✅ Abgeschlossen
- **[OC-21] personTag-Filter fuer outsideBedEvents**: Events mit fremdem personTag werden nicht mehr komplett ignoriert, sondern als `'other_person'` klassifiziert (blauer Marker im Schlafbalken). Shared-Sensoren (kein personTag) bleiben normal. Neues Cluster-Feld `onlyOtherPerson`: wenn alle Events im Cluster einer anderen Person gehoeren -> `type: 'other_person'`.
- **[Docs] OC-23 aus BRAINSTORMING.md geloescht** (vollstaendig implementiert, dokumentiert in PROJEKT_STATUS.md)
- **[Docs] OC-30 'Quellen-Feedback-Loop'** in BRAINSTORMING.md aufgenommen (3 Stufen: Quellen-Zaehler, Override als Ground Truth, gelernter Prior)

### Naechster Schritt
- Adapter neu starten, Nacht beobachten: blaue Dreiecke fuer Kinderzimmer-Sensor erscheinen statt keine Anzeige

---

## 🗓️ Sitzung 21.04.2026 — Version 0.33.184

### ✅ Abgeschlossen
- **[Fix] Morning Briefing "Noch keine Nacht-Daten" — Root Cause**: `adapter._historyDir` wurde **nie gesetzt**. `saveDailyHistory()` berechnet den Pfad intern via `utils.getAbsoluteDefaultDataDir()`, speichert ihn aber nicht als Property. `ai_agent.js sendMorningBriefing()` griff auf `adapter._historyDir || ''` zu → immer leerer String → kein Datei-Lookup möglich → seit Wochen immer dieselbe Fallback-Meldung. Fix: `this._historyDir` wird jetzt am Anfang von `startSystem()` gesetzt.
- Fallback-Text von "bitte sicherstellen dass Sensoren konfiguriert sind" auf "Keine Schlaf-Daten für die letzte Nacht gefunden" geändert (weniger alarmierend, treffender).
- Warn-Log im Briefing wenn `dataDir` leer (erleichtert Debugging).

### 🎯 Nächster logischer Schritt
- Adapter updaten → morgen früh sollte erstmals ein echter Guten-Morgen-Text mit Schlaf-Daten kommen

---

## 🗓️ Sitzung 21.04.2026 — Version 0.33.183

### ✅ Abgeschlossen
- **[Fix] DeadMan Nacht-Schutz**: `triggerPreWarn` verschiebt sich in Schlafzimmern (schlaf/bed/guest) vor 09:00 Uhr automatisch auf 09:00 → kein NOTFALL-ALARM mehr um 04:02 während normaler Schlafphasen. Logik: wenn `nowH < 9 || nowH >= 22` und Raum ist Schlafraum → defer bis 09:00.
- **[Fix] Sensor-Ausfall False Positives (Hue/Lichter)**: `light`, `dimmer`, `switch`-Typen werden in `checkSensorHealth()` übersprungen. Hue-Lampen und Dimmer sind Aktoren, senden keine periodischen Events → False Positives "Hue on (EG Wohnen): seit 8h inaktiv" beseitigt. Threshold-Einträge für `light`/`dimmer` (8h) ebenfalls entfernt.
- **[Fix] fp2WakeTs per Person**: Per-Person-Aufruf von `computePersonSleep` hatte `fp2WakeTs: null` hart kodiert → FP2-Aufwachzeit wurde nie genutzt. Fix: `sleepWindowCalc.firstEmpty || null` (identisch zum globalen Aufruf). Jetzt funktionieren `fp2_vib`/`fp2_other` auch im Mehrpersonenhaushalt.
- **[Fix] haus_still Hop-Filter (OC-24/Fix-1)**: In `hausStillTs`-IIFE innerhalb `computePersonSleep` Hop-Filter eingebaut. `bedroomLocations` und `hopDistFn` als neue optionale Parameter. Sensoren >2 Hops vom Schlafzimmer werden aus der Stille-Prüfung ausgeschlossen → OG Flur blockiert haus_still nicht mehr.
- **[Fix] io-package.json Garmin-Defaults**: Default-Pfade für garminSleepScoreStateId/garminSleepStartStateId etc. auf leer gesetzt (kein "garmin.0.dailysleep..." als Default).
- **[Cleanup] BRAINSTORMING.md**: Implementierte OCs (OC-3, OC-7, OC-17, OC-18, OC-22 Stufe 1) als ✅ markiert. AUFFAELLIGKEITEN.md: Fix (2) von Eintrag 10 als erledigt markiert.

### 🔧 Offene Baustellen
- AURA Sleep Score per-Person-Kalibrierung: derzeit immer `'uncalibrated'` — echte Logik (ab N Nächten Garmin-Referenz) noch nicht implementiert
- `fp2WakeTs` für Multi-Person mit mehreren FP2 (je Schlafzimmer): aktuell globaler FP2-Wert für alle Personen — reicht vorerst

### 🎯 Nächster logischer Schritt
- Adapter auf Server neu starten (Update-Button in ioBroker Admin drücken)
- Nacht beobachten: kein NOTFALL-ALARM mehr, keine Hue-Sensor-Ausfall-Meldungen

---

## 🗓️ Sitzung 20.04.2026 — Version 0.33.181

### ✅ Abgeschlossen
- **Wake-Override springt zurück (Bug)**: `_pwovAllowed = ['other','motion','override']` war viel zu kurz → Backend lehnte alle anderen Quellen (vibration_alone, motion_vib, fp2_vib usw.) ab und UI sprang zurück. Fix: alle 15 Quellen in Allowlist aufgenommen
- **Icon-Inkonsistenz**: Aufwach-Quellen-Button hatte `⌚` (Smartwatch) statt `⚙` (Zahnrad) und kleinere Pfeile `▴▾` statt `▲▼`. An 2 Stellen in HealthTab.tsx behoben
- **AURA Score Fallback**: `stagesWinEnd = wakeTs || null` → wenn wakeTs noch nicht erkannt, war Score-Berechnung übersprungen. Jetzt: `wakeTs || (wakeHardCap < now ? wakeHardCap : null)` als Fallback

### 🔧 Offene Baustellen
- AURA Score zeigt noch "—" wenn Adapter nicht mit v0.33.180/181 neugestartet → Adapter auf Server neu starten nach Update
- Garmin-Default-Felder in io-package.json sind vorausgefüllt → sollten leer sein (kein Garmin = kein Default)

### 🎯 Nächster logischer Schritt
- Adapter-Update auf Server prüfen und neu starten
- Garmin-Default-Felder aus io-package.json entfernen

---

## 🗓️ Sitzung 20.04.2026 — Version 0.33.180

### ✅ Abgeschlossen
- **Cluster-Algorithmus bestätigt**: JSON `2026-04-20_2G.json` zeigt `vib_refined: 21:32` als Gewinner statt früher `motion_vib: 00:32` — Algorithmus funktioniert perfekt
- **AURA SleepScore pro Person (HealthTab-Bug gefixt)**: `overrideData` setzte `sleepScore: null` explizit → Score wurde nie angezeigt. Fix: `pd.sleepScore ?? null` und `pd.sleepScoreRaw ?? null`
- **`sleepScoreCalStatus` pro Person**: Fehlte im `overrideData` komplett → kein "unkalibriert"-Badge. Fix: `pd.sleepScoreCalStatus || 'uncalibrated'` (|| statt ?? wegen leerer Strings)
- **Backend `result[person]`**: `sleepScoreCalStatus: 'uncalibrated'` wird jetzt gespeichert (persistiert in History-JSON)
- **v0.33.179**: `_wakeHardCapMs` Hotfix (vor `Object.keys(personSensorIds).forEach`)
- **v0.33.180**: SleepScore-Anzeige-Bug, SleepScoreCalStatus pro Person

### 🔧 Offene Baustellen
- `fp2WakeTs` für Mehrpersonenhaushalt: per-Person-Pfad hat kein FP2 → `fp2_vib`/`fp2_other` greifen nur bei FP2-Konfiguration
- AURA Sleep Score Kalibrierung per Person: Derzeit immer 'uncalibrated' — echte Per-Person-Kalibrierung (nach N Nächten) noch nicht implementiert
- `sleepWindowSource` in personData ist leer string — Frontend nutzt `sleepStartSource` als Fallback (korrekt), aber Feld könnte aufgeräumt werden

### 🎯 Nächster logischer Schritt
- Nach nächster Nacht (20./21.04.) prüfen ob Score korrekt als Zahl angezeigt wird (z.B. "89" mit "○ unkalibriert")
- Dann per-Person-Kalibrierungslogik evaluieren (ab wie vielen Nächten? Garmin-Referenz?)

---

## 🗓️ Sitzung 20.04.2026 — Version 0.33.178

### ✅ Abgeschlossen
- **[Fix] 6 Konsistenz-Bugs zwischen globalem Pfad und computePersonSleep()** beseitigt:
  1. `fp2WakeTs: sleepWindowCalc.firstEmpty` wird jetzt an globalen `_gR`-Aufruf übergeben (war `null`)
  2. `vibRefinedSleepStartTs` mapped jetzt korrekt auf `vib_refined` (war fälschlicherweise `fp2_vib`)
  3. `sleepStartSource` nutzt `_gR.sleepWindowSource` (war eigene falsche Kette ohne `vib_refined`/`gap60`)
  4. `sleepWindowSource` nutzt `_gR.sleepWindowSource` (war `fp2/haus_still/motion/fixed` ohne `vib_refined`)
  5. `sleepWindowOC7` nutzt `_gR.sleepWindowStart` als Fallback wenn FP2 null (bisher nur FP2/hausStill/motion)
  6. Globaler Wake-Block komplett durch `_gR.allWakeSources` + Garmin-Override ersetzt → "Schlafzimmer-BM" erscheint jetzt auch im Einpersonenhaushalt
- **[Feat] Cluster-basierte Einschlafzeit-Auswahl**: Statt blindem Top-Down-Priorität → Quellen innerhalb 90 Min bilden Cluster → beste Quelle aus Cluster (nach Direktheit: vib_refined=3, motion_vib=4). `motion_vib` Ausreißer (00:32 wenn alle anderen ~21:30) werden jetzt ignoriert.
- **[Feat] `motion_vib_wake` als neue Aufwach-Quelle**: Schlafzimmer-BM + Vibrations-Bestätigung (Pendant zu `fp2_vib` für Häuser ohne Radar). Zeigt an wenn BM-Abgang von Vib in den 30 Min davor begleitet wird.

### 🔧 Offene Baustellen
- `fp2WakeTs` für Mehrpersonenhaushalt: Im per-Person-Pfad ist `fp2WakeTs` noch null (kein FP2 per Person zugewiesen) → fp2_vib/fp2_other können nur greifen wenn FP2 konfiguriert ist
- AURA Sleep Score per Person prüfen ob korrekt übergeben wird

### 🎯 Nächster logischer Schritt
- Nacht 20./21.04. beobachten ob Robert jetzt korrekt ~21:32 als Einschlafzeit bekommt
- Aufwachquellen-UI auf Vollständigkeit prüfen (motion_vib_wake erscheint jetzt)

---

## 🗓️ Sitzung 19.04.2026 — Version 0.33.177

### ✅ Abgeschlossen
- **[Feat] Alle Wake-Quellen in computePersonSleep() integriert**: `vibAloneWakeTs`, `vibWakeTs`, `fp2VibWakeTs`, `fp2OtherWakeTs` werden jetzt innerhalb der shared Funktion berechnet. Ergebnis: identische Algorithmen für Ein- und Mehrpersonenhaushalt. Vibrations-Quelle `vibration_alone`, `vibration`, `fp2_vib`, `fp2_other` erscheinen jetzt auch bei Robert/Ingrid in der Aufwachquellen-UI.
- **[Fix] Wake-Prioritätskette erweitert**: `garmin > fp2_vib > fp2 > fp2_other > other > vibration_alone > motion`. `allWakeSources` hat jetzt 9 Einträge (war 5).
- **[Fix] Smartwatch pro Person UI**: `SensorList.tsx` zeigt jetzt zwei State-ID-Felder pro Person (`sleepStartId` + `wakeId`) statt altem Garmin-Präfix-Feld. Funktioniert mit Garmin, Samsung, Apple Watch, Fitbit, Polar etc.
- **[Fix] Versions-Kollision 0.33.176**: Zwei Commits hatten dieselbe Version → ioBroker erkannte kein Update → User sah alte UI. Gelöst durch Bump auf 0.33.177.

### 🔧 Offene Baustellen
- **Einschlafzeitquellen-Priorität**: "Bewegungsmelder + Vibration 03:19" wird vor "Matratze ruhig 22:18" bevorzugt — Prioritätskette prüfen
- **fp2WakeTs für Mehrpersonenhaushalt**: Im per-Person-Pfad ist `fp2WakeTs` noch null (kein FP2 per Person zugewiesen) → fp2_vib und fp2_other können nur greifen wenn fp2WakeTs von außen gesetzt wird

### 🎯 Nächster logischer Schritt
- Einschlafzeit-Prioritätsproblem analysieren: warum "motion_vib 03:19" vs "vib_refined 22:18"

---

---

## 🗓️ Sitzung 19.04.2026 — Version 0.33.176

### ✅ Abgeschlossen
- **[Fix] Typography-Import fehlte in SensorList.tsx**: `Typography` wurde in neuem Garmin-pro-Person-Code genutzt, aber nicht importiert → ganzer System-Tab crashed mit "TypeError: Typography is not defined". Behoben durch Hinzufügen zu MUI-Imports.
- **[Fix] TDZ-Fehler `nightVibrationCount` in saveDailyHistory**: `const nightVibrationCount` war bei Offset ~133088 deklariert, wurde aber bei ~95533 in der FROZEN-Vib-Prüfung (`if (_sleepFrozenMotionOnly && nightVibrationCount > 0)`) bereits genutzt. TDZ-Fehler tritt auf wenn `_sleepFrozenMotionOnly = true` (war zuvor immer `false`, heute erstmals `true`). Gefixt durch Verschieben der Deklaration VOR die Frozen-Vib-Prüfung — alle Abhängigkeiten (`todayEvents`, `sleepWindowCalc`) sind an der neuen Position verfügbar.
- **[Feature] PersonTag als Autocomplete-Dropdown**: Statt einfachem TextField nun `Autocomplete` mit `freeSolo` und `uniquePersonTags`-Optionen (berechnet aus bereits konfigurierten Sensoren). Verhindert Tippfehler, zeigt bestehende Personennamen als Vorschlag.

### 🎯 Nächster logischer Schritt
- Adapter neu starten und prüfen ob `History Save Error` weg ist
- System-Tab öffnen und testen ob er jetzt korrekt lädt
- PersonTag bei Sensoren eintragen → Garmin-pro-Person-Sektion erscheint automatisch

---

## 🗓️ Sitzung 19.04.2026 — Version 0.33.176 (b071238) [Hotfix-Runde 2]

### ✅ Abgeschlossen
- **[Fix] nightVibrationCount is not defined** (Hotfix): Erster Fix (1f98d5d) platzierte `const nightVibrationCount` INNERHALB des `if (_frozenStartShift > ...)` Blocks → im `else`-Branch nicht in scope → "is not defined". Zweiter Fix: `const` → `var` an URSPRÜNGLICHER Position (~133082). `var` ist function-scoped/hoisted, kein TDZ. Beim frühzeitigen Zugriff (pos ~95503) ist der Wert `undefined` → `nightVibrationCount > 0` = false → FROZEN-Vib-Check schlägt fehl (konservativ sicher). Nach Zuweisung bei ~133082 hat die Variable den korrekten Wert.
- **[Feature] Smartwatch pro Person: universelle State-IDs statt Garmin-Prefix**: Architektur verbessert — statt eines Adapter-Prefixes (nur Garmin) nun zwei vollständige State-IDs pro Person (Schlafbeginn + Aufwachen). Funktioniert mit Garmin, Samsung, Fitbit, Polar, Apple Watch etc. — solange Unix-ms-Timestamps geliefert werden.
- **[Fix] Encoding-Fehler in SensorList.tsx**: Garbled-Chars (PrÃ¤fix, fÃ¼r) in Labels und Placeholder ersetzt durch saubere ASCII/Unicode-Literale.
- **WARNUNG: Versionsnummer-Anzeige im Log**: Adapter zeigt v0.33.175 obwohl commit b071238 (= v0.33.176) läuft. ioBroker liest `this.version` aus der installierten `io-package.json` in der DB, nicht vom Dateisystem. Erst nach echtem "Adapter Update" in der Admin-UI synchronisiert sich das. Der Commit-Hash beweist die korrekte Version.

### 🔧 Offene Baustellen
- FROZEN-Vib-Check: wenn `_sleepFrozenMotionOnly = true` UND Vibrationsereignisse vorhanden → Stages werden NICHT neu berechnet (konservativ/sicher, aber nicht optimal). Zu beheben wenn Freeze-Logik überarbeitet wird.
- Einschlafzeitquellen-Priorität: "Bewegungsmelder + Vibration 03:19" wird vor "Matratze ruhig 22:18" bevorzugt — Prioritätskette prüfen

### 🎯 Nächster logischer Schritt
- PersonTags bei Robert/Ingrid eintragen → Smartwatch pro Person Sektion erscheint im System-Tab
- State-IDs für Garmin (Robert + Ingrid) dort eintragen
- Einschlafzeit-Priorität prüfen: `vib_refined` sollte höher priorisiert werden als `motion_vib`

---

## 🗓️ Sitzung 17.04.2026 — Version 0.33.175

### ✅ Abgeschlossen
- **[Refactoring] `computePersonSleep()` — zentrale Schlafanalyse-Funktion**: Architektur-Refactoring von duplizierter Logik (Ein- vs. Mehrpersonenhaushalt) zu einer gemeinsamen Funktion. `computePersonSleep(p)` kapselt alle Einschlaf-Kandidaten (vib_refined, gap60, fp2_vib, fp2, motion_vib, motion, last_outside, haus_still, garmin), die Prioritätskette, Aufwach-Logik, Schlafstadien-Klassifikation, AURA Sleep Score und OBE-Clustering. Wird sowohl für globale als auch per-Person-Analysen aufgerufen.
- **[Feature] Garmin-Zuweisung pro Person**: Neues Config-Feld `garminPersonAssignment` (Objekt: Person → Garmin-Adapter-Prefix). Backend liest async vor der personData-IIFE Garmin-Schlaf-/Aufwachzeiten für jede zugewiesene Person und übergibt sie an `computePersonSleep`. Plausibilitätsprüfung: Zeitstempel muss innerhalb des aktuellen Schlafanalyse-Fensters liegen.
- **[Feature] Frontend System-Tab: Smartwatch pro Person**: Neue UI-Sektion "Smartwatch pro Person (Mehrpersonenhaushalt)" im Wearable-Datenquellen-Accordion. Benutzer können per Textfeld jeder erkannten Person einen Garmin-Adapter-Prefix (z.B. `garmin.0`) zuweisen.
- **[Config] `garminPersonAssignment: {}` in io-package.json Defaults** eingetragen.
- **[Tag] Rollback-Tag `v0.33.174-rollback`** vor dem Refactoring gesetzt.

### 🔧 Offene Baustellen
- AURA Sleep Score wird möglicherweise nicht per Person korrekt an Frontend übergeben (prüfen)
- Einschlafzeit und Aufwachzeit bei Mehrpersonenhaushalten weiter validieren

### 🎯 Nächster logischer Schritt
- Testen: Mehrpersonenhaushalt-Szenario mit Garmin-Daten (Robert + Ingrid) — Sleep Score + korrekte Zeiten prüfen
- Ggf. Schwellenwerte für `vib_refined` / `gap60` bei Mehrpersonenhaushalten nachjustieren

---

## 🗓️ Sitzung 18.04.2026 — Version 0.33.174

### ✅ Abgeschlossen
- **[Fix] `_pVibRefine` Trigger-only (v0.33.174)**: Strength-Events aus der Vibrations-Verfeinerung ausgeschlossen. Strength feuert durch Atemzüge/Herzschlag alle 15-25 Min im Schlaf → verhinderte jeden 20-Min-Gap. Jetzt: nur `vibration_trigger = true` (echte Bewegung). Für Strength-only-Setups (kein Trigger) bleibt `_pVibRefine` null — das ist ehrlicher als falsche Einschlafzeiten.
- **[Fix] `motion` als eigene per-Person Quelle (Stufe 3b)**: Wenn `motion_vib` null (kein Trigger-Gap), wird der Motion-Anker direkt als Einschlafzeit verwendet. Robert: 23:52 statt 01:24. In `allSleepStartSources` sichtbar.
- **[Fix] Return-to-Bed nur via Trigger/Motion (v0.33.174)**: `_pBedRetRaw` akzeptiert nur FP2, Trigger-true oder Bedroom-Motion als Bett-Rückkehr-Beleg. Strength allein reicht nicht (feuert im leeren Bett). Fallback auf Strength nur wenn kein Trigger konfiguriert (strength-only Setup). Verhindert falsche "Rückkehr ins Bett" durch chatty Strength-Sensor.

### 🎯 Nächster logischer Schritt
- `sleepOnsetMin` per Person berechnen → dann AURA Sleep Score auch per Person
- Per-Person Garmin/Smartwatch-Zuweisung

---

## 🗓️ Sitzung 18.04.2026 — Version 0.33.171

### ✅ Abgeschlossen
- **[KRITISCHER BUG] reanalyzeSexDay Kontext-Features fehlten**: Root-Cause für 62% (nach Neustart) vs 39% (nach 'neu analysieren'): `reanalyzeSexDay` pushte Trainingsdaten NUR mit Vibrations-Features (peak, durSlots, avgPeak, variance), OHNE Kontext-Features (hourSin, hourCos, presenceOn, lightOn, roomTemp, bathBefore, bathAfter). `saveDailyHistory` hatte dagegen ALLE Features. RF trainierte auf völlig verschiedenen Datensätzen → inkonsistente Modelle. Fix: Fast-Path und Vollextraktion in `reanalyzeSexDay` mit identischer Kontext-Feature-Extraktion wie `saveDailyHistory` (aus `eventHistory`). Unvollständige `_features` werden beim nächsten Lauf automatisch neu extrahiert und korrekt (vollständig) gespeichert.

### 🔧 Offene Baustellen
- Sensor-Tooltips: Temperatursensor als "nicht konfiguriert" → Sensor-Typ-Match verbessern
- Layout-Reorder: Ctrl+Shift+R erforderlich (Browser-Cache)

### 🎯 Nächster logischer Schritt
- Sensor-Tooltips Raumtemperatur-Bug beheben

---

## 🗓️ Sitzung 18.04.2026 — Version 0.33.170

### ✅ Abgeschlossen
- **[Fix] Stufe 3 INAKTIV nach Adapter-Neustart (Dauerfix)**: Root-Cause war `intimacyEvents.length > 0`-Bedingung in `saveDailyHistory` beim Python-Call. Nach Neustart = 0 Events heute → Python nie aufgerufen → `pyClassifier=null` ins JSON geschrieben. Fix A: Bedingung entfernt (wie in `reanalyzeSexDay`). Fix B: Wenn Python trotzdem null (Timeout): bestehende `pyClassifier.trained=true` aus der gespeicherten JSON-Datei erhalten → Neustart-Schutz.
- **[Feature] 2×2 Confusion Matrix (Schritt 5)**: Python `sex.py` berechnet jetzt im LOO-Loop eine binäre 2×2-Matrix (Sex=vaginal+oral_hand vs. No-Sex=nullnummer). Rückgabe via `confusion_matrix: {tp,fp,tn,fn}`. Backend leitet Matrix an `sexCalibInfo.pyClassifier.confusion_matrix` weiter. Frontend zeigt Matrix als farbiges Grid in ALGORITHMUS-Kachel mit Sensitivität und Spezifität.
- **[Fix] LOO-Bug**: LOO berücksichtigt jetzt alle Label-Klassen inkl. Nullnummer (vorher fälschlicherweise nur vaginal/oral_hand im X_arr).

### 🔧 Offene Baustellen
- Sensor-Tooltips unvollständig: Temperatursensor wird als "nicht konfiguriert" angezeigt obwohl vorhanden → Sensortyp-Match-Logik anpassen
- Layout-Reorder: Vibrationsverlauf erscheint noch an alter Position (Browser-Cache: Ctrl+Shift+R nötig)

### 🎯 Nächster logischer Schritt
- Sensor-Tooltips verbessern (genauere Sensor-Typ-Erkennung aus native.devices)

---

## 🗓️ Sitzung 18.04.2026 — Version 0.33.169

### ✅ Abgeschlossen
- **[Feature] Nullnummer als 3. RF-Klasse**: Filter `!=='nullnummer'` und `.slice(0,30)` aus beiden Kalibrierungsschleifen entfernt. Nullnummer-Labels werden jetzt als 3. Klasse (No-Sex) in den RF-Klassifikator eingespeist. Dank `_features`-Fast-Path (Schritt 3) ist das Limit unlimitiert ohne Performance-Einbußen. Kalibrierungs-Peaks (calibA/calibB) werden intern weiterhin korrekt gefiltert.
- **[Feature] Layout-Reorder**: VibrationChartPanel von außerhalb in die linke Spalte verschoben — jetzt direkt oberhalb von "SESSION EINTRAGEN" und "MANUELLE SESSION". Die Kachel ist immer sichtbar (nicht mehr nur am Ende nach dem 2-Spalten-Layout).
- **[Feature] Sensor-ID-Tooltips für Feature-Importance**: Bei Hover über jeden Einflussfaktor-Balken wird der zugeordnete Sensor angezeigt (z.B. "Bett-Sensor: zigbee.0.xxx/vibration | Spitzenintensität"). Falls kein Sensor konfiguriert ist, erscheint ein Hinweis-Text mit dem erwarteten Sensortyp.

### 🔧 Offene Baustellen
- 2×2 Confusion Matrix in UI (Python LOO-Daten) (id: t5)

### 🎯 Nächster logischer Schritt
- Schritt 5: 2×2 Confusion Matrix (Sex vs. No-Sex) in der ALGORITHMUS-Kachel

---

## 🗓️ Sitzung 18.04.2026 — Version 0.33.168

### ✅ Abgeschlossen
- **[Fix] Stufe 3 INAKTIV nach Page-Reload (Race-Condition)**: `loadDay` lädt 7 Tage parallel via `Promise.all`. Historische Tage (z.B. April 16) antworteten mit `pyClassifier: null` und überschrieben `calibInfo.trained=true` von heute. Fix: `setCalibInfo` nutzt jetzt Functional-Update — `trained=true` wird nie durch `null/false` überschrieben.
- **[Fix] Ø Score '—' wegen falscher `isNullnummerFn`**: Die `SevenDayHistory`-Funktion behandelte Tage mit EINEM Nullnummer-Label als Nullnummer-Tag, obwohl derselbe Tag auch ein positives Label (vaginal/oral) hatte. Identischer Fix wie MonthCalendar: positive Labels schützen vor Nullnummer-Filterung.
- **[Feature] Features in Labels speichern (Schritt 3)**: Beide Kalibrierungsschleifen (`saveDailyHistory` + `reanalyzeSexDay`) lesen jetzt beim ersten Durchlauf Features aus History-JSON und speichern sie direkt im Label als `_features: {peakMax, medianPeak, durSlots, avgPeak, variance, hourSin, hourCos, lightOn, presenceOn, roomTemp, bathBefore, bathAfter}`. Bei Folgeläufen wird das JSON nicht mehr geöffnet (Fast-Path, `continue`). Angereicherte Labels werden per `extendForeignObjectAsync` persistiert. Ermöglicht unbegrenzte Labels ohne Performance-Einbußen.

### 🔧 Offene Baustellen
- Nullnummer als 3. Klasse zurück in RF-Slice (id: t4)
- 2×2 Confusion Matrix in UI (Python LOO-Daten) (id: t5)
- Layout-Reorder (Vibrationsverlauf nach oben) (id: t6)
- Sensor-Bezeichnung in Feature-Tooltips (id: t7)

### 🎯 Nächster logischer Schritt
- Schritt 4: Nullnummer als 3. Klasse zurück in RF-Slice (t4)
- Dann: 2×2 Confusion Matrix in UI (t5)

---

## 🗓️ Sitzung 18.04.2026 — Version 0.33.167

### ✅ Abgeschlossen
- **[Fix] Stufe 3 bleibt dauerhaft INAKTIV**: Ursache war `_raIntimacyEvents.length > 0` in der Python-Aufruf-Bedingung. Wenn heute 0 Events → Python nie aufgerufen → `_raPyInfo = null` → INAKTIV. Fix: Bedingung entfernt — Python wird jetzt auch bei 0 Events aufgerufen (mit `predict: []`), damit Modell trainiert und als `sex_model.pkl` gespeichert wird.
- **[Fix] Ø Score '—' nach Reanalyse**: Nach "Alle neu analysieren" wurde `dayData` (7-Tage-Cache) nicht für alle Tage aktualisiert. Fix: Am Ende von `reanalyzeAllDays` werden die letzten 7 Tage forciert per `getHistoryData` neu geladen und `setDayData` aktualisiert.

### 🔧 Offene Baustellen / Nächste Schritte
- Features direkt in Labels speichern (kein JSON-Öffnen mehr für Training)
- Nullnummer als 3. Klasse zurück in RF-Slice
- 2×2 Confusion Matrix in UI
- Layout-Reorder
- Sensor-Bezeichnung in Feature-Tooltips

---

## 🗓️ Sitzung 13.04.2026 — Version 0.33.166

---

## 🗓️ Sitzung 13.04.2026 — Version 0.33.166

### ✅ Abgeschlossen
- **[Fix] Ø Score Bug im 7-Tage-Widget**: `avgScore` teilte fälschlich durch `weekCount` (inkl. manuelle Sessions ohne Score) → jetzt durch `withEvents.length`. `avgDur` bezieht nun auch `durationMin` aus manuellen Einträgen mit ein. Ergebnis: "0" erscheint nicht mehr wenn nur manuelle Sessions vorhanden.
- **[Fix] RF persistent wie alle anderen Brains**: `sex.py` hat jetzt `load_brain()` / `save_brain()` mit `pickle` — identisches Muster wie `energy.py`, `health.py`, etc. Nach erfolgreichem Training wird `sex_model.pkl` gespeichert. Beim Start des Python-Services wird das Modell geladen. Stufe 3 bleibt nach Adapter-Restart dauerhaft AKTIV.
- **[Fix] classify_sessions: gespeichertes Modell nicht verwerfen**: Wenn neues Training fehlschlägt (zu wenig Daten), wird das geladene Modell nicht überschrieben. Meldung: "Gespeichertes Modell (DATUM) — zu wenig neue Daten für Neutraining".

### 🔧 Offene Baustellen / Nächste Schritte
- Features direkt in Labels speichern (kein JSON-Öffnen mehr für Training)
- Nullnummer als 3. Klasse zurück in RF-Slice
- 2×2 Confusion Matrix in UI
- Layout-Reorder (Vibrationsverlauf nach oben)
- Sensor-Bezeichnung in Feature-Tooltips

---

## 🗓️ Sitzung 13.04.2026 — Version 0.33.165

---

## 🗓️ Sitzung 13.04.2026 — Version 0.33.165

### ✅ Abgeschlossen
- **[Fix] Nullnummer-Labels aus Trainings-Slice herausfiltern**: In `saveDailyHistory` und `reanalyzeSexDay` wird der Slice für RF-Training und Kalibrierung (calibA/calibB) jetzt VOR dem Schneiden auf non-nullnummer gefiltert (`_sexLabels.filter(l.type !== 'nullnummer').slice(0, 30)`). Vorher konnten häufige Fehlerkennungen (Umdrehen nachts → Nullnummer) echte Labels aus dem 15er-Limit verdrängen. Limit gleichzeitig von 15 auf **30 echte Labels** erhöht.

### 🎯 Erklärt (kein Code-Bedarf)
- **Sensor-Konfiguration für Kontext-Features**: Raumtemperatur, Anwesenheit, Nachbarzimmer brauchen KEINE spezielle "Bettsensor"-Konfiguration. Diese Features werden automatisch aus vorhandenen Sensoren der Konfiguration extrahiert. 0%-Werte = Sensoren schlicht nicht vorhanden im Setup, Modell funktioniert trotzdem vollwertig mit den 4 Vibrations-Features.

### 🔧 Offene Baustellen
- Keine bekannten kritischen Bugs.

### 🎯 Nächster logischer Schritt
- Beobachten ob nach v0.33.165 bei weiteren Sessions die 30 echten Labels korrekt befüllt werden und calibA stabil bleibt.

---

## 🗓️ Sitzung 17.04.2026 — Version 0.33.164

---

## 🗓️ Sitzung 17.04.2026 — Version 0.33.164

### ✅ Abgeschlossen
- **[Fix] nearby_room_motion Label**: Key war `nearby_room_mo` (falsch), ist aber `nearby_room_motion` → jetzt beide Varianten in RF_LABELS hinterlegt.
- **[UX] LOO-Text laienverständlich**: "Selbst-Test-Genauigkeit (Leave-One-Out):" → "Erkennungsrate (intern selbst getestet):" + Qualitäts-Label ("· gut" / "· ausreichend" / "· mehr Daten nötig") + Tooltip-Erklärung beim Hover.
- **[UX] 0%-Faktoren erklärt**: Beschriftung geändert zu "0% = kein Sensor oder kein Unterschied erkennbar" + Tooltip "Faktoren mit 0% sind entweder nicht als Sensor konfiguriert oder unterscheiden sich bei deinen Sessions nicht — das Modell ignoriert sie automatisch."

### 📝 Erklärungen aus dieser Session
- **15 Sessions Slice**: Maximal 15 neueste Labels aus `sexTrainingLabels` werden für Kalibrierung UND RF-Training verwendet. "13 Sessions im Modell" = 13 Labels hatten Sensor-Daten.
- **0% Einflussfaktoren**: Licht/Anwesenheit/Temperatur/Nebenzimmer sind bei diesem Haushalt entweder ohne konfigurierten Sensor oder zeigen keine Variation zwischen den Sessions → kein Unterscheidungspotenzial → automatisch 0%. Korrekt und erwartet.
- **LOO-Genauigkeit 50%**: Mit nur 6 klassifizierten Sessions (2 vaginal + 4 oral) ist 50% nahe am Zufalls-Niveau für 2 Klassen. Mehr Labels verbessern das.

---

## 🗓️ Sitzung 17.04.2026 — Version 0.33.163

### ✅ Abgeschlossen
- **[UX] RF Feature-Importance: Deutsche Bezeichnungen**: Technische Namen (`dur_norm`, `avg_norm`, etc.) durch verständliche Begriffe ersetzt: "Dauer", "Ø Intensität", "Intensitätsschwankung", "Spitzenwert", "Pfad B (lang)", "Uhrzeit", "Licht war an", "Anwesenheit", "Raumtemperatur", "Bad davor/danach", "Nachbarzimmer aktiv". Hover-Tooltip zeigt den ursprünglichen technischen Namen.
- **[UX] RF Feature-Bars: Label breiter (136px statt 84px)**: Kein Text-in-Balken-Überlauf mehr. Balken beginnen weiter rechts.
- **[Feature] RF Delta-Visualisierung**: Vorherige Importances werden in `localStorage` gespeichert (`cogni-rf-curr` / `cogni-rf-prev`). Bei jedem `reanalyzeSexDay` mit Python wird der Vorwert als grauer Ghost-Balken hinter dem aktuellen blauen Balken angezeigt. Pfeil ↑/↓ zeigt Veränderungsrichtung. Legende: "░ = vorheriger Wert".
- **[Fix] Stufe 2 Bar Overflow**: `flexShrink: 0` + `overflow: 'hidden'` auf die Bar-Container-Divs → Peak≥74/Peak≥49 Labels laufen nicht mehr aus der Box.

### 🎯 Nächster logischer Schritt
- Adapter auf v0.33.163 → 2x "Alle analysieren" klicken → beim 2. Mal sollten Delta-Pfeile erscheinen

---

## 🗓️ Sitzung 17.04.2026 — Version 0.33.162

### ✅ Abgeschlossen
- **[Bug-Fix G] calibInfo nach "Alle analysieren" nicht aktualisiert**: `reanalyzeAllDays` rief `setCalibInfo()` nach dem "heute"-Python-Call nicht auf → ALGORITHMUS-Box zeigte INAKTIV obwohl Python erfolgreich antwortete. Fix: `if (_todayR.data.sexCalibInfo) setCalibInfo(...)` nach dem "heute"-Call eingefügt.
- **[UX] KI-Badge laienverständlich**: "🤖 KI: 65% Konfidenz" → "🤖 KI-Analyse: 65% sicher" mit Tooltip-Erklärung. Außerdem: `evt.pyConf` → `primaryEvt.pyConf` (kleiner Bug-Fix). INAKTIV-Texte in ALGORITHMUS-Box ebenfalls verständlicher formuliert.

### 🎯 Nächster logischer Schritt
- Adapter auf v0.33.162 → "Alle analysieren" → ALGORITHMUS-Box sollte "✓ AKTIV" zeigen

---

## 🗓️ Sitzung 17.04.2026 — Version 0.33.161

### ✅ Abgeschlossen
- **[Bug-Fix E] Python Result-Type Mismatch**: `service.py` antwortete auf `CLASSIFY_SEX_SESSIONS` mit `"SEX_CLASSIFIED"` — die PythonBridge erwartet aber `"CLASSIFY_SEX_SESSIONS_RESULT"`. Dadurch wurde jede Python-Antwort vom Bridge als "unbekannt" verworfen, und unser 15s-Timeout feuerte immer ins Leere. Fix: `send_result("CLASSIFY_SEX_SESSIONS_RESULT", ...)` in `python_service/service.py`.
- **[Bug-Fix F] MonthCalendar Blume unterdrückt**: `isNullnummerDay = true` wenn IRGENDEIN Nullnummer-Label für den Tag existiert — auch wenn noch echte vaginal-Events im JSON stehen. Folge: April 17 zeigte keine Blume obwohl ein vaginal-Event vorhanden war. Fix: `isNullnummerDay = true` nur wenn `events.length === 0` (Backend hat Nullnummer-Sessions entfernt) UND kein vaginal/oral-Label vorhanden. Außerdem: `effectiveDomType` unterdrückt Icon nur wenn kein `_labelOverride` existiert.

### 🎯 Nächster logischer Schritt
- Adapter auf v0.33.161 aktualisieren → "Alle analysieren" → Python-Klassifikator (Stufe 3) sollte jetzt aktiv werden + April 17 sollte Blume zeigen

---

## 🗓️ Sitzung 17.04.2026 — Version 0.33.160

### ✅ Abgeschlossen
- **[Fix] Python-Callback-Kollision behoben (skipPy)**: "Alle analysieren" sendete `CLASSIFY_SEX_SESSIONS` für jeden Tag mit Events — die PythonBridge nutzt aber den Command-Namen als Key für `pendingCallbacks`, sodass jeder neue Call den vorherigen überschreibt. Fix: Batch-Loop übergibt jetzt `skipPy: true` an `reanalyzeSexDay` → kein Python im Batch. Nach dem Loop wird Python **einmalig gezielt für heute** aufgerufen (ohne skipPy). Status-Anzeige: "✓ N Tage (Stufe 1+2) + KI für heute".
- **[Fix] Backend skipPy-Flag**: `reanalyzeSexDay` prüft `obj.message.skipPy === true` und überspringt den Python-Block komplett. `pyClassifier` bleibt dann `null` für historische Tage (korrekt — die brauchen keine ML-Klassifikation).

### 🎯 Nächster logischer Schritt
- Adapter auf v0.33.160 aktualisieren → "Alle analysieren" → KI sollte für heute aktiv werden (kein Timeout mehr im Batch)

---

## 🗓️ Sitzung 17.04.2026 — Version 0.33.159

### ✅ Abgeschlossen
- **[Fix] Python-Timeout 5s → 15s**: PythonBridge `CLASSIFY_SEX_SESSIONS` erhält jetzt 15 Sekunden Wartezeit statt 5 Sekunden. Verhindert Timeout wenn der Python-Service durch andere Tasks (z.B. TensorFlow-Laden) beim Start blockiert ist. Fix in `saveDailyHistory` und `reanalyzeSexDay`.
- **[Feature] Gap-Toleranz-Merge (30 Min)**: Zwei oder mehr `intimacyEvents` mit einem zeitlichen Abstand von unter 30 Minuten werden automatisch zu einer einzigen Session zusammengefasst. Logik: `start=früheste`, `end=späteste`, `typ=stärkster` (vaginal > oral_hand > intim), `peak=max`, `avg=Mittelwert`, `slots=konkateniert`. Gilt für `saveDailyHistory` und `reanalyzeSexDay`. Verhindert fragmentierte Darstellung von Sessions mit kurzen Pausen.

### 🔧 Offene Baustellen
- KI Klassifikator (Stufe 3): Timeout-Problem behoben (15s), Aktivierung hängt weiterhin davon ab, ob mind. 2 vaginal + 2 oral/hand Labels vorhanden sind
- Undo-Nullnummer ruft NICHT automatisch `reanalyzeSexDay` auf → Nutzer muss manuell "Neu analysieren" drücken
- `haus_still` Hop-Filter fehlt

### 🎯 Nächster logischer Schritt
- Adapter auf v0.33.159 aktualisieren → "Neu analysieren" klicken → prüfen ob Stufe 3 jetzt aktiv wird und ob Session-Merge greift

---

---

## 🗓️ Sitzung 17.04.2026 — Version 0.33.158 (Fixes)

### ✅ Abgeschlossen
- **[Bug-Fix A] Session-Level Nullnummer**: Nullnummer-Button entfernt NUR die angeklickte Session per Start-Timestamp (±5 Min Toleranz), nicht mehr den ganzen Tag. Neuer Backend-Handler `removeSingleIntimacyEvent`. `reanalyzeSexDay` + `saveDailyHistory` filtern jetzt session-spezifisch.
- **[Bug-Fix B] RF Slice 7→15**: Labels-Slice für Kalibrierung und RF-Training erhöht — ältere Labels (z.B. März-28-vaginal) werden jetzt berücksichtigt.
- **[Bug-Fix C] calibA Nullnummer-Exclusion**: Nullnummer-Peaks wurden fälschlicherweise in `_sessionPeaks` mitgezählt → calibA zu niedrig. Fix in `saveDailyHistory` + `reanalyzeSexDay`. Nach Reanalyse sollte calibA steigen.
- **[Bug-Fix D] SexDayCard Primary-Event**: Banner zeigt jetzt das zum Label passende Event (z.B. 19:25-Session statt 03:55). Badge geändert von "Manuell eingetragen" → "Typ-Label: Vaginal/Oral"

---

## 🗓️ Sitzung 17.04.2026 — Version 0.33.157

### ✅ Abgeschlossen
- **[Fix] Per-Person Einschlafzeit-Algorithmen auf globale Logik angeglichen (v0.33.157)**:
  - **`vib_refined`** (Mehrpersonenhaushalt): War auf 60-Min-Anker via `_pFindGapAnchor(all, 60min)` angewiesen → schlug bei Strength-Sensoren immer fehl, da Strength alle 15-25 Min feuert. Fix: Direkter Forward-Scan (identisch mit globalem `_globalVibRefinedTs`): erstes aktives Vib-Event mit >=20 Min Stille danach, Fenster 21:00-04:00. Ergebnis für Robert: ~22:55 statt null.
  - **`gap60`** (Mehrpersonenhaushalt): Nutzte `isVibrationBed` (Detection + Strength) → kein 60-Min-Gap möglich. Fix: Nur Detection-Events (`isVibrationBed && !isVibrationStrength`), forward-scan. Ergebnis für Robert: ~22:53 (70-Min-Gap vor 00:04).
  - **`motion_vib`** (Mehrpersonenhaushalt): War auf 60-Min-Anker mit ALL-Bed-Events angewiesen. Fix: Anker = letztes Bedroom-Motion-Event mit >=30 Min Pause zum nächsten Motion-Event (identisch mit globalem `sleepWindowMotion`). Gap-Check nutzt jetzt nur Motion-Events, nicht Strength.
  - Alle drei Fixes: Pre-Compute-Block UND Priority-Chain (Stufe 3+4) gleichzeitig korrigiert.

### 🎯 Nächster logischer Schritt
- Per-Person Garmin/Smartwatch-Zuweisung prüfen und implementieren
- Alle Einschlafzeitquellen im Dropdown auch mit ⚠️/— anzeigen wenn Sensor fehlt

---

## 🗓️ Sitzung 17.04.2026 — Version 0.33.156

### ✅ Abgeschlossen
- **[Feature] Per-Person Schlafphasen in Mehrpersonenhaushalten**: Mehrpersonenhaushalte (z.B. Gondelsheim: Ingrid + Robert) zeigten 'Schlafphasen nicht verfügbar', obwohl Vibrationssensoren pro Bett vorhanden. Ursache: globaler Stages-Algorithmus war nicht im per-Person IIFE implementiert. Fix: Identischer Stages-Berechnungsblock (5-Min-Slots, light/deep/REM/wake) im IIFE pro Person eingefügt, gefiltert auf e.personTag === person. Ergebnis sleepStages[] + stagesWindowStart in 
esult[person] gespeichert.
- **[Feature] Frontend stagesWindowStart per Person**: overrideData für Mehrpersonenkacheln nutzte hardkodiert sleepStages: []. Jetzt: pd.sleepStages ?? [] und stagesWindowStart: pd.stagesWindowStart ?? pd.sleepWindowStart. Die Schlafbalken-Visualisierung zeigt jetzt Phasendaten wenn Vibrationssensor vorhanden.

### 🔧 Offene Baustellen
- Garmin pro Person: Design diskutiert, Implementierung ausstehend
- Wake-Override wird nicht automatisch gelöscht

### 🎯 Nächster logischer Schritt
- Gondelsheim: Adapter auf v0.33.156 aktualisieren → prüfen ob Schlafphasen-Balken für Ingrid und Robert erscheinen

---
# PROJEKT STATUS - ioBroker Cogni-Living (AURA)
**Letzte Aktualisierung:** 16.04.2026 | **Version:** 0.33.155

---

## 🗓️ Sitzung 16.04.2026 — Version 0.33.155

### ✅ Abgeschlossen
- **[Fix] fp2 (Radar) Aufwachzeit**: `sleepWindowCalc.end` war Rückkehrzeit ins Bett, nicht Abgangzeit. IIFE gibt jetzt zusätzlich `firstEmpty` zurück = Zeitpunkt als Bett zuerst ≥15 Min leer war nach 04:00. `fp2WakeTs = sleepWindowCalc.firstEmpty` statt `.end`.
- **[Fix] fp2_vib (Radar + Vibration)**: Vibrations-Suchfenster war `[fp2WakeTs -30min, fp2WakeTs +5min]`. Jetzt: `[fp2WakeTs -30min, fp2WakeTs]` — nur Events VOR dem Abgang (Aufwach-Vibrationen = Person dreht sich bevor sie aufsteht).
- **[Fix] fp2_other (Radar + anderer Raum)**: War: 15-Min-Fenster zwischen fp2WakeTs und otherRoomWakeTs. Jetzt: Forward-Scan ab fp2WakeTs → erste andere-Raum-Bewegung innerhalb 60 Min nach Abgang. Gibt "wann bist du nach dem Aufstehen zum ersten Mal in einen anderen Raum gegangen".
- **[Fix] otherRoomWakeTs (Anderer Raum)**: OC-19-Algorithmus ("letzte Abfahrt ohne Rückkehr") durch Forward-Scan ersetzt. Jetzt: erste andere-Raum-Bewegung nach 04:00 UND nach ≥3h Schlaf. Intuitiveres Ergebnis: "wann warst du das erste Mal in einem anderen Raum" statt "wann bist du das letzte Mal gegangen".

### 🔧 Offene Baustellen
- Garmin pro Person: Design diskutiert, Implementierung ausstehend
- Wake-Override wird nicht automatisch gelöscht

### 🎯 Nächster logischer Schritt
- Nacht abwarten → neue Wake-Quellen in Matrix prüfen (fp2, fp2_vib, fp2_other, otherRoom sollten jetzt frühere sinnvolle Zeiten zeigen)

---

---

## 🗓️ Sitzung 16.04.2026 — Version 0.33.154

### ✅ Abgeschlossen
- **[Fix] fp2WakeTs / fp2_vib in allWakeSources zeigten Garmin-Zeit**: `fp2WakeTs = sleepWindowOC7.end` las Garmin-überschriebenen Wert. Fix: `_fp2RawWakeTs = sleepWindowCalc.end` vor Garmin-Override speichern, als Basis für fp2WakeTs + fp2VibWakeTs + fp2OtherWakeTs. Jetzt zeigt die Matrix die echten FP2/Vib-Zeiten statt Garmin.
- **[Fix] fp2BedEventsTotal is not defined**: Im OC-7 Debug-Block wurde `fp2BedEventsTotal` als Property des gerade konstruierten Objects verwendet — in JS nicht erlaubt. Ersetzt durch inline `sleepSearchEvents.filter(...).length`. Gondelsheim-Warn-Eintrag verschwindet.
- **[Fix] History Save Error: _0xe3a522 is not a function (Gondelsheim)**: Ursache war ein JavaScript-Hoisting-Bug im per-Person IIFE. `_pFindGapAnchor` und `_pVibRefine` wurden als `var fn = function(){}` deklariert, aber 40+ Zeilen vor ihrer Definition aufgerufen (für den allSleepStartSources Pre-Compute-Block). `var`-Deklarationen werden gehoisted, aber nicht ihre Zuweisung — zur Laufzeit also `undefined`. Fix: `_pEve` + `_pVibRefine` + `_pFindGapAnchor` vor den Pre-Compute-Block verschoben. Betrifft nur Multi-Person-Haushalte (single-Person springt früh aus der IIFE heraus).

### 🔧 Offene Baustellen
- "Anderer Raum" Aufwachzeit (OC-19): Zeigt letzte Abfahrt ohne Rückkehr — kann durch Bettvibrationen spät sein. Noch beobachten.
- Garmin pro Person: Design diskutiert, Implementierung ausstehend
- Wake-Override wird nicht automatisch gelöscht

### 🎯 Nächster logischer Schritt
- Update auf v0.33.154 in Gondelsheim installieren → prüfen ob History Save Error weg ist + Schlafkacheln funktionieren

---

## 🗓️ Sitzung 16.04.2026 — Version 0.33.153

### ✅ Abgeschlossen
- **[Fix] haus_still Redesign für Single-Haushalte**: Vorher: Backward-Scan auf Schlafzimmer-Bewegungsmelder → ungeeignet für Single (Micro-Bewegungen im Schlaf). Jetzt: Forward-Scan auf Nicht-Schlafzimmer-Events (andere Räume) — erstes Event vor ≥60 Min Stille. Funktioniert für Single + Multi.

### 🔧 Offene Baustellen
- Gondelsheim: `History Save Error` (Hoisting-Bug) → Fix in v0.33.154 ✅
- fp2/fp2_vib in allWakeSources zeigen Garmin-Zeit → Fix in v0.33.154 ✅

---

## 🗓️ Sitzung 16.04.2026 — Version 0.33.152

### ✅ Abgeschlossen
- **[Fix] gap60 Forward-Scan**: War backward scan + Date.now()-Fallback → gab immer letztes Event zurück. Jetzt: Forward-Scan (erstes Vib/FP2-Event vor ≥60 Min Stille), Fenster-Ende (04:00) als Fallback, isBedroomMotion entfernt (Schlafbewegungen sollen nicht zählen). Gilt für global + per-Person.
- **[Fix] sleepWindowMotion (Schlafzimmer-Bewegungsmelder)**: War "erster Event nach 18:00" (wegen Date.now()-Fallback). Jetzt: letztes Event vor ≥30 Min Stille im Schlafzimmer. Verhindert frühzeitige Abendbesuche (18:16) als Einschlafzeit.
- **[Fix] winstart aus Dropdown entfernt**: `winstart` war redundant mit `fixed` (gleicher Wert). Nur noch `fixed` (Fallback 20:00 Uhr) im Dropdown.

### 🔧 Offene Baustellen
- Gondelsheim: `History Save Error: _0x5164c1 is not a function` (v0.33.148) → Update auf neueste Version nötig
- Gondelsheim: sleepStart null pro Person, sleepStages 0 Slots → separater Fix geplant (v0.33.153?)
- haus_still für Single-Haushalt oft zu spät → strukturelles Problem, kein dringender Fix
- Garmin pro Person: Design diskutiert, Implementierung ausstehend
- Wake-Override wird nicht automatisch gelöscht

### 🎯 Nächster logischer Schritt
- Update auf v0.33.152 → gap60 / motion-Zeiten prüfen (sollten jetzt ~22:39 statt 03:37/18:16 zeigen)

---

## 🗓️ Sitzung 16.04.2026 — Version 0.33.151

### ✅ Abgeschlossen
- **[Fix] allSleepStartSources nie aus Frozen-Snapshot**: Zeile 1217 (`if (_existingSnap.allSleepStartSources) allSleepStartSources = _existingSnap.allSleepStartSources`) wurde entfernt. Diese Zeile überschrieb die frisch berechnete (korrekte) `allSleepStartSources` immer mit den alten Werten aus dem Snapshot — deshalb zeigten fp2_vib und vib_refined nach Adapter-Neustart noch 01:11 / 03:34 statt ~22:39. Jetzt wird die frische Berechnung immer gespeichert.
- **Ursache der Nicht-Aktualisierung**: Der In-Memory-Event-Buffer (`this.eventHistory`, 2500 Events ≈ 36h zurück) enthält die 15.4.-Abend-Vib-Events — die JSON-`eventHistory` (981 Events) hat sie nicht, ist aber irrelevant da nur der In-Memory-Buffer für die Analyse genutzt wird.

### 🔧 Offene Baustellen
- `Schlafzimmer-Bewegungsmelder (18:16)` = sleepWindowMotion.start = erster Bedroom-Motion-Event des Abend-Suchfensters → oft zu früh; separater Fix nötig
- Gondelsheim: Schlafphasen per Person noch nicht verifiziert (braucht Nachtdaten nach v0.33.148+)
- Garmin pro Person: Design diskutiert, Implementierung ausstehend
- Wake-Override wird nicht automatisch gelöscht

### 🎯 Nächster logischer Schritt
- Adapter auf 0.33.151 aktualisieren + prüfen ob fp2_vib/vib_refined jetzt ~22:39 zeigen

---

## 🗓️ Sitzung 16.04.2026 — Version 0.33.150

### ✅ Abgeschlossen
- **[Fix] Vib-Verfeinerung Forward-Scan**: Alle 4 Algorithmen (fp2_vib global, motion_vib global, vib_refined standalone, _pVibRefine per-Person) scannen jetzt VORWÄRTS — suchen den ersten ruhigen Übergang (= Einschlafen), nicht mehr den letzten (= Morgenpause).
- **[Fix] Date.now()-Fallback**: War die Kernursache für falsche Zeiten. "Kein nächstes Event" gibt jetzt Fenster-Ende zurück statt Date.now(). Dadurch findet der Algorithmus nicht mehr automatisch das letzte Event im Fenster.
- **[Ergebnis] Simulation bestätigt**: fp2_vib findet jetzt 22:39:27 (identisch mit Garmin 22:39). Vorher: 01:11 ❌

### 🔧 Offene Baustellen
- `Schlafzimmer-Bewegungsmelder (18:16)` = sleepWindowMotion.start = erster Bedroom-Motion-Event des Abend-Suchfensters → oft zu früh; separater Fix nötig
- Gondelsheim: Schlafphasen per Person noch nicht verifiziert (braucht Nachtdaten nach v0.33.148+)
- Garmin pro Person: Design diskutiert, Implementierung ausstehend
- Wake-Override wird nicht automatisch gelöscht

### 🎯 Nächster logischer Schritt
- Adapter auf 0.33.150 aktualisieren + Nacht abwarten → fp2_vib / vib_refined Zeiten prüfen

---

## 🗓️ Sitzung 16.04.2026 — Version 0.33.149

### ✅ Abgeschlossen
- **[OC-29] ALGORITHMUS-Kasten komplett redesigned**: Stufen 1/2/3 klar benannt, mit `✓ AKTIV` / `— INAKTIV` Badge je nach Zustand
- **[Fix] Stufenbenennung**: War "TYP-KLASSIFIKATION (STUFE 1)" → jetzt korrekt "STUFE 2: TYP-KLASSIFIKATION", lückenlos 1→2→3
- **[Fix] Falscher Bedingungstext** bei STUFE 3 korrigiert: nicht mehr "mind. 2× vaginal + 2× oral" (war falsch), jetzt zeigt die echte Python-Fehlermeldung (`rfInfo.msg`)
- **[Feature] STUFE 1: SESSION-ERKENNUNG**: Erklärt Pfad A/B in Laientexten mit Schwellwert-Anzeige
- **[Feature] STUFE 2: TYP-KLASSIFIKATION**: Zeigt calibA/calibB als farbige Balken + Formel mit echten Zahlen (z.B. Peak ≥ 39 → vaginal)
- **[Feature] STUFE 3: KI-KLASSIFIKATOR**: Feature-Importance-Balkendiagramm (alle Features, nicht nur Top 5), LOO-Genauigkeit mit farbigem Balken (grün/gelb/rot), Trainings-Counts mit Emojis
- **[Feature] LOO-Genauigkeit farbkodiert**: grün ≥80%, gelb ≥60%, rot <60%
- **[OC-29 in BRAINSTORMING.md]**: Konzept für RF-Visualisierung dokumentiert (inkl. mögliche Erweiterungen wie Konfidenz pro Session, Vorher/Nachher-Vergleich)
- **[JSON-Analyse bestätigt]**: `intimacyEvents: []` nach Nullnummer-Setzen → Fix funktioniert korrekt; `pyClassifier: null` bei Nullnummer-Tag ist erwartetes Verhalten

### 🔧 Offene Baustellen
- **RF läuft noch nicht** (pyClassifier: null): Braucht mind. 2× vaginal + 2× oral_hand mit Sensor-Treffer — aktuell nur 1× vaginal
- **Undo-Nullnummer** ruft noch KEIN `reanalyzeSexDay` auf → Nutzer muss manuell "Neu analysieren"
- `haus_still` Hop-Filter fehlt (OG-Flur blockiert Stille-Prüfung)
- OC-22: Einschlafzeit-Prior-Modell
- OC-26: Sensor-Onboarding-Assistent
- OC-27: Multi-Bett-Unterstützung
- OC-28: Verhütungsmethode & Fruchtbarkeits-Kontext
- OC-29: RF Feature-Importance-Visualisierung (Basis implementiert, Erweiterungen offen)

### 🎯 Nächster logischer Schritt
- Weiteres vaginal-Label eintragen → RF-Training mit beiden Typen möglich → Stufe-3-Aktiv-Badge erscheint

---

---

## 🗓️ Sitzung 14.04.2026 — Version 0.33.148

### ✅ Abgeschlossen
- **[Fix] Schlafphasen für Mehrpersonenhaushalte**: Stages-Berechnung wurde von VOR die Wake-Detection auf NACH die Wake-Detection verschoben. Problem war: `sleepWindowOC7.end` war beim alten Berechnungszeitpunkt noch `null` (kein FP2, kein Garmin), jetzt ist er garantiert gesetzt. → Gondelsheim sollte ab jetzt Schlafphasen (Tief/Leicht/REM) erhalten.
- **[Fix] Per-Person `allSleepStartSources` vollständig**: Alle 8 Einschlafmethoden werden jetzt UNABHÄNGIG voneinander vorberechnet (`_pCandFp2Vib`, `_pCandFp2`, `_pCandMotVib`, `_pCandVibRefined`, `_pCandGap60`, `_pCandLastOutside`, `_pCandHausStill`). Vorher bekam nur der Gewinner einen Timestamp — alle anderen waren `null`. Jetzt zeigt das Dropdown echte Zeiten für alle verfügbaren Methoden.
- **[Fix] Globales `allSleepStartSources` vollständig**: `vib_refined`, `gap60` und `winstart` wurden als eigenständige Berechnungen zum globalen Einschlafquellen-Array hinzugefügt. Vorher fehlten diese 3 Methoden komplett.
- **[Fix] Morning Briefing "keine Nacht-Daten"**: Wenn heute-Datei kein `sleepWindowStart` enthält (z.B. noch nicht analysiert), fällt der Briefing-Code jetzt auf die gestern-Datei zurück. Außerdem wird `sleepWindowStart/End` jetzt korrekt als Unix-Timestamp (ms) formatiert statt als Minuten — Zeitanzeige im Briefing war bisher falsch.

### 🔧 Offene Baustellen
- Wake-Override wird aktuell beim Recalculate einer neuen Nacht nicht automatisch gelöscht
- Garmin pro Person: Design diskutiert (Wearable-Sektion, Person-Dropdown), Implementierung ausstehend
- `haus_still` Hop-Filter fehlt
- OC-22 / OC-26 / Long-COVID PEM
- `last_outside` und `haus_still` per-Person-Kandidaten werden nur berechnet wenn sie den Gewinner stellen (niedere Prio-Methoden bleiben `null` wenn höhere Methode gewinnt — akzeptables Verhalten, da diese Methoden nur als Fallback relevant sind)

### 🎯 Nächster logischer Schritt
- Adapter auf 0.33.148 aktualisieren + Nacht abwarten → Schlafphasen in Gondelsheim prüfen
- Dropdown in Gondelsheim: Prüfen ob jetzt mehr als nur `vib_refined` einen Timestamp hat

---

## 🗓️ Sitzung 14.04.2026 — Version 0.33.147

### ✅ Abgeschlossen
- **[Feature] OBE-Tooltip-Filterung**: Orangenes Dreieck (Bad-Besuch) zeigt jetzt nur Bad-Sensoren; rotes Dreieck (Außerhalb) zeigt nur Nicht-Bad-Sensoren. Jeweils mit exakter Uhrzeit des Sensor-Events im Tooltip.
- **[Feature] Sensor-Typ-Anreicherung**: Backend speichert `isBathroomSensor` + `timestamp` pro Sensor in `outsideBedEvents`-Clustern (global + per-Person). Fallback auf ungefiltert für Altdaten ohne Flag.
- **[UX] Display-Namen Einschlafzeit-Quellen finalisiert**:
  - `vib_refined`: "Matratze wurde ruhig" (statt "Letzte Bettbewegung (Vibration)")
  - `gap60`: "Schlafzimmer: Aktivitätspause" (statt "Letzte Bettbewegung")
  - `last_outside`: "Letzter Weg ins Schlafzimmer" (statt "Letzte Außenaktiv.")
  - `haus_still`: "Alle Räume wurden ruhig" (statt "Haus-wird-still")
  - `winstart`: "Schätzwert (Fallback)" (statt "Fenster-Start (Fallback)")

### 🔧 Offene Baustellen
- Wake-Override wird aktuell beim Recalculate einer neuen Nacht nicht automatisch gelöscht (sollte nur für heute gelten)
- Garmin pro Person: Design diskutiert (Wearable-Sektion, Person-Dropdown), Implementierung ausstehend
- `haus_still` Hop-Filter fehlt
- OC-22 / OC-26 / Long-COVID PEM
- ⚠️ Hinweis: Für den gefilterten Tooltip (isBathroomSensor-Flag) müssen erst neue Nachtdaten gesammelt werden — Altdaten zeigen noch alle Sensoren ungefiltert

### 🎯 Nächster logischer Schritt
- Adapter auf 0.33.147 aktualisieren + Nachtdaten sammeln → Tooltip-Filterung testen
- TESTING.md mit Testfällen für OBE-Tooltips aktualisieren

---

## 🗓️ Sitzung 14.04.2026 — Version 0.33.146

### ✅ Abgeschlossen
- **[Fix] Aufwachzeit-Dropdown in Haupt-Schlafkachel**: Zweiter Rendering-Pfad (voller Score-Balken-Karte) hatte noch den alten DEV-ONLY-Tooltip statt dem interaktiven Dropdown → gefixt mit `_patch_wake2.js`

### 🔧 Offene Baustellen
- Wake-Override wird aktuell beim Recalculate einer neuen Nacht nicht automatisch gelöscht

---

## 🗓️ Sitzung 14.04.2026 — Version 0.33.145

### ✅ Abgeschlossen
- **[Feature] Smartwatch-Umbenennung**: `garmin` → "Smartwatch (Garmin, Fitbit…)" für Hersteller-Unabhängigkeit
- **[Feature] Radar-Umbenennung**: `fp2` → "Radar (Präsenz-Sensor)", `fp2_vib` → "Radar + Vibration", `fp2_other` → "Radar + anderer Raum" — generische Bezeichnung für Aqara FP2, Shelly Presence Gen4, SNZB-06P etc.
- **[Feature] `last_outside` im globalen System**: Methode "Letzte Außenaktivität" jetzt auch für Einpersonenhaushalte verfügbar (vorher nur per-Person)
- **[Feature] Aufwachzeit-Override-Dropdown**: Aufwachzeit hat jetzt dasselbe interaktive Quellen-Panel wie Einschlafzeit — inkl. globaler und per-Person-Handler (`setWakeOverride`, `clearWakeOverride`, `setPersonWakeOverride`, `clearPersonWakeOverride`). Neue States: `analysis.sleep.wakeOverride`, `analysis.sleep.personWakeOverrides`
- **[Feature] Sensor-nicht-vorhanden-Feedback**: Im Einschlafzeit-Dropdown zeigt `⚠️ kein Sensor` statt `—` wenn der Sensor-Typ physisch nicht konfiguriert ist. Stark ausgegraut (25%) = kein Sensor; leicht ausgegraut (40%) = Sensor vorhanden aber keine Nachtdaten. Per-Person-kacheln filtern nach `personTag`
- **[Feature] Per-Person-aware Sensor-Detection**: `hasRadarBed`, `hasVibBed`, `hasMotionBed` filtern jetzt nach `personTag === personLabel` für per-Person-Kacheln
- **[Update] HANDBUCH.md**: Einschlaf- und Aufwachzeit-Tabellen vollständig überarbeitet mit internen Codes, Anzeigenamen, Legende für Dropdown-Darstellung

### 🔧 Offene Baustellen
- Wake-Override wird aktuell beim Recalculate einer neuen Nacht nicht automatisch gelöscht (sollte nur für heute gelten)
- Garmin pro Person: Design diskutiert (Wearable-Sektion, Person-Dropdown), Implementierung ausstehend
- `haus_still` Hop-Filter fehlt
- OC-22 / OC-26 / Long-COVID PEM

### 🎯 Nächster logischer Schritt
- TESTING.md mit neuen Testfällen für Wake-Override und Sensor-Feedback aktualisieren
- Evtl. Wake-Override automatisch nach 24h ungültig setzen (Datum-Check bereits drin)

---

## 🗓️ Sitzung 13.04.2026 — Version 0.33.144

### ✅ Abgeschlossen
- **[Fix] IntimacyBar Tick-Alignment**: 8 Ticks (00–21h) mit space-between endeten scheinbar bei 21:00 — Sessions danach wirkten "außerhalb". Fix: 9. Tick "24:00" hinzugefügt, damit 3h-Intervalle mit space-between exakt auf die Balkenbreite ausgerichtet sind
- **[Fix] IntimacyBar erscheint auch ohne Events**: Bei "Heute" ohne erkannte Session wurde kein Balken angezeigt. Jetzt zeigt die leere Ansicht immer den vollen 24h-Balken mit Schraffur für die Zukunft
- **[Feature] Datum im "Heute"-Titel**: "SEX — HEUTE" zeigt jetzt "SEX — HEUTE · 13.04." mit aktuellem Datum

### 🔧 Offene Baustellen
- `haus_still` Hop-Filter fehlt
- OC-22 / OC-26 / Long-COVID PEM
- Undo-Nullnummer ruft nicht automatisch reanalyzeSexDay auf

### 🎯 Nächster logischer Schritt
- Adapter auf 0.33.144 aktualisieren

---

## 🗓️ Sitzung 13.04.2026 — Version 0.33.143

### ✅ Abgeschlossen
- **[Fix] Sex-Erkennung auf Kalender-Tag umgestellt**: `saveDailyHistory()` und `reanalyzeSexDay()` filtern Vibrations-Events jetzt ab `00:00 Uhr des aktuellen Tages` (statt 18:00 Vortag). Events vom Vorabend gehören damit zum richtigen Kalendertag. Dedup-Logik bleibt als Sicherheitsnetz erhalten.
- **[Feature] IntimacyBar: festes 24h-Fenster 00:00–23:59**: Der Intensitätsverlauf zeigt jetzt immer den gesamten Tag. Ticks gleichmäßig alle 3h (00:00, 03:00, 06:00, ..., 21:00). Alle Sessions eines Tages sichtbar unabhängig von der Uhrzeit.
- **[Feature] IntimacyBar: Zukunfts-Schraffur**: Ab der aktuellen Uhrzeit (nur bei "Heute") erscheint eine diagonale Schraffur für die noch verbleibende Zeit des Tages. Eine senkrechte Linie markiert "Jetzt". Bei vergangenen Tagen ist das gesamte Fenster ohne Overlay sichtbar.
- **⚠️ Historische Daten**: Nach Adapter-Update einmalig "Alle neu analysieren" drücken damit Events dem richtigen Kalendertag zugeordnet werden

### 🔧 Offene Baustellen
- `haus_still` Hop-Filter fehlt
- OC-22 / OC-26 / Long-COVID PEM
- Undo-Nullnummer ruft nicht automatisch reanalyzeSexDay auf

### 🎯 Nächster logischer Schritt
- Adapter auf 0.33.143 aktualisieren + "Alle neu analysieren" einmalig ausführen

---

## 🗓️ Sitzung 13.04.2026 — Version 0.33.142

### ✅ Abgeschlossen
- **[Fix] Nullnummer-Persistenz (Hauptbug)**: Nullnummer-Label setzen entfernt jetzt sofort `intimacyEvents` aus dem Tages-JSON via neuem Backend-Handler `clearIntimacyEventsForDay`. Vor diesem Fix: Label supprimierte nur die ANZEIGE, Events blieben im JSON → nach Neustart/Reanalyse tauchten Events wieder auf.
- **[Fix] reanalyzeSexDay respektiert Nullnummer-Label**: Wenn für einen Tag ein Nullnummer-Label existiert, wird das Erkennungsergebnis nach der Reanalyse verworfen und `intimacyEvents = []` geschrieben. Human-Override ist damit dauerhaft.
- **[Fix] Frontend: Nullnummer-Button ruft clearIntimacyEventsForDay auf**: `handleNullnummerSet`-Funktion im SexTab ruft Backend-Handler auf und lädt den Tag danach neu.
- **[UX] "Intim" → "Nicht klassifiziert"**: Typ `intim` (Algorithmus-Fallback wenn Score unter beiden Schwellen) heißt jetzt überall "❓ Nicht klassifiziert" statt "✨ Intim" — vorher verwirrend weil vaginal+oral ja auch intim sind.
- **[UX] ✎ Label aus Monatskalender entfernt**: Der Stift-Icon in Kalender-Zellen und der Legende erschien wenn Label vorhanden aber kein Event → war für Endnutzer bedeutungslos.
- **[UX] ×2 im Monatskalender mit Tooltip**: `🌹×2` zeigt jetzt per Hover: "2 erkannte Fragmente (Sensor teilte Session auf)"
- **[UX] Monatskalender-Statistik Nullnummer-korrigiert**: "X Tage · Y Sessions" zählt Nullnummer-Tage nicht mehr mit.
- **[UX] +m Indikator größer**: Von 0.35rem → 0.45rem, Opazität 0.5 → 0.75, mit Hover-Tooltip "Zusätzlich manueller Eintrag"
- **[UX] LabelForm Titel**: "SESSION EINTRAGEN (Trainingsdaten)" → "(für Sensor-Training)" — weniger technisch

### 🔧 Offene Baustellen
- `haus_still` Hop-Filter fehlt
- OC-22 / OC-26 / Long-COVID PEM
- Undo-Nullnummer (↩ Rückgängig) ruft NICHT automatisch reanalyzeSexDay auf → Nutzer muss manuell "Neu analysieren" drücken um Events wiederherzustellen

### 🎯 Nächster logischer Schritt
- Adapter auf 0.33.142 aktualisieren + testen: Nullnummer setzen → JSON prüfen ob leer → Adapter neu starten → Event darf nicht wiederkommen

---

## 🗓️ Sitzung 15.04.2026 — Version 0.33.141

### ✅ Abgeschlossen
- **[Fix] Doppel-"Oral" in 7-Tage bei Nullnummer+manuell**: `(!isNullnummer || hasManual)` zeigte BEIDE Blöcke (Sensor-Info + Manual-Info). Fix: nur `!isNullnummer` prüfen → bei Nullnummer erscheint ausschließlich der Manual-Block
- **[Fix] dotColor/dotBorder bei Nullnummer+manuell**: Farbe kam von `effType` (Sensor). Jetzt `manualType`-basierte Farbe
- **[Fix] MonthCalendar ignoriert Training-Labels**: `emoji` nutzte Roh-JSON-Typ. Fix: `_labelOverride` sucht oral/vaginal-Label für den Tag und überschreibt `effectiveDomType` → April 9 zeigt jetzt 💋 statt 🌹 wenn so gelabelt
- **[Neu] MonthCalendar Legende zweizeilig**: Zeigt Sensor-Icons (volle Opazität) vs. manuelle Icons (60% blass) mit Erklärung
- **[Neu] +m Indikator im 7-Tage-Dot**: Wenn Sensor-Event (nicht Nullnummer) + manueller Eintrag existieren, erscheint kleines `+m` im Kreis

### 🔧 Offene Baustellen
- `haus_still` Hop-Filter fehlt
- OC-22 / OC-26 / Long-COVID PEM

### 🎯 Nächster logischer Schritt
- Adapter auf 0.33.141 aktualisieren, Doppel-Icons + Legende prüfen

---

## 🗓️ Sitzung 14.04.2026 — Version 0.33.139

---

## 🗓️ Sitzung 14.04.2026 — Version 0.33.139

### ✅ Abgeschlossen
- **[Fix] Doppelte intimacyEvents über Tagesgrenzen**: Das Event 22:07 Uhr vom 14.04. erschien sowohl in `2026-04-14.json` als auch `2026-04-15.json`. Ursache: `saveDailyHistory()` verwendet `sleepSearchEvents` (ab 18:00 des Vortages), erkennt dabei Vorabend-Events und schreibt sie in die Datei des neuen Tages, ohne zu prüfen ob sie bereits im Vortages-JSON stehen. Fix: Dedup-Step direkt vor dem Snapshot-Write — erkannte `intimacyEvents` werden mit den Start-Timestamps der gestrigen JSON verglichen; Duplikate werden gefiltert und geloggt.

### 🔧 Offene Baustellen
- `haus_still` Hop-Filter fehlt
- OC-22 / OC-26 / Long-COVID PEM

### 🎯 Nächster logischer Schritt
- Adapter auf 0.33.139 aktualisieren, dann `reanalyzeSexDay('2026-04-15')` anstoßen → Event sollte aus 15.04 verschwinden

---

## 🗓️ Sitzung 14.04.2026 — Version 0.33.140 (Sex-Feature)

### ✅ Abgeschlossen
- **[Fix] Nullnummer nicht in Sessionzählung + Kalender-Icons**:
  - **7-Tage-Zählung** (`withEvents`): Tage mit Nullnummer-Label werden nicht mehr als Session gezählt (`weekCount` sinkt entsprechend)
  - **7-Tage-Zellen**: Nullnummer-Tage zeigen `—` statt ⊘-Icon; wenn gleichzeitig manueller Eintrag → zeigt Manual-Icon (🌷/💋/✨) + "manuell"-Hinweis
  - **Monatskalender**: Nullnummer-Label unterdrückt den algorithmischen Icon (🌹/💋); manueller Eintrag des gleichen Tages bleibt sichtbar (🌷)
  - `SevenDayHistory` erhält neues `manualEntries`-Prop (aus `SexTab`)
  - `MonthCalendar`: `isNullnummerDay`-Check vor `emoji`-Berechnung eingefügt

### 🔧 Offene Baustellen
- `haus_still` Hop-Filter fehlt
- OC-22 / OC-26 / Long-COVID PEM

### 🎯 Nächster logischer Schritt
- Adapter auf 0.33.140 aktualisieren, Nullnummer-Tage im 7-Tage und Kalender prüfen

---

## 🗓️ Sitzung 14.04.2026 — Version 0.33.140 (Per-Person-Refactor)

### ✅ Abgeschlossen
- **[Refactor] Vollständige Vereinheitlichung Per-Person-Methoden-Kette**:
  - Per-Person-Analyse nutzt jetzt dieselbe Prioritätskette wie die globale Analyse:
    `fp2_vib → fp2 → motion_vib → vib_refined → gap60 → last_outside → haus_still → winstart`
  - Jede Stufe nutzt ausschließlich personengebundene Events (`personTag === person`)
  - Wiederverwendbare Hilfsfunktion `_pVibRefine(anchorTs)` für alle Vibrations-Verfeinerungsschritte
  - `_pAllSleepSources` und `_povAllowed` auf vollständige Liste erweitert
  - Quellnamen im Per-Person-Dropdown sind jetzt identisch mit der Hauptkachel
  - Kein doppelter Code mehr — kein historischer Ballast

### 🔧 Offene Baustellen
- `haus_still` Hop-Filter fehlt
- OC-22: Einschlafzeit-Prior-Modell
- OC-26: Sensor-Onboarding-Assistent
- Long-COVID PEM-Erkennung
- Garmin pro Person (Backlog)

### 🎯 Nächster logischer Schritt
- Adapter 0.33.139 + 0.33.140 in Gondelsheim einspielen
- Prüfen: zeigt Ingrid/Robert-Dropdown jetzt fp2_vib/fp2/motion_vib wenn Sensoren vorhanden?

---

## 🗓️ Sitzung 14.04.2026 — Version 0.33.139

### ✅ Abgeschlossen
- **[Feature] Per-Person Vibrations-Verfeinerung der Einschlafzeit**:
  - Neuer Quelltyp `vib_refined` im Per-Person-Zweig (Ingrid/Robert-Kacheln)
  - Nach `gap60`/`last_outside`/`haus_still` wird ein Vibrations-Verfeinerungsschritt ausgeführt:
    letztes personTagged Vib-Event im Fenster `_pSleepStart + 3h` mit ≥20 Min Stille danach
  - Analog zur globalen `fp2_vib`-Logik — das Rad wird nicht neu erfunden
  - Da Ingrid und Robert je eigene personTagged Vibrationssensoren haben, ist die Zuordnung sauber
  - `_pAllSleepSources` und `_povAllowed` um `vib_refined` erweitert
- **[Feature] Sensor-Name im Dreieck-Tooltip (outsideBedEvents)**:
  - Beim Clustern von Außerhalb-Events wird jetzt `name` + `location` des auslösenden Sensors gespeichert
  - Dreieck-Hover im Frontend zeigt jetzt: `Bad-Besuch: 6 min\n  · Bewegung EG Bad (EG Bad)`
  - Gilt für globale und Per-Person-outsideBedEvents
- **[Fix] Umbenennung `gap60` → `Letzte Bettbewegung`** in srcInfo-Labels (HealthTab)
  - Neuer Label für `vib_refined`: `📳 Letzte Bettbewegung (Vibration)`
  - HelpText-Tooltip aktualisiert (kein "gap60-Logik"-Jargon mehr)
- **[Backlog] Garmin pro Person**: Design besprochen — Wearable-Sektion bekommt künftig
  mehrere Blöcke mit Person-Dropdown, analog zur Sensor-Liste. Noch nicht implementiert.

### 🔧 Offene Baustellen
- `haus_still` Hop-Filter fehlt (OG-Flur blockiert Stille-Prüfung)
- OC-22: Einschlafzeit-Prior-Modell
- OC-26: Sensor-Onboarding-Assistent
- Long-COVID PEM-Erkennung
- Garmin pro Person (Backlog — Design klar, Impl. noch offen)

### 🎯 Nächster logischer Schritt
- Adapter auf 0.33.139 in Gondelsheim einspielen
- Nächste Nacht prüfen: zeigt Ingrid/Robert-Kachel jetzt `📳 Letzte Bettbewegung (Vibration)` als Quelle?
- Dreieck-Tooltips prüfen: erscheinen Sensor-Namen beim Hover?

---

## 🗓️ Sitzung 14.04.2026 — Version 0.33.137 / 0.33.138

### ✅ Abgeschlossen
- **[Fix] Icon-System SexTab komplett vereinheitlicht**: Nach mehreren Korrekturrunden (PowerShell-Encoding-Probleme) jetzt stabil per line-by-line Node.js-Script:
  - 🌹 Vaginal (Sensor-erkannt)
  - 💋 Oral/Hand (überall, auch Legende)
  - ✨ Sonstiges/Intim
  - 🌷 Vaginal manuell (im Monatskalender)
  - ⛔ Nullnummer-Badge (war fälschlicherweise "sonstiges")
- **[Fix] Kalender-Legende** hatte noch `👄`, `💜`, `✎` — jetzt korrekt 💋 / ✨ / 🌷
- **[Fix] Badge-Farben in LabelForm + ManualSessionForm**: Waren noch hardcodiert dupliziert — jetzt zentrale `typeBg()`/`typeColor()`-Hilfsfunktionen
- **[Fix] ✦ → ✨**: 9 Stellen im Code hatten das statische Sternchen, alle auf Sparkles-Emoji geändert

### 🔧 Offene Baustellen
- `haus_still` Hop-Filter fehlt (OG-Flur blockiert Stille-Prüfung)
- OC-22: Einschlafzeit-Prior-Modell
- OC-26: Sensor-Onboarding-Assistent
- Long-COVID PEM-Erkennung

### 🎯 Nächster logischer Schritt
- Adapter auf 0.33.138 aktualisieren, Icons + Nullnummer-Badge visuell prüfen

---

## 🗓️ Sitzung 14.04.2026 — Version 0.33.136

### ✅ Abgeschlossen
- **[Fix] Backend-Handler fehlten in main.js**: `saveManualSexSession`, `getManualSexSessions`, `deleteManualSexSession` wurden beim letzten Build durch einen PowerShell CRLF/LF-Mismatch nicht in `src/main.js` eingefügt. Fix: Handler korrekt per Zeilennummer-Insert eingefügt, Backend neu gebaut.
- **[Fix] Form-Reset nur bei Erfolg**: ManualSessionForm löschte Uhrzeit+Dauer sofort, unabhängig vom Speicher-Ergebnis. `onAdd` ist jetzt `Promise<boolean>`, Formular wird nur bei `true` geleert.
- **[Neu] Einheitliches Icon-System im SexTab**: Alle drei Kacheln (Monatskalender, Training-Labels, Manuelle Sessions) nutzen jetzt:
  - `♥` / `♡` für vaginal (algo / nur manuell)
  - `💋` für oral/hand (ersetzt `💜` / `◐`)
  - `✨` / `✦` für sonstiges (ersetzt `◆`)
  - Typ-Farben für oral_hand auf Lila (`#7b1fa2`) und sonstiges auf Grün (`#2e7d32`) vereinheitlicht
- **[Refactor] `typeBg`/`typeColor` für Badges**: Beide Kacheln (LabelForm, ManualSessionForm) nutzen jetzt zentrale Hilfsfunktionen statt inline duplizierter Farb-Logik.

### 🔧 Offene Baustellen
- `haus_still` Hop-Filter fehlt noch (OG-Flur blockiert Stille-Prüfung)
- OC-22: Einschlafzeit-Prior-Modell
- OC-26: Sensor-Onboarding-Assistent
- Long-COVID PEM-Erkennung (Brainstorming vorhanden)

### 🎯 Nächster logischer Schritt
- Adapter auf 0.33.136 aktualisieren, manuelles Speichern testen
- Kalender-Icons und Badge-Farben visuell prüfen

---

## 🗓️ Sitzung 14.04.2026 — Version 0.33.135

### ✅ Abgeschlossen
- **[Fix] LabelForm Haken verschwinden**: `loadDay` wurde nur für 7-Tage-Fenster aufgerufen. Labels älter als 7 Tage zeigten `–` obwohl `intimacyEvents` korrekt in JSON gespeichert waren. Fix: LabelForm triggert `loadDay` für alle Label-Daten außerhalb des Fensters.
- **[Fix] Kalender refresht nicht nach Reanalyse**: `loadMonth` wird jetzt nach Reanalyse für den aktuellen Monat neu aufgerufen.
- **[Feature] Manuelle Session eintragen**: Neue Kachel im SexTab für Sessions außerhalb des Bettes. Speichert in `sex-manual.json`. Visuell im Kalender unterschieden (gestrichelt). Kein Einfluss auf ML-Training.
- **[UI] Kachel-Titel** „SESSION EINTRAGEN" → „SESSION EINTRAGEN (Trainingsdaten)"

### 🔧 Offene Baustellen
- **`isExit` Backend fehlt**: noch nicht implementiert
- **Dead-Man Außerhaus-Erkennung**: Person muss Dead-Man manuell deaktivieren
- Kein „Alle Tage neu analysieren" für Schlaf
- Python SexBrain: wartet auf 5 Labels gesamt (≥2 pro Positivtyp)
- **haus_still Hop-Filter (OC-24)**: Fix (2) implementiert, Fix (1) Hop-Filter noch offen

### 📋 Nächste Session — Backlog
- **Long-COVID PEM-Erkennung** in `health.py` (Boom-Bust >120% → <60%, algorithmisch einfach)
- **OC-22 Stufe 1: Gelernter Einschlafzeit-Prior** (Rolling 7-Nacht-Mittelwert pro Person, kein ML nötig)
- **OC-26: Sensor-Onboarding-Checkliste** (Toast wenn gespeicherter Sensor nicht in Topologie-Matrix)

### 🎯 Nächster logischer Schritt
- Long-COVID + OC-22 implementieren (beide algorithmisch klar, kleiner Aufwand)

---

## 🗓️ Sitzung 13.04.2026 — Version 0.33.133

### ✅ Abgeschlossen
- **[Fix] Dead-Man globale Aktivitätsprüfung**: Topologie-Filter (`areRoomsConnected`) entfernt. Jede Bewegung in irgendeinem konfigurierten Raum setzt jetzt den Timer zurück — unabhängig von Topologie-Verbindungen. Ursache der Fehlalarme: PIR-Hold-Times (Sensor noch auf "True" wenn Person durch Durchgangsraum geht → kein neuer Rising-Edge → Timer-Reset blieb aus). Door-Events (Typ `door`) triggern jetzt ebenfalls `updateLocation`.
- **[Fix] Sensor-Ausfall Fehlalarme light/dimmer**: Sensoren vom Typ `light` und `dimmer` werden in `checkSensorHealth()` übersprungen. Lampen senden nur bei Schaltvorgang — kein Heartbeat → würden sonst bei langer Nichtbenutzung als "ausgefallen" gemeldet. Typen direkt aus SensorList.tsx-Definitionen übernommen.
- **[Fix] Morning Briefing "keine Nachtdaten"**: `sendMorningBriefing` las bisher die GESTRIGE Datei (yesterday). Da Nacht 23:41→06:00 → `sleepWindowEnd` in HEUTIGER Datei steht, war die Datei gestern leer. Fix: Heute-Datei bevorzugen, Fallback gestern.
- **[Feature] "Alle Tage neu analysieren"-Button**: Neuer Backend-Handler `reanalyzeAllSexDays` iteriert alle History-JSON-Dateien und reanalysiert den Sex-Algorithmus. Frontend-Button (lila) neben "Neu analysieren" im Sex-Tab mit Progress-Feedback.

### 🔧 Offene Baustellen
- **`isExit` Backend fehlt**: Der "Ausgangs-Sensor"-Toggle in SensorList.tsx existiert im UI, aber kein Backend-Code wertet `isExit` aus. Durch globalen Dead-Man weniger kritisch, aber noch nicht implementiert.
- **Dead-Man Außerhaus-Erkennung**: Wenn Person das Haus verlässt → kein Sensor mehr → Dead-Man feuert nach Timeout. Ohne WiFi-Präsenz gibt es keinen automatischen Weg dies zu erkennen. Aktuell: Person muss Dead-Man manuell deaktivieren oder isExit implementieren.
- Kein „Alle Tage neu analysieren" für Schlaf (nur Sex implementiert)
- Python SexBrain: erste Nullnummer eingetragen (13.04.2026), wartet auf 5 Labels gesamt

### 🎯 Nächster logischer Schritt
- Adapter in ioBroker auf 0.33.133 updaten
- Dead-Man testen: Schutzengel-Fragen sollten deutlich seltener werden
- Morning Briefing morgen früh beobachten ob Nachtdaten kommen
- `isExit` Backend implementieren (Door-Event + keine Folgebewegung → Dead-Man pausieren)

### 📊 Analyse-Erkenntnisse (13.04.2026)
- Dead-Man Fehlalarme analysiert (JSON 2026-04-13.json):
  - 07:43: Person war außer Haus (07:10→10:27, 197 Min Lücke, Rückkehr via Türevent EG Flur 10:27)
  - 11:16: Stille in EG Wohnen nach Rückkehr (10:32+44Min)
  - 13:30: Bad-Timer 12:45 (45 Min) lief durch weil Durchgangsraum EG Schlafen PIR in Hold-Time war
  - 14:21: Wohnen-Timer 13:36 (45 Min) wegen fehlender Topologie-Verbindung Wohnen↔Küche

---

## 🗓️ Sitzung 12.04.2026 — Version 0.33.132

### ✅ Abgeschlossen
- **[Fix] Nullnummer-Button Emoji kaputt**: `\ud83dude ab Nullnummer` (Literal-Text) → echtes UTF-8-Zeichen 🚫 durch `[char]::ConvertFromUtf32(0x1F6AB)`. Ursache: PowerShell-Single-Quotes interpretieren `\u`-Escapes nicht.

---

## 🗓️ Sitzung 12.04.2026 — Version 0.33.131

### ✅ Abgeschlossen
- **[Fix] Nullnummer per Session wählbar**: Bei mehreren erkannten Sessions an einem Tag zeigt die Kachel jetzt eine kompakte Session-Liste mit individuellem Nullnummer-Button pro Session. Neue Hilfsfunktion `findLabelForEvent(dStr, evt, labels)` mit ±1h Fenster (statt ±2h für alle Events). Undo-Button zielt exakt auf das Label des jeweiligen Events.

## 🗓️ Sitzung 12.04.2026 — Version 0.33.130

### ✅ Abgeschlossen
- **[Feature] Nullnummer-Flag für Falsch-erkannte Sex-Sessions**: Wenn der Algorithmus fälschlicherweise eine Session erkennt (z. B. unruhiges Schlafen, Bett beziehen), kann der Nutzer diese als "Nullnummer" markieren.
  - **SexTab.tsx**: Neuer "🚫 Das war kein Sex — Nullnummer eintragen"-Button am Ende jeder erkannten Session-Kachel. Bei bereits eingetragener Nullnummer: graue Sonderkarte mit Rückgängig-Button.
  - **SevenDayHistory**: Nullnummer-Tage zeigen ⛔-Symbol mit gedämpftem Dot statt normaler Session-Anzeige.
  - **sex.py (Stufe 3)**: `nullnummer` als dritte RF-Klasse neben `vaginal` und `oral_hand`. Kein Mindest-Count erforderlich (1 Sample reicht). Positive Klassen (vaginal/oral_hand) behalten weiterhin MIN_PER_CLASS=2.
  - **src/main.js (tägliche Analyse + Reanalysis)**: Wenn RF eine Session mit `type='nullnummer'` und `confidence >= 0.60` klassifiziert, wird sie vollständig aus `intimacyEvents` herausgefiltert (nicht nur umklassifiziert).
  - **Kalibrierung**: Nullnummer-Labels beeinflussen `calibA`/`calibB` NICHT (gehen nicht in `_sessionPeaks`/`_vaginalPeaks`/`_oralPeaks` ein), fließen aber als Trainingsdaten in `_sexTrainData` ein.

### 🔧 Offene Baustellen
- **Dead-Man „Bad EG"-Fehlmeldung**: Timer startet wenn Sensor im Bad feuert, wird aber NICHT zurückgesetzt wenn du danach z. B. in der Küche bist. Lösung: Dead-Man auf alle konfigurierten Sensor-Events reagieren lassen, ODER Raum-Timeout für Bad deutlich erhöhen (>60 Min).
- **Sensor-Ausfall Push-Meldungen** (z. B. „Sensor-Ausfall Hue on"): Ursache noch nicht vollständig gefunden — vermutlich aus Inaktivitäts-Logik (`inactivityThresholdHours` = 12h). Noch kein Fix.
- Kein „Alle Tage neu analysieren"-Button
- Python SexBrain noch inaktiv (braucht 5 Labels) — Nullnummer-Labels zählen als Training, aber nicht zur Aktivierungsschwelle

### 🎯 Nächster logischer Schritt
- Adapter in ioBroker auf 0.33.130 updaten
- Heutige Nacht (12.04.2026) als Nullnummer eintragen → erstes FP-Label für den RF
- Sobald 5 Labels (inkl. Nullnummer) vorhanden: RF-Training beobachten ob `nullnummer` als Feature sinnvoll gewichtet wird

### 💡 Architektur-Entscheidung (Nullnummer)
- **Interner Typ**: `nullnummer` (eindeutig, maschinell lesbar)
- **UI-Text**: "Nullnummer — Das war kein Sex" / "🚫 Das war kein Sex — Nullnummer eintragen"
- **Lerneffekt Stufe 3**: RF trainiert auf 3 Klassen → nach 2-3 Nullnummer-Samples erkennt er das Muster automatisch (kurze Session, hoher Peak durch Einschlaf-Bewegung, nearbyRoomMotion aktiv)
- **Kein Einfluss auf Schwellen**: Nullnummer-Labels justieren calibA/calibB nicht (sonst würde er echte Sessions unterdrücken)

---

## 🗓️ Sitzung 11.04.2026 — Version 0.33.129

### ✅ Abgeschlossen
- **[Fix] IntimacyBar zeigt alle Sessions**: `IntimacyBar` in `SexTab.tsx` akzeptierte bisher nur `events[0]` (erstes Event). Bei 2 erkannten Sessions war die zweite im Intensitätsbalken komplett unsichtbar. Fix: Komponente nimmt jetzt `events: IntimacyEvent[]` — Zeitfenster spannt sich über alle Events, alle Slots werden gerendert, je eine pink Start-Markierung pro Session.

### 🔧 Offene Baustellen
- **Dead-Man „Bad EG"-Fehlmeldung**: Timer startet wenn Sensor im Bad feuert, wird aber NICHT zurückgesetzt wenn du danach z. B. in der Küche bist. Lösung: Dead-Man auf alle konfigurierten Sensor-Events reagieren lassen, ODER Raum-Timeout für Bad deutlich erhöhen (>60 Min).
- **Sensor-Ausfall Push-Meldungen** (z. B. „Sensor-Ausfall Hue on"): Ursache noch nicht vollständig gefunden — vermutlich aus Inaktivitäts-Logik (`inactivityThresholdHours` = 12h). Noch kein Fix.
- Kein „Alle Tage neu analysieren"-Button
- Python SexBrain noch inaktiv (braucht 5 Labels)

### 🎯 Nächster logischer Schritt
- Adapter in ioBroker auf 0.33.129 updaten → Intensitätsbalken prüfen ob beide Sessions sichtbar
- Dead-Man-Logik in `src/lib/dead_man.js` analysieren

---

## 🗓️ Sitzung 10.04.2026 — Version 0.33.127

### ✅ Abgeschlossen
- **[Fix] Morning Briefing feuert wieder**: `analysis.triggerBriefing` und `analysis.triggerWeeklyBriefing` wurden nicht in `subscribeStates` registriert — der Scheduler setzte den State, aber `onStateChange` hörte nicht zu. Fix in `src/main.js`, gebaut und gepusht.
- **[Fix] Deployment-Fehler dieser Sitzung korrigiert**: Falscher Edit direkt in `lib/main.js` (statt `src/main.js`) rückgängig gemacht, korrekter Workflow durchgeführt (build:backend:prod → node --check → git push).

### 🔧 Offene Baustellen
- **Dead-Man „Bad EG"-Fehlmeldung**: Timer startet wenn Sensor im Bad feuert, wird aber NICHT zurückgesetzt wenn du danach z. B. in der Küche bist (weil Küchen-Events möglicherweise nicht als `motion` ankommen oder areRoomsConnected den Raum als "nicht verbunden" behandelt). Lösung: Dead-Man auf alle konfigurierten Sensor-Events (nicht nur motion) reagieren lassen, ODER Raum-Timeout für Bad deutlich erhöhen (>60 Min).
- **Sensor-Ausfall Push-Meldungen** (z. B. „Sensor-Ausfall Hue on"): Ursache noch nicht vollständig im Code gefunden — Meldung kommt vermutlich aus Inaktivitäts-Logik (`inactivityThresholdHours` = 12h). Noch kein Fix.
- Kein „Alle Tage neu analysieren"-Button
- Python SexBrain noch inaktiv (braucht 5 Labels)

### 🎯 Nächster logischer Schritt
- Adapter in ioBroker auf 0.33.127 updaten → Morgenbriefing prüfen
- Dead-Man-Logik in `src/lib/dead_man.js` analysieren und Raum-Timeout für Bad/Keller erhöhen oder Multi-Sensor-Reset implementieren

---

## 🗓️ Sitzung 10.04.2026 — Version 0.33.124

### ✅ Abgeschlossen
- **[OC-7] Radar-Aussetzer vs. echte Außerhalb-Events**: FP2-Solo-Dropouts (kein anderer Raumsensor bestätigt Abwesenheit) erhalten `confirmed: false` im Backend. Frontend: unbestätigte Events = kleine graue ▲-Dreiecke (opacity 0.55) statt rote Dreiecke. `outsideTotalMin`, `bathMin` und Schlafbalken-Overlay nur noch für `confirmed === true`. Statistikzeile zeigt "N× Radar-Aussetzer" als dezenten Hinweis mit Tooltip.
- **Analyse**: In der Nacht 10.04.2026 waren 6 von 7 roten Dreiecken Radar-Aussetzer (FP2 verlor Person kurz im Tiefschlaf, ~6–10 min, kein Außensensor feuerte). Nur 05:33 war der echte Bad-Besuch.

### 🔧 Offene Baustellen
- Kein "Alle Tage neu analysieren"-Button (nur einzeln per "Neu analysieren")
- Python SexBrain noch inaktiv (braucht 5 Labels gesamt, min. 2x pro Typ)

### 🎯 Nächster logischer Schritt
- Nach Adapter-Update in ioBroker: Schlafkachel prüfen → graue Dreiecke für Radar-Aussetzer, rote nur für echte Events
- 5. Label im SexBrain eintragen → Python RF aktiviert sich automatisch

---

## 🗓️ Sitzung 10.04.2026 — Version 0.33.122

### ✅ Abgeschlossen
- **Manuelles Label überschreibt Sensor-Typ**: `findMatchingLabel()`-Helper (±2h Zeitfenster) in `SexTab.tsx` — Hauptkachel und 7-Tage-Dots zeigen jetzt den manuell eingetragenen Typ als primären Wert. Sensor-Ergebnis bei Abweichung als Sekundärinfo ("Sensor erkannte: Vaginal"). Badge wechselt auf "✏ Manuell eingetragen" (blau).
- **Python LOO-Genauigkeit**: Leave-One-Out Cross-Validation in `sex.py` (nur bei ≥5 Samples), Ergebnis im `classify_sessions`-Response als `loo_accuracy`
- **Python Feature-Importance**: Top-5 Merkmale mit Balkendiagramm in der KI-Klassifikator-Box im Algorithmus-Tab sichtbar
- **calibInfo.pyClassifier** in main.js (beide Pfade): enthält jetzt `feature_importances` und `loo_accuracy`
- **SexDayCard + SevenDayHistory**: beide akzeptieren `labels`-Prop und rufen `findMatchingLabel` auf

### 🔧 Offene Baustellen
- Kein "Alle Tage neu analysieren"-Button (nur einzeln per "Neu analysieren")
- Python Modell noch nicht aktiv (braucht 5 Labels gesamt, min. 2x pro Typ)

### 🎯 Nächster logischer Schritt
- 5. Label eintragen → Python SexBrain aktiviert sich automatisch
- Feature-Importance + LOO-Accuracy werden dann in der UI sichtbar

---

## 🗓️ Sitzung 10.04.2026 — Version 0.33.121

### ✅ Abgeschlossen
- **Bug-Fix SexTab.tsx**: `ReferenceError: labels is not defined` behoben — `parseSexTrainingLabels()` jetzt auf Haupt-Komponenten-Ebene in `SexTab` definiert, nicht nur in `LabelForm`
- **nearbyRoomMotion (13. Feature)**: Topologie-BFS in `main.js` (saveDailyHistory + reanalyzeSexDay): aus `analysis.topology.structure` die Räume mit Hop-Distanz ≤ 2 vom Schlafzimmer berechnen, Motion-Events in diesen Räumen während einer Session als binäres Feature `nearbyRoomMotion` (0/1, Sentinel -1 wenn keine Topologie konfiguriert)
- **sex.py**: Feature-Liste auf 13 erweitert (`nearby_room_motion`), `_feat()`-Methode angepasst
- **Frontend**: `src-admin/src/components/tabs/SexTab.tsx` — `labels` korrekt in Haupt-Scope

### 🔧 Offene Baustellen
- Manuell eingetragene Sessions überschreiben noch nicht die Hauptanzeige (Sensor-Ergebnis dominiert)
- Kein "Alle Tage neu analysieren"-Button (nur einzeln per "Neu analysieren")

### 🎯 Nächster logischer Schritt
- Mehr Labels sammeln bis Python SexBrain aktiv wird (MIN_TOTAL=5, MIN_PER_CLASS=2)
- nearbyRoomMotion nach Praxistest evaluieren (Feature-Importance im Debug-Log prüfen)

---

## 🗓️ Sitzung 10.04.2026 — Version 0.33.120

### ✅ Abgeschlossen
- **[Feature] Kontext-Features im RF-Klassifikator (12 statt 5)**: Zeit (sin/cos zirkulär), Licht im Schlafzimmer, Präsenz (isFP2Bed), Raumtemperatur, Bad-Bewegung vorher/nachher. Alle Features NaN-robust (Sentinel -1 für fehlende Sensoren). Sensor-Zuordnung NUR über `sensorFunction` (kein Namens-Matching).
- **[Feature] Kontext-Feature-Extraktion in main.js**: Hilfsfunktion `_extractCtx()` / `_raExtractCtx()` in saveDailyHistory und reanalyzeSexDay — liest Licht, Präsenz, Temperatur und Bad-Bewegung aus eventHistory aus dem Session-Zeitfenster (±15min / ±60min). Ebenso in Trainings-Schleife der Labels.
- **[Feature] getSexMonthSummary Backend-Handler**: Liest alle JSON-Dateien eines Monats (YYYY-MM) und gibt kompakte Session-Zusammenfassung zurück (type, duration, score, start, end). Kein full-eventHistory-Download.
- **[Feature] MonthCalendar-Komponente**: Kompakter Monatskalender unter dem 7-Tage-Strip. Emoji pro Tag (♥/👄/💜), Monat-Navigation, Klick → Tagesansicht, Statistik-Zeile (X Tage, Y Sessions), Legende. Lädt Monatsdaten lazy per getSexMonthSummary.

### 🔧 Offene Baustellen
- Kontext-Features erst wirksam wenn ≥5 Labels mit gemischten Typen vorhanden (Python RF Aktivierungsschwelle)
- Manuell eingetragene Sessions überschreiben noch nicht die Anzeige (Sensor-Ergebnis dominiert noch)
- Kein "Alle Tage neu analysieren"-Button (nur einzeln per "Neu analysieren")

### 🎯 Nächster logischer Schritt
- Labels eintragen (vaginal + oral_hand gemischt) → Python RF aktiviert sich automatisch
- Manuell-Override für Anzeige implementieren (manuelle Session = Ground Truth für Kachel)

---

## 🗓️ Sitzung 10.04.2026 — Version 0.33.119

### ✅ Abgeschlossen
- **[Feature] Stufe 1 — Adaptive Typ-Schwellen**: Statt fester Werte 80/55 jetzt `calibA×1.5` für vaginal-Grenze und `calibA` für oral_hand-Grenze — passt sich automatisch an kalibrierte Werte an
- **[Feature] Stufe 2 — Per-Typ-Kalibrierung**: Vaginal-Labels und Oral-Labels werden getrennt ausgewertet. `calibA` kommt aus Vaginal-Median, `calibB` aus Oral-Median (wenn je ≥2 Labels pro Typ vorhanden). Fallback auf bisherige Methode.
- **[Feature] Stufe 3 — Python SexBrain (RandomForest)**: Neues `python_service/brains/sex.py` mit sklearn RandomForestClassifier. Features: peak, durSlots, avgPeak, variance, tierB. Aktiv sobald ≥5 Labels (mind. 2× vaginal + 2× oral). Fallback auf Stufe 1/2 wenn nicht trainierbar.
- **[Feature] CLASSIFY_SEX_SESSIONS Handler**: Neuer Python-Bridge-Command — trainiert und klassifiziert in einem Aufruf. Konfidenz ≥55% → überschreibt JS-Klassifikation.
- **[Feature] Frontend KI-Status**: Algorithmus-Block zeigt: "Aktiv — N Sessions trainiert" oder "Noch nicht aktiv — X mehr Labels benötigt". Session-Banner zeigt "🤖 KI: XX% Konfidenz" wenn Python-Klassifikator gewählt hat.
- **[Fix] Stufe 2 calibSrc `labels_typed`**: Frontend erkennt `labels_typed` und zeigt "Stufe-2-Kalibrierung (per Typ)"

### 🔧 Offene Baustellen
- Noch keine vaginal- UND oral-Labels gleichzeitig → Stufe 2 + 3 noch inaktiv bis genug Trainings-Sessions eingetragen sind (mind. 2× vaginal + 2× oral_hand für Stufe 2, min. 5 gesamt für Stufe 3)
- pyConf-Feld in 7-Tage-Verlauf noch nicht angezeigt (nur im Detail-Banner)
- Garmin HR-Integration in reanalyzeSexDay noch nicht vorhanden

### 🎯 Nächster logischer Schritt
- Sessions manuell eintragen (vaginal + oral) bis Stufe 2+3 aktiviert werden → Qualität prüfen
- Wenn KI aktiv: Konfidenz-Werte beobachten und ggf. Schwelle (aktuell 55%) anpassen

---

## 🗓️ Sitzung 10.04.2026 — Version 0.33.117

### ✅ Abgeschlossen
- **[Bug] Buffer-Gap-Fix: Abend-Sessions nach Adapter-Neustart nicht erkannt**
  - **Root-Cause**: `sleepSearchEvents` benutzt den In-Memory-Buffer (`this.eventHistory`). Nach Adapter-Neustart über Mitternacht startet der Buffer erst ab ~00:00 Uhr — Events von gestern Abend (18:00–23:59) fehlen komplett.
  - **Fix (src/main.js)**: Nach dem Aufbau von `sleepSearchEvents` wird geprüft ob der Buffer bis `sleepSearchBase` (18:00 gestern) zurückreicht. Falls nicht: fehlende Events werden aus der gespeicherten Tages-JSON (`sleepDate.json`) nachgeladen und einsortiert.
  - **Wirkung**: Ab sofort werden Abend-Sessions korrekt in der nächsten Morgenanalyse erkannt — auch nach Neustart.
- **[Feature] Retroaktiver "Neu analysieren"-Button im Sex-Tab**
  - **Backend**: `reanalyzeSexDay` Message-Handler liest die JSON des angeforderten Datums, führt vollständige Kalibrierung + Sex-Erkennung auf dem gesamten `eventHistory` durch, schreibt das Ergebnis zurück und sendet es ans Frontend.
  - **Frontend (SexTab.tsx)**: Grüner "⟳ Neu analysieren"-Button neben der Datums-Navigation. Bei Klick: Ladeindikator → sofortige Aktualisierung von Session-Kachel + Chart. Statusmeldung für 4 Sekunden sichtbar (✓ oder ⚠).
  - **Vorteil**: Vergangene Tage können jederzeit manuell neu ausgewertet werden — ohne Warten bis zur nächsten Morgenanalyse.

### 🔧 Offene Baustellen
- Type-Klassifikation (vaginal/oral_hand) nutzt noch feste Schwellen (80/55) statt adaptive Kalibrierung → Session vom 09.04. Abend wurde als `vaginal` statt `oral_hand` eingestuft (Peak 54, knapp unter 55)
- Die Neu-Analyse-Funktion lädt keine Garmin-HR-Daten (kein async State-Zugriff im onMessage für retroaktive Handler)

### 🎯 Nächster logischer Schritt
- Adapter in ioBroker aktualisieren und "Neu analysieren"-Button für 09.04. testen
- Prüfen ob Type-Klassifikation für oral_hand-Sessions angepasst werden soll (Schwelle von 55 auf calibA senken)

---

## 🗓️ Sitzung 09.04.2026 — Version 0.33.116

### ✅ Abgeschlossen
- **OBE-Dreiecke im Mehrpersonenhaushalt-Schlafbalken**
  - **Root-Cause-Analyse**: Drei übereinander liegende Lücken identifiziert:
    1. `overrideData.sleepStages: []` hardcoded → `hasVibSensor = false` → degradierter View
    2. Degradierter View zeigte keinen Balken, nur Meldungstext
    3. `overrideData.outsideBedEvents: []` hardcoded (Backend lieferte keine per-Person OBE)
  - **Backend** (`src/main.js`): `_pObe`-Berechnung im `personData`-Block — Cluster aus personTag-Events + Bad-Sensor-Events im Schlaffenster → `{ start, end, duration, type: 'bathroom'|'outside' }` → `result[person].outsideBedEvents`
  - **Frontend** (`HealthTab.tsx`): `overrideData.outsideBedEvents` auf `pd.outsideBedEvents ?? []` statt `[]`
  - **Frontend** (`HealthTab.tsx`): Im `!hasVibSensor`-Zweig (degradierter View) wird jetzt ein uniformer Grau-Balken + Zeitachse + Dreiecke (▼ Bad-Besuch orange, ▲ Außerhalb rot) gerendert — identische Marker-Logik wie im vollen View, Hinweistext "Schlafphasen nicht verfügbar" bleibt als kleine Fußnote

### 🔧 Offene Baustellen
- Per-Person OBE-Zuweisung ist vereinfacht (kein FP2-Solo-Dropout-Filter, kein Topology-Hop-Filter) — für den Mehrpersonenfall ohne FP2 ausreichend

### 🎯 Nächster logischer Schritt
- Adapter aktualisieren und Multi-Person Schlafkacheln prüfen (Dreiecke erscheinen wenn Badezimmer-Sensor nachts feuert)
- Prüfen ob Badezimmer-Sensor als `isBathroomSensor` oder `sensorFunction: 'bathroom'` konfiguriert ist

---

## 🗓️ Sitzung 09.04.2026 — Version 0.33.113

### ✅ Abgeschlossen
- **Vibrationsverlauf-Kacheln im Sex-Tab** — zwei neue Chart-Kacheln unterhalb aller anderen Kacheln
- **Garmin-Style**: `ComposedChart` mit 5-Min-Balken (farbkodiert nach calibA/B) + Glättungslinie + Referenzlinien
  - Lila Balken wenn Stärke ≥ calibA (vaginal-Schwelle)
  - Rosa Balken wenn Stärke ≥ calibB (oral/hand-Schwelle)  
  - Grau wenn Bewegung vorhanden aber unter Schwelle
- **Aura-Style**: `AreaChart` auf dauerhaft dunklem Hintergrund (#0a0a0a), Neon-Gradient (violett→pink), Trigger als Cyan-Fläche, Referenzlinien leuchten
- **Live-Sensor-Subscription**: `socket.subscribeState()` auf den konfigurierten Vibrationsstärke-Sensor aus `native.devices` (Typ `vibration_strength`, Funktion `bed`). Echtzeitdaten werden in den aktuellen Tag-Chart eingearbeitet. Cleanup beim Unmount.
- **Zoom**: 6h / 12h / 24h Buttons zum Einschränken des sichtbaren Zeitfensters
- **Session-Shading**: Erkannte Intimacy-Sessions werden als halbtransparente Fläche hinterlegt
- **`loadDay`** wurde erweitert: extrahiert jetzt zusätzlich Vibrations-Events aus `eventHistory` für den Chart (in separatem `vibRaw` State)
- Sensor-IDs werden automatisch aus `native.devices` gelesen (kein hardcoding)

### 🔧 Offene Baustellen
- Chart erscheint nur wenn `funMode` aktiv ist (sexFunMode !== false)
- Kalibrierungs-Anzeige im ALGORITHMUS-Block noch ohne Daten bis täglicher Snapshot gespeichert wird
- Zwei separate Zoom-States (einer pro Chart) — könnten auf einen gemeinsamen State geteilt werden

### 🎯 Nächster logischer Schritt
- Adapter aktualisieren und Charts im echten Browser testen
- Prüfen ob Live-Subscription korrekt feuert (Sensor-ID muss exakt stimmen)
- Entscheidung: welcher Chart-Stil gefällt besser → den anderen ggf. entfernen

---

## 🗓️ Sitzung 09.04.2026 — Version 0.33.112

### ✅ Abgeschlossen
- **Adaptive Kalibrierung (OC-SEX Algorithmus)** — Item 4 aus ursprünglichem Roadmap vollständig umgesetzt
- **Prioritätskette**: 1) Auto aus Training-Labels → 2) Manuell (sexCalibThreshold) → 3) Anomalie-Baseline → 4) Defaults
- **Label-Kalibrierung**: Liest bis zu 7 historische JSON-Dateien, berechnet Slot-Peak-Median pro Session, leitet calibA/calibB daraus ab
- **Anomalie-Baseline**: P75 der Nacht-Vibration × 2.5 (A) / × 1.5 (B) — funktioniert ohne jede Training-Session
- **sexCalibInfo** im täglichen Snapshot gespeichert (`{ src, n, calibA, calibB }`)
- **Sex-Tab Algorithmus-Box** zeigt jetzt die aktiven Schwellen und Kalibrierungsquelle live an (grün = Labels, blau = Baseline, grau = Defaults)

### 🔧 Offene Baustellen
- Kalibrierungsanzeige im Sex-Tab erscheint erst nach dem nächsten täglichen Speichern (ca. 10 Uhr)
- Typ-Klassifikation (vaginal/oral_hand) noch auf alten festen Schwellen (80/55) — könnte auch adaptiv werden

### 🎯 Nächster logischer Schritt
- System einen Tag laufen lassen → prüfen ob calibInfo im Snapshot auftaucht und korrekte Werte zeigt
- Ggf. mehr Training-Sessions eintragen → Kalibrierung beobachten

---

## 🗓️ Sitzung 09.04.2026 — Version 0.33.111

### ✅ Abgeschlossen
- **[UX] Sex-Tab: Training-Labels-Formular**
  - Interaktives Formular mit DatePicker, TimePicker (optional), Dauer (optional), Typ-Dropdown (vaginal/oral_hand/sonstiges)
  - Liste der eingetragenen Sessions mit ✓/⚠-Status und Löschen-Button
  - Ersetzt das unbrauchbare JSON-Textarea aus den System-Einstellungen
  - Speichert direkt via `onChange` → native.sexTrainingLabels (kein Seiten-Reload nötig)
- **[UX] Sex-Tab: Retroaktiver-Berechnung-Block entfernt**
  - "VERGANGENE DATEN BERECHNEN"-Kachel aus Frontend entfernt
  - `recalcIntimacyHistory`-Handler komplett aus Backend entfernt
  - Hintergrund: Bug-Analyse zeigte dass retroaktive Berechnung falsche Zeitfenster verwendete und mit force=true alle historischen Sessions löschte
- **[Algorithmus] Zeitfenster entfernt**
  - Kein 10:00-03:00 Limit mehr → voller sleepSearchEvents-Buffer wird analysiert
  - Begründung: Sex passiert zu jeder Tageszeit
- **[Algorithmus] 15-Min-Slots → 5-Min-Slots**
  - Quickie-Erkennung ab 10 Minuten (vorher: 45 Minuten Minimum!)
  - Wissenschaftliche Grundlage: Median penetrativer Sex = 5,4 Min (Journal of Sexual Medicine)
- **[Algorithmus] Pfad A + Pfad B (neu)**
  - Pfad A (kurz+intensiv/Quickie): ≥2 konsekutive 5-Min-Slots, Peak ≥ calibA (Standard 50)
  - Pfad B (länger+moderat): ≥6 konsekutive 5-Min-Slots (30+ Min), max 24 Slots (120 Min), Peak ≥ calibB (Standard 30)
  - Adaptive Schwellen via `native.sexCalibThreshold` vorbereitet (noch manuell, automatisch aus Labels folgt)
- **[UX] Zyklus-Tab: ZyklusDatenManager**
  - DatePicker-Liste für Zyklusstarts mit Hinzufügen + Löschen-Button
  - Zykluslänge-Feld direkt im Zyklus-Tab (vorher: System-Einstellungen)
  - Zeigt berechnete Zykluslänge zwischen eingetragenen Daten an
- **[Settings] Veraltete Felder entfernt**
  - `sexTrainingLabels` Textarea aus Settings.tsx entfernt (jetzt im Sex-Tab)
  - `zyklusStartDaten` TextField aus Settings.tsx entfernt (jetzt im Zyklus-Tab)
  - `zyklusLaenge` TextField aus Settings.tsx entfernt (jetzt im Zyklus-Tab)
  - Settings zeigt Hinweis-Text: "Daten werden im Tab Zyklus verwaltet"

### 🔧 Offene Baustellen
- **Adaptive Kalibrierung noch manuell**: `sexCalibThreshold` muss per Hand in native config gesetzt werden; automatische Berechnung aus Training-Labels (Perzentil aus historischen JSON-Files) noch nicht implementiert
- **Sensor-Schwellen ungetestet**: Standard calibA=50, calibB=30 sind Schätzwerte; nach ersten Training-Label-Einträgen prüfen ob Events erkannt werden
- RAUM-NUTZUNG / HEATMAP: kein helpText-Tooltip

### 🎯 Nächster logischer Schritt
- Update v0.33.111 einspielen, Sex-Tab öffnen
- 3-5 bekannte Sessions als Training-Labels eintragen (Datum, ca. Uhrzeit, Typ)
- Prüfen ob ✓ (grün) oder ⚠ (gelb) angezeigt wird → gibt Hinweis ob Schwellen calibA/calibB passen
- Falls alle ⚠: calibA/calibB in native config anpassen (niedriger setzen)
- Danach: automatische Kalibrierung aus Labels implementieren (Berechnung der Perzentile aus eventHistory)

---

## 🗓️ Sitzung 08.04.2026 — Version 0.33.110

### ✅ Abgeschlossen
- **[Fix OC-SEX] Recalc `force` persistiert leere `intimacyEvents`**
  - Wenn der Algorithmus 0 Events findet, wurde bisher die JSON-Datei nicht aktualisiert → alte False-Positives blieben stehen; nach Browser-Reload wieder sichtbar.
  - Jetzt: bei `force` werden auch `[]` geschrieben; gleiches bei fehlendem `eventHistory` oder &lt;3 Vib-Events im Fenster.
- **[Fix OC-SEX] Admin lädt History nach Recalc ohne Reload**
  - `cacheGen`-State triggert `useEffect` erneut (nicht nur `setDayData({})`).
- **[Log OC-SEX]** `recalc start` / `recalc fertig` (info); daily bei 0 Events → `debug`; Recalc-Fehler → `warn`.
- **[Feature]** `sexTrainingLabels` (JSON) in Einstellungen + Anzeige „TRAINING / REFERENZ“ im Sex-Tab (Abgleich ±90 Min).
- **Doku:** HANDBUCH (OC-SEX-Abschnitt), TESTING T-SEX1/T-SEX2.

### 🎯 Nächster logischer Schritt
- Optional: aus Labels automatisch Schwellen-Vorschläge loggen (ohne NN).

---

## 🗓️ Sitzung 08.04.2026 — Version 0.33.107

### ✅ Abgeschlossen
- **[Feature] Zyklus-Kachel (moduleZyklus, Datenschutz-Flag)**
  - Neuer Tab "🌸 Zyklus" hinter "Sex" in der Navigation
  - Wissenschaftliche Grundlage: Knaus-Ogino + adaptiver Zyklusdurchschnitt (ab 2 gespeicherten Zyklen)
  - Phasenband: Menstruation/Follikel/Fruchtbar/Eisprung/Luteal/PMS mit Farben und HEUTE-Markierung
  - 3-Monats-Prognose: Periode, Eisprung, fruchtbares Fenster für 3 kommende Zyklen
  - Verlauf: 6 Monate Balkendiagramm mit Abweichung vom Durchschnitt
  - Konfidenz-Anzeige: Hoch (≥5), Mittel (≥3), Niedrig (≥1 Zyklus)
  - Alle Daten lokal in native Config (zyklusStartDaten als komma-getrennte Datumsliste)
  - Settings: moduleZyklus Toggle + zyklusLaenge (Standard 28) + zyklusStartDaten TextField
- **[Feature] Retroaktive Sex-Berechnung**
  - Neues Backend-Command: recalcIntimacyHistory
  - Liest eventHistory aus historischen JSON-Snapshots, führt gleichen Algorithmus wie saveDailyHistory aus
  - Schreibt intimacyEvents zurück in die JSON-Dateien (einmalig für Tage vor v0.33.105)
  - Frontend: Button "RETROAKTIV BERECHNEN" in SexTab mit Fortschritts- und Ergebnis-Feedback
- **[Feature] Zyklus-Kontext in Sex-Fun-Kommentaren**
  - getFunComment() bekommt optional native config übergeben
  - Erkennt Zyklus-Phase für das Datum des Events (Eisprung → "Kluger Schachzug", Fruchtbar → Hinweis, Menstruation → "Red Zone", PMS → "Respekt")
  - Nur aktiv wenn moduleZyklus === true
- **[Fix] Zeitfenster Algorithmus-Info-Text korrigiert** (war noch "16:00-02:00" im UI-Text)

### 🎯 Nächster logischer Schritt
- Zyklus-Tab nach Update v0.33.107 einrichten: zyklusStartDaten in Einstellungen eintragen
- Retroaktive Berechnung einmalig über Button ausführen
- Garmin RHR-Korrelation (ab 3 Zyklen möglich): könnte Eisprung-Präzision verbessern

---

## 🗓️ Sitzung 08.04.2026 — Version 0.33.106

### ✅ Abgeschlossen
- **[Fix OC-SEX] SEX-Kachel zeigt keine Daten (Lade Daten... hängt)**
  - Bug: `sendTo` verwendete Command `'getStats'` statt `'getHistoryData'` → Backend antwortete nie
  - Fix: Command korrigiert auf `getHistoryData` (wie alle anderen Tabs)
- **[Fix OC-SEX] Zeitfenster für Intimacy-Detection von 16-02h auf 06:00–03:00 erweitert**
  - Begründung: Aktivitäten können morgens, mittags oder abends stattfinden
  - Backend: `_intim16h` → `_intim6h` (06:00), `_intimWinEnd` auf 03:00 nächster Tag
  - Frontend IntimacyBar: Achse ist jetzt dynamisch (2h vor/nach Event) statt fest 16-00h
- **[Feature OC-SEX] Garmin-HR Einstellungsfeld in Settings.tsx ergänzt**
  - Neues `TextField` für `sexGarminHRStateId` mit Placeholder `garmin.0.heartRate.heartRateValues`
  - Erscheint nur wenn `moduleSex === true`
  - Helpertext: "Leer lassen wenn kein Garmin vorhanden"

### 🎯 Nächster logischer Schritt
- SEX-Kachel nach Update v0.33.106 im Browser testen (Daten müssen jetzt laden)
- `sexGarminHRStateId` in den Adapter-Einstellungen eintragen (Tab "System" oder neuer Block)
- Ggf. Testdaten prüfen ob Intimacy-Events korrekt erkannt werden

---

## 🗓️ Sitzung 08.04.2026 — Version 0.33.104

### ✅ Abgeschlossen
- **[Fix OC-7] Multi-Person-Motion-Only: Wake- und Start-Fallback aus per-Person-Snapshot-Daten**
  - Root Cause: Für Haushalte ohne FP2 und ohne Garmin (z.B. Gondelsheim) berechnete `sleepWindowMotion` den Schlafstart anhand des *aktuellen Abends* (z.B. 18:57 heute) wenn der Snapshot am Abend neu berechnet wird — statt des letzten Abends. Folge: `sleepWindowOC7.start = 18:57` (heute), `sleepWindowOC7.end = null` (wake noch in der Zukunft). Das invertierte/fehlende Fenster führte zu: kein OBE-Dreieck, `bedWasEmpty: true`, `_sleepFrozen: false` → nächster Tag dasselbe Problem.
  - Fix A: Wenn `sleepWindowOC7.end === null` UND `_existingSnap.personData` hat Personen mit `wakeConfirmed: true` (Stunde < 14:00) → späteste per-Person-Wakezeit als `sleepWindowOC7.end` setzen.
  - Fix B: Wenn `sleepWindowOC7.start > sleepWindowOC7.end` (Fenster invertiert) → frühesten validen Schlafstart aus `allSleepStartSources` aller Personen ableiten (Quellen != `winstart`, Stunde 18-04, vor heute 04:00). Fallback: `_sleepSearchBase` (gestern 18:00).
  - Wirkung: OBE-Berechnung bekommt korrektes Fenster → Dreiecke erscheinen, `bedWasEmpty: false`, `sleepWindowStart/End` im Snapshot korrekt gespeichert → nächster Tag: `_sleepFrozen: true` (stabil).
  - Log: `[OC-7] Multi-Person-Wake-Fallback: sleepWindowEnd=07:26 (2 Person(en))`
  - Log: `[OC-7] Multi-Person-Start-Korrektur: sleepWindowStart=23:06 (aus per-Person-Quellen)`
  - Einfügestelle: nach `sleepWindowSource`-Zuweisung, vor `if (sleepWindowOC7.start && sleepWindowOC7.end)` OBE-Block

### 🔧 Offene Baustellen
- RAUM-NUTZUNG / HEATMAP / 30/7-TABELLE: kein helpText-Tooltip
- OBE bei `householdSize: couple/family` ohne FP2: nicht-Bad-Events → `other_person` (kein rotes Dreieck)
- `otherRoomWakeTs` (OC-19) für Multi-Person: Schlafzimmer-Bewegungen der anderen Person maskieren echte Abfahrten → Wake-Erkennung bleibt bei `wakeSource: motion` (kein gültiger `otherRoomWakeTs`)

### 🎯 Nächster logischer Schritt
- v0.33.104 in Gondelsheim einspielen, morgen früh prüfen: Balken + orange/rote Dreiecke erwartet

---

## 🗓️ Sitzung 08.04.2026 — Version 0.33.103

### ✅ Abgeschlossen
- **[Fix OC-7] FP2-Solo-Dropout-Filter: Falsche rote Dreiecke durch kurze FP2-Abwesenheiten verhindern**
  - Root Cause: FP2 (`isFP2Bed=true`, `alias.0.nuukanni.praesenz.eg-schlafen-true_false`) verliert bei ruhiger Schlafhaltung kurzzeitig die Radarerkennung → 3–6 Min Dropout → Algorithmus klassifizierte das als `outside` → rotes Dreieck unter Balken
  - Beobachtet in Nacht 8.4.2026: 2 unechte rote Dreiecke (07:01–07:04 und 07:38–07:45), nur FP2-Dropout, kein anderer Raum-Sensor aktiv
  - Fix: `_hasAnySensorOutside`-Check vor jeder `_fp2Events`-Kandidaten-Erzeugung. Wenn kein Bad-Sensor UND kein anderer Nicht-Bett-Sensor aktiv UND Dauer < `MIN_FP2_SOLO_MIN` (5 Min) → kein Marker
  - Log: `[OC-7] N FP2-Solo-Dropout(s) < 5min ignoriert (kein Aussensensor bestaetigt)`
  - Schwellwert 5 Min: kompatibel mit echten Badezimmer-Besuchen (≥4 Min typisch), filtert aber kurze Radar-Lücken im Schlaf zuverlässig
- **[Fix] Pre-Existing Syntax-Bug in src/main.js gefixt**
  - Zeile 2030 (`_pBedWasEmpty`): Stray-Token `}).length === 0)` aus alter Code-Version, verhinderte `build:backend:prod` seit v0.33.102
  - Der letzte Build war vermutlich mit `build:backend:dev` (unobfuskiert) erstellt worden → kein Produktiv-Build seit v0.33.102

### 🔧 Offene Baustellen
- RAUM-NUTZUNG / HEATMAP / 30/7-TABELLE: kein helpText-Tooltip
- OBE bei `householdSize: couple/family` ohne FP2: nicht-Bad-Events → `other_person` (kein rotes Dreieck)

### 🎯 Nächster logischer Schritt
- v0.33.103 einspielen, nächste Nacht prüfen: 2 statt 3 rote Dreiecke erwartet (nur das echte Bad+Wohnzimmer-Event gegen 06:11 bleibt)

---

## 🗓️ Sitzung 07.04.2026 — Version 0.33.102

### ✅ Abgeschlossen
- **[Fix] _sleepFrozen für Motion-only Setups (Gondelsheim-Typ)**
  - Bisher: `_sleepFrozen` nur wenn `sleepStages.length > 0` → niemals true für reine Motion-Sensor-Häuser
  - Fix: zusätzliche Bedingung `_sleepFrozenMotionOnly` → true wenn per-Person `wakeConfirmed === true`
  - Wirkung: Snapshot wird korrekt eingefroren → historisches `sleepWindowOC7` aus Snapshot wiederverwendet → OBE-Erkennung läuft mit korrektem Nacht-Fenster
- **[Fix] `_pBedWasEmpty` bei invertiertem Schlaffenster**
  - Bisher: `_pSleepStart` zeigt auf heutigen Abend, `_pWakeTs` auf diesen Morgen → Fenster invertiert → keine Bett-Events gefunden → `bedWasEmpty: true`
  - Fix: Fallback auf historisches Fenster (`winStart` → `_pWakeTs`) wenn `_pSleepStart > _pWakeTs`
  - Wirkung: Personen wie Ingrid/Robert in Gondelsheim zeigen korrekt "Schläft" statt "Bett war leer"
- **[Feature] outsideBedEvents für Motion-only Setups**
  - Durch den _sleepFrozen-Fix läuft die OBE-Erkennung (Phase 2: Bad-Sensor) jetzt auch für reine Motion-Sensor-Häuser
  - Bathroom-Events → orange ▼ (über Balken), andere Raum-Events → abhängig von householdSize-Konfig
- **[Analyse] Root-Cause-Diagnose Gondelsheim "Bett war leer"**
  - Kein Regressionsfehler von v0.33.100 — Bug existiert seit v0.33.96 (per-Person-Kacheln eingeführt)
  - Davor: nur globale Kachel, `bedWasEmpty: false` global (haus_still hat Timestamp)

### 🔧 Offene Baustellen
- RAUM-NUTZUNG / HEATMAP / 30/7-TABELLE: kein helpText-Tooltip
- OBE bei `householdSize: couple/family` ohne FP2: nicht-Bad-Events → `other_person` (kein roter Dreieck)

### 🎯 Nächster logischer Schritt
- Nach Update: Gondelsheim morgen früh prüfen ob Kacheln korrekt anzeigen

---

## 🗓️ Sitzung 07.04.2026 — Version 0.33.101

### ✅ Abgeschlossen
- **[Fix] outsideBedEvents Freeze-Fallback** (OBE-Freeze-Fix)
  - Wenn Adapter neu startet (in-Memory `sleepSearchEvents` gelöscht) und Snapshot eingefroren
  - → frische Berechnung liefert `[]`, gespeicherte Events aus `_existingSnap.outsideBedEvents` werden wiederverwendet
  - Dreiecke verschwinden nicht mehr nach Adapter-Neustart bei bereits erkannter Nacht
- **[Doku] HANDBUCH.md: AURA Sleep Score Erklärung komplett überarbeitet**
  - Nutzerverständliche Erklärung der 3 angezeigten Werte (großer Score / AURA-Rohwert / Garmin)
  - Tabelle: Badge-Status + Bedeutung
  - Warum weichen AURA und Garmin ab? → Erklärung
  - Technische Felder für Entwickler separat am Ende

### 🔧 Offene Baustellen
- RAUM-NUTZUNG Kachel: kein helpText-Tooltip vorhanden
- AKTIVITÄTS-HEATMAP: kein Tooltip vorhanden
- 30/7-TAGE-TABELLE: kein Tooltip vorhanden

### 🎯 Nächster logischer Schritt
- Produktivsetzung testen: Dreiecke nach Adapter-Neustart überprüfen (morgen früh)

---

## 🗓️ Sitzung 06.04.2026 — Version 0.33.100

### ✅ Abgeschlossen
- **[Fix] Dreiecks-Marker korrekt getrennt über/unter Balken**
  - Bad-Besuch (bathroom): orange ▼ ÜBER dem Balken — zeigt zum Balken runter
  - Außerhalb/andere Person: rot ▲ UNTER dem Balken — zeigt zum Balken hoch
  - `markerItems` in `{above, below}` aufgeteilt, je eigene Lane-Berechnung
  - Platzhalter-div verhindert vertikales Springen des Balkens wenn nur below-Marker vorhanden
  - Ursprünglicher Bug: beide Lanes (0 und 1) lagen im selben Container ÜBER dem Balken
- **[Fix] sleepScoreHistory retroaktiv aus History-Dateien befüllen**
  - `migrateScoresToV2()` liest jetzt alle History-JSONs und ergänzt fehlende Einträge in `sleepScoreHistory`
  - Deduplikation per Datum, max 60 Einträge rolling
  - Kalibrierung greift sofort beim nächsten Adapter-Start wenn ≥ 7 Garmin-Nächte in History vorhanden
  - Adapter-Log zeigt: `[ScoreMigration] sleepScoreHistory mit N historischen Einträgen ergänzt (M mit Garmin)`

### 🎯 Nächster logischer Schritt
- v0.33.100 einspielen, Adapter-Log prüfen: `sleepScoreHistory mit X Einträgen (Y mit Garmin)` → dann zeigt Score-Badge `⟳ kalibriert (Y/14N)` oder `✓ kalibriert (YN)`
- Dreiecks-Marker nach nächster Nacht mit Bad+Außerhalb-Event visuell prüfen

---

## 🗓️ Sitzung 06.04.2026 — Version 0.33.99

### ✅ Abgeschlossen
- **[Fix] Retroaktive V2-Score-Migration beim Adapter-Start**
  - `migrateScoresToV2()`: läuft einmalig beim Adapter-Start
  - Erkennt alte History-JSONs ohne `sleepScoreCalStatus`-Feld und berechnet V2-Score nach
  - Sofort nach Update sieht Langzeitchart realistisch aus (55–90) statt alle Balken auf 100%
  - Erkennungsmerkmal: Bereits migrierte Dateien haben `sleepScoreCalStatus`, werden übersprungen (idempotent)

### 🎯 Nächster logischer Schritt
- v0.33.99 einspielen und nach Adapter-Neustart Langzeitchart prüfen: Balken sollten variieren

---

## 🗓️ Sitzung 06.04.2026 — Version 0.33.98

### ✅ Abgeschlossen
- **[Feature OC-Score-V2] Neuer AURA Sleep Score — Dauer-basierte Formel (V2)**
  - Root Cause der immer-100-Anzeige: Proportions-basierte Formel (dp×200+rp×150+lp×80−wp×250) liefert mit Vibrationssensor immer >100, weil Tiefschlaf überklassifiziert und Wake fast nie erkannt wird
  - Neue Formel V2: `durScore = max(20, min(95, 25 + 0.12 × sleepDurMin))` — direkt kalibriert an AURA vs Garmin (r=0.886 über 15 Nächte)
  - Phasen-Adjustment (±8 Punkte): REM-Bonus (+30×rp×coverage), Wake-Penalty (−50×wp×coverage)
  - Tiefschlaf-Schwelle erhöht: von 2 auf 5 aufeinanderfolgende ruhige Slots (25 Min) → weniger Überklassifizierung
  - Ergebnis: Score-Bereich ~55–90 (Garmin-Ø 74,2 → AURA-Ø jetzt ähnlich)
- **[Feature OC-Score-V2] Garmin-Kalibrierung (sleepScoreCal)**
  - Neuer State `analysis.health.sleepScoreHistory`: rolling 60-Nächte-History (date, aura, garmin)
  - Kalibrierungslogik: ab 7 Nächten mit Garmin wird mittlerer Offset berechnet (`mean(garmin - aura)`)
  - `sleepScoreCal = auraScore + offset` — bei ≥14 Nächten: Status "calibrated", 7–13: "calibrating"
  - Separater State in daily history: `sleepScoreCal`, `sleepScoreCalNights`, `sleepScoreCalStatus`
- **[Feature OC-Score-V2] Frontend: Kalibrierter Score + UI-Hinweis**
  - Score-Badge zeigt jetzt `scoreCal` wenn vorhanden, sonst `score`
  - Statusbadge unterhalb Score: "✓ kalibriert (14N)" (grün), "⟳ kalibriert (7/14N)" (orange), "○ unkalibriert" (grau)
  - Wenn kalibrierter und unkalibrierter Score unterschiedlich: Anzeige "AURA: {score}" als kleiner Hinweis
  - Garmin-Delta jetzt relativ zu kalibriertem Score
  - **Deployment: v0.33.98** — Backend + Frontend geändert

### 🔧 Offene Baustellen
- Per-Person `outsideBedEvents` pro Person (zu aufwendig)
- Per-Person Nykturie-Attribution (nocturiaAttr kommt schon, aber nicht visuell gerendert)
- OC-28 Variante 2 (sehr spätes Einschlafen + Garmin-Sync nach Fenster-Ende): grauer Balken (eigenes Haus, v0.33.93 installiert)
- Nach ~14 Garmin-Nächten auf den kalibrierten Score prüfen und ggf. Offset-Koeffizient verfeinern

### 🎯 Nächster logischer Schritt
- Eigenes Haus: v0.33.98 einspielen, Score-Entwicklung über nächste 2 Wochen beobachten
- Gondelsheim: v0.33.98 einspielen (kein Garmin → bleibt "○ unkalibriert", aber Score realistischer)

---

## 🗓️ Sitzung 06.04.2026 — Version 0.33.97

### ✅ Abgeschlossen
- **[Fix OC-neu-A] Quellen-Buttons im Fallback-View (kein Vibrationssensor)**
  - Root Cause: "⚙ Quellen ▼" (Einschlafzeit) und "⚙ Quellen" (Aufwachzeit) wurden in v0.33.96 nur in den Voll-View eingebaut (hasVibSensor=true), nicht in den Fallback-View (hasVibSensor=false)
  - Per-Person-Kacheln ohne Vibrationssensor (Gondelsheim: Ingrid, Robert) landeten immer im Fallback-View → kein Tooltip sichtbar
  - Fix: Beide Quellen-Elemente identisch in den Fallback-View (Zeilen 1504–1524) eingefügt
  - Einschlafzeit: vollständiges Override-Panel inkl. "Wählen"-Buttons und "Override zurücksetzen"
  - Aufwachzeit: Hover-Tooltip mit allen Quellen (analog Voll-View)
  - **Deployment: v0.33.97** — nur Frontend-Änderung (kein build:backend nötig)

### 🔧 Offene Baustellen
- Per-Person `outsideBedEvents` pro Person (zu aufwendig für diese Session)
- Per-Person Nykturie-Attribution (nocturiaAttr kommt schon, aber nicht visuell gerendert)
- OC-28 Variante 2 (sehr spätes Einschlafen + Garmin-Sync nach Fenster-Ende): grauer Balken bleibt (betrifft Nacht 5./6.4.2026 eigenes Haus, v0.33.93 installiert)

### 🎯 Nächster logischer Schritt
- Gondelsheim: v0.33.97 einspielen, Quellen-Tooltip in Per-Person-Kacheln testen
- Eigenes Haus: Auf v0.33.95+ updaten (OC-28 Fix für grauen Balken)

---

## 🗓️ Sitzung 04.04.2026 (3) — Version 0.33.96

### ✅ Abgeschlossen

- **OC-neu-A: Per-Person Quellen-Tooltips** (`allSleepStartSources` + `allWakeSources` pro Person)
  - Backend: Jede der 4 Einschlafzeit-Methoden (Gap-60, Last-Outside, Haus-Still, Winstart-Fallback) speichert ihren Treffer-Timestamp in `_pSleepStartSrc`-Tracking-Variable
  - Neue Felder im `result[person]`: `sleepStartSource`, `allSleepStartSources`, `allWakeSources`
  - Frontend: `overrideData` für per-Person-Kacheln jetzt vollständig (alle Quellen-Arrays korrekt befüllt)
  - Neue srcInfo-Labels: `gap60` 🛏️, `last_outside` 🚶, `winstart` ⏱, `override` ✏️
  - Tooltip zeigt analog zur Hauptkachel alle Quellen mit Zeitstempeln und aktiver Quelle markiert

- **OC-neu-B: Per-Person wakeConfirmed + bedWasEmpty**
  - `wakeConfirmed` pro Person: nach 10:00 Uhr UND mindestens 1h nach Aufwachzeit
  - `bedWasEmpty` pro Person: keine Bett-Events für diese Person im Schlaffenster
  - Backend: beide Felder in `result[person]` gespeichert
  - Frontend: `overrideData` für per-Person-Kacheln übergibt beide Felder → UI zeigt Haken/Leer-Meldung automatisch

- **OC-neu-C: Per-Person Einschlafzeit-Override**
  - Neuer ioBroker-State `analysis.sleep.personStartOverrides` (JSON-Objekt `{PersonName: {...}}`)
  - Neue Message-Handler: `setPersonSleepStartOverride` + `clearPersonSleepStartOverride`
  - Backend: Override wird in `personData`-Block vor der `result[person]`-Zuweisung angewendet, `sleepStartOverridden: true` im result
  - Frontend: `handleSetOverride`/`handleClearOverride` in `renderSleepScoreCard` sind jetzt per-person-aware (wenn `personLabel` gesetzt: andere Commands, andere Loading-States)
  - Neue States: `personOverridePanelOpen: string|null`, `personOverrideLoading: boolean`
  - `isOverrideLoading`/`isOverridePanelOpen`/`setIsOverridePanelOpen` Abstraktionen für einheitliches JSX-Template

### 🔧 Offene Baustellen
- Per-Person `outsideBedEvents` pro Person (zu aufwendig für diese Session, in Hauptkachel bereits implementiert)
- Per-Person Nykturie-Attribution (nocturiaAttr kommt schon, aber nicht visuell gerendert)

### 🎯 Nächster logischer Schritt
- Per-Person Kacheln testen (Gondelsheim-Daten): Tooltips, Override-Panel, bedWasEmpty prüfen
- State `analysis.sleep.personStartOverrides` im ioBroker anlegen (wird automatisch beim Adapter-Start erstellt)

---

## 🗓️ Sitzung 04.04.2026 (2) — Version 0.33.95

### ✅ Abgeschlossen
- **[Fix A] Per-Person FROZEN — Aufwachzeit-Drift verhindert**
  - Root Cause: Per-Person-Algorithmus hatte keinen FROZEN-Mechanismus → Aufwachzeit wurde den ganzen Tag neu berechnet (Gondelsheim: 08:48 → 11:11 durch Tages-Bett-Events)
  - Fix: Wenn `_existingSnap.personData[person].sleepWindowEnd` existiert UND Stunde ≥ 5 UND >2h in der Vergangenheit → Aufwachzeit einfrieren, nicht neu berechnen
  - Log: `[Per-Person FROZEN] Ingrid: Aufwachzeit eingefroren auf 08:48`
  - **Deployment: v0.33.95** gepusht

- **[Fix B / OC-28] Stages FROZEN-Bug — Stages werden neu berechnet wenn Fenster noch läuft**
  - Root Cause: Garmin syncte früh (02:00) → FROZEN-Snapshot mit nur 2h FP2-Daten → grauer Balken für restliche 4-5h Nacht
  - Fix: `_stagesStillFresh = Date.now() < sleepWindowOC7.end + 30min` → wenn true: `_shouldRecalcStages = true` statt Snapshot übernehmen
  - Kombiniert mit bestehendem `_frozenStartShift > 5min`-Check
  - Log: `[OC-28] Stages neu berechnen: Fenster noch aktiv/gerade beendet`
  - **Deployment: v0.33.95** gepusht

### 🔧 Offene Baustellen
- **Per-Person Tooltips fehlen (OC-neu-A):** `allSleepStartSources`/`allWakeSources` pro Person im Backend nicht gespeichert → kein Quellen-Tooltip in Per-Person-Kachel
- **Per-Person wakeConfirmed fehlt (OC-neu-B):** Kein Bestätigungshaken bei Aufwachzeit, kein `outsideBedEvents`, kein `bedWasEmpty` pro Person
- **Per-Person Override fehlt (OC-neu-C):** Manuelle Korrektur der Einschlafzeit nur für Hauptkachel, nicht für Per-Person
- Gondelsheim Robert: kein Vibrations-/FP2-Sensor → sleepScore leer → OC-27
- haus_still: Hop-Filter fehlt → OC-24
- Kalender-gesteuerte Haushaltsgröße → OC-25

### 🎯 Nächster logischer Schritt
- v0.33.95 in ioBroker einspielen (Gondelsheim + eigenes Haus)
- Gondelsheim: Nächste Nacht prüfen: Bleibt Ingrids Aufwachzeit stabil (kein Drift mehr)?
- Log prüfen: erscheint `[Per-Person FROZEN]` und `[OC-28] Stages neu berechnen`?

---

## 🗓️ Sitzung 04.04.2026 — Version 0.33.94

### ✅ Abgeschlossen
- **[OC-neu] bedWasEmpty-Erkennung: Bett leer / Person auswärts**
  - Analyse der Nacht 4.4.2026 (Marc auswärts): eventHistory=0, nightVibrationCount=0, alle lokalen Quellen null → klares Signal
  - Vergleich mit Heimnacht 3.4.2026: 1317 Events, 24 Vibrationen, FP2+haus_still valide
  - Kriterien (alle müssen erfüllt sein): nightVibrationCount===0 + FP2-Events im Schlaffenster===0 + fp2/fp2_vib/haus_still/motion_vib alle null
  - Wenn bedWasEmpty: sleepScore=null, sleepScoreRaw=null, sleepStages=[] (verhindert falschen Score-100 + FROZEN-deep)
  - Frontend: statt Score-Kachel "🏠 Bett war leer" mit Garmin-Referenz (Zeiten + Garmin-Score als Information)
  - **Deployment: v0.33.94** gepusht

### 🔧 Offene Baustellen
- Stages FROZEN-Bug: Schlafphasen werden nach ~2h eingefroren wenn Garmin-Sync früh → grauer Balken für Rest der Nacht → OC-28
- Gondelsheim Robert: kein Vibrations-/FP2-Sensor → sleepScore leer → OC-27 (Vibrationssensor geplant)
- haus_still: Hop-Filter fehlt → OC-24
- Kalender-gesteuerte Haushaltsgröße → OC-25

### 🎯 Nächster logischer Schritt
- v0.33.94 in ioBroker einspielen (eigenes Haus)
- Prüfen: Zeigt die Schlafanalyse-Kachel für Nacht 4.4.2026 "🏠 Bett war leer" statt Score 100?
- FROZEN-Bug (OC-28) angehen: separate Session

---

## 🗓️ Sitzung 03.04.2026 — Version 0.33.93

### ✅ Abgeschlossen
- **[OC-27 teilweise] Per-Person-Einschlafzeit bei PIR-only/Radar-Haushalten robustifiziert**
  - Root Cause: Gap-Algorithmus (15 Min) fand zufällige Radar-Pausen (SNZB-06P feuert auch für Schlafende) → Ingrid 01:23, Robert 01:30 statt echter Bettgehzeit ~22:00
  - Fix 1: Gap-Schwelle 15 → 60 Min (kurze Radar-Pausen zählen nicht mehr als Einschlafzeit)
  - Fix 2: Gap-Stundenfenster 18h → 21h (frühe Abend-SZ-Besuche werden nicht als Schlafzeit erkannt)
  - Fix 3: Neue **Last-Outside-Methode** (Prio 2): letztes personTagged Nicht-SZ-Event im Abend-Fenster ohne nachfolgende Außenbewegung in 30 Min → erstes SZ-Event danach = Einschlafzeit
  - Prioritätenkette: Gap-60 → Last-Outside → per-Person-haus_still → winStart
  - Simulation Gondelsheim Apr 2/3: Ingrid **22:56** (vorher 01:23), Robert **22:25** (vorher 01:30)
  - FP2/Vibration/alle anderen Algorithmen unberührt
  - **Deployment: v0.33.93** gepusht

### 🔧 Offene Baustellen
- Stages FROZEN-Bug: Schlafphasen werden nach ~2h eingefroren wenn Garmin-Sync früh → grauer Balken für Rest der Nacht → OC-28
- Gondelsheim Robert: kein Vibrations-/FP2-Sensor → sleepScore leer → OC-27 (Vibrationssensor geplant)
- haus_still: Hop-Filter fehlt → OC-24
- Kalender-gesteuerte Haushaltsgröße → OC-25

### 🎯 Nächster logischer Schritt
- v0.33.93 in ioBroker einspielen (Gondelsheim)
- Nächste Nacht prüfen: Zeigt Ingrid-Kachel jetzt ~22:30-23:00, Robert ~22:00-22:30?
- Aufwachzeit-Robustheit prüfen (selbes Problem mit Radar-Sensor möglich)

---

## 🗓️ Sitzung 02.04.2026 — Version 0.33.92

### ✅ Abgeschlossen
- **[OC-7] Rotes Dreieck fehlte wenn FP2+Bad+AndererRaum gleichzeitig auslösen**
  - Root Cause (01./02.04.2026): FP2-leer, Bad, Diele, Wohnen, Küche feuerten alle um 06:01. Phase-1-FP2-Pfad erzeugte nur `bathroom`. Phase-2-Motion-Cluster hatte `hasOther=true`, wurde aber in Phase 3 wegen Überlappung mit FP2-Event verworfen → kein rotes Dreieck.
  - Fix 1 (Phase 2): `_isOther = !_isBath` — Küche nicht mehr explizit ausgeschlossen. `isKitchenSensor` bleibt für alle anderen Algorithmen (kitchenVisits, Gesundheitsindikatoren) unverändert.
  - Fix 2 (Phase 1): Neuer `_hasOtherInFp2`-Check im FP2-Pfad. Wenn Bad + andere Räume im Zeitfenster → zweiter `outside`-Marker zusätzlich zum `bathroom`-Marker. Topologie-Hop-Filter wird beachtet. Symmetrisch zum v0.33.88-Fix für Phase-2-Cluster.
  - **Deployment: v0.33.92** gepusht

### 🔧 Offene Baustellen
- Stages FROZEN-Bug: Schlafphasen werden nach ~2h eingefroren wenn Garmin-Sync früh → grauer Balken für Rest der Nacht → OC-28
- Gondelsheim Robert: kein Vibrations-/FP2-Sensor → sleepScore leer → OC-27
- haus_still: Hop-Filter fehlt → OC-24
- Kalender-gesteuerte Haushaltsgröße → OC-25

### 🎯 Nächster logischer Schritt
- v0.33.92 in ioBroker einspielen
- Nächste Nacht: erscheint jetzt BEIDE Dreiecke (orange Bad + rot Außerhalb) auch wenn FP2+Bad+Diele gleichzeitig auslösen?

---

## 🗓️ Sitzung 01.04.2026 — Version 0.33.91

### ✅ Abgeschlossen
- **[OC-18] Einschlafzeit PIR-only: Gondelsheim zeigt 01:58 statt echte Bettgehzeit**
  - Root Cause: `_pBedEvts` startete erst bei `winStart` (01:58) → Abend-Events (z.B. Ingrid 23:05, Robert 21:12) wurden nie berücksichtigt
  - Zweites Problem: `_pNextTs` wurde aus `_pEve` berechnet → letztes hr<2-Event (01:58) hatte kein nächstes `_pEve`-Event → Infinity-Gap → immer `winStart` als Ergebnis
  - Fix 1: `_pSearchFrom = 18:00 Vortag` → `_pBedEvts` enthält jetzt Abend-Events
  - Fix 2: `_pNextTs` aus allen `_pBedEvts` (nicht nur `_pEve`) → 23:41→00:20 = 39min-Gap korrekt erkannt
  - Ergebnis: Ingrid ~23:41 Uhr, Robert ~22:42 Uhr (statt 01:58)
- **[Frontend] Per-Person-Kacheln: 3 UI-Bugs gefixt**
  - "⚙ Quellen ▼" Button ausgeblendet wenn `allSleepStartSources` leer (kein nutzloser Klick mehr)
  - `sleepStartSource = 'motion'` statt `pd.wakeSource` → Einschlafzeit-Quelle zeigt "Bewegungsmelder" statt "Anderer Raum"
  - Meldung "Schlafphasen nicht verfügbar" für per-Person → "nur Einschlaf-/Aufwachzeit analysiert" (kein Vibrationssensor-Hinweis mehr)
- **Deployment: v0.33.91** gepusht

### 🔧 Offene Baustellen
- Gondelsheim Robert: Kein Vibrations-/FP2-Sensor → sleepScore immer leer → OC-27 (falls Sensor geplant)
- Eigenes Haus: Kein rotes Dreieck obwohl Küche besucht → separates Issue (nächste Session)
- haus_still: Hop-Filter fehlt noch → OC-24
- Kalender-gesteuerte Haushaltsgröße → OC-25
- Sensor-Onboarding-Checkliste → OC-26

### 🎯 Nächster logischer Schritt
- v0.33.91 in ioBroker einspielen (Gondelsheim UND eigenes Haus)
- Gondelsheim: Nächste Nacht prüfen: Zeigt Ingrid-Kachel jetzt ~23:00, Robert ~21-22 Uhr?

---

## 🗓️ Sitzung 30.03.2026 (2) — Version 0.33.90

### ✅ Abgeschlossen
- **[Per-Person sleepWindowStart=null] Kachel Gondelsheim: "Heute Nacht werden die ersten Daten gesammelt" obwohl Adapter läuft**
  - Root Cause: `_pEve`-Filter im Per-Person-Block (`hr >= 18 || hr < 2`) schneidet bei 01:59 ab.
    Wenn `winStart` selbst schon 01:58 ist (haus_still spät) und Person erst ab 02:08 Bett-Events hat
    (weil sie VOR winStart eingeschlafen war), bleiben beide Suchpfade (`_pEve`-Schleife + haus_still-Fallback) leer.
    Ergebnis: `_pSleepStart = null` → `personData.Ingrid.sleepWindowStart = null` → Kachel zeigt "Erste Daten".
  - Bewiesen durch: JSON-Analyse (Ingrid 127 Events ab 02:08, winStart 01:58 — beide nur um Minuten verpasst)
    Robert funktioniert weil sein erstes Event bei 01:57 (hr=1 → noch im Filter).
  - **Fix:** Fallback nach beiden Erkennungsversuchen: `if (!_pSleepStart && _pBedEvts.length > 0) { _pSleepStart = winStart; }`
    → Person hatte Bett-Events aber keinen Einschlafzeitpunkt = war vor winStart eingeschlafen → winStart als beste Schätzung.
  - **Deployment: v0.33.90** gepusht

### 🔧 Offene Baustellen
- Gondelsheim Robert: Kein Vibrations-/FP2-Sensor → sleepScore immer leer, Meldung "Vibrationsdaten zu alt" irreführend → OC-27 für spätere Session
- haus_still: Hop-Filter fehlt noch → OC-24 für spätere Session
- Kalender-gesteuerte Haushaltsgröße → OC-25
- Sensor-Onboarding-Checkliste → OC-26

### 🎯 Nächster logischer Schritt
- v0.33.90 in ioBroker einspielen (Gondelsheim UND eigenes Haus)
- Gondelsheim: Nächste Nacht prüfen ob Ingrid-Kachel jetzt Schlaf-/Aufwachzeit zeigt

---

## 🗓️ Sitzung 30.03.2026 — Version 0.33.89

### ✅ Abgeschlossen
- **[outsideBedEvents FROZEN-Bug] Rotes Dreieck fehlte trotz v0.33.88**
  - Root Cause: Im FROZEN-Pfad (`_sleepFrozen && _existingSnap`) wurde `outsideBedEvents` aus dem alten Snapshot kopiert wenn `.length > 0` — ohne die volle Phase-1/2/3-Analyse erneut auszuführen
  - Der erste FROZEN-Snapshot enthielt nur den Bad-Sensor (isBathroomSensor=true) → `hasBath=true`, `hasOther=false`
  - Jeder nachfolgende `saveDailyHistory`-Lauf sah `_frozenEvts.length = 1` → `outsideBedEvents = _frozenEvts` → kein Diele/Wohnzimmer-Event je erreicht
  - Der `hasBath && hasOther → zwei Dreiecke`-Fix aus v0.33.88 war korrekt implementiert, aber hinter `else if` und wurde durch den FROZEN-Bypass nie erreicht
  - **Fix:** Kompletten FROZEN-Sonderblock für outsideBedEvents entfernt (31 Zeilen). `if (sleepWindowOC7.start && sleepWindowOC7.end)` läuft jetzt immer — volle Phase 1/2/3 unabhängig von FROZEN
  - Bewiesen durch: JSON-Analyse (eventHistory enthielt Diele+Wohnen, outsideBedEvents nur bathroom), Code-Inspektion src/main.js Zeilen 1201–1232
- **Deployment: v0.33.89** gepusht

### 🔧 Offene Baustellen
- haus_still: Hop-Filter fehlt noch → OC-24 für spätere Session
- Kalender-gesteuerte Haushaltsgröße → OC-25
- Sensor-Onboarding-Checkliste → OC-26

### 🎯 Nächster logischer Schritt
- v0.33.89 in ioBroker einspielen
- Nächste Nacht beobachten: erscheinen jetzt BEIDE Dreiecke (orange Bad + rot Diele/Wohnzimmer)?

---

## 🗓️ Sitzung 29.03.2026 (2) — Version 0.33.88

### ✅ Abgeschlossen
- **[FROZEN-Fix] Garmin-Wake vor Stage-Berechnung lesen (Reihenfolge-Bug)**
  - Garmin-Wake-Zeitstempel wurde bisher erst NACH Stage-Calc auf `sleepWindowOC7.end` gesetzt
  - Stages berechneten sich mit falschem Fenster-Ende (FP2-Ende oder Date.now statt Garmin)
  - Fix: Garmin-State vorab lesen, bevorzuge Garmin wenn früher als FP2-Ende
- **[FROZEN-Fix] Stage-Neuberechnung wenn Garmin Einschlafzeit >5 Min verschiebt**
  - Im FROZEN-Pfad: wenn Garmin Start stark verschiebt, Stages neu berechnen statt alten Snapshot zu verwenden
  - `_shouldRecalcStages`-Flag steuert ob Stages aus Snapshot oder neu berechnet
- **[haus_still] Einzelsensor-Robustheit: ≥2 verschiedene Sensor-IDs für "Haus aktiv"**
  - Vorher: ein einzelner Sensor (z.B. OG Flur mit langer PIR-Nachlaufzeit) blockierte haus_still komplett
  - Jetzt: `_hasCommonAfter` erfordert ≥2 verschiedene IDs → Rausch-Sensor allein reicht nicht
- **[Dreieck] hasBath && hasOther → orange + rotes Dreieck**
  - Vorher: `hasBath` dominierte, `hasOther` wurde ignoriert → nur ein oranges Dreieck
  - Jetzt: Cluster mit Bad UND anderen Außenräumen erzeugt beide Marker
- **[Label] 'Schätzung' → 'Fallback 20:00 Uhr'** (Frontend HealthTab.tsx)
- **Deployment: v0.33.88** gepusht

### 🔧 Offene Baustellen
- haus_still: Hop-Filter fehlt noch (nur 2-Sensor-Robustheit jetzt drin) → OC-24 für spätere Session
- Kalender-gesteuerte Haushaltsgröße → OC-25 (Brainstorming)
- Sensor-Onboarding-Checkliste → OC-26 (Brainstorming)

### 🎯 Nächster logischer Schritt
- Update auf ioBroker einspielen und nächste Nacht beobachten:
  - Erscheint haus_still jetzt mit einem Wert?
  - Zeigt Dreieck-Marker bei Bad+Wohnzimmer jetzt beide Farben?
  - Stimmen Stages nach Garmin-Sync besser?

---

## 🗓️ Sitzung 29.03.2026 — Analyse-Session (kein Deployment, nur Diagnose)

### ✅ Abgeschlossen
- Tiefdiagnose der Nacht 28./29.03.2026 mit Quellcode-Inspektion (`src/main.js`)
- Alle 4 offenen Bugs (FROZEN, DST, haus_still, Dreieck) fundiert per Code-Analyse dokumentiert
- AUFFAELLIGKEITEN.md Einträge 10+11 mit konkreten Zeilennummern und Root Causes aktualisiert

### 🔧 Offene Baustellen — nächste Coding-Session (Prio-Reihenfolge)
1. **[HOCH] FROZEN-Bug:** Stage-Neuberechnung wenn Garmin FROZEN nachträglich updatet (src/main.js FROZEN-Update-Pfad)
2. **[HOCH] haus_still-Bug:** OG Flur Sensor blockiert Algorithmus — Einzelsensor-Robustheit einbauen (Zeilen 871–895)
3. **[MITTEL] Dreieck-Bug:** `hasBath && hasOther` → zwei Events erzeugen statt eines (Zeilen 1304–1316)
4. **[MITTEL] DST-Bug:** Slot-Count aus UTC statt lokaler Zeit (Slot-Berechnung OC-7)
5. **[NIEDRIG] Label "Schätzung":** Umbenennen in "Fallback 20:00" o. ä.

### 🎯 Nächster logischer Schritt
- FROZEN-Bug und haus_still-Bug als erstes coden (höchste Nutzerwirkung)

### 📌 META-REGEL (gelernt 29.03.2026)
**KI MUSS immer in src/main.js schauen, auch wenn der Nutzer sagt "noch keinen Code ändern".**
Schauen ≠ Ändern. Quellcode-Inspektion ist notwendig für korrekte Diagnose.
Gilt auch im Ask-Modus oder bei "nur diskutieren"-Anweisungen.

---

---

## 🗓️ Sitzung 28.03.2026 (4) — Version 0.33.87

### ✅ Abgeschlossen
- **Fix Backend: Override springt sofort zu Garmin zurück**
  - Ursache: `setStateAsync` + `getStateAsync` in `saveDailyHistory` unterliegt ioBroker-State-Cache-Timing. Der Override-State wurde gesetzt, aber beim Lesen kurz darauf noch als `null` geliefert → `_overrideApplied = false` → Garmin gewinnt
  - Fix: `saveDailyHistory(_directOverride)` bekommt optionalen Parameter. Der `setSleepStartOverride`-Handler übergibt den Payload direkt statt den State zu lesen
- **Fix Frontend: Schlafbalken endet bei ~02:03 Uhr (abgeschnitten)**
  - Ursache: `sleepStages` deckt nur die ersten ~2.5h ab (Vibrationssensor), aber `totalWindowMs` = 7h42min. Die verbleibenden ~5h zeigten leeren Bereich
  - Fix: Neues `postStageMs`-Segment nach den Stages: grau-schraffierter „Kein-Daten"-Bereich von letztem Stage-Slot-Ende bis `swEnd`

### 🔧 Offene Baustellen
- Schlafphasen-Summe (1h35 + 1h15 + 5min + 5min ≈ 3h) passt nicht zu 7h42min Gesamtschlaf — das ist inhärent, weil der Vibrationssensor nur den Anfang der Nacht analysiert. Garmin-Referenz zeigt korrekte Gesamtzeiten.

### 🎯 Nächster logischer Schritt
- Update auf ioBroker einspielen, Override-Funktion testen

---

## 🗓️ Sitzung 28.03.2026 (3) — Version 0.33.86 — Hotfix Frontend Crash

### ✅ Abgeschlossen
- **Hotfix: ReferenceError `preStageMs is not defined`** — Gesundheits-Tab zeigte weißen Bildschirm
  - `stagesWindowStart`, `preStageMs` und `totalWindowMs` wurden im JSX-Bar-Rendering von `renderSleepScoreCard` referenziert, aber nie definiert
  - `renderedStages`-Filter nutzte noch `swStart` statt `stagesWindowStart` als Slot-Basiszeit
  - Alle drei Variablen korrekt im `renderSleepScoreCard`-Scope nach `swStart`/`swEnd` ergänzt
  - `renderedStages` filtert jetzt korrekt mit `stagesWindowStart` als Referenz

### 🔧 Offene Baustellen
- Keine bekannten Fehler

### 🎯 Nächster logischer Schritt
- Schlafanalyse-Qualität im Alltag beobachten (neue Nacht mit allen Fixes)

---

---

## 📅️ Sitzung 28.03.2026 — Version 0.33.84+0.33.85 (Fix A-C + Folgefixes)

### ✅ Abgeschlossen
- **Fix A: FP2 Gap-Toleranz (Re-Anchoring-Bug behoben)**
  - FP2 re-ankerte nach WC-Besuch. Gap-Fusion (30min Toleranz) behebt das.
- **Fix B: Garmin Plausibilitaet bidirektional + Datum-Check**
  - |Garmin - fp2| <= 3h, Datum-Konsistenz gegen abgelaufene Garmin-Daten.
- **Fix C: OC-23 Override bypasses FROZEN**
  - Override-Start wird nicht mehr durch FROZEN-Block zurueckgesetzt.
- **Fix 1 (v0.33.85): Garmin in FROZEN-Auto-Pfad**
  - "Automatik wiederherstellen" zeigt jetzt Garmin-Zeit korrekt.
  - Root cause: FROZEN-Block ueberschrieb Garmin auch ohne Override.
- **Fix 2 (v0.33.85): stagesWindowStart im Snapshot**
  - Neues Feld fuer echten Stage-Analyse-Fenster-Start (unabhaengig von Override).
- **Fix 3 (v0.33.85): Frontend Bar proportional + Kein-Daten-Segment**
  - Stage-Slots relativ zu stagesWindowStart positioniert (nicht swStart).
  - Gestreiftes Grau wenn Override-Start vor Stage-Fenster liegt.
  - Proportionale Slot-Breiten statt flex:1.

### 🔧 Offene Baustellen
- **Ingrid/Robert:** Per-Person-Kacheln pruefen — AUFFAELLIGKEITEN.md
- **OC-21:** personTag-Filter fuer _motOutEvts — nach Praxistest
- **OC-22:** Rolling-Durchschnitt nach stabilen haus_still-Naechten
- OC-7: Schlafphasen-Chart + Sleep-Score-Roadmap

### 🎯 Naechster logischer Schritt
- Adapter v0.33.85 in ioBroker einspielen und naechste Nacht beobachten
- Pruefen: Automatik wiederherstellen -> zeigt Garmin-Zeit?
- Pruefen: Balken-Kein-Daten-Segment erscheint korrekt bei frueherer Override-Zeit?


## 🗓️ Sitzung 27.03.2026 — Version 0.33.82 (OC-23: Manueller Override Einschlafzeit-Quelle)

### ✅ Abgeschlossen
- **OC-23: Manueller Override der Einschlafzeit-Quelle (Variante B — Backend-Trigger)**
  - **State:** `analysis.sleep.startOverride` (JSON, date-spezifisch, verfällt automatisch nach einer Nacht)
  - **Backend (`src/main.js`):**
    - Override-Prüfung VOR der Prioritätskette in `saveDailyHistory()` (Guardrails: Zeitfenster 18:00–04:00, Source-Whitelist, Datums-Abgleich)
    - `sleepDate` (YYYY-MM-DD des Schlafs), `sleepStartOverridden`, `sleepStartOverrideSource` im Snapshot
    - `onMessage`-Handler `setSleepStartOverride`: validiert, speichert State, triggert Neuberechnung, gibt neuen Snapshot zurück
    - `onMessage`-Handler `clearSleepStartOverride`: löscht Override, triggert Neuberechnung
  - **Frontend (`HealthTab.tsx`):**
    - `sleepStartOverridden`, `sleepDateStr` aus Snapshot extrahiert
    - `overridePanelOpen` + `overrideLoading` States auf Komponent-Ebene
    - `handleSetOverride` / `handleClearOverride` Funktionen (via `sendTo`)
    - `⚙ Quellen ▼` Toggle-Button (war: reiner Hover-Tooltip) → öffnet interaktives Panel
    - Panel: alle `allSleepStartSources` mit Zeit, aktive Quelle grün hervorgehoben, `[Wählen]`-Button pro Quelle
    - Badge `✏️ manuell` wenn Override aktiv
    - `[↺ Automatik wiederherstellen]` Button wenn Override aktiv

### 🔧 Offene Baustellen
- **Ingrid/Robert:** Per-Person-Kacheln prüfen (Wiedervorlage 28.03) — AUFFAELLIGKEITEN.md
- **OC-21:** personTag-Filter für `_motOutEvts` — nach Praxistest
- **OC-22:** Rolling-Durchschnitt nach stabilen haus_still-Nächten
- OC-7: Schlafphasen-Chart + Sleep-Score-Roadmap

### 🎯 Nächster logischer Schritt
- Adapter bei Kunden aktualisieren → `⚙ Quellen ▼` in Schlafkachel testen
- Morgen früh Ingrid/Robert `system.personData` prüfen (AUFFAELLIGKEITEN.md)
- OC-21 oder OC-22 als nächstes Feature

---

## 🗓️ Sitzung 27.03.2026 — Version 0.33.81 (Dokumentation synchronisiert: TESTING/HANDBUCH/BRAINSTORMING)

### ✅ Abgeschlossen
- **`_internal/TESTING.md` aktualisiert**
  - Neue Testfaelle fuer v0.33.80/v0.33.81 ergänzt:
    - `T-E8`: `motion_vib` (PIR + Vibration ohne FP2)
    - `T-E9`: `haus_still`-Label im Quellen-Tooltip (kein `?`)
    - `T-K18`: Frontend-Label `Bewegungsmelder + Vibration`
    - `T-K19`: Per-Person-Kacheln nach `analysis.trigger` (winStart-Fix)
- **`_internal/HANDBUCH.md` aktualisiert**
  - Einschlafzeit-Quellen-Tabelle erweitert um:
    - `🚶 Bewegungsmelder + Vibration` (`motion_vib`, ab v0.33.80)
    - `🏠 Haus-wird-still` (ab v0.33.79)
  - Graceful-Degradation-Tabelle angepasst (PIR+Vibration jetzt verfeinerte Einschlafzeit statt nur letzte Bewegung)
  - Sensor-Indikator-Symbole ergänzt (`motion_vib`, `haus_still`)
  - Kopfzeile aktualisiert: **27.03.2026 | Version 0.33.81**
- **`_internal/BRAINSTORMING.md` aktualisiert**
  - Neuer Eintrag **OC-23** angelegt: Manueller Override der Einschlafzeit-Quelle
  - Varianten A/B dokumentiert, Empfehlung klar auf Variante B (Backend-Trigger) gesetzt
  - Guardrails + Datenmodell-Idee ergänzt

### 🔧 Offene Baustellen
- **OC-23**: Implementierung manuell ueberschriebener Einschlafquelle (Variante B)
- **OC-21**: personTag-Filter fuer `_motOutEvts`
- **OC-22**: Rolling-Durchschnitt nach stabilen haus_still-Nächten
- OC-7 Schlafphasen-Chart + Sleep-Score-Roadmap

### 🎯 Nächster logischer Schritt
- OC-23 technisch in Backend+Frontend umsetzen (State-Modell, Trigger, Recompute-Pfad)
- Danach TESTING um konkrete OC-23 Testfaelle erweitern

---

## 🗓️ Sitzung 27.03.2026 — Version 0.33.81 (OC-18: winStart-Bug in Per-Person-Schlafanalyse)

### ✅ Abgeschlossen
- **Kritischer Bug: `winStart` im Per-Person-Block zeigte auf `22:00 heute` (Zukunft)** (`src/main.js`)
  - Root Cause: `sleepWindowCalc.start` war `null` (kein FP2) → Fallback `22:00 heute` → bei Morgen-Ausführung (z.B. 10:00 Uhr) = 22:00 March 27 (12h in der Zukunft)
  - Alle Schlaf-Events von gestern Nacht lagen zeitlich VOR diesem Wert → `_pBedEvts` leer → `sleepWindowStart/End = null` → keine per-Person-Kacheln
  - Auch `nightActivityCount: 0` wegen gleicher Ursache (todayEvents gefiltert auf >= winStart)
  - **Fix:** `var winStart = sleepWindowCalc.start || sleepWindowOC7.start || _sleepSearchBase.getTime();`
  - `sleepWindowOC7.start` enthält bereits den richtigen Wert (PIR/motion/haus_still gestern), `_sleepSearchBase` = gestern 18:00 als letzter Fallback
  - Sichtbar sofort nach Adapter-Update + „System prüfen" (kein Warten bis nächste Nacht)
- **Diagnose via `system.personData`:** Ingrid + Robert beide `nightActivityCount:0, sleepWindowStart:null, sleepWindowEnd:null` → eindeutig Zeitfenster-Problem, kein personTag/Filter-Problem

### 🔧 Offene Baustellen
- **OC-23: Manueller Override der Einschlafzeit-Quelle** — Variante B (Backend-Trigger) geplant
- **OC-21: personTag-Filter für `_motOutEvts`** — nach Praxistest
- **OC-22: Rolling-Durchschnitt** — nach 3+ stabilen Nächten mit haus_still
- OC-7: Schlafphasen-Chart (Tief/Leicht/REM) + Sleep-Score — Roadmap

### 🎯 Nächster logischer Schritt
- Adapter bei Ingrid/Robert aktualisieren → „System prüfen" → `system.personData` prüfen: jetzt sollten `sleepWindowStart` und `sleepWindowEnd` nicht-null sein
- Dann prüfen ob 2 separate Schlafkacheln erscheinen
- OC-23 (manueller Override) als nächstes Feature angehen

---

## 🗓️ Sitzung 27.03.2026 — Version 0.33.80 (OC-7: haus_still-Label + motion_vib-Quelle)

### ✅ Abgeschlossen
- **Fix: `haus_still`-Label im Quellen-Popup** (`HealthTab.tsx`, srcInfo)
  - `haus_still` war nicht in `srcInfo` eingetragen → zeigte `? haus_still` im Tooltip
  - Neu: `haus_still: { icon: '🏠', label: 'Haus-wird-still' }`
- **Neu: `motion_vib` als Einschlafzeit-Quelle** (`src/main.js` + `HealthTab.tsx`)
  - Schließt Lücke für Kunden mit PIR + Vibrationssensor aber OHNE FP2
  - Bisher: Vibrationsdaten wurden bei fehlendem FP2 für Einschlafzeit-Verfeinerung vollständig ignoriert
  - Jetzt: Wenn `_fp2RawStart === null` UND `sleepWindowMotion.start` vorhanden → Vibrations-Verfeinerung auf Basis des Bewegungsmelder-Ankers (`motionVibSleepStartTs`)
  - Gleicher Algorithmus wie `fp2_vib` (letztes Vib-Event + ≥20 Min Stille danach, max. 3h-Fenster)
  - Eingebaut in Prioritätskette: `garmin > fp2_vib > fp2 > haus_still > motion_vib > motion > fixed`
  - `sleepWindowMotion.start` wird im Prioritätszweig auf `motionVibSleepStartTs` verfeinert
  - Frontend-Label: `🚶 Bewegungsmelder + Vibration`
- **Brainstorming-Session:** 4 Themen diskutiert (manueller Override, Szenario PIR+Vib, haus_still-Label, Dreieck-Logik)
  - Manueller Override für Einschlafzeit-Quelle (z.B. Garmin → FP2) als **OC-23** in BRAINSTORMING festgehalten (Variante B empfohlen: Backend-Trigger)
  - Dreieck vor Schlafbeginn: kein Bug, korrektes Verhalten (kein Fix nötig)

### 🔧 Offene Baustellen
- **OC-23: Manueller Override der Einschlafzeit-Quelle** — Variante B (Backend-Trigger) geplant
- **OC-21: personTag-Filter für `_motOutEvts`** — nach Praxistest v0.33.79
- **OC-22: Rolling-Durchschnitt** — nach 3+ stabilen Nächten mit haus_still
- **Ingrid/Robert: Per-Person-Kacheln leer** — vermutlich `_pBedRet`-Filter zu aggressiv durch v0.33.79 Sustained-Filter; `system.personData` in ioBroker prüfen ob `sleepWindowEnd: null`
- OC-7: Schlafphasen-Chart (Tief/Leicht/REM) + Sleep-Score — Roadmap

### 🎯 Nächster logischer Schritt
- Ingrid/Robert-Problem: im ioBroker-Log `system.personData` prüfen — Erwartung: `sleepWindowEnd: null` für eine oder beide Personen
- Wenn bestätigt: Sustained-Bedroom-Return-Filter (v0.33.79) für PIR-only-Mehrpersonenhaushalte anpassen
- Danach OC-23 (manueller Override) angehen

---

## 🗓️ Sitzung 26.03.2026 — Version 0.33.79 (OC-7: PIR-only Schlafanalyse-Robustheit)

### ✅ Abgeschlossen

**Kontext:** Ingrid & Robert (Eltern-Haushalt) mit PIR-only, mehrere Personen, keine FP2/Vibration.  
Root Cause: Ein 96-sekündiger Schlafzimmer-Kurzbesuch (Ingrid um 14:42) hat via OC-19 die Aufwachzeit auf 14:49 verschoben.

- **Fix 1: Sustained-Bedroom-Return-Filter** (`src/main.js` ~Zeile 1284)
  - `_rtbBedEvts` (Rückkehr-ins-Bett-Events für OC-19) filtert jetzt kurze isolierte SZ-Einträge nach 10:00 Uhr heraus
  - PIR-Event gilt als "Rückkehr ins Bett" nur wenn Nachbar-SZ-Event innerhalb 15 Min vorhanden
  - Vor 10:00 Uhr: immer valide (Nachtaktivität unverändert)
  - FP2-Sensoren: immer valide (FP2 = inhärent sustained)
  - Gleiches Muster für per-Person `_pBedRet` in `personData`

- **Fix 2: Hard Cap 12:00 Uhr auf `otherRoomWakeTs`** (`src/main.js` ~Zeile 1262)
  - `_wakeHardCapMs` = heute 12:00 Uhr
  - Sowohl `_otherRoomEvts` als auch `_rtbBedEvts` werden auf `<= 12:00` begrenzt
  - Verhindert dass nachmittägliche Sensorbewegungen als Aufwachzeit gewertet werden
  - Gleiches Cap auf per-Person `_pOtherEvts` und `_pBedRetRaw`

- **Fix 3: Consistency Guard** (`src/main.js` ~Zeile 1388)
  - Wenn `wakeSource='other'` UND `sleepWindowOC7.start === null`: `wakeConf = 'niedrig'` statt `'mittel'`
  - Ehrliche Konfidenz wenn kein Schlafbeginn bekannt

- **Fix 4: "Haus-wird-still"-Einschlafzeit für PIR-only** (`src/main.js` ~Zeile 838)
  - Neuer Algorithmus `sleepWindowHausStill` — zuverlässiger als Schlafzimmer-Stille-Erkennung
  - Idee: Schlafzimmer-PIR feuert im Schlaf weiter → Stille in Kueche/Flur/Wohnzimmer ist das Signal
  - Iteriert rueckwärts durch Bett-Events (18:00-02:00): letztes Event nach dem ALLE Gemeinschaftsbereiche ≥30 Min stumm bleiben = Einschlafzeit
  - In OC-7-Prioritätskette eingebaut: `fp2 > haus_still > motion > fixed`
  - `sleepWindowSource` und `allSleepStartSources` um `haus_still` erweitert
  - Gleiches Muster per-Person in `_pSleepStart` (Fallback wenn 15-Min-Gap-Methode nichts findet)

- **OC-22: Gelernter Rolling-Durchschnitt + NN in BRAINSTORMING.md dokumentiert**
  - Stufe 1: 7-Nacht-gleitender Mittelwert als Plausibilitäts-Prior (mittelfristig)
  - Stufe 2: MLP-NN für Schlafmuster-Klassifikation (Langfrist-Roadmap, Phase 5+)

### 🔧 Offene Baustellen
- **OC-21: personTag-Filter für `_motOutEvts`** — nach Praxistest v0.33.79
- **OC-22: Rolling-Durchschnitt** — nach 3+ stabilen Nächten mit haus_still
- OC-7: Schlafphasen-Chart (Tief/Leicht/REM) + Sleep-Score — Roadmap

### 🎯 Nächster logischer Schritt
- Ingrid & Robert: nächste Nacht abwarten → prüfen ob `sleepWindowStart` jetzt via `haus_still` erkannt wird
- Aufwachzeit: sollte jetzt ~11:41 statt 14:49 zeigen
- `sleepWindowSource` in ioBroker-Objekten prüfen: sollte `haus_still` statt `fixed` sein
- Ggf. `wakeConf` im UI überprüfen: bei gutem `haus_still`-Start sollte `mittel` erscheinen

---

## 🗓️ Sitzung 26.03.2026 — Version 0.33.78 (OC-17: Topologie-Hop-Filter)

### ✅ Abgeschlossen
- **Backend: Topologie-BFS-Hop-Filter für `_motOutEvts`** (`src/main.js` ~Zeile 1094)
  - Vor dem Clustering lädt der Algorithmus jetzt `analysis.topology.structure`
  - BFS von allen Schlafzimmer-Räumen (Sensoren mit `sensorFunction='bed'`) bis Hop ≤ 2
  - Sensoren in Räumen > 2 Hops vom Schlafzimmer werden aus `_motOutEvts` herausgefiltert
  - Beispiel: OG Flur (3-4 Hops von EG Schlafen) → keine roten Dreiecke mehr
  - Graceful Degradation: wenn Topologie nicht verfügbar oder keine Schlafzimmer-Räume gefunden → kein Filter (alle Events werden einbezogen wie bisher)
- **Frontend: Topologie-BFS-Hop-Filter für Batterie-Warnung** (`HealthTab.tsx` ~Zeile 1163, OC-17)
  - `topoData` State hinzugefügt; wird beim Mount aus `analysis.topology.structure` geladen
  - `bfsHops()` Hilfsfunktion für BFS im Frontend
  - Batterie-Warnung filtert jetzt: erst Typ/Funktion-Check (wie bisher), dann Hop-Filter
  - Sensoren > 2 Hops vom Schlafzimmer bekommen keine Batterie-Warnung in der Schlafkachel
  - Beispiel: "Homematic OG Flur Bewegung Hinten 1" → keine Warnung mehr
- **OC-21: personTag-Filter in BRAINSTORMING.md dokumentiert** — als Ergänzung zum Hop-Filter für zukünftige granulare Personenzuordnung

### 🔧 Offene Baustellen
- **OC-21: personTag-Filter für `_motOutEvts`** — Brainstorming, nach Praxistest Hop-Filter
- **OC-17 vollständig umgesetzt** → kann aus BRAINSTORMING.md als "implementiert" markiert werden
- OC-7: Schlafphasen-Chart (Tief/Leicht/REM) + Sleep-Score — Roadmap
- OC-20: Medizinisches Profil → Algorithmus — Roadmap

### 🎯 Nächster logischer Schritt
- Nächste Nacht prüfen: OG Flur erscheint nicht mehr als rotes Dreieck in Schlafanalyse
- OG Flur erscheint auch nicht mehr in Batterie-Warnung der Schlafkachel
- Nach 2-3 Nächten: Bewertung ob Hop-Filter zu aggressiv (relevante Events fehlen?) oder zu locker

---

## 🗓️ Sitzung 26.03.2026 — Version 0.33.77 (OC-7 Bugfixes: Bathroom-Prewindow + Lane-Collision)

### ✅ Abgeschlossen
- **Bugfix Backend: FP2-Bathroom-Prewindow** (`src/main.js` Phase 3, ~Zeile 1123)
  - Problem: Wenn Nutzer ins Bad geht BEVOR der FP2/Präsenz-Sensor die Bettleere erkennt, fiel der Bad-Sensor-Trigger vor `fp2.start` und wurde bei `_hasBath`-Check nicht erfasst → FP2-Event bekam Typ `'outside'` statt `'bathroom'` → orangenes Dreieck fehlte
  - Lösung: `hasBath`-Check schaut jetzt 2 Minuten vor `fp2.start` zurück (`fp2.start - 2*60*1000`) um Bad-Sensor-Trigger kurz vor FP2-Reaktion zu erfassen
  - Betroffene Nutzer: alle mit FP2/Präsenz-Sensor am Bett (Aqara FP2, nuukanni.praesenz etc.)
- **Bugfix Frontend: Lane-Kollision bei 3+ nahen Markern** (`HealthTab.tsx` ~Zeile 1327)
  - Problem: Lane-Check prüfte nur gegen `lastPctInLane[0]`, nicht `lastPctInLane[1]` → bei 3 sehr nahen Markern landeten zwei in derselben Lane
  - Lösung: Dreistufige Prüfung (Lane 0 frei? → Lane 0; Lane 1 frei? → Lane 1; sonst Lane 0)

### 🔧 Offene Baustellen
- **Retroaktiv nicht sichtbar**: Heutige Nacht (26.03.) ist bereits eingefroren → Fix gilt ab nächster Nacht
- **Wiedervorlage** 31.03.2026 (aus AUFFAELLIGKEITEN): Marker-Dichte/Lesbarkeit mit echten Nachtdaten prüfen
- OC-7: Schlafphasen-Chart (Tief/Leicht/REM) + Sleep-Score-Zahl — Roadmap
- OC-17: Batterie-Topologie-Nähefilter — Roadmap
- OC-20: Medizinisches Profil → Algorithmus — Roadmap

### 🎯 Nächster logischer Schritt
- Nächste Nacht (27.03.) prüfen: Erscheint jetzt das orangene ▼ Dreieck korrekt für Bad-Besuche?
- OC-7: Schlafphasen-Grafik weiterbauen wenn Marker-System stabil läuft

---

## 🗓️ Sitzung 25.03.2026 — BRAINSTORMING.md Bereinigung (kein Code-Change)

### ✅ Abgeschlossen
- **OC-19 aus BRAINSTORMING.md entfernt** — vollständig implementiert in v0.33.75 (`otherRoomWakeTs` Return-to-Bed-Algorithmus in `src/main.js`)
- **OC-18 aus BRAINSTORMING.md entfernt** — vollständig implementiert in v0.33.75/76 (Problem A Fix, FP2-Label-Fix, Separate Kacheln pro Person)
- **OC-7 in BRAINSTORMING.md** als teilweise implementiert markiert (Schlafanalyse-Kachel läuft; Schlafphasen-Chart + Sleep Score noch offen)
- **OC-20 Abhängigkeit** auf OC-19 aktualisiert (Return-to-Bed v0.33.75 ist Basis)

### 🔧 Offene Baustellen (aus BRAINSTORMING.md)
- OC-20: Medizinisches Profil → Algorithmus (Schlafstörungen, Parkinson, etc.) — Roadmap
- OC-17: Batterie-Warnung mit Topologie-Nähefilter — Roadmap
- OC-7: Schlafphasen-Chart (Tief/Leicht/REM) + Sleep-Score-Zahl — Roadmap
- OC-4: Startup-Guard bei eventHistory < 3h — noch nicht implementiert

### 🎯 Nächster logischer Schritt
- Abwarten bis Robert + Ingrid erste Nacht mit v0.33.76 schlafen → prüfen ob 2 Kacheln erscheinen
- Dann OC-17 (Batterie-Topologie) oder OC-7 (Schlafphasen-Chart) angehen

---

## 🗓️ Sitzung 25.03.2026 — Version 0.33.76 (OC-18 Prio 2: Separate Schlafkacheln)

### ✅ Abgeschlossen
- **OC-18 Prio 2: Backend — Per-Person Schlafanalyse in `personData`**
  - `personData[name]` erweitert um: `sleepWindowStart`, `sleepWindowEnd`, `wakeSource`, `wakeConf`
  - Schlafbeginn: letztes Abend-Bett-Event (18-23 Uhr) mit >15-Min-Stille danach
  - Aufwachzeit: OC-19 Return-to-Bed-Algorithmus, gefiltert auf eigene Person + Shared-Sensoren
  - Andere Person's Sensoren (anderes `personTag`) werden komplett aus der Analyse gefiltert
  - `personData` war bereits im Snapshot — keine API-Änderung nötig
  - Rückwärtskompatibel: kein personTag → personData bleibt leer → keine Änderung
- **OC-18 Prio 2: Frontend — Separate Schlafkacheln pro Person**
  - `personHistoryData` State hinzugefügt; wird aus `d.personData` geladen (beide Ladeorte)
  - `renderSleepScoreCard(overrideData?, personLabel?)` parameterisierbar gemacht
  - Kacheltitel dynamisch: `"SCHLAFANALYSE — Robert"` / `"SCHLAFANALYSE — Ingrid"`
  - Render-Logik: ≥2 Personen mit sleepWindowEnd/Start → separate Kacheln pro Person
  - 1 Person oder kein personTag → Legacy-Modus (bestehende kombinierte Kachel, unverändert)
  - Per-Person-Kachel: Aufwachzeit, Schlafdauer, Wake-Source-Label (keine Schlafphasen-Grafik)

### 🔧 Offene Baustellen
- **OC-18: Schlafphasen pro Person** — Vibrationssensor-Daten sind nicht per-Person aufgetrennt (gemeinsamer Sensor); für separates Schlafphasen-Chart bräuchte jede Person einen eigenen Vibrationssensor
- **OC-20: Medizinisches Profil → Algorithmus** — Roadmap

### 🎯 Nächster logischer Schritt
- Deployment bei Robert/Ingrid-Kunden, Rückmeldung ob Aufwachzeiten jetzt korrekt pro Person
- Bei Bedarf: Feinjustierung der Schlafbeginn-Erkennung (15-Min-Stille → konfigurierbar?)

---

## 🗓️ Sitzung 25.03.2026 — Version 0.33.75 (Mehrpersonenhaushalt + Return-to-Bed)

### ✅ Abgeschlossen
- **OC-18 Problem-A-Fix: Andere Schlafzimmer-Sensoren aus Aufwachzeit-Erkennung ausgeschlossen**
  - `_otherRoomEvts`-Filter in `src/main.js` (~Zeile 1192): `!e.isBedroomMotion` hinzugefügt
  - Effekt: Ingrid's Schlafzimmer-Sensor zählt nicht mehr als "anderer Raum" für Roberts Aufwachzeit
  - Rückwärtskompatibel: Einpersonenhaushalt ohne `personTag` → keine Änderung (alle Sensoren bleiben `isBedroomMotion=false` wenn Funktion nicht 'bed')
- **OC-18 FP2-Label-Fix Backend: `fp2OtherWakeTs` nur bei echtem Präsenz-Radar**
  - Bedingung `sleepWindowSource === 'fp2'` für `fp2OtherWakeTs`-Berechnung hinzugefügt
  - Effekt: Kunden ohne FP2 bekommen `wakeSource = 'other'` oder `'motion'` statt `'fp2_other'`
  - Kein falsches "FP2 + Anderer Raum" mehr wenn nur Bewegungsmelder vorhanden
- **OC-18 FP2-Label-Fix Frontend: `hasFP2Sensor`-Check in `srcInfo`-Labels**
  - `nativeDevices.some(d => d.type === 'presence_radar_bool' || d.isFP2Bed)` prüft ob echter FP2 vorhanden
  - Ohne FP2: `'FP2-Sensor'` → `'Bett-Bewegungsmelder'`, `'FP2 + Anderer Raum'` → `'Bett-Sensor + Anderer Raum'`
  - Mit FP2: Bezeichnungen unverändert (bestehende Kunden)
- **OC-19 Return-to-Bed-Detektion: "Letzte Abfahrt ohne Rückkehr" (kein fixer Zeitwert)**
  - Neuer `otherRoomWakeTs`-Algorithmus in `src/main.js` (~Zeile 1188ff)
  - Zeitfenster-basiert (2-Min-Puffer für PIR-Nachlaufzeit), NICHT Flanken-basiert
  - Iteriert vorwärts durch alle Abfahrten und sucht die erste ohne nachfolgende Schlafzimmer-Aktivität
  - Korrekte Reaktion auf Badezimmer-Besuch + Rückkehr: Aufwachzeit erst nach letzter Abfahrt
  - Flanken-Detektion bleibt für alle anderen Algorithmen (Ganggeschwindigkeit etc.) unberührt
- **OC-18/19/20 in BRAINSTORMING.md dokumentiert**
  - OC-18: Mehrpersonenhaushalt mit Problem A (fix), FP2-Label (fix) und Separate Kacheln (offen)
  - OC-19: Return-to-Bed-Algorithmus (implementiert) mit Grenzen und Designentscheidungen
  - OC-20: Medizinisches Profil beeinflusst Algorithmus (Roadmap, noch offen)

### 🔧 Offene Baustellen
- **OC-18: Separate Schlafkacheln pro Person** — noch nicht implementiert
  - Braucht Backend-Refactor: Schlafanalyse für jede Person separat berechnen
  - Frontend: n Kacheln für n Personen mit `personTag`, Legacy-Modus bei 0 Personen
- **OC-18: Bad-Zuordnung pro Person** — `personTag` in SensorList schon vorhanden, Backend ignoriert es noch für Badezimmer-Filterung
- **OC-20: Medizinisches Profil → Algorithmus** — Roadmap, noch kein Code

### 🎯 Nächster logischer Schritt
- Separate Schlafkacheln pro Person (OC-18): Backend-Refactor für person-spezifische Schlafanalyse
- Für Robert/Ingrid-Kunden: Status nach Deployment prüfen — erwartet: Aufwachzeit jetzt deutlich später als 04:00

---

## 🗓️ Sitzung 25.03.2026 — Version 0.33.74

### ✅ Abgeschlossen
- **OC-7: Außer-Bett-Aktivität auf alle Nicht-Schlafzimmer-Sensoren erweitert**
  - `_motOutEvts`-Filter: bisher nur Bad + Küche → jetzt alle Sensoren die nicht `isFP2Bed`, `isVibrationBed`, `isBedroomMotion` sind
  - Cluster-Tracking: neues `hasOther`-Flag für Nicht-Bad/Küche-Events
  - Neue Event-Typen: `outside` (rot, bestätigt zuordenbar), `other_person` (blau, andere Person)
- **OC-7: Mehrpersonenhaushalt-Logik (couple/family)**
  - Einpersonenhaushalt: alle Außer-Events → `type: 'outside'` (rot)
  - Mehrpersonenhaushalt mit FP2: Außer-Event nur rot wenn FP2 Bett-leer bestätigt, sonst blau (`other_person`)
  - Mehrpersonenhaushalt ohne FP2: Außer-Events → `type: 'other_person'` (blau, nicht sicher zuordenbar)
- **OC-7: Snapshot-Timing gefixt (57-Sekunden-Loch)**
  - Cron von `'59 23 * * *'` (= 23:59:00) → `{ hour: 23, minute: 59, second: 59 }`
  - Events kurz vor Mitternacht (23:59:xx) werden jetzt korrekt im Snapshot erfasst
- **OC-7: Dreiecks-Marker verbessert**
  - `'v'`/`'^'` → `'▼'`/`'▲'` (Unicode-Dreiecke)
  - `fontSize` von `10px` → `15px` mit `fontWeight: 'bold'`
  - Farbe dynamisch nach `evtType`: Orange (bad), Rot (outside), Blau (other_person)
- **OC-7: Schlaf-Radar 22:00–23:59 konsistente Datenquelle**
  - Slots 44–47 (22:00–23:59) nutzen jetzt `d.outsideBedEvents` als ergänzende Quelle (`Math.max`)
  - Löst Diskrepanz zwischen OC-7-Balken und Schlaf-Radar für Events kurz vor Mitternacht
- **OC-7: Frontend-Erweiterungen**
  - `stageColor`: `other_person: '#1e88e5'` (blau), `outside` von `#ff5722` → `#e53935` (reines Rot)
  - Legende: `■ Andere Person` (blau) erscheint wenn `other_person`-Events vorhanden
  - Außerhalb-Zeile: aufgeschlüsselt nach `outside` und `other_person` mit korrekten Farben
  - Tooltip-Texte: "Bad-Besuch", "Außerhalb", "Andere Person aktiv" mit Dauer

### 🔧 Offene Baustellen
- Topologie-Hop-Check: Wenn Sensor-Pfad von Schlafzimmer zum ausgelösten Raum nicht plausibel (Zwischensensor nicht ausgelöst) → als `other_person` einstufen. Erfordert Lesen der `analysis.topology.structure`-Matrix.
- `other_person`-Events sollten im Schlaf-Radar ggf. in separater Farbe (blau) dargestellt werden statt nur in der "Außerhalb"-Zeile

### 🎯 Nächster logischer Schritt
- Adapter auf v0.33.74 aktualisieren und Nacht abwarten um neue Außer-Bett-Erkennung (Wohnzimmer/Diele) zu testen

---

## 🗓️ Sitzung 24.03.2026 — Version 0.33.73 (Nachtrag)

### ✅ Abgeschlossen
- **OC-15 Batterie-Warnung in Schlafkachel — präziser Filter + Sensor-Name**
  - Filter war zu breit (alle Low-Sensoren) → jetzt nur schlaf-relevante Sensoren:
    - `vibration_trigger`, `vibration_strength`, `presence_radar_bool` → immer
    - `motion` mit `sensorFunction` bed/bathroom/kitchen/hallway → relevant
    - Türkontakte, Temperatursensoren, Licht, Rauchmelder → ignoriert
  - Sensor-Name + Ort jetzt in der Warnung sichtbar (statt nur "5%")
  - `LOW_BAT=true` wird als "LOWBAT aktiv" angezeigt statt irreführenden "5%"
  - `nativeDevices`-State für Cross-Reference mit Sensor-Namen

---

## 🗓️ Sitzung 24.03.2026 — Version 0.33.72 (Nachtrag)

### ✅ Abgeschlossen
- **OC-15 Bug-Fix: Homematic `LOW_BAT` (Unterstrich-Bug)**
  - Homematic-States heißen `LOW_BAT` und `LOW_BAT_ALARM` (mit Unterstrich), nicht `LOWBAT`
  - `HM_BATT_NAMES` jetzt: `['LOW_BAT', 'LOW_BAT_ALARM', 'LOWBAT', 'LOWBAT_ALARM']`
  - Alle Homematic-Sensoren (Bewegungsmelder, Fensterkontakte, Heizventile) werden jetzt erkannt
- **OC-15 Bug-Fix: `val=null` Discovery-Problem**
  - State-Pfad wird jetzt auch gespeichert wenn der ioBroker-State existiert aber `val=null` hat (z.B. Zigbee-Sensor der noch nie einen Batteriewert gesendet hat)
  - Fix in allen 3 Discovery-Steps: Alias, Multi-Level-Search, Homematic

---

## 🗓️ Sitzung 24.03.2026 — Version 0.33.70 (Nachtrag)

### ✅ Abgeschlossen
- **OC-15 Generische Battery-Discovery für alle ioBroker-Adapter (v0.33.70)**
  - `BATTERY_NAMES` erweitert um: `battery_percentage`, `battery_level`, `batteryLevel`, `battery-level`, `BatteryLevel`, `Bat.value`, `Bat.percent`, `bat.value`, `params.battery.Battery_Level`, `params.battery.Battery_Level_Alarm`
  - Step 3 (Direktsuche) jetzt **Multi-Level**: probiert Pfadtiefen 1, 2 und 3 (min. `adapter.instance.device` bleibt erhalten)
  - Abgedeckte Adapter: deCONZ (wie Zigbee), Tuya, mihome, BLE, HomeKit-Controller, Matter, ESPHome, Shelly (`Bat.value` bei Tiefe 2), Z-Wave 2 (`params.battery.Battery_Level` bei Tiefe 3)
  - Labeled-Break `_discoveryLoop:` für frühen Abbruch nach erstem Treffer

### 🎯 Nächster logischer Schritt
- Prüfen ob Homematic-Heizventile nach Adapter-Update Batteriestand zeigen

---

## 🗓️ Sitzung 24.03.2026 — Version 0.33.69 (Nachtrag)

### ✅ Abgeschlossen
- **OC-15 Homematic Battery-Discovery**
  - `discoverBatteryStates()`: Neuer Schritt 4 für Homematic-Sensoren
    - Erkennt `hm-rpc.`, `hmip-rfc.`, `hm-rega.` Präfixe
    - Extrahiert Kanal 0 aus Geräteadresse: `DEVADDR:1.STATE` → `DEVADDR:0`
    - Sucht `LOWBAT`, `LOWBAT_ALARM`, `BATTERY_STATE`, `OPERATING_VOLTAGE` auf Kanal 0
    - Source-Label: `hm-auto`
  - `checkBatteryLevels()`: Spannungskonvertierung für Homematic-Spannungswerte
    - Erkennung: Wenn Wert zwischen 0 und 10 → Volt-Wert
    - Umrechnung: 1,5V = 0%, 4,5V = 100% (lineare Interpolation, deckt AA/AAA/Li ab)
    - Boolsche LOWBAT-Werte bleiben unverändert (true = 5%, false = 80%)
  - `SensorList.tsx`: Tooltip-Label für `hm-auto` → "Homematic Kanal-0"

### 🎯 Nächster logischer Schritt
- Adapter auf v0.33.69 aktualisieren und testen ob Homematic-Heizventile jetzt Batteriestand zeigen

---

## 🗓️ Sitzung 24.03.2026 — Version 0.33.68 (Nachtrag)

### ✅ Abgeschlossen
- **OC-15 Battery-UI (Frontend-Verbesserung)**
  - `Settings.tsx`: `loadBatteryStatus()` lädt `system.sensorBatteryStatus` beim Mount; neuer `selectIdContext: 'battery'`; `openSelectBatteryIdDialog(index)` Methode; `batteryStatus` State + Prop an SensorList
  - `SensorList.tsx`: Auto-entdeckte Battery-State-ID wird als grüner Hinweis-Text mit Ladestand-Prozent direkt unter dem Eingabefeld angezeigt (z.B. "✓ zigbee.0.xxx.battery · 97%"); `source` (auto/alias) in Tooltip; Object-Picker-Button "." öffnet ioBroker-Objektbrowser
  - `HANDBUCH.md`: Neuer Abschnitt "6b. Batterie-Monitoring (OC-15)" mit Discovery-Tabelle (3 Stufen), Schwellenwert-Tabelle, ausgeschlossene Sensoren, State-Pfad; Troubleshooting-Einträge für "Battery-Warnung nicht sichtbar" und "Battery-State nicht gefunden"

### 🎯 Nächster logischer Schritt
- Adapter aktualisieren (v0.33.67 → v0.33.68) um Batterie-Anzeige zu testen
- Prüfen ob auto-entdeckte State-IDs korrekt im Hint-Text erscheinen
- Weitere Konzepte aus BRAINSTORMING.md umsetzen

---

## 🗓️ Sitzung 24.03.2026 — Version 0.33.67

### ✅ Abgeschlossen
- **OC-15: Batterie-Monitoring für batteriebetriebene Sensoren (`src/main.js` + Frontend)**
  - `discoverBatteryStates()`: Auto-Discovery pro Sensor beim Start + alle 12h
    - Priorität 1: Manuelles `batteryStateId`-Feld aus Sensor-Konfiguration
    - Priorität 2: Alias-Rekonstruktion (`common.alias.id` → nativer Gerätepfad → `battery`/`BATTERY`/`battery_low`/`lowBattery`)
    - Priorität 3: Direktsuche im selben Gerätepfad
  - `checkBatteryLevels()`: Liest Batteriestand stündlich (in `checkSensorHealth()` eingehängt)
    - ≤ 20% → `isLow = true` (Warnung)
    - ≤ 10% → `isCritical = true` (Kritisch + Pushover)
  - Pushover 1x täglich ab 09:00 Uhr bei kritischer Batterie (Dedup per Tag)
  - KNX/Loxone/BACnet/Modbus automatisch übersprungen (kabelgebunden, kein Heartbeat)
  - Neues ioBroker State: `system.sensorBatteryStatus` (JSON mit allen Sensoren + Level)
  - `SensorList.tsx`: Neuer Akkordeon-Block "Batterie-Konfiguration" — zeigt alle batterie-relevanten Sensoren mit manuellem `batteryStateId`-Feld
  - `HealthTab.tsx`: Battery-Warn-Badge in Schlafanalyse-Kachel (`🔋/🪫 Batterie niedrig X% — Schlafanalyse evtl. ungenau`)
- **OC-2: Topologie-Matrix in System-Tab verschoben (`SystemTab.tsx` + `SecurityTab.tsx`)**
  - `SystemTab.tsx`: TopologyView jetzt als eigener Accordion "Topologie-Matrix & Raum-Adjazenz" — Hinweis: zentral für Personenzählung, Ganggeschwindigkeit, Sicherheit
  - `SecurityTab.tsx`: TopologyView entfernt, ersetzt durch Info-Alert "Topologie-Matrix → System-Tab"

### 🔧 Offene Baustellen
- OC-15: Batterie-Warnung in HealthTab zeigt ALLE Sensoren mit niedrigem Akkustand — nicht nur den Vibrationssensor. In einem Follow-up könnten vibration-spezifische Sensoren gefiltert werden.
- OC-15: `batteryStateId`-Feld in der Sensorkonfiguration ist noch nicht validierbar (kein Test-Button wie bei Garmin-States)
- OC-2: Primärflur-Checkbox noch sichtbar für nicht-Flur-Sensoren in der neuen P-Flur-Spalte (bereits bekannter offener Punkt)
- OC-5 ist noch nicht konfigurierbar (Admin-UI-Einstellung fehlt) — vorerst hardcoded auf 7 Tage

### 🎯 Nächster logischer Schritt
- Adapter auf v0.33.67 updaten → Battery-Discovery läuft beim nächsten Start
- Am 31.03.2026: Kalibrierungslog auswerten (OC-16)

---

## 🗓️ Sitzung 24.03.2026 — Version 0.33.66

### ✅ Abgeschlossen
- **OC-9: AURA-Sleepscore Rohwert anzeigen wenn > 100 (`HealthTab.tsx`)**
  - `sleepScoreRaw` (ungekappter Wert) wird in beiden `setAuraSleepData`-Calls geladen
  - Im Score-Badge erscheint `↑ roh: X` in Teal-Farbe wenn Rohwert > 100
  - Hover-Tooltip erklärt: "Ungekappter Rohwert — für Anzeige auf 100 begrenzt"
  - HelpText der Kachel aktualisiert: "(Anzeige max. 100, Rohwert kann höher sein)"
- **OC-14: Vibration-Label als Konfidenz-Booster klar kennzeichnen (`HealthTab.tsx`)**
  - Label von `'Vibrationssensor (Bestätigung)'` → `'Vibrationssensor (↑ Konfidenz)'`
  - Im allWakeSources Dev-Tooltip erscheint `[Konfidenz-Booster]` neben Vibration-Einträgen
  - `CONFIDENCE_BOOSTERS` Set eingeführt — einfach erweiterbar für weitere Quellen
- **OC-5: Sensor-Offline-Schwelle auf 7 Tage erhöht (`src/main.js`)**
  - `motion`, `presence_radar`, `vibration`: `24h` → `7 Tage`
  - `defaultThreshold`: `24h` → `7 Tage`
  - Türsensoren waren bereits auf 7 Tage (unverändert)
  - Weniger False-Positive-Pushover-Nachrichten bei seltener genutzten Räumen

### 🔧 Offene Baustellen
- OC-5 ist noch nicht konfigurierbar (Admin-UI-Einstellung fehlt) — vorerst hardcoded auf 7 Tage
- OC-14: Prioritätslogik-Anpassung (FP2_vib als kombinierte Hauptquelle) folgt nach Kalibrierungsauswertung am 31.03.2026

### 🎯 Nächster logischer Schritt
- Adapter auf v0.33.66 updaten
- Kalibrierungslog am 31.03.2026 auswerten (OC-16)

---

## 🗓️ Sitzung 24.03.2026 — Version 0.33.65

### ✅ Abgeschlossen
- **`outsideBedEvents` jetzt aus Bad/Küchen-Bewegungsmelder + FP2 kombiniert (`src/main.js`)**
  - Bisher: nur FP2-Bett-Sensor (Bett leer → Bett belegt) → bei kurzer FP2-Haltezeit kein Event
  - Neu: **PHASE 1** FP2-Bett-Events (exakte Timestamps, wenn FP2 reagiert)
  - Neu: **PHASE 2** Motion-Sensor-Events aus Bad (`isBathroomSensor`) und Küche (`isKitchenSensor`) werden zu Clustern (5-Min-Gap, 3-Min-Puffer nach letztem Event) zusammengefasst → exakte Timestamps
  - Neu: **PHASE 3** Merge: FP2 hat Vorrang, Motion-Events füllen Lücken wo FP2 nicht reagiert hat
  - **Freeze-Supplement**: Auch bei bereits eingefrorenem Snapshot wird `outsideBedEvents` rückwirkend aus Motion-Events ergänzt, wenn Array bisher leer war (retrospektiv für aktuelle Nacht)
  - Nutzt `this.config.devices` für zuverlässige Gerätezuordnung (zusätzlich zu `e.isBathroomSensor`-Flag)

### 🔧 Offene Baustellen
- FP2-Haltezeit prüfen: Wenn FP2-Haltezeit > Abwesenheitsdauer, kein FP2-Event → Motion-Fallback greift
- Hallway-Sensoren (`isHallway`) noch nicht in outsideBedEvents berücksichtigt (nur Bad + Küche)

### 🎯 Nächster logischer Schritt
- Adapter updaten + Nacht abwarten → prüfen ob Dreiecke in Schlafkachel erscheinen

---

## 🗓️ Sitzung 24.03.2026 — Version 0.33.63

### ✅ Abgeschlossen
- **Schlafkachel UX verbessert (`HealthTab.tsx`)**
  - Outside-/Bad-Events werden auf das tatsächliche Schlaf-Fenster (`sleepWindowStart`/`sleepWindowEnd`) geclippt.
  - Balken rendert nur noch Slots innerhalb des Schlaf-Fensters (kein Überstand rechts der Aufwachzeit).
  - Dreiecksmarker jetzt für **alle** Bad-/Outside-Events, nicht nur lange Abwesenheiten.
  - Marker-Kollisionen werden in zwei Lanes (oben/unten) gestaffelt, damit nahe Ereignisse sichtbar bleiben.
- **Wake-Entscheidungslogik in `src/main.js` erweitert**
  - Neue kombinierte Quelle `fp2_vib` (enge FP2+Vibration-Korrelation) als priorisierte Wake-Option.
  - `fp2_other`, `other` und `vibration_alone` werden in der finalen Wake-Quellenwahl berücksichtigt.
  - `allWakeSources` um `fp2_vib` ergänzt.
- **Kalibrier-Tracking gegen Garmin vorbereitet (`src/main.js`)**
  - Neues State-Objekt: `analysis.health.sleepCalibrationLog`.
  - Bei `saveDailyHistory()` wird pro Nacht ein Kalibrier-Eintrag mit Kandidaten und Garmin-Abweichungen gespeichert (Start/Ende).
- **Interne Doku aktualisiert**
  - `_internal/BRAINSTORMING.md`: OC-15 (Batteriewarnung inkl. Alias-Fallback) + OC-16 (Schlaf-Kalibrierung gegen Garmin) ergänzt.
  - `_internal/AUFFAELLIGKEITEN.md`: Marker/Overlay-Auffälligkeit + Wiedervorlage 31.03.2026 ergänzt.

### 🔧 Offene Baustellen
- Nach 5–7 Nächten Kalibrier-Log auswerten (MAE je Quelle Start/Ende).
- Marker-Dichte bei sehr vielen kurzen Events prüfen (ggf. zusätzliche Entzerrung/Tooltip-Optimierung).
- Batterie-Erkennung (Auto-Discovery + manuelles `batteryStateId`) backendseitig ausarbeiten.

### 🎯 Nächster logischer Schritt
- Am **31.03.2026** Kalibrierdaten aus `analysis.health.sleepCalibrationLog` ziehen und Quellenranking gegen Garmin durchführen.

---

## 🗓️ Sitzung 23.03.2026 — Version 0.33.63

### ✅ Abgeschlossen
- **OC-10: Schlaf-Score & Phasen-Charts im AURA MONITOR WOCHE/MONAT-View** implementiert
  - **Option A (AURA-Sleepscore):** Balken-Chart pro Nacht, farbkodiert (Grün ≥80, Orange 60–79, Rot <60), Garmin-Score als lila Punkt-Overlay, Durchschnittswert in Überschrift
  - **Option B (Schlafphasen-Anteile):** Gestapelter Balken-Chart mit Tief (dunkelblau), Leicht (hellblau), REM (lila), Wachliegen (gelb); Score-Linie als gestrichelter Overlay, Ø Tief% und Ø REM% in Überschrift
  - Implementierung als reines SVG (kein recharts), AURA MONITOR Terminal-Stil konsistent
  - Neues `TerminalBox`-Element „SCHLAF-SCORE & PHASEN - N TAGE" zwischen Übersichtstabelle und Raum-Nutzung eingefügt
  - Datenbasis: `weekData[i].data.sleepScore`, `.sleepStages`, `.garminScore` aus den Snapshot-Dateien (bereits seit v0.33.52 vorhanden)
  - Beide Charts erscheinen nebeneinander (Grid 1fr 1fr) wenn beide Daten vorliegen, einzeln wenn nur eines
  - Funktioniert sowohl in WOCHE- als auch in MONAT-Ansicht

### 🔧 Offene Baustellen
- DEV-Tooltips (`⚙ Quellen`) für Einschlafzeit entfernen wenn nicht mehr benötigt
- Option B: Referenzlinien für Tief 15–25% und REM 20–25% als gestrichelte Linien ggf. ergänzen

### 🎯 Nächster logischer Schritt
- Prüfen: Erscheinen Schlaf-Charts im WOCHE-View korrekt mit historischen Snapshot-Daten?

---

## 🗓️ Sitzung 23.03.2026 — v0.33.62 — OC-10 Schlaf-Charts im Wochenview + Wake-Timestamps

### ✅ Abgeschlossen

**OC-10: Schlaf-Score Wochenansicht (seit v0.33.52 aufgeschoben — endlich umgesetzt)**

Zwei neue Charts in `LongtermTrendsView.tsx` im WOCHE-View (blaue Sektion "🌙 OC-7 SCHLAF-SCORE & PHASEN"):

**Option A — AURA-Sleepscore:**
- Balkendiagramm: ein Balken pro Nacht, Höhe = Score (0–100)
- Farbe: Grün ≥80, Orange 60–79, Rot <60
- Gestrichelte Linie: Garmin-Score zum Vergleich (lila Punkte)
- Durchschnittsscore + Anzahl Nächte mit Daten als Subtitle
- Farbzonen: rote/orange/grüne ReferenceArea im Hintergrund

**Option B — Schlafphasen-Anteile:**
- Gestapelter Balken: Tiefschlaf (dunkelblau), Leichtschlaf (hellblau), REM (lila), Wachliegen (gelb) als % der Nacht
- Score-Linie gestrichelt auf rechter Y-Achse überlagert
- Subtitle: Ø Tiefschlaf-% und Ø REM-% + Anzahl Nächte
- Tooltip: zeigt alle Werte mit Bezeichnung

Beide Charts:
- Zeigen sich nur wenn Daten vorhanden (`sleepScore != null` / `sleepStages != null`)
- Verwenden `dailyDataRaw` (alle Tage im gewählten Zeitraum)
- Skalieren mit WOCHE / 4 WOCHEN / 6 MONATE

**Neue Datenfelder in `DailyDataPoint`-Interface und Laderoutine:**
- `sleepScore`: AURA-Sleepscore aus Snapshot
- `sleepScoreRaw`: ungekappter Score (für Wochenstatistik)
- `sleepStages`: Array `{t, s}` der 5-Minuten-Slots
- `garminScore`: Garmin-Score aus Snapshot

**Wake-Kandidaten Timestamps (Punkt 6):**
- `fp2_other`, `other`, `vibration_alone` hatten bisher `ts: null`
- Jetzt vollständig berechnet in `src/main.js`:
  - `otherRoomWakeTs`: erste Bewegung in nicht-Schlafzimmer/Bad nach 04:00 + ≥3h Schlaf
  - `fp2OtherWakeTs`: FP2-Leer UND andere Raum-Bewegung innerhalb ±15 Min → früherer Wert
  - `vibAloneWakeTs`: letztes Vibrations-Event mit ≥45 Min Stille danach, nach 04:00 + ≥3h Schlaf
  - `vibWakeTs`: Timestamp des letzten Vibrations-Events im ±30 Min Fenster um FP2-Leer (Bestätigungs-Timestamp)
- Der `⚙ Quellen`-Tooltip zeigt jetzt echte Timestamps für alle 8 Wake-Kandidaten

### 🎯 Nächster logischer Schritt
- Morgen früh prüfen: Erscheinen Schlaf-Charts im WOCHE-View (wenn gute Stages vorhanden)?
- DEV-Tooltips (`⚙ Quellen`) entfernen wenn nicht mehr benötigt
- Option B: Optimalwert-Referenzlinien für Tiefschlaf (15–25%) und REM (20–25%) ggf. ergänzen

---

---

## 🗓️ Sitzung 23.03.2026 — v0.33.61 — Kritischer sleepFrozen-Bug behoben

### ✅ Abgeschlossen

**Root Cause:** `_sleepFrozen`-Bedingung verwendete `bedPresenceMinutes >= 180` als Stabilitätsprüfung. Im ersten Frozen-Save (z.B. 10 Uhr) wurden die Stages korrekt erhalten, aber `bedPresenceMinutes=0` (leerer Event-Buffer) in die Datei geschrieben. Der nächste stündliche Save fand `_existingSnap.bedPresenceMinutes=0 < 180` → Freeze brach zusammen → Stages=0 aus leerem Buffer überschrieb gute Schlaf-Stages. Ab diesem Punkt blieb die Kachel dauerhaft leer.

**Fix 1 — Backend `src/main.js`:**
- `_sleepFrozen`-Bedingung: `(_existingSnap.bedPresenceMinutes || 0) >= 180` → `_existingSnap.sleepStages && _existingSnap.sleepStages.length > 0`
- Stabiler Check: Solange gute Stages im Snapshot vorhanden, bleibt der Freeze aktiv. Kein Decay mehr durch leeren Event-Buffer am Tag.

**Fix 2 — Frontend `HealthTab.tsx` — Degradierter View:**
- Wenn `stages.length === 0` aber Schlaf-Zeitfenster bekannt (Garmin/FP2): Karte zeigt jetzt Einschlafen/Aufwachen-Zeiten + Garmin-Score (statt nur "Kein Vibrationssensor gefunden")
- Hinweis: "Schlafphasen nicht verfügbar — Vibrationsdaten zu alt (tritt auf wenn Adapter tagsüber neu gestartet wird)"
- So ist die Kachel auch bei diesem Edge Case informativ

**Anmerkung für heute (23.03.2026):** Die Stages des heutigen Tages sind unwiederbringlich verloren (Vibrationsereignisse aus dem Event-Buffer gelöscht). Ab morgen früh wird alles korrekt berechnet und der Freeze bleibt stabil. Die Kachel zeigt heute die Garmin-Zeiten im degradierten View.

### 🎯 Nächster logischer Schritt
- Morgen früh prüfen ob Stages korrekt berechnet und Freeze stabil bleibt (Log: `[History] Sleep FROZEN`)
- Langfristig: Event-Buffer für Schlaf-relevante Events separat persistieren (Vibration, FP2-Bett) um Buffer-Depletion zu verhindern

---

## 🗓️ Sitzung 23.03.2026 — v0.33.59 — Obfuskierung reaktiviert, Auffälligkeiten behoben

### ✅ Abgeschlossen

**Obfuskierung (Wichtig — Sicherheit):**
- `npm run build:backend:prod` reaktiviert — `main.js` + `lib/*.js` sind jetzt wieder obfuskiert (unleserlich auf GitHub)
- Ursache des Fehlers: In früheren Sitzungen wurde `main.js` direkt bearbeitet und `build:backend:dev` (ohne Obfuskierung) oder gar kein Build ausgeführt
- **Korrekter Workflow jetzt in `deployment-versionbump.mdc` dokumentiert:** immer `src/main.js` bearbeiten → `build:backend:prod` → `build:react` → Push

**Frontend `HealthTab.tsx`:**
- "Wach" → **"Wachliegen"** in allen 3 Stellen der Schlafanalyse-Legende (stageLabel, Legende, Zeitbalken-Zusammenfassung)

**Frontend `LongtermTrendsView.tsx`:**
- Vibrations-Intensität: **dynamische Y-Achse** — Max der Daten + 20% Puffer (aufgerundet auf 10er), mindestens 30. Caption zeigt nun aktuellen Max-Wert statt festem "0–255".
- `ReferenceArea` Grenzen ebenfalls auf `vibYMax` angepasst

**Frontend `SensorList.tsx` + Backend `main.js`:**
- Neue Spalte **"P-Flur" (Primärflur)** in der Sensortabelle — Checkbox erscheint nur bei Sensoren mit Funktion "Flur/Gang"
- Backend: Gait-Algorithmus filtert Hallway-Sensoren: wenn `isPrimaryHallway = true` bei mind. einem Sensor → nur dieser wird für Transitzeiten verwendet; sonst Fallback auf alle Flur-Sensoren

**Dokumentation:**
- `AUFFAELLIGKEITEN.md`: Schlafzeit x-Achse + Bett-Präsenz als behoben markiert; Wach-Label + Vibr.-Intensität als v0.33.59-behoben markiert
- `deployment-versionbump.mdc`: Workflow komplett neu dokumentiert (src/main.js → build:backend:prod → keine direkten main.js Edits mehr)

### 🎯 Nächster logischer Schritt
- Primärflur in Sensorkonfiguration setzen (System-Tab → Sensor mit Funktion "Flur/Gang" → P-Flur Checkbox aktivieren)
- Ganggeschwindigkeit nach einigen Tagen prüfen ob Wert plausibler ist

---

## 🗓️ Sitzung 23.03.2026 — v0.33.58 — Einschlafzeit-Verfeinerung, Garmin Wake, Schlafdauer

### ✅ Abgeschlossen

**Backend `main.js`:**
- **Garmin für Einschlafzeit** (Prio 0): Liest `garminSleepStartStateId` (Default: `garmin.0.dailysleep.dailySleepDTO.sleepStartTimestampGMT`). Plausibilitätsprüfung: 18–04 Uhr UND innerhalb FP2-Start + 3h. Wenn plausibel → `sleepWindowCalc.start` wird überschrieben.
- **Vibrations-Verfeinerung Einschlafzeit** (Prio 1): Sucht innerhalb der ersten 3h nach FP2-Bettbelegung das letzte Vibrations-Event das von ≥20 Min Stille gefolgt wird → `vibRefinedSleepStartTs`. Unterscheidet so "Lesen im Bett" von "Schlafen". Nur aktiv wenn ≥2 Vib-Events vorliegen.
- **Garmin Wake-Override** (neu sauber implementiert): Liest `garminSleepEndStateId`, plausibel 03–14 Uhr → überschreibt `sleepWindowOC7.end`. `wakeSource = 'garmin'`, `wakeConf = 'maximal'`.
- **Vibrationssensor Bestätigung Wake** (Prio-Boost): Vibration ±30 Min vor FP2-Leer-Signal → `wakeConf = 'sehr_hoch'` (statt nur 'hoch').
- **Neue Snapshot-Felder**: `sleepStartSource`, `allSleepStartSources` (5 Quellen), `wakeSource`, `wakeConf`, `allWakeSources` (8 Quellen).
- Frozen-Snapshot-Kompatibilität: Garmin-Override greift auch bei eingefrorenen Snapshots (Garmin kommt oft nach Einfrier-Zeitpunkt).

**Frontend `HealthTab.tsx`:**
- **Schlafdauer**: Wird als `🕐 Xh Ymin` unter dem AURA-Sleepscore-Badge angezeigt.
- **`⚙ Quellen`-Tooltip auf Einschlafzeit**: Zeigt alle 5 Einschlafzeit-Quellen mit Zeiten und aktiver Quelle (DEV-only, orange).
- **`sleepStartSource`** steuert jetzt den Sensor-Indikator (`srcDisplay`) unter der Einschlafzeit — nicht mehr `sleepWindowSource`.
- **Neuer `srcInfo`-Eintrag** `fp2_vib`: Icon 📡, Label "FP2 + Vibration".
- Beide `setAuraSleepData`-Aufrufe um `sleepStartSource` und `allSleepStartSources` erweitert.

### 🔧 Offene Baustellen
- Garmin Einschlafzeit in der Praxis evaluieren (Nutzererfahrung: Garmin erkennt ggf. zu spät → ggf. Constraint anpassen)
- Vibrations-Verfeinerung: Schwellwert 20 Min ggf. optimieren (je nach Nutzungsverhalten)
- `fp2_other`, `other`, `vibration_alone` Wake-Kandidaten (derzeit `ts: null`) noch nicht mit echten Timestamps befüllt

### 📌 Operativer Hinweis (gelernte Lektion 23.03.2026 — Workflow-Klarstellung)
- **`main.js` (root) ist die Quelle** — wir bearbeiten sie direkt. Nach jeder Backend-Änderung `src/main.js` syncen: `Copy-Item main.js src\main.js -Force`
- `build:backend:dev` würde `main.js` mit dem älteren `src/main.js` **überschreiben** → NIEMALS nach direkter main.js-Bearbeitung ausführen
- Adapter-Version im UI veraltet? → Push wurde vergessen oder Version nicht gebumpt
- Die Cursor-Regel `deployment-versionbump.mdc` wurde entsprechend aktualisiert

### 🎯 Nächster logischer Schritt
- Nach nächster Nacht Snapshot prüfen: `sleepStartSource`, `allSleepStartSources` im Debug-JSON kontrollieren
- Retro-Patch-Skript für `sleepStartSource` (analog zum Wake-Retro-Patch) ggf. bereitstellen

---

## 🗓️ Sitzung 23.03.2026 — v0.33.57 — Betriebsmodus-Hinweis (Live statt lokal)

### ✅ Abgeschlossen
- Betriebsrealität festgehalten: Tests und Verifikation erfolgen **nicht lokal**, sondern über GitHub-Deployment direkt auf produktiven ioBroker-Systemen (eigenes System + Kundensysteme).
- Für Einmal-/Retro-Skripte (z. B. History-Patch) muss der Datenpfad **adapter- bzw. systemrelativ** ermittelt werden (keine hartkodierten lokalen Pfade wie `C:/ioBroker/iobroker-data`).

### 🔧 Offene Baustellen
- Vorhandene Hilfsskripte auf automatische DataDir-Erkennung standardisieren.

### 🎯 Nächster logischer Schritt
- Bei den nächsten Diagnoseskripten immer zuerst DataDir-Fallbacks + Auto-Detection einbauen, damit Copy&Paste auf Kundensystemen sofort funktioniert.

---

## 🗓️ Sitzung 23.03.2026 — v0.33.57 — Garmin Wake-Priorität + allWakeSources + Dev-Tooltip

### ✅ Abgeschlossen

**Backend (`main.js`):**
- **Garmin-Wake-Override implementiert (war bisher nur dokumentiert, nicht umgesetzt):**
  - `sleepEndTimestampGMT` wird nach den FP2/Motion-Berechnungen gelesen und als finale Aufwachzeit gesetzt, wenn Wert plausibel (03–14 Uhr)
  - Überschreibt `sleepWindowOC7.end` + `sleepWindowCalc.end` → Kachel zeigt Garmin-Zeit
  - Graceful Fallback: bei Lesefehler oder unplausiblem Timestamp → FP2/Motion/Fixfenster wie bisher
  - Auch auf Frozen-Snapshots angewendet (Garmin-Daten kommen oft später als der Save-Lauf)
  - Log: `[Wake] Garmin ueberstimmt: ...` / `[Wake] Garmin-Override auf Frozen Snapshot: ...`
- **Neue Wake-Kandidaten berechnet:**
  - `otherRoomWakeTs`: Erster aktiver Sensor außerhalb Schlafzimmer/Bad nach 04:00 + ≥3h Schlaf (nur Einpersonenhaushalt)
  - `fp2OtherWakeTs`: FP2-Ende UND anderer Raum innerhalb ±15 Min → früherer der beiden
  - `vibAloneWakeTs`: Letztes Vib-Event + ≥45 Min Stille nach 04:00
  - `fixedWakeTs`: 09:00 Uhr am Morgen nach Einschlafen
- **Vollständige Prioritätskette:** Garmin(0) → fp2_other(1) → fp2(2) → other(3) → motion(4) → vibration_alone(5) → fixed(6)
- **`wakeSource` + `wakeConf`** im Snapshot gespeichert
- **`allWakeSources`**: Array mit allen 8 Quellen + jeweiligem Timestamp ins Snapshot geschrieben

**Frontend (`HealthTab.tsx`):**
- `allWakeSources` in beide `setAuraSleepData`-Aufrufe aufgenommen
- `srcInfo` erweitert: `vibration_alone` hinzugefügt, Labels präzisiert (z.B. „Vibrationssensor (Bestätigung)")
- **DEV-Tooltip** auf Aufwachzeit: kleines oranges `⚙ Quellen`-Label, beim Hover alle 8 Quellen mit Timestamp und Markierung der aktiven Quelle
  - Kommentar `/* DEV-ONLY: Quellen-Tooltip alle 8 Wake-Sensoren — später entfernen */` gesetzt

### 🔧 Bekannte Einschränkungen
- Garmin-History wird nicht aufgezeichnet (keine History-Instanz für Garmin-States) → kein Verlauf, nur Live-Wert
- `vibration` (Bestätigung) hat noch keinen eigenständigen Timestamp in `allWakeSources` (`ts: null`)
- Dev-Tooltip muss später manuell entfernt werden (ist aber klar markiert)

### ⚠️ Bekannter Retro-Patch-Fehler (erste Version, behoben)
- Erster Retro-Patch hat fälschlicherweise BEIDE Werte gepatcht (`sleepWindowStart` + `sleepWindowEnd`) auf Garmin-Werte
- Folge: `sleepStages` und `outsideBedEvents` im Snapshot hatten noch alte FP2-Timestamps → Zeitbalken + Tooltips falsch
- **Gelernte Lektion:** Retro-Patch darf nur `sleepWindowEnd` + `wakeSource/wakeConf` patchen — `sleepWindowStart`, `sleepStages` und `outsideBedEvents` müssen UNVERÄNDERT bleiben
- Korrigiertes Script (v2) bereitgestellt: patcht nur Ende + Quellen-Felder

### 🎯 Nächste Schritte
- Nächste Nacht abwarten: Kachel sollte jetzt Garmin-Zeit (06:16 statt 07:17) zeigen
- Dev-Tooltip in einer späteren Sitzung entfernen wenn nicht mehr benötigt
- OC-10: Sleep-Score Wochenansicht
- Garmin für Einschlafzeit: Erfahrung zeigt dass Garmin hier unzuverlässig ist (zu späte Erkennung) → erst nach weiterer Auswertung aktivieren

---

## 🗓️ Sitzung 22.03.2026 — Version 0.33.56 (Legacy-Architektur integriert)

### ✅ Abgeschlossen
- Wiedergefundene Altdatei `C:\Users\MarcJaeger\Downloads\ARCHITEKTUR.md` inhaltlich mit `_internal/ARCHITEKTUR.md` abgeglichen
- Fehlende, weiterhin gueltige Architekturbausteine als neues Kapitel **10 "Legacy-Erkenntnisse aus wiedergefundener Architekturdatei"** uebernommen:
  - FP2-Zwei-Ebenen-Logik (`isFP2Living` vs. `isFP2Bed`)
  - Krankheitsprofile-Architektur inkl. `None`-statt-`0`-Regel bei fehlenden Sensoren
  - Reverse-Screening-Layer (`compute_screening_hints`, Confidence, Disclaimer)
  - Frontend-Betriebsrealitaet (Hardcoded I18n, manueller Save-Button, Hard-Reload)
  - Infrasound als pausierte Architekturspur (mit Reaktivierungsbedingungen)

### 🎯 Naechster logischer Schritt
- Bei naechster Doku-Runde Kapitel 9/10 inhaltlich weiter verdichten (Trennung Architektur vs. Implementierungsdetails)

---

## 🗓️ Sitzung 22.03.2026 — Version 0.33.56 (Architektur-Dokumentation)

### ✅ Abgeschlossen
- `_internal/ARCHITEKTUR.md` um neuen Abschnitt **9 "Historisch gelernte Design-Entscheidungen"** erweitert
- Aus OneNote-Entwicklungshistorie (Sprint 1–84) wurden 13 architekturrelevante Erkenntnisse extrahiert, die noch nicht dokumentiert waren:
  - **9.1** Obfuscator-sichere Bracket-Notation (`this['method']()`) + Standalone-Funktionen
  - **9.2** Gateway-Pattern für Python-Bridge (`normalizeRoomId()`)
  - **9.3** State-Aware Event Filtering (Gatekeeper-Logik für Cold-Start-Geister)
  - **9.4** Dual-Layer Automation (Reaktiv vs. Prädiktiv getrennt halten)
  - **9.5** Observer-Pattern für Energy (kein Polling, Event-Driven)
  - **9.6** Type-Safe Feature Selection für Butler (nur Aktoren als Ziele)
  - **9.7** Physics Sanity Caps im EnergyBrain (+0.1 bis +8.0 °C/h Heizen, max −2.5 °C/h Kühlen)
  - **9.8** Adaptive Security Hybrid-Ensemble + Veto-Prinzip (Party vs. Urlaub)
  - **9.9** ACK-Flag-Regel (Sensor-States NIEMALS nach ack filtern)
  - **9.10** todayEvents-Buffer-Bug (saveDailyHistory muss auf startOfDay filtern)
  - **9.11** Midnight-Boundary beim Schlaf-Radar (Dual-File-Loading für 22:00–08:00)
  - **9.12** STB/LTB Dual-Baseline — der Anker-Mechanismus gegen schleichenden Drift
  - **9.13** Edge Computing für Infraschall-Sensor (ESP32/BMP390, Filter-Kaskade)

### 🎯 Nächster logischer Schritt
- Keine offenen Code-Aufgaben aus dieser Sitzung (reine Dokumentation)

---

## 🗓️ Sitzung 22.03.2026 — Version 0.33.56 (Nachtrag)

### ✅ Abgeschlossen (Nachtrag)

**Architektur-Dokumentation erstellt:**
- `_internal/ARCHITEKTUR.md` (NEU) — lebendes Architekturdokument mit 4 Mermaid-Diagrammen:
  1. System-Überblick (alle 7 Schichten von Sensor bis UI)
  2. Algorithmen × Säulen (welcher Algorithmus dient welcher Säule + Überlappungen)
  3. Kritische Abhängigkeiten (was bricht wenn X kaputt geht)
  4. Technologie-Stack-Tabellen (Node.js, Python, Gemini, Hardware)
  + 3 Datenadern-Beschreibungen (eventHistory, LTM, JSON-Snapshots)
  + Sensor-Typen-Matrix + Modulabhängigkeits-Übersicht
- Dokument wächst mit jeder Sitzung mit

---

## 🗓️ Sitzung 22.03.2026 — Version 0.33.56

### ✅ Abgeschlossen

**Wearable-Konfiguration (Garmin / Smartwatch) in Sensor-Einstellungen:**
- `SensorList.tsx`: Neues ausklappbares Panel "Wearable-Datenquellen (Smartwatch / Garmin)" unterhalb der Sensor-Buttons
  - 7 konfigurierbare Felder: Sleep-Score, Schlafbeginn (GMT-ms), Schlafende (GMT-ms), Tiefschlaf (Sek.), Leichtschlaf (Sek.), REM-Schlaf (Sek.), **Letzter Sync** (neu)
  - Jedes Feld hat einen "Testen"-Button, der live prüft ob das ioBroker-Objekt erreichbar ist (grün/rot)
  - Das Feld "Letzter Sync" zeigt Freshness-Chip in der Titelzeile (frisch / veraltet / eingefroren)
  - Hinweis auf Kompatibilität mit anderen Smartwatch-Adaptern (Polar, Withings, Fitbit…)
- `Settings.tsx`: `native`, `onNativeChange`, `socket` Props an SensorList übergeben
- `io-package.json`: Neue nativeDefaults: `garminSleepStartStateId`, `garminSleepEndStateId`, `garminLastSyncStateId`
- `main.js`: Garmin Freshness-Check nach dem Start/End-Lesen: liest `garminLastSyncStateId` und prüft ob Timestamp < 12h alt → setzt `_garminDataFresh` + `_garminLastSyncAgeH` → Log-Warning bei veralteten Daten → Felder in Snapshot + Debug-State
- `HealthTab.tsx`: Freshness-Banner auf Schlafanalyse-Kachel: orangener Warnhinweis wenn `garminDataFresh === false` (mit Alter in Stunden)

### 🔧 Offene Baustellen
- Polar / Withings / Fitbit: eigene Adapter-Pfade noch nicht dokumentiert (Nutzer muss manuell eintragen)
- `garminLastSyncStateId` hat kein Beispiel-Default — Nutzer muss das richtige Sync-Objekt selbst herausfinden

### 🎯 Nächster logischer Schritt
- OC-12 aus BRAINSTORMING umsetzen: Sensor-Liefernachweis über `available`/`battery`-Objekte
- Ersten echten Garmin-Freshness-Test mit realen Daten verifizieren

---

## 📋 Permanente Arbeitsregeln für den AI-Assistenten

> Diese Regeln gelten in **jeder Sitzung** und müssen nach jedem Kontext-Reset erneut beachtet werden.

### Dokumentationspflicht nach jeder Code-Änderung

**1. PROJEKT_STATUS.md** — `_internal/PROJEKT_STATUS.md`
- **Append-only:** Niemals alte Sitzungsblöcke löschen oder überschreiben
- Neue Sitzung als Block **oben** einfügen (nach diesem Regelblock)
- Dient als vollständiges, kumulatives Gedächtnis über alle Kontext-Resets hinweg

**2. HANDBUCH.md** — `_internal/HANDBUCH.md`
- **Immer aktuell halten:** Bei Code-Änderungen die betroffenen Abschnitte **überschreiben**, nicht ergänzen
- Das Handbuch soll immer den **aktuellen Stand** widerspiegeln — kein Changelog, keine veralteten Beschreibungen
- Sprache: **laientauglich und verständlich** — so geschrieben dass auch ein nicht-technischer Nutzer versteht wie eine Funktion arbeitet und warum
- Nach jeder Sitzung mit Code-Änderungen prüfen: Welche Handbuch-Abschnitte beschreiben das geänderte Feature? → Direkt dort den Text ersetzen.

**Kurzregel:** PROJEKT_STATUS = Protokoll (ergänzen). HANDBUCH = Anleitung (aktuell halten).

### Wissenschaftlicher Anspruch — „Über den Tellerrand schauen"

> Diese Regel gilt in **jeder Sitzung** und bei **jedem neuen Feature oder Algorithmus**.

AURA soll langfristig als Medizinprodukt zugelassen werden. Der Nutzer ist **promovierter Ingenieur Biomedizinische Technik**. Daher gilt:

- Bei neuen Health-Features (Schlaf, Ganganalyse, Tremor, Nykturie etc.) **aktiv nach aktuellen Publikationen** und Leitlinien schauen (PubMed, Google Scholar, aktuelle Guidelines).
- Algorithmen sollen **wissenschaftlich fundiert** sein — nicht nur heuristisch. Wenn eine evidenzbasierte Schwelle existiert (z. B. „>2 Nykturie-Ereignisse = klinisch relevant"), diese verwenden und belegen.
- **Quellen im HANDBUCH.md dokumentieren** — Algorithmus-Abschnitte enthalten Literaturverweise.
- Eigene Ideen des Nutzers kritisch hinterfragen und mit Forschungsstand abgleichen.
- Neue Erkenntnisse aus Literatur als Verbesserungsvorschläge einbringen — proaktiv, nicht nur reaktiv.

---

## 🗓️ Sitzung 22.03.2026 — v0.33.55 — OC-7 Wake-Detection Overhaul + Tiefschlaf-Fix + TESTING.md

### ✅ Abgeschlossen

**Backend (`main.js`):**
- **Tiefschlaf-Bug fix:** `consecutiveQuiet >= 2 → 'deep'` war falsch; jetzt erst ab ≥6 ruhigen Slots (30 Min) → Tiefschlaf. Vorher: Nächte ohne Vibrationsdaten → immer Score 100 + alles Tiefschlaf.
- **`wakeTs = emptyStart`** statt `Date.now()`: Aufwachzeit entspricht jetzt dem echten Zeitpunkt des Bett-Leere, nicht dem Berechnungszeitpunkt.
- **Debounce Bett-machen:** Reoccupancy < 5 Min nach Bett-leer wird ignoriert (Bett machen, kurzes Hinsetzen).
- **Mehrfaches Aufwachen:** Letztes valides Ende wird gespeichert (kein `break`) — Toiletten-Zwischenstopp verursacht nicht mehr falsche frühe Aufwachzeit.
- **Multi-Sensor Wake-Kandidaten:** t_garmin (Stufe 0), t_fp2_other (Kombination), t_fp2, t_other (Single-Person-Guard + personTag-Bad), t_bed_pir, t_vib (Bestätigung) — beste Quelle gewinnt mit Konfidenz-Level.
- **Garmin-Timestamps Stufe 0:** `sleepStartTimestampGMT` und `sleepEndTimestampGMT` werden gelesen. Garmin-Uhr überstimmt alle anderen Quellen wenn plausibel.
- **Einschlafzeit-Quellen:** Garmin → FP2 → Bewegungsmelder → Fixfenster (neue `_sleepStartSource`).
- **`_stageFrozen`** getrennt von `_sleepFrozen`: Wenn Snapshot eingefroren aber Stages leer (Sensor-Ausfall) → Stages werden NEU berechnet; Zeitfenster bleibt eingefroren.
- **Nap-Erkennung:** Einschlafzeit 03–19 Uhr → `isNap = true`, keine OC-7-Stages.
- **Ungewöhnliche Liegezeit:** > 12h → `unusuallyLongSleep = true`.
- **Snapshot:** Neue Felder `wakeSource`, `wakeConf`, `isNap`, `unusuallyLongSleep`.

**Frontend (`HealthTab.tsx`):**
- **Datum der Nacht:** Klein unter Score-Badge: „Nacht vom 21.03. auf 22.03.2026".
- **Sensor-Indikator Aufwachzeit:** Jetzt `wakeDisplay` (aus `wakeSource`) statt `srcDisplay` (Einschlafzeit-Quelle) — getrennte Anzeige.
- **Neue Icons:** ⌚ Garmin-Uhr, 📡 FP2 + Raum, 🚶 Anderer Raum.
- **Hinweise:** Nickerchen ⭒ und ⚠ Ungewöhnlich lange Liegezeit in Kachel.
- **Beide `setAuraSleepData`-Aufrufe** um neue Felder erweitert.

**Dokumentation:**
- `_internal/TESTING.md` NEU: Vollständige manuelle Test-Checkliste (6 Testbereiche, 37 Testfälle) mit MDR-Perspektive.
- `_internal/HANDBUCH.md`: Neuer Abschnitt „Algorithmus-Dokumentation Schlafanalyse" mit Graceful-Degradation-Tabellen.
- `_internal/BRAINSTORMING.md`: OC-12 (Sensor-Liefernachweis) + OC-13 (Schichtarbeiter) eingefügt.
- `_internal/PROJEKT_STATUS.md`: Arbeitsregel „Über den Tellerrand / Publikationen" in permanente Regeln aufgenommen.

### 🔧 Bekannte Einschränkungen
- Garmin-Timestamps: Nur wenn Garmin-Adapter installiert und State-Pfade korrekt. Graceful Fallback bei Fehler.
- `t_other` (anderer Raum): Nur bei `maxPersonsDetected <= 1` aktiv — Mehrpersonenhaushalt schützt gegen Fehlzuweisung.
- Stages nach WINDOW-FROZEN-Recomputation: abhängig davon, ob Vibrations-Events noch in `eventHistory` vorhanden (RAM-Limit).

### 🎯 Nächste Schritte
- OC-10: Sleep-Score Wochenansicht
- OC-12: Sensor-Liefernachweis / Gateway-Offline-Erkennung verbessern
- TESTING.md: Erste Testergebnisse nach dieser Version eintragen

---

## 🗓️ Sitzung 21.03.2026 — v0.33.54 — sleepWindowMotion Wake-Detection + nocturiaCount OC7

### ✅ Abgeschlossen

**Backend (main.js):**
- `sleepWindowMotion.end` (Aufwachzeit): Neue 2-stufige Methode
  - **Methode 1 (primär):** Aktivität in anderen Räumen (nicht Schlafzimmer, nicht Bad, nicht FP2Bed, nicht Vibration) nach 04:00 + ≥3h seit Einschlafzeit → zuverlässigstes "aufgestanden"-Signal
  - **Methode 2 (Fallback):** Schlafzimmer-Motion + ≥20 Min keine weitere Bewegung nach 04:00 + ≥3h
  - Debug-Log zeigt welche Methode genutzt wurde (otherRooms / bedroomFallback / none)
- `nocturiaCount` nutzt jetzt `sleepWindowOC7` statt `sleepWindowCalc`
  - Vorher: nur FP2 → Fallback Fixfenster 22–06 Uhr
  - Jetzt: FP2 → Bewegungsmelder → Fixfenster → Medical Tab profitiert von genauerer Nykturie-Zählung

### 🎯 Scope der Änderungen
- Betrifft OC-7 direkt (sleepStages, sleepScore, outsideBedEvents, sleepWindowStart/End im Snapshot)
- Betrifft Medical Tab indirekt über nocturiaCount (Python health.py Drift-Analyse, Nykturie-Kachel)
- NICHT betroffen: bedPresenceMinutes (FP2-only), OC-4 Guard, Dead-Man-Switch

---

## 🗓️ Sitzung 21.03.2026 — v0.33.53 — OC-7 Bewegungsmelder-Fallback

### ✅ Abgeschlossen

**Backend:**
- `lib/recorder.js`: Neues Flag `isBedroomMotion = (type === 'motion') && (sensorFunction === 'bed')` im Event-Objekt
- `main.js`: Neues `sensorListData`-Feld `isBedroomMotion` im sensorList-Debug-Objekt
- `main.js`: Neue Funktion `sleepWindowMotion` — berechnet Einschlaf-/Aufwachzeit aus Schlafzimmer-Bewegungsmelder wenn kein FP2 vorhanden:
  - **Einschlafzeit** = letztes Motion-Event zwischen 18:00–03:00 Uhr, das von ≥45 Min Stille gefolgt wird
  - **Aufwachzeit** = erste Bewegung nach 04:00 Uhr, die ≥3h nach Einschlafzeit liegt
- `main.js`: Fallback-Kette `sleepWindowOC7`: **FP2 → Bewegungsmelder → Fixfenster (20–09)**
- `main.js`: `sleepWindowSource` = `'fp2'` | `'motion'` | `'fixed'` (korrekte Reihenfolge)

**Frontend (`Help.tsx`):**
- Abschnitt 8 (Schlafanalyse OC-7): Graceful-Degradation-Tabelle um Bewegungsmelder-Stufe ergänzt
- Sensor-Indikator-Legende: `🚶 Bewegungsmelder` hinzugefügt
- Wichtiger Hinweis: `sensorFunction: bed` muss gesetzt werden damit Bewegungsmelder erkannt wird

**Dokumentation (`HANDBUCH.md`):**
- Graceful-Degradation-Tabelle: 5 Stufen mit Spalten Indikator/Einschlafzeit/Aufwachzeit/Phasen/Events
- Algorithmus-Beschreibung für Bewegungsmelder-Fallback (Vor-/Nachteile vs. FP2)
- Vollständige Help.tsx-Texte 1:1 übernommen (alle 8 Abschnitte)

### 🔧 Bekannte Einschränkungen des Bewegungsmelder-Fallbacks
- Kurze nächtliche Toilettengänge können die Aufwachzeit verschieben (da erste Bewegung >04:00 Uhr)
- Keine Außerhalb-Bett-Events möglich (nur FP2 kann Bett-Leer/Belegt unterscheiden)
- Kein OC-4 Guard (bedPresenceMinutes bleibt FP2-exklusiv)
- Sensor muss in der Sensor-Liste auf `sensorFunction: bed` (lila) gesetzt sein

### 🎯 Nächste Schritte
- OC-10: Sleep-Score Wochenansicht
- Help.tsx: GANGGESCHWINDIGKEIT und DIAGNOSE & VITALITÄT dokumentieren

---

## 🗓️ Sitzung 21.03.2026 — v0.33.52 — OC-7 Bugfixes + Dokumentation

### ✅ Abgeschlossen

**Backend (`main.js`):**
- `sleepScoreRaw` ins Snapshot: ungekappter AURA-Sleepscore (kann >100 sein) für spätere Wochenansicht/Kalibrierung
- Score-Berechnung: Bonus (+5 bei 7–9h Schlaf) jetzt VOR der Kappung angewendet, damit Rohwert stimmt

**Frontend (`HealthTab.tsx`):**
- Sensor-Indikator (`📡 FP2-Sensor` / `⏰ Schätzung`) jetzt auch unter **Aufwachzeit** sichtbar
- Hover-Tooltip auf Aufwachzeit erklärt Bestätigungs-Regel: "Bett ≥1h leer nach 10:00 Uhr"

**Frontend (`Help.tsx` — In-App Handbuch):**
- Neuer Abschnitt **8. Schlafanalyse (OC-7)**: AURA-Sleepscore-Formel, Sensor-Levels, Farbkonzept, Sleep-Freeze, Sensor-Indikatoren

**Dokumentation (`_internal/HANDBUCH.md`):**
- Neuer Abschnitt "Frontend-Kacheln Inventar": vollständige Tabelle aller Kacheln, Tooltip-Status (✅/⚠️), Inhaltsbeschreibung
- Übersicht Was in Help.tsx dokumentiert ist, was noch fehlt (TODO-Liste)

### 🔧 Offene Baustellen
- Bad-Besuch / Dreiecks-Marker erscheinen erst ab nächster Nacht (heute noch kein FP2-outsideBedEvents im Snapshot wegen Freeze)
- Kacheln ohne Tooltip: RAUM-NUTZUNG, AKTIVITÄTS-HEATMAP, 30/7-TAGE-ÜBERSICHT, NÄCHTLICHE AKTIVITÄT
- Help.tsx: GANGGESCHWINDIGKEIT und DIAGNOSE & VITALITÄT noch nicht dokumentiert

### 🎯 Nächster logischer Schritt
- OC-10: Sleep-Score Wochenansicht
- Fehlende Tooltips nachrüsten (RAUM-NUTZUNG, Heatmap)

---

---

## 🗓️ Sitzung 21.03.2026 — v0.33.51 — OC-7 Schlafbalken Overhaul

### ✅ Abgeschlossen

**Backend (`main.js` / `src/main.js`):**
- `_origFP2Window` vor Freeze-Block gespeichert (damit Quelle korrekt erhalten bleibt)
- `sleepWindowSource` ins Snapshot: `'fp2'` wenn FP2 Fenster erkannte, sonst `'fixed'`
- `outsideBedEvents` ins Snapshot: Array aus `{start, end, duration, type}` — berechnet aus FP2-Events während Schlaffenster (typ: `'bathroom'` wenn Bad-Sensor feuerte, sonst `'outside'`)
- `wakeConfirmed: boolean` ins Snapshot: `true` wenn ≥ 10:00 Uhr + ≥1h seit Aufwachzeit

**Frontend (`HealthTab.tsx`):**
- Beide `setAuraSleepData`-Aufrufe um `sleepWindowSource`, `outsideBedEvents`, `wakeConfirmed` erweitert
- `renderSleepScoreCard()` komplett überarbeitet:
  - **AURA-Sleepscore** statt "AURA Score"
  - **Sensor-Indikator** unter Einschlafzeit: `📡 FP2-Sensor` / `🚶 Bewegungsmelder` / `📳 Vibrationssensor` / `⏰ Schätzung`
  - **Aufwachzeit vorläufig/final**: `⟳ 07:00 (vorläufig)` in Orange vs `✓ 07:00 (bestätigt)` in Grau
  - **Wach-Farbe**: Gelb `#ffd54f` (statt Rot — Wach im Bett ist milde Störung)
  - **Außerhalb-Overlay**: Slots während outsideBedEvents werden farbig überschrieben (Bernstein `#ffb300` = Bad, Orange-Rot `#ff5722` = Außerhalb)
  - **Dreiecks-Marker ▼** über Balken: Gelb = Bad-Besuch, Rot = Abwesenheit ≥ 20 min
  - **Legende** dynamisch: Bad/Außerhalb nur wenn events vorhanden
  - **Außerhalb-Zeile**: Anzeige Bad- und Außerhalb-Zeit unterhalb Stage-Grid
  - **helpText**: vollständige Formel-Erklärung, wissenschaftliche Quellen, Sensor-Indikator-Erklärung, Farbkonzept

**Dokumentation:**
- `_internal/HANDBUCH.md` erstellt: Algorithmus-Dokumentation, Formel + Quellen, Farbkonzept, Sensor-Fusion, Sensor-Strategie-Tabelle, Literaturverzeichnis
- `_internal/BRAINSTORMING.md`: OC-9 (Score-Entkappung) + OC-10 (Wochenansicht) eingefügt

### 🔧 Offene Baustellen
- `outsideBedEvents` benötigt FP2-Sensor — ohne FP2 bleibt Array leer (kein Balken-Overlay)
- `sleepWindowSource: 'motion'` noch nicht implementiert (nur `'fp2'` und `'fixed'`)
- `wakeConfirmed` wird nur zur Laufzeit berechnet — historische Snapshots bleiben evtl. `false`

### 🎯 Nächster logischer Schritt
- OC-10: Sleep-Score Wochenansicht im Frontend
- OC-9: Score > 100 als Rohdaten-Option
- HANDBUCH.md: Handbuch-Tab im Admin-Interface synchron halten

---

## 🗓️ Sitzung 20.03.2026 — v0.33.50 — Sleep-Freeze + Wake-Time-Bug

### ✅ Abgeschlossen
- **Sleep-Freeze-Mechanismus**: `saveDailyHistory()` liest vor der Schlaf-Berechnung das bestehende Snapshot-File. Wenn `sleepWindowEnd < 14:00` und `bedPresenceMinutes >= 180` → Schlafdaten (start, end, stages, score) werden eingefroren und NICHT überschrieben — auch nicht durch Abendaktivität oder Nachmittagsschlaf.
- **Wake-Time-Bug gefixt**: Aufwachzeit-Erkennung war `_whr >= 4 || _whr < 12` (= alle Uhrzeiten!). Korrigiert zu `_whr >= 4 && _whr <= 14` (nur 04:00–14:00 Uhr gültig).
- **Freeze-Log**: Bei eingefrorenem Schlaf erscheint im ioBroker-Log: `[History] Sleep FROZEN: 23:28-07:36 bedPresMin=496`

### 🎯 Nächster logischer Schritt
- Nächste Nacht abwarten und verifizieren dass Einschlaf-/Aufwachzeit korrekt erscheinen
- Verifizieren dass abendliche Bettaktivität die Kachel nicht mehr verändert

---

## 🗓️ Sitzung 20.03.2026 — v0.33.49 — OC-7 Zeitbalken mit Uhrzeiten

### ✅ Abgeschlossen
- **Backend `main.js`**: Snapshot speichert jetzt `sleepWindowOC7.start/end` (statt `sleepWindowCalc.start/end`) → Einschlafzeit/Aufwachzeit zeigen auch wenn nur Vibrations-Fallback aktiv
- **Frontend**: Zeitbalken behält `flex:1` pro Stage (= korrekt proportional, jeder Slot = 5 min), aber mit neuer Zeitachse darunter
- **Zeitachse**: Zeigt Start-Uhrzeit (links), volle Stunden in der Mitte, End-Uhrzeit (rechts) — aus `swStart + stage.t * 60000` berechnet
- **Tooltips**: Hover über Stage-Block zeigt Uhrzeit + Schlafphase (z.B. "23:35 — Tief")
- **Einschlafzeit/Aufwachzeit**: Werden aus `sleepWindowOC7.start/end` korrekt befüllt

### 🎯 Nächster logischer Schritt
- Nächste `saveDailyHistory`-Ausführung abwarten → Datei enthält dann OC7-Fenster korrekt
- AUFFAELLIGKEITEN.md Punkt "Schlafzeit x-Achse" prüfen ob damit erledigt

---

## 🗓️ Sitzung 20.03.2026 — v0.33.48 — OC-7 Bug-Fix (Root Cause gefunden)

### ✅ Abgeschlossen
- **Root Cause OC-7**: `fetchData()` (Live/Heute-Modus) hat niemals `_auraSleepData` gesetzt — nur `loadHistory()` für vergangene Tage tat das. OC-7 war im Live-Modus strukturell blind.
- **Fix 1**: `auraSleepData` von globalem `window._auraSleepData` (Anti-Pattern) auf echten React-State `useState<any>(null)` umgestellt → React rendert jetzt korrekt nach Dateneingang
- **Fix 2**: In `fetchData()` am Ende neuen `getHistoryData`-Call für HEUTE ergänzt → setzt `auraSleepData` via `setAuraSleepData()` auch im Live-Modus
- **Fix 3**: `renderSleepScoreCard()` liest jetzt aus React-State `auraSleepData` statt aus `window._auraSleepData`
- **Fix 4**: `loadHistory()` nutzt ebenfalls `setAuraSleepData()` statt `window`-Global

### 🎯 Nächster logischer Schritt
- Nach Update in ioBroker: OC-7-Kachel sollte sofort Daten zeigen (sleepStages=98, score=100)
- Warte auf Bestätigung vom Kunden

---

## 🗓️ Sitzung 20.03.2026 — v0.33.47 — OC-7 Diagnose-State

### ✅ Abgeschlossen
- **main.js**: Neuer State `analysis.health.saveDailyDebug` wird bei jedem `saveDailyHistory()`-Lauf (stündlich + 23:59) geschrieben
- Enthält: `timestamp`, `dateStr`, `eventHistoryCount`, `todayEventsCount`, `sleepSearchEventsCount`, `vibrationBedEventsTotal`, `fp2BedEventsTotal`, `bedPresenceMinutes`, `sleepWindowCalcStart/End`, `sleepWindowOC7Start/End`, `sleepStagesCount`, `sleepScore`, `oc4GuardFired`
- Zusätzlich: Info-Log `[OC-7 Debug] stages=X windowOC7=Y bedPresMin=Z vibBedEvts=W` im ioBroker-Log

### 🔧 Offenes Problem (OC-7 zeigt "Heute Nacht werden die ersten Daten gesammelt")
- Problem besteht seit Einführung OC-7 am 17.03.2026 (v0.33.29) — hat NIE funktioniert
- Ursache unklar: Produktion läuft auf Kundensystem, kein direkter Zugriff
- Mit v0.33.47 kann nach dem Update folgendes geprüft werden:
  1. In ioBroker Admin → Objekte → cogni-living.0 → analysis → health → saveDailyDebug: JSON-Wert lesen
  2. Wenn `sleepStagesCount = 0`: `sleepWindowOC7Start` ist NULL → `saveDailyHistory()` läuft zwischen 18:00-20:00
  3. Wenn `sleepStagesCount > 0` aber Kachel zeigt Leer-State: `getHistoryData` findet die Datei nicht (Pfad-Problem)
  4. Wenn State gar nicht existiert: `saveDailyHistory()` wirft Fehler vor dieser Stelle (ioBroker Log prüfen!)

### 🎯 Nächster logischer Schritt
- Nach nächstem stündlichen Save: `analysis.health.saveDailyDebug` in ioBroker Admin prüfen
- Werte auswerten und dann gezielten Fix entwickeln

---

## 🗓️ Sitzung 19.03.2026 — v0.33.46 — Vollständige Legacy-Bereinigung aller Sensor-Typ-Werte

### ✅ Abgeschlossen
- **lib/recorder.js**: `validTypes` auf aktuelle SENSOR_TYPES reduziert: `['motion','presence_radar_bool','door','lock','blind','light','dimmer','vibration_trigger','vibration_strength']` — alle Legacy-Werte (bewegung, praesenz, tur, griff, schloss, fenster, kontakt, licht, schalter, lampe, ...) entfernt; `isTemp` auf `'temperature'|'thermostat'` reduziert; `isDoorOrWindow/isLightOrSwitch/isMotion` bereinigt
- **HealthTab.tsx**: 8 `isMotion`-Stellen von `type.includes('bewegung'|'motion'|'presence')` auf `e.type === 'motion' || e.type === 'presence_radar_bool'`; Küchen-/Bad-Erkennung von `evt.name.includes('küche'/'bad')` auf `evt.isKitchenSensor` / `evt.isBathroomSensor`; `isMotion/isDoor/isLight`-Block von Legacy-Array+includes auf exakte current-types
- **LongtermTrendsView.tsx**: `e.type === 'presence'` → `'presence_radar_bool'`; `e.location.includes('schlaf')` → `e.isFP2Bed === true || e.isVibrationBed === true`
- **diseaseProfiles.ts**: `MOTION_TYPES` → `['motion','presence_radar_bool']`; `DOOR_TYPES` → `['door','lock']`; `hasFP2/hasVibrationSensor` auf exakte Typen; `hasNightSensor/hasBathroomSensor/hasKitchenSensor` Keyword-Fallbacks entfernt (Sensorliste ist Master); `normLoc()` entfernt (nicht mehr benötigt)
- **.cursorignore**: `src/` → `/src/` (verhindert versehentliches Blockieren von `src-admin/src/`)
- Frontend-Build: erfolgreich; Backend-Syntax: OK; v0.33.46 gepusht

### 🔧 Noch zu prüfen
- `lib/dead_man.js`: `calculateSleepProbability` und `getTimeoutRobust` nutzen Raumname-Keywords ('schlaf','bad') — vertretbar da nur Timeout-Heuristik, keine medizinischen Werte
- `lib/pwa_server.js`: `BATH_KEYWORDS/SLEEP_KEYWORDS` für AI-Zusammenfassungen — vertretbar da nur Texte/Notifications

### 🎯 Nächster logischer Schritt
- Testen: Kacheln Ganggeschwindigkeit, Küche/Bad, Nykturie weiterhin korrekt?
- AUFFAELLIGKEITEN.md-Punkte angehen (Vibrations-Intensität Y-Achse, Schlafzeit x-Achse)

---

## 🗓️ Sitzung 19.03.2026 — v0.33.45 — Vollständige Bereinigung aller Keyword-Fallbacks

### ✅ Abgeschlossen
- **lib/recorder.js**: `validTypes.some(t => type.includes(t))` → `validTypes.includes(type)` (exakter Match); `isTemp` von `type.includes()` auf `===` umgestellt; `isDoorOrWindow/isLightOrSwitch/isMotion` von `t => type.includes(t)` auf `Array.includes(type)` (exakt)
- **lib/topology.js**: `d.type.toLowerCase().includes('bewegung')` → `d.type === 'bewegung'`
- **lib/automation.js**: `scanThermostats()` entfernt `d.id.includes('temperature')` + `d.name.toLowerCase().includes('temp')` → nur noch `d.type === 'temperature' || d.type === 'thermostat'`
- **lib/main.js + main.js**: `dev.type.includes('window'/'door')` → exakte Typ-Liste (`=== 'window' || 'door' || 'fenster' || 'tur' || 'contact' || 'kontakt'`)
- **main.js + lib/main.js**: `hallwayKw`-Fallback bei Gait-Speed-Berechnung jetzt nur noch aktiv wenn `hallwayConf.length === 0` (kein Flur in Sensorliste konfiguriert)
- **python_service/brains/health.py**: `is_hallway_loc()` nutzt `hallway_keywords` nur noch wenn `hallway_set` leer ist
- Sync via `Copy-Item lib/*.js → src/lib/`, `main.js → src/main.js`
- Syntax-Check: `node --check` für alle geänderten Dateien — alles OK
- v0.33.45 gepusht

### 🔧 Noch nicht bereinigt (Frontend — Permission-Denied-Blockade)
- `src-admin/src/components/tabs/HealthTab.tsx`: `isMotion` mit `e.type.includes()` an 5 Stellen; `evt.name.includes('küche'/'bad')` → sollte `evt.isKitchenSensor`/`evt.isBathroomSensor` nutzen
- `src-admin/src/components/tabs/LongtermTrendsView.tsx` Z.152: `e.location.includes('schlaf')` → sollte `e.isFP2Bed || e.isVibrationBed` nutzen
- `src-admin/src/components/medical/diseaseProfiles.ts`: `MOTION_TYPES/DOOR_TYPES` mit `.includes(k)` Substring-Matching
- `lib/pwa_server.js + lib/dead_man.js`: Raumname-Keywords für Schlaf/Bad-Klassifikation (vertretbar — nur AI-Zusammenfassungen/Notifications)

### 🎯 Nächster logischer Schritt
- Frontend-Keyword-Fixes in `src-admin/` sobald Dateizugriff möglich (Permission-Problem klären)
- Testen ob `scanThermostats()` noch korrekt Thermostaten findet (evtl. fehlende Legacy-Typen prüfen)

---

## 🗓️ Sitzung 19.03.2026 — v0.33.44 — KRITISCHER BUG: "temperature".includes("tur") Falschpositiv

### ✅ Abgeschlossen

#### Ursache (Root Cause)
`isPersonPresenceActivity` und `isRelevantActivity` in `lib/recorder.js` nutzten
`t.includes('tur')` um Tuer/Fenster-Sensoren zu erkennen. Da "tur" ein Substring von
"temperature" ist (`tempe-**tur**-e`), wurden ALLE Temperatursensoren (Heizventile)
faelschlicherweise als Tuer-Sensoren eingestuft und in `sensorLastActive` eingetragen.
Folge: Die Raeumliche-Unmoeglichkeits-Heuristik feuerte dauerhaft falsch (2 Personen).

Zusaetzlich wurden korrekt konfigurierte `typ: "door"` Sensoren von der Heuristik
NICHT erkannt, da `"door".includes("tur")` = false.

#### Fix: t.includes() → exakte === Vergleiche
```javascript
// VORHER (buggy):
const isDoorWin = ['tur', 'fenster'].some(k => t.includes(k));

// NACHHER (korrekt):
const isDoorWin = t === 'door' || t === 'tur' || t === 'fenster' || t === 'window';
```

Beide Funktionen gefixt: `isPersonPresenceActivity` + `isRelevantActivity`.

#### Ergebnis
- "temperature" === 'door'? Nein → Heizventile werden NICHT mehr als Praesenz-Sensor behandelt
- "door" === 'door'? Ja → Tuer/Fensterkontakte werden KORREKT erkannt

#### Gelernte Lektion (WICHTIG fuer zukuenftige Entwicklung)
NIEMALS `t.includes(keyword)` fuer Sensortyp-Vergleiche verwenden!
Immer exakte Vergleiche: `t === 'motion'` etc.
Der Sensortyp kommt aus der konfigurierten Sensorliste (immer exakter String).

---

## 🗓️ Sitzung 19.03.2026 — v0.33.43 — system.config.sensorList Kontroll-Objekt

### ✅ Abgeschlossen
Neues ioBroker-Objekt `cogni-living.0.system.config.sensorList`:
- Typ: string/JSON
- Wird bei JEDEM Adapterstart automatisch mit aktueller Sensor-Konfiguration befuellt
- Enthaelt pro Sensor: `id`, `bezeichnung`, `ort`, `typ`, `funktion`
- Zeigt auch abgeleitete Flags: `isBathroomSensor`, `isKitchenSensor`, `isFP2Bed`, `isVibrationBed`
- In ioBroker Admin → Objekte → cogni-living.0.system.config.sensorList einsehbar
- Dient als Kontroll-Instrument: "Was hat der Adapter wirklich gespeichert?"

---

## 🗓️ Sitzung 19.03.2026 — v0.33.42 — OC-7/Schlafzeit-Karte sauber getrennt

### ✅ Abgeschlossen

#### Problem
v0.33.41 machte `sleepWindowCalc` zu breit: Der Fixed-Window-Fallback (20:00-09:00) wurde
auch in die Schlafzeit-Kachel (Einschlaf-/Aufwachzeit) geschrieben — sichtbar als fest 20:00/09:00.
Nutzer wollte Fixed-Fenster NUR fuer OC-7 Sleep Score, NICHT fuer die Schlafzeit-Anzeige.

#### Loesung: `sleepWindowOC7` als separate Variable
- `sleepWindowCalc` wieder **rein FP2-basiert** (kein Fallback):
  - `bedEvts.length === 0` → `{ start: null, end: null }` → Schlafzeit-Karte leer (korrekt)
  - OC-4 Guard: `!sleepWindowCalc.isFixed` entfernt (war nicht mehr noetig)
- Neues `sleepWindowOC7` nach dem OC-4 Guard:
  - Wenn `sleepWindowCalc.start` vorhanden → FP2-Fenster weiternutzen
  - Sonst → Fixed-Fenster 20:00-09:00 berechnen (same Logik wie v0.33.41)
- OC-7 Berechnung (Slots, sleepScore, sleepStages) nutzt `sleepWindowOC7`
- Snapshot (`sleepWindowStart/End`) nutzt weiterhin `sleepWindowCalc` (FP2-only)

#### Architektur-Prinzip:
| Variable | Treibt | Fallback wenn kein FP2 |
|---|---|---|
| `sleepWindowCalc` | Schlafzeit-Kachel (Einschlafen/Aufwachen) | leer |
| `sleepWindowOC7` | OC-7 Sleep Score + Stages | 20:00-09:00 festes Fenster |

#### OC-7 No Data — Diagnose
Neben der Karten-Architektur: OC-7 zeigt nur dann sinnvolle Stage-Daten wenn
der Vibrationssensor in der Sensorliste mit **Funktion = "bed"** konfiguriert ist.
Nur dann gilt `e.isVibrationBed=true` und die Events landen in `vibDetInWindow`.
Ohne Funktion=bed: alle Slots = 'deep', Score=100 (technisch korrekt, aber flach).

**Pruefpunkt:** In ioBroker Admin → Adapter cogni-living → Tab System → Sensorliste:
- Alias `alias.0.nuukanni.vibration.eg-schlafen-state` → Funktion: **bed** setzen
- Alias `alias.0.nuukanni.vibration.eg-schlafen-staerke` → Funktion: **bed** setzen

### 🎯 Nächster logischer Schritt
- Update-Button ioBroker → v0.33.42
- Vibrationssensor Funktion auf "bed" pruefen (s.o.)
- Nach naechster Nacht: OC-7 sollte echte Schlafphasen zeigen

---

## 🗓️ Sitzung 18.03.2026 — v0.33.41 — OC-7 Sleep Score ohne FP2-Bett-Sensor

### ✅ Abgeschlossen

#### Problem
OC-7 Schlafanalyse zeigte keine Daten weil kein FP2-Bett-Sensor konfiguriert war.
`sleepWindowCalc` lieferte `start=null` → kein Schlaffenster → kein Score.

#### Loesung: Festes Fenster als Fallback
Wenn kein FP2-Bett konfiguriert (`bedEvts.length === 0`):
- Festes Schlaffenster: **20:00 Vorabend bis 09:00 morgens** (13 Stunden)
- Abgeleitet aus `_sleepSearchBase + 2h` → konsistent mit bestehendem Suchfenster
- Laufende Nacht: `fixedEnd = Date.now()` (kein Zukunfts-Timestamp)
- Noch vor 20:00: `start = null`, kein Score berechnet
- `isFixed = true` → OC-4 Guard wird NICHT angewendet
  (ohne FP2 waere bedPresenceMinutes immer 0 und wuerde Score faelschlich verwerfen)

#### Wenn FP2 vorhanden: weiterhin dynamisches Fenster
- `isFixed = false`, OC-4 Guard bleibt aktiv
- FP2 ermoeglicht praezisere Einschlaf-/Aufwachzeit-Erkennung

#### Naechberechnung letzte 2 Naechte (ioBroker JS-Script)
Sensor-IDs:
- vibration_state:    alias.0.nuukanni.vibration.eg-schlafen-state
- vibration_strength: alias.0.nuukanni.vibration.eg-schlafen-staerke

### 🎯 Nächster logischer Schritt
- Update-Button ioBroker → v0.33.41
- JS-Script ausfuehren fuer Nachberechnung 16-17.3 und 17-18.3
- Ab naechster Nacht laeuft die Schlafanalyse automatisch

---

## 🗓️ Sitzung 18.03.2026 — v0.33.40 — isPersonPresenceActivity + sprechende State-IDs

### ✅ Abgeschlossen

#### Problem
- `isRelevantActivity` zu breit: liess auch Licht/Schalter durch -> Automationen konnten Falschpositive in der Personenzahl-Heuristik erzeugen
- State-IDs (personDetectionLog, personSensorLog) waren wenig selbsterklaerend
- Whitelist im personSensorLog-Block war redundant und inkonsistent

#### Neue Funktion: `isPersonPresenceActivity(type, value)` in recorder.js
Strikte Whitelist fuer die Personenzaehl-Heuristik:
- ✅ Bewegungsmelder (motion, presence_radar_bool, bewegung, praesenz, presence, occupancy)
- ✅ Vibrationssensoren (vibration_trigger, vibration_strength)
- ✅ Tuer/Fenster (tur, fenster) — auf konfigurierten Typ-Wert geprueft, nie auf Sensor-ID
- ❌ Licht/Schalter/Dimmer → NICHT enthalten
- ❌ Temperatur/Heizung → NICHT enthalten

#### Architektur-Klarstellung (Wichtig!)
Die Sensor-Liste im Tab System ist der absolute Master. Nirgends im Algorithmus werden
Sensor-IDs oder Bezeichnungen nach Suchwoertern durchsucht. Das Keyword-Matching geschieht
ausschliesslich auf `dev.type` (dem Dropdown-Wert aus der Konfiguration).

#### Neue State-IDs (sprechende Hierarchie)
| Alt | Neu | Bedeutung |
|-----|-----|-----------|
| system.personDetectionLog | system.personCount.heuristicDetection | Heuristik hat mind. 2 Personen erkannt |
| system.personSensorLog    | system.personCount.sensorActivity     | Person-relevanter Sensor hat ausgeloest |

#### Was in ioBroker zu tun ist
1. Update-Button → v0.33.40
2. Alte States `personDetectionLog` und `personSensorLog` manuell loeschen (falls noch vorhanden)
3. SQL-Logging fuer beide neuen States aktivieren:
   - cogni-living.0.system.personCount.sensorActivity
   - cogni-living.0.system.personCount.heuristicDetection

### 🎯 Nächster logischer Schritt
- SQL-Daten sammeln und auswerten ob noch Falschpositive auftreten
- Bei Bedarf Hop-Grenze oder Zeitfenster anpassen

---

## 🗓️ Sitzung 18.03.2026 — v0.33.37 — SQL-Logging für PersonCount-Heuristik

### ✅ Abgeschlossen

#### Problem
Anzeige "2 Personen" erschien ohne erkennbaren Grund. Keine Möglichkeit nachzuvollziehen
welcher Sensor wann die räumliche Unmöglichkeitsheuristik ausgelöst hat.

#### Lösung: Neuer State `system.personCountLog`
- Neuer ioBroker-State vom Typ `string` / Rolle `json`
- Wird bei **jeder** Auslösung der Heuristik geschrieben (nicht nur bei Zähler-Wechsel)
- Jeder Wert-Wechsel wird vom SQL-Adapter automatisch in der DB geloggt

#### Inhalt des JSON-Eintrags
```json
{
  "ts": 1742332644311,
  "triggerSensorId":   "zigbee.0.aabbcc.state",
  "triggerSensorName": "Bewegungsmelder DG Zimmer",
  "triggerRoom":       "DG Zimmer",
  "otherSensorId":     "zigbee.0.ddeeff.state",
  "otherSensorName":   "Bewegungsmelder UG Bad",
  "otherRoom":         "UG Bad",
  "hops":              7,
  "deltaMs":           4716,
  "personCountBefore": 1,
  "personCountAfter":  2
}
```

#### Einrichtung in ioBroker (einmalig)
1. Nach Adapter-Update erscheint State `cogni-living.0.system.personCountLog` automatisch
2. Im SQL-Adapter: Objekte → `cogni-living.0.system.personCountLog` → Logging aktivieren
3. In MySQL/MariaDB: Tabelle `ts_string` enthält alle Einträge mit Timestamp

#### Code-Änderungen
- `main.js` Zeile ~134: `setObjectNotExistsAsync('system.personCountLog', ...)` hinzugefügt
- `main.js` `_checkSpatialImpossibility()`: `bestMatch`-Objekt aufgebaut und als JSON in State geschrieben
- Bester Treffer = Sensor-Paar mit den **meisten Hops** (zuverlässigste Erkennung)

### 🔧 Offene Baustellen
- Falschpositive analysieren sobald SQL-Daten vorliegen
- Ggf. MIN_HOPS anpassen falls zu viele false positives

### 🎯 Nächster logischer Schritt
- In ioBroker: SQL-Logging für `system.personCountLog` aktivieren
- Update-Button im Admin klicken (Version 0.33.37)
- Nächste Auslösung beobachten und JSON-Inhalt prüfen

---

## 🗓️ Sitzung 18.03.2026 — v0.33.36 — presence_radar_count vollständig entfernt

### ✅ Abgeschlossen

#### Hintergrund
FP2-Sensor übergibt in ioBroker nur 0/1 (true/false), keine echte Personenzahl. Der Typ `presence_radar_count` hatte daher nie eine Funktion und wurde vollständig entfernt.

**`src-admin/src/components/settings/SensorList.tsx` (Frontend):**
- `presence_radar_count` aus dem `SENSOR_TYPES`-Dropdown entfernt
- Sonderfallbehandlung in `getFunctionsForType()` entfernt (`if type === 'presence_radar_count'`)
- Label-Sonderzeichen (◆) in allen Sensor-Labels bereinigt:
  `"Praesenz-Radar (Anwesenheit)"`, `"Vibration (Erkannt)"`, `"Vibration (Staerke)"`
- Wohnzimmer-Beschreibung aktualisiert: `"Personenzaehlung (FP2), ..."` → `"Sozialisierungs-Analyse"`
- Frontend-Build neu gebaut (`npm run build:react`)

**`lib/recorder.js` (Backend):**
- `isRelevantActivity()`: `presence_radar_count`-Branch entfernt (war redundant, toPersonCount(value) > 0 für einen Sensor ohne Zählwert)
- `isFP2Bed`-Flag: `|| _typeLC === 'presence_radar_count'` entfernt (nur noch `presence_radar_bool`)
- `isFP2Living`-Flag: dto.
- `toPersonCount`-Kommentar aktualisiert (Funktion bleibt für vibration_strength)

**`main.js` (Backend):**
- Veralteter Kommentar `// presence_radar_count: ID zeigt direkt auf den Personenzahl-State...` entfernt

### 🎯 Empfehlung für Sensor-Konfiguration
| Sensor | Typ | Sensorfunction |
|--------|-----|---------------|
| FP2 Wohnzimmer | **Bewegung** | beliebig |
| FP2 Schlafzimmer (Bett-Erkennung) | **Präsenz-Radar (Anwesenheit)** | **Bett** |
| Alle anderen Bewegungsmelder | Bewegung | beliebig |

### 🎯 Nächster logischer Schritt
- Adapter updaten (git push → Update in ioBroker)
- FP2-Sensoren in Adapter-Config auf korrekten Typ umstellen (s. Tabelle oben)
- Topologie-Matrix prüfen: Flure als Bindeglieder eingetragen?

---

## 🗓️ Sitzung 18.03.2026 — v0.33.35 — PersonCount: BFS-Heuristik + FP2-Code entfernt

### ✅ Abgeschlossen

#### Analyse: Warum `system.currentPersonCount` zwischen 1 und 2 flackert
- CSV-Auswertung + Code-Analyse ergaben: FP2-Handler war totes Code (doppelt broken: fallendes-Flanken-Problem + falscher Code-Block)
- Einzige aktive Erkennungsquelle war `_checkSpatialImpossibility` (räumliche Unmöglichkeit), die nur bei exakt nicht-benachbarten Räumen in 8s-Fenster anschlug → instabiles Flackern
- Erkenntnisse: FP2 liefert in ioBroker nur 0/1 (kein echter Zählwert), daher FP2 = normaler Bewegungsmelder

#### v0.33.35 — PersonCount-Algorithmus: BFS-Hop-Distanz + sensorLastActive

**Problem mit altem Algorithmus (`_checkSpatialImpossibility`):**
1. Festes 8s-Fenster auf `sensorLastSeen` (wird bei ALLEN Zustandsänderungen aktualisiert, auch fallenden Flanken)
   → Eine Person bewegt sich von Raum A nach B: Sensor A geht auf false (sensorLastSeen[A] = jetzt), Sensor B geht auf true → falsch-positiv "2 Personen"
2. Topologie-Check: nur "direkt benachbart ja/nein" — kein Wissen über Hop-Abstand
3. FP2 presence_radar_count Handler: toter Code (innerhalb triggerComfort-Block + !state.ack-Guard)

**Neuer Algorithmus:**

*`lib/recorder.js`:*
- `isPersonCount`-Flag aus `eventObj` entfernt (nie wieder benötigt, FP2 = normaler Sensor)

*`main.js` — `_roomHopDistance(roomA, roomB)`:*
- Neue Methode: BFS über Topologie-Matrix → liefert kürzesten Pfad in Hops zwischen zwei Räumen
- Gibt -1 zurück wenn keine Verbindung, 0 bei gleichem Raum

*`main.js` — `_checkSpatialImpossibility()` komplett neu:*
- Nutzt `sensorLastActive` statt `sensorLastSeen` (nur steigende Flanken!)
- Festes 5s-Fenster (statt 8s) — kurz genug dass es physikalisch unmöglich ist
- Mindest-Hop-Abstand: **2 Hops** (1 direkt benachbarter Raum: in 5s erreichbar → ignorieren)
- Logik: Bei 2+ Hops innerhalb 5s → kein Mensch kann das in 5s schaffen → 2 Personen sicher
- Trackt `_maxPersonsToday` für tägliche History-Snapshots

*`main.js` — Device-Processing:*
- `sensorLastActive[id] = Date.now()` wird nur gesetzt wenn `isRelevantActivity()` = true (steigende Flanken)
- FP2-Handler-Block aus `triggerComfort` entfernt (totes Code)

*`main.js` — `saveDailyHistory()`:*
- `maxPersonsDetected` kommt jetzt aus `_maxPersonsToday` statt aus `e.personCount` (das nie gesetzt wurde)

**Warum 5s-Fenster + 2-Hops besser als 8s + "nicht-benachbart":**
- Kürzeres Fenster = strenger = weniger falsch-positiv
- Hop-Abstand ≥ 2 = physikalisch unmöglich in 5s für einen Menschen (~10-14s Mindestlaufzeit)
- Höhere Hop-Zahl innerhalb des gleichen 5s-Fensters → automatisch mehr Zuverlässigkeit (User-Idee!)

### 🔧 Offene Baustellen
- `_cachedTopoMatrix` beim ersten Aufruf: Topology wird async geladen, erster Check schlägt immer fehl (minor)
- FP2 als `presence_radar_count` in Config: sollte auf `motion` oder `presence_radar_bool` umgestellt werden
- `MIN_HOPS = 2` und `ACTIVE_WINDOW_MS = 5000` noch nicht konfigurierbar (hardcoded)

### 🎯 Nächster logischer Schritt
- Adapter updaten + über Nacht / Tag beobachten ob Flackern weggegangen ist
- Topologie prüfen: sind alle Räume korrekt vernetzt (Flur als Bindeglied eingetragen)?
- FP2-Sensoren in Config von `presence_radar_count` auf `motion` oder `presence_radar_bool` umstellen

---

## Sitzung 18.03.2026 - v0.33.31 - Bugfix: Schlafanalyse zeigt nach erster Nacht keine Daten

### Abgeschlossen

#### v0.33.31 - SCHLAFZEIT + SCHLAFANALYSE: Erste Nacht bleibt leer (Root Cause + Fix)

**Problem:**
Nach der ersten Nacht zeigten SCHLAFZEIT und SCHLAFANALYSE (OC-7) beide leere Kacheln.

**Root Cause:** Die Nacht ueberspannt zwei Kalendertage. Einschlafen ~23:00 Uhr = gestriger Kalendertag.
saveDailyHistory() filterte nur Events ab Mitternacht (startOfDayTimestamp).
Das FP2-Bett-Praesenz-Event von 23:00 Uhr des Vortags fehlte in todayEvents. Resultat:
- sleepWindowCalc.start = null (kein Schlafbeginn erkannt)
- OC-7 Vibrations-Events von 23:00-00:00 Uhr verloren
- Beide Kacheln zeigten Leer-Zustand

**Fix (src/main.js - saveDailyHistory):**
Neue Variable sleepSearchEvents - deckt 18:00 Uhr des Vortags bis jetzt ab:
- bedPresenceMinutes: nutzt sleepSearchEvents statt todayEvents
- sleepWindowCalc: nutzt sleepSearchEvents statt todayEvents
- OC-7 vibDetInWindow: nutzt sleepSearchEvents statt todayEvents
- OC-7 vibStrInWindow: nutzt sleepSearchEvents statt todayEvents

todayEvents bleibt fuer alle anderen Berechnungen unveraendert (freshAirCount etc.)

### Naechster logischer Schritt
- v0.33.31 pushen -> Adapter updaten
- Nach naechster Nacht: SCHLAFZEIT + SCHLAFANALYSE pruefen (erste Nacht sollte erscheinen)
- OC-7 Kalibrierung: nach 30 Naechten Garmin-Korrelation auswerten

---

## 🗓️ Sitzung 17.03.2026 — v0.33.30 — Bugfix Sleep Card Hinweistext

### ✅ Abgeschlossen
- **Fix:** Irreführende Meldung "Kein Vibrationssensor konfiguriert" durch kontextsensitiven Text ersetzt
  - Kein Schlaffenster erkannt (Tageszeit): *"Heute Nacht werden die ersten Daten gesammelt"*
  - Schlaffenster vorhanden aber keine Stages: *"Sensor am Bett konfigurieren"*
- Garmin-Allowlist-Pfade vom Nutzer manuell eingetragen → `deepSleepSeconds`, `lightSleepSeconds`, `remSleepSeconds`, `awakeSleepSeconds` sind jetzt verfügbar (bestätigt mit realen Werten)

### 🎯 Nächster logischer Schritt
- Morgen früh: Sleep Score Card prüfen (erste analysierte Nacht mit v0.33.29/30)
- Nach 30 Nächten: AURA- vs. Garmin-Score-Korrelation auswerten → Algorithmus-Schwellwerte kalibrieren
- `analysis.health.sleepValidation` State → SQL-Logging aktivieren für Langzeitanalyse

---

## 🗓️ Sitzung 17.03.2026 — v0.33.29 — OC-7: AURA Sleep Score Card (Backend + Frontend)

### ✅ Abgeschlossen

#### v0.33.29 — OC-7 implementiert: Sleep Score aus Vibrationssensor + Garmin-Validierung

**Backend (`src/main.js` → `saveDailyHistory()`):**
- **Sleep-Stage-Klassifikation (5-Min-Fenster):** Vibrations-Detection + Stärke-Events werden in 4 Schlafstadien klassifiziert: `deep | light | rem | wake`
  - Tief: keine Events oder lange Ruhephase (consecutiveQuiet ≥ 2 Slots)
  - REM (geschätzt): 2+ Events + mittlere Stärke (12–28), nach 2.5h Schlaf
  - Wach: 5+ Events ODER Stärke > 28
  - Leicht: alles andere
- **Sleep Score (0–100):** Gewichtete Formel: Tief×2.0 + REM×1.5 + Leicht×0.8 − Wach×2.5, +5 Bonus bei 7–9h Schlafdauer
- **Garmin-Validierung (optional):** Liest `garmin.0.dailysleep.dailySleepDTO.sleepScores.overall.value` + `deepSleepSeconds`, `lightSleepSeconds`, `remSleepSeconds`. Pfade konfigurierbar via `garminSleepScoreStateId` etc. in native config.
- **`analysis.health.sleepValidation` State:** Wird täglich geschrieben mit `{ date, auraScore, garminScore, delta, garminDeepMin, garminLightMin, garminRemMin }` — von ioBroker SQL-Adapter automatisch loggbar.
- **Snapshot erweitert:** `sleepScore`, `sleepStages[]`, `garminScore`, `garminDeepMin/LightMin/RemMin` im Daily-JSON

**Frontend (`src-admin/src/components/tabs/HealthTab.tsx`):**
- **Neue TerminalBox "SCHLAFANALYSE (OC-7)"** — im Gesundheits-Tab nach `renderTimelines()` (nach SchlafRadar + Neuro-Timeline)
- **Horizontale Schlafphasen-Zeitleiste:** Farbige Balken (Dunkelblau=Tief, Hellblau=Leicht, Magenta=REM, Rot=Wach)
- **Score-Badge oben Mitte:** AURA-Score in grün/orange/rot, darunter Garmin-Score + Delta wenn verfügbar
- **Einschlaf-/Aufwachzeit** links/rechts
- **Zeitachse** unter dem Balken (4 Punkte)
- **Stage-Dauer-Grid** (Tief/Leicht/REM/Wach in Stunden/Minuten)
- **Garmin-Referenz-Zeile** wenn deepSleepSeconds etc. verfügbar
- **Graceful Degradation:** Kein Vibrationssensor → Hinweis + Empfehlung statt leerer Kachel

**Config (`io-package.json`):**
- `garminSleepScoreStateId` (Default: `garmin.0.dailysleep.dailySleepDTO.sleepScores.overall.value`)
- `garminDeepSleepStateId`, `garminLightSleepStateId`, `garminRemSleepStateId` (Defaults analog)

**Garmin-Adapter Allowlist — manuell einzutragen** (Exakte Pfade in Garmin-Adapter Config):
```
dailysleep.dailySleepDTO.deepSleepSeconds
dailysleep.dailySleepDTO.lightSleepSeconds
dailysleep.dailySleepDTO.remSleepSeconds
dailysleep.dailySleepDTO.awakeSleepSeconds
```

### 🔧 Offene Baustellen
- OC-7 Algorithmus-Kalibrierung: Schwellwerte basieren auf 1 Nacht — nach 30 Tagen Garmin-Vergleich anpassen
- Admin-UI Konfigurationsfeld für Garmin-State-Pfade (aktuell nur io-package.json Default)
- OC-7 Langzeit-Trend: sleepScore in LongtermTrendsView als eigene Kachel (Phase 2)

### 🎯 Nächster logischer Schritt
- 30 Tage Garmin-Korrelation sammeln → dann Algorithmus-Schwellwerte anpassen (W-Korridor, REM-Erkennung)
- OC-7 Phase 2: sleepScore-Langzeittrend in LongtermTrendsView einbinden

---

## 🗓️ Sitzung 17.03.2026 — v0.33.28 — Code-Review-Fix Batch 4 (Restliche Frontend + W-5 Backend)

### ✅ Abgeschlossen

#### v0.33.28 — Batch 4: Restliche Fixes aus CODE_REVIEW.md

**W-2: Mitternachts-Wrap-Bug in Nykturie-Fenster-Average (`LongtermTrendsView.tsx`)**
- `startMins`-Berechnung: `% 1440` entfernt das das `+1440` für Midnight-Wrap sofort wieder rückgängig machte
- Fix: `(dt.getHours() * 60 + dt.getMinutes() + (dt.getHours() < 12 ? 1440 : 0))` ohne `% 1440`
- Berechnung der Durchschnitts-Einschlafzeit ist jetzt korrekt für Nutzer die nach Mitternacht einschlafen

**W-5/OC-5: Sensor-Offline-Alerts verbessert (`src/main.js` → `checkSensorHealth()`)**
- `defaultThreshold` von 8h auf 24h angehoben (sicherer Fallback für unbekannte Sensortypen)
- `temperature`-Threshold von 2h auf 6h erhöht (Temperatursensoren senden nur bei Änderung)
- **Nacht-Alarm-Guard:** Pushover-Benachrichtigungen werden zwischen 22:00 und 08:00 Uhr unterdrückt. Dashboard-Status (rot/grün) bleibt korrekt, aber kein Push-Spam während der Nacht.

**W-6: Aufwachzeit Y-Achse zu eng (`LongtermTrendsView.tsx`)**
- `wakeTimeMin`-Chart domain von `[270, 600]` (04:30–10:00) auf `[180, 660]` (03:00–11:00) erweitert
- Frühe und späte Aufwachzeiten werden nicht mehr abgeschnitten

**H-7: Fehlende Typ-Annotationen im `DailyDataPoint`-Interface (`LongtermTrendsView.tsx`)**
- `todayVector?: number[]`, `roomActivity?: Record<string, number>`, `windowsByRoom?: Record<string, number>` zum Interface hinzugefügt
- Kein `(d as any)`-Cast mehr nötig für diese Felder

**H-9: Drift-Frühabbuch ohne Nutzerhinweis (`LongtermTrendsView.tsx`)**
- `driftEarlyBreak`-Flag eingeführt, wird gesetzt wenn 14+ fehlende Tage die Drift-Ladung stoppen
- Warning wird im Drift-Chart angezeigt: "⚠ Daten ab TT.MM.JJJJ (14+ fehlende Tage übersprungen)"

**OC-7 Brainstorming-Eintrag:** AURA Sleep Score aus Vibrationssensor-Daten — Konzept dokumentiert nach Korrelationsanalyse Aqara-CSV vs. Garmin-Schlafkurve (17.03.2026)

### 🔧 Offene Baustellen
- **H-6:** `getEffectiveSF()` / `sf()` Duplikat → gemeinsames Modul (aufwändiges Refactoring, noch offen)
- **W-2 avgS:** `% 1440` auf avgS (Zeile 1209) bleibt vorerst — ist für fmt()-Anzeige korrekt
- **OC-7 (NEU):** AURA Sleep Score aus Vibrationssensor — konzeptioniert, noch nicht implementiert

### 🎯 Nächster logischer Schritt
- OC-7 umsetzen: Sleep-Score-Algorithmus in `saveDailyHistory()` + Garmin-Style Kachel im Gesundheits-Tab

---

## 🗓️ Sitzung 17.03.2026 — v0.33.27 — Code-Review-Fix Batch 3 (Backend: OC-4 Startup-Guard)

### ✅ Abgeschlossen

#### v0.33.27 — Batch 3 aus passivem Code-Review (CODE_REVIEW.md / W-1 / OC-4)

**Startup-Save-Guard für falsche Schlafzeiten nach Adapter-Neustart (`src/main.js`)**

- **Datei:** `src/main.js` → `saveDailyHistory()`, direkt nach dem `sleepWindowCalc`-IIFE
- **Problem (W-1 / OC-4):** Beim Adapter-Neustart mitten in der Nacht ist `eventHistory` dünn/leer. `sleepWindowCalc` errechnete dann die Restart-Zeit als Einschlafzeit (z. B. "03:12–04:48" statt "22:30–07:00"). Der SCHLAFZEIT-Chart zeigte dadurch täglich nach einem Update einen Ausreißer.
- **Lösung:** Guard nach der `sleepWindowCalc`-Berechnung:
  ```javascript
  if (bedPresenceMinutes < 180 && sleepWindowCalc.start !== null) {
      this.log.debug(`[History] OC-4 Guard: ${bedPresenceMinutes}min < 180, sleepWindow verworfen`);
      sleepWindowCalc.start = null;
      sleepWindowCalc.end = null;
  }
  ```
- **Schwelle:** < 180 Minuten Bettzeit = höchstwahrscheinlich unvollständige Nachtdaten → kein Schlaffenster speichern, lieber `null` als falscher Wert
- **main.js** via `build:backend:dev` neu gebaut und Syntax geprüft (`node --check`)

### 🔧 Offene Baustellen (aus CODE_REVIEW.md)
- **H-6:** `getEffectiveSF()` / `sf()` Duplikat → gemeinsames Modul (aufwändiges Refactoring)
- **W-2:** `startMins % 1440` macht Mitternachts-Korrektur im Nykturie-Fenster-Average rückgängig
- **W-4 (OC-3):** Räumliche Unmöglichkeit False-Positives (1h Reset-Timer, konzeptionelle Frage)
- **W-5 (OC-5):** PIR-Offline-Threshold 4h → False-Positive-Pushover-Alarme im Schlaf
- **W-6:** `wakeTimeMin` Y-Domain in PERSONEN-NACHT-ANALYSE schneidet Extremwerte ab
- **H-7:** Fehlende Typ-Annotationen in `DailyDataPoint`-Interface
- **H-9:** `loadDriftData()` bricht bei 14+ fehlenden Tagen ohne Nutzerhinweis ab

### 🎯 Nächster logischer Schritt
- OC-5 angehen: PIR-Sensor-Offline-Threshold erhöhen oder Zeit-bewusst (Schlaffenster ausklammern)
- Oder: W-2 Nykturie-Fenster-Average Mitternachts-Wrap-Fix (Frontend, einfach)

---

## 🗓️ Sitzung 17.03.2026 — v0.33.26 — Code-Review-Fixes (Frontend-Bugs + TypeScript-Hygiene)

### ✅ Abgeschlossen

#### v0.33.26 — Batch 1+2 aus passivsem Code-Review (CODE_REVIEW.md)

**Kritische Bugs behoben:**
- **K-2** `LongtermTrendsView.tsx`: `RechartsTooltip` war undefinierter Bezeichner → durch korrektes `Tooltip` (Recharts-Import) ersetzt. PERSONEN-NACHT-ANALYSE-Tooltips funktionieren jetzt.
- **K-4** `loadDriftData()`: Nacht-Zeitfenster war `h < 6` (22–06 Uhr), in `loadLongtermData()` dagegen `h < 8` (22–08 Uhr) → auf `h < 8` vereinheitlicht. Drift-Monitor und Kacheln jetzt konsistent.
- **K-3** SCHLAFZEIT-Chart: Y-Achse `yMax` von 1680 (= 04:00 Uhr) auf 2040 (= 10:00 Uhr) erhöht + Ticks bis 10:00 Uhr. Vorher wurden normale Aufwachzeiten (06:00–09:00) still abgeschnitten.
- **K-1** UTC-Datum-Loop: Alle 4 `toISOString().split('T')[0]`-Vorkommen in `LongtermTrendsView.tsx` durch lokale Datum-Berechnung ersetzt (analog Fix in `saveDailyHistory()` v0.33.24). Frontend fragt jetzt die richtigen History-Dateien an, auch nach Mitternacht.

**Labels korrigiert:**
- **W-3** BETT-PRÄSENZ: Untertitel "0-24 Uhr" → "Schlaffenster" (Daten kommen aus dynamischem Schlaffenster, nicht 24h)
- **H-8** SCHLAF-UNRUHE: Untertitel "22-06 Uhr" → "Schlaffenster" (seit v0.33.6 dynamisch)

**TypeScript-Hygiene (diseaseProfiles.ts):**
- **H-4** `DeviceConfig`-Interface: fehlende Felder ergänzt: `isKitchenSensor`, `isFP2Bed`, `isFP2Living`, `isVibrationBed`, `sensorFunction`
- **H-5** `sf()`-Funktion: Parameter von `d: any` auf `d: DeviceConfig` (typsicher); `(d as any).isNightSensor` → `d.isNightSensor` in `hasNightSensor()`; analog für `isBathroomSensor`
- **H-10** `hasNightSensor()`: Keyword `'kind'` → `'kinderzimmer'` (zu kurzer Substring, hätte false positives erzeugen können)

**Code-Hygiene:**
- **H-1** 16 Debug-`console.log`-Zeilen mit `[LongtermTrends]`-Prefix entfernt (4 echte `console.error` für Fehlerfälle behalten)
- **H-2** Veralteter Versions-Kommentar `// Version: 0.30.46` entfernt
- **H-3** Totes Markup `<Grid item xs={12} style={{ display: 'none' }}>` entfernt

### 🔧 Offene Baustellen
- **W-1 / OC-4**: Schlafzeit-Zuverlässigkeit — Startup-Save-Guard (Batch 3, braucht main.js-Änderung)
- **H-6**: `getEffectiveSF()` / `sf()` Duplikat → gemeinsames Modul (größeres Refactoring, Batch 3+)
- **W-4 / OC-3**: Räumliche Unmöglichkeit False-Positives (1h Reset-Timer, konzeptionelle Frage)
- **W-5 / OC-5**: PIR-Offline-Threshold 4h → zu viele Alerts (Schwelle erhöhen)

### 🎯 Nächster logischer Schritt
- Deploy v0.33.26 auf Produktivsystem (`git push` → ioBroker Adapter-Update)
- Batch 3: W-1 OC-4 Startup-Save-Guard in main.js (verhindert falsche Schlafzeiten nach Neustart)

---

## 🗓️ Sitzung 17.03.2026 — v0.33.24 — KRITISCHER UTC-Datumsfehler behoben

### ✅ Abgeschlossen

#### v0.33.24 — KRITISCH: UTC-Datum in saveDailyHistory überschrieb Vortags-Daten

**Root Cause:** `saveDailyHistory()` verwendete `new Date().toISOString().split('T')[0]` (UTC-Datum).
In Deutschland (CET = UTC+1) liegt UTC zwischen 00:00–01:00 Uhr noch **im gestrigen Tag**:
- Lokale Zeit 00:30 Uhr March 17 → UTC 23:30 March 16 → dateStr = `2026-03-16` ← FALSCH!
- Adapter-Neustart nach Mitternacht (z.B. wegen Update) → Startup-Save schreibt fast-leere March-17-Daten in die March-16-Datei und überschreibt die korrekten Tagesdaten!

**Symptom:** Gestern gut sichtbare Balken verschwanden heute komplett.

**Fix:** Lokales Datum statt UTC in `saveDailyHistory()`:
```javascript
const _now = new Date();
const dateStr = _now.getFullYear() + '-' + String(_now.getMonth()+1).padStart(2,'0') + '-' + String(_now.getDate()).padStart(2,'0'); // LOKAL, nicht UTC!
```

**Zusatz:** Multi-Person Reset-Timer von 15 Minuten auf **1 Stunde** erhöht (war zu aggressiv).

#### v0.33.25 — System-Tab: Live-Statusanzeige (Personenzahl + Haushaltstyp)
**Feature:** Neuer Info-Block ganz oben im System-Tab (vor Sensor-Gesundheit):
- **Personen im Haus (geschätzt):** zeigt `system.currentPersonCount` live (alle 30s)
- **Haushaltstyp:** zeigt `system.householdType` (Einpersonen / Mehrpersonen)
- **Erkennungsquelle:** zeigt ob räumliche Heuristik aktiv oder Config-Baseline gilt

### 🔧 Offene Baustellen
- Topologie-Matrix vom Sicherheits-Tab in System-Tab verschieben (OC-2)
- Sensor-Offline Pushover-Benachrichtigung: Schwelle erhöhen (OC-5)
- Schlafzeit-Zuverlässigkeit mit FP2 (OC-4)

### 🎯 Nächster logischer Schritt
- v0.33.24 Datums-Fix morgen früh verifizieren (Balken von heute noch sichtbar?)
- Danach: Topologie-Matrix aus Sicherheits-Tab in System-Tab verschieben (OC-2)

---

## 🗓️ Sitzung 16.03.2026 — v0.33.20–v0.33.22 — Briefing-Fix + Personenzählung

### ✅ Abgeschlossen

#### v0.33.20 — Morning Briefing: echte Nacht-Daten statt Weltnachrichten
**Problem:** `sendMorningBriefing()` schickte nur den Satz „erstelle Briefing basierend auf Events der letzten Nacht" ohne Daten an Gemini → Gemini erfand Weltnachrichten.
**Fix:** Funktion komplett neu gebaut – wie `sendWeeklyBriefing()` template-basiert ohne Gemini:
- Liest gestrige History-Datei (`YYYY-MM-DD.json`)
- Zeigt: Schlafzeit (sleepWindowStart/End/Duration), Nacht-Unruhe (nightVibrationCount/nightMotionCount), Nykturie (nocturiaCount)
- Sparkline der letzten 7 Tage wie bisher

#### v0.33.21 — Haushaltsgröße-Dropdown + householdType-Baseline
**Feature:** Neues Dropdown im System-Tab (Einstellungen): „Haushaltsgröße (Personenzählung)"
- Optionen: Alleine (single) / Zu zweit (couple) / Familie/WG (family)
- Beim Adapter-Start wird `system.householdType` und `system.currentPersonCount` aus Config gesetzt als Baseline
- Wird überschrieben wenn FP2 oder räumliche Heuristik live 2+ Personen erkennt

#### v0.33.22 — Räumliche Unmöglichkeits-Heuristik für Personenzählung
**Feature:** Software-basierte Personenzählung ohne Sensor-Hardware:
- Bei jedem Sensor-Event: prüft ob ein anderer Sensor an NICHT-benachbartem Raum (laut Topologie-Matrix) innerhalb der letzten 8 Sekunden gefeuert hat
- Wenn ja → `system.currentPersonCount = 2`, `system.householdType = 'multi'`
- Reset nach 15 Minuten zurück auf Config-Baseline
- Nutzt bestehende Infrastruktur: `sensorLastSeen`, `analysis.topology.structure`
- Cached Topologie-Matrix beim ersten Aufruf, lädt bei triggerTopology-Update neu

### 🎯 Nächster logischer Schritt
- Updates auf Produktivsystem installieren (v0.33.20–v0.33.22)
- Haushaltsgröße im System-Tab konfigurieren
- Testen ob räumliche Heuristik korrekte Multi-Person-Logs produziert

---

## 🗓️ Sitzung 16.03.2026 — v0.33.19 — Küchensensor-Erkennung Hotfix

### ✅ Abgeschlossen

#### v0.33.19 — `sf()` Legacy-Flags + Umlaut-Normalisierung
**Root Cause:** Küchensensor trotz korrekt gesetztem `sensorFunction="kitchen"` in v0.33.18 immer noch nicht erkannt. Zwei Ursachen:

1. **Legacy-Flags ignoriert**: `sf()` las nur `d.sensorFunction`, kannte aber nicht die alten Flags (`isKitchenSensor`, `isBathroomSensor`, `isHallway`, `isNightSensor`). Wenn ein Sensor früher ohne explizites `sensorFunction` konfiguriert wurde, gab `sf()` `""` zurück.

2. **Umlaut-Problem im Fallback**: location-Suche suchte nach `"kueche"` (ASCII), aber ioBroker speichert den Standort als `"EG Küche"` (echtes `ü`). `"eg küche".includes("kueche")` = `false`.

**Fix:**
- `sf(d)` erweitert: prüft jetzt `isKitchenSensor → "kitchen"`, `isBathroomSensor → "bathroom"`, `isHallway → "hallway"`, `isNightSensor → "bed"` als Fallback (analog zu `getEffectiveSF()` in SensorList)
- `normLoc(s)` Hilfsfunktion: ersetzt `ü→ue`, `ä→ae`, `ö→oe`, `ß→ss` vor Keyword-Vergleichen
- `hasKitchenSensor()`, `hasBathroomSensor()`, `hasNightSensor()` nutzen jetzt `normLoc()` für location-Vergleiche

### 🎯 Nächster logischer Schritt
- Adapter-Update auf Produktivsystem installieren (v0.33.19)
- Prüfen ob Küchensensor und alle anderen Sensoren in Krankheitsprofilen korrekt grün erscheinen

---

## 🗓️ Sitzung 16.03.2026 — feat: neue Kacheln + Bugfixes v0.33.13–v0.33.18

### v0.33.18 — Sensor-Erkennung in Krankheitsprofilen

**Problem:** `diseaseProfiles.ts` kannte `sensorFunction` nicht — die Check-Funktionen
prüften nur alte Legacy-Felder (`isHallway`, `isBathroomSensor`) und Location-Keywords.
Folge: Sensoren mit `sensorFunction = 'kitchen'` wurden als fehlend angezeigt, obwohl vorhanden.

**Fix:**
- Hilfsfunktion `sf(d)` hinzugefügt: liefert `d.sensorFunction` als lowercase
- `hasHallwaySensor()`: prüft jetzt auch `sensorFunction === 'hallway'`
- `hasNightSensor()`: prüft jetzt auch `sensorFunction === 'bed'`
- `hasBathroomSensor()`: prüft jetzt auch `sensorFunction === 'bathroom'`
- `hasKitchenSensor()`: prüft jetzt primär `sensorFunction === 'kitchen'`
- `hasFP2()`: neu — erkennt `presence_radar_*` Sensor-Typen
- `hasVibrationSensor()`: neu — erkennt `vibration_*` Sensor-Typen mit Funktion `bed`
- Alle `() => false` Checks durch echte Funktionen ersetzt

### v0.33.17 — SCHLAFZEIT zeigt ab 1 Nacht Daten

---

## Sitzung 16.03.2026 — feat: neue Kacheln + Bugfixes v0.33.13–v0.33.16

### v0.33.16 — SCHLAFZEIT-Kachel immer sichtbar
- Kachel war durch `hasSleepWindow`-Bedingung versteckt (braucht FP2-Schlaffenster-Daten)
- Jetzt immer sichtbar: zeigt Chart wenn Daten da, sonst Leer-Zustand mit Erklärung
- "Benötigt FP2-Sensor (Funktion: Bett) · ab nächster Nacht"

---

## Sitzung 16.03.2026 — feat: neue Kacheln + Bugfixes v0.33.13–v0.33.15

### v0.33.15 — Neue Schlaf-Kacheln + Backend-Daten

**Neue Kacheln in SCHLAF & SENSORIK:**
- **VIBRATIONS-INTENSITÄT**: Zeigt Ø und Max Vibrationsstärke (0–255) im Schlaffenster
  - Grün < 30, Orange 30–80, Rot > 80 (medizinisch relevant für Parkinson/Epilepsie)
  - Unterschied zu SCHLAF-UNRUHE: COUNT vs. STRENGTH
- **SCHLAFZEIT**: Einschlaf- und Aufwachzeit als Zeitreihe (Garmin-Stil)
  - Y-Achse = Uhrzeit (18:00–06:00), X-Achse = Datum
  - Datenbasis: FP2-Bett-Events (sleepWindowStart/End)
  - Medizinisch: inkonsistente Zeiten → Depression/Demenz-Hinweis

**Backend-Erweiterung:**
- `nightVibrationStrengthAvg` + `nightVibrationStrengthMax` werden in saveDailyHistory() berechnet
- Basis: `vibration_strength` Sensor-Typ, gefiltert auf Schlaffenster

### v0.33.14 — Kritischer Bugfix: sleepWindowCalc

**Fehler:** `Cannot access 'sleepWindowCalc' before initialization`
- `nightVibrationCount`-Berechnung referenzierte `sleepWindowCalc` BEVOR es deklariert war
- JavaScript `const` Temporal Dead Zone → saveDailyHistory() schlug immer fehl
- Fix: `nightVibrationCount` nach `sleepWindowCalc` verschoben

### v0.33.13 — fix: heute-Balken in Charts nach Adapter-Restart

### Root Cause
`saveDailyHistory()` wurde nur bei 23:59 und bei Adapter-Stop aufgerufen.
Nach Adapter-Neustart (z.B. nach Update auf v0.33.12) gab es keine heutige JSON-Datei
→ `getHistoryData('2026-03-16')` lieferte `{success: false}` → kein heute-Balken.

### Abgeschlossen
- `saveDailyHistory()` wird 90 Sekunden nach Adapter-Start aufgerufen (nach `replayTodayEvents`)
- Neuer stündlicher Job `hourlySaveInterval`: schreibt heute-Datei jede Stunde aktuell
- `hourlySaveInterval` wird in `onUnload` sauber gestoppt
- Ergebnis: Heute-Balken erscheint ~90s nach Adapter-Start, aktualisiert sich stündlich

---

## Sitzung 16.03.2026 — feat: Universelle Wert-Normalisierung + neue Sensortypen v0.33.12

### Design-Entscheidung: Sensor-Werttypen (ab v0.33.12 verbindlich)

AURA akzeptiert immer alle folgenden Formen als „aktiv":
- `true`, `1`, jede Zahl `> 0` (z.B. `2`, `3` beim FP2)
- String `"true"`, `"1"`, `"on"`, `"open"`

Als „inaktiv": `false`, `0`, `"false"`, `"0"`, `"off"`, `"closed"`

Zentrale Hilfsfunktionen in `recorder.js`:
- `isActiveValue(value)` – für alle boolean-artigen Sensoren (PIR, Tür, Vibration erkannt, Präsenz boolean)
- `toPersonCount(value)` – für Personenzahl-Sensoren (FP2 .value, gibt `0–N` zurück)

### Abgeschlossen

**SensorList.tsx — neue Sensortypen (alte Typen entfernt, kein Backward-Compat):**
- `presence_radar` → entfernt
- `vibration` → entfernt
- NEU: `presence_radar_bool` — Präsenz-Radar · Anwesenheit (boolean)
- NEU: `presence_radar_count` — Präsenz-Radar · Personenanzahl (Zahl)
- NEU: `vibration_trigger` — Vibration · Erkannt (boolean)
- NEU: `vibration_strength` — Vibration · Stärke (Zahl, für Parkinson/Schlaf)

**recorder.js — Vereinheitlichung:**
- `isActiveValue()` + `toPersonCount()` als zentrale Hilfsfunktionen eingeführt
- `isRelevantActivity()` nutzt `isActiveValue()` – alle Sensor-Protokolle (KNX 0/1, Zigbee true/false, HomeKit, Alias) automatisch korrekt
- Exit-Timer + Präsenzerkennung: `value === true` → `isActiveValue(value)` → KNX/Zigbee/HomeKit alle abgedeckt
- Tracker-Event: `isActiveValue()` + `toPersonCount()`
- eventObj: neue Flags `isPersonCount` + `isVibrationStrength`

**main.js — FP2 Subscription aufgeräumt:**
- Alte Magie `id.replace('.occupancy-detected', '.value')` → entfernt
- `presence_radar_count` Sensoren werden direkt über ihre eingetragene ID subscribed (Alias-kompatibel!)
- Personenzahl-Handler in `onStateChange` nutzt nun Config-Type statt ID-Suffix
- `bedPresenceMinutes`, `nightVibrationCount`, `sleepWindowCalc` alle auf `isActiveValue()` umgestellt

### Was der Nutzer jetzt tun muss
- **Eigene 4 Sensoren** in der Sensorliste auf neue Typen umstellen:
  - FP2 Schlafzimmer boolean → `presence_radar_bool` + Funktion `Bett/Schlafzimmer`
  - FP2 Schlafzimmer Personenzahl → `presence_radar_count` + Funktion `Bett/Schlafzimmer`
  - Vibrationssensor erkannt → `vibration_trigger` + Funktion `Bett/Schlafzimmer`
  - (optional) Vibration Stärke → `vibration_strength` + Funktion `Bett/Schlafzimmer`
- Adapter auf v0.33.12 updaten + neu starten

### Patch-Skripte (intern, nicht committet)
- `_internal/patch_sensorlist.js`
- `_internal/patch_recorder.js`
- `_internal/patch_main.js`

---

---

## Sitzung 16.03.2026 — Bugfix v0.33.11: FP2 .value-States nie empfangen

### Abgeschlossen
- **Root Cause gefunden: `subscribeStateAsync` statt `subscribeForeignStatesAsync`**
  - FP2 `.value`-States (Personenzahl) kommen von `homekit-controller.0.*` → foreign states
  - `subscribeStateAsync` abonniert nur eigene Adapter-States (`cogni-living.0.*`) → FP2-Events kamen NIE an
  - Folge: `system.currentPersonCount` State existierte nie, `maxPersonsDetected` immer 0, PERSONENBELEGUNG-Chart leer
  - Fix: eine Zeile geändert: `subscribeStateAsync(_vpId)` → `subscribeForeignStatesAsync(_vpId)`
- **src/main.js auf committed Basis zurückgesetzt**
  - Lokale src/main.js hatte durch frühere fehlerhafte Patch-Skripte orphaned Code-Fragmente
  - Syntax-Fehler an Zeile 761 (`else if` nach falsch geschlossenem Block)
  - Lösung: committed main.js (v0.33.10) als Basis genommen, Fix sauber eingefügt, `node --check` verifiziert
- Commit: `a831a5b`

### Was NICHT betroffen war (funktionierte schon):
- `bedPresenceMinutes` ← aus `occupancy-detected` boolean Events (korrekt subscribed via `subscribeForeignStatesAsync`)
- `nightVibrationCount` ← gleicher Weg
- `nocturiaCount` ← Badezimmer-Sensor, kein FP2

### Was jetzt funktioniert (nach Adapter-Update auf Produktivsystem):
- `system.currentPersonCount` wird jetzt beim ersten FP2-Wechsel angelegt
- `maxPersonsDetected` wird korrekt in Snapshots gespeichert
- PERSONENBELEGUNG-Chart zeigt nach nächster Nacht echte Daten

### Nächster logischer Schritt
- Adapter auf Produktivsystem auf v0.33.11 updaten (GitHub → ioBroker Adapter-Update)
- Nach nächster Nacht: PERSONENBELEGUNG-Chart prüfen ob maxPersonsDetected korrekt erscheint
- BETT-PRÄSENZ + VIBRATION sollten bereits heute Nacht erscheinen (waren schon korrekt subscribed)

---

## Sitzung 16.03.2026 — Bugfixes v0.33.9 (Adapter-Start + Frontend)

### Abgeschlossen
- **Adapter startet wieder (main.js)**:
  - Per-Person-Block stand NACH dem Snapshot-Objekt statt davor → `personData` war beim Snapshot-Bau noch nicht definiert
  - Zusätzlich: `const dataDir` doppelt deklariert (einmal aus verschobenem Block, einmal original)
  - Root cause: Alle Patch-Skripte nutzten `const dataDir = utils.getAbsoluteDefaultDataDir()` als Marker — diese Zeile kommt aber ZWEIMAL vor (einmal in `saveDailyHistory`, einmal in `onMessage.getStats`) → Code aus beiden Funktionen wurde vermischt
  - Fix: `main_before_person.js` (v0.33.8, clean) als Basis genommen, Per-Person-Änderungen neu und korrekt aufgesetzt, mit `node --check` verifiziert
  - Commits: `5c63a6f`, `66a1c9f`, `e0adf16`
- **Frontend-Fehler `dailyData is not defined` behoben (LongtermTrendsView.tsx)**:
  - PERSONEN-NACHT-ANALYSE-Sektion nutzte `dailyData` (lokale Variable in `loadLongtermData()`)
  - Im Render muss `dailyDataRaw` (State-Variable) genutzt werden
  - Commit: `516b3e4`

### Wichtige Erkenntnis: Deployment-Workflow
- `iobroker upload cogni-living` aktualisiert nur Admin-Dateien (Frontend), NICHT `main.js`
- `main.js` wird nur über Git-Push + Adapter-Update in ioBroker aktualisiert
- Eltern-System und eigenes System sind unabhängige ioBroker-Instanzen → beide separat aktualisieren

### Nächster logischer Schritt
- Normalen Betrieb beobachten (Personen-Nacht-Analyse sammelt ab heute Nacht erste Daten)
- BRAINSTORMING.md enthält offene Punkte: Auto-Discovery FP2, Erweiterung Raumfunktionen

---

## Sitzung 15.03.2026 - Sensor-Ausfall UI-Sammelmeldung + getForeignStateAsync (v0.33.7)

### Abgeschlossen
- **Prominente Sensor-Gesundheits-Karte (SystemTab.tsx)**:
  - Karte oben im System-Tab IMMER sichtbar, noch vor den Einstellungen
  - Gruen: "Alle X Sensoren erreichbar" + Zeitstempel letzter Check
  - Rot: "X von Y Sensoren nicht erreichbar" + Liste aller Ausfaelle mit Name, Ort, "seit Xh"
  - Laedt alle 5 Minuten aus system.sensorStatus ioBroker-State
  - Grau/gestrichelt solange noch kein Check durchgefuehrt wurde
- **Alert-Banner in Settings.tsx** (Sensor-Accordion):
  - Roter Alert-Banner oberhalb des Sensoren-Accordions bei Ausfall
  - Accordion-Titel zeigt "Sensoren ⚠️" wenn Probleme vorhanden
- **Warnsymbol in SensorList.tsx**:
  - Oranges Warnsymbol direkt neben der Sensor-ID der betroffenen Sensoren
  - Tooltip: "Sensor nicht erreichbar"
- **checkSensorHealth() verbessert (main.js)**:
  - Jetzt async: nutzt getForeignStateAsync fuer echten ioBroker-ts-Timestamp
  - ts wird vom Basisadapter (zigbee, homekit) bei jedem Heartbeat aktualisiert
  - sensorLastSeen als Fallback fuer Sensoren ohne ioBroker-State
  - KNX/Loxone/BACnet/Modbus Sensoren automatisch ausgenommen (kabelgebunden, kein Heartbeat)
  - Tuer/Fenster-Threshold: 24h -> 7 Tage (wochenlang geschlossen ist normal)
  - Schreibt system.sensorStatus JSON-State fuer UI-Kommunikation

### Versionsregel (immer gelten)
- Jede Aenderung = neuer Patch-Version-Bump (auch kleinste Aenderungen)

### Naechste logische Schritte
- KNX-Sensoren: optional manuell konfigurierbare Alive-Checks (z.B. 14-Tage-Fenster)
- Auto-Discovery Verbesserung: FP2-Sensoren/Zonen automatisch erkennen (BRAINSTORMING.md)
- Ganggeschwindigkeit: Mehrflur-Handling klaeren (BRAINSTORMING.md)

---

## Sitzung 15.03.2026 - Sensor-Ausfall-Erkennung + FP2-Schlaffenster (v0.33.6)

### Abgeschlossen
- **Sensor-Ausfall-Erkennung (main.js)**:
  - sensorLastSeen Map: wird bei jedem Event in recorder.js aktualisiert
  - Beim Adapter-Start: Initialisierung aus eventHistory (survives Neustart)
  - Stundenintervall: checkSensorHealth() prueft alle konfigurierten Sensoren
  - Schwellwerte: PIR/FP2/Vibration=4h, Tuer=24h, Temperatur=2h, Rest=8h
  - Alert-Cooldown: max. 1 Pushover-Alarm pro Sensor alle 12h
  - Pushover-Alert mit Sensor-Name, Ort und Stunden seit letztem Event
  - onUnload: Interval sauber aufgeraumt
- **Dynamisches Schlaf-Fenster (main.js + saveDailyHistory)**:
  - sleepWindowCalc: Analysiert FP2-Bett-Events
    - Schlafbeginn: letztes Mal Bett >= 10 Min belegt zwischen 18:00-02:00
    - Aufwachen: erstes Mal Bett >= 15 Min leer nach 04:00 (nach Schlafbeginn)
  - 
octuriaCount: nutzt jetzt dynamisches Fenster (Fallback: 22-06 wenn kein FP2)
  - 
ightVibrationCount: ebenfalls dynamisches Fenster statt fixem 22-06
  - Snapshot: enthaelt jetzt sleepWindowStart + sleepWindowEnd (ms-Timestamps)
- **Nykturie-Chart (LongtermTrendsView.tsx)**:
  - Header zeigt Durchschnitt des Schlaffensters: "Ø 23:04-06:28 (FP2-Fenster, Ø 7d)"
  - Ohne FP2: "22:00-06:00 (Fixfenster)"
  - Tooltip pro Balken zeigt tatsaechliches Fenster des jeweiligen Tages (z.B. "23:14-06:45 Uhr")
  - Ohne FP2 fuer diesen Tag: "Fixfenster 22-06 Uhr" als Hinweis

### Hinweis zur Nykturie-Abgrenzung
- Nykturie (Bad/WC-Sensor) = bewusstes Aufstehen zum Toilettengang
- Inkontinenz (Feuchtigkeitssensor am Bett) = unkontrollierter Urinverlust
- -> Zwei verschiedene Krankheitsbilder, beide sinnvoll!

### Naechste Schritte
1. Hard Refresh (Strg+Shift+R)
2. FP2-Bett konfigurieren -> nach 1-2 Naechten zeigt Nykturie-Chart das echte Fenster
3. Pushover-Test: Sensor fuer >4h abziehen -> sollte nach max. 1h Alert kommen

---

---

## Sitzung 15.03.2026 - Schlaf-Sensorik Charts + Sensor-Tabelle Verbesserungen (v0.33.5)

### Abgeschlossen
- **SCHLAF & SENSORIK Sektion** in LongtermTrendsView.tsx (lila Randlinie, nach HYGIENE & LUEFTUNG):
  - **BETT-PRAESENZ**: Stunden pro Nacht aus bedPresenceMinutes, farbcodiert (<4h rot, 4-6h orange, 6-9h gruen), 7-Tage-Linie in Lila
  - **SCHLAF-UNRUHE (VIBRATION)**: Vibrationsimpulse 22-06 Uhr aus nightVibrationCount, magenta Balken
  - **PERSONENBELEGUNG**: maxPersonsDetected pro Tag, dunkelblau bei >=2 Personen, hellblau bei 1 Person, Referenzlinie bei 2
  - **NYKTURIE**: nocturiaCount (Nachtstunden mit Bad-Sensor-Aktivitaet), Alarm-Linie bei 2 Stunden
  - Alle Charts: zeigen sich NUR wenn Daten vorhanden (null-safe), Hinweistext wenn noch keine Sensoren konfiguriert
  - Datenbasis: direkt aus dailyDataRaw (kein Python-Backend noetig), JS-computed 7-Tage-Moving-Average
- **SensorList.tsx Verbesserungen**:
  - FP2 (presence_radar) kann jetzt ALLE Raum-Funktionen haben (Flur, Bad, Kueche, Bett, Wohnzimmer, Allgemein)
  - Capability-Legende zeigt aktive Funktionen mit dickem Rahmen + Checkmark + Farbe
  - Inaktive Funktionen gestrichelt + ausgegraut
  - Hinweiszeile erklaert den Unterschied
- **BRAINSTORMING.md**: Auto-Discovery Verbesserung (FP2/HomeKit-Controller) dokumentiert inkl. FP2-Zonenstruktur-Erklaerung

### FP2-Empfehlung (aus Diskussion)
- "Allgemeiner Status Anwesend"-Zone (nur boolean true/false) NICHT als presence_radar eintragen
- Benannte Zonen (Wohnzimmer, Schlafzimmer etc.) als presence_radar eintragen = liefern Personenzahl als .value
- Pro FP2: 1-2 Zonen eintragen die am relevantesten sind (nicht alle 5 Zonen noetig)

### Naechste Schritte
1. FP2-Sensoren im Settings konfigurieren (benannte Zonen eintragenals presence_radar + Funktion setzen)
2. Hard Refresh im Browser (Strg+Shift+R)
3. Nach 7+ Tagen Daten: Schlaf-Charts pruefen ob Daten erscheinen

---

---

## Sitzung 15.03.2026 - Phase 8: Sensor-Tabellen-Refactoring + Zwei-Ebenen-Belegungslogik (v0.33.4)

### Abgeschlossen
- **SensorList.tsx komplett refactored**: 7 Sensor-Checkboxen (isHallway, isBathroomSensor, isKitchenSensor, isFP2Bed, isFP2Living, isVibrationBed + isNightSensor) ersetzt durch 1 "Funktion / Rolle"-Dropdown
- **Typ+Funktion-Capability-Matrix**: Welche Analysen durch Typ+Funktion aktiviert werden:
  - Bewegung + Flur/Gang → Ganggeschwindigkeit
  - Bewegung/Praesenz + Bad/WC → Nykturie-Zaehlung
  - Bewegung/Praesenz + Kueche/Essbereich → Essrhythmus
  - Praesenz-Radar + Bett → Schlafanalyse, Bettbelegung
  - Praesenz-Radar + Wohnzimmer → Personenzaehlung (Haushaltstyp)
  - Vibration + Bett → Schlafunruhe, Tremor-Erkennung
- **Backward-Kompatibilitaet**: Alte Boolean-Flags (isBathroomSensor etc.) werden automatisch in sensorFunction migriert (getEffectiveSF-Funktion) - bestehende Konfigurationen funktionieren ohne manuelle Aenderung
- **Orthogonale Flags** bleiben als Checkboxen: Solar (Temp.-Sensoren), Ausgang, Duplikate, Nacht
- **Capability-Legende** als farbige Chips unter der Tabelle
- **recorder.js**: Leitet Flags aus sensorFunction + type ab (+ Fallback auf alte Flags)
- **main.js (3 Stellen)**: _bathroomDevIds, _kitchenDevIds, hallwayConf nutzen nun sensorFunction als zusaetzliches Kriterium
- **Zwei-Ebenen-Belegungslogik implementiert**:
  - Wohnzimmer-FP2 (sensorFunction='living'): personCount → system.currentPersonCount + system.householdType (live)
  - Schlafzimmer-FP2 (sensorFunction='bed'): personCount → this._liveBedPersonCount (Cache)
  - In-Memory-Cache: this._livePersonCount + this._liveBedPersonCount fuer zukuenftige Echtzeit-Nutzung

### Nächste Schritte
1. Im Settings-Tab: FP2-Sensoren umstellen auf Typ "Praesenz-Radar" + passende Funktion (bed/living)
2. Browser Hard Refresh nach Deploy (Strg+Shift+R)
3. Phase 5: Wassersensor-Integration (moisture + bed → Inkontinenz/UTI)

---

## Sitzung 13.03.2026 â€” Phase 2 VervollstÃ¤ndigung: isKitchenSensor + Nykturie + Essrhythmus (v0.33.2)

### Was umgesetzt wurde

**SensorList.tsx â€” neues Flag `isKitchenSensor`:**
- Import `KitchenIcon` (@mui/icons-material)
- Neue Spalte in der Sensor-Tabelle (grÃ¼nes Icon, Tooltip: "Kueche/Essbereich - Essrhythmus-Analyse")
- Konsistent mit bestehenden Flags: `isHallway`, `isBathroomSensor`, `isNightSensor`, `isExit`

**recorder.js â€” Flags in Events speichern:**
- `isBathroomSensor` und `isKitchenSensor` werden ab jetzt in jedem eventObj gespeichert
- Vorher: eventObj enthielt nur timestamp/id/name/type/location/value â†’ Flags fehlten in History-Dateien!

**main.js â€” saveDailyHistory: 2 neue Felder im Snapshot:**
- `nocturiaCount`: Anzahl eindeutiger Nachtstunden (22-06 Uhr) mit Badezimmer-Sensor-AuslÃ¶sung
- `kitchenVisits`: Anzahl eindeutiger Stunden mit KÃ¼chen-Sensor-AktivitÃ¤t
- Beide per Device-ID-Lookup aus `this.config.devices` + Event-Flag als Fallback

**main.js â€” Digest-Builder: neue Felder aus History-Dateien laden:**
- `nocturiaCount` und `kitchenVisits` werden aus Snapshot gelesen
- Fallback fÃ¼r alte Dateien ohne Flag: Device-ID-Lookup via `_bathroomIds`/`_kitchenIds`

**health.py â€” 3 neue Disease Scores in `compute_disease_scores()`:**

| Profil | Basiert auf | Min. Sensor | Referenz |
|---|---|---|---|
| `diabetes2` | Nykturie (45%) + KÃ¼che (25%) + AktivitÃ¤t (20%) + Hygiene (10%) | isBathroomSensor | van Dijk et al., Diabetologia 2006 |
| `depression` | AktivitÃ¤t (30%) + KÃ¼che (25%) + Raum-MobilitÃ¤t (25%) + Hygiene (20%) | isKitchenSensor empfohlen | APA DSM-5, Panza et al. 2010 |
| `socialIsolation` | Raum-MobilitÃ¤t (35%) + AktivitÃ¤t (30%) + KÃ¼che (20%) + Hygiene (15%) | keine neuen Sensoren | Cacioppo & Hawkley 2003 |

- `diabetes2`: Score ist `null` + Level `SENSOR_MISSING` wenn weder nocturia noch kitchen-Daten vorhanden
- `depression` / `socialIsolation`: Score wird immer berechnet; `sensorNote` wenn KÃ¼che fehlt
- Neue Hilfsfunktion `nocturia_score(baseline, recent)`: Ratio-basiert, 150% Empfindlichkeit

### Warum isBathroomSensor fÃ¼r Nykturie reicht
Normaler PIR-Sensor im Bad â†’ AURA zÃ¤hlt AuslÃ¶sungen zwischen 22-06 Uhr â†’ eindeutige Stunden
>2 nÃ¤chtliche Stunden mit Bad-AktivitÃ¤t Ã¼ber Baseline = Nykturie-Indikator (van Dijk 2006)
Kein neues GerÃ¤t nÃ¶tig!

### Offene Baustellen (Phase 2)
- `cardiovascular`, `parkinson`, `copd`, `sleepDisorder`: BenÃ¶tigen noch spezifischere Daten
  (Herzrhythmus, Tremor-Erkennung, SpO2 â†’ Wearable nÃ¶tig)
- `diabetes1`, `epilepsy`, `bipolar`, `longCovid`: Phase 5 (spezialisierte Sensoren)

### NÃ¤chster logischer Schritt
- Phase 4: Haushaltstyp-Konfiguration (single/multi) â€” geplant (s. Block unten)
- Oder: Gemini-Integration fÃ¼r Screening-Wochenbericht (Phase 3 Erweiterung)

---

## Naechste Schritte (Stand 14.03.2026)

1. **Phase 5 -- Wassersensor**: Sensortyp `moisture` + Funktion Bett + UTI/Inkontinenz-Profil in health.py
   State-Pfad: `zigbee.0.00158d000b7e8275`

2. **Sensor-Tab**: FP2 + Vibrationssensor in Sensor-Liste eintragen (manuell durch Nutzer)
   Dann: 7+ Tage Daten sammeln fuer sleepDisorder Baseline

3. **Zwei-Ebenen-Belegungslogik**: Wohnzimmer-FP2 = Haus-Belegung, Schlafzimmer-FP2 = Persoenliche Zone
   Algorithmus: wenn Schlafzimmer-FP2 value=1, laufen alle Bett-Analysen normal
   (Konzept fertig, Umsetzung nach Phase 5)

Fuer Roadmap + Architektur-Entscheidungen: siehe BRAINSTORMING.md

---
## Sitzung 14.03.2026 â€” Phase 4: FP2 + Vibrationssensor Integration (v0.33.3)

### Umgesetzt

**SensorList.tsx -- neue Typen + Flags:**
- Sensortyp "Praesenz-Radar (FP2)" (presence_radar)
- Sensortyp "Vibration"
- Sensortyp "Feuchtigkeit/Wasser" (moisture, fuer spaeter)
- Flag isFP2Bed -- Bett-Zone (Schlafanalyse)
- Flag isFP2Living -- Wohnzimmer (Personenzaehlung)
- Flag isVibrationBed -- Vibrationssensor am Lattenrost

**recorder.js:**
- isFP2Bed, isFP2Living, isVibrationBed werden in Events gespeichert

**main.js:**
- Abonniert automatisch .value-States aller presence_radar Sensoren
- Neue Snapshot-Felder: maxPersonsDetected, bedPresenceMinutes, nightVibrationCount
- FP2 value-State-Aenderungen aktualisieren personCount im letzten Event

**health.py -- neuer sleepDisorder Score:**
- Basiert auf: Bett-Praesenz-Rueckgang (35%) + Vibrations-Zunahme (30%) + Nacht-Unruhe (20%) + Nykturie (15%)
- Zeigt SENSOR_MISSING wenn weder FP2-Bett noch Vibrationssensor konfiguriert
- Automatische Haushaltstyp-Erkennung: wenn maxPersonsDetected >= 2 -> household_type = multi
- _meta Block in allen Disease-Score-Ergebnissen: householdType, maxPersonsDetected

### Sensor-Pfade (einzutragen in Settings)
| Sensor | ioBroker-Pfad | Typ | Flag |
|---|---|---|---|
| FP2 Schlafzimmer gesamt | homekit-controller.0.IP-3A:63:AF:4F:8E:37.1.sensor-occupancy-2688.occupancy-detected | presence_radar | - |
| FP2 Schlafzimmer Bett-Zone | homekit-controller.0.IP-3A:63:AF:4F:8E:37.1.sensor-occupancy-2692.occupancy-detected | presence_radar | isFP2Bed |
| FP2 Wohnzimmer Zone1 | homekit-controller.0.IP-74DF7A:C5:02:46.1.sensor-occupancy-2688.occupancy-detected | presence_radar | isFP2Living |
| FP2 Wohnzimmer Zone2 | homekit-controller.0.IP-74DF7A:C5:02:46.1.sensor-occupancy-2692.occupancy-detected | presence_radar | isFP2Living |
| FP2 Wohnzimmer Zone3 | homekit-controller.0.IP-74DF7A:C5:02:46.1.sensor-occupancy-2696.occupancy-detected | presence_radar | isFP2Living |
| Vibrationssensor Bett | zigbee.0.00158d008bc16ddd.vibration | vibration | isVibrationBed |
| Wassersensor | zigbee.0.00158d000b7e8275 | moisture | - (Phase 5) |

### Was jetzt funktioniert
- FP2 Sensoren werden in der Sensor-Liste eingetragen und aufgezeichnet
- Nach 7+ Tagen: sleepDisorder Score wird berechnet
- Nach ersten Tagen mit value >= 2: Haushaltstyp wird automatisch erkannt

### Noch offen (Phase 5)
- Wassersensor: neues Krankheitsprofil UTI/Inkontinenz
- Parkinson Score mit Vibrationssensor-Tremor-Intensitaet (strength-Wert)

---
## Sitzung 13.03.2026 â€” Bugfix v0.33.1: ScreeningPanel ReferenceError

### Problem
Beim Klick auf "Proaktives Screening" im Medizinisch-Tab: weiÃŸer Bildschirm mit
`ReferenceError: ScreeningPanel is not defined`.

### Ursache
Die `ScreeningPanel`-Funktion wurde in einem frÃ¼heren PowerShell-EinfÃ¼ge-Block nie
korrekt in `MedicalTab.tsx` geschrieben. Der Block landete still im Nirvana.
Nur die Verwendungsstellen (JSX-Aufruf + State-Hooks) waren vorhanden, nicht die
Funktionsdefinition selbst.

### Fix
- `ScreeningPanel`-Komponente vollstÃ¤ndig neu in `MedicalTab.tsx` eingefÃ¼gt (via Node.js-Skript, sicher vor PowerShell-Escaping)
- EnthÃ¤lt: Typ-Interfaces (`ScreeningResult`, `ScreeningHint`, `ScreeningSignalDetail`), Helper-Funktionen (`confidenceColor`, `confidenceLabel`, `SCREENING_SIGNAL_LABELS`), vollstÃ¤ndige Render-Logik mit Disclaimer, Hint-Cards, Metrik-Ãœbersicht
- Version auf `0.33.1` gebumpt
- Neugebaut: `index-Ch623hFD.js` â†’ Upload + Restart â†’ Push `01f812f`

### Versionierungs-Regel (NEU â€” gilt ab sofort)
**Jede einzelne Ã„nderung, die in GitHub hochgeladen wird, bekommt eine eigene Versionsnummer.**
Auch kleinste Bugfixes â†’ Patch-Version (z.B. 0.33.0 â†’ 0.33.1 â†’ 0.33.2).
So ist GitHub immer eindeutig und man sieht sofort wenn ein neuer Upload vorhanden ist.

```
Patch:  0.33.0 â†’ 0.33.1  (Bugfix / kleines Fix)
Minor:  0.33.x â†’ 0.34.0  (neue Feature / Phase)
Major:  0.x.y  â†’ 1.0.0   (grundlegendes Redesign)
```

### Deploy-Workflow (vollstÃ¤ndig, immer ausfÃ¼hren)
```
1. npm run build                       # Vite baut nach ../admin/
2. node iobroker.js upload cogni-living  # Admin-Dateien zu ioBroker
3. node iobroker.js restart cogni-living # Adapter neu starten
4. Version in package.json + io-package.json bumpen
5. git add -A && git commit -m "..."
6. git push
7. PROJEKT_STATUS.md updaten (APPEND-ONLY, neuer Block oben)
```
Strg+Shift+R (Hard Refresh) im Browser nach jedem Deploy!

---

## Sitzung 13.03.2026 â€” KRITISCHER BUGFIX: Build-Script kaputt seit v0.31.3

---

## Sitzung 13.03.2026 - KRITISCHER BUGFIX: Build-Script kaputt seit v0.31.3

### Root Cause (warum MedicalTab NIE wirklich deployed war)

Das build:react Script in package.json hatte einen fatalen Fehler:
```
# ALT (kaputt):
cd src-admin && npm install && npm run build
  && cd .. && rimraf admin && xcopy src-admin\build admin
#                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
# Vite schreibt nach ../admin (outDir: ../admin)
# rimraf loescht den frisch gebauten admin/ sofort wieder!
# xcopy kopiert danach den ALTEN src-admin\build (kein MedicalTab) zurueck

# NEU (gefixt):
cd src-admin && npm install && npm run build
# Vite schreibt mit emptyOutDir:true selbst nach ../admin - fertig.
```
Folge: Phase 1 (MedicalTab) und Phase 2 (Scores) waren NIE wirklich served.
ioBroker lief mit dem Build von vor Phase 1 (v0.31.3 Vorlage).

### Was im Fix-Commit (13.03.2026 16:xx) enthalten ist
- build:react Script in package.json gefixt (rimraf+xcopy entfernt)
- Neugebaut: index-DNZbWo9k.js (enthaelt MedicalTab + Screening)
- Versionen korrekt auf 0.33.0 gebumpt (doppeltes Leerzeichen im JSON beachten!)
- git push origin main

### Verifikation
index-DNZbWo9k.js enthaelt: Medizinisch=True, Krankheitsbild=True, Screening=True
iobroker upload zeigt: version 0.33.0

---

## Sitzung 13.03.2026 - Phase 3: Proaktives Screening / Reverse-Diagnose (v0.33.0)

### Abgeschlossen

**Python `compute_screening_hints()` + `DISEASE_SIGNATURES` in `health.py`:**
- 10 Krankheits-Signaturen implementiert: fallRisk, dementia, frailty, depression, socialIsolation, cardiovascular, parkinson, copd, sleepDisorder, longCovid
- Jede Signatur definiert: gewichtete Signale + Schwellwerte + min. aktive Signale fÃ¼r Hinweis
- `compute_screening_hints()`: berechnet 8 Metrik-Scores (activityDecline, gaitSlowdown, nightExcess, roomMobilityDecline, hygieneDecline, ventilationDecline, activityDrift, ...)
- Confidence-Score pro Krankheit: gewichteter Anteil aktiver Signale (0-1)
- Sortierung nach Confidence (hoher Wert = relevanter Hinweis)
- Inkl. Disclaimer-Logik: "Kein Diagnose-System"

**Python `ANALYZE_SCREENING` Command in `service.py`:**
- Neuer Dispatch-Handler: empfÃ¤ngt `digests`, gibt `SCREENING_RESULT` mit hints, metrics, dataPoints, screeningDate zurÃ¼ck

**Node.js `src/main.js`:**
- Neuer State: `analysis.health.screening.hints` (JSON)
- `ANALYZE_SCREENING` wird automatisch nach `ANALYZE_DISEASE_SCORES` ausgefÃ¼hrt
- Enabled Profiles jetzt **dynamisch** aus `this.config.healthProfiles` gelesen (statt hardcoded `['fallRisk', 'dementia', 'frailty']`)
- Fallback: wenn keine Profile aktiviert â†’ Basis-Profile werden trotzdem berechnet

**Frontend `MedicalTab.tsx` - ScreeningPanel:**
- Neue Komponente `ScreeningPanel` mit:
  - Header (Datum, Datenpunkte)
  - GroÃŸer Disclaimer (kein Diagnose-System)
  - "Keine AuffÃ¤lligkeiten" Success-Screen (wenn alles normal)
  - Hint-Karten pro Krankheitsbild: Confidence-Badge (farbig), aktive Signal-Chips, Empfehlungstext
  - Metrik-Ãœbersicht (Balken aller 8 Metriken)
- "Proaktives Screening" Button oben in der Sidebar (Badge zeigt Anzahl aktiver Hinweise)
- State-Loading via `socket.getState + socket.subscribeState` fÃ¼r `screening.hints`
- Unterscheidung: Krankheit bereits aktiviert vs. neu erkannte AuffÃ¤lligkeit

### Technische Details

**Confidence-Farbsystem:**
- >= 70%: Rot (Deutlich)
- >= 50%: Orange (AuffÃ¤llig)
- >= 30%: Gelb (Leicht)
- < 30%: GrÃ¼n (Gering)

**Signal-Schwellwerte (Beispiele):**
- Sturzrisiko: gaitSlowdown >= 18%, nightExcess >= 30%, roomMobility >= 20% â†’ min. 2 Signale
- Demenz: activityDrift >= 25%, roomMobility >= 20%, gaitSlowdown >= 15% â†’ min. 3 Signale
- Depression: activityDecline >= 20%, roomMobility >= 25%, hygiene >= 25% â†’ min. 3 Signale

### Deploy-Workflow (IMMER nach Code-Aenderungen)
```
1. npm run build                   # Frontend + Backend (dev)
2. npm run build:backend:prod      # Backend obfuskieren (vor git push!)
3. node node_modules/iobroker.js-controller/iobroker.js upload cogni-living
4. node node_modules/iobroker.js-controller/iobroker.js restart cogni-living
5. Versionsnummern hochzaehlen: package.json UND io-package.json
6. git add .
   git commit -m "feat/fix: Beschreibung vX.Y.Z"
   git push origin main
```
HINWEIS: "npm run build:prod" existiert NICHT! Richtig: "npm run build:backend:prod"

### Offene Baustellen
- Phase 3 Erweiterung: Gemini-Integration â€” Screening-Hinweise als natÃ¼rlichsprachlicher Wochenbericht
- Phase 2 Erweiterung: Weitere Profile in Disease-Scores (Depression, Schlaf, Diabetes T2)
- Phase 4: Aqara FP2 als neuer Sensortyp `presence_radar_zoned` im Recorder

### Naechster logischer Schritt
- Gemini-Integration: Screening-Ergebnisse werden als Wochenbericht formuliert (mit Disclaimer-Template)
- Oder: Phase 2 erweitern â€” Depression + SchlafstÃ¶rungen als weitere Score-Profile

### Neue ioBroker-States (v0.33.0)
| State | Typ | Beschreibung |
|---|---|---|
| `analysis.health.screening.hints` | JSON | Proaktive Screening-Hinweise (hints, metrics, dataPoints, screeningDate) |

### Aufgeloeste Bugs / Verbesserungen
- Enabled Profiles in DiseaseScore-Berechnung war hardcoded `['fallRisk', 'dementia', 'frailty']` â€” jetzt dynamisch aus Config

---
**Letzte Aktualisierung:** 13.03.2026 | **Version:** 0.33.0 (Phase 3: Proaktives Screening)

---

## Sitzung 13.03.2026 - Phase 3: Proaktives Screening / Reverse-Diagnose (v0.33.0)

### Abgeschlossen

**Python `compute_screening_hints()` + `DISEASE_SIGNATURES` in `health.py`:**
- 10 Krankheits-Signaturen implementiert: fallRisk, dementia, frailty, depression, socialIsolation, cardiovascular, parkinson, copd, sleepDisorder, longCovid
- Jede Signatur definiert: gewichtete Signale + Schwellwerte + min. aktive Signale fÃ¼r Hinweis
- `compute_screening_hints()`: berechnet 8 Metrik-Scores (activityDecline, gaitSlowdown, nightExcess, roomMobilityDecline, hygieneDecline, ventilationDecline, activityDrift, ...)
- Confidence-Score pro Krankheit: gewichteter Anteil aktiver Signale (0-1)
- Sortierung nach Confidence (hoher Wert = relevanter Hinweis)
- Inkl. Disclaimer-Logik: "Kein Diagnose-System"

**Python `ANALYZE_SCREENING` Command in `service.py`:**
- Neuer Dispatch-Handler: empfÃ¤ngt `digests`, gibt `SCREENING_RESULT` mit hints, metrics, dataPoints, screeningDate zurÃ¼ck

**Node.js `src/main.js`:**
- Neuer State: `analysis.health.screening.hints` (JSON)
- `ANALYZE_SCREENING` wird automatisch nach `ANALYZE_DISEASE_SCORES` ausgefÃ¼hrt
- Enabled Profiles jetzt **dynamisch** aus `this.config.healthProfiles` gelesen (statt hardcoded `['fallRisk', 'dementia', 'frailty']`)
- Fallback: wenn keine Profile aktiviert â†’ Basis-Profile werden trotzdem berechnet

**Frontend `MedicalTab.tsx` - ScreeningPanel:**
- Neue Komponente `ScreeningPanel` mit:
  - Header (Datum, Datenpunkte)
  - GroÃŸer Disclaimer (kein Diagnose-System)
  - "Keine AuffÃ¤lligkeiten" Success-Screen (wenn alles normal)
  - Hint-Karten pro Krankheitsbild: Confidence-Badge (farbig), aktive Signal-Chips, Empfehlungstext
  - Metrik-Ãœbersicht (Balken aller 8 Metriken)
- "Proaktives Screening" Button oben in der Sidebar (Badge zeigt Anzahl aktiver Hinweise)
- State-Loading via `socket.getState + socket.subscribeState` fÃ¼r `screening.hints`
- Unterscheidung: Krankheit bereits aktiviert vs. neu erkannte AuffÃ¤lligkeit

### Technische Details

**Confidence-Farbsystem:**
- >= 70%: Rot (Deutlich)
- >= 50%: Orange (AuffÃ¤llig)
- >= 30%: Gelb (Leicht)
- < 30%: GrÃ¼n (Gering)

**Signal-Schwellwerte (Beispiele):**
- Sturzrisiko: gaitSlowdown >= 18%, nightExcess >= 30%, roomMobility >= 20% â†’ min. 2 Signale
- Demenz: activityDrift >= 25%, roomMobility >= 20%, gaitSlowdown >= 15% â†’ min. 3 Signale
- Depression: activityDecline >= 20%, roomMobility >= 25%, hygiene >= 25% â†’ min. 3 Signale

### Offene Baustellen
- Phase 3 Erweiterung: Gemini-Integration â€” Screening-Hinweise als natÃ¼rlichsprachlicher Wochenbericht
- Phase 2 Erweiterung: Weitere Profile in Disease-Scores (Depression, Schlaf, Diabetes T2)
- Phase 4: Aqara FP2 als neuer Sensortyp `presence_radar_zoned` im Recorder

### Naechster logischer Schritt
- Gemini-Integration: Screening-Ergebnisse werden als Wochenbericht formuliert (mit Disclaimer-Template)
- Oder: Phase 2 erweitern â€” Depression + SchlafstÃ¶rungen als weitere Score-Profile

### Neue ioBroker-States (v0.33.0)
| State | Typ | Beschreibung |
|---|---|---|
| `analysis.health.screening.hints` | JSON | Proaktive Screening-Hinweise (hints, metrics, dataPoints, screeningDate) |

### Aufgeloeste Bugs / Verbesserungen
- Enabled Profiles in DiseaseScore-Berechnung war hardcoded `['fallRisk', 'dementia', 'frailty']` â€” jetzt dynamisch aus Config

---
**Letzte Aktualisierung:** 12.03.2026 | **Version:** 0.32.0 (Phase 2: Krankheits-Risiko-Scores)

---

## ðŸ—“ï¸ Sitzung 12.03.2026 â€” Phase 2: Krankheits-Risiko-Scores (v0.32.0)

### âœ… Abgeschlossen

**Python `compute_disease_scores()` in `health.py`:**
- Kalibrierungsbasierter Vergleich: erste 14 Tage = persÃ¶nliche Baseline
- Erkennungsphase: letzte 7 Tage vs. Baseline
- Normalisierte Komponenten (0-100): Gangverlangsamung, Nacht-Unruhe, Raum-RÃ¼ckgang, AktivitÃ¤tsrÃ¼ckgang, Hygiene-RÃ¼ckgang
- Implementiert fÃ¼r: **Sturzrisiko, Demenz, Frailty** (Phase 2)
- Risk-Level: MINIMAL / LOW / MODERATE / HIGH / CRITICAL

**Python `ANALYZE_DISEASE_SCORES` Command in `service.py`:**
- Neuer Dispatch-Handler: empfÃ¤ngt `digests + enabledProfiles`, gibt `DISEASE_SCORES_RESULT` zurÃ¼ck

**Node.js `main.js` â€” Disease States:**
- Neue ioBroker-States: `analysis.health.disease.scores` (JSON) + `analysis.health.disease.<id>` (Zahl) fÃ¼r alle 14 Profile
- Automatischer Aufruf nach `TRAIN_HEALTH` (wenn `triggerHealth` feuert)
- Callback speichert Scores als States (persistent Ã¼ber Neustarts)

**Frontend `MedicalTab.tsx` â€” RiskScorePanel:**
- Neue Komponente `RiskScorePanel` zeigt echten Score als Progress-Balken
- Level-Badge (farbig: grÃ¼n/gelb/rot/lila)
- Einzel-Faktor-Balken pro Komponente (Gangverlangsamung, Nacht-Unruhe etc.)
- Kalibrierungs- und Datenpunkte-Info
- Disclaimer: "Kein Diagnose-System"
- State-Fetch via socket.getState + socket.subscribeState (live-aktuell)

### ðŸ› Kritische Erkenntnisse (Build-Architektur)

**WICHTIG fÃ¼r zukÃ¼nftige Sitzungen â€” Build-Workflow:**
- âŒ `lib/main.js` = NUR lesbare Kopie, wird NICHT gebaut (tÃ¤uscht als Quelle)
- âœ… `src/main.js` = ECHTER Quellcode â†’ wird zu root `main.js` obfuskiert
- âœ… `src/lib/*.js` â†’ werden zu `lib/*.js` obfuskiert
- Root `main.js` wird von ioBroker ausgefÃ¼hrt (aus `node_modules/iobroker.cogni-living/`)
- Richtiger Deploy-Workflow: `src/main.js` bearbeiten â†’ `npm run build:backend:prod` â†’ `iobroker restart cogni-living`

**Drei Bugs die Phase 2 blockierten (alle gefixt):**
1. Code wurde in `lib/main.js` statt `src/main.js` geschrieben â†’ Build ignorierte Ã„nderungen
2. `socket.getState` in MedicalTab mit Callback statt Promise (`.then()`) â†’ State wurde nie gelesen
3. Disease-Score-Berechnung war in `if (this.isProVersion)` Block â†’ ohne Lizenz nie ausgefÃ¼hrt

### ðŸ”§ Offene Baustellen
- Phase 3: Proaktives Screening / Reverse-Diagnose
- Phase 3: Gemini-Integration fÃ¼r Screening-Hinweise in natÃ¼rlicher Sprache
- Phase 2 Erweiterung: Weitere Profile (Depression, Schlaf, Diabetes T2)
- Phase 4: Aqara FP2 als neuer Sensortyp `presence_radar_zoned` im Recorder

### ðŸŽ¯ NÃ¤chster logischer Schritt
- Phase 3: `DISEASE_SIGNATURES` dict in Python â€” Reverse-Diagnose
  Muster erkannt â†’ Hinweis: "AuffÃ¤lligkeiten, die bei X typisch sind" (mit Disclaimer)
- Gemini-Integration: Proaktive Hinweise in Wochenberichten

### ðŸ“‹ Neue ioBroker-States (v0.32.0)
| State | Typ | Beschreibung |
|---|---|---|
| `analysis.health.disease.scores` | JSON | Alle Scores komplett mit Faktoren |
| `analysis.health.disease.fallRisk` | Zahl | Sturzrisiko-Score 0-100 |
| `analysis.health.disease.dementia` | Zahl | Demenz-Score 0-100 |
| `analysis.health.disease.frailty` | Zahl | Frailty-Score 0-100 |
| `analysis.health.disease.<profil>` | Zahl | Alle 14 Profile |

### âš™ï¸ Wie die Scores aktualisiert werden
1. Nutzer klickt "Analyse starten" im Gesundheit-Tab
2. `triggerHealth` State â†’ Node.js â†’ `TRAIN_HEALTH` an Python
3. **NEU**: danach automatisch `ANALYZE_DISEASE_SCORES` falls Profile aktiviert
4. Python berechnet Scores â†’ Node.js speichert als States
5. MedicalTab liest States und zeigt RiskScorePanel live

---

## ðŸ—“ï¸ Sitzung 12.03.2026 â€” Phase 1: Medizinische Perspektive (v0.31.6)

### âœ… Abgeschlossen

**1a â€” Datenmodell `healthProfiles` in `io-package.json`:**
- 14 Krankheitsprofile als native Config angelegt: `fallRisk`, `dementia`, `frailty`, `depression`, `diabetes2`, `sleepDisorder`, `cardiovascular`, `parkinson`, `copd`, `socialIsolation`, `epilepsy`, `diabetes1`, `longCovid`, `bipolar`
- Jedes Profil: `{ enabled: false, sensitivity: "medium" }`

**1b â€” Sensor-Validierungslogik (`diseaseProfiles.ts`):**
- Neues Modul: `src-admin/src/components/medical/diseaseProfiles.ts`
- 14 vollstÃ¤ndige Krankheitsprofile mit klinischer Evidenz (Literaturzitate)
- Sensor-Anforderungen (required + optional) pro Krankheitsbild
- `validateDiseaseReadiness()`: prÃ¼ft vorhandene Sensoren gegen Anforderungen
- `validateAllProfiles()`: validiert alle 14 Profile auf einmal
- Markt-Scores (Einperson + Mehrperson), Machbarkeit-Flags, FP2-Empfehlung

**1c + 1d â€” MedicalTab.tsx (neue "Medizinische Perspektive"):**
- Neuer Tab "Medizinisch" (MedicalServicesIcon, pink #e91e63) in `app.tsx`
- Sidebar (320px): Krankheiten gruppiert nach Senioren/Erwachsene/Kinder
- Toggle-Switch pro Krankheit mit Ampel-Badge (ðŸŸ¢/ðŸŸ¡/ðŸ”´)
- Kollabierbare Sensor-Schnellansicht pro Karte
- Rechtes Panel: Disease-Dashboard mit:
  - Sensor-Bereitschaft Progress-Bar
  - Fehlende/vorhandene Sensoren Banner
  - Klinische Evidenz
  - Relevante Metriken-Karten (verknÃ¼pft mit Gesundheit-Tab)
  - Mehrpersonen-Machbarkeit-Hinweis
  - Markt-Score Visualisierung
- Sensor-Validierungs-Dialog mit vollstÃ¤ndiger Checkliste + Kaufhinweisen
- FP2-Empfehlung fÃ¼r Krankheiten die Multi-Person-Tracking benÃ¶tigen
- Wichtiger Disclaimer: kein Diagnose-System

**Build & Deploy:**
- `npm run build` âœ… (Vite 7.2.4, 8.45s)
- `npm run build:backend:dev` âœ…
- `iobroker upload cogni-living` âœ…

### ðŸ”§ Offene Baustellen
- Phase 2: Krankheits-Risiko-Score Aggregation in `HealthBrain.compute_disease_scores()` (Python)
- Phase 2: Disease-spezifische Dashboard-Kacheln mit echten ioBroker-States
- Phase 3: Proaktives Screening / Reverse-Diagnose
- Phase 4: Aqara FP2 als neuer Sensortyp `presence_radar_zoned` im Recorder

### ðŸŽ¯ NÃ¤chster logischer Schritt
- Phase 2: Backend â€” `compute_disease_scores()` im HealthBrain implementieren
- Sturzrisiko + Demenz + Frailty als erste drei vollstÃ¤ndige Profile mit echten Score-Werten

### ðŸ“Š Medizinische Perspektive â€” Krankheitsprofile

| Krankheit | Zielgruppe | Score 1P | Score MP | Machbarkeit MP |
|-----------|-----------|---------|---------|----------------|
| Sturzrisiko | Senior | 98 | 90 | Sehr gut |
| Demenz | Senior | 97 | 49 | Schwierig |
| Frailty | Senior | 92 | 46 | Schwierig |
| Diabetes T2 | Senior | 80 | 60 | EingeschrÃ¤nkt |
| SchlafstÃ¶rungen | Alle | 78 | 59 | EingeschrÃ¤nkt |
| Depression | Erwachsene | 75 | 38 | Schwierig |
| Herzinsuffizienz | Senior | 75 | 38 | Schwierig |
| COPD | Senior | 72 | 36 | Schwierig |
| Soz. Isolation | Senior | 70 | 7 | N/A |
| Epilepsie | Kinder | 68 | 76 | Sehr gut |
| Parkinson | Senior | 65 | 52 | EingeschrÃ¤nkt |
| Diabetes T1 | Kinder | 65 | 72 | Sehr gut |
| Long-COVID | Erwachsene | 62 | 31 | Schwierig |
| Bipolar | Erwachsene | 58 | 29 | Schwierig |

---

## ðŸ§  Konzept-Kontext (Sitzung 12.03.2026) â€” fÃ¼r Kontext-Reset-Festigkeit

> Chat-Referenz: UUID `a985de23-ae43-48ca-9afe-2333a0bf899f` (Cursor Agent Transcripts)
> VollstÃ¤ndiges Brainstorming dort abrufbar. Hier die wichtigsten Entscheidungen komprimiert.

### ðŸŽ¯ Strategische Produktvision: AURA als medizinisches AAL-System

Das System soll durch **passive GebÃ¤ude-Sensorik** (keine Wearables) den Gesundheitszustand
von Bewohnern monitoren. Kernzielgruppen: AngehÃ¶rige von Senioren (Pflegeheim vermeiden),
Eltern von kranken Kindern (Epilepsie, Diabetes T1).

**Zwei UI-Perspektiven** (implementiert in Phase 1):
- **Technische Perspektive**: bisherige Tabs (Dashboard, Komfort, Sicherheit, Energie, Gesundheit, System)
- **Medizinische Perspektive**: neuer Tab "Medizinisch" â€” Krankheitsbilder als Checkboxen,
  Algorithmen laufen im Hintergrund, Sensor-Validierung mit Ampel-System

### ðŸ“Š Priorisierung der 14 implementierten Krankheitsprofile

**Implementierungsreihenfolge (Phase 2+):**
- Phase 2 (sofort): Sturzrisiko + Demenz + Frailty (hÃ¶chster Markt-Score, Algorithmen fast fertig)
- Phase 3: Depression + SchlafstÃ¶rungen + Diabetes T2
- Phase 4 (Kinder, Differenzierung): Epilepsie + Diabetes T1 + ADHS

**Wichtigste Erkenntnis Mehrpersonen vs. Einperson:**
- Sturzrisiko, Epilepsie, Diabetes T1 funktionieren GUT im Mehrpersonenhaushalt
  (diskrete Events / dedizierter Raum)
- Demenz, Frailty, Depression SCHWIERIG ohne Multi-Person-Tracking
- **Aqara FP2 (mmWave-Radar) ist der strategische Enabler fÃ¼r Mehrpersonenhaushalte**

### ðŸ”¬ Sensorik-Empfehlungen (diskutiert und entschieden)

**Aqara FP2 vs. FP300:**
| | FP2 | FP300 |
|---|---|---|
| Sturzerkennung | âœ… JA | âŒ NEIN |
| Multi-Person (bis 5) | âœ… JA | âŒ Nur 1 Person |
| Schlaf-Monitoring | âœ… JA | âŒ NEIN |
| Batterie | âŒ Kabel | âœ… 3 Jahre |
| Temp/Feuchte | âŒ | âœ… JA |
| Preis | ~70â‚¬ | ~50â‚¬ |

**Empfohlenes Layout pro Wohnung:**
- FP2 an Decke: Schlafzimmer (Sturz + Schlaf), Wohnzimmer (Multi-Person), Flur (Ganggeschwindigkeit)
- FP300 batteriebetrieben: Bad, KÃ¼che, NebenrÃ¤ume
- Kosten gesamt: ~385â‚¬ fÃ¼r 4-Zimmer-Wohnung vs. 3.000-5.000â‚¬/Monat Pflegeheim

**Weitere empfohlene Spezialsensoren:**
- Vibrationssensor Bett (Aqara, ~12â‚¬): Epilepsie + Diabetes T1 ErgÃ¤nzung
- Kontaktsensor KÃ¼hlschrank (~10â‚¬): Mahlzeiten-Tracking, Demenz
- CO2-Sensor Schlafzimmer: SchlafqualitÃ¤t-Korrelation
- Smarte Waage: Herzinsuffizienz (Ã–deme), Niereninsuffizienz

### ðŸ—ºï¸ Geplante Phasen-Roadmap

```
Phase 1 (DONE v0.31.6): Fundament
  âœ… healthProfiles in io-package.json
  âœ… diseaseProfiles.ts (14 Profile + Validierung)
  âœ… MedicalTab.tsx (Sidebar, Ampel, Disease-Dashboard)
  âœ… app.tsx Tab-Erweiterung

Phase 2 (NEXT â€” v0.32.x): Erste echte Krankheits-Scores
  ðŸ”œ Python: compute_disease_scores() im HealthBrain
     â†’ gewichtet existierende Metriken zu krankheitsspezifischen Risiko-Scores
     â†’ Sturzrisiko: 0.25*gaitSpeed + 0.25*bathroomSilence + 0.20*nightEvents + ...
  ðŸ”œ Frontend: MedicalTab Disease-Dashboard mit echten ioBroker-States
  ðŸ”œ Zuerst: Sturzrisiko + Demenz + Frailty

Phase 3 (v0.33.x): Krankheits-Signatur-Engine
  ðŸ”œ Python: DISEASE_SIGNATURES dict (welche Metriken-Kombination â†’ welche Krankheit)
  ðŸ”œ Proaktives Screening (Reverse-Diagnose, mit Disclaimer)
  ðŸ”œ Gemini-Integration: Screening-Hinweise in natÃ¼rlicher Sprache

Phase 4 (v0.34.x): FP2-Integration + Mehrpersonen
  ðŸ”œ Neuer Sensortyp presence_radar_zoned im Recorder
  ðŸ”œ Multi-Target Particle Filter (personVectors statt todayVector)
  ðŸ”œ Personen-spezifische AktivitÃ¤tsvektoren

Phase 5 (v0.35.x): Kinder-Krankheitsbilder
  ðŸ”œ Epilepsie-Profil mit Anfallserkennung
  ðŸ”œ Diabetes T1 mit HypoglykÃ¤mie-Erkennung
  ðŸ”œ Vibrationssensor-Integration als neuer Sensortyp
```

### ðŸ’¡ Proaktives Screening â€” Konzept (noch nicht implementiert)

Das System soll proaktiv Hinweise geben OHNE Diagnose zu stellen:
- Algorithmus erkennt Muster â†’ vergleicht mit DISEASE_SIGNATURES-Datenbank
- Formulierung: "AuffÃ¤lligkeiten erkannt, die bei X typisch auftreten â€” Arztbesuch empfohlen"
- Dreistufige Alarm-Kaskade: Dashboard-Hinweis â†’ Wochenbericht â†’ Push an AngehÃ¶rige
- Gemini formuliert Hinweis in natÃ¼rlicher Sprache (mit festem Disclaimer-Template)
- Rechtlich: Screening â‰  Diagnose (klar kommuniziert in der UI)

### ðŸ—ï¸ Architektonischer SchlÃ¼sselentscheid

Die bestehenden 14 Algorithmen liefern bereits ~80% der Rohdaten fÃ¼r alle 14 Krankheitsbilder.
Was fehlt ist die **Interpretationsebene** in Python:

```python
def compute_disease_scores(self, metrics, enabled_profiles):
    scores = {}
    if enabled_profiles.get('dementia'):
        scores['dementia'] = (
            0.25 * metrics['night_anomaly'] +
            0.20 * metrics['room_mobility_decline'] +
            0.20 * metrics['gait_speed_decline'] +
            0.15 * metrics['activity_drift'] +
            0.10 * metrics['exit_night_attempts'] +
            0.10 * metrics['morning_routine_missed']
        )
    # ... analog fÃ¼r andere Profile
    return scores
```

Neuer Python-Befehl: `ANALYZE_DISEASE_SCORES` in service.py dispatch-table.

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

## ðŸ—“ï¸ Sitzung 12.03.2026 â€” Version 0.31.4

### âœ… Abgeschlossen

**Morning Briefing Root-Cause gefunden und behoben (seit Wochen offen!):**
- `subscribeStates('analysis.triggerBriefing')` fehlte komplett in `main.js`
- ioBroker ruft `onStateChange` nur fÃ¼r subscribed States auf â€” da nie subscribed, wurde der Handler nie aufgerufen
- Gleiches Problem fÃ¼r `analysis.triggerWeeklyBriefing`
- Fix: beide subscribeStates in `src/main.js` ergÃ¤nzt (Zeile 142-143)

**Obfuskierung reaktiviert:**
- `src/` war veraltet â€” Sync von aktuellen `lib/` und root `main.js` â†’ `src/`
- `npm run build:backend:prod` ausgefÃ¼hrt â†’ alle `.js`-Dateien in `main.js` + `lib/` unleserlich
- Workflow ab jetzt: Quellcode in `src/` bearbeiten, dann `npm run build:backend:prod` vor Commit

### ðŸ”§ Offene Baustellen

| Problem | PrioritÃ¤t | Beschreibung |
|---|---|---|
| `freshAirLong` in `loadWeekData` | ðŸŸ¡ MITTEL | Wochenansicht berechnet StoÃŸlÃ¼ftung noch nicht |
| Python Bridge Timeout | ðŸŸ¡ MITTEL | 10s Timeout vs. 30s Frontend â†’ Drift kann abbrechen |
| AktivitÃ¤ts-Balken Tagesvergleich | ðŸŸ¡ MITTEL | Balken nur bis aktuelle Uhrzeit vergleichen |

### ðŸŽ¯ NÃ¤chster logischer Schritt

1. Adapter v0.31.4 von GitHub laden, neu starten
2. Warten bis 08:00 Uhr morgen â†’ Morning Briefing sollte jetzt kommen
3. Im ioBroker-Log bei Adapter-Start nach `Briefing geplant fÃ¼r 8:00` suchen
4. Danach: `freshAirLong` in `loadWeekData` + Python Bridge Timeout

---

## ðŸ—“ï¸ Sitzung 12.03.2026 â€” Version 0.31.3

### âœ… Abgeschlossen

**Root-Cause des "falschen Builds" gefunden â€” Fresh Air endlich wirklich gefixt:**
- ioBroker serviert Admin UI aus `admin/`, Vite baute aber immer in `src-admin/build/`
- Deshalb lud ioBroker stets `index-DaLhtVVS.js` (ALT) â€” egal was wir in `src-admin/build/` Ã¤nderten
- Fix: `vite.config.mjs` â†’ `outDir: '../admin'` (zukÃ¼nftige Builds gehen direkt ins richtige Verz.)
- `admin/assets/index-DaLhtVVS.js` entfernt, `index-CBIshDQD.js` dorthin kopiert
- `.gitignore`: `src-admin/build/` wird nicht mehr getrackt

**Repo-Bereinigung:**
- 62 temporÃ¤re `_*.js`, `_*.ps1`, `old_*.*` Skripte aus dem Repo entfernt

**Score-Normalisierung verbessert:**
- `health.py predict()`: Neue Formel â†’ `0.0 = normal, 0.5 = mÃ¤ÃŸig anomal, 1.0 = stark anomal`
- Beweis-Logging: `[HealthBrain.predict] raw_score=... | norm_score=... | inlier=...` im ioBroker-Log sichtbar
- Alter Score `0.10` fÃ¼r normale Tage war kein Bug, aber missverstÃ¤ndlich skaliert

**PROJEKT_STATUS.md auf Append-Only umgestellt:**
- Cursor Rule aktualisiert: neue Sitzungen werden oben eingefÃ¼gt, alte bleiben erhalten
- VollstÃ¤ndiges Langzeit-GedÃ¤chtnis Ã¼ber Kontext-Resets hinweg

### ðŸ”§ Offene Baustellen

| Problem | PrioritÃ¤t | Beschreibung |
|---|---|---|
| Morning Briefing Uhrzeit | ðŸ”´ HOCH | User bekommt Pushover-Briefing nicht um 08:00 Uhr â€” mehrfach besprochen, noch nicht zuverlÃ¤ssig gelÃ¶st |
| `freshAirLong` in `loadWeekData` | ðŸŸ¡ MITTEL | Berechnung in HealthTab.tsx fehlt fÃ¼r den Weekly-Data-Pfad (~Zeile 464) |
| Python Bridge Timeout | ðŸŸ¡ MITTEL | `python_bridge.js` hat 10s Timeout, Frontend wartet 30s â†’ Drift-Berechnung kann abbrechen |
| AktivitÃ¤ts-Belastung Tagesvergleich | ðŸŸ¡ MITTEL | User-Idee: Balken nur bis aktuelle Uhrzeit vergleichen (Time-of-Day Normalisierung) |
| LSTM stÃ¼ndliche Erwartung | ðŸŸ¢ NIEDRIG | Geplant â€” zeitlich-bewusstes Anomalie-Modell |

### ðŸŽ¯ NÃ¤chster logischer Schritt

1. Adapter v0.31.3 von GitHub laden, neu starten
2. Admin UI Ã¶ffnen â†’ Fresh Air Kachel sollte jetzt korrekt zÃ¤hlen
3. Im ioBroker-Log nach `[HealthBrain.predict]` suchen â†’ Score-Beweis sichtbar
4. Danach: `freshAirLong` in `loadWeekData` berechnen + Morning Briefing debuggen

---

## ðŸ—“ï¸ Sitzung 12.03.2026 â€” Version 0.31.2

### âœ… Abgeschlossen

**Root-Cause Fresh Air "0x" behoben:**
- `processEvents` in `HealthTab.tsx` crashte bei `evt.name.toLowerCase()` wenn `evt.name == null`
- Fix: `(evt.name || '').toLowerCase()` an Zeilen 752 + 757
- Dead Code (alte Keyword-Matching-Logik) und doppelter `setFreshAirLongCount`-Aufruf entfernt
- `lib/main.js`: Doppelter `const FRESH_AIR_MIN_MS` Block entfernt (SyntaxError)

**BestÃ¤tigter Datenfluss:**
- `events.history` enthÃ¤lt Door-Events: `type: "door"`, `value: 1` (numerisch) âœ…
- `processEvents` Filter: `evt.type === 'door' && evt.value === 1` korrekt âœ…

### ðŸ”§ Offene Baustellen (zum damaligen Zeitpunkt)
- Browser lud noch alten Build (Index-DaLhtVVS.js) trotz Inkognito â†’ Root-Cause unklar (â†’ in v0.31.3 gelÃ¶st)

---

## ðŸ—“ï¸ Sitzung 11.03.2026 â€” Version 0.31.0 / 0.31.1

### âœ… Abgeschlossen

- Fresh Air: Sensor-Typ-basierte Erkennung (`evt.type === 'door'`) statt Keyword-Matching
- StoÃŸlÃ¼ftung â‰¥5 Min ZÃ¤hler (`freshAirLongCount`) berechnet und angezeigt
- Drift-Monitor: X-Achse zeigt jetzt Kalenderdaten (TT.MM) statt Indices
- KI-Analyse Auto-Trigger: tÃ¤glich 08:05 + 20:00 Uhr via `node-schedule`
- "Flur-RÃ¤ume" TextField aus Settings entfernt
- PROJEKT_STATUS.md Cursor Rule erstellt

### ðŸ”§ Offene Baustellen (zum damaligen Zeitpunkt)
- Morning Briefing kommt immer noch nicht um 08:00 (mehrfach besprochen)
- Fresh Air zeigt noch 0x (â†’ Root-Cause in v0.31.2 / v0.31.3 gefunden)

---

## ðŸ—“ï¸ Sitzung 10.03.2026 â€” Version 0.30.74

### âœ… Abgeschlossen

- Feature-Module-Status Tab im System-Bereich (Ãœbersicht aller Algorithmen mit Status-Icons)
- Garmin-Style Drift-Monitor mit Page-Hinkley-Test (CUSUM-Ã¤hnlich)
- AktivitÃ¤ts-Level-Normalisierung: persÃ¶nlicher Median = 100%
- Drift-Monitor v2: 4 Metriken (AktivitÃ¤t, Ganggeschwindigkeit, Nacht-Unruhe, Raum-MobilitÃ¤t)
- Farbkodierung: Drift-Monitor-Linien stimmen mit den Kachel-Farben Ã¼berein
- Layout-Verbesserung: Kacheln gruppiert, Drift-Monitor als Zusammenfassung abgesetzt
- Tooltip-ErklÃ¤rtexte fÃ¼r alle Kacheln (Fragezeichen-Icon)

---

## ðŸ—ï¸ Funktionierende Basis (Stand v0.31.3)

| Feature | Status | Version |
|---|---|---|
| Sensor-Typ-System (`type: "door"`) | âœ… | recorder.js |
| Frischluft-ZÃ¤hlung (Ã–ffnungen heute) | âœ… | v0.31.2 |
| StoÃŸlÃ¼ftung â‰¥5 Min ZÃ¤hler | âœ… | v0.31.1 |
| Admin UI baut korrekt nach `admin/` | âœ… | v0.31.3 |
| Obfuskierung (main.js + lib/) | âœ… | v0.31.4 |
| Drift-Monitor mit Datumsachse | âœ… | v0.31.0 |
| KI-Analyse Auto-Trigger (08:05 + 20:00) | âœ… | v0.31.0 |
| Tages/Nacht Anomalie-Score | âœ… | v0.30.x |
| Ganggeschwindigkeit (Flur-Transit) | âœ… | v0.28.0 |
| Raum-MobilitÃ¤t Kachel | âœ… | v0.30.x |
| Nacht-Unruhe Kachel | âœ… | v0.30.x |
| Bad-Nutzung Kachel | âœ… | v0.28.0 |
| Feature-Module-Status Tab | âœ… | v0.30.74 |
| Garmin-Style Drift-Monitor | âœ… | v0.30.74 |
| Pushover Briefing (08:00 + 20:00) | âœ… | v0.31.4 â€” subscribeStates fehlte (Root-Cause gefunden) |

---

## ðŸ“¦ Versionshistorie

| Version | Datum | HauptÃ¤nderung |
|---|---|---|
| **0.33.79** | 26.03.2026 | **fix(OC-7)**: PIR-only Schlafanalyse: Hard Cap 12:00, Sustained-Return-Filter, Consistency Guard, "Haus-wird-still"-Einschlafzeit |
| **0.33.78** | 26.03.2026 | **feat(OC-17)**: Topologie-BFS-Hop-Filter für _motOutEvts (Backend) + Batterie-Warnung (Frontend); OC-21 dokumentiert |
| **0.33.77** | 26.03.2026 | **fix(OC-7)**: FP2-Bathroom-Prewindow 2-Min (+orange Dreieck); Lane-Kollision Fix (3+ Marker) |
| **0.33.76** | 25.03.2026 | **feat(OC-18)**: Separate Schlafkacheln pro Person; FP2-Label-Fix; personData mit sleepWindowStart/End |
| **0.33.63** | 23.03.2026 | **feat(OC-10)**: Schlaf-Score & Phasen-Charts (Option A+B) in AURA MONITOR WOCHE/MONAT-View (HealthTab.tsx, reines SVG) |
| **0.33.62** | 23.03.2026 | **feat**: OC-10 Basis in LongtermTrendsView; **fix**: Wake-Kandidaten ts:null (fp2_other, other, vibration_alone) |
| **0.33.61** | 23.03.2026 | **fix**: _sleepFrozen Decay-Bug (stages=0 nach Adapter-Neustart); Degraded-View im Frontend |
| **0.33.60** | 23.03.2026 | **fix**: Weißer Bildschirm (TDZ: fmtTime vor Tooltip-Variablen verschoben); TESTING.md aktualisiert |
| **0.33.59** | 23.03.2026 | **feat**: Wachliegen-Label, dyn. Vibr.-Y-Achse, Primärflur-Flag, Obfuskierung reaktiviert |
| **0.33.58** | 23.03.2026 | **feat**: Einschlafzeit-Verfeinerung (Vib+FP2), Garmin für Einschlafzeit, Garmin Wake-Override, Schlafdauer-Anzeige, ⚙ Quellen-Tooltip Einschlafzeit |
| **0.33.3** | 14.03.2026 | **feat**: FP2 presence_radar + Vibration + sleepDisorder Score + auto Haushaltstyp |
| **0.33.2** | 13.03.2026 | **feat**: isKitchenSensor + Nykturie + Essrhythmus; Diabetes T2 / Depression / Soziale Isolation Scores |
| **0.33.1** | 13.03.2026 | **FIX**: ScreeningPanel-Komponente fehlte -> ReferenceError; Versionierungsregel eingefuehrt |
| 0.33.0 | 13.03.2026 | Phase 3: Proaktives Screening (DISEASE_SIGNATURES, compute_screening_hints, ScreeningPanel) + Icon-Import Fix |
| 0.32.x | 13.03.2026 | Kritischer Build-Fix (rimraf+xcopy entfernt); MedicalTab + Phase 2 Disease Scores erstmals live deployed |
| **0.31.4** | 12.03.2026 | **FIX**: Morning Briefing subscribeStates fehlte â†’ Briefing nie gefeuert; Obfuskierung reaktiviert |
| 0.31.3 | 12.03.2026 | Vite outDir â†’ `admin/` (falsches Build gefixt); Score-Normalisierung; 62 temp-Dateien entfernt |
| 0.31.2 | 12.03.2026 | processEvents TypeError (null name) â†’ Fresh Air 0x; lib/main.js SyntaxError |
| 0.31.1 | 12.03.2026 | Fresh Air type-basiert; StoÃŸlÃ¼ftung â‰¥5 Min; freshAirLongCount |
| 0.31.0 | 11.03.2026 | Drift-Monitor Datum-Achse; Auto-KI-Analyse; Flur-RÃ¤ume entfernt |
| 0.30.74 | 10.03.2026 | Relative AktivitÃ¤ts-Normalisierung; Page-Hinkley Drift-Monitor; Feature-Tab |
| 0.30.73 | ~08.03.2026 | Sparkline Tooltip fixes; Nacht-Text JSON-Parsing |
| 0.30.x | Feb/MÃ¤rz 2026 | Diverse Kacheln, Layout, Farben, Tooltips |
| 0.28.0 | Jan 2026 | Ganggeschwindigkeit, Bad-Nutzung, Frischluft |
| 0.25.x | Dez 2025 | KI-Berichte (Gemini), Pushover |

---

## ðŸ”‘ Architektur-GrundsÃ¤tze

- **Backend**: Node.js (ioBroker Adapter) â†’ `main.js` ist Einstiegspunkt (NICHT `lib/main.js`)
- **Python-Service**: Scikit-Learn, NumPy â€” IsolationForest, lineare Regression, Page-Hinkley
- **Admin UI**: React + TypeScript + Recharts â€” baut nach `admin/` (seit v0.31.3)
- **ioBroker serviert**: `admin/` Verzeichnis (NICHT `src-admin/build/`)
- **Obfuskierung**: Nur Backend (`main.js` / `lib/`) via `javascript-obfuscator` bei `npm run build:prod`
- **Sensor-Typen**: `type: "door"` fÃ¼r TÃ¼ren/Fenster, kein Keyword-Matching
- **Versionierung**: Immer beide `package.json` UND `io-package.json` bumpen




## Deployment-Ablauf (PFLICHT bei jeder Code-Aenderung)

`
1. Code aendern (src/main.js, src/lib/*.js, src-admin/src/...)
2. Version bumpen: package.json + io-package.json (Patch: x.y.z -> x.y.z+1)
3. Backend bauen:  npm run build:backend:dev  (kopiert src/main.js -> main.js + src/lib/ -> lib/)
4. Frontend bauen: npm run build:react        (NUR bei Aenderungen in src-admin/)
5. Syntax pruefen: node --check main.js
6. Stagen:         git add main.js lib/ package.json io-package.json admin/
7. Commit + Push:  git commit --trailer "Made-with: Cursor" + git push
8. ioBroker:       Admin -> Adapter -> cogni-living -> Update-Button KLICKEN <- NICHT VERGESSEN!
`

WICHTIG: ioBroker holt den Adapter direkt von GitHub (non-npm).
Nach git push zeigt ioBroker immer noch die alte Version bis der Update-Button im
Admin-Interface gedrueckt wird. Der Log bestaetigt die neue Version:
  cogni-living adapter starting (vX.Y.Z)

Build-Details:
- build:backend:dev = einfaches File-Copy (kein Transpiling): src/main.js -> main.js
- lib/recorder.js direkt bearbeiten, dann mit Copy-Item zurueck nach src/lib/ syncen
- src/ und src-admin/src/ stehen in .gitignore -> nur admin/ und lib/ werden gepusht

