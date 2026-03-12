const fs = require('fs');
const f = 'src-admin/src/components/Settings.tsx';
let c = fs.readFileSync(f, 'utf8');

// 1. Remove flurRooms from SettingsState interface
c = c.replace(/; flurRooms: string/, '');
console.log('Interface:', c.includes('; flurRooms: string') ? 'NOT removed' : 'removed OK');

// 2. Remove flurRooms from state initialization
const OLD_INIT = ', ltmDriftCheckIntervalHours: native.ltmDriftCheckIntervalHours || 24, flurRooms: native.flurRooms || \'flur, diele, gang, treppe\',';
const NEW_INIT = ', ltmDriftCheckIntervalHours: native.ltmDriftCheckIntervalHours || 24,';
if (c.includes(OLD_INIT)) {
    c = c.replace(OLD_INIT, NEW_INIT);
    console.log('State init: removed OK');
} else {
    console.log('State init: NOT found, searching...');
    const idx = c.indexOf('flurRooms: native.flurRooms');
    console.log('  flurRooms state idx:', idx);
}

// 3. Remove the Grid block containing the flurRooms TextField
// Find by the unique label text
const LABEL = 'Flur-R\u00e4ume (f\u00fcr Ganggeschwindigkeit)';
const labelIdx = c.indexOf(LABEL);
console.log('Label idx:', labelIdx);

if (labelIdx !== -1) {
    // Walk back to find the opening <Grid item xs={12}>
    let blockStart = c.lastIndexOf('<Grid item xs={12}>', labelIdx);
    // Walk forward to find the closing </Grid> + blank line
    let blockEnd = c.indexOf('</Grid>', labelIdx);
    blockEnd = c.indexOf('</Grid>', blockEnd) + '</Grid>'.length;
    // Also consume any trailing blank lines
    while (c[blockEnd] === '\r' || c[blockEnd] === '\n') blockEnd++;
    
    console.log('Block start:', blockStart, 'Block end:', blockEnd);
    console.log('Block content:', JSON.stringify(c.substring(blockStart, Math.min(blockStart + 100, blockEnd))));
    
    c = c.substring(0, blockStart) + c.substring(blockEnd);
    console.log('Block removed OK');
}

fs.writeFileSync(f, c, 'utf8');
console.log('Done');
