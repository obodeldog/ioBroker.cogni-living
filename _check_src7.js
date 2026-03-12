const fs = require('fs');

// Check both main.js files for syntax errors
for (const file of ['main.js', 'lib/main.js']) {
    console.log('\n=== Checking ' + file + ' ===');
    try {
        const src = fs.readFileSync(file, 'utf8');
        // Try to require syntax check via new Function (won't work for modules)
        // Instead, check for duplicate const declarations
        const lines = src.split('\n');
        const constDecls = {};
        lines.forEach((l, i) => {
            const m = l.match(/^\s+const\s+(\w+)\s*=/);
            if (m) {
                const name = m[1];
                if (constDecls[name]) {
                    console.log('DUPLICATE const: ' + name + ' at line ' + (i+1) + ' (first at line ' + constDecls[name] + ')');
                } else {
                    constDecls[name] = i+1;
                }
            }
        });
        
        // Count occurrences of key strings
        console.log('FRESH_AIR_MIN_MS occurrences: ' + (src.match(/FRESH_AIR_MIN_MS/g) || []).length);
        console.log('doorEventsToday occurrences: ' + (src.match(/const doorEventsToday/g) || []).length);
        console.log('freshAirLongCount occurrences: ' + (src.match(/let freshAirLongCount/g) || []).length);
        console.log('openMap occurrences: ' + (src.match(/const openMap/g) || []).length);
        
    } catch(e) {
        console.log('Error reading file: ' + e.message);
    }
}
