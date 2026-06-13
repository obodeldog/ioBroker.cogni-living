'use strict';
// OC-STUCK v3: lc-basiert + stuck=0 + roomStats re-save
const fs   = require('fs');
const path = require('path');
const mainP = path.join(__dirname, '..', 'src', 'main.js');
let txt = fs.readFileSync(mainP, 'utf8');

if (txt.indexOf('[OC-STUCK-V3]') !== -1) { console.log('SKIP'); process.exit(0); }

// Alten OC-STUCK Block (IIFE + V2 re-save) komplett ersetzen
const OLD = `            // [OC-STUCK] Feststeckende Sensoren erkennen und todayRoomMinutes korrigieren.
            // Ausschluss: FP2 (schlaeft legal 8h), Vibrationssensoren.
            // Quelle: this.eventHistory (2000 Events, zeitlich unbegrenzt - breiter als sleepSearchEvents).
            // Schwelle: PIR/Bewegung = 90 Min (physikalisch nie laenger true ohne false).
            // Forensik 13.06.2026: Zigbee KG Werkstatt seit 14:00 true = 589 Min in todayRoomMinutes.
            (function(_self, _hist, _todayMin, _noisy, _walDir) {`;

// Finde Block-Ende (schließt mit })(this, ...) + re-save
const endMarker = `            // [OC-STUCK-V2] roomStats nach OC-STUCK-Korrektur neu speichern
            // (roomStats wurde VOR OC-STUCK gespeichert → UI zeigte noch falschen Wert)
            try {
                const _rsFixed = await this.getStateAsync('analysis.activity.roomStats');
                const _rsObj2 = (_rsFixed && _rsFixed.val) ? JSON.parse(_rsFixed.val) : { today: {}, yesterday: {}, date: '' };
                _rsObj2.today = todayRoomMinutes;
                await this.setStateAsync('analysis.activity.roomStats', { val: JSON.stringify(_rsObj2), ack: true });
            } catch(_rsE2) {}

            // R`;

const startIdx = txt.indexOf(OLD);
if (startIdx === -1) { console.error('FAIL: Marker nicht gefunden'); process.exit(1); }
const endIdx   = txt.indexOf(endMarker, startIdx);
if (endIdx === -1) { console.error('FAIL: End-Marker nicht gefunden'); process.exit(1); }

const before = txt.slice(0, startIdx);
const after  = txt.slice(endIdx + endMarker.length - '            // R'.length); // "// R" bleibt

const NEW = `            // [OC-STUCK-V3] Feststeckende Sensoren via ioBroker state.lc erkennen.
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
            }

            // R`;

txt = before + NEW + after;
fs.writeFileSync(mainP, txt, 'utf8');
console.log('OK: OC-STUCK v3 gepatcht');
