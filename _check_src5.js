const fs = require('fs');
let mainSrc = '';
try { mainSrc = fs.readFileSync('lib/main.js', 'utf8'); } catch(e) {}
if (!mainSrc) { try { mainSrc = fs.readFileSync('main.js', 'utf8'); } catch(e) {} }

const lines = mainSrc.split('\n');

// Find where eventHistory is restored from state
console.log('=== eventHistory restoration ===');
lines.forEach((l, i) => {
    if (l.includes('eventHistory') && (l.includes('getState') || l.includes('JSON.parse') || l.includes('= this') || l.includes('restore') || l.includes('events.history'))) {
        console.log((i+1) + ': ' + l.trim());
    }
});

console.log('\n=== events.history state usages ===');
lines.forEach((l, i) => {
    if (l.includes('events.history')) {
        console.log((i+1) + ': ' + l.trim());
    }
});
