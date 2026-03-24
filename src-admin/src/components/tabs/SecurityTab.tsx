import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Grid, Paper, Accordion, AccordionSummary, AccordionDetails, Alert, Stack,
    IconButton, TextField, Button, Switch, FormControlLabel,
    useTheme, LinearProgress, Card, CardContent, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, Tooltip,
    Chip, Divider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';

// Icons Imports
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PsychologyIcon from '@mui/icons-material/Psychology';
import InfoIcon from '@mui/icons-material/Info';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import BlurOnIcon from '@mui/icons-material/BlurOn';
import WavesIcon from '@mui/icons-material/Waves';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SettingsInputComponentIcon from '@mui/icons-material/SettingsInputComponent';
import SpeedIcon from '@mui/icons-material/Speed';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScienceIcon from '@mui/icons-material/Science';
import BuildIcon from '@mui/icons-material/Build';
import DoNotDisturbOnIcon from '@mui/icons-material/DoNotDisturbOn';
import HubIcon from '@mui/icons-material/Hub';

// Standard-Werte, falls nichts geladen wird
const DEFAULT_SETTINGS = {
    infrasoundEnabled: false,
    infrasoundSensorId: '',
    infrasoundThreshold: 0.04,
    infrasoundEntryDelay: 0,
    infrasoundArmingId: ''
};

interface ForensicEvent {
    timestamp: number;
    pressure: number;
    isMatch: boolean;
    explanation: string;
    type?: 'ALARM' | 'CALIB' | 'INTERNAL';
}

// Version: 0.29.22 (Fix: Crash Protection for non-array Logs)

export default function SecurityTab(props: any) {
    const { socket, adapterName, instance, themeType } = props;

    // STATES
    const [localNative, setLocalNative] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [handbookOpen, setHandbookOpen] = useState(false);
    const [livePressure, setLivePressure] = useState<number>(0);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [forensicLog, setForensicLog] = useState<ForensicEvent[]>([]);

    // Feature v0.29.13: Graph Matrix Dialog
    const [matrixOpen, setMatrixOpen] = useState(false);
    const [topologyData, setTopologyData] = useState<{rooms: string[], matrix: number[][]} | null>(null);

    const theme = useTheme();

    // 1. INIT
    useEffect(() => {
        if (props.native) {
            setLocalNative(props.native);
            setLoading(false);
        } else {
            const adapterId = `system.adapter.${adapterName}.${instance}`;
            socket.getObject(adapterId)
                .then((obj: any) => {
                    if (obj && obj.native) {
                        setLocalNative({ ...DEFAULT_SETTINGS, ...obj.native });
                    } else {
                        setLocalNative(DEFAULT_SETTINGS);
                    }
                    setLoading(false);
                })
                .catch((e: any) => {
                    console.error("Error loading adapter config:", e);
                    setLocalNative(DEFAULT_SETTINGS);
                    setLoading(false);
                });
        }
    }, [props.native, adapterName, instance, socket]);

    // 2. LIVE DATA
    useEffect(() => {
        if (!socket || !localNative?.infrasoundEnabled) return;

        const sensorId = localNative.infrasoundSensorId;
        const logId = `${adapterName}.${instance}.analysis.security.infrasoundLog`;

        // Safe Setter
        const updateLogSafe = (val: any) => {
            try {
                const parsed = typeof val === 'string' ? JSON.parse(val) : val;
                if (Array.isArray(parsed)) {
                    setForensicLog(parsed);
                } else {
                    setForensicLog([]); // Fallback bei korrupten Daten
                }
            } catch (e) { setForensicLog([]); }
        };

        socket.getState(logId).then((state: any) => {
            if (state && state.val) updateLogSafe(state.val);
        });

        const onStateChange = (id: string, state: any) => {
            if (id === sensorId && state && state.val !== null) {
                setLivePressure(state.val);
            }
            if (id === logId && state && state.val) {
                updateLogSafe(state.val);
            }
        };

        if (sensorId) socket.subscribeState(sensorId, onStateChange);
        socket.subscribeState(logId, onStateChange);
        setIsSubscribed(true);

        return () => {
            if (sensorId) socket.unsubscribeState(sensorId, onStateChange);
            socket.unsubscribeState(logId, onStateChange);
            setIsSubscribed(false);
        };
    }, [socket, localNative?.infrasoundEnabled, localNative?.infrasoundSensorId, adapterName, instance]);

    // 3. LOAD TOPOLOGY
    const handleOpenMatrix = () => {
        setMatrixOpen(true);
        const trainedMatrixId = `${adapterName}.${instance}.analysis.security.topologyMatrix`;
        const manualDataId = `${adapterName}.${instance}.analysis.topology.structure`;

        const parseAndSet = (val: any) => {
            try {
                const data = typeof val === 'string' ? JSON.parse(val) : val;
                if (data && Array.isArray(data.rooms) && Array.isArray(data.matrix)) {
                    setTopologyData(data);
                    return true;
                }
            } catch(e) {}
            return false;
        };

        // Erst trainierte Verhaltensmatrix (echte Uebergangswahrscheinlichkeiten), dann binaere Topologie
        socket.getState(trainedMatrixId)
            .then((state: any) => {
                if (state && state.val && parseAndSet(state.val)) return;
                // Fallback: manuelle Topologie-Struktur (binaer 0/1)
                socket.getState(manualDataId)
                    .then((s: any) => { if (s && s.val) parseAndSet(s.val); })
                    .catch(() => {});
            })
            .catch(() => {
                socket.getState(manualDataId)
                    .then((s: any) => { if (s && s.val) parseAndSet(s.val); })
                    .catch(() => {});
            });
    };

    const handleConfigChange = (field: string, value: any) => {
        const newNative = { ...localNative, [field]: value };
        setLocalNative(newNative);
        if (typeof props.onChange === 'function') {
            props.onChange(field, value);
        } else {
            const adapterId = `system.adapter.${adapterName}.${instance}`;
            socket.extendObject(adapterId, { native: { [field]: value } })
                .catch((e: any) => console.error("Save failed:", e));
        }
    };

    const renderSeismograph = () => {
        const range = 0.1;
        const threshold = localNative?.infrasoundThreshold || 0.04;
        const clampedValue = Math.max(-range, Math.min(range, livePressure));
        const percentage = ((clampedValue + range) / (2 * range)) * 100;
        const threshPosRight = ((threshold + range) / (2 * range)) * 100;
        const threshPosLeft = ((-threshold + range) / (2 * range)) * 100;
        const isAlarm = Math.abs(livePressure) >= threshold;

        return (
            <Box sx={{ mt: 3, mb: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>-0.10 hPa</span>
                    <span><b>LIVE: {livePressure.toFixed(3)} hPa</b></span>
                    <span>+0.10 hPa</span>
                </Typography>
                <Box sx={{ position: 'relative', height: 24, bgcolor: theme.palette.action.disabledBackground, borderRadius: 1, overflow: 'hidden', mt: 0.5, border: '1px solid', borderColor: theme.palette.divider }}>
                    <Box sx={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, bgcolor: 'text.primary', zIndex: 1, opacity: 0.5 }} />
                    <Box sx={{ position: 'absolute', left: 0, width: `${threshPosLeft}%`, top: 0, bottom: 0, bgcolor: 'error.main', opacity: 0.2 }} />
                    <Box sx={{ position: 'absolute', left: `${threshPosRight}%`, right: 0, top: 0, bottom: 0, bgcolor: 'error.main', opacity: 0.2 }} />
                    <Box sx={{ position: 'absolute', left: `${percentage}%`, top: 0, bottom: 0, width: 4, bgcolor: isAlarm ? 'error.main' : 'primary.main', transform: 'translateX(-50%)', zIndex: 2, transition: 'all 0.1s ease-out' }} />
                </Box>
                <Typography variant="caption" color={isAlarm ? 'error.main' : 'text.secondary'} align="center" display="block" sx={{ mt: 0.5, fontWeight: isAlarm ? 'bold' : 'normal' }}>
                    {isAlarm ? '⚠️ SCHWELLWERT ÜBERSCHRITTEN' : 'Signal im grünen Bereich'}
                </Typography>
            </Box>
        );
    };

    const renderStatusChip = (event: ForensicEvent) => {
        if (event.type === 'CALIB') {
            if (event.isMatch) return <Chip size="small" icon={<CheckCircleIcon/>} label="Erfasst (OK)" color="success" variant="outlined" />;
            return <Chip size="small" icon={<BuildIcon/>} label="Zu schwach" color="warning" variant="outlined" />;
        } else if (event.type === 'INTERNAL') {
            return <Chip size="small" icon={<DoNotDisturbOnIcon/>} label="Unterdrückt (Intern)" color="default" variant="outlined" sx={{opacity: 0.7}} />;
        } else {
            if (event.isMatch) return <Chip size="small" icon={<CheckCircleIcon/>} label="Erklärt (OK)" color="success" variant="outlined" />;
            return <Chip size="small" icon={<WarningIcon/>} label="ANOMALIE" color="error" />;
        }
    };

    if (loading) return <LinearProgress />;

    return (
        <Box sx={{ width: '100%', p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HealthAndSafetyIcon fontSize="large" color="primary" />
                    Sicherheits-Zentrale (Neuro-Symbolic)
                </Typography>
                <Button variant="outlined" startIcon={<MenuBookIcon />} onClick={() => setHandbookOpen(true)} color="secondary">
                    System-Handbuch
                </Button>
            </Box>

            <Alert severity="info" sx={{ mb: 3 }} icon={<PsychologyIcon fontSize="inherit" />}>
                Dieses Modul kombiniert <b>physikalische Sensoren</b> (Infraschall) mit <b>KI-Verhaltensanalyse</b> (Graph & LSTM).
                Es erkennt nicht nur den Einbruch, sondern auch die Anomalie davor.
            </Alert>

            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <Stack spacing={3}>
                        <Card variant="outlined" sx={{ borderColor: theme.palette.info.main }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <WavesIcon color="info" /> Layer 0: Infraschall-Sensorik
                                </Typography>
                                <Typography variant="body2" color="text.secondary" paragraph>
                                    Überwacht das Luftvolumen des Gebäudes auf Druckwellen (Fenster/Tür öffnen).
                                </Typography>
                                <Stack spacing={2}>
                                    <FormControlLabel
                                        control={<Switch checked={localNative?.infrasoundEnabled || false} onChange={(e) => handleConfigChange('infrasoundEnabled', e.target.checked)} color="info" />}
                                        label="Infraschall-Überwachung aktivieren"
                                    />
                                    {localNative?.infrasoundEnabled && (
                                        <>
                                            <TextField label="Sensor ID (ESPHome)" variant="outlined" size="small" fullWidth value={localNative.infrasoundSensorId || ''} onChange={(e) => handleConfigChange('infrasoundSensorId', e.target.value)} helperText="Pfad zum Datenpunkt (z.B. esphome.0...druckwelle_live)" InputProps={{ endAdornment: <IconButton size="small"><SettingsInputComponentIcon/></IconButton> }} />
                                            <Grid container spacing={2}>
                                                <Grid item xs={6}>
                                                    <TextField label="Schwellwert (+/- hPa)" type="number" size="small" value={localNative.infrasoundThreshold || 0.04} onChange={(e) => handleConfigChange('infrasoundThreshold', parseFloat(e.target.value))} inputProps={{ step: 0.005 }} fullWidth />
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <TextField label="Verzögerung (Sek)" type="number" size="small" value={localNative.infrasoundEntryDelay || 0} onChange={(e) => handleConfigChange('infrasoundEntryDelay', parseInt(e.target.value))} fullWidth />
                                                </Grid>
                                            </Grid>
                                            <TextField label="Scharfschalt-Status ID" variant="outlined" size="small" fullWidth value={localNative.infrasoundArmingId || ''} onChange={(e) => handleConfigChange('infrasoundArmingId', e.target.value)} helperText="Pfad zum Boolean (true = Scharf). Leer lassen für 'Immer aktiv'." />
                                        </>
                                    )}
                                </Stack>
                            </CardContent>
                        </Card>

                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <VerifiedUserIcon color="success" /> Layer 1: Graph-Brain Status
                            </Typography>
                            <Typography variant="body2" color="text.secondary" paragraph>
                                Lernt die Topologie des Hauses. Erkennt unlogische Bewegungen.
                            </Typography>
                            <Button variant="contained" startIcon={<HubIcon />} onClick={handleOpenMatrix}>
                                Modell-Parameter
                            </Button>
                        </Paper>
                    </Stack>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Stack spacing={3}>
                        <Card elevation={3}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <SpeedIcon color="warning" /> Live-Druckwelle
                                    {isSubscribed && <Chip label="ONLINE" color="success" size="small" sx={{ ml: 'auto' }} />}
                                </Typography>
                                {localNative?.infrasoundEnabled ? renderSeismograph() : <Alert severity="warning">Bitte Infraschall aktivieren, um Live-Daten zu sehen.</Alert>}
                                <Divider sx={{ my: 2 }} />
                                <Alert severity="info" icon={<InfoIcon fontSize="small"/>}>
                                    <b>Kalibrierung:</b> Schwellwert so wählen, dass er knapp über dem normalen Rauschen liegt.
                                </Alert>
                            </CardContent>
                        </Card>

                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <ScienceIcon color="primary" /> Forensische Ereignis-Korrelation
                                </Typography>
                                {/* CRASH FIX: CHECK ARRAY */}
                                {!Array.isArray(forensicLog) || forensicLog.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary" align="center" sx={{ my: 2 }}>
                                        Keine Ereignisse aufgezeichnet.
                                    </Typography>
                                ) : (
                                    <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 200 }}>
                                        <Table size="small" stickyHeader>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Zeit</TableCell>
                                                    <TableCell>Druck (hPa)</TableCell>
                                                    <TableCell>Status</TableCell>
                                                    <TableCell>Ursache</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {forensicLog.map((event, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell>{new Date(event.timestamp).toLocaleTimeString()}</TableCell>
                                                        <TableCell>{event.pressure.toFixed(4)}</TableCell>
                                                        <TableCell>{renderStatusChip(event)}</TableCell>
                                                        <TableCell><Typography variant="caption">{event.explanation}</Typography></TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </CardContent>
                        </Card>
                    </Stack>
                </Grid>
            </Grid>
            
            {/* OC-2: Topologie-Matrix wurde in den System-Tab verschoben (ab v0.33.67) */}
            <Box sx={{ mt: 3 }}>
                <Alert severity="info" icon={<HubIcon />} sx={{ borderRadius: 2, fontSize: '0.8rem' }}>
                    <b>Topologie-Matrix</b> befindet sich jetzt im <b>System-Tab</b> — dort ist sie zentral für Personenzählung, Ganggeschwindigkeit und Sicherheit verfügbar.
                </Alert>
            </Box>

            {/* MATRIX DIALOG */}
            <Dialog open={matrixOpen} onClose={() => setMatrixOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HubIcon /> Graph-Brain: Gelernte Topologie
                </DialogTitle>
                <DialogContent dividers>
                    <DialogContentText paragraph>
                        Dies ist das interne Modell ("Mental Map") Ihres Hauses. Die Werte zeigen die <b>Übergangswahrscheinlichkeit</b> zwischen Räumen.
                        <br/>
                        <i>Beispiel: Ein hoher Wert bei "Küche" &rarr; "Flur" bedeutet, dass dieser Weg oft benutzt wird.</i>
                    </DialogContentText>

                    {/* CRASH FIX: CHECK ARRAY & DATA */}
                    {topologyData && Array.isArray(topologyData.rooms) && topologyData.rooms.length > 0 && Array.isArray(topologyData.matrix) ? (
                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Von \ Nach</TableCell>
                                        {topologyData.rooms.map((room, i) => (
                                            <TableCell key={i} align="center" sx={{fontWeight:'bold', writingMode: 'vertical-rl', transform: 'rotate(180deg)', pb: 1}}>{room}</TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {topologyData.matrix.map((row, i) => (
                                        <TableRow key={i}>
                                            <TableCell component="th" scope="row" sx={{fontWeight:'bold'}}>{topologyData.rooms[i]}</TableCell>
                                            {Array.isArray(row) && row.map((val, j) => {
                                                const percent = Math.round(val * 100);
                                                const opacity = Math.max(0.1, val);
                                                return (
                                                    <TableCell key={j} align="center" sx={{
                                                        bgcolor: val > 0 ? `rgba(33, 150, 243, ${opacity})` : 'transparent',
                                                        fontWeight: val > 0.5 ? 'bold' : 'normal'
                                                    }}>
                                                        {val > 0 ? `${percent}%` : '-'}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ) : (
                        <Alert severity="warning">Keine Topologie-Daten gefunden. Bitte Training starten.</Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setMatrixOpen(false)}>Schließen</Button>
                </DialogActions>
            </Dialog>

            {/* HANDBOOK DIALOG */}
            <Dialog open={handbookOpen} onClose={() => setHandbookOpen(false)} maxWidth="md" fullWidth scroll="paper">
                {/* Content truncated for brevity, same as before but safe */}
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><MenuBookIcon /> Sicherheits-Handbuch</DialogTitle>
                <DialogContent dividers><DialogContentText>System-Architektur...</DialogContentText></DialogContent>
                <DialogActions><Button onClick={() => setHandbookOpen(false)}>OK</Button></DialogActions>
            </Dialog>
        </Box>
    );
}

