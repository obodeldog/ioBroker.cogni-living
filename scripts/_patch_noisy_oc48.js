/**
 * Patch: Noisy-Sensoren aus OC-48 und OC-48c ausschließen
 *
 * Bug: Noisy-Sensoren (z.B. "Zigbee EG Wohnen Bewegung") feuern alle 3-7 Minuten
 * die ganze Nacht, auch wenn niemand im Raum ist. OC-48c interpretiert diese
 * kontinuierliche "Außen-Bewegung" als "Person war nicht im Bett" und
 * verwirft die korrekte bedEntryTs.
 *
 * Beispiel 08.06.2026: Noisy-Sensor feuert 00:23-01:02 (13 Events = 39 Min Block).
 * OC-48c Schwelle: >= 30 Min -> bedEntryTs=00:19 verworfen -> NULL.
 * Korrekte Anzeige wäre: "Ins Bett gegangen: 00:19".
 *
 * Fix 1: Vor der _bedEntryTsFinal IIFE: _oc48NoisyIds aus this._noisySensorIds capturen.
 * Fix 2: In _isFarMotion (OC-48 Gegenbeleg-Prüfung): noisy sensor events ausschließen.
 * Fix 3: In _oc48cFarFn (OC-48c sustained-absence-Guard): noisy sensor events ausschließen.
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'main.js');
let src = fs.readFileSync(filePath, 'utf8');
const norm = s => s.replace(/\r\n/g, '\n');
let n = norm(src);

// ── FIX 1: _oc48NoisyIds vor der _bedEntryTsFinal IIFE capturen ─────────────
// Anker: Kommentar "[bedEntryTs-Fix OC-48] PRE_SLEEP Counterevidence-Filter"
const anchor1 = `            // [bedEntryTs-Fix OC-48] PRE_SLEEP Counterevidence-Filter
            // Sensor-neutral: prueft fuer jeden Cluster-Kandidaten ob danach (max. 60 Min) Bewegungen
            // in entfernten Raeumen (Hop >= 2 vom Schlafzimmer) stattfanden = Pre-Sleep-Touch.
            // OC-46 (lange Einschlaf-Latenz, Person liegt ruhig) bleibt korrekt: kein Gegenbeleg -> frueh behalten.
            // Funktioniert ohne FP2, ohne Topologie, mit allen Sensor-Konfigurationen.`;

const replacement1 = `            // [bedEntryTs-Fix OC-48] PRE_SLEEP Counterevidence-Filter
            // Sensor-neutral: prueft fuer jeden Cluster-Kandidaten ob danach (max. 60 Min) Bewegungen
            // in entfernten Raeumen (Hop >= 2 vom Schlafzimmer) stattfanden = Pre-Sleep-Touch.
            // OC-46 (lange Einschlaf-Latenz, Person liegt ruhig) bleibt korrekt: kein Gegenbeleg -> frueh behalten.
            // Funktioniert ohne FP2, ohne Topologie, mit allen Sensor-Konfigurationen.
            // [OC-24-OC48-Fix] Noisy-Sensoren (zu-sensibel-Bewegungsmelder) aus Gegenbeleg-Pruefung ausschliessen.
            // Sie feuern auch wenn niemand im Raum ist und wuerden sonst korrekte bedEntryTs verwerfen.
            var _oc48NoisyIds = (this._noisySensorIds && this._noisySensorIds.size > 0) ? this._noisySensorIds : new Set();`;

// ── FIX 2: In _isFarMotion (OC-48) noisy sensor check einfuegen ──────────────
// Anker: die _isFarMotion-Definition im IIFE - eindeutig durch "var _isFarMotion = function(e) {"
const anchor2 = `                var _isFarMotion = function(e) {
                    if (e.isBedroomMotion || e.isFP2Bed || e.isVibrationBed || e.isBathroomSensor) return false;
                    if (e.type !== 'motion' && e.type !== 'presence_radar_bool' && e.type !== 'presence_radar_count') return false;
                    if (!isActiveValue(e.value)) return false;`;

const replacement2 = `                var _isFarMotion = function(e) {
                    if (e.isBedroomMotion || e.isFP2Bed || e.isVibrationBed || e.isBathroomSensor) return false;
                    if (e.type !== 'motion' && e.type !== 'presence_radar_bool' && e.type !== 'presence_radar_count') return false;
                    if (!isActiveValue(e.value)) return false;
                    if (_oc48NoisyIds.has(e.id)) return false; // [OC-24-OC48-Fix] Noisy-Sensor = kein Gegenbeleg`;

// ── FIX 3: In _oc48cFarFn (OC-48c) noisy sensor check einfuegen ──────────────
// Anker: eindeutig durch "_oc48cFarFn" Funktionsname
const anchor3 = `                var _oc48cFarFn = function(e) {
                    if (e.isBedroomMotion || e.isFP2Bed || e.isVibrationBed || e.isBathroomSensor) return false;
                    if (e.type !== 'motion' && e.type !== 'presence_radar_bool' && e.type !== 'presence_radar_count') return false;
                    if (!isActiveValue(e.value)) return false;`;

const replacement3 = `                var _oc48cFarFn = function(e) {
                    if (e.isBedroomMotion || e.isFP2Bed || e.isVibrationBed || e.isBathroomSensor) return false;
                    if (e.type !== 'motion' && e.type !== 'presence_radar_bool' && e.type !== 'presence_radar_count') return false;
                    if (!isActiveValue(e.value)) return false;
                    if (_oc48NoisyIds.has(e.id)) return false; // [OC-24-OC48-Fix] Noisy-Sensor = kein Sustained-Absence-Beweis`;

function applyFix(src, anchor, replacement, label) {
    const na = norm(anchor);
    const ns = norm(src);
    if (!ns.includes(na)) {
        console.error('FEHLER: Anker nicht gefunden fuer ' + label);
        process.exit(1);
    }
    const result = ns.replace(na, norm(replacement));
    console.log('OK: ' + label);
    return result;
}

n = applyFix(n, anchor1, replacement1, 'FIX1 _oc48NoisyIds capture');
n = applyFix(n, anchor2, replacement2, 'FIX2 _isFarMotion noisy-check');
n = applyFix(n, anchor3, replacement3, 'FIX3 _oc48cFarFn noisy-check');

fs.writeFileSync(filePath, n, 'utf8');
console.log('Fertig. src/main.js aktualisiert.');
