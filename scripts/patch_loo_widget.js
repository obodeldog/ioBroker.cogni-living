'use strict';
const fs = require('fs');
let src = fs.readFileSync('src-admin/src/components/tabs/SexTab.tsx', 'utf8');

const LOO_WIDGET = [
    '',
    '                                                                {rfInfo.confusion_matrix && rfInfo.loo_details && rfInfo.loo_details.length > 0 && (',
    '                                                                    <details style={{ marginTop: 4 }}>',
    "                                                                        <summary style={{ fontSize: '0.65rem', color: isDark ? '#555' : '#999', cursor: 'pointer', userSelect: 'none' }}>",
    '                                                                            LOO-Details ({rfInfo.loo_details.length} F\u00e4lle) anzeigen\u2026',
    '                                                                        </summary>',
    "                                                                        <div style={{ marginTop: 4, maxHeight: 180, overflowY: 'auto', fontSize: '0.6rem' }}>",
    "                                                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>",
    '                                                                                <thead>',
    "                                                                                    <tr style={{ color: isDark ? '#555' : '#aaa' }}>",
    "                                                                                        <th style={{ textAlign: 'left', padding: '1px 4px' }}>Datum</th>",
    "                                                                                        <th style={{ textAlign: 'left', padding: '1px 4px' }}>Ist</th>",
    "                                                                                        <th style={{ textAlign: 'left', padding: '1px 4px' }}>Vorhergesagt</th>",
    "                                                                                        <th style={{ textAlign: 'center', padding: '1px 4px' }}>Zelle</th>",
    '                                                                                    </tr>',
    '                                                                                </thead>',
    '                                                                                <tbody>',
    '                                                                                    {rfInfo.loo_details.map((d: any, i: number) => (',
    "                                                                                        <tr key={i} style={{ background: d.correct ? (isDark ? 'rgba(129,199,132,0.08)' : 'rgba(200,230,201,0.4)') : (isDark ? 'rgba(239,83,80,0.08)' : 'rgba(255,205,210,0.5)') }}>",
    "                                                                                            <td style={{ padding: '1px 4px', fontFamily: 'monospace' }}>{d.date || '\u2014'}</td>",
    "                                                                                            <td style={{ padding: '1px 4px' }}>{d.actual === 'vaginal' ? '\uD83C\uDF39' : d.actual === 'oral_hand' ? '\uD83D\uDC8B' : '\uD83D\uDEAB'} {d.actual}</td>",
    "                                                                                            <td style={{ padding: '1px 4px' }}>{d.predicted === 'vaginal' ? '\uD83C\uDF39' : d.predicted === 'oral_hand' ? '\uD83D\uDC8B' : '\uD83D\uDEAB'} {d.predicted}</td>",
    "                                                                                            <td style={{ textAlign: 'center', padding: '1px 4px', fontWeight: 700, color: d.cell === 'tp' || d.cell === 'tn' ? (isDark ? '#81c784' : '#2e7d32') : '#c62828' }}>{(d.cell||'').toUpperCase()}</td>",
    '                                                                                        </tr>',
    '                                                                                    ))}',
    '                                                                                </tbody>',
    '                                                                            </table>',
    '                                                                        </div>',
    '                                                                    </details>',
    '                                                                )}',
].join('\n');

// Find the anchor: the closing </div> of the confusion-matrix section (after specificity/sensitivity)
const SENSITIVITY_ANCHOR = '                                                                )}\n                                                            </div>';

// Find it within the confusion_matrix block (not first occurrence)
const cmIdx = src.indexOf('confusion_matrix');
const anchorPos = src.indexOf(SENSITIVITY_ANCHOR, cmIdx);
if (anchorPos === -1) { console.error('ANCHOR nicht gefunden'); process.exit(1); }

const insertAt = anchorPos + SENSITIVITY_ANCHOR.indexOf('\n                                                            </div>');
src = src.substring(0, insertAt) + '\n' + LOO_WIDGET + '\n' + src.substring(insertAt);
fs.writeFileSync('src-admin/src/components/tabs/SexTab.tsx', src, 'utf8');
console.log('LOO widget OK');
