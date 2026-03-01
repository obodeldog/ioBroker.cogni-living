'use strict';

/**
 * PYTHON BRIDGE
 * v0.29.33 - Fix: Mapping Consistency (Normalizes Energy Targets & Training Data)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const setup = require('./setup');
const automation = require('./automation');

let pythonProcess = null;
let pendingCallbacks = new Map(); // Speichert Callbacks für asynchrone Responses

function send(adapter, command, payload = {}, callback = null) {
    if (!pythonProcess || !pythonProcess.stdin.writable) return;

    // --- GATEWAY INTERCEPTOR ---

    // 1. TOPOLOGIE SETZEN
    if (command === 'SET_TOPOLOGY') {
        const cleanPayload = JSON.parse(JSON.stringify(payload));
        if (cleanPayload.rooms && Array.isArray(cleanPayload.rooms)) {
            cleanPayload.rooms = cleanPayload.rooms.map(r => setup.normalizeRoomId(r));
            adapter.log.info(`[Bridge-Debug] Setting Topology Rooms (Sample): ${cleanPayload.rooms.slice(0, 3).join(', ')}...`);
        }
        if (cleanPayload.monitored && Array.isArray(cleanPayload.monitored)) {
            cleanPayload.monitored = cleanPayload.monitored.map(r => setup.normalizeRoomId(r));
        }
        payload = cleanPayload;
    }

    // 2. TRAINING SEQUENZEN
    if ((command === 'TRAIN_TOPOLOGY' || command === 'TRAIN_SECURITY') && payload.sequences) {
        if (Array.isArray(payload.sequences)) {
            try {
                if(payload.sequences.length > 0) {
                    adapter.log.debug(`[Bridge-Debug] Raw Sequence [0]: ${JSON.stringify(payload.sequences[0]).substring(0, 100)}...`);
                }

                payload.sequences = payload.sequences.map(seqObj => {
                    if (seqObj && seqObj.steps && Array.isArray(seqObj.steps)) {
                        return seqObj.steps.map(step => {
                            const rawName = step.loc || step.location || step;
                            return setup.normalizeRoomId(rawName);
                        });
                    }
                    else if (Array.isArray(seqObj)) {
                        return seqObj.map(r => setup.normalizeRoomId(r));
                    }
                    return [];
                });

                if(payload.sequences.length > 0) {
                    adapter.log.info(`[Bridge-Debug] Normalized Sequence [0] (Unpacked): ${JSON.stringify(payload.sequences[0])}`);
                }

            } catch (e) {
                adapter.log.warn(`Gateway Unpack Error: ${e.message}`);
                payload.sequences = [];
            }
        } else {
            payload.sequences = [];
        }
    }

    // 3. Einzelner Raum
    if (payload.room && typeof payload.room === 'string') {
        payload.room = setup.normalizeRoomId(payload.room);
    }

    // 4. Energy Maps (Current Temps)
    if (payload.current_temps && typeof payload.current_temps === 'object') {
        const clean = {};
        for(const [k,v] of Object.entries(payload.current_temps)) clean[setup.normalizeRoomId(k)] = v;
        payload.current_temps = clean;
    }

    // 5. Energy Configs (Targets) - NEU: Fix für "Lost in Translation"
    // Wir normalisieren auch die Konfigurations-Keys, damit Python "og_kind_2" in der Config findet.
    if (payload.warmup_targets && typeof payload.warmup_targets === 'object') {
        const clean = {};
        for(const [k,v] of Object.entries(payload.warmup_targets)) clean[setup.normalizeRoomId(k)] = v;
        payload.warmup_targets = clean;
    }
    if (payload.targets && typeof payload.targets === 'object') {
        const clean = {};
        for(const [k,v] of Object.entries(payload.targets)) clean[setup.normalizeRoomId(k)] = v;
        payload.targets = clean;
    }

    // 6. Training Data (Energy) - NEU: Fix damit das Model "og_kind_2" lernt statt "OG Kind 2"
    if (command === 'TRAIN_ENERGY' && payload.points && Array.isArray(payload.points)) {
        payload.points.forEach(p => {
            if (p && p.room) p.room = setup.normalizeRoomId(p.room);
        });
    }
    // ---------------------------

    const msg = JSON.stringify({ command, ...payload });
    try {
        pythonProcess.stdin.write(msg + '\n');
        
        // Speichere Callback für asynchrone Response
        if (callback) {
            pendingCallbacks.set(command, callback);
            
            // Timeout nach 10 Sekunden
            setTimeout(() => {
                if (pendingCallbacks.has(command)) {
                    pendingCallbacks.delete(command);
                    adapter.log.warn(`[PythonBridge] Timeout for command: ${command}`);
                }
            }, 10000);
        }
    } catch(e) {}
}

function handleResult(adapter, data) {
    // Prüfe ob ein Callback wartet (z.B. ANALYZE_HEATMAP → HEATMAP_RESULT)
    for (const [command, callback] of pendingCallbacks.entries()) {
        // Mapping: ANALYZE_HEATMAP → HEATMAP_RESULT
        const expectedResponse = command.replace('ANALYZE_', '') + '_RESULT';
        if (data.type === expectedResponse || data.type === command + '_RESULT') {
            pendingCallbacks.delete(command);
            adapter.log.debug(`[PythonBridge] Callback matched: ${command} → ${data.type}`);
            if (command === 'ANALYZE_LONGTERM_TRENDS' && data.payload?.night?.last_night_normal !== undefined) {
                adapter.setStateAsync('analysis.health.lastNightNormal', { val: data.payload.night.last_night_normal, ack: true });
            }
            callback(data);
            return;
        }
    }
    
    if (data.type === 'PONG') adapter.log.debug(`🐍 Python Pong`);

    else if (data.type === 'SECURITY_RESULT') {
        const { anomaly_score, is_anomaly, threshold, explanation } = data.payload;
        adapter.setStateAsync('analysis.security.lastScore', { val: anomaly_score, ack: true });
        adapter.setStateAsync('analysis.security.lastCheck', { val: new Date().toISOString(), ack: true });
        if (threshold) adapter.setStateAsync('analysis.security.currentThreshold', { val: threshold, ack: true });
        if (is_anomaly) {
            let msg = `Ungewöhnliches Bewegungsmuster! (Score: ${anomaly_score.toFixed(4)})`;
            if (explanation && explanation !== 'Unknown') msg += `\nGrund: ${explanation}`;
            adapter.setStateAsync('analysis.isAlert', { val: true, ack: true });
            adapter.setStateAsync('analysis.alertReason', { val: msg, ack: true });
            setup.sendNotification(adapter, `⚠️ SECURITY ALARM: ${msg}`, false, true);
        }
    }
    else if (data.type === 'TRAINING_COMPLETE') {
        const details = data.payload.details || '';
        const threshold = data.payload.threshold;
        const statusText = data.payload.success ? `Success: ${new Date().toLocaleTimeString()} (${details})` : `Failed: ${data.payload.reason}`;
        adapter.setStateAsync('analysis.training.status', { val: statusText, ack: true });
        if (data.payload.success && threshold) adapter.setStateAsync('analysis.security.currentThreshold', { val: threshold, ack: true });
    }
    else if (data.type === 'GRAPH_TRAINED') {
        const details = `Graph Updated (${data.payload.rooms.length} Rooms)`;
        adapter.setStateAsync('analysis.training.status', { val: details, ack: true });

        // --- NEU: WIR SPEICHERN DAS GEHIRN FÜR DAS DASHBOARD ---
        // Damit SecurityTab.tsx echte Prozentwerte anzeigen kann
        if (data.payload.matrix && data.payload.rooms) {
            adapter.setStateAsync('analysis.security.topologyMatrix', { val: JSON.stringify(data.payload), ack: true });
        }
        // -------------------------------------------------------
    }

    // --- STANDARD HANDLER ---
    else if (data.type === 'ENERGY_TRAIN_RESULT') { if (data.payload.success) { try { const r = JSON.parse(data.payload.details); if (r.insulation) adapter.setStateAsync('analysis.energy.insulationScore', { val: JSON.stringify(r.insulation), ack: true }); if (r.heating) adapter.setStateAsync('analysis.energy.heatingScore', { val: JSON.stringify(r.heating), ack: true }); } catch(e){} } }
    else if (data.type === 'HEALTH_TRAIN_RESULT') { adapter.log.info(`✅ HEALTH TRAINED.`); adapter.setStateAsync('analysis.health.lastCheck', { val: new Date().toLocaleDateString(), ack: true }); }
    else if (data.type === 'HEALTH_RESULT') {
        adapter.setStateAsync('analysis.health.isAnomaly', { val: data.payload.is_anomaly, ack: true });
        if (data.payload.anomaly_score !== undefined && data.payload.anomaly_score !== null) {
            adapter.setStateAsync('analysis.health.anomalyScore', { val: data.payload.anomaly_score, ack: true });
        }
    }
    else if (data.type === 'HEALTH_TREND_RESULT') { adapter.setStateAsync('analysis.health.activityTrend', { val: data.payload.trend_percent, ack: true }); adapter.log.info(`📈 Health Trend: ${data.payload.details}`); }
    else if (data.type === 'GAIT_RESULT') { if (data.payload.speed_trend !== undefined) adapter.setStateAsync('analysis.health.gaitSpeed', { val: data.payload.speed_trend, ack: true }); if (data.payload.sensors) adapter.setStateAsync('analysis.health.gaitSensors', { val: data.payload.sensors.join(', '), ack: true }); if (data.payload.proof) adapter.setStateAsync('analysis.health.gaitDebug', { val: data.payload.proof, ack: true }); }
    else if (data.type === 'ENERGY_PREDICT_RESULT') { if (data.payload.forecast) adapter.setStateAsync('analysis.energy.forecast', { val: JSON.stringify(data.payload.forecast), ack: true }); }
    else if (data.type === 'WARMUP_RESULT') { if (data.payload.times) adapter.setStateAsync('analysis.energy.warmupTimes', { val: JSON.stringify(data.payload.times), ack: true }); if (data.payload.sources) adapter.setStateAsync('analysis.energy.warmupSources', { val: JSON.stringify(data.payload.sources), ack: true }); if (data.payload.details) adapter.setStateAsync('analysis.energy.warmupDetails', { val: JSON.stringify(data.payload.details), ack: true }); }
    else if (data.type === 'RL_PENALTY_UPDATE') { if (data.payload.penalties) adapter.setStateAsync('analysis.energy.rlPenalties', { val: JSON.stringify(data.payload.penalties), ack: true }); }
    else if (data.type === 'PINN_PREDICT_RESULT') { if (data.payload.forecast) adapter.setStateAsync('analysis.energy.pinnForecast', { val: JSON.stringify(data.payload.forecast), ack: true }); }
    else if (data.type === 'VENTILATION_ALERT') { if (data.payload.alerts) adapter.setStateAsync('analysis.energy.ventilationAlerts', { val: JSON.stringify(data.payload.alerts), ack: true }); }
    else if (data.type === 'ENERGY_OPTIMIZE_RESULT') {
        const { proposals } = data.payload;
        adapter.getState('analysis.energy.mpcActive', (err, state) => {
            if (state && state.val === true && proposals && proposals.length > 0) automation.applyEnergySavings(adapter, proposals);
        });
    }
    else if (data.type === 'SIGNAL_RESULT') {
        const { propagation } = data.payload;
        let topRoom = "Unknown", topProb = 0;
        if (propagation) { const e = Object.entries(propagation); if (e.length > 0) { topRoom = e[0][0]; topProb = e[0][1]; } }
        adapter.setStateAsync('analysis.prediction.nextRoom', { val: topRoom, ack: true });
        adapter.setStateAsync('analysis.prediction.confidence', { val: topProb, ack: true });
        automation.handlePrediction(adapter, topRoom, topProb);
    }
    else if (data.type === 'TRACKER_RESULT') {
        const { probabilities } = data.payload;
        if (probabilities) {
            adapter.setStateAsync('analysis.prediction.trackerState', { val: JSON.stringify(probabilities), ack: true });
            const s = Object.keys(probabilities);
            if (s.length > 0) { adapter.setStateAsync('analysis.prediction.trackerTopRoom', { val: s[0], ack: true }); adapter.setStateAsync('analysis.prediction.trackerConfidence', { val: probabilities[s[0]], ack: true }); }
        }
    }
    else if (data.type === 'COMFORT_RESULT') { if (data.payload.patterns) adapter.setStateAsync('analysis.automation.detectedPatterns', { val: JSON.stringify(data.payload.patterns), ack: true }); }
}

function startService(adapter, pythonExe) {
    let spawnCmd = 'python3';
    if (fs.existsSync(pythonExe)) spawnCmd = pythonExe;
    const rootPath = path.join(__dirname, '..', 'service.py');
    const serviceDir = path.join(__dirname, '..', 'python_service', 'service.py');
    let finalPath = fs.existsSync(rootPath) ? rootPath : (fs.existsSync(serviceDir) ? serviceDir : null);

    if (!finalPath) { adapter.log.error(`❌ CRITICAL: 'service.py' not found!`); return; }

    try {
        adapter.log.info(`🚀 Starting Python Bridge using: ${spawnCmd} ${finalPath}`);
        pythonProcess = spawn(spawnCmd, [finalPath]);
        pythonProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                const msg = line.trim();
                if (!msg) return;
                if (msg.startsWith('[LOG]')) adapter.log.debug(`[PYTHON] ${msg.substring(5).trim()}`);
                else if (msg.startsWith('[RESULT]')) { try { const json = JSON.parse(msg.substring(8).trim()); handleResult(adapter, json); } catch(e) {} }
            });
        });

        // --- FIX v0.29.32: SMART LOG FILTERING ---
        // Wir untersuchen den Fehler-Kanal. Wenn es nur eine Warnung ist, loggen wir WARN (gelb), nicht ERROR (rot).
        pythonProcess.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (!msg) return;

            // Schlüsselwörter für Warnungen (PyTorch FutureWarnings, etc.)
            if (msg.includes('FutureWarning') || msg.includes('UserWarning') || msg.includes('DeprecationWarning')) {
                adapter.log.warn(`[PYTHON WARN] ${msg}`);
            } else {
                // Echte Fehler bleiben rot
                adapter.log.error(`[PYTHON ERR] ${msg}`);
            }
        });
        // -----------------------------------------

        pythonProcess.on('close', (code) => { adapter.log.warn(`Python process exited with code ${code}`); pythonProcess = null; });
        adapter.sendToPythonWrapper = (cmd, payload) => send(adapter, cmd, payload);
    } catch(e) { adapter.log.error(`Error launching Python: ${e.message}`); }
}

function stopService(adapter) { if (pythonProcess) { try { pythonProcess.kill(); } catch(e) {} pythonProcess = null; } }

module.exports = { startService, stopService, send };