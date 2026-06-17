/**
 * _patch_bedentry_319.js  — v0.33.319
 *
 * Fix 1 (OC-BED-SYNC): bedEntryTs nach allBedEntrySources-Berechnung auf Gewinner-Quelle
 *   synchronisieren. Behebt: Marc zeigt 20:00 obwohl ✓-Quelle 21:42 ist.
 *   Zwei Stellen: computePersonSleep (innere IIFE) + OC-BED-SOURCES P2 (globaler Loop).
 *
 * Fix 2 (OC-BED-FP2-GUARD): Globale FP2-Quellen nur in allBedEntrySources einfügen wenn
 *   die Person KEINE eigenen Non-FP2-Quellen hat (z.B. vib_refined). Behebt: Julia bekommt
 *   Marc's Radar-Timestamps (fp2=21:42, fp2_vib=21:52) obwohl sie keinen Radar hat.
 *
 * Fix 3 (OC-BED-VIB-MIN): VIB-IIFE braucht Session mit ≥5 Min Gesamtdauer statt bloß
 *   "zwei aufeinanderfolgende Events ≤5 Min". Filtert kurze Zufalls-Kontakte (Wäsche
 *   aufs Bett legen, Sensor-Blitzer etc.) als bedEntryTs-Kandidaten heraus.
 */

'use strict';
const fs = require('fs');
const path = require('path');

function replaceOne(content, oldStr, newStr, label) {
    const idx = content.indexOf(oldStr);
    if (idx < 0) { console.error('[FEHLER] ' + label + ': Marker nicht gefunden!'); process.exit(1); }
    const idx2 = content.indexOf(oldStr, idx + 1);
    if (idx2 >= 0) { console.error('[FEHLER] ' + label + ': Marker NICHT eindeutig!'); process.exit(1); }
    console.log('[OK] ' + label);
    return content.slice(0, idx) + newStr + content.slice(idx + oldStr.length);
}

const srcPath = path.join(__dirname, '..', 'src', 'main.js');
let src = fs.readFileSync(srcPath, 'utf8');

// ── Fix 3: VIB-IIFE — Session ≥5 Min statt Paar ≤5 Min ──────────────────────
const FIX3_OLD = `        for (var _bi = 0; _bi < _vib.length - 1; _bi++) {
            if ((_vib[_bi + 1].timestamp || 0) - (_vib[_bi].timestamp || 0) <= 5 * 60000)
                return _vib[_bi].timestamp || 0;
        }`;

const FIX3_NEW = `        // [OC-BED-VIB-MIN] VIB-Session ≥5 Min Gesamtdauer — filtert kurze Zufalls-Kontakte
        // (Wäsche aufs Bett legen, kurze Berührung etc.). Session-Grenze = Lücke ≥20 Min.
        // Gibt Start der ERSTEN Session zurück die ≥5 Min dauert.
        var _vibLastValSess = null;
        var _vibSessS = null;
        for (var _bi = 0; _bi < _vib.length; _bi++) {
            if (_vibSessS === null) _vibSessS = _vib[_bi].timestamp || 0;
            var _vibNextTs = (_bi < _vib.length - 1) ? (_vib[_bi + 1].timestamp || 0) : null;
            var _vibGapMs = _vibNextTs !== null ? (_vibNextTs - (_vib[_bi].timestamp || 0)) : Infinity;
            if (_vibGapMs >= 20 * 60000 || _vibNextTs === null) {
                // Session-Ende: prüfe Mindest-Dauer ≥5 Min
                if ((_vib[_bi].timestamp || 0) - _vibSessS >= 5 * 60000) {
                    _vibLastValSess = _vibSessS;
                    break; // erste gültige Session gefunden → fertig
                }
                _vibSessS = null; // zu kurz → weitersuchen
            }
        }
        if (_vibLastValSess !== null) return _vibLastValSess;`;

src = replaceOne(src, FIX3_OLD, FIX3_NEW, 'Fix 3 – VIB-IIFE Mindest-Session-Dauer');

// ── Fix 1a: OC-BED-SYNC in computePersonSleep (nach allBedEntrySources IIFE) ───
const FIX1A_OLD = `        _allBedEntrySourcesInner = _beSrcs
            .sort(function(a,b){ return (a.ts||0)-(b.ts||0); })
            .map(function(s){ return { source: s.source, ts: s.ts }; });
    })();

    return {`;

const FIX1A_NEW = `        _allBedEntrySourcesInner = _beSrcs
            .sort(function(a,b){ return (a.ts||0)-(b.ts||0); })
            .map(function(s){ return { source: s.source, ts: s.ts }; });
    })();

    // [OC-BED-SYNC] bedEntryTs mit Gewinner-Quelle synchronisieren.
    // Stellt sicher dass der angezeigte Wert exakt dem ✓-Eintrag in allBedEntrySources entspricht.
    // OC-48c hat bereits mit dem IIFE-Wert (früher Anker) gearbeitet — das bleibt korrekt.
    // Nur die angezeigte Zeit wird hier auf den verfeinerten Kandidaten gesetzt.
    if (_bedEntrySourceInner && _allBedEntrySourcesInner) {
        for (var _bssi = 0; _bssi < _allBedEntrySourcesInner.length; _bssi++) {
            if (_allBedEntrySourcesInner[_bssi].source === _bedEntrySourceInner && _allBedEntrySourcesInner[_bssi].ts) {
                bedEntryTs = _allBedEntrySourcesInner[_bssi].ts; break;
            }
        }
    }

    return {`;

src = replaceOne(src, FIX1A_OLD, FIX1A_NEW, 'Fix 1a – OC-BED-SYNC in computePersonSleep');

// ── Fix 2 + Fix 1b: OC-BED-SOURCES P2 — FP2-Guard + Sync ─────────────────────
// Fix 2: Nur einfügen wenn Person KEINE eigenen Non-FP2 allBedEntrySources hat.
// Fix 1b: Nach P2-Rebuild bedEntryTs erneut synchronisieren.
const FIX2_OLD = `                            if (_beSrcs2.length > 0) {
                                if (_pResult.bedEntryTs) {
                                    var _beBest2 = null, _beBestD2 = Infinity;
                                    _beSrcs2.forEach(function(s) {
                                        var _d = Math.abs((s.ts||0) - _pResult.bedEntryTs);
                                        if (_d < _beBestD2) { _beBestD2 = _d; _beBest2 = s.source; }
                                    });
                                    _pResult.bedEntrySource = _beBest2;
                                }
                                _pResult.allBedEntrySources = _beSrcs2
                                    .sort(function(a, b) { return (a.ts||0) - (b.ts||0); })
                                    .map(function(s) { return { source: s.source, ts: s.ts }; });
                            }
                            _self.log.debug('[OC-BED-SOURCES] ' + person + ': fp2-Quellen aus globalem Array nachgefuellt');`;

const FIX2_NEW = `                            // [OC-BED-FP2-GUARD] Fix 2: Globale fp2-Quellen nur einfügen wenn Person
                            // KEINE eigenen Non-FP2-Quellen in allBedEntrySources hat.
                            // Verhindert: Personen ohne Radar (z.B. Julia) bekommen fremde FP2-Timestamps.
                            var _ownBeSrcs = _pResult.allBedEntrySources || [];
                            var _hasOwnNonFp2 = _ownBeSrcs.some(function(s) {
                                return s.source !== 'fp2' && s.source !== 'fp2_vib' && s.source !== 'fp2_other';
                            });
                            var _fp2Srcs2 = _beSrcs2.filter(function(s) {
                                return s.source === 'fp2' || s.source === 'fp2_vib' || s.source === 'fp2_other';
                            });
                            var _nonFp2Srcs2 = _beSrcs2.filter(function(s) {
                                return s.source !== 'fp2' && s.source !== 'fp2_vib' && s.source !== 'fp2_other';
                            });
                            // Merged: immer Non-FP2, FP2 nur wenn keine eigenen Non-FP2 vorhanden
                            var _mergedSrcs2 = _hasOwnNonFp2
                                ? _ownBeSrcs.concat(_nonFp2Srcs2.filter(function(s) {
                                    return !_ownBeSrcs.some(function(o){ return o.source===s.source; });
                                  }))
                                : _beSrcs2;
                            if (_mergedSrcs2.length > 0) {
                                var _mergedFinal = _mergedSrcs2
                                    .sort(function(a, b) { return (a.ts||0) - (b.ts||0); })
                                    .map(function(s) { return { source: s.source, ts: s.ts }; });
                                _pResult.allBedEntrySources = _mergedFinal;
                                // [OC-BED-SYNC P2] bedEntrySource + bedEntryTs auf besten Kandidaten setzen
                                var _beBest2 = null, _beBestD2 = Infinity;
                                var _beRef2 = _pResult.bedEntryTs || (_pResult.sleepWindowStart) || 0;
                                _mergedFinal.forEach(function(s) {
                                    var _d = Math.abs((s.ts||0) - _beRef2);
                                    if (_d < _beBestD2) { _beBestD2 = _d; _beBest2 = s.source; }
                                });
                                if (_beBest2) {
                                    _pResult.bedEntrySource = _beBest2;
                                    // Sync: bedEntryTs auf Gewinner-Timestamp setzen
                                    var _syncSrc2 = _mergedFinal.find(function(s){ return s.source===_beBest2; });
                                    if (_syncSrc2 && _syncSrc2.ts) _pResult.bedEntryTs = _syncSrc2.ts;
                                }
                            }
                            _self.log.debug('[OC-BED-SOURCES] ' + person + ': fp2-Quellen aus globalem Array nachgefuellt (FP2-Guard: hasOwnNonFp2=' + _hasOwnNonFp2 + ')');`;

src = replaceOne(src, FIX2_OLD, FIX2_NEW, 'Fix 2 + Fix 1b – OC-BED-FP2-GUARD + SYNC P2');

fs.writeFileSync(srcPath, src, 'utf8');
console.log('[OK] src/main.js geschrieben.');
console.log('\n✓ Alle 3 Fixes angewendet (v0.33.319).');
