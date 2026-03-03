# PROJEKT_STATUS — cogni-living (NUUKANNI / AURA)

> **Übergabeprotokoll für die nächste Sitzung**
> Letzte Aktualisierung: 02.03.2026 | Aktuelle Version: **v0.30.78**

---

## ✅ Aktueller Stand — Was haben wir in dieser Sitzung abgeschlossen?

| # | Ergebnis | Version |
|---|----------|---------|
| 1 | **PWA Touch-Tooltip**: CSS `:hover`-Tooltip durch JS-Panel ersetzt — Tap öffnet Info unter dem Balken, funktioniert auf iPhone/Android | v0.30.76 |
| 2 | **PWA Syntax-Fehler behoben**: `\n` in Template-Literal erzeugte ungültiges JS im Browser (Split-Aufruf kaputt) → doppelter Backslash korrigiert | v0.30.76 |
| 3 | **Admin-Build-Fix**: `admin/assets/` hatte noch den alten Stand von v0.30.74 (const-Fehler in Langzeit-Trends) — korrekter Build deployed | v0.30.76 |
| 4 | **Adaptiver Drift-Schwellwert (Option A)**: Schwellwert nicht mehr hartkodiert auf 50, sondern automatisch berechnet: erste 14 Tage = Kalibrierung (Score=0), danach `max(30, 3 × σ × √n)`. Passt sich pro Person/Kunde automatisch an | v0.30.77 |
| 5 | **KI-Kontext-Bug behoben**: Gesundheitsberichte (Nacht/Tag) verwendeten falsches Feld (`aiContext` ohne UI-Anbindung, Fallback immer "Marc"). Jetzt korrekt: `livingContext` = das Feld aus *System → Reporting & Kontext* | v0.30.78 |
| 6 | **Drift-Monitor zeitfenster-unabhängig**: Neuer separater `ANALYZE_DRIFT`-Backend-Befehl lädt beim Tab-Öffnen einmalig **alle** verfügbaren Daten (max. 180 Tage). Ergebnis ändert sich nicht mehr beim Umschalten zwischen WOCHE / 4 WOCHEN / 6 MONATE | v0.30.78 |
| 7 | **Drift-Diagramm Y-Achse**: Schwellwert-Linie (rot gestrichelt) war außerhalb des sichtbaren Bereichs wenn Score < Schwelle. Y-Achse skaliert jetzt automatisch auf `max(Score, Schwelle) × 1.2` + Label "Schwelle" direkt an der Linie | v0.30.78 |
| 8 | **Versionsnummern synchronisiert**: `package.json` und `io-package.json` liefen auseinander — beide jetzt einheitlich auf 0.30.78 | v0.30.78 |

---

## 🟢 Funktionierende Basis — Was läuft bereits fehlerfrei?

### Backend (Node.js + Python)
- **Bewegungserkennung & Sensor-Fusion** — alle PIR-Sensoren werden ausgewertet
- **Schlafanalyse** — Nacht-Events (22:00–08:00), Bad-Frequenz, Heuristik
- **IsolationForest-Anomalie-Erkennung** — Tag UND Nacht, personalisiertes Modell
- **KI-Berichte via Gemini Pro** — Tages- und Nachtbericht, nutzt konfigurierten Kontext aus dem System-Tab, Fließtext
- **Inaktivitäts-Alarm** — konfigurierbarer Schwellwert, Pushover-Benachrichtigung
- **Langzeit-Trendanalyse** — lineare Regression über 7/30/180 Tage
- **Page-Hinkley Drift-Erkennung** — adaptiver Schwellwert, Kalibrierungsphase 14 Tage, dann aktive Erkennung
- **Cloudflare Tunnel** — stabile Verbindung mit Auto-Restart, Healthcheck

### Admin UI (React/TypeScript)
- **Health Dashboard** — Tages-/Nacht-Status, Bad-Nutzung, Frischluft, Raum-Charts
- **7-Tage-Übersicht** — mit KI-Zusammenfassung pro Tag (robuster JSON-Parser)
- **Langzeit-Trends** — Aktivitäts-Belastung (0–200%, Normalwert-Linie), Ganggeschwindigkeit, Schlaf, Raum-Mobilität, Bad, Frischluft
- **Drift-Monitor** — adaptiver Schwellwert (σ-basiert), zeitfenster-unabhängig, Schwellwert-Linie immer sichtbar
- **Raum-Charts** — neuester Tag immer rechts auf der X-Achse

### PWA (Mobile Family App)
- **"Auf einen Blick"-Ansicht** — Bad, Frischluft, Letzte Aktivität (Raum + Uhrzeit)
- **Tages-Status** — Anomalie-Score aus IsolationForest (Unauffällig / Auffällig)
- **Letzte Nacht** — Kurztext aus Gemini, farbkodiert (grün/orange/rot)
- **Sparkline 7 Tage** — Balkenhöhe = personalisiertes Aktivitätslevel, JS-Touch-Tooltip (Tap öffnet Panel, funktioniert auf Mobilgeräten)
- **KI Analyse on Demand** — Polling bis Analyse abgeschlossen, Fortschrittsanzeige
- **Lokale URL + Token** — funktioniert intern ohne ioBroker-Login

### Multi-Kunden-Fähigkeit
- **KI-Kontext pro Instanz** — jeder Kunde hat eigenen Kontext, kein hartkodierter Name mehr
- **Adaptiver Drift** — Schwellwert kalibriert sich automatisch pro Person, kein manuelles Eingreifen nötig

---

## 🔴 Offene Baustellen — Bekannte Probleme & bewusste Verschiebungen

| Priorität | Problem | Notiz |
|-----------|---------|-------|
| 🔴 Hoch | **Cloudflare-Link** erscheint nicht immer sofort in der Admin UI nach dem Speichern | Tab-Wechsel + "Aktualisieren"-Button als Workaround; Ursache: Tunnel-Startup dauert ~30s |
| 🟡 Mittel | **"Familien-App"-Checkbox** wird nach Tab-Wechsel manchmal als deaktiviert angezeigt | Rein visuelles Problem, Funktion läuft weiter |
| 🟡 Mittel | **Drift-Monitor**: Score nach 28 Tagen noch über Schwelle ("Möglicher Drift") | Ist korrekt — die ersten Wochen zeigen echten Anstieg im Aktivitätsniveau. Abwarten ob sich der Score stabilisiert (~Woche 5–6) |
| 🟡 Mittel | **AURA MONITOR Versionsanzeige** im Health-Tab zeigt noch "v0.30.68" | Diese Versionsnummer ist hartkodiert in `pwa_server.js` / `HealthTab.tsx` — wurde noch nicht angepasst |
| 🟢 Niedrig | **Aktivitäts-Normalisierung** braucht mindestens 7 Tage Daten für stabilen Median | Derzeit Fallback auf `rawTotal` wenn zu wenig Daten |
| 🔲 Geplant | **Fourier-Analyse** für zirkadianen Rhythmus-Fit noch nicht implementiert | In Roadmap als geplant vermerkt, kein Zeitdruck |

---

## 🎯 Nächster logischer Schritt — Exakte Aufgabe für die nächste Sitzung

### Option A — Empfohlen: Drift-Beobachtung + Reset-Entscheidung
**Situation**: Der Drift-Score liegt nach 28 Tagen über der Schwelle ("Möglicher Drift"). Das ist in der Einlaufphase eines neuen Systems normal.
**Aufgabe**: In ~2 Wochen prüfen, ob sich der Score stabilisiert hat (Kurve wird flach). Wenn ja: Score manuell zurücksetzen via Reset-Button → neuer Baseline-Start.
**Alternativ jetzt**: Reset-Button in Admin UI einbauen (Aufwand: ~30 Min) damit du als Installateur den Score nach der Einlaufphase zurücksetzen kannst ohne in den Code einzugreifen.

### Option B — Fourier-Analyse (Zirkadianer Rhythmus)
**Ziel**: Erkennen, ob sich der Tagesrhythmus der Person verschiebt (früher aufstehen, später schlafen gehen).
**Algorithmus**: FFT auf den 24h-Stundenvektor der Bewegungsevents → dominante Frequenz als Gesundheitsindikator.
**Aufwand**: ~3–4 Stunden | Python + Admin UI Kachel

### Option C — AURA-Monitor Versionsstring aktualisieren
**Aufgabe**: `v0.30.68` durch dynamische Versionsnummer ersetzen.
**Aufwand**: ~10 Minuten

---

## 📁 Wichtige Dateien

| Datei | Zweck |
|-------|-------|
| `src/lib/pwa_server.js` | PWA-Backend: Datenaggregation, HTTP-Server, Sparkline, Touch-Tooltips |
| `src/lib/ai_agent.js` | Gemini-Prompts für Tages-/Nachtbericht (nutzt `livingContext`) |
| `src/main.js` | Adapter-Einstiegspunkt, Analyse-Trigger, PWA-Integration |
| `python_service/brains/health.py` | IsolationForest, Page-Hinkley (adaptiver Schwellwert), Anomalie-Erkennung |
| `python_service/service.py` | Python-Bridge: ANALYZE_LONGTERM_TRENDS + neuer ANALYZE_DRIFT Befehl |
| `src-admin/src/components/tabs/HealthTab.tsx` | Admin Health Dashboard |
| `src-admin/src/components/tabs/LongtermTrendsView.tsx` | Admin Langzeit-Trends + Drift-Monitor (separater State, zeitfenster-unabhängig) |
| `io-package.json` | ioBroker-Manifest — **Versionsnummer hier** (nicht package.json!) |
| `README_de.md` | AURA MASTER-ROADMAP + Algorithmen-Tabelle |

---

## 🔬 Algorithmen-Status (Health-Säule)

| Zeile | Algorithmus | Status |
|-------|-------------|--------|
| 1–8 | Sensor-Fusion, Schlaf, Aktivität, Bad, Frischluft | ✅ Produktiv |
| 9–10 | KI-Berichte (Gemini, Fließtext, konfig. Nutzerprofil) | ✅ Produktiv |
| 11 | Inaktivitäts-Alarm | ✅ Produktiv |
| 12–13 | Lineare Regression + LLM-Drift | ✅ Produktiv |
| 14 | Aktivitäts-Normalisierung (persönlicher Median) | ✅ Produktiv |
| 15 | Fourier-Analyse (Zirkadianer Rhythmus) | 🔲 Geplant |
| 16 | Page-Hinkley Drift-Erkennung (adaptiver Schwellwert) | ✅ Produktiv (Einlaufphase ~6 Wochen) |

---

## ⚠️ Wichtige Lernpunkte für zukünftige Sitzungen

| Thema | Merke |
|-------|-------|
| **Versionierung** | Immer **beide** Dateien aktualisieren: `package.json` UND `io-package.json`. ioBroker liest die Versionsnummer aus `io-package.json`! |
| **Build-Workflow** | Nach Änderungen in `src/lib/` immer `npm run build:backend:dev` ausführen (kopiert nach `lib/`). Nach Änderungen in `src-admin/` immer `npm run build:react` (kopiert nach `admin/`). Danach committen! |
| **`src/` ist gitignored** | Änderungen in `src/lib/` und `src/main.js` werden NICHT direkt committed — nur das Build-Ergebnis in `lib/` und `main.js` ist tracked |
| **KI-Kontext-Felder** | `livingContext` = UI-Feld "KI-Kontext & Lebenssituation" → für alle Gemini-Prompts verwenden. `aiContext` existiert als Config-Feld NICHT im UI → nie verwenden |
| **Drift-Monitor** | Schwellwert ist jetzt adaptiv (σ-basiert). Der Score läuft in den ersten 6 Wochen natürlich hoch — das ist kein Bug, sondern die Einlaufphase |
