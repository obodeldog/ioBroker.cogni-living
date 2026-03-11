'use strict';
const fs = require('fs');
const file = 'src-admin/src/components/tabs/LongtermTrendsView.tsx';
let c = fs.readFileSync(file, 'utf8');

// The broken pattern: {/* keeps grid structure */  followed by newline+</Grid>
// Should be: {/* keeps grid structure */}  (self-closing empty element)
const idx = c.indexOf("keeps grid structure */");
if (idx < 0) { console.error('Not found'); process.exit(1); }

console.log('Context around error:', JSON.stringify(c.substring(idx - 30, idx + 80)));

// Replace the broken closing
const broken = "keeps grid structure */\n                    </Grid>";
const fixed  = "keeps grid structure */}</Grid>";
if (c.includes(broken)) {
    c = c.replace(broken, fixed);
    fs.writeFileSync(file, c, 'utf8');
    console.log('Fixed!');
} else {
    // Try CRLF
    const brokenCRLF = "keeps grid structure */\r\n                    </Grid>";
    if (c.includes(brokenCRLF)) {
        c = c.replace(brokenCRLF, fixed);
        fs.writeFileSync(file, c, 'utf8');
        console.log('Fixed (CRLF)!');
    } else {
        console.error('Pattern not found');
        console.log('Actual chars:', JSON.stringify(c.substring(idx, idx + 50)));
    }
}
