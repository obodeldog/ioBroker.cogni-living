'use strict';
const utils = require('@iobroker/adapter-core');
const { GoogleGenerativeAI } = require('@google/generative-ai');
// === SPRINT 15 START: Import ===
const schedule = require('node-schedule');
// === SPRINT 15 END ===

// Globale Konstanten
const HISTORY_MAX_SIZE = 50; // STM (Short Term Memory)
const DEBUG_HISTORY_COUNT = 5;
const GEMINI_MODEL = 'models/gemini-flash-latest';
const ANALYSIS_HISTORY_MAX_SIZE = 100;
const DEBUG_ANALYSIS_HISTORY_COUNT = 5;

// === SPRINT 14/15: LTM Konstanten ===
const RAW_LOG_MAX_SIZE = 1500; // LTM - Max Rohereignisse (ca. 1-2 Tage)
const LTM_DP_RAW_LOG = 'LTM.rawEventLog';
// SPRINT 15 START
const DAILY_DIGEST_MAX_SIZE = 60; // LTM - Max komprimierte Tages-Digests (Baseline)
const LTM_DP_DAILY_DIGESTS = 'LTM.dailyDigests';
const LTM_DP_STATUS = 'LTM.processingStatus';
const LTM_DP_TRIGGER_DIGEST = 'LTM.triggerDailyDigest';
const LTM_SCHEDULE = '0 3 * * *'; // Täglich um 03:00 Uhr
const LTM_MIN_EVENTS_FOR_COMPRESSION = 5; // Mindestanzahl Events, bevor Kompression startet
// SPRINT 15 END
// === SPRINT 14/15 END ===


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

        // === SPRINT 14/15 START: LTM Initialisierung ===
        /**
         * LTM - Speicher für Rohdaten-Events. FIFO.
         * @type {Array<object>}
         */
        this.rawEventLog = []; // LTM Raw

        /**
         * LTM - Speicher für komprimierte Tageszusammenfassungen (Baseline). FIFO.
         * @type {Array<object>}
         */
        this.dailyDigests = []; // LTM Compressed

        /**
         * Scheduler Job für LTM Verarbeitung
         * @type {schedule.Job | null}
         */
        this.ltmJob = null;
        // === SPRINT 14/15 END ===

        // State Tracking (Patch 14.1)
        /**
         * Speichert den letzten bekannten Wert jedes Sensors.
         * @type {Record<string, any>}
         */
        this.sensorLastValues = {};

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
        // Message Handler für UI-Interaktionen (API Test)
        this.on('message', this.onMessage.bind(this));
    }

    async onReady() {
        const adapterVersion = this.version || 'unknown';
        this.log.info(`cogni-living adapter starting (v${adapterVersion})`);

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

        // === 2. DATENPUNKTE ERSTELLEN (STM & Analysis) ===
        // ... (Alle setObjectNotExistsAsync Aufrufe bleiben unverändert)
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

        // 3b. LTM (Long Term Memory) laden (Sprint 14/15)
        await this.checkLtmObjects();
        await this.loadRawEventLog();
        await this.loadDailyDigests(); // SPRINT 15


        // === 4. STATES ABONNIEREN & INITIALISIEREN ===
        this.subscribeStates('analysis.trigger');
        // SPRINT 15 NEU: Abonniere LTM Trigger
        this.subscribeStates(LTM_DP_TRIGGER_DIGEST);

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

        // 5b. LTM Scheduler (Sprint 15)
        this.setupLtmScheduler();
    }

    // ======================================================================
    // === SPRINT 14/15: LTM Management Funktionen ===
    // ======================================================================

    /**
     * Stellt sicher, dass die LTM-Datenpunkte existieren und aktualisiert sie bei Bedarf.
     */
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

        // SPRINT 15 START
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
        // SPRINT 15 END
    }

    /**
     * Lädt das Rohereignisprotokoll (LTM Raw) aus dem DP in den Arbeitsspeicher.
     */
    async loadRawEventLog() {
        // ... (Unverändert von Sprint 14)
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

    /**
     * Speichert das aktuelle Rohereignisprotokoll (LTM Raw) in den ioBroker-Datenpunkt.
     */
    async saveRawEventLog() {
        // ... (Unverändert von Sprint 14)
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

    // ======================================================================
    // === SPRINT 15 START: Daily Digest & Scheduler Funktionen ===
    // ======================================================================

    /**
     * Lädt die Daily Digests (LTM Compressed) aus dem DP in den Arbeitsspeicher.
     */
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
                        await this.saveDailyDigests();
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
    }

    /**
     * Speichert die Daily Digests (LTM Compressed) in den ioBroker-Datenpunkt.
     */
    async saveDailyDigests() {
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
    }

    /**
     * Richtet den Scheduler für die nächtliche LTM-Verarbeitung ein.
     */
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

    /**
     * Die Hauptfunktion für die LTM-Kompression. Wird vom Scheduler oder manuell aufgerufen.
     * Komprimiert rawEventLog zu einem Daily Digest mittels KI.
     */
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

        const systemPrompt = `
            ROLLE: Data Compression Agent (Langzeitgedächtnis).
            AUFGABE: Komprimiere die bereitgestellten rohen Sensor-Events in eine prägnante Zusammenfassung des Zeitraums (ca. 1 Tag).
            SPRACHE: Antworte ausschließlich auf Deutsch (DE).
            FORMAT: Antworte NUR mit einem JSON-Objekt.

            KONTEXT (Details zur Wohnsituation):
            ${livingContext}

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
            // WICHTIG: Bei Fehler brechen wir ab, ABER wir löschen die Rohdaten NICHT.
            // So kann der Prozess beim nächsten Lauf (oder manuell) wiederholt werden.
            return;
        }

        // 5. Ergebnis validieren und speichern
        if (compressionResult && compressionResult.summary && compressionResult.activityLevel) {
            this.log.info(`LTM: Compression successful. Summary: ${compressionResult.summary}`);

            const digestEntry = {
                timestamp: new Date().toISOString(), // Zeitpunkt der Kompression
                eventCount: eventCount,
                summary: compressionResult.summary,
                activityLevel: compressionResult.activityLevel
            };

            // Zum Speicher hinzufügen (Neuestes hinten - FIFO)
            this.dailyDigests.push(digestEntry);
            await this.saveDailyDigests();

            // 6. Rohdaten bereinigen
            // Wir entfernen die erfolgreich komprimierten Daten aus dem this.rawEventLog.

            // Robuste Methode: Entferne die ersten 'eventCount' Elemente.
            // Dies stellt sicher, dass Events, die während der KI-Verarbeitung ankamen, erhalten bleiben.
            if (this.rawEventLog.length >= eventCount) {
                this.rawEventLog.splice(0, eventCount);
            } else {
                // Sollte nicht passieren, aber zur Sicherheit:
                this.log.warn("LTM: Mismatch between compressed data count and rawEventLog length. Clearing entire log.");
                this.rawEventLog = [];
            }

            await this.saveRawEventLog();
            this.log.info(`LTM: Cleaned up rawEventLog. Remaining events: ${this.rawEventLog.length}.`);
            await this.setStateAsync(LTM_DP_STATUS, { val: `Success: Compressed ${eventCount} events at ${new Date().toLocaleString()}`, ack: true });

        } else {
            this.log.error(`LTM Compression failed: Invalid JSON structure received from AI. Received: ${JSON.stringify(compressionResult)}`);
            await this.setStateAsync(LTM_DP_STATUS, { val: 'Error: Invalid JSON structure.', ack: true });
            // Auch hier: Rohdaten nicht löschen, um Wiederholung zu ermöglichen.
        }

        this.log.info('=== LTM Compression Process Finished ===');
    }

    // === SPRINT 15 END: Daily Digest & Scheduler Funktionen ===

    // ======================================================================
    // === ENDE LTM Management Funktionen ===
    // ======================================================================


    async resetAnalysisStates() {
        // ... (Unverändert)
        await this.setStateAsync('analysis.activitySummary', { val: 'No recent activity.', ack: true });
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

            // === SPRINT 15 START: Scheduler Cleanup ===
            if (this.ltmJob) {
                this.log.info('Cancelling LTM Scheduler...');
                this.ltmJob.cancel();
                this.ltmJob = null;
            }
            // === SPRINT 15 END ===

        } catch (e) {
            this.log.error(`Error during unload: ${e.message}`);
        }
        callback();
    }

    onStateChange(id, state) {
        if (!state) {
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

            // SPRINT 15 NEU: LTM Digest Trigger
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

    /**
     * Verarbeitet ein eingehendes Sensorereignis, fügt es dem STM und LTM hinzu.
     */
    async processSensorEvent(id, state, deviceConfig) {
        // ... (Unverändert von Patch 14.1)
        const location = deviceConfig.location || 'unknown';
        const type = deviceConfig.type || 'unknown';
        const name = deviceConfig.name || 'unknown';

        // === 0. Update Last Value (PATCH 14.1) ===
        // Wichtig: Dies muss passieren, damit der Tracker aktuell ist für das nächste Event.
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

        // LTM Event-Objekt (Optimiert für KI-Verarbeitung und Langzeitspeicherung)
        const eventObjectLTM = {
            // ISO Zeit für bessere Lesbarkeit im Log und für die KI (wichtig für Tages-Kompression)
            timestamp: new Date(state.ts).toISOString(),
            sensorName: name,
            location: location,
            value: state.val
        };

        // Zum LTM Raw Log hinzufügen (Neuestes hinten - FIFO)
        this.rawEventLog.push(eventObjectLTM);

        // LTM persistent speichern (und Limitierung durchführen)
        await this.saveRawEventLog();

        this.log.debug(`Event processed for ${id} (Value: ${state.val}). STM Count: ${this.eventHistory.length}, LTM Count: ${this.rawEventLog.length}`);
    }

    /**
     * Handler für Nachrichten von der Admin-UI
     */
    async onMessage(obj) {
        // ... (Unverändert)
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

    /**
     * Testet die Verbindung zur Gemini API.
     */
    async testGeminiConnection(apiKey) {
        // ... (Unverändert)
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

    // (runGeminiAnalysis - Unverändert von Patch 14.1. In Sprint 16 wird diese Funktion erweitert)
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

        // --- KONTEXT UND PERSONA LADEN ---
        const personaKey = this.config.aiPersona || 'generic';
        const personaInstruction = PERSONA_MAPPING[personaKey] || PERSONA_MAPPING['generic'];
        const livingContext = (this.config.livingContext || 'Keine spezifischen Details angegeben.').substring(0, 200);

        // --- JSON PROMPT MIT KONTEXT (PATCH 14.1: SPRACH-FIX) ---
        const systemPrompt = `
            ROLLE: Smart Home Analyst.
            AUFGABE: Analysiere die bereitgestellten Sensorereignisse basierend auf dem definierten KONTEXT und der PERSONA.
            SPRACHE: Antworte ausschließlich auf Deutsch (DE).
            FORMAT: Antworte NUR mit einem JSON-Objekt. KEIN Prosatext. KEIN Markdown außerhalb von Strings.

            KONTEXT (Details zur Wohnsituation):
            ${livingContext}

            PERSONA (Anweisungen zum Analysefokus):
            ${personaInstruction}

            JSON SCHEMA:
            {
              "activity": {
                "summary": "string (Detaillierte Bewertung 1-2 Sätze, unter Berücksichtigung von KONTEXT/PERSONA)",
                "isAlert": false, // boolean (TRUE nur, wenn die Situation basierend auf KONTEXT/PERSONA kritisch ist)
                "alertReason": "" // string (Grund, wenn isAlert=true, sonst leerer String)
              },
              "comfort": {
                "summary": "string (Detaillierte Bewertung 1-2 Sätze)",
                "suggestion": "string" // Proaktiver Automatisierungsvorschlag (1 Satz) oder leerer String
              }
            }
        `;
        const dataPrompt = JSON.stringify(this.eventHistory, null, 2);
        const fullPrompt = `${systemPrompt}\n\nSENSOR DATA:\n${dataPrompt}`;
        await this.setStateAsync('analysis.lastPrompt', { val: fullPrompt, ack: true });

        try {
            this.log.info(`Sending prompt to Gemini AI (JSON Mode)... Persona: ${personaKey}`);
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

            // --- JSON VALIDIERUNG UND VERARBEITUNG ---
            // ... (Unverändert)
            if (
                analysisResult &&
                analysisResult.activity &&
                analysisResult.comfort &&
                typeof analysisResult.activity.isAlert === 'boolean'
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
                    this.log.warn(`>>> AI ALERT DETECTED! Reason: ${analysisResult.activity.alertReason || 'N/A'} <<<`);
                    await this.setStateAsync('analysis.isAlert', { val: true, ack: true });
                } else {
                    this.log.info('AI analysis complete. No alert conditions found.');
                    await this.setStateAsync('analysis.isAlert', { val: false, ack: true });
                }

                // Logbuch aktualisieren
                const logEntry = {
                    timestamp: Date.now(),
                    analysis: analysisResult,
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
            }
        } catch (error) {
            // Fehler: API-Aufruf fehlgeschlagen
            this.log.error(`Error calling Gemini AI: ${error.message}`);
            // Patch 14.1: Stelle sicher, dass die Fehlermeldung korrekt im JSON gespeichert wird (Escape quotes)
            const errorMessage = (error.message || 'Unknown error').replace(/"/g, '\\"');
            await this.setStateAsync('analysis.lastResult', {
                val: `{"error": "API Call failed", "details": "${errorMessage}"}`,
                ack: true,
            });
        }
    }

    // (Helper functions bleiben unverändert)
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

        // --- NEUES FORMAT (Sprint 11+) ---
        if (logEntry.analysis && logEntry.analysis.activity) {
            const analysis = logEntry.analysis;
            const isAlert = analysis.activity.isAlert === true;
            const prefix = isAlert ? '[ALARM] ' : '[Info] ';

            let summary = '';
            if (isAlert && analysis.activity.alertReason) {
                summary = analysis.activity.alertReason;
            } else {
                summary = analysis.activity.summary || 'Analysis successful';
            }

            const shortSummary = summary.length > 100 ? `${summary.substring(0, 100)}...` : summary;
            return `${time} - ${prefix}${shortSummary}`;
        }

        // --- ALTES FORMAT (Fallback für < Sprint 11) ---
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