import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Accordion, AccordionSummary, AccordionDetails,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    TextField, Button, IconButton, Paper, Alert, Autocomplete, InputAdornment,
    Divider, Chip, Tooltip, Stack
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SecurityIcon from '@mui/icons-material/Security';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import HotelIcon from '@mui/icons-material/Hotel';
import ClearIcon from '@mui/icons-material/Clear';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CancelIcon from '@mui/icons-material/Cancel';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import PersonIcon from '@mui/icons-material/Person';
import GroupsIcon from '@mui/icons-material/Groups';
import HouseIcon from '@mui/icons-material/House';

// IMPORT DER BESTEHENDEN SETTINGS-KOMPONENTE (WICHTIG FÜR DIE EISERNE REGEL)
import Settings from '../Settings';
import TopologyView from '../settings/TopologyView';
import HubIcon from '@mui/icons-material/Hub';

// Version: 0.29.6 (Rollback: Removed manual sanitization because main.js now sends clean data)

export default function SystemTab(props: any) {
    const { socket, adapterName, instance, themeType, native } = props;
    const namespace = `${adapterName}.${instance}`;
    const isDark = themeType === 'dark';

    // --- STATE LIVE-SYSTEMSTATUS ---
    const [livePersonCount, setLivePersonCount] = useState<number | null>(null);
    const [liveHouseholdType, setLiveHouseholdType] = useState<string | null>(null);

    useEffect(() => {
        const loadLiveStatus = () => {
            socket.getState(namespace + '.system.currentPersonCount').then((s: any) => {
                if (s && s.val !== undefined && s.val !== null) setLivePersonCount(Number(s.val));
            }).catch(() => {});
            socket.getState(namespace + '.system.householdType').then((s: any) => {
                if (s && s.val) setLiveHouseholdType(String(s.val));
            }).catch(() => {});
        };
        loadLiveStatus();
        const lsTimer = setInterval(loadLiveStatus, 30 * 1000);
        return () => clearInterval(lsTimer);
    }, [socket, namespace]);

    // --- STATE SENSOR-GESUNDHEIT ---
    const [sensorStatus, setSensorStatus] = useState<{ timestamp: number; offlineCount: number; sensors: { id: string; name: string; location: string; sinceH: number; status: string }[] } | null>(null);
    useEffect(() => {
        const loadSS = () => {
            socket.getState(namespace + '.system.sensorStatus').then((state: any) => {
                if (state && state.val) { try { setSensorStatus(JSON.parse(state.val)); } catch(e) {} }
            }).catch(() => {});
        };
        loadSS();
        const ssTimer = setInterval(loadSS, 5 * 60 * 1000);
        return () => clearInterval(ssTimer);
    }, [socket, namespace]);

    // --- STATE ADAPTER-GESUNDHEIT ---
    const [adapterStatus, setAdapterStatus] = useState<{ timestamp: number; offlineCount: number; adapters: { id: string; ok: boolean; detail: string }[] } | null>(null);
    useEffect(() => {
        const loadAS = () => {
            socket.getState(namespace + '.system.adapterStatus').then((state: any) => {
                if (state && state.val) { try { setAdapterStatus(JSON.parse(state.val)); } catch(e) {} }
            }).catch(() => {});
        };
        loadAS();
        const asTimer = setInterval(loadAS, 5 * 60 * 1000);
        return () => clearInterval(asTimer);
    }, [socket, namespace]);

        // --- STATE FÜR DEAD MAN CONFIG ---
    const [dmConfig, setDmConfig] = useState<{room: string, timeout: number}[]>([]);
    const [newRoom, setNewRoom] = useState<string | null>(null);
    const [newTimeout, setNewTimeout] = useState(30);
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);

    // 1. Hole alle verfügbaren Räume aus der Config für das Dropdown
    const availableRooms = useMemo(() => {
        if (!native || !native.devices) return [];
        const locs = native.devices
            .map((d: any) => d.location)
            .filter((l: any) => l && typeof l === 'string' && l.trim() !== '');
        // @ts-ignore
        return Array.from(new Set(locs)).sort();
    }, [native]);

    // 2. Laden der Konfiguration beim Start
    useEffect(() => {
        socket.getState(`${namespace}.analysis.safety.deadMan.config`).then((state: any) => {
            if (state && state.val) {
                try {
                    const json = JSON.parse(state.val);
                    const arr = Object.entries(json).map(([key, val]) => ({ room: key, timeout: Number(val) }));
                    setDmConfig(arr);
                } catch (e) {
                    console.error("Parse Error DeadMan Config", e);
                }
            }
        });
    }, [socket, namespace]);

    // 3. Speichern der Konfiguration
    const handleSave = () => {
        setLoading(true);
        const configObj: Record<string, number> = {};
        dmConfig.forEach(item => {
            if (item.room) configObj[item.room] = item.timeout;
        });

        socket.setState(`${namespace}.analysis.safety.deadMan.config`, { val: JSON.stringify(configObj), ack: true })
            .then(() => {
                setLoading(false);
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            });
    };

    const addRoom = () => {
        if (!newRoom) return;
        // Prüfen auf Duplikate
        if (dmConfig.find(x => x.room.toLowerCase() === newRoom.toLowerCase())) return;

        const newArr = [...dmConfig, { room: newRoom, timeout: newTimeout }];
        setDmConfig(newArr);
        // Reset Inputs
        setNewRoom(null);
        setNewTimeout(30);
    };

    const removeRoom = (roomName: string) => {
        const newArr = dmConfig.filter(x => x.room !== roomName);
        setDmConfig(newArr);
    };

    // Inline Edit Funktion für Timeouts
    const updateTimeout = (roomName: string, newVal: string) => {
        const val = parseInt(newVal);
        if (isNaN(val) || val < 1) return;

        const newArr = dmConfig.map(item => {
            if (item.room === roomName) {
                return { ...item, timeout: val };
            }
            return item;
        });
        setDmConfig(newArr);
    };

    // Reset Funktion für die "Neue Zeile"
    const clearNewRow = () => {
        setNewRoom(null);
        setNewTimeout(30);
    };

    return (
        <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
            {/* --- HEADER (ORIGINAL) --- */}
            <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
                <SettingsIcon fontSize="large" color="action" />
                <Box>
                    <Typography variant="h4">System & Infrastruktur</Typography>
                    <Typography variant="body1" color="text.secondary">Sensoren, Lizenzen & Schnittstellen</Typography>
                </Box>
            </Box>

            {/* --- LIVE SYSTEMSTATUS (Personenzählung & Haushaltstyp) --- */}
            <Paper elevation={2} sx={{
                mb: 3, p: 2.5, borderRadius: 2,
                border: '1px solid',
                borderColor: isDark ? '#2a3a4a' : '#bbdefb',
                backgroundColor: isDark ? '#0d2137' : '#e3f2fd',
            }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                    <HouseIcon sx={{ color: '#42a5f5', fontSize: 22 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: isDark ? '#90caf9' : '#1565c0' }}>
                        Systemstatus — Live
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        wird alle 30s aktualisiert
                    </Typography>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    {/* Personenzahl */}
                    <Paper elevation={0} sx={{ flex: 1, p: 1.5, borderRadius: 1.5, backgroundColor: isDark ? '#0a1929' : '#ffffff', border: '1px solid', borderColor: isDark ? '#1e4976' : '#90caf9' }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                            {livePersonCount !== null && livePersonCount >= 2
                                ? <GroupsIcon sx={{ color: '#ff9800', fontSize: 28 }} />
                                : <PersonIcon sx={{ color: '#4caf50', fontSize: 28 }} />
                            }
                            <Box>
                                <Typography variant="caption" color="text.secondary">Personen im Haus (geschätzt)</Typography>
                                <Typography variant="h5" sx={{ fontWeight: 'bold', lineHeight: 1.1 }}>
                                    {livePersonCount !== null ? livePersonCount : '—'}
                                </Typography>
                            </Box>
                        </Stack>
                    </Paper>
                    {/* Haushaltstyp */}
                    <Paper elevation={0} sx={{ flex: 1, p: 1.5, borderRadius: 1.5, backgroundColor: isDark ? '#0a1929' : '#ffffff', border: '1px solid', borderColor: isDark ? '#1e4976' : '#90caf9' }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <PeopleAltIcon sx={{ color: '#42a5f5', fontSize: 28 }} />
                            <Box>
                                <Typography variant="caption" color="text.secondary">Haushaltstyp</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                    {liveHouseholdType === 'multi'
                                        ? '👥 Mehrpersonenhaushalt'
                                        : liveHouseholdType === 'single'
                                        ? '🧍 Einpersonenhaushalt'
                                        : '—'
                                    }
                                </Typography>
                            </Box>
                        </Stack>
                    </Paper>
                    {/* Erkennungsquelle */}
                    <Paper elevation={0} sx={{ flex: 1.5, p: 1.5, borderRadius: 1.5, backgroundColor: isDark ? '#0a1929' : '#ffffff', border: '1px solid', borderColor: isDark ? '#1e4976' : '#90caf9' }}>
                        <Typography variant="caption" color="text.secondary">Erkennungsquelle</Typography>
                        <Typography variant="body2" sx={{ mt: 0.3 }}>
                            {livePersonCount !== null && livePersonCount >= 2
                                ? '🔍 Räumliche Heuristik aktiv — mind. 2 Personen erkannt'
                                : '⚙️ Config-Baseline (Haushaltsgröße-Einstellung)'
                            }
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            Quelle wechselt automatisch wenn Sensoren 2 Personen erkennen.
                        </Typography>
                    </Paper>
                </Stack>
            </Paper>

            {/* --- ADAPTER-GESUNDHEIT --- */}
            {(() => {
                if (!adapterStatus || !adapterStatus.adapters || adapterStatus.adapters.length === 0) return null;
                const offlineAdapters = adapterStatus.adapters.filter((a: any) => !a.ok);
                const allOk = offlineAdapters.length === 0;
                return (
                    <Paper elevation={2} sx={{
                        mb: 2, p: 2, borderRadius: 2,
                        border: '2px solid',
                        borderColor: allOk ? (isDark ? '#2e7d32' : '#4caf50') : (isDark ? '#c62828' : '#ef5350'),
                        backgroundColor: allOk ? (isDark ? '#1b2e1b' : '#f1f8e9') : (isDark ? '#2c1b1b' : '#ffebee'),
                    }}>
                        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: allOk ? 0 : 1 }}>
                            {allOk
                                ? <CheckCircleOutlineIcon sx={{ color: '#4caf50', fontSize: 26 }} />
                                : <ErrorOutlineIcon sx={{ color: '#ef5350', fontSize: 26 }} />
                            }
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: allOk ? '#4caf50' : '#ef5350' }}>
                                    {allOk
                                        ? ('✅ Alle ' + adapterStatus.adapters.length + ' Adapter verbunden')
                                        : ('🔴 ' + offlineAdapters.length + ' Adapter nicht verbunden')
                                    }
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {'Letzter Check: ' + new Date(adapterStatus.timestamp).toLocaleString('de-DE')}
                                    {' · ' + adapterStatus.adapters.length + ' Adapter erkannt'}
                                </Typography>
                            </Box>
                        </Stack>
                        {offlineAdapters.length > 0 && (
                            <Stack spacing={0.5} sx={{ mt: 1 }}>
                                {(offlineAdapters as any[]).map((a) => (
                                    <Stack key={a.id} direction="row" alignItems="center" spacing={1}>
                                        <WarningAmberIcon sx={{ color: '#ef5350', fontSize: 16 }} />
                                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{a.id}</Typography>
                                        <Chip size="small" label={a.detail} color="error" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                                    </Stack>
                                ))}
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                    ⚠️ Alle Sensoren dieser Adapter liefern solange keine neuen Werte.
                                </Typography>
                            </Stack>
                        )}
                    </Paper>
                );
            })()}

            {/* --- SENSOR-GESUNDHEIT SAMMELMELDUNG --- */}
            {(() => {
                if (!sensorStatus || !sensorStatus.sensors || sensorStatus.sensors.length === 0) return (
                    <Paper elevation={1} sx={{ mb: 3, p: 2, borderRadius: 2, border: "1px dashed", borderColor: isDark ? "#444" : "#ccc" }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <CheckCircleOutlineIcon sx={{ color: "#9e9e9e" }} />
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary">Sensor-Gesundheit</Typography>
                                <Typography variant="caption" color="text.secondary">Noch kein Check durchgeführt – startet 5 Min. nach Adapter-Start</Typography>
                            </Box>
                        </Stack>
                    </Paper>
                );
                const offline = sensorStatus.sensors.filter((s: any) => s.status === "offline");
                const total = sensorStatus.sensors.length;
                const allOk = offline.length === 0;
                return (
                    <Paper elevation={2} sx={{
                        mb: 3, p: 2, borderRadius: 2,
                        border: "2px solid",
                        borderColor: allOk ? (isDark ? "#2e7d32" : "#4caf50") : (isDark ? "#c62828" : "#ef5350"),
                        backgroundColor: allOk ? (isDark ? "#1b2e1b" : "#f1f8e9") : (isDark ? "#2c1b1b" : "#fff3e0"),
                    }}>
                        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: allOk ? 0 : 1.5 }}>
                            {allOk
                                ? <CheckCircleOutlineIcon sx={{ color: "#4caf50", fontSize: 28 }} />
                                : <ErrorOutlineIcon sx={{ color: "#ef5350", fontSize: 28 }} />
                            }
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: "bold", color: allOk ? "#4caf50" : "#ef5350" }}>
                                    {allOk
                                        ? ("✅ Alle " + total + " Sensoren erreichbar")
                                        : ("⚠️ " + offline.length + " von " + total + " Sensor" + (offline.length > 1 ? "en" : "") + " nicht erreichbar")
                                    }
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {"Letzter Check: " + new Date(sensorStatus.timestamp).toLocaleString("de-DE")}
                                </Typography>
                            </Box>
                        </Stack>
                        {offline.length > 0 && (
                            <Stack spacing={0.5}>
                                {(offline as any[]).map((s) => (
                                    <Stack key={s.id} direction="row" alignItems="center" spacing={1}>
                                        <WarningAmberIcon sx={{ color: "#ff9800", fontSize: 16 }} />
                                        <Typography variant="body2" sx={{ fontWeight: "bold" }}>{s.name}</Typography>
                                        <Typography variant="body2" color="text.secondary">{s.location ? "· " + s.location : ""}</Typography>
                                        <Chip size="small" label={"seit " + s.sinceH + "h"} color="warning" variant="outlined" sx={{ height: 18, fontSize: "0.65rem" }} />
                                    </Stack>
                                ))}
                            </Stack>
                        )}
                    </Paper>
                );
            })()}

            {/* --- HAUPT-EINSTELLUNGEN (ORIGINAL) --- */}
            <Settings
                native={native}
                onChange={props.onChange}
                socket={props.socket}
                themeType={props.themeType}
                theme={props.theme}
                adapterName={props.adapterName}
                instance={props.instance}
            />

            {/* --- TRENNLINIE --- */}
            <Divider sx={{ my: 4 }} />

            {/* --- NEUER BEREICH: DEAD MAN KONFIGURATION (UNTEN) --- */}
            <Accordion sx={{ mb: 4, border: '1px solid', borderColor: isDark ? '#333' : '#ddd' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold' }}>
                        <SecurityIcon color="primary"/> Sicherheit & Sensoren (Dead Man Konfiguration)
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Hier definieren Sie die "Schutzengel"-Zeiten manuell.
                        <br/><i>Hinweis: Räume, die Sie hier nicht auflisten, werden weiterhin automatisch anhand ihres Namens (z.B. "Bad", "WC") mit Standardwerten überwacht.</i>
                    </Alert>

                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, bgcolor: isDark ? '#1e1e1e' : '#fff' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Raum-Name</TableCell>
                                    <TableCell width={180}>Timeout (Minuten)</TableCell>
                                    <TableCell width={100} align="right">Aktion</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {dmConfig.map((row) => (
                                    <TableRow key={row.room}>
                                        <TableCell component="th" scope="row">
                                            <Box sx={{display:'flex', alignItems:'center', gap:1}}>
                                                <HotelIcon fontSize="small" color="action"/>
                                                <Typography variant="body1">{row.room}</Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            {/* Inline Editierbar */}
                                            <TextField
                                                type="number"
                                                variant="standard"
                                                size="small"
                                                value={row.timeout}
                                                onChange={(e) => updateTimeout(row.room, e.target.value)}
                                                InputProps={{
                                                    endAdornment: <InputAdornment position="end">min</InputAdornment>,
                                                }}
                                                sx={{width: 100}}
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <IconButton onClick={() => removeRoom(row.room)} color="error" size="small">
                                                <DeleteIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}

                                {/* ZEILE ZUM HINZUFÜGEN */}
                                <TableRow sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5' }}>
                                    <TableCell>
                                        <Autocomplete
                                            options={availableRooms as string[]}
                                            value={newRoom}
                                            onChange={(event, newValue) => setNewRoom(newValue)}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Neuen Raum hinzufügen..."
                                                    variant="standard"
                                                />
                                            )}
                                            fullWidth
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            type="number"
                                            label="Timeout"
                                            variant="standard"
                                            size="small"
                                            value={newTimeout}
                                            onChange={(e) => setNewTimeout(Number(e.target.value))}
                                            InputProps={{
                                                endAdornment: <InputAdornment position="end">min</InputAdornment>,
                                            }}
                                            sx={{width: 100}}
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        {newRoom ? (
                                            <Box sx={{display:'flex', justifyContent:'flex-end'}}>
                                                {/* Clear Button */}
                                                <IconButton onClick={clearNewRow} size="small" color="default" sx={{mr:1}}>
                                                    <ClearIcon />
                                                </IconButton>
                                                {/* Add Button */}
                                                <IconButton onClick={addRoom} color="primary" size="small">
                                                    <AddIcon />
                                                </IconButton>
                                            </Box>
                                        ) : (
                                            <IconButton disabled size="small">
                                                <AddIcon color="disabled"/>
                                            </IconButton>
                                        )}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                        {saved && <Typography color="success.main" sx={{display:'flex', alignItems:'center'}}>Gespeichert!</Typography>}
                        <Button
                            variant="contained"
                            startIcon={<SaveIcon />}
                            onClick={handleSave}
                            disabled={loading}
                        >
                            Konfiguration Speichern
                        </Button>
                    </Box>
                </AccordionDetails>
        </Accordion>
        {/* ═══ MODULE & SYSTEM-STATUS ═══ */}
        <Accordion sx={{ mb: 2, border: "1px solid", borderColor: isDark ? "#333" : "#ddd" }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: "bold" }}>
                    <DashboardCustomizeIcon color="primary" />
                    Module & Algorithmen-Status
                </Typography>
            </AccordionSummary>
            <AccordionDetails>
                {(() => {
                    const devices: any[] = native?.devices || [];
                    const hallwayCount  = devices.filter((d: any) => d.isHallway).length;
                    const bathroomCount = devices.filter((d: any) => d.isBathroomSensor).length;
                    const nightCount    = devices.filter((d: any) => d.isNightSensor).length;
                    const hasGemini     = !!(native?.geminiApiKey && native.geminiApiKey.length > 5);
                    const hasPushover   = !!native?.notifyPushoverEnabled;
                    const briefingOk    = !!(native?.briefingEnabled && hasPushover);
                    const weeklyOk      = !!(native?.weeklyBriefingEnabled && hasPushover);
                    const inactivityOn  = native?.inactivityMonitoringEnabled !== false;
                    const useCalendar   = !!native?.useCalendar;
                    const useWeather    = !!native?.useWeather;
                    const infrasoundOn  = !!native?.infrasoundEnabled;
                    const pwaEnabled    = !!native?.pwaEnabled;

                    type Status = "ok" | "warn" | "error" | "disabled" | "planned" | "observe";
                    type Tier = "free" | "pro";

                    const STATUS_CFG: Record<Status, { icon: string; color: string; chip: string; chipColor: "success"|"warning"|"error"|"info"|"default" }> = {
                        ok:       { icon: "✅", color: "#4caf50", chip: "Aktiv",        chipColor: "success" },
                        warn:     { icon: "⚠️", color: "#ff9800", chip: "Warnung",      chipColor: "warning" },
                        observe:  { icon: "👁", color: "#90caf9", chip: "Beobachtung", chipColor: "info"    },
                        error:    { icon: "❌", color: "#f44336", chip: "Fehler",       chipColor: "error"   },
                        disabled: { icon: "⚪", color: "#757575", chip: "Inaktiv",      chipColor: "default" },
                        planned:  { icon: "🔬", color: "#90caf9", chip: "Geplant",     chipColor: "info"    },
                    };

                    const ModRow = ({ status, tier, label, version, detail, tooltip }: {
                        status: Status; tier: Tier; label: string; version: string; detail: string; tooltip?: string;
                    }) => {
                        const cfg = STATUS_CFG[status];
                        const chip = (
                            <Chip label={cfg.chip} color={cfg.chipColor} size="small" variant="outlined"
                                sx={{ fontSize: "0.62rem", height: 18, minWidth: 72 }} />
                        );
                        return (
                            <Box sx={{ display: "flex", alignItems: "center", py: 0.6, borderBottom: "1px solid", borderColor: "divider", gap: 0.5 }}>
                                <Typography sx={{ fontSize: "0.85rem", mr: 0.5, flexShrink: 0 }}>{cfg.icon}</Typography>
                                <Typography variant="body2" sx={{ flex: "0 0 195px", fontWeight: 500, fontSize: "0.78rem", lineHeight: 1.2 }}>{label}</Typography>
                                <Typography variant="caption" sx={{ flex: "0 0 52px", color: "#888", fontSize: "0.6rem" }}>{version}</Typography>
                                <Typography variant="caption" sx={{ color: "text.secondary", flex: 1, fontSize: "0.7rem" }}>{detail}</Typography>
                                <Tooltip title={tier === "pro" ? "🔑 Pro-Feature" : "🆓 Kostenlos"} arrow placement="left">
                                    <Typography sx={{ fontSize: "0.75rem", flexShrink: 0, mx: 0.5, cursor: "default" }}>
                                        {tier === "pro" ? "🔑" : "🆓"}
                                    </Typography>
                                </Tooltip>
                                {tooltip ? (
                                    <Tooltip title={tooltip} arrow placement="left" sx={{ maxWidth: 320 }}>
                                        {chip}
                                    </Tooltip>
                                ) : chip}
                            </Box>
                        );
                    };

                    const SectionHeader = ({ color, label, subtitle }: { color: string; label: string; subtitle?: string }) => (
                        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mt: 2.5, mb: 0.5, pb: 0.5, borderBottom: "2px solid " + color }}>
                            <Typography variant="overline" sx={{ color, fontWeight: "bold", letterSpacing: "0.1em", fontSize: "0.7rem", lineHeight: 1 }}>
                                {label}
                            </Typography>
                            {subtitle && <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.62rem" }}>{subtitle}</Typography>}
                        </Box>
                    );

                    return (
                        <Box>
                            <Box sx={{ mb: 1.5, p: 1, bgcolor: isDark ? "#1a1a1a" : "#f5f5f5", borderRadius: 1, display: "flex", gap: 3, flexWrap: "wrap" }}>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>{devices.length} Sensoren · {hallwayCount} Flur · {bathroomCount} Bad · {nightCount} Nacht</Typography>
                                <Typography variant="caption" sx={{ color: hasGemini ? "#4caf50" : "#f44336" }}>Gemini {hasGemini ? "✅" : "❌"}</Typography>
                                <Typography variant="caption" sx={{ color: hasPushover ? "#4caf50" : "#ff9800" }}>Pushover {hasPushover ? "✅" : "⚠"}</Typography>
                            </Box>

                            <SectionHeader color="#ef5350" label="🔴 GESUNDHEIT" subtitle="Health-Säule · Algorithmische Gesundheitsüberwachung" />
                            <ModRow status={devices.length > 0 ? "ok" : "warn"} tier="free" label="Bewegungserkennung (PIR)" version="v0.10"
                                detail={devices.length > 0 ? devices.length + " PIR-Sensoren · keine Lichtschalter/Rollläden" : "Keine Sensoren konfiguriert"}
                                tooltip={devices.length === 0 ? "Keine Bewegungssensoren konfiguriert. Sensoren in Admin → System → Sensoren hinzufügen." : undefined} />
                            <ModRow status={nightCount > 0 ? "ok" : "warn"} tier="free" label="Schlafphasen-Erkennung" version="v0.15"
                                detail={nightCount > 0 ? nightCount + " Nacht-Sensoren · Fenster 22:00–08:00" : "⚠ Nacht-Sensoren fehlen"}
                                tooltip={nightCount === 0 ? "Keine Nacht-Sensoren markiert. Bitte in Admin → Sensoren die Checkbox 🌙 Nacht setzen (z. B. Schlafzimmer)." : undefined} />
                            <ModRow status={devices.length > 0 ? "ok" : "warn"} tier="free" label="Aktivitäts-Aggregation" version="v0.20"
                                detail="Event-Zählung pro Raum · Basis aller Langzeit-Charts" />
                            <ModRow status={devices.length > 0 ? "ok" : "warn"} tier="free" label="Aktivitäts-Normalisierung" version="v0.30.74"
                                detail="Persönl. Median · 14-Tage-Baseline · 0–200 % Anzeige" />
                            <ModRow status={bathroomCount > 0 ? "ok" : "warn"} tier="free" label="Bad-Nutzungsdauer" version="v0.28"
                                detail={bathroomCount > 0 ? bathroomCount + " Bad-Sensoren · Aufenthaltsdauer in Minuten" : "⚠ Bad-Sensoren fehlen"}
                                tooltip={bathroomCount === 0 ? "Keine Bad-Sensoren markiert. Bitte in Admin → Sensoren die Checkbox 🚿 Bad setzen." : undefined} />
                            <ModRow status={devices.length > 0 ? "ok" : "warn"} tier="free" label="Frischluft-Erkennung" version="v0.28"
                                detail="Türkontakt-Sensoren (type=door) · Öffnungen zählen" />
                            <ModRow status={hallwayCount > 0 ? "ok" : "warn"} tier="pro" label="Ganggeschwindigkeit" version="v0.28"
                                detail={hallwayCount > 0 ? hallwayCount + " Flur-Sensoren · Transit-Zeit in Sekunden (Median)" : "⚠ Flur-Sensoren fehlen"}
                                tooltip={hallwayCount === 0 ? "Keine Flur-Sensoren markiert. Bitte in Admin → Sensoren die Checkbox 🚶 Flur setzen." : undefined} />
                            <ModRow status={devices.length > 0 ? "ok" : "warn"} tier="pro" label="Langzeit-Trendanalyse" version="v0.30.60"
                                detail="Lineare Regression · Garmin-Style Charts · 7/30/180 Tage" />
                            <ModRow status={hasGemini ? "ok" : "error"} tier="pro" label="KI-Tagesbericht (Gemini)" version="v0.29"
                                detail={hasGemini ? "Gemini Flash · Fließtext · täglich 23:59" : "Kein Gemini API-Key"}
                                tooltip={!hasGemini ? "Kein Gemini API-Key konfiguriert. In Admin → System → Lizenz & KI-Verbindung eintragen." : undefined} />
                            <ModRow status={hasGemini ? "ok" : "error"} tier="pro" label="KI-Nachtbericht (Gemini)" version="v0.29"
                                detail={hasGemini ? "Gemini Flash · Schlaf-Zusammenfassung · 06:00" : "Kein Gemini API-Key"}
                                tooltip={!hasGemini ? "Kein Gemini API-Key konfiguriert." : undefined} />
                            <ModRow status={hasGemini ? "ok" : "error"} tier="pro" label="Baseline-Drift (LLM)" version="v0.30.60"
                                detail={hasGemini ? "Gemini · LTB vs. STB Vergleich · Text-Badge" : "Kein API-Key"}
                                tooltip={!hasGemini ? "Kein Gemini API-Key konfiguriert." : undefined} />
                            <ModRow status="observe" tier="pro" label="Graduelle Drift-Erkennung (PH-Test)" version="v0.30.74"
                                detail="4 Metriken · Page-Hinkley-Test · Kalibrierungsphase"
                                tooltip="Der Algorithmus läuft, sammelt aber noch Daten für seine persönliche Baseline. Mindestens 10 Tage benötigt. Alarme werden erst nach vollständiger Kalibrierung ausgelöst." />
                            <ModRow status="planned" tier="pro" label="Zirkadiane Rhythmus-Analyse" version="–"
                                detail="Fourier-Analyse · Schlaf-/Wach-Verschiebung · Demenz-Frühwarnung" />
                            <ModRow status="planned" tier="pro" label="Rolladen-/Licht-Muster" version="–"
                                detail="Rolladen runter = Schlafenszeit · Lichtschalter als Aktivitäts-Signal" />

                            <SectionHeader color="#66bb6a" label="🟢 SICHERHEIT" subtitle="Security-Säule · Anomalie-Erkennung & Alarme" />
                            <ModRow status="warn" tier="pro" label="Tages-Anomalie (IsolationForest)" version="v0.25"
                                detail="96-Dim Vektor · Auto-Training ab 7 Digests · täglich"
                                tooltip="IsolationForest benötigt mindestens 7 Tages-Digests zum ersten Training. Das Auto-Training läuft automatisch nächtlich. Warnung verschwindet sobald das Modell trainiert ist." />
                            <ModRow status="warn" tier="pro" label="Nacht-Anomalie (IsolationForest)" version="v0.25"
                                detail="20-Dim Nacht-Slots · personalisiert auf Schlaf-History"
                                tooltip="Wie Tages-Anomalie: Auto-Training ab 7 Nacht-Digests. Danach lernt das Modell den persönlichen Schlaf-Rhythmus." />
                            <ModRow status={inactivityOn ? "ok" : "disabled"} tier="free" label="Inaktivitäts-Alarm (Dead Man)" version="v0.30"
                                detail={inactivityOn ? "Stille-Erkennung · Gelb >" + (native?.inactivityThresholdHours || 4) + "h · Rot >8h" : "Deaktiviert in Einstellungen"} />
                            <ModRow status={infrasoundOn ? "ok" : "disabled"} tier="pro" label="Infraschall-Sensor" version="v0.30"
                                detail={infrasoundOn ? "Aktiv · physikalischer Sensor verbunden" : "Deaktiviert · optionaler Hardware-Sensor"}
                                tooltip={!infrasoundOn ? "Infraschall ist ein optionaler Hardwaresensor. Aktivierung in Admin → System → Einstellungen." : undefined} />
                            <ModRow status="planned" tier="pro" label="LSTM Sequenz-Vorhersage" version="–"
                                detail="„Um 07:30 erwarte ich Küche“ · zeitlich bewusste Anomalie-Erkennung" />

                            <SectionHeader color="#42a5f5" label="🔵 KOMFORT" subtitle="Comfort-Säule · Neuro-Symbolische Hausautomation" />
                            <ModRow status="warn" tier="pro" label="Muster-Erkennung („Der Butler“)" version="v0.30"
                                detail="Aktivitäts-Muster lernen · Automatisierungsvorschläge"
                                tooltip="Das System lernt wiederkehrende Verhaltensmuster (z.B. täglich 7:30 Uhr Licht Wohnzimmer). Warnung = noch nicht genügend Wiederholungen zum sicheren Ableiten von Regeln." />
                            <ModRow status="warn" tier="pro" label="Neuro-Symbolische Automatisierung" version="v0.30"
                                detail="Regeln aus Mustern · nur bei hoher Konfidenz ausgeführt"
                                tooltip="Automatisierungen werden erst ausgeführt wenn die Konfidenz über dem Schwellwert liegt. Warnung = Lernphase läuft noch." />
                            <ModRow status="planned" tier="pro" label="Kalender-Kontext" version="–"
                                detail="Feiertage, Besuch, Jahreszeit — weniger Fehlalarme"
                                tooltip="Nicht implementiert. Wenn aktiv: Kalendereinträge werden als Kontext für alle Algorithmen genutzt." />

                            <SectionHeader color="#ffa726" label="🟠 ENERGIE" subtitle="Energy-Säule · Prädiktive Thermostat-Steuerung" />
                            <ModRow status="ok" tier="pro" label="Thermodynamik-Modell" version="v0.30"
                                detail="dT/dt Gleichung · physikalisches Gebäude-Modell" />
                            <ModRow status="ok" tier="pro" label="PINN Energie-Vorhersage" version="v0.30"
                                detail="Neural Network · MPC statt PID · prädiktive Steuerung" />
                            <ModRow status={useWeather ? "ok" : "disabled"} tier="pro" label="Wetter-Integration" version="v0.30"
                                detail={useWeather ? "Außentemperatur-Referenz · aktiv" : "Deaktiviert · in Einstellungen aktivierbar"}
                                tooltip={!useWeather ? "Wetterintegration deaktiviert. Aktivierung in Admin → System → Einstellungen." : undefined} />
                            <ModRow status={useCalendar ? "ok" : "disabled"} tier="pro" label="Kalender-Vorlaufsteuerung" version="v0.30"
                                detail={useCalendar ? "Kalender-Events · Vorlauf-Heizung aktiv" : "Deaktiviert · in Einstellungen aktivierbar"}
                                tooltip={!useCalendar ? "Kalenderintegration deaktiviert. Aktivierung in Admin → System → Einstellungen." : undefined} />

                            <SectionHeader color="#9c27b0" label="🔔 BERICHTE & BENACHRICHTIGUNGEN" subtitle="Pushover · Gemini-Zusammenfassungen" />
                            <ModRow status={briefingOk ? "ok" : !hasPushover ? "warn" : "disabled"} tier="pro" label="Morgenbriefing (Pushover)" version="–"
                                detail={briefingOk ? "Aktiv · " + (native?.briefingTime || "08:00") + " Uhr" : hasPushover ? "Deaktiviert in Einstellungen" : "Pushover nicht konfiguriert"}
                                tooltip={!hasPushover ? "Pushover ist nicht aktiviert. In Admin → System → Benachrichtigungen konfigurieren." : undefined} />
                            <ModRow status={weeklyOk ? "ok" : !hasPushover ? "warn" : "disabled"} tier="pro" label="Wochenbericht (Pushover)" version="–"
                                detail={weeklyOk ? "Aktiv · Sonntag " + (native?.weeklyBriefingTime || "09:00") + " Uhr" : hasPushover ? "Deaktiviert in Einstellungen" : "Pushover nicht konfiguriert"}
                                tooltip={!hasPushover ? "Pushover ist nicht aktiviert." : undefined} />
                            <ModRow status={pwaEnabled ? "ok" : "disabled"} tier="pro" label="PWA NUUKANNI (Mobil)" version="v0.30"
                                detail={pwaEnabled ? "Aktiv · Cloudflare Tunnel · Zugriff von außen" : "Deaktiviert in Einstellungen"} />
                        </Box>
                    );
                })()}
            </AccordionDetails>
        </Accordion>

        {/* OC-2: Topologie-Matrix — ab v0.33.67 primär hier im System-Tab */}
        <Accordion defaultExpanded={false} sx={{ mt: 1, border: '1px solid rgba(100,100,100,0.2)', borderRadius: '6px !important', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HubIcon sx={{ fontSize: 18, color: '#7b1fa2' }} />
                    <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>Topologie-Matrix & Raum-Adjazenz</Typography>
                    <Chip label="Zentral hier" size="small" sx={{ fontSize: '0.65rem', height: 18, bgcolor: '#7b1fa220', color: '#7b1fa2', border: '1px solid #7b1fa260' }} />
                </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 1 }}>
                <Alert severity="info" sx={{ mb: 1.5, py: 0.4, fontSize: '0.72rem' }}>
                    Die Topologie-Matrix definiert welche Räume benachbart sind. Sie wird für <b>Personenzählung</b>, <b>Ganggeschwindigkeit</b> und die <b>Sicherheits-Anomalieerkennung</b> verwendet. Primäre Konfiguration ab v0.33.67 hier im System-Tab.
                </Alert>
                <TopologyView socket={socket} adapterName={adapterName} instance={instance} themeType={themeType} />
            </AccordionDetails>
        </Accordion>
        </Box>
    );
}