![Logo](admin/cogni-living.png)
# ioBroker.cogni-living

[![Test and Release](https://github.com/obodeldog/ioBroker.cogni-living/workflows/Test%20and%20Release/badge.svg)](https://github.com/obodeldog/ioBroker.cogni-living/actions/workflows/test-and-release.yml)
[![NPM](https://nodei.co/npm/iobroker.cogni-living.png?downloads=true)](https://nodei.co/npm/iobroker.cogni-living/)

**[Click here for the English manual (Zur englischen Anleitung)](README.md)**

---

## 🧠 cogni-living Adapter für ioBroker

**Analysiert Verhaltensmuster für Gesundheit, Sicherheit & Komfort**

(Rest der Datei bleibt gleich... nur Konfig und Changelog ändern sich)

---

## ⚙️ Konfiguration

Die gesamte Konfiguration findet im Admin-Bereich des Adapters statt:

1.  **Google Gemini API-Schlüssel:** Fügen Sie hier Ihren persönlichen `AIza...` API-Schlüssel von Google ein.
2.  **Analyse-Intervall (in Minuten):** Legt fest, wie oft der "Autopilot" die gesammelten Daten automatisch zur Analyse an die KI sendet (z.B. alle `15` Minuten).
3.  **Sensor-Tabelle:** Fügen Sie hier alle Sensoren hinzu, die der Adapter überwachen und an die KI senden soll.
    * Nutzen Sie den "Auswählen"-Knopf (Lupe), um Sensoren einfach aus Ihrer Objektliste hinzuzufügen.
    * Der "Name" des Sensors (z.B. "Bewegungsmelder Flur") wird automatisch aus den Objektdaten übernommen, um der KI mehr Kontext zu geben.
    * **Gleiche Werte loggen:** Wenn aktiviert, wird *jedes* Update (auch mit gleichem Wert) geloggt. Nutzen Sie dies für Präsenzmelder. Wenn deaktiviert (Standard), werden nur tatsächliche Wert-*Änderungen* geloggt.

---

## 📊 Vom Adapter erstellte Datenpunkte

(Bleibt gleich...)

---

## Changelog

### 0.1.9 (2025-11-15)
* (Sprint 9) Selektiver Filter hinzugefügt: Admin-Checkbox, um doppelte Events pro Sensor zu loggen (z.B. für Präsenzmelder).
* (Sprint 9) Scrollbar-Problem in der Admin-Oberfläche behoben.

### 0.1.8 (2025-11-14)
* (stabil) KI-Prompt-Struktur verfeinert für präzisere und konsistentere Analyse-Ergebnisse.

### 0.1.7 (2025-11-14)
* (hotfix) KI-Prompt verfeinert für präzisere und ausgewogenere Analyse-Ergebnisse.
... (rest of changelog) ...
### 0.0.1 (2025-11-13)
* (initial release) Erstveröffentlichung

---

## License
MIT License

Copyright (c) 2025 Marc Jaeger <mj112@gmx.de>

(License text omitted for brevity)