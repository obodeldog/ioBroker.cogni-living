const fs = require('fs');

// Check health brain predict function
const healthBrain = fs.readFileSync('python_service/brains/health.py', 'utf8');
const lines = healthBrain.split('\n');

// Find predict function
console.log('=== predict function ===');
let inPredict = false;
let lineCount = 0;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('def predict')) {
        inPredict = true;
        lineCount = 0;
    }
    if (inPredict) {
        console.log((i+1) + ': ' + lines[i]);
        lineCount++;
        if (lineCount > 50) break;
        if (lineCount > 5 && lines[i].includes('def ') && !lines[i].includes('def predict')) break;
    }
}

// Find score calculation
console.log('\n=== score_samples / decision_function ===');
lines.forEach((l, i) => {
    if (l.includes('score') || l.includes('isolation') || l.includes('0.1') || l.includes('anomaly')) {
        if (!l.trim().startsWith('#')) {
            console.log((i+1) + ': ' + l.trim());
        }
    }
});
