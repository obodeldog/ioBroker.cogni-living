/**
 * Fix: Stufe 3 INAKTIV nach Adapter-Neustart
 * 
 * Root-Cause: saveDailyHistory ruft Python nur bei intimacyEvents.length > 0 auf.
 * Nach Neustart: heute 0 Events -> Python nie aufgerufen -> pyClassifier=null ins JSON.
 * 
 * Fix A: Bedingung entfernen (wie in reanalyzeSexDay seit v0.33.167)
 * Fix B: Wenn Python trotzdem null (Timeout/nicht bereit): bestehende pyClassifier-Info aus JSON erhalten
 */
const fs = require('fs');
let src = fs.readFileSync('src/main.js', 'utf8');

// -----------------------------------------------------------------------
// FIX A: intimacyEvents.length > 0 Bedingung aus Python-Call entfernen
// -----------------------------------------------------------------------
const OLD_CONDITION = 'if (intimacyEvents.length > 0 && _sexTD.length >= 3) {';
const NEW_CONDITION = 'if (_sexTD.length >= 3) { // Python auch bei 0 Events (Stufe-3-Status aktuell halten, Modell trainieren)';
if (!src.includes(OLD_CONDITION)) { console.error('FEHLER Fix A: Bedingung nicht gefunden'); process.exit(1); }
src = src.replace(OLD_CONDITION, NEW_CONDITION);
console.log('Fix A OK: Python-Call-Bedingung');

// -----------------------------------------------------------------------
// FIX B: pyClassifier-Fallback aus bestehender JSON wenn Python null zurückgibt
// -----------------------------------------------------------------------
// Find the unique line that assigns _calibInfo.pyClassifier after the Python call
const OLD_CALIBINFO = '_calibInfo.pyClassifier = _pyClassInfo ? { trained: _pyClassInfo.trained||false, n: _pyClassInfo.n_samples||0, counts: _';
if (!src.includes(OLD_CALIBINFO)) { console.error('FEHLER Fix B: pyClassifier-Zuweisung nicht gefunden'); process.exit(1); }

// Find the full line (up to end of line)
const idx = src.indexOf(OLD_CALIBINFO);
const lineEnd = src.indexOf('\n', idx);
const fullLine = src.substring(idx, lineEnd);
console.log('Fix B - gefundene Zeile:', fullLine.substring(0, 100) + '...');

const NEW_CALIBINFO = fullLine + '\r\n' +
    '                    // Fallback: bestehende pyClassifier-Info erhalten wenn Python nicht verfuegbar war (Adapter-Neustart-Schutz)\r\n' +
    '                    if (!_calibInfo.pyClassifier) { try { var _pyFbPath=path.join(utils.getAbsoluteDefaultDataDir(),\'cogni-living\',\'history\',dateStr+\'.json\'); if(fs.existsSync(_pyFbPath)){var _pyFbJ=JSON.parse(fs.readFileSync(_pyFbPath,\'utf8\'));if(_pyFbJ.sexCalibInfo&&_pyFbJ.sexCalibInfo.pyClassifier&&_pyFbJ.sexCalibInfo.pyClassifier.trained){_calibInfo.pyClassifier=_pyFbJ.sexCalibInfo.pyClassifier;this.log.debug(\'[OC-SEX] pyClassifier aus JSON erhalten (Neustart-Schutz, trained=\'+_calibInfo.pyClassifier.trained+\')\');}} } catch(_pyFbE){this.log.debug(\'[OC-SEX] pyClassifier-Fallback: \'+_pyFbE.message);} }';

src = src.replace(fullLine, NEW_CALIBINFO);
console.log('Fix B OK: pyClassifier-Fallback eingefuegt');

fs.writeFileSync('src/main.js', src, 'utf8');
console.log('\nsrc/main.js gespeichert.');
