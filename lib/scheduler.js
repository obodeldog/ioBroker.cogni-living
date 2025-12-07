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
        if (adapter.briefingJob) adapter.briefingJob.cancel();
        if (!adapter.config.briefingEnabled) return;
        const timeParts = (adapter.config.briefingTime || "08:00").split(":");
        const hour = parseInt(timeParts[0]) || 8;
        const minute = parseInt(timeParts[1]) || 0;
        const cron = `${minute} ${hour} * * *`;
        adapter.briefingJob = schedule.scheduleJob(cron, callbackFn);
    } catch(e) { adapter.log.error("Briefing Sched Error: " + e.message); }
}

module.exports = {
    setupLtmScheduler,
    setupModeResetScheduler,
    setupDriftAnalysisScheduler,
    setupBriefingScheduler
};