import React from 'react';
import { Box, AppBar, Tabs, Tab, ThemeProvider, createTheme, IconButton, Tooltip, CircularProgress } from '@mui/material';
import { GenericApp, I18n, type IobTheme, type GenericAppState, type ThemeType } from '@iobroker/adapter-react-v5';

import Settings from './components/Settings';
import Overview from './components/Overview';
import Activities from './components/Activities';

import DashboardIcon from '@mui/icons-material/Dashboard';
import ListAltIcon from '@mui/icons-material/ListAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import SaveIcon from '@mui/icons-material/Save';

// =========================================================
// FIX: Statische Imports für die Sprachen (statt require)
// =========================================================
// Das zwingt den Compiler, die JSON-Daten direkt in den Code zu schreiben.
import enLang from './i18n/en.json';
import deLang from './i18n/de.json';

interface AppState extends GenericAppState {
    selectedTab: string;
    themeType: ThemeType;
    theme: IobTheme;
    hasChanges: boolean;
}

class App extends GenericApp<any, AppState> {
    constructor(props: any) {
        const extendedProps = { ...props };

        // HIER GEÄNDERT: Wir nutzen die oben importierten Objekte
        extendedProps.translations = {
            'en': enLang,
            'de': deLang,
        };

        super(props, extendedProps);
        this.state = { ...this.state, selectedTab: 'overview', hasChanges: false };
    }

    updateNativeValue(attr: string, value: any) {
        this.setState({ hasChanges: true });
        super.updateNativeValue(attr, value);
    }

    handleSave = () => {
        this.onSave(false);
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
                        <Box sx={{ display: 'flex', width: '100%', alignItems: 'center' }}>

                            <Tabs
                                value={this.state.selectedTab}
                                onChange={(_e, newVal) => this.setState({ selectedTab: newVal })}
                                indicatorColor="secondary"
                                textColor="inherit"
                                variant="standard"
                                centered={true}
                                sx={{ flexGrow: 1 }}
                            >
                                <Tab value="overview" label={I18n.t('Übersicht')} icon={<DashboardIcon />} iconPosition="start" />
                                <Tab value="activities" label={I18n.t('Aktivitäten')} icon={<ListAltIcon />} iconPosition="start" />
                                <Tab value="settings" label={I18n.t('Einstellungen')} icon={<SettingsIcon />} iconPosition="start" />
                            </Tabs>

                            <Box sx={{ position: 'absolute', right: 16 }}>
                                <Tooltip title={this.state.hasChanges ? "Änderungen speichern" : "Keine Änderungen"}>
                                    <span>
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