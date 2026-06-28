// pwa_sleep_tile_client.js: Stats-Box Label Wachliegen → Schlafunterbr.
const fs = require('fs');
const path = require('path');
const clientPath = path.join(__dirname, '..', 'src', 'lib', 'pwa_sleep_tile_client.js');
let client = fs.readFileSync(clientPath, 'utf8');

const OLD = "{ col: '#ffd54f', label: 'Wachliegen', min: L.wakeMin }";
const NEW = "{ col: '#ffd54f', label: 'Schlafunterbr.', min: L.wakeMin }";
if (!client.includes(OLD)) { console.error('NICHT GEFUNDEN'); process.exit(1); }
client = client.replace(OLD, NEW);
fs.writeFileSync(clientPath, client);
console.log('CLIENT OK: Stats-Box label → Schlafunterbr.');
