const fs = require('fs');

// Check Python service for anomaly score calculation
const py = fs.readFileSync('python_service/service.py', 'utf8');
const lines = py.split('\n');

// Find ANALYZE_HEALTH handler and score calculation
console.log('=== ANALYZE_HEALTH handler ===');
let inHandler = false;
let count = 0;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('ANALYZE_HEALTH') || lines[i].includes('analyze_health')) {
        console.log('Found at line ' + (i+1));
        for (let j = i; j < Math.min(lines.length, i + 80); j++) {
            console.log((j+1) + ': ' + lines[j]);
            if (j > i && (lines[j].includes('def ') || lines[j].includes('elif ') || lines[j].includes("'type':")) && j > i + 5) break;
        }
        console.log('---');
        count++;
        if (count >= 2) break;
    }
}

// Check for anomaly_score calculation
console.log('\n=== anomaly_score calculation ===');
lines.forEach((l, i) => {
    if (l.includes('anomaly_score') || l.includes('score_samples') || l.includes('decision_function')) {
        console.log((i+1) + ': ' + l.trim());
    }
});
