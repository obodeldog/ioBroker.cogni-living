// OC-PLAUS v2: Near-Zero-Guard + REM-Schwelle 0% -> <2%
// Patches src/main.js
'use strict';
const fs   = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'src', 'main.js');
let txt = fs.readFileSync(p, 'utf8');

if (txt.indexOf('[OC-PLAUS-NZ]') !== -1) {
    console.log('SKIP: schon gepatcht'); process.exit(0);
}

const eol = txt.indexOf('\r\n') !== -1 ? '\r\n' : '\n';

// Aktueller OC-PLAUS-Block (exakt so wie er im Code steht)
const OLD = [
    '                    // [OC-PLAUS] Plausibilitaets-Check: Stages trotz sparsamster Vib-Daten  wahrsch. nicht im Bett',
    '                    // Bedingung 1 (Dichte): Fenster >= 2h aber < 5 Trigger-Events  Sensor kaum ausgeloest',
    '                    // Bedingung 2 (Verteilung): > 70% Tiefschlaf + 0% REM  physiologisch unplausibel',
    '                    // Beide muessen zutreffen (AND)  false-positive-Schutz fuer ruhige Schlaefernaechte',
    '                    if (!_pResult.bedWasEmpty && (_pResult.sleepStages||[]).length >= 20) {',
    '                        var _pPlausWinH = (_pResult.stagesWindowEnd && _pResult.stagesWindowStart)',
    '                            ? (_pResult.stagesWindowEnd - _pResult.stagesWindowStart) / 3600000 : 0;',
    '                        var _pPlausDensityFail = _pPlausWinH >= 2 && _pVibCount < 5;',
    '                        var _pPlausStages = _pResult.sleepStages || [];',
    '                        var _pPlausDeep = _pPlausStages.filter(function(s) { return (s.s||s) === \'deep\'; }).length;',
    '                        var _pPlausRem  = _pPlausStages.filter(function(s) { return (s.s||s) === \'rem\';  }).length;',
    '                        var _pPlausDistFail = (_pPlausDeep / _pPlausStages.length > 0.70) && _pPlausRem === 0;',
    '                        if (_pPlausDensityFail && _pPlausDistFail) {',
    '                            _self.log.info(\'[OC-PLAUS] \' + person + \': Stages widerrufen - zu wenige Events (\' + _pVibCount + \' in \' + Math.round(_pPlausWinH*10)/10 + \'h) + \' + Math.round(_pPlausDeep/_pPlausStages.length*100) + \'% Tief 0% REM  bedWasEmpty=true\');',
    '                            _pResult.bedWasEmpty    = true;',
    '                            _pResult.sleepStages    = [];',
    '                            _pResult.stagesWindowStart = null;',
    '                            _pResult.stagesWindowEnd   = null;',
    '                            _pResult.sleepScore     = null;',
    '                            _pResult.sleepScoreRaw  = null;',
    '                        }',
    '                    }'
].join(eol);

// Neuer Block: OC-PLAUS-NZ (Near-Zero) + OC-PLAUS v2 (REM < 2%)
const NEW = [
    '                    // [OC-PLAUS-NZ] Near-Zero-Guard: Wenn < 2 Trigger-Events in > 3h Schlaffenster',
    '                    // = physikalisch eindeutig kein echter Schlaef. Ein echter Schlafer hat immer',
    '                    // mehrere Umdreh-Impulse. Prueft VOR OC-PLAUS (unabhaengige Bedingung).',
    '                    // Forensik 12.06.2026: Anni hatte 1 Trigger in 7h46min durch Uebertragungsvibration',
    '                    // von Marc (Marc=24 Triggers, Anni=1 Trigger  Anni war nicht da).',
    '                    if (!_pResult.bedWasEmpty) {',
    '                        var _pNzWinH = (_pResult.sleepWindowEnd && _pResult.sleepWindowStart)',
    '                            ? (_pResult.sleepWindowEnd - _pResult.sleepWindowStart) / 3600000 : 0;',
    '                        if (_pVibCount < 2 && _pNzWinH > 3) {',
    '                            _self.log.info(\'[OC-PLAUS-NZ] \' + person + \': nur \' + _pVibCount + \' Trigger in \' + Math.round(_pNzWinH * 10) / 10 + \'h  Bett war leer (Near-Zero-Guard)\');',
    '                            _pResult.bedWasEmpty    = true;',
    '                            _pResult.sleepStages    = [];',
    '                            _pResult.stagesWindowStart = null;',
    '                            _pResult.stagesWindowEnd   = null;',
    '                            _pResult.sleepScore     = null;',
    '                            _pResult.sleepScoreRaw  = null;',
    '                        }',
    '                    }',
    '',
    '                    // [OC-PLAUS] Plausibilitaets-Check: Stages trotz sparsamster Vib-Daten  wahrsch. nicht im Bett',
    '                    // Bedingung 1 (Dichte): Fenster >= 2h aber < 5 Trigger-Events  Sensor kaum ausgeloest',
    '                    // Bedingung 2 (Verteilung): > 70% Tiefschlaf + < 2% REM  physiologisch unplausibel',
    '                    //   (v2: 0% -> <2%, fuer Naechte wo Rauschen eine kurze Scheinphase erzeugt, z.B. Anni 1,1%)',
    '                    // Beide muessen zutreffen (AND)  false-positive-Schutz fuer ruhige Schlaefernaechte',
    '                    if (!_pResult.bedWasEmpty && (_pResult.sleepStages||[]).length >= 20) {',
    '                        var _pPlausWinH = (_pResult.stagesWindowEnd && _pResult.stagesWindowStart)',
    '                            ? (_pResult.stagesWindowEnd - _pResult.stagesWindowStart) / 3600000 : 0;',
    '                        var _pPlausDensityFail = _pPlausWinH >= 2 && _pVibCount < 5;',
    '                        var _pPlausStages = _pResult.sleepStages || [];',
    '                        var _pPlausDeep = _pPlausStages.filter(function(s) { return (s.s||s) === \'deep\'; }).length;',
    '                        var _pPlausRem  = _pPlausStages.filter(function(s) { return (s.s||s) === \'rem\';  }).length;',
    '                        var _pPlausRemPct = _pPlausStages.length > 0 ? _pPlausRem / _pPlausStages.length : 0;',
    '                        var _pPlausDistFail = (_pPlausDeep / _pPlausStages.length > 0.70) && (_pPlausRemPct < 0.02);',
    '                        if (_pPlausDensityFail && _pPlausDistFail) {',
    '                            _self.log.info(\'[OC-PLAUS] \' + person + \': Stages widerrufen - zu wenige Events (\' + _pVibCount + \' in \' + Math.round(_pPlausWinH*10)/10 + \'h) + \' + Math.round(_pPlausDeep/_pPlausStages.length*100) + \'% Tief \' + Math.round(_pPlausRemPct*100) + \'% REM  bedWasEmpty=true\');',
    '                            _pResult.bedWasEmpty    = true;',
    '                            _pResult.sleepStages    = [];',
    '                            _pResult.stagesWindowStart = null;',
    '                            _pResult.stagesWindowEnd   = null;',
    '                            _pResult.sleepScore     = null;',
    '                            _pResult.sleepScoreRaw  = null;',
    '                        }',
    '                    }'
].join(eol);

const idx = txt.indexOf(OLD);
if (idx === -1) { console.error('FAIL: Marker nicht gefunden'); process.exit(1); }
if (txt.indexOf(OLD, idx + 1) !== -1) { console.error('FAIL: Marker nicht eindeutig'); process.exit(1); }

txt = txt.slice(0, idx) + NEW + txt.slice(idx + OLD.length);
fs.writeFileSync(p, txt, 'utf8');
console.log('OK: OC-PLAUS-NZ + REM-Schwelle 0% -> <2% eingefuegt');
