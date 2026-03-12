const fs = require('fs');

// Bump version from 0.31.1 to 0.31.2
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const oldVer = pkg.version;
const parts = oldVer.split('.');
parts[2] = String(parseInt(parts[2]) + 1);
const newVer = parts.join('.');
pkg.version = newVer;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('package.json:', oldVer, '->', newVer);

// io-package.json
const ioPkg = JSON.parse(fs.readFileSync('io-package.json', 'utf8'));
ioPkg.common.version = newVer;

// Add news entry
if (!ioPkg.common.news) ioPkg.common.news = {};
ioPkg.common.news[newVer] = {
    en: "Fix: processEvents crash when event.name is null (Fresh Air count always 0). Fix: duplicate const block in lib/main.js.",
    de: "Fix: processEvents Absturz wenn event.name null ist (Frischluft-Zähler immer 0). Fix: Doppelter const-Block in lib/main.js entfernt."
};
fs.writeFileSync('io-package.json', JSON.stringify(ioPkg, null, 2) + '\n');
console.log('io-package.json:', oldVer, '->', newVer);
