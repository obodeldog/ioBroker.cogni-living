/**
 * Patches src/lib/pwa_server.js: inject tile client JS + replace renderSleepCard.
 */
const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'src', 'lib', 'pwa_server.js');
let c = fs.readFileSync(p, 'utf8');

const inj = `let _pwaSleepTileClientJs = '';
try {
    _pwaSleepTileClientJs = fs.readFileSync(path.join(__dirname, 'pwa_sleep_tile_client.js'), 'utf8');
} catch (e) {
    _pwaSleepTileClientJs = '';
}

`;

if (!c.includes('_pwaSleepTileClientJs')) {
    const needle = "const crypto = require('crypto');\r\nconst os = require('os');\r\n\r\n";
    if (!c.includes(needle)) {
        const needle2 = "const crypto = require('crypto');\nconst os = require('os');\n\n";
        if (c.includes(needle2)) c = c.replace(needle2, needle2 + inj);
        else {
            console.error('crypto/os needle not found');
            process.exit(1);
        }
    } else {
        c = c.replace(needle, needle + inj);
    }
}

const scriptNeedle = '<script>\r\nconst TOKEN = ';
const scriptIns = '<script>\r\n' + '${_pwaSleepTileClientJs}\r\nconst TOKEN = ';
if (c.includes(scriptNeedle) && !c.includes('${_pwaSleepTileClientJs}')) {
    c = c.replace(scriptNeedle, scriptIns);
} else if (c.includes('<script>\nconst TOKEN = ') && !c.includes('${_pwaSleepTileClientJs}')) {
    c = c.replace('<script>\nconst TOKEN = ', '<script>\n${_pwaSleepTileClientJs}\nconst TOKEN = ');
}

const oldFn =
    'function renderSleepCard(sc) {\r\n' +
    "  var card = document.getElementById('sleepAuraCard');\r\n" +
    "  var body = document.getElementById('sleepAuraBody');\r\n" +
    '  if (!card || !body) return;\r\n' +
    "  if (!sc || (sc.sleepScore == null && sc.sleepWindowStart == null && sc.durationMin == null)) {\r\n" +
    "    card.style.display = 'none';\r\n" +
    "    body.innerHTML = '';\r\n" +
    '    return;\r\n' +
    '  }\r\n' +
    "  card.style.display = 'block';\r\n" +
    "  var score = sc.sleepScore != null ? Math.round(Number(sc.sleepScore)) : '\\u2014';\r\n" +
    '  var durMin = sc.durationMin;\r\n' +
    '  var dur = durMin != null && isFinite(Number(durMin))\r\n' +
    "    ? (Math.floor(durMin / 60) + 'h ' + (durMin % 60) + 'min')\r\n" +
    "    : '\\u2014';\r\n" +
    "  var g = sc.garminScore != null ? ('Garmin: ' + Math.round(Number(sc.garminScore))) : '';\r\n" +
    "  var start = sc.sleepStartLabel || '\\u2014';\r\n" +
    "  var wake = sc.wakeLabel || '\\u2014';\r\n" +
    "  var cal = (sc.sleepScoreCalStatus && sc.sleepScoreCalStatus !== 'calibrated')\r\n" +
    "    ? (' <span style=\"font-size:11px;color:var(--muted)\">(Kalibrierung: ' + (sc.sleepScoreCalNights || 0) + ' N.)</span>')\r\n" +
    "    : '';\r\n" +
    '  body.innerHTML =\r\n' +
    "    '<div style=\"display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start;margin-bottom:4px\">' +\r\n" +
    "      '<div style=\"min-width:120px;flex:1;background:rgba(255,61,61,0.12);border:1px solid rgba(255,61,61,0.35);border-radius:10px;padding:10px;text-align:center\">' +\r\n" +
    "        '<div style=\"font-size:11px;color:var(--muted);text-transform:uppercase\">AURA-Sleepscore</div>' +\r\n" +
    "        '<div style=\"font-size:28px;font-weight:700;color:#ff5252\">' + score + '</div>' + cal +\r\n" +
    "      '</div>' +\r\n" +
    "      '<div style=\"flex:1;min-width:140px;font-size:13px;padding-top:4px\">' +\r\n" +
    "        '<div><span style=\"color:var(--muted)\">Schlaffenster:</span> ' + start + ' \\u2013 ' + wake + '</div>' +\r\n" +
    "        '<div><span style=\"color:var(--muted)\">Dauer:</span> ' + dur + '</div>' +\r\n" +
    "        (g ? '<div><span style=\"color:var(--muted)\">Referenz:</span> ' + g + '</div>' : '') +\r\n" +
    "      '</div>' +\r\n" +
    "    '</div>';\r\n" +
    '}\r\n';

const newFn =
    'function renderSleepCard(sc) {\r\n' +
    "  var card = document.getElementById('sleepAuraCard');\r\n" +
    "  var body = document.getElementById('sleepAuraBody');\r\n" +
    '  if (!card || !body) return;\r\n' +
    "  if (!sc || sc.view === 'none') {\r\n" +
    "    card.style.display = 'none';\r\n" +
    "    body.innerHTML = '';\r\n" +
    '    return;\r\n' +
    '  }\r\n' +
    "  card.style.display = 'block';\r\n" +
    "  if (typeof renderSleepTileFromPayload === 'function') {\r\n" +
    '    renderSleepTileFromPayload(body, sc);\r\n' +
    '    return;\r\n' +
    '  }\r\n' +
    "  body.textContent = 'Schlaf-Kachel: Daten nicht darstellbar';\r\n" +
    '}\r\n';

if (c.includes(oldFn)) {
    c = c.replace(oldFn, newFn);
} else if (c.includes('function renderSleepCard(sc)')) {
    console.error('renderSleepCard body mismatch — manual merge needed');
    process.exit(1);
}

const labelOld = '<div class="sparkline-label">Schlafanalyse (AURA)</div>';
const labelNew = '<div class="sparkline-label">SCHLAFANALYSE (AURA)</div>';
if (c.includes(labelOld)) c = c.replace(labelOld, labelNew);

fs.writeFileSync(p, c, 'utf8');
console.log('OK patched', p);
