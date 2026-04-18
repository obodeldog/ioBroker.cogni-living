/**
 * Schritt 4: Nullnummer als 3. RF-Klasse + unlimitierte Labels
 */
const fs = require('fs');
let src = fs.readFileSync('src/main.js', 'utf8');

// Both loops use the same filter pattern in the source
const FILTER_OLD = '.filter(function(l){return (l.type||"").toLowerCase()!=="nullnummer";}).slice(0, 30)';
const FILTER_NEW = ' /* alle Typen inkl. Nullnummer (3. RF-Klasse), unlimitiert */';

const count = (src.split(FILTER_OLD).length - 1);
console.log('Gefundene Filter-Vorkommen:', count);
if (count !== 2) { console.error('FEHLER: Erwartet 2 Vorkommen, gefunden: ' + count); process.exit(1); }

// Replace both occurrences
src = src.split(FILTER_OLD).join(FILTER_NEW);
console.log('T4: Beide Filter + slice(0,30) entfernt.');

fs.writeFileSync('src/main.js', src, 'utf8');
console.log('src/main.js gespeichert.');
