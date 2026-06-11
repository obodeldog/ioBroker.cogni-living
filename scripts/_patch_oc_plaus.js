// OC-PLAUS: Plausibilitaets-Check fuer Schlafphasen-Analyse
// Verhindert: Person nicht im Bett aber dennoch Schlafanalyse durch sparsame Sensor-Events
// Bedingung 1 (Dichte): < 5 Trigger-Events bei > 2h Fenster
// Bedingung 2 (Verteilung): > 70% Tiefschlaf UND 0% REM-Schlaf (physiologisch unmoeglich)
// Beide muessen zutreffen (AND) um false positives zu minimieren
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'main.js');
let src = fs.readFileSync(filePath, 'utf8');

const OLD = '                    result[person] = {';

const NEW = [
    '                    // [OC-PLAUS] Plausibilitaets-Check: Stages trotz sparsamster Vib-Daten → wahrsch. nicht im Bett',
    '                    // Bedingung 1 (Dichte): Fenster >= 2h aber < 5 Trigger-Events → Sensor kaum ausgeloest',
    '                    // Bedingung 2 (Verteilung): > 70% Tiefschlaf + 0% REM → physiologisch unplausibel',
    '                    // Beide muessen zutreffen (AND) → false-positive-Schutz fuer ruhige Schlaefernaechte',
    '                    if (!_pResult.bedWasEmpty && (_pResult.sleepStages||[]).length >= 20) {',
    '                        var _pPlausWinH = (_pResult.stagesWindowEnd && _pResult.stagesWindowStart)',
    '                            ? (_pResult.stagesWindowEnd - _pResult.stagesWindowStart) / 3600000 : 0;',
    '                        var _pPlausDensityFail = _pPlausWinH >= 2 && _pVibCount < 5;',
    '                        var _pPlausStages = _pResult.sleepStages || [];',
    '                        var _pPlausDeep = _pPlausStages.filter(function(s) { return (s.s||s) === \'deep\'; }).length;',
    '                        var _pPlausRem  = _pPlausStages.filter(function(s) { return (s.s||s) === \'rem\';  }).length;',
    '                        var _pPlausDistFail = (_pPlausDeep / _pPlausStages.length > 0.70) && _pPlausRem === 0;',
    '                        if (_pPlausDensityFail && _pPlausDistFail) {',
    '                            _self.log.info(\'[OC-PLAUS] \' + person + \': Stages widerrufen – zu wenige Events (\' + _pVibCount + \' in \' + Math.round(_pPlausWinH*10)/10 + \'h) + \' + Math.round(_pPlausDeep/_pPlausStages.length*100) + \'% Tief 0% REM → bedWasEmpty=true\');',
    '                            _pResult.bedWasEmpty    = true;',
    '                            _pResult.sleepStages    = [];',
    '                            _pResult.stagesWindowStart = null;',
    '                            _pResult.stagesWindowEnd   = null;',
    '                            _pResult.sleepScore     = null;',
    '                            _pResult.sleepScoreRaw  = null;',
    '                        }',
    '                    }',
    '',
    '                    result[person] = {'
].join('\n');

const cnt = src.split(OLD).length - 1;
console.log('Anchor count:', cnt);
if (cnt !== 1) { console.error('Anchor not unique!'); process.exit(1); }

src = src.replace(OLD, NEW);
fs.writeFileSync(filePath, src, 'utf8');
console.log('OC-PLAUS patch applied.');
