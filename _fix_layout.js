const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src-admin', 'src', 'components', 'tabs', 'LongtermTrendsView.tsx');
let src = fs.readFileSync(filePath, 'utf8');
// Normalize line endings
src = src.replace(/\r\n/g, '\n');

// ─── Marker-based extraction (robust, no content-matching) ─────────────────

// MARKER A: start of BAD-NUTZUNG block (the comment line before <Grid item>)
const MARKER_BAD_START = '                        {/* 4. Hygiene-Frequenz */}';
// MARKER B: the DRIFT-MONITOR placeholder comment inside mini-chart grid
const MARKER_DRIFT_PLACEHOLDER = '                        {/* DRIFT-MONITOR vollbreite Karte */}\n                    </Grid>';
// MARKER C: start of actual DRIFT-MONITOR full-width section
const MARKER_DRIFT_START = '                    {/* \uD83D\uDD2C DRIFT-MONITOR';  // emoji prefix
// MARKER C alt (without emoji, just the comment)
const MARKER_DRIFT_ACTUAL = '\n\n                    {/* ';
// MARKER D: hidden placeholder that ends the section
const MARKER_HIDDEN = '                    <Grid item xs={12} style={{ display: \'none\' }}>{/* keeps grid structure */}</Grid>';
// MARKER E: closing fragment tag
const MARKER_CLOSING = '\n                </>\n            )}';

const idxBadStart   = src.indexOf(MARKER_BAD_START);
const idxDriftPlaceholder = src.indexOf(MARKER_DRIFT_PLACEHOLDER);
const idxHidden     = src.indexOf(MARKER_HIDDEN);

if (idxBadStart < 0)       { console.error('ERROR: BAD-Start Marker nicht gefunden'); process.exit(1); }
if (idxDriftPlaceholder < 0) { console.error('ERROR: DRIFT-Placeholder Marker nicht gefunden'); process.exit(1); }
if (idxHidden < 0)         { console.error('ERROR: Hidden Marker nicht gefunden'); process.exit(1); }

// Extract the BAD+FRISCHLUFT content (from BAD comment up to, not including, the DRIFT placeholder)
// But we need to include one leading newline (the empty line before the comment)
const badFrischStart = src.lastIndexOf('\n', idxBadStart - 1); // newline before comment
const badFrischContent = src.substring(badFrischStart, idxDriftPlaceholder);
// This content is:  \n\n                        {/* 4. Hygiene ... */}\n ... FRISCHLUFT ... </Grid>\n

console.log('✓ BAD+FRISCHLUFT Block extrahiert, Länge:', badFrischContent.length, 'chars');
console.log('  Beginnt mit:', JSON.stringify(badFrischContent.substring(0, 60)));
console.log('  Endet mit:  ', JSON.stringify(badFrischContent.substring(badFrischContent.length - 60)));

// ─── Build new file content ─────────────────────────────────────────────────
// Part 1: Everything up to (not including) the empty line before BAD comment
const part1 = src.substring(0, badFrischStart);

// Part 2: Close the mini-chart grid right after RAUM-MOB, keep DRIFT section unchanged
// The DRIFT-MONITOR placeholder was: {/* DRIFT-MONITOR vollbreite Karte */}\n</Grid>
// We replace it with just: </Grid>
const driftPlaceholderEnd = idxDriftPlaceholder + MARKER_DRIFT_PLACEHOLDER.length;
const part2 = '\n                    </Grid>'; // close mini-chart container (was opened at line ~588)

// Part 3: DRIFT-MONITOR actual block + hidden placeholder (unchanged)
// From after the DRIFT placeholder end to end of hidden placeholder line
const hiddenEnd = idxHidden + MARKER_HIDDEN.length;
const part3 = src.substring(driftPlaceholderEnd, hiddenEnd);

// Part 4: New <Grid container> wrapping BAD+FRISCHLUFT
// Re-indent: the content has 24-space indentation (6 levels), keep as-is in a new outer Grid container
const part4 = '\n\n                    {/* Weitere Gesundheitskacheln */}\n' +
              '                    <Grid container spacing={2} sx={{ mt: 2 }}>' +
              badFrischContent +
              '\n                    </Grid>';

// Part 5: Rest of file (closing tags etc.)
const part5 = src.substring(hiddenEnd);

const newSrc = part1 + part2 + part3 + part4 + part5;

console.log('');
console.log('Vorher Zeilen:', src.split('\n').length);
console.log('Nachher Zeilen:', newSrc.split('\n').length);

// Verify key markers in output
if (!newSrc.includes('RAUM-MOBIL')) { console.error('ERROR: RAUM-MOBILITÄT fehlt im Output!'); process.exit(1); }
if (!newSrc.includes('DRIFT-MONITOR')) { console.error('ERROR: DRIFT-MONITOR fehlt im Output!'); process.exit(1); }
if (!newSrc.includes('BAD-NUTZUNG')) { console.error('ERROR: BAD-NUTZUNG fehlt im Output!'); process.exit(1); }
if (!newSrc.includes('FRISCHLUFT')) { console.error('ERROR: FRISCHLUFT fehlt im Output!'); process.exit(1); }
if (!newSrc.includes('Weitere Gesundheitskacheln')) { console.error('ERROR: neuer Grid-Container fehlt!'); process.exit(1); }

// Check order: RAUM-MOB < DRIFT-MONITOR < BAD-NUTZUNG
const posRaum  = newSrc.indexOf('RAUM-MOBIL');
const posDrift = newSrc.indexOf('DRIFT-MONITOR');
const posBad   = newSrc.indexOf('BAD-NUTZUNG');
const posFrisch = newSrc.indexOf('FRISCHLUFT');
console.log('\nReihenfolge:');
console.log('  RAUM-MOBILITÄT @', posRaum);
console.log('  DRIFT-MONITOR  @', posDrift);
console.log('  BAD-NUTZUNG    @', posBad);
console.log('  FRISCHLUFT     @', posFrisch);
if (posRaum < posDrift && posDrift < posBad && posBad < posFrisch) {
    console.log('  ✓ Reihenfolge korrekt!');
} else {
    console.error('  ✗ Reihenfolge FALSCH!');
    process.exit(1);
}

// Restore CRLF and write
fs.writeFileSync(filePath, newSrc.replace(/\n/g, '\r\n'), 'utf8');
console.log('\n✓ Datei erfolgreich gespeichert.');
