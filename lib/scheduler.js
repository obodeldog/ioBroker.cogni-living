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
        
        // WICHTIG: node-schedule v2.1.1 unterstützt KEINE Timezones!
        // Wir müssen die Uhrzeit manuell von Lokalzeit in UTC umrechnen.
        const timeParts = (adapter.config.briefingTime || "08:00").split(":");
        const localHour = parseInt(timeParts[0]) || 8;
        const localMinute = parseInt(timeParts[1]) || 0;
        
        // Berechne UTC-Offset (Deutschland: UTC+1 im Winter, UTC+2 im Sommer)
        const now = new Date();
        const offsetHours = Math.floor(now.getTimezoneOffset() / -60); // -60 = UTC+1, -120 = UTC+2
        
        // Konvertiere Lokalzeit zu UTC
        const utcHour = (localHour - offsetHours + 24) % 24;
        
        const rule = new schedule.RecurrenceRule();
        rule.hour = utcHour;
        rule.minute = localMinute;
        
        adapter.briefingJob = schedule.scheduleJob(rule, () => {
            const now = new Date();
            const actualLocalTime = now.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
            const actualUtcTime = now.toISOString();
            adapter.log.info(`🌅 BRIEFING FIRED! Local: ${actualLocalTime} | UTC: ${actualUtcTime} | Configured: ${localHour}:${localMinute < 10 ? '0' : ''}${localMinute}`);
            callbackFn();
        });
        adapter.log.info(`☕ Briefing scheduled for ${localHour}:${localMinute < 10 ? '0' : ''}${localMinute} local (${utcHour}:${localMinute < 10 ? '0' : ''}${localMinute} UTC, offset: ${offsetHours}h)`);
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