const fs = require('fs');
let src = fs.readFileSync('src-admin/src/components/tabs/SexTab.tsx', 'utf8');

// -------------------------------------------------------
// Fix 1: isNullnummerFn in SevenDayHistory
// Schutz: Wenn ein positives Label (vaginal/oral) für denselben Tag existiert
// → NICHT als Nullnummer-Tag behandeln (identischer Ansatz wie MonthCalendar-Fix)
// -------------------------------------------------------
const oldFn = `    const isNullnummerFn = (dateStr: string, evts: IntimacyEvent[]) => {
        if (!labels || evts.length === 0) return false;
        const lbl = evts.length > 0 ? labels.find((l: any) => {
            const evtDate = new Date(evts[0].start).toISOString().slice(0,10);
            return l.date === dateStr && l.type === 'nullnummer';
        }) : undefined;
        return !!lbl;
    };`;
const newFn = `    const isNullnummerFn = (dateStr: string, evts: IntimacyEvent[]) => {
        if (!labels || evts.length === 0) return false;
        // Wenn ein positives Label (vaginal/oral) fuer denselben Tag existiert → kein Nullnummer-Tag
        const hasPositiveLabel = labels.some((l: any) => l.date === dateStr && (l.type === 'vaginal' || l.type === 'oral_hand'));
        if (hasPositiveLabel) return false;
        const lbl = labels.find((l: any) => l.date === dateStr && l.type === 'nullnummer');
        return !!lbl;
    };`;

if (!src.includes(oldFn)) { console.error('Fix1 FEHLER: isNullnummerFn nicht gefunden'); process.exit(1); }
src = src.replace(oldFn, newFn);
console.log('Fix1 OK: isNullnummerFn');

// -------------------------------------------------------
// Fix 2: loadDay setCalibInfo - trained=true nie durch null überschreiben
// Functional update: wenn bereits trained=true, behalten wenn neues false/null
// -------------------------------------------------------
const oldCalib1 = `            if (result?.data?.sexCalibInfo) setCalibInfo(result.data.sexCalibInfo);`;
const newCalib1 = `            if (result?.data?.sexCalibInfo) setCalibInfo((prev: any) => {
                const nc = result.data.sexCalibInfo;
                // trained=true nie durch null/false ueberschreiben (Race-Condition bei parallelem 7-Tage-Load)
                if (prev?.pyClassifier?.trained && !nc?.pyClassifier?.trained)
                    return { ...nc, pyClassifier: prev.pyClassifier };
                return nc;
            });`;

// There are two occurrences - the one in reanalyzeDay (line ~1600) and loadDay (line ~1706)
// Fix only the loadDay version first (line ~1706)
const oldCalib2 = `            if (result.data.sexCalibInfo) setCalibInfo(result.data.sexCalibInfo);`;
const newCalib2 = `            if (result.data.sexCalibInfo) setCalibInfo((prev: any) => {
                const nc = result.data.sexCalibInfo;
                // trained=true nie durch null/false ueberschreiben
                if (prev?.pyClassifier?.trained && !nc?.pyClassifier?.trained)
                    return { ...nc, pyClassifier: prev.pyClassifier };
                return nc;
            });`;

const count1 = (src.match(new RegExp(oldCalib1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
const count2 = (src.match(new RegExp(oldCalib2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
console.log(`Fix2a occurrences: ${count1}, Fix2b occurrences: ${count2}`);

if (count1 > 0) { src = src.replace(new RegExp(oldCalib1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newCalib1); console.log('Fix2a OK'); }
if (count2 > 0) { src = src.replace(new RegExp(oldCalib2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newCalib2); console.log('Fix2b OK'); }

fs.writeFileSync('src-admin/src/components/tabs/SexTab.tsx', src, 'utf8');
console.log('Alle Fixes angewendet.');
