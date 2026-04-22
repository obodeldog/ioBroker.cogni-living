'use strict';

/**
 * SCANNER v0.13.27 - "The Context-Aware Blocker"
 * * CHANGES:
 * 1. FIX: False Positives for Lights. Heating Valves (.LEVEL) and Blinds (.LEVEL) are no longer detected as lights.
 * 2. LOGIC: Checks the FULL context (Name of Child + Parent + Grandparent) for exclusion keywords (Heiz, Rollo, Ventil) BEFORE classifying as Light.
 * 3. KEEP: Polyglot features, KNX support, Jana-Renaming.
 */

// 1. Erlaubte Adapter
const ALLOWED_ADAPTERS = [
    'hm-rpc.', 'zigbee.', 'hue.', 'shelly.', 'sonoff.', 'zwave.', 'zwave2.', 'mqtt.',
    'alias.', '0_userdata.', 'tuya.', 'deconz.', 'enocean.', 'tado.',
    'openknx.', 'knx.',
    'accuweather.', 'daswetter.', 'openweathermap.', 'weatherunderground.', 'netatmo.'
];

// 2. Junk-Killer
const IGNORED_PATTERNS = [
    ':0.', 'script.', 'system.', 'admin.', 'info.',
    'unreach', 'stickyp_unreach', 'config_pending', 'update_pending', 'device_query',
    'fault', 'lowbat', 'dutycycle', 'rssi', 'link_quality', 'availability',
    'battery', 'voltage', 'current', 'power', 'energy', 'consumption',
    'error_', 'degraded_chamber', 'test_result', '_command', 'status_message', 'error_code',
    'hm-rcv-50', 'bidcos-rf', 'virtuelle', 'virtual', 'test.', 'test_', 'debug'
];

// 3. VIP Endings
const VALID_ENDINGS = [
    '.STATE', '.LEVEL', '.ON', '.OFF',
    '.OCCUPANCY', '.PRESENCE', '.PRESENCE_DETECTION_STATE',
    '.SMOKE_DETECTOR_ALARM_STATUS',
    '.CONTACT', '.MOTION', '.ACTUAL', '.SET',
    '.TEMPERATURE', '.ACTUAL_TEMPERATURE',
    '.SET_POINT_TEMPERATURE', '.SET_TEMPERATURE', '.SETPOINT', '.TARGET_TEMPERATURE',
    '.BRIGHTNESS', '.ILLUMINATION',
    '.HUE', '.SATURATION', '.RGB',
    '.SWITCH', '.LOCK_STATE', '.VALVE_STATE',
    '.TEMP', '.Temperature'
];

// 4. POLYGLOT KEYWORDS
const POLYGLOT_KEYWORDS = [
    '_schalten', '_switch', '_state', '_status',
    '_wert', '_value', '_val', '_messwert',
    '_stell', '_soll', '_ist', '_set', '_act',
    '_dimm', '_bri'
];

// 5. TRUSTED ROLES
const TRUSTED_ROLES = [
    'switch.light', 'dimmer', 'value.temperature', 'level.temperature',
    'sensor.motion', 'sensor.door', 'sensor.window', 'sensor.lock', 'sensor.alarm'
];

async function scanForDevices(adapter, filters) {
    adapter.log.info("🔍 Scanning for devices (v0.13.27 - Context Blocker)...");
    const devices = [];
    const objects = await adapter.getForeignObjectsAsync('*');

    // --- A: RAUM-MAPPING ---
    const roomMap = {};
    const knownRoomNames = new Set();
    const roomKeywords = [];

    try {
        const roomEnums = await adapter.getForeignObjectsAsync('enum.rooms.*', 'enum');
        for (const roomId in roomEnums) {
            const roomObj = roomEnums[roomId];
            const roomName = (roomObj.common && typeof roomObj.common.name === 'object' ? roomObj.common.name.de : roomObj.common.name) || roomObj.common.name;

            if (roomName) {
                knownRoomNames.add(roomName);
                const words = roomName.split(/[\s_.-]+/).filter(w => w.length > 1 && !/^\d+$/.test(w));
                if (words.length > 0) roomKeywords.push({ fullName: roomName, keywords: words });
            }

            if (roomObj.common && roomObj.common.members) {
                for (const memberId of roomObj.common.members) {
                    roomMap[memberId] = roomName;
                }
            }
        }
    } catch(e) {}

    // --- B: ENUM FILTER ---
    let forcedEnumIds = new Set();
    let forcedEnumTypes = {};

    if (filters.selectedFunctionIds && filters.selectedFunctionIds.length > 0) {
        for (const enumId of filters.selectedFunctionIds) {
            const enumObj = await adapter.getForeignObjectAsync(enumId);
            if (enumObj && enumObj.common && enumObj.common.members) {
                let implicitType = null;
                const lowerId = enumId.toLowerCase();
                if (lowerId.includes('light') || lowerId.includes('licht')) implicitType = 'light';
                else if (lowerId.includes('heating') || lowerId.includes('thermostat')) implicitType = 'temperature';
                else if (lowerId.includes('window') || lowerId.includes('door') || lowerId.includes('fenster') || lowerId.includes('tür')) implicitType = 'door';
                else if (lowerId.includes('motion') || lowerId.includes('bewegung')) implicitType = 'motion';
                else if (lowerId.includes('security') || lowerId.includes('sicherheit')) implicitType = 'security_check';

                for (const memberId of enumObj.common.members) {
                    forcedEnumIds.add(memberId);
                    if (implicitType && implicitType !== 'security_check') {
                        forcedEnumTypes[memberId] = implicitType;
                    }
                }
            }
        }
    }

    // --- C: HAUPTSCHLEIFE ---
    for (const id in objects) {
        const obj = objects[id];
        if (!obj || !obj.common || obj.type !== 'state') continue;

        const idUpper = id.toUpperCase();
        const idLower = id.toLowerCase();
        let role = (obj.common.role || '').toLowerCase();

        // 1. Adapter Check
        if (!ALLOWED_ADAPTERS.some(prefix => id.startsWith(prefix))) continue;

        // 2. Junk Check
        if (IGNORED_PATTERNS.some(term => idLower.includes(term))) continue;

        // Parent Helper
        const parts = id.split('.');
        const parentId = parts.slice(0, -1).join('.');
        const grandParentId = parts.slice(0, -2).join('.');

        // --- CONTEXT FETCHING (Das ist neu hier oben!) ---
        // Wir holen uns SOFORT die Namen von Vater und Opa, um "Heizung" oder "Rollo" zu erkennen.
        const parentObj = objects[parentId];
        let parentName = "";
        if (parentObj && parentObj.common && parentObj.common.name) parentName = (typeof parentObj.common.name === 'object' ? parentObj.common.name.de : parentObj.common.name);

        const grandParentObj = objects[grandParentId];
        let grandParentName = "";
        if (grandParentObj && grandParentObj.common && grandParentObj.common.name) grandParentName = (typeof grandParentObj.common.name === 'object' ? grandParentObj.common.name.de : grandParentObj.common.name);

        const displayName = (obj.common.name && typeof obj.common.name === 'object' ? obj.common.name.de : obj.common.name) || "";

        // Full Context String (Alles klein, um einfach zu suchen)
        const fullContext = (displayName + " " + parentName + " " + grandParentName + " " + role).toLowerCase();

        // --- DER TÜRSTEHER ---
        const isEnumVip = forcedEnumIds.has(id) || forcedEnumIds.has(parentId) || forcedEnumIds.has(grandParentId);
        const hasValidEnding = VALID_ENDINGS.some(ending => idUpper.endsWith(ending));
        const hasPolyglotKeyword = POLYGLOT_KEYWORDS.some(kw => idLower.includes(kw));
        const hasTrustedRole = TRUSTED_ROLES.some(tr => role.includes(tr));

        if (!isEnumVip && !hasValidEnding && !hasPolyglotKeyword && !hasTrustedRole) continue;

        // --- D: CLASSIFICATION ---
        let type = forcedEnumTypes[id] || forcedEnumTypes[parentId] || forcedEnumTypes[grandParentId] || null;

        // Weather
        if (!type) {
            if (id.startsWith('accuweather.') || id.startsWith('daswetter.') || id.startsWith('openweathermap.') || id.startsWith('weatherunderground.') || id.startsWith('netatmo.')) {
                if (role.includes('temperature') || role.includes('value.temp') || idLower.includes('temp')) type = 'weather';
            }
        }

        // Fire
        if (!type || (isEnumVip && !type)) {
            if (role.includes('fire') || role.includes('smoke') || idUpper.includes('SMOKE_DETECTOR')) type = 'fire';
        }

        if (!type) {
            // *** THE CONTEXT BLOCKER ***
            // Wir definieren hier, was es ALLES SEIN KANN, basierend auf dem GANZEN Kontext.
            const isHeating = fullContext.includes('heiz') || fullContext.includes('thermostat') || fullContext.includes('valve') || fullContext.includes('ventil') || fullContext.includes('climate') || idLower.includes('stell') || idLower.includes('soll');
            const isBlind = fullContext.includes('rollo') || fullContext.includes('blind') || fullContext.includes('shutter') || fullContext.includes('jalousie') || fullContext.includes('behang') || fullContext.includes('markise');

            // MOTION
            if (role.includes('motion') || role.includes('presence') || idUpper.endsWith('.OCCUPANCY') || idUpper.endsWith('.PRESENCE') || idUpper.endsWith('.PRESENCE_DETECTION_STATE')) {
                if (obj.common.type === 'boolean') type = 'motion';
            }

            // DOOR/WINDOW
            if (!type && (role.includes('window') || role.includes('door') || role.includes('contact') || idUpper.endsWith('.CONTACT'))) {
                if (!role.includes('opener') && !role.includes('lock')) type = 'door';
            }

            // LIGHT (Mit scharfem Context-Blocker)
            if (!type && !isHeating && !isBlind) {
                // Check Role First
                if (role.includes('light') || role.includes('switch') || role.includes('dimmer')) {
                    type = 'light';
                }
                // Check Polyglot Keywords
                else if (idLower.includes('_schalten') || idLower.includes('_dimm') || idLower.includes('_state')) {
                    if (!role.includes('button')) type = 'light';
                }
                // Check Classic Endings
                else if ((idUpper.endsWith('.ON') || idUpper.endsWith('.LEVEL')) && !role.includes('button')) {
                    type = 'light';
                }
            }

            // TEMPERATURE
            if (!type) {
                // Role First
                if (role.includes('temperature') || role.includes('thermostat')) {
                    if (obj.common.type === 'number') type = 'temperature';
                }
                // Keywords
                else if (idLower.includes('_ist') || idLower.includes('_soll') || idLower.includes('_temp') || idLower.includes('_stell')) {
                    if (obj.common.type === 'number') type = 'temperature';
                }
                // Classic Endings
                else {
                    const isTempEnding = idUpper.endsWith('.ACTUAL_TEMPERATURE') || idUpper.endsWith('.SET_POINT_TEMPERATURE') || idUpper.endsWith('.SET_TEMPERATURE') || idUpper.endsWith('.SETPOINT') || idUpper.endsWith('.ACTUAL') || idUpper.endsWith('.TEMPERATURE');
                    if (isTempEnding && obj.common.type === 'number') type = 'temperature';
                }
            }
        }

        if (isEnumVip && !type) type = 'custom';

        // --- E: RESPECTFUL FILTERING ---
        if (type && !isEnumVip) {
            if (type === 'motion' && !filters.motion) continue;
            if (type === 'door' && !filters.doors) continue;
            if (type === 'light' && !filters.lights) continue;
            if (type === 'temperature' && !filters.temperature) continue;
            if (type === 'weather' && !filters.weather) continue;
            if (type === 'fire') continue;
        }

        // --- F: FINAL NAMING & ROOM LOGIC ---
        if (type) {
            let location = roomMap[id] || roomMap[parentId] || roomMap[grandParentId];

            // --- SMART ROOM SEARCH (STRICT FUZZY) ---
            if (!location) {
                const nameSearch = (displayName + " " + parentName + " " + grandParentName).toLowerCase();
                const candidates = [];
                for (const room of knownRoomNames) {
                    if (nameSearch.includes(room.toLowerCase())) candidates.push(room);
                }
                if (candidates.length === 0) {
                    for (const rk of roomKeywords) {
                        const allKeywordsFound = rk.keywords.every(kw => nameSearch.includes(kw.toLowerCase()));
                        if (allKeywordsFound) candidates.push(rk.fullName);
                    }
                }
                if (candidates.length === 1) location = candidates[0];
                else if (candidates.length > 1) {
                    candidates.sort((a,b) => b.length - a.length);
                    const longest = candidates[0];
                    const second = candidates[1];
                    if (longest.includes(second)) location = longest;
                }
            }

            if (!isEnumVip && !location && type !== 'weather') continue;

            // --- NAME LOGIC (Respect Original) ---
            const rootId = id.split('.')[0];
            const prefixMap = { 'hm-rpc': 'Homematic', 'zigbee': 'Zigbee', 'hue': 'Hue', 'shelly': 'Shelly', 'sonoff': 'Sonoff', '0_userdata': 'Userdata', 'alias': 'Alias', 'tuya': 'Tuya', 'zwave': 'ZWave', 'openknx': 'KNX', 'knx': 'KNX', 'accuweather': 'AccuWeather', 'daswetter': 'DasWetter', 'openweathermap': 'OpenWeather', 'netatmo': 'Netatmo' };
            const prettySource = prefixMap[rootId] || (rootId.charAt(0).toUpperCase() + rootId.slice(1));

            let finalName = grandParentName || parentName || displayName || id;

            // Remove Junk
            finalName = finalName.replace(/hm-rpc\.\d+|zigbee\.\d+|openknx\.\d+|knx\.\d+|[a-zA-Z0-9]{14,}|:\d+/gi, '');
            finalName = finalName.replace(/[._]/g, ' ').trim();

            if (type === 'temperature') {
                if (idUpper.includes('ACTUAL') || idLower.includes('_ist')) finalName += ' (Ist)';
                else if (idUpper.includes('SET') || idLower.includes('_soll') || idLower.includes('_stell')) finalName += ' (Soll)';
            }

            // Fallback für zu kurze Namen
            if (finalName.length < 15) {
                const cleanDetails = (displayName + " " + parentName).toLowerCase().replace(/[._-]/g, ' ');
                const detailRegex = /\b(\d+|links|rechts|left|right|oben|unten|top|bottom|mitte|center|vorne|hinten|front|back|innen|außen|inside|outside|spot|candle|bulb|strip|bett|schrank|tisch|wand|decke|boden)\b/g;
                const distinctions = cleanDetails.match(detailRegex);
                if (distinctions) {
                    const uniqueDistinctions = [...new Set(distinctions)];
                    const suffix = uniqueDistinctions.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
                    finalName += ` ${suffix}`;
                }
            }

            finalName = `${prettySource} ${finalName}`;
            finalName = finalName.replace(/\s+/g, ' ').trim();

            let score = 50;
            let source = "Auto (Context-Aware)";
            if (isEnumVip) { score = 90; source = "Enum"; }
            else if (location) { score = 70; source = "Auto + Raum"; }

            devices.push({ id, name: finalName, type, location: location || '', _score: score, _source: source });
        }
    }

    devices.sort((a,b) => b._score - a._score);
    adapter.log.info(`🔍 Context-Aware Scan (v0.13.27) found ${devices.length} devices.`);
    return devices;
}

module.exports = { scanForDevices };