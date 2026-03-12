const fs = require('fs');
const build = fs.readFileSync('src-admin/build/assets/index-BFqMvlVM.js', 'utf8');

// What function contains the Ot(0) call? Show 1500 chars BEFORE it
console.log('=== 1500 chars before Ot(0) at 2304813 ===');
console.log(build.substring(2303000, 2305000));
