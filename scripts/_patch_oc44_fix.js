// OC-44 Fix: Nur feuern wenn Person echte Vib-Events im Schlaffenster hat
// Verhindert: Anni (nicht im Bett) bekommt bedWasEmpty=false durch global fallback
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'main.js');
let src = fs.readFileSync(filePath, 'utf8');

// The fix: add an early-return guard inside OC-44 block right after _pFbVibDet is computed
// If person has 0 vibration events in the global window → skip OC-44 → bedWasEmpty stays true
const OLD = [
    '                        var _pFbVibDet = sleepSearchEvents.filter(function(e) {',
    '                            return (!e.personTag || e.personTag === person)',
    '                                && e.isVibrationBed && !e.isVibrationStrength',
    '                                && (e.timestamp||0) >= _fbStart && (e.timestamp||0) <= _fbEnd',
    '                                && (isActiveValue(e.value) || toPersonCount(e.value) > 0);',
    '                        });',
    '                        var _pFbVibStr = sleepSearchEvents.filter(function(e) {'
].join('\n');

const NEW = [
    '                        var _pFbVibDet = sleepSearchEvents.filter(function(e) {',
    '                            return (!e.personTag || e.personTag === person)',
    '                                && e.isVibrationBed && !e.isVibrationStrength',
    '                                && (e.timestamp||0) >= _fbStart && (e.timestamp||0) <= _fbEnd',
    '                                && (isActiveValue(e.value) || toPersonCount(e.value) > 0);',
    '                        });',
    '                        // [OC-44 Guard] Kein Vib-Nachweis → Person war nicht im Bett → bedWasEmpty bleibt true',
    '                        if (_pFbVibDet.length === 0) {',
    '                            _self.log.info(\'[OC-44] \' + person + \': kein Vib-Nachweis im globalen Fenster → bedWasEmpty bleibt true (Bett war leer)\');',
    '                        } else {',
    '                        var _pFbVibStr = sleepSearchEvents.filter(function(e) {'
].join('\n');

const cnt = src.split(OLD).length - 1;
console.log('OC-44 anchor count:', cnt);
if (cnt !== 1) { console.error('Anchor not unique!'); process.exit(1); }
src = src.replace(OLD, NEW);

// Now find the closing brace of the OC-44 block (after _self.log.info('[OC-44]'))
// and add a closing brace for the new else block
const CLOSE_OLD = [
    "                        _self.log.info('[OC-44] ' + person + ': Stages-Fallback ? globales Fenster '",
    "                            + new Date(_fbStart).toLocaleTimeString() + '-' + new Date(_fbEnd).toLocaleTimeString()",
    "                            + ', ' + _fbStages.length + ' Slots, Score=' + _pResult.sleepScore",
    "                            + ((_pFbVibDet.length > 0) ? ', VibDet=' + _pFbVibDet.length : ' (kein Vibsensor)'));",
    '                    }'
].join('\n');

const CLOSE_NEW = [
    "                        _self.log.info('[OC-44] ' + person + ': Stages-Fallback ? globales Fenster '",
    "                            + new Date(_fbStart).toLocaleTimeString() + '-' + new Date(_fbEnd).toLocaleTimeString()",
    "                            + ', ' + _fbStages.length + ' Slots, Score=' + _pResult.sleepScore",
    "                            + ', VibDet=' + _pFbVibDet.length);",
    '                        } // end else (_pFbVibDet.length > 0)',
    '                    }'
].join('\n');

const cnt2 = src.split(CLOSE_OLD).length - 1;
console.log('OC-44 close anchor count:', cnt2);
if (cnt2 !== 1) { console.error('Close anchor not unique!'); process.exit(1); }
src = src.replace(CLOSE_OLD, CLOSE_NEW);

fs.writeFileSync(filePath, src, 'utf8');
console.log('OC-44 fix applied.');
