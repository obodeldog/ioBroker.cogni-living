/**
 * Fix: reanalyzeSexDay Label-Loop enthält keine Kontext-Features
 * 
 * Bugs:
 * A) Kein Fast-Path für _raLbl._features in reanalyzeSexDay
 * B) Feature-Extraktion ohne Kontext (hourSin, hourCos, presenceOn, lightOn, roomTemp, bathBefore, bathAfter)
 * C) _features-Migration speichert nur Vibrations-Features (unvollständig)
 * 
 * Fix: reanalyzeSexDay bekommt denselben Code wie saveDailyHistory:
 * - Fast-Path für vollständige _features (hourSin vorhanden = vollständig)
 * - Kontext-Feature-Extraktion aus eventHistory
 * - Vollständige _features-Speicherung (incl. Kontext)
 * - Unvollständige _features (kein hourSin) werden neu extrahiert
 */
const fs = require('fs');
let src = fs.readFileSync('src/main.js', 'utf8');

// Der alte reanalyzeSexDay Label-Loop (eindeutige Signatur):
const OLD_LOOP = `var _raLabelsUpdated = false;                        for (var _raLbl of _raSexLabels /* alle Typen inkl. Nullnummer (3. RF-Klasse), unlimitiert */) {                         
                                var _raLPath = path.join(_raCalDir, _raLbl.date + '.json');
                                if (!fs.existsSync(_raLPath)) continue;
                                var _raLSnap = JSON.parse(fs.readFileSync(_raLPath, 'utf8'));
                                var _raLAllE = (_raLSnap.eventHistory || []).filter(function(e){ return e.type==='vibration_strength'&&(e.isVibrationBed||e.isFP2Bed); });
                                if (_raLAllE.length === 0) continue;
                                var _raLT0 = null, _raLT1 = null;
                                if (_raLbl.time && /^\d{1,2}:\d{2}$/.test(_raLbl.time)) {
                                    var _raLP = _raLbl.time.split(':');
                                    var _raLBase = new Date(_raLbl.date + 'T00:00:00');
                                    _raLBase.setHours(parseInt(_raLP[0]), parseInt(_raLP[1]), 0, 0);
                                    _raLT0 = _raLBase.getTime() - 45*60000;
                                    _raLT1 = _raLBase.getTime() + ((_raLbl.durationMin||45)+15)*60000;
                                }
                                var _raLEvts = _raLT0!==null ? _raLAllE.filter(function(e){var t=e.timestamp||0;return t>=_raLT0&&t<=_raLT1;}) : _raLAllE;
                                if (_raLEvts.length === 0) continue;
                                _raLEvts.sort(function(a,b){return (a.timestamp||0)-(b.timestamp||0);});
                                var _raLFirst=_raLEvts[0].timestamp||0, _raLLast=(_raLEvts[_raLEvts.length-1].timestamp||0)+_raSlotCalMs;
                                var _raLSPeaks=[];
                                for (var _raLS=_raLFirst; _raLS<_raLLast; _raLS+=_raSlotCalMs) {
                                    var _raLSVals=_raLEvts.filter(function(e){var t=e.timestamp||0;return t>=_raLS&&t<_raLS+_raSlotCalMs;}).map(function(e){return Number(e.value)||0;});
                                    if (_raLSVals.length>0) _raLSPeaks.push(Math.max.apply(null,_raLSVals));
                                }
                                if (_raLSPeaks.length>0){
                                    _raLSPeaks.sort(function(a,b){return a-b;});
                                    var _raLMed=_raLSPeaks[Math.floor(_raLSPeaks.length/2)];
                                    // Bug-Fix: Nullnummer-Peaks ausschliessen
                                    var _raLTyp=(_raLbl.type||'').toLowerCase();
                                    if (_raLTyp!=='nullnummer') _raSessPeaks.push(_raLMed);
                                    if (_raLTyp==='vaginal') _raVaginalPeaks.push(_raLMed);
                                    else if (_raLTyp==='oral_hand') _raOralPeaks.push(_raLMed);
                                    var _raLPkMax=_raLSPeaks[_raLSPeaks.length-1];
                                    var _raLAvgP=Math.round(_raLSPeaks.reduce(function(a,b){return a+b;},0)/_raLSPeaks.length);
                                    var _raLVarP=Math.round(_raLSPeaks.reduce(function(a,b){return a+(b-_raLAvgP)*(b-_raLAvgP);},0)/_raLSPeaks.length);
                                    // Features einmalig im Label speichern (Migration — kein erneutes JSON-Lesen)
                                     if (!_raLbl._features) { _raLbl._features = {peakMax:_raLPkMax,medianPeak:_raLMed,durSlots:_raLSPeaks.length,avgPeak:_raLAvgP,variance:_raLVarP}; _raLabelsUpdated = true; }
                                     _raSexTrainData.push({peak:_raLPkMax,durSlots:_raLSPeaks.length,avgPeak:_raLAvgP,variance:_raLVarP,tierB:0,label:_raLTyp});
                                }
                            } catch(_raLE){ this.log.debug('[OC-SEX-RA] Calib: '+_raLE.message); }`;

if (!src.includes(OLD_LOOP)) {
    // Try to find a unique sub-string to confirm the code is present
    const subCheck = '_raSexTrainData.push({peak:_raLPkMax,durSlots:_raLSPeaks.length,avgPeak:_raLAvgP,variance:_raLVarP,tierB:0,label:_raLTyp});';
    if (!src.includes(subCheck)) {
        console.error('FEHLER: Alter Loop nicht gefunden (weder vollständig noch Teilstring). Bereits gepatcht?');
        process.exit(1);
    }
    console.error('FEHLER: Exakter Oldstring nicht gefunden - unterschiedliche Whitespace/CRLF.');
    console.error('Versuche Whitespace-toleranten Ersatz...');
    process.exit(1);
}

// Neuer Loop mit Fast-Path UND vollständigen Kontext-Features (identisch zu saveDailyHistory)
const NEW_LOOP = `var _raLabelsUpdated = false;
                        for (var _raLbl of _raSexLabels /* alle Typen inkl. Nullnummer (3. RF-Klasse), unlimitiert */) {
                            try {
                                var _raLTyp = (_raLbl.type||'').toLowerCase();
                                // Fast-Path: vollständige gespeicherte Features verwenden (hourSin vorhanden = vollständig incl. Kontext)
                                if (_raLbl._features && _raLbl._features.hourSin !== undefined) {
                                    var _raFP = _raLbl._features;
                                    if (_raLTyp !== 'nullnummer') _raSessPeaks.push(_raFP.medianPeak);
                                    if (_raLTyp === 'vaginal') _raVaginalPeaks.push(_raFP.medianPeak);
                                    else if (_raLTyp === 'oral_hand') _raOralPeaks.push(_raFP.medianPeak);
                                    _raSexTrainData.push({peak:_raFP.peakMax,durSlots:_raFP.durSlots,avgPeak:_raFP.avgPeak,variance:_raFP.variance,tierB:0,label:_raLTyp,hourSin:_raFP.hourSin||0,hourCos:_raFP.hourCos||1,lightOn:_raFP.lightOn!==undefined?_raFP.lightOn:null,presenceOn:_raFP.presenceOn!==undefined?_raFP.presenceOn:null,roomTemp:_raFP.roomTemp||null,bathBefore:_raFP.bathBefore||0,bathAfter:_raFP.bathAfter||0,nearbyRoomMotion:_raFP.nearbyRoomMotion||0});
                                    continue;
                                }
                                // Vollständige Extraktion aus JSON (incl. Kontext-Features — identisch zu saveDailyHistory)
                                var _raLPath = path.join(_raCalDir, _raLbl.date + '.json');
                                if (!fs.existsSync(_raLPath)) continue;
                                var _raLSnap = JSON.parse(fs.readFileSync(_raLPath, 'utf8'));
                                var _raLAllE = (_raLSnap.eventHistory || []).filter(function(e){ return e.type==='vibration_strength'&&(e.isVibrationBed||e.isFP2Bed); });
                                if (_raLAllE.length === 0) continue;
                                var _raLT0 = null, _raLT1 = null;
                                if (_raLbl.time && /^\d{1,2}:\d{2}$/.test(_raLbl.time)) {
                                    var _raLP = _raLbl.time.split(':');
                                    var _raLBase = new Date(_raLbl.date + 'T00:00:00');
                                    _raLBase.setHours(parseInt(_raLP[0]), parseInt(_raLP[1]), 0, 0);
                                    _raLT0 = _raLBase.getTime() - 45*60000;
                                    _raLT1 = _raLBase.getTime() + ((_raLbl.durationMin||45)+15)*60000;
                                }
                                var _raLEvts = _raLT0!==null ? _raLAllE.filter(function(e){var t=e.timestamp||0;return t>=_raLT0&&t<=_raLT1;}) : _raLAllE;
                                if (_raLEvts.length === 0) continue;
                                _raLEvts.sort(function(a,b){return (a.timestamp||0)-(b.timestamp||0);});
                                var _raLFirst=_raLEvts[0].timestamp||0, _raLLast=(_raLEvts[_raLEvts.length-1].timestamp||0)+_raSlotCalMs;
                                var _raLSPeaks=[];
                                for (var _raLS=_raLFirst; _raLS<_raLLast; _raLS+=_raSlotCalMs) {
                                    var _raLSVals=_raLEvts.filter(function(e){var t=e.timestamp||0;return t>=_raLS&&t<_raLS+_raSlotCalMs;}).map(function(e){return Number(e.value)||0;});
                                    if (_raLSVals.length>0) _raLSPeaks.push(Math.max.apply(null,_raLSVals));
                                }
                                if (_raLSPeaks.length>0){
                                    _raLSPeaks.sort(function(a,b){return a-b;});
                                    var _raLMed=_raLSPeaks[Math.floor(_raLSPeaks.length/2)];
                                    if (_raLTyp !== 'nullnummer') _raSessPeaks.push(_raLMed);
                                    if (_raLTyp === 'vaginal') _raVaginalPeaks.push(_raLMed);
                                    else if (_raLTyp === 'oral_hand') _raOralPeaks.push(_raLMed);
                                    var _raLPkMax=_raLSPeaks[_raLSPeaks.length-1];
                                    var _raLAvgP=Math.round(_raLSPeaks.reduce(function(a,b){return a+b;},0)/_raLSPeaks.length);
                                    var _raLVarP=Math.round(_raLSPeaks.reduce(function(a,b){return a+(b-_raLAvgP)*(b-_raLAvgP);},0)/_raLSPeaks.length);
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
                                    var _raLBathA = _raLCtxE.some(function(e){var t=e.timestamp||0;return (e.isBathroomSensor||e.type==='bathroom_motion')&&t>_raLSessP.end&&t<=(_raLSessP.end+3600000);});
                                    // Vollständige Features speichern (incl. Kontext) — unvollständige überschreiben
                                    _raLbl._features = {peakMax:_raLPkMax,medianPeak:_raLMed,durSlots:_raLSPeaks.length,avgPeak:_raLAvgP,variance:_raLVarP,hourSin:_raLHSin,hourCos:_raLHCos,lightOn:_raLLightOn,presenceOn:_raLPresOn,roomTemp:_raLRoomT,bathBefore:_raLBathB?1:0,bathAfter:_raLBathA?1:0,nearbyRoomMotion:0};
                                    _raLabelsUpdated = true;
                                    _raSexTrainData.push({peak:_raLPkMax,durSlots:_raLSPeaks.length,avgPeak:_raLAvgP,variance:_raLVarP,tierB:0,label:_raLTyp,hourSin:_raLHSin,hourCos:_raLHCos,lightOn:_raLLightOn,presenceOn:_raLPresOn,roomTemp:_raLRoomT,bathBefore:_raLBathB?1:0,bathAfter:_raLBathA?1:0,nearbyRoomMotion:0});
                                }
                            } catch(_raLE){ this.log.debug('[OC-SEX-RA] Calib: '+_raLE.message); }`;

src = src.replace(OLD_LOOP, NEW_LOOP);
console.log('Patch OK: reanalyzeSexDay Label-Loop mit Fast-Path + Kontext-Features ersetzt.');

fs.writeFileSync('src/main.js', src, 'utf8');
console.log('src/main.js gespeichert.');
