const fs = require('fs');

const OLD_BLOCK = [
    '            // Fenster/T\u00fcr-\u00d6ffnungen: alle Sensoren mit fenster/hausT\u00fcr/terrasse/balkon/window im Namen',
    "            const FRESH_AIR_KEYWORDS = ['fenster', 'haust\u00fcr', 'haustuer', 'terrasse', 'balkon', 'balkont\u00fcr', 'window', 'door'];",
    '            const freshAirCount = this.eventHistory.filter(e => {',
    '                const ts = e.timestamp || e.ts || 0;',
    '                if (ts < startOfDayTimestamp) return false;',
    "                const name = (e.name || e.id || e.deviceName || '').toLowerCase();",
    '                const isWindowSensor = FRESH_AIR_KEYWORDS.some(k => name.includes(k));',
    "                const isOpen = e.value === true || e.value === 1 || e.value === 'true' || e.value === 'open';",
    '                return isWindowSensor && isOpen;',
    '            }).length;',
].join('\n');

const NEW_BLOCK = [
    '            // Frischluft: Verwende Sensor-Typ "door" aus dem Typ-System (Sensorliste: Tür/Fenster)',
    '            // Identisch zum Architektur-Prinzip: e.type === "door" statt Keyword-Matching',
    '            const freshAirCount = this.eventHistory.filter(e => {',
    '                const ts = e.timestamp || e.ts || 0;',
    '                if (ts < startOfDayTimestamp) return false;',
    "                const isDoorSensor = e.type === 'door';",
    "                const isOpen = e.value === true || e.value === 1 || e.value === 'true' || e.value === 'open';",
    '                return isDoorSensor && isOpen;',
    '            }).length;',
].join('\n');

const files = ['main.js', 'lib/main.js'];
files.forEach(f => {
    let c = fs.readFileSync(f, 'utf8');
    // Normalize CRLF -> LF for matching
    const cLF = c.replace(/\r\n/g, '\n');
    
    if (cLF.includes(OLD_BLOCK)) {
        const newC = cLF.replace(OLD_BLOCK, NEW_BLOCK);
        // Restore CRLF
        fs.writeFileSync(f, newC.replace(/\n/g, '\r\n'), 'utf8');
        console.log(f + ': Fresh Air fixed OK');
    } else {
        // Try with ASCII chars (encoding might differ)
        const altOld = OLD_BLOCK
            .replace(/\u00fc/g, String.fromCharCode(252))   // ü
            .replace(/\u00d6/g, String.fromCharCode(214));   // Ö
        if (cLF.includes(altOld)) {
            const newC = cLF.replace(altOld, NEW_BLOCK);
            fs.writeFileSync(f, newC.replace(/\n/g, '\r\n'), 'utf8');
            console.log(f + ': Fresh Air fixed OK (alt encoding)');
        } else {
            // Find by unique substring
            const anchor = "const FRESH_AIR_KEYWORDS = ['fenster'";
            const idx = cLF.indexOf(anchor.substring(0, 30));
            console.log(f + ': anchor idx:', idx);
            if (idx !== -1) {
                // Find the block boundaries
                const blockStart = cLF.lastIndexOf('\n', idx) + 1;
                const blockEnd = cLF.indexOf('.length;', idx) + '.length;'.length;
                console.log(f + ': Block:', JSON.stringify(cLF.substring(blockStart, blockStart+80)));
                const newC = cLF.substring(0, blockStart) + NEW_BLOCK + cLF.substring(blockEnd);
                fs.writeFileSync(f, newC.replace(/\n/g, '\r\n'), 'utf8');
                console.log(f + ': Fixed via index');
            } else {
                console.log(f + ': ERROR - could not find block');
            }
        }
    }
});
