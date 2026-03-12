const fs = require('fs');
const src = fs.readFileSync('src-admin/src/components/tabs/HealthTab.tsx', 'utf8');
const lines = src.split('\n');

// Find all usages of freshAirLong (not freshAirLongCount)
console.log('=== freshAirLong usages ===');
lines.forEach((l, i) => {
    if (l.includes('freshAirLong') && !l.includes('freshAirLongCount')) {
        console.log((i+1) + ': ' + l.trim());
    }
});

// Find const freshAirLong declarations
console.log('\n=== const/let freshAirLong declarations ===');
lines.forEach((l, i) => {
    if (l.match(/(?:const|let)\s+freshAirLong\b/) || l.includes('freshAirLong =') || l.includes('freshAirLong:')) {
        console.log((i+1) + ': ' + l.trim());
    }
});
