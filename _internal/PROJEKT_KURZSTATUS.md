# PROJEKT KURZSTATUS — ioBroker Cogni-Living (AURA)
**Letzte Aktualisierung:** 09.07.2026 | **Version:** 0.33.334

---

## Kurz-Anleitung
- **Pflicht-Start** jeder neuen Session (schnell + kompakt).
- Nur operative Kerninfos — **Detail-Historie in `_internal/PROJEKT_STATUS.md`**.

---

## 1) Aktuelle Version
- **`0.33.333`** (ioBroker liest `io-package.json` → **`common.version`** — immer mitbumpen!)

---

## 2) Stand heute (09.07.2026)
- **v0.33.334 — History Save Error Crashfix + „ohne Garmin: —" Label (09.07.)**:
  - **CRASHFIX (OC-HIST-CRASH):** `personData`-IIFE (L4012-4596) war nicht in try/catch → ein Crash darin crashte die gesamte `saveDailyHistory`-Funktion → Datei wurde nie geschrieben → Frontend zeigte alte Daten. Fix: IIFE in try/catch gewickelt, `personData = {}` als Fallback. Zusätzlich Stack-Trace in outer catch ergänzt (nächste Fehlermeldung zeigt exakte Zeile). Root-Cause der Crash-Ursache noch offen — Stack-Trace wird beim nächsten Auftreten diagnostizieren.
  - **„ohne Garmin: —":** Wenn keine gültige lokale Aufwach-Quelle existiert (alle Kandidaten liegen nach `bedExitTs` oder keine Daten), wird jetzt „⚙ ohne Garmin: —" angezeigt statt gar nichts.
  - **„vorläufig"-Badge:** Bleibt korrekt (`!wakeConfirmed`). War durch den Crash bedingt (Datei nicht aktualisiert → alter Stand ohne Bestätigung). Löst sich nach dem Crashfix automatisch beim nächsten erfolgreichen Save.
- **v0.33.333 — aura-only Wake-Guard + Override-Debug (09.07.)**:
  - **Frage 1 (OC-AURA-ONLY-WAKEGUARD):** Die „⚙ ohne Garmin: HH:MM"-Aufwachzeit lag unlogisch NACH dem Aufstehen (Beweis 09.07.: ohne-Garmin 06:55 = `vibration_alone`, aber Aufstehen 06:51 = `oc45_bath`). Ursache: die Anzeige nahm stumpf die erste Nicht-Garmin-Quelle und umging die echte Konfidenz-Kaskade. `vibration_alone` ist laut Code (L4352) oft der letzte Matratzen-Kontakt = Aufsteh-Moment, nicht Aufwachen. Fix: aura-only-Aufwachzeit wird auf `<= bedExitTs` begrenzt (Regel „man kann nicht aufstehen und dann aufwachen"). Quelle bleibt erhalten, es wird nur der ungültige Kandidat verworfen → nächstbester oder keine Anzeige. **Wichtig:** Die ECHTE Aufwach-Logik (`computePersonSleep` L640–660) hat schon immer ein Schema (Konfidenz-Kaskade garmin→fp2→…→vib_wake_cluster→vibration_alone + `_smWakePhases` State Machine) — nur meine Zusatzanzeige hatte den Guard nicht.
  - **Frage 2 (OC-OVDEBUG):** Per-Person Einschlaf-Override „Radar+Vibration 23:46" wurde bei Marc nicht übernommen. Kompletter Code-Pfad wurde verifiziert und sieht KORREKT aus (Override gespeichert→gelesen→in computePersonSleep L285 zuerst angewendet→zurückgegeben). Da statisch kein Bug findbar: gezielter Debug-Log an der Override-Prüfung (L285) eingebaut. Log zeigt beim nächsten Klick: startOverride-Inhalt, dateMatch, ts, ovWinMin/Max, tsInWindow, und ob ANGEWENDET/VERWORFEN. → Nutzer klickt einmal, Log lesen, dann gezielter Fix.
- **v0.33.332 — OC-SENSOR-FALLBACK + unkalibriert-Bugfix + AURA-only-Zeiten (04.07.)**:
  - **OC-SENSOR-FALLBACK (Kern):** Wenn der VIB-Sensor einer Person eine Nacht KEINE Daten liefert (Ausfall/leere Batterie/Zigbee-Stoerung), aber FP2 die Person im Schlaffenster bestaetigt → per-Person `bedWasEmpty=false`, Zeiten anzeigen OHNE Schlafphasen-Balken. Neues Flag `vibSensorUnavailable` + oranger Hinweis in der Kachel. Bisher: OC-44 prueft NUR VIB → bei VIB-Ausfall faelschlich „Bett war leer" trotz FP2-Anwesenheit (Beweis Nacht 3./4.7.: Zigbee-Adapter war ausgefallen, FP2 zeigte Marc 6 Events im Fenster, trotzdem alle 4 Personen „Bett war leer"). Der GLOBALE Pfad war korrekt (prueft `_fp2InWindow`), nur der Per-Person-Pfad hatte die Luecke.
  - **Bugfix „unkalibriert":** Per-Person-Kacheln zeigten IMMER „unkalibriert", weil `pd.sleepScoreCalStatus` im Backend fest 'uncalibrated' ist (Score-Kalibrierung laeuft GLOBAL). Frontend liest jetzt `auraSleepData.sleepScoreCalStatus/Nights` (global, korrekt) fuer die Per-Person-Kacheln.
  - **AURA-only-Zeiten (Dev):** Unter Eingeschlafen/Aufgewacht steht — nur wenn aktive Quelle 'garmin' ist — klein „⚙ ohne Garmin: HH:MM" (beste lokale Nicht-Garmin-Quelle aus dem prioritaets-sortierten Array). Zeigt was der Algorithmus OHNE Smartwatch waehlen wuerde (fuer Kunden ohne Garmin).
  - **BRAINSTORMING:** OC-VIB-CAL-NOCTURIA dokumentiert (Toilettengaenge werden von P90 im Normalfall abgefangen; expliziter Ausschluss nur bei starker Nykturie noetig — noch nicht umgesetzt).
- **v0.33.331 — OC-SEX-GROUPS: Option A Sex-Gruppen pro Bett/Person (29.06.)**:
  - **Backend:** Sex-Detection läuft jetzt in einer Gruppen-Schleife. Jede Gruppe (`sexGroups` Config-Feld, JSON-Array) hat eigene `personTags`-Filterung, eigene Kalibrierung (`_grpCI`), eigene Events (`_grpIE`). History-Snapshot speichert jetzt `intimacyEventsByGroup + sexCalibInfoByGroup`. Backward-Compat: `intimacyEvents` = erste Gruppe.
  - **DSGVO-Gate:** `confirmed18: false` → Gruppe wird still übersprungen (keine Erkennung, kein Tab-Inhalt).
  - **Python:** `SexBrain` unterstützt `group_id`-Parameter → eigenes Modell-File pro Gruppe (`sex_model_<groupId>.pkl`). `service.py` verwaltet `sex_brains`-Dict für per-Gruppe-Instanzen.
  - **Frontend:** Gruppen-Tab-Leiste oben (Pill-Buttons). Aktive Gruppe steuert angezeigte Events. `byGroupData`-Cache: Tab-Wechsel ohne Netzwerk-Requests. Group Manager Panel: Gruppen hinzufügen/bearbeiten/löschen, personTags als Checkboxen (aus `native.devices`), 18+-Bestätigung pro Gruppe.
  - **Konfiguration:** In der Adapter-Config unter Sex-Tab → "Gruppen verwalten" klicken. Default: eine Gruppe "Hauptgruppe" mit bestehenden `sexPersonTags`.
- **v0.33.330 — SexPersonTags Checkbox-UI (29.06.)**:
  - `sexPersonTags` als Checkbox-Gruppe (aus `native.devices` personTags) statt Freitext.
- **v0.33.328 — OC-SEX-SIMPLE: Sex-Tab vereinfacht + Kinder-Bett-Bug behoben (29.06.)**:
  - **Bug-Fix OC-SEX-PERSON:** `_intimEvts`-Filter enthielt die Bedingung `(!e.isFP2Bed&&!e.isBedroomMotion)` die praktisch ALLE Vibrations-Sensoren durchließ, inklusive Kinderzimmer (Jana OG Kind 3, Julia OG Kind 1). Dadurch wurde Janas Bett-Aktivität um 18:17–18:27 mit `peakStrength=102` fälschlicherweise als Sex erkannt. Fix: Bogus-Bedingung entfernt → Filter nun: `isVibrationBed||isFP2Bed`. Neues Config-Feld **`sexPersonTags`** (kommagetrennt, z.B. "Marc,Silke") schließt explizit nur diese Sensor-Tags ein — alle anderen werden ignoriert.
  - **OC-SEX-SIMPLE:** Typ-System von vaginal/oral_hand auf binär **sex/nullnummer** vereinfacht:
    - Backend `src/main.js`: `_type` immer `'sex'`; `calibB` entfernt (nur noch `calibA`); Python-Training-Labels vaginal/oral_hand → sex normalisiert; Label-Migration beim nächsten Speichern automatisch.
    - Python `sex.py`: Binärer Classifier (sex/nullnummer), Legacy-Labels normalisiert; altes `sex_model.pkl` wird beim nächsten Training-Zyklus überschrieben.
    - Frontend `SexTab.tsx`: Alle Typ-Anzeigen, Emojis, Formulare, Legenden auf sex/nullnummer vereinfacht.
  - **Hinweis nach Update:** `sexPersonTags` in Adapter-Config auf z.B. `Marc,Silke` setzen — solange leer, werden alle Bett-Sensoren verwendet (Bug bleibt für Mehrzimmer-Setups offen bis Feld gesetzt ist).
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
