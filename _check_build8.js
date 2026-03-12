const fs = require('fs');
const build = fs.readFileSync('src-admin/build/assets/index-BFqMvlVM.js', 'utf8');

// Show large context around the Qt call at 2309955 (1000 chars before)
console.log('=== Context 1000 chars before Qt call at 2309955 ===');
console.log(build.substring(2308900, 2310300));
