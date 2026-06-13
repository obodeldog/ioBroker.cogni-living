'use strict';
// OC-STUCK v2: roomStats nach Korrektur neu speichern + WAL-Dateien als Quelle
const fs   = require('fs');
const path = require('path');

const mainP = path.join(__dirname, '..', 'src', 'main.js');
let txt = fs.readFileSync(mainP, 'utf8');

if (txt.indexOf('[OC-STUCK-V2]') !== -1) { console.log('SKIP: bereits gepatcht'); process.exit(0); }

// ─────────────────────────────────────────────────────
// FIX A: roomStats NACH OC-STUCK neu speichern
// OC-STUCK-IIFE bekommt Callback der nach Korrektur roomStats aktualisiert
// ─────────────────────────────────────────────────────
const OLD_A = `            })(this, this.eventHistory, todayRoomMinutes, noisySensors);

            // R`;

const NEW_A = `            })(this, this.eventHistory, todayRoomMinutes, noisySensors);

            // [OC-STUCK-V2] roomStats nach OC-STUCK-Korrektur neu speichern
            // (roomStats wurde VOR OC-STUCK gespeichert → UI zeigte noch falschen Wert)
            try {
                const _rsFixed = await this.getStateAsync('analysis.activity.roomStats');
                const _rsObj2 = (_rsFixed && _rsFixed.val) ? JSON.parse(_rsFixed.val) : { today: {}, yesterday: {}, date: '' };
                _rsObj2.today = todayRoomMinutes;
                await this.setStateAsync('analysis.activity.roomStats', { val: JSON.stringify(_rsObj2), ack: true });
            } catch(_rsE2) {}

            // R`;

const n1 = txt.split(OLD_A).length - 1;
console.log('FixA Vorkommen:', n1);
if (n1 !== 1) { console.error('FAIL FixA'); process.exit(1); }
txt = txt.replace(OLD_A, NEW_A);

// ─────────────────────────────────────────────────────
// FIX B: WAL-Dateien als Zusatzquelle für OC-STUCK
// Events aus WAL lesen damit auch Sensor-Events von gestern erfasst werden
// (this.eventHistory = 2000 Events; ältere Events können rausgefallen sein)
// ─────────────────────────────────────────────────────
const OLD_B = `            (function(_self, _hist, _todayMin, _noisy) {
                var _stuckThresh = 90 * 60000;
                var _stuckNow    = Date.now();
                var _sMap = {};
                (_hist || []).forEach(function(e) {`;

const NEW_B = `            (function(_self, _hist, _todayMin, _noisy, _walDir) {
                var _stuckThresh = 90 * 60000;
                var _stuckNow    = Date.now();
                var _sMap = {};
                // Quelle 1: In-Memory eventHistory
                (_hist || []).forEach(function(e) {`;

const n2 = txt.split(OLD_B).length - 1;
console.log('FixB1 Vorkommen:', n2);
if (n2 !== 1) { console.error('FAIL FixB1'); process.exit(1); }
txt = txt.replace(OLD_B, NEW_B);

// WAL-Leser nach dem eventHistory forEach einfügen
const OLD_C = `                });
                Object.keys(_sMap).forEach(function(sid) {`;

const NEW_C = `                });
                // Quelle 2: WAL-Pufferdateien (gestern + heute) - fuer aeltere Events ausserhalb der 2000-Event-Grenze
                if (_walDir) {
                    try {
                        var _wNow = new Date(_stuckNow);
                        var _wDays = [
                            _wNow.getFullYear()+'-'+String(_wNow.getMonth()+1).padStart(2,'0')+'-'+String(_wNow.getDate()).padStart(2,'0'),
                            (function(){ var _yd=new Date(_stuckNow-86400000); return _yd.getFullYear()+'-'+String(_yd.getMonth()+1).padStart(2,'0')+'-'+String(_yd.getDate()).padStart(2,'0'); })()
                        ];
                        _wDays.forEach(function(_wDs) {
                            var _wBp = require('path').join(_walDir, 'buffer-' + _wDs + '.jsonl');
                            if (!require('fs').existsSync(_wBp)) return;
                            var _wLines = require('fs').readFileSync(_wBp, 'utf8').split('\n');
                            _wLines.forEach(function(_wLn) {
                                if (!_wLn.trim()) return;
                                try {
                                    var _we = JSON.parse(_wLn);
                                    if (!_we || _we.isFP2Bed || _we.isFP2Living || _we.isVibrationBed || _we.isVibrationStrength) return;
                                    if (_we.type !== 'motion' && _we.type !== 'presence_radar_bool' && _we.type !== 'presence_radar_count') return;
                                    var _wsid = _we.id || _we.name; if (!_wsid) return;
                                    var _wt = _we.timestamp || 0; if (!_wt) return;
                                    if (!_sMap[_wsid]) _sMap[_wsid] = { loc: _we.location || '', evts: [] };
                                    // Nur hinzufügen wenn noch nicht vorhanden (dedup via timestamp)
                                    var _wKey = _wt + '|' + _wsid;
                                    if (!_sMap[_wsid]._keys) _sMap[_wsid]._keys = new Set();
                                    if (_sMap[_wsid]._keys.has(_wKey)) return;
                                    _sMap[_wsid]._keys.add(_wKey);
                                    _sMap[_wsid].evts.push({ ts: _wt, on: !!(_we.value===true||_we.value==='true'||_we.value===1||_we.value==='1'||Number(_we.value)>0) });
                                } catch(_wpe) {}
                            });
                        });
                    } catch(_walStuckE) {}
                }
                Object.keys(_sMap).forEach(function(sid) {`;

const n3 = txt.split(OLD_C).length - 1;
console.log('FixB2 Vorkommen:', n3);
if (n3 !== 1) { console.error('FAIL FixB2 (' + n3 + ')'); process.exit(1); }
txt = txt.replace(OLD_C, NEW_C);

// IIFE-Aufruf um _historyDir erweitern
const OLD_D = `})(this, this.eventHistory, todayRoomMinutes, noisySensors);`;
const NEW_D = `})(this, this.eventHistory, todayRoomMinutes, noisySensors, this._historyDir || null);`;

const n4 = txt.split(OLD_D).length - 1;
console.log('FixD Vorkommen:', n4);
if (n4 !== 1) { console.error('FAIL FixD'); process.exit(1); }
txt = txt.replace(OLD_D, NEW_D);

fs.writeFileSync(mainP, txt, 'utf8');
console.log('OK: OC-STUCK v2 (WAL + roomStats re-save) gepatcht');
