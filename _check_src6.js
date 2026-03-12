const fs = require('fs');
let mainSrc = '';
try { mainSrc = fs.readFileSync('lib/main.js', 'utf8'); } catch(e) {}
if (!mainSrc) { try { mainSrc = fs.readFileSync('main.js', 'utf8'); } catch(e) {} }

const lines = mainSrc.split('\n');

// Show lines 118-135 (eventHistory restoration on startup)
console.log('=== Startup restoration (lines 118-140) ===');
for (let i = 117; i < 140; i++) {
    console.log((i+1) + ': ' + lines[i]);
}

// Show lines 320-380 (freshAirCount calculation - saveDailyHistory)
console.log('\n=== freshAirCount calculation (lines 320-375) ===');
for (let i = 319; i < 375; i++) {
    console.log((i+1) + ': ' + lines[i]);
}
