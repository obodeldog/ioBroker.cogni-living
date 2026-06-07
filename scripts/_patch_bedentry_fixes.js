// Patch-Skript: OC-45c Rausch-Guard + OC-4 Gap-Fusion + Shared-Bed-Schwelle
// Literale String-Ersetzungen (kein Regex) fuer sichere Patches in src/main.js
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'main.js');
let src = fs.readFileSync(file, 'utf8');
let applied = [];
const EOL = src.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
const fix = (s) => s.replace(/\n/g, EOL);

function replaceOnce(label, oldStrRaw, newStrRaw) {
    const oldStr = fix(oldStrRaw);
    const newStr = fix(newStrRaw);
    const idx = src.indexOf(oldStr);
    if (idx === -1) { throw new Error('NICHT GEFUNDEN: ' + label); }
    if (src.indexOf(oldStr, idx + 1) !== -1) { throw new Error('MEHRFACH GEFUNDEN: ' + label); }
    src = src.slice(0, idx) + newStr + src.slice(idx + oldStr.length);
    applied.push(label);
}

// ---- FIX 1: OC-45c Radar-Rausch-Guard ----
replaceOnce('FIX1_OC45c',
`                // Schritt 1: FP2=False innerhalb 30 Min nach bedEntryTs?
                var _oc45cEarlyFalse = null;
                for (var _oc45i = 0; _oc45i < _oc45cFp2Evts.length; _oc45i++) {
                    var _oc45e = _oc45cFp2Evts[_oc45i];
                    if (!isActiveValue(_oc45e.value) && ((_oc45e.timestamp||0) - _bedEntryTsFinal) < _oc45cEarlyExitMs) {
                        _oc45cEarlyFalse = _oc45e; break;
                    }
                }`,
`                // Schritt 1: FP2=False innerhalb 30 Min nach bedEntryTs?
                // [Radar-Rausch-Guard] Ein False muss mind. 60s anhalten, sonst ist es ein
                // Sensor-Aussetzer (z.B. Shelly-Radar springt 0->1->0 in Sekunden) und kein
                // echtes Bett-Verlassen. Echte FP2-Sensoren senden stabil -> > 60s bleibt erhalten.
                var _oc45cMinFalseMs = 60000;
                var _oc45cEarlyFalse = null;
                for (var _oc45i = 0; _oc45i < _oc45cFp2Evts.length; _oc45i++) {
                    var _oc45e = _oc45cFp2Evts[_oc45i];
                    if (!isActiveValue(_oc45e.value) && ((_oc45e.timestamp||0) - _bedEntryTsFinal) < _oc45cEarlyExitMs) {
                        // Dauer des False-Zustands: bis zum naechsten True (oder bis sleepStart)
                        var _oc45cNextTrue = null;
                        for (var _oc45m = _oc45i + 1; _oc45m < _oc45cFp2Evts.length; _oc45m++) {
                            if (isActiveValue(_oc45cFp2Evts[_oc45m].value)) { _oc45cNextTrue = _oc45cFp2Evts[_oc45m]; break; }
                        }
                        var _oc45cFalseDur = _oc45cNextTrue
                            ? ((_oc45cNextTrue.timestamp||0) - (_oc45e.timestamp||0))
                            : (_oc45cSlStart - (_oc45e.timestamp||0));
                        if (_oc45cFalseDur < _oc45cMinFalseMs) { continue; } // Radar-Rauschen -> ignorieren
                        _oc45cEarlyFalse = _oc45e; break;
                    }
                }`);

// ---- FIX 2: OC-4 Gap-Fusion bei bedPresenceMinutes ----
replaceOnce('FIX2_OC4_bedPresence',
`            const bedPresenceMinutes = (function() {
                var presStart = null; var total = 0;
                var bedEvts = sleepSearchEvents.filter(function(e) { return e.isFP2Bed; })
                    .sort(function(a,b) { return (a.timestamp||0)-(b.timestamp||0); });
                bedEvts.forEach(function(e) {
                    var v = isActiveValue(e.value) || toPersonCount(e.value) > 0;
                    if (v && !presStart) { presStart = e.timestamp||0; }
                    else if (!v && presStart) { total += ((e.timestamp||0) - presStart) / 60000; presStart = null; }
                });
                if (presStart) total += (Date.now() - presStart) / 60000;
                return Math.round(total);
            })();`,
`            const bedPresenceMinutes = (function() {
                var bedEvts = sleepSearchEvents.filter(function(e) { return e.isFP2Bed; })
                    .sort(function(a,b) { return (a.timestamp||0)-(b.timestamp||0); });
                if (bedEvts.length === 0) return 0;
                // [Radar-Gap-Fusion] Rohe Belegungsbloecke bilden, dann Luecken < 30 Min
                // ueberbruecken. Sonst summieren Radar-Aussetzer (Shelly 0->1->0) die echte
                // Bettzeit kaputt und OC-4 verwirft faelschlich das Schlaffenster.
                // Sensor-neutral: echte FP2/Vibration-Sensoren haben keine Sekunden-Aussetzer.
                var GAP_FUSE_MS = 30 * 60 * 1000;
                var _blocks = []; var presStart = null; var lastActiveTs = null;
                bedEvts.forEach(function(e) {
                    var v = isActiveValue(e.value) || toPersonCount(e.value) > 0;
                    var _ts = e.timestamp || 0;
                    if (v) { if (presStart === null) presStart = _ts; lastActiveTs = _ts; }
                    else if (presStart !== null) { _blocks.push({ start: presStart, end: _ts }); presStart = null; }
                });
                if (presStart !== null) _blocks.push({ start: presStart, end: Date.now() });
                if (_blocks.length === 0) return 0;
                var _fused = [_blocks[0]];
                for (var _bi = 1; _bi < _blocks.length; _bi++) {
                    var _prev = _fused[_fused.length - 1];
                    if (_blocks[_bi].start - _prev.end < GAP_FUSE_MS) { _prev.end = _blocks[_bi].end; }
                    else { _fused.push(_blocks[_bi]); }
                }
                var total = 0;
                for (var _fi = 0; _fi < _fused.length; _fi++) { total += (_fused[_fi].end - _fused[_fi].start) / 60000; }
                return Math.round(total);
            })();`);

// ---- FIX 3: Shared-Bed-Schwelle 20s -> 120s ----
replaceOnce('FIX3_SharedBedThreshold',
`                var SHARED_BED_SUSTAIN_MS = 20000; // 20 Sekunden Mindeshdauer`,
`                var SHARED_BED_SUSTAIN_MS = 120000; // 120 Sekunden Mindestdauer (Radar-Rauschen herausfiltern)`);

fs.writeFileSync(file, src, 'utf8');
console.log('OK - angewendet: ' + applied.join(', '));
