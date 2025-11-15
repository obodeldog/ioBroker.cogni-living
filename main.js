'use strict';
const utils = require('@iobroker/adapter-core');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Globale Konstanten
const HISTORY_MAX_SIZE = 50;
const DEBUG_HISTORY_COUNT = 5;
const GEMINI_MODEL = 'models/gemini-flash-latest';
const ANALYSIS_HISTORY_MAX_SIZE = 100;
const DEBUG_ANALYSIS_HISTORY_COUNT = 5;
const ALERT_KEYWORDS = [
    'WARNUNG', 'ACHTUNG', 'PROBLEM', 'STÖRUNG',
    'INAKTIVITÄT', 'ABWEICHUNG', 'NOTFALL', 'STURZ'
];

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
    }

    async onReady() {
        // Versionsnummer dynamisch lesen für die Log-Ausgabe
        const adapterVersion = this.version || 'unknown';
        this.log.info(`cogni-living adapter starting (v${adapterVersion})`);

        // === 1. KI INITIALISIERUNG ===
        if (this.config.geminiApiKey) {
            try {
                this.genAI = new GoogleGenerativeAI(this.config.geminiApiKey);
                this.geminiModel = this.genAI.getGenerativeModel({ model: GEMINI_MODEL });
                this.log.info(`Gemini AI client initialized for model: ${GEMINI_MODEL}`);
            } catch (error) {
                this.log.error(`Failed to initialize Gemini AI: ${error.message}`);
            }
        } else {
            this.log.warn('Gemini API Key is missing. AI features will be disabled.');
        }
        // === 2. DATENPUNKTE ERSTELLEN ===
        await this.setObjectNotExistsAsync('events.lastEvent', { type: 'state', common: { name: 'Last raw event', type: 'string', role: 'json', read: true, write: false }, native: {} });
        await this.setObjectNotExistsAsync('events.history', { type: 'state', common: { name: 'Event History (JSON Array)', type: 'string', role: 'json', read: true, write: false }, native: {} });
        for (let i = 0; i < DEBUG_HISTORY_COUNT; i++) {
            const idIndex = i.toString().padStart(2, '0');
            await this.setObjectNotExistsAsync(`events.history_debug_${idIndex}`, { type: 'state', common: { name: `History Event ${idIndex}`, type: 'string', role: 'text', read: true, write: false }, native: {} });
        }
        await this.setObjectNotExistsAsync('analysis.trigger', { type: 'state', common: { name: 'Trigger Analysis', type: 'boolean', role: 'button', read: true, write: true, def: false }, native: {} });
        await this.setObjectNotExistsAsync('analysis.lastPrompt', { type: 'state', common: { name: 'Last Prompt sent to AI', type: 'string', role: 'text', read: true, write: false }, native: {} });
        await this.setObjectNotExistsAsync('analysis.lastResult', { type: 'state', common: { name: 'Last Result from AI', type: 'string', role: 'text', read: true, write: false }, native: {} });
        await this.setObjectNotExistsAsync('analysis.isAlert', { type: 'state', common: { name: 'AI Alert Status', type: 'boolean', role: 'indicator.alarm', read: true, write: false, def: false }, native: {} });
        await this.setObjectNotExistsAsync('analysis.analysisHistory', {
            type: 'state',
            common: { name: 'Analysis Logbook (JSON Array)', type: 'string', role: 'json', read: true, write: false, def: '[]' },
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
                    // WICHTIG/FIX in v0.1.10: Wir abonnieren ALLE Updates (change: 'any'),
                    // da der Filter jetzt intern in onStateChange gehandhabt wird.
                    await this.subscribeForeignStatesAsync(device.id);
                }
            }
        }
        // === 5. AUTOPILOT-TIMER STARTEN (MIT FILTER) ===
        if (this.analysisTimer) { clearInterval(this.analysisTimer); this.analysisTimer = null; }
        const intervalMinutes = this.config.analysisInterval || 15;
        const intervalMilliseconds = intervalMinutes * 60 * 1000;
        if (intervalMilliseconds > 0) {
            this.log.info(`Starting Autopilot: Analysis will run every ${intervalMinutes} minutes.`);
            this.analysisTimer = setInterval(() => {
                if (this.eventHistory.length === 0) {
                    this.log.info('Autopilot: Skipping analysis, no events in memory.');
                    return;
                }
                const now = Date.now();
                const lastEventTime = this.eventHistory[0].timestamp;
                if (now - lastEventTime > intervalMilliseconds) {
                    this.log.info('Autopilot: Skipping analysis, no new events in the last interval.');
                    this.setState('analysis.isAlert', { val: false, ack: true });
                    return;
                }
                this.log.info('Autopilot triggering scheduled AI analysis (Filter passed)...');
                this.runGeminiAnalysis().catch(e => this.log.error(`Error during scheduled Gemini analysis: ${e.message}`));
            }, intervalMilliseconds);
        } else {
            this.log.warn('Analysis interval is set to 0. Autopilot disabled.');
        }
    }

    onUnload(callback) {
        try {
            if (this.analysisTimer) {
                this.log.info('Stopping Autopilot timer...');
                clearInterval(this.analysisTimer);
                this.analysisTimer = null;
            }
            callback();
        } catch (error) {
            callback();
        }
    }

    /**
     * onStateChange: Jetzt mit SELEKTIVEM Redundanz-Filter
     */
    onStateChange(id, state) {
        if (!state) return;

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

        // 1. Ist es ein bekannter Sensor?
        // @ts-ignore
        const deviceConfig = (this.config.devices || []).find(d => d.id === id);
        if (!deviceConfig) {
             return; // Unbekannter Sensor
        }

        // 2. === SELEKTIVER FILTER ===
        // Prüfen, ob die Checkbox "Gleiche Werte loggen" DEAKTIVIERT ist
        // @ts-ignore
        if (!deviceConfig.logDuplicates) {
            // Checkbox ist AUS -> Wir MÜSSEN filtern

            const lastEventForThisId = this.eventHistory.find(event => event.id === id);

            if (lastEventForThisId && lastEventForThisId.value === state.val) {
                 this.log.debug(`Ignoring redundant state update for ${id} (Value: ${state.val})`);
                 return; // VERARBEITUNG ABBRECHEN
            }
        }

        this.processSensorEvent(id, state, deviceConfig)
            .catch(e => this.log.error(`Error processing sensor event: ${e.message}`));
    }

    async processSensorEvent(id, state, deviceConfig) {
        const location = deviceConfig.location || 'unknown';
        const type = deviceConfig.type || 'unknown';
        const name = deviceConfig.name || 'unknown';
        const eventObject = { timestamp: state.ts, id: id, name: name, value: state.val, location: location, type: type };
        await this.setStateAsync('events.lastEvent', { val: JSON.stringify(eventObject), ack: true });
        this.eventHistory.unshift(eventObject);
        if (this.eventHistory.length > HISTORY_MAX_SIZE) { this.eventHistory.pop(); }
        await this.setStateAsync('events.history', { val: JSON.stringify(this.eventHistory), ack: true });
        await this._updateDebugSensorHistoryStates();
    }

    async runGeminiAnalysis() {
        if (!this.geminiModel) {
            this.log.warn('Gemini AI is not initialized. Analysis aborted.');
            await this.setStateAsync('analysis.lastResult', { val: 'Error: AI not initialized', ack: true });
            return;
        }
        if (this.eventHistory.length === 0) {
            this.log.info('Event history is empty. Nothing to analyze.');
            await this.setStateAsync('analysis.lastResult', { val: 'History is empty.', ack: true });
            return;
        }

        const systemPrompt = `
            ANALYSEAUFTRAG:
            Analysiere die folgenden Sensor-Ereignisse.
            Antworte AUSSCHLIESSLICH im folgenden Format (keine Begrüßung, kein Fließtext):

            **Aktivität:** [Deine detaillierte Einschätzung in 1-2 Sätzen. Nutze 'WARNUNG' bei Problemen.]
            **Komfort:** [Deine detaillierte Einschätzung in 1-2 Sätzen.]
        `;
        const dataPrompt = JSON.stringify(this.eventHistory, null, 2);
        const fullPrompt = systemPrompt + "\n\nHier sind die Daten:\n" + dataPrompt;
        await this.setStateAsync('analysis.lastPrompt', { val: fullPrompt, ack: true });

        try {
            this.log.info(`Sending prompt to Gemini AI model: ${GEMINI_MODEL}...`);
            const result = await this.geminiModel.generateContent({
                contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
                generationConfig: { maxOutputTokens: 2048 },
            });
            const response = await result.response;
            const aiText = response.text().trim();
            this.log.info(`AI Response received: ${aiText}`);
            await this.setStateAsync('analysis.lastResult', { val: aiText, ack: true });

            let alertFound = false;
            const upperCaseAiText = aiText.toUpperCase();
            for (const keyword of ALERT_KEYWORDS) {
                if (upperCaseAiText.includes(keyword)) {
                    alertFound = true;
                    break;
                }
            }

            if (alertFound) {
                this.log.warn('>>> AI ALERT DETECTED! Setting isAlert to true. <<<');
                await this.setStateAsync('analysis.isAlert', { val: true, ack: true });
            } else {
                this.log.info('AI analysis complete. No alert conditions found.');
                await this.setStateAsync('analysis.isAlert', { val: false, ack: true });
            }

            const logEntry = {
                timestamp: Date.now(),
                text: aiText,
                alert: alertFound
            };
            await this.updateAnalysisHistory(logEntry);

        } catch (error) {
            this.log.error(`Error calling Gemini AI: ${error.message}`);
            await this.setStateAsync('analysis.lastResult', { val: `Error: ${error.message}`, ack: true });
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
        const prefix = logEntry.alert ? '[ALARM] ' : '[Info] ';
        const shortText = logEntry.text.replace(/\n/g, ' | ');
        return `${time} - ${prefix}${shortText}`;
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
    module.exports = (options) => new CogniLiving(options);
} else {
    new CogniLiving();
}