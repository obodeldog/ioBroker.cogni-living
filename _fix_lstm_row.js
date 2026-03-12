const fs = require('fs');
const f = 'src-admin/src/components/tabs/SystemTab.tsx';
let src = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// Fix the LSTM Row - escaped quotes in JSX attr values are invalid
// Find the line and replace it
const oldLine = `                            <Row status="planned" label="LSTM Sequenz-Vorhersage" detail="\\"Um 07:30 erwarte ich K\u00fcche\\" \u2014 zeitliche Anomalie-Erkennung" />`;
const newLine = `                            <Row status="planned" label="LSTM Sequenz-Vorhersage" detail={'"\u00dcm 07:30 erwarte ich K\u00fcche" \u2014 zeitliche Anomalie-Erkennung'} />`;

if (!src.includes(oldLine)) {
    // Try alternative search
    const idx = src.indexOf('LSTM Sequenz-Vorhersage');
    if (idx > -1) {
        const lineStart = src.lastIndexOf('\n', idx) + 1;
        const lineEnd   = src.indexOf('\n', idx);
        const found = src.substring(lineStart, lineEnd);
        console.log('Found LSTM line:', JSON.stringify(found));
        // Replace the whole line
        src = src.substring(0, lineStart) +
              `                            <Row status="planned" label="LSTM Sequenz-Vorhersage" detail={'"Um 07:30 erwarte ich K\u00fcche" \u2014 zeitliche Anomalie-Erkennung'} />` +
              src.substring(lineEnd);
        console.log('Replaced via index');
    } else {
        console.error('LSTM line not found at all');
        process.exit(1);
    }
} else {
    src = src.replace(oldLine, newLine);
    console.log('Replaced via direct match');
}

// Also fix: Raumaktivität &amp; Heatmap → use proper JSX text
// In JSX, &amp; in attribute values is fine, but let's verify the build
// Also fix: Module &amp; System-Status title
// In JSX JSX text nodes: & should be fine, but in attributes: &amp; should be literal &

fs.writeFileSync(f, src.replace(/\n/g, '\r\n'), 'utf8');
console.log('Saved');
