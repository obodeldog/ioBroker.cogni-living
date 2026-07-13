// [OC-VWC-LAST] vib_wake_cluster: LETZTES dichtes Cluster statt ERSTES.
const fs = require('fs');
const path = 'src/main.js';
let raw = fs.readFileSync(path, 'utf8');
const eol = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';

if (raw.indexOf('[OC-VWC-LAST]') >= 0) { console.log('Bereits gepatcht (OC-VWC-LAST).'); process.exit(0); }

// 1) Kommentarkopf ersetzen
const oldComment = "    // vib_wake_cluster: erste dichte Vib-Häufung in den letzten 90 Min (Aufwach-Muster-Erkennung)\r\n    // Mindestens 3 Vib-Events in einem 15-Min-Fenster = Person beginnt sich zu bewegen";
const oldCommentLF = oldComment.replace(/\r\n/g, '\n');
const newComment = [
    "    // vib_wake_cluster: LETZTE dichte Vib-Häufung vor dem Aufstehen (Aufwach-Muster-Erkennung).",
    "    // [OC-VWC-LAST] Vorher: ERSTES Cluster (>=3 Events in 15 Min) -> nahm oft das \"erste Zappeln\"",
    "    // (kurze REM-/Arousal-Bewegung mitten in der Nacht) als Aufwachzeit -> systematisch zu frueh",
    "    // (Beweis 13.7.: erstes Cluster 05:15 vs Garmin 06:20). Aktigraphie-Literatur (Cole-Kripke,",
    "    // Sadeh) definiert das Schlafende ueber den Beginn ANHALTENDER Aktivitaet, nicht ueber den",
    "    // ersten Ausschlag. Daher jetzt: das LETZTE dichte Cluster vor dem Aufstehen (naeher am",
    "    // finalen Aufwachen; 13.7. -> 06:28, 8 Min nach Garmin). Deckelung auf bedExit separat (Frontend)."
].join(eol);

let cnt1 = 0;
if (raw.indexOf(oldComment) >= 0) { raw = raw.replace(oldComment, newComment); cnt1 = 1; }
else if (raw.indexOf(oldCommentLF) >= 0) { raw = raw.replace(oldCommentLF, newComment.replace(/\r\n/g, '\n')); cnt1 = 1; }
else { console.error('FEHLER: Kommentarkopf nicht gefunden'); process.exit(1); }

// 2) break entfernen -> letztes Cluster behalten
const oldLoop = "            if (_vcCnt >= VWC_MIN) { _vibWakeClusterTs = _vct; break; }";
const newLoop = "            if (_vcCnt >= VWC_MIN) { _vibWakeClusterTs = _vct; } // [OC-VWC-LAST] kein break -> letztes qualifizierendes Cluster behalten";
if (raw.indexOf(oldLoop) < 0) { console.error('FEHLER: Loop-Zeile nicht gefunden'); process.exit(1); }
raw = raw.replace(oldLoop, newLoop);

fs.writeFileSync(path, raw, 'utf8');
console.log('OC-VWC-LAST angewendet (Kommentar:', cnt1, ', break entfernt).');
