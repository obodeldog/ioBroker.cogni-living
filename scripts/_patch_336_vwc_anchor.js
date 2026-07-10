// Fix v0.33.336: vib_wake_cluster Fenster an tatsaechliche Aufwach-Referenz binden
// statt an die 12:00-Uhr-Obergrenze (wakeHardCap).
const fs = require('fs');
const FP = 'C:/ioBroker/ioBroker.cogni-living/src/main.js';
let src = fs.readFileSync(FP, 'utf8');

const OLD = "        var _vwcStart = wakeHardCap - 90 * 60 * 1000;";
const NEW =
"        // [OC-VWC-ANCHOR] Fenster an die tatsaechliche Aufwach-Referenz binden statt an die\n" +
"        // 12:00-Uhr-Obergrenze (wakeHardCap). Vorher suchte der Detektor nur 10:30-12:00 Uhr und\n" +
"        // verfehlte die morgendliche Unruhe (z.B. 05:42-06:18) komplett -> vib_wake_cluster war\n" +
"        // faktisch totes Feld. Fallback-Kaskade: garmin -> fp2 -> letztes Vib-Event (Kunden ohne\n" +
"        // Garmin/FP2 bekommen so trotzdem ein vibrationsbasiertes Aufwach-Muster).\n" +
"        var _vwcAnchor = garminWakeTs || fp2WakeTs || (_vibEvtsWk.length ? (_vibEvtsWk[_vibEvtsWk.length-1].timestamp||0) : 0) || wakeHardCap;\n" +
"        var _vwcStart = _vwcAnchor - 90 * 60 * 1000;";

if (src.indexOf(OLD) === -1) { console.error('FEHLER: OLD nicht gefunden!'); process.exit(1); }
if (src.indexOf(NEW) !== -1) { console.error('WARN: bereits gefixt'); process.exit(0); }
var cnt = src.split(OLD).length - 1;
if (cnt !== 1) { console.error('FEHLER: OLD kommt ' + cnt + 'x vor!'); process.exit(1); }
src = src.replace(OLD, NEW);
fs.writeFileSync(FP, src, 'utf8');
console.log('OK: vib_wake_cluster Anker gefixt.');
