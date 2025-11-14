/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { withStyles } from '@material-ui/core/styles';

import GenericApp from '@iobroker/adapter-react/GenericApp';
import Settings from './components/settings';

/**
 * @type {(_theme: import("@material-ui/core/styles").Theme) => import("@material-ui/styles").StyleRules}
 */
const styles = (_theme) => ({
    // Der Haupt-Container
    root: {
        // Nutzt Flexbox, um Kinder (content, footer) zu organisieren
        display: 'flex',
        flexDirection: 'column',
        // Nimmt 100% der Fensterhöhe ein
        height: '100%', 
        width: '100%',
        overflow: 'hidden', // Verhindert doppelte Scrollbalken
        boxSizing: 'border-box',
    },
    // Der Inhalts-Bereich (wird scrollbar)
    content: {
        // Sagt dem Inhalt, er soll allen verfügbaren Platz füllen
        flexGrow: 1, 
        // Fügt den Scrollbalken NUR HIER hinzu
        overflow: 'auto', 
        // Unser Abstand
        padding: '20px', 
    },
    // Der Footer-Bereich (bleibt unten)
    footer: {
        // Schrumpft nicht, bleibt fixiert
        flexShrink: 0, 
        // Etwas Abstand für die Knöpfe
        padding: '10px 20px', 
        // Eine leichte Trennlinie (optional)
        borderTop: '1px solid #444', 
    }
});

class App extends GenericApp {
    constructor(props) {
        const extendedProps = {
            ...props,
            encryptedFields: [],
            translations: {
                en: require('./i18n/en.json'),
                de: require('./i18n/de.json'),
            },
        };
        super(props, extendedProps);
    }

    onConnectionReady() {
        // executed when connection is ready
    }

    render() {
        if (!this.state.loaded) {
            return super.render();
        }

        // @ts-ignore
        const { classes } = this.props;

        return (
            // 1. Der Haupt-Container
            <div className={classes.root}>
                
                {/* 2. Der scrollbare Inhalts-Bereich */}
                <div className={classes.content}>
                    <Settings
                        native={this.state.native}
                        onChange={(attr, value) => this.updateNativeValue(attr, value)}
                        socket={this.props.socket || this.socket} 
                        themeType={this.state.themeType}
                    />
                </div>

                {/* 3. Der feste Footer-Bereich */}
                <div className={classes.footer}>
                    {this.renderError()}
                    {this.renderToast()}
                    {this.renderSaveCloseButtons()}
                </div>
            </div>
        );
    }
}

export default withStyles(styles)(App);