'use strict';

/*
 * Created with @iobroker/create-adapter v3.1.2
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

class CogniLiving extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options] - Adapter options
     */
    constructor(options) {
        super({
            ...options,
            name: 'cogni-living',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        this.log.info('cogni-living adapter starting... (Live Test Build 1)');

        // 1. Erstelle die Datenpunkte, in die wir unsere Events schreiben wollen
        await this.setObjectNotExistsAsync('events.lastEvent', {
            type: 'state',
            common: {
                name: 'Last raw event',
                type: 'string', // KORRIGIERT
                role: 'json',
                read: true,
                write: false,
            },
            native: {},
        });

        // 2. Abonniere die echten Sensoren
        // (Diese IDs müssen auf deinem p-iobroker existieren!)

        const sensorPraesenz = 'hm-rpc.0.000C1BE9A4F17E.1.PRESENCE_DETECTION_STATE'; // Praesenz EG Treppenhaus
        const sensorFenster = 'hm-rpc.0.0000DBE9A2A3B1.1.STATE'; // Fenster UG Büro zwei

        this.log.info(`Subscribing to FOREIGN state: ${sensorPraesenz}`);
        await this.subscribeForeignStatesAsync(sensorPraesenz);

        this.log.info(`Subscribing to FOREIGN state: ${sensorFenster}`);
        await this.subscribeForeignStatesAsync(sensorFenster);

        this.log.info('cogni-living adapter ready for LIVE test.');
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback - Callback function
     */
    onUnload(callback) {
        try {
            callback();
        } catch (error) {
            this.log.error(`Error during unloading: ${error.message}`);
            callback();
        }
    }

    /**
     * Is called if a subscribed state changes
     *
     * @param {string} id - State ID
     * @param {ioBroker.State | null | undefined} state - State object
     */
    onStateChange(id, state) {
        if (state) {
            if (!state.ack) {
                this.log.debug(`Ignoring command state change for ${id}`);
                return;
            }

            // DIESE ZEILE WOLLEN WIR IM p-iobroker LOG SEHEN!
            this.log.warn(`!!!! LIVE STATE CHANGE DETECTED: ID=${id}, Value=${state.val} !!!!`);

            const eventObject = {
                timestamp: state.ts,
                id: id,
                value: state.val,
            };

            // Schreibe das neue Event in unseren Datenpunkt
            this.setState('events.lastEvent', { val: JSON.stringify(eventObject), ack: true });
        } else {
            this.log.info(`state ${id} deleted`);
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options] - Adapter options
     */
    module.exports = (options) => new CogniLiving(options);
} else {
    // otherwise start the instance directly
    new CogniLiving();
}