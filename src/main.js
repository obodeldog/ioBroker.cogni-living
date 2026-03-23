/* eslint-disable */
'use strict';

/*
 * cogni-living Adapter f?r ioBroker
 * Version: 0.30.38 (Fix: Scheduler Init & Robust Calendar Search)
 */

const utils = require('@iobroker/adapter-core');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');

// --- MODULE IMPORTS ---
const installer = require('./lib/installer');
const scanner = require('./lib/scanner');
const schedulers = require('./lib/scheduler');
const topology = require('./lib/topology');
const setup = require('./lib/setup');
const recorder = require('./lib/recorder');
const { isActiveValue, toPersonCount } = recorder;
const pythonBridge = require('./lib/python_bridge');
const aiAgent = require('./lib/ai_agent');
const deadMan = require('./lib/dead_man');
const automation = require('./lib/automation');
const notifications = require('./lib/notifications');
const pwaServer = require('./lib/pwa_server');
const cloudflareTunnel = require('./lib/cloudflare_tunnel');

// --- CONSTANTS ---
const GEMINI_MODEL = 'models/gemini-flash-latest';

class CogniLiving extends utils.Adapter {
    constructor(options) {
        super({ ...options, name: 'cogni-living' });
        this.eventHistory = []; this.analysisHistory = []; this.rawEventLog = []; this.dailyDigests = []; this.sensorLastValues = {};
        this.systemConfig = { latitude: 0, longitude: 0, city: '' }; this.isPresent = true; this.exitTimer = null; this.exitGraceTimer = null; this.isGracePeriodActive = false;
        this.genAI = null; this.geminiModel = null; this.currentSystemMode = setup.SYSTEM_MODES.NORMAL; this.isProVersion = false; this.lastAlertState = false;
        this.analysisTimer = null; this.calendarCheckTimer = null; this.presenceCheckTimer = null; this.ltmJob = null; this.modeResetJob = null; this.driftAnalysisTimer = null; this.briefingJob = null; this.weeklyBriefingJob = null;
        this.historyJob = null;

        this.trackerHeartbeat = null;
        this.healthTrendInterval = null;
        this.roomIntegratorTimer = null;

        this.dependencyInstallInProgress = false;
        this.lastTrackerEventTime = Date.now();

        this.memoryCache = null;
        this.bootTime = Date.now();

        this.infrasoundLocked = false;
        this.pressureBuffer = [];

        // Sensor-Ausfall-Erkennung
        this.sensorLastSeen = {};    // { sensorId: timestamp }
        this.sensorAlertSent = {};   // { sensorId: lastAlertTs } - verhindert Spam
        this.sensorCheckInterval = null;

        // Active Modules
        this.activeModules = { health: true, security: true, energy: true, comfort: true };

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
        this.on('message', this.onMessage.bind(this));
    }

    async onReady() {
        this.log.info(`cogni-living adapter starting (v${this.version}) - Phase E (Scheduler Fix)`);

        if (this.config.moduleHealth !== undefined) this.activeModules.health = this.config.moduleHealth;
        if (this.config.moduleSecurity !== undefined) this.activeModules.security = this.config.moduleSecurity;
        if (this.config.moduleEnergy !== undefined) this.activeModules.energy = this.config.moduleEnergy;
        if (this.config.moduleComfort !== undefined) this.activeModules.comfort = this.config.moduleComfort;
        if (this.config.modules) this.activeModules = { ...this.activeModules, ...this.config.modules };

        this.startSystem();
    }

    async startSystem() {
        await setup.initZombies(this);
        try { this.isProVersion = await setup.checkLicense(this.config.licenseKey); } catch(e) {}
        if (!this.config.inactivityThresholdHours || this.config.inactivityThresholdHours < 0.1) this.config.inactivityThresholdHours = 12;

        await setup.initHistory(this);
        await setup.initSystemConfig(this);
        
        // Update Topology Matrix beim Start
        topology.updateTopology(this);

        try {
            const wt = await this.getStateAsync('analysis.energy.warmupTimes');
            const ws = await this.getStateAsync('analysis.energy.warmupSources');
            if (wt && wt.val && ws && ws.val) {
                if (Date.now() - wt.ts < 4 * 3600 * 1000) {
                    this.memoryCache = { times: JSON.parse(wt.val), sources: JSON.parse(ws.val) };
                }
            }
        } catch(e) {}

        if (this.config.geminiApiKey) {
            try {
                this.genAI = new GoogleGenerativeAI(this.config.geminiApiKey);
                this.geminiModel = this.genAI.getGenerativeModel({ model: GEMINI_MODEL, generationConfig: { responseMimeType: 'application/json' } });
            } catch (error) { this.log.error(`Gemini Init Error: ${error.message}`); }
        }

        await setup.createAllObjects(this);
        await this.loadSystemMode();

        // --- FIX: START SCHEDULERS (This was missing!) ---
        schedulers.initSchedules(this);
        // -------------------------------------------------

        await this.setObjectNotExistsAsync('analysis.visualization.pulse', { type: 'state', common: { name: 'Live Event Pulse', type: 'number', role: 'value', read: true, write: false }, native: {} });
        await this.setObjectNotExistsAsync('analysis.activity.roomStats', { type: 'state', common: { name: 'Room Dwell Time Stats', type: 'string', role: 'json', read: true, write: false, def: '{"today":{}, "yesterday":{}, "date":""}' }, native: {} });
        await this.setObjectNotExistsAsync('analysis.activity.roomHistory', { type: 'state', common: { name: 'Room History (24h Buckets)', type: 'string', role: 'json', read: true, write: false, def: '{"history":{}}' }, native: {} });
        await this.setObjectNotExistsAsync('analysis.health.geminiNight', { type: 'state', common: { name: 'Gemini Report Night', type: 'string', role: 'text', read: true, write: false, def: 'Warte auf Analyse...' }, native: {} });
        await this.setObjectNotExistsAsync('analysis.health.geminiDay', { type: 'state', common: { name: 'Gemini Report Day', type: 'string', role: 'text', read: true, write: false, def: 'Warte auf Analyse...' }, native: {} });

        await this.setObjectNotExistsAsync('analysis.health.todayVector', { type: 'state', common: { name: 'Daily Activity Vector (48x30min)', type: 'string', role: 'json', read: true, write: false, def: '[]' }, native: {} });
        await this.setObjectNotExistsAsync('analysis.health.todayRoomDetails', { type: 'state', common: { name: 'Daily Room Details (48x30min)', type: 'string', role: 'json', read: true, write: false, def: '[]' }, native: {} });

        await this.setObjectNotExistsAsync('analysis.health.activityTrend', { type: 'state', common: { name: 'General Activity Trend', type: 'number', role: 'value', unit: '%', read: true, write: false }, native: {} });
        // Phase 2: Krankheits-Risiko-Scores States anlegen
        await this.setObjectNotExistsAsync('analysis.health.disease.scores', { type: 'state', common: { name: 'Disease Risk Scores (JSON)', type: 'string', role: 'json', read: true, write: false, def: '{}' }, native: {} });
        for (const _dp of ['fallRisk','dementia','frailty','depression','diabetes2','sleepDisorder','cardiovascular','parkinson','copd','socialIsolation','epilepsy','diabetes1','longCovid','bipolar']) {
            await this.setObjectNotExistsAsync('analysis.health.disease.' + _dp, { type: 'state', common: { name: 'Disease Risk: ' + _dp, type: 'number', role: 'value', unit: '%', read: true, write: false, def: 0 }, native: {} });
        }
        // Phase 3: Proaktives Screening State
        await this.setObjectNotExistsAsync('analysis.health.screening.hints', { type: 'state', common: { name: 'Proactive Screening Hints (JSON)', type: 'string', role: 'json', read: true, write: false, def: '{}' }, native: {} });
        await this.setObjectNotExistsAsync('system.sensorStatus', { type: 'state', common: { name: 'Sensor Health Status (JSON)', type: 'string', role: 'json', read: true, write: false, def: '{}' }, native: {} });
        await this.setObjectNotExistsAsync('system.currentPersonCount', { type: 'state', common: { name: 'Aktuelle Personenanzahl im Haus', type: 'number', role: 'value', unit: 'Personen', read: true, write: false, def: 1, desc: 'Geschaetzte Personenanzahl (Config-Baseline + raeumliche Heuristik + FP2)' }, native: {} });
        await this.setObjectNotExistsAsync('system.personCount.heuristicDetection', { type: 'state', common: { name: 'Personenerkennung: Heuristik-Ereignis (SQL) - mind. 2 Personen erkannt', type: 'string', role: 'json', read: true, write: false, def: '{}', desc: 'Wird bei jeder rauemlichen Unmoglichkeitserkennung (>= 2 Hops, <= 5s) geschrieben. Enthaelt: Sensor-IDs, Raeume, Hop-Abstand, Zeitdelta, Personenzahl vorher/nachher.' }, native: {} });
        await this.setObjectNotExistsAsync('system.personCount.sensorActivity', { type: 'state', common: { name: 'Personenerkennung: Sensor-Aktivitaet (SQL) - Bewegung/Praesenz/Tuer-Fenster', type: 'string', role: 'json', read: true, write: false, def: '{}', desc: 'Jede steigende Flanke eines person-relevanten Sensors (isPersonPresenceActivity). Kein Licht, kein Temperatur.' }, native: {} });
        await this.setObjectNotExistsAsync('system.config.sensorList', { type: 'state', common: { name: 'Sensor-Konfiguration (Uebersicht)', type: 'string', role: 'json', read: true, write: false, def: '[]', desc: 'Alle konfigurierten Sensoren aus dem System-Tab: ID, Bezeichnung, Ort, Typ, Funktion. Wird bei jedem Adapterstart aktualisiert.' }, native: {} });
        await this.setObjectNotExistsAsync('system.householdType', { type: 'state', common: { name: 'Haushaltstyp', type: 'string', role: 'text', states: { single: 'Einpersonenhaushalt', multi: 'Mehrpersonenhaushalt' }, read: true, write: false, def: 'single' }, native: {} });
        await this.setObjectNotExistsAsync('system.personData', { type: 'state', common: { name: 'Per-Person Night Metrics (JSON)', type: 'string', role: 'json', read: true, write: false, def: '{}' }, native: {} });
        await this.setObjectNotExistsAsync('analysis.energy.warmupTimes', { type: 'state', common: { name: 'Warm-Up Time', type: 'string', role: 'json', read: true, write: false }, native: {} });

        try {
            const s = await this.getStateAsync('events.history');
            if (s && s.val) {
                this.eventHistory = JSON.parse(s.val);
                if(this.isProVersion) {
                    const r = await this.getStateAsync('LTM.rawEventLog');
                    if(r && r.val) this.rawEventLog = JSON.parse(r.val);
                }
                this.log.info(`?? Restored ${this.eventHistory.length} events from standard storage.`);
            }
        } catch(e){ this.eventHistory = []; }

        try { const s = await this.getStateAsync('LTM.dailyDigests'); if (s && s.val) this.dailyDigests = JSON.parse(s.val); } catch(e){ this.dailyDigests = []; }

        const msg = this.dailyDigests.length >= (this.config.minDaysForBaseline || 7) ? `Aktiv (${this.dailyDigests.length} Tage)` : `Lernphase (${this.dailyDigests.length}/${this.config.minDaysForBaseline || 7})`;
        await this.setStateAsync('LTM.baselineStatus', { val: msg, ack: true });

        this.subscribeStates('analysis.trigger');
        this.subscribeStates('LTM.triggerDailyDigest');
        this.subscribeStates('analysis.training.triggerHealth');
        this.subscribeStates('analysis.triggerBriefing');
        this.subscribeStates('analysis.triggerWeeklyBriefing');

        if (this.config.infrasoundEnabled && this.config.infrasoundSensorId && this.activeModules.security) {
            this.subscribeForeignStates(this.config.infrasoundSensorId);
        }
        const devices = this.config.devices; if (devices) { for (const d of devices) { await this.subscribeForeignStatesAsync(d.id); } }

        // system.config.sensorList: Sensor-Konfiguration bei Start schreiben (Kontroll-Objekt)
        try {
            const _sensorListData = (this.config.devices || []).map(function(d) {
                return {
                    id:              d.id || '',
                    bezeichnung:     d.name || '',
                    ort:             d.location || '',
                    typ:             d.type || '',
                    funktion:        d.sensorFunction || '',
                    isBathroomSensor: !!(d.sensorFunction === 'bathroom' || d.isBathroomSensor),
                    isKitchenSensor:  !!(d.sensorFunction === 'kitchen'  || d.isKitchenSensor),
                    isFP2Bed:         !!(d.sensorFunction === 'bed'      && (d.type||'').toLowerCase() === 'presence_radar_bool'),
                    isVibrationBed:   !!(d.sensorFunction === 'bed'      && ['vibration_trigger','vibration_strength'].includes((d.type||'').toLowerCase())),
                    isBedroomMotion:  !!(d.sensorFunction === 'bed'      && (d.type||'').toLowerCase() === 'motion'),
                };
            });
            await this.setStateAsync('system.config.sensorList', { val: JSON.stringify(_sensorListData, null, 2), ack: true });
        } catch(_e) { this.log.warn('[Config] Fehler beim Schreiben der sensorList: ' + _e.message); }

        const devs = this.config.presenceDevices; if (devs) { for (const id of devs) { await this.subscribeForeignStatesAsync(id); } }

        // Option B: sensorLastValues mit echten aktuellen States initialisieren (Duplikat-Filter nach Neustart)
        // Verhindert dass Sensoren die sich waehrend Adapter-Downtime NICHT veraendert haben als 'neue Aktivitaet' zaehlen.
        // Nur Sensoren ueberschreiben deren State aktuell in ioBroker vorliegt.
        try {
            const _allDevices = (this.config.devices || []);
            for (const _dev of _allDevices) {
                if (!_dev.id) continue;
                try {
                    const _currentState = await this.getForeignStateAsync(_dev.id);
                    if (_currentState && _currentState.val !== undefined && _currentState.val !== null) {
                        this.sensorLastValues[_dev.id] = _currentState.val;
                    }
                } catch (e) { /* Sensor nicht erreichbar, Initialwert aus History bleibt */ }
            }
            this.log.info(`Sensor baseline initialized for ${_allDevices.length} devices (duplicate filter ready).`);
        } catch (e) {
            this.log.warn('Sensor baseline init failed: ' + e.message);
        }

        const schedule = require('node-schedule');
        if (this.historyJob) this.historyJob.cancel();
        this.historyJob = schedule.scheduleJob('59 23 * * *', () => {
            this.saveDailyHistory();
        });

        setTimeout(() => this.replayTodayEvents(), 5000);
        // Startup-Save: heute-Datei nach Replay schreiben damit Charts sofort Balken zeigen
        setTimeout(() => this.saveDailyHistory().catch(e => {}), 90000);

        // householdType-Baseline aus Config setzen (gilt solange kein FP2-Sensor live ueberschreibt)
        var _hsMap = { single: 'single', couple: 'multi', family: 'multi' };
        var _hsCfg = this.config.householdSize || 'single';
        var _hsBaseline = _hsMap[_hsCfg] || 'single';
        var _hsCount = _hsCfg === 'single' ? 1 : _hsCfg === 'couple' ? 2 : 3;
        this.setStateAsync('system.householdType', { val: _hsBaseline, ack: true }).catch(function(){});
        this.setStateAsync('system.currentPersonCount', { val: _hsCount, ack: true }).catch(function(){});
        this.log.info('Haushaltsgroesse (Config-Baseline): ' + _hsCfg + ' -> householdType=' + _hsBaseline + ', count=' + _hsCount);

        // Sensor-LastSeen aus eventHistory initialisieren (auch nach Adapter-Neustart)
        if (this.eventHistory && this.eventHistory.length > 0) {
            this.eventHistory.forEach(function(e) { if (e.id && e.timestamp) { var cur = this.sensorLastSeen[e.id]; if (!cur || e.timestamp > cur) this.sensorLastSeen[e.id] = e.timestamp; } }.bind(this));
        }
        // St?ndlicher Sensor-Ausfall-Check
        if (this.sensorCheckInterval) clearInterval(this.sensorCheckInterval);
        this.sensorCheckInterval = setInterval(() => { this.checkSensorHealth(); }, 60 * 60 * 1000);
        // St?ndlicher History-Save: heute-Datei aktuell halten damit Chart heute-Balken zeigt
        if (this.hourlySaveInterval) clearInterval(this.hourlySaveInterval);
        this.hourlySaveInterval = setInterval(() => { this.saveDailyHistory().catch(e => {}); }, 60 * 60 * 1000);
        setTimeout(() => this.checkSensorHealth(), 5 * 60 * 1000); // auch 5 min nach Start

        if (this.roomIntegratorTimer) clearInterval(this.roomIntegratorTimer);
        this.integrateRoomTime();
        this.roomIntegratorTimer = setInterval(async () => {
            await this.integrateRoomTime();
        }, 60 * 1000);

        if (this.healthTrendInterval) clearInterval(this.healthTrendInterval);
        this.healthTrendInterval = setInterval(() => {
            if (this.isProVersion && this.activeModules.health) {
                this.runPythonHealthCheck();
            }
        }, 4 * 60 * 60 * 1000);

        // Energy Prediction Timer (alle 15 Minuten)
        if (this.analysisTimer) clearInterval(this.analysisTimer);
        if (this.activeModules.energy) {
            this.analysisTimer = setInterval(() => {
                this.triggerEnergyPrediction();
            }, 60 * 60 * 1000); // 1 Stunde // 15 Minuten
            // Initialer Run nach 10 Sekunden
            setTimeout(() => this.triggerEnergyPrediction(), 10000);
        }

        // Calendar Check Timer (alle 2 Minuten) - KRITISCH f?r rechtzeitiges Heizen!
        if (this.calendarCheckTimer) clearInterval(this.calendarCheckTimer);
        if (this.config.useCalendar && this.activeModules.energy) {
            this.calendarCheckTimer = setInterval(() => {
                automation.checkCalendarTriggers(this);
            }, 2 * 60 * 1000); // 2 Minuten
            // Initialer Run nach 15 Sekunden
            setTimeout(() => automation.checkCalendarTriggers(this), 15000);
        }

        // Presence Check Timer (alle 1 Minute) - Aktualisiert "Bewohner Anwesend"
        if (this.presenceCheckTimer) clearInterval(this.presenceCheckTimer);
        if (this.config.presenceDevices && this.config.presenceDevices.length > 0) {
            this.presenceCheckTimer = setInterval(async () => {
                await this.checkWifiPresence();
            }, 60 * 1000); // 1 Minute
            // Initialer Run nach 5 Sekunden
            setTimeout(async () => await this.checkWifiPresence(), 5000);
        }

        const manualPythonPath = path.join(__dirname, '.venv', 'bin', 'python');
        pythonBridge.startService(this, manualPythonPath);

        // --- PWA FAMILY APP ---
        this._startFamilyApp();
    }

    async _startFamilyApp() {
        if (!this.config.pwaEnabled) return;
        
        try {
            await pwaServer.start(this);
            
            if (this.config.cloudflareEnabled) {
                const port = this.config.pwaPort || 8095;
                const tunnelUrl = await cloudflareTunnel.start(this, port);
                if (tunnelUrl) {
                    this.log.info(`[PWA] ?? Cloudflare URL: ${tunnelUrl}/?token=${this.config.familyShareToken || ''}`);
                }
            }
        } catch(e) {
            this.log.error(`[PWA] Startup error: ${e.message}`);
        }
    }

    async checkSensorHealth() {
        var _self = this;
        var now = Date.now();
        var devices = this.config.devices || [];
        // Schwellwerte pro Typ ? T?r/Fenster 7 Tage (wochenlang geschlossen ist normal)
        var thresholds = { motion: 24*3600000, presence_radar: 24*3600000, vibration: 24*3600000,
            door: 7*24*3600000, temperature: 6*3600000, light: 8*3600000, dimmer: 8*3600000, moisture: 8*3600000 };
        var defaultThreshold = 24 * 3600000;
        var ALERT_COOLDOWN = 24 * 3600000; // max. 1 Pushover pro Sensor pro Tag
        // KNX/Loxone/BACnet: kabelgebunden, kein Heartbeat ? Timeout-Check ?berspringen
        var WIRED_PREFIXES = ['knx.', 'loxone.', 'bacnet.', 'modbus.'];
        var alerts = [];
        var statusList = [];
        for (var _di = 0; _di < devices.length; _di++) {
            var d = devices[_di];
            if (!d.id) continue;
            var isWired = WIRED_PREFIXES.some(function(p) { return d.id.toLowerCase().startsWith(p); });
            if (isWired) continue;
            // getForeignStateAsync: ts wird vom Basisadapter (zigbee, homekit etc.) bei jedem Heartbeat aktualisiert
            var lastSeen = _self.sensorLastSeen[d.id] || 0;
            try {
                var fState = await _self.getForeignStateAsync(d.id);
                if (fState && fState.ts && fState.ts > lastSeen) lastSeen = fState.ts;
            } catch(e) {}
            if (!lastSeen) continue;
            var threshold = thresholds[d.type] || defaultThreshold;
            var elapsed = now - lastSeen;
            var sinceH = Math.round(elapsed / 360000) / 10;
            var isOffline = elapsed > threshold;
            statusList.push({ id: d.id, name: d.name || d.id, location: d.location || '', type: d.type || '', lastSeen: lastSeen, sinceH: sinceH, status: isOffline ? 'offline' : 'ok' });
            if (isOffline) {
                var lastAlert = _self.sensorAlertSent[d.id] || 0;
                if ((now - lastAlert) > ALERT_COOLDOWN) {
                    _self.sensorAlertSent[d.id] = now;
                    var hours = Math.round(elapsed / 3600000);
                    alerts.push((d.name || d.id) + ' (' + (d.location || '?') + '): seit ' + hours + 'h inaktiv');
                }
            }
        }
        var offlineCount = statusList.filter(function(s) { return s.status === 'offline'; }).length;
        try {
            await this.setStateAsync('system.sensorStatus', { val: JSON.stringify({ timestamp: now, sensors: statusList, offlineCount: offlineCount }), ack: true });
        } catch(e) {}
        // OC-5: Pushover-Alarme waehrend der Nachtruhe unterdruecken (Sensor schlaeimft normal)         var _nowH = new Date(now).getHours();         var _isSleepTime = _nowH >= 22 || _nowH < 8;         if (_isSleepTime) alerts = []; // Status-LED bleibt rot, aber kein Push-Spam         
        if (alerts.length > 0) {
            var msg = '?? Sensor-Ausfall:\n' + alerts.join('\n');
            this.log.warn('[SENSOR-CHECK] ' + alerts.join(', '));
            try { setup.sendNotification(this, msg, true, false, '?? NUUKANNI: Sensor-Ausfall'); } catch(e) {}
        }
    }

    onUnload(callback) {
        if (this.historyJob) this.historyJob.cancel();
        this.saveDailyHistory().then(async () => {
            if (this.analysisTimer) clearInterval(this.analysisTimer);
            if (this.calendarCheckTimer) clearInterval(this.calendarCheckTimer);
            if (this.presenceCheckTimer) clearInterval(this.presenceCheckTimer);
            if (this.roomIntegratorTimer) clearInterval(this.roomIntegratorTimer);
            if (this.sensorCheckInterval) clearInterval(this.sensorCheckInterval);
            if (this.hourlySaveInterval) clearInterval(this.hourlySaveInterval);
            recorder.abortExitTimer(this);
            pythonBridge.stopService(this);
            
            // PWA und Tunnel beenden
            cloudflareTunnel.stop();
            await pwaServer.stop();
            
            callback();
        });
    }

    async replayTodayEvents() {
        if (!this.eventHistory || this.eventHistory.length === 0) {
            this.log.warn("? Replay skipped: No events in memory.");
            return;
        }

        this.log.info(`? Replaying ${this.eventHistory.length} events from today...`);
        const startOfDay = new Date().setHours(0,0,0,0);

        const histId = 'analysis.activity.roomHistory';
        let histData = { history: {}, date: new Date().toLocaleDateString() };

        const vectorId = 'analysis.health.todayVector';
        const detailsId = 'analysis.health.todayRoomDetails';

        let todayBuckets = new Array(48).fill(0);
        let todayDetails = Array.from({ length: 48 }, () => []);

        // Sensoren die explizit aus der Health-Timeline ausgeschlossen sind (aktuelle Konfiguration)
        const _excludedFromActivity = new Set((this.config.devices || []).filter(d => d.excludeFromActivity).map(d => d.id));

        this.eventHistory.forEach(evt => {
            if (evt.timestamp >= startOfDay) {
                if (evt.excludeFromActivity || _excludedFromActivity.has(evt.id)) return;
                if (recorder.isRelevantActivity(evt.type, evt.value)) {
                    const date = new Date(evt.timestamp);
                    const bucketIndex = (date.getHours() * 2) + (date.getMinutes() >= 30 ? 1 : 0);

                    if (bucketIndex < 48) {
                        todayBuckets[bucketIndex]++;

                        const roomName = evt.location || evt.name || '?';
                        let currentRooms = todayDetails[bucketIndex];
                        if (!currentRooms.includes(roomName)) {
                            currentRooms.push(roomName);
                        }
                    }

                    const hour = date.getHours();
                    let room = evt.location || 'Unknown';
                    const dev = (this.config.devices||[]).find(d => d.location === room);
                    if(dev) room = dev.location;

                    if (!histData.history[room]) histData.history[room] = new Array(24).fill(0);
                    if (histData.history[room][hour] < 60) histData.history[room][hour]++;
                }
            }
        });

        const currentState = await this.getStateAsync(histId);
        if (!currentState || !currentState.val || currentState.val === '{}' || currentState.val.includes('"history":{}')) {
            await this.setStateAsync(histId, { val: JSON.stringify(histData), ack: true });
        }

        await this.setStateAsync(vectorId, { val: JSON.stringify(todayBuckets), ack: true });
        await this.setStateAsync(detailsId, { val: JSON.stringify(todayDetails), ack: true });

        this.log.info("? Dashboard Data (Rooms & Timeline & Details) restored.");
    }

    async saveDailyHistory() {
        // Sequenzen f?r Gait-Speed-Berechnung vorladen
        try {
            const _sq = await this.getStateAsync('LTM.trainingData.sequences');
            this._lastSeqState = (_sq && _sq.val) ? _sq.val : null;
        } catch(e) { this._lastSeqState = null; }
        if (!this.activeModules.health) return;
        const _now = new Date();
        const dateStr = _now.getFullYear() + '-' + String(_now.getMonth()+1).padStart(2,'0') + '-' + String(_now.getDate()).padStart(2,'0'); // LOKAL, nicht UTC!
        this.log.debug(`?? Saving Daily History for ${dateStr}...`);

        try {
            const [
                roomHistory, geminiNight, geminiDay, anomalyScore, todayVector, activityTrend
            ] = await Promise.all([
                this.getStateAsync('analysis.activity.roomHistory'),
                this.getStateAsync('analysis.health.geminiNight'),
                this.getStateAsync('analysis.health.geminiDay'),
                this.getStateAsync('analysis.security.lastScore'),
                this.getStateAsync('analysis.health.todayVector'),
                this.getStateAsync('analysis.health.activityTrend')
            ]);

            const startOfDayTimestamp = new Date().setHours(0,0,0,0);
            // Fenster/T?r-?ffnungen: alle Sensoren mit fenster/haust?r/terrasse/balkon/window im Namen
            // Frischluft: Verwende Sensor-Typ "door" aus dem Typ-System (Sensorliste: T?r/Fenster)
            // Identisch zum Architektur-Prinzip: e.type === "door" statt Keyword-Matching
            const freshAirCount = this.eventHistory.filter(e => {
                const ts = e.timestamp || e.ts || 0;
                if (ts < startOfDayTimestamp) return false;
                const isDoorSensor = e.type === 'door';
                const isOpen = e.value === true || e.value === 1 || e.value === 'true' || e.value === 'open';
                return isDoorSensor && isOpen;
            }).length;
            // 5-Min-Sto?l?ftungen: OPEN/CLOSE-Paare >= 5 Min
            const FRESH_AIR_MIN_MS = 5 * 60 * 1000;
            const doorEventsToday = this.eventHistory
                .filter(e => { const ts = e.timestamp || e.ts || 0; return ts >= startOfDayTimestamp && e.type === 'door'; })
                .sort((a, b) => (a.timestamp || a.ts || 0) - (b.timestamp || b.ts || 0));
            const openMap = {};
            let freshAirLongCount = 0;
            for (const e of doorEventsToday) {
                const ts = e.timestamp || e.ts || 0;
                const isOpen = e.value === true || e.value === 1 || e.value === 'true' || e.value === 'open';
                if (isOpen) { openMap[e.id] = ts; }
                else { if (openMap[e.id] && (ts - openMap[e.id] >= FRESH_AIR_MIN_MS)) freshAirLongCount++; delete openMap[e.id]; }
            }
            for (const openTs of Object.values(openMap)) { if ((Date.now() - openTs) >= FRESH_AIR_MIN_MS) freshAirLongCount++; }

            let battery = 85;
            if (activityTrend && activityTrend.val !== undefined) battery = Math.min(100, Math.max(20, Math.round(80 + (Number(activityTrend.val) * 5))));

            // WICHTIG: Nur Events von HEUTE speichern, nicht alle Events!
            const todayEvents = this.eventHistory.filter(e => e.timestamp >= startOfDayTimestamp);

            // Sleep-Freeze: Snapshot lesen und prüfen ob Nacht bereits eingefroren (echte Nacht gesichert)
            const _dataDir0 = utils.getAbsoluteDefaultDataDir();
            const _filePath0 = path.join(_dataDir0, 'cogni-living', 'history', dateStr + '.json');
            let _existingSnap = null;
            try { if (fs.existsSync(_filePath0)) _existingSnap = JSON.parse(fs.readFileSync(_filePath0, 'utf8')); } catch(_fe) {}
            // Eingefroren wenn: Aufwachzeit vorhanden + vor 14:00 Uhr (= echte Nacht) + mind. 3h Bettzeit
            const _sleepFrozen = !!(_existingSnap &&
                _existingSnap.sleepWindowStart &&
                _existingSnap.sleepWindowEnd &&
                (_existingSnap.bedPresenceMinutes || 0) >= 180 &&
                new Date(_existingSnap.sleepWindowEnd).getHours() < 14);

            // Schlaf-relevante Events: ab 18:00 Uhr des Vortages (Nacht spannt 2 Kalendertage!).
            // Bsp: Einschlafen 23:00 Uhr = gestriger Tag => fehlt in todayEvents.
            // sleepSearchEvents deckt 18:00 gestern bis jetzt, damit sleepWindowCalc den
            // echten Einschlafzeitpunkt findet und OC-7-Vibrationsdaten vollstaendig sind.
            const _sleepSearchBase = new Date();
            _sleepSearchBase.setHours(18, 0, 0, 0);
            if (new Date().getHours() < 18) { _sleepSearchBase.setDate(_sleepSearchBase.getDate() - 1); }
            const sleepSearchEvents = this.eventHistory.filter(e => (e.timestamp||0) >= _sleepSearchBase.getTime());

            // Raum-Verweildauer heute aus roomHistory berechnen (Minuten pro Raum)
            const roomHistoryData = roomHistory?.val ? JSON.parse(roomHistory.val) : {};
            const todayRoomMinutes = {};
            if (roomHistoryData.history) {
                for (const [room, hourlyArr] of Object.entries(roomHistoryData.history)) {
                    if (Array.isArray(hourlyArr)) {
                        todayRoomMinutes[room] = hourlyArr.reduce((a, b) => a + (b || 0), 0);
                    }
                }
            }
            // roomStats-State aktuell halten (gleiche Datenquelle f?r Admin + PWA)
            try {
                let existingStats = { today: {}, yesterday: {}, date: '' };
                const rsState = await this.getStateAsync('analysis.activity.roomStats');
                if (rsState && rsState.val) existingStats = JSON.parse(rsState.val);
                existingStats.today = todayRoomMinutes;
                existingStats.date = dateStr;
                await this.setStateAsync('analysis.activity.roomStats', { val: JSON.stringify(existingStats), ack: true });
            } catch(e) {}

            // R?umliche Heuristik: max. Personen die heute gleichzeitig erkannt wurden
            var _cfgSize = this.config.householdSize || 'single';
            var _cfgBaseline = _cfgSize === 'single' ? 1 : _cfgSize === 'couple' ? 2 : 3;
            const maxPersonsDetected = this._maxPersonsToday || _cfgBaseline;
            // FP2 Bett-Praesenz: Minuten die Bett-Zone heute belegt war (inkl. Vorabend ab 18:00)
            const bedPresenceMinutes = (function() {
                var presStart = null; var total = 0;
                var bedEvts = sleepSearchEvents.filter(function(e) { return e.isFP2Bed; })
                    .sort(function(a,b) { return (a.timestamp||0)-(b.timestamp||0); });
                bedEvts.forEach(function(e) {
                    var v = isActiveValue(e.value) || toPersonCount(e.value) > 0;
                    if (v && !presStart) { presStart = e.timestamp||0; }
                    else if (!v && presStart) { total += ((e.timestamp||0) - presStart) / 60000; presStart = null; }
                });
                if (presStart) total += (Date.now() - presStart) / 60000;
                return Math.round(total);
            })();

            // Schlaf-Fenster aus FP2-Bett-Events berechnen (dynamisch).
            // Dieses Fenster treibt die SCHLAFZEIT-Kachel (Einschlaf-/Aufwachzeit).
            // Ohne FP2-Bett: start=null -> Schlafzeit-Karte zeigt 'keine Daten' (gewuenscht).
            const sleepWindowCalc = (function() {
                var bedEvts = sleepSearchEvents.filter(function(e) { return e.isFP2Bed; })
                    .sort(function(a,b) { return (a.timestamp||0)-(b.timestamp||0); });
                if (bedEvts.length === 0) return { start: null, end: null };
                // Schlafbeginn: letztes Mal dass Bett >= 10 Min belegt wurde zwischen 18:00-02:00
                var sleepStartTs = null;
                var presStart = null;
                for (var _si = 0; _si < bedEvts.length; _si++) {
                    var _se = bedEvts[_si];
                    var _sv = isActiveValue(_se.value) || toPersonCount(_se.value) > 0;
                    var _shr = new Date(_se.timestamp||0).getHours();
                    if (_sv && !presStart && (_shr >= 18 || _shr < 3)) { presStart = _se.timestamp||0; }
                    else if (!_sv && presStart) {
                        var _dur = ((_se.timestamp||0) - presStart) / 60000;
                        if (_dur >= 10) sleepStartTs = presStart;
                        presStart = null;
                    }
                }
                if (presStart) { var _dur2 = (Date.now() - presStart) / 60000; if (_dur2 >= 10) sleepStartTs = presStart; }
                if (!sleepStartTs) return { start: null, end: null };
                // Aufwachzeit: erstes Mal nach Schlafbeginn dass Bett >= 15 Min leer war nach 04:00
                var wakeTs = null;
                var emptyStart = null;
                for (var _wi = 0; _wi < bedEvts.length; _wi++) {
                    var _we = bedEvts[_wi];
                    if ((_we.timestamp||0) < sleepStartTs) continue;
                    var _wv = isActiveValue(_we.value) || toPersonCount(_we.value) > 0;
                    var _whr = new Date(_we.timestamp||0).getHours();
                    if (!_wv && (_whr >= 4 && _whr <= 14)) {
                        if (!emptyStart) emptyStart = _we.timestamp||0;
                    } else if (_wv && emptyStart) {
                        var _wdur = ((_we.timestamp||0) - emptyStart) / 60000;
                        if (_wdur >= 15) { wakeTs = emptyStart + _wdur * 60000; emptyStart = null; break; }
                        emptyStart = null;
                    }
                }
                if (emptyStart) { var _wdur2 = (Date.now() - emptyStart) / 60000; if (_wdur2 >= 15) wakeTs = Date.now(); }
                return { start: sleepStartTs, end: wakeTs };
            })();

            // OC-4 Guard: Schlaffenster nur speichern wenn genuegend FP2-Bettzeit-Daten vorhanden.
            // (Brainstorming OC-4: verhindert falsche Einschlafzeit nach Adapter-Neustart)
            if (bedPresenceMinutes < 180 && sleepWindowCalc.start !== null) {
                sleepWindowCalc.start = null;
                sleepWindowCalc.end = null;
                this.log.debug('[History] OC-4 Guard: bedPresenceMinutes=' + bedPresenceMinutes + 'min < 180, FP2-sleepWindow verworfen');
            }
            // Ursprüngliche FP2-Fenstererkennung merken (vor Freeze-Überschreibung) für sleepWindowSource
            var _origFP2Window = sleepWindowCalc.start !== null;

            // Schlaffenster aus Schlafzimmer-Bewegungsmelder (Fallback wenn kein FP2-Bett-Sensor).
            // Sensor-Konfiguration: type=motion + sensorFunction=bed → isBedroomMotion=true.
            // Präzision: Einschlafzeit ≈ letzte Bewegung vor ≥45 Min Stille (18–03 Uhr).
            //            Aufwachzeit ≈ erste Bewegung nach 04 Uhr + mind. 3h nach Einschlafzeit.
            // Besser als Fixfenster, aber schlechter als FP2 (keine Tief-/Ruhephasen-Erkennung).
            const sleepWindowMotion = (function() {
                var motEvts = sleepSearchEvents
                    .filter(function(e) { return e.isBedroomMotion && isActiveValue(e.value); })
                    .sort(function(a,b) { return (a.timestamp||0)-(b.timestamp||0); });
                if (motEvts.length === 0) return { start: null, end: null };
                // Einschlafzeit: letztes Motion-Event das von ≥45 Min Stille gefolgt wird, zwischen 18:00–03:00
                var sleepStartTs = null;
                for (var _msi = 0; _msi < motEvts.length; _msi++) {
                    var _mse = motEvts[_msi];
                    var _mhr = new Date(_mse.timestamp||0).getHours();
                    if (!(_mhr >= 18 || _mhr < 3)) continue;
                    var _nextMotTs = (_msi < motEvts.length - 1) ? (motEvts[_msi+1].timestamp||0) : Date.now();
                    var _motGap = (_nextMotTs - (_mse.timestamp||0)) / 60000;
                    if (_motGap >= 45) sleepStartTs = _mse.timestamp||0;  // letztes solches Event gewinnt
                }
                if (!sleepStartTs) return { start: null, end: null };
                // Aufwachzeit: erste Bewegung nach 04:00 die mindestens 3h nach Einschlafzeit liegt
                var wakeTs = null;
                for (var _mwi = 0; _mwi < motEvts.length; _mwi++) {
                    var _mwe = motEvts[_mwi];
                    if ((_mwe.timestamp||0) <= sleepStartTs) continue;
                    var _mwhr = new Date(_mwe.timestamp||0).getHours();
                    var _sinceStart = ((_mwe.timestamp||0) - sleepStartTs) / 3600000;
                    if ((_mwhr >= 4 && _mwhr <= 14) && _sinceStart >= 3) { wakeTs = _mwe.timestamp||0; break; }
                }
                return { start: sleepStartTs, end: wakeTs };
            })();

            // --- Einschlafzeit-Verfeinerung: Garmin + Vibration -------------------------
            // Ziel: Unterscheidung "ins Bett gehen" (FP2) vs. "einschlafen" (Vib/Garmin)
            // Stufe 0: Garmin sleepStartTimestampGMT — nur wenn 18–04 Uhr UND innerhalb FP2+3h
            // Stufe 1: Vibrations-Verfeinerung — letztes Vib-Event + ≥20min Stille (FP2-Fenster)
            // Stufe 2: FP2 allein — Zeit ins Bett gehen
            // Stufe 3: Bewegungsmelder
            // Stufe 4: Fixfenster
            var _fp2RawStart = sleepWindowCalc.start || null; // FP2-Start vor Überschreibung merken
            var garminSleepStartTs = null;
            var vibRefinedSleepStartTs = null;

            // Garmin Einschlafzeit lesen
            var _garminSleepStartId = (this.config.garminSleepStartStateId || '').trim()
                || 'garmin.0.dailysleep.dailySleepDTO.sleepStartTimestampGMT';
            try {
                var _gSState = await this.getForeignStateAsync(_garminSleepStartId);
                if (_gSState && _gSState.val != null) {
                    var _gSVal = Number(_gSState.val);
                    if (!isNaN(_gSVal) && _gSVal > 0) {
                        var _gSHr = new Date(_gSVal).getHours();
                        var _gSPlausibel = (_gSHr >= 18 || _gSHr < 4);
                        // Zusatzprüfung: Garmin-Start muss nach FP2-Start und < FP2+3h liegen
                        var _gSInFP2Window = !_fp2RawStart || (_gSVal >= _fp2RawStart && _gSVal <= _fp2RawStart + 3 * 3600000);
                        if (_gSPlausibel && _gSInFP2Window) {
                            garminSleepStartTs = _gSVal;
                            this.log.debug('[SleepStart] Garmin plausibel: ' + new Date(garminSleepStartTs).toISOString());
                        } else {
                            this.log.debug('[SleepStart] Garmin ausserhalb Plausibilitaetsfenster: ' + new Date(_gSVal).toISOString());
                        }
                    }
                }
            } catch(_gse) { this.log.debug('[SleepStart] Garmin nicht lesbar: ' + _gse.message); }

            // Vibrations-Verfeinerung: letztes Vib-Event mit ≥20min Stille danach (innerhalb FP2+3h)
            if (_fp2RawStart) {
                var _vibRefMax = _fp2RawStart + 3 * 3600000;
                var _vibRefEvts = sleepSearchEvents.filter(function(e) {
                    return e.isVibrationBed && (isActiveValue(e.value) || toPersonCount(e.value) > 0)
                        && (e.timestamp||0) >= _fp2RawStart && (e.timestamp||0) <= _vibRefMax;
                }).sort(function(a, b) { return (a.timestamp||0) - (b.timestamp||0); });
                if (_vibRefEvts.length >= 2) {
                    for (var _vsi = _vibRefEvts.length - 1; _vsi >= 0; _vsi--) {
                        var _vsEvt = _vibRefEvts[_vsi];
                        var _vsNext = (_vsi < _vibRefEvts.length - 1) ? (_vibRefEvts[_vsi + 1].timestamp||0) : Date.now();
                        var _vsGap = (_vsNext - (_vsEvt.timestamp||0)) / 60000;
                        if (_vsGap >= 20) {
                            vibRefinedSleepStartTs = _vsEvt.timestamp||0;
                            this.log.debug('[SleepStart] Vib-Verfeinerung: ' + new Date(vibRefinedSleepStartTs).toISOString());
                            break;
                        }
                    }
                }
            }

            // allSleepStartSources + sleepStartSource bestimmen
            var _fixedSleepStartTs = _sleepSearchBase.getTime() + 2 * 3600000; // 20:00 Uhr
            var allSleepStartSources = [
                { source: 'garmin',  ts: garminSleepStartTs },
                { source: 'fp2_vib', ts: vibRefinedSleepStartTs },
                { source: 'fp2',     ts: _fp2RawStart },
                { source: 'motion',  ts: sleepWindowMotion.start || null },
                { source: 'fixed',   ts: _fixedSleepStartTs }
            ];
            var sleepStartSource = _fp2RawStart ? 'fp2'
                : (sleepWindowMotion.start ? 'motion' : 'fixed');

            // Prioritätskette anwenden (nur wenn nicht frozen)
            if (!_sleepFrozen) {
                if (garminSleepStartTs) {
                    sleepWindowCalc.start = garminSleepStartTs;
                    sleepStartSource = 'garmin';
                    this.log.info('[SleepStart] Garmin: ' + new Date(garminSleepStartTs).toISOString());
                } else if (vibRefinedSleepStartTs) {
                    sleepWindowCalc.start = vibRefinedSleepStartTs;
                    sleepStartSource = 'fp2_vib';
                    this.log.info('[SleepStart] Vib-Verfeinerung: ' + new Date(vibRefinedSleepStartTs).toISOString());
                }
            } else {
                // Frozen: bestehende Quellen-Daten übernehmen, Garmin-Override trotzdem erlauben
                sleepStartSource = _existingSnap.sleepStartSource || sleepStartSource;
                if (_existingSnap.allSleepStartSources) allSleepStartSources = _existingSnap.allSleepStartSources;
                if (garminSleepStartTs) {
                    sleepWindowCalc.start = garminSleepStartTs;
                    sleepStartSource = 'garmin';
                    this.log.info('[SleepStart] Garmin-Override auf Frozen: ' + new Date(garminSleepStartTs).toISOString());
                }
            }

            // Schlaffenster fuer OC-7 (Sleep Score): FP2 → Bewegungsmelder → Fixfenster (Fallback-Kette).
            // Betrifft NICHT sleepWindowStart/End im Snapshot -- die Schlafzeit-Kachel bleibt FP2-only.
            var sleepWindowOC7 = sleepWindowCalc.start
                ? sleepWindowCalc
                : sleepWindowMotion.start
                    ? sleepWindowMotion
                    : (function() {
                        var _fs = _sleepSearchBase.getTime() + 2 * 3600000; // 20:00 Uhr
                        var _fe = _fs + 13 * 3600000;                       // 09:00 naechster Morgen
                        if (_fs > Date.now()) return { start: null, end: null };
                        if (_fe > Date.now()) _fe = Date.now();
                        return { start: _fs, end: _fe };
                    })();

            // --- OC-7: AURA SLEEP SCORE ---------------------------------------------------
            // Klassifikation in 5-Minuten-Slots anhand Vibrationssensor (Detection + Staerke)
            // Stages: 'deep' | 'light' | 'rem' | 'wake'
            var sleepScore = null;
            var sleepScoreRaw = null;
            var sleepStages = [];
            if (_sleepFrozen) {
                // Eingeschlafene Nacht: Schlafdaten aus bestehendem Snapshot übernehmen (nicht überschreiben)
                sleepWindowCalc.start = _existingSnap.sleepWindowStart;
                sleepWindowCalc.end   = _existingSnap.sleepWindowEnd;
                sleepWindowOC7 = { start: _existingSnap.sleepWindowStart, end: _existingSnap.sleepWindowEnd };
                sleepStages    = _existingSnap.sleepStages    || [];
                sleepScore     = _existingSnap.sleepScore     !== undefined ? _existingSnap.sleepScore     : null;
                sleepScoreRaw  = _existingSnap.sleepScoreRaw  !== undefined ? _existingSnap.sleepScoreRaw  : null;
                this.log.info('[History] Sleep FROZEN: ' + new Date(_existingSnap.sleepWindowStart).toLocaleTimeString() + '-' + new Date(_existingSnap.sleepWindowEnd).toLocaleTimeString() + ' bedPresMin=' + _existingSnap.bedPresenceMinutes);
            } else if (sleepWindowOC7.start && sleepWindowOC7.end) {
                var SLOT_MS = 5 * 60 * 1000;
                var swStart = sleepWindowOC7.start;
                var swEnd   = sleepWindowOC7.end;
                var slotCount = Math.ceil((swEnd - swStart) / SLOT_MS);
                // Vibrations-Events im Schlaffenster (sleepSearchEvents: deckt auch Vorabend ab 18:00)
                var vibDetInWindow = sleepSearchEvents.filter(function(e) {
                    return e.isVibrationBed && (e.timestamp||0) >= swStart && (e.timestamp||0) <= swEnd
                        && (isActiveValue(e.value) || toPersonCount(e.value) > 0);
                });
                var vibStrInWindow = sleepSearchEvents.filter(function(e) {
                    return e.isVibrationStrength && (e.timestamp||0) >= swStart && (e.timestamp||0) <= swEnd;
                });

                var deepSec = 0, lightSec = 0, remSec = 0, wakeSec = 0;
                var consecutiveQuiet = 0; // Zaehle ruhige Slots in Folge

                for (var _sl = 0; _sl < slotCount; _sl++) {
                    var slotS = swStart + _sl * SLOT_MS;
                    var slotE = slotS + SLOT_MS;

                    // Events in diesem Slot
                    var slotDet = vibDetInWindow.filter(function(e) { return (e.timestamp||0) >= slotS && (e.timestamp||0) < slotE; }).length;
                    var slotStrArr = vibStrInWindow.filter(function(e) { return (e.timestamp||0) >= slotS && (e.timestamp||0) < slotE; })
                        .map(function(e) { return typeof e.value === 'number' ? e.value : parseFloat(e.value) || 0; });
                    var slotStrMax = slotStrArr.length > 0 ? Math.max.apply(null, slotStrArr) : 0;
                    var hoursIn = (slotS - swStart) / 3600000; // Stunden seit Einschlafen

                    var stage;
                    if (slotDet === 0) {
                        consecutiveQuiet++;
                        // >= 6 ruhige Slots in Folge (30 Min) ? Tiefschlaf
                        stage = consecutiveQuiet >= 6 ? 'deep' : (consecutiveQuiet >= 2 ? 'deep' : 'light');
                    } else if (slotDet >= 5 || slotStrMax > 28) {
                        consecutiveQuiet = 0;
                        stage = 'wake';
                    } else if (slotDet >= 2 && hoursIn >= 2.5 && slotStrMax >= 12 && slotStrMax <= 28) {
                        consecutiveQuiet = 0;
                        stage = 'rem'; // REM: maessige Bewegung + mittlere Staerke nach 2.5h Schlaf
                    } else {
                        consecutiveQuiet = 0;
                        stage = 'light';
                    }

                    sleepStages.push({ t: _sl * 5, s: stage }); // t = Minuten seit Einschlafen
                    if (stage === 'deep')  deepSec  += 300;
                    else if (stage === 'light') lightSec += 300;
                    else if (stage === 'rem')   remSec   += 300;
                    else                         wakeSec  += 300;
                }

                // Score berechnen (0-100)
                var totalSecSleep = deepSec + lightSec + remSec + wakeSec;
                if (totalSecSleep > 0) {
                    var dp = deepSec / totalSecSleep;
                    var rp = remSec  / totalSecSleep;
                    var lp = lightSec / totalSecSleep;
                    var wp = wakeSec  / totalSecSleep;
                    var rawScore = dp * 200 + rp * 150 + lp * 80 - wp * 250;
                    // Bonus: Schlafdauer 7-9h (vor Kappung, damit Rohwert den Bonus enthält)
                    var durH = (swEnd - swStart) / 3600000;
                    if (durH >= 7 && durH <= 9) rawScore += 5;
                    sleepScoreRaw = Math.round(Math.max(0, rawScore));  // ungekappter Rohwert (für Wochenansicht)
                    sleepScore    = Math.round(Math.max(0, Math.min(100, rawScore)));
                    this.log.debug('[SleepScore] Score=' + sleepScore + ' deep=' + Math.round(dp*100) + '% rem=' + Math.round(rp*100) + '% light=' + Math.round(lp*100) + '% wake=' + Math.round(wp*100) + '%');
                }
            }

            // Schlaf-Fenster-Quelle (fuer OC-7 Sensor-Indikator im Frontend)
            // Reihenfolge: fp2 → motion (Bewegungsmelder) → fixed (Fixfenster)
            var _motionAvail = sleepWindowMotion.start !== null;
            var sleepWindowSource = _sleepFrozen
                ? (_existingSnap.sleepWindowSource || (_origFP2Window ? 'fp2' : (_motionAvail ? 'motion' : 'fixed')))
                : (_origFP2Window ? 'fp2' : (_motionAvail ? 'motion' : 'fixed'));

            // Außerhalb-Bett-Ereignisse waehrend Schlaffenster (fuer OC-7 Balken-Overlay)
            var outsideBedEvents = [];
            if (_sleepFrozen && _existingSnap) {
                outsideBedEvents = _existingSnap.outsideBedEvents || [];
            } else if (sleepWindowOC7.start && sleepWindowOC7.end) {
                var _fp2Sorted = sleepSearchEvents.filter(function(e) { return e.isFP2Bed; })
                    .sort(function(a,b) { return (a.timestamp||0)-(b.timestamp||0); });
                var _bathEvts = sleepSearchEvents.filter(function(e) {
                    return e.isBathroomSensor && (e.timestamp||0) >= sleepWindowOC7.start && (e.timestamp||0) <= sleepWindowOC7.end;
                });
                var _bedWasEmpty = false; var _emptyTs = null;
                _fp2Sorted.forEach(function(_fe) {
                    var _ts = _fe.timestamp || 0;
                    if (_ts < sleepWindowOC7.start || _ts > sleepWindowOC7.end) return;
                    var _active = isActiveValue(_fe.value) || toPersonCount(_fe.value) > 0;
                    if (!_active && !_bedWasEmpty) { _bedWasEmpty = true; _emptyTs = _ts; }
                    else if (_active && _bedWasEmpty && _emptyTs) {
                        _bedWasEmpty = false;
                        var _dur = Math.round((_ts - _emptyTs) / 60000);
                        if (_dur >= 1) {
                            var _hasBath = _bathEvts.some(function(b) { return (b.timestamp||0) >= _emptyTs && (b.timestamp||0) <= _ts; });
                            outsideBedEvents.push({ start: _emptyTs, end: _ts, duration: _dur, type: _hasBath ? 'bathroom' : 'outside' });
                        }
                        _emptyTs = null;
                    }
                });
                if (_bedWasEmpty && _emptyTs) {
                    var _lastDur = Math.round((sleepWindowOC7.end - _emptyTs) / 60000);
                    if (_lastDur >= 1) {
                        var _lHasBath = _bathEvts.some(function(b) { return (b.timestamp||0) >= _emptyTs; });
                        outsideBedEvents.push({ start: _emptyTs, end: sleepWindowOC7.end, duration: _lastDur, type: _lHasBath ? 'bathroom' : 'outside' });
                    }
                }
            }

            // --- Garmin Wake-Override + Aufwachzeit-Quellen --------------------------------
            // Prioritätskette (absteigend): Garmin → FP2+Vib → FP2 → Motion → Fixed
            // Garmin sleepEndTimestampGMT überstimmt alle anderen Quellen wenn plausibel (03-14 Uhr)
            var garminWakeTs = null;
            var fp2WakeTs    = sleepWindowOC7.end || null;  // aktueller Wert = FP2/motion/fixed
            var _garminWakeId = (this.config.garminSleepEndStateId || '').trim()
                || 'garmin.0.dailysleep.dailySleepDTO.sleepEndTimestampGMT';
            try {
                var _gwState = await this.getForeignStateAsync(_garminWakeId);
                if (_gwState && _gwState.val != null) {
                    var _gwVal = Number(_gwState.val);
                    if (!isNaN(_gwVal) && _gwVal > 0) {
                        var _gwHr = new Date(_gwVal).getHours();
                        if (_gwHr >= 3 && _gwHr < 14) {
                            garminWakeTs = _gwVal;
                            this.log.debug('[Wake] Garmin plausibel: ' + new Date(garminWakeTs).toISOString());
                        } else {
                            this.log.debug('[Wake] Garmin ausserhalb 03-14h: ' + new Date(_gwVal).toISOString());
                        }
                    }
                }
            } catch(_gwe) { this.log.debug('[Wake] Garmin-End nicht lesbar: ' + _gwe.message); }

            // Vibrationssensor-Bestätigung: Letztes Vib-Event vor FP2-Leer-Signal (±30min)
            // Erhöht Konfidenz, ändert aber nicht den Timestamp
            var vibWakeConfirm = false;
            if (fp2WakeTs && sleepWindowOC7.start) {
                var _vibWakeSearch = sleepSearchEvents.filter(function(e) {
                    return e.isVibrationBed && (isActiveValue(e.value) || toPersonCount(e.value) > 0)
                        && (e.timestamp||0) >= fp2WakeTs - 30*60*1000
                        && (e.timestamp||0) <= fp2WakeTs + 5*60*1000;
                });
                if (_vibWakeSearch.length > 0) vibWakeConfirm = true;
            }

            // allWakeSources: alle Kandidaten mit Timestamps (null wenn nicht verfügbar)
            var allWakeSources = [
                { source: 'garmin',          ts: garminWakeTs },
                { source: 'fp2',             ts: fp2WakeTs },
                { source: 'fp2_other',       ts: null },
                { source: 'other',           ts: null },
                { source: 'motion',          ts: (sleepWindowSource === 'motion') ? fp2WakeTs : null },
                { source: 'vibration_alone', ts: null },
                { source: 'vibration',       ts: vibWakeConfirm ? fp2WakeTs : null },
                { source: 'fixed',           ts: (sleepWindowSource === 'fixed') ? fp2WakeTs : null }
            ];

            // wakeSource + wakeConf bestimmen
            var wakeSource, wakeConf;
            if (garminWakeTs) {
                sleepWindowOC7.end = garminWakeTs;
                wakeSource = 'garmin';
                wakeConf   = 'maximal';
                this.log.info('[Wake] Garmin-Override: ' + new Date(garminWakeTs).toISOString());
            } else if (sleepWindowSource === 'fp2' && vibWakeConfirm) {
                wakeSource = 'fp2';
                wakeConf   = 'sehr_hoch';
            } else if (sleepWindowSource === 'fp2') {
                wakeSource = 'fp2';
                wakeConf   = 'hoch';
            } else if (sleepWindowSource === 'motion') {
                wakeSource = 'motion';
                wakeConf   = 'mittel';
            } else {
                wakeSource = 'fixed';
                wakeConf   = 'niedrig';
            }

            // --- Garmin-Validierung (optional) --------------------------------------------
            // Liest den Garmin-Sleep-Score wenn konfiguriert ? graceful fallback
            var garminScore = null;
            var garminDeepSec = null, garminLightSec = null, garminRemSec = null;
            var garminStateId = (this.config.garminSleepScoreStateId || '').trim()
                || 'garmin.0.dailysleep.dailySleepDTO.sleepScores.overall.value';
            try {
                var gScoreState = await this.getForeignStateAsync(garminStateId);
                if (gScoreState && gScoreState.val != null) {
                    garminScore = Number(gScoreState.val) || null;
                    this.log.debug('[Garmin] Sleep Score gelesen: ' + garminScore);
                }
            } catch(e) { /* Garmin-Adapter nicht vorhanden */ }

            // Optional: Schlafdauer-Felder von Garmin lesen
            var garminDeepId  = (this.config.garminDeepSleepStateId  || '').trim() || 'garmin.0.dailysleep.dailySleepDTO.deepSleepSeconds';
            var garminLightId = (this.config.garminLightSleepStateId || '').trim() || 'garmin.0.dailysleep.dailySleepDTO.lightSleepSeconds';
            var garminRemId   = (this.config.garminRemSleepStateId   || '').trim() || 'garmin.0.dailysleep.dailySleepDTO.remSleepSeconds';
            try {
                var gd = await this.getForeignStateAsync(garminDeepId);
                var gl = await this.getForeignStateAsync(garminLightId);
                var gr = await this.getForeignStateAsync(garminRemId);
                if (gd && gd.val != null) garminDeepSec  = Number(gd.val) || null;
                if (gl && gl.val != null) garminLightSec = Number(gl.val) || null;
                if (gr && gr.val != null) garminRemSec   = Number(gr.val) || null;
            } catch(e) {}

            // Sleep Validation State speichern (fuer SQL-Logging)
            if (sleepScore !== null || garminScore !== null) {
                var validationObj = {
                    date: dateStr,
                    auraScore: sleepScore,
                    garminScore: garminScore,
                    delta: (sleepScore !== null && garminScore !== null) ? garminScore - sleepScore : null,
                    garminDeepMin:  garminDeepSec  ? Math.round(garminDeepSec  / 60) : null,
                    garminLightMin: garminLightSec ? Math.round(garminLightSec / 60) : null,
                    garminRemMin:   garminRemSec   ? Math.round(garminRemSec   / 60) : null,
                    timestamp: Date.now()
                };
                try {
                    await this.setObjectNotExistsAsync('analysis.health.sleepValidation', {
                        type: 'state', common: { name: 'Sleep Score Validation (AURA vs Garmin)', type: 'string', role: 'json', read: true, write: false, def: '{}' }, native: {}
                    });
                    await this.setStateAsync('analysis.health.sleepValidation', { val: JSON.stringify(validationObj), ack: true });
                } catch(e) {}
            }

            // --- OC-7 DIAGNOSE-STATE (hilft beim Debuggen ob Sleep-Analyse läuft) ------
            try {
                await this.setObjectNotExistsAsync('analysis.health.saveDailyDebug', {
                    type: 'state', common: { name: 'OC-7 Sleep Debug (letzter saveDailyHistory-Lauf)', type: 'string', role: 'json', read: true, write: false, def: '{}' }, native: {}
                });
                const _debugObj = {
                    timestamp: new Date().toISOString(),
                    dateStr: dateStr,
                    eventHistoryCount: this.eventHistory.length,
                    todayEventsCount: todayEvents.length,
                    sleepSearchEventsCount: sleepSearchEvents.length,
                    vibrationBedEventsTotal: sleepSearchEvents.filter(function(e){ return e.isVibrationBed; }).length,
                    fp2BedEventsTotal: sleepSearchEvents.filter(function(e){ return e.isFP2Bed; }).length,
                    bedPresenceMinutes: bedPresenceMinutes,
                    sleepWindowCalcStart: sleepWindowCalc.start ? new Date(sleepWindowCalc.start).toISOString() : null,
                    sleepWindowCalcEnd:   sleepWindowCalc.end   ? new Date(sleepWindowCalc.end).toISOString()   : null,
                    sleepWindowOC7Start:  sleepWindowOC7.start  ? new Date(sleepWindowOC7.start).toISOString()  : null,
                    sleepWindowOC7End:    sleepWindowOC7.end    ? new Date(sleepWindowOC7.end).toISOString()    : null,
                    sleepStagesCount: sleepStages.length,
                    sleepScore: sleepScore,
                    oc4GuardFired: (bedPresenceMinutes < 180 && sleepWindowCalc.start === null && fp2BedEventsTotal > 0),
                };
                await this.setStateAsync('analysis.health.saveDailyDebug', { val: JSON.stringify(_debugObj), ack: true });
                this.log.info('[OC-7 Debug] stages=' + sleepStages.length + ' windowOC7=' + (_debugObj.sleepWindowOC7Start || 'NULL') + ' bedPresMin=' + bedPresenceMinutes + ' vibBedEvts=' + _debugObj.vibrationBedEventsTotal);
            } catch(_de) { this.log.warn('[OC-7 Debug] Fehler beim Schreiben des Debug-States: ' + _de.message); }

            // Vibration Bett: Erschuetterungen im Schlaf-Fenster (Fallback: 22-06)
            const nightVibrationCount = todayEvents.filter(function(e) {
                if (!e.isVibrationBed) return false;
                var v = isActiveValue(e.value) || toPersonCount(e.value) > 0;
                if (!v) return false;
                var ts = e.timestamp||0;
                if (sleepWindowCalc.start && sleepWindowCalc.end) {
                    return ts >= sleepWindowCalc.start && ts <= sleepWindowCalc.end;
                }
                var hr = new Date(ts).getHours();
                return hr >= 22 || hr < 6;
            }).length;
            // Vibration Staerke: Avg und Max im Schlaf-Fenster (fuer Parkinson/Epilepsie)
            var _vibStrSum = 0; var _vibStrCount = 0; var _vibStrMax = 0;
            todayEvents.forEach(function(e) {
                if (!e.isVibrationStrength) return;
                var ts = e.timestamp || 0;
                var inWin = (sleepWindowCalc.start && sleepWindowCalc.end)
                    ? (ts >= sleepWindowCalc.start && ts <= sleepWindowCalc.end)
                    : (new Date(ts).getHours() >= 22 || new Date(ts).getHours() < 6);
                if (!inWin) return;
                var s = typeof e.value === 'number' ? e.value : parseFloat(e.value);
                if (isNaN(s) || s <= 0) return;
                _vibStrSum += s; _vibStrCount++; if (s > _vibStrMax) _vibStrMax = s;
            });
            const nightVibrationStrengthAvg = _vibStrCount > 0 ? Math.round(_vibStrSum / _vibStrCount) : null;
            const nightVibrationStrengthMax = _vibStrCount > 0 ? _vibStrMax : null;

            // Nykturie: Badezimmer-Sensor-Ereignisse ? dynamisches Schlaf-Fenster (Fallback: 22-06)
            const _bathroomDevIds = new Set((this.config.devices || []).filter(function(d) { return d.isBathroomSensor || d.sensorFunction === 'bathroom'; }).map(function(d) { return d.id; }));
            const _kitchenDevIds  = new Set((this.config.devices || []).filter(function(d) { return d.isKitchenSensor || d.sensorFunction === 'kitchen'; }).map(function(d) { return d.id; }));
            const nocturiaCount = (function() {
                var nightHours = new Set();
                var hasDyn = !!(sleepWindowCalc.start && sleepWindowCalc.end);
                todayEvents.forEach(function(e) {
                    if (!e.isBathroomSensor && !_bathroomDevIds.has(e.id)) return;
                    var ts = e.timestamp || e.ts || 0;
                    var hr = new Date(ts).getHours();
                    if (hasDyn) {
                        if (ts >= sleepWindowCalc.start && ts <= sleepWindowCalc.end) nightHours.add(hr);
                    } else {
                        if (hr >= 22 || hr < 6) nightHours.add(hr);
                    }
                });
                return nightHours.size;
            })();
            const kitchenVisits = (function() {
                var hours = new Set();
                todayEvents.forEach(function(e) {
                    if (!e.isKitchenSensor && !_kitchenDevIds.has(e.id)) return;
                    var hr = new Date(e.timestamp || e.ts || 0).getHours();
                    hours.add(hr);
                });
                return hours.size;
            })();

            // ============================================================
            // Per-Person Nacht-Analyse
            // ============================================================
            const _self = this;
            const personData = (function() {
                var result = {};
                var devices = (_self.config && _self.config.devices) ? _self.config.devices : [];
                var personSensorIds = {};
                devices.forEach(function(d) {
                    if (!d.personTag || !d.personTag.trim()) return;
                    var p = d.personTag.trim();
                    if (!personSensorIds[p]) personSensorIds[p] = new Set();
                    personSensorIds[p].add(d.id);
                });
                if (Object.keys(personSensorIds).length === 0) return result;
                var winStart = sleepWindowCalc.start || (function(){ var d=new Date(); d.setHours(22,0,0,0); return d.getTime(); })();
                var winEnd   = sleepWindowCalc.end   || (function(){ var d=new Date(); d.setHours(6,0,0,0); if(d.getTime()<winStart) d.setDate(d.getDate()+1); return d.getTime(); })();
                Object.keys(personSensorIds).forEach(function(person) {
                    var ids = personSensorIds[person];
                    var personEvents = todayEvents.filter(function(e) { return ids.has(e.id); });
                    var nightEvents = personEvents.filter(function(e) {
                        var ts = e.timestamp||e.ts||0;
                        return ts >= winStart && ts <= winEnd;
                    });
                    var nightActivityCount = nightEvents.length;
                    var morning5 = new Date(winEnd); morning5.setHours(5,0,0,0);
                    var morningEvt = personEvents.filter(function(e) {
                        var ts = e.timestamp||e.ts||0;
                        return ts >= morning5.getTime();
                    }).sort(function(a,b){ return (a.timestamp||0)-(b.timestamp||0); });
                    var wakeTimeMin = morningEvt.length > 0 ? Math.round(((morningEvt[0].timestamp||0) - new Date(morningEvt[0].timestamp||0).setHours(0,0,0,0)) / 60000) : null;
                    var eveningEvts = personEvents.filter(function(e) {
                        var ts = e.timestamp||e.ts||0; var hr = new Date(ts).getHours();
                        return hr >= 18 && hr <= 23;
                    }).sort(function(a,b){ return (a.timestamp||0)-(b.timestamp||0); });
                    var sleepOnsetMin = null;
                    for (var i = eveningEvts.length-1; i >= 0; i--) {
                        var next = eveningEvts[i+1] ? eveningEvts[i+1].timestamp : null;
                        if (!next || (next - eveningEvts[i].timestamp) > 45*60*1000) {
                            sleepOnsetMin = Math.round(((eveningEvts[i].timestamp||0) - new Date(eveningEvts[i].timestamp||0).setHours(0,0,0,0)) / 60000);
                            break;
                        }
                    }
                    var bathroomIds = new Set((devices||[]).filter(function(d){ return d.isBathroomSensor || d.sensorFunction==='bathroom'; }).map(function(d){ return d.id; }));
                    var bathroomNightEvents = todayEvents.filter(function(e) {
                        if (!bathroomIds.has(e.id)) return false;
                        var ts = e.timestamp||e.ts||0;
                        return ts >= winStart && ts <= winEnd;
                    });
                    var nocturiaAttr = 0;
                    bathroomNightEvents.forEach(function(bathEvt) {
                        var bathTs = bathEvt.timestamp||0;
                        var recentPersonEvt = nightEvents.filter(function(e) {
                            var ts = e.timestamp||0;
                            return ts >= bathTs - 10*60*1000 && ts < bathTs;
                        });
                        if (recentPersonEvt.length > 0) nocturiaAttr++;
                    });
                    result[person] = {
                        nightActivityCount: nightActivityCount,
                        wakeTimeMin: wakeTimeMin,
                        sleepOnsetMin: sleepOnsetMin,
                        nocturiaAttr: nocturiaAttr
                    };
                });
                return result;
            })();
            try { await this.setStateAsync('system.personData', { val: JSON.stringify(personData), ack: true }); } catch(e) {}

            const snapshot = {
                date: dateStr,
                timestamp: Date.now(),
                roomHistory: roomHistoryData,
                todayRoomMinutes: todayRoomMinutes,   // { 'EG Bad': 25, ... }
                geminiNight: geminiNight?.val || null,
                geminiDay: geminiDay?.val || null,
                anomalyScore: anomalyScore?.val !== undefined && anomalyScore?.val !== null
                    ? Number(anomalyScore.val) : null,
                todayVector: (() => {
                    // Prim?r: aus analysis.health.todayVector State (rawEventLog-basiert)
                    // Fallback: direkt aus eventHistory des heutigen Tages berechnen
                    let vec = todayVector?.val ? JSON.parse(todayVector.val) : null;
                    const vecIsEmpty = !vec || vec.every(v => v === 0);
                    if (vecIsEmpty && todayEvents.length > 0) {
                        // Fallback: Vector aus heutigen Events berechnen
                        vec = new Array(48).fill(0);
                        const dayStart = new Date().setHours(0,0,0,0);
                        todayEvents.forEach(e => {
                            const ts = e.timestamp || e.ts || 0;
                            if (ts >= dayStart) {
                                const d = new Date(ts);
                                const slot = d.getHours() * 2 + Math.floor(d.getMinutes() / 30);
                                if (slot >= 0 && slot < 48) vec[slot]++;
                            }
                        });
                    }
                    return vec || new Array(48).fill(0);
                })(),
                batteryLevel: battery,
                freshAirCount: freshAirCount,
                freshAirLongCount: freshAirLongCount,
                windowOpenings: freshAirCount,
                gaitSpeed: (() => {
                    // Berechne heutige Gait-Speed direkt aus Sequenzen (kein async noetig)
                    try {
                        const seqState = this._lastSeqState; // wird unten gesetzt
                        if (!seqState) return null;
                        const allSeqs = JSON.parse(seqState);
                        const todayStr = dateStr; // bereits oben definiert
                        const todaySeqs = allSeqs.filter(s => (s.timestamp || '').startsWith(todayStr));
                        if (todaySeqs.length < 1) return null;

                        const hallwayConf = (this.config.devices || []).filter(d => d.isHallway || d.sensorFunction === 'hallway').map(d => d.location || d.name || '');
                        const hallwayKw = ['flur', 'diele', 'gang', 'korridor'];
                        // Keyword-Fallback nur wenn kein Flur konfiguriert (Sensorliste ist Master)
                        const isHallway = (loc) => hallwayConf.includes(loc) || (hallwayConf.length === 0 && hallwayKw.some(k => (loc || '').toLowerCase().includes(k)));

                        const transits = [];
                        for (const seq of todaySeqs) {
                            const steps = seq.steps || [];
                            if (steps.length < 3) continue;
                            for (let i = 1; i < steps.length - 1; i++) {
                                if (!isHallway(steps[i].loc)) continue;
                                if (isHallway(steps[i-1].loc) || isHallway(steps[i+1].loc)) continue;
                                const transit = (steps[i+1].t_delta || 0) - (steps[i].t_delta || 0);
                                if (transit >= 1 && transit <= 20) transits.push(transit);
                            }
                        }
                        if (transits.length < 2) return null;
                        transits.sort((a, b) => a - b);
                        const median = transits[Math.floor(transits.length / 2)];
                        return Math.round(median * 10) / 10;
                    } catch(e) { return null; }
                })(),
                eventHistory: todayEvents,
                nocturiaCount: nocturiaCount,
                kitchenVisits: kitchenVisits,
                sleepWindowStart: sleepWindowOC7.start,   // ms-Timestamp Schlafbeginn (OC7-Fenster inkl. Vib-Fallback)
                sleepWindowEnd:   sleepWindowOC7.end,     // ms-Timestamp Aufwachen
                maxPersonsDetected: maxPersonsDetected,
                bedPresenceMinutes: bedPresenceMinutes,
                nightVibrationCount: nightVibrationCount,
                nightVibrationStrengthAvg: nightVibrationStrengthAvg,
                nightVibrationStrengthMax: nightVibrationStrengthMax,
                personData: personData,
                sleepScore: sleepScore,
                sleepScoreRaw: sleepScoreRaw,
                sleepStages: sleepStages,
                garminScore: garminScore,
                garminDeepMin: garminDeepSec ? Math.round(garminDeepSec/60) : null,
                garminLightMin: garminLightSec ? Math.round(garminLightSec/60) : null,
                garminRemMin: garminRemSec ? Math.round(garminRemSec/60) : null,
                sleepWindowSource: sleepWindowSource,
                outsideBedEvents: outsideBedEvents,
                wakeSource: wakeSource,
                wakeConf: wakeConf,
                allWakeSources: allWakeSources,
                sleepStartSource: sleepStartSource,
                allSleepStartSources: allSleepStartSources,
                wakeConfirmed: !!(sleepWindowOC7.end && new Date().getHours() >= 10 && (Date.now() - (sleepWindowOC7.end || 0)) >= 3600000)
            };

            const dataDir = utils.getAbsoluteDefaultDataDir();
            const historyDir = path.join(dataDir, 'cogni-living', 'history');
            if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });

            const filePath = path.join(historyDir, `${dateStr}.json`);
            fs.writeFileSync(filePath, JSON.stringify(snapshot));
            this.log.info(`? History saved: ${filePath}`);

            // N?chtliche Drift-Pr?fung (nach dem Speichern)
            this._checkDriftAlarm(historyDir).catch(e => this.log.warn(`[Drift] Alarm-Check Fehler: ${e.message}`));

        } catch(e) { this.log.error(`History Save Error: ${e.message}`); }
    }

    async _checkDriftAlarm(historyDir) {
        const setup = require('./lib/setup');
        const COOLDOWN_DAYS = 14;
        const MIN_DAYS      = 10;

        // Cooldown pr?fen
        try {
            const lastAlarm = await this.getStateAsync('analysis.drift.lastAlarmDate').catch(() => null);
            if (lastAlarm && lastAlarm.val) {
                const daysSince = (Date.now() - new Date(lastAlarm.val).getTime()) / 86400000;
                if (daysSince < COOLDOWN_DAYS) {
                    this.log.debug(`[Drift] Cooldown aktiv (${daysSince.toFixed(0)} von ${COOLDOWN_DAYS} Tagen)`);
                    return;
                }
            }
        } catch(e) {}

        // Letzte 60 Tage laden
        const days = [];
        for (let i = 1; i <= 60; i++) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const ds = d.toISOString().slice(0, 10);
            const fp = path.join(historyDir, `${ds}.json`);
            if (fs.existsSync(fp)) {
                try {
                    const h = JSON.parse(fs.readFileSync(fp, 'utf8'));
                    const vec = h.todayVector || [];
                    const act = vec.reduce((a, b) => a + b, 0);
                    const gs  = (h.gaitSpeed > 0 && h.gaitSpeed < 60) ? h.gaitSpeed : 0;
                    const nt  = h.nightMotionCount !== undefined ? h.nightMotionCount
                                : Array.isArray(h.eventHistory)
                                    ? h.eventHistory.filter(e => { const hr = new Date(e.timestamp||e.ts||0).getHours(); return hr>=22||hr<6; }).length
                                    : 0;
                    days.push({ date: ds, act, gs, nt });
                } catch(e) {}
            }
        }
        days.sort((a, b) => a.date.localeCompare(b.date));
        if (days.length < MIN_DAYS) { this.log.debug(`[Drift] Zu wenig Daten (${days.length})`); return; }

        // Mediane als Normalisierung
        const median = arr => { const s=[...arr].sort((a,b)=>a-b); return s[Math.floor(s.length/2)]||1; };
        const actVals = days.map(d=>d.act).filter(v=>v>0);
        const mAct = median(actVals)||1;
        const actNorm = days.map(d => d.act>0 ? Math.min(200, Math.round((d.act/mAct)*100)) : 0);

        // Page-Hinkley (einfach, JS-intern, keine Python n?tig)
        const ph = (vals, direction='up', k=0.5) => {
            const cal = Math.min(14, Math.max(7, Math.floor(vals.length/2)));
            const calVals = vals.slice(0, cal).filter(v=>v>0);
            if (calVals.length < 3) return { score: 0, threshold: 50, alarm: false };
            const mu  = calVals.reduce((a,b)=>a+b,0)/calVals.length;
            const std = Math.sqrt(calVals.reduce((a,b)=>a+(b-mu)**2,0)/calVals.length)||1;
            const th  = Math.max(30, 3*std*Math.sqrt(Math.max(1, vals.length-cal)));
            let M=0, m=0, score=0;
            for (let i=cal; i<vals.length; i++) {
                const x = direction==='down' ? -vals[i] : vals[i];
                const muD = direction==='down' ? -mu : mu;
                M = M + (x - muD - k*std);
                m = Math.min(m, M);
                score = Math.max(0, M - m);
            }
            return { score: Math.round(score*10)/10, threshold: Math.round(th*10)/10, alarm: score > th };
        };

        const actR   = ph(actNorm, 'down');
        const gaitR  = ph(days.map(d=>d.gs).filter(v=>v>0), 'up');
        const nightR = ph(days.map(d=>d.nt), 'up');

        this.log.debug(`[Drift] Scores ? Aktivit?t: ${actR.score}/${actR.threshold} | Gait: ${gaitR.score}/${gaitR.threshold} | Nacht: ${nightR.score}/${nightR.threshold}`);

        // Pushover nur wenn mindestens eine Metrik Alarm schl?gt
        const alarms = [];
        if (actR.alarm)   alarms.push(`?? Aktivit?t sinkt (Score ${actR.score}/${actR.threshold})`);
        if (gaitR.alarm)  alarms.push(`?? Ganggeschwindigkeit steigt (Score ${gaitR.score}/${gaitR.threshold})`);
        if (nightR.alarm) alarms.push(`?? Nacht-Unruhe nimmt zu (Score ${nightR.score}/${nightR.threshold})`);

        if (alarms.length > 0) {
            const msg = `?? DRIFT ERKANNT (${days.length} Tage Datenbasis)\n\n${alarms.join('\n')}\n\nBitte Admin-UI ? Drift-Monitor f?r Details ?ffnen.`;
            setup.sendNotification(this, msg, true, false, '?? NUUKANNI: Verhaltens-Drift');
            await this.setObjectNotExistsAsync('analysis.drift.lastAlarmDate', { type: 'state', common: { name: 'Letzter Drift-Alarm', type: 'string', role: 'text', read: true, write: false, def: '' }, native: {} });
            await this.setStateAsync('analysis.drift.lastAlarmDate', { val: new Date().toISOString(), ack: true });
            this.log.warn(`[Drift] ?? Alarm ausgel?st: ${alarms.join(' | ')}`);
        }
    }

    async integrateRoomTime() {
        if (!this.isPresent) return;
        try {
            let currentRoom = null;
            try {
                const trState = await this.getStateAsync('analysis.prediction.trackerTopRoom');
                const tpState = await this.getStateAsync('analysis.prediction.trackerConfidence');
                if (trState && trState.val && tpState && tpState.val && tpState.val > 0.3) {
                    if (trState.val !== 'Unknown' && trState.val !== 'Init...') currentRoom = trState.val;
                }
            } catch(e) {}

            if (!currentRoom) {
                const devices = this.config.devices || [];
                for (const dev of devices) {
                    if (dev.type === 'motion' && dev.location) {
                        try {
                            const s = await this.getForeignStateAsync(dev.id);
                            if (s && (s.val === true || s.val === 'on' || s.val === 1)) {
                                currentRoom = dev.location;
                                break;
                            }
                        } catch(e) {}
                    }
                }
            }

            if (!currentRoom) return;

            const devices = this.config.devices || [];
            let normalizedRoom = currentRoom;
            const match = devices.find(d => d.location && d.location.toLowerCase() === currentRoom.toLowerCase());
            if (match) normalizedRoom = match.location;

            const histId = 'analysis.activity.roomHistory';
            const histState = await this.getStateAsync(histId);
            const todayStr = new Date().toLocaleDateString();
            let histData = { history: {}, date: todayStr };

            if (histState && histState.val) { try { histData = JSON.parse(histState.val); } catch(e){} }

            if (histData.date !== todayStr) { histData.history = {}; histData.date = todayStr; }
            if (!histData.history[normalizedRoom]) histData.history[normalizedRoom] = new Array(24).fill(0);

            const currentHour = new Date().getHours();
            if (histData.history[normalizedRoom][currentHour] < 60) histData.history[normalizedRoom][currentHour]++;

            await this.setStateAsync(histId, { val: JSON.stringify(histData), ack: true });

        } catch(e) { this.log.warn(`[Integrator] Error: ${e.message}`); }
    }

    async onMessage(obj) {
        if (typeof obj === 'object' && obj.message) {
            if (obj.command === 'getHistoryData') {
                const requestedDate = obj.message.date;
                const dataDir = utils.getAbsoluteDefaultDataDir();
                const filePath = path.join(dataDir, 'cogni-living', 'history', `${requestedDate}.json`);
                if (fs.existsSync(filePath)) {
                    try {
                        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                        this.sendTo(obj.from, obj.command, { success: true, data: data }, obj.callback);
                    } catch(e) { this.sendTo(obj.from, obj.command, { success: false, error: "Corrupt" }, obj.callback); }
                } else { this.sendTo(obj.from, obj.command, { success: false, error: "No data" }, obj.callback); }
            }
            else if (obj.command === 'getOverviewData') {
                const digestCount = this.dailyDigests.length;

                let hourlyActivity = new Array(48).fill(0);
                let hourlyDetails = Array.from({ length: 48 }, () => []);
                try {
                    const vecState = await this.getStateAsync('analysis.health.todayVector');
                    if (vecState && vecState.val) hourlyActivity = JSON.parse(vecState.val);

                    const detState = await this.getStateAsync('analysis.health.todayRoomDetails');
                    if (detState && detState.val) hourlyDetails = JSON.parse(detState.val);
                } catch(e) {}

                // LOAD YESTERDAY'S DATA
                let yesterdayActivity = new Array(48).fill(0);
                try {
                    const y = new Date(); y.setDate(y.getDate() - 1);
                    const yStr = y.toISOString().split('T')[0];
                    const dataDir = utils.getAbsoluteDefaultDataDir();
                    const yPath = path.join(dataDir, 'cogni-living', 'history', `${yStr}.json`);
                    if (fs.existsSync(yPath)) {
                        const yData = JSON.parse(fs.readFileSync(yPath, 'utf8'));
                        if (yData && yData.todayVector) yesterdayActivity = yData.todayVector;
                    }
                } catch(e) { /* Ignore */ }

                let roomStats = { today: {}, yesterday: {} };
                try { const rs = await this.getStateAsync('analysis.activity.roomStats'); if (rs && rs.val) roomStats = JSON.parse(rs.val); } catch(e) {}

                // BATTERY FALLBACK
                let activityTrendVal = null;
                try { const at = await this.getStateAsync('analysis.health.activityTrend'); if(at) activityTrendVal = at.val; } catch(e){}

                if (activityTrendVal === undefined || activityTrendVal === null) {
                    const totalEvents = hourlyActivity.reduce((a, b) => a + b, 0);
                    const fallbackTrend = Math.min(2, Math.max(-2, (100 - totalEvents) / 50));
                    activityTrendVal = fallbackTrend;
                }

                let detected = false; let desc = ''; let tId = ''; let tVal = '';
                try {
                    const dState = await this.getStateAsync('analysis.automation.patternDetected');
                    if (dState && dState.val) {
                        detected = true;
                        const descS = await this.getStateAsync('analysis.automation.description'); desc = descS ? descS.val : '';
                        const tIdS = await this.getStateAsync('analysis.automation.targetId'); tId = tIdS ? tIdS.val : '';
                        const tValS = await this.getStateAsync('analysis.automation.targetValue'); tVal = tValS ? tValS.val : '';
                    }
                } catch(e){}

                const isSunny = await this.checkSolarCondition();
                const hasSolar = (this.config.devices || []).some(d => d.isSolar);
                const solarActive = isSunny && hasSolar;
                let presenceWho = ''; try { const pw = await this.getStateAsync('system.presenceWho'); if(pw && pw.val) presenceWho = pw.val; } catch(e){}

                this.sendTo(obj.from, obj.command, {
                    success: true,
                    eventHistory: this.eventHistory.slice(0, 2000),
                    stats: {
                        digestCount,
                        isPresent: this.isPresent,
                        hourlyActivity,
                        hourlyDetails,
                        yesterdayActivity,
                        solarActive,
                        presenceWho,
                        roomStats,
                        activityTrend: activityTrendVal,
                        modules: this.activeModules
                    },
                    automation: { detected, description: desc, targetId: tId, targetValue: tVal }
                }, obj.callback);
            }
            else if (obj.command === 'checkThermostats') { try { const results = await automation.scanThermostats(this); this.sendTo(obj.from, obj.command, { success: true, results }, obj.callback); } catch (e) { this.sendTo(obj.from, obj.command, { success: false, error: e.message }, obj.callback); } }
            else if (obj.command === 'scanDevices') { try { const results = await scanner.scanForDevices(this, obj.message || {}); this.sendTo(obj.from, obj.command, { success: true, devices: results }, obj.callback); } catch (e) {} }
            else if (obj.command === 'getEnums') {
                const functions = await this.getForeignObjectsAsync('enum.functions.*', 'enum');
                const list = [];
                if (functions) {
                    for (const id in functions) {
                        let n = functions[id].common.name;
                        if (n && typeof n === 'object') n = n.de || n.en || Object.values(n)[0] || JSON.stringify(n);
                        list.push({ id: id, name: String(n || id) });
                    }
                }
                const rooms = await this.getForeignObjectsAsync('enum.rooms.*', 'enum');
                const roomList = [];
                if (rooms) {
                    for (const id in rooms) {
                        let n = rooms[id].common.name;
                        if (n && typeof n === 'object') n = n.de || n.en || Object.values(n)[0] || JSON.stringify(n);
                        roomList.push(String(n || id.split('.').pop()));
                    }
                }
                this.sendTo(obj.from, obj.command, { success: true, enums: list, rooms: roomList }, obj.callback);
            }
            // --- FIX: ROBUST CALENDAR SEARCH & HANDLERS ---
            else if (obj.command === 'getCalendarNames') {
                try {
                    // Loop through ALL ical instances to find calendars, regardless of frontend default
                    const instances = await this.getObjectViewAsync('system', 'instance', { startkey: 'system.adapter.ical.', endkey: 'system.adapter.ical.\u9999' });
                    const names = new Set();

                    if (instances && instances.rows) {
                        for (const row of instances.rows) {
                            const instId = row.id.replace('system.adapter.', '');
                            const state = await this.getForeignStateAsync(`${instId}.data.table`);

                            let foundSpecific = false;
                            if (state && state.val) {
                                const table = typeof state.val === 'string' ? JSON.parse(state.val) : state.val;
                                if (Array.isArray(table)) {
                                    table.forEach(entry => {
                                        if(entry.calendarName) {
                                            names.add(entry.calendarName);
                                            foundSpecific = true;
                                        }
                                    });
                                }
                            }

                            // FALLBACK: If no specific "calendarName" found in events, use Instance ID
                            // This ensures we always find at least "ical.0" if it exists.
                            if (!foundSpecific) {
                                names.add(instId);
                            }
                        }
                    }

                    const finalNames = Array.from(names);
                    if (finalNames.length === 0) finalNames.push('Standard'); // Absolute fallback

                    this.sendTo(obj.from, obj.command, { success: true, names: finalNames }, obj.callback);
                } catch(e) {
                    this.sendTo(obj.from, obj.command, { success: false, error: "Scan Error: " + e.message }, obj.callback);
                }
            }
            else if (obj.command === 'refreshCalendar') {
                try {
                    await automation.updateSchedulePreview(this);
                    this.sendTo(obj.from, obj.command, { success: true }, obj.callback);
                } catch(e) {
                    this.log.warn(`refreshCalendar failed: ${e.message}`);
                    this.sendTo(obj.from, obj.command, { success: false, error: e.message }, obj.callback);
                }
            }
            else if (obj.command === 'updateTopologyMatrix') {
                try {
                    const newMatrix = obj.message.matrix;
                    if (!newMatrix || !Array.isArray(newMatrix)) {
                        throw new Error('Invalid matrix data');
                    }
                    
                    // Lade aktuelle Topologie
                    const state = await this.getStateAsync('analysis.topology.structure');
                    if (state && state.val) {
                        const topo = JSON.parse(state.val);
                        topo.matrix = newMatrix;
                        topo.updated = Date.now();
                        
                        // Speichere aktualisierte Matrix
                        await this.setStateAsync('analysis.topology.structure', { val: JSON.stringify(topo), ack: true });
                        
                        this.log.debug(`??? Topology Matrix manually updated by user.`);
                        this.sendTo(obj.from, obj.command, { success: true }, obj.callback);
                    } else {
                        throw new Error('No topology data found');
                    }
                } catch(e) {
                    this.log.warn(`updateTopologyMatrix failed: ${e.message}`);
                    this.sendTo(obj.from, obj.command, { success: false, error: e.message }, obj.callback);
                }
            }
            else if (obj.command === 'pythonBridge') {
                // Generic Python Bridge Handler - leitet alle Commands an Python weiter
                try {
                    const pythonCommand = obj.message.command;
                    const pythonData = obj.message;
                    
                    this.log.debug(`[PythonBridge] Forwarding command: ${pythonCommand}`);
                    
                    pythonBridge.send(this, pythonCommand, pythonData, (response) => {
                        // Callback wenn Python antwortet
                        this.sendTo(obj.from, obj.command, response, obj.callback);
                    });
                } catch(e) {
                    this.log.warn(`pythonBridge command failed: ${e.message}`);
                    this.sendTo(obj.from, obj.command, { type: 'ERROR', payload: e.message }, obj.callback);
                }
            }
            else if (obj.command === 'testApiKey') {
                try {
                    const testKey = obj.message ? obj.message.apiKey : '';
                    if (!testKey) throw new Error("Kein API Key ?bergeben.");

                    const testAI = new GoogleGenerativeAI(testKey);
                    const model = testAI.getGenerativeModel({ model: GEMINI_MODEL });
                    const result = await model.generateContent("Say Hello");
                    const response = await result.response;
                    const text = response.text();

                    this.sendTo(obj.from, obj.command, { success: true, message: "Verbindung erfolgreich: " + text.substring(0, 20) + "..." }, obj.callback);
                } catch(e) {
                    this.sendTo(obj.from, obj.command, { success: false, message: e.message }, obj.callback);
                }
            }
            else if (obj.command === 'testContext') {
                try {
                    const isSunny = await this.checkSolarCondition();
                    const instances = await this.getObjectViewAsync('system', 'instance', { startkey: 'system.adapter.ical.', endkey: 'system.adapter.ical.\u9999' });
                    const calCount = instances && instances.rows ? instances.rows.length : 0;

                    this.sendTo(obj.from, obj.command, {
                        success: true,
                        weather: `Sonne: ${isSunny}, Temp: ${this.sensorLastValues[this.config.outdoorSensorId] || '?'}?C`,
                        calendar: `${calCount} Kalender-Adapter gefunden.`
                    }, obj.callback);
                } catch(e) {
                    this.sendTo(obj.from, obj.command, { success: false }, obj.callback);
                }
            }
        }
    }

    runPythonHealthCheck() {
        if (!this.activeModules.health) return;
        this.log.debug('?? Triggering Python Health Check (Activity Trend)...');
        try {
            const rawEvents = this.rawEventLog || [];
            pythonBridge.send(this, 'CALCULATE_HEALTH_TREND', { events: rawEvents });
        } catch(e) { this.log.warn('Failed to trigger Python Health Check'); }
    }

    async onStateChange(id, state) {
        if (!state || this.dependencyInstallInProgress) return;
        if (id.includes('telegram') && id.endsWith('communicate.request') && state.val) return;

        if (this.config.infrasoundEnabled && id === this.config.infrasoundSensorId && this.activeModules.security) {
            this.handleInfrasound(state.val);
            return;
        }

        if (state.ack && id.endsWith('pulse')) return;

        if (id === `${this.namespace}.system.mode`) {
            if (state.val && Object.values(setup.SYSTEM_MODES).includes(state.val)) {
                this.currentSystemMode = state.val;
                if (state.val === setup.SYSTEM_MODES.VACATION) await recorder.setPresence(this, false);
                else await recorder.setPresence(this, true);

                if (this.isProVersion) {
                    let learnActive = false;
                    let learnDuration = 0;
                    let learnLabel = 'manual';
                    if (this.currentSystemMode === 'party') { learnActive = true; learnDuration = 360; learnLabel = 'Party Mode'; }
                    else if (this.currentSystemMode === 'guest') { learnActive = true; learnDuration = 1440; learnLabel = 'Guest Mode'; }
                    pythonBridge.send(this, 'SET_LEARNING_MODE', { active: learnActive, duration: learnDuration, label: learnLabel });
                    await this.setStateAsync('analysis.security.learningStatus', { val: JSON.stringify({ active: learnActive, label: learnLabel, timestamp: Date.now() }), ack: true });
                }
            }
            if (!state.ack) this.setState(id, { val: this.currentSystemMode, ack: true });
            return;
        }

        if (id.endsWith('analysis.energy.warmupSources') && state.ack) this.protectAiMemory(state.val);
        if (id.endsWith('analysis.energy.warmupTimes') && state.ack && this.activeModules.energy) automation.checkCalendarTriggers(this);

        if (!state.ack) {
            // WICHTIG: Spezifische Trigger VOR dem generischen 'analysis.trigger' pr?fen,
            // da 'analysis.triggerBriefing' sonst von der generischen Bedingung abgefangen wird.
            if (id.includes('triggerBriefing') && state.val && !id.includes('Weekly')) { this.setState(id, { val: false, ack: true }); aiAgent.sendMorningBriefing(this); return; }
            if (id.includes('triggerWeeklyBriefing') && state.val) { this.setState(id, { val: false, ack: true }); aiAgent.sendWeeklyBriefing(this); return; }
            if (id.includes('triggerDailyDigest') && state.val) { this.setState(id, { val: false, ack: true }); if (this.isProVersion) aiAgent.createDailyDigest(this, pythonBridge); return; }
            if (id.includes('analysis.trigger') && state.val) { this.setState(id, { val: false, ack: true }); aiAgent.runGeminiAnalysis(this); return; }
            if (id.includes('automation.triggerAction') && state.val) { this.setState(id, { val: false, ack: true }); aiAgent.executeAutomationAction(this); return; }
            if (id.includes('analysis.training.triggerSecurity') && state.val) { this.setState(id, { val: false, ack: true }); if (this.isProVersion) { try { const seqState = await this.getStateAsync('LTM.trainingData.sequences'); if (seqState && seqState.val) { const sequences = JSON.parse(seqState.val); this.setStateAsync('analysis.training.status', { val: 'Sec-Training started...', ack: true }); pythonBridge.send(this, 'TRAIN_SECURITY', { sequences }); } } catch(e) {} } return; }

            if (id.includes('analysis.training.triggerHealth') && state.val) {
                this.setState(id, { val: false, ack: true });
                try {
                    // Health Reports sind f?r alle verf?gbar (nicht nur Pro!)
                    aiAgent.generateHealthReport(this, 'NIGHT');
                    setTimeout(() => aiAgent.generateHealthReport(this, 'DAY'), 12000);
                    
                    // Training nur fuer Pro-Version
                    if (this.isProVersion) {
                        this.runPythonHealthCheck();
                        const s = await this.getStateAsync('LTM.dailyDigests');
                        if (s && s.val) {
                            const digests = JSON.parse(s.val);
                            pythonBridge.send(this, 'TRAIN_HEALTH', { digests });
                        }
                    }

                    // Disease-Score-Berechnung: nutzt numerische History-Dateien (nicht LTM AI-Digests!)
                    // Zuerst heutigen Snapshot sichern, damit er beim Laden verfuegbar ist
                    try { await this.saveDailyHistory(); } catch(e) {}
                    try {
                        const _dsDataDir = utils.getAbsoluteDefaultDataDir();
                        const _dsHistDir = path.join(_dsDataDir, 'cogni-living', 'history');
                        const _histDigests = [];
                        const _bathroomIds = new Set((this.config.devices || []).filter(function(d) { return d.isBathroomSensor || d.sensorFunction === 'bathroom'; }).map(function(d) { return d.id; }));
                        const _kitchenIds  = new Set((this.config.devices || []).filter(function(d) { return d.isKitchenSensor || d.sensorFunction === 'kitchen'; }).map(function(d) { return d.id; }));
                        for (let _di = 0; _di <= 59; _di++) {
                            const _dObj = new Date(); _dObj.setDate(_dObj.getDate() - _di);
                            const _dStr = _dObj.toISOString().slice(0, 10);
                            const _fp = path.join(_dsHistDir, (_dStr + '.json'));
                            if (fs.existsSync(_fp)) {
                                try {
                                    const _h = JSON.parse(fs.readFileSync(_fp, 'utf8'));
                                    const _vec = _h.todayVector || [];
                                    const _actSum = _vec.reduce(function(a, b) { return a + b; }, 0);
                                    const _nightEv = Array.isArray(_h.eventHistory)
                                        ? _h.eventHistory.filter(function(e) { const hr = new Date(e.timestamp||e.ts||0).getHours(); return hr >= 22 || hr < 6; }).length
                                        : (_h.nightMotionCount || 0);
                                    const _rooms = Object.keys(_h.todayRoomMinutes || {}).filter(function(k) { return (_h.todayRoomMinutes[k]||0) > 0; }).length || 1;
                                    const _bathArr = Array.isArray(_h.eventHistory) ? _h.eventHistory.filter(function(e) { return e.isBathroomSensor; }).map(function(e) { return Math.floor((e.timestamp||e.ts||0) / 3600000); }) : [];
                                    const _bathSet = new Set(_bathArr);
                                    // Fallback fuer nocturiaCount aus alten History-Dateien ohne Flag
                                    var _nocturiaVal = _h.nocturiaCount;
                                    if (_nocturiaVal === undefined && Array.isArray(_h.eventHistory)) {
                                        var _nightBathHours = new Set(_h.eventHistory.filter(function(e) {
                                            if (!e.isBathroomSensor && !_bathroomIds.has(e.id)) return false;
                                            var hr = new Date(e.timestamp || e.ts || 0).getHours();
                                            return hr >= 22 || hr < 6;
                                        }).map(function(e) { return new Date(e.timestamp || e.ts || 0).getHours(); }));
                                        _nocturiaVal = _nightBathHours.size;
                                    }
                                    var _kitchenVal = _h.kitchenVisits;
                                    if (_kitchenVal === undefined && Array.isArray(_h.eventHistory)) {
                                        var _kitchenHrs = new Set(_h.eventHistory.filter(function(e) {
                                            return e.isKitchenSensor || _kitchenIds.has(e.id);
                                        }).map(function(e) { return new Date(e.timestamp || e.ts || 0).getHours(); }));
                                        _kitchenVal = _kitchenHrs.size;
                                    }
                                    _histDigests.push({
                                        date: _dStr,
                                        activityPercent: _actSum,
                                        gaitSpeed: _h.gaitSpeed || 0,
                                        nightEvents: _nightEv,
                                        uniqueRooms: _rooms,
                                        bathroomVisits: _bathSet.size,
                                        nocturiaCount: _nocturiaVal || 0,
                                        kitchenVisits: _kitchenVal || 0,
                                        maxPersonsDetected: _h.maxPersonsDetected || 0,
                                        bedPresenceMinutes: _h.bedPresenceMinutes || 0,
                                        nightVibrationCount: _h.nightVibrationCount || 0
                                    });
                                } catch(e) {}
                            }
                        }
                        _histDigests.sort(function(a, b) { return a.date.localeCompare(b.date); });
                        this.log.info('[DiseaseScore] History-Tage geladen: ' + _histDigests.length);
                        // Aktivierte Profile aus Config lesen (dynamisch, nicht hardcoded)
                        const _allProfiles = ['fallRisk','dementia','frailty','depression','diabetes2','sleepDisorder','cardiovascular','parkinson','copd','socialIsolation','epilepsy','diabetes1','longCovid','bipolar'];
                        const _healthProfiles = this.config.healthProfiles || {};
                        const _enabledProfiles = _allProfiles.filter(function(p) { return _healthProfiles[p] && _healthProfiles[p].enabled; });
                        // Fallback: Wenn keine Profile aktiviert, trotzdem Basis-Profile berechnen
                        const _activeProfiles = _enabledProfiles.length > 0 ? _enabledProfiles : ['fallRisk', 'dementia', 'frailty'];
                        if (_histDigests.length >= 5) {
                            pythonBridge.send(this, 'ANALYZE_DISEASE_SCORES', { digests: _histDigests, enabledProfiles: _activeProfiles }, (result) => {
                                if (!result || !result.payload || result.payload.error) { this.log.warn('[DiseaseScore] Fehler: ' + JSON.stringify(result)); return; }
                                const scores = result.payload;
                                this.setStateAsync('analysis.health.disease.scores', { val: JSON.stringify(scores), ack: true }).catch(() => {});
                                for (const [p, d] of Object.entries(scores)) {
                                    if (d && d.score !== null && d.score !== undefined) this.setStateAsync('analysis.health.disease.' + p, { val: d.score, ack: true }).catch(() => {});
                                }
                                this.log.info('[DiseaseScore] Gespeichert: ' + Object.keys(scores).map(function(k) { return k + '=' + (scores[k] && scores[k].score); }).join(', '));
                                // Phase 3: Proaktives Screening direkt nach Disease-Scores
                                pythonBridge.send(this, 'ANALYZE_SCREENING', { digests: _histDigests }, (screenResult) => {
                                    if (!screenResult || !screenResult.payload) { this.log.warn('[Screening] Kein Ergebnis'); return; }
                                    this.setStateAsync('analysis.health.screening.hints', { val: JSON.stringify(screenResult.payload), ack: true }).catch(() => {});
                                    const hints = (screenResult.payload.hints || []);
                                    this.log.info('[Screening] ' + hints.length + ' Hinweis(e): ' + hints.map(function(h) { return h.disease + '(' + Math.round(h.confidence * 100) + '%)'; }).join(', '));
                                });
                            });
                        } else {
                            const _insuf = {};
                            for (const _p of _activeProfiles) {
                                _insuf[_p] = { score: null, level: 'INSUFFICIENT_DATA', dataPoints: _histDigests.length, message: _histDigests.length + '/5 Tage Datenbasis. Taeglich waechst die Basis.' };
                            }
                            this.setStateAsync('analysis.health.disease.scores', { val: JSON.stringify(_insuf), ack: true }).catch(() => {});
                            this.log.info('[DiseaseScore] Zu wenig Tage: ' + _histDigests.length + '/5');
                        }
                    } catch(dsErr) { this.log.warn('[DiseaseScore] Fehler: ' + dsErr.message); }

                    // History-Snapshot nach Analyse aktualisieren (damit PWA/Charts frische Daten sehen)
                    // Nach ~30s (NIGHT 0s + DAY 12s + Gemini ~10s + Puffer) ist alles fertig ? PWA-Polling informieren
                    setTimeout(() => {
                        this.saveDailyHistory().catch(e => {});
                        pwaServer.markAnalysisDone();
                    }, 30000);
                } catch(e) {
                    this.log.warn(`triggerHealth error: ${e.message}`);
                }
                return;
            }

            if (id.includes('analysis.training.triggerEnergy') && state.val) {
                this.setState(id, { val: false, ack: true });
                // Trigger Energy Prediction (PINN + Warmup + Ventilation)
                await this.triggerEnergyPrediction();
                return;
            }
            if (id.includes('analysis.training.triggerComfort') && state.val) {
                this.setState(id, { val: false, ack: true });
                if (this.isProVersion) {
                    try {
                        const s = await this.getStateAsync('LTM.rawEventLog');
                        if(s && s.val) {
                            const deviceMap = {};
                        if (this.config.devices) this.config.devices.forEach(d => { if (d.id && d.type) deviceMap[d.id] = d.type; });
                            pythonBridge.send(this, 'TRAIN_COMFORT', { events: JSON.parse(s.val), deviceMap: deviceMap });
                        }
                    } catch(e){}
                }
                return;
            }
            if (id.includes('analysis.training.triggerTopology') && state.val) {
                this.setState(id, { val: false, ack: true });
                topology.updateTopology(this);
                if (this.isProVersion) {
                    try {
                        const seqState = await this.getStateAsync('LTM.trainingData.sequences');
                        if (seqState && seqState.val) pythonBridge.send(this, 'TRAIN_TOPOLOGY', { sequences: JSON.parse(seqState.val) });
                    } catch(e) {}
                }
                return;
            }
        }

        const dev = (this.config.devices || []).find(d => d.id === id);
        if (dev) {
            const evt = await recorder.processSensorEvent(this, id, state, dev);
            if (evt) {
                this.setState('analysis.visualization.pulse', { val: Date.now(), ack: true });
            }
            if (evt && (evt.type === 'motion' || evt.type === 'presence_radar_bool') && evt.location && this.isProVersion) {
                deadMan.updateLocation(this, evt.location);
            }
            if (isActiveValue(state.val)) {
                if (dev.type && (dev.type === 'window' || dev.type === 'door' || dev.type === 'fenster' || dev.type === 'tur' || dev.type === 'contact' || dev.type === 'kontakt')) {
                    this.analyzeWindowOpening(dev);
                }
            }
            if (dev.type === 'temperature' || dev.type === 'thermostat') {
                if (this.activeModules.energy) automation.cleanupGhostInterventions(this);
            }
            // Raeumliche Unmoeglichkeits-Heuristik: nur steigende Flanken person-relevanter Sensoren
            // isPersonPresenceActivity = strikte Whitelist: Bewegung, Praesenz, Vibration, Tuer/Fenster
            if (dev.location && recorder.isPersonPresenceActivity(dev.type, state.val)) {
                if (!this.sensorLastActive) this.sensorLastActive = {};
                this.sensorLastActive[id] = Date.now();
                var _sLog = { ts: Date.now(), sensorId: id, sensorName: dev.name || id, room: dev.location, type: dev.type };
                this.setStateAsync('system.personCount.sensorActivity', { val: JSON.stringify(_sLog), ack: true }).catch(function(){});
                this._checkSpatialImpossibility(id, dev.location);
            }
        }
    }

    // BFS: k?rzester Pfad in Hops zwischen zwei R?umen (?ber Topologie-Matrix)
    _roomHopDistance(roomA, roomB) {
        if (roomA === roomB) return 0;
        var topo = this._cachedTopoMatrix;
        if (!topo || !topo.rooms || !topo.matrix) return -1;
        var rooms = topo.rooms;
        var matrix = topo.matrix;
        var idxA = rooms.indexOf(roomA);
        var idxB = rooms.indexOf(roomB);
        if (idxA < 0 || idxB < 0) return -1;
        var visited = {};
        visited[idxA] = true;
        var queue = [[idxA, 0]];
        while (queue.length > 0) {
            var item = queue.shift();
            var curr = item[0]; var dist = item[1];
            for (var i = 0; i < rooms.length; i++) {
                if (!visited[i] && matrix[curr] && matrix[curr][i] > 0) {
                    if (i === idxB) return dist + 1;
                    visited[i] = true;
                    queue.push([i, dist + 1]);
                }
            }
        }
        return -1; // keine Verbindung gefunden
    }

    _checkSpatialImpossibility(triggerId, triggerLocation) {
        // Topologie asynchron laden beim ersten Aufruf
        if (!this._cachedTopoMatrix) {
            this.getStateAsync('analysis.topology.structure').then((s) => {
                if (s && s.val) { try { this._cachedTopoMatrix = JSON.parse(s.val); } catch(e) {} }
            }).catch(function(){});
            return;
        }
        var topo = this._cachedTopoMatrix;
        if (!topo || !topo.rooms || !topo.matrix) return;

        // Festes 5s-Fenster auf steigende Flanken (sensorLastActive) ? kein fallendes Flanken-Problem
        var ACTIVE_WINDOW_MS = 5000;
        // Mindestens 2 Hops: in 5s physikalisch unm?glich f?r eine Person
        var MIN_HOPS = 2;
        var now = Date.now();
        var _self = this;
        var devicesById = {};
        (this.config.devices || []).forEach(function(d) { if (d.id) devicesById[d.id] = d; });

        var multiPersonDetected = false;
        var bestMatch = null; // bester Treffer fuer Log (meiste Hops)
        Object.keys(this.sensorLastActive || {}).forEach(function(otherId) {
            if (otherId === triggerId) return;
            var lastActiveTs = _self.sensorLastActive[otherId];
            if (!lastActiveTs || (now - lastActiveTs) > ACTIVE_WINDOW_MS) return;
            var otherDev = devicesById[otherId];
            if (!otherDev || !otherDev.location || otherDev.location === triggerLocation) return;
            var hopDist = _self._roomHopDistance(triggerLocation, otherDev.location);
            if (hopDist >= MIN_HOPS) {
                multiPersonDetected = true;
                var deltaMs = Math.round(now - lastActiveTs);
                _self.log.info('[PersonCount] Rauml. Unmoglichkeit: ' + triggerLocation + ' <-> ' + otherDev.location +
                    ' (' + hopDist + ' Hops, ' + deltaMs + 'ms) -> mind. 2 Personen');
                // Besten Treffer merken (meiste Hops = zuverlaessigste Erkennung)
                if (!bestMatch || hopDist > bestMatch.hops) {
                    var triggerDev = devicesById[triggerId];
                    bestMatch = {
                        ts:                now,
                        triggerSensorId:   triggerId,
                        triggerSensorName: triggerDev ? (triggerDev.name || triggerId) : triggerId,
                        triggerRoom:       triggerLocation,
                        otherSensorId:     otherId,
                        otherSensorName:   otherDev.name || otherId,
                        otherRoom:         otherDev.location,
                        hops:              hopDist,
                        deltaMs:           deltaMs
                    };
                }
            }
        });

        if (multiPersonDetected && bestMatch) {
            var prevCount = this._livePersonCount || 1;
            bestMatch.personCountBefore = prevCount;
            bestMatch.personCountAfter  = 2;
            // State schreiben -> SQL-Adapter loggt jeden Wert-Wechsel automatisch
            this.setStateAsync('system.personCount.heuristicDetection', { val: JSON.stringify(bestMatch), ack: true }).catch(function(){});

            if (prevCount < 2) {
                this._livePersonCount = 2;
                if (!this._maxPersonsToday || this._maxPersonsToday < 2) this._maxPersonsToday = 2;
                this.setStateAsync('system.currentPersonCount', { val: 2, ack: true }).catch(function(){});
                this.setStateAsync('system.householdType', { val: 'multi', ack: true }).catch(function(){});
            }
            if (this._multiPersonResetTimer) clearTimeout(this._multiPersonResetTimer);
            var _cfg = this.config.householdSize || 'single';
            var _baseCount = _cfg === 'single' ? 1 : _cfg === 'couple' ? 2 : 3;
            var _baseHT = _baseCount >= 2 ? 'multi' : 'single';
            this._multiPersonResetTimer = setTimeout(function() {
                _self._livePersonCount = _baseCount;
                _self.setStateAsync('system.currentPersonCount', { val: _baseCount, ack: true }).catch(function(){});
                _self.setStateAsync('system.householdType', { val: _baseHT, ack: true }).catch(function(){});
                _self.log.info('[PersonCount] Reset auf Config-Baseline: ' + _cfg);
            }, 60 * 60 * 1000); // 1 Stunde
        }
    }

    async protectAiMemory(newSourcesJson) {
        if (!this.memoryCache || (Date.now() - this.bootTime > 300000)) return;
        try {
            const newSources = JSON.parse(newSourcesJson);
            const oldSources = this.memoryCache.sources;
            let restoreNeeded = false;
            for (const room in oldSources) {
                if (oldSources[room].includes('AI') && newSources[room] && !newSources[room].includes('AI')) { restoreNeeded = true; break; }
            }
            if (restoreNeeded) {
                await this.setStateAsync('analysis.energy.warmupTimes', { val: JSON.stringify(this.memoryCache.times), ack: true });
                await this.setStateAsync('analysis.energy.warmupSources', { val: JSON.stringify(this.memoryCache.sources), ack: true });
            }
        } catch(e) {}
    }

    async loadSystemMode() { try { const state = await this.getStateAsync(setup.SYSTEM_DP_MODE); if (state && state.val) this.currentSystemMode = state.val; } catch (e) { this.currentSystemMode = setup.SYSTEM_MODES.NORMAL; } }
    async checkWifiPresence() {
        const presenceDevices = this.config.presenceDevices || [];
        if (presenceDevices.length === 0) return false;

        const presentPeople = [];
        const now = Date.now();
        const TIMEOUT_MS = 5 * 60 * 1000; // 5 Minuten

        for (const deviceId of presenceDevices) {
            try {
                // Versuche verschiedene States zu finden: isOnline, last_seen, uptime, etc.
                let isOnline = false;
                
                // 1. Pr?fe isOnline State
                try {
                    const onlineState = await this.getForeignStateAsync(`${deviceId}.isOnline`);
                    if (onlineState && onlineState.val === true) isOnline = true;
                } catch(e) {}

                // 2. Pr?fe last_seen Timestamp (falls vorhanden)
                if (!isOnline) {
                    try {
                        const lastSeenState = await this.getForeignStateAsync(`${deviceId}.last_seen`);
                        if (lastSeenState && lastSeenState.ts) {
                            const diffMs = now - lastSeenState.ts;
                            if (diffMs < TIMEOUT_MS) isOnline = true;
                        }
                    } catch(e) {}
                }

                // 3. Pr?fe uptime (falls vorhanden)
                if (!isOnline) {
                    try {
                        const uptimeState = await this.getForeignStateAsync(`${deviceId}.uptime`);
                        if (uptimeState && typeof uptimeState.val === 'number' && uptimeState.val > 0) isOnline = true;
                    } catch(e) {}
                }

                // 4. Fallback: Pr?fe State selbst (manche Adapter haben nur den Hauptstate)
                if (!isOnline) {
                    try {
                        const mainState = await this.getForeignStateAsync(deviceId);
                        if (mainState) {
                            // Pr?fe Timestamp des States
                            const diffMs = now - (mainState.ts || 0);
                            if (diffMs < TIMEOUT_MS && (mainState.val === true || mainState.val === 'online' || mainState.val === 1)) {
                                isOnline = true;
                            }
                        }
                    } catch(e) {}
                }

                if (isOnline) {
                    // Extrahiere Namen aus Device-ID (z.B. "alias.0.Smartphone.Marc" -> "Marc")
                    const parts = deviceId.split('.');
                    const name = parts[parts.length - 1] || deviceId;
                    presentPeople.push(name);
                }
            } catch(e) {
                this.log.warn(`checkWifiPresence: Error checking ${deviceId}: ${e.message}`);
            }
        }

        // Aktualisiere presenceWho State
        const presenceWho = presentPeople.length > 0 ? presentPeople.join(', ') : 'Niemand';
        await this.setStateAsync('system.presenceWho', { val: presenceWho, ack: true });

        return presentPeople.length > 0;
    }
    async runAutopilot() { await aiAgent.runGeminiAnalysis(this); if(this.activeModules.health) { this.updateHealthVector(); this.triggerGaitAnalysis(); } if(this.activeModules.energy) this.triggerEnergyPrediction(); }
    async checkSolarCondition() {
        // Pr?ft verschiedene Wetter-Adapter auf sonniges Wetter
        const weatherAdapters = ['weatherunderground.0', 'accuweather.0', 'daswetter.0'];
        const weatherPaths = ['forecast.current.weather', 'Current.WeatherText', 'NextHours.Location_1.Day_1.current.symbol_desc'];
        
        for (const adapter of weatherAdapters) {
            for (const path of weatherPaths) {
                try {
                    const stateId = `${adapter}.${path}`;
                    const state = await this.getForeignStateAsync(stateId);
                    if (state && state.val) {
                        const text = String(state.val).toLowerCase();
                        // Pr?fe auf sonnige Keywords (DE + EN)
                        if (text.includes('sunny') || text.includes('heiter') || 
                            text.includes('klar') || text.includes('sonn') || 
                            text.includes('clear')) {
                            this.log.debug(`?? Solar Condition: SUNNY detected via ${stateId}`);
                            return true;
                        }
                    }
                } catch(e) {
                    // Adapter nicht vorhanden - weiter versuchen
                }
            }
        }
        return false;
    }
    triggerGaitAnalysis() {
        if (!this.isProVersion) return;
        
        // Ganganalyse basierend auf Motion-Sensor-Sequenzen
        try {
            this.getStateAsync('LTM.trainingData.sequences', (err, state) => {
                if (err || !state || !state.val) return;
                
                try {
                    const sequences = JSON.parse(state.val);
                    if (!sequences || sequences.length === 0) return;
                    
                    // Sende Sequenzen an Python f?r Ganganalyse
                    pythonBridge.send(this, 'ANALYZE_GAIT', { sequences });
                    
                    this.log.debug(`?? Gait Analysis triggered with ${sequences.length} sequences`);
                } catch(e) {
                    this.log.warn(`triggerGaitAnalysis parse error: ${e.message}`);
                }
            });
        } catch(e) {
            this.log.warn(`triggerGaitAnalysis error: ${e.message}`);
        }
    }
    async triggerEnergyPrediction() {
        if (!this.isProVersion || !this.activeModules.energy) return;
        try {
            // Sammle aktuelle Temperaturen
            const current_temps = {};
            const solar_flags = {};
            const devices = this.config.devices || [];
            
            for (const dev of devices) {
                if ((dev.type === 'temperature' || dev.type === 'thermostat') && dev.location) {
                    try {
                        const state = await this.getForeignStateAsync(dev.id);
                        if (state && typeof state.val === 'number') {
                            current_temps[dev.location] = state.val;
                            solar_flags[dev.location] = dev.isSolar || false;
                        }
                    } catch(e) {}
                }
            }

            // Au?entemperatur (falls vorhanden)
            let t_out = 10.0;
            if (this.config.weatherTempId) {
                try {
                    const wState = await this.getForeignStateAsync(this.config.weatherTempId);
                    if (wState && typeof wState.val === 'number') t_out = wState.val;
                } catch(e) {}
            }

            const is_sunny = await this.checkSolarCondition();

            // Warmup-Ziele laden
            let warmup_targets = {};
            try {
                const wt = await this.getStateAsync('analysis.energy.warmupTargets');
                if (wt && wt.val) warmup_targets = JSON.parse(wt.val);
            } catch(e) {}

            pythonBridge.send(this, 'PREDICT_ENERGY', {
                current_temps,
                t_out,
                is_sunny,
                solar_flags,
                warmup_targets
            });
            
            this.log.info(`?? Energy Prediction triggered (${Object.keys(current_temps).length} rooms)`);
        } catch(e) {
            this.log.warn(`triggerEnergyPrediction Error: ${e.message}`);
        }
    }
    updateHealthVector() {
        // Berechnet den 48-Slot Activity Vector f?r heute (00:00-23:59, 30-Min-Slots)
        if (!this.rawEventLog || this.rawEventLog.length === 0) return;

        const todayVector = new Array(48).fill(0);
        const todayDetails = Array.from({ length: 48 }, () => []);
        const todayStart = new Date().setHours(0, 0, 0, 0);

        // Z?hle Events pro 30-Min-Slot
        this.rawEventLog.forEach(entry => {
            const eventTime = new Date(entry.timestamp);
            if (eventTime.getTime() >= todayStart) {
                const hour = eventTime.getHours();
                const minute = eventTime.getMinutes();
                const slotIndex = hour * 2 + Math.floor(minute / 30);
                
                if (slotIndex >= 0 && slotIndex < 48) {
                    todayVector[slotIndex]++;
                    todayDetails[slotIndex].push({
                        time: eventTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
                        location: entry.location || 'Unbekannt',
                        type: entry.type || 'Event'
                    });
                }
            }
        });

        // Setze States
        this.setStateAsync('analysis.health.todayVector', { 
            val: JSON.stringify(todayVector), 
            ack: true 
        });
        
        this.setStateAsync('analysis.health.todayRoomDetails', { 
            val: JSON.stringify(todayDetails), 
            ack: true 
        });
    }
    async handleInfrasound(value) {
        // Verarbeitet Infraschall-Sensor-Daten f?r Anomalie-Erkennung
        if (!this.config.infrasoundEnabled || typeof value !== 'number') return;
        
        const threshold = this.config.infrasoundThreshold || 0.04;
        
        // F?ge Wert zum Buffer hinzu (f?r Korrelation mit Events)
        this.pressureBuffer.push({
            timestamp: Date.now(),
            value: value
        });
        
        // Halte Buffer klein (letzte 100 Werte = ca. 5-10 Minuten bei 5s Polling)
        if (this.pressureBuffer.length > 100) {
            this.pressureBuffer.shift();
        }
        
        // Pr?fe auf Schwellwert-?berschreitung (potenzielle Anomalie)
        if (value > threshold && !this.infrasoundLocked) {
            this.infrasoundLocked = true;
            this.log.warn(`?? Infraschall-Alarm: ${value.toFixed(4)} > ${threshold} (Threshold)`);
            
            // Trigger Korrelation mit letzten Events
            await this.triggerInfrasoundCorrelation(value, 'threshold_exceeded');
            
            // Lock f?r 5 Minuten (Spam-Schutz)
            setTimeout(() => {
                this.infrasoundLocked = false;
            }, 5 * 60 * 1000);
        }
    }
    async triggerInfrasoundCorrelation(pressure, eventType) {
        // Korreliert Infraschall-Anomalie mit letzten Events (forensische Analyse)
        if (!this.isPresent) {
            // Nur wenn niemand zuhause ist ? potenzielle Sicherheits-Anomalie!
            const recentEvents = this.eventHistory.slice(0, 10);
            const eventLog = recentEvents.map(e => 
                `${new Date(e.timestamp).toLocaleTimeString('de-DE')} - ${e.location || 'Unknown'}: ${e.name}`
            ).join('\n');
            
            this.log.warn(`?? FORENSIC: Infraschall bei Abwesenheit! Pressure: ${pressure.toFixed(4)}, Events:\n${eventLog}`);
            
            // Optional: Sende Benachrichtigung (nur bei Abwesenheit!)
            if (this.config.infrasoundArmingId) {
                try {
                    const armState = await this.getForeignStateAsync(this.config.infrasoundArmingId);
                    if (armState && armState.val === true) {
                        // System ist "scharf" ? Alarm!
                        await this.setStateAsync('analysis.safety.infrasoundAlert', {
                            val: JSON.stringify({
                                timestamp: Date.now(),
                                pressure: pressure.toFixed(4),
                                eventType: eventType,
                                recentEvents: recentEvents.slice(0, 3)
                            }),
                            ack: true
                        });
                        
                        this.log.error(`?? INFRASCHALL-ALARM: Anomalie bei Abwesenheit (scharf)!`);
                    }
                } catch(e) {}
            }
        } else {
            // Bei Anwesenheit nur Debug-Log
            this.log.debug(`?? Infraschall: ${pressure.toFixed(4)} (Bewohner anwesend - normal)`);
        }
    }
    async analyzeWindowOpening(device) {
        // Analysiert Fenster-/T?r?ffnungen f?r L?ftungsempfehlungen
        if (!device || !device.location) return;

        try {
            // Hole aktuelle Raumtemperatur
            const tempDevices = (this.config.devices || []).filter(d => 
                d.location === device.location && (d.type === 'temperature' || d.type === 'thermostat')
            );
            
            if (tempDevices.length === 0) return;
            
            const tempState = await this.getForeignStateAsync(tempDevices[0].id);
            if (!tempState || typeof tempState.val !== 'number') return;
            
            const roomTemp = tempState.val;
            
            // Hole Au?entemperatur
            let outsideTemp = null;
            if (this.config.weatherTempId) {
                const outState = await this.getForeignStateAsync(this.config.weatherTempId);
                if (outState && typeof outState.val === 'number') {
                    outsideTemp = outState.val;
                }
            }
            
            // Einfache L?ftungslogik: Wenn Au?entemperatur verf?gbar
            if (outsideTemp !== null) {
                const tempDiff = Math.abs(roomTemp - outsideTemp);
                
                // Empfehlung: L?ften wenn Temperatur-Differenz > 3?C
                if (tempDiff > 3.0) {
                    this.log.debug(`?? L?ftung in ${device.location}: Temp-Differenz ${tempDiff.toFixed(1)}?C (Innen: ${roomTemp}?C, Au?en: ${outsideTemp}?C)`);
                    
                    // Optional: State setzen f?r Benachrichtigungen
                    await this.setStateAsync('analysis.ventilation.lastWindow', {
                        val: JSON.stringify({
                            room: device.location,
                            timestamp: Date.now(),
                            tempDiff: tempDiff.toFixed(1),
                            recommendation: tempDiff > 5 ? 'Gute L?ftungsm?glichkeit!' : 'L?ften empfohlen'
                        }),
                        ack: true
                    });
                }
            }
        } catch(e) {
            this.log.warn(`analyzeWindowOpening error: ${e.message}`);
        }
    }
    async appendToLog(entry) {
        // F?gt einen Eintrag zum Event-Log hinzu (f?r manuelle Events oder externe Systeme)
        if (!entry || typeof entry !== 'object') return;
        
        const logEntry = {
            timestamp: entry.timestamp || Date.now(),
            id: entry.id || Date.now().toString(),
            name: entry.name || 'Manual Event',
            type: entry.type || 'custom',
            location: entry.location || 'Unknown',
            value: entry.value || null
        };
        
        this.eventHistory.unshift(logEntry);
        if (this.eventHistory.length > 5000) this.eventHistory.pop();
        
        // Persistiere Event History
        await this.setStateAsync('events.history', { 
            val: JSON.stringify(this.eventHistory), 
            ack: true 
        });
        
        this.log.debug(`?? Manual event logged: ${logEntry.name} (${logEntry.location})`);
    }
    sendNotification(message) { /* ... */ }
}

if (require.main !== module) module.exports = (options) => new CogniLiving(options);
else new CogniLiving();


