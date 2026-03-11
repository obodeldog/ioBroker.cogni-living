'use strict';

const schedule = require('node-schedule');

// WICHTIG: Diese Konstanten müssen hier definiert sein oder übergeben werden.
// Wir definieren sie hier lokal, das ist sauberer.
const LTM_SCHEDULE = '0 3 * * *';
const MODE_RESET_SCHEDULE = '0 4 * * *';
const AUTO_RESET_MODES = ['party', 'guest'];
const SYSTEM_DP_MODE = 'system.mode';

function setupLtmScheduler(adapter, callbackFn) {
    try {
        if (adapter.ltmJob) adapter.ltmJob.cancel();
        if (!adapter.isProVersion) return;
        adapter.ltmJob = schedule.scheduleJob(LTM_SCHEDULE, callbackFn);
    } catch(e){ adapter.log.error("LTM Sched Error: "+e.message)}
}

function setupModeResetScheduler(adapter) {
    try {
        if (adapter.modeResetJob) adapter.modeResetJob.cancel();
        adapter.modeResetJob = schedule.scheduleJob(MODE_RESET_SCHEDULE, async () => {
            // Hier brauchen wir Zugriff auf loadSystemMode...
            // Einfacher: Wir machen es inline, da es nur ein State-Check ist.
            try {
                const state = await adapter.getStateAsync(SYSTEM_DP_MODE);
                if (state && state.val && AUTO_RESET_MODES.includes(state.val)) {
                    await adapter.setStateAsync(SYSTEM_DP_MODE, { val: 'normal', ack: false });
                }
            } catch(e) {}
        });
    } catch(e){ adapter.log.error("Reset Sched Error: "+e.message)}
}

function setupDriftAnalysisScheduler(adapter, callbackFn) {
    try {
        if (adapter.driftAnalysisTimer) clearInterval(adapter.driftAnalysisTimer);
        if (!adapter.isProVersion) return;
        const hours = adapter.config.ltmDriftCheckIntervalHours || 24;
        adapter.driftAnalysisTimer = setInterval(callbackFn, hours * 3600000);
        // Initialer Run nach 5s
        setTimeout(callbackFn, 5000);
    } catch(e){ adapter.log.error("Drift Sched Error: "+e.message)}
}

function setupBriefingScheduler(adapter, callbackFn) {
    try {
        if (adapter.briefingJob) { adapter.briefingJob.cancel(); adapter.briefingJob = null; }

        if (!adapter.config.briefingEnabled) {
            adapter.log.info(`🌅 Briefing deaktiviert (briefingEnabled=false) – kein Job gestartet.`);
            return;
        }

        const timeParts = (adapter.config.briefingTime || "08:00").split(":");
        const targetHour   = parseInt(timeParts[0], 10);
        const targetMinute = parseInt(timeParts[1], 10) || 0;

        if (isNaN(targetHour)) {
            adapter.log.error(`🌅 Briefing: Ungültige Uhrzeit "${adapter.config.briefingTime}" – Job nicht gestartet.`);
            return;
        }

        // node-schedule (identisch zum LTM-Job der zuverlässig um 03:00 feuert)
        const cronExpr = `${targetMinute} ${targetHour} * * *`;
        adapter.briefingJob = schedule.scheduleJob(cronExpr, () => {
            adapter.log.info(`🌅 BRIEFING FIRED! Geplant: ${targetHour}:${targetMinute < 10 ? '0' : ''}${targetMinute} – Cron: ${cronExpr}`);
            callbackFn();
        });

        adapter.log.info(`🌅 Briefing geplant für ${targetHour}:${targetMinute < 10 ? '0' : ''}${targetMinute} Uhr (node-schedule, Cron: ${cronExpr})`);
    } catch(e) { adapter.log.error("Briefing Sched Error: " + e.message); }
}

// --- NEU: Die Sammel-Funktion, die main.js aufruft ---
function initSchedules(adapter) {
    adapter.log.info("⏰ Initializing All Schedules...");

    // 1. Morning Briefing starten
    setupBriefingScheduler(adapter, () => {
        adapter.log.info("☕ Triggering Morning Briefing schedule...");
        adapter.setState('analysis.triggerBriefing', { val: true, ack: false });
    });

    // 2. Mode Reset starten
    setupModeResetScheduler(adapter);

    // 3. LTM starten (Daily Digest)
    setupLtmScheduler(adapter, () => {
        adapter.log.info("📅 Triggering LTM Daily Digest schedule...");
        adapter.setState('LTM.triggerDailyDigest', { val: true, ack: false });
    });

    // 4. Drift Analysis starten (Dummy Callback, falls benötigt)
    setupDriftAnalysisScheduler(adapter, () => {
        // Optional: Trigger logic here if needed
    });
}

module.exports = {
    setupLtmScheduler,
    setupModeResetScheduler,
    setupDriftAnalysisScheduler,
    setupBriefingScheduler,
    initSchedules // <--- WICHTIG: Das muss exportiert werden!
};