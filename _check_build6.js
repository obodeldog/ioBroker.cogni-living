const fs = require('fs');
const build = fs.readFileSync('src-admin/build/assets/index-BFqMvlVM.js', 'utf8');

// Find where Qt (processEvents) is called
// Qt is defined as: const Qt = fe => {
// Look for Qt( calls
console.log('=== Qt( calls (processEvents invocations) ===');
let idx = 0, count = 0;
while ((idx = build.indexOf('Qt(', idx)) >= 0 && count < 10) {
    const ctx = build.substring(idx - 60, idx + 100);
    // filter: only the ones that look like function calls, not definitions
    if (!ctx.includes('const Qt')) {
        console.log('At ' + idx + ': ...' + ctx + '...');
        count++;
    }
    idx++;
}

// Now let's find the fetchData function body - look for getOverviewData call
console.log('\n=== getOverviewData call in fetchData ===');
idx = build.indexOf('getOverviewData');
while (idx >= 0 && count < 5) {
    console.log('At ' + idx + ': ...' + build.substring(idx - 30, idx + 200) + '...');
    idx = build.indexOf('getOverviewData', idx + 1);
    count++;
}
