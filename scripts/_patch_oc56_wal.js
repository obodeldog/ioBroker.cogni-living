// OC-56: Write-Ahead-Eventlog + deterministischer Event-Merge + Restore-Fix + Neustart-Detektor
// Patcht src/lib/recorder.js, src/lib/setup.js und src/main.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let failures = 0;

function patch(file, oldStr, newStr, label) {
    const p = path.join(ROOT, file);
    let txt = fs.readFileSync(p, 'utf8');
    if (txt.indexOf(newStr) !== -1) { console.log('SKIP (schon gepatcht): ' + label); return; }
    const idx = txt.indexOf(oldStr);
    if (idx === -1) { console.error('FAIL (Marker nicht gefunden): ' + label); failures++; return; }
    if (txt.indexOf(oldStr, idx + 1) !== -1) { console.error('FAIL (Marker nicht eindeutig): ' + label); failures++; return; }
    txt = txt.slice(0, idx) + newStr + txt.slice(idx + oldStr.length);
    fs.writeFileSync(p, txt, 'utf8');
    console.log('OK: ' + label);
}

// ============================================================================
// PATCH 1: recorder.js - Write-Ahead-Eventlog (WAL) nach unshift
// ============================================================================
patch('src/lib/recorder.js',
`    adapter.eventHistory.unshift(eventObj);
    if (adapter.eventHistory.length > HISTORY_MAX_SIZE) adapter.eventHistory.pop();
`,
`    adapter.eventHistory.unshift(eventObj);
    if (adapter.eventHistory.length > HISTORY_MAX_SIZE) adapter.eventHistory.pop();

    // [OC-56] Write-Ahead-Eventlog: jedes Event sofort auf Platte (restart-sicher).
    // Grund (Forensik 11.06.2026): naechtlicher Prozess-Neustart leerte den In-Memory-Puffer,
    // Abend-Events (bedEntryTs-Quelle) gingen fuer die Analyse verloren obwohl der Sensor lieferte.
    try {
        if (adapter._historyDir) {
            if (!adapter._walDirReady) {
                try { _walFs.mkdirSync(adapter._historyDir, { recursive: true }); } catch (mkE) {}
                adapter._walDirReady = true;
            }
            const _wd = new Date(now);
            const _wds = _wd.getFullYear() + '-' + String(_wd.getMonth() + 1).padStart(2, '0') + '-' + String(_wd.getDate()).padStart(2, '0');
            _walFs.appendFileSync(_walPath.join(adapter._historyDir, 'buffer-' + _wds + '.jsonl'), JSON.stringify(eventObj) + '\\n');
        }
    } catch (walE) {
        if (!adapter._walWarned) { adapter._walWarned = true; adapter.log.warn('[OC-56] Write-Ahead-Eventlog fehlgeschlagen: ' + walE.message); }
    }
`,
'recorder.js: WAL-Append nach Event-Aufnahme');

// recorder.js: fs/path Imports am Kopf
patch('src/lib/recorder.js',
`const HISTORY_MAX_SIZE = 2000;`,
`const _walFs = require('fs');
const _walPath = require('path');
const HISTORY_MAX_SIZE = 2000;`,
'recorder.js: fs/path Imports');

// ============================================================================
// PATCH 2: main.js - deterministischer Event-Merge ersetzt Buffer-Gap-Heuristik
// ============================================================================
patch('src/main.js',
`            const sleepSearchEvents = this.eventHistory.filter(e => (e.timestamp||0) >= _sleepSearchBase.getTime());
            // Buffer-Supplement: falls In-Memory-Buffer nach Adapter-Neustart Abend-Events fehlen,
            // aus gespeichertem JSON des Vortages nachladen (18:00-Fenster schliessen).
            try {
                const _bufMin = this.eventHistory.reduce((m, e) => Math.min(m, e.timestamp||Infinity), Infinity);
                if (_bufMin > _sleepSearchBase.getTime() + 60000) {
                    const _suppPath = path.join(utils.getAbsoluteDefaultDataDir(), 'cogni-living', 'history', sleepDate + '.json');
                    if (fs.existsSync(_suppPath)) {
                        const _suppSnap = JSON.parse(fs.readFileSync(_suppPath, 'utf8'));
                        const _suppEvts = (_suppSnap.eventHistory || []).filter(e => { const t=e.timestamp||0; return t>=_sleepSearchBase.getTime()&&t<_bufMin; });
                        if (_suppEvts.length > 0) {
                            sleepSearchEvents.push(..._suppEvts);
                            sleepSearchEvents.sort((a,b)=>(a.timestamp||0)-(b.timestamp||0));
                            this.log.info('[AURA] sleepSearch: +'+_suppEvts.length+' Events aus '+sleepDate+'.json ergaenzt (Buffer-Gap)');
                        }
                    }
                }
            } catch(_suppE) { this.log.debug('[AURA] Buffer-Supplement: '+_suppE.message); }`,
`            // [OC-56] Deterministischer Event-Merge: Memory + Write-Ahead-Pufferdateien + Vortages-JSON.
            // Ersetzt die alte Buffer-Gap-Heuristik (lief nur bei erkannter Luecke, versagte still).
            // Forensik 11.06.2026: Abend-Events lagen auf Platte (Vortages-JSON), wurden aber nach
            // naechtlichem Prozess-Neustart nicht in die Analyse uebernommen -> bedEntryTs=null.
            const sleepSearchEvents = (() => {
                const _mrgMap = new Map();
                const _mrgBase = _sleepSearchBase.getTime();
                const _mrgKey = (e) => (e.timestamp || 0) + '|' + (e.id || '') + '|' + (e.type || '');
                const _mrgAdd = (e) => {
                    if (!e || (e.timestamp || 0) < _mrgBase) return false;
                    const k = _mrgKey(e);
                    if (_mrgMap.has(k)) return false;
                    _mrgMap.set(k, e);
                    return true;
                };
                this.eventHistory.forEach(_mrgAdd);
                const _mrgMem = _mrgMap.size;
                // Quelle 2: Write-Ahead-Pufferdateien (Vortag + heute)
                let _mrgWal = 0;
                const _mrgToday = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
                const _mrgDays = sleepDate === _mrgToday ? [sleepDate] : [sleepDate, _mrgToday];
                for (const _mrgDs of _mrgDays) {
                    try {
                        const _mrgBp = path.join(utils.getAbsoluteDefaultDataDir(), 'cogni-living', 'history', 'buffer-' + _mrgDs + '.jsonl');
                        if (!fs.existsSync(_mrgBp)) continue;
                        const _mrgLines = fs.readFileSync(_mrgBp, 'utf8').split('\\n');
                        for (const _mrgLn of _mrgLines) {
                            if (!_mrgLn.trim()) continue;
                            try { if (_mrgAdd(JSON.parse(_mrgLn))) _mrgWal++; } catch (_mrgPe) {}
                        }
                    } catch (_mrgWe) { this.log.warn('[OC-56] Pufferdatei buffer-' + _mrgDs + '.jsonl nicht lesbar: ' + _mrgWe.message); }
                }
                // Quelle 3: Vortages-JSON (eventHistory des sleepDate)
                let _mrgSnap = 0;
                try {
                    const _mrgSp = path.join(utils.getAbsoluteDefaultDataDir(), 'cogni-living', 'history', sleepDate + '.json');
                    if (fs.existsSync(_mrgSp)) {
                        const _mrgSs = JSON.parse(fs.readFileSync(_mrgSp, 'utf8'));
                        (_mrgSs.eventHistory || []).forEach((e) => { if (_mrgAdd(e)) _mrgSnap++; });
                    }
                } catch (_mrgSe) { this.log.warn('[OC-56] Vortages-JSON ' + sleepDate + '.json nicht lesbar: ' + _mrgSe.message); }
                const _mrgArr = Array.from(_mrgMap.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                if (_mrgWal > 0 || _mrgSnap > 0) {
                    this.log.info('[OC-56] sleepSearch-Merge: ' + _mrgMem + ' Memory + ' + _mrgWal + ' Pufferdatei + ' + _mrgSnap + ' Vortages-JSON = ' + _mrgArr.length + ' Events');
                }
                return _mrgArr;
            })();`,
'main.js: Event-Merge ersetzt Buffer-Gap-Heuristik');

// ============================================================================
// PATCH 3: main.js - Restore beim Start: WAL-Merge + Silent-Catch-Fix
// ============================================================================
patch('src/main.js',
`        try {
            const s = await this.getStateAsync('events.history');
            if (s && s.val) {
                this.eventHistory = JSON.parse(s.val);
                if(this.isProVersion) {
                    const r = await this.getStateAsync('LTM.rawEventLog');
                    if(r && r.val) this.rawEventLog = JSON.parse(r.val);
                }
                this.log.info(\`?? Restored \${this.eventHistory.length} events from standard storage.\`);
            }
        } catch(e){ this.eventHistory = []; }`,
`        try {
            const s = await this.getStateAsync('events.history');
            if (s && s.val) {
                this.eventHistory = JSON.parse(s.val);
                if(this.isProVersion) {
                    const r = await this.getStateAsync('LTM.rawEventLog');
                    if(r && r.val) this.rawEventLog = JSON.parse(r.val);
                }
                this.log.info(\`?? Restored \${this.eventHistory.length} events from standard storage.\`);
            }
        } catch(e){ this.eventHistory = []; this.log.warn('[OC-56] events.history-Restore fehlgeschlagen (Puffer leer gestartet): ' + e.message); }

        // [OC-56] WAL-Restore: Write-Ahead-Pufferdateien (gestern + heute) in den Speicher mergen.
        // Stellt Events wieder her, die der State-Restore verloren hat (unerwarteter Neustart).
        try {
            const _walDir = this._historyDir;
            const _walFmt = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            const _walHave = new Set(this.eventHistory.map(e => (e.timestamp || 0) + '|' + (e.id || '') + '|' + (e.type || '')));
            let _walAdded = 0;
            for (const _walDs of [_walFmt(new Date(Date.now() - 86400000)), _walFmt(new Date())]) {
                const _walBp = path.join(_walDir, 'buffer-' + _walDs + '.jsonl');
                if (!fs.existsSync(_walBp)) continue;
                const _walLines = fs.readFileSync(_walBp, 'utf8').split('\\n');
                for (const _walLn of _walLines) {
                    if (!_walLn.trim()) continue;
                    try {
                        const _walE = JSON.parse(_walLn);
                        const _walK = (_walE.timestamp || 0) + '|' + (_walE.id || '') + '|' + (_walE.type || '');
                        if (!_walHave.has(_walK)) { _walHave.add(_walK); this.eventHistory.push(_walE); _walAdded++; }
                    } catch (_walPe) {}
                }
            }
            if (_walAdded > 0) {
                this.eventHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                if (this.eventHistory.length > 5000) this.eventHistory.length = 5000;
                this.log.warn('[OC-56] ' + _walAdded + ' Events aus Write-Ahead-Pufferdatei wiederhergestellt (fehlten im State-Restore).');
            }
            // Cleanup: Pufferdateien aelter als 3 Tage loeschen
            try {
                const _walCut = Date.now() - 3 * 86400000;
                fs.readdirSync(_walDir).filter(f => /^buffer-\\d{4}-\\d{2}-\\d{2}\\.jsonl$/.test(f)).forEach(f => {
                    const _walM = f.match(/^buffer-(\\d{4})-(\\d{2})-(\\d{2})/);
                    if (_walM && new Date(+_walM[1], +_walM[2] - 1, +_walM[3]).getTime() < _walCut) {
                        try { fs.unlinkSync(path.join(_walDir, f)); } catch (_walDe) {}
                    }
                });
            } catch (_walCe) {}
        } catch (_walRE) { this.log.warn('[OC-56] WAL-Restore fehlgeschlagen: ' + _walRE.message); }

        // [OC-56] Neustart-Detektor: Heartbeat-Luecke beim Start auswerten, dann Heartbeat starten.
        await this.setObjectNotExistsAsync('system.heartbeat', { type: 'state', common: { name: 'Adapter-Heartbeat (ms-Timestamp, alle 60s)', type: 'number', role: 'value.time', read: true, write: false }, native: {} });
        await this.setObjectNotExistsAsync('system.lastRestart', { type: 'state', common: { name: 'Letzter Adapter-(Neu)start (JSON: ts, lastHeartbeat, gapSec)', type: 'string', role: 'json', read: true, write: false }, native: {} });
        try {
            const _hbPrev = await this.getStateAsync('system.heartbeat');
            const _hbLast = (_hbPrev && _hbPrev.val) ? Number(_hbPrev.val) : null;
            const _hbGapSec = _hbLast ? Math.round((Date.now() - _hbLast) / 1000) : null;
            await this.setStateAsync('system.lastRestart', { val: JSON.stringify({ ts: Date.now(), lastHeartbeat: _hbLast, gapSec: _hbGapSec }), ack: true });
            if (_hbGapSec !== null && _hbGapSec > 150) {
                this.log.warn('[OC-56] Adapter-Neustart erkannt: letzter Heartbeat vor ' + Math.round(_hbGapSec / 60) + ' Min (' + new Date(_hbLast).toLocaleString() + '). Event-Puffer wurde aus Pufferdatei wiederhergestellt.');
            } else {
                this.log.info('[OC-56] Adapter-Start registriert (Heartbeat-Luecke: ' + (_hbGapSec === null ? 'kein vorheriger Heartbeat' : _hbGapSec + 's') + ')');
            }
        } catch (_hbE) { this.log.warn('[OC-56] Neustart-Detektor: ' + _hbE.message); }
        this._heartbeatInterval = setInterval(() => { this.setStateAsync('system.heartbeat', { val: Date.now(), ack: true }).catch(() => {}); }, 60000);
        this.setStateAsync('system.heartbeat', { val: Date.now(), ack: true }).catch(() => {});`,
'main.js: Restore-Fix + WAL-Restore + Neustart-Detektor');

// ============================================================================
// PATCH 4: setup.js - Silent-Catch in initHistory sichtbar machen
// ============================================================================
patch('src/lib/setup.js',
`    } catch (e) { adapter.eventHistory = []; }`,
`    } catch (e) { adapter.eventHistory = []; adapter.log.warn('[OC-56] initHistory: events.history nicht lesbar (Puffer leer): ' + e.message); }`,
'setup.js: initHistory Silent-Catch -> warn');

// ============================================================================
// PATCH 5: main.js - Heartbeat-Interval in onUnload aufraeumen
// ============================================================================
patch('src/main.js',
`        this.on('unload', this.onUnload.bind(this));
        this.on('message', this.onMessage.bind(this));`,
`        this.on('unload', this.onUnload.bind(this));
        this.on('message', this.onMessage.bind(this));
        this._heartbeatInterval = null; // [OC-56]`,
'main.js: _heartbeatInterval Init im Konstruktor');

process.exit(failures > 0 ? 1 : 0);
