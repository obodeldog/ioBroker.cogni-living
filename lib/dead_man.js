'use strict';

/**
 * CONTEXT-AWARE DEAD MAN SWITCH (Der Smarte Schutzengel)
 * Version: 0.29.1 (Feature: Robust Room Name Lookup)
 */

const setup = require('./setup');

let activeTimer = null;
let currentMonitoredRoom = null;
let timeoutMs = 0;
let startTime = 0;
let alarmStage = 0; // 0=OK, 1=PRE_WARN, 2=ALARM

const DEFAULT_TIMEOUTS = {
    'bad': 45, 'bath': 45, 'toilet': 30, 'wc': 30, 'keller': 60,
    'schlaf': 120, 'bed': 120, 'guest': 90, 'gast': 90
};

// --- NEW HELPER: ROBUST LOOKUP (Analog to Automation.js) ---
function getTimeoutRobust(config, roomName) {
    if (!config || !roomName) return undefined;

    // 1. Exakter Match ("DG Bad")
    if (config[roomName]) return config[roomName];

    // 2. Normalisierter Match ("dg_bad" -> "dgbad")
    const normKey = roomName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Suche in Config Keys
    for (const key in config) {
        const normConfigKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normConfigKey === normKey) return config[key];
    }

    // 3. Fallback auf Lowercase
    const simpleLower = roomName.toLowerCase();
    if (config[simpleLower]) return config[simpleLower];

    return undefined;
}
// -----------------------------------------------------------

async function loadConfig(adapter) {
    try { const state = await adapter.getStateAsync('analysis.safety.deadMan.config'); if (state && state.val) return JSON.parse(state.val); } catch (e) {} return {};
}

async function isActive(adapter) {
    try { const state = await adapter.getStateAsync('analysis.safety.deadMan.active'); return state && state.val; } catch (e) { return false; }
}

async function areRoomsConnected(adapter, roomA, roomB) {
    try {
        const state = await adapter.getStateAsync('analysis.topology.structure');
        if (!state || !state.val) return true;
        const topo = JSON.parse(state.val);
        const { rooms, matrix } = topo;
        if (!rooms || !matrix) return true;
        const idxA = rooms.indexOf(roomA);
        const idxB = rooms.indexOf(roomB);
        if (idxA === -1 || idxB === -1) return true;
        const connected = matrix[idxA][idxB] > 0 || matrix[idxB][idxA] > 0;
        return connected;
    } catch (e) {
        adapter.log.warn(`[DeadMan] Topology check failed: ${e.message}`);
        return true;
    }
}

// --- BERECHNUNG DER SCHLAF-WAHRSCHEINLICHKEIT ---
function calculateSleepProbability(room) {
    const now = new Date();
    const hour = now.getHours();
    const r = room.toLowerCase();

    // 1. Zeit-Faktor (Gewicht 0.3)
    let fTime = 0.1;
    if (hour >= 23 || hour <= 6) fTime = 1.0;       // Nacht
    else if (hour >= 13 && hour <= 15) fTime = 0.8; // Siesta
    else if (hour >= 20 && hour <= 23) fTime = 0.4; // Couch-Zeit

    // 2. Orts-Faktor (Gewicht 0.5)
    let fLoc = 0.1;
    if (r.includes('schlaf') || r.includes('bed')) fLoc = 1.0;
    else if (r.includes('wohn') || r.includes('living') || r.includes('sofa')) fLoc = 0.6;
    else if (r.includes('bad') || r.includes('wc')) fLoc = 0.05; // Sehr unwahrscheinlich

    // 3. Stille-Faktor (Gewicht 0.2)
    // Vereinfachung: Wir nehmen an, wenn der DeadMan läuft, ist es "still" im Raum.
    let fSilence = 0.5;

    // Formel: P(nap)
    const prob = (fLoc * 0.5) + (fTime * 0.3) + (fSilence * 0.2);
    return parseFloat(prob.toFixed(2));
}
// -----------------------------------------------------

async function updateLocation(adapter, room) {
    if (!room || room === 'Unknown') return;
    if (!(await isActive(adapter))) { resetTimer(adapter); return; }

    if (currentMonitoredRoom && currentMonitoredRoom !== room) {
        const isNeighbor = await areRoomsConnected(adapter, currentMonitoredRoom, room);
        if (!isNeighbor) {
            const msg = `Ignoriere Bewegung in '${room}'. Nicht verbunden mit überwachtem '${currentMonitoredRoom}'.`;
            adapter.log.info(`[DeadMan] ${msg} (Multi-Person Filter)`);
            await adapter.setStateAsync('analysis.safety.deadMan.lastIgnored', { val: JSON.stringify({ room: room, reason: msg, timestamp: Date.now() }), ack: true });
            return;
        }
        resetTimer(adapter);
    }

    if (!currentMonitoredRoom) {
        await adapter.setStateAsync('analysis.safety.deadMan.currentRoom', { val: room, ack: true });

        const config = await loadConfig(adapter);

        // FIX: Use Robust Lookup for Timer
        let minutes = getTimeoutRobust(config, room);

        const normRoom = room.toLowerCase();
        if (!minutes) {
            for (const key in DEFAULT_TIMEOUTS) {
                if (normRoom.includes(key)) { minutes = DEFAULT_TIMEOUTS[key]; break; }
            }
        }
        if (!minutes && config['default']) minutes = config['default'];

        if (!minutes) return;

        currentMonitoredRoom = room;
        startTimer(adapter, minutes, room); // Room übergeben für Prob-Calc
    }
}

function startTimer(adapter, minutes, roomName) {
    if (activeTimer) clearTimeout(activeTimer);

    timeoutMs = minutes * 60 * 1000;
    startTime = Date.now();
    alarmStage = 0;

    // --- NEU: WAHRSCHEINLICHKEIT BERECHNEN & SCHREIBEN ---
    const sleepProb = calculateSleepProbability(roomName || currentMonitoredRoom);
    const isSmartSleep = sleepProb > 0.65;

    // Zeit verlängern bei Smart Sleep (z.B. +90 Min)
    if (isSmartSleep) {
        timeoutMs += (90 * 60 * 1000);
        adapter.log.info(`💤 Smart Sleep erkannt (${(sleepProb*100).toFixed(0)}%). Verlängere Timer für ${currentMonitoredRoom} um 90 Min.`);
        adapter.setStateAsync('analysis.safety.deadMan.smartSleep', { val: true, ack: true });
    } else {
        adapter.setStateAsync('analysis.safety.deadMan.smartSleep', { val: false, ack: true });
    }

    // Werte in DB schreiben für Frontend
    adapter.setStateAsync('analysis.safety.deadMan.napProbability', { val: sleepProb, ack: true });
    // -----------------------------------------------------

    adapter.log.info(`👼 Schutzengel: Überwache ${currentMonitoredRoom} für ${minutes} Min.`);
    adapter.setStateAsync('analysis.safety.deadMan.alarmState', { val: 'ok', ack: true });

    activeTimer = setTimeout(() => triggerPreWarn(adapter), timeoutMs);
}

function resetTimer(adapter) {
    if (activeTimer) clearTimeout(activeTimer);
    activeTimer = null;
    currentMonitoredRoom = null;
    alarmStage = 0;

    // Reset States
    adapter.setStateAsync('analysis.safety.deadMan.alarmState', { val: 'ok', ack: true });
    adapter.setStateAsync('analysis.safety.deadMan.smartSleep', { val: false, ack: true });
    adapter.setStateAsync('analysis.safety.deadMan.napProbability', { val: 0, ack: true });
}

async function triggerPreWarn(adapter) {
    alarmStage = 1;
    await adapter.setStateAsync('analysis.safety.deadMan.alarmState', { val: 'pre_warn', ack: true });
    const msg = `⏳ ACHTUNG: Ungewöhnlich lange Inaktivität in ${currentMonitoredRoom}. Alles in Ordnung?`;
    adapter.log.warn(`[DeadMan] ${msg}`);
    await setup.sendNotification(adapter, `👼 Schutzengel-Frage: ${msg}`);
    activeTimer = setTimeout(() => triggerAlarm(adapter), 5 * 60 * 1000);
}

async function triggerAlarm(adapter) {
    alarmStage = 2;
    await adapter.setStateAsync('analysis.safety.deadMan.alarmState', { val: 'alarm', ack: true });
    const msg = `🚨 NOTFALL-ALARM: Person reagiert nicht in ${currentMonitoredRoom}!`;
    adapter.log.error(`[DeadMan] ${msg}`);
    await setup.sendNotification(adapter, msg, false, true);
}

module.exports = { updateLocation };