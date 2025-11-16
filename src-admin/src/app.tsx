/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';

// Importiere Box für das Layout von MUI v5
import { Box } from '@mui/material';

// Wichtig: Imports von adapter-react-v5 und TypeScript-Typen
import { GenericApp, type GenericAppProps, type GenericAppSettings, type ThemeType, Loader } from '@iobroker/adapter-react-v5';
import Settings from './components/settings';

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

class App extends GenericApp {
    constructor(props: GenericAppProps) {
        const extendedProps: GenericAppSettings = {
            ...props,
            encryptedFields: [],
            // Alle Sprachen müssen importiert werden
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
    }

    onConnectionReady(): void {
        // executed when connection is ready
    }

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

        // Verwende MUI v5 Box und sx Props für das Layout (Scrollbar Fix)
        return (
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
            <Box
                sx={{
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box',
                    bgcolor: 'background.default', // Nutzt das Theme-Hintergrund
                    color: this.state.themeType === 'dark' ? '#FFF' : '#000',
                }}
            >
                {/* Content Area (Scrollable) */}
                <Box
                    sx={{
                        flexGrow: 1,
                        overflow: 'auto',
                        p: 3, // Padding (p: 3 entspricht ca. 24px)
                    }}
                >
                    <Settings
                        native={this.state.native}
                        onChange={(attr, value) => this.updateNativeValue(attr, value)}
                        // Wichtig: Socket und themeType korrekt durchreichen (mit Type Cast)
                        socket={this.socket}
                        themeType={this.state.themeType as ThemeType}
                        // Weitere benötigte Props für Settings (TypeScript)
                        adapterName="cogni-living"
                        instance={this.instance}
                        theme={this.state.theme}
                    />
                </Box>

                {/* Footer Area (Fixed) */}
                <Box
                    sx={{
                        flexShrink: 0,
                        p: 2,
                        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
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

export default App;