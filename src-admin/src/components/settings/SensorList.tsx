import React from "react";
import {
    Box, TableContainer, Paper, Table, TableHead, TableRow, TableCell, Tooltip, TableBody,
    TextField, IconButton, Autocomplete, FormControl, Select, MenuItem, Checkbox, Button, Chip
} from "@mui/material";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import NightsStayIcon from "@mui/icons-material/NightsStay";
import DeleteIcon from "@mui/icons-material/Delete";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import RepeatIcon from "@mui/icons-material/Repeat";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { I18n } from "@iobroker/adapter-react-v5";
import { createFilterOptions } from "@mui/material/Autocomplete";

const SENSOR_TYPES = [
    { id: "motion",         label: "Bewegung" },
    { id: "door",           label: "Tuer/Fenster" },
    { id: "fire",           label: "Rauch" },
    { id: "temperature",    label: "Temperatur" },
    { id: "light",          label: "Licht" },
    { id: "dimmer",         label: "Dimmer" },
    { id: "blind",          label: "Rollladen" },
    { id: "lock",           label: "Schloss" },
    { id: "custom",         label: "Sonstiges" },
    { id: "presence_radar", label: "Praesenz-Radar (FP2)" },
    { id: "vibration",      label: "Vibration" },
    { id: "moisture",       label: "Feuchtigkeit/Wasser" },
];

const SENSOR_FUNCTIONS = [
    { id: "",         label: "Allgemein",              color: "inherit",  description: "Keine spezielle Funktion" },
    { id: "hallway",  label: "Flur / Gang",            color: "#8d6e63",  description: "Ganggeschwindigkeits-Analyse" },
    { id: "bathroom", label: "Bad / WC",               color: "#00acc1",  description: "Nykturie-Zaehlung (naechtl. Toilettenbesuche)" },
    { id: "kitchen",  label: "Kueche / Essbereich",    color: "#66bb6a",  description: "Essrhythmus-Analyse (Diabetes T2, Depression)" },
    { id: "bed",      label: "Bett / Schlafzimmer",    color: "#7b1fa2",  description: "Schlafanalyse, Bett-Belegung, Tremor-Erkennung" },
    { id: "living",   label: "Wohnzimmer / Hauptraum", color: "#1976d2",  description: "Personenzaehlung (FP2), Sozialisierungs-Analyse" },
];

function getFunctionsForType(type) {
    if (type === "vibration")   return SENSOR_FUNCTIONS.filter(f => ["", "bed"].includes(f.id));
    if (type === "moisture")    return SENSOR_FUNCTIONS.filter(f => ["", "bed", "bathroom"].includes(f.id));
    if (type === "temperature") return SENSOR_FUNCTIONS.filter(f => f.id === "");
    // motion, door, custom, presence_radar: alle Raumfunktionen erlaubt
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

export default function SensorList(props) {
    const { devices, isDark, uniqueLocations, sensorProblems } = props;
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
                            <TableCell sx={{ width: "20%", bgcolor: stickyBg, fontSize: fs, fontWeight: 600 }}>
                                <Tooltip title="Vollstaendiger ioBroker Objekt-Pfad">
                                    <span style={{ cursor: "help", textDecoration: "underline dotted" }}>Sensor-ID (ioBroker Pfad)</span>
                                </Tooltip>
                            </TableCell>
                            <TableCell sx={{ width: "13%", bgcolor: stickyBg, fontSize: fs, fontWeight: 600 }}>
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
                            <TableCell align="center" sx={{ width: "5%", bgcolor: stickyBg, px: 0.3 }}>
                                <Tooltip title="Suedfenster (Solar-Gain, nur Temp.-Sensoren)"><WbSunnyIcon sx={{ fontSize: 17, opacity: 0.55 }} /></Tooltip>
                            </TableCell>
                            <TableCell align="center" sx={{ width: "5%", bgcolor: stickyBg, px: 0.3 }}>
                                <Tooltip title="Ausgangs-Sensor (fuer Weggeh-Erkennung)"><ExitToAppIcon sx={{ fontSize: 17, opacity: 0.55 }} /></Tooltip>
                            </TableCell>
                            <TableCell align="center" sx={{ width: "5%", bgcolor: stickyBg, px: 0.3 }}>
                                <Tooltip title="Duplikate aufzeichnen (gleichen Wert mehrfach loggen)"><RepeatIcon sx={{ fontSize: 17, opacity: 0.55 }} /></Tooltip>
                            </TableCell>
                            <TableCell align="center" sx={{ width: "5%", bgcolor: stickyBg, px: 0.3 }}>
                                <Tooltip title="Nacht-Sensor: Tagesbeginn ignoriert diesen Raum"><NightsStayIcon sx={{ fontSize: 17, opacity: 0.55 }} /></Tooltip>
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
                                                <Tooltip title={"Sensor nicht erreichbar – zuletzt aktiv vor mehr als Schwellwert"}>
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

                                    {/* Duplikate */}
                                    <TableCell align="center" sx={{ px: 0.3 }}>
                                        <Tooltip title="Duplikate aufzeichnen">
                                            <Checkbox
                                                checked={device.logDuplicates || false}
                                                onChange={e => props.onDeviceChange(index, "logDuplicates", e.target.checked)}
                                                size="small" sx={{ p: 0.4 }}
                                                icon={<RepeatIcon sx={{ fontSize: 17, opacity: 0.2 }} />}
                                                checkedIcon={<RepeatIcon sx={{ fontSize: 17, color: "#42a5f5" }} />}
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
                        <Tooltip key={f.id} title={`${f.description}${isActive ? " — konfiguriert" : " — noch kein Sensor zugewiesen"}`} placement="top">
                            <Chip
                                label={`${isActive ? "✓ " : ""}${f.label}`}
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
                ✓ Farbe + dicker Rahmen = mindestens 1 Sensor mit dieser Funktion aktiv — gestrichelt = noch kein Sensor zugewiesen — Tooltip zeigt Details
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
        </Box>
    );
}

