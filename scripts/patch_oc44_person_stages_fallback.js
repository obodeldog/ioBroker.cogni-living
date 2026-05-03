// OC-44: Per-Person Stages-Fallback auf globales Schlaffenster
// Problem: Wenn per-Person kein gueltiges Schlaffenster (bedWasEmpty=true, weil
//          personTag-Events fuer Vorabend fehlen), wurden Stages+Score leer gespeichert,
//          obwohl das globale Fenster und Person-Vibrationsdaten vorhanden waren.
// Fix:    Nach computePersonSleep + OC-38 pruefen: wenn bedWasEmpty=true aber
//         globales sleepWindowOC7 existiert → Stages aus globalem Fenster +
//         Person-Vibrationsdaten neu berechnen (gleicher Algo wie computePersonSleep intern).
const fs = require('fs');
let src = fs.readFileSync('c:/ioBroker/ioBroker.cogni-living/src/main.js', 'utf8');
const NL = '\r\n';
function L(s) { return s.split('\n').join(NL); }
let changed = 0;

function replace(desc, oldStr, newStr) {
    const o = L(oldStr);
    const n = L(newStr);
    if (!src.includes(o)) {
        console.error('FEHLER: ' + desc);
        const kw = oldStr.split('\n').find(l => l.trim().length > 15);
        const idx = kw ? src.indexOf(kw.trim()) : -1;
        if (idx >= 0) console.error('  Keyword gefunden, aber kein exakter Match: "' + kw.trim().substring(0, 60) + '"');
        else console.error('  Keyword nicht gefunden');
        process.exit(1);
    }
    src = src.replace(o, n);
    changed++;
    console.log('OK [' + changed + ']: ' + desc);
}

// ============================================================
// FIX: OC-44 — Fallback-Block vor sleepOnsetMin einfuegen
// ============================================================
replace(
    'OC-44 Per-Person Stages-Fallback einfuegen',
`                    var sleepOnsetMin = null;
                    if (_pResult.sleepWindowStart) {
                        sleepOnsetMin = Math.round((_pResult.sleepWindowStart - new Date(_pResult.sleepWindowStart).setHours(0,0,0,0)) / 60000);
                    }
                    // Per-Person Bett-Praesenz: FP2-Events`,

`                    // [OC-44] Fallback: Wenn per-Person kein gueltiges Schlaffenster (bedWasEmpty=true),
                    // aber globales Fenster (sleepWindowOC7) existiert → Stages aus globalem Fenster
                    // + Person-Vibrationsdaten neu berechnen. Gleicher Algorithmus wie computePersonSleep.
                    // Grund: personTag-Events fehlen fuer Vorabend → sleepStart landet auf falscher Nacht.
                    if (_pResult.bedWasEmpty && sleepWindowOC7 && sleepWindowOC7.start && sleepWindowOC7.end
                            && sleepWindowOC7.end > sleepWindowOC7.start) {
                        var _fbStart = sleepWindowOC7.start;
                        var _fbEnd   = sleepWindowOC7.end;
                        // Vibrations-Events: Person-getaggte bevorzugt, sonst ungetaggte (geteilter Sensor)
                        var _pFbVibDet = sleepSearchEvents.filter(function(e) {
                            return (!e.personTag || e.personTag === person)
                                && e.isVibrationBed && !e.isVibrationStrength
                                && (e.timestamp||0) >= _fbStart && (e.timestamp||0) <= _fbEnd
                                && (isActiveValue(e.value) || toPersonCount(e.value) > 0);
                        });
                        var _pFbVibStr = sleepSearchEvents.filter(function(e) {
                            return (!e.personTag || e.personTag === person)
                                && e.isVibrationStrength
                                && (e.timestamp||0) >= _fbStart && (e.timestamp||0) <= _fbEnd;
                        });
                        var _fbSLOT = 5 * 60 * 1000;
                        var _fbCount = Math.ceil((_fbEnd - _fbStart) / _fbSLOT);
                        var _fbStages = []; var _fbCQ = 0;
                        var _fbDeep = 0, _fbLight = 0, _fbRem = 0, _fbWake = 0;
                        for (var _fbi = 0; _fbi < _fbCount; _fbi++) {
                            var _fbSS = _fbStart + _fbi * _fbSLOT, _fbSE = _fbSS + _fbSLOT;
                            var _fbD = _pFbVibDet.filter(function(e) { return (e.timestamp||0) >= _fbSS && (e.timestamp||0) < _fbSE; }).length;
                            var _fbSA = _pFbVibStr.filter(function(e) { return (e.timestamp||0) >= _fbSS && (e.timestamp||0) < _fbSE; })
                                .map(function(e) { return typeof e.value === 'number' ? e.value : parseFloat(e.value) || 0; });
                            var _fbSM = _fbSA.length > 0 ? Math.max.apply(null, _fbSA) : 0;
                            var _fbHIn = (_fbSS - _fbStart) / 3600000;
                            var _fbSt;
                            if (_fbD === 0)                                                           { _fbCQ++; _fbSt = _fbCQ >= 5 ? 'deep' : 'light'; }
                            else if (_fbD >= 5 || _fbSM > 28)                                        { _fbCQ = 0; _fbSt = 'wake'; }
                            else if (_fbD >= 2 && _fbHIn >= 2.5 && _fbSM >= 12 && _fbSM <= 28)     { _fbCQ = 0; _fbSt = 'rem'; }
                            else                                                                      { _fbCQ = 0; _fbSt = 'light'; }
                            _fbStages.push({ t: _fbi * 5, s: _fbSt });
                            if (_fbSt === 'deep') _fbDeep += 300; else if (_fbSt === 'light') _fbLight += 300;
                            else if (_fbSt === 'rem') _fbRem += 300; else _fbWake += 300;
                        }
                        var _fbDurMin  = (_fbEnd - _fbStart) / 60000;
                        var _fbDurScr  = Math.max(20, Math.min(95, 25 + 0.12 * _fbDurMin));
                        var _fbTotal   = _fbDeep + _fbLight + _fbRem + _fbWake;
                        var _fbAdj     = 0;
                        if (_fbTotal > 0) {
                            var _fbRp  = _fbRem  / _fbTotal, _fbWp = _fbWake / _fbTotal;
                            var _fbCov = Math.min(1, (_fbTotal / 60) / Math.max(1, _fbDurMin));
                            _fbAdj = Math.max(-8, Math.min(8, Math.round((_fbRp * 30 - _fbWp * 50) * _fbCov)));
                        }
                        _pResult.sleepStages       = _fbStages;
                        _pResult.stagesWindowStart = _fbStart;
                        _pResult.stagesWindowEnd   = _fbEnd;
                        _pResult.sleepScore        = Math.round(Math.max(0, Math.min(100, _fbDurScr + _fbAdj)));
                        _pResult.sleepScoreRaw     = Math.round(Math.max(0, _fbDurScr + _fbAdj));
                        _pResult.sleepWindowStart  = _fbStart;
                        _pResult.sleepWindowEnd    = _fbEnd;
                        _pResult.bedWasEmpty       = false;
                        _pResult.wakeSource        = _pResult.wakeSource || 'global_fallback';
                        _self.log.info('[OC-44] ' + person + ': Stages-Fallback → globales Fenster '
                            + new Date(_fbStart).toLocaleTimeString() + '-' + new Date(_fbEnd).toLocaleTimeString()
                            + ', ' + _fbStages.length + ' Slots, Score=' + _pResult.sleepScore
                            + ((_pFbVibDet.length > 0) ? ', VibDet=' + _pFbVibDet.length : ' (kein Vibsensor)'));
                    }

                    var sleepOnsetMin = null;
                    if (_pResult.sleepWindowStart) {
                        sleepOnsetMin = Math.round((_pResult.sleepWindowStart - new Date(_pResult.sleepWindowStart).setHours(0,0,0,0)) / 60000);
                    }
                    // Per-Person Bett-Praesenz: FP2-Events`
);

fs.writeFileSync('c:/ioBroker/ioBroker.cogni-living/src/main.js', src);
console.log('\nAlle ' + changed + ' OC-44 Fixes angewendet.');
