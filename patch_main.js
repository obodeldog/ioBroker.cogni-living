// Patch-Skript für main.js: Sensor-Ausfall-Erkennung + dynamisches Schlaf-Fenster
'use strict';
const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'src', 'main.js');
let content = fs.readFileSync(filePath, 'utf8');
let changes = 0;

function replace(old, neu, label) {
    if (content.includes(old)) {
        content = content.replace(old, neu);
        console.log(`✓ ${label}`);
        changes++;
    } else {
        console.error(`✗ NOT FOUND: ${label}`);
    }
}

// ──────────────────────────────────────────────────────────────
// 1. Constructor: sensorLastSeen + sensorAlertSent + interval
// ──────────────────────────────────────────────────────────────
replace(
    `        this.infrasoundLocked = false;
        this.pressureBuffer = [];`,
    `        this.infrasoundLocked = false;
        this.pressureBuffer = [];

        // Sensor-Ausfall-Erkennung
        this.sensorLastSeen = {};    // { sensorId: timestamp }
        this.sensorAlertSent = {};   // { sensorId: lastAlertTs } - verhindert Spam
        this.sensorCheckInterval = null;`,
    '1. Constructor sensorLastSeen'
);

// ──────────────────────────────────────────────────────────────
// 2. onUnload: sensorCheckInterval aufräumen
// ──────────────────────────────────────────────────────────────
replace(
    `            if (this.roomIntegratorTimer) clearInterval(this.roomIntegratorTimer);
            recorder.abortExitTimer(this);`,
    `            if (this.roomIntegratorTimer) clearInterval(this.roomIntegratorTimer);
            if (this.sensorCheckInterval) clearInterval(this.sensorCheckInterval);
            recorder.abortExitTimer(this);`,
    '2. onUnload sensorCheckInterval'
);

// ──────────────────────────────────────────────────────────────
// 3. startSystem: sensorLastSeen aus eventHistory initialisieren
//    + stündlichen Sensor-Check starten
// ──────────────────────────────────────────────────────────────
replace(
    `        setTimeout(() => this.replayTodayEvents(), 5000);`,
    `        setTimeout(() => this.replayTodayEvents(), 5000);

        // Sensor-LastSeen aus eventHistory initialisieren (auch nach Adapter-Neustart)
        if (this.eventHistory && this.eventHistory.length > 0) {
            this.eventHistory.forEach(function(e) { if (e.id && e.timestamp) { var cur = this.sensorLastSeen[e.id]; if (!cur || e.timestamp > cur) this.sensorLastSeen[e.id] = e.timestamp; } }.bind(this));
        }
        // Stündlicher Sensor-Ausfall-Check
        if (this.sensorCheckInterval) clearInterval(this.sensorCheckInterval);
        this.sensorCheckInterval = setInterval(() => { this.checkSensorHealth(); }, 60 * 60 * 1000);
        setTimeout(() => this.checkSensorHealth(), 5 * 60 * 1000); // auch 5 min nach Start`,
    '3. startSystem sensorCheck interval'
);

// ──────────────────────────────────────────────────────────────
// 4. saveDailyHistory: dynamisches Schlaf-Fenster (sleepWindowCalc)
//    + nocturiaCount + nightVibrationCount auf dynamisches Fenster umstellen
// ──────────────────────────────────────────────────────────────
replace(
    `            // Nykturie: Badezimmer-Sensor-Ereignisse zwischen 22:00 und 06:00 (einzigartige Stunden)
            const _bathroomDevIds`,
    `            // Schlaf-Fenster aus FP2-Bett-Events berechnen (dynamisch statt fixem 22-06)
            const sleepWindowCalc = (function() {
                var bedEvts = todayEvents.filter(function(e) { return e.isFP2Bed; })
                    .sort(function(a,b) { return (a.timestamp||0)-(b.timestamp||0); });
                if (bedEvts.length === 0) return { start: null, end: null };
                // Schlafbeginn: letztes Mal dass Bett >= 10 Min belegt wurde zwischen 18:00-02:00
                var sleepStartTs = null;
                var presStart = null;
                for (var _si = 0; _si < bedEvts.length; _si++) {
                    var _se = bedEvts[_si];
                    var _sv = _se.value === true || _se.value === 1 || _se.value === 'true';
                    var _shr = new Date(_se.timestamp||0).getHours();
                    if (_sv && !presStart && (_shr >= 18 || _shr < 3)) { presStart = _se.timestamp||0; }
                    else if (!_sv && presStart) {
                        var _dur = ((_se.timestamp||0) - presStart) / 60000;
                        if (_dur >= 10) sleepStartTs = presStart; // merke diesen (evtl. wird er spaeter ueberschrieben)
                        presStart = null;
                    }
                }
                if (presStart) { var _dur2 = (Date.now() - presStart) / 60000; if (_dur2 >= 10) sleepStartTs = presStart; }
                if (!sleepStartTs) return { start: null, end: null };
                // Aufwachzeit: erstes Mal nach Schlafbeginn dass Bett >= 15 Min leer war nach 04:00
                var wakeTs = null;
                var emptyStart = null;
                for (var _wi = 0; _wi < bedEvts.length; _wi++) {
                    var _we = bedEvts[_wi];
                    if ((_we.timestamp||0) < sleepStartTs) continue; // vor Schlafbeginn ignorieren
                    var _wv = _we.value === true || _we.value === 1 || _we.value === 'true';
                    var _whr = new Date(_we.timestamp||0).getHours();
                    if (!_wv && (_whr >= 4 || _whr < 12)) {
                        if (!emptyStart) emptyStart = _we.timestamp||0;
                    } else if (_wv && emptyStart) {
                        var _wdur = ((_we.timestamp||0) - emptyStart) / 60000;
                        if (_wdur >= 15) { wakeTs = emptyStart + _wdur * 60000; emptyStart = null; break; }
                        emptyStart = null;
                    }
                }
                if (emptyStart) { var _wdur2 = (Date.now() - emptyStart) / 60000; if (_wdur2 >= 15) wakeTs = Date.now(); }
                return { start: sleepStartTs, end: wakeTs };
            })();

            // Nykturie: Badezimmer-Sensor-Ereignisse – dynamisches Schlaf-Fenster (Fallback: 22-06)
            const _bathroomDevIds`,
    '4a. sleepWindowCalc before nocturiaCount'
);

replace(
    `            const nocturiaCount = (function() {
                var nightHours = new Set();
                todayEvents.forEach(function(e) {
                    if (!e.isBathroomSensor && !_bathroomDevIds.has(e.id)) return;
                    var hr = new Date(e.timestamp || e.ts || 0).getHours();
                    if (hr >= 22 || hr < 6) nightHours.add(hr);
                });
                return nightHours.size;
            })();`,
    `            const nocturiaCount = (function() {
                var nightHours = new Set();
                var hasDyn = !!(sleepWindowCalc.start && sleepWindowCalc.end);
                todayEvents.forEach(function(e) {
                    if (!e.isBathroomSensor && !_bathroomDevIds.has(e.id)) return;
                    var ts = e.timestamp || e.ts || 0;
                    var hr = new Date(ts).getHours();
                    if (hasDyn) {
                        if (ts >= sleepWindowCalc.start && ts <= sleepWindowCalc.end) nightHours.add(hr);
                    } else {
                        if (hr >= 22 || hr < 6) nightHours.add(hr);
                    }
                });
                return nightHours.size;
            })();`,
    '4b. nocturiaCount dynamic window'
);

replace(
    `            // Vibration Bett: Erschuetterungen nachts (22:00-06:00)
            const nightVibrationCount = todayEvents.filter(function(e) {
                if (!e.isVibrationBed) return false;
                var v = e.value === true || e.value === 1 || e.value === 'true';
                if (!v) return false;
                var hr = new Date(e.timestamp||0).getHours();
                return hr >= 22 || hr < 6;
            }).length;`,
    `            // Vibration Bett: Erschuetterungen im Schlaf-Fenster (Fallback: 22-06)
            const nightVibrationCount = todayEvents.filter(function(e) {
                if (!e.isVibrationBed) return false;
                var v = e.value === true || e.value === 1 || e.value === 'true';
                if (!v) return false;
                var ts = e.timestamp||0;
                if (sleepWindowCalc.start && sleepWindowCalc.end) {
                    return ts >= sleepWindowCalc.start && ts <= sleepWindowCalc.end;
                }
                var hr = new Date(ts).getHours();
                return hr >= 22 || hr < 6;
            }).length;`,
    '4c. nightVibrationCount dynamic window'
);

// ──────────────────────────────────────────────────────────────
// 5. snapshot: sleepWindowStart + sleepWindowEnd hinzufügen
// ──────────────────────────────────────────────────────────────
replace(
    `                nocturiaCount: nocturiaCount,
                kitchenVisits: kitchenVisits,`,
    `                nocturiaCount: nocturiaCount,
                kitchenVisits: kitchenVisits,
                sleepWindowStart: sleepWindowCalc.start,   // ms-Timestamp Schlafbeginn (null wenn kein FP2)
                sleepWindowEnd:   sleepWindowCalc.end,     // ms-Timestamp Aufwachen (null wenn kein FP2)`,
    '5. snapshot sleepWindow fields'
);

// ──────────────────────────────────────────────────────────────
// 6. recorder.js: sensorLastSeen updaten bei jedem Event
// ──────────────────────────────────────────────────────────────
const recPath = path.join(__dirname, 'src', 'lib', 'recorder.js');
let recContent = fs.readFileSync(recPath, 'utf8');
const recOld = `    adapter.sensorLastValues[id] = value;`;
const recNew = `    adapter.sensorLastValues[id] = value;
    if (!adapter.sensorLastSeen) adapter.sensorLastSeen = {};
    adapter.sensorLastSeen[id] = Date.now();`;
if (recContent.includes(recOld)) {
    recContent = recContent.replace(recOld, recNew);
    fs.writeFileSync(recPath, recContent, 'utf8');
    console.log('✓ 6. recorder.js sensorLastSeen');
    changes++;
} else {
    console.error('✗ NOT FOUND: 6. recorder.js sensorLastSeen');
}

// ──────────────────────────────────────────────────────────────
// 7. Neue Methode checkSensorHealth (vor onUnload einfügen)
// ──────────────────────────────────────────────────────────────
replace(
    `    onUnload(callback) {`,
    `    checkSensorHealth() {
        var _self = this;
        var now = Date.now();
        var devices = this.config.devices || [];
        // Schwellwerte pro Sensor-Typ (Millisekunden)
        var thresholds = { motion: 4*3600000, presence_radar: 4*3600000, vibration: 4*3600000,
            door: 24*3600000, temperature: 2*3600000, light: 8*3600000, dimmer: 8*3600000, moisture: 8*3600000 };
        var defaultThreshold = 8 * 3600000;
        var ALERT_COOLDOWN = 12 * 3600000; // max. 1 Alert pro 12h pro Sensor
        var alerts = [];
        devices.forEach(function(d) {
            if (!d.id) return;
            var lastSeen = _self.sensorLastSeen[d.id];
            if (!lastSeen) return; // noch nie gesehen – kein Alarm (koennte erst heute konfiguriert worden sein)
            var threshold = thresholds[d.type] || defaultThreshold;
            var elapsed = now - lastSeen;
            if (elapsed > threshold) {
                var lastAlert = _self.sensorAlertSent[d.id] || 0;
                if ((now - lastAlert) > ALERT_COOLDOWN) {
                    _self.sensorAlertSent[d.id] = now;
                    var hours = Math.round(elapsed / 3600000);
                    alerts.push((d.name || d.id) + ' (' + (d.location || '?') + '): seit ' + hours + 'h inaktiv');
                }
            }
        });
        if (alerts.length > 0) {
            var msg = '⚠️ Sensor-Ausfall:\\n' + alerts.join('\\n');
            this.log.warn('[SENSOR-CHECK] ' + alerts.join(', '));
            try { setup.sendNotification(this, msg, true, false, '⚠️ NUUKANNI: Sensor-Ausfall'); } catch(e) {}
        }
    }

    onUnload(callback) {`,
    '7. checkSensorHealth method'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\nDone: ${changes} changes applied.`);
