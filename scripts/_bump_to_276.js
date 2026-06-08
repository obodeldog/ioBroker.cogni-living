'use strict';
const fs = require('fs');
const NEW_VER = '0.33.276';
function readJ(p){let s=fs.readFileSync(p,'utf8');let b=false;if(s.charCodeAt(0)===0xFEFF){s=s.slice(1);b=true;}return{obj:JSON.parse(s),hadBom:b};}
function writeJ(p,o,b){fs.writeFileSync(p,(b?'\uFEFF':'')+JSON.stringify(o,null,2)+'\n','utf8');}
const pkg=readJ('package.json');const iop=readJ('io-package.json');
console.log('package.json:',pkg.obj.version,'->',NEW_VER);
console.log('io-package.json:',iop.obj.common.version,'->',NEW_VER);
pkg.obj.version=NEW_VER;iop.obj.common.version=NEW_VER;
iop.obj.common.news={[NEW_VER]:{de:'v0.33.276: OC-57 bedExitTs Walk-Through-Guard - kurzer PIR-only Schlafzimmerbesuch (z.B. Jacke holen) verschiebt die Aufstehzeit nicht mehr; bedExitTs nicht spaeter als letzter echter Matratzen-Kontakt (graceful: ohne Vibrationssensor/mit FP2 kein Eingriff).',en:'v0.33.276: OC-57 bedExitTs walk-through guard - a brief PIR-only bedroom visit no longer pushes wake-up time; bedExitTs capped at last real mattress contact (graceful).'},...iop.obj.common.news};
writeJ('package.json',pkg.obj,pkg.hadBom);writeJ('io-package.json',iop.obj,iop.hadBom);
console.log('OK: bumped to',NEW_VER);
