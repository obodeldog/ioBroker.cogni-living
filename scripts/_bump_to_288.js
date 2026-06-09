const fs = require('fs');
const path = require('path');

function bumpFile(filePath) {
    let raw = fs.readFileSync(filePath, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    const obj = JSON.parse(raw);
    const parts = obj.version.split('.');
    parts[2] = String(Number(parts[2]) + 1);
    obj.version = parts.join('.');
    console.log(path.basename(filePath) + ':', obj.version);
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

bumpFile(path.join(__dirname, '..', 'package.json'));
bumpFile(path.join(__dirname, '..', 'io-package.json'));
bumpFile(path.join(__dirname, '..', 'src-admin', 'io-package.json'));
console.log('Done.');
