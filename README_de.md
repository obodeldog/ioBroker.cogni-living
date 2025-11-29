# ioBroker.cogni-living

![Logo](admin/cogni-living.png)

**Künstliche Intelligenz für Ihr Zuhause: Sicherheit, Gesundheit & Komfort in einem System.**

> **"Ein Smart Home ist erst dann smart, wenn es sich um Sie sorgt."**

Cogni-Living ist weit mehr als eine einfache Automation. Es ist ein intelligenter Wächter, der Google Gemini KI nutzt, um die komplexen Verhaltensmuster in Ihrem Haushalt zu verstehen. Es erkennt nicht nur, *dass* sich etwas bewegt – es versteht, *ob* diese Bewegung normal, ungewöhnlich oder sogar gefährlich ist.

## 🎯 Wofür ist dieses System gedacht?

Cogni-Living wurde entwickelt, um drei zentrale Bedürfnisse abzudecken:

1.  **Ambient Assisted Living (AAL) & Senioren-Schutz:**
    Ermöglicht älteren Menschen, länger sicher allein zu wohnen. Das System erkennt Stürze (durch Inaktivität an ungewöhnlichen Orten) oder schleichende Veränderungen im Tagesablauf, ohne dass Kameras oder tragbare Notrufknöpfe nötig sind.

2.  **Sicherheit & Einbruchschutz:**
    Unterscheidet zwischen "Bewohner steht nachts auf" und "Fremder im Haus". Im Urlaubsmodus wird jede Aktivität sofort gemeldet.

3.  **Komfort & Der Butler:**
    Lernt Ihre Gewohnheiten ("Immer wenn ich ins Bad gehe, mache ich das Licht an") und bietet Ihnen an, diese Aufgaben künftig automatisch zu erledigen.

---

## 🛡️ Wie es funktioniert: Das 3-Phasen Neuro-Modell

Das System analysiert Daten auf drei Zeitebenen gleichzeitig, ähnlich wie das menschliche Gehirn:

### Phase 1: Der Sofort-Wächter (Ad-Hoc)
* **Reagiert:** Sofort (Echtzeit).
* **Erkennt:** Akute Notfälle.
* *Beispiel:* Jemand geht ins Bad, aber kommt nach 60 Minuten immer noch nicht heraus. Oder: Es ist 09:00 Uhr morgens und noch keine Bewegung im Haus (obwohl der Bewohner gewöhnlich um 07:00 Uhr aufsteht).
* **Aktion:** Sendet sofort Alarm per Telegram/Pushover ("Verdächtige Stille!").

### Phase 2: Der Gesundheits-Check (Short-Term Baseline)
* **Reagiert:** Betrachtet die letzten 14 Tage.
* **Erkennt:** Akute Erkrankungen oder Stress.
* *Beispiel:* Der Bewohner muss nachts plötzlich 5x auf die Toilette (Normalwert: 1x). Dies deutet auf einen Infekt oder Schlafstörungen hin.
* **Aktion:** Hinweis im "Guten Morgen"-Briefing.

### Phase 3: Die Langzeit-Analyse (Long-Term Drift)
* **Reagiert:** Vergleicht die letzten 60 Tage.
* **Erkennt:** Schleichenden Verfall (Drift).
* *Beispiel:* Die Mobilität nimmt über Monate hinweg um 20% ab. Die Zeit im Bett steigt stetig an. Solche Änderungen fallen im Alltag oft nicht auf, sind aber medizinisch hochrelevant.
* **Aktion:** Bericht im Dashboard (Pro Feature).

---

## 💎 Free vs. Pro Version

Der Adapter ist voll funktionsfähig und kostenlos. Für Nutzer, die tiefgehende Langzeit-Analysen benötigen, gibt es erweiterte Funktionen.

| Funktion | Free Version (Standard) | Pro Version (Lizenz) |
| :--- | :---: | :---: |
| **KI-Analyse (Gemini)** | ✅ Ja | ✅ Ja |
| **Notfall-Erkennung (Phase 1)** | ✅ Ja | ✅ Ja |
| **Auto-Discovery Wizard** | ✅ Ja | ✅ Ja |
| **Family Link (Telegram Alarme)** | ✅ Ja | ✅ Ja |
| **Der Butler (Automation)** | ✅ Ja | ✅ Ja |
| **Langzeit-Gedächtnis (LTM)** | ❌ Nein (Nur Live-Logs) | ✅ Ja (Datenbank) |
| **Drift-Analyse (Phase 3)** | ❌ Nein | ✅ Ja |
| **Python Statistik-Engine** | ❌ Nein | ✅ Ja |
| **Arzt-Export (PDF Report)** | ❌ Nein | ✅ Ja |

---

## 🚀 Installation & Einrichtung (Zero-Config)

### 1. Adapter installieren
Installieren Sie den Adapter wie gewohnt über ioBroker. Das System prüft automatisch, ob Python vorhanden ist und installiert es bei Bedarf nach (Linux).

### 2. KI verbinden
Holen Sie sich einen kostenlosen API-Key im [Google AI Studio](https://aistudio.google.com/) und tragen Sie ihn in den Einstellungen ein.

### 3. Sensoren finden
Starten Sie im Tab "Sensoren" den **Auto-Discovery Wizard**. Der Adapter durchsucht Ihr Haus nach Bewegungsmeldern, Türsensoren und Lichtern und fügt diese automatisch hinzu.

### 4. Hybrid-Engine (Selbstheilung)
Beim ersten Start prüft der Adapter, ob alle KI-Bibliotheken (Numpy, Pandas) vorhanden sind. Falls nicht, lädt er diese **automatisch** im Hintergrund nach. Sie müssen in der Regel keine Linux-Befehle eingeben.

---

## ⚖️ WICHTIGER RECHTLICHER HINWEIS (Disclaimer)

**BITTE SORGFÄLTIG LESEN:**

1.  **Kein Medizinprodukt:** Diese Software ist **KEIN** Medizinprodukt gemäß der Verordnung (EU) 2017/745. Sie dient ausschließlich Informations- und Komfortzwecken im Bereich "Smart Home".
2.  **Keine Notfall-Garantie:** Verlassen Sie sich in gesundheitlichen Notfällen oder bei Lebensgefahr **NIEMALS** allein auf diese Software. Technik kann ausfallen (Stromausfall, Internetabbruch, Softwarefehler).
3.  **Haftungsausschluss:** Der Entwickler übernimmt keinerlei Haftung für Schäden, die aus der Nutzung, Fehlfunktion oder Interpretation der Daten entstehen.
4.  **Datenschutz:** Die Analyse erfolgt über die Google Gemini API. Sensordaten werden zur Auswertung an Google gesendet. Stellen Sie sicher, dass dies mit Ihren Datenschutzanforderungen vereinbar ist.

---

## License
MIT License. Copyright (c) 2025 Dr.-Ing. Marc Jaeger.