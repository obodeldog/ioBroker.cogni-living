![Logo](admin/cogni-living.png)

# ioBroker.cogni-living

[![Test and Release](https://github.com/obodeldog/ioBroker.cogni-living/workflows/Test%20and%20Release/badge.svg)](https://github.com/obodeldog/ioBroker.cogni-living/actions/workflows/test-and-release.yml)
[![NPM](https://nodei.co/npm/iobroker.cogni-living.png?downloads=true)](https://nodei.co/npm/iobroker.cogni-living/)

**[Zur deutschen Anleitung (For German manual click here)](README_de.md)**

---

## 🧠 cogni-living adapter for ioBroker

**Analyzes behavioral patterns for health, safety & comfort**

This adapter is an intelligent assistant that collects selected sensor data (like motion detectors, window contacts, etc.) from your ioBroker and analyzes it at a configurable interval using Google Gemini (AI).

The adapter utilizes both Short-Term Memory (STM) for immediate analysis and Long-Term Memory (LTM) to learn normal behavioral patterns over time.

The goal is to detect two main categories:
1.  **Activity Assistant:** Detects unusual deviations from the norm (e.g., long inactivity in the morning, atypical nightly activity) that could indicate a problem.
2.  **Comfort Assistant:** Identifies recurring patterns (e.g., "Every morning at 7:00 AM, the light in the hallway turns on, then in the kitchen") to enable proactive automation.

---

## ⚠️ Prerequisites

A **valid Google Gemini API Key** is mandatory to use this adapter.

You can create one for free (for testing purposes) at the **[Google AI Studio](https://aistudio.google.com/)**.

---

## ⚙️ Configuration

All configuration is done in the adapter's admin panel:
1.  **Google Gemini API Key:** Paste your personal `AIza...` API key from Google here. Use the "Test Connection" button to verify.
2.  **Analysis Interval (in minutes):** Defines how often the "Autopilot" automatically sends the STM data to the AI for analysis (e.g., every `15` minutes).
3.  **Living Context & Persona:** Define the focus of the AI (e.g., Senior Care, Family, Security) and provide optional details about the living situation (e.g., "Resident is 80 years old") to drastically improve analysis quality.
4.  **Sensor Table:** Add all sensors here that the adapter should monitor.
    *   Use the "Select ID" button (list icon) to easily add sensors from your object list.
    *   The "Name" is automatically fetched.
    *   **Location** and **Type** (e.g., "Kitchen", "Motion") should be provided manually to give the AI essential context.
    *   **Log duplicates:** If checked, *every* update (even with the same value) is logged (in both STM and LTM). Use this for presence detectors. If unchecked (default), only actual value *changes* are logged.

---

## 📊 States created by the adapter

The adapter creates the following states under `cogni-living.0`:

### Events (Short-Term Memory - STM)
*   **`events.lastEvent`**: The last recorded sensor event in JSON format.
*   **`events.history`**: The adapter's "short-term memory" (JSON array of the last 50 events used for the current analysis).
*   **`events.history_debug_XX`**: The last 5 events as human-readable text.

### Analysis
*   **`analysis.trigger`**: A button (boolean) to manually trigger an AI analysis.
*   **`analysis.lastPrompt`**: The exact text (system prompt + event data) that was last sent to the AI.
*   **`analysis.lastResult`**: The full JSON response/analysis received from Gemini.
*   **`analysis.isAlert`**: A boolean (true/false) alarm state, triggered if the AI determines a critical situation.
*   **`analysis.alertReason`**: The reason for the alert (if `isAlert` is true).
*   **`analysis.activitySummary`**: A summary of the current activity.
*   **`analysis.comfortSummary`**: A summary of the current comfort situation.
*   **`analysis.comfortSuggestion`**: A proactive suggestion for automation or comfort improvement.
*   **`analysis.analysisHistory`**: A JSON array logbook of the last 100 AI analysis results.
*   **`analysis.history_debug_XX`**: The 5 most recent analysis results as human-readable text.

### LTM (Long-Term Memory)
*   **`LTM.rawEventLog`**: (New in v0.1.15) The persistent raw event log (last 1500 events). This data is used to create compressed daily digests (future feature).

---

## Changelog

### 0.1.15 (2025-11-18)
* (Marc Jaeger) LTM Implementation (Part 1): Added persistent Raw Event Log (max 1500 events) for long-term memory processing.
* (Marc Jaeger) Added LTM channel and `LTM.rawEventLog` state with robust loading/saving logic.

### 0.1.14 (2025-11-17)
* (Marc Jaeger/Bluefox) Major Migration: Admin interface migrated to Material-UI v5, Vite, and TypeScript (adapter-react-v5 structure).
* (Marc Jaeger) Fixed API connection test logic (using onMessage handler).

### 0.1.12 (2025-11-16)
* (Marc Jaeger) AI Contextual Awareness: Added Persona selection (e.g., Senior/AAL, Family, Security) in settings.
* (Marc Jaeger) Added Living Context description field (max 200 chars) in settings for better AI analysis.
* (Marc Jaeger) Updated AI prompt to incorporate Persona and Context.

### 0.1.11 (2025-11-15)
* (Marc Jaeger) Major Stability Improvement: Switched AI communication entirely to JSON mode.
* (Marc Jaeger) Implemented robust JSON parsing and validation.
* (Marc Jaeger) Created dedicated states for analysis results (activitySummary, comfortSummary, comfortSuggestion, alertReason).

### 0.1.10 (2025-11-15)
* (Marc Jaeger) CRITICAL FIX: Corrected sensor subscription logic (`change: 'any'`) to ensure the selective filter works correctly.

### 0.1.9 (2025-11-15)
* (Marc Jaeger) Added selective filter: Admin checkbox to log duplicate events per sensor (e.g., for presence detectors).
* (Marc Jaeger) Fixed scrollbar issue in the Admin interface.

### 0.1.8 (2025-11-14)
* (Marc Jaeger) Refined AI prompt structure for concise, consistent analysis results.

### 0.1.7 (2025-11-14)
* (hotfix) Refined AI prompt for more concise and balanced analysis results.

### 0.1.6 (2025-11-14)
* (hotfix) Final sync of io-package.json and package.json to fix 'cannot find start file'

### 0.1.5 (2025-11-14)
* (hotfix) Corrected file paths in package.json (cannot find start file)

### 0.1.4 (2025-11-14)
* (hotfix) Added missing 'main' entry in io-package.json (cannot find start file)

### 0.1.3 (2025-11-14)
* (hotfix) Corrected adapter start file path (cannot find start file)

### 0.1.2 (2025-11-14)
* (stable) Stable release with AI logbook and alert system.

### 0.1.1 (2025-11-14)
* (Marc Jaeger) Added Gemini AI integration, autopilot timer, intelligence filter, alert system, and analysis logbook.

### 0.1.0 (2025-11-14)
* (Marc Jaeger) Added base AI integration, UI improvements (Select-ID), and auto-name fetching.

### 0.0.1 (2025-11-13)
* (initial release) Adapter created

---

## License
MIT License

Copyright (c) 2025 Marc Jaeger <mj112@gmx.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.