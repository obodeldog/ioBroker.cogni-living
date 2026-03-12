const fs = require('fs');
const tabs = ['ComfortTab', 'SecurityTab', 'EnergyTab'];
tabs.forEach(tab => {
    const path = 'src-admin/src/components/tabs/' + tab + '.tsx';
    try {
        const src = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
        const lines = src.split('\n');
        console.log('\n=== ' + tab + ' (' + lines.length + ' Zeilen) ===');
        lines.forEach((l, i) => {
            const t = l.trim();
            if (t.length > 5 && (t.startsWith('<Typography') || t.includes('variant="h') || t.includes('overline') || t.includes('subtitle1') || t.includes('fontWeight') || t.includes('Paper sx') || t.includes('section') || t.includes('Modul') || t.includes('PINN') || t.includes('KI') || t.includes('Sicherheit') || t.includes('Energie') || t.includes('Komfort'))) {
                if (!t.includes('//') && t.length < 120) {
                    console.log('  L' + (i+1) + ': ' + t.substring(0, 100));
                }
            }
        });
    } catch(e) {
        console.log(tab + ': Datei nicht gefunden');
    }
});
