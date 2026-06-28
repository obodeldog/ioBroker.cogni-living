# BRAINSTORMING — ioBroker Cogni-Living (AURA)
**Zweck:** Architektur-Entscheidungen, offene Konzepte, Diskussionen, Marktanalyse.
**Nicht hier:** konkrete Deploy-Schritte, Bugfixes → dafuer PROJEKT_STATUS.md

**Regel:** Implementierte Punkte wandern aus dieser Datei in PROJEKT_STATUS.md.
Neue offene Konzepte immer OBEN in den Abschnitt "🚧 OFFENE KONZEPTE" einfügen.

---


## 🚧 OC-PSA-CLAMP: preSleepAbsence.start darf nie vor bedEntryTs liegen (28.06.2026)

**Problem (Code-Analyse):**
OC-48c berechnet `preSleepAbsenceEvents` innerhalb von `computePersonSleep()`
mit einem initialen `bedEntryTs`-Schaetzwert. Danach korrigiert OC-BED-SYNC (v0.33.319)
den `bedEntryTs` auf den Gewinner-Timestamp. Das Array `preSleepAbsenceEvents`
wird dabei NICHT nachkorrigiert.

**Effekt:** `preSleepAbsenceEvents[0].start` kann vor dem finalen `bedEntryTs` liegen.
Beispiel 27./28.06.: preSleepAbsence.start = 22:12, bedEntryTs = 22:15.
Im Rendering beginnt der graue Balken sofort am Balkenstart (22:15),
obwohl korrekt 3 min Einschlafphase (gelb) davor kommen muesste.

**Loesung (Clamp):** Nach Finalisierung von `bedEntryTs` alle
`preSleepAbsenceEvents` auf `start >= bedEntryTs` begrenzen:
`event.start = Math.max(event.start, bedEntryTs)`
Betroffene Stelle: nach OC-BED-SYNC Block, vor personData-Speicherung.

---

## 🚧 OC-GARMIN-NO-TS: Garmin liefert keine Timestamps fuer Sleep-Segmente (28.06.2026)

**Befund:** Garmin-Daten enthalten ausschliesslich Summen pro Nacht:
`garminDeepMin`, `garminLightMin`, `garminRemMin`, `garminWakeMin`.
Keine zeitlichen Informationen (Start/Ende einzelner Phasen).

**Konsequenz:** Garmin-Schlafphasen koennen NICHT in den Timeline-Balken eingezeichnet
werden. Garmin bleibt ausschliesslich als Referenz-Zeile (Summen) und fuer
Score-Kalibrierung nutzbar. Kein Mischen von AURA-Balken mit Garmin-Daten.

---


## 🚧 OC-VIB-CAL-PREWAKE: Kalibrierung nur aus echten Schlaf-Events (nicht Aufsteh-Bewegungen) (28.06.2026)

**Hintergrund / Was bisher passiert:**
Die Vibrations-Kalibrierung berechnet pro Nacht die Stärke-Metriken (`vibStrMax`, `vibStrP90`)
aus ALLEN Events im Schlaffenster (stagesWinStart bis stagesWinEnd).
Das Schlaffenster endet jedoch erst WENN die Person aufsteht (= bedExitTs / sleepWindowEnd).
Aufsteh-Bewegungen (z.B. 06:43 Uhr, Stärke 71, 70, 69 drei Events hintereinander) liegen
damit noch IM Schlaffenster und werden in die Kalibrierung einbezogen.

**Warum das ein Problem ist:**
Aufsteh-Bewegungen sind physikalisch viel stärker als Wach-im-Bett-liegen.
Ergebnis: Die kalibrierten Schwellen ("Wake-Schwelle > X") orientieren sich an der Aufsteh-Intensität,
nicht an der Wachliege-Intensität. Wake-Erkennung während des Schlafs wird damit praktisch unmöglich.

**Konkretes Beispiel (Marc, 25./26.06.2026):**
- Aufsteh-Events um 06:43: Stärke 71, 70, 69
- Übriger Schlaf: max. 47
- Ergebnis: vibStrMax dieser Nacht = 71 (wegen Aufstehen)
- Kalibrierung (P90 über 14 Nächte) = ~63 → Wake-Schwelle = 72
- Realistische Wake-Schwelle ohne Aufstehen wäre ~47 → Wake-Schwelle = ~54

**Was v0.33.326 macht (Zwischenlösung):**
`vibStrP90` (90. Perzentil statt Max) reduziert den Einfluss von Ausreißern statistisch.
Bei wenigen Events (Marc: 23/Nacht) reicht das oft, da die 3 Aufsteh-Events im Top-10% landen
und durch P90 herausfallen. Bei Kunden mit 100+ Events/Nacht ist der Effekt schwächer.

**Echte Lösung (OC-VIB-CAL-PREWAKE):**
`nightVibrationStrengthP90` und `nightVibrationStrengthMax` nur aus Events berechnen,
deren Timestamp VOR dem erkannten `wakeTs` (Aufwachzeit) liegt.

Implementierung:
1. Im Berechnungsblock für per-Person VibStr (L4372ff in src/main.js):
   Zusätzlichen Pre-Wake-Filter einführen:
   ```javascript
   var _preWakeCap = _pResult.sleepWindowEnd || null; // wakeTs ~ sleepWindowEnd
   // In der personEvents.forEach Schleife:
   if (_preWakeCap && ts > _preWakeCap - (30 * 60000)) return; // letzte 30 min = Aufsteh-Phase
   ```
2. Gesonderte Metriken `_pVibStrMaxPreWake` und `_pVibStrP90PreWake` speichern.
3. In Kalibrierungsbuffer `vibStrP90PreWake` statt `vibStrP90` für Schwellen-Berechnung verwenden.

**Achtung (Sequenz-Problem):**
`wakeTs` muss bekannt sein bevor die VibStr-Berechnung läuft.
In der aktuellen Architektur: wakeTs = `pd.sleepWindowEnd` ist nach Abschluss von
`computePersonSleep()` verfügbar. Der VibStr-Per-Person-Block (L4372ff) läuft im
globalen Per-Person-Loop NACH `computePersonSleep()`, hat also Zugriff auf `pd.sleepWindowEnd`.
Das Sequenz-Problem ist damit LOESBAR ohne grosse Umstrukturierung.

**Erwarteter Effekt nach Fix:**
Marc: Wake-Schwelle sinkt von ~72 auf ~54 → Events mit Stärke >54 würden als Wake klassifiziert.
Da Marcs Max im reinen Schlaf ~47 beträgt, könnten dann noch keine Wake-Events detektiert werden.
Fazit: Der Sensor ist NICHT falsch kalibriert — er ist physikalisch zu leise für Wake-Erkennung.
Der Sensor-Hinweis (OC-VIB-CAL-P90, v0.33.326) würde dann korrekt ausgelöst.

---

## 🚧 OC-BED-FINAL: Letzter finaler Betteintritt als bedEntryTs (27.06.2026)

> **Status:** Offen — Konzept diskutiert. Kein Code geändert.

### Problem (real beobachtet, Nacht 26./27.06.2026)

- **22:31**: Erstes Ins-Bett mit Partner (Quelle: `vib_refined`)
- **23:12–00:44**: 91 Minuten Abwesenheit im Wohnzimmer (korrekt als `preSleepAbsenceEvent` erfasst)
- **00:47**: Zurück ins Bett (FP2-Bestätigung vorhanden in `allBedEntrySources`)
- **01:03**: Eingeschlafen (Garmin)

`bedEntryTs` war 22:31 — also 2,5 Stunden vor Einschlafen. In der UI sah das gut aus nur weil das Overlay (jetzt gefixt in v0.33.323) nie sichtbar war.

### Zwei Philosophien

**Philosophie A (aktuell):** `bedEntryTs` = erster Bettkontakt (22:31)
- Vorteil: Zeigt wann man sich *wirklich* erstmals ins Bett gelegt hat
- Nachteil: Das Intervall bis `sleepWindowStart` sieht nach 2,5h Wachliegen aus, obwohl man 91 Min. draußen war

**Philosophie B (bevorzugt vom Nutzer):** `bedEntryTs` = letzter finaler Betteintritt nach langer Abwesenheit
- `bedEntryTs` → 00:47 (letztes Bett-Entry vor dem Einschlafen)
- Der frühere Aufenthalt (22:31–23:12) wird als grau-schraffiertes Pre-Segment im Balken sichtbar, das über `preSleepAbsenceEvents` gerendert wird
- `sleepLatency` (Einschlafverzögerung) bezieht sich dann auf 00:47–01:03 = 16 Min. (korrekt)
- Vorteil: Zahlen wirken korrekt, Visualisierung zeigt vollständiges Bild

### Technisches Konzept für Philosophie B

Wenn `preSleepAbsenceEvents` existieren UND das letzte Entry in `allBedEntrySources` nach der letzten Abwesenheit liegt:
1. Filtere `allBedEntrySources` nach Einträgen **nach** dem Ende des letzten `preSleepAbsenceEvent`
2. Wenn solche Einträge vorhanden → benutze den Besten davon als neues `bedEntryTs`
3. Original-`bedEntryTs` bleibt als `firstBedEntryTs` erhalten (für das Pre-Segment)
4. Im Build: Pre-Segment von `firstBedEntryTs` bis `preSleepAbsenceEvent.start` als helles Gelb rendern, Absenz als grau, dann normaler Balken ab finalem `bedEntryTs`

### Wichtig
- Das Dreieck-Symbol wird NICHT mehr benötigt (laut Nutzer 27.06.)
- Der Schwellenwert für "signifikante Abwesenheit" könnte 45–60 Min. sein (aktuell sind keine kürzeren Abwesenheiten problematisch)
- Aufwand: mittel — Änderungen in `computePersonSleep()` (Quellen-Filterung nach PSA) + `buildSleepTilePayload()` (Pre-Segment)

---

## 🚧 OC-WAKE-SM: Personenbezogene Aufwach-State-Machine (24.06.2026)

> **Status:** Offen — Konzept dokumentiert. Kurzfristiger Guard (P2 = OC-WAKE-GUARD) ist in v0.33.322 implementiert; die vollständige State Machine ist die langfristige Lösung.

### Problem (real beobachtet, Nacht 22./23.06.2026)

Jana und Julia (beide nur Matratzen-Vibrationssensor, Bett im OG) bekamen **exakt dieselbe Aufwachzeit 05:14** mit Quelle „Radar". Beide haben gar keinen Radar. Ursache: Der einzige Radar (`Radar EG Schlafzimmer`, Marcs Zimmer) trägt **keinen personTag** → `isMine()` liefert für ALLE Personen `true` → die globale `firstEmpty` (Marc verlässt um 05:14 kurz das Bett für einen Toilettengang) wurde allen als Aufwachzeit zugeschrieben.

### Kurzfristiger Fix (umgesetzt, P2 / OC-WAKE-GUARD)

Beim per-Person-Aufruf von `computePersonSleep` wird `fp2WakeTs` nur noch übergeben, wenn:
- die Person **keinen** eigenen Bett-Sensor hat (Fallback wie bisher), ODER
- im **eigenen Schlafzimmer** der Person tatsächlich ein FP2/Radar steht.

Hat die Person einen eigenen Sensor in einem anderen Raum (Jana/Julia im OG), wird die fremde Radar-Aufwachzeit nicht mehr geerbt → sie fällt auf eigene Signale (`vibration_alone` etc.) zurück. Mitbewohner im selben Radar-Zimmer (z.B. Anni in EG Schlafen) behalten den Radar korrekt.

### Langfristige Lösung: echte State Machine pro Person

Für Marc existiert bereits OC-45a/b/c (POST_WAKE / SLEEPING / PRE_SLEEP), die aber mit Marcs Zimmer-Sensoren gefüttert und global gespeichert wird. Es fehlt eine **äquivalente, personenbezogene** Aufwach-SM für VIB-only-Personen:

```
Zustände:  SCHLÄFT → UNRUHIG → WACH → AUF
Übergänge: NUR mit eigenen Sensoren (VIB der Person, ggf. Hop-1 Flur/Bad)
Fallback:  globaler FP2/Radar nur wenn Person keinerlei eigene Sensoren hat
```

- `SCHLÄFT → UNRUHIG`: dichte eigene Vib-Cluster gegen Morgen (Pendant zu `vib_wake_cluster`)
- `UNRUHIG → WACH`: letzter Vib mit ≥45 Min Stille danach (Pendant zu `vibration_alone`, aber mit Artefakt-Guard P3)
- `WACH → AUF`: Hop-1-Bewegung (Flur/Bad der Person) nach dem WACH-Zeitpunkt → liefert `bedExitTs` (heute fehlt dieser für VIB-only-Personen, siehe P3-Diskussion)

### Nutzen
- Korrekte, voneinander unabhängige Aufwachzeiten pro Person ohne fremde Radar-Kontamination
- Liefert zusätzlich `bedExitTs` (Aufstehen) für VIB-only-Personen
- Quellenneutral: funktioniert mit jeder Sensorkombination, Konfidenz-basiert

---

## 🚧 OC-BAD-ARBITER: Cross-Person-Schiedsrichter für gemeinsame Bäder (24.06.2026)

> **Status:** Offen. Per-Person-Variante (P4 / OC-BAD-SM) ist in v0.33.322 implementiert; der zentrale Arbiter ist die robustere Erweiterung.

### Problem
Ein gemeinsam genutztes Bad ohne personTag (OG Bad für Jana+Julia) wurde **allen** Personen im Hop-Bereich zugeschrieben — beide sahen „Bad 04:42". Physikalisch kann nur eine Person gleichzeitig dort sein.

### Umgesetzt (P4 / OC-BAD-SM, per Person)
Jede Person prüft ihre **eigene Aufsteh-Signatur**: Gab es rund um das Bad-Event (±6 Min) einen eigenen Matratzen-Vib-Trigger (Gewichtsverlagerung beim Aufstehen)? Falls nicht → Person lag im Tiefschlaf → Bad-Event entfernen. Funktioniert für die Nacht 23.06.: Jana hat Trigger 04:40/04:44 → behält; Julia letzter Trigger 04:20 → Bad entfernt.

### Erweiterung (offen): zentraler Arbiter
Statt jede Person isoliert entscheiden zu lassen, ein **Scoring über alle Kandidaten** pro physischem Bad-Event:
- `preActivity` (eigene Vib in [start-5min, start]) + `postActivity` (eigene Vib in [end, end+5min])
- Person mit höchstem Score „gewinnt" das Bad-Event, alle anderen verlieren es.
- Vorteil: auch wenn mehrere Personen eine schwache Signatur haben, wird eindeutig EINE zugeordnet.

---

## 🚧 OC-PIR-STUCK-NOCTURIA: PIR-Stuck-Erkennung für Nacht-Badbesuche (19.06.2026)

> **Status:** Offen — Konzept dokumentiert, noch nicht implementiert.

### Problem (real beobachtet, Nacht 18./19.06.2026)

Der Bad-PIR (Zigbee EG Bad Bewegung) blieb nach dem Abend-Badezimmerbesuch um **22:46 Uhr** durchgehend auf `true` — ohne automatischen Reset. Erst um **03:02:49 Uhr** kam das erste `false`-Signal. Der eigentliche Nacht-Badezimmerbesuch um ~03:00 Uhr feuerte zwar nochmal `true` (03:00:31), aber:

- ioBroker loggt nur **Zustandsänderungen** (Flanken)
- `true → true` = keine Änderung = **kein Event** → AURA hat den 03:00-Besuch nie gesehen
- Einziger sichtbarer Event war das `false` um 03:02:49 (Verlassen des Bad)

Resultat: `nocturiaCount=1` wurde korrekt gezählt (via `false`-Flanke), aber kein Timestamp und kein visueller Marker in der Schlafkachel.

### Ursache

PIR-Sensoren sollten nach ~30–60 Sek Inaktivität automatisch auf `false` gehen (Occupancy-Timeout). Dieser Sensor hat das nicht getan — **PIR-Stuck-Bug** über 4h 16min.

Normales PIR-Verhalten (korrekt):
```
22:46 → true (Betreten)
22:47 → false (Timeout, kein Mensch mehr erkannt)
03:00 → true (neue Flanke! Betreten erkannt)
03:02 → false (Verlassen)
```

Tatsächliches Verhalten (defekt):
```
22:46 → true (Betreten)
--- 4h 16min kein false! ---
03:00 → true (kein neues Event in ioBroker, weil true=true)
03:02 → false (Verlassen — einziger Event der ankommt)
```

### Lösungskonzept: OC-PIR-STUCK-GUARD für Non-Bedroom PIRs

**Idee:** Für PIR-Sensoren die NICHT im Schlafzimmer/Bett-Bereich liegen (Bad, Diele, Flur, Wohnzimmer), gilt:
- Haltezeit ≥ 30 Min auf `true` ohne neue Aktivität → **Soft-Reset**: intern als `false` behandeln
- Bei nächstem echten `true`-Event: wieder gültige Flanke → wird korrekt als Betreten registriert

**Vorteil gegenüber OC-STUCK (bestehend):**
- OC-STUCK kümmert sich primär um Bedroom-PIRs die fälschlicherweise Aktivitätszeit aufblähen
- OC-PIR-STUCK-GUARD kümmert sich um Non-Bedroom PIRs deren Stuck-Zustand die **Flanken-Erkennung für Nacht-Events kaputt macht**

**Umsetzungsvorschlag:**
```javascript
// In scanner.js oder recorder.js:
// Für jeden Non-Bedroom PIR (isBathroomSensor, isHallSensor etc.):
// Wenn seit letztem true > 30 Min vergangen → virtuell als false markieren (lastKnownState reset)
// Dann: nächstes true = echte Flanke = nachtAufstehenEvent kann korrekt feuern
```

### Downstream-Effekt: nocturia mit Zeitstempel

Wenn die Flanken korrekt kommen (`true` beim Betreten, `false` beim Verlassen), kann `nachtAufstehenEvents` auch Nacht-Badbesuche INNERHALB der Schlafphase (nicht nur post-wake) als Einträge mit Start/Ende und Sensor-Namen speichern — was dann im Schlafbalken als Marker visualisierbar wäre.

### Priorität: MITTEL
- `nocturiaCount` funktioniert (über `false`-Flanke) — Zählung ist korrekt
- Was fehlt: Zeitstempel + Visualisierung des Nacht-Badbesuchs im Schlafbalken
- Vollständige Lösung = OC-PIR-STUCK-GUARD + nachtAufstehenEvents auf Schlafphase erweitern

---

## 🚧 OC-DAY-BED: Tageszeitliches Bett-Liegen vs. Nachtschlaf unterscheiden (17.06.2026)

> **Status:** Offen — noch kein Lösungskonzept implementiert.
> **Auslöser:** Diskussion 17.06.2026 — Jugendliche (Julia, Jana, Anni) nutzen ihr Bett tagsüber zum Herumliegen/Handy-Spielen, was die Sensordaten verfälscht.

### Problem

Vibrationssensoren und FP2-Radarsensoren in Kinderzimmern registrieren regelmäßige Bett-Aktivität auch **außerhalb typischer Schlafzeiten** (z.B. 15–19 Uhr). Das führt zu:
- Falsche `bedEntryTs` (IIFE wählt frühesten stabilen VIB-Moment → 17:xx oder 18:xx statt echtem Schlafgehen)
- Verfälschte Schlafdauern (Balken startet viel zu früh)
- Rote „Außerhalb"-Segmente weil Abend-Familienleben zwischen frühem bedEntryTs und Einschlafen liegt
- Potentiell falscher AURA-Score wenn Stages-Berechnung mit tagsüber-Daten kontaminiert wird

### Lösungsrichtungen

**A) Zeitfenster-Heuristik:** Für Jugendliche (nicht Marc/Julia-Erwachsene) bedEntryTs nur ab 21:00 Uhr erlauben — basierend auf personTag + Altersgruppe (Config).

**B) Bewegungs-Korrelation:** Echtes Schlaf-Hinlegen hat typischerweise:
- Lange Phase ohne Außerhalb-PIR-Events davor UND danach (Haus wird „still")
- Gleichmäßige, niedrige VIB-Stärke (nicht gelegentliche Bewegungen beim Herumwälzen)
- Zeitlich nach `haus_still`-Zeitpunkt

Tagsüber-Liegen dagegen: Außerhalb-PIR-Events laufen weiter (Familienmitglieder bewegen sich), VIB-Muster unregelmäßig.

**C) Zweistufige bedEntryTs-Erkennung:**
- Stufe 1: Frühes `bedEntryTs` (erste Anwesenheit, wie jetzt)
- Stufe 2: `bedEntryTs_sleep` = letzter Eintritt kurz vor echtem Einschlafen (aus Cluster mit sleepWindowStart)
- Anzeige: nur Stufe 2 (`bedEntryTs_sleep`) — Stufe 1 intern für Wachliegen-Berechnung

**D) Erwachsene (Marc, Julia):** Problem betrifft diese weniger, da Erwachsene seltener tagsüber schlafen. Für sie reicht die bestehende Logik mit verbessertem candFp2Anchor.

### Betroffene Personen im Haushalt
- Julia (Jugendliche, Vibrationssensor, kein Radar): direkt betroffen
- Jana, Anni (Kinder/Jugendliche, OG): ebenfalls betroffen wenn VIB-Sensor aktiv
- Marc: weniger betroffen (FP2 + klarere Schlafzeiten)

### Nächster Schritt
Lösungsrichtung C (Zweistufig) und B (Bewegungs-Korrelation) kombinieren. Erst wenn OC-BED-SOURCES-Sync (v0.33.318+) stabil ist.

---

## 🚧 OC-VIB-EXIT: Aufstehen für VIB-only Personen (17.06.2026)

> **Status:** Offen — noch kein Code implementiert.
> **Auslöser:** Julia hat keinen FP2/Radar → `bedExitTs` = null, keine Aufsteh-Zeit in der Analyse.

### Problem

`bedExitTs` (Aufgestanden) wird aktuell primär über FP2=0 erkannt (Bett leer). Für Personen **ohne Radar** (reine VIB-Sensor-Konfiguration) fehlt ein verlässlicher Exit-Detektor.

VIB allein ist nicht eindeutig: kein Signal = schläft tief ODER liegt wach still ODER ist aufgestanden.

### Lösungskonzept (PIR-Korrelation)

```
VIB geht still (letzte VIB-Aktivität + X Min Pause)
+
PIR Hop≤2 (Flur, Bad) feuert innerhalb ~15 Min
→ bedExitTs = VIB-quiet-Zeitpunkt (hohe Konfidenz)
```

Wichtig: im Mehrpersonen-Haushalt muss der PIR-Trigger **zeitlich korreliert** sein, nicht nur irgendwann. Wenn VIB still und PIR ≤15 Min danach → wahrscheinlich die gleiche Person.

Konfidenz-Stufen:
- VIB quiet ≥20 Min + PIR ≤15 Min danach: `high`
- VIB quiet ≥10 Min + PIR ≤10 Min danach: `medium`
- Nur VIB quiet (kein PIR): `low` (kein bedExitTs setzen)

---

## ✅ OC-VIB-CAL: Per-Person Vibrationsintensitäts-Kalibrierung (09.06.2026) — implementiert in v0.33.287

> **Status:** Stufe 1 (single-night p90) IMPLEMENTIERT in v0.33.287.
> Stufe 2 (Rolling-Baseline 14 Nächte) und Stufe 3 (Garmin-Feedback) bleiben für spätere Session.
> Priorität: mittel-hoch (direkte Auswirkung auf Schlafphasen-Qualität).
> **Auslöser:** Diskussion 09.06.2026 — Schlafphasen-Schwellwerte sind hardcodiert, passen sich nicht an Sensormontage/Matratze an.

### Problem

Die Schlafphasen-Erkennung (global und per-Person identisch, `computePersonSleep` + `saveDailyHistory`) nutzt **feste Schwellwerte**:

```
slotStrMax > 28         → Wake
slotStrMax 12–28 + 2.5h+ → REM
slotDet === 0 × 5 Slots  → Deep (25 min still = Tiefschlaf)
Rest                    → Light
```

Das Problem in der Praxis:
- **Sensor locker / weiche Matratze**: Werte 3–15 → `> 28` wird **nie** erreicht → Wake-Phasen niemals erkannt
- **Sensor fest / harte Matratze**: Werte 20–60 → normales Umdrehen als Wake fehlklassifiziert
- **Verschiedene Personen, gleicher Schwellwert**: Anni (leichteres Gewicht) vs. Marc → gleiche Schwelle ist falsch

### Was bereits existiert (ungenutzte Daten!)

`nightVibrationStrengthAvg` und `nightVibrationStrengthMax` werden **jede Nacht** pro Person gespeichert (in `personData[].nightVibrationStrengthAvg/Max` und global). Diese Daten werden aber NICHT zur Threshold-Adaption verwendet — sie schlummern ungenutzt.

Es gibt bereits einen Score-Kalibrier-Mechanismus (`sleepScoreCalStatus`: `uncalibrated` → `calibrating` → `calibrated` nach 14 Nächten), der Score vs. Garmin vergleicht. Diesen Mechanismus könnte man analog für Vibrations-Thresholds erweitern.

### Lösungskonzept

**Stufe 1 — Minimal-Fix (niedrig riskant):**
Nach N≥7 Nächten: gleitenden **p75-Wert** von `nightVibrationStrengthMax` pro Person berechnen.
Wenn der p75-Wert deutlich < 20 (vermutlich schwacher Sensor), Thresholds skalieren:
```
wakeThreshold     = max(8,  p75Max × 0.85)    // statt fest 28
remUpperBound     = max(6,  p75Max × 0.80)    // statt fest 28
remLowerBound     = max(3,  p75Max × 0.35)    // statt fest 12
```
Neue Felder in History-JSON: `vibCalibStatus: 'uncalibrated'|'calibrating'|'calibrated'`, `vibCalibThresholds: { wake, remUpper, remLower }`.

**Stufe 2 — Rolling-Baseline:**
Pro Person und Schlafnacht: `vibStrengthHistory[]` (max. 14 Einträge, rolling). Wenn >= 7 Einträge: `vibCalibStatus = 'calibrating'`. Ab 14: `calibrated`.
Beim Stage-Berechnen: falls `calibrated`, eigene Thresholds nutzen; sonst globale Defaults.

**Stufe 3 — Feedback-Loop (Garmin-Assisted):**
Wenn Garmin-Daten vorliegen: Garmin-Stage vs. Vib-Stage pro Nacht vergleichen.
Wenn dauerhaft Abweichung: Thresholds anpassen (analog zu Score-Kalibrierung).
Datenpunkt: `sleepCalibrationLog` enthält `deepPct`, `remPct` → kann mit Garmin `deepMin`, `remMin` verglichen werden.

### Betroffene Code-Stellen

| Datei | Zeile(n) | Was |
|---|---|---|
| `src/main.js` | ~688–691 | Stage-Klassifizierung in `computePersonSleep` → Thresholds variabel machen |
| `src/main.js` | ~3258–3270 | Stage-Klassifizierung global → gleiche Variabilisierung |
| `src/main.js` | ~3835–3843 | `personData[]` Ausgabe → `vibCalibStatus`, `vibCalibThresholds` hinzufügen |
| `src/main.js` | ~4466–4510 | `calibrationLog` Befüllung → Vib-Thresholds mitloggen |

### Risiken / Nebenwirkungen

- **Positiv**: Kein Breaking Change für Kunden ohne Vibrationssensor (`vibCalibStatus='uncalibrated'` → Defaults bleiben)
- **Risiko**: Falsch-Kalibrierung in ersten 7 Nächten (Sensor-Ausreißer → schlechter p75). Fix: Ausreißer-Filter (Nächte mit `nightVibrationCount < 10` ignorieren)
- **Risiko**: Zwei Personen in einem Bett (Szenario 3) → gegenseitige Vibrationen verfälschen Baseline. Fix: Kalibrierung nur für personTagged Nächte (personTag-spezifisch)
- **Garmin-Feedback**: Optional, nicht verpflichtend. Kunden ohne Garmin profitieren trotzdem von Stufe 1+2.

### Priorisierung

Zusammen mit OC-56 (bedEntryTs-Erkennung) als "Schlafanalyse-Qualitäts-Sprint" bündeln.
Empfehlung: Stufe 1 nach ~14 Nächten Datensammlung (ab sofort läuft die Datenerhebung schon).

---

## 🚧 OC-56: "Ins Bett gegangen" (erster Bettkontakt) + Vor-Schlaf-Abwesenheit im Balken (08.06.2026)

> **Status:** Stufe 2 IMPLEMENTIERT in v0.33.317 (16.06.2026) — siehe PROJEKT_STATUS.md.
> OC-48c verwirft `bedEntryTs` nicht mehr (never-null), FP2-bewusster Cross-Check (Fremd-Aktivität
> bei belegtem Bett wird ignoriert) und `preSleepAbsenceEvents` werden als schraffiertes Overlay
> gerendert (PWA + Admin). Stufe 1 (separater `bed_first_contact`-Kandidat) wurde NICHT separat
> gebaut — die bestehende `bedEntryTs`-Kandidatenlogik liefert den Erstkontakt bereits.
> **Offen bleibt:** feineres Stufe-3-Rendering (Tooltip-Texte/Legende), Mehrfach-Ausflüge pro Nacht.
> **Auslöser:** Nacht 08.06.2026 / 15.06.2026 — `bedEntryTs=null`, Nutzer wollte "Ins Bett gegangen" sehen.

### 0. Worum geht es (in einem Satz)
Heute erkennt das System nur Varianten von "**ging still / eingeschlafen**". Es gibt KEINEN Kandidaten
für "**erster Bettkontakt des Abends**" (= die Zeit, die der Nutzer als "Ins Bett gegangen" versteht).
Dieses Konzept fügt diesen Kandidaten hinzu UND macht den nächtlichen Wohnzimmer-Ausflug im Balken
als Abwesenheit sichtbar — statt einen falschen langen "Wachliegen"-Balken zu zeichnen oder `null` zu liefern.

### 1. Forensische Faktenlage Nacht 08.06.2026 (aus Rohdaten verifiziert — NICHT raten)

**Quelle:** `2026-06-07_1.json` (Abend, eventHistory 2473 Events, endet 23:59:09) + `2026-06-08.json`
(eventHistory 996 Events ab 00:00:09, Snapshot auf "heute" gefiltert).

Bett-Vibrationen am Abend (alle Zeiten Europe/Berlin):
```
22:47:47  erste Vibration (Nutzer legt sich hin)  ← DAS ist "Ins Bett gegangen"
22:47–00:19  durchgehend unruhig, größte Lücke nur ~15 min (23:08→23:24)
             → KEINE 20-min-Stille in diesem Fenster (Nutzer war wach, konnte nicht schlafen)
00:19:16  letzte Vibration (str 49) ... danach 44 min Stille
00:23–01:02  Wohnzimmer-PIR (13+ Events) = ECHTER Aufenthalt (vom Nutzer bestätigt)
01:03:35  Vibration Schlafzimmer (Rückkehr ins Bett)
01:20–01:29  weitere Vibrationen (Einrichten)
01:30     Garmin: eingeschlafen
```

`allSleepStartSources` dieser Nacht: `vib_refined=00:19`, `motion(_vib)=02:25`, `haus_still=22:48`,
`garmin=01:30`, `fixed=20:00`. **Kein** 22:47/23:00-Kandidat vorhanden.

**Warum `vib_refined=00:19`:** Definition = "erste Bett-Vibration, auf die ≥20 min Stille folgt".
Die erste 20-min-Stille trat erst nach 00:19 auf — weil der Nutzer da AUFSTAND (Wohnzimmer), NICHT
weil er einschlief. Der Algorithmus kann "still = eingeschlafen" vs. "still = Bett verlassen" aus
Vibration allein nicht unterscheiden. → **Der Algorithmus arbeitet korrekt nach seiner Definition.**

### 2. Historischer Kontext (NICHT erneut umdrehen!)
- **v0.33.150 (16.04.2026):** Alle 4 Vib-Verfeinerungs-Algorithmen (`fp2_vib`, `motion_vib`,
  `vib_refined`, `_pVibRefine`) wurden von **rückwärts → vorwärts** umgestellt. Grund: Rückwärts +
  `Date.now()`-Fallback gab falsche **späte** Zeiten (01:11 statt 22:39).
  ⚠️ **NICHT wieder auf rückwärts stellen** — das öffnet exakt diesen Bug wieder.
- Die **Aufwach**-Erkennung (`motion_vib` als Wake-Quelle) nutzt bewusst **rückwärts (letztes Event)**
  (verhindert dass 04:11-Toilettengang als Aufwachzeit gilt). Andere Stelle, nicht verwechseln.

### 3. Begriffsklärung (im Code + UI konsequent trennen!)
| Begriff | Bedeutung | Beispielnacht | aktueller Code |
|---|---|---|---|
| **Ins Bett gegangen** (`bedEntryTs`) | erster Bettkontakt des Abends | 22:47 | wird NICHT sauber erkannt |
| **Eingeschlafen** (`sleepWindowStart`) | erste echte Schlafphase | 01:30 | `vib_refined`/garmin etc. |
| **Aufgewacht** (`sleepWindowEnd`) | Ende Schlaf | 06:30 | garmin/vib/motion |
| **Aufstehen** (`bedExitTs`) | endgültiges Bett-Verlassen | ~06:39 | OC-45a State-Machine |

### 4. Das Kern-Hindernis: die OC-48c-Wand
Selbst MIT einem 22:47-Kandidaten würde er für diese Nacht **verworfen**, weil OC-48c einen frühen
`bedEntryTs` ablehnt, wenn dazwischen ein ≥30-min-Block außerhalb des Schlafzimmers liegt
(hier: Wohnzimmer 00:23–01:02 = 39 min). OC-48c existiert genau, um einen **falschen langen
Wachliegen-Balken** zu verhindern (Phantom-Wachliegen, dokumentiert OC-48c, v0.33.267).

→ "Ins Bett 22:47 anzeigen" UND "keinen falschen 2,5h-Wachliegen-Balken zeichnen" sind im
aktuellen Balkenmodell ein **Widerspruch**. Auflösung nur durch: früher Bettkontakt erlaubt,
ABER der Ausflug wird als **Abwesenheit** im Balken gerendert (nicht als Wachliegen).

### 5. Schrittweises Umsetzungskonzept (3 Stufen — EINZELN bauen + testen)

#### STUFE 1 — Neuer Kandidat `bed_first_contact` (nur Datenfeld, noch KEINE Anzeige-Änderung)
**Ziel:** Erstkontakt erkennen, ohne irgendetwas Sichtbares zu ändern (reines Logging/Feld).

- **Ort:** `computePersonSleep` in `src/main.js`, im Block wo `candVibRefined` etc. berechnet werden
  (aktuell ~Z188–239). Neuen IIFE `candBedFirstContact` ergänzen.
- **Definition:**
  - Filter: `isMine(e) && e.isVibrationBed && (isActiveValue(e.value) || toPersonCount(e.value)>0)`,
    Stunden `hr >= 21 || hr < 4` (identisch zu `vib_refined`-Fenster).
  - Sortierung aufsteigend.
  - **Cluster-Schutz (PFLICHT gegen Streuvibration):** Erstes Event nur akzeptieren, wenn innerhalb
    der nächsten **10 min mindestens 1 weiteres** Bett-Vib-Event folgt (= echtes Hinlegen, nicht
    "kurz auf Bettkante gesessen" / "Bett gemacht 20:00"). Ideal sogar ≥2 weitere in 15 min.
  - Rückgabe: Timestamp des ersten Events des ersten gültigen Clusters (hier: 22:47).
- **Nebenwirkungs-Schutz:**
  - FP2/Radar-Haushalt: FP2-Bettkontakt bleibt Vorrang (neuer Kandidat NUR genutzt wenn kein
    fp2/fp2_vib-Bettkontakt vorliegt). 
  - PIR-only: keine Bett-Vib → Kandidat = null → kein Effekt (graceful).
  - Mehrpersonen: `isMine`/`personTag`-Filter MUSS aktiv sein (Partner-Vibration nicht zuordnen).
- **NICHT in `allSleepStartSources` als Einschlaf-Quelle aufnehmen** — das ist eine BETT-Zeit, keine
  Schlafzeit. Separat führen (z.B. `_bedFirstContactTs`), damit Einschlaf-Logik unberührt bleibt.
- **Test Stufe 1:** Log-Ausgabe prüfen über mehrere Nächte (auch FP2-, PIR-only-, Mehrpersonen-
  Nächte): liefert der Kandidat plausible Erstkontakt-Zeiten? Noch KEINE UI-Änderung deployen.

#### STUFE 2 — `bedEntryTs`-Ableitung + OC-48c-Lockerung (kontrolliert)
**Ziel:** `bedEntryTs` darf der frühe Erstkontakt sein, OHNE Phantom-Wachliegen zu erzeugen.

- **Neue `bedEntryTs`-Quelle:** Wenn `_bedFirstContactTs` existiert und früher als der bisherige
  `bedEntryTs`-Kandidat ist → als `bedEntryTs` verwenden, Quelle z.B. `bed_first_contact`.
- **OC-48c-Anpassung (heikelster Teil):** OC-48c soll einen frühen `bedEntryTs` NICHT mehr komplett
  verwerfen (→ null), sondern:
  - **wenn** zwischen `bedEntryTs` und `sleepWindowStart` ein ≥30-min-Außerhalb-Block existiert,
  - **dann** `bedEntryTs` BEHALTEN, aber den Block als **Vor-Schlaf-Abwesenheit** markieren
    (neues Feld, z.B. `preSleepAbsenceEvents[]`), damit Stufe 3 ihn im Balken zeichnen kann.
  - **Voraussetzung:** Der Block muss als echte Abwesenheit belegt sein (Far-Room/Bad-PIR, Hop≥2),
    nicht durch Noisy-Sensoren (OC-24 berücksichtigen — aber NICHT pauschal ausschließen, siehe
    Lehre aus v0.33.274-Revert: echte Präsenz darf nicht ausgeblendet werden).
- **Fallback-Garantie:** Wenn KEIN Far-Block dazwischen liegt (Normalnacht: hinlegen → einschlafen),
  bleibt das Verhalten 1:1 wie heute. OC-46 (ruhiges Wachliegen) unverändert.
- **Risiko-Register-Pflicht:** OC-48c ist Hochrisiko-Shared-Variable (`bedEntryTs`). Vor Umsetzung
  OC_REGISTER prüfen: OC-46, OC-48, OC-48c, Frontend-Balken, computePersonSleep.
- **Test Stufe 2:** Drei Nacht-Typen verifizieren:
  1. Normalnacht (hinlegen→schlafen): bedEntryTs unverändert, kein Phantom-Balken.
  2. Nacht mit echtem Ausflug (wie 08.06.): bedEntryTs=22:47, Block als preSleepAbsence markiert.
  3. PIR-only / kein Vibrationssensor: keine Änderung.

#### STUFE 3 — Balken: Vor-Schlaf-Abwesenheit rendern (PWA + Admin)
**Ziel:** Der Abschnitt `bedEntryTs → sleepWindowStart` zeigt den Ausflug als Abwesenheit
(schraffiert/grau, wie `bedAbsenceOverlays` im Schlafbereich), NICHT als gelbes Wachliegen.

- **Backend:** `pwa_sleep_tile_build.js` — `preSleepAbsenceEvents` in das View-Model übernehmen
  (analog zu `bedAbsenceOverlays`: leftPct/widthPct/title/confidence). Der Vor-Schlaf-Balkenbereich
  (heute "Ins Bett / Wachliegen"-Segment, ~Z575–580) muss die Abwesenheit ausstanzen.
- **PWA-Client:** `pwa_sleep_tile_client.js` — schraffierte Overlays auch im Vor-Schlaf-Bereich
  zeichnen (Rendering-Code für `bedAbsenceOverlays` existiert bereits, ~Z206ff — wiederverwenden).
- **Admin:** `HealthTab.tsx` — gleiche Overlays im Vor-Schlaf-Segment (Parität).
- **Tooltip:** "Außerhalb des Bettes (Wohnzimmer) 00:23–01:02" statt "Wachliegen".
- **Test Stufe 3:** Balken zeigt: 22:47 Bettkontakt → kurzes Wachliegen → Abwesenheit (schraffiert)
  00:23–01:02 → Rückkehr → Einschlafen 01:30. Legende/Tooltip korrekt.

### 6. Nebenwirkungs-Matrix (Gesamtkonzept) — vor JEDER Stufe erneut prüfen
| Setup | Stufe 1 | Stufe 2 | Stufe 3 |
|---|---|---|---|
| FP2/Radar vorhanden | kein Effekt (FP2 Vorrang) | kein Effekt | kein Effekt |
| Nur PIR (keine Vibration) | Kandidat null | kein Effekt | kein Effekt |
| Vibrationssensor (Standard) | neuer Erstkontakt-Wert | früheres bedEntryTs + Absence-Flag | Abwesenheit sichtbar |
| Mehrpersonen geteiltes Bett | personTag-Filter Pflicht | personTag-Filter Pflicht | pro Person rendern |
| Normalnacht (hinlegen→schlafen) | Kandidat = Einschlaf-nah | bedEntryTs wie heute | kein neues Overlay |

### 7. Bewusste Nicht-Ziele (Scope-Grenze)
- KEINE Shelly-Offline-Sondererkennung (separates Thema; MQTT liefert keinen Heartbeat).
- KEINE Umstellung der Einschlaf-Erkennung (`sleepWindowStart` bleibt wie heute).
- KEINE Rückwärts-Suche wieder einführen (v0.33.150-Bug).

### 8. Definition of Done
- [ ] Stufe 1 über ≥3 reale Nächte geloggt, plausibel, kein UI-Effekt.
- [ ] Stufe 2: 3 Nacht-Typen verifiziert, OC_REGISTER aktualisiert (neue Quelle + preSleepAbsence).
- [ ] Stufe 3: Balken PWA+Admin identisch, Tooltip/Legende korrekt.
- [ ] HANDBUCH (Algorithmus-Tabellen + Kachel-Tooltips) + TESTING (T-Fälle je Stufe) gepflegt.
- [ ] Graceful Degradation für alle 5 Setups bestätigt.

---

## 🚧 OC-45: Sleep-Cycle State Machine — Architektur-Roadmap (07.05.2026)

### Hintergrund (Diagnose aus 07.05.2026)
`bedExitTs` wird aktuell durch eine statische Fallback-Kette (OC-42) berechnet:
FP2-firstEmpty (≥15 Min) → vibration_alone → SM-Wake-Phase → Snapshot.
Problem: Die 15-Min-Schwelle ist für nächtliche Nykturie-Trips korrekt, aber nach dem
Aufwachen (post-sleepWindowEnd) zu konservativ. Kurze "Walk-Throughs" (Person geht
durch Schlafzimmer nach Dusche) werden als "Rückkehr ins Bett" gewertet und verzögern
bedExitTs um bis zu 15 Minuten.

Konkretbeispiel: Marc, 07.05.2026 — erster Abgang 06:24, Dusche, Walk-Through um 06:36
→ FP2 sieht kurz True → System denkt Rückkehr → bedExitTs = 06:38 statt 06:24.

### Langfristiges Ziel: Eine Sleep-Cycle-State-Machine
Eine einzige State Machine die den gesamten Schlafzyklus (18:00–14:00) abdeckt.
Sensor-agnostisch: Evidenz-basierte Übergänge, Graceful Degradation wenn Sensoren fehlen.

```
PRE_SLEEP            SLEEPING           POST_WAKE           DAY
(Bett legen)  →  (Nacht + Nykturie) →  (Aufstehen)  →  (Tag)
  18:00–23:00       23:00–05:00           05:00–12:00    12:00+
```

### Implementierungs-Reihenfolge (Schritt für Schritt, NICHT auf einmal)

**Schritt 1 — POST_WAKE Phase (OC-45a) ← JETZT IMPLEMENTIERT (07.05.2026)**
Ersetzt OC-42 bedExitTs-Fallback-Kette.
Läuft von `sleepWindowEnd` bis `wakeHardCap`.
Output: `bedExitTs` (präziser) + `bedExitConf` (Konfidenz).
States: WAKING → DEPARTED → AWAY_CONFIRMED | POTENTIAL_RETURN → TRANSIT | GENUINE_RETURN → FINAL_DEPARTURE

**Schritt 2 — SLEEPING Phase Nykturie-Integration (OC-45b) ← NÄCHSTE WOCHE**
Ersetzt smWakePhases (OC-31 Stage 2) und nocturiaAttr-Berechnung.
Bessere Nykturie-Erkennung: unterscheidet echte Toilettengänge von Schlafstörungen.
Input: FP2, Bad-Sensor, PIR-Kette, Vibration.

**Schritt 3 — PRE_SLEEP Phase (OC-45c) ← ÜBERNÄCHSTE WOCHE**
Verbindet Einschlafzeit-Detektion mit dem State Machine Kontext.
sleepWindowStart wird Teil der State Machine, nicht mehr isoliert.

**Schritt 4 — Unified Sleep-Cycle-SM (OC-45d) ← WENN 1-3 STABIL**
Alle drei Phasen zu einer einzigen State Machine zusammenführen.
Eine Zentralinstanz, ein Kontext, alle Outputs.

### Sensor-Agnostik-Prinzip für alle Schritte
Jeder Sensor liefert Evidenz-Punkte. Kein Sensor ist Pflicht.
Fehlender Sensor = geringere Konfidenz, aber kein Absturz.
Exakt dasselbe Prinzip wie wakeSource/sleepStartSource heute.

### Warum Hybrid (viele kleine → eine große) und nicht sofort eine große?
- Schritt 1 allein löst das konkrete Problem und ist testbar
- Jeder Schritt kann einzeln deployed werden — keine Big-Bang-Migration
- Wenn Schritt 1 eine Woche stabil läuft → Schritt 2 bauen
- Rückfall auf altes Verhalten jederzeit möglich (Snapshot-Fallback bleibt)

---

## 🏗️ KERN-DESIGNPRINZIP — Skalierbarkeit für Tausende Kunden (17.03.2026)

> **Dieses Prinzip gilt für JEDE Funktion, JEDEN Algorithmus und JEDE UI-Kachel in AURA.**
> Es ist kein Nice-to-have, sondern Pflichtanforderung — AURA soll an Tausende Kunden
> in unterschiedlichsten Gebäuden und Konfigurationen verkauft werden, und langfristig
> als Medizinprodukt zugelassen werden. Zunächst als **Lifestyle-Produkt** positioniert.

### Das Problem
Kein Kunde hat die gleiche Sensor-Ausstattung. Der eine hat 2 Bewegungsmelder und einen Lichtschalter, der andere hat FP2-Radar, Vibrationssensor, Türkontakte, Temperatursensoren und ein Zigbee-Gateway mit 30 Geräten. Beide kaufen AURA. Beide müssen ein sinnvolles Erlebnis bekommen.

### Die Regel: Graceful Degradation + Capability Hints

**Jede Funktion muss drei Zustände kennen:**

```
1. VOLL AKTIV       → alle benötigten Sensoren vorhanden und konfiguriert
                      → Feature läuft, Kachel zeigt echte Daten

2. EINGESCHRÄNKT    → Teilausstattung vorhanden
                      → Feature läuft in reduziertem Modus, Kachel zeigt was möglich ist
                        + ein dezenter Hinweis "Mit [Sensor X] wäre auch Y möglich"

3. NICHT VERFÜGBAR  → kein relevanter Sensor vorhanden
                      → Kachel wird ausgeblendet ODER zeigt "Nicht verfügbar"
                        + klarer Hinweis WARUM und WELCHER Sensor das Feature aktiviert
```

**Beispiele:**

| Feature | Voll aktiv | Eingeschränkt | Nicht verfügbar |
|---|---|---|---|
| Sleep Score | FP2-Bett + Vibrations-Stärke | Nur Vibrations-Detection | Kein Bett-Sensor → Kachel ausgeblendet |
| Nykturie | FP2-Bett + Badezimmer-Sensor | Nur PIR-Nacht + Badezimmer | Kein Nachtsensor → "-" mit Hinweis |
| Ganganalyse | Flur-PIR + Wohnzimmer-PIR | Ein PIR (nur Aktivität) | Kein PIR → Kachel ausgeblendet |
| Personenzählung | WLAN-Präsenz + Bewegung | Nur Bewegungsmelder | Nur Lichtschalter → nicht möglich |
| Parkinson-Tremor | Vibrations-Stärke + FP2 | Nur Vibrations-Detection | Kein Vibrationssensor → Profil gesperrt |

### Sensor-Empfehlungs-System

Der Adapter soll immer wissen, welche Sensoren er hat und was damit möglich ist. Grundsatz:

> **"Zeige dem Nutzer was er hat — und zeige ihm was er noch bekommen könnte."**

- Im Medizinisch-Tab: Bei jedem Krankheitsprofil steht, welche Sensoren nötig/optimal sind und welche fehlen
- Im System-Tab: Sensor-Ampel zeigt nicht nur online/offline, sondern auch "Funktionsabdeckung" (z. B. "Schlafzimmer: 2/4 Sensor-Klassen vorhanden")
- Bei sehr schlechter Ausstattung (z. B. nur Lichtschalter): **Klarer ehrlicher Hinweis:** *"Mit der aktuellen Sensorausstattung kann AURA keine aussagekräftige Gesundheitsanalyse durchführen. Empfohlen: mindestens ein Präsenz- oder Bewegungssensor im Schlafbereich."*

### Medizinprodukt-Perspektive

Langfristig (Phase 7+) soll AURA als Klasse-I oder Klasse-IIa Medizinprodukt nach MDR zugelassen werden.
Das bedeutet bereits heute:
- Alle algorithmischen Entscheidungen müssen **nachvollziehbar und dokumentiert** sein
- Alle Aussagen müssen mit **Konfidenz-Angabe** (z. B. "hohe Sicherheit", "geschätzt", "unzureichende Datenlage") versehen sein
- Die Grenzen des Systems müssen dem Nutzer **aktiv kommuniziert** werden — nicht versteckt
- Kein Feature darf den Nutzer in false security wiegen: *"AURA ersetzt keine ärztliche Diagnose"* muss systemisch verankert sein

### Entwickler-Checkliste (bei jedem neuen Feature prüfen)

```
☐ Was passiert wenn dieser Sensor FEHLT?          → Graceful Degradation definiert
☐ Was passiert wenn nur EINER von N Sensoren da ist? → Eingeschränkter Modus definiert
☐ Gibt es einen Hinweis was der Nutzer tun kann?   → Capability Hint implementiert
☐ Ist die Konfidenz der Aussage kommuniziert?      → Medizinprodukt-Konformität
☐ Funktioniert es in Wohnung, Haus, WG, Pflegeheim? → Mehrkunden-Tauglichkeit
☐ Ist der Algorithmus konfigurationsunabhängig?    → Keine hardcodierten Sensor-IDs
```

---

## 🚧 OFFENE KONZEPTE (noch nicht umgesetzt, nach Priorität)

> **Abkürzung "OC"** = **Offenes Konzept** — bezeichnet Themen die diskutiert aber noch nicht vollständig implementiert sind. Implementierte OCs wandern in PROJEKT_STATUS.md.

---

### OC-50: CGM / Nightscout / AAPS — Fusion mit AURA (26.05.2026)

**Status:** Konzept — im Haushalt bereits live (ioBroker VIS), **nicht** in AURA-Algorithmen integriert.

**Ausgangslage (Referenz-Installation):**
- Tochter: Diabetes Typ 1 mit **AAPS** (Android APS) + **Nightscout** (CGM-Verlauf, aktueller Wert, Trend).
- ioBroker: Blutzucker im VIS-Header, Nightscout-Widget, Pushover-Aktionen (z. B. „Niedrig — Traubenzucker“, „Hoch — Spritzen“).
- AURA `diabetes2` / `diabetes1`: aktuell nur **Verhaltens-Proxies** (Nykturie, Küche, Aktivität) — **kein CGM**.

**Warum trotzdem strategisch wichtig:**
- Der [ingenieur.de-Artikel (25.05.2026)](https://www.ingenieur.de/technik/fachbereiche/medizin/wearables-werden-zu-medizinprodukten-was-die-neue-sensorik-leisten-kann-3645420.html) nennt Diabetes-Monitoring als Vorreiter **kontinuierlicher** digitaler Medizin.
- AURA-Positionierung bleibt **ambient-first** (Raumsensoren = kein „Du bist krank“-Gefühl), aber **Wearables/CGM sind komplementär**, nicht konkurrierend.
- Fusion-Story: *„Haus beobachtet Alltag und Routinen — CGM liefert den Biomarker — AURA verknüpft beides.“*

**Zielbild (Fusion, nicht Ersatz):**
| Quelle | Was AURA daraus lernt |
|--------|------------------------|
| Nightscout/AAPS States | BZ, Trend, IOB (optional), Hypo/Hyper-Episoden |
| Raumsensoren (bestehend) | Nacht-Aufstehen, Küche, Aktivität, Schlaf |
| Kombination | z. B. nächtliche Nykturie **mit** nächtlichem BZ-Verlauf; Tagesstruktur bei CGM-Ausfall |

**Referenz-Installation — ioBroker Nightscout-Adapter (Instanz `nightscout.0`):**

> Quelle: Objekte-Tab, 26.05.2026. Instanz-Nummer kann pro Kunde abweichen (`nightscout.1` …).

| State-ID | Name (Adapter) | Rolle / Typ | Nutzen für AURA |
|----------|----------------|-------------|-----------------|
| **`nightscout.0.data.mgdl`** | Sugar value | `value.blood.sugar`, number | **Primär-BZ** (mg/dl) — Pflichtfeld für CGM-Fusion |
| `nightscout.0.data.mgdlScaled` | — | number | Gleicher Wert numerisch (für Logik bevorzugen wenn stabil) |
| `nightscout.0.data.mgdlDirection` | — | text | Trend: `Flat`, `FortyFiveDown`, `SingleUp`, … → Kurzstatus + Alerts |
| `nightscout.0.data.lastUpdate` | — | number (ms) | Datenfrische / Offline-Erkennung |
| `nightscout.0.data.alarm` | — | boolean | Aktiver Alarm (nicht dringend) |
| `nightscout.0.data.urgentAlarm` | — | boolean | Dringender Alarm — **nicht** durch AURA ersetzen |
| `nightscout.0.data.pumpBattery` | — | number (%) | Pumpen-Status (Kontext Care-Report) |
| `nightscout.0.data.reservoir` | — | number (U) | Rest-Insulin im Reservoir |
| `nightscout.0.data.uploaderBattery` | — | number (%) | Handy/Uploader — Ausfall-Frühwarnung |
| `nightscout.0.data.clock` | — | text | Pumpenuhr (Sync-Check) |
| `nightscout.0.data.notification` | — | text | z. B. „Meal Bolus Insulin“ — Ereignis-Kontext |

**AAPS:** Läuft upstream zu Nightscout; AURA liest vorerst **nur** die Nightscout-States (kein separater AAPS-Adapter nötig).

**Konfiguration in AURA (geplant):**
```json
"cgmSource": {
  "enabled": false,
  "instance": "nightscout.0",
  "states": {
    "glucose": "nightscout.0.data.mgdl",
    "direction": "nightscout.0.data.mgdlDirection",
    "lastUpdate": "nightscout.0.data.lastUpdate",
    "urgentAlarm": "nightscout.0.data.urgentAlarm"
  },
  "unit": "mgdl",
  "profile": "diabetes1"
}
```
Alternativ: freie State-ID-Eingabe pro Feld (Graceful Degradation wenn Adapter fehlt).

**Technische Skizze (Implementierung):**
1. ~~State-IDs dokumentieren~~ → siehe Tabelle oben.
2. `saveDailyHistory` / Digest: `cgmMean`, `cgmMin`, `cgmMax`, `cgmDirectionChanges`, `timeInRangePercent` (Schwellen konfigurierbar), `cgmStaleMinutes`.
3. Profil `diabetes1`: Score nur wenn `cgmSource.enabled` + `lastUpdate` < X Min; sonst `SENSOR_MISSING` + Hint „Nightscout/CGM verbinden“.
4. **Hypo/Hyper:** Kurzzeit über bestehende Pushover/VIS — AURA nur **Tages-/Wochen-Trends** und Fusion mit Nykturie/Aktivität.
5. Datenschutz: CGM Opt-in, separates Care-Profil, **keine** Roh-CGM-Werte an Gemini (nur aggregierte Texte).

**Priorität:** Mittel — nach Phase-2-Sturz/Demenz/Frailty stabil; idealer Pilot = eigener Haushalt (Tochter, States oben).

**Abgrenzung:** AURA wird kein Closed-Loop und kein CGM-Ersatz; Integration = **Datenfusion** für Angehörigen- und Langzeit-Übersicht.

---

### OC-51: Externe Trend-Referenz + Forschungsfoerderung (26.05.2026)

**Referenz-Artikel (dauerhaft zitieren):**
- [Wearables werden zu Medizinprodukten — ingenieur.de, 25.05.2026](https://www.ingenieur.de/technik/fachbereiche/medizin/wearables-werden-zu-medizinprodukten-was-die-neue-sensorik-leisten-kann-3645420.html)
- Kernthesen: Dauer-Messung statt Stichprobe, multimodale KI-Auswertung, Fruehwarnung chronischer Erkrankungen, Grenze Consumer vs. validiertes Medizinprodukt.
- **AURA-Differenzierung:** Raumsensorik + Smart-Home-Sensoren (Licht, Praesenz, Energie) = Monitoring **ohne** Pflicht-Wearable; gleiche Makro-Story, andere Modalitaet.

**Im Artikel genannte Forschungsprojekte / Foerderung — wo nachlesen:**

| Name | Was | Wo | Relevanz fuer AURA |
|------|-----|-----|-------------------|
| **PearNet** | Multimodales Körpersensornetzwerk Epilepsie (UKB Bonn), KI auf Biosignalen | [GO-Bio Projektseite](https://www.go-bio.de/gobio/de/gefoerderte-projekte/gobio-initial/_documents/PearNet.html), [Uni Bonn News 2026](https://www.uni-bonn.de/de/neues/092-2026) | **Thematisch** (Epilepsie-Profil), **nicht** Wettbewerb — die setzen auf Wearables/EEG-am-Ohr; wir auf Raum + Vibration |
| **GO-Bio next** | BMFTR-Gründungsoffensive Biotechnologie, PoC → Ausgründung, >100 Mio. bis 2032 | [go-bio.de](https://www.go-bio.de/gobio/de/go-bio/go-bio-next/go-bio-next_node.html), [Förderdatenbank](https://www.foerderdatenbank.de/FDB/Content/DE/Foerderprogramm/Bund/BMBF/go-bio-next.html) | Nur relevant bei **eigener Ausgründung / MDR-Pfad** und Lebenswissenschafts-Bezug; AURA ist Software+SH, nicht Biotech-Wirkstoff |
| **GO-Bio initial** (Vorgänger PearNet) | Sondierung/Machbarkeit Epilepsie-Wearables | siehe PearNet-Seite | Benchmark fuer Transfer Geschwindigkeit |

**Weitere für uns nuetzlichere Foerder-Spuren (nicht im Artikel, aber passender):**
- **EXIST-Forschungstransfer** (BMWK) — Software/Hardware-Prototyp, kuerzere Wege als GO-Bio next
- **ZIM / KMU-innovativ** — Digitalisierung, AAL-nahe Produkte
- **Pflegekasse / SGB XI** — „Wohnumfeldverbessernde Massnahmen“ (siehe Paketierung unten in dieser Datei)
- **EU / BMBF Digital Health** — nur bei klarer Kooperation mit Forschungspartner (Validierungsstudie)

**Entscheidung:** Forschungsgelder jetzt **nicht** priorisieren — erst Pilot-Kunden und Care-Story. GO-Bio/PearNet als **Markt- und Trendbeleg** in Vertrieb/Marketing nutzen, nicht als sofortigen Antragsfahrplan.

**Literatur:** Vollständige Paper-Liste → `_internal/LITERATUR.md`

---

### OC-58: Akute Verwirrtheit / Delir + Push an Angehörige (13.06.2026)

**Auslöser:** Angehörigen-Szenario (Sohn, Papa allein zuhause, Hirnblutung/Verwirrtheit). Nutzer wünscht: *„Das Haus soll mir schreiben, wenn es Papa nicht gut geht — auch wenn wir keine Diagnose stellen können."*

**Status:** Konzept — **nicht** in `health.py`, **nicht** in UI. Diskutiert 13.06.2026.

**Problem heute:**
- Krankheitsprofile (Demenz, Frailty, …) = **schleichend** (Wochen/Monate).
- **Tages-Anomalie** („heute ungewöhnlich") existiert, landet in PWA/Admin — **kein standardisierter Push** an Angehörige.
- **Totmann/Lebenszeichen** → Pushover/Telegram ✅ — aber nur bei **Stille**, nicht bei „wach aber verwirrt/chaotisch".

**Zielbild (zwei Bausteine):**

#### Baustein A — Profil `acuteDelirium` (Algorithmus)

| Signal | Quelle | Schwellwert-Idee |
|---|---|---|
| Tagesablauf weicht stark von 14-Tage-Baseline ab | STB / IsolationForest | Kombiniert mit anderen Signalen, nicht allein |
| Nacht deutlich unruhiger (PIR + optional Vibration) | nightEvents, Nykturie | >2× persönliche Baseline |
| Raumfolge „planlos" (Activity Entropy) | Raum-Sequenz aus eventHistory | NEU — noch nicht implementiert |
| Tagsüber wenig strukturierte Aktivität | uniqueRooms, heatmap | Entropie hoch bei niedriger Gesamtaktivität |

- **Kein Label** „Schlaganfall" oder „Hirnblutung" — nur: **`ACUTE_PATTERN`** / „Heute deutlich untypisch".
- Onset: **Stunden bis wenige Tage** (Akut-Ebene HANDBUCH Phase 2).
- Literatur: `LITERATUR.md` §2 (JMIR Smart-Home Delir POC, Frontiers Actigraphie ICH).

#### Baustein B — Care-Push an Angehörige (Produkt)

Pushover / Telegram / PWA-Badge wenn:

1. `analysis.health.anomalyScore` > konfigurierbar (z. B. 0.6) **UND** Lernphase vorbei  
2. Oder: OC-58 Profil `acuteDelirium` Confidence > Schwellwert  
3. Oder: Nacht-Anomalie + Tages-Anomalie **am selben Tag** (Verstärker)

**Beispiel-Push-Text (Angehörigen-Sprache):**
> „AURA: Bei [Papa] war heute der Tagesablauf ungewöhnlich (mehr Bewegung nachts, weniger Struktur tagsüber). Das kann harmlos sein — bitte einmal anrufen oder vorbeischauen. Kein automatischer Notruf."

**Eskalation:**
- Stufe 1 (Info): gelber Push, kein Sound nachts  
- Stufe 2 (Auffällig): orange, Sound tagsüber  
- Stufe 3: nur Totmann → bestehende Notfall-Priorität (rot)

**Config-Idee:** `carePushEnabled`, `carePushRecipients[]`, `carePushMinScore`, `carePushQuietHours`

**Abhängigkeiten:**
- Build-Sync Disease-Scores (3→7 Profile)  
- Optional: Activity Entropy in dailyDigest  
- Disclaimer-Template in jeder Nachricht (kein Medizinprodukt)

**Priorität:** **Hoch** für Care-Vertrieb (Angehörigen-Story stärker als reine Admin-Kachel).  
**Aufwand:** Baustein B (Push bei bestehender Anomalie) = **klein–mittel**. Baustein A (Entropy + Profil) = **mittel**.

**Dokumentation:** Master-Tabelle → `_internal/KRANKHEITSBILD-MATRIX.md` · Quellen → `_internal/LITERATUR.md`

---

### OC-44: State Machine mit Gedächtnis (Schlaf-Plausibilisierung via History) (01.05.2026)

**Kontext:** OC-42 hat die grundlegenden Wake-Detection-Bugs behoben. Der nächste Reifegrad wäre eine lernende State Machine die historische Daten nutzt um Sensor-Events zu plausibilisieren.

**Konzept-Stufen:**

**Stufe 1: Wake-Time-Prior (einfach, hohe Wirkung)**
- Aus letzten 14 History-Dateien lernen: wann ist dieser Nutzer typischerweise aufgestanden (bestätigte Werte)?
- Ergebnis: `wakeWindowP5 / wakeWindowP95` pro Wochentag (7-Tage-Modell, nicht Bundesland/Ferien)
- Beim Adapter-Start in `LTM.wakeTimeWindow` speichern (analog `LTM.roomTransitionTimes`)
- SM und motion_vib: Events außerhalb des gelernten Fensters → Konfidenz-Abzug, nicht Hard-Block
- **Wichtig: Wochentag vs. Wochenende** reicht für 85-90% der Varianz. Ferien/Feiertage sind zu selten (<3-4% der Tage) um den Bucket wesentlich zu verzerren. Kein Bundesland/Kalender-API nötig.

**Stufe 2: Nocturia-Stunden-Muster**
- Häufigkeitsverteilung der nachtAufstehen-Events nach Stunde aus History
- Wenn 04:00-05:00 historisch ein Toilet-Fenster ist → motion/SM-Events in dieser Stunde automatisch als `nocturia` klassifizieren
- Ergänzt den OC-42-Zusatzschutz (der nur bekannte nachtAufstehenWindows nutzt)

**Stufe 3: MAE-gewichtete Quellenpriorität (OC-16 ausbauen)**
- MAE-Ranking existiert bereits (OC-16), wird aber nur für Display genutzt
- Quelle mit niedrigstem historischen MAE bekommt bei Gleichstand Priorität in der Kette
- Macht System selbst-korrigierend über Zeit

**Daten-Grundlage:** `this._historyDir` (history/*.json), bereits beim Adapter geladen. `LTM.dailyDigests` ist vorhanden aber für AI/Health — für Wake-Prior die raw History-Dateien verwenden.

**Implementierungsort:** `saveDailyHistory` am Ende: neues `this._wakeTimeWindow` berechnen und in `LTM.wakeTimeWindow` persistieren. Bei `onReady`: laden.

---

### OC-36: State Machine Bed-Presence Cross-Check + Architektur-Konsolidierung (27.04.2026)

**Kontext:**
Die `nachtAufstehenEvents`-Erkennung ist aktuell ein simpler Pattern-Matcher: "Sensor X (außerhalb Schlafzimmer) feuert → kurz danach feuert EG Schlafen → als Abgang+Rückkehr interpretiert." Ein Hop-Distanz-Filter (max. 3 Hops, implementiert ab v0.33.201) reduziert Falsch-Positive aus weit entfernten Räumen (z. B. OG Flur). Gleiches gilt für `smWakePhases` (Hop-Filter ab v0.33.205).

**Problem:**
Aktuell existieren **drei parallele Algorithmen** die alle "Abwesenheit vom Bett" berechnen, ohne sich gegenseitig zu kennen:
1. `nachtAufstehenEvents` — PIR-basierter Pattern-Matcher (Abgang + Rückkehr ins Schlafzimmer)
2. `smWakePhases` — State Machine (PIR-Events, trackt "in Bett / außerhalb" kontinuierlich)
3. `outsideBedEvents` — FP2/Radar-bestätigte Abwesenheiten (zuverlässigste Quelle)

Die Frontend-Visualisierung zeigt dies als **Overlays auf dem Balken** (smWakePhases = gelbes Overlay) was konzeptionell falsch ist: "weg vom Bett" ist kein Schlaf-Substadium, sondern ein eigener Zustand.

---

#### Phase 4 — Architektur-Konsolidierung (offene Ideen / Zielbild)

**Ziel:** SM als Single Source of Truth für "weg vom Bett" — alle drei Algorithmen sprechen miteinander.

**WICHTIG — Klare Abgrenzung:** Wir werfen NICHTS um. Alle bestehenden Algorithmen (`smWakePhases`, `nachtAufstehenEvents`, `outsideBedEvents`, `nightVibrationTimestamps`) bleiben. Wir bauen NUR einen **Merger** der die drei zu einem konsolidierten Output verbindet, mit Konfidenz-Bewertung anhand vorhandener Sensoren.

> Hinweis: Umgesetzte Details, Bugfixes und Lessons Learned stehen ab jetzt ausschließlich im `PROJEKT_STATUS.md`.
> `BRAINSTORMING.md` enthält nur noch offene Ideen, Zielbilder und noch nicht umgesetzte Varianten.

**Kern-Ideen:**

**A) SM bekommt FP2 + Vibration als Input (Cross-Check)**
- Wenn `smWakePhases` einen Abgang erkennt (PIR außerhalb): zusätzlich prüfen ob FP2-Radar `false` meldet
- Wenn FP2 noch Präsenz zeigt → kein echter Abgang → Event verwerfen (Falsch-Positiv-Filter)
- Wenn kein FP2 vorhanden: Vibrationssensor-Pause als Proxy (kein Vibrations-Event in den letzten 3 Min → Bett möglicherweise leer)
- Kein FP2, kein Vibration → Hop-Filter als einzige Schutzschicht (Graceful Degradation)

**B) nachtAufstehenEvents wird durch SM-Ergebnis validiert**
- Nach Pattern-Match: Abgleich ob `smWakePhases` den gleichen Zeitraum auch als "außerhalb" sieht
- Falls beide übereinstimmen → starke Bestätigung → Event bleibt
- Falls nur einer es sieht → `confidence`-Flag reduzieren, Event bleibt aber mit niedrigerer Gewichtung

**C) `outsideBedEvents` als Master-Quelle in SM integrieren**
- FP2-bestätigte Abwesenheiten sind die zuverlässigste Quelle → SM-Ergebnis wird durch outsideBedEvents überschrieben/bestätigt wo verfügbar
- Zusammengeführtes Array: `bedAbsenceEvents` mit Quelle-Flag (sm / fp2 / nachtAufstehen / combined)

**D) Frontend: "weg vom Bett" als eigene Balkenfarbe**
- Statt gelbem Overlay auf dem Schlafphasen-Balken → eigenes Segment (z. B. hellgrau schraffiert oder bordeauxrot)
- Visualisierung im Balken: [Tiefschlaf][Leichtschlaf][🚶 Weg vom Bett (15 Min)][REM][Tiefschlaf]
- Dreiecke (Bad/Außerhalb) bleiben als Marker erhalten
- kein Overlay mehr → keine Überlagerungen, keine Farbkonfusion

**Graceful Degradation (Tausende Kunden, unterschiedliche Sensoren):**

| Sensor-Setup | SM-Verhalten | Balken-Visualisierung |
|---|---|---|
| FP2 + Vibration + PIR | Vollmodus: alle drei Quellen kombiniert | Eigenes Segment im Balken |
| FP2 + PIR (kein Vibration) | SM nutzt FP2 als Cross-Check | Eigenes Segment, leicht reduzierte Konfidenz |
| Nur PIR (kein FP2/Vibration) | Hop-Filter als einzige Schutzschicht | Gelbes Overlay (Legacy-Modus) |
| Kein Sensor | SM disabled | Kein "weg vom Bett" angezeigt |

**Implementierungsreihenfolge:**
1. Backend: `bedAbsenceEvents` Merger-Funktion (SM + FP2 + nachtAufstehen → kombiniertes Array)
2. Backend: SM-Cross-Check gegen FP2 / Vibration
3. Frontend: `bedAbsenceEvents` als eigenes Balken-Segment rendern
4. Frontend: Gelbes Overlay entfernen (nur noch für Legacy ohne FP2/PIR)

**Priorität:** 🔴 HOCH (für offene Weiterentwicklung)

---

### OC-35: Shelly Presence Gen4 als Zonen-Sensor für gemeinsames Schlafzimmer (23.04.2026)

**Kontext:**
Im Mehrpersonenhaushalt mit gemeinsamem Schlafzimmer (Doppelzimmer) kann kein normaler Bewegungsmelder die Personen unterscheiden — er erfasst immer beide. Der Shelly Presence Gen4 (mmWave Radar, 60-64 GHz) unterstützt bis zu 10 konfigurierbare Zonen und erkennt stille Präsenz (Atmung, minimale Bewegung). Damit kann die linke und rechte Bettseite als getrennte Zonen konfiguriert werden.

**Gerät:** Shelly Presence Gen4 (S4SN-0U61X) — 69,98 € — WLAN/Zigbee/Bluetooth/Matter.

**Anwendungsfall:**
- Sensor wird oberhalb des Doppelbetts montiert (empfohlene Höhe 2m, Neigung 15°)
- In der Shelly-App werden zwei Zonen definiert: Zone A = linke Bettseite (Person A), Zone B = rechte Bettseite (Person B)
- Via Matter erscheint jede Zone als eigenständiges Sensor-Objekt in ioBroker
- In der AURA-Sensorkonfiguration: Zone A bekommt PersonTag "Anna", Zone B bekommt PersonTag "Marco"

**Was das ermöglicht:**
- Bett-Präsenzerkennung pro Person (wie FP2, aber für zwei Personen im selben Zimmer)
- `bedPresenceMinutes` pro Person → präzise Schlafzeit-Berechnung
- Wenn Zone A = leer, aber Zone B = belegt → Anna ist aufgestanden → außerhalb-Attribution direkt möglich
- Stille Präsenzerkennung (im Gegensatz zu Vibrationssensor der nur Bewegung erkennt)

**Wichtiger Hinweis für Implementierung:**
- FP2 kann dies NICHT leisten (erkennt Belegung aber keine Zonen)
- Shelly Presence Gen4 muss VOR ioBroker-Einbindung in der Shelly-App konfiguriert werden
- Sensor-Konfigurationsseite muss Zone-Sensoren mit PersonTag unterstützen (bereits möglich)
- Kein FP2 notwendig wenn Presence Gen4 vorhanden: `isFP2Bed` kann durch Zone-Sensor ersetzt werden

**Graceful Degradation:**
- Ohne Presence Gen4: Fallback auf Vibrationssensor + returnSensor-Attribution (OC-33)
- Mit Presence Gen4 (1 Zone): wie einzelner FP2 für das Zimmer
- Mit Presence Gen4 (2 Zonen): volle Per-Person-Attribution ohne Vibrationssensor nötig

---

### OC-34: Vibrationssensor-Positionierungshinweis verbessern (23.04.2026)

**Status:** Basis-Erkennung implementiert in v0.33.200 (OC-33 Teil B)

**Erweiterungsideen für spätere Versionen:**

**Ausbaustufe 2 — Schwellwert-Kalibrierung:**
Der Schwellwert von `maxStrength < 10` ist ein sinnvoller Startwert, aber je nach Sensortyp und Matratzentyp können die Werte abweichen. Langfristig: Adaptive Kalibrierung — nach 7 Nächten vergleiche `nightVibrationStrengthMax` mit Referenzwerten anderer Haushalte (anonymisiert). Wenn Haushalt systematisch in der untersten 10%-Perzentile liegt → Sensor-Positionierungshinweis.

**Ausbaustufe 3 — Sensor-Typ-spezifische Schwellwerte:**
Homematic Erschütterungsmelder vs. Shelly Motion Sensor vs. SleepIQ-Sensor haben unterschiedliche Empfindlichkeitsbereiche. Wenn Sensortyp bekannt (aus ioBroker-Adapter-ID erkennbar) → typ-spezifische Schwellwerte anwenden.

**Ausbaustufe 4 — False-Negative-Rate-Schätzung:**
Wenn in einer Nacht `nachtAufstehenEvents` vorhanden sind (Person ist sicher aufgestanden) aber kein Vibrationsereignis kurz davor lag → False-Negative gezählt. Ab 3 False-Negatives in 7 Nächten → Positionierungshinweis eskalieren.

---

### OC-30: Quellen-Feedback-Loop — Lernen aus manuellen Overrides (21.04.2026)

**Kontext:**
OC-23 (Manueller Override) ist vollständig implementiert. Wenn ein Nutzer wiederholt die automatisch gewählte Einschlafzeitquelle manuell korrigiert, ist das ein implizites Signal: der Algorithmus wählt systematisch die falsche Quelle. Dieses Wissen sollte zurückfließen.

**Drei Ausbaustufen:**

#### ✅ Stufe 1 — Quellen-Zähler (v0.33.189)
`analysis.health.sourceOverrideHistory` — zählt wie oft der Nutzer manuell zu welcher Quelle wechselt. Im HealthTab als grüne Chips sichtbar.

#### ✅ Stufe 2 — Override als Ground Truth für Kalibrierung (v0.33.189)
Kalibrierungseinträge haben `referenceSource: 'manual_override'` und `absDeltaToRefMin` wenn Override gesetzt. Fließt direkt in OC-16 MAE-Ranking ein — Nutzer ohne Garmin kalibrieren über eigene Korrekturen.

#### Stufe 3 — Gelernter Prior (Verbindung zu OC-22)
Der Rolling-7-Nacht-Mittelwert der Einschlafzeiten (OC-22 Stufe 1) soll Override-korrigierte Werte bevorzugt als Eingang nutzen — statt dem automatisch berechneten Wert. Damit konvergiert der Prior schneller auf die wahre Einschlafzeit.

**Abhängigkeiten:**
- OC-22 (gelernter Prior) — Stufe 3 baut direkt darauf auf
- `sourceCalibLog` in `saveDailyHistory` bereits vorhanden — Stufe 2 braucht nur einen zusätzlichen Eintrag

**Offene Fragen:**
- Wie viele Overrides bis zum Effekt? (Vorschlag: N=5 → Bonus, N=10 → feste Umordnung)
- Soll der Nutzer den gelernten Bias sehen können? ("AURA hat gelernt: für dich ist vib_refined zuverlässiger als Garmin")
- Reset-Möglichkeit wenn Sensor sich ändert (neuer Vibrationssensor → Prior zurücksetzen)

**Priorität:** Mittel — wertvolles Langzeit-Feature, kein Akut-Bedarf.

---

### OC-29: RF-Klassifikator Visualisierung (16.04.2026)

**Problem / Nutzerbedarf:**
Der Random-Forest-Klassifikator (Stufe 3) lernt aus eingetragenen Labels und verbessert sich mit der Zeit — aber der Nutzer sieht keinen Beweis dafür. Es ist nicht erkennbar, welche Merkmale (Features) der RF aktuell am stärksten gewichtet, wie sich diese Gewichtung beim Hinzufügen einer neuen Session verändert, oder welche Konfidenz der RF für eine Entscheidung hatte.

**Kern-Anforderungen:**
- Feature-Importance-Balkendiagramm: Welche der ~8 Merkmale (peakStrength, avgStrength, duration, slots, avgTrigger, ...) haben wie viel Gewicht — vor und nach einem neuen Label
- LOO-Genauigkeit (Leave-One-Out Accuracy) als Prozentzahl: Wie gut ist der RF bei bekannten Sessions?
- Konfidenz-Score pro Session: "RF hat mit 78% Wahrscheinlichkeit oral/hand erkannt"
- Optional: Entscheidungsbaum-Export (sklearn `export_graphviz`) als einfache ASCII-Darstellung oder Grafik

**Mögliche Umsetzung:**
- Python gibt bei jeder Klassifikation bereits `proba` zurück (Wahrscheinlichkeits-Array) → `confidence = max(proba)` könnte direkt in `intimacyEvents` gespeichert werden
- Feature-Importances via `rf.feature_importances_` nach Training berechnen und in `sexCalibInfo.pyClassifier.featureImportances` speichern
- Anzeige im ALGORITHMUS-Kasten: bestehender Bereich "KI-KLASSIFIKATOR" um Balkendiagramm erweitern
- "Vorher/Nachher"-Vergleich: Nach Eintragen einer neuen Session automatisch Reanalyse triggern und neue Importances anzeigen

**Abhängigkeiten:**
- OC-27 (Multi-Person-Haushalt) — bei mehreren Betten gibt es separate RF-Modelle
- Erfordert Änderung im Python-Skript (`sex_brain.py`) und Anpassung des JSON-Rückgabeformats

**Status:** Offen — sinnvolles Entwickler-Feature, für Endkunden nicht notwendig aber wertvoll während der Kalibrierungsphase

---

### OC-28: Verhütungsmethode & Fruchtbarkeits-Kontext im Sex-Tab (13.04.2026)

**Problem / Nutzerbedarf:**
Der Sex-Tab dokumentiert Intimität, gibt aber keinen Hinweis darauf ob ein bestimmter Tag "gefährlich" (ungewollte Schwangerschaft möglich) oder "gut" (Kinderwunsch) ist. Die Fruchtbarkeitsinformation liegt zwar im Zyklus-Tab vor, wird aber im Sex-Tab nicht berücksichtigt. Außerdem hängt die Relevanz dieser Information stark von der gewählten Verhütungsmethode ab — bei einer Vasektomie ist diese Information irrelevant, bei Kondomen sehr relevant.

**Kern-Anforderungen:**
- Verhütungsmethode als Einstellung (System-Tab oder Zyklus-Tab)
- Fruchtbarkeits-Kontext im Sex-Tab sichtbar: Hinweis auf fruchtbare Tage relativ zur Session
- Kinderwunsch-Modus: "Guter Zeitpunkt!" statt Warnung bei fruchtbarem Fenster
- Datenschutz: Alle Daten lokal, keine Cloud-Übertragung

**Mögliche Verhütungsmethoden-Einstellungen:**

| Methode | Fruchtbarkeits-Hinweis sinnvoll? |
|---|---|
| Vasektomie / Sterilisation | ❌ Nein — kein Hinweis nötig |
| Hormonelle Verhütung (Pille, Spirale, Implantat) | ❌ Nein — Zyklus ohnehin unterdrückt |
| Kondome / keine Verhütung | ✅ Ja — Fruchtbarkeitsfenster anzeigen |
| Kinderwunsch aktiv | ✅ Ja — positiver Hinweis bei Eisprungfenster |
| Natürliche Familienplanung (NFP) | ✅ Ja — besonders relevant |

**Wo einpflegen:**
- **Einstellung** → System-Tab (Abschnitt "Personenkonfiguration") als Dropdown "Verhütungsmethode"
- **Anzeige** → Sex-Tab: Kleines Badge oder Hinweistext in der Session-Kachel ("🌸 Fruchtbares Fenster" / "✅ Sicherer Tag")
- **Zyklus-Tab** zeigt bereits Phasen — Fruchtbarkeitsinformation wäre eine direkte Brücke

**Abhängigkeiten:**
- Zyklus-Tab muss kalibriert sein (Zykluslänge bekannt)
- OC-27 (Multi-Person-Haushalt) — Verhütung ist personenbezogen, bei Mehrpersonenhaushalt entsprechend zuordnen
- Zyklusphase + Eisprung-Tag aus Zyklus-Tab

**Offene Fragen:**
- Unregelmäßiger Zyklus: Hinweis unsicher oder ganz unterdrücken?
- Wie gehen wir mit Paaren um wo nur eine Person Cogni-Living nutzt?
- Soll die Verhütungsmethode pro Person oder pro Haushalt gespeichert werden?

**Priorität:** Niedrig — Nützlich aber kein Sicherheits-Feature.

---

### OC-27: SexBrain Multi-Bett-Unterstützung (15.04.2026)

**Problem / Nutzerbedarf:**
Im Mehrpersonenhaushalt (z. B. Familie mit erwachsenen Kindern, WG, Pflegehaushalt) kann es mehrere Schlafzimmer mit je eigenem Bett und Vibrationssensor geben. Der aktuelle SexBrain-Algorithmus geht von genau **einem** Vibrationssensor (Aqara/Zigbee am Hauptbett) aus. Bei mehreren Betten würden Vibrationsereignisse aus anderen Zimmern fälschlicherweise in die Intimacy-Analyse einfließen — oder umgekehrt würde das richtige Bett ignoriert.

**Kern-Anforderungen:**
1. Jedes Bett muss **separat** analysierbar sein
2. Die Ergebnisse sollen dem richtigen **Personen-Paar** oder Schlafzimmer zugeordnet werden
3. Die Kalibrierung (calibA/calibB) muss **pro Bett** gespeichert werden (unterschiedliche Matratzen → unterschiedliche Vibrationsstärken)
4. Die UI (SEX-Kachel, Monatskalender, Trainingsdaten) muss klar zeigen **welches Bett** analysiert wird
5. Rückwärtskompatibilität: Einzelbett-Haushalte müssen weiter genauso funktionieren (graceful degradation)

**Mögliche Ansätze:**

**Option A — Primärbett-Konfiguration (einfachste Lösung):**
- Im System-Tab wird ein "Primärbett" definiert (Sensor-ID aus der Sensorliste)
- SexBrain analysiert ausschließlich diesen Sensor
- Andere Vibrationssensoren in anderen Zimmern werden explizit NICHT ausgewertet
- ➕ Minimal-Aufwand, kein UI-Umbau nötig
- ➖ Nur ein Bett analysiert, andere Schlafzimmer ignoriert

**Option B — Bett-Profile (mittlere Komplexität):**
- Sensorliste bekommt neues Attribut: `bedId: 'bett_1' | 'bett_2' | ...`
- Jedes Bett bekommt eigene Kalibrierung (`sexCalib_bett_1`, `sexCalib_bett_2`)
- `saveDailyHistory()` läuft die Sex-Erkennung **pro Bett** und speichert `intimacyEvents_bett_1`, `intimacyEvents_bett_2`
- SEX-Kachel zeigt aggregiert oder per Dropdown auswählbar nach Bett
- ➕ Vollständige Unterstützung aller Betten
- ➖ Signifikanter Refactor in Backend + Frontend

**Option C — Zimmer-basierte Analyse (höchste Komplexität):**
- Alle Vibrationssensoren eines Raumes werden zusammen betrachtet
- Topologie-Zuordnung: Sensor → Raum → Bewohner
- SexBrain wird zur raum- und personenbezogenen Analyse
- ➕ Natürlichste Modellierung für Mehrpersonenhaushalte
- ➖ Erfordert funktionierende personTag-Zuordnung (OC-21) + vollständige Topologie

**Empfehlung für Umsetzung:**
Kurzfristig: **Option A** als Quick-Win (Primärbett-Konfiguration im System-Tab).
Mittelfristig: **Option B** sobald mehrere Kunden aktiv Multi-Bett-Konfigurationen nutzen.
Option C ist langfristiges Ziel im Kontext der vollen Multi-Personen-Unterstützung.

**Abhängigkeiten:**
- OC-21 (personTag-Filter) — für Option C relevant
- OC-26 (Sensor-Onboarding) — Bett-Konfiguration sollte im Onboarding-Wizard erscheinen
- `sexTrainingLabels` müssen bei Option B/C auf Bett-ID erweitert werden

**Offene Fragen:**
- Wie verhindert man Fehlalarme wenn Kind im Nachbarzimmer auf dem Bett springt?
- Kann die Kalibrierung automatisch zwischen Matratzen unterscheiden (Dichte/Dämpfung)?
- Wie geht man mit temporären Situationen um (z. B. Gästebett wird nur sporadisch genutzt)?

---

### OC-26: Sensor-Onboarding-Checkliste bei neuem Sensor (29.03.2026)

**Problem / Nutzerbedarf:**
Wenn ein neuer Sensor in die Sensorliste eingetragen wird, muss der Nutzer mehrere manuelle Schritte in anderen Bereichen durchführen — vor allem die Topologie-Matrix aktualisieren. Es gibt aktuell keine Führung dafür.

**Idee: Automatische Onboarding-Checkliste**
- Sobald ein Sensor gespeichert wird (neu oder mit geänderter Funktion), prüft das System:
  1. Ist der Sensor in der Topologie-Matrix eingetragen? Falls nein → Hinweis
  2. Ist eine Funktion (Schlafzimmer/Bad/Flur/…) zugeordnet? Falls nein → Hinweis
  3. Ist der Sensor einer Person zugeordnet (Mehrpersonenhaushalt)? Falls nein → Hinweis
  4. Ist der Sensor noch nicht in der Nacht-Kalibrierung referenziert?
- Anzeige: Popup/Toast beim Speichern ODER dauerhafter "Offene Einrichtung"-Badge im System-Tab
- Alternativ: geführter Onboarding-Assistent (Step-by-Step: Sensor → Funktion → Topologie → Person)

**Relevanz:** Reduziert Einrichtungsfehler erheblich, insbesondere für Kunden ohne technischen Hintergrund. Besonders wichtig wenn AURA als Produkt verkauft wird.

**Priorität:** NIEDRIG (Nice-to-have) — Sensor-Einrichtung funktioniert ohne Assistent. Relevant erst wenn AURA als Produkt an technisch unerfahrene Kunden verkauft wird.

---

### OC-25: Kalender-gesteuerte Haushaltsgröße (29.03.2026)

**Problem / Nutzerbedarf:**
Kinder-/Gäste-Aufenthalte sind sporadisch aber planbar (z. B. Kinder kommen jeden zweiten Freitag). Die feste Config-Einstellung "Single/Couple/Familie" passt nicht zu variablen Haushaltsgrößen. Der dynamische Personenzähler ist noch zu unzuverlässig für diese Entscheidung.

**Idee: Kalender-Integration für Haushaltsgröße**
- Google Kalender (Schnittstelle bereits vorhanden für Energie-Tab) als Quelle
- Definiertes Kalender-Label (z. B. "Kinder da" oder "Gast") → schaltet Algorithmus für diese Nacht auf Mehrpersonenhaushalt-Modus
- Gilt für: `_isMultiPerson`-Flag in outsideBedEvents, ggf. auch für Schlafanalyse-Erwartungen
- Alternative: "Nacht-Profil" manuell per Override im UI setzbar (ähnlich wie Sleep-Source-Override)

**Technische Anknüpfung:** Google Calendar Adapter bereits in ioBroker eingebunden (Energie-Tab). Analog: Tages-Flag `householdSizeOverride` im State, das `this.config.householdSize` für diese Nacht überstimmt.

**Priorität:** NIEDRIG — Nice-to-have, kein akutes Problem. Erst sinnvoll wenn `_isMultiPerson`-Logik insgesamt stabiler ist.

### OC-22: Neuronales Netz für Schlafmuster-Klassifikation — Stufe 2 (26.03.2026)

> **Stufe 1 (gelernter Haus-wird-still-Prior)** ist implementiert (v0.33.79). Nur Stufe 2 ist noch offen.

#### Stufe 2 (Langfristig): Neuronales Netz für Schlafmuster-Klassifikation

Bereits in Python vorhanden sind NNs für andere Analysen. Ein weiteres kleines NN wäre denkbar:

**Input-Features (pro Nacht, pro Person):**
- Wochentag (Mo=0..So=6, sin/cos-kodiert für Zyklizität)
- Letzte Aktivität im Gemeinschaftsbereich (Uhrzeit-Delta zur aktuellen Nacht)
- Anzahl der Schlafzimmer-Events in den ersten 30 Min nach "Haus still"
- Außentemperatur (sofern vorhanden)
- Letzte 7 Einschlafzeiten (normalisiert)

**Output:**
- Geschätzte Einschlafzeit (Regression, in Minuten seit 18:00)
- Konfidenz (0.0–1.0)

**Trainings-Daten:** Alle Nächte wo FP2/Garmin eine präzise Einschlafzeit geliefert hat = Ground Truth. PIR-only-Nächte sind dann automatisch das Anwendungsfall-Szenario.

**Architektur:** Kleines MLP (2-3 Hidden Layers, je 16-32 Neuronen) — kein RNN nötig da kein Zeitreihen-Kontext innerhalb einer Nacht. Trainierbar auf PC, Modell-Gewichte als JSON in Adapter eingebettet (< 50 KB).

**Limitation:** Jeder Nutzer braucht mind. 30-50 Nächte mit FP2/Garmin-Daten um personenspezifisch zu trainieren. Cross-User-Transfer möglich aber erfordert Normalisierung auf individuelle Chronotypen.

**Verhältnis Stufe 1 zu Stufe 2:**
- Stufe 1 immer verfügbar, kein Training nötig, gut für Kunden ohne FP2
- Stufe 2 aktiviert sich automatisch sobald genug Trainingsdaten vorhanden
- Beide Stufen sind additiv: Stufe-2-Ausgabe kann Stufe-1-Prior überschreiben wenn Konfidenz höher

**Status:** Brainstorming. Stufe 1 kann nach ~3 stabilen Nächten mit v0.33.79 begonnen werden. Stufe 2 ist Langfrist-Roadmap (Phase 5+).

### OC-20: Medizinisches Profil beeinflusst Schlaf-Algorithmus (25.03.2026)

**Prinzip: Medizinischer Kontext macht Algorithmus differenzierter, NICHT dumpfer.**
Erkrankung AN = mehr Sensitivität + besseres Kontextverständnis — niemals Abschwächung.

**Schlafstörungen (Insomnie)**
- Single-Wake-Up-Erzwingung deaktivieren
- Alle nächtlichen Wachphasen erfassen + protokollieren
- Fragmentation als Hauptmetrik (statt einzelner Aufwachzeit)
- Proaktives Screening: Wenn Insomnie-Muster über mehrere Nächte erkannt
  → Hinweis "Schlafstörungen-Analyse aktivieren?" (auch ohne aktive Diagnose)
- Insomnie-Logik NICHT aktiv wenn Schlafstörungen im Med-Tab AUS ist

**Parkinson**
- Tremor-artige Nachtbewegungen NICHT ignorieren — als Symptom-Metrik tracken!
- Erhöhte Sensitivität bei Intensitätsspitzen (auffällig schwerer Tremor = Alert)
- Tremor-Verlauf über Wochen als Trending sichtbar machen

**Epilepsie**
- Plötzliche intensive Bewegungsmuster nachts flaggen
- Dauer + Intensität + Uhrzeit protokollieren (Anfalls-Tagebuch-Grundlage)
- Kein medizinisches Diagnose-Claim — reines Logging mit Disclaimer

**COPD**
- Frequenz + Dauer nächtlicher Ausflüge als Symptom-Metrik erfassen
- Trending über Wochen: verschlechtert/verbessert sich das Muster?

**Depression**
- Sehr frühes dauerhaftes Aufwachen (>2h vor üblicher Zeit, mehrere Nächte) tracken
- Als klinisches Signal in Gesundheits-Trending einbinden

**Abhängigkeit:** Return-to-Bed-Logik bereits implementiert (v0.33.75) — OC-20 baut darauf auf (Schlafstörungen-Modus senkt Rückkehr-Schwelle)

### OC-16: Schlaf-Kalibrierung gegen Garmin + Fallback ohne Wearable (24.03.2026)

**Ziel:**
- Über mehrere Tage/Wochen ermitteln, welche Sensorquelle/Sensorkombination Garmin am besten trifft.
- Daraus robuste Regeln für Nutzer ohne Garmin/Smartwatch ableiten (Zielgruppe: ältere Personen).

**✅ Implementiert (v0.33.189):**
- Kalibrierungs-Log (`analysis.health.sleepCalibrationLog`) läuft seit v0.33.183 — speichert jede Nacht alle Kandidaten + Deltas zu Garmin.
- MAE-Ranking wird ab 7 Referenz-Nächten automatisch berechnet → `analysis.health.sleepCalibrationMAE`.
- HealthTab zeigt aufklappbare "QUELLEN-GENAUIGKEIT" Sektion mit 🥇🥈🥉 Medaillen-Ranking.
- OC-30 Stufe 2 Integration: manuelle Overrides fließen als `referenceSource: 'manual_override'` ins Ranking ein (Nutzer ohne Smartwatch kalibrieren über eigene Korrekturen).

**Noch offen (Stufe 2):**
- Automatische Anpassung der Cluster-Prioritäten basierend auf MAE-Ranking (wenn fp2_vib dauerhaft besser als garmin → Prio anpassen). Aktuell nur Anzeige, keine Konsequenz für Algorithmus.

---

### OC-13: Schichtarbeiter / Tagesschläfer — konfigurierbare Schlaf-Hauptphase (22.03.2026)

**Problem:** Festes Analyse-Fenster 19:00–03:00 Uhr (Einschlafzeit) und 04:00–14:00 Uhr (Aufwachzeit) funktioniert nicht für Schichtarbeiter (z. B. Schlaf 08:00–16:00 Uhr) oder Extremfälle.

**Idee:** Neue optionale Konfigurationsoption `sleepPhase: 'night' (Standard) | 'day' | 'custom'`. Bei 'custom': Nutzer gibt Einschlafen-Fenster und Aufwachen-Fenster manuell an. Die aktuellen Stunden-Schwellen (18, 3, 4, 14) wären dann Offsets relativ zur konfigurierten Phase.

**Abhängigkeiten:** OC-7-Schlafphasen-Algorithmus, sleepWindowCalc, sleepWindowMotion. Alle drei müssen die angepassten Schwellen respektieren.

**Status:** Brainstorming; Umsetzung nach Kundenbedarf.

---

### OC-12: Sensor-Liefernachweis / „wirklich offline" vs. „nur still" + UI-Hinweis (22.03.2026)

**Ausgangslage (Problem):**
- Ziel: **regelmäßig prüfen**, ob konfigurierte Sensoren **weiterhin Daten liefern**, und dem Nutzer **in der UI** einen klaren Hinweis geben (nicht nur Pushover).
- Es gibt bereits **einen Algorithmus** und **Pushover** bei Ausfall — in der Praxis: bei **Gateway-/Zigbee-Ausfall** kam **keine** sinnvolle Warnung; dafür **viele False Positives** („Sensor ausgefallen"), weil keine Bewegung ≠ Geräteausfall.

**Hypothese / Richtung:**
- Statt nur **Flanken / Bewegungs-States**: zusätzlich **Heartbeat-States** auswerten: `available`, Linkqualität, Batterie (periodisch aktualisiert), RSSI — je nach Gerät.
- **Alias-Problem:** Wenn nur Aliase auf Bewegungsobjekte zeigen, fehlen Meta-States für Health-Checks → optional **zweites Feld** „Health-State" pro Gerät oder Discovery der nativen Device-ID.
- **Gateway-Ausfall erkennen:** Wenn alle Kinder eines Gateways gleichzeitig ausfallen → UI-Banner: *„Seit HH:MM keine Daten von Zigbee-Geräten — Analysen können unvollständig sein."*

**Status:** Brainstorming; Umsetzung gemeinsam mit bestehendem Sensor-Offline-Konzept (weiter unten).

---

### OC-11: Personenzähl-Heuristik — gelernte Übergangszeiten (Raum↔Raum) (21.03.2026)

**Pause / später weiter:** Nur Brainstorming festgehalten, keine Umsetzung in dieser Sitzung.

**Ausgangslage (Problem):**
- `_checkSpatialImpossibility` in `main.js`: festes **5s-Fenster**, **≥2 Hops** (BFS auf `analysis.topology.structure`) → bei schneller einzelner Bewegung **False Positive** „mind. 2 Personen“ (`currentPersonCount`, `householdType`).
- Beispiel-CSV: Schlafen↔Wohnen, WC↔Wohnen in **~2,6–3,8 s** — für eine Person in kleiner Topologie plausibel.

**Idee (Nutzer):**
- „Bewohner kennenlernen“: typische **Sekunden** für Wege (Flur, **2+ Hops**, ggf. **beliebiges Raumpaar**), nach einigen Wochen als **personalisierte Schwellen** statt Fixwert 5 s.
- Optional **neuronales Netz** in Python — Enthusiasmus für NN; abwägen gegen **einfache Statistik** (Median/Perzentile, Mindest‑n pro Paar).

**Stand im Code (Recherche):**
- **Graph-Brain / `TRAIN_TOPOLOGY`:** lernt nur **Übergangswahrscheinlichkeiten** (Matrix im Tab Sicherheit), **keine Zeiten**. `python_bridge.js` strippt vor Python sogar **`t_delta`** aus Sequenzen → Timing fließt dort nicht ein.
- **`analyze_gait_speed` (health.py):** nutzt **`t_delta`** nur für **Raum→Flur→Raum** (Ganganalyse), **nicht** an Personenzähl-Heuristik angebunden.
- **ParticleFilter:** `delta_t` mit **fester** Heuristik, nicht personalisiert gelernt.

**UI / Matrix:**
- Gleiches **Raster** wie „Gelernte Topologie“ denkbar; **Metrik trennen**: Wahrscheinlichkeit vs. Median‑Zeit (s) — **Toggle** oder **Tooltip** („P=…, typisch … s, n=…“), nicht zwei Größen blind in einer Zelle.

**Scope-Frage: nur Hops>2 vs. alle Paare:**
- Fokus **2 Hops** trifft das aktuelle Problem; **allgemein Raum→Raum** ist vollständiger → **sparse** Paare mit **Mindest‑n** + **Fallback** nach Hop‑Distanz oder globalem Default.

**„Katze beißt sich in den Schwanz“ (Einpersonen-Lernen vs. Mehrpersonen-Erkennung):**
- Kein harter Zirkelschluss, wenn **getrennt:** (A) **Kalibrierung** „typische Ein‑Person‑Geschwindigkeit“ nur aus **relativ sauberen** Phasen (kohärente Sequenzen, lange Zeit kein Multi‑Treffer, ggf. Nacht/ruhige Fenster, schwache Labels); (B) **Momentanentscheidung** weiter aus **mehreren Quellen** (Config, FP2, Heuristik, WLAN, …).
- Bei **dauerhaft Mehrpersonenhaushalt:** Verteilungen werden breiter — dann **Updates drosseln/einfrieren**, letzten guten Ein‑Person‑Stand behalten; Erwartung realistisch halten.

**Empfohlene Phasierung (Konsens aus Diskussion):**
1. **Phase 1:** `t_delta` in Trainingspfad **mitgeben**, **empirische** Zeiten pro Paar / Hop‑Bucket, Integration Personenzähl‑Heuristik (statt/fix 5 s).
2. **Phase 2:** falls Kontext nötig (Tageszeit, …) — **kleines NN oder Boosting** zusätzlich, nicht als Ersatz für interpretierbare Basis‑Matrix.

**Offen:** konkrete Schwellen, Mindest‑n, Filter für „Lernen erlaubt“, Abhängigkeit zu OC-3 (Personenzählung).

### OC-6: WLAN-Präsenzerkennung für Personenzählung (17.03.2026)

**Idee:** `cogni-living.0.system.presenceWho` — der Adapter kann bereits heute WLAN-Geräte (Smartphones) erkennen und daraus ableiten welche Personen zu Hause sind. Das könnte direkt zur Personenzählung beitragen:

- Wenn 2 Smartphones im WLAN → `currentPersonCount >= 2`
- Wenn 0 Smartphones → `currentPersonCount = 0` (niemand zu Hause)
- Fallback wenn WLAN-Daten nicht vorhanden: Bewegungsmelder-Heuristik (OC-3 Stufe 2)

**Status:** Vorhanden aber noch nicht mit Personenzählung verknüpft. Muss in einem späteren Schritt aktiviert und priorisiert werden.

**Priorität:** Mittel — erst implementieren wenn OC-3 Stufe 2 stabil läuft

---


### OC-3: Hardware-Personenzähler — Stufe 3 (16.03.2026)

> **Stufen 1 (statische Konfiguration, v0.33.21) und 2 (räumliche Unmöglichkeit, v0.33.22)** sind implementiert. Nur Stufe 3 ist noch offen.

#### Stufe 3 — Hardware-Personenzähler (langfristig)
- **FP2 via Matter**: ioBroker Matter-Adapter könnte Zonen-Daten liefern (muss getestet werden)
- **Tuya mmWave-Sensoren**: Einige Modelle berichten „target count" (Verlässlichkeit unklar, zu verifizieren)
- **Kein DIY**: LD2450-Platine o.ä. scheidet aus (kein fertiges verkaufbares Produkt)

**Algorithmus-Konsequenzen je Person-Anzahl:**
| Modus | Verhalten |
|---|---|
| 0 Personen | Adapter passiv, keine Alarme |
| 1 Person | Alle Algorithmen normal |
| 2+ Personen | Nykturie-Zählung unsicher (⚠️ Hinweis), Bewegungsprofile gemischt, Krankheitserkennung eingeschränkt |

---

---

### OC-1: Multi-Sensor-Schlafzimmer — PIR vs. FP2 vs. Vibration vereinheitlichen (16.03.2026)

**Problem:** Drei verschiedene Sensoren liefern Schlaf-relevante Daten:
- **PIR** (Bewegungsmelder): erkennt ob jemand das Zimmer betritt/verlässt (NACHT-UNRUHE in Drift)
- **FP2 Bett-Zone**: erkennt Belegung der Bettzone (BETT-PRÄSENZ, Schlaffenster)
- **Vibrationssensor am Bett**: erkennt Bewegungen im Bett (SCHLAF-UNRUHE, VIBRATIONS-INTENSITÄT)

**Offene Fragen:**
- Soll es eine kombinierte "Schlaf-Qualitäts-Kachel" geben die alle drei vereint?
- Progressive Enhancement: Algorithmus soll mit jedem verfügbaren Sensor arbeiten,
  genauer werden wenn mehr Sensoren vorhanden sind, aber NICHT stoppen wenn optionale fehlen.
- Bei anderen Kunden koennte FP2-Zonen-Konfiguration anders sein

**Idee:** Stufenweiser "Schlaf-Score":
- Nur PIR → grober Score (Nacht-Bewegungen)
- PIR + FP2 → mittlerer Score (Bettzeit + Bewegungen)
- PIR + FP2 + Vibration → detaillierter Score (inkl. Intensität)

---

## 📐 ARCHITEKTUR-ENTSCHEIDUNGEN & KONZEPTE

## Offenes Konzept: Auto-Discovery Verbesserung (FP2 / HomeKit-Controller)

### Problem (Stand: 15.03.2026)
Der aktuelle Auto-Discovery-Wizard erkennt keine Sensoren vom HomeKit-Controller-Adapter.
FP2-Sensoren (Aqara Presence Sensor FP2) werden dort als `sensor-occupancy-XXXX.occupancy-detected`
abgelegt — das Schema wird vom Discovery-Algorithmus nicht erkannt.

Ausserdem fehlt fuer den FP2 die automatische Typ-Zuweisung "Praesenz-Radar (FP2)".

### Gewuenschtes Verhalten
- Auto-Discovery soll zusaetzlich nach folgenden Mustern suchen:
  - `*.occupancy-detected` (HomeKit FP2)
  - `*.occupancy` (generische Homekit-Praesenz)
  - Adaptername `homekit-controller.*`
- Gefundene Sensoren sollen automatisch Typ "presence_radar" zugewiesen bekommen
- Der zugehoerige `.value`-State (Personenzahl) soll ebenfalls erkannt und verlinkt werden
- Bekannte "Allgemeiner Status Anwesend"-Zonen sollen als Typ "motion" (boolean) eingetragen werden,
  nicht als presence_radar, da sie keine Personenzahlung liefern

### Zonenstruktur des FP2 (wie im HomeKit-Controller)
```
sensor-occupancy-2688 → "Allgemeiner Status Anwesend"  → nur true/false, KEIN value-Count
sensor-occupancy-2692 → "Zone Wohnzimmer"              → value = Personenzahl (0,1,2...)
sensor-occupancy-2696 → "Zone Buero"                   → value = Personenzahl
sensor-occupancy-2700 → "Zone Essen"                   → value = Personenzahl
sensor-occupancy-2704 → "Zone Kueche"                  → value = Personenzahl
```
Empfehlung: Nur die benannten Zonen als presence_radar eintragen (liefern Personenzahl).
Den "Allgemeiner Status Anwesend"-Kanal NICHT als FP2 eintragen, da er keine Personenzahl liefert.

### Priorisierung
Kein zeitlicher Druck — erst relevant wenn wir mehr Kunden-Installationen skalieren.
Bis dahin: manuelle Konfiguration in der Sensortabelle.

---
## Offenes Konzept: Sensor-Konfiguration (Typ + Funktion)

### Problem
Die aktuelle Sensor-Tabelle hat zu viele einzelne Checkboxen (isHallway, isBathroom,
isKitchenSensor, isFP2Bed, isFP2Living, isVibrationBed...). Das skaliert nicht fuer
Tausende von Kunden mit unterschiedlichen Setups.

### Loesungsansatz: Typ + Funktion-Spalte

Statt vieler Checkboxen: **eine "Funktion"-Dropdown-Spalte** neben dem bestehenden Typ.

| Funktion | Ersetzt bisherige Flags |
|---|---|
| Allgemein | (kein Flag) |
| Flur/Gang | isHallway |
| Bad/WC | isBathroomSensor |
| Kueche | isKitchenSensor |
| Bett/Schlafen | isFP2Bed + isVibrationBed |
| Wohnbereich | isFP2Living |
| Ausgang | isExit |

Orthogonale Flags bleiben als Checkbox: isNightSensor, isSolar, logDuplicates, isExit.

### Capability-Matrix: Typ x Funktion => freigeschaltete Analyse

| Typ | Funktion | Freigeschalten |
|---|---|---|
| Bewegung | Flur | Ganggeschwindigkeit |
| Bewegung | Bad/WC | Nykturie-Zaehlung |
| Bewegung | Kueche | Essrhythmus (Diabetes T2, Depression) |
| Praesenz-Radar | Bett | Liegezeit + Personenzaehlung Schlafzimmer |
| Praesenz-Radar | Wohnbereich | Personenzaehlung Hauptraum |
| Vibration | Bett | Schlafunruhe, Parkinson-Tremor |
| Feuchtigkeit | Bett | Inkontinenz/UTI |
| Temperatur | Allgemein | Thermodynamik (PINN) |

### Darstellung im Medical Tab
Profile werden nicht gesperrt, sondern zeigen Sensor-Bereitschaft:
```
[Schlafstoerungs-Score]  Aktiv
  Sensor-Bereitschaft: 67%
  OK  Basis-Schlaf (Bewegung Bett/Schlafzimmer)
  OK  Liegezeit    (Praesenz-Radar Bett)
  --  Schlafunruhe -- Vibrationssensor Bett fehlt (optional)
```
Profiles laufen immer mit dem was verfuegbar ist (progressive enhancement).

### Noch nicht geloest / offene Fragen
- Wann exakt Typ+Funktion in Code umsetzen? (bisherige Flags funktionieren noch)
- Migration: bestehende Kunden-Configs die Flags haben muessen konvertiert werden
- Reihenfolge: erst alle Phase 4-6 Features umsetzen, dann Refactoring?

---

## Offenes Konzept: Mehrpersonenhaushalt & Belegungserkennung

### Das Problem
Haushalte sind nicht statisch:
- Manchmal allein, manchmal mit Kindern (50/50)
- Manchmal Freundin da
- Kinder haben eigene Zimmer â†’ manche Raeume IMMER nur 1 Person

Ein globaler "Einpersonen/Mehrpersonen"-Schalter ist zu grob.

### Ansatz 1: Raum-spezifische Belegungserkennung (bevorzugt)

Jedes Krankheitsprofil deklariert welche "Sensor-Zone" es beobachtet.
Nur wenn IN DIESER ZONE Mehrpersonenbelegung erkannt wird â†’ Warnung.

Beispiele:
- Schlafstoerungs-Profil â†’ Zone: Bett â†’ FP2 Bett zeigt value=2 â†’ Warn-Symbol
- Ganggeschwindigkeit â†’ Zone: Flur â†’ Flur zeigt 2 Personen â†’ Analyse pausiert
- Nykturie â†’ Zone: Bad â†’ Bad fast immer 1 Person â†’ laeuft normal

Schlafzimmer und Bad: meist Privatbereich â†’ laufen ungestoert auch wenn Kinder im Haus
Wohnzimmer, Flur, Kueche: koennen von mehreren belegt sein â†’ robustere Analyse noetig

### Ansatz 2: Zwei-Baseline-Modell (fuer Health-Algorithmus)

FP2 kennzeichnet jeden Tag automatisch:
- "Allein-Tag" (max_persons_detected <= 1) â†’ Kalibrierungs-Baseline
- "Mehrpersonen-Tag" (max_persons_detected >= 2) â†’ hoeherer Rausch-Schwellwert

Das System lernt von Allein-Tagen und analysiert auch Mehrtage,
aber mit angepasster Toleranz. Kein manueller Schalter noetig.

### Pushover-Benachrichtigung bei Mehrpersonenbelegung
Idee: Wenn ein kritisches Krankheitsprofil (z.B. Epilepsie, Sturzrisiko) gerade nicht
analysiert werden kann weil die relevante Zone mehrfach belegt ist:
- Warn-Symbol im Medical Tab
- Optional: Pushover an Angehoerige "Schlafueberwachung Opa unterbrochen - Besucher erkannt"


### Geloest: 2-FP2-Loesung (14.03.2026)

Nur 2 FP2 noetig (Wohnzimmer + Schlafzimmer). Zwei-Ebenen-Logik:

- **Wohnzimmer-FP2** = Haus-Belegungsmelder (value >= 2 -> jemand sonst zu Hause)
- **Schlafzimmer-FP2** = Persoenliche Zone (value = 1 -> Bett-Analysen immer valid)

| Situation | WZ-FP2 | SZ-FP2 | Ergebnis |
|---|---|---|---|
| Allein | 1 | 1 | Alles normal |
| Kinder im WZ, du schlaefst | 2 | 1 | Schlaf: normal, Flur/Kueche: +Toleranz |
| Freundin schlaeft mit | 1 | 2 | Schlafanalyse: Warnsymbol |
| Alle wach, alle da | 2 | 1 | Nur SZ-Analysen voll zuverlaessig |

Raeume OHNE FP2 (Flur, Kueche, Bad): laufen bei Mehrpersonenbelegung mit
erhoehtem Rausch-Schwellwert weiter -- sie stoppen NICHT.
Dritter FP2 nicht noetig.
### Noch nicht geloest
- Wie "Zone" eines Profils konfigurieren? Automatisch (aus Sensor-Funktionen) oder manuell?
- Schwellwert: ab wann ist eine Zone "mehrfach belegt"? value >= 2 des FP2?
- Was wenn kein FP2 vorhanden? Dann kein Mehrpersonenschutz moeglich.

---

## Offenes Konzept: Multi-Raum Sensor-Zuordnung

### Szenario
Schlafzimmer 1: PIR + Vibration (Funktion=Bett) â†’ erweitertes Schlaf-Monitoring
Schlafzimmer 2: nur PIR (Funktion=Bett) â†’ nur Basis-Schlaf-Monitoring

### Aktuelle Loesung (einfach)
Das System nutzt ALLE Sensoren gleicher Funktion zusammen.
Progressive Enhancement: hoechste verfuegbare Capability gewinnt.
Vibration in Zimmer 1 schaltet Schlafunruhe-Analyse frei â†’ gilt fuer ganzen Tag.

### Spaetere Loesung (komplex, Phase 8+): "Person"-Tag
Optionales Freitextfeld "Zugehoerige Person" am Sensor:
- Vibration â†’ Person: "Opa" (Schlafzimmer 1)
- PIR Schlafzimmer 2 â†’ Person: "" (nicht ueberwacht)
Dann: separate Analyse pro Person-Tag.
NICHT fuer MVP â€” erst wenn konkreter Kundenbedarf.

---

## Geplante Phasen-Uebersicht

### Phase 4 (DONE v0.33.3) â€” FP2 + Vibration
- Sensortypen presence_radar + vibration
- Flags isFP2Bed, isFP2Living, isVibrationBed
- sleepDisorder Score
- maxPersonsDetected im Snapshot

### Phase 5 â€” Wassersensor + UTI/Inkontinenz-Profil
- Sensortyp moisture, Flag isMoistureBed
- Neues Profil: uti (Harnwegsinfektion) oder incontinence
- State-Pfad: zigbee.0.00158d000b7e8275

### Phase 6 â€” Garmin-Uhr (cardiovascular + sleep)
- Garmin Connect API oder iobroker.garmin Adapter
- Metriken: Ruhe-HF, HRV, SpO2, Schlafphasen, Stress, Atemfrequenz
- Neue Profile: cardiovascular (vollstaendig), praeziserer COPD Score

### Phase 7 â€” Occupancy Tracker
- Dedizierter FP2 im Wohnzimmer/Flur fuer Personenzaehlung
- Zwei-Baseline-Modell automatisch
- Pushover bei Ueberwachungs-Unterbrechung

### Phase 8 â€” Sensor-Tabellen-Refactoring (Typ + Funktion)
- Checkboxen durch Funktion-Dropdown ersetzen
- Migration bestehender Kunden-Configs
- Voraussetzung: alle Phase 5-7 Features umgesetzt

### Phase 9+ â€” Personenprofile (Multi-Person Monitoring)
- Separate Analyse pro "Person"-Tag
- Erfordert: Occupancy Tracker (Phase 7) als Basis

---

## Krankheitsbild-Matrix (offizielle Referenz)

> **Vollständige Tabelle** (Entwicklungsstand, Angehörigen-Push, alle 14+ Profile):  
> **`_internal/KRANKHEITSBILD-MATRIX.md`**  
> Wissenschaftliche Quellen: **`_internal/LITERATUR.md`**  
> Benutzer-Bedienung (App, Push einrichten): **`HANDBUCH.md`** → Gesundheitsüberwachung für Angehörige

---

## Markt-Priorisierung: Krankheitsbilder

### Einpersonenhaushalt (Score 0-100)

| Krankheitsbild | Score | Begruendung |
|---|---|---|
| Sturzrisiko | 97 | Haeufigste Todesursache >65, Pflegerisiko |
| Demenz-Monitoring | 94 | 1,8 Mio in DE, Angehoerige zahlen viel |
| Frailty-Syndrom | 88 | Fruehwarnung vor Pflegebeduerftigkeit |
| Depression | 82 | 5 Mio in DE, oft unerkannt bei Aelteren |
| Diabetes Typ 2 | 79 | 8,5 Mio in DE, passiv gut erkennbar |
| Schlafstoerungs-Monitoring | 76 | Hohe Zahlungsbereitschaft |
| Kardiovaskulaer | 74 | Mit Wearable gut erkennbar |
| COPD | 68 | Haeufig bei Rauchern 60+ |
| Parkinson | 65 | Vibrationssensor erlaubt passive Erkennung |
| Soziale Isolation | 62 | Wachsendes Bewusstsein nach COVID |
| Harnwegsinfekt/Inkontinenz | 58 | Wassersensor einzigartig |
| Post-OP Rekonvaleszenz | 55 | Zeitlich begrenzt aber lukrativ |

### Mehrpersonenhaushalt (Score 0-100, reduziert wegen Erkennbarkeit)

| Krankheitsbild | Einzel | Mehrpersonen | Differenz |
|---|---|---|---|
| Sturzrisiko | 97 | 78 | -19 |
| Demenz-Monitoring | 94 | 55 | -39 |
| Frailty | 88 | 61 | -27 |
| Schlaf | 76 | 72 | -4 (Schlafzimmer privat) |
| Nykturie/Diabetes | 79 | 74 | -5 (Bad meist privat) |

---

## Sensor-Hardware Empfehlungen (fuer Kunden)

### Basis-Set (minimale Erkennung)
- PIR Sensoren in allen Raeumen (Bewegung)
- Tuer/Fensterkontakt am Hauseingang (isExit)
- 1x PIR im Flur (isHallway, Ganggeschwindigkeit)
- 1x PIR im Bad (Funktion=Bad, Nykturie)

### Erweitertes Set (empfohlen)
- + Aqara FP2 im Schlafzimmer (Liegezeit, Personenzaehlung)
- + Aqara FP2 im Wohnzimmer (Personenzaehlung)
- + Vibrationssensor am Bett (Schlafunruhe, Tremor)
- + PIR in Kueche (Funktion=Kueche, Essrhythmus)

### Premium Set
- + Wassersensor am Bett (Inkontinenz, UTI)
- + Garmin-Uhr (cardiovascular, SpO2, HRV)
- + CO2-Sensor (Lueftungsanalyse)

---

## Architektur-Entscheidungen (gefallen)

- **Backend**: Node.js main.js ist Einstiegspunkt (nicht lib/main.js)
- **Python Bridge**: stdin/stdout JSON-RPC (nicht REST, nicht Websocket)
- **Build**: Vite baut nach admin/ (nicht src-admin/build/) -- seit v0.31.3
- **Sensor-Flags**: aktuell noch Checkboxen, geplant: Funktion-Dropdown (Phase 8)
- **FP2 Integration**: ueber homekit-controller Adapter (nicht Matter, nicht Aqara Cloud)
- **Versionierung**: jede GitHub-Upload bekommt eigene Patch-Version

---

## Geplant: Sensor-Ausfall-Benachrichtigung

Wenn ein Sensor laenger als X Stunden kein Event liefert (Batterie leer, ausgefallen,
Verbindungsproblem) soll folgendes passieren:
- Dashboard: rotes Warn-Symbol am betroffenen Sensor in der Sensor-Liste
- Nuukanni/Familienansicht: Hinweis "Sensor [Name] seit HH:MM inaktiv"
- Pushover: Push-Benachrichtigung an konfigurierten Empfaenger

Schwellwert: konfigurierbar pro Sensortyp (z.B. PIR: 6h, Tuer: 24h, Temperatur: 2h)
Implementierung: Scheduler prueft taeglich/stuendlich lastSeen pro Sensor-ID
State: events.lastEvent enthaelt timestamp -> Differenz zu jetzt berechnen

Prioritaet: Mittel -- wichtig fuer Produktreife, nicht zeitkritisch

---

## Offene Frage: Ganggeschwindigkeit bei mehreren Fluren

### Aktueller Stand (implementiert)
Der Algorithmus in main.js/health.py nutzt ALLE Sensoren mit Flag isHallway.
Transit = Zeit zwischen nicht-Flur -> Flur -> nicht-Flur (1-20 Sekunden).
Alle Transits aus allen Fluren fliessen in den Median ein.

### Das Problem
Bei 3 Fluren (EG, OG, KG) haben diese ggf. sehr unterschiedliche Laengen.
Ein kurzer Flur (2m) liefert andere Transitzeiten als ein langer (8m).
Der gemeinsame Median ist dann wenig aussagekraeftig.

### Loesungsansatz (noch nicht implementiert)
Jeder Flur-Sensor bekommt eine optionale "Flur-Laenge" in Metern.
Die Ganggeschwindigkeit wird dann normiert: m/s = Laenge / Transitzeit.
Sensoren ohne Laengenangabe liefern nur Transitzeit (wie bisher).
Dies wuerde eine neue optionale Textspalte "Laenge (m)" im Sensor-Tab erfordern.

Alternativ: Konfiguration welcher Flur-Sensor als "Haupt-Gangweg" gilt.

Prioritaet: Niedrig -- aktueller Median-Ansatz ist fuer Trend-Erkennung ausreichend

---

## Produktstrategie: Paketierung fuer Kunden

Quelle: Diskussion 13-14.03.2026

| Paket | Sensorik | Zielgruppe | Krankheitsbilder | Preis Sensorik |
|---|---|---|---|---|
| Safe Home Basic | PIR + Tuer/Fensterkontakte | Alleinlebende Senioren | Sturzrisiko, Demenz, Frailty | ~150-200 EUR |
| Safe Home Premium | + 2x FP2 | Seniorenpaare, Familien | + Schlaf, Personenzaehlung | ~400-500 EUR |
| Safe Home Family | FP2 Kinderzimmer + Vibration | Eltern kranker Kinder | Epilepsie, Diabetes T1, ADHS | ~75-100 EUR |
| Safe Home Complete | Full-Stack | Pflegdienste, Kliniken | Alle 23 Profile + Screening | ~800+ EUR |

B2B-Kanal: Pflegekassen koennen bis 4.000 EUR bezuschussen (SS40 Abs. 4 SGB XI)
"Wohnumfeldverbessernde Massnahmen" -- AURA passt in diese Foerderkategorie.

---

## Krankheitsprofile: Noch nicht implementiert

Profile die im Frontend konfigurierbar aber in health.py noch ohne Score sind:

| Profil | Benoetigt neu | Aufwand | Prioritaet |
|---|---|---|---|
| parkinson | Vibration (Tremor), Gait-Variabilitaet | Mittel | Hoch (Vibration jetzt vorhanden) |
| copd | Lueftungs-Aktivitaets-Korrelation | Klein | Mittel |
| cardiovascular | Wearable (HRV, SpO2) ODER Nykturie+Aktivitaet | Mittel-Gross | Mittel (Garmin Phase 6) |
| longCovid | PEM-Erkennung (Boom-Bust: hoher Aktivitaetstag -> Einbruch Folgetag) | Klein | Mittel |
| bipolar | Wie Depression aber mit Manie-Detektion (Nacht sehr niedrig + Tag sehr hoch) | Klein | Niedrig |
| epilepsy | Vibration Bett (rhythmische Bewegung) + FP2 Sturz | Mittel | Hoch (Hardware vorhanden) |
| diabetes1 | Vibration + Feuchtigkeit + Nacht-Kueche | Mittel | Mittel |
| diabetes1 (CGM) | **Nightscout/AAPS** — siehe **OC-50** (VIS live, AURA offen) | Mittel | Hoch (eigener Pilot) |
| uti | Akut-Erkennung Bad-Besuche (Tag-zu-Tag statt Wochen-Trend) | Klein | Niedrig |

### Parkinson - Naechster sinnvoller Schritt
Vibrationssensor ist jetzt im System (isVibrationBed). Fuer Parkinson-Score benoetigt:
- strength-Wert aus Vibration (Tremor-Intensitaet) -> health.py: nightVibrationStrength
- Gait-Intra-Tag-Variabilitaet (SD der Transitzeiten, nicht nur Median)
- main.js: strength-Wert aus zigbee.0.00158d008bc16ddd.strength in Snapshot aufnehmen

### Vibrationssensor: strength-Wert (16.03.2026 - Nutzerdaten)
**Beobachtung:** Aqara Vibrationssensor am Bett liefert zwei relevante States:
- `*.vibration` (oder aehnlich): boolean, Vibration erkannt ja/nein
- `*.strength`: numerisch (5-131 in Testnacht), Intensitaet der Vibration

**SQL-Export einer Nacht (16.03.):**
- strength: 33 Events 23:14-07:33, Werte 5-131 (Peaks 131, 90, 65)
- vibration detected: 50+ true/false-Wechsel in derselben Nacht

**Nutzen fuer Analysen:**
- nightVibrationCount: bereits implementiert (zaehlt Events)
- nightVibrationStrength: NEU - Durchschnitt/Peak der strength-Werte pro Nacht
  - Parkinson-Tremor: erhoehte strength bei geringer Bewegung
  - Schlafqualitaet: viele hohe Peaks = unruhiger Schlaf
  - Epilepsie: rhythmische strength-Muster

**Implementierung:** State-Pfad fuer strength muss in Sensor-Config oder automatisch erkannt werden
(z.B. gleiche Device-ID + .strength statt .vibration). Noch nicht priorisiert.

**Hinweis Sensor-ID:** Aqara Zigbee-Vibrationssensor hat typischerweise `.vibration` (boolean) und `.strength` (Zahl).
Falls `.vil` konfiguriert ist: pruefen ob der State existiert und Events liefert - ggf. auf `.vibration` wechseln.

### Long-COVID - PEM-Erkennung
Boom-Bust-Muster: Tag T hat activityPercent > 120% Baseline
Tag T+1 hat activityPercent < 60% Baseline
Ueber 3+ solche Paare in 30 Tagen = Long-COVID-Signal
Algorithmisch einfach, da activityPercent bereits im Digest vorhanden.

---

## Weitere Sensortypen (noch nicht integriert)

| Sensor | Protokoll | Preis | Krankheitsbilder | Produkt-Beispiel |
|---|---|---|---|---|
| Smarte Waage | WiFi/BLE | 30-80 EUR | Herzinsuffizienz (Oedeme), Niereninsuff., Essstoerungen | Withings Body+ |
| CO2-/VOC-Sensor | Zigbee/WiFi | 30-60 EUR | Schlafqualitaet (CO2>1000ppm=schlechter Schlaf), COPD | Aqara TVOC |
| Luftdruck/Barometer | Zigbee | 20-40 EUR | Schmerzsyndromen (Wetter-Korrelation), Migraene | In Multisensoren enthalten |
| Kuehlschrank-Kontakt | Zigbee | 10-15 EUR | Essstoerungen, Demenz, Diabetes | Aqara Door Sensor |
| Medikamentenschrank | Zigbee | 10-15 EUR | Demenz (Medikamenten-Compliance) | Aqara Door Sensor |
| dB/Laermsensor | WiFi | 30-50 EUR | Epilepsie (iktaler Schrei), Sturzgeraeusch, Husten (COPD) | ESP32 DIY |
| Stuhl/Sofa-Druck | Zigbee/DIY | 20-40 EUR | Sitzzeit-Monitoring, Frailty | Druckmatte + Relay |

---

## Langfristig: Multi-Target Particle Filter

Aktueller tracker.py: 1000 Partikel fuer EINE Person
Erweiterung: N Personen = N x 1000 Partikel (PHD-Filter / Multi-Target)

Voraussetzungen:
- FP2 muss Personenzahl zuverlaessig liefern (value=2 -> 2 Personen aktiv)
- Person-ID-Tracking noetig (FP2 kann Zonen aber nicht persistente IDs liefern)

Nutzen: Aktivitaetsvektoren werden personenspezifisch -> Demenz/Frailty auch
        im Mehrpersonenhaushalt hochqualitativ erkennbar

Aufwand: Gross (2-4 Wochen Entwicklung)
Prioritaet: Phase 9+ -- erst wenn FP2 stabil laeuft und Kundenbedarf bestaetigt

---

## Verweis auf PROJEKT_STATUS.md
Fuer konkrete Deploy-Schritte, Versionshistorie und implementierte Features:
â†’ PROJEKT_STATUS.md



---

### OC-31: Event-Sequenz-Filter / Nacht-Aufstehen-Erkennung (21.04.2026)

**Problem:** Der Cluster-Algorithmus ist "kontext-blind" — ein kurzes nächtliches Aufstehen (Toilettengang, Medikament etc.) generiert Motion-Events, die fälschlich als neue Einschlafzeit interpretiert werden. Robert-Beispiel: schläft ab 21:30, steht 02:44 kurz auf → Algorithmus wählt 02:46 als Einschlafzeit.

**✅ Stage 1 implementiert (v0.33.191) — Regelbasierter Nacht-Aufstehen-Filter:**

Innerhalb `computePersonSleep()`:
- Scannt alle Motion-Events im Schlaffenster auf Abgang+Rückkehr-Muster
- Abgang: Sensor außerhalb Schlafzimmer ≤4 Hops (ohne personTag-Filter — Shared-Sensoren eingeschlossen)
- Rückkehr: Sensor in bedroomLocations der Person innerhalb 20 Min
- Kandidaten prio ≥ 4 in erkannten Fenstern werden aus Pool entfernt
- Garmin/FP2/vib_refined (prio ≤ 3) bleiben immer erhalten
- Ergebnis: `nachtAufstehenEvents` im JSON + Debug-Badge in HealthTab

**Stage 2 — Zustandsmaschine (✅ implementiert v0.33.194):**

Zustände: `SCHLAFEN → AUFGESTANDEN → ZURÜCKGEKEHRT → SCHLAFEN`

Implementierung in `computePersonSleep` als `_smWakePhases`-IIFE:
- Scannt alle `isMine`-Motion-Events nach `sleepStart`
- Erster Outside-Sensor (nicht in bedroomLocations) = Abgang
- Erster Inside-Sensor (in bedroomLocations) = Rückkehr
- Mindestdauer 5 Min → Wake-Phase `{type:'wake', start, end, durationMin, source:'sm_stage2'}`
- `sleepStart` bleibt unveränderlich eingefroren
- Ergebnis: `smWakePhases`-Array im Snapshot + gelbe Overlay-Blöcke im Schlafbalken

Zusatz: **`bedEntryTs`** (v0.33.194, verbessert v0.33.198): erkennt den Zeitpunkt "Person geht ins Bett" vor dem eigentlichen Einschlafzeitpunkt. Ab v0.33.198 **Cluster-basiert** — frühstes Sensor-Event (fp2/fp2_vib/vib_refined/motion_vib) das maximal 90 Min vor der Einschlafzeit liegt. Verhindert Fehlauslösungen (z.B. FP2 kurz für 31s vor 3h, lange vor dem echten Einschlafen). Visualisiert als gelbes Vor-Segment und "🛏 HH:MM"-Label im Balken. ✅ Implementiert v0.33.198

Vorteil gegenüber Stage 1: Erkennt auch komplexere Muster (mehrfaches Aufstehen, Person schläft in anderem Zimmer ein).

**Stage 3 — Gelerntes Modell / LSTM / HMM (Langfrist-Roadmap):**

Benötigt Trainingsdaten: Event-Sequenzen + Ground-Truth (manuell annotiert oder aus OC-16 MAE-Kalibrierung).

Modell-Optionen:
- **HMM** (Hidden Markov Model): Geringer Datenbedarf, interpretierbar, gut für diskrete Zustände
- **LSTM**: Lernt zeitliche Muster, besser für komplexe Sequenzen, braucht mehr Daten
- **Rule-Mined**: Zuerst Stage 1+2 für 50+ Nächte laufen lassen → Muster analysieren → LSTM trainieren

Keine unmittelbare Umsetzung — erst wenn OC-16 Kalibrierung 7+ Nächte gesammelt hat.

---

### OC-32: Topologie-Matrix sensor-aware machen (21.04.2026)

**Problem:** Die aktuelle Topologie-Matrix `analysis.topology.structure` ist rein raum-basiert. BFS zählt Hops zwischen Räumen unabhängig davon, ob der Durchgangsraum einen Bewegungsmelder hat.

**Konkretes Beispiel:**
```
Schlafzimmer → Flur (kein PIR) → Wohnzimmer (PIR)
```
Hop-Distanz Schlafzimmer → Wohnzimmer = 2 (korrekt).
Aber: Wenn wir nach "nächstem Sensor" suchen, gibt es keinen auf Hop=1 (Flur).

**Auswirkungen heute:**
- `_roomHopDistance()` funktioniert korrekt für Raum-Hops (BFS, unabhängig von Sensoren)
- OC-31 Stage 1 filtert auf Hop ≤ 4 — Räume ohne Sensoren werden "übersprungen" (korrekt für Topology-BFS)
- Problem tritt auf wenn man wissen will "welche Sensoren sind maximal N echte Schritte entfernt" (physisch, nicht topologisch)

**Lösungsansatz:**
- Sensor-aware BFS: Beim Durchsuchen der Topologie nicht nur Räume, sondern auch ob der Raum Sensoren enthält
- Neues Konzept: `hopToNearestSensor(roomA, sensorType)` — gibt Distanz zum nächstgelegenen Sensor eines Typs zurück
- Alternative: Sensor-Liste um `topologicalHopFromBedroom` pre-cachen beim Adapter-Start

**Priorität:** MITTEL — betrifft OC-31 Stage 2, Person-Counting (OC-3/OC-11). Aktuell kein kritischer Bug.

---

### Architektur-Hinweis: Hop-Lücken in der Topologie-Matrix (21.04.2026)

**Faustregel für alle Hop-basierten Algorithmen:**

BFS in `_roomHopDistance()` arbeitet auf Raum-Adjacency, nicht auf Sensor-Adjacency. Das bedeutet:
- Räume ohne Bewegungsmelder zählen trotzdem als Hop (sie "existieren" topologisch)
- Beispiel: Schlafzimmer → Flur (kein PIR) → Bad (PIR): Bad hat Hop=2, korrekt
- Konsequenz: Beim Filtern nach Hop ≤ N immer großzügig wählen (N=3-4), damit keine echten Sensoren ausgeschlossen werden, die durch "stille" Transiträume führen
- Anti-Pattern: N=1 setzen wenn eine typische Hausstruktur Flure/Verbindungsräume hat

**Für OC-31:** Hop-Limit = 4 gewählt — deckt Schlafzimmer + Flur + Bad + Übergangszimmer ab, ohne Keller/Garage einzubeziehen.

---

### Architektur-Hinweis: FP2 → "Radar" umbenennen (22.04.2026)

**Problem:** Der Begriff "FP2" stammt vom Aqara FP2-Sensor (Produktname). Im Code, in der UI und in gespeicherten JSON-Daten tauchen die Quellennamen `fp2` und `fp2_vib` überall auf. Mit dem Shelly Presence Gen4 und anderen mmWave-Radar-Sensoren passt dieser Produktname nicht mehr.

**Gewünschtes Ziel:** Nutzer sehen in der UI "Radar" oder "Radar + Vibration" statt "FP2".

**Empfehlung für die Umsetzung:**

- **Intern (Code, JSON, ioBroker-States):** Keys `fp2` / `fp2_vib` beibehalten. Eine Umbenennung würde alle bestehenden JSON-History-Dateien und Kalibrierungsdaten unlesbar machen (alte Nächte würden als unbekannte Quelle erscheinen).
- **Extern (UI-Labels):** Nur die Anzeigenamen in der Frontend-Label-Map ändern:
  - `fp2` → "Radar-Präsenz"
  - `fp2_vib` → "Radar + Vibration"
  - `fp2_other` → "Radar (andere Zone)"

**Scope:** Nur `src-admin/src/components/tabs/HealthTab.tsx` — die `srcLabel`-Map und `srcInfo`-Map aktualisieren. Kein Backend-Code, keine JSON-Migration nötig.

**Priorität:** NIEDRIG — kosmetisch, kein Einfluss auf Genauigkeit. Sinnvoll vor einem öffentlichen Release oder wenn der Shelly Presence Gen4 aktiv im Einsatz ist.