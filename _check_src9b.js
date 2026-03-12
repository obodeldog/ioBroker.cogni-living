const fs = require('fs');

const mainSrc = fs.readFileSync('main.js', 'utf8');
const mainLines = mainSrc.split('\n');

console.log('=== main.js lines 325-365 ===');
for (let i = 324; i < 370; i++) {
    if (mainLines[i] !== undefined) console.log((i+1) + ': ' + mainLines[i]);
}

console.log('\nFRESH_AIR_MIN_MS occurrences:', (mainSrc.match(/FRESH_AIR_MIN_MS/g)||[]).length);
console.log('const FRESH_AIR_MIN_MS declarations:', (mainSrc.match(/const FRESH_AIR_MIN_MS/g)||[]).length);
console.log('const doorEventsToday declarations:', (mainSrc.match(/const doorEventsToday/g)||[]).length);
console.log('let freshAirLongCount declarations:', (mainSrc.match(/let freshAirLongCount/g)||[]).length);

const hasLibRequire = mainSrc.includes('lib/main');
console.log('references lib/main:', hasLibRequire);
