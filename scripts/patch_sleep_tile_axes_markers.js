/**
 * Erweitert src/lib/pwa_sleep_tile_build.js um Marker-Zeilen + Zeitachse (Admin-paritaet).
 */
const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'src', 'lib', 'pwa_sleep_tile_build.js');
let c = fs.readFileSync(p, 'utf8');

const clipOld = `                return {
                    start: start,
                    end: end,
                    duration: Math.max(1, Math.round((end - start) / 60000)),
                    type: e.type,
                    confirmed: e.confirmed
                };`;

const clipNew = `                return {
                    start: start,
                    end: end,
                    duration: Math.max(1, Math.round((end - start) / 60000)),
                    type: e.type,
                    confirmed: e.confirmed,
                    sensors: e.sensors || []
                };`;

if (c.includes(clipOld)) {
    c = c.replace(clipOld, clipNew);
} else if (!c.includes('sensors: e.sensors')) {
    console.error('clip block not found');
    process.exit(1);
}

const injectNeedle = `    const confirmedEvts = clippedOutsideBedEvts.filter(function (e) {
        return e.confirmed !== false;
    });

    function slotColor(slot, absMs) {`;

const injectBlock = `    const confirmedEvts = clippedOutsideBedEvts.filter(function (e) {
        return e.confirmed !== false;
    });

    const radarDropoutEvts = clippedOutsideBedEvts.filter(function (e) {
        return e.confirmed === false;
    });

    const markerTitleMap = {
        bathroom: 'Bad-Besuch',
        outside: 'Außerhalb',
        other_person: 'Andere Person aktiv'
    };

    function buildOutsideMarkerTitle(evt, isDropout) {
        var evtType = evt.type || 'outside';
        var allSensors = evt.sensors || [];
        var hasSensorTypeInfo = allSensors.some(function (s) {
            return s.isBathroomSensor !== undefined;
        });
        var filteredSensors =
            isDropout || !hasSensorTypeInfo
                ? allSensors
                : evtType === 'bathroom'
                  ? allSensors.filter(function (s) {
                        return s.isBathroomSensor === true;
                    })
                  : allSensors.filter(function (s) {
                        return !s.isBathroomSensor;
                    });
        var sensorStr = '';
        if (filteredSensors.length > 0) {
            sensorStr =
                '\\n' +
                filteredSensors
                    .map(function (s) {
                        var timeStr = s.timestamp ? ' um ' + fmtTime(s.timestamp) : '';
                        return '  • ' + s.name + (s.location ? ' (' + s.location + ')' : '') + timeStr;
                    })
                    .join('\\n');
        } else if (allSensors.length > 0) {
            sensorStr = '\\n  (Sensordetails werden nach Update verfügbar)';
        }
        if (isDropout) {
            return 'Radar-Aussetzer: ' + evt.duration + ' min (kein Außensensor bestätigt)' + sensorStr;
        }
        return (markerTitleMap[evtType] || 'Abwesenheit') + ': ' + evt.duration + ' min' + sensorStr;
    }

    function assignMarkerLanes(evts, idxOffset, isDropout) {
        var lastPctInLane = [-100, -100];
        var minPctGap = 2.2;
        var barBase = bedEntryTsVal != null ? bedEntryTsVal : swStart;
        var barTotal = newBarTotalMs != null ? newBarTotalMs : swEnd - swStart;
        return evts
            .map(function (evt, i) {
                var pct = ((evt.start - barBase) / barTotal) * 100;
                var lane =
                    Math.abs(pct - lastPctInLane[0]) >= minPctGap
                        ? 0
                        : Math.abs(pct - lastPctInLane[1]) >= minPctGap
                          ? 1
                          : 0;
                lastPctInLane[lane] = pct;
                var evtType = evt.type || 'outside';
                return {
                    key: evt.start + '-' + evt.end + '-' + (idxOffset + i),
                    pct: Math.min(100, Math.max(0, pct)),
                    lane: lane,
                    evtType: evtType,
                    title: buildOutsideMarkerTitle(evt, isDropout),
                    small: !!isDropout
                };
            })
            .sort(function (a, b) {
                return a.pct - b.pct;
            });
    }

    var markerItems = { above: [], below: [], dropout: [] };
    if (swStart && swEnd && clippedOutsideBedEvts.length > 0) {
        var aboveEvts = confirmedEvts.filter(function (e) {
            return (e.type || 'outside') === 'bathroom';
        });
        var belowEvts = confirmedEvts.filter(function (e) {
            return (e.type || 'outside') !== 'bathroom';
        });
        markerItems.above = assignMarkerLanes(aboveEvts, 0, false);
        markerItems.below = assignMarkerLanes(belowEvts, aboveEvts.length, false);
        markerItems.dropout = assignMarkerLanes(
            radarDropoutEvts,
            aboveEvts.length + belowEvts.length,
            true
        );
    }

    var preSleepMarkers = [];
    if (bedEntryTsVal && swStart && newBarTotalMs) {
        var nachtEvts = sd.nachtAufstehenEvents || [];
        preSleepMarkers = nachtEvts
            .filter(function (e) {
                return e.departureTs >= bedEntryTsVal && e.departureTs < swStart;
            })
            .map(function (e, i) {
                var isBath = /bad/i.test(e.departureSensor || '');
                var pct = Math.min(
                    100,
                    Math.max(0, ((e.departureTs - bedEntryTsVal) / newBarTotalMs) * 100)
                );
                var durMin = Math.round((e.returnTs - e.departureTs) / 60000);
                return {
                    key: 'pre-' + i + '-' + e.departureTs,
                    pct: pct,
                    color: isBath ? '#ffb300' : '#e53935',
                    title:
                        (isBath ? 'Bad-Besuch' : 'Aufgestanden') +
                        ' (vor Einschlafen): ' +
                        fmtTime(e.departureTs) +
                        ' - ' +
                        fmtTime(e.returnTs) +
                        ' (' +
                        durMin +
                        ' Min)' +
                        (e.departureSensor ? '\\n  • ' + e.departureSensor : '')
                };
            });
    }

    var timeAxisTicks = [];
    var timeAxisLeft = swStart != null ? fmtTime(bedEntryTsVal != null ? bedEntryTsVal : swStart) : '';
    var timeAxisRight = swEnd != null ? fmtTime(swEnd) : '';
    if (swStart && swEnd && newBarTotalMs) {
        var barBaseMs = bedEntryTsVal != null ? bedEntryTsVal : swStart;
        var barTotalMs = newBarTotalMs;
        var firstTA = new Date(barBaseMs);
        firstTA.setMinutes(0, 0, 0);
        firstTA.setHours(firstTA.getHours() + 1);
        var tTick = firstTA.getTime();
        while (tTick < swEnd - 900000) {
            var pctTA = ((tTick - barBaseMs) / barTotalMs) * 100;
            var tooCloseLeft = tTick - barBaseMs < 45 * 60 * 1000;
            var tooCloseRight = swEnd - tTick < 30 * 60 * 1000;
            if (!tooCloseLeft && !tooCloseRight && pctTA > 0 && pctTA < 100) {
                timeAxisTicks.push({ pct: pctTA, label: fmtTime(tTick) });
            }
            tTick += 3600000;
        }
    }

    function slotColor(slot, absMs) {`;

if (c.includes(injectNeedle)) {
    c = c.replace(injectNeedle, injectBlock);
} else {
    console.error('inject needle not found');
    process.exit(1);
}

const retOld = `        segments: segments,
        disclaimer: true
    };`;

const retNew = `        segments: segments,
        disclaimer: true,
        markersPreSleep: preSleepMarkers,
        markersAbove: markerItems.above,
        markersBelow: markerItems.below,
        markersDropout: markerItems.dropout,
        timeAxis: {
            left: timeAxisLeft,
            right: timeAxisRight,
            ticks: timeAxisTicks
        }
    };`;

if (c.includes(retOld)) {
    c = c.replace(retOld, retNew);
} else {
    console.error('return tail not found');
    process.exit(1);
}

fs.writeFileSync(p, c, 'utf8');
console.log('OK', p);
