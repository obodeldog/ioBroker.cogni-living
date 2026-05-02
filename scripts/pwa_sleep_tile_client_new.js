function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function renderSleepTileFromPayload(body, pl) {
  if (!body) return;
  if (!pl || pl.view === 'none') {
    body.innerHTML = '';
    return;
  }
  if (pl.view === 'goodNight') {
    body.innerHTML =
      '<div style="text-align:center;padding:16px 8px;color:var(--muted);font-size:0.85rem">' +
      '<div style="font-size:1.3rem;margin-bottom:6px">\uD83C\uDF19</div>' +
      '<div style="font-weight:600;margin-bottom:4px;color:var(--text)">Gute Nacht</div>' +
      '<div>Nacht noch nicht begonnen</div></div>';
    return;
  }
  if (pl.view === 'bedEmpty') {
    var h = '<div style="font-size:0.8rem">';
    if (pl.nightLabel) {
      h +=
        '<div style="font-size:0.65rem;color:var(--muted);margin-bottom:8px;text-align:center">' +
        esc(pl.nightLabel) +
        '</div>';
    }
    h +=
      '<div style="text-align:center;padding:12px;background:rgba(0,0,0,0.04);border-radius:8px">' +
      '<div style="font-size:0.9rem;font-weight:bold;margin-bottom:4px">Bett war leer</div>';
    if (pl.swStartFmt && pl.swEndFmt) {
      h +=
        '<div style="font-size:0.7rem;color:var(--muted);margin-top:6px">Garmin-Ref: ' +
        esc(pl.swStartFmt) +
        ' \u2013 ' +
        esc(pl.swEndFmt) +
        (pl.garminScore != null ? ' \u00b7 Score ' + esc(pl.garminScore) : '') +
        '</div>';
    }
    h += '</div></div>';
    body.innerHTML = h;
    return;
  }
  var H = pl.header;
  if (!H) {
    body.innerHTML = '';
    return;
  }
  var row =
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;flex-wrap:wrap">';
  row += '<div style="flex:1;min-width:100px">';
  row += '<div style="font-size:0.75rem;color:var(--muted)">' + esc(H.leftTitle) + '</div>';
  row +=
    '<div style="font-size:1.1rem;font-weight:bold;color:var(--text)">' + esc(H.leftTime) + '</div>';
  if (H.leftSubEinschlaf) {
    row +=
      '<div style="font-size:0.58rem;color:var(--muted);margin-top:2px">Eingeschlafen: ' +
      esc(H.leftSubEinschlaf) +
      '</div>';
  }
  row += '<div style="font-size:0.6rem;color:var(--muted);margin-top:2px">' + esc(H.leftSource) + '</div>';
  if (H.sleepStartOverridden) {
    row += '<div style="font-size:0.5rem;color:#ffb300;margin-top:2px">manuell</div>';
  }
  row += '</div>';
  row += '<div style="flex:1;min-width:120px;text-align:center">';
  var sc = H.score != null ? Math.round(H.score) : '\u2014';
  row +=
    '<div style="font-size:1.75rem;font-weight:bold;border:2px solid ' +
    esc(H.scoreColor) +
    ';color:' +
    esc(H.scoreColor) +
    ';border-radius:8px;padding:4px 12px;display:inline-block">' +
    esc(sc) +
    '</div>';
  row += '<div style="font-size:0.65rem;color:var(--muted);margin-top:4px">AURA-Sleepscore</div>';
  if (H.scoreCalStatus === 'calibrated') {
    row +=
      '<div style="font-size:0.55rem;color:#43a047;margin-top:2px">kalibriert (' +
      esc(H.scoreCalNights) +
      'N)</div>';
  } else if (H.scoreCalStatus === 'calibrating') {
    row +=
      '<div style="font-size:0.55rem;color:#ffa726;margin-top:2px">kalibriert (' +
      esc(H.scoreCalNights) +
      '/14N)</div>';
  } else {
    row += '<div style="font-size:0.55rem;color:var(--muted);margin-top:2px">unkalibriert</div>';
  }
  if (H.scoreCal != null && H.scoreRaw != null && H.scoreCal !== H.scoreRaw) {
    row +=
      '<div style="font-size:0.55rem;color:var(--muted);margin-top:2px">Roh: ' + esc(H.scoreRaw) + '</div>';
  }
  if (H.sleepDurText) {
    row +=
      '<div style="font-size:0.7rem;color:#1565c0;margin-top:4px;font-weight:600">' +
      esc(H.sleepDurText) +
      '</div>';
  }
  if (H.garminScore != null) {
    var dlt = H.garminDelta != null ? (H.garminDelta >= 0 ? '+' : '') + Math.round(H.garminDelta) : '';
    row +=
      '<div style="font-size:0.7rem;color:#ab47bc;margin-top:2px">Garmin: ' +
      esc(H.garminScore) +
      (dlt !== '' ? ' (' + esc(dlt) + ')' : '') +
      '</div>';
  }
  row += '</div>';
  row += '<div style="flex:1;min-width:100px;text-align:right">';
  row += '<div style="font-size:0.75rem;color:var(--muted)">Aufstehen</div>';
  row +=
    '<div style="font-size:1.1rem;font-weight:bold;color:var(--text)">' + esc(H.wakeTime) + '</div>';
  row +=
    '<div style="font-size:0.6rem;color:var(--muted);margin-top:2px">' + esc(H.wakeSourceLine) + '</div>';
  if (H.wakeSubAufgewacht) {
    row +=
      '<div style="font-size:0.58rem;color:var(--muted);margin-top:2px">Aufgewacht: ' +
      esc(H.wakeSubAufgewacht) +
      '</div>';
  }
  if (H.provisional) {
    row +=
      '<div style="display:inline-block;margin-top:4px;font-size:0.62rem;font-weight:bold;color:#ff6d00;border:1px solid rgba(255,109,0,0.4);border-radius:4px;padding:2px 6px">vorl\u00e4ufig</div>';
  } else {
    row +=
      '<div style="font-size:0.58rem;color:var(--muted);margin-top:2px">best\u00e4tigt</div>';
  }
  if (H.wakeOverridden) {
    row += '<div style="font-size:0.5rem;color:#ffb300;margin-top:2px">manuell</div>';
  }
  row += '</div></div>';
  var html = row;
  if (pl.view === 'degraded' && pl.hint) {
    html +=
      '<div style="font-size:0.72rem;color:var(--muted);margin-bottom:8px;border-top:1px dashed var(--border);padding-top:8px">' +
      esc(pl.hint) +
      '</div>';
  }

  if (pl.view === 'full') {
    var STAGE_MARK = { bathroom: '#ffb300', outside: '#e53935', other_person: '#1e88e5' };
    var nPre = pl.markersPreSleep ? pl.markersPreSleep.length : 0;
    var nAbv = pl.markersAbove ? pl.markersAbove.length : 0;
    var nBlw = pl.markersBelow ? pl.markersBelow.length : 0;
    var nDrp = pl.markersDropout ? pl.markersDropout.length : 0;
    var hasAbove = nPre > 0 || nAbv > 0;
    var hasBelow = nBlw > 0 || nDrp > 0;
    if (hasAbove) {
      html += '<div style="position:relative;height:18px;margin-bottom:2px">';
      for (var pi = 0; pi < nPre; pi++) {
        var pm = pl.markersPreSleep[pi];
        html +=
          '<span style="position:absolute;left:' +
          pm.pct +
          '%;top:3px;color:' +
          pm.color +
          ';font-size:14px;font-weight:bold;transform:translateX(-50%);cursor:default;line-height:13px" title="' +
          esc(pm.title) +
          '">\u25BC</span>';
      }
      for (var ai = 0; ai < nAbv; ai++) {
        var am = pl.markersAbove[ai];
        var colA = STAGE_MARK[am.evtType] || '#ffb300';
        var topA = am.lane === 0 ? '3px' : '-9px';
        html +=
          '<span style="position:absolute;left:' +
          am.pct +
          '%;top:' +
          topA +
          ';color:' +
          colA +
          ';font-size:14px;font-weight:bold;transform:translateX(-50%);cursor:default;line-height:13px" title="' +
          esc(am.title) +
          '">\u25BC</span>';
      }
      html += '</div>';
    } else if (hasBelow) {
      html += '<div style="height:18px;margin-bottom:2px"></div>';
    }

    if (pl.segments && pl.segments.length) {
      html += '<div style="position:relative;width:100%">';
      html +=
        '<div style="display:flex;width:100%;height:28px;border-radius:4px;overflow:hidden;margin:4px 0">';
      for (var si = 0; si < pl.segments.length; si++) {
        var seg = pl.segments[si];
        var w = Math.min(100, Math.max(0, seg.wPct));
        var bg = seg.bg;
        if (bg === 'preStage' || bg === 'postStage') {
          bg =
            'repeating-linear-gradient(45deg, var(--card), var(--card) 4px, var(--border) 4px, var(--border) 8px)';
        }
        var op = seg.opacity != null ? seg.opacity : 1;
        html +=
          '<div style="width:' +
          w +
          '%;flex-shrink:0;background:' +
          bg +
          ';opacity:' +
          op +
          ';min-width:0" title="' +
          esc(seg.tip || '') +
          '"></div>';
      }
      html += '</div>';

      if (hasBelow) {
        html += '<div style="position:relative;height:18px;margin-top:2px;margin-bottom:2px">';
        for (var bi = 0; bi < nBlw; bi++) {
          var bm = pl.markersBelow[bi];
          var colB = STAGE_MARK[bm.evtType] || '#e53935';
          var topB = bm.lane === 0 ? '2px' : '10px';
          html +=
            '<span style="position:absolute;left:' +
            bm.pct +
            '%;top:' +
            topB +
            ';color:' +
            colB +
            ';font-size:14px;font-weight:bold;transform:translateX(-50%);cursor:default;line-height:13px" title="' +
            esc(bm.title) +
            '">\u25B2</span>';
        }
        for (var di = 0; di < nDrp; di++) {
          var dm = pl.markersDropout[di];
          var topD = dm.lane === 0 ? '4px' : '11px';
          html +=
            '<span style="position:absolute;left:' +
            dm.pct +
            '%;top:' +
            topD +
            ';color:#999;font-size:11px;font-weight:normal;transform:translateX(-50%);cursor:default;line-height:11px;opacity:0.7" title="' +
            esc(dm.title) +
            '">\u25B2</span>';
        }
        html += '</div>';
      }

      if (pl.timeAxis) {
        var TA = pl.timeAxis;
        html += '<div style="position:relative;height:14px;margin-top:3px;margin-bottom:6px">';
        html +=
          '<span style="position:absolute;left:0;font-size:0.55rem;color:var(--muted)">' +
          esc(TA.left) +
          '</span>';
        var ticks = TA.ticks || [];
        for (var ti = 0; ti < ticks.length; ti++) {
          var tk = ticks[ti];
          html +=
            '<span style="position:absolute;left:' +
            tk.pct +
            '%;font-size:0.55rem;color:var(--muted);transform:translateX(-50%)">' +
            esc(tk.label) +
            '</span>';
        }
        html +=
          '<span style="position:absolute;right:0;font-size:0.55rem;color:var(--muted)">' +
          esc(TA.right) +
          '</span>';
        html += '</div>';
      }
      html += '</div>';
    }

    if (pl.legend) {
      var L = pl.legend;
      html += '<div style="display:flex;flex-wrap:wrap;gap:10px;font-size:0.72rem;margin:8px 0;color:var(--text)">';
      html += '<span><span style="color:#1565c0">\u25cf</span> Tief ' + esc(L.deepMin) + ' min</span>';
      html += '<span><span style="color:#42a5f5">\u25cf</span> Leicht ' + esc(L.lightMin) + ' min</span>';
      html += '<span><span style="color:#ab47bc">\u25cf</span> REM ' + esc(L.remMin) + ' min</span>';
      html += '<span><span style="color:#ffd54f">\u25cf</span> Wach ' + esc(L.wakeMin) + ' min</span>';
      html += '</div>';
    }
  }

  if (pl.view === 'full' && pl.garminPhases) {
    var G = pl.garminPhases;
    html += '<div style="font-size:0.72rem;color:var(--muted);margin-top:4px;border-top:1px solid var(--border);padding-top:8px">';
    html += 'Smartwatch-Referenz: ';
    if (G.deep != null) html += 'Tief ' + esc(G.deep) + ' min \u00b7 ';
    if (G.light != null) html += 'Leicht ' + esc(G.light) + ' min \u00b7 ';
    if (G.rem != null) html += 'REM ' + esc(G.rem) + ' min';
    if (G.score != null) html += ' \u00b7 Score ' + esc(G.score);
    html += '</div>';
  }
  if (pl.disclaimer) {
    html +=
      '<div style="font-size:0.65rem;color:var(--muted);margin-top:10px;line-height:1.4">Gesch\u00e4tzte Schlafstadien (Vibrationssensor) \u00b7 Kein Medizinprodukt</div>';
  }
  body.innerHTML = html;
}
