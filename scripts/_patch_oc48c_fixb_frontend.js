/**
 * PATCH: OC-48c v2 / Fix B — Frontend-Rendering der Vor-Schlaf-Abwesenheit
 *
 * Rendert sd.preSleepAbsenceEvents als grau-schraffiertes Overlay im gelben Vor-Schlaf-Segment
 * (Ins-Bett-Zeit -> Einschlafzeit), damit ein echter Ausflug NICHT als Phantom-Wachliegen erscheint.
 *
 * Dateien:
 *  - src/lib/pwa_sleep_tile_build.js   (Overlay-Berechnung + Rueckgabe)
 *  - src/lib/pwa_sleep_tile_client.js  (Overlay-Render im PWA)
 *  - src-admin/src/components/tabs/HealthTab.tsx (Overlay-Render im Admin)
 */
'use strict';
const fs = require('fs');
const path = require('path');

function patchFile(rel, fn) {
    const p = path.join(__dirname, '..', rel);
    let s = fs.readFileSync(p, 'utf8');
    s = fn(s, function must(cond, label) { if (!cond) { console.error('FEHLER [' + rel + ']: ' + label); process.exit(1); } });
    fs.writeFileSync(p, s, 'utf8');
    console.log('OK ' + rel);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) tile_build: Overlay-Berechnung vor "const segments = [];" + Rueckgabe
// ─────────────────────────────────────────────────────────────────────────────
patchFile('src/lib/pwa_sleep_tile_build.js', function (s, must) {
    const A1 = '    const segments = [];';
    must(s.includes(A1), 'tile_build: "const segments = []" Anker');
    must(s.split(A1).length === 2, 'tile_build: segments-Anker nicht eindeutig');
    const PSA =
'    // [OC-48c v2 / Fix B] Vor-Schlaf-Abwesenheit: Ausflug zwischen Ins-Bett-Zeit und Einschlafen\n' +
'    var preSleepAbsenceOverlays = [];\n' +
'    var _psaArr = Array.isArray(sd.preSleepAbsenceEvents) ? sd.preSleepAbsenceEvents : [];\n' +
'    if (bedEntryTsVal != null && newBarTotalMs && _psaArr.length > 0) {\n' +
'        _psaArr.forEach(function (ev) {\n' +
'            if (!ev || ev.start == null || ev.end == null || ev.end <= ev.start) return;\n' +
'            var leftPct = Math.max(0, Math.min(100, ((ev.start - bedEntryTsVal) / newBarTotalMs) * 100));\n' +
'            var widthPct = Math.max(0.5, Math.min(100 - leftPct, ((ev.end - ev.start) / newBarTotalMs) * 100));\n' +
'            var durMin = ev.durationMin != null ? ev.durationMin : Math.max(1, Math.round((ev.end - ev.start) / 60000));\n' +
'            preSleepAbsenceOverlays.push({\n' +
'                leftPct: leftPct,\n' +
'                widthPct: widthPct,\n' +
'                title: \'\\uD83D\\uDEB6 Vor dem Einschlafen ausser Bett: \' + fmtTime(ev.start) + \' \\u2013 \' + fmtTime(ev.end) + \' (\' + durMin + \' Min)\'\n' +
'            });\n' +
'        });\n' +
'    }\n\n';
    s = s.replace(A1, PSA + A1);

    const A2 = '        sharedBedOverlays: sharedBedOverlays\n    };';
    must(s.includes(A2), 'tile_build: Rueckgabe sharedBedOverlays Anker');
    s = s.replace(A2, '        sharedBedOverlays: sharedBedOverlays,\n        preSleepAbsenceOverlays: preSleepAbsenceOverlays\n    };');
    return s;
});

// ─────────────────────────────────────────────────────────────────────────────
// 2) tile_client: Overlay-Render vor dem "pwa-sleep-bar-hit"-Div
// ─────────────────────────────────────────────────────────────────────────────
patchFile('src/lib/pwa_sleep_tile_client.js', function (s, must) {
    const A = "      html +=\n        '<div class=\"pwa-sleep-bar-hit\"";
    must(s.includes(A), 'tile_client: pwa-sleep-bar-hit Anker');
    const REND =
'      // [OC-48c v2 / Fix B] Vor-Schlaf-Abwesenheit (grau schraffiert ueber gelbem Segment)\n' +
'      var _psaOvl = pl.preSleepAbsenceOverlays || [];\n' +
'      for (var _px = 0; _px < _psaOvl.length; _px++) {\n' +
'        var _po = _psaOvl[_px];\n' +
'        var _psStripe = \'repeating-linear-gradient(135deg, transparent 0px, transparent 5px, rgba(255,255,255,0.30) 5px, rgba(255,255,255,0.30) 8px)\';\n' +
'        html +=\n' +
'          \'<div style="position:absolute;top:0;left:\' + _po.leftPct +\n' +
'          \'%;width:\' + _po.widthPct +\n' +
'          \'%;height:28px;background-color:#6e6e6e;background-image:\' + _psStripe +\n' +
'          \';opacity:1;pointer-events:none;z-index:3;box-sizing:border-box;border-left:1px solid rgba(100,100,100,0.6);border-right:1px solid rgba(100,100,100,0.6)" title="\' +\n' +
'          esc(_po.title) + \'"></div>\';\n' +
'      }\n';
    s = s.replace(A, REND + A);
    return s;
});

// ─────────────────────────────────────────────────────────────────────────────
// 3) HealthTab.tsx: Datenextraktion + Overlay-Render nach bedAbsence-Map
// ─────────────────────────────────────────────────────────────────────────────
patchFile('src-admin/src/components/tabs/HealthTab.tsx', function (s, must) {
    const A1 = '        const _hasBedAbsenceEngine = _bedAbsenceEvts.length > 0;';
    must(s.includes(A1), 'HealthTab: _hasBedAbsenceEngine Anker');
    must(s.split(A1).length === 2, 'HealthTab: _hasBedAbsenceEngine nicht eindeutig');
    const EXTRACT =
'\n        // [OC-48c v2 / Fix B] Vor-Schlaf-Abwesenheit (Ausflug vor dem Einschlafen)\n' +
'        const _preSleepAbsenceEvts: {start:number,end:number,durationMin?:number,source?:string}[] =\n' +
'            (((sd as any)?.preSleepAbsenceEvents ?? []) as {start:number,end:number,durationMin?:number,source?:string}[])\n' +
'                .filter((ev) => ev && ev.start != null && ev.end != null && ev.end > ev.start);';
    s = s.replace(A1, A1 + EXTRACT);

    const A2 = '                            {/* OC-31 Stage 2 (LEGACY-Fallback):';
    must(s.includes(A2), 'HealthTab: OC-31 Stage 2 Anker');
    const REND =
'                            {/* [OC-48c v2 / Fix B] Vor-Schlaf-Abwesenheit: Ausflug zwischen Ins-Bett-Zeit und Einschlafen (grau schraffiert ueber gelbem Segment) */}\n' +
'                            {bedEntryTsVal && newBarTotalMs && _preSleepAbsenceEvts.map((ev, i) => {\n' +
'                                const _left = Math.max(0, Math.min(100, ((ev.start - bedEntryTsVal) / newBarTotalMs!) * 100));\n' +
'                                const _width = Math.max(0.5, Math.min(100 - _left, ((ev.end - ev.start) / newBarTotalMs!) * 100));\n' +
'                                const _dur = ev.durationMin != null ? ev.durationMin : Math.max(1, Math.round((ev.end - ev.start) / 60000));\n' +
'                                const _bgColor = isDark ? \'#4a4a4a\' : \'#d4d4d4\';\n' +
'                                const _stripeColor = isDark ? \'rgba(255,255,255,0.25)\' : \'rgba(0,0,0,0.22)\';\n' +
'                                const _stripe = \'repeating-linear-gradient(135deg, transparent 0px, transparent 5px, \' + _stripeColor + \' 5px, \' + _stripeColor + \' 8px)\';\n' +
'                                return (\n' +
'                                    <div key={\'psa\'+i} style={{\n' +
'                                        position: \'absolute\', top: 0,\n' +
'                                        left: _left + \'%\', width: _width + \'%\', height: \'28px\',\n' +
'                                        backgroundColor: _bgColor, backgroundImage: _stripe,\n' +
'                                        opacity: 1, pointerEvents: \'auto\', zIndex: 3, cursor: \'help\',\n' +
'                                        borderLeft: \'1px solid \' + (isDark ? \'#666\' : \'#aaa\'),\n' +
'                                        borderRight: \'1px solid \' + (isDark ? \'#666\' : \'#aaa\')\n' +
'                                    }} title={\'\\uD83D\\uDEB6 Vor dem Einschlafen ausser Bett: \' + fmtTime(ev.start) + \' \\u2013 \' + fmtTime(ev.end) + \' (\' + _dur + \' Min)\'} />\n' +
'                                );\n' +
'                            })}\n';
    s = s.replace(A2, REND + A2);
    return s;
});

console.log('\nFERTIG: Frontend-Patch (tile_build + tile_client + HealthTab)');
