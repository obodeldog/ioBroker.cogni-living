const fs = require('fs');
const build = fs.readFileSync('src-admin/build/assets/index-BFqMvlVM.js', 'utf8');

// Show context around the Ot(0) call at 2304813
console.log('=== Context around Ot(0) reset at 2304813 (600 chars before) ===');
console.log(build.substring(2304200, 2305100));

console.log('\n=== processEvents call in fetchData (Ot(qe)) context ===');
// Find the call site of Qt (processEvents) in fetchData
const otQeIdx = build.indexOf('Ot(qe)');
console.log(build.substring(otQeIdx - 200, otQeIdx + 300));
