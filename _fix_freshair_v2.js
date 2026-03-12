/**
 * Fix Fresh Air:
 * 1. HealthTab.tsx Live-Pfad: Keyword-Matching → e.type === 'door'
 * 2. HealthTab.tsx faCount-Pfad: Keyword-Matching → e.type === 'door' + freshAirLongCount
 * 3. HealthTab.tsx: State + Cache + Tile-Anzeige aktualisieren
 * 4. main.js + lib/main.js: freshAirLongCount in saveDailyHistory
 */
const fs = require('fs');
const path = require('path');

function fixFile(filePath, fixes) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = 0;
    for (const [oldStr, newStr] of fixes) {
        if (content.includes(oldStr)) {
            content = content.replace(oldStr, newStr);
            changed++;
        } else {
            console.warn('  WARNUNG: String nicht gefunden in ' + filePath + ':\n  ' + oldStr.substring(0, 80));
        }
    }
    if (changed > 0) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('  OK: ' + changed + '/' + fixes.length + ' Fixes in ' + filePath);
    }
    return changed;
}

// ============================================================
// 1. HealthTab.tsx
// ============================================================
const healthTabPath = 'src-admin/src/components/tabs/HealthTab.tsx';

// Fix A: State-Deklaration – freshAirLongCount hinzufügen
const fixA_old = `    const [freshAirCount, setFreshAirCount] = useState(0);
    const [lastFreshAir, setLastFreshAir] = useState('-');`;
const fixA_new = `    const [freshAirCount, setFreshAirCount] = useState(0);
    const [freshAirLongCount, setFreshAirLongCount] = useState(0);
    const [lastFreshAir, setLastFreshAir] = useState('-');`;

// Fix B: Cache-Lade-Pfad – freshAirLongCount aus Cache laden
const fixB_old = `                    setFreshAirCount(d.freshAirCount || 0);`;
const fixB_new = `                    setFreshAirCount(d.freshAirCount || 0);
                    setFreshAirLongCount(d.freshAirLongCount || 0);`;

// Fix C: Reset-Pfad – freshAirLongCount zurücksetzen
const fixC_old = `                    setFreshAirCount(0);
                    setMeals({ breakfast: false, lunch: false, dinner: false });`;
const fixC_new = `                    setFreshAirCount(0);
                    setFreshAirLongCount(0);
                    setMeals({ breakfast: false, lunch: false, dinner: false });`;

// Fix D: Live-Pfad (Wochenansicht) – Keyword-Matching durch Typ-System ersetzen
// + freshAirLongCount berechnen
const fixD_old = `                                const freshAir = eventHist.filter((e: any) => {
                                    if (e.timestamp < startOfDay.getTime()) return false;
                                    const nameLower = (e.name || '').toLowerCase();
                                    const isActive = e.value === true || e.value === 1 || e.value === 'on' || e.value === 'true';
                                    return (nameLower.includes('haust\u00FCr') || nameLower.includes('terrasse')) && isActive;
                                }).length;`;
const fixD_new = `                                const freshAir = eventHist.filter((e: any) => {
                                    if (e.timestamp < startOfDay.getTime()) return false;
                                    const isOpen = e.value === true || e.value === 1 || e.value === 'on' || e.value === 'true' || e.value === 'open';
                                    return e.type === 'door' && isOpen;
                                }).length;
                                // 5-Min-Stoßlüftungen zählen
                                const FRESH_MIN_MS = 5 * 60 * 1000;
                                const doorEvts = eventHist.filter((e: any) => e.timestamp >= startOfDay.getTime() && e.type === 'door')
                                    .sort((a: any, b: any) => a.timestamp - b.timestamp);
                                const openMap5: Record<string, number> = {};
                                let freshAirLong = 0;
                                for (const e of doorEvts) {
                                    const isOpen = e.value === true || e.value === 1 || e.value === 'on' || e.value === 'true' || e.value === 'open';
                                    if (isOpen) { openMap5[e.id] = e.timestamp; }
                                    else { if (openMap5[e.id] && (e.timestamp - openMap5[e.id] >= FRESH_MIN_MS)) freshAirLong++; delete openMap5[e.id]; }
                                }
                                Object.values(openMap5).forEach((ts: any) => { if (Date.now() - ts >= FRESH_MIN_MS) freshAirLong++; });`;

// Fix E: Live-Pfad Rückgabe – freshAirLongCount hinzufügen
const fixE_old = `                                        freshAirCount: freshAir,
                                        geminiDay: geminiDay,`;
const fixE_new = `                                        freshAirCount: freshAir,
                                        freshAirLongCount: freshAirLong,
                                        geminiDay: geminiDay,`;

// Fix F: processEvents faCount – Keyword-Matching durch Typ-System ersetzen
const fixF_old = `            if ((evt.name.toLowerCase().includes('haust\u00FCr') || evt.name.toLowerCase().includes('terrasse')) && isActive) {
                faCount++; lastFA = date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            }`;
const fixF_new = `            if (evt.type === 'door' && isActive) {
                faCount++; lastFA = date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            }`;

// Fix G: setFreshAirCount setzen – freshAirLongCount auch setzen
// processEvents hat kein Long-Count (Live-Echtzeit) – wir lassen es beim Count
// Aber narrative updaten auf Basis des cached Long-Count
const fixG_old = `    // --- NARRATORS ---
    const getFreshAirNarrative = () => {
        if (!hasData) return "Keine Daten.";
        if (freshAirCount === 0) return "Keine \u00D6ffnung erkannt (Wetter schlecht?).";
        if (freshAirCount > 2) return "Vorbildlich gel\u00FCftet heute.";
        return "Minimale Frischluftzufuhr.";
    };`;
const fixG_new = `    // --- NARRATORS ---
    const getFreshAirNarrative = () => {
        if (!hasData) return "Keine Daten.";
        if (freshAirCount === 0) return "Keine \u00D6ffnung erkannt (Wetter schlecht?).";
        if (freshAirLongCount >= 3) return "Vorbildlich gel\u00FCftet (\u22655 Min, 3\u00D7 empfohlen).";
        if (freshAirLongCount > 0) return freshAirLongCount + "\u00D7 \u22655 Min \u2013 fast optimal (3\u00D7 empfohlen).";
        return "Ge\u00F6ffnet, aber k\u00FCrzer als 5 Min (Sto\u00DFl\u00FCftung empfohlen).";
    };`;

// Fix H: Fresh Air Tile – erweiterte Anzeige
const fixH_old = `                    <TerminalBox title="FRESH AIR" themeType={themeType} helpText={"Zeigt wie oft heute Fenster oder T\u00FCren ge\u00F6ffnet wurden. Regelm\u00E4\u00DFiges L\u00FCften ist ein Zeichen f\u00FCr aktiven Alltag. Nur Kontaktsensoren vom Typ T\u00FCr werden ber\u00FCcksichtigt."}>
                        <div style={{textAlign:'center'}}>
                            <div style={{fontSize:'2rem', color: hasData ? '#00e676' : '#888', fontWeight:'bold'}}>{freshAirCount}x</div>
                            <Divider sx={{my:1, borderColor: isDark?'#333':'#eee'}} />
                            <div style={{fontSize:'0.8rem'}}>{hasData ? getFreshAirNarrative() : "Keine Daten"}</div>
                        </div>
                    </TerminalBox>`;
const fixH_new = `                    <TerminalBox title="FRESH AIR" themeType={themeType} helpText={"Zeigt wie oft heute T\u00FCr-/Fenstersensoren (Typ: T\u00FCr/Fenster) ge\u00F6ffnet wurden. Sto\u00DFl\u00FCftung = mind. 5 Min offen. Empfehlung: 3\u00D7 t\u00E4glich \u22655 Min (Forschungsbasiert: DIN EN 15251, Pettenkofer-Zahl)."}>
                        <div style={{textAlign:'center'}}>
                            <div style={{fontSize:'2rem', color: hasData ? '#00e676' : '#888', fontWeight:'bold'}}>{freshAirCount}x</div>
                            {hasData && freshAirLongCount > 0 && (
                                <div style={{fontSize:'0.8rem', color: freshAirLongCount >= 3 ? '#00e676' : '#ffb300', marginTop:'2px'}}>
                                    davon {freshAirLongCount}\u00D7 \u22655 Min
                                    <span style={{color: isDark?'#666':'#aaa'}}> (Empf.: 3\u00D7)</span>
                                </div>
                            )}
                            {hasData && freshAirLongCount === 0 && freshAirCount > 0 && (
                                <div style={{fontSize:'0.75rem', color:'#ff7043', marginTop:'2px'}}>
                                    Zu kurz \u2013 Sto\u00DFl\u00FCftung \u22655 Min empfohlen
                                </div>
                            )}
                            <Divider sx={{my:1, borderColor: isDark?'#333':'#eee'}} />
                            <div style={{fontSize:'0.8rem'}}>{hasData ? getFreshAirNarrative() : "Keine Daten"}</div>
                        </div>
                    </TerminalBox>`;

const htFixes = [
    [fixA_old, fixA_new],
    [fixB_old, fixB_new],
    [fixC_old, fixC_new],
    [fixD_old, fixD_new],
    [fixE_old, fixE_new],
    [fixF_old, fixF_new],
    [fixG_old, fixG_new],
    [fixH_old, fixH_new],
];

console.log('--- Fixing HealthTab.tsx ---');
fixFile(healthTabPath, htFixes);

// ============================================================
// 2. main.js + lib/main.js: freshAirLongCount in saveDailyHistory
// ============================================================
const freshAirLongSnippetOld = 
`            const freshAirCount = this.eventHistory.filter(e => {
                const ts = e.timestamp || e.ts || 0;
                if (ts < startOfDayTimestamp) return false;
                const isDoorSensor = e.type === 'door';
                const isOpen = e.value === true || e.value === 1 || e.value === 'true' || e.value === 'open';
                return isDoorSensor && isOpen;
            }).length;`;

const freshAirLongSnippetNew = 
`            const freshAirCount = this.eventHistory.filter(e => {
                const ts = e.timestamp || e.ts || 0;
                if (ts < startOfDayTimestamp) return false;
                const isDoorSensor = e.type === 'door';
                const isOpen = e.value === true || e.value === 1 || e.value === 'true' || e.value === 'open';
                return isDoorSensor && isOpen;
            }).length;
            // 5-Min-Sto\u00DFl\u00FCftungen: OPEN/CLOSE-Paare >= 5 Min
            const FRESH_AIR_MIN_MS = 5 * 60 * 1000;
            const doorEventsToday = this.eventHistory
                .filter(e => { const ts = e.timestamp || e.ts || 0; return ts >= startOfDayTimestamp && e.type === 'door'; })
                .sort((a, b) => (a.timestamp || a.ts || 0) - (b.timestamp || b.ts || 0));
            const openMap = {};
            let freshAirLongCount = 0;
            for (const e of doorEventsToday) {
                const ts = e.timestamp || e.ts || 0;
                const isOpen = e.value === true || e.value === 1 || e.value === 'true' || e.value === 'open';
                if (isOpen) { openMap[e.id] = ts; }
                else { if (openMap[e.id] && (ts - openMap[e.id] >= FRESH_AIR_MIN_MS)) freshAirLongCount++; delete openMap[e.id]; }
            }
            for (const openTs of Object.values(openMap)) { if ((Date.now() - openTs) >= FRESH_AIR_MIN_MS) freshAirLongCount++; }`;

const freshAirDataOld = 
`                freshAirCount: freshAirCount,
                windowOpenings: freshAirCount,`;
const freshAirDataNew = 
`                freshAirCount: freshAirCount,
                freshAirLongCount: freshAirLongCount,
                windowOpenings: freshAirCount,`;

const mainFiles = ['main.js', 'lib/main.js'];
for (const f of mainFiles) {
    console.log('--- Fixing ' + f + ' ---');
    fixFile(f, [
        [freshAirLongSnippetOld, freshAirLongSnippetNew],
        [freshAirDataOld, freshAirDataNew],
    ]);
}

console.log('\nDone. Bitte Build und Adapter-Neustart durchfuehren.');
