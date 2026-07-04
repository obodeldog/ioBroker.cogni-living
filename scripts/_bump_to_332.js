// Version bump 0.33.331 -> 0.33.332
const fs = require('fs');
const OLD = '0.33.331', NEW = '0.33.332';
const root = 'C:/ioBroker/ioBroker.cogni-living/';

// package.json (surgical: nur version-Feld)
let pkg = fs.readFileSync(root + 'package.json', 'utf8');
pkg = pkg.replace('"version": "' + OLD + '"', '"version": "' + NEW + '"');
fs.writeFileSync(root + 'package.json', pkg, 'utf8');

// io-package.json (BEIDE Felder: version + common.version)
let iop = fs.readFileSync(root + 'io-package.json', 'utf8');
iop = iop.split('"' + OLD + '"').join('"' + NEW + '"');
fs.writeFileSync(root + 'io-package.json', iop, 'utf8');

console.log('OK bump ' + OLD + ' -> ' + NEW);
