/**
 * Rebuilds the Module & System-Status section in SystemTab.tsx:
 * 1. Removes the wrongly nested Module accordion from inside Dead Man
 * 2. Inserts a corrected version AFTER Dead Man, with roadmap-aligned content
 */
const fs = require('fs');
const f = 'src-admin/src/components/tabs/SystemTab.tsx';
let src = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const lines = src.split('\n');

// ─── Step 1: Find exact boundaries ───────────────────────────────────────────
// The current file (after buggy patch) ends with:
//   line ~261: </AccordionDetails>   ← Dead Man's AccordionDetails close
//   lines 262–356: [MODULE ACCORDION - wrongly inside Dead Man]
//   line 357: </Accordion>           ← Dead Man's Accordion close
//   line 358: </Box>
//   line 359: );
//   line 360: }

// Find "Dead Man" text to locate the Dead Man accordion
const deadManLineIdx = lines.findIndex(l => l.includes('Dead Man'));
console.log('Dead Man text at line', deadManLineIdx + 1);

// Find the Module comment to locate the incorrectly placed section
const moduleStartIdx = lines.findIndex(l => l.includes('MODULE & SYSTEM-STATUS'));
console.log('Module section starts at line', moduleStartIdx + 1);

// The Dead Man accordion's closing </Accordion> is the one right before </Box>
// It's the last </Accordion> in the file before </Box>
const lastAccordionIdx = lines.reduce((last, l, i) => l.trim() === '</Accordion>' ? i : last, -1);
console.log('Dead Man </Accordion> at line', lastAccordionIdx + 1);

if (moduleStartIdx < 0 || lastAccordionIdx < 0) {
    console.error('Could not find required markers');
    process.exit(1);
}

// ─── Step 2: Remove Module section from inside Dead Man ──────────────────────
// Keep: everything up to (and including) the line before module comment
// Then: skip to the Dead Man </Accordion> close
// Then: add the corrected Module accordion
// Then: </Box> );  }

const beforeModule = lines.slice(0, moduleStartIdx - 1).join('\n'); // lines before module comment (incl. </AccordionDetails>)
const deadManClose = lines[lastAccordionIdx];  // should be "            </Accordion>"
const afterClose   = lines.slice(lastAccordionIdx + 1).join('\n');   // </Box>\n);\n}

console.log('Before module ends with:', JSON.stringify(lines[moduleStartIdx - 2]));
console.log('Dead Man close:', JSON.stringify(deadManClose));
console.log('After close starts with:', JSON.stringify(afterClose.substring(0, 50)));

// ─── Step 3: Build the corrected Module accordion content ────────────────────
// Using string concatenation to avoid Node.js evaluating ${...} inside template literals
const NL = '\n';

function row(status, label, version, detail) {
    // status: 'ok' | 'warn' | 'error' | 'disabled' | 'planned' | 'observe'
    return '                            <ModRow status="' + status + '" label="' + label + '" version="' + version + '" detail="' + detail + '" />' + NL;
}

const ACCORDION = NL +
'        {/* \u2550\u2550\u2550 MODULE & SYSTEM-STATUS \u2550\u2550\u2550 */}' + NL +
'        <Accordion sx={{ mb: 2, border: "1px solid", borderColor: isDark ? "#333" : "#ddd" }}>' + NL +
'            <AccordionSummary expandIcon={<ExpandMoreIcon />}>' + NL +
'                <Typography sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: "bold" }}>' + NL +
'                    <DashboardCustomizeIcon color="primary" />' + NL +
'                    Modul\u00fcbersicht & Algorithmen-Status' + NL +
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
NL +
'                    type Status = "ok" | "warn" | "error" | "disabled" | "planned" | "observe";' + NL +
NL +
'                    const statusIcon = (s: Status) => {' + NL +
'                        if (s === "ok")      return <CheckCircleIcon fontSize="small" sx={{ color: "#4caf50" }} />;' + NL +
'                        if (s === "warn")    return <WarningAmberIcon fontSize="small" sx={{ color: "#ff9800" }} />;' + NL +
'                        if (s === "observe") return <WarningAmberIcon fontSize="small" sx={{ color: "#90caf9" }} />;' + NL +
'                        if (s === "error")   return <CancelIcon fontSize="small" sx={{ color: "#f44336" }} />;' + NL +
'                        if (s === "planned") return <RadioButtonUncheckedIcon fontSize="small" sx={{ color: "#90caf9" }} />;' + NL +
'                        return <RadioButtonUncheckedIcon fontSize="small" sx={{ color: "text.disabled" }} />;' + NL +
'                    };' + NL +
NL +
'                    const statusChip = (s: Status) => {' + NL +
'                        type ChipColor = "success"|"warning"|"error"|"info"|"default";' + NL +
'                        const cfg: Record<Status, {label:string; color:ChipColor}> = {' + NL +
'                            ok:       { label: "Aktiv",          color: "success" },' + NL +
'                            warn:     { label: "Warnung",        color: "warning" },' + NL +
'                            observe:  { label: "Beobachtung",   color: "info"    },' + NL +
'                            error:    { label: "Fehler",         color: "error"   },' + NL +
'                            disabled: { label: "Inaktiv",        color: "default" },' + NL +
'                            planned:  { label: "Geplant",        color: "info"    },' + NL +
'                        };' + NL +
'                        return <Chip label={cfg[s].label} color={cfg[s].color} size="small" variant="outlined" sx={{ fontSize: "0.65rem", height: 20, minWidth: 72 }} />;' + NL +
'                    };' + NL +
NL +
'                    const ModRow = ({ status, label, version, detail }: { status: Status; label: string; version: string; detail: string }) => (' + NL +
'                        <Box sx={{ display: "flex", alignItems: "center", py: 0.65, borderBottom: "1px solid", borderColor: "divider" }}>' + NL +
'                            <Box sx={{ mr: 1, display: "flex", flexShrink: 0 }}>{statusIcon(status)}</Box>' + NL +
'                            <Typography variant="body2" sx={{ flex: "0 0 210px", fontWeight: 500, fontSize: "0.8rem" }}>{label}</Typography>' + NL +
'                            <Typography variant="caption" sx={{ flex: "0 0 55px", color: "#888", fontSize: "0.62rem" }}>{version}</Typography>' + NL +
'                            <Typography variant="caption" sx={{ color: "text.secondary", flex: 1, fontSize: "0.72rem" }}>{detail}</Typography>' + NL +
'                            <Box sx={{ ml: 1, flexShrink: 0 }}>{statusChip(status)}</Box>' + NL +
'                        </Box>' + NL +
'                    );' + NL +
NL +
'                    const SectionHeader = ({ icon, label, color }: { icon: string; label: string; color: string }) => (' + NL +
'                        <Box sx={{ display: "flex", alignItems: "center", mt: 2, mb: 0.5, pb: 0.5, borderBottom: "2px solid", borderColor: color }}>' + NL +
'                            <Typography variant="overline" sx={{ color, fontWeight: "bold", letterSpacing: "0.1em", fontSize: "0.68rem", lineHeight: 1 }}>' + NL +
'                                {icon} {label}' + NL +
'                            </Typography>' + NL +
'                        </Box>' + NL +
'                    );' + NL +
NL +
'                    return (' + NL +
'                        <Box>' + NL +
// Info bar
'                            <Box sx={{ mb: 1.5, p: 1, bgcolor: isDark ? "#1a1a1a" : "#f5f5f5", borderRadius: 1, display: "flex", gap: 2, flexWrap: "wrap" }}>' + NL +
'                                <Typography variant="caption" sx={{ color: "text.secondary" }}>' + NL +
'                                    {devices.length} Sensoren \u00b7 {hallwayCount} Flur \u00b7 {bathroomCount} Bad \u00b7 {nightCount} Nacht-Sensoren' + NL +
'                                </Typography>' + NL +
'                                <Typography variant="caption" sx={{ color: "text.secondary" }}>' + NL +
'                                    Gemini: {hasGemini ? "\u2705 verbunden" : "\u274c kein API-Key"}' + NL +
'                                    {" \u00b7 "}' + NL +
'                                    Pushover: {hasPushover ? "\u2705 aktiv" : "\u26a0 nicht konfiguriert"}' + NL +
'                                </Typography>' + NL +
'                            </Box>' + NL +
NL +
// ── SECTION 1: Datenerfassung & Basis ──
'                            <SectionHeader icon="\uD83D\uDCF1" label="DATENERFASSUNG & BASIS" color="#4fc3f7" />' + NL +
'                            <ModRow status={devices.length > 0 ? "ok" : "warn"} label="Bewegungserkennung" version="v0.10" detail={devices.length > 0 ? devices.length + " Sensoren \u00b7 PIR-Fusion aller R\u00e4ume" : "Keine Sensoren konfiguriert"} />' + NL +
'                            <ModRow status={nightCount > 0 ? "ok" : "warn"} label="Schlafphasen-Erkennung" version="v0.15" detail={nightCount > 0 ? nightCount + " Nacht-Sensoren \u00b7 22:00\u201308:00 Fenster" : "\u26a0 Keine Nacht-Sensoren \u2192 Admin \u2192 Sensoren"} />' + NL +
'                            <ModRow status={devices.length > 0 ? "ok" : "warn"} label="Aktivit\u00e4ts-Aggregation" version="v0.20" detail="Event-Z\u00e4hlung pro Raum / Zeitfenster \u00b7 Basis aller Charts" />' + NL +
'                            <ModRow status={bathroomCount > 0 ? "ok" : "warn"} label="Bad-Nutzungsdauer" version="v0.28" detail={bathroomCount > 0 ? bathroomCount + " Bad-Sensoren \u00b7 Aufenthaltsdauer in Min." : "\u26a0 Keine Bad-Sensoren \u2192 Admin \u2192 Sensoren"} />' + NL +
'                            <ModRow status={devices.length > 0 ? "ok" : "warn"} label="Frischluft-Erkennung" version="v0.28" detail="T\u00fcrkontakt-Sensoren \u00b7 \u00d6ffnungen z\u00e4hlen \u00b7 automatisch erkannt" />' + NL +
'                            <ModRow status={inactivityOn ? "ok" : "disabled"} label="Inaktivit\u00e4ts-Alarm" version="v0.30" detail={inactivityOn ? "Stille-Erkennung \u00b7 Gelb >" + (native?.inactivityThresholdHours || 4) + "h \u00b7 Rot >8h" : "Deaktiviert"} />' + NL +
NL +
// ── SECTION 2: Gesundheits-Analytik ──
'                            <SectionHeader icon="\uD83E\uDE7A" label="GESUNDHEITS-ANALYTIK" color="#00e676" />' + NL +
'                            <ModRow status={hallwayCount > 0 ? "ok" : "warn"} label="Ganggeschwindigkeit" version="v0.28" detail={hallwayCount > 0 ? hallwayCount + " Flur-Sensoren \u00b7 Transit-Zeit in Sekunden (Median)" : "\u26a0 Keine Flur-Sensoren \u2192 Admin \u2192 Sensoren"} />' + NL +
'                            <ModRow status={devices.length > 0 ? "ok" : "warn"} label="Aktivit\u00e4ts-Normalisierung" version="v0.30.74" detail="Personalisierter Median \u00b7 14-Tage-Baseline \u00b7 0\u2013200 % Anzeige" />' + NL +
'                            <ModRow status={devices.length > 0 ? "ok" : "warn"} label="Langzeit-Trendanalyse" version="v0.30.60" detail="Lineare Regression \u00b7 7 / 30 / 180 Tage \u00b7 Garmin-Style Charts" />' + NL +
NL +
// ── SECTION 3: Anomalie & KI ──
'                            <SectionHeader icon="\uD83E\uDD16" label="ANOMALIE-ERKENNUNG & KI" color="#ff9800" />' + NL +
'                            <ModRow status="warn" label="Tages-Anomalie (IsolationForest)" version="v0.25" detail="96-Dim Aktivit\u00e4tsvektor \u00b7 Auto-Training ab 7 Digests \u00b7 l\u00e4uft t\u00e4glich" />' + NL +
'                            <ModRow status="warn" label="Nacht-Anomalie (IsolationForest)" version="v0.25" detail="20-Dim Nacht-Slots \u00b7 personalisiert auf Schlaf-History" />' + NL +
'                            <ModRow status={hasGemini ? "ok" : "error"} label="KI-Tagesbericht (Gemini)" version="v0.29" detail={hasGemini ? "Gemini Flash \u00b7 Flie\u00dftext aus Event-Kontext \u00b7 t\u00e4glich 23:59" : "Kein Gemini API-Key"} />' + NL +
'                            <ModRow status={hasGemini ? "ok" : "error"} label="KI-Nachtbericht (Gemini)" version="v0.29" detail={hasGemini ? "Gemini Flash \u00b7 Schlaf-Zusammenfassung \u00b7 t\u00e4glich 06:00" : "Kein Gemini API-Key"} />' + NL +
'                            <ModRow status={hasGemini ? "ok" : "error"} label="Baseline-Drift (LLM)" version="v0.30.60" detail={hasGemini ? "Gemini \u00b7 LTB vs. STB Vergleich \u00b7 Text-Badge im Dashboard" : "Kein Gemini API-Key"} />' + NL +
'                            <ModRow status="observe" label="Graduelle Drift-Erkennung (Page-Hinkley)" version="v0.30.74" detail="4 Metriken \u00b7 Kalibrierungsphase \u00b7 Alarm ab Schwellwert-\u00dcberschreitung" />' + NL +
NL +
// ── SECTION 4: Benachrichtigungen ──
'                            <SectionHeader icon="\uD83D\uDD14" label="BERICHTE & BENACHRICHTIGUNGEN" color="#9c27b0" />' + NL +
'                            <ModRow status={briefingOk ? "ok" : !hasPushover ? "warn" : "disabled"} label="Morgenbriefing (Pushover)" version="\u2013" detail={briefingOk ? "Aktiv \u00b7 " + (native?.briefingTime || "08:00") + " Uhr" : hasPushover ? "Deaktiviert in Einstellungen" : "Pushover nicht aktiv"} />' + NL +
'                            <ModRow status={weeklyOk ? "ok" : !hasPushover ? "warn" : "disabled"} label="Wochenbericht (Pushover)" version="\u2013" detail={weeklyOk ? "Aktiv \u00b7 Sonntag " + (native?.weeklyBriefingTime || "09:00") + " Uhr" : hasPushover ? "Deaktiviert in Einstellungen" : "Pushover nicht aktiv"} />' + NL +
NL +
// ── SECTION 5: Geplant ──
'                            <SectionHeader icon="\uD83D\uDD2C" label="IN PLANUNG" color="#546e7a" />' + NL +
'                            <ModRow status="planned" label="Zirkadiane Rhythmus-Analyse" version="\u2013" detail="Fourier-Analyse \u00b7 Schlaf-/Wach-Verschiebung als Fr\u00fchindikator" />' + NL +
'                            <ModRow status="planned" label="LSTM Sequenz-Vorhersage" version="\u2013" detail="Zeitlich bewusste Anomalie: \u201eUm 07:30 erwarte ich K\u00fcche\u201c" />' + NL +
'                            <ModRow status="planned" label="Kalender-Kontext" version="\u2013" detail="Feiertage, Besuch, Jahreszeit \u2014 weniger Fehlalarme" />' + NL +
'                        </Box>' + NL +
'                    );' + NL +
'                })()}' + NL +
'            </AccordionDetails>' + NL +
'        </Accordion>' + NL;

// ─── Step 4: Assemble the fixed file ─────────────────────────────────────────
const newSrc = beforeModule + '\n' + deadManClose + ACCORDION + afterClose;

// Verify
const checks = ['Bewegungserkennung', 'Ganggeschwindigkeit', 'IsolationForest', 'Gemini', 'Page-Hinkley', 'LSTM', 'Modul\u00fcbersicht'];
let ok = true;
for (const c of checks) {
    if (!newSrc.includes(c)) { console.error('MISSING: ' + c); ok = false; }
    else console.log('  OK: ' + c);
}
if (!ok) process.exit(1);

// Check that Module is NOT inside Dead Man (Dead Man should come before Module)
const dmPos  = newSrc.indexOf('Dead Man');
const modPos = newSrc.indexOf('Modul\u00fcbersicht');
console.log('Dead Man at:', dmPos, '| Module at:', modPos, '| Correct order:', dmPos < modPos);
if (dmPos >= modPos) { console.error('Module still inside Dead Man!'); process.exit(1); }

fs.writeFileSync(f, newSrc.replace(/\n/g, '\r\n'), 'utf8');
console.log('\nSaved (' + newSrc.split('\n').length + ' lines)');
