const fs = require('fs');
const src = fs.readFileSync('src-admin/src/components/tabs/HealthTab.tsx', 'utf8');
const lines = src.split('\n');

// Find useState initializations (first 200 lines)
console.log('=== useState declarations (lines 1-200) ===');
for (let i = 0; i < 200; i++) {
    if (lines[i] && lines[i].includes('useState')) {
        console.log((i+1) + ': ' + lines[i].trim());
    }
}

// Also check what happens on initial mount - the useEffect at line 684
console.log('\n=== loadHistory call sites ===');
lines.forEach((l, i) => {
    if (l.includes('loadHistory(')) {
        console.log((i+1) + ': ' + l.trim());
    }
});
