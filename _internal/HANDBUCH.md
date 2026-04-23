# HANDBUCH — ioBroker Cogni-Living (AURA)
**Zweck:** Algorithmus-Dokumentation, wissenschaftliche Grundlagen, Bedienungsanleitung-Basis.
**Regel:** Neue Features hier dokumentieren, Tooltips im Frontend als Kurzfassung.
**Nicht hier:** Deploy-Schritte, Bugfixes → PROJEKT_STATUS.md | Ideen → BRAINSTORMING.md

---

## 🚨 RECHTLICHER HINWEIS

Diese Software ist **KEIN Medizinprodukt** gemäß der Verordnung (EU) 2017/745 (MDR).

- **Zweckbestimmung:** Cogni-Living dient ausschließlich der Unterstützung der allgemeinen Lebensführung (Ambient Assisted Living), dem Komfort und reinen Informationszwecken.
- **Keine Diagnose/Therapie:** Die bereitgestellten Daten, Analysen, Gesundheits-Scores und Alarme sind nicht dazu geeignet, Krankheiten zu diagnostizieren, zu behandeln, zu heilen oder zu verhindern. Sie ersetzen keinesfalls die fachliche Beratung, Diagnose oder Behandlung durch einen Arzt.
- **Haftungsausschluss:** Verlassen Sie sich in gesundheitlichen Notfällen nicht auf diese Software.

---

## 🗂️ FRONTEND-KACHELN INVENTAR — Alle Tooltip-Texte (1:1 aus Code)

Status: ✅ = Tooltip vorhanden | ⚠️ = Kein Tooltip (TODO)

---

### Tab: Sex (OC-SEX) — Intimitätserkennung & Training

> **Stand:** v0.33.144 | **Kein Medizinprodukt** — ausschließlich zur persönlichen Dokumentation.

---

#### Wie funktioniert die Erkennung?

AURA erkennt intime Aktivitäten anhand des **Vibrationssensors am Bett** (Aqara/FP2). Die Erkennung läuft automatisch und wertet **den gesamten Kalendertag (00:00–23:59)** aus — Sex kann zu jeder Tageszeit passieren.

**Drei Erkennungs-Stufen:**

| Stufe | Methode | Was sie macht |
|---|---|---|
| **1 — Schwellen** | Kalibrierung | Bestimmt calibA (vaginal) und calibB (oral/Hand) aus Trainings-Labels |
| **2 — Klassifikation** | Peak + Dauer | Tier A (hoher Peak, kurz-intensiv) → vaginal; Tier B (moderater Peak, länger) → oral/Hand; Default → nicht klassifiziert |
| **3 — KI-Klassifikator** | Random Forest (Python) | Verfeinert Ergebnis mit Kontextdaten; benötigt mind. 3 gelabelte Sessions |

**Score (0–100):** Gewichtung aus Vibrationsstärke (50%), Trigger-Dichte (30%) und Dauer (20%). Optionaler Garmin-HR-Boost (+10/+15 Punkte bei erhöhter Herzfrequenz in Ruhe).

---

#### Kacheln im Überblick

| Kachel | Funktion |
|---|---|
| **SEX — HEUTE** | Zeigt heutige Session(s) mit Intensitätsverlauf (00:00–23:59). Grau schraffiert = noch nicht vergangen. Titel zeigt Datum. |
| **SEX — 7 TAGE** | Wochenübersicht mit Session-Dots. Zeigt Anz. Sessions, Ø Dauer, Score. Nullnummer-Tage zählen nicht mit. |
| **SEX — MONATSKALENDER** | Monatsübersicht mit Icons. Volle Opazität = Sensor erkannt. Blass (60%) = nur manuell eingetragen. |
| **SESSION EINTRAGEN (für Sensor-Training)** | Manuelles Labeln erkannter Sessions für das KI-Training. **Nicht** für neue Sessions gedacht — dafür "Manuelle Session". |
| **MANUELLE SESSION** | Dokumentiert Intimität außerhalb des Bettes (z. B. Sofa, Reise). Fließt **nicht** ins ML-Training ein. |
| **SENSOR-DETAILS** | Technische Rohdaten der Sensorereignisse der ausgewählten Session. |
| **ALGORITHMUS** | Kalibrierungsstatus, Erkennungs-Schwellen und KI-Klassifikator-Status. |

**Kalender-Icons:**

| Icon | Bedeutung |
|---|---|
| 🌹 (voll) | Vaginal — vom Sensor erkannt |
| 🌹 (blass) | Vaginal — nur manuell eingetragen |
| 💋 (voll) | Oral/Hand — vom Sensor erkannt |
| 💋 (blass) | Oral/Hand — nur manuell eingetragen |
| ❔ | Nicht klassifiziert (erkannt, aber Typ unklar) |
| 🚫 | Nullnummer — Fehlauslösung, zählt nicht als Session |
| ⚡×2 | 2 erkannte Fragmente (Sensor teilte Session auf) |
| +m | Zusätzlich manueller Eintrag vorhanden |

---

#### Nullnummer — Was bedeutet das und was passiert?

Eine **Nullnummer** meldet dem System: *"Der Sensor hat etwas erkannt, aber es war kein Sex"* (z. B. Einschlaf-Unruhe, Bett beziehen, intensives Wälzen).

**Was beim Klick auf „🚫 Nullnummer“ passiert:**
1. Ein Label `nullnummer` wird in den Trainings-Daten gespeichert
2. Das erkannte Event wird **sofort aus der JSON-Datei gelöscht** (`intimacyEvents = []`) — nicht nur visuell versteckt
3. Monatskalender und 7-Tage-Ansicht zeigen den Tag nicht mehr als Sex-Tag (zählt nicht in Wochenstatistik)
4. Der RF-Klassifikator (Stufe 3) lernt dieses Muster als "kein Sex" — ähnliche Fehlerkennungen werden zukünftig verhindert
5. **Kein Einfluss** auf Schlaf-Erkennung, Gesundheits-Algorithmen, Schutzengel oder Morning Briefing
6. **Kein Einfluss** auf calibA/calibB — Vibrations-Schwellen werden nicht verändert
7. Rohe Vibrationsdaten (`eventHistory`) bleiben unverändert erhalten

**Rückgängig:** Über den „↩ Zurück“-Button wird das Label entfernt. Das Event kann dann durch „Neu analysieren“ aus den Rohdaten wiederhergestellt werden.

---

#### Zyklus-Tab: Einfluss auf den Sex-Tab

Der **Zyklus-Tab hat nur minimalen Einfluss** auf den Sex-Tab. Es gibt keine algorithmische Verknüpfung:

| Was | Einfluss |
|---|---|
| **Fun-Kommentare** (Fun Mode aktiv) | Kontextuelle Anmerkungen zur Zyklusphase (z. B. "PMS-Phase Tag 12 — trotzdem intime Aktivität"). Rein informativ, kein algorithmischer Einfluss. |
| **Session-Erkennung (Stufen 1–2)** | ❌ Kein Einfluss — Zyklusdaten fließen nicht in Vibrations-Schwellen oder Session-Erkennung ein. |
| **KI-Klassifikator (Stufe 3)** | ❌ Kein Einfluss — Kontextmerkmale sind Uhrzeit, Licht, Raumtemperatur, Badnutzung. Kein Zyklus-Merkmal. |

> **Geplant (OC-28):** Verhütungsmethode + Fruchtbarkeits-Kontext — zeigt ob ein Intimitäts-Ereignis in einem "günstigen" oder "risikoreichen" Zeitfenster liegt, abhängig von der eingestellten Verhütungsmethode (Vasektomie, Spirale, Kondome, Kinderwunsch aktiv).

---

#### Manuelle Sessions vs. Trainings-Labels — Unterschied

| | Manuelle Session | Trainings-Label |
|---|---|---|
| **Zweck** | Dokumentation (kein Bett-Sensor vorhanden) | ML-Training des KI-Klassifikators |
| **Einfluss auf KI** | ❌ Nein | ✅ Ja |
| **Im Kalender sichtbar** | ✅ Ja (blass/hohl dargestellt) | Nur als Override wenn Sensor-Event existiert |
| **Wo eintragen** | Kachel "MANUELLE SESSION" | Kachel "SESSION EINTRAGEN (für Sensor-Training)" |

> **Wichtig:** Ein Trainings-Label erzeugt oder verlängert **keinen Sensor-Eintrag**. Es lehrt das KI-Modell, ähnliche zukünftige Vibrationsmuster korrekt zu klassifizieren. Die erkannte Session-Dauer im Vibrationsverlauf basiert ausschließlich auf den Rohdaten des Sensors — nicht auf der eingetragenen Dauer im Label.

> **Warum muss nach "+ SPEICHERN" noch das Diskettensymbol gedrückt werden?** Das Speichern eines Labels schreibt in die Adapter-Konfiguration (`native.sexTrainingLabels`). ioBroker erfordert dafür das Speichern der gesamten Adapter-Config (Diskette), was einen Adapter-Neustart auslöst. Danach einmal "Neu analysieren" drücken, damit das neue Label ins Modell einfließt.

---

#### LOO-Kreuzvalidierung — Warum verbessert Training die Confusion Matrix nicht sofort?

Die **Confusion Matrix** im ALGORITHMUS-Tile wird per Leave-One-Out (LOO) berechnet. Das funktioniert so:

> Für jedes Trainings-Label wird das Modell **ohne genau dieses Label** trainiert und dann gefragt: "Kannst du dieses Label korrekt vorhersagen?"

Das führt zu einem häufigen Missverständnis:

**Beispiel:** Du trägst am 18.04. ein vaginal-Label ein. Das Modell lernt dieses Muster. Im Vibrationsverlauf wird die Session nun korrekt als vaginal erkannt. **Aber in der LOO-Matrix bleibt 18.04. trotzdem ein FN** — weil der LOO-Test absichtlich prüft: "Kann das Modell den 18.04. vorhersagen, *ohne* ihn je gesehen zu haben?"

| | Echtes Modell | LOO-Test |
|---|---|---|
| Trainiert auf dem neuen Label? | ✅ Ja | ❌ Nein (absichtlich ausgelassen) |
| Klassifiziert die Session korrekt? | ✅ Ja | ❌ Solange zu wenig ähnliche Samples |
| Zweck | Echte Vorhersagen | Generalisierungsmessung |

**Das ist kein Fehler** — der LOO-Test misst ehrlich, wie gut das Modell auf *unbekannte* Sessions generalisiert. Ein FN für ein neues Label bedeutet: "Ich brauche noch mehr ähnliche Beispiele, um dieses Muster allgemein zu erkennen." Mit mehr vaginal-Sessions ähnlichen Profils wird der Eintrag automatisch zu TP.

---

#### Technische Details (Entwickler)

- **Datenspeicherung:** `intimacyEvents` in `{date}.json` (History-Verzeichnis); manuelle Sessions in `sex-manual.json`
- **Trainings-Labels:** `native.sexTrainingLabels` (JSON-Array in Adapter-Config). Typen: `vaginal`, `oral_hand`, `nullnummer`
- **Tagesgrenze:** Kalender-Tag 00:00–23:59 (ab v0.33.143; vorher Schlafzyklus 18:00–18:00)
- **Neu analysieren:** `reanalyzeSexDay(date)` — respektiert Nullnummer-Labels (überschreibt nicht)
- **Alle analysieren:** Sequenzielle `reanalyzeSexDay`-Aufrufe für alle historischen Tage; nach Kalender-Tag-Umstellung einmalig ausführen
- **Nullnummer löschen:** Handler `clearIntimacyEventsForDay(date)` schreibt `intimacyEvents = []` direkt in die JSON

#### Confusion Matrix und LOO-Details

Die **Confusion Matrix** im ALGORITHMUS-Tile zeigt, wie gut das Modell trainiert ist:

| Feld | Bedeutung |
|---|---|
| **TP** (Grün) | Echte Sex-Session korrekt erkannt |
| **TN** (Grün) | Nullnummer korrekt als kein Sex erkannt |
| **FP** (Rot) | Nullnummer fälschlicherweise als Sex erkannt |
| **FN** (Rot) | Echte Sex-Session als kein Sex klassifiziert |

- **Sensitivität** = TP/(TP+FN) — "Wie oft erkennt das Modell Sex richtig?"
- **Spezifität** = TN/(TN+FP) — "Wie oft erkennt das Modell Nullnummern richtig?"

**LOO-Details aufklappen:** Unter der Matrix gibt es eine ausklappbare Tabelle mit allen Trainings-Sessions, dem vorhergesagten und dem tatsächlichen Typ sowie ob die Einschätzung korrekt war. So siehst du genau, welche Session vom Modell falsch eingeschätzt wurde.

#### Sensor-Konfiguration für den KI-Klassifikator

Die Kontextmerkmale werden **automatisch** aus den vorhandenen Sensoren bezogen — keine spezielle Konfiguration nötig:

| Merkmal | Sensor-Quelle |
|---|---|
| **Licht war an** | Licht-/Dimmer-Sensor im **gleichen Raum** wie der Bett-Sensor |
| **Raumtemperatur** | Temperatur-/Thermostat-Sensor im **gleichen Raum** wie der Bett-Sensor |
| **Anwesenheit** | FP2/Presence-Sensor (unabhängig von Raum) |
| **Bad vor/nach Session** | Alle Sensoren mit Funktion `bathroom` (z.B. EG WC + EG Bad) |
| **Nachbarzimmer aktiv** | Bewegungssensoren in direkt angrenzenden Räumen (Hop=1 im Raumlayout) |
| **Uhrzeit** | Aus dem Session-Startzeitpunkt berechnet (sin/cos-Encoding) |

> **Wichtig:** Für Licht und Temperatur wird der **Raum des Bett-Sensors** verwendet (z.B. "Schlafzimmer"). Es muss kein Sensor speziell als "bed" konfiguriert werden — nur der Raum muss übereinstimmen. Der Tooltip über den Einflussfaktoren zeigt, welcher Sensor konkret gefunden wurde.
### Tab: Gesundheit — Langzeit-Trends (`LongtermTrendsView.tsx`)

Tooltips werden über die `ChartHelp`-Komponente angezeigt (kleines ?-Icon rechts neben dem Kacheltitel).

#### AKTIVITÄT
✅ `src: LongtermTrendsView.tsx Zeile ~573`
> Zeigt deine tägliche Bewegungsintensität im Vergleich zu deinem persönlichen Durchschnitt (= 100%). Hellblau = Tageswert, Grau = 7-Tage-Trend. Grüne Zone (60–140%) ist dein Normalbereich. Werte unter 60% oder über 140% deuten auf unübliche Aktivität hin – z.B. Krankheit oder besonders aktive Tage.

#### GANGGESCHWINDIGKEIT
✅ `src: LongtermTrendsView.tsx Zeile ~661`
> Misst wie lange du durchschnittlich brauchst, um den Flur zu durchqueren (Median in Sekunden). Eine länger werdende Durchquerungszeit kann auf nachlassende Mobilität hinweisen. Typischer Normalbereich: 3–15 Sekunden. Nur Sensoren die als Flur markiert sind werden berücksichtigt.

#### NACHT-UNRUHE
✅ `src: LongtermTrendsView.tsx Zeile ~686`
> Zählt Bewegungsereignisse zwischen 22:00 und 08:00 Uhr in Schlafräumen. Viele Ereignisse deuten auf unruhigen Schlaf oder häufiges Aufstehen hin. Nur Sensoren die als Nacht markiert sind werden berücksichtigt. Der Trend vergleicht die letzten 7 Tage mit dem 4-Wochen-Durchschnitt.

#### RAUM-MOBILITÄT
✅ `src: LongtermTrendsView.tsx Zeile ~716`
> Zeigt in wie vielen verschiedenen Räumen du dich pro Tag bewegt hast. Wenige besuchte Räume können ein Zeichen von eingeschränkter Mobilität sein. Im Tooltip siehst du für jeden Raum wie viele Minuten aktive Bewegung registriert wurde. Alle Bewegungssensoren außer Nacht-Sensoren werden berücksichtigt.

#### DRIFT-MONITOR
✅ `src: LongtermTrendsView.tsx Zeile ~750`
> Erkennt schleichende Veränderungen über Wochen und Monate (Page-Hinkley-Test). Jede Kurve zeigt wie weit sich eine Metrik von ihrer persönlichen Baseline entfernt hat – in Prozent der Alarmschwelle. 0 % = kein Drift, 100 % = Alarm. Die ersten 7–14 Tage sind Kalibrierungsphase (Score = 0). Farben sind identisch mit den Einzelkacheln darüber.

#### BAD-NUTZUNG (Langzeit)
✅ `src: LongtermTrendsView.tsx Zeile ~928`
> Zählt die Minuten täglicher Bewegungsaktivität im Badezimmer. Eine starke Zu- oder Abnahme kann hygienische Gewohnheitsänderungen anzeigen. Nur Sensoren die als Bad markiert sind werden berücksichtigt. Thermostat-Sensoren werden nicht mitgezählt.

#### FRISCHLUFT (Langzeit)
✅ `src: LongtermTrendsView.tsx Zeile ~953`
> Zählt wie oft Fenster oder Türen pro Tag geöffnet wurden. Regelmäßiges Lüften ist wichtig für Wohlbefinden und Gesundheit. Nur Kontaktsensoren vom Typ Tür werden gezählt. Im Tooltip siehst du welche Fenster und Türen besonders häufig geöffnet wurden.

#### BETTPRÄSENZ (Schlaf & Sensorik)
✅ `src: LongtermTrendsView.tsx Zeile ~1044`
> Zeigt wie viele Stunden pro Nacht die Bett-Zone des FP2 belegt war. Grün = 6–9h (optimal), Gelb = 4–6h (wenig), Rot = unter 4h oder über 10h (auffällig). Nur wenn FP2 mit Funktion 'Bett/Schlafzimmer' konfiguriert ist.

#### NACHT-VIBRATION (Schlaf & Sensorik)
✅ `src: LongtermTrendsView.tsx Zeile ~1102`
> Zählt Vibrationsimpulse am Bett zwischen 22:00 und 06:00 Uhr. Viele Impulse deuten auf unruhigen Schlaf hin. Relevant für: Schlafstörungen, Parkinson-Tremor (nächtlich), REM-Schlafstörung. Nur wenn Vibrationssensor mit Funktion 'Bett/Schlafzimmer' konfiguriert ist.

#### PERSONEN-COUNT (Schlaf & Sensorik)
✅ `src: LongtermTrendsView.tsx Zeile ~1141`
> Zeigt das tägliche Maximum gleichzeitig erkannter Personen (FP2 Wohnzimmer). 1 = alleine, 2+ = Mehrpersonen-Haushalt an diesem Tag. Wichtig für: Soziale Isolation, korrekte Einordnung anderer Metriken (z.B. Nacht-Unruhe bei Gast). Nur wenn FP2 mit Funktion 'Wohnzimmer/Hauptraum' konfiguriert ist.

#### NYKTURIE (Schlaf & Sensorik)
✅ `src: LongtermTrendsView.tsx Zeile ~1255`
> Zählt Toilettenbesuche innerhalb des tatsächlichen Schlaf-Fensters (FP2-Bett-basiert). Ohne FP2: Fixfenster 22–06 Uhr. >2 Besuche/Nacht = Nykturie-Hinweis. Frühzeichen bei Diabetes T2, Herzinsuffizienz, Harnwegsinfekt. Nur wenn Bad-Sensor mit Funktion Bad/WC konfiguriert ist.

#### VIBRATIONSSTÄRKE (Schlaf & Sensorik)
✅ `src: LongtermTrendsView.tsx Zeile ~1312`
> Durchschnittliche und maximale Vibrationsstärke im Schlaffenster. Hohe Werte (>80) können auf Parkinson-Tremor, Epilepsie oder intensive Schlafbewegungen hinweisen. Niedriger Count + hohe Stärke = medizinisch relevant.

#### SCHLAFZEITEN (Schlaf & Sensorik)
✅ `src: LongtermTrendsView.tsx Zeile ~1384`
> Zeigt Einschlaf- und Aufwachzeit pro Nacht (FP2-Bett). Konsistente Schlafzeiten fördern Gesundheit. Verschobene Zeiten können auf Depression, Demenz oder Schlafstörungen hinweisen.

---

### Tab: Gesundheit — Tagesansicht (`HealthTab.tsx`)

Tooltips werden über `TerminalBox helpText=` angezeigt (?-Icon im Kachel-Titel).

#### SCHLAF-RADAR (22–08)
✅ `src: HealthTab.tsx Zeile ~991`
> Balkendiagramm der Nacht-Aktivität (22–08 Uhr). Jeder Balken = 30 Minuten. Hohe Balken = viele Bewegungen. Grün = normal, Rot/Orange = auffällig viel. Hilft Schlafmuster zu erkennen.

#### NEURO-TIMELINE (08–22)
✅ `src: HealthTab.tsx Zeile ~1066`
> Stündliche Tages-Aktivität (08–22 Uhr). Blau = keine Aktivität, Grün = normal, Gelb/Rot = erhöht. Zeigt Tagesstruktur und Aktivitätsmuster auf einen Blick.

#### SCHLAFANALYSE (OC-7)
✅ `src: HealthTab.tsx Zeile ~1184`
> AURA-Sleepscore: Tief×200 + REM×150 + Leicht×80 - Wach×250 (Anzeige max. 100, Rohwert kann höher sein). Bonus +5 bei 7–9h Schlafdauer.
> Quellen: Diekelmann & Born 2010 (Tiefschlaf), Walker 2017 / Stickgold 2005 (REM), AASM Guidelines (Leichtschlaf), Buysse et al. 1989 PSQI (WASO-Abzug).
> Einschlafzeit (📡): Letzte FP2-Bettbelegung =10 Min zwischen 18–03 Uhr.
> Aufwachzeit (📡): Erste Bettleere =15 Min nach 04 Uhr (? vorläufig bis 10:00 Uhr + 1h Bett leer).
> Balkenfarben: Dunkelblau=Tief, Hellblau=Leicht, Lila=REM, Gelb=Wach-im-Bett, Orange=Bad-Besuch, Rot=Außerhalb (du), Blau=Andere Person.
> Dreiecks-Marker ?: Orange=Bad, Rot=Außerhalb (bestätigt du), Blau=Andere Person im Haus. Mehrpersonenhaushalt: Rot nur mit FP2-Bett-Bestätigung.
> **FP2-Solo-Dropout-Filter (ab v0.33.103):** Kurze FP2-Abwesenheiten <5 Min, die NICHT durch einen Sensor außerhalb des Schlafzimmers bestätigt werden, erzeugen kein rotes Dreieck. Hintergrund: Der FP2 kann bei ruhiger Schlafhaltung kurzzeitig die Detektion verlieren (Radar-Dropout), obwohl die Person noch im Bett liegt. Ohne Bestätigung durch Bad/Wohnzimmer/anderen Raum-Sensor wird dieses Signal ignoriert.
> Kein Medizinprodukt — für klinische Diagnose Arzt hinzuziehen.

---

## 📐 ALGORITHMUS-DOKUMENTATION — SCHLAFANALYSE (OC-7)

### Wie AURA Einschlaf- und Aufwachzeit bestimmt

AURA kombiniert mehrere Sensordatenquellen nach einem **Prioritätsprinzip (Graceful Degradation)**. Je mehr hochwertige Sensoren vorhanden sind, desto genauer die Erkennung. Das System funktioniert aber auch mit nur einem einfachen Bewegungsmelder.

#### Einschlafzeit — Erkennungsquellen (Priorität absteigend)

> **Hinweis:** Gilt für **globale und per-Person-Schlafkacheln identisch** (ab v0.33.140). Die Prioritätskette ist dieselbe; im Mehrpersonenhaushalt werden Ereignisse nach `personTag` gefiltert.
> Neu ab v0.33.58: Vibrations-Verfeinerung — erkennt das **echte Einschlafen** nach dem Ins-Bett-Gehen (Radar + erstes Vibrations-Event mit =20 Min Stille danach, Forward-Scan).
> Neu ab v0.33.141: `last_outside` auch im globalen System verfügbar.
> **Algorithmus-Richtung ab v0.33.150:** Alle Vib-basierten Quellen (`fp2_vib`, `motion_vib`, `vib_refined`) und `gap60` nutzen jetzt einen **Forward-Scan** — suchen das **erste** ruhige Ereignis (= Einschlafen), nicht mehr das letzte (= Morgen-Aufstehen). `Date.now()`-Fallback durch Fenster-Ende (04:00 Uhr) ersetzt.

| Symbol | Quelle (intern) | Anzeigename im UI | Methode | Konfidenz | Status |
|---|---|---|---|---|---|
| ? | `garmin` | **Smartwatch** (Garmin, Fitbit …) | sleepStartTimestampGMT — plausibel wenn 18–04 Uhr UND ? =3h zur Radar-Zeit + Datum-Konsistenz | Maximal | ✅ aktiv |
| 📡 | `fp2_vib` | **Radar + Vibration** | Radar-Bett belegt · **Forward-Scan**: erstes Vib-Event mit =20 Min Stille danach (innerhalb 3h nach FP2-Anker) | Sehr hoch | ✅ aktiv (ab v0.33.58, Forward-Scan ab v0.33.150) |
| 📡 | `fp2` | **Radar (Präsenz-Sensor)** | Letzter Radar-Bett-Event vor =60 Min Lücke (18–03 Uhr) | Hoch | ✅ aktiv |
| 📡 | `motion_vib` | **Bewegungsmelder + Vibration** | PIR-Motion-Fenster als Anker ? **Forward-Scan**: erstes Vib-Event mit =20 Min Stille (innerhalb 3h) | Mittel-Hoch | ✅ aktiv (ab v0.33.80, Forward-Scan ab v0.33.150) |
| 📡 | `vib_refined` | **Letzte Bettbewegung (Vibration)** | Beliebiger Bett-Event als Anker ? **Forward-Scan**: erstes Vib-Event mit =20 Min Stille | Mittel | ✅ aktiv (per-Person ab v0.33.139, Forward-Scan ab v0.33.150) |
| ⚠️ | `gap60` | **Schlafzimmer-Aktivitätspause** | Erstes Vib/FP2-Bett-Event vor =60 Min Stille (Forward-Scan, kein Bewegungsmelder) | Mittel | ✅ aktiv (Forward-Scan + isBedroomMotion entfernt ab v0.33.152) |
| 📡 | `last_outside` | **Letzte Außenaktiv.** | Letztes Außen-Event ohne 30-Min-Folgeaktivität → erster Bett-Event danach | Niedrig | ✅ aktiv (global ab v0.33.141) |
| 📡 | `haus_still` | **Haus-wird-still** | **Forward-Scan** auf Nicht-Schlafzimmer-Events: erstes Event vor =60 Min Stille in anderen Räumen (funktioniert für Single & Multi) | Niedrig | ✅ aktiv (Forward-Scan ab v0.33.153) |
| 📡 | `motion` | **Schlafzimmer-Bewegungsmelder** | Letzte Bewegung + danach =30 Min Stille (18–03 Uhr); Fenster-Ende als Fallback statt Date.now() | Niedrig | ✅ aktiv (nur global, Schwelle 30 Min ab v0.33.152) |
| ? | `fixed` | **Fallback 20:00 Uhr** | Festes Fenster 20:00–09:00 Uhr | — | ✅ aktiv (Fallback; `winstart` ab v0.33.152 entfernt) |

**Legende Dropdown-Anzeige:**
- Zeit angezeigt (`HH:MM`) ? Quelle hat Daten für diese Nacht gefunden
- `—` ? Quelle vorhanden aber kein passendes Ereignis in dieser Nacht
- `⚠️ kein Sensor` ? Sensor-Typ ist im System **nicht konfiguriert** (kein Gerät mit diesem Typ + Funktion „bed")
- **Stark ausgegraut** (Opacity 25%) ? kein Sensor; **leicht ausgegraut** (40%) ? Sensor da, aber keine Daten

#### Aufwachzeit — Erkennungsquellen (Priorität absteigend)

> **Neu ab v0.33.141:** Aufwachzeit hat jetzt ebenfalls ein interaktives **Quellen-Dropdown** mit „Wählen"-Button — analog zur Einschlafzeit. Manuelle Korrekturen werden als `override` gespeichert und sind jederzeit zurücksetzbar.
> **Überarbeitet ab v0.33.155:** `fp2`, `fp2_vib`, `fp2_other` und `other` nutzen jetzt den echten **Abgangs-Zeitpunkt** aus dem Bett (nicht mehr Rückkehr-Zeitpunkt oder Garmin-Überschreibung). `other` (Anderer Raum) zeigt die **erste** andere-Raum-Bewegung — nicht mehr die letzte Abfahrt ohne Rückkehr.

| Symbol | Quelle (intern) | Anzeigename | Methode | Konfidenz | Status |
|---|---|---|---|---|---|
| ? | `garmin` | **Smartwatch** | Garmin `sleepEndTimestampGMT` — plausibel wenn 03–14 Uhr | Maximal | ✅ aktiv (ab v0.33.58) |
| 📡 | `fp2_vib` | **Radar + Vibration** | FP2-Abgangzeit (`firstEmpty`) + Vib-Event in den 30 Min **vor** dem Abgang (Aufwach-Vibration) + Außen-Bestätigung | Sehr hoch | ✅ aktiv (Abgangszeit ab v0.33.155) |
| 📡 | `fp2_other` | **Radar + anderer Raum** | FP2-Abgangzeit + **erste** andere-Raum-Bewegung innerhalb 60 Min danach (Forward-Scan) | Sehr hoch | ✅ aktiv (Forward-Scan ab v0.33.155) |
| 📡 | `fp2` | **Radar (Präsenz-Sensor)** | Zeitpunkt als FP2 das Bett **zuerst** =15 Min leer erkannte nach 04:00 Uhr (`firstEmpty` — echter Abgang, nicht Rückkehr) | Hoch | ✅ aktiv (Abgangzeit ab v0.33.155) |
| 📡 | `other` | **Anderer Raum** | **Erste** Bewegung außerhalb Schlafzimmer/Bad nach 04:00 + =3h Schlaf (Forward-Scan; vorher: letzte Abfahrt ohne Rückkehr) | Mittel | ✅ aktiv (Forward-Scan ab v0.33.155) |
| 📡 | `motion` | **Schlafzimmer-Bewegungsmelder** | Erste Bewegung nach 04:00 + =3h Schlaf | Mittel | ✅ aktiv |
| 📡 | `vibration` | **Vibrationssensor (? Konfidenz)** | Letztes Vib-Event in den 30 Min **vor** dem FP2-Abgang ? Konfidenz-Booster, **kein eigenständiger Zeitpunkt** | Konfidenz-Booster | ✅ aktiv (Fenster vor Abgang ab v0.33.155) |
| 📡 | `vibration_alone` | **Vibrationssensor allein** | Letztes Vib-Event + danach =45 Min Stille | Sehr niedrig | ✅ aktiv |
| ? | `fixed` | **Fallback 20:00 Uhr** | Fixwert 09:00 Uhr | — | ✅ aktiv (Fallback) |
| 📡 | `override` | **Manuell überschrieben** | Manuell per Dropdown gesetzt (zurücksetzbar) | — | ✅ aktiv (ab v0.33.141) |

#### Warum „Anderer Raum" nur im Einpersonenhaushalt?

Wenn mehrere Personen im Haus sind, könnte ein Wohnzimmer-Signal von **einer anderen Person** stammen. Nur wenn das System sicher ist, dass nur eine Person zu Hause ist (FP2-Personenzählung =1 oder Haushaltskonfiguration = „alleine"), kann das Signal eindeutig der überwachten Person zugeordnet werden.

> **Tipp für Kunden:** Im Schlafzimmer und Bad sind Sensoren immer **personengebunden**, weil diese Räume typischerweise nur von einer Person genutzt werden. Ein Badezimmer-Sensor mit konfiguriertem **Personen-Tag** wird auch im Mehrpersonenhaushalt als persönliches Signal gewertet.

#### Technische Details: FP2-Bett-Aufwachzeit (ab v0.33.155)

- **Echter Abgang (`firstEmpty`):** `sleepWindowCalc` gibt jetzt zusätzlich `firstEmpty` zurück — der Zeitpunkt, an dem das Bett nach dem Schlaf **zuerst** für =15 Min leer wurde (nach 04:00). Das ist der echte Aufsteh-Zeitpunkt. Vorher wurde irrtümlich der Rückkehrzeitpunkt (wann die Person ins Bett zurückkam) verwendet.
- **Kein Garmin-Durchsickern:** `fp2WakeTs` in `allWakeSources` zeigt jetzt den rohen FP2-Wert (`firstEmpty`) — nicht mehr den von Garmin überschriebenen `sleepWindowOC7.end`. Garmin gewinnt nur in der Prioritätskette, aber jede Quelle behält ihren eigenständigen Wert im Dropdown.
- **Aufwach-Vibration:** `fp2_vib` sucht Vibrationsereignisse im Fenster **30 Min vor dem Abgang** — das entspricht dem typischen Wachmuster (Person dreht sich, bevor sie aufsteht). Vorher wurde +5 Min nach dem Abgang eingeschlossen, was keine sinnvollen Events liefert.
- **Mehrfaches Zurückkehren:** Bei einem Nutzer der mehrmals ins Bett zurückkehrt, zeigt `fp2` den ersten echten Abgang (erste =15-Min-Leerphase). `other` zeigt wann erstmals ein anderer Raum betreten wurde.

#### Sonderfälle

- **Nickerchen (?):** Einschlafzeit zwischen 03:00–19:00 Uhr ? als Nickerchen markiert, kein OC-7-Sleepscore.
- **Ungewöhnlich lange Liegezeit (?):** Schlafdauer > 12h ? Hinweis in der Kachel; Konfidenz wird gesenkt (kann Krankheit/Ausfall signalisieren).
- **Sensor-Ausfall:** Wenn alle Vibrationsdaten fehlen (z. B. Zigbee-Ausfall), werden Schlafphasen auf Basis des verfügbaren Zeitfensters neu berechnet sobald der Sensor wieder liefert. Kein dauerhafter Datenverlust.

#### Außerhalb-Bett-Events (outsideBedEvents — ab v0.33.65, erweitert v0.33.74)

Nächtliche Aktivität außerhalb des Betts (Bad, Küche, Wohnzimmer, Diele, …) wird als farbige Dreiecks-Marker und farbige Balken im Schlafbalken sichtbar gemacht.

**Erkennungsquellen (kombiniert, 3 Phasen):**

| Phase | Quelle | Methode | Typ |
|---|---|---|---|
| 1 | FP2-Bett-Radar | Bett wechselt von "belegt" auf "leer" und zurück (exakter Zeitstempel) | Vorrang vor Motion |
| 2 | Alle Nicht-Schlafzimmer-Sensoren | Alle `motion`/`presence_radar_bool` Sensoren die NICHT `isFP2Bed`/`isVibrationBed`/`isBedroomMotion` sind, feuern während Schlaffenster | Fallback + Ergänzung |
| 3 | Merge | FP2-Events haben Vorrang; Motion-Events füllen Lücken wo FP2 nicht reagiert hat | Keine Duplikate |

**Clustering (Phase 2):**
- Events innerhalb von **5 Minuten** ? ein gemeinsames Ereignis (z. B. Bad + kurzes Wohnzimmer)
- **3 Minuten** Puffer nach letztem Event (damit kurze Besuche nicht auf 0 Min schrumpfen)

**Typ-Bestimmung (ab v0.33.74):**

| Typ | Farbe | Bedeutung | Bedingung |
|---|---|---|---|
| `bathroom` | ?? Orange `#ffb300` | Bad-Besuch bestätigt | Bad-Sensor hat gefeuert |
| `outside` | ?? Rot `#e53935` | Bestätigt: du warst außerhalb | Einpersonenhaushalt ODER Mehrpersonenhaushalt + FP2 bestätigt Bett leer |
| `other_person` | ?? Blau `#1e88e5` | Andere Person im Haus aktiv | Mehrpersonenhaushalt + FP2 zeigt Bett noch belegt ODER kein FP2 vorhanden |

**Mehrpersonenhaushalt-Logik (ab v0.33.74):**
- Konfiguration über `householdSize` in Admin-Settings (`single` / `couple` / `family`)
- Mit FP2-Bett-Sensor: Event gilt als `outside` (du) nur wenn FP2 Bett-leer-Periode überlappt
- Ohne FP2-Bett-Sensor: alle Außer-Schlafzimmer-Events ? `other_person` (nicht sicher zuordenbar)

**Dreiecks-Marker (ab v0.33.74):**
- Unicode-Dreiecke `?` / `?` statt kleiner Buchstaben
- Schriftgröße 15px, fettgedruckt — deutlich sichtbar
- Farbe entspricht dem Event-Typ (orange/rot/blau)

**Snapshot-Timing (ab v0.33.74):**
- Cron läuft jetzt um **23:59:59** statt 23:59:00
- Events in der letzten Minute des Tages (z. B. 23:59:52) werden korrekt erfasst

**Schlaf-Radar 22:00–23:59 (ab v0.33.74):**
- Slots 44–47 nutzen `outsideBedEvents` als ergänzende Quelle
- Löst Diskrepanz: OC-7-Balken und Schlaf-Radar zeigen jetzt konsistente Daten für Ereignisse kurz vor Mitternacht

**Freeze-Supplement:**
Wenn ein Snapshot bereits eingefroren war (echte Nacht gespeichert) und `outsideBedEvents` leer ist (z.B. nach Adapter-Neustart), werden die gespeicherten Events aus dem Snapshot wiederverwendet.

**Motion-only Setups (kein Vibrationssensor, kein FP2 — ab v0.33.102):**

Für Häuser **ohne** FP2-Bett-Sensor oder Vibrationssensor (z.B. reine Bewegungsmelder-Setups wie Gondelsheim):
- `_sleepFrozen` wird auch dann aktiviert wenn per-Person `wakeConfirmed = true` (statt auf `sleepStages.length > 0` zu warten)
- Dadurch: historisches Schlaffenster bleibt erhalten wenn abends eine neue Nacht beginnt
- OBE-Erkennung (Phase 2: Bad-Sensor) läuft korrekt mit dem Vornacht-Fenster
- **Keine Schlafphasen-Balken** (kein Sensor dafür), aber **orangene ? Dreiecke** für Bad-Besuche werden angezeigt

**Motion-only "Bett war leer"-Verhalten (ab v0.33.102):**

| Zeitpunkt | Was passiert | Anzeige |
|---|---|---|
| Nachmittag (nach Aufwachen, vor 20:00) | `wakeConfirmed: true`, historisches Fenster korrekt | Schlafzeit + Aufwachzeit korrekt ? |
| Abends (~21:00-23:00, neue Nacht beginnt) | Ohne Fix: `_pSleepStart` springt auf heute Abend ? invertiertes Fenster ? "Bett war leer" | Mit Fix (v0.33.102): historisches Fenster (gestern 18:00 ? heutiger Wachzeitpunkt) ? korrekte Anzeige ? |
| Morgens | Normales Vornacht-Fenster, alles korrekt | ? |

#### AURA-Sleepscore: V2-Formel + Kalibrierung (OC-Score-V2, ab v0.33.98)

**Was der Nutzer in der Kachel sieht:**

```
    [ 80 ]            ? Angezeigter Score (groß, farbig)
  AURA-Sleepscore
  ? kalibriert (21N) ? Statusbadge
  AURA: 89           ? Unkalibrierter Rohwert (nur wenn kalibriert + Abweichung)
  ?? 8h 57min        ? Schlafdauer
  Garmin: 39 (-41)   ? Garmin-Referenz + Delta zum angezeigten Score
```

**Bedeutung der drei Werte:**

| Wert | Bedeutung | Quelle |
|---|---|---|
| **80** (großer Score) | Kalibrierter AURA-Score = AURA-Rohwert + persönlicher Garmin-Offset | `sleepScoreCal` |
| **AURA: 89** | Unkalibrierter AURA-V2-Rohwert, basiert auf Schlafdauer + Sensorphasen | `sleepScore` |
| **Garmin: 39** | Messwert der Smartwatch (HRV + SpO2 + Herzrate + Bewegung) | Garmin-State |

**Warum weichen AURA und Garmin ab?**
Garmin nutzt Hardware-Sensoren (HRV, Puls, SpO2). Ein AURA-Score von 89 bei Garmin 39 zeigt: unsere Sensoren erkennen die Schlafqualität des Nutzers deutlich besser als Garmin ? nach Kalibrierung wird der angezeigte Score (80) dem Garmin-Durchschnitt angenähert.

> **Hinweis:** Ein einzelner sehr niedriger Garmin-Wert (z.B. 39 bei 8h57min Schlaf) kann auf Garmin-spezifische Einflussfaktoren hinweisen (Alkohol, Stressmarker in HRV, Schlafposition). Der kalibrierte AURA-Score ist das Mittel aus N Nächten, nicht nur ein einzelner Abend.

**Statusbadge-Bedeutung:**

| Badge | Status | Bedeutung |
|---|---|---|
| ? unkalibriert (grau) | < 7 Nächte mit Smartwatch | Nur AURA-Rohformel, kein Garmin-Offset |
| ? kalibriert (N/14N) (orange) | 7–13 Nächte | Kalibrierung läuft ein, wird stabiler |
| ? kalibriert (NN) (grün) | = 14 Nächte | Stabile Kalibrierung, Offset zuverlässig |

**Technische Umsetzung (für Entwickler):**
- `sleepScore` = `max(20, min(95, 25 + 0.12 × sleepDurMin))` ± Phasen-Adj (±8 Pkt)
- `sleepScoreCal` = `sleepScore + mean(garmin - aura)` über letzte 60 Nächte mit beiden Scores
- `sleepScoreCalStatus`: `uncalibrated` | `calibrating` (7–13N) | `calibrated` (=14N)
- History: `analysis.health.sleepScoreHistory` — rolling 60 Nächte `{date, aura, garmin}`

---

#### RAUM-NUTZUNG (MOBILITÄT)
⚠️ Kein TerminalBox-Tooltip vorhanden. Einzelne Raumzeilen haben Hover-Titel (`title={...}`) mit Minuten + Trend.
**TODO:** helpText auf der TerminalBox ergänzen.

#### AKTIVITÄTS-HEATMAP (7/30 Tage × 24h)
⚠️ Kein Tooltip vorhanden.
**TODO:** helpText ergänzen.

#### 30/7-TAGE-ÜBERSICHT (Tabelle)
⚠️ Kein Tooltip vorhanden.
**TODO:** helpText ergänzen.

#### 🌙 NACHT-PROTOKOLL
✅ `src: HealthTab.tsx Zeile ~2077`
> Zeigt den KI-generierten Schlafbericht der letzten Nacht (Gemini). Enthält Analyse der Schlafqualität, Bewegungsereignisse zwischen 22:00 und 08:00 Uhr und Vergleich mit dem persönlichen Normalverhalten.

#### ☀️ TAGES-SITUATION
✅ `src: HealthTab.tsx Zeile ~2081`
> KI-generierter Tagesbericht (Gemini). Zusammenfassung der heutigen Aktivitätsmuster, besuchter Räume und auffälliger Ereignisse. Wird täglich aktualisiert.

#### DIAGNOSE & VITALITÄT
✅ `src: HealthTab.tsx Zeile ~2088`
> Zeigt den Gesundheits-Score (0–1). Ein KI-Modell vergleicht dein aktuelles Bewegungsmuster mit deinem persönlichen Normalverhalten. Score unter 0.3 = unauffällig. Das Modell trainiert sich automatisch sobald 7+ Tage Daten vorliegen – bis dahin zeigt es 0.10 (kein Modell).

#### ENERGIE-RESERVE (AKKU)
✅ `src: HealthTab.tsx Zeile ~2117`
> Metapher für das Aktivitätsniveau: Hohe Aktivität = voller Akku. Die Kurve zeigt den Verlauf über den Tag. Rote Zonen = ungewöhnlich hohe oder niedrige Aktivität im Vergleich zum persönlichen Durchschnitt.

#### FRESH AIR
✅ `src: HealthTab.tsx Zeile ~2131`
> Zeigt wie oft heute Tür/Fenster-Sensoren (Typ: Tür/Fenster) geöffnet wurden. Stoßlüftung = mind. 5 Min offen. Empfehlung: 3× täglich =5 Min (Forschungsbasiert: DIN EN 15251, Pettenkofer-Zahl).

#### MAHLZEITEN
✅ `src: HealthTab.tsx Zeile ~2150`
> Schätzt Mahlzeiten-Zeitpunkte anhand von Küchenaktivität. Die Zeiten sind Schätzungen basierend auf Bewegungsmustern, keine exakten Messungen.

#### BAD / HYGIENE (Tagesansicht)
✅ `src: HealthTab.tsx Zeile ~2164`
> Zeigt die heutige Badezimmer-Nutzung in Minuten aktiver Bewegung. Nur als Bad markierte Sensoren werden berücksichtigt. Thermostate werden ignoriert.

---

### Tab: Handbuch (Help.tsx) — In-App-Dokumentation (vollständige Texte)

Das Handbuch ist als aufklappbare Accordion-Sektionen im Admin-Frontend realisiert. Hier die vollständigen Texte 1:1:

---

#### 0. Wichtiger Rechtlicher Hinweis (Disclaimer)

> Diese Software ist KEIN Medizinprodukt gemäß der Verordnung (EU) 2017/745 (MDR).
>
> 1. **Zweckbestimmung:** Cogni-Living dient ausschließlich der Unterstützung der allgemeinen Lebensführung (Ambient Assisted Living), dem Komfort und reinen Informationszwecken.
>
> 2. **Keine Diagnose/Therapie:** Die bereitgestellten Daten, Analysen, Gesundheits-Scores und Alarme sind nicht dazu geeignet, Krankheiten zu diagnostizieren, zu behandeln, zu heilen oder zu verhindern. Sie ersetzen keinesfalls die fachliche Beratung, Diagnose oder Behandlung durch einen Arzt.
>
> 3. **Haftungsausschluss:** Verlassen Sie sich in gesundheitlichen Notfällen nicht auf diese Software. Bei gesundheitlichen Beschwerden konsultieren Sie bitte sofort medizinisches Fachpersonal. Der Entwickler übernimmt keine Haftung für Schäden, die aus der Nutzung, Fehlfunktion oder Interpretation der Daten entstehen.

---

#### 1. Einrichtung & Auto-Discovery

> - **Schritt A: Lizenz & KI** — Geben Sie im Tab 'Einstellungen' Ihren Google Gemini API Key ein.
> - **Schritt B: Sensoren finden** — Nutzen Sie den 'Auto-Discovery Wizard'. Die Erkennung basiert auf einer Heuristik (Gerätenamen, Rollen).
> - **Schritt C: Kontext** — Beschreiben Sie im Feld 'Wohnkontext' die Situation (z.B. 'Rentnerin, 82, lebt allein').

---

#### 2. Sicherheits-Modi

> - **NORMAL** — Standard-Analyse (Inaktivität, Routinen).
> - **URLAUB** — Haus leer. Jede Bewegung ist Alarm.
> - **PARTY / GAST** — Tolerant. Ignoriert späte Zeiten. Reset 04:00 Uhr.

---

#### 3. Die Neuro-Architektur (3-Phasen-Modell)

Das System überwacht die Gesundheit auf drei zeitlichen Ebenen. Jede Ebene adressiert ein spezifisches medizinisches Risiko und nutzt eine eigene technische Erkennungsmethode.

**Phase 1: Der Sofort-Schutz (Ad-Hoc / Realtime)**
> *Medizinisches Ziel:* Erkennung von unmittelbaren Notfällen (z.B. Person stürzt morgens auf dem Weg zur Küche und steht nicht mehr auf).
>
> *Technisches Problem:* Ein starrer Timer ("Alarm nach 12h Inaktivität") ist oft zu langsam. Wenn um 06:00 Uhr Bewegung war, käme der Alarm erst um 18:00 Uhr — viel zu spät.
>
> *Die KI-Lösung ("Erwartungshaltung"):* Das System sendet bei jedem Check (alle 15 min) einen speziellen `dynamicSafetyPrompt` an die KI: "Ist es basierend auf der Uhrzeit verdächtig still? Fehlt eine Routine, die normalerweise jetzt stattfindet?" Beispiel: Es ist 08:30 Uhr. Normalerweise ist jetzt Aktivität im Flur. Heute nicht. ? **Sofortiger Alarm**, obwohl der 12h-Timer noch nicht abgelaufen ist.

**Phase 2: Die Akute Abweichung (STB / 14 Tage)**
> *Medizinisches Ziel:* Erkennung von plötzlich auftretenden Krankheiten (z.B. Harnwegsinfekt, Magen-Darm, akute Schlafstörung).
>
> *Informatik-Logik:* Das System bildet einen gleitenden Durchschnitt der letzten 14 Tage (STB). Vergleich: `Heute` vs. `STB (Ø 14 Tage)`.
>
> *Beispiel:* Baseline (14 Tage): Ø 3 Toilettengänge/Nacht. Heute: 5 Toilettengänge. ? **Warnung:** Signifikante Abweichung vom Kurzzeit-Mittelwert.

**Phase 3: Der Schleichende Drift (LTB / 60 Tage)**
> *Medizinisches Ziel:* Erkennung von langsamen Veränderungen, die im Tagesvergleich untergehen (z.B. abnehmende Mobilität, Vereinsamung, sich verfestigende Schlafstörungen).
>
> *Das Risiko ("Learning Crux"):* Wenn eine Person krank wird und 5 Tage lang 5x nachts aufsteht, darf die KI das nicht sofort als "neues Normal" akzeptieren.
>
> *Die Lösung (Der Anker):* Wir nutzen einen sehr trägen Langzeit-Wert (LTB = 60 Tage). Vergleich: `STB (letzte 2 Wochen)` vs. `LTB (letzte 2 Monate)`. Selbst wenn die letzten 14 Tage (STB) schlecht waren, bleibt der LTB (60 Tage) stabil. Erst wenn ein Zustand über Monate anhält, passt sich der LTB an.

---

#### 4. Der Butler (Komfort & Automation)

> Die KI analysiert Zusammenhänge zwischen Ereignissen. *Beispiel:* "Jeden Morgen um 07:00 Uhr, wenn Bewegung im Flur erkannt wird, schaltet der Bewohner 2 Minuten später das Licht im Bad an."
>
> *Vorschlags-System:* Wenn die KI ein solches Muster über mehrere Tage stabil erkennt (Konfidenz > 80%), generiert sie einen Automatisierungs-Vorschlag.

---

#### 5. Interaktive Alarme (Family Link)

> **?? Telegram (Interaktiv):** Sendet Alarme mit Action-Buttons direkt im Chat:
> - `[? Alles OK (Reset)]`: Setzt den Alarm im System sofort zurück. Die KI lernt, dass dies ein Fehlalarm war.
> - `[?? Rückruf anfordern]`: Sendet eine Bestätigung an das System, dass sich jemand kümmert.
>
> **?? Pushover (Notfall-Sirene):** Dient als "Wecker". Kritische Alarme werden mit Priorität 2 (Emergency) gesendet und müssen in der Pushover-App bestätigt werden ("Acknowledge"), um den Ton zu stoppen.

---

#### 6. Troubleshooting

> - **Sensoren fehlen?** ? Prüfen Sie ioBroker Räume/Funktionen oder nutzen Sie die Whitelist im Wizard.
> - **Status 'N/A'?** ? Drift-Analyse benötigt mind. 30 Tage Daten.
> - **Zu viele Sensor-Offline-Pushover?** ? Ab v0.33.66 gilt eine Schwelle von **7 Tagen** (statt 1 Tag) für Bewegungsmelder und Präsenzsensoren. Türsensoren und Temperatursensoren haben eigene Schwellen. KNX/Loxone/BACnet-Sensoren werden grundsätzlich nicht überwacht (kabelgebunden, kein Heartbeat erwartet). Pushover während der Nacht (22–08 Uhr) wird automatisch unterdrückt.
> - **Hue / Lampen als "Sensor-Ausfall" gemeldet?** Ab v0.33.133 werden Sensoren vom Typ `light` und `dimmer` komplett aus der Sensor-Gesundheitspruefung ausgeschlossen. Lampen senden nur bei aktivem Schaltvorgang - wer tagelang kein Licht benutzt, wuerde sonst faelschlicherweise eine Ausfall-Meldung bekommen.
> - **Batterie-Warnung nicht sichtbar?** ? Batterie-Discovery läuft alle 12 Stunden. Nach dem ersten Adapter-Start dauert es bis zu 12 Stunden bis die Discovery alle Sensoren gefunden hat. Den aktuellen Status kann man im ioBroker-Objekt `cogni-living.X.system.sensorBatteryStatus` einsehen.
> - **Batterie-State nicht automatisch gefunden?** ? Im Reiter "Einstellungen ? Sensoren ? Batterie-Konfiguration" kann pro Sensor manuell ein Batterie-Objekt-Pfad hinterlegt werden. Der Button "." öffnet den ioBroker-Objektbrowser.

---

#### 6b. Batterie-Monitoring (OC-15, ab v0.33.67)

Das Batterie-Monitoring überwacht alle batteriebetriebenen Sensoren automatisch.

**Discovery-Mechanismus (3-stufig):**
| Stufe | Methode | Beschreibung |
|-------|---------|-------------|
| 1 | Manuelle Konfiguration | Im Feld `batteryStateId` im Sensor-Tab eingetragene ID hat immer Vorrang |
| 2 | Alias-Rekonstruktion | Bei `alias.0.`-Objekten wird via `common.alias.id` das echte Gerät gefunden, dann `.battery` gesucht |
| 3 | Auto-Discovery | Im Gerätepfad (z.B. `zigbee.0.ABCD1234`) wird direkt ein `.battery`-Datenpunkt gesucht |

**Schwellenwerte:**
| Wert | Status | Aktion |
|------|--------|--------|
| > 20 % | Normal | Keine Aktion |
| = 20 % | Warnung | Anzeige im UI (oranges Badge) |
| = 10 % | Kritisch | Rotes Badge + Pushover täglich um 09:00 Uhr |

**Ausgeschlossene Sensoren:** KNX (`knx.`), Loxone (`loxone.`), BACnet (`bacnet.`), Modbus (`modbus.`) — kabelgebundene Protokolle ohne Batterie.

**ioBroker-State:** `cogni-living.X.system.sensorBatteryStatus` (JSON) — enthält für jeden erkannten Sensor: `id`, `stateId`, `level`, `isLow`, `isCritical`, `source`.

**Hinweis:** Batterie-Warnungen haben **keinen Einfluss auf den AURA-Score oder die Konfidenzwertung** — nur UI-Anzeige und Pushover.

---

#### 7. Hybrid-Engine & Installation

> Cogni-Living nutzt eine Hybrid-Architektur (Node.js + Python). Die Installation erfolgt einmalig per SSH-Konsole:
>
> ```bash
> cd /opt/iobroker/node_modules/iobroker.cogni-living
> sudo rm -rf .venv venv
> sudo python3 -m venv .venv
> sudo ./.venv/bin/pip install --upgrade pip setuptools wheel --no-cache-dir
> sudo ./.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu --no-cache-dir
> sudo ./.venv/bin/pip install -r python_service/requirements.txt --no-cache-dir
> sudo chown -R iobroker:iobroker .venv
> ```
>
> Nach Adapter-Neustart sollte erscheinen: `? Python Environment detected & healthy. Ready.`

---

#### 8. Schlafanalyse (OC-7) & AURA-Sleepscore *(ab v0.33.52)*

> Die OC-7-Kachel berechnet aus Vibrationssensor-Daten geschätzte Schlafphasen und einen Gesundheitsscore. Optional wird ein FP2-Präsenzradar oder Bewegungsmelder für präzise Zeiten genutzt.
>
> **Sensor-Anforderungen (Graceful Degradation — beste bis schlechteste Kombination):**
> - ?? **Optimal:** FP2-Radar (Bett) + Vibrationssensor ? präzise Einschlaf-/Aufwachzeit, Phasen, Außerhalb-Events
> - ?? **Gut:** Bewegungsmelder Schlafzimmer (Funktion: Bett/Schlafzimmer) + Vibrationssensor ? Einschlaf-/Aufwachzeit aus letzter/erster Bewegung, Phasen
> - ?? **Eingeschränkt:** Nur Vibrationssensor ? Phasen mit festem 20–09 Uhr Fenster, keine echten Zeiten
> - ? **Minimal:** Kein Raumsensor ? festes Fenster (Schätzung)
> - ? **Kein Sensor:** Kachel zeigt Konfigurationshinweis
>
> **Wichtig für Bewegungsmelder-Nutzer:** Den Sensor in der Sensor-Liste auf Funktion **"Bett / Schlafzimmer"** (lila) setzen — nur dann wird er für die Schlafanalyse genutzt!
>
    > **AURA-Sleepscore Formel:** `Score = Tief% × 200 + REM% × 150 + Leicht% × 80 - Wach% × 250`; Anzeige max. 100 (Rohwert `sleepScoreRaw` kann höher sein und wird im Badge als `? roh: X` sichtbar); Bonus +5 bei 7–9h Schlafdauer.
    >
    > **Dreiecks-Marker (ab v0.33.65):** Nächtliche Bad-/Küchenbesuche erscheinen als farbige Dreiecke im Schlafbalken. Quellen: FP2-Bett-leer-Erkennung (Vorrang) + Bad-/Küchen-Bewegungsmelder (Fallback). Typ bernstein = Bad, orange = Außerhalb.
>
> **Quellen:** Diekelmann & Born 2010 (Tiefschlaf), Walker 2017 / Stickgold 2005 (REM), AASM Guidelines (Leichtschlaf), Buysse et al. 1989 PSQI (WASO-Abzug).
>
> **Sensor-Indikatoren:** ?? FP2-Sensor (genau) | ?? Bewegungsmelder (gut) | ? Schätzung (Fixfenster)
>
> **Aufwachzeit ?/?:** `? vorläufig` bis 10:00 Uhr + 1h Bett leer bestätigt. Danach `? bestätigt`.
>
> **Sleep-Freeze:** Eine bestätigte Nacht (=3h Bettbelegung, Aufwachzeit vor 14:00) wird nicht durch spätere Aktivität oder Mittagsschlaf überschrieben.

---

**Noch fehlend in Help.tsx (TODO):**
- [ ] GANGGESCHWINDIGKEIT: Berechnung, Flursensor-Konfiguration
- [ ] DIAGNOSE & VITALITÄT: ML-Modell-Details, Score-Interpretation
- [ ] DRIFT-MONITOR: Page-Hinkley-Test Erklärung für Laien

### In-App-Handbuch-Dialog (Gesundheits-Tab, Button unten)

Separater Dialog `openDeepDive` mit Kurzfassung, enthält:
- Navigation (TAG/WOCHE/MONAT, LIVE-Modus, Pfeil-Navigation)
- Schlaf-Radar Erklärung (UNRUHE IM SCHLAFZIMMER / NÄCHTLICHE AKTIVITÄT)
- Langzeit-Trends (Aktivitätsbelastung, Ganggeschwindigkeit, Nacht-Unruhe, Raum-Mobilität, Bad-Nutzung, Frischluft-Index)
- Raum-Histogramme (Top 3, Mini-Histogramme, Anomalie-Erkennung)
- Lebenszeichen-Alarm (??/??/??)
- Konfigurationshinweise (Sensor-Liste, Flur-Checkbox, Reporting)

**TODO:** Dialog um OC-7 und Ganggeschwindigkeit-Details erweitern.

### Tab: System / Einstellungen

?? Kein Tooltip in Sensor-Liste, Reporting oder anderen System-Bereichen.
**TODO:** Spalten-Erklärungen (ID, Name, Raum, Typ, Funktion, Aktiviert) als Tooltips ergänzen.

---

## 📊 SCHLAFANALYSE (OC-7)

### Übersicht

Die OC-7-Kachel berechnet aus **Vibrationssensor-Daten** (Bett) geschätzte Schlafphasen und einen AURA-Sleepscore. Ergänzend werden FP2-Präsenzradar-Daten für die Erkennung von Einschlaf- und Aufwachzeit verwendet.

### Sensor-Konfigurationsebenen (Graceful Degradation)

| Kombination | Sensor-Indikator | Einschlafzeit | Aufwachzeit | Phasen | Außerhalb-Events |
|---|---|---|---|---|---|
| **FP2 + Vibrationssensor** | ?? FP2-Sensor | ? Exakt | ? Exakt | ? Vollständig | ? Ja |
| **Bewegungsmelder (Bett/Schlafzimmer) + Vibrationssensor** | ?? Bewegungsmelder + Vibration | ? Verfeinert via `motion_vib` (Vib + 20 Min Stille) | ?? Erste Bewegung >04:00 | ? Vollständig | ? Nein |
| **Nur Vibrationssensor** | ? Schätzung | ? Fix 20:00 | ? Fix 09:00 | ? Vollständig | ? Nein |
| **Nur FP2** | ?? FP2-Sensor | ? Exakt | ? Exakt | ? Keine | ? Ja |
| **Keine Raumsensoren** | — | — | — | — | — |

**Hinweis:** "Bewegungsmelder Schlafzimmer" = `type: motion` + `sensorFunction: bed` in der Sensor-Liste. Ohne `sensorFunction: bed` wird der Sensor ignoriert.

**Algorithmus Bewegungsmelder-Fallback (ab v0.33.152):**
- **Einschlafzeit ˜** letztes Bewegungs-Event (Schlafzimmer) zwischen 18:00–03:00 Uhr, das von mindestens **30 Minuten** Stille gefolgt wird (vorher: 45 Min; Fenster-Ende 04:00 als Fallback statt Date.now())
- **Aufwachzeit — 2-stufige Erkennung:**
  1. **Primär:** Erste Aktivität in einem *anderen* Raum (Flur, Wohnzimmer, Küche — nicht Schlafzimmer, nicht Bad) nach 04:00 Uhr + =3h seit Einschlafzeit ? sicherster Aufwach-Beweis
  2. **Fallback:** Schlafzimmer-Bewegung nach 04:00 Uhr + =3h + mindestens 20 Minuten danach keine weitere Schlafzimmer-Bewegung ? Person hat sich nicht wieder hingelegt
- **Vorteil gegenüber Fixfenster:** Echte Einschlaf- und Aufwachzeiten statt immer 20:00–09:00
- **Vorteil gegenüber alter Methode:** Toilettengänge kurz vor dem Aufstehen verschieben die Aufwachzeit nicht mehr, da zuerst Aktivität in anderen Räumen gesucht wird
- **Nachteil gegenüber FP2:** Erkennt keine Ruhephasen (liegend ohne Bewegung). Keine Außerhalb-Bett-Events.

**Nykturie-Zählung mit Bewegungsmelder:** `nocturiaCount` (nächtliche Badezimmerbesuche) nutzt dasselbe OC-7-Schlaffenster (FP2 ? Bewegungsmelder ? Fixfenster). Ohne FP2 wird also automatisch das Bewegungsmelder-Fenster für die Nykturie-Auswertung im Medical Tab verwendet.

### Einschlafzeit-Berechnung (FP2-basiert)

**Quelle:** FP2-Bett-Sensor (`type: presence_radar_bool`, `sensorFunction: bed`)

**Algorithmus:**
1. Durchsuche FP2-Events des Vortags ab 18:00 Uhr bis jetzt
2. Suche letzte Bettbelegung = 10 Minuten zwischen 18:00–03:00 Uhr
3. Startzeit dieser Belegung = Einschlafzeit

**Fallback:** Festes Fenster ab 20:00 Uhr (wenn kein FP2 konfiguriert)

### Aufwachzeit-Berechnung (FP2-basiert, ab v0.33.155)

**Algorithmus:**
1. Ab Einschlafzeit: Suche erste Bettleere = 15 Minuten zwischen 04:00–14:00 Uhr
2. Speichere `firstEmpty` = **Abgangszeitpunkt** (Beginn der Leerphase) ? das ist die echte Aufwachzeit
3. Speichere `end` = Endpunkt der Leerphase (Rückkehr oder Date.now()) ? dient als Schlaffenster-Ende für Score-Berechnung

**Zwei Zeitpunkte im System:**

| Variable | Bedeutung | Verwendung |
|---|---|---|
| `firstEmpty` | Wann das Bett zuerst leer wurde (echter Aufsteh-Zeitpunkt) | `fp2WakeTs` in `allWakeSources` |
| `sleepWindowCalc.end` | Wann die Leerphase endete (Rückkehr oder jetzt) | Schlaffenster-Ende für OC-7 Stages + Score |

**Vorläufig ? Final:**
- `? vorläufig` ? solange aktuelle Uhrzeit < 10:00 Uhr ODER < 1h seit Aufwachzeit
- `? bestätigt` ? ab 10:00 Uhr + mindestens 1h kein Bett mehr belegt

### Sleep-Freeze-Mechanismus

Verhindert, dass eine korrekt erkannte Nacht durch spätere Aktivität überschrieben wird:

- Bedingung: `sleepWindowEnd < 14:00 Uhr` AND `bedPresenceMinutes = 180 min`
- Wenn erfüllt: Einschlaf-/Aufwachzeit, Schlafphasen und Score werden eingefroren
- Abendliche Bettaktivität oder Mittagsschlaf überschreiben die Nacht nicht mehr
- ioBroker-Log: `[History] Sleep FROZEN: 23:28-07:36 bedPresMin=496`

### AURA-Sleepscore — Formel und wissenschaftliche Grundlage (V2, ab v0.33.98)

**Formel V2 (Dauer-basiert, kalibriert an AURA vs. Garmin, r=0.886):**
```
durScore    = max(20, min(95, 25 + 0.12 × sleepDurMin))
coverage    = totalStagedMin / sleepDurMin   (max 1.0)
stageAdj    = max(-8, min(8, round((REM% × 30 - Wach% × 50) × coverage)))
sleepScore  = max(0, min(100, round(durScore + stageAdj)))
```

**Kalibrierung an Garmin (nach = 7 Garmin-Nächten):**
```
offset         = mean(garminScore - auraScore) über letzte 60 Nächte
sleepScoreCal  = max(0, min(100, round(sleepScore + offset)))
```

**Begründung V2:**
- Schlafdauer ist mit r=0.886 der stärkste Prädiktor für den Garmin-Score (Analyse 15 Nächte)
- Vibrationssensor überklassifiziert Tiefschlaf (jede Stille = 10 min war früher "Tief") ? Proportions-basierte Formel ergab immer ~100
- REM und Wake bleiben als kleine Adjustierungen (±8 Pkt) erhalten, skaliert nach Coverage des Fensters
- Kalibrierter Score (`sleepScoreCal`) für Smartwatch-Nutzer: korrigiert individuelle Sensor-Eigenschaften (Matratzentyp, Körpergewicht, Partnereffekte)

**Scorebereich V2 (ungefähr):**
| Schlafdauer | Basisscore |
|---|---|
| 4h (240 min) | ~54 |
| 5h (300 min) | ~61 |
| 6h (360 min) | ~68 |
| 7h (420 min) | ~75 |
| 7,5h (450 min) | ~79 |
| 8h (480 min) | ~83 |
| 8,5h (510 min) | ~86 |
| 9h (540 min) | ~90 |

**Vergleich mit Garmin-Score:**
Der Garmin-Score nutzt zusätzlich HRV, Ruheherzrate, SpO2. AURA V2 schätzt den Garmin-Score über Schlafdauer an, da diese r=0.886 Korrelation zeigt. Der kalibrierte AURA-Score (`sleepScoreCal`) korrigiert verbleibende Abweichungen per linearem Offset.

**Status-Badge im Frontend:**
| Badge | Bedeutung |
|---|---|
| ? unkalibriert (grau) | < 7 Garmin-Nächte vorhanden — Rohformel wird angezeigt |
| ? kalibriert (N/14N) (orange) | 7–13 Garmin-Nächte — Kalibrierung läuft ein |
| ? kalibriert (NN) (grün) | = 14 Garmin-Nächte — Stabile Kalibrierung |

### Schlafphasen-Klassifikation (5-Minuten-Slots)

| Bedingung | Phase |
|---|---|
| 0 Vibrationen im Slot | Leichtschlaf (< 5 ruhige Slots in Folge) |
| 0 Vibrationen, = 5 ruhige Slots in Folge (25 min) | Tiefschlaf |
| = 5 Vibrationen ODER Stärke > 28 | Wach |
| = 2 Vibrationen + mittlere Stärke (12–28) + > 2,5h Schlaf | REM (geschätzt) |
| Sonstige Vibration | Leichtschlaf |

### Außerhalb-Bett-Ereignisse

Werden aus FP2-Events während des Schlaffensters berechnet:

| Ereignistyp | Erkennungsmethode | Farbe im Balken |
|---|---|---|
| Bad-Besuch | Bett leer + Bad-Sensor (isBathroomSensor) | Bernstein #ffb300 |
| Außerhalb | Bett leer (kein Bad-Sensor) | Orange-Rot #ff5722 |

**Dreiecks-Marker ? über dem Balken:**
- Gelbes Dreieck = Bad-Besuch
- Rotes Dreieck = Abwesenheit = 20 Minuten

### Farbkonzept (Best ? Schlimmste, Usability-Prinzip)

| Farbe | Phase | Hex | Bedeutung |
|---|---|---|---|
| Dunkelblau | Tiefschlaf | #1565c0 | Optimal, restaurativ |
| Hellblau | Leichtschlaf | #42a5f5 | Gut, transitional |
| Lila | REM | #ab47bc | Gut, emotional restaurativ |
| Gelb | Wach im Bett | #ffd54f | Milde Störung |
| Bernstein | Bad-Besuch | #ffb300 | Moderate Störung |
| Orange-Rot | Außerhalb Bett | #ff5722 | Deutliche Störung |

**Grundlage:** Standard UX-Konvention (Rot = schlimmste Farbe). Rot ist für die stärkste Störung reserviert.

### Sensor-Indikator-Symbole

| Symbol | Bedeutung |
|---|---|
| ?? FP2-Sensor | Zeiten aus FP2-Präsenzradar (genau) |
| ?? Bewegungsmelder | Zeiten aus Bewegungsmelder (eingeschränkt) |
| ?? Bewegungsmelder + Vibration | Einschlafzeit via `motion_vib` (kein FP2) |
| ?? Haus-wird-still | Einschlafzeit via Ruhe in Gemeinschaftsbereichen |
| ?? Vibrationssensor | Nur Phasen, Zeiten geschätzt |
| ? Schätzung | Festes Fenster 20:00–09:00 (kein Raumsensor) |

---

## 🔧 SENSOR-KONFIGURATION

### Universalität (Kern-Designprinzip)

AURA muss mit jeder Sensor-Ausstattung funktionieren:
- Kein Sensor ? keine Kachel (kein Fehler)
- Teilausstattung ? eingeschränkter Modus mit Hinweis
- Vollausstattung ? alle Features aktiv

### Sensor-Typen und Funktionen

| Typ (d.type) | Funktion (d.sensorFunction) | Verwendung |
|---|---|---|
| presence_radar_bool | bed | OC-7 Einschlaf-/Aufwachzeit, Bett-Präsenz |
| vibration | bed | OC-7 Schlafphasen-Klassifikation |
| motion | bathroom | OC-7 Bad-Besuch-Erkennung |
| motion | hallway | Ganggeschwindigkeit |
| motion | — | Allgemeine Aktivitätserkennung |

### FP2-Zuverlässigkeit und Sensor-Fusion

**Problem:** FP2 kann bei Tiefschlaf unter dicker Bettdecke Falsch-Negative liefern.

**Sensor-Fusion-Logik:**
```
FP2 = "da"                               ? Im Bett (sicher)
FP2 = "weg" + Vibration kürzlich aktiv   ? Wahrscheinlich noch im Bett
 + KEIN Außensensor                         (FP2 Falsch-Negativ)
FP2 = "weg" + Außensensor aktiv          ? Definitiv außerhalb
FP2 = "weg" + keine Aktivität            ? Tiefer Schlaf ODER aufgestanden
 + kein Außensensor                         (Kontext aus Geschichte)
```

**Einzel- vs. Mehrpersonenhaushalt:**
- Einzelperson: jede Außenbewegung = diese Person
- Mehrpersonen: Außenbewegung kann andere Person sein ? vorsichtigere Interpretation

---

## 📌 SENSOR-VORAUSSETZUNGEN JE SCHLAFKACHEL-ELEMENT

Diese Tabelle beschreibt, welche Sensoren für jedes sichtbare Element der Schlafkachel benötigt werden. Sortiert von **unzuverlässig ? zuverlässig**.

### Schlafbalken (Schlafphasen: Tief / Leicht / REM / Wach)

| Zuverlässigkeit | Sensor-Kombination | Qualität |
|---|---|---|
| Keine | Nur PIR (Bewegungsmelder) | Kein Balken — nur Zeiten |
| Niedrig | Nur FP2-Radar am Bett | Kein Balken — FP2 liefert keine Vibrations-Events |
| Mittel | Vibrationssensor am Bett (allein) | Balken erscheint ab der ersten Nacht. Erste Nacht evtl. verrauscht. |
| Gut | PIR + Vibrationssensor am Bett | Balken + präzisere Einschlafzeit |
| Sehr gut | FP2 + Vibrationssensor am Bett | Balken + genaue Bett-Präsenz + Einschlafzeit |
| Referenz | Garmin-Uhr | Garmin-Stages als Overlay (keine AURA-Stages erforderlich) |

> **Wichtig:** `sensorFunction === 'bed'` und `type === 'vibration_trigger'` oder `vibration_strength` sind Pflicht für den Balken.

### Einschlafzeit / Aufwachzeit

| Zuverlässigkeit | Quelle | Symbol |
|---|---|---|
| Niedrig | Festes Fenster 20:00–09:00 (kein Raumsensor) | ? |
| Niedrig | Fenster-Start Fallback (`winstart`) | ? |
| Mittel | Haus-wird-still (Gemeinschaftsbereiche) | 📡 |
| Mittel | Letzter Außenraum-Sensor dieser Person | 📡 |
| Gut | 60-Min-Bett-Gap via PIR oder Vibrationssensor | ??? |
| Sehr gut | FP2-Radar am Bett (Bett-Präsenz =10 Min) | 📡 |
| Referenz | Garmin-Uhr | ? |

### Außerhalb-Dreiecke ?? (Bad-Besuch / Aufstehen)

| Voraussetzung | Beschreibung |
|---|---|
| **Pflicht:** FP2-Radar am Bett | Nur FP2 kann "Bett leer" zuverlässig erkennen |
| Optional: Bad-Sensor | Unterscheidet Bad-Besuch (bernstein) von sonstigem Aufstehen (orange-rot) |

> Ohne FP2-Radar: keine Dreiecke, unabhängig von anderen Sensoren.

### AURA-Sleepscore

| Voraussetzung | Auswirkung |
|---|---|
| Vibrationssensor am Bett | Score wird berechnet (Tiefschlaf-Anteil zählt 200 Punkte, REM 150) |
| Kein Vibrationssensor | Score basiert nur auf Schlafdauer (75 % Gewichtung) — unvollständig |
| Garmin vorhanden | Garmin-Score wird als lila Referenzpunkt daneben angezeigt |

### Kalibrierungsphase (erste Nächte mit neuem Sensor)

Vibrationssensoren benötigen **keine Lernphase** — Schlafphasen werden ab der ersten Nacht berechnet. Voraussetzung: der Sensor muss während des Schlafs mindestens ~10–20 Vibrationen aufzeichnen (Mindestsensitivität prüfen, falls der Balken leer bleibt).

**Typische Erstinbetriebnahme-Probleme:**
- Balken leer trotz installiertem Vibrationssensor ? Adapter wurde tagsüber neugestartet ? Freeze-Schutzmechanismus hat eine leere Nacht eingefroren. Abhilfe: Adapter erneut starten oder bis zur nächsten Nacht warten.
- Wenige Ereignisse (< 5) ? Sensor ist zu weit vom Körper entfernt oder Empfindlichkeit zu niedrig.

---

## 📊 OC-10: SCHLAF-SCORE WOCHENANSICHT *(ab v0.33.63)*

### Übersicht

Im AURA MONITOR (Tab „Gesundheit") erscheinen bei Auswahl von **WOCHE** oder **MONAT** zwei neue Diagramme unterhalb der Übersichtstabelle:

### Option A — AURA-Sleepscore (Balken-Chart)

- **Datenbasis:** `snapshot.sleepScore` (0–100) pro Nacht
- **Darstellung:** Ein Balken pro Nacht, farbkodiert:
  - Grün =80 (gut)
  - Orange 60–79 (mittel)
  - Rot <60 (schlecht)
- **Garmin-Overlay:** Lila Punkt auf Balken-Höhe des Garmin-Scores (wenn vorhanden)
- **Kopfzeile:** Durchschnittsscore der angezeigten Nächte

### Option B — Schlafphasen-Anteile (Gestapelter Balken-Chart)

- **Datenbasis:** `snapshot.sleepStages` (Array `[{t, s}]`)
- **Darstellung:** Gestapelter Balken pro Nacht, von oben nach unten:
  - Dunkelblau = Tiefschlaf (`deep`)
  - Hellblau = Leichtschlaf (`light`)
  - Lila = REM-Schlaf (`rem`)
  - Gelb = Wachliegen (`wake`)
- **Score-Linie:** Gestrichelter weißer Overlay-Verlauf des AURA-Scores
- **Kopfzeile:** Durchschnittliche Tief% und REM% der angezeigten Nächte

### Technische Details

- Implementiert in `src-admin/src/components/tabs/HealthTab.tsx`
- Reines SVG (kein recharts), AURA MONITOR Terminal-Stil
- Beide Charts erscheinen nebeneinander (CSS Grid 1fr 1fr)
- Fallback: Nur Score-Chart wenn keine Stages vorhanden (und umgekehrt)
- Zeigt „Keine Schlaf-Score-Daten verfügbar" wenn weder Score noch Stages in den Snapshots

---

## 📚 LITERATURVERZEICHNIS

- Buysse, D.J. et al. (1989). *The Pittsburgh Sleep Quality Index (PSQI)*. Psychiatry Research, 28(2), 193-213.
- Carskadon, M.A. & Dement, W.C. *Normal Human Sleep: An Overview*. In Principles and Practice of Sleep Medicine, AASM.
- Diekelmann, S. & Born, J. (2010). *The memory function of sleep*. Nature Reviews Neuroscience, 11(2), 114-126.
- Stickgold, R. (2005). *Sleep-dependent memory consolidation*. Nature, 437, 1272-1278.
- Walker, M. (2017). *Why We Sleep*. Scribner.

---

## 📋 OFFENE DOKUMENTATIONSTHEMEN

- [x] Dead-Man-Schalter (OC-4): Algorithmus-Dokumentation **v0.33.133**

### Schutzengel (Dead-Man-Schalter, OC-4) — ab v0.33.133

**Zweck:** Erkennt wenn eine Person ungewoehnlich lange in einem Raum verweilt und nicht mehr reagiert (Sturz, Bewusstlosigkeit, medizinischer Notfall).

**Funktionsweise (ab v0.33.133 — Globale Aktivitaetspruefung):**
- Jede Bewegung (PIR, Radar, Tuerkontakt) in IRGENDEINEM konfigurierten Raum setzt den Timer zurueck
- Kein Topologie-Filter mehr: die fruuhere Pruefung "ist Raum B direkt mit Raum A verbunden?" wurde entfernt
- Grund: PIR-Sensoren haben Hold-Times (oft 30-120 Sek.) — beim Verlassen eines Raums kann der Durchgangsraum-Sensor keinen neuen Rising-Edge senden wenn er noch auf "besetzt" steht
- Zusaetzlich: Tuer-Kontakt-Events (type=door) loesen jetzt ebenfalls einen Timer-Reset aus

**Per-Raum-Timeouts:**
| Raumtyp | Standard-Timeout | Erweiterung |
|---------|-----------------|-------------|
| Bad, Bath | 45 Min | +90 Min bei Smart-Sleep-Erkennung |
| WC, Toilette | 30 Min | — |
| Schlafzimmer, Bed | 120 Min | +90 Min nachts/Siesta |
| Keller | 60 Min | — |
| Gaestezimmer | 90 Min | — |
| Alle anderen | kein Timer | (kein Monitoring) |

Individuelle Timeouts konfigurierbar unter: Sicherheit ? Schutzengel ? Raum-Timeouts

**Alarm-Ablauf:**
1. Timer laeuft ab ? Schutzengel-Frage (Pre-Warn) via Pushover
2. Keine Reaktion nach 5 Min ? Notfall-Alarm (Priority 2, muss bestaetigt werden)

**Smart Sleep Erkennung:**
Wenn Uhrzeit + Raum auf Schlaf/Siesta hindeuten (Wahrscheinlichkeit > 65%), wird der Timer automatisch um 90 Minuten verlaengert um Fehlalarme bei Nickerchen zu vermeiden.

- [ ] Ganggeschwindigkeit: Berechnung und Sensor-Anforderungen
- [ ] Nykturie-Erkennung: Definition und Schwellenwerte
- [x] Wochenansicht Sleep-Score: **implementiert v0.33.63** — AURA MONITOR WOCHE/MONAT-View, Option A + B (siehe unten)
- [ ] Handbuch-Tab im Admin-Interface: Inhalte synchron halten

---

*Zuletzt aktualisiert: 16.04.2026 | Version: 0.33.155*


---

## 🚶 Kurzes Aufstehen in der Nacht — wie AURA damit umgeht (ab v0.33.191)

### Was passiert, wenn jemand nachts kurz aufsteht?

Jeder kennt es: Man schläft um 22 Uhr ein, steht kurz nach 2 Uhr auf — Toilette, ein Glas Wasser, eine Tablette — und legt sich wieder hin. Diese kurze Unterbrechung hat mit dem eigentlichen Einschlafen nichts zu tun.

Ohne eine spezielle Erkennung könnte AURA diese Bewegungen aber falsch interpretieren: Der Bewegungsmelder im Flur schlägt um 2:44 Uhr an, der Sensor im Schlafzimmer kurz danach. Für einen "dummen" Algorithmus sieht das aus wie: *"Person hat gerade das Bett verlassen und ist zurückgekommen — vielleicht ist das der Einschlafzeitpunkt."* Ergebnis: AURA zeigt 2:46 Uhr als Einschlafzeit an, obwohl die Person bereits seit 22 Uhr schläft.

### Das Beispiel aus der Praxis (Robert, 21./22.04.2026)

Robert legt sich um **21:30 Uhr** ins Bett. Der Matratzensensor bestätigt das. Um **2:44 Uhr** steht er kurz auf (Flur-Bewegungsmelder schlägt an), um **2:51 Uhr** ist er wieder im Schlafzimmer.

Ohne den Filter: AURA wertet die 2:44-Bewegung als mögliche Einschlafzeit und wählt **2:46 Uhr** — komplett falsch.

Mit dem Filter: AURA erkennt das Muster "kurz raus, kurz rein" und ignoriert diese Zeitspanne. Die Einschlafzeit bleibt bei **21:30 Uhr**.

### Wie erkennt AURA das Muster?

AURA überwacht während der Nacht (21:00–09:00 Uhr) alle Bewegungssensoren im Haus und sucht nach folgendem Muster:

1. **Jemand verlässt das Schlafzimmer** — ein Bewegungsmelder außerhalb des Schlafzimmers schlägt an (Flur, Bad, Küche — maximal 4 "Türen" vom Schlafzimmer entfernt, damit entfernte Räume wie Keller ignoriert werden)
2. **Jemand kehrt innerhalb von 20 Minuten zurück** — der Schlafzimmer-Sensor schlägt wieder an

Wenn dieses Muster erkannt wird, sagt AURA: *"In diesem Zeitraum war jemand kurz auf — alle Sensordaten aus diesem Fenster ignorieren wir für die Einschlafzeit-Berechnung."*

### Was wird ignoriert, was nicht?

Wenn ein solcher kurzer Ausflug erkannt wird, werden Sensordaten aus diesem Zeitraum **nicht** als Einschlafzeitpunkt gewertet — aber nur für weniger zuverlässige Quellen:

| Quelle | Wird gefiltert? | Warum |
|---|---|---|
| Smartwatch (Garmin, Fitbit) | **Nein** | Die Uhr wird durchgehend getragen und erkennt den Schlafzustand unabhängig von Bewegungen im Haus |
| Radar-Sensor (FP2/mmWave) kombiniert | **Nein** | Radar erkennt Atem und Mikrobewegungen — wurde beim Einschlafen kalibriert und ändert sich durch kurzes Aufstehen nicht |
| Radar-Sensor allein | **Nein** | Gleicher Grund |
| Matratzensensor (Vibration verfeinert) | **Ja** | Dieser Sensor misst "wann war die Matratze zuletzt längere Zeit still" — nach einem Aufstehen und Zurücklegen kann dieser Wert zurückgesetzt werden und eine falsche Zeit anzeigen |
| Bewegungsmelder, Lücken-Erkennung, "Haus still" | **Ja** | Diese Quellen sind direkt von den Bewegungen betroffen |

### Was passiert bei längerer Abwesenheit? (OC-31 Stage 2)

Wer länger als 20 Minuten aufbleibt — oder sogar 2 Stunden am PC sitzt — wird von **Stage 2** der Schlafzustandsmaschine erfasst. Hier gilt das Prinzip: **einmal eingeschlafen, immer eingeschlafen** (in dieser Nacht).

**Beispiel:** Robert schläft um 22:08 ein. Um 23:50 geht er zum PC (2 Stunden). Um 02:30 kommt er zurück ins Bett. AURA zeigt:
- Einschlafen: **22:08** (bleibt eingefroren)
- Schlafbalken: 22:08–23:50 Schlaf, 23:50–02:30 **gelber Wachphasen-Block**, ab 02:30 wieder Schlaf
- Schlafeffizienz: korrekt berechnet (PC-Zeit abgezogen)

Stage 2 erkennt dabei beliebig viele Wachphasen pro Nacht (mehrfaches Aufstehen).

### 🛏 Wann bin ich ins Bett gegangen? ("Ins-Bett-Zeit")

Seit v0.33.194 erkennt AURA auch, **wann eine Person das Bett betreten hat** — unabhängig davon, wann sie eingeschlafen ist. Diese "Ins-Bett-Zeit" wird im Schlafbalken als gelbes Segment **vor der Einschlafzeit** dargestellt.

**Warum ist das interessant?**
- Garmin zeigt nur "eingeschlafen um HH:MM" — AURA zeigt zusätzlich "ins Bett um HH:MM"
- Die Differenz = Einschlaf-Latenz ("Wie lange brauche ich zum Einschlafen?")
- Ideal: Einschlaf-Latenz < 20 Min. Regelmäßig > 30 Min kann auf Einschlafprobleme hinweisen.

**Wie wird die Ins-Bett-Zeit erkannt?**

Ab v0.33.198 nutzt AURA einen **Cluster-Algorithmus** — derselbe, der auch die Einschlafzeit bestimmt. Dadurch werden kurze Fehlauslösungen (z.B. Radar meldet "Bett belegt" für 30 Sekunden beim Vorbeigehen) zuverlässig ignoriert.

| Sensor | Erkennungs-Logik |
|---|---|
| Radar (FP2/mmWave) | Frühstes Radar-Signal im Einschlaf-Cluster (max. 90 Min vor Einschlafzeit) |
| Vibrationssensor (Matratze) | Frühstes Vibrationssignal im Cluster — auch ohne FP2 |
| Bewegungsmelder (Schlafzimmer) | Frühstes PIR-Signal im Cluster — Fallback |

**Warum Cluster statt "erstes Signal"?** Wenn der Radar um 19:22 kurz anspringt (z.B. beim Aufräumen), aber die eigentliche Schlafenszeit erst um 22:30 beginnt, filtert der Cluster-Algorithmus das Frühsignal automatisch heraus — weil es >90 Minuten von der Einschlafzeit entfernt liegt.

Der Zeitstempel erscheint als **"🛏 HH:MM"** links unten am Schlafbalken (statt der Einschlafzeit).

### Logs für die Fehleranalyse

Im System-Log erscheint bei erkanntem Nacht-Aufstehen:
```
[cPS:global] OC-31: 1 Nacht-Aufstehen erkannt: 02:44-02:51 (flur_motion)
[cPS:global] OC-31: 2 Kandidaten als Nacht-Aufstehen gefiltert.
```

---

### ⚡ Hinweis: "Sensor temporär zu sensibel" (gelbe Warnung)

Wenn im Schlafbalken eine orange Warnung erscheint ("Zigbee EG Wohnen Bewegung: 12 Auslösungen nachts — evtl. zu sensibel"), hat AURA diesen Sensor für die Nacht-Analyse als **überdurchschnittlich aktiv** eingestuft und **vorübergehend** aus der Haus-wird-still-Berechnung herausgenommen.

**Warum passiert das?**
Wenn ein Bewegungsmelder deutlich häufiger auslöst als alle anderen Sensoren (≥3× Median UND ≥10 Events im Schlaffenster), schützt AURA die Einschlaf-Erkennung vor Fehlauslösungen durch diesen Sensor.

**Wie lange dauert der Ausschluss?**
Der Ausschluss gilt nur für **eine Nacht**. Beim nächsten Morgen wird automatisch neu bewertet. Wenn der Sensor wieder normal viele Auslösungen zeigt, ist er automatisch wieder dabei — ohne Eingriff.

**Ab v0.33.198:** Das Zählzeitraum startet erst **60 Minuten vor der Einschlafzeit** (statt immer um 22:00 Uhr). Damit werden normale Abend-Bewegungen im Wohnzimmer (Fernsehen, Küche) nicht mehr fälschlicherweise als Rauschen gewertet.

**Was kann ich tun?**
In den meisten Fällen ist nichts nötig — AURA korrigiert sich automatisch. Wenn der Sensor dauerhaft zu viele Auslösungen zeigt (z.B. zu hohe PIR-Empfindlichkeit), kann die Empfindlichkeit am Sensor selbst angepasst werden.

---

### 📊 Bett-Präsenz ohne FP2-Radar

Haushalte ohne FP2/mmWave-Radar (z.B. nur Vibrationssensor oder Bewegungsmelder) zeigen in der Bett-Präsenz-Kachel trotzdem einen sinnvollen Wert:

**Ab v0.33.198:** Wenn kein FP2-Sensor konfiguriert ist, schätzt AURA die Bett-Präsenzzeit aus der **erkannten Schlafdauer** (Einschlafzeit bis Aufwachzeit). Das Ergebnis ist konsistent mit den anderen Schlafkacheln und stimmt für normale Nächte gut überein.