const fs = require('fs');

// Check package.json for main entry
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
console.log('package.json main:', pkg.main);

// Check io-package.json
const ioPkg = JSON.parse(fs.readFileSync('io-package.json', 'utf8'));
console.log('io-package.json main:', ioPkg.common?.main);

// Show lines 330-365 of lib/main.js (the duplicate block)
const libMain = fs.readFileSync('lib/main.js', 'utf8');
const libLines = libMain.split('\n');
console.log('\n=== lib/main.js lines 325-365 (duplicate block) ===');
for (let i = 324; i < 365; i++) {
    console.log((i+1) + ': ' + libLines[i]);
}

// Try to require lib/main.js to see if there's a syntax error
console.log('\n=== Syntax check lib/main.js via require() ===');
try {
    require('./lib/main.js');
    console.log('No syntax error (but may have runtime errors)');
} catch(e) {
    console.log('ERROR:', e.constructor.name + ': ' + e.message);
    if (e.stack) console.log(e.stack.split('\n').slice(0,5).join('\n'));
}
