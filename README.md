![Logo](admin/cogni-living.png)

# ioBroker.cogni-living

**AI-powered behavioral analysis for health, safety & comfort.**

[![Deutsche Version](https://img.shields.io/badge/Language-Deutsch-blue)](README_de.md)

---

## 📖 About this Adapter

**Cogni-Living** transforms your smart home from a passive system into an intelligent, thinking assistant. Instead of manually programming hundreds of rules ("If motion, then light"), this adapter uses state-of-the-art Artificial Intelligence (**Google Gemini**) to understand and interpret your sensor data.

Especially suitable for:
* **Ambient Assisted Living (AAL):** Carefree living for seniors through intelligent routine monitoring.
* **Security:** Detection of anomalies that classic alarm systems overlook.
* **Health Monitoring:** Detection of gradual behavioral changes (e.g., reduced mobility).

---

## ⚙️ How it works & History

The adapter works with a dual memory model that has matured over 26 development sprints:

### 1. Short-Term Memory (STM) [Sprints 1-20]
The "Autopilot" monitors the last 50 events in real-time.
* **Example:** It is 3 AM, the front door opens, but no one is in the hallway? -> **Alarm.**
* **Example:** The resident fell in the bathroom and has not moved for 30 minutes? -> **Alarm.**

### 2. Long-Term Memory (LTM) [Sprint 21]
Every night, the AI creates a summary ("Daily Digest") of the day and learns the resident's normal habits.
* **Drift Analysis:** A special algorithm compares the behavior of the last 2 weeks with the long-term average. This detects gradual changes (e.g., "Resident leaves the house much less frequently than before").

### 3. Professional Foundation [Sprints 22-24]
* **SaaS Security:** Code obfuscation and license verification.
* **Auto-Discovery:** A wizard automatically finds your sensors in the system.
* **Feedback Loop:** Users can train the AI ("Thumbs up/down").

---

## 🚀 Features in Detail

### 🛡️ Active Protection (Dead Man's Switch) [NEW Sprint 25/26]
Standard AI systems only react when something happens. **Cogni-Living also reacts when NOTHING happens.**
* **Inactivity Monitor:** If no sensor activity is detected over a defined period (e.g., 12 hours) even though the resident is at home, the adapter triggers an **EMERGENCY**.
* **Smart Presence:** The system automatically distinguishes between "Sleeping" (Present) and "Shopping" (Absent) through intelligent analysis of door sensors.
* **Emergency Escalation:** Unlike normal warnings, emergency events trigger push notifications with highest priority (e.g., Pushover Priority 2 with siren/acknowledgment requirement).

### 📊 LTM Dashboard & Health
Visualize behavior directly in the admin panel.
* **[NEW Sprint 27] Health Dashboard:** Monitoring of sleep quality and nightly restlessness.
* Bar charts show the activity level per day.
* Detailed text summaries explain the daily routine.
* The drift indicator warns of long-term negative trends.

### 🔔 Intelligent Notifications
Receive warnings not just as a log entry, but directly on your smartphone. Supported services:
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
| **Daily Summaries** | ❌ | ✅ |
| **Drift Analysis (Health)** | ❌ | ✅ |
| **Automation Proposals** | ❌ | ✅ |
| **LTM Dashboard** | ❌ | ✅ |

> **Note on Pro Version:** A license key is required for commercial use or full functionality.

---

## 🛠️ Setup in 5 Steps

1.  **Installation:** Install the adapter via ioBroker Admin.
2.  **API Key:** Get a free [Google Gemini API Key](https://aistudio.google.com/app/apikey) and enter it in the settings.
3.  **Auto-Scan:** Click on **"Auto-Scan (Wizard)"** in the configuration tab. Select your sensors and import them.
4.  **Context:** Briefly describe the living situation in the "Context" field (e.g., *"Resident is 82 years old, lives alone, has a dog."*). This massively helps the AI to avoid false alarms.
5.  **Security:** Activate the **Inactivity Monitor** in the settings if you use the system for AAL/senior care.

---

## 📜 Changelog

### 0.3.10 (2025-11-26)
* (Marc Jaeger) **Health Dashboard Update**
* ✨ **New:** Visualization of sleep quality and restlessness in LTM review.
* ✨ **New:** Graphical separation of activity and health data.

### 0.3.5 (2025-11-26)
* (Marc Jaeger) **Maintenance Update**
* 🛠️ **Fix:** Fixed issues with UI translations and save button.
* 🛠️ **Fix:** Stabilized presence logic.

### 0.3.1 (2025-11-26)
* (Marc Jaeger) **Feature Release: Security**
* ✨ **New:** Added **Dead Man's Switch (Inactivity Monitor)**.
* ✨ **New:** **Emergency Status**. Distinction between "Warning" (Yellow) and "Emergency" (Red).
* ✨ **New:** Pushover Priority 2 Support (Emergency Siren & Retry) for critical alarms.

### 0.3.0 (2025-11-25)
* (Marc Jaeger) **Major UI Release**
* ✨ **New:** Complete UI Redesign ("App-like").
* ✨ **New:** Feedback Loop (Reinforcement Learning) implemented.
* 🛠️ **Fix:** Massive improvements to Dark Mode / High Contrast Theme.

---

## 📄 License

MIT License (Codebase).
The use of Pro features is subject to separate license terms.

Copyright (c) 2025 Marc Jaeger <mj112@gmx.de>