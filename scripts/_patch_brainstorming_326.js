const fs = require('fs');
const path = require('path');
const bsPath = path.join(__dirname, '..', '_internal', 'BRAINSTORMING.md');
let content = fs.readFileSync(bsPath, 'utf8');

const INSERT = `## \u{1F6A7} OC-PSA-CLAMP: preSleepAbsence.start darf nie vor bedEntryTs liegen (28.06.2026)

**Problem (Code-Analyse):**
OC-48c berechnet \`preSleepAbsenceEvents\` innerhalb von \`computePersonSleep()\`
mit einem initialen \`bedEntryTs\`-Schaetzwert. Danach korrigiert OC-BED-SYNC (v0.33.319)
den \`bedEntryTs\` auf den Gewinner-Timestamp. Das Array \`preSleepAbsenceEvents\`
wird dabei NICHT nachkorrigiert.

**Effekt:** \`preSleepAbsenceEvents[0].start\` kann vor dem finalen \`bedEntryTs\` liegen.
Beispiel 27./28.06.: preSleepAbsence.start = 22:12, bedEntryTs = 22:15.
Im Rendering beginnt der graue Balken sofort am Balkenstart (22:15),
obwohl korrekt 3 min Einschlafphase (gelb) davor kommen muesste.

**Loesung (Clamp):** Nach Finalisierung von \`bedEntryTs\` alle
\`preSleepAbsenceEvents\` auf \`start >= bedEntryTs\` begrenzen:
\`event.start = Math.max(event.start, bedEntryTs)\`
Betroffene Stelle: nach OC-BED-SYNC Block, vor personData-Speicherung.

---

## \u{1F6A7} OC-GARMIN-NO-TS: Garmin liefert keine Timestamps fuer Sleep-Segmente (28.06.2026)

**Befund:** Garmin-Daten enthalten ausschliesslich Summen pro Nacht:
\`garminDeepMin\`, \`garminLightMin\`, \`garminRemMin\`, \`garminWakeMin\`.
Keine zeitlichen Informationen (Start/Ende einzelner Phasen).

**Konsequenz:** Garmin-Schlafphasen koennen NICHT in den Timeline-Balken eingezeichnet
werden. Garmin bleibt ausschliesslich als Referenz-Zeile (Summen) und fuer
Score-Kalibrierung nutzbar. Kein Mischen von AURA-Balken mit Garmin-Daten.

---

`;

// Einfuegen nach dem ersten --- Block (nach Header)
const pos = content.indexOf('---\n\n##');
if (pos < 0) { console.error('Einfuegeposition nicht gefunden'); process.exit(1); }
content = content.substring(0, pos + 5) + '\n' + INSERT + content.substring(pos + 5);
fs.writeFileSync(bsPath, content);
console.log('BRAINSTORMING.md: OC-PSA-CLAMP und OC-GARMIN-NO-TS dokumentiert');
