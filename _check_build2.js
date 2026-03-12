const fs = require('fs');
const build = fs.readFileSync('src-admin/build/assets/index-BFqMvlVM.js', 'utf8');

// Find processEvents - look for the door check + qe++ pattern
const doorCheckIdx = build.indexOf('kr.type==="door"&&Ea');
if (doorCheckIdx >= 0) {
    console.log('=== processEvents context (door check) ===');
    // Show 500 chars before and 500 after
    console.log(build.substring(doorCheckIdx - 500, doorCheckIdx + 800));
}
