![Logo](admin/cogni-living.png)

# ioBroker.cogni-living

**AI-powered behavioral analysis for Health, Safety & Comfort.**

[![German Version](https://img.shields.io/badge/Sprache-Deutsch-black)](README_de.md)

---

## 📖 About this Adapter

**Cogni-Living** transforms your smart home from a passive system into an intelligent, thinking assistant. Instead of manually programming hundreds of rules ("If motion, then light"), this adapter uses state-of-the-art Artificial Intelligence (**Google Gemini**) to understand and interpret your sensor data.

Especially suitable for:
* **Ambient Assisted Living (AAL):** Worry-free living for seniors through intelligent routine monitoring.
* **Security:** Detection of anomalies that traditional alarm systems miss.
* **Health Monitoring:** Detection of gradual behavioral changes (e.g., reduced mobility).

---

## ⚙️ How it Works & History

The adapter operates using a dual-memory model, developed over 26 intense sprints:

### 1. Short-Term Memory (STM) [Sprints 1-20]
The "Autopilot" monitors the last 50 events in real-time.
* **Example:** It's 3 AM, the front door opens, but no one is in the hallway? -> **Alert.**
* **Example:** The resident fell in the bathroom and hasn't moved for 30 minutes? -> **Alert.**

### 2. Long-Term Memory (LTM) [Sprint 21]
Every night, the AI creates a summary ("Daily Digest") of the day and learns the resident's normal habits.
* **Drift Analysis:** A special algorithm compares behavior from the last 2 weeks with the long-term average. This detects gradual changes (e.g., "Resident leaves the house much less often than before").

### 3. Professional Foundation [Sprints 22-24]
* **SaaS Security:** Code obfuscation and license key validation.
* **Auto-Discovery:** A wizard automatically scans your ioBroker for sensors.
* **User Feedback:** A reinforcement learning loop allows users to rate AI decisions.

---

## 🚀 Features in Detail

### 🛡️ Active Safety (Dead Man's Switch) [NEW Sprint 25/26]
Standard AI systems only react when something happens. **Cogni-Living reacts when NOTHING happens.**
* **Inactivity Monitor:** If no sensor activity is detected for a defined period (e.g., 12 hours) while the system is in "Normal" mode, the adapter triggers an **EMERGENCY** state.
* **Smart Presence:** The system intelligently detects if the resident is home or away based on door sensors and movement patterns, preventing false alarms during vacations or shopping trips.
* **Emergency Escalation:** Unlike normal alerts, Emergency events trigger high-priority push notifications (e.g., Pushover Priority 2 with Siren).

### 📊 LTM Dashboard
Visualize behavior directly in the admin panel.
* Bar charts show activity levels per day.
* Detailed text summaries explain the daily routine.
* The Drift Indicator warns of long-term negative trends.

### 🔔 Intelligent Notifications
Receive warnings not just as log entries, but directly on your smartphone. Supported services:
* Telegram
* Pushover (Supports Emergency Priority & Retry)
* Email
* WhatsApp (via CMB Adapter)
* Signal (via CMA Adapter)

---

## 💎 Free vs. Pro Version

| Feature | Free Version | Pro Version |
| :--- | :---: | :---: |
| **STM Real-time Analysis** | ✅ | ✅ |
| **Dead Man's Switch (Inactivity)** | ✅ | ✅ |
| **AI Context (Weather/Persona)** | ✅ | ✅ |
| **Auto-Discovery Wizard** | ✅ | ✅ |
| **Notifications** | ✅ | ✅ |
| **Long-Term Memory (LTM)** | ❌ | ✅ |
| **Daily Digests** | ❌ | ✅ |
| **Drift Analysis (Health)** | ❌ | ✅ |
| **Automation Proposals** | ❌ | ✅ |
| **LTM Dashboard** | ❌ | ✅ |

> **Note on Pro Version:** A license key is required for commercial use or full feature access.

---

## 🛠️ Setup in 5 Steps

1.  **Installation:** Install the adapter via ioBroker Admin.
2.  **API Key:** Get a free [Google Gemini API Key](https://aistudio.google.com/app/apikey) and enter it in the settings.
3.  **Auto-Scan:** Click on **"Auto-Scan (Wizard)"** in the configuration tab. Select your sensors and import them.
4.  **Context:** Briefly describe the living situation in the "Context" field (e.g., *"Resident is 82 years old, lives alone, owns a dog."*). This greatly helps the AI avoid false alarms.
5.  **Safety:** Enable the **Inactivity Monitor** in settings if you use this for AAL/Elderly Care.

---

## 📜 Changelog

### 0.3.5 (2025-11-26)
* (Marc Jaeger) **Maintenance Release**
* 🛠️ **Fix:** Resolved issues with UI translations and saving settings.
* 🛠️ **Fix:** Improved robustness of "Smart Presence" logic.

### 0.3.1 (2025-11-26)
* (Marc Jaeger) **Feature Release: Safety**
* ✨ **New:** **Dead Man's Switch (Inactivity Monitor)** added. Triggers alarm if no events occur for X hours.
* ✨ **New:** **Emergency State**. Distinction between "Alert" (Yellow) and "Emergency" (Red).
* ✨ **New:** Pushover Priority 2 support (Emergency Siren & Retry) for critical alarms.

### 0.3.0 (2025-11-25)
* (Marc Jaeger) **Major UI Release**
* ✨ **New:** Complete UI Overhaul ("App-like" experience). Introduced "Overview" (Cockpit) and "Activities" (Journal) tabs.
* ✨ **New:** Implemented Feedback-Loop (Reinforcement Learning). Users can now rate AI analysis ("Thumbs up/down") to train the model.
* 🛠️ **Fix:** Massive improvements to Dark Mode / High Contrast theme.

### 0.2.4 (2025-11-25)
* (Marc Jaeger) **Hotfix**: Added location context injection (Lat/Lon) so AI understands local time and weather context better.

### 0.2.0 (2025-11-24)
* (Marc Jaeger) **Major Release**
* ✨ **New:** Implemented Auto-Discovery Wizard.
* ✨ **New:** Added LTM Dashboard UI.
* ✨ **New:** Implemented Licensing & Hardware Binding.

### 0.1.0 - 0.1.22
* (Marc Jaeger) Initial development of Cogni-Engine (STM & LTM logic).

---

## 📄 License

MIT License (Codebase).
Use of Pro features is subject to separate license terms.

Copyright (c) 2025 Marc Jaeger <mj112@gmx.de>