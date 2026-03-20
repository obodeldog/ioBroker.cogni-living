'use strict';

/**
 * EVENT RECORDER & STATE MACHINE
 * Behandelt Sensor-Events, Sequenzen und Anwesenheits-Timer.
 * Version: 0.30.34 (Fix: Increased History Buffer to 2000)
 */

const HISTORY_MAX_SIZE = 2000;
const RAW_LOG_MAX_SIZE = 2500;
const THERMO_LOG_SIZE = 1000;
const SEQUENCE_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_TRAINING_SET_SIZE = 500;
const EXIT_TIMER_MINUTES = 15;
const EXIT_GRACE_PERIOD_SECONDS = 30;

// --- Zentrale Wertetyp-Normalisierung ------------------------------------------
// Gilt f�r: motion, door, presence_radar_bool, vibration_trigger und alle boolean-artigen Sensoren
// Erkennt: true/false, 0/1, "0"/"1", "true"/"false", "on"/"off", "open"/"closed"
function isActiveValue(value) {
    if (value === true  || value === 1)  return true;
    if (value === false || value === 0)  return false;
    if (typeof value === 'number') return value > 0; // z.B. 2, 3 beim FP2 = aktiv
    if (typeof value === 'string') {
        const v = value.toLowerCase().trim();
        return v === 'true' || v === '1' || v === 'on' || v === 'open';
    }
    return false;
}

// Normalisiert numerische Sensorwerte (z.B. vibration_strength)
function toPersonCount(value) {
    if (typeof value === 'number') return Math.max(0, Math.round(value));
    if (typeof value === 'string') {
        const n = parseInt(value, 10);
        return isNaN(n) ? 0 : Math.max(0, n);
    }
    if (value === true) return 1;
    return 0;
}
// -------------------------------------------------------------------------------

let activeSequence = [];
let sequenceTimer = null;

async function getOutsideTemperatureNumeric(adapter) {
    if (adapter.config.outdoorSensorId) { try { const s = await adapter.getForeignStateAsync(adapter.config.outdoorSensorId); if (s && s.val !== undefined && s.val !== null) return parseFloat(s.val); } catch(e) {} }
    const instance = adapter.config.weatherInstance;
    if (!adapter.config.useWeather || !instance) return null;
    try { let t=''; if (instance.includes('accuweather')) t = `${instance}.Current.Temperature`; else if (instance.includes('daswetter')) t = `${instance}.NextHours.Location_1.Day_1.current.temp_value`; else if (instance.includes('openweathermap')) t = `${instance}.forecast.current.temperature`; else if (instance.includes('weatherunderground')) t = `${instance}.forecast.current.temp`; if (t) { const s = await adapter.getForeignStateAsync(t); if (s && s.val !== undefined && s.val !== null) return parseFloat(s.val); } } catch(e) {} return null;
}

async function recordThermodynamics(adapter, id, value, location) {
    const t_out = await getOutsideTemperatureNumeric(adapter);
    if (t_out === null) return;

    let valvePos = 0;
    let foundValve = false;

    if (adapter.config.valveMapping) {
        try {
            let map = adapter.config.valveMapping;
            if (typeof map === 'string') map = JSON.parse(map);
            if (map[id]) {
                const valveId = map[id];
                const vState = await adapter.getForeignStateAsync(valveId);
                if (vState && vState.val !== null && vState.val !== undefined) {
                    let val = Number(vState.val);
                    if (val <= 1.05 && !valveId.includes('STATUS') && !valveId.includes('STATE')) val = val * 100;
                    valvePos = Math.round(val);
                    foundValve = true;
                }
            }
        } catch(e) {}
    }

    if (!foundValve) {
        const replacements = [
            { from: '.1.ACTUAL_TEMPERATURE', to: '.1.LEVEL' },
            { from: '.1.ACTUAL_TEMPERATURE', to: '.1.VALVE_STATE' },
            { from: '.1.TEMPERATURE', to: '.4.VALVE_STATE' },
            { from: '.ACTUAL_TEMPERATURE', to: '.LEVEL' },
            { from: 'temperature', to: 'level' },
            { from: 'Temperature', to: 'Valve' }
        ];
        for (const rule of replacements) {
            if (id.includes(rule.from)) {
                const valveId = id.replace(rule.from, rule.to);
                try {
                    const vState = await adapter.getForeignStateAsync(valveId);
                    if (vState && vState.val !== null && vState.val !== undefined) {
                        let val = Number(vState.val);
                        if (typeof val === 'number') {
                            if (val <= 1.05 && rule.to.includes('LEVEL')) val = val * 100;
                            valvePos = Math.round(val);
                            foundValve = true;
                            break;
                        }
                    }
                } catch(e) { }
            }
        }
    }

    const state = await adapter.getStateAsync('LTM.trainingData.thermodynamics');
    let history = [];
    if (state && state.val) { try { history = JSON.parse(state.val); } catch(e){} }

    history.push({ ts: Date.now(), room: location || 'Unknown', t_in: value, t_out: t_out, valve: valvePos });
    if (history.length > THERMO_LOG_SIZE) history.shift();
    await adapter.setStateAsync('LTM.trainingData.thermodynamics', { val: JSON.stringify(history), ack: true });
}

async function saveCompletedSequence(adapter) {
    try {
        const state = await adapter.getStateAsync('LTM.trainingData.sequences');
        let history = [];
        if (state && state.val) { try { history = JSON.parse(state.val); } catch(e) {} }
        const startTime = activeSequence[0].ts;
        const normalizedSeq = activeSequence.map(step => ({ loc: step.loc, t_delta: Math.round((step.ts - startTime) / 1000) }));
        const sequencePackage = { timestamp: new Date(startTime).toISOString(), steps: normalizedSeq, duration: Math.round((activeSequence[activeSequence.length-1].ts - startTime) / 1000), daytime: new Date(startTime).getHours() };
        history.push(sequencePackage);
        if (history.length > MAX_TRAINING_SET_SIZE) history.shift();
        await adapter.setStateAsync('LTM.trainingData.sequences', { val: JSON.stringify(history), ack: true });
        if (adapter.isProVersion && adapter.sendToPythonWrapper) { adapter.sendToPythonWrapper('ANALYZE_SEQUENCE', { sequence: sequencePackage }); }
    } catch (e) { adapter.log.error(`[RECORDER] Error: ${e.message}`); }
}

async function recordSequence(adapter, eventObj) {
    const type = (eventObj.type || '').toLowerCase();
    const validTypes = ['motion', 'bewegung', 'praesenz', 'presence', 'presence_radar_bool', 'occupancy',
        'door', 'tur', 'window', 'fenster', 'contact', 'kontakt', 'griff', 'handle', 'lock', 'schloss',
        'light', 'licht', 'switch', 'schalter', 'dimmer', 'lampe',
        'vibration_trigger', 'vibration_strength'];
    if (!validTypes.includes(type)) return;
    if (!isActiveValue(eventObj.value) && toPersonCount(eventObj.value) === 0) return;
    if (sequenceTimer) clearTimeout(sequenceTimer);
    activeSequence.push({ loc: eventObj.location || 'Unknown', id: eventObj.id, ts: Date.now() });
    sequenceTimer = setTimeout(async () => { if (activeSequence.length > 1) await saveCompletedSequence(adapter); activeSequence = []; }, SEQUENCE_TIMEOUT_MS);
}

function startExitTimer(adapter) {
    abortExitTimer(adapter);
    adapter.isGracePeriodActive = true;
    adapter.exitGraceTimer = setTimeout(() => { adapter.isGracePeriodActive = false; }, EXIT_GRACE_PERIOD_SECONDS * 1000);
    adapter.exitTimer = setTimeout(() => { setPresence(adapter, false); adapter.exitTimer = null; }, EXIT_TIMER_MINUTES * 60 * 1000);
}

function abortExitTimer(adapter) {
    if (adapter.exitTimer) clearTimeout(adapter.exitTimer);
    if (adapter.exitGraceTimer) clearTimeout(adapter.exitGraceTimer);
    adapter.exitTimer = null;
    adapter.exitGraceTimer = null;
    adapter.isGracePeriodActive = false;
}

async function setPresence(adapter, present) {
    if (adapter.isPresent === present) return;
    adapter.isPresent = present;
    await adapter.setStateAsync('system.isPresent', { val: present, ack: true });
}

function isRelevantActivity(type, value) {
    if (!type) return false;
    const t = type.toLowerCase();
    // vibration_strength: Staerke-Sensor -- Aktivitaet wenn Wert > 0
    if (t === 'vibration_strength') return toPersonCount(value) > 0;
    // Alle anderen: Boolean-Normalisierung
    if (!isActiveValue(value)) return false;
    // Exakte Typ-Vergleiche (kein t.includes() -- verhindert z.B. "temperature".includes("tur")!)
    const isMotion = t === 'motion' || t === 'bewegung' || t === 'praesenz' || t === 'presence'
                  || t === 'presence_radar_bool' || t === 'occupancy';
    const isDoor   = t === 'door' || t === 'tur' || t === 'window' || t === 'fenster'
                  || t === 'contact' || t === 'kontakt' || t === 'griff' || t === 'handle'
                  || t === 'lock' || t === 'schloss';
    const isLight  = t === 'light' || t === 'licht' || t === 'switch' || t === 'schalter'
                  || t === 'dimmer' || t === 'lampe';
    const isVibration = t === 'vibration_trigger';
    return isMotion || isDoor || isLight || isVibration;
}

// Strikte Whitelist fuer die Personenzaehl-Heuristik.
// Nur Sensortypen die direkte menschliche Bewegung/Anwesenheit belegen:
// Bewegungsmelder, Praesenzmelder, Vibration, Tuer/Fenster.
// Licht, Schalter, Temperatur etc. sind NICHT enthalten - diese koennen
// durch Automationen ausgeloest werden und wuerden Falschpositive erzeugen.
function isPersonPresenceActivity(type, value) {
    if (!type) return false;
    const t = type.toLowerCase();
    if (t === 'vibration_strength') return toPersonCount(value) > 0;
    if (!isActiveValue(value)) return false;
    // Exakte Typ-Vergleiche (kein t.includes() -- verhindert z.B. "temperature".includes("tur")!)
    const isMotion  = t === 'motion' || t === 'bewegung' || t === 'praesenz' || t === 'presence'
                   || t === 'presence_radar_bool' || t === 'occupancy';
    const isDoorWin = t === 'door' || t === 'tur' || t === 'fenster' || t === 'window';
    const isVibration = t === 'vibration_trigger';
    return isMotion || isDoorWin || isVibration;
}

async function updateHourlyActivity(adapter, eventObj) {
    if (eventObj.excludeFromActivity) return;
    if (!isRelevantActivity(eventObj.type, eventObj.value)) return;

    let dailyLog = new Array(48).fill(0);
    let dailyRooms = Array.from({ length: 48 }, () => []);
    let stateTs = 0;

    try {
        const s = await adapter.getStateAsync('analysis.health.todayVector');
        if (s && s.val) {
            dailyLog = JSON.parse(s.val);
            if (dailyLog.length !== 48) dailyLog = new Array(48).fill(0);
            stateTs = s.ts;
        }
        const r = await adapter.getStateAsync('analysis.health.todayRoomDetails');
        if (r && r.val) {
            dailyRooms = JSON.parse(r.val);
            if (!Array.isArray(dailyRooms) || dailyRooms.length !== 48) {
                dailyRooms = Array.from({ length: 48 }, () => []);
            } else {
                dailyRooms = dailyRooms.map(entry => entry || []);
            }
        }
    } catch(e) {}

    const lastUpdate = new Date(stateTs);
    const now = new Date();
    if (lastUpdate.getDate() !== now.getDate()) {
        dailyLog = new Array(48).fill(0);
        dailyRooms = Array.from({ length: 48 }, () => []);
    }

    const bucketIndex = (now.getHours() * 2) + (now.getMinutes() >= 30 ? 1 : 0);

    if (bucketIndex < 48) {
        dailyLog[bucketIndex]++;
        const roomName = eventObj.location || eventObj.name || '?';
        const currentRooms = dailyRooms[bucketIndex] || [];
        if (!currentRooms.includes(roomName)) {
            dailyRooms[bucketIndex] = [...currentRooms, roomName];
        }
    }

    await adapter.setStateAsync('analysis.health.todayVector', { val: JSON.stringify(dailyLog), ack: true });
    await adapter.setStateAsync('analysis.health.todayRoomDetails', { val: JSON.stringify(dailyRooms), ack: true });
}

async function processSensorEvent(adapter, id, state, deviceConf) {
    if (!deviceConf) return null;
    const value = state.val;
    const now = Date.now();
    const lastVal = adapter.sensorLastValues[id];

    const type = (deviceConf.type || '').toLowerCase();
    const isTemp = type === 'temperature' || type === 'temperatur' || type === 'klima' || type === 'heizung' || type === 'thermostat';

    if (isTemp && typeof value === 'number') {
        if (value > 80 || value < -50) { return null; }
    }

    adapter.sensorLastValues[id] = value;
    if (!adapter.sensorLastSeen) adapter.sensorLastSeen = {};
    adapter.sensorLastSeen[id] = Date.now();
    if (!deviceConf.logDuplicates && lastVal != undefined && lastVal == value) return null;
    if (adapter.isProVersion && isTemp) { recordThermodynamics(adapter, id, value, deviceConf.location); }

    // Flags aus sensorFunction ableiten (neues Modell) mit Fallback auf alte Bool-Flags
    const _sf = deviceConf.sensorFunction || '';
    const _typeLC = type;
    const eventObj = { timestamp: now, id: id, name: deviceConf.name, type: deviceConf.type, location: deviceConf.location, value: value,
        isBathroomSensor: _sf === 'bathroom' || deviceConf.isBathroomSensor || false,
        isKitchenSensor:  _sf === 'kitchen'  || deviceConf.isKitchenSensor  || false,
        isFP2Bed:         (_typeLC === 'presence_radar_bool' && _sf === 'bed')    || deviceConf.isFP2Bed    || false,
        isFP2Living:      (_typeLC === 'presence_radar_bool' && _sf === 'living') || deviceConf.isFP2Living  || false,
        isVibrationBed:   ((_typeLC === 'vibration_trigger' || _typeLC === 'vibration_strength') && _sf === 'bed')        || deviceConf.isVibrationBed || false,
        isVibrationStrength: _typeLC === 'vibration_strength',
        personTag:        deviceConf.personTag || '',
        excludeFromActivity: deviceConf.excludeFromActivity || false,
    };
    adapter.eventHistory.unshift(eventObj);
    if (adapter.eventHistory.length > HISTORY_MAX_SIZE) adapter.eventHistory.pop();

    await adapter.setStateAsync('events.lastEvent', { val: JSON.stringify(eventObj), ack: true });
    await adapter.setStateAsync('events.history', { val: JSON.stringify(adapter.eventHistory), ack: true });

    await updateHourlyActivity(adapter, eventObj);

    if (adapter.isProVersion) {
        adapter.rawEventLog.push(eventObj);
        if(adapter.rawEventLog.length > RAW_LOG_MAX_SIZE) adapter.rawEventLog.splice(0, adapter.rawEventLog.length - RAW_LOG_MAX_SIZE);
        await adapter.setStateAsync('LTM.rawEventLog', { val: JSON.stringify(adapter.rawEventLog), ack: true });
        recordSequence(adapter, eventObj);
    }

    if (deviceConf.isExit && isActiveValue(value)) {
        if (adapter.isPresent && !adapter.isGracePeriodActive) startExitTimer(adapter);
        else if (!adapter.isPresent) setPresence(adapter, true);
    }
    else if ((deviceConf.type === 'motion' || deviceConf.type === 'presence_radar_bool') && isActiveValue(value)) {
        if (adapter.exitTimer) abortExitTimer(adapter);
        if (!adapter.isPresent && adapter.currentSystemMode === 'normal') setPresence(adapter, true);
    }

    if (adapter.isProVersion && adapter.sendToPythonWrapper) {
        if (deviceConf.type === 'motion' && value === true && deviceConf.location) { adapter.sendToPythonWrapper('SIMULATE_SIGNAL', { room: deviceConf.location }); }
        const isDoorOrWindow = ['door', 'tur', 'window', 'fenster', 'contact', 'kontakt', 'griff', 'handle', 'lock', 'schloss'].includes(type);
        const isLightOrSwitch = ['light', 'licht', 'switch', 'schalter', 'dimmer', 'lampe'].includes(type);
        const isMotion = ['motion', 'bewegung', 'praesenz', 'presence', 'presence_radar_bool', 'occupancy'].includes(type);

        if (deviceConf.location && (isDoorOrWindow || isLightOrSwitch || isMotion)) {
            const isActiveSignal = isActiveValue(value) || toPersonCount(value) > 0;
            const isRelevantClosing = (isDoorOrWindow && !isActiveSignal && lastVal !== undefined && lastVal != value);
            if (isActiveSignal || isRelevantClosing) {
                const lastTrackTime = adapter.lastTrackerEventTime || now;
                const dt = (now - lastTrackTime) / 1000.0;
                adapter.lastTrackerEventTime = now;
                adapter.sendToPythonWrapper('TRACK_EVENT', { room: deviceConf.location, dt: dt });
            }
        }
    }
    return eventObj;
}

module.exports = {
    processSensorEvent,
    getOutsideTemperatureNumeric,
    setPresence,
    abortExitTimer,
    startExitTimer,
    isRelevantActivity,
    isPersonPresenceActivity,
    isActiveValue,
    toPersonCount
};
