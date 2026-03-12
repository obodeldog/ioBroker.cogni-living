const fs = require('fs');
const src = fs.readFileSync('src-admin/src/components/tabs/HealthTab.tsx', 'utf8');
const lines = src.split('\n');

// Show loadWeekData function (lines 396-490)
console.log('=== loadWeekData function (lines 396-490) ===');
for (let i = 395; i < 495; i++) {
    if (lines[i] !== undefined) console.log((i+1) + ': ' + lines[i]);
}
