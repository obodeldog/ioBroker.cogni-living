/**
 * PATCH v0.33.326 — Terminologie in HealthTab.tsx
 * + Sensor-Hint sensorHint Anzeige in VIB-CAL Karte
 */
const fs = require('fs');
const path = require('path');

const htPath = path.join(__dirname, '..', 'src-admin', 'src', 'components', 'tabs', 'HealthTab.tsx');
let ht = fs.readFileSync(htPath, 'utf8');
let ok = 0;

function patch(OLD, NEW, label) {
    if (!ht.includes(OLD)) { console.error('NICHT GEFUNDEN: ' + label); process.exit(1); }
    ht = ht.replace(OLD, NEW);
    ok++;
    console.log('OK: ' + label);
}

// 1. L1440: stageLabel wake
patch(
    "deep: 'Tief', light: 'Leicht', rem: 'REM (est.)', wake: 'Wachliegen',",
    "deep: 'Tief', light: 'Leicht', rem: 'REM (est.)', wake: 'Schlafunterbr.',",
    'stageLabel wake → Schlafunterbr.'
);

// 2. L1602: post-sleep slotTip
patch(
    "return 'Wachliegen: ' + fmtTime(swEnd) + '–' + fmtTime(bedExitTs) + ' (' + _wachMin + ' Min)';",
    "return 'Aufwachphase: ' + fmtTime(swEnd) + '–' + fmtTime(bedExitTs) + ' (' + _wachMin + ' Min)';",
    'slotTip post-sleep → Aufwachphase'
);

// 3. L2554: pre-sleep Segment title
patch(
    "}} title={'🛏 Ins Bett gegangen: ' + fmtTime(bedEntryTsVal) + ' · Wachliegen ' + Math.round(bedEntrySegMs/60000) + ' Min bis Einsc",
    "}} title={'🛏 Ins Bett gegangen: ' + fmtTime(bedEntryTsVal) + ' · Einschlafphase ' + Math.round(bedEntrySegMs/60000) + ' Min bis Einsc",
    'pre-sleep Segment title → Einschlafphase'
);

// 4. L2591: post-sleep segment title
patch(
    "}} title={'Wachliegen (Garmin/Sensor bestätigt): '",
    "}} title={'Aufwachphase (Garmin/Sensor bestätigt): '",
    'post-sleep segment title → Aufwachphase'
);

// 5. L2623: wachliegenOverlay title
patch(
    "}} title={'Wachliegen: ' + fmtTime(swEnd) + '–' + fmtTime(bedExitTs) + ' (' + Math.round((bedExitTs - swEnd) / 60000) + ' min)'} />",
    "}} title={'Aufwachphase: ' + fmtTime(swEnd) + '–' + fmtTime(bedExitTs) + ' (' + Math.round((bedExitTs - swEnd) / 60000) + ' min)'} />",
    'wachliegenOverlay title → Aufwachphase'
);

// 6. L2824: stats Wachliegen label
patch(
    "['wake','Wachliege",
    "['wake','Schlafunterbr.",
    'stats array wake label → Schlafunterbr.'
);

// 7. L3711: Wach-Zeile in Smartwatch-Referenz (bleibt "Wach", kein Wachliegen hier)
// → nicht ändern, das ist korrekt

fs.writeFileSync(htPath, ht);
console.log('\nHealthTab.tsx: ' + ok + ' Patches OK');
