const fs = require('fs');
let src = fs.readFileSync('src/main.js', 'utf8');

// saveDailyHistory: has spaces around the ternary
const OLD1 = 'loo_accuracy: (_pyClassInfo.loo_accuracy!=null?_pyClassInfo.loo_accuracy:null) } : null;';
const NEW1 = 'loo_accuracy: (_pyClassInfo.loo_accuracy!=null?_pyClassInfo.loo_accuracy:null), confusion_matrix: (_pyClassInfo.confusion_matrix||null) } : null;';
if (src.includes(OLD1)) { src = src.replace(OLD1, NEW1); console.log('CM1 OK: saveDailyHistory'); }
else { console.error('FEHLER CM1 nicht gefunden'); process.exit(1); }

// reanalyzeSexDay: already patched above, verify
const count2 = (src.match(/confusion_matrix/g)||[]).length;
console.log('confusion_matrix Vorkommen:', count2, '(erwartet: 2)');

fs.writeFileSync('src/main.js', src, 'utf8');
console.log('src/main.js gespeichert.');
