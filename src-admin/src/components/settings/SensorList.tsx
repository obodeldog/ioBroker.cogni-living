import React, { useState, useEffect } from "react";
import {
    Box, TableContainer, Paper, Table, TableHead, TableRow, TableCell, Tooltip, TableBody,
    TextField, IconButton, Autocomplete, FormControl, Select, MenuItem, Checkbox, Button, Chip,
    Collapse, CircularProgress, Alert
} from "@mui/material";
import BatteryAlertIcon from "@mui/icons-material/BatteryAlert";
import Battery20Icon from "@mui/icons-material/Battery20";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import NightsStayIcon from "@mui/icons-material/NightsStay";
import DeleteIcon from "@mui/icons-material/Delete";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import BlockIcon from "@mui/icons-material/Block";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import WatchIcon from "@mui/icons-material/Watch";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { I18n } from "@iobroker/adapter-react-v5";
import { createFilterOptions } from "@mui/material/Autocomplete";

const SENSOR_TYPES = [
    { id: "motion",               label: "Bewegung" },
    { id: "door",                 label: "Tuer/Fenster" },
    { id: "fire",                 label: "Rauch" },
    { id: "temperature",          label: "Temperatur" },
    { id: "light",                label: "Licht" },
    { id: "dimmer",               label: "Dimmer" },
    { id: "blind",                label: "Rollladen" },
    { id: "lock",                 label: "Schloss" },
    { id: "custom",               label: "Sonstiges" },
    { id: "presence_radar_bool",  label: "Praesenz-Radar (Anwesenheit)" },
    { id: "vibration_trigger",    label: "Vibration (Erkannt)" },
    { id: "vibration_strength",   label: "Vibration (Staerke)" },
    { id: "moisture",             label: "Feuchtigkeit/Wasser" },
];

const SENSOR_FUNCTIONS = [
    { id: "",         label: "Allgemein",              color: "inherit",  description: "Keine spezielle Funktion" },
    { id: "hallway",  label: "Flur / Gang",            color: "#8d6e63",  description: "Ganggeschwindigkeits-Analyse" },
    { id: "bathroom", label: "Bad / WC",               color: "#00acc1",  description: "Nykturie-Zaehlung (naechtl. Toilettenbesuche)" },
    { id: "kitchen",  label: "Kueche / Essbereich",    color: "#66bb6a",  description: "Essrhythmus-Analyse (Diabetes T2, Depression)" },
    { id: "bed",      label: "Bett / Schlafzimmer",    color: "#7b1fa2",  description: "Schlafanalyse, Bett-Belegung, Tremor-Erkennung" },
    { id: "living",   label: "Wohnzimmer / Hauptraum", color: "#1976d2",  description: "Sozialisierungs-Analyse" },
];

function getFunctionsForType(type) {
    if (type === "vibration_trigger" || type === "vibration_strength")
        return SENSOR_FUNCTIONS.filter(f => ["", "bed"].includes(f.id));
    if (type === "moisture")
        return SENSOR_FUNCTIONS.filter(f => ["", "bed", "bathroom"].includes(f.id));
    if (type === "temperature")
        return SENSOR_FUNCTIONS.filter(f => f.id === "");
    // motion, door, custom, presence_radar_bool: alle Raumfunktionen erlaubt
    return SENSOR_FUNCTIONS;
}

function getEffectiveSF(device) {
    if (device.sensorFunction !== undefined && device.sensorFunction !== null && device.sensorFunction !== "") {
        return device.sensorFunction;
    }
    if (device.isBathroomSensor) return "bathroom";
    if (device.isKitchenSensor)  return "kitchen";
    if (device.isHallway)        return "hallway";
    if (device.isFP2Bed)         return "bed";
    if (device.isFP2Living)      return "living";
    if (device.isVibrationBed)   return "bed";
    return "";
}

function getSFColor(sfId) {
    const sf = SENSOR_FUNCTIONS.find(f => f.id === sfId);
    return sf ? (sf.color === "inherit" ? "" : sf.color) : "";
}

const filter = createFilterOptions();

const WEARABLE_FIELDS = [
    { key: "garminSleepScoreStateId",  label: "Sleep-Score",           unit: "0–100",   example: "garmin.0.dailysleep.dailySleepDTO.sleepScores.overall.value",        tooltip: "ioBroker-Objekt-ID des Garmin Schlaf-Scores (0–100). Beispiel: garmin.0.dailysleep.dailySleepDTO.sleepScores.overall.value" },
    { key: "garminSleepStartStateId",  label: "Schlafbeginn (GMT-ms)", unit: "Unix-ms", example: "garmin.0.dailysleep.dailySleepDTO.sleepStartTimestampGMT",           tooltip: "ioBroker-Objekt-ID des Schlafbeginn-Timestamps (Unix-Millisekunden, GMT). Beispiel: garmin.0.dailysleep.dailySleepDTO.sleepStartTimestampGMT" },
    { key: "garminSleepEndStateId",    label: "Schlafende (GMT-ms)",   unit: "Unix-ms", example: "garmin.0.dailysleep.dailySleepDTO.sleepEndTimestampGMT",             tooltip: "ioBroker-Objekt-ID des Schlafende-Timestamps (Unix-Millisekunden, GMT). Beispiel: garmin.0.dailysleep.dailySleepDTO.sleepEndTimestampGMT" },
    { key: "garminDeepSleepStateId",   label: "Tiefschlaf (Sekunden)", unit: "sec",     example: "garmin.0.dailysleep.dailySleepDTO.deepSleepSeconds",                tooltip: "ioBroker-Objekt-ID der Tiefschlaf-Dauer in Sekunden. Beispiel: garmin.0.dailysleep.dailySleepDTO.deepSleepSeconds" },
    { key: "garminLightSleepStateId",  label: "Leichtschlaf (Sek.)",   unit: "sec",     example: "garmin.0.dailysleep.dailySleepDTO.lightSleepSeconds",               tooltip: "ioBroker-Objekt-ID der Leichtschlaf-Dauer in Sekunden. Beispiel: garmin.0.dailysleep.dailySleepDTO.lightSleepSeconds" },
    { key: "garminRemSleepStateId",    label: "REM-Schlaf (Sek.)",     unit: "sec",     example: "garmin.0.dailysleep.dailySleepDTO.remSleepSeconds",                 tooltip: "ioBroker-Objekt-ID der REM-Schlaf-Dauer in Sekunden. Beispiel: garmin.0.dailysleep.dailySleepDTO.remSleepSeconds" },
    { key: "garminLastSyncStateId",    label: "Letzter Sync (Timestamp)", unit: "auto", example: "garmin.0.info.connection",                                          tooltip: "ioBroker-Objekt-ID eines Zustands, dessen letztes Update-Datum als Aktualitätsprüfung dient. Wird verwendet um festzustellen ob die Garmin-Verbindung noch aktiv ist. Empfehlung: garmin.0.info.connection oder ein beliebiger garmin.0-Wert der sich täglich ändert." },
];

function FreshnessChip({ stateId, socket, isDark }: { stateId: string; socket: any; isDark: boolean }) {
    const [status, setStatus] = useState<'loading' | 'fresh' | 'stale' | 'old' | 'unknown'>('loading');
    const [ageHours, setAgeHours] = useState<number | null>(null);

    useEffect(() => {
        if (!stateId || !socket) { setStatus('unknown'); return; }
        setStatus('loading');
        socket.getState(stateId).then((state: any) => {
            if (!state || state.ts == null) { setStatus('unknown'); return; }
            const hours = (Date.now() - state.ts) / 3600000;
            setAgeHours(Math.round(hours * 10) / 10);
            if (hours < 12)       setStatus('fresh');
            else if (hours < 30)  setStatus('stale');
            else                  setStatus('old');
        }).catch(() => setStatus('unknown'));
    }, [stateId, socket]);

    if (status === 'loading') return <CircularProgress size={12} sx={{ ml: 0.5 }} />;

    const cfg = {
        fresh:   { icon: <CheckCircleOutlineIcon sx={{ fontSize: 13 }} />, label: `Aktuell (${ageHours}h)`,   color: "#4caf50" },
        stale:   { icon: <WarningAmberIcon        sx={{ fontSize: 13 }} />, label: `Veraltet (${ageHours}h)`, color: "#ff9800" },
        old:     { icon: <ErrorOutlineIcon        sx={{ fontSize: 13 }} />, label: `Eingefroren (${ageHours}h)`, color: "#f44336" },
        unknown: { icon: <HelpOutlineIcon         sx={{ fontSize: 13 }} />, label: "Unbekannt",                color: isDark ? "#888" : "#aaa" },
    };
    const c = cfg[status];
    return (
        <Tooltip title={status === 'unknown' ? "Kein Sync-Objekt konfiguriert oder Objekt nicht erreichbar" : `Letzter Datenpunkt vor ${ageHours}h. Frisch < 12h, Veraltet 12–30h, Eingefroren > 30h.`}>
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.3, ml: 0.5, color: c.color, fontSize: "0.65rem", fontWeight: 600, cursor: "help" }}>
                {c.icon} {c.label}
            </Box>
        </Tooltip>
    );
}

export default function SensorList(props) {
    const { devices, isDark, uniqueLocations, sensorProblems, native, onNativeChange, socket } = props;
    const [wearableOpen, setWearableOpen] = useState(false);
    const [batteryOpen, setBatteryOpen] = useState(false);
    const [testResults, setTestResults] = useState<Record<string, 'loading' | 'ok' | 'error' | null>>({});

    const testStateId = (key: string) => {
        const stateId = (native || {})[key];
        if (!stateId || !socket) return;
        setTestResults(r => ({ ...r, [key]: 'loading' }));
        socket.getState(stateId).then((state: any) => {
            setTestResults(r => ({ ...r, [key]: state != null ? 'ok' : 'error' }));
        }).catch(() => setTestResults(r => ({ ...r, [key]: 'error' })));
    };

    // Berechne welche Funktionen tatsaechlich konfiguriert sind
    const activeFunctions = new Set(
        (devices || []).map(d => getEffectiveSF(d)).filter(Boolean)
    );
    const bg = isDark ? "#1e1e1e" : "#fafafa";
    const stickyBg = isDark ? "#2d2d2d" : "#f0f0f0";
    const fs = "0.73rem";

    return (
        <Box>
            <TableContainer
                component={Paper}
                variant="outlined"
                sx={{ bgcolor: bg, overflowX: "auto", maxHeight: 520 }}
            >
                <Table stickyHeader size="small" sx={{ width: "100%", tableLayout: "fixed" }}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: "17%", bgcolor: stickyBg, fontSize: fs, fontWeight: 600 }}>
                                <Tooltip title="Vollstaendiger ioBroker Objekt-Pfad">
                                    <span style={{ cursor: "help", textDecoration: "underline dotted" }}>Sensor-ID (ioBroker Pfad)</span>
                                </Tooltip>
                            </TableCell>
                            <TableCell sx={{ width: "11%", bgcolor: stickyBg, fontSize: fs, fontWeight: 600 }}>
                                <Tooltip title="Anzeigename des Sensors">
                                    <span style={{ cursor: "help", textDecoration: "underline dotted" }}>Bezeichnung</span>
                                </Tooltip>
                            </TableCell>
                            <TableCell sx={{ width: "12%", bgcolor: stickyBg, fontSize: fs, fontWeight: 600 }}>
                                <Tooltip title="Raum oder Ort des Sensors">
                                    <span style={{ cursor: "help", textDecoration: "underline dotted" }}>Ort (Raum)</span>
                                </Tooltip>
                            </TableCell>
                            <TableCell sx={{ width: "11%", bgcolor: stickyBg, fontSize: fs, fontWeight: 600 }}>
                                <Tooltip title="Bestimmt wie der Sensor ausgewertet wird">
                                    <span style={{ cursor: "help", textDecoration: "underline dotted" }}>Sensor-Typ</span>
                                </Tooltip>
                            </TableCell>
                            <TableCell sx={{ width: "17%", bgcolor: stickyBg, fontSize: fs, fontWeight: 600 }}>
                                <Tooltip title="Legt fest welche Gesundheitsanalysen fuer diesen Sensor aktiviert werden">
                                    <span style={{ cursor: "help", textDecoration: "underline dotted" }}>Funktion / Rolle</span>
                                </Tooltip>
                            </TableCell>
                            <TableCell sx={{ width: "8%", bgcolor: stickyBg, fontSize: fs, fontWeight: 600, px: 0.3 }}>
                                <Tooltip title="Optionaler Personenname (z.B. Rob, Ingrid). Sensoren mit gleichem Namen werden gemeinsam als Einzel-Person analysiert.">
                                    <span style={{ cursor: "help", textDecoration: "underline dotted" }}>Person</span>
                                </Tooltip>
                            </TableCell>

                            <TableCell align="center" sx={{ width: "5%", bgcolor: stickyBg, px: 0.3 }}>
                                <Tooltip title="Suedfenster (Solar-Gain, nur Temp.-Sensoren)"><WbSunnyIcon sx={{ fontSize: 17, opacity: 0.55 }} /></Tooltip>
                            </TableCell>
                            <TableCell align="center" sx={{ width: "5%", bgcolor: stickyBg, px: 0.3 }}>
                                <Tooltip title="Ausgangs-Sensor (fuer Weggeh-Erkennung)"><ExitToAppIcon sx={{ fontSize: 17, opacity: 0.55 }} /></Tooltip>
                            </TableCell>
                            <TableCell align="center" sx={{ width: "5%", bgcolor: stickyBg, px: 0.3 }}>
                                <Tooltip title="Nacht-Sensor: Tagesbeginn ignoriert diesen Raum"><NightsStayIcon sx={{ fontSize: 17, opacity: 0.55 }} /></Tooltip>
                            </TableCell>
                            <TableCell align="center" sx={{ width: "5%", bgcolor: stickyBg, px: 0.3 }}>
                                <Tooltip title="Primärflur: Dieser Flur-Sensor wird als Hauptflur für die Ganggeschwindigkeits-Analyse verwendet. Nur für Sensoren mit Funktion 'Flur/Gang' relevant.">
                                    <span style={{ cursor: "help", fontSize: "0.65rem", fontWeight: 600, color: "#8d6e63" }}>P-Flur</span>
                                </Tooltip>
                            </TableCell>
                            <TableCell align="center" sx={{ width: "5%", bgcolor: stickyBg, px: 0.3, borderLeft: "3px solid rgba(100,100,100,0.55)" }}>
                                <Tooltip title="Aus Health-Timeline ausschliessen (Sensor wird weiter aufgezeichnet, aber nicht in Schlafradar/Neuro-Timeline angezeigt)"><BlockIcon sx={{ fontSize: 17, opacity: 0.55 }} /></Tooltip>
                            </TableCell>
                            <TableCell sx={{ width: "4%", bgcolor: stickyBg }} />
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {devices.map((device, index) => {
                            const effectiveSF = getEffectiveSF(device);
                            const sfColor = getSFColor(effectiveSF);
                            const availableFunctions = getFunctionsForType(device.type);

                            return (
                                <TableRow
                                    key={index}
                                    sx={{ "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" } }}
                                >
                                    {/* Sensor-ID */}
                                    <TableCell sx={{ overflow: "hidden" }}>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                            {sensorProblems && sensorProblems.has && sensorProblems.has(device.id) && (
                                                <Tooltip title={"Sensor nicht erreichbar � zuletzt aktiv vor mehr als Schwellwert"}>
                                                    <WarningAmberIcon sx={{ color: "#ff9800", fontSize: 16, flexShrink: 0 }} />
                                                </Tooltip>
                                            )}
                                            <Tooltip title={device.id || ""} placement="top">
                                                <TextField
                                                    value={device.id}
                                                    onChange={e => props.onDeviceChange(index, "id", e.target.value)}
                                                    size="small" variant="standard"
                                                    inputProps={{ style: { fontSize: fs } }}
                                                    sx={{ flex: 1, minWidth: 0 }}
                                                />
                                            </Tooltip>
                                            <Tooltip title="Objekt aus ioBroker auswaehlen">
                                                <IconButton size="small" onClick={() => props.onSelectId(index)} sx={{ p: 0.3, fontSize: "0.65rem", flexShrink: 0 }}>.</IconButton>
                                            </Tooltip>
                                        </Box>
                                    </TableCell>

                                    {/* Name */}
                                    <TableCell>
                                        <TextField
                                            value={device.name}
                                            onChange={e => props.onDeviceChange(index, "name", e.target.value)}
                                            size="small" variant="standard"
                                            inputProps={{ style: { fontSize: fs } }}
                                            sx={{ width: "100%" }}
                                        />
                                    </TableCell>

                                    {/* Raum/Ort */}
                                    <TableCell>
                                        <Autocomplete
                                            freeSolo
                                            options={uniqueLocations}
                                            value={device.location || ""}
                                            onChange={(_e, v) => props.onDeviceChange(index, "location", v || "")}
                                            onInputChange={(_e, v) => props.onDeviceChange(index, "location", v || "")}
                                            filterOptions={(options, params) => {
                                                const filtered = filter(options, params);
                                                if (params.inputValue !== "" && !options.includes(params.inputValue)) {
                                                    filtered.push(params.inputValue);
                                                }
                                                return filtered;
                                            }}
                                            renderInput={params => (
                                                <TextField {...params} size="small" variant="standard"
                                                    inputProps={{ ...params.inputProps, style: { fontSize: fs } }}
                                                />
                                            )}
                                            ListboxProps={{ style: { fontSize: fs } }}
                                            sx={{ width: "100%" }}
                                            disableClearable
                                        />
                                    </TableCell>

                                    {/* Sensor-Typ */}
                                    <TableCell>
                                        <FormControl size="small" variant="standard" sx={{ width: "100%" }}>
                                            <Select
                                                value={device.type || "motion"}
                                                onChange={e => {
                                                    props.onDeviceChange(index, "type", e.target.value);
                                                    const newFns = getFunctionsForType(e.target.value);
                                                    if (effectiveSF && !newFns.some(f => f.id === effectiveSF)) {
                                                        props.onDeviceChange(index, "sensorFunction", "");
                                                    }
                                                }}
                                                sx={{ fontSize: fs }}
                                            >
                                                {SENSOR_TYPES.map(t => (
                                                    <MenuItem key={t.id} value={t.id} sx={{ fontSize: "0.75rem" }}>{t.label}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </TableCell>

                                    {/* Sensor-Funktion */}
                                    <TableCell>
                                        <Tooltip
                                            title={effectiveSF ? (SENSOR_FUNCTIONS.find(f => f.id === effectiveSF)?.description || "") : "Keine spezielle Gesundheitsanalyse"}
                                            placement="top"
                                        >
                                            <FormControl size="small" variant="standard" sx={{ width: "100%" }}>
                                                <Select
                                                    value={effectiveSF}
                                                    onChange={e => props.onDeviceChange(index, "sensorFunction", e.target.value)}
                                                    displayEmpty
                                                    sx={{
                                                        fontSize: fs,
                                                        "& .MuiSelect-select": {
                                                            color: sfColor || "inherit",
                                                            fontWeight: effectiveSF ? 600 : 400,
                                                        }
                                                    }}
                                                >
                                                    {availableFunctions.map(f => (
                                                        <MenuItem
                                                            key={f.id}
                                                            value={f.id}
                                                            sx={{
                                                                fontSize: "0.75rem",
                                                                color: f.color === "inherit" ? "inherit" : f.color,
                                                                fontWeight: f.id ? 500 : 400,
                                                            }}
                                                        >
                                                            {f.label}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Tooltip>
                                    </TableCell>

                                    {/* Person-Tag */}
                                    <TableCell sx={{ px: 0.5 }}>
                                        <TextField
                                            size="small"
                                            value={device.personTag || ""}
                                            placeholder="Person..."
                                            title="Personenname f�r individuelle Nacht-Analyse (z.B. Rob)"
                                            sx={{ width: "100%", "& input": { fontSize: "0.7rem", p: "3px 6px" } }}
                                            onChange={e => props.onDeviceChange(index, "personTag", e.target.value)}
                                        />
                                    </TableCell>

                                    {/* Solar */}
                                    <TableCell align="center" sx={{ px: 0.3 }}>
                                        {device.type === "temperature" ? (
                                            <Tooltip title="Solar-relevant (Suedfenster)">
                                                <Checkbox
                                                    checked={device.isSolar || false}
                                                    onChange={e => props.onDeviceChange(index, "isSolar", e.target.checked)}
                                                    size="small" sx={{ p: 0.4 }}
                                                    icon={<WbSunnyIcon sx={{ fontSize: 17, opacity: 0.2 }} />}
                                                    checkedIcon={<WbSunnyIcon sx={{ fontSize: 17, color: "#ff9800" }} />}
                                                />
                                            </Tooltip>
                                        ) : <Box sx={{ width: 30 }} />}
                                    </TableCell>

                                    {/* Ausgang */}
                                    <TableCell align="center" sx={{ px: 0.3 }}>
                                        <Tooltip title="Ausgangs-Sensor">
                                            <Checkbox
                                                checked={device.isExit || false}
                                                onChange={e => props.onDeviceChange(index, "isExit", e.target.checked)}
                                                size="small" sx={{ p: 0.4 }}
                                                icon={<ExitToAppIcon sx={{ fontSize: 17, opacity: 0.2 }} />}
                                                checkedIcon={<ExitToAppIcon sx={{ fontSize: 17, color: "#26a69a" }} />}
                                            />
                                        </Tooltip>
                                    </TableCell>

                                    {/* Nacht */}
                                    <TableCell align="center" sx={{ px: 0.3 }}>
                                        <Tooltip title="Nacht-Sensor: Raum wird bei Tagesbeginn ignoriert">
                                            <Checkbox
                                                checked={device.isNightSensor || false}
                                                onChange={e => props.onDeviceChange(index, "isNightSensor", e.target.checked)}
                                                size="small" sx={{ p: 0.4 }}
                                                icon={<NightsStayIcon sx={{ fontSize: 17, opacity: 0.2 }} />}
                                                checkedIcon={<NightsStayIcon sx={{ fontSize: 17, color: "#5c6bc0" }} />}
                                            />
                                        </Tooltip>
                                    </TableCell>

                                    {/* Primärflur */}
                                    <TableCell align="center" sx={{ px: 0.3 }}>
                                        {effectiveSF === 'hallway' ? (
                                            <Tooltip title="Als Primärflur für Ganggeschwindigkeit verwenden (nur ein Flur aktiv nötig)">
                                                <Checkbox
                                                    checked={device.isPrimaryHallway || false}
                                                    onChange={e => props.onDeviceChange(index, "isPrimaryHallway", e.target.checked)}
                                                    size="small" sx={{ p: 0.4 }}
                                                    icon={<span style={{ fontSize: 14, opacity: 0.2 }}>🚶</span>}
                                                    checkedIcon={<span style={{ fontSize: 14, color: "#8d6e63" }}>🚶</span>}
                                                />
                                            </Tooltip>
                                        ) : <Box sx={{ width: 30 }} />}
                                    </TableCell>

                                    {/* Aus Timeline ausschliessen */}
                                    <TableCell align="center" sx={{ px: 0.3, borderLeft: "3px solid rgba(100,100,100,0.4)" }}>
                                        <Tooltip title="Aus Health-Timeline ausschliessen: Sensor wird aufgezeichnet, aber NICHT in Schlafradar/Neuro-Timeline dargestellt">
                                            <Checkbox
                                                checked={device.excludeFromActivity || false}
                                                onChange={e => props.onDeviceChange(index, "excludeFromActivity", e.target.checked)}
                                                size="small" sx={{ p: 0.4 }}
                                                icon={<BlockIcon sx={{ fontSize: 17, opacity: 0.2 }} />}
                                                checkedIcon={<BlockIcon sx={{ fontSize: 17, color: "#ef5350" }} />}
                                            />
                                        </Tooltip>
                                    </TableCell>

                                    {/* Loeschen */}
                                    <TableCell align="center" sx={{ px: 0.3 }}>
                                        <Tooltip title="Sensor entfernen">
                                            <IconButton size="small" onClick={() => props.onDelete(index)} color="error" sx={{ p: 0.3 }}>
                                                <DeleteIcon sx={{ fontSize: 15 }} />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {devices.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={10} align="center" sx={{ py: 3, color: "text.secondary", fontStyle: "italic", fontSize: fs }}>
                                    Keine Sensoren konfiguriert. Klicke auf "Auto-Discovery" oder "[+] NEU".
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Capability-Legende */}
            <Box sx={{ mt: 1.5, mb: 0.3, display: "flex", gap: 0.8, flexWrap: "wrap", alignItems: "center" }}>
                <Box sx={{ fontSize: "0.68rem", color: "text.secondary", mr: 0.5, flexShrink: 0 }}>Analysen:</Box>
                {SENSOR_FUNCTIONS.filter(f => f.id).map(f => {
                    const isActive = activeFunctions.has(f.id);
                    return (
                        <Tooltip key={f.id} title={`${f.description}${isActive ? " � konfiguriert" : " � noch kein Sensor zugewiesen"}`} placement="top">
                            <Chip
                                label={`${isActive ? "? " : ""}${f.label}`}
                                size="small"
                                sx={{
                                    fontSize: "0.63rem",
                                    height: 20,
                                    bgcolor: isActive ? f.color + "28" : "transparent",
                                    color: isActive ? f.color : "text.disabled",
                                    border: isActive ? `2px solid ${f.color}` : `1px dashed ${f.color}55`,
                                    fontWeight: isActive ? 700 : 400,
                                    opacity: isActive ? 1 : 0.55,
                                    "& .MuiChip-label": { px: 0.8 }
                                }}
                            />
                        </Tooltip>
                    );
                })}
            </Box>
            {/* Hinweiszeile */}
            <Box sx={{ mb: 0.5, fontSize: "0.62rem", color: "text.disabled", fontStyle: "italic" }}>
                ? Farbe + dicker Rahmen = mindestens 1 Sensor mit dieser Funktion aktiv � gestrichelt = noch kein Sensor zugewiesen � Tooltip zeigt Details
            </Box>

            <Box sx={{ display: "flex", gap: 2, mt: 1.5, justifyContent: "space-between", alignItems: "center" }}>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    <Button variant="contained" color="secondary" onClick={props.onWizard} size="small">Auto-Discovery</Button>
                    <Button variant="outlined" onClick={props.onBulk} size="small" startIcon={<PlaylistAddIcon />}>Massen-Add</Button>
                    <Button variant="outlined" onClick={props.onAdd} size="small">[+] NEU</Button>
                </Box>
                {devices.length > 0 && (
                    <Button color="error" size="small" onClick={props.onDeleteAll}>Alle loeschen</Button>
                )}
            </Box>

            {/* ─── WEARABLE-DATENQUELLEN ─── */}
            <Box sx={{ mt: 2, border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)"}`, borderRadius: 1 }}>
                <Box
                    onClick={() => setWearableOpen(o => !o)}
                    sx={{
                        display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.8,
                        cursor: "pointer", userSelect: "none",
                        bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                        borderRadius: wearableOpen ? "4px 4px 0 0" : 1,
                        "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)" }
                    }}
                >
                    <WatchIcon sx={{ fontSize: 16, opacity: 0.7 }} />
                    <Box sx={{ fontSize: "0.78rem", fontWeight: 600, flex: 1 }}>
                        Wearable-Datenquellen (Smartwatch / Garmin)
                    </Box>
                    {/* Freshness-Indikator in der Titelzeile wenn Sync-Objekt konfiguriert */}
                    {(native || {}).garminLastSyncStateId && (
                        <FreshnessChip stateId={(native || {}).garminLastSyncStateId} socket={socket} isDark={isDark} />
                    )}
                    {wearableOpen ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                </Box>
                <Collapse in={wearableOpen}>
                    <Box sx={{ px: 1.5, py: 1, borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}` }}>
                        <Box sx={{ fontSize: "0.67rem", color: "text.secondary", mb: 1.2, lineHeight: 1.5 }}>
                            Trage hier die ioBroker-Objekt-IDs deines Garmin- (oder anderen) Adapters ein.
                            Die Werte werden nur lesend verwendet. Lasse Felder leer wenn kein Adapter installiert ist.
                            Das Feld <b>Letzter Sync</b> dient der Aktualitätsprüfung — wird als veraltet markiert wenn
                            der Wert &gt;&nbsp;12&nbsp;h alt ist (Hinweis auf unterbrochene Garmin&nbsp;Connect Verbindung).
                        </Box>
                        {WEARABLE_FIELDS.map(f => {
                            const val = (native || {})[f.key] || "";
                            const testRes = testResults[f.key];
                            const isLastSync = f.key === "garminLastSyncStateId";
                            return (
                                <Box key={f.key} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.8 }}>
                                    <Tooltip title={f.tooltip} placement="top-start">
                                        <TextField
                                            label={f.label}
                                            value={val}
                                            onChange={e => onNativeChange && onNativeChange(f.key, e.target.value)}
                                            size="small"
                                            variant="outlined"
                                            fullWidth
                                            placeholder={f.example}
                                            sx={{ "& .MuiInputBase-input": { fontSize: "0.72rem" }, "& .MuiInputLabel-root": { fontSize: "0.72rem" } }}
                                            InputProps={{
                                                endAdornment: isLastSync && val && socket ? (
                                                    <FreshnessChip stateId={val} socket={socket} isDark={isDark} />
                                                ) : undefined
                                            }}
                                        />
                                    </Tooltip>
                                    <Tooltip title={val ? "Objekt-Erreichbarkeit testen" : "Zuerst ID eintragen"}>
                                        <span>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                disabled={!val || !socket || testRes === 'loading'}
                                                onClick={() => testStateId(f.key)}
                                                sx={{ minWidth: 56, fontSize: "0.65rem", whiteSpace: "nowrap",
                                                    borderColor: testRes === 'ok' ? "#4caf50" : testRes === 'error' ? "#f44336" : undefined,
                                                    color:       testRes === 'ok' ? "#4caf50" : testRes === 'error' ? "#f44336" : undefined,
                                                }}
                                            >
                                                {testRes === 'loading' ? <CircularProgress size={12} /> :
                                                 testRes === 'ok'      ? "✓ OK" :
                                                 testRes === 'error'   ? "✗ Fehler" : "Testen"}
                                            </Button>
                                        </span>
                                    </Tooltip>
                                </Box>
                            );
                        })}
                        <Box sx={{ mt: 1, fontSize: "0.62rem", color: "text.disabled", fontStyle: "italic" }}>
                            Andere Smartwatch-Adapter (Polar, Withings, Fitbit …) können ebenfalls eingetragen werden —
                            solange die Objekte numerische Werte und Unix-ms-Timestamps liefern.
                        </Box>

                        {/* Garmin pro Person (Mehrpersonenhaushalt) */}
                        {(() => {
                            const persons = Array.from(new Set(
                                (native?.devices || [])
                                    .map((d: any) => (d.personTag || '').trim())
                                    .filter((p: string) => p.length > 0)
                            )) as string[];
                            if (persons.length < 2) return null;
                            const assignment: Record<string, string> = (native?.garminPersonAssignment && typeof native.garminPersonAssignment === 'object')
                                ? native.garminPersonAssignment : {};
                            return (
                                <Box sx={{ mt: 1.5, pt: 1, borderTop: `1px dashed ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}` }}>
                                    <Box sx={{ fontSize: "0.7rem", fontWeight: 600, mb: 0.8, color: isDark ? '#90caf9' : '#1565c0' }}>
                                        👤 Smartwatch pro Person (Mehrpersonenhaushalt)
                                    </Box>
                                    <Box sx={{ fontSize: "0.65rem", color: "text.secondary", mb: 1, lineHeight: 1.5 }}>
                                        Trage den Adapter-Präfix (z.B. <code>garmin.0</code> oder <code>garmin.1</code>) für jede Person ein.
                                        Der Adapter muss dieselbe Objektstruktur wie der Standard-Garmin-Adapter verwenden.
                                    </Box>
                                    {persons.map((person: string) => {
                                        const val = assignment[person] || '';
                                        return (
                                            <Box key={person} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.7 }}>
                                                <Typography variant="caption" sx={{ flex: '0 0 80px', fontWeight: 500, fontSize: '0.72rem', color: 'text.secondary' }}>
                                                    {person}
                                                </Typography>
                                                <TextField
                                                    label={`Garmin-Präfix für ${person}`}
                                                    value={val}
                                                    onChange={e => {
                                                        const newAssign = { ...assignment, [person]: e.target.value };
                                                        if (!e.target.value) delete newAssign[person];
                                                        onNativeChange && onNativeChange('garminPersonAssignment', newAssign);
                                                    }}
                                                    size="small"
                                                    variant="outlined"
                                                    fullWidth
                                                    placeholder="garmin.0"
                                                    sx={{ "& .MuiInputBase-input": { fontSize: "0.72rem" }, "& .MuiInputLabel-root": { fontSize: "0.72rem" } }}
                                                />
                                            </Box>
                                        );
                                    })}
                                </Box>
                            );
                        })()}
                    </Box>
                </Collapse>
            </Box>

            {/* ─── BATTERIE-KONFIGURATION (OC-15) ─── */}
            {(() => {
                const WIRED = ['knx.', 'loxone.', 'bacnet.', 'modbus.'];
                const BATT_TYPES = ['motion', 'vibration', 'vibration_trigger', 'vibration_strength', 'presence_radar', 'presence_radar_bool', 'moisture', 'door', 'temperature'];
                const battDevices = (devices || []).filter(d =>
                    d.id &&
                    !WIRED.some(p => d.id.toLowerCase().startsWith(p)) &&
                    BATT_TYPES.includes(d.type || 'motion')
                );
                if (battDevices.length === 0) return null;
                return (
                    <Box sx={{ mt: 2, border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)"}`, borderRadius: 1 }}>
                        <Box
                            onClick={() => setBatteryOpen(o => !o)}
                            sx={{
                                display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.8,
                                cursor: "pointer", userSelect: "none",
                                bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                                borderRadius: batteryOpen ? "4px 4px 0 0" : 1,
                                "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)" }
                            }}
                        >
                            <Battery20Icon sx={{ fontSize: 16, opacity: 0.7, color: "#ff9800" }} />
                            <Box sx={{ fontSize: "0.78rem", fontWeight: 600, flex: 1 }}>
                                Batterie-Konfiguration (OC-15) — {battDevices.length} Sensor{battDevices.length !== 1 ? "en" : ""}
                            </Box>
                            {batteryOpen ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                        </Box>
                        <Collapse in={batteryOpen}>
                            <Box sx={{ px: 1.5, py: 1, borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}` }}>
                                <Alert severity="info" icon={<BatteryAlertIcon />} sx={{ mb: 1.5, py: 0.3, fontSize: "0.72rem" }}>
                                    <b>Auto-Discovery</b> versucht automatisch einen Battery-State zu finden (auch bei Alias-Objekten). Nur eintragen wenn Auto-Discovery fehlschlägt.
                                    Kabel­gebundene Sensoren (KNX, Loxone) werden automatisch übersprungen.
                                    Schwellen: ≤ 20 % = Warnung · ≤ 10 % = Kritisch + Pushover täglich 09:00 Uhr.
                                </Alert>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 600, fontSize: "0.7rem", width: "35%" }}>Sensor</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: "0.7rem", width: "20%" }}>Ort</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: "0.7rem" }}>
                                                <Tooltip title="Optionaler ioBroker-Objekt-Pfad für den Batterie-State. Leer lassen für Auto-Discovery. Beispiel: zigbee.0.00158d0001234567.battery">
                                                    <span style={{ cursor: "help", textDecoration: "underline dotted" }}>Batterie-State-ID (optional, manuell)</span>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {battDevices.map((device) => {
                                            const idx = (devices || []).indexOf(device);
                                            const discoveredEntry = (props.batteryStatus?.sensors || []).find(s => s.id === device.id);
                                            const discoveredId = discoveredEntry?.stateId || null;
                                            const discoveredLevel = discoveredEntry?.level ?? null;
                                            // Boolean-Quellen (LOWBAT): level=5 → "Niedrig!", level=80 → "OK"
                                            // Echte Prozentwerte: "97%"
                                            const isLowbatBool = discoveredLevel === 5 || discoveredLevel === 80;
                                            const battLevel = discoveredEntry
                                                ? isLowbatBool
                                                    ? (discoveredLevel === 5 ? "Niedrig!" : "OK")
                                                    : `${discoveredLevel ?? "?"}%`
                                                : null;
                                            const battColor = discoveredEntry?.isCritical ? "#f44336" : discoveredEntry?.isLow ? "#ff9800" : "#4caf50";
                                            return (
                                                <TableRow key={device.id} sx={{ "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" } }}>
                                                    <TableCell sx={{ fontSize: "0.7rem" }}>
                                                        <Tooltip title={device.id}><span style={{ cursor: "help" }}>{device.name || device.id}</span></Tooltip>
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: "0.7rem", color: "text.secondary" }}>{device.location || "—"}</TableCell>
                                                    <TableCell>
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                            <Box sx={{ flex: 1 }}>
                                                                <TextField
                                                                    size="small"
                                                                    value={device.batteryStateId || ""}
                                                                    placeholder={discoveredId ? `Auto: ${discoveredId}` : "Auto (leer lassen)"}
                                                                    onChange={e => props.onDeviceChange(idx, "batteryStateId", e.target.value)}
                                                                    sx={{ width: "100%", "& input": { fontSize: "0.7rem", p: "3px 6px" } }}
                                                                />
                                                                {discoveredId && !device.batteryStateId && (
                                                                    <Box sx={{ fontSize: "0.62rem", color: "text.secondary", mt: 0.2, display: "flex", alignItems: "center", gap: 0.5 }}>
                                                                        <span style={{ color: "#4caf50" }}>✓</span>
                                                                        <Tooltip title={`Auto-Discovery (${discoveredEntry?.source === 'hm-auto' ? 'Homematic Kanal-0' : discoveredEntry?.source === 'alias' ? 'Alias-Rekonstruktion' : 'Zigbee/direkt'}): ${discoveredId}`}>
                                                                            <span style={{ cursor: "help", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: 220, display: "inline-block" }}>
                                                                                {discoveredId}
                                                                            </span>
                                                                        </Tooltip>
                                                                        {battLevel && (
                                                                            <span style={{ color: battColor, fontWeight: 600, flexShrink: 0 }}>
                                                                                · {battLevel}
                                                                            </span>
                                                                        )}
                                                                    </Box>
                                                                )}
                                                            </Box>
                                                            <Tooltip title="Objekt aus ioBroker auswählen">
                                                                <IconButton size="small" onClick={() => props.onSelectBatteryId && props.onSelectBatteryId(idx)} sx={{ p: 0.3, fontSize: "0.65rem", flexShrink: 0 }}>.</IconButton>
                                                            </Tooltip>
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </Box>
                        </Collapse>
                    </Box>
                );
            })()}
        </Box>
    );
}

