// Patch: vibSensorUnavailable in personData-Output (v0.33.332)
const fs = require('fs');
const FP = 'C:/ioBroker/ioBroker.cogni-living/src/main.js';
let src = fs.readFileSync(FP, 'utf8');

const OLD =
'                        bedWasEmpty:               _pResult.bedWasEmpty,\n' +
'                        outsideBedEvents:          _pResult.outsideBedEvents,';

const NEW =
'                        bedWasEmpty:               _pResult.bedWasEmpty,\n' +
'                        vibSensorUnavailable:      _pResult.vibSensorUnavailable || false,\n' +
'                        outsideBedEvents:          _pResult.outsideBedEvents,';

if (src.indexOf(OLD) === -1) { console.error('FEHLER: OLD nicht gefunden!'); process.exit(1); }
if (src.indexOf(NEW) !== -1) { console.error('WARN: bereits vorhanden.'); process.exit(0); }
src = src.replace(OLD, NEW);
fs.writeFileSync(FP, src, 'utf8');
console.log('OK: vibSensorUnavailable in Output eingefuegt.');
