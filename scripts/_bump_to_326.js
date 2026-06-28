const fs = require('fs');
const path = require('path');
const OLD_VER = '0.33.325';
const NEW_VER = '0.33.326';

// package.json
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (pkg.version !== OLD_VER) { console.error('package.json version ist ' + pkg.version + ', erwartet ' + OLD_VER); process.exit(1); }
pkg.version = NEW_VER;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('package.json: ' + OLD_VER + ' → ' + NEW_VER);

// io-package.json - beide version Felder ersetzen
const ipPath = path.join(__dirname, '..', 'io-package.json');
let ip = fs.readFileSync(ipPath, 'utf8');
const countBefore = (ip.match(new RegExp(OLD_VER.replace(/\./g, '\\.'), 'g')) || []).length;
ip = ip.split(OLD_VER).join(NEW_VER);
const countAfter = (ip.match(new RegExp(NEW_VER.replace(/\./g, '\\.'), 'g')) || []).length;
fs.writeFileSync(ipPath, ip);
console.log('io-package.json: ' + countBefore + ' Vorkommen ersetzt → ' + countAfter + 'x ' + NEW_VER);
