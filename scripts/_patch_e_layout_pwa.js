/**
 * E (PWA): Schlafkachel-Header Neugestaltung
 * - Primaer (gross): Eingeschlafen (links) + Aufgewacht (rechts)
 * - Sekundaer (klein): Ins Bett gegangen (links oben) + Aufstehen (rechts unten)
 * - Dauer-Badges: Einschlaf-Latenz (Ins Bett -> Eingeschlafen), Aufwach-Latenz (Aufgewacht -> Aufstehen)
 *
 * Aendert: src/lib/pwa_sleep_tile_build.js (neue View-Model-Felder)
 *          src/lib/pwa_sleep_tile_client.js (Header-Rendering links + rechts)
 */
'use strict';
const fs = require('fs');
const path = require('path');

function patch(file, edits) {
  const p = path.join(__dirname, '..', file);
  let src = fs.readFileSync(p, 'utf8');
  const NL = src.includes('\r\n') ? '\r\n' : '\n';
  const L = s => s.split('\n').join(NL);
  edits.forEach(function(e) {
    const a = L(e.anchor);
    if (!src.includes(a)) { console.error('FEHLER ' + file + ': Anker nicht gefunden -> ' + e.label); process.exit(1); }
    if (e.guard && src.includes(L(e.guard))) { console.error('FEHLER ' + file + ': bereits gepatcht -> ' + e.label); process.exit(1); }
    src = src.replace(a, L(e.replacement));
    console.log('OK ' + file + ': ' + e.label);
  });
  fs.writeFileSync(p, src, 'utf8');
}

// ───────────────────────── BUILD: neue View-Model-Felder ─────────────────────────
patch('src/lib/pwa_sleep_tile_build.js', [{
  label: 'headerCommon neue Felder',
  guard: 'einschlafTime: fmtTime(swStart)',
  anchor: `        leftSource: srcDisplay.icon + ' ' + srcDisplay.label,`,
  replacement: `        leftSource: srcDisplay.icon + ' ' + srcDisplay.label,
        einschlafTime: fmtTime(swStart),
        bedEntryTime: bedEntryTsVal != null ? fmtTime(bedEntryTsVal) : null,
        sleepLatencyText: (bedEntryTsVal != null && swStart && swStart > bedEntryTsVal) ? fmtDuration(Math.round((swStart - bedEntryTsVal) / 60000)) : null,
        aufgewachtTime: swEnd != null ? fmtTime(swEnd) : (wakeDisplayTs != null ? fmtTime(wakeDisplayTs) : '\\u2014'),
        aufstehenTime: (bedExitTs != null && swEnd != null && bedExitTs > swEnd) ? fmtTime(bedExitTs) : null,
        wakeLatencyText: (bedExitTs != null && swEnd != null && bedExitTs > swEnd) ? fmtDuration(Math.round((bedExitTs - swEnd) / 60000)) : null,`
}]);

// ───────────────────────── CLIENT: Header links + rechts ─────────────────────────
patch('src/lib/pwa_sleep_tile_client.js', [
{
  label: 'Header LINKS (Eingeschlafen primaer)',
  guard: "// [E] Eingeschlafen primaer",
  anchor: `  row += '<div style="flex:1;min-width:100px">';
  row += '<div style="font-size:0.75rem;color:var(--muted)">' + esc(H.leftTitle) + '</div>';
  row +=
    '<div style="font-size:1.1rem;font-weight:bold;color:var(--text)">' + esc(H.leftTime) + '</div>';
  if (H.leftSubEinschlaf) {
    row +=
      '<div style="font-size:0.58rem;color:var(--muted);margin-top:2px">Eingeschlafen: ' +
      esc(H.leftSubEinschlaf) +
      '</div>';
  }
  if (H.leftSubHint) {
    row +=
      '<div style="font-size:0.58rem;color:var(--muted);margin-top:2px;font-style:italic">' +
      esc(H.leftSubHint) +
      '</div>';
  }
  row += '<div style="font-size:0.6rem;color:var(--muted);margin-top:2px">' + esc(H.leftSource) + '</div>';
  if (H.sleepStartOverridden) {
    row += '<div style="font-size:0.5rem;color:#ffb300;margin-top:2px">manuell</div>';
  }
  row += '</div>';`,
  replacement: `  // [E] Eingeschlafen primaer, Ins Bett gegangen sekundaer oben + Latenz-Badge
  row += '<div style="flex:1;min-width:100px">';
  if (H.bedEntryTime) {
    row += '<div style="font-size:0.7rem;color:var(--muted)">Ins Bett gegangen</div>';
    row += '<div style="font-size:0.9rem;font-weight:600;color:var(--text)">' + esc(H.bedEntryTime) + '</div>';
    if (H.sleepLatencyText) {
      row += '<div style="font-size:0.6rem;color:#ff9800;border:1px solid rgba(255,152,0,0.4);border-radius:4px;padding:1px 5px;display:inline-block;margin:3px 0">\\u2193 ' + esc(H.sleepLatencyText) + '</div>';
    }
  } else if (H.leftSubHint) {
    row += '<div style="font-size:0.7rem;color:var(--muted)">Ins Bett gegangen</div>';
    row += '<div style="font-size:0.58rem;color:var(--muted);font-style:italic;margin-bottom:3px">' + esc(H.leftSubHint) + '</div>';
  }
  row += '<div style="font-size:1.4rem;font-weight:bold;color:var(--text);line-height:1.1">' + esc(H.einschlafTime) + '</div>';
  row += '<div style="font-size:0.7rem;color:var(--muted)">Eingeschlafen</div>';
  row += '<div style="font-size:0.6rem;color:var(--muted);margin-top:2px">' + esc(H.leftSource) + '</div>';
  if (H.sleepStartOverridden) {
    row += '<div style="font-size:0.5rem;color:#ffb300;margin-top:2px">manuell</div>';
  }
  row += '</div>';`
},
{
  label: 'Header RECHTS (Aufgewacht primaer)',
  guard: "// [E] Aufgewacht primaer",
  anchor: `  row += '<div style="flex:1;min-width:100px;text-align:right">';
  row += '<div style="font-size:0.75rem;color:var(--muted)">Aufstehen</div>';
  row +=
    '<div style="font-size:1.1rem;font-weight:bold;color:var(--text)">' + esc(H.wakeTime) + '</div>';
  // Symmetrie-Fix: Sub-Zeit (Aufgewacht) zuerst, dann Source, dann Status -> analog Links-Seite
  if (H.wakeSubAufgewacht) {
    row +=
      '<div style="font-size:0.58rem;color:var(--muted);margin-top:2px">Aufgewacht: ' +
      esc(H.wakeSubAufgewacht) +
      '</div>';
  }
  row +=
    '<div style="font-size:0.6rem;color:var(--muted);margin-top:2px">' + esc(H.wakeSourceLine) + '</div>';
  if (H.provisional) {
    row +=
      '<div style="display:inline-block;margin-top:4px;font-size:0.62rem;font-weight:bold;color:#ff6d00;border:1px solid rgba(255,109,0,0.4);border-radius:4px;padding:2px 6px">vorl\\u00e4ufig</div>';
  } else {
    row +=
      '<div style="font-size:0.58rem;color:var(--muted);margin-top:2px">best\\u00e4tigt</div>';
  }
  if (H.wakeOverridden) {
    row += '<div style="font-size:0.5rem;color:#ffb300;margin-top:2px">manuell</div>';
  }
  row += '</div></div>';`,
  replacement: `  // [E] Aufgewacht primaer, Aufstehen sekundaer unten + Latenz-Badge
  row += '<div style="flex:1;min-width:100px;text-align:right">';
  row += '<div style="font-size:1.4rem;font-weight:bold;color:var(--text);line-height:1.1">' + esc(H.aufgewachtTime) + '</div>';
  row += '<div style="font-size:0.7rem;color:var(--muted)">Aufgewacht</div>';
  if (H.aufstehenTime) {
    if (H.wakeLatencyText) {
      row += '<div style="font-size:0.6rem;color:#ff9800;border:1px solid rgba(255,152,0,0.4);border-radius:4px;padding:1px 5px;display:inline-block;margin:3px 0">\\u2193 ' + esc(H.wakeLatencyText) + '</div>';
    }
    row += '<div style="font-size:0.7rem;color:var(--muted)">Aufstehen</div>';
    row += '<div style="font-size:0.9rem;font-weight:600;color:var(--text)">' + esc(H.aufstehenTime) + '</div>';
  }
  row += '<div style="font-size:0.6rem;color:var(--muted);margin-top:2px">' + esc(H.wakeSourceLine) + '</div>';
  if (H.provisional) {
    row += '<div style="display:inline-block;margin-top:4px;font-size:0.62rem;font-weight:bold;color:#ff6d00;border:1px solid rgba(255,109,0,0.4);border-radius:4px;padding:2px 6px">vorl\\u00e4ufig</div>';
  } else {
    row += '<div style="font-size:0.58rem;color:var(--muted);margin-top:2px">best\\u00e4tigt</div>';
  }
  if (H.wakeOverridden) {
    row += '<div style="font-size:0.5rem;color:#ffb300;margin-top:2px">manuell</div>';
  }
  row += '</div></div>';`
}
]);

console.log('Fertig: E-Layout PWA gepatcht.');
