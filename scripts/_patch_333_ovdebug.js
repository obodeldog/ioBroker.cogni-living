// Patch: Debug-Log an Override-Pruefung in computePersonSleep (v0.33.333)
const fs = require('fs');
const FP = 'C:/ioBroker/ioBroker.cogni-living/src/main.js';
let src = fs.readFileSync(FP, 'utf8');

const OLD =
"    if (startOverride && startOverride.date === sleepDate && startOverride.ts\n" +
"            && startOverride.ts >= ovWinMin && startOverride.ts <= ovWinMax) {\n" +
"        sleepStart = startOverride.ts; sleepStartSrc = startOverride.source || 'override'; overrideApplied = true;\n" +
"        if (log) log.info(logPfx + 'Override: ' + sleepStartSrc + ' = ' + new Date(sleepStart).toISOString());\n" +
"    }";

const NEW =
"    // [OC-OVDEBUG] Diagnose: warum greift ein manueller Einschlaf-Override (nicht) ?\n" +
"    if (log && startOverride) {\n" +
"        log.info(logPfx + '[OC-OVDEBUG] startOverride vorhanden: ' + JSON.stringify(startOverride)\n" +
"            + ' | sleepDate=' + sleepDate\n" +
"            + ' | dateMatch=' + (startOverride.date === sleepDate)\n" +
"            + ' | ts=' + (startOverride.ts ? new Date(startOverride.ts).toISOString() : 'null')\n" +
"            + ' | ovWinMin=' + new Date(ovWinMin).toISOString()\n" +
"            + ' | ovWinMax=' + new Date(ovWinMax).toISOString()\n" +
"            + ' | tsInWindow=' + (!!startOverride.ts && startOverride.ts >= ovWinMin && startOverride.ts <= ovWinMax));\n" +
"    } else if (log) {\n" +
"        log.debug(logPfx + '[OC-OVDEBUG] kein startOverride uebergeben');\n" +
"    }\n" +
"    if (startOverride && startOverride.date === sleepDate && startOverride.ts\n" +
"            && startOverride.ts >= ovWinMin && startOverride.ts <= ovWinMax) {\n" +
"        sleepStart = startOverride.ts; sleepStartSrc = startOverride.source || 'override'; overrideApplied = true;\n" +
"        if (log) log.info(logPfx + 'Override ANGEWENDET: ' + sleepStartSrc + ' = ' + new Date(sleepStart).toISOString());\n" +
"    } else if (log && startOverride) {\n" +
"        log.warn(logPfx + '[OC-OVDEBUG] Override VERWORFEN (Bedingung nicht erfuellt - siehe Werte oben)');\n" +
"    }";

if (src.indexOf(OLD) === -1) { console.error('FEHLER: OLD nicht gefunden!'); process.exit(1); }
if (src.indexOf(NEW) !== -1) { console.error('WARN: bereits vorhanden.'); process.exit(0); }
src = src.replace(OLD, NEW);
fs.writeFileSync(FP, src, 'utf8');
console.log('OK: OC-OVDEBUG Debug-Log eingefuegt.');
