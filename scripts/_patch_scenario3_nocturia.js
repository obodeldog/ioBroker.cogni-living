/**
 * Patch: Szenario-3-Erkennung + Nykturie-Doppelzaehlung-Fix
 *
 * Problem: Wenn zwei Personen ein Schlafzimmer teilen (jeweils eigener Vibrationssensor,
 * geteilter PIR/Radar), bekommt jede Person +1 Nykturie-Trip fuer jeden Bad-Gang,
 * weil beide Vib-Sensoren in den 10 Minuten vor dem Trip aktiv waren (Schlaf != still).
 *
 * Fix: Bei erkanntem Szenario 3 (gleiche Location, mehrere personTags mit Bett-Rolle)
 * wird das LETZTE Vib-Event verglichen. Wer zuletzt aktiv war (= gerade aufgestanden),
 * bekommt den Trip zugeordnet. Partner schlaeft weiter (hat AELTERE letzte Aktivitaet).
 *
 * Graceful Degradation: Ohne Szenario-3-Konfiguration identisches Verhalten wie vorher.
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'main.js');
let src = fs.readFileSync(filePath, 'utf8');

// Normalisiere Zeilenenden fuer Suche
function norm(s) { return s.replace(/\r\n/g, '\n'); }
let normalized = norm(src);

// ─── FIX 1: _personSharedRoom-Map nach personSensorIds-Aufbau einfuegen ──────
// Anker: Ende des devices.forEach das personSensorIds aufbaut
// Gefolgt von: if (Object.keys(personSensorIds).length === 0) return result;

const anchor1 = `                    personSensorIds[p].add(d.id);
                });`;

const replacement1 = `                    personSensorIds[p].add(d.id);
                });
                // [OC-SB-S3] Szenario-3-Erkennung: Personen die sich ein Schlafzimmer teilen
                // Basis: Sensoren mit Bett-Rolle (isFP2Bed, isVibrationBed, sensorFunction='bed'),
                // gleicher location, unterschiedliche personTags -> geteiltes Schlafzimmer.
                // Ergebnis: _personSharedRoom = { "Robert" -> Set(["Ingrid"]), "Ingrid" -> Set(["Robert"]) }
                var _sharedBedroomByLoc = {};
                devices.forEach(function(d) {
                    if (!d.personTag || !d.personTag.trim()) return;
                    if (!d.location || !d.location.trim()) return;
                    var _isBedRole = d.sensorFunction === 'bed' || d.isFP2Bed || d.isVibrationBed;
                    if (!_isBedRole) return;
                    var _loc = d.location.trim();
                    if (!_sharedBedroomByLoc[_loc]) _sharedBedroomByLoc[_loc] = new Set();
                    _sharedBedroomByLoc[_loc].add(d.personTag.trim());
                });
                var _personSharedRoom = {}; // personTag -> Set(Zimmer-Partner-personTags)
                Object.keys(_sharedBedroomByLoc).forEach(function(_loc) {
                    var _psInRoom = _sharedBedroomByLoc[_loc];
                    if (_psInRoom.size < 2) return; // Nur ein Bewohner -> kein geteiltes Zimmer
                    _psInRoom.forEach(function(p) {
                        if (!_personSharedRoom[p]) _personSharedRoom[p] = new Set();
                        _psInRoom.forEach(function(p2) { if (p2 !== p) _personSharedRoom[p].add(p2); });
                    });
                });`;

// ─── FIX 2: Nykturie-Abschnitt erweitern ─────────────────────────────────────
const anchor2 = `                        nocturiaAttr = _oc45bTrips.filter(function(trip) {
                            return _pNightEvtsForNoc.some(function(e) {
                                var ts = e.timestamp || 0;
                                return ts >= trip.start - 10 * 60 * 1000 && ts < trip.start;
                            });
                        }).length;`;

const replacement2 = `                        nocturiaAttr = _oc45bTrips.filter(function(trip) {
                            // OC-45b Standard: Person muss in 10 Min vor Trip aktiv gewesen sein
                            var _confirmed = _pNightEvtsForNoc.some(function(e) {
                                var ts = e.timestamp || 0;
                                return ts >= trip.start - 10 * 60 * 1000 && ts < trip.start;
                            });
                            if (!_confirmed) return false;
                            // [OC-SB-S3] Szenario-3-Tiebreaker: Bei geteiltem Schlafzimmer
                            // vergleiche letztes Vib-Event. Wer JUENGSTES Vib-Event hat
                            // (= gerade aufgestanden / letzte Bewegung vor dem Aufstehen),
                            // bekommt den Trip zugeordnet. Partner schlaeft weiter (aelteres Vib).
                            var _partners = _personSharedRoom[person];
                            if (!_partners || _partners.size === 0) return true; // Sz.1/2: kein Partner
                            var _myLastVib = 0;
                            _pNightEvtsForNoc.forEach(function(e) {
                                if (!e.isVibrationBed && !e.isBedroomMotion) return;
                                var ts = e.timestamp || 0;
                                if (ts < trip.start && ts > _myLastVib) _myLastVib = ts;
                            });
                            var _partnerLastVib = 0;
                            _partners.forEach(function(_partnerPerson) {
                                var _partnerIds = personSensorIds[_partnerPerson];
                                if (!_partnerIds) return;
                                sleepSearchEvents.forEach(function(e) {
                                    if (!_partnerIds.has(e.id)) return;
                                    if (!e.isVibrationBed && !e.isBedroomMotion) return;
                                    var ts = e.timestamp || 0;
                                    if (ts < trip.start && ts > _partnerLastVib) _partnerLastVib = ts;
                                });
                            });
                            // Kein Partner-Sensor-Daten -> Standard-Bestaetigung genuegt
                            if (_partnerLastVib === 0) return true;
                            // Person mit JUNGSTEM letzten Vib-Event gewinnt (= gerade aufgestanden)
                            return _myLastVib >= _partnerLastVib;
                        }).length;`;

// Anwenden
function applyFix(src, anchor, replacement, label) {
    var norm_src = src.replace(/\r\n/g, '\n');
    var norm_anchor = anchor.replace(/\r\n/g, '\n');
    if (!norm_src.includes(norm_anchor)) {
        console.error('FEHLER: Anker nicht gefunden fuer ' + label);
        process.exit(1);
    }
    var result = norm_src.replace(norm_anchor, replacement.replace(/\r\n/g, '\n'));
    console.log('OK: ' + label + ' angewendet');
    return result;
}

let result = applyFix(normalized, anchor1, replacement1, 'FIX1 _personSharedRoom-Erkennung');
result = applyFix(result, anchor2, replacement2, 'FIX2 Nykturie-Tiebreaker');

// Schreiben
fs.writeFileSync(filePath, result, 'utf8');
console.log('Fertig. src/main.js aktualisiert.');
