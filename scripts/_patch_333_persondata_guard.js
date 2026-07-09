// Patch: personData IIFE in try/catch wickeln damit History Write nicht crasht
// wenn ein per-Person Fehler auftritt. Fehler wird geloggt, personData = {} als Fallback.
const fs = require('fs');
const FP = 'C:/ioBroker/ioBroker.cogni-living/src/main.js';
let src = fs.readFileSync(FP, 'utf8');

const OLD = "            const personData = (function() {";
const NEW = "            let personData = {}; try { personData = (function() {";

if (src.indexOf(OLD) === -1) { console.error('FEHLER: OLD nicht gefunden!'); process.exit(1); }
if (src.indexOf(NEW) !== -1) { console.error('WARN: bereits vorhanden'); process.exit(0); }
src = src.replace(OLD, NEW);

// Auch das Ende patchen: })(); -> })(); } catch(_pdErr) { ... }
const OLD2 = "            })();\n\n            try { await this.setStateAsync('system.personData',";
const NEW2 = "            }); } catch(_pdErr) { this.log.error('[personData] CRASH: ' + _pdErr.message + ' | ' + (_pdErr.stack||'').split('\\n').slice(0,5).join(' => ')); }\n\n            try { await this.setStateAsync('system.personData',";

if (src.indexOf(OLD2) === -1) { console.error('FEHLER: OLD2 nicht gefunden!'); process.exit(1); }
src = src.replace(OLD2, NEW2);

fs.writeFileSync(FP, src, 'utf8');
console.log('OK: personData IIFE try/catch Guard eingefuegt.');
