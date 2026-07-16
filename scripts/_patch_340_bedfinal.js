// v0.33.340 OC-BED-FINAL: Fuehrende Vor-Schlaf-Abwesenheit abschneiden (Fehlstart-Erkennung).
// 5-Min-Schwelle; bedEntryTs rueckt auf naechstes echtes Bett-Signal nach der Abwesenheit.
// A) Per-Person (vor OC-PSA-CLAMP-Block). B) Globaler/Einpersonen-Pfad (OC-48c v2 else-if).
const fs = require('fs');
const path = 'src/main.js';
let raw = fs.readFileSync(path, 'utf8');

if (raw.indexOf('[OC-BED-FINAL]') >= 0) { console.log('Bereits gepatcht (OC-BED-FINAL).'); process.exit(0); }

// ---------- A) Per-Person ----------
const A_ANCHOR = "                    // [OC-PSA-CLAMP] Vor-Schlaf-Abwesenheit gegen FINALES bedEntryTs klemmen.";
const A_BLOCK = [
    "                    // [OC-BED-FINAL] Fuehrende Vor-Schlaf-Abwesenheit abschneiden (Fehlstart-Erkennung).",
    "                    // Wenn eine Abwesenheit praktisch gleichzeitig mit dem Bett-Betreten beginnt (< 5 Min",
    "                    // echte Im-Bett-Zeit davor), war 'Ins Bett gegangen' ein Fehlstart (kurzer Matratzen-",
    "                    // kontakt, dann sofort wieder raus). bedEntryTs rueckt auf die naechste echte Bett-Quelle",
    "                    // NACH der Abwesenheit (Fallback: Abwesenheits-Ende); die fuehrende Abwesenheit wird",
    "                    // verworfen. Mittige Abwesenheiten (echte Im-Bett-Zeit davor) bleiben. Regel 16.7.: 5 Min.",
    "                    if (_pResult.bedEntryTs && Array.isArray(_pResult.preSleepAbsenceEvents) && _pResult.preSleepAbsenceEvents.length) {",
    "                        var _bfLeadTolMs = 5 * 60000;",
    "                        var _bfSrcs = Array.isArray(_pResult.allBedEntrySources) ? _pResult.allBedEntrySources : [];",
    "                        _pResult.preSleepAbsenceEvents.sort(function(a, b){ return (a.start||0) - (b.start||0); });",
    "                        var _bfGuard = 0;",
    "                        while (_bfGuard++ < 10 && _pResult.preSleepAbsenceEvents.length) {",
    "                            var _bfFirst = _pResult.preSleepAbsenceEvents[0];",
    "                            if (!_bfFirst || _bfFirst.start == null || _bfFirst.end == null) break;",
    "                            if (_bfFirst.start > _pResult.bedEntryTs + _bfLeadTolMs) break;",
    "                            var _bfNext = null;",
    "                            for (var _bfi = 0; _bfi < _bfSrcs.length; _bfi++) {",
    "                                var _bfTs = _bfSrcs[_bfi] && _bfSrcs[_bfi].ts;",
    "                                if (_bfTs && _bfTs >= _bfFirst.end - 60000 && (_bfNext == null || _bfTs < _bfNext)) _bfNext = _bfTs;",
    "                            }",
    "                            var _bfNewBe = (_bfNext != null) ? _bfNext : _bfFirst.end;",
    "                            if (_pResult.sleepWindowStart && _bfNewBe > _pResult.sleepWindowStart) _bfNewBe = _pResult.sleepWindowStart;",
    "                            if (_bfNewBe <= _pResult.bedEntryTs) { _pResult.preSleepAbsenceEvents.shift(); continue; }",
    "                            _self.log.info('[OC-BED-FINAL] ' + person + ': fuehrende Abwesenheit ' + new Date(_bfFirst.start).toLocaleTimeString() + '-' + new Date(_bfFirst.end).toLocaleTimeString() + ' abgeschnitten; bedEntryTs ' + new Date(_pResult.bedEntryTs).toLocaleTimeString() + ' -> ' + new Date(_bfNewBe).toLocaleTimeString());",
    "                            _pResult.bedEntryTs = _bfNewBe;",
    "                            var _bfSrcSel = null;",
    "                            for (var _bfj = 0; _bfj < _bfSrcs.length; _bfj++) { if (_bfSrcs[_bfj] && _bfSrcs[_bfj].ts === _bfNewBe) { _bfSrcSel = _bfSrcs[_bfj].source; break; } }",
    "                            if (_bfSrcSel) _pResult.bedEntrySource = _bfSrcSel;",
    "                            _pResult.preSleepAbsenceEvents.shift();",
    "                        }",
    "                    }",
    ""
].join('\r\n');

if (raw.indexOf(A_ANCHOR) < 0) { console.error('FEHLER A: OC-PSA-CLAMP Anker nicht gefunden'); process.exit(1); }
if (raw.indexOf(A_ANCHOR, raw.indexOf(A_ANCHOR) + 1) >= 0) { console.error('FEHLER A: Anker mehrdeutig'); process.exit(1); }
raw = raw.replace(A_ANCHOR, A_BLOCK + '\r\n' + A_ANCHOR);
console.log('OK: A per-person');

// ---------- B) Global / Einpersonen ----------
const B_LINES = [
    "                    } else if (_oc48cMaxBlkStart != null && _oc48cMaxBlkEnd != null) {",
    "                        _preSleepAbsenceGlobal.push({ start: _oc48cMaxBlkStart, end: _oc48cMaxBlkEnd, durationMin: Math.max(1, Math.round((_oc48cMaxBlkEnd - _oc48cMaxBlkStart) / 60000)), source: (_psaFp2OccG === false) ? 'fp2_empty' : 'pir_far' });",
    "                        if (_oc48Log) _oc48Log['info']('[OC-48c v2] Vor-Schlaf-Abwesenheit ' + new Date(_oc48cMaxBlkStart).toLocaleTimeString() + '-' + new Date(_oc48cMaxBlkEnd).toLocaleTimeString() + ' markiert; bedEntryTs ' + new Date(_bedEntryTsFinal).toLocaleTimeString() + ' behalten');",
    "                    }"
];
const B_NEW_LINES = [
    "                    } else if (_oc48cMaxBlkStart != null && _oc48cMaxBlkEnd != null) {",
    "                        // [OC-BED-FINAL] Fuehrende Abwesenheit (< 5 Min echte Im-Bett-Zeit davor) = Fehlstart:",
    "                        // bedEntryTs auf naechstes echtes Bett-Signal nach der Abwesenheit ruecken, NICHT markieren.",
    "                        if (_oc48cMaxBlkStart <= _bedEntryTsFinal + 5 * 60000) {",
    "                            var _bfNextG = null;",
    "                            for (var _bfgi = 0; _bfgi < sleepSearchEvents.length; _bfgi++) {",
    "                                var _bfge = sleepSearchEvents[_bfgi]; var _bfgt = _bfge.timestamp || 0;",
    "                                if (_bfgt < _oc48cMaxBlkEnd - 60000) continue;",
    "                                if (sleepWindowOC7.start && _bfgt >= sleepWindowOC7.start) continue;",
    "                                if (((_bfge.isFP2Bed || _bfge.isVibrationBed) && isActiveValue(_bfge.value)) && (_bfNextG == null || _bfgt < _bfNextG)) _bfNextG = _bfgt;",
    "                            }",
    "                            var _bfNewBeG = (_bfNextG != null) ? _bfNextG : _oc48cMaxBlkEnd;",
    "                            if (sleepWindowOC7.start && _bfNewBeG > sleepWindowOC7.start) _bfNewBeG = sleepWindowOC7.start;",
    "                            if (_oc48Log) _oc48Log['info']('[OC-BED-FINAL] Fuehrende Abwesenheit ' + new Date(_oc48cMaxBlkStart).toLocaleTimeString() + '-' + new Date(_oc48cMaxBlkEnd).toLocaleTimeString() + ' abgeschnitten; bedEntryTs ' + new Date(_bedEntryTsFinal).toLocaleTimeString() + ' -> ' + new Date(_bfNewBeG).toLocaleTimeString());",
    "                            if (_bfNewBeG > _bedEntryTsFinal) _bedEntryTsFinal = _bfNewBeG;",
    "                        } else {",
    "                            _preSleepAbsenceGlobal.push({ start: _oc48cMaxBlkStart, end: _oc48cMaxBlkEnd, durationMin: Math.max(1, Math.round((_oc48cMaxBlkEnd - _oc48cMaxBlkStart) / 60000)), source: (_psaFp2OccG === false) ? 'fp2_empty' : 'pir_far' });",
    "                            if (_oc48Log) _oc48Log['info']('[OC-48c v2] Vor-Schlaf-Abwesenheit ' + new Date(_oc48cMaxBlkStart).toLocaleTimeString() + '-' + new Date(_oc48cMaxBlkEnd).toLocaleTimeString() + ' markiert; bedEntryTs ' + new Date(_bedEntryTsFinal).toLocaleTimeString() + ' behalten');",
    "                        }",
    "                    }"
];

let bApplied = false;
['\r\n', '\n'].forEach(function(eol) {
    if (bApplied) return;
    const OLD = B_LINES.join(eol);
    if (raw.indexOf(OLD) >= 0) {
        raw = raw.replace(OLD, B_NEW_LINES.join(eol));
        bApplied = true;
        console.log('OK: B global (eol=' + JSON.stringify(eol) + ')');
    }
});
if (!bApplied) { console.error('FEHLER B: globaler else-if Block nicht gefunden'); process.exit(1); }

fs.writeFileSync(path, raw, 'utf8');
console.log('OC-BED-FINAL angewendet (A+B).');
