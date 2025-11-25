import React from 'react';
import { Box, AppBar, Tabs, Tab } from '@mui/material';
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

        const { theme, themeType, native } = this.state;
        const isDark = themeType === 'dark';

        // FIX: Hartcodierte Hintergründe für besseren Kontrast im Menü
        const appBarStyle = {
            bgcolor: isDark ? '#272727' : 'primary.main',
            color: '#fff'
        };

        return (
            // FIX: overflowY: 'auto' aktiviert den Scrollbalken für die ganze Seite
            <div className="App" style={{ background: theme.palette.background.default, color: theme.palette.text.primary, height: '100vh', overflowY: 'auto', overflowX: 'hidden' }}>
                <AppBar position="sticky" sx={appBarStyle} elevation={3}>
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

                <Box sx={{ p: 0, pb: 5 }}> {/* Padding unten für Scroll-Platz */}
                    {this.state.selectedTab === 'overview' && (
                        <Overview socket={this.socket} adapterName={this.adapterName} instance={this.instance} theme={theme} themeType={themeType} />
                    )}
                    {this.state.selectedTab === 'activities' && (
                        <Activities socket={this.socket} adapterName={this.adapterName} instance={this.instance} theme={theme} themeType={themeType} />
                    )}
                    {this.state.selectedTab === 'settings' && (
                        <Settings native={native} onChange={(attr: string, value: any) => this.updateNativeValue(attr, value)} socket={this.socket} themeType={themeType} theme={theme} adapterName={this.adapterName} instance={this.instance} />
                    )}
                </Box>

                {this.renderError()}
                {this.renderToast()}
            </div>
        );
    }
}

export default App;