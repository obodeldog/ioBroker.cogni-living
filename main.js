'use strict';

const utils = require('@iobroker/adapter-core');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const HISTORY_MAX_SIZE = 50;
const DEBUG_HISTORY_COUNT = 5;
const GEMINI_MODEL = 'models/gemini-flash-latest';

class CogniLiving extends utils.Adapter {
    
    constructor(options) {
        super({
            ...options,
            name: 'cogni-living',
        });

        this.eventHistory = []; 
        this.genAI = null;        
        this.geminiModel = null;  
        this.analysisTimer = null; 

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async onReady() {
        // === NEUE, EINDEUTIGE VERSIONSNUMMER ZUM TESTEN ===
        this.log.error('--- CODE-VERSION: 1830_FILTER ---');
        // ===================================================

        this.log.info('cogni-living adapter starting (Sprint 7: Intelligence Filter)');

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
        // (Alle Datenpunkte bleiben gleich)
        await this.setObjectNotExistsAsync('events.lastEvent', { type: 'state', common: { name: 'Last raw event', type: 'string', role: 'json', read: true, write: false }, native: {} });
        await this.setObjectNotExistsAsync('events.history', { type: 'state', common: { name: 'Event History (JSON Array)', type: 'string', role: 'json', read: true, write: false }, native: {} });
        for (let i = 0; i < DEBUG_HISTORY_COUNT; i++) {
            const idIndex = i.toString().padStart(2, '0');
            await this.setObjectNotExistsAsync(`events.history_debug_${idIndex}`, { type: 'state', common: { name: `History Event ${idIndex}`, type: 'string', role: 'text', read: true, write: false }, native: {} });
        }
        await this.setObjectNotExistsAsync('analysis.trigger', { type: 'state', common: { name: 'Trigger Analysis', type: 'boolean', role: 'button', read: true, write: true, def: false }, native: {} });
        await this.setObjectNotExistsAsync('analysis.lastPrompt', { type: 'state', common: { name: 'Last Prompt sent to AI', type: 'string', role: 'text', read: true, write: false }, native: {} });
        await this.setObjectNotExistsAsync('analysis.lastResult', { type: 'state', common: { name: 'Last Result from AI', type: 'string', role: 'text', read: true, write: false }, native: {} });
        
        // === 3. STATES ABONNIEREN ===
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
        
        // === 4. AUTOPILOT-TIMER STARTEN (MIT FILTER) ===
        if (this.analysisTimer) {
            clearInterval(this.analysisTimer);
            this.analysisTimer = null;
        }

        const intervalMinutes = this.config.analysisInterval || 15;
        const intervalMilliseconds = intervalMinutes * 60 * 1000;

        if (intervalMilliseconds > 0) {
            this.log.info(`Starting Autopilot: Analysis will run every ${intervalMinutes} minutes.`);
            
            this.analysisTimer = setInterval(() => {
                
                // --- NEUE FILTER-LOGIK ---
                // 1. Prüfen, ob überhaupt Events im Gedächtnis sind
                if (this.eventHistory.length === 0) {
                    this.log.info('Autopilot: Skipping analysis, no events in memory.');
                    return; // Beendet die Funktion hier
                }
                
                // 2. Prüfen, ob das letzte Event "frisch" ist
                const now = Date.now();
                const lastEventTime = this.eventHistory[0].timestamp;
                
                // Wenn das letzte Event älter ist als das Intervall (z.B. 10 Min alt bei 10 Min Intervall),
                // gab es in dieser Periode kein neues Event.
                if (now - lastEventTime > intervalMilliseconds) {
                    this.log.info('Autopilot: Skipping analysis, no new events in the last interval.');
                    return; // Beendet die Funktion hier
                }
                // -------------------------

                // Nur wenn der Filter passiert wurde, wird die KI gerufen:
                this.log.info('Autopilot triggering scheduled AI analysis (Filter passed)...');
                this.runGeminiAnalysis()
                    .catch(e => this.log.error(`Error during scheduled Gemini analysis: ${e.message}`));

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

    onStateChange(id, state) {
        // ... (Diese Funktion bleibt unverändert) ...
        if (!state) return; 
        if (state.ack) {
            // @ts-ignore
            const deviceConfig = (this.config.devices || []).find(d => d.id === id);
            if (deviceConfig) {
                this.processSensorEvent(id, state, deviceConfig)
                    .catch(e => this.log.error(`Error processing sensor event: ${e.message}`));
            }
            return; 
        }
        if (!state.ack) {
            if (id === `${this.namespace}.analysis.trigger` && state.val === true) {
                this.log.info('Manual AI analysis triggered by user...');
                this.setState(id, { val: false, ack: true }); 
                this.runGeminiAnalysis()
                    .catch(e => this.log.error(`Error running Gemini analysis: ${e.message}`));
            }
            return;
        }
    }

    async processSensorEvent(id, state, deviceConfig) {
        // ... (Diese Funktion bleibt unverändert) ...
        const location = deviceConfig.location || 'unknown';
        const type = deviceConfig.type || 'unknown';
        const name = deviceConfig.name || 'unknown';
        const eventObject = { timestamp: state.ts, id: id, name: name, value: state.val, location: location, type: type };
        await this.setStateAsync('events.lastEvent', { val: JSON.stringify(eventObject), ack: true });
        this.eventHistory.unshift(eventObject);
        if (this.eventHistory.length > HISTORY_MAX_SIZE) { this.eventHistory.pop(); }
        await this.setStateAsync('events.history', { val: JSON.stringify(this.eventHistory), ack: true });
        await this._updateDebugHistoryStates();
    }

    async runGeminiAnalysis() {
        // ... (Sicherheitschecks bleiben unverändert) ...
        if (!this.geminiModel) {
            this.log.warn('Gemini AI is not initialized (missing API key?). Analysis aborted.');
            await this.setStateAsync('analysis.lastResult', { val: 'Error: AI not initialized (Missing API Key)', ack: true });
            return;
        }
        if (this.eventHistory.length === 0) {
            this.log.info('Event history is empty. Nothing to analyze.');
            await this.setStateAsync('analysis.lastResult', { val: 'History is empty.', ack: true });
            return;
        }

        // --- Prompt (unverändert) ---
        const systemPrompt = `
            Du bist "Cogni-Living", ein fortschrittlicher Smart-Home-Assistent mit zwei Rollen:
            1.  **Aktivitäts-Assistent:** Achte auf ungewöhnliche Abweichungen von täglichen Routinen, die auf Inaktivität oder signifikante Verhaltensänderungen hindeuten.
            2.  **Komfort-Assistent:** Suche nach wiederkehrenden Mustern, die man proaktiv automatisieren könnte (z.B. Kaffee machen).

            Analysiere die folgenden Sensor-Ereignisse (als JSON-Array, neuestes Event zuerst).
            Antworte kurz und prägnant in maximal 3 Sätzen:
            1.  Eine "Aktivitäts-Einschätzung" (z.B. "Aktivitätsmuster normal", "WARNUNG: Ungewöhnlich lange Inaktivität").
            2.  Eine "Komfort-Einsicht" (z.B. "Keine Muster erkannt", "Muster: Kaffee nach dem Aufstehen").
        `;
        const dataPrompt = JSON.stringify(this.eventHistory, null, 2);
        const fullPrompt = systemPrompt + "\n\nHier sind die Daten:\n" + dataPrompt;
        await this.setStateAsync('analysis.lastPrompt', { val: fullPrompt, ack: true });
        
        // === 2. Die KI anrufen (BEREINIGT) ===
        try {
            this.log.info(`Sending prompt to Gemini AI model: ${GEMINI_MODEL}...`);
            
            const result = await this.geminiModel.generateContent({
                contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
                generationConfig: {
                    maxOutputTokens: 2048, 
                },
            });

            const response = await result.response;

            // --- DEBUG-LOGS (RAW RESPONSE) SIND ENTFERNT ---

            const aiText = response.text();
            
            this.log.info(`AI Response received: ${aiText}`); // Nur noch die saubere Antwort
            await this.setStateAsync('analysis.lastResult', { val: aiText, ack: true });

        } catch (error) {
            this.log.error(`Error calling Gemini AI: ${error.message}`);
            await this.setStateAsync('analysis.lastResult', { val: `Error: ${error.message}`, ack: true });
        }
    }

    _formatEventForHistory(event) {
        // ... (Diese Funktion bleibt unverändert) ...
        const time = new Date(event.timestamp).toLocaleTimeString('de-DE'); 
        return `${time} - ${event.name} (${event.location}) -> ${event.value}`;
    }

    async _updateDebugHistoryStates() {
        // ... (Diese Funktion bleibt unverändert) ...
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
}

if (require.main !== module) {
    module.exports = (options) => new CogniLiving(options);
} else {
    new CogniLiving();
}