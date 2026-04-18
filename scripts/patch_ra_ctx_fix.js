/**
 * Fix: 3 gezielte Ersetzungen um reanalyzeSexDay Kontext-Features hinzuzufügen
 */
const fs = require('fs');
let src = fs.readFileSync('src/main.js', 'utf8');

let changed = 0;

// -----------------------------------------------------------------------
// FIX 1: Fast-Path push ohne Kontext → mit Kontext
// -----------------------------------------------------------------------
const OLD_FP_PUSH = '_raSexTrainData.push({peak:_raFP.peakMax,durSlots:_raFP.durSlots,avgPeak:_raFP.avgPeak,variance:_raFP.variance,tierB:0,label:_raLTypFP});';
const NEW_FP_PUSH = '_raSexTrainData.push({peak:_raFP.peakMax,durSlots:_raFP.durSlots,avgPeak:_raFP.avgPeak,variance:_raFP.variance,tierB:0,label:_raLTypFP,hourSin:_raFP.hourSin||0,hourCos:_raFP.hourCos||1,lightOn:_raFP.lightOn!==undefined?_raFP.lightOn:null,presenceOn:_raFP.presenceOn!==undefined?_raFP.presenceOn:null,roomTemp:_raFP.roomTemp||null,bathBefore:_raFP.bathBefore||0,bathAfter:_raFP.bathAfter||0,nearbyRoomMotion:_raFP.nearbyRoomMotion||0});';
if (!src.includes(OLD_FP_PUSH)) { console.error('FIX1 nicht gefunden'); process.exit(1); }
src = src.replace(OLD_FP_PUSH, NEW_FP_PUSH);
console.log('FIX1 OK: Fast-Path push mit Kontext-Features');
changed++;

// -----------------------------------------------------------------------
// FIX 2: Migration-Save ohne Kontext → mit Kontext + Kontext-Extraktion davor
// Die Migration-Zeile direkt ersetzen und Kontext-Extraktion davor einfügen
// -----------------------------------------------------------------------
// Die alte Migration-Zeile (in reanalyzeSexDay — nach _raLVarP-Berechnung):
const OLD_MIGRATION = 'if (!_raLbl._features) { _raLbl._features = {peakMax:_raLPkMax,medianPeak:_raLMed,durSlots:_raLSPeaks.length,avgPeak:_raLAvgP,variance:_raLVarP}; _raLabelsUpdated = true; }\r\n                                     _raSexTrainData.push({peak:_raLPkMax,durSlots:_raLSPeaks.length,avgPeak:_raLAvgP,variance:_raLVarP,tierB:0,label:_raLTyp});';
// Try with \r only (mixed line endings)
const OLD_MIGRATION_R = 'if (!_raLbl._features) { _raLbl._features = {peakMax:_raLPkMax,medianPeak:_raLMed,durSlots:_raLSPeaks.length,avgPeak:_raLAvgP,variance:_raLVarP}; _raLabelsUpdated = true; }\r\n                                     _raSexTrainData.push({peak:_raLPkMax,durSlots:_raLSPeaks.length,avgPeak:_raLAvgP,variance:_raLVarP,tierB:0,label:_raLTyp});';

// Find the unique migration snippet differently
const MIGRATION_ANCHOR = 'if (!_raLbl._features) { _raLbl._features = {peakMax:_raLPkMax,medianPeak:_raLMed,durSlots:_raLSPeaks.length,avgPeak:_raLAvgP,variance:_raLVarP}; _raLabelsUpdated = true; }';
if (!src.includes(MIGRATION_ANCHOR)) { console.error('FIX2 ANCHOR nicht gefunden'); process.exit(1); }

// Find the full line + next line (push)
const anchorIdx = src.indexOf(MIGRATION_ANCHOR);
const pushAnchor = '_raSexTrainData.push({peak:_raLPkMax,durSlots:_raLSPeaks.length,avgPeak:_raLAvgP,variance:_raLVarP,tierB:0,label:_raLTyp});';
const pushIdx = src.indexOf(pushAnchor);
if (pushIdx < 0) { console.error('FIX2 PUSH nicht gefunden'); process.exit(1); }

// Show what's between anchor and push
const between = src.substring(anchorIdx + MIGRATION_ANCHOR.length, pushIdx);
console.log('Zwischen Migration und Push:', JSON.stringify(between));

// New replacement: context extraction + complete migration + complete push
const CONTEXT_EXTRACTION = `
                                    // Kontext-Features aus eventHistory extrahieren (identisch zu saveDailyHistory)
                                    var _raLCtxE = _raLSnap.eventHistory || [];
                                    var _raLSessP = {start: _raLT0||_raLFirst, end: _raLT1||(_raLLast+_raLFirst)};
                                    var _raLHrD = new Date(_raLSessP.start); var _raLHF = _raLHrD.getHours()+_raLHrD.getMinutes()/60;
                                    var _raLHSin = Math.round(Math.sin(2*Math.PI*_raLHF/24)*1000)/1000;
                                    var _raLHCos = Math.round(Math.cos(2*Math.PI*_raLHF/24)*1000)/1000;
                                    var _raLLitE = _raLCtxE.filter(function(e){var t=e.timestamp||0;return (e.type==='light'||e.type==='light_status')&&t>=_raLSessP.start&&t<=_raLSessP.end;});
                                    var _raLLightOn = _raLLitE.length>0?(Number(_raLLitE[_raLLitE.length-1].value)>0?1:0):null;
                                    var _raLPresE = _raLCtxE.filter(function(e){var t=e.timestamp||0;return e.isFP2Bed&&t>=_raLSessP.start&&t<=_raLSessP.end;});
                                    var _raLPresOn = _raLPresE.length>0?(Number(_raLPresE[_raLPresE.length-1].value)>0?1:0):null;
                                    var _raLTempE = _raLCtxE.filter(function(e){var t=e.timestamp||0;return (e.type==='temperature'||e.type==='temp')&&t>=_raLSessP.start&&t<=_raLSessP.end;});
                                    var _raLRoomT = _raLTempE.length>0?(Number(_raLTempE[_raLTempE.length-1].value)||null):null;
                                    var _raLBathB = _raLCtxE.some(function(e){var t=e.timestamp||0;return (e.isBathroomSensor||e.type==='bathroom_motion')&&t>=(_raLSessP.start-3600000)&&t<_raLSessP.start;});
                                    var _raLBathA = _raLCtxE.some(function(e){var t=e.timestamp||0;return (e.isBathroomSensor||e.type==='bathroom_motion')&&t>_raLSessP.end&&t<=(_raLSessP.end+3600000);});`;

const NEW_MIGRATION = `_raLbl._features = {peakMax:_raLPkMax,medianPeak:_raLMed,durSlots:_raLSPeaks.length,avgPeak:_raLAvgP,variance:_raLVarP,hourSin:_raLHSin,hourCos:_raLHCos,lightOn:_raLLightOn,presenceOn:_raLPresOn,roomTemp:_raLRoomT,bathBefore:_raLBathB?1:0,bathAfter:_raLBathA?1:0,nearbyRoomMotion:0}; _raLabelsUpdated = true;`;
const NEW_PUSH = `_raSexTrainData.push({peak:_raLPkMax,durSlots:_raLSPeaks.length,avgPeak:_raLAvgP,variance:_raLVarP,tierB:0,label:_raLTyp,hourSin:_raLHSin,hourCos:_raLHCos,lightOn:_raLLightOn,presenceOn:_raLPresOn,roomTemp:_raLRoomT,bathBefore:_raLBathB?1:0,bathAfter:_raLBathA?1:0,nearbyRoomMotion:0});`;

// Replace: OLD_MIGRATION_ANCHOR + between + OLD_PUSH → CONTEXT_EXTRACTION + NEW_MIGRATION + between + NEW_PUSH
const fullOld = MIGRATION_ANCHOR + between + pushAnchor;
const fullNew = CONTEXT_EXTRACTION + '\r\n                                    // Features vollständig speichern (incl. Kontext) — immer überschreiben für Re-Migration\r\n                                    ' + NEW_MIGRATION + between + NEW_PUSH;

if (!src.includes(fullOld)) { console.error('FIX2 fullOld nicht gefunden'); process.exit(1); }
src = src.replace(fullOld, fullNew);
console.log('FIX2 OK: Kontext-Extraktion + vollständige Migration + vollständiger Push');
changed++;

fs.writeFileSync('src/main.js', src, 'utf8');
console.log('\nGesamt', changed, 'von 2 Fixes angewendet. src/main.js gespeichert.');
