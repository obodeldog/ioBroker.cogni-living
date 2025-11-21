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
} from '@mui/material';
import type { AlertColor } from '@mui/material';

// MUI v5 Icons
// SPRINT 20: MemoryIcon für LTM hinzugefügt
import { Add as AddIcon, Delete as DeleteIcon, List as ListIcon, Wifi as WifiIcon, Lock as LockIcon, Notifications as NotificationsIcon, Memory as MemoryIcon } from '@mui/icons-material';
// ioBroker specific imports (v5)
import { I18n, DialogSelectID, type IobTheme } from '@iobroker/adapter-react-v5';
// Wichtig für TypeScript: Importiere Connection für den Socket-Typ
import type { Connection } from '@iobroker/socket-client';

// TypeScript Definitionen für Props und State
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

// SPRINT 20: State erweitert
interface SettingsState {
    devices: DeviceConfig[];
    geminiApiKey: string;
    analysisInterval: number;
    minDaysForBaseline: number;
    aiPersona: string;
    livingContext: string;
    licenseKey: string;

    // SPRINT 20: LTM Dual Baseline Settings
    ltmStbWindowDays: number;
    ltmLtbWindowDays: number;
    ltmDriftCheckIntervalHours: number;

    // SPRINT 19: Notification Settings
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
    snackbarOpen: boolean;
    snackbarMessage: string;
    snackbarSeverity: AlertColor;
}

// SPRINT 19 FIX: Spezifische Typen für Notification Keys
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

            // SPRINT 20: Lade LTM Dual Baseline Settings
            ltmStbWindowDays: native.ltmStbWindowDays || 14,
            ltmLtbWindowDays: native.ltmLtbWindowDays || 60,
            ltmDriftCheckIntervalHours: native.ltmDriftCheckIntervalHours || 24,

            // SPRINT 19: Lade Notification Settings
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
                .then(objs => {
                    instances[adapter] = objs.map(obj => obj._id.replace('system.adapter.', ''));
                })
                .catch(e => console.error(`Error fetching instances for ${adapter}:`, e))
        );

        Promise.all(promises).then(() => {
            this.setState({ availableInstances: instances });
        });
    }


    // (Helper functions)
    updateNativeValue(attr: string, value: any) {
        if (attr === 'livingContext' && typeof value === 'string' && value.length > 200) {
            value = value.substring(0, 200);
        }
        // Verwende 'as Pick<...>' für bessere Typ-Assertion bei dynamischen Keys in setState
        this.setState({ [attr]: value } as Pick<SettingsState, keyof SettingsState>, () => {
            this.props.onChange(attr, value);
        });
    }

    updateDevices(newDevices: DeviceConfig[]) {
        this.setState({ devices: newDevices });
        this.props.onChange('devices', newDevices);
    }

    onAddDevice() {
        const devices = JSON.parse(JSON.stringify(this.state.devices));
        devices.push({
            id: '',
            name: '',
            location: '',
            type: '',
            logDuplicates: false,
        });
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

    openSelectIdDialog(index: number) {
        this.setState({ showSelectId: true, selectIdIndex: index });
    }

    onSelectId(selectedId?: string) {
        const index = this.state.selectIdIndex;
        if (selectedId && index !== -1) {
            const devices = JSON.parse(JSON.stringify(this.state.devices));
            devices[index].id = selectedId;
            this.props.socket
                .getObject(selectedId)
                .then(obj => {
                    if (obj && obj.common && obj.common.name) {
                        let name: any = obj.common.name;
                        if (typeof name === 'object') {
                            // Handling mehrsprachiger Namen
                            name = name[I18n.getLanguage()] || name.en || name.de || JSON.stringify(name);
                        }
                        devices[index].name = name as string;
                        this.updateDevices(devices);
                    } else {
                        this.updateDevices(devices);
                    }
                })
                .catch(e => {
                    console.error(e);
                    this.updateDevices(devices);
                });
        }
        this.setState({ showSelectId: false, selectIdIndex: -1 });
    }

    renderSelectIdDialog() {
        if (!this.state.showSelectId) {
            return null;
        }
        const currentId = this.state.devices[this.state.selectIdIndex]?.id || '';
        return (
            <DialogSelectID
                theme={this.props.theme}
                imagePrefix="../.."
                dialogName="selectID"
                themeType={this.props.themeType}
                socket={this.props.socket}
                selected={currentId}
                onClose={() => this.setState({ showSelectId: false })}
                // TypeScript benötigt hier 'as string'
                onOk={selected => this.onSelectId(selected as string)}
            />
        );
    }

    handleTestApiClick() {
        const apiKey = this.state.geminiApiKey;
        if (!apiKey) {
            this.showSnackbar(I18n.t('msg_api_key_empty'), 'warning');
            return;
        }

        this.setState({ isTestingApi: true });

        // Sende Nachricht an Backend
        this.props.socket
            .sendTo(`${this.props.adapterName}.${this.props.instance}`, 'testApiKey', { apiKey: apiKey })
            .then((response: any) => {
                this.setState({ isTestingApi: false });

                if (response && response.success) {
                    this.showSnackbar(response.message, 'success');
                } else {
                    const errorMessage = response ? response.message : 'Unknown error';
                    this.showSnackbar(`${I18n.t('msg_connection_failed')}: ${errorMessage}`, 'error');
                }
            });
    }

    // SPRINT 19: Handler für Test-Benachrichtigung
    handleTestNotificationClick() {
        this.setState({ isTestingNotification: true });

        // Sende Nachricht an Backend.
        this.props.socket
            .sendTo(`${this.props.adapterName}.${this.props.instance}`, 'testNotification', {})
            .then((response: any) => {
                this.setState({ isTestingNotification: false });

                if (response && response.success) {
                    this.showSnackbar(response.message, 'success');
                } else {
                    const errorMessage = response ? response.message : 'Unknown error';
                    // Nutze neue Übersetzung 'msg_notification_failed'
                    this.showSnackbar(`${I18n.t('msg_notification_failed')}: ${errorMessage}`, 'warning');
                }
            });
    }


    // (showSnackbar, handleSnackbarClose unverändert)
    showSnackbar(message: string, severity: AlertColor) {
        this.setState({
            snackbarOpen: true,
            snackbarMessage: message,
            snackbarSeverity: severity,
        });
    }

    handleSnackbarClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        this.setState({ snackbarOpen: false });
    };

    // SPRINT 19: Helper für das Rendern von Notification-Einstellungen (Fixed)
    renderNotificationSetting(
        adapterName: string,
        enabledAttr: NotificationEnabledKey,
        instanceAttr: NotificationInstanceKey,
        recipientAttr: NotificationRecipientKey,
        recipientLabel: string
    ) {
        // Der Zugriff ist nun typsicher dank der definierten Keys
        const enabled = this.state[enabledAttr];
        const instance = this.state[instanceAttr];
        const recipient = this.state[recipientAttr];

        // Finde die korrekten Instanzen im State
        let adapterKey = adapterName;
        if (adapterName === 'whatsapp') adapterKey = 'whatsapp-cmb';
        if (adapterName === 'signal') adapterKey = 'signal-cma';

        const instances = this.state.availableInstances[adapterKey] || [];

        return (
            <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Grid item xs={12} sm={3}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={enabled}
                                // Kein Cast mehr notwendig
                                onChange={e => this.updateNativeValue(enabledAttr, e.target.checked)}
                            />
                        }
                        label={I18n.t(`notify_${adapterName}`)}
                    />
                </Grid>
                <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small" disabled={!enabled}>
                        <InputLabel>{I18n.t('notify_instance')}</InputLabel>
                        <Select
                            value={instance}
                            label={I18n.t('notify_instance')}
                            // Kein Cast mehr notwendig
                            onChange={e => this.updateNativeValue(instanceAttr, e.target.value)}
                        >
                            {instances.length === 0 ? (
                                <MenuItem value="">{I18n.t('notify_no_instances')}</MenuItem>
                            ) : (
                                instances.map(id => (
                                    <MenuItem key={id} value={id}>{id}</MenuItem>
                                ))
                            )}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} sm={5}>
                    <TextField
                        fullWidth
                        size="small"
                        label={recipientLabel}
                        value={recipient}
                        // Kein Cast mehr notwendig
                        onChange={e => this.updateNativeValue(recipientAttr, e.target.value)}
                        disabled={!enabled}
                        // E-Mail-Empfänger ist Pflicht, wenn E-Mail aktiviert ist
                        required={adapterName === 'email' && enabled}
                    />
                </Grid>
            </Grid>
        );
    }


    render() {
        // SPRINT 20: Neue LTM States hinzugefügt
        const {
            devices, geminiApiKey, analysisInterval, minDaysForBaseline,
            ltmStbWindowDays, ltmLtbWindowDays, ltmDriftCheckIntervalHours,
            aiPersona, livingContext, licenseKey, isTestingApi, isTestingNotification
        } = this.state;

        // Definiere Styles mittels 'sx' Prop (MUI v5)
        const sxConfigSection = {
            mb: 4, // Margin Bottom
            p: 2, // Padding
            // Nutze Theme-Variablen für Konsistenz
            border: `1px solid ${this.props.theme.palette.divider}`,
            borderRadius: 1,
            // Hintergrundfarbe setzen, um Lesbarkeit im Dark/Light Mode sicherzustellen
            backgroundColor: this.props.theme.palette.background.paper,
        };

        return (
            <>
                {this.renderSelectIdDialog()}

                {/* Snackbar für Feedback (MUI v5 Alert) */}
                <Snackbar
                    open={this.state.snackbarOpen}
                    autoHideDuration={8000}
                    onClose={this.handleSnackbarClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert
                        onClose={this.handleSnackbarClose}
                        severity={this.state.snackbarSeverity}
                        sx={{ width: '100%' }}
                    >
                        {this.state.snackbarMessage}
                    </Alert>
                </Snackbar>

                {/* Verwende Box als Formular-Container */}
                <Box
                    component="form"
                    sx={{ width: '100%' }}
                >

                    {/* === SPRINT 19 NEU: Sektion Notifications === */}
                    <Typography variant="h6" gutterBottom>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <NotificationsIcon />
                            {I18n.t('headline_notifications')}
                        </Box>
                    </Typography>
                    <Box sx={sxConfigSection}>
                        <Typography variant="body2" gutterBottom sx={{mb: 3}}>
                            {I18n.t('notifications_helper')}
                        </Typography>

                        {/* Die Aufrufe sind nun typsicher */}
                        {this.renderNotificationSetting('telegram', 'notifyTelegramEnabled', 'notifyTelegramInstance', 'notifyTelegramRecipient', I18n.t('notify_telegram_recipient'))}
                        {this.renderNotificationSetting('pushover', 'notifyPushoverEnabled', 'notifyPushoverInstance', 'notifyPushoverRecipient', I18n.t('notify_pushover_recipient'))}
                        {this.renderNotificationSetting('email', 'notifyEmailEnabled', 'notifyEmailInstance', 'notifyEmailRecipient', I18n.t('notify_email_recipient'))}
                        {this.renderNotificationSetting('whatsapp', 'notifyWhatsappEnabled', 'notifyWhatsappInstance', 'notifyWhatsappRecipient', I18n.t('notify_phone_recipient'))}
                        {this.renderNotificationSetting('signal', 'notifySignalEnabled', 'notifySignalInstance', 'notifySignalRecipient', I18n.t('notify_phone_recipient'))}

                        <Button
                            variant="outlined"
                            color="primary"
                            sx={{ mt: 2 }}
                            onClick={() => this.handleTestNotificationClick()}
                            disabled={isTestingNotification}
                            startIcon={isTestingNotification ? <CircularProgress size={20} /> : <NotificationsIcon />}
                        >
                            {I18n.t('btn_test_notification')}
                        </Button>
                    </Box>


                    {/* === SPRINT 18 NEU: Sektion 0: Lizenzierung === */}
                    <Typography
                        variant="h6"
                        gutterBottom
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LockIcon />
                            {I18n.t('headline_licensing')}
                        </Box>
                    </Typography>
                    <Box sx={sxConfigSection}>
                        <FormControl
                            fullWidth
                            margin="normal"
                        >
                            {/* Flexbox für Icon und Input */}
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                <TextField
                                    sx={{ flexGrow: 1, maxWidth: '600px' }}
                                    label={I18n.t('license_key')}
                                    value={licenseKey}
                                    type="password"
                                    onChange={e => this.updateNativeValue('licenseKey', e.target.value)}
                                    helperText={I18n.t('license_key_helper')}
                                    variant="outlined"
                                    size="small"
                                />
                            </Box>
                        </FormControl>
                    </Box>


                    {/* === Sektion 1: KI-Einstellungen & Autopilot === */}
                    <Typography
                        variant="h6"
                        gutterBottom
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <WifiIcon />
                            {I18n.t('headline_ai_settings')}
                        </Box>
                    </Typography>
                    <Box sx={sxConfigSection}>
                        <FormControl
                            fullWidth
                            margin="normal"
                        >
                            {/* Flexbox für Key Input und Button */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <TextField
                                    sx={{ flexGrow: 1, maxWidth: '600px' }}
                                    label={I18n.t('gemini_api_key')}
                                    value={geminiApiKey}
                                    type="password"
                                    onChange={e => this.updateNativeValue('geminiApiKey', e.target.value)}
                                    disabled={isTestingApi}
                                    variant="outlined"
                                    size="small"
                                />
                                <Button
                                    variant="outlined"
                                    color="primary"
                                    sx={{ minWidth: '150px' }}
                                    onClick={() => this.handleTestApiClick()}
                                    disabled={isTestingApi || !geminiApiKey}
                                    startIcon={isTestingApi ? <CircularProgress size={20} /> : <WifiIcon />}
                                >
                                    {I18n.t('btn_test_connection')}
                                </Button>
                            </Box>
                        </FormControl>

                        <FormControl margin="normal">
                            <TextField
                                sx={{ width: '250px', mr: 2 }}
                                label={I18n.t('analysis_interval')}
                                value={analysisInterval}
                                type="number"
                                inputProps={{ min: 1 }}
                                onChange={e =>
                                    this.updateNativeValue('analysisInterval', parseInt(e.target.value, 10) || 1)
                                }
                                variant="outlined"
                                size="small"
                            />
                        </FormControl>
                    </Box>

                    {/* === SPRINT 20: Sektion 2: LTM Einstellungen (Erweitert) === */}
                    <Typography
                        variant="h6"
                        gutterBottom
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <MemoryIcon />
                            {I18n.t('headline_ltm_settings')}
                        </Box>
                    </Typography>
                    <Box sx={sxConfigSection}>
                        {/* Grid Layout für bessere Anordnung der LTM Settings */}
                        <Grid container spacing={3} sx={{pt: 1}}>
                            <Grid item xs={12} md={6} lg={3}>
                                <TextField
                                    fullWidth
                                    label={I18n.t('min_days_for_baseline')}
                                    value={minDaysForBaseline}
                                    type="number"
                                    inputProps={{ min: 1, max: 30 }}
                                    onChange={e =>
                                        this.updateNativeValue('minDaysForBaseline', parseInt(e.target.value, 10) || 7)
                                    }
                                    helperText={I18n.t('min_days_for_baseline_helper')}
                                    variant="outlined"
                                    size="small"
                                />
                            </Grid>
                            <Grid item xs={12} md={6} lg={3}>
                                <TextField
                                    fullWidth
                                    label={I18n.t('ltm_stb_window_days')}
                                    value={ltmStbWindowDays}
                                    type="number"
                                    inputProps={{ min: 1, max: 30 }}
                                    onChange={e =>
                                        this.updateNativeValue('ltmStbWindowDays', parseInt(e.target.value, 10) || 14)
                                    }
                                    helperText={I18n.t('ltm_stb_window_days_helper')}
                                    variant="outlined"
                                    size="small"
                                />
                            </Grid>
                            <Grid item xs={12} md={6} lg={3}>
                                <TextField
                                    fullWidth
                                    label={I18n.t('ltm_ltb_window_days')}
                                    value={ltmLtbWindowDays}
                                    type="number"
                                    inputProps={{ min: 30, max: 180 }}
                                    onChange={e =>
                                        this.updateNativeValue('ltmLtbWindowDays', parseInt(e.target.value, 10) || 60)
                                    }
                                    helperText={I18n.t('ltm_ltb_window_days_helper')}
                                    variant="outlined"
                                    size="small"
                                />
                            </Grid>
                            <Grid item xs={12} md={6} lg={3}>
                                <TextField
                                    fullWidth
                                    label={I18n.t('ltm_drift_check_interval_hours')}
                                    value={ltmDriftCheckIntervalHours}
                                    type="number"
                                    inputProps={{ min: 1, max: 168 }}
                                    onChange={e =>
                                        this.updateNativeValue('ltmDriftCheckIntervalHours', parseInt(e.target.value, 10) || 24)
                                    }
                                    helperText={I18n.t('ltm_drift_check_interval_hours_helper')}
                                    variant="outlined"
                                    size="small"
                                />
                            </Grid>
                        </Grid>
                    </Box>


                    {/* === Sektion 3: Wohnkontext & Persona === */}
                    <Typography
                        variant="h6"
                        gutterBottom
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ListIcon />
                            {I18n.t('headline_living_context')}
                        </Box>
                    </Typography>
                    <Box sx={sxConfigSection}>
                        {/* Select benötigt das Label doppelt (für InputLabel und Select) in MUI v5 */}
                        <FormControl
                            margin="normal"
                            sx={{ minWidth: '350px' }}
                            size="small"
                            variant="outlined"
                        >
                            <InputLabel id="persona-label">{I18n.t('ai_persona')}</InputLabel>
                            <Select
                                labelId="persona-label"
                                label={I18n.t('ai_persona')}
                                value={aiPersona}
                                onChange={e => this.updateNativeValue('aiPersona', e.target.value)}
                            >
                                <MenuItem value="generic">{I18n.t('persona_generic')}</MenuItem>
                                <MenuItem value="senior_aal">{I18n.t('persona_senior_aal')}</MenuItem>
                                <MenuItem value="family">{I18n.t('persona_family')}</MenuItem>
                                <MenuItem value="single_comfort">{I18n.t('persona_single_comfort')}</MenuItem>
                                <MenuItem value="security">{I18n.t('persona_security')}</MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl
                            fullWidth
                            margin="normal"
                        >
                            <TextField
                                sx={{ maxWidth: '800px' }}
                                label={I18n.t('living_context_details')}
                                multiline
                                rows={3}
                                value={livingContext}
                                onChange={e => this.updateNativeValue('livingContext', e.target.value)}
                                helperText={`${I18n.t('living_context_helper')} (${livingContext.length}/200)`}
                                inputProps={{ maxLength: 200 }}
                                variant="outlined"
                            />
                        </FormControl>
                    </Box>

                    {/* === Sektion 4: Sensor Konfiguration === */}
                    <Typography
                        variant="h6"
                        gutterBottom
                    >
                        {I18n.t('headline_sensor_config')}
                    </Typography>

                    {/* Verwende Paper für Tabellenhintergrund */}
                    <TableContainer component={Paper}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{I18n.t('table_sensor_id')}</TableCell>
                                    <TableCell>{I18n.t('table_name')}</TableCell>
                                    <TableCell>{I18n.t('table_location')}</TableCell>
                                    <TableCell>{I18n.t('table_type')}</TableCell>
                                    <TableCell sx={{ width: '150px' }}>{I18n.t('table_log_duplicates')}</TableCell>
                                    <TableCell sx={{ width: '50px' }}>{I18n.t('table_delete')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {devices.map((device, index) => (
                                    <TableRow key={index}>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                <TextField
                                                    sx={{ width: '100%', minWidth: '150px' }}
                                                    value={device.id}
                                                    onChange={e => this.onDeviceChange(index, 'id', e.target.value)}
                                                    placeholder="hm-rpc.0..."
                                                    variant="standard"
                                                />
                                                <IconButton
                                                    size="small"
                                                    onClick={() => this.openSelectIdDialog(index)}
                                                    title="Select ID"
                                                >
                                                    <ListIcon />
                                                </IconButton>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                sx={{ width: '100%', minWidth: '150px' }}
                                                value={device.name || ''}
                                                onChange={e => this.onDeviceChange(index, 'name', e.target.value)}
                                                // TypeScript benötigt 'as string' für Placeholder/Tooltip
                                                placeholder={I18n.t('Wird automatisch gefüllt') as string}
                                                variant="standard"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                sx={{ width: '100%', minWidth: '150px' }}
                                                value={device.location}
                                                onChange={e => this.onDeviceChange(index, 'location', e.target.value)}
                                                placeholder={I18n.t('z.B. Bad') as string}
                                                variant="standard"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                sx={{ width: '100%', minWidth: '150px' }}
                                                value={device.type}
                                                onChange={e => this.onDeviceChange(index, 'type', e.target.value)}
                                                placeholder={I18n.t('z.B. Bewegung') as string}
                                                variant="standard"
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Tooltip title={I18n.t('table_log_duplicates_tooltip') || ''}>
                                                <Checkbox
                                                    checked={device.logDuplicates || false}
                                                    onChange={e =>
                                                        this.onDeviceChange(index, 'logDuplicates', e.target.checked)
                                                    }
                                                />
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell>
                                            <IconButton
                                                size="small"
                                                onClick={() => this.onDeleteDevice(index)}
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddIcon />}
                        sx={{ mt: 3, mb: 3 }} // Margin Top & Bottom
                        onClick={() => this.onAddDevice()}
                    >
                        {I18n.t('btn_add_sensor')}
                    </Button>
                </Box>
            </>
        );
    }
}