const fs = require('fs');
let mainSrc = '';
try { mainSrc = fs.readFileSync('lib/main.js', 'utf8'); } catch(e) {}
if (!mainSrc) { try { mainSrc = fs.readFileSync('main.js', 'utf8'); } catch(e) {} }

const lines = mainSrc.split('\n');

// Show lines 580-640 of main.js (continuation of getOverviewData handler)
console.log('=== getOverviewData continuation (lines 580-640) ===');
for (let i = 578; i < 640; i++) {
    console.log((i+1) + ': ' + lines[i]);
}
