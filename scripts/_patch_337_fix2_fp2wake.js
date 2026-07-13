// [OC-FP2-WAKE-ROBUST] Robuste FP2-Aufwach-Erkennung (Fallback gegen Radar-Flackern).
// Fuegt in sleepWindowCalc (IIFE) nach der starren >=15-Min-Regel einen Fallback ein:
// erste Belegt->Leer-Flanke (Std 4-14), nach der das Bett in den folgenden 30 Min
// ueberwiegend leer bleibt (Belegt-Anteil < 20%). Nur aktiv wenn _firstEmpty noch null.
const fs = require('fs');
const path = 'src/main.js';
let raw = fs.readFileSync(path, 'utf8');
const eol = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
let lines = raw.split(/\r?\n/);

if (raw.indexOf('[OC-FP2-WAKE-ROBUST]') >= 0) { console.log('Bereits gepatcht (OC-FP2-WAKE-ROBUST), nichts zu tun.'); process.exit(0); }

// Anker: die trailing-empty Zeile mit Date.now() in sleepWindowCalc
const markerIdx = lines.findIndex(l => l.indexOf('var _wdur2 = (Date.now() - emptyStart)') >= 0);
if (markerIdx < 0) { console.error('FEHLER: Anker _wdur2 nicht gefunden'); process.exit(1); }

// Naechste Zeile muss die return-Zeile der IIFE sein
const nextL = lines[markerIdx + 1];
if (nextL.indexOf('return { start: sleepStartTs, end: wakeTs, firstEmpty: _firstEmpty }') < 0) {
    console.error('FEHLER: unerwartete Folgezeile:', JSON.stringify(nextL));
    process.exit(1);
}

const block = [
    '                // [OC-FP2-WAKE-ROBUST] Fallback wenn die starre >=15-Min-Regel nichts fand',
    '                // (flackernder Radar: Leer-Phasen knapp unter 15 Min, dazwischen kurze Belegt-Blips).',
    '                // Regel: erste Belegt->Leer-Flanke (Std 4-14), nach der das Bett in den folgenden',
    '                // 30 Min UEBERWIEGEND leer bleibt (Belegt-Anteil < 20% = < 6 Min). Schuetzt weiter',
    '                // vor kurzem WC-/Kueche-Gang (dort ist das Bett danach wieder belegt).',
    '                if (_firstEmpty === null) {',
    '                    for (var _ri = 0; _ri < bedEvts.length; _ri++) {',
    '                        var _rts = bedEvts[_ri].timestamp || 0;',
    '                        if (_rts < sleepStartTs) continue;',
    '                        var _rhr = new Date(_rts).getHours();',
    '                        if (_rhr < 4 || _rhr > 14) continue;',
    '                        if (isActiveValue(bedEvts[_ri].value) || toPersonCount(bedEvts[_ri].value) > 0) continue;',
    '                        var _rWinEnd = _rts + 30 * 60000;',
    '                        var _rOccMs = 0, _rSegS = null;',
    '                        for (var _rj = 0; _rj < bedEvts.length; _rj++) {',
    '                            var _rjt = bedEvts[_rj].timestamp || 0;',
    '                            if (_rjt < _rts || _rjt > _rWinEnd) continue;',
    '                            var _rjOcc = isActiveValue(bedEvts[_rj].value) || toPersonCount(bedEvts[_rj].value) > 0;',
    '                            if (_rjOcc && _rSegS === null) _rSegS = _rjt;',
    '                            else if (!_rjOcc && _rSegS !== null) { _rOccMs += _rjt - _rSegS; _rSegS = null; }',
    '                        }',
    '                        if (_rSegS !== null) _rOccMs += _rWinEnd - _rSegS;',
    '                        if (_rOccMs < 0.20 * 30 * 60000) { _firstEmpty = _rts; wakeTs = _rts; break; }',
    '                    }',
    '                }'
];

lines.splice(markerIdx + 1, 0, ...block);
fs.writeFileSync(path, lines.join(eol), 'utf8');
console.log('Fix 2 (OC-FP2-WAKE-ROBUST) eingefuegt nach Zeile', markerIdx + 1, '(' + block.length + ' Zeilen)');
