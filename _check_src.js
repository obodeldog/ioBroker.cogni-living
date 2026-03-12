const fs = require('fs');
const src = fs.readFileSync('src-admin/src/components/tabs/HealthTab.tsx', 'utf8');
const lines = src.split('\n');

// Find where processEvents is called
console.log('=== processEvents calls ===');
lines.forEach((l, i) => {
    if (l.includes('processEvents(')) {
        console.log((i+1) + ': ' + l.trim());
    }
});

// Show useEffects and their dependencies
console.log('\n=== useEffect hooks ===');
lines.forEach((l, i) => {
    if (l.includes('useEffect(') || (l.includes('}, [') && lines[i-1] && lines[i-1].includes('}'))) {
        if (l.includes('useEffect')) {
            // Show a few lines around each useEffect
            for (let j = i; j < Math.min(i+3, lines.length); j++) {
                console.log((j+1) + ': ' + lines[j].trim());
            }
            console.log('---');
        }
    }
});

// Show lines around fetchData definition and where it's called
console.log('\n=== fetchData definition and call ===');
let fetchDataLine = -1;
lines.forEach((l, i) => {
    if (l.includes('const fetchData') || l.includes('fetchData()') || l.includes('fetchData(')) {
        console.log((i+1) + ': ' + l.trim());
    }
});
