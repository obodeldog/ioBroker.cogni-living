// Patch: History Save Error catch auf Stack-Trace erweitern + fs.writeFileSync in eigenen try-Block
const fs = require('fs');
const FP = 'C:/ioBroker/ioBroker.cogni-living/src/main.js';
let src = fs.readFileSync(FP, 'utf8');

// 1. Stack-Trace ausgeben
const OLD1 = "        } catch(e) { this.log.error(`History Save Error: ${e.message}`); }";
const NEW1 = "        } catch(e) { this.log.error('[HistorySave] CRASH: ' + e.message + ' | ' + (e.stack||'').split('\\n').slice(0,5).join(' => ')); }";

if (src.indexOf(OLD1) === -1) { console.error('FEHLER: OLD1 nicht gefunden!'); process.exit(1); }
src = src.replace(OLD1, NEW1);

// 2. fs.writeFileSync separat in try-Block um es vor Post-Processing-Crashes zu schuetzen
const OLD2 = "            const filePath = path.join(historyDir, `${dateStr}.json`);\n            fs.writeFileSync(filePath, JSON.stringify(snapshot));\n            this.log.info(`? History saved: ${filePath}`);";
const NEW2 = "            const filePath = path.join(historyDir, `${dateStr}.json`);\n            try { fs.writeFileSync(filePath, JSON.stringify(snapshot)); this.log.info('[HistorySave] OK: ' + filePath); } catch(_fsE) { this.log.error('[HistorySave] WRITE FAILED: ' + _fsE.message); }";

if (src.indexOf(OLD2) === -1) {
    // Alternative check
    console.error('FEHLER: OLD2 nicht gefunden (writeFileSync-Block) - pruefen ob Datei anders formatiert');
    process.exit(1);
}
src = src.replace(OLD2, NEW2);

fs.writeFileSync(FP, src, 'utf8');
console.log('OK: History Save Error Stack-Trace + writeFileSync-Guard eingefuegt.');
