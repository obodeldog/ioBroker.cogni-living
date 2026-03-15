# BRAINSTORMING — ioBroker Cogni-Living (AURA)
**Zweck:** Architektur-Entscheidungen, offene Konzepte, Diskussionen, Marktanalyse.
**Nicht hier:** konkrete Deploy-Schritte, Bugfixes → dafuer PROJEKT_STATUS.md

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
- Kinder haben eigene Zimmer → manche Raeume IMMER nur 1 Person

Ein globaler "Einpersonen/Mehrpersonen"-Schalter ist zu grob.

### Ansatz 1: Raum-spezifische Belegungserkennung (bevorzugt)

Jedes Krankheitsprofil deklariert welche "Sensor-Zone" es beobachtet.
Nur wenn IN DIESER ZONE Mehrpersonenbelegung erkannt wird → Warnung.

Beispiele:
- Schlafstoerungs-Profil → Zone: Bett → FP2 Bett zeigt value=2 → Warn-Symbol
- Ganggeschwindigkeit → Zone: Flur → Flur zeigt 2 Personen → Analyse pausiert
- Nykturie → Zone: Bad → Bad fast immer 1 Person → laeuft normal

Schlafzimmer und Bad: meist Privatbereich → laufen ungestoert auch wenn Kinder im Haus
Wohnzimmer, Flur, Kueche: koennen von mehreren belegt sein → robustere Analyse noetig

### Ansatz 2: Zwei-Baseline-Modell (fuer Health-Algorithmus)

FP2 kennzeichnet jeden Tag automatisch:
- "Allein-Tag" (max_persons_detected <= 1) → Kalibrierungs-Baseline
- "Mehrpersonen-Tag" (max_persons_detected >= 2) → hoeherer Rausch-Schwellwert

Das System lernt von Allein-Tagen und analysiert auch Mehrtage,
aber mit angepasster Toleranz. Kein manueller Schalter noetig.

### Pushover-Benachrichtigung bei Mehrpersonenbelegung
Idee: Wenn ein kritisches Krankheitsprofil (z.B. Epilepsie, Sturzrisiko) gerade nicht
analysiert werden kann weil die relevante Zone mehrfach belegt ist:
- Warn-Symbol im Medical Tab
- Optional: Pushover an Angehoerige "Schlafueberwachung Opa unterbrochen - Besucher erkannt"

### Noch nicht geloest
- Wie "Zone" eines Profils konfigurieren? Automatisch (aus Sensor-Funktionen) oder manuell?
- Schwellwert: ab wann ist eine Zone "mehrfach belegt"? value >= 2 des FP2?
- Was wenn kein FP2 vorhanden? Dann kein Mehrpersonenschutz moeglich.

---

## Offenes Konzept: Multi-Raum Sensor-Zuordnung

### Szenario
Schlafzimmer 1: PIR + Vibration (Funktion=Bett) → erweitertes Schlaf-Monitoring
Schlafzimmer 2: nur PIR (Funktion=Bett) → nur Basis-Schlaf-Monitoring

### Aktuelle Loesung (einfach)
Das System nutzt ALLE Sensoren gleicher Funktion zusammen.
Progressive Enhancement: hoechste verfuegbare Capability gewinnt.
Vibration in Zimmer 1 schaltet Schlafunruhe-Analyse frei → gilt fuer ganzen Tag.

### Spaetere Loesung (komplex, Phase 8+): "Person"-Tag
Optionales Freitextfeld "Zugehoerige Person" am Sensor:
- Vibration → Person: "Opa" (Schlafzimmer 1)
- PIR Schlafzimmer 2 → Person: "" (nicht ueberwacht)
Dann: separate Analyse pro Person-Tag.
NICHT fuer MVP — erst wenn konkreter Kundenbedarf.

---

## Geplante Phasen-Uebersicht

### Phase 4 (DONE v0.33.3) — FP2 + Vibration
- Sensortypen presence_radar + vibration
- Flags isFP2Bed, isFP2Living, isVibrationBed
- sleepDisorder Score
- maxPersonsDetected im Snapshot

### Phase 5 — Wassersensor + UTI/Inkontinenz-Profil
- Sensortyp moisture, Flag isMoistureBed
- Neues Profil: uti (Harnwegsinfektion) oder incontinence
- State-Pfad: zigbee.0.00158d000b7e8275

### Phase 6 — Garmin-Uhr (cardiovascular + sleep)
- Garmin Connect API oder iobroker.garmin Adapter
- Metriken: Ruhe-HF, HRV, SpO2, Schlafphasen, Stress, Atemfrequenz
- Neue Profile: cardiovascular (vollstaendig), praeziserer COPD Score

### Phase 7 — Occupancy Tracker
- Dedizierter FP2 im Wohnzimmer/Flur fuer Personenzaehlung
- Zwei-Baseline-Modell automatisch
- Pushover bei Ueberwachungs-Unterbrechung

### Phase 8 — Sensor-Tabellen-Refactoring (Typ + Funktion)
- Checkboxen durch Funktion-Dropdown ersetzen
- Migration bestehender Kunden-Configs
- Voraussetzung: alle Phase 5-7 Features umgesetzt

### Phase 9+ — Personenprofile (Multi-Person Monitoring)
- Separate Analyse pro "Person"-Tag
- Erfordert: Occupancy Tracker (Phase 7) als Basis

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

## Verweis auf PROJEKT_STATUS.md
Fuer konkrete Deploy-Schritte, Versionshistorie und implementierte Features:
→ PROJEKT_STATUS.md
