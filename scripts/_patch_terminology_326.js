/**
 * PATCH v0.33.326 — Terminologie B
 * 
 * "Wachliegen" hat bisher zwei völlig verschiedene Bedeutungen:
 *   1. Gelber Balken VOR dem Schlaf (bedEntryTs → sleepWindowStart) = Einschlafphase
 *   2. Gelber Balken NACH dem Schlaf (sleepWindowEnd → bedExitTs) = Aufwachphase
 *   3. Wake-Slots WÄHREND des Schlafs (smWakePhases) = Schlafunterbrechungen
 * 
 * Neue klare Terminologie:
 *   - Pre-sleep gelber Balken → "Einschlafphase"
 *   - Post-sleep gelber Balken → "Aufwachphase"
 *   - Schlaf-Wake-Stats → "Schlafunterbrechung"
 */
const fs = require('fs');
const path = require('path');

// --- pwa_sleep_tile_build.js ---
const buildPath = path.join(__dirname, '..', 'src', 'lib', 'pwa_sleep_tile_build.js');
let build = fs.readFileSync(buildPath, 'utf8');
let buildChanged = 0;

function patchBuild(OLD, NEW, label) {
    if (!build.includes(OLD)) { console.error('BUILD NICHT GEFUNDEN: ' + label); process.exit(1); }
    build = build.replace(OLD, NEW);
    buildChanged++;
    console.log('BUILD OK: ' + label);
}

// L20: Stats-Label für Wake-Slots während Schlaf
patchBuild(
    "wake: 'Wachliegen',",
    "wake: 'Schlafunterbr.',",
    'Stats-Label wake → Schlafunterbr.'
);

// L472: Slot-Tooltip für post-sleep Bereich
patchBuild(
    "return 'Wachliegen: ' + fmtTime(swEnd) + '\\u{FFFD}' + fmtTime(bedExitTs) + ' (' + _wachMin + ' Min)';",
    "return 'Aufwachphase: ' + fmtTime(swEnd) + '\\u2013' + fmtTime(bedExitTs) + ' (' + _wachMin + ' Min)';",
    'slotTip post-sleep: Wachliegen → Aufwachphase'
);

// L561: wachliegenOverlay title
patchBuild(
    "title: 'Wachliegen: ' + fmtTime(swEnd) + '\\u2013' + fmtTime(bedExitTs) + ' (' + Math.round((bedExitTs - swEnd) / 60000) + ' min)'",
    "title: 'Aufwachphase: ' + fmtTime(swEnd) + '\\u2013' + fmtTime(bedExitTs) + ' (' + Math.round((bedExitTs - swEnd) / 60000) + ' min)'",
    'wachliegenOverlay title → Aufwachphase'
);

// L606: pre-sleep Segment tooltip
patchBuild(
    "'Ins Bett / Wachliegen (' + fmtTime(bedEntryTsVal) + ' - ' + (swStart ? fmtTime(swStart) : '?') + ')'",
    "'Einschlafphase: ' + fmtTime(bedEntryTsVal) + ' \u2013 ' + (swStart ? fmtTime(swStart) : '?')",
    'pre-sleep segment tip → Einschlafphase'
);

// L633: post-sleep segment tooltip (isConfirmedAwake)
patchBuild(
    "tip: isConfirmedAwake ? 'Wachliegen' : 'Keine Sensordaten'",
    "tip: isConfirmedAwake ? 'Aufwachphase' : 'Keine Sensordaten'",
    'post-sleep segment tip → Aufwachphase'
);

fs.writeFileSync(buildPath, build);
console.log('pwa_sleep_tile_build.js: ' + buildChanged + ' Patches OK\n');

// --- pwa_sleep_tile_client.js: Stats Label ---
const clientPath = path.join(__dirname, '..', 'src', 'lib', 'pwa_sleep_tile_client.js');
let client = fs.readFileSync(clientPath, 'utf8');
let clientChanged = 0;

function patchClient(OLD, NEW, label) {
    if (!client.includes(OLD)) { console.error('CLIENT NICHT GEFUNDEN: ' + label); process.exit(1); }
    client = client.replace(OLD, NEW);
    clientChanged++;
    console.log('CLIENT OK: ' + label);
}

// L398: Stats-Box Label
patchClient(
    "{ col: '#ffd54f', label: 'Wachliegen', min: L.wakeMin }",
    "{ col: '#ffd54f', label: 'Schlafunterbr.', min: L.wakeMin }",
    'Stats-Box label → Schlafunterbr.'
);

fs.writeFileSync(clientPath, client);
console.log('pwa_sleep_tile_client.js: ' + clientChanged + ' Patches OK');
