![Logo](admin/cogni-living.png)

# ioBroker.cogni-living

**KI-gestützte Verhaltensanalyse für Gesundheit, Sicherheit & Komfort.**

---

## 📖 Über diesen Adapter

**Cogni-Living** verwandelt Ihr Smart Home von einem passiven System in einen intelligenten, mitdenkenden Assistenten. Anstatt mühsam hunderte von Regeln zu programmieren ("Wenn Bewegung, dann Licht"), nutzt dieser Adapter modernste künstliche Intelligenz (**Google Gemini**), um die Daten Ihrer Sensoren zu verstehen und zu interpretieren.

Besonders geeignet für:
* **Ambient Assisted Living (AAL):** Sorgenfreies Wohnen im Alter durch intelligente Überwachung von Routinen.
* **Sicherheit:** Erkennung von Anomalien, die klassischen Alarmanlagen entgehen.
* **Gesundheits-Monitoring:** Erkennung schleichender Verhaltensänderungen (z.B. verringerte Mobilität).

---

## ⚙️ Funktionsweise

Der Adapter arbeitet mit einem Zwei-Stufen-Gedächtnis-Modell, ähnlich dem menschlichen Gehirn:

### 1. Das Kurzzeitgedächtnis (STM - Short-Term Memory)
Der "Autopilot" überwacht die letzten 50 Ereignisse in Echtzeit.
* **Beispiel:** Es ist 3 Uhr nachts, die Haustür geht auf, aber niemand ist im Flur? -> **Alarm.**
* **Beispiel:** Der Bewohner ist im Bad gestürzt und bewegt sich seit 30 Minuten nicht? -> **Alarm.**

### 2. Das Langzeitgedächtnis (LTM - Long-Term Memory) [Pro Feature]
Jede Nacht erstellt die KI eine Zusammenfassung ("Daily Digest") des Tages und lernt daraus die normalen Gewohnheiten der Bewohner.
* **Baseline-Learning:** Nach ca. 7-14 Tagen weiß das System, wann Sie normalerweise aufstehen, wie oft Sie kochen oder wann Sie das Haus verlassen.
* **Drift-Analyse:** Ein spezieller Algorithmus vergleicht das Verhalten der letzten 2 Wochen mit dem Langzeit-Durchschnitt. So werden schleichende Veränderungen erkannt (z.B. "Bewohner verlässt das Haus viel seltener als früher" oder "Schlafphasen verschieben sich").

---

## 🚀 Features im Detail

### 🪄 Auto-Discovery Wizard
Keine komplizierte Konfiguration mehr! Der integrierte Wizard scannt Ihre gesamte ioBroker-Installation und findet automatisch relevante Sensoren (Licht, Bewegung, Fenster, Türen, Thermostate). Sie müssen nur noch auswählen, was überwacht werden soll.

### 📊 LTM Dashboard
Visualisieren Sie das Verhalten direkt im Admin-Bereich.
* Balkendiagramme zeigen das Aktivitätsniveau pro Tag.
* Detaillierte Text-Zusammenfassungen erklären den Tagesablauf.
* Die Drift-Anzeige warnt vor langfristigen negativen Trends.

### 🔔 Intelligente Benachrichtigungen
Erhalten Sie Warnungen nicht nur als Log-Eintrag, sondern direkt auf Ihr Smartphone. Unterstützt werden:
* Telegram
* Pushover
* E-Mail
* WhatsApp (via CMB Adapter)
* Signal (via CMA Adapter)

---

## 💎 Free vs. Pro Version

| Feature | Free Version | Pro Version |
| :--- | :---: | :---: |
| **STM Echtzeit-Analyse** | ✅ | ✅ |
| **KI-Kontext (Wetter/Person)** | ✅ | ✅ |
| **Auto-Discovery Wizard** | ✅ | ✅ |
| **Benachrichtigungen** | ✅ | ✅ |
| **Langzeitgedächtnis (LTM)** | ❌ | ✅ |
| **Daily Digests (Tagesberichte)** | ❌ | ✅ |
| **Drift-Analyse (Gesundheit)** | ❌ | ✅ |
| **Automatisierungsvorschläge** | ❌ | ✅ |
| **LTM Dashboard** | ❌ | ✅ |

> **Hinweis zur Pro-Version:** Für die gewerbliche Nutzung oder den vollen Funktionsumfang benötigen Sie einen Lizenzschlüssel.

---

## 🛠️ Einrichtung in 5 Schritten

1.  **Installation:** Installieren Sie den Adapter über den ioBroker Admin.
2.  **API-Key:** Besorgen Sie sich einen kostenlosen [Google Gemini API Key](https://aistudio.google.com/app/apikey) und tragen Sie ihn in den Einstellungen ein.
3.  **Auto-Scan:** Klicken Sie im Tab "Konfiguration" auf **"Auto-Scan (Wizard)"**. Wählen Sie Ihre Sensoren aus und importieren Sie diese.
4.  **Kontext:** Beschreiben Sie im Feld "Wohnkontext" kurz die Situation (z.B. *"Bewohnerin ist 82 Jahre alt, lebt allein, hat einen Hund."*). Dies hilft der KI enorm, Fehlalarme zu vermeiden.
5.  **Starten:** Starten Sie die Instanz. Das System beginnt sofort mit der Analyse (STM). Das Langzeitgedächtnis benötigt ca. 7 Tage Lernphase.

---

## 📜 Changelog (Versionshistorie)

### 0.2.0 (2025-11-24)
* (Marc Jaeger) **Major Release**
* ✨ **New:** Auto-Discovery Wizard implementiert (automatisches Finden von Sensoren).
* ✨ **New:** LTM Dashboard zur Visualisierung von Langzeitdaten.
* ✨ **New:** Lizenzierungssystem und Hardware-Binding eingeführt.
* 🛠️ **Fix:** Verbesserter "Junk-Filter" ignoriert nun technische Datenpunkte (Skripte, Wetterdaten) zuverlässiger.
* 🛠️ **Fix:** Kontext-Beschreibung auf 1000 Zeichen erweitert.

### 0.1.22 (2025-11-23)
* (Marc Jaeger) Einführung der UI-Tabs (Konfiguration / Dashboard).
* (Marc Jaeger) Code-Obfuskation für Produktions-Builds vorbereitet.

### 0.1.21 (2025-11-21)
* (Marc Jaeger) Einführung der "Drift Analyse" (Vergleich Kurzzeit- vs. Langzeit-Baseline).

### 0.1.0 - 0.1.20
* (Marc Jaeger) Initiale Entwicklung der Cogni-Engine (STM & LTM Logik).
* (Marc Jaeger) Integration der Google Gemini API.

---

## 📄 Lizenz

MIT License (Code-Basis).
Die Nutzung der Pro-Features unterliegt gesonderten Lizenzbedingungen.

Copyright (c) 2025 Marc Jaeger <mj112@gmx.de>