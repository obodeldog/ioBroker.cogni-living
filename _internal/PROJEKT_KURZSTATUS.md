# PROJEKT KURZSTATUS — ioBroker Cogni-Living (AURA)
**Letzte Aktualisierung:** 16.06.2026 | **Version:** 0.33.317

---

## Kurz-Anleitung
- **Pflicht-Start** jeder neuen Session (schnell + kompakt).
- Nur operative Kerninfos — **Detail-Historie in `_internal/PROJEKT_STATUS.md`**.

---

## 1) Aktuelle Version
- **`0.33.317`** (ioBroker liest `io-package.json` → **`common.version`** — immer mitbumpen!)

---

## 2) Stand heute (16.06.2026)
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
- Adapter auf **0.33.317** updaten → Nacht abwarten → `bedEntryTs` (Karte 1) jetzt gesetzt statt "kein plausibler Wert"; bei echtem Ausflug schraffiertes Vor-Schlaf-Overlay prüfen.

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
