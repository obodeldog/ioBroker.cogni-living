'use strict';

/**
 * AUTOMATION MANAGER
 * v0.29.24 - Fix: Robust Warmup-Time Lookup (Case-Insensitive/Snake-Case Support)
 */

const aiAgent = require('./ai_agent');

const COOLDOWN_MS = 60 * 1000;
const CAL_COOLDOWN_MS = 90 * 60 * 1000;
const RESCUE_LOCK_MS = 120 * 60 * 1000; // 2 Stunden Sperre nach Notfall-Rettung
const ECO_TEMP = 17.0;
const PENALTY_TTL = 3 * 24 * 60 * 60 * 1000; // 3 Tage (72h) Verfallsdatum für RL-Sperren
const lastActions = {};

function normalize(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\s+/g, '').trim();
}

// --- NEW HELPER: ROBUST LOOKUP (Fixes the 60min Bug) ---
// Sucht nach dem Wert, auch wenn der Key unterschiedlich formatiert ist (z.B. "UG Schlafen" vs "ug_schlafen")
function getWarmupRobust(map, key) {
    if (!map || !key) return 60; // Default fallback (60 min)

    // 1. Exakter Match (z.B. "UG Schlafen")
    if (map[key] !== undefined) return map[key];

    // 2. Python Match (z.B. "ug_schlafen")
    // Wir normalisieren den Key so, wie Python/Bridge es tun (lowercase, umlaute, unterstriche)
    const norm = key.toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    if (map[norm] !== undefined) return map[norm];

    return 60; // Nichts gefunden -> Default
}
// -------------------------------------------------------

async function logAutomationAction(adapter, message) {
    await adapter.setStateAsync('analysis.automation.lastAction', { val: message, ack: true });
    try {
        const historyId = 'analysis.automation.actionLog';
        const currentState = await adapter.getStateAsync(historyId);
        let history = [];
        if (currentState && currentState.val) {
            try { history = JSON.parse(currentState.val); } catch(e) {}
        }
        history.unshift({ ts: Date.now(), msg: message });
        if (history.length > 50) history = history.slice(0, 50);
        await adapter.setStateAsync(historyId, { val: JSON.stringify(history), ack: true });
    } catch(e) {}
}

async function handlePrediction(adapter, room, confidence) {
    if (!room || room === 'Unknown') return;
    let mode = 'off';
    let threshold = 0.6;
    try {
        const modeState = await adapter.getStateAsync('analysis.automation.mode');
        if (modeState && modeState.val) mode = modeState.val;
        const threshState = await adapter.getStateAsync('analysis.automation.confidenceThreshold');
        if (threshState && threshState.val) threshold = threshState.val;
    } catch(e) {}

    if (mode === 'off' || confidence < threshold) return;

    const now = Date.now();
    if (lastActions[room] && (now - lastActions[room] < COOLDOWN_MS)) return;

    const devices = adapter.config.devices || [];
    const normalizedRoom = normalize(room);
    const targetDevice = devices.find(d => normalize(d.location) === normalizedRoom && (d.type === 'light' || d.type === 'dimmer' || d.type === 'switch'));

    if (!targetDevice) return;

    const decision = await aiAgent.consultButler(adapter, room, targetDevice.name, confidence);
    if (!decision.approved) return;

    const actionText = `Prädiktion: ${room} -> Schalte ${targetDevice.name} (${decision.reason})`;
    await logAutomationAction(adapter, `[${mode.toUpperCase()}] ${actionText}`);

    if (mode === 'active') {
        const currentState = await adapter.getForeignStateAsync(targetDevice.id);
        if (!currentState || (!currentState.val && currentState.val !== true)) {
            await adapter.setForeignStateAsync(targetDevice.id, true);
        }
        lastActions[room] = now;
    }
}

async function findRelatedId(adapter, sensorId, type = 'setpoint') {
    if (type === 'setpoint' && adapter.config.thermostatMapping) {
        let mapping = adapter.config.thermostatMapping;
        if (typeof mapping === 'string') try { mapping = JSON.parse(mapping); } catch(e){}
        if (mapping && mapping[sensorId]) return mapping[sensorId];
    }
    if (type === 'valve' && adapter.config.valveMapping) {
        let mapping = adapter.config.valveMapping;
        if (typeof mapping === 'string') try { mapping = JSON.parse(mapping); } catch(e){}
        if (mapping && mapping[sensorId]) return mapping[sensorId];
    }

    let patterns = [];
    if (type === 'setpoint') {
        patterns = [
            { s: '.1.ACTUAL_TEMPERATURE', t: '.1.SET_POINT_TEMPERATURE' },
            { s: '.1.TEMPERATURE', t: '.1.SET_POINT_TEMPERATURE' },
            { s: '.1.TEMPERATURE', t: '.4.SET_TEMPERATURE' },
            { s: 'ACTUAL_TEMPERATURE', t: 'SET_POINT_TEMPERATURE' },
            { s: 'local_temperature', t: 'occupied_heating_setpoint' },
            { s: 'local_temperature', t: 'current_heating_setpoint' },
            { s: 'temperature', t: 'target_temperature' },
            { s: 'ACTUAL', t: 'SET' },
            { s: 'Ist', t: 'Soll' },
            { s: 'temperature', t: 'setpoint' }
        ];
    } else if (type === 'valve') {
        patterns = [
            { s: '.1.ACTUAL_TEMPERATURE', t: '.1.LEVEL' },
            { s: '.1.TEMPERATURE', t: '.1.LEVEL' },
            { s: '.1.TEMPERATURE', t: '.4.VALVE_STATE' },
            { s: 'local_temperature', t: 'pi_heating_demand' },
            { s: 'temperature', t: 'valve_position' },
            { s: 'temperature', t: 'level' }
        ];
    }

    for (const p of patterns) {
        if (sensorId.includes(p.s)) {
            const candidate = sensorId.replace(p.s, p.t);
            const obj = await adapter.getForeignObjectAsync(candidate);
            if (obj) return candidate;
        }
    }
    try {
        const parts = sensorId.split('.');
        if (parts.length > 2) {
            const parentId = parts.slice(0, -1).join('.');
            const siblings = await adapter.getForeignObjectsAsync(parentId + '.*');
            const candidates = [];
            const sensorTokens = sensorId.split(/[._]+/).filter(t => !['openknx', '0', 'hm-rpc', 'ist', 'wert', 'temperature', 'actual', 'sensor', 'messwert', 'state'].includes(t.toLowerCase()));
            for (const [id, obj] of Object.entries(siblings)) {
                if (id === sensorId) continue;
                if (obj && obj.common) {
                    const key = id.toLowerCase();
                    const role = (obj.common.role || '').toLowerCase();
                    const unit = (obj.common.unit || '').toLowerCase();
                    let isMatch = false;
                    if (type === 'setpoint' && obj.common.write === true) {
                        isMatch = key.includes('set') || key.includes('soll') || key.includes('target') || role.includes('level.temperature') || role.includes('thermostat.setpoint');
                    } else if (type === 'valve') {
                        isMatch = key.includes('level') || key.includes('valve') || key.includes('stellwert') || key.includes('position') || role.includes('level.valve') || role.includes('value.valve') || unit.includes('%');
                    }
                    if (isMatch) {
                        const candTokens = id.split(/[._]+/).map(t => t.toLowerCase());
                        let score = 0;
                        sensorTokens.forEach(t => { if (candTokens.includes(t.toLowerCase())) score++; });
                        candidates.push({ id, score });
                    }
                }
            }
            if (candidates.length > 0) {
                candidates.sort((a, b) => b.score - a.score);
                if (candidates[0].score > 0) return candidates[0].id;
            }
        }
    } catch(e) {}
    return null;
}

async function scanThermostats(adapter) {
    const devices = adapter.config.devices || [];
    const results = [];
    const sensors = devices.filter(d => d.type === 'temperature' || d.type === 'thermostat');
    for (const dev of sensors) {
        const setpointId = await findRelatedId(adapter, dev.id, 'setpoint');
        const valveId = await findRelatedId(adapter, dev.id, 'valve');
        let source = 'Nicht gefunden';
        let isManual = false;
        let mapping = adapter.config.thermostatMapping || {};
        if (typeof mapping === 'string') try { mapping = JSON.parse(mapping); } catch(e){}
        let valveMap = adapter.config.valveMapping || {};
        if (typeof valveMap === 'string') try { valveMap = JSON.parse(valveMap); } catch(e){}
        if ((mapping[dev.id] && mapping[dev.id] === setpointId) || (valveMap[dev.id] && valveMap[dev.id] === valveId)) {
            source = 'Manuelles Mapping'; isManual = true;
        } else if (setpointId || valveId) {
            source = 'Auto-Erkennung';
        }
        results.push({
            room: dev.location || 'Unbekannt',
            sensorId: dev.id,
            setpointId: setpointId || '-',
            valveId: valveId || '-',
            source: source,
            isManual: isManual,
            status: (setpointId && valveId) ? 'PERFECT' : (setpointId ? 'OK' : 'Fehlt')
        });
    }
    return results.sort((a,b) => a.room.localeCompare(b.room));
}

async function updateSchedulePreview(adapter) {
    if (!adapter.config.useCalendar || !adapter.config.calendarInstance) return;

    let warmupMap = {};
    try {
        const wState = await adapter.getStateAsync('analysis.energy.warmupTimes');
        if (wState && wState.val) warmupMap = JSON.parse(wState.val);
    } catch(e) {}

    const previewList = [];
    const now = Date.now();
    const maxLookahead = 48 * 60 * 60 * 1000;

    try {
        const calState = await adapter.getForeignStateAsync(`${adapter.config.calendarInstance}.data.table`);
        if (!calState || !calState.val) return;
        const events = JSON.parse(calState.val);
        const allowedCals = adapter.config.calendarSelection || [];
        const devices = adapter.config.devices || [];
        const locations = new Set();
        devices.forEach(d => { if(d.location) locations.add(d.location); });

        for (const ev of events) {
            if (ev._calName && allowedCals.length > 0 && !allowedCals.includes(ev._calName)) continue;
            const dateVal = ev._date || ev.eventStart || ev.date;
            if (!dateVal) continue;
            const start = new Date(dateVal);
            const startTime = start.getTime();
            if (isNaN(startTime)) continue;
            if (startTime < now) continue;
            if (startTime > (now + maxLookahead)) continue;

            const title = (ev.event || ev.summary || '').toLowerCase();
            let isGlobal = false;
            let targetRooms = [];
            let reason = ev.event || ev.summary || 'Unbekannt';

            if (title.includes('urlaub ende') || title.includes('rückkehr') || title.includes('ankunft')) {
                isGlobal = true;
                targetRooms = Array.from(locations);
            } else {
                for (const loc of locations) {
                    if (title.includes(loc.toLowerCase())) targetRooms.push(loc);
                }
            }

            if (targetRooms.length > 0) {
                targetRooms.forEach(room => {
                    let minutes = 60;
                    if (isGlobal) {
                        let maxMin = 0;
                        Object.values(warmupMap).forEach(m => { if (m > maxMin) maxMin = m; });
                        minutes = maxMin > 0 ? maxMin : 120;
                    } else {
                        // FIX: Use Robust Lookup instead of direct array access to support Python Keys
                        minutes = getWarmupRobust(warmupMap, room);
                    }
                    const triggerTime = new Date(startTime - (minutes * 60000));
                    previewList.push({
                        eventTime: startTime,
                        triggerTime: triggerTime.getTime(),
                        room: room,
                        minutes: minutes,
                        reason: reason,
                        isGlobal: isGlobal
                    });
                });
            }
        }
    } catch(e) {}

    previewList.sort((a,b) => a.triggerTime - b.triggerTime);
    // Next 48h: show all events in window (reasonable cap 30 to avoid huge payloads)
    const schedulePreview = previewList.slice(0, 30);
    await adapter.setStateAsync('analysis.energy.schedulePreview', { val: JSON.stringify(schedulePreview), ack: true });
}

// --- NEW FUNCTION: MONITOR & ENFORCE CALENDAR TARGETS ---
async function monitorEnforcements(adapter) {
    try {
        const stateId = 'analysis.energy.activeEnforcements';
        const currentState = await adapter.getStateAsync(stateId);
        if (!currentState || !currentState.val) return;

        let enforcements = [];
        try { enforcements = JSON.parse(currentState.val); } catch(e) { return; }

        if (!Array.isArray(enforcements) || enforcements.length === 0) return;

        const now = Date.now();
        const devices = adapter.config.devices || [];
        let changed = false;

        for (let i = enforcements.length - 1; i >= 0; i--) {
            const rule = enforcements[i];

            // 1. Check Expiry
            if (now >= rule.until) {
                adapter.log.info(`📅 [ENFORCEMENT] Kalender-Event in ${rule.room} gestartet/vorbei. Gebe Raum frei.`);
                enforcements.splice(i, 1);
                changed = true;
                continue;
            }

            // 2. Check Temperature
            const deviceInRoom = devices.find(d => normalize(d.location) === normalize(rule.room) && (d.type === 'temperature' || d.type === 'thermostat'));
            if (deviceInRoom) {
                const targetId = await findRelatedId(adapter, deviceInRoom.id, 'setpoint');
                if (targetId) {
                    const currentSetState = await adapter.getForeignStateAsync(targetId);
                    if (currentSetState && typeof currentSetState.val === 'number') {
                        // CRITICAL CHECK: If Hardware Profile dropped it below 15°C (e.g. 6°C or 12°C)
                        if (currentSetState.val < 15.0) {
                            adapter.log.warn(`🚨 [ENFORCEMENT] Hardware-Profil hat ${rule.room} auf ${currentSetState.val}°C abgesenkt! Zwinge zurück auf ${rule.target}°C.`);
                            await adapter.setForeignStateAsync(targetId, rule.target);
                            await logAutomationAction(adapter, `[FORCE] ${rule.room}: ${currentSetState.val}°C -> ${rule.target}°C (Kalender-Schutz)`);
                        }
                    }
                }
            }
        }

        if (changed) {
            await adapter.setStateAsync(stateId, { val: JSON.stringify(enforcements), ack: true });
        }

    } catch(e) { adapter.log.error(`Enforcement Monitor Error: ${e.message}`); }
}

async function checkCalendarTriggers(adapter) {
    if (!adapter.config.useCalendar || !adapter.config.calendarInstance) return;

    await updateSchedulePreview(adapter);

    let warmupMap = {};
    let warmupSources = {};
    try {
        const wState = await adapter.getStateAsync('analysis.energy.warmupTimes');
        if (wState && wState.val) warmupMap = JSON.parse(wState.val);
        const sState = await adapter.getStateAsync('analysis.energy.warmupSources');
        if (sState && sState.val) warmupSources = JSON.parse(sState.val);
    } catch(e) {}

    let warmupConfig = { "default": 21 };
    try {
        const cState = await adapter.getStateAsync('analysis.energy.warmupTargets');
        if (cState && cState.val) warmupConfig = JSON.parse(cState.val);
    } catch(e) {}

    // Load active enforcements to append
    let activeEnforcements = [];
    try {
        const aeState = await adapter.getStateAsync('analysis.energy.activeEnforcements');
        if (aeState && aeState.val) activeEnforcements = JSON.parse(aeState.val);
    } catch(e) {}

    try {
        const calState = await adapter.getForeignStateAsync(`${adapter.config.calendarInstance}.data.table`);
        if (!calState || !calState.val) return;
        const events = JSON.parse(calState.val);
        const now = Date.now();
        const devices = adapter.config.devices || [];
        const allowedCals = adapter.config.calendarSelection || [];

        let enforcementChanged = false;

        for (const ev of events) {
            if (ev._calName && allowedCals.length > 0 && !allowedCals.includes(ev._calName)) continue;
            const dateVal = ev._date || ev.eventStart || ev.date;
            if (!dateVal) continue;
            const start = new Date(dateVal);
            if (isNaN(start.getTime())) continue;

            const title = (ev.event || ev.summary || '').toLowerCase();

            // 1. GLOBAL TRIGGER
            if (title.includes('urlaub ende') || title.includes('rückkehr') || title.includes('ankunft')) {
                let maxMinutes = 0;
                Object.values(warmupMap).forEach(m => { if (m > maxMinutes) maxMinutes = m; });
                if (maxMinutes === 0) maxMinutes = 120;
                const warmupTime = start.getTime() - (maxMinutes * 60000);

                if (now >= warmupTime && now < start.getTime()) {
                    if (adapter.currentSystemMode !== 'normal') {
                        adapter.log.info(`📅 SMART SCHEDULE (Phase): 'Globaler Start' erkannt. Heize Haus auf (Vorlauf: ${maxMinutes} min).`);
                        await adapter.setStateAsync('system.mode', { val: 'normal', ack: false });
                    }
                }
            }

            // 2. ROOM TRIGGER
            for (const dev of devices) {
                if (dev.location) {
                    const roomName = dev.location.toLowerCase();
                    const devName = (dev.name || '').toLowerCase();

                    // --- SMART MATCHING (Location OR Device Name) ---
                    // Example: Calendar "Jana" matches device "Heizung Jana" or location "Kinderzimmer"
                    // We check if title contains room name OR (if device name is significant > 3 chars) title contains device name
                    let isMatch = title.includes(roomName);
                    if (!isMatch && devName.length > 3 && title.includes(devName)) {
                        isMatch = true;
                    }

                    if (isMatch) {
                        // FIX: Use Robust Lookup to get the AI-calculated warmup time (e.g. from 'ug_schlafen')
                        const roomMinutes = getWarmupRobust(warmupMap, dev.location);

                        const roomSource = warmupSources[dev.location] || 'Classic';
                        const warmupTime = start.getTime() - (roomMinutes * 60000);

                        if (now >= warmupTime && now < start.getTime()) {
                            const lastRun = lastActions[`cal_${dev.location}`];
                            if (lastRun && (now - lastRun < CAL_COOLDOWN_MS)) continue;

                            const setpointId = await findRelatedId(adapter, dev.id, 'setpoint');
                            if (setpointId) {
                                let targetTemp = warmupConfig[dev.location];
                                if (targetTemp === undefined) targetTemp = warmupConfig['default'];
                                if (targetTemp === undefined) targetTemp = 21.0;

                                const currentState = await adapter.getForeignStateAsync(setpointId);
                                if (currentState && typeof currentState.val === 'number' && currentState.val < (targetTemp - 0.5)) {
                                    adapter.log.info(`📅 SMART SCHEDULE [${roomSource}]: Raum-Trigger '${dev.location}' (Match: ${title}) aktiv. Heize auf ${targetTemp}°C (Vorlauf: ${roomMinutes} min).`);
                                    await adapter.setForeignStateAsync(setpointId, targetTemp);
                                    await logAutomationAction(adapter, `[CAL] ${dev.location} -> ${targetTemp}°C (via ${roomSource})`);
                                    lastActions[`cal_${dev.location}`] = now;

                                    // --- ADD ENFORCEMENT LOCK ---
                                    // Protect this room until the event actually starts
                                    // If hardware profile jumps in 5 mins later, we catch it.
                                    const existingIdx = activeEnforcements.findIndex(e => e.room === dev.location);
                                    if (existingIdx !== -1) activeEnforcements.splice(existingIdx, 1);

                                    activeEnforcements.push({
                                        room: dev.location,
                                        target: targetTemp,
                                        until: start.getTime()
                                    });
                                    enforcementChanged = true;
                                }
                            }
                        }
                    }
                }
            }
        }

        if (enforcementChanged) {
            await adapter.setStateAsync('analysis.energy.activeEnforcements', { val: JSON.stringify(activeEnforcements), ack: true });
        }

    } catch(e) { adapter.log.warn(`Calendar Check Error: ${e.message}`); }
}

async function manageMpcIntervention(adapter, room, action) {
    try {
        const stateId = 'analysis.energy.mpcActiveInterventions';
        const currentState = await adapter.getStateAsync(stateId);
        let list = [];
        if (currentState && currentState.val) { try { list = JSON.parse(currentState.val); } catch(e) {} }
        const index = list.indexOf(room);
        if (action === 'add') {
            if (index === -1) { list.push(room); await adapter.setStateAsync(stateId, { val: JSON.stringify(list), ack: true }); }
        } else if (action === 'remove') {
            if (index !== -1) { list.splice(index, 1); await adapter.setStateAsync(stateId, { val: JSON.stringify(list), ack: true }); }
        }
    } catch(e) {}
}

// --- UPDATED: CLEANUP, WATCHDOG, SAFETY & ALIBI & PENALTY EXPIRATION ---
async function cleanupGhostInterventions(adapter) {
    try {
        const stateId = 'analysis.energy.mpcActiveInterventions';
        const currentState = await adapter.getStateAsync(stateId);
        if (!currentState || !currentState.val) return;

        const list = JSON.parse(currentState.val);
        if (!Array.isArray(list) || list.length === 0) return;

        // Lade Konfigurationen & Zustände
        let warmupConfig = { "default": 21 };
        try {
            const cState = await adapter.getStateAsync('analysis.energy.warmupTargets');
            if (cState && cState.val) warmupConfig = JSON.parse(cState.val);
        } catch(e) {}

        let ventilationAlerts = [];
        try {
            const vState = await adapter.getStateAsync('analysis.energy.ventilationAlerts');
            if (vState && vState.val) ventilationAlerts = JSON.parse(vState.val);
        } catch(e) {}

        // --- NEU v0.29.12: RL Penalties laden & Alte löschen ---
        let rlPenalties = {};
        let penaltiesChanged = false;
        try {
            const pState = await adapter.getStateAsync('analysis.energy.rlPenalties');
            if (pState && pState.val) rlPenalties = JSON.parse(pState.val);
        } catch(e) {}

        // Check Expiration (3 Tage)
        if (rlPenalties._meta) {
            const now = Date.now();
            for(const [key, ts] of Object.entries(rlPenalties._meta)) {
                if (now - ts > PENALTY_TTL) {
                    delete rlPenalties[key];
                    delete rlPenalties._meta[key];
                    penaltiesChanged = true;
                    adapter.log.info(`🛡️ [PENALTY EXPIRED] Lern-Schutz für '${key}' nach 3 Tagen abgelaufen. System darf wieder sparen.`);
                }
            }
        }
        // ---------------------------------------------------

        const devices = adapter.config.devices || [];
        let changed = false;

        // Check every room that claims to be "MPC Active"
        for (let i = list.length - 1; i >= 0; i--) {
            const room = list[i];
            const deviceInRoom = devices.find(d => normalize(d.location) === normalize(room) && (d.type === 'temperature' || d.type === 'thermostat'));

            // FIX 4: KARTEILEICHEN (Gerät existiert nicht mehr)
            if (!deviceInRoom) {
                adapter.log.warn(`🧹 [MPC CLEANUP] Raum '${room}' hat kein Gerät mehr. Lösche Eintrag.`);
                list.splice(i, 1);
                changed = true;
                continue;
            }

            if (deviceInRoom) {
                const targetId = await findRelatedId(adapter, deviceInRoom.id, 'setpoint');
                const currentTempState = await adapter.getForeignStateAsync(deviceInRoom.id);

                if (targetId) {
                    const currentSetState = await adapter.getForeignStateAsync(targetId);

                    if (currentSetState && typeof currentSetState.val === 'number') {

                        let removeStatus = false;
                        let triggerReason = '';

                        // CHECK A: Manuelle Änderung (Abweichung von 17°C)
                        if (Math.abs(currentSetState.val - ECO_TEMP) > 0.5) {
                            removeStatus = true;
                            triggerReason = 'manual';
                        }

                        // CHECK B: Watchdog / Komfort-Schutz
                        if (!removeStatus && currentTempState && typeof currentTempState.val === 'number') {
                            const roomTarget = warmupConfig[room] || warmupConfig['default'] || 21.0;
                            // Sicherheitsmarge 0.2 Grad
                            if (currentTempState.val < (roomTarget + 0.2)) {
                                removeStatus = true;
                                triggerReason = 'too_cold';
                            }
                        }

                        if (removeStatus) {
                            if (triggerReason === 'manual') {
                                adapter.log.info(`🧹 [MPC CLEANUP] ${room} ist auf ${currentSetState.val}°C (nicht ${ECO_TEMP}°C). Entferne Status.`);

                                // FIX 3: KALENDER-ALIBI (Keine Strafe wenn Kalender aktiv war)
                                const lastCal = lastActions[`cal_${room}`];
                                const isCalendarAction = lastCal && (Date.now() - lastCal < 2 * 60 * 1000);

                                if (!isCalendarAction && currentSetState.val > (ECO_TEMP + 0.5)) {
                                    if (adapter.sendToPythonWrapper) {
                                        adapter.log.info(`🎓 [RL-FEEDBACK] Lerne aus Fehler: ${room} wurde manuell erhöht.`);
                                        adapter.sendToPythonWrapper('TRAIN_RL_PENALTY', { room: room });
                                    }

                                    // --- NEU v0.29.12: Timestamp für Expiration setzen ---
                                    const penaltyKey = `${room}_${new Date().getHours()}`;
                                    // Wir setzen den Eintrag lokal, damit wir den Timestamp haben.
                                    // Python wird ihn ggf. überschreiben, aber wir versuchen, das _meta Object zu retten.
                                    if (!rlPenalties[penaltyKey]) {
                                        rlPenalties[penaltyKey] = 1;
                                        if(!rlPenalties._meta) rlPenalties._meta = {};
                                        rlPenalties._meta[penaltyKey] = Date.now();
                                        penaltiesChanged = true;
                                    }
                                    // -----------------------------------------------------

                                } else if (isCalendarAction) {
                                    adapter.log.info(`📅 [MPC INFO] ${room} durch Kalender geändert. Keine RL-Strafe.`);
                                }

                            } else if (triggerReason === 'too_cold') {
                                // FIX 1: GARTEN-HEIZUNG SCHUTZ (Kein Heizen bei offenem Fenster)
                                let windowIsOpen = false;

                                // A) Check AI Alerts
                                if (ventilationAlerts.find(a => a.room === room)) windowIsOpen = true;

                                // B) Check Physical Sensors
                                const winSensors = devices.filter(d => normalize(d.location) === normalize(room) && (d.type === 'window' || d.type === 'sensor' || d.type === 'contact'));
                                for (const ws of winSensors) {
                                    try {
                                        const s = await adapter.getForeignStateAsync(ws.id);
                                        if (s && (s.val === true || s.val === 1 || String(s.val).toLowerCase() === 'open')) windowIsOpen = true;
                                    } catch(e) {}
                                }

                                if (windowIsOpen) {
                                    adapter.log.info(`🌬️ [MPC WATCHDOG] ${room} ist zu kalt, ABER Fenster offen/Lüftung erkannt. Heize NICHT, entferne nur Status.`);
                                } else {
                                    // Normaler Rettungseinsatz
                                    const roomTarget = warmupConfig[room] || warmupConfig['default'] || 21.0;
                                    adapter.log.info(`🚨 [MPC WATCHDOG] ${room} erreicht Limit (${currentTempState.val}°C < ${roomTarget + 0.2}°C). Sparmodus beendet!`);
                                    await adapter.setForeignStateAsync(targetId, roomTarget);
                                    await logAutomationAction(adapter, `[WATCHDOG] ${room}: Puffer leer -> Heizen auf ${roomTarget}°C`);

                                    // FIX 4: JO-JO SPERRE (2 Stunden Pause)
                                    lastActions[`rescue_${room}`] = Date.now();
                                }
                            }

                            list.splice(i, 1);
                            changed = true;
                        }
                    }
                }
            }
        }

        if (changed) {
            await adapter.setStateAsync(stateId, { val: JSON.stringify(list), ack: true });
        }

        if (penaltiesChanged) {
            await adapter.setStateAsync('analysis.energy.rlPenalties', { val: JSON.stringify(rlPenalties), ack: true });
        }

    } catch(e) {}
}

async function applyEnergySavings(adapter, proposals) {
    // 1. ZUERST AUFRÄUMEN (Watchdog + RL)
    await cleanupGhostInterventions(adapter);

    // 2. DANN NEUE VORSCHLÄGE PRÜFEN
    if (!proposals || proposals.length === 0) return;
    const devices = adapter.config.devices || [];
    const now = Date.now();
    for (const proposal of proposals) {
        const room = proposal.room;
        const minutes = proposal.minutes_safe;
        const targetTemp = proposal.target || 21.0;

        // FIX 4: JO-JO CHECK (Wenn kürzlich gerettet, ignorieren)
        if (lastActions[`rescue_${room}`] && (now - lastActions[`rescue_${room}`] < RESCUE_LOCK_MS)) {
            // Optional: Log nur einmal pro Stunde um Spam zu vermeiden
            continue;
        }

        const deviceInRoom = devices.find(d => normalize(d.location) === normalize(room) && (d.type === 'temperature' || d.type === 'thermostat'));
        if (!deviceInRoom) continue;
        const targetId = await findRelatedId(adapter, deviceInRoom.id, 'setpoint');
        if (targetId) {
            if (lastActions[`mpc_${room}`] && (now - lastActions[`mpc_${room}`] < 30 * 60 * 1000)) continue;
            const currentSetState = await adapter.getForeignStateAsync(targetId);
            if (currentSetState && typeof currentSetState.val === 'number') {
                const currentSet = currentSetState.val;
                if (currentSet !== ECO_TEMP) { await manageMpcIntervention(adapter, room, 'remove'); }
                if (minutes > 30) {
                    if (currentSet > (ECO_TEMP + 0.5)) {
                        adapter.log.info(`🍃 [MPC ACTION] Senke ${room} auf ${ECO_TEMP}°C! (Puffer: ${minutes} min)`);
                        await adapter.setForeignStateAsync(targetId, ECO_TEMP);
                        await manageMpcIntervention(adapter, room, 'add');
                        lastActions[`mpc_${room}`] = now;
                        await logAutomationAction(adapter, `[MPC] ${room}: Absenkung auf ${ECO_TEMP}°C`);
                    }
                } else if (minutes <= 15) {
                    if (currentSet < targetTemp) {
                        adapter.log.info(`🔥 [MPC ACTION] Heize ${room} wieder auf ${targetTemp}°C! (Puffer leer).`);
                        await adapter.setForeignStateAsync(targetId, targetTemp);
                        await manageMpcIntervention(adapter, room, 'remove');
                        lastActions[`mpc_${room}`] = now;
                        await logAutomationAction(adapter, `[MPC] ${room}: Aufheizen auf ${targetTemp}°C`);
                    }
                }
            }
        } else { adapter.log.warn(`[MPC WARNING] Kein Setpoint für ${room} gefunden!`); }
    }
}

module.exports = {
    handlePrediction,
    applyEnergySavings,
    scanThermostats,
    checkCalendarTriggers,
    monitorEnforcements,
    updateSchedulePreview,
    cleanupGhostInterventions
};