# TESTING — ioBroker Cogni-Living (AURA)

**Zweck:** Manuelle Testliste nach Code-Änderungen. Dient als Grundlage für spätere QA-Dokumentation (Medizinprodukt-Konformität MDR Art. 14 / Annex II).

**Regel:** Nach jeder relevanten Code-Änderung die betroffenen Testfälle prüfen und mit Datum + Ergebnis abhaken.

---

## 🧪 Testbereich 1: SCHLAFANALYSE (OC-7) — Schlafphasen & Score

| ID | Testfall | Erwartetes Ergebnis | Geprüft am | ✅/❌ |
|---|---|---|---|---|
| T-S1 | Normalnacht mit Vibrationssensor: Vibration vorhanden | Mischung aus Tief/Leicht/REM/Wach; Tiefschlaf NICHT dominant bei < 30 Min Ruhe | — | — |
| T-S2 | Vibrationssensor ausgefallen (keine Events) | Alle Slots = Leichtschlaf (nicht Tiefschlaf!), Score trotzdem berechnet | — | — |
| T-S3 | Zigbee-Ausfall gesamte Nacht | Kachel zeigt "Kein Vibrationssensor" ODER alle Leichtschlaf — NICHT alles Tiefschlaf + Score 100 | — | — |
| T-SC1 | **v0.33.98 Score-V2**: Normalnacht 7h Schlaf | AURA-Score im Bereich 55–85 (NICHT 100). "○ unkalibriert" wenn kein Garmin | — | — |
| T-SC2 | **v0.33.98 Score-V2**: Kurze Nacht 5h Schlaf | AURA-Score im Bereich 45–65 (deutlich unter 80) | — | — |
| T-SC3 | **v0.33.98 Kalibrierung**: Haushalte mit Garmin, >7 Nächte | scoreCalStatus = 'calibrating'; Badge "⟳ kalibriert (N/14N)" sichtbar | — | — |
| T-SC4 | **v0.33.98 Kalibrierung**: Haushalte mit Garmin, ≥14 Nächte | scoreCalStatus = 'calibrated'; Badge "✓ kalibriert (14N)" grün sichtbar; scoreCal ≠ score wenn Offset ≠ 0 | — | — |
| T-SC5 | **v0.33.98 Kalibrierung**: Haushalt ohne Garmin | scoreCalStatus = 'uncalibrated'; Badge "○ unkalibriert" grau sichtbar; scoreCal = null | — | — |
| T-SC6 | **v0.33.98**: Garmin-Delta Anzeige | Delta jetzt relativ zu scoreCal (wenn vorhanden), sonst zu score | — | — |
| T-SC7 | **v0.33.100**: sleepScoreHistory Backfill | Nach Adapter-Neustart: Log zeigt `[ScoreMigration] sleepScoreHistory mit N Einträgen ergänzt (M mit Garmin)`. Wenn M ≥ 7: Score-Badge zeigt Kalibrierungsstatus | — | — |
| T-OBE1 | **v0.33.100**: Bad-Besuch Dreieck | Orange ▼ erscheint ÜBER dem Schlafbalken an der korrekten Zeitposition | — | — |
| T-OBE2 | **v0.33.100**: Außerhalb Dreieck | Rotes ▲ erscheint UNTER dem Schlafbalken an der korrekten Zeitposition | — | — |
| T-OBE3 | **v0.33.100**: Gleichzeitig Bad + Außerhalb | Orange ▼ über dem Balken, rotes ▲ unter dem Balken — beide an gleicher x-Position | — | — |
| T-OBE4 | **v0.33.103 FP2-Dropout-Filter**: FP2 fällt kurz (<5 Min) aus, kein anderer Raum-Sensor aktiv | KEIN rotes Dreieck wird erzeugt. Log: `[OC-7] 1 FP2-Solo-Dropout(s) < 5min ignoriert` | 08.04.2026 | ✅ (Analyse JSON) |
| T-OBE5 | **v0.33.103 FP2-Dropout-Filter**: FP2 fällt aus (<5 Min) UND Bad-Sensor aktiv im Fenster | Rotes Dreieck + orangenes Dreieck werden korrekt erzeugt (Sensor-Bestätigung vorhanden) | — | — |
| T-OBE6 | **v0.33.103 FP2-Dropout-Filter**: FP2 fällt ≥5 Min aus, kein anderer Raum-Sensor aktiv | Rotes Dreieck wird erzeugt (Mindestdauer überschritten → echte Abwesenheit wahrscheinlich) | — | — |
| T-OBE7 | **v0.33.104 Multi-Person-Wake-Fallback**: Haushalt ohne FP2/Garmin, 2 Personen, Snapshot mit sleepWindowEnd=null aber personData.wakeConfirmed=true | sleepWindowOC7.end aus per-Person-Wakezeiten gesetzt. Log: [OC-7] Multi-Person-Wake-Fallback. OBE-Dreiecke erscheinen. bedWasEmpty=false. | — | — |
| T-OBE8 | **v0.33.104 Multi-Person-Start-Korrektur**: Snapshot mit sleepWindowStart = heutiger Abend (invertiert) | Start auf fruehesten validen Eintrag aus allSleepStartSources korrigiert. Log: [OC-7] Multi-Person-Start-Korrektur. OBE-Fenster korrekt (Start < End). | — | — |
| T-OBE9 | **v0.33.104 Freeze-Stabilitaet**: Nach korrektem Snapshot (sleepWindowEnd gesetzt) → naechster Tag | _sleepFrozen=true greift. Kein falscher Abend-Start mehr. | — | — |
| T-SEX1 | **v0.33.110 Recalc force**: „ALLES NEU (force)“ nach falschen intimacyEvents | JSON-Dateien: intimacyEvents=[] oder neu berechnet; Log `[OC-SEX] recalc start` + `recalc fertig`; UI 7-Tage ohne Reload aktualisiert (cacheGen) | — | — |
| T-SEX2 | **v0.33.110 Training-Labels**: sexTrainingLabels JSON in Einstellungen | Sex-Tab zeigt Kachel „TRAINING / REFERENZ“; Abgleich ±90 Min zu erkannten Events (✓/⚠) | — | — |
| T-SEX3 | **v0.33.130 Nullnummer-Button**: Erkannte Session in SexDayCard | Button "Das war kein Sex" erscheint, Klick speichert Label type=nullnummer, Kachel zeigt graue Nullnummer-Ansicht | - | - |
| T-SEX4 | **v0.33.130 Nullnummer Rueckgaengig**: Nullnummer-Ansicht, Rueckgaengig klicken | Label wird entfernt, normale Session-Kachel erscheint wieder | - | - |
| T-SEX5 | **v0.33.130 SevenDayHistory Nullnummer**: Nullnummer-Tag in Verlauf | 7-Tage-Dot zeigt gedaempftes Kreissymbol, kein Score/Typ-Label | - | - |
| T-SEX6 | **v0.33.130 RF Nullnummer-Filterung**: RF gibt nullnummer mit conf>=0.60 zurueck | Session wird aus intimacyEvents herausgefiltert (nicht nur umklassifiziert) | - | - |
| T-S4 | Snapshot eingefroren (`sleepStages: []`) | Nächster Lauf berechnet Stages neu (WINDOW-FROZEN log sichtbar) | — | — |
| T-S9 | **v0.33.88**: Garmin-Wake trifft NACH erstem saveDailyHistory ein (Morgen-Szenario) | Stages werden korrekt mit Garmin-Ende berechnet (nicht mit FP2-Ende oder Date.now); Log: `[OC-7] Garmin Wake vorab` | — | — |
| T-S10 | **v0.33.88**: FROZEN-Snapshot, Garmin verschiebt Einschlafzeit um >5 Min | Stages werden neu berechnet (nicht aus Snapshot); Log: `[FROZEN-Fix] Garmin verschob Start um X Min → Stages neu berechnen` | — | — |
| T-S5 | Normalnacht ohne FP2, mit Vibrationssensor | Fixfenster 20–09 Uhr + Stages aus Vibrationsdaten | — | — |
| T-S6 | Garmin-Score vorhanden | Garmin-Score erscheint unter AURA-Score in lila (Differenz korrekt) | — | — |
| T-S7 | Nap (Einschlafzeit 14:00 Uhr) | Kachel zeigt Nickerchen-Hinweis ⭒; kein OC-7-Score | — | — |
| T-S8 | Liegezeit > 12h | Kachel zeigt ⚠ Ungewöhnlich lange Liegezeit | — | — |

---

## 🧪 Testbereich 2: AUFWACHZEIT-ERKENNUNG

| ID | Testfall | Erwartetes Ergebnis | Geprüft am | ✅/❌ |
|---|---|---|---|---|
| T-W1 | Normales Aufstehen: FP2-Bett wird leer + kein Zurückkehren | wakeTs = Zeitpunkt Bett leer (nicht Date.now()); wakeSource = 'fp2' | — | — |
| T-W2 | Bett machen (kurz < 5 Min wieder belegt): Debounce | wakeTs bleibt beim ersten Leer-Zeitpunkt; nicht auf 08:55 verschoben | — | — |
| T-W3 | Mehrfaches Aufwachen: 06:30 Toilette, Rückkehr, 08:00 wirklich auf | wakeTs = 08:00 (letztes valides Ende) | — | — |
| T-W4 | FP2 + Wohnzimmer-PIR (Einpersonenhaushalt), beide ±10 Min | wakeSource = 'fp2_other'; wakeTs = früherer der beiden Werte | — | — |
| T-W5 | Nur Wohnzimmer-PIR, kein FP2 (Einpersonenhaushalt) | wakeSource = 'other'; wakeTs = erste PIR-Flanke nach 04:00 + ≥3h | — | — |
| T-W6 | Mehrpersonenhaushalt: Wohnzimmer-PIR aktiv aber 2 Personen erkannt | t_other wird NICHT verwendet; wakeSource = 'fp2' oder 'motion' | — | — |
| T-W7 | Bad-Sensor mit personTag gesetzt: Einpersonenhaushalt | Bad-Ereignis nach 04:00 wird als t_other-Kandidat gewertet | — | — |
| T-W8 | Bad-Sensor OHNE personTag: Mehrpersonenhaushalt | Bad-Ereignis wird NICHT als Aufwach-Signal gewertet | — | — |
| T-W9 | Garmin-Uhr verbunden: sleepEndTimestampGMT vorhanden | wakeSource = 'garmin' ⌚; Garmin-Zeit wird verwendet | — | — |
| T-W10 | Garmin-Uhr nicht vorhanden (State nicht lesbar) | Graceful Fallback auf FP2 → PIR → Fixfenster (kein Fehler im Log) | — | — |
| T-W11 | Vibrationssensor: letzte Vibration 07:50, danach 45 Min still | _tVibWake = 07:50; nur als Booster wenn FP2 in ±30 Min | — | — |
| T-W12 | Return-to-Bed: Person geht 04:11 ins Bad, kehrt 04:43 zurück, steht 06:18 auf | wakeSource = 'other'; wakeTs = 06:18 (nicht 04:11!) | 25.03.2026 | — |
| T-W13 | OC-18 Problem A: Anderes Schlafzimmer (personTag 'Ingrid') feuert um 04:05 | Ingrid's Schlafzimmer-Sensor (isBedroomMotion=true) wird NICHT als otherRoomWakeTs gewertet | 25.03.2026 | — |
| T-W14 | FP2-Label-Fix: Kein FP2 (type=motion) als Bett-Sensor konfiguriert | Tooltip zeigt "Bett-Bewegungsmelder" statt "FP2-Sensor"; fp2OtherWakeTs = null | 25.03.2026 | — |
| T-W15 | FP2-Label-Fix: Echter FP2 (type=presence_radar_bool) konfiguriert | Tooltip zeigt weiterhin "FP2-Sensor"; fp2OtherWakeTs wird weiterhin berechnet | — | — |
| T-W16 | Rückwärtskomp. Einpersonenhaushalt (kein personTag): Return-to-Bed aktiv | Einpersonenhaushalt: otherRoomWakeTs korrekt (keine Regression durch OC-19) | — | — |

---

## 🧪 Testbereich 3: EINSCHLAFZEIT-ERKENNUNG

| ID | Testfall | Erwartetes Ergebnis | Geprüft am | ✅/❌ |
|---|---|---|---|---|
| T-E1 | Normales Einschlafen 23:00, FP2-Bett aktiv, kein Garmin | sleepStartSource = 'fp2' 📡; Einschlafzeit = FP2-Bettbelegung | — | — |
| T-E2 | FP2 belegt 22:30, Vibration bis 23:15 dann ≥20min Stille | sleepStartSource = 'fp2_vib'; Einschlafzeit ~23:15 (nicht 22:30!) | — | — |
| T-E3 | Garmin sleepStartTimestampGMT vorhanden, 18–04 Uhr, ≤3h nach FP2 | sleepStartSource = 'garmin' ⌚; Garmin überschreibt FP2/Vib (höchste Prio) | — | — |
| T-E4 | Garmin-Start > 3h nach FP2-Bettbelegung (stark verspätet) | Garmin wird ignoriert; Fallback auf fp2_vib oder fp2 | — | — |
| T-E5 | Kein FP2, Schlafzimmer-PIR: letzte Bewegung 23:05 + 45 Min Stille | sleepStartSource = 'motion' 🚶; Einschlafzeit ~23:05 | — | — |
| T-E6 | Gar keine Sensoren: nur Fixfenster | sleepStartSource = 'fixed' ⏰; Fenster 20–09 Uhr | — | — |
| T-E7 | ⚙ Quellen-Tooltip auf Einschlafzeit (DEV-Mode) | Hover über "⚙ Quellen": alle 5 Quellen mit Zeiten, aktive mit "← AKTIV" | — | — |
| T-E8 | **v0.33.80**: Kein FP2, aber PIR + Vibrationssensor vorhanden | `sleepStartSource = 'motion_vib'`; Einschlafzeit via letztem Vib-Event + ≥20 Min Stille (im Motion-Fenster) | — | — |
| T-E9 | **v0.33.80**: `haus_still` als aktive Quelle | Tooltip zeigt `🏠 Haus-wird-still` (kein `? haus_still`) + aktive Markierung korrekt | — | — |
| T-E15 | **v0.33.88**: haus_still — ein Sensor feuert sporadisch die ganze Nacht (Rausch-Sensor) | haus_still liefert trotzdem einen Wert (Einzelsensor zählt nicht als "Haus aktiv"); Log zeigt keinen permanenten Block durch einen Sensor | — | — |
| T-E16 | **v0.33.88**: haus_still — zwei verschiedene Sensoren feuern gleichzeitig nach letztem Schlafzimmer-Event | haus_still = null für diesen Kandidaten (zwei Sensoren = echte Aktivität) | — | — |
| T-E10 | **v0.33.84 Fix A**: FP2 Gap-Fusion: Nutzer steht kurz auf (WC, <=30 Min) und kehrt zurueck | sleepStartSource = fp2 (oder fp2_vib); Einschlafzeit = Start VOR der Unterbrechung (nicht Rueckkehrzeit!) | — | — |
| T-E11 | **v0.33.84 Fix B**: Garmin-Start liegt kurz VOR FP2-Start (biologisch frueher eingeschlafen) | Garmin wird akzeptiert (|Garmin - fp2| <= 3h); sleepStartSource = garmin | — | — |
| T-E12 | **v0.33.84 Fix C**: Manueller Override wenn Nacht eingefroren (nach Aufwachen) | Uhrzeit + Balken auf Kachel aendern sich sofort auf Override-Zeit; sleepWindowEnd bleibt unveraendert | — | — |
| T-E13 | **v0.33.85 Fix 1**: Automatik wiederherstellen bei FROZEN Nacht mit Garmin | Angezeigte Einschlafzeit wechselt zu Garmin-Zeit; kein "manuell"-Badge | — | — |
| T-E14 | **v0.33.85 Fix 3**: Override-Start vor Stage-Analyse-Fenster (z.B. FP2 22:55, Stages ab 04:19) | Balken: schraffiertes Grau von 22:55-04:19, dann Stage-Segmente 04:19-07:19; proportionale Breiten | — | — |

---

## 🧪 Testbereich 4: KACHEL-DARSTELLUNG (Frontend)

| ID | Testfall | Erwartetes Ergebnis | Geprüft am | ✅/❌ |
|---|---|---|---|---|
| T-K1 | Datum der Nacht | Unter Score: "Nacht vom 21.03. auf 22.03.2026" | — | — |
| T-K2 | Einschlaf innerhalb gleichen Tages (z.B. Nap 14:00–16:00) | "Nacht 22.03.2026" (kein "auf") | — | — |
| T-K3 | Einschlaf-Sensor-Indikator aus sleepStartSource | Richtiges Icon + Label unter Einschlafzeit (z.B. "📡 FP2 + Vibration") | — | — |
| T-K4 | Aufwach-Sensor-Indikator | Richtiges Icon + Label unter Aufwachzeit (getrennt von Einschlaf!) | — | — |
| T-K5 | wakeConfirmed = false | Aufwachzeit orange mit ⟳ | — | — |
| T-K6 | wakeConfirmed = true | Aufwachzeit grau mit ✓ | — | — |
| T-K7 | Garmin-Icon ⌚ | Erscheint wenn wakeSource = 'garmin' | — | — |
| T-K8 | "Kein Vibrationssensor" verschwindet nach Fix | Wenn stages.length > 0 → kein "Kein Vibrationssensor"-Block | — | — |
| T-K9 | Score-Farbe: grün ≥80, orange 60–79, rot <60 | Korrekte Farbe je Score | — | — |
| T-K10 | Schlafdauer-Anzeige | Zwischen Score und Garmin-Score: "🕐 Xh Ymin" in blau | — | — |
| T-K11 | Legende: kein "Wach" mehr | Legende zeigt "Wachliegen" (nicht "Wach"); Zeitbalken-Zusammenfassung ebenfalls | — | — |
| T-K12 | Vibrations-Intensität Y-Achse dynamisch | Y-Achse zeigt nicht mehr 0–255 sondern z.B. 0–40 je nach Datenlage | — | — |
| T-K13 | Gesundheits-Tab lädt ohne weißen Bildschirm | Tab öffnet sich; keine ReferenceError in Browser-Konsole | 23.03.2026 | — |
| T-K14 | **OC-9**: Score = 100, sleepScoreRaw = 112 | Im Badge erscheint "↑ roh: 112" in Teal-Farbe unterhalb "AURA-Sleepscore" | — | — |
| T-K15 | **OC-9**: Score = 85, sleepScoreRaw = 85 | Kein "↑ roh:"-Hinweis sichtbar (nur wenn Rohwert > 100) | — | — |
| T-K16 | **OC-9**: Hover über "↑ roh:" | Tooltip erklärt "Ungekappter Rohwert … für Anzeige auf 100 begrenzt" | — | — |
| T-K17 | **OC-14**: Wake-Quellen Dev-Tooltip: Vibration-Quelle | Label zeigt "Vibrationssensor (↑ Konfidenz)" statt "(Bestätigung)"; `[Konfidenz-Booster]` im ⚙ Quellen-Tooltip | — | — |
| T-K18 | **v0.33.80**: Quellen-Tooltip Einschlafzeit enthält neue Quelle `motion_vib` | Tooltip zeigt `🚶 Bewegungsmelder + Vibration` wenn Quelle aktiv; kein unbekanntes Label | — | — |
| T-K19 | **v0.33.81**: Per-Person-Kacheln (Ingrid/Robert) nach `analysis.trigger` bei PIR-only | Zwei Kacheln erscheinen wieder; `system.personData` enthält `sleepWindowStart/End != null` statt durchgehend `null` | — | — |
| T-K25 | **v0.33.90**: Per-Person sleepWindowStart=null wenn Person vor winStart eingeschlafen (winStart = 01:58, erstes Event 02:08) | `personData.Ingrid.sleepWindowStart = winStart` (Fallback greift); Kachel zeigt Schlaf/Aufwachzeit statt "Erste Daten" | — | — |
| T-K26 | **v0.33.91**: PIR-only Haus: Einschlafzeit zeigt echte Bettgehzeit (Ingrid ~23:00, Robert ~21-22 Uhr) statt winStart (01:58) | `sleepWindowStart` ≈ letztes Abend-Bedroom-Event vor langem Gap (>15 min); nicht mehr winStart | — | — |
| T-K27 | **v0.33.91**: Per-Person-Kachel: "⚙ Quellen ▼" Button unsichtbar | Button erscheint nur wenn `allSleepStartSources.length > 0`; bei Gondelsheim (leer) kein Button | — | — |
| T-K28 | **v0.33.91**: Per-Person-Kachel: Einschlafzeit-Quelle zeigt "Bewegungsmelder" | Icon/Label für `sleepStartSource='motion'` korrekt; nicht mehr "Anderer Raum" | — | — |

---

## 🧪 Testbereich 4c: AUSSERHALB-BETT — FP2+Bad+Anderer Raum gleichzeitig (ab v0.33.92)

| ID | Testfall | Erwartetes Ergebnis | Geprüft am | ✅/❌ |
|---|---|---|---|---|
| T-O14 | **v0.33.92**: FP2 leer + Bad + Diele/Wohnen alle <90s | BEIDE Dreiecke: orange (Bad) + rot (Außerhalb); kein Dreieck fehlt | — | — |
| T-O15 | **v0.33.92**: FP2 leer + Bad + Küche (kein anderer Raum) | BEIDE Dreiecke: orange + rot; Küche gilt jetzt als anderer Raum | — | — |
| T-O16 | **v0.33.92**: FP2 leer + NUR Bad (kein anderer Raum) | Weiterhin nur EIN oranges Dreieck (hasOther=false) | — | — |
| T-O17 | **v0.33.92**: Kein FP2, Motion-Cluster: Bad + Küche | BEIDE Dreiecke (Phase-2-Pfad, Küche jetzt in isOther) | — | — |
| T-O18 | **v0.33.92**: kitchenVisits-Zähler unverändert | isKitchenSensor-Flag bleibt; Küchen-Nachtbesuche weiterhin gezählt | — | — |
| T-K20 | **v0.33.82 OC-23**: `⚙ Quellen ▼` Button klicken | Panel öffnet sich mit allen `allSleepStartSources`; aktive Quelle grün; Quellen ohne `ts` ausgegraut | — | — |
| T-K21 | **v0.33.82 OC-23**: Inaktive Quelle mit ts wählen → `[Wählen]` | Spinner erscheint; nach Neuberechnung zeigt Einschlafzeit + Quellenanzeige die neue Quelle; `✏️ manuell` Badge sichtbar | — | — |
| T-K22 | **v0.33.82 OC-23**: `[↺ Automatik wiederherstellen]` klicken | Override gelöscht; Schlafanalyse kehrt zur automatischen Quelle zurück; `✏️ manuell` Badge verschwindet | — | — |
| T-K23 | **v0.33.82 OC-23**: Override am nächsten Morgen | Override vom Vortag hat keinen Effekt (Datums-Prüfung schlägt fehl); Analyse läuft mit Automatik | — | — |
| T-K24 | **v0.33.88**: Quellen-Tooltip zeigt Quelle 'fixed' | Label lautet jetzt "Fallback 20:00 Uhr" (nicht mehr "Schätzung") | — | — |

---

## 🧪 Testbereich 4b: AUSSERHALB-BETT-EVENTS (outsideBedEvents ab v0.33.65, erweitert v0.33.74)

| ID | Testfall | Erwartetes Ergebnis | Geprüft am | ✅/❌ |
|---|---|---|---|---|
| T-O1 | Nachts Bad-Sensor feuert (isBathroomSensor), FP2 bleibt belegt | Dreieck ▼ im Schlafbalken (orange #ffb300) erscheint; Typ = 'bathroom' | — | — |
| T-O2 | Nachts Wohnzimmer-/Diele-Sensor feuert (Einpersonenhaushalt) | Rotes Dreieck ▼ (#e53935) erscheint; Typ = 'outside'; in Schlaf-Radar sichtbar | — | — |
| T-O3 | Nachts Wohnzimmer-Sensor feuert (Mehrpersonenhaushalt, kein FP2) | Blaues Dreieck ▼ (#1e88e5) erscheint; Typ = 'other_person'; Legende "■ Andere Person" | — | — |
| T-O4 | Nachts Wohnzimmer-Sensor feuert (Mehrpersonenhaushalt, FP2 Bett leer bestätigt) | Rotes Dreieck ▼ (Typ = 'outside') — FP2 bestätigt Person selbst war es | — | — |
| T-O5 | Nachts Wohnzimmer-Sensor feuert (Mehrpersonenhaushalt, FP2 Bett belegt) | Blaues Dreieck ▼ (Typ = 'other_person') — FP2 zeigt Person lag noch im Bett | — | — |
| T-O6 | Nachts Küchensensor feuert (isKitchenSensor, Einpersonenhaushalt) | Rotes Dreieck; Typ = 'outside' | — | — |
| T-O7 | Bad + Wohnzimmer innerhalb 5 Min → ein Cluster (hasBath+hasOther) | **v0.33.88**: ZWEI Dreiecke — orange (bathroom) + rot (outside); beide im Balken sichtbar | — | — |
| T-O7b | Cluster mit NUR Bad (kein anderer Raum) | Weiterhin nur EIN oranges Dreieck (kein rotes) | — | — |
| T-O7c | **v0.33.89**: FROZEN-Nacht mit Bad + Diele + Wohnzimmer | Beide Dreiecke erscheinen (orange + rot) — FROZEN-Bypass greift nicht mehr | — | — |
| T-O8 | FP2 leer + Bad-Sensor gleichzeitig | FP2-Event hat Vorrang; Motion-Event wird nicht dupliziert; Typ = 'bathroom' | — | — |
| T-O9 | Snapshot eingefroren, outsideBedEvents war leer | Motion-Events korrekt analysiert (volle Phase 1/2/3 läuft immer) | — | — |
| T-O10 | Balken-Clipping: Event endet nach Aufwachzeit | Event wird auf sleepWindowEnd geclippt; kein Balken-Überstand | — | — |
| T-O11 | Zwei nahe Dreiecke: Bad 02:00, Wohnzimmer 02:04 | Zwei Dreiecke in zwei Lanes; verschiedene Farben (orange + rot) | — | — |
| T-O12 | Event um 23:59:57 (Wohnzimmer kurz vor Mitternacht) | Im Schlaf-Radar Slot 47 (23:30–00:00) sichtbar (via outsideBedEvents Slot-Mapping) | — | — |
| T-O13 | Dreiecke optisch: Größe und Form | Unicode-Dreiecke ▼/▲ (nicht 'v'/'^'), Schriftgröße 15px, deutlich sichtbar | — | — |

---

## 🧪 Testbereich 5: GANGGESCHWINDIGKEIT & PRIMÄRFLUR (ab v0.33.59)

| ID | Testfall | Erwartetes Ergebnis | Geprüft am | ✅/❌ |
|---|---|---|---|---|
| T-G1 | Kein Primärflur gesetzt (isPrimaryHallway nirgends true) | Alle Flur-Sensoren werden für Transitzeiten gemischt (Fallback = alter Modus) | — | — |
| T-G2 | Genau ein Sensor als Primärflur markiert | Nur dieser Sensor liefert Transitzeiten; andere Flure werden ignoriert | — | — |
| T-G3 | P-Flur Checkbox erscheint nur bei Funktion "Flur/Gang" | Bei anderen Sensor-Funktionen: leere Zelle (keine Checkbox sichtbar) | — | — |
| T-G4 | Mehrere Sensoren als Primärflur markiert (Fehler-Case) | Alle markierten Primärflure werden gemischt (kein Absturz) | — | — |

---

## 🧪 Testbereich 6: ROBUSTHEIT & EDGE CASES (unverändert)

| ID | Testfall | Erwartetes Ergebnis | Geprüft am | ✅/❌ |
|---|---|---|---|---|
| T-R1 | Adapter-Neustart mitten in der Nacht | OC-4 Guard verhindert falsches Schlaffenster (Log: "bedPresMin < 180") | — | — |
| T-R2 | Sleep FROZEN: Snapshot hat valide Stages | Sleep FROZEN log; Stages unverändert aus Snapshot | — | — |
| T-R3 | Sleep WINDOW-FROZEN: Snapshot hat leere Stages | WINDOW-FROZEN log; Stages werden NEU berechnet | — | — |
| T-R4 | Alle Zigbee-Sensoren ausgefallen (wie 22.03.2026) | Kein Score 100 + Tiefschlaf; korrekte Degradation erkennbar | — | — |
| T-R5 | Kein einziger Sensor konfiguriert | Kachel zeigt "Erste Daten werden gesammelt"; kein JS-Fehler | — | — |
| T-R6 | Schlaffenster > 24h (unplausibel) | Wird durch Fixfenster-Logik begrenzt; kein Absturz | — | — |
| T-R7 | `node --check main.js` nach jeder Änderung | Exit code 0; keine Syntaxfehler | — | — |

---

## 🧪 Testbereich 7: SENSOR-OFFLINE & PUSHOVER (OC-5 ab v0.33.66) + BATTERIE (OC-15 ab v0.33.67)

| ID | Testfall | Erwartetes Ergebnis | Geprüft am | ✅/❌ |
|---|---|---|---|---|
| T-P1 | motion-Sensor: 6 Tage kein Signal | **Kein** Pushover (neue Schwelle = 7 Tage) | — | — |
| T-P2 | motion-Sensor: 8 Tage kein Signal | Pushover-Alarm kommt (Schwelle überschritten) | — | — |
| T-P3 | Türsensor: 6 Tage kein Signal | Kein Alarm (Türsensoren waren schon immer 7 Tage — unverändert) | — | — |
| T-P4 | KNX/Loxone-Sensor: beliebig lang kein Signal | Niemals Alarm (kabelgebunden, kein Heartbeat erwartet) | — | — |
| T-P5 | Adapter-Neustart während Nachtruhe (22–08 Uhr) | Pushover-Alarm wird bis nach 08:00 Uhr unterdrückt | — | — |
| T-B1 | **OC-15**: Vibrationssensor hat `battery = 15%` | Battery-State wird per Auto-Discovery gefunden; `system.sensorBatteryStatus` enthält Eintrag mit `isLow=true` | — | — |
| T-B2 | **OC-15**: Sensor hat `battery_low = true` (Bool) | `isCritical=true`, `level=5` (geschätzt); Badge in Schlafkachel erscheint 🔋 | — | — |
| T-B3 | **OC-15**: Alias-Sensor (`alias.0.xxx`) | Discovery rekonstruiert nativen Pfad via `common.alias.id`; Battery-State wird trotzdem gefunden | — | — |
| T-B4 | **OC-15**: KNX-Sensor (`knx.0.xxx`) | Sensor wird von Battery-Discovery übersprungen; kein Eintrag in `sensorBatteryStatus` | — | — |
| T-B5 | **OC-15**: Manuelles `batteryStateId` gesetzt | Manuell eingetragener Pfad hat Vorrang vor Auto-Discovery | — | — |
| T-B6 | **OC-15**: Batterie bei 8%, Uhrzeit 10:00 | Pushover wird gesendet (kritisch + 09:00+) mit Sensor-Name + Ort + Prozentwert | — | — |
| T-B7 | **OC-15**: Zweiter Check um 11:00 Uhr (kritisch) | **Kein** zweiter Pushover (Dedup per Tag: `_lastBatteryPushoverDay`) | — | — |
| T-OC2-1 | **OC-2**: Sicherheits-Tab öffnen | TopologyView nicht mehr sichtbar; stattdessen Alert "Topologie-Matrix → System-Tab" | — | — |
| T-OC2-2 | **OC-2**: System-Tab öffnen | Accordion "Topologie-Matrix & Raum-Adjazenz" sichtbar; TopologyView korrekt eingebettet | — | — |

---

## 🧪 Testbereich 8: VERSIONIERUNG & DEPLOYMENT

| ID | Testfall | Erwartetes Ergebnis | Geprüft am | ✅/❌ |
|---|---|---|---|---|
| T-V1 | package.json + io-package.json: Versions identisch | Beide zeigen gleiche Versionsnummer | — | — |
| T-V2 | `node --check main.js` | Keine Syntaxfehler | — | — |
| T-V3 | `npm run build:backend:prod` erfolgreich + main.js obfuskiert | Kein Build-Fehler; erste Zeile main.js unleserlich (z.B. `const a0_0x...`) | — | — |
| T-V4 | `npm run build:react` erfolgreich | Kein Build-Fehler; admin/ aktualisiert | — | — |
| T-V5 | ioBroker lädt neue Version | Adapter startet ohne Fehler im Log | — | — |
| T-V6 | Adapter-Log zeigt keine ERROR-Zeilen beim Start | Sauber hochfahren | — | — |

---

---

## 🧪 T-BED: bedWasEmpty — Bett leer / Person auswärts (v0.33.94)

### Testfall T-BED-1: Auswärts-Nacht wird korrekt erkannt
**Vorbedingung:** Person schläft auswärts, Garmin-Uhr ist dabei
**Erwartung:** bedWasEmpty=true → sleepScore=null, sleepStages=[], Frontend zeigt "🏠 Bett war leer"
**Prüfschritte:**
1. Nacht auswärts verbracht (Garmin trägt Schlafdaten ein)
2. Morgens AURA-Kachel öffnen
3. Kachel zeigt NICHT Score 100 oder Stage-Balken
4. Kachel zeigt "Bett war leer" mit Garmin-Referenz (Zeit + Garmin-Score)

### Testfall T-BED-2: Heimnacht bleibt unverändert
**Vorbedingung:** Person schläft zu Hause mit FP2/Vibrationssensor
**Erwartung:** bedWasEmpty=false → Score und Stages werden normal angezeigt
**Prüfschritte:**
1. Normale Nacht zu Hause
2. AURA-Kachel zeigt Score + Stage-Balken wie gewohnt
3. Kein "Bett war leer"-Hinweis

### Testfall T-BED-3: Erkennungs-Kriterien (JSON-Analyse)
**Erwartung im gespeicherten Snapshot:**
- `bedWasEmpty: true` wenn: eventHistory=leer, nightVibrationCount=0, fp2/haus_still/motion_vib-Quellen alle null
- `sleepScore: null`, `sleepStages: []`
- Garmin-Zeiten (sleepWindowStart/End) bleiben erhalten für Referenz

### Ergebnis
| Datum | Version | Tester | Ergebnis |
|---|---|---|---|
| 04.04.2026 | 0.33.94 | Marc | ✅ Kachel zeigt "🏠 Bett war leer" + Garmin-Referenz korrekt |

---

---

## 🧪 T-FROZEN: Per-Person FROZEN + OC-28 Stages (v0.33.95)

### Testfall T-FROZEN-1: Per-Person Aufwachzeit bleibt stabil
**Vorbedingung:** Gondelsheim — Ingrid/Robert schlafen, wachen um ~08:00-09:00 auf, danach tagsüber weitere Bett-Events
**Erwartung:** Aufwachzeit bleibt bei ~08:48 auch wenn um 11:00, 13:00 weitere Bett-Events kommen
**Prüfschritte:**
1. Morgens (>2h nach Aufwachzeit) JSON-Export anschauen: `personData.Ingrid.sleepWindowEnd` = ~08:48?
2. ioBroker-Log: erscheint `[Per-Person FROZEN] Ingrid: Aufwachzeit eingefroren auf 08:48`?
3. Abends nochmal JSON: Wert immer noch ~08:48?

### Testfall T-FROZEN-2: OC-28 Stages werden bei frühem Garmin-Sync neu berechnet
**Vorbedingung:** Garmin synct früh (z.B. 02:00) mit sleepWindowEnd = 06:30
**Erwartung:** Stages werden NICHT eingefroren, sondern bei jedem saveDailyHistory-Lauf neu berechnet solange `Date.now() < sleepWindowEnd + 30min`
**Prüfschritte:**
1. ioBroker-Log nach Garmin-Sync: erscheint `[OC-28] Stages neu berechnen: Fenster noch aktiv/gerade beendet`?
2. Stages-Balken zeigt nach dem Aufwachen volle Nacht (nicht nur erste 2h)?
3. Nach 30min past sleepWindowEnd: Log zeigt `[History] Sleep FROZEN`?

### Testfall T-FROZEN-3: Normaler FROZEN bleibt erhalten (Regression)
**Vorbedingung:** Nacht abgeschlossen, 3+ Stunden nach Aufwachzeit, Stages korrekt gespeichert
**Erwartung:** FROZEN-Snapshot wird unverändert verwendet (kein unnötiges Neuberechnen)
**Prüfschritte:**
1. Nachmittags saveDailyHistory-Lauf: Log zeigt `[History] Sleep FROZEN`?
2. sleepStages im JSON unverändert zur Morgenstunde?

### Ergebnis
| Datum | Version | Tester | Ergebnis |
|---|---|---|---|
| 04.04.2026 | 0.33.95 | Marc | ⏳ ausstehend (Deploy nötig) |

---

## 🧪 Testbereich 9: PER-PERSON TOOLTIPS, BEDWASEMPTY & OVERRIDE (OC-neu-A/B/C) — v0.33.96

| ID | Testfall | Erwartetes Ergebnis | Geprüft am | ✅/❌ |
|---|---|---|---|---|
| T-PP1 | Gondelsheim: Per-Person-Kachel aufrufen (Ingrid/Robert) | Quellen-Tooltip "⚙ Quellen ▼" erscheint unterhalb der Einschlafzeit | — | — |
| T-PP2 | Tooltip öffnen: zeigt erkannte Methode mit Zeitstempel | Aktive Quelle (z.B. gap60, last_outside, haus_still) als "✓ AKTIV" markiert | — | — |
| T-PP3 | Gondelsheim: Person war nachts nicht im Bett (keine Events) | "Bett war leer" Meldung in der Per-Person-Kachel | — | — |
| T-PP4 | Gondelsheim: Aufwachzeit nach 10:00 + 1h vergangen | Grüner Haken (wakeConfirmed) erscheint bei Aufwachzeit | — | — |
| T-PP5 | Per-Person Override: Andere Quelle wählen ("Wählen" klicken) | Einschlafzeit ändert sich, "✏️ manuell" Markierung erscheint | — | — |
| T-PP6 | Per-Person Override: "↺ Automatik wiederherstellen" klicken | Override wird gelöscht, Algorithmus-Ergebnis kehrt zurück | — | — |
| T-PP7 | Per-Person Override: Adapter-Neustart nach Override | Override bleibt erhalten (in `analysis.sleep.personStartOverrides` State gespeichert) | — | — |
| T-PP8 | Hauptkachel (Einpersonenhaushalt): Override-Panel noch funktionstüchtig | Keine Regression: ⚙ Quellen Panel öffnet sich, alte Handler funktionieren | — | — |

---

## 🧪 Testbereich 11: BEDWASEMPTY + OBE BEI MOTION-ONLY SETUPS (v0.33.102)

| ID | Testfall | Erwartetes Ergebnis | Geprüft am | ✅/❌ |
|---|---|---|---|---|
| T-MO1 | Gondelsheim abends ~22:00: Per-Person-Kachel Ingrid/Robert | "Bett war leer" verschwindet → korrekte Schlafkachel mit Einschlafzeit | — | — |
| T-MO2 | Gondelsheim morgens: Per-Person-Kachel nach Aufwachen | Normale Anzeige mit Schlafbeginn/Aufwachzeit, kein "Bett war leer" | — | — |
| T-MO3 | Gondelsheim nachts mit Bad-Besuchen | Orangene ▼ Dreiecke über Balken erscheinen (Phase 2 OBE via Bad-Sensor) | — | — |
| T-MO4 | Haushalt mit Vibrationssensor: kein Regressionsfehler | _sleepFrozen-Logik mit sleepStages funktioniert weiterhin korrekt | — | — |
| T-MO5 | Gondelsheim: Snapshot korrekt eingefroren (nach 8:00 Uhr) | JSON zeigt `bedWasEmpty: false` pro Person + `outsideBedEvents` wenn Bad-Events vorhanden | — | — |

---

## 📋 Testergebnis-Protokoll

| Datum | Version | Tester | Getestete Bereiche | Ergebnis |
|---|---|---|---|---|
| — | — | — | — | — |

---

## 🔮 Geplante Teststufen (für MDR-Zulassung)

1. **Manuelle Funktionstests** (diese Datei) — aktuell
2. **Automatisierte Unit-Tests** (geplant: Jest / Mocha für `main.js`-Funktionen) — TODO
3. **Integrationstests** mit ioBroker-Simulator — TODO (Phase 6+)
4. **Klinische Validierung** (Vergleich mit Polysomnographie als Ground Truth) — TODO (Phase 7+)

*Hinweis: Für Klasse-I Medizinprodukt (MDR Annex II) sind keine klinischen Studien erforderlich; für Klasse-IIa sind kontrollierte Studien mit Evidenz nötig.*

---

## Testbereich 12: SEX-FEATURE — RF-PERSISTENZ + Score-Bug (v0.33.166)

| ID | Testfall | Erwartetes Ergebnis | Geprueft am | OK? |
|---|---|---|---|---|
| T-SX1 | Adapter neu starten nach erfolgreicher RF-Aktivierung | ALGORITHMUS-Kachel zeigt Stufe 3 AKTIV (nicht INAKTIV) — Modell wurde aus sex_model.pkl geladen | - | - |
| T-SX2 | Python-Service neu starten (ioBroker laeuft weiter) | Beim naechsten CLASSIFY-Aufruf: Log zeigt "[SexBrain] Modell geladen (DATUM)" | - | - |
| T-SX3 | "Alle neu analysieren" klicken: Python nicht erreichbar | Stufe 3 bleibt AKTIV mit Meldung "Gespeichertes Modell (DATUM)" statt INAKTIV | - | - |
| T-SX4 | 7-Tage-Kachel: nur manuelle Sessions (kein Sensor-Event) | Oe Score zeigt '--' statt '0' | - | - |
| T-SX5 | 7-Tage-Kachel: 1 Sensor-Session (Score 42) + 2 manuelle Sessions | Oe Score = 42 (nur Sensor-Events im Zaehler), Oe Dauer berechnet sich ueber alle 3 Sessions | - | - |
| T-SX6 | 7-Tage-Kachel: 0 Sessions insgesamt | Oe Score = '--' (nicht 0) | - | - |


---

## Testbereich 13: STUFE 3 INAKTIV-BUG + SCORE-REFRESH (v0.33.167)

| ID | Testfall | Erwartetes Ergebnis | Geprueft am | OK? |
|---|---|---|---|---|
| T-SX7 | Adapter starten, "Alle neu analysieren" klicken wenn heute 0 Events | Stufe 3 wird AKTIV (Python mit predict=[] aufgerufen, Modell trainiert + gespeichert) | - | - |
| T-SX8 | Log pruefen nach "Alle neu analysieren" | Log zeigt "[SexBrain] Modell gespeichert (DATUM)" OHNE dass heute Events vorhanden sind | - | - |
| T-SX9 | 7-Tage Score nach "Alle neu analysieren" | Score zeigt tatsaechlichen Wert (nicht --) wenn Sensor-Events in letzten 7 Tagen vorhanden | - | - |
| T-SX10 | "Alle neu analysieren" bei 0 Events letzte 7 Tage | Score zeigt -- (korrekt: keine Sensor-Events = kein Score) | - | - |

## Testbereich 14: PAGE-RELOAD-FIX + OE-SCORE-FIX + FEATURES IN LABELS (v0.33.168)

| ID | Testfall | Erwartetes Ergebnis | Geprueft am | OK? |
|---|---|---|---|---|
| T-SX11 | Page-Reload nach "Alle neu analysieren" | Stufe 3 bleibt AKTIV nach Reload (kein INAKTIV mehr durch Race-Condition) | - | - |
| T-SX12 | Tag mit Sensor-Session + Nullnummer-Label am selben Tag | 7-Tage Oe Score zeigt tatsaechlichen Score (nicht --) da positives Label vorhanden | - | - |
| T-SX13 | Erstes "reanalyzeSexDay" nach v0.33.168 Update | Log zeigt "[OC-SEX-RA] Labels angereichert (N mit Features)" — Labels werden mit _features angereichert | - | - |
| T-SX14 | Zweites "reanalyzeSexDay" nach Label-Anreicherung | Log zeigt KEINE erneute Anreicherung — Fast-Path greift, kein JSON-Lesen fuer Labels | - | - |
| T-SX15 | Label in "SESSION EINTRAGEN" eintragen | Beim naechsten "neu analysieren" wird das neue Label angereichert und in Config gespeichert | - | - |
| T-SX16 | 20+ Labels vorhanden: Performance "Alle neu analysieren" | Deutlich schneller als vorher (kein JSON-Lesen pro Label nach erster Migration) | - | - |

## Testbereich 15: NULLNUMMER 3. KLASSE + LAYOUT + SENSOR-TOOLTIPS (v0.33.169)

| ID | Testfall | Erwartetes Ergebnis | Geprueft am | OK? |
|---|---|---|---|---|
| T-SX17 | Nullnummer-Label eintragen und reanalyzeSexDay ausfuehren | Log zeigt kein "filter nullnummer" mehr; RF-Training bekommt alle Labels incl. Nullnummer | - | - |
| T-SX18 | Feature-Importance Balken: Hover ueber "Uhrzeit"-Zeile | Tooltip zeigt "Bett-Sensor: [zigbee-ID] | Uhrzeit abgeleitet aus Session-Start (sin)" | - | - |
| T-SX19 | Feature-Importance: Hover ueber "Raumtemperatur" wenn kein Sensor konfiguriert | Tooltip zeigt "Kein Temperatursensor konfiguriert (Sensortyp: temperature, Funktion: bed)" | - | - |
| T-SX20 | Layout: Vibrationsverlauf-Kachel Position | Kachel erscheint oberhalb von "SESSION EINTRAGEN" und "MANUELLE SESSION" (links, nicht unten) — Ctrl+Shift+R nötig wenn Cache alt | - | - |

## Testbereich 16: STUFE-3-NEUSTART-FIX + CONFUSION MATRIX (v0.33.170)

| ID | Testfall | Erwartetes Ergebnis | Geprueft am | OK? |
|---|---|---|---|---|
| T-SX21 | Adapter neu starten, heute 0 Events, Seite neu laden | Stufe 3 zeigt AKTIV (nicht INAKTIV) — saveDailyHistory ruft Python auch bei 0 Events auf; Fallback aus bestehender JSON wenn Python noch nicht bereit | - | - |
| T-SX22 | Adapter neu starten, Python braucht >15s zum Starten | Stufe 3 zeigt AKTIV mit Fallback-Meldung im Log: "[OC-SEX] pyClassifier aus JSON erhalten (Neustart-Schutz)" | - | - |
| T-SX23 | Confusion Matrix: >= 5 Labels vorhanden, "neu analysieren" klicken | 2x2-Matrix erscheint in ALGORITHMUS-Kachel mit TP/FP/TN/FN Zahlen + Sensitivitaet + Spezifitaet | - | - |
| T-SX24 | Confusion Matrix: nur vaginal + oral (keine Nullnummer) | Matrix zeigt TN=0, FP=0 (keine No-Sex-Klasse vorhanden); TP und FN werden korrekt berechnet | - | - |
| T-SX25 | Confusion Matrix: Nullnummer vorhanden | Matrix zeigt alle 4 Felder; Sensitivitaet = TP/(TP+FN); Spezifitaet = TN/(TN+FP) | - | - |
| T-SX26 | LOO-Loop: Log nach Training mit Nullnummer | Python-LOO nutzt jetzt alle Klassen incl. Nullnummer im X_arr (kein falsches Ausfiltern) | - | - |

## Testbereich 17: LOO-DETAILS / RAUMLOCATION / SENSOREN / HOP=1 (v0.33.172)

| ID | Testfall | Erwartetes Ergebnis | Geprueft am | OK? |
|---|---|---|---|---|
| T-SX27 | Confusion Matrix: "LOO-Details anzeigen" aufklappen | Expandierbare Tabelle erscheint mit Datum, Ist, Vorhergesagt, Zelle (TP/FP/FN/TN) pro Trainings-Session | - | - |
| T-SX28 | LOO-Details: Datumsfelder gefuellt | Datum zeigt z.B. "2026-04-15" (kein "—") — date wird jetzt in TrainData-Pushes mitgegeben | - | - |
| T-SX29 | Feature-Tooltip "Licht war an": Hover wenn Licht im Schlafzimmer vorhanden | Tooltip zeigt "Lichtsensor (Schlafzimmer): [Sensor-Name] ([ID])" statt "Kein Lichtsensor konfiguriert" | - | - |
| T-SX30 | Feature-Tooltip "Raumtemperatur": Hover wenn Thermostat im Schlafzimmer | Tooltip zeigt "Temperatursensor (Schlafzimmer): [Sensor-Name] ([ID])" — Suche via location statt sensorFunction=bed | - | - |
| T-SX31 | Feature-Tooltip "Bad davor/danach": mehrere Bad-Sensoren konfiguriert | Tooltip listet ALLE Bad-Sensoren auf (z.B. "EG WC Bewegungsmelder, EG Bad Bewegungsmelder") | - | - |
| T-SX32 | Feature-Tooltip "Nachbarzimmer aktiv": Hover | Tooltip zeigt "Nachbarzimmer (Hop=1): [Sensoren]" — nur direkt angrenzende Raeume (KG Flur sollte verschwunden sein) | - | - |
| T-SX33 | Nach Hop=1: "neu analysieren", nearbyRoomMotion pruefen | Feature "Nachbarzimmer aktiv" zeigt nur noch Raeume die direkt im Raumlayout an Schlafzimmer grenzen | - | - |
| T-SX34 | Licht/Temp Backend: Log nach Extraktion | Log "[OC-SEX]" zeigt lightOn/roomTemp !== null wenn Sensor im Schlafzimmer-Raum Events hat | - | - |


## Testbereich 18: SENSOR-RAUSCHEN (OC-24) + GATEWAY-AUSFALL (OC-12) (v0.33.186/187)

| ID | Testfall | Erwartetes Ergebnis | Geprueft am | OK? |
|---|---|---|---|---|
| T-OC24-1 | **Sensor-Rauschen**: Ein Sensor loest in der Nacht (22-08 Uhr) >= 10x aus, >3x Median der anderen | saveDailyHistory-Log: `[OC-24] Noisy sensors: [Name]`. State `analysis.safety.noisySensors` enthaelt den Sensor. UI HealthTab zeigt oranges Blitz-Badge mit Sensor-Name | - | - |
| T-OC24-2 | **Sensor-Rauschen**: Noisy-Sensor aus haus_still gefiltert | Im naechsten computePersonSleep: Sensor wird im hausStillTs-IIFE ignoriert (Log o.ae.). haus_still-Einschlafzeit stabilisiert sich | - | - |
| T-OC24-3 | **Sensor-Rauschen**: Normaler Sensor (<10 Events ODER < 3x Median) | Kein Eintrag in noisySensors. Badge in UI bleibt weg | - | - |
| T-OC12-1 | **Gateway-Ausfall**: 2+ Sensoren desselben Gateways (z.B. zigbee.0) gehen gleichzeitig offline | checkSensorHealth-Log: `[OC-12] Gateway-Ausfall erkannt: zigbee.0 (N Sensoren)`. State `analysis.safety.gatewayOutage` gefuellt. UI zeigt oranges Stecker-Banner oben in HealthTab | - | - |
| T-OC12-2 | **Gateway-Ausfall**: Einzelne Sensor-Alerts werden unterdrueckt | Kein Pushover pro Einzelsensor. Stattdessen ein gebuentelter `[GATEWAY-AUSFALL]`-Alert (max. 1x pro 24h) | - | - |
| T-OC12-3 | **Gateway-Ausfall**: Nur 1 Sensor vom gleichen Gateway offline | Kein Gateway-Ausfall erkannt. Normaler Einzelsensor-Alert erscheint (wenn im Sleep-Zeitfenster nicht blockiert) | - | - |
| T-OC12-4 | **Gateway-Ausfall**: alias.X Eintraege werden ignoriert | alias-IDs zaehlen nicht als physisches Gateway. Kein faelschlicher Gateway-Alarm fuer virtuelle States | - | - |

---

## Testbereich 19: GELERNTE RAUEMUEBERGANGSZEITEN (OC-11) (v0.33.187)

| ID | Testfall | Erwartetes Ergebnis | Geprueft am | OK? |
|---|---|---|---|---|
| T-OC11-1 | **Initialer Zustand**: State `LTM.roomTransitionTimes` prueefen | Nach erstem Adapter-Start: State existiert, enthaelt `{}` oder gespeicherte Samples aus Vortag | - | - |
| T-OC11-2 | **Sample-Sammlung**: Bewegung zwischen zwei Raeumen im normalen Betrieb | Nach dem Tag: `LTM.roomTransitionTimes` enthaelt Eintrag fuer das Raum-Paar z.B. `"EG Bad|OG Schlafzimmer": [2300, 1800, 3100, ...]`. Wert wachst taeglich | - | - |
| T-OC11-3 | **Adaptives Fenster greift**: >= 5 Samples fuer ein Raum-Paar vorhanden | Log (debug): `_activeWindowMs` wird auf p90 * 1.3 gesetzt statt 5000. Wert deutlich > 5000 wenn Menschen laenger brauchen | - | - |
| T-OC11-4 | **Mehrpersonenerkennung verhindert bei legitimer Bewegung**: Person braucht 8s Korridor->Schlafzimmer, 10 Samples im System mit p90=9s -> Schwelle=11.7s | Kein Mehrpersonen-Alarm fuer 8s Uebergang (liegt unter Schwelle). Kein `[PersonCount]` Warn-Log | - | - |
| T-OC11-5 | **Mehrpersonenerkennung bei echter Unmoeglickeit**: 2 Personen in verschiedenen Raeumen, deltaMs < Schwelle (beide fast gleichzeitig) | Warnung im Log: `[PersonCount] raeumlich unmoeglich`. State `isMultiPerson` wird auf true gesetzt | - | - |
| T-OC11-6 | **Persistenz**: Adapter neu starten | `LTM.roomTransitionTimes` wird in startSystem() geladen, `_roomTransitionTimes` ist befuellt ohne Verlust | - | - |
| T-OC11-7 | **Max-Sample-Limit**: Mehr als 100 Events fuer ein Raum-Paar | Array bleibt bei 100 Eintraegen (aelteste werden entfernt via shift()). Kein Memory-Leak | - | - |

---

## Testbereich 20: SLEEP-FREEZE ABEND-SPERRE (v0.33.188)

| ID | Testfall | Erwartetes Ergebnis | Geprueft am | OK? |
|---|---|---|---|---|
| T-FRZ1 | **Abend-Sperre**: Normalnacht ohne Garmin/Vibration (Multi-Person), saveDailyHistory laeuft um 19:00 Uhr | Freeze-Debug-Log: `[Freeze] Abend-Sperre aktiv: vollstaendige Nacht gespeichert, keine neue Bett-Aktivitaet seit 18:00`. JSON-Datei wird NICHT ueberschrieben. HealthTab zeigt noch Vorherige Nachtdaten | - | - |
| T-FRZ2 | **Abend-Sperre endet**: Person legt sich nach 22:00 Uhr ins Bett (FP2/Vibration aktiv) | Sperre greift NICHT mehr (Stunde >= 22). Neue Nacht-Analyse startet korrekt und ueberschreibt Datei | - | - |
| T-FRZ3 | **Abend-Sperre mit neuer Bett-Aktivitaet**: Vor 22 Uhr aber FP2/Vibration aktiv | `_hasFreshBedEvt = true` -> Sperre deaktiviert sich. Neue Analyse laeuft durch | - | - |
| T-FRZ4 | **Vortag-Kachel**: AURA Monitor auf "Vortag" wechseln um 19:00 Uhr ohne Garmin | Vortag zeigt korrekte Schlaf-Daten (nicht "Bett war leer") - dank Abend-Sperre ist JSON unveraendert | - | - |
| T-FRZ5 | **Normale Freeze-Logik bleibt**: Normalnacht MIT Garmin/Vibration | Normaler _sleepFrozen-Pfad greift unabhaengig von Abend-Sperre. Keine Regressionen | - | - |


## Testbereich 22: INS-BETT-GEGANGEN + WAKE-PHASEN OC-31 Stage 2 (v0.33.194)

| ID | Testfall | Erwartetes Ergebnis | Geprueft am | OK? |
|---|---|---|---|---|
| T-BE1 | **FP2 vorhanden**: FP2-Sensor meldet erste Bett-Präsenz um 21:28. Einschlafen laut vib_refined 22:05. | `bedEntryTs` = 21:28. Balken startet um 21:28 mit gelbem Vor-Segment (37 Min). Zeitachse zeigt "🛏 21:28" links. | - | - |
| T-BE2 | **Nur Vibrationssensor**: Vibration um 21:30, nächste Vibration um 21:33 (≤5 Min). Einschlafen 22:05. | `bedEntryTs` = 21:30 (first vibration with follower ≤5 Min). Gelbes Vor-Segment 35 Min. | - | - |
| T-BE3 | **Nur PIR (Schlafzimmer)**: Bewegungsmelder 21:32. Keine Abgang-Aktivität für 10 Min danach. | `bedEntryTs` = 21:32. Gelbes Vor-Segment vorhanden. | - | - |
| T-BE4 | **bedEntryTs ≤5 Min vor sleepStart**: Person lag nur kurz wach (z.B. 22:02 ins Bett, 22:06 eingeschlafen). | Kein gelbes Vor-Segment (Differenz ≤5 Min). Zeitachse startet normal bei sleepStart. | - | - |
| T-BE5 | **PC-Szenario**: Einschlafen 22:08. Um 23:50 Flur-PIR (Person geht zum PC). Rückkehr 02:30 Schlafzimmer-PIR. | `smWakePhases` enthält 1 Eintrag: {start: 23:50, end: 02:30, durationMin: 160}. Gelber Overlay-Block im Balken. Tooltip: "⏱ Wachphase: 23:50 – 02:30 (160 Min)". sleepStart bleibt 22:08. | - | - |
| T-BE6 | **Kurze Abwesenheit ≤5 Min**: Person steht 03:00 auf, kehrt 03:04 zurück. | Kein smWakePhase (Mindestdauer 5 Min). Kein Overlay. | - | - |
| T-BE7 | **Mehrpersonenhaushalt**: Ingrid (Zimmer A) steht auf. Robert (Zimmer B) bleibt. | Ingrids smWakePhases zeigt Abwesenheit. Roberts smWakePhases ist leer (isMine-Filter). | - | - |
| T-BE8 | **Mehrere Aufsteh-Ereignisse**: Einschlafen 22:00. Toilette 01:00-01:08, PC 03:00-04:30. | `smWakePhases` = [{01:00-01:08, 8 Min}, {03:00-04:30, 90 Min}]. Zwei gelbe Overlay-Blöcke. | - | - |

## Testbereich 21: NACHT-AUFSTEHEN-FILTER OC-31 Stage 1 (v0.33.191)

| ID | Testfall | Erwartetes Ergebnis | Geprueft am | OK? |
|---|---|---|---|---|
| T-NA1 | **Klassischer Toilettengang**: Person schläft ab 22:00, steht 02:44 auf (Flur-PIR), kehrt 02:51 zurück (Schlafzimmer-PIR). Einschlaf-Kandidaten liegen bei 02:44 und 02:46. | OC-31 erkennt Abgang 02:44, Rückkehr 02:51. Fenster: 02:42-02:54. Kandidaten motion (02:44, 02:46) werden gefiltert. sleepStart bleibt bei vib_refined/haus_still 22:00. | - | - |
| T-NA2 | **Einpersonenhaushalt ohne personTag**: Gleicher Ablauf wie T-NA1, aber keine personTag-Konfiguration. | Identisches Ergebnis — personTag hat keinen Einfluss auf Stage 1. | - | - |
| T-NA3 | **Mehrpersonenhaushalt**: Beide Personen haben Schlafzimmer A und B. Person A steht auf, Flur-PIR auslöst (Shared). Rückkehr in Schlafzimmer A erkannt. | Abgang über Shared-Sensor (Flur) korrekt erkannt. Rückkehr via bedroomLocations[A]. Kandidaten von Person A gefiltert. Kandidaten von Person B unberührt. | - | - |
| T-NA4 | **Hop-Gap: Raum ohne Bewegungsmelder dazwischen**: Schlafzimmer → Flur (kein PIR) → Bad (PIR). Hop-Distanz Bad = 2. | Bad-Event (Hop=2) liegt innerhalb Limit (4). Abgang wird korrekt erkannt. | - | - |
| T-NA5 | **Zu weit weg (Hop > 4)**: Keller-Sensor löst nachts aus (Hop=5 vom Schlafzimmer). | Keller-Event wird ignoriert (Hop > 4). Kein Nacht-Aufstehen erkannt. Kein fälschliches Filtern. | - | - |
| T-NA6 | **Kein Nacht-Aufstehen**: Person verlässt Schlafzimmer um 02:44 aber kommt NICHT zurück (z.B. schläft auf Sofa). | Kein Rückkehr-Event innerhalb 20 Min → kein Fenster. Kandidaten bleiben im Pool. | - | - |
| T-NA7 | **Lange Abwesenheit > 20 Min**: Person steht 02:00 auf, kommt erst 02:35 zurück. | 20-Min-Fenster überschritten → kein Nacht-Aufstehen erkannt. Kandidaten bleiben. Neues "Einschlafen" möglicherweise korrekt. | - | - |
| T-NA8 | **Garmin/FP2 vorhanden**: Garmin zeigt Einschlafzeit 22:15. Nacht-Aufstehen bei 02:44 erkannt. | Garmin als Trusted-Quelle (prio=0) wird NICHT gefiltert. sleepStart = Garmin 22:15. Filter bereinigt nur prio>=4-Kandidaten. | - | - |
| T-NA9 | **Keine False Positives tagsüber**: Person verlässt 08:00 das Schlafzimmer nach dem Aufwachen. | Abgang liegt außerhalb searchBase-Fenster (searchBase = letzte Abend). Kein fälschliches Erkennen. | - | - |
| T-NA10 | **Debug-Badge in HealthTab**: OC-31 hat 1 Nacht-Aufstehen erkannt. | Blaues 🚶-Badge erscheint unterhalb der Einschlafzeit-Kachel mit Uhrzeiten. | - | - |