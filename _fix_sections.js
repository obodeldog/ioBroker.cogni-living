const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src-admin', 'src', 'components', 'tabs', 'LongtermTrendsView.tsx');
let src = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// ─── MARKER DEFINITIONS ─────────────────────────────────────────────────────

// START of Drift group = the Mini-Graphen Grid comment
const DRIFT_GROUP_START_MARKER = '                                    {/* Mini-Graphen Grid */}\n                    <Grid container spacing={2}>';
// END of Drift group = the hidden placeholder Grid item
const DRIFT_GROUP_END_MARKER   = '                    <Grid item xs={12} style={{ display: \'none\' }}>{/* keeps grid structure */}</Grid>';

// START of Hygiene group = the "Weitere Gesundheitskacheln" comment
const HYGIENE_GROUP_START_MARKER = '                    {/* Weitere Gesundheitskacheln */}\n                    <Grid container spacing={2} sx={{ mt: 2 }}>';
// END of Hygiene group = closing </Grid> of that container (last </Grid> before </>)
const HYGIENE_GROUP_END_MARKER   = '\n                    </Grid>\n                </>\n            )}';

// ─── VERIFY MARKERS ─────────────────────────────────────────────────────────
function checkMarker(label, marker) {
    const idx = src.indexOf(marker);
    if (idx < 0) { console.error(`ERROR: Marker "${label}" nicht gefunden`); process.exit(1); }
    console.log(`✓ Marker "${label}" gefunden @ char ${idx}`);
    return idx;
}

// The Mini-Graphen comment has extra leading spaces from original file
// Let's find it more loosely
const idxMiniComment = src.indexOf('{/* Mini-Graphen Grid */}');
if (idxMiniComment < 0) { console.error('ERROR: Mini-Graphen Grid comment nicht gefunden'); process.exit(1); }
// Find start of that line
const lineStart = src.lastIndexOf('\n', idxMiniComment) + 1;
const miniGridLine = src.substring(lineStart, idxMiniComment + 26);
console.log('Mini-Graphen line start found:', JSON.stringify(miniGridLine));

const idxDriftEnd   = checkMarker('DRIFT_GROUP_END',    DRIFT_GROUP_END_MARKER);
const idxHygieneStart = checkMarker('HYGIENE_GROUP_START', HYGIENE_GROUP_START_MARKER);
const idxHygieneEnd   = src.lastIndexOf('</Grid>\n                </>');
if (idxHygieneEnd < 0) { console.error('ERROR: Hygiene end nicht gefunden'); process.exit(1); }
console.log('✓ HYGIENE_GROUP_END @ char', idxHygieneEnd);

// ─── STEP 1: Wrap the Drift group ───────────────────────────────────────────
// Insert opening Box + label BEFORE the Mini-Graphen comment line
// Insert closing Box AFTER the hidden placeholder

const DRIFT_OPEN = `                    {/* ═══ DRIFT-ANALYSE Gruppe ═══ */}
                    <Box sx={{
                        mt: 3,
                        borderLeft: '4px solid #ff9800',
                        borderRadius: '0 8px 8px 0',
                        bgcolor: isDark ? 'rgba(255,152,0,0.04)' : 'rgba(255,152,0,0.03)',
                        pl: 2,
                        pr: 0.5,
                        pt: 2,
                        pb: 1,
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                            <Typography variant="overline" sx={{
                                color: '#ff9800',
                                fontWeight: 'bold',
                                letterSpacing: '0.12em',
                                fontSize: '0.7rem',
                                lineHeight: 1,
                            }}>
                                🔬 DRIFT-ANALYSE
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1.5, fontSize: '0.62rem' }}>
                                Langzeit-Veränderungen — die 3 Kacheln und der Monitor darunter zeigen dasselbe Bild: kurz vs. lang
                            </Typography>
                        </Box>\n`;

const DRIFT_CLOSE = `\n                    </Box>`;

// Find exact insertion points
// OPEN goes right before the line that starts with the Mini-Graphen comment
const driftOpenPos = lineStart;  // start of the Mini-Graphen comment line

// CLOSE goes right after the hidden placeholder line
const driftClosePos = idxDriftEnd + DRIFT_GROUP_END_MARKER.length;

// We need to re-indent the content inside the Box by adding extra spaces
// Current indentation inside: 20 spaces (5 levels)
// Box is at 20 spaces, its children need 24 spaces (6 levels)
// But to keep changes minimal, we'll just wrap without re-indenting since Box doesn't force layout

// Build the replacement:
// [everything before driftOpenPos] + DRIFT_OPEN + [content from driftOpenPos to driftClosePos] + DRIFT_CLOSE + [rest]
const before  = src.substring(0, driftOpenPos);
const inside  = src.substring(driftOpenPos, driftClosePos);
const after   = src.substring(driftClosePos);

src = before + DRIFT_OPEN + inside + DRIFT_CLOSE + after;
console.log('\n✓ Schritt 1: Drift-Gruppe gewrappt');

// ─── STEP 2: Wrap the Hygiene group ─────────────────────────────────────────
// Re-find positions in updated src
const idxHygStart2 = src.indexOf('{/* Weitere Gesundheitskacheln */}');
if (idxHygStart2 < 0) { console.error('ERROR: Hygiene start nach Step1 nicht gefunden'); process.exit(1); }
const hygLineStart = src.lastIndexOf('\n', idxHygStart2) + 1;

const HYGIENE_OPEN = `                    {/* ═══ HYGIENE & LÜFTUNG Gruppe ═══ */}
                    <Box sx={{
                        mt: 3,
                        borderLeft: '4px solid #4db6ac',
                        borderRadius: '0 8px 8px 0',
                        bgcolor: isDark ? 'rgba(77,182,172,0.04)' : 'rgba(77,182,172,0.03)',
                        pl: 2,
                        pr: 0.5,
                        pt: 2,
                        pb: 1,
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                            <Typography variant="overline" sx={{
                                color: '#4db6ac',
                                fontWeight: 'bold',
                                letterSpacing: '0.12em',
                                fontSize: '0.7rem',
                                lineHeight: 1,
                            }}>
                                🏠 HYGIENE & LÜFTUNG
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1.5, fontSize: '0.62rem' }}>
                                Unabhängige Metriken — kein Einfluss auf den Drift-Monitor
                            </Typography>
                        </Box>\n`;

// Find the closing </Grid> of the Hygiene section followed by </>
const idxHygClose2 = src.lastIndexOf('</Grid>\n                <>');
// Actually let's find the last Grid closing before the fragment close
const HYGIENE_END_SEARCH = '\n                    </Grid>\n                </>';
const idxHygEnd2 = src.lastIndexOf(HYGIENE_END_SEARCH);
if (idxHygEnd2 < 0) { console.error('ERROR: Hygiene end nach Step1 nicht gefunden'); process.exit(1); }
const hygClosePos = idxHygEnd2 + HYGIENE_END_SEARCH.indexOf('\n                </>'); // up to (not incl.) the </>

const HYGIENE_CLOSE = `\n                    </Box>`;

const before2  = src.substring(0, hygLineStart);
const inside2  = src.substring(hygLineStart, hygClosePos);
const after2   = src.substring(hygClosePos);

src = before2 + HYGIENE_OPEN + inside2 + HYGIENE_CLOSE + after2;
console.log('✓ Schritt 2: Hygiene-Gruppe gewrappt');

// ─── VERIFY ──────────────────────────────────────────────────────────────────
const checks = [
    ['DRIFT-ANALYSE Box',    'DRIFT-ANALYSE'],
    ['HYGIENE & LÜFTUNG Box','HYGIENE & LÜFTUNG'],
    ['GANGGESCHWINDIGKEIT',  'GANGGESCHWINDIGKEIT'],
    ['NACHT-UNRUHE',         'NACHT-UNRUHE'],
    ['RAUM-MOBILITÄT',       'RAUM-MOBIL'],
    ['DRIFT-MONITOR',        'DRIFT-MONITOR'],
    ['BAD-NUTZUNG',          'BAD-NUTZUNG'],
    ['FRISCHLUFT',           'FRISCHLUFT'],
];
let ok = true;
for (const [label, token] of checks) {
    if (!src.includes(token)) { console.error(`ERROR: ${label} fehlt!`); ok = false; }
    else console.log(`  ✓ ${label} vorhanden`);
}
if (!ok) process.exit(1);

// Check order
const pos = (t) => src.indexOf(t);
const order = [
    ['DRIFT-ANALYSE (Box label)', pos('DRIFT-ANALYSE')],
    ['GANGGESCHWINDIGKEIT',       pos('GANGGESCHWINDIGKEIT')],
    ['DRIFT-MONITOR',             pos('🔬 DRIFT-MONITOR')],
    ['HYGIENE & LÜFTUNG (Box)',   pos('HYGIENE & LÜFTUNG')],
    ['BAD-NUTZUNG',               pos('BAD-NUTZUNG')],
    ['FRISCHLUFT',                pos('FRISCHLUFT')],
];
console.log('\nReihenfolge:');
order.forEach(([l,p]) => console.log(`  ${p.toString().padStart(6)} : ${l}`));

let prevP = -1;
const orderOk = order.every(([,p]) => { const r = p > prevP; prevP = p; return r; });
if (!orderOk) { console.error('ERROR: Reihenfolge nicht korrekt!'); process.exit(1); }
console.log('  ✓ Reihenfolge korrekt!');

// ─── WRITE ───────────────────────────────────────────────────────────────────
fs.writeFileSync(filePath, src.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\n✓ Datei gespeichert (${src.split('\n').length} Zeilen)`);
