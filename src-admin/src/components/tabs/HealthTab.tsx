import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Button, Divider, Dialog, DialogTitle, DialogContent, DialogActions,
    Typography, IconButton
} from '@mui/material';
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

const TerminalBox = ({ title, children, themeType, height = 'auto' }: { title: string, children: React.ReactNode, themeType: string, height?: string }) => {
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
            flexDirection: 'column'
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
                [ {title} ]
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

    const [anomalyScore, setAnomalyScore] = useState<number>(0.1);
    const [batteryLevel, setBatteryLevel] = useState<number>(85);
    const [activityTrend, setActivityTrend] = useState<number | null>(null);
    const [gaitTrend, setGaitTrend] = useState<number | null>(null);
    const [lastCheck, setLastCheck] = useState<any>('-');
    const [roomStats, setRoomStats] = useState<{today: Record<string, number>, yesterday: Record<string, number>}>({today:{}, yesterday:{}});

    const [geminiNight, setGeminiNight] = useState<string>('Warte auf Analyse...');
    const [geminiDay, setGeminiDay] = useState<string>('Warte auf Analyse...');
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

    const loadHistory = (date: Date) => {
        setLoading(true);
        const dateStr = date.toISOString().split('T')[0];

        socket.sendTo(adapterName + '.' + instance, 'getHistoryData', { date: dateStr, _t: Date.now() })
            .then((res: any) => {
                setLoading(false);
                if (res && res.success && res.data) {
                    setHasData(true);
                    const d = res.data;
                    if (d.roomHistory && d.roomHistory.history) setRoomHistory(d.roomHistory.history);
                    else if (d.roomHistory) setRoomHistory(d.roomHistory);

                    setGeminiNight(d.geminiNight || "Keine Daten");
                    setGeminiDay(d.geminiDay || "Keine Daten");
                    setAnomalyScore(d.anomalyScore || 0.1);
                    
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
                                const isMotion = (e.type || '').toLowerCase().includes('bewegung') || 
                                                 (e.type || '').toLowerCase().includes('motion') ||
                                                 (e.type || '').toLowerCase().includes('presence');
                                return isMotion && e.value === true;
                            }).length;
                            const calculatedBattery = Math.min(100, Math.max(20, Math.round(20 + (motionEventsDay / 12.5))));
                            setBatteryLevel(calculatedBattery);
                        }
                    } else {
                        setBatteryLevel(d.batteryLevel || 85);
                    }
                    
                    setFreshAirCount(d.freshAirCount || 0);

                    if (d.todayVector) setStressBuckets(d.todayVector);
                    else setStressBuckets(new Array(48).fill(0));

                    setYesterdayBuckets(new Array(48).fill(0));

                    setStressDetails(new Array(48).fill([]));

                    setMeals({ breakfast: false, lunch: false, dinner: false });
                    setBadStatus({ status: 'ARCHIV', last: '-', duration: 0 });
                    setDmRoom(null);
                    setRecentEvents([]);

                    if (d.eventHistory) {
                        processEvents(d.eventHistory);
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
                                    ((e.type || '').toLowerCase().includes('bewegung') || 
                                     (e.type || '').toLowerCase().includes('motion'))
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
                    setMeals({ breakfast: false, lunch: false, dinner: false });
                    setBadStatus({ status: 'KEINE DATEN', last: '-', duration: 0 });
                    setDmRoom("-");
                    setRecentEvents([]);
                    setRoomAlerts(null);
                }
            });
    };

    // Lade N-Tage-Daten für Wochenansicht / Monatsansicht
    const loadWeekData = (days: number = 7) => {
        setLoading(true);
        const promises: Promise<any>[] = [];
        const dates: Date[] = [];
        
        // Letzte N Tage (inkl. heute)
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dates.push(d);
            
            const dateStr = d.toISOString().split('T')[0];
            
            // Für HEUTE: Lade Live-Daten statt History
            if (i === 0) {
                promises.push(
                    socket.sendTo(adapterName + '.' + instance, 'getOverviewData', { _t: Date.now() })
                        .then((res: any) => {
                            if (res && res.success) {
                                // Berechne Frischluft aus eventHistory
                                const eventHist = res.eventHistory || [];
                                const startOfDay = new Date();
                                startOfDay.setHours(0, 0, 0, 0);
                                const freshAir = eventHist.filter((e: any) => {
                                    if (e.timestamp < startOfDay.getTime()) return false;
                                    const nameLower = (e.name || '').toLowerCase();
                                    const isActive = e.value === true || e.value === 1 || e.value === 'on' || e.value === 'true';
                                    return (nameLower.includes('haustür') || nameLower.includes('terrasse')) && isActive;
                                }).length;
                                
                                // Konvertiere Live-Daten in History-Format
                                return {
                                    date: d,
                                    data: {
                                        eventHistory: eventHist,
                                        batteryLevel: res.stats?.activityTrend !== undefined 
                                            ? Math.min(100, Math.max(20, Math.round(80 + (res.stats.activityTrend * 5)))) 
                                            : 85,
                                        freshAirCount: freshAir,
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
            const weekDataArray = results.map(r => ({
                date: r.date,
                dateStr: r.date.toISOString().split('T')[0],
                dayName: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][r.date.getDay()],
                hasData: r.data !== null,
                data: r.data
            }));
            
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
                const isMotion = (e.type || '').toLowerCase().includes('bewegung') || 
                                 (e.type || '').toLowerCase().includes('motion');
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
        socket.getState(`${namespace}.analysis.security.lastScore`).then((s:any) => setAnomalyScore(s?.val ? Number(s.val) : 0.1));

        // Use raw value first, fallback to calculation if missing
        socket.getState(`${namespace}.analysis.health.activityTrend`).then((s:any) => {
            const val = s?.val !== undefined ? Number(s.val) : null;
            setActivityTrend(val);
            // Battery Logic: Start at 80, add trend*5. Max 100, Min 20.
            if (val !== null) setBatteryLevel(Math.min(100, Math.max(20, Math.round(80 + (val * 5)))));
        });

        socket.getState(`${namespace}.analysis.health.gaitSpeed`).then((s:any) => setGaitTrend(s?.val !== undefined ? Number(s.val) : null));
        socket.getState(`${namespace}.analysis.safety.deadMan.currentRoom`).then((s:any) => setDmRoom(s?.val || null));
        socket.getState(`${namespace}.analysis.health.geminiNight`).then((s:any) => setGeminiNight(s?.val || 'Warte auf Analyse...'));
        socket.getState(`${namespace}.analysis.health.geminiDay`).then((s:any) => setGeminiDay(s?.val || 'Warte auf Analyse...'));
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
    }, [namespace, socket, adapterName, instance, TRAINING_TARGET, isLive, viewDate]);

    // FIX: AUTO-START when component mounts or becomes Live
    useEffect(() => {
        if (isLive) {
            fetchData();
        }
    }, [isLive, fetchData]);

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

    const processEvents = (events: any[]) => {
        const collectedRelevantEvents: any[] = [];

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        let faCount = 0; let lastFA = '-';
        let hasBreakfast = false; let hasLunch = false; let hasDinner = false;
        let badState = 'FREI'; let badLast = '-';
        let kitchenEventsMorning = 0; let kitchenEventsNoon = 0; let kitchenEventsEvening = 0;

        const viewStart = isLive ? startOfDay : new Date(viewDate).setHours(0,0,0,0);

        const todaysEvents = events.filter((e:any) => e.timestamp >= viewStart);

        let lastBadEventTime = 0;
        let lastBadEventActive = false;

        todaysEvents.forEach((evt: any) => {
            const date = new Date(evt.timestamp);
            const isActive = evt.value === true || evt.value === 1 || evt.value === 'on' || evt.value === 'true';

            if ((evt.name.toLowerCase().includes('haustür') || evt.name.toLowerCase().includes('terrasse')) && isActive) {
                faCount++; lastFA = date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            }
            if (evt.name.toLowerCase().includes('küche') || evt.name.toLowerCase().includes('kitchen')) {
                if (date.getHours() >= 6 && date.getHours() <= 10) kitchenEventsMorning++;
                if (date.getHours() >= 12 && date.getHours() <= 14) kitchenEventsNoon++;
                if (date.getHours() >= 18 && date.getHours() <= 20) kitchenEventsEvening++;
            }
            if (evt.name.toLowerCase().includes('bad') || evt.name.toLowerCase().includes('wc')) {
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
                const isMotion = ['motion', 'bewegung', 'präsenz', 'presence', 'occupancy'].some(k => type.includes(k));
                const isDoor = ['door', 'tür', 'window', 'fenster', 'griff', 'handle', 'lock', 'schloss'].some(k => type.includes(k));
                const isLight = ['light', 'licht', 'switch', 'schalter', 'dimmer', 'lampe'].some(k => type.includes(k));

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
        if (freshAirCount > 2) return "Vorbildlich gelüftet heute.";
        return "Minimale Frischluftzufuhr.";
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
                <TerminalBox title={`SCHLAF-RADAR (22-08) ${isNightTime ? '🌙 AKTUELLE NACHT' : '📅 LETZTE NACHT'}`} themeType={themeType}>
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

                <TerminalBox title={`NEURO-TIMELINE (08-22) ${isDayTime ? '☀️ HEUTE' : '📅 GESTERN'}`} themeType={themeType}>
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
                        <strong style={{fontSize:'1.2rem'}}>AURA MONITOR (v0.30.56)</strong>
                        <div style={{display:'flex', alignItems:'center', backgroundColor: isDark?'#222':'#e0e0e0', borderRadius:'4px', padding:'2px'}}>
                            <IconButton size="small" onClick={() => handleDateChange(-1)} disabled={loading || viewMode === 'WEEK' || viewMode === 'MONTH'}><ArrowBackIosIcon fontSize="small" /></IconButton>
                            <span style={{margin:'0 10px', fontWeight:'bold', minWidth:'140px', textAlign:'center'}}>
                                {viewMode === 'WEEK' ? 'Letzte 7 Tage' : viewMode === 'MONTH' ? 'Letzte 30 Tage' : viewDate.toLocaleDateString('de-DE', {weekday: 'long', day:'2-digit', month:'2-digit'})}
                            </span>
                            <IconButton size="small" onClick={() => handleDateChange(1)} disabled={isLive || loading || viewMode === 'WEEK' || viewMode === 'MONTH'}><ArrowForwardIosIcon fontSize="small" /></IconButton>
                        </div>
                    </div>
                    
                    <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                        <div style={{display:'flex', gap:'5px', border: `1px solid ${isDark?'#444':'#bbb'}`, borderRadius:'4px', padding:'2px'}}>
                            <button 
                                onClick={() => {setViewMode('DAY'); if(isLive) fetchData();}}
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
                                onClick={() => {setViewMode('WEEK'); loadWeekData(7);}}
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
                                onClick={() => {setViewMode('MONTH'); loadWeekData(30);}}
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
                                                const isMotion = (e.type || '').toLowerCase().includes('bewegung') || 
                                                                 (e.type || '').toLowerCase().includes('motion') ||
                                                                 (e.type || '').toLowerCase().includes('presence');
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
                                                        const isMotion = (e.type || '').toLowerCase().includes('bewegung') || (e.type || '').toLowerCase().includes('motion');
                                                        return isNight && isBathroom && isMotion && e.value === true;
                                                    }).length : 0;
                                                
                                                // Nacht-Aktivität (Bewegungen im Schlafbereich)
                                                const nightActivity = day.hasData && day.data?.eventHistory ? 
                                                    day.data.eventHistory.filter((e: any) => {
                                                        const hour = new Date(e.timestamp).getHours();
                                                        const isNight = hour >= 22 || hour < 8;
                                                        const isBedroom = getRoomCategory(e.name || e.location || '') === 'BEDROOM';
                                                        const isMotion = (e.type || '').toLowerCase().includes('bewegung') || (e.type || '').toLowerCase().includes('motion');
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
                                                        const isMotion = (e.type || '').toLowerCase().includes('bewegung') || 
                                                                         (e.type || '').toLowerCase().includes('motion') ||
                                                                         (e.type || '').toLowerCase().includes('presence');
                                                        return isMotion && e.value === true;
                                                    }).length;
                                                    activity = Math.min(100, Math.max(20, Math.round(20 + (motionEvents / 12.5))));
                                                }
                                                
                                                const freshAir = day.data?.freshAirCount || 0;
                                                
                                                // Parse KI-Zusammenfassung (doppeltes JSON-Decode)
                                                let summary = 'Keine Daten';
                                                if (day.data?.geminiDay) {
                                                    try {
                                                        let text = day.data.geminiDay;
                                                        // Erste Ebene: Parse wenn JSON-String
                                                        if (text.startsWith('{') || text.startsWith('"')) {
                                                            try { text = JSON.parse(text); } catch {}
                                                        }
                                                        // Zweite Ebene: Extrahiere "analyse" Key
                                                        if (typeof text === 'object' && text.analyse) {
                                                            summary = text.analyse;
                                                        } else if (typeof text === 'string') {
                                                            summary = text;
                                                        }
                                                    } catch {
                                                        summary = String(day.data.geminiDay).substring(0, 100);
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
                                                        <td style={{padding:'12px', fontSize:'0.8rem', fontStyle:'italic', color:isDark?'#aaa':'#555', maxWidth:'350px', cursor: summary.length > 80 ? 'help' : 'default'}} title={summary.length > 80 ? summary : ''}>
                                                            {day.hasData ? `"${summary.substring(0, 80)}${summary.length > 80 ? '...' : ''}"` : '-'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </TerminalBox>

                        {/* RAUM-NUTZUNG HISTOGRAMME (NEU!) */}
                        <TerminalBox title={`RAUM-NUTZUNG (MOBILITÄT) - ${viewMode === 'MONTH' ? '30 TAGE' : '7 TAGE'}`} themeType={themeType} style={{marginTop:'20px'}}>
                            {(() => {
                                // Extrahiere Raum-Daten aus weekData
                                const roomTimeSeriesMap: Record<string, number[]> = {};
                                
                                weekData.forEach(day => {
                                    if (day.hasData && day.data && day.data.roomHistory) {
                                        const roomHist = day.data.roomHistory.history || {};
                                        Object.keys(roomHist).forEach(room => {
                                            if (!roomTimeSeriesMap[room]) roomTimeSeriesMap[room] = [];
                                            // Summiere alle 24 Stunden für diesen Tag
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
                                
                                // Render Grid (3 pro Zeile)
                                return (
                                    <div style={{display:'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap:'20px', padding:'10px 0'}}>
                                        {sortedRooms.map(({room, data, total}) => {
                                            // Berechne Baseline & Standardabweichung
                                            const mean = data.reduce((a,b) => a+b, 0) / data.length;
                                            const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
                                            const std = Math.sqrt(variance);
                                            const anomalyThreshold = mean - (2 * std); // 2× Standardabweichung
                                            
                                            const maxVal = Math.max(...data);
                                            const avg = Math.round(mean);
                                            
                                            return (
                                                <div key={room} style={{
                                                    border: `1px solid ${isDark?'#333':'#ccc'}`,
                                                    borderRadius: '4px',
                                                    padding: '10px',
                                                    backgroundColor: isDark?'#1a1a1a':'#fafafa'
                                                }}>
                                                    <div style={{fontSize:'0.75rem', fontWeight:'bold', marginBottom:'8px', color: isDark?'#eee':'#222'}}>
                                                        {room.toUpperCase()}
                                                    </div>
                                                    
                                                    {/* Mini-Histogramm */}
                                                    <div style={{display:'flex', alignItems:'flex-end', gap:'2px', height:'80px', marginBottom:'8px'}}>
                                                        {data.map((val, idx) => {
                                                            const heightPercent = maxVal > 0 ? (val / maxVal) * 100 : 0;
                                                            const isAnomaly = val < anomalyThreshold && val > 0; // Rot wenn < mean - 2*std
                                                            const barColor = isAnomaly ? '#ff5252' : '#00e676';
                                                            
                                                            return (
                                                                <div key={idx} style={{flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', alignItems:'center'}}>
                                                                    <div 
                                                                        style={{
                                                                            width: '100%',
                                                                            height: `${heightPercent}%`,
                                                                            backgroundColor: barColor,
                                                                            borderRadius: '2px 2px 0 0',
                                                                            minHeight: val > 0 ? '2px' : '0px'
                                                                        }}
                                                                        title={`${val}min${isAnomaly ? ' (ANOMALIE!)' : ''}`}
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    
                                                    {/* Y-Achse Label (Max-Wert) */}
                                                    <div style={{fontSize:'0.65rem', color:'#666', textAlign:'right', marginBottom:'4px'}}>
                                                        {maxVal}min
                                                    </div>
                                                    
                                                    {/* Zusatzinfos */}
                                                    <div style={{fontSize:'0.7rem', color:'#888', textAlign:'center'}}>
                                                        Ø {avg}min/Tag | Σ {total}min
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
                    <TerminalBox title="🌙 NACHT-PROTOKOLL" themeType={themeType} height="100%">
                        <div style={{fontStyle:'italic', lineHeight:'1.4', fontSize:'0.9rem'}}>"{geminiNight}"</div>
                    </TerminalBox>
                    <TerminalBox title="☀️ TAGES-SITUATION" themeType={themeType} height="100%">
                        <div style={{fontStyle:'italic', lineHeight:'1.4', fontSize:'0.9rem'}}>"{geminiDay}"</div>
                    </TerminalBox>
                </div>

                <div style={{display:'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px', alignItems: 'stretch'}}>
                    <TerminalBox title="DIAGNOSE & VITALITÄT" themeType={themeType} height="100%">
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

                    <TerminalBox title="ENERGIE-RESERVE (AKKU)" themeType={themeType} height="100%">
                        <div style={{textAlign:'center', padding:'10px 0'}}>
                            <div style={{fontSize:'3rem', fontWeight:'bold', color: hasData ? (batteryLevel>50?'#00e676':'#ffab40') : '#888', lineHeight:'1'}}>{batteryLevel}%</div>
                            <div style={{width:'60%', margin:'10px auto'}}><RenderBlockBar val={batteryLevel} max={100} height='16px' themeType={themeType} /></div>
                            <div style={{fontSize:'0.9rem', color: isDark?'#eee':'#222', marginTop:'15px'}}>"{getBatteryNarrative()}"</div>
                        </div>
                    </TerminalBox>
                </div>

                {renderTimelines()}
                {renderMobility()}

                <div style={{display:'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px'}}>
                    <TerminalBox title="FRESH AIR" themeType={themeType}>
                        <div style={{textAlign:'center'}}>
                            <div style={{fontSize:'2rem', color: hasData ? '#00e676' : '#888', fontWeight:'bold'}}>{freshAirCount}x</div>
                            <Divider sx={{my:1, borderColor: isDark?'#333':'#eee'}} />
                            <div style={{fontSize:'0.8rem'}}>{hasData ? getFreshAirNarrative() : "Keine Daten"}</div>
                        </div>
                    </TerminalBox>

                    <TerminalBox title="MAHLZEITEN" themeType={themeType}>
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

                    <TerminalBox title="BAD / HYGIENE" themeType={themeType}>
                        <div style={{textAlign:'center'}}>
                            <div style={{fontSize:'1.5rem', color: hasData ? (badStatus.status==='FREI'?'#2196f3':'#ffab40') : '#888', fontWeight:'bold', marginBottom:'5px'}}>{badStatus.status}</div>
                            <Divider sx={{my:1, borderColor: isDark?'#333':'#eee'}} />
                            <div style={{fontSize:'0.8rem'}}>"{getBadNarrative()}"</div>
                        </div>
                    </TerminalBox>
                </div>

                <div style={{marginTop:'40px', display:'flex', gap:'10px', opacity: 0.7}}>
                    <Button size="small" variant="outlined" sx={{color:'#888', borderColor:'#888'}} onClick={()=>setOpenDeepDive(true)}>[ HANDBUCH ]</Button>
                    <Button size="small" variant="outlined" sx={{color:'#888', borderColor:'#888'}} onClick={triggerAnalysis} disabled={loading}>{loading ? '[ LÄDT... ]' : '[ SYSTEM PRÜFEN ]'}</Button>
                </div>
                </>)}
            </div>

            <Dialog open={openDeepDive} onClose={()=>setOpenDeepDive(false)} maxWidth="md" fullWidth>
                <DialogTitle>System Handbuch</DialogTitle>
                <DialogContent dividers><Typography variant="body2" component="div" style={{fontFamily:'monospace'}}>1. <strong>SCHLAF-RADAR</strong>: Analysiert Nachtruhe (22-08 Uhr).<br/>2. <strong>BODY BATTERY</strong>: Berechnete Energiereserve.<br/>3. <strong>HYBRID LOGIC</strong>: {aiMode === 'NEURAL' ? 'System nutzt trainierte KI-Modelle.' : 'System nutzt Heuristik (Lernphase < 14 Tage).'}</Typography></DialogContent>
                <DialogActions><Button onClick={()=>setOpenDeepDive(false)}>Schließen</Button></DialogActions>
            </Dialog>
        </Box>
    );
}