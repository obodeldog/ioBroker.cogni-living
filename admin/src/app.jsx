/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { withStyles } from '@material-ui/core/styles';

import GenericApp from '@iobroker/adapter-react/GenericApp';
import Settings from './components/settings';

/**
 * @type {(_theme: import("@material-ui/core/styles").Theme) => import("@material-ui/styles").StyleRules}
 */
const styles = (_theme) => ({
    root: {
        width: '100%',
        height: '100%',
        overflow: 'auto',
        padding: '20px', 
        boxSizing: 'border-box', 
    },
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

        // === HIER IST DER FIX ===
        // Wir sagen dem Linter, er soll diese Zeile ignorieren
        // @ts-ignore
        const { classes } = this.props;

        return (
            <div className={classes.root}>
                <Settings
                    native={this.state.native}
                    onChange={(attr, value) => this.updateNativeValue(attr, value)}
                    socket={this.props.socket || this.socket} 
                    themeType={this.state.themeType}
                />
                {this.renderError()}
                {this.renderToast()}
                {this.renderSaveCloseButtons()}
            </div>
        );
    }
}

export default withStyles(styles)(App);