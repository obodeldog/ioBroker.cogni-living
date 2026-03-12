const fs = require('fs');
['main.js', 'lib/main.js'].forEach(f => {
    let c = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
    // Remove the leftover old comment line
    const oldComment1 = '            // Fenster/T\u00fcr-\u00d6ffnungen: alle Sensoren mit fenster/haust\u00fcr/terrasse/balkon/window im Namen\n';
    const oldComment2 = /            \/\/ Fenster\/T.{1,5}r-\..{1,5}ffnungen: alle Sensoren mit fenster\/haust.{1,5}r\/terrasse\/balkon\/window im Namen\n/;
    if (c.match(oldComment2)) {
        c = c.replace(oldComment2, '');
        console.log(f + ': old comment removed');
    } else {
        console.log(f + ': no old comment found');
    }
    fs.writeFileSync(f, c.replace(/\n/g, '\r\n'), 'utf8');
});
