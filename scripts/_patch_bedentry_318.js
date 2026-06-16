/**
 * _patch_bedentry_318.js  — v0.33.318
 *
 * Fix A: OC-BED-FP2-MIN — FP2-Mindestpräsenz ≥2 Min in bedEntryTs IIFE
 *   Kurzflackern (z.B. 52-Sek-FP2-Trigger um 19:54) wird nicht mehr als
 *   "Ins Bett gegangen" akzeptiert. Erst wenn FP2 ≥2 Min kontinuierlich
 *   aktiv ist, gilt das als gültiger Bett-Eintrag.
 *
 * Fix B: OC-BED-SOURCES-CUTOFF — allBedEntrySources nach sleepWindowStart ausfiltern
 *   Kandidaten die NACH dem Einschlafen liegen können nicht "Ins Bett gegangen"
 *   sein. Backend (2 Stellen) + Frontend (HealthTab) werden bereinigt.
 */

'use strict';
const fs = require('fs');
const path = require('path');

function replaceOne(content, oldStr, newStr, label) {
    const idx = content.indexOf(oldStr);
    if (idx < 0) { console.error('[FEHLER] ' + label + ': Marker nicht gefunden!'); process.exit(1); }
    const idx2 = content.indexOf(oldStr, idx + 1);
    if (idx2 >= 0) { console.error('[FEHLER] ' + label + ': Marker ist NICHT eindeutig (mehrfach gefunden)!'); process.exit(1); }
    console.log('[OK] ' + label);
    return content.slice(0, idx) + newStr + content.slice(idx + oldStr.length);
}

// ─── src/main.js ───────────────────────────────────────────────────────────
const srcPath = path.join(__dirname, '..', 'src', 'main.js');
let src = fs.readFileSync(srcPath, 'utf8');

// ── Fix A: bedEntryTs IIFE — FP2-Mindestpräsenz ≥2 Min ──────────────────
const FIX_A_OLD = `    var bedEntryTs = (function() {
        var _fp2 = bedEvts.filter(function(e) {
            var _hr = new Date(e.timestamp || 0).getHours();
            return e.isFP2Bed && (_hr >= 18 || _hr < 3);
        });
        if (_fp2.length > 0) return _fp2[0].timestamp || 0;`;

const FIX_A_NEW = `    var bedEntryTs = (function() {
        var _fp2 = bedEvts.filter(function(e) {
            var _hr = new Date(e.timestamp || 0).getHours();
            return e.isFP2Bed && (_hr >= 18 || _hr < 3);
        });
        // [OC-BED-FP2-MIN] FP2-Mindestpräsenz ≥2 Min — verhindert Kurzflackern als bedEntryTs.
        // Beispiel: FP2 flackert 52 Sek um 19:54 → kein gültiger Bett-Eintrag.
        // Erst wenn FP2 durchgehend ≥2 Min aktiv ist → gültiges Segment.
        var _fp2SegTs = null;
        for (var _fi = 0; _fi < _fp2.length; _fi++) {
            var _fActive = isActiveValue(_fp2[_fi].value);
            if (!_fActive) { _fp2SegTs = null; continue; }
            var _fts = _fp2[_fi].timestamp || 0;
            if (_fp2SegTs === null) _fp2SegTs = _fts; // Segment-Start
            // Nächstes val=0 suchen → Segment-Ende
            var _fEnd = null;
            for (var _fj = _fi + 1; _fj < _fp2.length; _fj++) {
                if (!isActiveValue(_fp2[_fj].value)) { _fEnd = _fp2[_fj].timestamp || 0; break; }
            }
            if (_fEnd !== null) {
                if (_fEnd - _fp2SegTs >= 2 * 60000) return _fp2SegTs; // ≥2 Min → gültig
                _fp2SegTs = null; // zu kurz → Segment verwerfen, weitersuchen
            } else {
                return _fp2SegTs; // kein Ende gefunden → läuft noch → gültig
            }
        }
        // Kein gültiges FP2-Segment → Vibrations-Fallback unten`;

src = replaceOne(src, FIX_A_OLD, FIX_A_NEW, 'Fix A – bedEntryTs FP2-Mindestpräsenz');

// ── Fix B1: _beSrcs in computePersonSleep — nach sleepStart ausfiltern ────
const FIX_B1_OLD = `        var _beExcl = ['garmin', 'fixed', 'haus_still', 'gap60', 'last_outside'];
        var _beSrcs = (allSleepStartSources || []).filter(function(s) {
            if (!s.ts || _beExcl.indexOf(s.source) >= 0) return false;
            // [Fix-3] vib_refined: nur gültig wenn Radar/FP2 innerhalb ±10 Min bestätigt.
            // Verhindert kurze Radar-Blitzer (Sekunden) + Vibration = falsche frühe Bett-Eintrag-Zeit.
            if (s.source === 'vib_refined') {
                var _vrTs = s.ts;
                var _vrOk = allEvents.some(function(e) {
                    return isMine(e) && e.isFP2Bed && isActiveValue(e.value)
                        && Math.abs((e.timestamp||0) - _vrTs) <= 10 * 60 * 1000;
                });
                if (!_vrOk) return false;
            }
            return true;
        });`;

const FIX_B1_NEW = `        var _beExcl = ['garmin', 'fixed', 'haus_still', 'gap60', 'last_outside'];
        var _beSrcs = (allSleepStartSources || []).filter(function(s) {
            if (!s.ts || _beExcl.indexOf(s.source) >= 0) return false;
            // [OC-BED-SOURCES-CUTOFF] Quellen NACH sleepStart sind keine Bett-Eintrag-Kandidaten
            if (sleepStart && s.ts > sleepStart) return false;
            // [Fix-3] vib_refined: nur gültig wenn Radar/FP2 innerhalb ±10 Min bestätigt.
            // Verhindert kurze Radar-Blitzer (Sekunden) + Vibration = falsche frühe Bett-Eintrag-Zeit.
            if (s.source === 'vib_refined') {
                var _vrTs = s.ts;
                var _vrOk = allEvents.some(function(e) {
                    return isMine(e) && e.isFP2Bed && isActiveValue(e.value)
                        && Math.abs((e.timestamp||0) - _vrTs) <= 10 * 60 * 1000;
                });
                if (!_vrOk) return false;
            }
            return true;
        });`;

src = replaceOne(src, FIX_B1_OLD, FIX_B1_NEW, 'Fix B1 – _beSrcs sleepStart-Cutoff (computePersonSleep)');

// ── Fix B2: _beSrcs2 in OC-BED-SOURCES P2 (fp2-Fallback) — nach sleepStart ausfiltern ──
const FIX_B2_OLD = `                            var _beExcl2 = ['garmin', 'fixed', 'haus_still', 'gap60', 'last_outside'];
                            var _beSrcs2 = _pSrc.filter(function(s) { return !!s.ts && _beExcl2.indexOf(s.source) < 0; });`;

const FIX_B2_NEW = `                            var _beExcl2 = ['garmin', 'fixed', 'haus_still', 'gap60', 'last_outside'];
                            var _beSrcs2 = _pSrc.filter(function(s) {
                                if (!s.ts || _beExcl2.indexOf(s.source) >= 0) return false;
                                // [OC-BED-SOURCES-CUTOFF] Quellen NACH sleepStart sind keine Bett-Eintrag-Kandidaten
                                if (_pResult.sleepWindowStart && s.ts > _pResult.sleepWindowStart) return false;
                                return true;
                            });`;

src = replaceOne(src, FIX_B2_OLD, FIX_B2_NEW, 'Fix B2 – _beSrcs2 sleepStart-Cutoff (OC-BED-SOURCES P2)');

fs.writeFileSync(srcPath, src, 'utf8');
console.log('[OK] src/main.js geschrieben.');

// ─── HealthTab.tsx ──────────────────────────────────────────────────────────
const htPath = path.join(__dirname, '..', 'src-admin', 'src', 'components', 'tabs', 'HealthTab.tsx');
let ht = fs.readFileSync(htPath, 'utf8');

// ── Fix B3: allBedEntrySourcesArr Frontend-Filter — nach swStart ausfiltern ──
const FIX_B3_OLD = `        const allBedEntrySourcesArr: {source:string, ts:number|null}[] = _allBedEntryRaw.filter(bs => {
            if (!bs.ts) return false; // ohne Timestamp nicht sinnvoll
            const _ref = _bedEntryRaw ?? swStart; // Referenz: bedEntryTs oder Einschlafzeit
            if (!_ref) return true;
            return bs.ts >= (_ref - 3 * 3600000); // nur Quellen max. 3h vor Referenz
        });`;

const FIX_B3_NEW = `        const allBedEntrySourcesArr: {source:string, ts:number|null}[] = _allBedEntryRaw.filter(bs => {
            if (!bs.ts) return false; // ohne Timestamp nicht sinnvoll
            // [OC-BED-SOURCES-CUTOFF] Quellen nach Einschlafzeit können kein Bett-Eintrag sein
            if (swStart && bs.ts > swStart) return false;
            const _ref = _bedEntryRaw ?? swStart; // Referenz: bedEntryTs oder Einschlafzeit
            if (!_ref) return true;
            return bs.ts >= (_ref - 3 * 3600000); // nur Quellen max. 3h vor Referenz
        });`;

ht = replaceOne(ht, FIX_B3_OLD, FIX_B3_NEW, 'Fix B3 – allBedEntrySourcesArr swStart-Cutoff (HealthTab)');

fs.writeFileSync(htPath, ht, 'utf8');
console.log('[OK] HealthTab.tsx geschrieben.');

console.log('\n✓ Alle Patches erfolgreich angewendet (v0.33.318).');
