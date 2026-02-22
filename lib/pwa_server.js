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

// ─── DATA COLLECTION ──────────────────────────────────────────────────────────

async function collectStatusData(adapterRef) {
    const data = {
        status: 'OK',        // OK | WARN | ALERT
        lastActivity: null,
        lastActivityTs: null,
        lastActivityRoom: null,
        metrics: {
            activity: null,
            nightQuality: null,
            bathVisits: null,
            freshAir: null,
            gaitSpeed: null
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
            const diff = Date.now() - data.lastActivityTs;
            data.lastActivity = formatTimeDiff(diff);
        }

        // ── Heutiger Vektor ──
        const vectorState = await adapterRef.getStateAsync('analysis.health.todayVector').catch(() => null);
        if (vectorState && vectorState.val) {
            const vec = JSON.parse(vectorState.val);
            const total = Array.isArray(vec) ? vec.reduce((a, b) => a + b, 0) : 0;
            data.metrics.activity = total > 0 ? Math.min(100, Math.round((total / (vec.length * 5)) * 100)) : 0;
        }

        // ── Tages-Details ──
        const detailState = await adapterRef.getStateAsync('analysis.health.todayRoomDetails').catch(() => null);
        if (detailState && detailState.val) {
            const details = JSON.parse(detailState.val);
            if (details.badVisits !== undefined) data.metrics.bathVisits = details.badVisits;
            if (details.windowOpenings !== undefined) data.metrics.freshAir = details.windowOpenings;
        }

        // ── Gait Speed ──
        const gaitState = await adapterRef.getStateAsync('analysis.health.gaitSpeed').catch(() => null);
        if (gaitState && gaitState.val) {
            const gs = JSON.parse(gaitState.val);
            if (gs && gs.avgTraversalTime) data.metrics.gaitSpeed = gs.avgTraversalTime;
        }

        // ── AI Zusammenfassung ──
        const geminiState = await adapterRef.getStateAsync('analysis.health.geminiDay').catch(() => null);
        if (geminiState && geminiState.val) {
            const g = JSON.parse(geminiState.val);
            data.aiSummary = g.summary || g.text || '';
        }

        // ── Nacht-Qualität ──
        const nightState = await adapterRef.getStateAsync('analysis.health.nightAnalysis').catch(() => null);
        if (nightState && nightState.val) {
            const night = JSON.parse(nightState.val);
            if (night.quality) data.metrics.nightQuality = night.quality;
            else if (night.outsideEvents !== undefined) {
                data.metrics.nightQuality = night.outsideEvents < 3 ? 'Ruhig' : night.outsideEvents < 8 ? 'Leicht unruhig' : 'Unruhig';
            }
        }

        // ── Aktive Alarme ──
        const deadManState = await adapterRef.getStateAsync('analysis.safety.deadMan.active').catch(() => null);
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
                    data.status = 'ALERT';
                }
            } catch(e) {}
        }

        // ── Woche Sparkline aus Room History ──
        const histState = await adapterRef.getStateAsync('analysis.activity.roomHistory').catch(() => null);
        if (histState && histState.val) {
            // Verwende die letzten 7 Tage aus der History
            const weekData = adapterRef._weekActivityCache || [];
            if (weekData.length > 0) {
                data.weekSparkline = weekData;
            } else {
                // Fallback: generiere Sparkline aus den letzten 7 History-Files
                data.weekSparkline = await loadWeekSparkline(adapterRef);
            }
        }

        // Status-Einstufung
        if (data.alarms.length > 0) {
            data.status = 'ALERT';
        } else {
            const hoursSinceLast = data.lastActivityTs ? (Date.now() - data.lastActivityTs) / 3600000 : 999;
            if (hoursSinceLast > (adapterRef.config.inactivityThresholdHours || 12)) {
                data.status = 'ALERT';
                data.alarms.push({
                    id: 'general_inactivity',
                    room: data.lastActivityRoom || 'Haus',
                    message: `Kein Lebenszeichen seit ${formatTimeDiff(hoursSinceLast * 3600000)}`,
                    severity: 'CRITICAL',
                    timestamp: data.lastActivityTs || 0
                });
            } else if (hoursSinceLast > (adapterRef.config.inactivityThresholdHours || 12) * 0.6) {
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
        const dataDir = adapterRef._historyDir || '';
        if (!dataDir) return sparkline;
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            const filePath = path.join(dataDir, `${dateStr}.json`);
            if (fs.existsSync(filePath)) {
                const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const vec = content.todayVector || [];
                const total = Array.isArray(vec) ? vec.reduce((a, b) => a + b, 0) : 0;
                sparkline.push(total > 0 ? Math.min(100, Math.round((total / Math.max(1, vec.length * 5)) * 100)) : 0);
            } else {
                sparkline.push(0);
            }
        }
    } catch(e) {}
    return sparkline;
}

function formatTimeDiff(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return 'gerade eben';
    const m = Math.floor(s / 60);
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
}
.sparkline-bar {
  flex: 1;
  border-radius: 3px 3px 0 0;
  min-height: 3px;
  transition: height 0.5s ease;
  position: relative;
}
.sparkline-bar.today { opacity: 1; }
.sparkline-bar:not(.today) { opacity: 0.6; }
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
      <div class="metric-label">Aktivität</div>
      <div class="metric-value" id="metricActivity">–</div>
      <div class="metric-sub">heute</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Nacht</div>
      <div class="metric-value" id="metricNight" style="font-size:16px">–</div>
      <div class="metric-sub" id="metricNightSub"></div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Bad-Besuche</div>
      <div class="metric-value" id="metricBath">–</div>
      <div class="metric-sub">heute</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Frischluft</div>
      <div class="metric-value" id="metricAir">–</div>
      <div class="metric-sub">Öffnungen</div>
    </div>
  </div>

  <!-- Woche Sparkline -->
  <div class="sparkline-card">
    <div class="sparkline-label">Aktivität – letzte 7 Tage</div>
    <div class="sparkline-bars" id="sparklineBars"></div>
    <div class="sparkline-days" id="sparklineDays"></div>
  </div>

  <!-- KI Zusammenfassung -->
  <div id="aiCard" class="ai-card hidden">
    <div class="ai-label">KI Analyse</div>
    <div class="ai-text" id="aiText"></div>
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
  document.getElementById('lastActivity').textContent = 
    d.lastActivity ? \`Letzte Aktivität: \${d.lastActivity}\${d.lastActivityRoom ? ' · ' + d.lastActivityRoom : ''}\` : 'Noch keine Aktivität heute';

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

  // Metriken
  document.getElementById('metricActivity').textContent = d.metrics.activity !== null ? d.metrics.activity + '%' : '–';
  document.getElementById('metricNight').textContent = d.metrics.nightQuality || '–';
  document.getElementById('metricBath').textContent = d.metrics.bathVisits !== null ? d.metrics.bathVisits + 'x' : '–';
  document.getElementById('metricAir').textContent = d.metrics.freshAir !== null ? d.metrics.freshAir + 'x' : '–';

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

function renderSparkline(values) {
  const bars = document.getElementById('sparklineBars');
  const days = document.getElementById('sparklineDays');
  if (!values || values.length === 0) { bars.innerHTML = '<span style="color:#666;font-size:12px">Keine Daten</span>'; return; }
  
  const max = Math.max(...values, 1);
  const dayLabels = [];
  for (let i = values.length - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayLabels.push(i === 0 ? 'Heute' : d.toLocaleDateString('de-DE', {weekday: 'short'}));
  }

  bars.innerHTML = values.map((v, i) => {
    const pct = Math.max(4, (v / max) * 50);
    const isToday = i === values.length - 1;
    const color = v > 70 ? '#00e676' : v > 40 ? '#ffab00' : '#ff3d3d';
    return \`<div class="sparkline-bar \${isToday ? 'today' : ''}" 
      style="height:\${pct}px;background:\${color};border-radius:3px 3px 0 0" 
      title="\${dayLabels[i]}: \${v}%"></div>\`;
  }).join('');
  
  days.innerHTML = dayLabels.map(l => \`<div class="sparkline-day">\${l.slice(0,2)}</div>\`).join('');
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

module.exports = { start, stop, generateToken };
