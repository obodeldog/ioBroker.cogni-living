// v0.33.339 Backend-Patches:
//  A) OC-PSA-CLAMP: preSleepAbsence gegen FINALES bedEntryTs klemmen (Bug 16.7. Marc-Schraffur)
//  B) OC-PLAUS-NZ v2: Near-Zero-Guard dichte-relativ (< 3 Trigger ODER < 0.5/h)
//  C) OC-PLAUS: Tiefschlaf-Schwelle klinisch (>70% -> >40%, Ohayon 2004 / AASM)
const fs = require('fs');
const path = 'src/main.js';
let raw = fs.readFileSync(path, 'utf8');
let changed = 0;

function replaceOnce(oldStr, newStr, tag) {
    const first = raw.indexOf(oldStr);
    if (first < 0) { console.error('FEHLER: Anker nicht gefunden -> ' + tag); process.exit(1); }
    if (raw.indexOf(oldStr, first + 1) >= 0) { console.error('FEHLER: Anker mehrdeutig -> ' + tag); process.exit(1); }
    raw = raw.replace(oldStr, newStr);
    changed++;
    console.log('OK: ' + tag);
}

// ---------- A) OC-PSA-CLAMP (Backend, per Person) ----------
if (raw.indexOf('[OC-PSA-CLAMP] Vor-Schlaf-Abwesenheit gegen FINALES') >= 0) {
    console.log('SKIP A: OC-PSA-CLAMP backend bereits vorhanden');
} else {
    const A_OLD = '                    result[person] = {';
    const A_NEW = [
        '                    // [OC-PSA-CLAMP] Vor-Schlaf-Abwesenheit gegen FINALES bedEntryTs klemmen.',
        '                    // Wird frueh (mit vorlaeufigem bedEntryTs) berechnet; danach kann bedEntryTs via',
        '                    // OC-BED-SYNC nach hinten wandern. Events die komplett VOR dem finalen bedEntryTs',
        '                    // enden gehoeren nicht auf den Schlafbalken (Bug 16.7.: 21:11-23:19 vor bedEntry 23:22).',
        '                    if (_pResult.bedEntryTs && Array.isArray(_pResult.preSleepAbsenceEvents) && _pResult.preSleepAbsenceEvents.length) {',
        '                        var _psaBe = _pResult.bedEntryTs;',
        '                        var _psaSs = _pResult.sleepWindowStart || null;',
        '                        _pResult.preSleepAbsenceEvents = _pResult.preSleepAbsenceEvents',
        '                            .filter(function(ev){ return ev && ev.end > _psaBe; })',
        '                            .map(function(ev){',
        '                                var _s = Math.max(ev.start, _psaBe);',
        '                                var _e = _psaSs ? Math.min(ev.end, _psaSs) : ev.end;',
        '                                return { start: _s, end: _e, durationMin: Math.max(1, Math.round((_e - _s)/60000)), source: ev.source };',
        '                            })',
        '                            .filter(function(ev){ return ev.end > ev.start; });',
        '                    }',
        '',
        '                    result[person] = {'
    ].join('\r\n');
    replaceOnce(A_OLD, A_NEW, 'A OC-PSA-CLAMP backend');
}

// ---------- B) OC-PLAUS-NZ v2 (dichte-relativ) ----------
if (raw.indexOf('[OC-PLAUS-NZ v2') >= 0) {
    console.log('SKIP B: OC-PLAUS-NZ v2 bereits vorhanden');
} else {
    const B_OLD = '                        if (_pVibCount < 2 && _pNzWinH > 3) {';
    const B_NEW = [
        '                        // [OC-PLAUS-NZ v2 16.7.] Dichte-relativ: < 3 Trigger gesamt ODER < 0.5 Trigger/h',
        '                        // in einem > 3h-Fenster. Echter Schlaefer erzeugt auf der Matratze deutlich mehr',
        '                        // (Umdrehen + Mikrovibration). Forensik Anni 16.7.: 2 Trigger in 9.5h (0.21/h).',
        '                        var _pNzRate = _pNzWinH > 0 ? (_pVibCount / _pNzWinH) : 0;',
        '                        if (_pNzWinH > 3 && (_pVibCount < 3 || _pNzRate < 0.5)) {'
    ].join('\r\n');
    replaceOnce(B_OLD, B_NEW, 'B OC-PLAUS-NZ v2');
}

// ---------- C) OC-PLAUS Tiefschlaf-Schwelle klinisch ----------
if (raw.indexOf('_pPlausDeep / _pPlausStages.length > 0.40') >= 0) {
    console.log('SKIP C: OC-PLAUS 40%-Schwelle bereits vorhanden');
} else {
    const C_OLD = '                        var _pPlausDistFail = (_pPlausDeep / _pPlausStages.length > 0.70) && (_pPlausRemPct < 0.02);';
    const C_NEW = [
        '                        // [16.7.] Klinik: Tiefschlaf (N3/SWS) macht bei gesunden Erwachsenen nur ~13-23% der',
        '                        // Gesamtschlafzeit aus (Ohayon 2004 / AASM). > 40% (= klin. Max ~23% + Sicherheitspuffer)',
        '                        // ist physiologisch unplausibel; die Dichte-Bedingung (AND) schuetzt echte Schlaefer.',
        '                        var _pPlausDistFail = (_pPlausDeep / _pPlausStages.length > 0.40) && (_pPlausRemPct < 0.02);'
    ].join('\r\n');
    replaceOnce(C_OLD, C_NEW, 'C OC-PLAUS 40%');
}

fs.writeFileSync(path, raw, 'utf8');
console.log('Backend-Patches angewendet: ' + changed);
