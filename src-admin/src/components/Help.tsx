import React from 'react';
import { Box, Paper, Typography, Divider, List, ListItem, ListItemText, Accordion, AccordionSummary, AccordionDetails, Alert, Chip, Stack } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SecurityIcon from '@mui/icons-material/Security';
import BedIcon from '@mui/icons-material/Bed';
import BugReportIcon from '@mui/icons-material/BugReport';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import CodeIcon from '@mui/icons-material/Code';
import StorageIcon from '@mui/icons-material/Storage';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import GavelIcon from '@mui/icons-material/Gavel';
import ScienceIcon from '@mui/icons-material/Science';
import type { ThemeType } from '@iobroker/adapter-react-v5';

// Version: 0.30.3 (Sync: Version Bump)

interface HelpProps {
    themeType: ThemeType;
}

const Help: React.FC<HelpProps> = ({ themeType }) => {
    const isDark = themeType === 'dark';

    // Dark Mode optimierte Farben
    const disclaimerBg = isDark ? 'rgba(211, 47, 47, 0.15)' : '#fff5f5';
    const disclaimerBorder = isDark ? '#ef5350' : '#d32f2f';
    const disclaimerText = isDark ? '#ffcdd2' : '#d32f2f';
    const paperBg = isDark ? '#1e1e1e' : '#fff';
    const boxBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
    const codeBg = isDark ? '#2d2d2d' : '#f5f5f5';
    const codeColor = isDark ? '#a5d6ff' : '#0d47a1';

    return (
        <Box sx={{ p: 3, maxWidth: '1000px', margin: '0 auto' }}>
            <Typography variant="h4" gutterBottom>📖 Handbuch & System-Architektur</Typography>

            {/* DISCLAIMER */}
            <Paper variant="outlined" sx={{ mb: 4, border: `2px solid ${disclaimerBorder}`, bgcolor: disclaimerBg }}>
                <Accordion defaultExpanded sx={{bgcolor: 'transparent', color: isDark ? '#fff' : 'inherit'}}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={{color: disclaimerText}} />}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: disclaimerText, fontWeight: 'bold' }}>
                            <GavelIcon /> 0. WICHTIGER RECHTLICHER HINWEIS (Disclaimer)
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Typography variant="body1" paragraph fontWeight="bold">
                            Diese Software ist KEIN Medizinprodukt gemäß der Verordnung (EU) 2017/745 (MDR).
                        </Typography>
                        <Typography variant="body2" paragraph>
                            1. <strong>Zweckbestimmung:</strong> Cogni-Living dient ausschließlich der Unterstützung der allgemeinen Lebensführung (Ambient Assisted Living), dem Komfort und reinen Informationszwecken.
                        </Typography>
                        <Typography variant="body2" paragraph>
                            2. <strong>Keine Diagnose/Therapie:</strong> Die bereitgestellten Daten, Analysen, Gesundheits-Scores und Alarme sind nicht dazu geeignet, Krankheiten zu diagnostizieren, zu behandeln, zu heilen oder zu verhindern. Sie ersetzen keinesfalls die fachliche Beratung, Diagnose oder Behandlung durch einen Arzt.
                        </Typography>
                        <Typography variant="body2" paragraph>
                            3. <strong>Haftungsausschluss:</strong> Verlassen Sie sich in gesundheitlichen Notfällen nicht auf diese Software. Bei gesundheitlichen Beschwerden konsultieren Sie bitte sofort medizinisches Fachpersonal. Der Entwickler übernimmt keine Haftung für Schäden, die aus der Nutzung, Fehlfunktion oder Interpretation der Daten entstehen.
                        </Typography>
                    </AccordionDetails>
                </Accordion>
            </Paper>

            <Paper variant="outlined" sx={{ mb: 3, bgcolor: paperBg }}>

                {/* 1. Einrichtung */}
                <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AutoFixHighIcon color="primary" /> 1. Einrichtung & Auto-Discovery
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <List dense>
                            <ListItem><ListItemText primary="Schritt A: Lizenz & KI" secondary="Geben Sie im Tab 'Einstellungen' Ihren Google Gemini API Key ein." /></ListItem>
                            <ListItem><ListItemText primary="Schritt B: Sensoren finden" secondary="Nutzen Sie den 'Auto-Discovery Wizard'. Die Erkennung basiert auf einer Heuristik (Gerätenamen, Rollen)." /></ListItem>
                            <ListItem><ListItemText primary="Schritt C: Kontext" secondary="Beschreiben Sie im Feld 'Wohnkontext' die Situation (z.B. 'Rentnerin, 82, lebt allein')." /></ListItem>
                        </List>
                    </AccordionDetails>
                </Accordion>

                {/* 2. Modi */}
                <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SecurityIcon color="warning" /> 2. Sicherheits-Modi
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <List dense>
                            <ListItem><ListItemText primary="NORMAL" secondary="Standard-Analyse (Inaktivität, Routinen)." /></ListItem>
                            <ListItem><ListItemText primary="URLAUB" secondary="Haus leer. Jede Bewegung ist Alarm." /></ListItem>
                            <ListItem><ListItemText primary="PARTY / GAST" secondary="Tolerant. Ignoriert späte Zeiten. Reset 04:00 Uhr." /></ListItem>
                        </List>
                    </AccordionDetails>
                </Accordion>

                {/* 3. NEURO-LOGIK */}
                <Accordion defaultExpanded sx={{ borderLeft: '4px solid #2196f3' }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <BedIcon color="info" /> 3. Die Neuro-Architektur (3-Phasen-Modell)
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Typography variant="body2" paragraph>
                            Das System überwacht die Gesundheit auf drei zeitlichen Ebenen. Jede Ebene adressiert ein spezifisches medizinisches Risiko und nutzt eine eigene technische Erkennungsmethode.
                        </Typography>

                        <Divider sx={{ my: 2 }} />

                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle1" fontWeight="bold" color="error">Phase 1: Der Sofort-Schutz (Ad-Hoc / Realtime)</Typography>
                            <Stack direction="row" spacing={1} sx={{ mb: 1, mt: 0.5 }}>
                                <Chip icon={<MedicalServicesIcon/>} label="Sturz / Schlaganfall" size="small" color="error" variant="outlined" />
                                <Chip icon={<CodeIcon/>} label="Dynamic Prompting" size="small" color="default" variant="outlined" />
                            </Stack>
                            <Typography variant="body2" paragraph>
                                <strong>Das medizinische Ziel:</strong> Erkennung von unmittelbaren Notfällen (z.B. Person stürzt morgens auf dem Weg zur Küche und steht nicht mehr auf).
                            </Typography>
                            <Typography variant="body2" paragraph>
                                <strong>Das technische Problem:</strong> Ein starrer Timer ("Alarm nach 12h Inaktivität") ist oft zu langsam. Wenn um 06:00 Uhr Bewegung war, käme der Alarm erst um 18:00 Uhr – viel zu spät.
                            </Typography>
                            <Typography variant="body2" sx={{ bgcolor: boxBg, p: 1, borderRadius: 1, fontStyle: 'italic' }}>
                                <strong>Die KI-Lösung ("Erwartungshaltung"):</strong><br/>
                                Das System sendet bei jedem Check (alle 15 min) einen speziellen <code>dynamicSafetyPrompt</code> an die KI: <br/>
                                <em>"Ist es basierend auf der Uhrzeit verdächtig still? Fehlt eine Routine, die normalerweise jetzt stattfindet?"</em><br/>
                                Beispiel: Es ist 08:30 Uhr. Normalerweise ist jetzt Aktivität im Flur. Heute nicht. &rarr; <strong>Sofortiger Alarm</strong>, obwohl der 12h-Timer noch nicht abgelaufen ist.
                            </Typography>
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle1" fontWeight="bold" color="warning.main">Phase 2: Die Akute Abweichung (STB / 14 Tage)</Typography>
                            <Stack direction="row" spacing={1} sx={{ mb: 1, mt: 0.5 }}>
                                <Chip icon={<MedicalServicesIcon/>} label="Infekt / Akute Erkrankung" size="small" color="warning" variant="outlined" />
                                <Chip icon={<StorageIcon/>} label="Short-Term Baseline (STB)" size="small" color="default" variant="outlined" />
                            </Stack>
                            <Typography variant="body2" paragraph>
                                <strong>Das medizinische Ziel:</strong> Erkennung von plötzlich auftretenden Krankheiten (z.B. Harnwegsinfekt, Magen-Darm, akute Schlafstörung).
                            </Typography>
                            <Typography variant="body2" paragraph>
                                <strong>Die Informatik-Logik:</strong> <br/>
                                Das System bildet einen gleitenden Durchschnitt der letzten 14 Tage (STB).<br/>
                                <em>Vergleich:</em> <code>Heute</code> vs. <code>STB (Ø 14 Tage)</code>.
                            </Typography>
                            <Typography variant="body2" sx={{ bgcolor: boxBg, p: 1, borderRadius: 1 }}>
                                <strong>Beispiel:</strong><br/>
                                Baseline (14 Tage): Ø 3 Toilettengänge/Nacht.<br/>
                                Heute: 5 Toilettengänge.<br/>
                                &rarr; <strong>Warnung:</strong> Signifikante Abweichung vom Kurzzeit-Mittelwert.
                            </Typography>
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle1" fontWeight="bold" color="primary">Phase 3: Der Schleichende Drift (LTB / 60 Tage)</Typography>
                            <Stack direction="row" spacing={1} sx={{ mb: 1, mt: 0.5 }}>
                                <Chip icon={<MedicalServicesIcon/>} label="Demenz / Depression / Chronisch" size="small" color="primary" variant="outlined" />
                                <Chip icon={<StorageIcon/>} label="Long-Term Baseline (LTB)" size="small" color="default" variant="outlined" />
                            </Stack>
                            <Typography variant="body2" paragraph>
                                <strong>Das medizinische Ziel:</strong> Erkennung von langsamen Veränderungen, die im Tagesvergleich untergehen (z.B. abnehmende Mobilität, Vereinsamung, sich verfestigende Schlafstörungen).
                            </Typography>
                            <Typography variant="body2" paragraph>
                                <strong>Das Risiko ("Learning Crux"):</strong> Wenn eine Person krank wird und 5 Tage lang 5x nachts aufsteht, darf die KI das nicht sofort als "neues Normal" akzeptieren.
                            </Typography>
                            <Typography variant="body2" sx={{ bgcolor: boxBg, p: 1, borderRadius: 1 }}>
                                <strong>Die Lösung (Der Anker):</strong><br/>
                                Wir nutzen einen sehr trägen Langzeit-Wert (LTB = 60 Tage).<br/>
                                <em>Vergleich:</em> <code>STB (letzte 2 Wochen)</code> vs. <code>LTB (letzte 2 Monate)</code>.<br/><br/>
                                Selbst wenn die letzten 14 Tage (STB) schlecht waren, bleibt der LTB (60 Tage) stabil und dient als Referenz für Gesundheit. Erst wenn ein Zustand über Monate anhält, passt sich der LTB an. Dies verhindert, dass akute Krankheiten fälschlicherweise als Normalität gelernt werden.
                            </Typography>
                        </Box>
                    </AccordionDetails>
                </Accordion>

                {/* 4. KOMFORT & AUTOMATION */}
                <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LightbulbIcon color="secondary" /> 4. Der Butler (Komfort & Automation)
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Typography variant="body2" paragraph>
                            Neben der Gesundheit überwacht die KI auch Komfort-Muster ("Pattern Recognition").
                        </Typography>
                        <Typography variant="body2" paragraph>
                            <strong>Wie funktioniert das?</strong><br/>
                            Die KI analysiert Zusammenhänge zwischen Ereignissen. <br/>
                            <em>Beispiel:</em> "Jeden Morgen um 07:00 Uhr, wenn Bewegung im Flur erkannt wird, schaltet der Bewohner 2 Minuten später das Licht im Bad an."
                        </Typography>
                        <Typography variant="body2" sx={{ bgcolor: boxBg, p: 1, borderRadius: 1 }}>
                            <strong>Vorschlags-System:</strong><br/>
                            Wenn die KI ein solches Muster über mehrere Tage stabil erkennt (Konfidenz &gt; 80%), generiert sie einen <strong>Automatisierungs-Vorschlag</strong>. Dieser erscheint im Cockpit oder als Benachrichtigung.
                        </Typography>
                    </AccordionDetails>
                </Accordion>

                {/* 5. INTERAKTIVE ALARME */}
                <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <NotificationsActiveIcon color="error" /> 5. Interaktive Alarme (Family Link)
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Typography variant="body2" paragraph>
                            Um Panik bei Fehlalarmen zu vermeiden, unterscheiden sich die Benachrichtigungsdienste in ihrer Funktion:
                        </Typography>
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" fontWeight="bold">🤖 Telegram (Interaktiv)</Typography>
                            <Typography variant="body2">
                                Sendet Alarme mit <strong>Action-Buttons</strong> direkt im Chat:
                                <ul>
                                    <li><code>[✅ Alles OK (Reset)]</code>: Setzt den Alarm im System sofort zurück. Die KI lernt, dass dies ein Fehlalarm war.</li>
                                    <li><code>[📞 Rückruf anfordern]</code>: Sendet eine Bestätigung an das System, dass sich jemand kümmert.</li>
                                </ul>
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="subtitle2" fontWeight="bold">📣 Pushover (Notfall-Sirene)</Typography>
                            <Typography variant="body2">
                                Dient als "Wecker". Kritische Alarme werden mit <strong>Priorität 2 (Emergency)</strong> gesendet und müssen in der Pushover-App bestätigt werden (<strong>"Acknowledge"</strong>), um den Ton zu stoppen.
                            </Typography>
                        </Box>
                    </AccordionDetails>
                </Accordion>

                {/* 6. Troubleshooting */}
                <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <BugReportIcon color="error" /> 6. Troubleshooting
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <List dense>
                            <ListItem><ListItemText primary="Sensoren fehlen?" secondary="Prüfen Sie ioBroker Räume/Funktionen oder nutzen Sie die Whitelist im Wizard." /></ListItem>
                            <ListItem><ListItemText primary="Status 'N/A'?" secondary="Drift-Analyse benötigt mind. 30 Tage Daten." /></ListItem>
                        </List>
                    </AccordionDetails>
                </Accordion>

                {/* 8. SCHLAFANALYSE OC-7 */}
                <Accordion defaultExpanded sx={{ borderLeft: '4px solid #ab47bc' }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <BedIcon color="secondary" /> 8. Schlafanalyse (OC-7) & AURA-Sleepscore
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Typography variant="body2" paragraph>
                            Die OC-7-Kachel berechnet aus <strong>Vibrationssensor-Daten</strong> geschätzte Schlafphasen und einen Gesundheitsscore. Optional wird ein FP2-Präsenzradar für präzise Zeiten genutzt.
                        </Typography>
                        <Typography variant="body2" paragraph>
                            <strong>Sensor-Anforderungen (Graceful Degradation):</strong><br/>
                            • <strong>Voll aktiv:</strong> FP2-Radar (Bett) + Vibrationssensor → Zeiten + Phasen + Events<br/>
                            • <strong>Eingeschränkt:</strong> Nur Vibrationssensor → Phasen mit festem 20–09 Uhr Fenster<br/>
                            • <strong>Minimal:</strong> Kein Sensor → Kachel zeigt Hinweis zur Konfiguration
                        </Typography>
                        <Box sx={{ bgcolor: boxBg, p: 1.5, borderRadius: 1, mb: 2 }}>
                            <Typography variant="subtitle2" fontWeight="bold">AURA-Sleepscore Formel:</Typography>
                            <Box sx={{ bgcolor: codeBg, color: codeColor, p: 1, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.75rem', mt: 1 }}>
                                Score = Tief% × 200 + REM% × 150 + Leicht% × 80 − Wach% × 250<br/>
                                Score = min(100, max(0, Score))<br/>
                                Bonus: +5 wenn Schlafdauer 7–9h
                            </Box>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                Wissenschaftliche Grundlage: <em>Diekelmann &amp; Born 2010</em> (Tiefschlaf), <em>Walker 2017; Stickgold 2005</em> (REM), <em>Buysse et al. 1989 PSQI</em> (Wach-Abzug). Garmin-Score nutzt zusätzlich HRV + SpO2 → tendenziell höher als AURA-Score.
                            </Typography>
                        </Box>
                        <Typography variant="body2">
                            <strong>Sensor-Indikator unter Einschlafen/Aufwachen:</strong><br/>
                            • 📡 FP2-Sensor: Zeiten aus FP2-Präsenzradar (genaueste Methode)<br/>
                            • ⏰ Schätzung: Festes 20:00–09:00 Fenster (kein Raumsensor)<br/><br/>
                            <strong>Aufwachzeit: ⟳ vorläufig / ✓ bestätigt:</strong><br/>
                            Wird bestätigt wenn nach 10:00 Uhr das Bett ≥1h leer war. Bis dahin als vorläufig markiert, da ein Zurücklegen noch möglich ist.<br/><br/>
                            <strong>Balkenfarben:</strong> Dunkelblau = Tief, Hellblau = Leicht, Lila = REM, Gelb = Wach im Bett, Bernstein = Bad-Besuch, Orange-Rot = Außerhalb<br/><br/>
                            <strong>Sleep-Freeze:</strong> Eine bestätigte Nacht (≥3h Bettbelegung, Aufwachzeit vor 14:00 Uhr) wird nicht mehr durch spätere Aktivität oder Mittagsschlaf überschrieben.
                        </Typography>
                    </AccordionDetails>
                </Accordion>

                {/* 7. HYBRID INTELLIGENCE & INSTALLATION (NEU) */}
                <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ScienceIcon color="success" /> 7. Hybrid-Engine & Installation
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Alert severity="warning" sx={{mb: 2}}>
                            <strong>Manuelle Installation erforderlich (SSH / Putty)!</strong><br/>
                            Um maximale Stabilität zu gewährleisten, lädt der Adapter keine System-Dateien mehr automatisch herunter.
                            Die Installation erfolgt einmalig per Konsole.
                        </Alert>

                        <Typography variant="body2" paragraph>
                            Cogni-Living nutzt eine Hybrid-Architektur (Node.js + Python). Damit die KI arbeiten kann, müssen Sie das Python-Environment vorbereiten. Dies dauert ca. 5-10 Minuten.
                        </Typography>

                        <Divider sx={{my: 2}} />

                        <Typography variant="subtitle2" gutterBottom color="primary.main">Schritt 1: System-Voraussetzungen (Debian / Proxmox)</Typography>
                        <Typography variant="body2" paragraph>
                            Stellen Sie sicher, dass Ihr Linux-System Pakete für virtuelle Umgebungen ("venv") installiert hat.
                            <br/><em>(Ohne das Paket "python3-venv" schlägt die Erstellung fehl!)</em>
                        </Typography>

                        <Box sx={{bgcolor: codeBg, color: codeColor, p: 1.5, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.75rem', mb: 2, overflowX: 'auto'}}>
                            sudo apt update && sudo apt install -y python3-venv python3-pip python3-dev build-essential
                        </Box>

                        <Divider sx={{my: 2}} />

                        <Typography variant="subtitle2" gutterBottom color="primary.main">Schritt 2: Environment erstellen (Das "Gehirn")</Typography>
                        <Typography variant="body2" paragraph>
                            Führen Sie folgende Befehle nacheinander aus. Nutzen Sie <code>sudo</code>, um Berechtigungsfehler zu vermeiden.
                            Am Ende reparieren wir die Rechte für den User "iobroker".
                        </Typography>

                        <Box sx={{bgcolor: codeBg, color: codeColor, p: 1.5, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.75rem', mb: 2, overflowX: 'auto', whiteSpace: 'pre-wrap'}}>
                            {`# 1. Zum KORREKTEN Adapter-Ordner navigieren
cd /opt/iobroker/node_modules/iobroker.cogni-living

# 2. Tabula Rasa: Alles Alte löschen (wichtig!)
sudo rm -rf .venv venv

# 3. Das "Skelett" erstellen
sudo python3 -m venv .venv

# 4. Pip aktualisieren
sudo ./.venv/bin/pip install --upgrade pip setuptools wheel --no-cache-dir

# 5. Die Intelligenz installieren (Pandas, Numpy, PyTorch)
# HINWEIS: Wir installieren PyTorch zuerst als CPU-Version, um Speicher zu sparen!
sudo ./.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu --no-cache-dir
sudo ./.venv/bin/pip install -r python_service/requirements.txt --no-cache-dir

# 6. WICHTIG: Rechte an ioBroker übergeben
sudo chown -R iobroker:iobroker .venv`}
                        </Box>

                        <Typography variant="body2">
                            Starten Sie den Adapter danach im ioBroker Admin neu. <br/>
                            Er sollte nun sofort (innerhalb von Sekunden) grün werden und melden: <br/>
                            <code>✅ Python Environment detected & healthy. Ready.</code>
                        </Typography>
                    </AccordionDetails>
                </Accordion>

            </Paper>
        </Box>
    );
};

export default Help;