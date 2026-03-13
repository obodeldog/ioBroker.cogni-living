'use strict';

/**
 * TOPOLOGY BUILDER for ST-GCN & Stone Soup
 * Wandelt die lineare Geräteliste in einen Graphen um (Knoten = Räume).
 * Version: 0.29.17 (ROLLBACK: Use Original Names for Display)
 */

const setup = require('./setup');

async function updateTopology(adapter) {
    adapter.log.debug("🕸️ Updating Graph Topology...");

    // 1. Räume aus den Devices extrahieren
    const devices = adapter.config.devices || [];
    const roomsSet = new Set();
    const monitoredRoomsSet = new Set();

    devices.forEach(d => {
        if (d.location && d.location.trim() !== '') {
            // ROLLBACK: WIR NEHMEN DEN ORIGINALEN NAMEN (z.B. "DG Bad")
            const loc = d.location.trim();

            roomsSet.add(loc);

            if (d.type === 'motion' || (d.type && d.type.toLowerCase().includes('bewegung'))) {
                monitoredRoomsSet.add(loc);
            }
        }
    });

    const currentRooms = Array.from(roomsSet).sort();
    const monitoredRooms = Array.from(monitoredRoomsSet).sort();

    if (currentRooms.length === 0) {
        adapter.log.debug("🕸️ No rooms found via devices. Topology skipped.");
        return;
    }

    // 2. Bestehende Matrix laden
    let oldTopology = { rooms: [], matrix: [] };
    try {
        const state = await adapter.getStateAsync('analysis.topology.structure');
        if (state && state.val) {
            oldTopology = JSON.parse(state.val);
        }
    } catch (e) {}

    // 3. Matrix migrieren (Resizing)
    const newMatrix = [];
    const size = currentRooms.length;

    for (let i = 0; i < size; i++) {
        const row = [];
        for (let j = 0; j < size; j++) {
            let val = (i === j) ? 1 : 0;
            const roomA = currentRooms[i];
            const roomB = currentRooms[j];

            // Wir versuchen, alte Verbindungen zu retten
            // (Das funktioniert, sobald die Namen wieder matchen)
            const oldIdxA = oldTopology.rooms ? oldTopology.rooms.indexOf(roomA) : -1;
            const oldIdxB = oldTopology.rooms ? oldTopology.rooms.indexOf(roomB) : -1;

            if (oldIdxA !== -1 && oldIdxB !== -1 && oldTopology.matrix[oldIdxA] && oldTopology.matrix[oldIdxA][oldIdxB] !== undefined) {
                val = oldTopology.matrix[oldIdxA][oldIdxB];
            }
            row.push(val);
        }
        newMatrix.push(row);
    }

    // 4. Speichern
    const topologyObj = {
        updated: Date.now(),
        nodeCount: size,
        rooms: currentRooms,
        matrix: newMatrix,
        monitored: monitoredRooms
    };

    if (JSON.stringify(topologyObj.rooms) !== JSON.stringify(oldTopology.rooms) ||
        JSON.stringify(topologyObj.matrix) !== JSON.stringify(oldTopology.matrix) ||
        JSON.stringify(topologyObj.monitored) !== JSON.stringify(oldTopology.monitored || [])) {

        await adapter.setStateAsync('analysis.topology.structure', { val: JSON.stringify(topologyObj), ack: true });
        adapter.log.info(`🕸️ Topology Graph updated: ${size} Nodes (Display Names restored).`);

        if (adapter.sendToPythonWrapper) {
            adapter.sendToPythonWrapper('SET_TOPOLOGY', topologyObj);
        }
    } else {
        adapter.log.debug(`🕸️ Topology unchanged.`);
    }
}

module.exports = { updateTopology };