// Patch-Skript: Fuegt per-Person bedPresenceMinutes + nightVibration zur personData IIFE hinzu
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'main.js');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings fuer die Suche
const normalizeNL = s => s.replace(/\r\n/g, '\n');
const contentN = normalizeNL(content);

const oldBlock = normalizeNL(
`                    var sleepOnsetMin = null;
                    if (_pResult.sleepWindowStart) {
                        sleepOnsetMin = Math.round((_pResult.sleepWindowStart - new Date(_pResult.sleepWindowStart).setHours(0,0,0,0)) / 60000);
                    }
                    result[person] = {
                        nightActivityCount:   nightActivityCount,
                        wakeTimeMin:          wakeTimeMin,
                        sleepOnsetMin:        sleepOnsetMin,
                        nocturiaAttr:         nocturiaAttr,
                        sleepWindowStart:     _pResult.sleepWindowStart,
                        sleepWindowEnd:       _pResult.sleepWindowEnd,
                        wakeSource:           _pResult.wakeSource,
                        wakeConf:             _pResult.wakeConf,
                        sleepStartSource:     _pResult.sleepStartSource,
                        sleepStartOverridden: _pResult.sleepStartOverridden,
                        allSleepStartSources: _pResult.allSleepStartSources,
                        allWakeSources:       _pResult.allWakeSources,
                        wakeConfirmed:        _pResult.wakeConfirmed,
                        wakeOverridden:       _pResult.wakeOverridden,
                        bedWasEmpty:          _pResult.bedWasEmpty,
                        outsideBedEvents:     _pResult.outsideBedEvents,
                        sleepStages:          _pResult.sleepStages,
                        stagesWindowStart:    _pResult.stagesWindowStart,
                        sleepScore:           _pResult.sleepScore,
                        sleepScoreRaw:        _pResult.sleepScoreRaw,
                        sleepScoreCalStatus:  'uncalibrated'
                    };`
);

if (!contentN.includes(oldBlock)) {
    console.error('FEHLER: Alter Block nicht gefunden! Snippet:');
    // Hilfe: zeige was tatsaechlich in der Datei steht
    const idx = contentN.indexOf('sleepOnsetMin = null;');
    if (idx >= 0) console.log('Umgebung:', JSON.stringify(contentN.slice(idx, idx + 200)));
    process.exit(1);
}

const newBlock =
`                    var sleepOnsetMin = null;
                    if (_pResult.sleepWindowStart) {
                        sleepOnsetMin = Math.round((_pResult.sleepWindowStart - new Date(_pResult.sleepWindowStart).setHours(0,0,0,0)) / 60000);
                    }
                    // Per-Person Bett-Praesenz: FP2-Events dieser Person (nur wenn Sensor personTag traegt)
                    var _pFP2Evts = personEvents.filter(function(e) { return e.isFP2Bed; })
                        .sort(function(a,b) { return (a.timestamp||0)-(b.timestamp||0); });
                    var _pBedPres = 0; var _pPresStart2 = null;
                    _pFP2Evts.forEach(function(e) {
                        var v = isActiveValue(e.value) || toPersonCount(e.value) > 0;
                        if (v && !_pPresStart2) { _pPresStart2 = e.timestamp||0; }
                        else if (!v && _pPresStart2) { _pBedPres += ((e.timestamp||0) - _pPresStart2) / 60000; _pPresStart2 = null; }
                    });
                    if (_pPresStart2) _pBedPres += (Date.now() - _pPresStart2) / 60000;
                    var _pBedPresenceMinutes = _pFP2Evts.length > 0 ? Math.round(_pBedPres) : null;
                    // Per-Person Vibration: Trigger-Events dieser Person im Schlaffenster
                    var _pVibWinStart = _pResult.sleepWindowStart || winStart;
                    var _pVibWinEnd   = _pResult.sleepWindowEnd   || winEnd;
                    var _pVibTrigEvts = personEvents.filter(function(e) {
                        if (!e.isVibrationBed || e.isVibrationStrength) return false;
                        var v = isActiveValue(e.value) || toPersonCount(e.value) > 0;
                        if (!v) return false;
                        var ts = e.timestamp || 0;
                        if (_pVibWinStart && _pVibWinEnd) return ts >= _pVibWinStart && ts <= _pVibWinEnd;
                        var hr = new Date(ts).getHours(); return hr >= 22 || hr < 6;
                    });
                    var _pVibCount = _pVibTrigEvts.length;
                    // Per-Person Vibrations-Staerke im Schlaffenster
                    var _pVibStrSum = 0; var _pVibStrCnt = 0; var _pVibStrMax = 0;
                    personEvents.forEach(function(e) {
                        if (!e.isVibrationStrength) return;
                        var ts = e.timestamp || 0;
                        var inWin = (_pVibWinStart && _pVibWinEnd)
                            ? (ts >= _pVibWinStart && ts <= _pVibWinEnd)
                            : (new Date(ts).getHours() >= 22 || new Date(ts).getHours() < 6);
                        if (!inWin) return;
                        var s = typeof e.value === 'number' ? e.value : parseFloat(e.value);
                        if (isNaN(s) || s <= 0) return;
                        _pVibStrSum += s; _pVibStrCnt++; if (s > _pVibStrMax) _pVibStrMax = s;
                    });
                    result[person] = {
                        nightActivityCount:        nightActivityCount,
                        wakeTimeMin:               wakeTimeMin,
                        sleepOnsetMin:             sleepOnsetMin,
                        nocturiaAttr:              nocturiaAttr,
                        sleepWindowStart:          _pResult.sleepWindowStart,
                        sleepWindowEnd:            _pResult.sleepWindowEnd,
                        wakeSource:                _pResult.wakeSource,
                        wakeConf:                  _pResult.wakeConf,
                        sleepStartSource:          _pResult.sleepStartSource,
                        sleepStartOverridden:      _pResult.sleepStartOverridden,
                        allSleepStartSources:      _pResult.allSleepStartSources,
                        allWakeSources:            _pResult.allWakeSources,
                        wakeConfirmed:             _pResult.wakeConfirmed,
                        wakeOverridden:            _pResult.wakeOverridden,
                        bedWasEmpty:               _pResult.bedWasEmpty,
                        outsideBedEvents:          _pResult.outsideBedEvents,
                        sleepStages:               _pResult.sleepStages,
                        stagesWindowStart:         _pResult.stagesWindowStart,
                        sleepScore:                _pResult.sleepScore,
                        sleepScoreRaw:             _pResult.sleepScoreRaw,
                        sleepScoreCalStatus:       'uncalibrated',
                        bedPresenceMinutes:        _pBedPresenceMinutes,
                        nightVibrationCount:       _pVibCount > 0 ? _pVibCount : null,
                        nightVibrationStrengthAvg: _pVibStrCnt > 0 ? Math.round(_pVibStrSum / _pVibStrCnt) : null,
                        nightVibrationStrengthMax: _pVibStrCnt > 0 ? _pVibStrMax : null
                    };`;

// Ersetzen (in normalisierter Variante, dann zurueckschreiben mit Original-Zeilenenden)
const newContentN = contentN.replace(oldBlock, newBlock);
if (newContentN === contentN) {
    console.error('FEHLER: Replace hat nichts veraendert!');
    process.exit(1);
}

// Zeilenenden aus Originalinhalt wiederherstellen (CRLF wenn original CRLF)
const usesCRLF = content.includes('\r\n');
const finalContent = usesCRLF ? newContentN.replace(/\n/g, '\r\n') : newContentN;

fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('OK: Backend erfolgreich gepatcht (' + (usesCRLF ? 'CRLF' : 'LF') + ')');
