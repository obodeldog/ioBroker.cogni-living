'use strict';

/**
 * UNIFIED NOTIFICATION LAYER
 * Version: 0.30.61
 * Unterstützt: Pushover, Telegram, WhatsApp (callmebot), E-Mail
 * Alle Kanäle senden über ioBroker-Adapter (sendTo).
 * Pushover unterstützt Bild-Anhänge (PNG als Base64).
 */

const axios = require('axios');

/**
 * Generiert einen Text-Sparkline aus Zahlenwerten.
 * Beispiel: [10, 50, 80, 30, 60] → "▁▄▇▂▅"
 */
function generateSparkline(values) {
    if (!values || values.length === 0) return '';
    const blocks = ['▁','▂','▃','▄','▅','▆','▇','█'];
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    return values.map(v => {
        const idx = Math.min(7, Math.floor(((v - min) / range) * 8));
        return blocks[idx];
    }).join('');
}

/**
 * Generiert ein einfaches SVG-Sparkline-Chart als Base64-PNG.
 * Verwendet nur Node.js built-ins – keine externen Abhängigkeiten.
 * Gibt einen SVG-String zurück (für Pushover als Attachment).
 */
function generateChartSVG(values, width = 400, height = 100, label = 'Aktivität') {
    if (!values || values.length === 0) return null;
    const max = Math.max(...values, 1);
    const padH = 10;
    const padV = 10;
    const chartW = width - (2 * padH);
    const chartH = height - (2 * padV);
    const stepX = chartW / Math.max(1, values.length - 1);

    const points = values.map((v, i) => {
        const x = padH + i * stepX;
        const y = padV + chartH - (v / max) * chartH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const lastVal = values[values.length - 1];
    const trend = values.length > 1 ? (lastVal > values[0] ? '↑' : lastVal < values[0] ? '↓' : '→') : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="background:#1a1a1a;border-radius:8px">
  <text x="8" y="14" fill="#888" font-size="10" font-family="monospace">${label} ${trend}</text>
  <polyline points="${points}" fill="none" stroke="#00e676" stroke-width="2" stroke-linejoin="round"/>
  ${values.map((v, i) => {
    const x = padH + i * stepX;
    const y = padV + chartH - (v / max) * chartH;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#00e676"/>`;
  }).join('')}
  <text x="${width - 8}" y="${height - 4}" fill="#aaa" font-size="9" font-family="monospace" text-anchor="end">Max: ${max}</text>
</svg>`;
}

/**
 * Haupt-Sendefunktion. Schickt Nachricht an alle aktivierten Kanäle.
 * 
 * @param {object} adapter - ioBroker Adapter-Instanz
 * @param {object} options
 * @param {string} options.title - Betreff / Titel
 * @param {string} options.message - Nachrichtentext
 * @param {number} [options.priority=0] - Priorität (Pushover: -2 bis 2)
 * @param {number[]} [options.sparklineData] - Daten für Sparkline-Grafik (7 Werte)
 * @param {string} [options.sparklineLabel] - Label für Chart
 * @param {boolean} [options.isAlarm=false] - Ist es ein Alarm? (höhere Priorität)
 */
async function sendNotification(adapter, options) {
    const { title, message, priority = 0, sparklineData, sparklineLabel, isAlarm = false } = options;
    
    const config = adapter.config;
    const promises = [];

    // Sparkline als Text anhängen
    let fullMessage = message;
    if (sparklineData && sparklineData.length > 0) {
        const spark = generateSparkline(sparklineData);
        fullMessage += `\n\nAktivität (7 Tage): ${spark}`;
    }

    // --- PUSHOVER ---
    if (config.notifyPushoverEnabled && config.notifyPushoverInstance) {
        promises.push(
            sendPushover(adapter, config, title, fullMessage, sparklineData, sparklineLabel, isAlarm ? Math.max(priority, 1) : priority)
        );
    }

    // --- TELEGRAM ---
    if (config.notifyTelegramEnabled && config.notifyTelegramInstance) {
        promises.push(
            sendTelegram(adapter, config, title, fullMessage, sparklineData, sparklineLabel)
        );
    }

    // --- WHATSAPP (via callmebot adapter oder whatsapp-cmb) ---
    if (config.notifyWhatsappEnabled && config.notifyWhatsappInstance) {
        promises.push(
            sendWhatsapp(adapter, config, title, fullMessage)
        );
    }

    // --- EMAIL ---
    if (config.notifyEmailEnabled && config.notifyEmailInstance) {
        promises.push(
            sendEmail(adapter, config, title, fullMessage)
        );
    }

    const results = await Promise.allSettled(promises);
    results.forEach((r, i) => {
        if (r.status === 'rejected') {
            adapter.log.warn(`[Notifications] Channel ${i} failed: ${r.reason}`);
        }
    });
}

// --- PUSHOVER IMPLEMENTATION ---
async function sendPushover(adapter, config, title, message, sparklineData, sparklineLabel, priority) {
    const instance = config.notifyPushoverInstance; // z.B. "pushover.0"
    
    try {
        // Versuche SVG-Chart als Anhang zu generieren
        let attachment = undefined;
        if (sparklineData && sparklineData.length > 0 && config.notifyPushoverEnabled) {
            const svgStr = generateChartSVG(sparklineData, 400, 120, sparklineLabel || 'Trend');
            if (svgStr) {
                // SVG direkt als Daten-URI (Pushover akzeptiert SVG nicht direkt)
                // Stattdessen: Text-basiertes Chart in der Nachricht
                // Für echte PNG-Bilder: npm install canvas wäre nötig
            }
        }

        const payload = {
            message: message,
            title: title,
            sound: isAlarmPriority(priority) ? 'siren' : 'pushover',
            priority: priority,
            html: 1
        };
        
        if (config.notifyPushoverRecipient) {
            payload.device = config.notifyPushoverRecipient;
        }

        await new Promise((resolve, reject) => {
            adapter.sendTo(instance, 'send', payload, (result) => {
                if (result && result.error) {
                    reject(new Error(result.error));
                } else {
                    resolve(result);
                }
            });
        });
        
        adapter.log.debug(`[Pushover] Sent: "${title}"`);
    } catch(e) {
        adapter.log.warn(`[Pushover] Error: ${e.message}`);
        throw e;
    }
}

// --- TELEGRAM IMPLEMENTATION ---
async function sendTelegram(adapter, config, title, message, sparklineData, sparklineLabel) {
    const instance = config.notifyTelegramInstance; // z.B. "telegram.0"
    
    try {
        const text = `<b>${escapeHtml(title)}</b>\n\n${message}`;
        
        const payload = {
            text: text,
            parse_mode: 'HTML'
        };
        
        if (config.notifyTelegramRecipient) {
            payload.chatId = config.notifyTelegramRecipient;
            payload.user = config.notifyTelegramRecipient;
        }

        await new Promise((resolve, reject) => {
            adapter.sendTo(instance, 'send', payload, (result) => {
                if (result && result.error) reject(new Error(result.error));
                else resolve(result);
            });
        });

        adapter.log.debug(`[Telegram] Sent: "${title}"`);
    } catch(e) {
        adapter.log.warn(`[Telegram] Error: ${e.message}`);
        throw e;
    }
}

// --- WHATSAPP IMPLEMENTATION ---
async function sendWhatsapp(adapter, config, title, message) {
    const instance = config.notifyWhatsappInstance;
    
    try {
        const text = `*${title}*\n\n${message}`;
        
        await new Promise((resolve, reject) => {
            adapter.sendTo(instance, 'send', { text }, (result) => {
                if (result && result.error) reject(new Error(result.error));
                else resolve(result);
            });
        });

        adapter.log.debug(`[WhatsApp] Sent: "${title}"`);
    } catch(e) {
        adapter.log.warn(`[WhatsApp] Error: ${e.message}`);
        throw e;
    }
}

// --- EMAIL IMPLEMENTATION ---
async function sendEmail(adapter, config, title, message) {
    const instance = config.notifyEmailInstance;
    
    try {
        const payload = {
            to: config.notifyEmailRecipient,
            subject: title,
            text: message,
            html: `<h2>${escapeHtml(title)}</h2><pre>${escapeHtml(message)}</pre>`
        };
        
        await new Promise((resolve, reject) => {
            adapter.sendTo(instance, 'send', payload, (result) => {
                if (result && result.error) reject(new Error(result.error));
                else resolve(result);
            });
        });

        adapter.log.debug(`[Email] Sent: "${title}"`);
    } catch(e) {
        adapter.log.warn(`[Email] Error: ${e.message}`);
        throw e;
    }
}

// --- HELPERS ---
function isAlarmPriority(priority) {
    return priority >= 1;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Lebenszeichen-Alarm: Sendet sofort Benachrichtigung an alle Kanäle.
 */
async function sendLifeSignAlert(adapter, room, hoursSinceActivity, weeklyActivity) {
    const hoursText = hoursSinceActivity >= 24 
        ? `${Math.floor(hoursSinceActivity / 24)} Tage ${Math.floor(hoursSinceActivity % 24)}h`
        : `${Math.floor(hoursSinceActivity)}h ${Math.floor((hoursSinceActivity % 1) * 60)}min`;
    
    const message = `⚠️ Kein Lebenszeichen in <b>${room}</b> seit ${hoursText}!\n\nBitte Kontakt aufnehmen oder vor Ort prüfen.`;
    
    await sendNotification(adapter, {
        title: '🚨 NUUKANNI: Lebenszeichen-Alarm',
        message,
        priority: 1,
        sparklineData: weeklyActivity || [],
        sparklineLabel: 'Aktivität (7 Tage)',
        isAlarm: true
    });
}

/**
 * Morgenbriefing: Tägliche Zusammenfassung.
 */
async function sendMorningBriefing(adapter, summary, metrics) {
    const spark = metrics?.weekActivity ? generateSparkline(metrics.weekActivity) : '';
    const message = `${summary || 'Guten Morgen!'}\n\n` +
        (metrics?.activity !== undefined ? `📊 Aktivität: ${metrics.activity}%\n` : '') +
        (metrics?.nightQuality ? `😴 Nacht: ${metrics.nightQuality}\n` : '') +
        (metrics?.gaitSpeed ? `🚶 Gangtempo: ${metrics.gaitSpeed.toFixed(1)}s\n` : '') +
        (spark ? `\n📈 Wochentrend: ${spark}` : '');
    
    await sendNotification(adapter, {
        title: '🌅 NUUKANNI: Guten Morgen',
        message,
        priority: -1,
        sparklineData: metrics?.weekActivity || [],
        sparklineLabel: 'Aktivität',
        isAlarm: false
    });
}

module.exports = {
    sendNotification,
    sendLifeSignAlert,
    sendMorningBriefing,
    generateSparkline,
    generateChartSVG
};
