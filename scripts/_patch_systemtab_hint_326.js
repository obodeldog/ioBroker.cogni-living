/**
 * PATCH v0.33.326 — Sensor-Hinweis in SystemTab.tsx VIB-CAL Karte
 * 
 * Wenn sensorHint === 'reposition' → gelbes Warnsymbol mit Tooltip neben dem Status-Chip
 * Bedingung (im Backend gesetzt): avgTrigRate < 0.5 UND vibStrP90 < 20 UND >= 5 Nächte
 * Text: "Sensor zu leise — Richtung Körpermitte schieben"
 */
const fs = require('fs');
const path = require('path');

const stPath = path.join(__dirname, '..', 'src-admin', 'src', 'components', 'tabs', 'SystemTab.tsx');
let st = fs.readFileSync(stPath, 'utf8');

const OLD = `{data.driftWarning && (
                        <Tooltip title="Sensor-Drift erkannt — Vibrationsmuster stark verändert">
                          <WarningAmberIcon sx={{ fontSize: 13, color: '#f57c00' }} />
                        </Tooltip>
                      )}`;

const NEW = `{data.driftWarning && (
                        <Tooltip title="Sensor-Drift erkannt — Vibrationsmuster stark verändert">
                          <WarningAmberIcon sx={{ fontSize: 13, color: '#f57c00' }} />
                        </Tooltip>
                      )}
                      {data.sensorHint === 'reposition' && (
                        <Tooltip title="Sensor liefert dauerhaft schwaches Signal. Schiebe den Sensor etwas weiter Richtung Körpermitte für bessere Schlafphasenerkennung.">
                          <WarningAmberIcon sx={{ fontSize: 13, color: '#1976d2' }} />
                        </Tooltip>
                      )}`;

if (!st.includes(OLD)) { console.error('NICHT GEFUNDEN'); process.exit(1); }
st = st.replace(OLD, NEW);
fs.writeFileSync(stPath, st);
console.log('OK: sensorHint Anzeige in SystemTab.tsx ergänzt');
