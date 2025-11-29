import React from 'react';
import { Box, Typography, TextField, Checkbox, FormControlLabel, Button, Grid, Paper, Alert } from '@mui/material';
import { I18n, type IobTheme, type ThemeType } from '@iobroker/adapter-react-v5';
import type { Connection } from '@iobroker/socket-client';

interface SettingsProps { native: Record<string, any>; onChange: (attr: string, value: any) => void; socket: Connection; themeType: ThemeType; adapterName: string; instance: number; theme: IobTheme; }

export default class Settings extends React.Component<SettingsProps, any> {
    constructor(props: SettingsProps) {
        super(props);
        this.state = {};
    }

    render() {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="warning" sx={{mb: 2}}>Safe Mode: Icons & Dialoge deaktiviert zur Fehlerbehebung.</Alert>

                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Typography variant="h6" gutterBottom>Grundeinstellungen</Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Gemini API Key"
                                value={this.props.native.geminiApiKey || ''}
                                type="password"
                                onChange={e => this.props.onChange('geminiApiKey', e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Pro Lizenzschlüssel"
                                value={this.props.native.licenseKey || ''}
                                type="password"
                                onChange={e => this.props.onChange('licenseKey', e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Außensensor ID (Manuell eingeben)"
                                value={this.props.native.outdoorSensorId || ''}
                                onChange={e => this.props.onChange('outdoorSensorId', e.target.value)}
                                helperText="z.B. hm-rpc.0.KEQ12345.1.TEMPERATURE"
                            />
                        </Grid>
                    </Grid>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Schalter</Typography>
                    <FormControlLabel
                        control={<Checkbox checked={this.props.native.useWeather || false} onChange={e => this.props.onChange('useWeather', e.target.checked)} />}
                        label="Wetterdaten nutzen"
                    />
                    <FormControlLabel
                        control={<Checkbox checked={this.props.native.inactivityMonitoringEnabled || false} onChange={e => this.props.onChange('inactivityMonitoringEnabled', e.target.checked)} />}
                        label="Inaktivitäts-Monitor"
                    />
                </Paper>
            </Box>
        );
    }
}