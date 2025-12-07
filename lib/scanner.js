'use strict';

async function scanForDevices(adapter, filters) {
    adapter.log.info("🔍 Scanning for devices (Modular Scanner v2.0)...");
    const devices = [];
    const objects = await adapter.getForeignObjectsAsync('*');

    // 1. MAP ROOMS (Cache Enums)
    const roomMap = {};
    try {
        const roomEnums = await adapter.getForeignObjectsAsync('enum.rooms.*', 'enum');
        for (const roomId in roomEnums) {
            const roomObj = roomEnums[roomId];
            // Get best name (DE or default)
            const roomName = (roomObj.common && typeof roomObj.common.name === 'object' ? roomObj.common.name.de : roomObj.common.name) || roomObj.common.name;
            if (roomObj.common && roomObj.common.members) {
                for (const memberId of roomObj.common.members) {
                    roomMap[memberId] = roomName;
                }
            }
        }
    } catch(e) { adapter.log.warn('Could not load rooms: ' + e.message); }

    // 2. ENUM ALLOW LIST
    let allowedIds = null;
    let allowedTypes = {};

    if (filters.selectedFunctionIds && filters.selectedFunctionIds.length > 0) {
        allowedIds = new Set();
        adapter.log.info(`🔍 Filtering by ${filters.selectedFunctionIds.length} Enums...`);
        for (const enumId of filters.selectedFunctionIds) {
            const enumObj = await adapter.getForeignObjectAsync(enumId);
            if (enumObj && enumObj.common && enumObj.common.members) {
                let implicitType = null;
                const lowerId = enumId.toLowerCase();
                if (lowerId.includes('light') || lowerId.includes('licht')) implicitType = 'light';
                else if (lowerId.includes('heating') || lowerId.includes('heizung')) implicitType = 'temperature';
                else if (lowerId.includes('window') || lowerId.includes('fenster')) implicitType = 'door';

                for (const memberId of enumObj.common.members) {
                    allowedIds.add(memberId);
                    if(implicitType) allowedTypes[memberId] = implicitType;
                }
            }
        }
    }

    for (const id in objects) {
        const obj = objects[id];
        if (obj && obj.common && obj.type === 'state') {

            let isEnumMatch = false;
            let type = null;

            // CHECK 1: Enum Whitelist
            if (allowedIds) {
                // Check exact ID
                if (allowedIds.has(id)) {
                    isEnumMatch = true;
                    if(allowedTypes[id]) type = allowedTypes[id];
                } else {
                    // Check Parents (Inheritance)
                    const parts = id.split('.');
                    const parentId = parts.slice(0, -1).join('.');
                    const grandParentId = parts.slice(0, -2).join('.');
                    if (allowedIds.has(parentId)) { isEnumMatch = true; if(allowedTypes[parentId]) type = allowedTypes[parentId]; }
                    else if (allowedIds.has(grandParentId)) { isEnumMatch = true; if(allowedTypes[grandParentId]) type = allowedTypes[grandParentId]; }
                }
            }

            // CHECK 2: Heuristic
            const name = (obj.common.name && typeof obj.common.name === 'object' ? obj.common.name.de : obj.common.name) || '';
            const role = (obj.common.role || '').toLowerCase();
            const nameLower = name.toLowerCase();

            if (!type) {
                if (filters.motion && (role.includes('motion') || nameLower.includes('bewegung') || role.includes('presence'))) type = 'motion';
                else if (filters.doors && (role.includes('door') || role.includes('window') || nameLower.includes('tür') || nameLower.includes('fenster') || role.includes('contact'))) type = 'door';
                else if (filters.lights && (role.includes('light') || role.includes('switch') || nameLower.includes('licht') || role.includes('level.dimmer'))) type = 'light';
                else if (filters.temperature && (role.includes('temperature') || nameLower.includes('temperatur') || role.includes('thermostat'))) type = 'temperature';
            }

            // LOGIC: Enum OR Heuristic
            if ((isEnumMatch || type) && type) {
                let displayName = name || id;

                // --- AGGRESSIVE PARENT NAMING ---
                const badNames = ['occupancy', 'state', 'level', 'value', 'on', 'off', 'power', 'brightness', 'status', 'temp', 'temperature', 'setpoint', 'presence'];
                const isBadName = !name || badNames.some(bad => nameLower === bad || nameLower.includes(bad));

                // Wir suchen IMMER nach einem besseren Namen im Parent,
                // wenn der aktuelle Name generisch ist.
                if (isBadName) {
                    const parts = id.split('.');
                    const parentId = parts.slice(0, -1).join('.');
                    const parentObj = objects[parentId];
                    if (parentObj && parentObj.common && parentObj.common.name) {
                        let pName = (typeof parentObj.common.name === 'object' ? parentObj.common.name.de : parentObj.common.name) || '';
                        // Filter generic parent names like "Channel 1"
                        if (pName && !pName.toLowerCase().includes('channel') && pName !== parentId.split('.').pop()) {
                            displayName = `${pName} (${name || id.split('.').pop()})`;
                        } else {
                            // Try Grandparent (e.g. for Homematic)
                            const grandId = parts.slice(0, -2).join('.');
                            const grandObj = objects[grandId];
                            if (grandObj && grandObj.common && grandObj.common.name) {
                                let gName = (typeof grandObj.common.name === 'object' ? grandObj.common.name.de : grandObj.common.name) || '';
                                if (gName) displayName = `${gName} (${name || id.split('.').pop()})`;
                            }
                        }
                    }
                }

                // --- ROOM STRATEGY ---
                let location = roomMap[id];
                if (!location) {
                    const parentId = id.split('.').slice(0, -1).join('.');
                    location = roomMap[parentId];
                }
                if (!location) {
                    const grandId = id.split('.').slice(0, -2).join('.');
                    location = roomMap[grandId];
                }

                if (!location) {
                    const parts = id.split('.');
                    if(parts.length > 2) location = parts[2];
                }

                const score = isEnumMatch ? 90 : 50;
                const sourceInfo = isEnumMatch ? "Enum" : "Heuristic";

                devices.push({ id: id, name: displayName, type: type, location: location || '', _score: score, _source: sourceInfo });
            }
        }
    }
    adapter.log.info(`🔍 Scan finished. Found ${devices.length} candidates.`);
    return devices;
}

module.exports = {
    scanForDevices
};