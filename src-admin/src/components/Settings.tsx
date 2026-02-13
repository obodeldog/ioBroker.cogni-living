import React from 'react';
import {
    Button, Checkbox, CircularProgress, FormControl, IconButton, InputLabel, MenuItem, Select,
    TextField, Tooltip, Snackbar, Alert, Box, Paper, FormControlLabel, Grid, Dialog,
    DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemButton, ListItemText,
    ListItemIcon, LinearProgress, FormGroup, Collapse, Accordion, AccordionSummary,
    AccordionDetails, Typography, Divider, Chip, Table, TableBody, TableCell, TableHead, TableRow, Switch
} from '@mui/material';
import type { AlertColor } from '@mui/material';
import { type IobTheme, type ThemeType, I18n, DialogSelectID } from '@iobroker/adapter-react-v5';
import type { Connection } from '@iobroker/socket-client';

import SensorList from './settings/SensorList';
import NotificationsView from './settings/NotificationsView';
import BulkDialog from './settings/BulkDialog';

import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import VerifiedIcon from '@mui/icons-material/Verified';
import BuildIcon from '@mui/icons-material/Build';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import SecurityIcon from '@mui/icons-material/Security';
import BoltIcon from '@mui/icons-material/Bolt';
import WeekendIcon from '@mui/icons-material/Weekend';

interface SettingsProps { native: Record<string, any>; onChange: (attr: string, value: any) => void; socket: Connection; themeType: ThemeType; adapterName: string; instance: number; theme: IobTheme; onlySystem?: boolean; }
interface DeviceConfig { id: string; name: string; location: string; type: string; logDuplicates: boolean; isExit: boolean; isSolar?: boolean; }
interface ScannedDevice { id: string; name: string; location: string; type: string; logDuplicates: boolean; isExit: boolean; selected?: boolean; _score?: number; _source?: string; exists?: boolean; }
interface ScanFilters { motion: boolean; doors: boolean; lights: boolean; temperature: boolean; weather: boolean; selectedFunctionIds: string[]; }
interface EnumItem { id: string; name: string; }

interface ThermostatDiagItem { room: string; sensorId: string; setpointId: string; valveId?: string; source: string; isManual: boolean; status: string; }

interface SettingsState {
    devices: DeviceConfig[]; presenceDevices: string[]; outdoorSensorId: string; geminiApiKey: string; analysisInterval: number; minDaysForBaseline: number;
    aiPersona: string; livingContext: string; licenseKey: string; ltmStbWindowDays: number; ltmLtbWindowDays: number; ltmDriftCheckIntervalHours: number; flurRooms: string;
    inactivityMonitoringEnabled: boolean; inactivityThresholdHours: number; notifyTelegramEnabled: boolean; notifyTelegramInstance: string; notifyTelegramRecipient: string;
    notifyPushoverEnabled: boolean; notifyPushoverInstance: string; notifyPushoverRecipient: string; notifyEmailEnabled: boolean; notifyEmailInstance: string; notifyEmailRecipient: string;
    notifyWhatsappEnabled: boolean; notifyWhatsappInstance: string; notifyWhatsappRecipient: string; notifySignalEnabled: boolean; notifySignalInstance: string; notifySignalRecipient: string;
    briefingEnabled: boolean; briefingTime: string; useWeather: boolean; weatherInstance: string; useCalendar: boolean; calendarInstance: string; calendarSelection: string[];
    availableInstances: Record<string, string[]>; isTestingNotification: boolean; showSelectId: boolean; selectIdIndex: number; selectIdContext: 'device' | 'presence' | 'simulation' | 'outdoor' | null;
    isTestingApi: boolean; showWizard: boolean; wizardStep: number; scanFilters: ScanFilters; scannedDevices: ScannedDevice[]; showDeleteConfirm: boolean; availableEnums: EnumItem[];
    availableRooms: string[]; showEnumList: boolean; snackbarOpen: boolean; snackbarMessage: string; snackbarSeverity: AlertColor; expandedAccordion: string | false; showContextDialog: boolean;
    contextResult: { weather: string; calendar: string; } | null; isTestingContext: boolean; detectedCalendars: string[]; isLoadingCalendars: boolean; simTargetId: string;
    simTargetValue: string; showBulkDialog: boolean; autoMode: string; autoThreshold: number; autoLastAction: string;
    thermostatMapping: Record<string, string>;
    valveMapping: Record<string, string>;
    thermostatDiagResults: ThermostatDiagItem[];
    isScanningThermostats: boolean;

    editMappingContext: { sensorId: string, field: 'setpoint' | 'valve' } | null;
    editMappingValue: string;
}

export default class Settings extends React.Component<SettingsProps, SettingsState> {
    constructor(props: SettingsProps) {
        super(props);
        const native = props.native;
        let calSel = native.calendarSelection || [];
        if (typeof calSel === 'string') calSel = calSel.split(',').filter((s:string) => s);

        let tMap = {};
        if (native.thermostatMapping) {
            try { tMap = typeof native.thermostatMapping === 'string' ? JSON.parse(native.thermostatMapping) : native.thermostatMapping; } catch(e){}
        }

        let vMap = {};
        if (native.valveMapping) {
            try { vMap = typeof native.valveMapping === 'string' ? JSON.parse(native.valveMapping) : native.valveMapping; } catch(e){}
        }

        this.state = {
            devices: native.devices || [], presenceDevices: native.presenceDevices || [], outdoorSensorId: native.outdoorSensorId || '', geminiApiKey: native.geminiApiKey || '',
            analysisInterval: native.analysisInterval || 15, minDaysForBaseline: native.minDaysForBaseline || 7, aiPersona: native.aiPersona || 'generic', livingContext: native.livingContext || '',
            licenseKey: native.licenseKey || '', ltmStbWindowDays: native.ltmStbWindowDays || 14, ltmLtbWindowDays: native.ltmLtbWindowDays || 60, ltmDriftCheckIntervalHours: native.ltmDriftCheckIntervalHours || 24, flurRooms: native.flurRooms || 'flur, diele, gang, treppe',
            inactivityMonitoringEnabled: native.inactivityMonitoringEnabled || false, inactivityThresholdHours: native.inactivityThresholdHours || 12, notifyTelegramEnabled: native.notifyTelegramEnabled || false,
            notifyTelegramInstance: native.notifyTelegramInstance || '', notifyTelegramRecipient: native.notifyTelegramRecipient || '', notifyPushoverEnabled: native.notifyPushoverEnabled || false,
            notifyPushoverInstance: native.notifyPushoverInstance || '', notifyPushoverRecipient: native.notifyPushoverRecipient || '', notifyEmailEnabled: native.notifyEmailEnabled || false,
            notifyEmailInstance: native.notifyEmailInstance || '', notifyEmailRecipient: native.notifyEmailRecipient || '', notifyWhatsappEnabled: native.notifyWhatsappEnabled || false,
            notifyWhatsappInstance: native.notifyWhatsappInstance || '', notifyWhatsappRecipient: native.notifyWhatsappRecipient || '', notifySignalEnabled: native.notifySignalEnabled || false,
            notifySignalInstance: native.notifySignalInstance || '', notifySignalRecipient: native.notifySignalRecipient || '', briefingEnabled: native.briefingEnabled || false,
            briefingTime: native.briefingTime || "08:00", useWeather: native.useWeather || false, weatherInstance: native.weatherInstance || '', useCalendar: native.useCalendar || false,
            calendarInstance: native.calendarInstance || '', calendarSelection: calSel, availableInstances: {}, isTestingNotification: false, showSelectId: false, selectIdIndex: -1,
            selectIdContext: null, isTestingApi: false, showWizard: false, wizardStep: 0, scanFilters: { motion: true, doors: true, lights: true, temperature: true, weather: true, selectedFunctionIds: [] },
            scannedDevices: [], showDeleteConfirm: false, availableEnums: [], availableRooms: [], showEnumList: false, snackbarOpen: false, snackbarMessage: '', snackbarSeverity: 'info',
            expandedAccordion: 'panel0', showContextDialog: false, contextResult: null, isTestingContext: false, detectedCalendars: [], isLoadingCalendars: false, simTargetId: '',
            simTargetValue: 'true', showBulkDialog: false, autoMode: 'off', autoThreshold: 0.6, autoLastAction: 'Lade...',

            thermostatMapping: tMap,
            valveMapping: vMap,
            thermostatDiagResults: [],
            isScanningThermostats: false,
            editMappingContext: null,
            editMappingValue: ''
        };
    }

    componentDidMount() { this.fetchAvailableInstances(); this.fetchEnums(); }

    updateNativeValue(attr: string, value: any) {
        if (attr === 'livingContext' && typeof value === 'string' && value.length > 5000) value = value.substring(0, 1000);
        this.setState({ [attr]: value } as any, () => { this.props.onChange(attr, value); });
    }
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
                const devices = JSON.parse(JSON.stringify(this.state.devices)); devices[this.state.selectIdIndex].id = selectedId;
                this.props.socket.getObject(selectedId).then(obj => { if (obj && obj.common && obj.common.name) { let name: any = obj.common.name; if (typeof name === 'object') name = name[I18n.getLanguage()] || name.en || name.de || JSON.stringify(name); devices[this.state.selectIdIndex].name = name as string; this.updateDevices(devices); } else { this.updateDevices(devices); } }).catch(e => { this.updateDevices(devices); });
            } else if (this.state.selectIdContext === 'presence') {
                const p = [...this.state.presenceDevices]; if (!p.includes(selectedId)) { p.push(selectedId); this.updatePresenceDevices(p); }
            } else if (this.state.selectIdContext === 'simulation') {
                this.setState({ simTargetId: selectedId });
            } else if (this.state.selectIdContext === 'outdoor') {
                this.updateNativeValue('outdoorSensorId', selectedId);
            }
        }
        this.setState({ showSelectId: false, selectIdIndex: -1, selectIdContext: null });
    }

    handleSimulateButler = () => { if(!this.state.simTargetId) return this.showSnackbar('Bitte zuerst eine ID auswählen', 'warning'); this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'simulateButler', { targetId: this.state.simTargetId, targetValue: this.state.simTargetValue }).then((res: any) => { if(res && res.success) this.showSnackbar('Vorschlag simuliert! Bitte in Übersicht prüfen.', 'success'); else this.showSnackbar('Fehler bei Simulation', 'error'); }); }
    handleImportBulk = (selectedIds: string[], allObjects: Record<string, any>) => { if (selectedIds.length === 0) return; const currentDevices = [...this.state.devices]; let added = 0; selectedIds.forEach(id => { if (!currentDevices.find(d => d.id === id)) { const obj = allObjects[id]; let name = id; if (obj && obj.common && obj.common.name) { name = typeof obj.common.name === 'object' ? (obj.common.name[I18n.getLanguage()] || obj.common.name.de || obj.common.name.en) : obj.common.name; } currentDevices.push({ id: id, name: name, location: '', type: '', logDuplicates: false, isExit: false }); added++; } }); this.updateDevices(currentDevices); this.showSnackbar(`${added} Objekte hinzugefügt.`, 'success'); this.setState({ showBulkDialog: false }); }
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

    fetchAvailableInstances() { const adapters = ['telegram', 'pushover', 'email', 'whatsapp-cmb', 'signal-cma', 'accuweather', 'daswetter', 'weatherunderground', 'ical']; const instances: Record<string, string[]> = {}; const promises = adapters.map(adapter => this.props.socket.getAdapterInstances(adapter).then(objs => { instances[adapter] = objs.map(obj => obj._id.replace('system.adapter.', '')); }).catch(e => console.error(`Error fetching instances for ${adapter}:`, e))); Promise.all(promises).then(() => { this.setState({ availableInstances: instances }); }); }

    fetchEnums() { this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'getEnums', {}).then((res: any) => { if(res && res.success) { this.setState({ availableEnums: res.enums || [], availableRooms: res.rooms || [] }); } }); }

    // --- THERMOSTAT DIAGNOSTICS ---
    handleScanThermostats = () => {
        this.setState({ isScanningThermostats: true });
        this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'checkThermostats', {})
            .then((res: any) => {
                this.setState({ isScanningThermostats: false });
                if(res && res.results) {
                    this.setState({ thermostatDiagResults: res.results });
                } else {
                    this.showSnackbar('Keine Ergebnisse oder Timeout.', 'warning');
                }
            })
            .catch(e => {
                this.setState({ isScanningThermostats: false });
                this.showSnackbar(`Fehler: ${e.message}`, 'error');
            });
    }

    handleEditMapping = (sensorId: string, currentVal: string, field: 'setpoint' | 'valve' = 'setpoint') => {
        this.setState({ editMappingContext: { sensorId, field }, editMappingValue: currentVal });
    }

    handleSaveMapping = () => {
        if (!this.state.editMappingContext) return;
        const { sensorId, field } = this.state.editMappingContext;
        const newVal = this.state.editMappingValue.trim();

        if (field === 'setpoint') {
            const newMap = { ...this.state.thermostatMapping };
            if (newVal) newMap[sensorId] = newVal;
            else delete newMap[sensorId];
            this.setState({ thermostatMapping: newMap });
            this.updateNativeValue('thermostatMapping', JSON.stringify(newMap));
        } else {
            const newMap = { ...this.state.valveMapping };
            if (newVal) newMap[sensorId] = newVal;
            else delete newMap[sensorId];
            this.setState({ valveMapping: newMap });
            this.updateNativeValue('valveMapping', JSON.stringify(newMap));
        }

        this.setState({ editMappingContext: null });

        // Update list locally for immediate feedback
        const list = [...this.state.thermostatDiagResults];
        const item = list.find(x => x.sensorId === sensorId);
        if (item) {
            if (field === 'setpoint') item.setpointId = newVal || '-';
            else item.valveId = newVal || '-';
            item.isManual = true;
            item.source = 'Manuelles Mapping';
        }
        this.setState({ thermostatDiagResults: list });
    }

    renderThermostatSection(tooltipProps: any) {
        return (
            <Box sx={{p: 2}}>
                <Alert severity="info" sx={{mb: 2}}>
                    Hier sehen Sie, ob Cogni-Living die Verbindung zwischen Temperatur (Ist), Setpoint (Soll) UND <b>Ventil (Stellgröße)</b> gefunden hat.
                    <br/>Ohne Ventil-Erkennung kann die KI keine Heizkurven (Power) lernen, da sie nicht weiß, ob geheizt wird!
                </Alert>
                <Button variant="contained" startIcon={<RefreshIcon/>} onClick={this.handleScanThermostats} disabled={this.state.isScanningThermostats}>
                    {this.state.isScanningThermostats ? 'Scanne...' : 'Vollständige Diagnose Starten'}
                </Button>

                {this.state.thermostatDiagResults.length > 0 && (
                    <Table size="small" sx={{mt: 2}}>
                        <TableHead>
                            <TableRow>
                                <TableCell>Raum</TableCell>
                                <TableCell>Sensor (Ist)</TableCell>
                                <TableCell>Setpoint (Soll)</TableCell>
                                <TableCell>Ventil (Stellgröße)</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Action</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {this.state.thermostatDiagResults.map(row => {
                                const isEditingSetpoint = this.state.editMappingContext?.sensorId === row.sensorId && this.state.editMappingContext?.field === 'setpoint';
                                const isEditingValve = this.state.editMappingContext?.sensorId === row.sensorId && this.state.editMappingContext?.field === 'valve';
                                const isEditingAny = isEditingSetpoint || isEditingValve;

                                return (
                                    <TableRow key={row.sensorId}>
                                        <TableCell>{row.room}</TableCell>
                                        <TableCell sx={{fontSize:'0.8rem', color:'text.secondary'}}>{row.sensorId}</TableCell>

                                        {/* SETPOINT */}
                                        <TableCell>
                                            {isEditingSetpoint ? (
                                                <TextField size="small" fullWidth value={this.state.editMappingValue} onChange={e => this.setState({editMappingValue: e.target.value})} autoFocus />
                                            ) : (
                                                <Box sx={{display:'flex', alignItems:'center'}}>
                                                    <span style={{fontWeight: row.isManual ? 'bold' : 'normal', marginRight: 4}}>{row.setpointId}</span>
                                                    <IconButton size="small" onClick={() => this.handleEditMapping(row.sensorId, row.setpointId === '-' ? '' : row.setpointId, 'setpoint')} disabled={!!this.state.editMappingContext && !isEditingSetpoint}>
                                                        <EditIcon fontSize="small" style={{fontSize:14}}/>
                                                    </IconButton>
                                                </Box>
                                            )}
                                        </TableCell>

                                        {/* VALVE */}
                                        <TableCell>
                                            {isEditingValve ? (
                                                <TextField size="small" fullWidth value={this.state.editMappingValue} onChange={e => this.setState({editMappingValue: e.target.value})} autoFocus />
                                            ) : (
                                                <Box sx={{display:'flex', alignItems:'center'}}>
                                                    <span style={{fontWeight: row.isManual ? 'bold' : 'normal', fontFamily: 'monospace', marginRight: 4}}>
                                                        {row.valveId || '-'}
                                                    </span>
                                                    <IconButton size="small" onClick={() => this.handleEditMapping(row.sensorId, row.valveId === '-' ? '' : (row.valveId || ''), 'valve')} disabled={!!this.state.editMappingContext && !isEditingValve}>
                                                        <EditIcon fontSize="small" style={{fontSize:14}}/>
                                                    </IconButton>
                                                </Box>
                                            )}
                                        </TableCell>

                                        <TableCell>
                                            <Chip
                                                label={row.status}
                                                color={row.status === 'PERFECT' ? 'success' : (row.status === 'OK' ? 'warning' : 'error')}
                                                size="small"
                                                variant={row.status === 'PERFECT' ? 'filled' : 'outlined'}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {isEditingAny && (
                                                <IconButton size="small" color="primary" onClick={() => this.handleSaveMapping()}><SaveIcon/></IconButton>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </Box>
        );
    }

    renderContextDialog() { return ( <Dialog open={this.state.showContextDialog} onClose={() => this.setState({ showContextDialog: false })} maxWidth="sm" fullWidth><DialogTitle>Kontext-Daten (Live-Check)</DialogTitle><DialogContent dividers><Typography variant="subtitle2" color="primary" gutterBottom>Wetter-Status</Typography><Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}><Typography variant="body2" style={{ fontFamily: 'monospace' }}>{this.state.contextResult?.weather || 'Lade...'}</Typography></Paper><Typography variant="subtitle2" color="primary" gutterBottom>Kalender-Status (Gefiltert)</Typography><Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default', maxHeight: 200, overflow: 'auto' }}><Typography variant="body2" style={{ fontFamily: 'monospace' }}>{this.state.contextResult?.calendar || 'Lade...'}</Typography></Paper></DialogContent><DialogActions><Button onClick={() => this.setState({ showContextDialog: false })}>Schließen</Button></DialogActions></Dialog> ); }
    renderWizardDialog() {
        const { showWizard, wizardStep, scanFilters, scannedDevices, availableEnums, showEnumList } = this.state;
        return (
            <Dialog open={showWizard} onClose={() => wizardStep !== 1 && this.setState({ showWizard: false })} maxWidth="md" fullWidth>
                <DialogTitle>Auto-Discovery Wizard {wizardStep !== 1 && <IconButton onClick={() => this.setState({ showWizard: false })} sx={{ position: 'absolute', right: 8, top: 8 }}>x</IconButton>}</DialogTitle>
                <DialogContent dividers>
                    {wizardStep === 0 && (
                        <Box sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>Was soll gescannt werden?</Typography>
                            <FormGroup>
                                <FormControlLabel control={<Checkbox checked={scanFilters.motion} onChange={() => this.handleFilterChange('motion')} />} label="Bewegungsmelder" />
                                <FormControlLabel control={<Checkbox checked={scanFilters.doors} onChange={() => this.handleFilterChange('doors')} />} label="Fenster & Türen" />
                                <FormControlLabel control={<Checkbox checked={scanFilters.lights} onChange={() => this.handleFilterChange('lights')} />} label="Lichter & Schalter" />
                                <Box sx={{ mt: 1, mb: 1 }}>
                                    <FormControlLabel control={<Checkbox checked={scanFilters.temperature} onChange={() => this.handleFilterChange('temperature')} />} label="Temperatur / Klima" />
                                    <FormControlLabel control={<Checkbox checked={scanFilters.weather} onChange={() => this.handleFilterChange('weather')} color="warning" />} label="Wetterdaten (Alle Adapter)" />
                                </Box>
                                {availableEnums.length > 0 && (
                                    <Box sx={{ mt: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                        <ListItemButton onClick={() => this.setState({ showEnumList: !showEnumList })}>
                                            <ListItemText primary="Spezifische Funktionen" secondary={`${scanFilters.selectedFunctionIds.length} ausgewählt`} />
                                            {showEnumList ? <span>^</span> : <span>v</span>}
                                        </ListItemButton>
                                        <Collapse in={showEnumList} timeout="auto" unmountOnExit>
                                            <List component="div" disablePadding dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                                                {availableEnums.map((en) => (
                                                    <ListItem key={en.id} dense disablePadding>
                                                        <ListItemButton onClick={() => this.handleEnumToggle(en.id)}>
                                                            <ListItemIcon><Checkbox edge="start" checked={scanFilters.selectedFunctionIds.indexOf(en.id) !== -1} tabIndex={-1} disableRipple /></ListItemIcon>
                                                            <ListItemText primary={en.name} secondary={en.id} />
                                                        </ListItemButton>
                                                    </ListItem>
                                                ))}
                                            </List>
                                        </Collapse>
                                    </Box>
                                )}
                            </FormGroup>
                        </Box>
                    )}
                    {wizardStep === 1 && (
                        <Box sx={{ width: '100%', mt: 4, mb: 4, textAlign: 'center' }}>
                            <LinearProgress />
                            <Typography variant="h6" sx={{ mt: 2 }}>Suche Sensoren & analysiere Namen...</Typography>
                        </Box>
                    )}
                    {wizardStep === 2 && (
                        <Box>
                            <List dense sx={{ width: '100%', bgcolor: 'background.paper', maxHeight: 400, overflow: 'auto' }}>
                                {scannedDevices.map(d => {
                                    if(d.exists) return null;
                                    const isEnum = d._source && d._source === "Enum";
                                    const confidence = d._score || 50;
                                    const color = confidence >= 80 ? "success" : (confidence >= 50 ? "warning" : "error");
                                    return (
                                        <ListItem key={d.id} disablePadding divider>
                                            <ListItemButton onClick={() => this.handleToggleScannedDevice(scannedDevices.indexOf(d))} dense>
                                                <ListItemIcon><Checkbox edge="start" checked={d.selected} tabIndex={-1} /></ListItemIcon>
                                                <ListItemText
                                                    primary={<Box sx={{display:'flex', alignItems:'center', gap: 1}}>{d.name || d.id}<Chip label={isEnum ? "Enum" : "AI-Scan"} size="small" color={isEnum ? "success" : "default"} variant="outlined" style={{height: 20, fontSize: '0.7rem'}}/>{d._source && d._source.includes("Heuristic") && <Chip label={`${confidence}%`} size="small" color={color} variant="outlined" style={{height: 20, fontSize: '0.7rem'}} icon={confidence<60 ? <HelpOutlineIcon style={{fontSize:14}}/> : <VerifiedIcon style={{fontSize:14}}/>}/>}</Box>}
                                                    secondary={`${d.type} • ${d.location || '(Kein Raum)'}`}
                                                />
                                            </ListItemButton>
                                        </ListItem>
                                    );
                                })}
                                {scannedDevices.filter(d => d.exists).length > 0 && <Box sx={{p: 1, bgcolor: '#f0f0f0', color: '#666', fontSize:'0.8rem', fontWeight:'bold'}}>Bereits konfiguriert:</Box>}
                                {scannedDevices.filter(d => d.exists).map(d => (
                                    <ListItem key={d.id} disablePadding divider>
                                        <ListItemButton dense disabled>
                                            <ListItemIcon><span>OK</span></ListItemIcon>
                                            <ListItemText primary={d.name || d.id} secondary="Bereits aktiv" />
                                        </ListItemButton>
                                    </ListItem>
                                ))}
                            </List>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    {wizardStep === 0 && <Button variant="contained" onClick={this.handleStartScan}>Scan Starten</Button>}
                    {wizardStep === 2 && (
                        <>
                            <Button onClick={() => this.setState({ wizardStep: 0 })}>Zurück</Button>
                            <Button onClick={this.handleSelectAll}>Alle</Button>
                            <Button onClick={this.handleDeselectAll}>Keine</Button>
                            <Box sx={{ flexGrow: 1 }} />
                            <Button variant="contained" onClick={this.handleImportDevices} color="primary">{this.state.scannedDevices.filter(d => d.selected).length} Importieren</Button>
                        </>
                    )}
                </DialogActions>
            </Dialog>
        );
    }

    renderDialogs() { return ( <>{this.state.showSelectId && (<DialogSelectID theme={this.props.theme} imagePrefix="../.." dialogName="selectID" themeType={this.props.themeType} socket={this.props.socket} selected={this.state.selectIdContext === 'outdoor' ? this.state.outdoorSensorId : (this.state.selectIdContext === 'device' && this.state.devices[this.state.selectIdIndex]?.id) || ''} onClose={() => this.setState({ showSelectId: false })} onOk={selected => this.onSelectId(selected as string)} />)}{this.renderWizardDialog()}{this.renderContextDialog()}<Dialog open={this.state.showDeleteConfirm} onClose={() => this.setState({showDeleteConfirm:false})}><DialogTitle>Sicher?</DialogTitle><DialogContent><Typography>Alle Sensoren löschen?</Typography></DialogContent><DialogActions><Button onClick={()=>this.setState({showDeleteConfirm:false})}>Abbrechen</Button><Button onClick={this.onDeleteAllDevices} color="error">Löschen</Button></DialogActions></Dialog><Snackbar open={this.state.snackbarOpen} autoHideDuration={6000} onClose={this.handleSnackbarClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}><Alert onClose={this.handleSnackbarClose} severity={this.state.snackbarSeverity}>{this.state.snackbarMessage}</Alert></Snackbar><BulkDialog open={this.state.showBulkDialog} onClose={() => this.setState({ showBulkDialog: false })} onImport={this.handleImportBulk} socket={this.props.socket} /></> ); }
    renderLicenseSection(tooltipProps: any) { return ( <Grid container spacing={3}><Grid item xs={12} md={6}><Tooltip title="Ihr Pro-Lizenzschlüssel." {...tooltipProps}><TextField fullWidth label={I18n.t('license_key')} value={this.state.licenseKey} type="password" onChange={e => this.updateNativeValue('licenseKey', e.target.value)} helperText="Für vollen Funktionsumfang" variant="outlined" size="small" /></Tooltip></Grid><Grid item xs={12} md={6}><Box sx={{display: 'flex', gap: 1}}><Tooltip title="Gemini API Key." {...tooltipProps}><TextField fullWidth label={I18n.t('gemini_api_key')} value={this.state.geminiApiKey} type="password" onChange={e => this.updateNativeValue('geminiApiKey', e.target.value)} variant="outlined" size="small" /></Tooltip><Button variant="outlined" onClick={() => this.handleTestApiClick()} disabled={this.state.isTestingApi || !this.state.geminiApiKey}>{this.state.isTestingApi ? <CircularProgress size={20} /> : "(Test)"}</Button></Box></Grid></Grid> ); }

    renderReportingSection(tooltipProps: any) {
        return (
            <Grid container spacing={3}>
                <Grid item xs={12}><Alert severity="info">Konfigurieren Sie hier Wetter & Kontext für alle Säulen.</Alert></Grid>

                <Grid item xs={12}>
                    <Tooltip title="Beschreiben Sie Ihre Wohnsituation für die KI (z.B. '4 Personen, Homeoffice, Hund')." {...tooltipProps}>
                        <TextField
                            fullWidth
                            multiline
                            minRows={3}
                            label="KI-Kontext & Lebenssituation"
                            value={this.state.livingContext}
                            onChange={e => this.updateNativeValue('livingContext', e.target.value)}
                            helperText="Freitext für 'Soft Skills' (wird an Gemini gesendet)"
                            variant="outlined"
                        />
                    </Tooltip>
                </Grid>

                <Grid item xs={12}>
                    <Tooltip title="Räume für Ganggeschwindigkeits-Analyse (komma-getrennt, z.B. 'flur, diele, gang'). Diese werden zur Berechnung der Mobilität herangezogen." {...tooltipProps}>
                        <TextField
                            fullWidth
                            label="Flur-Räume (für Ganggeschwindigkeit)"
                            value={this.state.flurRooms}
                            onChange={e => this.updateNativeValue('flurRooms', e.target.value)}
                            helperText="Keywords für Durchgangsräume (komma-getrennt)"
                            variant="outlined"
                            size="small"
                        />
                    </Tooltip>
                </Grid>

                <Grid item xs={12} md={6}><FormControlLabel control={<Checkbox checked={this.state.briefingEnabled} onChange={e => this.updateNativeValue('briefingEnabled', e.target.checked)} />} label="Tägliches 'Guten Morgen' Briefing" /><Typography variant="caption" color="text.secondary" display="block">Sendet morgens eine Zusammenfassung der Nacht (Schlaf/Aktivität).</Typography></Grid><Grid item xs={12} md={6}><Tooltip title="Uhrzeit für den täglichen Bericht (Format HH:MM)." {...tooltipProps}><TextField fullWidth label="Uhrzeit" type="time" value={this.state.briefingTime} onChange={e => this.updateNativeValue('briefingTime', e.target.value)} disabled={!this.state.briefingEnabled} InputLabelProps={{ shrink: true }} size="small" /></Tooltip></Grid><Grid item xs={12}><Divider textAlign="left"><Typography variant="caption" sx={{color:'text.secondary', display:'flex', alignItems:'center', gap:1}}>Erweiterter Kontext</Typography></Divider></Grid><Grid item xs={12} md={6}><FormControlLabel control={<Checkbox checked={this.state.useWeather} onChange={e => this.updateNativeValue('useWeather', e.target.checked)} />} label="Wetterdaten nutzen" /><FormControl fullWidth size="small" disabled={!this.state.useWeather}><InputLabel>Wetter-Instanz (Optional)</InputLabel><Select value={this.state.weatherInstance} label="Wetter-Instanz (Optional)" onChange={(e) => this.updateNativeValue('weatherInstance', e.target.value)}><MenuItem value=""><em>Automatisch erkennen</em></MenuItem>{[...(this.state.availableInstances['accuweather'] || []), ...(this.state.availableInstances['daswetter'] || []), ...(this.state.availableInstances['weatherunderground'] || [])].map(id => <MenuItem key={id} value={id}>{id}</MenuItem>)}</Select></FormControl></Grid><Grid item xs={12} md={6}><Box sx={{display: 'flex', alignItems: 'center', gap: 1}}><Typography variant="body1">Eigener Außenfühler (Hardware):</Typography><Tooltip title="Wählen Sie einen physischen Sensor (z.B. im Garten). Dieser Wert wird bevorzugt behandelt."><IconButton onClick={() => this.openOutdoorSelectId()}>...</IconButton></Tooltip></Box><Box sx={{display: 'flex', gap: 1}}><TextField fullWidth size="small" value={this.state.outdoorSensorId} onChange={e => this.updateNativeValue('outdoorSensorId', e.target.value)} placeholder="Kein Sensor gewählt" helperText="Hat Vorrang vor Wetter-Adapter" /><IconButton onClick={() => this.openOutdoorSelectId()}>...</IconButton></Box></Grid><Grid item xs={12} md={6}><FormControlLabel control={<Checkbox checked={this.state.useCalendar} onChange={e => this.updateNativeValue('useCalendar', e.target.checked)} />} label="Kalender nutzen (iCal)" /><FormControl fullWidth size="small" disabled={!this.state.useCalendar}><InputLabel>Kalender-Instanz (Optional)</InputLabel><Select value={this.state.calendarInstance} label="Kalender-Instanz (Optional)" onChange={(e) => this.updateNativeValue('calendarInstance', e.target.value)}><MenuItem value=""><em>Automatisch erkennen</em></MenuItem>{(this.state.availableInstances['ical'] || []).map(id => <MenuItem key={id} value={id}>{id}</MenuItem>)}</Select></FormControl></Grid>{this.state.useCalendar && (<Grid item xs={12}><Paper variant="outlined" sx={{p: 2}}><Box sx={{display:'flex', justifyContent:'space-between', alignItems:'center', mb: 1}}><Typography variant="subtitle2">Relevante Kalender auswählen (Whitelist)</Typography><Button size="small" onClick={() => this.handleFetchCalendarNames()}>Kalender suchen</Button></Box>{this.state.detectedCalendars.length > 0 ? (<FormGroup row>{this.state.detectedCalendars.map(calName => (<FormControlLabel key={calName} control={<Checkbox checked={this.state.calendarSelection.includes(calName)} onChange={() => this.toggleCalendarSelection(calName)} />} label={calName} />))}</FormGroup>) : (<Typography variant="body2" color="text.secondary">Klicken Sie auf "Suchen", um Kalendernamen zu laden.</Typography>)}{this.state.calendarSelection.length === 0 && this.state.detectedCalendars.length > 0 && (<Alert severity="warning" sx={{mt: 1, py: 0}}>Achtung: Kein Kalender ausgewählt. Die KI wird alle Termine ignorieren!</Alert>)}</Paper></Grid>)}<Grid item xs={12}><Button variant="outlined" onClick={() => this.handleTestContextClick()} disabled={this.state.isTestingContext || (!this.state.useWeather && !this.state.useCalendar)}>Kontext-Daten jetzt prüfen</Button></Grid></Grid>
        );
    }

    // --- NEU: MODUL STEUERUNG ---
    renderModuleControl() {
        const { native } = this.props;
        // Check for undefined to support older configs (default true)
        const mh = native.moduleHealth !== false;
        const ms = native.moduleSecurity !== false;
        const me = native.moduleEnergy !== false;
        const mc = native.moduleComfort !== false;

        return (
            <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                    <Paper variant="outlined" sx={{p: 2, display:'flex', flexDirection:'column', alignItems:'center', gap: 1, opacity: mh ? 1 : 0.6}}>
                        <MonitorHeartIcon fontSize="large" color={mh ? "error" : "disabled"}/>
                        <Typography variant="subtitle2">Gesundheit (AAL)</Typography>
                        <Switch checked={mh} onChange={(e) => this.updateNativeValue('moduleHealth', e.target.checked)} />
                    </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Paper variant="outlined" sx={{p: 2, display:'flex', flexDirection:'column', alignItems:'center', gap: 1, opacity: ms ? 1 : 0.6}}>
                        <SecurityIcon fontSize="large" color={ms ? "primary" : "disabled"}/>
                        <Typography variant="subtitle2">Sicherheit</Typography>
                        <Switch checked={ms} onChange={(e) => this.updateNativeValue('moduleSecurity', e.target.checked)} />
                    </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Paper variant="outlined" sx={{p: 2, display:'flex', flexDirection:'column', alignItems:'center', gap: 1, opacity: me ? 1 : 0.6}}>
                        <BoltIcon fontSize="large" style={{color: me ? '#ff9800' : 'grey'}}/>
                        <Typography variant="subtitle2">Energie</Typography>
                        <Switch checked={me} onChange={(e) => this.updateNativeValue('moduleEnergy', e.target.checked)} />
                    </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Paper variant="outlined" sx={{p: 2, display:'flex', flexDirection:'column', alignItems:'center', gap: 1, opacity: mc ? 1 : 0.6}}>
                        <WeekendIcon fontSize="large" style={{color: mc ? '#9c27b0' : 'grey'}}/>
                        <Typography variant="subtitle2">Komfort</Typography>
                        <Switch checked={mc} onChange={(e) => this.updateNativeValue('moduleComfort', e.target.checked)} />
                    </Paper>
                </Grid>
            </Grid>
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
            <Box sx={{ p: 0 }}>
                {this.renderDialogs()}

                {/* MODUL STEUERUNG (NEU GANZ OBEN) */}
                <Accordion expanded={expandedAccordion === 'panel0'} onChange={this.handleAccordionChange('panel0')} sx={accordionStyle} defaultExpanded>
                    <AccordionSummary expandIcon={<span>v</span>}><Typography sx={titleStyle}><ViewModuleIcon color="primary"/> AURA Module & Fokus</Typography></AccordionSummary>
                    <AccordionDetails>
                        <Alert severity="info" sx={{mb: 2}}>Deaktivieren Sie nicht benötigte Module, um die Ansicht zu vereinfachen und Ressourcen zu sparen.</Alert>
                        {this.renderModuleControl()}
                    </AccordionDetails>
                </Accordion>

                {/* LIZENZ */}
                <Accordion expanded={expandedAccordion === 'panel1'} onChange={this.handleAccordionChange('panel1')} sx={accordionStyle}><AccordionSummary expandIcon={<span>v</span>}><Typography sx={titleStyle}>Lizenz & KI-Verbindung</Typography></AccordionSummary><AccordionDetails>{this.renderLicenseSection(tooltipProps)}</AccordionDetails></Accordion>

                {/* REPORTING */}
                <Accordion expanded={expandedAccordion === 'panel5'} onChange={this.handleAccordionChange('panel5')} sx={accordionStyle}><AccordionSummary expandIcon={<span>v</span>}><Typography sx={titleStyle}>Reporting & Kontext</Typography></AccordionSummary><AccordionDetails>{this.renderReportingSection(tooltipProps)}</AccordionDetails></Accordion>

                {/* THERMOSTAT DIAGNOSE (NEU) */}
                <Accordion expanded={expandedAccordion === 'panel6'} onChange={this.handleAccordionChange('panel6')} sx={accordionStyle}><AccordionSummary expandIcon={<span>v</span>}><Typography sx={titleStyle}><BuildIcon /> Thermostat-Diagnose (Experte)</Typography></AccordionSummary><AccordionDetails>{this.renderThermostatSection(tooltipProps)}</AccordionDetails></Accordion>

                {/* NOTIFICATIONS */}
                <Accordion expanded={expandedAccordion === 'panel3'} onChange={this.handleAccordionChange('panel3')} sx={accordionStyle}><AccordionSummary expandIcon={<span>v</span>}><Typography sx={titleStyle}>Benachrichtigungen</Typography></AccordionSummary><AccordionDetails>
                    <NotificationsView settings={this.state as any} availableInstances={this.state.availableInstances} isTesting={this.state.isTestingNotification} onChange={(attr, val) => this.updateNativeValue(attr, val)} onTest={() => this.handleTestNotificationClick()} />
                </AccordionDetails></Accordion>

                {/* SENSORS */}
                <Accordion expanded={expandedAccordion === 'panel4'} onChange={this.handleAccordionChange('panel4')} sx={accordionStyle}><AccordionSummary expandIcon={<span>v</span>}><Typography sx={titleStyle}>Sensoren</Typography></AccordionSummary><AccordionDetails>
                    <SensorList devices={this.state.devices} isDark={isDark} uniqueLocations={this.collectUniqueLocations()} onDeviceChange={(i, a, v) => this.onDeviceChange(i, a, v)} onDelete={(i) => this.onDeleteDevice(i)} onAdd={() => this.onAddDevice()} onSelectId={(i) => this.openSelectIdDialog(i)} onWizard={this.handleOpenWizard} onBulk={() => this.setState({ showBulkDialog: true })} onDeleteAll={() => this.setState({showDeleteConfirm: true})} />
                </AccordionDetails></Accordion>
            </Box>
        );
    }
}