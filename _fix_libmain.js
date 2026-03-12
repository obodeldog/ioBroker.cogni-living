const fs = require('fs');

const libPath = 'lib/main.js';
let src = fs.readFileSync(libPath, 'utf8');
const lines = src.split('\n');

// Find and remove the DUPLICATE freshAirLong block (lines 346-359)
// Keep lines 332-345, remove lines 346-359 (the duplicate)
let firstBlock = -1;
let secondBlock = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === 'const FRESH_AIR_MIN_MS = 5 * 60 * 1000;') {
        if (firstBlock === -1) {
            firstBlock = i;
            console.log('First FRESH_AIR_MIN_MS at line ' + (i+1));
        } else {
            secondBlock = i;
            console.log('Second (duplicate) FRESH_AIR_MIN_MS at line ' + (i+1));
        }
    }
}

if (secondBlock !== -1) {
    // Find the end of the duplicate block
    // The duplicate block starts at secondBlock and ends with:
    // for (const openTs of Object.values(openMap)) { if ((Date.now() - openTs) >= FRESH_AIR_MIN_MS) freshAirLongCount++; delete openMap[openTs]; }
    // or similar line
    let endBlock = secondBlock;
    for (let i = secondBlock; i < Math.min(secondBlock + 20, lines.length); i++) {
        if (lines[i].includes('for (const openTs of Object.values(openMap))')) {
            endBlock = i;
            break;
        }
    }
    
    console.log('Removing lines ' + (secondBlock+1) + ' to ' + (endBlock+1));
    
    // Also remove the comment line before the duplicate block (if it's a duplicate comment)
    let removeStart = secondBlock;
    if (secondBlock > 0 && lines[secondBlock-1].includes('// 5-Min-Stoßlüftungen')) {
        removeStart = secondBlock - 1;
        console.log('Also removing duplicate comment at line ' + (removeStart+1));
    }
    
    // Remove from removeStart to endBlock (inclusive)
    const removeCount = endBlock - removeStart + 1;
    console.log('Removing ' + removeCount + ' lines starting at ' + (removeStart+1));
    lines.splice(removeStart, removeCount);
    
    fs.writeFileSync(libPath, lines.join('\n'), 'utf8');
    console.log('Fixed! Written to', libPath);
    
    // Verify
    console.log('\nVerification:');
    console.log('const FRESH_AIR_MIN_MS declarations:', (lines.join('\n').match(/const FRESH_AIR_MIN_MS/g)||[]).length, '(should be 1)');
    console.log('const doorEventsToday declarations:', (lines.join('\n').match(/const doorEventsToday/g)||[]).length, '(should be 1)');
    console.log('let freshAirLongCount declarations:', (lines.join('\n').match(/let freshAirLongCount/g)||[]).length, '(should be 1)');
} else {
    console.log('No duplicate found - already clean?');
}
