const fs = require('fs');
const f = 'src-admin/src/components/tabs/HealthTab.tsx';
let c = fs.readFileSync(f, 'utf8');

// Build the broken string with actual chars
const BS = '\\'; // backslash
const DOT = '.';

// The broken pattern - what was written by the previous script
const brokenLine1 = '        socket.getState(' + BS + DOT + 'analysis.health.anomalyScore).then((h:any) => {';
const brokenLine2 = '            else { socket.getState(' + BS + DOT + 'analysis.security.lastScore).then((s:any) => { if (s?.val != null) setAnomalyScore(Number(s.val)); }); }';
const commentLine = '        // Priorisiere health.anomalyScore (aus ANALYZE_HEALTH / LTM-Digest)';

const idx = c.indexOf(brokenLine1);
console.log('Broken line 1 idx:', idx);
if (idx === -1) {
    // Try without the prefix
    const alt = 'socket.getState(\\.' + 'analysis.health.anomalyScore)';
    const idx2 = c.indexOf(alt);
    console.log('Alt idx:', idx2);
    // Show what is around the known comment
    const cidx = c.indexOf(commentLine);
    console.log('Comment idx:', cidx);
    if (cidx !== -1) {
        console.log('Context around comment:', JSON.stringify(c.substring(cidx, cidx+300)));
    }
    process.exit(1);
}

// Build correct replacement
const BT = '`';
const NS = '${namespace}';
const newBlock = [
    '        // Priorisiere health.anomalyScore (aus ANALYZE_HEALTH / LTM-Digest), Fallback: security.lastScore',
    '        socket.getState(' + BT + NS + '.analysis.health.anomalyScore' + BT + ').then((h:any) => {',
    '            if (h?.val != null) { setAnomalyScore(Number(h.val)); }',
    '            else { socket.getState(' + BT + NS + '.analysis.security.lastScore' + BT + ').then((s:any) => { if (s?.val != null) setAnomalyScore(Number(s.val)); }); }',
    '        });',
].join('\r\n');

// Find the full block: from comment to closing });
const blockStart = c.lastIndexOf('\n', idx) + 1;
const blockEndSearch = '        });';
const blockEnd = c.indexOf(blockEndSearch, idx) + blockEndSearch.length;

const original = c.substring(blockStart, blockEnd);
console.log('Block to replace:', JSON.stringify(original));

c = c.substring(0, blockStart) + newBlock + c.substring(blockEnd);
fs.writeFileSync(f, c, 'utf8');
console.log('Done');
