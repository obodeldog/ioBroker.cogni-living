const fs = require('fs');
const path = require('path');
const ksPath = path.join(__dirname, '..', '_internal', 'PROJEKT_KURZSTATUS.md');
let ks = fs.readFileSync(ksPath, 'utf8');

// Ersten Block (Version + Stand) ersetzen
const startMarker = '## 1) Aktuelle Version';
const endMarker = '## 3) Offene Baustellen';
const start = ks.indexOf(startMarker);
const end = ks.indexOf(endMarker);
if (start < 0 || end < 0) { console.error('Marker nicht gefunden'); process.exit(1); }

const newBlock = `## 1) Aktuelle Version
- **\`0.33.326\`** (ioBroker liest \`io-package.json\` \u2192 **\`common.version\`** \u2014 immer mitbumpen!)

---

## 2) Stand heute (28.06.2026)
- **v0.33.326 \u2014 OC-VIB-CAL-P90-FIX + Terminologie B + Sensor-Hinweis (28.06.)**:
  - **Kalibrierungs-Bug:** \`vibStrP90\` (P90 der Nacht-St\u00e4rken) ersetzt \`vibStrMax\` in Rolling-Kalibrierung. Aufsteh-Bewegungen (St\u00e4rke 71 um 06:43) k\u00f6nnen P90 nicht mehr inflationieren \u2192 Wake-Schwelle sinkt von 72 auf realistisch ~51.
  - **Sensor-Hinweis:** Wenn \u00fcber 5+ N\u00e4chte avgTrigRate < 0.5 UND vibStrP90 < 20 \u2192 blaues Warnsymbol in OC-VIB-CAL Tabelle mit Hinweis \u201eSensor Richtung K\u00f6rpermitte schieben\u201c.
  - **Terminologie B:** \u201eWachliegen\u201c differenziert: gelb vor Schlaf = Einschlafphase, gelb nach Schlaf = Aufwachphase, Wake-Stats w\u00e4hrend Schlaf = Schlafunterbr.
  - **BRAINSTORMING:** OC-PSA-CLAMP (preSleepAbsence.start < bedEntryTs Bug) + OC-GARMIN-NO-TS dokumentiert.
- **v0.33.325 \u2014 garminWakeMin 5 Fixes + OC-BAD-PERSON-ROBUST (27.06.)**:
  - Garmin Wach-Phasen jetzt sichtbar in Smartwatch-Referenz. 5 Stellen in HealthTab.tsx gefixt.
  - OC-BAD-PERSON-ROBUST: ID-Prefix-Match erg\u00e4nzt f\u00fcr robuste Ger\u00e4te-/State-Pfad-Erkennung.

---

`;

ks = ks.substring(0, start) + newBlock + ks.substring(end);
fs.writeFileSync(ksPath, ks);
console.log('PROJEKT_KURZSTATUS.md: v0.33.326 eingetragen');
