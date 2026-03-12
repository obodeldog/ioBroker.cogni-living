const fs = require('fs');

// Check main.js for syntax + duplicate freshAirLong block
const mainSrc = fs.readFileSync('main.js', 'utf8');
const mainLines = mainSrc.split('\n');

console.log('=== main.js lines 325-365 ===');
for (let i = 324; i < 370; i++) {
    if (mainLines[i] !== undefined) console.log((i+1) + ': ' + mainLines[i]);
}

// Count
console.log('\nFRESH_AIR_MIN_MS occurrences:', (mainSrc.match(/FRESH_AIR_MIN_MS/g)||[]).length);
console.log('const FRESH_AIR_MIN_MS declarations:', (mainSrc.match(/const FRESH_AIR_MIN_MS/g)||[]).length);
console.log('const doorEventsToday declarations:', (mainSrc.match(/const doorEventsToday/g)||[]).length);
console.log('let freshAirLongCount declarations:', (mainSrc.match(/let freshAirLongCount/g)||[]).length);

// Does main.js require lib/main.js?
console.log('\nDoes main.js require lib/main.js?', mainSrc.includes("require('./lib/main')") || mainSrc.includes('require("./lib/main')'));
console.log('Does main.js use lib/main.js?', mainSrc.includes('lib/main'));
