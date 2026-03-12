const fs = require('fs');
const src = fs.readFileSync('lib/recorder.js', 'utf8');
const lines = src.split('\n');

// Show lines 190-230 (around eventHistory.unshift)
console.log('=== recorder.js lines 185-240 ===');
for (let i = 184; i < 240; i++) {
    if (lines[i] !== undefined) console.log((i+1) + ': ' + lines[i]);
}

// Show how type is determined
console.log('\n=== type determination ===');
lines.forEach((l, i) => {
    if (l.includes('type:') || l.includes('.type =') || l.includes('deviceConf.type')) {
        console.log((i+1) + ': ' + l.trim());
    }
});
