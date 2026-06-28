/**
 * PATCH v0.33.326 — Terminologie B (Fortsetzung, exakte Texte)
 */
const fs = require('fs');
const path = require('path');

const buildPath = path.join(__dirname, '..', 'src', 'lib', 'pwa_sleep_tile_build.js');
let build = fs.readFileSync(buildPath, 'utf8');
let ok = 0;

function patch(OLD, NEW, label) {
    if (!build.includes(OLD)) { console.error('NICHT GEFUNDEN: ' + label + '\n  Gesucht: ' + OLD.substring(0, 80)); process.exit(1); }
    build = build.replace(OLD, NEW);
    ok++;
    console.log('OK: ' + label);
}

// L472: post-sleep Slot-Tooltip (das ??? Zeichen ist ein kaputtes Encoding-Zeichen)
// Exakter Buffer-Inhalt:
const buf472 = build.split('\n')[471]; // line 472 = index 471
console.log('L472 raw:', JSON.stringify(buf472));

// Ersetze den gesamten return-String
patch(
    "return 'Wachliegen: ' + fmtTime(swEnd) + ",
    "return 'Aufwachphase: ' + fmtTime(swEnd) + ",
    'slotTip post-sleep: Wachliegen → Aufwachphase'
);

// L561: wachliegenOverlay title
patch(
    "title: 'Wachliegen: ' + fmtTime(swEnd) + '\\u2013' + fmtTime(bedExitTs) + ' (' + Math.round((bedExitTs - swEnd) / 60000) + ' min)'",
    "title: 'Aufwachphase: ' + fmtTime(swEnd) + '\\u2013' + fmtTime(bedExitTs) + ' (' + Math.round((bedExitTs - swEnd) / 60000) + ' min)'",
    'wachliegenOverlay title → Aufwachphase'
);

// L606: pre-sleep Segment tooltip
patch(
    "'Ins Bett / Wachliegen (' + fmtTime(bedEntryTsVal) + ' - ' + (swStart ? fmtTime(swStart) : '?') + ')'",
    "'Einschlafphase: ' + fmtTime(bedEntryTsVal) + ' \u2013 ' + (swStart ? fmtTime(swStart) : '?')",
    'pre-sleep segment tip → Einschlafphase'
);

// L633: post-sleep segment tip
patch(
    "tip: isConfirmedAwake ? 'Wachliegen' : 'Keine Sensordaten'",
    "tip: isConfirmedAwake ? 'Aufwachphase' : 'Keine Sensordaten'",
    'post-sleep segment tip → Aufwachphase'
);

fs.writeFileSync(buildPath, build);
console.log('\npwa_sleep_tile_build.js: ' + ok + ' Patches OK');
