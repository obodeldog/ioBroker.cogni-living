const fs = require('fs');

// Check main.js for getOverviewData handler
let mainSrc = '';
try { mainSrc = fs.readFileSync('lib/main.js', 'utf8'); } catch(e) {}
if (!mainSrc) { try { mainSrc = fs.readFileSync('main.js', 'utf8'); } catch(e) {} }

const lines = mainSrc.split('\n');

// Find getOverviewData handler
console.log('=== getOverviewData handler ===');
let inHandler = false;
let braceCount = 0;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('getOverviewData')) {
        console.log('FOUND at line ' + (i+1));
        // Print surrounding lines
        for (let j = Math.max(0, i-2); j < Math.min(lines.length, i+50); j++) {
            console.log((j+1) + ': ' + lines[j]);
        }
        console.log('...');
        break;
    }
}
