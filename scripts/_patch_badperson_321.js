'use strict';
/**
 * _patch_badperson_321.js — v0.33.321
 *
 * Fix: OC-BAD-PERSON — Badezimmer-Sensor mit explizitem personTag hat Vorrang.
 *
 * Problem: Marc hat "Zigbee EG Bad" mit personTag=Marc konfiguriert.
 *          Trotzdem wurde "Zigbee OG Bad" (kein personTag) in Marc's outsideBedEvents
 *          als Badezimmer-Bestätigung gezählt → oranges Dreieck für Jana's OG-Bad-Besuch.
 *
 * Regel: Wenn für die aktuelle Person mindestens EIN Bad-Sensor mit passendem personTag
 *        konfiguriert ist → werden alle anderen Bad-Sensoren (falscher oder kein personTag)
 *        für diese Person aus den outsideBedEvents herausgefiltert.
 *        Falls kein personTag-Bad existiert → Fallback wie bisher (alle ungetaggten Bäder).
 */

const fs   = require('fs');
const path = require('path');

function replaceOne(src, oldStr, newStr, label) {
    const idx = src.indexOf(oldStr);
    if (idx < 0) { console.error('[FEHLER] ' + label + ': Marker nicht gefunden!'); process.exit(1); }
    if (src.indexOf(oldStr, idx + 1) >= 0) { console.error('[FEHLER] ' + label + ': Marker nicht eindeutig!'); process.exit(1); }
    console.log('[OK] ' + label);
    return src.slice(0, idx) + newStr + src.slice(idx + oldStr.length);
}

const srcPath = path.join(__dirname, '..', 'src', 'main.js');
let src = fs.readFileSync(srcPath, 'utf8');

// ── Patch 1: personBathroomIds als neuen Parameter lesen (nach bathroomIds) ─────────────
src = replaceOne(src,
    '    var bathroomIds      = p.bathroomIds      || new Set();',
    '    var bathroomIds         = p.bathroomIds         || new Set();\n' +
    '    // [OC-BAD-PERSON] IDs der Badezimmer-Sensoren die explizit dieser Person gehören\n' +
    '    var personBathroomIds  = p.personBathroomIds  || new Set();',
    'Patch 1 – personBathroomIds Parameter'
);

// ── Patch 2: Badezimmer-PersonTag-Filter in obeAllSrc ────────────────────────────────────
src = replaceOne(src,
    '            if (e.isFP2Bed || e.isVibrationBed || e.isBedroomMotion) return false;\n' +
    '            // OC-OBE-HOP: Sensoren > 2 Hops vom Schlafzimmer ignorieren (z.B. OG-Bad bei EG-Schlafen)',
    '            if (e.isFP2Bed || e.isVibrationBed || e.isBedroomMotion) return false;\n' +
    '            // [OC-BAD-PERSON] Badezimmer-Sensor Priorität: Hat die Person ein eigenes Bad (personBathroomIds),\n' +
    '            // dann zählen fremde/ungetaggte Bäder NICHT für diese Person.\n' +
    '            // Beispiel: EG Bad = Marc → OG Bad (kein personTag) wird für Marc herausgefiltert.\n' +
    '            if ((e.isBathroomSensor || bathroomIds.has(e.id || \'\')) && personBathroomIds.size > 0) {\n' +
    '                if (!personBathroomIds.has(e.id || \'\')) return false;\n' +
    '            }\n' +
    '            // OC-OBE-HOP: Sensoren > 2 Hops vom Schlafzimmer ignorieren (z.B. OG-Bad bei EG-Schlafen)',
    'Patch 2 – OC-BAD-PERSON Filter in obeAllSrc'
);

// ── Patch 3: personBathroomIds beim computePersonSleep-Aufruf übergeben ──────────────────
src = replaceOne(src,
    '                        bathroomIds:   _bathroomDevIds,',
    '                        bathroomIds:   _bathroomDevIds,\n' +
    '                        // [OC-BAD-PERSON] Nur Bad-Sensoren dieser Person (personTag-Match)\n' +
    '                        personBathroomIds: new Set((_self.config.devices||[]).filter(function(d){\n' +
    '                            return (d.isBathroomSensor || d.sensorFunction === \'bathroom\') && d.personTag === person;\n' +
    '                        }).map(function(d){ return d.id; })),',
    'Patch 3 – personBathroomIds beim Aufruf'
);

fs.writeFileSync(srcPath, src, 'utf8');
console.log('\n✓ Alle 3 Patches angewendet (v0.33.321).');
