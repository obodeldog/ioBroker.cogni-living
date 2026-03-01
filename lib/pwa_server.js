'use strict';

/**
 * NUUKANNI FAMILY PWA SERVER
 * Version: 0.30.61
 * 
 * Startet einen leichtgewichtigen HTTP-Server (Node.js built-in http).
 * Stellt eine mobile "Auf-einen-Blick"-App für Angehörige bereit.
 * 
 * Endpunkte:
 *   GET  /                         → PWA HTML (Token-geschützt via URL-Param)
 *   GET  /api/status?token=xxx     → JSON Gesundheitsstatus
 *   POST /api/acknowledge?token=xxx&alarmId=yyy  → Alarm bestätigen
 *   GET  /manifest.json            → PWA Manifest
 *   GET  /service-worker.js        → Service Worker (Offline + Install)
 */

const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

let serverInstance = null;
let adapter = null;

// ─── ANALYSE-STATUS (für Polling) ─────────────────────────────────────────────
let analysisState = {
    running: false,
    startedAt: 0,
    completedAt: 0,
    phase: ''   // 'night' | 'day' | 'done'
};

function markAnalysisStarted() {
    analysisState = { running: true, startedAt: Date.now(), completedAt: 0, phase: 'analysing' };
}
function markAnalysisPhase(phase) {
    analysisState.phase = phase;
}
function markAnalysisDone() {
    analysisState.running = false;
    analysisState.completedAt = Date.now();
    analysisState.phase = 'done';
}

// ─── TOKEN MANAGEMENT ─────────────────────────────────────────────────────────

function generateToken() {
    return crypto.randomBytes(24).toString('base64url');
}

function getLocalIp() {
    try {
        const ifaces = os.networkInterfaces();
        for (const name of Object.keys(ifaces)) {
            for (const iface of (ifaces[name] || [])) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
    } catch(e) {}
    return 'localhost';
}

async function getOrCreateToken(adapterRef) {
    let token = adapterRef.config.familyShareToken;
    if (!token || token.length < 10) {
        token = generateToken();
        adapterRef.log.info(`[PWA] Generated new family share token`);
        // Token zuverlässig in Adapter-Config speichern
        try {
            await adapterRef.extendForeignObjectAsync(`system.adapter.${adapterRef.namespace}`, {
                native: { familyShareToken: token }
            });
            adapterRef.config.familyShareToken = token;
        } catch(e) {
            adapterRef.log.warn(`[PWA] Could not save token to config: ${e.message}`);
        }
    }
    return token;
}

const BATH_KEYWORDS  = ['bad', 'wc', 'toilet', 'bath', 'hygiene', 'klo'];
const SLEEP_KEYWORDS = ['schlaf', 'bedroom', 'bed', 'schlafen'];

/**
 * Liest Bad-Minuten aus analysis.activity.roomHistory.
 * roomHistory.history[Raum] = Array(24) mit Minuten pro Stunde → Summe = Gesamt-Minuten heute.
 * Dieselbe Datenquelle wie die Admin-Charts.
 */
async function getBathMinutes(adapterRef) {
    try {
        // Primär: aus heutigem History-Snapshot (einheitlich mit Charts)
        const todayFile = readHistoryFile(adapterRef, new Date().toISOString().slice(0, 10));
        if (todayFile && todayFile.todayRoomMinutes) {
            let total = 0;
            for (const [room, mins] of Object.entries(todayFile.todayRoomMinutes)) {
                if (BATH_KEYWORDS.some(k => room.toLowerCase().includes(k))) total += (mins || 0);
            }
            if (total > 0) return total;
        }

        // Fallback: Live-State analysis.activity.roomHistory
        const s = await adapterRef.getStateAsync('analysis.activity.roomHistory').catch(() => null);
        if (s && s.val) {
            const data = JSON.parse(s.val);
            const history = data.history || {};
            let total = 0;
            for (const [room, hourlyArr] of Object.entries(history)) {
                if (BATH_KEYWORDS.some(k => room.toLowerCase().includes(k))) {
                    if (Array.isArray(hourlyArr)) total += hourlyArr.reduce((a, b) => a + (b || 0), 0);
                }
            }
            return total;
        }
    } catch(e) {}
    return null;
}

/**
 * Liest Fenster-Öffnungen aus der heutigen History-Datei (freshAirCount / windowOpenings).
 * Dieselbe Datenquelle wie die Admin-Charts (saveDailyHistory schreibt beide Felder).
 */
function getWindowOpenings(adapterRef) {
    try {
        const todayFile = readHistoryFile(adapterRef, new Date().toISOString().slice(0, 10));
        if (todayFile) {
            if (typeof todayFile.freshAirCount === 'number') return todayFile.freshAirCount;
            if (typeof todayFile.windowOpenings === 'number') return todayFile.windowOpenings;
        }
    } catch(e) {}
    return null;
}

/**
 * Nacht-Qualität aus der gestrigen History-Datei (todayVector Slots 44-47 = 22:00-23:30).
 * Kombiniert mit heutigen Früh-Slots 0-15 (00:00-07:30) aus dem Live-State.
 */
async function getNightQuality(adapterRef) {
    try {
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const histFile = readHistoryFile(adapterRef, yesterday.toISOString().slice(0, 10));
        if (histFile && Array.isArray(histFile.todayVector) && histFile.todayVector.length >= 48) {
            const nightSlots = [...histFile.todayVector.slice(44, 48)]; // 22:00-23:30 gestern
            const todayVecState = await adapterRef.getStateAsync('analysis.health.todayVector').catch(() => null);
            if (todayVecState && todayVecState.val) {
                const tv = JSON.parse(todayVecState.val);
                if (Array.isArray(tv)) nightSlots.push(...tv.slice(0, 16)); // 00:00-07:30 heute
            }
            const maxSlot = Math.max(...nightSlots, 0);
            const total = nightSlots.reduce((a, b) => a + b, 0);
            if (total === 0) return 'Ruhig';
            if (maxSlot < 3) return 'Ruhig';
            if (maxSlot < 8) return 'Leicht unruhig';
            return 'Unruhig';
        }
    } catch(e) {}
    return null;
}

/**
 * Destilliert einen langen Nacht-Analyse-Text auf 2-3 Wörter.
 * Kein weiterer KI-Aufruf – reine lokale Keyword-Analyse.
 * Priorität: Badgänge > Unruhe-Level > Schlaf-Qualität
 */
function distillNightText(text) {
    if (!text || text.length < 3) return null;
    const t = text.toLowerCase();

    // Badgang-Erwähnung (konkreteste Information für Angehörige)
    const badMatch = t.match(/(\d+)[x×]\s*bad|bad[gäu\w]*\s+(\d+)|(\d+)\s+bad/i)
        || text.match(/zwei|2\s*bad|dreimal/i);
    const badCount = badMatch
        ? (text.match(/\b(ein|zwei|drei|2|3|4)\b/i) || [''])[0]
        : null;

    // Unruhe-Stufen
    const hasHaeufig   = t.includes('häufig') || t.includes('mehrfach') || t.includes('stark');
    const hasUnruhig   = t.includes('unruhig') || t.includes('bewegungsphase');
    const hasLeicht    = t.includes('leicht') || t.includes('gelegentlich') || t.includes('vereinzelt');
    const hasRuhig     = t.includes('ruhig') && !hasUnruhig;
    const hasTief      = t.includes('tief') || t.includes('erholsam') || t.includes('durchgeschlafen');

    if (hasTief)                  return 'Tief geschlafen';
    if (hasRuhig && !hasLeicht)   return 'Ruhige Nacht';
    if (badCount && hasHaeufig)   return `Unruhig, Badgänge`;
    if (badCount)                 return `Leicht unruhig + Bad`;
    if (hasHaeufig || (hasUnruhig && !hasLeicht)) return 'Unruhige Nacht';
    if (hasLeicht || hasUnruhig)  return 'Leichte Unruhe';
    if (hasRuhig)                 return 'Ruhige Nacht';

    // Letzter Fallback: erste 4 Wörter des Originaltexts
    const words = text.replace(/[{}"]/g, '').trim().split(/\s+/);
    return words.slice(0, 4).join(' ') + (words.length > 4 ? '…' : '');
}

function readHistoryFile(adapterRef, dateStr) {
    try {
        const utils = require('@iobroker/adapter-core');
        const dataDir = path.join(utils.getAbsoluteDefaultDataDir(), 'cogni-living', 'history');
        const filePath = path.join(dataDir, `${dateStr}.json`);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch(e) {}
    return null;
}

// ─── DATA COLLECTION ──────────────────────────────────────────────────────────

async function collectStatusData(adapterRef) {
    const data = {
        status: 'OK',
        lastActivity: null,
        lastActivityTs: null,
        lastActivityRoom: null,
        metrics: {
            anomalyLabel: null,
            anomalyScore: null,
            nightQuality: null,
            lastNightNormal: null,  // true = für diese Person normal, false = ungewöhnlich
            bathMins: null,
            freshAir: null
        },
        weekSparkline: [],
        alarms: [],
        aiSummary: '',
        lastUpdate: Date.now()
    };

    try {
        // ── Letztes Event ──
        const events = adapterRef.eventHistory || [];
        if (events.length > 0) {
            const last = events[events.length - 1];
            data.lastActivityTs = last.ts || Date.now();
            data.lastActivityRoom = last.room || last.location || '';
            data.lastActivity = formatTimeDiff(Date.now() - data.lastActivityTs);
        }

        // ── Tages-Status aus Anomalie-Score (Health IsolationForest > Security Placeholder) ──
        const healthScore = await adapterRef.getStateAsync('analysis.health.anomalyScore').catch(() => null);
        const secScore   = await adapterRef.getStateAsync('analysis.security.lastScore').catch(() => null);
        const scoreVal   = (healthScore?.val !== null && healthScore?.val !== undefined) ? Number(healthScore.val)
            : (secScore?.val !== null && secScore?.val !== undefined) ? Number(secScore.val) : null;
        if (scoreVal !== null && !isNaN(scoreVal)) {
            data.metrics.anomalyScore = scoreVal;
            if (scoreVal < 0.3)      data.metrics.anomalyLabel = 'Unauffällig';
            else if (scoreVal < 0.6) data.metrics.anomalyLabel = 'Leicht auffällig';
            else                     data.metrics.anomalyLabel = 'Auffällig';
        }

        // ── Nacht-Qualität: Python-NN analysiert Schlaf, Gemini schreibt Text dazu.
        //    Wir extrahieren den Text und destillieren ihn lokal auf 2-3 Wörter –
        //    kein weiterer Gemini-Aufruf nötig.
        const geminiNightState = await adapterRef.getStateAsync('analysis.health.geminiNight').catch(() => null);
        if (geminiNightState && geminiNightState.val) {
            try {
                // geminiNight kann JSON {"analyse":"..."} oder Plaintext sein
                let rawText = String(geminiNightState.val).trim();
                try {
                    const parsed = JSON.parse(rawText);
                    rawText = parsed.analyse || parsed.summary || parsed.text || rawText;
                } catch(e) { /* war kein JSON, rawText bleibt */ }

                data.metrics.nightQuality = distillNightText(rawText);
            } catch(e) {}
        }
        if (!data.metrics.nightQuality) {
            data.metrics.nightQuality = await getNightQuality(adapterRef);
        }

        // ── Personalisiert: War letzte Nacht für DIESE Person normal? (aus Longterm-Analyse) ──
        const lnState = await adapterRef.getStateAsync('analysis.health.lastNightNormal').catch(() => null);
        if (lnState && lnState.val !== null && lnState.val !== undefined) {
            data.metrics.lastNightNormal = lnState.val === true || lnState.val === 'true' || lnState.val === 1;
        }

        // ── Bad-Nutzung aus roomHistory ──
        data.metrics.bathMins = await getBathMinutes(adapterRef);

        // ── Frischluft aus heutiger History-Datei ──
        data.metrics.freshAir = getWindowOpenings(adapterRef);

        // ── KI-Tages-Zusammenfassung ──
        const geminiState = await adapterRef.getStateAsync('analysis.health.geminiDay').catch(() => null);
        if (geminiState && geminiState.val) {
            try {
                let rawDay = String(geminiState.val).trim();
                try {
                    let parsed = JSON.parse(rawDay);
                    // Array-Format: [ { "summary": "..." } ]
                    if (Array.isArray(parsed) && parsed.length > 0) parsed = parsed[0];
                    rawDay = parsed.summary || parsed.analyse || parsed.text || parsed.message || rawDay;
                } catch(e) { /* war kein JSON */ }
                // JSON-Artefakte entfernen
                rawDay = rawDay.replace(/^\[\s*\{[^}]+\}\s*\]/s, '').trim();
                data.aiSummary = rawDay.replace(/^[Aa]nalyse[^:]*:/i, '').trim();
            } catch(e) {}
        }

        // ── Alarme ──
        const inactivityState = await adapterRef.getStateAsync('analysis.safety.inactivityAlert').catch(() => null);
        if (inactivityState && inactivityState.val) {
            try {
                const alertData = JSON.parse(inactivityState.val);
                if (alertData && alertData.active) {
                    data.alarms.push({
                        id: `inactivity_${alertData.room || 'unknown'}`,
                        room: alertData.room || 'Unbekannt',
                        message: `Kein Lebenszeichen seit ${alertData.duration || '?'}`,
                        severity: 'CRITICAL',
                        timestamp: alertData.ts || Date.now()
                    });
                }
            } catch(e) {}
        }

        // ── Woche Sparkline ──
        data.weekSparkline = await loadWeekSparkline(adapterRef);

        // ── Status-Einstufung ──
        if (data.alarms.length > 0) {
            data.status = 'ALERT';
        } else {
            const hoursSinceLast = data.lastActivityTs
                ? (Date.now() - data.lastActivityTs) / 3600000
                : 999;
            const threshold = adapterRef.config.inactivityThresholdHours || 12;
            if (hoursSinceLast > threshold) {
                data.status = 'ALERT';
                data.alarms.push({
                    id: 'general_inactivity',
                    room: data.lastActivityRoom || 'Haus',
                    message: `Kein Lebenszeichen seit ${formatTimeDiff(hoursSinceLast * 3600000)}`,
                    severity: 'CRITICAL',
                    timestamp: data.lastActivityTs || 0
                });
            } else if (hoursSinceLast > threshold * 0.6) {
                data.status = 'WARN';
            }
        }

    } catch(e) {
        adapterRef.log.warn(`[PWA] collectStatusData error: ${e.message}`);
    }

    return data;
}

async function loadWeekSparkline(adapterRef) {
    const sparkline = [];
    try {
        const utils = require('@iobroker/adapter-core');
        const dataDir = path.join(utils.getAbsoluteDefaultDataDir(), 'cogni-living', 'history');

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            const content = readHistoryFile(adapterRef, dateStr);
            if (content) {
                // Anomalie-Score als Qualitätsmerkmal: niedrig = gut, hoch = auffällig
                // Für Sparkline: Activity-Level aus dem Vektor
                const vec = content.todayVector || [];
                const total = Array.isArray(vec) ? vec.reduce((a, b) => a + b, 0) : 0;
                const actPct = total > 0 ? Math.min(100, Math.round((total / Math.max(1, vec.length * 5)) * 100)) : 0;
                sparkline.push({
                    date: dateStr,
                    day: new Date(dateStr + 'T12:00:00').toLocaleDateString('de', { weekday: 'short' }),
                    activity: actPct,
                    // Anomalie-Score für Farb-Codierung (null = keine Daten)
                    anomalyScore: typeof content.anomalyScore === 'number' ? content.anomalyScore : null,
                    nightText: content.geminiNight
                        ? String(content.geminiNight).split(/\s*[\/\-]\s*/)[0].replace(/^["„]/, '').trim()
                        : null
                });
            } else {
                const d2 = new Date(); d2.setDate(d2.getDate() - i);
                sparkline.push({
                    date: dateStr,
                    day: d2.toLocaleDateString('de', { weekday: 'short' }),
                    activity: null,
                    anomalyScore: null,
                    nightText: null
                });
            }
        }
    } catch(e) {
        adapterRef.log.warn(`[PWA] loadWeekSparkline error: ${e.message}`);
    }
    return sparkline;
}

function formatTimeDiff(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    if (m < 1) return `vor ${s}s`;
    if (m < 60) return `vor ${m} Min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `vor ${h} Std`;
    const d = Math.floor(h / 24);
    return `vor ${d} Tagen`;
}

// ─── PWA HTML ─────────────────────────────────────────────────────────────────

function getPwaHtml(token) {
    return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0a0a0f">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="NUUKANNI">
<link rel="manifest" href="/manifest.json">
<title>NUUKANNI – Familien-Ansicht</title>
<style>
:root {
  --bg: #0a0a0f;
  --card: #14141e;
  --border: #1e1e2e;
  --text: #e0e0e0;
  --muted: #666;
  --green: #00e676;
  --yellow: #ffab00;
  --red: #ff3d3d;
  --blue: #448aff;
  --radius: 14px;
  --safe-top: env(safe-area-inset-top);
  --safe-bot: env(safe-area-inset-bottom);
}
@media (prefers-color-scheme: light) {
  :root {
    --bg: #f0f2f8;
    --card: #ffffff;
    --border: #e0e4f0;
    --text: #1a1a2e;
    --muted: #888;
  }
}
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  min-height: 100dvh;
  padding-top: max(16px, var(--safe-top));
  padding-bottom: max(24px, var(--safe-bot));
  padding-left: 16px;
  padding-right: 16px;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.brand { font-size: 15px; font-weight: 700; letter-spacing: 2px; color: var(--blue); }
.refresh-btn {
  background: var(--card);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.refresh-btn:active { opacity: 0.7; }
.status-card {
  background: var(--card);
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: border-color 0.4s;
}
.status-card.alert { border-color: var(--red); }
.status-card.warn  { border-color: var(--yellow); }
.status-card.ok    { border-color: var(--green); }
.status-dot {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  animation: none;
}
.status-dot.ok     { background: rgba(0,230,118,0.15); }
.status-dot.warn   { background: rgba(255,171,0,0.15); }
.status-dot.alert  { background: rgba(255,61,61,0.15); animation: pulse 1.5s infinite; }
@keyframes pulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(255,61,61,0.4); }
  50%      { box-shadow: 0 0 0 12px rgba(255,61,61,0); }
}
.status-info h2 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
.status-info .sub { font-size: 13px; color: var(--muted); }
.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 16px;
}
.metric-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
}
.metric-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; }
.metric-value { font-size: 22px; font-weight: 700; }
.metric-sub { font-size: 11px; color: var(--muted); margin-top: 2px; }
.sparkline-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 16px;
}
.sparkline-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px; }
.sparkline-bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 50px;
  overflow: visible;
  position: relative;
}
.sparkline-bar {
  flex: 1;
  border-radius: 3px 3px 0 0;
  min-height: 3px;
  transition: height 0.5s ease, opacity 0.2s;
  position: relative;
  cursor: pointer;
}
.sparkline-bar.today { opacity: 1; }
.sparkline-bar:not(.today) { opacity: 0.6; }
.sparkline-bar:hover { opacity: 1 !important; filter: brightness(1.3); }
/* Tooltip via data-tip */
.sparkline-bar[data-tip]:hover::after {
  content: attr(data-tip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #1e2a1e;
  border: 1px solid #00e676;
  color: #fff;
  font-size: 10px;
  white-space: pre-wrap;
  max-width: 180px;
  width: max-content;
  padding: 5px 8px;
  border-radius: 5px;
  pointer-events: none;
  z-index: 100;
  line-height: 1.5;
  text-align: center;
  word-break: break-word;
}
.sparkline-days {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}
.sparkline-day { flex: 1; text-align: center; font-size: 9px; color: var(--muted); }
.ai-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 16px;
}
.ai-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px; }
.ai-text { font-size: 14px; line-height: 1.6; color: var(--text); }
.alarms-section { margin-bottom: 16px; }
.alarm-card {
  background: rgba(255,61,61,0.08);
  border: 1px solid var(--red);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 8px;
}
.alarm-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.alarm-title { font-size: 14px; font-weight: 700; color: var(--red); }
.alarm-time { font-size: 11px; color: var(--muted); }
.alarm-msg { font-size: 13px; color: var(--text); margin-bottom: 10px; }
.ack-btn {
  background: var(--red);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  transition: opacity 0.2s;
}
.ack-btn:active { opacity: 0.8; }
.ack-btn:disabled { opacity: 0.4; }
.footer {
  text-align: center;
  font-size: 11px;
  color: var(--muted);
  margin-top: 8px;
  padding-bottom: 8px;
}
.loading { display: flex; align-items: center; justify-content: center; height: 40vh; color: var(--muted); }
.spinner {
  width: 32px; height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--blue);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.hidden { display: none !important; }
.badge {
  display: inline-block;
  background: rgba(255,61,61,0.15);
  color: var(--red);
  border-radius: 20px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  margin-left: 6px;
}
</style>
</head>
<body>
<div class="header">
  <span class="brand">NUUKANNI</span>
  <button class="refresh-btn" onclick="loadData()">↻ Aktualisieren</button>
</div>

<div id="loading" class="loading">
  <div class="spinner"></div>
  <span>Lade Daten…</span>
</div>

<div id="content" class="hidden">
  <!-- Status-Karte -->
  <div id="statusCard" class="status-card ok">
    <div id="statusDot" class="status-dot ok">✓</div>
    <div class="status-info">
      <h2 id="statusText">Alles in Ordnung</h2>
      <div class="sub" id="lastActivity">–</div>
    </div>
  </div>

  <!-- Alarm-Bereich -->
  <div id="alarmsSection" class="alarms-section hidden"></div>

  <!-- Metriken -->
  <div class="metrics-grid">
    <div class="metric-card">
      <div class="metric-label">Tages-Status</div>
      <div class="metric-value" id="metricActivity" style="font-size:16px">–</div>
      <div class="metric-sub" id="metricActivitySub">Verhaltens-Vergleich</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Letzte Nacht</div>
      <div class="metric-value" id="metricNight" style="font-size:15px">–</div>
      <div class="metric-sub">KI-Schlafanalyse</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Bad-Nutzung</div>
      <div class="metric-value" id="metricBath">–</div>
      <div class="metric-sub">Minuten heute</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Frischluft</div>
      <div class="metric-value" id="metricAir">–</div>
      <div class="metric-sub">Fenster-Öffnungen</div>
    </div>
  </div>

  <!-- Woche Sparkline -->
  <div class="sparkline-card">
    <div class="sparkline-label">Tages-Status – letzte 7 Tage</div>
    <div class="sparkline-bars" id="sparklineBars"></div>
    <div class="sparkline-days" id="sparklineDays"></div>
    <div style="font-size:10px;color:var(--muted);margin-top:6px;text-align:center">
      Balkenhöhe = Aktivitätslevel · Farbe: <span style="color:#00e676">■</span> Normal &nbsp;
      <span style="color:#ffab00">■</span> Leicht auffällig &nbsp;
      <span style="color:#ff3d3d">■</span> Auffällig
    </div>
  </div>

  <!-- KI Zusammenfassung -->
  <div id="aiCard" class="ai-card hidden">
    <div class="ai-label">KI Analyse</div>
    <div class="ai-text" id="aiText"></div>
  </div>

  <!-- Analyse-Button -->
  <div id="analyzeSection" style="margin-bottom:16px">
    <button id="analyzeBtn" onclick="triggerAnalysis()" style="width:100%;background:var(--card);border:1px solid var(--border);color:var(--blue);border-radius:var(--radius);padding:12px;font-size:14px;font-weight:600;cursor:pointer;transition:opacity 0.2s">
      🔄 Jetzt neu analysieren
    </button>
    <div id="analyzeProgress" class="hidden" style="margin-top:8px">
      <div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden">
        <div id="progressBar" style="height:100%;width:0%;background:var(--blue);transition:width 0.5s;border-radius:2px"></div>
      </div>
      <div id="analyzeStatus" style="font-size:12px;color:var(--muted);margin-top:4px;text-align:center">KI analysiert...</div>
    </div>
  </div>

  <div class="footer" id="lastUpdate"></div>
</div>

<script>
const TOKEN = '${token}';
const API_BASE = window.location.origin;
let refreshTimer = null;

const statusColors = {
  OK:    { bg: 'ok',    icon: '✓', text: 'Alles in Ordnung',     color: '#00e676' },
  WARN:  { bg: 'warn',  icon: '⚠', text: 'Bitte beachten',       color: '#ffab00' },
  ALERT: { bg: 'alert', icon: '!', text: 'Aufmerksamkeit nötig!', color: '#ff3d3d' }
};

async function loadData() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('content').classList.add('hidden');
  
  try {
    const resp = await fetch(\`\${API_BASE}/api/status?token=\${TOKEN}\`);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    renderData(data);
  } catch(e) {
    document.getElementById('loading').innerHTML = \`
      <div style="text-align:center">
        <div style="font-size:32px;margin-bottom:8px">⚠</div>
        <div>Verbindungsfehler</div>
        <div style="font-size:12px;color:#666;margin-top:4px">\${e.message}</div>
        <button onclick="loadData()" style="margin-top:12px;padding:8px 16px;border-radius:8px;background:#448aff;color:white;border:none;cursor:pointer">Erneut versuchen</button>
      </div>
    \`;
  }
}

function renderData(d) {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('content').classList.remove('hidden');

  // Status
  const s = statusColors[d.status] || statusColors.OK;
  const card = document.getElementById('statusCard');
  const dot = document.getElementById('statusDot');
  card.className = 'status-card ' + s.bg;
  dot.className = 'status-dot ' + s.bg;
  dot.textContent = s.icon;
  document.getElementById('statusText').textContent = s.text;
  if (d.lastActivityTs) {
    const lat = new Date(d.lastActivityTs);
    const timeStr = lat.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'});
    const room = d.lastActivityRoom ? ' · ' + d.lastActivityRoom : '';
    document.getElementById('lastActivity').textContent = \`Letzte Aktivität: \${timeStr} Uhr\${room}\`;
  } else {
    document.getElementById('lastActivity').textContent = 'Noch keine Aktivität heute';
  }

  // Alarme
  const alarmsSection = document.getElementById('alarmsSection');
  if (d.alarms && d.alarms.length > 0) {
    alarmsSection.classList.remove('hidden');
    alarmsSection.innerHTML = d.alarms.map(alarm => \`
      <div class="alarm-card" id="alarm-\${alarm.id}">
        <div class="alarm-header">
          <span class="alarm-title">🚨 \${alarm.room}</span>
          <span class="alarm-time">\${formatTs(alarm.timestamp)}</span>
        </div>
        <div class="alarm-msg">\${alarm.message}</div>
        <button class="ack-btn" onclick="acknowledgeAlarm('\${alarm.id}', this)">
          ✓ Bestätigt – ich kümmere mich
        </button>
      </div>
    \`).join('');
  } else {
    alarmsSection.classList.add('hidden');
  }

  // ── Tages-Status (Anomalie-Score) ──
  const actEl = document.getElementById('metricActivity');
  const actSub = document.getElementById('metricActivitySub');
  const al = d.metrics.anomalyLabel;
  if (al) {
    actEl.textContent = al;
    actEl.style.color = al === 'Unauffällig' ? '#00e676' : al === 'Leicht auffällig' ? '#ffab00' : '#ff3d3d';
    const score = d.metrics.anomalyScore;
    actSub.textContent = score !== null ? \`Score: \${score.toFixed(2)} · Vergl. mit Normalwert\` : 'Verhaltens-Vergleich';
  } else {
    actEl.textContent = '–';
    actEl.style.color = '';
    actSub.textContent = 'Noch kein Profil';
  }

  // ── Letzte Nacht: Text + personalisierter Zusatz (wie immer / mehr als üblich) ──
  const nightEl = document.getElementById('metricNight');
  const nq = d.metrics.nightQuality;
  const lnNormal = d.metrics.lastNightNormal;
  if (nq) {
    let display = nq;
    if (lnNormal === true) display += ' · wie immer';
    else if (lnNormal === false) display += ' · mehr als üblich';
    nightEl.textContent = display;
    const lower = nq.toLowerCase();
    // Farb-Logik: Rot zuerst prüfen (höchste Priorität), dann Orange, dann Grün
    // WICHTIG: Reihenfolge entscheidet! "Unruhig" muss vor "bad" (in "Badgänge") geprüft werden.
    if (lower.includes('unruhig') || lower.includes('aktiv') || lower.includes('wach') || lower.includes('viel')) {
      nightEl.style.color = '#ff3d3d'; // rot: klar gestörter Schlaf
    } else if (lower.includes('leicht') || lower.includes('badgang') || lower.includes('normal')) {
      nightEl.style.color = '#ffab00'; // orange: leicht auffällig / Badgänge
    } else if (lower.includes('ruhig')) {
      nightEl.style.color = '#00e676'; // grün: ruhig
    } else {
      nightEl.style.color = '#ffab00'; // default: orange (unbekannt)
    }
    nightEl.style.fontSize = display.length > 20 ? '12px' : '15px';
  } else {
    nightEl.textContent = '–';
    nightEl.style.color = '';
  }

  const bm = d.metrics.bathMins;
  document.getElementById('metricBath').textContent = bm !== null && bm !== undefined ? bm + ' min' : '–';

  document.getElementById('metricAir').textContent = d.metrics.freshAir !== null && d.metrics.freshAir !== undefined ? d.metrics.freshAir + 'x' : '–';

  // Sparkline
  renderSparkline(d.weekSparkline || []);

  // KI Text
  if (d.aiSummary) {
    document.getElementById('aiCard').classList.remove('hidden');
    document.getElementById('aiText').textContent = d.aiSummary.replace(/^[Aa]nalyse[^:]*:/i, '').trim();
  }

  // Timestamp
  document.getElementById('lastUpdate').textContent = 
    'Aktualisiert: ' + new Date(d.lastUpdate).toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'});

  // Auto-Refresh in 60s
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(loadData, 60000);
}

function renderSparkline(entries) {
  const bars = document.getElementById('sparklineBars');
  const days = document.getElementById('sparklineDays');
  if (!entries || entries.length === 0) {
    bars.innerHTML = '<span style="color:#666;font-size:12px">Keine Daten</span>';
    return;
  }

  // Wenn altes Format (reines Zahlen-Array) abwärtskompatibel behandeln
  const normalized = entries.map((e, i) => typeof e === 'number'
    ? { activity: e, anomalyScore: null, day: '', date: '' }
    : e
  );

  const activities = normalized.map(e => e.activity || 0);
  const maxAct = Math.max(...activities, 1);

  bars.innerHTML = normalized.map((e, i) => {
    const isToday = i === normalized.length - 1;
    const act = e.activity;
    const hasData = act !== null && act !== undefined;
    const pct = hasData ? Math.max(4, (act / maxAct) * 50) : 4;
    const label = isToday ? 'Heute' : (e.day || '');

    // Farbe: Anomalie-Score bestimmt Farbe falls vorhanden, sonst Aktivitätslevel
    let color;
    if (!hasData) {
      color = '#333';
    } else if (e.anomalyScore !== null && e.anomalyScore !== undefined) {
      color = e.anomalyScore < 0.3 ? '#00e676' : e.anomalyScore < 0.6 ? '#ffab00' : '#ff3d3d';
    } else {
      color = act > 60 ? '#00e676' : act > 30 ? '#ffab00' : '#555';
    }

    const nightShort = e.nightText ? e.nightText.substring(0, 30) + (e.nightText.length > 30 ? '…' : '') : '';
    const nightInfo = nightShort ? \`\\nNacht: \${nightShort}\` : '';
    const statusLabel = e.anomalyScore !== null && e.anomalyScore !== undefined
      ? (e.anomalyScore < 0.3 ? 'Unauffällig' : e.anomalyScore < 0.6 ? 'Leicht auffällig' : 'Auffällig')
      : '?';
    const tooltip = hasData
      ? \`\${label}\\nAktivität: \${act}%\\nStatus: \${statusLabel}\${nightInfo}\`
      : \`\${label}: Keine Daten\`;

    return \`<div class="sparkline-bar \${isToday ? 'today' : ''}"
      style="height:\${pct}px;background:\${color};border-radius:3px 3px 0 0;opacity:\${hasData ? 1 : 0.3}"
      data-tip="\${tooltip.replace(/"/g, '&quot;')}"></div>\`;
  }).join('');

  days.innerHTML = normalized.map((e, i) => {
    const isToday = i === normalized.length - 1;
    const label = isToday ? 'Heu' : (e.day ? e.day.slice(0, 2) : '');
    return \`<div class="sparkline-day" style="\${isToday ? 'color:var(--blue);font-weight:600' : ''}">\${label}</div>\`;
  }).join('');
}

async function acknowledgeAlarm(alarmId, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  try {
    const resp = await fetch(\`\${API_BASE}/api/acknowledge?token=\${TOKEN}&alarmId=\${alarmId}\`, { method: 'POST' });
    if (resp.ok) {
      const card = document.getElementById('alarm-' + alarmId);
      if (card) {
        card.style.opacity = '0.4';
        card.style.pointerEvents = 'none';
        btn.textContent = '✓ Bestätigt';
      }
    } else {
      btn.textContent = 'Fehler – erneut versuchen';
      btn.disabled = false;
    }
  } catch(e) {
    btn.textContent = 'Fehler – erneut versuchen';
    btn.disabled = false;
  }
}

function formatTs(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'});
}

async function triggerAnalysis() {
  const btn = document.getElementById('analyzeBtn');
  const prog = document.getElementById('analyzeProgress');
  const bar  = document.getElementById('progressBar');
  const stat = document.getElementById('analyzeStatus');

  btn.disabled = true;
  btn.textContent = '⏳ Analyse läuft...';
  prog.classList.remove('hidden');
  bar.style.width = '5%';
  stat.textContent = 'Analyse wird gestartet...';

  // Schritt 1: Trigger senden
  try {
    const resp = await fetch(\`\${API_BASE}/api/analyze?token=\${TOKEN}\`, { method: 'POST' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
  } catch(e) {
    stat.textContent = 'Fehler beim Starten: ' + e.message;
    bar.style.background = '#ff3d3d';
    setTimeout(() => { prog.classList.add('hidden'); bar.style.background = 'var(--blue)'; btn.disabled = false; btn.textContent = '🔄 Jetzt neu analysieren'; }, 3000);
    return;
  }

  // Schritt 2: Polling bis Server "done" meldet (max. 90s)
  const phases = [
    [8,  'Schlaf-Protokoll wird generiert...'],
    [20, 'Nacht-Report läuft (Gemini KI)...'],
    [40, 'Bewegungsmuster werden analysiert...'],
    [60, 'Tages-Report läuft (Gemini KI)...'],
    [80, 'Ergebnisse werden gespeichert...'],
  ];
  const start = Date.now();
  const maxWait = 90000;

  const pollInterval = setInterval(async () => {
    const elapsed = Date.now() - start;

    // Fortschrittsbalken: langsam wachsen bis 88%, Echtzeit-Phase anzeigen
    const fakePct = Math.min(88, Math.round((elapsed / maxWait) * 88));
    bar.style.width = fakePct + '%';
    for (let i = phases.length - 1; i >= 0; i--) {
      if (elapsed / 1000 >= phases[i][0]) { stat.textContent = phases[i][1]; break; }
    }

    // Server nach Status fragen
    try {
      const r = await fetch(\`\${API_BASE}/api/analysis-status?token=\${TOKEN}\`);
      if (r.ok) {
        const s = await r.json();
        if (!s.running && s.completedAt > start) {
          // ✅ Fertig!
          clearInterval(pollInterval);
          bar.style.width = '100%';
          stat.textContent = '✓ Analyse abgeschlossen – Daten werden geladen...';
          setTimeout(() => {
            prog.classList.add('hidden');
            btn.disabled = false;
            btn.textContent = '🔄 Jetzt neu analysieren';
            loadData();
          }, 1200);
          return;
        }
      }
    } catch(e) { /* Polling-Fehler ignorieren */ }

    // Timeout
    if (elapsed > maxWait) {
      clearInterval(pollInterval);
      bar.style.width = '100%';
      stat.textContent = '⚠ Timeout – Daten werden trotzdem geladen...';
      setTimeout(() => {
        prog.classList.add('hidden');
        btn.disabled = false;
        btn.textContent = '🔄 Jetzt neu analysieren';
        loadData();
      }, 1500);
    }
  }, 3000);
}

// Service Worker registrieren
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(() => {});
}

// Initialer Ladevorgang
loadData();
</script>
</body>
</html>`;
}

// ─── MANIFEST + SERVICE WORKER ────────────────────────────────────────────────

function getManifest() {
    return JSON.stringify({
        name: 'NUUKANNI Familien-App',
        short_name: 'NUUKANNI',
        description: 'Gesundheits-Übersicht für Angehörige',
        start_url: '/?source=pwa',
        display: 'standalone',
        background_color: '#0a0a0f',
        theme_color: '#0a0a0f',
        orientation: 'portrait',
        icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
    }, null, 2);
}

function getServiceWorker() {
    return `
const CACHE = 'nuukanni-v1';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/manifest.json'])));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return; // API immer fresh
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
`;
}

// ─── HTTP HANDLER ─────────────────────────────────────────────────────────────

async function handleRequest(req, res, adapterRef, validToken) {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;
    const query = parsed.query;

    // CORS für localhost
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ── Manifest (kein Token nötig) ──
    if (pathname === '/manifest.json') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(getManifest());
        return;
    }

    // ── Service Worker (kein Token nötig) ──
    if (pathname === '/service-worker.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(getServiceWorker());
        return;
    }

    // ── Icon (kein Token nötig) ──
    if (pathname.startsWith('/icon-')) {
        // Einfaches SVG als PNG-Placeholder
        const size = pathname.includes('512') ? 512 : 192;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#0a0a0f"/><text x="50%" y="50%" font-size="${size * 0.35}" text-anchor="middle" dominant-baseline="central" fill="#448aff">N</text></svg>`;
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        res.end(svg);
        return;
    }

    // ── Token-Validierung ──
    const reqToken = query.token;
    if (!reqToken || reqToken !== validToken) {
        if (pathname === '/' && !reqToken) {
            // Zeige hilfreiche Seite wenn kein Token
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NUUKANNI</title></head><body style="font-family:sans-serif;background:#0a0a0f;color:#888;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:20px"><div><div style="font-size:40px;margin-bottom:12px">🔒</div><h2 style="color:#fff;margin-bottom:8px">Kein Zugriff</h2><p>Bitte verwende den Link aus der ioBroker Konfiguration.</p></div></body></html>`);
            return;
        }
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid token' }));
        return;
    }

    // ── Hauptseite ──
    if (pathname === '/' || pathname === '') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getPwaHtml(validToken));
        return;
    }

    // ── API: Status ──
    if (pathname === '/api/status') {
        try {
            const statusData = await collectStatusData(adapterRef);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(statusData));
        } catch(e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // ── API: Alarm bestätigen ──
    if (pathname === '/api/acknowledge' && req.method === 'POST') {
        const alarmId = query.alarmId;
        try {
            await adapterRef.setStateAsync('analysis.safety.alarmAcknowledged', {
                val: JSON.stringify({ alarmId, ts: Date.now(), via: 'family_pwa' }),
                ack: false
            });
            adapterRef.log.info(`[PWA] Alarm acknowledged via Family App: ${alarmId}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
        } catch(e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // ── API: Analyse triggern ──
    if (pathname === '/api/analyze' && req.method === 'POST') {
        try {
            adapterRef.log.info('[PWA] 🔄 Analysis triggered via Family App');
            markAnalysisStarted();
            await adapterRef.setStateAsync('analysis.training.triggerHealth', { val: true, ack: false });
            setTimeout(async () => {
                try { await adapterRef.setStateAsync('analysis.training.triggerHealth', { val: false, ack: true }); } catch(e) {}
            }, 500);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, message: 'Analyse gestartet' }));
        } catch(e) {
            markAnalysisDone();
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // ── API: Analyse-Status abfragen (Polling) ──
    if (pathname === '/api/analysis-status' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(analysisState));
        return;
    }

    // ── 404 ──
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
}

// ─── SERVER START / STOP ──────────────────────────────────────────────────────

async function start(adapterRef) {
    adapter = adapterRef;
    
    if (serverInstance) {
        adapterRef.log.warn('[PWA] Server already running, stopping first...');
        await stop();
    }

    const port = adapterRef.config.pwaPort || 8095;
    const token = await getOrCreateToken(adapterRef);

    serverInstance = http.createServer(async (req, res) => {
        try {
            await handleRequest(req, res, adapterRef, token);
        } catch(e) {
            adapterRef.log.error(`[PWA] Request error: ${e.message}`);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal error' }));
            }
        }
    });

    serverInstance.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            adapterRef.log.error(`[PWA] Port ${port} already in use! Change pwaPort in settings.`);
        } else {
            adapterRef.log.error(`[PWA] Server error: ${e.message}`);
        }
    });

    await new Promise((resolve, reject) => {
        serverInstance.listen(port, '0.0.0.0', () => {
            const localIp = getLocalIp();
            const localUrl = `http://${localIp}:${port}/?token=${token}`;
            const localhostUrl = `http://localhost:${port}/?token=${token}`;
            adapterRef.log.info(`[PWA] ✅ Family App running on port ${port}`);
            adapterRef.log.info(`[PWA] 🔗 Im lokalen Netzwerk: ${localUrl}`);
            adapterRef.log.info(`[PWA] 🔗 Lokal auf Server:     ${localhostUrl}`);
            
            // URL in ioBroker-State speichern (echte IP, nicht localhost)
            adapterRef.setStateAsync('system.pwaLocalUrl', {
                val: localUrl, ack: true
            }).catch(() => {});
            
            // Token auch separat als State speichern für Admin-UI Anzeige
            adapterRef.setStateAsync('system.pwaToken', {
                val: token, ack: true
            }).catch(() => {});
            
            resolve();
        });
        serverInstance.on('error', reject);
    }).catch(e => {
        adapterRef.log.error(`[PWA] Failed to start: ${e.message}`);
        serverInstance = null;
    });

    return token;
}

async function stop() {
    return new Promise((resolve) => {
        if (!serverInstance) { resolve(); return; }
        serverInstance.close(() => {
            serverInstance = null;
            if (adapter) adapter.log.info('[PWA] Server stopped.');
            resolve();
        });
        // Force-close nach 2s
        setTimeout(() => { serverInstance = null; resolve(); }, 2000);
    });
}

module.exports = { start, stop, generateToken, markAnalysisDone, markAnalysisPhase };
