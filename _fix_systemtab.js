const fs = require('fs');
const f = 'src-admin/src/components/tabs/SystemTab.tsx';
let src = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// ─── 1. ADD NEW IMPORTS ──────────────────────────────────────────────────────
src = src.replace(
    "import ClearIcon from '@mui/icons-material/Clear';",
    "import ClearIcon from '@mui/icons-material/Clear';\n" +
    "import CheckCircleIcon from '@mui/icons-material/CheckCircle';\n" +
    "import WarningAmberIcon from '@mui/icons-material/WarningAmber';\n" +
    "import CancelIcon from '@mui/icons-material/Cancel';\n" +
    "import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';\n" +
    "import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';"
);
src = src.replace(
    "    Divider\n} from '@mui/material';",
    "    Divider, Chip\n} from '@mui/material';"
);
if (!src.includes('DashboardCustomizeIcon')) { console.error('Import patch failed'); process.exit(1); }
console.log('✓ Step 1: Imports updated');

// ─── 2. INSERT MODULE ACCORDION ──────────────────────────────────────────────
// Find closing pattern of Dead Man Accordion
const ANCHOR = "            </Accordion>\n        </Box>\n    );\n}";
if (!src.includes(ANCHOR)) {
    console.error('Anchor not found. Last 300 chars:');
    console.log(JSON.stringify(src.slice(-300)));
    process.exit(1);
}

// Build JSX string piece by piece using string concatenation (no template literals)
const NL = '\n';
const T  = '            ';  // 12 spaces base indent
const T2 = T + '    ';      // 16 spaces
const T3 = T2 + '    ';     // 20 spaces

const jsx = NL +
'        {/* ─── MODULE & SYSTEM-STATUS ─── */}' + NL +
'        <Accordion sx={{ mb: 4, border: "1px solid", borderColor: isDark ? "#333" : "#ddd" }}>' + NL +
'            <AccordionSummary expandIcon={<ExpandMoreIcon />}>' + NL +
'                <Typography sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: "bold" }}>' + NL +
'                    <DashboardCustomizeIcon color="primary" /> Module &amp; System-Status' + NL +
'                </Typography>' + NL +
'            </AccordionSummary>' + NL +
'            <AccordionDetails>' + NL +
'                {(() => {' + NL +
'                    const devices: any[] = native?.devices || [];' + NL +
'                    const hallwayCount  = devices.filter((d: any) => d.isHallway).length;' + NL +
'                    const bathroomCount = devices.filter((d: any) => d.isBathroomSensor).length;' + NL +
'                    const nightCount    = devices.filter((d: any) => d.isNightSensor).length;' + NL +
'                    const hasGemini    = !!(native?.geminiApiKey && native.geminiApiKey.length > 5);' + NL +
'                    const aiEnabled    = native?.aiEnabled ?? false;' + NL +
'                    const hasPushover  = !!(native?.pushoverToken && native.pushoverToken.length > 5);' + NL +
NL +
'                    type Status = "ok" | "warn" | "error" | "disabled" | "planned";' + NL +
NL +
'                    const statusIcon = (s: Status) => {' + NL +
'                        if (s === "ok")      return <CheckCircleIcon fontSize="small" sx={{ color: "#4caf50" }} />;' + NL +
'                        if (s === "warn")    return <WarningAmberIcon fontSize="small" sx={{ color: "#ff9800" }} />;' + NL +
'                        if (s === "error")   return <CancelIcon fontSize="small" sx={{ color: "#f44336" }} />;' + NL +
'                        if (s === "planned") return <RadioButtonUncheckedIcon fontSize="small" sx={{ color: "#90caf9" }} />;' + NL +
'                        return <RadioButtonUncheckedIcon fontSize="small" sx={{ color: "text.disabled" }} />;' + NL +
'                    };' + NL +
NL +
'                    const statusChip = (s: Status) => {' + NL +
'                        type ChipColor = "success"|"warning"|"error"|"info"|"default";' + NL +
'                        const cfg: Record<Status, {label:string; color:ChipColor}> = {' + NL +
'                            ok:       { label: "Aktiv",    color: "success" },' + NL +
'                            warn:     { label: "Warnung",  color: "warning" },' + NL +
'                            error:    { label: "Fehler",   color: "error"   },' + NL +
'                            disabled: { label: "Inaktiv",  color: "default" },' + NL +
'                            planned:  { label: "Geplant",  color: "info"    },' + NL +
'                        };' + NL +
'                        return <Chip label={cfg[s].label} color={cfg[s].color} size="small" variant="outlined" sx={{ fontSize: "0.65rem", height: 20, minWidth: 64 }} />;' + NL +
'                    };' + NL +
NL +
'                    const Row = ({ status, label, detail }: { status: Status; label: string; detail: string }) => (' + NL +
'                        <Box sx={{ display: "flex", alignItems: "center", py: 0.75, borderBottom: "1px solid", borderColor: "divider" }}>' + NL +
'                            <Box sx={{ mr: 1.5, display: "flex" }}>{statusIcon(status)}</Box>' + NL +
'                            <Typography variant="body2" sx={{ flex: "0 0 230px", fontWeight: 500 }}>{label}</Typography>' + NL +
'                            <Typography variant="caption" sx={{ color: "text.secondary", flex: 1 }}>{detail}</Typography>' + NL +
'                            <Box sx={{ ml: 1 }}>{statusChip(status)}</Box>' + NL +
'                        </Box>' + NL +
'                    );' + NL +
NL +
'                    const SectionHeader = ({ children, color }: { children: React.ReactNode; color: string }) => (' + NL +
'                        <Typography variant="overline" sx={{ color, fontWeight: "bold", display: "block", mt: 1.5, mb: 0.5, letterSpacing: "0.1em", fontSize: "0.7rem" }}>' + NL +
'                            {children}' + NL +
'                        </Typography>' + NL +
'                    );' + NL +
NL +
'                    const sensorConfigOk = hallwayCount > 0 && bathroomCount > 0 && nightCount > 0;' + NL +
'                    const sensorDetail = sensorConfigOk' + NL +
'                        ? ("Flur \u2713  Bad \u2713  Nacht \u2713")' + NL +
'                        : ((hallwayCount === 0 ? "\u26a0 Flur fehlt  " : "") + (bathroomCount === 0 ? "\u26a0 Bad fehlt  " : "") + (nightCount === 0 ? "\u26a0 Nacht fehlt" : "") + " \u2192 Admin \u2192 Sensoren");' + NL +
NL +
'                    return (' + NL +
'                        <Box>' + NL +
'                            <Box sx={{ mb: 2, p: 1.5, bgcolor: isDark ? "#1a1a1a" : "#f5f5f5", borderRadius: 1 }}>' + NL +
'                                <Typography variant="caption" sx={{ color: "text.secondary" }}>' + NL +
'                                    {devices.length} Sensoren \u00b7 {hallwayCount} Flur \u00b7 {bathroomCount} Bad \u00b7 {nightCount} Nacht' + NL +
'                                </Typography>' + NL +
'                            </Box>' + NL +
NL +
'                            <SectionHeader color="#4caf50">\uD83C\uDD93 Kostenlos</SectionHeader>' + NL +
'                            <Row status={devices.length > 0 ? "ok" : "warn"} label="Bewegungserkennung" detail={devices.length > 0 ? devices.length + " Sensoren aktiv" : "Keine Sensoren konfiguriert"} />' + NL +
'                            <Row status="ok" label="Raumaktivit\u00e4t &amp; Heatmap" detail="Live-\u00dcbersicht aller R\u00e4ume \u00b7 immer aktiv" />' + NL +
'                            <Row status="ok" label="Lebenszeichen-Alarm" detail="Stille-Erkennung \u00b7 Gelb >4h \u00b7 Rot >8h" />' + NL +
'                            <Row status="ok" label="Admin UI Dashboard" detail="Garmin-Style Charts \u00b7 Langzeit-Trends" />' + NL +
'                            <Row status={sensorConfigOk ? "ok" : "warn"} label="Sensor-Konfiguration" detail={sensorDetail} />' + NL +
NL +
'                            <Divider sx={{ my: 1.5 }} />' + NL +
'                            <SectionHeader color="#ff9800">\uD83D\uDD11 Pro Features</SectionHeader>' + NL +
'                            <Row status={hasGemini && aiEnabled ? "ok" : !hasGemini ? "error" : "disabled"} label="KI-Tagesbericht (Gemini)" detail={hasGemini ? (aiEnabled ? "Gemini Flash \u00b7 t\u00e4glich 23:59" : "API-Key ok \u00b7 deaktiviert") : "Kein Gemini API-Key"} />' + NL +
'                            <Row status={hasGemini && aiEnabled ? "ok" : !hasGemini ? "error" : "disabled"} label="KI-Nachtbericht (Gemini)" detail={hasGemini && aiEnabled ? "Gemini Flash \u00b7 t\u00e4glich 06:00" : "Kein API-Key / deaktiviert"} />' + NL +
'                            <Row status={hasPushover && (native?.briefingEnabled ?? false) ? "ok" : !hasPushover ? "error" : "disabled"} label="Morgenbriefing (Pushover)" detail={hasPushover ? ((native?.briefingEnabled ?? false) ? "Aktiv \u00b7 " + (native?.briefingTime || "08:00") + " Uhr" : "Pushover ok \u00b7 deaktiviert") : "Kein Pushover-Token"} />' + NL +
'                            <Row status={hasPushover && (native?.weeklyBriefingEnabled ?? false) ? "ok" : !hasPushover ? "error" : "disabled"} label="Wochenbericht (Pushover)" detail={hasPushover ? ((native?.weeklyBriefingEnabled ?? false) ? "Sonntag \u00b7 " + (native?.weeklyBriefingTime || "09:00") + " Uhr" : "Pushover ok \u00b7 deaktiviert") : "Kein Pushover-Token"} />' + NL +
'                            <Row status={hasGemini && aiEnabled ? "ok" : !hasGemini ? "error" : "disabled"} label="Sicherheits-KI (IsolationForest)" detail="Anomalie-Erkennung \u00b7 Auto-Training ab 7 Tagen" />' + NL +
'                            <Row status={devices.length > 0 ? "warn" : "disabled"} label="Drift-Monitor (Page-Hinkley)" detail="Kalibrierungsphase \u00b7 min. 10 Tage \u00b7 4 Metriken" />' + NL +
'                            <Row status={hasPushover ? "ok" : "disabled"} label="PWA NUUKANNI (Mobil)" detail={hasPushover ? "Cloudflare Tunnel \u00b7 Zugriff von au\u00dfen" : "Konfiguration pr\u00fcfen"} />' + NL +
NL +
'                            <Divider sx={{ my: 1.5 }} />' + NL +
'                            <SectionHeader color="#90caf9">\uD83D\uDD2C In Planung</SectionHeader>' + NL +
'                            <Row status="planned" label="LSTM Sequenz-Vorhersage" detail="\\"Um 07:30 erwarte ich K\u00fcche\\" \u2014 zeitliche Anomalie-Erkennung" />' + NL +
'                            <Row status="planned" label="Zirkadianer Rhythmus" detail="Schlaf-/Wach-Verschiebung als Fr\u00fchindikator" />' + NL +
'                            <Row status="planned" label="Kalender-Kontext" detail="Feiertage, Besuch, Jahreszeit \u2014 weniger Fehlalarme" />' + NL +
'                        </Box>' + NL +
'                    );' + NL +
'                })()}' + NL +
'            </AccordionDetails>' + NL +
'        </Accordion>' + NL;

src = src.replace(ANCHOR, jsx + "            </Accordion>\n        </Box>\n    );\n}");

if (!src.includes('Module')) { console.error('Accordion not inserted'); process.exit(1); }
console.log('✓ Step 2: Module accordion inserted');

fs.writeFileSync(f, src.replace(/\n/g, '\r\n'), 'utf8');
console.log('✓ File saved (' + src.split('\n').length + ' lines)');
