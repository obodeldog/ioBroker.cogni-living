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

**Erkennung (Stand v0.33.110):** Zeitfenster **10:00–03:00** (lokaler Tag); zweistufig: **Tier A** (Peak ≥65, ≥3×15 Min) eher vaginal; **Tier B** (Peak ≥45, 4–6×15 Min) oral/hand. Tages-Snapshot speichert `intimacyEvents` in der History-JSON.

**Retroaktiv:** Command `recalcIntimacyHistory` mit `force: true` schreibt **immer** `intimacyEvents` (auch **leeres Array**), damit alte Fehl-Treffer nicht in der Datei stehen bleiben. Logs: `[OC-SEX] recalc start` / `recalc fertig`.

**Training (`sexTrainingLabels`):** JSON-Array in den Adapter-Einstellungen, z. B. `[{"date":"2026-04-04","time":"20:20","type":"oral_hand"}]`. Zweck: **manueller Abgleich** im Sex-Tab (Referenz vs. Erkennung). **Kein** automatisches neuronales Netz — bei wenigen Sensoren und überschaubarer Merkmalszahl reichen Regeln/Schwellen; ein KNN wäre Daten- und Wartungsaufwand ohne klaren Mehrwert.

---

### Tab: Gesundheit — Langzeit-Trends (`LongtermTrendsView.tsx`)

Tooltips werden über die `ChartHelp`-Komponente angezeigt (kleines ⓘ-Icon rechts neben dem Kacheltitel).

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

Tooltips werden über `TerminalBox helpText=` angezeigt (ⓘ-Icon im Kachel-Titel).

#### SCHLAF-RADAR (22–08)
✅ `src: HealthTab.tsx Zeile ~991`
> Balkendiagramm der Nacht-Aktivität (22–08 Uhr). Jeder Balken = 30 Minuten. Hohe Balken = viele Bewegungen. Grün = normal, Rot/Orange = auffällig viel. Hilft Schlafmuster zu erkennen.

#### NEURO-TIMELINE (08–22)
✅ `src: HealthTab.tsx Zeile ~1066`
> Stündliche Tages-Aktivität (08–22 Uhr). Blau = keine Aktivität, Grün = normal, Gelb/Rot = erhöht. Zeigt Tagesstruktur und Aktivitätsmuster auf einen Blick.

#### SCHLAFANALYSE (OC-7)
✅ `src: HealthTab.tsx Zeile ~1184`
> AURA-Sleepscore: Tief×200 + REM×150 + Leicht×80 − Wach×250 (Anzeige max. 100, Rohwert kann höher sein). Bonus +5 bei 7–9h Schlafdauer.
> Quellen: Diekelmann & Born 2010 (Tiefschlaf), Walker 2017 / Stickgold 2005 (REM), AASM Guidelines (Leichtschlaf), Buysse et al. 1989 PSQI (WASO-Abzug).
> Einschlafzeit (📡): Letzte FP2-Bettbelegung ≥10 Min zwischen 18–03 Uhr.
> Aufwachzeit (📡): Erste Bettleere ≥15 Min nach 04 Uhr (⟳ vorläufig bis 10:00 Uhr + 1h Bett leer).
> Balkenfarben: Dunkelblau=Tief, Hellblau=Leicht, Lila=REM, Gelb=Wach-im-Bett, Orange=Bad-Besuch, Rot=Außerhalb (du), Blau=Andere Person.
> Dreiecks-Marker ▼: Orange=Bad, Rot=Außerhalb (bestätigt du), Blau=Andere Person im Haus. Mehrpersonenhaushalt: Rot nur mit FP2-Bett-Bestätigung.
> **FP2-Solo-Dropout-Filter (ab v0.33.103):** Kurze FP2-Abwesenheiten <5 Min, die NICHT durch einen Sensor außerhalb des Schlafzimmers bestätigt werden, erzeugen kein rotes Dreieck. Hintergrund: Der FP2 kann bei ruhiger Schlafhaltung kurzzeitig die Detektion verlieren (Radar-Dropout), obwohl die Person noch im Bett liegt. Ohne Bestätigung durch Bad/Wohnzimmer/anderen Raum-Sensor wird dieses Signal ignoriert.
> Kein Medizinprodukt — für klinische Diagnose Arzt hinzuziehen.

---

## 📐 ALGORITHMUS-DOKUMENTATION — SCHLAFANALYSE (OC-7)

### Wie AURA Einschlaf- und Aufwachzeit bestimmt

AURA kombiniert mehrere Sensordatenquellen nach einem **Prioritätsprinzip (Graceful Degradation)**. Je mehr hochwertige Sensoren vorhanden sind, desto genauer die Erkennung. Das System funktioniert aber auch mit nur einem einfachen Bewegungsmelder.

#### Einschlafzeit — Erkennungsquellen (Priorität absteigend)

> **Hinweis:** Garmin `sleepStartTimestampGMT` wird verwendet, wenn der Wert plausibel ist (18–04 Uhr) **und** innerhalb von 3h nach der FP2-Bettbelegungs-Zeit liegt. Liegt Garmin mehr als 3h nach dem FP2-Signal (z. B. bei sehr spätem Sync), wird FP2 bevorzugt.
> Neu ab v0.33.58: Vibrations-Verfeinerung — erkennt das **echte Einschlafen** nach dem Ins-Bett-Gehen (FP2 + letztes Vibrations-Event + ≥20 Min Stille).

| Symbol | Quelle | Methode | Konfidenz | Status |
|---|---|---|---|---|
| ⌚ | **Garmin-Uhr** | Garmin sleepStartTimestampGMT — plausibel wenn 18–04 Uhr UND |ΔGarmin−fp2| ≤3h (bidirektional ab v0.33.84) + Datum-Konsistenz | Maximal | ✅ aktiv |
| 📡 | **FP2 + Vibration** | FP2 Bett belegt + letztes Vib-Event mit ≥20 Min Stille danach (innerhalb 3h) | Sehr hoch | ✅ aktiv (ab v0.33.58) |
| 📡 | **FP2 Bett-Radar allein** | Start des laengsten Schlafblocks (≥10 Min, 18–03 Uhr); Luecken ≤30 Min werden fusioniert (kurze Wachphasen ignoriert, ab v0.33.84) | Hoch | ✅ aktiv |
| 🚶 | **Bewegungsmelder + Vibration** | Kein FP2 vorhanden: Motion-Fenster als Anker + letztes Vib-Event mit ≥20 Min Stille (innerhalb 3h) | Mittel-Hoch | ✅ aktiv (ab v0.33.80) |
| 🏠 | **Haus-wird-still** | Letztes Bett-Event, nach dem Gemeinschaftsbereiche ≥30 Min still bleiben | Mittel | ✅ aktiv (ab v0.33.79) |
| 🚶 | **Schlafzimmer-Bewegungsmelder** | Letzte Bewegung + danach ≥45 Min Stille (18–03 Uhr) | Mittel | ✅ aktiv |
| ⏰ | **Schätzung** | Festes Fenster 20:00–09:00 Uhr | Niedrig | ✅ aktiv (Fallback) |

#### Aufwachzeit — Erkennungsquellen (Priorität absteigend)

| Symbol | Quelle | Methode | Konfidenz | Nur Einpersonenhaushalt? | Status |
|---|---|---|---|---|---|
| ⌚ | **Garmin-Uhr** | Garmin `sleepEndTimestampGMT` — plausibel wenn 03–14 Uhr | Maximal | Nein | ✅ aktiv (ab v0.33.58) |
| 📡 | **FP2 Bett + Anderer Raum** | Bett wird leer UND gleichzeitig (±15 Min) anderer Sensor aktiv | Sehr hoch | Ja | ✅ aktiv |
| 📡 | **FP2 Bett allein** | Bett ≥15 Min leer nach 04:00 Uhr | Hoch | Nein | ✅ aktiv |
| 🚶 | **Anderer Raum** | Erster aktiver Sensor außerhalb Schlafzimmer/Bad nach 04:00 + ≥3h Schlaf | Mittel | Ja | ✅ aktiv |
| 🚶 | **Schlafzimmer-Bewegungsmelder** | Erste Bewegung nach 04:00 + ≥3h Schlaf | Mittel | Nein | ✅ aktiv |
| 📳 | **Vibrationssensor (↑ Konfidenz)** | Vibration vor FP2-Leer-Signal (±30 Min) → Konfidenz erhöhen. **Kein eigenständiger Wake-Zeitpunkt** — wirkt als Konfidenz-Booster für FP2-basierte Zeit | Konfidenz-Booster | Nein | ✅ aktiv (ab v0.33.58, Label ab v0.33.66) |
| 📳 | **Vibrationssensor allein** | Letztes Vibrations-Event + danach ≥45 Min Stille | Sehr niedrig | Nein | ✅ aktiv |
| ⏰ | **Schätzung** | Fixwert 09:00 Uhr | — | Nein | ✅ aktiv (Fallback) |

#### Warum „Anderer Raum" nur im Einpersonenhaushalt?

Wenn mehrere Personen im Haus sind, könnte ein Wohnzimmer-Signal von **einer anderen Person** stammen. Nur wenn das System sicher ist, dass nur eine Person zu Hause ist (FP2-Personenzählung ≤1 oder Haushaltskonfiguration = „alleine"), kann das Signal eindeutig der überwachten Person zugeordnet werden.

> **Tipp für Kunden:** Im Schlafzimmer und Bad sind Sensoren immer **personengebunden**, weil diese Räume typischerweise nur von einer Person genutzt werden. Ein Badezimmer-Sensor mit konfiguriertem **Personen-Tag** wird auch im Mehrpersonenhaushalt als persönliches Signal gewertet.

#### Technische Details: FP2-Bett-Aufwachzeit (verbesserte Logik ab v0.33.55)

- **Echte Aufwachzeit:** Gespeichert wird der Zeitpunkt ab dem das Bett **leer wurde** — nicht der Zeitpunkt der Berechnung.
- **Bett-Machen-Debounce:** Kurzes Zurückkehren ins Bett (< 5 Min) nach dem Aufstehen — z. B. beim Bett machen — wird ignoriert. Das Bett-leer-Fenster bleibt offen.
- **Mehrfaches Aufwachen:** Bei kurzem Aufwachen (Toilette, etc.) und anschließendem Zurückschlafen wird die **letzte** echte Aufwachzeit gespeichert — nicht die erste.

#### Sonderfälle

- **Nickerchen (⭒):** Einschlafzeit zwischen 03:00–19:00 Uhr → als Nickerchen markiert, kein OC-7-Sleepscore.
- **Ungewöhnlich lange Liegezeit (⚠):** Schlafdauer > 12h → Hinweis in der Kachel; Konfidenz wird gesenkt (kann Krankheit/Ausfall signalisieren).
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
- Events innerhalb von **5 Minuten** → ein gemeinsames Ereignis (z. B. Bad + kurzes Wohnzimmer)
- **3 Minuten** Puffer nach letztem Event (damit kurze Besuche nicht auf 0 Min schrumpfen)

**Typ-Bestimmung (ab v0.33.74):**

| Typ | Farbe | Bedeutung | Bedingung |
|---|---|---|---|
| `bathroom` | 🟠 Orange `#ffb300` | Bad-Besuch bestätigt | Bad-Sensor hat gefeuert |
| `outside` | 🔴 Rot `#e53935` | Bestätigt: du warst außerhalb | Einpersonenhaushalt ODER Mehrpersonenhaushalt + FP2 bestätigt Bett leer |
| `other_person` | 🔵 Blau `#1e88e5` | Andere Person im Haus aktiv | Mehrpersonenhaushalt + FP2 zeigt Bett noch belegt ODER kein FP2 vorhanden |

**Mehrpersonenhaushalt-Logik (ab v0.33.74):**
- Konfiguration über `householdSize` in Admin-Settings (`single` / `couple` / `family`)
- Mit FP2-Bett-Sensor: Event gilt als `outside` (du) nur wenn FP2 Bett-leer-Periode überlappt
- Ohne FP2-Bett-Sensor: alle Außer-Schlafzimmer-Events → `other_person` (nicht sicher zuordenbar)

**Dreiecks-Marker (ab v0.33.74):**
- Unicode-Dreiecke `▼` / `▲` statt kleiner Buchstaben
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
- **Keine Schlafphasen-Balken** (kein Sensor dafür), aber **orangene ▼ Dreiecke** für Bad-Besuche werden angezeigt

**Motion-only "Bett war leer"-Verhalten (ab v0.33.102):**

| Zeitpunkt | Was passiert | Anzeige |
|---|---|---|
| Nachmittag (nach Aufwachen, vor 20:00) | `wakeConfirmed: true`, historisches Fenster korrekt | Schlafzeit + Aufwachzeit korrekt ✓ |
| Abends (~21:00-23:00, neue Nacht beginnt) | Ohne Fix: `_pSleepStart` springt auf heute Abend → invertiertes Fenster → "Bett war leer" | Mit Fix (v0.33.102): historisches Fenster (gestern 18:00 → heutiger Wachzeitpunkt) → korrekte Anzeige ✓ |
| Morgens | Normales Vornacht-Fenster, alles korrekt | ✓ |

#### AURA-Sleepscore: V2-Formel + Kalibrierung (OC-Score-V2, ab v0.33.98)

**Was der Nutzer in der Kachel sieht:**

```
    [ 80 ]            ← Angezeigter Score (groß, farbig)
  AURA-Sleepscore
  ✓ kalibriert (21N) ← Statusbadge
  AURA: 89           ← Unkalibrierter Rohwert (nur wenn kalibriert + Abweichung)
  🕐 8h 57min        ← Schlafdauer
  Garmin: 39 (-41)   ← Garmin-Referenz + Delta zum angezeigten Score
```

**Bedeutung der drei Werte:**

| Wert | Bedeutung | Quelle |
|---|---|---|
| **80** (großer Score) | Kalibrierter AURA-Score = AURA-Rohwert + persönlicher Garmin-Offset | `sleepScoreCal` |
| **AURA: 89** | Unkalibrierter AURA-V2-Rohwert, basiert auf Schlafdauer + Sensorphasen | `sleepScore` |
| **Garmin: 39** | Messwert der Smartwatch (HRV + SpO2 + Herzrate + Bewegung) | Garmin-State |

**Warum weichen AURA und Garmin ab?**
Garmin nutzt Hardware-Sensoren (HRV, Puls, SpO2). Ein AURA-Score von 89 bei Garmin 39 zeigt: unsere Sensoren erkennen die Schlafqualität des Nutzers deutlich besser als Garmin → nach Kalibrierung wird der angezeigte Score (80) dem Garmin-Durchschnitt angenähert.

> **Hinweis:** Ein einzelner sehr niedriger Garmin-Wert (z.B. 39 bei 8h57min Schlaf) kann auf Garmin-spezifische Einflussfaktoren hinweisen (Alkohol, Stressmarker in HRV, Schlafposition). Der kalibrierte AURA-Score ist das Mittel aus N Nächten, nicht nur ein einzelner Abend.

**Statusbadge-Bedeutung:**

| Badge | Status | Bedeutung |
|---|---|---|
| ○ unkalibriert (grau) | < 7 Nächte mit Smartwatch | Nur AURA-Rohformel, kein Garmin-Offset |
| ⟳ kalibriert (N/14N) (orange) | 7–13 Nächte | Kalibrierung läuft ein, wird stabiler |
| ✓ kalibriert (NN) (grün) | ≥ 14 Nächte | Stabile Kalibrierung, Offset zuverlässig |

**Technische Umsetzung (für Entwickler):**
- `sleepScore` = `max(20, min(95, 25 + 0.12 × sleepDurMin))` ± Phasen-Adj (±8 Pkt)
- `sleepScoreCal` = `sleepScore + mean(garmin - aura)` über letzte 60 Nächte mit beiden Scores
- `sleepScoreCalStatus`: `uncalibrated` | `calibrating` (7–13N) | `calibrated` (≥14N)
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
> Zeigt wie oft heute Tür/Fenster-Sensoren (Typ: Tür/Fenster) geöffnet wurden. Stoßlüftung = mind. 5 Min offen. Empfehlung: 3× täglich ≥5 Min (Forschungsbasiert: DIN EN 15251, Pettenkofer-Zahl).

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
> *Die KI-Lösung ("Erwartungshaltung"):* Das System sendet bei jedem Check (alle 15 min) einen speziellen `dynamicSafetyPrompt` an die KI: "Ist es basierend auf der Uhrzeit verdächtig still? Fehlt eine Routine, die normalerweise jetzt stattfindet?" Beispiel: Es ist 08:30 Uhr. Normalerweise ist jetzt Aktivität im Flur. Heute nicht. → **Sofortiger Alarm**, obwohl der 12h-Timer noch nicht abgelaufen ist.

**Phase 2: Die Akute Abweichung (STB / 14 Tage)**
> *Medizinisches Ziel:* Erkennung von plötzlich auftretenden Krankheiten (z.B. Harnwegsinfekt, Magen-Darm, akute Schlafstörung).
>
> *Informatik-Logik:* Das System bildet einen gleitenden Durchschnitt der letzten 14 Tage (STB). Vergleich: `Heute` vs. `STB (Ø 14 Tage)`.
>
> *Beispiel:* Baseline (14 Tage): Ø 3 Toilettengänge/Nacht. Heute: 5 Toilettengänge. → **Warnung:** Signifikante Abweichung vom Kurzzeit-Mittelwert.

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

> **🤖 Telegram (Interaktiv):** Sendet Alarme mit Action-Buttons direkt im Chat:
> - `[✅ Alles OK (Reset)]`: Setzt den Alarm im System sofort zurück. Die KI lernt, dass dies ein Fehlalarm war.
> - `[📞 Rückruf anfordern]`: Sendet eine Bestätigung an das System, dass sich jemand kümmert.
>
> **📣 Pushover (Notfall-Sirene):** Dient als "Wecker". Kritische Alarme werden mit Priorität 2 (Emergency) gesendet und müssen in der Pushover-App bestätigt werden ("Acknowledge"), um den Ton zu stoppen.

---

#### 6. Troubleshooting

> - **Sensoren fehlen?** → Prüfen Sie ioBroker Räume/Funktionen oder nutzen Sie die Whitelist im Wizard.
> - **Status 'N/A'?** → Drift-Analyse benötigt mind. 30 Tage Daten.
> - **Zu viele Sensor-Offline-Pushover?** → Ab v0.33.66 gilt eine Schwelle von **7 Tagen** (statt 1 Tag) für Bewegungsmelder und Präsenzsensoren. Türsensoren und Temperatursensoren haben eigene Schwellen. KNX/Loxone/BACnet-Sensoren werden grundsätzlich nicht überwacht (kabelgebunden, kein Heartbeat erwartet). Pushover während der Nacht (22–08 Uhr) wird automatisch unterdrückt.
> - **Batterie-Warnung nicht sichtbar?** → Batterie-Discovery läuft alle 12 Stunden. Nach dem ersten Adapter-Start dauert es bis zu 12 Stunden bis die Discovery alle Sensoren gefunden hat. Den aktuellen Status kann man im ioBroker-Objekt `cogni-living.X.system.sensorBatteryStatus` einsehen.
> - **Batterie-State nicht automatisch gefunden?** → Im Reiter "Einstellungen → Sensoren → Batterie-Konfiguration" kann pro Sensor manuell ein Batterie-Objekt-Pfad hinterlegt werden. Der Button "." öffnet den ioBroker-Objektbrowser.

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
| ≤ 20 % | Warnung | Anzeige im UI (oranges Badge) |
| ≤ 10 % | Kritisch | Rotes Badge + Pushover täglich um 09:00 Uhr |

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
> Nach Adapter-Neustart sollte erscheinen: `✅ Python Environment detected & healthy. Ready.`

---

#### 8. Schlafanalyse (OC-7) & AURA-Sleepscore *(ab v0.33.52)*

> Die OC-7-Kachel berechnet aus Vibrationssensor-Daten geschätzte Schlafphasen und einen Gesundheitsscore. Optional wird ein FP2-Präsenzradar oder Bewegungsmelder für präzise Zeiten genutzt.
>
> **Sensor-Anforderungen (Graceful Degradation — beste bis schlechteste Kombination):**
> - 📡 **Optimal:** FP2-Radar (Bett) + Vibrationssensor → präzise Einschlaf-/Aufwachzeit, Phasen, Außerhalb-Events
> - 🚶 **Gut:** Bewegungsmelder Schlafzimmer (Funktion: Bett/Schlafzimmer) + Vibrationssensor → Einschlaf-/Aufwachzeit aus letzter/erster Bewegung, Phasen
> - 📳 **Eingeschränkt:** Nur Vibrationssensor → Phasen mit festem 20–09 Uhr Fenster, keine echten Zeiten
> - ⏰ **Minimal:** Kein Raumsensor → festes Fenster (Schätzung)
> - ❌ **Kein Sensor:** Kachel zeigt Konfigurationshinweis
>
> **Wichtig für Bewegungsmelder-Nutzer:** Den Sensor in der Sensor-Liste auf Funktion **"Bett / Schlafzimmer"** (lila) setzen — nur dann wird er für die Schlafanalyse genutzt!
>
    > **AURA-Sleepscore Formel:** `Score = Tief% × 200 + REM% × 150 + Leicht% × 80 − Wach% × 250`; Anzeige max. 100 (Rohwert `sleepScoreRaw` kann höher sein und wird im Badge als `↑ roh: X` sichtbar); Bonus +5 bei 7–9h Schlafdauer.
    >
    > **Dreiecks-Marker (ab v0.33.65):** Nächtliche Bad-/Küchenbesuche erscheinen als farbige Dreiecke im Schlafbalken. Quellen: FP2-Bett-leer-Erkennung (Vorrang) + Bad-/Küchen-Bewegungsmelder (Fallback). Typ bernstein = Bad, orange = Außerhalb.
>
> **Quellen:** Diekelmann & Born 2010 (Tiefschlaf), Walker 2017 / Stickgold 2005 (REM), AASM Guidelines (Leichtschlaf), Buysse et al. 1989 PSQI (WASO-Abzug).
>
> **Sensor-Indikatoren:** 📡 FP2-Sensor (genau) | 🚶 Bewegungsmelder (gut) | ⏰ Schätzung (Fixfenster)
>
> **Aufwachzeit ⟳/✓:** `⟳ vorläufig` bis 10:00 Uhr + 1h Bett leer bestätigt. Danach `✓ bestätigt`.
>
> **Sleep-Freeze:** Eine bestätigte Nacht (≥3h Bettbelegung, Aufwachzeit vor 14:00) wird nicht durch spätere Aktivität oder Mittagsschlaf überschrieben.

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
- Lebenszeichen-Alarm (🟢/🟡/🔴)
- Konfigurationshinweise (Sensor-Liste, Flur-Checkbox, Reporting)

**TODO:** Dialog um OC-7 und Ganggeschwindigkeit-Details erweitern.

### Tab: System / Einstellungen

⚠️ Kein Tooltip in Sensor-Liste, Reporting oder anderen System-Bereichen.
**TODO:** Spalten-Erklärungen (ID, Name, Raum, Typ, Funktion, Aktiviert) als Tooltips ergänzen.

---

## 📊 SCHLAFANALYSE (OC-7)

### Übersicht

Die OC-7-Kachel berechnet aus **Vibrationssensor-Daten** (Bett) geschätzte Schlafphasen und einen AURA-Sleepscore. Ergänzend werden FP2-Präsenzradar-Daten für die Erkennung von Einschlaf- und Aufwachzeit verwendet.

### Sensor-Konfigurationsebenen (Graceful Degradation)

| Kombination | Sensor-Indikator | Einschlafzeit | Aufwachzeit | Phasen | Außerhalb-Events |
|---|---|---|---|---|---|
| **FP2 + Vibrationssensor** | 📡 FP2-Sensor | ✅ Exakt | ✅ Exakt | ✅ Vollständig | ✅ Ja |
| **Bewegungsmelder (Bett/Schlafzimmer) + Vibrationssensor** | 🚶 Bewegungsmelder + Vibration | ✅ Verfeinert via `motion_vib` (Vib + 20 Min Stille) | ⚠️ Erste Bewegung >04:00 | ✅ Vollständig | ❌ Nein |
| **Nur Vibrationssensor** | ⏰ Schätzung | ❌ Fix 20:00 | ❌ Fix 09:00 | ✅ Vollständig | ❌ Nein |
| **Nur FP2** | 📡 FP2-Sensor | ✅ Exakt | ✅ Exakt | ❌ Keine | ✅ Ja |
| **Keine Raumsensoren** | — | — | — | — | — |

**Hinweis:** "Bewegungsmelder Schlafzimmer" = `type: motion` + `sensorFunction: bed` in der Sensor-Liste. Ohne `sensorFunction: bed` wird der Sensor ignoriert.

**Algorithmus Bewegungsmelder-Fallback:**
- **Einschlafzeit ≈** letztes Bewegungs-Event (Schlafzimmer) zwischen 18:00–03:00 Uhr, das von mindestens 45 Minuten Stille gefolgt wird
- **Aufwachzeit — 2-stufige Erkennung:**
  1. **Primär:** Erste Aktivität in einem *anderen* Raum (Flur, Wohnzimmer, Küche — nicht Schlafzimmer, nicht Bad) nach 04:00 Uhr + ≥3h seit Einschlafzeit → sicherster Aufwach-Beweis
  2. **Fallback:** Schlafzimmer-Bewegung nach 04:00 Uhr + ≥3h + mindestens 20 Minuten danach keine weitere Schlafzimmer-Bewegung → Person hat sich nicht wieder hingelegt
- **Vorteil gegenüber Fixfenster:** Echte Einschlaf- und Aufwachzeiten statt immer 20:00–09:00
- **Vorteil gegenüber alter Methode:** Toilettengänge kurz vor dem Aufstehen verschieben die Aufwachzeit nicht mehr, da zuerst Aktivität in anderen Räumen gesucht wird
- **Nachteil gegenüber FP2:** Erkennt keine Ruhephasen (liegend ohne Bewegung). Keine Außerhalb-Bett-Events.

**Nykturie-Zählung mit Bewegungsmelder:** `nocturiaCount` (nächtliche Badezimmerbesuche) nutzt dasselbe OC-7-Schlaffenster (FP2 → Bewegungsmelder → Fixfenster). Ohne FP2 wird also automatisch das Bewegungsmelder-Fenster für die Nykturie-Auswertung im Medical Tab verwendet.

### Einschlafzeit-Berechnung (FP2-basiert)

**Quelle:** FP2-Bett-Sensor (`type: presence_radar_bool`, `sensorFunction: bed`)

**Algorithmus:**
1. Durchsuche FP2-Events des Vortags ab 18:00 Uhr bis jetzt
2. Suche letzte Bettbelegung ≥ 10 Minuten zwischen 18:00–03:00 Uhr
3. Startzeit dieser Belegung = Einschlafzeit

**Fallback:** Festes Fenster ab 20:00 Uhr (wenn kein FP2 konfiguriert)

### Aufwachzeit-Berechnung (FP2-basiert)

**Algorithmus:**
1. Ab Einschlafzeit: Suche erste Bettleere ≥ 15 Minuten zwischen 04:00–14:00 Uhr
2. Startzeit dieser Leere = Aufwachzeit (vorläufig)

**Vorläufig → Final:**
- `⟳ vorläufig` → solange aktuelle Uhrzeit < 10:00 Uhr ODER < 1h seit Aufwachzeit
- `✓ bestätigt` → ab 10:00 Uhr + mindestens 1h kein Bett mehr belegt

### Sleep-Freeze-Mechanismus

Verhindert, dass eine korrekt erkannte Nacht durch spätere Aktivität überschrieben wird:

- Bedingung: `sleepWindowEnd < 14:00 Uhr` AND `bedPresenceMinutes ≥ 180 min`
- Wenn erfüllt: Einschlaf-/Aufwachzeit, Schlafphasen und Score werden eingefroren
- Abendliche Bettaktivität oder Mittagsschlaf überschreiben die Nacht nicht mehr
- ioBroker-Log: `[History] Sleep FROZEN: 23:28-07:36 bedPresMin=496`

### AURA-Sleepscore — Formel und wissenschaftliche Grundlage (V2, ab v0.33.98)

**Formel V2 (Dauer-basiert, kalibriert an AURA vs. Garmin, r=0.886):**
```
durScore    = max(20, min(95, 25 + 0.12 × sleepDurMin))
coverage    = totalStagedMin / sleepDurMin   (max 1.0)
stageAdj    = max(-8, min(8, round((REM% × 30 − Wach% × 50) × coverage)))
sleepScore  = max(0, min(100, round(durScore + stageAdj)))
```

**Kalibrierung an Garmin (nach ≥ 7 Garmin-Nächten):**
```
offset         = mean(garminScore − auraScore) über letzte 60 Nächte
sleepScoreCal  = max(0, min(100, round(sleepScore + offset)))
```

**Begründung V2:**
- Schlafdauer ist mit r=0.886 der stärkste Prädiktor für den Garmin-Score (Analyse 15 Nächte)
- Vibrationssensor überklassifiziert Tiefschlaf (jede Stille ≥ 10 min war früher "Tief") → Proportions-basierte Formel ergab immer ~100
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
| ○ unkalibriert (grau) | < 7 Garmin-Nächte vorhanden — Rohformel wird angezeigt |
| ⟳ kalibriert (N/14N) (orange) | 7–13 Garmin-Nächte — Kalibrierung läuft ein |
| ✓ kalibriert (NN) (grün) | ≥ 14 Garmin-Nächte — Stabile Kalibrierung |

### Schlafphasen-Klassifikation (5-Minuten-Slots)

| Bedingung | Phase |
|---|---|
| 0 Vibrationen im Slot | Leichtschlaf (< 5 ruhige Slots in Folge) |
| 0 Vibrationen, ≥ 5 ruhige Slots in Folge (25 min) | Tiefschlaf |
| ≥ 5 Vibrationen ODER Stärke > 28 | Wach |
| ≥ 2 Vibrationen + mittlere Stärke (12–28) + > 2,5h Schlaf | REM (geschätzt) |
| Sonstige Vibration | Leichtschlaf |

### Außerhalb-Bett-Ereignisse

Werden aus FP2-Events während des Schlaffensters berechnet:

| Ereignistyp | Erkennungsmethode | Farbe im Balken |
|---|---|---|
| Bad-Besuch | Bett leer + Bad-Sensor (isBathroomSensor) | Bernstein #ffb300 |
| Außerhalb | Bett leer (kein Bad-Sensor) | Orange-Rot #ff5722 |

**Dreiecks-Marker ▼ über dem Balken:**
- Gelbes Dreieck = Bad-Besuch
- Rotes Dreieck = Abwesenheit ≥ 20 Minuten

### Farbkonzept (Best → Schlimmste, Usability-Prinzip)

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
| 📡 FP2-Sensor | Zeiten aus FP2-Präsenzradar (genau) |
| 🚶 Bewegungsmelder | Zeiten aus Bewegungsmelder (eingeschränkt) |
| 🚶 Bewegungsmelder + Vibration | Einschlafzeit via `motion_vib` (kein FP2) |
| 🏠 Haus-wird-still | Einschlafzeit via Ruhe in Gemeinschaftsbereichen |
| 📳 Vibrationssensor | Nur Phasen, Zeiten geschätzt |
| ⏰ Schätzung | Festes Fenster 20:00–09:00 (kein Raumsensor) |

---

## 🔧 SENSOR-KONFIGURATION

### Universalität (Kern-Designprinzip)

AURA muss mit jeder Sensor-Ausstattung funktionieren:
- Kein Sensor → keine Kachel (kein Fehler)
- Teilausstattung → eingeschränkter Modus mit Hinweis
- Vollausstattung → alle Features aktiv

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
FP2 = "da"                               → Im Bett (sicher)
FP2 = "weg" + Vibration kürzlich aktiv   → Wahrscheinlich noch im Bett
 + KEIN Außensensor                         (FP2 Falsch-Negativ)
FP2 = "weg" + Außensensor aktiv          → Definitiv außerhalb
FP2 = "weg" + keine Aktivität            → Tiefer Schlaf ODER aufgestanden
 + kein Außensensor                         (Kontext aus Geschichte)
```

**Einzel- vs. Mehrpersonenhaushalt:**
- Einzelperson: jede Außenbewegung = diese Person
- Mehrpersonen: Außenbewegung kann andere Person sein → vorsichtigere Interpretation

---

## 📊 OC-10: SCHLAF-SCORE WOCHENANSICHT *(ab v0.33.63)*

### Übersicht

Im AURA MONITOR (Tab „Gesundheit") erscheinen bei Auswahl von **WOCHE** oder **MONAT** zwei neue Diagramme unterhalb der Übersichtstabelle:

### Option A — AURA-Sleepscore (Balken-Chart)

- **Datenbasis:** `snapshot.sleepScore` (0–100) pro Nacht
- **Darstellung:** Ein Balken pro Nacht, farbkodiert:
  - Grün ≥80 (gut)
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

- [ ] Dead-Man-Schalter (OC-4): Algorithmus-Dokumentation
- [ ] Ganggeschwindigkeit: Berechnung und Sensor-Anforderungen
- [ ] Nykturie-Erkennung: Definition und Schwellenwerte
- [x] Wochenansicht Sleep-Score: **implementiert v0.33.63** — AURA MONITOR WOCHE/MONAT-View, Option A + B (siehe unten)
- [ ] Handbuch-Tab im Admin-Interface: Inhalte synchron halten

---

*Zuletzt aktualisiert: 27.03.2026 | Version: 0.33.81*
