import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Button, Divider, Dialog, DialogTitle, DialogContent, DialogActions,
    Typography, IconButton, Tooltip as MuiTooltip
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import LongtermTrendsView from './LongtermTrendsView';

// Version: 0.30.46 (Garmin-Style Langzeit-Trends + bestehende Features)

const RenderBlockBar = ({ val, max, color = '#00e676', height = '14px', themeType = 'dark' }: { val: number, max: number, color?: string, height?: string, themeType?: string }) => {
    const percent = Math.min(100, Math.max(0, (val / max) * 100));
    const isDark = themeType === 'dark';
    const bgColor = isDark ? '#333333' : '#e0e0e0';

    return (
        <div style={{ width: '100%', height: height, backgroundColor: bgColor, position: 'relative', borderRadius:'2px', overflow:'hidden' }}>
            <div style={{
                width: `${percent}%`,
                height: '100%',
                backgroundColor: color,
                transition: 'width 0.5s ease'
            }} />
        </div>
    );
};

const normalizeRoomName = (name: string) => {
    if (!name) return 'UNBEKANNT';
    let clean = name.toLowerCase();
    clean = clean.replace(/_/g, ' ');
    clean = clean.replace(/ae/g, 'ä').replace(/ue/g, 'ü').replace(/oe/g, 'ö');
    return clean.toUpperCase();
};

// Flexible Raum-Kategorisierung (mehrsprachig)
const getRoomCategory = (locationOrName: string): 'BATHROOM' | 'BEDROOM' | 'KITCHEN' | 'OTHER' => {
    if (!locationOrName) return 'OTHER';
    const lower = locationOrName.toLowerCase();
    
    // Bad/WC Keywords (Deutsch, Englisch)
    if (['bad', 'wc', 'toilette', 'bathroom', 'toilet', 'bath'].some(k => lower.includes(k))) {
        return 'BATHROOM';
    }
    
    // Schlafzimmer Keywords
    if (['schlaf', 'bedroom', 'sleep', 'bett', 'bed'].some(k => lower.includes(k))) {
        return 'BEDROOM';
    }
    
    // Küche Keywords
    if (['küche', 'kueche', 'kitchen', 'koche'].some(k => lower.includes(k))) {
        return 'KITCHEN';
    }
    
    return 'OTHER';
};

const TerminalBox = ({ title, children, themeType, height = 'auto', helpText, style }: { title: string, children: React.ReactNode, themeType: string, height?: string, helpText?: string, style?: React.CSSProperties }) => {
    const isDark = themeType === 'dark';
    const borderColor = isDark ? '#444' : '#bbb';
    const bgColor = isDark ? '#0a0a0a' : '#ffffff';
    const textColor = isDark ? '#eee' : '#111';
    const titleColor = isDark ? '#888' : '#666';

    return (
        <div style={{
            border: `1px solid ${borderColor}`,
            backgroundColor: bgColor,
            color: textColor,
            fontFamily: "'Roboto Mono', 'Courier New', monospace",
            marginBottom: '20px',
            position: 'relative',
            boxShadow: isDark ? 'none' : '2px 2px 0px rgba(0,0,0,0.1)',
            height: height,
            display: 'flex',
            flexDirection: 'column',
            ...(style || {})
        }}>
            <div style={{
                backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0',
                borderBottom: `1px solid ${borderColor}`,
                padding: '4px 8px',
                color: titleColor,
                fontSize: '0.75rem',
                fontWeight: 'bold',
                letterSpacing: '1px',
                textTransform: 'uppercase'
            }}>
                [ {title} ]{helpText && (
                    <MuiTooltip title={<span style={{ fontSize: '0.75rem', lineHeight: 1.5, display: 'block', maxWidth: 280 }}>{helpText}</span>} placement="top" arrow>
                        <IconButton size="small" sx={{ p: 0, ml: 0.5, opacity: 0.4, '&:hover': { opacity: 1 }, verticalAlign: 'middle', color: titleColor }}>
                            <HelpOutlineIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                    </MuiTooltip>
                )}
            </div>
            <div style={{ padding: '12px', flexGrow: 1 }}>
                {children}
            </div>
        </div>
    );
};

export default function HealthTab(props: any) {
    const { socket, adapterName, instance, themeType } = props;
    const namespace = `${adapterName}.${instance}`;
    const isDark = themeType === 'dark';

    const [viewDate, setViewDate] = useState<Date>(new Date());
    const [isLive, setIsLive] = useState(true);
    const [hasData, setHasData] = useState(true);

    const [loading, setLoading] = useState(false);
    const [openDeepDive, setOpenDeepDive] = useState(false);

    // Wochenansicht States
    const [viewMode, setViewMode] = useState<'DAY' | 'WEEK' | 'MONTH'>('DAY');
    const [weekData, setWeekData] = useState<any[]>([]);
    const [weekAlerts, setWeekAlerts] = useState<{text: string, severity: 'warn' | 'info'}[]>([]);
    const [heatmapAnalysis, setHeatmapAnalysis] = useState<any>(null);
    const [roomAlerts, setRoomAlerts] = useState<any>(null);
    const [weekOffset, setWeekOffset] = useState<number>(0); // 0 = heute, -1 = vor 7 Tagen (WOCHE) bzw. 30 Tagen (MONAT)
    const [masterRooms, setMasterRooms] = useState<string[]>([]); // Master-Liste aus System-Tab

    const [anomalyScore, setAnomalyScore] = useState<number>(0.1);
    const [batteryLevel, setBatteryLevel] = useState<number>(85);
    const [activityTrend, setActivityTrend] = useState<number | null>(null);
    const [gaitTrend, setGaitTrend] = useState<number | null>(null);
    const [lastCheck, setLastCheck] = useState<any>('-');
    const [roomStats, setRoomStats] = useState<{today: Record<string, number>, yesterday: Record<string, number>}>({today:{}, yesterday:{}});

    const [geminiNight, setGeminiNight] = useState<string>('Warte auf Analyse...');
    const [geminiNightTs, setGeminiNightTs] = useState<number | null>(null);
    const [geminiDay, setGeminiDay] = useState<string>('Warte auf Analyse...');
    const [geminiDayTs, setGeminiDayTs] = useState<number | null>(null);
    const [aiMode, setAiMode] = useState<'SIMPLE' | 'NEURAL'>('SIMPLE');
    const [digestCount, setDigestCount] = useState<number>(0);
    const TRAINING_TARGET = 14;

    const [stressBuckets, setStressBuckets] = useState<number[]>(new Array(48).fill(0));
    const [yesterdayBuckets, setYesterdayBuckets] = useState<number[]>(new Array(48).fill(0));

    const [stressDetails, setStressDetails] = useState<string[][]>(new Array(48).fill([]));
    
    // NEUE STATES: Split für Schlafzimmer vs. Außerhalb (Nacht 22-08)
    const [sleepRoomNightBuckets, setSleepRoomNightBuckets] = useState<number[]>(new Array(48).fill(0));
    const [outsideNightBuckets, setOutsideNightBuckets] = useState<number[]>(new Array(48).fill(0));
    const [recentEvents, setRecentEvents] = useState<{name: string, time: string, ago: number}[]>([]);

    const [roomHistory, setRoomHistory] = useState<Record<string, number[]>>({});

    const [freshAirCount, setFreshAirCount] = useState(0);
    const [freshAirLongCount, setFreshAirLongCount] = useState(0);
    const [lastFreshAir, setLastFreshAir] = useState('-');
    const [meals, setMeals] = useState({ breakfast: false, lunch: false, dinner: false });
    const [badStatus, setBadStatus] = useState({ status: 'FREI', last: '-', duration: 0 });
    const [dmRoom, setDmRoom] = useState<string | null>(null);
    const [dmState, setDmState] = useState<string>('ok');
    const [dmIgnored, setDmIgnored] = useState<{ room: string, reason: string, timestamp: number } | null>(null);
    const [dmSmartSleep, setDmSmartSleep] = useState(false);
    const [dmNapProb, setDmNapProb] = useState<number>(0);
    const [driftStatus, setDriftStatus] = useState<string>('Unknown');
    const [driftDetails, setDriftDetails] = useState<string>('');
    const [auraSleepData, setAuraSleepData] = useState<any>(null);
    const [overridePanelOpen, setOverridePanelOpen] = useState(false);
    const [overrideLoading, setOverrideLoading] = useState(false);
    const [personOverridePanelOpen, setPersonOverridePanelOpen] = useState<string|null>(null);
    const [personOverrideLoading, setPersonOverrideLoading] = useState(false);
    const [personHistoryData, setPersonHistoryData] = useState<Record<string, any>>({});
    const [sensorBatteryStatus, setSensorBatteryStatus] = useState<{sensors: {id:string, level:number|null, isLow:boolean, isCritical:boolean, source:string}[]} | null>(null);
    const [nativeDevices, setNativeDevices] = useState<any[]>([]);
    const [topoData, setTopoData] = useState<{rooms:string[], matrix:number[][]} | null>(null);

    // MASTER-RAUMNAMEN aus System-Tab laden
    const loadMasterRooms = async () => {
        try {
            const obj = await socket.getObject(`system.adapter.${adapterName}.${instance}`);
            if (obj && obj.native && obj.native.devices) {
                const rooms = obj.native.devices
                    .map((d: any) => d.location)
                    .filter((loc: string) => loc && loc.trim().length > 0)
                    .map((loc: string) => loc.trim());
                // Unique Räume
                const uniqueRooms = Array.from(new Set(rooms));
                setMasterRooms(uniqueRooms);
                console.log('[MASTER ROOMS] Loaded from System Tab:', uniqueRooms);
                return uniqueRooms;
            }
        } catch (err) {
            console.error('[MASTER ROOMS] Load failed:', err);
        }
        return [];
    };
    
    // Normalisiere Raumnamen (entferne Unterstriche, matche gegen Master-Liste)
    const normalizeRoomName = (rawName: string, masterList: string[]): string => {
        if (!rawName) return rawName;
        const cleaned = rawName.replace(/_/g, ' ').trim();
        // Guard: Wenn masterList leer oder undefined, nur säubern
        if (!masterList || masterList.length === 0) return cleaned;
        // Exakter Match (case-insensitive)
        const match = masterList.find(r => r.toLowerCase() === cleaned.toLowerCase());
        return match || cleaned;
    };
    
    const loadHistory = (date: Date) => {
        setLoading(true);
        const dateStr = date.toISOString().split('T')[0];
        
        // Berechne Vortag für Schlaf-Radar (22:00-08:00)
        const prevDate = new Date(date);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevDateStr = prevDate.toISOString().split('T')[0];

        // Lade BEIDE History-Files (gestern + heute)
        Promise.all([
            socket.sendTo(adapterName + '.' + instance, 'getHistoryData', { date: dateStr, _t: Date.now() }),
            socket.sendTo(adapterName + '.' + instance, 'getHistoryData', { date: prevDateStr, _t: Date.now() })
        ])
            .then(([res, prevRes]: [any, any]) => {
                setLoading(false);
                if (res && res.success && res.data) {
                    setHasData(true);
                    const d = res.data;
                    const dPrev = (prevRes && prevRes.success && prevRes.data) ? prevRes.data : null;
                    if (d.roomHistory && d.roomHistory.history) setRoomHistory(d.roomHistory.history);
                    else if (d.roomHistory) setRoomHistory(d.roomHistory);

                    setAuraSleepData({ sleepScore: d.sleepScore ?? null, sleepScoreRaw: d.sleepScoreRaw ?? null, sleepScoreCal: d.sleepScoreCal ?? null, sleepScoreCalNights: d.sleepScoreCalNights ?? 0, sleepScoreCalStatus: d.sleepScoreCalStatus ?? 'uncalibrated', sleepStages: d.sleepStages ?? [], garminScore: d.garminScore ?? null, garminDeepMin: d.garminDeepMin ?? null, garminLightMin: d.garminLightMin ?? null, garminRemMin: d.garminRemMin ?? null, sleepWindowStart: d.sleepWindowStart ?? null, sleepWindowEnd: d.sleepWindowEnd ?? null, sleepWindowSource: d.sleepWindowSource ?? 'fixed', wakeSource: d.wakeSource ?? null, wakeConf: d.wakeConf ?? null, isNap: d.isNap ?? false, unusuallyLongSleep: d.unusuallyLongSleep ?? false, garminDataFresh: d.garminDataFresh ?? null, garminLastSyncAgeH: d.garminLastSyncAgeH ?? null, outsideBedEvents: d.outsideBedEvents ?? [], wakeConfirmed: d.wakeConfirmed ?? false, allWakeSources: d.allWakeSources ?? [], sleepStartSource: d.sleepStartSource ?? null, allSleepStartSources: d.allSleepStartSources ?? [], sleepDate: d.sleepDate ?? null, sleepStartOverridden: d.sleepStartOverridden ?? false, sleepStartOverrideSource: d.sleepStartOverrideSource ?? null, bedWasEmpty: d.bedWasEmpty ?? false });
                    setPersonHistoryData(d.personData && typeof d.personData === 'object' ? d.personData : {});
                    setGeminiNight(d.geminiNight || "Keine Daten");
                    setGeminiNightTs(d.geminiNightTs || null);
                    setGeminiDay(d.geminiDay || "Keine Daten");
                    setGeminiDayTs(d.geminiDayTs || null);
                    setAnomalyScore(d.anomalyScore != null ? d.anomalyScore : 0.1);
                    
                    // Berechne batteryLevel RELATIV zur Baseline (wie Wochenansicht!)
                    if (d.eventHistory && d.eventHistory.length > 0) {
                        // Prüfe ob Backend-Daten vorhanden (aus Wochenansicht)
                        const dayAnalysisData = heatmapAnalysis && heatmapAnalysis[dateStr];
                        
                        if (dayAnalysisData && dayAnalysisData.activity_percent) {
                            // Nutze Backend-Analyse (baseline-relativ!)
                            const avgActivity = dayAnalysisData.activity_percent.reduce((a: number, b: number) => a + b, 0) / 24;
                            setBatteryLevel(Math.round(avgActivity));
                        } else {
                            // Fallback: Alte Formel
                            const motionEventsDay = d.eventHistory.filter((e: any) => {
                                const isMotion = e.type === 'motion' || e.type === 'presence_radar_bool';
                                return isMotion && e.value === true;
                            }).length;
                            const calculatedBattery = Math.min(100, Math.max(20, Math.round(20 + (motionEventsDay / 12.5))));
                            setBatteryLevel(calculatedBattery);
                        }
                    } else {
                        setBatteryLevel(d.batteryLevel || 85);
                    }
                    
                    setFreshAirCount(d.freshAirCount || 0);
                    setFreshAirLongCount(d.freshAirLongCount || 0);

                    // MERGE TODAYVECTOR: Schlaf-Radar (22:00-08:00) braucht Daten von GESTERN + HEUTE
                    if (d.todayVector) {
                        setStressBuckets(d.todayVector);
                        
                        // Merge Schlaf-Radar (Slots 44-47 vom Vortag → 22:00-23:59)
                        if (dPrev && dPrev.todayVector) {
                            setYesterdayBuckets(dPrev.todayVector);
                        } else {
                            setYesterdayBuckets(new Array(48).fill(0));
                        }
                    } else {
                        setStressBuckets(new Array(48).fill(0));
                        setYesterdayBuckets(new Array(48).fill(0));
                    }

                    setStressDetails(new Array(48).fill([]));

                    setMeals({ breakfast: false, lunch: false, dinner: false });
                    setBadStatus({ status: 'ARCHIV', last: '-', duration: 0 });
                    setDmRoom(null);
                    setRecentEvents([]);

                    if (d.eventHistory) {
                        processEvents(d.eventHistory);
                        
                        // BERECHNE NIGHT-BUCKETS aus eventHistory (HEUTE + GESTERN)
                        const todaySleepBuckets = new Array(48).fill(0);
                        const todayOutsideBuckets = new Array(48).fill(0);
                        const yesterdaySleepBuckets = new Array(48).fill(0);
                        const yesterdayOutsideBuckets = new Array(48).fill(0);
                        
                        // Verarbeite HEUTIGE Events
                        d.eventHistory.forEach((e: any) => {
                            if (!e.timestamp) return;
                            const eventDate = new Date(e.timestamp);
                            const hour = eventDate.getHours();
                            const minute = eventDate.getMinutes();
                            const slotIdx = hour * 2 + (minute >= 30 ? 1 : 0);
                            const room = (e.location || e.name || '').toLowerCase();
                            const isBedroom = room.includes('schlaf');
                            
                            if (isBedroom) todaySleepBuckets[slotIdx]++;
                            else todayOutsideBuckets[slotIdx]++;
                        });
                        
                        // Verarbeite GESTRIGE Events (nur für 22:00-23:59)
                        if (dPrev && dPrev.eventHistory) {
                            dPrev.eventHistory.forEach((e: any) => {
                                if (!e.timestamp) return;
                                const eventDate = new Date(e.timestamp);
                                const hour = eventDate.getHours();
                                const minute = eventDate.getMinutes();
                                const slotIdx = hour * 2 + (minute >= 30 ? 1 : 0);
                                const room = (e.location || e.name || '').toLowerCase();
                                const isBedroom = room.includes('schlaf');
                                
                                if (isBedroom) yesterdaySleepBuckets[slotIdx]++;
                                else yesterdayOutsideBuckets[slotIdx]++;
                            });
                        }
                        
                        // MERGE: Kombiniere gestern (44-47) + heute (0-15) für Schlaf-Radar
                        // Für 22:00-23:59 (Slots 44-47): outsideBedEvents aus heutigem Snapshot als
                        // primäre Quelle nutzen — erfasst auch Events kurz vor Mitternacht (23:59:xx)
                        // die nach dem 23:59:59-Snapshot-Save entstehen könnten
                        const obeNightBuckets = new Array(48).fill(0);
                        if (d.outsideBedEvents && d.outsideBedEvents.length > 0) {
                            (d.outsideBedEvents as any[]).forEach((obe: any) => {
                                const s = new Date(obe.start);
                                const slotIdx = s.getHours() * 2 + (s.getMinutes() >= 30 ? 1 : 0);
                                if (slotIdx >= 44) obeNightBuckets[slotIdx]++; // nur 22:00-23:59
                            });
                        }
                        const mergedSleepBuckets = todaySleepBuckets.map((val, idx) => {
                            if (idx >= 44) return yesterdaySleepBuckets[idx]; // 22:00-23:59 vom VORTAG
                            return val; // Rest von HEUTE
                        });
                        const mergedOutsideBuckets = todayOutsideBuckets.map((val, idx) => {
                            if (idx >= 44) return Math.max(yesterdayOutsideBuckets[idx], obeNightBuckets[idx]);
                            return val;
                        });
                        
                        setSleepRoomNightBuckets(mergedSleepBuckets);
                        setOutsideNightBuckets(mergedOutsideBuckets);
                    }
                    
                    // Lebenszeichen-Alarm checken (nur für HEUTE)
                    if (isLive && d.roomHistory) {
                        const roomData: Record<string, any> = {};
                        const roomHistoryData = d.roomHistory.history || d.roomHistory;
                        
                        Object.keys(roomHistoryData).forEach(roomName => {
                            const minutes = roomHistoryData[roomName].reduce((a: number, b: number) => a + b, 0);
                            
                            // Finde letzte Aktivität aus eventHistory
                            let lastActivity = 0;
                            if (d.eventHistory) {
                                const roomEvents = d.eventHistory.filter((e: any) => 
                                    (e.location || e.name || '').includes(roomName) && 
                                    (e.type === 'motion' || e.type === 'presence_radar_bool')
                                );
                                if (roomEvents.length > 0) {
                                    lastActivity = Math.max(...roomEvents.map((e: any) => e.timestamp || 0));
                                }
                            }
                            
                            roomData[roomName] = {
                                totalMinutes: minutes,
                                lastActivity: lastActivity
                            };
                        });
                        
                        // Backend-Call für Alarm-Analyse
                        socket.sendTo(adapterName + '.' + instance, 'pythonBridge', {
                            command: 'ANALYZE_ROOM_SILENCE',
                            roomData: roomData
                        }, (response: any) => {
                            if (response && !response.error) {
                                setRoomAlerts(response);
                            } else {
                                setRoomAlerts(null);
                            }
                        });
                    } else {
                        setRoomAlerts(null);
                    }

                } else {
                    setHasData(false);
                    setGeminiNight("Keine Aufzeichnung.");
                    setGeminiDay("Keine Aufzeichnung.");
                    setRoomHistory({});
                    setStressBuckets(new Array(48).fill(0));
                    setYesterdayBuckets(new Array(48).fill(0));
                    setStressDetails(new Array(48).fill([]));
                    setAnomalyScore(0);
                    setBatteryLevel(0);
                    setFreshAirCount(0);
                    setFreshAirLongCount(0);
                    setMeals({ breakfast: false, lunch: false, dinner: false });
                    setBadStatus({ status: 'KEINE DATEN', last: '-', duration: 0 });
                    setDmRoom("-");
                    setRecentEvents([]);
                    setRoomAlerts(null);
                }
            });
    };

    // Lade N-Tage-Daten für Wochenansicht / Monatsansicht
    const loadWeekData = async (days: number = 7) => {
        setLoading(true);
        
        // MASTER-RÄUME laden (wenn noch nicht geschehen)
        let masterList = masterRooms;
        if (masterList.length === 0) {
            masterList = await loadMasterRooms();
        }
        
        const promises: Promise<any>[] = [];
        const dates: Date[] = [];
        
        // Berechne Zeitfenster basierend auf weekOffset:
        // weekOffset = 0  → i von 0 bis days-1 (heute bis heute-6)
        // weekOffset = -1 → i von days bis 2*days-1 (heute-7 bis heute-13)
        // newestOffset = wie viele Tage der NEUESTE Tag zurückliegt
        const newestOffset = Math.abs(weekOffset) * days;
        
        for (let i = 0; i < days; i++) {
            const dayOffset = newestOffset + i; // 0 = heute, 1 = gestern, ...
            const d = new Date();
            d.setDate(d.getDate() - dayOffset);
            dates.push(d);
            
            const dateStr = d.toISOString().split('T')[0];
            
            // Für HEUTE (dayOffset = 0): Lade Live-Daten + roomHistory
            if (dayOffset === 0) {
                promises.push(
                    Promise.all([
                        socket.sendTo(adapterName + '.' + instance, 'getOverviewData', { _t: Date.now() }),
                        socket.getState(`${namespace}.analysis.activity.roomHistory`)
                    ])
                        .then(([res, roomHistoryState]: [any, any]) => {
                            if (res && res.success) {
                                // Berechne Frischluft aus eventHistory
                                const eventHist = res.eventHistory || [];
                                const startOfDay = new Date();
                                startOfDay.setHours(0, 0, 0, 0);
                                const freshAir = eventHist.filter((e: any) => {
                                    if (e.timestamp < startOfDay.getTime()) return false;
                                    const isOpen = e.value === true || e.value === 1 || e.value === 'on' || e.value === 'true' || e.value === 'open';
                                    return e.type === 'door' && isOpen;
                                }).length;
                                // Stosslueftungs-Pairing fuer heute (loadWeekData)
                                const FA_MIN_MS = 5 * 60 * 1000;
                                const doorEvtsSorted = eventHist
                                    .filter((e: any) => e.type === 'door' && e.timestamp >= startOfDay.getTime())
                                    .sort((a: any, b: any) => a.timestamp - b.timestamp);
                                const openMapToday: Record<string, number> = {};
                                let freshAirLong = 0;
                                doorEvtsSorted.forEach((e: any) => {
                                    const isO = e.value === true || e.value === 1 || e.value === 'on' || e.value === 'true' || e.value === 'open';
                                    const sid = e.id || e.name || 'x';
                                    if (isO) { openMapToday[sid] = e.timestamp; }
                                    else { if (openMapToday[sid] && (e.timestamp - openMapToday[sid] >= FA_MIN_MS)) freshAirLong++; delete openMapToday[sid]; }
                                });
                                Object.values(openMapToday).forEach((ts: any) => { if ((Date.now() - ts) >= FA_MIN_MS) freshAirLong++; });
                                
                                // Parse roomHistory aus State
                                let roomHistoryData = null;
                                if (roomHistoryState && roomHistoryState.val) {
                                    try {
                                        roomHistoryData = typeof roomHistoryState.val === 'string' 
                                            ? JSON.parse(roomHistoryState.val) 
                                            : roomHistoryState.val;
                                    } catch(e) {
                                        console.warn('[WEEK DATA] Failed to parse roomHistory for today:', e);
                                    }
                                }
                                
                                // Konvertiere Live-Daten in History-Format
                                return {
                                    date: d,
                                    data: {
                                        eventHistory: eventHist,
                                        roomHistory: roomHistoryData,
                                        batteryLevel: res.stats?.activityTrend !== undefined 
                                            ? Math.min(100, Math.max(20, Math.round(80 + (res.stats.activityTrend * 5)))) 
                                            : 85,
                                        freshAirCount: freshAir,
                                        freshAirLongCount: freshAirLong,
                                        geminiDay: geminiDay,
                                        geminiNight: geminiNight
                                    }
                                };
                            }
                            return { date: d, data: null };
                        })
                        .catch(() => ({ date: d, data: null }))
                );
            } else {
                // Für vergangene Tage: Lade History-Daten
                promises.push(
                    socket.sendTo(adapterName + '.' + instance, 'getHistoryData', { date: dateStr, _t: Date.now() })
                        .then((res: any) => ({ date: d, data: res?.success ? res.data : null }))
                        .catch(() => ({ date: d, data: null }))
                );
            }
        }
        
        Promise.all(promises).then((results) => {
            setLoading(false);
            
            // NORMALISIERE RAUMNAMEN in jedem Snapshot
            const weekDataArray = results.map(r => {
                let normalizedData = r.data;
                
                if (r.data && r.data.roomHistory) {
                    const roomHistoryData = r.data.roomHistory.history || r.data.roomHistory;
                    const normalizedRoomHistory: Record<string, number[]> = {};
                    
                    Object.keys(roomHistoryData).forEach(rawRoomName => {
                        const normalizedName = normalizeRoomName(rawRoomName, masterList);
                        normalizedRoomHistory[normalizedName] = roomHistoryData[rawRoomName];
                    });
                    
                    normalizedData = {
                        ...r.data,
                        roomHistory: { history: normalizedRoomHistory }
                    };
                }
                
                return {
                    date: r.date,
                    dateStr: r.date.toISOString().split('T')[0],
                    dayName: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][r.date.getDay()],
                    hasData: r.data !== null,
                    data: normalizedData
                };
            });
            
            console.log('[WEEK DATA] Loaded & normalized:', weekDataArray.length, 'days');
            setWeekData(weekDataArray);
            calculateWeekAlerts(weekDataArray);
            
            // Backend-Call: Intelligente Heatmap-Analyse
            const weekDataForBackend: any = {};
            weekDataArray.forEach(day => {
                if (day.hasData && day.data) {
                    weekDataForBackend[day.dateStr] = {
                        eventHistory: day.data.eventHistory || [],
                        date: day.dateStr
                    };
                }
            });
            
            console.log('[HEATMAP] Sending to backend:', Object.keys(weekDataForBackend).length, 'days');
            
            // Timeout-Promise (5 Sekunden)
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Backend Timeout (5s)')), 5000);
            });
            
            const backendPromise = socket.sendTo(adapterName + '.' + instance, 'pythonBridge', {
                command: 'ANALYZE_HEATMAP',
                weekData: weekDataForBackend
            });
            
            Promise.race([backendPromise, timeoutPromise])
                .then((backendRes: any) => {
                    console.log('[HEATMAP] Backend response:', backendRes);
                    if (backendRes && backendRes.type === 'HEATMAP_RESULT') {
                        console.log('[HEATMAP] Analysis received:', Object.keys(backendRes.payload || {}).length, 'days');
                        setHeatmapAnalysis(backendRes.payload);
                    } else {
                        console.warn('[HEATMAP] Invalid response format:', backendRes);
                        setHeatmapAnalysis(null);
                    }
                })
                .catch((err: any) => {
                    console.error('[HEATMAP] Backend call failed:', err);
                    setHeatmapAnalysis(null);
                });
        });
    };

    // Berechne Alarme/Auffälligkeiten für die Woche
    const calculateWeekAlerts = (weekDataArray: any[]) => {
        const alerts: {text: string, severity: 'warn' | 'info'}[] = [];
        
        // Berechne Durchschnitte für WC-Gänge nachts
        const nightBathroomVisits = weekDataArray.map(day => {
            if (!day.hasData || !day.data?.eventHistory) return 0;
            return day.data.eventHistory.filter((e: any) => {
                const hour = new Date(e.timestamp).getHours();
                const isNight = hour >= 22 || hour < 8;
                const isBathroom = getRoomCategory(e.name || e.location || '') === 'BATHROOM';
                const isMotion = e.type === 'motion' || e.type === 'presence_radar_bool';
                return isNight && isBathroom && isMotion && e.value === true;
            }).length;
        });
        
        const avgNightBathroom = nightBathroomVisits.reduce((a,b) => a+b, 0) / Math.max(1, nightBathroomVisits.filter(v => v > 0).length);
        
        // Prüfe auf Ausreißer
        weekDataArray.forEach((day, idx) => {
            const visits = nightBathroomVisits[idx];
            if (visits > avgNightBathroom * 1.5 && visits >= 4) {
                alerts.push({
                    text: `${day.dayName} (${day.date.getDate()}.${day.date.getMonth()+1}): ${visits} WC-Gänge nachts (↑${Math.round((visits/avgNightBathroom - 1)*100)}% über Ø)`,
                    severity: 'warn'
                });
            }
        });
        
        // Prüfe auf ungewöhnlich niedrige Aktivität
        const activityScores = weekDataArray.map(day => day.data?.batteryLevel || 0);
        activityScores.forEach((score, idx) => {
            if (score > 0 && score < 50 && weekDataArray[idx].hasData) {
                alerts.push({
                    text: `${weekDataArray[idx].dayName} (${weekDataArray[idx].date.getDate()}.${weekDataArray[idx].date.getMonth()+1}): Niedrige Aktivität (${score}%)`,
                    severity: 'info'
                });
            }
        });
        
        setWeekAlerts(alerts);
    };

    const fetchData = useCallback(() => {
        if (!isLive) return;
        setHasData(true);

        socket.getState(`${namespace}.analysis.health.lastCheck`).then((s:any) => { if (s) setLastCheck(s.ts || s.val); });
        // Priorisiere health.anomalyScore (aus ANALYZE_HEALTH / LTM-Digest), Fallback: security.lastScore
        socket.getState(`${namespace}.analysis.health.anomalyScore`).then((h:any) => {
            if (h?.val != null) { setAnomalyScore(Number(h.val)); }
            else { socket.getState(`${namespace}.analysis.security.lastScore`).then((s:any) => { if (s?.val != null) setAnomalyScore(Number(s.val)); }); }
        });

        // Use raw value first, fallback to calculation if missing
        socket.getState(`${namespace}.analysis.health.activityTrend`).then((s:any) => {
            const val = s?.val !== undefined ? Number(s.val) : null;
            setActivityTrend(val);
            // Battery Logic: Start at 80, add trend*5. Max 100, Min 20.
            if (val !== null) setBatteryLevel(Math.min(100, Math.max(20, Math.round(80 + (val * 5)))));
        });

        socket.getState(`${namespace}.analysis.health.gaitSpeed`).then((s:any) => setGaitTrend(s?.val !== undefined ? Number(s.val) : null));
        socket.getState(`${namespace}.analysis.safety.deadMan.currentRoom`).then((s:any) => setDmRoom(s?.val || null));
        socket.getState(`${namespace}.analysis.health.geminiNight`).then((s:any) => { setGeminiNight(s?.val || 'Warte auf Analyse...'); if (s?.ts) setGeminiNightTs(s.ts); });
        socket.getState(`${namespace}.analysis.health.geminiDay`).then((s:any) => { setGeminiDay(s?.val || 'Warte auf Analyse...'); if (s?.ts) setGeminiDayTs(s.ts); });
        socket.getState(`${namespace}.analysis.activity.roomHistory`).then((s:any) => {
            if (s && s.val) { try { const data = JSON.parse(s.val); if (data && data.history) setRoomHistory(data.history); } catch(e) {} }
        });

        socket.sendTo(adapterName + '.' + instance, 'getOverviewData', { _t: Date.now() })
            .then((res: any) => {
                if (res && res.success) {
                    if (res.stats) {
                        if (res.stats.hourlyActivity) setStressBuckets(res.stats.hourlyActivity);
                        if (res.stats.yesterdayActivity) setYesterdayBuckets(res.stats.yesterdayActivity);
                        if (res.stats.hourlyDetails) {
                            setStressDetails(res.stats.hourlyDetails);
                            
                            // SPLIT: Berechne Schlafzimmer vs. Außerhalb für Nacht (22-08)
                            const sleepBuckets = new Array(48).fill(0);
                            const outsideBuckets = new Array(48).fill(0);
                            
                            res.stats.hourlyDetails.forEach((rooms: string[], idx: number) => {
                                let sleepCount = 0;
                                let outsideCount = 0;
                                
                                rooms.forEach((room: string) => {
                                    const isBedroomEvent = room.toLowerCase().includes('schlaf');
                                    if (isBedroomEvent) sleepCount++;
                                    else outsideCount++;
                                });
                                
                                sleepBuckets[idx] = sleepCount;
                                outsideBuckets[idx] = outsideCount;
                            });
                            
                            setSleepRoomNightBuckets(sleepBuckets);
                            setOutsideNightBuckets(outsideBuckets);
                        }

                        // NEW: Update Battery if server sent a calculated trend
                        if (res.stats.activityTrend !== undefined && res.stats.activityTrend !== null) {
                            const trend = Number(res.stats.activityTrend);
                            setActivityTrend(trend);
                            setBatteryLevel(Math.min(100, Math.max(20, Math.round(80 + (trend * 5)))));
                        }
                    }

                    if (res.eventHistory) processEvents(res.eventHistory);

                    if (res.stats) {
                        if (res.stats.roomStats) setRoomStats(res.stats.roomStats);
                        if (res.stats.digestCount !== undefined) {
                            setDigestCount(res.stats.digestCount);
                            setAiMode(res.stats.digestCount >= TRAINING_TARGET ? 'NEURAL' : 'SIMPLE');
                        }
                    }
                }
            });

        // OC-7: Lade Schlafdaten aus der History-Datei (auch für HEUTE im Live-Modus)
        const todayStr = new Date().toISOString().split('T')[0];
        socket.sendTo(adapterName + '.' + instance, 'getHistoryData', { date: todayStr, _t: Date.now() })
            .then((histRes: any) => {
                if (histRes && histRes.success && histRes.data) {
                    const d = histRes.data;
                    setAuraSleepData({ sleepScore: d.sleepScore ?? null, sleepScoreRaw: d.sleepScoreRaw ?? null, sleepScoreCal: d.sleepScoreCal ?? null, sleepScoreCalNights: d.sleepScoreCalNights ?? 0, sleepScoreCalStatus: d.sleepScoreCalStatus ?? 'uncalibrated', sleepStages: d.sleepStages ?? [], garminScore: d.garminScore ?? null, garminDeepMin: d.garminDeepMin ?? null, garminLightMin: d.garminLightMin ?? null, garminRemMin: d.garminRemMin ?? null, sleepWindowStart: d.sleepWindowStart ?? null, sleepWindowEnd: d.sleepWindowEnd ?? null, sleepWindowSource: d.sleepWindowSource ?? 'fixed', wakeSource: d.wakeSource ?? null, wakeConf: d.wakeConf ?? null, isNap: d.isNap ?? false, unusuallyLongSleep: d.unusuallyLongSleep ?? false, garminDataFresh: d.garminDataFresh ?? null, garminLastSyncAgeH: d.garminLastSyncAgeH ?? null, outsideBedEvents: d.outsideBedEvents ?? [], wakeConfirmed: d.wakeConfirmed ?? false, allWakeSources: d.allWakeSources ?? [], sleepStartSource: d.sleepStartSource ?? null, allSleepStartSources: d.allSleepStartSources ?? [], sleepDate: d.sleepDate ?? null, sleepStartOverridden: d.sleepStartOverridden ?? false, sleepStartOverrideSource: d.sleepStartOverrideSource ?? null, bedWasEmpty: d.bedWasEmpty ?? false });
                    setPersonHistoryData(d.personData && typeof d.personData === 'object' ? d.personData : {});
                }
            });
    }, [namespace, socket, adapterName, instance, TRAINING_TARGET, isLive, viewDate]);

    // FIX: AUTO-START when component mounts or becomes Live
    useEffect(() => {
        if (isLive) {
            fetchData();
        }
    }, [isLive, fetchData]);
    
    // LADE MASTER-RÄUME beim Component Mount
    useEffect(() => {
        loadMasterRooms();
    }, []);

    // OC-15: Batterie-Status + Gerätekonfiguration beim Mount laden (alle 30 Min aktualisieren)
    useEffect(() => {
        const loadBattery = () => {
            socket.getState(`${adapterName}.${instance}.system.sensorBatteryStatus`).then((s: any) => {
                if (s && s.val) { try { setSensorBatteryStatus(JSON.parse(s.val)); } catch(e) {} }
            }).catch(() => {});
        };
        const loadDevices = () => {
            socket.getObject(`system.adapter.${adapterName}.${instance}`).then((obj: any) => {
                if (obj && obj.native && obj.native.devices) setNativeDevices(obj.native.devices);
            }).catch(() => {});
        };
        loadBattery();
        loadDevices();
        socket.getState(`${namespace}.analysis.topology.structure`).then((s: any) => {
            if (s && s.val) { try { setTopoData(JSON.parse(s.val)); } catch(e) {} }
        }).catch(() => {});
        const t = setInterval(loadBattery, 30 * 60 * 1000);
        return () => clearInterval(t);
    }, [socket, adapterName, instance]);

    const handleDateChange = (days: number) => {
        const newDate = new Date(viewDate);
        newDate.setDate(newDate.getDate() + days);
        if (newDate > new Date()) return;

        setViewDate(newDate);
        const isToday = newDate.toDateString() === new Date().toDateString();
        setIsLive(isToday);

        if (!isToday) {
            loadHistory(newDate);
        }
    };
    
    // WOCHE/MONAT Navigation (Garmin-Style)
    const handlePrevWeek = () => {
        setWeekOffset(weekOffset - 1);
    };
    
    const handleNextWeek = () => {
        if (weekOffset >= 0) return; // Kann nicht in die Zukunft
        setWeekOffset(weekOffset + 1);
    };
    
    // Effect: Reload data when weekOffset changes
    useEffect(() => {
        if (viewMode === 'WEEK') {
            loadWeekData(7);
        } else if (viewMode === 'MONTH') {
            loadWeekData(30);
        }
    }, [weekOffset]);

    const processEvents = (events: any[]) => {
        const collectedRelevantEvents: any[] = [];

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        let faCount = 0; let lastFA = '-'; let faLongCount = 0;
        let hasBreakfast = false; let hasLunch = false; let hasDinner = false;
        let badState = 'FREI'; let badLast = '-';
        let kitchenEventsMorning = 0; let kitchenEventsNoon = 0; let kitchenEventsEvening = 0;

        const viewStart = isLive ? startOfDay : new Date(viewDate).setHours(0,0,0,0);

        const todaysEvents = events.filter((e:any) => e.timestamp >= viewStart);

        let lastBadEventTime = 0;
        let lastBadEventActive = false;

        // Stosslueftungs-Pairing: open/close Paare messen, >=5 Min = Stosslueftung
        const FRESH_AIR_MIN_MS_LIVE = 5 * 60 * 1000;
        const doorOpenMap: Record<string, number> = {};
        const doorEventsSorted = [...todaysEvents]
            .filter((e: any) => e.type === 'door')
            .sort((a: any, b: any) => a.timestamp - b.timestamp);
        doorEventsSorted.forEach((evt: any) => {
            const isOpenEvt = evt.value === true || evt.value === 1 || evt.value === 'on' || evt.value === 'true' || evt.value === 'open';
            const sensorId = evt.id || evt.name || 'unknown';
            if (isOpenEvt) { doorOpenMap[sensorId] = evt.timestamp; }
            else {
                if (doorOpenMap[sensorId] && (evt.timestamp - doorOpenMap[sensorId] >= FRESH_AIR_MIN_MS_LIVE)) faLongCount++;
                delete doorOpenMap[sensorId];
            }
        });
        // Noch offene Fenster: Falls seit >=5 Min offen -> auch Stosslueftung
        Object.values(doorOpenMap).forEach((openTs: any) => {
            if ((Date.now() - openTs) >= FRESH_AIR_MIN_MS_LIVE) faLongCount++;
        });

        todaysEvents.forEach((evt: any) => {
            const date = new Date(evt.timestamp);
            const isActive = evt.value === true || evt.value === 1 || evt.value === 'on' || evt.value === 'true';

            if (evt.type === 'door' && isActive) {
                faCount++; lastFA = date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            }
            if (evt.isKitchenSensor) {
                if (date.getHours() >= 6 && date.getHours() <= 10) kitchenEventsMorning++;
                if (date.getHours() >= 12 && date.getHours() <= 14) kitchenEventsNoon++;
                if (date.getHours() >= 18 && date.getHours() <= 20) kitchenEventsEvening++;
            }
            if (evt.isBathroomSensor) {
                if (evt.timestamp > lastBadEventTime) {
                    lastBadEventTime = evt.timestamp;
                    lastBadEventActive = isActive;
                    badLast = date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                }
            }
        });

        // Bad-Status: Nur als "BELEGT" markieren, wenn letztes Event < 10 Min alt UND aktiv
        const badTimeoutMs = 10 * 60 * 1000; // 10 Minuten
        const timeSinceLastBadEvent = Date.now() - lastBadEventTime;
        if (lastBadEventActive && timeSinceLastBadEvent < badTimeoutMs) {
            badState = 'BELEGT';
        } else {
            badState = 'FREI';
        }

        events.forEach((evt: any) => {
            const type = (evt.type || '').toLowerCase();
            const val = evt.value;
            const isActive = val === true || val === 1 || val === 'on' || val === 'true';

            if (isActive) {
                const isMotion = ['motion', 'presence_radar_bool'].includes(type);
                const isDoor = ['door', 'lock'].includes(type);
                const isLight = ['light', 'dimmer'].includes(type);

                if (isMotion || isDoor || isLight) {
                    collectedRelevantEvents.push({
                        name: evt.name || evt.location || 'Unknown',
                        ts: evt.timestamp
                    });
                }
            }
        });

        if (kitchenEventsMorning > 5) hasBreakfast = true;
        if (kitchenEventsNoon > 5) hasLunch = true;
        if (kitchenEventsEvening > 5) hasDinner = true;

        setFreshAirCount(faCount);
        setFreshAirLongCount(faLongCount);
        setLastFreshAir(lastFA);
        setMeals({ breakfast: hasBreakfast, lunch: hasLunch, dinner: hasDinner });
        setBadStatus({ status: badState, last: badLast, duration: 0 });

        collectedRelevantEvents.sort((a,b) => b.ts - a.ts);
        const top5 = collectedRelevantEvents.slice(0, 5).map(e => ({
            name: e.name,
            time: new Date(e.ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            ago: Math.max(0, Math.floor((Date.now() - e.ts) / 60000))
        }));
        setRecentEvents(top5);
    };

    const triggerAnalysis = () => {
        setLoading(true);
        socket.setState(`${namespace}.analysis.training.triggerHealth`, { val: true, ack: false });
        setTimeout(() => { setLoading(false); fetchData(); }, 4000);
    };

    // --- NARRATORS ---
        const getFreshAirNarrative = () => {
            if (!hasData) return "Keine Daten.";
            if (freshAirCount === 0) return "Keine Öffnung erkannt (Wetter schlecht?).";
            if (freshAirLongCount >= 3) return "Vorbildlich gelüftet (≥5 Min, 3× empfohlen).";
            if (freshAirLongCount > 0) return freshAirLongCount + "× ≥5 Min – fast optimal (3× empfohlen).";
            return "Geöffnet, aber kürzer als 5 Min (Stoßlüftung empfohlen).";
        };

    const getMealNarrative = () => {
        if (!hasData) return "Keine Daten.";
        if (meals.breakfast && meals.lunch) return "Versorgung regelmäßig.";
        if (!meals.breakfast && new Date().getHours() > 11) return "Frühstück evtl. ausgefallen?";
        return "Mahlzeiten-Check läuft...";
    };

    const getBadNarrative = () => {
        if (!hasData) return "Keine Daten.";
        if (badStatus.status === 'BELEGT') return "ACHTUNG: Momentan belegt.";
        if (badStatus.status === 'ARCHIV') return "Archivdaten.";
        return "Keine Sturzgefahr erkannt.";
    };

    const getSleepNarrative = () => {
        if (!hasData) return "Keine Daten für diesen Zeitraum.";
        const sleepIndices = [44,45,46,47, 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
        let blueCount = 0; let greenCount = 0; let orangeCount = 0;
        sleepIndices.forEach(i => {
            const val = (i >= 44 && i <= 47 && isLive) ? (yesterdayBuckets[i] || 0) : (stressBuckets[i] || 0);
            if (val === 0) blueCount++;
            else if (val <= 5) greenCount++;
            else orangeCount++;
        });

        if (blueCount >= 12) return "> Verlauf: \"Tiefschlaf dominant. Sehr ruhige Nacht.\"";
        if (greenCount > 5) return "> Verlauf: \"Leichte Unruhe / Bewegungen im Schlaf.\"";
        if (orangeCount > 2) return "> Verlauf: \"Unterbrochener Schlaf / Wachphasen.\"";
        return "> Verlauf: \"Normales Schlafmuster.\"";
    };

    const getDayNarrative = () => {
        if (!hasData) return "Keine Daten.";
        const dayIndices = Array.from({length: 28}, (_, i) => i + 16); // 08:00–22:00 (slots 16–43)
        let stressCount = 0; let activeCount = 0; let totalEvents = 0;
        dayIndices.forEach(i => {
            totalEvents += stressBuckets[i];
            if(stressBuckets[i] > 10) stressCount++;
            if(stressBuckets[i] > 0) activeCount++;
        });

        if (totalEvents === 0) return "Keine Aktivität erfasst.";
        if (stressCount > 2) return "> Verlauf: \"Hohe Aktivität / Stressspitzen erkannt.\"";
        if (activeCount > 8) return "> Verlauf: \"Aktiver, lebendiger Tag.\"";
        return "> Verlauf: \"Ruhiger Tagesablauf.\"";
    };

    const getBatteryNarrative = () => {
        if (!hasData || batteryLevel === 0) return "Keine Daten verfügbar.";
        if (anomalyScore > 0.5) return "Entladung durch Stress/Abweichung.";
        if (batteryLevel > 80) return "Gute Erholung, normale Last.";
        return "Akku im Normalbereich.";
    };

    // --- RENDERERS ---
    const renderTimelines = () => {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const nowBucket = (currentHour * 2) + (currentMinute >= 30 ? 1 : 0);
        
        // Smart-Split: Entscheide welche Nacht/Tag gezeigt wird
        const isNightTime = currentHour < 8; // Vor 08:00 Uhr?
        const isDayTime = currentHour >= 8 && currentHour < 22; // 08:00-22:00 Uhr?
        
        const sleepIndices = [44,45,46,47, 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]; // 22-08
        const dayIndices = Array.from({length: 28}, (_, i) => i + 16); // 08:00–22:00 (slots 16–43)

        const getColor = (v: number) => {
            if (v === 0) return '#2196f3'; // Blue
            if (v <= 5) return '#00e676';  // Green
            if (v <= 15) return '#ffab40'; // Orange
            return '#ff5252';              // Red
        };

        // NEUE ADAPTIVE FARB-LOGIK für Nacht-Split (Baseline-relativ)
        const getColorAdaptive = (v: number, buckets: number[]) => {
            // Berechne Baseline (Durchschnitt aller Nacht-Events)
            const nightValues = sleepIndices.map(idx => buckets[idx] || 0).filter(x => x > 0);
            const baseline = nightValues.length > 0 ? nightValues.reduce((a,b) => a+b, 0) / nightValues.length : 5;
            
            // Adaptiv: Grün = unter 1.5× Baseline, Orange = 1.5-2×, Rot = > 2×
            if (v === 0) return '#2196f3';  // Blue (keine Aktivität)
            if (v <= baseline) return '#00e676'; // Green (normal)
            if (v <= baseline * 1.5) return '#ffab40'; // Orange (erhöht)
            return '#ff5252';              // Red (Alarm!)
        };

        const renderCell = (val: number, label: string, idx: number, isYesterdayData: boolean = false, isFuture: boolean = false, buckets?: number[], roomFilter?: 'bedroom' | 'outside') => {
            const hour = Math.floor(idx / 2);
            const isHalf = idx % 2 !== 0;
            const timeStr = `${hour.toString().padStart(2,'0')}:${isHalf?'30':'00'} - ${isHalf ? (hour+1).toString().padStart(2,'0')+':00' : hour.toString().padStart(2,'0')+':30'}`;

            // FILTER ROOMS: Nur Schlafzimmer oder Außerhalb
            let details = (!isYesterdayData && !isFuture) ? (stressDetails[idx] || []) : [];
            if (roomFilter === 'bedroom') {
                details = details.filter((r: string) => /schlaf/i.test(r));
            } else if (roomFilter === 'outside') {
                details = details.filter((r: string) => !/schlaf/i.test(r));
            }

            const roomsStr = details.length > 0 ? details.join(', ') : (val > 0 ? (isYesterdayData ? '(Gestern)' : isFuture ? '(Zukunft)' : '-') : 'Keine');
            const tooltipText = `${timeStr}\nEvents: ${val}\nRäume: ${roomsStr}`;

            // Nutze adaptive Farbe, wenn Buckets übergeben wurden
            const color = buckets ? getColorAdaptive(val, buckets) : getColor(val);

            return (
                <div style={{display:'flex', flexDirection:'column', alignItems:'center', width:'100%'}} title={tooltipText}>
                    <RenderBlockBar 
                        val={1} 
                        max={1} 
                        color={isFuture ? (isDark ? '#222' : '#e0e0e0') : color} 
                        height='24px' 
                        themeType={themeType}
                    />
                    <div style={{fontSize:'0.6rem', color: isFuture ? '#555' : '#888', marginTop:'2px'}}>{label}</div>
                </div>
            );
        };

        return (
            <div style={{display:'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px'}}>
                <TerminalBox title={`SCHLAF-RADAR (22-08) ${isNightTime ? '🌙 AKTUELLE NACHT' : '📅 LETZTE NACHT'}`} themeType={themeType} helpText={"Balkendiagramm der Nacht-Aktivität (22–08 Uhr). Jeder Balken = 30 Minuten. Hohe Balken = viele Bewegungen. Grün = normal, Rot/Orange = auffällig viel. Hilft Schlafmuster zu erkennen."}>
                    {/* ZEILE 1: UNRUHE IM SCHLAFZIMMER */}
                    <div style={{marginBottom:'15px'}}>
                        <div style={{fontSize:'0.75rem', color:'#888', marginBottom:'5px'}}>UNRUHE IM SCHLAFZIMMER:</div>
                        <div style={{position:'relative', padding:'5px 0'}}>
                            <div style={{display:'flex', justifyContent:'space-between', gap:'2px'}}>
                                {sleepIndices.map((idx, i) => {
                                    let val = sleepRoomNightBuckets[idx] || 0;
                                    let isYesterdayData = false;
                                    let isFuture = false;

                                    // Smart-Split-Logik
                                    if (isLive) {
                                        if (isNightTime) {
                                            if (idx >= 44) {
                                                isYesterdayData = true;
                                            } else if (idx > nowBucket) {
                                                isFuture = true;
                                            }
                                        } else {
                                            if (idx >= 44) {
                                                isYesterdayData = true;
                                            }
                                        }
                                    }

                                    return <div key={i} style={{flex:1}}>{renderCell(val, i%2===0 ? String((idx/2)|0) : '', idx, isYesterdayData, isFuture, sleepRoomNightBuckets, 'bedroom')}</div>;
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ZEILE 2: NÄCHTLICHE AKTIVITÄT (AUSSERHALB) */}
                    <div style={{marginBottom:'10px'}}>
                        <div style={{fontSize:'0.75rem', color:'#888', marginBottom:'5px'}}>NÄCHTLICHE AKTIVITÄT (AUSSERHALB):</div>
                        <div style={{position:'relative', padding:'5px 0'}}>
                            <div style={{display:'flex', justifyContent:'space-between', gap:'2px'}}>
                                {sleepIndices.map((idx, i) => {
                                    let val = outsideNightBuckets[idx] || 0;
                                    let isYesterdayData = false;
                                    let isFuture = false;

                                    // Smart-Split-Logik
                                    if (isLive) {
                                        if (isNightTime) {
                                            if (idx >= 44) {
                                                isYesterdayData = true;
                                            } else if (idx > nowBucket) {
                                                isFuture = true;
                                            }
                                        } else {
                                            if (idx >= 44) {
                                                isYesterdayData = true;
                                            }
                                        }
                                    }

                                    return <div key={i} style={{flex:1}}>{renderCell(val, i%2===0 ? String((idx/2)|0) : '', idx, isYesterdayData, isFuture, outsideNightBuckets, 'outside')}</div>;
                                })}
                            </div>
                        </div>
                    </div>

                    {/* LEGENDE & NARRATIVE */}
                    <div style={{display:'flex', gap:'10px', fontSize:'0.7rem', color:'#888', justifyContent:'center', marginBottom:'10px', flexWrap:'wrap'}}>
                        <span style={{color:'#2196f3'}}>■ Tief</span>
                        <span style={{color:'#00e676'}}>■ Unruhig</span>
                        <span style={{color:'#ffab40'}}>■ Wach</span>
                        <span style={{color:'#ff5252'}}>■ Hektik</span>
                    </div>
                    <div style={{fontSize:'0.8rem', color: isDark?'#888':'#666', borderTop:`1px dashed ${isDark?'#333':'#ccc'}`, paddingTop:'5px'}}>
                        {getSleepNarrative()}
                    </div>
                </TerminalBox>

                <TerminalBox title={`NEURO-TIMELINE (08-22) ${isDayTime ? '☀️ HEUTE' : '📅 GESTERN'}`} themeType={themeType} helpText={"Stündliche Tages-Aktivität (08–22 Uhr). Blau = keine Aktivität, Grün = normal, Gelb/Rot = erhöht. Zeigt Tagesstruktur und Aktivitätsmuster auf einen Blick."}>
                    <div style={{position:'relative', padding:'10px 0'}}>
                        <div style={{display:'flex', justifyContent:'space-between', gap:'2px', flexWrap:'nowrap', minWidth:0}}>
                            {dayIndices.map((idx, i) => {
                                let val = stressBuckets[idx] || 0;
                                let isFuture = false;
                                
                                // Smart-Split: Wenn JETZT im Tag-Bereich, graue Zukunft aus
                                if (isLive && isDayTime && idx > nowBucket) {
                                    isFuture = true;
                                }
                                
                                return (
                                    <div key={i} style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', alignItems:'center'}}>
                                        {renderCell(val, idx%2===0 ? String(idx/2) : '', idx, false, isFuture)}
                                    </div>
                                );
                            })}
                        </div>
                        
                    </div>
                    <div style={{display:'flex', gap:'10px', fontSize:'0.7rem', color:'#888', justifyContent:'center', marginBottom:'10px', flexWrap:'wrap'}}>
                        <span style={{color:'#2196f3'}}>■ Inaktiv</span>
                        <span style={{color:'#00e676'}}>■ Leicht</span>
                        <span style={{color:'#ffab40'}}>■ Aktiv</span>
                        <span style={{color:'#ff5252'}}>■ Stress</span>
                    </div>
                    <div style={{fontSize:'0.8rem', color: isDark?'#888':'#666', borderTop:`1px dashed ${isDark?'#333':'#ccc'}`, paddingTop:'5px'}}>
                        {getDayNarrative()}
                    </div>
                </TerminalBox>
            </div>
        );
    };


    // ═══ OC-7: AURA SLEEP SCORE CARD (OC-18 Prio 2: auch per Person aufrufbar) ═══
    const renderSleepScoreCard = (overrideData?: any, personLabel?: string) => {
        const sd = overrideData ?? auraSleepData;
        const score: number | null = sd?.sleepScore ?? null;
        const scoreRaw: number | null = sd?.sleepScoreRaw ?? null;
        const scoreCal: number | null = (sd as any)?.sleepScoreCal ?? null;
        const scoreCalNights: number = (sd as any)?.sleepScoreCalNights ?? 0;
        const scoreCalStatus: string = (sd as any)?.sleepScoreCalStatus ?? 'uncalibrated';
        const stages: {t: number, s: string}[] = sd?.sleepStages ?? [];
        const garminScore: number | null = sd?.garminScore ?? null;
        const garminDeepMin: number | null = sd?.garminDeepMin ?? null;
        const garminLightMin: number | null = sd?.garminLightMin ?? null;
        const garminRemMin: number | null = sd?.garminRemMin ?? null;
        const swStart: number | null = sd?.sleepWindowStart ?? null;
        const swEnd: number | null = sd?.sleepWindowEnd ?? null;
        // stagesWindowStart: ursprünglicher Startpunkt des Stage-Analyse-Fensters (kann bei Override von swStart abweichen)
        const stagesWindowStart: number | null = (sd as any)?.stagesWindowStart ?? swStart;
        const sleepWindowSource: string = sd?.sleepWindowSource ?? 'fixed';
        const sleepStartSource: string = sd?.sleepStartSource ?? sleepWindowSource;
        const wakeSource: string = sd?.wakeSource ?? sleepWindowSource;
        const wakeConf: string = sd?.wakeConf ?? 'none';
        const isNap: boolean = sd?.isNap ?? false;
        const unusuallyLongSleep: boolean = sd?.unusuallyLongSleep ?? false;
        const garminDataFresh: boolean | null = sd?.garminDataFresh ?? null;
        const garminLastSyncAgeH: number | null = sd?.garminLastSyncAgeH ?? null;
        const outsideBedEvts: {start:number,end:number,duration:number,type:string}[] = sd?.outsideBedEvents ?? [];
        const wakeConfirmed: boolean = sd?.wakeConfirmed ?? false;
        const sleepDateStr: string | null = sd?.sleepDate ?? (sd?.sleepWindowStart ? (() => {
            const d = new Date((sd.sleepWindowStart as number) - 3 * 3600000);
            return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        })() : null);
        const sleepStartOverridden: boolean = sd?.sleepStartOverridden ?? false;
        const bedWasEmpty: boolean = sd?.bedWasEmpty ?? false;

        const handleSetOverride = async (source: string, ts: number) => {
            if (!sleepDateStr) return;
            if (personLabel) {
                setPersonOverrideLoading(true);
                try {
                    const result: any = await socket.sendTo(adapterName + '.' + instance, 'setPersonSleepStartOverride', {
                        person: personLabel, date: sleepDateStr, source, ts, setBy: 'ui', setAt: Date.now()
                    });
                    if (result?.data?.personData) setPersonHistoryData(result.data.personData);
                } finally {
                    setPersonOverrideLoading(false);
                    setPersonOverridePanelOpen(null);
                }
            } else {
                setOverrideLoading(true);
                try {
                    const result: any = await socket.sendTo(adapterName + '.' + instance, 'setSleepStartOverride', {
                        date: sleepDateStr, source, ts, setBy: 'ui', setAt: Date.now()
                    });
                    if (result?.data) setAuraSleepData({ ...result.data });
                } finally {
                    setOverrideLoading(false);
                    setOverridePanelOpen(false);
                }
            }
        };
        const handleClearOverride = async () => {
            if (personLabel) {
                setPersonOverrideLoading(true);
                try {
                    const result: any = await socket.sendTo(adapterName + '.' + instance, 'clearPersonSleepStartOverride', { person: personLabel });
                    if (result?.data?.personData) setPersonHistoryData(result.data.personData);
                } finally {
                    setPersonOverrideLoading(false);
                }
            } else {
                setOverrideLoading(true);
                try {
                    const result: any = await socket.sendTo(adapterName + '.' + instance, 'clearSleepStartOverride', {});
                    if (result?.data) setAuraSleepData({ ...result.data });
                } finally {
                    setOverrideLoading(false);
                }
            }
        };
        const isOverrideLoading = personLabel ? personOverrideLoading : overrideLoading;
        const isOverridePanelOpen = personLabel ? (personOverridePanelOpen === personLabel) : overridePanelOpen;
        const setIsOverridePanelOpen = personLabel
            ? (v: boolean) => setPersonOverridePanelOpen(v ? personLabel : null)
            : (v: boolean) => setOverridePanelOpen(v);

        const hasVibSensor = stages.length > 0;
        const hasSleepWindow = swStart !== null;

        // OC-15: Batterie-Warnung — nur schlaf-relevante Sensoren
        // OC-17: Topologie-Hop-Filter — nur Sensoren in ≤2 Hops vom Schlafzimmer warnen
        const SLEEP_RELEVANT_TYPES = ['vibration_trigger', 'vibration_strength', 'presence_radar_bool'];
        const SLEEP_RELEVANT_FUNCS = ['bed', 'bathroom', 'kitchen', 'hallway'];
        // BFS: alle Räume innerhalb maxHops Schritten von startRooms ermitteln
        const bfsHops = (topo: {rooms:string[], matrix:number[][]}, startRooms: string[], maxHops: number): Set<string> => {
            const reachable = new Set(startRooms);
            let frontier = [...startRooms];
            for (let h = 0; h < maxHops; h++) {
                const next: string[] = [];
                for (const room of frontier) {
                    const ri = topo.rooms.indexOf(room);
                    if (ri === -1) continue;
                    topo.rooms.forEach((r, j) => {
                        if (topo.matrix[ri]?.[j] === 1 && !reachable.has(r)) { reachable.add(r); next.push(r); }
                    });
                }
                frontier = next;
            }
            return reachable;
        };
        // Topologie-Nähefilter: Schlafzimmer-nahe Räume (Hop ≤ 2) für Batterie-Warnung
        let battNearRooms: Set<string> | null = null;
        if (topoData && topoData.rooms.length > 0) {
            const bedRooms = nativeDevices
                .filter((d: any) => d.isFP2Bed || d.isVibrationBed || d.sensorFunction === 'bed')
                .map((d: any) => (d.location || '').trim())
                .filter((l: string) => l.length > 0);
            if (bedRooms.length > 0) battNearRooms = bfsHops(topoData, bedRooms, 2);
        }
        const vibBatteryWarning = (() => {
            if (!sensorBatteryStatus || !sensorBatteryStatus.sensors) return null;
            const lowSensors = sensorBatteryStatus.sensors.filter(s => {
                if (!(s.isLow || s.isCritical)) return false;
                const dev = nativeDevices.find((d: any) => d.id === s.id);
                if (!dev) return false;
                const type = dev.type || 'motion';
                const sf = dev.sensorFunction || (dev.isBathroomSensor ? 'bathroom' : dev.isKitchenSensor ? 'kitchen' : dev.isHallway ? 'hallway' : dev.isFP2Bed || dev.isVibrationBed ? 'bed' : '');
                if (!(SLEEP_RELEVANT_TYPES.includes(type) || (type === 'motion' && SLEEP_RELEVANT_FUNCS.includes(sf)))) return false;
                // Topologie-Hop-Filter: Sensor > 2 Hops vom Schlafzimmer → keine Warnung
                if (battNearRooms && battNearRooms.size > 0) {
                    const loc = (dev.location || '').trim();
                    if (loc && !battNearRooms.has(loc)) return false;
                }
                return true;
            });
            if (lowSensors.length === 0) return null;
            return lowSensors.map(s => {
                const dev = nativeDevices.find((d: any) => d.id === s.id);
                return {
                    level: s.level,
                    isCritical: s.isCritical,
                    id: s.id,
                    name: dev?.name || dev?.location || s.id,
                    location: dev?.location || ''
                };
            });
        })();

        // Farben: best → schlimmste (Tief=dunkelblau, Leicht=hellblau, REM=lila, Wach=gelb, Bad=bernstein, Außerhalb=rot, Andere Person=blau)
        const stageColor: Record<string, string> = {
            deep:         '#1565c0',
            light:        '#42a5f5',
            rem:          '#ab47bc',
            wake:         '#ffd54f',      // Gelb — Wach im Bett ist milde Störung
            bathroom:     '#ffb300',      // Bernstein — Bad-Besuch (orange)
            outside:      '#e53935',      // Rot — bestätigte Außer-Bett-Aktivität (du warst es)
            other_person: '#1e88e5',      // Blau — andere Person im Haus
        };
        const stageLabel: Record<string, string> = {
            deep: 'Tief', light: 'Leicht', rem: 'REM (est.)', wake: 'Wachliegen',
            bathroom: 'Bad-Besuch', outside: 'Außerhalb', other_person: 'Andere Person'
        };

        // Sensor-Indikator für Einschlaf-/Aufwachzeit
        // OC-18 FP2-Label-Fix: nur echte Präsenz-Radare bekommen das "FP2"-Label
        const hasFP2Sensor = nativeDevices.some((d: any) => d.type === 'presence_radar_bool' || d.isFP2Bed === true);
        const srcInfo: Record<string, {icon:string, label:string}> = {
            garmin:          { icon: '⌚', label: 'Garmin-Uhr' },
            fp2_vib:         { icon: hasFP2Sensor ? '📡' : '🛏️', label: hasFP2Sensor ? 'FP2 + Vibration' : 'Bett-Sensor + Vibration' },
            fp2:             { icon: hasFP2Sensor ? '📡' : '🛏️', label: hasFP2Sensor ? 'FP2-Sensor' : 'Bett-Bewegungsmelder' },
            fp2_other:       { icon: hasFP2Sensor ? '📡' : '🛏️', label: hasFP2Sensor ? 'FP2 + Anderer Raum' : 'Bett-Sensor + Anderer Raum' },
            other:           { icon: '🚶', label: 'Anderer Raum' },
            motion:          { icon: '🚶', label: 'Schlafzimmer-Bewegungsmelder' },
            motion_vib:      { icon: '🚶', label: 'Bewegungsmelder + Vibration' },
            haus_still:      { icon: '🏠', label: 'Haus-wird-still' },
            vibration:       { icon: '📳', label: 'Vibrationssensor (↑ Konfidenz)' },
            vibration_alone: { icon: '📳', label: 'Vibrationssensor allein' },
            fixed:           { icon: '⏱', label: 'Fallback 20:00 Uhr' },
            gap60:           { icon: '🛏️', label: 'Bett-Gap (60 Min)' },
            last_outside:    { icon: '🚶', label: 'Letzte Außenaktiv.' },
            winstart:        { icon: '⏱', label: 'Fenster-Start (Fallback)' },
            override:        { icon: '✏️', label: 'Manuell überschrieben' },
        };
        const srcDisplay  = srcInfo[sleepStartSource] ?? srcInfo.fixed;
        const wakeDisplay = srcInfo[wakeSource]        ?? srcInfo.fixed;

        // Hilfsfunktionen — müssen VOR den Tooltips stehen (TDZ-Regel bei const)
        const fmtTime = (ms: number | null) => {
            if (!ms) return '—';
            const d = new Date(ms);
            return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
        };
        const fmtDuration = (min: number | null) => {
            if (!min) return null;
            const h = Math.floor(min / 60);
            const m = min % 60;
            return h > 0 ? `${h}h ${m}min` : `${m}min`;
        };

        // Schlafdauer
        const sleepDurMin = (swStart && swEnd && swEnd > swStart) ? Math.round((swEnd - swStart) / 60000) : null;

        // DEV-ONLY: alle Wake-Quellen für Hover-Tooltip
        const allWakeSourcesArr: {source:string, ts:number|null}[] = sd?.allWakeSources ?? [];
        const CONFIDENCE_BOOSTERS = new Set(['vibration']); // Quellen die nur Konfidenz erhöhen, keine eigene Zeit liefern
        const devWakeTooltip = allWakeSourcesArr.length > 0
            ? 'Aufwachzeit — alle Quellen (Priorität absteigend):\n' +
              allWakeSourcesArr.map(ws => {
                  const info = srcInfo[ws.source] ?? { icon: '?', label: ws.source };
                  const active = ws.source === wakeSource ? ' ← AKTIV' : '';
                  const booster = CONFIDENCE_BOOSTERS.has(ws.source) ? ' [Konfidenz-Booster]' : '';
                  const timeStr = ws.ts ? fmtTime(ws.ts) : '—';
                  return `${info.icon} ${info.label}: ${timeStr}${active}${booster}`;
              }).join('\n')
            : '(keine allWakeSources — alter Snapshot ohne diese Daten)';

        // DEV-ONLY: alle SleepStart-Quellen für Hover-Tooltip
        const allSleepStartSourcesArr: {source:string, ts:number|null}[] = sd?.allSleepStartSources ?? [];
        const devSleepStartTooltip = allSleepStartSourcesArr.length > 0
            ? 'Einschlafzeit — alle Quellen (Priorität absteigend):\n' +
              allSleepStartSourcesArr.map(ss => {
                  const info = srcInfo[ss.source] ?? { icon: '?', label: ss.source };
                  const active = ss.source === sleepStartSource ? ' ← AKTIV' : '';
                  const timeStr = ss.ts ? fmtTime(ss.ts) : '—';
                  return `${info.icon} ${info.label}: ${timeStr}${active}`;
              }).join('\n')
            : '(keine allSleepStartSources — alter Snapshot ohne diese Daten)';

        const _displayScore = scoreCal ?? score;
        const scoreColor = _displayScore === null ? '#888'
            : _displayScore >= 80 ? '#00e676'
            : _displayScore >= 60 ? '#ffab40'
            : '#ff5252';

        const deepCount  = stages.filter(s => s.s === 'deep').length;
        const lightCount = stages.filter(s => s.s === 'light').length;
        const remCount   = stages.filter(s => s.s === 'rem').length;
        const wakeCount  = stages.filter(s => s.s === 'wake').length;
        // Außerhalb-Events strikt auf Schlaf-Fenster clippen (kein Rendering rechts von Aufwachzeit)
        const clippedOutsideBedEvts: {start:number,end:number,duration:number,type:string}[] = (swStart && swEnd)
            ? outsideBedEvts
                .map(e => {
                    const start = Math.max(e.start, swStart);
                    const end = Math.min(e.end, swEnd);
                    if (end <= start) return null;
                    return {
                        start,
                        end,
                        duration: Math.max(1, Math.round((end - start) / 60000)),
                        type: e.type
                    };
                })
                .filter((e): e is {start:number,end:number,duration:number,type:string} => !!e)
            : outsideBedEvts;

        // Außerhalb-Zeit aus geclippten Events
        const outsideTotalMin = clippedOutsideBedEvts.reduce((acc, e) => acc + e.duration, 0);
        const bathMin = clippedOutsideBedEvts.filter(e => e.type === 'bathroom').reduce((acc, e) => acc + e.duration, 0);
        const toH = (n: number, isMin?: boolean) => {
            const m = isMin ? n : n * 5;
            return (m >= 60 ? Math.floor(m/60) + 'h ' : '') + (m % 60) + 'min';
        };

        // Helper: Farbe für Stage-Slot (mit Außerhalb-Overlay)
        const slotColor = (slot: {t:number,s:string}, absMs: number|null) => {
            if (absMs && clippedOutsideBedEvts.length > 0) {
                const evt = clippedOutsideBedEvts.find(e => absMs >= e.start && absMs < e.end);
                if (evt) return stageColor[evt.type] ?? stageColor.outside;
            }
            return stageColor[slot.s] ?? '#555';
        };
        const slotTip = (slot: {t:number,s:string}, absMs: number|null) => {
            const timeStr = absMs ? fmtTime(absMs) + ' — ' : '';
            if (absMs && clippedOutsideBedEvts.length > 0) {
                const evt = clippedOutsideBedEvts.find(e => absMs >= e.start && absMs < e.end);
                if (evt) return timeStr + stageLabel[evt.type] + ' (' + evt.duration + ' min)';
            }
            return timeStr + (stageLabel[slot.s] || slot.s);
        };
        const renderedStages = (stagesWindowStart && swEnd)
            ? stages.filter(slot => {
                const absMs = stagesWindowStart + slot.t * 60000;
                return absMs >= (swStart ?? stagesWindowStart) && absMs < swEnd;
            })
            : stages;
        // Kein-Daten-Bereich VOR Stage-Fenster (wenn Override den Start nach vorne verschiebt)
        const preStageMs = (swStart && stagesWindowStart && stagesWindowStart > swStart && swEnd)
            ? stagesWindowStart - swStart : 0;
        const totalWindowMs = (swStart && swEnd) ? swEnd - swStart : null;
        // Kein-Daten-Bereich NACH dem letzten Stage-Slot (Stages decken oft nur Anfang der Nacht ab)
        const lastSlotEndMs = (stagesWindowStart && renderedStages.length > 0)
            ? stagesWindowStart + (renderedStages[renderedStages.length - 1].t + 5) * 60000
            : (stagesWindowStart ?? swStart ?? null);
        const postStageMs = (lastSlotEndMs && swEnd && lastSlotEndMs < swEnd)
            ? swEnd - lastSlotEndMs : 0;
        // Marker-Logik: Bad → über Balken (▼), Außerhalb/andere → unter Balken (▲)
        const markerItems = (() => {
            if (!swStart || !swEnd || clippedOutsideBedEvts.length === 0) return { above: [], below: [] };
            const totalMs = swEnd - swStart;
            const minPctGap = 2.2;
            const titleMap: Record<string, string> = {
                bathroom:     'Bad-Besuch',
                outside:      'Außerhalb',
                other_person: 'Andere Person aktiv',
            };
            const assignLanes = (evts: typeof clippedOutsideBedEvts, idxOffset: number) => {
                const lastPctInLane = [-100, -100];
                return evts.map((evt, i) => {
                    const pct = ((evt.start - swStart!) / totalMs) * 100;
                    const lane = Math.abs(pct - lastPctInLane[0]) >= minPctGap ? 0
                               : Math.abs(pct - lastPctInLane[1]) >= minPctGap ? 1
                               : 0;
                    lastPctInLane[lane] = pct;
                    const evtType = evt.type ?? 'outside';
                    return {
                        key: `${evt.start}-${evt.end}-${idxOffset + i}`,
                        pct: Math.min(100, Math.max(0, pct)),
                        lane,
                        evtType,
                        title: `${titleMap[evtType] ?? 'Abwesenheit'}: ${evt.duration} min`
                    };
                }).sort((a, b) => a.pct - b.pct);
            };
            const aboveEvts = clippedOutsideBedEvts.filter(e => (e.type ?? 'outside') === 'bathroom');
            const belowEvts = clippedOutsideBedEvts.filter(e => (e.type ?? 'outside') !== 'bathroom');
            return {
                above: assignLanes(aboveEvts, 0),
                below: assignLanes(belowEvts, aboveEvts.length)
            };
        })();

        return (
            <TerminalBox title={personLabel ? `SCHLAFANALYSE — ${personLabel}` : 'SCHLAFANALYSE (OC-7)'} themeType={themeType}
                helpText={
                    'AURA-Sleepscore: Tief×200 + REM×150 + Leicht×80 − Wach×250 (Anzeige max. 100, Rohwert kann höher sein). Bonus +5 bei 7–9h Schlafdauer.\n' +
                    'Quellen: Diekelmann & Born 2010 (Tiefschlaf), Walker 2017 / Stickgold 2005 (REM), AASM Guidelines (Leichtschlaf), Buysse et al. 1989 PSQI (WASO-Abzug).\n' +
                    'Einschlafzeit (' + srcDisplay.icon + '): Letzte FP2-Bettbelegung ≥10 Min zwischen 18–03 Uhr.\n' +
                    'Aufwachzeit (' + srcDisplay.icon + '): Erste Bettleere ≥15 Min nach 04 Uhr (⟳ vorläufig bis 10:00 Uhr + 1h Bett leer).\n' +
                    'Balkenfarben: Dunkelblau=Tief, Hellblau=Leicht, Lila=REM, Gelb=Wach-im-Bett, Bernstein=Bad-Besuch, Orange=Außerhalb.\n' +
                    'Kein Medizinprodukt — für klinische Diagnose Arzt hinzuziehen.'
                }>
                {bedWasEmpty ? (
                    <div style={{fontSize:'0.8rem'}}>
                        {swStart && (
                            <div style={{fontSize:'0.65rem', color: isDark?'#666':'#aaa', marginBottom:'8px', textAlign:'center'}}>
                                {(() => {
                                    const d1 = new Date(swStart);
                                    return `Nacht ${d1.getDate()}.${d1.getMonth()+1}.${d1.getFullYear()}`;
                                })()}
                            </div>
                        )}
                        <div style={{textAlign:'center', padding:'12px 8px', background: isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.03)', borderRadius:'6px'}}>
                            <div style={{fontSize:'1.4rem', marginBottom:'6px'}}>🏠</div>
                            <div style={{fontSize:'0.9rem', fontWeight:'bold', color: isDark?'#ccc':'#444', marginBottom:'4px'}}>Bett war leer</div>
                            <div style={{fontSize:'0.72rem', color:'#888', marginBottom:'8px'}}>
                                Kein Sensor hat eine Anwesenheit bestätigt — möglicherweise auswärts geschlafen.
                            </div>
                            {(swStart && swEnd) && (
                                <div style={{fontSize:'0.7rem', color: isDark?'#666':'#aaa', borderTop: isDark?'1px solid #333':'1px solid #ddd', paddingTop:'6px', marginTop:'4px'}}>
                                    <span style={{color:isDark?'#555':'#bbb'}}>⌚ Garmin-Referenz:</span>{' '}
                                    {fmtTime(swStart)} – {fmtTime(swEnd)}
                                    {garminScore !== null && <span style={{marginLeft:'8px', color:'#ab47bc'}}>Score: {garminScore}</span>}
                                </div>
                            )}
                        </div>
                    </div>
                ) : !hasVibSensor ? (
                    <div style={{fontSize:'0.8rem'}}>
                        {hasSleepWindow && swStart ? (
                            <>
                                {/* Degradierter View: Zeiten bekannt, aber keine Vibrationsdaten */}
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px'}}>
                                    <div>
                                        <div style={{fontSize:'0.75rem', color: isDark?'#aaa':'#666'}}>Einschlafen</div>
                                        <div style={{fontSize:'1.1rem', fontWeight:'bold', color: isDark?'#eee':'#222'}}>{fmtTime(swStart)}</div>
                                        <div style={{fontSize:'0.6rem', color: isDark?'#555':'#bbb', marginTop:'1px'}}>
                                            {srcDisplay.icon} {srcDisplay.label}
                                        </div>
                                        {sleepStartOverridden && (
                                            <div style={{fontSize:'0.5rem', color:'#ffb300', marginTop:'1px', fontWeight:'bold'}}>✏️ manuell</div>
                                        )}
                                        {allSleepStartSourcesArr.length > 0 && (
                                            <div style={{fontSize:'0.5rem', color:'#ff9800', marginTop:'2px', cursor: isOverrideLoading ? 'wait' : 'pointer', opacity:0.8,
                                                         display:'inline-flex', alignItems:'center', gap:'3px', userSelect:'none'}}
                                                title={isOverrideLoading ? 'Wird neu berechnet...' : 'Einschlafzeit-Quelle manuell wählen'}
                                                onClick={() => { if (!isOverrideLoading) setIsOverridePanelOpen(!isOverridePanelOpen); }}>
                                                {isOverrideLoading ? '⏳' : '⚙'} Quellen {isOverridePanelOpen ? '▲' : '▼'}
                                            </div>
                                        )}
                                        {isOverridePanelOpen && !isOverrideLoading && allSleepStartSourcesArr.length > 0 && (
                                            <div style={{marginTop:'4px', background: isDark?'#1e2a1e':'#f1f8e9',
                                                         border:'1px solid ' + (isDark?'#388e3c':'#a5d6a7'),
                                                         borderRadius:'6px', padding:'6px 8px', minWidth:'200px',
                                                         boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
                                                <div style={{fontSize:'0.55rem', color: isDark?'#aaa':'#555', marginBottom:'4px', fontWeight:'bold'}}>
                                                    Einschlafzeit-Quelle wählen:
                                                </div>
                                                {allSleepStartSourcesArr.map(ss => {
                                                    const info = srcInfo[ss.source] ?? { icon: '?', label: ss.source };
                                                    const isActive = ss.source === sleepStartSource;
                                                    const hasTs = !!ss.ts;
                                                    return (
                                                        <div key={ss.source} style={{
                                                            display:'flex', alignItems:'center', justifyContent:'space-between',
                                                            padding:'2px 4px', marginBottom:'2px', borderRadius:'3px',
                                                            opacity: hasTs ? 1 : 0.4,
                                                            background: isActive ? (isDark?'#1b5e20':'#c8e6c9') : 'transparent'
                                                        }}>
                                                            <span style={{fontSize:'0.6rem', color: isDark?'#ddd':'#333'}}>
                                                                {info.icon} {info.label}: {ss.ts ? fmtTime(ss.ts) : '—'}
                                                                {isActive ? ' ✓' : ''}
                                                            </span>
                                                            {hasTs && !isActive && sleepDateStr && (
                                                                <button
                                                                    onClick={() => handleSetOverride(ss.source, ss.ts!)}
                                                                    style={{fontSize:'0.5rem', padding:'1px 6px', cursor:'pointer',
                                                                           background:'#1565c0', color:'#fff', border:'none',
                                                                           borderRadius:'3px', marginLeft:'6px', flexShrink:0}}>
                                                                    Wählen
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {sleepStartOverridden && (
                                                    <div style={{marginTop:'4px', borderTop:'1px solid ' + (isDark?'#444':'#ccc'), paddingTop:'4px'}}>
                                                        <button onClick={handleClearOverride}
                                                            style={{fontSize:'0.5rem', padding:'2px 8px', cursor:'pointer',
                                                                   background:'#b71c1c', color:'#fff', border:'none',
                                                                   borderRadius:'3px', width:'100%'}}>
                                                            ✕ Override zurücksetzen
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{textAlign:'center'}}>
                                        <div style={{fontSize:'1.8rem', fontWeight:'bold', color:'#888', border:'2px solid #888', borderRadius:'8px', padding:'4px 14px', lineHeight:'1.1'}}>—</div>
                                        <div style={{fontSize:'0.65rem', color:'#888', marginTop:'2px'}}>AURA-Sleepscore</div>
                                        {garminScore !== null && (
                                            <div style={{fontSize:'0.7rem', color:'#ab47bc', marginTop:'2px'}}>Garmin: {garminScore}</div>
                                        )}
                                    </div>
                                    <div style={{textAlign:'right'}}>
                                        <div style={{fontSize:'0.75rem', color: isDark?'#aaa':'#666'}}>Aufwachen</div>
                                        <div style={{fontSize:'1.1rem', fontWeight:'bold', color: isDark?'#eee':'#222'}}>{fmtTime(swEnd)}</div>
                                        <div style={{fontSize:'0.6rem', color: isDark?'#555':'#bbb', marginTop:'1px'}}>
                                            {wakeDisplay.icon} {wakeDisplay.label}
                                        </div>
                                        {allWakeSourcesArr.length > 0 && (
                                            <div style={{fontSize:'0.5rem', color:'#ff9800', marginTop:'2px', cursor:'help', opacity:0.7}}
                                                title={devWakeTooltip}>
                                                ⚙ Quellen
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div style={{textAlign:'center', padding:'8px', background: isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.03)', borderRadius:'6px', color:'#888', fontSize:'0.72rem'}}>
                                    {personLabel
                                        ? '📊 Schlafphasen nicht verfügbar — nur Einschlaf- und Aufwachzeit analysiert'
                                        : '📳 Schlafphasen nicht verfügbar — Vibrationsdaten zu alt (tritt auf wenn Adapter tagsüber neu gestartet wird)'}
                                </div>
                            </>
                        ) : (
                            <div style={{color:'#888', textAlign:'center', padding:'20px'}}>
                                <div style={{fontSize:'1.5rem', marginBottom:'8px'}}>&#128716;</div>
                                <strong style={{color: isDark?'#ccc':'#555'}}>Heute Nacht werden die ersten Daten gesammelt.</strong><br/>
                                <span style={{opacity:0.7}}>Der AURA-Sleepscore erscheint morgen früh nach der ersten analysierten Nacht.</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div>
                        {/* Datum der Nacht + Hinweise */}
                        {swStart && (
                            <div style={{fontSize:'0.65rem', color: isDark?'#666':'#aaa', marginBottom:'6px', textAlign:'center'}}>
                                {(() => {
                                    const d1 = new Date(swStart);
                                    const d2 = swEnd ? new Date(swEnd) : null;
                                    const fmt = (d: Date) => d.getDate() + '.' + (d.getMonth()+1) + '.' + d.getFullYear();
                                    if (d2 && d1.getDate() !== d2.getDate()) return `Nacht vom ${fmt(d1)} auf ${fmt(d2)}`;
                                    return `Nacht ${fmt(d1)}`;
                                })()}
                                {isNap && <span style={{marginLeft:'6px', color:'#ffab40'}}>&#9788; Nickerchen</span>}
                                {unusuallyLongSleep && <span style={{marginLeft:'6px', color:'#ff7043'}}>⚠ Ungewöhnlich lange Liegezeit</span>}
                            </div>
                        )}
                        {/* Garmin Freshness-Banner (nur wenn Sync-Objekt konfiguriert und veraltet) */}
                        {garminDataFresh === false && (
                            <div style={{
                                marginBottom:'6px', padding:'3px 7px', borderRadius:'4px',
                                background: isDark ? 'rgba(255,152,0,0.15)' : '#fff3e0',
                                border: '1px solid #ff9800', color:'#e65100',
                                fontSize:'0.65rem', display:'flex', alignItems:'center', gap:'5px'
                            }}>
                                ⌚⚠ Garmin-Daten veraltet ({garminLastSyncAgeH !== null ? garminLastSyncAgeH + 'h' : '?'} seit letztem Sync) — Garmin Connect Verbindung prüfen
                            </div>
                        )}
                        {/* Header: Zeiten + Score-Badge */}
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px'}}>
                            <div>
                                <div style={{fontSize:'0.75rem', color: isDark?'#aaa':'#666'}}>Einschlafen</div>
                                <div style={{fontSize:'1.1rem', fontWeight:'bold', color: isDark?'#eee':'#222'}}>{fmtTime(swStart)}</div>
                                <div style={{fontSize:'0.6rem', color: isDark?'#555':'#bbb', marginTop:'1px'}} title={'Erkennungsmethode: ' + srcDisplay.label}>
                                    {srcDisplay.icon} {srcDisplay.label}
                                </div>
                                {/* OC-23: Einschlafzeit-Quelle Override */}
                                {sleepStartOverridden && (
                                    <div style={{fontSize:'0.5rem', color:'#ffb300', marginTop:'1px', fontWeight:'bold'}}>✏️ manuell</div>
                                )}
                                {allSleepStartSourcesArr.length > 0 && (
                                <div style={{fontSize:'0.5rem', color:'#ff9800', marginTop:'2px', cursor: isOverrideLoading ? 'wait' : 'pointer', opacity:0.8,
                                             display:'inline-flex', alignItems:'center', gap:'3px', userSelect:'none'}}
                                    title={isOverrideLoading ? 'Wird neu berechnet...' : 'Einschlafzeit-Quelle manuell wählen'}
                                    onClick={() => { if (!isOverrideLoading) setIsOverridePanelOpen(!isOverridePanelOpen); }}>
                                    {isOverrideLoading ? '⏳' : '⚙'} Quellen {isOverridePanelOpen ? '▲' : '▼'}
                                </div>
                                )}
                                {isOverridePanelOpen && !isOverrideLoading && allSleepStartSourcesArr.length > 0 && (
                                    <div style={{marginTop:'4px', background: isDark?'#1e2a1e':'#f1f8e9',
                                                 border:'1px solid ' + (isDark?'#388e3c':'#a5d6a7'),
                                                 borderRadius:'6px', padding:'6px 8px', minWidth:'200px',
                                                 boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
                                        <div style={{fontSize:'0.55rem', color: isDark?'#aaa':'#555', marginBottom:'4px', fontWeight:'bold'}}>
                                            Einschlafzeit-Quelle wählen:
                                        </div>
                                        {allSleepStartSourcesArr.map(ss => {
                                            const info = srcInfo[ss.source] ?? { icon: '?', label: ss.source };
                                            const isActive = ss.source === sleepStartSource;
                                            const hasTs = !!ss.ts;
                                            return (
                                                <div key={ss.source} style={{
                                                    display:'flex', alignItems:'center', justifyContent:'space-between',
                                                    padding:'2px 4px', marginBottom:'2px', borderRadius:'3px',
                                                    opacity: hasTs ? 1 : 0.4,
                                                    background: isActive ? (isDark?'#1b5e20':'#c8e6c9') : 'transparent'
                                                }}>
                                                    <span style={{fontSize:'0.6rem', color: isDark?'#ddd':'#333'}}>
                                                        {info.icon} {info.label}: {ss.ts ? fmtTime(ss.ts) : '—'}
                                                        {isActive ? ' ✓' : ''}
                                                    </span>
                                                    {hasTs && !isActive && sleepDateStr && (
                                                        <button
                                                            onClick={() => handleSetOverride(ss.source, ss.ts!)}
                                                            style={{fontSize:'0.5rem', padding:'1px 6px', cursor:'pointer',
                                                                   background:'#1565c0', color:'#fff', border:'none',
                                                                   borderRadius:'3px', marginLeft:'6px', flexShrink:0}}>
                                                            Wählen
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {sleepStartOverridden && (
                                            <div style={{marginTop:'4px', borderTop:'1px solid ' + (isDark?'#444':'#ccc'), paddingTop:'4px'}}>
                                                <button onClick={handleClearOverride}
                                                    style={{fontSize:'0.5rem', padding:'2px 6px', cursor:'pointer',
                                                           background:'#b71c1c', color:'#fff', border:'none',
                                                           borderRadius:'3px', width:'100%'}}>
                                                    ↺ Automatik wiederherstellen
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div style={{textAlign:'center'}}>
                                <div style={{
                                    fontSize:'1.8rem', fontWeight:'bold', color: scoreColor,
                                    border: `2px solid ${scoreColor}`, borderRadius:'8px',
                                    padding:'4px 14px', lineHeight:'1.1'
                                }}>{scoreCal ?? score ?? '—'}</div>
                                <div style={{fontSize:'0.65rem', color:'#888', marginTop:'2px'}}>AURA-Sleepscore</div>
                                {/* Kalibrierungsstatus-Badge */}
                                {scoreCalStatus === 'calibrated' && (
                                    <div style={{fontSize:'0.55rem', color:'#43a047', marginTop:'1px', fontWeight:'bold', cursor:'help'}}
                                        title={`Kalibriert an ${scoreCalNights} Nächten mit Smartwatch-Daten (lineares Offset-Modell)`}>
                                        ✓ kalibriert ({scoreCalNights}N)
                                    </div>
                                )}
                                {scoreCalStatus === 'calibrating' && (
                                    <div style={{fontSize:'0.55rem', color:'#ffa726', marginTop:'1px', cursor:'help'}}
                                        title={`In Kalibrierung: ${scoreCalNights}/14 Smartwatch-Nächte gesammelt`}>
                                        ⟳ kalibriert ({scoreCalNights}/14N)
                                    </div>
                                )}
                                {scoreCalStatus === 'uncalibrated' && (
                                    <div style={{fontSize:'0.55rem', color: isDark?'#666':'#bbb', marginTop:'1px', cursor:'help'}}
                                        title={'Basiert auf Schlafdauer + Sensorphasen (keine Smartwatch-Kalibrierung)'}>
                                        ○ unkalibriert
                                    </div>
                                )}
                                {/* Rohwert wenn kalibrierter Score abweicht */}
                                {scoreCal !== null && score !== null && scoreCal !== score && (
                                    <div style={{fontSize:'0.55rem', color:'#888', marginTop:'1px', cursor:'help'}}
                                        title={`Unkalibrierter AURA-Score: ${score}`}>
                                        AURA: {score}
                                    </div>
                                )}
                                {sleepDurMin !== null && (
                                    <div style={{fontSize:'0.7rem', color: isDark?'#90caf9':'#1565c0', marginTop:'2px', fontWeight:'600'}}>
                                        🕐 {fmtDuration(sleepDurMin)}
                                    </div>
                                )}
                                {garminScore !== null && (
                                    <div style={{fontSize:'0.7rem', color:'#ab47bc', marginTop:'2px'}}>
                                        Garmin: {garminScore} <span style={{color: isDark?'#666':'#aaa'}}>
                                            ({garminScore - (scoreCal ?? score ?? 0) >= 0 ? '+' : ''}{garminScore - (scoreCal ?? score ?? 0)})
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div style={{textAlign:'right'}}>
                                <div style={{fontSize:'0.75rem', color: isDark?'#aaa':'#666'}}>Aufwachen</div>
                                <div style={{fontSize:'1.1rem', fontWeight:'bold', color: isDark?'#eee':'#222'}}>
                                    {wakeConfirmed ? '✓' : '⟳'} {fmtTime(swEnd)}
                                </div>
                                <div style={{fontSize:'0.6rem', color: wakeConfirmed ? (isDark?'#555':'#bbb') : '#ffab40', marginTop:'1px'}}
                                    title={wakeConfirmed
                                        ? `Bestätigt via ${wakeDisplay.label}: Bett ≥1h leer nach 10:00 Uhr`
                                        : `Vorläufig via ${wakeDisplay.label}: Wird bestätigt wenn nach 10:00 Uhr ≥1h kein Bett belegt`}>
                                    {wakeDisplay.icon} {wakeConfirmed ? 'bestätigt' : 'vorläufig'}
                                </div>
                                {/* DEV-ONLY: Quellen-Tooltip alle 8 Wake-Sensoren — später entfernen */}
                                <div style={{fontSize:'0.5rem', color:'#ff9800', marginTop:'2px', cursor:'help', opacity:0.7}}
                                    title={devWakeTooltip}>
                                    ⚙ Quellen
                                </div>
                            </div>
                        </div>

                        {/* Schlafphasen-Zeitbalken mit Dreiecks-Markern + Zeitachse */}
                        <div style={{marginBottom:'10px'}}>
                            {/* Dreiecks-Marker ÜBER Balken: Bad-Besuch orange ▼ (zeigt zum Balken runter) */}
                            {swStart && swEnd && markerItems.above.length > 0 && (
                                <div style={{position:'relative', height:'18px'}}>
                                    {markerItems.above.map(marker => (
                                        <span key={marker.key} style={{
                                            position:'absolute',
                                            left: marker.pct + '%',
                                            top: marker.lane === 0 ? '3px' : '-9px',
                                            color: stageColor[marker.evtType] ?? '#ffb300',
                                            fontSize:'14px', fontWeight:'bold',
                                            transform:'translateX(-50%)',
                                            cursor:'default', lineHeight:'13px'
                                        }} title={marker.title}>▼</span>
                                    ))}
                                </div>
                            )}
                            {/* Platzhalter damit Balken nicht springt wenn keine above-Marker */}
                            {swStart && swEnd && markerItems.above.length === 0 && markerItems.below.length > 0 && (
                                <div style={{height:'18px'}} />
                            )}

                            {/* Der Balken — proportionale Slots (5 min), no-data-Segment vor Stage-Fenster */}
                            <div style={{display:'flex', width:'100%', height:'28px', borderRadius:'4px', overflow:'hidden'}}>
                                {preStageMs > 0 && totalWindowMs && (
                                    <div style={{
                                        width: (preStageMs / totalWindowMs * 100) + '%',
                                        flexShrink: 0,
                                        backgroundColor: isDark ? '#1a1a1a' : '#eeeeee',
                                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, ' + (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)') + ' 4px, ' + (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)') + ' 8px)',
                                        borderRight: '1px dashed ' + (isDark ? '#444' : '#ccc'),
                                        minWidth: 0
                                    }} title={'Keine Sensordaten (' + (swStart ? fmtTime(swStart) : '?') + '–' + (stagesWindowStart ? fmtTime(stagesWindowStart) : '?') + ')'} />
                                )}
                                {renderedStages.map((slot, i) => {
                                    const absMs = stagesWindowStart ? stagesWindowStart + slot.t * 60000 : (swStart ? swStart + slot.t * 60000 : null);
                                    const slotW = totalWindowMs ? (5 * 60000 / totalWindowMs * 100) + '%' : undefined;
                                    return (
                                        <div key={i} style={{
                                            width: slotW,
                                            flex: slotW ? undefined : 1,
                                            backgroundColor: slotColor(slot, absMs),
                                            flexShrink: 0,
                                            minWidth: 0
                                        }} title={slotTip(slot, absMs)} />
                                    );
                                })}
                                {/* Kein-Daten-Bereich nach letztem Stage-Slot (Stages decken oft nur Anfang der Nacht ab) */}
                                {postStageMs > 0 && totalWindowMs && (
                                    <div style={{
                                        width: (postStageMs / totalWindowMs * 100) + '%',
                                        flexShrink: 0,
                                        backgroundColor: isDark ? '#1a1a1a' : '#eeeeee',
                                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, ' + (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)') + ' 4px, ' + (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)') + ' 8px)',
                                        borderLeft: '1px dashed ' + (isDark ? '#444' : '#ccc'),
                                        minWidth: 0
                                    }} title={'Keine Sensordaten (' + (lastSlotEndMs ? fmtTime(lastSlotEndMs) : '?') + '–' + (swEnd ? fmtTime(swEnd) : '?') + ')'} />
                                )}
                            </div>

                            {/* Dreiecks-Marker UNTER Balken: Außerhalb/andere Person rot ▲ (zeigt zum Balken hoch) */}
                            {swStart && swEnd && markerItems.below.length > 0 && (
                                <div style={{position:'relative', height:'18px'}}>
                                    {markerItems.below.map(marker => (
                                        <span key={marker.key} style={{
                                            position:'absolute',
                                            left: marker.pct + '%',
                                            top: marker.lane === 0 ? '2px' : '10px',
                                            color: stageColor[marker.evtType] ?? '#e53935',
                                            fontSize:'14px', fontWeight:'bold',
                                            transform:'translateX(-50%)',
                                            cursor:'default', lineHeight:'13px'
                                        }} title={marker.title}>▲</span>
                                    ))}
                                </div>
                            )}

                            {/* Zeitachse: Start, volle Stunden, Ende */}
                            {swStart && swEnd && (
                                <div style={{position:'relative', height:'14px', marginTop:'3px'}}>
                                    <span style={{position:'absolute', left:0, fontSize:'0.55rem', color: isDark?'#666':'#aaa'}}>{fmtTime(swStart)}</span>
                                    {(() => {
                                        const totalMs = swEnd - swStart;
                                        const marks: React.ReactNode[] = [];
                                        const first = new Date(swStart);
                                        first.setMinutes(0, 0, 0);
                                        first.setHours(first.getHours() + 1);
                                        let t = first.getTime();
                                        while (t < swEnd - 900000) {
                                            const pct = ((t - swStart) / totalMs) * 100;
                                            marks.push(
                                                <span key={t} style={{position:'absolute', left: pct + '%', fontSize:'0.55rem', color: isDark?'#555':'#bbb', transform:'translateX(-50%)'}}>
                                                    {fmtTime(t)}
                                                </span>
                                            );
                                            t += 3600000;
                                        }
                                        return marks;
                                    })()}
                                    <span style={{position:'absolute', right:0, fontSize:'0.55rem', color: isDark?'#666':'#aaa'}}>{fmtTime(swEnd)}</span>
                                </div>
                            )}
                        </div>

                        {/* Legende */}
                        <div style={{display:'flex', gap:'10px', flexWrap:'wrap', fontSize:'0.7rem', marginBottom:'8px'}}>
                            {([['deep','Tief'],['light','Leicht'],['rem','REM (est.)'],['wake','Wachliegen']] as [string,string][]).map(([k,l]) => (
                                <span key={k}><span style={{color: stageColor[k]}}>■</span> {l}</span>
                            ))}
                            {clippedOutsideBedEvts.some(e => e.type === 'bathroom') && (
                                <span><span style={{color: stageColor.bathroom}}>■</span> Bad</span>
                            )}
                            {clippedOutsideBedEvts.some(e => e.type === 'outside') && (
                                <span><span style={{color: stageColor.outside}}>■</span> Außerhalb</span>
                            )}
                            {clippedOutsideBedEvts.some(e => e.type === 'other_person') && (
                                <span><span style={{color: stageColor.other_person}}>■</span> Andere Person</span>
                            )}
                        </div>

                        {/* Stage-Dauer Zeile */}
                        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'4px', textAlign:'center', marginBottom:'10px'}}>
                            {([['deep','Tief',deepCount,'#1565c0'],['light','Leicht',lightCount,'#42a5f5'],['rem','REM',remCount,'#ab47bc'],['wake','Wachliegen',wakeCount,'#ffd54f']] as [string,string,number,string][]).map(([k,l,n,c]) => (
                                <div key={k} style={{borderRadius:'4px', padding:'4px', background: isDark?'#1a1a1a':'#f5f5f5'}}>
                                    <div style={{color: c, fontWeight:'bold', fontSize:'0.8rem'}}>{toH(n)}</div>
                                    <div style={{color:'#888', fontSize:'0.65rem'}}>{l}</div>
                                </div>
                            ))}
                        </div>

                        {/* Außerhalb-Zeile (wenn vorhanden) */}
                        {outsideTotalMin > 0 && (
                            <div style={{display:'flex', gap:'8px', fontSize:'0.7rem', marginBottom:'8px', color: isDark?'#aaa':'#666'}}>
                                {bathMin > 0 && <span><span style={{color: stageColor.bathroom}}>■</span> Bad: {toH(bathMin, true)}</span>}
                                {clippedOutsideBedEvts.filter(e => e.type === 'outside').reduce((a,e) => a+e.duration, 0) > 0 && <span><span style={{color: stageColor.outside}}>■</span> Außerhalb: {toH(clippedOutsideBedEvts.filter(e => e.type === 'outside').reduce((a,e) => a+e.duration, 0), true)}</span>}
                                {clippedOutsideBedEvts.filter(e => e.type === 'other_person').reduce((a,e) => a+e.duration, 0) > 0 && <span><span style={{color: stageColor.other_person}}>■</span> Andere Person: {toH(clippedOutsideBedEvts.filter(e => e.type === 'other_person').reduce((a,e) => a+e.duration, 0), true)}</span>}
                            </div>
                        )}

                        {/* Garmin-Vergleich wenn vorhanden */}
                        {(garminDeepMin !== null || garminLightMin !== null || garminRemMin !== null) && (
                            <div style={{borderTop:`1px dashed ${isDark?'#333':'#ddd'}`, paddingTop:'8px', fontSize:'0.7rem'}}>
                                <div style={{color:'#888', marginBottom:'4px'}}>📡 Garmin-Referenz:</div>
                                <div style={{display:'flex', gap:'16px'}}>
                                    {garminDeepMin  !== null && <span><span style={{color:'#1565c0'}}>■</span> Tief: {garminDeepMin}min</span>}
                                    {garminLightMin !== null && <span><span style={{color:'#42a5f5'}}>■</span> Leicht: {garminLightMin}min</span>}
                                    {garminRemMin   !== null && <span><span style={{color:'#ab47bc'}}>■</span> REM: {garminRemMin}min</span>}
                                </div>
                            </div>
                        )}

                        {/* OC-15: Batterie-Warnung — nur schlaf-relevante Sensoren */}
                        {vibBatteryWarning && vibBatteryWarning.length > 0 && (
                            <div style={{
                                borderTop: `1px dashed ${isDark?'#444':'#ddd'}`,
                                paddingTop: '6px',
                                marginTop: '6px',
                                fontSize: '0.65rem',
                                color: vibBatteryWarning.some(s => s.isCritical) ? '#f44336' : '#ff9800'
                            }}>
                                {vibBatteryWarning.map((s, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: i > 0 ? '3px' : 0 }}>
                                        <span>{s.isCritical ? '🔋' : '🪫'}</span>
                                        <span>
                                            <b>{s.name}{s.location && s.name !== s.location ? ` (${s.location})` : ''}</b>
                                            {': '}
                                            {s.isCritical ? 'Batterie kritisch' : 'Batterie niedrig'}
                                            {s.level !== null ? ` · ${s.level === 5 || s.level === 80 ? (s.level === 5 ? 'LOWBAT aktiv' : 'OK') : s.level + '%'}` : ''}
                                            {' — Schlafanalyse evtl. ungenau'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{fontSize:'0.6rem', color: isDark?'#555':'#aaa', marginTop:'8px', borderTop:`1px dashed ${isDark?'#222':'#eee'}`, paddingTop:'6px'}}>
                            ⓘ Geschätzte Schlafstadien (Vibrationssensor) · Kein Medizinprodukt
                        </div>
                    </div>
                )}
            </TerminalBox>
        );
    };

    const renderMobility = () => {
        if (!hasData || Object.keys(roomHistory).length === 0) {
            return (
                <TerminalBox title="RAUM-NUTZUNG (MOBILITÄT)" themeType={themeType}>
                    <div style={{color:'#888', fontStyle:'italic', textAlign:'center', padding:'20px'}}>Keine Daten...</div>
                </TerminalBox>
            );
        }

        const mergedRooms: Record<string, number> = {};
        Object.keys(roomHistory).forEach(rawName => {
            const clean = normalizeRoomName(rawName);
            const minutes = roomHistory[rawName].reduce((a,b)=>a+b,0);
            if (!mergedRooms[clean]) mergedRooms[clean] = 0;
            mergedRooms[clean] += minutes;
        });

        const rooms = Object.keys(mergedRooms).sort();
        let maxMin = 1;
        rooms.forEach(r => { if(mergedRooms[r]>maxMin) maxMin=mergedRooms[r]; });
        const usedCount = rooms.filter(r => mergedRooms[r] > 5).length;

        return (
            <TerminalBox title="RAUM-NUTZUNG (MOBILITÄT)" themeType={themeType}>
                <div style={{display:'grid', gridTemplateColumns: 'auto 1fr auto', gap: '10px 20px', alignItems:'center'}}>
                    {rooms.map(room => {
                        let trendIcon = '=';
                        const todayMin = mergedRooms[room];
                        let yesterdayMin = 0;
                        if (roomStats.yesterday) {
                            Object.keys(roomStats.yesterday).forEach(k => {
                                if (normalizeRoomName(k) === room) yesterdayMin += roomStats.yesterday[k];
                            });
                        }
                        if (yesterdayMin > 0) {
                            const diff = todayMin - yesterdayMin;
                            if (diff > 10) trendIcon = '⬆'; else if (diff < -10) trendIcon = '⬇';
                        }
                        // Alarm-Check für diesen Raum
                        const alert = roomAlerts && roomAlerts[room];
                        const alertDot = alert ? (
                            alert.level === 'RED' ? '🔴' : (alert.level === 'YELLOW' ? '🟡' : '')
                        ) : '';
                        
                        // Tooltip: Zeige Alarm ODER normalen Status
                        let tooltipText = '';
                        if (alert) {
                            tooltipText = alert.message;
                        } else {
                            const trend = trendIcon === '⬆' ? 'mehr als gestern' : (trendIcon === '⬇' ? 'weniger als gestern' : 'unverändert');
                            tooltipText = `${todayMin} Minuten heute (${trend})`;
                        }
                        
                        return (
                            <React.Fragment key={room}>
                                <div style={{
                                    fontWeight:'bold', 
                                    fontSize:'0.9rem', 
                                    width:'120px', 
                                    display:'flex', 
                                    alignItems:'center', 
                                    gap:'4px',
                                    cursor: 'help',
                                    textDecoration: 'underline dotted #888',
                                    textDecorationThickness: '1px',
                                    textUnderlineOffset: '2px'
                                }} 
                                title={tooltipText}>
                                    {alertDot && <span style={{fontSize:'1rem'}}>{alertDot}</span>}
                                    <span>{room}</span>
                                </div>
                                <div><RenderBlockBar val={todayMin} max={maxMin} height='18px' themeType={themeType} /></div>
                                <div style={{textAlign:'right', fontFamily:'monospace', minWidth:'120px'}}>{todayMin} min ({trendIcon})</div>
                            </React.Fragment>
                        );
                    })}
                </div>
                <div style={{fontSize:'0.8rem', color: isDark?'#888':'#666', marginTop:'15px', borderTop:`1px dashed ${isDark?'#333':'#ccc'}`, paddingTop:'5px'}}>
                    {`> Fazit: "Gute Mobilität im Haus (${usedCount} Räume aktiv genutzt)."`}
                </div>
            </TerminalBox>
        );
    };

    return (
        <Box sx={{ p: 3, bgcolor: isDark ? '#000' : '#f5f5f5', color: isDark ? '#eee' : '#222', minHeight: '100vh', fontFamily: "'Roboto Mono', 'Courier New', monospace" }}>
            
            {/* ======= NEUER BEREICH: LANGZEIT-TRENDS (GARMIN-STYLE) ======= */}
            <LongtermTrendsView
                socket={socket}
                adapterName={adapterName}
                instance={instance}
                themeType={themeType}
            />
            
            {/* ======= HORIZONTALE TRENNLINIE ======= */}
            <Divider sx={{ my: 4, borderColor: isDark ? '#444' : '#ccc', borderWidth: 2 }} />
            
            {/* ======= BESTEHENDER AURA MONITOR (UNANGETASTET) ======= */}
            <div style={{ maxWidth: '80ch', margin: '0 auto' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom: `2px solid ${isDark?'#444':'#ccc'}`, marginBottom:'30px', paddingBottom:'15px', flexWrap:'wrap', gap:'10px' }}>
                    <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                        <strong style={{fontSize:'1.2rem'}}>AURA MONITOR (v0.30.68)</strong>
                        <div style={{display:'flex', alignItems:'center', backgroundColor: isDark?'#222':'#e0e0e0', borderRadius:'4px', padding:'2px'}}>
                            <IconButton 
                                size="small" 
                                onClick={() => (viewMode === 'WEEK' || viewMode === 'MONTH') ? handlePrevWeek() : handleDateChange(-1)} 
                                disabled={loading}
                            >
                                <ArrowBackIosIcon fontSize="small" />
                            </IconButton>
                            <span style={{margin:'0 10px', fontWeight:'bold', minWidth:'180px', textAlign:'center'}}>
                                {(() => {
                                    if (viewMode === 'DAY') {
                                        return viewDate.toLocaleDateString('de-DE', {weekday: 'long', day:'2-digit', month:'2-digit'});
                                    }
                                    const days = viewMode === 'WEEK' ? 7 : 30;
                                    // weekOffset = 0 → heute bis heute-6 (7 Tage)
                                    // weekOffset = -1 → heute-7 bis heute-13 (7 Tage)
                                    const oldestDayOffset = (Math.abs(weekOffset) * days) + (days - 1);
                                    const newestDayOffset = Math.abs(weekOffset) * days;
                                    
                                    const startDate = new Date();
                                    startDate.setDate(startDate.getDate() - oldestDayOffset);
                                    const endDate = new Date();
                                    endDate.setDate(endDate.getDate() - newestDayOffset);
                                    return `${startDate.getDate()}.${startDate.getMonth()+1}. - ${endDate.getDate()}.${endDate.getMonth()+1}.`;
                                })()}
                            </span>
                            <IconButton 
                                size="small" 
                                onClick={() => (viewMode === 'WEEK' || viewMode === 'MONTH') ? handleNextWeek() : handleDateChange(1)} 
                                disabled={loading || (viewMode === 'DAY' && isLive) || (viewMode !== 'DAY' && weekOffset >= 0)}
                            >
                                <ArrowForwardIosIcon fontSize="small" />
                            </IconButton>
                        </div>
                    </div>
                    
                    <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                        <div style={{display:'flex', gap:'5px', border: `1px solid ${isDark?'#444':'#bbb'}`, borderRadius:'4px', padding:'2px'}}>
                            <button 
                                onClick={() => {setViewMode('DAY'); setWeekOffset(0); if(isLive) fetchData();}}
                                style={{
                                    padding: '6px 16px',
                                    border: 'none',
                                    background: viewMode === 'DAY' ? (isDark?'#333':'#ddd') : 'transparent',
                                    color: viewMode === 'DAY' ? (isDark?'#00e676':'#2196f3') : (isDark?'#888':'#666'),
                                    cursor: 'pointer',
                                    fontWeight: viewMode === 'DAY' ? 'bold' : 'normal',
                                    fontSize: '0.85rem',
                                    borderRadius: '2px',
                                    fontFamily: 'monospace'
                                }}
                            >
                                TAG
                            </button>
                            <button 
                                onClick={() => {setViewMode('WEEK'); setWeekOffset(0); loadWeekData(7);}}
                                style={{
                                    padding: '6px 16px',
                                    border: 'none',
                                    background: viewMode === 'WEEK' ? (isDark?'#333':'#ddd') : 'transparent',
                                    color: viewMode === 'WEEK' ? (isDark?'#00e676':'#2196f3') : (isDark?'#888':'#666'),
                                    cursor: 'pointer',
                                    fontWeight: viewMode === 'WEEK' ? 'bold' : 'normal',
                                    fontSize: '0.85rem',
                                    borderRadius: '2px',
                                    fontFamily: 'monospace'
                                }}
                            >
                                WOCHE
                            </button>
                            <button 
                                onClick={() => {setViewMode('MONTH'); setWeekOffset(0); loadWeekData(30);}}
                                style={{
                                    padding: '6px 16px',
                                    border: 'none',
                                    background: viewMode === 'MONTH' ? (isDark?'#333':'#ddd') : 'transparent',
                                    color: viewMode === 'MONTH' ? (isDark?'#00e676':'#2196f3') : (isDark?'#888':'#666'),
                                    cursor: 'pointer',
                                    fontWeight: viewMode === 'MONTH' ? 'bold' : 'normal',
                                    fontSize: '0.85rem',
                                    borderRadius: '2px',
                                    fontFamily: 'monospace'
                                }}
                            >
                                MONAT
                            </button>
                        </div>
                        
                        <div style={{textAlign:'right'}}>
                            <div style={{display:'flex', alignItems:'center', gap:'5px', justifyContent:'flex-end'}}>
                                <div style={{width:'8px', height:'8px', borderRadius:'50%', backgroundColor: isLive ? '#00e676' : '#888', boxShadow: isLive ? '0 0 5px #00e676' : 'none'}}></div>
                                <span style={{fontSize:'0.9rem', color: isLive ? '#00e676' : '#888'}}>{isLive ? 'LIVE' : 'ARCHIV'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Alert-Feed für Wochenansicht / Monatsansicht */}
                {(viewMode === 'WEEK' || viewMode === 'MONTH') && weekAlerts.length > 0 && (
                    <div style={{
                        marginBottom: '20px',
                        padding: '15px',
                        border: `2px solid ${isDark?'#ffab40':'#ff9800'}`,
                        borderRadius: '4px',
                        backgroundColor: isDark ? '#1a1410' : '#fff3e0'
                    }}>
                        <div style={{
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            color: '#ffab40',
                            marginBottom: '10px',
                            textTransform: 'uppercase',
                            letterSpacing: '1px'
                        }}>
                            ⚠️ AUFFÄLLIGKEITEN DIESE WOCHE
                        </div>
                        {weekAlerts.map((alert, idx) => (
                            <div key={idx} style={{
                                fontSize: '0.9rem',
                                padding: '8px 0',
                                borderBottom: idx < weekAlerts.length - 1 ? `1px dashed ${isDark?'#333':'#ccc'}` : 'none',
                                color: alert.severity === 'warn' ? '#ff5252' : '#2196f3'
                            }}>
                                {alert.severity === 'warn' ? '🔴' : 'ℹ️'} {alert.text}
                            </div>
                        ))}
                    </div>
                )}

                {/* HEATMAP: N-Tage × 24-Stunden Aktivitäts-Visualisierung */}
                {(viewMode === 'WEEK' || viewMode === 'MONTH') && weekData.length > 0 && (
                    <TerminalBox 
                        title={`AKTIVITÄTS-HEATMAP (${viewMode === 'MONTH' ? '30' : '7'} TAGE × 24H) ${heatmapAnalysis ? '🧠' : '⚠️ FALLBACK'}`} 
                        themeType={themeType}
                    >
                        <div style={{overflowX:'auto', padding:'10px 0'}}>
                            <div style={{display:'flex', flexDirection:'column', gap:'1px', minWidth:'600px'}}>
                                {/* Stunden-Header */}
                                <div style={{display:'flex', marginBottom:'3px'}}>
                                    <div style={{width:'50px', fontSize:'0.65rem', color:'#888', textAlign:'right', paddingRight:'8px'}}>TAG</div>
                                    {Array.from({length:24}, (_, h) => (
                                        <div key={h} style={{
                                            flex:'1',
                                            minWidth:'8px',
                                            fontSize:'0.6rem',
                                            color:isDark?'#888':'#666',
                                            textAlign:'center',
                                            fontFamily:'monospace'
                                        }}>
                                            {h.toString().padStart(2, '0')}
                                        </div>
                                    ))}
                                </div>

                                {/* Heatmap-Zeilen (7 Tage) - INTELLIGENTE BACKEND-LOGIK MIT FALLBACK */}
                                {weekData.slice().reverse().map((day, idx) => {
                                    const isToday = idx === 0;
                                    
                                    // Lade intelligente Backend-Daten (falls vorhanden)
                                    const dayAnalysis = heatmapAnalysis && heatmapAnalysis[day.dateStr];
                                    
                                    // FALLBACK: Falls Backend nicht antwortet, berechne lokal
                                    let hourlyActivity: number[] = [];
                                    let anomalyScores: number[] = [];
                                    let ruleFlags: string[] = [];
                                    
                                    if (dayAnalysis) {
                                        // Backend-Daten vorhanden
                                        hourlyActivity = dayAnalysis.hourly_counts || Array(24).fill(0);
                                        anomalyScores = dayAnalysis.anomaly_scores || Array(24).fill(0);
                                        ruleFlags = dayAnalysis.rule_flags || Array(24).fill('NORMAL');
                                    } else {
                                        // Fallback: Lokale Berechnung
                                        hourlyActivity = Array.from({length:24}, (_, hour) => {
                                            if (!day.hasData || !day.data?.eventHistory) return 0;
                                            
                                            const hourStart = new Date(day.date);
                                            hourStart.setHours(hour, 0, 0, 0);
                                            const hourEnd = new Date(day.date);
                                            hourEnd.setHours(hour, 59, 59, 999);
                                            
                                            const eventsInHour = day.data.eventHistory.filter((e: any) => {
                                                const isMotion = e.type === 'motion' || e.type === 'presence_radar_bool';
                                                return isMotion && e.value === true && 
                                                       e.timestamp >= hourStart.getTime() && 
                                                       e.timestamp <= hourEnd.getTime();
                                            }).length;
                                            
                                            return eventsInHour;
                                        });
                                        anomalyScores = Array(24).fill(0);
                                        ruleFlags = Array(24).fill('NORMAL');
                                    }
                                    
                                    return (
                                        <div key={idx} style={{display:'flex', alignItems:'center'}}>
                                            <div style={{
                                                width:'50px',
                                                fontSize:'0.7rem',
                                                fontWeight: isToday ? 'bold' : 'normal',
                                                color: isToday ? '#00e676' : (isDark?'#eee':'#333'),
                                                textAlign:'right',
                                                paddingRight:'8px'
                                            }}>
                                                {day.dayName} {isToday && '●'}
                                            </div>
                                            {hourlyActivity.map((events, hour) => {
                                                // INTELLIGENTE FARBCODIERUNG (3-Schichten-Ansatz)
                                                const score = anomalyScores[hour];
                                                const flag = ruleFlags[hour];
                                                
                                                let bgColor = '#1a1a1a'; // Dunkel (keine Daten/Schlafphase)
                                                let tooltip = `${day.dayName} ${hour}:00 → ${events} Events`;
                                                
                                                // Schicht 1: Regel-basiert (überschreibt alles!)
                                                if (flag === 'NIGHT_HIGH_ACTIVITY') {
                                                    bgColor = isDark ? '#8b0000' : '#ff6b6b'; // Dunkelrot (Alarm!)
                                                    tooltip += ' | ⚠️ NACHTS VIEL AKTIVITÄT!';
                                                } else if (flag === 'MORNING_NO_ACTIVITY') {
                                                    bgColor = isDark ? '#8b3a00' : '#ff9500'; // Orange (Warnung!)
                                                    tooltip += ' | ⚠️ MORGENS KEINE AKTIVITÄT!';
                                                } else if (flag === 'DAY_LOW_ACTIVITY') {
                                                    bgColor = isDark ? '#4a3a16' : '#fff9c4'; // Gelb (Beobachten)
                                                    tooltip += ' | ⚪ Ruhiger Tag';
                                                }
                                                // Schicht 2: IsolationForest (wenn keine Regel greift)
                                                else if (score < -0.5) {
                                                    bgColor = isDark ? '#8b0000' : '#ff6b6b'; // Rot (Anomalie!)
                                                    tooltip += ' | ⚠️ ANOMALIE erkannt!';
                                                } else if (score < -0.2) {
                                                    bgColor = isDark ? '#4a3a16' : '#fff9c4'; // Gelb (Leicht auffällig)
                                                    tooltip += ' | ⚪ Leichte Abweichung';
                                                } else if (events > 0) {
                                                    bgColor = isDark ? '#1a4a1a' : '#c8e6c9'; // Grün (Normal!)
                                                    tooltip += ' | ✅ Normal';
                                                }
                                                
                                                return (
                                                    <div
                                                        key={hour}
                                                        title={tooltip}
                                                        style={{
                                                            flex:'1',
                                                            height:'15px',
                                                            minWidth:'8px',
                                                            backgroundColor: bgColor,
                                                            border: `1px solid ${isDark?'#000':'#ddd'}`,
                                                            cursor:'pointer',
                                                            transition:'transform 0.1s',
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.3)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                    />
                                                );
                                            })}
                                        </div>
                                    );
                                })}

                                {/* INTELLIGENTE LEGENDE */}
                                <div style={{
                                    marginTop:'15px',
                                    padding:'12px',
                                    border:`1px solid ${isDark?'#333':'#ccc'}`,
                                    borderRadius:'4px',
                                    backgroundColor:isDark?'#1a1a1a':'#f5f5f5'
                                }}>
                                    <div style={{fontSize:'0.75rem', fontWeight:'bold', color:'#888', marginBottom:'8px', textTransform:'uppercase'}}>
                                        {heatmapAnalysis ? '🧠 KI-GESTEUERTE ANOMALIE-ERKENNUNG' : '⚠️ FALLBACK-MODUS (Event-Zählung)'}
                                    </div>
                                    <div style={{display:'flex', justifyContent:'space-around', gap:'15px', flexWrap:'wrap'}}>
                                        <div style={{display:'flex', alignItems:'center', gap:'5px'}}>
                                            <div style={{width:'15px', height:'15px', backgroundColor:isDark?'#1a4a1a':'#c8e6c9', border:'1px solid #888'}}/>
                                            <span style={{fontSize:'0.7rem', color:isDark?'#bbb':'#555'}}>
                                                {heatmapAnalysis ? '✅ Normal' : 'Viele Events'}
                                            </span>
                                        </div>
                                        <div style={{display:'flex', alignItems:'center', gap:'5px'}}>
                                            <div style={{width:'15px', height:'15px', backgroundColor:isDark?'#4a3a16':'#fff9c4', border:'1px solid #888'}}/>
                                            <span style={{fontSize:'0.7rem', color:isDark?'#bbb':'#555'}}>
                                                {heatmapAnalysis ? '⚪ Leichte Abweichung' : 'Wenige Events'}
                                            </span>
                                        </div>
                                        {heatmapAnalysis && (
                                            <div style={{display:'flex', alignItems:'center', gap:'5px'}}>
                                                <div style={{width:'15px', height:'15px', backgroundColor:isDark?'#8b0000':'#ff6b6b', border:'1px solid #888'}}/>
                                                <span style={{fontSize:'0.7rem', color:isDark?'#bbb':'#555'}}>⚠️ ANOMALIE erkannt!</span>
                                            </div>
                                        )}
                                        <div style={{display:'flex', alignItems:'center', gap:'5px'}}>
                                            <div style={{width:'15px', height:'15px', backgroundColor:'#1a1a1a', border:'1px solid #888'}}/>
                                            <span style={{fontSize:'0.7rem', color:isDark?'#bbb':'#555'}}>Keine Daten / Schlaf</span>
                                        </div>
                                    </div>
                                    <div style={{fontSize:'0.65rem', color:'#666', marginTop:'8px', fontStyle:'italic', textAlign:'center'}}>
                                        {heatmapAnalysis 
                                            ? 'Kombiniert IsolationForest (ML) + Tageszeiten-Regeln. Hover für Details.'
                                            : '⚠️ Python-Backend nicht erreichbar. Zeige rohe Event-Zählung. Öffne Browser-Console für Details.'
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TerminalBox>
                )}

                {/* WOCHENANSICHT / MONATSANSICHT */}
                {(viewMode === 'WEEK' || viewMode === 'MONTH') && (
                    <div>
                        <TerminalBox title={`${viewMode === 'MONTH' ? '30' : '7'}-TAGE-ÜBERSICHT`} themeType={themeType}>
                            {loading ? (
                                <div style={{textAlign:'center', padding:'40px', color:'#888'}}>Lade Wochendaten...</div>
                            ) : weekData.length === 0 ? (
                                <div style={{textAlign:'center', padding:'40px', color:'#888'}}>Keine Daten verfügbar</div>
                            ) : (
                                <div style={{overflowX:'auto'}}>
                                    <table style={{width:'100%', borderCollapse:'collapse', fontSize:'0.85rem'}}>
                                        <thead>
                                            <tr style={{borderBottom:`2px solid ${isDark?'#444':'#ccc'}`}}>
                                                <th style={{padding:'10px', textAlign:'left', color:isDark?'#888':'#666'}}>TAG</th>
                                                <th style={{padding:'10px', textAlign:'center', color:isDark?'#888':'#666'}}>WC-NACHT</th>
                                                <th style={{padding:'10px', textAlign:'center', color:isDark?'#888':'#666'}}>NACHT-AKTIVITÄT</th>
                                                <th style={{padding:'10px', textAlign:'center', color:isDark?'#888':'#666'}}>AKTIVITÄT</th>
                                                <th style={{padding:'10px', textAlign:'center', color:isDark?'#888':'#666'}}>FRISCHLUFT</th>
                                                <th style={{padding:'10px', textAlign:'left', color:isDark?'#888':'#666'}}>KI-ZUSAMMENFASSUNG</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {weekData.map((day, idx) => {
                                                // WC-Gänge nachts berechnen
                                                const nightBathroom = day.hasData && day.data?.eventHistory ? 
                                                    day.data.eventHistory.filter((e: any) => {
                                                        const hour = new Date(e.timestamp).getHours();
                                                        const isNight = hour >= 22 || hour < 8;
                                                        const isBathroom = getRoomCategory(e.name || e.location || '') === 'BATHROOM';
                                        const isMotion = e.type === 'motion' || e.type === 'presence_radar_bool';
                                        return isNight && isBathroom && isMotion && e.value === true;
                                                    }).length : 0;
                                                
                                                // Nacht-Aktivität (Bewegungen im Schlafbereich)
                                                const nightActivity = day.hasData && day.data?.eventHistory ? 
                                                    day.data.eventHistory.filter((e: any) => {
                                                        const hour = new Date(e.timestamp).getHours();
                                                        const isNight = hour >= 22 || hour < 8;
                                                        const isBedroom = getRoomCategory(e.name || e.location || '') === 'BEDROOM';
                                        const isMotion = e.type === 'motion' || e.type === 'presence_radar_bool';
                                        return isNight && isBedroom && isMotion && e.value === true;
                                                    }).length : 0;
                                                
                                                // Berechne Aktivität RELATIV zur Baseline (von Backend)
                                                let activity = 0;
                                                const dayAnalysis = heatmapAnalysis && heatmapAnalysis[day.dateStr];
                                                
                                                if (dayAnalysis && dayAnalysis.activity_percent) {
                                                    // Backend liefert baseline-relative Prozente
                                                    const activityValues = dayAnalysis.activity_percent;
                                                    const avgActivity = activityValues.reduce((a: number, b: number) => a + b, 0) / activityValues.length;
                                                    activity = Math.round(avgActivity);
                                                } else if (day.hasData && day.data?.eventHistory) {
                                                    // Fallback: Alte Formel (falls Backend nicht antwortet)
                                    const motionEvents = day.data.eventHistory.filter((e: any) => {
                                        const isMotion = e.type === 'motion' || e.type === 'presence_radar_bool';
                                        return isMotion && e.value === true;
                                                    }).length;
                                                    activity = Math.min(100, Math.max(20, Math.round(20 + (motionEvents / 12.5))));
                                                }
                                                
                                                const freshAir = day.data?.freshAirCount || 0;
                                                
                                                // Parse KI-Zusammenfassung (multi-format: JSON-Objekt, Array, Klartext)
                                                let summary = '';
                                                if (day.data?.geminiDay && day.data.geminiDay !== 'Keine Daten') {
                                                    try {
                                                        let val: any = day.data.geminiDay;
                                                        // String → parsen
                                                        if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('[') || val.startsWith('"'))) {
                                                            try { val = JSON.parse(val); } catch {}
                                                        }
                                                        // Array → erstes Element
                                                        if (Array.isArray(val) && val.length > 0) val = val[0];
                                                        // Objekt → summary / analyse / text extrahieren
                                                        if (typeof val === 'object' && val !== null) {
                                                            val = val.summary || val.analyse || val.text || val.antwort || val.status_bericht || val.message || JSON.stringify(val);
                                                        }
                                                        if (typeof val === 'string') summary = val;
                                                    } catch {
                                                        summary = String(day.data.geminiDay).substring(0, 150);
                                                    }
                                                }
                                                
                                                const isToday = idx === weekData.length - 1;
                                                
                                                return (
                                                    <tr key={idx} style={{
                                                        borderBottom: `1px solid ${isDark?'#222':'#eee'}`,
                                                        backgroundColor: isToday ? (isDark?'#0a1510':'#e8f5e9') : 'transparent'
                                                    }}>
                                                        <td style={{padding:'12px', fontWeight: isToday ? 'bold' : 'normal'}}>
                                                            <div style={{display:'flex', flexDirection:'column', gap:'2px'}}>
                                                                <div style={{display:'flex', alignItems:'center', gap:'6px'}}>
                                                                    <span style={{fontSize:'0.9rem', fontWeight:'bold', color:isDark?'#eee':'#222'}}>{day.dayName}</span>
                                                                    {isToday && <span style={{fontSize:'0.9rem', color:'#00e676'}}>●</span>}
                                                                </div>
                                                                <span style={{fontSize:'0.75rem', color:isDark?'#888':'#666'}}>{day.date.getDate()}.{day.date.getMonth()+1}.26</span>
                                                            </div>
                                                        </td>
                                                        <td style={{padding:'12px', textAlign:'center'}}>
                                                            <span style={{
                                                                fontWeight:'bold',
                                                                color: nightBathroom >= 4 ? '#ff5252' : (nightBathroom >= 2 ? '#ffab40' : '#00e676')
                                                            }}>
                                                                {day.hasData ? `${nightBathroom}x` : '-'}
                                                            </span>
                                                        </td>
                                                        <td style={{padding:'12px', textAlign:'center'}}>
                                                            <span style={{
                                                                fontWeight:'bold',
                                                                color: nightActivity >= 10 ? '#ffab40' : '#00e676'
                                                            }}>
                                                                {day.hasData ? `${nightActivity}x` : '-'}
                                                            </span>
                                                        </td>
                                                        <td style={{padding:'12px', textAlign:'center'}}>
                                                            <div style={{display:'flex', alignItems:'center', gap:'5px', justifyContent:'center'}}>
                                                                <span style={{fontWeight:'bold', color: activity >= 70 ? '#00e676' : (activity >= 50 ? '#ffab40' : '#ff5252')}}>
                                                                    {day.hasData ? `${activity}%` : '-'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td style={{padding:'12px', textAlign:'center'}}>
                                                            <span style={{fontWeight:'bold', color: freshAir > 0 ? '#00e676' : '#888'}}>
                                                                {day.hasData ? `${freshAir}x` : '-'}
                                                            </span>
                                                        </td>
                                                        <td style={{padding:'12px', fontSize:'0.8rem', fontStyle:'italic', color: summary ? (isDark?'#aaa':'#555') : '#555', maxWidth:'350px', cursor: summary.length > 80 ? 'help' : 'default'}} title={summary.length > 80 ? summary : ''}>
                                                            {!day.hasData ? '-' : summary ? `"${summary.substring(0, 80)}${summary.length > 80 ? '...' : ''}"` : <span style={{color:'#555', fontStyle:'normal', fontSize:'0.75rem'}}>— Analyse noch nicht gespeichert —</span>}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </TerminalBox>

                        {/* SCHLAF-SCORE & PHASEN — OC-7 Wochenübersicht */}
                        <TerminalBox title={`SCHLAF-SCORE & PHASEN - ${viewMode === 'MONTH' ? '30 TAGE' : '7 TAGE'}`} themeType={themeType} style={{marginTop:'20px'}}>
                            {(() => {
                                const orderedSleepData = [...weekData].reverse(); // älteste links → neueste rechts
                                const sleepChartData = orderedSleepData.map((day: any) => {
                                    const stages: any[] = day.data?.sleepStages || [];
                                    const total = stages.length;
                                    const deep  = total > 0 ? Math.round(stages.filter((s: any) => s.s === 'deep').length  / total * 100) : null;
                                    const light = total > 0 ? Math.round(stages.filter((s: any) => s.s === 'light').length / total * 100) : null;
                                    const rem   = total > 0 ? Math.round(stages.filter((s: any) => s.s === 'rem').length   / total * 100) : null;
                                    const wake  = total > 0 ? Math.round(stages.filter((s: any) => s.s === 'wake').length  / total * 100) : null;
                                    return {
                                        dayName: (day.dayName || '').substring(0, 2),
                                        hasData: day.hasData,
                                        score: (day.data?.sleepScore != null) ? Number(day.data.sleepScore) : null,
                                        garminScore: (day.data?.garminScore != null) ? Number(day.data.garminScore) : null,
                                        deep, light, rem, wake,
                                        hasStages: total > 0,
                                    };
                                });

                                const hasSleepScore = sleepChartData.some((d: any) => d.score != null);
                                const hasSleepStages = sleepChartData.some((d: any) => d.hasStages);

                                if (!hasSleepScore && !hasSleepStages) {
                                    return (
                                        <div style={{textAlign:'center', padding:'30px', color:'#888', fontSize:'0.8rem'}}>
                                            Keine Schlaf-Score-Daten verfügbar — erscheint ab der ersten analysierten Nacht.
                                        </div>
                                    );
                                }

                                const scoreCol = (s: number | null) => s == null ? '#555' : s >= 80 ? '#00e676' : s >= 60 ? '#ffab40' : '#ff5252';
                                const n = sleepChartData.length;
                                const slotW = 100 / n;
                                const barW = slotW - 0.8;
                                const chartH = 90;

                                const avgScores = sleepChartData.filter((d: any) => d.score != null).map((d: any) => d.score as number);
                                const avgScore = avgScores.length > 0 ? Math.round(avgScores.reduce((a: number, b: number) => a + b, 0) / avgScores.length) : null;
                                const stageNights = sleepChartData.filter((d: any) => d.hasStages);
                                const avgDeep = stageNights.length > 0 ? Math.round(stageNights.reduce((s: number, d: any) => s + (d.deep||0), 0) / stageNights.length) : null;
                                const avgRem  = stageNights.length > 0 ? Math.round(stageNights.reduce((s: number, d: any) => s + (d.rem||0),  0) / stageNights.length) : null;

                                return (
                                    <div style={{display:'grid', gridTemplateColumns: hasSleepScore && hasSleepStages ? '1fr 1fr' : '1fr', gap:'24px', padding:'8px 0'}}>

                                        {/* Option A: AURA-SLEEPSCORE */}
                                        {hasSleepScore && (
                                            <div>
                                                <div style={{fontSize:'0.65rem', color:isDark?'#888':'#666', marginBottom:'6px', letterSpacing:'0.08em'}}>
                                                    AURA-SLEEPSCORE{avgScore != null ? ` · Ø ${avgScore}` : ''}
                                                </div>
                                                <svg width="100%" height={chartH} viewBox={`0 0 100 ${chartH}`} preserveAspectRatio="none" style={{display:'block'}}>
                                                    {/* Referenzlinien */}
                                                    <line x1="0" y1={chartH*0.2} x2="100" y2={chartH*0.2} stroke="#00e67622" strokeWidth="0.8" vectorEffect="non-scaling-stroke"/>
                                                    <line x1="0" y1={chartH*0.4} x2="100" y2={chartH*0.4} stroke={isDark?'#222':'#eee'} strokeWidth="0.3" strokeDasharray="2,2" vectorEffect="non-scaling-stroke"/>
                                                    <line x1="0" y1={chartH}     x2="100" y2={chartH}     stroke={isDark?'#333':'#ccc'} strokeWidth="0.5" vectorEffect="non-scaling-stroke"/>
                                                    {/* Balken + Garmin-Punkt */}
                                                    {sleepChartData.map((d: any, i: number) => {
                                                        const x = i * slotW + 0.4;
                                                        const bH = d.score != null ? (d.score / 100) * (chartH - 4) : 0;
                                                        const bY = chartH - bH;
                                                        return (
                                                            <g key={i}>
                                                                <rect x={x} y={bY} width={barW} height={bH} fill={d.score != null ? scoreCol(d.score) : '#333'} opacity={0.85} rx="0.5" />
                                                                {d.garminScore != null && (
                                                                    <circle cx={x + barW/2} cy={chartH - (d.garminScore / 100) * (chartH - 4) - 1} r="1.1" fill="#ab47bc" opacity="0.9" />
                                                                )}
                                                            </g>
                                                        );
                                                    })}
                                                </svg>
                                                {/* X-Labels */}
                                                <div style={{display:'flex', fontSize:'0.55rem', color:isDark?'#666':'#aaa', marginTop:'3px'}}>
                                                    {sleepChartData.map((d: any, i: number) => (
                                                        <span key={i} style={{flex:1, textAlign:'center'}}>{d.dayName}</span>
                                                    ))}
                                                </div>
                                                {/* Score-Werte */}
                                                <div style={{display:'flex', fontSize:'0.6rem', marginTop:'2px'}}>
                                                    {sleepChartData.map((d: any, i: number) => (
                                                        <span key={i} style={{flex:1, textAlign:'center', color:scoreCol(d.score), fontWeight:'bold'}}>
                                                            {d.score != null ? d.score : '—'}
                                                        </span>
                                                    ))}
                                                </div>
                                                <div style={{fontSize:'0.55rem', color:'#888', marginTop:'6px', display:'flex', gap:'8px', flexWrap:'wrap'}}>
                                                    <span style={{color:'#ff5252'}}>■ &lt;60</span>
                                                    <span style={{color:'#ffab40'}}>■ 60–79</span>
                                                    <span style={{color:'#00e676'}}>■ ≥80</span>
                                                    <span style={{color:'#ab47bc'}}>● Garmin</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Option B: SCHLAFPHASEN-ANTEILE */}
                                        {hasSleepStages && (
                                            <div>
                                                <div style={{fontSize:'0.65rem', color:isDark?'#888':'#666', marginBottom:'6px', letterSpacing:'0.08em'}}>
                                                    SCHLAFPHASEN-ANTEILE{avgDeep != null ? ` · Ø Tief ${avgDeep}% · Ø REM ${avgRem}%` : ''}
                                                </div>
                                                <svg width="100%" height={chartH} viewBox={`0 0 100 ${chartH}`} preserveAspectRatio="none" style={{display:'block'}}>
                                                    <line x1="0" y1={chartH} x2="100" y2={chartH} stroke={isDark?'#333':'#ccc'} strokeWidth="0.5" vectorEffect="non-scaling-stroke"/>
                                                    {sleepChartData.map((d: any, i: number) => {
                                                        const x = i * slotW + 0.4;
                                                        if (!d.hasStages) {
                                                            return <rect key={i} x={x} y={0} width={barW} height={chartH} fill={isDark?'#1a1a1a':'#f0f0f0'} />;
                                                        }
                                                        const dH = ((d.deep  || 0) / 100) * chartH;
                                                        const lH = ((d.light || 0) / 100) * chartH;
                                                        const rH = ((d.rem   || 0) / 100) * chartH;
                                                        const wH = ((d.wake  || 0) / 100) * chartH;
                                                        return (
                                                            <g key={i}>
                                                                <rect x={x} y={0}              width={barW} height={dH} fill="#1565c0" opacity={0.85} />
                                                                <rect x={x} y={dH}             width={barW} height={lH} fill="#42a5f5" opacity={0.85} />
                                                                <rect x={x} y={dH+lH}          width={barW} height={rH} fill="#ab47bc" opacity={0.85} />
                                                                <rect x={x} y={dH+lH+rH}       width={barW} height={wH} fill="#ffd54f" opacity={0.85} />
                                                            </g>
                                                        );
                                                    })}
                                                    {/* Score-Linie */}
                                                    {hasSleepScore && (() => {
                                                        const pts = sleepChartData
                                                            .map((d: any, i: number) => d.score != null
                                                                ? `${i * slotW + slotW/2},${chartH - (d.score / 100) * (chartH - 4) - 1}`
                                                                : null)
                                                            .filter(Boolean).join(' ');
                                                        return pts ? <polyline points={pts} fill="none" stroke="#ffffff" strokeWidth="0.8" strokeDasharray="2,1" opacity="0.5" vectorEffect="non-scaling-stroke" /> : null;
                                                    })()}
                                                </svg>
                                                {/* X-Labels */}
                                                <div style={{display:'flex', fontSize:'0.55rem', color:isDark?'#666':'#aaa', marginTop:'3px'}}>
                                                    {sleepChartData.map((d: any, i: number) => (
                                                        <span key={i} style={{flex:1, textAlign:'center'}}>{d.dayName}</span>
                                                    ))}
                                                </div>
                                                <div style={{fontSize:'0.55rem', color:'#888', marginTop:'6px', display:'flex', gap:'8px', flexWrap:'wrap'}}>
                                                    <span style={{color:'#1565c0'}}>■ Tief</span>
                                                    <span style={{color:'#42a5f5'}}>■ Leicht</span>
                                                    <span style={{color:'#ab47bc'}}>■ REM</span>
                                                    <span style={{color:'#ffd54f'}}>■ Wachliegen</span>
                                                    {hasSleepScore && <span style={{color:'#888'}}>--- Score</span>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </TerminalBox>

                        {/* RAUM-NUTZUNG HISTOGRAMME (NEU!) */}
                        <TerminalBox title={`RAUM-NUTZUNG (MOBILITÄT) - ${viewMode === 'MONTH' ? '30 TAGE' : '7 TAGE'}`} themeType={themeType} style={{marginTop:'20px'}}>
                            {(() => {
                                // Extrahiere Raum-Daten aus weekData
                                const roomTimeSeriesMap: Record<string, number[]> = {};
                                
                                // Älteste Tage zuerst → neuster Tag ist INDEX LETZTES = RECHTS im Chart
                                const orderedWeekData = [...weekData].reverse();
                                orderedWeekData.forEach(day => {
                                    if (day.hasData && day.data && day.data.roomHistory) {
                                        const roomHist = day.data.roomHistory.history || {};
                                        Object.keys(roomHist).forEach(room => {
                                            if (!roomTimeSeriesMap[room]) roomTimeSeriesMap[room] = [];
                                            const hourlyData = roomHist[room];
                                            const dayTotal = Array.isArray(hourlyData) 
                                                ? hourlyData.reduce((sum: number, h: number) => sum + h, 0) 
                                                : 0;
                                            roomTimeSeriesMap[room].push(dayTotal);
                                        });
                                    }
                                });
                                
                                // Sortiere Räume nach Gesamt-Nutzung (absteigend)
                                const sortedRooms = Object.keys(roomTimeSeriesMap)
                                    .map(room => ({
                                        room,
                                        data: roomTimeSeriesMap[room],
                                        total: roomTimeSeriesMap[room].reduce((a,b) => a+b, 0)
                                    }))
                                    .sort((a, b) => b.total - a.total);
                                
                                if (sortedRooms.length === 0) {
                                    return <div style={{textAlign:'center', padding:'40px', color:'#888'}}>Keine Raumdaten verfügbar</div>;
                                }
                                
                                // ALLE RÄUME: GARMIN-STYLE LINIEN + PUNKTE
                                // 2 Spalten, kein Overflow, mit Y-Achse + Hover-Tooltip
                                return (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                        gap: '16px',
                                        padding: '10px 0',
                                        width: '100%',
                                        boxSizing: 'border-box'
                                    }}>
                                        {sortedRooms.map(({room, data, total}, roomIdx) => {
                                            const mean = data.reduce((a,b) => a+b, 0) / data.length;
                                            const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
                                            const std = Math.sqrt(variance);
                                            const anomalyThreshold = mean - (2 * std);
                                            const maxVal = Math.max(...data, 1); // mind. 1 um Division durch 0 zu vermeiden
                                            const avg = Math.round(mean);
                                            const yAxisWidth = 28; // Platz für Y-Achse
                                            
                                            return (
                                                <div key={room} style={{
                                                    border: `1px solid ${isDark?'#333':'#ccc'}`,
                                                    borderRadius: '6px',
                                                    padding: '10px',
                                                    backgroundColor: isDark?'#1a1a1a':'#fafafa',
                                                    minWidth: 0, // Verhindert Overflow im Grid
                                                    overflow: 'hidden'
                                                }}>
                                                    <div style={{fontSize:'0.75rem', fontWeight:'bold', marginBottom:'8px', color: isDark?'#00e676':'#2196f3', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                                                        {room.toUpperCase()}
                                                    </div>
                                                    
                                                    {/* CHART: Y-Achse + SVG nebeneinander */}
                                                    <div style={{position:'relative', height:'90px', marginBottom:'4px', display:'flex', overflow:'hidden'}}>
                                                        {/* Y-Achse */}
                                                        <div style={{width:`${yAxisWidth}px`, flexShrink:0, display:'flex', flexDirection:'column', justifyContent:'space-between', paddingRight:'2px'}}>
                                                            <span style={{fontSize:'0.55rem', color:'#666', textAlign:'right', display:'block'}}>{maxVal}m</span>
                                                            <span style={{fontSize:'0.55rem', color:'#666', textAlign:'right', display:'block'}}>{Math.round(maxVal/2)}m</span>
                                                            <span style={{fontSize:'0.55rem', color:'#666', textAlign:'right', display:'block'}}>0</span>
                                                        </div>
                                                        {/* SVG-Diagramm */}
                                                        <div style={{flex:1, minWidth:0, position:'relative'}}>
                                                        <svg width="100%" height="90" viewBox="0 0 100 90" preserveAspectRatio="none" style={{overflow:'visible'}}>
                                                            {/* Raster-Linien */}
                                                            <line x1="0" y1="90" x2="100" y2="90" stroke={isDark?'#333':'#ddd'} strokeWidth="0.5" vectorEffect="non-scaling-stroke"/>
                                                            <line x1="0" y1="45" x2="100" y2="45" stroke={isDark?'#222':'#eee'} strokeWidth="0.3" strokeDasharray="2,2" vectorEffect="non-scaling-stroke"/>
                                                            
                                                            {/* Linie */}
                                                            <polyline
                                                                points={data.map((val, idx) => {
                                                                    const x = (idx / Math.max(1, data.length - 1)) * 100;
                                                                    const y = 90 - (maxVal > 0 ? (val / maxVal) * 80 : 0);
                                                                    return `${x},${y}`;
                                                                }).join(' ')}
                                                                fill="none"
                                                                stroke="#00e676"
                                                                strokeWidth="2"
                                                                vectorEffect="non-scaling-stroke"
                                                            />
                                                            
                                                            {/* Punkte mit Hover-Tooltip */}
                                            {data.map((val, idx) => {
                                                const x = (idx / Math.max(1, data.length - 1)) * 100;
                                                const y = 90 - (maxVal > 0 ? (val / maxVal) * 80 : 0);
                                                const isAnomaly = val < anomalyThreshold && val > 0;
                                                
                                                const dayDate = orderedWeekData[idx]?.date;
                                                const dateLabel = dayDate ? `${dayDate.getDate()}.${dayDate.getMonth()+1}.` : `Tag ${idx+1}`;
                                                                
                                                                return (
                                                                    <circle
                                                                        key={idx}
                                                                        cx={x}
                                                                        cy={y}
                                                                        r="1.5"
                                                                        fill={isAnomaly ? '#ff5252' : '#00e676'}
                                                                        stroke={isDark?'#1a1a1a':'#fafafa'}
                                                                        strokeWidth="0.5"
                                                                        vectorEffect="non-scaling-stroke"
                                                                    >
                                                                        <title>{`${dateLabel}: ${val}min${isAnomaly ? ' (ANOMALIE!)' : ''}`}</title>
                                                                    </circle>
                                                                );
                                                            })}
                                                        </svg>
                                                        </div>{/* Ende SVG-Wrapper */}
                                                    </div>{/* Ende Chart-Container */}
                                                    
                                                    {/* X-ACHSE: DATUM (unter dem Chart, mit Y-Achsen-Offset) */}
                                                    <div style={{display:'flex', marginLeft:`${yAxisWidth}px`, overflow:'hidden'}}>
                                                        <div style={{display:'flex', justifyContent:'space-between', width:'100%', fontSize:'0.55rem', color: isDark?'#666':'#999'}}>
                                            {data.map((_, idx) => {
                                                const dayDate = orderedWeekData[idx]?.date;
                                                if (!dayDate) return <span key={idx} style={{flex:1, textAlign:'center'}}>-</span>;
                                                                // Zeige nur jeden 2. oder 3. Tag bei vielen Daten
                                                                const step = data.length > 20 ? 3 : data.length > 10 ? 2 : 1;
                                                                if (idx % step !== 0) return <span key={idx} style={{flex:1}}></span>;
                                                                return <span key={idx} style={{flex:1, textAlign:'center'}}>{dayDate.getDate()}.{dayDate.getMonth()+1}.</span>;
                                                            })}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Zusammenfassung */}
                                                    <div style={{fontSize:'0.65rem', color:'#888', textAlign:'center', marginTop:'6px'}}>
                                                        Ø {avg}min/Tag · Max {maxVal}min · Σ {total}min
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </TerminalBox>

                        <div style={{marginTop:'20px', padding:'15px', border:`1px dashed ${isDark?'#444':'#ccc'}`, borderRadius:'4px'}}>
                            <div style={{fontSize:'0.75rem', color:'#888', lineHeight:'1.6'}}>
                                <strong>LEGENDE:</strong><br/>
                                • <strong>WC-NACHT</strong>: Toilettengänge zwischen 22:00-08:00 Uhr<br/>
                                • <strong>NACHT-AKTIVITÄT</strong>: Bewegungen im Schlafbereich nachts<br/>
                                • <strong>AKTIVITÄT (Baseline-relativ)</strong>: 100% = Normal für DIESES Haus | &gt;120% = Sehr aktiv | &lt;80% = Ruhig | &lt;50% = ⚠️ Sehr ruhig<br/>
                                • <strong>FRISCHLUFT</strong>: Fenster-/Türöffnungen<br/>
                                • <strong>RAUM-HISTOGRAMME</strong>: 🟢 Grün = Normal | 🔴 Rot = Anomalie (&lt; Durchschnitt - 2× Standardabweichung)<br/>
                                🟢 = Gut | 🟡 = Auffällig | 🔴 = Kritisch
                            </div>
                        </div>
                    </div>
                )}

                {/* TAGESANSICHT (Original) */}
                {viewMode === 'DAY' && (<>
                <div style={{display:'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom:'20px', alignItems: 'stretch'}}>
                    <TerminalBox title="🌙 NACHT-PROTOKOLL" themeType={themeType} height="100%" helpText={"Zeigt den KI-generierten Schlafbericht der letzten Nacht (Gemini). Enthält Analyse der Schlafqualität, Bewegungsereignisse zwischen 22:00 und 08:00 Uhr und Vergleich mit dem persönlichen Normalverhalten."}>
                        <div style={{fontStyle:'italic', lineHeight:'1.4', fontSize:'0.9rem'}}>"{geminiNight}"</div>
                        {geminiNightTs && <div style={{fontSize:'0.75rem', opacity:0.5, marginTop:'6px', fontStyle:'normal'}}>Stand: {new Date(geminiNightTs).toLocaleString('de-DE', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} Uhr</div>}
                    </TerminalBox>
                    <TerminalBox title="☀️ TAGES-SITUATION" themeType={themeType} height="100%" helpText={"KI-generierter Tagesbericht (Gemini). Zusammenfassung der heutigen Aktivitätsmuster, besuchter Räume und auffälliger Ereignisse. Wird täglich aktualisiert."}>
                        <div style={{fontStyle:'italic', lineHeight:'1.4', fontSize:'0.9rem'}}>"{geminiDay}"</div>
                        {geminiDayTs && <div style={{fontSize:'0.75rem', opacity:0.5, marginTop:'6px', fontStyle:'normal'}}>Stand: {new Date(geminiDayTs).toLocaleString('de-DE', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} Uhr</div>}
                    </TerminalBox>
                </div>

                <div style={{display:'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px', alignItems: 'stretch'}}>
                    <TerminalBox title="DIAGNOSE & VITALITÄT" themeType={themeType} height="100%" helpText={"Zeigt den Gesundheits-Score (0–1). Ein KI-Modell vergleicht dein aktuelles Bewegungsmuster mit deinem persönlichen Normalverhalten. Score unter 0.3 = unauffällig. Das Modell trainiert sich automatisch sobald 7+ Tage Daten vorliegen – bis dahin zeigt es 0.10 (kein Modell)."}>
                        {hasData ? (
                            <>
                                <div style={{display:'flex', alignItems:'center', gap:'15px', marginBottom:'15px'}}>
                                    <div style={{fontSize:'2rem'}}>{anomalyScore > 0.5 ? '🔴' : '🟢'}</div>
                                    <div>
                                        <div style={{fontSize:'1.2rem', fontWeight:'bold', color: anomalyScore > 0.5 ?'#ff5252':'#00e676'}}>{anomalyScore > 0.5 ? 'AUFFÄLLIG' : 'UNAUFFÄLLIG'}</div>
                                        <div style={{fontSize:'0.8rem', color: isDark?'#888':'#666'}}>Score: {anomalyScore.toFixed(2)}</div>
                                    </div>
                                </div>
                                <div style={{marginTop:'10px', borderTop:`1px dashed ${isDark?'#333':'#ccc'}`, paddingTop:'10px'}}>
                                    <div style={{fontSize:'0.7rem', color:'#888', marginBottom:'5px', textTransform:'uppercase'}}>Letzte 5 Aktivitäten (Gefiltert):</div>
                                    {recentEvents.length > 0 ? (
                                        recentEvents.map((ev, i) => (
                                            <div key={i} style={{fontSize:'0.8rem', display:'flex', justifyContent:'space-between', marginBottom:'2px'}}>
                                                <span style={{fontWeight:'bold'}}>{ev.name}</span>
                                                <span style={{fontFamily:'monospace', color:'#888'}}>vor {ev.ago} min ({ev.time})</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{fontSize:'0.8rem', fontStyle:'italic', color:'#888'}}>Keine relevanten Ereignisse.</div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div style={{textAlign:'center', padding:'20px', color:'#888'}}>KEINE DATEN</div>
                        )}
                    </TerminalBox>

                    <TerminalBox title="ENERGIE-RESERVE (AKKU)" themeType={themeType} height="100%" helpText={"Metapher für das Aktivitätsniveau: Hohe Aktivität = voller Akku. Die Kurve zeigt den Verlauf über den Tag. Rote Zonen = ungewöhnlich hohe oder niedrige Aktivität im Vergleich zum persönlichen Durchschnitt."}>
                        <div style={{textAlign:'center', padding:'10px 0'}}>
                            <div style={{fontSize:'3rem', fontWeight:'bold', color: hasData ? (batteryLevel>50?'#00e676':'#ffab40') : '#888', lineHeight:'1'}}>{batteryLevel}%</div>
                            <div style={{width:'60%', margin:'10px auto'}}><RenderBlockBar val={batteryLevel} max={100} height='16px' themeType={themeType} /></div>
                            <div style={{fontSize:'0.9rem', color: isDark?'#eee':'#222', marginTop:'15px'}}>"{getBatteryNarrative()}"</div>
                        </div>
                    </TerminalBox>
                </div>

                {renderTimelines()}
                {(() => {
                    // OC-18 Prio 2: Separate Schlafkacheln pro Person
                    // Wenn personHistoryData Einträge mit sleepWindowEnd hat → je eine Kachel pro Person
                    // Sonst: Legacy-Modus (kombinierte Kachel, Einpersonenhaushalt oder kein personTag)
                    const personsWithSleep = Object.entries(personHistoryData)
                        .filter(([, pd]: [string, any]) => pd && (pd.sleepWindowEnd != null || pd.sleepWindowStart != null))
                        .map(([name]) => name)
                        .sort();
                    if (personsWithSleep.length >= 2) {
                        return (
                            <>
                                {personsWithSleep.map(pName => {
                                    const pd = personHistoryData[pName];
                                    const overrideData = {
                                        sleepScore: null, sleepScoreRaw: null, sleepStages: [],
                                        garminScore: null, garminDeepMin: null, garminLightMin: null, garminRemMin: null,
                                        sleepWindowStart:    pd.sleepWindowStart    ?? null,
                                        sleepWindowEnd:      pd.sleepWindowEnd      ?? null,
                                        sleepWindowSource:   pd.sleepStartSource    || 'motion',
                                        wakeSource:          pd.wakeSource          ?? null,
                                        wakeConf:            pd.wakeConf            ?? 'niedrig',
                                        isNap: false, unusuallyLongSleep: false,
                                        garminDataFresh: null, garminLastSyncAgeH: null,
                                        outsideBedEvents:       [],
                                        wakeConfirmed:          pd.wakeConfirmed          ?? false,
                                        allWakeSources:         pd.allWakeSources         ?? [],
                                        sleepStartSource:       pd.sleepStartSource       ?? 'motion',
                                        allSleepStartSources:   pd.allSleepStartSources   ?? [],
                                        sleepDate:              auraSleepData?.sleepDate   ?? null,
                                        sleepStartOverridden:   pd.sleepStartOverridden   ?? false,
                                        sleepStartOverrideSource: pd.sleepStartOverridden ? pd.sleepStartSource : null,
                                        bedWasEmpty:            pd.bedWasEmpty            ?? false,
                                    };
                                    return <React.Fragment key={pName}>{renderSleepScoreCard(overrideData, pName)}</React.Fragment>;
                                })}
                            </>
                        );
                    }
                    return renderSleepScoreCard();
                })()}
                {renderMobility()}

                <div style={{display:'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px'}}>
                    <TerminalBox title="FRESH AIR" themeType={themeType} helpText={"Zeigt wie oft heute Tür/Fenster-Sensoren (Typ: Tür/Fenster) geöffnet wurden. Stoßlüftung = mind. 5 Min offen. Empfehlung: 3× täglich ≥5 Min (Forschungsbasiert: DIN EN 15251, Pettenkofer-Zahl)."}>
                        <div style={{textAlign:'center'}}>
                            <div style={{fontSize:'2rem', color: hasData ? '#00e676' : '#888', fontWeight:'bold'}}>{freshAirCount}x</div>
                            {hasData && freshAirLongCount > 0 && (
                                <div style={{fontSize:'0.8rem', color: freshAirLongCount >= 3 ? '#00e676' : '#ffb300', marginTop:'2px'}}>
                                    davon {freshAirLongCount}× ≥5 Min
                                    <span style={{color: isDark?'#666':'#aaa'}}> (Empf.: 3×)</span>
                                </div>
                            )}
                            {hasData && freshAirLongCount === 0 && freshAirCount > 0 && (
                                <div style={{fontSize:'0.75rem', color:'#ff7043', marginTop:'2px'}}>
                                    Zu kurz – Stoßlüftung ≥5 Min empfohlen
                                </div>
                            )}
                            <Divider sx={{my:1, borderColor: isDark?'#333':'#eee'}} />
                            <div style={{fontSize:'0.8rem'}}>{hasData ? getFreshAirNarrative() : "Keine Daten"}</div>
                        </div>
                    </TerminalBox>

                    <TerminalBox title="MAHLZEITEN" themeType={themeType} helpText={"Schätzt Mahlzeiten-Zeitpunkte anhand von Küchenaktivität. Die Zeiten sind Schätzungen basierend auf Bewegungsmustern, keine exakten Messungen."}>
                        {hasData ? (
                            <>
                                <div style={{display:'grid', gridTemplateColumns:'20px 1fr', gap:'5px', marginBottom:'10px'}}>
                                    <div style={{color: meals.breakfast?'#00e676':'#444'}}>{meals.breakfast?'✓':'○'}</div><div>Frühstück</div>
                                    <div style={{color: meals.lunch?'#00e676':'#444'}}>{meals.lunch?'✓':'○'}</div><div>Mittagessen</div>
                                    <div style={{color: meals.dinner?'#00e676':'#444'}}>{meals.dinner?'✓':'○'}</div><div>Abendbrot</div>
                                </div>
                                <Divider sx={{my:1, borderColor: isDark?'#333':'#eee'}} />
                                <div style={{fontSize:'0.8rem', textAlign:'center'}}>"{getMealNarrative()}"</div>
                            </>
                        ) : <div style={{textAlign:'center', padding:'20px', color:'#888'}}>KEINE DATEN</div>}
                    </TerminalBox>

                    <TerminalBox title="BAD / HYGIENE" themeType={themeType} helpText={"Zeigt die heutige Badezimmer-Nutzung in Minuten aktiver Bewegung. Nur als Bad markierte Sensoren werden berücksichtigt. Thermostate werden ignoriert."}>
                        <div style={{textAlign:'center'}}>
                            <div style={{fontSize:'1.5rem', color: hasData ? (badStatus.status==='FREI'?'#2196f3':'#ffab40') : '#888', fontWeight:'bold', marginBottom:'5px'}}>{badStatus.status}</div>
                            <Divider sx={{my:1, borderColor: isDark?'#333':'#eee'}} />
                            <div style={{fontSize:'0.8rem'}}>"{getBadNarrative()}"</div>
                        </div>
                    </TerminalBox>
                </div>

                {viewMode === 'DAY' && (
                    <div style={{marginTop:'40px', display:'flex', gap:'10px', opacity: 0.7}}>
                        <Button size="small" variant="outlined" sx={{color:'#888', borderColor:'#888'}} onClick={triggerAnalysis} disabled={loading}>{loading ? '[ LÄDT... ]' : '[ SYSTEM PRÜFEN ]'}</Button>
                    </div>
                )}
                </>)}
                
                {/* HANDBUCH-BUTTON: Für ALLE Ansichten sichtbar */}
                <div style={{marginTop:'20px', display:'flex', gap:'10px', opacity: 0.7}}>
                    <Button size="small" variant="outlined" sx={{color:'#888', borderColor:'#888'}} onClick={()=>setOpenDeepDive(true)}>[ HANDBUCH ]</Button>
                </div>
            </div>

            <Dialog open={openDeepDive} onClose={()=>setOpenDeepDive(false)} maxWidth="lg" fullWidth>
                <DialogTitle>System Handbuch - Gesundheits-Dashboard</DialogTitle>
                <DialogContent dividers>
                    <Typography variant="body2" component="div" style={{fontFamily:'monospace', lineHeight:'1.8'}}>
                        <strong>🎯 NAVIGATION:</strong><br/>
                        • <strong>TAG / WOCHE / MONAT</strong>: Umschalten der Zeitansicht<br/>
                        • <strong>← →</strong> Pfeile: In WOCHE/MONAT um 7/30 Tage zurück/vor navigieren<br/>
                        • <strong>LIVE-Modus</strong>: Grüner Punkt = Echtzeit-Daten<br/><br/>
                        
                        <strong>🌙 SCHLAF-RADAR (22:00-08:00):</strong><br/>
                        • <strong>UNRUHE IM SCHLAFZIMMER</strong>: Bewegungen im Bett (unruhiger Schlaf)<br/>
                        • <strong>NÄCHTLICHE AKTIVITÄT (AUSSERHALB)</strong>: Toilettengänge, Küche etc.<br/>
                        • Farben passen sich an Ihr Haus an (adaptiv!)<br/><br/>
                        
                        <strong>📊 LANGZEIT-TRENDS (WOCHE/MONAT):</strong><br/>
                        • <strong>Aktivitätsbelastung</strong>: Baseline-relativ (100% = normal für SIE)<br/>
                        • <strong>Ganggeschwindigkeit</strong>: Mobilität über Flur-Sensoren (konfigurierbar)<br/>
                        • <strong>Nacht-Unruhe</strong>: Nur Bewegungen im Schlafzimmer<br/>
                        • <strong>Raum-Mobilität</strong>: Anzahl genutzter Räume pro Tag<br/>
                        • <strong>Bad-Nutzung</strong>: Toilettengänge pro Tag<br/>
                        • <strong>Frischluft-Index</strong>: Fenster-/Türöffnungen<br/><br/>
                        
                        <strong>🏠 RAUM-HISTOGRAMME:</strong><br/>
                        • <strong>Top 3 Räume</strong>: Garmin-Style Liniendiagramm mit Punkten<br/>
                        • <strong>Rest</strong>: Mini-Histogramme (kompakt)<br/>
                        • <strong>🟢 Grün</strong>: Normale Nutzung<br/>
                        • <strong>🔴 Rot</strong>: ANOMALIE! (weniger als Ø - 2×Standardabweichung)<br/><br/>
                        
                        <strong>🔴 LEBENSZEICHEN-ALARM:</strong><br/>
                        • <strong>🟢</strong>: Alles normal<br/>
                        • <strong>🟡</strong>: Warnung (6-12h keine Aktivität)<br/>
                        • <strong>🔴</strong>: KRITISCH! (&gt;12h keine Aktivität)<br/><br/>
                        
                        <strong>🛠️ KONFIGURATION:</strong><br/>
                        • System-Tab → Sensor-Liste → "Flur?" Checkbox für Ganggeschwindigkeit<br/>
                        • System-Tab → Reporting → Briefing-Zeit, Pushover, Gemini API<br/>
                    </Typography>
                </DialogContent>
                <DialogActions><Button onClick={()=>setOpenDeepDive(false)}>Schließen</Button></DialogActions>
            </Dialog>
        </Box>
    );
}
