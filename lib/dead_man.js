'use strict';

/**
 * CONTEXT-AWARE DEAD MAN SWITCH (Der Smarte Schutzengel)
 * Version: 0.30.0 (Global Activity Reset)
 *
 * Architektur-Entscheidung (13.04.2026):
 * Jede Bewegung in IRGENDEINEM Raum setzt den Timer zurueck.
 * Kein Topologie-Filter mehr. Loest Fehlalarme durch PIR-Hold-Times
 * und lueckenhafte Topologie-Konfiguration.
 */

const setup = require('./setup');

let activeTimer = null;
let currentMonitoredRoom = null;
let timeoutMs = 0;
let startTime = 0;
let alarmStage = 0;

const DEFAULT_TIMEOUTS = {
    'bad': 45, 'bath': 45, 'toilet': 30, 'wc': 30, 'keller': 60,
    'schlaf': 120, 'bed': 120, 'guest': 90, 'gast': 90
};

function getTimeoutRobust(config, roomName) {
    if (!config || !roomName) return undefined;
    if (config[roomName]) return config[roomName];
    const normKey = roomName.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const key in config) {
        const normConfigKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normConfigKey === normKey) return config[key];
    }
    const simpleLower = roomName.toLowerCase();
    if (config[simpleLower]) return config[simpleLower];
    return undefined;
}

async function loadConfig(adapter) {
    try { const state = await adapter.getStateAsync('analysis.safety.deadMan.config'); if (state && state.val) return JSON.parse(state.val); } catch (e) {} return {};
}

async function isActive(adapter) {
    try { const state = await adapter.getStateAsync('analysis.safety.deadMan.active'); return state && state.val; } catch (e) { return false; }
}

function calculateSleepProbability(room) {
    const now = new Date();
    const hour = now.getHours();
    const r = (room || '').toLowerCase();
    let fTime = 0.1;
    if (hour >= 23 || hour <= 6) fTime = 1.0;
    else if (hour >= 13 && hour <= 15) fTime = 0.8;
    else if (hour >= 20 && hour <= 23) fTime = 0.4;
    let fLoc = 0.1;
    if (r.includes('schlaf') || r.includes('bed')) fLoc = 1.0;
    else if (r.includes('wohn') || r.includes('living') || r.includes('sofa')) fLoc = 0.6;
    else if (r.includes('bad') || r.includes('wc')) fLoc = 0.05;
    const fSilence = 0.5;
    const prob = (fLoc * 0.5) + (fTime * 0.3) + (fSilence * 0.2);
    return parseFloat(prob.toFixed(2));
}

async function updateLocation(adapter, room) {
    if (!room || room === 'Unknown') return;
    if (!(await isActive(adapter))) { resetTimer(adapter); return; }

    if (currentMonitoredRoom && currentMonitoredRoom !== room) {
        adapter.log.debug(`[DeadMan] Aktivitaet in '${room}' (ueberwacht: '${currentMonitoredRoom}') -> Timer reset.`);
        resetTimer(adapter);
    }

    if (!currentMonitoredRoom) {
        const config = await loadConfig(adapter);
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
        await adapter.setStateAsync('analysis.safety.deadMan.currentRoom', { val: room, ack: true });
        startTimer(adapter, minutes, room);
    }
}

function startTimer(adapter, minutes, roomName) {
    if (activeTimer) clearTimeout(activeTimer);
    timeoutMs = minutes * 60 * 1000;
    startTime = Date.now();
    alarmStage = 0;

    const sleepProb = calculateSleepProbability(roomName || currentMonitoredRoom);
    const isSmartSleep = sleepProb > 0.65;

    if (isSmartSleep) {
        timeoutMs += (90 * 60 * 1000);
        adapter.log.info(`[DeadMan] Smart Sleep erkannt (${(sleepProb*100).toFixed(0)}%). Timer fuer '${currentMonitoredRoom}' +90 Min.`);
        adapter.setStateAsync('analysis.safety.deadMan.smartSleep', { val: true, ack: true });
    } else {
        adapter.setStateAsync('analysis.safety.deadMan.smartSleep', { val: false, ack: true });
    }

    adapter.setStateAsync('analysis.safety.deadMan.napProbability', { val: sleepProb, ack: true });
    adapter.log.info(`[DeadMan] Ueberwache '${currentMonitoredRoom}' fuer ${minutes} Min.`);
    adapter.setStateAsync('analysis.safety.deadMan.alarmState', { val: 'ok', ack: true });
    activeTimer = setTimeout(() => triggerPreWarn(adapter), timeoutMs);
}

function resetTimer(adapter) {
    if (activeTimer) clearTimeout(activeTimer);
    activeTimer = null;
    currentMonitoredRoom = null;
    alarmStage = 0;
    adapter.setStateAsync('analysis.safety.deadMan.alarmState', { val: 'ok', ack: true });
    adapter.setStateAsync('analysis.safety.deadMan.smartSleep', { val: false, ack: true });
    adapter.setStateAsync('analysis.safety.deadMan.napProbability', { val: 0, ack: true });
}

async function triggerPreWarn(adapter) {
    // Schlafzimmer vor 09:00 Uhr: Pre-Warn verschieben statt feuern
    const nowH = new Date().getHours();
    const r = (currentMonitoredRoom || '').toLowerCase();
    const isSleepRoom = r.includes('schlaf') || r.includes('bed') || r.includes('guest') || r.includes('gast');
    if (isSleepRoom && (nowH >= 22 || nowH < 9)) {
        const defer = new Date();
        if (nowH >= 22) defer.setDate(defer.getDate() + 1);
        defer.setHours(9, 0, 0, 0);
        const delayMs = Math.max(defer.getTime() - Date.now(), 60000);
        adapter.log.info(`[DeadMan] Pre-Warn verschoben: Schlafraum vor 09:00 (aktuell ${nowH} Uhr) -> ${Math.round(delayMs/60000)} Min.`);
        activeTimer = setTimeout(() => triggerPreWarn(adapter), delayMs);
        return;
    }
    alarmStage = 1;
    await adapter.setStateAsync('analysis.safety.deadMan.alarmState', { val: 'pre_warn', ack: true });
    const msg = `ACHTUNG: Ungewoehnlich lange Inaktivitaet in ${currentMonitoredRoom}. Alles in Ordnung?`;
    adapter.log.warn(`[DeadMan] ${msg}`);
    await setup.sendNotification(adapter, `Schutzengel-Frage: ${msg}`);
    activeTimer = setTimeout(() => triggerAlarm(adapter), 5 * 60 * 1000);
}

async function triggerAlarm(adapter) {
    alarmStage = 2;
    await adapter.setStateAsync('analysis.safety.deadMan.alarmState', { val: 'alarm', ack: true });
    const msg = `NOTFALL-ALARM: Person reagiert nicht in ${currentMonitoredRoom}!`;
    adapter.log.error(`[DeadMan] ${msg}`);
    await setup.sendNotification(adapter, msg, false, true);
}

module.exports = { updateLocation };
