// OC-VIB-CAL: Drift-Erkennung + Reset-Button — v0.33.314
// Backend:
//   D1: Drift-Erkennung in Rolling-Buffer-Logik (2 konsekutive Ausreißer → driftWarning)
//   D2: resetVibCalib Message-Handler
// Frontend (SystemTab.tsx):
//   D3: vibCalibResetting State + handleResetVibCalib Funktion
//   D4: Drift-Warnung Alert + Reset-Button in der Kalibrierungstabelle

const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, '..', 'src', 'main.js');
const tabPath  = path.join(__dirname, '..', 'src-admin', 'src', 'components', 'tabs', 'SystemTab.tsx');

let src = fs.readFileSync(mainPath, 'utf8');
let stx = fs.readFileSync(tabPath, 'utf8');
const NL = stx.includes('\r\n') ? '\r\n' : '\n';

function r1(src, old, nw, label) {
    const cnt = src.split(old).length - 1;
    if (cnt !== 1) { console.error(label + ' anchor count=' + cnt + ' (erwartet 1)'); process.exit(1); }
    const result = src.replace(old, nw);
    console.log(label + ' OK');
    return result;
}

// ============================================================
// D1: Drift-Erkennung vor dem Rolling-Buffer-Schreiben
// ============================================================
const D1_OLD = '                _vcData2.rolling=_vcRoll2; _vcData2.updatedAt=Date.now();';
const D1_NEW = `                // OC-VIB-CAL: Drift-Erkennung — Sensor-Position geaendert?
                // Wenn die letzten 2 Naechte beide stark vom historischen Mittel abweichen
                // (>2.5x oder <0.35x), flaggen wir einen Sensor-Drift-Verdacht.
                var _vcDriftGlobal = false;
                if (_vcN2 >= 5) {
                    var _vcRefNs = _vcData2.nights.slice(0, -2);
                    var _vcLast2 = _vcData2.nights.slice(-2);
                    var _vcRefMxs = _vcRefNs.map(function(n){return n.global&&n.global.vibStrMax;}).filter(function(v){return typeof v==='number'&&v>0;});
                    if (_vcRefMxs.length >= 3) {
                        var _vcRefMean = _vcRefMxs.reduce(function(a,b){return a+b;},0)/_vcRefMxs.length;
                        if (_vcRefMean > 0) {
                            var _vcOutliers = _vcLast2.filter(function(n){var v=n.global&&n.global.vibStrMax;return typeof v==='number'&&v>0&&(v>_vcRefMean*2.5||v<_vcRefMean*0.35);});
                            if (_vcOutliers.length >= 2) {
                                _vcDriftGlobal = true;
                                this.log.warn('[OC-VIB-CAL] Sensor-Drift erkannt! letzte 2 Naechte weichen stark ab (Sensor verschoben?)');
                            }
                        }
                    }
                }
                if (_vcRoll2.global) _vcRoll2.global.driftWarning = _vcDriftGlobal;
                // Per-Person Drift
                _allPNames.forEach(function(pName) {
                    if (!_vcRoll2.persons[pName]) return;
                    var _pdNights = _vcData2.nights.filter(function(n){return n.persons&&n.persons[pName]&&typeof n.persons[pName].vibStrMax==='number';});
                    if (_pdNights.length < 5) { _vcRoll2.persons[pName].driftWarning = false; return; }
                    var _pdRef = _pdNights.slice(0,-2);
                    var _pdL2  = _pdNights.slice(-2);
                    var _pdRefMxs = _pdRef.map(function(n){return n.persons[pName].vibStrMax;}).filter(function(v){return typeof v==='number'&&v>0;});
                    if (_pdRefMxs.length < 3) { _vcRoll2.persons[pName].driftWarning = false; return; }
                    var _pdRefMean = _pdRefMxs.reduce(function(a,b){return a+b;},0)/_pdRefMxs.length;
                    var _pdOut = _pdL2.filter(function(n){var v=n.persons[pName].vibStrMax;return typeof v==='number'&&v>0&&(v>_pdRefMean*2.5||v<_pdRefMean*0.35);});
                    _vcRoll2.persons[pName].driftWarning = (_pdOut.length >= 2);
                });
                _vcData2.rolling=_vcRoll2; _vcData2.updatedAt=Date.now();`;
src = r1(src, D1_OLD, D1_NEW, 'D1');

// ============================================================
// D2: resetVibCalib Message-Handler
// ============================================================
const D2_OLD = '     // removeSingleIntimacyEvent: Entfernt EINE Session per Start-Timestamp (Session-Level Nullnummer)\n        else if (obj.command === \'forceRecompute\') {';
const D2_NEW = `     // OC-VIB-CAL: Kalibrierung manuell zuruecksetzen (Sensor verschoben etc.)
        else if (obj.command === 'resetVibCalib') {
            try {
                await this.setStateAsync('analysis.health.vibCalibData', { val: '{}', ack: true });
                this.log.info('[OC-VIB-CAL] Kalibrierung manuell zurueckgesetzt');
                this.sendTo(obj.from, obj.command, { success: true }, obj.callback);
            } catch(_rvE) {
                this.log.warn('[OC-VIB-CAL] Reset-Fehler: ' + _rvE.message);
                this.sendTo(obj.from, obj.command, { success: false, error: _rvE.message }, obj.callback);
            }
        }
        // removeSingleIntimacyEvent: Entfernt EINE Session per Start-Timestamp (Session-Level Nullnummer)
        else if (obj.command === 'forceRecompute') {`;
src = r1(src, D2_OLD, D2_NEW, 'D2');

fs.writeFileSync(mainPath, src, 'utf8');
console.log('src/main.js geschrieben.');

// ============================================================
// D3: Frontend — vibCalibResetting State + handleResetVibCalib
// ============================================================
const D3_OLD = `    }, [socket, namespace]);\r\n\r\n    // 1. Hole alle verfügbaren Räume aus der Config für das Dropdown`;
const D3_NEW = `    }, [socket, namespace]);\r\n    const [vibCalibResetting, setVibCalibResetting] = useState(false);\r\n    const handleResetVibCalib = async () => {\r\n        if (!window.confirm('Kalibrierung wirklich zurücksetzen? AURA lernt danach neu (3–7 Nächte).')) return;\r\n        setVibCalibResetting(true);\r\n        try {\r\n            await socket.sendTo(\`\${adapterName}.\${instance}\`, 'resetVibCalib', {});\r\n            setVibCalibData(null);\r\n        } catch(_rvcE) { /* ignore */ }\r\n        setVibCalibResetting(false);\r\n    };\r\n\r\n    // 1. Hole alle verfügbaren Räume aus der Config für das Dropdown`;
stx = r1(stx, D3_OLD, D3_NEW, 'D3');

// ============================================================
// D4: Frontend — Drift-Warnung + Reset-Button nach der Tabelle
// ============================================================
const D4_OLD = `                            {!vibCalibData?.updatedAt && (\r\n                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>\r\n                                    Kalibrierung startet automatisch nach der ersten analysierten Nacht.\r\n                                </Typography>\r\n                            )}\r\n                        </Box>`;
const D4_NEW = `                            {!vibCalibData?.updatedAt && (\r\n                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>\r\n                                    Kalibrierung startet automatisch nach der ersten analysierten Nacht.\r\n                                </Typography>\r\n                            )}\r\n                            {/* OC-VIB-CAL: Drift-Warnung wenn Sensor-Position verändert */}\r\n                            {vibCalibData?.rolling?.global?.driftWarning && (\r\n                                <Alert severity="warning" icon={<WarningAmberIcon fontSize="small" />} sx={{ mt: 1, py: 0.4, fontSize: '0.72rem' }}>\r\n                                    <b>Vibrationsmuster hat sich stark verändert</b> — wurde der Sensor verschoben?\r\n                                    {' '}Falls ja, empfehlen wir einen Reset damit AURA neu kalibriert.\r\n                                </Alert>\r\n                            )}\r\n                            {/* Reset-Button */}\r\n                            {vibCalibData?.rolling && (\r\n                                <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>\r\n                                    <Button\r\n                                        size="small"\r\n                                        variant="outlined"\r\n                                        color="warning"\r\n                                        disabled={vibCalibResetting}\r\n                                        onClick={handleResetVibCalib}\r\n                                        startIcon={<ClearIcon fontSize="small" />}\r\n                                        sx={{ fontSize: '0.72rem' }}\r\n                                    >\r\n                                        {vibCalibResetting ? 'Wird zurückgesetzt…' : 'Kalibrierung zurücksetzen'}\r\n                                    </Button>\r\n                                </Box>\r\n                            )}\r\n                        </Box>`;
stx = r1(stx, D4_OLD, D4_NEW, 'D4');

fs.writeFileSync(tabPath, stx, 'utf8');
console.log('SystemTab.tsx geschrieben.');
console.log('Alle Patches angewendet.');
