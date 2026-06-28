'use strict';
/**
 * Baut ein View-Model fuer die NUUKANNI Schlaf-Kachel � gleiche Kernlogik wie HealthTab renderSleepScoreCard (read-only).
 */

const stageColor = {
    deep: '#1565c0',
    light: '#42a5f5',
    rem: '#ab47bc',
    wake: '#ffd54f',
    bathroom: '#ffb300',
    outside: '#e53935',
    other_person: '#1e88e5'
};

const stageLabel = {
    deep: 'Tief',
    light: 'Leicht',
    rem: 'REM (est.)',
    wake: 'Wachliegen',
    bathroom: 'Bad-Besuch',
    outside: 'Au�erhalb',
    other_person: 'Andere Person'
};

const srcInfo = {
    garmin: { icon: '\u231A', label: 'Smartwatch (Garmin, Fitbit)' },
    fp2_vib: { icon: '\uD83D\uDCE1', label: 'Radar + Vibration' },
    fp2: { icon: '\uD83D\uDCE1', label: 'Radar (Praesenz)' },
    fp2_other: { icon: '\uD83C\uDFE0', label: 'Radar + anderer Raum' },
    other: { icon: '\uD83C\uDFE0', label: 'Anderer Raum' },
    motion: { icon: '\uD83D\uDEB6', label: 'Bewegungsmelder' },
    motion_vib: { icon: '\uD83D\uDEB6', label: 'BM + Vibration' },
    vib_refined: { icon: '\uD83D\uDECF', label: 'Matratze ruhig' },
    haus_still: { icon: '\uD83C\uDFE0', label: 'Raeume ruhig' },
    vibration: { icon: '\uD83D\uDCF3', label: 'Vibrationssensor' },
    vibration_alone: { icon: '\uD83D\uDCF3', label: 'Vibration allein' },
    fixed: { icon: '\u23F0', label: 'Fallback 20:00' },
    gap60: { icon: '\u23F8', label: 'Aktivitaetspause' },
    last_outside: { icon: '\uD83D\uDEB6', label: 'Letzter Weg SZ' },
    winstart: { icon: '\u23F0', label: 'Schaetzwert' },
    override: { icon: '\u270E', label: 'Manuell' }
};

function fmtTime(ms) {
    if (ms == null || !Number.isFinite(ms)) return '\u2014';
    const d = new Date(ms);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

function fmtWakeOrEnd(ms, refStartMs) {
    if (ms == null || !Number.isFinite(ms)) return '\u2014';
    const a = new Date(ms);
    const s = fmtTime(ms);
    if (refStartMs != null && Number.isFinite(refStartMs)) {
        const b = new Date(refStartMs);
        if (a.getDate() !== b.getDate() || a.getMonth() !== b.getMonth() || a.getFullYear() !== b.getFullYear()) {
            return s + ' (+1)';
        }
    }
    return s;
}

function fmtDuration(min) {
    if (min == null || !Number.isFinite(min)) return null;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h > 0 ? (h + 'h ' + m + 'min') : (m + 'min');
}

function pickSd(raw) {
    return {
        sleepScore: raw.sleepScore != null ? Number(raw.sleepScore) : null,
        sleepScoreRaw: raw.sleepScoreRaw != null ? Number(raw.sleepScoreRaw) : null,
        sleepScoreCal: raw.sleepScoreCal != null ? Number(raw.sleepScoreCal) : null,
        sleepScoreCalNights: raw.sleepScoreCalNights ?? 0,
        sleepScoreCalStatus: raw.sleepScoreCalStatus || 'uncalibrated',
        sleepStages: Array.isArray(raw.sleepStages) ? raw.sleepStages : [],
        garminScore: raw.garminScore != null ? Number(raw.garminScore) : null,
        garminDeepMin: raw.garminDeepMin != null ? Number(raw.garminDeepMin) : null,
        garminLightMin: raw.garminLightMin != null ? Number(raw.garminLightMin) : null,
        garminRemMin: raw.garminRemMin != null ? Number(raw.garminRemMin) : null,
        garminWakeMin: raw.garminWakeMin != null ? Number(raw.garminWakeMin) : null,
        sleepWindowStart: raw.sleepWindowStart ?? null,
        sleepWindowEnd: raw.sleepWindowEnd ?? null,
        stagesWindowStart: raw.stagesWindowStart ?? null,
        sleepWindowSource: raw.sleepWindowSource ?? 'fixed',
        wakeSource: raw.wakeSource ?? raw.sleepWindowSource ?? 'fixed',
        sleepStartSource: raw.sleepStartSource ?? raw.sleepWindowSource ?? 'fixed',
        wakeConf: raw.wakeConf ?? 'none',
        isNap: !!raw.isNap,
        unusuallyLongSleep: !!raw.unusuallyLongSleep,
        garminDataFresh: raw.garminDataFresh,
        garminLastSyncAgeH: raw.garminLastSyncAgeH != null ? Number(raw.garminLastSyncAgeH) : null,
        outsideBedEvents: Array.isArray(raw.outsideBedEvents) ? raw.outsideBedEvents : [],
        sharedBedPeriods: Array.isArray(raw.sharedBedPeriods) ? raw.sharedBedPeriods : [],
        wakeConfirmed: !!raw.wakeConfirmed,
        allWakeSources: Array.isArray(raw.allWakeSources) ? raw.allWakeSources : [],
        allSleepStartSources: Array.isArray(raw.allSleepStartSources) ? raw.allSleepStartSources : [],
        sleepDate: raw.sleepDate ?? null,
        sleepStartOverridden: !!raw.sleepStartOverridden,
        wakeOverridden: !!raw.wakeOverridden,
        bedWasEmpty: !!raw.bedWasEmpty,
        nachtAufstehenEvents: Array.isArray(raw.nachtAufstehenEvents) ? raw.nachtAufstehenEvents : [],
        bedEntryTs: raw.bedEntryTs ?? null,
        bedExitTs: raw.bedExitTs ?? null,
        smWakePhases: Array.isArray(raw.smWakePhases) ? raw.smWakePhases : [],
        bedAbsenceEvents: Array.isArray(raw.bedAbsenceEvents) ? raw.bedAbsenceEvents : [],
        // [P-PSA-FIX] preSleepAbsenceEvents war nicht in pickSd() -> Overlay nie sichtbar
        preSleepAbsenceEvents: Array.isArray(raw.preSleepAbsenceEvents) ? raw.preSleepAbsenceEvents : [],
        excluded: !!raw.excluded
    };
}

function scoreColorVal(displayScore) {
    if (displayScore === null || displayScore === undefined) return '#888';
    if (displayScore >= 80) return '#00e676';
    if (displayScore >= 60) return '#ffab40';
    return '#ff5252';
}

function buildSleepTilePayload(raw) {
    if (!raw) return { view: 'none' };

    const sd = pickSd(raw);
    // [OC-43 FIX] Deduplizierung: pro t-Wert nur letzten Eintrag behalten
    const _stagesRaw = sd.sleepStages;
    const _stagesByT = {};
    _stagesRaw.forEach(function(s) { _stagesByT[s.t] = s.s; });
    const stages = Object.keys(_stagesByT)
        .map(function(t) { return { t: Number(t), s: _stagesByT[t] }; })
        .sort(function(a, b) { return a.t - b.t; });
    const swStart = sd.sleepWindowStart;
    const swEnd = sd.sleepWindowEnd;
    const bedExitTs = sd.bedExitTs;
    const wakeDisplayTs = bedExitTs != null ? bedExitTs : swEnd;
    const _barRightTs = wakeDisplayTs != null ? wakeDisplayTs : swEnd;
    const stagesWindowStart = sd.stagesWindowStart != null ? sd.stagesWindowStart : swStart;
    const sleepStartSource = sd.sleepStartSource || 'fixed';
    const wakeSource = sd.wakeSource || 'fixed';
    const srcDisplay = srcInfo[sleepStartSource] || srcInfo.fixed;
    const wakeDisplay = srcInfo[wakeSource] || srcInfo.fixed;

    const score = sd.sleepScoreCal != null ? sd.sleepScoreCal : sd.sleepScore;
    const scoreRaw = sd.sleepScoreRaw;
    const scoreCal = sd.sleepScoreCal;
    const displayScore = scoreCal != null ? scoreCal : score;
    const hasVibSensor = stages.length > 0;
    const hasSleepWindow = swStart !== null;

    if (sd.bedWasEmpty && swStart != null && swEnd != null && swStart > swEnd) {
        return { view: 'goodNight' };
    }

    if (sd.bedWasEmpty) {
        const d1 = swStart ? new Date(swStart) : null;
        return {
            view: 'bedEmpty',
            nightLabel: d1 ? ('Nacht ' + d1.getDate() + '.' + (d1.getMonth() + 1) + '.' + d1.getFullYear()) : '',
            garminScore: sd.garminScore,
            swStartFmt: swStart ? fmtTime(swStart) : null,
            swEndFmt: swEnd ? fmtTime(swEnd) : null
        };
    }

    // [OC-52] Daten-werden-gesammelt: Nacht (20-12h) + kein Score + kein bestaet. Aufwachen + keine Stages
    // Verhindert dass stale Garmin-Vortags-Daten + falscher Bettkontakt als echte Nachtanalyse erscheinen.
    var _oc52Hour = new Date().getHours();
    if ((_oc52Hour >= 20 || _oc52Hour < 12) && displayScore == null && !sd.wakeConfirmed && stages.length === 0 && !sd.bedWasEmpty) {
        return {
            view: 'collecting',
            garminScore: sd.garminScore
        };
    }

    const _bedEntryRaw = sd.bedEntryTs;
    const bedEntryTsVal =
        _bedEntryRaw && swStart && _bedEntryRaw < swStart - 5 * 60000 ? _bedEntryRaw : null;

    const sleepDurMin =
        swStart && swEnd && swEnd > swStart ? Math.round((swEnd - swStart) / 60000) : null;

    const headerCommon = {
        leftTitle: _bedEntryRaw ? 'Ins Bett gegangen' : 'Eingeschlafen',
        leftTime: fmtTime(_bedEntryRaw != null ? _bedEntryRaw : swStart),
        leftSubEinschlaf:
            _bedEntryRaw && swStart && _bedEntryRaw < swStart - 5 * 60000 ? fmtTime(swStart) : null,
        leftSubHint:
            !_bedEntryRaw && swStart ? 'Ins Bett gegangen: kein plausibler Wert gefunden' : null,
        leftSource: srcDisplay.icon + ' ' + srcDisplay.label,
        einschlafTime: fmtTime(swStart),
        bedEntryTime: bedEntryTsVal != null ? fmtTime(bedEntryTsVal) : null,
        sleepLatencyText: (bedEntryTsVal != null && swStart && swStart > bedEntryTsVal) ? fmtDuration(Math.round((swStart - bedEntryTsVal) / 60000)) : null,
        aufgewachtTime: swEnd != null ? fmtTime(swEnd) : (wakeDisplayTs != null ? fmtTime(wakeDisplayTs) : '\u2014'),
        aufstehenTime: (bedExitTs != null && swEnd != null && bedExitTs > swEnd) ? fmtTime(bedExitTs) : null,
        wakeLatencyText: (bedExitTs != null && swEnd != null && bedExitTs > swEnd) ? fmtDuration(Math.round((bedExitTs - swEnd) / 60000)) : null,
        sleepStartOverridden: sd.sleepStartOverridden,
        score: displayScore,
        scoreRaw: scoreRaw,
        scoreCal: scoreCal,
        scoreColor: scoreColorVal(displayScore),
        scoreCalStatus: sd.sleepScoreCalStatus,
        scoreCalNights: sd.sleepScoreCalNights,
        sleepDurText: sleepDurMin != null ? fmtDuration(sleepDurMin) : null,
        garminScore: sd.garminScore,
        garminDelta:
            sd.garminScore != null && displayScore != null
                ? sd.garminScore - displayScore
                : null,
        wakeTime: fmtWakeOrEnd(wakeDisplayTs, swStart),
        wakeSourceLine: wakeDisplay.icon + ' ' + wakeDisplay.label,
        wakeSubAufgewacht:
            bedExitTs && swEnd && bedExitTs > swEnd ? fmtWakeOrEnd(swEnd, swStart) : null,
        wakeConfirmed: sd.wakeConfirmed,
        wakeOverridden: sd.wakeOverridden,
        provisional: !sd.wakeConfirmed
    };

    if (!hasVibSensor && hasSleepWindow && swStart) {
        return {
            view: 'degraded',
            header: headerCommon,
            hint: 'Keine Vibrations-Schlafphasen � nur Zeiten (wie Admin ohne Bett-Vibration).'
        };
    }

    const renderedStages =
        stagesWindowStart != null && (swEnd != null || _barRightTs != null)
            ? stages.filter(function (slot) {
                  const absMs = stagesWindowStart + slot.t * 60000;
                  return (
                      absMs >= (swStart != null ? swStart : stagesWindowStart) &&
                      absMs < (_barRightTs != null ? _barRightTs : swEnd != null ? swEnd : 1e15)
                  );
              })
            : stages;

    const preStageMs =
        swStart && stagesWindowStart && stagesWindowStart > swStart && swEnd
            ? stagesWindowStart - swStart
            : 0;
    const totalWindowMs = swStart && _barRightTs ? _barRightTs - swStart : null;
    const bedEntrySegMs = bedEntryTsVal && swStart ? swStart - bedEntryTsVal : 0;
    const newBarTotalMs =
        bedEntrySegMs > 0 && totalWindowMs ? bedEntrySegMs + totalWindowMs : totalWindowMs;

    const lastSlotEndMs =
        stagesWindowStart && renderedStages.length > 0
            ? stagesWindowStart + (renderedStages[renderedStages.length - 1].t + 5) * 60000
            : stagesWindowStart != null ? stagesWindowStart : swStart != null ? swStart : null;
    const postStageMs =
        lastSlotEndMs && _barRightTs && lastSlotEndMs < _barRightTs
            ? _barRightTs - lastSlotEndMs
            : 0;

    const outsideBedEvts = sd.outsideBedEvents;
    var clippedOutsideBedEvts = outsideBedEvts;
    if (swStart && swEnd) {
        clippedOutsideBedEvts = outsideBedEvts
            .map(function (e) {
                var start = Math.max(e.start, swStart);
                var end = Math.min(e.end, swEnd);
                if (end <= start) return null;
                return {
                    start: start,
                    end: end,
                    duration: Math.max(1, Math.round((end - start) / 60000)),
                    type: e.type,
                    confirmed: e.confirmed,
                    sensors: e.sensors || []
                };
            })
            .filter(Boolean);
    }

    const confirmedEvts = clippedOutsideBedEvts.filter(function (e) {
        return e.confirmed !== false;
    });

    const radarDropoutEvts = clippedOutsideBedEvts.filter(function (e) {
        return e.confirmed === false;
    });

    const markerTitleMap = {
        bathroom: 'Bad-Besuch',
        outside: 'Au�erhalb',
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
                '\n' +
                filteredSensors
                    .map(function (s) {
                        var timeStr = s.timestamp ? ' um ' + fmtTime(s.timestamp) : '';
                        return '  \u2022 ' + s.name + (s.location ? ' (' + s.location + ')' : '') + timeStr;
                    })
                    .join('\n');
        } else if (allSensors.length > 0) {
            sensorStr = '\n  (Sensordetails werden nach Update verf�gbar)';
        }
        if (isDropout) {
            return 'Radar-Aussetzer: ' + evt.duration + ' min (kein Au�ensensor best�tigt)' + sensorStr;
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
                        (e.departureSensor ? '\n  � ' + e.departureSensor : '')
                };
            });
    }

    var timeAxisTicks = [];
    var _axisRightTs = (bedExitTs && swEnd && bedExitTs > swEnd) ? bedExitTs : swEnd;
    var timeAxisLeft = swStart != null ? fmtTime(bedEntryTsVal != null ? bedEntryTsVal : swStart) : '';
    var timeAxisRight = _axisRightTs != null ? fmtTime(_axisRightTs) : '';
    if (swStart && swEnd && newBarTotalMs) {
        var barBaseMs = bedEntryTsVal != null ? bedEntryTsVal : swStart;
        var barTotalMs = newBarTotalMs;
        var firstTA = new Date(barBaseMs);
        firstTA.setMinutes(0, 0, 0);
        firstTA.setHours(firstTA.getHours() + 1);
        var tTick = firstTA.getTime();
        var _loopEnd = (_axisRightTs || swEnd) - 900000;
        while (tTick < _loopEnd) {
            var pctTA = ((tTick - barBaseMs) / barTotalMs) * 100;
            var tooCloseLeft = tTick - barBaseMs < 45 * 60 * 1000;
            var tooCloseRight = (_axisRightTs || swEnd) - tTick < 30 * 60 * 1000;
            if (!tooCloseLeft && !tooCloseRight && pctTA > 0 && pctTA < 100) {
                timeAxisTicks.push({ pct: pctTA, label: fmtTime(tTick) });
            }
            tTick += 3600000;
        }
        // [OC-42b] swEnd als Tick wenn bedExitTs > swEnd und mind. 45 min Abstand
        if (bedExitTs && bedExitTs > swEnd && (bedExitTs - swEnd) >= 45 * 60 * 1000) {
            var swEndPct = ((swEnd - barBaseMs) / barTotalMs) * 100;
            if (swEndPct > 0 && swEndPct < 100) {
                timeAxisTicks.push({ pct: swEndPct, label: fmtTime(swEnd) });
            }
        }
    }

    function slotColor(slot, absMs) {
        if (absMs && confirmedEvts.length > 0) {
            // [OC-42] Overlap-Check: Slot (5 Min) ueberlappt Event -> kurze Events (<5 Min) werden gefaerbt
            var _slotEnd = absMs + 5 * 60000;
            for (var ci = 0; ci < confirmedEvts.length; ci++) {
                var e = confirmedEvts[ci];
                if (e.start < _slotEnd && e.end > absMs) {
                    if (e.type !== 'other_person') return stageColor[e.type] || stageColor.outside;
                }
            }
        }
        // [OC-42b] Slots die die swEnd-Grenze ueberschreiten -> Wachliegen (gelb)
        if (absMs && swEnd && bedExitTs && bedExitTs > swEnd && (absMs + 5 * 60000) > swEnd) {
            return stageColor.wake;
        }
        return stageColor[slot.s] || '#555';
    }

    function slotTip(slot, absMs) {
        var timeStr = absMs ? fmtTime(absMs) + ' - ' : '';
        if (absMs && clippedOutsideBedEvts.length > 0) {
            var _slotEndT = absMs + 5 * 60000;
            for (var ei = 0; ei < clippedOutsideBedEvts.length; ei++) {
                var evt = clippedOutsideBedEvts[ei];
                if (evt.start < _slotEndT && evt.end > absMs) {
                    // [OC-50a] Radar-Aussetzer (kein bedAbsenceEvent) -> Balken zeigt Schlafstadium
                    var _isRealAbsence = (typeof bedAbsenceEvts !== 'undefined') && bedAbsenceEvts.some(function(ba) {
                        return ba.start <= evt.end && ba.end >= evt.start;
                    });
                    if (!_isRealAbsence) break;
                    var label = stageLabel[evt.type] || 'Abwesenheit';
                    return timeStr + label + ' (' + evt.duration + ' min)';
                }
            }
        }
        // [OC-42b] Slots nach swEnd (Aufgewacht) bis bedExitTs -> Wachliegen-Tooltip (analog slotColor)
        if (absMs && swEnd && bedExitTs && bedExitTs > swEnd && absMs >= swEnd) {
            var _wachMin = Math.round((bedExitTs - swEnd) / 60000);
            return 'Aufwachphase: ' + fmtTime(swEnd) + '�' + fmtTime(bedExitTs) + ' (' + _wachMin + ' Min)';
        }
        return timeStr + (stageLabel[slot.s] || slot.s);
    }

    const deepCount = stages.filter(function (s) { return s.s === 'deep'; }).length;
    const lightCount = stages.filter(function (s) { return s.s === 'light'; }).length;
    const remCount = stages.filter(function (s) { return s.s === 'rem'; }).length;
    const wakeCount = stages.filter(function (s) { return s.s === 'wake'; }).length;

    var bedAbsenceEvts = Array.isArray(sd.bedAbsenceEvents) ? sd.bedAbsenceEvents : [];
    if (swEnd) {
        bedAbsenceEvts = bedAbsenceEvts.filter(function (ev) {
            return ev.start < swEnd && ev.end > (swStart != null ? swStart : 0);
        });
    }
    var hasBedAbsenceEngine = bedAbsenceEvts.length > 0;

    var bedAbsenceOverlays = [];
    if (swStart && swEnd && newBarTotalMs && hasBedAbsenceEngine) {
        var _barBaseBA = bedEntryTsVal != null ? bedEntryTsVal : swStart;
        bedAbsenceEvts.forEach(function (ev) {
            var leftPct = Math.max(0, Math.min(100, ((ev.start - _barBaseBA) / newBarTotalMs) * 100));
            var widthPct = Math.max(
                0.5,
                Math.min(100 - leftPct, ((ev.end - ev.start) / newBarTotalMs) * 100)
            );
            var conf = ev.confidence || 'medium';
            var confLabel = conf === 'high' ? 'hoch' : conf === 'medium' ? 'mittel' : 'niedrig';
            var durMin =
                ev.durationMin != null
                    ? ev.durationMin
                    : Math.max(1, Math.round((ev.end - ev.start) / 60000));
            var evList = (ev.evidence || []).join(', ');
            var srcList = (ev.sources || []).join('+');
            // [OC-42] Orange wenn FP2-Abwesenheit mit Bad-Sensor-Event ueberlappt (analog HealthTab v0.33.239)
            var _overlapBad = confirmedEvts.filter(function(ce) {
                return ce.type === 'bathroom' && ce.start < ev.end && ce.end > ev.start;
            }).length > 0;
            var title = _overlapBad
                ? ('\uD83D\uDEBD Bad-Besuch (FP2 + Bad-Sensor): ' + fmtTime(ev.start) + ' \u2013 ' + fmtTime(ev.end) + ' (' + durMin + ' Min)')
                : ('\uD83D\uDEB6 Weg vom Bett: ' + fmtTime(ev.start) + ' \u2013 ' + fmtTime(ev.end) + ' (' + durMin + ' Min) \u00b7 Konfidenz: ' + confLabel + (evList ? ' \u00b7 ' + evList : '') + ' [Quellen: ' + srcList + ']');
            bedAbsenceOverlays.push({
                leftPct: leftPct,
                widthPct: widthPct,
                confidence: conf,
                isBathroom: _overlapBad,
                title: title
            });
        });
    }

    var smWakeOverlays = [];
    if (swStart && swEnd && newBarTotalMs && !hasBedAbsenceEngine) {
        var _smPh = sd.smWakePhases || [];
        _smPh.forEach(function (ph) {
            if (swEnd && ph.start >= swEnd) return;
            if (swStart != null && ph.end <= swStart) return;
            var _barBaseW = bedEntryTsVal != null ? bedEntryTsVal : swStart;
            var leftW = Math.max(0, Math.min(100, ((ph.start - _barBaseW) / newBarTotalMs) * 100));
            var widthW = Math.max(
                0.5,
                Math.min(100 - leftW, ((ph.end - ph.start) / newBarTotalMs) * 100)
            );
            var dm = ph.durationMin != null ? ph.durationMin : Math.round((ph.end - ph.start) / 60000);
            smWakeOverlays.push({
                leftPct: leftW,
                widthPct: widthW,
                title:
                    '\u23F1 Wachphase (Legacy): ' +
                    fmtTime(ph.start) +
                    ' \u2013 ' +
                    fmtTime(ph.end) +
                    ' (' +
                    dm +
                    ' Min)'
            });
        });
    }

    // [OC-42b] Gelber Wachliegen-Overlay von swEnd bis bedExitTs
    var wachliegenOverlay = null;
    if (swStart && swEnd && bedExitTs && bedExitTs > swEnd && newBarTotalMs > 0) {
        var _barBaseWL = bedEntryTsVal != null ? bedEntryTsVal : swStart;
        var _leftWL = Math.max(0, Math.min(100, ((swEnd - _barBaseWL) / newBarTotalMs) * 100));
        var _widthWL = Math.max(0.5, Math.min(100 - _leftWL, ((bedExitTs - swEnd) / newBarTotalMs) * 100));
        wachliegenOverlay = {
            leftPct: _leftWL,
            widthPct: _widthWL,
            title: 'Aufwachphase: ' + fmtTime(swEnd) + '\u2013' + fmtTime(bedExitTs) + ' (' + Math.round((bedExitTs - swEnd) / 60000) + ' min)'
        };
    }

    // [OC-SB] Shared-Bed-Overlays (schwarze Balken: 2+ Personen im Bett erkannt)
    var sharedBedOverlays = [];
    if (swStart && newBarTotalMs > 0 && sd.sharedBedPeriods && sd.sharedBedPeriods.length > 0) {
        var _barBaseSB = bedEntryTsVal != null ? bedEntryTsVal : swStart;
        sd.sharedBedPeriods.forEach(function(p) {
            if (!p.start || !p.end || p.end <= p.start) return;
            var _leftSB = Math.max(0, Math.min(100, ((p.start - _barBaseSB) / newBarTotalMs) * 100));
            var _widthSB = Math.max(0.5, Math.min(100 - _leftSB, ((p.end - p.start) / newBarTotalMs) * 100));
            var _durSB = Math.max(1, Math.round((p.end - p.start) / 60000));
            sharedBedOverlays.push({
                leftPct: _leftSB,
                widthPct: _widthSB,
                title: '👥 Zwei Personen im Bett: ' + fmtTime(p.start) + ' – ' + fmtTime(p.end) + ' (' + _durSB + ' Min)'
            });
        });
    }

    // [OC-48c v2 / Fix B] Vor-Schlaf-Abwesenheit: Ausflug zwischen Ins-Bett-Zeit und Einschlafen
    var preSleepAbsenceOverlays = [];
    var _psaArr = Array.isArray(sd.preSleepAbsenceEvents) ? sd.preSleepAbsenceEvents : [];
    if (bedEntryTsVal != null && newBarTotalMs && _psaArr.length > 0) {
        _psaArr.forEach(function (ev) {
            if (!ev || ev.start == null || ev.end == null || ev.end <= ev.start) return;
            var leftPct = Math.max(0, Math.min(100, ((ev.start - bedEntryTsVal) / newBarTotalMs) * 100));
            var widthPct = Math.max(0.5, Math.min(100 - leftPct, ((ev.end - ev.start) / newBarTotalMs) * 100));
            var durMin = ev.durationMin != null ? ev.durationMin : Math.max(1, Math.round((ev.end - ev.start) / 60000));
            preSleepAbsenceOverlays.push({
                leftPct: leftPct,
                widthPct: widthPct,
                title: '\uD83D\uDEB6 Vor dem Einschlafen ausser Bett: ' + fmtTime(ev.start) + ' \u2013 ' + fmtTime(ev.end) + ' (' + durMin + ' Min)'
            });
        });
    }

    const segments = [];
    if (newBarTotalMs && newBarTotalMs > 0) {
        if (bedEntryTsVal && bedEntrySegMs > 0) {
            segments.push({
                wPct: (bedEntrySegMs / newBarTotalMs) * 100,
                bg: '#ffd54f',
                opacity: 0.75,
                tip: 'Einschlafphase: ' + fmtTime(bedEntryTsVal) + ' – ' + (swStart ? fmtTime(swStart) : '?')
            });
        }
        if (preStageMs > 0) {
            segments.push({
                wPct: (preStageMs / newBarTotalMs) * 100,
                bg: 'preStage',
                tip: 'Keine Phasendaten'
            });
        }
        var slotWPct = (5 * 60000 / newBarTotalMs) * 100;
        renderedStages.forEach(function (slot, i) {
            var absMs = stagesWindowStart ? stagesWindowStart + slot.t * 60000 : null;
            segments.push({
                wPct: slotWPct,
                bg: slotColor(slot, absMs),
                tip: slotTip(slot, absMs),
                key: 's' + i
            });
        });
        if (postStageMs > 0) {
            var isConfirmedAwake =
                wakeSource === 'garmin' || (bedExitTs != null && swEnd != null && bedExitTs > swEnd);
            segments.push({
                wPct: (postStageMs / newBarTotalMs) * 100,
                bg: isConfirmedAwake ? stageColor.wake : 'postStage',
                opacity: isConfirmedAwake ? 0.75 : 1,
                tip: isConfirmedAwake ? 'Aufwachphase' : 'Keine Sensordaten'
            });
        }
    }

    return {
        view: 'full',
        header: headerCommon,
        legend: {
            deepMin: deepCount * 5,
            lightMin: lightCount * 5,
            remMin: remCount * 5,
            wakeMin: wakeCount * 5,
            bathMin: confirmedEvts.filter(function(e){return e.type==='bathroom';}).reduce(function(a,e){return a+e.duration;},0) || 0,
            outsideMin: confirmedEvts.filter(function(e){return (e.type||'outside')!=='bathroom' && (e.type||'outside')!=='other_person';}).reduce(function(a,e){return a+e.duration;},0) || 0,
            radarCount: radarDropoutEvts.length,
            sharedBedMin: (function() {
                if (!sd.sharedBedPeriods || !sd.sharedBedPeriods.length) return 0;
                return Math.round(sd.sharedBedPeriods.reduce(function(a, p) {
                    return a + (p.end && p.start ? (p.end - p.start) / 60000 : 0);
                }, 0));
            })()
        },
        garminPhases:
            sd.garminDeepMin != null ||
            sd.garminLightMin != null ||
            sd.garminRemMin != null ||
            sd.garminWakeMin != null ||
            sd.garminScore != null
                ? {
                      deep: sd.garminDeepMin,
                      light: sd.garminLightMin,
                      rem: sd.garminRemMin,
                      wake: sd.garminWakeMin,
                      score: sd.garminScore
                  }
                : null,
        segments: segments,
        disclaimer: true,
        markersPreSleep: preSleepMarkers,
        markersAbove: markerItems.above,
        markersBelow: markerItems.below,
        markersDropout: markerItems.dropout,
        timeAxis: {
            left: timeAxisLeft,
            right: timeAxisRight,
            ticks: timeAxisTicks
        },
        hasBedAbsenceEngine: hasBedAbsenceEngine,
        bedAbsenceOverlays: bedAbsenceOverlays,
        smWakeOverlays: smWakeOverlays,
        wachliegenOverlay: wachliegenOverlay,
        sharedBedOverlays: sharedBedOverlays,
        preSleepAbsenceOverlays: preSleepAbsenceOverlays
    };
}

module.exports = { buildSleepTilePayload, fmtTime };
