# PROJEKT KURZSTATUS — ioBroker Cogni-Living (AURA)
**Letzte Aktualisierung:** 27.06.2026 | **Version:** 0.33.323

---

## Kurz-Anleitung
- **Pflicht-Start** jeder neuen Session (schnell + kompakt).
- Nur operative Kerninfos — **Detail-Historie in `_internal/PROJEKT_STATUS.md`**.

---

## 1) Aktuelle Version
- **`0.33.323`** (ioBroker liest `io-package.json` → **`common.version`** — immer mitbumpen!)

---

## 2) Stand heute (27.06.2026)
- **v0.33.323 — Bug: preSleepAbsenceOverlay nie sichtbar (27.06.)**:
  - `preSleepAbsenceEvents` fehlte in `pickSd()` → Overlay wurde nie gerendert.
  - Fix: 1 Zeile in `src/lib/pwa_sleep_tile_build.js` ergänzt. Ab jetzt grau-schraffiertes Overlay bei Vor-Schlaf-Abwesenheit (z.B. Nacht 26./27.06.: 23:13–00:44 Wohnzimmer sichtbar).
- **v0.33.322 — 6 Fixes nach Nacht 22./23.06. (Jana & Julia)** — erst jetzt committet:
  - **P1 (UI):** „Global (Haushalt)" → „Haus-Basis (Ø alle Betten)" in Vib-Kalibrierung + Erklärung. (`SystemTab.tsx`)
  - **P2 (OC-WAKE-GUARD):** VIB-only-Personen erben keine fremde Radar-Aufwachzeit mehr. `fp2WakeTs` nur wenn FP2/Radar im EIGENEN Schlafzimmer (oder kein eigener Sensor). Behebt: Jana & Julia hatten beide fälschlich 05:14 „Radar".
  - **P3 (OC-VIB-ARTIFACT):** `vibration_alone` ignoriert isolierte Einzel-Events (≥1 Vib in 10 Min davor nötig). Behebt: Janas Phantom 11:46.
  - **P4 (OC-BAD-SM):** VIB-basierte Bad-Zuordnung — Person ohne eigenen Aufsteh-Trigger (±6 Min ums Bad-Event) ist nicht aufgestanden → Bad-Event entfernt. Behebt: 04:42-Bad bei Jana UND Julia gleichzeitig.
  - **P5a (OC-BED-FP2-GUARD Reorder):** bereits eingebackene fremde fp2-bedEntry werden entfernt wenn Person eigene Non-FP2-Quelle hat. Behebt: Julia „Ins Bett 22:33 Radar".
  - **P6 (Garmin-Wach):** `awakeSleepSeconds` → `garminWakeMin`, „Wach"-Span in Smartwatch-Referenz. (Backend + `src/lib` Tile)
  - **Brainstorming:** OC-WAKE-SM (volle Aufwach-SM pro Person) + OC-BAD-ARBITER (Cross-Person-Schiedsrichter) dokumentiert.
- **v0.33.321 — OC-BAD-PERSON: Bad-Sensor personTag hat Vorrang**:
  - **Regel:** Hat eine Person ≥1 Bad-Sensor mit passendem `personTag` → alle anderen Bäder (falsches oder kein Tag) werden aus `outsideBedEvents` herausgefiltert. Kein personTag-Bad → Fallback wie bisher.
  - **Behebt:** Marc sah orangefarbenes Dreieck für Jana's OG-Bad-Besuch (02:09 Uhr), obwohl EG Bad bereits Marc zugeordnet war.
  - **Umsetzung:** Neuer Parameter `personBathroomIds` in `computePersonSleep()`. Filter in `obeAllSrc` vor dem Hop-Filter.
- **v0.33.320 — OC-BED-LOC: bedroomLocations per-Person gefiltert**:
  - **Bug:** Marc's Schlafkachel zeigte orangefarbenes Dreieck für Jana's OG-Bad-Besuch um 02:09 Uhr. Ursache: `bedroomLocations` enthielt ALLE Schlafzimmer aller Personen. OG Bad ist nur 1-2 Hops von Julia's OG-Zimmer entfernt → passiert Marc's Hop-Filter (≤2 Hops).
  - **Fix:** `bedroomLocations` wird jetzt per-Person berechnet: primär Bett-Sensoren mit passendem `personTag`, Fallback alle Bett-Sensoren. Für Marc: nur `EG Schlafen` → OG Bad ist 3-4 Hops entfernt → korrekt herausgefiltert.
- **v0.33.319 — bedEntryTs-Anzeige-Synchronisation + FP2-Fremdsensor-Guard + VIB-Mindest-Session**:
  - **Fix 1 (OC-BED-SYNC):** `bedEntryTs` wird nach `allBedEntrySources`-Berechnung auf den Gewinner-Timestamp synchronisiert. Betrifft `computePersonSleep` (IIFE) + `OC-BED-SOURCES P2` (global). Behebt: Marc zeigte `20:00` obwohl ✓-Quelle `21:42` war.
  - **Fix 2 (OC-BED-FP2-GUARD):** Globale FP2-Quellen werden in `allBedEntrySources` nur eingefügt wenn Person **keine eigenen Non-FP2-Quellen** hat. Behebt: Julia bekam Marcs Radar-Timestamps (`fp2=21:42`, `fp2_vib=21:52`) obwohl sie keinen Radarsensor hat.
  - **Fix 3 (OC-BED-VIB-MIN):** VIB-IIFE fordert jetzt eine Session mit **≥5 Min Gesamtdauer** (statt bloß zwei aufeinanderfolgende Events ≤5 Min). Filtert kurze Zufalls-Kontakte (Wäsche aufs Bett legen, Sensor-Blitzer) heraus.
- **v0.33.318 — bedEntryTs-Qualität (FP2-Mindestpräsenz + Quellen-Cutoff)**:
  - **Fix A (OC-BED-FP2-MIN):** FP2-Kurzflackern (<2 Min) wird nicht mehr als `bedEntryTs` akzeptiert. Die `bedEntryTs`-IIFE prüft jetzt Segment-Dauer: erstes FP2-Segment ≥2 Min → gültig. 52-Sek-Flacker um 19:54 → verworfen → korrekt 22:26 erkannt.
  - **Fix B (OC-BED-SOURCES-CUTOFF):** `allBedEntrySources` filtert jetzt Quellen nach `sleepWindowStart` aus. Quellen die nach der Einschlafzeit liegen (z.B. `vib_refined=23:09`, `fp2_vib=00:05`) erscheinen nicht mehr im Dropdown. Betrifft Backend (2 Stellen: per-Person + OC-BED-SOURCES P2) + Frontend (HealthTab).
- **v0.33.317 — OC-48c v2 / Fix B (bedEntryTs never-null + FP2-aware + Vor-Schlaf-Abwesenheit)**:
  - **Kern:** OC-48c verwirft `bedEntryTs` NIE mehr (kein `null`). Betrifft beide Implementierungen (per-Person + global).
  - **FP2-Awareness:** Aussen-Aktivität bei laut FP2 durchgehend belegtem Bett = ANDERE Person → `bedEntryTs` behalten, keine Abwesenheit (löst Anni/Kinder-Fall ohne Phantom).
  - **Vor-Schlaf-Abwesenheit:** FP2 leer / kein FP2 → echter Ausflug → `bedEntryTs` behalten + Block als `preSleepAbsenceEvents` markiert. Frontend (PWA + Admin) rendert grau-schraffiertes Overlay statt Phantom-Wachliegen.
  - **Quelle:** OC-56 Stufe 2 (BRAINSTORMING) + OC-36 Cross-Check-Idee A umgesetzt.
- **v0.33.316 — Bed-Entry + Wake-Cluster Fixes**:
  - **Fix 1** `bedEntryTs`: Nach OC-48c-Ablehnung Fallback auf `candFp2Anchor` (letzter stabiler FP2-Eintritt). Verhindert `null` wenn Person abends noch aufsteht (21:49 abgelehnt → 23:12 korrekt erkannt).
  - **Fix 1b** `allBedEntrySources`: Nach fp2-Fallback neu aufgebaut → fp2 und fp2_vib jetzt im Dropdown sichtbar.
  - **Fix 2** `vib_wake_cluster`: Neue Wake-Quelle. Erste dichte Vib-Häufung (≥3 Events / 15 Min) in letzten 90 Min der Nacht = Aufwach-Muster. Priorität nach `motion_vib`, vor `vibration_alone`.
  - **Fix 3** `vib_refined`-Radar-Filter: `vib_refined` gilt als Bett-Eintrag nur wenn Radar/FP2 ±10 Min bestätigt. Schützt vor 7-Sekunden-Blitzer-Falschpositiven.
- **v0.33.315 — OC-VIB-CAL Per-Person-Reset**: Jede Zeile in der Kalibrierungstabelle hat eigenen ↺-Button. Backend `resetVibCalib` nimmt `target` (global | Personname | all). Drift-Icon (⚠) direkt in der Status-Spalte der betroffenen Zeile.
- **v0.33.314 — OC-VIB-CAL Drift-Erkennung**: Rolling-Buffer prüft letzte 2 Nächte vs. Mittelwert (>2,5× oder <0,35×) → `driftWarning:true` + gelbe Warnung + Reset-Button im System-Tab.
- **v0.33.313 — OC-FORCE-DATE v3**: Korrekte Nacht-Erkennung zu jeder Uhrzeit. Abend (h≥18): Bett-Events → gestrige Nacht. Mitternacht (h<6): KEINE Bett-Events → gestrige Nacht, MIT Events → aktuelle Nacht. Plus Zwei-Pass-Fallback bei leerem sleepWindowStart.
- **v0.33.312 — allSleepStartSources Filter**: Quellen nach swEnd+2h oder >5h vor swStart werden ausgeblendet (entfernt 18:07-Abend-Artefakte). Frontend updated nur wenn sleepWindowStart ≠ null.
- **v0.33.311 — maxTs aus sleepSearchBase+20h**: `_forceRecomputeMaxTs = _sleepSearchBase + 20h` (sauberer als hart 14:00).
- **v0.33.310 — Merge-Kontamination behoben**: obere Zeitgrenze bei Vornacht-Recompute.
- **v0.33.309 — Force-Recompute Neue-Nacht-Fix**: `_newNightActive` nach 18:00 + frische Bett-Events → `_forceRecomputeYesterday`. Nacht-Indikator am Button.
- **Versions-Bump-Regel**: `package.json` + `io-package.json.version` + **`io-package.json.common.version`** — alle drei synchron.

---

## 3) Offene Baustellen (max. 5)
1. Fix 5: `bedExitTs` bei Rückkehr-ins-Bett nach frühem Aufwachen (120-Min-Fenster zu eng)
2. Shelly PresenceZone Alias-Korrektur (Config): `value ? num_objects : 0` + Anwesenheits-Boolean
3. `personTag="Marc"` am Vibrationssensor (Config, kein Code)
4. „Ins Bett gegangen" Override-Funktionalität (derzeit read-only)
5. Ursache nächtlicher Adapter-Neustart ungeklärt

---

## 4) Nächster Schritt
- Adapter auf **0.33.318** updaten → Nacht abwarten → "Ins Bett gegangen" prüfen: soll 22:26 zeigen (nicht 19:54). Quellen-Dropdown: nur Kandidaten vor Einschlafzeit sichtbar.

---

## 5) Risiken / Hinweise
- **src/** und **src-admin/src/** in `.gitignore` — nur `main.js`, `lib/`, `admin/` werden gepusht.

---

*Vollständige Sitzungshistorie → `_internal/PROJEKT_STATUS.md`*

---

## Kurz-Anleitung
- **Pflicht-Start** jeder neuen Session (schnell + kompakt).
- Nur operative Kerninfos — **Detail-Historie in `_internal/PROJEKT_STATUS.md`**.
- Pflegeaufwand: 1–2 Minuten nach Push / relevanter Sitzung.

---

## 1) Aktuelle Version
- **`0.33.305`** (ioBroker liest `io-package.json` → **`common.version`** — immer mitbumpen!)

---

## 2) Stand heute (13.06.2026)
- **Quellen-Dropdowns vollständig**: Eingeschlafen (override-fähig), Ins Bett gegangen (read-only), Aufgewacht (override-fähig) — alle in Karte 1 + 2.
- **Eingeschlafen-Filter**: Quellen VOR `bedEntryTs` werden rot durchgestrichen + nicht wählbar (⚠️ vor Ins-Bett-Zeit).
- **fp2/fp2_vib Fallback**: In `computePersonSleep()` werden globale FP2-Werte in per-Person-`allSleepStartSources` kopiert wenn dort null.
- **allBedEntrySources**: Neues Backend-Feld, liefert alle Sensor-Kandidaten für „Ins Bett gegangen".
- **OC-STUCK v5** (aktiv): Stuck-PIR via `roomHistory`-Pattern.
- **Versions-Bump-Regel**: `package.json` + `io-package.json.version` + **`io-package.json.common.version`** — alle drei synchron.

---

## 3) Offene Baustellen (max. 5)
1. Werkstatt OC-STUCK v5 in Praxis validieren (640→0 min nach Neu berechnen)
2. Ursache nächtlicher Adapter-Neustart ungeklärt (ioBroker-Log, `restartSchedule`)
3. `personTag="Marc"` am Vibrationssensor (Config, kein Code) → `bedEntryTs`-Qualität
4. `_fixedSleepStartTs is not defined` Warnung im SleepCalibration-Log
5. „Ins Bett gegangen" Override-Funktionalität (derzeit read-only, kein Backend-Mechanismus)

---

## 4) Nächster Schritt
- Adapter auf **0.33.305** updaten → Dropdowns testen → „Ins Bett gegangen" Quellen-Panel prüfen.

---

## 5) Risiken / Hinweise
- **PIR ≠ Radar/FP2**: PIR hängt nie legal 90+ min auf `true`. FP2/Radar von OC-STUCK ausgeschlossen.
- **src/** und **src-admin/src/** in `.gitignore` — nur `main.js`, `lib/`, `admin/` werden gepusht.

---

*Vollständige Sitzungshistorie, Forensik und Versionshistorie → `_internal/PROJEKT_STATUS.md`*
