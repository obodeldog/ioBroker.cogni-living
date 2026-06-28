const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', 'src', 'main.js');
let src = fs.readFileSync(filePath, 'utf8');

const OLD = 'var pSt=pRts.length>=7?"calibrated":pRts.length>=3?"calibrating":"uncalibrated";\n                    _vcRoll2.persons[pName]={trigThr:pThrR,avgTrigRate:pAvgRt,wakeThresh:pWkR,remUp:pRuR,remLow:pRlR,nightCount:pRts.length,status:pSt};';
const NEW = 'var pSt=pRts.length>=7?"calibrated":pRts.length>=3?"calibrating":"uncalibrated";\n                    var _pSensorHint=(pAvgRt!==null&&pAvgRt<0.5&&pP90!==null&&pP90<20&&pRts.length>=5)?"reposition":null;\n                    _vcRoll2.persons[pName]={trigThr:pThrR,avgTrigRate:pAvgRt,wakeThresh:pWkR,remUp:pRuR,remLow:pRlR,nightCount:pRts.length,status:pSt,sensorHint:_pSensorHint};';

if (!src.includes(OLD)) { console.error('NICHT GEFUNDEN'); process.exit(1); }
src = src.replace(OLD, NEW);
fs.writeFileSync(filePath, src);
console.log('Fix 5: sensorHint angewendet');
