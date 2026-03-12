const fs = require('fs');
const htPath = 'src-admin/src/components/tabs/HealthTab.tsx';
let src = fs.readFileSync(htPath, 'utf8');
const lines = src.split('\n');

// Find processEvents function definition and inject debug logging
// Line 728: const processEvents = (events: any[]) => {
// Line 740: const todaysEvents = events.filter(...)
// Line 745: todaysEvents.forEach(...)
// Line ~800: setFreshAirCount(faCount)

let changed = 0;

for (let i = 0; i < lines.length; i++) {
    // After "const todaysEvents = events.filter..." add debug log
    if (lines[i].includes('const todaysEvents = events.filter')) {
        const indent = lines[i].match(/^(\s*)/)[1];
        // Insert debug log BEFORE the todaysEvents line
        const debugLine = indent + "console.log('[FRESHAIR DEBUG] processEvents called, events:', events.length, 'isLive:', isLive, 'startOfDay:', new Date(isLive ? new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()).getTime() : new Date(viewDate).setHours(0,0,0,0)).toISOString());";
        lines.splice(i, 0, debugLine);
        console.log('Added debug log before todaysEvents at line ' + (i+1));
        changed++;
        i++; // skip past inserted line
    }

    // After "const todaysEvents = events.filter(...)" add another debug log
    if (lines[i].includes('const todaysEvents = events.filter')) {
        // Find the end of this statement (next line after the filter)
        const indent = lines[i].match(/^(\s*)/)[1];
        // Insert after this line
        const debugLine2 = indent + "console.log('[FRESHAIR DEBUG] todaysEvents count:', todaysEvents.length, 'door events:', todaysEvents.filter((e:any) => e.type === \"door\").length);";
        lines.splice(i + 1, 0, debugLine2);
        console.log('Added todaysEvents count debug at line ' + (i+2));
        changed++;
        i++; // skip
    }

    // After setFreshAirCount(faCount) add debug
    if (lines[i].includes('setFreshAirCount(faCount)')) {
        const indent = lines[i].match(/^(\s*)/)[1];
        const debugLine3 = indent + "console.log('[FRESHAIR DEBUG] setFreshAirCount called with:', faCount, '| lastFA:', lastFA);";
        lines.splice(i + 1, 0, debugLine3);
        console.log('Added faCount debug after setFreshAirCount at line ' + (i+2));
        changed++;
        i++; // skip
    }
}

console.log('Total changes:', changed);
fs.writeFileSync(htPath, lines.join('\n'), 'utf8');
console.log('Written. Now rebuild!');
