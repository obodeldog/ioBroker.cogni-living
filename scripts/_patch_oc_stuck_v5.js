'use strict';
// OC-STUCK v5: ersetzt v4. roomHistory-Pattern-Erkennung.
// PIR-Sensoren können NIEMALS >=4 aufeinanderfolgende Stunden mit >=55min/h liefern (hold-time 1-3min).
// Gilt für ALLE PIR-Räume (auch Schlafzimmer). Nur FP2/Radar ausgeschlossen.
// Korrigiert todayRoomMinutes + roomHistory direkt → dauerhafter Fix.
const fs   = require('fs');
const path = require('path');
const mainP = path.join(__dirname, '..', 'src', 'main.js');
let txt = fs.readFileSync(mainP, 'utf8');

if (txt.indexOf('[OC-STUCK-V5]') !== -1) { console.log('SKIP'); process.exit(0); }

// OC-STUCK-V4 Block ersetzen
const OLD_START = `            // [OC-STUCK-V4] Feststeckende Sensoren via eventHistory-Gap-Analyse erkennen.`;
const OLD_END   = `                // roomStats nach Korrektur neu speichern (UI liest daraus)
                try {
                    var _s4Rs = await this.getStateAsync('analysis.activity.roomStats');
                    var _s4RO = (_s4Rs && _s4Rs.val) ? JSON.parse(_s4Rs.val) : { today: {}, yesterday: {}, date: '' };
                    _s4RO.today = todayRoomMinutes;
                    await this.setStateAsync('analysis.activity.roomStats', { val: JSON.stringify(_s4RO), ack: true });
                } catch(_s4RE) {}
            }`;

const startIdx = txt.indexOf(OLD_START);
const endIdx   = txt.indexOf(OLD_END, startIdx);
if (startIdx === -1 || endIdx === -1) { console.error('FAIL: Marker nicht gefunden'); process.exit(1); }

const NEW = `            // [OC-STUCK-V5] Feststeckende PIR-Sensoren via roomHistory-Pattern-Erkennung.
            // Vorherige Versionen (v3 lc-basiert, v4 eventHistory-basiert) scheitern wenn:
            //   - v3: Sensor bereits false zum Pruefzeitpunkt
            //   - v4: historisches true-Event nicht in eventHistory/WAL (Polling-Akkumulation, kein Event)
            // V5: Pattern direkt in roomHistory - PIR hold-time 1-3min → NIEMALS >=4 konsekutive
            // Stunden mit >=55min/h ohne stuck. Gilt für ALLE Räume mit PIR-Sensor (inkl. Schlafzimmer).
            // Nur FP2/Radar ausgeschlossen (erkennt atmendes Schlafen, legal 8h+ true).
            // Forensik 13.06.2026: Werkstatt-PIR erzeugte via Polling 640min ohne je ein Event zu senden.
            {
                const _s5MinThr  = 55; // min/h: PIR mit 1-3min hold-time erreicht max ~30-40 min/h real
                const _s5ConsThr = 4;  // min. aufeinanderfolgende Stunden für stuck-Pattern

                // Räume mit reinen PIR-Sensoren aus Config bestimmen (kein FP2, kein Radar, kein Vib)
                const _s5PirRooms = new Set();
                (this.config.devices || []).forEach(function(_s5D) {
                    if (!_s5D || !_s5D.location) return;
                    if (_s5D.isFP2Bed || _s5D.isFP2Living || _s5D.isVibrationBed || _s5D.isBedroomNonBed) return;
                    if ((_s5D.type || '').toLowerCase() === 'motion') _s5PirRooms.add(_s5D.location);
                });

                let _s5RhModified = false;
                var _self5 = this;

                _s5PirRooms.forEach(function(_s5Room) {
                    if (typeof todayRoomMinutes[_s5Room] === 'undefined') return;
                    const _s5Arr = (roomHistoryData.history && roomHistoryData.history[_s5Room])
                        ? roomHistoryData.history[_s5Room] : [];
                    if (!_s5Arr.length) return;

                    // Längste konsekutive Sequenz mit >= _s5MinThr min/h finden
                    let _s5MaxRun = 0, _s5MaxStart = -1;
                    let _s5CurRun = 0, _s5RunStart = -1;
                    for (let _s5h = 0; _s5h < _s5Arr.length; _s5h++) {
                        if (_s5Arr[_s5h] >= _s5MinThr) {
                            if (_s5RunStart < 0) _s5RunStart = _s5h;
                            _s5CurRun++;
                            if (_s5CurRun > _s5MaxRun) { _s5MaxRun = _s5CurRun; _s5MaxStart = _s5RunStart; }
                        } else {
                            _s5RunStart = -1; _s5CurRun = 0;
                        }
                    }

                    if (_s5MaxRun < _s5ConsThr) return; // kein Stuck-Pattern

                    // Stuck-Stunden: längste Sequenz addieren und in roomHistory nullen
                    let _s5StuckMins = 0;
                    for (let _s5i = _s5MaxStart; _s5i < _s5MaxStart + _s5MaxRun; _s5i++) {
                        _s5StuckMins += _s5Arr[_s5i];
                        roomHistoryData.history[_s5Room][_s5i] = 0;
                    }
                    _s5RhModified = true;

                    const _s5Before = todayRoomMinutes[_s5Room];
                    todayRoomMinutes[_s5Room] = Math.max(0, _s5Before - _s5StuckMins);
                    _self5.log.warn('[OC-STUCK-V5] ' + _s5Room + ': ' + _s5MaxRun +
                        ' konsekutive Stunden \u2265' + _s5MinThr + 'min/h \u2192 ' +
                        _s5StuckMins + 'min stuck | ' + _s5Before + '\u2192' + todayRoomMinutes[_s5Room] + 'min');
                    if (!noisySensors.find(function(n){ return n.location === _s5Room; })) {
                        noisySensors.push({ id: _s5Room, location: _s5Room, reason: 'stuck_sensor_pattern',
                            stuckMinutes: _s5StuckMins });
                    }
                });

                // roomHistory dauerhaft korrigieren (verhindert Rückfall bei nächstem Auto-Run)
                if (_s5RhModified) {
                    try {
                        await this.setStateAsync('analysis.activity.roomHistory',
                            { val: JSON.stringify(roomHistoryData), ack: true });
                        this.log.info('[OC-STUCK-V5] roomHistory korrigiert (Stuck-Stunden bereinigt)');
                    } catch(_s5He) {}
                }

                // roomStats nach Korrektur neu speichern (UI liest daraus)
                try {
                    const _s5Rs = await this.getStateAsync('analysis.activity.roomStats');
                    const _s5RO = (_s5Rs && _s5Rs.val) ? JSON.parse(_s5Rs.val) : { today: {}, yesterday: {}, date: '' };
                    _s5RO.today = todayRoomMinutes;
                    await this.setStateAsync('analysis.activity.roomStats', { val: JSON.stringify(_s5RO), ack: true });
                } catch(_s5RE) {}
            }`;

txt = txt.slice(0, startIdx) + NEW + txt.slice(endIdx + OLD_END.length);
fs.writeFileSync(mainP, txt, 'utf8');
console.log('OK: OC-STUCK v5 gepatcht');
