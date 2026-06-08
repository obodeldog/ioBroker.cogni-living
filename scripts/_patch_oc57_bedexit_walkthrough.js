/**
 * OC-57: bedExitTs Walk-Through-Guard
 *
 * Problem (Nacht 08.06.2026): bedExitTs=08:28 statt ~06:39. Ursache: kurzer PIR-only
 * Schlafzimmerbesuch um 08:21 (Jacke holen, KEINE Matratzen-Vibration) wird von der
 * OC-45a State-Machine als "echte Rueckkehr ins Bett" gewertet.
 *
 * Fix (nachgelagert, self-contained): bedExitTs darf nicht spaeter sein als der letzte
 * ECHTE Matratzen-Kontakt (Vibration trigger=true oder strength>=10), WENN:
 *   - ein Vibrationssensor aktiv ist (sonst kein Eingriff, graceful fuer PIR-only),
 *   - KEIN FP2/Radar eine Bett-Praesenz bestaetigt (_oc45aHasFp2 == false),
 *   - die Person zwischen letztem Bett-Kontakt und bedExitTs nachweislich AUSSERHALB
 *     des Schlafzimmers aktiv war (>=3 Motion-Events, Spanne >=20min) -> "war auf/draussen".
 * Stilles Liegen (keine Ausser-Schlafzimmer-Aktivitaet) -> kein Eingriff.
 *
 * Loest zugleich das in der OC-45-Roadmap dokumentierte "Walk-Through"-Problem
 * (Person geht nach Dusche durch Schlafzimmer -> faelschliche Rueckkehr).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'main.js');
let src = fs.readFileSync(filePath, 'utf8');
const NL = src.includes('\r\n') ? '\r\n' : '\n';
const L = s => s.split('\n').join(NL);

const ANCHOR = L(`                if (!bedExitTs && _existingSnap && _existingSnap.bedExitTs &&
                    _existingSnap.bedExitTs > _oc45aAnchor && _existingSnap.bedExitTs <= _oc45aCap) {
                    bedExitTs = _existingSnap.bedExitTs; _bedExitSrc = 'snapshot';
                }
                if (bedExitTs) this.log.info('[OC-45a] bedExitTs: ' + new Date(bedExitTs).toLocaleTimeString() + ' (' + _bedExitSrc + ')');`);

const REPLACEMENT = L(`                if (!bedExitTs && _existingSnap && _existingSnap.bedExitTs &&
                    _existingSnap.bedExitTs > _oc45aAnchor && _existingSnap.bedExitTs <= _oc45aCap) {
                    bedExitTs = _existingSnap.bedExitTs; _bedExitSrc = 'snapshot';
                }
                // [OC-57] Walk-Through-Guard: bedExitTs nicht spaeter als letzter echter Matratzen-Kontakt,
                // wenn Person danach nachweislich ausserhalb des Schlafzimmers aktiv war und kein FP2 bestaetigt.
                // Graceful: ohne Vibrationssensor ODER mit FP2 -> kein Eingriff. Stilles Liegen -> kein Eingriff.
                if (bedExitTs && !_oc45aHasFp2) {
                    var _oc57VibTs = [];
                    for (var _o57i = 0; _o57i < _oc49VibTrigs.length; _o57i++) _oc57VibTs.push(_oc49VibTrigs[_o57i].timestamp || 0);
                    for (var _o57s = 0; _o57s < _oc49VibStrs.length; _o57s++) { if ((Number(_oc49VibStrs[_o57s].value) || 0) >= 10) _oc57VibTs.push(_oc49VibStrs[_o57s].timestamp || 0); }
                    if (_oc57VibTs.length > 0) {
                        var _oc57LastVib = Math.max.apply(null, _oc57VibTs);
                        if (bedExitTs > _oc57LastVib + 5 * 60000) {
                            var _oc57Outside = _oc45aPwEvts.filter(function(e) {
                                var _ts57 = e.timestamp || 0;
                                if (_ts57 <= _oc57LastVib || _ts57 >= bedExitTs) return false;
                                if (e.type !== 'motion') return false;
                                if (!_oc45aIsTrue(e.value)) return false;
                                return !(_oc45aBedroomLocs.size > 0 && _oc45aBedroomLocs.has(e.location || ''));
                            });
                            var _oc57Span = 0;
                            if (_oc57Outside.length > 0) {
                                var _oc57Ts = _oc57Outside.map(function(e) { return e.timestamp || 0; });
                                _oc57Span = Math.max.apply(null, _oc57Ts) - Math.min.apply(null, _oc57Ts);
                            }
                            if (_oc57Outside.length >= 3 && _oc57Span >= 20 * 60000) {
                                this.log.info('[OC-57] bedExitTs Walk-Through-Guard: ' + new Date(bedExitTs).toLocaleTimeString() + ' -> ' + new Date(_oc57LastVib).toLocaleTimeString() + ' (letzter Matratzen-Kontakt; danach ' + _oc57Outside.length + ' Ausser-Schlafzimmer-Events ueber ' + Math.round(_oc57Span / 60000) + 'min)');
                                bedExitTs = _oc57LastVib; _bedExitSrc = 'oc57_vib_cap';
                            }
                        }
                    }
                }
                if (bedExitTs) this.log.info('[OC-45a] bedExitTs: ' + new Date(bedExitTs).toLocaleTimeString() + ' (' + _bedExitSrc + ')');`);

if (!src.includes(ANCHOR)) {
  console.error('FEHLER: OC-57 Anker nicht gefunden!');
  process.exit(1);
}
if (src.includes('[OC-57] Walk-Through-Guard')) {
  console.error('FEHLER: OC-57 bereits vorhanden (doppelte Anwendung verhindert).');
  process.exit(1);
}
src = src.replace(ANCHOR, REPLACEMENT);
fs.writeFileSync(filePath, src, 'utf8');
console.log('OK: OC-57 bedExitTs Walk-Through-Guard eingefuegt.');
