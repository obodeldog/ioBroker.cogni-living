/**
 * REVERT v0.33.274: Noisy-Sensor-Ausschluss aus OC-48 / OC-48c rückgängig machen.
 *
 * Begründung (Nacht 08.06.2026, durch Rohdaten bestätigt):
 * Die als "noisy" geflaggten Sensoren ("Zigbee EG Wohnen", "Aqara EG Wohnen") haben
 * KEIN Rauschen gemeldet — der Nutzer war von ~00:00 bis ~01:00 WIRKLICH im Wohnzimmer.
 * OC-48c hat den 00:19-Kandidaten daher ZU RECHT abgelehnt. Der Patch v0.33.274 hat
 * OC-48c blind für echte Präsenz gemacht und ist damit falsch begründet.
 *
 * Entfernt exakt die 3 vom Patch eingefügten Stellen, lässt this._noisySensorIds
 * (OC-24-Infrastruktur, unabhängig) unberührt.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'main.js');
let src = fs.readFileSync(filePath, 'utf8');
const NL = src.includes('\r\n') ? '\r\n' : '\n';
const L = s => s.split('\n').join(NL);

// ── Entfernung 1: _oc48NoisyIds-Capture-Block (3 Zeilen) ────────────────────
const rm1 = L(`
            // [OC-24-OC48-Fix] Noisy-Sensoren (zu-sensibel-Bewegungsmelder) aus Gegenbeleg-Pruefung ausschliessen.
            // Sie feuern auch wenn niemand im Raum ist und wuerden sonst korrekte bedEntryTs verwerfen.
            var _oc48NoisyIds = (this._noisySensorIds && this._noisySensorIds.size > 0) ? this._noisySensorIds : new Set();`);

// ── Entfernung 2: _isFarMotion noisy-check (1 Zeile inkl. führendem Newline) ──
const rm2 = L(`
                    if (_oc48NoisyIds.has(e.id)) return false; // [OC-24-OC48-Fix] Noisy-Sensor = kein Gegenbeleg`);

// ── Entfernung 3: _oc48cFarFn noisy-check ───────────────────────────────────
const rm3 = L(`
                    if (_oc48NoisyIds.has(e.id)) return false; // [OC-24-OC48-Fix] Noisy-Sensor = kein Sustained-Absence-Beweis`);

function removeOnce(s, frag, label) {
  if (!s.includes(frag)) {
    console.error('FEHLER: Fragment nicht gefunden fuer ' + label);
    process.exit(1);
  }
  console.log('OK entfernt: ' + label);
  return s.replace(frag, '');
}

src = removeOnce(src, rm1, 'Capture-Block _oc48NoisyIds');
src = removeOnce(src, rm2, '_isFarMotion noisy-check');
src = removeOnce(src, rm3, '_oc48cFarFn noisy-check');

// Sicherstellen: keine Reste mehr
if (src.includes('_oc48NoisyIds') || src.includes('OC-24-OC48-Fix')) {
  console.error('FEHLER: Es sind noch Patch-Reste vorhanden!');
  process.exit(1);
}

fs.writeFileSync(filePath, src, 'utf8');
console.log('Fertig. v0.33.274 vollstaendig revertiert.');
