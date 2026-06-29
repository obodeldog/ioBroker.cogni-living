/**
 * Patch: Sex-Gruppen-Schleife in src/main.js einbauen (Option A)
 * 
 * Transformiert die einmalige Sex-Detection in eine Gruppen-Schleife:
 * - sexGroups Config → Array von Gruppen mit personTags + confirmed18
 * - Pro Gruppe: eigener _sexPersonTagsSet, eigene Events, eigene Kalibrierung
 * - Ergebnis: intimacyEventsByGroup + sexCalibInfoByGroup im History-Snapshot
 * - Backward-Compat: intimacyEvents = erste Gruppe
 */

const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, '..', 'src', 'main.js');
let code = fs.readFileSync(mainPath, 'utf8');
const originalLen = code.length;

function replaceOnce(src, oldStr, newStr, label) {
    const idx = src.indexOf(oldStr);
    if (idx === -1) { console.error('NICHT GEFUNDEN: ' + label); process.exit(1); }
    const count = src.split(oldStr).length - 1;
    if (count > 1) { console.warn('WARNUNG: "' + label + '" kommt ' + count + 'x vor - ersetze erstes'); }
    return src.slice(0, idx) + newStr + src.slice(idx + oldStr.length);
}

// ===== SCHRITT 1: Outer vars ergänzen + calibB entfernen =====
code = replaceOnce(code,
    `var intimacyEvents = [];
            var _calibInfo = { src: 'default', n: 0, calibA: 50, calibB: 30 };`,
    `var intimacyEvents = [];
            var intimacyEventsByGroup = {};
            var sexCalibInfoByGroup = {};
            var _calibInfo = { src: 'default', n: 0, calibA: 50 };`,
    'outer vars + calibB entfernen'
);
console.log('✓ Schritt 1: Outer vars ergänzt');

// ===== SCHRITT 2: moduleSex if + try → Group-Loop Wrapper =====
// Marker: der erste Kommentar nach dem try-{
const TRY_MARKER = 'if (this.config.moduleSex === true) {\n                try {\n                    // Kalibrierte oder Standard-Schwellen (aus native config oder Defaults)\n                    // --- ADAPTIVE KALIBRIERUNG (OC-SEX) ---';
const TRY_REPLACEMENT = `if (this.config.moduleSex === true) {
                // [OC-SEX-GROUPS] Sex-Gruppen aus Config parsen
                var _sexGroupsList = [];
                try {
                    var _sgRaw = (this.config.sexGroups || '').trim();
                    if (_sgRaw) _sexGroupsList = JSON.parse(_sgRaw);
                } catch(_sgParseE) { this.log.debug('[OC-SEX] sexGroups parse: ' + _sgParseE.message); }
                if (!_sexGroupsList.length) {
                    // Fallback: Legacy sexPersonTags als einzige Gruppe
                    _sexGroupsList = [{
                        id: 'default',
                        name: 'Hauptgruppe',
                        personTags: (this.config.sexPersonTags || '').split(',').map(function(s){return s.trim();}).filter(Boolean),
                        confirmed18: true
                    }];
                }
                for (var _grpLoopIdx = 0; _grpLoopIdx < _sexGroupsList.length; _grpLoopIdx++) {
                    var _curSexGroup = _sexGroupsList[_grpLoopIdx];
                    if (!_curSexGroup.confirmed18) continue; // DSGVO-Gate: unbestätigte Gruppen überspringen
                    var _grpIE = [];  // per-Gruppe intimacyEvents
                    var _grpCI = { src: 'default', n: 0, calibA: 50 }; // per-Gruppe calibInfo
                    try {
                    // Kalibrierte oder Standard-Schwellen (aus native config oder Defaults)
                    // --- ADAPTIVE KALIBRIERUNG (OC-SEX) ---`;
code = replaceOnce(code, TRY_MARKER, TRY_REPLACEMENT, 'moduleSex try-Öffner');
console.log('✓ Schritt 2: Group-Loop Wrapper Öffner eingefügt');

// ===== SCHRITT 3: _sexPersonTagsSet init → Gruppen-personTags =====
code = replaceOnce(code,
    `var _sexPersonTagsSet = new Set((this.config.sexPersonTags || '').split(',').map(function(s){return s.trim();}).filter(Boolean));`,
    `var _sexPersonTagsSet = new Set((_curSexGroup.personTags || []).filter(Boolean));`,
    '_sexPersonTagsSet init'
);
console.log('✓ Schritt 3: _sexPersonTagsSet auf Gruppen-personTags umgestellt');

// ===== SCHRITT 4: inneres _calibInfo = {...} → _grpCI =====
// Das ist die INNER Zuweisung (nicht die outer var init)
code = replaceOnce(code,
    `var _calibInfo = { src: _calibSrc, n: _calibN, calibA: _calibA };`,
    `_grpCI = { src: _calibSrc, n: _calibN, calibA: _calibA };`,
    'innere _calibInfo Zuweisung'
);
console.log('✓ Schritt 4: innere _calibInfo-Zuweisung → _grpCI');

// ===== SCHRITT 5: _calibInfo.pyClassifier → _grpCI.pyClassifier (3x) =====
code = code.replace(/_calibInfo\.pyClassifier/g, '_grpCI.pyClassifier');
console.log('✓ Schritt 5: _calibInfo.pyClassifier → _grpCI.pyClassifier (' + (code.match(/_grpCI\.pyClassifier/g)||[]).length + 'x ersetzt)');

// ===== SCHRITT 6: intimacyEvents INNERHALB der try-Blöcke → _grpIE =====
// Strategie: Nur die Vorkommen INNERHALB des try-Blocks ersetzen.
// Wir wissen: intimacyEvents.push/sort/map/filter inside try = replace
//             Außerhalb (Dedup, Nullnummer-Filter) = NICHT ersetzen
//
// Vorkommen in der try-Block (basierend auf vorheriger Analyse, block-Offsets < 31000):
// Alle Vorkommen im try-Block (Detection):
const innerPatterns = [
    // Zuweisung und Operationen direkt auf dem Array
    `intimacyEvents.push(`,
    `intimacyEvents.sort(`,
    `_gmi < intimacyEvents.length`,
    `var _gCur = intimacyEvents[_gmi]`,
    `_gMerged.length < intimacyEvents.length`,
    `intimacyEvents.length + ' ? ' + _gMerged.length`,
    `_gMerged.length + ' Session(s)'); intimacyEvents = _gMerged; }`,
    `var _pyPredSess = intimacyEvents.map(`,
    `if (!intimacyEvents[i]) return;`,
    `intimacyEvents[i] = null;`,
    `intimacyEvents[i].type = r.type;`,
    `intimacyEvents[i].pyConf = `,
    // beide Filter-Zeilen nach Python-Klassifikation
    `intimacyEvents = intimacyEvents.filter(function(e){ return e !== null`,
    `if(intimacyEvents.length>0){`,
    `this.log.info('[OC-SEX] '+intimacyEvents.length+' Event(s) erkannt. calibA='`,
    `calibA='+_calibA+' Scores: '+intimacyEvents.map(`,
    // die zweite filter-Zeile (Nullnummer-Vorab-Check)
];

// Sonderbehandlung für die zwei fast-identischen filter-Zeilen vor Nullnummer-Filter:
// Position-basiertes Replacement für die try-internen Vorkommen
// Wir nutzen einen Boundary-Marker: nach `[OC-SEX] Neustart-Schutz`
// alles DAVOR (im try) soll ersetzt werden

// Finde die Position des catch-Blocks
const CATCH_MARKER = '} catch(_intimErr) {\n                    this.log.warn(\'[OC-SEX] Fehler bei Intimacy-Detection';

const catchIdx = code.indexOf(CATCH_MARKER);
if (catchIdx === -1) { console.error('catch-Marker nicht gefunden!'); process.exit(1); }
console.log('  try-Block endet bei Index: ' + catchIdx);

// Trenne in: before-try-block | try-block-content | rest
const tryOpenMarker = 'var _grpIE = [];  // per-Gruppe intimacyEvents';
const tryOpenIdx = code.indexOf(tryOpenMarker);
if (tryOpenIdx === -1) { console.error('try-Open-Marker nicht gefunden!'); process.exit(1); }

// Der try-Block-Content liegt zwischen tryOpenIdx und catchIdx
const beforeTry = code.slice(0, tryOpenIdx);
let tryContent = code.slice(tryOpenIdx, catchIdx);
const afterCatch = code.slice(catchIdx);

// Ersetze alle intimacyEvents im try-Content → _grpIE
const countBefore = (tryContent.match(/intimacyEvents/g) || []).length;
tryContent = tryContent.replace(/\bintimacyEvents\b/g, '_grpIE');
const countAfter = (tryContent.match(/_grpIE/g) || []).length;
console.log(`✓ Schritt 6: ${countBefore} → ${countAfter} intimacyEvents→_grpIE im try-Block`);

// Reassemble
code = beforeTry + tryContent + afterCatch;

// ===== SCHRITT 7: catch-Block modifizieren + Loop-Abschluss hinzufügen =====
// Ändere den catch-Error-Text für besseres Debugging
code = replaceOnce(code,
    `} catch(_intimErr) {\n                    this.log.warn('[OC-SEX] Fehler bei Intimacy-Detection: '+_intimErr.message);\n                }\n            }`,
    `} catch(_intimErr) {
                        this.log.warn('[OC-SEX-GROUP] ' + (_curSexGroup.id||'?') + ': ' + _intimErr.message);
                    }
                    // Gruppen-Ergebnis sichern
                    var _grpId = _curSexGroup.id || ('group' + _grpLoopIdx);
                    intimacyEventsByGroup[_grpId] = _grpIE;
                    sexCalibInfoByGroup[_grpId] = _grpCI;
                } // end for-group-loop
                // Backward-Compat: erste Gruppe = intimacyEvents + _calibInfo
                var _fbGrpKeys = Object.keys(intimacyEventsByGroup);
                if (_fbGrpKeys.length > 0) {
                    intimacyEvents = intimacyEventsByGroup[_fbGrpKeys[0]] || [];
                    _calibInfo = sexCalibInfoByGroup[_fbGrpKeys[0]] || _calibInfo;
                }
            }`,
    'catch + loop-Abschluss + backward-compat'
);
console.log('✓ Schritt 7: Loop-Abschluss + Backward-Compat eingefügt');

// ===== SCHRITT 8: intimacyEventsByGroup + sexCalibInfoByGroup im History-Snapshot =====
code = replaceOnce(code,
    `intimacyEvents: intimacyEvents,
                sexCalibInfo: _calibInfo,`,
    `intimacyEvents: intimacyEvents,
                intimacyEventsByGroup: intimacyEventsByGroup,
                sexCalibInfo: _calibInfo,
                sexCalibInfoByGroup: sexCalibInfoByGroup,`,
    'History-Snapshot intimacyEventsByGroup'
);
console.log('✓ Schritt 8: intimacyEventsByGroup im History-Snapshot ergänzt');

// ===== SCHRITT 9: Dedup-Code: auch intimacyEventsByGroup dedupen =====
// Nach dem Dedup: intimacyEventsByGroup aktualisieren (erste Gruppe = intimacyEvents)
const DEDUP_LOG = `this.log.info('[OC-SEX] Dedup: ' + (_ddBefore - intimacyEvents.length) + ' doppeltes Event(s) aus ' + _ddPrevStr + '.json gefiltert (Event gehoert zum Vortag)');`;
const dedupLogIdx = code.indexOf(DEDUP_LOG);
if (dedupLogIdx === -1) {
    console.warn('WARNUNG: Dedup-Log-Marker nicht gefunden, Schritt 9 übersprungen');
} else {
    const syncCode = `
                    // Sync: erste Gruppe in intimacyEventsByGroup nach Dedup aktualisieren
                    var _fbGrpKeys2 = Object.keys(intimacyEventsByGroup);
                    if (_fbGrpKeys2.length > 0) intimacyEventsByGroup[_fbGrpKeys2[0]] = intimacyEvents;`;
    code = code.slice(0, dedupLogIdx + DEDUP_LOG.length) + syncCode + code.slice(dedupLogIdx + DEDUP_LOG.length);
    console.log('✓ Schritt 9: Dedup-Sync für intimacyEventsByGroup eingefügt');
}

// ===== Validierung =====
const newLen = code.length;
console.log('\n=== VALIDIERUNG ===');
console.log('Länge vorher: ' + originalLen + ' → nachher: ' + newLen + ' (diff: ' + (newLen - originalLen) + ')');
console.log('intimacyEventsByGroup Vorkommen: ' + (code.match(/intimacyEventsByGroup/g)||[]).length);
console.log('_grpIE Vorkommen: ' + (code.match(/_grpIE/g)||[]).length);
console.log('_grpCI Vorkommen: ' + (code.match(/_grpCI/g)||[]).length);
console.log('_curSexGroup Vorkommen: ' + (code.match(/_curSexGroup/g)||[]).length);
console.log('sexGroups Vorkommen: ' + (code.match(/sexGroups/g)||[]).length);

// Schreiben
fs.writeFileSync(mainPath, code, 'utf8');
console.log('\n✅ src/main.js erfolgreich gepatcht!');
