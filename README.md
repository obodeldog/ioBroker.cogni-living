![Logo](admin/cogni-living.png)

# ioBroker.cogni-living

**AI-powered behavioral analysis for Health, Safety & Comfort.**

---

## 📖 About this Adapter

**Cogni-Living** transforms your smart home from a passive system into an intelligent, thinking assistant. Instead of manually programming hundreds of rules ("If motion, then light"), this adapter uses state-of-the-art Artificial Intelligence (**Google Gemini**) to understand and interpret your sensor data.

Especially suitable for:
* **Ambient Assisted Living (AAL):** Worry-free living for seniors through intelligent routine monitoring.
* **Security:** Detection of anomalies that traditional alarm systems miss.
* **Health Monitoring:** Detection of gradual behavioral changes (e.g., reduced mobility).

---

## ⚙️ How it Works

The adapter operates using a dual-memory model, similar to the human brain:

### 1. Short-Term Memory (STM)
The "Autopilot" monitors the last 50 events in real-time.
* **Example:** It's 3 AM, the front door opens, but no one is in the hallway? -> **Alert.**
* **Example:** The resident fell in the bathroom and hasn't moved for 30 minutes? -> **Alert.**

### 2. Long-Term Memory (LTM) [Pro Feature]
Every night, the AI creates a summary ("Daily Digest") of the day and learns the resident's normal habits.
* **Baseline Learning:** After approx. 7-14 days, the system knows when you typically get up, how often you cook, or when you leave the house.
* **Drift Analysis:** A special algorithm compares behavior from the last 2 weeks with the long-term average. This detects gradual changes (e.g., "Resident leaves the house much less often than before").

---

## 🚀 Features in Detail

### 🪄 Auto-Discovery Wizard
No more complicated configuration! The integrated wizard scans your entire ioBroker installation and automatically finds relevant sensors (lights, motion, windows, doors, thermostats). You simply select what you want to monitor.

### 📊 LTM Dashboard
Visualize behavior directly in the admin panel.
* Bar charts show activity levels per day.
* Detailed text summaries explain the daily routine.
* The Drift Indicator warns of long-term negative trends.

### 🔔 Intelligent Notifications
Receive warnings not just as log entries, but directly on your smartphone. Supported services:
* Telegram
* Pushover
* Email
* WhatsApp (via CMB Adapter)
* Signal (via CMA Adapter)

---

## 💎 Free vs. Pro Version

| Feature | Free Version | Pro Version |
| :--- | :---: | :---: |
| **STM Real-time Analysis** | ✅ | ✅ |
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
5.  **Start:** Start the instance. The system begins analysis immediately (STM). Long-Term Memory requires approx. 7 days of learning phase.

---

## 📜 Changelog

### 0.2.0 (2025-11-24)
* (Marc Jaeger) **Major Release**
* ✨ **New:** Implemented Auto-Discovery Wizard.
* ✨ **New:** Added LTM Dashboard UI.
* ✨ **New:** Implemented Licensing & Hardware Binding.
* 🛠️ **Fix:** Improved "Junk-Filter" to ignore technical data points (scripts, weather data) more reliably.
* 🛠️ **Fix:** Increased context description limit to 1000 chars.

### 0.1.22 (2025-11-23)
* (Marc Jaeger) Introduction of UI Tabs (Config / Dashboard).
* (Marc Jaeger) Prepared code obfuscation for production builds.

### 0.1.21 (2025-11-21)
* (Marc Jaeger) Introduction of "Drift Analysis" (Comparing Short-Term vs. Long-Term Baseline).

### 0.1.0 - 0.1.20
* (Marc Jaeger) Initial development of Cogni-Engine (STM & LTM logic).
* (Marc Jaeger) Integration of Google Gemini API.

---

## 📄 License

MIT License (Codebase).
Use of Pro features is subject to separate license terms.

Copyright (c) 2025 Marc Jaeger <mj112@gmx.de>