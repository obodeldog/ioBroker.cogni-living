const fs = require('fs');
const NEW = '0.33.337';
// package.json
let pkg = fs.readFileSync('package.json', 'utf8');
pkg = pkg.replace(/("version"\s*:\s*")0\.33\.336(")/, '$1' + NEW + '$2');
fs.writeFileSync('package.json', pkg, 'utf8');
// io-package.json: BEIDE Version-Felder (root + common.version) - chirurgisch
let iop = fs.readFileSync('io-package.json', 'utf8');
let cnt = 0;
iop = iop.replace(/"version"\s*:\s*"0\.33\.336"/g, function (m) { cnt++; return '"version": "' + NEW + '"'; });
fs.writeFileSync('io-package.json', iop, 'utf8');
console.log('package.json -> ' + NEW);
console.log('io-package.json version-Felder ersetzt:', cnt);
