import React from 'react';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';

// Importiere Box und CssBaseline für das Layout von MUI v5
import { Box, CssBaseline, Tabs, Tab } from '@mui/material';

// SPRINT 21: MUI Icons für die Tabs
import SettingsIcon from '@mui/icons-material/Settings';
import DashboardIcon from '@mui/icons-material/Dashboard';

// Wichtig: Imports von adapter-react-v5 und TypeScript-Typen
import {
    GenericApp,
    type GenericAppProps,
    type GenericAppSettings,
    type GenericAppState, // <--- WICHTIG: Hier GenericAppState importieren
    type ThemeType,
    Loader,
    I18n,
} from '@iobroker/adapter-react-v5';

// FIX SPRINT 21: Importiere Connection für Type-Casting
import type { Connection } from '@iobroker/socket-client';

import Settings from './components/settings';
// SPRINT 21: Importiere das neue LTM Dashboard
import LtmDashboard from './tabs/LtmDashboard';

import enLang from './i18n/en.json';
import deLang from './i18n/de.json';
import ruLang from './i18n/ru.json';
import ptLang from './i18n/pt.json';
import nlLang from './i18n/nl.json';
import frLang from './i18n/fr.json';
import itLang from './i18n/it.json';
import esLang from './i18n/es.json';
import plLang from './i18n/pl.json';
import ukLang from './i18n/uk.json';
import zhCnLang from './i18n/zh-cn.json';

// SPRINT 21 FIX: AppState muss GenericAppState erweitern (nicht Settings!)
// Damit erben wir 'loaded', 'theme', 'native' usw. automatisch.
interface AppState extends GenericAppState {
    activeTab: number;
}

export default class App extends GenericApp<GenericAppProps, AppState> {

    constructor(props: GenericAppProps) {
        const extendedProps: GenericAppSettings = {
            ...props,
            encryptedFields: [],
            translations: {
                en: enLang,
                de: deLang,
                ru: ruLang,
                pt: ptLang,
                nl: nlLang,
                fr: frLang,
                it: itLang,
                es: esLang,
                pl: plLang,
                uk: ukLang,
                'zh-cn': zhCnLang,
            },
        };

        super(props, extendedProps);

        // SPRINT 21 FIX: Initialisiere den aktiven Tab im State
        // Wir nutzen Object.assign, um unseren Teil des States hinzuzufügen
        Object.assign(this.state, {
            activeTab: 0,
        });
    }

    onConnectionReady(): void {
        // executed when connection is ready
    }

    // SPRINT 21: Handler für Tab-Wechsel
    handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        this.setState({ activeTab: newValue });
    };

    render() {
        if (!this.state.loaded) {
            return (
                <StyledEngineProvider injectFirst>
                    <ThemeProvider theme={this.state.theme}>
                        <Loader themeType={this.state.themeType} />
                    </ThemeProvider>
                </StyledEngineProvider>
            );
        }

        return (
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    <CssBaseline />
                    <Box
                        sx={{
                            width: '100%',
                            height: '100%',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            boxSizing: 'border-box',
                            backgroundColor: 'background.default',
                            color: this.state.themeType === 'dark' ? '#FFF' : '#000',
                        }}
                    >
                        {/* SPRINT 21: Tab Navigation */}
                        <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper' }}>
                            <Tabs value={this.state.activeTab} onChange={this.handleTabChange} aria-label="adapter settings tabs">
                                <Tab icon={<SettingsIcon />} iconPosition="start" label={I18n.t('tab_configuration')} />
                                <Tab icon={<DashboardIcon />} iconPosition="start" label={I18n.t('tab_ltm_dashboard')} />
                            </Tabs>
                        </Box>

                        {/* Content Area (Scrollable) */}
                        <Box
                            sx={{
                                flexGrow: 1,
                                overflow: 'auto',
                            }}
                        >
                            {/* SPRINT 21: Bedingtes Rendering basierend auf dem aktiven Tab */}
                            {this.state.activeTab === 0 && (
                                <Settings
                                    native={this.state.native}
                                    onChange={(attr, value) => this.updateNativeValue(attr, value)}
                                    // FIX SPRINT 21: Socket und themeType korrekt durchreichen
                                    socket={this.socket as Connection}
                                    themeType={this.state.themeType as ThemeType}
                                    adapterName={this.adapterName}
                                    instance={this.instance}
                                    theme={this.state.theme}
                                />
                            )}
                            {this.state.activeTab === 1 && (
                                <LtmDashboard
                                    socket={this.socket as Connection}
                                    adapterName={this.adapterName}
                                    instance={this.instance}
                                    themeType={this.state.themeType as ThemeType}
                                />
                            )}
                        </Box>

                        {/* Footer Area (Fixed) */}
                        <Box
                            sx={{
                                flexShrink: 0,
                                p: 2,
                                borderTop: 1,
                                borderColor: 'divider',
                                backgroundColor: 'background.paper',
                            }}
                        >
                            {this.renderError()}
                            {this.renderToast()}
                            {this.renderSaveCloseButtons()}
                        </Box>
                    </Box>
                </ThemeProvider>
            </StyledEngineProvider>
        );
    }
}