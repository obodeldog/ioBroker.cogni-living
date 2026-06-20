'use strict';
const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '..', 'src', 'main.js');
let src = fs.readFileSync(srcPath, 'utf8');

const OLD = [
    '                        bathroomIds:   _bathroomDevIds,',
    '                        bedroomLocations: (_self.config.devices||[]).filter(function(d){return d.sensorFunction===\'bed\'||d.isBedroomMotion||d.isFP2Bed||d.isVibrationBed;}).map(function(d){return d.location;}).filter(function(l){return !!l;}).filter(function(v,i,a){return a.indexOf(v)===i;}),',
    '                        hopDistFn:     _self._roomHopDistance.bind(_self),'
].join('\n');

const NEW = [
    '                        bathroomIds:   _bathroomDevIds,',
    '                        bedroomLocations: (function() {',
    '                            // [OC-BED-LOC] Person-spezifische bedroomLocations:',
    '                            // Nur Bett-Sensoren der aktuellen Person verwenden.',
    '                            // Verhindert: OG-Bad (Hop 1 von OG Kind) gilt als "nahe genug" fuer',
    '                            // Marc\'s Hop-Filter, obwohl Marc in EG Schlafen schlaeft.',
    '                            // Logik: 1) Sensoren mit passendem personTag 2) Fallback: alle Bett-Sensoren',
    '                            var _allBedDev = (_self.config.devices||[]).filter(function(d){',
    '                                return d.sensorFunction===\'bed\'||d.isBedroomMotion||d.isFP2Bed||d.isVibrationBed;',
    '                            });',
    '                            var _personBedDev = _allBedDev.filter(function(d){ return d.personTag === person; });',
    '                            var _bedDev = _personBedDev.length > 0 ? _personBedDev : _allBedDev;',
    '                            return _bedDev.map(function(d){ return d.location; })',
    '                                .filter(function(l){ return !!l; })',
    '                                .filter(function(v,i,a){ return a.indexOf(v)===i; });',
    '                        })(),',
    '                        hopDistFn:     _self._roomHopDistance.bind(_self),'
].join('\n');

const idx = src.indexOf(OLD);
if (idx < 0) { console.error('[FEHLER] Marker nicht gefunden!'); process.exit(1); }
const idx2 = src.indexOf(OLD, idx + 1);
if (idx2 >= 0) { console.error('[FEHLER] Marker nicht eindeutig!'); process.exit(1); }

src = src.slice(0, idx) + NEW + src.slice(idx + OLD.length);
fs.writeFileSync(srcPath, src, 'utf8');
console.log('[OK] bedroomLocations per-Person Fix angewendet (v0.33.320)');
