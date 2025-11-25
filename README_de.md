![Logo](admin/cogni-living.png)

# ioBroker.cogni-living

**KI-gestützte Verhaltensanalyse für Gesundheit, Sicherheit & Komfort.**

---

## 🆕 Neu in Version 0.3.0
* **App-Design:** Komplett überarbeitete Benutzeroberfläche für bessere Übersicht (Dark Mode optimiert).
* **Feedback-Loop:** Bringen Sie der KI bei, was richtig oder falsch war ("Daumen hoch/runter").
* **Standort-Kontext:** Die KI berücksichtigt nun Tageszeit und Wetter am Wohnort.

## 📖 Über diesen Adapter
**Cogni-Living** ist Ihr intelligenter Mitbewohner. Er lernt Ihre Routinen und erkennt, wenn etwas nicht stimmt – ohne dass Sie Regeln programmieren müssen.

---

## ⚙️ Funktionsweise

### 1. Kurzzeit-Analyse (Status "Alles Ruhig")
Überwacht die letzten 30 Minuten. Erkennt offene Türen bei Abwesenheit, Stürze (Inaktivität) oder ungewöhnliche nächtliche Aktivität.

### 2. Langzeit-Routine (Drift Analyse) [Pro]
Lernt über Wochen hinweg Ihren Alltag.
* **Baseline:** "Normal" ist, morgens um 7 aufzustehen.
* **Drift:** Wenn der Bewohner plötzlich erst um 11 aufsteht oder das Haus nicht mehr verlässt, erkennt das System eine "Routine-Abweichung" (Gesundheitswarnung).

---

## 🚀 Features

* **Ampel-Dashboard:** Sehen Sie sofort, ob alles grün ist.
* **Auto-Discovery:** Findet Ihre Sensoren automatisch.
* **Intelligente Push-Nachrichten:** Nur bei echten Anomalien.

---

## 📄 Lizenz
MIT License.
Copyright (c) 2025 Marc Jaeger