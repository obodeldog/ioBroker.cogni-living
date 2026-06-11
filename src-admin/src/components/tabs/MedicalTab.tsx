import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Grid, Card, CardContent, Chip, Divider, LinearProgress,
    Tooltip, Alert, AlertTitle, Paper, Badge, IconButton, Collapse,
    List, ListItem, ListItemIcon, ListItemText, FormControlLabel, Switch,
    Dialog, DialogTitle, DialogContent, DialogActions, Button
} from '@mui/material';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SensorsIcon from '@mui/icons-material/Sensors';
import SensorsOffIcon from '@mui/icons-material/SensorsOff';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ElderlyIcon from '@mui/icons-material/Elderly';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import PersonIcon from '@mui/icons-material/Person';
import GroupsIcon from '@mui/icons-material/Groups';
import WarningIcon from '@mui/icons-material/Warning';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import BiotechIcon from '@mui/icons-material/Biotech';
import TroubleshootIcon from '@mui/icons-material/Troubleshoot';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import ScienceIcon from '@mui/icons-material/Science';

import {
    DISEASE_PROFILES,
    PROFILE_BY_ID,
    validateAllProfiles,
    type DiseaseProfile,
    type ValidationResult,
    type DeviceConfig
} from '../medical/diseaseProfiles';

interface MedicalTabProps {
    socket: any;
    adapterName: string;
    instance: number;
    theme: any;
    themeType: string;
    native: Record<string, any>;
    onChange: (attr: string, value: any) => void;
}

const TARGET_GROUP_LABELS: Record<string, string> = {
    senior: 'Senioren',
    adult:  'Erwachsene',
    child:  'Kinder & Jugendliche',
    all:    'Alle Altersgruppen'
};
const TARGET_GROUP_ICONS: Record<string, React.ReactElement> = {
    senior: <ElderlyIcon fontSize="small" />,
    adult:  <PersonIcon fontSize="small" />,
    child:  <ChildCareIcon fontSize="small" />,
    all:    <GroupsIcon fontSize="small" />
};
const FEASIBILITY_LABELS: Record<string, string> = {
    good:      'Sehr gut',
    partial:   'Eingeschraenkt',
    difficult: 'Schwierig',
    na:        'N/A (Einperson)'
};
const FEASIBILITY_COLORS: Record<string, string> = {
    good:      '#4caf50',
    partial:   '#ff9800',
    difficult: '#f44336',
    na:        '#9e9e9e'
};

// --- Readiness-Ampel-Badge ----------------------------------------------------
function ReadinessBadge({ level, percent }: { level: ValidationResult['readinessLevel']; percent: number }) {
    if (level === 'green')       return <Chip size="small" icon={<CheckCircleIcon />} label={`${percent}%`} sx={{ bgcolor: '#1b5e2022', color: '#4caf50', fontWeight: 'bold', border: '1px solid #4caf50' }} />;
    if (level === 'yellow')      return <Chip size="small" icon={<WarningAmberIcon />} label={`${percent}%`} sx={{ bgcolor: '#f57f1722', color: '#ff9800', fontWeight: 'bold', border: '1px solid #ff9800' }} />;
    if (level === 'red')         return <Chip size="small" icon={<CancelIcon />} label={`${percent}%`} sx={{ bgcolor: '#b71c1c22', color: '#f44336', fontWeight: 'bold', border: '1px solid #f44336' }} />;
    return <Chip size="small" icon={<InfoOutlinedIcon />} label="--" sx={{ opacity: 0.5 }} />;
}

// --- Sensor-Validierungsdialog ------------------------------------------------
function SensorValidationDialog({ open, onClose, profile, validation, isDark }: {
    open: boolean; onClose: () => void;
    profile: DiseaseProfile; validation: ValidationResult; isDark: boolean;
}) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SensorsIcon sx={{ color: profile.color }} />
                Sensor-Anforderungen: {profile.label}
            </DialogTitle>
            <DialogContent dividers>
                <Box sx={{ mb: 2 }}>
                    <LinearProgress
                        variant="determinate"
                        value={validation.readinessPercent}
                        sx={{ height: 10, borderRadius: 5, bgcolor: isDark ? '#333' : '#eee',
                            '& .MuiLinearProgress-bar': { bgcolor: validation.readinessLevel === 'green' ? '#4caf50' : validation.readinessLevel === 'yellow' ? '#ff9800' : '#f44336' }
                        }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        Bereitschaft: {validation.readinessPercent}%
                    </Typography>
                </Box>

                {/* Vorhandene Pflicht-Sensoren */}
                {validation.presentRequired.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ color: '#4caf50', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CheckCircleIcon fontSize="small" /> Vorhandene Pflicht-Sensoren ({validation.presentRequired.length}/{profile.requiredSensors.length})
                        </Typography>
                        <List dense disablePadding>
                            {validation.presentRequired.map(s => (
                                <ListItem key={s.key} disablePadding sx={{ py: 0.3 }}>
                                    <ListItemIcon sx={{ minWidth: 28 }}><CheckCircleIcon fontSize="small" sx={{ color: '#4caf50' }} /></ListItemIcon>
                                    <ListItemText primary={s.label} secondary={s.description} primaryTypographyProps={{ variant: 'body2' }} secondaryTypographyProps={{ variant: 'caption' }} />
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                )}

                {/* Fehlende Pflicht-Sensoren */}
                {validation.missingRequired.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ color: '#f44336', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CancelIcon fontSize="small" /> Fehlende Pflicht-Sensoren ({validation.missingRequired.length})
                        </Typography>
                        <List dense disablePadding>
                            {validation.missingRequired.map(s => (
                                <ListItem key={s.key} disablePadding sx={{ py: 0.3 }}>
                                    <ListItemIcon sx={{ minWidth: 28 }}><CancelIcon fontSize="small" sx={{ color: '#f44336' }} /></ListItemIcon>
                                    <ListItemText
                                        primary={s.label}
                                        secondary={<><span style={{ color: '#bbb' }}>{s.description}</span><br /><span style={{ color: '#ff9800', fontStyle: 'italic' }}>Hinweis: {s.missingHint}</span></>}
                                        primaryTypographyProps={{ variant: 'body2', color: '#f44336' }}
                                        secondaryTypographyProps={{ variant: 'caption', component: 'span' as any }}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                )}

                <Divider sx={{ my: 1.5 }} />

                {/* Optionale Sensoren */}
                {profile.optionalSensors.length > 0 && (
                    <Box>
                        <Typography variant="subtitle2" sx={{ color: '#ff9800', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <WarningAmberIcon fontSize="small" /> Optionale Sensoren (verbessern Erkennung)
                        </Typography>
                        <List dense disablePadding>
                            {profile.optionalSensors.map(s => {
                                const present = validation.presentOptional.some(p => p.key === s.key);
                                return (
                                    <ListItem key={s.key} disablePadding sx={{ py: 0.3 }}>
                                        <ListItemIcon sx={{ minWidth: 28 }}>
                                            {present
                                                ? <CheckCircleIcon fontSize="small" sx={{ color: '#4caf50' }} />
                                                : <InfoOutlinedIcon fontSize="small" sx={{ color: '#9e9e9e' }} />}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={s.label}
                                            secondary={present ? s.description : `${s.description} � ${s.missingHint}`}
                                            primaryTypographyProps={{ variant: 'body2', color: present ? 'text.primary' : 'text.secondary' }}
                                            secondaryTypographyProps={{ variant: 'caption' }}
                                        />
                                    </ListItem>
                                );
                            })}
                        </List>
                    </Box>
                )}

                {profile.needsFP2 && (
                    <Alert severity="info" sx={{ mt: 2 }} icon={<SensorsIcon />}>
                        <AlertTitle>Empfehlung: Aqara FP2</AlertTitle>
                        Dieses Krankheitsbild profitiert besonders vom Aqara Presence Sensor FP2 (mmWave-Radar):
                        Sturzerkennung, Multi-Person-Tracking und Schlaf-Monitoring. ~70�/Sensor.
                    </Alert>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} variant="contained" size="small">Schliessen</Button>
            </DialogActions>
        </Dialog>
    );
}

// --- Disease-Karte in der Sidebar ---------------------------------------------
function DiseaseCard({ profile, enabled, validation, selected, onToggle, onSelect, isDark }: {
    profile: DiseaseProfile;
    enabled: boolean;
    validation: ValidationResult;
    selected: boolean;
    onToggle: (id: string, val: boolean) => void;
    onSelect: (id: string) => void;
    isDark: boolean;
}) {
    const [showSensors, setShowSensors] = useState(false);

    return (
        <>
            <Card
                onClick={() => onSelect(profile.id)}
                sx={{
                    mb: 1, cursor: 'pointer', transition: 'all 0.2s',
                    border: selected ? `2px solid ${profile.color}` : `1px solid ${isDark ? '#333' : '#ddd'}`,
                    bgcolor: selected ? (isDark ? `${profile.color}15` : `${profile.color}08`) : (isDark ? '#1e1e1e' : '#fff'),
                    '&:hover': { transform: 'translateX(2px)', borderColor: profile.color }
                }}
                elevation={selected ? 3 : 1}
            >
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: profile.color, flexShrink: 0 }} />
                        <Typography variant="body2" fontWeight={selected ? 'bold' : 'normal'} sx={{ flexGrow: 1, color: selected ? profile.color : 'text.primary' }}>
                            {profile.label}
                        </Typography>
                        <ReadinessBadge level={enabled ? validation.readinessLevel : 'unconfigured'} percent={validation.readinessPercent} />
                        <FormControlLabel
                            control={
                                <Switch
                                    size="small"
                                    checked={enabled}
                                    onChange={(e) => { e.stopPropagation(); onToggle(profile.id, e.target.checked); }}
                                    sx={{ '& .MuiSwitch-thumb': { bgcolor: enabled ? profile.color : undefined } }}
                                />
                            }
                            label=""
                            sx={{ m: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </Box>

                    {enabled && (
                        <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Tooltip title={FEASIBILITY_LABELS[profile.multiPersonFeasibility] + ' (Mehrpersonenhaushalt)'}>
                                <Chip size="small" icon={<GroupsIcon />} label={FEASIBILITY_LABELS[profile.multiPersonFeasibility]}
                                    sx={{ fontSize: '0.6rem', height: 18, bgcolor: `${FEASIBILITY_COLORS[profile.multiPersonFeasibility]}20`, color: FEASIBILITY_COLORS[profile.multiPersonFeasibility], border: `1px solid ${FEASIBILITY_COLORS[profile.multiPersonFeasibility]}40` }}
                                />
                            </Tooltip>
                            <IconButton size="small" sx={{ ml: 'auto', p: 0.3 }}
                                onClick={(e) => { e.stopPropagation(); setShowSensors(!showSensors); }}>
                                {showSensors ? <ExpandLessIcon fontSize="small" /> : <SensorsIcon fontSize="small" />}
                            </IconButton>
                        </Box>
                    )}
                </CardContent>
            </Card>
            <Collapse in={showSensors && enabled}>
                <Box sx={{ ml: 1, mb: 1, p: 1.5, bgcolor: isDark ? '#151515' : '#f9f9f9', borderRadius: 1, border: `1px solid ${isDark ? '#2a2a2a' : '#eee'}` }}>
                    {validation.missingRequired.length > 0 && (
                        <Alert severity="error" sx={{ mb: 1, py: 0 }}>
                            <strong>Fehlend ({validation.missingRequired.length}):</strong>{' '}
                            {validation.missingRequired.map(s => s.label).join(', ')}
                        </Alert>
                    )}
                    {validation.missingRequired.length === 0 && (
                        <Alert severity="success" sx={{ py: 0 }}>Alle Pflicht-Sensoren vorhanden!</Alert>
                    )}
                </Box>
            </Collapse>
        </>
    );
}

// --- Risiko-Score Typen -------------------------------------------------------
interface DiseaseScore {
    score: number | null;
    level: 'MINIMAL' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'INSUFFICIENT_DATA';
    factors?: Record<string, number>;
    values?: Record<string, number>;
    dataPoints?: number;
    calibrationDays?: number;
    message?: string;
}

const RISK_LEVEL_META: Record<string, { label: string; color: string; bg: string }> = {
    MINIMAL:           { label: 'Minimal',        color: '#4caf50', bg: '#4caf5018' },
    LOW:               { label: 'Niedrig',         color: '#8bc34a', bg: '#8bc34a18' },
    MODERATE:          { label: 'Moderat',         color: '#ff9800', bg: '#ff980018' },
    HIGH:              { label: 'Hoch',            color: '#f44336', bg: '#f4433618' },
    CRITICAL:          { label: 'Kritisch',        color: '#9c27b0', bg: '#9c27b018' },
    INSUFFICIENT_DATA: { label: 'Zu wenig Daten',  color: '#9e9e9e', bg: '#9e9e9e18' },
};

const FACTOR_LABELS: Record<string, string> = {
    gaitSlowdown:         'Gangverlangsamung',
    nightRestlessness:    'Naecht. Unruhe',
    nightWandering:       'Naecht. Wandern',
    roomMobility:         'Raum-Mobilitaet',
    roomMobilityDecline:  'Raum-Rueckgang',
    activityDecline:      'Aktivitaetsrueckgang',
    activityDrift:        'Langzeit-Drift',
    hygieneDecline:       'Hygiene-Rueckgang',
};

// --- Risiko-Score Panel -------------------------------------------------------
function RiskScorePanel({ score, isDark }: { score: DiseaseScore; isDark: boolean }) {
    const meta = RISK_LEVEL_META[score.level] ?? RISK_LEVEL_META.INSUFFICIENT_DATA;

    if (score.level === 'INSUFFICIENT_DATA' || score.score === null) {
        return (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: isDark ? '#1a1a1a' : '#fafafa', borderColor: '#9e9e9e40' }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>📊 Risiko-Indikator</Typography>
                <Alert severity="info" sx={{ py: 0.5 }}>
                    {score.message ?? `Mindestens 5 Tage Daten benoetigt (${score.dataPoints ?? 0} vorhanden). Score wird automatisch nach der naechsten Analyse berechnet.`}
                </Alert>
            </Paper>
        );
    }

    return (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: meta.bg, borderColor: `${meta.color}50` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    📊 Risiko-Indikator
                    <Tooltip title={`Basierend auf ${score.dataPoints ?? '?'} Tagen. Kein Diagnose-System.`}>
                        <InfoOutlinedIcon fontSize="small" sx={{ color: '#9e9e9e', ml: 0.5 }} />
                    </Tooltip>
                </Typography>
                <Chip size="small" label={meta.label}
                    sx={{ bgcolor: meta.color, color: '#fff', fontWeight: 'bold', fontSize: '0.75rem' }} />
            </Box>
            <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">Auffaelligkeits-Score</Typography>
                    <Typography variant="body2" fontWeight="bold" sx={{ color: meta.color }}>{score.score.toFixed(1)} / 100</Typography>
                </Box>
                <LinearProgress variant="determinate" value={Math.min(score.score, 100)}
                    sx={{ height: 12, borderRadius: 6, bgcolor: isDark ? '#2a2a2a' : '#e0e0e0',
                        '& .MuiLinearProgress-bar': { bgcolor: meta.color, borderRadius: 6 } }} />
            </Box>
            {score.factors && Object.keys(score.factors).length > 0 && (
                <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Einzel-Indikatoren:</Typography>
                    <Grid container spacing={0.5}>
                        {Object.entries(score.factors).map(([key, val]) => (
                            <Grid item xs={6} key={key}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <LinearProgress variant="determinate" value={Math.min(val, 100)}
                                        sx={{ flexGrow: 1, height: 5, borderRadius: 3, bgcolor: isDark ? '#2a2a2a' : '#e0e0e0',
                                            '& .MuiLinearProgress-bar': { bgcolor: val < 25 ? '#4caf50' : val < 50 ? '#ff9800' : '#f44336', borderRadius: 3 } }} />
                                    <Typography variant="caption" sx={{ minWidth: 24, textAlign: 'right', color: 'text.secondary', fontSize: '0.65rem' }}>
                                        {val.toFixed(0)}
                                    </Typography>
                                </Box>
                                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                                    {FACTOR_LABELS[key] ?? key}
                                </Typography>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            )}
            <Typography variant="caption" color="text.secondary"
                sx={{ mt: 1, display: 'block', fontStyle: 'italic', fontSize: '0.65rem' }}>
                Kein Diagnose-System. Score zeigt Verhaltensveraenderungen gegenueber persoenlicher Baseline.
            </Typography>
        </Paper>
    );
}

// --- Disease Dashboard (rechtes Panel) ---------------------------------------
function DiseaseDashboard({ profile, validation, isDark, diseaseScore }: {
    profile: DiseaseProfile; validation: ValidationResult; isDark: boolean;
    diseaseScore?: DiseaseScore | null;
}) {
    const [dialogOpen, setDialogOpen] = useState(false);

    const METRIC_LABELS: Record<string, { label: string; icon: string }> = {
        gaitSpeed:           { label: 'Ganggeschwindigkeit', icon: '🚶' },
        nightRestlessness:   { label: 'Nacht-Unruhe', icon: '🌙' },
        roomSilence:         { label: 'Raum-Stille-Alarm', icon: '🔇' },
        activityLevel:       { label: 'Aktivitaets-Level', icon: '📊' },
        roomMobility:        { label: 'Raum-Mobilitaet', icon: '🏠' },
        activityDrift:       { label: 'Langzeit-Drift (PH-Test)', icon: '📉' },
        heatmap:             { label: 'Aktivitaets-Heatmap', icon: '🌡️' },
        hygieneFrequency:    { label: 'Hygiene-Frequenz', icon: '🚿' },
        ventilationBehavior: { label: 'Lueftungsverhalten', icon: '🌬️' }
    };

    return (
        <Box>
            {/* Header */}
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: `${profile.color}20`, border: `2px solid ${profile.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <LocalHospitalIcon sx={{ color: profile.color }} />
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="h5" fontWeight="bold">{profile.label}</Typography>
                        <ReadinessBadge level={validation.readinessLevel} percent={validation.readinessPercent} />
                        <Chip size="small" icon={TARGET_GROUP_ICONS[profile.targetGroup]} label={TARGET_GROUP_LABELS[profile.targetGroup]} variant="outlined" />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {profile.description}
                    </Typography>
                </Box>
            </Box>

            {/* Risiko-Score Panel (echte Daten aus Python) */}
            {diseaseScore && <RiskScorePanel score={diseaseScore} isDark={isDark} />}

            {/* Sensor-Status Banner */}
            {validation.missingRequired.length > 0 ? (
                <Alert severity="error" sx={{ mb: 2 }} action={
                    <Button color="inherit" size="small" startIcon={<SensorsIcon />} onClick={() => setDialogOpen(true)}>Details</Button>
                }>
                    <AlertTitle>Pflicht-Sensoren fehlen ({validation.missingRequired.length})</AlertTitle>
                    Dieses Monitoring ist eingeschraenkt aktiv. Folgende Sensoren werden benoetigt:{' '}
                    <strong>{validation.missingRequired.map(s => s.label).join(', ')}</strong>
                </Alert>
            ) : (
                <Alert severity="success" sx={{ mb: 2 }} action={
                    <Button color="inherit" size="small" startIcon={<SensorsIcon />} onClick={() => setDialogOpen(true)}>Details</Button>
                }>
                    <AlertTitle>Alle Pflicht-Sensoren vorhanden</AlertTitle>
                    {validation.missingOptional.length > 0
                        ? `${validation.missingOptional.length} optionale Sensor(en) koennen die Erkennung verbessern.`
                        : 'Das System ist vollstaendig konfiguriert.'}
                </Alert>
            )}

            {/* Sensor-Bereitschaft Progress */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: isDark ? '#1a1a1a' : '#fafafa' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2">Sensor-Bereitschaft</Typography>
                    <Typography variant="subtitle2" fontWeight="bold">{validation.readinessPercent}%</Typography>
                </Box>
                <LinearProgress
                    variant="determinate" value={validation.readinessPercent}
                    sx={{ height: 8, borderRadius: 4,
                        bgcolor: isDark ? '#333' : '#eee',
                        '& .MuiLinearProgress-bar': { bgcolor: validation.readinessLevel === 'green' ? '#4caf50' : validation.readinessLevel === 'yellow' ? '#ff9800' : '#f44336', borderRadius: 4 }
                    }}
                />
                <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                    <Chip size="small" icon={<CheckCircleIcon />} label={`${validation.presentRequired.length} Pflicht OK`} sx={{ bgcolor: '#4caf5020', color: '#4caf50', fontSize: '0.7rem' }} />
                    {validation.missingRequired.length > 0 && <Chip size="small" icon={<CancelIcon />} label={`${validation.missingRequired.length} Pflicht fehlt`} sx={{ bgcolor: '#f4433620', color: '#f44336', fontSize: '0.7rem' }} />}
                    {validation.presentOptional.length > 0 && <Chip size="small" icon={<CheckCircleIcon />} label={`${validation.presentOptional.length} Optional OK`} sx={{ bgcolor: '#ff980020', color: '#ff9800', fontSize: '0.7rem' }} />}
                    {validation.missingOptional.length > 0 && <Chip size="small" icon={<InfoOutlinedIcon />} label={`${validation.missingOptional.length} Optional fehlt`} sx={{ bgcolor: '#9e9e9e20', color: '#9e9e9e', fontSize: '0.7rem' }} />}
                </Box>
            </Paper>

            {/* Klinische Basis */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: isDark ? '#1a1a1a' : '#fafafa' }}>
                <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <InfoOutlinedIcon fontSize="small" color="info" /> Klinische Evidenz
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.8rem' }}>
                    {profile.clinicalBasis}
                </Typography>
            </Paper>

            {/* Relevante Metriken */}
            <Typography variant="subtitle2" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <MonitorHeartIcon fontSize="small" sx={{ color: profile.color }} />
                Ueberwachte Metriken ({profile.relevantMetrics.length})
            </Typography>
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
                {profile.relevantMetrics.map(metricKey => {
                    const m = METRIC_LABELS[metricKey];
                    if (!m) return null;
                    return (
                        <Grid item xs={6} sm={4} key={metricKey}>
                            <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', bgcolor: isDark ? '#1e1e1e' : '#fff', border: `1px solid ${profile.color}30`, '&:hover': { borderColor: profile.color, bgcolor: `${profile.color}08` }, transition: 'all 0.2s' }}>
                                <Typography variant="h6" sx={{ mb: 0.3 }}>{m.icon}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block' }}>{m.label}</Typography>
                                <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 'bold', fontSize: '0.65rem' }}>
                                    {'\u2192 Technisch: Gesundheit-Tab'}
                                </Typography>
                            </Paper>
                        </Grid>
                    );
                })}
            </Grid>

            {/* Mehrpersonen-Hinweis */}
            {(profile.multiPersonFeasibility === 'difficult' || profile.multiPersonFeasibility === 'na') && (
                <Alert severity="warning" sx={{ mb: 2 }} icon={<GroupsIcon />}>
                    <AlertTitle>Mehrpersonenhaushalt: {FEASIBILITY_LABELS[profile.multiPersonFeasibility]}</AlertTitle>
                    {profile.multiPersonFeasibility === 'na'
                        ? 'Dieses Krankheitsbild ist nur fuer Einpersonenhaushalte relevant.'
                        : 'Im Mehrpersonenhaushalt koennen die Bewegungsmuster anderer Personen die Erkennung beintraechtigen. Empfehlung: Aqara FP2 fuer Multi-Person-Tracking verwenden.'}
                    {profile.needsFP2 && !profile.multiPersonFeasibility.includes('good') && (
                        <Box sx={{ mt: 1 }}><strong>Aqara FP2 (mmWave-Radar)</strong> loest dieses Problem durch Multi-Person-Tracking. ~70�/Raum.</Box>
                    )}
                </Alert>
            )}

            {/* Markt-Scores */}
            <Paper variant="outlined" sx={{ p: 2, bgcolor: isDark ? '#1a1a1a' : '#fafafa' }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Relevanz & Marktpotenzial</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Einpersonenhaushalt</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress variant="determinate" value={profile.marketScore1P} sx={{ flexGrow: 1, height: 6, borderRadius: 3, bgcolor: isDark ? '#333' : '#eee', '& .MuiLinearProgress-bar': { bgcolor: '#4caf50' } }} />
                            <Typography variant="body2" fontWeight="bold">{profile.marketScore1P}</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Mehrpersonenhaushalt</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress variant="determinate" value={profile.marketScoreMP} sx={{ flexGrow: 1, height: 6, borderRadius: 3, bgcolor: isDark ? '#333' : '#eee', '& .MuiLinearProgress-bar': { bgcolor: '#2196f3' } }} />
                            <Typography variant="body2" fontWeight="bold">{profile.marketScoreMP}</Typography>
                        </Box>
                    </Grid>
                </Grid>
            </Paper>

            <SensorValidationDialog open={dialogOpen} onClose={() => setDialogOpen(false)} profile={profile} validation={validation} isDark={isDark} />
        </Box>
    );
}


// --- Screening Types ---------------------------------------------------------
interface ScreeningSignalDetail { value: number; threshold: number; active: boolean; }
interface ScreeningHint {
    disease: string;
    label: string;
    confidence: number;
    matchedSignals: string[];
    onset_speed: string;
    signalDetails: Record<string, ScreeningSignalDetail>;
}
interface ScreeningResult {
    hints: ScreeningHint[];
    metrics: Record<string, number>;
    dataPoints: number;
    screeningDate?: string;
    error?: string;
}

const SCREENING_SIGNAL_LABELS: Record<string, string> = {
    activityDecline:     'Aktivitaetsrueckgang',
    gaitSlowdown:        'Gangverlangsamung',
    nightExcess:         'Naecht. Unruhe',
    roomMobilityDecline: 'Raum-Mobilitaet',
    hygieneDecline:      'Hygiene-Rueckgang',
    ventilationDecline:  'Lueftung ruecklaeufig',
    ventilationIncrease: 'Lueftung erhoet',
    activityDrift:       'Langzeit-Drift',
};

function confidenceColor(c: number): string {
    if (c >= 0.7) return '#f44336';
    if (c >= 0.5) return '#ff9800';
    if (c >= 0.3) return '#ffc107';
    return '#4caf50';
}
function confidenceLabel(c: number): string {
    if (c >= 0.7) return 'Deutlich';
    if (c >= 0.5) return 'Auffaellig';
    if (c >= 0.3) return 'Leicht';
    return 'Gering';
}

// --- Screening Panel ---------------------------------------------------------
function ScreeningPanel({ result, isDark, enabledProfiles }: {
    result: ScreeningResult | null;
    isDark: boolean;
    enabledProfiles: string[];
}) {
    if (!result) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', minHeight: 300 }}>
                <BiotechIcon sx={{ fontSize: 56, color: '#9e9e9e', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>Noch keine Screening-Daten</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, textAlign: 'center' }}>
                    Das Screening wird automatisch nach der naechsten Gesundheitsanalyse berechnet (taeglich um 08:05 und 20:00 Uhr).
                </Typography>
            </Box>
        );
    }

    if (result.error) {
        return (
            <Alert severity="warning" sx={{ m: 2 }}>
                <AlertTitle>Screening nicht verfuegbar</AlertTitle>
                {result.error}
            </Alert>
        );
    }

    const hints = result.hints || [];
    const dateStr = result.screeningDate
        ? new Date(result.screeningDate).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';

    return (
        <Box>
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#7b1fa220', border: '2px solid #7b1fa2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <TroubleshootIcon sx={{ color: '#7b1fa2' }} />
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h5" fontWeight="bold">Proaktives Screening</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        AURA analysiert automatisch Bewegungsmuster und weist auf Auffaelligkeiten hin.
                        {dateStr && <> &mdash; Letztes Screening: <strong>{dateStr}</strong></>}
                    </Typography>
                </Box>
                <Chip size="small" label={result.dataPoints + ' Tage Basis'} variant="outlined" sx={{ flexShrink: 0 }} />
            </Box>

            <Alert severity="info" sx={{ mb: 3 }} icon={<InfoOutlinedIcon />}>
                <AlertTitle>Kein Diagnose-System</AlertTitle>
                AURA stellt <strong>keine medizinischen Diagnosen</strong>. Die folgenden Hinweise zeigen
                Verhaltensauffaelligkeiten, die bei bestimmten Erkrankungen typisch auftreten koennen.
                Sie ersetzen <strong>keinen Arztbesuch</strong>. Bei auffaelligen Ergebnissen empfehlen
                wir das Gespraech mit einem Arzt oder einer Aerztin.
            </Alert>

            {hints.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', bgcolor: isDark ? '#1a2a1a' : '#f1f8f1', borderColor: '#4caf5040' }}>
                    <CheckCircleIcon sx={{ fontSize: 48, color: '#4caf50', mb: 1 }} />
                    <Typography variant="h6" sx={{ color: '#4caf50', mb: 1 }}>Keine Auffaelligkeiten erkannt</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Alle gemessenen Verhaltensmuster liegen im persoenlichen Normbereich. Basis: {result.dataPoints} Tage.
                    </Typography>
                </Paper>
            ) : (
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <NotificationsActiveIcon sx={{ color: '#ff9800' }} />
                        <Typography variant="subtitle1" fontWeight="bold">
                            {hints.length} Auffaelligkeit{hints.length !== 1 ? 'en' : ''} erkannt
                        </Typography>
                        <Typography variant="caption" color="text.secondary">(Sortiert nach Staerke)</Typography>
                    </Box>

                    {hints.map((hint, idx) => {
                        const conf = hint.confidence;
                        const col = confidenceColor(conf);
                        const isEnabled = enabledProfiles.includes(hint.disease);
                        return (
                            <Paper key={hint.disease} variant="outlined" sx={{
                                mb: 2, p: 2.5,
                                bgcolor: isDark ? col + '08' : col + '05',
                                borderColor: col + '50',
                                borderLeft: '4px solid ' + col,
                            }}>
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                                    <Typography variant="subtitle1" fontWeight="bold" sx={{ flexGrow: 1 }}>
                                        {idx + 1}. {hint.label}
                                    </Typography>
                                    <Chip size="small" label={confidenceLabel(conf) + ' (' + Math.round(conf * 100) + '%)'}
                                        sx={{ bgcolor: col, color: '#fff', fontWeight: 'bold' }} />
                                    {isEnabled
                                        ? <Chip size="small" label="Ueberwachung aktiv" icon={<CheckCircleIcon />}
                                            sx={{ bgcolor: '#4caf5020', color: '#4caf50', border: '1px solid #4caf5040', fontSize: '0.7rem' }} />
                                        : <Chip size="small" label="Nicht aktiviert" icon={<InfoOutlinedIcon />}
                                            sx={{ bgcolor: '#9e9e9e20', color: '#9e9e9e', border: '1px solid #9e9e9e40', fontSize: '0.7rem' }} />
                                    }
                                </Box>

                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', mr: 0.5 }}>Aktive Signale:</Typography>
                                    {hint.matchedSignals.map(sig => (
                                        <Chip key={sig} size="small"
                                            label={(SCREENING_SIGNAL_LABELS[sig] || sig) + ': ' + (hint.signalDetails[sig]?.value?.toFixed(0) || '?') + '%'}
                                            sx={{ bgcolor: col + '15', color: col, border: '1px solid ' + col + '40', fontSize: '0.65rem', height: 20 }}
                                        />
                                    ))}
                                </Box>

                                <Box sx={{ p: 1.5, bgcolor: isDark ? '#ffffff08' : '#00000008', borderRadius: 1 }}>
                                    <Typography variant="caption" sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                                        <InfoOutlinedIcon fontSize="inherit" sx={{ mt: 0.2, flexShrink: 0, color: '#9e9e9e' }} />
                                        {isEnabled
                                            ? 'Die Ueberwachung fuer "' + hint.label + '" ist aktiv. Der Risiko-Score wird taeglich aktualisiert.'
                                            : 'Auffaelligkeiten erkannt, die bei "' + hint.label + '" typisch auftreten koennen. Bitte besprechen Sie diese Beobachtungen mit Ihrem Arzt. Sie koennen dieses Profil links aktivieren fuer detailliertere Auswertungen.'
                                        }
                                    </Typography>
                                </Box>
                            </Paper>
                        );
                    })}
                </Box>
            )}

            {result.metrics && Object.keys(result.metrics).filter(k => k !== 'raw').length > 0 && (
                <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: isDark ? '#1a1a1a' : '#fafafa' }}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <MonitorHeartIcon fontSize="small" />
                        Gemessene Metrik-Abweichungen (vs. persoenliche Baseline)
                    </Typography>
                    <Grid container spacing={1}>
                        {Object.entries(result.metrics)
                            .filter(([k]) => k !== 'raw')
                            .sort(([, a], [, b]) => (b as number) - (a as number))
                            .map(([key, val]) => {
                                const numVal = val as number;
                                const barColor = numVal >= 30 ? '#f44336' : numVal >= 15 ? '#ff9800' : '#4caf50';
                                return (
                                    <Grid item xs={6} sm={4} key={key}>
                                        <Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                                    {SCREENING_SIGNAL_LABELS[key] || key}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: barColor, fontWeight: 'bold', fontSize: '0.65rem' }}>
                                                    {numVal.toFixed(0)}%
                                                </Typography>
                                            </Box>
                                            <LinearProgress variant="determinate" value={Math.min(numVal, 100)}
                                                sx={{ height: 4, borderRadius: 2, bgcolor: isDark ? '#2a2a2a' : '#e0e0e0',
                                                    '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 2 } }} />
                                        </Box>
                                    </Grid>
                                );
                            })
                        }
                    </Grid>
                </Paper>
            )}
        </Box>
    );
}


// --- CGM + Vibration Korrelations-Panel (Forschungstool, Phase 3) -------------
interface CgmReading { ts: number; val: number; unit?: string; trend?: string; }
interface VibEvent   { ts: number; val: number; }

function mapTrend(t?: string): string {
    const m: Record<string,string> = { DoubleUp:'⇈', SingleUp:'↑', FortyFiveUp:'↗', Flat:'→', FortyFiveDown:'↘', SingleDown:'↓', DoubleDown:'⇊' };
    return t ? (m[t] ?? t) : '';
}

// Trigger-Timestamps + Stärke-Events zusammenführen:
// Jeder Trigger-Timestamp bekommt den nächsten Stärke-Wert innerhalb von 3 Minuten.
// Stärke-Events ohne nahen Trigger werden ebenfalls aufgenommen (val = gemessener Wert).
function mergeVibEvents(trigTs: number[], strEvents: VibEvent[]): VibEvent[] {
    const MAX_DIFF  = 3 * 60 * 1000;
    const MIN_GAP   = 90 * 1000; // Zigbee-Keepalive-Filter: Events < 90s = Duplikat
    const used = new Set<number>();
    const raw: VibEvent[] = trigTs.map(ts => {
        let best: VibEvent | null = null;
        let bestDiff = Infinity;
        for (const e of strEvents) {
            const d = Math.abs(e.ts - ts);
            if (d < bestDiff) { bestDiff = d; best = e; }
        }
        if (best && bestDiff < MAX_DIFF) { used.add(best.ts); return { ts, val: best.val }; }
        return { ts, val: 1 };
    });
    for (const e of strEvents) {
        if (!used.has(e.ts)) raw.push({ ts: e.ts, val: e.val });
    }
    raw.sort((a, b) => a.ts - b.ts);
    // Duplikate entfernen: Events < MIN_GAP nach dem vorherigen werden verworfen
    const dedup: VibEvent[] = [];
    let lastTs = -Infinity;
    for (const e of raw) {
        if (e.ts - lastTs >= MIN_GAP) { dedup.push(e); lastTs = e.ts; }
    }
    return dedup;
}

// Spearman-Korrelation
function _ranks(arr: number[]): number[] {
    const s = arr.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v);
    const r = new Array(arr.length).fill(0);
    s.forEach((x,rank)=>{ r[x.i]=rank+1; });
    return r;
}
function spearmanR(x: number[], y: number[]): number|null {
    if (x.length < 6) return null;
    const rx=_ranks(x), ry=_ranks(y), n=x.length;
    let d2=0; for(let i=0;i<n;i++) d2+=(rx[i]-ry[i])**2;
    return +(1-(6*d2)/(n*(n*n-1))).toFixed(3);
}

// Odds Ratio
interface OR { or: number|null; a:number; b:number; c:number; d:number; }
function calcOR(a:number,b:number,c:number,d:number): OR {
    return { or: (b>0&&c>0) ? +((a*d)/(b*c)).toFixed(2) : null, a,b,c,d };
}

// 5-min-Bin Statistiken (eine Nacht oder kumulativ)
interface CorrBin { g: number; vs: number; hv: boolean; }
function buildBins(readings: CgmReading[], vibs: VibEvent[], wS: number, wE: number): CorrBin[] {
    const BIN = 5*60*1000;
    const bins: CorrBin[] = [];
    for (let t=wS; t<wE; t+=BIN) {
        const near = readings.filter(r=>Math.abs(r.ts-(t+BIN/2))<BIN);
        if (!near.length) continue;
        const g = near.reduce((s,r)=>s+r.val,0)/near.length;
        const bv = vibs.filter(v=>v.ts>=t&&v.ts<t+BIN);
        bins.push({ g, vs: bv.reduce((s,v)=>s+v.val,0), hv: bv.length>0 });
    }
    return bins;
}

interface CorrStats {
    spR: number|null; nBins: number;
    orHypo: OR; orHyper: OR;
    pctHypo:number; pctHyper:number; pctNormal:number;
    nNights: number;
}
function computeStats(bins: CorrBin[], nNights=1): CorrStats|null {
    if (bins.length < 6) return null;
    const sr = spearmanR(bins.map(b=>b.g), bins.map(b=>b.vs));
    const hypo=bins.filter(b=>b.g<70), hyper=bins.filter(b=>b.g>180), norm=bins.filter(b=>b.g>=70&&b.g<=180);
    const nA=norm.filter(b=>b.hv).length, nB=norm.filter(b=>!b.hv).length;
    const total=bins.length;
    return {
        spR: sr, nBins: bins.length, nNights,
        orHypo:  calcOR(hypo.filter(b=>b.hv).length,  hypo.filter(b=>!b.hv).length,  nA, nB),
        orHyper: calcOR(hyper.filter(b=>b.hv).length, hyper.filter(b=>!b.hv).length, nA, nB),
        pctHypo:   Math.round((hypo.length/total)*100),
        pctHyper:  Math.round((hyper.length/total)*100),
        pctNormal: Math.round((norm.length/total)*100),
    };
}

// --- Statistik-Panel mit Erklärungen ---
function StatsPanel({ stats, isDark, title }: { stats: CorrStats; isDark: boolean; title?: string }) {
    const hypoThr = 70, hyperThr = 180;
    const qualityHint = stats.nNights < 14
        ? `Noch ${14-stats.nNights} weitere Nacht${14-stats.nNights!==1?'e':''} für erste belastbare Aussage (≥14) · ${30-stats.nNights>0?`${30-stats.nNights} für Paper-Qualität (≥30)`:'Paper-Qualität erreicht'}`
        : stats.nNights < 30 ? `${30-stats.nNights} weitere Nächte bis zur Paper-Qualität (≥30 Nächte)` : 'Paper-Qualität erreicht ✓';
    const qualityColor = stats.nNights >= 30 ? '#4caf50' : stats.nNights >= 14 ? '#ff9800' : '#9e9e9e';

    return (
        <Paper variant="outlined" sx={{ mt:1.5, p:1.5, bgcolor: isDark?'#0a0f0a':'#f9fff9', borderColor:'#4caf5025' }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:1 }}>
                <Typography variant="caption" fontWeight="bold" sx={{ color: isDark?'#aaa':'#555' }}>
                    {title || `Korrelationsanalyse — ${stats.nNights} Nacht${stats.nNights!==1?'e':''}, ${stats.nBins} 5-min-Bins`}
                </Typography>
                <Chip size="small"
                    label={`${stats.nNights} Nacht${stats.nNights!==1?'e':''}`}
                    sx={{ bgcolor: isDark?'#1a1a1a':'#fff', border:`1px solid ${qualityColor}`, color: qualityColor, fontSize:'0.65rem' }} />
            </Box>
            <Grid container spacing={1.5}>
                {/* Spearman r */}
                <Grid item xs={12} sm={4}>
                    <Box sx={{ p:1, bgcolor: isDark?'#111':'#fff', borderRadius:1, border:`1px solid ${isDark?'#2a2a2a':'#eee'}`, height:'100%' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight:'bold' }}>{'Spearman r (Glukose ↔ Vibrationsstärke)'}</Typography>
                        <Typography variant="h6" sx={{ color: stats.spR===null?'#9e9e9e':stats.spR<-0.3?'#4caf50':stats.spR<0?'#ff9800':'#9e9e9e', fontWeight:'bold', mt:0.3, lineHeight:1.2 }}>
                            {stats.spR===null ? 'n/a' : stats.spR.toFixed(2)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize:'0.68rem', display:'block', mt:0.3 }}>
                            {stats.spR===null
                                ? 'Zu wenige Daten'
                                : stats.spR < -0.3
                                    ? 'Negative Korrelation: bei niedrigem Glukose mehr Bewegung'
                                    : stats.spR < 0
                                        ? 'Schwach negative Tendenz — mehr Nächte sammeln'
                                        : 'Kein Signal — mehr Nächte nötig'}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize:'0.62rem', color:'#9e9e9e', display:'block', mt:0.5, fontStyle:'italic' }}>
                            {'Skala: −1 = perfekte neg. Korrelation · 0 = kein Zusammenhang · +1 = perfekte pos. Korrelation'}
                        </Typography>
                    </Box>
                </Grid>
                {/* OR Hypo */}
                <Grid item xs={6} sm={4}>
                    <Box sx={{ p:1, bgcolor: isDark?'#111':'#fff', borderRadius:1, border:`1px solid ${isDark?'#2a2a2a':'#eee'}`, height:'100%' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight:'bold' }}>
                            {`Odds Ratio: Hypo (<${hypoThr}) vs. Normal`}
                        </Typography>
                        <Typography variant="h6" sx={{ color: stats.orHypo.or===null?'#9e9e9e':stats.orHypo.or>2?'#f44336':stats.orHypo.or>1.3?'#ff9800':'#9e9e9e', fontWeight:'bold', mt:0.3, lineHeight:1.2 }}>
                            {stats.orHypo.or===null ? 'n/a' : stats.orHypo.or.toFixed(2)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize:'0.68rem', display:'block', mt:0.3 }}>
                            {stats.orHypo.or===null
                                ? `Kein Normal- oder Hypo-Bereich vorhanden`
                                : stats.orHypo.or > 2
                                    ? `Starkes Signal: ${stats.orHypo.or.toFixed(1)}× mehr Vibration bei Hypo`
                                    : stats.orHypo.or > 1.3
                                        ? `Tendenz: ${stats.orHypo.or.toFixed(1)}× mehr Vibration bei Hypo`
                                        : `Kein klares Signal (OR ≈ 1.0 = kein Unterschied)`}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize:'0.62rem', color:'#9e9e9e', display:'block', mt:0.5, fontStyle:'italic' }}>
                            {`${stats.pctHypo}% d. Bins im Hypo-Bereich · Vib-Bins: ${stats.orHypo.a} Hypo / ${stats.orHypo.c} Normal`}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize:'0.62rem', color:'#9e9e9e', display:'block', fontStyle:'italic' }}>
                            {'OR > 1: mehr Vibration bei Hypo als in der Normalzone. Zielwert für Paper: OR ≥ 2.0'}
                        </Typography>
                    </Box>
                </Grid>
                {/* OR Hyper */}
                <Grid item xs={6} sm={4}>
                    <Box sx={{ p:1, bgcolor: isDark?'#111':'#fff', borderRadius:1, border:`1px solid ${isDark?'#2a2a2a':'#eee'}`, height:'100%' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight:'bold' }}>
                            {`Odds Ratio: Hyper (>${hyperThr}) vs. Normal`}
                        </Typography>
                        <Typography variant="h6" sx={{ color: stats.orHyper.or===null?'#9e9e9e':stats.orHyper.or>2?'#ff9800':stats.orHyper.or>1.3?'#ffc107':'#9e9e9e', fontWeight:'bold', mt:0.3, lineHeight:1.2 }}>
                            {stats.orHyper.or===null ? 'n/a' : stats.orHyper.or.toFixed(2)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize:'0.68rem', display:'block', mt:0.3 }}>
                            {stats.orHyper.or===null
                                ? `Kein Hyper-Bereich vorhanden`
                                : stats.orHyper.or > 2
                                    ? `Starkes Signal: ${stats.orHyper.or.toFixed(1)}× mehr Vibration bei Hyper`
                                    : stats.orHyper.or > 1.3
                                        ? `Tendenz: ${stats.orHyper.or.toFixed(1)}× mehr Vibration bei Hyper`
                                        : `Kein klares Signal`}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize:'0.62rem', color:'#9e9e9e', display:'block', mt:0.5, fontStyle:'italic' }}>
                            {`${stats.pctHyper}% d. Bins im Hyper-Bereich · Vib-Bins: ${stats.orHyper.a} Hyper / ${stats.orHyper.c} Normal`}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize:'0.62rem', color:'#9e9e9e', display:'block', fontStyle:'italic' }}>
                            {'Hyperglykämie kann ebenfalls Unruhe verursachen (sympathische Aktivierung).'}
                        </Typography>
                    </Box>
                </Grid>
            </Grid>
            {/* Daten-Qualitäts-Hinweis */}
            <Box sx={{ mt:1, p:0.8, bgcolor: isDark?'#111':'#fff', borderRadius:1, border:`1px dashed ${qualityColor}40` }}>
                <Typography variant="caption" sx={{ color: qualityColor, fontSize:'0.68rem' }}>
                    {`Daten-Qualität: ${qualityHint}`}
                </Typography>
            </Box>
        </Paper>
    );
}

// --- PersonCgmChart (SVG-Timeline) ---
function PersonCgmChart({ person, readings, vibEvents, sleepStart, sleepEnd, unit, isDark, bedWasEmpty }: {
    person: string; readings: CgmReading[]; vibEvents: VibEvent[];
    sleepStart: number|null; sleepEnd: number|null; unit: string; isDark: boolean; bedWasEmpty?: boolean;
}) {
    const unitLabel = unit === 'mmoll' ? 'mmol/l' : 'mg/dl';
    const hypoThr  = unit === 'mmoll' ? 3.9  : 70;
    const hyperThr = unit === 'mmoll' ? 10.0 : 180;
    const G_MIN    = unit === 'mmoll' ? 2    : 40;
    const G_MAX    = unit === 'mmoll' ? 22   : 300;

    const midToday = new Date().setHours(0,0,0,0);
    const wS = sleepStart ? sleepStart - 10*60*1000 : midToday - 4*3600000;
    const wE = sleepEnd   ? sleepEnd   + 10*60*1000 : wS + 10*3600000;
    const wDur = wE - wS;

    const wR  = readings.filter(r => r.ts >= wS && r.ts <= wE);
    const wVB = vibEvents.filter(v => v.ts >= wS && v.ts <= wE);

    if (wR.length === 0) {
        return (
            <Box sx={{ mt:1, mb:2 }}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb:0.5 }}>{person}</Typography>
                <Alert severity="info" icon={<MonitorHeartIcon />} sx={{ py:0.5, fontSize:'0.8rem' }}>
                    {'Noch keine CGM-Daten für diese Nacht vorhanden. Nach Adapter-Update werden neue Nächte korrekt gespeichert.'}
                </Alert>
            </Box>
        );
    }

    if (bedWasEmpty) {
        return (
            <Box sx={{ mt:1, mb:2 }}>
                <Typography variant="body2" fontWeight="bold" sx={{ mb:0.5 }}>{person}</Typography>
                <Alert severity="warning" sx={{ py:0.5, fontSize:'0.8rem' }}>
                    <strong>Bett war leer diese Nacht</strong> — Kein Sensor hat Bett-Anwesenheit bestätigt.
                    Diese Nacht wird auch aus der kumulativen Korrelationsanalyse ausgeschlossen.
                </Alert>
            </Box>
        );
    }

    const W=1000, H=220, PL=50, PR=16, PT=18, PB=28;
    const pW=W-PL-PR, pH=H-PT-PB;
    const xS = (ts:number) => PL + ((ts-wS)/wDur)*pW;
    const yS = (v:number)  => PT + pH - ((v-G_MIN)/(G_MAX-G_MIN))*pH;
    const yHypo  = yS(hypoThr);
    const yHyper = yS(hyperThr);
    const yBot   = PT+pH;

    const maxVib = Math.max(...wVB.map(v=>v.val), 1);
    const maxBarH = pH * 0.30;
    const barW = Math.max(2, Math.min(5, pW / (wVB.length || 1) * 0.5));

    const pathD = wR.length>1
        ? wR.map((r,i)=>`${i===0?'M':'L'}${xS(r.ts).toFixed(1)} ${yS(r.val).toFixed(1)}`).join(' ')
        : '';

    const CW = 15*60*1000;
    const hypoR = wR.filter(r=>r.val<hypoThr);
    const hyperR = wR.filter(r=>r.val>hyperThr);
    const corrVibAtHypo  = wVB.filter(v=>hypoR.some(r=>Math.abs(r.ts-v.ts)<CW));
    const corrVibAtHyper = wVB.filter(v=>hyperR.some(r=>Math.abs(r.ts-v.ts)<CW));

    const spanH = Math.ceil(wDur/3600000);
    const stepH = spanH <= 8 ? 1 : spanH <= 14 ? 2 : 3;
    const tLabels: {x:number;label:string}[] = [];
    for (let h=0; h<=spanH; h+=stepH) {
        const ts=wS+h*3600000; const d=new Date(ts);
        tLabels.push({ x:xS(ts), label:`${d.getHours()}:00` });
    }
    const yGrid = unit==='mmoll' ? [4,6,8,10,14,18] : [70,100,140,180,240,300];

    const minV=Math.min(...wR.map(r=>r.val)), maxV=Math.max(...wR.map(r=>r.val));
    const avgV=wR.reduce((s,r)=>s+r.val,0)/wR.length;
    const inR=wR.filter(r=>r.val>=hypoThr&&r.val<=hyperThr).length;
    const irPct=Math.round((inR/wR.length)*100);

    const oneBins = buildBins(wR, wVB, wS, wE);
    const oneStats = computeStats(oneBins, 1);

    return (
        <Box sx={{ mt:1.5, mb:2.5 }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:0.8, mb:0.8, flexWrap:'wrap' }}>
                <Typography variant="body2" fontWeight="bold" sx={{ mr:0.5 }}>{person}</Typography>
                <Chip size="small" label={`Ø ${avgV.toFixed(unit==='mmoll'?1:0)} ${unitLabel}`} sx={{ bgcolor:'#2196f320', color:'#2196f3', fontSize:'0.68rem' }} />
                <Chip size="small" label={`Min: ${minV.toFixed(unit==='mmoll'?1:0)}`} sx={{ bgcolor: minV<hypoThr?'#f4433625':'#4caf5020', color: minV<hypoThr?'#f44336':'#4caf50', fontSize:'0.68rem' }} />
                <Chip size="small" label={`Max: ${maxV.toFixed(unit==='mmoll'?1:0)}`} sx={{ bgcolor: maxV>hyperThr?'#ff980025':'#4caf5020', color: maxV>hyperThr?'#ff9800':'#4caf50', fontSize:'0.68rem' }} />
                <Chip size="small" label={`${irPct}% Zielbereich`} sx={{ bgcolor:'#4caf5020', color:'#4caf50', fontSize:'0.68rem' }} />
                {hypoR.length>0  && <Chip size="small" label={`${hypoR.length}× Hypo`}  sx={{ bgcolor:'#f4433625', color:'#f44336', fontSize:'0.68rem', fontWeight:'bold' }} />}
                {hyperR.length>0 && <Chip size="small" label={`${hyperR.length}× Hyper`} sx={{ bgcolor:'#ff980025', color:'#ff9800', fontSize:'0.68rem' }} />}
                <Typography variant="caption" color="text.secondary">{wR.length} CGM · {wVB.length} Vib</Typography>
                {wR[wR.length-1]?.trend && <Chip size="small" label={mapTrend(wR[wR.length-1].trend)} sx={{ bgcolor:'#9e9e9e18', fontSize:'0.75rem', minWidth:28 }} />}
            </Box>

            <Box sx={{ width:'100%', overflow:'hidden', borderRadius:1, border:`1px solid ${isDark?'#2a2a2a':'#ddd'}` }}>
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', display:'block' }}>
                    <rect x={PL} y={PT} width={pW} height={pH} fill={isDark?'#0d1117':'#fafffe'} />
                    <rect x={PL} y={yHypo}  width={pW} height={yBot-yHypo}   fill="#f4433614" />
                    <rect x={PL} y={yHyper} width={pW} height={yHypo-yHyper} fill="#4caf5008" />
                    <line x1={PL} y1={yHypo}  x2={PL+pW} y2={yHypo}  stroke="#f44336" strokeWidth={1}   strokeDasharray="5,3" opacity={0.7} />
                    <line x1={PL} y1={yHyper} x2={PL+pW} y2={yHyper} stroke="#ff9800" strokeWidth={0.7} strokeDasharray="4,4" opacity={0.5} />
                    {yGrid.map(v=>(
                        <g key={v}>
                            <line x1={PL} y1={yS(v)} x2={PL+pW} y2={yS(v)} stroke={isDark?'#ffffff12':'#00000010'} strokeWidth={0.5} />
                            <text x={PL-3} y={yS(v)+4} textAnchor="end" fontSize={9} fill={isDark?'#666':'#888'}>{v}</text>
                        </g>
                    ))}
                    {wVB.map((v,i)=>{
                        const xv = xS(v.ts);
                        const bH = Math.max(3, (v.val/maxVib)*maxBarH);
                        const isHypoCor  = corrVibAtHypo.includes(v);
                        const isHyperCor = corrVibAtHyper.includes(v);
                        const col = isHypoCor ? '#f44336' : isHyperCor ? '#ff9800' : '#2196f3';
                        const op  = isHypoCor||isHyperCor ? 0.85 : v.val>1 ? 0.55 : 0.3;
                        return <rect key={i} x={xv-barW/2} y={yBot-bH} width={barW} height={bH} fill={col} opacity={op} rx={1} />;
                    })}
                    {pathD && <path d={pathD} fill="none" stroke="#4caf50" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />}
                    {wR.map((r,i)=>(
                        <circle key={i} cx={xS(r.ts)} cy={yS(r.val)} r={r.val<hypoThr?4:r.val>hyperThr?3.5:2}
                            fill={r.val<hypoThr?'#f44336':r.val>hyperThr?'#ff9800':'#4caf50'} opacity={0.9} />
                    ))}
                    <text x={PL+4} y={yHypo-3}  fontSize={9} fill="#f44336" opacity={0.85}>Hypo</text>
                    <text x={PL+4} y={yHyper-3} fontSize={9} fill="#ff9800" opacity={0.7}>Hyper</text>
                    {tLabels.map(({x,label})=>(
                        <g key={label}>
                            <line x1={x} y1={yBot} x2={x} y2={yBot+4} stroke={isDark?'#444':'#bbb'} strokeWidth={0.8} />
                            <text x={x} y={yBot+13} textAnchor="middle" fontSize={9} fill={isDark?'#666':'#999'}>{label}</text>
                        </g>
                    ))}
                    <text x={10} y={PT+pH/2+4} textAnchor="middle" fontSize={9} fill={isDark?'#666':'#999'}
                        transform={`rotate(-90,10,${PT+pH/2+4})`}>{unitLabel}</text>
                    <rect x={PL} y={PT} width={pW} height={pH} fill="none" stroke={isDark?'#2a2a2a':'#ccc'} strokeWidth={0.8} />
                </svg>
            </Box>

            <Box sx={{ display:'flex', gap:2, mt:0.5, flexWrap:'wrap', pl:0.5 }}>
                <Box sx={{ display:'flex', alignItems:'center', gap:0.5 }}>
                    <Box sx={{ width:18, height:3, bgcolor:'#4caf50', borderRadius:2 }} />
                    <Typography variant="caption" color="text.secondary">Glukose</Typography>
                </Box>
                <Box sx={{ display:'flex', alignItems:'center', gap:0.5 }}>
                    <Box sx={{ width:6, height:14, bgcolor:'#2196f360', borderRadius:1 }} />
                    <Typography variant="caption" color="text.secondary">{'Vibration (Höhe = Stärke)'}</Typography>
                </Box>
                {corrVibAtHypo.length>0 && <Box sx={{ display:'flex', alignItems:'center', gap:0.5 }}>
                    <Box sx={{ width:6, height:14, bgcolor:'#f44336', borderRadius:1 }} />
                    <Typography variant="caption" sx={{ color:'#f44336', fontWeight:'bold' }}>{'Vibration bei Hypo (±15 min)'}</Typography>
                </Box>}
                {corrVibAtHyper.length>0 && <Box sx={{ display:'flex', alignItems:'center', gap:0.5 }}>
                    <Box sx={{ width:6, height:14, bgcolor:'#ff9800', borderRadius:1 }} />
                    <Typography variant="caption" sx={{ color:'#ff9800' }}>{'Vibration bei Hyper (±15 min)'}</Typography>
                </Box>}
            </Box>

            {oneStats && <StatsPanel stats={oneStats} isDark={isDark} title={`Diese Nacht — ${oneStats.nBins} 5-min-Bins`} />}

            {(hypoR.length>0||hyperR.length>0) && (
                <Alert severity={corrVibAtHypo.length>0||corrVibAtHyper.length>0?'warning':'info'} sx={{ mt:1, py:0.5, fontSize:'0.82rem' }}>
                    {hypoR.length>0&&<><strong>{hypoR.length} Hypo-Episode{hypoR.length>1?'n':''}</strong>{corrVibAtHypo.length>0?` — ${corrVibAtHypo.length} Vibrations-Event${corrVibAtHypo.length!==1?'s':''} im ±15-min-Fenster.`:' — kein Vibrations-Signal im ±15-min-Fenster.'}{' '}</>}
                    {hyperR.length>0&&<><strong>{hyperR.length} Hyper-Episode{hyperR.length>1?'n':''}</strong>{corrVibAtHyper.length>0?` — ${corrVibAtHyper.length} Vibrations-Event${corrVibAtHyper.length!==1?'s':''} im ±15-min-Fenster.`:' — kein Vibrations-Signal im ±15-min-Fenster.'}</>}
                </Alert>
            )}
        </Box>
    );
}

// --- Kumulatives Panel (alle verfügbaren Nächte) ---
function CumulativePanel({ socket, adapterName, instance, native, isDark }: {
    socket: any; adapterName: string; instance: number; native: Record<string,any>; isDark: boolean;
}) {
    const [stats, setStats]     = useState<CorrStats|null>(null);
    const [loading, setLoading] = useState(false);
    const [nights, setNights]   = useState(0);
    const [open, setOpen]       = useState(false);

    const run = React.useCallback(async () => {
        setLoading(true);
        const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const cgmAssign = (native?.cgmPersonAssignment||{}) as Record<string,any>;
        const cfgPersons = Object.keys(cgmAssign).filter(p=>cgmAssign[p]?.glucoseStateId);
        if (!cfgPersons.length) { setLoading(false); return; }

        const allBins: CorrBin[] = [];
        let nNights = 0;
        const today = new Date();
        // Letzte 60 Tage in Batches von 7
        const allDates: string[] = [];
        for (let i=1; i<=60; i++) {
            const d=new Date(today); d.setDate(d.getDate()-i);
            allDates.push(fmt(d));
        }
        for (let batch=0; batch<allDates.length; batch+=7) {
            const chunk = allDates.slice(batch, batch+7);
            const results = await Promise.all(chunk.map(date =>
                socket.sendTo(`${adapterName}.${instance}`, 'getHistoryData', { date, _t: Date.now() }).catch(()=>null)
            ));
            for (let ci=0; ci<results.length; ci++) {
                const r = results[ci];
                const data = (r?.success && r?.data) ? r.data : null;
                if (!data) continue;
                const person = cfgPersons[0];
                // Bett war leer → Nacht aus Korrelationsanalyse ausschließen
                if (data.personData?.[person]?.bedWasEmpty === true) continue;
                const readings: CgmReading[] = data.cgmReadings?.[person] || [];
                if (readings.length < 3) continue;
                // Vibration: vibration_trigger==true aus eventHistory, nur Person-eigene oder ungetaggte Events
                const trigTs: number[] = (data.eventHistory||[])
                    .filter((e:any)=>e.type==='vibration_trigger'&&e.isVibrationBed&&e.value===true&&(!e.personTag||e.personTag===person))
                    .map((e:any)=>e.timestamp as number);
                const strEvts: VibEvent[] = (data.eventHistory||[])
                    .filter((e:any)=>e.type==='vibration_strength'&&e.isVibrationBed&&(!e.personTag||e.personTag===person))
                    .map((e:any)=>({ ts: e.timestamp as number, val: typeof e.value==='number'?e.value:parseFloat(e.value) }))
                    .filter((e:VibEvent)=>!isNaN(e.val)&&e.val>0);
                const vibs = mergeVibEvents(trigTs, strEvts);
                const wS = data.sleepWindowStart ?? (new Date(allDates[batch+ci]).setHours(0,0,0,0));
                const wE = data.sleepWindowEnd   ?? (wS + 10*3600000);
                const dayBins = buildBins(readings, vibs, wS - 10*60*1000, wE + 10*60*1000);
                if (dayBins.length > 3) { allBins.push(...dayBins); nNights++; }
            }
        }
        setNights(nNights);
        setStats(computeStats(allBins, nNights));
        setLoading(false);
    }, [socket, adapterName, instance, native]);

    return (
        <Paper variant="outlined" sx={{ mt:2, p:1.5, bgcolor: isDark?'#080f08':'#f0fff0', borderColor:'#4caf5040' }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1, cursor:'pointer' }} onClick={()=>{ if(!open&&!stats&&!loading) run(); setOpen(o=>!o); }}>
                <ScienceIcon sx={{ color:'#9c27b0', fontSize:18 }} />
                <Typography variant="subtitle2" fontWeight="bold">{'Kumulative Analyse (alle verfügbaren Nächte)'}</Typography>
                <Chip size="small" label={nights>0?`${nights} Nächte`:'Noch nicht geladen'} sx={{ fontSize:'0.65rem', bgcolor:'#9c27b018', color:'#9c27b0' }} />
                <Typography variant="caption" color="text.secondary" sx={{ ml:'auto' }}>{open?'▲':'▼ aufklappen & laden'}</Typography>
            </Box>
            {open && (
                <Box sx={{ mt:1.5 }}>
                    {loading && <LinearProgress sx={{ borderRadius:2, mb:1 }} />}
                    {!loading && !stats && (
                        <Button size="small" variant="outlined" color="secondary" onClick={run}>
                            Letzte 60 Nächte analysieren
                        </Button>
                    )}
                    {stats && <StatsPanel stats={stats} isDark={isDark} title={`Kumulativ: ${stats.nNights} Nächte, ${stats.nBins} Bins gesamt`} />}
                    <Typography variant="caption" color="text.secondary" sx={{ mt:0.8, display:'block', fontSize:'0.65rem', fontStyle:'italic' }}>
                        {'Literatur: ≥14 Nächte = erste Aussage (Feasibility-Studie). ≥30 Nächte = Paper-Qualität (vgl. Bonnefond et al., Sensors 2020: 12 Wochen / 84 Nächte pro Patient).'}
                    </Typography>
                </Box>
            )}
        </Paper>
    );
}

// --- Paper-Referenzen ---
function PaperBox({ isDark }: { isDark: boolean }) {
    const [open, setOpen] = useState(false);
    return (
        <Paper variant="outlined" sx={{ mt:1.5, borderColor:'#9c27b030', bgcolor: isDark?'#080508':'#fdf8ff' }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1, p:1.2, cursor:'pointer' }} onClick={()=>setOpen(o=>!o)}>
                <ScienceIcon sx={{ color:'#9c27b0', fontSize:16 }} />
                <Typography variant="caption" fontWeight="bold" sx={{ color:'#9c27b0' }}>Literaturgrundlage & Methodik</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml:'auto' }}>{open?'▲':'▼'}</Typography>
            </Box>
            {open && (
                <Box sx={{ px:1.5, pb:1.5 }}>
                    {[
                        { ref:'Bonnefond et al. (Sensors 2020, MDPI)', url:'https://www.mdpi.com/1424-8220/20/6/1705', txt:'CGM + Aktigraph + ML (SVM/MLP) → 78 % Sensitivität, 82 % Spezifität für nächtliche Hypoglykämie. 10 T1D-Patienten, 12 Wochen. Direktes Vorbild für diese Analyse.' },
                        { ref:'Smartphone Activity & NH (PMC 2023, PMC11873899)', url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC11873899/', txt:'OR 1.11 pro 1000 Schritte für NH < 70 mg/dl (p=0.04). Zeigt: körperliche Aktivität als messbarer Risikofaktor → Bett-Vibration ist das nächtliche Äquivalent.' },
                        { ref:'Nocturnal Hypo in the Era of CGM (PMC 2024, PMC11418455)', url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC11418455/', txt:'Review: ML-Modelle mit CGM + Bewegungsdaten erreichen 71–96 % Sensitivität. Erklärt den Mechanismus: NH → Sympathikus → Adrenalin → Zittern/motorische Unruhe = Bett-Vibration.' },
                    ].map(p=>(
                        <Box key={p.ref} sx={{ mb:1 }}>
                            <Typography variant="caption" sx={{ fontWeight:'bold', color: isDark?'#ce93d8':'#7b1fa2', display:'block' }}>
                                {p.ref}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize:'0.68rem', display:'block' }}>{p.txt}</Typography>
                            <Typography variant="caption" sx={{ fontSize:'0.62rem', color:'#9c27b0', fontStyle:'italic' }}>{p.url}</Typography>
                        </Box>
                    ))}
                    <Divider sx={{ my:0.8 }} />
                    <Typography variant="caption" sx={{ fontSize:'0.68rem', color: isDark?'#aaa':'#555', display:'block' }}>
                        <strong>Methodik dieser Analyse:</strong>
                        {' Spearman-Rangkorrelation (verteilungsfrei, robust gegen Ausreißer). Odds Ratio aus 2×2-Kontingenztabelle (Hypo/Hyper vs. Normalbereich, 5-min-Bins). Vibrations-Events: Trigger-Timestamps als Ereignis-Basis, Stärke-Werte (val 1–100) als Balkenhöhe im Chart. Korrelationsfenster Hypo/Hyper: ±15 Minuten.'}
                    </Typography>
                </Box>
            )}
        </Paper>
    );
}

function CgmCorrelationPanel({ socket, adapterName, instance, native, isDark }: {
    socket: any; adapterName: string; instance: number; native: Record<string,any>; isDark: boolean;
}) {
    const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const today = fmt(new Date());

    const [selDate, setSelDate]   = useState<string>(today);
    const [cgmData, setCgmData]       = useState<Record<string,CgmReading[]>>({});
    const [vibData, setVibData]       = useState<Record<string,VibEvent[]>>({});
    const [bedEmpty, setBedEmpty]     = useState<Record<string,boolean>>({});
    const [sleepWin, setSleepWin]     = useState<{start:number|null;end:number|null}>({start:null,end:null});
    const [loading, setLoading]       = useState(true);

    const prevDate = (d: string) => { const x=new Date(d); x.setDate(x.getDate()-1); return fmt(x); };
    const nextDate = (d: string) => { const x=new Date(d); x.setDate(x.getDate()+1); return fmt(x); };

    useEffect(() => {
        setLoading(true);
        const yest = prevDate(selDate);
        Promise.all([
            socket.sendTo(`${adapterName}.${instance}`, 'getHistoryData', { date: selDate, _t: Date.now() }).catch(()=>null),
            socket.sendTo(`${adapterName}.${instance}`, 'getHistoryData', { date: yest,    _t: Date.now() }).catch(()=>null),
        ]).then(([r1, r2]: [any,any]) => {
            const d1 = (r1?.success && r1?.data) ? r1.data : null;
            const d2 = (r2?.success && r2?.data) ? r2.data : null;

            const cgmCutoff = new Date(selDate).setHours(0,0,0,0) - 4*3600000;
            const merged: Record<string,CgmReading[]> = {};
            for (const src of [d2, d1]) {
                if (!src?.cgmReadings) continue;
                for (const [p, rList] of Object.entries(src.cgmReadings as Record<string,CgmReading[]>)) {
                    if (!merged[p]) merged[p] = [];
                    merged[p].push(...(rList as CgmReading[]).filter(r=>r.ts>=cgmCutoff));
                }
            }
            for (const p of Object.keys(merged)) {
                const seen=new Set<number>();
                merged[p]=merged[p].filter(r=>{if(seen.has(r.ts))return false;seen.add(r.ts);return true;}).sort((a,b)=>a.ts-b.ts);
            }

            // Vibration: vibration_trigger==true aus eventHistory (korrekte Quelle), Stärke zuordnen
            const cgmAssign = (native?.cgmPersonAssignment||{}) as Record<string,any>;
            const cfgPersons = Object.keys(cgmAssign).filter(p=>cgmAssign[p]?.glucoseStateId);
            const vibMerged: Record<string,VibEvent[]> = {};
            for (const person of cfgPersons) {
                const trigTs: number[] = [];
                const strEvts: VibEvent[] = [];
                for (const src of [d2, d1]) {
                    if (!src) continue;
                    const evts: any[] = src.eventHistory || [];
                    for (const e of evts) {
                        if ((e.timestamp||0) < cgmCutoff) continue;
                        // Nur Person-eigene oder ungetaggte Vibrationsereignisse verwenden
                        if (e.isVibrationBed && (!e.personTag || e.personTag === person)) {
                            if (e.type==='vibration_trigger' && e.value===true) {
                                trigTs.push(e.timestamp as number);
                            } else if (e.type==='vibration_strength') {
                                const val=typeof e.value==='number'?e.value:parseFloat(e.value);
                                if (!isNaN(val)&&val>0) strEvts.push({ ts:e.timestamp, val });
                            }
                        }
                    }
                }
                const seenT=new Set<number>(); const uniqTrig=trigTs.filter(t=>{if(seenT.has(t))return false;seenT.add(t);return true;});
                const seenS=new Set<number>(); const uniqStr=strEvts.filter(e=>{if(seenS.has(e.ts))return false;seenS.add(e.ts);return true;});
                vibMerged[person] = mergeVibEvents(uniqTrig, uniqStr);
            }

            const sw = { start: d1?.sleepWindowStart ?? d2?.sleepWindowStart ?? null, end: d1?.sleepWindowEnd ?? d2?.sleepWindowEnd ?? null };
            // bedWasEmpty pro Person aus personData (primär d1, Fallback d2)
            const bedEmptyMap: Record<string,boolean> = {};
            for (const person of cfgPersons) {
                const bwe = d1?.personData?.[person]?.bedWasEmpty ?? d2?.personData?.[person]?.bedWasEmpty;
                bedEmptyMap[person] = bwe === true;
            }
            setCgmData(merged); setVibData(vibMerged); setBedEmpty(bedEmptyMap); setSleepWin(sw); setLoading(false);
        });
    }, [selDate, socket, adapterName, instance]);

    const cgmAssign  = (native?.cgmPersonAssignment||{}) as Record<string,any>;
    const cfgPersons = Object.keys(cgmAssign).filter(p=>cgmAssign[p]?.glucoseStateId);
    if (cfgPersons.length===0) return null;

    const sleepLabel = sleepWin.start
        ? `Schlaf: ${new Date(sleepWin.start).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}–${sleepWin.end?new Date(sleepWin.end).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}):'?'}`
        : 'Schlaffenster nicht bekannt';

    return (
        <Paper variant="outlined" sx={{ p:2.5, mt:2.5, bgcolor: isDark?'#0a120a':'#f5fff5', borderColor:'#4caf5035' }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:0.5, flexWrap:'wrap' }}>
                <MonitorHeartIcon sx={{ color:'#f44336', fontSize:20 }} />
                <Typography variant="subtitle1" fontWeight="bold">{'CGM ↔ Bett-Vibration Korrelation'}</Typography>
                <Chip size="small" label="Forschungstool" sx={{ bgcolor:'#9c27b018', color:'#9c27b0', border:'1px solid #9c27b030', fontSize:'0.65rem' }} />
                <Box sx={{ ml:'auto', display:'flex', alignItems:'center', gap:0.5 }}>
                    <Button size="small" variant="outlined" sx={{ minWidth:32, px:0.5, py:0.2, fontSize:'0.75rem' }}
                        onClick={()=>setSelDate(prevDate(selDate))}>‹</Button>
                    <Typography variant="body2" sx={{ px:1, minWidth:100, textAlign:'center' }}>{selDate}</Typography>
                    <Button size="small" variant="outlined" sx={{ minWidth:32, px:0.5, py:0.2, fontSize:'0.75rem' }}
                        disabled={selDate>=today} onClick={()=>setSelDate(nextDate(selDate))}>›</Button>
                </Box>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb:1.5, display:'block' }}>
                {sleepLabel}
                {' · Grüne Linie = Glukose · Balken = Vibration (Höhe = Stärke, rot = bei Hypo, orange = bei Hyper)'}
            </Typography>

            {loading ? (
                <Box sx={{ py:1 }}>
                    <LinearProgress sx={{ borderRadius:2 }} />
                    <Typography variant="caption" color="text.secondary" sx={{ mt:0.5, display:'block' }}>Lade Nacht {selDate}...</Typography>
                </Box>
            ) : (
                cfgPersons.map(person => (
                    <PersonCgmChart key={person} person={person}
                        readings={cgmData[person]||[]}
                        vibEvents={vibData[person]||[]}
                        sleepStart={sleepWin.start} sleepEnd={sleepWin.end}
                        unit={cgmAssign[person]?.unit||'mgdl'}
                        isDark={isDark}
                        bedWasEmpty={bedEmpty[person] === true}
                    />
                ))
            )}

            <CumulativePanel socket={socket} adapterName={adapterName} instance={instance} native={native} isDark={isDark} />
            <PaperBox isDark={isDark} />

            <Typography variant="caption" color="text.secondary" sx={{ display:'block', mt:1.5, fontStyle:'italic', fontSize:'0.65rem' }}>
                {'Kein klinisches Diagnose-System. Forschungszwecke: Nachweis CGM ↔ Bett-Bewegung-Korrelation für wissenschaftliche Publikation.'}
            </Typography>
        </Paper>
    );
}


// --- Welcome Screen (kein Profil ausgewaehlt) ---------------------------------
function WelcomeScreen({ isDark }: { isDark: boolean }) {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400, textAlign: 'center', p: 4 }}>
            <LocalHospitalIcon sx={{ fontSize: 64, color: '#9e9e9e', mb: 2 }} />
            <Typography variant="h5" fontWeight="bold" gutterBottom>Medizinische Perspektive</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500, mb: 3 }}>
                Waehlen Sie links ein oder mehrere Krankheitsbilder aus, die Sie ueberwachen moechten.
                AURA aktiviert automatisch die passenden Algorithmen und Sensoren.
            </Typography>
            <Alert severity="info" sx={{ maxWidth: 500, textAlign: 'left' }}>
                <AlertTitle>Hinweis</AlertTitle>
                Diese Ansicht ist eine Ergaenzung zur technischen Perspektive (Gesundheit-Tab).
                Alle Algorithmen laufen im Hintergrund � hier sehen Sie sie durch die Linse eines Krankheitsbildes.
                <Box sx={{ mt: 1, p: 1, bgcolor: isDark ? '#1a2a1a' : '#e8f5e9', borderRadius: 1, fontSize: '0.75rem' }}>
                    <strong>Wichtig:</strong> Dieses System stellt keine medizinische Diagnose. Es erkennt Verhaltensauffaelligkeiten und weist auf Muster hin, die bei bestimmten Erkrankungen typisch auftreten. Bitte konsultieren Sie immer einen Arzt.
                </Box>
            </Alert>
        </Box>
    );
}

// --- HAUPT-KOMPONENTE ---------------------------------------------------------
export default function MedicalTab({ socket, adapterName, instance, theme, themeType, native, onChange }: MedicalTabProps) {
    const isDark = themeType === 'dark';
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
    const [diseaseScores, setDiseaseScores] = useState<Record<string, DiseaseScore>>({});
    const [screeningResult, setScreeningResult] = useState<ScreeningResult | null>(null);
    const namespace = `${adapterName}.${instance}`;

    // Krankheits-Risiko-Scores aus ioBroker States laden (Promise-basiert wie HealthTab)
    useEffect(() => {
        const stateId = `${namespace}.analysis.health.disease.scores`;
        socket.getState(stateId).then((s: any) => {
            if (s?.val) { try { setDiseaseScores(JSON.parse(s.val)); } catch(e) {} }
        }).catch(() => {});
        // Live-Update wenn neue Scores berechnet werden
        const handler = (_id: string, state: any) => {
            if (state?.val) { try { setDiseaseScores(JSON.parse(state.val)); } catch(e) {} }
        };
        socket.subscribeState(stateId, handler);
        return () => { try { socket.unsubscribeState(stateId, handler); } catch(e) {} };
    }, [namespace, socket]);

    // Phase 3: Screening-Hints aus ioBroker State laden
    useEffect(() => {
        const screenId = `${namespace}.analysis.health.screening.hints`;
        socket.getState(screenId).then((s: any) => {
            if (s?.val) { try { setScreeningResult(JSON.parse(s.val)); } catch(e) {} }
        }).catch(() => {});
        const screenHandler = (_id: string, state: any) => {
            if (state?.val) { try { setScreeningResult(JSON.parse(state.val)); } catch(e) {} }
        };
        socket.subscribeState(screenId, screenHandler);
        return () => { try { socket.unsubscribeState(screenId, screenHandler); } catch(e) {} };
    }, [namespace, socket]);

    const devices: DeviceConfig[] = useMemo(() => native?.devices || [], [native]);

    const healthProfiles: Record<string, { enabled: boolean }> = useMemo(() => {
        const defaults: Record<string, { enabled: boolean }> = {};
        DISEASE_PROFILES.forEach(p => { defaults[p.id] = { enabled: false }; });
        return { ...defaults, ...(native?.healthProfiles || {}) };
    }, [native]);

    const validations = useMemo(() => validateAllProfiles(devices), [devices]);

    const enabledProfiles = useMemo(() =>
        DISEASE_PROFILES.filter(p => healthProfiles[p.id]?.enabled),
        [healthProfiles]
    );

    const handleToggle = (profileId: string, val: boolean) => {
        const current = native?.healthProfiles || {};
        const updated = { ...current, [profileId]: { ...(current[profileId] || {}), enabled: val } };
        onChange('healthProfiles', updated);
        if (val && selectedProfileId === null) setSelectedProfileId(profileId);
    };

    const selectedProfile = selectedProfileId ? PROFILE_BY_ID[selectedProfileId] : null;
    const selectedValidation = selectedProfileId ? validations[selectedProfileId] : null;

    const groupedProfiles = useMemo(() => {
        const groups: Record<string, DiseaseProfile[]> = { senior: [], adult: [], child: [], all: [] };
        DISEASE_PROFILES.forEach(p => groups[p.targetGroup]?.push(p));
        return groups;
    }, []);

    const sidebarWidth = 320;

    return (
        <Box sx={{ display: 'flex', height: 'calc(100vh - 120px)', minHeight: 600 }}>

            {/* -- SIDEBAR ----------------------------------------- */}
            <Box sx={{
                width: sidebarWidth, flexShrink: 0, overflowY: 'auto', p: 2,
                borderRight: `1px solid ${isDark ? '#333' : '#ddd'}`,
                bgcolor: isDark ? '#161616' : '#f7f7f7'
            }}>
                <Box sx={{ mb: 2 }}>
                    <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocalHospitalIcon color="error" fontSize="small" />
                        Krankheitsbilder
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {enabledProfiles.length} von {DISEASE_PROFILES.length} aktiv
                    </Typography>
                    {devices.length === 0 && (
                        <Alert severity="warning" sx={{ mt: 1, py: 0.5 }}>
                            Keine Sensoren konfiguriert. Bitte zuerst im System-Tab Sensoren hinzufuegen.
                        </Alert>
                    )}
                </Box>

                {/* Proaktives Screening Button */}
                <Card
                    onClick={() => setSelectedProfileId('screening')}
                    sx={{
                        mb: 2, cursor: 'pointer', transition: 'all 0.2s',
                        border: selectedProfileId === 'screening' ? '2px solid #7b1fa2' : ` 1px solid ${isDark ? '#333' : '#ddd'} `,
                        bgcolor: selectedProfileId === 'screening' ? (isDark ? '#7b1fa215' : '#7b1fa208') : (isDark ? '#1e1e1e' : '#fff'),
                        '&:hover': { transform: 'translateX(2px)', borderColor: '#7b1fa2' }
                    }}
                    elevation={selectedProfileId === 'screening' ? 3 : 1}
                >
                    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TroubleshootIcon fontSize="small" sx={{ color: '#7b1fa2' }} />
                            <Typography variant="body2" fontWeight={selectedProfileId === 'screening' ? 'bold' : 'normal'}
                                sx={{ flexGrow: 1, color: selectedProfileId === 'screening' ? '#7b1fa2' : 'text.primary' }}>
                                Proaktives Screening
                            </Typography>
                            {screeningResult && screeningResult.hints && screeningResult.hints.length > 0 && (
                                <Badge badgeContent={screeningResult.hints.length} color="warning" />
                            )}
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ pl: 3.5, display: 'block', mt: 0.3 }}>
                            Automatische Muster-Erkennung
                        </Typography>
                    </CardContent>
                </Card>
                <Divider sx={{ mb: 2 }} />

                {(['senior', 'adult', 'child', 'all'] as const).map(group => {
                    const profiles = groupedProfiles[group];
                    if (!profiles.length) return null;
                    return (
                        <Box key={group} sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, px: 0.5 }}>
                                {TARGET_GROUP_ICONS[group]}
                                <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                    {TARGET_GROUP_LABELS[group]}
                                </Typography>
                            </Box>
                            {profiles.map(profile => (
                                <DiseaseCard
                                    key={profile.id}
                                    profile={profile}
                                    enabled={!!healthProfiles[profile.id]?.enabled}
                                    validation={validations[profile.id]}
                                    selected={selectedProfileId === profile.id}
                                    onToggle={handleToggle}
                                    onSelect={setSelectedProfileId}
                                    isDark={isDark}
                                />
                            ))}
                        </Box>
                    );
                })}
            </Box>

            {/* -- MAIN PANEL ----------------------------------------- */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 3 }}>
                {selectedProfileId === 'screening' && (
                    <ScreeningPanel
                        result={screeningResult}
                        isDark={isDark}
                        enabledProfiles={enabledProfiles.map(p => p.id)}
                    />
                )}
                {selectedProfileId !== 'screening' && !selectedProfile && <WelcomeScreen isDark={isDark} />}
                {selectedProfileId !== 'screening' && selectedProfile && selectedValidation && (
                    <>
                        <DiseaseDashboard
                            profile={selectedProfile}
                            validation={selectedValidation}
                            isDark={isDark}
                            diseaseScore={selectedProfileId ? (diseaseScores[selectedProfileId] ?? null) : null}
                        />
                        {selectedProfileId === 'diabetes1' && (
                            <CgmCorrelationPanel
                                socket={socket}
                                adapterName={adapterName}
                                instance={instance}
                                native={native}
                                isDark={isDark}
                            />
                        )}
                    </>
                )}
            </Box>
        </Box>
    );
}
