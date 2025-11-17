'use strict';
const utils = require('@iobroker/adapter-core');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Globale Konstanten
const HISTORY_MAX_SIZE = 50;
const DEBUG_HISTORY_COUNT = 5;
const GEMINI_MODEL = 'models/gemini-flash-latest';
const ANALYSIS_HISTORY_MAX_SIZE = 100;
const DEBUG_ANALYSIS_HISTORY_COUNT = 5;

const PERSONA_MAPPING = {
    generic: 'Analyze balanced for health, safety, and comfort.',
    senior_aal:
        'PRIORITY: Health and Safety for seniors (AAL). Detect inactivity, potential falls (inferred), unusual night activity. Comfort is secondary.',
    family: 'Focus on family routines, child safety, and general household management. Expect high activity levels.',
    single_comfort:
        'Focus on maximizing comfort, automation efficiency, and energy saving for a single resident. Activity patterns are flexible.',
    security:
        'PRIORITY: Security. Detect intrusions, unusual presence when residents are away, or malfunctions indicating a security risk.',
};

class CogniLiving extends utils.Adapter {
    constructor(options) {
        super({
            ...options,
            name: 'cogni-living',
        });
        this.eventHistory = [];
        this.analysisHistory = [];
        this.genAI = null;
        this.geminiModel = null;
        this.analysisTimer = null;
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
        // Message Handler für UI-Interaktionen (API Test)
        this.on('message', this.onMessage.bind(this));
    }

    // (onReady, resetAnalysisStates, onUnload, onStateChange, processSensorEvent - unverändert, hier zur Vollständigkeit)
    async onReady() {
        const adapterVersion = this.version || 'unknown';
        this.log.info(`cogni-living adapter starting (v${adapterVersion})`);

        // === 1. KI INITIALISIERUNG (JSON MODE) ===
        if (this.config.geminiApiKey) {
            try {
                this.genAI = new GoogleGenerativeAI(this.config.geminiApiKey);
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

        // === 2. DATENPUNKTE ERSTELLEN ===
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

        // === 4. STATES ABONNIEREN ===
        this.subscribeStates('analysis.trigger');
        const devices = this.config.devices;
        if (!devices || devices.length === 0) {
            this.log.warn('No sensors configured!');
        } else {
            this.log.info(`Found ${devices.length} configured sensors. Subscribing...`);
            for (const device of devices) {
                if (device.id) {
                    await this.subscribeForeignStatesAsync(device.id);
                }
            }
        }

        // === 5. AUTOPILOT-TIMER STARTEN (MIT FILTER) ===
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
    }

    async resetAnalysisStates() {
        await this.setStateAsync('analysis.activitySummary', { val: 'No recent activity.', ack: true });
        await this.setStateAsync('analysis.comfortSummary', { val: '', ack: true });
        await this.setStateAsync('analysis.comfortSuggestion', { val: '', ack: true });
        await this.setStateAsync('analysis.alertReason', { val: '', ack: true });
    }

    onUnload(callback) {
        try {
            if (this.analysisTimer) {
                this.log.info('Stopping Autopilot timer...');
                clearInterval(this.analysisTimer);
                this.analysisTimer = null;
            }
        } catch {
            // ignore
        }
        callback();
    }

    onStateChange(id, state) {
        if (!state) {
            return;
        }

        // --- B) Befehl (ack=false) ---
        if (!state.ack) {
            if (id === `${this.namespace}.analysis.trigger` && state.val === true) {
                this.log.info('Manual AI analysis triggered by user...');
                this.setState(id, { val: false, ack: true });
                this.runGeminiAnalysis().catch(e => this.log.error(`Error running Gemini analysis: ${e.message}`));
            }
            return;
        }

        // --- A) Sensor-Event (ack=true) ---
        const deviceConfig = (this.config.devices || []).find(d => d.id === id);
        if (!deviceConfig) {
            return;
        }

        // 2. === SELEKTIVER FILTER ===
        if (!deviceConfig.logDuplicates) {
            const lastEventForThisId = this.eventHistory.find(event => event.id === id);
            if (lastEventForThisId && lastEventForThisId.value === state.val) {
                this.log.debug(`Ignoring redundant state update for ${id} (Value: ${state.val})`);
                return;
            }
        }

        this.processSensorEvent(id, state, deviceConfig).catch(e =>
            this.log.error(`Error processing sensor event: ${e.message}`),
        );
    }

    async processSensorEvent(id, state, deviceConfig) {
        const location = deviceConfig.location || 'unknown';
        const type = deviceConfig.type || 'unknown';
        const name = deviceConfig.name || 'unknown';
        const eventObject = {
            timestamp: state.ts,
            id: id,
            name: name,
            value: state.val,
            location: location,
            type: type,
        };
        await this.setStateAsync('events.lastEvent', { val: JSON.stringify(eventObject), ack: true });
        this.eventHistory.unshift(eventObject);
        if (this.eventHistory.length > HISTORY_MAX_SIZE) {
            this.eventHistory.pop();
        }
        await this.setStateAsync('events.history', { val: JSON.stringify(this.eventHistory), ack: true });
        await this._updateDebugSensorHistoryStates();
    }

    /**
     * Handler für Nachrichten von der Admin-UI
     */
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

    /**
     * Testet die Verbindung zur Gemini API.
     */
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

    // (runGeminiAnalysis und alle Helper-Funktionen - unverändert, hier zur Vollständigkeit)
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
        const livingContext = (this.config.livingContext || 'No specific details provided.').substring(0, 200);

        // --- JSON PROMPT MIT KONTEXT ---
        const systemPrompt = `
            ROLE: Smart Home Analyst.
            TASK: Analyze the provided sensor events based on the defined CONTEXT and PERSONA.
            FORMAT: Respond with a JSON object ONLY. NO PROSE. NO MARKDOWN outside strings.

            CONTEXT (Living Situation Details):
            ${livingContext}

            PERSONA (Analysis Focus Instructions):
            ${personaInstruction}

            JSON SCHEMA:
            {
              "activity": {
                "summary": "string (Detailed assessment 1-2 sentences, considering CONTEXT/PERSONA)",
                "isAlert": false, // boolean (TRUE only if situation is critical based on CONTEXT/PERSONA)
                "alertReason": "" // string (Reason if isAlert=true, else empty string)
              },
              "comfort": {
                "summary": "string (Detailed assessment 1-2 sentences)",
                "suggestion": "string" // Proactive automation suggestion (1 sentence) or empty string
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
            await this.setStateAsync('analysis.lastResult', {
                val: `{"error": "API Call failed", "details": "${error.message}"}`,
                ack: true,
            });
        }
    }

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
