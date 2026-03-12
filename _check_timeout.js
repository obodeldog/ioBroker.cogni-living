const fs = require('fs');

// Check LongtermTrends component for timeout value
const src = fs.readFileSync('src-admin/src/components/tabs/LongtermTrendsView.tsx', 'utf8');
const lines = src.split('\n');

// Find timeout values
console.log('=== Timeout usages ===');
lines.forEach((l, i) => {
    if (l.includes('Timeout') || l.includes('timeout') || l.includes('30') || l.includes('30000')) {
        if (l.includes('30') || l.includes('time')) {
            console.log((i+1) + ': ' + l.trim());
        }
    }
});

// Also check python_bridge.js for timeout
const bridge = fs.readFileSync('lib/python_bridge.js', 'utf8');
const bridgeLines = bridge.split('\n');
console.log('\n=== python_bridge.js timeout ===');
bridgeLines.forEach((l, i) => {
    if (l.includes('timeout') || l.includes('Timeout') || l.includes('30000') || l.includes('ANALYZE_HEALTH')) {
        console.log((i+1) + ': ' + l.trim());
    }
});
