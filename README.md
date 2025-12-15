# ioBroker.cogni-living

> **🇩🇪 Deutsche Version:** [Hier die deutsche Dokumentation lesen](README_de.md)

![Logo](admin/cogni-living.png)

**Neuro-Symbolic Autonomy for your Smart Home.**
*Beyond Automation: Security, Energy, Health & Comfort – powered by Deep Learning & Gemini.*

> **"A smart home that simply follows rules is dumb. Cogni-Living is a cognitive organism that understands the physics of your building, learns your habits, and acts proactively."**

---

## 🔬 The Technology: Deep Tech "Under the Hood"

Cogni-Living is fundamentally different from traditional adapters. It is not a collection of `if/else` scripts, but a **Hybrid-AI Engine** connecting Node.js (for I/O) with a high-performance Python sidecar (for Data Science).

We utilize algorithms typically found in **Autonomous Driving** or **Medical Technology**:

### 1. Spatio-Temporal Graph Convolutional Networks (ST-GCN)
Traditional alarm systems see sensors as isolated points. Cogni-Living sees them as a **Graph**.
* **The Matrix:** The system learns the topology of your home (which room connects to which?).
* **The Benefit:** It detects "Teleportation". If a motion sensor triggers in the basement, and 1 second later in the attic, the GCN knows: This is physically impossible (Ghost/False Alarm) because the path through the hallway is missing.

### 2. LSTM Autoencoder (Anomaly Detection)
A neural network (Long Short-Term Memory) trained to reconstruct your **normal daily life**.
* **The Logic:** The network compresses the daily routine and attempts to reproduce it.
* **The Alarm:** In case of break-ins or medical emergencies, the "Reconstruction Error" spikes. The system alerts you because the situation *mathematically* does not fit the learned model – without rigid thresholds.

### 3. Physics-Informed Neural Networks (PINNs)
We combine AI with the laws of thermodynamics.
* **The Model:** A neural network learns your home's heating curve but is penalized by a physical "Loss Function" if it violates thermodynamic laws.
* **The Result:** Extremely precise predictions of temperature trends, insulation, and solar gains, even with sparse data points.

---

## 🏛️ The 4 Pillars of Autonomy

### 1. 🛡️ SECURITY: Adaptive Immunity
*A guardian that understands context and doesn't annoy.*

* **Few-Shot Learning (Party Mode):** Classical AI takes weeks to learn. Our "Adaptive Immunity" learns temporary patterns (guests, workmen) in seconds. One click on "Party", and the system tolerates deviations for that evening without diluting long-term memory.
* **Zero-Trust Vacation:** In vacation mode, tolerance is set to zero. Every sensory anomaly is sent to **Google Gemini** for a semantic threat assessment.

### 2. 🍃 ENERGY: The Thermodynamic Twin
*Heating with precision instead of general assumptions.*

* **Smart Schedule Automation:** Reads your **iCal calendar**.
    * Entry *"Vacation End 18:00"*: The PINN calculates the exact lead time based on outside temp and insulation. Heating starts e.g., at 14:23 to reach exactly 21°C upon arrival.
    * Entry *"Jana arriving"*: The system recognizes the room name and pre-heats only the child's room.
* **Ventilation Detective (Virtual Sensing):** Detects open windows purely by analyzing temperature gradients (>3°C/h drop), even in rooms without window contacts.
* **Valve-Health-Check:** Permanently monitors if valve actuators respond plausibly to room temperature to identify defects or hydraulic issues.

### 3. 🛋️ COMFORT: The Invisible Butler
*Zero-UI: The house acts before you command it.*

* **Predictive Path Automation:** Based on GCN probabilities, the house knows where you are going. The hallway light dims up *before* you open the living room door.
* **Intent Recognition:** Learns complex contexts ("If TV is on AND time > 8 PM AND brightness < 100 lux -> Set Scene 'Cinema'").
* **LLM Agent (The Cortex):** You can chat with your home. Ask: *"Why is the bathroom heating on?"* and get a logical answer: *"Because, according to the calendar, I expect you home in 30 minutes."*

### 4. ❤️ HEALTH: Digital Phenotyping
*Preventive medicine via behavioral analysis (Ambient Assisted Living).*

* **Gait Speed Proxy:** Subtly measures walking speed in transit areas (hallways). A gradual slowdown over months can be an early warning sign of health issues.
* **Long-Term Drift Analysis:** Detects changes in biorhythms (sleep disorders, nocturnal restlessness, social isolation) and visualizes these trends in the dashboard.
* **Context-Aware Dead Man Switch:** An emergency alarm using probabilities. If someone enters the bathroom, the system statistically expects a return after X minutes. If absent, a gentle query follows, then an alarm.

---

## 🚀 Installation & Setup

1.  **Install Adapter:** Via ioBroker Admin or GitHub. (Python environment is set up automatically).
2.  **API Key:** Get a free Google Gemini API Key and save it in settings.
3.  **Auto-Discovery:** Start the wizard in the "Sensors" tab. It automatically finds lights, thermostats, and window contacts.
4.  **Calendar (Optional):** Link your iCal instance for Smart Schedule control.

---

## 📊 The Mission Control Dashboard

Cogni-Living comes with its own professional React frontend:
* **Real-time Matrix:** Watch the neural networks fire live.
* **Thermodynamic Visualization:** Graphic representation of the building envelope (Insulation vs. Power).
* **Diagnostic Tools:** Check if valves and sensors are correctly mapped.

---

## ⚖️ Disclaimer & Safety

1.  **Not a Medical Device:** Software does not replace a doctor. Intended for assistance (AAL).
2.  **Privacy First:** Local models (Random Forest, LSTM) run on your hardware (Edge Computing). Only anonymized metadata is sent to Gemini for complex text analysis.
3.  **Liability:** Use at your own risk. Never rely solely on smart home tech in life-threatening situations.

---

## License
MIT License. Copyright (c) 2025 Dr.-Ing. Marc Jaeger.