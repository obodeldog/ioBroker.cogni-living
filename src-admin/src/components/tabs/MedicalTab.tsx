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
                    <DiseaseDashboard
                        profile={selectedProfile}
                        validation={selectedValidation}
                        isDark={isDark}
                        diseaseScore={selectedProfileId ? (diseaseScores[selectedProfileId] ?? null) : null}
                    />
                )}
            </Box>
        </Box>
    );
}
