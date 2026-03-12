const fs = require('fs');
const build = fs.readFileSync('src-admin/build/assets/index-BFqMvlVM.js', 'utf8');

// Find ALL occurrences of Ot( to see where setFreshAirCount is called
console.log('=== All Ot( calls (setFreshAirCount) ===');
let idx = 0, count = 0;
while ((idx = build.indexOf('Ot(', idx)) >= 0 && count < 20) {
    const ctx = build.substring(idx - 30, idx + 80);
    // Only show ones that look like state setters (short args)
    if (!ctx.includes('function') && !ctx.includes('=>')) {
        console.log('At ' + idx + ': ...' + ctx + '...');
        count++;
    }
    idx++;
}

// Also check: where is Ot( called with 0
console.log('\n=== Ot(0) calls ===');
idx = 0; count = 0;
while ((idx = build.indexOf('Ot(0)', idx)) >= 0 && count < 10) {
    console.log('At ' + idx + ': ...' + build.substring(idx-50, idx+100) + '...');
    idx++; count++;
}

// And where is freshAirCount displayed in the tile
console.log('\n=== freshAirCount display (Ve + "x" or similar) ===');
const veXIdx = build.indexOf('"x"');
let found = 0;
idx = 0;
while ((idx = build.indexOf('"x"', idx)) >= 0 && found < 5) {
    const ctx = build.substring(idx-80, idx+50);
    if (ctx.includes('Ve') || ctx.includes('freshAir') || ctx.includes('Ot')) {
        console.log('At ' + idx + ': ...' + ctx + '...');
        found++;
    }
    idx++;
}
