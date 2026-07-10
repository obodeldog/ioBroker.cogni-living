// Fix v0.33.335: fehlendes IIFE-Aufruf () wiederherstellen.
// Bug in v0.33.334: personData = (function(){...});  <- () fehlte -> Funktion statt Ergebnis
const fs = require('fs');
const FP = 'C:/ioBroker/ioBroker.cogni-living/src/main.js';
let src = fs.readFileSync(FP, 'utf8');

const OLD = "                return result;\n            }); } catch(_pdErr) {";
const NEW = "                return result;\n            })(); } catch(_pdErr) {";

if (src.indexOf(OLD) === -1) { console.error('FEHLER: OLD nicht gefunden!'); process.exit(1); }
if (src.indexOf(NEW) !== -1) { console.error('WARN: bereits gefixt'); process.exit(0); }
// Sicherstellen dass genau 1 Vorkommen (Eindeutigkeit)
var cnt = src.split(OLD).length - 1;
if (cnt !== 1) { console.error('FEHLER: OLD kommt ' + cnt + 'x vor (nicht eindeutig)!'); process.exit(1); }
src = src.replace(OLD, NEW);
fs.writeFileSync(FP, src, 'utf8');
console.log('OK: IIFE-Aufruf () wiederhergestellt.');
