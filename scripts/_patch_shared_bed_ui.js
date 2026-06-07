/**
 * Patch: Shared-Bed-Visualisierung in PWA-Schlafkachel
 * Betrifft: src/lib/pwa_sleep_tile_build.js + src/lib/pwa_sleep_tile_client.js
 */
const fs = require('fs');
const path = require('path');

function fix(filePath, oldStr, newStr) {
    let content = fs.readFileSync(filePath, 'utf8');
    // Versuche exakt, dann mit normalisiertem Whitespace
    if (content.includes(oldStr)) {
        content = content.replace(oldStr, newStr);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('OK (exact):', path.basename(filePath));
        return true;
    }
    // CRLF-Variante
    const oldCRLF = oldStr.replace(/\n/g, '\r\n');
    if (content.includes(oldCRLF)) {
        content = content.replace(oldCRLF, newStr);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('OK (crlf):', path.basename(filePath));
        return true;
    }
    console.error('FEHLER: String nicht gefunden in', path.basename(filePath));
    console.error('Suche nach:', JSON.stringify(oldStr.slice(0, 80)));
    return false;
}

const BUILD  = path.join(__dirname, '..', 'src', 'lib', 'pwa_sleep_tile_build.js');
const CLIENT = path.join(__dirname, '..', 'src', 'lib', 'pwa_sleep_tile_client.js');

// ─── BUILD: sharedBedOverlays nach wachliegenOverlay-Block einfügen ──────────
fix(BUILD,
`    const segments = [];`,
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

    const segments = [];`
);

// ─── BUILD: sharedBedMin zur legend hinzufügen ────────────────────────────────
fix(BUILD,
`            radarCount: radarDropoutEvts.length
        },`,
`            radarCount: radarDropoutEvts.length,
            sharedBedMin: (function() {
                if (!sd.sharedBedPeriods || !sd.sharedBedPeriods.length) return 0;
                return Math.round(sd.sharedBedPeriods.reduce(function(a, p) {
                    return a + (p.end && p.start ? (p.end - p.start) / 60000 : 0);
                }, 0));
            })()
        },`
);

// ─── BUILD: sharedBedOverlays zum return-Objekt hinzufügen ───────────────────
fix(BUILD,
`        bedAbsenceOverlays: bedAbsenceOverlays,
        smWakeOverlays: smWakeOverlays,
        wachliegenOverlay: wachliegenOverlay`,
`        bedAbsenceOverlays: bedAbsenceOverlays,
        smWakeOverlays: smWakeOverlays,
        wachliegenOverlay: wachliegenOverlay,
        sharedBedOverlays: sharedBedOverlays`
);

// ─── CLIENT: sharedBedOverlays auf dem Balken rendern ────────────────────────
fix(CLIENT,
`      html +=
        '<div class="pwa-sleep-bar-hit"`,
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
      html +=
        '<div class="pwa-sleep-bar-hit"'`
);

// ─── CLIENT: sharedBedMin in Legende anzeigen ────────────────────────────────
// Achtung: Datei enthaelt literale \uXXXX-Escape-Sequenzen als Text (kein echtes Unicode)
fix(CLIENT,
      "      if (pl.hasBedAbsenceEngine) {",
      "      if (L.sharedBedMin && L.sharedBedMin > 0) _secParts.push('<span title=\"Radar erkannte zwei Personen im Bett\"><span style=\"display:inline-block;width:8px;height:8px;background:rgba(0,0,0,0.6);vertical-align:middle;margin-right:3px;border-radius:2px\"></span>Zwei Personen: ' + esc(L.sharedBedMin) + ' min</span>');\n      if (pl.hasBedAbsenceEngine) {"
);

console.log('\nPatch abgeschlossen.');
