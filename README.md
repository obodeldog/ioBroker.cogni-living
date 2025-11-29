# ioBroker.cogni-living

![Logo](admin/cogni-living.png)

**Artificial Intelligence for your Home: Safety, Health & Comfort in one system.**

> **"A smart home is only truly smart if it cares about you."**

Cogni-Living acts as an intelligent guardian, using Google Gemini AI to understand the complex behavioral patterns within your household. It doesn't just detect *that* something moved – it understands *if* that movement is normal, unusual, or potentially dangerous.

## 🎯 What is this system for?

Cogni-Living is designed to address three core needs:

1.  **Ambient Assisted Living (AAL) & Senior Safety:**
    Allows elderly people to live safely on their own for longer. The system detects falls (via inactivity in unusual places) or gradual changes in daily routines without the need for cameras or wearable panic buttons.

2.  **Security & Intrusion Detection:**
    Distinguishes between "Resident getting a glass of water at night" and "Stranger in the house". In vacation mode, every activity triggers an immediate alert.

3.  **Comfort & The Butler:**
    Learns your habits ("Whenever I enter the bathroom, I turn on the light") and offers to automate these tasks for you proactively.

---

## 🛡️ How it works: The 3-Phase Neuro Model

The system analyzes data on three time scales simultaneously:

### Phase 1: The Instant Guardian (Ad-Hoc)
* **Reaction:** Immediate (Real-time).
* **Detects:** Acute emergencies.
* *Example:* Someone enters the bathroom but doesn't leave after 60 minutes. Or: It's 9:00 AM and there is still no movement in the house (resident usually wakes up at 7:00 AM).
* **Action:** Sends immediate alarm via Telegram/Pushover ("Suspicious silence!").

### Phase 2: The Health Check (Short-Term Baseline)
* **Reaction:** Analyzes the last 14 days.
* **Detects:** Acute illness or stress.
* *Example:* The resident suddenly needs to use the bathroom 5 times a night (Normal: 1x). This indicates an infection or sleep disorder.
* **Action:** Notification in the "Good Morning" briefing.

### Phase 3: The Long-Term Analysis (Long-Term Drift)
* **Reaction:** Compares the last 60 days.
* **Detects:** Gradual decline (Drift).
* *Example:* Mobility decreases by 20% over several months. Time spent in bed increases steadily. Such changes are often invisible in daily life but medically significant.
* **Action:** Report in the Dashboard (Pro Feature).

---

## 💎 Free vs. Pro Version

The adapter is fully functional and free to use. Extended features are available for users requiring deep long-term analysis.

| Feature | Free Version (Standard) | Pro Version (License) |
| :--- | :---: | :---: |
| **AI Analysis (Gemini)** | ✅ Yes | ✅ Yes |
| **Emergency Detection (Phase 1)** | ✅ Yes | ✅ Yes |
| **Auto-Discovery Wizard** | ✅ Yes | ✅ Yes |
| **Family Link (Telegram Alerts)** | ✅ Yes | ✅ Yes |
| **The Butler (Automation)** | ✅ Yes | ✅ Yes |
| **Long-Term Memory (LTM)** | ❌ No (Live Logs only) | ✅ Yes (Database) |
| **Drift Analysis (Phase 3)** | ❌ No | ✅ Yes |
| **Python Stats Engine** | ❌ No | ✅ Yes |
| **Doctor Export (PDF Report)** | ❌ No | ✅ Yes |

---

## 🚀 Installation & Setup (Zero-Config)

### 1. Install Adapter
Install the adapter via ioBroker. The system automatically checks for Python and installs it if missing (Linux).

### 2. Connect AI
Get a free API Key from [Google AI Studio](https://aistudio.google.com/) and enter it in the adapter settings.

### 3. Find Sensors
Start the **Auto-Discovery Wizard** in the "Sensors" tab. The adapter scans your home for motion detectors, door sensors, and lights and adds them automatically.

### 4. Hybrid Engine (Self-Healing)
Upon first start, the adapter checks if all AI libraries (Numpy, Pandas) are present. If not, it downloads them **automatically** in the background. No manual Linux commands required in most cases.

---

## ⚖️ IMPORTANT LEGAL DISCLAIMER

**PLEASE READ CAREFULLY:**

1.  **Not a Medical Device:** This software is **NOT** a medical device according to Regulation (EU) 2017/745. It is for informational and smart home comfort purposes only.
2.  **No Emergency Guarantee:** **NEVER** rely solely on this software in health emergencies or life-threatening situations. Technology can fail (power outage, internet loss, bugs).
3.  **Liability:** The developer accepts no liability for damages resulting from the use, malfunction, or interpretation of the data.
4.  **Privacy:** Analysis is performed via the Google Gemini API. Sensor data is sent to Google for processing. Ensure this complies with your privacy requirements.

---

## License
MIT License. Copyright (c) 2025 Dr.-Ing. Marc Jaeger.