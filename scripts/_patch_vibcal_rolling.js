// OC-VIB-CAL Rolling Buffer Patch — v0.33.288
// Changes:
// C3: slotDet===0 → adaptiveTrigThr in computePersonSleep stage loop
// C4: vibCalibData state creation
// C5: read rolling cache before global computePersonSleep
// C6: pass rolling to global computePersonSleep
// C7+C8: global stage loop uses _gTrigThr
// C9: pass rolling to per-person computePersonSleep
// C10: write rolling buffer after Garmin calibration

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'main.js');
let src = fs.readFileSync(filePath, 'utf8');
const NL = src.includes('\r\n') ? '\r\n' : '\n';

function replace1(oldStr, newStr, label) {
    const count = src.split(oldStr).length - 1;
    if (count !== 1) { console.error(label + ' anchor occurrences=' + count + ' (expected 1)'); process.exit(1); }
    src = src.replace(oldStr, newStr);
    console.log(label + ' done');
}

// C3: slotDet === 0 → adaptiveTrigThr in computePersonSleep (the consQuiet++ line with many spaces, unique context)
const C3_OLD = 'if (slotDet === 0)                                                                              { consQuiet++; stage = consQuiet >= 5 ? \'deep\' : \'light\'; }';
const C3_NEW = 'if (slotDet <= adaptiveTrigThr)                                                                 { consQuiet++; stage = consQuiet >= 5 ? \'deep\' : \'light\'; }';
replace1(C3_OLD, C3_NEW, 'C3');

// C4: vibCalibData state creation after sleepCalibrationLog definition
const C4_OLD = "                def: '[]'\n            },\n            native: {}\n        });\n        await this.setObjectNotExistsAsync('analysis.sleep.startOverride',";
const C4_NEW = "                def: '[]'\n            },\n            native: {}\n        });\n        await this.setObjectNotExistsAsync('analysis.health.vibCalibData', {\n            type: 'state',\n            common: { name: 'OC-VIB-CAL Rolling Calibration Buffer (JSON)', type: 'string', role: 'json', read: true, write: false, def: '{}' },\n            native: {}\n        });\n        await this.setObjectNotExistsAsync('analysis.sleep.startOverride',";
replace1(C4_OLD, C4_NEW, 'C4');

// C5: Read rolling cache before global computePersonSleep
const C5_OLD = "            } catch(_gse) { this.log.debug('[SleepStart] Garmin nicht lesbar: ' + _gse.message); }\n\n            // Alle Einschlafzeit-Kandidaten via computePersonSleep (Single-Source-of-Truth)\n            var _gR = computePersonSleep({";
const C5_NEW = "            } catch(_gse) { this.log.debug('[SleepStart] Garmin nicht lesbar: ' + _gse.message); }\n\n            // OC-VIB-CAL: Rolling-Kalibrierung aus Vornacht lesen (fuer stabile Schwellen)\n            var _vcRollingCache = null;\n            try {\n                var _vcRS = await this.getStateAsync('analysis.health.vibCalibData');\n                if (_vcRS && _vcRS.val) { var _vcRD = JSON.parse(_vcRS.val); _vcRollingCache = (_vcRD && _vcRD.rolling) ? _vcRD.rolling : null; }\n            } catch(_vcReadErr) {}\n\n            // Alle Einschlafzeit-Kandidaten via computePersonSleep (Single-Source-of-Truth)\n            var _gR = computePersonSleep({";
replace1(C5_OLD, C5_NEW, 'C5');

// C6: Pass rolling to global computePersonSleep
const C6_OLD = "                adaptiveVib:  (this.config.adaptiveVibThresholds !== false),\n                log:          this.log\n            });";
const C6_NEW = "                adaptiveVib:  (this.config.adaptiveVibThresholds !== false),\n                adaptiveTrigThr: (_vcRollingCache && _vcRollingCache.global && this.config.adaptiveVibThresholds !== false) ? (_vcRollingCache.global.trigThr || 0) : 0,\n                vibCalibRolling: (_vcRollingCache && _vcRollingCache.global && this.config.adaptiveVibThresholds !== false && (_vcRollingCache.global.status === 'calibrating' || _vcRollingCache.global.status === 'calibrated')) ? _vcRollingCache.global : null,\n                log:          this.log\n            });";
replace1(C6_OLD, C6_NEW, 'C6');

// C7: Add _gTrigThr variable in global stage loop (after OC-VIB-CAL adaptive block, before deepSec)
const C7_OLD = "                }\n                var deepSec = 0, lightSec = 0, remSec = 0, wakeSec = 0;\n                var consecutiveQuiet = 0;";
const C7_NEW = "                }\n                // OC-VIB-CAL: Trigger-Schwelle fuer Tiefschlaf aus Rolling-Cache\n                var _gTrigThr = (_vcRollingCache && _vcRollingCache.global && this.config.adaptiveVibThresholds !== false) ? (_vcRollingCache.global.trigThr || 0) : 0;\n                // Rolling Wake/REM override\n                if (_vcRollingCache && _vcRollingCache.global && this.config.adaptiveVibThresholds !== false &&\n                    (_vcRollingCache.global.status === 'calibrating' || _vcRollingCache.global.status === 'calibrated') &&\n                    _vcRollingCache.global.wakeThresh) {\n                    _gWakeThr = _vcRollingCache.global.wakeThresh;\n                    _gRemUp   = _vcRollingCache.global.remUp   || _gRemUp;\n                    _gRemLow  = _vcRollingCache.global.remLow  || _gRemLow;\n                }\n                var deepSec = 0, lightSec = 0, remSec = 0, wakeSec = 0;\n                var consecutiveQuiet = 0;";
replace1(C7_OLD, C7_NEW, 'C7');

// C8: global slotDet === 0 → _gTrigThr
const C8_OLD = "                    if (slotDet === 0) {\n                        consecutiveQuiet++;\n                        stage = consecutiveQuiet >= 5 ? 'deep' : 'light';";
const C8_NEW = "                    if (slotDet <= _gTrigThr) {\n                        consecutiveQuiet++;\n                        stage = consecutiveQuiet >= 5 ? 'deep' : 'light';";
replace1(C8_OLD, C8_NEW, 'C8');

// C9: Pass rolling data to per-person computePersonSleep
const C9_OLD = "                        noisySensorIds: (_self && _self._noisySensorIds) ? _self._noisySensorIds : new Set(),\n                         adaptiveVib:   (_self && _self.config && _self.config.adaptiveVibThresholds !== false),\n                         log:           _self.log";
const C9_NEW = "                        noisySensorIds: (_self && _self._noisySensorIds) ? _self._noisySensorIds : new Set(),\n                         adaptiveVib:   (_self && _self.config && _self.config.adaptiveVibThresholds !== false),\n                         adaptiveTrigThr: (_vcRollingCache && _vcRollingCache.persons && _vcRollingCache.persons[person] && _self.config.adaptiveVibThresholds !== false) ? (_vcRollingCache.persons[person].trigThr || 0) : 0,\n                         vibCalibRolling: (_vcRollingCache && _vcRollingCache.persons && _vcRollingCache.persons[person] && _self.config.adaptiveVibThresholds !== false && (_vcRollingCache.persons[person].status === 'calibrating' || _vcRollingCache.persons[person].status === 'calibrated')) ? _vcRollingCache.persons[person] : null,\n                         log:           _self.log";
replace1(C9_OLD, C9_NEW, 'C9');

// C10: Write rolling buffer after Garmin calibration block
const C10_OLD = "            } catch (_calErr) {\n                this.log.warn('[SleepScoreCal] Fehler: ' + _calErr.message);\n            }\n            // =====================================================================\n            // INTIMACY DETECTION (OC-SEX):";
const C10_NEW = `            } catch (_calErr) {
                this.log.warn('[SleepScoreCal] Fehler: ' + _calErr.message);
            }
            // OC-VIB-CAL: Rolling Calibration Buffer schreiben
            try {
                var _vcState2 = await this.getStateAsync('analysis.health.vibCalibData');
                var _vcData2 = { nights: [], rolling: {} };
                if (_vcState2 && _vcState2.val) { try { var _vcParsed = JSON.parse(_vcState2.val); if (_vcParsed && Array.isArray(_vcParsed.nights)) _vcData2 = _vcParsed; } catch(_){} }
                if (!Array.isArray(_vcData2.nights)) _vcData2.nights = [];
                if (!_vcData2.rolling) _vcData2.rolling = {};
                // Build current night entry
                var _vcNight = { date: dateStr, global: null, persons: {} };
                // Global: trigger rate
                var _gcWinMs = (sleepWindowOC7.start && sleepWindowOC7.end) ? (sleepWindowOC7.end - sleepWindowOC7.start) : 0;
                var _gcSlots = _gcWinMs > 0 ? Math.ceil(_gcWinMs / (5*60*1000)) : 0;
                var _gcVibCount = typeof nightVibrationCount === 'number' ? nightVibrationCount : 0;
                var _gcTrigRate = (_gcSlots > 0 && _gcVibCount > 0) ? Math.round((_gcVibCount / _gcSlots) * 100) / 100 : null;
                // Global: p90 strength from vibStrInWindow (already computed in stage loop scope — use _gVibRaw if available)
                var _gcVibMax = typeof nightVibrationStrengthMax === 'number' ? nightVibrationStrengthMax : null;
                _vcNight.global = { trigRatePerSlot: _gcTrigRate, vibStrMax: _gcVibMax, wakeThresh: _gWakeThr||null, remUp: _gRemUp||null, remLow: _gRemLow||null };
                // Per person
                var _self2 = this;
                Object.keys(personData || {}).forEach(function(pName) {
                    var pd = personData[pName];
                    if (!pd) return;
                    var swS = pd.sleepWindowStart; var swE = pd.sleepWindowEnd;
                    var pSlots = (swS && swE && swE > swS) ? Math.ceil((swE - swS) / (5*60*1000)) : 0;
                    var pVibCnt = pd.nightVibrationCount || 0;
                    var pTrigRate = (pSlots > 0 && pVibCnt > 0) ? Math.round((pVibCnt / pSlots) * 100) / 100 : null;
                    _vcNight.persons[pName] = {
                        trigRatePerSlot: pTrigRate,
                        vibStrMax: pd.nightVibrationStrengthMax || null
                    };
                });
                // Remove existing entry for today, append new
                _vcData2.nights = _vcData2.nights.filter(function(n) { return n.date !== dateStr; });
                _vcData2.nights.push(_vcNight);
                if (_vcData2.nights.length > 14) _vcData2.nights = _vcData2.nights.slice(_vcData2.nights.length - 14);
                // Compute rolling thresholds
                var _vcRoll2 = { persons: {} };
                var _vcN = _vcData2.nights.length;
                // Global rolling
                var _gcRates = _vcData2.nights.map(function(n){return n.global&&n.global.trigRatePerSlot;}).filter(function(v){return typeof v==='number';});
                var _gcAvgRate = _gcRates.length > 0 ? _gcRates.reduce(function(a,b){return a+b;},0)/_gcRates.length : null;
                var _gcTrigThrR = (_gcAvgRate!==null) ? Math.floor(_gcAvgRate*0.20) : 0;
                var _gcVibMaxes = _vcData2.nights.map(function(n){return n.global&&n.global.vibStrMax;}).filter(function(v){return typeof v==='number'&&v>0;});
                var _gcP90 = null;
                if (_gcVibMaxes.length >= 3) { var _gcSorted=_gcVibMaxes.slice().sort(function(a,b){return a-b;}); _gcP90=_gcSorted[Math.floor(_gcSorted.length*0.9)]; }
                var _gcWakeThrR = _gcP90!==null&&_gcP90>=6 ? Math.max(12,Math.round(_gcP90*1.15)) : null;
                var _gcRemUpR   = _gcWakeThrR ? Math.max(6,Math.round(_gcWakeThrR*0.82)) : null;
                var _gcRemLowR  = _gcWakeThrR ? Math.max(3,Math.round(_gcWakeThrR*0.38)) : null;
                var _gcStat = _vcN>=7?'calibrated':_vcN>=3?'calibrating':'uncalibrated';
                _vcRoll2.global = { trigThr: _gcTrigThrR, avgTrigRate: _gcAvgRate, wakeThresh: _gcWakeThrR, remUp: _gcRemUpR, remLow: _gcRemLowR, nightCount: _vcN, status: _gcStat };
                // Per-person rolling
                var _allPersonNames = new Set();
                _vcData2.nights.forEach(function(n){Object.keys(n.persons||{}).forEach(function(p){_allPersonNames.add(p);});});
                _allPersonNames.forEach(function(pName) {
                    var pRates = _vcData2.nights.map(function(n){return (n.persons&&n.persons[pName])?n.persons[pName].trigRatePerSlot:null;}).filter(function(v){return typeof v==='number';});
                    var pMaxes = _vcData2.nights.map(function(n){return (n.persons&&n.persons[pName])?n.persons[pName].vibStrMax:null;}).filter(function(v){return typeof v==='number'&&v>0;});
                    var pAvgRate = pRates.length>0 ? pRates.reduce(function(a,b){return a+b;},0)/pRates.length : null;
                    var pTrigThrR = (pAvgRate!==null) ? Math.floor(pAvgRate*0.20) : 0;
                    var pP90 = null;
                    if (pMaxes.length>=3) { var pSorted=pMaxes.slice().sort(function(a,b){return a-b;}); pP90=pSorted[Math.floor(pSorted.length*0.9)]; }
                    var pWakeThrR = pP90!==null&&pP90>=6 ? Math.max(12,Math.round(pP90*1.15)) : null;
                    var pRemUpR   = pWakeThrR ? Math.max(6,Math.round(pWakeThrR*0.82)) : null;
                    var pRemLowR  = pWakeThrR ? Math.max(3,Math.round(pWakeThrR*0.38)) : null;
                    var pStat = pRates.length>=7?'calibrated':pRates.length>=3?'calibrating':'uncalibrated';
                    _vcRoll2.persons[pName] = { trigThr: pTrigThrR, avgTrigRate: pAvgRate, wakeThresh: pWakeThrR, remUp: pRemUpR, remLow: pRemLowR, nightCount: pRates.length, status: pStat };
                });
                _vcData2.rolling = _vcRoll2;
                _vcData2.updatedAt = Date.now();
                await this.setStateAsync('analysis.health.vibCalibData', { val: JSON.stringify(_vcData2), ack: true });
                this.log.info('[OC-VIB-CAL] Rolling buffer: ' + _vcN + ' Naechte | global: ' + _gcStat);
            } catch (_vcWErr) {
                this.log.warn('[OC-VIB-CAL] Rolling buffer Fehler: ' + _vcWErr.message);
            }
            // =====================================================================
            // INTIMACY DETECTION (OC-SEX):`;
replace1(C10_OLD, C10_NEW, 'C10');

fs.writeFileSync(filePath, src, 'utf8');
console.log('All patches applied. File written.');
