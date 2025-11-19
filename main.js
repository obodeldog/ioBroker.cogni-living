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

// === LTM Konstanten (Sprints 14, 15, 16) ===
const RAW_LOG_MAX_SIZE = 1500;
const LTM_DP_RAW_LOG = 'LTM.rawEventLog';
const DAILY_DIGEST_MAX_SIZE = 60;
const LTM_DP_DAILY_DIGESTS = 'LTM.dailyDigests';
const LTM_DP_STATUS = 'LTM.processingStatus';
const LTM_DP_TRIGGER_DIGEST = 'LTM.triggerDailyDigest';
const LTM_DP_BASELINE_STATUS = 'LTM.baselineStatus'; // SPRINT 16
const LTM_SCHEDULE = '0 3 * * *'; // Täglich um 03:00 Uhr
const LTM_MIN_EVENTS_FOR_COMPRESSION = 5;
const MAX_DAYS_FOR_BASELINE_PROMPT = 30; // SPRINT 16

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

        // State Tracking
        this.sensorLastValues = {};

        // System Status (Sprint 16)
        this.currentSystemMode = SYSTEM_MODES.NORMAL;

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
        this.on('message', this.onMessage.bind(this));
    }

    async onReady() {
        const adapterVersion = this.version || 'unknown';
        this.log.info(`cogni-living adapter starting (v${adapterVersion})`);

        // SPRINT 16: Validierung der Konfiguration
        // Stelle sicher, dass der Wert existiert und gültig ist (1-30 Tage).
        if (!this.config.minDaysForBaseline || this.config.minDaysForBaseline < 1 || this.config.minDaysForBaseline > 30) {
            // Logge Warnung nur, wenn ein Wert existierte, aber ungültig war.
            if (this.config.minDaysForBaseline) {
                this.log.warn(`Configuration invalid: minDaysForBaseline must be 1-30. Found: ${this.config.minDaysForBaseline}. Using default: 7.`);
            }
            this.config.minDaysForBaseline = 7; // Setze Default
        }
        this.log.info(`LTM Configuration: Learning phase duration set to ${this.config.minDaysForBaseline} days.`);


        // === 1. KI INITIALISIERUNG (JSON MODE) ===
        if (this.config.geminiApiKey) {
            try {
                this.genAI = new GoogleGenerativeAI(this.config.geminiApiKey);
                // Wir nutzen das gleiche Modell für Analyse und Kompression
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


        // === 2. DATENPUNKTE ERSTELLEN & LADEN ===

        // 2a. System Objekte (Sprint 16)
        await this.checkSystemObjects();
        await this.loadSystemMode(); // Lade aktuellen Modus

        // 2b. Event & Analysis Objekte
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

        await this.setObjectNotExistsAsync('analysis.activitySummary', {
            type: 'state',
            common: { name: 'Activity Summary', type: 'string', role: 'text', read: true, write: false },
            native: {},
        });

        // SPRINT 16 START: Neuer Datenpunkt Deviation
        await this.setObjectNotExistsAsync('analysis.deviationFromBaseline', {
            type: 'state',
            common: {
                name: 'Deviation from Baseline (LTM)',
                type: 'string',
                role: 'state', // Geändert von text zu state für Dropdown-Nutzung
                read: true,
                write: false,
                def: 'N/A (Learning)',
                // States für bessere Visualisierung in ioBroker (Übersetzt)
                states: {
                    "N/A (Learning)": "N/A (Lernphase)",
                    "N/A (No Activity)": "N/A (Keine Aktivität)",
                    "none": "Keine (Normal)",
                    "slight": "Geringfügig",
                    "significant": "Signifikant",
                    "critical": "Kritisch"
                }
            },
            native: {},
        });
        // SPRINT 16 END

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

        // === 3. GEDÄCHTNIS LADEN ===

        // 3a. Analyse-Logbuch (Analysis History) laden
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

        // 3b. LTM (Long Term Memory) laden
        await this.checkLtmObjects();
        await this.loadRawEventLog();
        await this.loadDailyDigests(); // Lädt Digests und aktualisiert Baseline Status


        // === 4. STATES ABONNIEREN & INITIALISIEREN ===
        this.subscribeStates('analysis.trigger');
        this.subscribeStates(LTM_DP_TRIGGER_DIGEST);
        // SPRINT 16: Abonniere System Mode Änderungen
        this.subscribeStates(SYSTEM_DP_MODE);

        const devices = this.config.devices;
        if (!devices || devices.length === 0) {
            this.log.warn('No sensors configured!');
        } else {
            // Initialisiere this.sensorLastValues beim Start (Patch 14.1)
            this.log.info(`Found ${devices.length} configured sensors. Subscribing and initializing last values...`);
            for (const device of devices) {
                if (device.id) {
                    await this.subscribeForeignStatesAsync(device.id);

                    // Lese den aktuellen Zustand aus, um den Duplikatfilter korrekt zu starten
                    try {
                        const currentState = await this.getForeignStateAsync(device.id);
                        // Prüfe auf gültigen Wert (nicht undefined/null)
                        if (currentState && currentState.val !== undefined && currentState.val !== null) {
                            this.sensorLastValues[device.id] = currentState.val;
                        } else {
                            // Initialisiere mit einem Sentinel-Wert (leeres Objekt), wenn kein Zustand existiert.
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

        // === 5. TIMER & SCHEDULER STARTEN ===

        // 5a. Autopilot-Timer (STM Analyse)
        if (this.analysisTimer) {
            clearInterval(this.analysisTimer);
            this.analysisTimer = null;
        }
        const intervalMinutes = this.config.analysisInterval || 15;
        const intervalMilliseconds = intervalMinutes * 60 * 1000;
        if (intervalMilliseconds > 0) {
            this.log.info(`Starting Autopilot: Analysis will run every ${intervalMinutes} minutes.`);
            this.analysisTimer = setInterval(() => {
                if (this.eventHistory.length === 0) {
                    this.log.info('Autopilot: Skipping analysis, no events in memory.');
                    this.resetAnalysisStates();
                    return;
                }
                const now = Date.now();
                // eventHistory nutzt unshift, daher ist das neueste Event an Index 0
                const lastEventTime = this.eventHistory[0].timestamp;
                if (now - lastEventTime > intervalMilliseconds) {
                    this.log.info('Autopilot: Skipping analysis, no new events in the last interval.');
                    this.setState('analysis.isAlert', { val: false, ack: true });
                    this.resetAnalysisStates();
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

        // 5b. LTM Scheduler
        this.setupLtmScheduler();

        // 5c. Mode Reset Scheduler (SPRINT 16)
        this.setupModeResetScheduler();
    }

    // ======================================================================
    // === SPRINT 16: System Mode Management ===
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
                write: true, // Erlaubt dem Nutzer das Ändern (VIS/Skripte)
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

    /**
     * Lädt den aktuellen Systemmodus aus dem Datenpunkt.
     */
    async loadSystemMode() {
        try {
            const state = await this.getStateAsync(SYSTEM_DP_MODE);
            if (state && state.val && typeof state.val === 'string') {
                // Prüfe, ob der Wert gültig ist
                if (Object.values(SYSTEM_MODES).includes(state.val)) {
                    this.currentSystemMode = state.val;
                } else {
                    this.log.warn(`Invalid system mode found in state: ${state.val}. Resetting to NORMAL.`);
                    this.currentSystemMode = SYSTEM_MODES.NORMAL;
                    await this.setStateAsync(SYSTEM_DP_MODE, { val: this.currentSystemMode, ack: true });
                }
            } else {
                // Wenn State nicht existiert oder leer ist, setze Standard
                this.currentSystemMode = SYSTEM_MODES.NORMAL;
                // Stelle sicher, dass der State korrekt initialisiert wird, falls er fehlte
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

    /**
     * Richtet den Scheduler für das Zurücksetzen des System-Modus ein (04:00 Uhr).
     */
    setupModeResetScheduler() {
        if (this.modeResetJob) {
            this.modeResetJob.cancel();
        }

        this.log.info(`Setting up System Mode Reset Scheduler (Cron: ${MODE_RESET_SCHEDULE}).`);

        this.modeResetJob = schedule.scheduleJob(MODE_RESET_SCHEDULE, async () => {
            this.log.info('System Mode Reset Scheduler triggered.');

            // Lade den Modus neu (sollte synchron sein, aber sicher ist sicher)
            await this.loadSystemMode();

            if (AUTO_RESET_MODES.includes(this.currentSystemMode)) {
                this.log.info(`Auto-resetting System Mode from ${this.currentSystemMode} to NORMAL.`);
                // Setze den State. Wir setzen ack=false, um zu signalisieren, dass es eine "Aktion" war (wie ein Button-Druck).
                // onStateChange wird dies verarbeiten.
                await this.setStateAsync(SYSTEM_DP_MODE, { val: SYSTEM_MODES.NORMAL, ack: false });
            } else {
                this.log.info(`System Mode is '${this.currentSystemMode}'. No reset needed.`);
            }
        });
    }


    // ======================================================================
    // === LTM Management Funktionen (Sprints 14, 15, 16) ===
    // ======================================================================

    // SPRINT 16: Helper für Baseline Status
    async updateBaselineStatus() {
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
                // Dynamischer Name basierend auf der Konstante
                'name': `Raw Event Log (Max ${RAW_LOG_MAX_SIZE} events)`,
                'type': 'string',
                'role': 'json',
                'read': true,
                'write': false,
                'desc': 'Stores the raw sensor events for LTM processing before compression.'
            },
            native: {},
        });

        // Datenpunkt dailyDigests (Sprint 15)
        await this.extendObjectAsync(LTM_DP_DAILY_DIGESTS, {
            type: 'state',
            common: {
                // Dynamischer Name basierend auf der Konstante
                'name': `Daily Digests (Baseline, Max ${DAILY_DIGEST_MAX_SIZE} days)`,
                'type': 'string',
                'role': 'json',
                'read': true,
                'write': false,
                'desc': 'Stores the compressed AI summaries of daily activity (the Baseline).'
            },
            native: {},
        });

        // Datenpunkt processingStatus (Sprint 15)
        await this.extendObjectAsync(LTM_DP_STATUS, {
            type: 'state',
            common: {
                'name': 'LTM Processing Status',
                'type': 'string',
                'role': 'text',
                'read': true,
                'write': false,
            },
            native: {},
        });

        // Manueller Trigger (Sprint 15)
        await this.extendObjectAsync(LTM_DP_TRIGGER_DIGEST, {
            type: 'state',
            common: {
                "name": "Trigger Daily Digest Creation (Manual)",
                "type": "boolean",
                "role": "button",
                "read": true,
                "write": true,
                "def": false
            },
            native: {},
        });

        // SPRINT 16 NEU: Baseline Status
        await this.extendObjectAsync(LTM_DP_BASELINE_STATUS, {
            type: 'state',
            common: {
                'name': 'Baseline Learning Status',
                'type': 'string',
                'role': 'text',
                'read': true,
                'write': false,
            },
            native: {},
        });
    }

    async loadRawEventLog() {
        try {
            const state = await this.getStateAsync(LTM_DP_RAW_LOG);
            if (state && state.val && typeof state.val === 'string') {
                // Versuche das JSON zu parsen
                const data = JSON.parse(state.val);

                if (Array.isArray(data)) {
                    this.rawEventLog = data;
                    this.log.info(`LTM: Raw Event Log geladen (${this.rawEventLog.length} Einträge).`);

                    // Größe prüfen, falls das Limit sich seit dem letzten Lauf geändert hat
                    if (this.rawEventLog.length > RAW_LOG_MAX_SIZE) {
                        const excess = this.rawEventLog.length - RAW_LOG_MAX_SIZE;
                        this.rawEventLog.splice(0, excess); // Entferne älteste Einträge (FIFO)
                        this.log.info(`LTM: Raw Event Log wurde auf das aktuelle Limit (${RAW_LOG_MAX_SIZE}) gekürzt.`);
                        // Speichere das gekürzte Log zurück
                        await this.saveRawEventLog();
                    }

                } else {
                    // Daten sind kein Array
                    throw new Error('Datenpunkt enthält ungültige Daten (kein Array).');
                }
            } else {
                this.log.info('LTM: Raw Event Log nicht gefunden oder leer. Starte mit leerem Log.');
                this.rawEventLog = [];
            }
        } catch (error) {
            this.log.error(`LTM: Fehler beim Laden oder Parsen des Raw Event Logs: ${error.message}. Starte mit leerem Log.`);
            this.rawEventLog = [];
            // Korrupten State bereinigen
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

    // loadDailyDigests (Aktualisiert für Sprint 16)
    async loadDailyDigests() {
        try {
            const state = await this.getStateAsync(LTM_DP_DAILY_DIGESTS);
            if (state && state.val && typeof state.val === 'string') {
                const data = JSON.parse(state.val);
                if (Array.isArray(data)) {
                    this.dailyDigests = data;
                    this.log.info(`LTM: Daily Digests geladen (${this.dailyDigests.length} Tage).`);

                    // Größe prüfen (ähnlich wie bei RawLog)
                    if (this.dailyDigests.length > DAILY_DIGEST_MAX_SIZE) {
                        const excess = this.dailyDigests.length - DAILY_DIGEST_MAX_SIZE;
                        this.dailyDigests.splice(0, excess);
                        this.log.info(`LTM: Daily Digests wurden auf das aktuelle Limit (${DAILY_DIGEST_MAX_SIZE}) gekürzt.`);
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
        // SPRINT 16: Status aktualisieren, nachdem Daten geladen wurden
        await this.updateBaselineStatus();
    }

    /**
     * Speichert die Daily Digests (LTM Compressed) in den ioBroker-Datenpunkt.
     * @param {boolean} updateStatus - Ob der Baseline-Status ebenfalls aktualisiert werden soll (Standard: true).
     */
    async saveDailyDigests(updateStatus = true) {
        // 1. Limit prüfen und kürzen
        if (this.dailyDigests.length > DAILY_DIGEST_MAX_SIZE) {
            const excess = this.dailyDigests.length - DAILY_DIGEST_MAX_SIZE;
            this.dailyDigests.splice(0, excess);
        }

        // 2. Speichern
        try {
            const data = JSON.stringify(this.dailyDigests);
            await this.setStateAsync(LTM_DP_DAILY_DIGESTS, { val: data, ack: true });
        } catch (error) {
            this.log.error(`LTM: Fehler beim Speichern der Daily Digests: ${error.message}`);
        }

        // SPRINT 16: Status aktualisieren
        if (updateStatus) {
            await this.updateBaselineStatus();
        }
    }

    setupLtmScheduler() {
        if (this.ltmJob) {
            this.log.info('LTM Scheduler already running. Cancelling existing job before rescheduling.');
            this.ltmJob.cancel();
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
        this.log.info('=== LTM Compression Process Started ===');
        // Nutze toLocaleString für bessere Lesbarkeit im Status
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

            // WICHTIG: Wir leeren das Log hier NICHT, damit die wenigen Events für den nächsten Tag erhalten bleiben und dann verarbeitet werden.
            return;
        }

        // 2. Daten vorbereiten
        // Wir kopieren die Daten, falls während der Verarbeitung neue Events reinkommen.
        const dataToCompress = JSON.parse(JSON.stringify(this.rawEventLog));
        const eventCount = dataToCompress.length;

        // 3. KI Prompt erstellen (Data Compression Agent)
        const personaKey = this.config.aiPersona || 'generic';
        const personaInstruction = PERSONA_MAPPING[personaKey] || PERSONA_MAPPING['generic'];
        const livingContext = (this.config.livingContext || 'Keine spezifischen Details angegeben.').substring(0, 200);

        // SPRINT 16: Hinweis zum System-Modus, damit die KI weiß, wenn der Tag "unnormal" war.
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
    // === System Funktionen ===
    // ======================================================================

    async resetAnalysisStates() {
        await this.setStateAsync('analysis.activitySummary', { val: 'No recent activity.', ack: true });
        // SPRINT 16: Setze Deviation zurück
        await this.setStateAsync('analysis.deviationFromBaseline', { val: 'N/A (No Activity)', ack: true });
        await this.setStateAsync('analysis.comfortSummary', { val: '', ack: true });
        await this.setStateAsync('analysis.comfortSuggestion', { val: '', ack: true });
        await this.setStateAsync('analysis.alertReason', { val: '', ack: true });
    }

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
                this.log.info('Manual LTM Daily Digest creation triggered by user...');
                this.setState(id, { val: false, ack: true }); // Button zurücksetzen
                this.createDailyDigest().catch(e => this.log.error(`Error running manual Daily Digest creation: ${e.message}`));
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
            // Prüfe auf den spezifischen Befehl 'testApiKey'
            if (obj.command === 'testApiKey') {
                this.log.info('Received testApiKey request from Admin UI.');
                const apiKey = obj.message.apiKey;

                if (!apiKey) {
                    // Antwort an die UI senden (Fehler)
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

                // Führe den Verbindungstest durch
                const result = await this.testGeminiConnection(apiKey);
                this.log.info(`API Key test result: ${result.success ? 'Success' : 'Failed'} - ${result.message}`);

                // Antwort an die UI senden (Erfolg oder Fehlerdetails)
                if (obj.callback) {
                    this.sendTo(obj.from, obj.command, result, obj.callback);
                }
            }
        }
    }

    async testGeminiConnection(apiKey) {
        try {
            const testGenAI = new GoogleGenerativeAI(apiKey);
            const model = testGenAI.getGenerativeModel({ model: 'models/gemini-flash-latest' });

            this.log.debug('Attempting a simple generateContent call to validate API Key...');

            // Sende einen einfachen Text, um die API-Konnektivität zu testen.
            const result = await model.generateContent('hello');
            const response = await result.response;

            // Wenn wir eine Antwort erhalten, ist der Schlüssel gültig.
            if (response && response.text()) {
                return { success: true, message: 'Connection successful! API Key is valid.' };
            }
            // Sollte nicht passieren, aber als Fallback
            return { success: false, message: 'Connection test failed: Received an empty response.' };
        } catch (error) {
            let errorMessage = error.message || 'Unknown error';

            // Vereinfache Fehlermeldungen für den Benutzer
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
    // === SPRINT 16: Cogni-Engine (runGeminiAnalysis Upgrade) ===
    // ======================================================================

    /**
     * Führt die KI-Analyse durch, indem STM (aktuelle Daten) mit LTM (Baseline) verglichen wird,
     * unter Berücksichtigung des aktuellen System-Modus.
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
            this.resetAnalysisStates();
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


        // --- 2. BASELINE (LTM) VORBEREITEN (SPRINT 16) ---
        let baselinePromptSection = '';
        let taskInstruction = '';
        const digestCount = this.dailyDigests.length;
        // SPRINT 16: Nutze Konfigurationswert
        const minDaysRequired = this.config.minDaysForBaseline || 7;

        // Baseline wird nur genutzt, wenn genug Daten vorhanden UND der Modus 'normal' oder 'guest' ist.
        // Bei 'party' oder 'vacation' ist die Baseline irrelevant.
        const useBaseline = digestCount >= minDaysRequired && (this.currentSystemMode === SYSTEM_MODES.NORMAL || this.currentSystemMode === SYSTEM_MODES.GUEST);

        if (useBaseline) {
            // Baseline ist bereit -> Aktiviere Vergleichsmodus
            this.log.info(`LTM Baseline established (${digestCount} days). Activating deviation detection. Mode: ${this.currentSystemMode}.`);

            // Hole die relevanten Digests (die neuesten X Tage).
            // dailyDigests ist FIFO (Ältestes zuerst, Index 0). Wir wollen die neuesten, also slice(-N) und reverse().
            const relevantDigests = this.dailyDigests
                .slice(-MAX_DAYS_FOR_BASELINE_PROMPT)
                .reverse(); // Neueste zuerst für die KI

            // Formatiere die Digests für den Prompt (Menschenlesbar)
            const baselineData = relevantDigests.map(d => {
                // Nutze lokales Datum für bessere Lesbarkeit im Prompt
                const date = new Date(d.timestamp).toLocaleDateString('de-DE');
                // Füge Modus hinzu, wenn bekannt und nicht normal (damit die KI weiß, dass dieser Tag evtl. ein Ausreißer war)
                const modeSuffix = (d.systemMode && d.systemMode !== SYSTEM_MODES.NORMAL) ? ` | Modus: ${d.systemMode}` : '';
                return `[${date} | Aktivität: ${d.activityLevel}${modeSuffix}]: ${d.summary}`;
            }).join('\n');

            baselinePromptSection = `
BASELINE (Gelerntes Normalverhalten - Zusammenfassungen der letzten ${relevantDigests.length} Tage, neueste zuerst):
${baselineData}
            `;

            taskInstruction = `Analysiere die AKTUELLEN SENSORDATEN und vergleiche sie mit der BASELINE unter Berücksichtigung des SYSTEM-MODUS. Der Fokus liegt auf der Erkennung signifikanter Abweichungen vom Normalverhalten (Timing, Intensität, Ort), die NICHT durch den aktuellen System-Modus erklärt werden können. Bewerte diese Abweichung in 'deviationFromBaseline'.`;

        } else {
            // Nicht genug Daten oder Modus deaktiviert Baseline
            this.log.info(`LTM Deviation detection inactive. Reason: Learning Phase (${digestCount}/${minDaysRequired} days) OR System Mode (${this.currentSystemMode}).`);

            baselinePromptSection = `
BASELINE STATUS: Inaktiv (Entweder Lernphase oder durch System-Modus deaktiviert).
            `;
            taskInstruction = `Analysiere die AKTUELLEN SENSORDATEN basierend auf KONTEXT, PERSONA und SYSTEM-MODUS. Ein Baseline-Vergleich findet NICHT statt. Bewerte 'deviationFromBaseline' immer mit 'N/A (Learning)'.`;
        }


        // --- 3. SYSTEM PROMPT ZUSAMMENSTELLEN (Dynamisch) ---
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
            ${taskInstruction}

            JSON SCHEMA (MUSS eingehalten werden):
            {
              "activity": {
                "summary": "string (Detaillierte Bewertung 1-2 Sätze. Beschreibe Aktivität, wie sie sich zur Baseline verhält UND beziehe den System-Modus ein.)",
                "deviationFromBaseline": "string (MUSS eines sein von: 'N/A (Learning)', 'none', 'slight', 'significant', 'critical')",
                "isAlert": false, // boolean (TRUE nur, wenn deviation='critical' ODER die Situation akut gefährlich ist, unter Beachtung des SYSTEM-MODUS)
                "alertReason": "" // string (Grund wenn isAlert=true, sonst leerer String)
              },
              "comfort": {
                "summary": "string (Detaillierte Bewertung 1-2 Sätze)",
                "suggestion": "string" // Proaktiver Automatisierungsvorschlag (1 Satz) oder leerer String
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

            try {
                // Robustes Parsing
                const rawText = response.text();
                this.log.debug(`AI Response received (raw text): ${rawText}`);

                const cleanText = rawText
                    .replace(/```json/g, '')
                    .replace(/```/g, '')
                    .trim();
                analysisResult = JSON.parse(cleanText);
            } catch (parseError) {
                this.log.error(
                    `Failed to parse AI response as JSON: ${parseError.message}. Raw response: ${response.text()}`,
                );
                await this.setStateAsync('analysis.lastResult', {
                    val: `{"error": "Invalid JSON received", "details": "${parseError.message}"}`,
                    ack: true,
                });
                await this.setStateAsync('analysis.isAlert', { val: true, ack: true });
                return;
            }

            // --- 5. JSON VALIDIERUNG UND VERARBEITUNG ---
            // SPRINT 16: Validierung erweitert um 'deviationFromBaseline'
            if (
                analysisResult &&
                analysisResult.activity &&
                analysisResult.comfort &&
                typeof analysisResult.activity.isAlert === 'boolean' &&
                typeof analysisResult.activity.deviationFromBaseline === 'string'
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
                await this.setStateAsync('analysis.alertReason', {
                    val: analysisResult.activity.alertReason || '',
                    ack: true,
                });

                const alertFound = analysisResult.activity.isAlert;

                if (alertFound) {
                    this.log.warn(`>>> AI ALERT DETECTED! Mode: ${this.currentSystemMode}. Deviation: ${deviation}. Reason: ${analysisResult.activity.alertReason || 'N/A'} <<<`);
                    await this.setStateAsync('analysis.isAlert', { val: true, ack: true });
                } else {
                    this.log.info(`AI analysis complete. Mode: ${this.currentSystemMode}. Deviation: ${deviation}. No alert conditions found.`);
                    await this.setStateAsync('analysis.isAlert', { val: false, ack: true });
                }

                // Logbuch aktualisieren
                const logEntry = {
                    timestamp: Date.now(),
                    analysis: analysisResult,
                    usedBaseline: useBaseline, // SPRINT 16: Speichern, ob Baseline genutzt wurde
                    systemMode: this.currentSystemMode // SPRINT 16: Speichere den Modus der Analyse
                };
                await this.updateAnalysisHistory(logEntry);
            } else {
                // Fehler: JSON Struktur fehlt
                this.log.error(
                    `AI response JSON structure is invalid. Missing required fields (check activity, comfort, isAlert or deviationFromBaseline). Received: ${JSON.stringify(analysisResult)}`,
                );
                await this.setStateAsync('analysis.lastResult', {
                    val: `{"error": "Invalid JSON structure", "received": ${JSON.stringify(analysisResult)}}`,
                    ack: true,
                });
                await this.setStateAsync('analysis.isAlert', { val: true, ack: true });
            }
        } catch (error) {
            // Fehler: API-Aufruf fehlgeschlagen
            this.log.error(`Error calling Gemini AI: ${error.message}`);
            const errorMessage = (error.message || 'Unknown error').replace(/"/g, '\\"');
            await this.setStateAsync('analysis.lastResult', {
                val: `{"error": "API Call failed", "details": "${errorMessage}"}`,
                ack: true,
            });
        }
    }
    // ======================================================================
    // === SPRINT 16 END: Cogni-Engine ===
    // ======================================================================


    // (Helper functions)
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

    // SPRINT 16 Update: Zeige Deviation und System Mode im Logbuch
    _formatAnalysisForHistory(logEntry) {
        const time = new Date(logEntry.timestamp).toLocaleString('de-DE');

        // --- AKTUELLES FORMAT (Sprint 16+) ---
        if (logEntry.analysis && logEntry.analysis.activity) {
            const analysis = logEntry.analysis;
            const isAlert = analysis.activity.isAlert === true;

            // Zeige Abweichung und Modus im Prefix
            const deviation = analysis.activity.deviationFromBaseline || 'N/A';
            // Zeige Modus nur, wenn nicht Normal
            const modeSuffix = (logEntry.systemMode && logEntry.systemMode !== SYSTEM_MODES.NORMAL) ? ` | Mode: ${logEntry.systemMode}` : '';

            const prefix = isAlert ? `[ALARM | Dev: ${deviation}${modeSuffix}] ` : `[Info | Dev: ${deviation}${modeSuffix}] `;


            let summary = '';
            if (isAlert && analysis.activity.alertReason) {
                summary = analysis.activity.alertReason;
            } else {
                summary = analysis.activity.summary || 'Analysis successful';
            }

            // Kürzen, um Platz für den längeren Prefix zu schaffen (von 80 auf 70 reduziert)
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