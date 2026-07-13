// [OC-FP2-DIAG] Temporaerer Diagnose-Log: warum bleibt sleepWindowCalc.firstEmpty null?
const fs = require('fs');
const path = 'src/main.js';
let raw = fs.readFileSync(path, 'utf8');
const eol = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
let lines = raw.split(/\r?\n/);

if (raw.indexOf('[OC-FP2-DIAG]') >= 0) { console.log('Bereits gepatcht (OC-FP2-DIAG).'); process.exit(0); }

// Anker: die return-Zeile der sleepWindowCalc-IIFE, gefolgt von '            })();'
const retIdx = lines.findIndex(l => l.indexOf('return { start: sleepStartTs, end: wakeTs, firstEmpty: _firstEmpty }') >= 0);
if (retIdx < 0) { console.error('FEHLER: return-Zeile nicht gefunden'); process.exit(1); }
const closeIdx = retIdx + 1;
if (lines[closeIdx].trim() !== '})();') { console.error('FEHLER: unerwartete Zeile nach return:', JSON.stringify(lines[closeIdx])); process.exit(1); }

const block = [
    '',
    '            // [OC-FP2-DIAG] Temporaere Diagnose: warum bleibt firstEmpty (fp2WakeTs-Quelle) null?',
    '            var _fp2DiagAll = sleepSearchEvents.filter(function(e){ return e.isFP2Bed; }).sort(function(a,b){ return (a.timestamp||0)-(b.timestamp||0); });',
    '            this.log.info(\'[OC-FP2-DIAG] FP2-Events=\' + _fp2DiagAll.length',
    '                + \' erstes=\' + (_fp2DiagAll.length ? new Date(_fp2DiagAll[0].timestamp).toLocaleString() : \'-\')',
    '                + \' letztes=\' + (_fp2DiagAll.length ? new Date(_fp2DiagAll[_fp2DiagAll.length-1].timestamp).toLocaleTimeString() : \'-\')',
    '                + \' | sleepStart=\' + (sleepWindowCalc.start ? new Date(sleepWindowCalc.start).toLocaleTimeString() : \'NULL\')',
    '                + \' firstEmpty=\' + (sleepWindowCalc.firstEmpty ? new Date(sleepWindowCalc.firstEmpty).toLocaleTimeString() : \'NULL\')',
    '                + \' bedPresMin=\' + bedPresenceMinutes);'
];

lines.splice(closeIdx + 1, 0, ...block);
fs.writeFileSync(path, lines.join(eol), 'utf8');
console.log('OC-FP2-DIAG eingefuegt nach Zeile', closeIdx + 1, '(' + block.length + ' Zeilen)');
