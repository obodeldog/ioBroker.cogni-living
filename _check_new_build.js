const fs = require('fs');
const build = fs.readFileSync('src-admin/build/assets/index-CBIshDQD.js', 'utf8');

// Find the processEvents function in the NEW build
// Look for the door check
const doorCheckIdx = build.indexOf('type==="door"&&Ea&&');
if (doorCheckIdx >= 0) {
    console.log('=== processEvents in NEW build (door check + surrounding) ===');
    console.log(build.substring(doorCheckIdx - 400, doorCheckIdx + 600));
} else {
    console.log('Door check NOT found!');
    // Try alternative
    const alt = build.indexOf('"door"&&');
    console.log('Alternative "door"&& at:', alt);
    if (alt >= 0) console.log(build.substring(alt-50, alt+200));
}

// Check for faCount equivalent (qe)
console.log('\n=== processEvents setFreshAirCount call ===');
const faIdx = build.indexOf('Ot(qe)');
if (faIdx >= 0) {
    console.log('Found Ot(qe) at', faIdx);
    console.log(build.substring(faIdx - 100, faIdx + 200));
} else {
    console.log('Ot(qe) NOT found!');
    // The variable names might have changed in the new build
    // Find processEvents by looking for the full pattern
}
