import React from 'react';
import { Box, AppBar, Tabs, Tab, ThemeProvider, createTheme, IconButton, Tooltip, CircularProgress } from '@mui/material';
import { GenericApp, I18n, type IobTheme, type GenericAppState, type ThemeType } from '@iobroker/adapter-react-v5';

import Settings from './components/Settings';
import Overview from './components/Overview';
import Activities from './components/Activities';

import DashboardIcon from '@mui/icons-material/Dashboard';
import ListAltIcon from '@mui/icons-material/ListAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import SaveIcon from '@mui/icons-material/Save'; // NEU: Icon für Speichern

interface AppState extends GenericAppState {
    selectedTab: string;
    themeType: ThemeType;
    theme: IobTheme;
    hasChanges: boolean; // NEU: Wir tracken Änderungen selbst für die Optik
}

class App extends GenericApp<any, AppState> {
    constructor(props: any) {
        const extendedProps = { ...props };
        super(props, extendedProps);
        this.state = { ...this.state, selectedTab: 'overview', hasChanges: false };
    }

    // Wrapper um Native Value Update, um Button zu aktivieren
    updateNativeValue(attr: string, value: any) {
        this.setState({ hasChanges: true });
        super.updateNativeValue(attr, value);
    }

    // Manuelles Speichern auslösen
    handleSave = () => {
        this.onSave(true); // Ruft die interne Speichern-Routine von GenericApp auf
        this.setState({ hasChanges: false });
    };

    render() {
        if (!this.state.loaded) {
            return <CircularProgress />;
        }

        const { themeType, native } = this.state;
        const isDark = themeType === 'dark';

        const cogniTheme = createTheme({
            palette: {
                mode: isDark ? 'dark' : 'light',
                primary: { main: isDark ? '#90caf9' : '#1976d2' },
                background: {
                    default: isDark ? '#121212' : '#f5f5f5',
                    paper: isDark ? '#1e1e1e' : '#ffffff',
                },
                text: {
                    primary: isDark ? '#ffffff' : '#000000',
                    secondary: isDark ? '#b0b0b0' : '#666666',
                }
            },
            components: {
                MuiAppBar: { styleOverrides: { root: { backgroundColor: isDark ? '#272727' : '#1976d2', color: '#ffffff' } } },
                MuiTab: {
                    styleOverrides: {
                        root: {
                            textTransform: 'none', fontWeight: 'bold',
                            borderRight: '1px solid rgba(255,255,255,0.1)',
                            '&:last-child': { borderRight: 'none' },
                            '&.Mui-selected': { backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }
                        }
                    }
                }
            }
        });

        return (
            <ThemeProvider theme={cogniTheme}>
                <div className="App" style={{
                    background: cogniTheme.palette.background.default,
                    color: cogniTheme.palette.text.primary,
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <AppBar position="sticky" elevation={2}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pr: 2 }}>

                            {/* TABS */}
                            <Tabs
                                value={this.state.selectedTab}
                                onChange={(_e, newVal) => this.setState({ selectedTab: newVal })}
                                indicatorColor="secondary"
                                textColor="inherit"
                                sx={{ flexGrow: 1 }}
                            >
                                <Tab value="overview" label={I18n.t('Übersicht')} icon={<DashboardIcon />} iconPosition="start" />
                                <Tab value="activities" label={I18n.t('Aktivitäten')} icon={<ListAltIcon />} iconPosition="start" />
                                <Tab value="settings" label={I18n.t('Einstellungen')} icon={<SettingsIcon />} iconPosition="start" />
                            </Tabs>

                            {/* NOTFALL-SPEICHERN BUTTON (Rechts oben) */}
                            <Tooltip title={this.state.hasChanges ? "Änderungen speichern" : "Keine Änderungen"}>
                                <span> {/* Span wird benötigt, damit Tooltip bei disabled Button geht */}
                                    <IconButton
                                        color="inherit"
                                        onClick={this.handleSave}
                                        disabled={!this.state.hasChanges}
                                        sx={{
                                            border: '1px solid rgba(255,255,255,0.3)',
                                            bgcolor: this.state.hasChanges ? 'rgba(76, 175, 80, 0.8)' : 'transparent',
                                            '&:hover': { bgcolor: 'rgba(76, 175, 80, 1)' }
                                        }}
                                    >
                                        <SaveIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Box>
                    </AppBar>

                    <Box sx={{ p: 0, pb: 12, flexGrow: 1, overflowY: 'auto' }}>
                        {this.state.selectedTab === 'overview' && (
                            <Overview socket={this.socket} adapterName={this.adapterName} instance={this.instance} theme={this.state.theme} themeType={themeType} />
                        )}
                        {this.state.selectedTab === 'activities' && (
                            <Activities socket={this.socket} adapterName={this.adapterName} instance={this.instance} theme={this.state.theme} themeType={themeType} />
                        )}
                        {this.state.selectedTab === 'settings' && (
                            <Settings native={native} onChange={(attr: string, value: any) => this.updateNativeValue(attr, value)} socket={this.socket} themeType={themeType} theme={this.state.theme} adapterName={this.adapterName} instance={this.instance} />
                        )}
                    </Box>

                    {this.renderError()}
                    {this.renderToast()}
                </div>
            </ThemeProvider>
        );
    }
}

export default App;