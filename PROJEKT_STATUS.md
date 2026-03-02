# PROJEKT_STATUS — cogni-living (NUUKANNI / AURA)

> **Übergabeprotokoll für die nächste Sitzung**
> Letzte Aktualisierung: 02.03.2026 | Aktuelle Version: **v0.30.76**

---

## ✅ Aktueller Stand — Was haben wir in dieser Sitzung abgeschlossen?

| # | Ergebnis | Version |
|---|----------|---------|
| 1 | **PWA Touch-Tooltip**: CSS `:hover::after`-Tooltip durch JS-basiertes Panel ersetzt — Tap auf Sparkline-Balken öffnet Info-Panel unter der Leiste; zweiter Tap / Tipp außerhalb schließt es; funktioniert auf iPhone/Android zuverlässig | v0.30.76 |
| 2 | **Build-Fehler behoben**: `const → let dailyData` in `LongtermTrendsView.tsx` (Fehler: "Assignment to constant variable") | v0.30.75 |
| 3 | **Gemini-Prompt repariert**: KI-Tages- und Nachtberichte nutzen jetzt das `aiContext`-Nutzerprofil aus den Systemeinstellungen → Gemini kennt "Marc", schreibt Fließtext statt JSON-Objekte | v0.30.75 |
| 4 | **JSON-Key-Erkennung erweitert**: Alle Parser in PWA und Admin UI erkennen jetzt die Schlüssel `antwort`, `status_bericht`, `summary`, `analyse`, `text`, `message` → kein roher JSON-Block mehr sichtbar | v0.30.75 |
| 5 | **Sparkline-Tooltip verbessert**: Zeigt jetzt Datum ("Fr 28.2."), Icons (☀️ Aktivität, 🌙 Nacht, 🔍 Status), 45 Zeichen Nachttext, breiteres Design | v0.30.75 |
| 6 | **Aktivitäts-Normalisierung (Zeile 14)**: Sparkline und "Aktivitäts-Belastung" nutzen jetzt einen persönlichen Median (2-Pass) → 100% = durchschnittlicher Tag, max. 200% | v0.30.74 |
| 7 | **Drift-Monitor (Zeile 16)**: Page-Hinkley-Test in Python implementiert, Admin UI zeigt Debug-Kachel "🔬 DRIFT-MONITOR" mit Liniendiagramm und Status-Badge | v0.30.74 |
| 8 | **README_de.md aktualisiert**: AURA MASTER-ROADMAP mit neuer Spalte "UI-Darstellung", alle "GEPLANT"-Zeilen und Vergleichstabellen entfernt | v0.30.74 |

---

## 🟢 Funktionierende Basis — Was läuft bereits fehlerfrei?

### Backend (Node.js + Python)
- **Bewegungserkennung & Sensor-Fusion** — alle PIR-Sensoren werden ausgewertet
- **Schlafanalyse** — Nacht-Events (22:00–08:00), Bad-Frequenz, Heuristik
- **IsolationForest-Anomalie-Erkennung** — Tag UND Nacht, personalisiertes Modell
- **KI-Berichte via Gemini Pro** — Tages- und Nachtbericht mit Nutzerprofil, Fließtext
- **Inaktivitäts-Alarm** — konfigurierbarer Schwellwert, Pushover-Benachrichtigung
- **Langzeit-Trendanalyse** — lineare Regression über 7/30/180 Tage
- **Page-Hinkley Drift-Erkennung** — in Beobachtungsphase aktiv
- **Cloudflare Tunnel** — stabile Verbindung mit Auto-Restart, Healthcheck

### Admin UI (React/TypeScript)
- **Health Dashboard** — Tages-/Nacht-Status, Bad-Nutzung, Frischluft, Raum-Charts
- **7-Tage-Übersicht** — mit KI-Zusammenfassung pro Tag (robuster JSON-Parser)
- **Langzeit-Trends** — Aktivitäts-Belastung (0–200%, Normalwert-Linie), Ganggeschwindigkeit, Schlaf
- **Drift-Monitor Kachel** — PH-Score, Schwellenwert, Liniendiagramm
- **Raum-Charts** — neuester Tag immer rechts auf der X-Achse

### PWA (Mobile Family App)
- **"Auf einen Blick"-Ansicht** — Bad, Frischluft, Letzte Aktivität (Raum + Uhrzeit)
- **Tages-Status** — Anomalie-Score aus IsolationForest (Unauffällig / Auffällig)
- **Letzte Nacht** — Kurztext aus Gemini, farbkodiert (grün/orange/rot)
- **Sparkline 7 Tage** — Balkenhöhe = personalisiertes Aktivitätslevel, JS-Touch-Tooltip (Tap öffnet Panel mit Datum + Icons)
- **KI Analyse on Demand** — Polling bis Analyse abgeschlossen, Fortschrittsanzeige
- **Lokale URL + Token** — funktioniert intern ohne ioBroker-Login

---

## 🔴 Offene Baustellen — Bekannte Probleme & bewusste Verschiebungen

| Priorität | Problem | Notiz |
|-----------|---------|-------|
| 🔴 Hoch | **Tages-Status Score = 0.00** im PWA — Score steigt erst nach mehreren Trainingstagen auf reale Werte | Warten auf mehr Trainingsdaten; heute sollte sich das ändern |
| 🔴 Hoch | **Cloudflare-Link** erscheint nicht immer sofort in der Admin UI nach dem Speichern | Tab-Wechsel + "Aktualisieren"-Button als Workaround; Ursache: Tunnel-Startup dauert ~30s |
| 🟡 Mittel | **"Familien-App"-Checkbox** wird nach Tab-Wechsel manchmal als deaktiviert angezeigt | Ist ein reines Anzeigeproblem, Funktion läuft weiter |
| 🟡 Mittel | **Drift-Monitor** zeigt noch keine aussagekräftigen Daten | Bewusst in "Beobachtungsphase" — braucht ~4–6 Wochen Trainingsdaten |
| ✅ Erledigt | **Sparkline-Tooltip** auf Mobilgeräten | JS-basierter Touch-Tooltip implementiert (v0.30.76) — Tap öffnet Panel unter der Sparkline, funktioniert auf iPhone/Android |
| 🟢 Niedrig | **Aktivitäts-Normalisierung** braucht mindestens 7 Tage Daten für stabilen Median | Derzeit Fallback auf `rawTotal` wenn zu wenig Daten |
| 🟢 Niedrig | **Fourier-Analyse** für zirkadianen Rhythmus-Fit noch nicht implementiert | In Roadmap als geplant vermerkt, kein Zeitdruck |

---

## 🎯 Nächster logischer Schritt — Exakte Aufgabe für die nächste Sitzung

### ~~Option A — Empfohlen: PWA Touch-Tooltip~~ ✅ ERLEDIGT (v0.30.76)
~~CSS `:hover`-Tooltips auf JS-Basis umgestellt — Tap öffnet Info-Panel unter dem Balken.~~

### Option B — Kurzfristig sichtbar: Tages-Score validieren
**Problem**: Nach mehreren Trainingstagen sollte der IsolationForest-Score auf einen realen Wert steigen.
**Aufgabe**: Score in der PWA beobachten, ggf. Trainings-Trigger für mehr historische Daten aktivieren.
**Aufwand**: ~30 Minuten (Beobachtung + ggf. kleiner Fix)

### Option C — Langfristig wertvoll: Fourier-Analyse (Zirkadianer Rhythmus)
**Ziel**: Erkennen, ob sich der Tagesrhythmus der Person verschiebt (früher aufstehen, später schlafen).
**Algorithmus**: FFT auf Stundenvektor der Bewegungsevents → dominante Frequenz als Gesundheitsindikator.
**Aufwand**: ~3–4 Stunden | Python + Admin UI Kachel

---

## 📁 Wichtige Dateien

| Datei | Zweck |
|-------|-------|
| `src/lib/pwa_server.js` | PWA-Backend: Datenaggregation, HTTP-Server, Sparkline, Tooltips |
| `src/lib/ai_agent.js` | Gemini-Prompts für Tages-/Nachtbericht |
| `src/main.js` | Adapter-Einstiegspunkt, Analyse-Trigger, PWA-Integration |
| `python_service/brains/health.py` | IsolationForest, Page-Hinkley, Anomalie-Erkennung |
| `python_service/service.py` | Python-Bridge für alle ML-Befehle |
| `src-admin/src/components/tabs/HealthTab.tsx` | Admin Health Dashboard |
| `src-admin/src/components/tabs/LongtermTrendsView.tsx` | Admin Langzeit-Trends + Drift-Monitor |
| `README_de.md` | AURA MASTER-ROADMAP + Algorithmen-Tabelle |

---

## 🔬 Algorithmen-Status (Health-Säule)

| Zeile | Algorithmus | Status |
|-------|-------------|--------|
| 1–8 | Sensor-Fusion, Schlaf, Aktivität, Bad, Frischluft | ✅ Produktiv |
| 9–10 | KI-Berichte (Gemini, Fließtext, Nutzerprofil) | ✅ Produktiv |
| 11 | Inaktivitäts-Alarm | ✅ Produktiv |
| 12–13 | Lineare Regression + LLM-Drift | ✅ Produktiv |
| 14 | Aktivitäts-Normalisierung (persönlicher Median) | ✅ Produktiv |
| 15 | Fourier-Analyse (Zirkadianer Rhythmus) | 🔲 Geplant |
| 16 | Page-Hinkley Drift-Erkennung | 🔬 Beobachtungsphase |
