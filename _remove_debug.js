const fs = require('fs');
const htPath = 'src-admin/src/components/tabs/HealthTab.tsx';
let src = fs.readFileSync(htPath, 'utf8');
const lines = src.split('\n');

let removed = 0;
const cleaned = lines.filter(l => {
    if (l.includes('[FRESHAIR DEBUG]')) {
        removed++;
        return false;
    }
    return true;
});

console.log('Removed', removed, 'debug lines');
fs.writeFileSync(htPath, cleaned.join('\n'), 'utf8');
console.log('Done.');
