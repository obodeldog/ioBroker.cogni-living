const fs = require('fs');
const src = fs.readFileSync('src-admin/src/components/tabs/HealthTab.tsx', 'utf8');
const lines = src.split('\n');

// Show Fresh Air tile display (lines 1825-1860)
console.log('=== Fresh Air tile display ===');
for (let i = 1820; i < 1865; i++) {
    if (lines[i] !== undefined) console.log((i+1) + ': ' + lines[i]);
}

// Also show the processEvents function (lines 720-800)
console.log('\n=== processEvents function (lines 720-780) ===');
for (let i = 719; i < 780; i++) {
    if (lines[i] !== undefined) console.log((i+1) + ': ' + lines[i]);
}
