const fs = require('fs');
const NEW = '0.33.323';
const OLD = '0.33.322';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = NEW;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

let ips = fs.readFileSync('io-package.json', 'utf8');
ips = ips.split('"' + OLD + '"').join('"' + NEW + '"');
fs.writeFileSync('io-package.json', ips);

const ip = JSON.parse(fs.readFileSync('io-package.json', 'utf8'));
console.log('pkg:', JSON.parse(fs.readFileSync('package.json', 'utf8')).version,
    '| ip:', ip.version, '| common:', ip.common.version);
