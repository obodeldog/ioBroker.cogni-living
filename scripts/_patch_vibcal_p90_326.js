/**
 * PATCH v0.33.326 — OC-VIB-CAL-P90-FIX
 * 
 * Kalibrierungs-Bug: nightVibrationStrengthMax enthält auch Aufsteh-Bewegungen
 * (z.B. 06:43 Uhr Stärke 71) die im Schlaffenster liegen aber keine Schlaf-Events sind.
 * Diese inflationieren P90 → Wake-Schwelle 72 statt ~51.
 *
 * Fix: Pro Nacht auch P90 der individuellen Stärke-Events speichern (vibStrP90).
 * Kalibrierung nutzt vibStrP90 statt vibStrMax für Schwellen-Berechnung.
 * Fallback auf vibStrMax für ältere Kalibrierungsdaten ohne vibStrP90-Feld.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'main.js');
let src = fs.readFileSync(filePath, 'utf8');
let changed = 0;

function patch(OLD, NEW, label) {
    if (!src.includes(OLD)) { console.error('NICHT GEFUNDEN: ' + label); process.exit(1); }
    src = src.replace(OLD, NEW);
    changed++;
    console.log('OK: ' + label);
}

// --- FIX 1: Per-Person VibStr Berechnung: _pVibStrArr hinzufügen ---
patch(
    'var _pVibStrSum = 0; var _pVibStrCnt = 0; var _pVibStrMax = 0;\n                    personEvents.forEach(function(e) {\n                        if (!e.isVibrationStrength) return;\n                        var ts = e.timestamp || 0;\n                        var inWin = (_pVibWinStart && _pVibWinEnd)\n                            ? (ts >= _pVibWinStart && ts <= _pVibWinEnd)\n                            : (new Date(ts).getHours() >= 22 || new Date(ts).getHours() < 6);\n                        if (!inWin) return;\n                        var s = typeof e.value === \'number\' ? e.value : parseFloat(e.value);\n                        if (isNaN(s) || s <= 0) return;\n                        _pVibStrSum += s; _pVibStrCnt++; if (s > _pVibStrMax) _pVibStrMax = s;\n                    });',
    'var _pVibStrSum = 0; var _pVibStrCnt = 0; var _pVibStrMax = 0; var _pVibStrArr = [];\n                    personEvents.forEach(function(e) {\n                        if (!e.isVibrationStrength) return;\n                        var ts = e.timestamp || 0;\n                        var inWin = (_pVibWinStart && _pVibWinEnd)\n                            ? (ts >= _pVibWinStart && ts <= _pVibWinEnd)\n                            : (new Date(ts).getHours() >= 22 || new Date(ts).getHours() < 6);\n                        if (!inWin) return;\n                        var s = typeof e.value === \'number\' ? e.value : parseFloat(e.value);\n                        if (isNaN(s) || s <= 0) return;\n                        _pVibStrSum += s; _pVibStrCnt++; if (s > _pVibStrMax) _pVibStrMax = s; _pVibStrArr.push(s);\n                    });\n                    // [OC-VIB-CAL-P90] P90 der Schlaf-Stärken pro Nacht (robuster als Max gegen Aufsteh-Ausreißer)\n                    var _pVibStrP90 = null;\n                    if (_pVibStrArr.length >= 3) { var _pVibSorted = _pVibStrArr.slice().sort(function(a,b){return a-b;}); _pVibStrP90 = _pVibSorted[Math.floor(_pVibSorted.length * 0.9)]; }',
    'Fix 1: _pVibStrArr + P90 Berechnung'
);

// --- FIX 2: nightVibrationStrengthP90 zu personData hinzufügen ---
patch(
    'nightVibrationStrengthMax: _pVibStrCnt > 0 ? _pVibStrMax : null,',
    'nightVibrationStrengthMax: _pVibStrCnt > 0 ? _pVibStrMax : null,\n                    nightVibrationStrengthP90: _pVibStrP90,',
    'Fix 2: nightVibrationStrengthP90 in personData'
);

// --- FIX 3: vibStrP90 in Nacht-Buffer speichern ---
patch(
    '_vcNight.persons[pName] = { trigRatePerSlot: pTrigRate2, vibStrMax: pd.nightVibrationStrengthMax || null };',
    '_vcNight.persons[pName] = { trigRatePerSlot: pTrigRate2, vibStrMax: pd.nightVibrationStrengthMax || null, vibStrP90: pd.nightVibrationStrengthP90 || null };',
    'Fix 3: vibStrP90 in Nacht-Buffer'
);

// --- FIX 4: Kalibrierung nutzt vibStrP90 statt vibStrMax ---
patch(
    'var pMxs=_vcData2.nights.map(function(n){return(n.persons&&n.persons[pName])?n.persons[pName].vibStrMax:null;}).filter(function(v){return typeof v==="number"&&v>0;});',
    '// [OC-VIB-CAL-P90-FIX] vibStrP90 bevorzugen (P90 pro Nacht), Fallback auf vibStrMax fuer aeltere Buffer-Daten\n                    var pMxs=_vcData2.nights.map(function(n){return(n.persons&&n.persons[pName])?(n.persons[pName].vibStrP90||n.persons[pName].vibStrMax):null;}).filter(function(v){return typeof v==="number"&&v>0;});',
    'Fix 4: pMxs nutzt vibStrP90 mit vibStrMax Fallback'
);

// --- FIX 5: sensorHint Flag in Rolling-Ausgabe ---
patch(
    'var _pSt=pRts.length>=7?"calibrated":pRts.length>=3?"calibrating":"uncalibrated";\n                    _vcRoll2.persons[pName]={trigThr:pThrR,avgTrigRate:pAvgRt,wakeThresh:pWkR,remUp:pRuR,remLow:pRlR,nightCount:pRts.length,status:pSt',
    'var _pSt=pRts.length>=7?"calibrated":pRts.length>=3?"calibrating":"uncalibrated";\n                    // [OC-VIB-CAL-P90] Sensor-Hinweis wenn Stärke dauerhaft zu schwach für Wake-Erkennung\n                    var _pSensorHint=(pAvgRt!==null&&pAvgRt<0.5&&pP90!==null&&pP90<20&&pRts.length>=5)?\'reposition\':null;\n                    _vcRoll2.persons[pName]={trigThr:pThrR,avgTrigRate:pAvgRt,wakeThresh:pWkR,remUp:pRuR,remLow:pRlR,nightCount:pRts.length,status:pSt,sensorHint:_pSensorHint',
    'Fix 5: sensorHint Flag in Rolling-Ausgabe'
);

fs.writeFileSync(filePath, src);
console.log('\nAlle ' + changed + ' Patches angewendet. src/main.js gespeichert.');
