const fs = require('fs');

const htPath = 'src-admin/src/components/tabs/HealthTab.tsx';
let src = fs.readFileSync(htPath, 'utf8');
const lines = src.split('\n');

let changes = 0;

// Fix 1: evt.name.toLowerCase() -> (evt.name || '').toLowerCase() in processEvents forEach (lines ~752, ~757)
for (let i = 0; i < lines.length; i++) {
    // Fix kitchen/bad name check - protect against null name
    if (lines[i].includes("evt.name.toLowerCase().includes('küche')") || lines[i].includes('evt.name.toLowerCase().includes("küche")')) {
        const orig = lines[i];
        lines[i] = lines[i].replace(/evt\.name\.toLowerCase\(\)/g, "(evt.name || '').toLowerCase()");
        if (lines[i] !== orig) { console.log('Fixed küche name check at line ' + (i+1)); changes++; }
    }
    if (lines[i].includes("evt.name.toLowerCase().includes('kitchen')") || lines[i].includes('evt.name.toLowerCase().includes("kitchen")')) {
        const orig = lines[i];
        lines[i] = lines[i].replace(/evt\.name\.toLowerCase\(\)/g, "(evt.name || '').toLowerCase()");
        if (lines[i] !== orig) { console.log('Fixed kitchen name check at line ' + (i+1)); changes++; }
    }
    if (lines[i].includes("evt.name.toLowerCase().includes('bad')") || lines[i].includes('evt.name.toLowerCase().includes("bad")')) {
        const orig = lines[i];
        lines[i] = lines[i].replace(/evt\.name\.toLowerCase\(\)/g, "(evt.name || '').toLowerCase()");
        if (lines[i] !== orig) { console.log('Fixed bad name check at line ' + (i+1)); changes++; }
    }
    if (lines[i].includes("evt.name.toLowerCase().includes('wc')") || lines[i].includes('evt.name.toLowerCase().includes("wc")')) {
        const orig = lines[i];
        lines[i] = lines[i].replace(/evt\.name\.toLowerCase\(\)/g, "(evt.name || '').toLowerCase()");
        if (lines[i] !== orig) { console.log('Fixed wc name check at line ' + (i+1)); changes++; }
    }
}

// Fix 2: Remove dead code line 439 (old keyword matching return)
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("return (nameLower.includes('haustür')") || 
        lines[i].includes("return (nameLower.includes('terrasse')") ||
        lines[i].includes('nameLower.includes') && lines[i].trim().startsWith('return')) {
        console.log('Removing dead code at line ' + (i+1) + ': ' + lines[i].trim());
        lines.splice(i, 1);
        changes++;
        i--;
    }
}

// Fix 3: Remove duplicate setFreshAirLongCount (line ~255)
let firstFreshAirLongCountSet = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('setFreshAirLongCount(d.freshAirLongCount')) {
        if (firstFreshAirLongCountSet === -1) {
            firstFreshAirLongCountSet = i;
            console.log('First setFreshAirLongCount at line ' + (i+1));
        } else {
            console.log('Removing duplicate setFreshAirLongCount at line ' + (i+1));
            lines.splice(i, 1);
            changes++;
            i--;
        }
    }
}

console.log('\nTotal changes:', changes);
fs.writeFileSync(htPath, lines.join('\n'), 'utf8');
console.log('Written to', htPath);

// Verify
const result = fs.readFileSync(htPath, 'utf8');
const resultLines = result.split('\n');
console.log('\nVerification:');
resultLines.forEach((l, i) => {
    if (l.includes('evt.name.toLowerCase') && !l.includes("(evt.name || '')")) {
        console.log('STILL UNSAFE at line ' + (i+1) + ': ' + l.trim());
    }
});
console.log('nameLower.includes occurrences:', (result.match(/nameLower\.includes/g)||[]).length, '(should be 0)');
console.log('setFreshAirLongCount(d.freshAirLongCount) occurrences:', (result.match(/setFreshAirLongCount\(d\.freshAirLongCount/g)||[]).length, '(should be 1)');
