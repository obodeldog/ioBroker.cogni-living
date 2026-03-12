const fs = require('fs');
const path = 'PROJEKT_STATUS.md';
const lines = fs.readFileSync(path, 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Fresh Air Z') && lines[i].includes('door') && lines[i].includes('Keyword')) {
        lines[i] = lines[i].replace('Jetzt via `e.type === \'door\'` \u2014 kein Keyword-Matching mehr |',
            'Via `e.type === \'door\'` \u2014 kein Keyword-Matching mehr. Auch Live-Pfad (HealthTab) gefixt. |');
        lines.splice(i + 1, 0, "|| Fresh Air Sto\u00DFl\u00FCftungs-Z\u00E4hler | \u2705 | `freshAirLongCount` = \u00D6ffnungen \u22655 Min. Gespeichert im Daily-Snapshot, in Kachel angezeigt. |");
        console.log('OK: Fresh Air Zeile aktualisiert');
        break;
    }
}
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Fresh Air Mindestdauer') && lines[i].includes('Noch NICHT implementiert')) {
        lines[i] = '|| \uD83D\uDFE2 Erledigt | **Fresh Air: Stoßlüftungs-Zähler** | `freshAirLongCount` berechnet und angezeigt. Forschungsbasis: DIN EN 15251, Pettenkofer-Zahl. |';
        console.log('OK: Offene Baustelle Fresh Air entfernt/ersetzt');
        break;
    }
}
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('v0.31.0') && lines[i].includes('6e2d231')) {
        lines.splice(i, 0, '|| **v0.31.1** | ausstehend | Fresh Air Live-Pfad Fix; Sto\u00DFl\u00FCftungs-Z\u00E4hler (\u22655 Min) |');
        console.log('OK: Versionshistorie aktualisiert');
        break;
    }
}
fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Done');
