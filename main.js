'use strict';
const utils = require('@iobroker/adapter-core');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const schedule = require('node-schedule');

// Globale Konstanten
const HISTORY_MAX_SIZE = 50; // STM
const DEBUG_HISTORY_COUNT = 5;
const GEMINI_MODEL = 'models/gemini-flash-latest';
const ANALYSIS_HISTORY_MAX_SIZE = 100;
const DEBUG_ANALYSIS_HISTORY_COUNT = 5;

// === LTM Konstanten (Sprints 14-16, 20) ===
const RAW_LOG_MAX_SIZE = 1500;
const LTM_DP_RAW_LOG = 'LTM.rawEventLog';
// SPRINT 20: DAILY_DIGEST_MAX_SIZE wird nun durch config.ltmLtbWindowDays bestimmt (max 180)
const DAILY_DIGEST_MAX_SIZE_LIMIT = 180; // Harte Obergrenze
const LTM_DP_DAILY_DIGESTS = 'LTM.dailyDigests';
const LTM_DP_STATUS = 'LTM.processingStatus';
const LTM_DP_TRIGGER_DIGEST = 'LTM.triggerDailyDigest';
const LTM_DP_BASELINE_STATUS = 'LTM.baselineStatus';
const LTM_SCHEDULE = '0 3 * * *'; // Täglich um 03:00 Uhr
const LTM_MIN_EVENTS_FOR_COMPRESSION = 5;
// SPRINT 20: MAX_DAYS_FOR_BASELINE_PROMPT (alt 30) wird nun durch config.ltmStbWindowDays bestimmt

// === SPRINT 20: LTM Drift Analysis Konstanten ===
const LTM_DP_DRIFT_CHANNEL = 'LTM.driftAnalysis';
const LTM_DP_DRIFT_STATUS = 'LTM.driftAnalysis.baselineDrift';
const LTM_DP_DRIFT_DETAILS = 'LTM.driftAnalysis.driftDetails';
const LTM_DP_DRIFT_LAST_CHECK = 'LTM.driftAnalysis.lastCheck';


// === System Konstanten (Sprint 16) ===
const SYSTEM_DP_MODE = 'system.mode';
const MODE_RESET_SCHEDULE = '0 4 * * *'; // Täglich um 04:00 Uhr
const SYSTEM_MODES = {
    NORMAL: 'normal',
    VACATION: 'vacation',
    PARTY: 'party',
    GUEST: 'guest'
};
// Modi, die um 04:00 Uhr automatisch zurückgesetzt werden
const AUTO_RESET_MODES = [SYSTEM_MODES.PARTY, SYSTEM_MODES.GUEST];


// Persona Mapping (Deutsch)
const PERSONA_MAPPING = {
    generic: 'Analysiere ausgewogen auf Gesundheit, Sicherheit und Komfort.',
    senior_aal:
        'PRIORITÄT: Gesundheit und Sicherheit für Senioren (AAL). Erkenne Inaktivität, potenzielle Stürze (indirekt), ungewöhnliche nächtliche Aktivität. Komfort ist sekundär.',
    family: 'Fokus auf Familienroutinen, Kindersicherheit und allgemeines Haushaltsmanagement. Erwarte hohe Aktivitätsniveaus.',
    single_comfort:
        'Fokus auf Maximierung von Komfort, Automatisierungseffizienz und Energieeinsparung für einen einzelnen Bewohner. Aktivitätsmuster sind flexibel.',
    security:
        'PRIORITÄT: Sicherheit. Erkenne Eindringlinge, ungewöhnliche Anwesenheit bei Abwesenheit der Bewohner oder Fehlfunktionen, die auf ein Sicherheitsrisiko hindeuten.',
};

class CogniLiving extends utils.Adapter {
    constructor(options) {
        super({
            ...options,
            name: 'cogni-living',
        });
        this.eventHistory = []; // STM
        this.analysisHistory = [];
        this.genAI = null;
        this.geminiModel = null;
        this.analysisTimer = null;

        // LTM Initialisierung
        this.rawEventLog = []; // LTM Raw
        this.dailyDigests = []; // LTM Compressed (Baseline)
        this.ltmJob = null;
        this.modeResetJob = null; // SPRINT 16
        this.driftAnalysisTimer = null; // SPRINT 20 (Nutzt Timer statt schedule für konfigurierbare Intervalle)

        // State Tracking
        this.sensorLastValues = {};

        // System Status (Sprint 16)
        this.currentSystemMode = SYSTEM_MODES.NORMAL;

        // SPRINT 18: Lizenzstatus
        this.isProVersion = false;

        // SPRINT 19: Alert Tracking (Verhindert Notification Spam)
        this.lastAlertState = false;

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
        this.on('message', this.onMessage.bind(this));
    }

    // ======================================================================
    // === SPRINT 18: Lizenz Management ===
    // ======================================================================

    async checkLicense(key) {
        if (!key) {
            return false;
        }
        // SIMULATION
        if (key === "TEST-PRO-KEY") {
            return true;
        }
        return false;
    }

    // ======================================================================
    // === SPRINT 19: Benachrichtigungssystem ===
    // ======================================================================

    async sendNotification(message, isTest = false) {
        this.log.info(`${isTest ? '[TEST] ' : ''}Attempting to send notification: "${message}"`);

        const config = this.config;
        let sentCount = 0;

        // 1. Telegram
        if (config.notifyTelegramEnabled && config.notifyTelegramInstance) {
            try {
                const telegramPayload = {
                    text: message,
                    ...(config.notifyTelegramRecipient && { user: config.notifyTelegramRecipient })
                };
                await this.sendToAsync(config.notifyTelegramInstance, 'send', telegramPayload);
                this.log.info(`Notification sent via ${config.notifyTelegramInstance}`);
                sentCount++;
            } catch (error) {
                this.log.error(`Failed to send notification via ${config.notifyTelegramInstance}: ${error.message}`);
            }
        }

        // 2. Pushover
        if (config.notifyPushoverEnabled && config.notifyPushoverInstance) {
            try {
                const pushoverPayload = {
                    message: message,
                    title: "Cogni-Living Alert",
                    priority: 1,
                    ...(config.notifyPushoverRecipient && { device: config.notifyPushoverRecipient })
                };
                await this.sendToAsync(config.notifyPushoverInstance, 'send', pushoverPayload);
                this.log.info(`Notification sent via ${config.notifyPushoverInstance}`);
                sentCount++;
            } catch (error) {
                this.log.error(`Failed to send notification via ${config.notifyPushoverInstance}: ${error.message}`);
            }
        }

        // 3. E-Mail
        if (config.notifyEmailEnabled && config.notifyEmailInstance && config.notifyEmailRecipient) {
            try {
                const emailPayload = {
                    text: message,
                    subject: "Cogni-Living Alert",
                    to: config.notifyEmailRecipient
                };
                await this.sendToAsync(config.notifyEmailInstance, 'send', emailPayload);
                this.log.info(`Notification sent via ${config.notifyEmailInstance} to ${config.notifyEmailRecipient}`);
                sentCount++;
            } catch (error) {
                this.log.error(`Failed to send notification via ${config.notifyEmailInstance}: ${error.message}`);
            }
        }

        // 4. WhatsApp (CMB)
        if (config.notifyWhatsappEnabled && config.notifyWhatsappInstance) {
            try {
                const whatsappPayload = {
                    text: message,
                    ...(config.notifyWhatsappRecipient && { phone: config.notifyWhatsappRecipient })
                };
                await this.sendToAsync(config.notifyWhatsappInstance, 'send', whatsappPayload);
                this.log.info(`Notification sent via ${config.notifyWhatsappInstance}`);
                sentCount++;
            } catch (error) {
                this.log.error(`Failed to send notification via ${config.notifyWhatsappInstance}: ${error.message}`);
            }
        }

        // 5. Signal (CMA)
        if (config.notifySignalEnabled && config.notifySignalInstance) {
            try {
                const signalPayload = {
                    text: message,
                    ...(config.notifySignalRecipient && { phone: config.notifySignalRecipient })
                };
                await this.sendToAsync(config.notifySignalInstance, 'send', signalPayload);
                this.log.info(`Notification sent via ${config.notifySignalInstance}`);
                sentCount++;
            } catch (error) {
                this.log.error(`Failed to send notification via ${config.notifySignalInstance}: ${error.message}`);
            }
        }

        if (sentCount === 0 && !isTest) {
            this.log.info("No notification services enabled or configured. Alert triggered but not sent.");
        }
        return sentCount;
    }


    // SPRINT 20: onReady erweitert für neue Konfiguration und Scheduler
    async onReady() {
        const adapterVersion = this.version || 'unknown';
        this.log.info(`cogni-living adapter starting (v${adapterVersion})`);

        // === 0. LIZENZ PRÜFUNG (SPRINT 18) ===
        const licenseKey = this.config.licenseKey || '';
        this.isProVersion = await this.checkLicense(licenseKey);

        if (this.isProVersion) {
            // SPRINT 20: Drift Analysis hinzugefügt
            this.log.info('✅ License check successful: PRO features enabled (LTM, Baseline, Automation, Drift Analysis).');
        } else {
            if (licenseKey && licenseKey.length > 0) {
                this.log.warn('❌ License check failed: Invalid key provided. Running in FREE mode.');
            } else {
                this.log.info('No license key provided: Running in FREE mode. LTM features disabled.');
            }
        }


        // === 1. KONFIGURATION VALIDIEREN (SPRINT 16/20) ===

        // 1a. Basis LTM Konfiguration (Sprint 16)
        if (!this.config.minDaysForBaseline || this.config.minDaysForBaseline < 1 || this.config.minDaysForBaseline > 30) {
            if (this.config.minDaysForBaseline) {
                this.log.warn(`Configuration invalid: minDaysForBaseline must be 1-30. Found: ${this.config.minDaysForBaseline}. Using default: 7.`);
            }
            this.config.minDaysForBaseline = 7;
        }

        // 1b. SPRINT 20: Dual Baseline Konfiguration Validierung
        // STB Window (1-30 Tage)
        if (!this.config.ltmStbWindowDays || this.config.ltmStbWindowDays < 1 || this.config.ltmStbWindowDays > 30) {
            if (this.config.ltmStbWindowDays) {
                this.log.warn(`Configuration invalid: ltmStbWindowDays must be 1-30. Found: ${this.config.ltmStbWindowDays}. Using default: 14.`);
            }
            this.config.ltmStbWindowDays = 14;
        }

        // LTB Window (30-180 Tage)
        if (!this.config.ltmLtbWindowDays || this.config.ltmLtbWindowDays < 30 || this.config.ltmLtbWindowDays > DAILY_DIGEST_MAX_SIZE_LIMIT) {
            if (this.config.ltmLtbWindowDays) {
                this.log.warn(`Configuration invalid: ltmLtbWindowDays must be 30-${DAILY_DIGEST_MAX_SIZE_LIMIT}. Found: ${this.config.ltmLtbWindowDays}. Using default: 60.`);
            }
            this.config.ltmLtbWindowDays = 60;
        }

        // Drift Check Interval (1-168 Stunden)
        if (!this.config.ltmDriftCheckIntervalHours || this.config.ltmDriftCheckIntervalHours < 1 || this.config.ltmDriftCheckIntervalHours > 168) {
            if (this.config.ltmDriftCheckIntervalHours) {
                this.log.warn(`Configuration invalid: ltmDriftCheckIntervalHours must be 1-168. Found: ${this.config.ltmDriftCheckIntervalHours}. Using default: 24.`);
            }
            this.config.ltmDriftCheckIntervalHours = 24;
        }

        // Plausibilitätscheck: LTB muss größer als STB sein
        if (this.config.ltmLtbWindowDays <= this.config.ltmStbWindowDays) {
            this.log.warn(`Configuration conflict: LTB window (${this.config.ltmLtbWindowDays}) must be larger than STB window (${this.config.ltmStbWindowDays}). Adjusting LTB.`);
            // Stelle sicher, dass LTB > STB, setze LTB auf STB + 14 Tage, maximal aber das Limit.
            this.config.ltmLtbWindowDays = Math.min(this.config.ltmStbWindowDays + 14, DAILY_DIGEST_MAX_SIZE_LIMIT);
        }

        if (this.isProVersion) {
            this.log.info(`LTM Configuration Loaded. Learning: ${this.config.minDaysForBaseline}d. STB Window: ${this.config.ltmStbWindowDays}d. LTB Window: ${this.config.ltmLtbWindowDays}d. Drift Check Interval: ${this.config.ltmDriftCheckIntervalHours}h.`);
        }


        // === 2. KI INITIALISIERUNG (JSON MODE) ===
        if (this.config.geminiApiKey) {
            try {
                this.genAI = new GoogleGenerativeAI(this.config.geminiApiKey);
                // Wir nutzen das gleiche Modell für Analyse, Kompression und Drift-Analyse
                this.geminiModel = this.genAI.getGenerativeModel({
                    model: GEMINI_MODEL,
                    generationConfig: { responseMimeType: 'application/json' },
                });
                this.log.info(`Gemini AI client initialized (JSON Mode) for model: ${GEMINI_MODEL}`);
            } catch (error) {
                this.log.error(`Failed to initialize Gemini AI: ${error.message}`);
            }
        } else {
            this.log.warn('Gemini API Key is missing. AI features will be disabled.');
        }

        // Logge Persona/Kontext
        const persona = this.config.aiPersona || 'generic';
        const context = this.config.livingContext || '(Not defined)';
        this.log.info(`AI Configuration Loaded. Persona: ${persona}. Context Details: ${context}`);


        // === 3. DATENPUNKTE ERSTELLEN & LADEN ===

        // 3a. System Objekte (Sprint 16)
        await this.checkSystemObjects();
        await this.loadSystemMode(); // Lade aktuellen Modus

        // 3b. Event & Analysis Objekte
        await this.setObjectNotExistsAsync('events.lastEvent', {
            type: 'state',
            common: { name: 'Last raw event', type: 'string', role: 'json', read: true, write: false },
            native: {},
        });
        await this.setObjectNotExistsAsync('events.history', {
            type: 'state',
            common: { name: 'Event History (JSON Array)', type: 'string', role: 'json', read: true, write: false },
            native: {},
        });
        for (let i = 0; i < DEBUG_HISTORY_COUNT; i++) {
            const idIndex = i.toString().padStart(2, '0');
            await this.setObjectNotExistsAsync(`events.history_debug_${idIndex}`, {
                type: 'state',
                common: { name: `History Event ${idIndex}`, type: 'string', role: 'text', read: true, write: false },
                native: {},
            });
        }
        await this.setObjectNotExistsAsync('analysis.trigger', {
            type: 'state',
            common: { name: 'Trigger Analysis', type: 'boolean', role: 'button', read: true, write: true, def: false },
            native: {},
        });
        await this.setObjectNotExistsAsync('analysis.lastPrompt', {
            type: 'state',
            common: { name: 'Last Prompt sent to AI', type: 'string', role: 'text', read: true, write: false },
            native: {},
        });
        await this.setObjectNotExistsAsync('analysis.lastResult', {
            type: 'state',
            common: { name: 'Last Result from AI (JSON)', type: 'string', role: 'json', read: true, write: false },
            native: {},
        });
        await this.setObjectNotExistsAsync('analysis.isAlert', {
            type: 'state',
            common: {
                name: 'AI Alert Status',
                type: 'boolean',
                role: 'indicator.alarm',
                read: true,
                write: false,
                def: false,
            },
            native: {},
        });

        // SPRINT 19: Lade den letzten Alert-Zustand
        try {
            const alertState = await this.getStateAsync('analysis.isAlert');
            if (alertState && typeof alertState.val === 'boolean') {
                this.lastAlertState = alertState.val;
            } else {
                if (!alertState || alertState.val === null || alertState.val === undefined) {
                    await this.setStateAsync('analysis.isAlert', { val: false, ack: true });
                }
                this.lastAlertState = false;
            }
            this.log.info(`Initial Alert State loaded: ${this.lastAlertState ? 'ACTIVE' : 'INACTIVE'}.`);
        } catch (e) {
            this.log.warn(`Could not read initial state of analysis.isAlert: ${e.message}. Defaulting to false.`);
            this.lastAlertState = false;
        }

        await this.setObjectNotExistsAsync('analysis.activitySummary', {
            type: 'state',
            common: { name: 'Activity Summary', type: 'string', role: 'text', read: true, write: false },
            native: {},
        });

        // SPRINT 16/18: Datenpunkt Deviation
        await this.setObjectNotExistsAsync('analysis.deviationFromBaseline', {
            type: 'state',
            common: {
                name: 'Deviation from Baseline (LTM)',
                type: 'string',
                role: 'state',
                read: true,
                write: false,
                def: 'N/A (Learning)',
                states: {
                    "N/A (Learning)": "N/A (Lernphase)",
                    "N/A (No Activity)": "N/A (Keine Aktivität)",
                    "N/A (Pro Feature)": "N/A (Pro Feature)",
                    "none": "Keine (Normal)",
                    "slight": "Geringfügig",
                    "significant": "Signifikant",
                    "critical": "Kritisch"
                }
            },
            native: {},
        });

        await this.setObjectNotExistsAsync('analysis.comfortSummary', {
            type: 'state',
            common: { name: 'Comfort Summary', type: 'string', role: 'text', read: true, write: false },
            native: {},
        });
        await this.setObjectNotExistsAsync('analysis.comfortSuggestion', {
            type: 'state',
            common: { name: 'Comfort Suggestion', type: 'string', role: 'text', read: true, write: false },
            native: {},
        });
        await this.setObjectNotExistsAsync('analysis.alertReason', {
            type: 'state',
            common: { name: 'Alert Reason', type: 'string', role: 'text.alarm', read: true, write: false },
            native: {},
        });

        // SPRINT 17: Automation Proposal
        await this.extendObjectAsync('analysis.automation', {
            type: 'channel',
            common: {
                name: 'Automation Proposals (AI)',
            },
            native: {},
        });

        await this.setObjectNotExistsAsync('analysis.automation.patternDetected', {
            type: 'state',
            common: { name: 'Pattern Detected', type: 'boolean', role: 'indicator', read: true, write: false, def: false },
            native: {},
        });
        await this.setObjectNotExistsAsync('analysis.automation.description', {
            type: 'state',
            common: { name: 'Pattern Description', type: 'string', role: 'text', read: true, write: false },
            native: {},
        });
        await this.setObjectNotExistsAsync('analysis.automation.suggestedAction', {
            type: 'state',
            common: { name: 'Suggested Action', type: 'string', role: 'text', read: true, write: false },
            native: {},
        });


        await this.setObjectNotExistsAsync('analysis.analysisHistory', {
            type: 'state',
            common: {
                name: 'Analysis Logbook (JSON Array)',
                type: 'string',
                role: 'json',
                read: true,
                write: false,
                def: '[]',
            },
            native: {},
        });
        for (let i = 0; i < DEBUG_ANALYSIS_HISTORY_COUNT; i++) {
            const idIndex = i.toString().padStart(2, '0');
            await this.setObjectNotExistsAsync(`analysis.history_debug_${idIndex}`, {
                type: 'state',
                common: { name: `Analysis History ${idIndex}`, type: 'string', role: 'text', read: true, write: false },
                native: {},
            });
        }

        // === 4. GEDÄCHTNIS LADEN ===

        // 4a. Analyse-Logbuch (Analysis History) laden
        try {
            const historyState = await this.getStateAsync('analysis.analysisHistory');
            if (historyState && historyState.val) {
                this.analysisHistory = JSON.parse(historyState.val.toString());
                this.log.info(`Successfully loaded ${this.analysisHistory.length} past analysis results into logbook.`);
                await this._updateDebugAnalysisHistoryStates();
            }
        } catch (e) {
            this.log.warn(`Could not parse analysis history JSON: ${e.message}. Starting with empty logbook.`);
            this.analysisHistory = [];
        }

        // 4b. LTM (Long Term Memory) laden
        await this.checkLtmObjects();
        // SPRINT 20: LTM Drift Objects prüfen
        await this.checkLtmDriftObjects();

        await this.loadRawEventLog();
        await this.loadDailyDigests(); // Lädt Digests und aktualisiert Baseline Status


        // === 5. STATES ABONNIEREN & INITIALISIEREN ===
        this.subscribeStates('analysis.trigger');
        this.subscribeStates(LTM_DP_TRIGGER_DIGEST);
        this.subscribeStates(SYSTEM_DP_MODE);

        const devices = this.config.devices;
        if (!devices || devices.length === 0) {
            this.log.warn('No sensors configured!');
        } else {
            // Initialisiere this.sensorLastValues beim Start
            this.log.info(`Found ${devices.length} configured sensors. Subscribing and initializing last values...`);
            for (const device of devices) {
                if (device.id) {
                    await this.subscribeForeignStatesAsync(device.id);
                    try {
                        const currentState = await this.getForeignStateAsync(device.id);
                        if (currentState && currentState.val !== undefined && currentState.val !== null) {
                            this.sensorLastValues[device.id] = currentState.val;
                        } else {
                            this.sensorLastValues[device.id] = {};
                        }
                    } catch (error) {
                        this.log.warn(`Could not fetch initial state for ${device.id}: ${error.message}`);
                        this.sensorLastValues[device.id] = {};
                    }
                }
            }
            this.log.debug(`Initialization of sensor last values complete.`);
        }

        // === 6. TIMER & SCHEDULER STARTEN ===

        // 6a. Autopilot-Timer (STM Analyse)
        if (this.analysisTimer) {
            clearInterval(this.analysisTimer);
            this.analysisTimer = null;
        }
        const intervalMinutes = this.config.analysisInterval || 15;
        const intervalMilliseconds = intervalMinutes * 60 * 1000;
        if (intervalMilliseconds > 0) {
            this.log.info(`Starting Autopilot: Analysis will run every ${intervalMinutes} minutes.`);
            this.analysisTimer = setInterval(() => {
                // SPRINT 19: Logik aktualisiert für korrektes Alert-Reset bei Inaktivität
                if (this.eventHistory.length === 0) {
                    this.log.info('Autopilot: Skipping analysis, no events in memory.');
                    // Setze Alert-Status zurück
                    this.setState('analysis.isAlert', { val: false, ack: true });
                    this.resetAnalysisStates(); // resetAnalysisStates setzt lastAlertState=false
                    return;
                }
                const now = Date.now();
                // eventHistory nutzt unshift, daher ist das neueste Event an Index 0
                const lastEventTime = this.eventHistory[0].timestamp;
                if (now - lastEventTime > intervalMilliseconds) {
                    this.log.info('Autopilot: Skipping analysis, no new events in the last interval.');
                    // Setze Alert-Status zurück
                    this.setState('analysis.isAlert', { val: false, ack: true });
                    this.resetAnalysisStates(); // resetAnalysisStates setzt lastAlertState=false
                    return;
                }
                this.log.info('Autopilot triggering scheduled AI analysis (Filter passed)...');
                this.runGeminiAnalysis().catch(e =>
                    this.log.error(`Error during scheduled Gemini analysis: ${e.message}`),
                );
            }, intervalMilliseconds);
        } else {
            this.log.warn('Analysis interval is set to 0. Autopilot disabled.');
        }

        // 6b. LTM Scheduler (Daily Digest)
        this.setupLtmScheduler();

        // 6c. Mode Reset Scheduler (SPRINT 16)
        this.setupModeResetScheduler();

        // 6d. SPRINT 20: Drift Analysis Scheduler
        this.setupDriftAnalysisScheduler();
    }

    // ======================================================================
    // === SPRINT 16: System Mode Management (Unverändert) ===
    // ======================================================================

    async checkSystemObjects() {
        // Kanal System
        await this.extendObjectAsync('system', {
            type: 'channel',
            common: {
                name: 'System Status & Control',
            },
            native: {},
        });

        // Datenpunkt System Mode
        await this.extendObjectAsync(SYSTEM_DP_MODE, {
            type: 'state',
            common: {
                name: 'System Mode (Context Override)',
                type: 'string',
                role: 'state',
                read: true,
                write: true,
                def: SYSTEM_MODES.NORMAL,
                states: {
                    [SYSTEM_MODES.NORMAL]: "Normal",
                    [SYSTEM_MODES.VACATION]: "Urlaub (Abwesend)",
                    [SYSTEM_MODES.PARTY]: "Party (Auto-Reset 04:00)",
                    [SYSTEM_MODES.GUEST]: "Gast/Reinigung (Auto-Reset 04:00)"
                }
            },
            native: {},
        });
    }

    async loadSystemMode() {
        try {
            const state = await this.getStateAsync(SYSTEM_DP_MODE);
            if (state && state.val && typeof state.val === 'string') {
                if (Object.values(SYSTEM_MODES).includes(state.val)) {
                    this.currentSystemMode = state.val;
                } else {
                    this.log.warn(`Invalid system mode found in state: ${state.val}. Resetting to NORMAL.`);
                    this.currentSystemMode = SYSTEM_MODES.NORMAL;
                    await this.setStateAsync(SYSTEM_DP_MODE, { val: this.currentSystemMode, ack: true });
                }
            } else {
                this.currentSystemMode = SYSTEM_MODES.NORMAL;
                if (!state || state.val === null || state.val === undefined) {
                    await this.setStateAsync(SYSTEM_DP_MODE, { val: this.currentSystemMode, ack: true });
                }
            }
        } catch (error) {
            this.log.error(`Error loading system mode: ${error.message}. Defaulting to NORMAL.`);
            this.currentSystemMode = SYSTEM_MODES.NORMAL;
        }
        this.log.info(`Current System Mode: ${this.currentSystemMode}`);
    }

    setupModeResetScheduler() {
        if (this.modeResetJob) {
            this.modeResetJob.cancel();
        }

        this.log.info(`Setting up System Mode Reset Scheduler (Cron: ${MODE_RESET_SCHEDULE}).`);

        this.modeResetJob = schedule.scheduleJob(MODE_RESET_SCHEDULE, async () => {
            this.log.info('System Mode Reset Scheduler triggered.');

            await this.loadSystemMode();

            if (AUTO_RESET_MODES.includes(this.currentSystemMode)) {
                this.log.info(`Auto-resetting System Mode from ${this.currentSystemMode} to NORMAL.`);
                await this.setStateAsync(SYSTEM_DP_MODE, { val: SYSTEM_MODES.NORMAL, ack: false });
            } else {
                this.log.info(`System Mode is '${this.currentSystemMode}'. No reset needed.`);
            }
        });
    }


    // ======================================================================
    // === LTM Management Funktionen (Sprints 14-18, 20) ===
    // ======================================================================

    async updateBaselineStatus() {
        // SPRINT 18: Wenn nicht PRO, zeige dies an.
        if (!this.isProVersion) {
            await this.setStateAsync(LTM_DP_BASELINE_STATUS, { val: 'Deaktiviert (Pro-Feature)', ack: true });
            return;
        }

        // Lese Konfiguration für die benötigte Dauer
        const requiredDays = this.config.minDaysForBaseline || 7;
        const currentDays = this.dailyDigests.length;
        let statusMessage = '';

        if (currentDays >= requiredDays) {
            statusMessage = `Aktiv (Datenbasis: ${currentDays} Tage)`;
        } else {
            statusMessage = `Lernphase (${currentDays}/${requiredDays} Tage)`;
        }

        await this.setStateAsync(LTM_DP_BASELINE_STATUS, { val: statusMessage, ack: true });
    }

    // SPRINT 20: checkLtmObjects angepasst für dynamische Namen basierend auf Config
    async checkLtmObjects() {
        // Kanal LTM
        await this.extendObjectAsync('LTM', {
            type: 'channel',
            common: {
                name: 'Long Term Memory (LTM)',
            },
            native: {},
        });
        // Datenpunkt rawEventLog (Sprint 14)
        await this.extendObjectAsync(LTM_DP_RAW_LOG, {
            type: 'state',
            common: {
                'name': `Raw Event Log (Max ${RAW_LOG_MAX_SIZE} events)`,
                'type': 'string', 'role': 'json', 'read': true, 'write': false,
                'desc': 'Stores the raw sensor events for LTM processing before compression.'
            },
            native: {},
        });

        // SPRINT 20: Datenpunkt dailyDigests (Name dynamisch angepasst)
        // Nutze die konfigurierte LTB Window Size für den Namen
        const ltbWindow = this.config.ltmLtbWindowDays || 60;
        await this.extendObjectAsync(LTM_DP_DAILY_DIGESTS, {
            type: 'state',
            common: {
                'name': `Daily Digests (Baseline, Max ${ltbWindow} days)`,
                'type': 'string', 'role': 'json', 'read': true, 'write': false,
                'desc': 'Stores the compressed AI summaries of daily activity (the Baseline).'
            },
            native: {},
        });

        // Datenpunkt processingStatus (Sprint 15)
        await this.extendObjectAsync(LTM_DP_STATUS, {
            type: 'state',
            common: {
                'name': 'LTM Processing Status',
                'type': 'string', 'role': 'text', 'read': true, 'write': false,
            },
            native: {},
        });

        // Manueller Trigger (Sprint 15)
        await this.extendObjectAsync(LTM_DP_TRIGGER_DIGEST, {
            type: 'state',
            common: {
                "name": "Trigger Daily Digest Creation (Manual)",
                "type": "boolean", "role": "button", "read": true, "write": true, "def": false
            },
            native: {},
        });

        // SPRINT 16 NEU: Baseline Status
        await this.extendObjectAsync(LTM_DP_BASELINE_STATUS, {
            type: 'state',
            common: {
                'name': 'Baseline Learning Status',
                'type': 'string', 'role': 'text', 'read': true, 'write': false,
            },
            native: {},
        });
    }

    // SPRINT 20 NEU: checkLtmDriftObjects
    async checkLtmDriftObjects() {
        // Kanal LTM.driftAnalysis
        await this.extendObjectAsync(LTM_DP_DRIFT_CHANNEL, {
            type: 'channel',
            common: {
                name: 'Baseline Drift Analysis (Gradual Changes)',
            },
            native: {},
        });

        // Datenpunkt baselineDrift (Status)
        await this.extendObjectAsync(LTM_DP_DRIFT_STATUS, {
            type: 'state',
            common: {
                name: 'Baseline Drift Status (STB vs LTB)',
                type: 'string',
                role: 'state',
                read: true,
                write: false,
                def: 'N/A (Initializing)',
                states: {
                    "N/A (Initializing)": "N/A (Initialisierung)",
                    "N/A (Learning)": "N/A (Lernphase)",
                    "N/A (Pro Feature)": "N/A (Pro Feature)",
                    "none": "Keine (Stabil)",
                    "slight": "Geringfügig",
                    "significant": "Signifikant (Trend erkennbar)",
                    "critical": "Kritisch (Starke Veränderung)"
                }
            },
            native: {},
        });

        // Datenpunkt driftDetails (Text)
        await this.extendObjectAsync(LTM_DP_DRIFT_DETAILS, {
            type: 'state',
            common: {
                name: 'Drift Details (AI Explanation)',
                type: 'string',
                role: 'text',
                read: true,
                write: false,
            },
            native: {},
        });

        // Datenpunkt lastCheck (Timestamp)
        await this.extendObjectAsync(LTM_DP_DRIFT_LAST_CHECK, {
            type: 'state',
            common: {
                name: 'Last Drift Check Timestamp',
                type: 'number',
                role: 'date',
                read: true,
                write: false,
            },
            native: {},
        });
    }


    async loadRawEventLog() {
        try {
            const state = await this.getStateAsync(LTM_DP_RAW_LOG);
            if (state && state.val && typeof state.val === 'string') {
                const data = JSON.parse(state.val);

                if (Array.isArray(data)) {
                    this.rawEventLog = data;
                    this.log.info(`LTM: Raw Event Log geladen (${this.rawEventLog.length} Einträge).`);

                    if (this.rawEventLog.length > RAW_LOG_MAX_SIZE) {
                        const excess = this.rawEventLog.length - RAW_LOG_MAX_SIZE;
                        this.rawEventLog.splice(0, excess);
                        this.log.info(`LTM: Raw Event Log wurde auf das aktuelle Limit (${RAW_LOG_MAX_SIZE}) gekürzt.`);
                        await this.saveRawEventLog();
                    }

                } else {
                    throw new Error('Datenpunkt enthält ungültige Daten (kein Array).');
                }
            } else {
                this.log.info('LTM: Raw Event Log nicht gefunden oder leer. Starte mit leerem Log.');
                this.rawEventLog = [];
            }
        } catch (error) {
            this.log.error(`LTM: Fehler beim Laden oder Parsen des Raw Event Logs: ${error.message}. Starte mit leerem Log.`);
            this.rawEventLog = [];
            try {
                await this.setStateAsync(LTM_DP_RAW_LOG, { val: JSON.stringify(this.rawEventLog), ack: true });
            } catch (e) {
                this.log.error(`LTM: Konnte korrupten State nicht bereinigen: ${e.message}`);
            }
        }
    }

    async saveRawEventLog() {
        // 1. Limit prüfen und kürzen (älteste Einträge entfernen)
        if (this.rawEventLog.length > RAW_LOG_MAX_SIZE) {
            const excess = this.rawEventLog.length - RAW_LOG_MAX_SIZE;
            // Entfernt 'excess' Elemente ab Index 0 (die ältesten, da wir push verwenden)
            this.rawEventLog.splice(0, excess);
        }

        // 2. Speichern
        try {
            const data = JSON.stringify(this.rawEventLog);
            // Setze ack=true, da der Adapter der Eigentümer ist
            await this.setStateAsync(LTM_DP_RAW_LOG, { val: data, ack: true });
        } catch (error) {
            this.log.error(`LTM: Fehler beim Speichern des Raw Event Logs: ${error.message}`);
        }
    }

    // SPRINT 20: loadDailyDigests angepasst (Kürzung basierend auf LTB Config)
    async loadDailyDigests() {
        // SPRINT 20: Bestimme die maximale Größe basierend auf der Konfiguration
        const maxDigests = this.config.ltmLtbWindowDays || 60;

        try {
            const state = await this.getStateAsync(LTM_DP_DAILY_DIGESTS);
            if (state && state.val && typeof state.val === 'string') {
                const data = JSON.parse(state.val);
                if (Array.isArray(data)) {
                    this.dailyDigests = data;
                    this.log.info(`LTM: Daily Digests geladen (${this.dailyDigests.length} Tage).`);

                    // Größe prüfen
                    if (this.dailyDigests.length > maxDigests) {
                        const excess = this.dailyDigests.length - maxDigests;
                        this.dailyDigests.splice(0, excess);
                        this.log.info(`LTM: Daily Digests wurden auf das konfigurierte LTB Limit (${maxDigests}) gekürzt.`);
                        // Wir setzen updateStatus auf false, da wir es nach dem Try/Catch Block sowieso aufrufen.
                        await this.saveDailyDigests(false);
                    }
                } else {
                    throw new Error('Datenpunkt enthält ungültige Daten (kein Array).');
                }
            } else {
                this.log.info('LTM: Daily Digests nicht gefunden. Starte mit leerer Baseline.');
                this.dailyDigests = [];
            }
        } catch (error) {
            this.log.error(`LTM: Fehler beim Laden der Daily Digests: ${error.message}. Starte mit leerer Baseline.`);
            this.dailyDigests = [];
            try {
                await this.setStateAsync(LTM_DP_DAILY_DIGESTS, { val: JSON.stringify(this.dailyDigests), ack: true });
            } catch (e) {
                this.log.error(`LTM: Konnte korrupten State (Digests) nicht bereinigen: ${e.message}`);
            }
        }
        // SPRINT 16/18: Status aktualisieren
        await this.updateBaselineStatus();
    }

    /**
     * Speichert die Daily Digests (LTM Compressed) in den ioBroker-Datenpunkt.
     * SPRINT 20: Angepasst (Kürzung basierend auf LTB Config)
     */
    async saveDailyDigests(updateStatus = true) {
        // SPRINT 20: Bestimme die maximale Größe basierend auf der Konfiguration
        const maxDigests = this.config.ltmLtbWindowDays || 60;

        // 1. Limit prüfen und kürzen
        if (this.dailyDigests.length > maxDigests) {
            const excess = this.dailyDigests.length - maxDigests;
            this.dailyDigests.splice(0, excess);
        }

        // 2. Speichern
        try {
            const data = JSON.stringify(this.dailyDigests);
            await this.setStateAsync(LTM_DP_DAILY_DIGESTS, { val: data, ack: true });
        } catch (error) {
            this.log.error(`LTM: Fehler beim Speichern der Daily Digests: ${error.message}`);
        }

        // SPRINT 16/18: Status aktualisieren (berücksichtigt isProVersion)
        if (updateStatus) {
            await this.updateBaselineStatus();
        }
    }

    setupLtmScheduler() {
        if (this.ltmJob) {
            this.log.info('LTM Scheduler already running. Cancelling existing job before rescheduling.');
            this.ltmJob.cancel();
            this.ltmJob = null;
        }

        if (!this.isProVersion) {
            this.log.info('LTM Scheduler disabled (Free Version). Daily Digests will not be created automatically.');
            this.setStateAsync(LTM_DP_STATUS, { val: 'Deaktiviert (Pro-Feature).', ack: true });
            return;
        }

        this.log.info(`LTM: Setting up Scheduler for Daily Digest creation (Cron: ${LTM_SCHEDULE}).`);

        this.ltmJob = schedule.scheduleJob(LTM_SCHEDULE, () => {
            this.log.info('LTM Scheduler triggered: Starting createDailyDigest...');
            this.createDailyDigest().catch(error => {
                this.log.error(`LTM Scheduler: Error during createDailyDigest execution: ${error.message}`);
            });
        });

        if (this.ltmJob) {
            const nextInvocation = this.ltmJob.nextInvocation();
            this.log.info(`LTM Scheduler set up successfully. Next run: ${nextInvocation ? nextInvocation.toString() : 'N/A'}`);
        } else {
            this.log.error('LTM: Failed to set up Scheduler.');
        }
    }

    async createDailyDigest() {
        if (!this.isProVersion) {
            this.log.warn('LTM Compression attempt blocked (Free Version).');
            return;
        }

        this.log.info('=== LTM Compression Process Started ===');
        await this.setStateAsync(LTM_DP_STATUS, { val: `Processing started at ${new Date().toLocaleString()}`, ack: true });

        // 1. Voraussetzungen prüfen
        if (!this.geminiModel) {
            this.log.warn('LTM Compression aborted: Gemini AI is not initialized.');
            await this.setStateAsync(LTM_DP_STATUS, { val: 'Error: AI not initialized.', ack: true });
            return;
        }

        if (this.rawEventLog.length < LTM_MIN_EVENTS_FOR_COMPRESSION) {
            this.log.info(`LTM Compression skipped: Not enough data (${this.rawEventLog.length} events, minimum is ${LTM_MIN_EVENTS_FOR_COMPRESSION}).`);
            await this.setStateAsync(LTM_DP_STATUS, { val: `Skipped: Not enough data (${this.rawEventLog.length} events).`, ack: true });
            return;
        }

        // 2. Daten vorbereiten
        const dataToCompress = JSON.parse(JSON.stringify(this.rawEventLog));
        const eventCount = dataToCompress.length;

        // 3. KI Prompt erstellen (Data Compression Agent)
        const personaKey = this.config.aiPersona || 'generic';
        const personaInstruction = PERSONA_MAPPING[personaKey] || PERSONA_MAPPING['generic'];
        const livingContext = (this.config.livingContext || 'Keine spezifischen Details angegeben.').substring(0, 200);

        let modeNote = '';
        if (this.currentSystemMode !== SYSTEM_MODES.NORMAL) {
            modeNote = `\nHINWEIS: Das System befand sich während dieses Zeitraums im Modus '${this.currentSystemMode}'. Berücksichtige dies bei der Zusammenfassung.`;
        }

        const systemPrompt = `
            ROLLE: Data Compression Agent (Langzeitgedächtnis).
            AUFGABE: Komprimiere die bereitgestellten rohen Sensor-Events in eine prägnante Zusammenfassung des Zeitraums (ca. 1 Tag).
            SPRACHE: Antworte ausschließlich auf Deutsch (DE).
            FORMAT: Antworte NUR mit einem JSON-Objekt.

            KONTEXT (Details zur Wohnsituation):
            ${livingContext}
            ${modeNote}

            PERSONA (Analysefokus - Beeinflusst die Interpretation der Daten):
            ${personaInstruction}

            ANWEISUNGEN:
            1. Analysiere die chronologische Abfolge der Events.
            2. Identifiziere Hauptaktivitäten, Routinen (Schlaf, Essen, Verlassen/Ankommen) und Ruhephasen.
            3. Fasse dies in 'summary' zusammen (Fokus auf das Gesamtbild, nicht auf einzelne Sensorwerte).
            4. Bewerte das allgemeine Aktivitätsniveau des Zeitraums in 'activityLevel'.

            JSON SCHEMA:
            {
              "summary": "string (Zusammenfassung des Tagesablaufs, 3-5 Sätze. Beschreibe Routinen und signifikante Ereignisse.)",
              "activityLevel": "string (Eines von: 'sehr niedrig', 'niedrig', 'normal', 'hoch', 'sehr hoch')"
            }
        `;

        const dataPrompt = JSON.stringify(dataToCompress, null, 2);
        const fullPrompt = `${systemPrompt}\n\nROHE SENSOR-EVENTS (JSON Array):\n${dataPrompt}`;

        // 4. KI Aufruf
        let compressionResult = null;
        try {
            this.log.info(`LTM: Sending ${eventCount} events to Gemini AI for compression...`);
            await this.setStateAsync(LTM_DP_STATUS, { val: `Compressing ${eventCount} events...`, ack: true });

            const result = await this.geminiModel.generateContent(fullPrompt);
            const response = await result.response;

            // Robustes Parsing
            const rawText = response.text();
            const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            compressionResult = JSON.parse(cleanText);

        } catch (error) {
            this.log.error(`LTM Compression failed during AI call or JSON parsing: ${error.message}`);
            await this.setStateAsync(LTM_DP_STATUS, { val: `Error: AI/JSON failure - ${error.message}`, ack: true });
            // Bei Fehler abbrechen, Daten nicht löschen.
            return;
        }

        // 5. Ergebnis validieren und speichern
        if (compressionResult && compressionResult.summary && compressionResult.activityLevel) {
            this.log.info(`LTM: Compression successful. Summary: ${compressionResult.summary}`);

            const digestEntry = {
                timestamp: new Date().toISOString(), // Zeitpunkt der Kompression
                eventCount: eventCount,
                summary: compressionResult.summary,
                activityLevel: compressionResult.activityLevel,
                systemMode: this.currentSystemMode // SPRINT 16: Speichere den Modus des Tages
            };

            // Zum Speicher hinzufügen (Neuestes hinten - FIFO)
            this.dailyDigests.push(digestEntry);
            await this.saveDailyDigests(); // true (default) -> aktualisiert Baseline Status

            // 6. Rohdaten bereinigen
            // Robuste Methode: Entferne die ersten 'eventCount' Elemente.
            if (this.rawEventLog.length >= eventCount) {
                this.rawEventLog.splice(0, eventCount);
            } else {
                this.log.warn("LTM: Mismatch between compressed data count and rawEventLog length. Clearing entire log.");
                this.rawEventLog = [];
            }

            await this.saveRawEventLog();
            this.log.info(`LTM: Cleaned up rawEventLog. Remaining events: ${this.rawEventLog.length}.`);
            await this.setStateAsync(LTM_DP_STATUS, { val: `Success: Compressed ${eventCount} events at ${new Date().toLocaleString()}`, ack: true });

        } else {
            this.log.error(`LTM Compression failed: Invalid JSON structure received from AI. Received: ${JSON.stringify(compressionResult)}`);
            await this.setStateAsync(LTM_DP_STATUS, { val: 'Error: Invalid JSON structure.', ack: true });
        }

        this.log.info('=== LTM Compression Process Finished ===');
    }


    // ======================================================================
    // === SPRINT 20: LTM Drift Analysis Engine ===
    // ======================================================================

    /**
     * Richtet den Scheduler für die Baseline Drift Analyse ein. (SPRINT 20)
     */
    setupDriftAnalysisScheduler() {
        if (this.driftAnalysisTimer) {
            clearInterval(this.driftAnalysisTimer);
            this.driftAnalysisTimer = null;
        }

        if (!this.isProVersion) {
            this.log.info('LTM Drift Analysis Scheduler disabled (Free Version).');
            // Setze Status initial
            // Prüfe, ob der State existiert, bevor er gesetzt wird (falls checkLtmDriftObjects noch nicht durchlief)
            this.getObjectAsync(LTM_DP_DRIFT_STATUS).then(obj => {
                if (obj) {
                    this.setStateAsync(LTM_DP_DRIFT_STATUS, { val: 'N/A (Pro Feature)', ack: true });
                }
            });
            return;
        }

        const intervalHours = this.config.ltmDriftCheckIntervalHours || 24;
        const intervalMilliseconds = intervalHours * 60 * 60 * 1000;

        this.log.info(`LTM Drift Analysis Scheduler initialized (Runs every ${intervalHours} hours).`);

        this.driftAnalysisTimer = setInterval(() => {
            this.log.info('LTM Drift Analysis Scheduler triggered: Starting runBaselineDriftAnalysis...');
            this.runBaselineDriftAnalysis().catch(error => {
                this.log.error(`LTM Drift Analysis: Error during execution: ${error.message}`);
            });
        }, intervalMilliseconds);

        // Führe beim Start eine erste Analyse durch, wenn möglich
        setTimeout(() => {
            this.log.info('LTM Drift Analysis: Running initial check after startup.');
            this.runBaselineDriftAnalysis().catch(error => {
                this.log.error(`LTM Drift Analysis: Error during initial execution: ${error.message}`);
            });
        }, 5000); // Kurze Verzögerung, um Startup abzuschließen
    }

    /**
     * Führt die KI-gestützte Analyse durch, um schleichende Veränderungen zu erkennen (STB vs LTB). (SPRINT 20)
     */
    async runBaselineDriftAnalysis() {
        if (!this.isProVersion) return;
        if (!this.geminiModel) {
            this.log.warn('LTM Drift Analysis aborted: Gemini AI is not initialized.');
            return;
        }

        const stbWindow = this.config.ltmStbWindowDays || 14;
        const ltbWindow = this.config.ltmLtbWindowDays || 60;
        const minDays = this.config.minDaysForBaseline || 7;

        // 1. Prüfe, ob genug Daten vorhanden sind
        // Wir brauchen mindestens genug Daten für die STB UND mindestens 'minDays' für die LTB-Vergleichsperiode.
        if (this.dailyDigests.length < stbWindow + minDays) {
            this.log.info(`LTM Drift Analysis skipped: Not enough data yet. Need at least ${stbWindow + minDays} days (STB+MinDays), have ${this.dailyDigests.length}.`);
            await this.setStateAsync(LTM_DP_DRIFT_STATUS, { val: 'N/A (Learning)', ack: true });
            return;
        }

        // 2. Daten extrahieren (STB und LTB)
        // Die Digests sind chronologisch sortiert (älteste zuerst, neueste zuletzt).

        // STB (Recent Behavior): Die neuesten 'stbWindow' Einträge.
        const stbData = this.dailyDigests.slice(-stbWindow);

        // LTB (Established Behavior): Die Einträge VOR der STB.
        const ltbEndIndex = this.dailyDigests.length - stbWindow;
        // Berechne den Startindex, berücksichtige die maximale Gesamtfenstergröße LTB
        const ltbStartIndex = Math.max(0, this.dailyDigests.length - ltbWindow);

        // Extrahiere den Teil der LTB, der nicht in der STB enthalten ist.
        const ltbComparisonData = this.dailyDigests.slice(ltbStartIndex, ltbEndIndex);

        // Redundante Prüfung der LTB Größe (sollte durch Schritt 1 abgedeckt sein)
        if (ltbComparisonData.length < minDays) {
            this.log.info(`LTM Drift Analysis skipped: LTB comparison dataset too small (${ltbComparisonData.length} days, min ${minDays}).`);
            await this.setStateAsync(LTM_DP_DRIFT_STATUS, { val: 'N/A (Learning)', ack: true });
            return;
        }

        this.log.info(`LTM Drift Analysis started. Comparing STB (${stbData.length} days) vs LTB Comparison (${ltbComparisonData.length} days).`);


        // 3. Daten für Prompt formatieren
        // Robuste Formatierung (Kompatibilität mit alten Formaten)
        const formatDigestForPrompt = (digest) => {
            // date (Sprint 15 Stil) oder timestamp (Sprint 18 Stil)
            const date = digest.date || new Date(digest.timestamp).toLocaleDateString('de-DE');
            const modeSuffix = (digest.systemMode && digest.systemMode !== SYSTEM_MODES.NORMAL) ? ` | Modus: ${digest.systemMode}` : '';
            // Nutze activityLevel (neu) oder fallback
            const activity = digest.activityLevel ? `Aktivität: ${digest.activityLevel} | ` : '';
            return `[${date}${modeSuffix}]: ${activity}${digest.summary}`;
        };

        // Neueste zuerst für die KI
        const formattedStb = stbData.map(formatDigestForPrompt).reverse().join('\n');
        const formattedLtb = ltbComparisonData.map(formatDigestForPrompt).reverse().join('\n');


        // 4. KI Prompt erstellen (Behavioral Data Scientist)
        const SYSTEM_PROMPT_DRIFT_ANALYSIS = `
Du bist ein Verhaltenswissenschaftler und Datenanalyst. Deine Aufgabe ist es, zwei Datensätze von Smart-Home-Verhaltenszusammenfassungen zu vergleichen, um schleichende Veränderungen oder Trends zu identifizieren.

DATASET A (STB): Repräsentiert das jüngste Verhalten (die letzten ${stbData.length} Tage).
DATASET B (LTB): Repräsentiert das etablierte Normalverhalten (die Zeit davor).

ZIEL: Bewerte, ob sich das jüngste Verhalten (A) signifikant vom etablierten Verhalten (B) unterscheidet (Drift).

AUFGABEN:
1. Vergleiche A und B hinsichtlich Aktivitätsniveaus, Schlaf-/Wachzeiten, Routinen-Timings und An-/Abwesenheitsmustern.
2. Identifiziere Trends. Gibt es Muster in A, die in B nicht vorhanden waren, oder umgekehrt? Werden Aktivitäten langsamer oder seltener?
3. Bewerte die Signifikanz der Unterschiede ('baselineDrift').
    - 'none': Keine nennenswerten Unterschiede. Verhalten ist stabil.
    - 'slight': Geringfügige Abweichungen im Timing oder der Häufigkeit, aber keine klaren Trends.
    - 'significant': Deutliche Veränderungen oder klare Trends erkennbar (z.B. durchweg spätere Schlafenszeit, deutlich reduzierte Aktivität am Tag).
    - 'critical': Massive Verhaltensänderung, die auf ein potenzielles Problem hindeutet.
4. Beschreibe die gefundenen Unterschiede detailliert in 'driftDetails'. Sei spezifisch bezüglich der Veränderungen.

AUSGABEFORMAT: Reines JSON-Objekt.

JSON SCHEMA:
{
  "baselineDrift": "none|slight|significant|critical",
  "driftDetails": "Detaillierte Beschreibung der identifizierten Trends und Veränderungen (3-5 Sätze). Wenn Drift='none', beschreibe die Stabilität."
}
`;

        const prompt = [
            { text: SYSTEM_PROMPT_DRIFT_ANALYSIS },
            { text: "DATASET B (LTB - Etabliertes Verhalten):\n" + formattedLtb },
            { text: "\n---\nDATASET A (STB - Jüngstes Verhalten):\n" + formattedStb }
        ];

        // 5. KI Aufruf und Parsing
        try {
            this.log.info('LTM Drift Analysis: Sending comparison data to Gemini AI...');
            const result = await this.geminiModel.generateContent(prompt);
            const response = await result.response;

            // Robustes Parsing
            const rawText = response.text();
            const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            const driftResult = JSON.parse(cleanText);

            // 6. Validierung und Speicherung
            if (driftResult && driftResult.baselineDrift && driftResult.driftDetails) {
                this.log.info(`LTM Drift Analysis complete. Drift Status: ${driftResult.baselineDrift}.`);

                await this.setStateAsync(LTM_DP_DRIFT_STATUS, { val: driftResult.baselineDrift, ack: true });
                await this.setStateAsync(LTM_DP_DRIFT_DETAILS, { val: driftResult.driftDetails, ack: true });
                await this.setStateAsync(LTM_DP_DRIFT_LAST_CHECK, { val: Date.now(), ack: true });

            } else {
                this.log.error('LTM Drift Analysis failed: Invalid JSON structure received from AI.');
            }

        } catch (error) {
            this.log.error(`LTM Drift Analysis failed during AI call or JSON parsing: ${error.message}`);
        }
    }


    // ======================================================================
    // === System Funktionen ===
    // ======================================================================

    async resetAnalysisStates() {
        await this.setStateAsync('analysis.activitySummary', { val: 'No recent activity.', ack: true });

        const deviationResetValue = this.isProVersion ? 'N/A (No Activity)' : 'N/A (Pro Feature)';
        await this.setStateAsync('analysis.deviationFromBaseline', { val: deviationResetValue, ack: true });

        await this.setStateAsync('analysis.comfortSummary', { val: '', ack: true });
        await this.setStateAsync('analysis.comfortSuggestion', { val: '', ack: true });
        await this.setStateAsync('analysis.alertReason', { val: '', ack: true });

        await this.setStateAsync('analysis.automation.patternDetected', { val: false, ack: true });

        const automationResetText = this.isProVersion ? '' : 'N/A (Pro Feature)';
        await this.setStateAsync('analysis.automation.description', { val: automationResetText, ack: true });
        await this.setStateAsync('analysis.automation.suggestedAction', { val: automationResetText, ack: true });

        this.lastAlertState = false;
    }

    // SPRINT 20: onUnload erweitert
    onUnload(callback) {
        try {
            // Autopilot Timer stoppen
            if (this.analysisTimer) {
                this.log.info('Stopping Autopilot timer...');
                clearInterval(this.analysisTimer);
                this.analysisTimer = null;
            }

            // LTM Scheduler Cleanup
            if (this.ltmJob) {
                this.log.info('Cancelling LTM Scheduler...');
                this.ltmJob.cancel();
                this.ltmJob = null;
            }

            // SPRINT 16: Mode Reset Scheduler Cleanup
            if (this.modeResetJob) {
                this.log.info('Cancelling Mode Reset Scheduler...');
                this.modeResetJob.cancel();
                this.modeResetJob = null;
            }

            // SPRINT 20: Drift Analysis Scheduler Cleanup
            if (this.driftAnalysisTimer) {
                this.log.info('Stopping Drift Analysis timer...');
                clearInterval(this.driftAnalysisTimer);
                this.driftAnalysisTimer = null;
            }

        } catch (e) {
            this.log.error(`Error during unload: ${e.message}`);
        }
        callback();
    }

    onStateChange(id, state) {
        if (!state) {
            return;
        }

        // SPRINT 16: Handle System Mode Changes (ack=false ODER ack=true)
        if (id === `${this.namespace}.${SYSTEM_DP_MODE}`) {
            if (state.val && Object.values(SYSTEM_MODES).includes(state.val)) {
                if (this.currentSystemMode !== state.val) {
                    // Logge die Quelle der Änderung (Adapter intern oder User/Script)
                    this.log.info(`System Mode changed to: ${state.val} (Source: ${state.ack ? 'Adapter/Internal' : 'User/Script'})`);
                    this.currentSystemMode = state.val;
                    // Bestätige die Änderung, falls sie nicht vom Adapter selbst kam (ack=false)
                    if (!state.ack) {
                        this.setState(id, { val: this.currentSystemMode, ack: true });
                    }
                }
            } else if (!state.ack) {
                // Wenn ein ungültiger Wert vom Nutzer gesetzt wurde (ack=false), korrigiere ihn
                this.log.warn(`Invalid System Mode requested: ${state.val}. Reverting to current mode.`);
                this.setState(id, { val: this.currentSystemMode, ack: true });
            }
            return;
        }


        // --- B) Befehl (ack=false) ---
        if (!state.ack) {
            // STM Analyse Trigger
            if (id === `${this.namespace}.analysis.trigger` && state.val === true) {
                this.log.info('Manual AI analysis triggered by user...');
                this.setState(id, { val: false, ack: true });
                this.runGeminiAnalysis().catch(e => this.log.error(`Error running Gemini analysis: ${e.message}`));
                return;
            }

            // LTM Digest Trigger
            if (id === `${this.namespace}.${LTM_DP_TRIGGER_DIGEST}` && state.val === true) {
                this.setState(id, { val: false, ack: true }); // Button immer zurücksetzen

                // SPRINT 18: Prüfe Lizenzstatus vor Ausführung
                if (this.isProVersion) {
                    this.log.info('Manual LTM Daily Digest creation triggered by user...');
                    this.createDailyDigest().catch(e => this.log.error(`Error running manual Daily Digest creation: ${e.message}`));
                } else {
                    this.log.warn('Manual LTM Daily Digest creation blocked (Free Version).');
                    // Optional: Status-Update im LTM.processingStatus
                    this.setStateAsync(LTM_DP_STATUS, { val: 'Manueller Trigger blockiert: Pro-Feature.', ack: true });
                }
                return;
            }
            return;
        }

        // --- A) Sensor-Event (ack=true) ---
        const deviceConfig = (this.config.devices || []).find(d => d.id === id);
        if (!deviceConfig) {
            // PATCH 14.1: Robustheit
            if (this.sensorLastValues.hasOwnProperty(id)) {
                delete this.sensorLastValues[id];
            }
            return;
        }

        // 2. === SELEKTIVER FILTER (PATCH 14.1) ===
        if (!deviceConfig.logDuplicates) {
            if (this.sensorLastValues.hasOwnProperty(id)) {
                const lastValue = this.sensorLastValues[id];

                if (lastValue === state.val) {
                    this.log.debug(`Ignoring redundant state update for ${id} (Value: ${state.val})`);
                    return;
                }
            }
        }

        // Wenn der Filter passiert wird, verarbeite das Event
        this.processSensorEvent(id, state, deviceConfig).catch(e =>
            this.log.error(`Error processing sensor event: ${e.message}`),
        );
    }

    async processSensorEvent(id, state, deviceConfig) {
        const location = deviceConfig.location || 'unknown';
        const type = deviceConfig.type || 'unknown';
        const name = deviceConfig.name || 'unknown';

        // === 0. Update Last Value (PATCH 14.1) ===
        this.sensorLastValues[id] = state.val;


        // === 1. STM (Short Term Memory) Verarbeitung ===
        const eventObjectSTM = {
            timestamp: state.ts, // Unix-Timestamp
            id: id,
            name: name,
            value: state.val,
            location: location,
            type: type,
        };

        // Letztes Event aktualisieren
        await this.setStateAsync('events.lastEvent', { val: JSON.stringify(eventObjectSTM), ack: true });

        // Zum STM hinzufügen (Neuestes vorne - für die Analyse-Reihenfolge)
        this.eventHistory.unshift(eventObjectSTM);
        if (this.eventHistory.length > HISTORY_MAX_SIZE) {
            this.eventHistory.pop();
        }

        // STM States aktualisieren
        await this.setStateAsync('events.history', { val: JSON.stringify(this.eventHistory), ack: true });
        await this._updateDebugSensorHistoryStates();


        // === 2. LTM (Long Term Memory) Verarbeitung (Sprint 14) ===
        // SPRINT 18: LTM Raw Log wird immer befüllt, unabhängig von der Lizenz. Nur die Kompression/Nutzung ist Lizenz-abhängig.

        // LTM Event-Objekt
        const eventObjectLTM = {
            timestamp: new Date(state.ts).toISOString(),
            sensorName: name,
            location: location,
            value: state.val
        };

        // Zum LTM Raw Log hinzufügen (Neuestes hinten - FIFO)
        this.rawEventLog.push(eventObjectLTM);

        // LTM persistent speichern
        await this.saveRawEventLog();

        this.log.debug(`Event processed for ${id} (Value: ${state.val}). STM Count: ${this.eventHistory.length}, LTM Count: ${this.rawEventLog.length}`);
    }

    async onMessage(obj) {
        if (typeof obj === 'object' && obj.message) {
            // === Befehl: testApiKey ===
            if (obj.command === 'testApiKey') {
                this.log.info('Received testApiKey request from Admin UI.');
                const apiKey = obj.message.apiKey;

                if (!apiKey) {
                    if (obj.callback) {
                        this.sendTo(
                            obj.from,
                            obj.command,
                            { success: false, message: 'API Key is empty' },
                            obj.callback,
                        );
                    }
                    return;
                }

                const result = await this.testGeminiConnection(apiKey);
                this.log.info(`API Key test result: ${result.success ? 'Success' : 'Failed'} - ${result.message}`);

                if (obj.callback) {
                    this.sendTo(obj.from, obj.command, result, obj.callback);
                }
            }

            // === SPRINT 19 NEU: Befehl: testNotification ===
            else if (obj.command === 'testNotification') {
                this.log.info('Received testNotification request from Admin UI.');

                const testMessage = "[Cogni-Living TEST] Dies ist eine Test-Benachrichtigung.";

                try {
                    const count = await this.sendNotification(testMessage, true);

                    if (count > 0) {
                        if (obj.callback) {
                            this.sendTo(obj.from, obj.command, { success: true, message: `Test message sent successfully to ${count} service(s).` }, obj.callback);
                        }
                    } else {
                        if (obj.callback) {
                            this.sendTo(obj.from, obj.command, { success: false, message: 'No notification services enabled or configured correctly.' }, obj.callback);
                        }
                    }
                } catch (error) {
                    this.log.error(`Error during test notification: ${error.message}`);
                    if (obj.callback) {
                        this.sendTo(obj.from, obj.command, { success: false, message: `Failed to send: ${error.message}` }, obj.callback);
                    }
                }
            }
        }
    }

    async testGeminiConnection(apiKey) {
        try {
            const testGenAI = new GoogleGenerativeAI(apiKey);
            const model = testGenAI.getGenerativeModel({ model: 'models/gemini-flash-latest' });

            this.log.debug('Attempting a simple generateContent call to validate API Key...');

            const result = await model.generateContent('hello');
            const response = await result.response;

            if (response && response.text()) {
                return { success: true, message: 'Connection successful! API Key is valid.' };
            }
            return { success: false, message: 'Connection test failed: Received an empty response.' };
        } catch (error) {
            let errorMessage = error.message || 'Unknown error';

            if (errorMessage.includes('API key not valid') || errorMessage.includes('[400]')) {
                errorMessage = 'API key not valid. Please check the key.';
            } else if (errorMessage.includes('403') || errorMessage.includes('PermissionDenied')) {
                errorMessage = 'Permission Denied (403). Check if Gemini API is enabled for this key.';
            } else if (
                errorMessage.includes('network error') ||
                errorMessage.includes('ENOTFOUND') ||
                errorMessage.includes('fetch failed')
            ) {
                errorMessage = 'Network error. Could not connect to Google servers.';
            }

            this.log.error(`Gemini API connection test failed: ${error.message}`);
            return { success: false, message: `Connection failed: ${errorMessage}` };
        }
    }


    // ======================================================================
    // === SPRINT 16-20: Cogni-Engine (runGeminiAnalysis Upgrade) ===
    // ======================================================================

    /**
     * Führt die KI-Analyse durch, verwaltet den Alert-Status und Benachrichtigungen.
     * SPRINT 20: Nutzt nun explizit das STB-Fenster für den Baseline-Vergleich.
     */
    async runGeminiAnalysis() {
        if (!this.geminiModel) {
            this.log.warn('Gemini AI is not initialized. Analysis aborted.');
            await this.setStateAsync('analysis.lastResult', { val: '{"error": "AI not initialized"}', ack: true });
            return;
        }
        if (this.eventHistory.length === 0) {
            this.log.info('Event history is empty. Nothing to analyze.');
            await this.setStateAsync('analysis.lastResult', { val: '{"status": "History is empty"}', ack: true });
            // SPRINT 19: Sicherstellen, dass Alarm zurückgesetzt wird
            this.setState('analysis.isAlert', { val: false, ack: true });
            this.resetAnalysisStates(); // resetAnalysisStates setzt lastAlertState=false
            return;
        }

        // --- 1. KONTEXT, PERSONA UND SYSTEM-MODUS LADEN ---
        const personaKey = this.config.aiPersona || 'generic';
        const personaInstruction = PERSONA_MAPPING[personaKey] || PERSONA_MAPPING['generic'];
        const livingContext = (this.config.livingContext || 'Keine spezifischen Details angegeben.').substring(0, 200);

        // SPRINT 16: System Mode Integration
        let systemModeInstruction = '';
        switch (this.currentSystemMode) {
            case SYSTEM_MODES.VACATION:
                systemModeInstruction = "ACHTUNG: System im URLAUBSMODUS. Bewohner sind abwesend. Jede signifikante Aktivität ist als potenzielle Sicherheitsbedrohung zu werten. 'isAlert' sollte hoch priorisiert werden.";
                break;
            case SYSTEM_MODES.PARTY:
                systemModeInstruction = "HINWEIS: System im PARTYMODUS. Hohe Aktivität und ungewöhnliche Zeiten sind erwartet. Die Toleranz für Abweichungen ist stark erhöht. Nur echte Notfälle sollten 'isAlert' auslösen.";
                break;
            case SYSTEM_MODES.GUEST:
                systemModeInstruction = "HINWEIS: GÄSTE oder REINIGUNGSPERSONAL anwesend. Abweichungen von der normalen Routine sind erwartet. Die Toleranz für Abweichungen ist erhöht.";
                break;
            case SYSTEM_MODES.NORMAL:
            default:
                systemModeInstruction = "System im NORMALMODUS.";
                break;
        }


        // --- 2. BASELINE (LTM/STB) VORBEREITEN (SPRINT 16/18/20) ---
        let baselinePromptSection = '';
        let taskInstructionActivity = '';
        let taskInstructionAutomation = '';
        const digestCount = this.dailyDigests.length;
        const minDaysRequired = this.config.minDaysForBaseline || 7;

        // SPRINT 20: Definiere das STB Fenster
        const stbWindowDays = this.config.ltmStbWindowDays || 14;

        // Baseline wird nur genutzt, wenn: Pro, genug Daten, Modus erlaubt.
        const useBaseline = this.isProVersion &&
            digestCount >= minDaysRequired &&
            (this.currentSystemMode === SYSTEM_MODES.NORMAL || this.currentSystemMode === SYSTEM_MODES.GUEST);

        if (useBaseline) {
            // Baseline ist bereit -> Aktiviere Vergleichsmodus (Pro)
            this.log.info(`LTM Baseline established (${digestCount} days). Activating deviation detection (Pro). Mode: ${this.currentSystemMode}.`);

            // SPRINT 20: Hole die relevanten Digests für die STB (Short-Term Baseline).
            const relevantDigests = this.dailyDigests
                .slice(-stbWindowDays) // Nutze nur das STB Fenster
                .reverse(); // Neueste zuerst für die KI

            // Formatiere die Digests für den Prompt (Menschenlesbar)
            // Robuste Formatierung (Kompatibilität mit alten Formaten)
            const baselineData = relevantDigests.map(d => {
                // date (Sprint 15 Stil) oder timestamp (Sprint 18 Stil)
                const date = d.date || new Date(d.timestamp).toLocaleDateString('de-DE');
                // Füge Modus hinzu, wenn bekannt und nicht normal
                const modeSuffix = (d.systemMode && d.systemMode !== SYSTEM_MODES.NORMAL) ? ` | Modus: ${d.systemMode}` : '';
                // Nutze activityLevel (neu) oder fallback
                const activity = d.activityLevel ? `Aktivität: ${d.activityLevel} | ` : '';
                return `[${date}${modeSuffix}]: ${activity}${d.summary}`;
            }).join('\n');

            // SPRINT 20: Klarstellung, dass es sich um die STB handelt
            baselinePromptSection = `
SHORT-TERM BASELINE (STB - Gelerntes Verhalten der letzten ${relevantDigests.length} Tage, neueste zuerst):
${baselineData}
            `;

            taskInstructionActivity = `1. AKTIVITÄT & ABWEICHUNG: Analysiere die AKTUELLEN SENSORDATEN und vergleiche sie mit der SHORT-TERM BASELINE (STB) unter Berücksichtigung des SYSTEM-MODUS. Fokus auf signifikante Abweichungen (Timing, Intensität, Ort), die NICHT durch den Modus erklärt werden können. Bewerte dies in 'activity.deviationFromBaseline'.`;

        } else {
            // Baseline nicht aktiv
            let reason = '';
            if (!this.isProVersion) reason = 'Free Version';
            else if (digestCount < minDaysRequired) reason = `Learning Phase (${digestCount}/${minDaysRequired} days)`;
            else reason = `System Mode (${this.currentSystemMode})`;

            this.log.info(`LTM Deviation detection inactive. Reason: ${reason}.`);

            baselinePromptSection = `
BASELINE STATUS: Inaktiv (Entweder Free-Version, Lernphase oder durch System-Modus deaktiviert).
            `;

            const deviationValue = this.isProVersion ? 'N/A (Learning)' : 'N/A (Pro Feature)';

            taskInstructionActivity = `1. AKTIVITÄT: Analysiere die AKTUELLEN SENSORDATEN basierend auf KONTEXT, PERSONA und SYSTEM-MODUS. Ein Baseline-Vergleich findet NICHT statt. Bewerte 'activity.deviationFromBaseline' immer mit '${deviationValue}'.`;
        }

        // SPRINT 17/18: Task Instruction für Automation
        if (this.isProVersion) {
            // SPRINT 20: Angepasst für STB (Baseline -> STB)
            taskInstructionAutomation = `2. AUTOMATISIERUNGSMUSTER (Pro): Suche explizit nach klaren, wiederkehrenden Mustern in den AKTUELLEN SENSORDATEN (und der STB, falls aktiv), die sich für eine Automatisierung eignen (z.B. "Immer wenn Sensor X auslöst, wird kurz darauf Sensor Y bedient"). Wenn ein klares Muster erkannt wird, setze 'comfort.automationProposal.patternDetected' auf TRUE und beschreibe es präzise. Andernfalls setze es auf FALSE.`;
        } else {
            taskInstructionAutomation = `2. AUTOMATISIERUNGSMUSTER: Funktion deaktiviert (Free-Version). Setze 'comfort.automationProposal.patternDetected' immer auf FALSE und lasse die Felder leer.`;
        }


        // --- 3. SYSTEM PROMPT ZUSAMMENSTELLEN (Dynamisch) ---
        // SPRINT 20: Prompt angepasst für STB
        const systemPrompt = `
            ROLLE: Smart Home Analyst (Cogni-Engine).
            SPRACHE: Antworte ausschließlich auf Deutsch (DE).
            FORMAT: Antworte NUR mit einem JSON-Objekt.

            SYSTEM-MODUS (Aktueller Betriebsmodus & Handlungsanweisung - HÖCHSTE PRIORITÄT):
            ${systemModeInstruction}

            KONTEXT (Details zur Wohnsituation):
            ${livingContext}

            PERSONA (Genereller Analysefokus):
            ${personaInstruction}

            ${baselinePromptSection}

            AUFGABE:
            ${taskInstructionActivity}
            ${taskInstructionAutomation}

            JSON SCHEMA (MUSS eingehalten werden):
            {
              "activity": {
                "summary": "string (Detaillierte Bewertung 1-2 Sätze. Beschreibe Aktivität, wie sie sich zur STB verhält (falls zutreffend) UND beziehe den System-Modus ein.)",
                "deviationFromBaseline": "string (MUSS eines sein von: 'N/A (Learning)', 'N/A (Pro Feature)', 'none', 'slight', 'significant', 'critical')",
                "isAlert": false, // boolean (TRUE nur, wenn deviation='critical' ODER die Situation akut gefährlich ist, unter Beachtung des SYSTEM-MODUS)
                "alertReason": "" // string (Grund wenn isAlert=true, sonst leerer String)
              },
              "comfort": {
                "summary": "string (Detaillierte Bewertung 1-2 Sätze)",
                "suggestion": "string", // Genereller Vorschlag (1 Satz) oder leerer String
                "automationProposal": {
                    "patternDetected": false, // boolean (TRUE wenn ein klares, automatisierbares Muster erkannt wurde - nur Pro)
                    "description": "", // string (Beschreibung des erkannten Musters, wenn patternDetected=true)
                    "suggestedAction": "" // string (Konkreter Vorschlag für eine ioBroker-Automatisierung, wenn patternDetected=true)
                }
              }
            }
        `;

        // --- 4. DATEN (STM) HINZUFÜGEN UND SENDEN ---
        const dataPrompt = JSON.stringify(this.eventHistory, null, 2);
        const fullPrompt = `${systemPrompt}\n\nAKTUELLEN SENSORDATEN (STM):\n${dataPrompt}`;
        await this.setStateAsync('analysis.lastPrompt', { val: fullPrompt, ack: true });

        try {
            this.log.info(`Sending prompt to Gemini AI (Cogni-Engine)...`);
            const result = await this.geminiModel.generateContent(fullPrompt);
            const response = await result.response;

            let analysisResult = null;
            let rawText = '';

            try {
                // Robustes Parsing
                rawText = response.text();
                this.log.debug(`AI Response received (raw text): ${rawText}`);

                const cleanText = rawText
                    .replace(/```json/g, '')
                    .replace(/```/g, '')
                    .trim();
                analysisResult = JSON.parse(cleanText);
            } catch (parseError) {
                this.log.error(
                    `Failed to parse AI response as JSON: ${parseError.message}. Raw response: ${rawText}`,
                );
                await this.setStateAsync('analysis.lastResult', {
                    val: `{"error": "Invalid JSON received", "details": "${parseError.message}"}`,
                    ack: true,
                });
                await this.setStateAsync('analysis.isAlert', { val: true, ack: true });

                // SPRINT 19: Auch bei JSON Fehler Alarm-Status tracken
                this.lastAlertState = true;
                return;
            }

            // --- 5. JSON VALIDIERUNG UND VERARBEITUNG ---
            if (
                analysisResult &&
                analysisResult.activity &&
                analysisResult.comfort &&
                analysisResult.comfort.automationProposal &&
                typeof analysisResult.activity.isAlert === 'boolean' &&
                typeof analysisResult.activity.deviationFromBaseline === 'string' &&
                typeof analysisResult.comfort.automationProposal.patternDetected === 'boolean'
            ) {
                this.log.info('AI analysis successfully parsed as JSON.');

                // Ergebnis speichern (JSON)
                await this.setStateAsync('analysis.lastResult', {
                    val: JSON.stringify(analysisResult, null, 2),
                    ack: true,
                });

                // Dedizierte States aktualisieren
                await this.setStateAsync('analysis.activitySummary', {
                    val: analysisResult.activity.summary || 'N/A',
                    ack: true,
                });

                // SPRINT 16: Deviation State aktualisieren
                const deviation = analysisResult.activity.deviationFromBaseline;
                await this.setStateAsync('analysis.deviationFromBaseline', {
                    val: deviation,
                    ack: true,
                });

                await this.setStateAsync('analysis.comfortSummary', {
                    val: analysisResult.comfort.summary || 'N/A',
                    ack: true,
                });
                await this.setStateAsync('analysis.comfortSuggestion', {
                    val: analysisResult.comfort.suggestion || '',
                    ack: true,
                });

                // SPRINT 19: Variable für Alert Handling
                const alertReason = analysisResult.activity.alertReason || '';
                await this.setStateAsync('analysis.alertReason', {
                    val: alertReason,
                    ack: true,
                });

                // SPRINT 17/18: Automation Proposal States aktualisieren
                const automation = analysisResult.comfort.automationProposal;

                // SPRINT 18: Defensives Handling für Free-Version
                const patternDetected = this.isProVersion ? automation.patternDetected : false;

                await this.setStateAsync('analysis.automation.patternDetected', {
                    val: patternDetected,
                    ack: true,
                });

                let descriptionText = '';
                let actionText = '';

                if (this.isProVersion) {
                    descriptionText = patternDetected ? (automation.description || '') : '';
                    actionText = patternDetected ? (automation.suggestedAction || '') : '';
                } else {
                    descriptionText = 'N/A (Pro Feature)';
                    actionText = 'N/A (Pro Feature)';
                }

                await this.setStateAsync('analysis.automation.description', {
                    val: descriptionText,
                    ack: true,
                });
                await this.setStateAsync('analysis.automation.suggestedAction', {
                    val: actionText,
                    ack: true,
                });

                if (patternDetected) {
                    this.log.info(`>>> AI Pattern Detected! Description: ${automation.description} <<<`);
                }


                // === SPRINT 19: Alert Handling und Benachrichtigung ===
                const alertFound = analysisResult.activity.isAlert;

                if (alertFound) {
                    this.log.warn(`>>> AI ALERT DETECTED! Mode: ${this.currentSystemMode}. Deviation: ${deviation}. Reason: ${alertReason || 'N/A'} <<<`);
                    await this.setStateAsync('analysis.isAlert', { val: true, ack: true });

                    // Prüfe, ob der Alarm NEU ist (Statuswechsel von false auf true)
                    if (!this.lastAlertState) {
                        this.log.info("New alert detected. Triggering notifications...");
                        // Formatierung der Nachricht für die Benachrichtigung
                        const notificationMessage = `🚨 Cogni-Living Alarm: ${alertReason} (Modus: ${this.currentSystemMode}, Abweichung: ${deviation})`;
                        await this.sendNotification(notificationMessage);
                    } else {
                        this.log.info("Alert persists. No new notification sent (Spam protection).");
                    }

                } else {
                    this.log.info(`AI analysis complete. Mode: ${this.currentSystemMode}. Deviation: ${deviation}. No alert conditions found.`);
                    await this.setStateAsync('analysis.isAlert', { val: false, ack: true });

                    // Prüfe, ob ein vorheriger Alarm behoben wurde
                    if (this.lastAlertState) {
                        this.log.info("Previous alert resolved.");
                    }
                }

                // Aktualisiere den internen Status für den nächsten Durchlauf
                this.lastAlertState = alertFound;
                // === SPRINT 19 END ===


                // Logbuch aktualisieren
                const logEntry = {
                    timestamp: Date.now(),
                    analysis: analysisResult,
                    usedBaseline: useBaseline,
                    systemMode: this.currentSystemMode,
                    isPro: this.isProVersion
                };
                await this.updateAnalysisHistory(logEntry);
            } else {
                // Fehler: JSON Struktur fehlt
                this.log.error(
                    `AI response JSON structure is invalid. Missing required fields. Received: ${JSON.stringify(analysisResult)}`,
                );
                await this.setStateAsync('analysis.lastResult', {
                    val: `{"error": "Invalid JSON structure", "received": ${JSON.stringify(analysisResult)}}`,
                    ack: true,
                });
                await this.setStateAsync('analysis.isAlert', { val: true, ack: true });
                // SPRINT 19: Auch bei JSON Fehler Alarm-Status tracken
                this.lastAlertState = true;
            }
        } catch (error) {
            // Fehler: API-Aufruf fehlgeschlagen
            this.log.error(`Error calling Gemini AI: ${error.message}`);
            const errorMessage = (error.message || 'Unknown error').replace(/"/g, '\\"');
            await this.setStateAsync('analysis.lastResult', {
                val: `{"error": "API Call failed", "details": "${errorMessage}"}`,
                ack: true,
            });
            // SPRINT 19: Auch bei API Fehler Alarm-Status tracken
            await this.setStateAsync('analysis.isAlert', { val: true, ack: true });
            await this.setStateAsync('analysis.alertReason', { val: `AI connection error: ${error.message}`, ack: true });
            this.lastAlertState = true;
        }
    }

    // ======================================================================
    // === Helper Funktionen ===
    // ======================================================================

    _formatEventForHistory(event) {
        const time = new Date(event.timestamp).toLocaleTimeString('de-DE');
        return `${time} - ${event.name} (${event.location}) -> ${event.value}`;
    }
    async _updateDebugSensorHistoryStates() {
        for (let i = 0; i < DEBUG_HISTORY_COUNT; i++) {
            const idIndex = i.toString().padStart(2, '0');
            const stateId = `events.history_debug_${idIndex}`;
            if (this.eventHistory[i]) {
                const formattedString = this._formatEventForHistory(this.eventHistory[i]);
                await this.setState(stateId, { val: formattedString, ack: true });
            } else {
                await this.setState(stateId, { val: '', ack: true });
            }
        }
    }

    async updateAnalysisHistory(logEntry) {
        this.analysisHistory.unshift(logEntry);
        if (this.analysisHistory.length > ANALYSIS_HISTORY_MAX_SIZE) {
            this.analysisHistory.pop();
        }
        await this.setStateAsync('analysis.analysisHistory', { val: JSON.stringify(this.analysisHistory), ack: true });
        await this._updateDebugAnalysisHistoryStates();
    }

    _formatAnalysisForHistory(logEntry) {
        const time = new Date(logEntry.timestamp).toLocaleString('de-DE');

        // --- AKTUELLES FORMAT (Sprint 16+) ---
        if (logEntry.analysis && logEntry.analysis.activity) {
            const analysis = logEntry.analysis;
            const isAlert = analysis.activity.isAlert === true;

            // SPRINT 17/18: Pattern Detection Flag
            const isPro = logEntry.isPro === undefined ? true : logEntry.isPro;
            const isPattern = isPro && (analysis.comfort && analysis.comfort.automationProposal && analysis.comfort.automationProposal.patternDetected === true);

            const deviation = analysis.activity.deviationFromBaseline || 'N/A';
            const modeSuffix = (logEntry.systemMode && logEntry.systemMode !== SYSTEM_MODES.NORMAL) ? ` | Mode: ${logEntry.systemMode}` : '';

            let prefixType = '[Info]';
            if (isAlert) {
                prefixType = '[ALARM]';
            } else if (isPattern) {
                prefixType = '[Muster erkannt]';
            }

            const prefix = `${prefixType} (Dev: ${deviation}${modeSuffix}) `;


            let summary = '';
            // Priorisiere Alarm > Pattern > Summary
            if (isAlert && analysis.activity.alertReason) {
                summary = analysis.activity.alertReason;
            } else if (isPattern && analysis.comfort.automationProposal.description) {
                summary = analysis.comfort.automationProposal.description;
            }
            else {
                summary = analysis.activity.summary || 'Analysis successful';
            }

            // Kürzen, um Platz für den längeren Prefix zu schaffen
            const shortSummary = summary.length > 70 ? `${summary.substring(0, 70)}...` : summary;
            return `${time} - ${prefix}${shortSummary}`;
        }

        // --- ALTES FORMAT (Fallback) ---
        if (logEntry.text) {
            const prefix = logEntry.alert ? '[ALARM] ' : '[Info] ';
            const shortText = logEntry.text.replace(/\n/g, ' | ');
            return `${time} - ${prefix}${shortText} (Legacy)`;
        }

        return `${time} - [Error formatting log entry]`;
    }

    async _updateDebugAnalysisHistoryStates() {
        for (let i = 0; i < DEBUG_ANALYSIS_HISTORY_COUNT; i++) {
            const idIndex = i.toString().padStart(2, '0');
            const stateId = `analysis.history_debug_${idIndex}`;

            if (this.analysisHistory[i]) {
                const formattedString = this._formatAnalysisForHistory(this.analysisHistory[i]);
                await this.setState(stateId, { val: formattedString, ack: true });
            } else {
                await this.setState(stateId, { val: '', ack: true });
            }
        }
    }
}

if (require.main !== module) {
    module.exports = options => new CogniLiving(options);
} else {
    new CogniLiving();
}