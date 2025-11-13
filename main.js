'use strict';

/*
 * Created with @iobroker/create-adapter v3.1.2
 */

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
        this.log.info('cogni-living adapter starting...');

        // 1. Erstelle den Ausgabe-Datenpunkt
        await this.setObjectNotExistsAsync('events.lastEvent', {
            type: 'state',
            common: {
                name: 'Last raw event',
                type: 'string',
                role: 'json',
                read: true,
                write: false,
            },
            native: {},
        });

        // 2. Konfiguration laden
        const devices = this.config.devices;

        if (!devices || devices.length === 0) {
            this.log.warn('No sensors configured! Please add sensors in adapter settings.');
            return;
        }

        this.log.info(`Found ${devices.length} configured sensors. Subscribing...`);

        for (const device of devices) {
            if (device.id) {
                this.log.info(`Subscribing to: ${device.id} (${device.location || 'no location'})`);
                await this.subscribeForeignStatesAsync(device.id);
            }
        }
    }

    /**
     * Is called when adapter shuts down
     */
    onUnload(callback) {
        try {
            callback();
        } catch (error) {
            callback();
        }
    }

    /**
     * Is called if a subscribed state changes
     */
    onStateChange(id, state) {
        if (state) {
            // Nur echte Statusmeldungen (ack=true) verarbeiten, keine Befehle
            if (!state.ack) {
                return;
            }

            // Finde heraus, welcher Sensor das war
            const devices = this.config.devices || [];
            const deviceConfig = devices.find(d => d.id === id);
            
            const location = deviceConfig ? deviceConfig.location : 'unknown';
            const type = deviceConfig ? deviceConfig.type : 'unknown';

            // Logge das Event (Info-Level)
            this.log.info(`Event detected: ${location} (${type}) -> ${state.val}`);

            const eventObject = {
                timestamp: state.ts,
                id: id,
                value: state.val,
                location: location,
                type: type
            };

            // Schreibe das Event in unseren Datenpunkt
            this.setState('events.lastEvent', { val: JSON.stringify(eventObject), ack: true });
        }
    }
}

if (require.main !== module) {
    module.exports = (options) => new CogniLiving(options);
} else {
    new CogniLiving();
}