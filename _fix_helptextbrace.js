const fs = require('fs');
const path = 'src-admin/src/components/tabs/HealthTab.tsx';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Pettenkofer-Zahl') && lines[i].includes('helpText')) {
        console.log('BEFORE: ' + lines[i].substring(lines[i].indexOf('Pettenkofer') - 5));
        // Replace ."> with ."}>
        lines[i] = lines[i].replace('.">',  '."}>');
        console.log('AFTER:  ' + lines[i].substring(lines[i].indexOf('Pettenkofer') - 5));
        break;
    }
}
fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Done');
