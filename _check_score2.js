const fs = require('fs');

// Check health_brain.predict function
let healthBrainPath = '';
// Find health brain file
const files = fs.readdirSync('python_service/');
console.log('Python service files:', files);

// Check the main service file for health brain
const py = fs.readFileSync('python_service/service.py', 'utf8');
const lines = py.split('\n');

// Find health_brain
console.log('\n=== health_brain references ===');
lines.forEach((l, i) => {
    if (l.includes('health_brain') || l.includes('HealthBrain') || l.includes('health_brain =')) {
        console.log((i+1) + ': ' + l.trim());
    }
});

// Check imports
console.log('\n=== imports ===');
for (let i = 0; i < 30; i++) {
    if (lines[i].includes('import') || lines[i].includes('from')) {
        console.log((i+1) + ': ' + lines[i].trim());
    }
}
