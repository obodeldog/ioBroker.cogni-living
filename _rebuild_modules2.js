/**
 * Replaces the Module-Status accordion content in SystemTab.tsx
 * with a Säulen-based structure (Gesundheit/Sicherheit/Komfort/Energie)
 * including Pro/Free badges and tooltips for status chips.
 */
const fs = require('fs');
const f = 'src-admin/src/components/tabs/SystemTab.tsx';
let src = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// ─── Find the MODULE accordion block boundaries ───────────────────────────────
const commentMarker = '{/* \u2550\u2550\u2550 MODULE & SYSTEM-STATUS \u2550\u2550\u2550 */}';
const startIdx = src.indexOf(commentMarker);
if (startIdx < 0) { console.error('Module start not found'); process.exit(1); }

// Find the end: last </Accordion> before </Box>\n    );\n}
const endMarker = '\n        </Box>\n    );\n}';
const endIdx = src.lastIndexOf(endMarker);
if (endIdx < 0) { console.error('Module end not found'); process.exit(1); }
// The module block ends at a </Accordion> just before endMarker
// Find the last </Accordion> before endMarker
const blockEnd = src.lastIndexOf('        </Accordion>', endIdx);
if (blockEnd < 0) { console.error('Block end not found'); process.exit(1); }

const beforeModule = src.substring(0, startIdx);
const afterModule  = src.substring(blockEnd + '        </Accordion>'.length);

console.log('Before ends with:', JSON.stringify(src.substring(startIdx - 30, startIdx)));
console.log('After starts with:', JSON.stringify(afterModule.substring(0, 40)));

// ─── Also add Tooltip to MUI imports if not present ──────────────────────────
if (!src.includes('Tooltip,') && !src.includes(', Tooltip')) {
    src = src.replace(
        'import {\n    Box, Typography,',
        'import {\n    Box, Typography, Tooltip,'
    );
}

// ─── Build new MODULE accordion ───────────────────────────────────────────────
const NL = '\n';

// Helper: build a module row string
// status: ok | warn | error | disabled | planned | observe
// tier: 'free' | 'pro'
// tooltip: string (for warn/observe/error states)
function modRow(status, tier, label, version, detail, tooltip) {
    const tip = tooltip || '';
    return (
        '                            <ModRow' +
        ' status="' + status + '"' +
        ' tier="' + tier + '"' +
        ' label="' + label + '"' +
        ' version="' + version + '"' +
        ' detail="' + detail + '"' +
        ' tooltip="' + tip + '"' +
        ' />' + NL
    );
}

const NEW_MODULE = (
    commentMarker + NL +
    '        <Accordion sx={{ mb: 2, border: "1px solid", borderColor: isDark ? "#333" : "#ddd" }}>' + NL +
    '            <AccordionSummary expandIcon={<ExpandMoreIcon />}>' + NL +
    '                <Typography sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: "bold" }}>' + NL +
    '                    <DashboardCustomizeIcon color="primary" />' + NL +
    '                    Module & Algorithmen-Status' + NL +
    '                </Typography>' + NL +
    '            </AccordionSummary>' + NL +
    '            <AccordionDetails>' + NL +
    '                {(() => {' + NL +
    '                    const devices: any[] = native?.devices || [];' + NL +
    '                    const hallwayCount  = devices.filter((d: any) => d.isHallway).length;' + NL +
    '                    const bathroomCount = devices.filter((d: any) => d.isBathroomSensor).length;' + NL +
    '                    const nightCount    = devices.filter((d: any) => d.isNightSensor).length;' + NL +
    '                    const hasGemini     = !!(native?.geminiApiKey && native.geminiApiKey.length > 5);' + NL +
    '                    const hasPushover   = !!native?.notifyPushoverEnabled;' + NL +
    '                    const briefingOk    = !!(native?.briefingEnabled && hasPushover);' + NL +
    '                    const weeklyOk      = !!(native?.weeklyBriefingEnabled && hasPushover);' + NL +
    '                    const inactivityOn  = native?.inactivityMonitoringEnabled !== false;' + NL +
    '                    const useCalendar   = !!native?.useCalendar;' + NL +
    '                    const useWeather    = !!native?.useWeather;' + NL +
    '                    const infrasoundOn  = !!native?.infrasoundEnabled;' + NL +
    '                    const pwaEnabled    = !!native?.pwaEnabled;' + NL +
    NL +
    '                    type Status = "ok" | "warn" | "error" | "disabled" | "planned" | "observe";' + NL +
    '                    type Tier = "free" | "pro";' + NL +
    NL +
    '                    const STATUS_CFG: Record<Status, { icon: string; color: string; chip: string; chipColor: "success"|"warning"|"error"|"info"|"default" }> = {' + NL +
    '                        ok:       { icon: "\u2705", color: "#4caf50", chip: "Aktiv",        chipColor: "success" },' + NL +
    '                        warn:     { icon: "\u26a0\ufe0f", color: "#ff9800", chip: "Warnung",      chipColor: "warning" },' + NL +
    '                        observe:  { icon: "\uD83D\uDC41", color: "#90caf9", chip: "Beobachtung", chipColor: "info"    },' + NL +
    '                        error:    { icon: "\u274c", color: "#f44336", chip: "Fehler",       chipColor: "error"   },' + NL +
    '                        disabled: { icon: "\u26aa", color: "#757575", chip: "Inaktiv",      chipColor: "default" },' + NL +
    '                        planned:  { icon: "\uD83D\uDD2C", color: "#90caf9", chip: "Geplant",     chipColor: "info"    },' + NL +
    '                    };' + NL +
    NL +
    '                    const ModRow = ({ status, tier, label, version, detail, tooltip }: {' + NL +
    '                        status: Status; tier: Tier; label: string; version: string; detail: string; tooltip?: string;' + NL +
    '                    }) => {' + NL +
    '                        const cfg = STATUS_CFG[status];' + NL +
    '                        const chip = (' + NL +
    '                            <Chip label={cfg.chip} color={cfg.chipColor} size="small" variant="outlined"' + NL +
    '                                sx={{ fontSize: "0.62rem", height: 18, minWidth: 72 }} />' + NL +
    '                        );' + NL +
    '                        return (' + NL +
    '                            <Box sx={{ display: "flex", alignItems: "center", py: 0.6, borderBottom: "1px solid", borderColor: "divider", gap: 0.5 }}>' + NL +
    '                                <Typography sx={{ fontSize: "0.85rem", mr: 0.5, flexShrink: 0 }}>{cfg.icon}</Typography>' + NL +
    '                                <Typography variant="body2" sx={{ flex: "0 0 195px", fontWeight: 500, fontSize: "0.78rem", lineHeight: 1.2 }}>{label}</Typography>' + NL +
    '                                <Typography variant="caption" sx={{ flex: "0 0 52px", color: "#888", fontSize: "0.6rem" }}>{version}</Typography>' + NL +
    '                                <Typography variant="caption" sx={{ color: "text.secondary", flex: 1, fontSize: "0.7rem" }}>{detail}</Typography>' + NL +
    '                                <Tooltip title={tier === "pro" ? "\uD83D\uDD11 Pro-Feature" : "\uD83C\uDD93 Kostenlos"} arrow placement="left">' + NL +
    '                                    <Typography sx={{ fontSize: "0.75rem", flexShrink: 0, mx: 0.5, cursor: "default" }}>' + NL +
    '                                        {tier === "pro" ? "\uD83D\uDD11" : "\uD83C\uDD93"}' + NL +
    '                                    </Typography>' + NL +
    '                                </Tooltip>' + NL +
    '                                {tooltip ? (' + NL +
    '                                    <Tooltip title={tooltip} arrow placement="left" sx={{ maxWidth: 320 }}>' + NL +
    '                                        {chip}' + NL +
    '                                    </Tooltip>' + NL +
    '                                ) : chip}' + NL +
    '                            </Box>' + NL +
    '                        );' + NL +
    '                    };' + NL +
    NL +
    '                    const SectionHeader = ({ color, label, subtitle }: { color: string; label: string; subtitle?: string }) => (' + NL +
    '                        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mt: 2.5, mb: 0.5, pb: 0.5, borderBottom: "2px solid " + color }}>' + NL +
    '                            <Typography variant="overline" sx={{ color, fontWeight: "bold", letterSpacing: "0.1em", fontSize: "0.7rem", lineHeight: 1 }}>' + NL +
    '                                {label}' + NL +
    '                            </Typography>' + NL +
    '                            {subtitle && <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.62rem" }}>{subtitle}</Typography>}' + NL +
    '                        </Box>' + NL +
    '                    );' + NL +
    NL +
    '                    return (' + NL +
    '                        <Box>' + NL +
    // Info bar
    '                            <Box sx={{ mb: 1.5, p: 1, bgcolor: isDark ? "#1a1a1a" : "#f5f5f5", borderRadius: 1, display: "flex", gap: 3, flexWrap: "wrap" }}>' + NL +
    '                                <Typography variant="caption" sx={{ color: "text.secondary" }}>{devices.length} Sensoren \u00b7 {hallwayCount} Flur \u00b7 {bathroomCount} Bad \u00b7 {nightCount} Nacht</Typography>' + NL +
    '                                <Typography variant="caption" sx={{ color: hasGemini ? "#4caf50" : "#f44336" }}>Gemini {hasGemini ? "\u2705" : "\u274c"}</Typography>' + NL +
    '                                <Typography variant="caption" sx={{ color: hasPushover ? "#4caf50" : "#ff9800" }}>Pushover {hasPushover ? "\u2705" : "\u26a0"}</Typography>' + NL +
    '                            </Box>' + NL +
    NL +

    // ══════════════════════════════════════════════════════
    // 🔴 GESUNDHEIT
    // ══════════════════════════════════════════════════════
    '                            <SectionHeader color="#ef5350" label="\uD83D\uDD34 GESUNDHEIT" subtitle="Health-S\u00e4ule \u00b7 Algorithmische Gesundheits\u00fcberwachung" />' + NL +
    '                            <ModRow status={devices.length > 0 ? "ok" : "warn"} tier="free" label="Bewegungserkennung (PIR)" version="v0.10"' + NL +
    '                                detail={devices.length > 0 ? devices.length + " PIR-Sensoren \u00b7 keine Lichtschalter/Rolll\u00e4den" : "Keine Sensoren konfiguriert"}' + NL +
    '                                tooltip={devices.length === 0 ? "Keine Bewegungssensoren konfiguriert. Sensoren in Admin \u2192 System \u2192 Sensoren hinzuf\u00fcgen." : undefined} />' + NL +
    '                            <ModRow status={nightCount > 0 ? "ok" : "warn"} tier="free" label="Schlafphasen-Erkennung" version="v0.15"' + NL +
    '                                detail={nightCount > 0 ? nightCount + " Nacht-Sensoren \u00b7 Fenster 22:00\u201308:00" : "\u26a0 Nacht-Sensoren fehlen"}' + NL +
    '                                tooltip={nightCount === 0 ? "Keine Nacht-Sensoren markiert. Bitte in Admin \u2192 Sensoren die Checkbox \uD83C\uDF19 Nacht setzen (z. B. Schlafzimmer)." : undefined} />' + NL +
    '                            <ModRow status={devices.length > 0 ? "ok" : "warn"} tier="free" label="Aktivit\u00e4ts-Aggregation" version="v0.20"' + NL +
    '                                detail="Event-Z\u00e4hlung pro Raum \u00b7 Basis aller Langzeit-Charts" />' + NL +
    '                            <ModRow status={devices.length > 0 ? "ok" : "warn"} tier="free" label="Aktivit\u00e4ts-Normalisierung" version="v0.30.74"' + NL +
    '                                detail="Pers\u00f6nl. Median \u00b7 14-Tage-Baseline \u00b7 0\u2013200\u202f% Anzeige" />' + NL +
    '                            <ModRow status={bathroomCount > 0 ? "ok" : "warn"} tier="free" label="Bad-Nutzungsdauer" version="v0.28"' + NL +
    '                                detail={bathroomCount > 0 ? bathroomCount + " Bad-Sensoren \u00b7 Aufenthaltsdauer in Minuten" : "\u26a0 Bad-Sensoren fehlen"}' + NL +
    '                                tooltip={bathroomCount === 0 ? "Keine Bad-Sensoren markiert. Bitte in Admin \u2192 Sensoren die Checkbox \uD83D\uDEBF Bad setzen." : undefined} />' + NL +
    '                            <ModRow status={devices.length > 0 ? "ok" : "warn"} tier="free" label="Frischluft-Erkennung" version="v0.28"' + NL +
    '                                detail="T\u00fcrkontakt-Sensoren (type=door) \u00b7 \u00d6ffnungen z\u00e4hlen" />' + NL +
    '                            <ModRow status={hallwayCount > 0 ? "ok" : "warn"} tier="pro" label="Ganggeschwindigkeit" version="v0.28"' + NL +
    '                                detail={hallwayCount > 0 ? hallwayCount + " Flur-Sensoren \u00b7 Transit-Zeit in Sekunden (Median)" : "\u26a0 Flur-Sensoren fehlen"}' + NL +
    '                                tooltip={hallwayCount === 0 ? "Keine Flur-Sensoren markiert. Bitte in Admin \u2192 Sensoren die Checkbox \uD83D\uDEB6 Flur setzen." : undefined} />' + NL +
    '                            <ModRow status={devices.length > 0 ? "ok" : "warn"} tier="pro" label="Langzeit-Trendanalyse" version="v0.30.60"' + NL +
    '                                detail="Lineare Regression \u00b7 Garmin-Style Charts \u00b7 7/30/180 Tage" />' + NL +
    '                            <ModRow status={hasGemini ? "ok" : "error"} tier="pro" label="KI-Tagesbericht (Gemini)" version="v0.29"' + NL +
    '                                detail={hasGemini ? "Gemini Flash \u00b7 Flie\u00dftext \u00b7 t\u00e4glich 23:59" : "Kein Gemini API-Key"}' + NL +
    '                                tooltip={!hasGemini ? "Kein Gemini API-Key konfiguriert. In Admin \u2192 System \u2192 Lizenz & KI-Verbindung eintragen." : undefined} />' + NL +
    '                            <ModRow status={hasGemini ? "ok" : "error"} tier="pro" label="KI-Nachtbericht (Gemini)" version="v0.29"' + NL +
    '                                detail={hasGemini ? "Gemini Flash \u00b7 Schlaf-Zusammenfassung \u00b7 06:00" : "Kein Gemini API-Key"}' + NL +
    '                                tooltip={!hasGemini ? "Kein Gemini API-Key konfiguriert." : undefined} />' + NL +
    '                            <ModRow status={hasGemini ? "ok" : "error"} tier="pro" label="Baseline-Drift (LLM)" version="v0.30.60"' + NL +
    '                                detail={hasGemini ? "Gemini \u00b7 LTB vs. STB Vergleich \u00b7 Text-Badge" : "Kein API-Key"}' + NL +
    '                                tooltip={!hasGemini ? "Kein Gemini API-Key konfiguriert." : undefined} />' + NL +
    '                            <ModRow status="observe" tier="pro" label="Graduelle Drift-Erkennung (PH-Test)" version="v0.30.74"' + NL +
    '                                detail="4 Metriken \u00b7 Page-Hinkley-Test \u00b7 Kalibrierungsphase"' + NL +
    '                                tooltip="Der Algorithmus l\u00e4uft, sammelt aber noch Daten f\u00fcr seine pers\u00f6nliche Baseline. Mindestens 10 Tage ben\u00f6tigt. Alarme werden erst nach vollst\u00e4ndiger Kalibrierung ausgel\u00f6st." />' + NL +
    '                            <ModRow status="planned" tier="pro" label="Zirkadiane Rhythmus-Analyse" version="\u2013"' + NL +
    '                                detail="Fourier-Analyse \u00b7 Schlaf-/Wach-Verschiebung \u00b7 Demenz-Fr\u00fchwarnung" />' + NL +
    '                            <ModRow status="planned" tier="pro" label="Rolladen-/Licht-Muster" version="\u2013"' + NL +
    '                                detail="Rolladen runter = Schlafenszeit \u00b7 Lichtschalter als Aktivit\u00e4ts-Signal" />' + NL +
    NL +

    // ══════════════════════════════════════════════════════
    // 🟢 SICHERHEIT
    // ══════════════════════════════════════════════════════
    '                            <SectionHeader color="#66bb6a" label="\uD83D\uDFE2 SICHERHEIT" subtitle="Security-S\u00e4ule \u00b7 Anomalie-Erkennung & Alarme" />' + NL +
    '                            <ModRow status="warn" tier="pro" label="Tages-Anomalie (IsolationForest)" version="v0.25"' + NL +
    '                                detail="96-Dim Vektor \u00b7 Auto-Training ab 7 Digests \u00b7 t\u00e4glich"' + NL +
    '                                tooltip="IsolationForest ben\u00f6tigt mindestens 7 Tages-Digests zum ersten Training. Das Auto-Training l\u00e4uft automatisch n\u00e4chtlich. Warnung verschwindet sobald das Modell trainiert ist." />' + NL +
    '                            <ModRow status="warn" tier="pro" label="Nacht-Anomalie (IsolationForest)" version="v0.25"' + NL +
    '                                detail="20-Dim Nacht-Slots \u00b7 personalisiert auf Schlaf-History"' + NL +
    '                                tooltip="Wie Tages-Anomalie: Auto-Training ab 7 Nacht-Digests. Danach lernt das Modell den pers\u00f6nlichen Schlaf-Rhythmus." />' + NL +
    '                            <ModRow status={inactivityOn ? "ok" : "disabled"} tier="free" label="Inaktivit\u00e4ts-Alarm (Dead Man)" version="v0.30"' + NL +
    '                                detail={inactivityOn ? "Stille-Erkennung \u00b7 Gelb >" + (native?.inactivityThresholdHours || 4) + "h \u00b7 Rot >8h" : "Deaktiviert in Einstellungen"} />' + NL +
    '                            <ModRow status={infrasoundOn ? "ok" : "disabled"} tier="pro" label="Infraschall-Sensor" version="v0.30"' + NL +
    '                                detail={infrasoundOn ? "Aktiv \u00b7 physikalischer Sensor verbunden" : "Deaktiviert \u00b7 optionaler Hardware-Sensor"}' + NL +
    '                                tooltip={!infrasoundOn ? "Infraschall ist ein optionaler Hardwaresensor. Aktivierung in Admin \u2192 System \u2192 Einstellungen." : undefined} />' + NL +
    '                            <ModRow status="planned" tier="pro" label="LSTM Sequenz-Vorhersage" version="\u2013"' + NL +
    '                                detail="\u201eUm 07:30 erwarte ich K\u00fcche\u201c \u00b7 zeitlich bewusste Anomalie-Erkennung" />' + NL +
    NL +

    // ══════════════════════════════════════════════════════
    // 🔵 KOMFORT
    // ══════════════════════════════════════════════════════
    '                            <SectionHeader color="#42a5f5" label="\uD83D\uDD35 KOMFORT" subtitle="Comfort-S\u00e4ule \u00b7 Neuro-Symbolische Hausautomation" />' + NL +
    '                            <ModRow status="warn" tier="pro" label="Muster-Erkennung (\u201eDer Butler\u201c)" version="v0.30"' + NL +
    '                                detail="Aktivit\u00e4ts-Muster lernen \u00b7 Automatisierungsvorschl\u00e4ge"' + NL +
    '                                tooltip="Das System lernt wiederkehrende Verhaltensmuster (z.B. t\u00e4glich 7:30 Uhr Licht Wohnzimmer). Warnung = noch nicht gen\u00fcgend Wiederholungen zum sicheren Ableiten von Regeln." />' + NL +
    '                            <ModRow status="warn" tier="pro" label="Neuro-Symbolische Automatisierung" version="v0.30"' + NL +
    '                                detail="Regeln aus Mustern \u00b7 nur bei hoher Konfidenz ausgef\u00fchrt"' + NL +
    '                                tooltip="Automatisierungen werden erst ausgef\u00fchrt wenn die Konfidenz \u00fcber dem Schwellwert liegt. Warnung = Lernphase l\u00e4uft noch." />' + NL +
    '                            <ModRow status="planned" tier="pro" label="Kalender-Kontext" version="\u2013"' + NL +
    '                                detail="Feiertage, Besuch, Jahreszeit \u2014 weniger Fehlalarme"' + NL +
    '                                tooltip="Nicht implementiert. Wenn aktiv: Kalendereintr\u00e4ge werden als Kontext f\u00fcr alle Algorithmen genutzt." />' + NL +
    NL +

    // ══════════════════════════════════════════════════════
    // 🟠 ENERGIE
    // ══════════════════════════════════════════════════════
    '                            <SectionHeader color="#ffa726" label="\uD83D\uDFE0 ENERGIE" subtitle="Energy-S\u00e4ule \u00b7 Pr\u00e4diktive Thermostat-Steuerung" />' + NL +
    '                            <ModRow status="ok" tier="pro" label="Thermodynamik-Modell" version="v0.30"' + NL +
    '                                detail="dT/dt Gleichung \u00b7 physikalisches Geb\u00e4ude-Modell" />' + NL +
    '                            <ModRow status="ok" tier="pro" label="PINN Energie-Vorhersage" version="v0.30"' + NL +
    '                                detail="Neural Network \u00b7 MPC statt PID \u00b7 pr\u00e4diktive Steuerung" />' + NL +
    '                            <ModRow status={useWeather ? "ok" : "disabled"} tier="pro" label="Wetter-Integration" version="v0.30"' + NL +
    '                                detail={useWeather ? "Au\u00dfentemperatur-Referenz \u00b7 aktiv" : "Deaktiviert \u00b7 in Einstellungen aktivierbar"}' + NL +
    '                                tooltip={!useWeather ? "Wetterintegration deaktiviert. Aktivierung in Admin \u2192 System \u2192 Einstellungen." : undefined} />' + NL +
    '                            <ModRow status={useCalendar ? "ok" : "disabled"} tier="pro" label="Kalender-Vorlaufsteuerung" version="v0.30"' + NL +
    '                                detail={useCalendar ? "Kalender-Events \u00b7 Vorlauf-Heizung aktiv" : "Deaktiviert \u00b7 in Einstellungen aktivierbar"}' + NL +
    '                                tooltip={!useCalendar ? "Kalenderintegration deaktiviert. Aktivierung in Admin \u2192 System \u2192 Einstellungen." : undefined} />' + NL +
    NL +

    // ══════════════════════════════════════════════════════
    // 🔔 BENACHRICHTIGUNGEN
    // ══════════════════════════════════════════════════════
    '                            <SectionHeader color="#9c27b0" label="\uD83D\uDD14 BERICHTE & BENACHRICHTIGUNGEN" subtitle="Pushover \u00b7 Gemini-Zusammenfassungen" />' + NL +
    '                            <ModRow status={briefingOk ? "ok" : !hasPushover ? "warn" : "disabled"} tier="pro" label="Morgenbriefing (Pushover)" version="\u2013"' + NL +
    '                                detail={briefingOk ? "Aktiv \u00b7 " + (native?.briefingTime || "08:00") + " Uhr" : hasPushover ? "Deaktiviert in Einstellungen" : "Pushover nicht konfiguriert"}' + NL +
    '                                tooltip={!hasPushover ? "Pushover ist nicht aktiviert. In Admin \u2192 System \u2192 Benachrichtigungen konfigurieren." : undefined} />' + NL +
    '                            <ModRow status={weeklyOk ? "ok" : !hasPushover ? "warn" : "disabled"} tier="pro" label="Wochenbericht (Pushover)" version="\u2013"' + NL +
    '                                detail={weeklyOk ? "Aktiv \u00b7 Sonntag " + (native?.weeklyBriefingTime || "09:00") + " Uhr" : hasPushover ? "Deaktiviert in Einstellungen" : "Pushover nicht konfiguriert"}' + NL +
    '                                tooltip={!hasPushover ? "Pushover ist nicht aktiviert." : undefined} />' + NL +
    '                            <ModRow status={pwaEnabled ? "ok" : "disabled"} tier="pro" label="PWA NUUKANNI (Mobil)" version="v0.30"' + NL +
    '                                detail={pwaEnabled ? "Aktiv \u00b7 Cloudflare Tunnel \u00b7 Zugriff von au\u00dfen" : "Deaktiviert in Einstellungen"} />' + NL +
    '                        </Box>' + NL +
    '                    );' + NL +
    '                })()}' + NL +
    '            </AccordionDetails>' + NL +
    '        </Accordion>'
);

// ─── Ensure Tooltip is imported ───────────────────────────────────────────────
let newSrc = beforeModule + NEW_MODULE + afterModule;
if (!newSrc.includes('import') || (!newSrc.includes('Tooltip,') && !newSrc.includes(', Tooltip'))) {
    newSrc = newSrc.replace(
        "    Divider, Chip\n} from '@mui/material';",
        "    Divider, Chip, Tooltip\n} from '@mui/material';"
    );
}

// Verify
const checks = ['\uD83D\uDD34 GESUNDHEIT', '\uD83D\uDFE2 SICHERHEIT', '\uD83D\uDD35 KOMFORT', '\uD83D\uDFE0 ENERGIE', 'LSTM', 'PINN', 'IsolationForest', 'tooltip='];
let ok = true;
for (const c of checks) {
    if (!newSrc.includes(c)) { console.error('MISSING: ' + c); ok = false; }
    else console.log('  OK: ' + c);
}
if (!ok) process.exit(1);

fs.writeFileSync(f, newSrc.replace(/\n/g, '\r\n'), 'utf8');
console.log('\nSaved (' + newSrc.split('\n').length + ' lines)');
