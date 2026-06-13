'use strict';
// OC-STUCK v4: ersetzt v3. eventHistory-Gap-Analyse statt lc-Check.
// Erkennt auch vergangene Stuck-Perioden (Sensor jetzt false, Schaden schon in roomHistory).
const fs   = require('fs');
const path = require('path');
const mainP = path.join(__dirname, '..', 'src', 'main.js');
let txt = fs.readFileSync(mainP, 'utf8');

if (txt.indexOf('[OC-STUCK-V4]') !== -1) { console.log('SKIP: bereits gepatcht'); process.exit(0); }

const OLD = `            // [OC-STUCK-V3] Feststeckende Sensoren via ioBroker state.lc erkennen.
            // Methode: state.lc = "last changed" Timestamp (direkt, keine eventHistory noetig).
            // Logik: val=true && (jetzt - lc) > 90min → Sensor haengt physikalisch.
            // Aktion: todayRoomMinutes[raum] = 0 (nicht beschraenken, sondern komplett entfernen).
            // Ausschluss: FP2 (schlaeft legal 8h+), Vibrationssensoren.
            // Forensik 13.06.2026: Werkstatt-PIR stuck seit 14:00 = 639min.
            {
                const _stDevs = (this.config && this.config.devices) ? this.config.devices : [];
                const _stNow  = Date.now();
                const _stThr  = 90 * 60000;
                for (const _stD of _stDevs) {
                    if (!_stD || !_stD.id) continue;
                    if (_stD.isFP2Bed || _stD.isFP2Living || _stD.isVibrationBed) continue;
                    const _stT = (_stD.type || '').toLowerCase();
                    if (_stT !== 'motion' && _stT !== 'presence_radar_bool' && _stT !== 'presence_radar_count') continue;
                    try {
                        const _stS = await this.getStateAsync(_stD.id);
                        if (!_stS) continue;
                        const _stVal = _stS.val === true || _stS.val === 1 || _stS.val === 'true' || _stS.val === '1';
                        if (!_stVal) continue;
                        const _stLc = _stS.lc || 0;
                        if (!_stLc || (_stNow - _stLc) < _stThr) continue;
                        const _stMin = Math.round((_stNow - _stLc) / 60000);
                        const _stLoc = _stD.location || '';
                        this.log.warn('[OC-STUCK-V3] ' + _stD.id + ' (' + _stLoc + '): ' + _stMin + 'min stuck seit ' + new Date(_stLc).toLocaleTimeString() + ' \u2192 aus Statistik entfernt');
                        if (!noisySensors.find(function(n){ return n.id === _stD.id; })) {
                            noisySensors.push({ id: _stD.id, location: _stLoc, reason: 'stuck_sensor', stuckMinutes: _stMin });
                        }
                        if (_stLoc && typeof todayRoomMinutes[_stLoc] !== 'undefined') {
                            todayRoomMinutes[_stLoc] = 0;
                            this.log.warn('[OC-STUCK-V3] Raum ' + _stLoc + ': komplett aus Statistik (PIR h\u00e4ngt seit ' + _stMin + 'min)');
                        }
                    } catch(_stE) {}
                }
                // roomStats nach Korrektur neu speichern (UI liest daraus)
                try {
                    const _rsS = await this.getStateAsync('analysis.activity.roomStats');
                    const _rsO = (_rsS && _rsS.val) ? JSON.parse(_rsS.val) : { today: {}, yesterday: {}, date: '' };
                    _rsO.today = todayRoomMinutes;
                    await this.setStateAsync('analysis.activity.roomStats', { val: JSON.stringify(_rsO), ack: true });
                } catch(_rsE) {}
            }`;

if (txt.indexOf(OLD) === -1) { console.error('FAIL: Marker nicht gefunden'); process.exit(1); }

const NEW = `            // [OC-STUCK-V4] Feststeckende Sensoren via eventHistory-Gap-Analyse erkennen.
            // Problem mit V3 (lc-basiert): erkennt nur AKTUELL haengende Sensoren.
            // V4 erkennt auch VERGANGENE Stuck-Perioden (Sensor inzwischen false, Schaden in roomHistory).
            // Forensik 13.06.2026: Zigbee-PIR Werkstatt stuck 12.06 14:14 bis 13.06 10:43 (20.5h).
            // Bei Button-Klick 11:27 war Sensor bereits false → lc-Ansatz fand nichts.
            // Hinweis: PIR-hold-time max 1-3min → NIE 90min true ohne stuck. FP2/Radar ausgeschlossen.
            // Algorithmus: pro Sensor true/false Events aus eventHistory+WAL sammeln,
            // laengste true-Phase ohne false bestimmen, Ueberschneidung mit heute berechnen,
            // todayRoomMinutes[raum] um diese Minuten reduzieren (min. 0).
            {
                const _s4Midnight = new Date(); _s4Midnight.setHours(0,0,0,0);
                const _s4MidTs  = _s4Midnight.getTime();
                const _s4Now    = Date.now();
                const _s4Thr    = 90 * 60000;

                // Events aus eventHistory sammeln
                const _s4Evts = (this.eventHistory || []).map(function(e){ return e; });

                // WAL gestern + heute hinzufuegen (falls 5000-Limit aelteren true-Event verdraengt hat)
                try {
                    var _s4Dir = this._historyDir || '';
                    if (_s4Dir) {
                        var _s4FsW = require('fs'); var _s4PaW = require('path');
                        var _s4Known = new Set(_s4Evts.map(function(e){ return (e.timestamp||0)+'|'+(e.id||''); }));
                        [new Date(_s4MidTs - 86400000), new Date(_s4MidTs)].forEach(function(_s4D) {
                            var _s4Ds = _s4D.getFullYear() + '-' + String(_s4D.getMonth()+1).padStart(2,'0') + '-' + String(_s4D.getDate()).padStart(2,'0');
                            var _s4Wp = _s4PaW.join(_s4Dir, 'buffer-' + _s4Ds + '.jsonl');
                            if (!_s4FsW.existsSync(_s4Wp)) return;
                            _s4FsW.readFileSync(_s4Wp, 'utf8').split(/\\r?\\n/).filter(Boolean).forEach(function(_s4L) {
                                try {
                                    var _s4We = JSON.parse(_s4L);
                                    var _s4Wk = (_s4We.timestamp||0)+'|'+(_s4We.id||'');
                                    if (_s4We && _s4We.id && !_s4Known.has(_s4Wk)) { _s4Known.add(_s4Wk); _s4Evts.push(_s4We); }
                                } catch(_) {}
                            });
                        });
                    }
                } catch(_s4WE) {}

                // Pro Sensor gruppieren (nur PIR/Bewegung, kein FP2/Vib/BedroomNonBed)
                var _s4BySensor = {};
                _s4Evts.forEach(function(_s4E) {
                    if (!_s4E || !_s4E.id || !_s4E.type) return;
                    if (_s4E.isFP2Bed || _s4E.isFP2Living || _s4E.isVibrationBed || _s4E.isBedroomNonBed) return;
                    var _s4T = (_s4E.type || '').toLowerCase();
                    if (_s4T !== 'motion' && _s4T !== 'presence_radar_bool' && _s4T !== 'presence_radar_count') return;
                    if (!_s4BySensor[_s4E.id]) _s4BySensor[_s4E.id] = { location: _s4E.location || '', evts: [] };
                    _s4BySensor[_s4E.id].evts.push({ ts: _s4E.timestamp || 0, val: !!_s4E.value });
                });

                var _self4 = this;
                Object.keys(_s4BySensor).forEach(function(_s4Id) {
                    var _s4Sensor = _s4BySensor[_s4Id];
                    var _s4Loc    = _s4Sensor.location;
                    if (!_s4Loc || typeof todayRoomMinutes[_s4Loc] === 'undefined') return;

                    // Aufsteigend sortieren
                    _s4Sensor.evts.sort(function(a, b){ return a.ts - b.ts; });

                    var _s4StuckMins = 0;
                    var _s4TrueTs    = null;

                    _s4Sensor.evts.forEach(function(_s4Ev) {
                        if (_s4Ev.val) {
                            if (_s4TrueTs === null) _s4TrueTs = _s4Ev.ts; // neue true-Phase
                        } else {
                            if (_s4TrueTs !== null) {
                                var _s4Dur = _s4Ev.ts - _s4TrueTs;
                                if (_s4Dur >= _s4Thr) {
                                    var _s4OvS = Math.max(_s4TrueTs, _s4MidTs);
                                    var _s4OvE = Math.min(_s4Ev.ts, _s4Now);
                                    if (_s4OvE > _s4OvS) {
                                        var _s4OvM = Math.round((_s4OvE - _s4OvS) / 60000);
                                        _s4StuckMins += _s4OvM;
                                        _self4.log.warn('[OC-STUCK-V4] ' + _s4Id + ' (' + _s4Loc + '): stuck ' +
                                            Math.round(_s4Dur/60000) + 'min (' +
                                            new Date(_s4TrueTs).toLocaleTimeString() + '\u2013' +
                                            new Date(_s4Ev.ts).toLocaleTimeString() + ') \u2192 ' + _s4OvM + 'min heutiger Schaden');
                                    }
                                }
                                _s4TrueTs = null;
                            }
                        }
                    });

                    // Sensor endet noch auf true (laeuft aktuell noch)
                    if (_s4TrueTs !== null && (_s4Now - _s4TrueTs) >= _s4Thr) {
                        var _s4OvS2 = Math.max(_s4TrueTs, _s4MidTs);
                        var _s4OvE2 = _s4Now;
                        if (_s4OvE2 > _s4OvS2) {
                            var _s4OvM2 = Math.round((_s4OvE2 - _s4OvS2) / 60000);
                            _s4StuckMins += _s4OvM2;
                            _self4.log.warn('[OC-STUCK-V4] ' + _s4Id + ' (' + _s4Loc + '): aktuell stuck ' +
                                Math.round((_s4Now - _s4TrueTs)/60000) + 'min \u2192 ' + _s4OvM2 + 'min heutiger Schaden');
                        }
                    }

                    if (_s4StuckMins > 0) {
                        var _s4Before = todayRoomMinutes[_s4Loc];
                        todayRoomMinutes[_s4Loc] = Math.max(0, _s4Before - _s4StuckMins);
                        _self4.log.warn('[OC-STUCK-V4] Raum ' + _s4Loc + ': ' + _s4Before + 'min \u2192 ' +
                            todayRoomMinutes[_s4Loc] + 'min (\u2212' + _s4StuckMins + 'min Stuck-Korrektur)');
                        if (!noisySensors.find(function(n){ return n.id === _s4Id; })) {
                            noisySensors.push({ id: _s4Id, location: _s4Loc, reason: 'stuck_sensor', stuckMinutes: _s4StuckMins });
                        }
                    }
                });

                // roomStats nach Korrektur neu speichern (UI liest daraus)
                try {
                    var _s4Rs = await this.getStateAsync('analysis.activity.roomStats');
                    var _s4RO = (_s4Rs && _s4Rs.val) ? JSON.parse(_s4Rs.val) : { today: {}, yesterday: {}, date: '' };
                    _s4RO.today = todayRoomMinutes;
                    await this.setStateAsync('analysis.activity.roomStats', { val: JSON.stringify(_s4RO), ack: true });
                } catch(_s4RE) {}
            }`;

txt = txt.replace(OLD, NEW);
fs.writeFileSync(mainP, txt, 'utf8');
console.log('OK: OC-STUCK v4 gepatcht');
