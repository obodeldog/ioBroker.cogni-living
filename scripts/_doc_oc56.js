// OC-56 Doku: TESTING.md Testfaelle oben einfuegen + HANDBUCH.md Abschnitt anhaengen
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// --- TESTING.md: neuen Block vor dem v0.33.277-Block einfuegen ---
const tPath = path.join(ROOT, '_internal', 'TESTING.md');
let t = fs.readFileSync(tPath, 'utf8');
if (t.indexOf('T-K296a') === -1) {
    const marker = t.match(/^## .*v0\.33\.277.*$/m);
    if (!marker) { console.error('TESTING.md Marker nicht gefunden'); process.exit(1); }
    const eol = t.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
    const block = [
        '## \u{1F9EA} v0.33.296 - OC-56 Write-Ahead-Eventlog + Neustart-Detektor (11.06.2026)',
        '',
        '| ID | Testfall | Erwartetes Ergebnis | Gepr\u00fcft am | \u2705/\u274c |',
        '|---|---|---|---|---|',
        '| T-K296a | Normale Nacht, Adapter laeuft durch | `history/buffer-YYYY-MM-DD.jsonl` waechst mit jedem Event; Log `[OC-56] sleepSearch-Merge` zeigt 0 oder wenige Ergaenzungen (Memory deckt alles ab). | | |',
        '| T-K296b | Adapter-Neustart um Mitternacht simulieren (Instanz neu starten ~00:05), morgens Analyse pruefen | Abend-Events (z.B. Bettgeh-Vibration 23:1x) sind in der Analyse vorhanden; `bedEntryTs` gesetzt; gelber Wachliegen-Balken sichtbar. Log: `[OC-56] N Events aus Write-Ahead-Pufferdatei wiederhergestellt`. | | |',
        '| T-K296c | Nach Neustart in der Nacht: HealthTab oeffnen | Orange Warnung in Schlafkachel: "Adapter-Neustart um HH:MM ... Events wurden aus dem Pufferlog wiederhergestellt". | | |',
        '| T-K296d | Neustart tagsueber (z.B. 15:00), HealthTab am Abend | KEINE Warnung in Schlafkachel (nur Nacht-Fenster 18:00 Vortag - 12:00 relevant). | | |',
        '| T-K296e | Pufferdateien aelter als 3 Tage | Werden beim Adapter-Start automatisch geloescht. | | |',
        '| T-K296f | `system.heartbeat` State | Aktualisiert sich alle 60s (ms-Timestamp). | | |',
        '',
        ''
    ].join(eol);
    t = t.replace(marker[0], block + marker[0]);
    fs.writeFileSync(tPath, t, 'utf8');
    console.log('OK: TESTING.md');
} else { console.log('SKIP: TESTING.md schon aktuell'); }

// --- HANDBUCH.md: OC-56 Abschnitt anhaengen ---
const hPath = path.join(ROOT, '_internal', 'HANDBUCH.md');
let h = fs.readFileSync(hPath, 'utf8');
if (h.indexOf('OC-56: WRITE-AHEAD-EVENTLOG') === -1) {
    const eol = h.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
    const sec = [
        '',
        '---',
        '',
        '## \u{1F4BE} OC-56: WRITE-AHEAD-EVENTLOG - Restart-sicherer Event-Puffer *(ab v0.33.296)*',
        '',
        '### Problem (Forensik 11.06.2026)',
        'Der Schlafanalyse-Puffer (`eventHistory`) lebte nur im Arbeitsspeicher. Bei einem naechtlichen',
        'Adapter-Neustart (durch ioBroker, z.B. Crash oder Zeitplan - nicht vom Nutzer) ging der Puffer verloren.',
        'Folge: Abend-Events (Bettgeh-Vibrationen ~23:1x) fehlten morgens in der Analyse, obwohl der Sensor',
        'lieferte und die Events sogar in der Vortages-JSON gespeichert waren. `bedEntryTs` wurde null,',
        'der gelbe Wachliegen-Balken verschwand. Alle bisherigen Sicherheitsnetze versagten still.',
        '',
        '### Loesung: 4 Bausteine',
        '',
        '| Baustein | Was passiert | Wo |',
        '|---|---|---|',
        '| **Write-Ahead-Log (WAL)** | Jedes Event wird sofort beim Eintreffen zusaetzlich als JSON-Zeile in `history/buffer-YYYY-MM-DD.jsonl` geschrieben (append-only). | `recorder.js` |',
        '| **Deterministischer Merge** | `sleepSearchEvents` wird bei jedem Save IMMER aus 3 Quellen zusammengefuehrt und dedupliziert (Key: timestamp+id+type): Memory + WAL-Dateien (Vortag/heute) + Vortages-JSON. | `main.js saveDailyHistory()` |',
        '| **Restore-Fix** | Beim Adapter-Start werden WAL-Dateien (gestern+heute) in den Puffer gemergt. Fehler beim Restore loggen warn statt still zu schlucken. Cleanup: WAL > 3 Tage wird geloescht. | `main.js startSystem()` |',
        '| **Neustart-Detektor** | `system.heartbeat` wird alle 60s geschrieben. Beim Start wird die Heartbeat-Luecke ausgewertet und in `system.lastRestart` (JSON: ts, lastHeartbeat, gapSec) abgelegt. | `main.js` + HealthTab |',
        '',
        '### UI-Anzeige',
        'Liegt der letzte Adapter-Neustart in der vergangenen Nacht (18:00 Vortag bis 12:00 heute), zeigt die',
        'Schlafkachel im HealthTab eine orange Warnung: *"Adapter-Neustart um HH:MM (Ausfall ca. X Min) -',
        'Events wurden aus dem Pufferlog wiederhergestellt"*.',
        '',
        '### Sensor-Neutralitaet',
        'OC-56 ist quellen-neutral: Das WAL speichert ALLE Sensortypen (Vibration, FP2, PIR, Tuer, Temperatur...).',
        'Jede Kundenkonfiguration profitiert gleichermassen - die Analyse sieht nach einem Neustart exakt',
        'dieselben Events wie ohne Neustart.',
        ''
    ].join(eol);
    h = h.replace(/\s*$/, '') + sec;
    fs.writeFileSync(hPath, h, 'utf8');
    console.log('OK: HANDBUCH.md');
} else { console.log('SKIP: HANDBUCH.md schon aktuell'); }
