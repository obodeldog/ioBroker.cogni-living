const fs = require('fs');
const src = fs.readFileSync('src-admin/src/components/tabs/HealthTab.tsx', 'utf8');
const lines = src.split('\n');

// Show lines 600-700 (fetchData function context)
console.log('=== fetchData function (lines 604-710) ===');
for (let i = 603; i < 710; i++) {
    console.log((i+1) + ': ' + lines[i]);
}
