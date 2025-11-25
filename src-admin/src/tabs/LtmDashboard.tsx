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
    Button,
    Card,
    CardContent,
    CardActions,
    Divider,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    TextField,
    DialogActions
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
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import RateReviewIcon from '@mui/icons-material/RateReview';

interface LtmDashboardProps {
    socket: Connection;
    adapterName: string;
    instance: number;
    themeType: string;
}

interface DailyDigest {
    timestamp: string;
    eventCount: number;
    summary: string;
    activityLevel: string;
    systemMode?: string;
}

interface AnalysisHistoryItem {
    timestamp: number;
    id: string;
    analysis: {
        activity: {
            summary: string;
            isAlert: boolean;
            alertReason?: string;
            deviationFromBaseline?: string;
        };
        comfort?: {
            automationProposal?: {
                patternDetected: boolean;
                description: string;
            }
        }
    };
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
    analysisHistory: AnalysisHistoryItem[]; // STM Data
    driftAnalysis: DriftAnalysisStatus | null;

    // Feedback Dialog State
    feedbackOpen: boolean;
    feedbackItem: AnalysisHistoryItem | null;
    feedbackComment: string;
}

const ACTIVITY_LEVEL_MAP: Record<string, number> = {
    'sehr niedrig': 1, 'niedrig': 2, 'normal': 3, 'hoch': 4, 'sehr hoch': 5,
};

const ACTIVITY_COLOR_MAP: Record<number, string> = {
    1: '#90caf9', 2: '#64b5f6', 3: '#4caf50', 4: '#ffb300', 5: '#f44336',
};

export default class LtmDashboard extends React.Component<LtmDashboardProps, LtmDashboardState> {
    constructor(props: LtmDashboardProps) {
        super(props);
        this.state = {
            loading: true,
            error: null,
            isPro: false,
            dailyDigests: [],
            analysisHistory: [],
            driftAnalysis: null,
            feedbackOpen: false,
            feedbackItem: null,
            feedbackComment: ''
        };
    }

    componentDidMount() {
        this.fetchLtmData();
    }

    fetchLtmData = () => {
        this.setState({ loading: true, error: null });

        this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'getLtmData', {})
            .then((response: any) => {
                if (response && response.isPro === false) {
                    this.setState({ loading: false, isPro: false, error: I18n.t('ltm_pro_feature_required') });
                    return;
                }
                if (response && response.success) {
                    this.setState({
                        loading: false,
                        isPro: true,
                        dailyDigests: response.dailyDigests || [],
                        analysisHistory: response.analysisHistory || [],
                        driftAnalysis: response.driftAnalysis || null,
                        error: null
                    });
                } else {
                    this.setState({ loading: false, error: response ? response.message : 'Unknown Error', isPro: true });
                }
            })
            .catch((error: Error) => {
                this.setState({ loading: false, error: error.message });
            });
    }

    // --- FEEDBACK HANDLERS ---

    handleFeedbackClick = (item: AnalysisHistoryItem, isPositive: boolean) => {
        if (isPositive) {
            // Direktes positives Feedback senden
            this.sendFeedback(item.id, 'correct', '', item.analysis.activity.alertReason);
        } else {
            // Dialog öffnen für negatives Feedback
            this.setState({ feedbackOpen: true, feedbackItem: item, feedbackComment: '' });
        }
    }

    submitNegativeFeedback = () => {
        const { feedbackItem, feedbackComment } = this.state;
        if (feedbackItem) {
            this.sendFeedback(feedbackItem.id, 'false_positive', feedbackComment, feedbackItem.analysis.activity.alertReason);
        }
        this.setState({ feedbackOpen: false, feedbackItem: null });
    }

    sendFeedback(historyId: string, rating: string, comment: string, alertReason?: string) {
        this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'submitFeedback', {
            historyId, rating, comment, alertReason
        }).then(() => {
            // Optional: Snackbar anzeigen
            console.log("Feedback sent");
        });
    }

    // --- RENDERERS ---

    renderFeedbackDialog() {
        return (
            <Dialog open={this.state.feedbackOpen} onClose={() => this.setState({ feedbackOpen: false })}>
                <DialogTitle>KI-Feedback: Fehlalarm melden</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        Helfen Sie der KI zu lernen. Warum war diese Analyse falsch?
                    </Typography>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Begründung (z.B. 'Ich habe nur gelüftet')"
                        fullWidth
                        variant="outlined"
                        value={this.state.feedbackComment}
                        onChange={(e) => this.setState({ feedbackComment: e.target.value })}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => this.setState({ feedbackOpen: false })}>Abbrechen</Button>
                    <Button onClick={this.submitNegativeFeedback} variant="contained" color="primary">Absenden</Button>
                </DialogActions>
            </Dialog>
        );
    }

    renderStmHistory() {
        // Zeige nur die neuesten 3 Events
        const items = this.state.analysisHistory.slice(0, 3);
        if (items.length === 0) return <Alert severity="info">Keine aktuellen Analysen vorhanden.</Alert>;

        return (
            <Grid container spacing={2}>
                {items.map((item) => {
                    const isAlert = item.analysis.activity.isAlert;
                    const dateStr = new Date(item.timestamp).toLocaleTimeString();

                    return (
                        <Grid item xs={12} md={4} key={item.id}>
                            <Card variant="outlined" sx={{ borderColor: isAlert ? 'error.main' : 'divider' }}>
                                <CardContent sx={{ pb: 1 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="caption" color="text.secondary">{dateStr}</Typography>
                                        {isAlert && <Chip label="ALARM" color="error" size="small" icon={<WarningIcon />} />}
                                    </Box>
                                    <Typography variant="body2" sx={{ fontWeight: 'bold', minHeight: '40px' }}>
                                        {isAlert ? item.analysis.activity.alertReason : item.analysis.activity.summary}
                                    </Typography>
                                    {item.analysis.comfort?.automationProposal?.patternDetected && (
                                        <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 1 }}>
                                            💡 Muster erkannt: {item.analysis.comfort.automationProposal.description}
                                        </Typography>
                                    )}
                                </CardContent>
                                <Divider />
                                <CardActions disableSpacing sx={{ justifyContent: 'flex-end', pt: 0, pb: 0 }}>
                                    <Typography variant="caption" sx={{ mr: 1 }}>War das korrekt?</Typography>
                                    <Tooltip title="Ja, gute Analyse">
                                        <IconButton size="small" color="success" onClick={() => this.handleFeedbackClick(item, true)}>
                                            <ThumbUpIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Nein, Fehler melden">
                                        <IconButton size="small" color="error" onClick={() => this.handleFeedbackClick(item, false)}>
                                            <ThumbDownIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </CardActions>
                            </Card>
                        </Grid>
                    );
                })}
            </Grid>
        );
    }

    renderChart() {
        const { dailyDigests } = this.state;
        const chartData = dailyDigests.map(d => ({
            date: new Date(d.timestamp).toLocaleDateString(),
            activityValue: ACTIVITY_LEVEL_MAP[d.activityLevel] || 0,
            eventCount: d.eventCount,
            summary: d.summary,
            activityLevel: d.activityLevel,
            systemMode: d.systemMode,
            fillColor: ACTIVITY_COLOR_MAP[ACTIVITY_LEVEL_MAP[d.activityLevel] || 0] || '#8884d8',
        })); // .reverse() removed for vertical layout

        return (
            <ResponsiveContainer width="100%" height={Math.max(300, dailyDigests.length * 50)}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 5]} hide />
                    <YAxis dataKey="date" type="category" width={80} style={{ fontSize: '0.8rem' }} />
                    <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                                <Paper sx={{ p: 1, maxWidth: 300, fontSize: '0.8rem' }}>
                                    <strong>{data.date}</strong><br/>
                                    Level: {data.activityLevel}<br/>
                                    Events: {data.eventCount}<br/>
                                    <div style={{marginTop: 5, fontStyle: 'italic'}}>"{data.summary}"</div>
                                </Paper>
                            );
                        }
                        return null;
                    }}/>
                    <Bar dataKey="activityValue" radius={[0, 4, 4, 0]} barSize={20}>
                        {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fillColor} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        );
    }

    render() {
        const { loading, error, isPro } = this.state;

        if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
        if (error) return <Alert severity={!isPro ? "warning" : "error"}>{error}</Alert>;

        return (
            <Box sx={{ p: 3 }}>
                {this.renderFeedbackDialog()}

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                    <Button startIcon={<RefreshIcon />} onClick={this.fetchLtmData} variant="outlined" size="small">Refresh</Button>
                </Box>

                <Grid container spacing={3}>
                    {/* SEKTION 1: STM & FEEDBACK (Sprint 24) */}
                    <Grid item xs={12}>
                        <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <RateReviewIcon color="primary" /> Aktuelle Analysen & Feedback
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            {this.renderStmHistory()}
                        </Paper>
                    </Grid>

                    {/* SEKTION 2: DRIFT */}
                    <Grid item xs={12}>
                        <Paper sx={{ p: 2, borderLeft: '6px solid #1976d2' }}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TrendingUpIcon color="primary" /> Baseline Drift Analyse
                            </Typography>
                            {this.state.driftAnalysis?.status ? (
                                <Alert severity={this.state.driftAnalysis.status === 'critical' ? 'error' : 'info'}>
                                    Status: <strong>{this.state.driftAnalysis.status.toUpperCase()}</strong> — {this.state.driftAnalysis.details}
                                </Alert>
                            ) : <Typography variant="body2" color="text.secondary">Noch nicht verfügbar.</Typography>}
                        </Paper>
                    </Grid>

                    {/* SEKTION 3: LTM CHART */}
                    <Grid item xs={12}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <HistoryIcon color="primary" /> Langzeit-Historie
                            </Typography>
                            <Box sx={{ mt: 2 }}>{this.renderChart()}</Box>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>
        );
    }
}