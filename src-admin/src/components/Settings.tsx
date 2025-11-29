import React from 'react';
import { Button, Checkbox, CircularProgress, FormControl, IconButton, InputLabel, MenuItem, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Snackbar, Alert, Box, Paper, FormControlLabel, Grid, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemButton, ListItemText, ListItemIcon, LinearProgress, FormGroup, Collapse, Accordion, AccordionSummary, AccordionDetails, Typography, Divider } from '@mui/material';
import type { AlertColor } from '@mui/material';

// KEINE ICON IMPORTS MEHR (Verursacher des Absturzes eliminiert)

import { I18n, DialogSelectID, type IobTheme, type ThemeType } from '@iobroker/adapter-react-v5';
import type { Connection } from '@iobroker/socket-client';

interface SettingsProps { native: Record<string, any>; onChange: (attr: string, value: any) => void; socket: Connection; themeType: ThemeType; adapterName: string; instance: number; theme: IobTheme; }
interface DeviceConfig { id: string; name: string; location: string; type: string; logDuplicates: boolean; isExit: boolean; }
interface ScannedDevice extends DeviceConfig { selected?: boolean; _score?: number; exists?: boolean; }
interface ScanFilters { motion: boolean; doors: boolean; lights: boolean; temperature: boolean; weather: boolean; selectedFunctionIds: string[]; }
interface EnumItem { id: string; name: string; }

interface SettingsState {
    devices: DeviceConfig[];
    presenceDevices: string[];
    outdoorSensorId: string;
    geminiApiKey: string;
    analysisInterval: number;
    minDaysForBaseline: number;
    aiPersona: string;
    livingContext: string;
    licenseKey: string;
    ltmStbWindowDays: number;
    ltmLtbWindowDays: number;
    ltmDriftCheckIntervalHours: number;
    inactivityMonitoringEnabled: boolean;
    inactivityThresholdHours: number;
    notifyTelegramEnabled: boolean;
    notifyTelegramInstance: string;
    notifyTelegramRecipient: string;
    notifyPushoverEnabled: boolean;
    notifyPushoverInstance: string;
    notifyPushoverRecipient: string;
    notifyEmailEnabled: boolean;
    notifyEmailInstance: string;
    notifyEmailRecipient: string;
    notifyWhatsappEnabled: boolean;
    notifyWhatsappInstance: string;
    notifyWhatsappRecipient: string;
    notifySignalEnabled: boolean;
    notifySignalInstance: string;
    notifySignalRecipient: string;
    briefingEnabled: boolean;
    briefingTime: string;
    useWeather: boolean;
    weatherInstance: string;
    useCalendar: boolean;
    calendarInstance: string;
    calendarSelection: string[];
    availableInstances: Record<string, string[]>;
    isTestingNotification: boolean;
    showSelectId: boolean;
    selectIdIndex: number;
    selectIdContext: 'device' | 'presence' | 'simulation' | 'outdoor' | null;
    isTestingApi: boolean;
    showWizard: boolean;
    wizardStep: number;
    scanFilters: ScanFilters;
    scannedDevices: ScannedDevice[];
    showDeleteConfirm: boolean;
    availableEnums: EnumItem[];
    showEnumList: boolean;
    snackbarOpen: boolean;
    snackbarMessage: string;
    snackbarSeverity: AlertColor;
    expandedAccordion: string | false;
    showContextDialog: boolean;
    contextResult: { weather: string; calendar: string; } | null;
    isTestingContext: boolean;
    detectedCalendars: string[];
    isLoadingCalendars: boolean;
    simTargetId: string;
    simTargetValue: string;
}

type NotificationEnabledKey = 'notifyTelegramEnabled' | 'notifyPushoverEnabled' | 'notifyEmailEnabled' | 'notifyWhatsappEnabled' | 'notifySignalEnabled';
type NotificationInstanceKey = 'notifyTelegramInstance' | 'notifyPushoverInstance' | 'notifyEmailInstance' | 'notifyWhatsappInstance' | 'notifySignalInstance';
type NotificationRecipientKey = 'notifyTelegramRecipient' | 'notifyPushoverRecipient' | 'notifyEmailRecipient' | 'notifyWhatsappRecipient' | 'notifySignalRecipient';

// HIER IST DAS WICHTIGE DROPDOWN (Damit die KI es versteht)
const SENSOR_TYPES = [
    { id: 'motion', label: 'Bewegungsmelder (Motion)' },
    { id: 'door', label: 'Tür / Fenster (Door)' },
    { id: 'temperature', label: 'Temperatur / Klima' },
    { id: 'light', label: 'Licht / Schalter (Light)' },
    { id: 'blind', label: 'Rollladen / Jalousie' },
    { id: 'lock', label: 'Schloss (Lock)' },
    { id: 'custom', label: 'Sonstiges (Custom)' }
];

export default class Settings extends React.Component<SettingsProps, SettingsState> {
    constructor(props: SettingsProps) {
        super(props);
        const native = props.native;
        let calSel = native.calendarSelection || [];
        if (typeof calSel === 'string') calSel = calSel.split(',').filter((s:string) => s);

        this.state = {
            devices: native.devices || [],
            presenceDevices: native.presenceDevices || [],
            outdoorSensorId: native.outdoorSensorId || '',
            geminiApiKey: native.geminiApiKey || '',
            analysisInterval: native.analysisInterval || 15,
            minDaysForBaseline: native.minDaysForBaseline || 7,
            aiPersona: native.aiPersona || 'generic',
            livingContext: native.livingContext || '',
            licenseKey: native.licenseKey || '',
            ltmStbWindowDays: native.ltmStbWindowDays || 14,
            ltmLtbWindowDays: native.ltmLtbWindowDays || 60,
            ltmDriftCheckIntervalHours: native.ltmDriftCheckIntervalHours || 24,
            inactivityMonitoringEnabled: native.inactivityMonitoringEnabled || false,
            inactivityThresholdHours: native.inactivityThresholdHours || 12,
            notifyTelegramEnabled: native.notifyTelegramEnabled || false,
            notifyTelegramInstance: native.notifyTelegramInstance || '',
            notifyTelegramRecipient: native.notifyTelegramRecipient || '',
            notifyPushoverEnabled: native.notifyPushoverEnabled || false,
            notifyPushoverInstance: native.notifyPushoverInstance || '',
            notifyPushoverRecipient: native.notifyPushoverRecipient || '',
            notifyEmailEnabled: native.notifyEmailEnabled || false,
            notifyEmailInstance: native.notifyEmailInstance || '',
            notifyEmailRecipient: native.notifyEmailRecipient || '',
            notifyWhatsappEnabled: native.notifyWhatsappEnabled || false,
            notifyWhatsappInstance: native.notifyWhatsappInstance || '',
            notifyWhatsappRecipient: native.notifyWhatsappRecipient || '',
            notifySignalEnabled: native.notifySignalEnabled || false,
            notifySignalInstance: native.notifySignalInstance || '',
            notifySignalRecipient: native.notifySignalRecipient || '',
            briefingEnabled: native.briefingEnabled || false,
            briefingTime: native.briefingTime || "08:00",
            useWeather: native.useWeather || false,
            weatherInstance: native.weatherInstance || '',
            useCalendar: native.useCalendar || false,
            calendarInstance: native.calendarInstance || '',
            calendarSelection: calSel,
            availableInstances: {},
            isTestingNotification: false,
            showSelectId: false,
            selectIdIndex: -1,
            selectIdContext: null,
            isTestingApi: false,
            showWizard: false,
            wizardStep: 0,
            scanFilters: { motion: true, doors: true, lights: true, temperature: false, weather: false, selectedFunctionIds: [] },
            scannedDevices: [],
            showDeleteConfirm: false,
            availableEnums: [],
            showEnumList: false,
            snackbarOpen: false,
            snackbarMessage: '',
            snackbarSeverity: 'info',
            expandedAccordion: 'panel1',
            showContextDialog: false,
            contextResult: null,
            isTestingContext: false,
            detectedCalendars: [],
            isLoadingCalendars: false,
            simTargetId: '',
            simTargetValue: 'true'
        };
    }

    componentDidMount() { this.fetchAvailableInstances(); this.fetchEnums(); }
    fetchAvailableInstances() { const adapters = ['telegram', 'pushover', 'email', 'whatsapp-cmb', 'signal-cma', 'accuweather', 'daswetter', 'ical']; const instances: Record<string, string[]> = {}; const promises = adapters.map(adapter => this.props.socket.getAdapterInstances(adapter).then(objs => { instances[adapter] = objs.map(obj => obj._id.replace('system.adapter.', '')); }).catch(e => console.error(`Error fetching instances for ${adapter}:`, e))); Promise.all(promises).then(() => { this.setState({ availableInstances: instances }); }); }
    fetchEnums() { this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'getEnums', {}).then((res: any) => { if(res && res.success && res.enums) { this.setState({ availableEnums: res.enums }); } }); }

    updateNativeValue(attr: string, value: any) { if (attr === 'livingContext' && typeof value === 'string' && value.length > 1000) value = value.substring(0, 1000); this.setState({ [attr]: value } as Pick<SettingsState, keyof SettingsState>, () => { this.props.onChange(attr, value); }); }
    updateDevices(newDevices: DeviceConfig[]) { this.setState({ devices: newDevices }); this.props.onChange('devices', newDevices); }
    updatePresenceDevices(newPresenceDevices: string[]) { this.setState({ presenceDevices: newPresenceDevices }); this.props.onChange('presenceDevices', newPresenceDevices); }

    handleAccordionChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => { this.setState({ expandedAccordion: isExpanded ? panel : false }); };
    onAddDevice() { const devices = JSON.parse(JSON.stringify(this.state.devices)); devices.push({ id: '', name: '', location: '', type: 'motion', logDuplicates: false, isExit: false }); this.updateDevices(devices); }
    onDeviceChange(index: number, attr: keyof DeviceConfig, value: any) { const devices = JSON.parse(JSON.stringify(this.state.devices)); devices[index][attr] = value; this.updateDevices(devices); }
    onDeleteDevice(index: number) { const devices = JSON.parse(JSON.stringify(this.state.devices)); devices.splice(index, 1); this.updateDevices(devices); }
    onDeleteAllDevices = () => { this.updateDevices([]); this.setState({ showDeleteConfirm: false }); this.showSnackbar('Alle Sensoren gelöscht.', 'info'); }
    onAddPresenceDevice() { this.setState({ showSelectId: true, selectIdContext: 'presence', selectIdIndex: -1 }); }
    openOutdoorSelectId() { this.setState({ showSelectId: true, selectIdContext: 'outdoor', selectIdIndex: -1 }); }

    openSelectIdDialog(index: number) { this.setState({ showSelectId: true, selectIdIndex: index, selectIdContext: 'device' }); }
    openSimSelectId() { this.setState({ showSelectId: true, selectIdContext: 'simulation' }); }

    onSelectId(selectedId?: string) {
        if (selectedId) {
            if (this.state.selectIdContext === 'device' && this.state.selectIdIndex !== -1) {
                const devices = JSON.parse(JSON.stringify(this.state.devices));
                devices[this.state.selectIdIndex].id = selectedId;
                this.props.socket.getObject(selectedId).then(obj => {
                    if (obj && obj.common && obj.common.name) {
                        let name: any = obj.common.name;
                        if (typeof name === 'object') name = name[I18n.getLanguage()] || name.en || name.de || JSON.stringify(name);
                        devices[this.state.selectIdIndex].name = name as string;
                        this.updateDevices(devices);
                    } else { this.updateDevices(devices); }
                }).catch(e => { this.updateDevices(devices); });
            } else if (this.state.selectIdContext === 'presence') {
                const p = [...this.state.presenceDevices];
                if (!p.includes(selectedId)) { p.push(selectedId); this.updatePresenceDevices(p); }
            } else if (this.state.selectIdContext === 'simulation') {
                this.setState({ simTargetId: selectedId });
            } else if (this.state.selectIdContext === 'outdoor') {
                this.updateNativeValue('outdoorSensorId', selectedId);
            }
        }
        this.setState({ showSelectId: false, selectIdIndex: -1, selectIdContext: null });
    }

    handleSimulateButler = () => {
        if(!this.state.simTargetId) return this.showSnackbar('Bitte zuerst eine ID auswählen', 'warning');
        this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'simulateButler', { targetId: this.state.simTargetId, targetValue: this.state.simTargetValue }).then((res: any) => { if(res && res.success) this.showSnackbar('Vorschlag simuliert! Bitte in Übersicht prüfen.', 'success'); else this.showSnackbar('Fehler bei Simulation', 'error'); });
    }

    handleOpenWizard = () => { this.setState({ showWizard: true, wizardStep: 0, scannedDevices: [] }); }
    handleFilterChange = (key: keyof ScanFilters) => { this.setState(prevState => ({ scanFilters: { ...prevState.scanFilters, [key]: !prevState.scanFilters[key] } })); }
    handleEnumToggle = (enumId: string) => { const current = [...this.state.scanFilters.selectedFunctionIds]; const index = current.indexOf(enumId); if (index === -1) current.push(enumId); else current.splice(index, 1); this.setState(prevState => ({ scanFilters: { ...prevState.scanFilters, selectedFunctionIds: current } })); }
    handleStartScan = () => { this.setState({ wizardStep: 1 }); this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'scanDevices', this.state.scanFilters).then((response: any) => { if(response && response.success && Array.isArray(response.devices)) { if (response.devices.length === 0) { this.showSnackbar('Keine Sensoren gefunden.', 'info'); this.setState({ wizardStep: 0 }); } else { const existingIds = new Set(this.state.devices.map(d => d.id)); const devices = response.devices.map((d: any) => { const exists = existingIds.has(d.id); return { ...d, exists: exists, selected: !exists && (!!d.location || d._score >= 20) }; }); this.setState({ scannedDevices: devices, wizardStep: 2 }); } } else { this.showSnackbar(`Scan fehlgeschlagen: ${response?.error}`, 'warning'); this.setState({ wizardStep: 0 }); } }).catch(e => { this.showSnackbar(`Scan Error: ${e.message}`, 'error'); this.setState({ wizardStep: 0 }); }); }
    handleToggleScannedDevice = (index: number) => { const devices = [...this.state.scannedDevices]; if (devices[index].exists) return; devices[index].selected = !devices[index].selected; this.setState({ scannedDevices: devices }); }
    handleSelectAll = () => { const devices = this.state.scannedDevices.map(d => ({ ...d, selected: !d.exists })); this.setState({ scannedDevices: devices }); }
    handleDeselectAll = () => { const devices = this.state.scannedDevices.map(d => ({ ...d, selected: false })); this.setState({ scannedDevices: devices }); }
    handleImportDevices = () => { const selected = this.state.scannedDevices.filter(d => d.selected); if(selected.length === 0) { this.setState({ showWizard: false }); return; } const currentDevices = [...this.state.devices]; let addedCount = 0; selected.forEach(newItem => { if(!currentDevices.find(d => d.id === newItem.id)) { const { selected, _score, exists, ...deviceConfig } = newItem; currentDevices.push(deviceConfig); addedCount++; } }); this.updateDevices(currentDevices); this.showSnackbar(`${addedCount} Sensoren importiert.`, 'success'); this.setState({ showWizard: false }); }
    handleTestApiClick() { if (!this.state.geminiApiKey) return this.showSnackbar(I18n.t('msg_api_key_empty'), 'warning'); this.setState({ isTestingApi: true }); this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'testApiKey', { apiKey: this.state.geminiApiKey }).then((res: any) => { this.setState({ isTestingApi: false }); this.showSnackbar(res?.success ? res.message : `${I18n.t('msg_connection_failed')}: ${res?.message}`, res?.success ? 'success' : 'error'); }); }
    handleTestNotificationClick() { this.setState({ isTestingNotification: true }); this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'testNotification', {}).then((res: any) => { this.setState({ isTestingNotification: false }); this.showSnackbar(res?.success ? res.message : `${I18n.t('msg_notification_failed')}: ${res?.message}`, res?.success ? 'success' : 'warning'); }); }
    handleTestContextClick() { this.setState({ isTestingContext: true }); this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'testContext', {}).then((res: any) => { this.setState({ isTestingContext: false }); if (res && res.success) { this.setState({ showContextDialog: true, contextResult: { weather: res.weather, calendar: res.calendar } }); } else { this.showSnackbar('Fehler beim Abrufen der Kontext-Daten.', 'error'); } }); }
    handleFetchCalendarNames() { const inst = this.state.calendarInstance || 'ical.0'; this.setState({ isLoadingCalendars: true }); const timeout = setTimeout(() => { if(this.state.isLoadingCalendars) { this.setState({ isLoadingCalendars: false }); this.showSnackbar('Zeitüberschreitung: Keine Antwort vom Adapter.', 'error'); } }, 5000); this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'getCalendarNames', { instance: inst }).then((res: any) => { clearTimeout(timeout); this.setState({ isLoadingCalendars: false }); if (res && res.success && Array.isArray(res.names)) { this.setState({ detectedCalendars: res.names }); if(res.names.length === 0) this.showSnackbar('Keine Kalender-Namen gefunden. (Sind Termine in data.table?)', 'warning'); } else { this.showSnackbar('Fehler beim Laden der Kalender.', 'error'); } }).catch(e => { clearTimeout(timeout); this.setState({ isLoadingCalendars: false }); this.showSnackbar(`Fehler: ${e.message}`, 'error'); }); }
    toggleCalendarSelection(calName: string) { const current = [...this.state.calendarSelection]; const index = current.indexOf(calName); if(index === -1) current.push(calName); else current.splice(index, 1); this.setState({ calendarSelection: current }); this.props.onChange('calendarSelection', current); }
    showSnackbar(message: string, severity: AlertColor) { this.setState({ snackbarOpen: true, snackbarMessage: message, snackbarSeverity: severity }); }
    handleSnackbarClose = (event?: React.SyntheticEvent | Event, reason?: string) => { if (reason === 'clickaway') return; this.setState({ snackbarOpen: false }); };

    renderContextDialog() { return ( <Dialog open={this.state.showContextDialog} onClose={() => this.setState({ showContextDialog: false })} maxWidth="sm" fullWidth><DialogTitle>Kontext-Daten (Live-Check)</DialogTitle><DialogContent dividers><Typography variant="subtitle2" color="primary" gutterBottom>Wetter-Status</Typography><Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}><Typography variant="body2" style={{ fontFamily: 'monospace' }}>{this.state.contextResult?.weather || 'Lade...'}</Typography></Paper><Typography variant="subtitle2" color="primary" gutterBottom>Kalender-Status (Gefiltert)</Typography><Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default', maxHeight: 200, overflow: 'auto' }}><Typography variant="body2" style={{ fontFamily: 'monospace' }}>{this.state.contextResult?.calendar || 'Lade...'}</Typography></Paper></DialogContent><DialogActions><Button onClick={() => this.setState({ showContextDialog: false })}>Schließen</Button></DialogActions></Dialog> ); }
    renderWizardDialog() { const { showWizard, wizardStep, scanFilters, scannedDevices, availableEnums, showEnumList } = this.state; return ( <Dialog open={showWizard} onClose={() => wizardStep !== 1 && this.setState({ showWizard: false })} maxWidth="md" fullWidth><DialogTitle>Auto-Discovery Wizard {wizardStep !== 1 && <IconButton onClick={() => this.setState({ showWizard: false })} sx={{ position: 'absolute', right: 8, top: 8 }}>x</IconButton>}</DialogTitle><DialogContent dividers>{wizardStep === 0 && <Box sx={{ p: 2 }}><Typography variant="h6" gutterBottom>Was soll gescannt werden?</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Die KI kann automatisch Sensoren in Ihrer ioBroker-Installation finden.</Typography><FormGroup><FormControlLabel control={<Checkbox checked={scanFilters.motion} onChange={() => this.handleFilterChange('motion')} />} label="Bewegungsmelder" /><FormControlLabel control={<Checkbox checked={scanFilters.doors} onChange={() => this.handleFilterChange('doors')} />} label="Fenster & Türen" /><FormControlLabel control={<Checkbox checked={scanFilters.lights} onChange={() => this.handleFilterChange('lights')} />} label="Lichter & Schalter" />{availableEnums.length > 0 && (<Box sx={{ mt: 2, mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}><ListItemButton onClick={() => this.setState({ showEnumList: !showEnumList })}><ListItemText primary="Spezifische Funktionen" secondary={`${scanFilters.selectedFunctionIds.length} ausgewählt`} />{showEnumList ? <span>^</span> : <span>v</span>}</ListItemButton><Collapse in={showEnumList} timeout="auto" unmountOnExit><List component="div" disablePadding dense sx={{ maxHeight: 200, overflow: 'auto' }}>{availableEnums.map((en) => (<ListItem key={en.id} dense disablePadding><ListItemButton onClick={() => this.handleEnumToggle(en.id)}><ListItemIcon><Checkbox edge="start" checked={scanFilters.selectedFunctionIds.indexOf(en.id) !== -1} tabIndex={-1} disableRipple /></ListItemIcon><ListItemText primary={en.name} secondary={en.id} /></ListItemButton></ListItem>))}</List></Collapse></Box>)}<Box sx={{ mt: 2, borderTop: '1px solid', borderColor: 'divider', pt: 1 }}><FormControlLabel control={<Checkbox checked={scanFilters.temperature} onChange={() => this.handleFilterChange('temperature')} />} label="Temperatur / Klima" /><FormControlLabel control={<Checkbox checked={scanFilters.weather} onChange={() => this.handleFilterChange('weather')} color="warning" />} label="Wetterdaten (Alle Adapter)" /></Box></FormGroup></Box>}{wizardStep === 1 && <Box sx={{ width: '100%', mt: 4, mb: 4, textAlign: 'center' }}><LinearProgress /><Typography variant="h6" sx={{ mt: 2 }}>Suche Sensoren...</Typography></Box>}{wizardStep === 2 && <Box><List dense sx={{ width: '100%', bgcolor: 'background.paper', maxHeight: 400, overflow: 'auto' }}>{scannedDevices.filter(d => d.location && !d.exists).map(d => (<ListItem key={d.id} disablePadding divider><ListItemButton onClick={() => this.handleToggleScannedDevice(scannedDevices.indexOf(d))} dense><ListItemIcon><Checkbox edge="start" checked={d.selected} tabIndex={-1} /></ListItemIcon><ListItemText primary={d.name || d.id} secondary={`${d.type} • ${d.location}`} /></ListItemButton></ListItem>))}{scannedDevices.filter(d => !d.location && !d.exists).map(d => (<ListItem key={d.id} disablePadding divider><ListItemButton onClick={() => this.handleToggleScannedDevice(scannedDevices.indexOf(d))} dense><ListItemIcon><Checkbox edge="start" checked={d.selected} tabIndex={-1} /></ListItemIcon><ListItemText primary={d.name || d.id} secondary={`${d.type} • (Kein Raum)`} /></ListItemButton></ListItem>))}{scannedDevices.filter(d => d.exists).map(d => (<ListItem key={d.id} disablePadding divider><ListItemButton dense disabled><ListItemIcon><span>OK</span></ListItemIcon><ListItemText primary={d.name || d.id} secondary="Bereits konfiguriert" /></ListItemButton></ListItem>))}</List></Box>}</DialogContent><DialogActions>{wizardStep === 0 && <Button variant="contained" onClick={this.handleStartScan}>Scan Starten</Button>}{wizardStep === 2 && (<><Button onClick={() => this.setState({ wizardStep: 0 })}>Zurück</Button><Button onClick={this.handleSelectAll}>Alle</Button><Button onClick={this.handleDeselectAll}>Keine</Button><Box sx={{ flexGrow: 1 }} /><Button variant="contained" onClick={this.handleImportDevices} color="primary">{this.state.scannedDevices.filter(d => d.selected).length} Importieren</Button></>)}</DialogActions></Dialog> ); }
    renderDialogs() { return ( <>{this.state.showSelectId && (<DialogSelectID theme={this.props.theme} imagePrefix="../.." dialogName="selectID" themeType={this.props.themeType} socket={this.props.socket} selected={this.state.selectIdContext === 'outdoor' ? this.state.outdoorSensorId : (this.state.selectIdContext === 'device' && this.state.devices[this.state.selectIdIndex]?.id) || ''} onClose={() => this.setState({ showSelectId: false })} onOk={selected => this.onSelectId(selected as string)} />)}{this.renderWizardDialog()}{this.renderContextDialog()}<Dialog open={this.state.showDeleteConfirm} onClose={() => this.setState({showDeleteConfirm:false})}><DialogTitle>Sicher?</DialogTitle><DialogContent><Typography>Alle Sensoren löschen?</Typography></DialogContent><DialogActions><Button onClick={()=>this.setState({showDeleteConfirm:false})}>Abbrechen</Button><Button onClick={this.onDeleteAllDevices} color="error">Löschen</Button></DialogActions></Dialog><Snackbar open={this.state.snackbarOpen} autoHideDuration={6000} onClose={this.handleSnackbarClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}><Alert onClose={this.handleSnackbarClose} severity={this.state.snackbarSeverity}>{this.state.snackbarMessage}</Alert></Snackbar></> ); }
    renderLicenseSection(tooltipProps: any) { return ( <Grid container spacing={3}><Grid item xs={12} md={6}><Tooltip title="Ihr Pro-Lizenzschlüssel." {...tooltipProps}><TextField fullWidth label={I18n.t('license_key')} value={this.state.licenseKey} type="password" onChange={e => this.updateNativeValue('licenseKey', e.target.value)} helperText="Für vollen Funktionsumfang" variant="outlined" size="small" /></Tooltip></Grid><Grid item xs={12} md={6}><Box sx={{display: 'flex', gap: 1}}><Tooltip title="Gemini API Key." {...tooltipProps}><TextField fullWidth label={I18n.t('gemini_api_key')} value={this.state.geminiApiKey} type="password" onChange={e => this.updateNativeValue('geminiApiKey', e.target.value)} variant="outlined" size="small" /></Tooltip><Button variant="outlined" onClick={() => this.handleTestApiClick()} disabled={this.state.isTestingApi || !this.state.geminiApiKey}>{this.state.isTestingApi ? <CircularProgress size={20} /> : "(Test)"}</Button></Box></Grid></Grid> ); }
    renderAIBehaviorSection(tooltipProps: any) { return ( <Grid container spacing={3}><Grid item xs={12} md={6}><Tooltip title="Fokus der Analyse." {...tooltipProps}><FormControl fullWidth size="small"><InputLabel>{I18n.t('ai_persona')}</InputLabel><Select value={this.state.aiPersona} label={I18n.t('ai_persona')} onChange={e => this.updateNativeValue('aiPersona', e.target.value)}><MenuItem value="generic">Ausgewogen</MenuItem><MenuItem value="senior_aal">Senioren-Schutz</MenuItem><MenuItem value="family">Familie</MenuItem><MenuItem value="single_comfort">Single</MenuItem><MenuItem value="security">Sicherheit</MenuItem></Select></FormControl></Tooltip></Grid><Grid item xs={12} md={6}><Tooltip title="Analyse-Intervall in Minuten." {...tooltipProps}><TextField fullWidth label={I18n.t('analysis_interval')} value={this.state.analysisInterval} type="number" onChange={e => this.updateNativeValue('analysisInterval', parseInt(e.target.value))} size="small" /></Tooltip></Grid><Grid item xs={12}><Tooltip title="Wohnkontext." {...tooltipProps}><TextField fullWidth multiline rows={4} label="Kontext" value={this.state.livingContext} onChange={e => this.updateNativeValue('livingContext', e.target.value)} helperText="max 1000 Zeichen" inputProps={{maxLength: 1000}} /></Tooltip></Grid><Grid item xs={6} md={3}><Tooltip title="Lernphase in Tagen." {...tooltipProps}><TextField fullWidth label="Lernphase" value={this.state.minDaysForBaseline} type="number" onChange={e => this.updateNativeValue('minDaysForBaseline', parseInt(e.target.value))} size="small" /></Tooltip></Grid><Grid item xs={6} md={3}><Tooltip title="STM Fenster." {...tooltipProps}><TextField fullWidth label="STM (Tage)" value={this.state.ltmStbWindowDays} type="number" onChange={e => this.updateNativeValue('ltmStbWindowDays', parseInt(e.target.value))} size="small" /></Tooltip></Grid><Grid item xs={6} md={3}><Tooltip title="LTM Fenster." {...tooltipProps}><TextField fullWidth label="LTM (Tage)" value={this.state.ltmLtbWindowDays} type="number" onChange={e => this.updateNativeValue('ltmLtbWindowDays', parseInt(e.target.value))} size="small" /></Tooltip></Grid><Grid item xs={12}><Divider textAlign="left"><Typography variant="caption" sx={{color:'text.secondary', display:'flex', alignItems:'center', gap:1}}>AAL / Inactivity Monitor</Typography></Divider></Grid><Grid item xs={12} md={6}><FormControlLabel control={<Checkbox checked={this.state.inactivityMonitoringEnabled} onChange={e => this.updateNativeValue('inactivityMonitoringEnabled', e.target.checked)} />} label={I18n.t('inactivity_monitoring_enabled')} /></Grid><Grid item xs={12} md={6}><Tooltip title="Stunden ohne Event bis Alarm." {...tooltipProps}><TextField fullWidth label={I18n.t('inactivity_threshold_hours')} value={this.state.inactivityThresholdHours} type="number" disabled={!this.state.inactivityMonitoringEnabled} onChange={e => this.updateNativeValue('inactivityThresholdHours', parseFloat(e.target.value))} size="small" inputProps={{step: 0.1}} /></Tooltip></Grid><Grid item xs={12}><Divider textAlign="left"><Typography variant="caption" sx={{color:'text.secondary', display:'flex', alignItems:'center', gap:1}}>Butler Simulation (Test)</Typography></Divider></Grid><Grid item xs={12}><Paper variant="outlined" sx={{p: 2, bgcolor: 'action.hover', display:'flex', alignItems:'center', gap: 2, flexWrap: 'wrap'}}><Box sx={{flexGrow: 1, minWidth: '200px'}}><Typography variant="caption">1. Ziel-Gerät wählen (ID)</Typography><Box sx={{display:'flex'}}><TextField fullWidth size="small" value={this.state.simTargetId} onChange={e => this.setState({simTargetId: e.target.value})} placeholder="z.B. hue.0.light" /><IconButton onClick={() => this.openSimSelectId()}>...</IconButton></Box></Box><Box sx={{minWidth: '100px'}}><Typography variant="caption">2. Wert (JSON)</Typography><TextField fullWidth size="small" value={this.state.simTargetValue} onChange={e => this.setState({simTargetValue: e.target.value})} /></Box><Box sx={{mt: 2}}><Button variant="contained" color="secondary" onClick={this.handleSimulateButler}>Vorschlag simulieren</Button></Box></Paper><Typography variant="caption" sx={{mt: 1, display:'block'}}>Erzeugt einen Fake-Vorschlag im Dashboard. Wenn Sie dort "Ausführen" klicken, wird dieser Wert an diese ID gesendet.</Typography></Grid></Grid> ); }
    renderReportingSection(tooltipProps: any) { return ( <Grid container spacing={3}><Grid item xs={12}><Alert severity="info">Der "Family Link" sendet automatisch Berichte an die unten konfigurierten Empfänger.</Alert></Grid><Grid item xs={12} md={6}><FormControlLabel control={<Checkbox checked={this.state.briefingEnabled} onChange={e => this.updateNativeValue('briefingEnabled', e.target.checked)} />} label="Tägliches 'Guten Morgen' Briefing" /><Typography variant="caption" color="text.secondary" display="block">Sendet morgens eine Zusammenfassung der Nacht (Schlaf/Aktivität).</Typography></Grid><Grid item xs={12} md={6}><Tooltip title="Uhrzeit für den täglichen Bericht (Format HH:MM)." {...tooltipProps}><TextField fullWidth label="Uhrzeit" type="time" value={this.state.briefingTime} onChange={e => this.updateNativeValue('briefingTime', e.target.value)} disabled={!this.state.briefingEnabled} InputLabelProps={{ shrink: true }} size="small" /></Tooltip></Grid><Grid item xs={12}><Divider textAlign="left"><Typography variant="caption" sx={{color:'text.secondary', display:'flex', alignItems:'center', gap:1}}>Erweiterter Kontext (Sprint 29)</Typography></Divider></Grid><Grid item xs={12} md={6}><FormControlLabel control={<Checkbox checked={this.state.useWeather} onChange={e => this.updateNativeValue('useWeather', e.target.checked)} />} label="Wetterdaten nutzen" /><FormControl fullWidth size="small" disabled={!this.state.useWeather}><InputLabel>Wetter-Instanz (Optional)</InputLabel><Select value={this.state.weatherInstance} label="Wetter-Instanz (Optional)" onChange={(e) => this.updateNativeValue('weatherInstance', e.target.value)}><MenuItem value=""><em>Automatisch erkennen</em></MenuItem>{[...(this.state.availableInstances['accuweather'] || []), ...(this.state.availableInstances['daswetter'] || [])].map(id => <MenuItem key={id} value={id}>{id}</MenuItem>)}</Select></FormControl></Grid><Grid item xs={12} md={6}><Box sx={{display: 'flex', alignItems: 'center', gap: 1}}><Typography variant="body1">Eigener Außenfühler (Hardware):</Typography><Tooltip title="Wählen Sie einen physischen Sensor (z.B. im Garten). Dieser Wert wird bevorzugt behandelt."><IconButton onClick={() => this.openOutdoorSelectId()}>...</IconButton></Tooltip></Box><Box sx={{display: 'flex', gap: 1}}><TextField fullWidth size="small" value={this.state.outdoorSensorId} onChange={e => this.updateNativeValue('outdoorSensorId', e.target.value)} placeholder="Kein Sensor gewählt" helperText="Hat Vorrang vor Wetter-Adapter" /><IconButton onClick={() => this.openOutdoorSelectId()}>...</IconButton></Box></Grid><Grid item xs={12} md={6}><FormControlLabel control={<Checkbox checked={this.state.useCalendar} onChange={e => this.updateNativeValue('useCalendar', e.target.checked)} />} label="Kalender nutzen (iCal)" /><FormControl fullWidth size="small" disabled={!this.state.useCalendar}><InputLabel>Kalender-Instanz (Optional)</InputLabel><Select value={this.state.calendarInstance} label="Kalender-Instanz (Optional)" onChange={(e) => this.updateNativeValue('calendarInstance', e.target.value)}><MenuItem value=""><em>Automatisch erkennen</em></MenuItem>{(this.state.availableInstances['ical'] || []).map(id => <MenuItem key={id} value={id}>{id}</MenuItem>)}</Select></FormControl></Grid>{this.state.useCalendar && (<Grid item xs={12}><Paper variant="outlined" sx={{p: 2}}><Box sx={{display:'flex', justifyContent:'space-between', alignItems:'center', mb: 1}}><Typography variant="subtitle2">Relevante Kalender auswählen (Whitelist)</Typography><Button size="small" onClick={() => this.handleFetchCalendarNames()}>Kalender suchen</Button></Box>{this.state.detectedCalendars.length > 0 ? (<FormGroup row>{this.state.detectedCalendars.map(calName => (<FormControlLabel key={calName} control={<Checkbox checked={this.state.calendarSelection.includes(calName)} onChange={() => this.toggleCalendarSelection(calName)} />} label={calName} />))}</FormGroup>) : (<Typography variant="body2" color="text.secondary">Klicken Sie auf "Suchen", um Kalendernamen zu laden.</Typography>)}{this.state.calendarSelection.length === 0 && this.state.detectedCalendars.length > 0 && (<Alert severity="warning" sx={{mt: 1, py: 0}}>Achtung: Kein Kalender ausgewählt. Die KI wird alle Termine ignorieren!</Alert>)}</Paper></Grid>)}<Grid item xs={12}><Button variant="outlined" onClick={() => this.handleTestContextClick()} disabled={this.state.isTestingContext || (!this.state.useWeather && !this.state.useCalendar)}>Kontext-Daten jetzt prüfen</Button></Grid></Grid>); }
    renderNotificationRow(adapterName: string, enabledAttr: NotificationEnabledKey, instanceAttr: NotificationInstanceKey, recipientAttr: NotificationRecipientKey, recipientLabel: string) { const enabled = this.state[enabledAttr]; const instance = this.state[instanceAttr]; const recipient = this.state[recipientAttr]; let adapterKey = adapterName === 'whatsapp' ? 'whatsapp-cmb' : adapterName === 'signal' ? 'signal-cma' : adapterName; const instances = this.state.availableInstances[adapterKey] || []; return (<Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}><Grid item xs={12} sm={3}><FormControlLabel control={<Checkbox checked={enabled} onChange={e => this.updateNativeValue(enabledAttr, e.target.checked)} />} label={I18n.t(`notify_${adapterName}`)} /></Grid><Grid item xs={12} sm={4}><FormControl fullWidth size="small" disabled={!enabled}><InputLabel>{I18n.t('notify_instance')}</InputLabel><Select value={instance} label={I18n.t('notify_instance')} onChange={(e: any) => this.updateNativeValue(instanceAttr, e.target.value)}>{instances.length === 0 ? <MenuItem value="">{I18n.t('notify_no_instances')}</MenuItem> : instances.map(id => <MenuItem key={id} value={id}>{id}</MenuItem>)}</Select></FormControl></Grid><Grid item xs={12} sm={5}><TextField fullWidth size="small" label={recipientLabel} value={recipient} onChange={e => this.updateNativeValue(recipientAttr, e.target.value)} disabled={!enabled} required={adapterName === 'email' && enabled} /></Grid></Grid>); }
    renderNotificationsSection() { return ( <Box><Alert severity="info" sx={{mb: 2}}>Benachrichtigungen werden bei Alarmen und (wenn aktiviert) für Berichte verwendet.</Alert>{this.renderNotificationRow('telegram', 'notifyTelegramEnabled', 'notifyTelegramInstance', 'notifyTelegramRecipient', 'User ID')}{this.renderNotificationRow('pushover', 'notifyPushoverEnabled', 'notifyPushoverInstance', 'notifyPushoverRecipient', 'Device ID')}{this.renderNotificationRow('email', 'notifyEmailEnabled', 'notifyEmailInstance', 'notifyEmailRecipient', 'E-Mail')}{this.renderNotificationRow('whatsapp', 'notifyWhatsappEnabled', 'notifyWhatsappInstance', 'notifyWhatsappRecipient', 'Tel')}<Button variant="outlined" sx={{mt:1}} onClick={() => this.handleTestNotificationClick()} disabled={this.state.isTestingNotification}>Test</Button></Box> ); }

    renderSensorsSection(isDark: boolean) {
        return (
            <Box>
                <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: isDark ? '#2d2d2d' : '#fafafa' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell><Tooltip title="ioBroker Objekt-ID (Pfad)"><span style={{cursor:'help', textDecoration:'underline dotted'}}>{I18n.t('table_sensor_id')}</span></Tooltip></TableCell>
                                <TableCell><Tooltip title="Name für die KI (z.B. 'Küche Licht')"><span style={{cursor:'help', textDecoration:'underline dotted'}}>{I18n.t('table_name')}</span></Tooltip></TableCell>
                                <TableCell><Tooltip title="Raum/Ort (Wichtig für Kontext)"><span style={{cursor:'help', textDecoration:'underline dotted'}}>{I18n.t('table_location')}</span></Tooltip></TableCell>
                                <TableCell><Tooltip title="Art des Sensors"><span style={{cursor:'help', textDecoration:'underline dotted'}}>{I18n.t('table_type')}</span></Tooltip></TableCell>
                                <TableCell><Tooltip title={I18n.t('table_is_exit_tooltip')}><span style={{cursor:'help', textDecoration:'underline dotted'}}>{I18n.t('table_is_exit')}</span></Tooltip></TableCell>
                                <TableCell><Tooltip title={I18n.t('table_log_duplicates_tooltip')}><span style={{cursor:'help', textDecoration:'underline dotted'}}>{I18n.t('table_log_duplicates')}</span></Tooltip></TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {this.state.devices.map((device, index) => (
                                <TableRow key={index}>
                                    <TableCell><Box sx={{display:'flex'}}><TextField value={device.id} onChange={e => this.onDeviceChange(index, 'id', e.target.value)} size="small" variant="standard"/><IconButton size="small" onClick={() => this.openSelectIdDialog(index)}>...</IconButton></Box></TableCell>
                                    <TableCell><TextField value={device.name} onChange={e => this.onDeviceChange(index, 'name', e.target.value)} size="small" variant="standard"/></TableCell>
                                    <TableCell><TextField value={device.location} onChange={e => this.onDeviceChange(index, 'location', e.target.value)} size="small" variant="standard"/></TableCell>
                                    <TableCell>
                                        <FormControl fullWidth size="small" variant="standard">
                                            <Select
                                                value={device.type}
                                                onChange={e => this.onDeviceChange(index, 'type', e.target.value)}
                                                displayEmpty
                                            >
                                                {SENSOR_TYPES.map(type => (
                                                    <MenuItem key={type.id} value={type.id}>{type.label}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </TableCell>
                                    <TableCell><Tooltip title="Ist dies eine Haustür? (Checkt Abwesenheit)"><Checkbox checked={device.isExit || false} onChange={e => this.onDeviceChange(index, 'isExit', e.target.checked)} size="small"/></Tooltip></TableCell>
                                    <TableCell><Tooltip title={I18n.t('table_log_duplicates_tooltip')}><Checkbox checked={device.logDuplicates} onChange={e => this.onDeviceChange(index, 'logDuplicates', e.target.checked)} size="small"/></Tooltip></TableCell>
                                    <TableCell><IconButton size="small" onClick={() => this.onDeleteDevice(index)}>(X)</IconButton></TableCell>
                                </TableRow>
                            ))}
                            {this.state.devices.length === 0 && <TableRow><TableCell colSpan={7} align="center">Keine Sensoren.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </TableContainer>
                <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box><Button variant="contained" color="secondary" onClick={this.handleOpenWizard} sx={{ mr: 1 }}>Auto-Discovery</Button><Button variant="outlined" onClick={() => this.onAddDevice()}>[+] NEU</Button></Box>
                    {this.state.devices.length > 0 && <Button color="error" size="small" onClick={() => this.setState({showDeleteConfirm: true})}>Alle löschen</Button>}
                </Box>
            </Box>
        );
    }

    render() {
        const { expandedAccordion } = this.state;
        const isDark = this.props.themeType === 'dark';
        const cardBg = isDark ? '#1e1e1e' : '#fff';
        const textColor = isDark ? '#fff' : 'text.primary';
        const accordionStyle = { bgcolor: cardBg, color: textColor };
        const titleStyle = { display: 'flex', alignItems: 'center', gap: 2, fontWeight: 'bold' };
        const tooltipProps = { componentsProps: { tooltip: { sx: { fontSize: '0.9rem' } } }, arrow: true };

        return (
            <Box sx={{ p: 2, maxWidth: '1200px', margin: '0 auto' }}>
                {this.renderDialogs()}
                <Accordion expanded={expandedAccordion === 'panel1'} onChange={this.handleAccordionChange('panel1')} sx={accordionStyle}><AccordionSummary expandIcon={<span>v</span>}><Typography sx={titleStyle}>Lizenz & KI-Verbindung</Typography></AccordionSummary><AccordionDetails>{this.renderLicenseSection(tooltipProps)}</AccordionDetails></Accordion>
                <Accordion expanded={expandedAccordion === 'panel2'} onChange={this.handleAccordionChange('panel2')} sx={accordionStyle}><AccordionSummary expandIcon={<span>v</span>}><Typography sx={titleStyle}>KI-Verhalten & Kontext</Typography></AccordionSummary><AccordionDetails>{this.renderAIBehaviorSection(tooltipProps)}</AccordionDetails></Accordion>
                <Accordion expanded={expandedAccordion === 'panel5'} onChange={this.handleAccordionChange('panel5')} sx={accordionStyle}><AccordionSummary expandIcon={<span>v</span>}><Typography sx={titleStyle}>Reporting & Family Link</Typography></AccordionSummary><AccordionDetails>{this.renderReportingSection(tooltipProps)}</AccordionDetails></Accordion>
                <Accordion expanded={expandedAccordion === 'panel3'} onChange={this.handleAccordionChange('panel3')} sx={accordionStyle}><AccordionSummary expandIcon={<span>v</span>}><Typography sx={titleStyle}>Benachrichtigungen</Typography></AccordionSummary><AccordionDetails>{this.renderNotificationsSection()}</AccordionDetails></Accordion>
                <Accordion expanded={expandedAccordion === 'panel4'} onChange={this.handleAccordionChange('panel4')} sx={accordionStyle}><AccordionSummary expandIcon={<span>v</span>}><Typography sx={titleStyle}>Sensoren</Typography></AccordionSummary><AccordionDetails>{this.renderSensorsSection(isDark)}</AccordionDetails></Accordion>
            </Box>
        );
    }
}