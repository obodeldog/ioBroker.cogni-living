const fs = require('fs');
const build = fs.readFileSync('src-admin/build/assets/index-CBIshDQD.js', 'utf8');

// Check that the fix is in the build
console.log('=== Verifying fixes ===');

// 1. Should have safe name check
const hasNameFix = build.includes('||\\"\\")') || build.includes("||'')") || build.includes('||"")');
const kitchenSafe = build.indexOf('toLowerCase().includes("küche")');
const kitchenIdx = build.lastIndexOf('toLowerCase().includes("küche")');

// Search for the processEvents context
const doorCheckIdx = build.indexOf('type==="door"&&');
if (doorCheckIdx >= 0) {
    console.log('Found type==="door" in processEvents at', doorCheckIdx);
    // Show context to see if name check is safe
    const context = build.substring(doorCheckIdx, doorCheckIdx + 500);
    console.log('Context:', context);
}

// 2. Should NOT have nameLower.includes
console.log('\nnameLower.includes in build:', build.includes('nameLower.includes'), '(should be false)');

// 3. Check for null-safe name access
const nullSafeCount = (build.match(/\|\|""\)\.toLowerCase\(\)/g) || []).length;
console.log('Null-safe toLowerCase calls:', nullSafeCount, '(should be > 0)');

// Build file size
const stats = fs.statSync('src-admin/build/assets/index-CBIshDQD.js');
console.log('Build file size:', Math.round(stats.size/1024), 'KB');
