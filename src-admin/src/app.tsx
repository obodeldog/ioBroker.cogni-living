import React from 'react';
import { Box, AppBar, Tabs, Tab } from '@mui/material';
// FIX: ThemeType importieren
import { GenericApp, I18n, type IobTheme, type GenericAppState, type ThemeType } from '@iobroker/adapter-react-v5';

import Settings from './components/Settings';
import Overview from './components/Overview';
import Activities from './components/Activities';

// Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import ListAltIcon from '@mui/icons-material/ListAlt';
import SettingsIcon from '@mui/icons-material/Settings';

interface AppState extends GenericAppState {
    selectedTab: string;
    // FIX: Hier muss ThemeType stehen, nicht string
    themeType: ThemeType;
    theme: IobTheme;
}

class App extends GenericApp<any, AppState> {
    constructor(props: any) {
        const extendedProps = { ...props };
        super(props, extendedProps);

        this.state = {
            ...this.state,
            selectedTab: 'overview',
        };
    }

    render() {
        if (!this.state.loaded) {
            return super.render();
        }

        const { theme, themeType, native } = this.state;

        return (
            <div className="App" style={{ background: theme.palette.background.default, color: theme.palette.text.primary, minHeight: '100vh' }}>
                <AppBar position="static" color="default" elevation={1}>
                    <Tabs
                        value={this.state.selectedTab}
                        onChange={(_e, newVal) => this.setState({ selectedTab: newVal })}
                        indicatorColor="primary"
                        textColor="primary"
                        variant="fullWidth"
                    >
                        <Tab
                            value="overview"
                            label={I18n.t('Übersicht')}
                            icon={<DashboardIcon />}
                            iconPosition="start"
                        />
                        <Tab
                            value="activities"
                            label={I18n.t('Aktivitäten')}
                            icon={<ListAltIcon />}
                            iconPosition="start"
                        />
                        <Tab
                            value="settings"
                            label={I18n.t('Einstellungen')}
                            icon={<SettingsIcon />}
                            iconPosition="start"
                        />
                    </Tabs>
                </AppBar>

                <Box sx={{ p: 0 }}>
                    {this.state.selectedTab === 'overview' && (
                        <Overview
                            socket={this.socket}
                            adapterName={this.adapterName}
                            instance={this.instance}
                        />
                    )}

                    {this.state.selectedTab === 'activities' && (
                        <Activities
                            socket={this.socket}
                            adapterName={this.adapterName}
                            instance={this.instance}
                        />
                    )}

                    {this.state.selectedTab === 'settings' && (
                        <Settings
                            native={native}
                            onChange={(attr: string, value: any) => this.updateNativeValue(attr, value)}
                            socket={this.socket}
                            themeType={themeType}
                            theme={theme}
                            adapterName={this.adapterName}
                            instance={this.instance}
                        />
                    )}
                </Box>

                {this.renderError()}
                {this.renderToast()}
            </div>
        );
    }
}

export default App;