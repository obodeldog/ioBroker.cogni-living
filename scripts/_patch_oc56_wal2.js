// OC-56 Nachzügler: recorder.js WAL-Append (CRLF-tolerant)
'use strict';
const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'src', 'lib', 'recorder.js');
let txt = fs.readFileSync(p, 'utf8');

if (txt.indexOf('[OC-56] Write-Ahead-Eventlog') !== -1) {
    console.log('SKIP: schon gepatcht');
    process.exit(0);
}

const eol = txt.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
const oldStr = [
    '    adapter.eventHistory.unshift(eventObj);',
    '    if (adapter.eventHistory.length > HISTORY_MAX_SIZE) adapter.eventHistory.pop();'
].join(eol);

const newStr = [
    '    adapter.eventHistory.unshift(eventObj);',
    '    if (adapter.eventHistory.length > HISTORY_MAX_SIZE) adapter.eventHistory.pop();',
    '',
    '    // [OC-56] Write-Ahead-Eventlog: jedes Event sofort auf Platte (restart-sicher).',
    '    // Grund (Forensik 11.06.2026): naechtlicher Prozess-Neustart leerte den In-Memory-Puffer,',
    '    // Abend-Events (bedEntryTs-Quelle) gingen fuer die Analyse verloren obwohl der Sensor lieferte.',
    '    try {',
    '        if (adapter._historyDir) {',
    '            if (!adapter._walDirReady) {',
    '                try { _walFs.mkdirSync(adapter._historyDir, { recursive: true }); } catch (mkE) {}',
    '                adapter._walDirReady = true;',
    '            }',
    '            const _wd = new Date(now);',
    "            const _wds = _wd.getFullYear() + '-' + String(_wd.getMonth() + 1).padStart(2, '0') + '-' + String(_wd.getDate()).padStart(2, '0');",
    "            _walFs.appendFileSync(_walPath.join(adapter._historyDir, 'buffer-' + _wds + '.jsonl'), JSON.stringify(eventObj) + '\\n');",
    '        }',
    '    } catch (walE) {',
    "        if (!adapter._walWarned) { adapter._walWarned = true; adapter.log.warn('[OC-56] Write-Ahead-Eventlog fehlgeschlagen: ' + walE.message); }",
    '    }'
].join(eol);

const idx = txt.indexOf(oldStr);
if (idx === -1) { console.error('FAIL: Marker nicht gefunden'); process.exit(1); }
if (txt.indexOf(oldStr, idx + 1) !== -1) { console.error('FAIL: Marker nicht eindeutig'); process.exit(1); }
txt = txt.slice(0, idx) + newStr + txt.slice(idx + oldStr.length);
fs.writeFileSync(p, txt, 'utf8');
console.log('OK: recorder.js WAL-Append eingefuegt');
