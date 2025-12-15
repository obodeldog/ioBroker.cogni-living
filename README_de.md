# ioBroker.cogni-living

> **🇺🇸 English Version:** [Read the English documentation here](README.md)

![Logo](admin/cogni-living.png)

**Neuro-Symbolische Autonomie für Ihr Zuhause.**
*Beyond Automation: Sicherheit, Energie, Gesundheit & Komfort – getrieben von Deep Learning & Gemini.*

> **"Ein Smart Home, das nur Regeln befolgt, ist dumm. Cogni-Living ist ein kognitiver Organismus, der die Physik Ihres Gebäudes versteht, Ihre Gewohnheiten lernt und proaktiv handelt."**

---

## 🔬 Die Technologie: Deep Tech "Under the Hood"

Cogni-Living unterscheidet sich fundamental von herkömmlichen Adaptern. Es ist keine Sammlung von `if/else`-Skripten, sondern eine **hybride KI-Engine**, die Node.js (für I/O) mit einem performanten Python-Sidecar (für Data Science) verbindet.

Wir setzen auf Algorithmen, die sonst im **Autonomen Fahren** oder der **Medizintechnik** zu finden sind:

### 1. Spatio-Temporal Graph Convolutional Networks (ST-GCN)
Herkömmliche Alarmsysteme sehen Sensoren als isolierte Punkte. Cogni-Living sieht sie als **Graphen**.
* **Die Matrix:** Das System lernt die Topologie Ihres Hauses (welcher Raum grenzt an welchen?).
* **Der Nutzen:** Es erkennt "Teleportation". Wenn ein Bewegungsmelder im Keller auslöst, und 1 Sekunde später im Dachgeschoss, weiß das GCN: Das ist physikalisch unmöglich (Fehlalarm/Geist), da der Weg durch den Flur fehlt.

### 2. LSTM Autoencoder (Anomalie-Erkennung)
Ein neuronales Netz (Long Short-Term Memory), das darauf trainiert ist, Ihren **normalen Alltag** zu rekonstruieren.
* **Die Logik:** Das Netz komprimiert den Tagesablauf und versucht ihn wiederzugeben.
* **Der Alarm:** Bei Einbrüchen oder medizinischen Notfällen steigt der "Reconstruction Error" massiv an. Das System schlägt Alarm, weil die Situation *mathematisch* nicht zum gelernten Modell passt – ganz ohne starre Grenzwerte.

### 3. Physics-Informed Neural Networks (PINNs)
Wir kombinieren KI mit den Gesetzen der Thermodynamik.
* **Das Modell:** Ein neuronales Netz lernt die Heizkurve Ihres Hauses, wird aber durch eine physikalische "Loss-Function" bestraft, wenn es Gesetze der Thermodynamik verletzt.
* **Das Ergebnis:** Extrem präzise Vorhersagen über Temperaturverläufe, Isolation und solare Gewinne, selbst bei wenigen Datenpunkten.

---

## 🏛️ Die 4 Säulen der Autonomie

### 1. 🛡️ SECURITY: Adaptive Immunität
*Ein Wächter, der Kontext versteht und nicht nervt.*

* **Few-Shot Learning (Party-Modus):** Klassische KI braucht Wochen zum Lernen. Unsere "Adaptive Immunität" lernt temporäre Muster (Gäste, Handwerker) in Sekunden. Ein Klick auf "Party", und das System toleriert die Abweichung für diesen Abend, ohne das Langzeitgedächtnis zu verwässern.
* **Zero-Trust Vacation:** Im Urlaubsmodus wird die Toleranz auf Null gesetzt. Jede sensorische Anomalie wird an **Google Gemini** gesendet, um eine semantische Einschätzung der Bedrohung zu erhalten.

### 2. 🍃 ENERGY: Der Physikalische Zwilling
*Heizen mit Präzision statt Pauschalität.*

* **Smart Schedule Automation:** Das System liest Ihren **iCal-Kalender**.
    * Eintrag *"Urlaub Ende 18:00"*: Das PINN berechnet basierend auf Außentemperatur und Isolation exakt die Vorlaufzeit. Die Heizung startet z.B. um 14:23 Uhr, damit es bei Ankunft punktgenau 21°C hat.
    * Eintrag *"Jana kommt"*: Das System erkennt den Raumnamen und heizt nur das Kinderzimmer vor.
* **Ventilation Detective (Virtual Sensing):** Erkennt offene Fenster rein durch die Analyse von Temperaturgradienten (>3°C/h Abfall), selbst in Räumen ohne Fensterkontakte.
* **Valve-Health-Check:** Überwacht permanent, ob die Stellantriebe plausibel zur Raumtemperatur reagieren, um Defekte oder hydraulische Probleme zu identifizieren.

### 3. 🛋️ COMFORT: Der unsichtbare Butler
*Zero-UI: Das Haus agiert, bevor Sie es befehlen.*

* **Prädiktive Pfad-Automation:** Basierend auf GCN-Wahrscheinlichkeiten weiß das Haus, wohin Sie gehen. Das Licht im Flur dimmt auf, bevor Sie die Wohnzimmertür öffnen.
* **Intent Recognition:** Es lernt komplexe Zusammenhänge ("Wenn TV läuft UND Zeit > 20:00 Uhr UND Helligkeit < 100 lux -> Setze Szene 'Cinema'").
* **LLM-Agent (Der Cortex):** Sie können mit Ihrem Haus chatten. Fragen Sie: *"Warum ist die Heizung im Bad an?"* und erhalten Sie eine logische Antwort: *"Weil ich laut Kalender erwarte, dass du in 30 Minuten nach Hause kommst."*

### 4. ❤️ HEALTH: Digital Phenotyping
*Präventivmedizin durch Verhaltensanalyse (Ambient Assisted Living).*

* **Gait Speed Proxy:** Das System misst subtil die Gehgeschwindigkeit in Durchgangsbereichen (Flur). Eine schleichende Verlangsamung über Monate kann ein Frühwarnzeichen für gesundheitliche Probleme sein.
* **Langzeit-Drift-Analyse:** Erkennt Veränderungen im Biorhythmus (Schlafstörungen, nächtliche Unruhe, soziale Isolation) und visualisiert diese Trends im Dashboard.
* **Kontext-Sensitiver Totmann-Schalter:** Ein Notruf, der Wahrscheinlichkeiten nutzt. Wenn jemand ins Bad geht, erwartet das System statistisch eine Rückkehr nach X Minuten. Bleibt diese aus, erfolgt eine sanfte Nachfrage, dann ein Alarm.

---

## 🚀 Installation & Setup

1.  **Adapter installieren:** Via ioBroker Admin oder GitHub. (Python-Umgebung wird automatisch eingerichtet).
2.  **API Key:** Kostenlosen Google Gemini API Key besorgen und in den Einstellungen hinterlegen.
3.  **Auto-Discovery:** Starten Sie den Wizard im Tab "Sensoren". Er findet Lichter, Thermostate und Fensterkontakte automatisch.
4.  **Kalender (Optional):** Verknüpfen Sie Ihre iCal-Instanz für die Smart-Schedule-Steuerung.

---

## 📊 Das Mission Control Dashboard

Cogni-Living bringt ein eigenes, professionelles React-Frontend mit:
* **Echtzeit-Matrix:** Sehen Sie live, wie die neuronalen Netze feuern.
* **Thermodynamik-Visualisierung:** Grafische Darstellung der Gebäudehülle (Isolation vs. Power).
* **Diagnose-Tools:** Prüfen Sie, ob Ventile und Sensoren korrekt zugeordnet sind.

---

## ⚖️ Disclaimer & Sicherheit

1.  **Kein Medizinprodukt:** Software ersetzt keinen Arzt. Dient zur Unterstützung (AAL).
2.  **Privacy First:** Lokale Modelle (Random Forest, LSTM) laufen auf Ihrer Hardware (Edge Computing). Nur für komplexe Text-Analysen werden anonymisierte Metadaten an Gemini gesendet.
3.  **Haftung:** Nutzung auf eigene Gefahr. Verlassen Sie sich bei Lebensgefahr nicht auf Smart-Home-Technik.

---

## License
MIT License. Copyright (c) 2025 Dr.-Ing. Marc Jaeger.