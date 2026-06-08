'use strict';
const fs = require('fs');
const NEW_VER = '0.33.275';

function readJ(p) {
  let s = fs.readFileSync(p, 'utf8');
  let hadBom = false;
  if (s.charCodeAt(0) === 0xFEFF) { s = s.slice(1); hadBom = true; }
  return { obj: JSON.parse(s), hadBom };
}
function writeJ(p, obj, hadBom) {
  const s = JSON.stringify(obj, null, 2) + '\n';
  fs.writeFileSync(p, (hadBom ? '\uFEFF' : '') + s, 'utf8');
}

const pkg = readJ('package.json');
const iop = readJ('io-package.json');
console.log('package.json:', pkg.obj.version, '->', NEW_VER);
console.log('io-package.json:', iop.obj.common.version, '->', NEW_VER);

pkg.obj.version = NEW_VER;
iop.obj.common.version = NEW_VER;

iop.obj.common.news = {
  [NEW_VER]: {
    de: 'v0.33.275: Revert v0.33.274 (OC-24-OC48 Noisy-Ausschluss war falsch begruendet - Wohnzimmer-Aktivitaet war echt, OC-48c lehnt korrekt ab). Admin-HealthTab: Hinweis "Ins Bett gegangen: kein plausibler Wert gefunden" (Paritaet zur PWA).',
    en: 'v0.33.275: Revert v0.33.274 (OC-24-OC48 noisy exclusion was wrongly justified). Admin HealthTab: hint when no plausible bed-entry time (parity with PWA).'
  },
  ...iop.obj.common.news
};

writeJ('package.json', pkg.obj, pkg.hadBom);
writeJ('io-package.json', iop.obj, iop.hadBom);
console.log('OK: bumped to', NEW_VER);
