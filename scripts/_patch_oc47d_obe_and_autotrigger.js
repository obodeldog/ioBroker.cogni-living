/**
 * OC-47d-OBE: Vibrations-Gegenbeweis für roter Außerhalb-Balken bei FP2-Dropout
 * OC-AT:      Auto-Trigger saveDailyHistory() nach Schlaf-Sensor-Events (Debounce 90s)
 *
 * Run: node scripts/_patch_oc47d_obe_and_autotrigger.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '..', 'src', 'main.js');
let src = fs.readFileSync(srcPath, 'utf8');
const NL = src.includes('\r\n') ? '\r\n' : '\n';
function L(s) { return s.split('\n').join(NL); }

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1: OC-47d-OBE — roter Balken bei FP2-Dropout + Vibration
// Einfügestelle: nach dem FP2-Solo-Dropout-Filter (zeile ~2653), vor _fp2Sensors
// ─────────────────────────────────────────────────────────────────────────────
const FIX1_OLD =
`                    // Sensoren sammeln die waehrend des FP2-Leer-Fensters ausserhalb des Betts aktiv waren
                    var _fp2Sensors = sleepSearchEvents.filter(function(e) {`;

const FIX1_NEW =
`                    // [OC-47d-OBE] Vibrations-Gegenbeweis: _hasBath=false, aber _hasAnySensorOutside=true
                    // weil Bad-PIR 10-30s NACH fp2.end feuert (WC-Besuch startet gleichzeitig mit FP2-Rueckkehr).
                    // Wenn Vibrationssignale WAEHREND des fp2-false-Fensters vorlagen:
                    // Person lag im Bett (FP2 Radar-Aussetzer) -> kein roter Balken, nur grauer Aussetzer-Pfeil.
                    if (!_hasBath && _hasAnySensorOutside) {
                        var _hasVibInDropout = sleepSearchEvents.some(function(e) {
                            var _ts3 = e.timestamp || 0;
                            if (_ts3 < fp2.start || _ts3 > fp2.end) return false;
                            return isMine(e) && (e.isVibrationBed || e.isVibrationStrength);
                        });
                        if (_hasVibInDropout) {
                            _allEvtCandidates.push({ start: fp2.start, end: fp2.end, duration: _fp2Dur, type: 'outside', confirmed: false, sensors: [] });
                            return;
                        }
                    }
                    // Sensoren sammeln die waehrend des FP2-Leer-Fensters ausserhalb des Betts aktiv waren
                    var _fp2Sensors = sleepSearchEvents.filter(function(e) {`;

const FIX1_OLD_NL = L(FIX1_OLD);
const FIX1_NEW_NL = L(FIX1_NEW);
if (!src.includes(FIX1_OLD_NL)) {
    console.error('FEHLER FIX1: Anker nicht gefunden!');
    process.exit(1);
}
src = src.replace(FIX1_OLD_NL, FIX1_NEW_NL);
console.log('OK FIX1: OC-47d-OBE Vibrations-Gegenbeweis eingefuegt');

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2: OC-AT — Auto-Trigger saveDailyHistory() nach Schlaf-Sensor-Events
// Einfügestelle: vor letzter schliessender Klammer von if(dev) in onStateChange
// ─────────────────────────────────────────────────────────────────────────────
const FIX2_OLD =
`            if (dev.location && recorder.isPersonPresenceActivity(dev.type, state.val)) {
                if (!this.sensorLastActive) this.sensorLastActive = {};
                this.sensorLastActive[id] = Date.now();
                var _sLog = { ts: Date.now(), sensorId: id, sensorName: dev.name || id, room: dev.location, type: dev.type };
                this.setStateAsync('system.personCount.sensorActivity', { val: JSON.stringify(_sLog), ack: true }).catch(function(){});
                this._checkSpatialImpossibility(id, dev.location);
            }
        }
    }`;

const FIX2_NEW =
`            if (dev.location && recorder.isPersonPresenceActivity(dev.type, state.val)) {
                if (!this.sensorLastActive) this.sensorLastActive = {};
                this.sensorLastActive[id] = Date.now();
                var _sLog = { ts: Date.now(), sensorId: id, sensorName: dev.name || id, room: dev.location, type: dev.type };
                this.setStateAsync('system.personCount.sensorActivity', { val: JSON.stringify(_sLog), ack: true }).catch(function(){});
                this._checkSpatialImpossibility(id, dev.location);
            }
            // [OC-AT] Auto-Trigger: saveDailyHistory() nach Schlaf-relevanten Sensor-Events.
            // Nur nachts (22-11 Uhr) + health-Modul aktiv + Debounce 90s.
            // Relevante Sensoren: FP2-Bett (sensorFunction='bed') + Bad-PIR (sensorFunction='bathroom').
            if (state.ack && this.activeModules.health) {
                var _atH = new Date().getHours();
                if (_atH >= 22 || _atH < 12) {
                    var _atSleep = dev.sensorFunction === 'bed'      ||
                                   dev.sensorFunction === 'bathroom' ||
                                   dev.isFP2Bed      === true        ||
                                   dev.isBathroomSensor === true;
                    if (_atSleep) {
                        if (this._sleepSensorDebounce) clearTimeout(this._sleepSensorDebounce);
                        var _atSelf = this;
                        this._sleepSensorDebounce = setTimeout(function() {
                            _atSelf._sleepSensorDebounce = null;
                            _atSelf.log.debug('[OC-AT] Schlaf-Sensor-Event -> saveDailyHistory() (90s Debounce)');
                            _atSelf.saveDailyHistory().catch(function(e) {
                                _atSelf.log.debug('[OC-AT] Fehler: ' + e.message);
                            });
                        }, 90 * 1000);
                    }
                }
            }
        }
    }`;

const FIX2_OLD_NL = L(FIX2_OLD);
const FIX2_NEW_NL = L(FIX2_NEW);
if (!src.includes(FIX2_OLD_NL)) {
    console.error('FEHLER FIX2: Anker nicht gefunden!');
    process.exit(1);
}
src = src.replace(FIX2_OLD_NL, FIX2_NEW_NL);
console.log('OK FIX2: OC-AT Auto-Trigger Debounce eingefuegt');

fs.writeFileSync(srcPath, src, 'utf8');
console.log('Gespeichert:', srcPath);
