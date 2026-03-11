'use strict';

/**
 * AI AGENT (GEMINI) - v0.30.13 (Feature: Health Reports Night/Day)
 * Handhabt die Interaktion mit dem LLM und schützt vor Rate-Limits.
 */


const { GoogleGenerativeAI } = require('@google/generative-ai');
const setup = require('./setup');

const GEMINI_MODEL = 'models/gemini-flash-latest';
const LTM_DP_DAILY_DIGESTS = 'LTM.dailyDigests';
const LTM_DP_STATUS = 'LTM.processingStatus';
const LTM_DP_RAW_LOG = 'LTM.rawEventLog';
const LTM_MIN_EVENTS_FOR_COMPRESSION = 5;

// --- TRAFFIC CONTROL ---
const MIN_API_GAP_MS = 20000;
let lastGlobalApiCall = 0;
const decisionCache = {};
const CACHE_TTL_MS = 15 * 60 * 1000;

const PERSONA_MAPPING = {
    generic: 'Entscheide ausgewogen zwischen Komfort und Energie.',
    senior_aal: 'PRIORITÄT: Sicherheit und Licht. Schalte lieber einmal zu viel als zu wenig.',
    family: 'Fokus auf Komfort für die Familie.',
    single_comfort: 'Maximaler Komfort, Energie ist zweitrangig.',
    security: 'Sicherheit geht vor.',
    energy_saver: 'PRIORITÄT: Energie sparen. Schalte nur, wenn absolut notwendig (Dunkelheit).'
};

function canCallApi() {
    const now = Date.now();
    return (now - lastGlobalApiCall) > MIN_API_GAP_MS;
}

function updateApiTimestamp() {
    lastGlobalApiCall = Date.now();
}

async function getWeatherContext(adapter) {
    if (!adapter.config.useWeather || !adapter.config.weatherInstance) return "Unbekannt (Kein Sensor)";
    try {
        const inst = adapter.config.weatherInstance;
        let temp = await adapter.getForeignStateAsync(`${inst}.Current.Temperature`);
        if(!temp) temp = await adapter.getForeignStateAsync(`${inst}.forecast.current.temperature`);

        let desc = await adapter.getForeignStateAsync(`${inst}.Current.WeatherText`);
        if(!desc) desc = await adapter.getForeignStateAsync(`${inst}.forecast.current.state`);

        let light = "Unbekannt";
        const isNight = await adapter.getForeignStateAsync(`${inst}.Current.IsNight`);
        if (isNight) light = isNight.val ? "Nacht" : "Tag";

        if(temp && desc) return `${temp.val}°C, ${desc.val}, Lichtverhältnisse: ${light}`;
    } catch(e) {}
    return "Wetterdaten nicht abrufbar";
}

async function consultButler(adapter, targetRoom, deviceName, confidence) {
    if (!adapter.geminiModel) return { approved: true, reason: "KI offline (Fallback)" };

    const now = Date.now();
    if (decisionCache[targetRoom] && (now - decisionCache[targetRoom].timestamp < CACHE_TTL_MS)) {
        const cached = decisionCache[targetRoom].decision;
        adapter.log.debug(`🤖 Butler Cache Hit: ${targetRoom} -> ${cached.approved ? 'OK' : 'NO'} (${cached.reason})`);
        return cached;
    }

    if (!canCallApi()) {
        adapter.log.debug(`🤖 Traffic Schutz: Anfrage für ${targetRoom} übersprungen (Auto-Approved).`);
        return { approved: true, reason: "Traffic-Schutz (Auto-Approved)" };
    }

    const time = new Date().toLocaleTimeString();
    const weather = await getWeatherContext(adapter);
    const persona = PERSONA_MAPPING[adapter.config.aiPersona || 'generic'];

    const prompt = `
    ROLLE: Haus-Butler.
    SITUATION: ${time}, Wetter: ${weather}.
    EVENT: Bewohner geht wahrscheinlich (${(confidence*100).toFixed(0)}%) nach "${targetRoom}".
    AKTION: Schalte "${deviceName}" AN.
    STRATEGIE: ${persona}
    FRAGE: Ist es dunkel genug für Licht?
    FORMAT: { "approved": boolean, "reason": "kurzer Grund" }
    `;

    try {
        updateApiTimestamp();
        const result = await adapter.geminiModel.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, '').trim();
        const json = JSON.parse(text);
        decisionCache[targetRoom] = { decision: json, timestamp: now };
        return json;
    } catch (e) {
        adapter.log.warn(`🤖 Butler Brain Error: ${e.message}`);
        decisionCache[targetRoom] = {
            decision: { approved: true, reason: "KI-Fehler (Fallback)" },
            timestamp: now - (CACHE_TTL_MS - 60000)
        };
        return { approved: true, reason: "KI-Fehler (Fallback)" };
    }
}

async function runGeminiAnalysis(adapter, emergencyContext = "") {
    if (!adapter.geminiModel) return;
    if (!canCallApi()) {
        adapter.log.debug("🤖 Autopilot skipped (Traffic Protection active).");
        return;
    }

    if (adapter.eventHistory.length === 0) return;
    const events = adapter.eventHistory.slice(0, 15);
    const mode = adapter.currentSystemMode;
    const persona = PERSONA_MAPPING[adapter.config.aiPersona || 'generic'];
    const livingContext = adapter.config.livingContext || "Keine Details.";
    let presenceWho = 'Unbekannt';
    try { const p = await adapter.getStateAsync('system.presenceWho'); if(p && p.val) presenceWho = p.val; } catch(e){}
    let autoApply = false;
    try { const s = await adapter.getStateAsync('analysis.automation.autoApply'); if (s && s.val) autoApply = true; } catch(e) {}

    const prompt = `ROLLE: KI-Hausverwalter. PERSONA: ${persona}. KONTEXT: ${livingContext}. SYSTEM_MODE: ${mode}. ANWESEND: ${presenceWho}. EVENTS: ${JSON.stringify(events)}. EMERGENCY: ${emergencyContext}. AUFGABE: 1. Gesundheit? 2. Komfort? FORMAT (JSON): { "isAlert": boolean, "alertReason": "string", "isEmergency": boolean, "summary": "string", "automationProposal": { "detected": boolean, "description": "string", "targetId": "string", "targetValue": "any" } }`;

    try {
        updateApiTimestamp();
        const result = await adapter.geminiModel.generateContent(prompt);
        const json = JSON.parse(result.response.text().replace(/```json|```/g, '').trim());
        await adapter.setStateAsync('analysis.lastResult', { val: JSON.stringify(json), ack: true });
        if (json.summary) await adapter.setStateAsync('analysis.activitySummary', { val: json.summary, ack: true });

        const historyEntry = { timestamp: Date.now(), id: Date.now().toString(), analysis: { activity: { summary: json.summary, isAlert: json.isAlert, alertReason: json.alertReason }, comfort: { automationProposal: json.automationProposal } } };
        adapter.analysisHistory.unshift(historyEntry);
        if (adapter.analysisHistory.length > 50) adapter.analysisHistory.pop();
        await adapter.setStateAsync('analysis.analysisHistory', { val: JSON.stringify(adapter.analysisHistory), ack: true });

        const currentAlertState = json.isAlert || false;
        if (currentAlertState !== adapter.lastAlertState) {
            await adapter.setStateAsync('analysis.isAlert', { val: currentAlertState, ack: true });
            adapter.lastAlertState = currentAlertState;
            if (currentAlertState) {
                await adapter.setStateAsync('analysis.alertReason', { val: json.alertReason, ack: true });
                setup.sendNotification(adapter, `⚠️ ALARM: ${json.alertReason}`, false, json.isEmergency);
            }
        }
        if (json.automationProposal && json.automationProposal.detected) {
            await adapter.setStateAsync('analysis.automation.patternDetected', { val: true, ack: true });
            await adapter.setStateAsync('analysis.automation.description', { val: json.automationProposal.description, ack: true });
            await adapter.setStateAsync('analysis.automation.targetId', { val: json.automationProposal.targetId, ack: true });
            await adapter.setStateAsync('analysis.automation.targetValue', { val: JSON.stringify(json.automationProposal.targetValue), ack: true });
            if (autoApply) executeAutomationAction(adapter);
        }
    } catch (e) { adapter.log.error(`Gemini Error: ${e.message}`); }
}

async function createDailyDigest(adapter, pythonBridge) {
    if (!adapter.isProVersion) return;

    if (!canCallApi()) {
        await adapter.setStateAsync(LTM_DP_STATUS, { val: 'Skipped (Traffic)', ack: true });
        return;
    }

    await adapter.setStateAsync(LTM_DP_STATUS, { val: `Started...`, ack: true });
    if (!adapter.geminiModel || adapter.rawEventLog.length < LTM_MIN_EVENTS_FOR_COMPRESSION) {
        await adapter.setStateAsync(LTM_DP_STATUS, { val: 'Skipped (No AI or Data)', ack: true });
        return;
    }
    const data = JSON.parse(JSON.stringify(adapter.rawEventLog));
    const count = data.length;
    const prompt = `ROLLE: Data Compression Agent. SPRACHE: DE. FORMAT: JSON. ANWEISUNG: Fasse Sensor-Events zusammen. SCHEMA: { "summary": "string", "activityLevel": "string" } \n\nEVENTS:\n${JSON.stringify(data)}`;
    try {
        updateApiTimestamp();
        const res = await adapter.geminiModel.generateContent(prompt);
        const json = JSON.parse(res.response.text().replace(/```json|```/g, '').trim());
        const newDigest = { timestamp: new Date().toISOString(), eventCount: count, summary: json.summary || "Digest", activityLevel: json.activityLevel || "normal", systemMode: adapter.currentSystemMode };
        adapter.dailyDigests.push(newDigest);
        const max = adapter.config.ltmLtbWindowDays || 60;
        if(adapter.dailyDigests.length > max) { adapter.dailyDigests.splice(0, adapter.dailyDigests.length - max); }
        await adapter.setStateAsync(LTM_DP_DAILY_DIGESTS, { val: JSON.stringify(adapter.dailyDigests), ack: true });
        adapter.rawEventLog = [];
        await adapter.setStateAsync(LTM_DP_RAW_LOG, { val: JSON.stringify(adapter.rawEventLog), ack: true });
        await adapter.setStateAsync(LTM_DP_STATUS, { val: `Success`, ack: true });

        adapter.log.info(`[LTM] Daily Digest erstellt: ${json.activityLevel} (${count} Events)`);

        if (adapter.isProVersion && pythonBridge) pythonBridge.send(adapter, 'ANALYZE_HEALTH', { digest: newDigest });
    } catch(e) { adapter.log.error(e.message); }
}

async function runBaselineDriftAnalysis(adapter) {
    if (!adapter.isProVersion || !adapter.geminiModel) return;
    if (!canCallApi()) return;

    const stb = adapter.config.ltmStbWindowDays || 14;
    if (adapter.dailyDigests.length < stb + 7) { await adapter.setStateAsync('LTM.driftAnalysis.baselineDrift', { val: 'N/A (Learning)', ack: true }); return; }
    const stbData = adapter.dailyDigests.slice(-stb);
    const ltbData = adapter.dailyDigests.slice(0, adapter.dailyDigests.length - stb);
    const prompt = `ROLLE: Data Scientist. ZIEL: Drift erkennen. SCHEMA: { "baselineDrift": "none|slight|significant|critical", "driftDetails": "string" }\n\nLTB: ${JSON.stringify(ltbData)}\nSTB: ${JSON.stringify(stbData)}`;
    try {
        updateApiTimestamp();
        const res = await adapter.geminiModel.generateContent(prompt);
        const json = JSON.parse(res.response.text().replace(/```json|```/g, '').trim());
        if(json.baselineDrift) {
            await adapter.setStateAsync('LTM.driftAnalysis.baselineDrift', { val: json.baselineDrift, ack: true });
            await adapter.setStateAsync('LTM.driftAnalysis.driftDetails', { val: json.driftDetails, ack: true });
            await adapter.setStateAsync('LTM.driftAnalysis.lastCheck', { val: Date.now(), ack: true });
        }
    } catch(e) {}
}

async function executeAutomationAction(adapter) { try { const idState = await adapter.getStateAsync('analysis.automation.targetId'); const valState = await adapter.getStateAsync('analysis.automation.targetValue'); if (idState && idState.val && valState) { const targetId = idState.val; let targetVal = valState.val; try { targetVal = JSON.parse(targetVal); } catch(e) {} adapter.log.info(`🤖 BUTLER: Executing Action -> ${targetId} = ${targetVal}`); await adapter.setForeignStateAsync(targetId, targetVal); } else { adapter.log.warn('🤖 BUTLER: No valid target ID or value stored for execution.'); } } catch (e) { adapter.log.error(`BUTLER Execution Error: ${e.message}`); } }

async function sendMorningBriefing(adapter) {
    if(!adapter.geminiModel) {
        adapter.log.warn('🤖 Morning Briefing skipped: No Gemini Model.');
        return;
    }
    adapter.log.info('🌅 Starting Morning Briefing sequence (Traffic Check bypassed)...');
    try {
        updateApiTimestamp();
        const prompt = "Erstelle ein kurzes 'Guten Morgen' Briefing basierend auf den Events der letzten Nacht. Antworte auf Deutsch, maximal 3 Sätze.";
        const result = await adapter.geminiModel.generateContent(prompt);
        const text = result.response.text().replace(/^[Aa]nalyse[^:]*:/i, '').trim();
        adapter.log.info(`🌅 Briefing generated (Length: ${text.length}). Sending notification...`);

        // Wochenaktivität als Sparkline berechnen
        let sparkline = '';
        try {
            const { generateSparkline } = require('./notifications');
            const weekVals = [];
            const dataDir = adapter._historyDir || '';
            const fs = require('fs');
            const path = require('path');
            for (let i = 6; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().slice(0, 10);
                const filePath = path.join(dataDir, `${dateStr}.json`);
                if (fs.existsSync(filePath)) {
                    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    const vec = content.todayVector || [];
                    const total = Array.isArray(vec) ? vec.reduce((a, b) => a + b, 0) : 0;
                    weekVals.push(total > 0 ? Math.min(100, Math.round((total / Math.max(1, vec.length * 5)) * 100)) : 0);
                } else { weekVals.push(0); }
            }
            if (weekVals.some(v => v > 0)) sparkline = `\n📈 Wochentrend: ${generateSparkline(weekVals)}`;
        } catch(e) {}

        const fullMsg = `${text}${sparkline}`;
        setup.sendNotification(adapter, fullMsg, false, false, '🌅 NUUKANNI: Guten Morgen');
    } catch(e) {
        adapter.log.error("Briefing Error: " + e.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// WOCHENBERICHT — Jeden Sonntag: Zusammenfassung der letzten 7 Tage
// ─────────────────────────────────────────────────────────────────────────────
async function sendWeeklyBriefing(adapter) {
    if (!adapter.config.weeklyBriefingEnabled) return;

    const fs   = require('fs');
    const path = require('path');
    const { generateSparkline } = require('./notifications');

    const dataDir = adapter._historyDir || '';
    if (!dataDir) { adapter.log.warn('[WeeklyBriefing] _historyDir nicht gesetzt – abgebrochen.'); return; }

    const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

    // Letzte 14 Tage laden (7 = aktuelle Woche, 7 = Vorwoche für Vergleich)
    const days = [];
    for (let i = 1; i <= 14; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const filePath = path.join(dataDir, `${dateStr}.json`);
        if (fs.existsSync(filePath)) {
            try { days.push({ dateStr, dayOffset: i, ...JSON.parse(fs.readFileSync(filePath, 'utf8')) }); }
            catch(e) { days.push({ dateStr, dayOffset: i, missing: true }); }
        } else {
            days.push({ dateStr, dayOffset: i, missing: true });
        }
    }

    const thisWeek = days.filter(d => d.dayOffset <= 7 && !d.missing);
    const lastWeek = days.filter(d => d.dayOffset >  7 && !d.missing);

    if (thisWeek.length < 3) {
        adapter.log.warn(`[WeeklyBriefing] Nicht genug Daten (${thisWeek.length}/7 Tage). Mindestens 3 benötigt.`);
        return;
    }

    // Hilfsfunktion: Summe des Aktivitätsvektors
    const actTotal = d => Array.isArray(d.todayVector) ? d.todayVector.reduce((a, b) => a + b, 0) : 0;

    // ── Aktivität ──
    const thisActValues  = thisWeek.map(actTotal);
    const lastActValues  = lastWeek.map(actTotal);
    const avgAct         = thisActValues.reduce((a, b) => a + b, 0) / thisActValues.length;
    const avgLastAct     = lastActValues.length > 0 ? lastActValues.reduce((a, b) => a + b, 0) / lastActValues.length : avgAct;
    const actChange      = avgLastAct > 0 ? Math.round(((avgAct - avgLastAct) / avgLastAct) * 100) : 0;
    const actChangeStr   = actChange >  5 ? `▲ +${actChange}% vs. Vorwoche`
                         : actChange < -5 ? `▼ ${actChange}% vs. Vorwoche`
                         : '→ stabil';

    // ── Ganggeschwindigkeit ──
    const gaitVals     = thisWeek.filter(d => d.gaitSpeed > 0 && d.gaitSpeed < 60).map(d => d.gaitSpeed);
    const lastGaitVals = lastWeek.filter(d => d.gaitSpeed > 0 && d.gaitSpeed < 60).map(d => d.gaitSpeed);
    const gaitAvg      = gaitVals.length > 0 ? (gaitVals.reduce((a, b) => a + b, 0) / gaitVals.length) : null;
    const lastGaitAvg  = lastGaitVals.length > 0 ? lastGaitVals.reduce((a, b) => a + b, 0) / lastGaitVals.length : null;
    let gaitStr = gaitAvg ? `Ø ${gaitAvg.toFixed(1)} Sek.` : null;
    if (gaitAvg && lastGaitAvg) {
        const diff = gaitAvg - lastGaitAvg;
        gaitStr += diff >  0.5 ? ' ▲ langsamer als Vorwoche'
                 : diff < -0.5 ? ' ▼ schneller als Vorwoche'
                 : ' → stabil';
    }

    // ── Frischluft ──
    const freshVals = thisWeek.map(d => d.freshAirCount || d.windowOpenings || 0);
    const freshAvg  = freshVals.length > 0 ? Math.round(freshVals.reduce((a, b) => a + b, 0) / freshVals.length) : null;

    // ── Nacht-Unruhe ──
    const nightVals = thisWeek.map(d => {
        if (d.nightMotionCount !== undefined) return d.nightMotionCount;
        if (Array.isArray(d.eventHistory)) {
            return d.eventHistory.filter(e => {
                const h = new Date(e.timestamp || e.ts || 0).getHours();
                return h >= 22 || h < 6;
            }).length;
        }
        return 0;
    });
    const avgNight = Math.round(nightVals.reduce((a, b) => a + b, 0) / nightVals.length);

    // ── Bad-Nutzung ──
    const bathroomVals = thisWeek.map(d => {
        if (d.bathroomMinutes !== undefined && d.bathroomMinutes > 0) return d.bathroomMinutes;
        if (d.todayRoomMinutes) {
            return Object.entries(d.todayRoomMinutes)
                .filter(([k]) => /bad|wc|toilet/i.test(k))
                .reduce((sum, [, v]) => sum + v, 0);
        }
        return 0;
    });
    const avgBathroom = Math.round(bathroomVals.reduce((a, b) => a + b, 0) / bathroomVals.length);

    // ── Auffällige Tage (Aktivität < 50% des Wochenschnitts) ──
    const lowDays = thisWeek
        .filter(d => actTotal(d) < avgAct * 0.5)
        .map(d => WEEKDAYS[new Date(d.dateStr + 'T12:00:00').getDay()])
        .join(', ');

    // ── Sparkline (Mo–So) ──
    const sparkVals = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - 1 - i);
        const ds = d.toISOString().slice(0, 10);
        const found = thisWeek.find(x => x.dateStr === ds);
        sparkVals.push(found ? Math.min(100, Math.round((actTotal(found) / Math.max(1, avgAct)) * 100)) : 0);
    }
    const sparkline = generateSparkline(sparkVals);

    // ── Kalenderwoche ──
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const kw = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);

    // ── Nachricht bauen ──
    let msg = `📅 WOCHENBERICHT KW ${kw}\n`;
    msg += `📈 ${sparkline} (Mo–So)\n\n`;
    msg += `🏃 Aktivität: ${actChangeStr}\n`;
    msg += `😴 Nacht-Unruhe: Ø ${avgNight} Ereignisse/Nacht\n`;
    if (gaitStr)           msg += `🚶 Ganggeschwindigkeit: ${gaitStr}\n`;
    if (freshAvg !== null) msg += `🪟 Gelüftet: Ø ${freshAvg}× täglich\n`;
    if (avgBathroom > 0)   msg += `🚿 Bad-Nutzung: Ø ${avgBathroom} Min./Tag\n`;
    if (lowDays)           msg += `\n⚠️ Wenig Aktivität: ${lowDays}`;

    setup.sendNotification(adapter, msg.trim(), false, false, '📅 NUUKANNI: Wochenbericht');
    adapter.log.info(`[WeeklyBriefing] Wochenbericht KW ${kw} gesendet (${thisWeek.length} Tage Datenbasis).`);
}

// Dynamischer Tagesbeginn: erste Bewegung nach 05:00 aus einem Nicht-Nacht-Sensor-Raum
// Fallback: 08:00 Uhr (hartkodiert als Minimum)
function getDayStartTime(adapter, nowObj) {
    const nightSensorLocations = new Set(
        (adapter.config?.devices || [])
            .filter(d => d.isNightSensor)
            .map(d => (d.location || '').toLowerCase().trim())
    );

    // Frühestes mögliches Tagbeginn-Fenster: 05:00 Uhr heute
    const earliest = new Date(nowObj);
    earliest.setHours(5, 0, 0, 0);
    const earliestTs = earliest.getTime();

    // Spätestes Fallback: 08:00 Uhr heute
    const fallback = new Date(nowObj);
    fallback.setHours(8, 0, 0, 0);
    const fallbackTs = fallback.getTime();

    // Suche erstes Event nach 05:00 aus einem Nicht-Nacht-Sensor-Raum
    const events = adapter.eventHistory || [];
    for (const e of events) {
        if (e.timestamp < earliestTs) continue;
        const room = (e.room || e.location || '').toLowerCase().trim();
        if (room && nightSensorLocations.has(room)) continue; // Nacht-Sensor → überspringen
        // Gültiges Tages-Event gefunden
        // Gueltiges Tages-Event - cap bei 08:00 (Tag startet nie nach 08:00)
        return Math.min(e.timestamp, fallbackTs);
    }

    // Kein passendes Event → Fallback 08:00
    return fallbackTs;
}

// --- NEW: TARGETED HEALTH REPORTS (Sohn-Check) ---
async function generateHealthReport(adapter, reportType) {
    if (!adapter.geminiModel) return;

    // Wir umgehen den Traffic Check für manuelle Anfragen ("System prüfen"),
    // aber bremsen leicht (3s), falls viele Requests kommen.
    const now = Date.now();
    if (now - lastGlobalApiCall < 3000) {
        adapter.log.debug(`🤖 API Cooldown. Waiting 2s...`);
        await new Promise(r => setTimeout(r, 2000));
    }

    const nowObj = new Date();
    let startTime = 0;
    let endTime = nowObj.getTime();
    let promptTask = "";

    if (reportType === 'NIGHT') {
        // Nacht = Gestern 22:00 bis Heute 08:00
        const yesterday = new Date(nowObj);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(22, 0, 0, 0);
        startTime = yesterday.getTime();

        const todayEight = new Date(nowObj);
        todayEight.setHours(8, 0, 0, 0);
        endTime = todayEight.getTime();

        promptTask = "Analysiere diese Events der NACHT (22:00-08:00). War der Schlaf ruhig? Gab es Badgänge? Schreibe den Bericht über die Person direkt (nutze den Namen aus dem Kontext, nie 'Ihre Mutter' oder 'der Bewohner'). Max 2 Sätze, Fließtext.";
    }
    else {
        // Tag = Heute — dynamischer Beginn (erste Bewegung nach 05:00 außerhalb Nacht-Sensoren)
        startTime = getDayStartTime(adapter, nowObj);
        const startHour = new Date(startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        const minutesSinceStart = Math.round((nowObj.getTime() - startTime) / 60000);

        // Wenn der Tag gerade erst begonnen hat (< 30 Min), keinen Bericht generieren
        if (minutesSinceStart < 30) {
            const txt = `Tag hat gerade begonnen um \ Uhr. Erst \ Minuten Daten verf\u00fcgbar \u2014 Bericht folgt sp\u00e4ter.`;
            await adapter.setStateAsync('analysis.health.geminiDay', { val: txt, ack: true });
            return;
        }

        promptTask = `Analysiere diese Events des TAGES (ab \ Uhr, Beobachtungszeitraum: \ Minuten). Aktivit\u00e4t? Mahlzeiten? Haust\u00fcr? Schreibe den Bericht \u00fcber die Person direkt (nutze den Namen aus dem Kontext, nie 'Ihre Mutter' oder 'der Bewohner'). Max 2 S\u00e4tze, Flie\u00dftext.`;
    }

    // Filter Events
    const relevantEvents = adapter.eventHistory.filter(e => e.timestamp >= startTime && e.timestamp <= endTime);

    // Optimization: If no events, standard text
    if (relevantEvents.length === 0) {
        const txt = reportType === 'NIGHT' ? "Keine Daten für die Nacht aufgezeichnet (Sensoren ruhig)." : "Noch keine Tagesaktivit\u00e4t aufgezeichnet.";
        const dp = reportType === 'NIGHT' ? 'analysis.health.geminiNight' : 'analysis.health.geminiDay';
        await adapter.setStateAsync(dp, { val: txt, ack: true });
        return;
    }

    // Limit Token (nur wichtigste Events, Zeitstempel lesbar machen)
    const eventLog = relevantEvents.map(e => `${new Date(e.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} ${e.name} (${e.value})`).join('\n');

    // Nutzerprofil aus Konfiguration lesen
    const userContext = adapter.config?.livingContext || 'Nutzerprofil nicht konfiguriert. Bitte unter System → Reporting & Kontext beschreiben.';

    const prompt = `
ROLLE: Gesundheits-Assistent für Smart Home Monitoring.
NUTZERPROFIL: ${userContext}
AUFGABE: ${promptTask}
EVENTS:
${eventLog}
WICHTIG: Antworte NUR als Fließtext. KEIN JSON, keine Klammern, keine Keys. Nutze den Namen der Person aus dem Nutzerprofil.
`;

    try {
        updateApiTimestamp();
        const result = await adapter.geminiModel.generateContent(prompt);
        const text = result.response.text();

        const dp = reportType === 'NIGHT' ? 'analysis.health.geminiNight' : 'analysis.health.geminiDay';
        await adapter.setStateAsync(dp, { val: text, ack: true });
        adapter.log.info(`🤖 Health Report (${reportType}) generated.`);
    } catch(e) {
        adapter.log.error(`Health Report Error: ${e.message}`);
    }
}

module.exports = {
    executeAutomationAction,
    createDailyDigest,
    runBaselineDriftAnalysis,
    sendMorningBriefing,
    sendWeeklyBriefing,
    runGeminiAnalysis,
    consultButler,
    generateHealthReport
};
