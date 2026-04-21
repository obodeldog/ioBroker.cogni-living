/* eslint-disable */
'use strict';

/*
 * cogni-living Adapter f?r ioBroker
 * Version: 0.30.38 (Fix: Scheduler Init & Robust Calendar Search)
 */

const utils = require('@iobroker/adapter-core');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');

// --- MODULE IMPORTS ---
const installer = require('./lib/installer');
const scanner = require('./lib/scanner');
const schedulers = require('./lib/scheduler');
const topology = require('./lib/topology');
const setup = require('./lib/setup');
const recorder = require('./lib/recorder');
const { isActiveValue, toPersonCount } = recorder;
const pythonBridge = require('./lib/python_bridge');
const aiAgent = require('./lib/ai_agent');
const deadMan = require('./lib/dead_man');
const automation = require('./lib/automation');
const notifications = require('./lib/notifications');
const pwaServer = require('./lib/pwa_server');
const cloudflareTunnel = require('./lib/cloudflare_tunnel');

// --- CONSTANTS ---
const GEMINI_MODEL = 'models/gemini-flash-latest';
// =============================================================================
// computePersonSleep — Einheitlicher Schlafanalyse-Algorithmus
// Wird sowohl fuer den globalen Haushalt als auch fuer Einzelpersonen verwendet.
// Single-Source-of-Truth: Keine doppelte Implementierung.
// Parameter (p): allEvents, personTag, fp2RawStart, garminTs, garminWakeTs, fp2WakeTs,
//   searchBase, wakeHardCap, startOverride, wakeOverride, existingSnap, sleepDate,
//   bathroomIds, log
// =============================================================================
function computePersonSleep(p) {
    var allEvents    = p.allEvents;
    var personTag    = p.personTag  || null;
    var fp2RawStart  = p.fp2RawStart || null;
    var garminTs     = p.garminTs    || null;
    var garminWakeTs = p.garminWakeTs || null;
    var fp2WakeTs    = p.fp2WakeTs   || null;
    var searchBase   = p.searchBase;
    var wakeHardCap  = p.wakeHardCap;
    var startOverride = p.startOverride || null;
    var wakeOverride  = p.wakeOverride  || null;
    var existingSnap  = p.existingSnap  || null;
    var sleepDate    = p.sleepDate;
    var bathroomIds  = p.bathroomIds || new Set();
    var log          = p.log;
    var logPfx       = personTag ? ('[cPS:' + personTag + '] ') : '[cPS:global] ';

    var isMine = function(e) { return !personTag || e.personTag === personTag; };
    var isOtherPerson = function(e) { return !!(personTag && e.personTag && e.personTag !== personTag); };

    var searchFromTs = (function() {
        var d = new Date(searchBase); d.setHours(18, 0, 0, 0);
        if (d.getTime() > searchBase.getTime()) d.setDate(d.getDate() - 1);
        return d.getTime();
    })();
    var bedEvts = allEvents.filter(function(e) {
        return isMine(e) && (e.isBedroomMotion || e.isFP2Bed || e.isVibrationBed)
            && (e.timestamp || 0) >= searchFromTs;
    }).sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });

    var vibRefine = function(anchorTs) {
        var maxTs = anchorTs + 3 * 3600000;
        var evts = allEvents.filter(function(e) {
            return isMine(e) && e.isVibrationBed && !e.isVibrationStrength
                && isActiveValue(e.value)
                && (e.timestamp || 0) >= anchorTs && (e.timestamp || 0) <= maxTs;
        }).sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
        for (var i = 0; i < evts.length; i++) {
            var ts = evts[i].timestamp || 0;
            var next = (i < evts.length - 1) ? (evts[i + 1].timestamp || 0) : maxTs;
            if ((next - ts) / 60000 >= 20) return ts;
        }
        return null;
    };

    var candFp2Anchor = (function() {
        if (!fp2RawStart) return null;
        var fp2Evts = bedEvts.filter(function(e) {
            var hr = new Date(e.timestamp || 0).getHours();
            return e.isFP2Bed && (hr >= 21 || hr < 2);
        });
        for (var i = fp2Evts.length - 1; i >= 0; i--) {
            var ts = fp2Evts[i].timestamp || 0;
            var nextBed = null;
            for (var j = 0; j < bedEvts.length; j++) {
                if ((bedEvts[j].timestamp || 0) > ts) { nextBed = bedEvts[j].timestamp || 0; break; }
            }
            if ((nextBed !== null ? nextBed : Infinity) - ts > 60 * 60 * 1000) return ts;
        }
        return fp2RawStart;
    })();

    var motionAnchor = (function() {
        var anchor = null;
        var fallbackEnd = searchBase.getTime() + 10 * 3600000;
        var motEvts = allEvents.filter(function(e) {
            return isMine(e) && e.isBedroomMotion && !e.isFP2Bed && isActiveValue(e.value);
        }).sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
        for (var i = 0; i < motEvts.length; i++) {
            var hr = new Date(motEvts[i].timestamp || 0).getHours();
            if (!(hr >= 18 || hr < 3)) continue;
            var nextTs = (i < motEvts.length - 1) ? (motEvts[i + 1].timestamp || 0) : fallbackEnd;
            if ((nextTs - (motEvts[i].timestamp || 0)) / 60000 >= 30) anchor = motEvts[i].timestamp || 0;
        }
        return anchor;
    })();

    var hausStillTs = (function() {
        var fallbackEnd = searchBase.getTime() + 10 * 3600000;
        var commonEvts = allEvents.filter(function(e) {
            if (isOtherPerson(e)) return false;
            if (e.isFP2Bed || e.isVibrationBed || e.isBedroomMotion || e.isBathroomSensor) return false;
            return (e.type === 'motion' || e.type === 'presence_radar_bool') && isActiveValue(e.value);
        }).sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
        for (var i = 0; i < commonEvts.length; i++) {
            var ts = commonEvts[i].timestamp || 0;
            var next = (i < commonEvts.length - 1) ? (commonEvts[i + 1].timestamp || 0) : fallbackEnd;
            if (next - ts >= 60 * 60 * 1000) return ts;
        }
        return null;
    })();

    var candFp2Vib   = candFp2Anchor ? vibRefine(candFp2Anchor) : null;
    var candFp2      = candFp2Anchor || null;
    var candMotVib   = motionAnchor  ? vibRefine(motionAnchor)  : null;
    var candMotion   = motionAnchor  || null;

    var candVibRefined = (function() {
        var end = searchBase.getTime() + 10 * 3600000;
        var evts = allEvents.filter(function(e) {
            if (!isMine(e) || !e.isVibrationBed) return false;
            if (!(isActiveValue(e.value) || toPersonCount(e.value) > 0)) return false;
            var hr = new Date(e.timestamp || 0).getHours();
            return hr >= 21 || hr < 4;
        }).sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
        for (var i = 0; i < evts.length; i++) {
            var ts = evts[i].timestamp || 0;
            var next = (i < evts.length - 1) ? (evts[i + 1].timestamp || 0) : end;
            if ((next - ts) / 60000 >= 20) return ts;
        }
        return null;
    })();

    var candGap60 = (function() {
        var end = searchBase.getTime() + 10 * 3600000;
        var evts = allEvents.filter(function(e) {
            if (!isMine(e)) return false;
            if (!(e.isFP2Bed || (e.isVibrationBed && !e.isVibrationStrength))) return false;
            var hr = new Date(e.timestamp || 0).getHours();
            return hr >= 21 || hr < 4;
        }).sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
        for (var i = 0; i < evts.length; i++) {
            var ts = evts[i].timestamp || 0;
            var next = (i < evts.length - 1) ? (evts[i + 1].timestamp || 0) : end;
            if (next - ts >= 60 * 60 * 1000) return ts;
        }
        return null;
    })();

    var candLastOutside = (function() {
        if (fp2RawStart || hausStillTs || motionAnchor) return null;
        var extEvts = allEvents.filter(function(e) {
            if (!isMine(e)) return false;
            if (e.isBedroomMotion || e.isFP2Bed || e.isVibrationBed || e.isBathroomSensor) return false;
            var hr = new Date(e.timestamp || 0).getHours();
            return (hr >= 18 || hr < 2) && isActiveValue(e.value);
        }).sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
        var eveEvts = extEvts.filter(function(e) { var hr = new Date(e.timestamp || 0).getHours(); return hr >= 18 || hr < 2; });
        for (var i = eveEvts.length - 1; i >= 0; i--) {
            var ts = eveEvts[i].timestamp || 0;
            var hasNext = extEvts.some(function(e) { return (e.timestamp || 0) > ts && (e.timestamp || 0) <= ts + 30 * 60 * 1000; });
            if (!hasNext) {
                for (var j = 0; j < bedEvts.length; j++) {
                    if ((bedEvts[j].timestamp || 0) > ts && isActiveValue(bedEvts[j].value)) return bedEvts[j].timestamp || 0;
                }
            }
        }
        return null;
    })();

    var sleepStart = null; var sleepStartSrc = 'winstart'; var overrideApplied = false;
    var ovWinMin = searchBase.getTime(); var ovWinMax = ovWinMin + 10 * 3600000;

    if (startOverride && startOverride.date === sleepDate && startOverride.ts
            && startOverride.ts >= ovWinMin && startOverride.ts <= ovWinMax) {
        sleepStart = startOverride.ts; sleepStartSrc = startOverride.source || 'override'; overrideApplied = true;
        if (log) log.info(logPfx + 'Override: ' + sleepStartSrc + ' = ' + new Date(sleepStart).toISOString());
    }
        if (!overrideApplied) {
        // Cluster-basierte Einschlafzeit-Auswahl
        // Stufe 1: Trusted (Garmin/FP2) immer vorrangig
        // Stufe 2: Dominantester Cluster innerhalb 90 Min fuer restliche Quellen
        var _sleepCandAll = [
            { source: 'garmin',       ts: garminTs,        prio: 0 },
            { source: 'fp2_vib',      ts: candFp2Vib,      prio: 1 },
            { source: 'fp2',          ts: candFp2,          prio: 2 },
            { source: 'vib_refined',  ts: candVibRefined,   prio: 3 },
            { source: 'motion_vib',   ts: candMotVib,       prio: 4 },
            { source: 'gap60',        ts: candGap60,        prio: 5 },
            { source: 'motion',       ts: candMotion,       prio: 6 },
            { source: 'last_outside', ts: candLastOutside,  prio: 7 },
            { source: 'haus_still',   ts: hausStillTs,      prio: 8 }
        ].filter(function(c) { return c.ts != null; });

        if (_sleepCandAll.length > 0) {
            var _trusted = _sleepCandAll.filter(function(c) { return c.prio <= 2; });
            if (_trusted.length > 0) {
                var _t = _trusted[0];
                sleepStart = _t.ts; sleepStartSrc = _t.source;
                if (log) log.info(logPfx + 'Onset trusted: ' + _t.source + ' @ ' + new Date(sleepStart).toISOString());
            } else {
                var _CWIN = 90 * 60 * 1000;
                var _bestCluster = null; var _bestCount = 0;
                for (var _ci = 0; _ci < _sleepCandAll.length; _ci++) {
                    var _cAnchor = _sleepCandAll[_ci].ts;
                    var _cGrp = _sleepCandAll.filter(function(c) { return Math.abs(c.ts - _cAnchor) <= _CWIN; });
                    if (_cGrp.length > _bestCount || (_cGrp.length === _bestCount && (!_bestCluster || _cAnchor < _bestCluster[0].ts))) {
                        _bestCount = _cGrp.length; _bestCluster = _cGrp;
                    }
                }
                if (_bestCluster && _bestCluster.length > 0) {
                    _bestCluster.sort(function(a,b) { return a.prio - b.prio; });
                    var _winner = _bestCluster[0];
                    sleepStart = _winner.ts; sleepStartSrc = _winner.source;
                    if (log) {
                        log.debug(logPfx + 'Onset Cluster ' + _bestCluster.length + '/' + _sleepCandAll.length + ': ' + _winner.source + ' @ ' + new Date(sleepStart).toLocaleTimeString());
                        var _outliers = _sleepCandAll.filter(function(c) { return _bestCluster.indexOf(c) < 0; });
                        if (_outliers.length > 0) log.debug(logPfx + 'Onset Ausreisser: ' + _outliers.map(function(c){return c.source+'@'+new Date(c.ts).toLocaleTimeString();}).join(', '));
                    }
                }
            }
        }
    }

    var allSleepStartSources = [
        { source: 'garmin',       ts: garminTs },
        { source: 'fp2_vib',      ts: candFp2Vib },
        { source: 'fp2',          ts: candFp2 },
        { source: 'motion_vib',   ts: candMotVib },
        { source: 'motion',       ts: candMotion },
        { source: 'vib_refined',  ts: candVibRefined },
        { source: 'gap60',        ts: candGap60 },
        { source: 'last_outside', ts: candLastOutside },
        { source: 'haus_still',   ts: hausStillTs || null },
        { source: 'fixed',        ts: ovWinMin + 2 * 3600000 }
    ];

    var p4amTs = (function() { var d = new Date(searchBase); d.setDate(d.getDate() + 1); d.setHours(4, 0, 0, 0); return d.getTime(); })();
    var minSlTs = (fp2RawStart || sleepStart || 0) + 3 * 3600000;

    var otherRoomEvts = allEvents.filter(function(e) {
        if (e.isFP2Bed || e.isVibrationBed || e.isBathroomSensor || e.isBedroomMotion) return false;
        if (isOtherPerson(e)) return false;
        return (e.type === 'motion' || e.type === 'presence_radar_bool')
            && (e.timestamp || 0) >= p4amTs && (e.timestamp || 0) >= minSlTs && (e.timestamp || 0) <= wakeHardCap;
    }).sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });

    var hasTriggerAfter4 = bedEvts.some(function(e) {
        return e.isVibrationBed && !e.isVibrationStrength && isActiveValue(e.value) && (e.timestamp || 0) >= p4amTs;
    });
    var bedRetRaw = bedEvts.filter(function(e) {
        if ((e.timestamp || 0) < p4amTs || (e.timestamp || 0) > wakeHardCap) return false;
        if (e.isFP2Bed) return true;
        if (e.isBedroomMotion && isActiveValue(e.value)) return true;
        if (e.isVibrationBed && !e.isVibrationStrength && isActiveValue(e.value)) return true;
        if (e.isVibrationStrength && !hasTriggerAfter4) return true;
        return false;
    });
    var bedRet = bedRetRaw.filter(function(e, idx) {
        if (e.isFP2Bed) return true;
        var ts = e.timestamp || 0;
        if (new Date(ts).getHours() < 10) return true;
        var prev = idx > 0 ? (bedRetRaw[idx - 1].timestamp || 0) : 0;
        var next = idx < bedRetRaw.length - 1 ? (bedRetRaw[idx + 1].timestamp || 0) : Infinity;
        return (ts - prev <= 15 * 60 * 1000) || (next - ts <= 15 * 60 * 1000);
    });

    // ============================================================
    // Wake-Kandidaten berechnen (einheitlich fuer Ein- und Mehrpersonenhaushalt)
    // ============================================================

    // vibWakeConfirm: Vibration in den 30 Min vor fp2WakeTs (erhoeht Konfidenz)
    var _vibWakeConfirm = false;
    if (fp2WakeTs) {
        _vibWakeConfirm = allEvents.some(function(e) {
            return e.isVibrationBed && isMine(e)
                && (isActiveValue(e.value) || toPersonCount(e.value) > 0)
                && (e.timestamp||0) >= fp2WakeTs - 30*60*1000
                && (e.timestamp||0) <= fp2WakeTs;
        });
    }

    // vibAloneWakeTs: letztes Vib-Event mit mind. 45 Min Stille danach
    var _vibAloneWakeTs = null;
    var _vibWakeTs = null;
    var _vibEvtsWk = allEvents.filter(function(e) {
        var ts = e.timestamp||0;
        return e.isVibrationBed && isMine(e)
            && (isActiveValue(e.value) || toPersonCount(e.value) > 0)
            && ts >= p4amTs && ts >= minSlTs && ts <= wakeHardCap;
    }).sort(function(a,b) { return (a.timestamp||0)-(b.timestamp||0); });
    for (var _vwi = 0; _vwi < _vibEvtsWk.length; _vwi++) {
        var _vwTs = _vibEvtsWk[_vwi].timestamp||0;
        var _vwNext = _vibEvtsWk[_vwi+1] ? (_vibEvtsWk[_vwi+1].timestamp||0) : null;
        if (!_vwNext || _vwNext - _vwTs >= 45*60*1000) { _vibAloneWakeTs = _vwTs; }
    }

    // vibWakeTs: letztes Vib-Event VOR fp2WakeTs (Bestaetiger)
    if (fp2WakeTs && _vibEvtsWk.length > 0) {
        var _pvBefore = _vibEvtsWk.filter(function(e) { return (e.timestamp||0) <= fp2WakeTs; });
        if (_pvBefore.length > 0) _vibWakeTs = _pvBefore[_pvBefore.length-1].timestamp||null;
    }

    // fp2OtherWakeTs: erste andere-Raum-Bewegung nach fp2WakeTs (max. +60 Min)
    var _fp2OtherWakeTs = null;
    if (fp2WakeTs) {
        var _fp2OtherEvts = allEvents.filter(function(e) {
            return !e.isFP2Bed && !e.isVibrationBed && !e.isBathroomSensor && !e.isBedroomMotion
                && (e.type === 'motion' || e.type === 'presence_radar_bool')
                && !isOtherPerson(e)
                && (e.timestamp||0) >= fp2WakeTs && (e.timestamp||0) <= fp2WakeTs + 60*60*1000;
        }).sort(function(a,b){ return (a.timestamp||0)-(b.timestamp||0); });
        if (_fp2OtherEvts.length > 0) _fp2OtherWakeTs = _fp2OtherEvts[0].timestamp||null;
    }

    // fp2VibWakeTs: FP2 + Vib kombiniert (bei enger Korrelation + Bestaetigung)
    var _fp2VibWakeTs = null;
    if (fp2WakeTs && _vibWakeTs && Math.abs(_vibWakeTs - fp2WakeTs) <= 12*60*1000 && _vibWakeConfirm) {
        _fp2VibWakeTs = Math.min(fp2WakeTs, _vibWakeTs);
    }

    // motionVibWakeTs: Schlafzimmer-BM + Vibrations-Bestaetigung (Pendant zu fp2_vib fuer Haeuser ohne Radar)
    // Findet: Ersten Schlafzimmer-BM-Abgang nach 04:00 bei dem in den vorangehenden 30 Min Vibration war
    var _motionVibWakeTs = null;
    var _bedroomMotEvts = allEvents.filter(function(e) {
        return e.isBedroomMotion && isMine(e) && !isOtherPerson(e)
            && (e.timestamp||0) >= p4amTs && (e.timestamp||0) >= minSlTs && (e.timestamp||0) <= wakeHardCap;
    }).sort(function(a,b){ return (a.timestamp||0)-(b.timestamp||0); });
    if (_bedroomMotEvts.length > 0) {
        var _bmFirst = _bedroomMotEvts[0].timestamp || 0;
        var _bmVibBefore = _vibEvtsWk.some(function(e) {
            return (e.timestamp||0) >= _bmFirst - 30*60*1000 && (e.timestamp||0) <= _bmFirst;
        });
        if (_bmVibBefore) _motionVibWakeTs = _bmFirst;
    }

    // otherRoomWakeTs explizit (fuer allWakeSources)
    var _otherRoomWakeTs = null;

    // ============================================================
    // Wake-Prioritaetskette (identisch fuer Ein- und Mehrpersonenhaushalt)
    var wakeTs = null; var wakeSrc = null;
    if (garminWakeTs) { wakeTs = garminWakeTs; wakeSrc = 'garmin'; if (log) log.info(logPfx + 'Wake Garmin: ' + new Date(wakeTs).toISOString()); }
    if (!wakeTs && _fp2VibWakeTs)   { wakeTs = _fp2VibWakeTs;   wakeSrc = 'fp2_vib'; }
    if (!wakeTs && fp2WakeTs)       { wakeTs = fp2WakeTs;       wakeSrc = 'fp2'; if (log) log.debug(logPfx + 'Wake FP2: ' + new Date(wakeTs).toISOString()); }
    if (!wakeTs && _fp2OtherWakeTs) { wakeTs = _fp2OtherWakeTs; wakeSrc = 'fp2_other'; }
    if (!wakeTs && otherRoomEvts.length > 0) {
        var ci = 0;
        while (ci < otherRoomEvts.length) {
            var dep = otherRoomEvts[ci].timestamp || 0; var ret = null;
            for (var bi = 0; bi < bedRet.length; bi++) { if ((bedRet[bi].timestamp || 0) > dep + 2 * 60 * 1000) { ret = bedRet[bi]; break; } }
            if (!ret) { wakeTs = dep; wakeSrc = 'other'; _otherRoomWakeTs = dep; break; }
            var ni = -1;
            for (var oi = ci + 1; oi < otherRoomEvts.length; oi++) { if ((otherRoomEvts[oi].timestamp || 0) > (ret.timestamp || 0) + 2 * 60 * 1000) { ni = oi; break; } }
            if (ni === -1) { wakeTs = null; break; }
            ci = ni;
        }
    }
    if (!wakeTs && _motionVibWakeTs) { wakeTs = _motionVibWakeTs; wakeSrc = 'motion_vib'; }
    if (!wakeTs && _vibAloneWakeTs) { wakeTs = _vibAloneWakeTs; wakeSrc = 'vibration_alone'; }
    if (wakeTs === null && bedRet.length > 0) { wakeTs = bedRet[bedRet.length - 1].timestamp || null; wakeSrc = 'motion'; }

    if (!garminWakeTs && existingSnap && existingSnap.sleepWindowEnd) {
        var exWakeHr = new Date(existingSnap.sleepWindowEnd).getHours();
        var exWakeAge = Date.now() - existingSnap.sleepWindowEnd;
        if (exWakeHr >= 5 && exWakeAge > 2 * 3600000) {
            wakeTs = existingSnap.sleepWindowEnd; wakeSrc = existingSnap.wakeSource || wakeSrc;
            if (log) log.info(logPfx + 'Wake FROZEN: ' + new Date(wakeTs).toLocaleTimeString());
        }
    }
    var wakeOverrideApplied = false;
    if (wakeOverride && wakeOverride.date === sleepDate && wakeOverride.ts) {
        wakeTs = wakeOverride.ts; wakeSrc = wakeOverride.source || 'override'; wakeOverrideApplied = true;
        if (log) log.info(logPfx + 'Wake Override: ' + wakeSrc + ' = ' + new Date(wakeTs).toISOString());
    }

    var allWakeSources = [
        { source: 'garmin',          ts: garminWakeTs       || null },
        { source: 'fp2_vib',         ts: _fp2VibWakeTs      || null },
        { source: 'fp2',             ts: fp2WakeTs          || null },
        { source: 'fp2_other',       ts: _fp2OtherWakeTs    || null },
        { source: 'other',           ts: _otherRoomWakeTs   || null },
        { source: 'motion_vib',       ts: _motionVibWakeTs   || null },
        { source: 'vibration_alone', ts: _vibAloneWakeTs    || null },
        { source: 'vibration',       ts: _vibWakeTs         || null },
        { source: 'motion',          ts: wakeSrc === 'motion' ? wakeTs : null },
        { source: 'override',        ts: wakeOverrideApplied  ? wakeTs : null }
    ];
    var wakeConf = wakeTs
        ? (wakeSrc === 'garmin' || wakeSrc === 'fp2' ? 'hoch' : wakeSrc === 'other' ? 'mittel' : 'niedrig')
        : 'niedrig';
    var wakeConfirmed = !!(wakeTs && new Date().getHours() >= 10 && (Date.now() - wakeTs) >= 3600000);

    var winSCheck = sleepStart || fp2RawStart || searchBase.getTime();
    var winECheck = wakeTs || Date.now();
    var bedInWin = (winSCheck <= winECheck)
        ? bedEvts.filter(function(e) { var ts = e.timestamp || 0; return ts >= winSCheck && ts <= winECheck; })
        : bedEvts.filter(function(e) { var ts = e.timestamp || 0; return ts >= (fp2RawStart || searchBase.getTime()) && ts <= winECheck; });
    var bedWasEmpty = bedInWin.length === 0;

    var obe = [];
    var obeWinS = sleepStart || fp2RawStart || searchBase.getTime();
    var obeWinE = wakeTs || Date.now();
    if (obeWinS < obeWinE) {
        var obeAllSrc = allEvents.filter(function(e) {
            var ts = e.timestamp || 0;
            if (ts < obeWinS || ts > obeWinE) return false;
            if (e.isFP2Bed || e.isVibrationBed || e.isBedroomMotion) return false;
            if (isOtherPerson(e)) return false;
            return (e.type === 'motion' || e.type === 'presence_radar_bool') && isActiveValue(e.value);
        }).sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
        var obeCluster = null; var obeCGap = 5 * 60 * 1000; var obeCAfter = 3 * 60 * 1000;
        var obePush = function(c) {
            var dur = Math.max(1, Math.round((c.end - c.start) / 60000));
            if (c.hasBath) {
                obe.push({ start: c.start, end: c.end, duration: dur, type: 'bathroom', confirmed: true, sensors: c.sensors || [] });
                if (c.hasOther) obe.push({ start: c.start, end: c.end, duration: dur, type: 'outside', confirmed: true, sensors: c.sensors || [] });
            } else { obe.push({ start: c.start, end: c.end, duration: dur, type: 'outside', confirmed: true, sensors: c.sensors || [] }); }
        };
        obeAllSrc.forEach(function(e) {
            var ts = e.timestamp || 0; var isBath = e.isBathroomSensor || bathroomIds.has(e.id);
            if (!obeCluster) {
                obeCluster = { start: ts, end: ts + obeCAfter, hasBath: isBath, hasOther: !isBath, sensors: [{ name: e.name || e.id, location: e.location || '', isBathroomSensor: isBath, timestamp: ts }] };
            } else if (ts <= obeCluster.end + obeCGap) {
                obeCluster.end = ts + obeCAfter; if (isBath) obeCluster.hasBath = true; else obeCluster.hasOther = true;
                var sn = e.name || e.id; if (!obeCluster.sensors.some(function(s) { return s.name === sn; })) obeCluster.sensors.push({ name: sn, location: e.location || '', isBathroomSensor: isBath, timestamp: ts });
            } else { obePush(obeCluster); obeCluster = { start: ts, end: ts + obeCAfter, hasBath: isBath, hasOther: !isBath, sensors: [{ name: e.name || e.id, location: e.location || '', isBathroomSensor: isBath, timestamp: ts }] }; }
        });
        if (obeCluster) obePush(obeCluster);
    }

    var sleepStages = []; var stagesWinStart = sleepStart || fp2RawStart || searchBase.getTime(); var stagesWinEnd = wakeTs || (wakeHardCap && wakeHardCap < Date.now() ? wakeHardCap : null);
    var sleepScore = null; var sleepScoreRaw = null;
    if (!bedWasEmpty && stagesWinStart && stagesWinEnd && stagesWinEnd > stagesWinStart) {
        var SLOT_MS = 5 * 60 * 1000;
        var slotCount = Math.ceil((stagesWinEnd - stagesWinStart) / SLOT_MS);
        var vibDetEvts = allEvents.filter(function(e) {
            return isMine(e) && e.isVibrationBed && (e.timestamp || 0) >= stagesWinStart && (e.timestamp || 0) <= stagesWinEnd
                && (isActiveValue(e.value) || toPersonCount(e.value) > 0);
        });
        var vibStrEvts = allEvents.filter(function(e) {
            return isMine(e) && e.isVibrationStrength && (e.timestamp || 0) >= stagesWinStart && (e.timestamp || 0) <= stagesWinEnd;
        });
        var consQuiet = 0; var deepSec = 0; var lightSec = 0; var remSec = 0; var wakeSec2 = 0;
        for (var si = 0; si < slotCount; si++) {
            var slotS = stagesWinStart + si * SLOT_MS; var slotE = slotS + SLOT_MS;
            var slotDet = vibDetEvts.filter(function(e) { return (e.timestamp || 0) >= slotS && (e.timestamp || 0) < slotE; }).length;
            var slotStrArr = vibStrEvts.filter(function(e) { return (e.timestamp || 0) >= slotS && (e.timestamp || 0) < slotE; })
                .map(function(e) { return typeof e.value === 'number' ? e.value : parseFloat(e.value) || 0; });
            var slotStrMax = slotStrArr.length > 0 ? Math.max.apply(null, slotStrArr) : 0;
            var hoursIn = (slotS - stagesWinStart) / 3600000; var stage;
            if (slotDet === 0)                                                                { consQuiet++; stage = consQuiet >= 5 ? 'deep' : 'light'; }
            else if (slotDet >= 5 || slotStrMax > 28)                                         { consQuiet = 0; stage = 'wake'; }
            else if (slotDet >= 2 && hoursIn >= 2.5 && slotStrMax >= 12 && slotStrMax <= 28)  { consQuiet = 0; stage = 'rem'; }
            else                                                                               { consQuiet = 0; stage = 'light'; }
            sleepStages.push({ t: si * 5, s: stage });
            if (stage === 'deep') deepSec += 300; else if (stage === 'light') lightSec += 300;
            else if (stage === 'rem') remSec += 300; else wakeSec2 += 300;
        }
        if (log) log.debug(logPfx + 'Stages: ' + sleepStages.length + ' Slots (' + new Date(stagesWinStart).toLocaleTimeString() + '-' + new Date(stagesWinEnd).toLocaleTimeString() + ')');
        var totalSec = deepSec + lightSec + remSec + wakeSec2;
        var durMin = (stagesWinEnd - stagesWinStart) / 60000;
        var durScore = Math.max(20, Math.min(95, 25 + 0.12 * durMin)); var stageAdj = 0;
        if (totalSec > 0) {
            var rp = remSec / totalSec; var wp = wakeSec2 / totalSec;
            var coverage = Math.min(1, (totalSec / 60) / Math.max(1, durMin));
            stageAdj = Math.max(-8, Math.min(8, Math.round((rp * 30 - wp * 50) * coverage)));
        }
        sleepScoreRaw = Math.round(Math.max(0, durScore + stageAdj));
        sleepScore    = Math.round(Math.max(0, Math.min(100, sleepScoreRaw)));
        if (log) log.debug(logPfx + 'Score=' + sleepScore + ' dur=' + Math.round(durMin) + 'min adj=' + stageAdj);
    }

    return {
        sleepWindowStart:     sleepStart,
        sleepWindowEnd:       wakeTs,
        sleepStartSource:     sleepStartSrc,
        allSleepStartSources: allSleepStartSources,
        sleepStartOverridden: overrideApplied,
        wakeSource:           wakeSrc || null,
        allWakeSources:       allWakeSources,
        wakeConf:             wakeConf,
        wakeConfirmed:        wakeConfirmed,
        wakeOverridden:       wakeOverrideApplied,
        bedWasEmpty:          bedWasEmpty,
        outsideBedEvents:     obe,
        sleepStages:          sleepStages,
        stagesWindowStart:    stagesWinStart,
        sleepScore:           sleepScore,
        sleepScoreRaw:        sleepScoreRaw,
        _motionAnchor:        motionAnchor,
        _hausStillTs:         hausStillTs
    };
}


class CogniLiving extends utils.Adapter {
    constructor(options) {
        super({ ...options, name: 'cogni-living' });
        this.eventHistory = []; this.analysisHistory = []; this.rawEventLog = []; this.dailyDigests = []; this.sensorLastValues = {};
        this.systemConfig = { latitude: 0, longitude: 0, city: '' }; this.isPresent = true; this.exitTimer = null; this.exitGraceTimer = null; this.isGracePeriodActive = false;
        this.genAI = null; this.geminiModel = null; this.currentSystemMode = setup.SYSTEM_MODES.NORMAL; this.isProVersion = false; this.lastAlertState = false;
        this.analysisTimer = null; this.calendarCheckTimer = null; this.presenceCheckTimer = null; this.ltmJob = null; this.modeResetJob = null; this.driftAnalysisTimer = null; this.briefingJob = null; this.weeklyBriefingJob = null;
        this.historyJob = null;

        this.trackerHeartbeat = null;
        this.healthTrendInterval = null;
        this.roomIntegratorTimer = null;

        this.dependencyInstallInProgress = false;
        this.lastTrackerEventTime = Date.now();

        this.memoryCache = null;
        this.bootTime = Date.now();

        this.infrasoundLocked = false;
        this.pressureBuffer = [];

        // Sensor-Ausfall-Erkennung
        this.sensorLastSeen = {};    // { sensorId: timestamp }
        this.sensorAlertSent = {};   // { sensorId: lastAlertTs } - verhindert Spam
        this.sensorCheckInterval = null;

        // OC-15: Batterie-Monitoring
        this.batteryStates = {};           // { sensorId: { stateId, level, isLow, isCritical, source } }
        this.batteryDiscoveryInterval = null;
        this._lastBatteryPushoverDay = null;

        // Active Modules
        this.activeModules = { health: true, security: true, energy: true, comfort: true };

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
        this.on('message', this.onMessage.bind(this));
    }

    async onReady() {
        this.log.info(`cogni-living adapter starting (v${this.version}) - Phase E (Scheduler Fix)`);

        if (this.config.moduleHealth !== undefined) this.activeModules.health = this.config.moduleHealth;
        if (this.config.moduleSecurity !== undefined) this.activeModules.security = this.config.moduleSecurity;
        if (this.config.moduleEnergy !== undefined) this.activeModules.energy = this.config.moduleEnergy;
        if (this.config.moduleComfort !== undefined) this.activeModules.comfort = this.config.moduleComfort;
        if (this.config.modules) this.activeModules = { ...this.activeModules, ...this.config.modules };

        this.startSystem();
    }

    async startSystem() {
        await setup.initZombies(this);
        try { this.isProVersion = await setup.checkLicense(this.config.licenseKey); } catch(e) {}
        if (!this.config.inactivityThresholdHours || this.config.inactivityThresholdHours < 0.1) this.config.inactivityThresholdHours = 12;

        await setup.initHistory(this);
        await setup.initSystemConfig(this);
        
        // Update Topology Matrix beim Start
        topology.updateTopology(this);

        try {
            const wt = await this.getStateAsync('analysis.energy.warmupTimes');
            const ws = await this.getStateAsync('analysis.energy.warmupSources');
            if (wt && wt.val && ws && ws.val) {
                if (Date.now() - wt.ts < 4 * 3600 * 1000) {
                    this.memoryCache = { times: JSON.parse(wt.val), sources: JSON.parse(ws.val) };
                }
            }
        } catch(e) {}

        if (this.config.geminiApiKey) {
            try {
                this.genAI = new GoogleGenerativeAI(this.config.geminiApiKey);
                this.geminiModel = this.genAI.getGenerativeModel({ model: GEMINI_MODEL, generationConfig: { responseMimeType: 'application/json' } });
            } catch (error) { this.log.error(`Gemini Init Error: ${error.message}`); }
        }

        await setup.createAllObjects(this);
        await this.loadSystemMode();

        // --- FIX: START SCHEDULERS (This was missing!) ---
        schedulers.initSchedules(this);
        // -------------------------------------------------

        // Migration: V2-Score einmalig fuer alte History-Dateien berechnen
        this.migrateScoresToV2().catch(e => this.log.warn('[ScoreMigration] ' + e.message));

        await this.setObjectNotExistsAsync('analysis.visualization.pulse', { type: 'state', common: { name: 'Live Event Pulse', type: 'number', role: 'value', read: true, write: false }, native: {} });
        await this.setObjectNotExistsAsync('analysis.activity.roomStats', { type: 'state', common: { name: 'Room Dwell Time Stats', type: 'string', role: 'json', read: true, write: false, def: '{"today":{}, "yesterday":{}, "date":""}' }, native: {} });
        await this.setObjectNotExistsAsync('analysis.activity.roomHistory', { type: 'state', common: { name: 'Room History (24h Buckets)', type: 'string', role: 'json', read: true, write: false, def: '{"history":{}}' }, native: {} });
        await this.setObjectNotExistsAsync('analysis.health.geminiNight', { type: 'state', common: { name: 'Gemini Report Night', type: 'string', role: 'text', read: true, write: false, def: 'Warte auf Analyse...' }, native: {} });
        await this.setObjectNotExistsAsync('analysis.health.geminiDay', { type: 'state', common: { name: 'Gemini Report Day', type: 'string', role: 'text', read: true, write: false, def: 'Warte auf Analyse...' }, native: {} });

        await this.setObjectNotExistsAsync('analysis.health.todayVector', { type: 'state', common: { name: 'Daily Activity Vector (48x30min)', type: 'string', role: 'json', read: true, write: false, def: '[]' }, native: {} });
        await this.setObjectNotExistsAsync('analysis.health.todayRoomDetails', { type: 'state', common: { name: 'Daily Room Details (48x30min)', type: 'string', role: 'json', read: true, write: false, def: '[]' }, native: {} });

        await this.setObjectNotExistsAsync('analysis.health.activityTrend', { type: 'state', common: { name: 'General Activity Trend', type: 'number', role: 'value', unit: '%', read: true, write: false }, native: {} });
        // Phase 2: Krankheits-Risiko-Scores States anlegen
        await this.setObjectNotExistsAsync('analysis.health.disease.scores', { type: 'state', common: { name: 'Disease Risk Scores (JSON)', type: 'string', role: 'json', read: true, write: false, def: '{}' }, native: {} });
        for (const _dp of ['fallRisk','dementia','frailty','depression','diabetes2','sleepDisorder','cardiovascular','parkinson','copd','socialIsolation','epilepsy','diabetes1','longCovid','bipolar']) {
            await this.setObjectNotExistsAsync('analysis.health.disease.' + _dp, { type: 'state', common: { name: 'Disease Risk: ' + _dp, type: 'number', role: 'value', unit: '%', read: true, write: false, def: 0 }, native: {} });
        }
        // Phase 3: Proaktives Screening State
        await this.setObjectNotExistsAsync('analysis.health.screening.hints', { type: 'state', common: { name: 'Proactive Screening Hints (JSON)', type: 'string', role: 'json', read: true, write: false, def: '{}' }, native: {} });
        await this.setObjectNotExistsAsync('analysis.health.sleepCalibrationLog', {
            type: 'state',
            common: {
                name: 'Sleep Calibration Log (JSON) - Sensorquellen vs Garmin',
                type: 'string',
                role: 'json',
                read: true,
                write: false,
                def: '[]'
            },
            native: {}
        });
        await this.setObjectNotExistsAsync('analysis.sleep.startOverride', { type: 'state', common: { name: 'Sleep Start Override (OC-23) - JSON', type: 'string', role: 'json', read: true, write: true, def: 'null' }, native: {} });
        await this.setObjectNotExistsAsync('analysis.sleep.personStartOverrides', { type: 'state', common: { name: 'Per-Person Sleep Start Overrides (JSON)', type: 'string', role: 'json', read: true, write: true, def: 'null' }, native: {} });
        await this.setObjectNotExistsAsync('analysis.sleep.wakeOverride', { type: 'state', common: { name: 'Wake Override (JSON)', type: 'string', role: 'json', read: true, write: true, def: 'null' }, native: {} });
        await this.setObjectNotExistsAsync('analysis.sleep.personWakeOverrides', { type: 'state', common: { name: 'Per-Person Wake Overrides (JSON)', type: 'string', role: 'json', read: true, write: true, def: 'null' }, native: {} });
        await this.setObjectNotExistsAsync('system.sensorBatteryStatus', { type: 'state', common: { name: 'Sensor Battery Status (JSON)', type: 'string', role: 'json', read: true, write: false, def: '{}' }, native: {} });
        await this.setObjectNotExistsAsync('system.sensorStatus', { type: 'state', common: { name: 'Sensor Health Status (JSON)', type: 'string', role: 'json', read: true, write: false, def: '{}' }, native: {} });
        await this.setObjectNotExistsAsync('system.currentPersonCount', { type: 'state', common: { name: 'Aktuelle Personenanzahl im Haus', type: 'number', role: 'value', unit: 'Personen', read: true, write: false, def: 1, desc: 'Geschaetzte Personenanzahl (Config-Baseline + raeumliche Heuristik + FP2)' }, native: {} });
        await this.setObjectNotExistsAsync('system.personCount.heuristicDetection', { type: 'state', common: { name: 'Personenerkennung: Heuristik-Ereignis (SQL) - mind. 2 Personen erkannt', type: 'string', role: 'json', read: true, write: false, def: '{}', desc: 'Wird bei jeder rauemlichen Unmoglichkeitserkennung (>= 2 Hops, <= 5s) geschrieben. Enthaelt: Sensor-IDs, Raeume, Hop-Abstand, Zeitdelta, Personenzahl vorher/nachher.' }, native: {} });
        await this.setObjectNotExistsAsync('system.personCount.sensorActivity', { type: 'state', common: { name: 'Personenerkennung: Sensor-Aktivitaet (SQL) - Bewegung/Praesenz/Tuer-Fenster', type: 'string', role: 'json', read: true, write: false, def: '{}', desc: 'Jede steigende Flanke eines person-relevanten Sensors (isPersonPresenceActivity). Kein Licht, kein Temperatur.' }, native: {} });
        await this.setObjectNotExistsAsync('system.config.sensorList', { type: 'state', common: { name: 'Sensor-Konfiguration (Uebersicht)', type: 'string', role: 'json', read: true, write: false, def: '[]', desc: 'Alle konfigurierten Sensoren aus dem System-Tab: ID, Bezeichnung, Ort, Typ, Funktion. Wird bei jedem Adapterstart aktualisiert.' }, native: {} });
        await this.setObjectNotExistsAsync('system.householdType', { type: 'state', common: { name: 'Haushaltstyp', type: 'string', role: 'text', states: { single: 'Einpersonenhaushalt', multi: 'Mehrpersonenhaushalt' }, read: true, write: false, def: 'single' }, native: {} });
        await this.setObjectNotExistsAsync('system.personData', { type: 'state', common: { name: 'Per-Person Night Metrics (JSON)', type: 'string', role: 'json', read: true, write: false, def: '{}' }, native: {} });
        await this.setObjectNotExistsAsync('analysis.energy.warmupTimes', { type: 'state', common: { name: 'Warm-Up Time', type: 'string', role: 'json', read: true, write: false }, native: {} });

        try {
            const s = await this.getStateAsync('events.history');
            if (s && s.val) {
                this.eventHistory = JSON.parse(s.val);
                if(this.isProVersion) {
                    const r = await this.getStateAsync('LTM.rawEventLog');
                    if(r && r.val) this.rawEventLog = JSON.parse(r.val);
                }
                this.log.info(`?? Restored ${this.eventHistory.length} events from standard storage.`);
            }
        } catch(e){ this.eventHistory = []; }

        try { const s = await this.getStateAsync('LTM.dailyDigests'); if (s && s.val) this.dailyDigests = JSON.parse(s.val); } catch(e){ this.dailyDigests = []; }

        const msg = this.dailyDigests.length >= (this.config.minDaysForBaseline || 7) ? `Aktiv (${this.dailyDigests.length} Tage)` : `Lernphase (${this.dailyDigests.length}/${this.config.minDaysForBaseline || 7})`;
        await this.setStateAsync('LTM.baselineStatus', { val: msg, ack: true });

        this.subscribeStates('analysis.trigger');
        this.subscribeStates('LTM.triggerDailyDigest');
        this.subscribeStates('analysis.training.triggerHealth');
        this.subscribeStates('analysis.triggerBriefing');
        this.subscribeStates('analysis.triggerWeeklyBriefing');

        if (this.config.infrasoundEnabled && this.config.infrasoundSensorId && this.activeModules.security) {
            this.subscribeForeignStates(this.config.infrasoundSensorId);
        }
        const devices = this.config.devices; if (devices) { for (const d of devices) { await this.subscribeForeignStatesAsync(d.id); } }

        // system.config.sensorList: Sensor-Konfiguration bei Start schreiben (Kontroll-Objekt)
        try {
            const _sensorListData = (this.config.devices || []).map(function(d) {
                return {
                    id:              d.id || '',
                    bezeichnung:     d.name || '',
                    ort:             d.location || '',
                    typ:             d.type || '',
                    funktion:        d.sensorFunction || '',
                    isBathroomSensor: !!(d.sensorFunction === 'bathroom' || d.isBathroomSensor),
                    isKitchenSensor:  !!(d.sensorFunction === 'kitchen'  || d.isKitchenSensor),
                    isFP2Bed:         !!(d.sensorFunction === 'bed'      && (d.type||'').toLowerCase() === 'presence_radar_bool'),
                    isVibrationBed:   !!(d.sensorFunction === 'bed'      && ['vibration_trigger','vibration_strength'].includes((d.type||'').toLowerCase())),
                    isBedroomMotion:  !!(d.sensorFunction === 'bed'      && (d.type||'').toLowerCase() === 'motion'),
                };
            });
            await this.setStateAsync('system.config.sensorList', { val: JSON.stringify(_sensorListData, null, 2), ack: true });
        } catch(_e) { this.log.warn('[Config] Fehler beim Schreiben der sensorList: ' + _e.message); }

        const devs = this.config.presenceDevices; if (devs) { for (const id of devs) { await this.subscribeForeignStatesAsync(id); } }

        // Option B: sensorLastValues mit echten aktuellen States initialisieren (Duplikat-Filter nach Neustart)
        // Verhindert dass Sensoren die sich waehrend Adapter-Downtime NICHT veraendert haben als 'neue Aktivitaet' zaehlen.
        // Nur Sensoren ueberschreiben deren State aktuell in ioBroker vorliegt.
        try {
            const _allDevices = (this.config.devices || []);
            for (const _dev of _allDevices) {
                if (!_dev.id) continue;
                try {
                    const _currentState = await this.getForeignStateAsync(_dev.id);
                    if (_currentState && _currentState.val !== undefined && _currentState.val !== null) {
                        this.sensorLastValues[_dev.id] = _currentState.val;
                    }
                } catch (e) { /* Sensor nicht erreichbar, Initialwert aus History bleibt */ }
            }
            this.log.info(`Sensor baseline initialized for ${_allDevices.length} devices (duplicate filter ready).`);
        } catch (e) {
            this.log.warn('Sensor baseline init failed: ' + e.message);
        }

        const schedule = require('node-schedule');
        if (this.historyJob) this.historyJob.cancel();
        this.historyJob = schedule.scheduleJob({ hour: 23, minute: 59, second: 59 }, () => {
            this.saveDailyHistory();
        });

        setTimeout(() => this.replayTodayEvents(), 5000);
        // Startup-Save: heute-Datei nach Replay schreiben damit Charts sofort Balken zeigen
        setTimeout(() => this.saveDailyHistory().catch(e => {}), 90000);

        // householdType-Baseline aus Config setzen (gilt solange kein FP2-Sensor live ueberschreibt)
        var _hsMap = { single: 'single', couple: 'multi', family: 'multi' };
        var _hsCfg = this.config.householdSize || 'single';
        var _hsBaseline = _hsMap[_hsCfg] || 'single';
        var _hsCount = _hsCfg === 'single' ? 1 : _hsCfg === 'couple' ? 2 : 3;
        this.setStateAsync('system.householdType', { val: _hsBaseline, ack: true }).catch(function(){});
        this.setStateAsync('system.currentPersonCount', { val: _hsCount, ack: true }).catch(function(){});
        this.log.info('Haushaltsgroesse (Config-Baseline): ' + _hsCfg + ' -> householdType=' + _hsBaseline + ', count=' + _hsCount);

        // Sensor-LastSeen aus eventHistory initialisieren (auch nach Adapter-Neustart)
        if (this.eventHistory && this.eventHistory.length > 0) {
            this.eventHistory.forEach(function(e) { if (e.id && e.timestamp) { var cur = this.sensorLastSeen[e.id]; if (!cur || e.timestamp > cur) this.sensorLastSeen[e.id] = e.timestamp; } }.bind(this));
        }
        // St?ndlicher Sensor-Ausfall-Check
        if (this.sensorCheckInterval) clearInterval(this.sensorCheckInterval);
            if (this.batteryDiscoveryInterval) clearInterval(this.batteryDiscoveryInterval);
        this.sensorCheckInterval = setInterval(() => { this.checkSensorHealth(); }, 60 * 60 * 1000);
        // St?ndlicher History-Save: heute-Datei aktuell halten damit Chart heute-Balken zeigt
        if (this.hourlySaveInterval) clearInterval(this.hourlySaveInterval);
        this.hourlySaveInterval = setInterval(() => { this.saveDailyHistory().catch(e => {}); }, 60 * 60 * 1000);
        setTimeout(() => this.checkSensorHealth(), 5 * 60 * 1000); // auch 5 min nach Start

        // OC-15: Batterie-Discovery beim Start und alle 12 Stunden
        if (this.batteryDiscoveryInterval) clearInterval(this.batteryDiscoveryInterval);
        this.discoverBatteryStates().then(() => this.checkBatteryLevels()).catch(e => this.log.warn('[BATTERY] Init error: ' + e.message));
        this.batteryDiscoveryInterval = setInterval(async () => {
            try { await this.discoverBatteryStates(); await this.checkBatteryLevels(); } catch(e) {}
        }, 12 * 60 * 60 * 1000);

        if (this.roomIntegratorTimer) clearInterval(this.roomIntegratorTimer);
        this.integrateRoomTime();
        this.roomIntegratorTimer = setInterval(async () => {
            await this.integrateRoomTime();
        }, 60 * 1000);

        if (this.healthTrendInterval) clearInterval(this.healthTrendInterval);
        this.healthTrendInterval = setInterval(() => {
            if (this.isProVersion && this.activeModules.health) {
                this.runPythonHealthCheck();
            }
        }, 4 * 60 * 60 * 1000);

        // Energy Prediction Timer (alle 15 Minuten)
        if (this.analysisTimer) clearInterval(this.analysisTimer);
        if (this.activeModules.energy) {
            this.analysisTimer = setInterval(() => {
                this.triggerEnergyPrediction();
            }, 60 * 60 * 1000); // 1 Stunde // 15 Minuten
            // Initialer Run nach 10 Sekunden
            setTimeout(() => this.triggerEnergyPrediction(), 10000);
        }

        // Calendar Check Timer (alle 2 Minuten) - KRITISCH f?r rechtzeitiges Heizen!
        if (this.calendarCheckTimer) clearInterval(this.calendarCheckTimer);
        if (this.config.useCalendar && this.activeModules.energy) {
            this.calendarCheckTimer = setInterval(() => {
                automation.checkCalendarTriggers(this);
            }, 2 * 60 * 1000); // 2 Minuten
            // Initialer Run nach 15 Sekunden
            setTimeout(() => automation.checkCalendarTriggers(this), 15000);
        }

        // Presence Check Timer (alle 1 Minute) - Aktualisiert "Bewohner Anwesend"
        if (this.presenceCheckTimer) clearInterval(this.presenceCheckTimer);
        if (this.config.presenceDevices && this.config.presenceDevices.length > 0) {
            this.presenceCheckTimer = setInterval(async () => {
                await this.checkWifiPresence();
            }, 60 * 1000); // 1 Minute
            // Initialer Run nach 5 Sekunden
            setTimeout(async () => await this.checkWifiPresence(), 5000);
        }

        const manualPythonPath = path.join(__dirname, '.venv', 'bin', 'python');
        pythonBridge.startService(this, manualPythonPath);

        // --- PWA FAMILY APP ---
        this._startFamilyApp();
    }

    async _startFamilyApp() {
        if (!this.config.pwaEnabled) return;
        
        try {
            await pwaServer.start(this);
            
            if (this.config.cloudflareEnabled) {
                const port = this.config.pwaPort || 8095;
                const tunnelUrl = await cloudflareTunnel.start(this, port);
                if (tunnelUrl) {
                    this.log.info(`[PWA] ?? Cloudflare URL: ${tunnelUrl}/?token=${this.config.familyShareToken || ''}`);
                }
            }
        } catch(e) {
            this.log.error(`[PWA] Startup error: ${e.message}`);
        }
    }

    async checkSensorHealth() {
        var _self = this;
        var now = Date.now();
        var devices = this.config.devices || [];
        // Schwellwerte pro Typ ? T?r/Fenster 7 Tage (wochenlang geschlossen ist normal)
        var thresholds = { motion: 7*24*3600000, presence_radar: 7*24*3600000, vibration: 7*24*3600000,
            door: 7*24*3600000, temperature: 6*3600000, light: 8*3600000, dimmer: 8*3600000, moisture: 8*3600000 };
        var defaultThreshold = 7 * 24 * 3600000; // OC-5: Schwelle 7 Tage
        var ALERT_COOLDOWN = 24 * 3600000; // max. 1 Pushover pro Sensor pro Tag
        // KNX/Loxone/BACnet: kabelgebunden, kein Heartbeat ? Timeout-Check ?berspringen
        var WIRED_PREFIXES = ['knx.', 'loxone.', 'bacnet.', 'modbus.'];
        var alerts = [];
        var statusList = [];
        for (var _di = 0; _di < devices.length; _di++) {
            var d = devices[_di];
            if (!d.id) continue;
            var isWired = WIRED_PREFIXES.some(function(p) { return d.id.toLowerCase().startsWith(p); });
            if (isWired) continue;
            // getForeignStateAsync: ts wird vom Basisadapter (zigbee, homekit etc.) bei jedem Heartbeat aktualisiert
            var lastSeen = _self.sensorLastSeen[d.id] || 0;
            try {
                var fState = await _self.getForeignStateAsync(d.id);
                if (fState && fState.ts && fState.ts > lastSeen) lastSeen = fState.ts;
            } catch(e) {}
            if (!lastSeen) continue;
            var threshold = thresholds[d.type] || defaultThreshold;
            var elapsed = now - lastSeen;
            var sinceH = Math.round(elapsed / 360000) / 10;
            var isOffline = elapsed > threshold;
            statusList.push({ id: d.id, name: d.name || d.id, location: d.location || '', type: d.type || '', lastSeen: lastSeen, sinceH: sinceH, status: isOffline ? 'offline' : 'ok' });
            if (isOffline) {
                var lastAlert = _self.sensorAlertSent[d.id] || 0;
                if ((now - lastAlert) > ALERT_COOLDOWN) {
                    _self.sensorAlertSent[d.id] = now;
                    var hours = Math.round(elapsed / 3600000);
                    alerts.push((d.name || d.id) + ' (' + (d.location || '?') + '): seit ' + hours + 'h inaktiv');
                }
            }
        }
        var offlineCount = statusList.filter(function(s) { return s.status === 'offline'; }).length;
        try {
            await this.setStateAsync('system.sensorStatus', { val: JSON.stringify({ timestamp: now, sensors: statusList, offlineCount: offlineCount }), ack: true });
        } catch(e) {}
        // OC-5: Pushover-Alarme waehrend der Nachtruhe unterdruecken (Sensor schlaeimft normal)         var _nowH = new Date(now).getHours();         var _isSleepTime = _nowH >= 22 || _nowH < 8;         if (_isSleepTime) alerts = []; // Status-LED bleibt rot, aber kein Push-Spam         
        if (alerts.length > 0) {
            var msg = '?? Sensor-Ausfall:\n' + alerts.join('\n');
            this.log.warn('[SENSOR-CHECK] ' + alerts.join(', '));
            try { setup.sendNotification(this, msg, true, false, '?? NUUKANNI: Sensor-Ausfall'); } catch(e) {}
        }
        // OC-15: Batteriestand stuendlich pruefen (Pushover taeglich um 09:00)
        try { await this.checkBatteryLevels(); } catch(e) {}
    }

    async discoverBatteryStates() {
        var _self = this;
        var devices = this.config.devices || [];
        // G?ngige Battery-State-Namen quer durch alle ioBroker-Adapter:
        // battery/BATTERY       ? Zigbee, deCONZ, Tuya, mihome, ZHA
        // battery_percentage    ? Tuya, einige BLE-Adapter
        // battery_level/Level   ? HomeKit-Controller, Matter, ESPHome
        // battery-level         ? HomeKit Controller (Bindestrich)
        // Bat.value/Bat.percent ? Shelly (batteriebetrieben: DW2, H&T, Motion)
        // params.battery.Battery_Level ? Z-Wave 2 (zwave2-Adapter)
        var BATTERY_NAMES = [
            'battery', 'BATTERY', 'battery_low', 'lowBattery', 'Battery',
            'battery_percentage', 'battery_level', 'batteryLevel', 'battery-level', 'BatteryLevel',
            'Bat.value', 'Bat.percent', 'bat.value',
            'params.battery.Battery_Level', 'params.battery.Battery_Level_Alarm'
        ];
        var WIRED_PREFIXES = ['knx.', 'loxone.', 'bacnet.', 'modbus.'];
        var BATTERY_TYPES = ['motion', 'vibration', 'vibration_trigger', 'vibration_strength', 'presence_radar', 'presence_radar_bool', 'moisture', 'door', 'temperature'];
        for (var _bi = 0; _bi < devices.length; _bi++) {
            var d = devices[_bi];
            if (!d.id) continue;
            var isWired = WIRED_PREFIXES.some(function(p) { return d.id.toLowerCase().startsWith(p); });
            if (isWired) continue;
            if (BATTERY_TYPES.indexOf(d.type || 'motion') === -1) continue;
            var batteryStateId = null;
            var bSource = 'none';
            // 1. Manuelles Feld aus Config
            if (d.batteryStateId && d.batteryStateId.trim()) {
                batteryStateId = d.batteryStateId.trim();
                bSource = 'manual';
            }
            // 2. Alias-Rekonstruktion: alias.id -> nativer Geraetepfad -> battery
            if (!batteryStateId) {
                try {
                    var aliasObj = await _self.getForeignObjectAsync(d.id);
                    if (aliasObj && aliasObj.common && aliasObj.common.alias && aliasObj.common.alias.id) {
                        var nativeId = typeof aliasObj.common.alias.id === 'object'
                            ? (aliasObj.common.alias.id.read || aliasObj.common.alias.id.write)
                            : aliasObj.common.alias.id;
                        if (nativeId) {
                            var aliasParts = String(nativeId).split('.');
                            aliasParts.pop();
                            var aliasDevPath = aliasParts.join('.');
                            for (var _an = 0; _an < BATTERY_NAMES.length; _an++) {
                                try {
                                    var cStateA = await _self.getForeignStateAsync(aliasDevPath + '.' + BATTERY_NAMES[_an]);
                                    if (cStateA !== null && cStateA !== undefined) {
                                        batteryStateId = aliasDevPath + '.' + BATTERY_NAMES[_an];
                                        bSource = 'alias';
                                        break;
                                    }
                                } catch(e) {}
                            }
                        }
                    }
                } catch(e) {}
            }
            // 3. Direktsuche ? bis zu 3 Pfad-Ebenen hoch
            //    Tiefe 1: adapter.0.device.channel  ? adapter.0.device
            //    Tiefe 2: adapter.0.device.ch.state ? adapter.0.device  (Shelly: Bat.value)
            //    Tiefe 3: adapter.0.Node.ch.sub.st  ? adapter.0.Node   (Z-Wave: params.battery.Battery_Level)
            if (!batteryStateId) {
                try {
                    var _dParts = d.id.split('.');
                    var _maxDepth = Math.min(3, _dParts.length - 3); // mind. adapter.instance.device uebrig lassen
                    _discoveryLoop:
                    for (var _depth = 1; _depth <= _maxDepth; _depth++) {
                        var _devPath = _dParts.slice(0, _dParts.length - _depth).join('.');
                        for (var _dn = 0; _dn < BATTERY_NAMES.length; _dn++) {
                            try {
                                var cStateD = await _self.getForeignStateAsync(_devPath + '.' + BATTERY_NAMES[_dn]);
                                if (cStateD !== null && cStateD !== undefined) {
                                    batteryStateId = _devPath + '.' + BATTERY_NAMES[_dn];
                                    bSource = 'auto';
                                    break _discoveryLoop;
                                }
                            } catch(e) {}
                        }
                    }
                } catch(e) {}
            }
            // 4. Homematic: Kanal 0 (Maintenance) fuer LOWBAT und BATTERY_STATE
            if (!batteryStateId) {
                try {
                    var HM_PREFIXES = ['hm-rpc.', 'hmip-rfc.', 'hm-rega.'];
                    var isHM = HM_PREFIXES.some(function(p) { return d.id.toLowerCase().startsWith(p); });
                    if (isHM) {
                        // hm-rpc.0.DEVADDR:X.DATAPOINT -> hm-rpc.0.DEVADDR:0
                        var hmMatchColon = d.id.match(/^([\w-]+\.\d+\.[^:]+):(\d+)\./);
                        // hm-rpc.0.DEVADDR.X.DATAPOINT -> hm-rpc.0.DEVADDR.0 (HmIP style)
                        var hmMatchDot   = !hmMatchColon && d.id.match(/^([\w-]+\.\d+\.[^\.]+)\.\d+\./);
                        var hmCh0 = hmMatchColon ? hmMatchColon[1] + ':0' : (hmMatchDot ? hmMatchDot[1] + '.0' : null);
                        if (hmCh0) {
                            var HM_BATT_NAMES = ['LOW_BAT', 'LOW_BAT_ALARM', 'LOWBAT', 'LOWBAT_ALARM']; // nur Booleans ? Spannungswerte nicht konvertierbar (Geraetyp unbekannt)
                            for (var _hn = 0; _hn < HM_BATT_NAMES.length; _hn++) {
                                try {
                                    var cStateHM = await _self.getForeignStateAsync(hmCh0 + '.' + HM_BATT_NAMES[_hn]);
                                    if (cStateHM !== null && cStateHM !== undefined) {
                                        batteryStateId = hmCh0 + '.' + HM_BATT_NAMES[_hn];
                                        bSource = 'hm-auto';
                                        break;
                                    }
                                } catch(e) {}
                            }
                        }
                    }
                } catch(e) {}
            }
            if (batteryStateId) {
                if (!_self.batteryStates[d.id]) _self.batteryStates[d.id] = {};
                _self.batteryStates[d.id].stateId = batteryStateId;
                _self.batteryStates[d.id].source = bSource;
                _self.log.debug('[BATTERY] ' + (d.name || d.id) + ': ' + batteryStateId + ' (' + bSource + ')');
            } else {
                delete _self.batteryStates[d.id];
            }
        }
    }

    async checkBatteryLevels() {
        var _self = this;
        var now = Date.now();
        var criticals = [];
        var devices = this.config.devices || [];
        for (var _sid in _self.batteryStates) {
            var info = _self.batteryStates[_sid];
            if (!info || !info.stateId) continue;
            try {
                var bst = await _self.getForeignStateAsync(info.stateId);
                if (!bst || bst.val === null || bst.val === undefined) continue;
                var level = null; var isLow = false; var isCritical = false;
                if (typeof bst.val === 'boolean') {
                    isLow = bst.val; isCritical = bst.val; level = bst.val ? 5 : 80;
                } else if (typeof bst.val === 'number') {
                    // Nur echte Prozentwerte (0-100) verarbeiten.
                    // Spannungswerte (< 10) werden bewusst ignoriert ? ohne Geraete-Datenbank
                    // nicht zuverlaessig konvertierbar (1x CR2032 vs 2x AAA vs 1x 1.5V).
                    if (bst.val >= 0 && bst.val <= 100) {
                        level = bst.val;
                        isLow = level <= 20; isCritical = level <= 10;
                    }
                    // else: Spannungswert -> kein Eintrag in batteryStates (wird uebersprungen)
                }
                info.level = level; info.isLow = isLow; info.isCritical = isCritical;
                if (isCritical) {
                    var _bd = devices.find(function(dv) { return dv.id === _sid; });
                    var _bname = (_bd && _bd.name) ? _bd.name : _sid;
                    var _bloc = (_bd && _bd.location) ? _bd.location : '?';
                    criticals.push(_bname + ' (' + _bloc + '): ' + (level !== null ? level + '%' : 'kritisch'));
                }
            } catch(e) {}
        }
        // Status in State schreiben
        try {
            var batteryList = Object.keys(_self.batteryStates).map(function(id) {
                var inf = _self.batteryStates[id];
                return { id: id, stateId: inf.stateId, level: inf.level !== undefined ? inf.level : null, isLow: inf.isLow || false, isCritical: inf.isCritical || false, source: inf.source || 'auto' };
            });
            await _self.setStateAsync('system.sensorBatteryStatus', { val: JSON.stringify({ timestamp: now, sensors: batteryList }), ack: true });
        } catch(e) {}
        // Taeglich einmal um 09:00 Uhr Pushover bei kritischer Batterie
        var _nowH2 = new Date(now).getHours();
        var _dayKey2 = new Date(now).toDateString();
        if (criticals.length > 0 && _nowH2 >= 9 && _self._lastBatteryPushoverDay !== _dayKey2) {
            _self._lastBatteryPushoverDay = _dayKey2;
            var _bMsg = '\uD83D\uDD0B Batterie-Warnung:\n' + criticals.join('\n');
            _self.log.warn('[BATTERY] Kritisch: ' + criticals.join(', '));
            try { setup.sendNotification(_self, _bMsg, true, false, '\uD83D\uDD0B NUUKANNI: Batterie fast leer'); } catch(e) {}
        }
    }

    onUnload(callback) {
        if (this.historyJob) this.historyJob.cancel();
        this.saveDailyHistory().then(async () => {
            if (this.analysisTimer) clearInterval(this.analysisTimer);
            if (this.calendarCheckTimer) clearInterval(this.calendarCheckTimer);
            if (this.presenceCheckTimer) clearInterval(this.presenceCheckTimer);
            if (this.roomIntegratorTimer) clearInterval(this.roomIntegratorTimer);
            if (this.sensorCheckInterval) clearInterval(this.sensorCheckInterval);
            if (this.hourlySaveInterval) clearInterval(this.hourlySaveInterval);
            recorder.abortExitTimer(this);
            pythonBridge.stopService(this);
            
            // PWA und Tunnel beenden
            cloudflareTunnel.stop();
            await pwaServer.stop();
            
            callback();
        });
    }

    async replayTodayEvents() {
        if (!this.eventHistory || this.eventHistory.length === 0) {
            this.log.warn("? Replay skipped: No events in memory.");
            return;
        }

        this.log.info(`? Replaying ${this.eventHistory.length} events from today...`);
        const startOfDay = new Date().setHours(0,0,0,0);

        const histId = 'analysis.activity.roomHistory';
        let histData = { history: {}, date: new Date().toLocaleDateString() };

        const vectorId = 'analysis.health.todayVector';
        const detailsId = 'analysis.health.todayRoomDetails';

        let todayBuckets = new Array(48).fill(0);
        let todayDetails = Array.from({ length: 48 }, () => []);

        // Sensoren die explizit aus der Health-Timeline ausgeschlossen sind (aktuelle Konfiguration)
        const _excludedFromActivity = new Set((this.config.devices || []).filter(d => d.excludeFromActivity).map(d => d.id));

        this.eventHistory.forEach(evt => {
            if (evt.timestamp >= startOfDay) {
                if (evt.excludeFromActivity || _excludedFromActivity.has(evt.id)) return;
                if (recorder.isRelevantActivity(evt.type, evt.value)) {
                    const date = new Date(evt.timestamp);
                    const bucketIndex = (date.getHours() * 2) + (date.getMinutes() >= 30 ? 1 : 0);

                    if (bucketIndex < 48) {
                        todayBuckets[bucketIndex]++;

                        const roomName = evt.location || evt.name || '?';
                        let currentRooms = todayDetails[bucketIndex];
                        if (!currentRooms.includes(roomName)) {
                            currentRooms.push(roomName);
                        }
                    }

                    const hour = date.getHours();
                    let room = evt.location || 'Unknown';
                    const dev = (this.config.devices||[]).find(d => d.location === room);
                    if(dev) room = dev.location;

                    if (!histData.history[room]) histData.history[room] = new Array(24).fill(0);
                    if (histData.history[room][hour] < 60) histData.history[room][hour]++;
                }
            }
        });

        const currentState = await this.getStateAsync(histId);
        if (!currentState || !currentState.val || currentState.val === '{}' || currentState.val.includes('"history":{}')) {
            await this.setStateAsync(histId, { val: JSON.stringify(histData), ack: true });
        }

        await this.setStateAsync(vectorId, { val: JSON.stringify(todayBuckets), ack: true });
        await this.setStateAsync(detailsId, { val: JSON.stringify(todayDetails), ack: true });

        this.log.info("? Dashboard Data (Rooms & Timeline & Details) restored.");
    }

    async migrateScoresToV2() {
        try {
            const dataDir = utils.getAbsoluteDefaultDataDir();
            const historyDir = require('path').join(dataDir, 'cogni-living', 'history');
            if (!require('fs').existsSync(historyDir)) return;
            const files = require('fs').readdirSync(historyDir).filter(function(f) { return f.endsWith('.json'); });
            var updated = 0;
            for (var fi = 0; fi < files.length; fi++) {
                try {
                    var fp = require('path').join(historyDir, files[fi]);
                    var data = JSON.parse(require('fs').readFileSync(fp, 'utf8'));
                    // Bereits migriert oder kein Schlaffenster: skip
                    if (data.sleepScoreCalStatus !== undefined) continue;
                    if (!data.sleepWindowStart || !data.sleepWindowEnd) continue;
                    if (data.bedWasEmpty) { data.sleepScoreCalStatus = 'uncalibrated'; require('fs').writeFileSync(fp, JSON.stringify(data)); continue; }
                    var durMin = (data.sleepWindowEnd - data.sleepWindowStart) / 60000;
                    var durScore = Math.max(20, Math.min(95, 25 + 0.12 * durMin));
                    var stageAdj = 0;
                    if (data.sleepStages && data.sleepStages.length > 0) {
                        var _deep = 0, _rem = 0, _wake = 0, _total = 0;
                        data.sleepStages.forEach(function(s) { _total += 300; if (s.s === 'deep') _deep += 300; else if (s.s === 'rem') _rem += 300; else if (s.s === 'wake') _wake += 300; });
                        if (_total > 0) {
                            var _cov = Math.min(1, (_total / 60) / Math.max(1, durMin));
                            stageAdj = Math.max(-8, Math.min(8, Math.round((_rem/_total*30 - _wake/_total*50) * _cov)));
                        }
                    }
                    var newScore = Math.round(Math.max(0, Math.min(100, durScore + stageAdj)));
                    data.sleepScore = newScore;
                    data.sleepScoreRaw = newScore;
                    data.sleepScoreCal = null;
                    data.sleepScoreCalNights = 0;
                    data.sleepScoreCalStatus = 'uncalibrated';
                    require('fs').writeFileSync(fp, JSON.stringify(data));
                    updated++;
                } catch(_fe) { this.log.warn('[ScoreMigration] Datei ' + files[fi] + ': ' + _fe.message); }
            }
            if (updated > 0) this.log.info('[ScoreMigration] V2-Score fuer ' + updated + ' History-Dateien aktualisiert.');

            // sleepScoreHistory retroaktiv befuellen (fuer Kalibrierung)
            try {
                var _curHistState = await this.getStateAsync('analysis.health.sleepScoreHistory');
                var _curHistory = [];
                if (_curHistState && _curHistState.val) { try { _curHistory = JSON.parse(_curHistState.val); } catch(_) {} }
                var _existingDates = new Set(_curHistory.map(function(e) { return e.date; }));
                var _backfill = [];
                for (var _bi = 0; _bi < files.length; _bi++) {
                    try {
                        var _bp = require('path').join(historyDir, files[_bi]);
                        var _bd = JSON.parse(require('fs').readFileSync(_bp, 'utf8'));
                        var _bdate = files[_bi].replace('.json', '');
                        if (_bd.sleepScore !== null && _bd.sleepScore !== undefined && !_existingDates.has(_bdate)) {
                            _backfill.push({ date: _bdate, aura: _bd.sleepScore, garmin: _bd.garminScore || null });
                        }
                    } catch(_be) {}
                }
                if (_backfill.length > 0) {
                    var _merged = _curHistory.concat(_backfill).sort(function(a,b){ return a.date.localeCompare(b.date); });
                    if (_merged.length > 60) _merged = _merged.slice(_merged.length - 60);
                    await this.setStateAsync('analysis.health.sleepScoreHistory', { val: JSON.stringify(_merged), ack: true });
                    this.log.info('[ScoreMigration] sleepScoreHistory mit ' + _backfill.length + ' historischen Eintraegen ergaenzt (' + _merged.filter(function(e){return e.garmin!==null;}).length + ' mit Garmin).');
                }
            } catch (_he) { this.log.warn('[ScoreMigration] History-Backfill Fehler: ' + _he.message); }
        } catch (me) { this.log.warn('[ScoreMigration] Fehler: ' + me.message); }
    }

    async saveDailyHistory(_directOverride) {
        // Sequenzen f?r Gait-Speed-Berechnung vorladen
        try {
            const _sq = await this.getStateAsync('LTM.trainingData.sequences');
            this._lastSeqState = (_sq && _sq.val) ? _sq.val : null;
        } catch(e) { this._lastSeqState = null; }
        if (!this.activeModules.health) return;
        const _now = new Date();
        const dateStr = _now.getFullYear() + '-' + String(_now.getMonth()+1).padStart(2,'0') + '-' + String(_now.getDate()).padStart(2,'0'); // LOKAL, nicht UTC!
        this.log.debug(`?? Saving Daily History for ${dateStr}...`);

        try {
            const [
                roomHistory, geminiNight, geminiDay, anomalyScore, todayVector, activityTrend
            ] = await Promise.all([
                this.getStateAsync('analysis.activity.roomHistory'),
                this.getStateAsync('analysis.health.geminiNight'),
                this.getStateAsync('analysis.health.geminiDay'),
                this.getStateAsync('analysis.security.lastScore'),
                this.getStateAsync('analysis.health.todayVector'),
                this.getStateAsync('analysis.health.activityTrend')
            ]);

            const startOfDayTimestamp = new Date().setHours(0,0,0,0);
            // Fenster/T?r-?ffnungen: alle Sensoren mit fenster/haust?r/terrasse/balkon/window im Namen
            // Frischluft: Verwende Sensor-Typ "door" aus dem Typ-System (Sensorliste: T?r/Fenster)
            // Identisch zum Architektur-Prinzip: e.type === "door" statt Keyword-Matching
            const freshAirCount = this.eventHistory.filter(e => {
                const ts = e.timestamp || e.ts || 0;
                if (ts < startOfDayTimestamp) return false;
                const isDoorSensor = e.type === 'door';
                const isOpen = e.value === true || e.value === 1 || e.value === 'true' || e.value === 'open';
                return isDoorSensor && isOpen;
            }).length;
            // 5-Min-Sto?l?ftungen: OPEN/CLOSE-Paare >= 5 Min
            const FRESH_AIR_MIN_MS = 5 * 60 * 1000;
            const doorEventsToday = this.eventHistory
                .filter(e => { const ts = e.timestamp || e.ts || 0; return ts >= startOfDayTimestamp && e.type === 'door'; })
                .sort((a, b) => (a.timestamp || a.ts || 0) - (b.timestamp || b.ts || 0));
            const openMap = {};
            let freshAirLongCount = 0;
            for (const e of doorEventsToday) {
                const ts = e.timestamp || e.ts || 0;
                const isOpen = e.value === true || e.value === 1 || e.value === 'true' || e.value === 'open';
                if (isOpen) { openMap[e.id] = ts; }
                else { if (openMap[e.id] && (ts - openMap[e.id] >= FRESH_AIR_MIN_MS)) freshAirLongCount++; delete openMap[e.id]; }
            }
            for (const openTs of Object.values(openMap)) { if ((Date.now() - openTs) >= FRESH_AIR_MIN_MS) freshAirLongCount++; }

            let battery = 85;
            if (activityTrend && activityTrend.val !== undefined) battery = Math.min(100, Math.max(20, Math.round(80 + (Number(activityTrend.val) * 5))));

            // WICHTIG: Nur Events von HEUTE speichern, nicht alle Events!
            const todayEvents = this.eventHistory.filter(e => e.timestamp >= startOfDayTimestamp);

            // Sleep-Freeze: Snapshot lesen und pr++fen ob Nacht bereits eingefroren (echte Nacht gesichert)
            const _dataDir0 = utils.getAbsoluteDefaultDataDir();
            const _filePath0 = path.join(_dataDir0, 'cogni-living', 'history', dateStr + '.json');
            let _existingSnap = null;
            try { if (fs.existsSync(_filePath0)) _existingSnap = JSON.parse(fs.readFileSync(_filePath0, 'utf8')); } catch(_fe) {}
            // Eingefroren wenn: Aufwachzeit vorhanden + vor 14:00 Uhr (= echte Nacht) + mind. 3h Bettzeit
            const _sleepFrozenMotionOnly = !!(
                _existingSnap && _existingSnap.personData &&
                _existingSnap.sleepWindowStart && _existingSnap.sleepWindowEnd &&
                new Date(_existingSnap.sleepWindowEnd).getHours() < 14 &&
                Object.keys(_existingSnap.personData).some(function(pk) {
                    var _ppd = _existingSnap.personData[pk];
                    return _ppd && _ppd.wakeConfirmed === true;
                })
            );
            const _sleepFrozen = !!(_existingSnap &&
                _existingSnap.sleepWindowStart &&
                _existingSnap.sleepWindowEnd &&
                new Date(_existingSnap.sleepWindowEnd).getHours() < 14 &&
                (
                    (_existingSnap.sleepStages && _existingSnap.sleepStages.length > 0) ||
                    _sleepFrozenMotionOnly
                ));

            // Schlaf-relevante Events: ab 18:00 Uhr des Vortages (Nacht spannt 2 Kalendertage!).
            // Bsp: Einschlafen 23:00 Uhr = gestriger Tag => fehlt in todayEvents.
            // sleepSearchEvents deckt 18:00 gestern bis jetzt, damit sleepWindowCalc den
            // echten Einschlafzeitpunkt findet und OC-7-Vibrationsdaten vollstaendig sind.
            const _sleepSearchBase = new Date();
            _sleepSearchBase.setHours(18, 0, 0, 0);
            if (new Date().getHours() < 18) { _sleepSearchBase.setDate(_sleepSearchBase.getDate() - 1); }
            const sleepDate = _sleepSearchBase.getFullYear() + '-' + String(_sleepSearchBase.getMonth()+1).padStart(2,'0') + '-' + String(_sleepSearchBase.getDate()).padStart(2,'0');
            const sleepSearchEvents = this.eventHistory.filter(e => (e.timestamp||0) >= _sleepSearchBase.getTime());
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
            } catch(_suppE) { this.log.debug('[AURA] Buffer-Supplement: '+_suppE.message); }

            // Raum-Verweildauer heute aus roomHistory berechnen (Minuten pro Raum)
            const roomHistoryData = roomHistory?.val ? JSON.parse(roomHistory.val) : {};
            const todayRoomMinutes = {};
            if (roomHistoryData.history) {
                for (const [room, hourlyArr] of Object.entries(roomHistoryData.history)) {
                    if (Array.isArray(hourlyArr)) {
                        todayRoomMinutes[room] = hourlyArr.reduce((a, b) => a + (b || 0), 0);
                    }
                }
            }
            // roomStats-State aktuell halten (gleiche Datenquelle f?r Admin + PWA)
            try {
                let existingStats = { today: {}, yesterday: {}, date: '' };
                const rsState = await this.getStateAsync('analysis.activity.roomStats');
                if (rsState && rsState.val) existingStats = JSON.parse(rsState.val);
                existingStats.today = todayRoomMinutes;
                existingStats.date = dateStr;
                await this.setStateAsync('analysis.activity.roomStats', { val: JSON.stringify(existingStats), ack: true });
            } catch(e) {}

            // R?umliche Heuristik: max. Personen die heute gleichzeitig erkannt wurden
            var _cfgSize = this.config.householdSize || 'single';
            var _cfgBaseline = _cfgSize === 'single' ? 1 : _cfgSize === 'couple' ? 2 : 3;
            const maxPersonsDetected = this._maxPersonsToday || _cfgBaseline;
            // FP2 Bett-Praesenz: Minuten die Bett-Zone heute belegt war (inkl. Vorabend ab 18:00)
            const bedPresenceMinutes = (function() {
                var presStart = null; var total = 0;
                var bedEvts = sleepSearchEvents.filter(function(e) { return e.isFP2Bed; })
                    .sort(function(a,b) { return (a.timestamp||0)-(b.timestamp||0); });
                bedEvts.forEach(function(e) {
                    var v = isActiveValue(e.value) || toPersonCount(e.value) > 0;
                    if (v && !presStart) { presStart = e.timestamp||0; }
                    else if (!v && presStart) { total += ((e.timestamp||0) - presStart) / 60000; presStart = null; }
                });
                if (presStart) total += (Date.now() - presStart) / 60000;
                return Math.round(total);
            })();

            // Schlaf-Fenster aus FP2-Bett-Events berechnen (dynamisch).
            // Dieses Fenster treibt die SCHLAFZEIT-Kachel (Einschlaf-/Aufwachzeit).
            // Ohne FP2-Bett: start=null -> Schlafzeit-Karte zeigt 'keine Daten' (gewuenscht).
            const sleepWindowCalc = (function() {
                var bedEvts = sleepSearchEvents.filter(function(e) { return e.isFP2Bed; })
                    .sort(function(a,b) { return (a.timestamp||0)-(b.timestamp||0); });
                if (bedEvts.length === 0) return { start: null, end: null };
                // Fix A: Schlafbeginn per Gap-Fusion bestimmen
                // Belegungs-Bloecke aufbauen, Luecken < 30min fusionieren (naecht. Wachphasen),
                // laengsten fusionierten Block als Haupt-Schlafblock waehlen.
                // Verhindert Re-Anchoring wenn Nutzer kurz aufsteht (WC, Kueche).
                var GAP_TOLERANCE_MS = 30 * 60 * 1000;
                var _rawBlocks = [];
                var presStart = null;
                for (var _si = 0; _si < bedEvts.length; _si++) {
                    var _se = bedEvts[_si];
                    var _sv = isActiveValue(_se.value) || toPersonCount(_se.value) > 0;
                    var _shr = new Date(_se.timestamp||0).getHours();
                    if (_sv && !presStart && (_shr >= 18 || _shr < 3)) { presStart = _se.timestamp||0; }
                    else if (!_sv && presStart) {
                        _rawBlocks.push({ start: presStart, end: _se.timestamp||0 });
                        presStart = null;
                    }
                }
                if (presStart) _rawBlocks.push({ start: presStart, end: Date.now() });
                // Bloecke < 10 Min verwerfen, dann Luecken <= GAP_TOLERANCE_MS fusionieren
                var _merged = [];
                for (var _bi = 0; _bi < _rawBlocks.length; _bi++) {
                    var _b = _rawBlocks[_bi];
                    if ((_b.end - _b.start) < 10 * 60000) continue;
                    if (_merged.length === 0) {
                        _merged.push({ start: _b.start, end: _b.end });
                    } else {
                        var _lastM = _merged[_merged.length - 1];
                        if ((_b.start - _lastM.end) <= GAP_TOLERANCE_MS) {
                            _lastM.end = _b.end; // Naecht. Wachphase: fusionieren, nicht neu ankern
                        } else {
                            _merged.push({ start: _b.start, end: _b.end });
                        }
                    }
                }
                if (_merged.length === 0) return { start: null, end: null };
                // Laengsten fusionierten Block als Haupt-Schlafblock waehlen
                var _mainBlock = _merged.reduce(function(best, cur) {
                    return (cur.end - cur.start) > (best.end - best.start) ? cur : best;
                }, _merged[0]);
                var sleepStartTs = _mainBlock.start;
                if (!sleepStartTs) return { start: null, end: null };
                // Aufwachzeit: erstes Mal nach Schlafbeginn dass Bett >= 15 Min leer war nach 04:00
                var wakeTs = null;
                var emptyStart = null;
                var _firstEmpty = null;
                for (var _wi = 0; _wi < bedEvts.length; _wi++) {
                    var _we = bedEvts[_wi];
                    if ((_we.timestamp||0) < sleepStartTs) continue;
                    var _wv = isActiveValue(_we.value) || toPersonCount(_we.value) > 0;
                    var _whr = new Date(_we.timestamp||0).getHours();
                    if (!_wv && (_whr >= 4 && _whr <= 14)) {
                        if (!emptyStart) emptyStart = _we.timestamp||0;
                    } else if (_wv && emptyStart) {
                        var _wdur = ((_we.timestamp||0) - emptyStart) / 60000;
                        if (_wdur >= 15) { _firstEmpty = emptyStart; wakeTs = emptyStart + _wdur * 60000; emptyStart = null; break; }
                        emptyStart = null;
                    }
                }
                if (emptyStart) { var _wdur2 = (Date.now() - emptyStart) / 60000; if (_wdur2 >= 15) { _firstEmpty = emptyStart; wakeTs = Date.now(); } }
                return { start: sleepStartTs, end: wakeTs, firstEmpty: _firstEmpty };
            })();

            // OC-4 Guard: Schlaffenster nur speichern wenn genuegend FP2-Bettzeit-Daten vorhanden.
            // (Brainstorming OC-4: verhindert falsche Einschlafzeit nach Adapter-Neustart)
            if (bedPresenceMinutes < 180 && sleepWindowCalc.start !== null) {
                sleepWindowCalc.start = null;
                sleepWindowCalc.end = null;
                this.log.debug('[History] OC-4 Guard: bedPresenceMinutes=' + bedPresenceMinutes + 'min < 180, FP2-sleepWindow verworfen');
            }
            // Urspr++ngliche FP2-Fenstererkennung merken (vor Freeze-+?berschreibung) f++r sleepWindowSource
            var _origFP2Window = sleepWindowCalc.start !== null;

            // Schlaffenster aus Schlafzimmer-Bewegungsmelder (Fallback wenn kein FP2-Bett-Sensor).
            // Sensor-Konfiguration: type=motion + sensorFunction=bed ??? isBedroomMotion=true.
            // Pr+?zision: Einschlafzeit ??? letzte Bewegung vor ???45 Min Stille (18???03 Uhr).
            //            Aufwachzeit ??? erste Bewegung nach 04 Uhr + mind. 3h nach Einschlafzeit.
            // Besser als Fixfenster, aber schlechter als FP2 (keine Tief-/Ruhephasen-Erkennung).
            // --- Globale Einschlafzeit-Kandidaten via computePersonSleep ---
            // (personTag=null = globale Analyse, identischer Algorithmus wie per-Person)
            var _fp2RawStart = sleepWindowCalc.start || null;
            var garminSleepStartTs = null;
            var vibRefinedSleepStartTs = null; // fp2_vib Kandidat (fuer Priority-Chain)

            // Garmin Einschlafzeit lesen (async, bleibt ausserhalb der Funktion)
            var _garminSleepStartId = (this.config.garminSleepStartStateId || '').trim()
                || 'garmin.0.dailysleep.dailySleepDTO.sleepStartTimestampGMT';
            try {
                var _gSState = await this.getForeignStateAsync(_garminSleepStartId);
                if (_gSState && _gSState.val != null) {
                    var _gSVal = Number(_gSState.val);
                    if (!isNaN(_gSVal) && _gSVal > 0) {
                        var _gSHr = new Date(_gSVal).getHours();
                        var _gSPlausibel = (_gSHr >= 18 || _gSHr < 4);
                        var _gSInFP2Window = !_fp2RawStart || (Math.abs(_gSVal - _fp2RawStart) <= 3 * 3600000);
                        var _gSNightOk = (_gSVal >= (_sleepSearchBase.getTime() - 2 * 3600000))
                            && (_gSVal <= (_sleepSearchBase.getTime() + 16 * 3600000));
                        if (_gSPlausibel && _gSInFP2Window && _gSNightOk) {
                            garminSleepStartTs = _gSVal;
                            this.log.debug('[SleepStart] Garmin plausibel: ' + new Date(garminSleepStartTs).toISOString());
                        } else {
                            this.log.debug('[SleepStart] Garmin ausserhalb Plausibilitaetsfenster: ' + new Date(_gSVal).toISOString());
                        }
                    }
                }
            } catch(_gse) { this.log.debug('[SleepStart] Garmin nicht lesbar: ' + _gse.message); }

            // Alle Einschlafzeit-Kandidaten via computePersonSleep (Single-Source-of-Truth)
            var _gR = computePersonSleep({
                allEvents:    sleepSearchEvents,
                personTag:    null,
                fp2RawStart:  _fp2RawStart,
                garminTs:     garminSleepStartTs,
                garminWakeTs: null,
                fp2WakeTs:    sleepWindowCalc.firstEmpty || null,
                searchBase:   _sleepSearchBase,
                wakeHardCap:  (function(){ var d=new Date(); d.setHours(12,0,0,0); return d.getTime(); })(),
                startOverride: null,
                wakeOverride:  null,
                existingSnap:  null,
                sleepDate:    sleepDate,
                bathroomIds:  new Set((this.config.devices||[]).filter(function(d){return d.isBathroomSensor||d.sensorFunction==='bathroom';}).map(function(d){return d.id;})),
                log:          this.log
            });

            // Kandidaten aus Funktionsergebnis extrahieren (fuer Priority-Chain und sleepWindowSource)
            var _findSrc = function(src) { return (_gR.allSleepStartSources.find(function(s){return s.source===src;})||{}).ts||null; };
            vibRefinedSleepStartTs   = _findSrc('vib_refined');
            var motionVibSleepStartTs  = _findSrc('motion_vib');
            var lastOutsideSleepStartTs = _findSrc('last_outside');
            var sleepWindowMotion    = { start: _gR._motionAnchor, end: null };
            var sleepWindowHausStill = { start: _gR._hausStillTs,  end: null };
            var allSleepStartSources = _gR.allSleepStartSources;
            var sleepStartSource = _gR.sleepWindowSource || 'fixed';

            // OC-23: Manueller Override der Einschlafzeit-Quelle
            var _overrideApplied = false;
            try {
                // _directOverride: direkt uebergeben (bypasses State-Cache-Timing-Bug)
                var _ovRaw = _directOverride
                    ? JSON.stringify(_directOverride)
                    : (await this.getStateAsync('analysis.sleep.startOverride'))?.val;
                if (_ovRaw && _ovRaw !== 'null') {
                    var _ov = JSON.parse(_ovRaw);
                    var _ovWinMin = _sleepSearchBase.getTime();
                    var _ovWinMax = _sleepSearchBase.getTime() + 10 * 3600000;
                    var _ovSources = ['garmin','fp2_vib','fp2','motion_vib','haus_still','motion','fixed'];
                    if (_ov && _ov.date === sleepDate && _ov.source && _ovSources.indexOf(_ov.source) >= 0
                        && _ov.ts && _ov.ts >= _ovWinMin && _ov.ts <= _ovWinMax) {
                        sleepWindowCalc.start = _ov.ts;
                        sleepStartSource = _ov.source;
                        _overrideApplied = true;
                        this.log.info('[OC-23] Manueller Override aktiv: ' + _ov.source + ' = ' + new Date(_ov.ts).toISOString());
                    }
                }
            } catch(_ovErr) { this.log.warn('[OC-23] Override-Fehler: ' + _ovErr.message); }

            // Per-Person Overrides lesen (fuer personData-Block weiter unten)
            var _personOverrides = {};
            try {
                var _povRaw = (await this.getStateAsync('analysis.sleep.personStartOverrides'))?.val;
                if (_povRaw && _povRaw !== 'null') {
                    var _povParsed = JSON.parse(_povRaw);
                    if (_povParsed && typeof _povParsed === 'object') _personOverrides = _povParsed;
                }
            } catch(_povErr) { this.log.warn('[Per-Person Override] Lesefehler: ' + _povErr.message); }

            // Per-Person Wake-Overrides lesen (analog Einschlaf-Overrides)
            var _personWakeOverrides = {};
            try {
                var _pwovRaw = (await this.getStateAsync('analysis.sleep.personWakeOverrides'))?.val;
                if (_pwovRaw && _pwovRaw !== 'null') {
                    var _pwovParsed = JSON.parse(_pwovRaw);
                    if (_pwovParsed && typeof _pwovParsed === 'object') _personWakeOverrides = _pwovParsed;
                }
            } catch(_pwovErr) { this.log.warn('[Per-Person Wake-Override] Lesefehler: ' + _pwovErr.message); }

            // Priorit+?tskette anwenden (nur wenn nicht frozen)
            if (!_overrideApplied) {
            if (!_sleepFrozen) {
                if (garminSleepStartTs) {
                    sleepWindowCalc.start = garminSleepStartTs;
                    sleepStartSource = 'garmin';
                    this.log.info('[SleepStart] Garmin: ' + new Date(garminSleepStartTs).toISOString());
                } else if (vibRefinedSleepStartTs) {
                    sleepWindowCalc.start = vibRefinedSleepStartTs;
                    sleepStartSource = 'fp2_vib';
                    this.log.info('[SleepStart] Vib-Verfeinerung: ' + new Date(vibRefinedSleepStartTs).toISOString());
                } else if (motionVibSleepStartTs) {
                    sleepWindowMotion.start = motionVibSleepStartTs;
                    sleepStartSource = 'motion_vib';
                    this.log.info('[SleepStart] Motion+Vib-Verfeinerung: ' + new Date(motionVibSleepStartTs).toISOString());
                }
            } else {
                // Frozen: bestehende Quellen-Daten ++bernehmen, Garmin-Override trotzdem erlauben
                sleepStartSource = _existingSnap.sleepStartSource || sleepStartSource;
                if (garminSleepStartTs) {
                    sleepWindowCalc.start = garminSleepStartTs;
                    sleepStartSource = 'garmin';
                    this.log.info('[SleepStart] Garmin-Override auf Frozen: ' + new Date(garminSleepStartTs).toISOString());
                }
            }
            }

            // Schlaffenster fuer OC-7 (Sleep Score): FP2 ??? Bewegungsmelder ??? Fixfenster (Fallback-Kette).
            // Betrifft NICHT sleepWindowStart/End im Snapshot -- die Schlafzeit-Kachel bleibt FP2-only.
            var sleepWindowOC7 = sleepWindowCalc.start
                ? sleepWindowCalc
                : (_gR.sleepWindowStart
                    ? { start: _gR.sleepWindowStart, end: sleepWindowCalc.end || null, firstEmpty: null }
                    : (sleepWindowHausStill.start
                        ? sleepWindowHausStill
                        : (sleepWindowMotion.start
                            ? sleepWindowMotion
                            : (function() {
                                var _fs = _sleepSearchBase.getTime() + 2 * 3600000;
                                var _fe = _fs + 13 * 3600000;
                                if (_fs > Date.now()) return { start: null, end: null };
                                if (_fe > Date.now()) _fe = Date.now();
                                return { start: _fs, end: _fe };
                            })())));

            // FP2-Roh-Aufwachzeit vor Garmin-Override sichern (fuer allWakeSources)
            var _fp2RawWakeTs = sleepWindowCalc.firstEmpty || null;  // FP2-Abgangzeit vor Garmin-Override

            // [FROZEN-Fix] Garmin-Wake vorab lesen damit Stage-Berechnung korrektes Fenster-Ende hat.
            // Garmin-Wake wird normalerweise erst nach Stage-Calc gesetzt (Reihenfolge-Bug) - hier vorab.
            if (sleepWindowOC7.start && !_sleepFrozen) {
                try {
                    var _gwIdPre = (this.config.garminSleepEndStateId || '').trim()
                        || 'garmin.0.dailysleep.dailySleepDTO.sleepEndTimestampGMT';
                    var _gwPre = await this.getForeignStateAsync(_gwIdPre);
                    if (_gwPre && _gwPre.val != null) {
                        var _gwPreVal = Number(_gwPre.val);
                        if (!isNaN(_gwPreVal) && _gwPreVal > 0) {
                            var _gwPreH = new Date(_gwPreVal).getUTCHours();
                            var _gwPreOk = _gwPreVal >= sleepWindowOC7.start
                                && _gwPreVal <= sleepWindowOC7.start + 20 * 3600000;
                            if (_gwPreH >= 3 && _gwPreH < 14 && _gwPreOk) {
                                if (!sleepWindowOC7.end || _gwPreVal < sleepWindowOC7.end) {
                                    sleepWindowOC7.end = _gwPreVal;
                                    this.log.debug('[OC-7] Garmin Wake vorab (Reihenfolge-Fix): ' + new Date(_gwPreVal).toISOString());
                                }
                            }
                        }
                    }
                } catch(_gpe) {}
            }

            // --- OC-7: AURA SLEEP SCORE ---------------------------------------------------
            // Klassifikation in 5-Minuten-Slots anhand Vibrationssensor (Detection + Staerke)
            // Stages: 'deep' | 'light' | 'rem' | 'wake'
            var sleepScore = null;
            var sleepScoreRaw = null;
            var sleepScoreCal = null;
            var sleepScoreCalNights = 0;
            var sleepScoreCalStatus = 'uncalibrated';
            var sleepStages = [];
            var _shouldRecalcStages = false;
            if (_sleepFrozen) {
                // Eingeschlafene Nacht: Schlafdaten aus bestehendem Snapshot uebernehmen
                // Fix C: OC-23 Override bypasses FROZEN fuer Schlafstart (analog Garmin-Wake-Override)
                if (!_overrideApplied) {
                    // Fix 1: Garmin hat hoechste Prio auch bei Frozen (wurde in Prioritaetskette gesetzt)
                    sleepWindowCalc.end = _existingSnap.sleepWindowEnd;
                    if (garminSleepStartTs) {
                        // Garmin-Wert bereits korrekt in sleepWindowCalc.start (aus Prioritaetskette)
                        sleepWindowOC7 = { start: sleepWindowCalc.start, end: _existingSnap.sleepWindowEnd };
                        this.log.info('[SleepStart] Garmin auf Frozen (automatisch): ' + new Date(sleepWindowCalc.start).toISOString());
                    } else {
                        sleepWindowCalc.start = _existingSnap.sleepWindowStart;
                        sleepWindowOC7 = { start: _existingSnap.sleepWindowStart, end: _existingSnap.sleepWindowEnd };
                    }
                } else {
                    sleepWindowCalc.end = _existingSnap.sleepWindowEnd;
                    sleepWindowOC7 = { start: sleepWindowCalc.start, end: _existingSnap.sleepWindowEnd };
                    this.log.info('[OC-23] Override auf Frozen Snapshot: start=' + new Date(sleepWindowCalc.start).toISOString() + ' end=' + new Date(_existingSnap.sleepWindowEnd).toISOString());
                }
                // [OC-28 + FROZEN-Fix] Stages neu berechnen wenn:
                // (a) Garmin verschob Einschlafzeit um >5 Min, ODER
                // (b) Schlaffenster laeuft noch / wurde gerade erst beendet (<30 Min zurueck)
                var _frozenStartShift = (garminSleepStartTs && _existingSnap.sleepWindowStart)
                    ? Math.abs(garminSleepStartTs - _existingSnap.sleepWindowStart) : 0;
                var _frozenWinEnd = sleepWindowOC7.end || _existingSnap.sleepWindowEnd || 0;
                var _stagesStillFresh = _frozenWinEnd > 0 && Date.now() < _frozenWinEnd + 30 * 60 * 1000;
                if (_frozenStartShift > 5 * 60 * 1000 || _stagesStillFresh) {
                    if (_stagesStillFresh)
                        this.log.info('[OC-28] Stages neu berechnen: Fenster noch aktiv/gerade beendet (end=' + new Date(_frozenWinEnd).toLocaleTimeString() + ')');
                    else
                        this.log.info('[FROZEN-Fix] Garmin verschob Start um ' + Math.round(_frozenStartShift / 60000) + ' Min -> Stages neu berechnen');
                    _shouldRecalcStages = true;
                } else {
                    if (_sleepFrozenMotionOnly && nightVibrationCount > 0) {
                        this.log.info('[FROZEN-Vib] MotionOnly-Freeze aufgehoben \u2014 ' + nightVibrationCount + ' Vibrations-Events vorhanden -> Stages neu berechnen');
                        _shouldRecalcStages = true;
                    } else {
                        sleepStages    = _existingSnap.sleepStages    || [];
                        sleepScore     = _existingSnap.sleepScore     !== undefined ? _existingSnap.sleepScore     : null;
                        sleepScoreRaw  = _existingSnap.sleepScoreRaw  !== undefined ? _existingSnap.sleepScoreRaw  : null;
                        this.log.info('[History] Sleep FROZEN: ' + new Date(_existingSnap.sleepWindowStart).toLocaleTimeString() + '-' + new Date(_existingSnap.sleepWindowEnd).toLocaleTimeString() + ' bedPresMin=' + _existingSnap.bedPresenceMinutes);
                    }
                }
            }
            // Stages+Score: computed AFTER wake detection (see block below)

            // Schlaf-Fenster-Quelle (fuer OC-7 Sensor-Indikator im Frontend)
            // Reihenfolge: fp2 ??? motion (Bewegungsmelder) ??? fixed (Fixfenster)
            var _motionAvail = sleepWindowMotion.start !== null;
            var _hausStillAvail = sleepWindowHausStill.start !== null;
            var sleepWindowSource = _sleepFrozen
                ? (_existingSnap.sleepWindowSource || _gR.sleepWindowSource || 'fixed')
                : (_gR.sleepWindowSource || 'fixed');

            // Au+?erhalb-Bett-Ereignisse waehrend Schlaffenster (fuer OC-7 Balken-Overlay)
            var outsideBedEvents = [];

            // [Multi-Person-Motion-Only Wake+Start-Fallback aus per-Person-Snapshot]
            // Ziel: sleepWindowOC7.end setzen wenn bisher null (kein FP2, kein Garmin),
            //       sleepWindowOC7.start korrigieren wenn invertiert (Abendberechnung).
            // Wirkung: OBE-Dreiecke erscheinen, bedWasEmpty=false, naechster Tag eingefroren.
            if (!_sleepFrozen && _existingSnap && _existingSnap.personData) {
                var _ppWakeList = Object.keys(_existingSnap.personData).map(function(pk) {
                    var ppd = _existingSnap.personData[pk];
                    return (ppd && ppd.wakeConfirmed && ppd.sleepWindowEnd
                        && new Date(ppd.sleepWindowEnd).getHours() < 14) ? ppd.sleepWindowEnd : null;
                }).filter(Boolean).sort(function(a,b){return a-b;});
                if (_ppWakeList.length > 0) {
                    var _ppLatestWake = _ppWakeList[_ppWakeList.length - 1];
                    if (!sleepWindowOC7.end) {
                        sleepWindowOC7.end = _ppLatestWake;
                        this.log.info('[OC-7] Multi-Person-Wake-Fallback: sleepWindowEnd=' + new Date(_ppLatestWake).toLocaleTimeString() + ' (' + _ppWakeList.length + ' Person(en))');
                    }
                    // Invertiertes Fenster korrigieren: start (heutiger Abend) > end (gestriger Morgen)
                    if (sleepWindowOC7.start && sleepWindowOC7.end && sleepWindowOC7.start > sleepWindowOC7.end) {
                        var _ppCorrectedStart = null;
                        var _ppMidnightRef = _sleepSearchBase.getTime() + 6 * 3600000;
                        Object.keys(_existingSnap.personData).forEach(function(pk) {
                            var ppd = _existingSnap.personData[pk];
                            if (!ppd || !ppd.allSleepStartSources) return;
                            ppd.allSleepStartSources.forEach(function(src) {
                                if (!src.ts || src.source === 'winstart') return;
                                var srcHr = new Date(src.ts).getHours();
                                if ((srcHr >= 18 || srcHr < 4) && src.ts < _ppMidnightRef + 4 * 3600000) {
                                    if (!_ppCorrectedStart || src.ts < _ppCorrectedStart) _ppCorrectedStart = src.ts;
                                }
                            });
                        });
                        var _ppStartTs = _ppCorrectedStart || _sleepSearchBase.getTime();
                        sleepWindowOC7.start = _ppStartTs;
                        sleepWindowCalc.start = _ppStartTs;
                        this.log.info('[OC-7] Multi-Person-Start-Korrektur: sleepWindowStart=' + new Date(_ppStartTs).toLocaleTimeString() + (_ppCorrectedStart ? ' (aus per-Person-Quellen)' : ' (Fallback gestern 18:00)'));
                    }
                }
            }
            if (sleepWindowOC7.start && sleepWindowOC7.end) {
                // === PHASE 1: FP2-basierte Events (Bett-leer-Erkennung ? pr?zise Timestamps) ===
                var _fp2Sorted = sleepSearchEvents.filter(function(e) { return e.isFP2Bed; })
                    .sort(function(a,b) { return (a.timestamp||0)-(b.timestamp||0); });
                var _bedWasEmpty = false; var _emptyTs = null; var _fp2Events = [];
                _fp2Sorted.forEach(function(_fe) {
                    var _ts = _fe.timestamp || 0;
                    if (_ts < sleepWindowOC7.start || _ts > sleepWindowOC7.end) return;
                    var _active = isActiveValue(_fe.value) || toPersonCount(_fe.value) > 0;
                    if (!_active && !_bedWasEmpty) { _bedWasEmpty = true; _emptyTs = _ts; }
                    else if (_active && _bedWasEmpty && _emptyTs) {
                        _bedWasEmpty = false;
                        var _dur = Math.round((_ts - _emptyTs) / 60000);
                        if (_dur >= 1) _fp2Events.push({ start: _emptyTs, end: _ts, duration: _dur });
                        _emptyTs = null;
                    }
                });
                if (_bedWasEmpty && _emptyTs) {
                    var _lastDur = Math.round((sleepWindowOC7.end - _emptyTs) / 60000);
                    if (_lastDur >= 1) _fp2Events.push({ start: _emptyTs, end: sleepWindowOC7.end, duration: _lastDur });
                }
                // === PHASE 2: Bewegungsmelder-Events (Bad/K?che ? Fallback + Erg?nzung zu FP2) ===
                var _bathDevIds = new Set((this.config.devices || []).filter(function(d) { return d.isBathroomSensor || d.sensorFunction === 'bathroom'; }).map(function(d) { return d.id; }));
                var _kitchDevIds = new Set((this.config.devices || []).filter(function(d) { return d.isKitchenSensor || d.sensorFunction === 'kitchen'; }).map(function(d) { return d.id; }));
                var CLUSTER_GAP_MS = 5 * 60 * 1000;
                var AFTER_EVT_MS = 3 * 60 * 1000;
                // Mehrpersonenhaushalt: Konfiguration fuer Ausser-Bett-Zuordnung
                var _cfgHousehold = this.config.householdSize || 'single';
                var _isMultiPerson = (_cfgHousehold === 'couple' || _cfgHousehold === 'family');
                var _hasFP2Bed = _fp2Events.length > 0;
                // Topologie-Hop-Filter: Schlafzimmer-nahe Raeume per BFS ermitteln (Hop <= 2)
                // Fallback: wenn Topo nicht verfuegbar -> kein Filter (graceful degradation)
                var _configDevices = this.config.devices || [];
                var _topoNearRooms = null;
                try {
                    var _topoState = await this.getStateAsync('analysis.topology.structure');
                    if (_topoState && _topoState.val) {
                        var _topoData = JSON.parse(_topoState.val);
                        var _tRooms = _topoData.rooms || [];
                        var _tMatrix = _topoData.matrix || [];
                        if (_tRooms.length > 0) {
                            var _bedRooms = new Set(_configDevices
                                .filter(function(d) { return d.isFP2Bed || d.isVibrationBed || d.sensorFunction === 'bed'; })
                                .map(function(d) { return (d.location || '').trim(); })
                                .filter(function(l) { return l.length > 0; }));
                            if (_bedRooms.size > 0) {
                                _topoNearRooms = new Set(_bedRooms);
                                var _tFrontier = Array.from(_bedRooms);
                                for (var _tHop = 0; _tHop < 2; _tHop++) {
                                    var _tNext = [];
                                    _tFrontier.forEach(function(room) {
                                        var _ri = _tRooms.indexOf(room);
                                        if (_ri === -1) return;
                                        for (var _j = 0; _j < _tRooms.length; _j++) {
                                            if (_tMatrix[_ri] && _tMatrix[_ri][_j] === 1 && !_topoNearRooms.has(_tRooms[_j])) {
                                                _topoNearRooms.add(_tRooms[_j]);
                                                _tNext.push(_tRooms[_j]);
                                            }
                                        }
                                    });
                                    _tFrontier = _tNext;
                                }
                            }
                        }
                    }
                } catch(_topoErr) { this.log.debug('[OC-7] Topology load failed: ' + (_topoErr.message||_topoErr)); }
                // Alle Nicht-Schlafzimmer-Events im Schlaffenster (Bad + Kueche + andere Raeume)
                var _motOutEvts = sleepSearchEvents.filter(function(e) {
                    var _ts = e.timestamp || 0;
                    if (_ts < sleepWindowOC7.start || _ts > sleepWindowOC7.end) return false;
                    var _isBed = e.isFP2Bed || e.isVibrationBed || e.isBedroomMotion;
                    if (_isBed) return false;
                    // Topologie-Hop-Filter: Sensoren > 2 Hops vom Schlafzimmer ignorieren
                    if (_topoNearRooms && _topoNearRooms.size > 0) {
                        var _evtLoc = (e.location || '').trim();
                        if (_evtLoc && !_topoNearRooms.has(_evtLoc)) return false;
                    }
                    return (e.type === 'motion' || e.type === 'presence_radar_bool') && isActiveValue(e.value);
                }).sort(function(a,b) { return (a.timestamp||0)-(b.timestamp||0); });                var _motEvents = []; var _curCluster = null;
                _motOutEvts.forEach(function(e) {
                    var _ts = e.timestamp || 0;
                    var _isBath = e.isBathroomSensor || _bathDevIds.has(e.id);
                    var _isOther = !_isBath; // Kueche zaehlt hier als anderer Raum (nur fuer outsideBedEvents-Dreieck relevant; isKitchenSensor bleibt fuer andere Algorithmen unveraendert)
                    if (!_curCluster) {
                        _curCluster = { start: _ts, end: _ts + AFTER_EVT_MS, hasBath: _isBath, hasOther: _isOther, sensors: [{name: e.name||e.id, location: e.location||'', isBathroomSensor: _isBath, timestamp: _ts}] };
                    } else if (_ts <= _curCluster.end + CLUSTER_GAP_MS) {
                        _curCluster.end = _ts + AFTER_EVT_MS;
                        if (_isBath) _curCluster.hasBath = true;
                        if (_isOther) _curCluster.hasOther = true;
                        var _sn = e.name||e.id; if (!_curCluster.sensors.some(function(s){return s.name===_sn;})) _curCluster.sensors.push({name: _sn, location: e.location||'', isBathroomSensor: _isBath, timestamp: _ts});
                    } else {
                        _motEvents.push(_curCluster);
                        _curCluster = { start: _ts, end: _ts + AFTER_EVT_MS, hasBath: _isBath, hasOther: _isOther, sensors: [{name: e.name||e.id, location: e.location||'', isBathroomSensor: _isBath, timestamp: _ts}] };
                    }
                });
                if (_curCluster) _motEvents.push(_curCluster);
                // === PHASE 3: Zusammenf?hren ? FP2 hat Vorrang, Motion f?llt L?cken ===
                // FP2-Solo-Dropout-Filter: kurze FP2-Abwesenheiten ohne Bestaetigung durch anderen Raum-Sensor erzeugen kein rotes Dreieck
                var MIN_FP2_SOLO_MIN = 5;
                var _fp2SoloDropoutsIgnored = 0;
                var _allEvtCandidates = [];
                _fp2Events.forEach(function(fp2) {
                    // 2-Min-Vorpuffer: Bad-Sensor kann vor FP2-Leer-Erkennung feuern
                    var _hasBath = sleepSearchEvents.some(function(e) {
                        return (e.isBathroomSensor || _bathDevIds.has(e.id)) && (e.timestamp||0) >= fp2.start - 2*60*1000 && (e.timestamp||0) <= fp2.end;
                    });
                    // Sind ausserhalb des Schlafzimmers irgendwelche Nicht-Bett-Sensoren aktiv? (Bad + andere Raeume)
                    var _hasAnySensorOutside = sleepSearchEvents.some(function(e) {
                        var _ts2 = e.timestamp||0;
                        if (_ts2 < fp2.start - 2*60*1000 || _ts2 > fp2.end + 2*60*1000) return false;
                        if (e.isFP2Bed || e.isVibrationBed || e.isBedroomMotion) return false;
                        if (_topoNearRooms && _topoNearRooms.size > 0 && (e.location||'').trim() && !_topoNearRooms.has((e.location||'').trim())) return false;
                        return (e.type === 'motion' || e.type === 'presence_radar_bool') && isActiveValue(e.value);
                    });
                    // Zusaetzlich: andere Raeume aktiv? (Kueche zaehlt als anderer Raum)
                    var _hasOtherInFp2 = _hasBath && sleepSearchEvents.some(function(e) {
                        var _ts2 = e.timestamp||0;
                        if (_ts2 < fp2.start - 2*60*1000 || _ts2 > fp2.end) return false;
                        var _isBath2 = e.isBathroomSensor || _bathDevIds.has(e.id);
                        var _isBed2  = e.isFP2Bed || e.isVibrationBed || e.isBedroomMotion;
                        if (_isBath2 || _isBed2) return false;
                        if (_topoNearRooms && _topoNearRooms.size > 0 && (e.location||"").trim() && !_topoNearRooms.has((e.location||"").trim())) return false;
                        return (e.type === "motion" || e.type === "presence_radar_bool") && isActiveValue(e.value);
                    });
                    var _fp2Dur = fp2.duration;
                    // FP2-Solo-Dropout: kein externer Sensor bestaetigt + unter Mindestdauer -> kein Dreieck
                    if (!_hasBath && !_hasAnySensorOutside && _fp2Dur < MIN_FP2_SOLO_MIN) {
                        _fp2SoloDropoutsIgnored++;
                        return;
                    }
                    // confirmed=true: anderer Raumsensor bestaetigt Abwesenheit; confirmed=false: nur FP2 (Radar-Aussetzer moeglich)
                    _allEvtCandidates.push({ start: fp2.start, end: fp2.end, duration: _fp2Dur, type: _hasBath ? "bathroom" : "outside", confirmed: _hasBath || _hasAnySensorOutside });
                    if (_hasBath && _hasOtherInFp2) {
                        // FP2-Cluster hat Bad UND andere Aussenraeume -> zweiter Marker (rot) analog Phase-2-Fix v0.33.88
                        _allEvtCandidates.push({ start: fp2.start, end: fp2.end, duration: _fp2Dur, type: "outside", confirmed: true });
                    }
                });
                if (_fp2SoloDropoutsIgnored > 0) {
                    this.log.debug('[OC-7] ' + _fp2SoloDropoutsIgnored + ' FP2-Solo-Dropout(s) < ' + MIN_FP2_SOLO_MIN + 'min ignoriert (kein Aussensensor bestaetigt)');
                }
                _motEvents.forEach(function(mot) {
                    var _overlaps = _allEvtCandidates.some(function(c) { return mot.start < c.end && mot.end > c.start; });
                    if (!_overlaps) {
                        var _dur = Math.max(1, Math.round((mot.end - mot.start) / 60000));
                        var _motSensors = mot.sensors || [];
                        if (mot.hasBath) {
                            _allEvtCandidates.push({ start: mot.start, end: mot.end, duration: _dur, type: 'bathroom', confirmed: true, sensors: _motSensors });
                            if (mot.hasOther) {
                                // Cluster hat Bad UND andere Aussenraeume -> zwei Marker (orange + rot)
                                _allEvtCandidates.push({ start: mot.start, end: mot.end, duration: _dur, type: 'outside', confirmed: true, sensors: _motSensors });
                            }
                        } else if (_isMultiPerson) {
                            // Mehrpersonenhaushalt: Aktivitaet nur zuordnen wenn FP2 Bett-leer bestaetigt
                            var _bedEmpty = _hasFP2Bed && _fp2Events.some(function(fp2) {
                                return mot.start < fp2.end && mot.end > fp2.start;
                            });
                            _allEvtCandidates.push({ start: mot.start, end: mot.end, duration: _dur, type: _bedEmpty ? 'outside' : 'other_person', confirmed: true, sensors: _motSensors });
                        } else {
                            _allEvtCandidates.push({ start: mot.start, end: mot.end, duration: _dur, type: 'outside', confirmed: true, sensors: _motSensors });
                        }
                    }
                });
                outsideBedEvents = _allEvtCandidates.sort(function(a,b) { return a.start - b.start; });
            }
            // OBE-Freeze-Fallback: wenn Snapshot eingefroren und frische Berechnung leer -> gespeicherte Events verwenden
            if (outsideBedEvents.length === 0 && _sleepFrozen && _existingSnap && Array.isArray(_existingSnap.outsideBedEvents) && _existingSnap.outsideBedEvents.length > 0) {
                outsideBedEvents = _existingSnap.outsideBedEvents;
                this.log.debug('[outsideBedEvents] Frozen-Fallback: ' + outsideBedEvents.length + ' Events aus Snapshot wiederhergestellt.');
            }

            // --- Garmin Wake-Override + Aufwachzeit-Quellen --------------------------------
            // Priorit+?tskette (absteigend): Garmin ??? FP2+Vib ??? FP2 ??? Motion ??? Fixed
            // Garmin sleepEndTimestampGMT ++berstimmt alle anderen Quellen wenn plausibel (03-14 Uhr)
            var garminWakeTs = null;
            var fp2WakeTs    = _fp2RawWakeTs || null;  // FP2-Rohwert (vor Garmin-Override)
            var _garminWakeId = (this.config.garminSleepEndStateId || '').trim()
                || 'garmin.0.dailysleep.dailySleepDTO.sleepEndTimestampGMT';
            try {
                var _gwState = await this.getForeignStateAsync(_garminWakeId);
                if (_gwState && _gwState.val != null) {
                    var _gwVal = Number(_gwState.val);
                    if (!isNaN(_gwVal) && _gwVal > 0) {
                        var _gwHr = new Date(_gwVal).getHours();
                        if (_gwHr >= 3 && _gwHr < 14) {
                            garminWakeTs = _gwVal;
                            this.log.debug('[Wake] Garmin plausibel: ' + new Date(garminWakeTs).toISOString());
                        } else {
                            this.log.debug('[Wake] Garmin ausserhalb 03-14h: ' + new Date(_gwVal).toISOString());
                        }
                    }
                }
            } catch(_gwe) { this.log.debug('[Wake] Garmin-End nicht lesbar: ' + _gwe.message); }

            // Vibrationssensor-Best+?tigung: Letztes Vib-Event vor FP2-Leer-Signal (-?30min)
            // Erh+?ht Konfidenz, +?ndert aber nicht den Timestamp
            // ---- Aufwachzeit von computePersonSleep (Single-Source-of-Truth) ----
            var allWakeSources = _gR.allWakeSources.map(function(s) {
                return s.source === 'garmin' ? { source: 'garmin', ts: garminWakeTs || null } : s;
            });
            var wakeSource = garminWakeTs ? 'garmin' : (_gR.wakeSource || 'fixed');
            var wakeConf   = garminWakeTs ? 'maximal' : (_gR.wakeConf   || 'niedrig');
            if (garminWakeTs) {
                sleepWindowOC7.end = garminWakeTs;
                this.log.info('[Wake] Garmin-Override (global): ' + new Date(garminWakeTs).toISOString());
            } else if (_gR.sleepWindowEnd) {
                sleepWindowOC7.end = _gR.sleepWindowEnd;
            }


            // OC-WakeOv: Manueller Override der Aufwachzeit (global)
            var _wakeOverrideApplied = false;
            try {
                var _wovRaw = (await this.getStateAsync('analysis.sleep.wakeOverride'))?.val;
                if (_wovRaw && _wovRaw !== 'null') {
                    var _wov = JSON.parse(_wovRaw);
                    if (_wov && _wov.date === sleepDate && _wov.ts) {
                        sleepWindowOC7.end = _wov.ts;
                        wakeSource = _wov.source || 'override';
                        _wakeOverrideApplied = true;
                        this.log.info('[WakeOv] Override aktiv: ' + wakeSource + ' = ' + new Date(_wov.ts).toISOString());
                    }
                }
            } catch(_wovE) { this.log.warn('[WakeOv] Fehler: ' + _wovE.message); }

            // === STAGES + SCORE: Jetzt berechnen � sleepWindowOC7.end ist nach Wake-Detection gesetzt ===
            // Non-frozen: End-Zeit jetzt bekannt (von Garmin/FP2/motion/other-room/override)
            if (!_sleepFrozen && sleepWindowOC7.start && sleepWindowOC7.end) {
                _shouldRecalcStages = true;
            }
            if (_shouldRecalcStages && sleepWindowOC7.start && sleepWindowOC7.end) {
                var SLOT_MS = 5 * 60 * 1000;
                var swStart = sleepWindowOC7.start;
                var swEnd   = sleepWindowOC7.end;
                var slotCount = Math.ceil((swEnd - swStart) / SLOT_MS);
                var vibDetInWindow = sleepSearchEvents.filter(function(e) {
                    return e.isVibrationBed && (e.timestamp||0) >= swStart && (e.timestamp||0) <= swEnd
                        && (isActiveValue(e.value) || toPersonCount(e.value) > 0);
                });
                var vibStrInWindow = sleepSearchEvents.filter(function(e) {
                    return e.isVibrationStrength && (e.timestamp||0) >= swStart && (e.timestamp||0) <= swEnd;
                });
                var deepSec = 0, lightSec = 0, remSec = 0, wakeSec = 0;
                var consecutiveQuiet = 0;
                for (var _sl = 0; _sl < slotCount; _sl++) {
                    var slotS = swStart + _sl * SLOT_MS;
                    var slotE = slotS + SLOT_MS;
                    var slotDet = vibDetInWindow.filter(function(e) { return (e.timestamp||0) >= slotS && (e.timestamp||0) < slotE; }).length;
                    var slotStrArr = vibStrInWindow.filter(function(e) { return (e.timestamp||0) >= slotS && (e.timestamp||0) < slotE; })
                        .map(function(e) { return typeof e.value === 'number' ? e.value : parseFloat(e.value) || 0; });
                    var slotStrMax = slotStrArr.length > 0 ? Math.max.apply(null, slotStrArr) : 0;
                    var hoursIn = (slotS - swStart) / 3600000;
                    var stage;
                    if (slotDet === 0) {
                        consecutiveQuiet++;
                        stage = consecutiveQuiet >= 5 ? 'deep' : 'light';
                    } else if (slotDet >= 5 || slotStrMax > 28) {
                        consecutiveQuiet = 0;
                        stage = 'wake';
                    } else if (slotDet >= 2 && hoursIn >= 2.5 && slotStrMax >= 12 && slotStrMax <= 28) {
                        consecutiveQuiet = 0;
                        stage = 'rem';
                    } else {
                        consecutiveQuiet = 0;
                        stage = 'light';
                    }
                    sleepStages.push({ t: _sl * 5, s: stage });
                    if (stage === 'deep')  deepSec  += 300;
                    else if (stage === 'light') lightSec += 300;
                    else if (stage === 'rem')   remSec   += 300;
                    else                         wakeSec  += 300;
                }
                var totalSecSleep = deepSec + lightSec + remSec + wakeSec;
                var durMin = (swEnd - swStart) / 60000;
                var durScore = Math.max(20, Math.min(95, 25 + 0.12 * durMin));
                var stageAdjustment = 0;
                if (totalSecSleep > 0) {
                    var dp = deepSec / totalSecSleep;
                    var rp = remSec  / totalSecSleep;
                    var lp = lightSec / totalSecSleep;
                    var wp = wakeSec  / totalSecSleep;
                    var coverage = Math.min(1, (totalSecSleep / 60) / Math.max(1, durMin));
                    stageAdjustment = Math.max(-8, Math.min(8, Math.round((rp * 30 - wp * 50) * coverage)));
                }
                sleepScoreRaw = Math.round(Math.max(0, durScore + stageAdjustment));
                sleepScore    = Math.round(Math.max(0, Math.min(100, sleepScoreRaw)));
                this.log.debug('[SleepScore-V2] Score=' + sleepScore + ' dur=' + Math.round(durMin) + 'min durScore=' + Math.round(durScore) + ' adj=' + stageAdjustment + ' deep=' + (totalSecSleep>0?Math.round(deepSec/totalSecSleep*100):0) + '% rem=' + (totalSecSleep>0?Math.round(remSec/totalSecSleep*100):0) + '%');
            }

            // --- Garmin-Validierung (optional) --------------------------------------------
            // Liest den Garmin-Sleep-Score wenn konfiguriert ? graceful fallback
            var garminScore = null;
            var garminDeepSec = null, garminLightSec = null, garminRemSec = null;
            var garminStateId = (this.config.garminSleepScoreStateId || '').trim()
                || 'garmin.0.dailysleep.dailySleepDTO.sleepScores.overall.value';
            try {
                var gScoreState = await this.getForeignStateAsync(garminStateId);
                if (gScoreState && gScoreState.val != null) {
                    garminScore = Number(gScoreState.val) || null;
                    this.log.debug('[Garmin] Sleep Score gelesen: ' + garminScore);
                }
            } catch(e) { /* Garmin-Adapter nicht vorhanden */ }

            // Optional: Schlafdauer-Felder von Garmin lesen
            var garminDeepId  = (this.config.garminDeepSleepStateId  || '').trim() || 'garmin.0.dailysleep.dailySleepDTO.deepSleepSeconds';
            var garminLightId = (this.config.garminLightSleepStateId || '').trim() || 'garmin.0.dailysleep.dailySleepDTO.lightSleepSeconds';
            var garminRemId   = (this.config.garminRemSleepStateId   || '').trim() || 'garmin.0.dailysleep.dailySleepDTO.remSleepSeconds';
            try {
                var gd = await this.getForeignStateAsync(garminDeepId);
                var gl = await this.getForeignStateAsync(garminLightId);
                var gr = await this.getForeignStateAsync(garminRemId);
                if (gd && gd.val != null) garminDeepSec  = Number(gd.val) || null;
                if (gl && gl.val != null) garminLightSec = Number(gl.val) || null;
                if (gr && gr.val != null) garminRemSec   = Number(gr.val) || null;
            } catch(e) {}

            // Sleep Validation State speichern (fuer SQL-Logging)
            if (sleepScore !== null || garminScore !== null) {
                var validationObj = {
                    date: dateStr,
                    auraScore: sleepScore,
                    auraScoreCal: sleepScoreCal,
                    garminScore: garminScore,
                    delta: (sleepScore !== null && garminScore !== null) ? garminScore - sleepScore : null,
                    garminDeepMin:  garminDeepSec  ? Math.round(garminDeepSec  / 60) : null,
                    garminLightMin: garminLightSec ? Math.round(garminLightSec / 60) : null,
                    garminRemMin:   garminRemSec   ? Math.round(garminRemSec   / 60) : null,
                    timestamp: Date.now()
                };
                try {
                    await this.setObjectNotExistsAsync('analysis.health.sleepValidation', {
                        type: 'state', common: { name: 'Sleep Score Validation (AURA vs Garmin)', type: 'string', role: 'json', read: true, write: false, def: '{}' }, native: {}
                    });
                    await this.setStateAsync('analysis.health.sleepValidation', { val: JSON.stringify(validationObj), ack: true });
                } catch(e) {}
            }

            // --- OC-7 DIAGNOSE-STATE (hilft beim Debuggen ob Sleep-Analyse l+?uft) ------
            try {
                await this.setObjectNotExistsAsync('analysis.health.saveDailyDebug', {
                    type: 'state', common: { name: 'OC-7 Sleep Debug (letzter saveDailyHistory-Lauf)', type: 'string', role: 'json', read: true, write: false, def: '{}' }, native: {}
                });
                const _debugObj = {
                    timestamp: new Date().toISOString(),
                    dateStr: dateStr,
                    eventHistoryCount: this.eventHistory.length,
                    todayEventsCount: todayEvents.length,
                    sleepSearchEventsCount: sleepSearchEvents.length,
                    vibrationBedEventsTotal: sleepSearchEvents.filter(function(e){ return e.isVibrationBed; }).length,
                    fp2BedEventsTotal: sleepSearchEvents.filter(function(e){ return e.isFP2Bed; }).length,
                    bedPresenceMinutes: bedPresenceMinutes,
                    sleepWindowCalcStart: sleepWindowCalc.start ? new Date(sleepWindowCalc.start).toISOString() : null,
                    sleepWindowCalcEnd:   sleepWindowCalc.end   ? new Date(sleepWindowCalc.end).toISOString()   : null,
                    sleepWindowOC7Start:  sleepWindowOC7.start  ? new Date(sleepWindowOC7.start).toISOString()  : null,
                    sleepWindowOC7End:    sleepWindowOC7.end    ? new Date(sleepWindowOC7.end).toISOString()    : null,
                    sleepStagesCount: sleepStages.length,
                    sleepScore: sleepScore,
                    oc4GuardFired: (bedPresenceMinutes < 180 && sleepWindowCalc.start === null && sleepSearchEvents.filter(function(e){ return e.isFP2Bed; }).length > 0),
                };
                await this.setStateAsync('analysis.health.saveDailyDebug', { val: JSON.stringify(_debugObj), ack: true });
                this.log.info('[OC-7 Debug] stages=' + sleepStages.length + ' windowOC7=' + (_debugObj.sleepWindowOC7Start || 'NULL') + ' bedPresMin=' + bedPresenceMinutes + ' vibBedEvts=' + _debugObj.vibrationBedEventsTotal);
            } catch(_de) { this.log.warn('[OC-7 Debug] Fehler beim Schreiben des Debug-States: ' + _de.message); }

            // Vibration Bett: Erschuetterungen im Schlaf-Fenster (Fallback: 22-06)
            var nightVibrationCount = todayEvents.filter(function(e) {
                if (!e.isVibrationBed) return false;
                var v = isActiveValue(e.value) || toPersonCount(e.value) > 0;
                if (!v) return false;
                var ts = e.timestamp||0;
                if (sleepWindowCalc.start && sleepWindowCalc.end) {
                    return ts >= sleepWindowCalc.start && ts <= sleepWindowCalc.end;
                }
                var hr = new Date(ts).getHours();
                return hr >= 22 || hr < 6;
            }).length;
            // Vibration Staerke: Avg und Max im Schlaf-Fenster (fuer Parkinson/Epilepsie)
            var _vibStrSum = 0; var _vibStrCount = 0; var _vibStrMax = 0;
            todayEvents.forEach(function(e) {
                if (!e.isVibrationStrength) return;
                var ts = e.timestamp || 0;
                var inWin = (sleepWindowCalc.start && sleepWindowCalc.end)
                    ? (ts >= sleepWindowCalc.start && ts <= sleepWindowCalc.end)
                    : (new Date(ts).getHours() >= 22 || new Date(ts).getHours() < 6);
                if (!inWin) return;
                var s = typeof e.value === 'number' ? e.value : parseFloat(e.value);
                if (isNaN(s) || s <= 0) return;
                _vibStrSum += s; _vibStrCount++; if (s > _vibStrMax) _vibStrMax = s;
            });
            const nightVibrationStrengthAvg = _vibStrCount > 0 ? Math.round(_vibStrSum / _vibStrCount) : null;
            const nightVibrationStrengthMax = _vibStrCount > 0 ? _vibStrMax : null;

            // ============================================================
            // bedWasEmpty: Bett leer erkennen (Person auswaerts geschlafen)
            // Alle drei Kriterien muessen erfuellt sein:
            // 1. nightVibrationCount === 0 (kein Vibrationssensor)
            // 2. Keine FP2-Bed-Events im Schlaffenster
            // 3. Alle lokalen sleepStart-Quellen null (fp2, fp2_vib, haus_still, motion_vib)
            // ============================================================
            var _fp2InWindow = (sleepWindowOC7.start && sleepWindowOC7.end)
                ? sleepSearchEvents.filter(function(e) {
                    return e.isFP2Bed && (e.timestamp||0) >= sleepWindowOC7.start && (e.timestamp||0) <= sleepWindowOC7.end;
                }).length : 0;
            var _localSourcesNull = !allSleepStartSources.some(function(s) {
                return (s.source === 'fp2' || s.source === 'fp2_vib' || s.source === 'haus_still' || s.source === 'motion_vib') && s.ts;
            });
            var bedWasEmpty = nightVibrationCount === 0 && _fp2InWindow === 0 && _localSourcesNull;
            if (bedWasEmpty) {
                sleepScore    = null;
                sleepScoreRaw = null;
                sleepStages   = [];
                this.log.info('[bedWasEmpty] Bett leer erkannt: fp2InWindow=' + _fp2InWindow + ' vibCount=0 lokalNull=' + _localSourcesNull);
            }

            // Nykturie: Badezimmer-Sensor-Ereignisse ? dynamisches Schlaf-Fenster (Fallback: 22-06)
            const _bathroomDevIds = new Set((this.config.devices || []).filter(function(d) { return d.isBathroomSensor || d.sensorFunction === 'bathroom'; }).map(function(d) { return d.id; }));
            const _kitchenDevIds  = new Set((this.config.devices || []).filter(function(d) { return d.isKitchenSensor || d.sensorFunction === 'kitchen'; }).map(function(d) { return d.id; }));
            const nocturiaCount = (function() {
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
            })();
            const kitchenVisits = (function() {
                var hours = new Set();
                todayEvents.forEach(function(e) {
                    if (!e.isKitchenSensor && !_kitchenDevIds.has(e.id)) return;
                    var hr = new Date(e.timestamp || e.ts || 0).getHours();
                    hours.add(hr);
                });
                return hours.size;
            })();

            // ============================================================
            // Per-Person Smartwatch: async reads vor der personData-IIFE
            // Format: { person: { sleepStartId: '...', wakeId: '...' } }
            // Funktioniert mit jeder Smartwatch (Garmin, Samsung, Fitbit, etc.)
            var _personGarminData = {};
            var _garminAssign = (this.config.garminPersonAssignment && typeof this.config.garminPersonAssignment === 'object')
                ? this.config.garminPersonAssignment : {};
            for (var _gaPerson of Object.keys(_garminAssign)) {
                var _gaEntry = _garminAssign[_gaPerson];
                if (!_gaEntry || typeof _gaEntry !== 'object') continue;
                var _gaSleepId = (_gaEntry.sleepStartId || '').trim();
                var _gaWakeId  = (_gaEntry.wakeId  || '').trim();
                if (!_gaSleepId && !_gaWakeId) continue;
                try {
                    var _gaStartSt2 = _gaSleepId ? await this.getForeignStateAsync(_gaSleepId) : null;
                    var _gaEndSt2   = _gaWakeId  ? await this.getForeignStateAsync(_gaWakeId)  : null;
                    var _gaStartV   = (_gaStartSt2 && _gaStartSt2.val != null) ? Number(_gaStartSt2.val) : null;
                    var _gaEndV     = (_gaEndSt2   && _gaEndSt2.val   != null) ? Number(_gaEndSt2.val)   : null;
                    var _gaStartH   = _gaStartV ? new Date(_gaStartV).getHours() : null;
                    var _gaEndH     = _gaEndV   ? new Date(_gaEndV).getHours()   : null;
                    var _gaSleepSt  = (_gaStartV && _gaStartH !== null && (_gaStartH >= 18 || _gaStartH < 4)
                        && _gaStartV >= _sleepSearchBase.getTime() - 2*3600000
                        && _gaStartV <= _sleepSearchBase.getTime() + 16*3600000) ? _gaStartV : null;
                    var _gaWakeT    = (_gaEndV && _gaEndH !== null && _gaEndH >= 3 && _gaEndH < 14) ? _gaEndV : null;
                    _personGarminData[_gaPerson] = { sleepStartTs: _gaSleepSt, wakeTs: _gaWakeT };
                    if (_gaSleepSt) this.log.info('[Per-Person Watch] ' + _gaPerson + ' Einschlafen: ' + new Date(_gaSleepSt).toISOString());
                    if (_gaWakeT)   this.log.info('[Per-Person Watch] ' + _gaPerson + ' Aufwachen: '  + new Date(_gaWakeT).toISOString());
                } catch(_gaE) { this.log.debug('[Per-Person Watch] ' + _gaPerson + ' Fehler: ' + _gaE.message); }
            }

                        // Per-Person Nacht-Analyse Per-Person Nacht-Analyse
            // ============================================================
            const _self = this;
            const personData = (function() {
                var result = {};
                var devices = (_self.config && _self.config.devices) ? _self.config.devices : [];
                var personSensorIds = {};
                devices.forEach(function(d) {
                    if (!d.personTag || !d.personTag.trim()) return;
                    var p = d.personTag.trim();
                    if (!personSensorIds[p]) personSensorIds[p] = new Set();
                    personSensorIds[p].add(d.id);
                });
                if (Object.keys(personSensorIds).length === 0) return result;
                var winStart = sleepWindowCalc.start || sleepWindowOC7.start || _sleepSearchBase.getTime(); // Fallback: gestern 18:00 (analog _sleepSearchBase) statt 22:00 heute
                var winEnd   = sleepWindowCalc.end   || (function(){ var d=new Date(); d.setHours(6,0,0,0); if(d.getTime()<winStart) d.setDate(d.getDate()+1); return d.getTime(); })();
                var _wakeHardCapMs = (function(){ var _d = new Date(); _d.setHours(12, 0, 0, 0); return _d.getTime(); })();
                Object.keys(personSensorIds).forEach(function(person) {
                    var ids = personSensorIds[person];
                    var personEvents = todayEvents.filter(function(e) { return ids.has(e.id); });
                    var nightEvents = personEvents.filter(function(e) {
                        var ts = e.timestamp||e.ts||0; return ts >= winStart && ts <= winEnd;
                    });
                    var nightActivityCount = nightEvents.length;
                    var morning5 = new Date(winEnd); morning5.setHours(5,0,0,0);
                    var morningEvt = personEvents.filter(function(e) {
                        var ts=e.timestamp||e.ts||0; return ts >= morning5.getTime();
                    }).sort(function(a,b){ return (a.timestamp||0)-(b.timestamp||0); });
                    var wakeTimeMin = morningEvt.length > 0 ? Math.round(((morningEvt[0].timestamp||0) - new Date(morningEvt[0].timestamp||0).setHours(0,0,0,0)) / 60000) : null;
                    var bathroomIds2 = new Set(((_self.config && _self.config.devices)||[]).filter(function(d){ return d.isBathroomSensor || d.sensorFunction==='bathroom'; }).map(function(d){ return d.id; }));
                    var bathroomNightEvents = todayEvents.filter(function(e) {
                        if (!bathroomIds2.has(e.id)) return false;
                        var ts = e.timestamp||e.ts||0; return ts >= winStart && ts <= winEnd;
                    });
                    var nocturiaAttr = 0;
                    bathroomNightEvents.forEach(function(bathEvt) {
                        var bathTs = bathEvt.timestamp||0;
                        var recentPersonEvt = nightEvents.filter(function(e) { var ts=e.timestamp||0; return ts>=bathTs-10*60*1000&&ts<bathTs; });
                        if (recentPersonEvt.length > 0) nocturiaAttr++;
                    });
                    // Per-Person Garmin (Zuweisung via config.garminPersonAssignment)
                    var _pGarminInfo = _personGarminData[person] || {};
                    var _pGarminTs = _pGarminInfo.sleepStartTs || null;
                    var _pGarminWakeTs = _pGarminInfo.wakeTs || null;
                    // computePersonSleep: einheitlicher Algorithmus (Single-Source-of-Truth)
                    var _pResult = computePersonSleep({
                        allEvents:     sleepSearchEvents,
                        personTag:     person,
                        fp2RawStart:   null,
                        garminTs:      _pGarminTs,
                        garminWakeTs:  _pGarminWakeTs,
                        fp2WakeTs:     null,
                        searchBase:    _sleepSearchBase,
                        wakeHardCap:   _wakeHardCapMs,
                        startOverride: (_personOverrides&&_personOverrides[person])?_personOverrides[person]:null,
                        wakeOverride:  (_personWakeOverrides&&_personWakeOverrides[person])?_personWakeOverrides[person]:null,
                        existingSnap:  (_existingSnap&&_existingSnap.personData&&_existingSnap.personData[person])?_existingSnap.personData[person]:null,
                        sleepDate:     sleepDate,
                        bathroomIds:   _bathroomDevIds,
                        log:           _self.log
                    });
                    var sleepOnsetMin = null;
                    if (_pResult.sleepWindowStart) {
                        sleepOnsetMin = Math.round((_pResult.sleepWindowStart - new Date(_pResult.sleepWindowStart).setHours(0,0,0,0)) / 60000);
                    }
                    result[person] = {
                        nightActivityCount:   nightActivityCount,
                        wakeTimeMin:          wakeTimeMin,
                        sleepOnsetMin:        sleepOnsetMin,
                        nocturiaAttr:         nocturiaAttr,
                        sleepWindowStart:     _pResult.sleepWindowStart,
                        sleepWindowEnd:       _pResult.sleepWindowEnd,
                        wakeSource:           _pResult.wakeSource,
                        wakeConf:             _pResult.wakeConf,
                        sleepStartSource:     _pResult.sleepStartSource,
                        sleepStartOverridden: _pResult.sleepStartOverridden,
                        allSleepStartSources: _pResult.allSleepStartSources,
                        allWakeSources:       _pResult.allWakeSources,
                        wakeConfirmed:        _pResult.wakeConfirmed,
                        wakeOverridden:       _pResult.wakeOverridden,
                        bedWasEmpty:          _pResult.bedWasEmpty,
                        outsideBedEvents:     _pResult.outsideBedEvents,
                        sleepStages:          _pResult.sleepStages,
                        stagesWindowStart:    _pResult.stagesWindowStart,
                        sleepScore:           _pResult.sleepScore,
                        sleepScoreRaw:        _pResult.sleepScoreRaw,
                        sleepScoreCalStatus:  'uncalibrated'
                    };
                });
                return result;
            })();

            try { await this.setStateAsync('system.personData', { val: JSON.stringify(personData), ack: true }); } catch(e) {}


            // --- Garmin-Kalibrierung: sleepScoreCal berechnen ---
            try {
                await this.setObjectNotExistsAsync('analysis.health.sleepScoreHistory', {
                    type: 'state', common: { name: 'Sleep Score History for Calibration (JSON)', type: 'string', role: 'json', read: true, write: false, def: '[]' }, native: {}
                });
                var _scoreHistory = [];
                var _histState = await this.getStateAsync('analysis.health.sleepScoreHistory');
                if (_histState && _histState.val) { try { _scoreHistory = JSON.parse(_histState.val); if (!Array.isArray(_scoreHistory)) _scoreHistory = []; } catch(_) { _scoreHistory = []; } }
                if (sleepScore !== null) {
                    var _existingHIdx = _scoreHistory.findIndex(function(e) { return e.date === dateStr; });
                    var _histEntry = { date: dateStr, aura: sleepScore, garmin: garminScore || null };
                    if (_existingHIdx >= 0) _scoreHistory[_existingHIdx] = _histEntry; else _scoreHistory.push(_histEntry);
                }
                if (_scoreHistory.length > 60) _scoreHistory = _scoreHistory.slice(_scoreHistory.length - 60);
                await this.setStateAsync('analysis.health.sleepScoreHistory', { val: JSON.stringify(_scoreHistory), ack: true });
                var _calNights = _scoreHistory.filter(function(e) { return e.aura !== null && e.garmin !== null; });
                sleepScoreCalNights = _calNights.length;
                if (_calNights.length >= 7) {
                    sleepScoreCalStatus = _calNights.length >= 14 ? 'calibrated' : 'calibrating';
                    var _meanOffset = _calNights.reduce(function(sum, e) { return sum + (e.garmin - e.aura); }, 0) / _calNights.length;
                    if (sleepScore !== null) {
                        sleepScoreCal = Math.round(Math.max(0, Math.min(100, sleepScore + _meanOffset)));
                    }
                    this.log.debug('[SleepScoreCal] Status=' + sleepScoreCalStatus + ' nights=' + _calNights.length + ' offset=' + Math.round(_meanOffset) + ' cal=' + sleepScoreCal);
                }
            } catch (_calErr) {
                this.log.warn('[SleepScoreCal] Fehler: ' + _calErr.message);
            }
            // =====================================================================
            // INTIMACY DETECTION (OC-SEX): Vibrations-basierte Aktivitaetserkennung
            // Zeitfenster: KEINS - Sex ist zeitlos! Voller sleepSearchEvents-Buffer.
            // 5-Min-Slots, Pfad A (kurz+intensiv), Pfad B (laenger+moderat)
            // Nur gespeichert wenn moduleSex === true (Datenschutz-Default: off)
            // =====================================================================
            var intimacyEvents = [];
            var _calibInfo = { src: 'default', n: 0, calibA: 50, calibB: 30 };
            if (this.config.moduleSex === true) {
                try {
                    // Kalibrierte oder Standard-Schwellen (aus native config oder Defaults)
                    // --- ADAPTIVE KALIBRIERUNG (OC-SEX) ---
                    // Prioritaet: 1. Auto aus Training-Labels, 2. Manuell (sexCalibThreshold), 3. Anomalie-Baseline, 4. Defaults
                    var _calibA = 50, _calibB = 30, _calibSrc = 'default', _calibN = 0;
                    // 1. Auto-Kalibrierung aus Training-Labels (ab 2 Labels)
                    try {
                        var _sexLabelsRaw = this.config.sexTrainingLabels || '';
                        var _sexLabels = [];
                        try { var _slP = JSON.parse(_sexLabelsRaw); if (Array.isArray(_slP)) _sexLabels = _slP.filter(function(l){return l&&l.date;}); } catch(_slPE){}
                        if (_sexLabels.length >= 2) {
                            var _calHistDir = require('path').join(utils.getAbsoluteDefaultDataDir(), 'cogni-living', 'history');
                            var _sessionPeaks = [], _vaginalPeaks = [], _oralPeaks = [];
                            var _sexTrainData = []; // Stufe 3: Features fuer Python
                            var SLOT_CAL_MS = 5*60*1000;
                            var _labelsUpdated = false;
                            for (var _lbl of _sexLabels /* alle Typen inkl. Nullnummer (3. RF-Klasse), unlimitiert */) {
                                // Fast-Path: gespeicherte Features direkt verwenden
                                if (_lbl._features) {
                                    var _lFP = _lbl._features, _lTypFP = (_lbl.type||'').toLowerCase();
                                    if (_lTypFP !== 'nullnummer') _sessionPeaks.push(_lFP.medianPeak);
                                    if (_lTypFP === 'vaginal') _vaginalPeaks.push(_lFP.medianPeak);
                                    else if (_lTypFP === 'oral_hand') _oralPeaks.push(_lFP.medianPeak);
                                    _sexTrainData.push({peak:_lFP.peakMax,durSlots:_lFP.durSlots,avgPeak:_lFP.avgPeak,variance:_lFP.variance,tierB:0,label:_lTypFP,date:_lbl.date||'',hourSin:_lFP.hourSin||0,hourCos:_lFP.hourCos||1,lightOn:_lFP.lightOn!==undefined?_lFP.lightOn:null,presenceOn:_lFP.presenceOn!==undefined?_lFP.presenceOn:null,roomTemp:_lFP.roomTemp||null,bathBefore:_lFP.bathBefore||0,bathAfter:_lFP.bathAfter||0});
                                    continue;
                                }
                                try {
                                    var _lPath = require('path').join(_calHistDir, _lbl.date + '.json');
                                    if (!fs.existsSync(_lPath)) continue;
                                    var _lSnap = JSON.parse(fs.readFileSync(_lPath, 'utf8'));
                                    var _lAllEvts = (_lSnap.eventHistory || []).filter(function(e){ return e.type==='vibration_strength' && (e.isVibrationBed||e.isFP2Bed); });
                                    if (_lAllEvts.length === 0) continue;
                                    // Zeitfenster: +-45 Min um Label-Zeit, sonst alle Events des Tages
                                    var _lT0 = null, _lT1 = null;
                                    if (_lbl.time && /^\d{1,2}:\d{2}$/.test(_lbl.time)) {
                                        var _lP = _lbl.time.split(':');
                                        var _lBase = new Date(_lbl.date + 'T00:00:00');
                                        _lBase.setHours(parseInt(_lP[0]), parseInt(_lP[1]), 0, 0);
                                        _lT0 = _lBase.getTime() - 45*60000;
                                        _lT1 = _lBase.getTime() + ((_lbl.durationMin||45) + 15)*60000;
                                    }
                                    var _lEvts = _lT0 !== null ? _lAllEvts.filter(function(e){ var t=e.timestamp||0; return t>=_lT0&&t<=_lT1; }) : _lAllEvts;
                                    if (_lEvts.length === 0) continue;
                                    // Slot-Peak-Median berechnen
                                    _lEvts.sort(function(a,b){return (a.timestamp||0)-(b.timestamp||0);});
                                    var _lFirst = _lEvts[0].timestamp||0, _lLast = (_lEvts[_lEvts.length-1].timestamp||0)+SLOT_CAL_MS;
                                    var _lSlotPeaks = [];
                                    for (var _lS=_lFirst; _lS<_lLast; _lS+=SLOT_CAL_MS) {
                                        var _lSlotVals = _lEvts.filter(function(e){ var t=e.timestamp||0; return t>=_lS&&t<_lS+SLOT_CAL_MS; }).map(function(e){ return Number(e.value)||0; });
                                        if (_lSlotVals.length > 0) _lSlotPeaks.push(Math.max.apply(null,_lSlotVals));
                                    }
                                    if (_lSlotPeaks.length > 0) {
                                        _lSlotPeaks.sort(function(a,b){return a-b;});
                                        var _lMedian = _lSlotPeaks[Math.floor(_lSlotPeaks.length/2)];
                                        // Bug-Fix: Nullnummer-Peaks nicht in _sessionPeaks (wuerden calibA faelschlich senken)
                                        var _lTypNorm = (_lbl.type||'').toLowerCase();
                                        if (_lTypNorm !== 'nullnummer') _sessionPeaks.push(_lMedian);
                                        if (_lTypNorm === 'vaginal') _vaginalPeaks.push(_lMedian);
                                        else if (_lTypNorm === 'oral_hand') _oralPeaks.push(_lMedian);
                                        // Stufe 3: Features fuer Python-Klassifikator
                                        var _lPkMax = _lSlotPeaks[_lSlotPeaks.length-1];
                                        var _lAvgP = Math.round(_lSlotPeaks.reduce(function(a,b){return a+b;},0)/_lSlotPeaks.length);
                                        var _lVarP = Math.round(_lSlotPeaks.reduce(function(a,b){return a+(b-_lAvgP)*(b-_lAvgP);},0)/_lSlotPeaks.length);
                                        // Kontext-Features aus Label-JSON EventHistory extrahieren
                                        var _lCtxEvts = _lSnap.eventHistory || [];
                                        var _lSessProxy = {start: _lT0||_lFirst, end: _lT1||(_lLast+_lFirst)};
                                        var _lHrD=new Date(_lSessProxy.start); var _lHF=_lHrD.getHours()+_lHrD.getMinutes()/60;
                                        var _lHSin=Math.round(Math.sin(2*Math.PI*_lHF/24)*1000)/1000;
                                        var _lHCos=Math.round(Math.cos(2*Math.PI*_lHF/24)*1000)/1000;
                                        var _lLitE=_lCtxEvts.filter(function(e){var t=e.timestamp||0;return (e.type==='light'||e.type==='dimmer')&&(typeof _ctxBedIds!=='undefined'?_ctxBedIds.has(e.id):false)&&t>=_lSessProxy.start-15*60000&&t<=_lSessProxy.end+30*60000;});
                                        var _lLightOn=_lLitE.length>0?(Number(_lLitE[_lLitE.length-1].value)>0?1:0):null;
                                        var _lPresE=_lCtxEvts.filter(function(e){var t=e.timestamp||0;return e.isFP2Bed&&t>=_lSessProxy.start-15*60000&&t<=_lSessProxy.end+30*60000;});
                                        var _lPresOn=_lPresE.length>0?(Number(_lPresE[_lPresE.length-1].value)>0?1:0):null;
                                        var _lTempE=_lCtxEvts.filter(function(e){var t=e.timestamp||0;return (e.type==='temperature'||e.type==='thermostat')&&(typeof _ctxBedIds!=='undefined'?_ctxBedIds.has(e.id):false)&&t>=_lSessProxy.start-15*60000&&t<=_lSessProxy.end+30*60000;});
                                        var _lRoomT=_lTempE.length>0?(Number(_lTempE[_lTempE.length-1].value)||null):null;
                                        var _lBathB=_lCtxEvts.some(function(e){var t=e.timestamp||0;return (e.isBathroomSensor||(typeof _ctxBathIds!=='undefined'&&_ctxBathIds.has(e.id)))&&e.type==='motion'&&t>=_lSessProxy.start-60*60000&&t<_lSessProxy.start;})?1:0;
                                        var _lBathA=_lCtxEvts.some(function(e){var t=e.timestamp||0;return (e.isBathroomSensor||(typeof _ctxBathIds!=='undefined'&&_ctxBathIds.has(e.id)))&&e.type==='motion'&&t>_lSessProxy.end&&t<=_lSessProxy.end+60*60000;})?1:0;
                                        // Features einmalig im Label speichern (Migration)
                                         if (!_lbl._features) { _lbl._features = {peakMax:_lPkMax,medianPeak:_lMedian,durSlots:_lSlotPeaks.length,avgPeak:_lAvgP,variance:_lVarP,hourSin:_lHSin,hourCos:_lHCos,lightOn:_lLightOn,presenceOn:_lPresOn,roomTemp:_lRoomT,bathBefore:_lBathB,bathAfter:_lBathA}; _labelsUpdated = true; }
                                         _sexTrainData.push({ peak: _lPkMax, durSlots: _lSlotPeaks.length, avgPeak: _lAvgP, variance: _lVarP, tierB: 0, label: _lTypNorm, date: _lbl.date||'', hourSin: _lHSin, hourCos: _lHCos, lightOn: _lLightOn, presenceOn: _lPresOn, roomTemp: _lRoomT, bathBefore: _lBathB, bathAfter: _lBathA });
                                    }
                                } catch(_lE) { this.log.debug('[OC-SEX] Calib-Label: '+_lE.message); }
                            }
                            // Angereicherte Labels persistieren (Fire-and-Forget)
                            if (_labelsUpdated) { try { var _lblUpd=JSON.stringify(_sexLabels); this.config.sexTrainingLabels=_lblUpd; this.extendForeignObject('system.adapter.'+this.namespace,{native:{sexTrainingLabels:_lblUpd}},function(){}); this.log.debug('[OC-SEX] Labels angereichert ('+_sexLabels.filter(function(l){return l._features;}).length+' mit Features)'); } catch(_lSE){} }
                            // Stufe 2: Typ-spezifische Kalibrierung
                            if (_vaginalPeaks.length >= 2 && _oralPeaks.length >= 2) {
                                _vaginalPeaks.sort(function(a,b){return a-b;}); _oralPeaks.sort(function(a,b){return a-b;});
                                _calibA = Math.max(5, Math.round(_vaginalPeaks[0] * 1.0));
                                _calibB = Math.max(3, Math.round(_oralPeaks[0] * 0.7));
                                _calibSrc = 'labels_typed'; _calibN = _sessionPeaks.length;
                                this.log.info('[OC-SEX] Stufe-2-Kalib: calibA='+_calibA+' (vaginal/'+_vaginalPeaks.length+'x) calibB='+_calibB+' (oral/'+_oralPeaks.length+'x)');
                            } else if (_sessionPeaks.length >= 2) {
                                _sessionPeaks.sort(function(a,b){return a-b;});
                                var _minPeak = _sessionPeaks[0];
                                _calibB = Math.max(3, Math.round(_minPeak * 0.7));
                                _calibA = Math.max(5, Math.round(_minPeak * 1.1));
                                _calibSrc = 'labels'; _calibN = _sessionPeaks.length;
                                this.log.info('[OC-SEX] Kalibrierung aus '+_calibN+' Labels: calibA='+_calibA+' calibB='+_calibB+' (Peaks: '+_sessionPeaks.join(',')+')');
                            }
                        }
                    } catch(_calE) { this.log.debug('[OC-SEX] Kalibrierung Fehler: '+_calE.message); }
                    // 2. Manuell (sexCalibThreshold) - nur wenn keine Labels
                    if (_calibSrc === 'default' && this.config.sexCalibThreshold && Number(this.config.sexCalibThreshold) > 0) {
                        _calibB = Number(this.config.sexCalibThreshold);
                        _calibA = Math.round(_calibB * 1.3);
                        _calibSrc = 'manual';
                    }
                    // 3. Anomalie-Baseline (relativ zur Nacht-Vibration) - wenn noch kein Wert
                    if (_calibSrc === 'default') {
                        var _bsVals = sleepSearchEvents.filter(function(e){ return e.type==='vibration_strength'&&(e.isVibrationBed||e.isFP2Bed)&&((e.timestamp||0)>=_sexDayStart); }).map(function(e){ return Number(e.value)||0; }).filter(function(v){ return v>0; });
                        if (_bsVals.length >= 10) {
                            _bsVals.sort(function(a,b){return a-b;});
                            var _bsP75 = _bsVals[Math.floor(_bsVals.length*0.75)];
                            _calibA = Math.max(5, Math.round(_bsP75 * 2.5));
                            _calibB = Math.max(3, Math.round(_bsP75 * 1.5));
                            _calibSrc = 'baseline';
                            this.log.debug('[OC-SEX] Anomalie-Baseline: P75='+_bsP75+' calibA='+_calibA+' calibB='+_calibB);
                        }
                    }
                    // calibInfo fuer Snapshot
                    var _calibInfo = { src: _calibSrc, n: _calibN, calibA: _calibA, calibB: _calibB };
                    // --- ENDE KALIBRIERUNG ---
                    // Alle Vibrations-Events ab Mitternacht des aktuellen Tages (Kalender-Tag-Logik)
                    var _sexDayStart = new Date(dateStr + 'T00:00:00').getTime();
                    var _intimEvts = sleepSearchEvents.filter(function(e) {
                        return (e.type==='vibration_strength'||e.type==='vibration_trigger')
                            && (e.isVibrationBed||e.isFP2Bed||(!e.isFP2Bed&&!e.isBedroomMotion))
                            && (e.timestamp||0) >= _sexDayStart;
                    }).sort(function(a,b){return (a.timestamp||0)-(b.timestamp||0);});
                    var _intimVibStr  = _intimEvts.filter(function(e){return e.type==='vibration_strength';});
                    var _intimVibTrig = _intimEvts.filter(function(e){return e.type==='vibration_trigger';});
                    // 5-Min-Slot-Analyse: dynamisches Fenster von erstem bis letztem Event
                    var SLOT_MS = 5*60*1000;
                    var _intimSlots = [];
                    if (_intimEvts.length >= 4) {
                        var _tFirst = _intimEvts[0].timestamp||0;
                        var _tLast  = (_intimEvts[_intimEvts.length-1].timestamp||0) + SLOT_MS;
                        for (var _iS=_tFirst; _iS<_tLast; _iS+=SLOT_MS) {
                            var _iE=_iS+SLOT_MS;
                            var _str=_intimVibStr.filter(function(e){return (e.timestamp||0)>=_iS&&(e.timestamp||0)<_iE;});
                            var _trig=_intimVibTrig.filter(function(e){return (e.timestamp||0)>=_iS&&(e.timestamp||0)<_iE;});
                            var _strVals=_str.map(function(e){return Number(e.value)||0;});
                            var _strMax=_strVals.length>0?Math.max.apply(null,_strVals):0;
                            var _strAvg=_strVals.length>0?Math.round(_strVals.reduce(function(a,b){return a+b;},0)/_strVals.length):0;
                            _intimSlots.push({start:_iS,end:_iE,strCnt:_str.length,trigCnt:_trig.length,strMax:_strMax,strAvg:_strAvg});
                        }
                    }
                    // ZWEISTUFIGE KANDIDATEN-ERKENNUNG (5-Min-Slots):
                    // Pfad A (kurz+intensiv / Quickie): Peak >= calibA, >= 2 konsekutive Slots (>= 10 min)
                    // Pfad B (laenger+moderat): Peak >= calibB, >= 6 Slots (>= 30 min), max 24 Slots (120 min)
                    var _iCand=[];
                    var _iRunA=[];
                    _intimSlots.forEach(function(sl,i){
                        var _a=(sl.trigCnt>=2||sl.strCnt>=1)&&sl.strMax>=_calibA;
                        if(_a){_iRunA.push(i);}
                        else{if(_iRunA.length>=2)_iCand.push({run:_iRunA.slice(),tier:'A'}); _iRunA=[];}
                    });
                    if(_iRunA.length>=2)_iCand.push({run:_iRunA.slice(),tier:'A'});
                    var _iCoveredA=new Set();
                    _iCand.forEach(function(c){c.run.forEach(function(i){_iCoveredA.add(i);});});
                    var _iRunB=[];
                    _intimSlots.forEach(function(sl,i){
                        if(_iCoveredA.has(i)){if(_iRunB.length>=6&&_iRunB.length<=24)_iCand.push({run:_iRunB.slice(),tier:'B'}); _iRunB=[]; return;}
                        var _b=(sl.trigCnt>=1||sl.strCnt>=1)&&sl.strMax>=_calibB;
                        if(_b){_iRunB.push(i);}
                        else{if(_iRunB.length>=6&&_iRunB.length<=24)_iCand.push({run:_iRunB.slice(),tier:'B'}); _iRunB=[];}
                    });
                    if(_iRunB.length>=6&&_iRunB.length<=24)_iCand.push({run:_iRunB.slice(),tier:'B'});
                    // Garmin HR laden (optional)
                    var _garminHRVals = [];
                    if (this.config.sexGarminHRStateId) {
                        try {
                            var _hrState = await this.getForeignStateAsync((this.config.sexGarminHRStateId||'').trim());
                            if (_hrState && _hrState.val) {
                                var _hrParsed = typeof _hrState.val==='string' ? JSON.parse(_hrState.val) : _hrState.val;
                                if (Array.isArray(_hrParsed)) _garminHRVals = _hrParsed;
                            }
                        } catch(_hrE){ this.log.debug('[OC-SEX] Garmin HR nicht lesbar: '+_hrE.message); }
                    }
                    _iCand.forEach(function(cObj){
                        var run=cObj.run||cObj;
                        var _sl0=_intimSlots[run[0]], _slN=_intimSlots[run[run.length-1]];
                        var _evtStart=_sl0.start, _evtEnd=_slN.end;
                        var _durMin=Math.round(run.length*5); // 5-Min-Slots
                        var _runSlots=run.map(function(i){return _intimSlots[i];});
                        var _peakMax=Math.max.apply(null,_runSlots.map(function(s){return s.strMax;}));
                        var _avgAvg=Math.round(_runSlots.reduce(function(a,s){return a+s.strAvg;},0)/_runSlots.length);
                        var _avgTrig=Math.round(_runSlots.reduce(function(a,s){return a+s.trigCnt;},0)/_runSlots.length);
                        var _sStr=Math.min(100,Math.round((_peakMax/120)*100));
                        var _sDens=Math.min(100,Math.round((_avgTrig/10)*100));
                        var _sDur=Math.min(100,Math.round((_durMin/60)*100)); // normiert auf 60 Min
                        var _score=Math.round(_sStr*0.5+_sDens*0.3+_sDur*0.2);
                        // Stufe 1: Schwellen relativ zu calibA (statt fest 80/55)
                        var _vagThresh=Math.round(_calibA*1.5);
                        var _highSlots=_runSlots.filter(function(s){return s.strMax>=_vagThresh&&s.strCnt>=2;});
                        var _type=cObj.tier==='B'?'oral_hand':(_highSlots.length>=1?'vaginal':(_peakMax>=_calibA?'oral_hand':'intim'));
                        var _hrMax=null, _hrAvg=null;
                        if(_garminHRVals.length>0){
                            var _hrInWin=_garminHRVals.filter(function(h){
                                var _t=h.startGMT?new Date(h.startGMT).getTime():(h.timestamp||0);
                                return _t>=_evtStart-5*60000&&_t<=_evtEnd+5*60000;
                            });
                            if(_hrInWin.length>0){
                                var _hrVs=_hrInWin.map(function(h){return Number(h.value||h.heartRate||0);}).filter(function(v){return v>0;});
                                if(_hrVs.length>0){
                                    _hrMax=Math.max.apply(null,_hrVs);
                                    _hrAvg=Math.round(_hrVs.reduce(function(a,b){return a+b;},0)/_hrVs.length);
                                    if(_hrMax>100) _score=Math.min(100,_score+(_type==='vaginal'?15:10));
                                }
                            }
                        }
                        intimacyEvents.push({start:_evtStart,end:_evtEnd,duration:_durMin,score:_score,type:_type,peakStrength:_peakMax,avgStrength:_avgAvg,avgTrigger:_avgTrig,garminHRMax:_hrMax,garminHRAvg:_hrAvg,slots:_runSlots.map(function(s){return{start:s.start,strMax:s.strMax,strAvg:s.strAvg,trigCnt:s.trigCnt};})});
                    });
                    // Gap-Toleranz-Merge: Sessions mit Abstand <30 Min zu einer zusammenfassen
                    var _gapMs = 30 * 60 * 1000;
                    intimacyEvents.sort(function(a,b){return a.start-b.start;});
                    var _gMerged = [];
                    for (var _gmi = 0; _gmi < intimacyEvents.length; _gmi++) {
                        var _gCur = intimacyEvents[_gmi];
                        if (_gMerged.length === 0 || _gCur.start - _gMerged[_gMerged.length-1].end > _gapMs) {
                            _gMerged.push(Object.assign({}, _gCur, {slots: (_gCur.slots||[]).slice()}));
                        } else {
                            var _gPrev = _gMerged[_gMerged.length-1];
                            var _gRank = {'vaginal':3,'oral_hand':2,'intim':1};
                            if ((_gRank[_gCur.type]||0) > (_gRank[_gPrev.type]||0)) _gPrev.type = _gCur.type;
                            _gPrev.end = Math.max(_gPrev.end, _gCur.end);
                            _gPrev.duration = Math.round((_gPrev.end - _gPrev.start) / 60000);
                            _gPrev.peakStrength = Math.max(_gPrev.peakStrength, _gCur.peakStrength);
                            _gPrev.avgStrength = Math.round((_gPrev.avgStrength + _gCur.avgStrength) / 2);
                            _gPrev.avgTrigger = Math.round((_gPrev.avgTrigger + _gCur.avgTrigger) / 2);
                            _gPrev.score = Math.round((_gPrev.score + _gCur.score) / 2);
                            _gPrev.slots = (_gPrev.slots||[]).concat(_gCur.slots||[]);
                            if (_gCur.garminHRMax != null) _gPrev.garminHRMax = (_gPrev.garminHRMax != null) ? Math.max(_gPrev.garminHRMax, _gCur.garminHRMax) : _gCur.garminHRMax;
                            if (_gCur.garminHRAvg != null) _gPrev.garminHRAvg = (_gPrev.garminHRAvg != null) ? Math.round((_gPrev.garminHRAvg + _gCur.garminHRAvg)/2) : _gCur.garminHRAvg;
                        }
                    }
                    if (_gMerged.length < intimacyEvents.length) { this.log.info('[OC-SEX] Gap-Merge(daily): ' + intimacyEvents.length + ' ? ' + _gMerged.length + ' Session(s)'); intimacyEvents = _gMerged; }
                    // Kontext-Sensor-IDs (sensorFunction-basiert)
                    var _ctxBedIds  = new Set((this.config.devices||[]).filter(function(d){return d.sensorFunction==='bed';}).map(function(d){return d.id;}));
                var _ctxBedRoom = (this.config.devices||[]).filter(function(d){return d.sensorFunction==='bed';}).map(function(d){return d.location;}).filter(Boolean)[0] || null;
                    var _ctxBathIds = new Set((this.config.devices||[]).filter(function(d){return d.sensorFunction==='bathroom'||d.isBathroomSensor;}).map(function(d){return d.id;}));
                    // Topologie BFS: Raeume mit Hop<=2 vom Schlafzimmer
                    var _nearbyRooms = new Set();
                    try {
                        var _topoSt = await this.getStateAsync('analysis.topology.structure');
                        if (_topoSt && _topoSt.val) {
                            var _topoObj = JSON.parse(_topoSt.val);
                            var _topoRms = _topoObj.rooms||[], _topoMat = _topoObj.matrix||[];
                            var _bedRms = new Set((this.config.devices||[]).filter(function(d){return d.sensorFunction==='bed';}).map(function(d){return d.location;}).filter(Boolean));
                            _bedRms.forEach(function(bedRoom) {
                                var _bi=_topoRms.indexOf(bedRoom); if(_bi===-1) return;
                                var _dist=new Array(_topoRms.length).fill(Infinity); _dist[_bi]=0;
                                var _q=[_bi];
                                while(_q.length>0){var _c=_q.shift();if(_dist[_c]>=1)continue;for(var _j=0;_j<_topoRms.length;_j++){if(_topoMat[_c]&&_topoMat[_c][_j]===1&&_dist[_j]===Infinity){_dist[_j]=_dist[_c]+1;_q.push(_j);}}}
                                _topoRms.forEach(function(rm,idx){if(_dist[idx]===1)_nearbyRooms.add(rm);});
                            });
                        }
                    } catch(_topoE){ /* ignorieren */ }
                    var _nearbyRoomSensorIds = (this.config.devices||[]).filter(function(d){return d.type==='motion'&&!d.isBathroomSensor&&d.sensorFunction!=='bed'&&_nearbyRooms.has(d.location);}).map(function(d){return d.id;});
                var _nearbyRoomSensorIds = (this.config.devices||[]).filter(function(d){return d.type==='motion'&&!d.isBathroomSensor&&d.sensorFunction!=='bed'&&_nearbyRooms.has(d.location);}).map(function(d){return d.id;});
                var _extractCtx = function(session, evts) {
                        var _wS=session.start-15*60000, _wE=session.end+30*60000;
                        var _wEvts=evts.filter(function(e){var t=e.timestamp||0;return t>=_wS&&t<=_wE;});
                        var _hrD=new Date(session.start);
                        var _hF=_hrD.getHours()+_hrD.getMinutes()/60;
                        var _hSin=Math.round(Math.sin(2*Math.PI*_hF/24)*1000)/1000;
                        var _hCos=Math.round(Math.cos(2*Math.PI*_hF/24)*1000)/1000;
                        var _lEvts=_wEvts.filter(function(e){return (e.type==='light'||e.type==='dimmer')&&(_ctxBedRoom?e.location===_ctxBedRoom:_ctxBedIds.has(e.id));});
                        var _lightOn=_lEvts.length>0?(Number(_lEvts[_lEvts.length-1].value)>0?1:0):null;
                        var _pEvts=_wEvts.filter(function(e){return e.isFP2Bed;});
                        var _presOn=_pEvts.length>0?(Number(_pEvts[_pEvts.length-1].value)>0?1:0):null;
                        var _tEvts=_wEvts.filter(function(e){return (e.type==='temperature'||e.type==='thermostat'||e.type==='heating_valve')&&(_ctxBedRoom?e.location===_ctxBedRoom:_ctxBedIds.has(e.id));});
                        var _roomTemp=_tEvts.length>0?(Number(_tEvts[_tEvts.length-1].value)||null):null;
                        var _bathB=evts.some(function(e){var t=e.timestamp||0;return (e.isBathroomSensor||_ctxBathIds.has(e.id))&&e.type==='motion'&&t>=session.start-60*60000&&t<session.start;})?1:0;
                        var _bathA=evts.some(function(e){var t=e.timestamp||0;return (e.isBathroomSensor||_ctxBathIds.has(e.id))&&e.type==='motion'&&t>session.end&&t<=session.end+60*60000;})?1:0;
                        // nearbyRoomMotion: Bewegung in Hop<=2 Raeumen waehrend Session
                        var _nrM=_nearbyRooms.size>0?evts.some(function(e){var t=e.timestamp||0;return e.type==='motion'&&_nearbyRooms.has(e.location)&&t>=session.start-5*60000&&t<=session.end+5*60000;})?1:0:null;
                        return {hourSin:_hSin,hourCos:_hCos,lightOn:_lightOn,presenceOn:_presOn,roomTemp:_roomTemp,bathBefore:_bathB,bathAfter:_bathA,nearbyRoomMotion:_nrM};
                    };
                    // Stufe 3: Python-Klassifikator (wenn genug Trainings-Daten vorhanden)
                    var _pyClassInfo = null;
                    var _sexTD = (typeof _sexTrainData !== 'undefined') ? _sexTrainData : [];
                    if (_sexTD.length >= 3) { // Python auch bei 0 Events (Stufe-3-Status aktuell halten, Modell trainieren)
                        try {
                            var _pyPredSess = intimacyEvents.map(function(e) {
                                var _sl = e.slots || [];
                                var _strs = _sl.map(function(s){return s.strMax||0;});
                                var _avg2 = _strs.length>0 ? _strs.reduce(function(a,b){return a+b;},0)/_strs.length : 0;
                                var _var2 = _strs.length>0 ? _strs.reduce(function(a,b){return a+(b-_avg2)*(b-_avg2);},0)/_strs.length : 0;
                                var _ctx2 = _extractCtx(e, sleepSearchEvents);
                                return Object.assign({ peak: e.peakStrength, durSlots: _sl.length, avgPeak: Math.round(_avg2), variance: Math.round(_var2), tierB: (e.tier==='B'?1:0) }, _ctx2);
                            });
                            var _pyRes = await new Promise(function(resolve, reject) {
                                var _pyTout = setTimeout(function(){ reject(new Error('timeout')); }, 15000);
                                pythonBridge.send(this, 'CLASSIFY_SEX_SESSIONS',
                                    { train: _sexTD, predict: _pyPredSess },
                                    function(r){ clearTimeout(_pyTout); resolve(r); });
                            }.bind(this));
                            if (_pyRes && _pyRes.payload) {
                                _pyClassInfo = _pyRes.payload;
                                if (_pyClassInfo.trained && Array.isArray(_pyClassInfo.results)) {
                                    _pyClassInfo.results.forEach(function(r, i) {
                                        if (!intimacyEvents[i]) return;
                                        if (r.type === 'nullnummer' && r.confidence >= 0.60) {
                                            this.log.info('[OC-SEX-PY] Session '+i+' als Nullnummer klassifiziert � wird entfernt');
                                            intimacyEvents[i] = null;
                                        } else if (r.type && r.type !== 'nullnummer' && r.confidence >= 0.55) {
                                            intimacyEvents[i].type = r.type;
                                            intimacyEvents[i].pyConf = Math.round(r.confidence * 100);
                                        }
                                    }.bind(this));
                                    intimacyEvents = intimacyEvents.filter(function(e){ return e !== null; });
                                }
                            }
                        } catch(_pyE) { this.log.debug('[OC-SEX-PY] '+_pyE.message); }
                    }
                    _calibInfo.pyClassifier = _pyClassInfo ? { trained: _pyClassInfo.trained||false, n: _pyClassInfo.n_samples||0, counts: _pyClassInfo.class_counts||{}, msg: _pyClassInfo.status_msg||'', feature_importances: _pyClassInfo.feature_importances||[], loo_accuracy: (_pyClassInfo.loo_accuracy!=null?_pyClassInfo.loo_accuracy:null), confusion_matrix: (_pyClassInfo.confusion_matrix||null), loo_details: (_pyClassInfo.loo_details||[]), nearbyRoomSensorIds: _nearbyRoomSensorIds } : null;
                    // Fallback: bestehende pyClassifier-Info erhalten wenn Python nicht verfuegbar war (Adapter-Neustart-Schutz)
                    if (!_calibInfo.pyClassifier) { try { var _pyFbPath=path.join(utils.getAbsoluteDefaultDataDir(),'cogni-living','history',dateStr+'.json'); if(fs.existsSync(_pyFbPath)){var _pyFbJ=JSON.parse(fs.readFileSync(_pyFbPath,'utf8'));if(_pyFbJ.sexCalibInfo&&_pyFbJ.sexCalibInfo.pyClassifier&&_pyFbJ.sexCalibInfo.pyClassifier.trained){_calibInfo.pyClassifier=_pyFbJ.sexCalibInfo.pyClassifier;this.log.debug('[OC-SEX] pyClassifier aus JSON erhalten (Neustart-Schutz, trained='+_calibInfo.pyClassifier.trained+')');}} } catch(_pyFbE){this.log.debug('[OC-SEX] pyClassifier-Fallback: '+_pyFbE.message);} }
                    if(intimacyEvents.length>0){
                        this.log.info('[OC-SEX] '+intimacyEvents.length+' Event(s) erkannt. calibA='+_calibA+' calibB='+_calibB+' Scores: '+intimacyEvents.map(function(e){return e.score+'('+e.type+')';}).join(', '));
                    } else {
                        this.log.debug('[OC-SEX] daily: 0 Events (calibA='+_calibA+', calibB='+_calibB+', '+_intimEvts.length+' Vib-Events gesamt)');
                    }
                } catch(_intimErr) {
                    this.log.warn('[OC-SEX] Fehler bei Intimacy-Detection: '+_intimErr.message);
                }
            }
            // OC-SEX Dedup: Verhindert dass Events vom Vorabend (sleepSearch ab 18:00 gestern)
            // doppelt in heute UND gestern gespeichert werden. Wenn ein erkanntes Event
            // bereits in der gestrigen JSON-Datei steht, wird es aus dem heutigen Snapshot gefiltern.
            try {
                var _ddPrev = new Date(); _ddPrev.setDate(_ddPrev.getDate() - 1);
                var _ddPrevStr = _ddPrev.getFullYear() + '-' + String(_ddPrev.getMonth()+1).padStart(2,'0') + '-' + String(_ddPrev.getDate()).padStart(2,'0');
                var _ddPrevPath = path.join(utils.getAbsoluteDefaultDataDir(), 'cogni-living', 'history', _ddPrevStr + '.json');
                if (fs.existsSync(_ddPrevPath) && intimacyEvents.length > 0) {
                    var _ddPrevSnap = JSON.parse(fs.readFileSync(_ddPrevPath, 'utf8'));
                    var _ddPrevStarts = new Set((_ddPrevSnap.intimacyEvents || []).map(function(e) { return e.start; }));
                    var _ddBefore = intimacyEvents.length;
                    intimacyEvents = intimacyEvents.filter(function(e) { return !_ddPrevStarts.has(e.start); });
                    if (intimacyEvents.length < _ddBefore) {
                        this.log.info('[OC-SEX] Dedup: ' + (_ddBefore - intimacyEvents.length) + ' doppeltes Event(s) aus ' + _ddPrevStr + '.json gefiltert (Event gehoert zum Vortag)');
                    }
                }
            } catch(_ddE) { this.log.debug('[OC-SEX] Dedup-Fehler: ' + _ddE.message); }

            // Nullnummer-Session-Filter: Entfernt Sessions die per Label als Fehlalarm markiert wurden
            try {
                var _nnLabels=[];
                try{var _nnRaw=JSON.parse(this.config.sexTrainingLabels||'[]');if(Array.isArray(_nnRaw))_nnLabels=_nnRaw.filter(function(l){return l&&l.date===dateStr&&l.type==='nullnummer'&&l.time;});}catch(_nnPE){}
                if (_nnLabels.length>0&&intimacyEvents.length>0){
                    var _nnBefore=intimacyEvents.length;
                    intimacyEvents=intimacyEvents.filter(function(e){
                        return !_nnLabels.some(function(nl){
                            var _nlP=nl.time.split(':').map(Number);
                            var _nlMs=new Date(dateStr+'T00:00:00').setHours(_nlP[0],_nlP[1],0,0);
                            return Math.abs((e.start||0)-_nlMs)<30*60000;
                        });
                    });
                    if(intimacyEvents.length<_nnBefore)this.log.info('[OC-SEX] Nullnummer-Filter(daily): '+(_nnBefore-intimacyEvents.length)+' Session(s) entfernt, '+intimacyEvents.length+' behalten');
                }
            } catch(_nnE){this.log.debug('[OC-SEX] Nullnummer-Filter: '+_nnE.message);}

                        const snapshot = {
                date: dateStr,
                timestamp: Date.now(),
                roomHistory: roomHistoryData,
                todayRoomMinutes: todayRoomMinutes,   // { 'EG Bad': 25, ... }
                geminiNight: geminiNight?.val || null,
                geminiDay: geminiDay?.val || null,
                anomalyScore: anomalyScore?.val !== undefined && anomalyScore?.val !== null
                    ? Number(anomalyScore.val) : null,
                todayVector: (() => {
                    // Prim?r: aus analysis.health.todayVector State (rawEventLog-basiert)
                    // Fallback: direkt aus eventHistory des heutigen Tages berechnen
                    let vec = todayVector?.val ? JSON.parse(todayVector.val) : null;
                    const vecIsEmpty = !vec || vec.every(v => v === 0);
                    if (vecIsEmpty && todayEvents.length > 0) {
                        // Fallback: Vector aus heutigen Events berechnen
                        vec = new Array(48).fill(0);
                        const dayStart = new Date().setHours(0,0,0,0);
                        todayEvents.forEach(e => {
                            const ts = e.timestamp || e.ts || 0;
                            if (ts >= dayStart) {
                                const d = new Date(ts);
                                const slot = d.getHours() * 2 + Math.floor(d.getMinutes() / 30);
                                if (slot >= 0 && slot < 48) vec[slot]++;
                            }
                        });
                    }
                    return vec || new Array(48).fill(0);
                })(),
                batteryLevel: battery,
                freshAirCount: freshAirCount,
                freshAirLongCount: freshAirLongCount,
                windowOpenings: freshAirCount,
                gaitSpeed: (() => {
                    // Berechne heutige Gait-Speed direkt aus Sequenzen (kein async noetig)
                    try {
                        const seqState = this._lastSeqState; // wird unten gesetzt
                        if (!seqState) return null;
                        const allSeqs = JSON.parse(seqState);
                        const todayStr = dateStr; // bereits oben definiert
                        const todaySeqs = allSeqs.filter(s => (s.timestamp || '').startsWith(todayStr));
                        if (todaySeqs.length < 1) return null;

                        const allHallwayDevs = (this.config.devices || []).filter(d => d.isHallway || d.sensorFunction === 'hallway');
                        // Prim+?rflur-Logik: wenn mind. ein Sensor als Prim+?rflur markiert, nur diesen verwenden
                        const primaryHallwayDevs = allHallwayDevs.filter(d => d.isPrimaryHallway);
                        const activeHallwayDevs = primaryHallwayDevs.length > 0 ? primaryHallwayDevs : allHallwayDevs;
                        const hallwayConf = activeHallwayDevs.map(d => d.location || d.name || '');
                        const hallwayKw = ['flur', 'diele', 'gang', 'korridor'];
                        // Keyword-Fallback nur wenn kein Flur konfiguriert (Sensorliste ist Master)
                        const isHallway = (loc) => hallwayConf.includes(loc) || (hallwayConf.length === 0 && hallwayKw.some(k => (loc || '').toLowerCase().includes(k)));

                        const transits = [];
                        for (const seq of todaySeqs) {
                            const steps = seq.steps || [];
                            if (steps.length < 3) continue;
                            for (let i = 1; i < steps.length - 1; i++) {
                                if (!isHallway(steps[i].loc)) continue;
                                if (isHallway(steps[i-1].loc) || isHallway(steps[i+1].loc)) continue;
                                const transit = (steps[i+1].t_delta || 0) - (steps[i].t_delta || 0);
                                if (transit >= 1 && transit <= 20) transits.push(transit);
                            }
                        }
                        if (transits.length < 2) return null;
                        transits.sort((a, b) => a - b);
                        const median = transits[Math.floor(transits.length / 2)];
                        return Math.round(median * 10) / 10;
                    } catch(e) { return null; }
                })(),
                eventHistory: todayEvents,
                nocturiaCount: nocturiaCount,
                kitchenVisits: kitchenVisits,
                sleepWindowStart: sleepWindowOC7.start,   // ms-Timestamp Schlafbeginn (OC7-Fenster inkl. Vib-Fallback)
                sleepWindowEnd:   sleepWindowOC7.end,     // ms-Timestamp Aufwachen
                maxPersonsDetected: maxPersonsDetected,
                bedPresenceMinutes: bedPresenceMinutes,
                nightVibrationCount: nightVibrationCount,
                nightVibrationStrengthAvg: nightVibrationStrengthAvg,
                nightVibrationStrengthMax: nightVibrationStrengthMax,
                personData: personData,
                sleepScore: sleepScore,
                sleepScoreRaw: sleepScoreRaw,
                sleepScoreCal: sleepScoreCal,
                sleepScoreCalNights: sleepScoreCalNights,
                sleepScoreCalStatus: sleepScoreCalStatus,
                sleepStages: sleepStages,
                stagesWindowStart: _sleepFrozen
                    ? (_existingSnap.stagesWindowStart ?? _existingSnap.sleepWindowStart ?? null)
                    : (sleepWindowOC7.start ?? null),
                garminScore: garminScore,
                garminDeepMin: garminDeepSec ? Math.round(garminDeepSec/60) : null,
                garminLightMin: garminLightSec ? Math.round(garminLightSec/60) : null,
                garminRemMin: garminRemSec ? Math.round(garminRemSec/60) : null,
                sleepWindowSource: sleepWindowSource,
                outsideBedEvents: outsideBedEvents,
                intimacyEvents: intimacyEvents,
                sexCalibInfo: _calibInfo,
                wakeSource: wakeSource,
                wakeConf: wakeConf,
                allWakeSources: allWakeSources,
                sleepStartSource: sleepStartSource,
                allSleepStartSources: allSleepStartSources,
                wakeConfirmed: !!(sleepWindowOC7.end && new Date().getHours() >= 10 && (Date.now() - (sleepWindowOC7.end || 0)) >= 3600000),
                sleepDate: sleepDate,
                sleepStartOverridden: _overrideApplied,
                sleepStartOverrideSource: _overrideApplied ? sleepStartSource : null,
                wakeOverridden: _wakeOverrideApplied,
                bedWasEmpty: bedWasEmpty
            };

            const dataDir = utils.getAbsoluteDefaultDataDir();
            const historyDir = path.join(dataDir, 'cogni-living', 'history');
            if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });

            const filePath = path.join(historyDir, `${dateStr}.json`);
            fs.writeFileSync(filePath, JSON.stringify(snapshot));
            this.log.info(`? History saved: ${filePath}`);

            // Kalibrier-Log: Sensorquellen gegen Garmin (fuer spaetere Auswertung ohne Smartwatch)
            try {
                const absDeltaMin = (candidateTs, refTs) => {
                    if (!candidateTs || !refTs) return null;
                    return Math.abs(Math.round((candidateTs - refTs) / 60000));
                };
                const calibrationEntry = {
                    date: dateStr,
                    ts: Date.now(),
                    chosen: { sleepStartSource: sleepStartSource || null, wakeSource: wakeSource || null, wakeConf: wakeConf || null },
                    references: { garminSleepStartTs: garminSleepStartTs || null, garminWakeTs: garminWakeTs || null },
                    candidatesStart: { garmin: garminSleepStartTs || null, fp2_vib: vibRefinedSleepStartTs || null, fp2: _fp2RawStart || null, motion: sleepWindowMotion.start || null, fixed: _fixedSleepStartTs || null },
                    candidatesWake: { garmin: garminWakeTs || null, fp2_vib: fp2VibWakeTs || null, fp2_other: fp2OtherWakeTs || null, fp2: fp2WakeTs || null, other: otherRoomWakeTs || null, motion: (sleepWindowSource === 'motion') ? fp2WakeTs : null, vibration_alone: vibAloneWakeTs || null, vibration: vibWakeTs || null, fixed: (sleepWindowSource === 'fixed') ? fp2WakeTs : null },
                    absDeltaToGarminMin: {
                        sleepStart: { fp2_vib: absDeltaMin(vibRefinedSleepStartTs, garminSleepStartTs), fp2: absDeltaMin(_fp2RawStart, garminSleepStartTs), motion: absDeltaMin(sleepWindowMotion.start, garminSleepStartTs), fixed: absDeltaMin(_fixedSleepStartTs, garminSleepStartTs) },
                        wake: { fp2_vib: absDeltaMin(fp2VibWakeTs, garminWakeTs), fp2_other: absDeltaMin(fp2OtherWakeTs, garminWakeTs), fp2: absDeltaMin(fp2WakeTs, garminWakeTs), other: absDeltaMin(otherRoomWakeTs, garminWakeTs), vibration_alone: absDeltaMin(vibAloneWakeTs, garminWakeTs), vibration: absDeltaMin(vibWakeTs, garminWakeTs) }
                    }
                };
                let calibrationLog = [];
                const calState = await this.getStateAsync('analysis.health.sleepCalibrationLog');
                if (calState && calState.val) {
                    try { calibrationLog = JSON.parse(calState.val); if (!Array.isArray(calibrationLog)) calibrationLog = []; } catch(_) { calibrationLog = []; }
                }
                calibrationLog.push(calibrationEntry);
                if (calibrationLog.length > 120) calibrationLog = calibrationLog.slice(calibrationLog.length - 120);
                await this.setStateAsync('analysis.health.sleepCalibrationLog', { val: JSON.stringify(calibrationLog), ack: true });
            } catch (calErr) {
                this.log.warn('[SleepCalibration] Log konnte nicht gespeichert werden: ' + calErr.message);
            }

            // N?chtliche Drift-Pr?fung (nach dem Speichern)
            this._checkDriftAlarm(historyDir).catch(e => this.log.warn(`[Drift] Alarm-Check Fehler: ${e.message}`));

        } catch(e) { this.log.error(`History Save Error: ${e.message}`); }
    }

    async _checkDriftAlarm(historyDir) {
        const setup = require('./lib/setup');
        const COOLDOWN_DAYS = 14;
        const MIN_DAYS      = 10;

        // Cooldown pr?fen
        try {
            const lastAlarm = await this.getStateAsync('analysis.drift.lastAlarmDate').catch(() => null);
            if (lastAlarm && lastAlarm.val) {
                const daysSince = (Date.now() - new Date(lastAlarm.val).getTime()) / 86400000;
                if (daysSince < COOLDOWN_DAYS) {
                    this.log.debug(`[Drift] Cooldown aktiv (${daysSince.toFixed(0)} von ${COOLDOWN_DAYS} Tagen)`);
                    return;
                }
            }
        } catch(e) {}

        // Letzte 60 Tage laden
        const days = [];
        for (let i = 1; i <= 60; i++) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const ds = d.toISOString().slice(0, 10);
            const fp = path.join(historyDir, `${ds}.json`);
            if (fs.existsSync(fp)) {
                try {
                    const h = JSON.parse(fs.readFileSync(fp, 'utf8'));
                    const vec = h.todayVector || [];
                    const act = vec.reduce((a, b) => a + b, 0);
                    const gs  = (h.gaitSpeed > 0 && h.gaitSpeed < 60) ? h.gaitSpeed : 0;
                    const nt  = h.nightMotionCount !== undefined ? h.nightMotionCount
                                : Array.isArray(h.eventHistory)
                                    ? h.eventHistory.filter(e => { const hr = new Date(e.timestamp||e.ts||0).getHours(); return hr>=22||hr<6; }).length
                                    : 0;
                    days.push({ date: ds, act, gs, nt });
                } catch(e) {}
            }
        }
        days.sort((a, b) => a.date.localeCompare(b.date));
        if (days.length < MIN_DAYS) { this.log.debug(`[Drift] Zu wenig Daten (${days.length})`); return; }

        // Mediane als Normalisierung
        const median = arr => { const s=[...arr].sort((a,b)=>a-b); return s[Math.floor(s.length/2)]||1; };
        const actVals = days.map(d=>d.act).filter(v=>v>0);
        const mAct = median(actVals)||1;
        const actNorm = days.map(d => d.act>0 ? Math.min(200, Math.round((d.act/mAct)*100)) : 0);

        // Page-Hinkley (einfach, JS-intern, keine Python n?tig)
        const ph = (vals, direction='up', k=0.5) => {
            const cal = Math.min(14, Math.max(7, Math.floor(vals.length/2)));
            const calVals = vals.slice(0, cal).filter(v=>v>0);
            if (calVals.length < 3) return { score: 0, threshold: 50, alarm: false };
            const mu  = calVals.reduce((a,b)=>a+b,0)/calVals.length;
            const std = Math.sqrt(calVals.reduce((a,b)=>a+(b-mu)**2,0)/calVals.length)||1;
            const th  = Math.max(30, 3*std*Math.sqrt(Math.max(1, vals.length-cal)));
            let M=0, m=0, score=0;
            for (let i=cal; i<vals.length; i++) {
                const x = direction==='down' ? -vals[i] : vals[i];
                const muD = direction==='down' ? -mu : mu;
                M = M + (x - muD - k*std);
                m = Math.min(m, M);
                score = Math.max(0, M - m);
            }
            return { score: Math.round(score*10)/10, threshold: Math.round(th*10)/10, alarm: score > th };
        };

        const actR   = ph(actNorm, 'down');
        const gaitR  = ph(days.map(d=>d.gs).filter(v=>v>0), 'up');
        const nightR = ph(days.map(d=>d.nt), 'up');

        this.log.debug(`[Drift] Scores ? Aktivit?t: ${actR.score}/${actR.threshold} | Gait: ${gaitR.score}/${gaitR.threshold} | Nacht: ${nightR.score}/${nightR.threshold}`);

        // Pushover nur wenn mindestens eine Metrik Alarm schl?gt
        const alarms = [];
        if (actR.alarm)   alarms.push(`?? Aktivit?t sinkt (Score ${actR.score}/${actR.threshold})`);
        if (gaitR.alarm)  alarms.push(`?? Ganggeschwindigkeit steigt (Score ${gaitR.score}/${gaitR.threshold})`);
        if (nightR.alarm) alarms.push(`?? Nacht-Unruhe nimmt zu (Score ${nightR.score}/${nightR.threshold})`);

        if (alarms.length > 0) {
            const msg = `?? DRIFT ERKANNT (${days.length} Tage Datenbasis)\n\n${alarms.join('\n')}\n\nBitte Admin-UI ? Drift-Monitor f?r Details ?ffnen.`;
            setup.sendNotification(this, msg, true, false, '?? NUUKANNI: Verhaltens-Drift');
            await this.setObjectNotExistsAsync('analysis.drift.lastAlarmDate', { type: 'state', common: { name: 'Letzter Drift-Alarm', type: 'string', role: 'text', read: true, write: false, def: '' }, native: {} });
            await this.setStateAsync('analysis.drift.lastAlarmDate', { val: new Date().toISOString(), ack: true });
            this.log.warn(`[Drift] ?? Alarm ausgel?st: ${alarms.join(' | ')}`);
        }
    }

    async integrateRoomTime() {
        if (!this.isPresent) return;
        try {
            let currentRoom = null;
            try {
                const trState = await this.getStateAsync('analysis.prediction.trackerTopRoom');
                const tpState = await this.getStateAsync('analysis.prediction.trackerConfidence');
                if (trState && trState.val && tpState && tpState.val && tpState.val > 0.3) {
                    if (trState.val !== 'Unknown' && trState.val !== 'Init...') currentRoom = trState.val;
                }
            } catch(e) {}

            if (!currentRoom) {
                const devices = this.config.devices || [];
                for (const dev of devices) {
                    if (dev.type === 'motion' && dev.location) {
                        try {
                            const s = await this.getForeignStateAsync(dev.id);
                            if (s && (s.val === true || s.val === 'on' || s.val === 1)) {
                                currentRoom = dev.location;
                                break;
                            }
                        } catch(e) {}
                    }
                }
            }

            if (!currentRoom) return;

            const devices = this.config.devices || [];
            let normalizedRoom = currentRoom;
            const match = devices.find(d => d.location && d.location.toLowerCase() === currentRoom.toLowerCase());
            if (match) normalizedRoom = match.location;

            const histId = 'analysis.activity.roomHistory';
            const histState = await this.getStateAsync(histId);
            const todayStr = new Date().toLocaleDateString();
            let histData = { history: {}, date: todayStr };

            if (histState && histState.val) { try { histData = JSON.parse(histState.val); } catch(e){} }

            if (histData.date !== todayStr) { histData.history = {}; histData.date = todayStr; }
            if (!histData.history[normalizedRoom]) histData.history[normalizedRoom] = new Array(24).fill(0);

            const currentHour = new Date().getHours();
            if (histData.history[normalizedRoom][currentHour] < 60) histData.history[normalizedRoom][currentHour]++;

            await this.setStateAsync(histId, { val: JSON.stringify(histData), ack: true });

        } catch(e) { this.log.warn(`[Integrator] Error: ${e.message}`); }
    }

    async onMessage(obj) {
        if (typeof obj === 'object' && obj.message) {
            if (obj.command === 'getHistoryData') {
                const requestedDate = obj.message.date;
                const dataDir = utils.getAbsoluteDefaultDataDir();
                const filePath = path.join(dataDir, 'cogni-living', 'history', `${requestedDate}.json`);
                if (fs.existsSync(filePath)) {
                    try {
                        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                        this.sendTo(obj.from, obj.command, { success: true, data: data }, obj.callback);
                    } catch(e) { this.sendTo(obj.from, obj.command, { success: false, error: "Corrupt" }, obj.callback); }
                } else { this.sendTo(obj.from, obj.command, { success: false, error: "No data" }, obj.callback); }
            }
            else if (obj.command === 'getOverviewData') {
                const digestCount = this.dailyDigests.length;

                let hourlyActivity = new Array(48).fill(0);
                let hourlyDetails = Array.from({ length: 48 }, () => []);
                try {
                    const vecState = await this.getStateAsync('analysis.health.todayVector');
                    if (vecState && vecState.val) hourlyActivity = JSON.parse(vecState.val);

                    const detState = await this.getStateAsync('analysis.health.todayRoomDetails');
                    if (detState && detState.val) hourlyDetails = JSON.parse(detState.val);
                } catch(e) {}

                // LOAD YESTERDAY'S DATA
                let yesterdayActivity = new Array(48).fill(0);
                try {
                    const y = new Date(); y.setDate(y.getDate() - 1);
                    const yStr = y.toISOString().split('T')[0];
                    const dataDir = utils.getAbsoluteDefaultDataDir();
                    const yPath = path.join(dataDir, 'cogni-living', 'history', `${yStr}.json`);
                    if (fs.existsSync(yPath)) {
                        const yData = JSON.parse(fs.readFileSync(yPath, 'utf8'));
                        if (yData && yData.todayVector) yesterdayActivity = yData.todayVector;
                    }
                } catch(e) { /* Ignore */ }

                let roomStats = { today: {}, yesterday: {} };
                try { const rs = await this.getStateAsync('analysis.activity.roomStats'); if (rs && rs.val) roomStats = JSON.parse(rs.val); } catch(e) {}

                // BATTERY FALLBACK
                let activityTrendVal = null;
                try { const at = await this.getStateAsync('analysis.health.activityTrend'); if(at) activityTrendVal = at.val; } catch(e){}

                if (activityTrendVal === undefined || activityTrendVal === null) {
                    const totalEvents = hourlyActivity.reduce((a, b) => a + b, 0);
                    const fallbackTrend = Math.min(2, Math.max(-2, (100 - totalEvents) / 50));
                    activityTrendVal = fallbackTrend;
                }

                let detected = false; let desc = ''; let tId = ''; let tVal = '';
                try {
                    const dState = await this.getStateAsync('analysis.automation.patternDetected');
                    if (dState && dState.val) {
                        detected = true;
                        const descS = await this.getStateAsync('analysis.automation.description'); desc = descS ? descS.val : '';
                        const tIdS = await this.getStateAsync('analysis.automation.targetId'); tId = tIdS ? tIdS.val : '';
                        const tValS = await this.getStateAsync('analysis.automation.targetValue'); tVal = tValS ? tValS.val : '';
                    }
                } catch(e){}

                const isSunny = await this.checkSolarCondition();
                const hasSolar = (this.config.devices || []).some(d => d.isSolar);
                const solarActive = isSunny && hasSolar;
                let presenceWho = ''; try { const pw = await this.getStateAsync('system.presenceWho'); if(pw && pw.val) presenceWho = pw.val; } catch(e){}

                this.sendTo(obj.from, obj.command, {
                    success: true,
                    eventHistory: this.eventHistory.slice(0, 2000),
                    stats: {
                        digestCount,
                        isPresent: this.isPresent,
                        hourlyActivity,
                        hourlyDetails,
                        yesterdayActivity,
                        solarActive,
                        presenceWho,
                        roomStats,
                        activityTrend: activityTrendVal,
                        modules: this.activeModules
                    },
                    automation: { detected, description: desc, targetId: tId, targetValue: tVal }
                }, obj.callback);
            }
            else if (obj.command === 'checkThermostats') { try { const results = await automation.scanThermostats(this); this.sendTo(obj.from, obj.command, { success: true, results }, obj.callback); } catch (e) { this.sendTo(obj.from, obj.command, { success: false, error: e.message }, obj.callback); } }
            else if (obj.command === 'scanDevices') { try { const results = await scanner.scanForDevices(this, obj.message || {}); this.sendTo(obj.from, obj.command, { success: true, devices: results }, obj.callback); } catch (e) {} }
            else if (obj.command === 'getEnums') {
                const functions = await this.getForeignObjectsAsync('enum.functions.*', 'enum');
                const list = [];
                if (functions) {
                    for (const id in functions) {
                        let n = functions[id].common.name;
                        if (n && typeof n === 'object') n = n.de || n.en || Object.values(n)[0] || JSON.stringify(n);
                        list.push({ id: id, name: String(n || id) });
                    }
                }
                const rooms = await this.getForeignObjectsAsync('enum.rooms.*', 'enum');
                const roomList = [];
                if (rooms) {
                    for (const id in rooms) {
                        let n = rooms[id].common.name;
                        if (n && typeof n === 'object') n = n.de || n.en || Object.values(n)[0] || JSON.stringify(n);
                        roomList.push(String(n || id.split('.').pop()));
                    }
                }
                this.sendTo(obj.from, obj.command, { success: true, enums: list, rooms: roomList }, obj.callback);
            }
            // --- FIX: ROBUST CALENDAR SEARCH & HANDLERS ---
            else if (obj.command === 'getCalendarNames') {
                try {
                    // Loop through ALL ical instances to find calendars, regardless of frontend default
                    const instances = await this.getObjectViewAsync('system', 'instance', { startkey: 'system.adapter.ical.', endkey: 'system.adapter.ical.\u9999' });
                    const names = new Set();

                    if (instances && instances.rows) {
                        for (const row of instances.rows) {
                            const instId = row.id.replace('system.adapter.', '');
                            const state = await this.getForeignStateAsync(`${instId}.data.table`);

                            let foundSpecific = false;
                            if (state && state.val) {
                                const table = typeof state.val === 'string' ? JSON.parse(state.val) : state.val;
                                if (Array.isArray(table)) {
                                    table.forEach(entry => {
                                        if(entry.calendarName) {
                                            names.add(entry.calendarName);
                                            foundSpecific = true;
                                        }
                                    });
                                }
                            }

                            // FALLBACK: If no specific "calendarName" found in events, use Instance ID
                            // This ensures we always find at least "ical.0" if it exists.
                            if (!foundSpecific) {
                                names.add(instId);
                            }
                        }
                    }

                    const finalNames = Array.from(names);
                    if (finalNames.length === 0) finalNames.push('Standard'); // Absolute fallback

                    this.sendTo(obj.from, obj.command, { success: true, names: finalNames }, obj.callback);
                } catch(e) {
                    this.sendTo(obj.from, obj.command, { success: false, error: "Scan Error: " + e.message }, obj.callback);
                }
            }
            else if (obj.command === 'refreshCalendar') {
                try {
                    await automation.updateSchedulePreview(this);
                    this.sendTo(obj.from, obj.command, { success: true }, obj.callback);
                } catch(e) {
                    this.log.warn(`refreshCalendar failed: ${e.message}`);
                    this.sendTo(obj.from, obj.command, { success: false, error: e.message }, obj.callback);
                }
            }
            else if (obj.command === 'updateTopologyMatrix') {
                try {
                    const newMatrix = obj.message.matrix;
                    if (!newMatrix || !Array.isArray(newMatrix)) {
                        throw new Error('Invalid matrix data');
                    }
                    
                    // Lade aktuelle Topologie
                    const state = await this.getStateAsync('analysis.topology.structure');
                    if (state && state.val) {
                        const topo = JSON.parse(state.val);
                        topo.matrix = newMatrix;
                        topo.updated = Date.now();
                        
                        // Speichere aktualisierte Matrix
                        await this.setStateAsync('analysis.topology.structure', { val: JSON.stringify(topo), ack: true });
                        
                        this.log.debug(`??? Topology Matrix manually updated by user.`);
                        this.sendTo(obj.from, obj.command, { success: true }, obj.callback);
                    } else {
                        throw new Error('No topology data found');
                    }
                } catch(e) {
                    this.log.warn(`updateTopologyMatrix failed: ${e.message}`);
                    this.sendTo(obj.from, obj.command, { success: false, error: e.message }, obj.callback);
                }
            }
            else if (obj.command === 'pythonBridge') {
                // Generic Python Bridge Handler - leitet alle Commands an Python weiter
                try {
                    const pythonCommand = obj.message.command;
                    const pythonData = obj.message;
                    
                    this.log.debug(`[PythonBridge] Forwarding command: ${pythonCommand}`);
                    
                    pythonBridge.send(this, pythonCommand, pythonData, (response) => {
                        // Callback wenn Python antwortet
                        this.sendTo(obj.from, obj.command, response, obj.callback);
                    });
                } catch(e) {
                    this.log.warn(`pythonBridge command failed: ${e.message}`);
                    this.sendTo(obj.from, obj.command, { type: 'ERROR', payload: e.message }, obj.callback);
                }
            }
            else if (obj.command === 'testApiKey') {
                try {
                    const testKey = obj.message ? obj.message.apiKey : '';
                    if (!testKey) throw new Error("Kein API Key ?bergeben.");

                    const testAI = new GoogleGenerativeAI(testKey);
                    const model = testAI.getGenerativeModel({ model: GEMINI_MODEL });
                    const result = await model.generateContent("Say Hello");
                    const response = await result.response;
                    const text = response.text();

                    this.sendTo(obj.from, obj.command, { success: true, message: "Verbindung erfolgreich: " + text.substring(0, 20) + "..." }, obj.callback);
                } catch(e) {
                    this.sendTo(obj.from, obj.command, { success: false, message: e.message }, obj.callback);
                }
            }
            else if (obj.command === 'testContext') {
                try {
                    const isSunny = await this.checkSolarCondition();
                    const instances = await this.getObjectViewAsync('system', 'instance', { startkey: 'system.adapter.ical.', endkey: 'system.adapter.ical.\u9999' });
                    const calCount = instances && instances.rows ? instances.rows.length : 0;

                    this.sendTo(obj.from, obj.command, {
                        success: true,
                        weather: `Sonne: ${isSunny}, Temp: ${this.sensorLastValues[this.config.outdoorSensorId] || '?'}?C`,
                        calendar: `${calCount} Kalender-Adapter gefunden.`
                    }, obj.callback);
                } catch(e) {
                    this.sendTo(obj.from, obj.command, { success: false }, obj.callback);
                }
            }
        else if (obj.command === 'setSleepStartOverride') {
            try {
                var _ovMsg = obj.message || {};
                var _allowedOvSrc = ['garmin','fp2_vib','fp2','motion_vib','last_outside','gap60','haus_still','motion','fixed'];
                if (!_ovMsg.date || !_ovMsg.source || !_ovMsg.ts || _allowedOvSrc.indexOf(_ovMsg.source) < 0) {
                    this.sendTo(obj.from, obj.command, { success: false, error: 'Ungueltige Override-Daten' }, obj.callback); return;
                }
                var _ovPayload = { date: _ovMsg.date, source: _ovMsg.source, ts: _ovMsg.ts, setBy: 'ui', setAt: Date.now() };
                await this.setStateAsync('analysis.sleep.startOverride', { val: JSON.stringify(_ovPayload), ack: true });
                await this.saveDailyHistory(_ovPayload);
                var _ovDataDir = utils.getAbsoluteDefaultDataDir();
                var _ovNow = new Date();
                var _ovDateStr = _ovNow.getFullYear() + '-' + String(_ovNow.getMonth()+1).padStart(2,'0') + '-' + String(_ovNow.getDate()).padStart(2,'0');
                var _ovPath = path.join(_ovDataDir, 'cogni-living', 'history', _ovDateStr + '.json');
                if (fs.existsSync(_ovPath)) {
                    var _ovSnap = JSON.parse(fs.readFileSync(_ovPath, 'utf8'));
                    this.sendTo(obj.from, obj.command, { success: true, data: _ovSnap }, obj.callback);
                } else { this.sendTo(obj.from, obj.command, { success: true, data: null }, obj.callback); }
            } catch(_ovE) { this.sendTo(obj.from, obj.command, { success: false, error: _ovE.message }, obj.callback); }
        }
        else if (obj.command === 'clearSleepStartOverride') {
            try {
                await this.setStateAsync('analysis.sleep.startOverride', { val: 'null', ack: true });
                await this.saveDailyHistory();
                var _clDataDir = utils.getAbsoluteDefaultDataDir();
                var _clNow = new Date();
                var _clDateStr = _clNow.getFullYear() + '-' + String(_clNow.getMonth()+1).padStart(2,'0') + '-' + String(_clNow.getDate()).padStart(2,'0');
                var _clPath = path.join(_clDataDir, 'cogni-living', 'history', _clDateStr + '.json');
                if (fs.existsSync(_clPath)) {
                    var _clSnap = JSON.parse(fs.readFileSync(_clPath, 'utf8'));
                    this.sendTo(obj.from, obj.command, { success: true, data: _clSnap }, obj.callback);
                } else { this.sendTo(obj.from, obj.command, { success: true, data: null }, obj.callback); }
            } catch(_clE) { this.sendTo(obj.from, obj.command, { success: false, error: _clE.message }, obj.callback); }
        }
        else if (obj.command === 'setPersonSleepStartOverride') {
            try {
                var _povMsg = obj.message || {};
                var _povAllowed = ['fp2_vib','fp2','motion_vib','vib_refined','gap60','last_outside','haus_still','winstart','motion','other'];
                if (!_povMsg.person || !_povMsg.date || !_povMsg.source || !_povMsg.ts
                    || _povAllowed.indexOf(_povMsg.source) < 0) {
                    this.sendTo(obj.from, obj.command, { success: false, error: 'Ungueltige Per-Person Override-Daten' }, obj.callback); return;
                }
                var _povRawOld = (await this.getStateAsync('analysis.sleep.personStartOverrides'))?.val;
                var _povAll = (_povRawOld && _povRawOld !== 'null') ? JSON.parse(_povRawOld) : {};
                _povAll[_povMsg.person] = { date: _povMsg.date, source: _povMsg.source, ts: _povMsg.ts, setBy: 'ui', setAt: Date.now() };
                await this.setStateAsync('analysis.sleep.personStartOverrides', { val: JSON.stringify(_povAll), ack: true });
                await this.saveDailyHistory();
                var _povDir = utils.getAbsoluteDefaultDataDir();
                var _povNow = new Date();
                var _povPath = require('path').join(_povDir, 'cogni-living', 'history', _povNow.getFullYear() + '-' + String(_povNow.getMonth()+1).padStart(2,'0') + '-' + String(_povNow.getDate()).padStart(2,'0') + '.json');
                if (fs.existsSync(_povPath)) {
                    var _povSnap = JSON.parse(fs.readFileSync(_povPath, 'utf8'));
                    this.sendTo(obj.from, obj.command, { success: true, data: _povSnap }, obj.callback);
                } else { this.sendTo(obj.from, obj.command, { success: true, data: null }, obj.callback); }
            } catch(_povE) { this.sendTo(obj.from, obj.command, { success: false, error: _povE.message }, obj.callback); }
        }
        else if (obj.command === 'clearPersonSleepStartOverride') {
            try {
                var _pcMsg = obj.message || {};
                if (!_pcMsg.person) {
                    this.sendTo(obj.from, obj.command, { success: false, error: 'person fehlt' }, obj.callback); return;
                }
                var _pcRawOld = (await this.getStateAsync('analysis.sleep.personStartOverrides'))?.val;
                var _pcAll = (_pcRawOld && _pcRawOld !== 'null') ? JSON.parse(_pcRawOld) : {};
                delete _pcAll[_pcMsg.person];
                await this.setStateAsync('analysis.sleep.personStartOverrides', { val: JSON.stringify(_pcAll), ack: true });
                await this.saveDailyHistory();
                var _pcDir = utils.getAbsoluteDefaultDataDir();
                var _pcNow = new Date();
                var _pcPath = require('path').join(_pcDir, 'cogni-living', 'history', _pcNow.getFullYear() + '-' + String(_pcNow.getMonth()+1).padStart(2,'0') + '-' + String(_pcNow.getDate()).padStart(2,'0') + '.json');
                if (fs.existsSync(_pcPath)) {
                    var _pcSnap = JSON.parse(fs.readFileSync(_pcPath, 'utf8'));
                    this.sendTo(obj.from, obj.command, { success: true, data: _pcSnap }, obj.callback);
                } else { this.sendTo(obj.from, obj.command, { success: true, data: null }, obj.callback); }
            } catch(_pcE) { this.sendTo(obj.from, obj.command, { success: false, error: _pcE.message }, obj.callback); }
        }
        else if (obj.command === 'setWakeOverride') {
            try {
                var _wovMsg = obj.message || {};
                var _wovAllowed = ['garmin','fp2_vib','fp2','fp2_other','motion_vib','last_outside','haus_still','motion','vibration_alone','other','fixed','override'];
                if (!_wovMsg.date || !_wovMsg.source || !_wovMsg.ts || _wovAllowed.indexOf(_wovMsg.source) < 0) {
                    this.sendTo(obj.from, obj.command, { success: false, error: 'Ungueltige Wake-Override-Daten' }, obj.callback); return;
                }
                var _wovPayload = { date: _wovMsg.date, source: _wovMsg.source, ts: _wovMsg.ts, setBy: 'ui', setAt: Date.now() };
                await this.setStateAsync('analysis.sleep.wakeOverride', { val: JSON.stringify(_wovPayload), ack: true });
                await this.saveDailyHistory(_wovPayload);
                var _wovDataDir = utils.getAbsoluteDefaultDataDir();
                var _wovNow = new Date();
                var _wovPath = require('path').join(_wovDataDir, 'cogni-living', 'history', _wovNow.getFullYear() + '-' + String(_wovNow.getMonth()+1).padStart(2,'0') + '-' + String(_wovNow.getDate()).padStart(2,'0') + '.json');
                if (fs.existsSync(_wovPath)) { var _wovSnap = JSON.parse(fs.readFileSync(_wovPath, 'utf8')); this.sendTo(obj.from, obj.command, { success: true, data: _wovSnap }, obj.callback); }
                else { this.sendTo(obj.from, obj.command, { success: true, data: null }, obj.callback); }
            } catch(_wovE) { this.sendTo(obj.from, obj.command, { success: false, error: _wovE.message }, obj.callback); }
        }
        else if (obj.command === 'clearWakeOverride') {
            try {
                await this.setStateAsync('analysis.sleep.wakeOverride', { val: 'null', ack: true });
                await this.saveDailyHistory();
                var _cwovDir = utils.getAbsoluteDefaultDataDir();
                var _cwovNow = new Date();
                var _cwovPath = require('path').join(_cwovDir, 'cogni-living', 'history', _cwovNow.getFullYear() + '-' + String(_cwovNow.getMonth()+1).padStart(2,'0') + '-' + String(_cwovNow.getDate()).padStart(2,'0') + '.json');
                if (fs.existsSync(_cwovPath)) { var _cwovSnap = JSON.parse(fs.readFileSync(_cwovPath, 'utf8')); this.sendTo(obj.from, obj.command, { success: true, data: _cwovSnap }, obj.callback); }
                else { this.sendTo(obj.from, obj.command, { success: true, data: null }, obj.callback); }
            } catch(_cwovE) { this.sendTo(obj.from, obj.command, { success: false, error: _cwovE.message }, obj.callback); }
        }
        else if (obj.command === 'setPersonWakeOverride') {
            try {
                var _pwovMsg = obj.message || {};
                var _pwovAllowed = ['garmin','fp2_vib','fp2','fp2_other','motion_vib','motion_vib_wake','vib_refined','gap60','last_outside','haus_still','vibration_alone','vibration','other','fixed','override'];
                if (!_pwovMsg.person || !_pwovMsg.date || !_pwovMsg.source || !_pwovMsg.ts || _pwovAllowed.indexOf(_pwovMsg.source) < 0) {
                    this.sendTo(obj.from, obj.command, { success: false, error: 'Ungueltige Per-Person Wake-Override-Daten' }, obj.callback); return;
                }
                var _pwovRawOld = (await this.getStateAsync('analysis.sleep.personWakeOverrides'))?.val;
                var _pwovAll = (_pwovRawOld && _pwovRawOld !== 'null') ? JSON.parse(_pwovRawOld) : {};
                _pwovAll[_pwovMsg.person] = { date: _pwovMsg.date, source: _pwovMsg.source, ts: _pwovMsg.ts, setBy: 'ui', setAt: Date.now() };
                await this.setStateAsync('analysis.sleep.personWakeOverrides', { val: JSON.stringify(_pwovAll), ack: true });
                await this.saveDailyHistory();
                var _pwovDir = utils.getAbsoluteDefaultDataDir();
                var _pwovNow = new Date();
                var _pwovPath = require('path').join(_pwovDir, 'cogni-living', 'history', _pwovNow.getFullYear() + '-' + String(_pwovNow.getMonth()+1).padStart(2,'0') + '-' + String(_pwovNow.getDate()).padStart(2,'0') + '.json');
                if (fs.existsSync(_pwovPath)) { var _pwovSnap = JSON.parse(fs.readFileSync(_pwovPath, 'utf8')); this.sendTo(obj.from, obj.command, { success: true, data: _pwovSnap }, obj.callback); }
                else { this.sendTo(obj.from, obj.command, { success: true, data: null }, obj.callback); }
            } catch(_pwovE) { this.sendTo(obj.from, obj.command, { success: false, error: _pwovE.message }, obj.callback); }
        }
        else if (obj.command === 'clearPersonWakeOverride') {
            try {
                var _cpwovMsg = obj.message || {};
                if (!_cpwovMsg.person) { this.sendTo(obj.from, obj.command, { success: false, error: 'person fehlt' }, obj.callback); return; }
                var _cpwovRaw = (await this.getStateAsync('analysis.sleep.personWakeOverrides'))?.val;
                var _cpwovAll = (_cpwovRaw && _cpwovRaw !== 'null') ? JSON.parse(_cpwovRaw) : {};
                delete _cpwovAll[_cpwovMsg.person];
                await this.setStateAsync('analysis.sleep.personWakeOverrides', { val: JSON.stringify(_cpwovAll), ack: true });
                await this.saveDailyHistory();
                var _cpwovDir = utils.getAbsoluteDefaultDataDir();
                var _cpwovNow = new Date();
                var _cpwovPath = require('path').join(_cpwovDir, 'cogni-living', 'history', _cpwovNow.getFullYear() + '-' + String(_cpwovNow.getMonth()+1).padStart(2,'0') + '-' + String(_cpwovNow.getDate()).padStart(2,'0') + '.json');
                if (fs.existsSync(_cpwovPath)) { var _cpwovSnap = JSON.parse(fs.readFileSync(_cpwovPath, 'utf8')); this.sendTo(obj.from, obj.command, { success: true, data: _cpwovSnap }, obj.callback); }
                else { this.sendTo(obj.from, obj.command, { success: true, data: null }, obj.callback); }
            } catch(_cpwovE) { this.sendTo(obj.from, obj.command, { success: false, error: _cpwovE.message }, obj.callback); }
        }
        else if (obj.command === 'reanalyzeSexDay') {
            try {
                const _raDate = (obj.message && obj.message.date) ? obj.message.date : null;
                if (!_raDate || !/^\d{4}-\d{2}-\d{2}$/.test(_raDate)) {
                    this.sendTo(obj.from, obj.command, { success: false, error: 'Kein gueltiges Datum' }, obj.callback); return;
                }
                if (this.config.moduleSex !== true) {
                    this.sendTo(obj.from, obj.command, { success: false, error: 'Sex-Modul nicht aktiviert' }, obj.callback); return;
                }
                const _raDir = utils.getAbsoluteDefaultDataDir();
                const _raPath = path.join(_raDir, 'cogni-living', 'history', _raDate + '.json');
                if (!fs.existsSync(_raPath)) {
                    this.sendTo(obj.from, obj.command, { success: false, error: 'Keine Daten fuer diesen Tag' }, obj.callback); return;
                }
                const _raSnap = JSON.parse(fs.readFileSync(_raPath, 'utf8'));
                const _raAllEvts = _raSnap.eventHistory || [];
                // --- KALIBRIERUNG ---
                var _raCalibA = 50, _raCalibB = 30, _raCalibSrc = 'default', _raCalibN = 0;
                try {
                    var _raSexLabels = [];
                    try { var _raSlP = JSON.parse(this.config.sexTrainingLabels || ''); if (Array.isArray(_raSlP)) _raSexLabels = _raSlP.filter(function(l){return l&&l.date;}); } catch(_rlE){}
                    if (_raSexLabels.length >= 2) {
                        var _raCalDir = path.join(utils.getAbsoluteDefaultDataDir(), 'cogni-living', 'history');
                        var _raSessPeaks = [], _raVaginalPeaks = [], _raOralPeaks = [];
                        var _raSexTrainData = [];
                        var _raSlotCalMs = 5*60*1000;
                        var _raLabelsUpdated = false;                        for (var _raLbl of _raSexLabels /* alle Typen inkl. Nullnummer (3. RF-Klasse), unlimitiert */) {                            // Fast-Path: gespeicherte Features direkt verwenden (kein JSON-Lesen)                            if (_raLbl._features) {                                var _raFP = _raLbl._features, _raLTypFP = (_raLbl.type||'').toLowerCase();                                if (_raLTypFP !== 'nullnummer') _raSessPeaks.push(_raFP.medianPeak);                                if (_raLTypFP === 'vaginal') _raVaginalPeaks.push(_raFP.medianPeak);                                else if (_raLTypFP === 'oral_hand') _raOralPeaks.push(_raFP.medianPeak);                                _raSexTrainData.push({peak:_raFP.peakMax,durSlots:_raFP.durSlots,avgPeak:_raFP.avgPeak,variance:_raFP.variance,tierB:0,label:_raLTypFP,date:_raLbl.date||'',hourSin:_raFP.hourSin||0,hourCos:_raFP.hourCos||1,lightOn:_raFP.lightOn!==undefined?_raFP.lightOn:null,presenceOn:_raFP.presenceOn!==undefined?_raFP.presenceOn:null,roomTemp:_raFP.roomTemp||null,bathBefore:_raFP.bathBefore||0,bathAfter:_raFP.bathAfter||0,nearbyRoomMotion:_raFP.nearbyRoomMotion||0});                                continue;                            }                            try {
                                var _raLPath = path.join(_raCalDir, _raLbl.date + '.json');
                                if (!fs.existsSync(_raLPath)) continue;
                                var _raLSnap = JSON.parse(fs.readFileSync(_raLPath, 'utf8'));
                                var _raLAllE = (_raLSnap.eventHistory || []).filter(function(e){ return e.type==='vibration_strength'&&(e.isVibrationBed||e.isFP2Bed); });
                                if (_raLAllE.length === 0) continue;
                                var _raLT0 = null, _raLT1 = null;
                                if (_raLbl.time && /^\d{1,2}:\d{2}$/.test(_raLbl.time)) {
                                    var _raLP = _raLbl.time.split(':');
                                    var _raLBase = new Date(_raLbl.date + 'T00:00:00');
                                    _raLBase.setHours(parseInt(_raLP[0]), parseInt(_raLP[1]), 0, 0);
                                    _raLT0 = _raLBase.getTime() - 45*60000;
                                    _raLT1 = _raLBase.getTime() + ((_raLbl.durationMin||45)+15)*60000;
                                }
                                var _raLEvts = _raLT0!==null ? _raLAllE.filter(function(e){var t=e.timestamp||0;return t>=_raLT0&&t<=_raLT1;}) : _raLAllE;
                                if (_raLEvts.length === 0) continue;
                                _raLEvts.sort(function(a,b){return (a.timestamp||0)-(b.timestamp||0);});
                                var _raLFirst=_raLEvts[0].timestamp||0, _raLLast=(_raLEvts[_raLEvts.length-1].timestamp||0)+_raSlotCalMs;
                                var _raLSPeaks=[];
                                for (var _raLS=_raLFirst; _raLS<_raLLast; _raLS+=_raSlotCalMs) {
                                    var _raLSVals=_raLEvts.filter(function(e){var t=e.timestamp||0;return t>=_raLS&&t<_raLS+_raSlotCalMs;}).map(function(e){return Number(e.value)||0;});
                                    if (_raLSVals.length>0) _raLSPeaks.push(Math.max.apply(null,_raLSVals));
                                }
                                if (_raLSPeaks.length>0){
                                    _raLSPeaks.sort(function(a,b){return a-b;});
                                    var _raLMed=_raLSPeaks[Math.floor(_raLSPeaks.length/2)];
                                    // Bug-Fix: Nullnummer-Peaks ausschliessen
                                    var _raLTyp=(_raLbl.type||'').toLowerCase();
                                    if (_raLTyp!=='nullnummer') _raSessPeaks.push(_raLMed);
                                    if (_raLTyp==='vaginal') _raVaginalPeaks.push(_raLMed);
                                    else if (_raLTyp==='oral_hand') _raOralPeaks.push(_raLMed);
                                    var _raLPkMax=_raLSPeaks[_raLSPeaks.length-1];
                                    var _raLAvgP=Math.round(_raLSPeaks.reduce(function(a,b){return a+b;},0)/_raLSPeaks.length);
                                    var _raLVarP=Math.round(_raLSPeaks.reduce(function(a,b){return a+(b-_raLAvgP)*(b-_raLAvgP);},0)/_raLSPeaks.length);
                                    // Features einmalig im Label speichern (Migration — kein erneutes JSON-Lesen)
                                     
                                    // Kontext-Features aus eventHistory extrahieren (identisch zu saveDailyHistory)
                                    var _raLCtxE = _raLSnap.eventHistory || [];
                                    var _raLSessP = {start: _raLT0||_raLFirst, end: _raLT1||(_raLLast+_raLFirst)};
                                    var _raLHrD = new Date(_raLSessP.start); var _raLHF = _raLHrD.getHours()+_raLHrD.getMinutes()/60;
                                    var _raLHSin = Math.round(Math.sin(2*Math.PI*_raLHF/24)*1000)/1000;
                                    var _raLHCos = Math.round(Math.cos(2*Math.PI*_raLHF/24)*1000)/1000;
                                    var _raLLitE = _raLCtxE.filter(function(e){var t=e.timestamp||0;return (e.type==='light'||e.type==='light_status')&&t>=_raLSessP.start&&t<=_raLSessP.end;});
                                    var _raLLightOn = _raLLitE.length>0?(Number(_raLLitE[_raLLitE.length-1].value)>0?1:0):null;
                                    var _raLPresE = _raLCtxE.filter(function(e){var t=e.timestamp||0;return e.isFP2Bed&&t>=_raLSessP.start&&t<=_raLSessP.end;});
                                    var _raLPresOn = _raLPresE.length>0?(Number(_raLPresE[_raLPresE.length-1].value)>0?1:0):null;
                                    var _raLTempE = _raLCtxE.filter(function(e){var t=e.timestamp||0;return (e.type==='temperature'||e.type==='temp')&&t>=_raLSessP.start&&t<=_raLSessP.end;});
                                    var _raLRoomT = _raLTempE.length>0?(Number(_raLTempE[_raLTempE.length-1].value)||null):null;
                                    var _raLBathB = _raLCtxE.some(function(e){var t=e.timestamp||0;return (e.isBathroomSensor||e.type==='bathroom_motion')&&t>=(_raLSessP.start-3600000)&&t<_raLSessP.start;});
                                    var _raLBathA = _raLCtxE.some(function(e){var t=e.timestamp||0;return (e.isBathroomSensor||e.type==='bathroom_motion')&&t>_raLSessP.end&&t<=(_raLSessP.end+3600000);});
                                    // Features vollständig speichern (incl. Kontext) — immer überschreiben für Re-Migration
                                    _raLbl._features = {peakMax:_raLPkMax,medianPeak:_raLMed,durSlots:_raLSPeaks.length,avgPeak:_raLAvgP,variance:_raLVarP,hourSin:_raLHSin,hourCos:_raLHCos,lightOn:_raLLightOn,presenceOn:_raLPresOn,roomTemp:_raLRoomT,bathBefore:_raLBathB?1:0,bathAfter:_raLBathA?1:0,nearbyRoomMotion:0}; _raLabelsUpdated = true;
                                     _raSexTrainData.push({peak:_raLPkMax,durSlots:_raLSPeaks.length,avgPeak:_raLAvgP,variance:_raLVarP,tierB:0,label:_raLTyp,date:_raLbl.date||'',hourSin:_raLHSin,hourCos:_raLHCos,lightOn:_raLLightOn,presenceOn:_raLPresOn,roomTemp:_raLRoomT,bathBefore:_raLBathB?1:0,bathAfter:_raLBathA?1:0,nearbyRoomMotion:0});
                                }
                            } catch(_raLE){ this.log.debug('[OC-SEX-RA] Calib: '+_raLE.message); }
                        }
                        // Angereicherte Labels persistieren (Fire-and-Forget)
                        if (_raLabelsUpdated) { try { var _raLblUpd=JSON.stringify(_raSexLabels); this.config.sexTrainingLabels=_raLblUpd; this.extendForeignObjectAsync('system.adapter.'+this.namespace,{native:{sexTrainingLabels:_raLblUpd}}).catch(function(){}); this.log.debug('[OC-SEX-RA] Labels angereichert ('+_raSexLabels.filter(function(l){return l._features;}).length+' mit Features)'); } catch(_rlSE){} }
                        if (_raVaginalPeaks.length>=2&&_raOralPeaks.length>=2){
                            _raVaginalPeaks.sort(function(a,b){return a-b;}); _raOralPeaks.sort(function(a,b){return a-b;});
                            _raCalibA=Math.max(5,Math.round(_raVaginalPeaks[0]*1.0)); _raCalibB=Math.max(3,Math.round(_raOralPeaks[0]*0.7));
                            _raCalibSrc='labels_typed'; _raCalibN=_raSessPeaks.length;
                        } else if (_raSessPeaks.length>=2){
                            _raSessPeaks.sort(function(a,b){return a-b;});var _raMinP=_raSessPeaks[0];
                            _raCalibB=Math.max(3,Math.round(_raMinP*0.7));_raCalibA=Math.max(5,Math.round(_raMinP*1.1));
                            _raCalibSrc='labels';_raCalibN=_raSessPeaks.length;
                        }
                    }
                } catch(_raCalE){ this.log.debug('[OC-SEX-RA] Kalibrierung: '+_raCalE.message); }
                if (_raCalibSrc==='default'&&this.config.sexCalibThreshold&&Number(this.config.sexCalibThreshold)>0){_raCalibB=Number(this.config.sexCalibThreshold);_raCalibA=Math.round(_raCalibB*1.3);_raCalibSrc='manual';}
                if (_raCalibSrc==='default'){var _raBsVals=_raAllEvts.filter(function(e){return e.type==='vibration_strength'&&(e.isVibrationBed||e.isFP2Bed);}).map(function(e){return Number(e.value)||0;}).filter(function(v){return v>0;});if(_raBsVals.length>=10){_raBsVals.sort(function(a,b){return a-b;});var _raBsP75=_raBsVals[Math.floor(_raBsVals.length*0.75)];_raCalibA=Math.max(5,Math.round(_raBsP75*2.5));_raCalibB=Math.max(3,Math.round(_raBsP75*1.5));_raCalibSrc='baseline';}}
                var _raCalibInfo = { src: _raCalibSrc, n: _raCalibN, calibA: _raCalibA, calibB: _raCalibB };
                // --- SEX-DETEKTION ---
                var _raDayStart = new Date(_raDate + 'T00:00:00').getTime();
                var _raIntimEvts=_raAllEvts.filter(function(e){return (e.type==='vibration_strength'||e.type==='vibration_trigger')&&(e.isVibrationBed||e.isFP2Bed||(!e.isFP2Bed&&!e.isBedroomMotion))&&((e.timestamp||0)>=_raDayStart);}).sort(function(a,b){return (a.timestamp||0)-(b.timestamp||0);});
                var _raVibStr=_raIntimEvts.filter(function(e){return e.type==='vibration_strength';});
                var _raVibTrig=_raIntimEvts.filter(function(e){return e.type==='vibration_trigger';});
                var _raSlotMs=5*60*1000;
                var _raSlots=[];
                if(_raIntimEvts.length>=4){var _raTFirst=_raIntimEvts[0].timestamp||0,_raTLast=(_raIntimEvts[_raIntimEvts.length-1].timestamp||0)+_raSlotMs;for(var _raIS=_raTFirst;_raIS<_raTLast;_raIS+=_raSlotMs){var _raIE=_raIS+_raSlotMs;var _raStr=_raVibStr.filter(function(e){return (e.timestamp||0)>=_raIS&&(e.timestamp||0)<_raIE;});var _raTrg=_raVibTrig.filter(function(e){return (e.timestamp||0)>=_raIS&&(e.timestamp||0)<_raIE;});var _raSVals=_raStr.map(function(e){return Number(e.value)||0;});var _raSMax=_raSVals.length>0?Math.max.apply(null,_raSVals):0;var _raSAvg=_raSVals.length>0?Math.round(_raSVals.reduce(function(a,b){return a+b;},0)/_raSVals.length):0;_raSlots.push({start:_raIS,end:_raIE,strCnt:_raStr.length,trigCnt:_raTrg.length,strMax:_raSMax,strAvg:_raSAvg});}}
                var _raCand=[],_raRunA=[];
                _raSlots.forEach(function(sl,i){var _a=(sl.trigCnt>=2||sl.strCnt>=1)&&sl.strMax>=_raCalibA;if(_a){_raRunA.push(i);}else{if(_raRunA.length>=2)_raCand.push({run:_raRunA.slice(),tier:'A'});_raRunA=[];}});
                if(_raRunA.length>=2)_raCand.push({run:_raRunA.slice(),tier:'A'});
                var _raCovA=new Set();_raCand.forEach(function(c){c.run.forEach(function(i){_raCovA.add(i);});});
                var _raRunB=[];
                _raSlots.forEach(function(sl,i){if(_raCovA.has(i)){if(_raRunB.length>=6&&_raRunB.length<=24)_raCand.push({run:_raRunB.slice(),tier:'B'});_raRunB=[];return;}var _b=(sl.trigCnt>=1||sl.strCnt>=1)&&sl.strMax>=_raCalibB;if(_b){_raRunB.push(i);}else{if(_raRunB.length>=6&&_raRunB.length<=24)_raCand.push({run:_raRunB.slice(),tier:'B'});_raRunB=[];}});
                if(_raRunB.length>=6&&_raRunB.length<=24)_raCand.push({run:_raRunB.slice(),tier:'B'});
                var _raIntimacyEvents=[];
                _raCand.forEach(function(cObj){var run=cObj.run;var _sl0=_raSlots[run[0]],_slN=_raSlots[run[run.length-1]];var _evtStart=_sl0.start,_evtEnd=_slN.end;var _durMin=Math.round(run.length*5);var _runSlots=run.map(function(i){return _raSlots[i];});var _peakMax=Math.max.apply(null,_runSlots.map(function(s){return s.strMax;}));var _avgAvg=Math.round(_runSlots.reduce(function(a,s){return a+s.strAvg;},0)/_runSlots.length);var _avgTrig=Math.round(_runSlots.reduce(function(a,s){return a+s.trigCnt;},0)/_runSlots.length);var _sStr=Math.min(100,Math.round((_peakMax/120)*100));var _sDens=Math.min(100,Math.round((_avgTrig/10)*100));var _sDur=Math.min(100,Math.round((_durMin/60)*100));var _score=Math.round(_sStr*0.5+_sDens*0.3+_sDur*0.2);var _raVagThr=Math.round(_raCalibA*1.5);var _highSlots=_runSlots.filter(function(s){return s.strMax>=_raVagThr&&s.strCnt>=2;});var _type=cObj.tier==='B'?'oral_hand':(_highSlots.length>=1?'vaginal':(_peakMax>=_raCalibA?'oral_hand':'intim'));_raIntimacyEvents.push({start:_evtStart,end:_evtEnd,duration:_durMin,score:_score,type:_type,peakStrength:_peakMax,avgStrength:_avgAvg,avgTrigger:_avgTrig,garminHRMax:null,garminHRAvg:null,slots:_runSlots.map(function(s){return{start:s.start,strMax:s.strMax,strAvg:s.strAvg,trigCnt:s.trigCnt};})});});
                this.log.info('[OC-SEX-RA] '+_raDate+': '+_raIntimacyEvents.length+' Event(s). calibA='+_raCalibA+' calibB='+_raCalibB);
                // Gap-Toleranz-Merge: Sessions mit Abstand <30 Min zu einer zusammenfassen
                var _raGapMs = 30 * 60 * 1000;
                _raIntimacyEvents.sort(function(a,b){return a.start-b.start;});
                var _raGMerged = [];
                for (var _ragmi = 0; _ragmi < _raIntimacyEvents.length; _ragmi++) {
                    var _raGCur = _raIntimacyEvents[_ragmi];
                    if (_raGMerged.length === 0 || _raGCur.start - _raGMerged[_raGMerged.length-1].end > _raGapMs) {
                        _raGMerged.push(Object.assign({}, _raGCur, {slots: (_raGCur.slots||[]).slice()}));
                    } else {
                        var _raGPrev = _raGMerged[_raGMerged.length-1];
                        var _raGRank = {'vaginal':3,'oral_hand':2,'intim':1};
                        if ((_raGRank[_raGCur.type]||0) > (_raGRank[_raGPrev.type]||0)) _raGPrev.type = _raGCur.type;
                        _raGPrev.end = Math.max(_raGPrev.end, _raGCur.end);
                        _raGPrev.duration = Math.round((_raGPrev.end - _raGPrev.start) / 60000);
                        _raGPrev.peakStrength = Math.max(_raGPrev.peakStrength, _raGCur.peakStrength);
                        _raGPrev.avgStrength = Math.round((_raGPrev.avgStrength + _raGCur.avgStrength) / 2);
                        _raGPrev.avgTrigger = Math.round((_raGPrev.avgTrigger + _raGCur.avgTrigger) / 2);
                        _raGPrev.score = Math.round((_raGPrev.score + _raGCur.score) / 2);
                        _raGPrev.slots = (_raGPrev.slots||[]).concat(_raGCur.slots||[]);
                    }
                }
                if (_raGMerged.length < _raIntimacyEvents.length) { this.log.info('[OC-SEX-RA] Gap-Merge: ' + _raIntimacyEvents.length + ' ? ' + _raGMerged.length + ' Session(s)'); _raIntimacyEvents = _raGMerged; }
                // Kontext-Sensor-IDs (sensorFunction-basiert)
                var _raBedIds  = new Set((this.config.devices||[]).filter(function(d){return d.sensorFunction==='bed';}).map(function(d){return d.id;}));
                var _raBathIds = new Set((this.config.devices||[]).filter(function(d){return d.sensorFunction==='bathroom'||d.isBathroomSensor;}).map(function(d){return d.id;}));
                var _raBedRoom = (this.config.devices||[]).filter(function(d){return d.sensorFunction==='bed';}).map(function(d){return d.location;}).filter(Boolean)[0] || null;
                // Topologie BFS: Raeume mit Hop<=2 vom Schlafzimmer
                var _raNearbyRooms = new Set();
                try {
                    var _raTopoSt = await this.getStateAsync('analysis.topology.structure');
                    if (_raTopoSt && _raTopoSt.val) {
                        var _raTopoObj=JSON.parse(_raTopoSt.val);
                        var _raTopoRms=_raTopoObj.rooms||[], _raTopoMat=_raTopoObj.matrix||[];
                        var _raBedRms=new Set((this.config.devices||[]).filter(function(d){return d.sensorFunction==='bed';}).map(function(d){return d.location;}).filter(Boolean));
                        _raBedRms.forEach(function(bedRoom){
                            var _bi=_raTopoRms.indexOf(bedRoom); if(_bi===-1) return;
                            var _dist=new Array(_raTopoRms.length).fill(Infinity); _dist[_bi]=0;
                            var _q=[_bi];
                            while(_q.length>0){var _c=_q.shift();if(_dist[_c]>=1)continue;for(var _j2=0;_j2<_raTopoRms.length;_j2++){if(_raTopoMat[_c]&&_raTopoMat[_c][_j2]===1&&_dist[_j2]===Infinity){_dist[_j2]=_dist[_c]+1;_q.push(_j2);}}}
                            _raTopoRms.forEach(function(rm,idx){if(_dist[idx]===1)_raNearbyRooms.add(rm);});
                        });
                    }
                } catch(_raTopoE){ /* ignorieren */ }
                var _raNearbyRoomSensorIds = (this.config.devices||[]).filter(function(d){return d.type==='motion'&&!d.isBathroomSensor&&d.sensorFunction!=='bed'&&_raNearbyRooms.has(d.location);}).map(function(d){return d.id;});
                var _raExtractCtx = function(session, evts) {
                    var _wS=session.start-15*60000, _wE=session.end+30*60000;
                    var _wE2=evts.filter(function(e){var t=e.timestamp||0;return t>=_wS&&t<=_wE;});
                    var _hrD=new Date(session.start); var _hF=_hrD.getHours()+_hrD.getMinutes()/60;
                    var _hSin=Math.round(Math.sin(2*Math.PI*_hF/24)*1000)/1000;
                    var _hCos=Math.round(Math.cos(2*Math.PI*_hF/24)*1000)/1000;
                    var _lE=_wE2.filter(function(e){return (e.type==='light'||e.type==='dimmer')&&(_raBedRoom?e.location===_raBedRoom:_raBedIds.has(e.id));});
                    var _lOn=_lE.length>0?(Number(_lE[_lE.length-1].value)>0?1:0):null;
                    var _pE=_wE2.filter(function(e){return e.isFP2Bed;});
                    var _pOn=_pE.length>0?(Number(_pE[_pE.length-1].value)>0?1:0):null;
                    var _tE=_wE2.filter(function(e){return (e.type==='temperature'||e.type==='thermostat'||e.type==='heating_valve')&&(_raBedRoom?e.location===_raBedRoom:_raBedIds.has(e.id));});
                    var _rT=_tE.length>0?(Number(_tE[_tE.length-1].value)||null):null;
                    var _bB=evts.some(function(e){var t=e.timestamp||0;return (e.isBathroomSensor||_raBathIds.has(e.id))&&e.type==='motion'&&t>=session.start-60*60000&&t<session.start;})?1:0;
                    var _bA=evts.some(function(e){var t=e.timestamp||0;return (e.isBathroomSensor||_raBathIds.has(e.id))&&e.type==='motion'&&t>session.end&&t<=session.end+60*60000;})?1:0;
                    var _nrM2=_raNearbyRooms.size>0?evts.some(function(e){var t=e.timestamp||0;return e.type==='motion'&&_raNearbyRooms.has(e.location)&&t>=session.start-5*60000&&t<=session.end+5*60000;})?1:0:null;
                    return {hourSin:_hSin,hourCos:_hCos,lightOn:_lOn,presenceOn:_pOn,roomTemp:_rT,bathBefore:_bB,bathAfter:_bA,nearbyRoomMotion:_nrM2};
                };
                // Stufe 3: Python-Klassifikator (skipPy=true beim Batch-Reanalyze ? kein Callback-Konflikt)
                var _raPyInfo = null;
                var _raSkipPy = (obj.message && obj.message.skipPy === true);
                if (!_raSkipPy && _raSexTrainData.length >= 3) { // Python auch mit 0 Events aufrufen (Modell trainieren/speichern)
                    try {
                        var _raPyPred = _raIntimacyEvents.map(function(e) {
                            var _sl=e.slots||[]; var _strs=_sl.map(function(s){return s.strMax||0;});
                            var _avg3=_strs.length>0?_strs.reduce(function(a,b){return a+b;},0)/_strs.length:0;
                            var _var3=_strs.length>0?_strs.reduce(function(a,b){return a+(b-_avg3)*(b-_avg3);},0)/_strs.length:0;
                            var _raCtx=_raExtractCtx(e, _raAllEvts);
                            return Object.assign({peak:e.peakStrength,durSlots:_sl.length,avgPeak:Math.round(_avg3),variance:Math.round(_var3),tierB:(e.tier==='B'?1:0)},_raCtx);
                        });
                        var _raPyRes = await new Promise(function(resolve,reject){
                            var _raTout=setTimeout(function(){reject(new Error('timeout'));},15000);
                            pythonBridge.send(this,'CLASSIFY_SEX_SESSIONS',{train:_raSexTrainData,predict:_raPyPred},function(r){clearTimeout(_raTout);resolve(r);});
                        }.bind(this));
                        if (_raPyRes&&_raPyRes.payload){
                            _raPyInfo=_raPyRes.payload;
                            if (_raPyInfo.trained&&Array.isArray(_raPyInfo.results)){
                                _raPyInfo.results.forEach(function(r,i){
                                    if (!_raIntimacyEvents[i]) return;
                                    if (r.type==='nullnummer'&&r.confidence>=0.60){
                                        this.log.info('[OC-SEX-RA-PY] Session '+i+' als Nullnummer klassifiziert � wird entfernt');
                                        _raIntimacyEvents[i]=null;
                                    } else if (r.type&&r.type!=='nullnummer'&&r.confidence>=0.55){
                                        _raIntimacyEvents[i].type=r.type;
                                        _raIntimacyEvents[i].pyConf=Math.round(r.confidence*100);
                                    }
                                }.bind(this));
                                _raIntimacyEvents=_raIntimacyEvents.filter(function(e){return e!==null;});
                            }
                        }
                    } catch(_raPyE){ this.log.debug('[OC-SEX-RA-PY] '+_raPyE.message); }
                }
                _raCalibInfo.pyClassifier = _raPyInfo ? {trained:_raPyInfo.trained||false,n:_raPyInfo.n_samples||0,counts:_raPyInfo.class_counts||{},msg:_raPyInfo.status_msg||'',feature_importances:_raPyInfo.feature_importances||[],loo_accuracy:(_raPyInfo.loo_accuracy!=null?_raPyInfo.loo_accuracy:null),confusion_matrix:_raPyInfo.confusion_matrix||null,loo_details:_raPyInfo.loo_details||[],nearbyRoomSensorIds:_raNearbyRoomSensorIds} : null;
                // Nullnummer-Override (Session-Level): Nur gematchte Sessions entfernen, nicht den ganzen Tag
                var _raNullLabels=[];
                try{var _rnRaw=JSON.parse(this.config.sexTrainingLabels||'[]');if(Array.isArray(_rnRaw))_raNullLabels=_rnRaw.filter(function(l){return l&&l.date===_raDate&&l.type==='nullnummer'&&l.time;});}catch(_rnE){}
                if (_raNullLabels.length>0){
                    var _rnBefore=_raIntimacyEvents.length;
                    _raIntimacyEvents=_raIntimacyEvents.filter(function(e){
                        return !_raNullLabels.some(function(nl){
                            var _nlP=nl.time.split(':').map(Number);
                            var _nlMs=new Date(_raDate+'T00:00:00').setHours(_nlP[0],_nlP[1],0,0);
                            return Math.abs((e.start||0)-_nlMs)<30*60000;
                        });
                    });
                    this.log.info('[OC-SEX-RA] '+_raDate+': Nullnummer-Filter: '+(_rnBefore-_raIntimacyEvents.length)+' Session(s) entfernt, '+_raIntimacyEvents.length+' behalten');
                }
                _raSnap.intimacyEvents = _raIntimacyEvents;
                _raSnap.sexCalibInfo = _raCalibInfo;
                _raSnap.timestamp = Date.now();
                fs.writeFileSync(_raPath, JSON.stringify(_raSnap), 'utf8');
                this.sendTo(obj.from, obj.command, { success: true, data: _raSnap }, obj.callback);
            } catch(_raE) {
                this.log.warn('[OC-SEX-RA] Fehler: '+_raE.message);
                this.sendTo(obj.from, obj.command, { success: false, error: _raE.message }, obj.callback);
            }
        }
        // reanalyzeAllSexDays: Gibt Liste aller Tage zurueck - Frontend ruft reanalyzeSexDay sequenziell auf
        else if (obj.command === 'reanalyzeAllSexDays') {
            try {
                if (this.config.moduleSex !== true) {
                    this.sendTo(obj.from, obj.command, { success: false, error: 'Sex-Modul nicht aktiviert' }, obj.callback); return;
                }
                const _allDir = path.join(utils.getAbsoluteDefaultDataDir(), 'cogni-living', 'history');
                if (!fs.existsSync(_allDir)) {
                    this.sendTo(obj.from, obj.command, { success: false, error: 'History-Verzeichnis nicht gefunden' }, obj.callback); return;
                }
                // Nur Tage mit eventHistory zurueckgeben (nicht leere Dateien)
                const _allFiles = fs.readdirSync(_allDir).filter(function(f) { return /^\d{4}-\d{2}-\d{2}\.json$/.test(f); }).sort();
                const _allDates = [];
                for (var _adFi = 0; _adFi < _allFiles.length; _adFi++) {
                    try {
                        var _adSnap = JSON.parse(fs.readFileSync(path.join(_allDir, _allFiles[_adFi]), 'utf8'));
                        if ((_adSnap.eventHistory || []).length > 0) _allDates.push(_allFiles[_adFi].replace('.json', ''));
                    } catch(e) {}
                }
                this.log.info('[ReanalyzeAll] ' + _allDates.length + ' Tage mit Daten gefunden.');
                this.sendTo(obj.from, obj.command, { success: true, dates: _allDates }, obj.callback);
            } catch(_allE) {
                this.log.warn('[ReanalyzeAll] Fehler: ' + _allE.message);
                this.sendTo(obj.from, obj.command, { success: false, error: _allE.message }, obj.callback);
            }
        }
        // getSexMonthSummary: Kompakte Zusammenfassung aller Sessions eines Monats
        else if (obj.command === 'getSexMonthSummary') {
            try {
                const _smMonth = (obj.message && obj.message.month) ? obj.message.month : null;
                if (!_smMonth || !/^\d{4}-\d{2}$/.test(_smMonth)) {
                    this.sendTo(obj.from, obj.command, { success: false, error: 'Kein gueltiges YYYY-MM' }, obj.callback); return;
                }
                const _smHistDir = path.join(utils.getAbsoluteDefaultDataDir(), 'cogni-living', 'history');
                const _smSummary = {};
                const _smYear = parseInt(_smMonth.split('-')[0]);
                const _smMon  = parseInt(_smMonth.split('-')[1]);
                const _smDays = new Date(_smYear, _smMon, 0).getDate();
                for (let _sd = 1; _sd <= _smDays; _sd++) {
                    const _sdStr = _smYear+'-'+String(_smMon).padStart(2,'0')+'-'+String(_sd).padStart(2,'0');
                    const _sdPath = path.join(_smHistDir, _sdStr+'.json');
                    if (fs.existsSync(_sdPath)) {
                        try {
                            const _sdSnap = JSON.parse(fs.readFileSync(_sdPath, 'utf8'));
                            const _sdEvts = (_sdSnap.intimacyEvents || []).map(function(e){
                                return {type:e.type,duration:e.duration,score:e.score,start:e.start,end:e.end,pyConf:e.pyConf};
                            });
                            if (_sdEvts.length > 0) _smSummary[_sdStr] = _sdEvts;
                        } catch(_sdE) {}
                    }
                }
                this.sendTo(obj.from, obj.command, { success: true, data: _smSummary }, obj.callback);
            } catch(_smE) {
                this.sendTo(obj.from, obj.command, { success: false, error: _smE.message }, obj.callback);
            }
        }
        // getManualSexSessions: Liest sex-manual.json
        else if (obj.command === 'getManualSexSessions') {
            try {
                var _msDir = path.join(utils.getAbsoluteDefaultDataDir(), 'cogni-living', 'history');
                var _msPath = path.join(_msDir, 'sex-manual.json');
                var _msEntries = [];
                if (fs.existsSync(_msPath)) {
                    try { _msEntries = JSON.parse(fs.readFileSync(_msPath, 'utf8')); } catch(_mse) {}
                }
                if (!Array.isArray(_msEntries)) _msEntries = [];
                this.sendTo(obj.from, obj.command, { success: true, entries: _msEntries }, obj.callback);
            } catch(_msE) {
                this.sendTo(obj.from, obj.command, { success: false, error: _msE.message }, obj.callback);
            }
        }
        // saveManualSexSession: Fuegt neue manuelle Session zu sex-manual.json hinzu
        else if (obj.command === 'saveManualSexSession') {
            try {
                var _svDir = path.join(utils.getAbsoluteDefaultDataDir(), 'cogni-living', 'history');
                var _svPath = path.join(_svDir, 'sex-manual.json');
                var _svEntries = [];
                if (fs.existsSync(_svPath)) {
                    try { _svEntries = JSON.parse(fs.readFileSync(_svPath, 'utf8')); } catch(_sve) {}
                }
                if (!Array.isArray(_svEntries)) _svEntries = [];
                var _svNew = {
                    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                    date: obj.message.date || '',
                    type: obj.message.type || 'sonstiges',
                    createdAt: Date.now()
                };
                if (obj.message.time) _svNew.time = obj.message.time;
                if (obj.message.durationMin) _svNew.durationMin = parseInt(obj.message.durationMin) || 0;
                _svEntries.push(_svNew);
                _svEntries.sort(function(a, b) { return b.date.localeCompare(a.date); });
                fs.writeFileSync(_svPath, JSON.stringify(_svEntries), 'utf8');
                this['log']['info']('[ManualSex] gespeichert: ' + _svNew.date + ' ' + _svNew.type);
                this.sendTo(obj.from, obj.command, { success: true, entries: _svEntries }, obj.callback);
            } catch(_svE) {
                this.sendTo(obj.from, obj.command, { success: false, error: _svE.message }, obj.callback);
            }
        }
        // deleteManualSexSession: Loescht Eintrag aus sex-manual.json per ID
        else if (obj.command === 'deleteManualSexSession') {
            try {
                var _dlDir = path.join(utils.getAbsoluteDefaultDataDir(), 'cogni-living', 'history');
                var _dlPath = path.join(_dlDir, 'sex-manual.json');
                var _dlEntries = [];
                if (fs.existsSync(_dlPath)) {
                    try { _dlEntries = JSON.parse(fs.readFileSync(_dlPath, 'utf8')); } catch(_dle) {}
                }
                if (!Array.isArray(_dlEntries)) _dlEntries = [];
                var _dlId = obj.message && obj.message.id;
                _dlEntries = _dlEntries.filter(function(e) { return e.id !== _dlId; });
                fs.writeFileSync(_dlPath, JSON.stringify(_dlEntries), 'utf8');
                this['log']['info']('[ManualSex] geloescht: ' + _dlId);
                this.sendTo(obj.from, obj.command, { success: true, entries: _dlEntries }, obj.callback);
            } catch(_dlE) {
                this.sendTo(obj.from, obj.command, { success: false, error: _dlE.message }, obj.callback);
            }
        }
        // clearIntimacyEventsForDay: Loescht intimacyEvents aus dem Tages-JSON (nach Nullnummer-Label setzen)
        else if (obj.command === 'clearIntimacyEventsForDay') {
            try {
                var _clDate = obj.message && obj.message.date;
                if (!_clDate || !/^\d{4}-\d{2}-\d{2}$/.test(_clDate)) {
                    this.sendTo(obj.from, obj.command, { success: false, error: 'Kein gueltiges Datum' }, obj.callback); return;
                }
                var _clDir = path.join(utils.getAbsoluteDefaultDataDir(), 'cogni-living', 'history');
                var _clPath = path.join(_clDir, _clDate + '.json');
                if (!fs.existsSync(_clPath)) {
                    this.sendTo(obj.from, obj.command, { success: true, cleared: false }, obj.callback); return;
                }
                var _clSnap = JSON.parse(fs.readFileSync(_clPath, 'utf8'));
                var _clPrev = (_clSnap.intimacyEvents || []).length;
                _clSnap.intimacyEvents = [];
                fs.writeFileSync(_clPath, JSON.stringify(_clSnap), 'utf8');
                this.log.info('[OC-SEX] clearIntimacyEventsForDay(' + _clDate + '): ' + _clPrev + ' Events geloescht');
                this.sendTo(obj.from, obj.command, { success: true, cleared: true, prevCount: _clPrev }, obj.callback);
            } catch(_clE) {
                this.log.warn('[OC-SEX] clearIntimacyEventsForDay Fehler: ' + _clE.message);
                this.sendTo(obj.from, obj.command, { success: false, error: _clE.message }, obj.callback);
            }
        }
        // removeSingleIntimacyEvent: Entfernt EINE Session per Start-Timestamp (Session-Level Nullnummer)
        else if (obj.command === 'removeSingleIntimacyEvent') {
            try {
                var _rsDate = obj.message && obj.message.date;
                var _rsStartMs = obj.message && Number(obj.message.startMs);
                if (!_rsDate || !/^\d{4}-\d{2}-\d{2}$/.test(_rsDate) || !_rsStartMs) {
                    this.sendTo(obj.from, obj.command, { success: false, error: 'Kein gueltiges Datum oder startMs' }, obj.callback); return;
                }
                var _rsDir = path.join(utils.getAbsoluteDefaultDataDir(), 'cogni-living', 'history');
                var _rsPath = path.join(_rsDir, _rsDate + '.json');
                if (!fs.existsSync(_rsPath)) {
                    this.sendTo(obj.from, obj.command, { success: true, removed: false, remaining: 0 }, obj.callback); return;
                }
                var _rsSnap = JSON.parse(fs.readFileSync(_rsPath, 'utf8'));
                var _rsPrev = (_rsSnap.intimacyEvents || []).length;
                _rsSnap.intimacyEvents = (_rsSnap.intimacyEvents || []).filter(function(e) {
                    return Math.abs((e.start || 0) - _rsStartMs) > 5 * 60 * 1000;
                });
                var _rsRemoved = _rsPrev - _rsSnap.intimacyEvents.length;
                fs.writeFileSync(_rsPath, JSON.stringify(_rsSnap), 'utf8');
                this.log.info('[OC-SEX] removeSingleIntimacyEvent('+_rsDate+' ~'+new Date(_rsStartMs).toTimeString().slice(0,8)+'): '+_rsRemoved+' entfernt, '+_rsSnap.intimacyEvents.length+' verbleibend');
                this.sendTo(obj.from, obj.command, { success: true, removed: _rsRemoved > 0, prevCount: _rsPrev, remaining: _rsSnap.intimacyEvents.length }, obj.callback);
            } catch(_rsE) {
                this.log.warn('[OC-SEX] removeSingleIntimacyEvent Fehler: ' + _rsE.message);
                this.sendTo(obj.from, obj.command, { success: false, error: _rsE.message }, obj.callback);
            }
        }
        }
    }

    runPythonHealthCheck() {
        if (!this.activeModules.health) return;
        this.log.debug('?? Triggering Python Health Check (Activity Trend)...');
        try {
            const rawEvents = this.rawEventLog || [];
            pythonBridge.send(this, 'CALCULATE_HEALTH_TREND', { events: rawEvents });
        } catch(e) { this.log.warn('Failed to trigger Python Health Check'); }
    }

    async onStateChange(id, state) {
        if (!state || this.dependencyInstallInProgress) return;
        if (id.includes('telegram') && id.endsWith('communicate.request') && state.val) return;

        if (this.config.infrasoundEnabled && id === this.config.infrasoundSensorId && this.activeModules.security) {
            this.handleInfrasound(state.val);
            return;
        }

        if (state.ack && id.endsWith('pulse')) return;

        if (id === `${this.namespace}.system.mode`) {
            if (state.val && Object.values(setup.SYSTEM_MODES).includes(state.val)) {
                this.currentSystemMode = state.val;
                if (state.val === setup.SYSTEM_MODES.VACATION) await recorder.setPresence(this, false);
                else await recorder.setPresence(this, true);

                if (this.isProVersion) {
                    let learnActive = false;
                    let learnDuration = 0;
                    let learnLabel = 'manual';
                    if (this.currentSystemMode === 'party') { learnActive = true; learnDuration = 360; learnLabel = 'Party Mode'; }
                    else if (this.currentSystemMode === 'guest') { learnActive = true; learnDuration = 1440; learnLabel = 'Guest Mode'; }
                    pythonBridge.send(this, 'SET_LEARNING_MODE', { active: learnActive, duration: learnDuration, label: learnLabel });
                    await this.setStateAsync('analysis.security.learningStatus', { val: JSON.stringify({ active: learnActive, label: learnLabel, timestamp: Date.now() }), ack: true });
                }
            }
            if (!state.ack) this.setState(id, { val: this.currentSystemMode, ack: true });
            return;
        }

        if (id.endsWith('analysis.energy.warmupSources') && state.ack) this.protectAiMemory(state.val);
        if (id.endsWith('analysis.energy.warmupTimes') && state.ack && this.activeModules.energy) automation.checkCalendarTriggers(this);

        if (!state.ack) {
            // WICHTIG: Spezifische Trigger VOR dem generischen 'analysis.trigger' pr?fen,
            // da 'analysis.triggerBriefing' sonst von der generischen Bedingung abgefangen wird.
            if (id.includes('triggerBriefing') && state.val && !id.includes('Weekly')) { this.setState(id, { val: false, ack: true }); aiAgent.sendMorningBriefing(this); return; }
            if (id.includes('triggerWeeklyBriefing') && state.val) { this.setState(id, { val: false, ack: true }); aiAgent.sendWeeklyBriefing(this); return; }
            if (id.includes('triggerDailyDigest') && state.val) { this.setState(id, { val: false, ack: true }); if (this.isProVersion) aiAgent.createDailyDigest(this, pythonBridge); return; }
            if (id.includes('analysis.trigger') && state.val) { this.setState(id, { val: false, ack: true }); aiAgent.runGeminiAnalysis(this); return; }
            if (id.includes('automation.triggerAction') && state.val) { this.setState(id, { val: false, ack: true }); aiAgent.executeAutomationAction(this); return; }
            if (id.includes('analysis.training.triggerSecurity') && state.val) { this.setState(id, { val: false, ack: true }); if (this.isProVersion) { try { const seqState = await this.getStateAsync('LTM.trainingData.sequences'); if (seqState && seqState.val) { const sequences = JSON.parse(seqState.val); this.setStateAsync('analysis.training.status', { val: 'Sec-Training started...', ack: true }); pythonBridge.send(this, 'TRAIN_SECURITY', { sequences }); } } catch(e) {} } return; }

            if (id.includes('analysis.training.triggerHealth') && state.val) {
                this.setState(id, { val: false, ack: true });
                try {
                    // Health Reports sind f?r alle verf?gbar (nicht nur Pro!)
                    aiAgent.generateHealthReport(this, 'NIGHT');
                    setTimeout(() => aiAgent.generateHealthReport(this, 'DAY'), 12000);
                    
                    // Training nur fuer Pro-Version
                    if (this.isProVersion) {
                        this.runPythonHealthCheck();
                        const s = await this.getStateAsync('LTM.dailyDigests');
                        if (s && s.val) {
                            const digests = JSON.parse(s.val);
                            pythonBridge.send(this, 'TRAIN_HEALTH', { digests });
                        }
                    }

                    // Disease-Score-Berechnung: nutzt numerische History-Dateien (nicht LTM AI-Digests!)
                    // Zuerst heutigen Snapshot sichern, damit er beim Laden verfuegbar ist
                    try { await this.saveDailyHistory(); } catch(e) {}
                    try {
                        const _dsDataDir = utils.getAbsoluteDefaultDataDir();
                        const _dsHistDir = path.join(_dsDataDir, 'cogni-living', 'history');
                        const _histDigests = [];
                        const _bathroomIds = new Set((this.config.devices || []).filter(function(d) { return d.isBathroomSensor || d.sensorFunction === 'bathroom'; }).map(function(d) { return d.id; }));
                        const _kitchenIds  = new Set((this.config.devices || []).filter(function(d) { return d.isKitchenSensor || d.sensorFunction === 'kitchen'; }).map(function(d) { return d.id; }));
                        for (let _di = 0; _di <= 59; _di++) {
                            const _dObj = new Date(); _dObj.setDate(_dObj.getDate() - _di);
                            const _dStr = _dObj.toISOString().slice(0, 10);
                            const _fp = path.join(_dsHistDir, (_dStr + '.json'));
                            if (fs.existsSync(_fp)) {
                                try {
                                    const _h = JSON.parse(fs.readFileSync(_fp, 'utf8'));
                                    const _vec = _h.todayVector || [];
                                    const _actSum = _vec.reduce(function(a, b) { return a + b; }, 0);
                                    const _nightEv = Array.isArray(_h.eventHistory)
                                        ? _h.eventHistory.filter(function(e) { const hr = new Date(e.timestamp||e.ts||0).getHours(); return hr >= 22 || hr < 6; }).length
                                        : (_h.nightMotionCount || 0);
                                    const _rooms = Object.keys(_h.todayRoomMinutes || {}).filter(function(k) { return (_h.todayRoomMinutes[k]||0) > 0; }).length || 1;
                                    const _bathArr = Array.isArray(_h.eventHistory) ? _h.eventHistory.filter(function(e) { return e.isBathroomSensor; }).map(function(e) { return Math.floor((e.timestamp||e.ts||0) / 3600000); }) : [];
                                    const _bathSet = new Set(_bathArr);
                                    // Fallback fuer nocturiaCount aus alten History-Dateien ohne Flag
                                    var _nocturiaVal = _h.nocturiaCount;
                                    if (_nocturiaVal === undefined && Array.isArray(_h.eventHistory)) {
                                        var _nightBathHours = new Set(_h.eventHistory.filter(function(e) {
                                            if (!e.isBathroomSensor && !_bathroomIds.has(e.id)) return false;
                                            var hr = new Date(e.timestamp || e.ts || 0).getHours();
                                            return hr >= 22 || hr < 6;
                                        }).map(function(e) { return new Date(e.timestamp || e.ts || 0).getHours(); }));
                                        _nocturiaVal = _nightBathHours.size;
                                    }
                                    var _kitchenVal = _h.kitchenVisits;
                                    if (_kitchenVal === undefined && Array.isArray(_h.eventHistory)) {
                                        var _kitchenHrs = new Set(_h.eventHistory.filter(function(e) {
                                            return e.isKitchenSensor || _kitchenIds.has(e.id);
                                        }).map(function(e) { return new Date(e.timestamp || e.ts || 0).getHours(); }));
                                        _kitchenVal = _kitchenHrs.size;
                                    }
                                    _histDigests.push({
                                        date: _dStr,
                                        activityPercent: _actSum,
                                        gaitSpeed: _h.gaitSpeed || 0,
                                        nightEvents: _nightEv,
                                        uniqueRooms: _rooms,
                                        bathroomVisits: _bathSet.size,
                                        nocturiaCount: _nocturiaVal || 0,
                                        kitchenVisits: _kitchenVal || 0,
                                        maxPersonsDetected: _h.maxPersonsDetected || 0,
                                        bedPresenceMinutes: _h.bedPresenceMinutes || 0,
                                        nightVibrationCount: _h.nightVibrationCount || 0
                                    });
                                } catch(e) {}
                            }
                        }
                        _histDigests.sort(function(a, b) { return a.date.localeCompare(b.date); });
                        this.log.info('[DiseaseScore] History-Tage geladen: ' + _histDigests.length);
                        // Aktivierte Profile aus Config lesen (dynamisch, nicht hardcoded)
                        const _allProfiles = ['fallRisk','dementia','frailty','depression','diabetes2','sleepDisorder','cardiovascular','parkinson','copd','socialIsolation','epilepsy','diabetes1','longCovid','bipolar'];
                        const _healthProfiles = this.config.healthProfiles || {};
                        const _enabledProfiles = _allProfiles.filter(function(p) { return _healthProfiles[p] && _healthProfiles[p].enabled; });
                        // Fallback: Wenn keine Profile aktiviert, trotzdem Basis-Profile berechnen
                        const _activeProfiles = _enabledProfiles.length > 0 ? _enabledProfiles : ['fallRisk', 'dementia', 'frailty'];
                        if (_histDigests.length >= 5) {
                            pythonBridge.send(this, 'ANALYZE_DISEASE_SCORES', { digests: _histDigests, enabledProfiles: _activeProfiles }, (result) => {
                                if (!result || !result.payload || result.payload.error) { this.log.warn('[DiseaseScore] Fehler: ' + JSON.stringify(result)); return; }
                                const scores = result.payload;
                                this.setStateAsync('analysis.health.disease.scores', { val: JSON.stringify(scores), ack: true }).catch(() => {});
                                for (const [p, d] of Object.entries(scores)) {
                                    if (d && d.score !== null && d.score !== undefined) this.setStateAsync('analysis.health.disease.' + p, { val: d.score, ack: true }).catch(() => {});
                                }
                                this.log.info('[DiseaseScore] Gespeichert: ' + Object.keys(scores).map(function(k) { return k + '=' + (scores[k] && scores[k].score); }).join(', '));
                                // Phase 3: Proaktives Screening direkt nach Disease-Scores
                                pythonBridge.send(this, 'ANALYZE_SCREENING', { digests: _histDigests }, (screenResult) => {
                                    if (!screenResult || !screenResult.payload) { this.log.warn('[Screening] Kein Ergebnis'); return; }
                                    this.setStateAsync('analysis.health.screening.hints', { val: JSON.stringify(screenResult.payload), ack: true }).catch(() => {});
                                    const hints = (screenResult.payload.hints || []);
                                    this.log.info('[Screening] ' + hints.length + ' Hinweis(e): ' + hints.map(function(h) { return h.disease + '(' + Math.round(h.confidence * 100) + '%)'; }).join(', '));
                                });
                            });
                        } else {
                            const _insuf = {};
                            for (const _p of _activeProfiles) {
                                _insuf[_p] = { score: null, level: 'INSUFFICIENT_DATA', dataPoints: _histDigests.length, message: _histDigests.length + '/5 Tage Datenbasis. Taeglich waechst die Basis.' };
                            }
                            this.setStateAsync('analysis.health.disease.scores', { val: JSON.stringify(_insuf), ack: true }).catch(() => {});
                            this.log.info('[DiseaseScore] Zu wenig Tage: ' + _histDigests.length + '/5');
                        }
                    } catch(dsErr) { this.log.warn('[DiseaseScore] Fehler: ' + dsErr.message); }

                    // History-Snapshot nach Analyse aktualisieren (damit PWA/Charts frische Daten sehen)
                    // Nach ~30s (NIGHT 0s + DAY 12s + Gemini ~10s + Puffer) ist alles fertig ? PWA-Polling informieren
                    setTimeout(() => {
                        this.saveDailyHistory().catch(e => {});
                        pwaServer.markAnalysisDone();
                    }, 30000);
                } catch(e) {
                    this.log.warn(`triggerHealth error: ${e.message}`);
                }
                return;
            }

            if (id.includes('analysis.training.triggerEnergy') && state.val) {
                this.setState(id, { val: false, ack: true });
                // Trigger Energy Prediction (PINN + Warmup + Ventilation)
                await this.triggerEnergyPrediction();
                return;
            }
            if (id.includes('analysis.training.triggerComfort') && state.val) {
                this.setState(id, { val: false, ack: true });
                if (this.isProVersion) {
                    try {
                        const s = await this.getStateAsync('LTM.rawEventLog');
                        if(s && s.val) {
                            const deviceMap = {};
                        if (this.config.devices) this.config.devices.forEach(d => { if (d.id && d.type) deviceMap[d.id] = d.type; });
                            pythonBridge.send(this, 'TRAIN_COMFORT', { events: JSON.parse(s.val), deviceMap: deviceMap });
                        }
                    } catch(e){}
                }
                return;
            }
            if (id.includes('analysis.training.triggerTopology') && state.val) {
                this.setState(id, { val: false, ack: true });
                topology.updateTopology(this);
                if (this.isProVersion) {
                    try {
                        const seqState = await this.getStateAsync('LTM.trainingData.sequences');
                        if (seqState && seqState.val) pythonBridge.send(this, 'TRAIN_TOPOLOGY', { sequences: JSON.parse(seqState.val) });
                    } catch(e) {}
                }
                return;
            }
        }

        const dev = (this.config.devices || []).find(d => d.id === id);
        if (dev) {
            const evt = await recorder.processSensorEvent(this, id, state, dev);
            if (evt) {
                this.setState('analysis.visualization.pulse', { val: Date.now(), ack: true });
            }
            if (evt && (evt.type === 'motion' || evt.type === 'presence_radar_bool' || evt.type === 'door') && evt.location && this.isProVersion) {
                deadMan.updateLocation(this, evt.location);
            }
            if (isActiveValue(state.val)) {
                if (dev.type && (dev.type === 'window' || dev.type === 'door' || dev.type === 'fenster' || dev.type === 'tur' || dev.type === 'contact' || dev.type === 'kontakt')) {
                    this.analyzeWindowOpening(dev);
                }
            }
            if (dev.type === 'temperature' || dev.type === 'thermostat') {
                if (this.activeModules.energy) automation.cleanupGhostInterventions(this);
            }
            // Raeumliche Unmoeglichkeits-Heuristik: nur steigende Flanken person-relevanter Sensoren
            // isPersonPresenceActivity = strikte Whitelist: Bewegung, Praesenz, Vibration, Tuer/Fenster
            if (dev.location && recorder.isPersonPresenceActivity(dev.type, state.val)) {
                if (!this.sensorLastActive) this.sensorLastActive = {};
                this.sensorLastActive[id] = Date.now();
                var _sLog = { ts: Date.now(), sensorId: id, sensorName: dev.name || id, room: dev.location, type: dev.type };
                this.setStateAsync('system.personCount.sensorActivity', { val: JSON.stringify(_sLog), ack: true }).catch(function(){});
                this._checkSpatialImpossibility(id, dev.location);
            }
        }
    }

    // BFS: k?rzester Pfad in Hops zwischen zwei R?umen (?ber Topologie-Matrix)
    _roomHopDistance(roomA, roomB) {
        if (roomA === roomB) return 0;
        var topo = this._cachedTopoMatrix;
        if (!topo || !topo.rooms || !topo.matrix) return -1;
        var rooms = topo.rooms;
        var matrix = topo.matrix;
        var idxA = rooms.indexOf(roomA);
        var idxB = rooms.indexOf(roomB);
        if (idxA < 0 || idxB < 0) return -1;
        var visited = {};
        visited[idxA] = true;
        var queue = [[idxA, 0]];
        while (queue.length > 0) {
            var item = queue.shift();
            var curr = item[0]; var dist = item[1];
            for (var i = 0; i < rooms.length; i++) {
                if (!visited[i] && matrix[curr] && matrix[curr][i] > 0) {
                    if (i === idxB) return dist + 1;
                    visited[i] = true;
                    queue.push([i, dist + 1]);
                }
            }
        }
        return -1; // keine Verbindung gefunden
    }

    _checkSpatialImpossibility(triggerId, triggerLocation) {
        // Topologie asynchron laden beim ersten Aufruf
        if (!this._cachedTopoMatrix) {
            this.getStateAsync('analysis.topology.structure').then((s) => {
                if (s && s.val) { try { this._cachedTopoMatrix = JSON.parse(s.val); } catch(e) {} }
            }).catch(function(){});
            return;
        }
        var topo = this._cachedTopoMatrix;
        if (!topo || !topo.rooms || !topo.matrix) return;

        // Festes 5s-Fenster auf steigende Flanken (sensorLastActive) ? kein fallendes Flanken-Problem
        var ACTIVE_WINDOW_MS = 5000;
        // Mindestens 2 Hops: in 5s physikalisch unm?glich f?r eine Person
        var MIN_HOPS = 2;
        var now = Date.now();
        var _self = this;
        var devicesById = {};
        (this.config.devices || []).forEach(function(d) { if (d.id) devicesById[d.id] = d; });

        var multiPersonDetected = false;
        var bestMatch = null; // bester Treffer fuer Log (meiste Hops)
        Object.keys(this.sensorLastActive || {}).forEach(function(otherId) {
            if (otherId === triggerId) return;
            var lastActiveTs = _self.sensorLastActive[otherId];
            if (!lastActiveTs || (now - lastActiveTs) > ACTIVE_WINDOW_MS) return;
            var otherDev = devicesById[otherId];
            if (!otherDev || !otherDev.location || otherDev.location === triggerLocation) return;
            var hopDist = _self._roomHopDistance(triggerLocation, otherDev.location);
            if (hopDist >= MIN_HOPS) {
                multiPersonDetected = true;
                var deltaMs = Math.round(now - lastActiveTs);
                _self.log.info('[PersonCount] Rauml. Unmoglichkeit: ' + triggerLocation + ' <-> ' + otherDev.location +
                    ' (' + hopDist + ' Hops, ' + deltaMs + 'ms) -> mind. 2 Personen');
                // Besten Treffer merken (meiste Hops = zuverlaessigste Erkennung)
                if (!bestMatch || hopDist > bestMatch.hops) {
                    var triggerDev = devicesById[triggerId];
                    bestMatch = {
                        ts:                now,
                        triggerSensorId:   triggerId,
                        triggerSensorName: triggerDev ? (triggerDev.name || triggerId) : triggerId,
                        triggerRoom:       triggerLocation,
                        otherSensorId:     otherId,
                        otherSensorName:   otherDev.name || otherId,
                        otherRoom:         otherDev.location,
                        hops:              hopDist,
                        deltaMs:           deltaMs
                    };
                }
            }
        });

        if (multiPersonDetected && bestMatch) {
            var prevCount = this._livePersonCount || 1;
            bestMatch.personCountBefore = prevCount;
            bestMatch.personCountAfter  = 2;
            // State schreiben -> SQL-Adapter loggt jeden Wert-Wechsel automatisch
            this.setStateAsync('system.personCount.heuristicDetection', { val: JSON.stringify(bestMatch), ack: true }).catch(function(){});

            if (prevCount < 2) {
                this._livePersonCount = 2;
                if (!this._maxPersonsToday || this._maxPersonsToday < 2) this._maxPersonsToday = 2;
                this.setStateAsync('system.currentPersonCount', { val: 2, ack: true }).catch(function(){});
                this.setStateAsync('system.householdType', { val: 'multi', ack: true }).catch(function(){});
            }
            if (this._multiPersonResetTimer) clearTimeout(this._multiPersonResetTimer);
            var _cfg = this.config.householdSize || 'single';
            var _baseCount = _cfg === 'single' ? 1 : _cfg === 'couple' ? 2 : 3;
            var _baseHT = _baseCount >= 2 ? 'multi' : 'single';
            this._multiPersonResetTimer = setTimeout(function() {
                _self._livePersonCount = _baseCount;
                _self.setStateAsync('system.currentPersonCount', { val: _baseCount, ack: true }).catch(function(){});
                _self.setStateAsync('system.householdType', { val: _baseHT, ack: true }).catch(function(){});
                _self.log.info('[PersonCount] Reset auf Config-Baseline: ' + _cfg);
            }, 60 * 60 * 1000); // 1 Stunde
        }
    }

    async protectAiMemory(newSourcesJson) {
        if (!this.memoryCache || (Date.now() - this.bootTime > 300000)) return;
        try {
            const newSources = JSON.parse(newSourcesJson);
            const oldSources = this.memoryCache.sources;
            let restoreNeeded = false;
            for (const room in oldSources) {
                if (oldSources[room].includes('AI') && newSources[room] && !newSources[room].includes('AI')) { restoreNeeded = true; break; }
            }
            if (restoreNeeded) {
                await this.setStateAsync('analysis.energy.warmupTimes', { val: JSON.stringify(this.memoryCache.times), ack: true });
                await this.setStateAsync('analysis.energy.warmupSources', { val: JSON.stringify(this.memoryCache.sources), ack: true });
            }
        } catch(e) {}
    }

    async loadSystemMode() { try { const state = await this.getStateAsync(setup.SYSTEM_DP_MODE); if (state && state.val) this.currentSystemMode = state.val; } catch (e) { this.currentSystemMode = setup.SYSTEM_MODES.NORMAL; } }
    async checkWifiPresence() {
        const presenceDevices = this.config.presenceDevices || [];
        if (presenceDevices.length === 0) return false;

        const presentPeople = [];
        const now = Date.now();
        const TIMEOUT_MS = 5 * 60 * 1000; // 5 Minuten

        for (const deviceId of presenceDevices) {
            try {
                // Versuche verschiedene States zu finden: isOnline, last_seen, uptime, etc.
                let isOnline = false;
                
                // 1. Pr?fe isOnline State
                try {
                    const onlineState = await this.getForeignStateAsync(`${deviceId}.isOnline`);
                    if (onlineState && onlineState.val === true) isOnline = true;
                } catch(e) {}

                // 2. Pr?fe last_seen Timestamp (falls vorhanden)
                if (!isOnline) {
                    try {
                        const lastSeenState = await this.getForeignStateAsync(`${deviceId}.last_seen`);
                        if (lastSeenState && lastSeenState.ts) {
                            const diffMs = now - lastSeenState.ts;
                            if (diffMs < TIMEOUT_MS) isOnline = true;
                        }
                    } catch(e) {}
                }

                // 3. Pr?fe uptime (falls vorhanden)
                if (!isOnline) {
                    try {
                        const uptimeState = await this.getForeignStateAsync(`${deviceId}.uptime`);
                        if (uptimeState && typeof uptimeState.val === 'number' && uptimeState.val > 0) isOnline = true;
                    } catch(e) {}
                }

                // 4. Fallback: Pr?fe State selbst (manche Adapter haben nur den Hauptstate)
                if (!isOnline) {
                    try {
                        const mainState = await this.getForeignStateAsync(deviceId);
                        if (mainState) {
                            // Pr?fe Timestamp des States
                            const diffMs = now - (mainState.ts || 0);
                            if (diffMs < TIMEOUT_MS && (mainState.val === true || mainState.val === 'online' || mainState.val === 1)) {
                                isOnline = true;
                            }
                        }
                    } catch(e) {}
                }

                if (isOnline) {
                    // Extrahiere Namen aus Device-ID (z.B. "alias.0.Smartphone.Marc" -> "Marc")
                    const parts = deviceId.split('.');
                    const name = parts[parts.length - 1] || deviceId;
                    presentPeople.push(name);
                }
            } catch(e) {
                this.log.warn(`checkWifiPresence: Error checking ${deviceId}: ${e.message}`);
            }
        }

        // Aktualisiere presenceWho State
        const presenceWho = presentPeople.length > 0 ? presentPeople.join(', ') : 'Niemand';
        await this.setStateAsync('system.presenceWho', { val: presenceWho, ack: true });

        return presentPeople.length > 0;
    }
    async runAutopilot() { await aiAgent.runGeminiAnalysis(this); if(this.activeModules.health) { this.updateHealthVector(); this.triggerGaitAnalysis(); } if(this.activeModules.energy) this.triggerEnergyPrediction(); }
    async checkSolarCondition() {
        // Pr?ft verschiedene Wetter-Adapter auf sonniges Wetter
        const weatherAdapters = ['weatherunderground.0', 'accuweather.0', 'daswetter.0'];
        const weatherPaths = ['forecast.current.weather', 'Current.WeatherText', 'NextHours.Location_1.Day_1.current.symbol_desc'];
        
        for (const adapter of weatherAdapters) {
            for (const path of weatherPaths) {
                try {
                    const stateId = `${adapter}.${path}`;
                    const state = await this.getForeignStateAsync(stateId);
                    if (state && state.val) {
                        const text = String(state.val).toLowerCase();
                        // Pr?fe auf sonnige Keywords (DE + EN)
                        if (text.includes('sunny') || text.includes('heiter') || 
                            text.includes('klar') || text.includes('sonn') || 
                            text.includes('clear')) {
                            this.log.debug(`?? Solar Condition: SUNNY detected via ${stateId}`);
                            return true;
                        }
                    }
                } catch(e) {
                    // Adapter nicht vorhanden - weiter versuchen
                }
            }
        }
        return false;
    }
    triggerGaitAnalysis() {
        if (!this.isProVersion) return;
        
        // Ganganalyse basierend auf Motion-Sensor-Sequenzen
        try {
            this.getStateAsync('LTM.trainingData.sequences', (err, state) => {
                if (err || !state || !state.val) return;
                
                try {
                    const sequences = JSON.parse(state.val);
                    if (!sequences || sequences.length === 0) return;
                    
                    // Sende Sequenzen an Python f?r Ganganalyse
                    pythonBridge.send(this, 'ANALYZE_GAIT', { sequences });
                    
                    this.log.debug(`?? Gait Analysis triggered with ${sequences.length} sequences`);
                } catch(e) {
                    this.log.warn(`triggerGaitAnalysis parse error: ${e.message}`);
                }
            });
        } catch(e) {
            this.log.warn(`triggerGaitAnalysis error: ${e.message}`);
        }
    }
    async triggerEnergyPrediction() {
        if (!this.isProVersion || !this.activeModules.energy) return;
        try {
            // Sammle aktuelle Temperaturen
            const current_temps = {};
            const solar_flags = {};
            const devices = this.config.devices || [];
            
            for (const dev of devices) {
                if ((dev.type === 'temperature' || dev.type === 'thermostat') && dev.location) {
                    try {
                        const state = await this.getForeignStateAsync(dev.id);
                        if (state && typeof state.val === 'number') {
                            current_temps[dev.location] = state.val;
                            solar_flags[dev.location] = dev.isSolar || false;
                        }
                    } catch(e) {}
                }
            }

            // Au?entemperatur (falls vorhanden)
            let t_out = 10.0;
            if (this.config.weatherTempId) {
                try {
                    const wState = await this.getForeignStateAsync(this.config.weatherTempId);
                    if (wState && typeof wState.val === 'number') t_out = wState.val;
                } catch(e) {}
            }

            const is_sunny = await this.checkSolarCondition();

            // Warmup-Ziele laden
            let warmup_targets = {};
            try {
                const wt = await this.getStateAsync('analysis.energy.warmupTargets');
                if (wt && wt.val) warmup_targets = JSON.parse(wt.val);
            } catch(e) {}

            pythonBridge.send(this, 'PREDICT_ENERGY', {
                current_temps,
                t_out,
                is_sunny,
                solar_flags,
                warmup_targets
            });
            
            this.log.info(`?? Energy Prediction triggered (${Object.keys(current_temps).length} rooms)`);
        } catch(e) {
            this.log.warn(`triggerEnergyPrediction Error: ${e.message}`);
        }
    }
    updateHealthVector() {
        // Berechnet den 48-Slot Activity Vector f?r heute (00:00-23:59, 30-Min-Slots)
        if (!this.rawEventLog || this.rawEventLog.length === 0) return;

        const todayVector = new Array(48).fill(0);
        const todayDetails = Array.from({ length: 48 }, () => []);
        const todayStart = new Date().setHours(0, 0, 0, 0);

        // Z?hle Events pro 30-Min-Slot
        this.rawEventLog.forEach(entry => {
            const eventTime = new Date(entry.timestamp);
            if (eventTime.getTime() >= todayStart) {
                const hour = eventTime.getHours();
                const minute = eventTime.getMinutes();
                const slotIndex = hour * 2 + Math.floor(minute / 30);
                
                if (slotIndex >= 0 && slotIndex < 48) {
                    todayVector[slotIndex]++;
                    todayDetails[slotIndex].push({
                        time: eventTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
                        location: entry.location || 'Unbekannt',
                        type: entry.type || 'Event'
                    });
                }
            }
        });

        // Setze States
        this.setStateAsync('analysis.health.todayVector', { 
            val: JSON.stringify(todayVector), 
            ack: true 
        });
        
        this.setStateAsync('analysis.health.todayRoomDetails', { 
            val: JSON.stringify(todayDetails), 
            ack: true 
        });
    }
    async handleInfrasound(value) {
        // Verarbeitet Infraschall-Sensor-Daten f?r Anomalie-Erkennung
        if (!this.config.infrasoundEnabled || typeof value !== 'number') return;
        
        const threshold = this.config.infrasoundThreshold || 0.04;
        
        // F?ge Wert zum Buffer hinzu (f?r Korrelation mit Events)
        this.pressureBuffer.push({
            timestamp: Date.now(),
            value: value
        });
        
        // Halte Buffer klein (letzte 100 Werte = ca. 5-10 Minuten bei 5s Polling)
        if (this.pressureBuffer.length > 100) {
            this.pressureBuffer.shift();
        }
        
        // Pr?fe auf Schwellwert-?berschreitung (potenzielle Anomalie)
        if (value > threshold && !this.infrasoundLocked) {
            this.infrasoundLocked = true;
            this.log.warn(`?? Infraschall-Alarm: ${value.toFixed(4)} > ${threshold} (Threshold)`);
            
            // Trigger Korrelation mit letzten Events
            await this.triggerInfrasoundCorrelation(value, 'threshold_exceeded');
            
            // Lock f?r 5 Minuten (Spam-Schutz)
            setTimeout(() => {
                this.infrasoundLocked = false;
            }, 5 * 60 * 1000);
        }
    }
    async triggerInfrasoundCorrelation(pressure, eventType) {
        // Korreliert Infraschall-Anomalie mit letzten Events (forensische Analyse)
        if (!this.isPresent) {
            // Nur wenn niemand zuhause ist ? potenzielle Sicherheits-Anomalie!
            const recentEvents = this.eventHistory.slice(0, 10);
            const eventLog = recentEvents.map(e => 
                `${new Date(e.timestamp).toLocaleTimeString('de-DE')} - ${e.location || 'Unknown'}: ${e.name}`
            ).join('\n');
            
            this.log.warn(`?? FORENSIC: Infraschall bei Abwesenheit! Pressure: ${pressure.toFixed(4)}, Events:\n${eventLog}`);
            
            // Optional: Sende Benachrichtigung (nur bei Abwesenheit!)
            if (this.config.infrasoundArmingId) {
                try {
                    const armState = await this.getForeignStateAsync(this.config.infrasoundArmingId);
                    if (armState && armState.val === true) {
                        // System ist "scharf" ? Alarm!
                        await this.setStateAsync('analysis.safety.infrasoundAlert', {
                            val: JSON.stringify({
                                timestamp: Date.now(),
                                pressure: pressure.toFixed(4),
                                eventType: eventType,
                                recentEvents: recentEvents.slice(0, 3)
                            }),
                            ack: true
                        });
                        
                        this.log.error(`?? INFRASCHALL-ALARM: Anomalie bei Abwesenheit (scharf)!`);
                    }
                } catch(e) {}
            }
        } else {
            // Bei Anwesenheit nur Debug-Log
            this.log.debug(`?? Infraschall: ${pressure.toFixed(4)} (Bewohner anwesend - normal)`);
        }
    }
    async analyzeWindowOpening(device) {
        // Analysiert Fenster-/T?r?ffnungen f?r L?ftungsempfehlungen
        if (!device || !device.location) return;

        try {
            // Hole aktuelle Raumtemperatur
            const tempDevices = (this.config.devices || []).filter(d => 
                d.location === device.location && (d.type === 'temperature' || d.type === 'thermostat')
            );
            
            if (tempDevices.length === 0) return;
            
            const tempState = await this.getForeignStateAsync(tempDevices[0].id);
            if (!tempState || typeof tempState.val !== 'number') return;
            
            const roomTemp = tempState.val;
            
            // Hole Au?entemperatur
            let outsideTemp = null;
            if (this.config.weatherTempId) {
                const outState = await this.getForeignStateAsync(this.config.weatherTempId);
                if (outState && typeof outState.val === 'number') {
                    outsideTemp = outState.val;
                }
            }
            
            // Einfache L?ftungslogik: Wenn Au?entemperatur verf?gbar
            if (outsideTemp !== null) {
                const tempDiff = Math.abs(roomTemp - outsideTemp);
                
                // Empfehlung: L?ften wenn Temperatur-Differenz > 3?C
                if (tempDiff > 3.0) {
                    this.log.debug(`?? L?ftung in ${device.location}: Temp-Differenz ${tempDiff.toFixed(1)}?C (Innen: ${roomTemp}?C, Au?en: ${outsideTemp}?C)`);
                    
                    // Optional: State setzen f?r Benachrichtigungen
                    await this.setStateAsync('analysis.ventilation.lastWindow', {
                        val: JSON.stringify({
                            room: device.location,
                            timestamp: Date.now(),
                            tempDiff: tempDiff.toFixed(1),
                            recommendation: tempDiff > 5 ? 'Gute L?ftungsm?glichkeit!' : 'L?ften empfohlen'
                        }),
                        ack: true
                    });
                }
            }
        } catch(e) {
            this.log.warn(`analyzeWindowOpening error: ${e.message}`);
        }
    }
    async appendToLog(entry) {
        // F?gt einen Eintrag zum Event-Log hinzu (f?r manuelle Events oder externe Systeme)
        if (!entry || typeof entry !== 'object') return;
        
        const logEntry = {
            timestamp: entry.timestamp || Date.now(),
            id: entry.id || Date.now().toString(),
            name: entry.name || 'Manual Event',
            type: entry.type || 'custom',
            location: entry.location || 'Unknown',
            value: entry.value || null
        };
        
        this.eventHistory.unshift(logEntry);
        if (this.eventHistory.length > 5000) this.eventHistory.pop();
        
        // Persistiere Event History
        await this.setStateAsync('events.history', { 
            val: JSON.stringify(this.eventHistory), 
            ack: true 
        });
        
        this.log.debug(`?? Manual event logged: ${logEntry.name} (${logEntry.location})`);
    }
    sendNotification(message) { /* ... */ }
}

if (require.main !== module) module.exports = (options) => new CogniLiving(options);
else new CogniLiving();















