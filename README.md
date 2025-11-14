![Logo](admin/cogni-living.png)
# ioBroker.cogni-living

[![Test and Release](https://github.com/obodeldog/ioBroker.cogni-living/workflows/Test%20and%20Release/badge.svg)](https://github.com/obodeldog/ioBroker.cogni-living/actions/workflows/test-and-release.yml)
[![NPM](https://nodei.co/npm/iobroker.cogni-living.png?downloads=true)](https://nodei.co/npm/iobroker.cogni-living/)

**[Zur deutschen Anleitung (For German manual click here)](README_de.md)**

---

## 🧠 cogni-living adapter for ioBroker

**Analyzes behavioral patterns for health, safety & comfort**

This adapter is an intelligent assistant that collects selected sensor data (like motion detectors, window contacts, etc.) from your ioBroker and analyzes it at a configurable interval using Google Gemini (AI).

The adapter "learns" by not just looking at isolated sensor data, but by analyzing it within the context of its "short-term memory" (the last 50 events).

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

1.  **Google Gemini API Key:** Paste your personal `AIza...` API key from Google here.
2.  **Analysis Interval (in minutes):** Defines how often the "Autopilot" automatically sends the collected data to the AI for analysis (e.g., every `15` minutes).
3.  **Sensor Table:** Add all sensors here that the adapter should monitor and send to the AI.
    * Use the "Select ID" button (magnifying glass) to easily add sensors from your object list.
    * The "Name" of the sensor (e.g., "Motion detector hallway") is automatically fetched from the object data to give the AI more context.

---

## 📊 States created by the adapter

The adapter creates the following states under `cogni-living.0`:

* **`events.lastEvent`**: The last recorded sensor event in JSON format.
* **`events.history`**: The adapter's "short-term memory" (JSON array of the last 50 events).
* **`events.history_debug_XX`**: The last 5 events as human-readable text (e.g., "18:30:05 - Motion detector hallway (Hallway) -> true").
* **`analysis.trigger`**: A button (boolean) to manually trigger an AI analysis.
* **`analysis.lastPrompt`**: The exact text (system prompt + event data) that was last sent to the AI.
* **`analysis.lastResult`**: The text response/analysis received from Gemini.
* **`analysis.isAlert`**: A boolean (true/false) alarm state, triggered if the AI response contains keywords like "WARNUNG" or "INAKTIVITÄT".
* **`analysis.analysisHistory`**: A JSON array logbook of the last 100 AI analysis results.
* **`analysis.history_debug_XX`**: The 5 most recent analysis results as human-readable text.

---

## Changelog

### 0.1.8 (2025-11-14)
* (stable) Refined AI prompt structure for concise, consistent analysis results.

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
* (Sprint 1-8) Added Gemini AI integration, autopilot timer, intelligence filter, alert system, and analysis logbook.

### 0.1.0 (2025-11-14)
* (Sprint 1-7) Added base AI integration, UI improvements (Select-ID), and auto-name fetching.

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