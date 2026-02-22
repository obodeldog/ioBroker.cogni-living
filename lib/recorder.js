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
    const validTypes = ['motion', 'bewegung', 'präsenz', 'presence', 'occupancy', 'door', 'tür', 'window', 'fenster', 'contact', 'kontakt', 'light', 'licht', 'switch', 'schalter', 'dimmer', 'lampe'];
    if (!validTypes.some(t => type.includes(t))) return;
    if (!eventObj.value) return;
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
    const isActive = value === true || value === 1 || value === 'on' || value === 'true';
    if (!isActive) return false;
    const isMotion = ['motion', 'bewegung', 'präsenz', 'presence', 'occupancy'].some(k => t.includes(k));
    const isDoor = ['door', 'tür', 'window', 'fenster', 'griff', 'handle', 'lock', 'schloss', 'contact', 'kontakt'].some(k => t.includes(k));
    const isLight = ['light', 'licht', 'switch', 'schalter', 'dimmer', 'lampe'].some(k => t.includes(k));
    return isMotion || isDoor || isLight;
}

async function updateHourlyActivity(adapter, eventObj) {
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
    const isTemp = type.includes('temperature') || type.includes('temperatur') || type.includes('klima') || type.includes('heizung') || type.includes('thermostat');

    if (isTemp && typeof value === 'number') {
        if (value > 80 || value < -50) { return null; }
    }

    adapter.sensorLastValues[id] = value;
    if (!deviceConf.logDuplicates && lastVal != undefined && lastVal == value) return null;
    if (adapter.isProVersion && isTemp) { recordThermodynamics(adapter, id, value, deviceConf.location); }

    const eventObj = { timestamp: now, id: id, name: deviceConf.name, type: deviceConf.type, location: deviceConf.location, value: value };
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

    if (deviceConf.isExit && value === true) {
        if (adapter.isPresent && !adapter.isGracePeriodActive) startExitTimer(adapter);
        else if (!adapter.isPresent) setPresence(adapter, true);
    }
    else if (deviceConf.type === 'motion' && value === true) {
        if (adapter.exitTimer) abortExitTimer(adapter);
        if (!adapter.isPresent && adapter.currentSystemMode === 'normal') setPresence(adapter, true);
    }

    if (adapter.isProVersion && adapter.sendToPythonWrapper) {
        if (deviceConf.type === 'motion' && value === true && deviceConf.location) { adapter.sendToPythonWrapper('SIMULATE_SIGNAL', { room: deviceConf.location }); }
        const isDoorOrWindow = ['door', 'tür', 'window', 'fenster', 'griff', 'handle', 'lock', 'schloss'].some(t => type.includes(t));
        const isLightOrSwitch = ['light', 'licht', 'switch', 'schalter', 'dimmer', 'lampe'].some(t => type.includes(t));
        const isMotion = ['motion', 'bewegung', 'präsenz', 'presence', 'occupancy'].some(t => type.includes(t));

        if (deviceConf.location && (isDoorOrWindow || isLightOrSwitch || isMotion)) {
            const isActiveSignal = (value === true) || (typeof value === 'number' && value > 0);
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
    isRelevantActivity
};