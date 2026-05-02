const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'src', 'lib', 'pwa_sleep_tile_client.js');
const x = `function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}
function renderSleepTileFromPayload(body, pl) {
  if (!body) return;
  if (!pl || pl.view === 'none') { body.innerHTML = ''; return; }
  if (pl.view === 'goodNight') {
    body.innerHTML = '<div style="text-align:center;padding:16px 8px;color:var(--muted);font-size:0.85rem">' +
      '<div style="font-size:1.3rem;margin-bottom:6px">\\uD83C\\uDF19</div>' +
      '<div style="font-weight:600;margin-bottom:4px;color:var(--text)">Gute Nacht</div>' +
      '<div>Nacht noch nicht begonnen</div></div>';
    return;
  }
  if (pl.view === 'bedEmpty') {
    var h = '<div style="font-size:0.8rem">';
    if (pl.nightLabel) h += '<div style="font-size:0.65rem;color:var(--muted);margin-bottom:8px;text-align:center">' + esc(pl.nightLabel) + '</div>';
    h += '<div style="text-align:center;padding:12px;background:rgba(0,0,0,0.04);border-radius:8px">' +
      '<div style="font-size:0.9rem;font-weight:bold;margin-bottom:4px">Bett war leer</div>';
    if (pl.swStartFmt && pl.swEndFmt) {
      h += '<div style="font-size:0.7rem;color:var(--muted);margin-top:6px">Garmin-Ref: ' + esc(pl.swStartFmt) + ' \\u2013 ' + esc(pl.swEndFmt) +
        (pl.garminScore != null ? ' \\u00b7 Score ' + esc(pl.garminScore) : '') + '</div>';
    }
    h += '</div></div>';
    body.innerHTML = h;
    return;
  }
  var H = pl.header;
  if (!H) { body.innerHTML = ''; return; }
  var row = '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;flex-wrap:wrap">';
  row += '<div style="flex:1;min-width:100px">';
  row += '<div style="font-size:0.75rem;color:var(--muted)">' + esc(H.leftTitle) + '</div>';
  row += '<div style="font-size:1.1rem;font-weight:bold;color:var(--text)">' + esc(H.leftTime) + '</div>';
  if (H.leftSubEinschlaf) row += '<div style="font-size:0.58rem;color:var(--muted);margin-top:2px">Eingeschlafen: ' + esc(H.leftSubEinschlaf) + '</div>';
  row += '<div style="font-size:0.6rem;color:var(--muted);margin-top:2px">' + esc(H.leftSource) + '</div>';
  if (H.sleepStartOverridden) row += '<div style="font-size:0.5rem;color:#ffb300;margin-top:2px">manuell</div>';
  row += '</div>';
  row += '<div style="flex:1;min-width:120px;text-align:center">';
  var sc = H.score != null ? Math.round(H.score) : '\\u2014';
  row += '<div style="font-size:1.75rem;font-weight:bold;border:2px solid ' + esc(H.scoreColor) + ';color:' + esc(H.scoreColor) + ';border-radius:8px;padding:4px 12px;display:inline-block">' + esc(sc) + '</div>';
  row += '<div style="font-size:0.65rem;color:var(--muted);margin-top:4px">AURA-Sleepscore</div>';
  if (H.scoreCalStatus === 'calibrated') row += '<div style="font-size:0.55rem;color:#43a047;margin-top:2px">kalibriert (' + esc(H.scoreCalNights) + 'N)</div>';
  else if (H.scoreCalStatus === 'calibrating') row += '<div style="font-size:0.55rem;color:#ffa726;margin-top:2px">kalibriert (' + esc(H.scoreCalNights) + '/14N)</div>';
  else row += '<div style="font-size:0.55rem;color:var(--muted);margin-top:2px">unkalibriert</div>';
  if (H.scoreCal != null && H.scoreRaw != null && H.scoreCal !== H.scoreRaw) row += '<div style="font-size:0.55rem;color:var(--muted);margin-top:2px">Roh: ' + esc(H.scoreRaw) + '</div>';
  if (H.sleepDurText) row += '<div style="font-size:0.7rem;color:#1565c0;margin-top:4px;font-weight:600">' + esc(H.sleepDurText) + '</div>';
  if (H.garminScore != null) {
    var dlt = H.garminDelta != null ? (H.garminDelta >= 0 ? '+' : '') + Math.round(H.garminDelta) : '';
    row += '<div style="font-size:0.7rem;color:#ab47bc;margin-top:2px">Garmin: ' + esc(H.garminScore) + (dlt !== '' ? ' (' + esc(dlt) + ')' : '') + '</div>';
  }
  row += '</div>';
  row += '<div style="flex:1;min-width:100px;text-align:right">';
  row += '<div style="font-size:0.75rem;color:var(--muted)">Aufstehen</div>';
  row += '<div style="font-size:1.1rem;font-weight:bold;color:var(--text)">' + esc(H.wakeTime) + '</div>';
  row += '<div style="font-size:0.6rem;color:var(--muted);margin-top:2px">' + esc(H.wakeSourceLine) + '</div>';
  if (H.wakeSubAufgewacht) row += '<div style="font-size:0.58rem;color:var(--muted);margin-top:2px">Aufgewacht: ' + esc(H.wakeSubAufgewacht) + '</div>';
  if (H.provisional) row += '<div style="display:inline-block;margin-top:4px;font-size:0.62rem;font-weight:bold;color:#ff6d00;border:1px solid rgba(255,109,0,0.4);border-radius:4px;padding:2px 6px">vorl\\u00e4ufig</div>';
  else row += '<div style="font-size:0.58rem;color:var(--muted);margin-top:2px">best\\u00e4tigt</div>';
  if (H.wakeOverridden) row += '<div style="font-size:0.5rem;color:#ffb300;margin-top:2px">manuell</div>';
  row += '</div></div>';
  var html = row;
  if (pl.view === 'degraded' && pl.hint) {
    html += '<div style="font-size:0.72rem;color:var(--muted);margin-bottom:8px;border-top:1px dashed var(--border);padding-top:8px">' + esc(pl.hint) + '</div>';
  }
  if (pl.view === 'full' && pl.legend) {
    var L = pl.legend;
    html += '<div style="display:flex;flex-wrap:wrap;gap:10px;font-size:0.72rem;margin:8px 0;color:var(--text)">';
    html += '<span><span style="color:#1565c0">\\u25cf</span> Tief ' + esc(L.deepMin) + ' min</span>';
    html += '<span><span style="color:#42a5f5">\\u25cf</span> Leicht ' + esc(L.lightMin) + ' min</span>';
    html += '<span><span style="color:#ab47bc">\\u25cf</span> REM ' + esc(L.remMin) + ' min</span>';
    html += '<span><span style="color:#ffd54f">\\u25cf</span> Wach ' + esc(L.wakeMin) + ' min</span>';
    html += '</div>';
  }
  if (pl.view === 'full' && pl.segments && pl.segments.length) {
    html += '<div style="display:flex;width:100%;height:28px;border-radius:4px;overflow:hidden;margin:8px 0">';
    for (var i = 0; i < pl.segments.length; i++) {
      var seg = pl.segments[i];
      var w = Math.min(100, Math.max(0, seg.wPct));
      var bg = seg.bg;
      if (bg === 'preStage' || bg === 'postStage') {
        bg = 'repeating-linear-gradient(45deg, var(--card), var(--card) 4px, var(--border) 4px, var(--border) 8px)';
      }
      var op = seg.opacity != null ? seg.opacity : 1;
      html += '<div style="width:' + w + '%;flex-shrink:0;background:' + bg + ';opacity:' + op + ';min-width:0" title="' + esc(seg.tip || '') + '"></div>';
    }
    html += '</div>';
  }
  if (pl.view === 'full' && pl.garminPhases) {
    var G = pl.garminPhases;
    html += '<div style="font-size:0.72rem;color:var(--muted);margin-top:4px;border-top:1px solid var(--border);padding-top:8px">';
    html += 'Smartwatch-Referenz: ';
    if (G.deep != null) html += 'Tief ' + esc(G.deep) + ' min \\u00b7 ';
    if (G.light != null) html += 'Leicht ' + esc(G.light) + ' min \\u00b7 ';
    if (G.rem != null) html += 'REM ' + esc(G.rem) + ' min';
    if (G.score != null) html += ' \\u00b7 Score ' + esc(G.score);
    html += '</div>';
  }
  if (pl.disclaimer) {
    html += '<div style="font-size:0.65rem;color:var(--muted);margin-top:10px;line-height:1.4">Gesch\\u00e4tzte Schlafstadien (Vibrationssensor) \\u00b7 Kein Medizinprodukt</div>';
  }
  body.innerHTML = html;
}
`;
fs.writeFileSync(p, x, 'utf8');
console.log('wrote', p);
