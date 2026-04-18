/**
 * Fix 1: date in allen TrainData-Pushes ergänzen (damit LOO-Details Datum kennt)
 * Fix 2: loo_details in beide pyClassifier-Zuweisungen
 * Fix 3: Licht/Temperatur via Raumlocation statt sensorFunction='bed' (extractCtx + label-Loops)
 * Fix 4: Hop<=1 statt Hop<=2 in beiden extractCtx-Funktionen
 */
'use strict';
const fs = require('fs');
let src = fs.readFileSync('src/main.js', 'utf8');
let changes = 0;

function apply(desc, oldStr, newStr) {
    if (!src.includes(oldStr)) { console.error('FEHLER [' + desc + ']: String nicht gefunden'); return; }
    src = src.split(oldStr).join(newStr);
    console.log('OK [' + desc + ']');
    changes++;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 3a: saveDailyHistory – _ctxBedIds für Licht/Temp durch Raumlocation ersetzen
// Wir fügen _ctxBedRoom hinzu (der Raum des Bett-Sensors) und nutzen e.location für Licht+Temp
// ─────────────────────────────────────────────────────────────────────────────
apply('3a: ctxBedRoom-Variable',
    'var _ctxBedIds  = new Set((this.config.devices||[]).filter(function(d){return d.sensorFunction===\'bed\';}).map(function(d){return d.id;}));',
    'var _ctxBedIds  = new Set((this.config.devices||[]).filter(function(d){return d.sensorFunction===\'bed\';}).map(function(d){return d.id;}));\n' +
    '                var _ctxBedRoom = (this.config.devices||[]).filter(function(d){return d.sensorFunction===\'bed\';}).map(function(d){return d.location;}).filter(Boolean)[0] || null;'
);

// FIX 3b: extractCtx in saveDailyHistory – Licht/Temp auf e.location basieren
apply('3b: extractCtx Licht via location',
    'var _lEvts=_wEvts.filter(function(e){return (e.type===\'light\'||e.type===\'dimmer\')&&_ctxBedIds.has(e.id);});',
    'var _lEvts=_wEvts.filter(function(e){return (e.type===\'light\'||e.type===\'dimmer\')&&(_ctxBedRoom?e.location===_ctxBedRoom:_ctxBedIds.has(e.id));});'
);
apply('3b: extractCtx Temp via location',
    'var _tEvts=_wEvts.filter(function(e){return (e.type===\'temperature\'||e.type===\'thermostat\')&&_ctxBedIds.has(e.id);});',
    'var _tEvts=_wEvts.filter(function(e){return (e.type===\'temperature\'||e.type===\'thermostat\'||e.type===\'heating_valve\')&&(_ctxBedRoom?e.location===_ctxBedRoom:_ctxBedIds.has(e.id));});'
);

// FIX 4a: saveDailyHistory – Hop<=2 → Hop<=1
apply('4a: SDH Hop<=1',
    'while(_q.length>0){var _c=_q.shift();if(_dist[_c]>=2)continue;for(var _j=0;_j<_topoRms.length;_j++){if(_topoMat[_c]&&_topoMat[_c][_j]===1&&_dist[_j]===Infinity){_dist[_j]=_dist[_c]+1;_q.push(_j);}}}',
    'while(_q.length>0){var _c=_q.shift();if(_dist[_c]>=1)continue;for(var _j=0;_j<_topoRms.length;_j++){if(_topoMat[_c]&&_topoMat[_c][_j]===1&&_dist[_j]===Infinity){_dist[_j]=_dist[_c]+1;_q.push(_j);}}}'
);
apply('4a: SDH NearbyRooms Hop<=1',
    '_topoRms.forEach(function(rm,idx){if(_dist[idx]>0&&_dist[idx]<=2)_nearbyRooms.add(rm);});',
    '_topoRms.forEach(function(rm,idx){if(_dist[idx]===1)_nearbyRooms.add(rm);});'
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 3c: reanalyzeSexDay – _raBedRoom Variable hinzufügen (nach _raBedIds)
// ─────────────────────────────────────────────────────────────────────────────
apply('3c: raBedRoom-Variable',
    'var _raBathIds = new Set((this.config.devices||[]).filter(function(d){return d.sensorFunction===\'bathroom\'||d.isBathroomSensor;}).map(function(d){return d.id;}));',
    'var _raBathIds = new Set((this.config.devices||[]).filter(function(d){return d.sensorFunction===\'bathroom\'||d.isBathroomSensor;}).map(function(d){return d.id;}));\n' +
    '                var _raBedRoom = (this.config.devices||[]).filter(function(d){return d.sensorFunction===\'bed\';}).map(function(d){return d.location;}).filter(Boolean)[0] || null;'
);

// FIX 3d: reanalyzeSexDay extractCtx – Licht/Temp auf e.location
apply('3d: raExtractCtx Licht via location',
    'var _lE=_wE2.filter(function(e){return (e.type===\'light\'||e.type===\'dimmer\')&&_raBedIds.has(e.id);});',
    'var _lE=_wE2.filter(function(e){return (e.type===\'light\'||e.type===\'dimmer\')&&(_raBedRoom?e.location===_raBedRoom:_raBedIds.has(e.id));});'
);
apply('3d: raExtractCtx Temp via location',
    'var _tE=_wE2.filter(function(e){return (e.type===\'temperature\'||e.type===\'thermostat\')&&_raBedIds.has(e.id);});',
    'var _tE=_wE2.filter(function(e){return (e.type===\'temperature\'||e.type===\'thermostat\'||e.type===\'heating_valve\')&&(_raBedRoom?e.location===_raBedRoom:_raBedIds.has(e.id));});'
);

// FIX 4b: reanalyzeSexDay – Hop<=2 → Hop<=1
apply('4b: RSD Hop<=1',
    'while(_q.length>0){var _c=_q.shift();if(_dist[_c]>=2)continue;for(var _j2=0;_j2<_raTopoRms.length;_j2++){if(_raTopoMat[_c]&&_raTopoMat[_c][_j2]===1&&_dist[_j2]===Infinity){_dist[_j2]=_dist[_c]+1;_q.pu',
    'while(_q.length>0){var _c=_q.shift();if(_dist[_c]>=1)continue;for(var _j2=0;_j2<_raTopoRms.length;_j2++){if(_raTopoMat[_c]&&_raTopoMat[_c][_j2]===1&&_dist[_j2]===Infinity){_dist[_j2]=_dist[_c]+1;_q.pu'
);
apply('4b: RSD NearbyRooms Hop<=1',
    '_raTopoRms.forEach(function(rm,idx){if(_dist[idx]>0&&_dist[idx]<=2)_raNearbyRooms.add(rm);});',
    '_raTopoRms.forEach(function(rm,idx){if(_dist[idx]===1)_raNearbyRooms.add(rm);});'
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1a: date in saveDailyHistory Fast-Path push
// ─────────────────────────────────────────────────────────────────────────────
apply('1a: SDH Fast-Path date',
    '_sexTrainData.push({peak:_lFP.peakMax,durSlots:_lFP.durSlots,avgPeak:_lFP.avgPeak,variance:_lFP.variance,tierB:0,label:_lTypFP,hourSin:_lFP.hourSin||0,hourCos:_lFP.hourCos||1,lightOn:_lFP.lightOn!==undefined?_lFP.lightOn:null,presenceOn:_lFP.presenceOn!==undefined?_lFP.presenceOn:null,roomTemp:_lFP.roomTemp||null,bathBefore:_lFP.bathBefore||0,bathAfter:_lFP.bathAfter||0,nearbyRoomMotion:_lFP.nearbyRoomMotion||0});',
    '_sexTrainData.push({peak:_lFP.peakMax,durSlots:_lFP.durSlots,avgPeak:_lFP.avgPeak,variance:_lFP.variance,tierB:0,label:_lTypFP,date:_lbl.date||\'\',hourSin:_lFP.hourSin||0,hourCos:_lFP.hourCos||1,lightOn:_lFP.lightOn!==undefined?_lFP.lightOn:null,presenceOn:_lFP.presenceOn!==undefined?_lFP.presenceOn:null,roomTemp:_lFP.roomTemp||null,bathBefore:_lFP.bathBefore||0,bathAfter:_lFP.bathAfter||0,nearbyRoomMotion:_lFP.nearbyRoomMotion||0});'
);

// FIX 1b: date in saveDailyHistory Full-Extraction push
// The full push in saveDailyHistory ends with hourSin: _lHSin, hourCos: _lHCos, ...
const SDH_FULL_PUSH_OLD = '_sexTrainData.push({ peak: _lPkMax, durSlots: _lSlotPeaks.length, avgPeak: _lAvgP, variance: _lVarP, tierB: 0, label: _lTypNorm, hourSin: _lHSin, hourCos: _lHCos, lightOn: _lLightOn, presenceOn: _lPresOn, roomTemp: _lRoomT, bathBefore: _lBathB?1:0, bathAfter: _lBathA?1:0, nearbyRoomMotion: 0 });';
const SDH_FULL_PUSH_NEW = '_sexTrainData.push({ peak: _lPkMax, durSlots: _lSlotPeaks.length, avgPeak: _lAvgP, variance: _lVarP, tierB: 0, label: _lTypNorm, date: _lbl.date||\'\', hourSin: _lHSin, hourCos: _lHCos, lightOn: _lLightOn, presenceOn: _lPresOn, roomTemp: _lRoomT, bathBefore: _lBathB?1:0, bathAfter: _lBathA?1:0, nearbyRoomMotion: 0 });';
if (!src.includes(SDH_FULL_PUSH_OLD)) { console.warn('WARN 1b: SDH Full-Push nicht exakt — suche alternativ...'); }
else { apply('1b: SDH Full-Push date', SDH_FULL_PUSH_OLD, SDH_FULL_PUSH_NEW); }

// FIX 1c: date in reanalyzeSexDay Fast-Path push
apply('1c: RSD Fast-Path date',
    '_raSexTrainData.push({peak:_raFP.peakMax,durSlots:_raFP.durSlots,avgPeak:_raFP.avgPeak,variance:_raFP.variance,tierB:0,label:_raLTypFP,hourSin:_raFP.hourSin||0,hourCos:_raFP.hourCos||1,lightOn:_raFP.lightOn!==undefined?_raFP.lightOn:null,presenceOn:_raFP.presenceOn!==undefined?_raFP.presenceOn:null,roomTemp:_raFP.roomTemp||null,bathBefore:_raFP.bathBefore||0,bathAfter:_raFP.bathAfter||0,nearbyRoomMotion:_raFP.nearbyRoomMotion||0});',
    '_raSexTrainData.push({peak:_raFP.peakMax,durSlots:_raFP.durSlots,avgPeak:_raFP.avgPeak,variance:_raFP.variance,tierB:0,label:_raLTypFP,date:_raLbl.date||\'\',hourSin:_raFP.hourSin||0,hourCos:_raFP.hourCos||1,lightOn:_raFP.lightOn!==undefined?_raFP.lightOn:null,presenceOn:_raFP.presenceOn!==undefined?_raFP.presenceOn:null,roomTemp:_raFP.roomTemp||null,bathBefore:_raFP.bathBefore||0,bathAfter:_raFP.bathAfter||0,nearbyRoomMotion:_raFP.nearbyRoomMotion||0});'
);

// FIX 1d: date in reanalyzeSexDay Full-Extraction push  
apply('1d: RSD Full-Push date',
    '_raSexTrainData.push({peak:_raLPkMax,durSlots:_raLSPeaks.length,avgPeak:_raLAvgP,variance:_raLVarP,tierB:0,label:_raLTyp,hourSin:_raLHSin,hourCos:_raLHCos,lightOn:_raLLightOn,presenceOn:_raLPresOn,roomTemp:_raLRoomT,bathBefore:_raLBathB?1:0,bathAfter:_raLBathA?1:0,nearbyRoomMotion:0});',
    '_raSexTrainData.push({peak:_raLPkMax,durSlots:_raLSPeaks.length,avgPeak:_raLAvgP,variance:_raLVarP,tierB:0,label:_raLTyp,date:_raLbl.date||\'\',hourSin:_raLHSin,hourCos:_raLHCos,lightOn:_raLLightOn,presenceOn:_raLPresOn,roomTemp:_raLRoomT,bathBefore:_raLBathB?1:0,bathAfter:_raLBathA?1:0,nearbyRoomMotion:0});'
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1e: loo_details in saveDailyHistory pyClassifier-Zuweisung
// ─────────────────────────────────────────────────────────────────────────────
apply('1e: SDH loo_details',
    'confusion_matrix: (_pyClassInfo.confusion_matrix||null) } : null;',
    'confusion_matrix: (_pyClassInfo.confusion_matrix||null), loo_details: (_pyClassInfo.loo_details||[]) } : null;'
);

// FIX 1f: loo_details in reanalyzeSexDay pyClassifier-Zuweisung
apply('1f: RSD loo_details',
    'confusion_matrix:_raPyInfo.confusion_matrix||null} : null;',
    'confusion_matrix:_raPyInfo.confusion_matrix||null,loo_details:_raPyInfo.loo_details||[]} : null;'
);

fs.writeFileSync('src/main.js', src, 'utf8');
console.log('\nGesamt', changes, 'Fixes angewendet. src/main.js gespeichert.');
