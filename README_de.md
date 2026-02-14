# ioBroker.cogni-living

> **🇺🇸 English Version:** [Read the English documentation here](README.md)

![Logo](admin/cogni-living.png)

**Neuro-Symbolische Autonomie für Ihr Zuhause.**
*Beyond Automation: Sicherheit, Energie, Gesundheit & Komfort – getrieben von Deep Learning & Gemini.*

> **"Regelbasierte Smart Homes waren gestern. Cogni-Living ist ein adaptiver Organismus, der die Physik Ihres Hauses versteht und Ihre Intentionen vorausahnt."**

---

## 🧠 Was macht dieses System einzigartig?

Cogni-Living ist kein gewöhnlicher Adapter. Es ist eine **Hybrid-AI Engine**, die klassische IoT-Steuerung mit modernster Forschung aus den Bereichen **Deep Learning** und **Large Language Models (LLM)** verbindet.

Anstatt manuell Skripte zu schreiben ("Wenn Bewegung, dann Licht"), trainiert Cogni-Living **drei spezialisierte neuronale Netze** direkt auf Ihrer Hardware:

1.  **LSTM Autoencoder (Long Short-Term Memory):** Lernt komplexe zeitliche Muster ("Normalität") und erkennt Anomalien (Einbruch, Krankheit) anhand des Rekonstruktionsfehlers.
2.  **GCN (Graph Neural Networks):** Versteht die Topologie Ihres Hauses. Es weiß, dass Küche und Flur verbunden sind und filtert "Teleportations-Fehler" oder Geister-Bewegungen heraus.
3.  **PINN (Physics-Informed Neural Networks):** Ein KI-Modell, das die Thermodynamik Ihres Gebäudes lernt. Es versteht Dämmwerte, solare Gewinne und Heizkurven physikalisch korrekt.

---

## 🏛️ Die 4 Säulen der Autonomie

### 1. 🛡️ SECURITY: Adaptive Immunität
*Mehr als nur ein Alarmsystem. Ein Wächter, der den Kontext versteht.*

* **Spatio-Temporal Awareness:** Das System unterscheidet nicht nur "Bewegung ja/nein", sondern analysiert die *Sequenz* und *Geschwindigkeit*. Ein Einbrecher bewegt sich anders als ein Bewohner.
* **Few-Shot Learning (Party-Modus):** Dank adaptiver Overlay-Modelle lernt das System temporäre Abweichungen (Gäste, Handwerker) in Sekunden, ohne das Langzeitgedächtnis zu verwässern.
* **Zero-Trust Architektur:** Im Urlaubsmodus gelten verschärfte Regeln. Jede Anomalie wird sofort an die KI zur Bewertung gesendet.

### 2. 🍃 ENERGY: Der Physikalische Zwilling
*Heizen mit Prädiktion statt Reaktion. Spart Energie, bevor sie verschwendet wird.*

* **PINN-Technologie:** Das System berechnet live den **Isolations-Score** (Wie schnell kühlt der Raum aus?) und den **Heating-Score** (Wie schnell heizt er auf?).
* **Smart Schedule Automation:** Verknüpft Ihren Kalender mit der Physik. Wenn Sie "Urlaub Ende 18:00" eintragen, berechnet die KI exakt: "Ich muss um 14:23 Uhr starten, damit es punktgenau 21°C hat".
* **Virtual Sensing (Ventilation Detective):** Erkennt offene Fenster rein durch die Analyse von Temperaturstürzen (>3°C/h), selbst ohne physische Fenstersensoren.
* **MPC (Model Predictive Control):** Nutzt Wettervorhersagen und thermische Trägheit ("Coasting"), um die Heizung früher abzuschalten und Restwärme zu nutzen.

### 3. 🛋️ COMFORT: Der unsichtbare Butler
*Zero-UI: Das beste Interface ist kein Interface.*

* **Prädiktive Automation:** Das GCN berechnet die Wahrscheinlichkeit Ihres nächsten Raums. Das Licht im Bad geht schon an, *bevor* Sie die Tür öffnen.
* **Intent Learning:** Erkennt komplexe Zusammenhänge ("Wenn TV an und Uhrzeit > 20:00, dann Licht gedimmt").
* **LLM-Agenten:** Google Gemini fungiert als "Cortex", der komplexe Situationen bewertet und Entscheidungen in natürlicher Sprache erklärt.

### 4. ❤️ HEALTH: Digital Phenotyping
*Medizinische Frühwarnung ohne Kameras oder Wearables.*

* **Gait Speed Proxy:** Misst schleichende Veränderungen in der Gehgeschwindigkeit über Monate hinweg – ein wichtiger Vitalindikator.
* **Langzeit-Drift-Analyse:** Erkennt, wenn sich Schlafmuster oder Aktivitätsniveaus subtil verschlechtern (z.B. Anzeichen von Depression oder beginnender Demenz).
* **Kontext-Sensitiver Totmann-Schalter:** Ein Notruf, der nicht stur nach Zeit geht, sondern nach Wahrscheinlichkeit. ("Bewohner ist im Bad, kommt statistisch nach 15 min zurück. Nach 45 min -> Alarm").

---

## 🚀 Technologie-Stack

Dieses Projekt ist "State of the Art" Engineering:

* **Backend:** Node.js (ioBroker) als Orchestrator.
* **AI Core:** Python Sidecar (voll integriert, installiert sich selbst).
* **Libraries:** TensorFlow/PyTorch (für PINNs), Scikit-Learn (für Anomalie-Erkennung), NetworkX (für Graphen).
* **Cloud AI:** Google Gemini Pro/Flash (für semantisches Verstehen & Reporting).

---

## 💎 Features & Versionen

| Feature | Standard (Free) | Pro (Neural Link) |
| :--- | :---: | :---: |
| **Google Gemini Integration** | ✅ Ja | ✅ Ja |
| **Auto-Discovery Wizard** | ✅ Ja | ✅ Ja |
| **LSTM Anomaly Detection** | ✅ Ja | ✅ Ja |
| **Ventilation Detective (Virtual Sensing)** | ✅ Ja | ✅ Ja |
| **Energy: Smart Warm-Up (Kalender)** | ❌ Nein | ✅ Ja |
| **Energy: PINN (Physics AI)** | ❌ Nein | ✅ Ja |
| **Health: Drift-Analyse & GCN-Filter** | ❌ Nein | ✅ Ja |
| **Security: Few-Shot Learning (Party)** | ❌ Nein | ✅ Ja |

---

## ⚖️ Disclaimer & Sicherheit

1.  **Kein Medizinprodukt:** Software ersetzt keinen Arzt. Dient zur Unterstützung (AAL).
2.  **Privacy First:** Lokale Modelle (Random Forest, LSTM) laufen auf Ihrer Hardware. Nur für komplexe Text-Analysen werden anonymisierte Daten an Gemini gesendet.
3.  **Haftung:** Nutzung auf eigene Gefahr. Verlassen Sie sich bei Lebensgefahr nicht auf Smart-Home-Technik.

---

---

## 📊 Benutzer-Handbuch: Gesundheits-Dashboard

### 🎯 Navigation: TAG / WOCHE / MONAT

Oben rechts finden Sie drei Ansichten:

- **TAG:** Zeigt die aktuelle 24-Stunden-Ansicht mit Schlaf-Radar, Neuro-Timeline und Raum-Nutzung.
- **WOCHE:** Zeigt eine rollende 7-Tage-Übersicht mit Langzeit-Trends, Aktivitätsmuster und Raum-Histogrammen.
- **MONAT:** Zeigt eine rollende 30-Tage-Übersicht mit Langzeit-Trends und Anomalie-Erkennung.

#### **LIVE-Modus:**
- Wenn aktiviert (grüner Punkt), werden Daten in Echtzeit aktualisiert.
- Wenn deaktiviert (grauer Punkt), können Sie historische Daten durchblättern.

---

### 🌙 Schlaf-Radar (22:00-08:00 Uhr)

Das Schlaf-Radar zeigt Ihnen zwei getrennte Aktivitätslinien:

1. **UNRUHE IM SCHLAFZIMMER:** Bewegungen innerhalb des Schlafzimmers (unruhiger Schlaf, häufiges Umdrehen).
2. **NÄCHTLICHE AKTIVITÄT (AUSSERHALB):** Bewegungen außerhalb des Schlafzimmers (z.B. Toilettengänge, Küche).

#### **Farbcode (adaptiv):**
- 🟢 **Grün:** Normal (typisch für dieses Haus)
- 🟡 **Gelb:** Leicht erhöht
- 🟠 **Orange:** Deutlich erhöht
- 🔴 **Rot:** Sehr unruhig (> 2× über Durchschnitt)

**Tipp:** Die Farben passen sich automatisch an Ihr Haus an. Was bei einem Haus "unruhig" ist, kann bei einem anderen "normal" sein (je nach Sensorempfindlichkeit).

---

### 📊 Langzeit-Trends (WOCHE/MONAT)

Oben im Gesundheits-Dashboard finden Sie **6 Garmin-Style Trend-Graphen**:

#### 1️⃣ **Aktivitätsbelastung**
Zeigt Ihre tägliche Aktivität relativ zur individuellen Baseline:
- **Grüne Zone:** Normal (±20% vom Durchschnitt)
- **Darüber:** Sehr aktiv (kann positiv oder negativ sein, z.B. Überanstrengung)
- **Darunter:** Ruhig (kann auf Krankheit oder Erschöpfung hinweisen)

#### 2️⃣ **Ganggeschwindigkeit**
Misst indirekt Ihre Mobilität über Flur-/Diele-Sensoren:
- **Steigende Linie:** Schnellere Bewegung (gut!)
- **Fallende Linie:** Langsamere Bewegung (Hinweis auf Mobilitätsverlust)

**Konfiguration:** Unter "System-Tab" → "Sensor-Liste" können Sie Sensoren als "Flur?" markieren.

#### 3️⃣ **Nacht-Unruhe**
Anzahl der Bewegungen **im Schlafzimmer** während der Nacht (22:00-06:00):
- **Niedrig:** Ruhiger Schlaf
- **Hoch:** Unruhiger Schlaf (z.B. Schmerzen, Stress)

#### 4️⃣ **Raum-Mobilität**
Anzahl der verschiedenen Räume, die Sie pro Tag nutzen:
- **Hoch:** Aktiv im ganzen Haus
- **Niedrig:** Beschränkt auf wenige Räume (kann auf Isolation hinweisen)

#### 5️⃣ **Bad-Nutzung**
Anzahl der Toilettengänge pro Tag:
- **Normal:** 5-8x (je nach Person)
- **Sehr hoch:** Kann auf Gesundheitsprobleme hinweisen

#### 6️⃣ **Frischluft-Index**
Anzahl der Fenster-/Türöffnungen pro Tag:
- **Gut:** 3-5x pro Tag
- **Niedrig:** Zu wenig Lüftung (Luftqualität!)

---

### 📈 Raum-Nutzung Histogramme (WOCHE/MONAT)

In der **Wochenansicht** und **Monatsansicht** sehen Sie **Mini-Histogramme für jeden Raum**.

#### **Farbcode:**
- 🟢 **Grün:** Normale Nutzung
- 🔴 **Rot:** **ANOMALIE!** (< Durchschnitt - 2× Standardabweichung)

**Was bedeutet das?**
- Eine rote Anomalie bedeutet, dass der Raum **viel weniger** genutzt wurde als sonst.
- **Beispiel:** Wenn das Schlafzimmer plötzlich rot wird, könnte das bedeuten, dass die Person die Nacht woanders verbracht hat (oder krank ist).

**Technische Details:**
- Das System berechnet für jeden Raum den **Durchschnitt** und die **Standardabweichung** (ein Maß für die Schwankung).
- Balken, die **unter (Durchschnitt - 2× Standardabweichung)** liegen, werden rot markiert.
- Diese Methode passt sich automatisch an jedes Haus an (keine festen Schwellwerte!).

---

### 🔴 Lebenszeichen-Alarm

Neben den Raum-Namen sehen Sie farbige Punkte:
- 🟢 **Keine Warnung:** Alles normal
- 🟡 **Gelbe Warnung:** Keine Aktivität seit 6-12 Stunden (je nach Raum/Tageszeit)
- 🔴 **Rote Warnung:** **KRITISCH!** Keine Aktivität seit >12 Stunden

**Was tun bei roter Warnung?**
1. Überprüfen Sie, ob die Person anwesend ist.
2. Rufen Sie die Person an oder besuchen Sie sie.
3. Bei Notfall: Notruf 112!

**Wichtig:** Der Alarm passt sich an Ihren Tagesrhythmus an. Nachts im Schlafzimmer ist keine Aktivität normal!

---

### 🛠️ Konfiguration

#### **System-Tab → Sensor-Liste:**
- **Flur?** Checkbox: Markieren Sie Sensoren, die für Ganggeschwindigkeits-Analyse genutzt werden sollen.
- **Exit?** Checkbox: Markieren Sie Türen/Fenster, die als Hauptausgänge gelten.

#### **Reporting & Kontext:**
- **Gemini API Key:** Für KI-generierte Zusammenfassungen
- **Briefing-Zeit:** Wann soll das Morgen-Briefing per Pushover kommen?
- **Pushover User/Token:** Für Benachrichtigungen

---

### 🎨 Tipps & Best Practices

1. **Vergleichen Sie Wochen miteinander:** Nutzen Sie die Monatsansicht, um langfristige Trends zu erkennen.
2. **Achten Sie auf rote Anomalien:** Diese sind oft die ersten Hinweise auf Veränderungen.
3. **Schauen Sie täglich rein:** Gewöhnen Sie sich an ein kurzes "Health Check" (1 Minute).
4. **Passen Sie Sensoren an:** Je mehr Sensoren Sie als "Flur" markieren, desto genauer die Ganggeschwindigkeit.

---

## ⚖️ Disclaimer & Sicherheit

1.  **Kein Medizinprodukt:** Software ersetzt keinen Arzt. Dient zur Unterstützung (AAL).
2.  **Privacy First:** Lokale Modelle (Random Forest, LSTM) laufen auf Ihrer Hardware. Nur für komplexe Text-Analysen werden anonymisierte Daten an Gemini gesendet.
3.  **Haftung:** Nutzung auf eigene Gefahr. Verlassen Sie sich bei Lebensgefahr nicht auf Smart-Home-Technik.

---

## License
MIT License. Copyright (c) 2025 Dr.-Ing. Marc Jaeger.