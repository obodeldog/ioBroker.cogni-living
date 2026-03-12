/**
 * Line-basierte Ersetzungen fuer Fresh Air Erweiterung
 * Verwendet indexOf auf Zeilen-Ebene um Encoding-Probleme zu umgehen
 */
const fs = require('fs');

function replaceLines(filePath, replacements) {
    const raw = fs.readFileSync(filePath);
    const content = raw.toString('utf8');
    const lines = content.split('\n');
    let changes = 0;

    for (const rep of replacements) {
        const { search, replace, desc } = rep;
        // Finde Zeile die den Suchstring enthaelt
        let found = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(search)) {
                found = i;
                break;
            }
        }
        if (found === -1) {
            console.warn('  WARN: nicht gefunden: ' + desc + ' [' + search + ']');
            continue;
        }
        if (replace.deleteCount !== undefined) {
            // Mehrere Zeilen ersetzen
            const newLines = replace.lines || [];
            lines.splice(found, replace.deleteCount, ...newLines);
            console.log('  OK: ' + desc + ' (Zeile ' + (found+1) + ', ' + replace.deleteCount + ' -> ' + newLines.length + ')');
        } else {
            // Einzelne Zeile ersetzen
            lines[found] = replace.line;
            console.log('  OK: ' + desc + ' (Zeile ' + (found+1) + ')');
        }
        changes++;
    }

    if (changes > 0) {
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        console.log('  Geschrieben: ' + filePath);
    }
    return changes;
}

// ============================================================
// HealthTab.tsx
// ============================================================
const htPath = 'src-admin/src/components/tabs/HealthTab.tsx';
console.log('\n--- HealthTab.tsx ---');

replaceLines(htPath, [
    // A: State-Deklaration
    {
        search: "const [freshAirCount, setFreshAirCount] = useState(0);",
        desc: "State freshAirLongCount hinzufuegen",
        replace: {
            deleteCount: 1,
            lines: [
                "    const [freshAirCount, setFreshAirCount] = useState(0);",
                "    const [freshAirLongCount, setFreshAirLongCount] = useState(0);"
            ]
        }
    },
    // B: Cache-Lade-Pfad
    {
        search: "setFreshAirCount(d.freshAirCount || 0);",
        desc: "freshAirLongCount aus Cache laden",
        replace: {
            deleteCount: 1,
            lines: [
                "                    setFreshAirCount(d.freshAirCount || 0);",
                "                    setFreshAirLongCount(d.freshAirLongCount || 0);"
            ]
        }
    }
]);

// C: Reset-Pfad: setFreshAirCount(0) finden und darunter einfuegen
{
    const raw = fs.readFileSync(htPath, 'utf8');
    const lines = raw.split('\n');
    // Suche die Zeile "setFreshAirCount(0);" die danach setMeals hat
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('setFreshAirCount(0)') && i + 1 < lines.length && lines[i+1].includes('setMeals')) {
            lines.splice(i + 1, 0, "                    setFreshAirLongCount(0);");
            fs.writeFileSync(htPath, lines.join('\n'), 'utf8');
            console.log('  OK: Reset freshAirLongCount (Zeile ' + (i+1) + ')');
            break;
        }
    }
}

// D: Live-Pfad (Wochenansicht) Keyword-Matching ersetzen
// Suche nach "const nameLower = (e.name || '').toLowerCase();" im eventHist.filter Block
{
    const raw = fs.readFileSync(htPath, 'utf8');
    const lines = raw.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("const nameLower = (e.name || '').toLowerCase();")) {
            // Zeile i ist nameLower, i-1 ist "const isActive", i+1 ist "return (nameLower.includes..."
            // Wir ersetzen Zeilen i und i+1 (nameLower + return)
            const indent = lines[i].match(/^(\s*)/)[1];
            const newCode = [
                indent + "const isOpen = e.value === true || e.value === 1 || e.value === 'on' || e.value === 'true' || e.value === 'open';",
                indent + "return e.type === 'door' && isOpen;"
            ];
            lines.splice(i, 2, ...newCode);
            console.log('  OK: Live-Pfad Keyword -> type-based (Zeile ' + (i+1) + ')');
            fs.writeFileSync(htPath, lines.join('\n'), 'utf8');
            break;
        }
    }
}

// D2: Nach dem filter-Block freshAirLong-Berechnung einfuegen
// Suche nach "}).length;" das nach dem freshAir filter kommt (nach dem wir oben geaendert haben)
{
    const raw = fs.readFileSync(htPath, 'utf8');
    const lines = raw.split('\n');
    for (let i = 0; i < lines.length; i++) {
        // Das korrigierte filter endet mit "return e.type === 'door' && isOpen;"
        if (lines[i].includes("return e.type === 'door' && isOpen;") && 
            i + 1 < lines.length && lines[i+1].trim() === '}).length;') {
            const indent = lines[i+1].match(/^(\s*)/)[1];
            const longBlock = [
                "                                // 5-Min-Sto\u00DFl\u00FCftungen berechnen",
                "                                const FRESH_MIN_MS = 5 * 60 * 1000;",
                "                                const doorEvts5 = eventHist.filter((e: any) => e.timestamp >= startOfDay.getTime() && e.type === 'door')",
                "                                    .sort((a: any, b: any) => a.timestamp - b.timestamp);",
                "                                const openMap5: Record<string, number> = {};",
                "                                let freshAirLong = 0;",
                "                                for (const e of doorEvts5) {",
                "                                    const isOpenE = e.value === true || e.value === 1 || e.value === 'on' || e.value === 'true' || e.value === 'open';",
                "                                    if (isOpenE) { openMap5[e.id] = e.timestamp; }",
                "                                    else { if (openMap5[e.id] && (e.timestamp - openMap5[e.id] >= FRESH_MIN_MS)) freshAirLong++; delete openMap5[e.id]; }",
                "                                }",
                "                                Object.values(openMap5).forEach((ts: any) => { if (Date.now() - ts >= FRESH_MIN_MS) freshAirLong++; });"
            ];
            lines.splice(i + 2, 0, ...longBlock);
            console.log('  OK: freshAirLong Berechnung eingefuegt nach Zeile ' + (i+2));
            fs.writeFileSync(htPath, lines.join('\n'), 'utf8');
            break;
        }
    }
}

// E: freshAirLong in Rueckgabe einfuegen
{
    const raw = fs.readFileSync(htPath, 'utf8');
    const lines = raw.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('freshAirCount: freshAir,') && 
            i + 1 < lines.length && lines[i+1].includes('geminiDay:')) {
            lines.splice(i + 1, 0, "                                        freshAirLongCount: freshAirLong,");
            console.log('  OK: freshAirLongCount in Rueckgabe (Zeile ' + (i+1) + ')');
            fs.writeFileSync(htPath, lines.join('\n'), 'utf8');
            break;
        }
    }
}

// F: processEvents faCount - Keyword durch Type ersetzen
{
    const raw = fs.readFileSync(htPath, 'utf8');
    const lines = raw.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("faCount++; lastFA = date.toLocaleTimeString") && 
            i > 0 && (lines[i-1].includes('haustür') || lines[i-1].includes('haust\u00FCr') || lines[i-1].includes('haustue'))) {
            const indent = lines[i-1].match(/^(\s*)/)[1];
            lines[i-1] = indent + "if (evt.type === 'door' && isActive) {";
            console.log('  OK: processEvents faCount Keyword -> type (Zeile ' + i + ')');
            fs.writeFileSync(htPath, lines.join('\n'), 'utf8');
            break;
        }
    }
}

// G: getFreshAirNarrative aktualisieren
{
    const raw = fs.readFileSync(htPath, 'utf8');
    const lines = raw.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('getFreshAirNarrative') && lines[i].includes('=>')) {
            // Suche das Ende der Funktion (naechste Zeile mit "};")
            let endIdx = -1;
            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j].trim() === '};') { endIdx = j; break; }
            }
            if (endIdx > i) {
                const indent = "        ";
                const newNarrative = [
                    indent + "const getFreshAirNarrative = () => {",
                    indent + "    if (!hasData) return \"Keine Daten.\";",
                    indent + "    if (freshAirCount === 0) return \"Keine \u00D6ffnung erkannt (Wetter schlecht?).\";",
                    indent + "    if (freshAirLongCount >= 3) return \"Vorbildlich gel\u00FCftet (\u22655 Min, 3\u00D7 empfohlen).\";",
                    indent + "    if (freshAirLongCount > 0) return freshAirLongCount + \"\u00D7 \u22655 Min \u2013 fast optimal (3\u00D7 empfohlen).\";",
                    indent + "    return \"Ge\u00F6ffnet, aber k\u00FCrzer als 5 Min (Sto\u00DFl\u00FCftung empfohlen).\";",
                    indent + "};"
                ];
                lines.splice(i, endIdx - i + 1, ...newNarrative);
                console.log('  OK: getFreshAirNarrative aktualisiert (Zeile ' + (i+1) + ')');
                fs.writeFileSync(htPath, lines.join('\n'), 'utf8');
            }
            break;
        }
    }
}

// H: Fresh Air Tile erweitern
{
    const raw = fs.readFileSync(htPath, 'utf8');
    const lines = raw.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('FRESH AIR') && lines[i].includes('TerminalBox')) {
            // Suche Ende des TerminalBox-Blocks (nach dem </TerminalBox>)
            let endIdx = -1;
            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j].includes('</TerminalBox>')) { endIdx = j; break; }
            }
            if (endIdx > i) {
                const newTile = [
                    "                    <TerminalBox title=\"FRESH AIR\" themeType={themeType} helpText={\"Zeigt wie oft heute T\u00FCr/Fenster-Sensoren (Typ: T\u00FCr/Fenster) ge\u00F6ffnet wurden. Sto\u00DFl\u00FCftung = mind. 5 Min offen. Empfehlung: 3\u00D7 t\u00E4glich \u22655 Min (Forschungsbasiert: DIN EN 15251, Pettenkofer-Zahl).\">",
                    "                        <div style={{textAlign:'center'}}>",
                    "                            <div style={{fontSize:'2rem', color: hasData ? '#00e676' : '#888', fontWeight:'bold'}}>{freshAirCount}x</div>",
                    "                            {hasData && freshAirLongCount > 0 && (",
                    "                                <div style={{fontSize:'0.8rem', color: freshAirLongCount >= 3 ? '#00e676' : '#ffb300', marginTop:'2px'}}>",
                    "                                    davon {freshAirLongCount}\u00D7 \u22655 Min",
                    "                                    <span style={{color: isDark?'#666':'#aaa'}}> (Empf.: 3\u00D7)</span>",
                    "                                </div>",
                    "                            )}",
                    "                            {hasData && freshAirLongCount === 0 && freshAirCount > 0 && (",
                    "                                <div style={{fontSize:'0.75rem', color:'#ff7043', marginTop:'2px'}}>",
                    "                                    Zu kurz \u2013 Sto\u00DFl\u00FCftung \u22655 Min empfohlen",
                    "                                </div>",
                    "                            )}",
                    "                            <Divider sx={{my:1, borderColor: isDark?'#333':'#eee'}} />",
                    "                            <div style={{fontSize:'0.8rem'}}>{hasData ? getFreshAirNarrative() : \"Keine Daten\"}</div>",
                    "                        </div>",
                    "                    </TerminalBox>"
                ];
                lines.splice(i, endIdx - i + 1, ...newTile);
                console.log('  OK: Fresh Air Tile erweitert (Zeile ' + (i+1) + ')');
                fs.writeFileSync(htPath, lines.join('\n'), 'utf8');
            }
            break;
        }
    }
}

// ============================================================
// main.js + lib/main.js
// ============================================================
for (const mainPath of ['main.js', 'lib/main.js', 'lib\\main.js']) {
    if (!fs.existsSync(mainPath)) continue;
    console.log('\n--- ' + mainPath + ' ---');
    
    const raw = fs.readFileSync(mainPath, 'utf8');
    const lines = raw.split('\n');
    let changed = false;
    
    // Suche "}).length;" nach dem freshAirCount filter block
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('return isDoorSensor && isOpen;') && 
            i + 1 < lines.length && lines[i+1].trim() === '}).length;') {
            const longBlock = [
                "            // 5-Min-Sto\u00DFl\u00FCftungen: OPEN/CLOSE-Paare >= 5 Min",
                "            const FRESH_AIR_MIN_MS = 5 * 60 * 1000;",
                "            const doorEventsToday = this.eventHistory",
                "                .filter(e => { const ts = e.timestamp || e.ts || 0; return ts >= startOfDayTimestamp && e.type === 'door'; })",
                "                .sort((a, b) => (a.timestamp || a.ts || 0) - (b.timestamp || b.ts || 0));",
                "            const openMap = {};",
                "            let freshAirLongCount = 0;",
                "            for (const e of doorEventsToday) {",
                "                const ts = e.timestamp || e.ts || 0;",
                "                const isOpen = e.value === true || e.value === 1 || e.value === 'true' || e.value === 'open';",
                "                if (isOpen) { openMap[e.id] = ts; }",
                "                else { if (openMap[e.id] && (ts - openMap[e.id] >= FRESH_AIR_MIN_MS)) freshAirLongCount++; delete openMap[e.id]; }",
                "            }",
                "            for (const openTs of Object.values(openMap)) { if ((Date.now() - openTs) >= FRESH_AIR_MIN_MS) freshAirLongCount++; }"
            ];
            lines.splice(i + 2, 0, ...longBlock);
            console.log('  OK: freshAirLongCount Berechnung nach Zeile ' + (i+2));
            changed = true;
            break;
        }
    }
    
    // freshAirLongCount in data object einfuegen
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('freshAirCount: freshAirCount,') && 
            i + 1 < lines.length && lines[i+1].includes('windowOpenings:')) {
            lines.splice(i + 1, 0, "                freshAirLongCount: freshAirLongCount,");
            console.log('  OK: freshAirLongCount in data object (Zeile ' + (i+2) + ')');
            changed = true;
            break;
        }
    }
    
    if (changed) {
        fs.writeFileSync(mainPath, lines.join('\n'), 'utf8');
        console.log('  Geschrieben: ' + mainPath);
    }
}

console.log('\nDone!');
