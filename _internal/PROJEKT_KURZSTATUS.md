# PROJEKT KURZSTATUS — ioBroker Cogni-Living (AURA)
**Letzte Aktualisierung:** 28.06.2026 | **Version:** 0.33.327

---

## Kurz-Anleitung
- **Pflicht-Start** jeder neuen Session (schnell + kompakt).
- Nur operative Kerninfos — **Detail-Historie in `_internal/PROJEKT_STATUS.md`**.

---

## 1) Aktuelle Version
- **`0.33.327`** (ioBroker liest `io-package.json` → **`common.version`** — immer mitbumpen!)

---

## 2) Stand heute (28.06.2026)
- **v0.33.327 — Dreieck-Race-Fix + P90-Patch nachgezogen (28.06.)**:
  - **Dreieck weg nach Neustart (Hauptbug):** Per-Person-OBE nutzt `_roomHopDistance()` → liest `this._cachedTopoMatrix`. Dieser wurde NUR lazy beim ersten Live-Event gesetzt → nach Adapter-Neustart + sofortigem „neu berechnen" leer → `_roomHopDistance` gibt `-1` → `_obeHop=999` → **alle Bad-/Aussen-Events gefiltert**. Beweis: Top-Level `outsideBedEvents` (synchrone Topo) enthielt das EG-Bad-Event 02:16, Per-Person `personData.Marc.outsideBedEvents=[]`.
    - **Fix A1 (OC-TOPO-WARM):** Topologie in `saveDailyHistory()` vorab synchron laden → Cache warm vor Per-Person-Schleife.
    - **Fix A2 (OC-OBE-HOP-GRACE):** Hop-Filter nur bei GÜLTIGER Distanz > 2 filtern; `_obeHop===999` (keine Topo-Info) = NICHT filtern (graceful degradation, korrekt für Neukunden ohne Topologie).
  - **Fix B (P90-Patch nachgezogen):** v0.33.326-Patch war NICHT in `src/main.js` gelandet (`nightVibrationStrengthP90`/`vibStrP90` fehlten komplett, nur `sensorHint` war drin) → Wake-Schwelle blieb >72. Jetzt korrekt appliziert: `_pVibStrArr` sammelt alle Stärkewerte, P90 statt MAX in Rolling-Kalibrierung. Bestätigt mit echten Daten: Marc-Nacht MAX=41 (Aufsteh-Stösse 40/41 um 02:19/02:24) vs P90=25.
    - **Hinweis:** Schwelle sinkt GRADUELL über ~14 Nächte, da der Rolling-Buffer alte MAX-Nächte erst durch neue P90-Nächte ersetzen muss (historische Rohwerte nicht rekonstruierbar).
  - **Offen (dokumentiert, kein Fix):** Grau-Balken ab 22:15 = OC-PSA-CLAMP (preSleepAbsence.start < bedEntryTs), war schon vor v0.33.326 so — braucht Umbau der Berechnungsreihenfolge.
- **v0.33.326 — OC-VIB-CAL-P90-FIX + Terminologie B + Sensor-Hinweis (28.06.)**:
  - **Kalibrierungs-Bug:** `vibStrP90` (P90 der Nacht-Stärken) ersetzt `vibStrMax` in Rolling-Kalibrierung. Aufsteh-Bewegungen (Stärke 71 um 06:43) können P90 nicht mehr inflationieren → Wake-Schwelle sinkt von 72 auf realistisch ~51.
  - **Sensor-Hinweis:** Wenn über 5+ Nächte avgTrigRate < 0.5 UND vibStrP90 < 20 → blaues Warnsymbol in OC-VIB-CAL Tabelle mit Hinweis „Sensor Richtung Körpermitte schieben“.
  - **Terminologie B:** „Wachliegen“ differenziert: gelb vor Schlaf = Einschlafphase, gelb nach Schlaf = Aufwachphase, Wake-Stats während Schlaf = Schlafunterbr.
  - **BRAINSTORMING:** OC-PSA-CLAMP (preSleepAbsence.start < bedEntryTs Bug) + OC-GARMIN-NO-TS dokumentiert.
- **v0.33.325 — garminWakeMin 5 Fixes + OC-BAD-PERSON-ROBUST (27.06.)**:
  - Garmin Wach-Phasen jetzt sichtbar in Smartwatch-Referenz. 5 Stellen in HealthTab.tsx gefixt.
  - OC-BAD-PERSON-ROBUST: ID-Prefix-Match ergänzt für robuste Geräte-/State-Pfad-Erkennung.

---

## 3) Offene Baustellen (max. 5)
1. **OC-PSA-CLAMP:** Grau-Balken (preSleepAbsence) startet vor `bedEntryTs` — Berechnungsreihenfolge umbauen (BRAINSTORMING)
2. **OC-BED-FINAL (Philosophie B):** „letztes finales Ins-Bett" als `bedEntryTs` nach langer Abwesenheit
3. REM-Erkennung: auch nach P90-Fix evtl. zu wenig REM — Schwellen-Modell prüfen (sinkt erst über ~14 Nächte)
4. „Ins Bett gegangen" Override-Funktionalität (derzeit read-only)
5. Ursache nächtlicher Adapter-Neustart ungeklärt

---

## 4) Nächster Schritt
- **0.33.327** installieren → Adapter NICHT sofort nach Neustart „neu berechnen", oder einmal abwarten → Dreieck (Toilette) muss wieder erscheinen, Per-Person-OBE darf nicht mehr leer sein.
- Wake-Schwelle in OC-VIB-CAL beobachten: sinkt über die nächsten Nächte schrittweise unter 72 (P90 ersetzt MAX im Rolling-Buffer).

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
