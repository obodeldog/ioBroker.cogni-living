const fs = require('fs');
let mainSrc = '';
try { mainSrc = fs.readFileSync('lib/main.js', 'utf8'); } catch(e) {}
if (!mainSrc) mainSrc = fs.readFileSync('main.js', 'utf8');

// Find processSensorEvent or equivalent in main.js
let mainMain = fs.readFileSync('main.js', 'utf8');
const lines = mainMain.split('\n');

// Search for the core sensor processing function
console.log('=== onStateChange/processSensor/eventHistory.unshift ===');
lines.forEach((l, i) => {
    if (l.includes('eventHistory') && l.includes('unshift')) {
        // Show context
        for (let j = Math.max(0, i-8); j < Math.min(lines.length, i+5); j++) {
            console.log((j+1) + ': ' + lines[j]);
        }
        console.log('---');
    }
});
