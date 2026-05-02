const fs = require('fs');
const p = require('path').join(__dirname, '..', 'src', 'lib', 'pwa_sleep_tile_build.js');
let c = fs.readFileSync(p, 'utf8');
c = c.replace(
    /return '[^']+' \+ s\.name \+ \(s\.location/,
    "return '  \\u2022 ' + s.name + (s.location"
);
fs.writeFileSync(p, c, 'utf8');
console.log('fixed bullet');
