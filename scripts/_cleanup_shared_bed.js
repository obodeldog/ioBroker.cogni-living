/**
 * Bereinigt Duplikate die durch doppelten Patch-Lauf entstanden sind
 */
const fs = require('fs');
const path = require('path');

function fixFile(filePath, oldStr, newStr, label) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(oldStr)) {
        content = content.replace(oldStr, newStr);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('OK:', label);
        return true;
    }
    // CRLF fallback
    const oldCRLF = oldStr.replace(/\n/g, '\r\n');
    if (content.includes(oldCRLF)) {
        content = content.replace(oldCRLF, newStr);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('OK (crlf):', label);
        return true;
    }
    console.error('FEHLER:', label);
    return false;
}

const BUILD  = path.join(__dirname, '..', 'src', 'lib', 'pwa_sleep_tile_build.js');
const CLIENT = path.join(__dirname, '..', 'src', 'lib', 'pwa_sleep_tile_client.js');

// ─── BUILD: Duplikat sharedBedOverlays-Block entfernen ────────────────────────
fixFile(BUILD,
`    // [OC-SB] Shared-Bed-Overlays (schwarze Balken: 2+ Personen im Bett erkannt)
    var sharedBedOverlays = [];
    if (swStart && newBarTotalMs > 0 && sd.sharedBedPeriods && sd.sharedBedPeriods.length > 0) {
        var _barBaseSB = bedEntryTsVal != null ? bedEntryTsVal : swStart;
        sd.sharedBedPeriods.forEach(function(p) {
            if (!p.start || !p.end || p.end <= p.start) return;
            var _leftSB = Math.max(0, Math.min(100, ((p.start - _barBaseSB) / newBarTotalMs) * 100));
            var _widthSB = Math.max(0.5, Math.min(100 - _leftSB, ((p.end - p.start) / newBarTotalMs) * 100));
            var _durSB = Math.max(1, Math.round((p.end - p.start) / 60000));
            sharedBedOverlays.push({
                leftPct: _leftSB,
                widthPct: _widthSB,
                title: '\uD83D\uDC65 Zwei Personen im Bett: ' + fmtTime(p.start) + ' \u2013 ' + fmtTime(p.end) + ' (' + _durSB + ' Min)'
            });
        });
    }

    // [OC-SB] Shared-Bed-Overlays (schwarze Balken: 2+ Personen im Bett erkannt)
    var sharedBedOverlays = [];
    if (swStart && newBarTotalMs > 0 && sd.sharedBedPeriods && sd.sharedBedPeriods.length > 0) {
        var _barBaseSB = bedEntryTsVal != null ? bedEntryTsVal : swStart;
        sd.sharedBedPeriods.forEach(function(p) {
            if (!p.start || !p.end || p.end <= p.start) return;
            var _leftSB = Math.max(0, Math.min(100, ((p.start - _barBaseSB) / newBarTotalMs) * 100));
            var _widthSB = Math.max(0.5, Math.min(100 - _leftSB, ((p.end - p.start) / newBarTotalMs) * 100));
            var _durSB = Math.max(1, Math.round((p.end - p.start) / 60000));
            sharedBedOverlays.push({
                leftPct: _leftSB,
                widthPct: _widthSB,
                title: '\uD83D\uDC65 Zwei Personen im Bett: ' + fmtTime(p.start) + ' \u2013 ' + fmtTime(p.end) + ' (' + _durSB + ' Min)'
            });
        });
    }`,
`    // [OC-SB] Shared-Bed-Overlays (schwarze Balken: 2+ Personen im Bett erkannt)
    var sharedBedOverlays = [];
    if (swStart && newBarTotalMs > 0 && sd.sharedBedPeriods && sd.sharedBedPeriods.length > 0) {
        var _barBaseSB = bedEntryTsVal != null ? bedEntryTsVal : swStart;
        sd.sharedBedPeriods.forEach(function(p) {
            if (!p.start || !p.end || p.end <= p.start) return;
            var _leftSB = Math.max(0, Math.min(100, ((p.start - _barBaseSB) / newBarTotalMs) * 100));
            var _widthSB = Math.max(0.5, Math.min(100 - _leftSB, ((p.end - p.start) / newBarTotalMs) * 100));
            var _durSB = Math.max(1, Math.round((p.end - p.start) / 60000));
            sharedBedOverlays.push({
                leftPct: _leftSB,
                widthPct: _widthSB,
                title: '\uD83D\uDC65 Zwei Personen im Bett: ' + fmtTime(p.start) + ' \u2013 ' + fmtTime(p.end) + ' (' + _durSB + ' Min)'
            });
        });
    }`,
'BUILD: Duplikat sharedBedOverlays-Block entfernt'
);

// ─── BUILD: Duplikat in return-Objekt entfernen ───────────────────────────────
fixFile(BUILD,
`        sharedBedOverlays: sharedBedOverlays,
        sharedBedOverlays: sharedBedOverlays`,
`        sharedBedOverlays: sharedBedOverlays`,
'BUILD: Duplikat sharedBedOverlays in return entfernt'
);

// ─── CLIENT: Duplikat sharedBedOverlays-Rendering entfernen ──────────────────
fixFile(CLIENT,
`      // [OC-SB] Shared-Bed-Overlays: schwarzes Segment wenn 2 Personen erkannt
      var _sbOvl = pl.sharedBedOverlays || [];
      for (var _sbx = 0; _sbx < _sbOvl.length; _sbx++) {
        var _sbo = _sbOvl[_sbx];
        html +=
          '<div style="position:absolute;top:0;left:' +
          _sbo.leftPct +
          '%;width:' +
          _sbo.widthPct +
          '%;height:28px;background-color:rgba(0,0,0,0.55);pointer-events:none;z-index:3;box-sizing:border-box;border-left:2px solid #111;border-right:1px solid #111" title="' +
          esc(_sbo.title) +
          '"></div>';
      }
      // [OC-SB] Shared-Bed-Overlays: schwarzes Segment wenn 2 Personen erkannt
      var _sbOvl = pl.sharedBedOverlays || [];
      for (var _sbx = 0; _sbx < _sbOvl.length; _sbx++) {
        var _sbo = _sbOvl[_sbx];
        html +=
          '<div style="position:absolute;top:0;left:' +
          _sbo.leftPct +
          '%;width:' +
          _sbo.widthPct +
          '%;height:28px;background-color:rgba(0,0,0,0.55);pointer-events:none;z-index:3;box-sizing:border-box;border-left:2px solid #111;border-right:1px solid #111" title="' +
          esc(_sbo.title) +
          '"></div>';
      }`,
`      // [OC-SB] Shared-Bed-Overlays: schwarzes Segment wenn 2 Personen erkannt
      var _sbOvl = pl.sharedBedOverlays || [];
      for (var _sbx = 0; _sbx < _sbOvl.length; _sbx++) {
        var _sbo = _sbOvl[_sbx];
        html +=
          '<div style="position:absolute;top:0;left:' +
          _sbo.leftPct +
          '%;width:' +
          _sbo.widthPct +
          '%;height:28px;background-color:rgba(0,0,0,0.55);pointer-events:none;z-index:3;box-sizing:border-box;border-left:2px solid #111;border-right:1px solid #111" title="' +
          esc(_sbo.title) +
          '"></div>';
      }`,
'CLIENT: Duplikat sharedBedOverlays-Rendering entfernt'
);

// ─── CLIENT: Syntaxfehler "pwa-sleep-bar-hit"'' beheben ──────────────────────
fixFile(CLIENT,
`'<div class="pwa-sleep-bar-hit"'' style=`,
`'<div class="pwa-sleep-bar-hit" style=`,
"CLIENT: Syntaxfehler pwa-sleep-bar-hit bereinigt"
);

console.log('\nBereinigung abgeschlossen.');
