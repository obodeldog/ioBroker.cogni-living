// OC-VIB-CAL: Per-Person-Reset — v0.33.315
// Backend:
//   D5: resetVibCalib mit target-Parameter (global | Personname | all)
// Frontend (SystemTab.tsx):
//   D5: vibCalibResettingTarget + handleResetVibCalibFor(target, displayName)
//   D6: allEntries mit target-Feld
//   D7: Tabellen-Header: leere Reset-Spalte ergänzen
//   D8: Tabellenzeile: Drift-Icon in Status-Spalte + Reset-IconButton pro Zeile
//   D9: Unten: globaler Reset-Button entfernen, Drift-Warnung auf alle Zeilen anpassen

const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, '..', 'src', 'main.js');
const tabPath  = path.join(__dirname, '..', 'src-admin', 'src', 'components', 'tabs', 'SystemTab.tsx');

let src = fs.readFileSync(mainPath, 'utf8');
let stx = fs.readFileSync(tabPath, 'utf8');
const NL = '\r\n';

function r1(content, old, nw, label) {
    const cnt = content.split(old).length - 1;
    if (cnt !== 1) { console.error(label + ' anchor count=' + cnt + ' (erwartet 1)'); process.exit(1); }
    const result = content.replace(old, nw);
    console.log(label + ' OK');
    return result;
}

// ============================================================
// D5 Backend: resetVibCalib mit target-Parameter
// ============================================================
const D5B_OLD = `        else if (obj.command === 'resetVibCalib') {
            try {
                await this.setStateAsync('analysis.health.vibCalibData', { val: '{}', ack: true });
                this.log.info('[OC-VIB-CAL] Kalibrierung manuell zurueckgesetzt');
                this.sendTo(obj.from, obj.command, { success: true }, obj.callback);
            } catch(_rvE) {
                this.log.warn('[OC-VIB-CAL] Reset-Fehler: ' + _rvE.message);
                this.sendTo(obj.from, obj.command, { success: false, error: _rvE.message }, obj.callback);
            }
        }`;

const D5B_NEW = `        else if (obj.command === 'resetVibCalib') {
            // OC-VIB-CAL Per-Person-Reset: target='global'|'all'|personName
            try {
                var _rvTarget = (obj.message && obj.message.target) ? obj.message.target : 'all';
                var _rvState = await this.getStateAsync('analysis.health.vibCalibData');
                var _rvData = { nights: [], rolling: {} };
                if (_rvState && _rvState.val) { try { _rvData = JSON.parse(_rvState.val); } catch(_){} }
                if (!Array.isArray(_rvData.nights)) _rvData.nights = [];
                if (!_rvData.rolling) _rvData.rolling = {};
                if (_rvTarget === 'all') {
                    _rvData = { nights: [], rolling: {} };
                } else if (_rvTarget === 'global') {
                    _rvData.nights.forEach(function(n) { n.global = null; });
                    _rvData.rolling.global = { nightCount: 0, status: 'uncalibrated', driftWarning: false };
                } else {
                    // Einzelne Person zuruecksetzen
                    _rvData.nights.forEach(function(n) { if (n.persons) delete n.persons[_rvTarget]; });
                    if (_rvData.rolling.persons) delete _rvData.rolling.persons[_rvTarget];
                }
                await this.setStateAsync('analysis.health.vibCalibData', { val: JSON.stringify(_rvData), ack: true });
                this.log.info('[OC-VIB-CAL] Reset: target=' + _rvTarget);
                this.sendTo(obj.from, obj.command, { success: true }, obj.callback);
            } catch(_rvE) {
                this.log.warn('[OC-VIB-CAL] Reset-Fehler: ' + _rvE.message);
                this.sendTo(obj.from, obj.command, { success: false, error: _rvE.message }, obj.callback);
            }
        }`;
src = r1(src, D5B_OLD, D5B_NEW, 'D5-Backend');
fs.writeFileSync(mainPath, src, 'utf8');
console.log('src/main.js geschrieben.');

// ============================================================
// D5 Frontend: State + Handler ersetzen
// ============================================================
const D5F_OLD = [
    `    const [vibCalibResetting, setVibCalibResetting] = useState(false);`,
    `    const handleResetVibCalib = async () => {`,
    `        if (!window.confirm('Kalibrierung wirklich zurücksetzen? AURA lernt danach neu (3\u20137 Nächte).')) return;`,
    `        setVibCalibResetting(true);`,
    `        try {`,
    `            await socket.sendTo(\`\${adapterName}.\${instance}\`, 'resetVibCalib', {});`,
    `            setVibCalibData(null);`,
    `        } catch(_rvcE) { /* ignore */ }`,
    `        setVibCalibResetting(false);`,
    `    };`
].join(NL);

const D5F_NEW = [
    `    const [vibCalibResettingTarget, setVibCalibResettingTarget] = useState<string | null>(null);`,
    `    const handleResetVibCalibFor = async (target: string, displayName: string) => {`,
    `        const isGlobal = target === 'global';`,
    `        const msg = isGlobal`,
    `            ? \`Kalibrierung für "Global (Haushalt)" zurücksetzen? Nur der globale Mittelwert wird gelöscht — persönliche Schwellen bleiben erhalten.\``,
    `            : \`Kalibrierung für "\${displayName}" zurücksetzen? AURA lernt für diese Person neu (3\u20137 Nächte).\`;`,
    `        if (!window.confirm(msg)) return;`,
    `        setVibCalibResettingTarget(target);`,
    `        try {`,
    `            await socket.sendTo(\`\${adapterName}.\${instance}\`, 'resetVibCalib', { target });`,
    `            const _rvS: any = await socket.getState(namespace + '.analysis.health.vibCalibData');`,
    `            if (_rvS && _rvS.val) { try { setVibCalibData(JSON.parse(_rvS.val)); } catch(_e) {} } else { setVibCalibData(null); }`,
    `        } catch(_rvcE) { /* ignore */ }`,
    `        setVibCalibResettingTarget(null);`,
    `    };`
].join(NL);
stx = r1(stx, D5F_OLD, D5F_NEW, 'D5-Frontend');

// ============================================================
// D6: allEntries mit target-Feld
// ============================================================
const D6_OLD = [
    `                    const allEntries: Array<{name: string, data: any}> = [];`,
    `                    if (roll.global) allEntries.push({ name: 'Global (Haushalt)', data: roll.global });`,
    `                    Object.entries(roll.persons || {}).forEach(([pName, pData]: [string, any]) => {`,
    `                        allEntries.push({ name: pName, data: pData });`,
    `                    });`
].join(NL);

const D6_NEW = [
    `                    const allEntries: Array<{name: string, target: string, data: any}> = [];`,
    `                    if (roll.global) allEntries.push({ name: 'Global (Haushalt)', target: 'global', data: roll.global });`,
    `                    Object.entries(roll.persons || {}).forEach(([pName, pData]: [string, any]) => {`,
    `                        allEntries.push({ name: pName, target: pName, data: pData });`,
    `                    });`
].join(NL);
stx = r1(stx, D6_OLD, D6_NEW, 'D6');

// ============================================================
// D7: Tabellen-Header: leere Reset-Spalte nach Status
// ============================================================
const D7_OLD = `                                            <TableCell align="center">Status</TableCell>\r\n                                        </TableRow>`;
const D7_NEW = `                                            <TableCell align="center">Status</TableCell>\r\n                                            <TableCell align="center" sx={{ width: 32, px: 0.5 }}></TableCell>\r\n                                        </TableRow>`;
stx = r1(stx, D7_OLD, D7_NEW, 'D7');

// ============================================================
// D8: Tabellenzeile: map-Destrukturierung + Status-Spalte + Reset-Button
// ============================================================
const D8_OLD = [
    `                                        {allEntries.map(({ name, data }) => {`,
].join(NL);
const D8_NEW = [
    `                                        {allEntries.map(({ name, target, data }) => {`,
].join(NL);
stx = r1(stx, D8_OLD, D8_NEW, 'D8a');

// Status-Zelle + Reset-Button am Ende der Zeile ersetzen
const D8B_OLD = [
    `                                                    <TableCell align="center">`,
    `                                                        <Chip label={statLabel} size="small" sx={{ fontSize: '0.68rem', height: 18, bgcolor: chipBg, color: chipColor }} />`,
    `                                                    </TableCell>`,
    `                                                </TableRow>`
].join(NL);
const D8B_NEW = [
    `                                                    <TableCell align="center">`,
    `                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>`,
    `                                                            <Chip label={statLabel} size="small" sx={{ fontSize: '0.68rem', height: 18, bgcolor: chipBg, color: chipColor }} />`,
    `                                                            {data.driftWarning && (`,
    `                                                                <Tooltip title="Sensor-Drift erkannt — Vibrationsmuster stark verändert">`,
    `                                                                    <WarningAmberIcon sx={{ fontSize: 13, color: '#f57c00' }} />`,
    `                                                                </Tooltip>`,
    `                                                            )}`,
    `                                                        </Box>`,
    `                                                    </TableCell>`,
    `                                                    <TableCell align="center" sx={{ px: 0.5 }}>`,
    `                                                        <Tooltip title={\`Kalibrierung für "\${name}" zurücksetzen\`}>`,
    `                                                            <span>`,
    `                                                                <IconButton`,
    `                                                                    size="small"`,
    `                                                                    color="warning"`,
    `                                                                    disabled={vibCalibResettingTarget === target}`,
    `                                                                    onClick={() => handleResetVibCalibFor(target, name)}`,
    `                                                                    sx={{ p: 0.3 }}`,
    `                                                                >`,
    `                                                                    <ClearIcon sx={{ fontSize: 14 }} />`,
    `                                                                </IconButton>`,
    `                                                            </span>`,
    `                                                        </Tooltip>`,
    `                                                    </TableCell>`,
    `                                                </TableRow>`
].join(NL);
stx = r1(stx, D8B_OLD, D8B_NEW, 'D8b');

// ============================================================
// D9: Globalen Reset-Button unten entfernen, Drift-Warnung anpassen
// ============================================================
const D9_OLD = [
    `                            {/* OC-VIB-CAL: Drift-Warnung wenn Sensor-Position verändert */}`,
    `                            {vibCalibData?.rolling?.global?.driftWarning && (`,
    `                                <Alert severity="warning" icon={<WarningAmberIcon fontSize="small" />} sx={{ mt: 1, py: 0.4, fontSize: '0.72rem' }}>`,
    `                                    <b>Vibrationsmuster hat sich stark verändert</b> — wurde der Sensor verschoben?`,
    `                                    {' '}Falls ja, empfehlen wir einen Reset damit AURA neu kalibriert.`,
    `                                </Alert>`,
    `                            )}`,
    `                            {/* Reset-Button */}`,
    `                            {vibCalibData?.rolling && (`,
    `                                <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>`,
    `                                    <Button`,
    `                                        size="small"`,
    `                                        variant="outlined"`,
    `                                        color="warning"`,
    `                                        disabled={vibCalibResetting}`,
    `                                        onClick={handleResetVibCalib}`,
    `                                        startIcon={<ClearIcon fontSize="small" />}`,
    `                                        sx={{ fontSize: '0.72rem' }}`,
    `                                    >`,
    `                                        {vibCalibResetting ? 'Wird zurückgesetzt\u2026' : 'Kalibrierung zurücksetzen'}`,
    `                                    </Button>`,
    `                                </Box>`,
    `                            )}`
].join(NL);

const D9_NEW = [
    `                            {/* OC-VIB-CAL: Drift-Warnung (mindestens eine Zeile hat driftWarning) */}`,
    `                            {vibCalibData?.rolling && (() => {`,
    `                                const _anyDrift = [vibCalibData.rolling.global, ...Object.values(vibCalibData.rolling.persons || {})].some((d: any) => d?.driftWarning);`,
    `                                if (!_anyDrift) return null;`,
    `                                return (`,
    `                                    <Alert severity="warning" icon={<WarningAmberIcon fontSize="small" />} sx={{ mt: 1, py: 0.4, fontSize: '0.72rem' }}>`,
    `                                        <b>Sensor-Drift erkannt</b> — Vibrationsmuster hat sich stark verändert (⚠ in der Tabelle).`,
    `                                        {' '}Wurde der Sensor verschoben? Dann ↺ in der Zeile klicken um neu zu kalibrieren.`,
    `                                    </Alert>`,
    `                                );`,
    `                            })()}`
].join(NL);
stx = r1(stx, D9_OLD, D9_NEW, 'D9');

fs.writeFileSync(tabPath, stx, 'utf8');
console.log('SystemTab.tsx geschrieben.');
console.log('Alle Patches angewendet.');
