// SystemTab.tsx: OC-VIB-CAL Kalibrierungs-Panel + Toggle
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src-admin', 'src', 'components', 'tabs', 'SystemTab.tsx');
let src = fs.readFileSync(filePath, 'utf8');
const NL = '\r\n'; // SystemTab uses CRLF

function r(oldStr, newStr, label) {
    const cnt = src.split(oldStr).length - 1;
    if (cnt !== 1) { console.error(label + ' anchor count=' + cnt); process.exit(1); }
    src = src.replace(oldStr, newStr);
    console.log(label + ' done');
}

// 1. Add Switch, FormControlLabel, LinearProgress to MUI imports
r(
    'Box, Typography, Accordion, AccordionSummary, AccordionDetails,\r\n    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,\r\n    TextField, Button, IconButton, Paper, Alert, Autocomplete, InputAdornment,\r\n    Divider, Chip, Tooltip, Stack',
    'Box, Typography, Accordion, AccordionSummary, AccordionDetails,\r\n    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,\r\n    TextField, Button, IconButton, Paper, Alert, Autocomplete, InputAdornment,\r\n    Divider, Chip, Tooltip, Stack, Switch, FormControlLabel, LinearProgress',
    'MUI imports'
);

// 2. Add TuneIcon import (after HubIcon)
r(
    "import HubIcon from '@mui/icons-material/Hub';",
    "import HubIcon from '@mui/icons-material/Hub';\r\nimport TuneIcon from '@mui/icons-material/Tune';",
    'TuneIcon import'
);

// 3. Add vibCalibData state + useEffect (inject after loading/saved state)
r(
    '    const [loading, setLoading] = useState(false);\r\n    const [saved, setSaved] = useState(false);',
    [
        '    const [loading, setLoading] = useState(false);',
        '    const [saved, setSaved] = useState(false);',
        '',
        '    // --- OC-VIB-CAL: Vibrations-Kalibrierung ---',
        '    const onChange = props.onChange;',
        '    const [vibCalibData, setVibCalibData] = useState<any>(null);',
        '    useEffect(() => {',
        '        const loadVC = () => {',
        "            socket.getState(namespace + '.analysis.health.vibCalibData').then((s: any) => {",
        '                if (s && s.val) { try { setVibCalibData(JSON.parse(s.val)); } catch(e) {} }',
        '            }).catch(() => {});',
        '        };',
        '        loadVC();',
        '        const vcTimer = setInterval(loadVC, 5 * 60 * 1000);',
        '        return () => clearInterval(vcTimer);',
        '    }, [socket, namespace]);'
    ].join(NL),
    'vibCalibData state'
);

// 4. Add Calibration Accordion before Topology
const BEFORE_TOPO = '        {/* OC-2: Topologie-Matrix \u2014 ab v0.33.67 prim\u00e4r hier im System-Tab */}';
const CALIB_LINES = [
    '        {/* OC-VIB-CAL: Vibrations-Kalibrierung */}',
    "        <Accordion defaultExpanded={false} sx={{ mt: 1, border: '1px solid rgba(100,100,100,0.2)', borderRadius: '6px !important', overflow: 'hidden' }}>",
    '            <AccordionSummary expandIcon={<ExpandMoreIcon />}>',
    "                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>",
    "                    <TuneIcon sx={{ fontSize: 18, color: '#f57c00' }} />",
    "                    <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>Vibrations-Kalibrierung (OC-VIB-CAL)</Typography>",
    '                    {(() => {',
    '                        const gStat = vibCalibData?.rolling?.global?.status;',
    '                        const gN    = vibCalibData?.rolling?.global?.nightCount ?? 0;',
    "                        if (!gStat || gStat === 'uncalibrated') return <Chip label=\"Unkalibriert\" size=\"small\" sx={{ fontSize: '0.65rem', height: 18, bgcolor: '#78909c20', color: '#78909c' }} />;",
    "                        if (gStat === 'calibrating') return <Chip label={'Kalibrierung ' + gN + '/7'} size=\"small\" sx={{ fontSize: '0.65rem', height: 18, bgcolor: '#ff980020', color: '#f57c00' }} />;",
    "                        return <Chip label=\"Kalibriert \u2713\" size=\"small\" sx={{ fontSize: '0.65rem', height: 18, bgcolor: '#4caf5020', color: '#388e3c' }} />;",
    '                    })()}',
    '                </Box>',
    '            </AccordionSummary>',
    "            <AccordionDetails sx={{ p: 1.5 }}>",
    "                <Alert severity=\"info\" sx={{ mb: 1.5, py: 0.4, fontSize: '0.72rem' }}>",
    "                    AURA lernt \u00fcber mehrere N\u00e4chte die <b>pers\u00f6nlichen Vibrationsmuster</b> f\u00fcr adaptive Wake/REM/Tief-Schlaf-Erkennung.",
    "                    Nach <b>3 N\u00e4chten</b> beginnt die Kalibrierung, nach <b>7 N\u00e4chten</b> sind die Schwellen stabil.",
    '                </Alert>',
    '',
    '                {/* Adaptive Toggle */}',
    "                <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, borderRadius: 1.5, border: '1px solid rgba(100,100,100,0.15)', display: 'flex', alignItems: 'center', gap: 2 }}>",
    '                    <FormControlLabel',
    '                        control={',
    '                            <Switch',
    "                                checked={native?.adaptiveVibThresholds !== false}",
    '                                onChange={(e) => onChange && onChange(\'adaptiveVibThresholds\', e.target.checked)}',
    '                                color="warning"',
    '                                size="small"',
    '                            />',
    '                        }',
    "                        label={<Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>Adaptive Vibrations-Schwellen aktiv</Typography>}",
    '                    />',
    "                    <Typography variant=\"caption\" color=\"text.secondary\">",
    '                        {native?.adaptiveVibThresholds !== false',
    "                            ? 'Aktiv \u2014 Wake/REM/Tief-Schwellen passen sich an dein Bett an'",
    "                            : 'Deaktiviert \u2014 feste Schwellen (Wake>28, REM 12\u201323, Tief slotDet=0)'}",
    '                    </Typography>',
    '                </Paper>',
    '',
    '                {/* Kalibrierungs-Tabelle */}',
    '                {vibCalibData?.rolling && (() => {',
    '                    const roll = vibCalibData.rolling;',
    '                    const allEntries: Array<{name: string, data: any}> = [];',
    "                    if (roll.global) allEntries.push({ name: 'Global (Haushalt)', data: roll.global });",
    '                    Object.entries(roll.persons || {}).forEach(([pName, pData]: [string, any]) => {',
    '                        allEntries.push({ name: pName, data: pData });',
    '                    });',
    '                    if (allEntries.length === 0) return null;',
    '                    return (',
    '                        <Box>',
    "                            <Typography variant=\"caption\" color=\"text.secondary\" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>",
    '                                Kalibrierungsstatus pro Person',
    '                            </Typography>',
    "                            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(100,100,100,0.15)' }}>",
    '                                <Table size="small">',
    '                                    <TableHead>',
    "                                        <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.72rem', py: 0.5 } }}>",
    '                                            <TableCell>Person</TableCell>',
    '                                            <TableCell align="center">N\u00e4chte</TableCell>',
    '                                            <TableCell align="center">Wake-Schwelle</TableCell>',
    '                                            <TableCell align="center">REM-Fenster</TableCell>',
    '                                            <TableCell align="center">Tief-Trigger \u2264</TableCell>',
    '                                            <TableCell align="center">Fortschritt</TableCell>',
    '                                            <TableCell align="center">Status</TableCell>',
    '                                        </TableRow>',
    '                                    </TableHead>',
    '                                    <TableBody>',
    '                                        {allEntries.map(({ name, data }) => {',
    '                                            const n = data.nightCount ?? 0;',
    '                                            const pct = Math.min(100, Math.round((n / 7) * 100));',
    "                                            const stat = data.status || 'uncalibrated';",
    "                                            const chipColor = stat === 'calibrated' ? '#4caf50' : stat === 'calibrating' ? '#f57c00' : '#78909c';",
    "                                            const chipBg   = stat === 'calibrated' ? '#4caf5020' : stat === 'calibrating' ? '#ff980020' : '#78909c20';",
    "                                            const statLabel = stat === 'calibrated' ? 'Kalibriert' : stat === 'calibrating' ? 'L\u00e4uft...' : 'Unkalibriert';",
    '                                            const wk = data.wakeThresh ?? \'\u2014\';',
    '                                            const ru = data.remUp ?? \'\u2014\';',
    '                                            const rl = data.remLow ?? \'\u2014\';',
    '                                            const tt = data.trigThr ?? 0;',
    '                                            return (',
    '                                                <TableRow key={name} sx={{ \'& td\': { fontSize: \'0.75rem\', py: 0.4 } }}>',
    '                                                    <TableCell sx={{ fontWeight: 600 }}>{name}</TableCell>',
    "                                                    <TableCell align=\"center\">{n}\u00a0/\u00a0{n >= 7 ? '14' : '7'}</TableCell>",
    '                                                    <TableCell align="center">',
    "                                                        {data.wakeThresh ? <Chip label={'> ' + wk} size=\"small\" sx={{ fontSize: '0.68rem', height: 18, bgcolor: '#f4433620', color: '#c62828' }} /> : <span style={{color:'#999'}}>\u2014</span>}",
    '                                                    </TableCell>',
    '                                                    <TableCell align="center">',
    "                                                        {(data.remLow && data.remUp) ? <Chip label={rl + '\u2013' + ru} size=\"small\" sx={{ fontSize: '0.68rem', height: 18, bgcolor: '#9c27b020', color: '#6a1b9a' }} /> : <span style={{color:'#999'}}>\u2014</span>}",
    '                                                    </TableCell>',
    '                                                    <TableCell align="center">',
    "                                                        <Chip label={'\u2264\u00a0' + tt} size=\"small\" sx={{ fontSize: '0.68rem', height: 18, bgcolor: '#1565c020', color: '#1565c0' }} />",
    '                                                    </TableCell>',
    "                                                    <TableCell align=\"center\" sx={{ minWidth: 90 }}>",
    "                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>",
    "                                                            <LinearProgress variant=\"determinate\" value={pct} sx={{ flex: 1, height: 6, borderRadius: 3, '& .MuiLinearProgress-bar': { bgcolor: chipColor } }} />",
    "                                                            <Typography variant=\"caption\" sx={{ color: chipColor, minWidth: 28 }}>{pct}%</Typography>",
    '                                                        </Box>',
    '                                                    </TableCell>',
    '                                                    <TableCell align="center">',
    "                                                        <Chip label={statLabel} size=\"small\" sx={{ fontSize: '0.68rem', height: 18, bgcolor: chipBg, color: chipColor }} />",
    '                                                    </TableCell>',
    '                                                </TableRow>',
    '                                            );',
    '                                        })}',
    '                                    </TableBody>',
    '                                </Table>',
    '                            </TableContainer>',
    '                            {vibCalibData?.updatedAt && (',
    "                                <Typography variant=\"caption\" color=\"text.secondary\" sx={{ mt: 0.5, display: 'block' }}>",
    "                                    Letzte Kalibrierung: {new Date(vibCalibData.updatedAt).toLocaleString('de-DE')}",
    "                                    {' \u00b7 '}N\u00e4chste Aktualisierung nach dieser Nacht",
    '                                </Typography>',
    '                            )}',
    '                            {!vibCalibData?.updatedAt && (',
    "                                <Typography variant=\"caption\" color=\"text.secondary\" sx={{ mt: 0.5, display: 'block' }}>",
    '                                    Kalibrierung startet automatisch nach der ersten analysierten Nacht.',
    '                                </Typography>',
    '                            )}',
    '                        </Box>',
    '                    );',
    '                })()}',
    '                {!vibCalibData?.rolling && (',
    "                    <Alert severity=\"warning\" sx={{ py: 0.4, fontSize: '0.72rem' }}>",
    '                        Noch keine Kalibrierungsdaten \u2014 werden nach der n\u00e4chsten Schlafauswertung automatisch erzeugt.',
    '                    </Alert>',
    '                )}',
    '            </AccordionDetails>',
    '        </Accordion>',
    '',
    '        {/* OC-2: Topologie-Matrix \u2014 ab v0.33.67 prim\u00e4r hier im System-Tab */}'
].join(NL);

r(BEFORE_TOPO, CALIB_LINES, 'Calibration Accordion');

fs.writeFileSync(filePath, src, 'utf8');
console.log('SystemTab patch done. Total lines:', src.split('\n').length);
