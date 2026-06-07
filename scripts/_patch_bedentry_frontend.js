// Patch-Skript Frontend: "Ins Bett gegangen"-Hinweis wenn kein plausibler Wert
const fs = require('fs');
const path = require('path');

function patchFile(rel, edits) {
    const file = path.join(__dirname, '..', rel);
    let src = fs.readFileSync(file, 'utf8');
    const tryEols = ['\n', '\r\n'];
    edits.forEach(([label, oldRaw, newRaw]) => {
        let matched = false;
        for (const EOL of tryEols) {
            const oldStr = oldRaw.replace(/\n/g, EOL);
            const newStr = newRaw.replace(/\n/g, EOL);
            const idx = src.indexOf(oldStr);
            if (idx === -1) continue;
            if (src.indexOf(oldStr, idx + 1) !== -1) throw new Error('MEHRFACH [' + rel + ']: ' + label);
            src = src.slice(0, idx) + newStr + src.slice(idx + oldStr.length);
            console.log('OK ' + rel + ' -> ' + label + ' (EOL=' + JSON.stringify(EOL) + ')');
            matched = true;
            break;
        }
        if (!matched) throw new Error('NICHT GEFUNDEN [' + rel + ']: ' + label);
    });
    fs.writeFileSync(file, src, 'utf8');
}

// ---- BUILD: leftSubHint im Null-Fall setzen ----
patchFile('src/lib/pwa_sleep_tile_build.js', [
    ['build_leftSubHint',
`        leftSubEinschlaf:
            _bedEntryRaw && swStart && _bedEntryRaw < swStart - 5 * 60000 ? fmtTime(swStart) : null,
        leftSource: srcDisplay.icon + ' ' + srcDisplay.label,`,
`        leftSubEinschlaf:
            _bedEntryRaw && swStart && _bedEntryRaw < swStart - 5 * 60000 ? fmtTime(swStart) : null,
        leftSubHint:
            !_bedEntryRaw && swStart ? 'Ins Bett gegangen: kein plausibler Wert gefunden' : null,
        leftSource: srcDisplay.icon + ' ' + srcDisplay.label,`]
]);

// ---- CLIENT: leftSubHint rendern (nach leftSubEinschlaf-Block) ----
patchFile('src/lib/pwa_sleep_tile_client.js', [
    ['client_leftSubHint',
`  if (H.leftSubEinschlaf) {
    row +=
      '<div style="font-size:0.58rem;color:var(--muted);margin-top:2px">Eingeschlafen: ' +
      esc(H.leftSubEinschlaf) +
      '</div>';
  }`,
`  if (H.leftSubEinschlaf) {
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
  }`]
]);

console.log('FERTIG');
