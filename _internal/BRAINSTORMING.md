# BRAINSTORMING — ioBroker Cogni-Living (AURA)
**Zweck:** Architektur-Entscheidungen, offene Konzepte, Diskussionen, Marktanalyse.
**Nicht hier:** konkrete Deploy-Schritte, Bugfixes → dafuer PROJEKT_STATUS.md

**Regel:** Implementierte Punkte wandern aus dieser Datei in PROJEKT_STATUS.md.
Neue offene Konzepte immer OBEN in den Abschnitt "🚧 OFFENE KONZEPTE" einfügen.

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

**Stage 2 — Zustandsmaschine (noch offen):**

Zustände: `SCHLAFEN → AUFGESTANDEN → ZURÜCKGEKEHRT → SCHLAFEN`

Regeln (ohne Training):
- AUFGESTANDEN: Motion außerhalb Bett nach hausStill-Periode (> 30 Min Stille)
- ZURÜCKGEKEHRT: Motion in Schlafzimmer innerhalb konfigurierbarer Zeit
- SCHLAFEN: Neue haus_still-Periode nach Rückkehr

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