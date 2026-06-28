const fs = require('fs');
const path = require('path');
const bsPath = path.join(__dirname, '..', '_internal', 'BRAINSTORMING.md');
let content = fs.readFileSync(bsPath, 'utf8');

const INSERT = `## \u{1F6A7} OC-VIB-CAL-PREWAKE: Kalibrierung nur aus echten Schlaf-Events (nicht Aufsteh-Bewegungen) (28.06.2026)

**Hintergrund / Was bisher passiert:**
Die Vibrations-Kalibrierung berechnet pro Nacht die St\u00e4rke-Metriken (\`vibStrMax\`, \`vibStrP90\`)
aus ALLEN Events im Schlaffenster (stagesWinStart bis stagesWinEnd).
Das Schlaffenster endet jedoch erst WENN die Person aufsteht (= bedExitTs / sleepWindowEnd).
Aufsteh-Bewegungen (z.B. 06:43 Uhr, St\u00e4rke 71, 70, 69 drei Events hintereinander) liegen
damit noch IM Schlaffenster und werden in die Kalibrierung einbezogen.

**Warum das ein Problem ist:**
Aufsteh-Bewegungen sind physikalisch viel st\u00e4rker als Wach-im-Bett-liegen.
Ergebnis: Die kalibrierten Schwellen ("Wake-Schwelle > X") orientieren sich an der Aufsteh-Intensit\u00e4t,
nicht an der Wachliege-Intensit\u00e4t. Wake-Erkennung w\u00e4hrend des Schlafs wird damit praktisch unm\u00f6glich.

**Konkretes Beispiel (Marc, 25./26.06.2026):**
- Aufsteh-Events um 06:43: St\u00e4rke 71, 70, 69
- \u00dcbriger Schlaf: max. 47
- Ergebnis: vibStrMax dieser Nacht = 71 (wegen Aufstehen)
- Kalibrierung (P90 \u00fcber 14 N\u00e4chte) = ~63 \u2192 Wake-Schwelle = 72
- Realistische Wake-Schwelle ohne Aufstehen w\u00e4re ~47 \u2192 Wake-Schwelle = ~54

**Was v0.33.326 macht (Zwischenl\u00f6sung):**
\`vibStrP90\` (90. Perzentil statt Max) reduziert den Einfluss von Ausrei\u00dfern statistisch.
Bei wenigen Events (Marc: 23/Nacht) reicht das oft, da die 3 Aufsteh-Events im Top-10% landen
und durch P90 herausfallen. Bei Kunden mit 100+ Events/Nacht ist der Effekt schw\u00e4cher.

**Echte L\u00f6sung (OC-VIB-CAL-PREWAKE):**
\`nightVibrationStrengthP90\` und \`nightVibrationStrengthMax\` nur aus Events berechnen,
deren Timestamp VOR dem erkannten \`wakeTs\` (Aufwachzeit) liegt.

Implementierung:
1. Im Berechnungsblock f\u00fcr per-Person VibStr (L4372ff in src/main.js):
   Zus\u00e4tzlichen Pre-Wake-Filter einf\u00fchren:
   \`\`\`javascript
   var _preWakeCap = _pResult.sleepWindowEnd || null; // wakeTs ~ sleepWindowEnd
   // In der personEvents.forEach Schleife:
   if (_preWakeCap && ts > _preWakeCap - (30 * 60000)) return; // letzte 30 min = Aufsteh-Phase
   \`\`\`
2. Gesonderte Metriken \`_pVibStrMaxPreWake\` und \`_pVibStrP90PreWake\` speichern.
3. In Kalibrierungsbuffer \`vibStrP90PreWake\` statt \`vibStrP90\` f\u00fcr Schwellen-Berechnung verwenden.

**Achtung (Sequenz-Problem):**
\`wakeTs\` muss bekannt sein bevor die VibStr-Berechnung l\u00e4uft.
In der aktuellen Architektur: wakeTs = \`pd.sleepWindowEnd\` ist nach Abschluss von
\`computePersonSleep()\` verf\u00fcgbar. Der VibStr-Per-Person-Block (L4372ff) l\u00e4uft im
globalen Per-Person-Loop NACH \`computePersonSleep()\`, hat also Zugriff auf \`pd.sleepWindowEnd\`.
Das Sequenz-Problem ist damit LOESBAR ohne grosse Umstrukturierung.

**Erwarteter Effekt nach Fix:**
Marc: Wake-Schwelle sinkt von ~72 auf ~54 \u2192 Events mit St\u00e4rke >54 w\u00fcrden als Wake klassifiziert.
Da Marcs Max im reinen Schlaf ~47 betr\u00e4gt, k\u00f6nnten dann noch keine Wake-Events detektiert werden.
Fazit: Der Sensor ist NICHT falsch kalibriert \u2014 er ist physikalisch zu leise f\u00fcr Wake-Erkennung.
Der Sensor-Hinweis (OC-VIB-CAL-P90, v0.33.326) w\u00fcrde dann korrekt ausgel\u00f6st.

---

`;

// Einfuegen nach dem zweiten --- Block (nach den 2 bereits eingefuegten Konzepten)
const marker = '---\n\n## \uD83D\uDEA7 OC-BED-FINAL';
const pos = content.indexOf(marker);
if (pos < 0) { 
    // Fallback: nach erstem --- nach Header
    const pos2 = content.indexOf('---\n\n##');
    if (pos2 < 0) { console.error('Einfuegeposition nicht gefunden'); process.exit(1); }
    const insertAt = pos2 + 5;
    content = content.substring(0, insertAt) + '\n' + INSERT + content.substring(insertAt);
} else {
    content = content.substring(0, pos + 5) + '\n' + INSERT + content.substring(pos + 5);
}

fs.writeFileSync(bsPath, content);
console.log('BRAINSTORMING.md: OC-VIB-CAL-PREWAKE dokumentiert');
