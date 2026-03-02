import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Button, ButtonGroup, CircularProgress, Grid, Paper
} from '@mui/material';
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar,
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
}

export default function LongtermTrendsView(props: LongtermTrendsViewProps) {
    const { socket, adapterName, instance, themeType } = props;
    const isDark = themeType === 'dark';

    const [timeRange, setTimeRange] = useState<'week' | '4weeks' | '6months'>('4weeks');
    const [loading, setLoading] = useState<boolean>(false);
    const [trendsData, setTrendsData] = useState<any>(null);
    const [error, setError] = useState<string>('');

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
            const dailyData: DailyDataPoint[] = [];
            const today = new Date();

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
                        const totalEvents = todayVector.reduce((sum: number, count: number) => sum + count, 0);
                        const activityPercent = totalEvents; // temporär: roh, wird unten normalisiert
                        
                        // ============================================================
                        // NACHT-EVENTS: Events zwischen 22:00-06:00 NUR IM SCHLAFZIMMER!
                        // ============================================================
                        const nightEvents = eventHistory.filter((e: any) => {
                            if (!e.timestamp) return false;
                            const hour = new Date(e.timestamp).getHours();
                            const isNightTime = hour >= 22 || hour < 6;
                            const isBedroom = (e.location || e.name || '').toLowerCase().includes('schlaf');
                            return isNightTime && isBedroom;
                        }).length;

                        // ============================================================
                        // UNIQUE RÄUME: Zähle Räume mit Aktivität (> 0 Events)
                        // ============================================================
                        const uniqueRooms = Object.keys(roomHistoryData).filter(room => {
                            const hourlyData = roomHistoryData[room];
                            return Array.isArray(hourlyData) && hourlyData.some((h: number) => h > 0);
                        }).length;

                        // ============================================================
                        // BAD-BESUCHE: Summe aller Events in Bad/WC-Räumen
                        // ============================================================
                        const bathroomVisits = Object.keys(roomHistoryData)
                            .filter(r => /bad|wc|toilet/i.test(r))
                            .reduce((sum, r) => {
                                const hourlyData = roomHistoryData[r];
                                return sum + (Array.isArray(hourlyData) ? hourlyData.reduce((a: number, b: number) => a + b, 0) : 0);
                            }, 0);

                        // ============================================================
                        // FENSTER-ÖFFNUNGEN: Nur Events mit value=true/"open"!
                        // ============================================================
                        const windowOpenings = eventHistory.filter((e: any) => {
                            const name = (e.name || '').toLowerCase();
                            const hasWindowKeyword = name.includes('window') || name.includes('fenster') || name.includes('tür') || name.includes('door');
                            const isOpening = e.value === true || e.value === 1 || e.value === 'open' || e.value === 'true';
                            return hasWindowKeyword && isOpening;
                        }).length;

                        // ============================================================
                        // GAIT SPEED: Aus Gait Analysis (analyze_gait_speed)
                        // Nutzt Motion-Sensor-Sequenzen statt hardcoded Events!
                        // ============================================================
                        const gaitSpeed = histData.gaitSpeed !== undefined && histData.gaitSpeed !== null 
                            ? Number(histData.gaitSpeed) 
                            : 0;

                        // 🔍 DEBUG: Zeige berechnete Metriken
                        console.log(`[LongtermTrends] ✅ ${dateStr}: activity=${activityPercent}%, night=${nightEvents}, rooms=${uniqueRooms}, bathroom=${bathroomVisits}, windows=${windowOpenings}, gait=${gaitSpeed.toFixed(1)}`);

                        dailyData.push({
                            date: dateStr,
                            activityPercent,
                            gaitSpeed,
                            nightEvents,
                            uniqueRooms,
                            bathroomVisits,
                            windowOpenings,
                            todayVector: todayVector  // Für Python Nacht-IsolationForest
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

    // Custom Tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || payload.length === 0) return null;
        return (
            <Paper sx={{ p: 1, bgcolor: isDark ? '#1a1a1a' : '#ffffff', border: `1px solid ${isDark ? '#444' : '#ddd'}` }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>{label}</Typography>
                {payload.map((entry: any, idx: number) => (
                    <Typography key={idx} variant="caption" sx={{ color: entry.color, display: 'block' }}>
                        {entry.name}: {entry.value}
                    </Typography>
                ))}
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
    const mainChartData = trendsData?.activity?.timeline?.map((date: string, idx: number) => ({
        date: date.substring(5), // MM-DD
        value: Math.round(trendsData.activity.values[idx]),
        movingAvg: Math.round(trendsData.activity.moving_avg[idx]),
        baseline: trendsData.activity.baseline
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
                        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', color: isDark ? '#00e676' : '#00a152' }}>
                            AKTIVITÄTS-BELASTUNG
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={mainChartData}>
                                <defs>
                                    <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#dc3545" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#dc3545" stopOpacity={0.1} />
                                    </linearGradient>
                                    <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#28a745" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#28a745" stopOpacity={0.1} />
                                    </linearGradient>
                                    <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#fd7e14" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#fd7e14" stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                <XAxis dataKey="date" stroke={lineColor} style={{ fontSize: '0.7rem' }} />
                                <YAxis 
                                    domain={[dataMin, dataMax]} 
                                    stroke={lineColor} 
                                    style={{ fontSize: '0.7rem' }}
                                    tickFormatter={(v: number) => `${v}%`}
                                />
                                <Tooltip content={<CustomTooltip />} formatter={(v: any) => [`${v}%`]} />
                                <Legend />

                                {/* Farbzonen: relativ zu 100% (= persönlicher Durchschnittstag) */}
                                <ReferenceArea y1={0}   y2={60}  fill="url(#redGradient)"    fillOpacity={1} />
                                <ReferenceArea y1={60}  y2={140} fill="url(#greenGradient)"  fillOpacity={1} />
                                <ReferenceArea y1={140} y2={200} fill="url(#orangeGradient)" fillOpacity={1} />

                                {/* 100%-Linie = persönlicher Normalwert */}
                                <ReferenceLine y={100} stroke="#888" strokeDasharray="5 5" label={{ value: "Normalwert", position: "insideRight", fontSize: 11 }} />

                                {/* Tageswerte (halbtransparent) */}
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#fd7e14"
                                    strokeWidth={1}
                                    strokeOpacity={0.6}
                                    dot={{ fill: '#fd7e14', r: 3, fillOpacity: 0.8 }}
                                    name="Tageswert"
                                />

                                {/* Trendlinie (7-Tage MA) */}
                                <Line
                                    type="monotone"
                                    dataKey="movingAvg"
                                    stroke={lineColor}
                                    strokeWidth={3}
                                    dot={{ fill: lineColor, r: 4 }}
                                    name="Trend (7-Tage Ø)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>

                        {/* Legende */}
                        <Box sx={{ mt: 2, fontSize: '0.7rem', color: isDark ? '#aaa' : '#666' }}>
                            <div>🔴 <strong>ALARMZONE (&lt;60%)</strong>: Sehr niedrige Aktivität für diese Person</div>
                            <div>🟢 <strong>NORMALBEREICH (60–140%)</strong>: Typisches Niveau für dieses Haus</div>
                            <div>🟠 <strong>ERHÖHT (&gt;140%)</strong>: Ungewöhnlich aktiv (Besuch, Aufregung?)</div>
                            <div style={{ marginTop: 4, opacity: 0.7 }}>100% = persönlicher Durchschnittstag (rollender Median)</div>
                        </Box>
                    </Paper>

                    {/* Mini-Graphen Grid */}
                    <Grid container spacing={2}>
                        {/* 1. Ganggeschwindigkeit */}
                        <Grid item xs={12} md={6} lg={4}>
                            <Paper sx={{ p: 2, bgcolor: isDark ? '#0a0a0a' : '#ffffff', height: '100%' }}>
                                <Typography variant="caption" sx={{ fontWeight: 'bold', color: isDark ? '#00e676' : '#00a152' }}>
                                    GANGGESCHWINDIGKEIT
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', color: trendsData.gait?.status === 'VERSCHLECHTERT' ? 'error.main' : 'text.secondary' }}>
                                    Trend: {trendsData.gait?.status || 'N/A'} ({trendsData.gait?.trend_percent || 0}%)
                                </Typography>
                                <ResponsiveContainer width="100%" height={150}>
                                    <LineChart data={trendsData.gait?.timeline?.map((d: string, i: number) => ({ date: d.substring(5), value: trendsData.gait.values[i] })) || []}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                        <XAxis dataKey="date" stroke={lineColor} style={{ fontSize: '0.6rem' }} />
                                        <YAxis stroke={lineColor} style={{ fontSize: '0.6rem' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Line type="monotone" dataKey="value" stroke="#00e676" strokeWidth={2} dot={false} name="Sekunden" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Paper>
                        </Grid>

                        {/* 2. Nacht-Unruhe (personalisierte Anomalie) */}
                        <Grid item xs={12} md={6} lg={4}>
                            <Paper sx={{ p: 2, bgcolor: isDark ? '#0a0a0a' : '#ffffff', height: '100%' }}>
                                <Typography variant="caption" sx={{ fontWeight: 'bold', color: isDark ? '#00e676' : '#00a152' }}>
                                    NACHT-UNRUHE
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                                    Ø {trendsData.night?.avg || 0} Events | {trendsData.night?.trend || 'N/A'}
                                    {trendsData.night?.last_night_normal !== undefined && (
                                        <span style={{ color: trendsData.night.last_night_normal ? '#28a745' : '#fd7e14', marginLeft: 6 }}>
                                            · Letzte Nacht: {trendsData.night.last_night_normal ? 'normal' : 'ungewöhnlich'}
                                        </span>
                                    )}
                                </Typography>
                                <ResponsiveContainer width="100%" height={150}>
                                    <BarChart data={trendsData.night?.timeline?.map((d: string, i: number) => ({ date: d.substring(5), value: trendsData.night.values[i] })) || []}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                        <XAxis dataKey="date" stroke={lineColor} style={{ fontSize: '0.6rem' }} />
                                        <YAxis stroke={lineColor} style={{ fontSize: '0.6rem' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="value" fill="#fd7e14" name="Events" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Paper>
                        </Grid>

                        {/* 3. Raum-Mobilität */}
                        <Grid item xs={12} md={6} lg={4}>
                            <Paper sx={{ p: 2, bgcolor: isDark ? '#0a0a0a' : '#ffffff', height: '100%' }}>
                                <Typography variant="caption" sx={{ fontWeight: 'bold', color: isDark ? '#00e676' : '#00a152' }}>
                                    RAUM-MOBILITÄT
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', color: trendsData.mobility?.trend === 'IMMOBIL' ? 'error.main' : 'text.secondary' }}>
                                    Ø {trendsData.mobility?.avg || 0} Räume | {trendsData.mobility?.trend || 'N/A'}
                                </Typography>
                                <ResponsiveContainer width="100%" height={150}>
                                    <AreaChart data={trendsData.mobility?.timeline?.map((d: string, i: number) => ({ date: d.substring(5), value: trendsData.mobility.values[i] })) || []}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                        <XAxis dataKey="date" stroke={lineColor} style={{ fontSize: '0.6rem' }} />
                                        <YAxis stroke={lineColor} style={{ fontSize: '0.6rem' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="value" stroke="#00bcd4" fill="#00bcd4" fillOpacity={0.3} name="Räume" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </Paper>
                        </Grid>

                        {/* 4. Hygiene-Frequenz */}
                        <Grid item xs={12} md={6} lg={4}>
                            <Paper sx={{ p: 2, bgcolor: isDark ? '#0a0a0a' : '#ffffff', height: '100%' }}>
                                <Typography variant="caption" sx={{ fontWeight: 'bold', color: isDark ? '#00e676' : '#00a152' }}>
                                    BAD-NUTZUNG
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                                    Ø {trendsData.hygiene?.avg || 0} Besuche | {trendsData.hygiene?.trend || 'N/A'}
                                </Typography>
                                <ResponsiveContainer width="100%" height={150}>
                                    <LineChart data={trendsData.hygiene?.timeline?.map((d: string, i: number) => ({ date: d.substring(5), value: trendsData.hygiene.values[i] })) || []}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                        <XAxis dataKey="date" stroke={lineColor} style={{ fontSize: '0.6rem' }} />
                                        <YAxis stroke={lineColor} style={{ fontSize: '0.6rem' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Line type="monotone" dataKey="value" stroke="#9c27b0" strokeWidth={2} dot={false} name="Besuche" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Paper>
                        </Grid>

                        {/* 5. Lüftungsverhalten */}
                        <Grid item xs={12} md={6} lg={4}>
                            <Paper sx={{ p: 2, bgcolor: isDark ? '#0a0a0a' : '#ffffff', height: '100%' }}>
                                <Typography variant="caption" sx={{ fontWeight: 'bold', color: isDark ? '#00e676' : '#00a152' }}>
                                    FRISCHLUFT
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                                    Ø {trendsData.ventilation?.avg || 0} Öffnungen | {trendsData.ventilation?.trend || 'N/A'}
                                </Typography>
                                <ResponsiveContainer width="100%" height={150}>
                                    <BarChart data={trendsData.ventilation?.timeline?.map((d: string, i: number) => ({ date: d.substring(5), value: trendsData.ventilation.values[i] })) || []}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                        <XAxis dataKey="date" stroke={lineColor} style={{ fontSize: '0.6rem' }} />
                                        <YAxis stroke={lineColor} style={{ fontSize: '0.6rem' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="value" fill="#03a9f4" name="Öffnungen" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Paper>
                        </Grid>

                        {/* 6. 🔬 DRIFT-MONITOR (Beobachtungsphase) */}
                        <Grid item xs={12} md={6} lg={4}>
                            <Paper sx={{ p: 2, bgcolor: isDark ? '#0a0a0a' : '#ffffff', height: '100%', border: `1px dashed ${isDark ? '#444' : '#ccc'}` }}>
                                <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#ff9800' }}>
                                    🔬 DRIFT-MONITOR
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', color: '#ff9800', fontSize: '0.6rem', mb: 0.5 }}>
                                    Beobachtungsphase — noch nicht validiert
                                </Typography>
                                {trendsData?.drift ? (
                                    <>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                            <Box sx={{
                                                width: 10, height: 10, borderRadius: '50%',
                                                bgcolor: trendsData.drift.drift_detected ? '#dc3545' : (trendsData.drift.current_score > trendsData.drift.threshold * 0.5 ? '#fd7e14' : '#28a745')
                                            }} />
                                            <Typography variant="caption" sx={{ fontWeight: 'bold', color: trendsData.drift.drift_detected ? 'error.main' : (trendsData.drift.current_score > trendsData.drift.threshold * 0.5 ? '#fd7e14' : '#28a745') }}>
                                                {trendsData.drift.drift_detected ? '⚠️ Drift erkannt' : (trendsData.drift.current_score > trendsData.drift.threshold * 0.5 ? 'Möglicher Drift' : 'Kein Drift')}
                                            </Typography>
                                        </Box>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                                            PH-Score: {trendsData.drift.current_score?.toFixed(1)} / Schwelle: {trendsData.drift.threshold}
                                        </Typography>
                                        <ResponsiveContainer width="100%" height={100}>
                                            <LineChart data={trendsData.drift.scores?.map((v: number, i: number) => ({ i: i + 1, score: Math.round(v) })) || []}>
                                                <XAxis dataKey="i" stroke={lineColor} style={{ fontSize: '0.55rem' }} />
                                                <YAxis stroke={lineColor} style={{ fontSize: '0.55rem' }} />
                                                <Tooltip formatter={(v: any) => [`${v}`, 'PH-Score']} />
                                                <ReferenceLine y={trendsData.drift.threshold} stroke="#dc3545" strokeDasharray="3 3" />
                                                <Line type="monotone" dataKey="score" stroke="#ff9800" strokeWidth={1.5} dot={false} name="Drift-Score" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>
                                            Anstieg = Verhaltensmuster ändert sich. Rote Linie = Alarm-Schwelle.
                                        </Typography>
                                    </>
                                ) : (
                                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 2, textAlign: 'center' }}>
                                        Drift-Analyse läuft nach Backend-Call…<br />
                                        (min. 10 Tage Daten nötig)
                                    </Typography>
                                )}
                            </Paper>
                        </Grid>
                    </Grid>
                </>
            )}
        </Box>
    );
}
