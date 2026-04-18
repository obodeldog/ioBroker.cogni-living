/**
 * Frontend-Fixes für SexTab.tsx:
 * Fix 1: loo_details Typ + Anzeige (expandierbare Tabelle)
 * Fix 2: _rfBathDevs (alle bathroom-Sensoren, nicht nur erster)
 * Fix 3: Licht/Temp via Raumlocation (bed-Raum des Vibrationssensors)
 * Fix 4: Nachbarzimmer: Tooltip mit allen nearby-Sensoren
 */
'use strict';
const fs = require('fs');
let src = fs.readFileSync('src-admin/src/components/tabs/SexTab.tsx', 'utf8');
let changes = 0;

function apply(desc, oldStr, newStr) {
    if (!src.includes(oldStr)) { console.error('FEHLER [' + desc + ']: String nicht gefunden'); return; }
    src = src.split(oldStr).join(newStr);
    console.log('OK [' + desc + ']');
    changes++;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1: loo_details Typ in pyClassifier Interface
// ─────────────────────────────────────────────────────────────────────────────
apply('1: loo_details Typ',
    "confusion_matrix?: { tp: number; fp: number; tn: number; fn: number } | null;\n        } | null;",
    "confusion_matrix?: { tp: number; fp: number; tn: number; fn: number } | null;\n            loo_details?: Array<{ date: string; actual: string; predicted: string; correct: boolean; cell: string }> | null;\n        } | null;"
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 3: bed-Raum ermitteln + Licht/Temp via Raumlocation
// ─────────────────────────────────────────────────────────────────────────────
apply('3: bedRoom + Licht/Temp via location',
    `    const _rfLightDev  = _devs.find((d: any) => ['light','dimmer'].includes((d.type||'').toLowerCase()) && (d.sensorFunction||'').toLowerCase().includes('bed'));
    const _rfPressDev  = _devs.find((d: any) => ['fp2','presence','fp2_presence'].includes((d.type||'').toLowerCase()));
    const _rfTempDev   = _devs.find((d: any) => ['temperature','thermostat'].includes((d.type||'').toLowerCase()) && (d.sensorFunction||'').toLowerCase().includes('bed'));`,
    `    const _rfBedRoom  = _devs.find((d: any) => d.sensorFunction === 'bed' && ['vibration_strength','vibration_trigger','presence_radar_bool'].includes((d.type||'').toLowerCase()))?.location ?? null;
    const _rfLightDev  = _devs.find((d: any) => ['light','dimmer'].includes((d.type||'').toLowerCase()) && (_rfBedRoom ? (d.location||'') === _rfBedRoom : (d.sensorFunction||'').toLowerCase().includes('bed')));
    const _rfPressDev  = _devs.find((d: any) => ['fp2','presence','fp2_presence'].includes((d.type||'').toLowerCase()));
    const _rfTempDev   = _devs.find((d: any) => ['temperature','thermostat','heating_valve'].includes((d.type||'').toLowerCase()) && (_rfBedRoom ? (d.location||'') === _rfBedRoom : (d.sensorFunction||'').toLowerCase().includes('bed')));`
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2: _rfBathDev → _rfBathDevs (alle Bathroom-Sensoren)
// FIX 4: _rfNearbyDevs (alle Nearby-Sensoren)
// ─────────────────────────────────────────────────────────────────────────────
apply('2+4: Bath+Nearby als arrays',
    `    const _rfBathDev   = _devs.find((d: any) => (d.type||'').toLowerCase() === 'motion' && (d.sensorFunction||'').toLowerCase().includes('bath'));
    const _rfNearbyDev = _devs.find((d: any) => (d.type||'').toLowerCase() === 'motion' && !(d.sensorFunction||'').toLowerCase().includes('bath') && !(d.sensorFunction||'').toLowerCase().includes('bed'));`,
    `    const _rfBathDevs  = _devs.filter((d: any) => (d.type||'').toLowerCase() === 'motion' && (d.sensorFunction||'').toLowerCase().includes('bath'));
    const _rfBathDev   = _rfBathDevs[0] ?? null;
    const _rfNearbyDevs= _devs.filter((d: any) => (d.type||'').toLowerCase() === 'motion' && !(d.sensorFunction||'').toLowerCase().includes('bath') && !(d.sensorFunction||'').toLowerCase().includes('bed'));
    const _rfNearbyDev = _rfNearbyDevs[0] ?? null;`
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2: Bad-Tooltip mit allen Sensoren
// ─────────────────────────────────────────────────────────────────────────────
apply('2: Bad-Tooltip multi-sensor',
    `'bath_before':        _rfBathDev   ? \`Bad-Sensor: \${_devLabel(_rfBathDev)} | Bewegung 60 Min VOR Session\` : 'Kein Bad-Sensor konfiguriert (Sensortyp: motion, Funktion: bathroom)',
        'bath_after':         _rfBathDev   ? \`Bad-Sensor: \${_devLabel(_rfBathDev)} | Bewegung 60 Min NACH Session\` : 'Kein Bad-Sensor konfiguriert (Sensortyp: motion, Funktion: bathroom)',`,
    `'bath_before':        _rfBathDevs.length > 0 ? \`Bad-Sensoren: \${_rfBathDevs.map(_devLabel).join(', ')} | Bewegung 60 Min VOR Session\` : 'Kein Bad-Sensor konfiguriert (Sensortyp: motion, Funktion: bathroom)',
        'bath_after':         _rfBathDevs.length > 0 ? \`Bad-Sensoren: \${_rfBathDevs.map(_devLabel).join(', ')} | Bewegung 60 Min NACH Session\` : 'Kein Bad-Sensor konfiguriert (Sensortyp: motion, Funktion: bathroom)',`
);

// FIX 4: Nachbarzimmer-Tooltip mit allen Sensoren
apply('4: Nachbarzimmer-Tooltip multi',
    `'nearby_room_motion': _rfNearbyDev ? \`Nachbarzimmer: \${_devLabel(_rfNearbyDev)}\` : 'Kein Nachbarzimmer-Sensor konfiguriert (Sensortyp: motion)',
        'nearby_room_mo':     _rfNearbyDev ? \`Nachbarzimmer: \${_devLabel(_rfNearbyDev)}\` : 'Kein Nachbarzimmer-Sensor konfiguriert (Sensortyp: motion)',`,
    `'nearby_room_motion': _rfNearbyDevs.length > 0 ? \`Nachbarzimmer (Hop=1): \${_rfNearbyDevs.map(_devLabel).join(', ')}\` : 'Kein Nachbarzimmer-Sensor konfiguriert (Sensortyp: motion)',
        'nearby_room_mo':     _rfNearbyDevs.length > 0 ? \`Nachbarzimmer (Hop=1): \${_rfNearbyDevs.map(_devLabel).join(', ')}\` : 'Kein Nachbarzimmer-Sensor konfiguriert (Sensortyp: motion)',`
);

// FIX 3: Licht/Temp Tooltip
apply('3: Licht-Tooltip Raumlocation',
    `'light_on':           _rfLightDev  ? \`Lichtsensor: \${_devLabel(_rfLightDev)}\`    : 'Kein Lichtsensor konfiguriert (Sensortyp: light/dimmer, Funktion: bed)',`,
    `'light_on':           _rfLightDev  ? \`Lichtsensor (\${_rfBedRoom||'Schlafzimmer'}): \${_devLabel(_rfLightDev)}\`    : \`Kein Lichtsensor im Schlafzimmer gefunden (\${_rfBedRoom||'kein Bett-Sensor konfiguriert'})\`,`
);
apply('3: Temp-Tooltip Raumlocation',
    `'room_temp_norm':     _rfTempDev   ? \`Temperatur: \${_devLabel(_rfTempDev)}\`      : 'Kein Temperatursensor konfiguriert (Sensortyp: temperature, Funktion: bed)',`,
    `'room_temp_norm':     _rfTempDev   ? \`Temperatursensor (\${_rfBedRoom||'Schlafzimmer'}): \${_devLabel(_rfTempDev)}\`      : \`Kein Temperatursensor im Schlafzimmer gefunden (\${_rfBedRoom||'kein Bett-Sensor konfiguriert'})\`,`
);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1: loo_details Anzeige in der Confusion-Matrix-Sektion
// Direkt nach der Sensitivität/Spezifität einfügen
// ─────────────────────────────────────────────────────────────────────────────
const LOO_DETAILS_WIDGET = `
                                                                {rfInfo.confusion_matrix && rfInfo.loo_details && rfInfo.loo_details.length > 0 && (() => {
                                                                    const details = rfInfo.loo_details!;
                                                                    const [showLoo, setShowLoo] = (window as any).__looState || [false, null];
                                                                    // Einfacher lokaler Toggle via ref-ähnlichem Trick
                                                                    return (
                                                                        <details style={{ marginTop: 4 }}>
                                                                            <summary style={{ fontSize: '0.65rem', color: isDark ? '#555' : '#999', cursor: 'pointer', userSelect: 'none' }}>
                                                                                LOO-Details ({details.length} Fälle) anzeigen…
                                                                            </summary>
                                                                            <div style={{ marginTop: 4, maxHeight: 180, overflowY: 'auto', fontSize: '0.6rem' }}>
                                                                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                                                    <thead>
                                                                                        <tr style={{ color: isDark ? '#555' : '#aaa' }}>
                                                                                            <th style={{ textAlign: 'left', padding: '1px 4px' }}>Datum</th>
                                                                                            <th style={{ textAlign: 'left', padding: '1px 4px' }}>Ist</th>
                                                                                            <th style={{ textAlign: 'left', padding: '1px 4px' }}>Vorhergesagt</th>
                                                                                            <th style={{ textAlign: 'center', padding: '1px 4px' }}>Matrix</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody>
                                                                                        {details.map((d: any, i: number) => (
                                                                                            <tr key={i} style={{ background: d.correct ? (isDark ? 'rgba(129,199,132,0.08)' : 'rgba(200,230,201,0.4)') : (isDark ? 'rgba(239,83,80,0.08)' : 'rgba(255,205,210,0.5)') }}>
                                                                                                <td style={{ padding: '1px 4px', fontFamily: 'monospace' }}>{d.date || '—'}</td>
                                                                                                <td style={{ padding: '1px 4px' }}>{d.actual === 'vaginal' ? '🌹' : d.actual === 'oral_hand' ? '💋' : '🚫'} {d.actual}</td>
                                                                                                <td style={{ padding: '1px 4px' }}>{d.predicted === 'vaginal' ? '🌹' : d.predicted === 'oral_hand' ? '💋' : '🚫'} {d.predicted}</td>
                                                                                                <td style={{ textAlign: 'center', padding: '1px 4px', fontWeight: 700, color: d.cell === 'tp' || d.cell === 'tn' ? (isDark ? '#81c784' : '#2e7d32') : '#c62828' }}>{(d.cell||'').toUpperCase()}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </details>
                                                                    );
                                                                })()}`;

// Einfügen nach der Sensitivität/Spezifität Zeile in der Confusion-Matrix-Section
apply('1: loo_details Widget',
    `                                                                    {(sensitivity != null || specificity != null) && (
                                                                    <div style={{ display: 'flex', gap: 10, marginTop: 3, fontSize: '0.65rem', color: isDark ? '#555' : '#999' }}>
                                                                        {sensitivity != null && <span title="Sensitivität = TP/(TP+FN) — Wie viele echte Sessions wurden korrekt erkannt?">Sensitivität: <strong style={{ color: sensitivity >= 80 ? (isDark ? '#81c784' : '#2e7d32') : '#f57c00' }}>{sensitivity}%</strong></span>}
                                                                        {specificity != null && <span title="Spezifität = TN/(TN+FP) — Wie viele Nullnummern wurden korrekt als No-Sex erkannt?">Spezifität: <strong style={{ color: specificity >= 80 ? (isDark ? '#81c784' : '#2e7d32') : '#f57c00' }}>{specificity}%</strong></span>}
                                                                    </div>
                                                                    )}
                                                                </div>
                                                                    );
                                                                })()}`,
    `                                                                    {(sensitivity != null || specificity != null) && (
                                                                    <div style={{ display: 'flex', gap: 10, marginTop: 3, fontSize: '0.65rem', color: isDark ? '#555' : '#999' }}>
                                                                        {sensitivity != null && <span title="Sensitivität = TP/(TP+FN) — Wie viele echte Sessions wurden korrekt erkannt?">Sensitivität: <strong style={{ color: sensitivity >= 80 ? (isDark ? '#81c784' : '#2e7d32') : '#f57c00' }}>{sensitivity}%</strong></span>}
                                                                        {specificity != null && <span title="Spezifität = TN/(TN+FP) — Wie viele Nullnummern wurden korrekt als No-Sex erkannt?">Spezifität: <strong style={{ color: specificity >= 80 ? (isDark ? '#81c784' : '#2e7d32') : '#f57c00' }}>{specificity}%</strong></span>}
                                                                    </div>
                                                                    )}${LOO_DETAILS_WIDGET}
                                                                </div>
                                                                    );
                                                                })()}`
);

fs.writeFileSync('src-admin/src/components/tabs/SexTab.tsx', src, 'utf8');
console.log('\nGesamt', changes, 'Fixes angewendet. SexTab.tsx gespeichert.');
