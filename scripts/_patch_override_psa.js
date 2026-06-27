// Patch: preSleepAbsenceEvents + garminWakeMin in overrideData ergänzen (v0.33.324)
const fs = require('fs');
const FILE = 'src-admin/src/components/tabs/HealthTab.tsx';
let s = fs.readFileSync(FILE, 'utf8');

const OLD = "                                        nightVibrationCount:    (pd as any).nightVibrationCount ?? null,\r\n                                    };";
const NEW = "                                        nightVibrationCount:    (pd as any).nightVibrationCount ?? null,\r\n                                        // [P-PSA-FIX2] fehlende Felder im overrideData -> Overlay + Garmin-Wach nie sichtbar\r\n                                        preSleepAbsenceEvents:  (pd as any).preSleepAbsenceEvents ?? [],\r\n                                        garminWakeMin:          (pd as any).garminWakeMin ?? null,\r\n                                    };";

const idx = s.indexOf(OLD);
if (idx < 0) {
    if (s.includes(NEW)) { console.log('SKIP: already applied'); process.exit(0); }
    throw new Error('NOT FOUND: ' + OLD.slice(0, 60));
}
s = s.slice(0, idx) + NEW + s.slice(idx + OLD.length);
fs.writeFileSync(FILE, s, 'utf8');
console.log('OK: preSleepAbsenceEvents + garminWakeMin in overrideData ergaenzt');
