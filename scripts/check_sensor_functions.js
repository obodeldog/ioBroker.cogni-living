'use strict';
const fs = require('fs');

// sensorFunction-Werte in src/main.js
const src = fs.readFileSync('src/main.js', 'utf8');
const vals = new Set();
let m;
const re = /sensorFunction\s*===?\s*'([^']+)'/g;
while ((m = re.exec(src)) !== null) vals.add(m[1]);
const re2 = /sensorFunction\s*===?\s*"([^"]+)"/g;
while ((m = re2.exec(src)) !== null) vals.add(m[1]);
console.log('sensorFunction-Werte in main.js:', [...vals].join(', '));

// ioBroker adapter config suchen
const configPaths = [
    'C:/ioBroker/iobroker-data/cogni-living.0.json',
];
for (const p of configPaths) {
    if (fs.existsSync(p)) {
        const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
        const devs = (cfg.native || cfg).devices || [];
        const funcVals = new Set(devs.map(d => d.sensorFunction).filter(Boolean));
        console.log('\nGefundene sensorFunction-Werte in Adapter-Config:', [...funcVals].join(', '));
        // Zeige alle Bad-Sensoren
        const badDevs = devs.filter(d => (d.sensorFunction || '').toLowerCase().includes('bath') || (d.location || '').toLowerCase().includes('bad') || (d.location || '').toLowerCase().includes('wc'));
        console.log('\nBad-Sensoren (heuristisch):');
        badDevs.forEach(d => console.log(' ', JSON.stringify({id:d.id,name:d.name,type:d.type,sensorFunction:d.sensorFunction,location:d.location})));
    } else {
        console.log('Config nicht gefunden:', p);
    }
}
