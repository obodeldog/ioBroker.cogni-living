const fs = require('fs');
const path = require('path');
const stPath = path.join(__dirname, '..', 'src-admin', 'src', 'components', 'tabs', 'SystemTab.tsx');
let st = fs.readFileSync(stPath, 'utf8');

// Suche nach dem driftWarning Block (mit korrektem Whitespace)
const idx = st.indexOf('data.driftWarning && (');
if (idx < 0) { console.error('driftWarning nicht gefunden'); process.exit(1); }

// Finde das Ende des Blocks: die schließende )} nach WarningAmberIcon
const blockEnd = st.indexOf('            )}', idx) + '            )}'.length;
console.log('Block gefunden bei idx:', idx, 'bis:', blockEnd);
console.log('Block:', JSON.stringify(st.substring(idx-60, blockEnd+5)));

const INSERT = `
                                                            {(data as any).sensorHint === 'reposition' && (
                                                                <Tooltip title="Sensor liefert dauerhaft schwaches Signal. Schiebe den Sensor etwas weiter Richtung K\u00f6rpermitte f\u00fcr bessere Schlafphasenerkennung.">
                                                                    <WarningAmberIcon sx={{ fontSize: 13, color: '#1976d2' }} />
                                                                </Tooltip>
                                                            )}`;

st = st.substring(0, blockEnd) + INSERT + st.substring(blockEnd);
fs.writeFileSync(stPath, st);
console.log('OK: sensorHint Hinweis nach driftWarning eingefügt');
