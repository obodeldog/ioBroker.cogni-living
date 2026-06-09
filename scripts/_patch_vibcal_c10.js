// C10: Write rolling buffer after Garmin calibration block
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'main.js');
let src = fs.readFileSync(filePath, 'utf8');

const C10_OLD = [
    '            } catch (_calErr) {',
    "                this.log.warn('[SleepScoreCal] Fehler: ' + _calErr.message);",
    '            }',
    '            // =====================================================================',
    '            // INTIMACY DETECTION (OC-SEX):'
].join('\n');

const cnt = src.split(C10_OLD).length - 1;
console.log('C10 anchor count:', cnt);
if (cnt !== 1) { console.error('C10 not unique!'); process.exit(1); }

const C10_NEW = [
    '            } catch (_calErr) {',
    "                this.log.warn('[SleepScoreCal] Fehler: ' + _calErr.message);",
    '            }',
    '            // OC-VIB-CAL: Rolling Calibration Buffer schreiben (nach jeder Nacht)',
    '            try {',
    "                var _vcState2 = await this.getStateAsync('analysis.health.vibCalibData');",
    "                var _vcData2 = { nights: [], rolling: {} };",
    "                if (_vcState2 && _vcState2.val) { try { var _vcParsed = JSON.parse(_vcState2.val); if (_vcParsed && Array.isArray(_vcParsed.nights)) _vcData2 = _vcParsed; } catch(_){} }",
    "                if (!Array.isArray(_vcData2.nights)) _vcData2.nights = [];",
    "                if (!_vcData2.rolling) _vcData2.rolling = {};",
    '                // Heutige Nacht hinzufuegen',
    "                var _vcNight = { date: dateStr, global: null, persons: {} };",
    '                var _gcWinMs = (sleepWindowOC7.start && sleepWindowOC7.end) ? (sleepWindowOC7.end - sleepWindowOC7.start) : 0;',
    '                var _gcSlots = _gcWinMs > 0 ? Math.ceil(_gcWinMs / (5*60*1000)) : 0;',
    '                var _gcVibCnt = typeof nightVibrationCount === "number" ? nightVibrationCount : 0;',
    '                var _gcTrigRate2 = (_gcSlots > 0 && _gcVibCnt > 0) ? Math.round((_gcVibCnt / _gcSlots) * 100) / 100 : null;',
    '                var _gcVibMax2 = typeof nightVibrationStrengthMax === "number" ? nightVibrationStrengthMax : null;',
    '                _vcNight.global = { trigRatePerSlot: _gcTrigRate2, vibStrMax: _gcVibMax2,',
    '                    wakeThresh: (typeof _gWakeThr !== "undefined") ? _gWakeThr : null,',
    '                    remUp: (typeof _gRemUp !== "undefined") ? _gRemUp : null,',
    '                    remLow: (typeof _gRemLow !== "undefined") ? _gRemLow : null };',
    '                Object.keys(personData || {}).forEach(function(pName) {',
    '                    var pd = personData[pName]; if (!pd) return;',
    '                    var swS = pd.sleepWindowStart; var swE = pd.sleepWindowEnd;',
    '                    var pSlots2 = (swS && swE && swE > swS) ? Math.ceil((swE - swS) / (5*60*1000)) : 0;',
    '                    var pVibCnt2 = pd.nightVibrationCount || 0;',
    '                    var pTrigRate2 = (pSlots2 > 0 && pVibCnt2 > 0) ? Math.round((pVibCnt2 / pSlots2) * 100) / 100 : null;',
    '                    _vcNight.persons[pName] = { trigRatePerSlot: pTrigRate2, vibStrMax: pd.nightVibrationStrengthMax || null };',
    '                });',
    '                _vcData2.nights = _vcData2.nights.filter(function(n) { return n.date !== dateStr; });',
    '                _vcData2.nights.push(_vcNight);',
    '                if (_vcData2.nights.length > 14) _vcData2.nights = _vcData2.nights.slice(_vcData2.nights.length - 14);',
    '                // Rolling-Durchschnitte berechnen',
    '                var _vcRoll2 = { persons: {} };',
    '                var _vcN2 = _vcData2.nights.length;',
    '                var _gcRates2 = _vcData2.nights.map(function(n){return n.global&&n.global.trigRatePerSlot;}).filter(function(v){return typeof v==="number";});',
    '                var _gcAvgRate2 = _gcRates2.length>0 ? _gcRates2.reduce(function(a,b){return a+b;},0)/_gcRates2.length : null;',
    '                var _gcTrigThrR2 = (_gcAvgRate2!==null) ? Math.floor(_gcAvgRate2*0.20) : 0;',
    '                var _gcVibMaxes2 = _vcData2.nights.map(function(n){return n.global&&n.global.vibStrMax;}).filter(function(v){return typeof v==="number"&&v>0;});',
    '                var _gcP90_2=null; if (_gcVibMaxes2.length>=3){var _gcSorted2=_gcVibMaxes2.slice().sort(function(a,b){return a-b;});_gcP90_2=_gcSorted2[Math.floor(_gcSorted2.length*0.9)];}',
    '                var _gcWakeThrR2=_gcP90_2!==null&&_gcP90_2>=6?Math.max(12,Math.round(_gcP90_2*1.15)):null;',
    '                var _gcRemUpR2=_gcWakeThrR2?Math.max(6,Math.round(_gcWakeThrR2*0.82)):null;',
    '                var _gcRemLowR2=_gcWakeThrR2?Math.max(3,Math.round(_gcWakeThrR2*0.38)):null;',
    '                var _gcStat2=_vcN2>=7?"calibrated":_vcN2>=3?"calibrating":"uncalibrated";',
    '                _vcRoll2.global={trigThr:_gcTrigThrR2,avgTrigRate:_gcAvgRate2,wakeThresh:_gcWakeThrR2,remUp:_gcRemUpR2,remLow:_gcRemLowR2,nightCount:_vcN2,status:_gcStat2};',
    '                var _allPNames=new Set(); _vcData2.nights.forEach(function(n){Object.keys(n.persons||{}).forEach(function(p){_allPNames.add(p);});});',
    '                _allPNames.forEach(function(pName){',
    '                    var pRts=_vcData2.nights.map(function(n){return(n.persons&&n.persons[pName])?n.persons[pName].trigRatePerSlot:null;}).filter(function(v){return typeof v==="number";});',
    '                    var pMxs=_vcData2.nights.map(function(n){return(n.persons&&n.persons[pName])?n.persons[pName].vibStrMax:null;}).filter(function(v){return typeof v==="number"&&v>0;});',
    '                    var pAvgRt=pRts.length>0?pRts.reduce(function(a,b){return a+b;},0)/pRts.length:null;',
    '                    var pThrR=pAvgRt!==null?Math.floor(pAvgRt*0.20):0;',
    '                    var pP90=null; if(pMxs.length>=3){var pSrt=pMxs.slice().sort(function(a,b){return a-b;});pP90=pSrt[Math.floor(pSrt.length*0.9)];}',
    '                    var pWkR=pP90!==null&&pP90>=6?Math.max(12,Math.round(pP90*1.15)):null;',
    '                    var pRuR=pWkR?Math.max(6,Math.round(pWkR*0.82)):null;',
    '                    var pRlR=pWkR?Math.max(3,Math.round(pWkR*0.38)):null;',
    '                    var pSt=pRts.length>=7?"calibrated":pRts.length>=3?"calibrating":"uncalibrated";',
    '                    _vcRoll2.persons[pName]={trigThr:pThrR,avgTrigRate:pAvgRt,wakeThresh:pWkR,remUp:pRuR,remLow:pRlR,nightCount:pRts.length,status:pSt};',
    '                });',
    '                _vcData2.rolling=_vcRoll2; _vcData2.updatedAt=Date.now();',
    "                await this.setStateAsync('analysis.health.vibCalibData', { val: JSON.stringify(_vcData2), ack: true });",
    "                this.log.info('[OC-VIB-CAL] Rolling buffer: ' + _vcN2 + ' Naechte | global-Status: ' + _gcStat2);",
    '            } catch (_vcWErr) {',
    "                this.log.warn('[OC-VIB-CAL] Rolling buffer Fehler: ' + _vcWErr.message);",
    '            }',
    '            // =====================================================================',
    '            // INTIMACY DETECTION (OC-SEX):'
].join('\n');

src = src.replace(C10_OLD, C10_NEW);
fs.writeFileSync(filePath, src, 'utf8');
console.log('C10 done');
