![Logo](admin/cogni-living.png)

# ioBroker.cogni-living

[![Test and Release](https://github.com/obodeldog/ioBroker.cogni-living/workflows/Test%20and%20Release/badge.svg)](https://github.com/obodeldog/ioBroker.cogni-living/actions/workflows/test-and-release.yml)
[![NPM](https://nodei.co/npm/iobroker.cogni-living.png?downloads=true)](https://nodei.co/npm/iobroker.cogni-living/)

**[Click here for the English manual (Zur englischen Anleitung)](README.md)**

---

## 🧠 cogni-living Adapter für ioBroker

**Analysiert Verhaltensmuster für Gesundheit, Sicherheit & Komfort**

Dieser Adapter ist ein intelligenter Assistent, der ausgewählte Sensor-Daten (wie Bewegungsmelder, Fensterkontakte etc.) aus Ihrem ioBroker sammelt und in einem konfigurierbaren Intervall mittels Google Gemini (KI) analysiert.

Der Adapter "lernt", indem er die Sensordaten nicht nur isoliert betrachtet, sondern im Kontext seines "Kurzzeitgedächtnisses" (der letzten 50 Events) analysiert.

Das Ziel ist die Erkennung von zwei Hauptkategorien:
1.  **Aktivitäts-Assistent:** Erkennt ungewöhnliche Abweichungen von der Norm (z.B. lange Inaktivität am Morgen, untypische nächtliche Aktivität), die auf ein Problem hindeuten könnten.
2.  **Komfort-Assistent:** Identifiziert wiederkehrende Muster (z.B. "Jeden Morgen um 07:00 Uhr geht das Licht im Flur an, dann in der Küche"), um proaktive Automatisierungen zu ermöglichen.

---

## ⚠️ Voraussetzungen

Für die Nutzung dieses Adapters ist ein **gültiger Google Gemini API Key** zwingend erforderlich.

Sie können diesen im **[Google AI Studio](https://aistudio.google.com/)** kostenlos für Testzwecke erstellen.

---

## ⚙️ Konfiguration

Die gesamte Konfiguration findet im Admin-Bereich des Adapters statt:
1.  **Google Gemini API-Schlüssel:** Fügen Sie hier Ihren persönlichen `AIza...` API-Schlüssel von Google ein.
2.  **Analyse-Intervall (in Minuten):** Legt fest, wie oft der "Autopilot" die gesammelten Daten automatisch zur Analyse an die KI sendet (z.B. alle `15` Minuten).
3.  **Sensor-Tabelle:** Fügen Sie hier alle Sensoren hinzu, die der Adapter überwachen und an die KI senden soll.
    *   Nutzen Sie den "Auswählen"-Knopf (Lupe), um Sensoren einfach aus Ihrer Objektliste hinzuzufügen.
    *   Der "Name" des Sensors (z.B. "Bewegungsmelder Flur") wird automatisch aus den Objektdaten übernommen, um der KI mehr Kontext zu geben.
    *   **Gleiche Werte loggen:** Wenn aktiviert, wird *jedes* Update (auch mit gleichem Wert) geloggt. Nutzen Sie dies für Präsenzmelder. Wenn deaktiviert (Standard), werden nur tatsächliche Wert-*Änderungen* geloggt (basierend auf dem Adapter-Gedächtnis).

---

## 📊 Vom Adapter erstellte Datenpunkte

Der Adapter erstellt folgende Datenpunkte unter `cogni-living.0`:
*   **`events.lastEvent`**: Das zuletzt erfasste Sensor-Ereignis im JSON-Format.
*   **`events.history`**: Das "Kurzzeitgedächtnis" des Adapters (JSON-Array der letzten 50 Events).
*   **`events.history_debug_XX`**: Die 5 letzten Events als einfach lesbarer Text (z.B. "18:30:05 - Bewegungsmelder Flur (Flur) -> true").
*   **`analysis.trigger`**: Ein Knopf (boolean), um eine KI-Analyse manuell anzustoßen.
*   **`analysis.lastPrompt`**: Der genaue Text (System-Prompt + Event-Daten), der zuletzt an die KI gesendet wurde.
*   **`analysis.lastResult`**: Die textliche Antwort/Analyse, die von Gemini zurückkam.
*   **`analysis.isAlert`**: Ein Boolean (true/false) Alarm-Status, der ausgelöst wird, wenn die KI-Antwort Schlüsselwörter wie "WARNUNG" oder "INAKTIVITÄT" enthält.
*   **`analysis.analysisHistory`**: Ein JSON-Array Logbuch der letzten 100 KI-Analyseergebnisse.
*   **`analysis.history_debug_XX`**: Die 5 letzten Analyseergebnisse als einfach lesbarer Text.

---

## Changelog

### 0.1.10 (2025-11-15)
* (Marc Jaeger) KRITISCHER FIX: Sensor-Abonnement-Logik (`change: 'any'`) korrigiert, damit der selektive Filter korrekt funktioniert.
* (Marc Jaeger) Cleanup: Temporäre Debug-Logs entfernt und Versions-Logging standardisiert.

### 0.1.9 (2025-11-15)
* (Marc Jaeger) Selektiver Filter hinzugefügt: Admin-Checkbox, um doppelte Events pro Sensor zu loggen (z.B. für Präsenzmelder).
* (Marc Jaeger) Scrollbar-Problem in der Admin-Oberfläche behoben.

### 0.1.8 (2025-11-14)
* (Marc Jaeger) KI-Prompt-Struktur verfeinert für präzisere und konsistentere Analyse-Ergebnisse.

### 0.1.7 (2025-11-14)
* (hotfix) KI-Prompt verfeinert für präzisere und ausgewogenere Analyse-Ergebnisse.

### 0.1.6 (2025-11-14)
* (hotfix) Finaler Sync von io-package.json und package.json, um 'cannot find start file' zu beheben

### 0.1.5 (2025-11-14)
* (hotfix) Korrektur der Dateipfade in package.json (cannot find start file)

### 0.1.4 (2025-11-14)
* (hotfix) Fehlenden 'main'-Eintrag in io-package.json hinzugefügt (cannot find start file)

### 0.1.3 (2025-11-14)
* (hotfix) Korrektur des Adapter-Startpfads (cannot find start file)

### 0.1.2 (2025-11-14)
* (stabil) Stabile Version mit KI-Logbuch und Alarmsystem.

### 0.1.1 (2025-11-14)
* (Marc Jaeger) Gemini KI-Integration, Autopilot-Timer, Intelligenz-Filter, Alarmsystem und Analyse-Logbuch hinzugefügt.

### 0.1.0 (2025-11-14)
* (Marc Jaeger) Basis KI-Integration, UI-Verbesserungen (Select-ID) und autom. Namensabruf hinzugefügt.

### 0.0.1 (2025-11-13)
* (initial release) Erstveröffentlichung

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