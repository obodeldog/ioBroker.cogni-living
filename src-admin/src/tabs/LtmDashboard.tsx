import React from 'react';
import {
    Box,
    Typography,
    CircularProgress,
    Alert,
    Paper,
    Grid,
    Chip,
    Tooltip,
    Button
} from '@mui/material';
import { I18n } from '@iobroker/adapter-react-v5';
import type { Connection } from '@iobroker/socket-client';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Cell,
} from 'recharts';

// Icons
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import HistoryIcon from '@mui/icons-material/History';
import InfoIcon from '@mui/icons-material/Info';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningIcon from '@mui/icons-material/Warning';

interface LtmDashboardProps {
    socket: Connection;
    adapterName: string;
    instance: number;
    themeType: string;
}

// Datenstruktur der Daily Digests
interface DailyDigest {
    timestamp: string;
    eventCount: number;
    summary: string;
    activityLevel: string;
    systemMode?: string;
}

interface DriftAnalysisStatus {
    status: string;
    details: string;
    lastCheck: number;
}

interface LtmDashboardState {
    loading: boolean;
    error: string | null;
    isPro: boolean;
    dailyDigests: DailyDigest[];
    driftAnalysis: DriftAnalysisStatus | null;
}

// Mapping von Aktivitätslevel zu numerischen Werten für das Chart
const ACTIVITY_LEVEL_MAP: Record<string, number> = {
    'sehr niedrig': 1,
    'niedrig': 2,
    'normal': 3,
    'hoch': 4,
    'sehr hoch': 5,
};

// Mapping von numerischen Werten zu Farben
const ACTIVITY_COLOR_MAP: Record<number, string> = {
    1: '#90caf9', // Hellblau (Sehr niedrig)
    2: '#64b5f6', // Blau (Niedrig)
    3: '#4caf50', // Grün (Normal)
    4: '#ffb300', // Bernstein (Hoch)
    5: '#f44336', // Rot (Sehr hoch)
};

export default class LtmDashboard extends React.Component<LtmDashboardProps, LtmDashboardState> {
    constructor(props: LtmDashboardProps) {
        super(props);
        this.state = {
            loading: true,
            error: null,
            isPro: false,
            dailyDigests: [],
            driftAnalysis: null,
        };
    }

    componentDidMount() {
        this.fetchLtmData();
    }

    fetchLtmData = () => {
        this.setState({ loading: true, error: null });

        // Timeout Promise: Wirft Fehler nach 5 Sekunden
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Timeout: Adapter antwortet nicht. Ist die Instanz gestartet?'));
            }, 5000);
        });

        // Backend Request
        const requestPromise = this.props.socket.sendTo(
            `${this.props.adapterName}.${this.props.instance}`,
            'getLtmData',
            {}
        );

        // Race: Wer zuerst fertig ist, gewinnt. Verhindert endlosen Spinner.
        Promise.race([requestPromise, timeoutPromise])
            .then((response: any) => {
                // Check ob Pro-Check im Backend fehlgeschlagen ist
                if (response && response.isPro === false) {
                    this.setState({
                        loading: false,
                        isPro: false,
                        error: I18n.t('ltm_pro_feature_required'),
                    });
                    return;
                }

                if (response && response.success) {
                    this.setState({
                        loading: false,
                        isPro: true,
                        dailyDigests: response.dailyDigests || [],
                        driftAnalysis: response.driftAnalysis || null,
                        error: null
                    });
                } else {
                    this.setState({
                        loading: false,
                        error: response ? response.message : I18n.t('ltm_fetch_error_unknown'),
                        isPro: true, // Annahme: Pro ist aktiv, aber Fehler beim Datenholen
                    });
                }
            })
            .catch((error: Error) => {
                console.error("LTM Fetch Error:", error);
                this.setState({
                    loading: false,
                    error: `${I18n.t('ltm_fetch_error_connection')}: ${error.message}`,
                });
            });
    }

    prepareChartData() {
        return this.state.dailyDigests.map(digest => {
            const date = new Date(digest.timestamp).toLocaleDateString();
            const activityValue = ACTIVITY_LEVEL_MAP[digest.activityLevel] || 0;
            return {
                date,
                activityValue,
                eventCount: digest.eventCount,
                summary: digest.summary,
                activityLevel: digest.activityLevel,
                systemMode: digest.systemMode,
                fillColor: ACTIVITY_COLOR_MAP[activityValue] || '#8884d8',
            };
        }); // .reverse() entfernen wir hier, da das Chart layout="vertical" nutzt und die Reihenfolge oft andersherum besser liest
    }

    renderChartTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <Paper sx={{ p: 1, maxWidth: 300, fontSize: '0.8rem', border: '1px solid #ccc' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{data.date}</Typography>
                    <Typography variant="body2">
                        {I18n.t('ltm_activity_level')}: <strong>{data.activityLevel}</strong>
                    </Typography>
                    <Typography variant="body2">
                        {I18n.t('ltm_event_count')}: {data.eventCount}
                    </Typography>
                    {data.systemMode && data.systemMode !== 'normal' && (
                        <Typography variant="body2" color="error">
                            {I18n.t('ltm_system_mode')}: {data.systemMode}
                        </Typography>
                    )}
                    <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', borderTop: '1px solid #eee', paddingTop: 0.5 }}>
                        "{data.summary}"
                    </Typography>
                </Paper>
            );
        }
        return null;
    };

    renderDriftStatus() {
        const { driftAnalysis } = this.state;

        // Zeige Status nicht an, wenn er N/A oder null ist
        if (!driftAnalysis || !driftAnalysis.status || driftAnalysis.status.startsWith('N/A')) {
            return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                    <InfoIcon color="disabled" />
                    <Typography variant="body2">{I18n.t('ltm_drift_status_unavailable')}</Typography>
                </Box>
            );
        }

        let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
        let icon = <InfoIcon />;

        switch (driftAnalysis.status) {
            case 'none':
                color = 'success';
                break;
            case 'slight':
                color = 'info';
                break;
            case 'significant':
                color = 'warning';
                icon = <TrendingUpIcon />;
                break;
            case 'critical':
                color = 'error';
                icon = <WarningIcon />;
                break;
        }

        const lastCheckTime = driftAnalysis.lastCheck ? new Date(driftAnalysis.lastCheck).toLocaleString() : 'N/A';

        return (
            <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight="bold">{I18n.t('ltm_baseline_drift_status')}:</Typography>
                    <Chip
                        icon={icon}
                        label={I18n.t(`drift_${driftAnalysis.status}`) || driftAnalysis.status}
                        color={color}
                        variant={color === 'default' ? 'outlined' : 'filled'}
                    />
                </Box>
                <Alert severity={color === 'default' ? 'info' : color} sx={{ mb: 1 }}>
                    {driftAnalysis.details}
                </Alert>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', textAlign: 'right' }}>
                    {I18n.t('ltm_last_check')}: {lastCheckTime}
                </Typography>
            </Box>
        );
    }

    render() {
        const { loading, error, isPro, dailyDigests } = this.state;

        // Loading State
        if (loading) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', flexDirection: 'column', gap: 2 }}>
                    <CircularProgress />
                    <Typography>{I18n.t('ltm_loading_data')}</Typography>
                </Box>
            );
        }

        // Error / Pro Check Fail State
        if (error) {
            const isLicenseError = !isPro;
            return (
                <Box sx={{ p: 3 }}>
                    <Alert
                        severity={isLicenseError ? "warning" : "error"}
                        action={
                            <Button color="inherit" size="small" onClick={this.fetchLtmData} startIcon={<RefreshIcon />}>
                                REFRESH
                            </Button>
                        }
                    >
                        {isLicenseError && <Typography variant="h6" gutterBottom>{I18n.t('ltm_pro_feature_title')}</Typography>}
                        {error}
                    </Alert>
                </Box>
            );
        }

        // Empty Data State
        if (dailyDigests.length === 0) {
            return (
                <Box sx={{ p: 3 }}>
                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <Alert severity="info" action={
                                <Button color="inherit" size="small" onClick={this.fetchLtmData}>
                                    Check Again
                                </Button>
                            }>
                                {I18n.t('ltm_no_data_available')}
                            </Alert>
                        </Grid>
                    </Grid>
                </Box>
            );
        }

        // --- MAIN DASHBOARD RENDER ---
        const chartData = this.prepareChartData();
        // Dynamische Höhe: Mindestens 300px, sonst wächst es mit den Daten (30px pro Balken)
        const chartHeight = Math.max(300, dailyDigests.length * 50);

        return (
            <Box sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                    <Button startIcon={<RefreshIcon />} onClick={this.fetchLtmData} variant="outlined" size="small">
                        Refresh Data
                    </Button>
                </Box>

                <Grid container spacing={3}>
                    {/* Sektion: Baseline Drift Analyse */}
                    <Grid item xs={12}>
                        <Paper sx={{ p: 2, borderLeft: '6px solid #1976d2' }}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TrendingUpIcon color="primary" />
                                {I18n.t('ltm_baseline_drift_analysis')}
                            </Typography>
                            {this.renderDriftStatus()}
                        </Paper>
                    </Grid>

                    {/* Sektion: Aktivitätsverlauf Chart */}
                    <Grid item xs={12}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <HistoryIcon color="primary" />
                                {I18n.t('ltm_activity_history')} ({dailyDigests.length} {I18n.t('ltm_days')})
                            </Typography>

                            <Box sx={{ mt: 3, mb: 2, height: chartHeight }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={chartData}
                                        layout="vertical"
                                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} hide />
                                        <YAxis dataKey="date" type="category" width={80} style={{ fontSize: '0.8rem' }} />
                                        <RechartsTooltip content={this.renderChartTooltip} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />

                                        <Bar dataKey="activityValue" name={I18n.t('ltm_activity_level') || 'Activity'} radius={[0, 4, 4, 0]} barSize={20}>
                                            {
                                                chartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fillColor} />
                                                ))
                                            }
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>

                            <Tooltip title={I18n.t('ltm_chart_legend_tooltip') || ''}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, cursor: 'help' }}>
                                    <InfoIcon fontSize="small" color="action"/>
                                    <Typography variant="caption" color="textSecondary">
                                        {I18n.t('ltm_chart_legend_info')}
                                    </Typography>
                                </Box>
                            </Tooltip>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>
        );
    }
}