# ioBroker.cogni-living

![Logo](admin/cogni-living.png)

**Neuro-Symbolic Autonomy for your Smart Home.**
*Beyond Automation: Security, Energy, Health & Comfort – powered by Deep Learning & Gemini.*

> **"Rule-based smart homes are history. Cogni-Living is an adaptive organism that understands the physics of your building and anticipates your intentions."**

---

## 🧠 What makes this system unique?

Cogni-Living is not just another adapter. It is a **Hybrid-AI Engine** that bridges the gap between classic IoT control and cutting-edge research in **Deep Learning** and **Large Language Models (LLM)**.

Instead of manually writing scripts ("If motion, then light"), Cogni-Living trains **three specialized neural networks** directly on your local hardware:

1.  **LSTM Autoencoder (Long Short-Term Memory):** Learns complex temporal patterns ("Normality") and detects anomalies based on reconstruction errors.
2.  **GCN (Graph Neural Networks):** Understands the topology of your home. It knows that the kitchen connects to the hallway, filtering out "teleportation errors" or ghost movements.
3.  **PINN (Physics-Informed Neural Networks):** An AI model that learns the thermodynamics of your building. It understands insulation values, solar gains, and heating curves with physical accuracy.

---

## 🏛️ The 4 Pillars of Autonomy

### 1. 🛡️ SECURITY: Adaptive Immunity
*More than just an alarm system. A guardian that understands context.*

* **Spatio-Temporal Awareness:** Analyzes the *sequence* and *velocity* of movements. An intruder moves differently than a resident.
* **Few-Shot Learning (Party Mode):** Thanks to adaptive overlay models, the system tolerates temporary deviations (guests, workmen) instantly without diluting its long-term memory.
* **Zero-Trust Architecture:** In vacation mode, strict rules apply. Any anomaly is immediately sent to the AI for evaluation.

### 2. 🍃 ENERGY: The Thermodynamic Twin
*Heating by prediction, not reaction. Saves energy before it's wasted.*

* **PINN Technology:** Calculates live **Insulation Scores** (passive cooling rate) and **Heating Scores** (active heating rate).
* **Smart Schedule Automation:** Links your calendar with physics. If you enter "Vacation End 18:00", the AI calculates: "I need to start at 14:23 to reach exactly 21°C."
* **Virtual Sensing (Ventilation Detective):** Detects open windows purely by analyzing temperature gradients (>3°C/h), even without physical window sensors.
* **MPC (Model Predictive Control):** Uses weather forecasts and thermal inertia ("Coasting") to cut heating early and utilize residual heat.

### 3. 🛋️ COMFORT: The Invisible Butler
*Zero-UI: The best interface is no interface.*

* **Predictive Automation:** The GCN calculates the probability of your next room. The bathroom light turns on *before* you even open the door.
* **Intent Learning:** Recognizes complex contexts ("If TV is on AND time > 8 PM, then dim lights").
* **LLM Agents:** Google Gemini acts as the "Cortex", evaluating complex situations and explaining decisions in natural language.

### 4. ❤️ HEALTH: Digital Phenotyping
*Medical-grade monitoring without cameras or wearables.*

* **Gait Speed Proxy:** Measures subtle changes in walking speed over months – a vital health indicator.
* **Long-Term Drift Analysis:** Detects if sleep patterns or activity levels deteriorate over time (e.g., signs of depression or early dementia).
* **Context-Aware Dead Man Switch:** An emergency alarm based on probability, not just time. ("Resident is in the bath, statistically returns after 15 min. After 45 min -> Alarm").

---

## 🚀 Tech Stack

This project is state-of-the-art engineering:

* **Backend:** Node.js (ioBroker) as Orchestrator.
* **AI Core:** Python Sidecar (fully integrated, auto-installing).
* **Libraries:** TensorFlow/PyTorch (for PINNs), Scikit-Learn (for Anomaly Detection), NetworkX (for Graphs).
* **Cloud AI:** Google Gemini Pro/Flash (for semantic reasoning & reporting).

---

## 💎 Features & Versions

| Feature | Standard (Free) | Pro (Neural Link) |
| :--- | :---: | :---: |
| **Google Gemini Integration** | ✅ Yes | ✅ Yes |
| **Auto-Discovery Wizard** | ✅ Yes | ✅ Yes |
| **LSTM Anomaly Detection** | ✅ Yes | ✅ Yes |
| **Ventilation Detective (Virtual Sensing)** | ✅ Yes | ✅ Yes |
| **Energy: Smart Warm-Up (Calendar)** | ❌ No | ✅ Yes |
| **Energy: PINN (Physics AI)** | ❌ No | ✅ Yes |
| **Health: Drift Analysis & GCN Filter** | ❌ No | ✅ Yes |
| **Security: Few-Shot Learning (Party)** | ❌ No | ✅ Yes |

---

## ⚖️ Disclaimer

1.  **Not a Medical Device:** Software does not replace a doctor. Intended for assistance (AAL).
2.  **Privacy First:** Local models (Random Forest, LSTM) run on your hardware. Only anonymized data is sent to Gemini for complex text analysis.
3.  **Liability:** Use at your own risk. Never rely solely on smart home tech in life-threatening situations.

---

## License
MIT License. Copyright (c) 2025 Dr.-Ing. Marc Jaeger.