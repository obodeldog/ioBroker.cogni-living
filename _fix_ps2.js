const fs = require('fs');
const lines = fs.readFileSync('PROJEKT_STATUS.md', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Mindestdauer') && lines[i].includes('Noch NICHT')) {
        lines[i] = '| \u2705 Erledigt | **Fresh Air: Sto\u00DFl\u00FCftungs-Z\u00E4hler** | `freshAirLongCount` = \u00D6ffnungen \u22655 Min. Kachel zeigt "davon Nx \u22655 Min (Empf.: 3\u00D7)". Forschungsbasis: DIN EN 15251, Pettenkofer-Zahl. |';
        console.log('OK: Zeile ' + (i+1) + ' aktualisiert');
    }
    if (lines[i].includes('Fresh Air Mindestdauer') && lines[i].includes('5-Min')) {
        lines[i] = '> **Naechster Schritt: Aktivitaetsbelastung-Normalisierung** \u2014 Alle Balken zeigen 100%. Letztes \u26A0\uFE0F-Item in der Gesundheits-Roadmap.';
        console.log('OK: Zeile ' + (i+1) + ' aktualisiert');
    }
}
fs.writeFileSync('PROJEKT_STATUS.md', lines.join('\n'), 'utf8');
console.log('Done');
