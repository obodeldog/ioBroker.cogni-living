// Fix: Apply missing C3, C5, C6, C7, C8 patches to src/main.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'main.js');
let src = fs.readFileSync(filePath, 'utf8');

function replace1(oldStr, newStr, label) {
    const cnt = src.split(oldStr).length - 1;
    if (cnt !== 1) { console.error(label + ' anchor count=' + cnt + ' (expected 1)'); process.exit(1); }
    src = src.replace(oldStr, newStr);
    console.log(label + ' done');
}

// C3: slotDet === 0 → slotDet <= adaptiveTrigThr in computePersonSleep stage loop
const C3_OLD = 'if (slotDet === 0)                                                                              { consQuiet++; stage = consQuiet >= 5 ? \'deep\' : \'light\'; }';
const C3_NEW = 'if (slotDet <= adaptiveTrigThr)                                                                 { consQuiet++; stage = consQuiet >= 5 ? \'deep\' : \'light\'; }';
replace1(C3_OLD, C3_NEW, 'C3');

// C5: Declare _vcRollingCache before global computePersonSleep call
// Use a unique anchor: the comment before var _gR
const C5_OLD = '            // Alle Einschlafzeit-Kandidaten via computePersonSleep (Single-Source-of-Truth)\n            var _gR = computePersonSleep({';
const C5_NEW = '            // OC-VIB-CAL: Rolling-Kalibrierung aus Vornacht lesen (fuer stabile Schwellen)\n            var _vcRollingCache = null;\n            try {\n                var _vcRS = await this.getStateAsync(\'analysis.health.vibCalibData\');\n                if (_vcRS && _vcRS.val) { var _vcRD = JSON.parse(_vcRS.val); _vcRollingCache = (_vcRD && _vcRD.rolling) ? _vcRD.rolling : null; }\n            } catch(_vcReadErr) {}\n\n            // Alle Einschlafzeit-Kandidaten via computePersonSleep (Single-Source-of-Truth)\n            var _gR = computePersonSleep({';
replace1(C5_OLD, C5_NEW, 'C5');

// C6: Add adaptiveTrigThr + vibCalibRolling to global computePersonSleep call
const C6_OLD = '                adaptiveVib:  (this.config.adaptiveVibThresholds !== false),\n                log:          this.log\n            });';
const C6_NEW = '                adaptiveVib:  (this.config.adaptiveVibThresholds !== false),\n                adaptiveTrigThr: (_vcRollingCache && _vcRollingCache.global && this.config.adaptiveVibThresholds !== false) ? (_vcRollingCache.global.trigThr || 0) : 0,\n                vibCalibRolling: (_vcRollingCache && _vcRollingCache.global && this.config.adaptiveVibThresholds !== false && (_vcRollingCache.global.status === \'calibrating\' || _vcRollingCache.global.status === \'calibrated\')) ? _vcRollingCache.global : null,\n                log:          this.log\n            });';
replace1(C6_OLD, C6_NEW, 'C6');

// C7: Add _gTrigThr variable in global stage loop (before deepSec init)
// Find unique context: right after closing of OC-VIB-CAL adaptive block, before deepSec
const C7_OLD = '                }\n                var deepSec = 0, lightSec = 0, remSec = 0, wakeSec = 0;\n                var consecutiveQuiet = 0;';
const C7_NEW = '                }\n                // OC-VIB-CAL: Trigger-Schwelle fuer Tiefschlaf aus Rolling-Cache\n                var _gTrigThr = (_vcRollingCache && _vcRollingCache.global && this.config.adaptiveVibThresholds !== false) ? (_vcRollingCache.global.trigThr || 0) : 0;\n                // Rolling Wake/REM override fuer globale Stage-Berechnung\n                if (_vcRollingCache && _vcRollingCache.global && this.config.adaptiveVibThresholds !== false &&\n                    (_vcRollingCache.global.status === \'calibrating\' || _vcRollingCache.global.status === \'calibrated\') &&\n                    _vcRollingCache.global.wakeThresh) {\n                    _gWakeThr = _vcRollingCache.global.wakeThresh;\n                    _gRemUp   = _vcRollingCache.global.remUp   || _gRemUp;\n                    _gRemLow  = _vcRollingCache.global.remLow  || _gRemLow;\n                }\n                var deepSec = 0, lightSec = 0, remSec = 0, wakeSec = 0;\n                var consecutiveQuiet = 0;';
replace1(C7_OLD, C7_NEW, 'C7');

// C8: global slotDet === 0 → slotDet <= _gTrigThr
const C8_OLD = "                    if (slotDet === 0) {\n                        consecutiveQuiet++;\n                        stage = consecutiveQuiet >= 5 ? 'deep' : 'light';";
const C8_NEW = "                    if (slotDet <= _gTrigThr) {\n                        consecutiveQuiet++;\n                        stage = consecutiveQuiet >= 5 ? 'deep' : 'light';";
replace1(C8_OLD, C8_NEW, 'C8');

fs.writeFileSync(filePath, src, 'utf8');
console.log('All missing patches applied and written.');
