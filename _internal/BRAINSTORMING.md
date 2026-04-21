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

#### Stufe 1 — Quellen-Zähler (einfach, ~1h)
```json
// in der History-JSON oder einem separaten State:
"sourceOverrideHistory": {
  "vib_refined": 7,    // so oft manuell gewählt
  "motion_vib": 2,
  "garmin": 1
}
```
Nach N=5 Overrides auf dieselbe Quelle: diese Quelle bekommt in der Cluster-Direktheitsbewertung einen Bonus. Effektiv verschiebt sich die Prioritätskette für diesen Nutzer.

#### Stufe 2 — Override als Ground Truth für Kalibrierung
Jede manuelle Korrektur wird wie ein Garmin-Ground-Truth behandelt und in das Kalibrierungs-Log eingetragen (`sourceCalibLog`). Das MAE-Ranking der Quellen (welche trifft Garmin am besten?) verbessert sich auch ohne Smartwatch. Der Nutzer wird sein eigener Kalibrierungs-Sensor.

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

**Priorität:** MITTEL — kein Akut-Bug, aber wichtig für Produktqualität und Support-Entlastung.

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

---

### OC-24: Sensor-Rauschen-Erkennung und Nutzer-Hinweis (29.03.2026)

**Problem / Nutzerbedarf:**
Ein einzelner Sensor (z. B. "Homematic OG Flur Bewegung Hinten 1") kann durch Defekt, zu hohe Empfindlichkeit oder lange PIR-Nachlaufzeit deutlich häufiger feuern als alle anderen Sensoren. Das blockiert aktuell den `haus_still`-Algorithmus: Da dieser Sensor auch nachts aktiv bleibt, findet der Algorithmus nie einen 30-Min-Stille-Block und liefert immer "—".

**Idee: Anomalie-Erkennung pro Sensor**
- Täglich (oder beim saveDailyHistory) pro Sensor: Event-Frequenz berechnen (Events/Stunde)
- Wenn Sensor X deutlich über Median aller Sensoren liegt (z. B. 3× häufiger als Durchschnitt) → Verdacht auf Rauschen
- Hinweis in UI/Log: "Sensor 'OG Flur' hat heute 47 Auslösungen zwischen 23:00 und 06:00 — prüfe Empfindlichkeit oder Defekt"
- Optional: Sensor temporär aus haus_still-Berechnung ausschließen (Auto-Blacklist mit Ablauf)

**Relevanz für haus_still:**
Der `haus_still`-Algorithmus selbst sollte robuster werden (Pflicht, kurzfristig), ABER die Sensor-Anomalie-Erkennung ist ein wertvoller ergänzender Hinweis an den Nutzer (mittelfristig).

**Ansatz für Robustheit (kurzfristig, in haus_still selbst):**
Statt "exakt 0 Events von beliebigen Sensoren in 30 Min": "0 Events von mindestens 2 VERSCHIEDENEN Sensoren in 30 Min" — so blockiert ein einzelner Rausch-Sensor nicht mehr allein.

**Priorität:** MITTEL — wichtig für Produkt-Qualitätsgefühl, kein Sicherheitsthema.

---

### OC-22: Gelernter Einschlafzeit-Prior + Neuronales Netz für Schlafmuster (26.03.2026)

> **✅ Stufe 1 ("Haus-wird-still")** implementiert in v0.33.79. Stufe 2 (NN) bleibt Langfrist-Roadmap Phase 5+.

**Kontext:** In PIR-only-Haushalten (keine FP2/Vibration/Garmin) liefert der neue "Haus-wird-still"-Algorithmus (v0.33.79) eine erste zuverlässige Einschlafzeit. Aber diese Erkennung ist kontextfrei — sie weiß nicht, dass Robert typischerweise um 22:30 schläft und Ingrid um 23:00. Dieses Wissen könnte als Konfidenz-Boost und Plausibilitätscheck dienen.

**Zwei Entwicklungsstufen:**

#### Stufe 1 (Mittelfristig): Gelernter Rolling-Durchschnitt pro Person

Ein einfacher Bayes-Prior ohne Machine Learning:

```javascript
// Für jede Person wird ein gleitender 7-Nacht-Mittelwert geführt:
person.learnedBedtime = {
    meanMinutes: 1380,  // 23:00 Uhr in Minuten seit Mitternacht (rolling 7 Nächte)
    stdMinutes:  25,    // ±25 min Standardabweichung
    sampleCount: 7      // Anzahl der zugrunde liegenden Nächte
};
```

**Anwendung:**
- `sleepWindowStart` aus "Haus-wird-still" liegt innerhalb `mean ± 2*std` → Konfidenz von `niedrig` auf `mittel` erhöhen
- `sleepWindowStart` liegt außerhalb (mehr als 90 min Abweichung) → Konfidenz bleibt `niedrig`, Log-Hinweis: "untypisch spät/früh"
- Nächte ohne erkannte Einschlafzeit → Prior dient als Fallback-Schätzung (`wakeSource = 'learned_prior'`, `wakeConf = 'niedrig'`)

**Datenspeicherung:** Einschlafzeiten je Person in `dailyHistory` → bei jeder neuen Nacht rollierend über 7 Einträge mitteln. Kein externer Service nötig.

**Vorteil:** Funktioniert ohne NN, braucht keine Trainingsdaten, adaptiert sich nach wenigen Nächten automatisch an den Nutzer.

**Abhängigkeit:** Benötigt mind. 3 erfolgreiche Nächte aus "Haus-wird-still" (v0.33.79) um Prior zu initialisieren.

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

---

### OC-21: personTag-Filter für Außerhalb-Bett-Events in Schlafanalyse (26.03.2026)

**Problem:** `_motOutEvts` (Grundlage für rote/orange Dreiecke im Schlafbalken) filtert aktuell nur nach Sensor-Typ (nicht Schlafzimmer), aber NICHT nach personTag. In Mehretagen-Haushalten mit eigenem Kinderzimmer/Kinderbad OG werden OG-Sensoren trotz personTag korrekt konfigurierter Bewohner EG als "Außerhalb"-Events eingestuft.

**Warum Topologie-Hop-Filter (OC-17/v0.33.78) nicht ausreicht:**
- Der Hop-Filter deckt den häufigsten Fall gut ab (OG Flur = 3+ Hops = ausgefiltert)
- Aber: in kleinen Wohnungen können OG-Räume topologisch "nah" sein (wenig Räume → Matrix gut verbunden)
- Außerdem: Kunden-Haushalte wo BEIDE Etagen bewohnt sind wollen granulare Zuordnung

**Idee: personTag-basierter Filter als Ergänzung**

```
Sensor hat personTag='Kind'    → gehört einer anderen Person → bei Schlafanalyse für 'Marc' ignorieren
Sensor hat personTag='Marc'    → gehört dem Schläfer → immer relevant (Bad, Flur EG)
Sensor hat personTag=''        → shared/unbekannt → immer relevant (kein Filter)
```

**Algorithmus (Backend _motOutEvts):**
```javascript
// Wenn Schläfer einen personTag hat ('Marc'):
//   - Sensor mit GLEICHEM personTag → einschließen
//   - Sensor OHNE personTag → einschließen (shared Sensor)
//   - Sensor mit ANDEREM personTag → 'other_person' (blau) statt 'outside' (rot)
if (_sleepPersonTag && e.personTag && e.personTag !== _sleepPersonTag) {
    // Nicht filtern, aber als 'other_person' markieren (nicht als 'outside')
    return SPECIAL_MARKER; // → _motType = 'other_person'
}
```

**Verhältnis zu Topologie-Hop-Filter:**
- Beide Ansätze ergänzen sich: Hop-Filter = geometrische Nähe, personTag = semantische Zuordnung
- Empfehlung: Hop-Filter als erste Stufe (OC-17, v0.33.78), personTag als zweite Stufe (dieses OC)
- Wenn BEIDE aktiv: erst Hop-Filter, dann personTag-Filter

**Voraussetzung:** personTag muss vom User korrekt in der Sensor-Konfiguration eingetragen sein (freiwillig, kein Pflichtfeld). Sensoren ohne personTag bleiben immer "shared".

**Abhängigkeit:** OC-18 (Per-Person-Schlafanalyse, v0.33.76) — `_sleepPersonTag` kommt aus der Person-spezifischen Schlafberechnung.

**Status:** Brainstorming; Umsetzung nach Praxistest Hop-Filter.

---

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

---

### OC-17: ✅ DONE (v0.33.78) — Batterie-Warnung in Schlafkachel — Topologie-basierter Nähefilter (24.03.2026)

**Ausgangssituation:**
Ab v0.33.73 wird die Batterie-Warnung in der Schlafanalyse-Kachel nur noch für schlaf-relevante Sensoren angezeigt (Vibration, FP2-Radar, Bewegung mit Funktion `bed`/`bathroom`/`kitchen`/`hallway`). Das ist ein guter erster Filter — aber er ist **standortblind**.

**Das Problem:**
Der Filter kennt nur den Sensor-Typ, nicht den physischen Abstand zum Schlafzimmer. Konsequenz: Ein Bewegungsmelder im **Bad OG** (obere Etage, weit weg) warnt genauso wie ein Bewegungsmelder im **Bad EG** direkt neben dem Schlafzimmer. Gleiches gilt für Flur, Küche etc. auf anderen Etagen oder in anderen Gebäudebereichen.

**Konkrete Beispiele die falsch gefiltert werden:**
- `OG Flur Hinten` → `sensorFunction=hallway` → wird gewarnt, obwohl Schlafzimmer auf EG
- `Bad OG` → `sensorFunction=bathroom` → wird gewarnt, obwohl Schlafzimmer auf EG
- `Küche Einliegerwohnung` → `sensorFunction=kitchen` → komplett andere Wohneinheit

**Die Lösung: Topologie-Matrix als Nähefilter**

Die Topologie-Matrix ist im System bereits vorhanden und beim Kunden vollständig gepflegt (`SystemTab → Topologie-Matrix & Raum-Adjazenz`). Sie definiert welche Räume direkt aneinander angrenzen.

**Algorithmus (geplant):**

```
1. Schlafzimmer-Raum bestimmen:
   → Alle Sensoren mit sensorFunction='bed' aus native.devices
   → Deren location-Felder = Schlafzimmer-Räume (kann mehrere geben!)

2. Topologie laden:
   → cogni-living.X.system.topologyMatrix (oder via getObject)

3. BFS/Dijkstra: Für jeden Schlafzimmer-Raum alle Räume mit Hop-Distanz ≤ 2 ermitteln
   (Hop 1 = direkt angrenzend, Hop 2 = eine Tür weiter)

4. Filter: Nur Sensoren warnen, deren location in der Nähe-Menge enthalten ist
```

**Schwellwert-Diskussion:**
- **Hop 1 (direkt angrenzend):** Sehr streng — vielleicht zu wenig (Küche oft 2 Schritte entfernt)
- **Hop 2 (eine Tür weiter):** Empfohlen — deckt typisches Bad/WC + Flur ab
- **Hop 3:** Zu weit — würde wieder zu viele irrelevante Räume einschließen

**Voraussetzungen:**
- Topologie-Matrix ist vollständig gepflegt (beim Kunden gegeben ✅)
- `location`-Feld der Sensoren stimmt mit Raumnamen in Topologie-Matrix überein (Pflicht!)
- Mehrere Schlafzimmer im Haushalt müssen alle berücksichtigt werden (Senioren + Partner)

**Implementierungsaufwand:**
- Backend: Topologie-State als JSON bereits vorhanden — kein Backend-Aufwand
- Frontend: HealthTab.tsx muss Topologie-Matrix laden (ein `getState`-Aufruf)
- BFS-Algorithmus: ~20 Zeilen JavaScript
- Gesamtaufwand: ca. 1–2 Stunden

**Warum noch nicht umgesetzt:**
Ist kein kritisches Problem — der aktuelle Filter (v0.33.73) ist bereits deutlich besser als vorher. Die Topologie-Lösung wäre die "perfekte" Lösung, hat aber keine Dringlichkeit.

**Nächster Schritt wenn umgesetzt:**
- `SLEEP_RELEVANT_FUNCS`-Filter in `HealthTab.tsx` durch BFS-Topologie-Filter ersetzen
- Fallback: wenn Topologie nicht verfügbar → aktueller Typ/Funktion-Filter greift weiter

---

### OC-16: Schlaf-Kalibrierung gegen Garmin + Fallback ohne Wearable (24.03.2026)

**Ziel:**
- Über mehrere Tage/Wochen ermitteln, welche Sensorquelle/Sensorkombination Garmin am besten trifft.
- Daraus robuste Regeln für Nutzer ohne Garmin/Smartwatch ableiten (Zielgruppe: ältere Personen).

**Tracking-Idee:**
- Jede Nacht Kandidaten für Einschlaf-/Aufwachzeit + Garmin-Referenz in ein Kalibrier-Log schreiben.
- Auswertung später über absolute Abweichung (Minuten) pro Quelle.

**Offen:**
- Nach 7+ Nächten MAE-Ranking pro Quelle berechnen (Start/Ende getrennt).
- Entscheidung, ob `fp2_vib` (kombiniert) in mehr Fällen die Endzeit direkt übernehmen soll.

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

---

### OC-7: AURA Sleep Score — Schlafphasen-Rekonstruktion aus Vibrationssensor (17.03.2026)

> **✅ Größtenteils implementiert** — Schlafanalyse-Kachel mit Einschlaf-/Aufwachzeit, Quellenangabe, Konfidenz, AURA Sleep Score (v0.33.180/181), Cluster-basierte Einschlafzeitauswahl (v0.33.178), separate Kacheln pro Person (v0.33.76), Garmin-Zuweisung pro Person (v0.33.175). **Noch offen:** Schlafphasen-Balkendiagramm (Tief/Leicht/REM/Wach), per-Person-Kalibrierungslogik (ab wie vielen Nächten? Garmin-Referenz?).

**Idee:** Auf Basis der Aqara-Vibrationssensordaten (Detektions-Bool + Stärke-Wert) eine Garmin-ähnliche Schlafphasen-Visualisierung und einen Sleep Score berechnen und im Tab "Gesundheit" darstellen.

**Korrelations-Evidenz (analysiert 16./17.03.2026):**
Direkter Vergleich der Aqara-CSV-Rohdaten (Detection + Strength) mit der Garmin-Schlafkurve zeigt klare Signaturmuster:
- **Tiefschlaf-Signatur:** Pausen von 30–60 Minuten ohne Vibrations-Events → entspricht exakt Garmin "Tief"-Blöcken
- **REM-Signatur:** Kurze Ereignis-Cluster + Stärke-Peak (Nacht 16./17.03.: Peak 32 um 04:40 → exakt der Garmin-REM-Block 04:30)
- **Wach/Einschlaf-Signatur:** Dichte Events (15 in 40 Min) + hohe Stärke → Garmin "Wach" / Einschlafphase
- **Limitation:** Leicht vs. REM nicht trennscharf unterscheidbar ohne HRV/Herzrate (Aqara hat kein Biometrie-Signal)

**Vorgeschlagene Stadien-Klassifikation (5-Minuten-Fenster):**
```
Wach:       > 4 Events in 5min ODER Stärke > 28
REM (est.): 2–4 Events + Stärke 15–28, nach 3h Schlaf (REM tritt erst spät auf)
Leicht:     1–3 Events in 5min, Stärke < 20
Tief:       0–1 Events in 30min, niedrige Stärke
```

**Sleep Score Formel (Vorschlag, 0–100):**
```
Basis-Score:
  Tief%  × 2.0  (Tiefschlaf wichtigster Faktor)
  REM%   × 1.5
  Leicht × 0.8
  Wach%  × -2.0  (Abzug für Unterbrechungen)

Bonus:
  + 5 Punkte wenn Gesamtschlafdauer 7–9h
  + 3 Punkte wenn erste Tiefschlafphase < 45 Min nach Einschlafen

Cap: max 100, min 0
```

**UI-Konzept (im AURA Monitor, Tab "Gesundheit"):**
- Position: Unterhalb der Kacheln "Schlafradar" und "Neurotimeline", gleicher Card-Stil
- Horizontales Balkendiagramm wie Garmin (Zeit auf X-Achse, Schlafstadium als Farbe)
  - Dunkelblau = Tief, Hellblau = Leicht, Magenta = REM (geschätzt), Rosa = Wach
- Links: Einschlafzeit, Rechts: Aufwachzeit (aus `sleepWindowStart/End`)
- Oben-rechts: Score-Badge (z. B. "72 / 100")
- Legende + klarer Hinweis: "Geschätzte Schlafstadien (Vibrationssensor — kein medizinisches Gerät)"

**Datenbasis:**
- `isVibrationBed` Events aus `eventHistory` (Detection: true/false) — bereits vorhanden
- `isVibrationStrength` Events (numerischer Wert) — bereits vorhanden und in `nightVibrationStrengthAvg/Max` ausgewertet
- `sleepWindowStart`/`sleepWindowEnd` — bereits vorhanden

**Architektur-Option:**
- **Option A (Backend):** Sleep-Score-Algorithmus in `saveDailyHistory()`, gespeichert als `sleepScore` + `sleepStages[]` im Tages-JSON → Frontend liest fertige Daten
- **Option B (Frontend-only):** Raw-Vibrationsdaten per ioBroker-History laden und im Frontend berechnen (kein Backend-Aufwand, aber langsamer beim Laden)
- **Empfehlung:** Option A — Algorithmus im Backend, Score im Daily-JSON, damit Langzeit-Trend auswertbar bleibt

**Priorisierung:** Mittel-Hoch — Feature mit hohem Nutzer-Wow-Faktor, weil direkt vergleichbar mit Garmin/Apple Watch. Technisch machbar ohne neue Hardware.

**Offen:**
- REM-Erkennung ohne HRV ist probabilistisch — wie kommunizieren wir das dem Nutzer transparent?
- Soll AURA die Garmin-Schlafzeiten auch auslesen (ioBroker Garmin-Adapter)? Falls Garmin-Daten verfügbar, könnten diese als Ground Truth für ML-Training dienen.
- Zeitfenster-Granularität: 5 Min? 10 Min? (Aqara-Events sind punktuell, nicht kontinuierlich)

**Sensor-Skalierung (Kernprinzip):**
- Kein Vibrationssensor vorhanden → Kachel wird ausgeblendet + Hinweis "Für Sleep Score: Vibrationssensor am Bett empfohlen"
- Nur Detection-Signal, kein Strength-Kanal → vereinfachte 2-Stufen-Klassifikation (Aktiv / Ruhig)
- Mehrere Bett-Sensoren (z. B. Doppelbett mit 2 Sensoren) → Durchschnitt oder Person-A / Person-B getrennt

**Card-Skizze (AURA Monitor — Tab "Gesundheit"):**

```
╔══════════════════════════════════════════════════════════════════════╗
║  🌙 Schlafanalyse                                     ╭──────────╮  ║
║  23:04  Einschlafen                  06:16  Aufwachen │  74/100  │  ║
║                                                       ╰──────────╯  ║
║  ┌────────────────────────────────────────────────────────────────┐  ║
║  │▓▓▓░░░░░░░░░░██░░░░░░░░░░░░░░░░░░░░░░███░░░░░░░░░██░░░░░░░░░░│  ║
║  │Tief  Leicht  REM   Leicht      Tief  REM   Leicht  Wach/auf  │  ║
║  └────────────────────────────────────────────────────────────────┘  ║
║    23:00      01:00      03:00      04:30      06:00                  ║
║                                                                       ║
║   ▓▓ Tief (ca. 1h 45min)   ░░ Leicht (ca. 3h)   ██ REM/Wach (est.) ║
║                                                                       ║
║   ℹ  Geschätzte Schlafstadien auf Basis Vibrationssensor.            ║
║      Kein Medizinprodukt. Für klinische Auswertung Arzt hinzuziehen. ║
╚══════════════════════════════════════════════════════════════════════╝
```

> *Farben im echten UI: Dunkelblau = Tief · Hellblau = Leicht · Magenta = REM · Rosa = Wach*
> *Score-Badge: Grün ≥ 80, Orange 60–79, Rot < 60*

---

### OC-6: WLAN-Präsenzerkennung für Personenzählung (17.03.2026)

**Idee:** `cogni-living.0.system.presenceWho` — der Adapter kann bereits heute WLAN-Geräte (Smartphones) erkennen und daraus ableiten welche Personen zu Hause sind. Das könnte direkt zur Personenzählung beitragen:

- Wenn 2 Smartphones im WLAN → `currentPersonCount >= 2`
- Wenn 0 Smartphones → `currentPersonCount = 0` (niemand zu Hause)
- Fallback wenn WLAN-Daten nicht vorhanden: Bewegungsmelder-Heuristik (OC-3 Stufe 2)

**Status:** Vorhanden aber noch nicht mit Personenzählung verknüpft. Muss in einem späteren Schritt aktiviert und priorisiert werden.

**Priorität:** Mittel — erst implementieren wenn OC-3 Stufe 2 stabil läuft

---

### OC-4: Schlafzeit-Zuverlässigkeit mit FP2 (17.03.2026)

**Problem:** Die Schlafzeit-Kachel (sleepWindowStart/sleepWindowEnd) zeigt unplausible Werte wenn:
- Der Adapter während der Nacht neu startet (z.B. wegen Update) → Aufwach-Zeit = Restart-Zeit
- FP2 kurze Aussetzer hat → scheinbares "Aufwachen" mitten in der Nacht

**Konsequenz:** "Schlafzeit 02:53–04:36" statt echtem 22:00–07:00 Fenster

**Offene Fragen:**
- Wie erkennen wir ob ein "Aufwachen" echt ist oder nur ein Adapter-Neustart?
- Mindest-Schlafdauer als Plausibilitätsprüfung (z.B. < 3h = unplausibel)?
- Soll der Startup-Save das sleepWindow NICHT berechnen wenn der eventHistory-Horizont < 4h ist?

**Kurzfristige Idee:** Bei Startup-Save: wenn `bedPresenceMinutes` aus eventHistory < 180 min (3h), kein sleepWindow berechnen → lieber kein Wert als falscher Wert

**Status:** ⏳ Noch nicht implementiert — nach nächstem stabilen Release diskutieren

---

### OC-3: Personenzählung im Haushalt — Architektur-Konzept (16.03.2026)

**Warum wichtig:**
Viele Krankheitsprofile (Demenz, Depression, UTI/Nykturie, Diabetes) funktionieren nur zuverlässig im Einpersonen-Kontext. Im Mehrpersonenhaushalt verfälschen sich Bewegungsprofile, Bad-Besuche sind nicht mehr einer Person zuordenbar. Das System muss wissen: **0 / 1 / 2+ Personen zu Hause**.

**Drei Ausbaustufen (Progressive Enhancement):**

#### ✅ Stufe 1 — Statische Konfiguration (v0.33.21)
- Neues Dropdown im System-Tab: „Standard-Haushaltsgröße: Alleine lebend / Zu zweit / Familie"
- Wird beim Adapter-Start als Baseline in `system.householdType` geschrieben
- Funktioniert ohne jegliche Sensor-Hardware

#### Stufe 2 — Räumliche Unmöglichkeit als Heuristik (mittelfristig)
**Idee:** Wenn zwei Sensoren an physisch nicht-benachbarten Räumen quasi-gleichzeitig feuern (< X Sekunden), kann das physisch nicht eine Person sein → mind. 2 Personen.

**Infrastruktur bereits vorhanden:**
- `this.sensorLastSeen` — Timestamp je Sensor-ID
- `analysis.topology.structure` — Raum-Adjazenz-Matrix (vom Nutzer im Sicherheits-Tab konfiguriert)
- `LTM.trainingData.sequences` — Bewegungssequenzen mit Zeitstempeln

**Algorithmus:**
1. Bei jedem Sensor-Event: prüfe alle anderen `sensorLastSeen`-Einträge der letzten X Sekunden
2. Für jeden anderen kürzlich aktiven Sensor: prüfe ob Räume laut Topologie-Matrix **nicht benachbart**
3. Wenn ja: `estimatedPersonCount = max(estimatedPersonCount, 2)`
4. Reset nach Y Minuten Inaktivität zurück auf 1

**Stärke:** Nur Flanken (rising edges), nicht sustained presence → funktioniert mit PIR
**Schwäche:** Erkennt nicht 2 Personen die lange im selben Raum sitzen

**Zeitfenster-Entscheidung:** 8-Sekunden-Fenster für Flanken-Erkennung
**✅ Implementiert in v0.33.22** — `_checkSpatialImpossibility()` in main.js, Reset auf Config-Baseline nach 1h Inaktivität (v0.33.24)

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

