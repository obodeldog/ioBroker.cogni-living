# TESTING â€” ioBroker Cogni-Living (AURA)

**Zweck:** Manuelle Testliste nach Code-Ã„nderungen. Dient als Grundlage fÃ¼r spÃ¤tere QA-Dokumentation (Medizinprodukt-KonformitÃ¤t MDR Art. 14 / Annex II).

**Regel:** Nach jeder relevanten Code-Ã„nderung die betroffenen TestfÃ¤lle prÃ¼fen und mit Datum + Ergebnis abhaken.

---

## 🧪 v0.33.277 — E: Schlafkachel-Header Neugestaltung (08.06.2026)

| ID | Testfall | Erwartetes Ergebnis | Geprüft am | ✅/❌ |
|---|---|---|---|---|
| T-K277a | Nacht mit Ins-Bett-Zeit + Einschlaf-Latenz, PWA | Links: klein "Ins Bett gegangen" HH:MM, orange Badge "↓ Xh Ymin", gross "Eingeschlafen" HH:MM. | 08.06.2026 | ⏳ |
| T-K277b | Nacht mit physischem Aufstehen nach Aufwachen, PWA | Rechts: gross "Aufgewacht" HH:MM, orange Badge "↓ Xmin", klein "Aufstehen" HH:MM. | 08.06.2026 | ⏳ |
| T-K277c | Gleiche Nacht im Admin HealthTab (full + degraded) | Gleiches Layout wie PWA (Parität), beide Header-Blöcke. | 08.06.2026 | ⏳ |
| T-K277d | Ohne plausible Ins-Bett-Zeit | Links: "Ins Bett gegangen" + "kein plausibler Wert gefunden", darunter gross "Eingeschlafen". Kein Badge. | 08.06.2026 | ⏳ |
| T-K277e | Ohne bedExitTs (kein physisches Aufstehen erkannt) | Rechts: nur gross "Aufgewacht", kein Aufstehen-Block, kein Badge. | 08.06.2026 | ⏳ |

## 🧪 v0.33.276 — OC-57 bedExitTs Walk-Through-Guard (08.06.2026)

| ID | Testfall | Erwartetes Ergebnis | Geprüft am | ✅/❌ |
|---|---|---|---|---|
| T-K276a | Vib-Haushalt, morgens aufgestanden + spaeter kurzer PIR-only Schlafzimmerbesuch (Jacke), kein FP2 | bedExitTs = letzter echter Matratzen-Kontakt, NICHT der spaete PIR-Besuch. Gelber Balken endet frueh. | 08.06.2026 | ⏳ |
| T-K276b | PIR-only-Haushalt (kein Vibrationssensor) | Kein OC-57-Cap, bedExitTs unveraendert wie v0.33.275. | 08.06.2026 | ⏳ |
| T-K276c | FP2/Radar-Haushalt | Kein OC-57-Cap (FP2 bestaetigt Praesenz). | 08.06.2026 | ⏳ |
| T-K276d | Vib-Haushalt, stilles Liegen nach Aufwachen (keine Aussen-Aktivitaet) | Kein Cap (Person koennte noch im Bett liegen). | 08.06.2026 | ⏳ |
| T-K276e | Vib-Haushalt, Normalnacht (Aufstehen ohne Walk-Through) | Kein Cap (letzter Vib ~ bedExitTs, <5min Abstand). | 08.06.2026 | ⏳ |

## 🧪 v0.33.275 — Revert OC-24-OC48 + Admin-Hinweis-Paritaet (08.06.2026)

| ID | Testfall | Erwartetes Ergebnis | Geprüft am | ✅/❌ |
|---|---|---|---|---|
| T-K275a | Nacht mit echtem naechtlichem Wohnzimmer-Aufenthalt (>30min) zwischen frueher Bett-Beruehrung und Einschlafen | OC-48c lehnt fruehen bedEntryTs-Kandidaten ab; KEIN falsches frueh-"Ins Bett". Noisy-Sensoren werden NICHT ausgeschlossen. | 08.06.2026 | ⏳ |
| T-K275b | `bedEntryTs=null` in Admin-HealthTab (degradierter View, kein Vibrationssensor) | Zeile "Ins Bett gegangen: kein plausibler Wert gefunden" sichtbar. | 08.06.2026 | ⏳ |
| T-K275c | `bedEntryTs=null` in Admin-HealthTab (voller View mit Vibration) | Zeile "Ins Bett gegangen: kein plausibler Wert gefunden" sichtbar (Paritaet zur PWA). | 08.06.2026 | ⏳ |
| T-K275d | `bedEntryTs` bekannt (Normalnacht) | Beide Views: "Ins Bett gegangen HH:MM" + Sekundaer "Eingeschlafen HH:MM"; KEIN Hinweistext. | 08.06.2026 | ⏳ |
| T-K275e | PIR-only-Haushalt, Normalnacht (Regressionscheck nach Revert) | bedEntryTs via motion/motion_vib unveraendert wie v0.33.273. | 08.06.2026 | ⏳ |

## 🧪 Hotfix-Checks 08.05.2026

| ID | Testfall | Erwartetes Ergebnis | Geprüft am | ✅/❌ |
|---|---|---|---|---|
| T-BP1 | **v0.33.247 BedPresence-Freeze**: Morgens BETT-PRAESENZ ~8h, am Abend erneut Longterm öffnen | Wert des bereits abgeschlossenen Tages bleibt stabil (kein Umsprung 8h -> 1-2h, kein gruen->rot Wechsel durch Recompute) | 08.05.2026 | ⏳ |

---
## ðŸ§ª Testbereich 1: SCHLAFANALYSE (OC-7) â€” Schlafphasen & Score

| ID | Testfall | Erwartetes Ergebnis | GeprÃ¼ft am | âœ…/âŒ |
|---|---|---|---|---|
| T-S1 | Normalnacht mit Vibrationssensor: Vibration vorhanden | Mischung aus Tief/Leicht/REM/Wach; Tiefschlaf NICHT dominant bei < 30 Min Ruhe | â€” | â€” |
| T-S2 | Vibrationssensor ausgefallen (keine Events) | Alle Slots = Leichtschlaf (nicht Tiefschlaf!), Score trotzdem berechnet | â€” | â€” |
| T-S3 | Zigbee-Ausfall gesamte Nacht | Kachel zeigt "Kein Vibrationssensor" ODER alle Leichtschlaf â€” NICHT alles Tiefschlaf + Score 100 | â€” | â€” |
| T-SC1 | **v0.33.98 Score-V2**: Normalnacht 7h Schlaf | AURA-Score im Bereich 55â€“85 (NICHT 100). "â—‹ unkalibriert" wenn kein Garmin | â€” | â€” |
| T-SC2 | **v0.33.98 Score-V2**: Kurze Nacht 5h Schlaf | AURA-Score im Bereich 45â€“65 (deutlich unter 80) | â€” | â€” |
| T-SC3 | **v0.33.98 Kalibrierung**: Haushalte mit Garmin, >7 NÃ¤chte | scoreCalStatus = 'calibrating'; Badge "âŸ³ kalibriert (N/14N)" sichtbar | â€” | â€” |
| T-SC4 | **v0.33.98 Kalibrierung**: Haushalte mit Garmin, â‰¥14 NÃ¤chte | scoreCalStatus = 'calibrated'; Badge "âœ“ kalibriert (14N)" grÃ¼n sichtbar; scoreCal â‰  score wenn Offset â‰  0 | â€” | â€” |
| T-SC5 | **v0.33.98 Kalibrierung**: Haushalt ohne Garmin | scoreCalStatus = 'uncalibrated'; Badge "â—‹ unkalibriert" grau sichtbar; scoreCal = null | â€” | â€” |
| T-SC6 | **v0.33.98**: Garmin-Delta Anzeige | Delta jetzt relativ zu scoreCal (wenn vorhanden), sonst zu score | â€” | â€” |
| T-SC7 | **v0.33.100**: sleepScoreHistory Backfill | Nach Adapter-Neustart: Log zeigt `[ScoreMigration] sleepScoreHistory mit N EintrÃ¤gen ergÃ¤nzt (M mit Garmin)`. Wenn M â‰¥ 7: Score-Badge zeigt Kalibrierungsstatus | â€” | â€” |
| T-OBE1 | **v0.33.100**: Bad-Besuch Dreieck | Orange â–¼ erscheint ÃœBER dem Schlafbalken an der korrekten Zeitposition | â€” | â€” |
| T-OBE2 | **v0.33.100**: AuÃŸerhalb Dreieck | Rotes â–² erscheint UNTER dem Schlafbalken an der korrekten Zeitposition | â€” | â€” |
| T-OBE3 | **v0.33.100**: Gleichzeitig Bad + AuÃŸerhalb | Orange â–¼ Ã¼ber dem Balken, rotes â–² unter dem Balken â€” beide an gleicher x-Position | â€” | â€” |
| T-OBE4 | **v0.33.103 FP2-Dropout-Filter**: FP2 fÃ¤llt kurz (<5 Min) aus, kein anderer Raum-Sensor aktiv | KEIN rotes Dreieck wird erzeugt. Log: `[OC-7] 1 FP2-Solo-Dropout(s) < 5min ignoriert` | 08.04.2026 | âœ… (Analyse JSON) |
| T-OBE5 | **v0.33.103 FP2-Dropout-Filter**: FP2 fÃ¤llt aus (<5 Min) UND Bad-Sensor aktiv im Fenster | Rotes Dreieck + orangenes Dreieck werden korrekt erzeugt (Sensor-BestÃ¤tigung vorhanden) | â€” | â€” |
| T-OBE6 | **v0.33.103 FP2-Dropout-Filter**: FP2 fÃ¤llt â‰¥5 Min aus, kein anderer Raum-Sensor aktiv | Rotes Dreieck wird erzeugt (Mindestdauer Ã¼berschritten â†’ echte Abwesenheit wahrscheinlich) | â€” | â€” |
| T-OBE7 | **v0.33.104 Multi-Person-Wake-Fallback**: Haushalt ohne FP2/Garmin, 2 Personen, Snapshot mit sleepWindowEnd=null aber personData.wakeConfirmed=true | sleepWindowOC7.end aus per-Person-Wakezeiten gesetzt. Log: [OC-7] Multi-Person-Wake-Fallback. OBE-Dreiecke erscheinen. bedWasEmpty=false. | â€” | â€” |
| T-OBE8 | **v0.33.104 Multi-Person-Start-Korrektur**: Snapshot mit sleepWindowStart = heutiger Abend (invertiert) | Start auf fruehesten validen Eintrag aus allSleepStartSources korrigiert. Log: [OC-7] Multi-Person-Start-Korrektur. OBE-Fenster korrekt (Start < End). | â€” | â€” |
| T-OBE9 | **v0.33.104 Freeze-Stabilitaet**: Nach korrektem Snapshot (sleepWindowEnd gesetzt) â†’ naechster Tag | _sleepFrozen=true greift. Kein falscher Abend-Start mehr. | â€” | â€” |
| T-SEX1 | **v0.33.110 Recalc force**: â€žALLES NEU (force)â€œ nach falschen intimacyEvents | JSON-Dateien: intimacyEvents=[] oder neu berechnet; Log `[OC-SEX] recalc start` + `recalc fertig`; UI 7-Tage ohne Reload aktualisiert (cacheGen) | â€” | â€” |
| T-SEX2 | **v0.33.110 Training-Labels**: sexTrainingLabels JSON in Einstellungen | Sex-Tab zeigt Kachel â€žTRAINING / REFERENZâ€œ; Abgleich Â±90 Min zu erkannten Events (âœ“/âš ) | â€” | â€” |
| T-SEX3 | **v0.33.130 Nullnummer-Button**: Erkannte Session in SexDayCard | Button "Das war kein Sex" erscheint, Klick speichert Label type=nullnummer, Kachel zeigt graue Nullnummer-Ansicht | - | - |
| T-SEX4 | **v0.33.130 Nullnummer Rueckgaengig**: Nullnummer-Ansicht, Rueckgaengig klicken | Label wird entfernt, normale Session-Kachel erscheint wieder | - | - |
| T-SEX5 | **v0.33.130 SevenDayHistory Nullnummer**: Nullnummer-Tag in Verlauf | 7-Tage-Dot zeigt gedaempftes Kreissymbol, kein Score/Typ-Label | - | - |
| T-SEX6 | **v0.33.130 RF Nullnummer-Filterung**: RF gibt nullnummer mit conf>=0.60 zurueck | Session wird aus intimacyEvents herausgefiltert (nicht nur umklassifiziert) | - | - |
| T-S4 | Snapshot eingefroren (`sleepStages: []`) | NÃ¤chster Lauf berechnet Stages neu (WINDOW-FROZEN log sichtbar) | â€” | â€” |
| T-S9 | **v0.33.88**: Garmin-Wake trifft NACH erstem saveDailyHistory ein (Morgen-Szenario) | Stages werden korrekt mit Garmin-Ende berechnet (nicht mit FP2-Ende oder Date.now); Log: `[OC-7] Garmin Wake vorab` | â€” | â€” |
| T-S10 | **v0.33.88**: FROZEN-Snapshot, Garmin verschiebt Einschlafzeit um >5 Min | Stages werden neu berechnet (nicht aus Snapshot); Log: `[FROZEN-Fix] Garmin verschob Start um X Min â†’ Stages neu berechnen` | â€” | â€” |
| T-S5 | Normalnacht ohne FP2, mit Vibrationssensor | Fixfenster 20â€“09 Uhr + Stages aus Vibrationsdaten | â€” | â€” |
| T-S6 | Garmin-Score vorhanden | Garmin-Score erscheint unter AURA-Score in lila (Differenz korrekt) | â€” | â€” |
| T-S7 | Nap (Einschlafzeit 14:00 Uhr) | Kachel zeigt Nickerchen-Hinweis â­’; kein OC-7-Score | â€” | â€” |
| T-S8 | Liegezeit > 12h | Kachel zeigt âš  UngewÃ¶hnlich lange Liegezeit | â€” | â€” |

---

## ðŸ§ª Testbereich 2: AUFWACHZEIT-ERKENNUNG

| ID | Testfall | Erwartetes Ergebnis | GeprÃ¼ft am | âœ…/âŒ |
|---|---|---|---|---|
| T-W1 | Normales Aufstehen: FP2-Bett wird leer + kein ZurÃ¼ckkehren | wakeTs = Zeitpunkt Bett leer (nicht Date.now()); wakeSource = 'fp2' | â€” | â€” |
| T-W2 | Bett machen (kurz < 5 Min wieder belegt): Debounce | wakeTs bleibt beim ersten Leer-Zeitpunkt; nicht auf 08:55 verschoben | â€” | â€” |
| T-W3 | Mehrfaches Aufwachen: 06:30 Toilette, RÃ¼ckkehr, 08:00 wirklich auf | wakeTs = 08:00 (letztes valides Ende) | â€” | â€” |
| T-W4 | FP2 + Wohnzimmer-PIR (Einpersonenhaushalt), beide Â±10 Min | wakeSource = 'fp2_other'; wakeTs = frÃ¼herer der beiden Werte | â€” | â€” |
| T-W5 | Nur Wohnzimmer-PIR, kein FP2 (Einpersonenhaushalt) | wakeSource = 'other'; wakeTs = erste PIR-Flanke nach 04:00 + â‰¥3h | â€” | â€” |
| T-W6 | Mehrpersonenhaushalt: Wohnzimmer-PIR aktiv aber 2 Personen erkannt | t_other wird NICHT verwendet; wakeSource = 'fp2' oder 'motion' | â€” | â€” |
| T-W7 | Bad-Sensor mit personTag gesetzt: Einpersonenhaushalt | Bad-Ereignis nach 04:00 wird als t_other-Kandidat gewertet | â€” | â€” |
| T-W8 | Bad-Sensor OHNE personTag: Mehrpersonenhaushalt | Bad-Ereignis wird NICHT als Aufwach-Signal gewertet | â€” | â€” |
| T-W9 | Garmin-Uhr verbunden: sleepEndTimestampGMT vorhanden | wakeSource = 'garmin' âŒš; Garmin-Zeit wird verwendet | â€” | â€” |
| T-W10 | Garmin-Uhr nicht vorhanden (State nicht lesbar) | Graceful Fallback auf FP2 â†’ PIR â†’ Fixfenster (kein Fehler im Log) | â€” | â€” |
| T-W11 | Vibrationssensor: letzte Vibration 07:50, danach 45 Min still | _tVibWake = 07:50; nur als Booster wenn FP2 in Â±30 Min | â€” | â€” |
| T-W12 | Return-to-Bed: Person geht 04:11 ins Bad, kehrt 04:43 zurÃ¼ck, steht 06:18 auf | wakeSource = 'other'; wakeTs = 06:18 (nicht 04:11!) | 25.03.2026 | â€” |
| T-W13 | OC-18 Problem A: Anderes Schlafzimmer (personTag 'Ingrid') feuert um 04:05 | Ingrid's Schlafzimmer-Sensor (isBedroomMotion=true) wird NICHT als otherRoomWakeTs gewertet | 25.03.2026 | â€” |
| T-W14 | FP2-Label-Fix: Kein FP2 (type=motion) als Bett-Sensor konfiguriert | Tooltip zeigt "Bett-Bewegungsmelder" statt "FP2-Sensor"; fp2OtherWakeTs = null | 25.03.2026 | â€” |
| T-W15 | FP2-Label-Fix: Echter FP2 (type=presence_radar_bool) konfiguriert | Tooltip zeigt weiterhin "FP2-Sensor"; fp2OtherWakeTs wird weiterhin berechnet | â€” | â€” |
| T-W16 | RÃ¼ckwÃ¤rtskomp. Einpersonenhaushalt (kein personTag): Return-to-Bed aktiv | Einpersonenhaushalt: otherRoomWakeTs korrekt (keine Regression durch OC-19) | â€” | â€” |

---

## ðŸ§ª Testbereich 3: EINSCHLAFZEIT-ERKENNUNG

| ID | Testfall | Erwartetes Ergebnis | GeprÃ¼ft am | âœ…/âŒ |
|---|---|---|---|---|
| T-E1 | Normales Einschlafen 23:00, FP2-Bett aktiv, kein Garmin | sleepStartSource = 'fp2' ðŸ“¡; Einschlafzeit = FP2-Bettbelegung | â€” | â€” |
| T-E2 | FP2 belegt 22:30, Vibration bis 23:15 dann â‰¥20min Stille | sleepStartSource = 'fp2_vib'; Einschlafzeit ~23:15 (nicht 22:30!) | â€” | â€” |
| T-E3 | Garmin sleepStartTimestampGMT vorhanden, 18â€“04 Uhr, â‰¤3h nach FP2 | sleepStartSource = 'garmin' âŒš; Garmin Ã¼berschreibt FP2/Vib (hÃ¶chste Prio) | â€” | â€” |
| T-E4 | Garmin-Start > 3h nach FP2-Bettbelegung (stark verspÃ¤tet) | Garmin wird ignoriert; Fallback auf fp2_vib oder fp2 | â€” | â€” |
| T-E5 | Kein FP2, Schlafzimmer-PIR: letzte Bewegung 23:05 + 45 Min Stille | sleepStartSource = 'motion' ðŸš¶; Einschlafzeit ~23:05 | â€” | â€” |
| T-E6 | Gar keine Sensoren: nur Fixfenster | sleepStartSource = 'fixed' â°; Fenster 20â€“09 Uhr | â€” | â€” |
| T-E7 | âš™ Quellen-Tooltip auf Einschlafzeit (DEV-Mode) | Hover Ã¼ber "âš™ Quellen": alle 5 Quellen mit Zeiten, aktive mit "â† AKTIV" | â€” | â€” |
| T-E8 | **v0.33.80**: Kein FP2, aber PIR + Vibrationssensor vorhanden | `sleepStartSource = 'motion_vib'`; Einschlafzeit via letztem Vib-Event + â‰¥20 Min Stille (im Motion-Fenster) | â€” | â€” |
| T-E9 | **v0.33.80**: `haus_still` als aktive Quelle | Tooltip zeigt `ðŸ  Haus-wird-still` (kein `? haus_still`) + aktive Markierung korrekt | â€” | â€” |
| T-E15 | **v0.33.88**: haus_still â€” ein Sensor feuert sporadisch die ganze Nacht (Rausch-Sensor) | haus_still liefert trotzdem einen Wert (Einzelsensor zÃ¤hlt nicht als "Haus aktiv"); Log zeigt keinen permanenten Block durch einen Sensor | â€” | â€” |
| T-E16 | **v0.33.88**: haus_still â€” zwei verschiedene Sensoren feuern gleichzeitig nach letztem Schlafzimmer-Event | haus_still = null fÃ¼r diesen Kandidaten (zwei Sensoren = echte AktivitÃ¤t) | â€” | â€” |
| T-E10 | **v0.33.84 Fix A**: FP2 Gap-Fusion: Nutzer steht kurz auf (WC, <=30 Min) und kehrt zurueck | sleepStartSource = fp2 (oder fp2_vib); Einschlafzeit = Start VOR der Unterbrechung (nicht Rueckkehrzeit!) | â€” | â€” |
| T-E11 | **v0.33.84 Fix B**: Garmin-Start liegt kurz VOR FP2-Start (biologisch frueher eingeschlafen) | Garmin wird akzeptiert (|Garmin - fp2| <= 3h); sleepStartSource = garmin | â€” | â€” |
| T-E12 | **v0.33.84 Fix C**: Manueller Override wenn Nacht eingefroren (nach Aufwachen) | Uhrzeit + Balken auf Kachel aendern sich sofort auf Override-Zeit; sleepWindowEnd bleibt unveraendert | â€” | â€” |
| T-E13 | **v0.33.85 Fix 1**: Automatik wiederherstellen bei FROZEN Nacht mit Garmin | Angezeigte Einschlafzeit wechselt zu Garmin-Zeit; kein "manuell"-Badge | â€” | â€” |
| T-E14 | **v0.33.85 Fix 3**: Override-Start vor Stage-Analyse-Fenster (z.B. FP2 22:55, Stages ab 04:19) | Balken: schraffiertes Grau von 22:55-04:19, dann Stage-Segmente 04:19-07:19; proportionale Breiten | â€” | â€” |
| T-E17 | **v0.33.270 OC-45c Radar-Rausch-Guard**: Radar (presence_radar_count, isFP2Bed) springt kurz nach bedEntryTs fuer 2s auf 0 (Aussetzer), bleibt dann belegt | bedEntryTs bleibt erhalten (NICHT verworfen); kurzer Aussetzer < 60s ignoriert | 07.06.2026 | â€” |
| T-E18 | **v0.33.270 OC-45c**: Echter FP2 verlaesst Bett dauerhaft > 60s + Motion ausserhalb | OC-45c greift weiterhin (echtes Verlassen erkannt); bedEntryTs auf naechste stabile Periode | â€” | â€” |
| T-E19 | **v0.33.270 OC-4 Gap-Fusion**: Radar mit vielen Aussetzern, Luecken < 30 Min, Gesamtspan > 3h | bedPresenceMinutes > 180 (fusioniert); FP2-Schlaffenster NICHT verworfen | 07.06.2026 | â€” |
| T-E20 | **v0.33.270**: Nur-Vibration / Nur-PIR Setup (kein isFP2Bed) | Gap-Fusion + Rausch-Guard ohne Wirkung; Verhalten unveraendert (Sensor-Neutralitaet) | â€” | â€” |

---

## ðŸ§ª Testbereich 4: KACHEL-DARSTELLUNG (Frontend)

| ID | Testfall | Erwartetes Ergebnis | GeprÃ¼ft am | âœ…/âŒ |
|---|---|---|---|---|
| T-K1 | Datum der Nacht | Unter Score: "Nacht vom 21.03. auf 22.03.2026" | â€” | â€” |
| T-K2 | Einschlaf innerhalb gleichen Tages (z.B. Nap 14:00â€“16:00) | "Nacht 22.03.2026" (kein "auf") | â€” | â€” |
| T-K3 | Einschlaf-Sensor-Indikator aus sleepStartSource | Richtiges Icon + Label unter Einschlafzeit (z.B. "ðŸ“¡ FP2 + Vibration") | â€” | â€” |
| T-K4 | Aufwach-Sensor-Indikator | Richtiges Icon + Label unter Aufwachzeit (getrennt von Einschlaf!) | â€” | â€” |
| T-K5 | wakeConfirmed = false | Aufwachzeit orange mit âŸ³ | â€” | â€” |
| T-K6 | wakeConfirmed = true | Aufwachzeit grau mit âœ“ | â€” | â€” |
| T-K7 | Garmin-Icon âŒš | Erscheint wenn wakeSource = 'garmin' | â€” | â€” |
| T-K8 | "Kein Vibrationssensor" verschwindet nach Fix | Wenn stages.length > 0 â†’ kein "Kein Vibrationssensor"-Block | â€” | â€” |
| T-K9 | Score-Farbe: grÃ¼n â‰¥80, orange 60â€“79, rot <60 | Korrekte Farbe je Score | â€” | â€” |
| T-K10 | Schlafdauer-Anzeige | Zwischen Score und Garmin-Score: "ðŸ• Xh Ymin" in blau | â€” | â€” |
| T-K11 | Legende: kein "Wach" mehr | Legende zeigt "Wachliegen" (nicht "Wach"); Zeitbalken-Zusammenfassung ebenfalls | â€” | â€” |
| T-K12 | Vibrations-IntensitÃ¤t Y-Achse dynamisch | Y-Achse zeigt nicht mehr 0â€“255 sondern z.B. 0â€“40 je nach Datenlage | â€” | â€” |
| T-K13 | Gesundheits-Tab lÃ¤dt ohne weiÃŸen Bildschirm | Tab Ã¶ffnet sich; keine ReferenceError in Browser-Konsole | 23.03.2026 | â€” |
| T-K14 | **OC-9**: Score = 100, sleepScoreRaw = 112 | Im Badge erscheint "â†‘ roh: 112" in Teal-Farbe unterhalb "AURA-Sleepscore" | â€” | â€” |
| T-K15 | **OC-9**: Score = 85, sleepScoreRaw = 85 | Kein "â†‘ roh:"-Hinweis sichtbar (nur wenn Rohwert > 100) | â€” | â€” |
| T-K16 | **OC-9**: Hover Ã¼ber "â†‘ roh:" | Tooltip erklÃ¤rt "Ungekappter Rohwert â€¦ fÃ¼r Anzeige auf 100 begrenzt" | â€” | â€” |
| T-K17 | **OC-14**: Wake-Quellen Dev-Tooltip: Vibration-Quelle | Label zeigt "Vibrationssensor (â†‘ Konfidenz)" statt "(BestÃ¤tigung)"; `[Konfidenz-Booster]` im âš™ Quellen-Tooltip | â€” | â€” |
| T-K18 | **v0.33.80**: Quellen-Tooltip Einschlafzeit enthÃ¤lt neue Quelle `motion_vib` | Tooltip zeigt `ðŸš¶ Bewegungsmelder + Vibration` wenn Quelle aktiv; kein unbekanntes Label | â€” | â€” |
| T-K19 | **v0.33.81**: Per-Person-Kacheln (Ingrid/Robert) nach `analysis.trigger` bei PIR-only | Zwei Kacheln erscheinen wieder; `system.personData` enthÃ¤lt `sleepWindowStart/End != null` statt durchgehend `null` | â€” | â€” |
| T-K25 | **v0.33.90**: Per-Person sleepWindowStart=null wenn Person vor winStart eingeschlafen (winStart = 01:58, erstes Event 02:08) | `personData.Ingrid.sleepWindowStart = winStart` (Fallback greift); Kachel zeigt Schlaf/Aufwachzeit statt "Erste Daten" | â€” | â€” |
| T-K26 | **v0.33.91**: PIR-only Haus: Einschlafzeit zeigt echte Bettgehzeit (Ingrid ~23:00, Robert ~21-22 Uhr) statt winStart (01:58) | `sleepWindowStart` â‰ˆ letztes Abend-Bedroom-Event vor langem Gap (>15 min); nicht mehr winStart | â€” | â€” |
| T-K27 | **v0.33.91**: Per-Person-Kachel: "âš™ Quellen â–¼" Button unsichtbar | Button erscheint nur wenn `allSleepStartSources.length > 0`; bei Gondelsheim (leer) kein Button | â€” | â€” |
| T-K28 | **v0.33.91**: Per-Person-Kachel: Einschlafzeit-Quelle zeigt "Bewegungsmelder" | Icon/Label fÃ¼r `sleepStartSource='motion'` korrekt; nicht mehr "Anderer Raum" | â€” | â€” |

---

## ðŸ§ª Testbereich 4c: AUSSERHALB-BETT â€” FP2+Bad+Anderer Raum gleichzeitig (ab v0.33.92)

| ID | Testfall | Erwartetes Ergebnis | GeprÃ¼ft am | âœ…/âŒ |
|---|---|---|---|---|
| T-O14 | **v0.33.92**: FP2 leer + Bad + Diele/Wohnen alle <90s | BEIDE Dreiecke: orange (Bad) + rot (AuÃŸerhalb); kein Dreieck fehlt | â€” | â€” |
| T-O15 | **v0.33.92**: FP2 leer + Bad + KÃ¼che (kein anderer Raum) | BEIDE Dreiecke: orange + rot; KÃ¼che gilt jetzt als anderer Raum | â€” | â€” |
| T-O16 | **v0.33.92**: FP2 leer + NUR Bad (kein anderer Raum) | Weiterhin nur EIN oranges Dreieck (hasOther=false) | â€” | â€” |
| T-O17 | **v0.33.92**: Kein FP2, Motion-Cluster: Bad + KÃ¼che | BEIDE Dreiecke (Phase-2-Pfad, KÃ¼che jetzt in isOther) | â€” | â€” |
| T-O18 | **v0.33.92**: kitchenVisits-ZÃ¤hler unverÃ¤ndert | isKitchenSensor-Flag bleibt; KÃ¼chen-Nachtbesuche weiterhin gezÃ¤hlt | â€” | â€” |
| T-K20 | **v0.33.82 OC-23**: `âš™ Quellen â–¼` Button klicken | Panel Ã¶ffnet sich mit allen `allSleepStartSources`; aktive Quelle grÃ¼n; Quellen ohne `ts` ausgegraut | â€” | â€” |
| T-K21 | **v0.33.82 OC-23**: Inaktive Quelle mit ts wÃ¤hlen â†’ `[WÃ¤hlen]` | Spinner erscheint; nach Neuberechnung zeigt Einschlafzeit + Quellenanzeige die neue Quelle; `âœï¸ manuell` Badge sichtbar | â€” | â€” |
| T-K22 | **v0.33.82 OC-23**: `[â†º Automatik wiederherstellen]` klicken | Override gelÃ¶scht; Schlafanalyse kehrt zur automatischen Quelle zurÃ¼ck; `âœï¸ manuell` Badge verschwindet | â€” | â€” |
| T-K23 | **v0.33.82 OC-23**: Override am nÃ¤chsten Morgen | Override vom Vortag hat keinen Effekt (Datums-PrÃ¼fung schlÃ¤gt fehl); Analyse lÃ¤uft mit Automatik | â€” | â€” |
| T-K24 | **v0.33.88**: Quellen-Tooltip zeigt Quelle 'fixed' | Label lautet jetzt "Fallback 20:00 Uhr" (nicht mehr "SchÃ¤tzung") | â€” | â€” |

---

## ðŸ§ª Testbereich 4b: AUSSERHALB-BETT-EVENTS (outsideBedEvents ab v0.33.65, erweitert v0.33.74)

| ID | Testfall | Erwartetes Ergebnis | GeprÃ¼ft am | âœ…/âŒ |
|---|---|---|---|---|
| T-O1 | Nachts Bad-Sensor feuert (isBathroomSensor), FP2 bleibt belegt | Dreieck â–¼ im Schlafbalken (orange #ffb300) erscheint; Typ = 'bathroom' | â€” | â€” |
| T-O2 | Nachts Wohnzimmer-/Diele-Sensor feuert (Einpersonenhaushalt) | Rotes Dreieck â–¼ (#e53935) erscheint; Typ = 'outside'; in Schlaf-Radar sichtbar | â€” | â€” |
| T-O3 | Nachts Wohnzimmer-Sensor feuert (Mehrpersonenhaushalt, kein FP2) | Blaues Dreieck â–¼ (#1e88e5) erscheint; Typ = 'other_person'; Legende "â–  Andere Person" | â€” | â€” |
| T-O4 | Nachts Wohnzimmer-Sensor feuert (Mehrpersonenhaushalt, FP2 Bett leer bestÃ¤tigt) | Rotes Dreieck â–¼ (Typ = 'outside') â€” FP2 bestÃ¤tigt Person selbst war es | â€” | â€” |
| T-O5 | Nachts Wohnzimmer-Sensor feuert (Mehrpersonenhaushalt, FP2 Bett belegt) | Blaues Dreieck â–¼ (Typ = 'other_person') â€” FP2 zeigt Person lag noch im Bett | â€” | â€” |
| T-O6 | Nachts KÃ¼chensensor feuert (isKitchenSensor, Einpersonenhaushalt) | Rotes Dreieck; Typ = 'outside' | â€” | â€” |
| T-O7 | Bad + Wohnzimmer innerhalb 5 Min â†’ ein Cluster (hasBath+hasOther) | **v0.33.88**: ZWEI Dreiecke â€” orange (bathroom) + rot (outside); beide im Balken sichtbar | â€” | â€” |
| T-O7b | Cluster mit NUR Bad (kein anderer Raum) | Weiterhin nur EIN oranges Dreieck (kein rotes) | â€” | â€” |
| T-O7c | **v0.33.89**: FROZEN-Nacht mit Bad + Diele + Wohnzimmer | Beide Dreiecke erscheinen (orange + rot) â€” FROZEN-Bypass greift nicht mehr | â€” | â€” |
| T-O8 | FP2 leer + Bad-Sensor gleichzeitig | FP2-Event hat Vorrang; Motion-Event wird nicht dupliziert; Typ = 'bathroom' | â€” | â€” |
| T-O9 | Snapshot eingefroren, outsideBedEvents war leer | Motion-Events korrekt analysiert (volle Phase 1/2/3 lÃ¤uft immer) | â€” | â€” |
| T-O10 | Balken-Clipping: Event endet nach Aufwachzeit | Event wird auf sleepWindowEnd geclippt; kein Balken-Ãœberstand | â€” | â€” |
| T-O11 | Zwei nahe Dreiecke: Bad 02:00, Wohnzimmer 02:04 | Zwei Dreiecke in zwei Lanes; verschiedene Farben (orange + rot) | â€” | â€” |
| T-O12 | Event um 23:59:57 (Wohnzimmer kurz vor Mitternacht) | Im Schlaf-Radar Slot 47 (23:30â€“00:00) sichtbar (via outsideBedEvents Slot-Mapping) | â€” | â€” |
| T-O13 | Dreiecke optisch: GrÃ¶ÃŸe und Form | Unicode-Dreiecke â–¼/â–² (nicht 'v'/'^'), SchriftgrÃ¶ÃŸe 15px, deutlich sichtbar | â€” | â€” |

---

## ðŸ§ª Testbereich 5: GANGGESCHWINDIGKEIT & PRIMÃ„RFLUR (ab v0.33.59)

| ID | Testfall | Erwartetes Ergebnis | GeprÃ¼ft am | âœ…/âŒ |
|---|---|---|---|---|
| T-G1 | Kein PrimÃ¤rflur gesetzt (isPrimaryHallway nirgends true) | Alle Flur-Sensoren werden fÃ¼r Transitzeiten gemischt (Fallback = alter Modus) | â€” | â€” |
| T-G2 | Genau ein Sensor als PrimÃ¤rflur markiert | Nur dieser Sensor liefert Transitzeiten; andere Flure werden ignoriert | â€” | â€” |
| T-G3 | P-Flur Checkbox erscheint nur bei Funktion "Flur/Gang" | Bei anderen Sensor-Funktionen: leere Zelle (keine Checkbox sichtbar) | â€” | â€” |
| T-G4 | Mehrere Sensoren als PrimÃ¤rflur markiert (Fehler-Case) | Alle markierten PrimÃ¤rflure werden gemischt (kein Absturz) | â€” | â€” |

---

## ðŸ§ª Testbereich 6: ROBUSTHEIT & EDGE CASES (unverÃ¤ndert)

| ID | Testfall | Erwartetes Ergebnis | GeprÃ¼ft am | âœ…/âŒ |
|---|---|---|---|---|
| T-R1 | Adapter-Neustart mitten in der Nacht | OC-4 Guard verhindert falsches Schlaffenster (Log: "bedPresMin < 180") | â€” | â€” |
| T-R2 | Sleep FROZEN: Snapshot hat valide Stages | Sleep FROZEN log; Stages unverÃ¤ndert aus Snapshot | â€” | â€” |
| T-R3 | Sleep WINDOW-FROZEN: Snapshot hat leere Stages | WINDOW-FROZEN log; Stages werden NEU berechnet | â€” | â€” |
| T-R4 | Alle Zigbee-Sensoren ausgefallen (wie 22.03.2026) | Kein Score 100 + Tiefschlaf; korrekte Degradation erkennbar | â€” | â€” |
| T-R5 | Kein einziger Sensor konfiguriert | Kachel zeigt "Erste Daten werden gesammelt"; kein JS-Fehler | â€” | â€” |
| T-R6 | Schlaffenster > 24h (unplausibel) | Wird durch Fixfenster-Logik begrenzt; kein Absturz | â€” | â€” |
| T-R7 | `node --check main.js` nach jeder Ã„nderung | Exit code 0; keine Syntaxfehler | â€” | â€” |

---

## ðŸ§ª Testbereich 7: SENSOR-OFFLINE & PUSHOVER (OC-5 ab v0.33.66) + BATTERIE (OC-15 ab v0.33.67)

| ID | Testfall | Erwartetes Ergebnis | GeprÃ¼ft am | âœ…/âŒ |
|---|---|---|---|---|
| T-P1 | motion-Sensor: 6 Tage kein Signal | **Kein** Pushover (neue Schwelle = 7 Tage) | â€” | â€” |
| T-P2 | motion-Sensor: 8 Tage kein Signal | Pushover-Alarm kommt (Schwelle Ã¼berschritten) | â€” | â€” |
| T-P3 | TÃ¼rsensor: 6 Tage kein Signal | Kein Alarm (TÃ¼rsensoren waren schon immer 7 Tage â€” unverÃ¤ndert) | â€” | â€” |
| T-P4 | KNX/Loxone-Sensor: beliebig lang kein Signal | Niemals Alarm (kabelgebunden, kein Heartbeat erwartet) | â€” | â€” |
| T-P5 | Adapter-Neustart wÃ¤hrend Nachtruhe (22â€“08 Uhr) | Pushover-Alarm wird bis nach 08:00 Uhr unterdrÃ¼ckt | â€” | â€” |
| T-B1 | **OC-15**: Vibrationssensor hat `battery = 15%` | Battery-State wird per Auto-Discovery gefunden; `system.sensorBatteryStatus` enthÃ¤lt Eintrag mit `isLow=true` | â€” | â€” |
| T-B2 | **OC-15**: Sensor hat `battery_low = true` (Bool) | `isCritical=true`, `level=5` (geschÃ¤tzt); Badge in Schlafkachel erscheint ðŸ”‹ | â€” | â€” |
| T-B3 | **OC-15**: Alias-Sensor (`alias.0.xxx`) | Discovery rekonstruiert nativen Pfad via `common.alias.id`; Battery-State wird trotzdem gefunden | â€” | â€” |
| T-B4 | **OC-15**: KNX-Sensor (`knx.0.xxx`) | Sensor wird von Battery-Discovery Ã¼bersprungen; kein Eintrag in `sensorBatteryStatus` | â€” | â€” |
| T-B5 | **OC-15**: Manuelles `batteryStateId` gesetzt | Manuell eingetragener Pfad hat Vorrang vor Auto-Discovery | â€” | â€” |
| T-B6 | **OC-15**: Batterie bei 8%, Uhrzeit 10:00 | Pushover wird gesendet (kritisch + 09:00+) mit Sensor-Name + Ort + Prozentwert | â€” | â€” |
| T-B7 | **OC-15**: Zweiter Check um 11:00 Uhr (kritisch) | **Kein** zweiter Pushover (Dedup per Tag: `_lastBatteryPushoverDay`) | â€” | â€” |
| T-OC2-1 | **OC-2**: Sicherheits-Tab Ã¶ffnen | TopologyView nicht mehr sichtbar; stattdessen Alert "Topologie-Matrix â†’ System-Tab" | â€” | â€” |
| T-OC2-2 | **OC-2**: System-Tab Ã¶ffnen | Accordion "Topologie-Matrix & Raum-Adjazenz" sichtbar; TopologyView korrekt eingebettet | â€” | â€” |

---

## ðŸ§ª Testbereich 8: VERSIONIERUNG & DEPLOYMENT

| ID | Testfall | Erwartetes Ergebnis | GeprÃ¼ft am | âœ…/âŒ |
|---|---|---|---|---|
| T-V1 | package.json + io-package.json: Versions identisch | Beide zeigen gleiche Versionsnummer | â€” | â€” |
| T-V2 | `node --check main.js` | Keine Syntaxfehler | â€” | â€” |
| T-V3 | `npm run build:backend:prod` erfolgreich + main.js obfuskiert | Kein Build-Fehler; erste Zeile main.js unleserlich (z.B. `const a0_0x...`) | â€” | â€” |
| T-V4 | `npm run build:react` erfolgreich | Kein Build-Fehler; admin/ aktualisiert | â€” | â€” |
| T-V5 | ioBroker lÃ¤dt neue Version | Adapter startet ohne Fehler im Log | â€” | â€” |
| T-V6 | Adapter-Log zeigt keine ERROR-Zeilen beim Start | Sauber hochfahren | â€” | â€” |

---

---

## ðŸ§ª T-BED: bedWasEmpty â€” Bett leer / Person auswÃ¤rts (v0.33.94)

### Testfall T-BED-1: AuswÃ¤rts-Nacht wird korrekt erkannt
**Vorbedingung:** Person schlÃ¤ft auswÃ¤rts, Garmin-Uhr ist dabei
**Erwartung:** bedWasEmpty=true â†’ sleepScore=null, sleepStages=[], Frontend zeigt "ðŸ  Bett war leer"
**PrÃ¼fschritte:**
1. Nacht auswÃ¤rts verbracht (Garmin trÃ¤gt Schlafdaten ein)
2. Morgens AURA-Kachel Ã¶ffnen
3. Kachel zeigt NICHT Score 100 oder Stage-Balken
4. Kachel zeigt "Bett war leer" mit Garmin-Referenz (Zeit + Garmin-Score)

### Testfall T-BED-2: Heimnacht bleibt unverÃ¤ndert
**Vorbedingung:** Person schlÃ¤ft zu Hause mit FP2/Vibrationssensor
**Erwartung:** bedWasEmpty=false â†’ Score und Stages werden normal angezeigt
**PrÃ¼fschritte:**
1. Normale Nacht zu Hause
2. AURA-Kachel zeigt Score + Stage-Balken wie gewohnt
3. Kein "Bett war leer"-Hinweis

### Testfall T-BED-3: Erkennungs-Kriterien (JSON-Analyse)
**Erwartung im gespeicherten Snapshot:**
- `bedWasEmpty: true` wenn: eventHistory=leer, nightVibrationCount=0, fp2/haus_still/motion_vib-Quellen alle null
- `sleepScore: null`, `sleepStages: []`
- Garmin-Zeiten (sleepWindowStart/End) bleiben erhalten fÃ¼r Referenz

### Ergebnis
| Datum | Version | Tester | Ergebnis |
|---|---|---|---|
| 04.04.2026 | 0.33.94 | Marc | âœ… Kachel zeigt "ðŸ  Bett war leer" + Garmin-Referenz korrekt |

---

---

## ðŸ§ª T-FROZEN: Per-Person FROZEN + OC-28 Stages (v0.33.95)

### Testfall T-FROZEN-1: Per-Person Aufwachzeit bleibt stabil
**Vorbedingung:** Gondelsheim â€” Ingrid/Robert schlafen, wachen um ~08:00-09:00 auf, danach tagsÃ¼ber weitere Bett-Events
**Erwartung:** Aufwachzeit bleibt bei ~08:48 auch wenn um 11:00, 13:00 weitere Bett-Events kommen
**PrÃ¼fschritte:**
1. Morgens (>2h nach Aufwachzeit) JSON-Export anschauen: `personData.Ingrid.sleepWindowEnd` = ~08:48?
2. ioBroker-Log: erscheint `[Per-Person FROZEN] Ingrid: Aufwachzeit eingefroren auf 08:48`?
3. Abends nochmal JSON: Wert immer noch ~08:48?

### Testfall T-FROZEN-2: OC-28 Stages werden bei frÃ¼hem Garmin-Sync neu berechnet
**Vorbedingung:** Garmin synct frÃ¼h (z.B. 02:00) mit sleepWindowEnd = 06:30
**Erwartung:** Stages werden NICHT eingefroren, sondern bei jedem saveDailyHistory-Lauf neu berechnet solange `Date.now() < sleepWindowEnd + 30min`
**PrÃ¼fschritte:**
1. ioBroker-Log nach Garmin-Sync: erscheint `[OC-28] Stages neu berechnen: Fenster noch aktiv/gerade beendet`?
2. Stages-Balken zeigt nach dem Aufwachen volle Nacht (nicht nur erste 2h)?
3. Nach 30min past sleepWindowEnd: Log zeigt `[History] Sleep FROZEN`?

### Testfall T-FROZEN-3: Normaler FROZEN bleibt erhalten (Regression)
**Vorbedingung:** Nacht abgeschlossen, 3+ Stunden nach Aufwachzeit, Stages korrekt gespeichert
**Erwartung:** FROZEN-Snapshot wird unverÃ¤ndert verwendet (kein unnÃ¶tiges Neuberechnen)
**PrÃ¼fschritte:**
1. Nachmittags saveDailyHistory-Lauf: Log zeigt `[History] Sleep FROZEN`?
2. sleepStages im JSON unverÃ¤ndert zur Morgenstunde?

### Ergebnis
| Datum | Version | Tester | Ergebnis |
|---|---|---|---|
| 04.04.2026 | 0.33.95 | Marc | â³ ausstehend (Deploy nÃ¶tig) |

---

## ðŸ§ª Testbereich 9: PER-PERSON TOOLTIPS, BEDWASEMPTY & OVERRIDE (OC-neu-A/B/C) â€” v0.33.96

| ID | Testfall | Erwartetes Ergebnis | GeprÃ¼ft am | âœ…/âŒ |
|---|---|---|---|---|
| T-PP1 | Gondelsheim: Per-Person-Kachel aufrufen (Ingrid/Robert) | Quellen-Tooltip "âš™ Quellen â–¼" erscheint unterhalb der Einschlafzeit | â€” | â€” |
| T-PP2 | Tooltip Ã¶ffnen: zeigt erkannte Methode mit Zeitstempel | Aktive Quelle (z.B. gap60, last_outside, haus_still) als "âœ“ AKTIV" markiert | â€” | â€” |
| T-PP3 | Gondelsheim: Person war nachts nicht im Bett (keine Events) | "Bett war leer" Meldung in der Per-Person-Kachel | â€” | â€” |
| T-PP4 | Gondelsheim: Aufwachzeit nach 10:00 + 1h vergangen | GrÃ¼ner Haken (wakeConfirmed) erscheint bei Aufwachzeit | â€” | â€” |
| T-PP5 | Per-Person Override: Andere Quelle wÃ¤hlen ("WÃ¤hlen" klicken) | Einschlafzeit Ã¤ndert sich, "âœï¸ manuell" Markierung erscheint | â€” | â€” |
| T-PP6 | Per-Person Override: "â†º Automatik wiederherstellen" klicken | Override wird gelÃ¶scht, Algorithmus-Ergebnis kehrt zurÃ¼ck | â€” | â€” |
| T-PP7 | Per-Person Override: Adapter-Neustart nach Override | Override bleibt erhalten (in `analysis.sleep.personStartOverrides` State gespeichert) | â€” | â€” |
| T-PP8 | Hauptkachel (Einpersonenhaushalt): Override-Panel noch funktionstÃ¼chtig | Keine Regression: âš™ Quellen Panel Ã¶ffnet sich, alte Handler funktionieren | â€” | â€” |

---

## ðŸ§ª Testbereich 11: BEDWASEMPTY + OBE BEI MOTION-ONLY SETUPS (v0.33.102)

| ID | Testfall | Erwartetes Ergebnis | GeprÃ¼ft am | âœ…/âŒ |
|---|---|---|---|---|
| T-MO1 | Gondelsheim abends ~22:00: Per-Person-Kachel Ingrid/Robert | "Bett war leer" verschwindet â†’ korrekte Schlafkachel mit Einschlafzeit | â€” | â€” |
| T-MO2 | Gondelsheim morgens: Per-Person-Kachel nach Aufwachen | Normale Anzeige mit Schlafbeginn/Aufwachzeit, kein "Bett war leer" | â€” | â€” |
| T-MO3 | Gondelsheim nachts mit Bad-Besuchen | Orangene â–¼ Dreiecke Ã¼ber Balken erscheinen (Phase 2 OBE via Bad-Sensor) | â€” | â€” |
| T-MO4 | Haushalt mit Vibrationssensor: kein Regressionsfehler | _sleepFrozen-Logik mit sleepStages funktioniert weiterhin korrekt | â€” | â€” |
| T-MO5 | Gondelsheim: Snapshot korrekt eingefroren (nach 8:00 Uhr) | JSON zeigt `bedWasEmpty: false` pro Person + `outsideBedEvents` wenn Bad-Events vorhanden | â€” | â€” |

---

## ðŸ“‹ Testergebnis-Protokoll

| Datum | Version | Tester | Getestete Bereiche | Ergebnis |
|---|---|---|---|---|
| â€” | â€” | â€” | â€” | â€” |

---

## ðŸ”® Geplante Teststufen (fÃ¼r MDR-Zulassung)

1. **Manuelle Funktionstests** (diese Datei) â€” aktuell
2. **Automatisierte Unit-Tests** (geplant: Jest / Mocha fÃ¼r `main.js`-Funktionen) â€” TODO
3. **Integrationstests** mit ioBroker-Simulator â€” TODO (Phase 6+)
4. **Klinische Validierung** (Vergleich mit Polysomnographie als Ground Truth) â€” TODO (Phase 7+)

*Hinweis: FÃ¼r Klasse-I Medizinprodukt (MDR Annex II) sind keine klinischen Studien erforderlich; fÃ¼r Klasse-IIa sind kontrollierte Studien mit Evidenz nÃ¶tig.*

---

## Testbereich 12: SEX-FEATURE â€” RF-PERSISTENZ + Score-Bug (v0.33.166)

| ID | Testfall | Erwartetes Ergebnis | Geprueft am | OK? |
|---|---|---|---|---|
| T-SX1 | Adapter neu starten nach erfolgreicher RF-Aktivierung | ALGORITHMUS-Kachel zeigt Stufe 3 AKTIV (nicht INAKTIV) â€” Modell wurde aus sex_model.pkl geladen | - | - |
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
| T-SX13 | Erstes "reanalyzeSexDay" nach v0.33.168 Update | Log zeigt "[OC-SEX-RA] Labels angereichert (N mit Features)" â€” Labels werden mit _features angereichert | - | - |
| T-SX14 | Zweites "reanalyzeSexDay" nach Label-Anreicherung | Log zeigt KEINE erneute Anreicherung â€” Fast-Path greift, kein JSON-Lesen fuer Labels | - | - |
| T-SX15 | Label in "SESSION EINTRAGEN" eintragen | Beim naechsten "neu analysieren" wird das neue Label angereichert und in Config gespeichert | - | - |
| T-SX16 | 20+ Labels vorhanden: Performance "Alle neu analysieren" | Deutlich schneller als vorher (kein JSON-Lesen pro Label nach erster Migration) | - | - |

## Testbereich 15: NULLNUMMER 3. KLASSE + LAYOUT + SENSOR-TOOLTIPS (v0.33.169)

| ID | Testfall | Erwartetes Ergebnis | Geprueft am | OK? |
|---|---|---|---|---|
| T-SX17 | Nullnummer-Label eintragen und reanalyzeSexDay ausfuehren | Log zeigt kein "filter nullnummer" mehr; RF-Training bekommt alle Labels incl. Nullnummer | - | - |
| T-SX18 | Feature-Importance Balken: Hover ueber "Uhrzeit"-Zeile | Tooltip zeigt "Bett-Sensor: [zigbee-ID] | Uhrzeit abgeleitet aus Session-Start (sin)" | - | - |
| T-SX19 | Feature-Importance: Hover ueber "Raumtemperatur" wenn kein Sensor konfiguriert | Tooltip zeigt "Kein Temperatursensor konfiguriert (Sensortyp: temperature, Funktion: bed)" | - | - |
| T-SX20 | Layout: Vibrationsverlauf-Kachel Position | Kachel erscheint oberhalb von "SESSION EINTRAGEN" und "MANUELLE SESSION" (links, nicht unten) â€” Ctrl+Shift+R nÃ¶tig wenn Cache alt | - | - |

## Testbereich 16: STUFE-3-NEUSTART-FIX + CONFUSION MATRIX (v0.33.170)

| ID | Testfall | Erwartetes Ergebnis | Geprueft am | OK? |
|---|---|---|---|---|
| T-SX21 | Adapter neu starten, heute 0 Events, Seite neu laden | Stufe 3 zeigt AKTIV (nicht INAKTIV) â€” saveDailyHistory ruft Python auch bei 0 Events auf; Fallback aus bestehender JSON wenn Python noch nicht bereit | - | - |
| T-SX22 | Adapter neu starten, Python braucht >15s zum Starten | Stufe 3 zeigt AKTIV mit Fallback-Meldung im Log: "[OC-SEX] pyClassifier aus JSON erhalten (Neustart-Schutz)" | - | - |
| T-SX23 | Confusion Matrix: >= 5 Labels vorhanden, "neu analysieren" klicken | 2x2-Matrix erscheint in ALGORITHMUS-Kachel mit TP/FP/TN/FN Zahlen + Sensitivitaet + Spezifitaet | - | - |
| T-SX24 | Confusion Matrix: nur vaginal + oral (keine Nullnummer) | Matrix zeigt TN=0, FP=0 (keine No-Sex-Klasse vorhanden); TP und FN werden korrekt berechnet | - | - |
| T-SX25 | Confusion Matrix: Nullnummer vorhanden | Matrix zeigt alle 4 Felder; Sensitivitaet = TP/(TP+FN); Spezifitaet = TN/(TN+FP) | - | - |
| T-SX26 | LOO-Loop: Log nach Training mit Nullnummer | Python-LOO nutzt jetzt alle Klassen incl. Nullnummer im X_arr (kein falsches Ausfiltern) | - | - |

## Testbereich 17: LOO-DETAILS / RAUMLOCATION / SENSOREN / HOP=1 (v0.33.172)

| ID | Testfall | Erwartetes Ergebnis | Geprueft am | OK? |
|---|---|---|---|---|
| T-SX27 | Confusion Matrix: "LOO-Details anzeigen" aufklappen | Expandierbare Tabelle erscheint mit Datum, Ist, Vorhergesagt, Zelle (TP/FP/FN/TN) pro Trainings-Session | - | - |
| T-SX28 | LOO-Details: Datumsfelder gefuellt | Datum zeigt z.B. "2026-04-15" (kein "â€”") â€” date wird jetzt in TrainData-Pushes mitgegeben | - | - |
| T-SX29 | Feature-Tooltip "Licht war an": Hover wenn Licht im Schlafzimmer vorhanden | Tooltip zeigt "Lichtsensor (Schlafzimmer): [Sensor-Name] ([ID])" statt "Kein Lichtsensor konfiguriert" | - | - |
| T-SX30 | Feature-Tooltip "Raumtemperatur": Hover wenn Thermostat im Schlafzimmer | Tooltip zeigt "Temperatursensor (Schlafzimmer): [Sensor-Name] ([ID])" â€” Suche via location statt sensorFunction=bed | - | - |
| T-SX31 | Feature-Tooltip "Bad davor/danach": mehrere Bad-Sensoren konfiguriert | Tooltip listet ALLE Bad-Sensoren auf (z.B. "EG WC Bewegungsmelder, EG Bad Bewegungsmelder") | - | - |
| T-SX32 | Feature-Tooltip "Nachbarzimmer aktiv": Hover | Tooltip zeigt "Nachbarzimmer (Hop=1): [Sensoren]" â€” nur direkt angrenzende Raeume (KG Flur sollte verschwunden sein) | - | - |
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
| T-BE1 | **FP2 vorhanden**: FP2-Sensor meldet erste Bett-PrÃ¤senz um 21:28. Einschlafen laut vib_refined 22:05. | `bedEntryTs` = 21:28. Balken startet um 21:28 mit gelbem Vor-Segment (37 Min). Zeitachse zeigt "ðŸ› 21:28" links. | - | - |
| T-BE2 | **Nur Vibrationssensor**: Vibration um 21:30, nÃ¤chste Vibration um 21:33 (â‰¤5 Min). Einschlafen 22:05. | `bedEntryTs` = 21:30 (first vibration with follower â‰¤5 Min). Gelbes Vor-Segment 35 Min. | - | - |
| T-BE3 | **Nur PIR (Schlafzimmer)**: Bewegungsmelder 21:32. Keine Abgang-AktivitÃ¤t fÃ¼r 10 Min danach. | `bedEntryTs` = 21:32. Gelbes Vor-Segment vorhanden. | - | - |
| T-BE4 | **bedEntryTs â‰¤5 Min vor sleepStart**: Person lag nur kurz wach (z.B. 22:02 ins Bett, 22:06 eingeschlafen). | Kein gelbes Vor-Segment (Differenz â‰¤5 Min). Zeitachse startet normal bei sleepStart. | - | - |
| T-BE5 | **PC-Szenario**: Einschlafen 22:08. Um 23:50 Flur-PIR (Person geht zum PC). RÃ¼ckkehr 02:30 Schlafzimmer-PIR. | `smWakePhases` enthÃ¤lt 1 Eintrag: {start: 23:50, end: 02:30, durationMin: 160}. Gelber Overlay-Block im Balken. Tooltip: "â± Wachphase: 23:50 â€“ 02:30 (160 Min)". sleepStart bleibt 22:08. | - | - |
| T-BE6 | **Kurze Abwesenheit â‰¤5 Min**: Person steht 03:00 auf, kehrt 03:04 zurÃ¼ck. | Kein smWakePhase (Mindestdauer 5 Min). Kein Overlay. | - | - |
| T-BE7 | **Mehrpersonenhaushalt**: Ingrid (Zimmer A) steht auf. Robert (Zimmer B) bleibt. | Ingrids smWakePhases zeigt Abwesenheit. Roberts smWakePhases ist leer (isMine-Filter). | - | - |
| T-BE8 | **Mehrere Aufsteh-Ereignisse**: Einschlafen 22:00. Toilette 01:00-01:08, PC 03:00-04:30. | `smWakePhases` = [{01:00-01:08, 8 Min}, {03:00-04:30, 90 Min}]. Zwei gelbe Overlay-BlÃ¶cke. | - | - |

## Testbereich 21: NACHT-AUFSTEHEN-FILTER OC-31 Stage 1 (v0.33.191)

| ID | Testfall | Erwartetes Ergebnis | Geprueft am | OK? |
|---|---|---|---|---|
| T-NA1 | **Klassischer Toilettengang**: Person schlÃ¤ft ab 22:00, steht 02:44 auf (Flur-PIR), kehrt 02:51 zurÃ¼ck (Schlafzimmer-PIR). Einschlaf-Kandidaten liegen bei 02:44 und 02:46. | OC-31 erkennt Abgang 02:44, RÃ¼ckkehr 02:51. Fenster: 02:42-02:54. Kandidaten motion (02:44, 02:46) werden gefiltert. sleepStart bleibt bei vib_refined/haus_still 22:00. | - | - |
| T-NA2 | **Einpersonenhaushalt ohne personTag**: Gleicher Ablauf wie T-NA1, aber keine personTag-Konfiguration. | Identisches Ergebnis â€” personTag hat keinen Einfluss auf Stage 1. | - | - |
| T-NA3 | **Mehrpersonenhaushalt**: Beide Personen haben Schlafzimmer A und B. Person A steht auf, Flur-PIR auslÃ¶st (Shared). RÃ¼ckkehr in Schlafzimmer A erkannt. | Abgang Ã¼ber Shared-Sensor (Flur) korrekt erkannt. RÃ¼ckkehr via bedroomLocations[A]. Kandidaten von Person A gefiltert. Kandidaten von Person B unberÃ¼hrt. | - | - |
| T-NA4 | **Hop-Gap: Raum ohne Bewegungsmelder dazwischen**: Schlafzimmer â†’ Flur (kein PIR) â†’ Bad (PIR). Hop-Distanz Bad = 2. | Bad-Event (Hop=2) liegt innerhalb Limit (4). Abgang wird korrekt erkannt. | - | - |
| T-NA5 | **Zu weit weg (Hop > 4)**: Keller-Sensor lÃ¶st nachts aus (Hop=5 vom Schlafzimmer). | Keller-Event wird ignoriert (Hop > 4). Kein Nacht-Aufstehen erkannt. Kein fÃ¤lschliches Filtern. | - | - |
| T-NA6 | **Kein Nacht-Aufstehen**: Person verlÃ¤sst Schlafzimmer um 02:44 aber kommt NICHT zurÃ¼ck (z.B. schlÃ¤ft auf Sofa). | Kein RÃ¼ckkehr-Event innerhalb 20 Min â†’ kein Fenster. Kandidaten bleiben im Pool. | - | - |
| T-NA7 | **Lange Abwesenheit > 20 Min**: Person steht 02:00 auf, kommt erst 02:35 zurÃ¼ck. | 20-Min-Fenster Ã¼berschritten â†’ kein Nacht-Aufstehen erkannt. Kandidaten bleiben. Neues "Einschlafen" mÃ¶glicherweise korrekt. | - | - |
| T-NA8 | **Garmin/FP2 vorhanden**: Garmin zeigt Einschlafzeit 22:15. Nacht-Aufstehen bei 02:44 erkannt. | Garmin als Trusted-Quelle (prio=0) wird NICHT gefiltert. sleepStart = Garmin 22:15. Filter bereinigt nur prio>=4-Kandidaten. | - | - |
| T-NA9 | **Keine False Positives tagsÃ¼ber**: Person verlÃ¤sst 08:00 das Schlafzimmer nach dem Aufwachen. | Abgang liegt auÃŸerhalb searchBase-Fenster (searchBase = letzte Abend). Kein fÃ¤lschliches Erkennen. | - | - |
| T-NA10 | **Debug-Badge in HealthTab**: OC-31 hat 1 Nacht-Aufstehen erkannt. | Blaues ðŸš¶-Badge erscheint unterhalb der Einschlafzeit-Kachel mit Uhrzeiten. | - | - |

## Testbereich 23: bedEntryTs CLUSTER-FIX + NOISY-SENSOR-FENSTER + bedPresenceMinutes-PROXY (v0.33.198)

### bedEntryTs â€” Cluster-basierter Bettgeh-Zeitpunkt

| ID | Testfall | Erwartetes Ergebnis | GeprÃ¼ft am | OK? |
|---|---|---|---|---|
| T-BEC1 | **FP2 KurzauslÃ¶sung**: FP2 um 19:22 (31 Sek. true), dann erneut um 22:38 (dauerhaft). Garmin: 23:34. | `bedEntryTs` = 22:38 (fp2-Quelle im Cluster). NICHT 19:22. Balken zeigt gelbes Vor-Segment ab 22:38. | - | - |
| T-BEC2 | **Keine KurzauslÃ¶sungen**: FP2 um 22:30 (dauerhaft, kein FehlauslÃ¶ser). Garmin: 23:15. | `bedEntryTs` = 22:30 (einzige fp2-Quelle im Cluster â‰¤90 Min vor Garmin). Korrekt. | - | - |
| T-BEC3 | **Kein FP2, nur vib_refined**: Vibration 21:30 (vib_refined), Garmin 22:05. | `bedEntryTs` = 21:30 (frÃ¼hstes Cluster-Event aus vib_refined, innerhalb 90 Min). | - | - |
| T-BEC4 | **Kein Cluster-Event vorhanden**: Nur haus_still + fixed im allSleepStartSources. | `bedEntryTs` = Fallback auf `_gR.bedEntryTs` (ursprÃ¼nglicher Wert). Kein Absturz. | - | - |
| T-BEC5 | **Zwei Tage hintereinander**: bedEntryTs Tag 1 war 19:22 (Bug). Tag 2 nach Fix. | Tag 2: `bedEntryTs` korrekt aus Cluster â‰  19:22. Alter Wert taucht nicht im neuen JSON auf. | - | - |

### Noisy-Sensor-Fenster â€” dynamischer Fensterbeginn

| ID | Testfall | Erwartetes Ergebnis | GeprÃ¼ft am | OK? |
|---|---|---|---|---|
| T-NSF1 | **Pre-Sleep-AktivitÃ¤t**: EG Wohnen feuert 12Ã— zwischen 22:06-22:38 (Marc vor dem Einschlafen). Garmin: 23:34. | Fensterbeginn = max(22:00, 23:34-60min) = 22:34. EG Wohnen hat â‰¤3 Events nach 22:34 â†’ NICHT als noisy eingestuft. | - | - |
| T-NSF2 | **Echter nÃ¤chtlicher Rauscher**: Sensor feuert 15Ã— zwischen 01:00-05:00 (innerhalb Schlaffenster). Garmin: 23:00. | Fensterbeginn = max(22:00, 22:00) = 22:00. 15 Events â‰¥ Threshold â†’ noisy erkannt. Korrekt. | - | - |
| T-NSF3 | **Kein Garmin, frÃ¼hes sleepWindowStart**: Einschlafzeit 21:00 (nur Vibration). | Fensterbeginn = max(22:00, 21:00-60min=20:00) = 22:00 (22:00 als Untergrenze). Korrekt. | - | - |

### bedPresenceMinutes â€” Proxy ohne FP2

| ID | Testfall | Erwartetes Ergebnis | GeprÃ¼ft am | OK? |
|---|---|---|---|---|
| T-BPM1 | **Haushalt mit FP2**: FP2-Sensor vorhanden, bedPresenceMinutes = 420 Min (7h). | `bedPresenceMinutesFinal` = 420 (unverÃ¤ndert, FP2-Berechnung). Proxy nicht aktiv. | - | - |
| T-BPM2 | **Kein FP2, nur Vibration**: bedPresenceMinutes = 0 (kein FP2). sleepWindowStart=22:30, sleepWindowEnd=06:30 (8h). | `bedPresenceMinutesFinal` = 480 Min (sleepWindow-Proxy). Bett-PrÃ¤senz-Kachel zeigt 8h. | - | - |
| T-BPM3 | **Kein FP2, kein sleepWindowEnd**: Nacht noch nicht abgeschlossen. | `bedPresenceMinutesFinal` = 0 (kein Proxy mÃ¶glich ohne End). Kein Absturz. | - | - |

---

## Testbereich 24: OC-33 â€” returnSensor-Attribution + Vibrationssensor-Hinweis (v0.33.200)

### returnSensor-Attribution (OC-33 Teil A)

| ID | Testfall | Erwartetes Ergebnis | GeprÃ¼ft am | OK? |
|---|---|---|---|---|
| T-RSA1 | **Gondelsheim-Nacht**: Person Ingrid, nachtAufstehenEvent kehrt zurÃ¼ck zu "Bewegung EG Schlafen Robert" (personTag=Robert). | Ingrids outsideBedEvent wird von `outside` auf `type: 'other_person', returnAttribution: 'Robert'` geÃ¤ndert. | 23.04.2026 | - |
| T-RSA2 | **RÃ¼ckkehr ins eigene Zimmer**: Person Robert, nachtAufstehenEvent kehrt zurÃ¼ck zu "Bewegung EG Schlafen Robert" (personTag=Robert). | Roberts outsideBedEvent bleibt `outside` (returnSensor gehÃ¶rt dieser Person). Keine Ã„nderung. | - | - |
| T-RSA3 | **Kein personTag am returnSensor**: returnSensor hat keinen personTag in allEvents. | Kein Reklassifizierung. Event bleibt unverÃ¤ndert (graceful degradation). | - | - |
| T-RSA4 | **Einpersonenhaushalt**: personTag = null (kein Multi-Person). | OC-33 Teil A wird nicht ausgefÃ¼hrt. Kein Absturz, bestehende Logik unverÃ¤ndert. | - | - |
| T-RSA5 | **Zeitmatchfehler**: nachtAufstehenEvent departureTs ist > 3 Min vom Event.start entfernt. | Kein Match â†’ keine Reklassifizierung. | - | - |
| T-RSA6 | **Bereits other_person**: Event hat schon type='other_person' (OC-21 PersonTag-Filter). | Wird nicht nochmals verÃ¤ndert (frÃ¼her Exit in .map). | - | - |

### Schwacher Vibrationssensor (OC-33 Teil B)

| ID | Testfall | Erwartetes Ergebnis | GeprÃ¼ft am | OK? |
|---|---|---|---|---|
| T-WVS1 | **Gondelsheim Ingrid**: nightVibrationCount=2, nightVibrationStrengthMax=6, outsideBedEvents=5. | `weakVibrationSensor = { detected: true, maxStrength: 6, ... }`. Log: `[OC-33] Schwacher Vibrationssensor`. HealthTab zeigt orangen Warn-Banner. | 23.04.2026 | - |
| T-WVS2 | **Normaler Sensor**: nightVibrationStrengthMax=27 (Robert). | `weakVibrationSensor = null`. Kein Banner. | - | - |
| T-WVS3 | **Kein Vibrationssensor**: nightVibrationCount=0. | `weakVibrationSensor = null` (erste Bedingung nicht erfÃ¼llt). Kein Banner. | - | - |
| T-WVS4 | **Schwacher Sensor, keine Outside-Events**: max=5, outsideBedEvents=[]. | `weakVibrationSensor = null` (kÃ¶nnte ruhige Nacht sein). Kein Banner. | - | - |
| T-WVS5 | **State registriert**: Erster Adapter-Start nach v0.33.200. | `analysis.safety.weakVibrationSensor` State existiert in ioBroker. Kein Fehler. | - | - |

### Vibrations-Timestamps (OC-33 Teil C)

| ID | Testfall | Erwartetes Ergebnis | GeprÃ¼ft am | OK? |
|---|---|---|---|---|
| T-VTS1 | **Normalnacht mit Vibrationssensor**: nightVibrationCount=15 (Robert). | `nightVibrationTimestamps` = Array mit 15 ms-Timestamps im JSON-Snapshot. | - | - |
| T-VTS2 | **Per-Person**: personData.Robert.vibrationTimestamps vorhanden. | Array mit Timestamps. personData.Ingrid.vibrationTimestamps = [ts1, ts2] (count=2). | 23.04.2026 | - |
| T-VTS3 | **Kein Vibrationssensor**: nightVibrationCount=0. | `nightVibrationTimestamps = []`. personData[person].vibrationTimestamps = null. Kein Absturz. | - | - |
