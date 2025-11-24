import React from 'react';

// MUI v5 Core Imports
import {
    Button,
    Checkbox,
    CircularProgress,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
    Snackbar,
    Alert,
    Box,
    Paper,
    FormControlLabel,
    Grid,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    LinearProgress,
    ListSubheader,
    FormGroup
} from '@mui/material';
import type { AlertColor } from '@mui/material';

// MUI v5 Icons
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    List as ListIcon,
    Wifi as WifiIcon,
    Lock as LockIcon,
    Notifications as NotificationsIcon,
    Memory as MemoryIcon,
    AutoFixHigh as AutoFixHighIcon,
    Check as CheckIcon,
    Info as InfoIcon,
    DeleteForever as DeleteForeverIcon
} from '@mui/icons-material';

import { I18n, DialogSelectID, type IobTheme } from '@iobroker/adapter-react-v5';
import type { Connection } from '@iobroker/socket-client';

// --- INTERFACES ---

interface SettingsProps {
    native: Record<string, any>;
    onChange: (attr: string, value: any) => void;
    socket: Connection;
    themeType: string;
    adapterName: string;
    instance: number;
    theme: IobTheme;
}

interface DeviceConfig {
    id: string;
    name: string;
    location: string;
    type: string;
    logDuplicates: boolean;
}

interface ScannedDevice extends DeviceConfig {
    selected?: boolean;
    _score?: number;
}

interface ScanFilters {
    motion: boolean;
    doors: boolean;
    lights: boolean;
    temperature: boolean;
    weather: boolean;
}

interface SettingsState {
    devices: DeviceConfig[];
    geminiApiKey: string;
    analysisInterval: number;
    minDaysForBaseline: number;
    aiPersona: string;
    livingContext: string;
    licenseKey: string;

    ltmStbWindowDays: number;
    ltmLtbWindowDays: number;
    ltmDriftCheckIntervalHours: number;

    // Notification Settings
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

    availableInstances: Record<string, string[]>;
    isTestingNotification: boolean;

    showSelectId: boolean;
    selectIdIndex: number;
    isTestingApi: boolean;

    // SPRINT 23: Wizard & Delete Dialog
    showWizard: boolean;
    wizardStep: number;
    scanFilters: ScanFilters;
    scannedDevices: ScannedDevice[];
    showDeleteConfirm: boolean;

    snackbarOpen: boolean;
    snackbarMessage: string;
    snackbarSeverity: AlertColor;
}

type NotificationEnabledKey = 'notifyTelegramEnabled' | 'notifyPushoverEnabled' | 'notifyEmailEnabled' | 'notifyWhatsappEnabled' | 'notifySignalEnabled';
type NotificationInstanceKey = 'notifyTelegramInstance' | 'notifyPushoverInstance' | 'notifyEmailInstance' | 'notifyWhatsappInstance' | 'notifySignalInstance';
type NotificationRecipientKey = 'notifyTelegramRecipient' | 'notifyPushoverRecipient' | 'notifyEmailRecipient' | 'notifyWhatsappRecipient' | 'notifySignalRecipient';


export default class Settings extends React.Component<SettingsProps, SettingsState> {
    constructor(props: SettingsProps) {
        super(props);
        const native = props.native;
        this.state = {
            devices: native.devices || [],
            geminiApiKey: native.geminiApiKey || '',
            analysisInterval: native.analysisInterval || 15,
            minDaysForBaseline: native.minDaysForBaseline || 7,
            aiPersona: native.aiPersona || 'generic',
            livingContext: native.livingContext || '',
            licenseKey: native.licenseKey || '',

            ltmStbWindowDays: native.ltmStbWindowDays || 14,
            ltmLtbWindowDays: native.ltmLtbWindowDays || 60,
            ltmDriftCheckIntervalHours: native.ltmDriftCheckIntervalHours || 24,

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

            availableInstances: {},
            isTestingNotification: false,

            showSelectId: false,
            selectIdIndex: -1,
            isTestingApi: false,

            // SPRINT 23 Defaults
            showWizard: false,
            wizardStep: 0,
            scanFilters: {
                motion: true,
                doors: true,
                lights: true,
                temperature: false,
                weather: false
            },
            scannedDevices: [],
            showDeleteConfirm: false,

            snackbarOpen: false,
            snackbarMessage: '',
            snackbarSeverity: 'info',
        };
    }

    componentDidMount() {
        this.fetchAvailableInstances();
    }

    fetchAvailableInstances() {
        const adapters = ['telegram', 'pushover', 'email', 'whatsapp-cmb', 'signal-cma'];
        const instances: Record<string, string[]> = {};
        const promises = adapters.map(adapter =>
            this.props.socket.getAdapterInstances(adapter)
                .then(objs => { instances[adapter] = objs.map(obj => obj._id.replace('system.adapter.', '')); })
                .catch(e => console.error(`Error fetching instances for ${adapter}:`, e))
        );
        Promise.all(promises).then(() => { this.setState({ availableInstances: instances }); });
    }

    updateNativeValue(attr: string, value: any) {
        if (attr === 'livingContext' && typeof value === 'string' && value.length > 1000) {
            value = value.substring(0, 1000);
        }
        this.setState({ [attr]: value } as Pick<SettingsState, keyof SettingsState>, () => { this.props.onChange(attr, value); });
    }

    updateDevices(newDevices: DeviceConfig[]) {
        this.setState({ devices: newDevices });
        this.props.onChange('devices', newDevices);
    }

    onAddDevice() {
        const devices = JSON.parse(JSON.stringify(this.state.devices));
        devices.push({ id: '', name: '', location: '', type: '', logDuplicates: false });
        this.updateDevices(devices);
    }

    onDeviceChange(index: number, attr: keyof DeviceConfig, value: any) {
        const devices = JSON.parse(JSON.stringify(this.state.devices));
        devices[index][attr] = value;
        this.updateDevices(devices);
    }

    onDeleteDevice(index: number) {
        const devices = JSON.parse(JSON.stringify(this.state.devices));
        devices.splice(index, 1);
        this.updateDevices(devices);
    }

    onDeleteAllDevices = () => {
        this.updateDevices([]);
        this.setState({ showDeleteConfirm: false });
        this.showSnackbar('Alle Sensoren gelöscht.', 'info');
    }

    openSelectIdDialog(index: number) { this.setState({ showSelectId: true, selectIdIndex: index }); }
    onSelectId(selectedId?: string) {
        const index = this.state.selectIdIndex;
        if (selectedId && index !== -1) {
            const devices = JSON.parse(JSON.stringify(this.state.devices));
            devices[index].id = selectedId;
            this.props.socket.getObject(selectedId).then(obj => {
                if (obj && obj.common && obj.common.name) {
                    let name: any = obj.common.name;
                    if (typeof name === 'object') name = name[I18n.getLanguage()] || name.en || name.de || JSON.stringify(name);
                    devices[index].name = name as string;
                    this.updateDevices(devices);
                } else { this.updateDevices(devices); }
            }).catch(e => { console.error(e); this.updateDevices(devices); });
        }
        this.setState({ showSelectId: false, selectIdIndex: -1 });
    }
    renderSelectIdDialog() {
        if (!this.state.showSelectId) return null;
        const currentId = this.state.devices[this.state.selectIdIndex]?.id || '';
        return (<DialogSelectID theme={this.props.theme} imagePrefix="../.." dialogName="selectID" themeType={this.props.themeType} socket={this.props.socket} selected={currentId} onClose={() => this.setState({ showSelectId: false })} onOk={selected => this.onSelectId(selected as string)} />);
    }

    // === SPRINT 23: Smart Auto-Discovery Wizard ===

    handleOpenWizard = () => {
        this.setState({ showWizard: true, wizardStep: 0, scannedDevices: [] });
    }

    handleFilterChange = (key: keyof ScanFilters) => {
        this.setState(prevState => ({
            scanFilters: { ...prevState.scanFilters, [key]: !prevState.scanFilters[key] }
        }));
    }

    handleStartScan = () => {
        this.setState({ wizardStep: 1 }); // Loading
        this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'scanDevices', this.state.scanFilters)
            .then((response: any) => {
                if(response && response.success && Array.isArray(response.devices)) {
                    if (response.devices.length === 0) {
                        this.showSnackbar('Keine Sensoren gefunden.', 'info');
                        this.setState({ wizardStep: 0 });
                    } else {
                        const devices = response.devices.map((d: any) => ({ ...d, selected: !!d.location }));
                        this.setState({ scannedDevices: devices, wizardStep: 2 });
                    }
                } else {
                    this.showSnackbar(`Scan fehlgeschlagen: ${response?.error}`, 'warning');
                    this.setState({ wizardStep: 0 });
                }
            })
            .catch(e => {
                this.showSnackbar(`Scan Error: ${e.message}`, 'error');
                this.setState({ wizardStep: 0 });
            });
    }

    handleToggleScannedDevice = (index: number) => {
        const devices = [...this.state.scannedDevices];
        devices[index].selected = !devices[index].selected;
        this.setState({ scannedDevices: devices });
    }

    handleImportDevices = () => {
        const selected = this.state.scannedDevices.filter(d => d.selected);
        if(selected.length === 0) { this.setState({ showWizard: false }); return; }
        const currentDevices = [...this.state.devices];
        let addedCount = 0;
        selected.forEach(newItem => {
            if(!currentDevices.find(d => d.id === newItem.id)) {
                const { selected, _score, ...deviceConfig } = newItem;
                currentDevices.push(deviceConfig);
                addedCount++;
            }
        });
        this.updateDevices(currentDevices);
        this.showSnackbar(`${addedCount} Sensoren importiert.`, 'success');
        this.setState({ showWizard: false });
    }

    renderWizardContent() {
        const { wizardStep, scanFilters, scannedDevices } = this.state;

        if (wizardStep === 0) {
            return (
                <Box sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Was soll gescannt werden?</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Wählen Sie nur die Kategorien, die Sie wirklich überwachen wollen.
                    </Typography>
                    <FormGroup>
                        <FormControlLabel control={<Checkbox checked={scanFilters.motion} onChange={() => this.handleFilterChange('motion')} />} label="Bewegungsmelder / Präsenz" />
                        <FormControlLabel control={<Checkbox checked={scanFilters.doors} onChange={() => this.handleFilterChange('doors')} />} label="Fenster & Türen" />
                        <FormControlLabel control={<Checkbox checked={scanFilters.lights} onChange={() => this.handleFilterChange('lights')} />} label="Lichter & Schalter" />
                        <Box sx={{ mt: 2, borderTop: '1px solid #eee', pt: 1 }}>
                            <Typography variant="caption" color="text.secondary">Optionale Daten:</Typography>
                            <FormControlLabel control={<Checkbox checked={scanFilters.temperature} onChange={() => this.handleFilterChange('temperature')} />} label="Temperatur / Klima" />
                            <FormControlLabel control={<Checkbox checked={scanFilters.weather} onChange={() => this.handleFilterChange('weather')} color="warning" />} label="Wetterdaten (Alle Adapter)" />
                        </Box>
                    </FormGroup>
                </Box>
            );
        }

        if (wizardStep === 1) {
            return (
                <Box sx={{ width: '100%', mt: 4, mb: 4, textAlign: 'center' }}>
                    <LinearProgress />
                    <Typography variant="h6" sx={{ mt: 2 }}>Suche Sensoren...</Typography>
                    <Typography variant="body2" color="text.secondary">Analysiere ioBroker-Struktur (Räume, Funktionen)...</Typography>
                </Box>
            );
        }

        if (wizardStep === 2) {
            const bestMatches = scannedDevices.filter(d => d.location);
            const otherMatches = scannedDevices.filter(d => !d.location);

            return (
                <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1, ml: 2 }}>
                        {scannedDevices.length} Sensoren gefunden.
                    </Typography>
                    <List dense sx={{ width: '100%', bgcolor: 'background.paper', maxHeight: 400, overflow: 'auto' }}>
                        {bestMatches.length > 0 && (
                            <ListSubheader sx={{ bgcolor: 'background.paper', color: 'primary.main', fontWeight: 'bold', borderBottom: 1, borderColor: 'divider' }}>🏠 Zugeordnet - {bestMatches.length}</ListSubheader>
                        )}
                        {bestMatches.map((device) => {
                            const originalIndex = scannedDevices.findIndex(d => d.id === device.id);
                            return (
                                <ListItem key={device.id} disablePadding divider>
                                    <ListItemButton role={undefined} onClick={() => this.handleToggleScannedDevice(originalIndex)} dense>
                                        <ListItemIcon><Checkbox edge="start" checked={device.selected} tabIndex={-1} disableRipple /></ListItemIcon>
                                        <ListItemText primary={device.name || device.id} secondary={`${device.type} • ${device.location}`} />
                                    </ListItemButton>
                                </ListItem>
                            );
                        })}
                        {otherMatches.length > 0 && (
                            <ListSubheader sx={{ bgcolor: 'background.paper', color: 'text.secondary', mt: 1, borderBottom: 1, borderColor: 'divider' }}>❓ Sonstige - {otherMatches.length}</ListSubheader>
                        )}
                        {otherMatches.map((device) => {
                            const originalIndex = scannedDevices.findIndex(d => d.id === device.id);
                            return (
                                <ListItem key={device.id} disablePadding divider>
                                    <ListItemButton role={undefined} onClick={() => this.handleToggleScannedDevice(originalIndex)} dense>
                                        <ListItemIcon><Checkbox edge="start" checked={device.selected} tabIndex={-1} disableRipple /></ListItemIcon>
                                        <ListItemText primary={device.name || device.id} secondary={`${device.type} • (Kein Raum)`} />
                                    </ListItemButton>
                                </ListItem>
                            );
                        })}
                    </List>
                </Box>
            );
        }
    }

    renderWizardDialog() {
        const { showWizard, wizardStep } = this.state;
        return (
            <Dialog open={showWizard} onClose={() => wizardStep !== 1 && this.setState({ showWizard: false })} maxWidth="md" fullWidth>
                <DialogTitle>
                    Auto-Discovery Wizard
                    {wizardStep !== 1 && <IconButton onClick={() => this.setState({ showWizard: false })} sx={{ position: 'absolute', right: 8, top: 8 }}>×</IconButton>}
                </DialogTitle>
                <DialogContent dividers>{this.renderWizardContent()}</DialogContent>
                <DialogActions>
                    {wizardStep === 0 && <Button variant="contained" onClick={this.handleStartScan} startIcon={<AutoFixHighIcon />}>Scan Starten</Button>}
                    {wizardStep === 2 && (
                        <>
                            <Button onClick={() => this.setState({ wizardStep: 0 })}>Zurück zu Filtern</Button>
                            <Button variant="contained" onClick={this.handleImportDevices} color="primary">
                                {this.state.scannedDevices.filter(d => d.selected).length} Importieren
                            </Button>
                        </>
                    )}
                </DialogActions>
            </Dialog>
        );
    }

    renderDeleteConfirmDialog() {
        return (
            <Dialog open={this.state.showDeleteConfirm} onClose={() => this.setState({ showDeleteConfirm: false })}>
                <DialogTitle>Alle Sensoren löschen?</DialogTitle>
                <DialogContent>
                    <Typography>Sind Sie sicher? Dies entfernt alle {this.state.devices.length} konfigurierten Sensoren aus der Liste. Diese Aktion kann nicht rückgängig gemacht werden.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => this.setState({ showDeleteConfirm: false })}>Abbrechen</Button>
                    <Button onClick={this.onDeleteAllDevices} color="error" variant="contained" startIcon={<DeleteForeverIcon />}>Alles Löschen</Button>
                </DialogActions>
            </Dialog>
        );
    }

    handleTestApiClick() {
        if (!this.state.geminiApiKey) return this.showSnackbar(I18n.t('msg_api_key_empty'), 'warning');
        this.setState({ isTestingApi: true });
        this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'testApiKey', { apiKey: this.state.geminiApiKey }).then((res: any) => { this.setState({ isTestingApi: false }); this.showSnackbar(res?.success ? res.message : `${I18n.t('msg_connection_failed')}: ${res?.message}`, res?.success ? 'success' : 'error'); });
    }
    handleTestNotificationClick() {
        this.setState({ isTestingNotification: true });
        this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'testNotification', {}).then((res: any) => { this.setState({ isTestingNotification: false }); this.showSnackbar(res?.success ? res.message : `${I18n.t('msg_notification_failed')}: ${res?.message}`, res?.success ? 'success' : 'warning'); });
    }
    showSnackbar(message: string, severity: AlertColor) { this.setState({ snackbarOpen: true, snackbarMessage: message, snackbarSeverity: severity }); }
    handleSnackbarClose = (event?: React.SyntheticEvent | Event, reason?: string) => { if (reason === 'clickaway') return; this.setState({ snackbarOpen: false }); };

    renderNotificationSetting(adapterName: string, enabledAttr: NotificationEnabledKey, instanceAttr: NotificationInstanceKey, recipientAttr: NotificationRecipientKey, recipientLabel: string) {
        const enabled = this.state[enabledAttr]; const instance = this.state[instanceAttr]; const recipient = this.state[recipientAttr];
        let adapterKey = adapterName === 'whatsapp' ? 'whatsapp-cmb' : adapterName === 'signal' ? 'signal-cma' : adapterName;
        const instances = this.state.availableInstances[adapterKey] || [];
        return (
            <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Grid item xs={12} sm={3}><FormControlLabel control={<Checkbox checked={enabled} onChange={e => this.updateNativeValue(enabledAttr, e.target.checked)} />} label={I18n.t(`notify_${adapterName}`)} /></Grid>
                <Grid item xs={12} sm={4}><FormControl fullWidth size="small" disabled={!enabled}><InputLabel>{I18n.t('notify_instance')}</InputLabel><Select value={instance} label={I18n.t('notify_instance')} onChange={(e: any) => this.updateNativeValue(instanceAttr, e.target.value)}>{instances.length === 0 ? <MenuItem value="">{I18n.t('notify_no_instances')}</MenuItem> : instances.map(id => <MenuItem key={id} value={id}>{id}</MenuItem>)}</Select></FormControl></Grid>
                <Grid item xs={12} sm={5}><TextField fullWidth size="small" label={recipientLabel} value={recipient} onChange={e => this.updateNativeValue(recipientAttr, e.target.value)} disabled={!enabled} required={adapterName === 'email' && enabled} /></Grid>
            </Grid>
        );
    }

    render() {
        const { devices, geminiApiKey, analysisInterval, minDaysForBaseline, ltmStbWindowDays, ltmLtbWindowDays, ltmDriftCheckIntervalHours, aiPersona, livingContext, licenseKey, isTestingApi, isTestingNotification } = this.state;
        const sxConfigSection = { mb: 4, p: 2, border: `1px solid ${this.props.theme.palette.divider}`, borderRadius: 1, backgroundColor: this.props.theme.palette.background.paper };

        return (
            <Box sx={{ p: 3 }}>
                {this.renderSelectIdDialog()}
                {this.renderWizardDialog()}
                {this.renderDeleteConfirmDialog()}
                <Snackbar open={this.state.snackbarOpen} autoHideDuration={8000} onClose={this.handleSnackbarClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}><Alert onClose={this.handleSnackbarClose} severity={this.state.snackbarSeverity} sx={{ width: '100%' }}>{this.state.snackbarMessage}</Alert></Snackbar>

                <Box component="form" sx={{ width: '100%' }}>

                    {/* ... (Notifications, Lizenz, KI, LTM, Kontext - alles gleich) ... */}
                    <Typography variant="h6" gutterBottom><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><NotificationsIcon />{I18n.t('headline_notifications')}</Box></Typography>
                    <Box sx={sxConfigSection}>
                        <Typography variant="body2" gutterBottom sx={{mb: 3}}>{I18n.t('notifications_helper')}</Typography>
                        {this.renderNotificationSetting('telegram', 'notifyTelegramEnabled', 'notifyTelegramInstance', 'notifyTelegramRecipient', I18n.t('notify_telegram_recipient'))}
                        {this.renderNotificationSetting('pushover', 'notifyPushoverEnabled', 'notifyPushoverInstance', 'notifyPushoverRecipient', I18n.t('notify_pushover_recipient'))}
                        {this.renderNotificationSetting('email', 'notifyEmailEnabled', 'notifyEmailInstance', 'notifyEmailRecipient', I18n.t('notify_email_recipient'))}
                        {this.renderNotificationSetting('whatsapp', 'notifyWhatsappEnabled', 'notifyWhatsappInstance', 'notifyWhatsappRecipient', I18n.t('notify_phone_recipient'))}
                        {this.renderNotificationSetting('signal', 'notifySignalEnabled', 'notifySignalInstance', 'notifySignalRecipient', I18n.t('notify_phone_recipient'))}
                        <Button variant="outlined" color="primary" sx={{ mt: 2 }} onClick={() => this.handleTestNotificationClick()} disabled={isTestingNotification} startIcon={isTestingNotification ? <CircularProgress size={20} /> : <NotificationsIcon />}>{I18n.t('btn_test_notification')}</Button>
                    </Box>

                    <Typography variant="h6" gutterBottom><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><LockIcon />{I18n.t('headline_licensing')}</Box></Typography>
                    <Box sx={sxConfigSection}>
                        <FormControl fullWidth margin="normal"><Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}><TextField sx={{ flexGrow: 1, maxWidth: '600px' }} label={I18n.t('license_key')} value={licenseKey} type="password" onChange={e => this.updateNativeValue('licenseKey', e.target.value)} helperText={I18n.t('license_key_helper')} variant="outlined" size="small" /></Box></FormControl>
                    </Box>

                    <Typography variant="h6" gutterBottom><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><WifiIcon />{I18n.t('headline_ai_settings')}</Box></Typography>
                    <Box sx={sxConfigSection}>
                        <FormControl fullWidth margin="normal"><Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}><TextField sx={{ flexGrow: 1, maxWidth: '600px' }} label={I18n.t('gemini_api_key')} value={geminiApiKey} type="password" onChange={e => this.updateNativeValue('geminiApiKey', e.target.value)} disabled={isTestingApi} variant="outlined" size="small" /><Button variant="outlined" color="primary" sx={{ minWidth: '150px' }} onClick={() => this.handleTestApiClick()} disabled={isTestingApi || !geminiApiKey} startIcon={isTestingApi ? <CircularProgress size={20} /> : <WifiIcon />}>{I18n.t('btn_test_connection')}</Button></Box></FormControl>
                        <FormControl margin="normal"><TextField sx={{ width: '250px', mr: 2 }} label={I18n.t('analysis_interval')} value={analysisInterval} type="number" inputProps={{ min: 1 }} onChange={e => this.updateNativeValue('analysisInterval', parseInt(e.target.value, 10) || 1)} variant="outlined" size="small" /></FormControl>
                    </Box>

                    <Typography variant="h6" gutterBottom><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><MemoryIcon />{I18n.t('headline_ltm_settings')}</Box></Typography>
                    <Box sx={sxConfigSection}>
                        <Grid container spacing={3} sx={{pt: 1}}>
                            <Grid item xs={12} md={6} lg={3}><TextField fullWidth label={I18n.t('min_days_for_baseline')} value={minDaysForBaseline} type="number" inputProps={{ min: 1, max: 30 }} onChange={e => this.updateNativeValue('minDaysForBaseline', parseInt(e.target.value, 10) || 7)} helperText={I18n.t('min_days_for_baseline_helper')} variant="outlined" size="small" /></Grid>
                            <Grid item xs={12} md={6} lg={3}><TextField fullWidth label={I18n.t('ltm_stb_window_days')} value={ltmStbWindowDays} type="number" inputProps={{ min: 1, max: 30 }} onChange={e => this.updateNativeValue('ltmStbWindowDays', parseInt(e.target.value, 10) || 14)} helperText={I18n.t('ltm_stb_window_days_helper')} variant="outlined" size="small" /></Grid>
                            <Grid item xs={12} md={6} lg={3}><TextField fullWidth label={I18n.t('ltm_ltb_window_days')} value={ltmLtbWindowDays} type="number" inputProps={{ min: 30, max: 180 }} onChange={e => this.updateNativeValue('ltmLtbWindowDays', parseInt(e.target.value, 10) || 60)} helperText={I18n.t('ltm_ltb_window_days_helper')} variant="outlined" size="small" /></Grid>
                            <Grid item xs={12} md={6} lg={3}><TextField fullWidth label={I18n.t('ltm_drift_check_interval_hours')} value={ltmDriftCheckIntervalHours} type="number" inputProps={{ min: 1, max: 168 }} onChange={e => this.updateNativeValue('ltmDriftCheckIntervalHours', parseInt(e.target.value, 10) || 24)} helperText={I18n.t('ltm_drift_check_interval_hours_helper')} variant="outlined" size="small" /></Grid>
                        </Grid>
                    </Box>

                    <Typography variant="h6" gutterBottom><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><ListIcon />{I18n.t('headline_living_context')}</Box></Typography>
                    <Box sx={sxConfigSection}>
                        <FormControl margin="normal" sx={{ minWidth: '350px' }} size="small" variant="outlined"><InputLabel id="persona-label">{I18n.t('ai_persona')}</InputLabel><Select labelId="persona-label" label={I18n.t('ai_persona')} value={aiPersona} onChange={e => this.updateNativeValue('aiPersona', e.target.value)}><MenuItem value="generic">{I18n.t('persona_generic')}</MenuItem><MenuItem value="senior_aal">{I18n.t('persona_senior_aal')}</MenuItem><MenuItem value="family">{I18n.t('persona_family')}</MenuItem><MenuItem value="single_comfort">{I18n.t('persona_single_comfort')}</MenuItem><MenuItem value="security">{I18n.t('persona_security')}</MenuItem></Select></FormControl>
                        <FormControl fullWidth margin="normal">
                            <TextField
                                sx={{ maxWidth: '800px' }}
                                label={I18n.t('living_context_details')}
                                multiline
                                rows={6}
                                value={livingContext}
                                onChange={e => this.updateNativeValue('livingContext', e.target.value)}
                                helperText={<span>{`${I18n.t('living_context_helper')} (${livingContext.length}/1000)`}<br/><span style={{fontStyle: 'italic', color: '#ffa726'}}>Hinweis: Änderungen am Kontext werden nur für zukünftige Analysen wirksam (ab dem nächsten Daily Digest).</span></span>}
                                inputProps={{ maxLength: 1000 }}
                                variant="outlined"
                            />
                        </FormControl>
                    </Box>

                    <Typography variant="h6" gutterBottom>{I18n.t('headline_sensor_config')}</Typography>
                    <TableContainer component={Paper}>
                        <Table size="small">
                            <TableHead><TableRow><TableCell>{I18n.t('table_sensor_id')}</TableCell><TableCell>{I18n.t('table_name')}</TableCell><TableCell>{I18n.t('table_location')}</TableCell><TableCell>{I18n.t('table_type')}</TableCell><TableCell sx={{ width: '150px' }}>{I18n.t('table_log_duplicates')}</TableCell><TableCell sx={{ width: '50px' }}>{I18n.t('table_delete')}</TableCell></TableRow></TableHead>
                            <TableBody>{devices.map((device, index) => (<TableRow key={index}><TableCell><Box sx={{ display: 'flex', alignItems: 'center' }}><TextField sx={{ width: '100%', minWidth: '150px' }} value={device.id} onChange={e => this.onDeviceChange(index, 'id', e.target.value)} placeholder="hm-rpc.0..." variant="standard" /><IconButton size="small" onClick={() => this.openSelectIdDialog(index)} title="Select ID"><ListIcon /></IconButton></Box></TableCell><TableCell><TextField sx={{ width: '100%', minWidth: '150px' }} value={device.name || ''} onChange={e => this.onDeviceChange(index, 'name', e.target.value)} placeholder={I18n.t('Wird automatisch gefüllt') as string} variant="standard" /></TableCell><TableCell><TextField sx={{ width: '100%', minWidth: '150px' }} value={device.location} onChange={e => this.onDeviceChange(index, 'location', e.target.value)} placeholder={I18n.t('z.B. Bad') as string} variant="standard" /></TableCell><TableCell><TextField sx={{ width: '100%', minWidth: '150px' }} value={device.type} onChange={e => this.onDeviceChange(index, 'type', e.target.value)} placeholder={I18n.t('z.B. Bewegung') as string} variant="standard" /></TableCell><TableCell align="center"><Tooltip title={I18n.t('table_log_duplicates_tooltip') || ''}><Checkbox checked={device.logDuplicates || false} onChange={e => this.onDeviceChange(index, 'logDuplicates', e.target.checked)} /></Tooltip></TableCell><TableCell><IconButton size="small" onClick={() => this.onDeleteDevice(index)}><DeleteIcon /></IconButton></TableCell></TableRow>))}</TableBody>
                        </Table>
                    </TableContainer>

                    <Box sx={{ mt: 3, mb: 3, display: 'flex', gap: 2, justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => this.onAddDevice()}>{I18n.t('btn_add_sensor')}</Button>
                            <Button variant="outlined" color="secondary" startIcon={<AutoFixHighIcon />} onClick={this.handleOpenWizard}>Auto-Scan (Wizard)</Button>
                        </Box>

                        {/* NEUER BUTTON: Alle Löschen */}
                        {devices.length > 0 && (
                            <Button variant="text" color="error" startIcon={<DeleteForeverIcon />} onClick={() => this.setState({ showDeleteConfirm: true })}>
                                Alle Löschen
                            </Button>
                        )}
                    </Box>
                </Box>
            </Box>
        );
    }
}