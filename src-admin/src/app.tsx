import React from 'react';
import { Box, AppBar, Tabs, Tab, ThemeProvider, createTheme } from '@mui/material';
import { GenericApp, I18n, type IobTheme, type GenericAppState, type ThemeType } from '@iobroker/adapter-react-v5';

import Settings from './components/Settings';
import Overview from './components/Overview';
import Activities from './components/Activities';

import DashboardIcon from '@mui/icons-material/Dashboard';
import ListAltIcon from '@mui/icons-material/ListAlt';
import SettingsIcon from '@mui/icons-material/Settings';

interface AppState extends GenericAppState {
    selectedTab: string;
    themeType: ThemeType;
    theme: IobTheme;
}

class App extends GenericApp<any, AppState> {
    constructor(props: any) {
        const extendedProps = { ...props };
        super(props, extendedProps);
        this.state = { ...this.state, selectedTab: 'overview' };
    }

    render() {
        if (!this.state.loaded) return super.render();

        const { themeType, native } = this.state;
        const isDark = themeType === 'dark';

        // --- CUSTOM THEME ENGINE ---
        // Wir erstellen ein eigenes Theme, das auf dem aktuellen Modus basiert,
        // aber unsere eigenen "schönen" Farben erzwingt.
        const cogniTheme = createTheme({
            palette: {
                mode: isDark ? 'dark' : 'light',
                primary: {
                    main: isDark ? '#90caf9' : '#1976d2', // Helleres Blau im Darkmode
                },
                background: {
                    default: isDark ? '#121212' : '#f5f5f5', // "Rich Black" statt Pitch Black
                    paper: isDark ? '#1e1e1e' : '#ffffff',   // Karten heben sich ab
                },
                text: {
                    primary: isDark ? '#ffffff' : '#000000',
                    secondary: isDark ? '#b0b0b0' : '#666666',
                }
            },
            components: {
                MuiAppBar: {
                    styleOverrides: {
                        root: {
                            backgroundColor: isDark ? '#272727' : '#1976d2', // Feste Farbe für Menü
                            color: '#ffffff',
                        }
                    }
                },
                MuiTab: {
                    styleOverrides: {
                        root: {
                            textTransform: 'none', // Keine GROSSBUCHSTABEN
                            fontWeight: 'bold',
                            borderRight: '1px solid rgba(255,255,255,0.1)', // TRENNLINIE
                            '&:last-child': { borderRight: 'none' },
                            '&.Mui-selected': {
                                backgroundColor: 'rgba(255,255,255,0.1)', // Highlight aktiver Tab
                                color: '#fff'
                            }
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
                    height: '100vh',
                    overflowY: 'auto',
                    overflowX: 'hidden'
                }}>
                    <AppBar position="sticky" elevation={2}>
                        <Tabs
                            value={this.state.selectedTab}
                            onChange={(_e, newVal) => this.setState({ selectedTab: newVal })}
                            indicatorColor="secondary"
                            textColor="inherit"
                            variant="fullWidth"
                        >
                            <Tab value="overview" label={I18n.t('Übersicht')} icon={<DashboardIcon />} iconPosition="start" />
                            <Tab value="activities" label={I18n.t('Aktivitäten')} icon={<ListAltIcon />} iconPosition="start" />
                            <Tab value="settings" label={I18n.t('Einstellungen')} icon={<SettingsIcon />} iconPosition="start" />
                        </Tabs>
                    </AppBar>

                    <Box sx={{ p: 0, pb: 10 }}>
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