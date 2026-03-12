const fs = require('fs');
const src = fs.readFileSync('lib/python_bridge.js', 'utf8');
const lines = src.split('\n');

// Show context around timeout
console.log('=== python_bridge.js timeout area ===');
for (let i = 105; i < 130; i++) {
    if (lines[i]) console.log((i+1) + ': ' + lines[i]);
}

// Also check HEALTH_RESULT handler
console.log('\n=== HEALTH_RESULT handler ===');
lines.forEach((l, i) => {
    if (l.includes('HEALTH_RESULT') || l.includes('anomalyScore') || l.includes('lastScore')) {
        for (let j = Math.max(0, i-1); j < Math.min(lines.length, i+8); j++) {
            console.log((j+1) + ': ' + lines[j]);
        }
        console.log('---');
    }
});
