const fs = require('fs');
const build = fs.readFileSync('src-admin/build/assets/index-BFqMvlVM.js', 'utf8');

// Show context around getOverviewData call
const idx = build.indexOf('getOverviewData');
console.log('=== getOverviewData call in build (800 chars) ===');
console.log(build.substring(idx - 100, idx + 800));

// Also look for where processEvents (Qt) is called from fetchData context
// fetchData calls socket.sendTo with getOverviewData
// The build Qt call at 2303390 is in loadHistory  
// The build Qt call at 2309955 is in loadWeekData
// Is there a Qt call near getOverviewData?
console.log('\n=== Qt calls near getOverviewData ===');
const ovIdx = build.indexOf('getOverviewData');
const range = build.substring(ovIdx, ovIdx + 2000);
const qtPos = range.indexOf('Qt(');
if (qtPos >= 0) {
    console.log('Qt found at offset ' + qtPos + ' within getOverviewData context:');
    console.log(range.substring(qtPos - 50, qtPos + 150));
} else {
    console.log('Qt NOT found within 2000 chars of getOverviewData!');
}

// Check what is at 2309955 (where Qt is called from loadWeekData)
console.log('\n=== Qt call at 2309955 context ===');
console.log(build.substring(2309800, 2310100));
