'use strict';
// OC-FORCE: Force-Recompute Backend + HealthTab Button
const fs   = require('fs');
const path = require('path');

const mainP = path.join(__dirname, '..', 'src', 'main.js');
let txt = fs.readFileSync(mainP, 'utf8');

if (txt.indexOf('[OC-FORCE]') !== -1) { console.log('SKIP: bereits gepatcht'); process.exit(0); }

// ─────────────────────────────────────────────────────
// PATCH A: Force-Recompute Flag in saveDailyHistory
// Einfügepunkt: direkt nach dem Laden von _existingSnap (L2065-2066)
// ─────────────────────────────────────────────────────
const OLD_A = `            let _existingSnap = null;
            try { if (fs.existsSync(_filePath0)) _existingSnap = JSON.parse(fs.readFileSync(_filePath0, 'utf8')); } catch(_fe) {}
            // Eingefroren wenn: Aufwachzeit vorhanden + vor 14:00 Uhr (= echte Nacht) + mind. 3h Bettzeit`;

const NEW_A = `            let _existingSnap = null;
            try { if (fs.existsSync(_filePath0)) _existingSnap = JSON.parse(fs.readFileSync(_filePath0, 'utf8')); } catch(_fe) {}
            // [OC-FORCE] Force-Recompute: Freeze umgehen wenn explizit angefordert
            // Setzt sleepStages=[] und wakeConfirmed=false damit _sleepFrozen=false wird.
            // Metadaten (Garmin, bedEntryTs etc.) bleiben erhalten fuer korrekte Analyse.
            if (this._forceRecompute === true) {
                this._forceRecompute = false;
                if (_existingSnap) {
                    _existingSnap = Object.assign({}, _existingSnap, {
                        sleepStages: [],
                        personData: _existingSnap.personData
                            ? Object.keys(_existingSnap.personData).reduce(function(acc, k) {
                                acc[k] = Object.assign({}, _existingSnap.personData[k], { wakeConfirmed: false, sleepStages: [] });
                                return acc;
                            }, {})
                            : {}
                    });
                }
                this.log.info('[OC-FORCE] Erzwungene Neuberechnung: Freeze deaktiviert');
            }
            // Eingefroren wenn: Aufwachzeit vorhanden + vor 14:00 Uhr (= echte Nacht) + mind. 3h Bettzeit`;

let n = (txt.split(OLD_A).length - 1);
console.log('PatchA Vorkommen:', n);
if (n !== 1) { console.error('FAIL PatchA'); process.exit(1); }
txt = txt.replace(OLD_A, NEW_A);

// ─────────────────────────────────────────────────────
// PATCH B: onMessage Handler 'forceRecompute'
// Einfügepunkt: direkt vor dem letzten } } } des onMessage-Blocks (L5800)
// ─────────────────────────────────────────────────────
const OLD_B = `        else if (obj.command === 'removeSingleIntimacyEvent') {`;

const NEW_B = `        else if (obj.command === 'forceRecompute') {
            // [OC-FORCE] Erzwungene Neuberechnung der letzten Nacht (Freeze umgehen)
            // Datum optional: obj.message?.date (YYYY-MM-DD). Default: aktuelle sleepDate-Logik.
            try {
                this._forceRecompute = true;
                await this.saveDailyHistory();
                // Frisches JSON lesen und zurueckgeben
                const _frDate = (obj.message && obj.message.date) ? obj.message.date : (() => {
                    const _d = new Date(); const _h = _d.getHours();
                    if (_h < 13) { const _yd = new Date(_d); _yd.setDate(_d.getDate()-1); return _yd.toISOString().slice(0,10); }
                    return _d.toISOString().slice(0,10);
                })();
                const _frPath = require('path').join(require('@iobroker/adapter-core').getAbsoluteDefaultDataDir(), 'cogni-living', 'history', _frDate + '.json');
                let _frData = null;
                try { if (require('fs').existsSync(_frPath)) _frData = JSON.parse(require('fs').readFileSync(_frPath, 'utf8')); } catch(_) {}
                this.log.info('[OC-FORCE] forceRecompute abgeschlossen fuer ' + _frDate);
                this.sendTo(obj.from, obj.command, { success: true, date: _frDate, data: _frData }, obj.callback);
            } catch(_frE) {
                this._forceRecompute = false;
                this.log.warn('[OC-FORCE] forceRecompute Fehler: ' + _frE.message);
                this.sendTo(obj.from, obj.command, { success: false, error: _frE.message }, obj.callback);
            }
        }
        else if (obj.command === 'removeSingleIntimacyEvent') {`;

let n2 = (txt.split(OLD_B).length - 1);
console.log('PatchB Vorkommen:', n2);
if (n2 !== 1) { console.error('FAIL PatchB'); process.exit(1); }
txt = txt.replace(OLD_B, NEW_B);

fs.writeFileSync(mainP, txt, 'utf8');
console.log('OK: OC-FORCE Backend gepatcht');
