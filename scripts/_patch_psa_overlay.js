// Patch: preSleepAbsenceEvents in pickSd() ergänzen (v0.33.323)
// Bug: das Feld fehlte in pickSd() -> Overlay war nie sichtbar
const fs = require('fs');
const FILE = 'src/lib/pwa_sleep_tile_build.js';
let s = fs.readFileSync(FILE, 'utf8');

const OLD = `        bedAbsenceEvents: Array.isArray(raw.bedAbsenceEvents) ? raw.bedAbsenceEvents : [],
        excluded: !!raw.excluded
    };
}`;
const NEW = `        bedAbsenceEvents: Array.isArray(raw.bedAbsenceEvents) ? raw.bedAbsenceEvents : [],
        // [P-PSA-FIX] preSleepAbsenceEvents war nicht in pickSd() -> Overlay nie sichtbar
        preSleepAbsenceEvents: Array.isArray(raw.preSleepAbsenceEvents) ? raw.preSleepAbsenceEvents : [],
        excluded: !!raw.excluded
    };
}`;

const idx = s.indexOf(OLD);
if (idx < 0) {
    if (s.includes(NEW)) { console.log('SKIP: already applied'); process.exit(0); }
    throw new Error('NOT FOUND');
}
s = s.slice(0, idx) + NEW + s.slice(idx + OLD.length);
fs.writeFileSync(FILE, s, 'utf8');
console.log('OK: preSleepAbsenceEvents in pickSd() ergänzt');
