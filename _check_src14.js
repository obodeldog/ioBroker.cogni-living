const fs = require('fs');
const path = require('path');

// Check all files for eventHistory.unshift
const files = [
    'main.js', 
    'lib/main.js',
    'lib/recorder.js',
    'lib/scheduler.js',
    'lib/python_bridge.js'
];

for (const f of files) {
    try {
        const src = fs.readFileSync(f, 'utf8');
        const lines = src.split('\n');
        console.log('\n=== ' + f + ' ===');
        lines.forEach((l, i) => {
            if (l.includes('eventHistory') && (l.includes('unshift') || l.includes('push'))) {
                console.log((i+1) + ': ' + l.trim());
            }
        });
    } catch(e) {}
}

// Also check lib/ folder
try {
    const libFiles = fs.readdirSync('lib/');
    console.log('\n=== lib/ files ===', libFiles);
} catch(e) {}
