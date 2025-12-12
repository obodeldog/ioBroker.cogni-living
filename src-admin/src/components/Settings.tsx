import React from 'react';
import {
    Button, Checkbox, CircularProgress, FormControl, IconButton, InputLabel, MenuItem, Select,
    TextField, Tooltip, Snackbar, Alert, Box, Paper, FormControlLabel, Grid, Dialog,
    DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemButton, ListItemText,
    ListItemIcon, LinearProgress, FormGroup, Collapse, Accordion, AccordionSummary,
    AccordionDetails, Typography, Divider, Chip
} from '@mui/material';
import type { AlertColor } from '@mui/material';

import { I18n, DialogSelectID, type IobTheme, type ThemeType } from '@iobroker/adapter-react-v5';
import type { Connection } from '@iobroker/socket-client';

// --- IMPORTS FOR CLEANER UI (Local components) ---
import TopologyView from './TopologyView';
import AutomationView from './AutomationView';
import SensorList from './SensorList';

// Icons
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PsychologyIcon from '@mui/icons-material/Psychology';
import VerifiedIcon from '@mui/icons-material/Verified';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

interface SettingsProps { native: Record<string, any>; onChange: (attr: string, value: any) => void; socket: Connection; themeType: ThemeType; adapterName: string; instance: number; theme: IobTheme; }
interface DeviceConfig { id: string; name: string; location: string; type: string; logDuplicates: boolean; isExit: boolean; }
interface ScannedDevice extends DeviceConfig { selected?: boolean; _score?: number; _source?: string; exists?: boolean; }
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
    availableRooms: string[];
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
    showBulkDialog: boolean;
    bulkLoading: boolean;
    bulkAllObjects: Record<string, any>;
    bulkFilter: string;
    bulkSelected: string[];
    // AUTOMATION COCKPIT STATES
    autoMode: string;
    autoThreshold: number;
    autoLastAction: string;
}

type NotificationEnabledKey = 'notifyTelegramEnabled' | 'notifyPushoverEnabled' | 'notifyEmailEnabled' | 'notifyWhatsappEnabled' | 'notifySignalEnabled';
type NotificationInstanceKey = 'notifyTelegramInstance' | 'notifyPushoverInstance' | 'notifyEmailInstance' | 'notifyWhatsappInstance' | 'notifySignalInstance';
type NotificationRecipientKey = 'notifyTelegramRecipient' | 'notifyPushoverRecipient' | 'notifyEmailRecipient' | 'notifyWhatsappRecipient' | 'notifySignalRecipient';

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
            scanFilters: { motion: true, doors: true, lights: true, temperature: true, weather: true, selectedFunctionIds: [] },
            scannedDevices: [],
            showDeleteConfirm: false,
            availableEnums: [],
            availableRooms: [],
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
            simTargetValue: 'true',
            showBulkDialog: false,
            bulkLoading: false,
            bulkAllObjects: {},
            bulkFilter: '',
            bulkSelected: [],
            // AUTOMATION
            autoMode: 'off',
            autoThreshold: 0.6,
            autoLastAction: 'Lade...'
        };
    }

    componentDidMount() {
        this.fetchAvailableInstances();
        this.fetchEnums();
        this.loadAutomationStates();
    }

    loadAutomationStates() {
        const namespace = `${this.props.adapterName}.${this.props.instance}`;
        this.props.socket.getState(`${namespace}.analysis.automation.mode`).then(s => {
            if(s && s.val) this.setState({ autoMode: s.val as string });
        });
        this.props.socket.getState(`${namespace}.analysis.automation.confidenceThreshold`).then(s => {
            if(s && typeof s.val === 'number') this.setState({ autoThreshold: s.val });
        });
        this.props.socket.getState(`${namespace}.analysis.automation.lastAction`).then(s => {
            if(s && s.val) this.setState({ autoLastAction: s.val as string });
            else this.setState({ autoLastAction: '(Noch keine Aktion)' });
        });
    }

    saveAutomationMode(mode: string) {
        this.setState({ autoMode: mode });
        this.props.socket.setState(`${this.props.adapterName}.${this.props.instance}.analysis.automation.mode`, { val: mode, ack: false });
    }

    saveAutomationThreshold(val: number) {
        this.setState({ autoThreshold: val });
        this.props.socket.setState(`${this.props.adapterName}.${this.props.instance}.analysis.automation.confidenceThreshold`, { val: val, ack: false });
    }

    fetchAvailableInstances() { const adapters = ['telegram', 'pushover', 'email', 'whatsapp-cmb', 'signal-cma', 'accuweather', 'daswetter', 'ical']; const instances: Record<string, string[]> = {}; const promises = adapters.map(adapter => this.props.socket.getAdapterInstances(adapter).then(objs => { instances[adapter] = objs.map(obj => obj._id.replace('system.adapter.', '')); }).catch(e => console.error(`Error fetching instances for ${adapter}:`, e))); Promise.all(promises).then(() => { this.setState({ availableInstances: instances }); }); }
    fetchEnums() {
        this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'getEnums', {}).then((res: any) => {
            if(res && res.success) {
                this.setState({
                    availableEnums: res.enums || [],
                    availableRooms: res.rooms || []
                });
            }
        });
    }

    updateNativeValue(attr: string, value: any) { if (attr === 'livingContext' && typeof value === 'string' && value.length > 5000) value = value.substring(0, 1000); this.setState({ [attr]: value } as Pick<SettingsState, keyof SettingsState>, () => { this.props.onChange(attr, value); }); }
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

    // --- BULK ADD LOGIC ---
    handleOpenBulkDialog = () => {
        this.setState({ showBulkDialog: true, bulkSelected: [] });
        if (Object.keys(this.state.bulkAllObjects).length === 0) {
            this.setState({ bulkLoading: true });
            this.props.socket.getForeignObjects('*', 'state').then(objects => {
                this.setState({ bulkAllObjects: objects, bulkLoading: false });
            }).catch(e => {
                this.setState({ bulkLoading: false });
                this.showSnackbar('Fehler beim Laden der Objekte: ' + e, 'error');
            });
        }
    }

    handleToggleBulkItem = (id: string) => {
        const selected = [...this.state.bulkSelected];
        const idx = selected.indexOf(id);
        if (idx === -1) selected.push(id);
        else selected.splice(idx, 1);
        this.setState({ bulkSelected: selected });
    }

    handleImportBulk = () => {
        const { bulkSelected, bulkAllObjects } = this.state;
        if (bulkSelected.length === 0) {
            this.setState({ showBulkDialog: false });
            return;
        }
        const currentDevices = [...this.state.devices];
        let added = 0;

        bulkSelected.forEach(id => {
            if (!currentDevices.find(d => d.id === id)) {
                const obj = bulkAllObjects[id];
                let name = id;
                if (obj && obj.common && obj.common.name) {
                    name = typeof obj.common.name === 'object' ? (obj.common.name[I18n.getLanguage()] || obj.common.name.de || obj.common.name.en) : obj.common.name;
                }
                currentDevices.push({
                    id: id,
                    name: name,
                    location: '',
                    type: '',
                    logDuplicates: false,
                    isExit: false
                });
                added++;
            }
        });

        this.updateDevices(currentDevices);
        this.showSnackbar(`${added} Objekte hinzugefügt.`, 'success');
        this.setState({ showBulkDialog: false, bulkSelected: [] });
    }

    renderBulkDialog() {
        const { showBulkDialog, bulkLoading, bulkAllObjects, bulkFilter, bulkSelected } = this.state;
        let filteredKeys: string[] = [];
        if (!bulkLoading && showBulkDialog) {
            const lowerFilter = bulkFilter.toLowerCase();
            // Split filter by spaces to support multi-word search (e.g. "julia temp")
            const searchTerms = lowerFilter.split(/\s+/).filter(t => t.length > 0);

            const allKeys = Object.keys(bulkAllObjects).sort();
            if (bulkFilter.length < 2 && allKeys.length > 5000) { } else {
                for (const id of allKeys) {
                    if (filteredKeys.length > 100) break;
                    const obj = bulkAllObjects[id];
                    const name = obj?.common?.name ? (typeof obj.common.name === 'object' ? JSON.stringify(obj.common.name) : obj.common.name) : '';

                    // NEW SMART SEARCH: Check if ALL terms are present in ID OR Name
                    const targetString = (id + ' ' + name).toLowerCase();
                    const isMatch = searchTerms.every(term => targetString.includes(term));

                    if (isMatch) {
                        filteredKeys.push(id);
                    }
                }
            }
        }

        return (
            <Dialog open={showBulkDialog} onClose={() => this.setState({ showBulkDialog: false })} maxWidth="md" fullWidth>
                <DialogTitle>Massen-Auswahl (Bulk Add)</DialogTitle>
                <DialogContent dividers style={{minHeight: '400px'}}>
                    <Box sx={{ mb: 2 }}>
                        <TextField
                            fullWidth
                            label="Suche (Smart Search)..."
                            variant="outlined"
                            value={bulkFilter}
                            onChange={(e) => this.setState({ bulkFilter: e.target.value })}
                            autoFocus
                            placeholder="z.B. 'julia temp' findet 'Julia Zimmer Temperatur'"
                            helperText="Tipp: Mehrere Begriffe mit Leerzeichen trennen."
                        />
                    </Box>
                    {bulkLoading ? (
                        <Box sx={{display: 'flex', justifyContent: 'center', p: 4}}><CircularProgress /><Typography sx={{ml:2}}>Lade Objekte...</Typography></Box>
                    ) : (
                        <List dense>
                            {filteredKeys.length === 0 && bulkFilter.length > 1 && <ListItem><ListItemText primary="Keine Treffer" /></ListItem>}
                            {filteredKeys.map(id => {
                                const obj = bulkAllObjects[id];
                                let name = id;
                                if(obj?.common?.name) name = typeof obj.common.name === 'object' ? (obj.common.name.de || JSON.stringify(obj.common.name)) : obj.common.name;
                                return (
                                    <ListItem key={id} disablePadding>
                                        <ListItemButton onClick={() => this.handleToggleBulkItem(id)}>
                                            <ListItemIcon><Checkbox edge="start" checked={bulkSelected.indexOf(id) !== -1} tabIndex={-1} disableRipple /></ListItemIcon>
                                            <ListItemText primary={name} secondary={id} primaryTypographyProps={{ style: { fontWeight: 'bold' } }} secondaryTypographyProps={{ style: { fontSize: '0.8rem', fontFamily: 'monospace' } }} />
                                        </ListItemButton>
                                    </ListItem>
                                );
                            })}
                        </List>
                    )}
                </DialogContent>
                <DialogActions>
                    <Typography sx={{flexGrow: 1, ml: 2}} variant="caption">{bulkSelected.length} ausgewählt</Typography>
                    <Button onClick={() => this.setState({ showBulkDialog: false })}>Abbrechen</Button>
                    <Button onClick={this.handleImportBulk} variant="contained" color="primary" disabled={bulkSelected.length === 0}>Übernehmen</Button>
                </DialogActions>
            </Dialog>
        );
    }

    handleOpenWizard = () => { this.setState({ showWizard: true, wizardStep: 0, scannedDevices: [] }); }
    handleFilterChange = (key: keyof ScanFilters) => { this.setState(prevState => ({ scanFilters: { ...prevState.scanFilters, [key]: !prevState.scanFilters[key] } })); }
    handleEnumToggle = (enumId: string) => { const current = [...this.state.scanFilters.selectedFunctionIds]; const index = current.indexOf(enumId); if (index === -1) current.push(enumId); else current.splice(index, 1); this.setState(prevState => ({ scanFilters: { ...prevState.scanFilters, selectedFunctionIds: current } })); }
    handleStartScan = () => { this.setState({ wizardStep: 1 }); this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'scanDevices', this.state.scanFilters).then((response: any) => { if(response && response.success && Array.isArray(response.devices)) { if (response.devices.length === 0) { this.showSnackbar('Keine Sensoren gefunden.', 'info'); this.setState({ wizardStep: 0 }); } else { const existingIds = new Set(this.state.devices.map(d => d.id)); const devices = response.devices.map((d: any) => { const exists = existingIds.has(d.id); return { ...d, exists: exists, selected: !exists && (!!d.location || d._score >= 20) }; }); this.setState({ scannedDevices: devices, wizardStep: 2 }); } } else { this.showSnackbar(`Scan fehlgeschlagen: ${response?.error}`, 'warning'); this.setState({ wizardStep: 0 }); } }).catch(e => { this.showSnackbar(`Scan Error: ${e.message}`, 'error'); this.setState({ wizardStep: 0 }); }); }
    handleToggleScannedDevice = (index: number) => { const devices = [...this.state.scannedDevices]; if (devices[index].exists) return; devices[index].selected = !devices[index].selected; this.setState({ scannedDevices: devices }); }
    handleSelectAll = () => { const devices = this.state.scannedDevices.map(d => ({ ...d, selected: !d.exists })); this.setState({ scannedDevices: devices }); }
    handleDeselectAll = () => { const devices = this.state.scannedDevices.map(d => ({ ...d, selected: false })); this.setState({ scannedDevices: devices }); }
    handleImportDevices = () => { const selected = this.state.scannedDevices.filter(d => d.selected); if(selected.length === 0) { this.setState({ showWizard: false }); return; } const currentDevices = [...this.state.devices]; let addedCount = 0; selected.forEach(newItem => { if(!currentDevices.find(d => d.id === newItem.id)) { const { selected, _score, _source, exists, ...deviceConfig } = newItem; currentDevices.push(deviceConfig); addedCount++; } }); this.updateDevices(currentDevices); this.showSnackbar(`${addedCount} Sensoren importiert.`, 'success'); this.setState({ showWizard: false }); }
    handleTestApiClick() { if (!this.state.geminiApiKey) return this.showSnackbar(I18n.t('msg_api_key_empty'), 'warning'); this.setState({ isTestingApi: true }); this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'testApiKey', { apiKey: this.state.geminiApiKey }).then((res: any) => { this.setState({ isTestingApi: false }); this.showSnackbar(res?.success ? res.message : `${I18n.t('msg_connection_failed')}: ${res?.message}`, res?.success ? 'success' : 'error'); }); }
    handleTestNotificationClick() { this.setState({ isTestingNotification: true }); this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'testNotification', {}).then((res: any) => { this.setState({ isTestingNotification: false }); this.showSnackbar(res?.success ? res.message : `${I18n.t('msg_notification_failed')}: ${res?.message}`, res?.success ? 'success' : 'warning'); }); }
    handleTestContextClick() { this.setState({ isTestingContext: true }); this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'testContext', {}).then((res: any) => { this.setState({ isTestingContext: false }); if (res && res.success) { this.setState({ showContextDialog: true, contextResult: { weather: res.weather, calendar: res.calendar } }); } else { this.showSnackbar('Fehler beim Abrufen der Kontext-Daten.', 'error'); } }); }
    handleFetchCalendarNames() { const inst = this.state.calendarInstance || 'ical.0'; this.setState({ isLoadingCalendars: true }); const timeout = setTimeout(() => { if(this.state.isLoadingCalendars) { this.setState({ isLoadingCalendars: false }); this.showSnackbar('Zeitüberschreitung: Keine Antwort vom Adapter.', 'error'); } }, 5000); this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'getCalendarNames', { instance: inst }).then((res: any) => { clearTimeout(timeout); this.setState({ isLoadingCalendars: false }); if (res && res.success && Array.isArray(res.names)) { this.setState({ detectedCalendars: res.names }); if(res.names.length === 0) this.showSnackbar('Keine Kalender-Namen gefunden. (Sind Termine in data.table?)', 'warning'); } else { this.showSnackbar('Fehler beim Laden der Kalender.', 'error'); } }).catch(e => { clearTimeout(timeout); this.setState({ isLoadingCalendars: false }); this.showSnackbar(`Fehler: ${e.message}`, 'error'); }); }
    toggleCalendarSelection(calName: string) { const current = [...this.state.calendarSelection]; const index = current.indexOf(calName); if(index === -1) current.push(calName); else current.splice(index, 1); this.setState({ calendarSelection: current }); this.props.onChange('calendarSelection', current); }
    showSnackbar(message: string, severity: AlertColor) { this.setState({ snackbarOpen: true, snackbarMessage: message, snackbarSeverity: severity }); }
    handleSnackbarClose = (event?: React.SyntheticEvent | Event, reason?: string) => { if (reason === 'clickaway') return; this.setState({ snackbarOpen: false }); };
    collectUniqueLocations() { const fromDevices = this.state.devices.map(d => d.location).filter(l => l); const fromIoBroker = this.state.availableRooms; return Array.from(new Set([...fromIoBroker, ...fromDevices])).sort(); }

    renderContextDialog() { return ( <Dialog open={this.state.showContextDialog} onClose={() => this.setState({ showContextDialog: false })} maxWidth="sm" fullWidth><DialogTitle>Kontext-Daten (Live-Check)</DialogTitle><DialogContent dividers><Typography variant="subtitle2" color="primary" gutterBottom>Wetter-Status</Typography><Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}><Typography variant="body2" style={{ fontFamily: 'monospace' }}>{this.state.contextResult?.weather || 'Lade...'}</Typography></Paper><Typography variant="subtitle2" color="primary" gutterBottom>Kalender-Status (Gefiltert)</Typography><Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default', maxHeight: 200, overflow: 'auto' }}><Typography variant="body2" style={{ fontFamily: 'monospace' }}>{this.state.contextResult?.calendar || 'Lade...'}</Typography></Paper></DialogContent><DialogActions><Button onClick={() => this.setState({ showContextDialog: false })}>Schließen</Button></DialogActions></Dialog> ); }

    renderWizardDialog() {
        const { showWizard, wizardStep, scanFilters, scannedDevices, availableEnums, showEnumList } = this.state;
        return (
            <Dialog open={showWizard} onClose={() => wizardStep !== 1 && this.setState({ showWizard: false })} maxWidth="md" fullWidth>
                <DialogTitle>Auto-Discovery Wizard {wizardStep !== 1 && <IconButton onClick={() => this.setState({ showWizard: false })} sx={{ position: 'absolute', right: 8, top: 8 }}>x</IconButton>}</DialogTitle>
                <DialogContent dividers>
                    {wizardStep === 0 && <Box sx={{ p: 2 }}><Typography variant="h6" gutterBottom>Was soll gescannt werden?</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Die KI kann automatisch Sensoren in Ihrer ioBroker-Installation finden.</Typography>
                        <FormGroup>
                            <FormControlLabel control={<Checkbox checked={scanFilters.motion} onChange={() => this.handleFilterChange('motion')} />} label="Bewegungsmelder" />
                            <FormControlLabel control={<Checkbox checked={scanFilters.doors} onChange={() => this.handleFilterChange('doors')} />} label="Fenster & Türen" />
                            <FormControlLabel control={<Checkbox checked={scanFilters.lights} onChange={() => this.handleFilterChange('lights')} />} label="Lichter & Schalter" />
                            <Box sx={{ mt: 1, mb: 1 }}>
                                <FormControlLabel control={<Checkbox checked={scanFilters.temperature} onChange={() => this.handleFilterChange('temperature')} />} label="Temperatur / Klima" />
                                <FormControlLabel control={<Checkbox checked={scanFilters.weather} onChange={() => this.handleFilterChange('weather')} color="warning" />} label="Wetterdaten (Alle Adapter)" />
                            </Box>
                            {availableEnums.length > 0 && (<Box sx={{ mt: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}><ListItemButton onClick={() => this.setState({ showEnumList: !showEnumList })}><ListItemText primary="Spezifische Funktionen" secondary={`${scanFilters.selectedFunctionIds.length} ausgewählt`} />{showEnumList ? <span>^</span> : <span>v</span>}</ListItemButton><Collapse in={showEnumList} timeout="auto" unmountOnExit><List component="div" disablePadding dense sx={{ maxHeight: 200, overflow: 'auto' }}>{availableEnums.map((en) => (<ListItem key={en.id} dense disablePadding><ListItemButton onClick={() => this.handleEnumToggle(en.id)}><ListItemIcon><Checkbox edge="start" checked={scanFilters.selectedFunctionIds.indexOf(en.id) !== -1} tabIndex={-1} disableRipple /></ListItemIcon><ListItemText primary={en.name} secondary={en.id} /></ListItemButton></ListItem>))}</List></Collapse></Box>)}
                        </FormGroup></Box>}
                    {wizardStep === 1 && <Box sx={{ width: '100%', mt: 4, mb: 4, textAlign: 'center' }}><LinearProgress /><Typography variant="h6" sx={{ mt: 2 }}>Suche Sensoren & analysiere Namen...</Typography></Box>}
                    {wizardStep === 2 && <Box><List dense sx={{ width: '100%', bgcolor: 'background.paper', maxHeight: 400, overflow: 'auto' }}>
                        {scannedDevices.map(d => {
                            if(d.exists) return null;
                            const isEnum = d._source && d._source === "Enum";
                            const confidence = d._score || 50;
                            const color = confidence >= 80 ? "success" : (confidence >= 50 ? "warning" : "error");
                            return (
                                <ListItem key={d.id} disablePadding divider>
                                    <ListItemButton onClick={() => this.handleToggleScannedDevice(scannedDevices.indexOf(d))} dense>
                                        <ListItemIcon><Checkbox edge="start" checked={d.selected} tabIndex={-1} /></ListItemIcon>
                                        <ListItemText primary={<Box sx={{display:'flex', alignItems:'center', gap: 1}}>{d.name || d.id}<Chip label={isEnum ? "Enum" : "AI-Scan"} size="small" color={isEnum ? "success" : "default"} variant="outlined" style={{height: 20, fontSize: '0.7rem'}}/>{d._source && d._source.includes("Heuristic") && <Chip label={`${confidence}%`} size="small" color={color} variant="outlined" style={{height: 20, fontSize: '0.7rem'}} icon={confidence<60 ? <HelpOutlineIcon style={{fontSize:14}}/> : <VerifiedIcon style={{fontSize:14}}/>}/>}</Box>} secondary={`${d.type} • ${d.location || '(Kein Raum)'}`} />
                                    </ListItemButton>
                                </ListItem>
                            );
                        })}
                        {scannedDevices.filter(d => d.exists).length > 0 && <Box sx={{p: 1, bgcolor: '#f0f0f0', color: '#666', fontSize:'0.8rem', fontWeight:'bold'}}>Bereits konfiguriert:</Box>}
                        {scannedDevices.filter(d => d.exists).map(d => (<ListItem key={d.id} disablePadding divider><ListItemButton dense disabled><ListItemIcon><span>OK</span></ListItemIcon><ListItemText primary={d.name || d.id} secondary="Bereits aktiv" /></ListItemButton></ListItem>))}
                    </List></Box>}
                </DialogContent>
                <DialogActions>{wizardStep === 0 && <Button variant="contained" onClick={this.handleStartScan}>Scan Starten</Button>}{wizardStep === 2 && (<><Button onClick={() => this.setState({ wizardStep: 0 })}>Zurück</Button><Button onClick={this.handleSelectAll}>Alle</Button><Button onClick={this.handleDeselectAll}>Keine</Button><Box sx={{ flexGrow: 1 }} /><Button variant="contained" onClick={this.handleImportDevices} color="primary">{this.state.scannedDevices.filter(d => d.selected).length} Importieren</Button></>)}</DialogActions>
            </Dialog>
        );
    }

    renderDialogs() { return ( <>{this.state.showSelectId && (<DialogSelectID theme={this.props.theme} imagePrefix="../.." dialogName="selectID" themeType={this.props.themeType} socket={this.props.socket} selected={this.state.selectIdContext === 'outdoor' ? this.state.outdoorSensorId : (this.state.selectIdContext === 'device' && this.state.devices[this.state.selectIdIndex]?.id) || ''} onClose={() => this.setState({ showSelectId: false })} onOk={selected => this.onSelectId(selected as string)} />)}{this.renderWizardDialog()}{this.renderBulkDialog()}{this.renderContextDialog()}<Dialog open={this.state.showDeleteConfirm} onClose={() => this.setState({showDeleteConfirm:false})}><DialogTitle>Sicher?</DialogTitle><DialogContent><Typography>Alle Sensoren löschen?</Typography></DialogContent><DialogActions><Button onClick={()=>this.setState({showDeleteConfirm:false})}>Abbrechen</Button><Button onClick={this.onDeleteAllDevices} color="error">Löschen</Button></DialogActions></Dialog><Snackbar open={this.state.snackbarOpen} autoHideDuration={6000} onClose={this.handleSnackbarClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}><Alert onClose={this.handleSnackbarClose} severity={this.state.snackbarSeverity}>{this.state.snackbarMessage}</Alert></Snackbar></> ); }
    renderLicenseSection(tooltipProps: any) { return ( <Grid container spacing={3}><Grid item xs={12} md={6}><Tooltip title="Ihr Pro-Lizenzschlüssel." {...tooltipProps}><TextField fullWidth label={I18n.t('license_key')} value={this.state.licenseKey} type="password" onChange={e => this.updateNativeValue('licenseKey', e.target.value)} helperText="Für vollen Funktionsumfang" variant="outlined" size="small" /></Tooltip></Grid><Grid item xs={12} md={6}><Box sx={{display: 'flex', gap: 1}}><Tooltip title="Gemini API Key." {...tooltipProps}><TextField fullWidth label={I18n.t('gemini_api_key')} value={this.state.geminiApiKey} type="password" onChange={e => this.updateNativeValue('geminiApiKey', e.target.value)} variant="outlined" size="small" /></Tooltip><Button variant="outlined" onClick={() => this.handleTestApiClick()} disabled={this.state.isTestingApi || !this.state.geminiApiKey}>{this.state.isTestingApi ? <CircularProgress size={20} /> : "(Test)"}</Button></Box></Grid></Grid> ); }
    renderReportingSection(tooltipProps: any) { return ( <Grid container spacing={3}><Grid item xs={12}><Alert severity="info">Der "Family Link" sendet automatisch Berichte an die unten konfigurierten Empfänger.</Alert></Grid><Grid item xs={12} md={6}><FormControlLabel control={<Checkbox checked={this.state.briefingEnabled} onChange={e => this.updateNativeValue('briefingEnabled', e.target.checked)} />} label="Tägliches 'Guten Morgen' Briefing" /><Typography variant="caption" color="text.secondary" display="block">Sendet morgens eine Zusammenfassung der Nacht (Schlaf/Aktivität).</Typography></Grid><Grid item xs={12} md={6}><Tooltip title="Uhrzeit für den täglichen Bericht (Format HH:MM)." {...tooltipProps}><TextField fullWidth label="Uhrzeit" type="time" value={this.state.briefingTime} onChange={e => this.updateNativeValue('briefingTime', e.target.value)} disabled={!this.state.briefingEnabled} InputLabelProps={{ shrink: true }} size="small" /></Tooltip></Grid><Grid item xs={12}><Divider textAlign="left"><Typography variant="caption" sx={{color:'text.secondary', display:'flex', alignItems:'center', gap:1}}>Erweiterter Kontext (Sprint 29)</Typography></Divider></Grid><Grid item xs={12} md={6}><FormControlLabel control={<Checkbox checked={this.state.useWeather} onChange={e => this.updateNativeValue('useWeather', e.target.checked)} />} label="Wetterdaten nutzen" /><FormControl fullWidth size="small" disabled={!this.state.useWeather}><InputLabel>Wetter-Instanz (Optional)</InputLabel><Select value={this.state.weatherInstance} label="Wetter-Instanz (Optional)" onChange={(e) => this.updateNativeValue('weatherInstance', e.target.value)}><MenuItem value=""><em>Automatisch erkennen</em></MenuItem>{[...(this.state.availableInstances['accuweather'] || []), ...(this.state.availableInstances['daswetter'] || [])].map(id => <MenuItem key={id} value={id}>{id}</MenuItem>)}</Select></FormControl></Grid><Grid item xs={12} md={6}><Box sx={{display: 'flex', alignItems: 'center', gap: 1}}><Typography variant="body1">Eigener Außenfühler (Hardware):</Typography><Tooltip title="Wählen Sie einen physischen Sensor (z.B. im Garten). Dieser Wert wird bevorzugt behandelt."><IconButton onClick={() => this.openOutdoorSelectId()}>...</IconButton></Tooltip></Box><Box sx={{display: 'flex', gap: 1}}><TextField fullWidth size="small" value={this.state.outdoorSensorId} onChange={e => this.updateNativeValue('outdoorSensorId', e.target.value)} placeholder="Kein Sensor gewählt" helperText="Hat Vorrang vor Wetter-Adapter" /><IconButton onClick={() => this.openOutdoorSelectId()}>...</IconButton></Box></Grid><Grid item xs={12} md={6}><FormControlLabel control={<Checkbox checked={this.state.useCalendar} onChange={e => this.updateNativeValue('useCalendar', e.target.checked)} />} label="Kalender nutzen (iCal)" /><FormControl fullWidth size="small" disabled={!this.state.useCalendar}><InputLabel>Kalender-Instanz (Optional)</InputLabel><Select value={this.state.calendarInstance} label="Kalender-Instanz (Optional)" onChange={(e) => this.updateNativeValue('calendarInstance', e.target.value)}><MenuItem value=""><em>Automatisch erkennen</em></MenuItem>{(this.state.availableInstances['ical'] || []).map(id => <MenuItem key={id} value={id}>{id}</MenuItem>)}</Select></FormControl></Grid>{this.state.useCalendar && (<Grid item xs={12}><Paper variant="outlined" sx={{p: 2}}><Box sx={{display:'flex', justifyContent:'space-between', alignItems:'center', mb: 1}}><Typography variant="subtitle2">Relevante Kalender auswählen (Whitelist)</Typography><Button size="small" onClick={() => this.handleFetchCalendarNames()}>Kalender suchen</Button></Box>{this.state.detectedCalendars.length > 0 ? (<FormGroup row>{this.state.detectedCalendars.map(calName => (<FormControlLabel key={calName} control={<Checkbox checked={this.state.calendarSelection.includes(calName)} onChange={() => this.toggleCalendarSelection(calName)} />} label={calName} />))}</FormGroup>) : (<Typography variant="body2" color="text.secondary">Klicken Sie auf "Suchen", um Kalendernamen zu laden.</Typography>)}{this.state.calendarSelection.length === 0 && this.state.detectedCalendars.length > 0 && (<Alert severity="warning" sx={{mt: 1, py: 0}}>Achtung: Kein Kalender ausgewählt. Die KI wird alle Termine ignorieren!</Alert>)}</Paper></Grid>)}<Grid item xs={12}><Button variant="outlined" onClick={() => this.handleTestContextClick()} disabled={this.state.isTestingContext || (!this.state.useWeather && !this.state.useCalendar)}>Kontext-Daten jetzt prüfen</Button></Grid></Grid>); }
    renderNotificationRow(adapterName: string, enabledAttr: NotificationEnabledKey, instanceAttr: NotificationInstanceKey, recipientAttr: NotificationRecipientKey, recipientLabel: string) { const enabled = this.state[enabledAttr]; const instance = this.state[instanceAttr]; const recipient = this.state[recipientAttr]; let adapterKey = adapterName === 'whatsapp' ? 'whatsapp-cmb' : adapterName === 'signal' ? 'signal-cma' : adapterName; const instances = this.state.availableInstances[adapterKey] || []; return (<Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}><Grid item xs={12} sm={3}><FormControlLabel control={<Checkbox checked={enabled} onChange={e => this.updateNativeValue(enabledAttr, e.target.checked)} />} label={I18n.t(`notify_${adapterName}`)} /></Grid><Grid item xs={12} sm={4}><FormControl fullWidth size="small" disabled={!enabled}><InputLabel>{I18n.t('notify_instance')}</InputLabel><Select value={instance} label={I18n.t('notify_instance')} onChange={(e: any) => this.updateNativeValue(instanceAttr, e.target.value)}>{instances.length === 0 ? <MenuItem value="">{I18n.t('notify_no_instances')}</MenuItem> : instances.map(id => <MenuItem key={id} value={id}>{id}</MenuItem>)}</Select></FormControl></Grid><Grid item xs={12} sm={5}><TextField fullWidth size="small" label={recipientLabel} value={recipient} onChange={e => this.updateNativeValue(recipientAttr, e.target.value)} disabled={!enabled} required={adapterName === 'email' && enabled} /></Grid></Grid>); }
    renderNotificationsSection() { return ( <Box><Alert severity="info" sx={{mb: 2}}>Benachrichtigungen werden bei Alarmen und (wenn aktiviert) für Berichte verwendet.</Alert>{this.renderNotificationRow('telegram', 'notifyTelegramEnabled', 'notifyTelegramInstance', 'notifyTelegramRecipient', 'User ID')}{this.renderNotificationRow('pushover', 'notifyPushoverEnabled', 'notifyPushoverInstance', 'notifyPushoverRecipient', 'Device ID')}{this.renderNotificationRow('email', 'notifyEmailEnabled', 'notifyEmailInstance', 'notifyEmailRecipient', 'E-Mail')}{this.renderNotificationRow('whatsapp', 'notifyWhatsappEnabled', 'notifyWhatsappInstance', 'notifyWhatsappRecipient', 'Tel')}<Button variant="outlined" sx={{mt:1}} onClick={() => this.handleTestNotificationClick()} disabled={this.state.isTestingNotification}>Test</Button></Box> ); }

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

                {/* --- AUTOMATION COCKPIT (Refactored) --- */}
                <Accordion expanded={expandedAccordion === 'panelAutomation'} onChange={this.handleAccordionChange('panelAutomation')} sx={accordionStyle}>
                    <AccordionSummary expandIcon={<span>v</span>}><Typography sx={titleStyle}><SmartToyIcon/> 🤖 Autonomie & Vorhersage</Typography></AccordionSummary>
                    <AccordionDetails>
                        <AutomationView
                            mode={this.state.autoMode}
                            threshold={this.state.autoThreshold}
                            lastAction={this.state.autoLastAction}
                            aiPersona={this.state.aiPersona}
                            livingContext={this.state.livingContext}
                            isDark={isDark}
                            onModeChange={(m) => this.saveAutomationMode(m)}
                            onThresholdChange={(t) => this.saveAutomationThreshold(t)}
                            onRefreshLog={() => this.loadAutomationStates()}
                            onContextChange={(attr, val) => this.updateNativeValue(attr, val)}
                        />
                    </AccordionDetails>
                </Accordion>

                <Accordion expanded={expandedAccordion === 'panelTopology'} onChange={this.handleAccordionChange('panelTopology')} sx={accordionStyle}>
                    <AccordionSummary expandIcon={<span>v</span>}><Typography sx={titleStyle}><PsychologyIcon/> Haus-Topologie (Graph)</Typography></AccordionSummary>
                    <AccordionDetails>
                        <TopologyView socket={this.props.socket} adapterName={this.props.adapterName} instance={this.props.instance} themeType={this.props.themeType} />
                    </AccordionDetails>
                </Accordion>

                <Accordion expanded={expandedAccordion === 'panel5'} onChange={this.handleAccordionChange('panel5')} sx={accordionStyle}><AccordionSummary expandIcon={<span>v</span>}><Typography sx={titleStyle}>Reporting & Family Link</Typography></AccordionSummary><AccordionDetails>{this.renderReportingSection(tooltipProps)}</AccordionDetails></Accordion>
                <Accordion expanded={expandedAccordion === 'panel3'} onChange={this.handleAccordionChange('panel3')} sx={accordionStyle}><AccordionSummary expandIcon={<span>v</span>}><Typography sx={titleStyle}>Benachrichtigungen</Typography></AccordionSummary><AccordionDetails>{this.renderNotificationsSection()}</AccordionDetails></Accordion>

                {/* --- SENSOR LIST (Refactored) --- */}
                <Accordion expanded={expandedAccordion === 'panel4'} onChange={this.handleAccordionChange('panel4')} sx={accordionStyle}>
                    <AccordionSummary expandIcon={<span>v</span>}><Typography sx={titleStyle}>Sensoren</Typography></AccordionSummary>
                    <AccordionDetails>
                        <SensorList
                            devices={this.state.devices}
                            isDark={isDark}
                            uniqueLocations={this.collectUniqueLocations()}
                            onDeviceChange={(i, a, v) => this.onDeviceChange(i, a, v)}
                            onDelete={(i) => this.onDeleteDevice(i)}
                            onAdd={() => this.onAddDevice()}
                            onSelectId={(i) => this.openSelectIdDialog(i)}
                            onWizard={this.handleOpenWizard}
                            onBulk={this.handleOpenBulkDialog}
                            onDeleteAll={() => this.setState({showDeleteConfirm: true})}
                        />
                    </AccordionDetails>
                </Accordion>
            </Box>
        );
    }
}