'use strict';
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'src', 'main.js');
let txt = fs.readFileSync(p, 'utf8');

if (txt.indexOf('[OC-42p v2]') !== -1 || txt.indexOf('[OC-STUCK]') !== -1) {
    console.log('SKIP: bereits gepatcht'); process.exit(0);
}

// ─────────────────────────────────────────────────────────
// FIX 1: OC-42p v2 – Per-Person bedExitTs: Global OC-45a nutzen
// ─────────────────────────────────────────────────────────
const OLD1 = `                    // [OC-42p] Per-Person bedExitTs: physisches Aufstehen nach sleepWindowEnd
                    var _pBedExitTs = null, _pBedExitSrc = null;
                    var _pBeAnchor = _pGarminWakeTs || _pResult.sleepWindowEnd;
                    if (_pBeAnchor) {
                        var _pBeMax = _pBeAnchor + 45 * 60 * 1000;
                        var _pBeVa = (_pResult.allWakeSources||[]).find(function(s) {
                            return s.source === 'vibration_alone' && s.ts && s.ts > _pBeAnchor && s.ts <= _pBeMax;
                        });
                        if (_pBeVa) { _pBedExitTs = _pBeVa.ts; _pBedExitSrc = 'vibration_alone'; }
                        if (!_pBedExitTs) {
                            var _pSnapBedExit = (_existingSnap&&_existingSnap.personData&&_existingSnap.personData[person]) ? _existingSnap.personData[person].bedExitTs : null;
                            if (_pSnapBedExit && _pSnapBedExit > _pBeAnchor && _pSnapBedExit <= _pBeMax) {
                                _pBedExitTs = _pSnapBedExit; _pBedExitSrc = 'snapshot';
                            }
                        }
                        if (_pBedExitTs) _self.log.info('[OC-42p] ' + person + ' bedExitTs: ' + new Date(_pBedExitTs).toLocaleTimeString() + ' (' + _pBedExitSrc + ')');
                    }`;

const NEW1 = `                    // [OC-42p] Per-Person bedExitTs: physisches Aufstehen nach sleepWindowEnd
                    var _pBedExitTs = null, _pBedExitSrc = null;
                    var _pBeAnchor = _pGarminWakeTs || _pResult.sleepWindowEnd;
                    if (_pBeAnchor) {
                        var _pBeMax = _pBeAnchor + 45 * 60 * 1000;
                        var _pBeVa = (_pResult.allWakeSources||[]).find(function(s) {
                            return s.source === 'vibration_alone' && s.ts && s.ts > _pBeAnchor && s.ts <= _pBeMax;
                        });
                        if (_pBeVa) { _pBedExitTs = _pBeVa.ts; _pBedExitSrc = 'vibration_alone'; }
                        // [OC-42p v2] Global OC-45a bedExitTs als frueheres Signal bevorzugen.
                        // OC-45a nutzt Bad-/Zimmer-Sensor + FP2 und ist daher genauer als vibration_alone
                        // (vibration_alone = letzter Matratzen-Kontakt, z.B. beim Bettmachen nach dem Aufstehen).
                        // Forensik 13.06.2026: Marc vibration_alone=08:51 vs OC-45a=08:39 (Bad 08:41 CEST).
                        if (typeof bedExitTs !== 'undefined' && bedExitTs && bedExitTs > _pBeAnchor && bedExitTs <= _pBeMax) {
                            if (!_pBedExitTs || bedExitTs < _pBedExitTs) {
                                _pBedExitTs = bedExitTs;
                                _pBedExitSrc = (typeof _bedExitSrc !== 'undefined' && _bedExitSrc) ? _bedExitSrc : 'oc45_global';
                            }
                        }
                        if (!_pBedExitTs) {
                            var _pSnapBedExit = (_existingSnap&&_existingSnap.personData&&_existingSnap.personData[person]) ? _existingSnap.personData[person].bedExitTs : null;
                            if (_pSnapBedExit && _pSnapBedExit > _pBeAnchor && _pSnapBedExit <= _pBeMax) {
                                _pBedExitTs = _pSnapBedExit; _pBedExitSrc = 'snapshot';
                            }
                        }
                        if (_pBedExitTs) _self.log.info('[OC-42p] ' + person + ' bedExitTs: ' + new Date(_pBedExitTs).toLocaleTimeString() + ' (' + _pBedExitSrc + ')');
                    }`;

let n1 = (txt.split(OLD1).length - 1);
console.log('Fix1 Vorkommen:', n1);
if (n1 !== 1) { console.error('FAIL Fix1: nicht eindeutig (' + n1 + ')'); process.exit(1); }
txt = txt.replace(OLD1, NEW1);

// ─────────────────────────────────────────────────────────
// FIX 2: OC-STUCK – Feststeckende Sensoren erkennen
// Einfügepunkt: nach roomStats-try-catch, vor "Räumliche Heuristik"
// ─────────────────────────────────────────────────────────
const OLD2 = `            } catch(e) {}

            // R`;

const NEW2 = `            } catch(e) {}

            // [OC-STUCK] Feststeckende Sensoren erkennen und todayRoomMinutes korrigieren.
            // Ausschluss: FP2 (schlaeft legal 8h), Vibrationssensoren.
            // Quelle: this.eventHistory (2000 Events, zeitlich unbegrenzt - breiter als sleepSearchEvents).
            // Schwelle: PIR/Bewegung = 90 Min (physikalisch nie laenger true ohne false).
            // Forensik 13.06.2026: Zigbee KG Werkstatt seit 14:00 true = 589 Min in todayRoomMinutes.
            (function(_self, _hist, _todayMin, _noisy) {
                var _stuckThresh = 90 * 60000;
                var _stuckNow    = Date.now();
                var _sMap = {};
                (_hist || []).forEach(function(e) {
                    if (!e || e.isFP2Bed || e.isFP2Living || e.isVibrationBed || e.isVibrationStrength) return;
                    if (e.type !== 'motion' && e.type !== 'presence_radar_bool' && e.type !== 'presence_radar_count') return;
                    var sid = e.id || e.name; if (!sid) return;
                    var t = e.timestamp || 0; if (!t) return;
                    if (!_sMap[sid]) _sMap[sid] = { loc: e.location || '', evts: [] };
                    _sMap[sid].evts.push({ ts: t, on: !!(e.value===true||e.value==='true'||e.value===1||e.value==='1'||Number(e.value)>0) });
                });
                Object.keys(_sMap).forEach(function(sid) {
                    var info = _sMap[sid];
                    var evts = info.evts.sort(function(a,b){ return a.ts-b.ts; });
                    var last = evts[evts.length-1];
                    if (!last || !last.on) return; // zuletzt false => ok
                    var lastFalseIdx = -1;
                    for (var si = evts.length-2; si >= 0; si--) { if (!evts[si].on) { lastFalseIdx = si; break; } }
                    var trueStart = lastFalseIdx >= 0 ? evts[lastFalseIdx+1].ts : evts[0].ts;
                    var durMs = _stuckNow - trueStart;
                    if (durMs < _stuckThresh) return;
                    var durMin  = Math.round(durMs / 60000);
                    var legitMin = Math.round(_stuckThresh / 60000);
                    var excess   = durMin - legitMin;
                    _self.log.warn('[OC-STUCK] ' + sid + ' (' + info.loc + '): ' + durMin + 'min true ohne False (Schwelle: ' + legitMin + 'min) \u2192 Sensor h\u00e4ngt');
                    if (!_noisy.find(function(n){ return n.id === sid; })) {
                        _noisy.push({ id: sid, location: info.loc, reason: 'stuck_sensor', stuckMinutes: durMin });
                    }
                    if (info.loc && typeof _todayMin[info.loc] !== 'undefined' && excess > 0) {
                        var before = _todayMin[info.loc];
                        _todayMin[info.loc] = Math.max(0, before - excess);
                        _self.log.warn('[OC-STUCK] Raum ' + info.loc + ': ' + before + 'min \u2192 ' + _todayMin[info.loc] + 'min (Stuck-Korrektur -' + excess + 'min)');
                    }
                });
            })(this, this.eventHistory, todayRoomMinutes, noisySensors);

            // R`;

let n2 = (txt.split(OLD2).length - 1);
console.log('Fix2 Vorkommen:', n2);
if (n2 !== 1) { console.error('FAIL Fix2: nicht eindeutig (' + n2 + ')'); process.exit(1); }
txt = txt.replace(OLD2, NEW2);

fs.writeFileSync(p, txt, 'utf8');
console.log('OK: OC-42p v2 + OC-STUCK gepatcht');
