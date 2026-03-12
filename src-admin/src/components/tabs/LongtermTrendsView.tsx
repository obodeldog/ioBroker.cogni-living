import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Button, ButtonGroup, CircularProgress, Grid, Paper,
    Tooltip as MuiTooltip, IconButton
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar, ComposedChart, Cell,
    XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
    ReferenceLine, ReferenceArea, Legend
} from 'recharts';

// Version: 0.30.46 (Garmin-Style Longterm Trends)

interface LongtermTrendsViewProps {
    socket: any;
    adapterName: string;
    instance: number;
    themeType: string;
}

interface DailyDataPoint {
    date: string;
    activityPercent: number;
    gaitSpeed: number;
    nightEvents: number;
    uniqueRooms: number;
    bathroomVisits: number;
    windowOpenings: number;
    isPartialDay?: boolean;
}

function ChartHelp({ text }: { text: string }) {
    return (
        <MuiTooltip
            title={<span style={{ fontSize: '0.8rem', lineHeight: 1.5, display: 'block', maxWidth: 280 }}>{text}</span>}
            placement="top"
            arrow
        >
            <IconButton size="small" sx={{ p: 0, ml: 0.5, opacity: 0.4, '&:hover': { opacity: 1 }, verticalAlign: 'middle' }}>
                <HelpOutlineIcon sx={{ fontSize: 14 }} />
            </IconButton>
        </MuiTooltip>
    );
}

export default function LongtermTrendsView(props: LongtermTrendsViewProps) {
    const { socket, adapterName, instance, themeType } = props;
    const isDark = themeType === 'dark';

    const [timeRange, setTimeRange] = useState<'week' | '4weeks' | '6months'>('4weeks');
    const [loading, setLoading] = useState<boolean>(false);
    const [trendsData, setTrendsData] = useState<any>(null);
    const [error, setError] = useState<string>('');

    // Drift: eigener State, unabhaengig vom Zeitfenster
    const [driftData, setDriftData] = React.useState<any>(null);
    const [dailyDataRaw, setDailyDataRaw] = React.useState<any[]>([]);
    const [driftLoading, setDriftLoading] = React.useState<boolean>(false);
    const driftLoadedRef = React.useRef<boolean>(false);

    // Drift einmalig laden (unabhaengig vom Zeitfenster)
    React.useEffect(() => {
        if (!driftLoadedRef.current) {
            driftLoadedRef.current = true;
            loadDriftData();
        }
    }, []);

    // Lade Daten beim Mount und bei Zeitraum-Änderung
    useEffect(() => {
        loadLongtermData();
    }, [timeRange]);

    const loadLongtermData = async () => {
        setLoading(true);
        setError('');

        console.log('[LongtermTrends] 🚀 Start loading data for:', timeRange);

        try {
            const weeks = timeRange === 'week' ? 1 : (timeRange === '4weeks' ? 4 : 26);
            const days = weeks * 7;

            console.log(`[LongtermTrends] 📅 Requesting ${days} days of history...`);

            // SCHRITT 1: History-Files laden (alle verfügbaren Tage)
            let dailyData: DailyDataPoint[] = [];
            const today = new Date();
            // Tageszeit-Normalisierung: nur Events bis zur aktuellen Uhrzeit vergleichen
            const currentSlot = Math.floor((today.getHours() * 60 + today.getMinutes()) / 30);
            const todayDateStr = today.toISOString().split('T')[0];

            for (let i = 0; i < days; i++) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];

                try {
                    // Nutze native Promise von socket.sendTo (wie HealthTab)
                    const response: any = await Promise.race([
                        socket.sendTo(`${adapterName}.${instance}`, 'getHistoryData', { date: dateStr, _t: Date.now() }),
                        new Promise((_, reject) => setTimeout(() => {
                            console.log(`[LongtermTrends] ⏱️ Timeout for ${dateStr}`);
                            reject(new Error('Timeout'));
                        }, 5000)) // 5 Sekunden Timeout
                    ]);

                    if (response.success && response.data) {
                        const histData = response.data;
                        console.log(`[LongtermTrends] ✅ Got data for ${dateStr}`);
                        
                        // Extrahiere Metriken aus History-File
                        const eventHistory = histData.eventHistory || [];
                        const roomHistoryData = histData.roomHistory?.history || {};
                        const todayVector = histData.todayVector || [];
                        
                        // 🔍 DEBUG: Zeige RAW-Daten
                        console.log(`[LongtermTrends] 📈 ${dateStr}: events=${eventHistory.length}, rooms=${Object.keys(roomHistoryData).length}, vector=${todayVector.length}`);
                        
                        // ============================================================
                        // AKTIVITÄT: Roher Event-Total aus todayVector (wird später
                        // relativ zum persönlichen Median normalisiert – kein fixer Divisor!)
                        // ============================================================
                        // Nur Events bis zur aktuellen Tageszeit (Ansatz B: fairer Tagesvergleich)
                        const partialVector = (todayVector as number[]).slice(0, currentSlot + 1);
                        const totalEvents = partialVector.reduce((sum: number, count: number) => sum + count, 0);
                        const activityPercent = totalEvents; // temporär: roh, wird unten normalisiert
                        
// ============================================================
                        // NACHT-EVENTS: aus Snapshot (typ-basiert via isNightSensor-Flag)
                        // Fallback: location includes 'schlaf' (keyword)
                        // ============================================================
                        let nightEvents: number;
                        if (histData.nightMotionCount !== undefined) {
                            nightEvents = histData.nightMotionCount;
                        } else {
                            const nightLocs: string[] = histData.nightSensorLocations || [];
                            nightEvents = eventHistory.filter((e: any) => {
                                if (!e.timestamp) return false;
                                const hour = new Date(e.timestamp).getHours();
                                const isNightTime = hour >= 22 || hour < 8;
                                const isMotion = e.type === 'motion' || e.type === 'presence';
                                const isNightRoom = nightLocs.length > 0
                                    ? nightLocs.includes(e.location)
                                    : (e.location || e.name || '').toLowerCase().includes('schlaf');
                                return isNightTime && isNightRoom && isMotion;
                            }).length;
                        }

                        // ============================================================
                        // UNIQUE RÄUME: Zähle Räume mit Aktivität (> 0 Events)
                        // ============================================================
                        const uniqueRooms = Object.keys(roomHistoryData).filter(room => {
                            const hourlyData = roomHistoryData[room];
                            return Array.isArray(hourlyData) && hourlyData.some((h: number) => h > 0);
                        }).length;

// ============================================================
                        // BAD-MINUTEN: aus Snapshot (typ-basiert via isBathroomSensor-Flag)
                        // Fallback: /bad|wc|toilet/ keyword auf Raumnamen
                        // ============================================================
                        let bathroomVisits: number;
                        if (histData.bathroomMinutes !== undefined) {
                            bathroomVisits = histData.bathroomMinutes;
                        } else {
                            const bathLocs: string[] = histData.bathroomLocations || [];
                            bathroomVisits = Object.keys(roomHistoryData)
                                .filter(r => bathLocs.length > 0 ? bathLocs.includes(r) : /bad|wc|toilet/i.test(r))
                                .reduce((sum, r) => {
                                    const hourlyData = roomHistoryData[r];
                                    return sum + (Array.isArray(hourlyData) ? hourlyData.reduce((a: number, b: number) => a + b, 0) : 0);
                                }, 0);
                        }

                        // ============================================================
                        // FENSTER-OEFFNUNGEN: typ-basiert aus Snapshot (kein Keyword-Matching)
                        // Fallback: e.type === 'door' aus eventHistory
                        // ============================================================
                        let windowOpenings: number;
                        if (histData.windowOpenCounts) {
                            windowOpenings = Object.values(histData.windowOpenCounts as {[key: string]: number}).reduce((a: number, b: number) => a + b, 0);
                        } else {
                            // Fallback fuer alte Snapshots: type-basiert, kein Keyword-Matching
                            windowOpenings = eventHistory.filter((e: any) =>
                                e.type === 'door' && (e.value === true || e.value === 1 || e.value === 'open' || e.value === 'true')
                            ).length;
                        }

                        // ============================================================
                        // GAIT SPEED: Aus Gait Analysis (analyze_gait_speed)
                        // Nutzt Motion-Sensor-Sequenzen statt hardcoded Events!
                        // ============================================================
                        const gaitSpeed = histData.gaitSpeed !== undefined && histData.gaitSpeed !== null 
                            ? Number(histData.gaitSpeed) 
                            : 0;

                        // 🔍 DEBUG: Zeige berechnete Metriken
                        console.log(`[LongtermTrends] ✅ ${dateStr}: activity=${activityPercent}%, night=${nightEvents}, rooms=${uniqueRooms}, bathroom=${bathroomVisits}, windows=${windowOpenings}, gait=${gaitSpeed.toFixed(1)}`);

                        // Raum-Aktivitaet fuer Tooltip (Minuten pro Raum)
                        const roomActivity: {[key: string]: number} = histData.todayRoomMinutes || {};

                        // Fenster/Tuer-Oeffnungen fuer Tooltip (pro Sensor)
                        // typ-basiert aus Snapshot - kein Keyword-Matching mehr noetig
                        const windowsByRoom: {[key: string]: number} = histData.windowOpenCounts || (() => {
                            // Fallback fuer alte Snapshots: type === 'contact'
                            const r: {[key: string]: number} = {};
                            eventHistory.filter((e: any) =>
                                e.type === 'door' && (e.value === true || e.value === 1 || e.value === 'open' || e.value === 'true')
                            ).forEach((e: any) => {
                                const k = e.name || 'Unbekannt';
                                r[k] = (r[k] || 0) + 1;
                            });
                            return r;
                        })();

                        dailyData.push({
                            date: dateStr,
                            activityPercent,
                            gaitSpeed,
                            nightEvents,
                            uniqueRooms,
                            bathroomVisits,
                            windowOpenings,
                            roomActivity,
                            windowsByRoom,
                            todayVector: todayVector,  // Fuer Python Nacht-IsolationForest
                            isPartialDay: dateStr === todayDateStr
                        });
                    } else {
                        console.log(`[LongtermTrends] ❌ No data for ${dateStr}`);
                    }
                } catch (err) {
                    // History-File nicht vorhanden oder Timeout, überspringen
                    console.log(`[LongtermTrends] ⚠️ Skip ${dateStr}:`, err);
                }
            }

            // ============================================================
            // NORMALISIERUNG: Persönlicher Median als 100%-Referenz
            // Ein durchschnittlicher Tag = 100%, kein fester Divisor mehr
            // ============================================================
            const rawTotals = dailyData.map(d => d.activityPercent).filter(v => v > 0);
            const sortedTotals = [...rawTotals].sort((a, b) => a - b);
            const personalMedian = sortedTotals.length > 0
                ? sortedTotals[Math.floor(sortedTotals.length / 2)]
                : 240; // Fallback falls keine Daten
            
            // Jeden Tag relativ zum Median normalisieren (100% = Durchschnittstag)
            dailyData = dailyData.map(d => ({
                ...d,
                activityPercent: d.activityPercent > 0
                    ? Math.min(200, Math.round((d.activityPercent / personalMedian) * 100))
                    : 0
            }));
            
            console.log(`[LongtermTrends] 📐 Normalisierung: Median=${personalMedian} Events → 100%. Bereich: ${Math.min(...dailyData.map(d=>d.activityPercent))}%–${Math.max(...dailyData.map(d=>d.activityPercent))}%`);
            console.log(`[LongtermTrends] 📊 Collected ${dailyData.length} days of data`);
            
            // 🔍 DEBUG: Zeige aggregierte Daten
            if (dailyData.length > 0) {
                console.log('[LongtermTrends] 🔍 Sample data (first 3 days):', dailyData.slice(0, 3));
                const avgActivity = dailyData.reduce((sum, d) => sum + d.activityPercent, 0) / dailyData.length;
                const avgNight = dailyData.reduce((sum, d) => sum + d.nightEvents, 0) / dailyData.length;
                console.log(`[LongtermTrends] 📊 Averages: Activity=${avgActivity.toFixed(1)}%, Night Events=${avgNight.toFixed(1)}`);
            }

            // Roh-Daten für Tooltip-Detailansicht speichern
            setDailyDataRaw(dailyData);

            if (dailyData.length < 3) {
                const msg = `Nicht genug historische Daten (${dailyData.length} von min. 3 Tagen)`;
                console.error('[LongtermTrends] ❌', msg);
                setError(msg);
                setLoading(false);
                return;
            }

            // SCHRITT 2: Backend aufrufen für Trend-Berechnung
            console.log('[LongtermTrends] 🧠 Calling Python Backend...');
            const backendResponse: any = await Promise.race([
                socket.sendTo(`${adapterName}.${instance}`, 'pythonBridge', {
                    command: 'ANALYZE_LONGTERM_TRENDS',
                    dailyData: dailyData,
                    weeks: weeks
                }),
                new Promise((_, reject) => setTimeout(() => {
                    console.error('[LongtermTrends] ⏱️ Backend Timeout (30s)!');
                    reject(new Error('Backend Timeout (30s)'));
                }, 30000)) // 30 Sekunden für Backend (war 15s)
            ]);
            
            console.log('[LongtermTrends] 🧠 Backend Response:', backendResponse);

            if (backendResponse && backendResponse.type !== 'ERROR') {
                console.log('[LongtermTrends] ✅ Success! Setting trends data...');
                setTrendsData(backendResponse.payload || backendResponse);
            } else {
                const errMsg = 'Backend-Fehler: ' + (backendResponse.payload || 'Unbekannt');
                console.error('[LongtermTrends] ❌', errMsg);
                setError(errMsg);
            }

        } catch (err: any) {
            const errMsg = 'Fehler beim Laden: ' + err.message;
            console.error('[LongtermTrends] 💥 Exception:', err);
            setError(errMsg);
        } finally {
            console.log('[LongtermTrends] 🏁 Loading finished');
            setLoading(false);
        }
    };

    // Drift separat laden: immer alle verfuegbaren Daten (max. 180 Tage)
    const loadDriftData = async () => {
        setDriftLoading(true);
        try {
            const MAX_DRIFT_DAYS = 180;
            let driftDailyData: DailyDataPoint[] = [];
            const today = new Date();
            let consecutiveMissing = 0;
            for (let i = 0; i < MAX_DRIFT_DAYS; i++) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                try {
                    const response: any = await Promise.race([
                        socket.sendTo(`${adapterName}.${instance}`, 'getHistoryData', { date: dateStr, _t: Date.now() }),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
                    ]);
                    if (response.success && response.data) {
                        consecutiveMissing = 0;
                        const todayVector = response.data.todayVector || [];
                        const totalEvents = todayVector.reduce((sum: number, count: number) => sum + count, 0);
                        const gs = (response.data.gaitSpeed && response.data.gaitSpeed > 0 && response.data.gaitSpeed < 60) ? Number(response.data.gaitSpeed) : 0;
                        const nightMot = response.data.nightMotionCount !== undefined ? Number(response.data.nightMotionCount)
                            : Array.isArray(response.data.eventHistory)
                                ? response.data.eventHistory.filter((e: any) => { const h = new Date(e.timestamp || e.ts || 0).getHours(); return h >= 22 || h < 6; }).length
                                : 0;
                        const roomsData = response.data.todayRoomMinutes || {};
                        const uniqueRm = Object.keys(roomsData).filter(k => (roomsData[k] || 0) > 2).length;
                        driftDailyData.push({ date: dateStr, activityPercent: totalEvents, gaitSpeed: gs, nightEvents: nightMot, uniqueRooms: uniqueRm, bathroomVisits: 0, windowOpenings: 0 });
                    } else {
                        consecutiveMissing++;
                        if (consecutiveMissing >= 14 && i > 21) break;
                    }
                } catch { consecutiveMissing++; }
            }
            if (driftDailyData.length < 10) { setDriftData({ error: `Zu wenig Daten (${driftDailyData.length} Tage, min. 10)` }); return; }
            const rawTotals = driftDailyData.map(d => d.activityPercent).filter(v => v > 0);
            const sortedTotals = [...rawTotals].sort((a, b) => a - b);
            const median = sortedTotals[Math.floor(sortedTotals.length / 2)] || 240;
            driftDailyData = driftDailyData.map(d => ({
                ...d,
                activityPercent: d.activityPercent > 0 ? Math.min(200, Math.round((d.activityPercent / median) * 100)) : 0
            }));
            driftDailyData.sort((a, b) => a.date.localeCompare(b.date));
            const resp: any = await Promise.race([
                socket.sendTo(`${adapterName}.${instance}`, 'pythonBridge', { command: 'ANALYZE_DRIFT', dailyData: driftDailyData }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Drift Timeout')), 30000))
            ]);
            if (resp && resp.type !== 'ERROR') {
                setDriftData(resp.payload || resp);
            } else {
                setDriftData({ error: 'Drift-Backend-Fehler: ' + (resp?.payload || 'Unbekannt') });
            }
        } catch (err: any) {
            setDriftData({ error: 'Drift-Fehler: ' + err.message });
        } finally {
            setDriftLoading(false);
        }
    };

    // Hilfsfunktion: Wochentag aus Datumsstring (MM-DD oder YYYY-MM-DD)
    const getWeekday = (label: string) => {
        const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
        let year: number, month: number, day: number;
        const parts = label.split('-').map(Number);
        if (parts.length === 2) {
            year = new Date().getFullYear(); month = parts[0]; day = parts[1];
        } else {
            [year, month, day] = parts;
        }
        const d = new Date(year, month - 1, day);
        return isNaN(d.getTime()) ? '' : DAYS[d.getDay()];
    };

    // Custom Tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || payload.length === 0) return null;
        const isPartialBar = payload[0]?.payload?.isPartial;
        const compTime = payload[0]?.payload?.compTime;
        return (
            <Paper sx={{ p: 1, bgcolor: isDark ? '#1a1a1a' : '#ffffff', border: `1px solid ${isDark ? '#444' : '#ddd'}` }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>{label} <span style={{fontWeight:'normal',opacity:0.7}}>{getWeekday(label)}</span></Typography>
                {isPartialBar && <Typography variant="caption" sx={{ color: '#00bcd4', display: 'block', fontStyle: 'italic' }}> Bis {compTime} Uhr (laufend)</Typography>}
                {payload.map((entry: any, idx: number) => (
                    <Typography key={idx} variant="caption" sx={{ color: entry.color, display: 'block' }}>
                        {entry.name}: {entry.value}
                    </Typography>
                ))}
            </Paper>
        );
    };

    // Hilfsfunktion: 7-Tage gleitender Durchschnitt
    const calcMovingAvg = (values: number[], window: number = 7) => {
        return values.map((_, i) => {
            const start = Math.max(0, i - window + 1);
            const slice = values.slice(start, i + 1).filter((v: number) => v > 0);
            return slice.length > 0 ? Math.round(slice.reduce((a: number, b: number) => a + b, 0) / slice.length) : null;
        });
    };

    // Mini-Chart Daten mit Moving Average aufbereiten
    const makeMiniData = (timeline: string[], values: number[]) => {
        if (!timeline || !values) return [];
        const avgs = calcMovingAvg(values);
        return timeline.map((d: string, i: number) => ({
            date: d.substring(5),
            value: values[i] || 0,
            movingAvg: avgs[i]
        }));
    };

    // Tooltip-Factory fuer Mini-Charts mit optionalem Aufschluessel
    const MiniTooltip = ({ active, payload, label, extraData, extraLabel }: any) => {
        if (!active || !payload || payload.length === 0) return null;
        const isPartialBar = payload[0]?.payload?.isPartial;
        const compTime = payload[0]?.payload?.compTime;
        const dayEntry = dailyDataRaw.find((d: any) => d.date && d.date.substring(5) === label);
        return (
            <Paper sx={{ p: 1, bgcolor: isDark ? '#1a1a1a' : '#fff', border: `1px solid ${isDark ? '#444' : '#ddd'}`, maxWidth: 240 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block' }}>{label} <span style={{fontWeight:'normal',opacity:0.7}}>{getWeekday(label)}</span></Typography>
                {payload.map((entry: any, idx: number) => (
                    entry.value != null && <Typography key={idx} variant="caption" sx={{ color: entry.color, display: 'block' }}>
                        {entry.name}: {entry.value}
                    </Typography>
                ))}
                {extraData === 'rooms' && dayEntry?.roomActivity && Object.keys(dayEntry.roomActivity).length > 0 && (
                    <Box sx={{ mt: 0.5, borderTop: `1px solid ${isDark ? '#333' : '#eee'}`, pt: 0.5 }}>
                        <Typography variant="caption" sx={{ opacity: 0.6, display: 'block', mb: 0.3 }}>Aktive Raeume:</Typography>
                        {Object.entries(dayEntry.roomActivity)
                            .filter(([_, v]: any) => v > 0)
                            .sort(([,a]: any, [,b]: any) => (b as number) - (a as number))
                            .slice(0, 5)
                            .map(([room, mins]: any) => (
                                <Typography key={room} variant="caption" sx={{ display: 'block', fontSize: '0.6rem' }}>
                                    {room}: {mins} min aktiv
                                </Typography>
                            ))}
                    </Box>
                )}
                {extraData === 'windows' && dayEntry?.windowsByRoom && Object.keys(dayEntry.windowsByRoom).length > 0 && (
                    <Box sx={{ mt: 0.5, borderTop: `1px solid ${isDark ? '#333' : '#eee'}`, pt: 0.5 }}>
                        <Typography variant="caption" sx={{ opacity: 0.6, display: 'block', mb: 0.3 }}>Geoeffnet:</Typography>
                        {Object.entries(dayEntry.windowsByRoom)
                            .sort(([,a]: any, [,b]: any) => (b as number) - (a as number))
                            .map(([name, count]: any) => {
                                const sn = String(name).replace(/^homematic\s+/i,'').replace(/^[a-zA-Z0-9]+\.[0-9]+\.[^.]+\./i,'').substring(0,26);
                                return (<Typography key={name} variant="caption" sx={{ display: 'block', fontSize: '0.58rem', lineHeight: 1.3 }}>
                                    {sn}: {count}x
                                </Typography>);
                            })}
                    </Box>
                )}
            </Paper>
        );
    };

    // Farben
    const greenZone = isDark ? 'rgba(40, 167, 69, 0.2)' : 'rgba(40, 167, 69, 0.15)';
    const orangeZone = isDark ? 'rgba(253, 126, 20, 0.2)' : 'rgba(253, 126, 20, 0.15)';
    const redZone = isDark ? 'rgba(220, 53, 69, 0.2)' : 'rgba(220, 53, 69, 0.15)';
    const lineColor = isDark ? '#ffffff' : '#000000';
    const gridColor = isDark ? '#333' : '#e0e0e0';

    // Bereite Haupt-Graph-Daten vor
    const nowForChart = new Date();
    const todayMD = nowForChart.toISOString().split('T')[0].substring(5);
    const hh = nowForChart.getHours().toString().padStart(2,'0');
    const mm = nowForChart.getMinutes().toString().padStart(2,'0');
    const compTimeStr = hh + ':' + mm;
    const mainChartData = trendsData?.activity?.timeline?.map((date: string, idx: number) => ({
        date: date.substring(5),
        value: Math.round(trendsData.activity.values[idx]),
        movingAvg: Math.round(trendsData.activity.moving_avg[idx]),
        baseline: trendsData.activity.baseline,
        isPartial: date.substring(5) === todayMD,
        compTime: date.substring(5) === todayMD ? compTimeStr : undefined
    })) || [];

    const baseline = trendsData?.activity?.baseline || 100;
    const baselineStd = trendsData?.activity?.baseline_std || 15;
    
    // Y-Achse: 0–200% (100% = persönlicher Durchschnittstag)
    // Damit sind individuelle Abweichungen klar sichtbar
    const dataMin = 0;
    const dataMax = 200;

    return (
        <Box sx={{ p: 2 }}>
            {/* Header mit Zeitraum-Auswahl */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: isDark ? '#00e676' : '#00a152' }}>
                    📊 LANGZEIT-TRENDS (GARMIN-STYLE)
                </Typography>
                <ButtonGroup size="small">
                    <Button
                        variant={timeRange === 'week' ? 'contained' : 'outlined'}
                        onClick={() => setTimeRange('week')}
                        sx={{ textTransform: 'none' }}
                    >
                        WOCHE
                    </Button>
                    <Button
                        variant={timeRange === '4weeks' ? 'contained' : 'outlined'}
                        onClick={() => setTimeRange('4weeks')}
                        sx={{ textTransform: 'none' }}
                    >
                        4 WOCHEN
                    </Button>
                    <Button
                        variant={timeRange === '6months' ? 'contained' : 'outlined'}
                        onClick={() => setTimeRange('6months')}
                        sx={{ textTransform: 'none' }}
                    >
                        6 MONATE
                    </Button>
                </ButtonGroup>
            </Box>

            {/* Loading Spinner */}
            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                    <CircularProgress />
                </Box>
            )}

            {/* Error Message */}
            {error && !loading && (
                <Typography variant="body2" sx={{ color: 'error.main', textAlign: 'center', my: 2 }}>
                    ⚠️ {error}
                </Typography>
            )}

            {/* Haupt-Graph: AKTIVITÄTS-BELASTUNG */}
            {!loading && !error && trendsData && (
                <>
                    <Paper sx={{ p: 2, mb: 3, bgcolor: isDark ? '#0a0a0a' : '#ffffff' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: isDark ? '#00e676' : '#00a152' }}>
                                AKTIVITÄTS-BELASTUNG
                            </Typography>
                            <ChartHelp text={"Zeigt deine tägliche Bewegungsintensität im Vergleich zu deinem persönlichen Durchschnitt (= 100%). Hellblau = Tageswert, Grau = 7-Tage-Trend. Grüne Zone (60–140%) ist dein Normalbereich. Werte unter 60% oder über 140% deuten auf unübliche Aktivität hin – z.B. Krankheit oder besonders aktive Tage."} />
                        </Box>
                        {trendsData.activity && (() => {
                            const ma = (trendsData.activity as any).moving_avg as number[];
                            const last = ma && ma.length > 0 ? ma[ma.length - 1] : null;
                            const base = (trendsData.activity as any).baseline as number;
                            const trend = last === null ? 'N/A' : last > (base + 10) ? 'STEIGEND ↑' : last < (base - 10) ? 'FALLEND ↓' : 'STABIL';
                            return (
                                <Typography variant="caption" sx={{ color: isDark ? '#888' : '#666', display: 'block', mb: 1 }}>
                                    Ø {base}% (14-Tage-Median) | {trend} · 0–24 Uhr
                                </Typography>
                            );
                        })()}

                        {mainChartData.length > 0 ? (
                            <>
                                {/* ComposedChart: Balken (Tageswert) + Linie (7-Tage-Trend) */}
                                <ResponsiveContainer width="100%" height={250}>
                                    <ComposedChart data={mainChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                        <XAxis dataKey="date" stroke={lineColor} style={{ fontSize: '0.65rem' }} interval={Math.floor(mainChartData.length / 10)} />
                                        <YAxis domain={[0, 200]} stroke={lineColor} style={{ fontSize: '0.7rem' }} tickFormatter={(v: number) => `${v}%`} />
                                        <Tooltip content={<CustomTooltip />} />
                                        {/* Farbzonen als Referenz */}
                                        <ReferenceArea y1={0}   y2={60}  fill="rgba(220,53,69,0.15)" />
                                        <ReferenceArea y1={60}  y2={140} fill="rgba(40,167,69,0.15)" />
                                        <ReferenceArea y1={140} y2={200} fill="rgba(253,126,20,0.15)" />
                                        <ReferenceLine y={100} stroke="#888" strokeDasharray="5 5" label={{ value: "Normalwert", position: "insideRight", fontSize: 10 }} />
                                        <Bar dataKey="value" name="Tageswert %" radius={[2,2,0,0]}>
                                            {mainChartData.map((entry: any, index: number) => (
                                                <Cell key={"cell-" + index} fill="#4fc3f7" opacity={entry.isPartial ? 0.5 : 0.85} stroke={entry.isPartial ? '#00e5ff' : 'none'} strokeWidth={entry.isPartial ? 2 : 0} />
                                            ))}
                                        </Bar>
                                        <Line type="monotone" dataKey="movingAvg" stroke="#546e7a" strokeWidth={2} dot={false} name="Ø 7 Tage" />
                                    </ComposedChart>
                                </ResponsiveContainer>

                                <Box sx={{ mt: 1, fontSize: '0.7rem', color: isDark ? '#aaa' : '#666', display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                    <span>🔴 <strong>ALARMZONE (&lt;60%)</strong>: Sehr niedrige Aktivität</span>
                                    <span>🟢 <strong>NORMALBEREICH (60–140%)</strong>: Typisches Niveau</span>
                                    <span>🟡 <strong>ERHÖHT (&gt;140%)</strong>: Ungewöhnlich aktiv</span>
                                    <span style={{ opacity: 0.7, display: 'block', marginTop: 4, width: '100%' }}>100% = persönlicher Durchschnittstag (rollender Median) | Hellblau = Tageswert, Grau = 7-Tage-Trend</span>
                                </Box>
                            </>
                        ) : (
                            <Box sx={{ p: 3, textAlign: 'center', color: isDark ? '#888' : '#aaa' }}>
                                <Typography variant="body2">Keine Aktivitätsdaten verfügbar</Typography>
                                <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                                    trendsData.activity: {JSON.stringify(trendsData?.activity)?.substring(0, 200)}
                                </Typography>
                            </Box>
                        )}
                    </Paper>

                    {/* ═══ DRIFT-ANALYSE Gruppe ═══ */}
                    <Box sx={{
                        mt: 3,
                        borderLeft: '4px solid #ff9800',
                        borderRadius: '0 8px 8px 0',
                        bgcolor: isDark ? 'rgba(255,152,0,0.04)' : 'rgba(255,152,0,0.03)',
                        pl: 2,
                        pr: 0.5,
                        pt: 2,
                        pb: 1,
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                            <Typography variant="overline" sx={{
                                color: '#ff9800',
                                fontWeight: 'bold',
                                letterSpacing: '0.12em',
                                fontSize: '0.7rem',
                                lineHeight: 1,
                            }}>
                                🔬 DRIFT-ANALYSE
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1.5, fontSize: '0.62rem' }}>
                                Langzeit-Veränderungen — die 3 Kacheln und der Monitor darunter zeigen dasselbe Bild: kurz vs. lang
                            </Typography>
                        </Box>
                                    {/* Mini-Graphen Grid */}
                    <Grid container spacing={2}>
                        {/* 1. Ganggeschwindigkeit */}
                        <Grid item xs={12} md={6} lg={4}>
                            <Paper sx={{ p: 2, bgcolor: isDark ? '#0a0a0a' : '#ffffff', height: '100%' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: isDark ? '#00e676' : '#00a152' }}>
                                        GANGGESCHWINDIGKEIT
                                    </Typography>
                                    <ChartHelp text={"Misst wie lange du durchschnittlich brauchst, um den Flur zu durchqueren (Median in Sekunden). Eine länger werdende Durchquerungszeit kann auf nachlassende Mobilität hinweisen. Typischer Normalbereich: 3–15 Sekunden. Nur Sensoren die als Flur markiert sind werden berücksichtigt."} />
                                </Box>
                                <Typography variant="caption" sx={{ display: 'block', color: trendsData.gait?.status === 'VERSCHLECHTERT' ? 'error.main' : 'text.secondary' }}>
                                    Ø {trendsData.gait?.avg?.toFixed(1) || 'N/A'} Sek. | {trendsData.gait?.status || 'N/A'} · 0–24 Uhr
                                </Typography>
                                <ResponsiveContainer width="100%" height={150}>
                                    <ComposedChart data={makeMiniData(trendsData.gait?.timeline || [], trendsData.gait?.values || [])}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                        <XAxis dataKey="date" stroke={lineColor} style={{ fontSize: '0.6rem' }} interval={Math.floor((trendsData.gait?.timeline?.length || 1) / 6)} />
                                        <YAxis stroke={lineColor} style={{ fontSize: '0.6rem' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="value" fill="#00e676" opacity={0.7} name="Sekunden" radius={[2,2,0,0]} />
                                        <Line type="monotone" dataKey="movingAvg" stroke="#546e7a" strokeWidth={2} dot={false} name="Ø 7 Tage" connectNulls />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </Paper>
                        </Grid>

                        {/* 2. Nacht-Unruhe (personalisierte Anomalie) */}
                        <Grid item xs={12} md={6} lg={4}>
                            <Paper sx={{ p: 2, bgcolor: isDark ? '#0a0a0a' : '#ffffff', height: '100%' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: isDark ? '#00e676' : '#00a152' }}>
                                        NACHT-UNRUHE
                                    </Typography>
                                    <ChartHelp text={"Zählt Bewegungsereignisse zwischen 22:00 und 08:00 Uhr in Schlafräumen. Viele Ereignisse deuten auf unruhigen Schlaf oder häufiges Aufstehen hin. Nur Sensoren die als Nacht markiert sind werden berücksichtigt. Der Trend vergleicht die letzten 7 Tage mit dem 4-Wochen-Durchschnitt."} />
                                </Box>
                                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                                    Ø {trendsData.night?.avg || 0} Events | {trendsData.night?.trend || 'N/A'} · 22–08 Uhr
                                    {trendsData.night?.last_night_normal !== undefined && (
                                        <span style={{ color: trendsData.night.last_night_normal ? '#28a745' : '#fd7e14', marginLeft: 6 }}>
                                            · Letzte Nacht: {trendsData.night.last_night_normal ? 'normal' : 'ungewöhnlich'}
                                        </span>
                                    )}
                                </Typography>
                                <ResponsiveContainer width="100%" height={150}>
                                    <ComposedChart data={makeMiniData(trendsData.night?.timeline || [], trendsData.night?.values || [])}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                        <XAxis dataKey="date" stroke={lineColor} style={{ fontSize: '0.6rem' }} interval={Math.floor((trendsData.night?.timeline?.length || 1) / 6)} />
                                        <YAxis stroke={lineColor} style={{ fontSize: '0.6rem' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="value" fill="#fd7e14" opacity={0.8} name="Bewegungen" radius={[2,2,0,0]} />
                                        <Line type="monotone" dataKey="movingAvg" stroke="#546e7a" strokeWidth={2} dot={false} name="Ø 7 Tage" connectNulls />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </Paper>
                        </Grid>

                        {/* 3. Raum-Mobilität */}
                        <Grid item xs={12} md={6} lg={4}>
                            <Paper sx={{ p: 2, bgcolor: isDark ? '#0a0a0a' : '#ffffff', height: '100%' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: isDark ? '#00e676' : '#00a152' }}>
                                        RAUM-MOBILITÄT
                                    </Typography>
                                    <ChartHelp text={"Zeigt in wie vielen verschiedenen Räumen du dich pro Tag bewegt hast. Wenige besuchte Räume können ein Zeichen von eingeschränkter Mobilität sein. Im Tooltip siehst du für jeden Raum wie viele Minuten aktive Bewegung registriert wurde. Alle Bewegungssensoren außer Nacht-Sensoren werden berücksichtigt."} />
                                </Box>
                                <Typography variant="caption" sx={{ display: 'block', color: trendsData.mobility?.trend === 'IMMOBIL' ? 'error.main' : 'text.secondary' }}>
                                    Ø {trendsData.mobility?.avg || 0} Räume | {trendsData.mobility?.trend || 'N/A'} · 0–24 Uhr
                                </Typography>
                                <ResponsiveContainer width="100%" height={150}>
                                    <ComposedChart data={makeMiniData(trendsData.mobility?.timeline || [], trendsData.mobility?.values || [])}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                        <XAxis dataKey="date" stroke={lineColor} style={{ fontSize: '0.6rem' }} interval={Math.floor((trendsData.mobility?.timeline?.length || 1) / 6)} />
                                        <YAxis stroke={lineColor} style={{ fontSize: '0.6rem' }} />
                                        <Tooltip content={<MiniTooltip extraData="rooms" />} />
                                        <Bar dataKey="value" fill="#ffcc02" opacity={0.7} name="Räume" />
                                    <Line type="monotone" dataKey="movingAvg" stroke="#546e7a" strokeWidth={2} dot={false} name="Ø 7 Tage" connectNulls />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </Paper>
                        </Grid>

                    </Grid>

                    {/* ═══ DRIFT-MONITOR – Langzeit-Trend-Überwachung ═══ */}
                    <Grid item xs={12}>
                        <Paper sx={{
                            p: 2,
                            bgcolor: isDark ? '#0a0a0a' : '#ffffff',
                            border: `1px solid ${isDark ? '#333' : '#ddd'}`,
                            borderLeft: '3px solid #ff9800'
                        }}>
                            {/* Kopfzeile */}
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#ff9800' }}>
                                        🔬 DRIFT-MONITOR
                                    </Typography>
                                    <ChartHelp text={"Erkennt schleichende Veränderungen über Wochen und Monate (Page-Hinkley-Test). Jede Kurve zeigt wie weit sich eine Metrik von ihrer persönlichen Baseline entfernt hat – in Prozent der Alarmschwelle. 0 % = kein Drift, 100 % = Alarm. Die ersten 7–14 Tage sind Kalibrierungsphase (Score = 0). Farben sind identisch mit den Einzelkacheln darüber."} />
                                </Box>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>
                                    {driftData?.n_days ? `${driftData.n_days} Tage · 0–100 % der persönl. Alarmschwelle` : ''}
                                </Typography>
                            </Box>

                            {driftLoading ? (
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textAlign: 'center', py: 3 }}>
                                    Lade Drift-Daten (bis zu 180 Tage)…
                                </Typography>
                            ) : driftData && !driftData.error ? (
                                <>
                                    {/* Status-Chips – normalisiert 0-100 % */}
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                                        {([
                                            { key: 'activity', label: 'Aktivität',           color: '#4fc3f7', icon: '🏃',
                                              tip: 'Misst ob die Gesamtaktivität über Wochen sinkt. 100 % = Alarm. Schwelle = 3 × deine-persönl.-Schwankung × √(Erkennungstage). Je stärker du normalerweise schwankst, desto höher die Schwelle.' },
                                            { key: 'gait',     label: 'Ganggeschwindigkeit', color: '#00e676', icon: '🚶',
                                              tip: 'Misst ob du langsam langsamer wirst (längere Flur-Transitzeiten). Anstieg = ungünstig. 100 % = Alarm.' },
                                            { key: 'night',    label: 'Nacht-Unruhe',        color: '#fd7e14', icon: '😴',
                                              tip: 'Misst ob die nächtliche Bewegungsaktivität über Wochen zunimmt. Mehr Nacht-Events = schlechterer Schlaf. 100 % = Alarm.' },
                                            { key: 'rooms',    label: 'Raum-Mobilität',     color: '#ffcc02', icon: '🏠',
                                              tip: 'Misst ob du langfristig immer weniger Räume nutzt. Ein Rückzug auf wenige Räume kann ein Frühwarnsignal sein. 100 % = Alarm.' },
                                        ] as Array<{key:string,label:string,color:string,icon:string,tip:string}>).map(({ key, label, color, icon, tip }) => {
                                            const m = (driftData as any)[key];
                                            if (!m || m.error) return (
                                                <MuiTooltip key={key} title={tip} arrow>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.4, borderRadius: 1, bgcolor: isDark ? '#1a1a1a' : '#f5f5f5', cursor: 'help' }}>
                                                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, opacity: 0.4 }} />
                                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                                                            {icon} {label}: {m?.error || 'Keine Daten'}
                                                        </Typography>
                                                    </Box>
                                                </MuiTooltip>
                                            );
                                            const pct = Math.min(100, Math.round((m.current_score / (m.threshold || 1)) * 100));
                                            const chipColor = m.drift_detected ? '#dc3545' : pct > 50 ? '#fd7e14' : '#28a745';
                                            const status    = m.drift_detected ? 'Drift erkannt' : pct > 50 ? 'Beobachten' : 'Stabil';
                                            return (
                                                <MuiTooltip key={key} title={tip} arrow>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.2, py: 0.4, borderRadius: 1,
                                                        bgcolor: chipColor + '22', border: `1px solid ${chipColor}55`, cursor: 'help' }}>
                                                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
                                                        <Typography variant="caption" sx={{ fontWeight: 'bold', color: chipColor, fontSize: '0.7rem' }}>
                                                            {icon} {label}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                                                            {status} · {pct} %
                                                        </Typography>
                                                    </Box>
                                                </MuiTooltip>
                                            );
                                        })}
                                    </Box>

                                    {/* Normalisierter 0–100%-Chart */}
                                    {(() => {
                                        const metrics = [
                                            { key: 'activity', color: '#4fc3f7', name: 'act'   },
                                            { key: 'gait',     color: '#00e676', name: 'gait'  },
                                            { key: 'night',    color: '#fd7e14', name: 'night' },
                                            { key: 'rooms',    color: '#ffcc02', name: 'rooms' },
                                        ];
                                        // Build date-indexed chart data (aligned to calendar dates)
                                        const allDates: string[] = (driftData as any).dates || [];
                                        const gaitDates: string[] = (driftData as any).gait_dates || [];
                                        const fmtDate = (iso: string) => { if (!iso) return ''; const p = iso.split('-'); return p.length === 3 ? p[2] + '.' + p[1] : iso; };
                                        // Map gait scores by date for alignment with other metrics
                                        const gaitByDate: Record<string, number> = {};
                                        const gaitScores: number[] = (driftData as any).gait?.scores || [];
                                        gaitDates.forEach((d: string, i: number) => { if (gaitScores[i] != null) gaitByDate[d] = gaitScores[i]; });
                                        const maxLen = allDates.length > 0 ? allDates.length : Math.max(...metrics.filter(m => m.key !== 'gait').map(m => (driftData as any)[m.key]?.scores?.length || 0));
                                        if (maxLen === 0) return null;
                                        const chartData = Array.from({ length: maxLen }, (_: any, i: number) => {
                                            const iso = allDates[i] || '';
                                            const pt: any = { date: fmtDate(iso) || String(i + 1) };
                                            metrics.forEach(({ key, name }) => {
                                                const m = (driftData as any)[key];
                                                if (key === 'gait') {
                                                    const gv = iso ? gaitByDate[iso] : m?.scores?.[i];
                                                    if (gv != null && m?.threshold > 0) pt[name] = Math.min(110, Math.round((gv / m.threshold) * 100));
                                                } else if (m?.scores?.[i] != null && m.threshold > 0) {
                                                    pt[name] = Math.min(110, Math.round((m.scores[i] / m.threshold) * 100));
                                                }
                                            });
                                            return pt;
                                        });
                                        return (
                                            <ResponsiveContainer width="100%" height={160}>
                                                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="2 4" stroke={isDark ? '#222' : '#eee'} />
                                                    <XAxis dataKey="date" stroke={lineColor} style={{ fontSize: '0.55rem' }} interval={Math.max(1, Math.floor(chartData.length / 8))} />
                                                    <YAxis stroke={lineColor} style={{ fontSize: '0.55rem' }} domain={[0, 110]}
                                                        tickFormatter={(v: number) => `${v} %`} />
                                                    <Tooltip
                                                        formatter={(v: any, name: string) => {
                                                            const labels: Record<string,string> = { act: '🏃 Aktivität', gait: '🚶 Ganggeschw.', night: '😴 Nacht', rooms: '🏠 Räume' };
                                                            return [v != null ? `${v} %` : '–', labels[name] || name];
                                                        }}
                                                        labelFormatter={(label: any) => label ? `${label}` : ''}
                                                        contentStyle={{ backgroundColor: isDark ? '#1a1a1a' : '#fff', border: '1px solid #444', fontSize: '0.7rem' }}
                                                    />
                                                    <ReferenceLine y={100} stroke="#dc3545" strokeDasharray="4 3"
                                                        label={{ value: 'Alarm (100 %)', position: 'right', fill: '#dc3545', fontSize: 9 }} />
                                                    <ReferenceLine y={50} stroke="#fd7e14" strokeDasharray="2 4" strokeOpacity={0.5} />
                                                    {metrics.map(({ key, color, name }) =>
                                                        (driftData as any)[key]?.scores && (
                                                            <Line key={name} type="monotone" dataKey={name} stroke={color}
                                                                strokeWidth={1.8} dot={false} connectNulls name={name} />
                                                        )
                                                    )}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        );
                                    })()}

                                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem', display: 'block', mt: 1 }}>
                                        <span style={{ color: '#4fc3f7' }}>&#9632;</span> Aktivität 
                                        <span style={{ color: '#00e676' }}>&#9632;</span> Ganggeschwindigkeit 
                                        <span style={{ color: '#fd7e14' }}>&#9632;</span> Nacht-Unruhe 
                                        <span style={{ color: '#ffcc02' }}>&#9632;</span> Raum-Mobilität  |  
                                        Gelbe Linie = 50 % (Beobachten) · Rote Linie = 100 % (Alarm)
                                        {(driftData as any).activity?.calibration_days ? ` | Erste ${(driftData as any).activity.calibration_days} Tage = Kalibrierung.` : ''}
                                    </Typography>
                                </>
                            ) : driftData?.error ? (
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.65rem' }}>
                                    {driftData.error}
                                </Typography>
                            ) : (
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textAlign: 'center', py: 3 }}>
                                    Drift-Analyse lädt… (min. 10 Tage Daten nötig)
                                </Typography>
                            )}
                        </Paper>
                    </Grid>

                    <Grid item xs={12} style={{ display: 'none' }}>{/* keeps grid structure */}</Grid>
                    </Box>

                    {/* ═══ HYGIENE & LÜFTUNG Gruppe ═══ */}
                    <Box sx={{
                        mt: 3,
                        borderLeft: '4px solid #4db6ac',
                        borderRadius: '0 8px 8px 0',
                        bgcolor: isDark ? 'rgba(77,182,172,0.04)' : 'rgba(77,182,172,0.03)',
                        pl: 2,
                        pr: 0.5,
                        pt: 2,
                        pb: 1,
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                            <Typography variant="overline" sx={{
                                color: '#4db6ac',
                                fontWeight: 'bold',
                                letterSpacing: '0.12em',
                                fontSize: '0.7rem',
                                lineHeight: 1,
                            }}>
                                🏠 HYGIENE & LÜFTUNG
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1.5, fontSize: '0.62rem' }}>
                                Unabhängige Metriken — kein Einfluss auf den Drift-Monitor
                            </Typography>
                        </Box>
                    {/* Weitere Gesundheitskacheln */}
                    <Grid container spacing={2} sx={{ mt: 2 }}>
                        {/* 4. Hygiene-Frequenz */}
                        <Grid item xs={12} md={6} lg={4}>
                            <Paper sx={{ p: 2, bgcolor: isDark ? '#0a0a0a' : '#ffffff', height: '100%' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: isDark ? '#00e676' : '#00a152' }}>
                                        BAD-NUTZUNG
                                    </Typography>
                                    <ChartHelp text={"Zählt die Minuten täglicher Bewegungsaktivität im Badezimmer. Eine starke Zu- oder Abnahme kann hygienische Gewohnheitsänderungen anzeigen. Nur Sensoren die als Bad markiert sind werden berücksichtigt. Thermostat-Sensoren werden nicht mitgezählt."} />
                                </Box>
                                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                                    Ø {trendsData.hygiene?.avg || 0} Min. | {trendsData.hygiene?.trend || 'N/A'} · 0–24 Uhr
                                </Typography>
                                <ResponsiveContainer width="100%" height={150}>
                                    <ComposedChart data={makeMiniData(trendsData.hygiene?.timeline || [], trendsData.hygiene?.values || [])}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                        <XAxis dataKey="date" stroke={lineColor} style={{ fontSize: '0.6rem' }} interval={Math.floor((trendsData.hygiene?.timeline?.length || 1) / 6)} />
                                        <YAxis stroke={lineColor} style={{ fontSize: '0.6rem' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="value" fill="#9c27b0" opacity={0.7} name="Minuten" radius={[2,2,0,0]} />
                                        <Line type="monotone" dataKey="movingAvg" stroke="#546e7a" strokeWidth={2} dot={false} name="Ø 7 Tage" connectNulls />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </Paper>
                        </Grid>

                        {/* 5. Lüftungsverhalten */}
                        <Grid item xs={12} md={6} lg={4}>
                            <Paper sx={{ p: 2, bgcolor: isDark ? '#0a0a0a' : '#ffffff', height: '100%' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: isDark ? '#00e676' : '#00a152' }}>
                                        FRISCHLUFT
                                    </Typography>
                                    <ChartHelp text={"Zählt wie oft Fenster oder Türen pro Tag geöffnet wurden. Regelmäßiges Lüften ist wichtig für Wohlbefinden und Gesundheit. Nur Kontaktsensoren vom Typ Tür werden gezählt. Im Tooltip siehst du welche Fenster und Türen besonders häufig geöffnet wurden."} />
                                </Box>
                                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                                    Ø {trendsData.ventilation?.avg || 0} Öffnungen | {trendsData.ventilation?.trend || 'N/A'} · 0–24 Uhr
                                </Typography>
                                <ResponsiveContainer width="100%" height={150}>
                                    <ComposedChart data={makeMiniData(trendsData.ventilation?.timeline || [], trendsData.ventilation?.values || [])}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                        <XAxis dataKey="date" stroke={lineColor} style={{ fontSize: '0.6rem' }} interval={Math.floor((trendsData.ventilation?.timeline?.length || 1) / 6)} />
                                        <YAxis stroke={lineColor} style={{ fontSize: '0.6rem' }} />
                                        <Tooltip content={<MiniTooltip extraData="windows" />} />
                                        <Bar dataKey="value" fill="#03a9f4" opacity={0.7} name="Oeffnungen" radius={[2,2,0,0]} />
                                        <Line type="monotone" dataKey="movingAvg" stroke="#546e7a" strokeWidth={2} dot={false} name="Ø 7 Tage" connectNulls />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </Paper>
                        </Grid>


                    </Grid>
                    </Box>
                </>
            )}
        </Box>
    );
}












