const fs = require('fs');
const build = fs.readFileSync('src-admin/build/assets/index-BFqMvlVM.js', 'utf8');

// Search for 'door' string
console.log('=== Searching for "door" ===');
let idx = 0, count = 0;
while ((idx = build.indexOf('"door"', idx)) >= 0 && count < 8) {
    console.log('At ' + idx + ': ...' + build.substring(idx-60, idx+100) + '...');
    idx++; count++;
}

// Search for faCount related code
console.log('\n=== faCount in build ===');
idx = 0; count = 0;
while ((idx = build.indexOf('faCount', idx)) >= 0 && count < 5) {
    console.log('At ' + idx + ': ...' + build.substring(idx-30, idx+80) + '...');
    idx++; count++;
}

// Search for freshAirCount setter
console.log('\n=== setFreshAirCount in build ===');
idx = build.indexOf('freshAirCount');
while (idx >= 0 && count < 5) {
    console.log('At ' + idx + ': ...' + build.substring(idx-40, idx+100) + '...');
    idx = build.indexOf('freshAirCount', idx + 1);
    count++;
}
