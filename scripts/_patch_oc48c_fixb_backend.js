/**
 * PATCH: OC-48c v2 / OC-56 Stufe 2 — "Fix B" (bedEntryTs never-null + FP2-aware + preSleepAbsence)
 *
 * Problem (Mehrpersonenhaushalt, Nacht 15./16.06.2026):
 *   OC-48c verwirft bedEntryTs (-> null) wenn zwischen Ins-Bett-Zeit und Einschlafen
 *   ein >=30-Min-Block mit Aktivitaet ausserhalb des Schlafzimmers liegt. In einem Haushalt
 *   mit weiterer Person (Anni laeuft durchs Wohnzimmer) sind das ungetaggte PIR-Events ->
 *   bedEntryTs wird faelschlich als ungueltig verworfen ("kein plausibler Wert").
 *
 * Loesung (Fix B):
 *   1) bedEntryTs wird NIE mehr auf null gesetzt (kein Phantom-Verlust).
 *   2) FP2-bewusste Entscheidung ueber den laengsten Aussen-Block:
 *      - FP2 zeigt das Bett waehrend des Blocks DURCHGEHEND belegt -> andere Person aktiv ->
 *        bedEntryTs behalten, KEINE Abwesenheit markieren (Person lag nachweislich im Bett).
 *      - FP2 leer ODER kein FP2 -> Person war wirklich draussen -> bedEntryTs behalten und
 *        den Block als Vor-Schlaf-Abwesenheit (preSleepAbsenceEvents) markieren.
 *   3) preSleepAbsenceEvents wird im per-Person-Result, in result[person] und im globalen
 *      Snapshot ausgegeben (Frontend rendert es als schraffierte Abwesenheit statt Phantom-Wachliegen).
 *
 * Betrifft BEIDE OC-48c-Implementierungen: per-Person (computePersonSleep) + global (saveDailyHistory).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src', 'main.js');
let src = fs.readFileSync(SRC, 'utf8');

function must(cond, label) { if (!cond) { console.error('FEHLER: ' + label); process.exit(1); } }
function replaceOne(oldStr, newStr, label) {
    must(src.includes(oldStr), label + ' (Anker nicht gefunden)');
    must(src.split(oldStr).length === 2, label + ' (Anker nicht eindeutig)');
    src = src.replace(oldStr, newStr);
    console.log('OK ' + label);
}
function replaceBlock(startAnchor, endAnchor, newText, label) {
    const si = src.indexOf(startAnchor);
    must(si >= 0, label + ' (startAnchor nicht gefunden)');
    const ei = src.indexOf(endAnchor, si);
    must(ei >= 0, label + ' (endAnchor nicht gefunden)');
    src = src.slice(0, si) + newText + src.slice(ei);
    console.log('OK ' + label);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) PER-PERSON: _preSleepAbsence Deklaration vor dem OC-48c-Guard
// ─────────────────────────────────────────────────────────────────────────────
replaceOne(
    '    if (bedEntryTs && sleepStart && bedEntryTs < sleepStart) {',
    '    var _preSleepAbsence = [];\n    if (bedEntryTs && sleepStart && bedEntryTs < sleepStart) {',
    'per-person: _preSleepAbsence Deklaration'
);

// ─────────────────────────────────────────────────────────────────────────────
// 2) PER-PERSON: Scan-Loop um laengsten Block-Fenster erweitern
// ─────────────────────────────────────────────────────────────────────────────
replaceOne(
    '        var _oc48cMax = 0, _oc48cBs = null, _oc48cBe = null;\n' +
    '        for (var _oc48ci = 0; _oc48ci < _oc48cFar.length; _oc48ci++) {\n' +
    '            var _ets = _oc48cFar[_oc48ci].timestamp || 0;\n' +
    '            if (_oc48cBs === null) { _oc48cBs = _ets; _oc48cBe = _ets; }\n' +
    '            else if (_ets - _oc48cBe <= 12 * 60000) { _oc48cBe = _ets; }\n' +
    '            else { if (_oc48cBe - _oc48cBs > _oc48cMax) _oc48cMax = _oc48cBe - _oc48cBs; _oc48cBs = _ets; _oc48cBe = _ets; }\n' +
    '        }\n' +
    '        if (_oc48cBs !== null && (_oc48cBe - _oc48cBs) > _oc48cMax) _oc48cMax = _oc48cBe - _oc48cBs;',
    '        var _oc48cMax = 0, _oc48cBs = null, _oc48cBe = null, _oc48cMaxBs = null, _oc48cMaxBe = null;\n' +
    '        for (var _oc48ci = 0; _oc48ci < _oc48cFar.length; _oc48ci++) {\n' +
    '            var _ets = _oc48cFar[_oc48ci].timestamp || 0;\n' +
    '            if (_oc48cBs === null) { _oc48cBs = _ets; _oc48cBe = _ets; }\n' +
    '            else if (_ets - _oc48cBe <= 12 * 60000) { _oc48cBe = _ets; }\n' +
    '            else { if (_oc48cBe - _oc48cBs > _oc48cMax) { _oc48cMax = _oc48cBe - _oc48cBs; _oc48cMaxBs = _oc48cBs; _oc48cMaxBe = _oc48cBe; } _oc48cBs = _ets; _oc48cBe = _ets; }\n' +
    '        }\n' +
    '        if (_oc48cBs !== null && (_oc48cBe - _oc48cBs) > _oc48cMax) { _oc48cMax = _oc48cBe - _oc48cBs; _oc48cMaxBs = _oc48cBs; _oc48cMaxBe = _oc48cBe; }',
    'per-person: Scan-Loop Block-Fenster-Tracking'
);

// ─────────────────────────────────────────────────────────────────────────────
// 3) PER-PERSON: OC-48c if-Block ersetzen (never-null + FP2-aware + preSleepAbsence)
// ─────────────────────────────────────────────────────────────────────────────
const PP_NEW =
'        if (_oc48cMax >= 30 * 60000) {\n' +
'            // [OC-48c v2 / OC-56 Fix B] bedEntryTs wird NICHT mehr verworfen (kein null mehr).\n' +
'            // FP2-bewusste Entscheidung ueber den laengsten Aussen-Block:\n' +
'            //  (1) FP2 zeigt das Bett DURCHGEHEND belegt -> andere Person aktiv -> bedEntryTs behalten, keine Abwesenheit.\n' +
'            //  (2) FP2 leer ODER kein FP2 -> Person war draussen -> bedEntryTs behalten + Block als preSleepAbsence markieren.\n' +
'            var _psaFp2Occ = (function(_t0, _t1) {\n' +
'                if (_t0 == null || _t1 == null) return null;\n' +
'                var _f = allEvents.filter(function(e) { return isMine(e) && e.isFP2Bed; })\n' +
'                    .sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });\n' +
'                if (_f.length === 0) return null;\n' +
'                var _st = false, _seen = false;\n' +
'                for (var _fi = 0; _fi < _f.length; _fi++) {\n' +
'                    var _fts = _f[_fi].timestamp || 0;\n' +
'                    if (_fts <= _t0) { _st = isActiveValue(_f[_fi].value); _seen = true; } else break;\n' +
'                }\n' +
'                if (!_seen) return null;\n' +
'                if (!_st) return false;\n' +
'                for (var _fj = 0; _fj < _f.length; _fj++) {\n' +
'                    var _fts2 = _f[_fj].timestamp || 0;\n' +
'                    if (_fts2 > _t0 && _fts2 <= _t1 && !isActiveValue(_f[_fj].value)) return false;\n' +
'                }\n' +
'                return true;\n' +
'            })(_oc48cMaxBs, _oc48cMaxBe);\n' +
'            if (_psaFp2Occ === true) {\n' +
'                if (log) log.info(logPfx + \'[OC-48c v2] Aussen-Aktivitaet (Block \' + Math.round(_oc48cMax / 60000) + \' Min) bei FP2-belegtem Bett -> andere Person, bedEntryTs \' + new Date(bedEntryTs).toLocaleTimeString() + \' behalten\');\n' +
'            } else if (_oc48cMaxBs != null && _oc48cMaxBe != null) {\n' +
'                _preSleepAbsence.push({ start: _oc48cMaxBs, end: _oc48cMaxBe, durationMin: Math.max(1, Math.round((_oc48cMaxBe - _oc48cMaxBs) / 60000)), source: (_psaFp2Occ === false) ? \'fp2_empty\' : \'pir_far\' });\n' +
'                if (log) log.info(logPfx + \'[OC-48c v2] Vor-Schlaf-Abwesenheit \' + new Date(_oc48cMaxBs).toLocaleTimeString() + \'-\' + new Date(_oc48cMaxBe).toLocaleTimeString() + \' markiert; bedEntryTs \' + new Date(bedEntryTs).toLocaleTimeString() + \' behalten\');\n' +
'            }\n' +
'        }\n' +
'    }';
replaceBlock(
    '        if (_oc48cMax >= 30 * 60000) {',
    '\n\n    var p4amTs = ',
    PP_NEW,
    'per-person: OC-48c if-Block (Fix B)'
);

// ─────────────────────────────────────────────────────────────────────────────
// 4) PER-PERSON: preSleepAbsenceEvents im Return-Objekt
// ─────────────────────────────────────────────────────────────────────────────
replaceOne(
    '        bedEntryTs:          bedEntryTs,\n        bedEntrySource:      _bedEntrySourceInner || null,',
    '        bedEntryTs:          bedEntryTs,\n        preSleepAbsenceEvents: _preSleepAbsence,\n        bedEntrySource:      _bedEntrySourceInner || null,',
    'per-person: Return preSleepAbsenceEvents'
);

// ─────────────────────────────────────────────────────────────────────────────
// 5) result[person]: preSleepAbsenceEvents durchreichen
// ─────────────────────────────────────────────────────────────────────────────
replaceOne(
    '                        bedEntryTs:                _pResult.bedEntryTs || null,',
    '                        bedEntryTs:                _pResult.bedEntryTs || null,\n                        preSleepAbsenceEvents:     _pResult.preSleepAbsenceEvents || [],',
    'result[person]: preSleepAbsenceEvents'
);

// ─────────────────────────────────────────────────────────────────────────────
// 6) GLOBAL: _preSleepAbsenceGlobal Deklaration (immer ausgefuehrt)
// ─────────────────────────────────────────────────────────────────────────────
replaceOne(
    '            var _oc48BedLocs = (this.config.devices || [])',
    '            var _preSleepAbsenceGlobal = [];\n            var _oc48BedLocs = (this.config.devices || [])',
    'global: _preSleepAbsenceGlobal Deklaration'
);

// ─────────────────────────────────────────────────────────────────────────────
// 7) GLOBAL: Scan-Loop um laengsten Block-Fenster erweitern
// ─────────────────────────────────────────────────────────────────────────────
replaceOne(
    '                var _oc48cMaxBlock = 0; var _oc48cBlkStart = null; var _oc48cBlkEnd = null;\n' +
    '                for (var _oc48ci = 0; _oc48ci < _oc48cFar.length; _oc48ci++) {\n' +
    '                    var _ets = _oc48cFar[_oc48ci].timestamp || 0;\n' +
    '                    if (_oc48cBlkStart === null) { _oc48cBlkStart = _ets; _oc48cBlkEnd = _ets; }\n' +
    '                    else if (_ets - _oc48cBlkEnd <= 12 * 60000) { _oc48cBlkEnd = _ets; }\n' +
    '                    else { if (_oc48cBlkEnd - _oc48cBlkStart > _oc48cMaxBlock) _oc48cMaxBlock = _oc48cBlkEnd - _oc48cBlkStart; _oc48cBlkStart = _ets; _oc48cBlkEnd = _ets; }\n' +
    '                }\n' +
    '                if (_oc48cBlkStart !== null && (_oc48cBlkEnd - _oc48cBlkStart) > _oc48cMaxBlock) _oc48cMaxBlock = _oc48cBlkEnd - _oc48cBlkStart;',
    '                var _oc48cMaxBlock = 0; var _oc48cBlkStart = null; var _oc48cBlkEnd = null; var _oc48cMaxBlkStart = null; var _oc48cMaxBlkEnd = null;\n' +
    '                for (var _oc48ci = 0; _oc48ci < _oc48cFar.length; _oc48ci++) {\n' +
    '                    var _ets = _oc48cFar[_oc48ci].timestamp || 0;\n' +
    '                    if (_oc48cBlkStart === null) { _oc48cBlkStart = _ets; _oc48cBlkEnd = _ets; }\n' +
    '                    else if (_ets - _oc48cBlkEnd <= 12 * 60000) { _oc48cBlkEnd = _ets; }\n' +
    '                    else { if (_oc48cBlkEnd - _oc48cBlkStart > _oc48cMaxBlock) { _oc48cMaxBlock = _oc48cBlkEnd - _oc48cBlkStart; _oc48cMaxBlkStart = _oc48cBlkStart; _oc48cMaxBlkEnd = _oc48cBlkEnd; } _oc48cBlkStart = _ets; _oc48cBlkEnd = _ets; }\n' +
    '                }\n' +
    '                if (_oc48cBlkStart !== null && (_oc48cBlkEnd - _oc48cBlkStart) > _oc48cMaxBlock) { _oc48cMaxBlock = _oc48cBlkEnd - _oc48cBlkStart; _oc48cMaxBlkStart = _oc48cBlkStart; _oc48cMaxBlkEnd = _oc48cBlkEnd; }',
    'global: Scan-Loop Block-Fenster-Tracking'
);

// ─────────────────────────────────────────────────────────────────────────────
// 8) GLOBAL: OC-48c if-Block ersetzen (never-null + FP2-aware + preSleepAbsence)
// ─────────────────────────────────────────────────────────────────────────────
const GL_NEW =
'                if (_oc48cMaxBlock >= 30 * 60000) {\n' +
'                    // [OC-48c v2 / OC-56 Fix B] _bedEntryTsFinal wird NICHT mehr verworfen.\n' +
'                    var _psaFp2OccG = (function(_t0, _t1) {\n' +
'                        if (_t0 == null || _t1 == null) return null;\n' +
'                        var _f = sleepSearchEvents.filter(function(e) { return e.isFP2Bed; })\n' +
'                            .sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });\n' +
'                        if (_f.length === 0) return null;\n' +
'                        var _st = false, _seen = false;\n' +
'                        for (var _fi = 0; _fi < _f.length; _fi++) {\n' +
'                            var _fts = _f[_fi].timestamp || 0;\n' +
'                            if (_fts <= _t0) { _st = isActiveValue(_f[_fi].value); _seen = true; } else break;\n' +
'                        }\n' +
'                        if (!_seen) return null;\n' +
'                        if (!_st) return false;\n' +
'                        for (var _fj = 0; _fj < _f.length; _fj++) {\n' +
'                            var _fts2 = _f[_fj].timestamp || 0;\n' +
'                            if (_fts2 > _t0 && _fts2 <= _t1 && !isActiveValue(_f[_fj].value)) return false;\n' +
'                        }\n' +
'                        return true;\n' +
'                    })(_oc48cMaxBlkStart, _oc48cMaxBlkEnd);\n' +
'                    if (_psaFp2OccG === true) {\n' +
'                        if (_oc48Log) _oc48Log[\'info\'](\'[OC-48c v2] Aussen-Aktivitaet (Block \' + Math.round(_oc48cMaxBlock / 60000) + \' Min) bei FP2-belegtem Bett -> andere Person, bedEntryTs \' + new Date(_bedEntryTsFinal).toLocaleTimeString() + \' behalten\');\n' +
'                    } else if (_oc48cMaxBlkStart != null && _oc48cMaxBlkEnd != null) {\n' +
'                        _preSleepAbsenceGlobal.push({ start: _oc48cMaxBlkStart, end: _oc48cMaxBlkEnd, durationMin: Math.max(1, Math.round((_oc48cMaxBlkEnd - _oc48cMaxBlkStart) / 60000)), source: (_psaFp2OccG === false) ? \'fp2_empty\' : \'pir_far\' });\n' +
'                        if (_oc48Log) _oc48Log[\'info\'](\'[OC-48c v2] Vor-Schlaf-Abwesenheit \' + new Date(_oc48cMaxBlkStart).toLocaleTimeString() + \'-\' + new Date(_oc48cMaxBlkEnd).toLocaleTimeString() + \' markiert; bedEntryTs \' + new Date(_bedEntryTsFinal).toLocaleTimeString() + \' behalten\');\n' +
'                    }\n' +
'                }\n' +
'            }';
replaceBlock(
    '                if (_oc48cMaxBlock >= 30 * 60000) {',
    '\n            // [OC-45d] Shared SM-Context',
    GL_NEW,
    'global: OC-48c if-Block (Fix B)'
);

// ─────────────────────────────────────────────────────────────────────────────
// 9) GLOBAL Snapshot: preSleepAbsenceEvents ausgeben
// ─────────────────────────────────────────────────────────────────────────────
replaceOne(
    '                bedEntryTs: (function() {',
    '                preSleepAbsenceEvents: (typeof _preSleepAbsenceGlobal !== \'undefined\' ? _preSleepAbsenceGlobal : []),\n                bedEntryTs: (function() {',
    'global Snapshot: preSleepAbsenceEvents'
);

fs.writeFileSync(SRC, src, 'utf8');
console.log('\nFERTIG: src/main.js gepatcht (OC-48c v2 / Fix B Backend)');
