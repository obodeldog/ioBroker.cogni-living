// [OC-PSA-CLAMP] PWA-Kachel: Vor-Schlaf-Abwesenheit auf sichtbaren Balkenbereich klemmen.
// Einzelzeilen-Ersetzung (Datei hat gemischte Zeilenenden).
const fs = require('fs');
const path = 'src/lib/pwa_sleep_tile_build.js';
let raw = fs.readFileSync(path, 'utf8');

if (raw.indexOf('[OC-PSA-CLAMP]') >= 0) { console.log('Bereits gepatcht (OC-PSA-CLAMP PWA).'); process.exit(0); }

const OLD_LEFT = "            var leftPct = Math.max(0, Math.min(100, ((ev.start - bedEntryTsVal) / newBarTotalMs) * 100));";
const NEW_LEFT = [
    "            // [OC-PSA-CLAMP] Sichtbaren Bereich auf [bedEntryTsVal, Balkenende] klemmen. Abwesenheit",
    "            // komplett VOR dem Ins-Bett-Gehen gehoert nicht auf den Schlafbalken -> ueberspringen.",
    "            // Vorher: nur leftPct geklemmt, widthPct voll -> Schraffur ragte in echten Schlaf.",
    "            var _barEndMs = bedEntryTsVal + newBarTotalMs;",
    "            var _visStart = Math.max(ev.start, bedEntryTsVal);",
    "            var _visEnd = Math.min(ev.end, _barEndMs);",
    "            if (_visEnd <= _visStart) return;",
    "            var leftPct = Math.max(0, Math.min(100, ((_visStart - bedEntryTsVal) / newBarTotalMs) * 100));"
].join("\r\n");

const OLD_WIDTH = "            var widthPct = Math.max(0.5, Math.min(100 - leftPct, ((ev.end - ev.start) / newBarTotalMs) * 100));";
const NEW_WIDTH = "            var widthPct = Math.max(0.5, Math.min(100 - leftPct, ((_visEnd - _visStart) / newBarTotalMs) * 100));";

if (raw.indexOf(OLD_LEFT) < 0) { console.error('FEHLER: leftPct-Zeile nicht gefunden'); process.exit(1); }
if (raw.indexOf(OLD_WIDTH) < 0) { console.error('FEHLER: widthPct-Zeile nicht gefunden'); process.exit(1); }
raw = raw.replace(OLD_LEFT, NEW_LEFT);
raw = raw.replace(OLD_WIDTH, NEW_WIDTH);
fs.writeFileSync(path, raw, 'utf8');
console.log('OC-PSA-CLAMP PWA angewendet.');
