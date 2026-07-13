// [OC-48c v3] "Bett leer" als Primaersignal fuer Vor-Schlaf-Abwesenheit.
// Fuegt nach dem bestehenden 30-Min-Fern-Block-Pfad einen zusaetzlichen Pfad ein:
// Wenn oben nichts markiert wurde, das Bett aber lange leer war (FP2) + Fern-Aktivitaet
// existiert -> Leer-Phase als preSleepAbsence markieren.
const fs = require('fs');
const path = 'src/main.js';
let raw = fs.readFileSync(path, 'utf8');
const eol = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
let lines = raw.split(/\r?\n/);

// Anker: die log.info-Zeile des bestehenden OC-48c v2 Pfads
const markerIdx = lines.findIndex(l => l.indexOf("[OC-48c v2] Vor-Schlaf-Abwesenheit") >= 0);
if (markerIdx < 0) { console.error('FEHLER: Anker [OC-48c v2] nicht gefunden'); process.exit(1); }

// Erwartete Folgezeilen: markerIdx+1 = '            }' (else-if close), markerIdx+2 = '        }' (30min-if close)
const l1 = lines[markerIdx + 1];
const l2 = lines[markerIdx + 2];
if (l1.trim() !== '}' || l2.trim() !== '}') {
    console.error('FEHLER: unerwartete Folgezeilen:', JSON.stringify(l1), JSON.stringify(l2));
    process.exit(1);
}

// Idempotenz-Check
if (raw.indexOf('[OC-48c v3] Bett-leer-Abwesenheit') >= 0) { console.log('Bereits gepatcht (OC-48c v3), nichts zu tun.'); process.exit(0); }

const block = [
    '',
    '        // [OC-48c v3] "Bett leer" als Primaersignal (ergaenzt den 30-Min-Fern-Block oben).',
    '        // Wenn oben KEIN 30-Min-Fern-Block gefunden wurde, das Bett aber zwischen bedEntry und',
    '        // sleepStart ueber eine lange Phase leer war (FP2 nicht belegt; kurze Praesenz-Blips',
    '        // < 10 Min werden fusioniert) UND es ueberhaupt Fern-Aktivitaet gab, wird diese Leer-',
    '        // Phase als Vor-Schlaf-Abwesenheit markiert. Deckt den Fall ab, dass die Person still',
    '        // auf der Couch sitzt (Bewegungsmelder feuern kaum -> kein 30-Min-Block), das Bett aber',
    '        // nachweislich leer ist. Sensor-neutral: ohne FP2 greift weiter der Block oben.',
    '        if (_preSleepAbsence.length === 0 && _oc48cFar.length > 0) {',
    '            var _psaFp2 = allEvents.filter(function(e) { return isMine(e) && e.isFP2Bed; })',
    '                .sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });',
    '            if (_psaFp2.length > 0) {',
    '                var _psaState = true; // Default: gerade ins Bett -> belegt',
    '                for (var _pfi = 0; _pfi < _psaFp2.length; _pfi++) {',
    '                    if ((_psaFp2[_pfi].timestamp || 0) <= bedEntryTs) _psaState = isActiveValue(_psaFp2[_pfi].value);',
    '                    else break;',
    '                }',
    '                var _psaSegs = [], _psaCurS = bedEntryTs, _psaCurOcc = _psaState;',
    '                for (var _pfj = 0; _pfj < _psaFp2.length; _pfj++) {',
    '                    var _pfts = _psaFp2[_pfj].timestamp || 0;',
    '                    if (_pfts <= bedEntryTs || _pfts >= sleepStart) continue;',
    '                    var _pfOcc = isActiveValue(_psaFp2[_pfj].value);',
    '                    if (_pfOcc !== _psaCurOcc) { _psaSegs.push({ s: _psaCurS, e: _pfts, occ: _psaCurOcc }); _psaCurS = _pfts; _psaCurOcc = _pfOcc; }',
    '                }',
    '                _psaSegs.push({ s: _psaCurS, e: sleepStart, occ: _psaCurOcc });',
    '                var _psaBlipTol = 10 * 60000, _psaEmptyMin = 30 * 60000;',
    '                var _psaBestS = null, _psaBestE = null, _psaBestDur = 0, _psaRunS = null, _psaRunE = null;',
    '                for (var _psi = 0; _psi < _psaSegs.length; _psi++) {',
    '                    var _sg = _psaSegs[_psi];',
    '                    if (!_sg.occ) {',
    '                        if (_psaRunS === null) { _psaRunS = _sg.s; _psaRunE = _sg.e; } else { _psaRunE = _sg.e; }',
    '                    } else if (_psaRunS !== null && (_sg.e - _sg.s) > _psaBlipTol) {',
    '                        if (_psaRunE - _psaRunS > _psaBestDur) { _psaBestDur = _psaRunE - _psaRunS; _psaBestS = _psaRunS; _psaBestE = _psaRunE; }',
    '                        _psaRunS = null; _psaRunE = null;',
    '                    }',
    '                }',
    '                if (_psaRunS !== null && (_psaRunE - _psaRunS) > _psaBestDur) { _psaBestDur = _psaRunE - _psaRunS; _psaBestS = _psaRunS; _psaBestE = _psaRunE; }',
    '                if (_psaBestDur >= _psaEmptyMin && _psaBestS != null && _psaBestE != null) {',
    '                    var _psaS = Math.max(_psaBestS, bedEntryTs), _psaE = Math.min(_psaBestE, sleepStart);',
    '                    if (_psaE > _psaS) {',
    '                        _preSleepAbsence.push({ start: _psaS, end: _psaE, durationMin: Math.max(1, Math.round((_psaE - _psaS) / 60000)), source: \'fp2_empty\' });',
    '                        if (log) log.info(logPfx + \'[OC-48c v3] Bett-leer-Abwesenheit \' + new Date(_psaS).toLocaleTimeString() + \'-\' + new Date(_psaE).toLocaleTimeString() + \' markiert (Bett leer, Fern-Aktivitaet vorhanden, kein 30-Min-Block noetig)\');',
    '                    }',
    '                }',
    '            }',
    '        }'
];

lines.splice(markerIdx + 3, 0, ...block);
fs.writeFileSync(path, lines.join(eol), 'utf8');
console.log('Fix 1 (OC-48c v3 Bett-leer) eingefuegt nach Zeile', markerIdx + 3, '(' + block.length + ' Zeilen)');
