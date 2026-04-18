'use strict';
/**
 * Fix 1: Frontend _rfBathDevs → d.isBathroomSensor===true (nicht nur sensorFunction.includes('bath'))
 * Fix 2: Backend nearbyRoomSensorIds berechnen und in pyClassifier mitliefern (SDH + RSD)
 * Fix 3: Frontend Nachbarzimmer-Tooltip nur nearbyRoomSensorIds nutzen
 */
const fs = require('fs');
let fe = fs.readFileSync('src-admin/src/components/tabs/SexTab.tsx', 'utf8');
let be = fs.readFileSync('src/main.js', 'utf8');
let feChanges = 0, beChanges = 0;

function applyFe(desc, oldStr, newStr) {
    if (!fe.includes(oldStr)) { console.error('FE FEHLER [' + desc + ']: String nicht gefunden'); return; }
    fe = fe.split(oldStr).join(newStr);
    console.log('FE OK [' + desc + ']');
    feChanges++;
}
function applyBe(desc, oldStr, newStr) {
    if (!be.includes(oldStr)) { console.error('BE FEHLER [' + desc + ']: String nicht gefunden'); return; }
    be = be.split(oldStr).join(newStr);
    console.log('BE OK [' + desc + ']');
    beChanges++;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1: Frontend – _rfBathDevs auf isBathroomSensor===true
// ─────────────────────────────────────────────────────────────────────────────
applyFe('1: rfBathDevs via isBathroomSensor',
    `    const _rfBathDevs  = _devs.filter((d: any) => (d.type||'').toLowerCase() === 'motion' && (d.sensorFunction||'').toLowerCase().includes('bath'));`,
    `    const _rfBathDevs  = _devs.filter((d: any) => d.isBathroomSensor === true);`
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1+3: Frontend – loo_details Typ + nearbyRoomSensorIds Typ ergänzen
// ─────────────────────────────────────────────────────────────────────────────
applyFe('1+3: pyClassifier Typ um nearbyRoomSensorIds erweitern',
    `            loo_details?: Array<{ date: string; actual: string; predicted: string; correct: boolean; cell: string }> | null;
        } | null;`,
    `            loo_details?: Array<{ date: string; actual: string; predicted: string; correct: boolean; cell: string }> | null;
            nearbyRoomSensorIds?: string[] | null;
        } | null;`
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 3: Frontend – _rfNearbyDevs auf nearbyRoomSensorIds filtern wenn vorhanden
// ─────────────────────────────────────────────────────────────────────────────
applyFe('3: rfNearbyDevs via nearbyRoomSensorIds',
    `    const _rfNearbyDevs= _devs.filter((d: any) => (d.type||'').toLowerCase() === 'motion' && !(d.sensorFunction||'').toLowerCase().includes('bath') && !(d.sensorFunction||'').toLowerCase().includes('bed'));`,
    `    const _rfNearbyIds  = calibInfo?.pyClassifier?.nearbyRoomSensorIds ?? null;
    const _rfNearbyDevs = _rfNearbyIds
        ? _devs.filter((d: any) => _rfNearbyIds.includes(d.id))
        : _devs.filter((d: any) => (d.type||'').toLowerCase() === 'motion' && !d.isBathroomSensor && (d.sensorFunction||'') !== 'bed');`
);

// Tooltip Text für Nachbarzimmer anpassen (Hop=1 → korrekte Quelle)
applyFe('3: Nachbarzimmer Tooltip Text',
    `'nearby_room_motion': _rfNearbyDevs.length > 0 ? \`Nachbarzimmer (Hop=1): \${_rfNearbyDevs.map(_devLabel).join(', ')}\` : 'Kein Nachbarzimmer-Sensor konfiguriert (Sensortyp: motion)',
        'nearby_room_mo':     _rfNearbyDevs.length > 0 ? \`Nachbarzimmer (Hop=1): \${_rfNearbyDevs.map(_devLabel).join(', ')}\` : 'Kein Nachbarzimmer-Sensor konfiguriert (Sensortyp: motion)',`,
    `'nearby_room_motion': _rfNearbyDevs.length > 0 ? \`Nachbarzimmer (Hop=1, aus Topologie): \${_rfNearbyDevs.map(_devLabel).join(', ')}\` : (_rfNearbyIds ? 'Keine Nachbarräume in Topologie (Hop=1)' : 'Kein Nachbarzimmer-Sensor konfiguriert (Sensortyp: motion)'),
        'nearby_room_mo':     _rfNearbyDevs.length > 0 ? \`Nachbarzimmer (Hop=1, aus Topologie): \${_rfNearbyDevs.map(_devLabel).join(', ')}\` : (_rfNearbyIds ? 'Keine Nachbarräume in Topologie (Hop=1)' : 'Kein Nachbarzimmer-Sensor konfiguriert (Sensortyp: motion)'),`
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2: Backend – nearbyRoomSensorIds in saveDailyHistory berechnen
// Nach _nearbyRooms Berechnung die passenden Sensor-IDs ermitteln
// ─────────────────────────────────────────────────────────────────────────────
applyBe('2a: SDH nearbyRoomSensorIds berechnen',
    `var _extractCtx = function(session, evts) {`,
    `var _nearbyRoomSensorIds = (be.config&&be.config.devices||this.config.devices||[]).filter(function(d){return d.type==='motion'&&!d.isBathroomSensor&&d.sensorFunction!=='bed'&&_nearbyRooms.has(d.location);}).map(function(d){return d.id;});
                var _extractCtx = function(session, evts) {`
        .replace('be.config&&be.config.devices||', '')  // Artefakt entfernen
);

// Das war falsch. Lass mich es direkt korrekt machen:
// Revert und neu:
if (be.includes('be.config&&be.config.devices||')) {
    be = be.replace(
        'var _nearbyRoomSensorIds = (be.config&&be.config.devices||this.config.devices||[]).filter(function(d){return d.type===\'motion\'&&!d.isBathroomSensor&&d.sensorFunction!==\'bed\'&&_nearbyRooms.has(d.location);}).map(function(d){return d.id;});\n                var _extractCtx = function(session, evts) {',
        'var _extractCtx = function(session, evts) {'
    );
    beChanges--;
    console.log('BE REVERT 2a (Artefakt-Fix)');
}

// Korrekter Ansatz: Einfügen VOR _extractCtx
const extractCtxMarker = 'var _extractCtx = function(session, evts) {';
if (be.includes(extractCtxMarker)) {
    be = be.replace(
        extractCtxMarker,
        'var _nearbyRoomSensorIds = (this.config.devices||[]).filter(function(d){return d.type===\'motion\'&&!d.isBathroomSensor&&d.sensorFunction!==\'bed\'&&_nearbyRooms.has(d.location);}).map(function(d){return d.id;});\n                ' + extractCtxMarker
    );
    console.log('BE OK [2a: SDH nearbyRoomSensorIds]');
    beChanges++;
} else {
    console.error('BE FEHLER [2a]: extractCtx Marker nicht gefunden');
}

// SDH pyClassifier: nearbyRoomSensorIds ergänzen
applyBe('2b: SDH pyClassifier nearbyRoomSensorIds',
    `loo_details: (_pyClassInfo.loo_details||[]) } : null;`,
    `loo_details: (_pyClassInfo.loo_details||[]), nearbyRoomSensorIds: _nearbyRoomSensorIds } : null;`
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2: Backend – nearbyRoomSensorIds in reanalyzeSexDay
// ─────────────────────────────────────────────────────────────────────────────
// Nach _raNearbyRooms Berechnung die passenden IDs berechnen
const raExtractMarker = 'var _raExtractCtx = function(session, evts) {';
if (be.includes(raExtractMarker)) {
    be = be.replace(
        raExtractMarker,
        'var _raNearbyRoomSensorIds = (this.config.devices||[]).filter(function(d){return d.type===\'motion\'&&!d.isBathroomSensor&&d.sensorFunction!==\'bed\'&&_raNearbyRooms.has(d.location);}).map(function(d){return d.id;});\n                ' + raExtractMarker
    );
    console.log('BE OK [2c: RSD nearbyRoomSensorIds]');
    beChanges++;
} else {
    console.error('BE FEHLER [2c]: _raExtractCtx Marker nicht gefunden');
}

// RSD pyClassifier: nearbyRoomSensorIds ergänzen
applyBe('2d: RSD pyClassifier nearbyRoomSensorIds',
    `loo_details:_raPyInfo.loo_details||[]} : null;`,
    `loo_details:_raPyInfo.loo_details||[],nearbyRoomSensorIds:_raNearbyRoomSensorIds} : null;`
);

// ─────────────────────────────────────────────────────────────────────────────
// Speichern
// ─────────────────────────────────────────────────────────────────────────────
fs.writeFileSync('src-admin/src/components/tabs/SexTab.tsx', fe, 'utf8');
fs.writeFileSync('src/main.js', be, 'utf8');
console.log('\nFrontend:', feChanges, 'Fixes | Backend:', beChanges, 'Fixes');
