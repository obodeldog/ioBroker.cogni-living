'use strict';
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'src', 'lib', 'pwa_sleep_tile_client.js');
let src = fs.readFileSync(p, 'utf8');
const crlf = (src.match(/\r\n/g) || []).length;
const lf = (src.match(/(^|[^\r])\n/g) || []).length;
const NL = crlf > lf ? '\r\n' : '\n';
const L = s => s.split('\n').join(NL);
console.log('NL =', JSON.stringify(NL), 'crlf=', crlf, 'lf=', lf);

const edits = [
{
  label: 'Header LINKS (Eingeschlafen primaer)',
  guard: '// [E] Eingeschlafen primaer',
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
  guard: '// [E] Aufgewacht primaer',
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
];

edits.forEach(function(e){
  const a = L(e.anchor);
  if (src.includes(L(e.guard))) { console.error('FEHLER: bereits gepatcht -> ' + e.label); process.exit(1); }
  if (!src.includes(a)) { console.error('FEHLER: Anker nicht gefunden -> ' + e.label); process.exit(1); }
  src = src.replace(a, L(e.replacement));
  console.log('OK: ' + e.label);
});
fs.writeFileSync(p, src, 'utf8');
console.log('Fertig: Client E-Layout gepatcht.');
