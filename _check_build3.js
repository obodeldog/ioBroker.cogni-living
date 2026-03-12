const fs = require('fs');
const build = fs.readFileSync('src-admin/build/assets/index-BFqMvlVM.js', 'utf8');

// Show 1500 chars AFTER the door check (to see what happens with qe/faCount after forEach)
const doorCheckIdx = build.indexOf('kr.type==="door"&&Ea');
if (doorCheckIdx >= 0) {
    console.log('=== After processEvents door check (1500 chars) ===');
    console.log(build.substring(doorCheckIdx + 200, doorCheckIdx + 1800));
}
