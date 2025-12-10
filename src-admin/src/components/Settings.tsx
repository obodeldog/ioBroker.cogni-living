import React from 'react';
import { Button, Checkbox, CircularProgress, FormControl, IconButton, InputLabel, MenuItem, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Snackbar, Alert, Box, Paper, FormControlLabel, Grid, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemButton, ListItemText, ListItemIcon, LinearProgress, FormGroup, Collapse, Accordion, AccordionSummary, AccordionDetails, Typography, Divider, Autocomplete, createFilterOptions, Chip } from '@mui/material';
import type { AlertColor } from '@mui/material';

import { I18n, DialogSelectID, type IobTheme, type ThemeType } from '@iobroker/adapter-react-v5';
import type { Connection } from '@iobroker/socket-client';

// Icons
import VerifiedIcon from '@mui/icons-material/Verified';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';

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
    // BULK ADD STATES
    showBulkDialog: boolean;
    bulkLoading: boolean;
    bulkAllObjects: Record<string, any>;
    bulkFilter: string;
    bulkSelected: string[];
}

type NotificationEnabledKey = 'notifyTelegramEnabled' | 'notifyPushoverEnabled' | 'notifyEmailEnabled' | 'notifyWhatsappEnabled' | 'notifySignalEnabled';
type NotificationInstanceKey = 'notifyTelegramInstance' | 'notifyPushoverInstance' | 'notifyEmailInstance' | 'notifyWhatsappInstance' | 'notifySignalInstance';
type NotificationRecipientKey = 'notifyTelegramRecipient' | 'notifyPushoverRecipient' | 'notifyEmailRecipient' | 'notifyWhatsappRecipient' | 'notifySignalRecipient';

const SENSOR_TYPES = [
    { id: 'motion', label: 'Bewegungsmelder (Motion)' },
    { id: 'door', label: 'Tür / Fenster (Door)' },
    { id: 'fire', label: 'Rauchmelder (Fire)' },
    { id: 'temperature', label: 'Temperatur / Klima' },
    { id: 'light', label: 'Licht / Schalter (Light)' },
    { id: 'blind', label: 'Rollladen / Jalousie' },
    { id: 'lock', label: 'Schloss (Lock)' },
    { id: 'custom', label: 'Sonstiges (Custom)' }
];

const filter = createFilterOptions<string>();

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
            // BULK INIT
            showBulkDialog: false,
            bulkLoading: false,
            bulkAllObjects: {},
            bulkFilter: '',
            bulkSelected: []
        };
    }

    componentDidMount() { this.fetchAvailableInstances(); this.fetchEnums(); }
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
            const allKeys = Object.keys(bulkAllObjects).sort();

            // --- SMART SEARCH LOGIC ---
            // 1. Suche in Kleinbuchstaben
            const lowerFilter = bulkFilter.toLowerCase();
            // 2. Suche aufteilen in Begriffe ("licht julia" -> ["licht", "julia"])
            const filterParts = lowerFilter.split(' ').filter(part => part.trim().length > 0);

            if (filterParts.length === 0 && allKeys.length > 5000) {
                // Warte auf Input
            } else {
                for (const id of allKeys) {
                    if (filteredKeys.length > 100) break; // Limit

                    const obj = bulkAllObjects[id];
                    const name = obj?.common?.name ? (typeof obj.common.name === 'object' ? JSON.stringify(obj.common.name) : obj.common.name) : '';
                    const fullString = (id + " " + name).toLowerCase();

                    // 3. ALLE Begriffe müssen enthalten sein (AND-Logik)
                    // Beispiel: "licht" muss drin sein UND "julia" muss drin sein.
                    const isMatch = filterParts.every(part => fullString.includes(part));

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
                            label="Suche (ID oder Name)..."
                            variant="outlined"
                            value={bulkFilter}
                            onChange={(e) => this.setState({ bulkFilter: e.target.value })}
                            autoFocus
                            placeholder="z.B. 'licht wohnzimmer' (findet beides)"
                            helperText="Leerzeichen trennt Begriffe (AND-Suche)"
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
                                            <ListItemIcon>
                                                <Checkbox
                                                    edge="start"
                                                    checked={bulkSelected.indexOf(id) !== -1}
                                                    tabIndex={-1}
                                                    disableRipple
                                                />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={name}
                                                secondary={id}
                                                primaryTypographyProps={{ style: { fontWeight: 'bold' } }}
                                                secondaryTypographyProps={{ style: { fontSize: '0.8rem', fontFamily: 'monospace' } }}
                                            />
                                        </ListItemButton>
                                    </ListItem>
                                );
                            })}
                            {filteredKeys.length >= 100 && <ListItem><ListItemText secondary="... Anzeige limitiert (bitte Suche verfeinern)" /></ListItem>}
                        </List>
                    )}
                </DialogContent>
                <DialogActions>
                    <Typography sx={{flexGrow: 1, ml: 2}} variant="caption">
                        {bulkSelected.length} ausgewählt
                    </Typography>
                    <Button onClick={() => this.setState({ showBulkDialog: false })}>Abbrechen</Button>
                    <Button onClick={this.handleImportBulk} variant="contained" color="primary" disabled={bulkSelected.length === 0}>
                        Übernehmen
                    </Button>
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

    renderNotificationRow(adapterName: string, enabledAttr: NotificationEnabledKey, instanceAttr: NotificationInstanceKey, recipientAttr: NotificationRecipientKey, recipientLabel: string) { const enabled = this.state[enabledAttr]; const instance = this.state[instanceAttr]; const recipient = this.state[recipientAttr]; let adapterKey = adapterName === 'whatsapp' ? 'whatsapp-cmb' : adapterName === 'signal' ? 'signal-cma' : adapterName; const instances = this.state.availableInstances[adapterKey] || []; return (<Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}><Grid item xs={12} sm={3}><FormControlLabel control={<Checkbox checked={enabled} onChange={e => this.updateNativeValue(enabledAttr, e.target.checked)} />} label={I18n.t(`notify_${adapterName}`)} /></Grid><Grid item xs={12} sm={4}><FormControl fullWidth size="small" disabled={!enabled}><InputLabel>{I18n.t('notify_instance')}</InputLabel><Select value={instance} label={I18n.t('notify_instance')} onChange={(e: any) => this.updateNativeValue(instanceAttr, e.target.value)}>{instances.length === 0 ? <MenuItem value="">{I18n.t('notify_no_instances')}</MenuItem> : instances.map(id => <MenuItem key={id} value={id}>{id}</MenuItem>)}</Select></FormControl></Grid><Grid item xs={12} sm={5}><TextField fullWidth size="small" label={recipientLabel} value={recipient} onChange={e => this.updateNativeValue(recipientAttr, e.target.value)} disabled={!enabled} required={adapterName === 'email' && enabled} /></Grid></Grid>); }
    renderNotificationsSection() { return ( <Box><Alert severity="info" sx={{mb: 2}}>Benachrichtigungen werden bei Alarmen und (wenn aktiviert) für Berichte verwendet.</Alert>{this.renderNotificationRow('telegram', 'notifyTelegramEnabled', 'notifyTelegramInstance', 'notifyTelegramRecipient', 'User ID')}{this.renderNotificationRow('pushover', 'notifyPushoverEnabled', 'notifyPushoverInstance', 'notifyPushoverRecipient', 'Device ID')}{this.renderNotificationRow('email', 'notifyEmailEnabled', 'notifyEmailInstance', 'notifyEmailRecipient', 'E-Mail')}{this.renderNotificationRow('whatsapp', 'notifyWhatsappEnabled', 'notifyWhatsappInstance', 'notifyWhatsappRecipient', 'Tel')}<Button variant="outlined" sx={{mt:1}} onClick={() => this.handleTestNotificationClick()} disabled={this.state.isTestingNotification}>Test</Button></Box> ); }

    renderSensorsSection(isDark: boolean) {
        const uniqueLocations = this.collectUniqueLocations();

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
                                    <TableCell sx={{minWidth: 150}}>
                                        <Autocomplete
                                            freeSolo
                                            options={uniqueLocations}
                                            value={device.location || ''}
                                            onChange={(event, newValue) => {
                                                if (typeof newValue === 'string') {
                                                    this.onDeviceChange(index, 'location', newValue);
                                                } else {
                                                    this.onDeviceChange(index, 'location', '');
                                                }
                                            }}
                                            onInputChange={(event, newInputValue) => {
                                                this.onDeviceChange(index, 'location', newInputValue);
                                            }}
                                            filterOptions={(options, params) => {
                                                const filtered = filter(options, params);
                                                const { inputValue } = params;
                                                const isExisting = options.some((option) => inputValue === option);
                                                if (inputValue !== '' && !isExisting) {
                                                    filtered.push(inputValue);
                                                }
                                                return filtered;
                                            }}
                                            selectOnFocus
                                            clearOnBlur
                                            handleHomeEndKeys
                                            renderOption={(props, option) => {
                                                const { key, ...optionProps } = props;
                                                return (
                                                    <li key={key} {...optionProps}>
                                                        {option}
                                                    </li>
                                                );
                                            }}
                                            renderInput={(params) => (
                                                <TextField {...params} variant="standard" size="small" placeholder="Raum wählen..." />
                                            )}
                                        />
                                    </TableCell>
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
                    <Box>
                        <Button variant="contained" color="secondary" onClick={this.handleOpenWizard} sx={{ mr: 1 }}>Auto-Discovery</Button>
                        <Button variant="outlined" onClick={this.handleOpenBulkDialog} sx={{ mr: 1 }} startIcon={<PlaylistAddIcon />}>Massen-Add</Button>
                        <Button variant="outlined" onClick={() => this.onAddDevice()}>[+] NEU</Button>
                    </Box>
                    {this.state.devices.length > 0 && <Button color="error" size="small" onClick={() => this.setState({showDeleteConfirm: true})}>Alle löschen</Button>}
                </Box>
            </Box>
        );
    }
}