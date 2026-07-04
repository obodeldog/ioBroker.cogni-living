// Patch: OC-SENSOR-FALLBACK (v0.33.332)
// FP2-Rettungsanker im per-Person OC-44-Pfad: Wenn VIB ausgefaellt, aber FP2 die
// Person im Schlaffenster bestaetigt -> bedWasEmpty=false, Zeiten ohne Stages.
const fs = require('fs');
const FP = 'C:/ioBroker/ioBroker.cogni-living/src/main.js';
let src = fs.readFileSync(FP, 'utf8');

const A = '\u2192'; // Pfeil-Zeichen

const OLD =
'                        // [OC-44 Guard] Kein Vib-Nachweis ' + A + ' Person war nicht im Bett ' + A + ' bedWasEmpty bleibt true\n' +
'                        if (_pFbVibDet.length === 0) {\n' +
"                            _self.log.info('[OC-44] ' + person + ': kein Vib-Nachweis im globalen Fenster " + A + " bedWasEmpty bleibt true (Bett war leer)');\n" +
'                        } else {';

const NEW =
'                        // [OC-44 Guard] Kein Vib-Nachweis ' + A + ' Person war nicht im Bett ' + A + ' bedWasEmpty bleibt true\n' +
'                        if (_pFbVibDet.length === 0) {\n' +
'                            // [OC-SENSOR-FALLBACK] VIB-Sensor lieferte keine Daten (Ausfall/leere Batterie/\n' +
'                            // Zigbee-Stoerung). Rettungsanker: Wenn FP2 die Person im globalen Schlaffenster\n' +
'                            // nachweislich bestaetigt, war sie im Bett ' + A + ' bedWasEmpty=false + Zeiten anzeigen,\n' +
'                            // aber KEINE Schlafphasen (Stages brauchen VIB-Daten). Flag vibSensorUnavailable\n' +
'                            // steuert den Frontend-Hinweis. Sensor-neutral: getaggter oder ungetaggter FP2.\n' +
'                            var _pFbFp2 = sleepSearchEvents.filter(function(e) {\n' +
'                                return (!e.personTag || e.personTag === person)\n' +
'                                    && e.isFP2Bed && isActiveValue(e.value)\n' +
'                                    && (e.timestamp||0) >= _fbStart && (e.timestamp||0) <= _fbEnd;\n' +
'                            });\n' +
'                            if (_pFbFp2.length > 0) {\n' +
'                                _pResult.bedWasEmpty         = false;\n' +
'                                _pResult.vibSensorUnavailable = true;\n' +
'                                _pResult.sleepStages         = [];\n' +
'                                _pResult.stagesWindowStart   = null;\n' +
'                                _pResult.stagesWindowEnd     = null;\n' +
'                                _pResult.sleepWindowStart    = _fbStart;\n' +
'                                _pResult.sleepWindowEnd      = _fbEnd;\n' +
'                                _pResult.sleepScore          = null;\n' +
'                                _pResult.sleepScoreRaw       = null;\n' +
"                                _pResult.wakeSource          = _pResult.wakeSource || 'fp2_fallback';\n" +
"                                _self.log.warn('[OC-SENSOR-FALLBACK] ' + person + ': VIB-Sensor ohne Daten, aber FP2 bestaetigt Anwesenheit ('\n" +
"                                    + _pFbFp2.length + ' Events) im Fenster '\n" +
"                                    + new Date(_fbStart).toLocaleTimeString() + '-' + new Date(_fbEnd).toLocaleTimeString()\n" +
"                                    + ' " + A + " Zeiten OHNE Schlafphasen (VIB nicht verfuegbar)');\n" +
'                            } else {\n' +
"                                _self.log.info('[OC-44] ' + person + ': kein Vib-Nachweis im globalen Fenster " + A + " bedWasEmpty bleibt true (Bett war leer)');\n" +
'                            }\n' +
'                        } else {';

if (src.indexOf(OLD) === -1) {
    console.error('FEHLER: OLD-String nicht gefunden!');
    process.exit(1);
}
if (src.indexOf(NEW) !== -1) {
    console.error('WARN: NEW bereits vorhanden - abbruch (idempotent).');
    process.exit(0);
}
src = src.replace(OLD, NEW);
fs.writeFileSync(FP, src, 'utf8');
console.log('OK: OC-SENSOR-FALLBACK Rettungsanker eingefuegt.');
