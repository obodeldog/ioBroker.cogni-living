'use strict';
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'lib');

function patch(filename, oldStr, newStr, label) {
    const p = path.join(srcDir, filename);
    let s = fs.readFileSync(p, 'utf8');
    if (!s.includes(oldStr)) {
        console.error('FEHLER: Anker nicht gefunden in', filename, ':', JSON.stringify(oldStr.slice(0, 80)));
        process.exit(1);
    }
    s = s.replace(oldStr, newStr);
    fs.writeFileSync(p, s, 'utf8');
    console.log('OK:', label);
}

// ─── FIX 1: pwa_sleep_tile_build.js — legend um bathMin/outsideMin/radarCount erweitern ───
patch(
    'pwa_sleep_tile_build.js',
    `        legend: {
            deepMin: deepCount * 5,
            lightMin: lightCount * 5,
            remMin: remCount * 5,
            wakeMin: wakeCount * 5
        },`,
    `        legend: {
            deepMin: deepCount * 5,
            lightMin: lightCount * 5,
            remMin: remCount * 5,
            wakeMin: wakeCount * 5,
            bathMin: confirmedEvts.filter(function(e){return e.type==='bathroom';}).reduce(function(a,e){return a+e.duration;},0) || 0,
            outsideMin: confirmedEvts.filter(function(e){return (e.type||'outside')!=='bathroom' && (e.type||'outside')!=='other_person';}).reduce(function(a,e){return a+e.duration;},0) || 0,
            radarCount: radarDropoutEvts.length
        },`,
    'pwa_sleep_tile_build.js: bathMin/outsideMin/radarCount zur Legende hinzugefügt'
);

// ─── FIX 2: pwa_sleep_tile_client.js — Legende um Bad/Außerhalb/Radar erweitern ───
patch(
    'pwa_sleep_tile_client.js',
    `      if (pl.hasBedAbsenceEngine) {
        html +=
          '<span title="Konsens aus State Machine, Pattern-Match und Bad-Sensor (OC-36)"><span style="display:inline-block;width:10px;height:10px;background-color:#6e6e6e;background-image:repeating-linear-gradient(135deg, transparent 0px, transparent 2px, rgba(255,255,255,0.28) 2px, rgba(255,255,255,0.28) 4px);vertical-align:middle;margin-right:3px"></span> Weg vom Bett</span>';
      }
      html += '</div>';`,
    `      if (L.bathMin) {
        html += '<span><span style="display:inline-block;width:10px;height:10px;background:#ffb300;vertical-align:middle;margin-right:3px;border-radius:2px"></span> Bad ' + esc(L.bathMin) + ' min</span>';
      }
      if (L.outsideMin) {
        html += '<span><span style="display:inline-block;width:10px;height:10px;background:#e53935;vertical-align:middle;margin-right:3px;border-radius:2px"></span> Au\u00dferhalb ' + esc(L.outsideMin) + ' min</span>';
      }
      if (L.radarCount) {
        html += '<span style="color:var(--muted)" title="FP2-Radar kurz ausgefallen, kein Au\u00dfensensor best\u00e4tigt">\u25b2 ' + esc(L.radarCount) + '\u00d7 Radar-Aussetzer</span>';
      }
      if (pl.hasBedAbsenceEngine) {
        html +=
          '<span title="Konsens aus State Machine, Pattern-Match und Bad-Sensor (OC-36)"><span style="display:inline-block;width:10px;height:10px;background-color:#6e6e6e;background-image:repeating-linear-gradient(135deg, transparent 0px, transparent 2px, rgba(255,255,255,0.28) 2px, rgba(255,255,255,0.28) 4px);vertical-align:middle;margin-right:3px"></span> Weg vom Bett</span>';
      }
      html += '</div>';`,
    'pwa_sleep_tile_client.js: Bad/Außerhalb/Radar-Aussetzer zur Legende hinzugefügt'
);

// ─── FIX 3: pwa_server.js — parsed.report als erstes Feld im Fallback ───
patch(
    'pwa_server.js',
    `rawDay = parsed.summary || parsed.analyse || parsed.text || parsed.antwort || parsed.status_bericht || parsed.message || rawDay;`,
    `rawDay = parsed.report || parsed.summary || parsed.analyse || parsed.text || parsed.antwort || parsed.status_bericht || parsed.message || rawDay;`,
    'pwa_server.js: parsed.report als Feld-Fallback für KI-Analyse hinzugefügt'
);

console.log('\nAlle 3 Patches erfolgreich angewendet.');
