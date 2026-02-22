'use strict';

/**
 * SETUP & OBJECT DEFINITIONS
 * Version: 0.29.15 (Central Room Normalization & Missing Objects)
 */

const SYSTEM_MODES = { NORMAL: 'normal', VACATION: 'party', PARTY: 'party', GUEST: 'guest' };
const SYSTEM_DP_MODE = 'system.mode';

// --- ZENTRALE NORMALISIERUNG (Der "Ausweis") ---
function normalizeRoomId(str) {
    if (!str) return 'unknown';
    if (typeof str !== 'string') return String(str);
    // 1. Kleinbuchstaben
    // 2. Umlaute ersetzen
    // 3. Leerzeichen zu Unterstrich
    // 4. Alles weg, was nicht a-z, 0-9 oder _ ist
    return str.toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
}
// ----------------------------------------------

async function initZombies(adapter) {
    try {
        const zombies = ['analysis.history_debug_00', 'events.history_debug_00'];
        for (const id of zombies) {
            try {
                const obj = await adapter.getObjectAsync(id);
                if (obj) await adapter.delObjectAsync(id);
            } catch(e) {}
        }
    } catch(e) {}
}

async function checkLicense(key) { return true; }

async function initHistory(adapter) {
    try {
        const h = await adapter.getStateAsync('events.history');
        if (h && h.val) { adapter.eventHistory = JSON.parse(h.val.toString()); }
    } catch (e) { adapter.eventHistory = []; }
    try {
        const h = await adapter.getStateAsync('analysis.analysisHistory');
        if (h && h.val) adapter.analysisHistory = JSON.parse(h.val.toString());
    } catch (e) { adapter.analysisHistory = []; }
    if (adapter.eventHistory && adapter.eventHistory.length > 0) {
        adapter.log.info(`Restoring sensor cache...`);
        for (let i = adapter.eventHistory.length - 1; i >= 0; i--) {
            const evt = adapter.eventHistory[i];
            if (evt && evt.id !== undefined && evt.value !== undefined) adapter.sensorLastValues[evt.id] = evt.value;
        }
    }
}

async function initSystemConfig(adapter) {
    try {
        const sysConf = await adapter.getForeignObjectAsync('system.config');
        if (sysConf && sysConf.common) adapter.systemConfig = { latitude: sysConf.common.latitude||0, longitude: sysConf.common.longitude||0, city: sysConf.common.city||'' };
    } catch(e){}
}

async function createAllObjects(adapter) {
    await adapter.extendObjectAsync('system', { type: 'channel', common: { name: 'System' }, native: {} });
    await adapter.extendObjectAsync(SYSTEM_DP_MODE, { type: 'state', common: { name: 'System Mode', type: 'string', role: 'state', read: true, write: true, def: SYSTEM_MODES.NORMAL }, native: {} });
    await adapter.setObjectNotExistsAsync('system.presenceWho', { type: 'state', common: { name: 'Who is present?', type: 'string', role: 'text', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('system.isPresent', { type: 'state', common: { name: 'Is Present?', type: 'boolean', role: 'indicator', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('system.pwaLocalUrl', { type: 'state', common: { name: 'Family PWA Local URL', type: 'string', role: 'url', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('system.pwaTunnelUrl', { type: 'state', common: { name: 'Family PWA Cloudflare URL', type: 'string', role: 'url', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('system.pwaToken', { type: 'state', common: { name: 'Family PWA Token (read-only)', type: 'string', role: 'text', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.safety.alarmAcknowledged', { type: 'state', common: { name: 'Alarm Acknowledged via PWA', type: 'string', role: 'json', read: true, write: true }, native: {} });

    await adapter.setObjectNotExistsAsync('events.lastEvent', { type: 'state', common: { name: 'Last raw event', type: 'string', role: 'json', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('events.history', { type: 'state', common: { name: 'Event History', type: 'string', role: 'json', read: true, write: false }, native: {} });

    // TRAINING
    await adapter.extendObjectAsync('analysis.training', { type: 'channel', common: { name: 'AI Training' }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.training.triggerSecurity', { type: 'state', common: { name: 'Train Security', type: 'boolean', role: 'button', read: true, write: true }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.training.triggerHealth', { type: 'state', common: { name: 'Train Health', type: 'boolean', role: 'button', read: true, write: true }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.training.triggerEnergy', { type: 'state', common: { name: 'Train Energy', type: 'boolean', role: 'button', read: true, write: true }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.training.triggerComfort', { type: 'state', common: { name: 'Train Comfort', type: 'boolean', role: 'button', read: true, write: true }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.training.triggerTopology', { type: 'state', common: { name: 'Build Topology', type: 'boolean', role: 'button', read: true, write: true }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.training.status', { type: 'state', common: { name: 'Training Status', type: 'string', role: 'text', read: true, write: false }, native: {} });

    // SECURITY & TOPOLOGY
    await adapter.extendObjectAsync('analysis.security', { type: 'channel', common: { name: 'Security Monitor' }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.security.lastScore', { type: 'state', common: { name: 'Anomaly Score', type: 'number', role: 'value', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.security.currentThreshold', { type: 'state', common: { name: 'Current Threshold', type: 'number', role: 'value', read: true, write: false, def: 0.05 }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.security.lastCheck', { type: 'state', common: { name: 'Last Check', type: 'string', role: 'date', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.security.learningStatus', { type: 'state', common: { name: 'Learning Mode Status', type: 'string', role: 'json', read: true, write: false, def: '{"active":false,"label":"none"}' }, native: {} });

    // --- FIX: MISSING ALARM STATE ---
    await adapter.setObjectNotExistsAsync('security.alarm_triggered', { type: 'state', common: { name: 'Alarm Triggered (Infrasound)', type: 'boolean', role: 'indicator.alarm', read: true, write: true, def: false }, native: {} });

    // TOPOLOGY STRUCTURE
    await adapter.extendObjectAsync('analysis.topology', { type: 'channel', common: { name: 'Graph Topology' }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.topology.structure', { type: 'state', common: { name: 'Graph Structure (Adjacency Matrix)', type: 'string', role: 'json', read: true, write: false, def: '{"rooms":[], "matrix":[]}' }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.security.topologyMatrix', { type: 'state', common: { name: 'Topology Matrix (Legacy)', type: 'string', role: 'json', read: true, write: false }, native: {} });

    // HEALTH
    await adapter.extendObjectAsync('analysis.health', { type: 'channel', common: { name: 'Health Analysis' }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.health.lastCheck', { type: 'state', common: { name: 'Last Check', type: 'string', role: 'date', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.health.isAnomaly', { type: 'state', common: { name: 'Anomaly Detected', type: 'boolean', role: 'indicator', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.health.trendDiagnosis', { type: 'state', common: { name: 'Trend', type: 'string', role: 'text', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.health.trendValue', { type: 'state', common: { name: 'Trend Value', type: 'number', role: 'value', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.health.todayVector', { type: 'state', common: { name: 'Today Vector (15m)', type: 'string', role: 'json', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.health.gaitSpeed', { type: 'state', common: { name: 'Gait Speed Trend', type: 'number', role: 'value', read: true, write: false }, native: {} });

    // ENERGY
    await adapter.extendObjectAsync('analysis.energy', { type: 'channel', common: { name: 'Energy Intelligence' }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.energy.insulationScore', { type: 'state', common: { name: 'Insulation Score', type: 'string', role: 'text', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.energy.heatingScore', { type: 'state', common: { name: 'Heating Score', type: 'string', role: 'text', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.energy.forecast', { type: 'state', common: { name: 'Temperature Forecast', type: 'string', role: 'json', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.energy.mpcActive', { type: 'state', common: { name: 'MPC Autonomy Active', type: 'boolean', role: 'switch', read: true, write: true, def: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.energy.mpcActiveInterventions', { type: 'state', common: { name: 'Active MPC Interventions (Rooms)', type: 'array', role: 'list', read: true, write: false, def: '[]' }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.energy.pinnForecast', { type: 'state', common: { name: 'PINN AI Forecast', type: 'string', role: 'json', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.energy.schedulePreview', { type: 'state', common: { name: 'Schedule Preview (Next 48h)', type: 'string', role: 'json', read: true, write: false, def: '[]' }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.energy.warmupTimes', { type: 'state', common: { name: 'Estimated Warmup Minutes (Authoritative)', type: 'string', role: 'json', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.energy.warmupTargets', { type: 'state', common: { name: 'Warmup Target Config', type: 'string', role: 'json', read: true, write: true, def: '{"default": 21}' }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.energy.ventilationAlerts', { type: 'state', common: { name: 'Ventilation Alerts', type: 'string', role: 'json', read: true, write: false }, native: {} });

    // WARMUP SOURCES & DETAILS
    await adapter.setObjectNotExistsAsync('analysis.energy.warmupSources', { type: 'state', common: { name: 'Warmup Calculation Source (AI vs Physics)', type: 'string', role: 'json', read: true, write: false, def: '{}' }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.energy.warmupDetails', { type: 'state', common: { name: 'Warmup Comparison Details', type: 'string', role: 'json', read: true, write: false, def: '{}' }, native: {} });

    await adapter.setObjectNotExistsAsync('analysis.energy.rlPenalties', {
        type: 'state',
        common: { name: 'Reinforcement Learning Penalties (Blocked Rooms)', type: 'string', role: 'json', read: true, write: false, def: '{}' },
        native: {}
    });

    // LTM
    await adapter.extendObjectAsync('LTM', { type: 'channel', common: { name: 'LTM' }, native: {} });
    await adapter.extendObjectAsync('LTM.rawEventLog', { type: 'state', common: { name: 'Raw Log', type: 'string', role: 'json', read: true, write: false }, native: {} });
    await adapter.extendObjectAsync('LTM.dailyDigests', { type: 'state', common: { name: 'Daily Digests', type: 'string', role: 'json', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('LTM.trainingData.sequences', { type: 'state', common: { name: 'Sequences', type: 'string', role: 'json', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('LTM.trainingData.thermodynamics', { type: 'state', common: { name: 'Thermodynamics', type: 'string', role: 'json', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('LTM.processingStatus', { type: 'state', common: { name: 'Processing Status', type: 'string', role: 'text', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('LTM.triggerDailyDigest', { type: 'state', common: { name: 'Trigger Digest', type: 'boolean', role: 'button', read: true, write: true }, native: {} });

    // DRIFT
    await adapter.setObjectNotExistsAsync('LTM.baselineStatus', { type: 'state', common: { name: 'Baseline Status', type: 'string', role: 'text', read: true, write: false }, native: {} });
    await adapter.extendObjectAsync('LTM.driftAnalysis', { type: 'channel', common: { name: 'Drift Analysis' }, native: {} });
    await adapter.setObjectNotExistsAsync('LTM.driftAnalysis.baselineDrift', { type: 'state', common: { name: 'Baseline Drift', type: 'string', role: 'text', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('LTM.driftAnalysis.driftDetails', { type: 'state', common: { name: 'Drift Details', type: 'string', role: 'text', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('LTM.driftAnalysis.lastCheck', { type: 'state', common: { name: 'Last Check', type: 'number', role: 'date', read: true, write: false }, native: {} });

    // ANALYSIS GENERIC
    await adapter.setObjectNotExistsAsync('analysis.trigger', { type: 'state', common: { name: 'Trigger Analysis', type: 'boolean', role: 'button', read: true, write: true }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.triggerBriefing', { type: 'state', common: { name: 'Trigger Briefing', type: 'boolean', role: 'button', read: true, write: true }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.isAlert', { type: 'state', common: { name: 'Alert Status', type: 'boolean', role: 'indicator.alarm', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.alertReason', { type: 'state', common: { name: 'Alert Reason', type: 'string', role: 'text.alarm', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.activitySummary', { type: 'state', common: { name: 'Activity Summary', type: 'string', role: 'text', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.lastResult', { type: 'state', common: { name: 'Last Gemini Result', type: 'string', role: 'json', read: true, write: false }, native: {} });

    // AUTOMATION
    await adapter.setObjectNotExistsAsync('analysis.automation.patternDetected', { type: 'state', common: { name: 'Pattern Detected', type: 'boolean', role: 'indicator', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.automation.description', { type: 'state', common: { name: 'Description', type: 'string', role: 'text', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.automation.detectedPatterns', { type: 'state', common: { name: 'Detected Patterns', type: 'string', role: 'json', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.automation.targetId', { type: 'state', common: { name: 'Target ID', type: 'string', role: 'text', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.automation.targetValue', { type: 'state', common: { name: 'Target Value', type: 'string', role: 'text', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.automation.autoApply', { type: 'state', common: { name: 'Auto Apply', type: 'boolean', role: 'switch', read: true, write: true }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.automation.triggerAction', { type: 'state', common: { name: 'Trigger Action', type: 'boolean', role: 'button', read: true, write: true }, native: {} });
    await adapter.extendObjectAsync('analysis.prediction', { type: 'channel', common: { name: 'AI Prediction' }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.prediction.nextRoom', { type: 'state', common: { name: 'Predicted Next Room', type: 'string', role: 'text', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.prediction.confidence', { type: 'state', common: { name: 'Prediction Confidence', type: 'number', role: 'value', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.prediction.trackerState', { type: 'state', common: { name: 'Tracker Probabilities', type: 'string', role: 'json', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.prediction.trackerTopRoom', { type: 'state', common: { name: 'Tracker Best Guess', type: 'string', role: 'text', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.prediction.trackerConfidence', { type: 'state', common: { name: 'Tracker Confidence', type: 'number', role: 'value', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.automation.mode', { type: 'state', common: { name: 'Automation Mode', type: 'string', role: 'value', read: true, write: true, states: { 'off': 'Aus', 'simulate': 'Simulation (Nur Log)', 'active': 'Aktiv (Schalten)' }, def: 'off' }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.automation.lastAction', { type: 'state', common: { name: 'Last Automation Action', type: 'string', role: 'text', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.automation.actionLog', { type: 'state', common: { name: 'Automation Action Log (Last 50)', type: 'string', role: 'json', read: true, write: false, def: '[]' }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.automation.confidenceThreshold', { type: 'state', common: { name: 'Minimum Confidence for Action', type: 'number', role: 'level', read: true, write: true, min: 0.1, max: 1.0, def: 0.6 }, native: {} });

    // SAFETY
    await adapter.extendObjectAsync('analysis.safety', { type: 'channel', common: { name: 'Safety & Dead Man' }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.safety.deadMan.active', { type: 'state', common: { name: 'Dead Man Switch Active', type: 'boolean', role: 'switch', read: true, write: true, def: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.safety.deadMan.currentRoom', { type: 'state', common: { name: 'Current Monitored Room', type: 'string', role: 'text', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.safety.deadMan.alarmState', { type: 'state', common: { name: 'Alarm State', type: 'string', role: 'text', read: true, write: false, states: { 'ok': 'OK', 'pre_warn': 'Vorwarnung', 'alarm': 'ALARM' } }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.safety.deadMan.config', { type: 'state', common: { name: 'Room Timeouts (JSON)', type: 'string', role: 'json', read: true, write: true, def: '{}' }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.safety.deadMan.lastIgnored', { type: 'state', common: { name: 'Last Ignored Movement (GCN)', type: 'string', role: 'text', read: true, write: false }, native: {} });

    // --- FIX: MISSING STATES FROM LOG ---
    await adapter.setObjectNotExistsAsync('analysis.safety.deadMan.napProbability', { type: 'state', common: { name: 'Nap Probability', type: 'number', role: 'value', read: true, write: false }, native: {} });
    await adapter.setObjectNotExistsAsync('analysis.safety.deadMan.smartSleep', { type: 'state', common: { name: 'Smart Sleep Extension Active', type: 'boolean', role: 'indicator', read: true, write: false }, native: {} });
}

async function sendNotification(adapter, message, isHtml = false, isEmergency = false, title = 'NUUKANNI') {
    adapter.log.debug(`[Notify] Preparing to send: "${message}"`);
    if (adapter.config.notifyTelegramEnabled && adapter.config.notifyTelegramInstance) {
        const payload = { text: isHtml ? `<b>${title}</b>\n\n${message}` : `${title}\n\n${message}`, user: adapter.config.notifyTelegramRecipient || '' };
        if (isHtml) payload.parse_mode = 'HTML';
        await adapter.sendToAsync(adapter.config.notifyTelegramInstance, 'send', payload).catch(e => adapter.log.warn(`[Notify] Telegram error: ${e.message}`));
    }
    if (adapter.config.notifyPushoverEnabled && adapter.config.notifyPushoverInstance) {
        await adapter.sendToAsync(adapter.config.notifyPushoverInstance, 'send', {
            title: title,
            message: message,
            device: adapter.config.notifyPushoverRecipient || '',
            priority: isEmergency ? 1 : 0,
            html: isHtml ? 1 : 0,
            sound: isEmergency ? 'siren' : 'pushover'
        }).catch(e => adapter.log.warn(`[Notify] Pushover error: ${e.message}`));
    }
    if (adapter.config.notifyEmailEnabled && adapter.config.notifyEmailInstance && adapter.config.notifyEmailRecipient) {
        await adapter.sendToAsync(adapter.config.notifyEmailInstance, 'send', { to: adapter.config.notifyEmailRecipient, subject: title, text: message }).catch(e => adapter.log.warn(`[Notify] Email error: ${e.message}`));
    }
    if (adapter.config.notifyWhatsappEnabled && adapter.config.notifyWhatsappInstance && adapter.config.notifyWhatsappRecipient) {
        await adapter.sendToAsync(adapter.config.notifyWhatsappInstance, 'send', { phone: adapter.config.notifyWhatsappRecipient, text: `*${title}*\n\n${message}` }).catch(e => adapter.log.warn(`[Notify] WhatsApp error: ${e.message}`));
    }
}

module.exports = {
    initZombies,
    checkLicense,
    initHistory,
    initSystemConfig,
    createAllObjects,
    sendNotification,
    normalizeRoomId, // EXPORTED
    SYSTEM_MODES
};