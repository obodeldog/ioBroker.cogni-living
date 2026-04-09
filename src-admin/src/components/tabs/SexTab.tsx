import React, { useState, useEffect } from 'react';
import { Tooltip as MuiTooltip, IconButton } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

// ─────────────────────────────────────────────────────────────────────────────
// Typen
// ─────────────────────────────────────────────────────────────────────────────
interface IntimacySlot {
    start: number;
    strMax: number;
    strAvg: number;
    trigCnt: number;
}
interface IntimacyEvent {
    start: number;
    end: number;
    duration: number;
    score: number;
    type: 'vaginal' | 'oral_hand' | 'intim';
    peakStrength: number;
    avgStrength: number;
    avgTrigger: number;
    garminHRMax: number | null;
    garminHRAvg: number | null;
    slots: IntimacySlot[];
}
interface SexTabProps {
    socket: any;
    adapterName: string;
    instance: number;
    themeType: string;
    native: Record<string, any>;
    onChange: (attr: string, value: any) => void;
}

/** Manuelle Ground-Truth-Einträge (Einstellungen → JSON) — für Abgleich & spätere Kalibrierung */
interface SexTrainingLabel {
    date: string;
    time?: string;
    durationMin?: number;
    type: string;
}

function parseSexTrainingLabels(raw: unknown): SexTrainingLabel[] {
    if (raw == null || typeof raw !== 'string' || !String(raw).trim()) return [];
    try {
        const j = JSON.parse(String(raw));
        if (!Array.isArray(j)) return [];
        return j.filter((x: any) => x && typeof x.date === 'string');
    } catch {
        return [];
    }
}

function labelMatchesDetection(l: SexTrainingLabel, events: IntimacyEvent[]): boolean {
    if (!l.time || !/^\d{1,2}:\d{2}$/.test(l.time)) return events.length > 0;
    const [hh, mm] = l.time.split(':').map(Number);
    const t0 = new Date(l.date + 'T00:00:00');
    t0.setHours(hh, mm, 0, 0);
    const ms = t0.getTime();
    return events.some((e) => Math.abs(e.start - ms) < 60 * 60000);
}

function saveSexLabels(labels: SexTrainingLabel[], onChange: (attr: string, val: any) => void) {
    onChange('sexTrainingLabels', JSON.stringify(labels, null, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
const dateStr  = (d: Date) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');

// Fun-Kommentare nach Typ + Score
// Zyklus-Phase für ein Datum berechnen (aus native config)
function getZyklusPhaseForDate(date: Date, native: Record<string, any>): { phase: string; tag: number; emoji: string } | null {
    try {
        const rawDaten = native.zyklusStartDaten || '';
        if (!native.moduleZyklus || !rawDaten) return null;
        const dates = rawDaten.split(',')
            .map((s: string) => s.trim())
            .filter((s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s))
            .map((s: string) => new Date(s + 'T06:00:00'))
            .filter((d: Date) => !isNaN(d.getTime()) && d <= date)
            .sort((a: Date, b: Date) => b.getTime() - a.getTime());
        if (dates.length === 0) return null;

        const allDates = rawDaten.split(',')
            .map((s: string) => s.trim())
            .filter((s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s))
            .map((s: string) => new Date(s + 'T06:00:00'))
            .filter((d: Date) => !isNaN(d.getTime()))
            .sort((a: Date, b: Date) => b.getTime() - a.getTime());

        const defaultLen = parseInt(native.zyklusLaenge) || 28;
        const diffs: number[] = [];
        for (let i = 0; i < allDates.length - 1; i++) {
            const diff = Math.round((allDates[i].getTime() - allDates[i + 1].getTime()) / 86400000);
            if (diff >= 21 && diff <= 45) diffs.push(diff);
        }
        const zyklusLen = diffs.length > 0 ? Math.round(diffs.reduce((a: number, b: number) => a + b, 0) / diffs.length) : defaultLen;

        const lastStart = dates[0];
        const tag = Math.max(1, Math.floor((date.getTime() - lastStart.getTime()) / 86400000) + 1);
        if (tag > zyklusLen + 7) return null;

        const ovDay = zyklusLen - 14;
        const fertileStart = Math.max(ovDay - 5, 6);
        const pmsStart = zyklusLen - 4;

        if (tag <= 5) return { phase: 'menstruation', tag, emoji: '🩸' };
        if (tag >= pmsStart) return { phase: 'pms', tag, emoji: '😤' };
        if (tag === ovDay || tag === ovDay + 1) return { phase: 'eisprung', tag, emoji: '🥚' };
        if (tag >= fertileStart && tag <= ovDay + 1) return { phase: 'fruchtbar', tag, emoji: '🌿' };
        if (tag > ovDay + 1) return { phase: 'luteal', tag, emoji: '💜' };
        return { phase: 'follikel', tag, emoji: '📈' };
    } catch { return null; }
}

const getFunComment = (evt: IntimacyEvent, native?: Record<string, any>): string => {
    const s = evt.score;
    const hr = evt.garminHRMax;
    const zyklus = native ? getZyklusPhaseForDate(new Date(evt.start), native) : null;

    // Zyklus-spezifische Kommentare (haben Priorität bei interessanten Phasen)
    if (zyklus && native?.sexFunMode !== false) {
        if (zyklus.phase === 'eisprung') {
            if (evt.type === 'oral_hand') return `🥚 Zyklustag ${zyklus.tag} — Eisprung! Nur Oral/Hand heute? Ihr wisst was ihr tut. 😏 Clever.`;
            if (evt.type === 'vaginal') return `🥚💕 Zyklustag ${zyklus.tag} — Eisprung + Vaginal. Der Sensor tippt auf Familienplanung (oder Glück). 👶❓`;
        }
        if (zyklus.phase === 'fruchtbar') {
            if (evt.type === 'oral_hand') return `🌿 Fruchtbares Fenster, Tag ${zyklus.tag}. Nur Oral/Hand — bewusster Umgang mit der Biologie. Respekt! 👍`;
            if (evt.type === 'vaginal') return `🌿 Fruchtbares Fenster! Vaginal-Session an Tag ${zyklus.tag}. Sensor schweigt diskret zu möglichen Konsequenzen. 🍼`;
        }
        if (zyklus.phase === 'menstruation') {
            return `🩸 Zyklustag ${zyklus.tag} — Menstruationsphase. Trotzdem aktiv! Red ist offenbar nur eine Farbe. Respekt. ❤️`;
        }
        if (zyklus.phase === 'pms') {
            return `😤 PMS-Phase (Tag ${zyklus.tag}) — trotzdem intime Aktivität! Hormone konnten euch nicht aufhalten. Stark. 💪`;
        }
        if (zyklus.phase === 'luteal') {
            return `💜 Lutealphase, Tag ${zyklus.tag}. Progesteron dominiert — und ihr trotzdem. Der Sensor ist beeindruckt.${hr ? ` HR: ${hr} bpm.` : ''}`;
        }
    }

    if (evt.type === 'vaginal') {
        if (s >= 85) return `🔥 Rekord-Session! Peak-Stärke ${evt.peakStrength}${hr ? ` · HR bis ${hr} bpm` : ''}. Der Sensor ist beeindruckt und leicht überwältigt.`;
        if (s >= 70) return `💕 Intensive vaginal-Session (${evt.duration} Min). ${hr ? `Garmin sagt: ${hr} bpm Max — ordentlich!` : 'Sensor nickt respektvoll.'}`;
        return `💗 Schöne Session${hr ? ` · HR: ${hr} bpm` : ''}. Vaginal mit guter Matratzen-Übertragung.`;
    }
    if (evt.type === 'oral_hand') {
        if (s >= 70) return `💜 Oral/Hand — gleichmäßig über ${evt.duration} Min. ${hr && hr > 100 ? `Herzrate ${hr} bpm — auch ohne Penetration kein Sport-Halfday. 😄` : 'Lateral und doch überzeugend.'}`;
        if (evt.duration >= 60) return `💙 Ausdauer! ${evt.duration} Min Oral/Hand — der Sensor hat mitgezählt (leicht neidisch).`;
        return `💙 Kurze aber feine Einheit (${evt.duration} Min, oral/hand). Qualität > Quantität!`;
    }
    if (s >= 70) return `💜 Intime Aktivität erkannt — ${evt.duration} Min, Score ${s}. ${hr ? `HR: ${hr} bpm.` : 'Typ-Klassifikation: zu diskret für den Sensor.'}`;
    return `🤍 Intime Aktivität (${evt.duration} Min). Der Sensor hält diskret die Klappe.`;
};

const getNoActivityComment = (daysSince: number | null): string => {
    if (daysSince === null) return '😴 Noch keine Daten — Sensor wartet geduldig. Viel Spaß beim Befüllen der Statistik.';
    if (daysSince === 0)    return '😴 Heute noch keine Aktivität erkannt — der Tag ist aber noch jung!';
    if (daysSince === 1)    return '💤 Gestern war die letzte Session. Heute: Ruhetag oder Sofa? Der Sensor fragt vorsichtig nach.';
    if (daysSince <= 3)    return `💤 Letzte Session vor ${daysSince} Tagen. Sensor vermisst die Daten leicht.`;
    return `😶 ${daysSince} Tage seit der letzten Aktivität. Der Sensor ist neutral — aber er hat Zeit.`;
};

// Slot-Farbe nach Stärke
const slotColor = (max: number): string => {
    if (max >= 90) return '#e91e63';
    if (max >= 70) return '#c2185b';
    if (max >= 50) return '#9c27b0';
    if (max >= 30) return '#7b1fa2';
    return '#4a148c';
};

// Typ-Label
const typeLabel = (type: string): string => {
    if (type === 'vaginal')   return '♥ Vaginal';
    if (type === 'oral_hand') return '◐ Oral / Hand';
    return '⬡ Intim';
};
const typeBg = (type: string, isDark: boolean): string => {
    if (type === 'vaginal')   return isDark ? '#880e4f' : '#fce4ec';
    if (type === 'oral_hand') return isDark ? '#1a237e' : '#e8eaf6';
    return isDark ? '#212121' : '#f5f5f5';
};
const typeColor = (type: string, isDark: boolean): string => {
    if (type === 'vaginal')   return isDark ? '#f48fb1' : '#c2185b';
    if (type === 'oral_hand') return isDark ? '#90caf9' : '#283593';
    return isDark ? '#888' : '#555';
};

// ─────────────────────────────────────────────────────────────────────────────
// TerminalBox (identisch zu HealthTab)
// ─────────────────────────────────────────────────────────────────────────────
const TerminalBox = ({ title, children, themeType, helpText, style }: {
    title: string; children: React.ReactNode; themeType: string; helpText?: string; style?: React.CSSProperties;
}) => {
    const isDark = themeType === 'dark';
    return (
        <div style={{
            border: `1px solid ${isDark ? '#444' : '#bbb'}`,
            backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
            color: isDark ? '#eee' : '#111',
            fontFamily: "'Roboto Mono','Courier New',monospace",
            marginBottom: '20px',
            boxShadow: isDark ? 'none' : '2px 2px 0px rgba(0,0,0,0.1)',
            ...(style || {})
        }}>
            <div style={{
                backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0',
                borderBottom: `1px solid ${isDark ? '#444' : '#bbb'}`,
                padding: '4px 8px', color: isDark ? '#888' : '#666',
                fontSize: '0.75rem', fontWeight: 'bold',
                letterSpacing: '1px', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <span>[ {title} ]</span>
                {helpText && (
                    <MuiTooltip title={<span style={{ fontSize: '0.75rem', lineHeight: 1.5, display: 'block', maxWidth: 280 }}>{helpText}</span>} placement="top" arrow>
                        <IconButton size="small" sx={{ p: 0, ml: 0.5, opacity: 0.4, '&:hover': { opacity: 1 }, color: isDark ? '#888' : '#666' }}>
                            <HelpOutlineIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                    </MuiTooltip>
                )}
            </div>
            <div style={{ padding: '12px', flex: 1 }}>{children}</div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Score-Kreis
// ─────────────────────────────────────────────────────────────────────────────
const ScoreCircle = ({ score, isDark }: { score: number; isDark: boolean }) => {
    const color = score >= 80 ? '#e91e63' : score >= 60 ? '#ab47bc' : '#7b1fa2';
    return (
        <div style={{
            width: 70, height: 70, borderRadius: '50%',
            border: `3px solid ${color}`, flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color, lineHeight: 1 }}>{score}</span>
            <span style={{ fontSize: '0.42rem', color: isDark ? '#888' : '#aaa', marginTop: 2 }}>INTIM-SCORE</span>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Intensitäts-Balken (wie OBE-Bar in HealthTab)
// ─────────────────────────────────────────────────────────────────────────────
const IntimacyBar = ({ evt, isDark }: { evt: IntimacyEvent; isDark: boolean }) => {
    // Fenster: 2h vor Event-Start bis 2h nach Event-Ende, min. 4h Breite
    const rawStart = evt.start - 2 * 3600000;
    const rawEnd   = evt.end   + 2 * 3600000;
    const winDur   = Math.max(rawEnd - rawStart, 4 * 3600000);
    // Auf volle Stunden runden für schöne Achse
    const winStart = new Date(rawStart); winStart.setMinutes(0, 0, 0);
    const winStartMs = winStart.getTime();
    const tickCount = Math.round(winDur / 3600000) + 1;
    const ticks = Array.from({ length: tickCount }, (_, i) => winStartMs + i * 3600000);

    return (
        <div>
            <div style={{ fontSize: '0.55rem', color: isDark ? '#555' : '#aaa', marginBottom: 3 }}>
                INTENSITÄTS-VERLAUF (5-Min-Slots)
            </div>
            <div style={{ position: 'relative', height: 28, background: isDark ? '#111' : '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                {evt.slots.map((sl, i) => {
                    const left = ((sl.start - winStartMs) / winDur) * 100;
                    const width = Math.max(0.5, (15 * 60000 / winDur) * 100);
                    if (left < -2 || left > 102) return null;
                    return (
                        <div key={i} style={{
                            position: 'absolute', left: `${Math.max(0, left)}%`, width: `${width}%`,
                            top: 0, height: '100%', background: slotColor(sl.strMax),
                            opacity: sl.strMax > 0 ? 0.85 : 0.2
                        }} title={`${fmtTime(sl.start)}: Peak ${sl.strMax}, Trig ${sl.trigCnt}`} />
                    );
                })}
                {/* Start-Markierung */}
                <div style={{
                    position: 'absolute',
                    left: `${Math.max(0, ((evt.start - winStartMs) / winDur) * 100)}%`,
                    top: 0, width: 2, height: '100%', background: '#f48fb1', opacity: 0.9
                }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.48rem', color: isDark ? '#444' : '#aaa', marginTop: 2 }}>
                {ticks.slice(0, 5).map((t, i) => <span key={i}>{fmtTime(t).slice(0,5)}</span>)}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Einzeltag-Kachel
// ─────────────────────────────────────────────────────────────────────────────
const SexDayCard = ({ events, dateLabel, themeType, funMode, native }: {
    events: IntimacyEvent[]; dateLabel: string; themeType: string; funMode: boolean; native?: Record<string, any>;
}) => {
    const isDark = themeType === 'dark';
    const dividerColor = isDark ? '#222' : '#eee';

    if (events.length === 0) {
        return (
            <TerminalBox title={`SEX — ${dateLabel}`} themeType={themeType}>
                <div style={{ textAlign: 'center', padding: '16px 8px' }}>
                    <div style={{ fontSize: '1.6rem', marginBottom: 8, opacity: 0.3 }}>💤</div>
                    <div style={{ fontSize: '0.85rem', color: isDark ? '#444' : '#ccc', marginBottom: 6 }}>
                        Keine Aktivität erkannt
                    </div>
                    {funMode && (
                        <div style={{
                            background: isDark ? '#0d1a0d' : '#f1f8e9', border: `1px solid ${isDark ? '#1b5e20' : '#c8e6c9'}`,
                            borderRadius: 4, padding: '8px 10px', fontSize: '0.7rem',
                            color: isDark ? '#81c784' : '#2e7d32', fontStyle: 'italic', marginTop: 8
                        }}>
                            {getNoActivityComment(0)}
                        </div>
                    )}
                </div>
            </TerminalBox>
        );
    }

    const evt = events[0]; // primäres Event (höchster Score)
    return (
        <TerminalBox title={`SEX — ${dateLabel}`} themeType={themeType}
            helpText="Erkennt intime Aktivitäten anhand des Vibrationssensors (16:00–02:00 Uhr). Score: Stärke 50% + Dichte 30% + Dauer 20%. Typ-Klassifikation: niedrige Konfidenz. Kein Medizinprodukt.">
            {/* Score + Meta */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                <ScoreCircle score={evt.score} isDark={isDark} />
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.65rem', color: isDark ? '#888' : '#aaa', marginBottom: 3 }}>ERKANNTE AKTIVITÄT</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: 4 }}>
                        {fmtTime(evt.start)} — {fmtTime(evt.end)}
                        <span style={{ fontSize: '0.6rem', color: isDark ? '#666' : '#aaa', marginLeft: 8 }}>~{evt.duration} Min</span>
                    </div>
                    <div>
                        <span style={{
                            display: 'inline-block', padding: '1px 7px', borderRadius: 3,
                            fontSize: '0.6rem', fontWeight: 'bold', marginRight: 5,
                            background: typeBg(evt.type, isDark), color: typeColor(evt.type, isDark)
                        }}>{typeLabel(evt.type)}</span>
                        <span style={{
                            display: 'inline-block', padding: '1px 7px', borderRadius: 3,
                            fontSize: '0.6rem', background: isDark ? '#1b5e20' : '#e8f5e9', color: isDark ? '#a5d6a7' : '#1b5e20'
                        }}>✓ Bestätigt</span>
                    </div>
                    <div style={{ marginTop: 5, fontSize: '0.55rem', color: isDark ? '#555' : '#aaa' }}>
                        Peak: <span style={{ color: '#ab47bc' }}>{evt.peakStrength}</span> ·
                        Dichte: <span style={{ color: '#ab47bc' }}>{evt.avgTrigger}/5min</span> ·
                        {evt.slots.length} Slots aktiv
                    </div>
                </div>
            </div>

            {/* Intensitäts-Balken */}
            <IntimacyBar evt={evt} isDark={isDark} />

            {/* Mehrere Events an einem Tag */}
            {events.length > 1 && (
                <div style={{ fontSize: '0.6rem', color: isDark ? '#666' : '#aaa', marginTop: 6, fontStyle: 'italic' }}>
                    +{events.length - 1} weitere Session(s) heute
                </div>
            )}

            <div style={{ borderTop: `1px dashed ${dividerColor}`, margin: '8px 0' }} />

            {/* Fun-Kommentar */}
            {funMode && (
                <div style={{
                    background: isDark ? '#130d1a' : '#f3e5f5',
                    border: `1px solid ${isDark ? '#6a1b9a' : '#ce93d8'}`,
                    borderRadius: 4, padding: '8px 10px', fontSize: '0.72rem',
                    color: isDark ? '#ce93d8' : '#6a1b9a', fontStyle: 'italic', marginBottom: 8
                }}>
                    {getFunComment(evt, native)}
                </div>
            )}

            {/* Garmin HR */}
            {(evt.garminHRMax !== null || evt.garminHRAvg !== null) ? (
                <>
                    <div style={{ fontSize: '0.55rem', color: isDark ? '#555' : '#aaa', marginBottom: 4 }}>⌚ GARMIN HERZFREQUENZ</div>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <div>
                            <div style={{ fontSize: '0.5rem', color: isDark ? '#555' : '#aaa', textTransform: 'uppercase' }}>Max HR</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#ef5350' }}>{evt.garminHRMax} bpm</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.5rem', color: isDark ? '#555' : '#aaa', textTransform: 'uppercase' }}>Ø HR (Fenster)</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#ff7043' }}>{evt.garminHRAvg} bpm</div>
                        </div>
                    </div>
                </>
            ) : (
                <div style={{ fontSize: '0.55rem', color: isDark ? '#333' : '#ccc' }}>
                    ⌚ Garmin: kein HR-Signal im Aktivitätsfenster
                </div>
            )}
        </TerminalBox>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// 7-Tage-History
// ─────────────────────────────────────────────────────────────────────────────
const SevenDayHistory = ({ historyDays, themeType, funMode }: {
    historyDays: Array<{ dateStr: string; label: string; events: IntimacyEvent[] }>;
    themeType: string; funMode: boolean;
}) => {
    const isDark = themeType === 'dark';
    const withEvents = historyDays.filter(d => d.events.length > 0);
    const weekCount  = withEvents.length;
    const avgScore   = weekCount > 0 ? Math.round(withEvents.reduce((a, d) => a + d.events[0].score, 0) / weekCount) : null;
    const avgDur     = weekCount > 0 ? Math.round(withEvents.reduce((a, d) => a + d.events[0].duration, 0) / weekCount) : null;

    // Letzte Aktivität: wie viele Tage her?
    let daysSince: number | null = null;
    for (let i = historyDays.length - 1; i >= 0; i--) {
        if (historyDays[i].events.length > 0) { daysSince = historyDays.length - 1 - i; break; }
    }

    return (
        <TerminalBox title="SEX — 7 TAGE" themeType={themeType}>
            {/* Tages-Dots */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${historyDays.length}, 1fr)`, gap: 6, textAlign: 'center', marginBottom: 12 }}>
                {historyDays.map((day, i) => {
                    const hasEvt  = day.events.length > 0;
                    const isToday = i === historyDays.length - 1;
                    const evt     = hasEvt ? day.events[0] : null;
                    const dotColor = !hasEvt ? (isDark ? '#1a1a1a' : '#f0f0f0') :
                        evt!.type === 'vaginal' ? '#880e4f' : '#4a148c';
                    const dotBorder = !hasEvt ? `1px dashed ${isDark ? '#2a2a2a' : '#ddd'}` :
                        evt!.type === 'vaginal' ? '1px solid #c2185b' : '1px solid #7b1fa2';
                    return (
                        <div key={i}>
                            <div style={{ fontSize: '0.52rem', color: isDark ? (isToday ? '#888' : '#444') : (isToday ? '#666' : '#bbb'), marginBottom: 3 }}>
                                {day.label}
                            </div>
                            <div style={{
                                width: 24, height: 24, borderRadius: '50%',
                                background: dotColor, border: dotBorder,
                                margin: '0 auto 3px', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.7rem'
                            }}>
                                {hasEvt ? (evt!.type === 'vaginal' ? '♥' : '💜') : (isToday ? '?' : '—')}
                            </div>
                            {hasEvt && (
                                <>
                                    <div style={{ fontSize: '0.58rem', color: isDark ? '#ce93d8' : '#7b1fa2', fontWeight: 'bold' }}>{evt!.score}</div>
                                    <div style={{ fontSize: '0.45rem', color: isDark ? '#555' : '#aaa' }}>{fmtTime(evt!.start).slice(0,5)}</div>
                                    <div style={{ fontSize: '0.4rem', color: isDark ? '#444' : '#bbb' }}>{evt!.duration} Min</div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            <div style={{ borderTop: `1px dashed ${isDark ? '#222' : '#eee'}`, margin: '8px 0' }} />

            {/* Wochenstatistik */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
                {[
                    { lbl: 'DIESE WOCHE', val: weekCount > 0 ? `${weekCount}× bestätigt` : '0 Sessions', col: '#ab47bc' },
                    { lbl: 'Ø DAUER', val: avgDur !== null ? `~${avgDur} Min` : '—', col: '#ab47bc' },
                    { lbl: 'Ø SCORE', val: avgScore !== null ? `${avgScore} / 100` : '—', col: '#ab47bc' },
                    { lbl: 'ZULETZT', val: daysSince !== null ? (daysSince === 0 ? 'heute' : `vor ${daysSince}d`) : '—', col: isDark ? '#888' : '#aaa' }
                ].map(m => (
                    <div key={m.lbl}>
                        <div style={{ fontSize: '0.5rem', color: isDark ? '#555' : '#aaa', textTransform: 'uppercase', marginBottom: 2 }}>{m.lbl}</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: m.col }}>{m.val}</div>
                    </div>
                ))}
            </div>

            {/* Fun-Wochenkommentar */}
            {funMode && (
                <div style={{
                    background: isDark ? '#130d1a' : '#f3e5f5',
                    border: `1px solid ${isDark ? '#4a148c' : '#ce93d8'}`,
                    borderRadius: 4, padding: '8px 10px', fontSize: '0.7rem',
                    color: isDark ? '#ce93d8' : '#6a1b9a', fontStyle: 'italic'
                }}>
                    {weekCount === 0 && '😴 Ruhige Woche. Der Vibrationssensor hat reichlich Schlaf-Phasen analysiert. Kein Vorwurf.'}
                    {weekCount === 1 && `💜 Eine Session diese Woche — Qualität zählt! Letzte: ${withEvents[0]?.label}, Score ${withEvents[0]?.events[0].score}.`}
                    {weekCount === 2 && `💕 Zwei Sessions — schöne Frequenz! Ø Score ${avgScore}. Der Sensor ist zufrieden.`}
                    {weekCount >= 3 && weekCount <= 4 && `🔥 ${weekCount} Sessions diese Woche — aktiv! Ø Score ${avgScore}, Ø ${avgDur} Min. Sensor-Kommentar: beeindruckend.`}
                    {weekCount >= 5 && `🏆 ${weekCount} Sessions! Der Sensor fragt diskret: Schläft ihr überhaupt? (Ø Score ${avgScore}).`}
                </div>
            )}
        </TerminalBox>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Training-Label-Formular
// ─────────────────────────────────────────────────────────────────────────────
const LabelForm = ({ native, onChange, themeType, dayData }: {
    native: Record<string, any>;
    onChange: (attr: string, val: any) => void;
    themeType: string;
    dayData: Record<string, IntimacyEvent[]>;
}) => {
    const isDark = themeType === 'dark';
    const today = dateStr(new Date());
    const [formDate, setFormDate] = useState(today);
    const [formTime, setFormTime] = useState('');
    const [formDuration, setFormDuration] = useState('');
    const [formType, setFormType] = useState<'vaginal' | 'oral_hand' | 'none'>('oral_hand');

    const labels = parseSexTrainingLabels(native.sexTrainingLabels);

    const handleAdd = () => {
        if (!formDate) return;
        const entry: SexTrainingLabel = { date: formDate, type: formType };
        if (formTime) entry.time = formTime;
        if (formDuration && parseInt(formDuration) > 0) entry.durationMin = parseInt(formDuration);
        const updated = [...labels, entry].sort((a, b) => b.date.localeCompare(a.date));
        saveSexLabels(updated, onChange);
        setFormTime('');
        setFormDuration('');
    };

    const handleDelete = (idx: number) => {
        const updated = labels.filter((_, i) => i !== idx);
        saveSexLabels(updated, onChange);
    };

    const inputStyle = {
        background: isDark ? '#1a1a1a' : '#fff',
        color: isDark ? '#eee' : '#111',
        border: `1px solid ${isDark ? '#444' : '#ccc'}`,
        borderRadius: 3, padding: '4px 8px',
        fontFamily: 'monospace', fontSize: '0.72rem',
    };
    const selectStyle = { ...inputStyle, cursor: 'pointer' };

    return (
        <TerminalBox title="SESSION EINTRAGEN" themeType={themeType}
            helpText="Trage bekannte Sessions manuell ein. Das System lernt daraus die typische Vibrationsstärke deines Sensors (Kalibrierung). Eine Handvoll Einträge reicht für gute Erkennung.">
            {/* Formular */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
                <div>
                    <div style={{ fontSize: '0.5rem', color: isDark ? '#555' : '#aaa', marginBottom: 3 }}>DATUM</div>
                    <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                        style={{ ...inputStyle, width: 130 }} />
                </div>
                <div>
                    <div style={{ fontSize: '0.5rem', color: isDark ? '#555' : '#aaa', marginBottom: 3 }}>UHRZEIT (ca.)</div>
                    <input type="time" value={formTime} onChange={e => setFormTime(e.target.value)}
                        style={{ ...inputStyle, width: 100 }} />
                </div>
                <div>
                    <div style={{ fontSize: '0.5rem', color: isDark ? '#555' : '#aaa', marginBottom: 3 }}>DAUER (Min, opt.)</div>
                    <input type="number" value={formDuration} onChange={e => setFormDuration(e.target.value)}
                        min={1} max={180} placeholder="—"
                        style={{ ...inputStyle, width: 80 }} />
                </div>
                <div>
                    <div style={{ fontSize: '0.5rem', color: isDark ? '#555' : '#aaa', marginBottom: 3 }}>TYP</div>
                    <select value={formType} onChange={e => setFormType(e.target.value as any)} style={{ ...selectStyle, width: 130 }}>
                        <option value="vaginal">♥ Vaginal</option>
                        <option value="oral_hand">◐ Oral / Hand</option>
                        <option value="none">⬡ Sonstiges</option>
                    </select>
                </div>
                <button onClick={handleAdd}
                    style={{
                        background: isDark ? '#1a2e1a' : '#e8f5e9',
                        color: isDark ? '#81c784' : '#1b5e20',
                        border: `1px solid ${isDark ? '#2e7d32' : '#a5d6a7'}`,
                        borderRadius: 4, padding: '5px 14px',
                        fontFamily: 'monospace', fontSize: '0.72rem',
                        cursor: 'pointer', fontWeight: 700, letterSpacing: 1,
                        alignSelf: 'flex-end',
                    }}>
                    + SPEICHERN
                </button>
            </div>

            {/* Liste der eingetragenen Labels */}
            {labels.length === 0 ? (
                <div style={{ fontSize: '0.65rem', color: isDark ? '#444' : '#bbb', fontStyle: 'italic' }}>
                    Noch keine Einträge — trage 3–5 bekannte Sessions ein, damit der Algorithmus lernen kann.
                </div>
            ) : (
                <div>
                    <div style={{ fontSize: '0.5rem', color: isDark ? '#444' : '#bbb', marginBottom: 6, letterSpacing: 1 }}>
                        EINGETRAGENE SESSIONS ({labels.length})
                    </div>
                    {labels.map((l, i) => {
                        const dayEv = dayData[l.date] ?? [];
                        const ok = labelMatchesDetection(l, dayEv);
                        const hasData = dayData[l.date] !== undefined;
                        return (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5,
                                padding: '5px 8px',
                                background: isDark ? '#0d1117' : '#f9f9f9',
                                borderLeft: `3px solid ${hasData ? (ok ? '#81c784' : '#ffb74d') : (isDark ? '#333' : '#ddd')}`,
                                borderRadius: '0 4px 4px 0',
                            }}>
                                <span style={{ fontSize: '0.7rem', minWidth: 18, color: hasData ? (ok ? '#81c784' : '#ffb74d') : (isDark ? '#444' : '#bbb') }}>
                                    {hasData ? (ok ? '✓' : '⚠') : '·'}
                                </span>
                                <span style={{ fontSize: '0.68rem', flex: 1, color: isDark ? '#ccc' : '#444' }}>
                                    <b>{l.date}</b>
                                    {l.time && <span style={{ color: isDark ? '#888' : '#999' }}> · {l.time}</span>}
                                    {l.durationMin != null && <span style={{ color: isDark ? '#888' : '#999' }}> · ~{l.durationMin} Min</span>}
                                    <span style={{
                                        marginLeft: 8, padding: '1px 6px', borderRadius: 3, fontSize: '0.58rem',
                                        background: l.type === 'vaginal' ? (isDark ? '#880e4f' : '#fce4ec') : (isDark ? '#1a237e' : '#e8eaf6'),
                                        color: l.type === 'vaginal' ? (isDark ? '#f48fb1' : '#c2185b') : (isDark ? '#90caf9' : '#283593'),
                                    }}>{l.type === 'vaginal' ? '♥ vaginal' : l.type === 'oral_hand' ? '◐ oral/hand' : '⬡ sonstiges'}</span>
                                </span>
                                <button onClick={() => handleDelete(i)} style={{
                                    background: 'transparent', border: 'none', color: isDark ? '#555' : '#bbb',
                                    cursor: 'pointer', fontSize: '0.8rem', padding: '0 4px', lineHeight: 1,
                                }} title="Löschen">✕</button>
                            </div>
                        );
                    })}
                    <div style={{ marginTop: 8, fontSize: '0.55rem', color: isDark ? '#333' : '#bbb' }}>
                        ✓ = vom Sensor erkannt · ⚠ = nicht erkannt (Sensor ggf. neu kalibrieren) · · = kein Datentag geladen
                    </div>
                </div>
            )}
        </TerminalBox>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Haupt-Komponente SexTab
// ─────────────────────────────────────────────────────────────────────────────
const SexTab: React.FC<SexTabProps> = ({ socket, adapterName, instance, themeType, native, onChange }) => {
    const isDark = themeType === 'dark';
    const funMode = native.sexFunMode !== false;

    const [cacheGen] = useState(0);

    // Datums-Navigation
    const [viewDate, setViewDate] = useState<Date>(() => {
        const d = new Date(); d.setHours(0, 0, 0, 0); return d;
    });

    // Geladene Daten: { [dateStr]: IntimacyEvent[] }
    const [dayData, setDayData] = useState<Record<string, IntimacyEvent[]>>({});
    const [loading, setLoading]  = useState(true);

    const loadDay = async (d: Date) => {
        const ds = dateStr(d);
        if (dayData[ds] !== undefined) return;
        try {
            const result: any = await socket.sendTo(
                `${adapterName}.${instance}`, 'getHistoryData', { date: ds, _t: Date.now() }
            );
            const evts: IntimacyEvent[] = result?.data?.intimacyEvents ?? [];
            setDayData(prev => ({ ...prev, [ds]: evts }));
        } catch {
            setDayData(prev => ({ ...prev, [ds]: [] }));
        }
    };

    // Lade aktuellen Tag + 6 zurückliegende Tage (auch nach Recalc via cacheGen)
    useEffect(() => {
        setLoading(true);
        const days: Date[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(viewDate); d.setDate(d.getDate() - i); days.push(d);
        }
        Promise.all(days.map(loadDay)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewDate, cacheGen]);

    const navDay = (delta: number) => {
        const d = new Date(viewDate); d.setDate(d.getDate() + delta); setViewDate(d);
    };
    const isToday = dateStr(viewDate) === dateStr(new Date());

    // 7-Tage-Daten
    const historyDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(viewDate); d.setDate(d.getDate() - (6 - i));
        const ds = dateStr(d);
        return { dateStr: ds, label: fmtDate(d.getTime()), events: dayData[ds] ?? [] };
    });

    const todayDs     = dateStr(viewDate);
    const todayEvents = dayData[todayDs] ?? [];

    return (
        <div style={{
            padding: '20px',
            fontFamily: "'Roboto Mono','Courier New',monospace",
            background: isDark ? '#121212' : '#f5f5f5',
            minHeight: '100vh'
        }}>
            {/* Header + Navigation */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 20, gap: 12
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconButton size="small" onClick={() => navDay(-1)} sx={{ color: isDark ? '#888' : '#555' }}>
                        <ArrowBackIosIcon fontSize="small" />
                    </IconButton>
                    <div style={{ fontFamily: 'inherit', fontSize: '0.8rem', color: isDark ? '#888' : '#666', minWidth: 120, textAlign: 'center' }}>
                        {isToday ? '📅 Heute' : fmtDate(viewDate.getTime())}
                    </div>
                    <IconButton size="small" onClick={() => navDay(1)} disabled={isToday} sx={{ color: isDark ? '#888' : '#555', '&.Mui-disabled': { opacity: 0.2 } }}>
                        <ArrowForwardIosIcon fontSize="small" />
                    </IconButton>
                    {!isToday && (
                        <button onClick={() => setViewDate(() => { const d = new Date(); d.setHours(0,0,0,0); return d; })}
                            style={{
                                fontFamily: 'inherit', fontSize: '0.6rem', padding: '2px 8px',
                                background: 'transparent', border: `1px solid ${isDark ? '#444' : '#bbb'}`,
                                color: isDark ? '#888' : '#666', cursor: 'pointer', borderRadius: 2
                            }}>→ Heute</button>
                    )}
                </div>
                <div style={{ fontSize: '0.6rem', color: isDark ? '#333' : '#ccc' }}>
                    🔒 Daten lokal · keine Cloud
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: isDark ? '#444' : '#bbb', fontSize: '0.8rem' }}>
                    Lade Daten...
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Linke Spalte: Aktueller Tag + 7-Tage + Training-Formular */}
                    <div>
                        <SexDayCard
                            events={todayEvents}
                            dateLabel={isToday ? 'Heute' : fmtDate(viewDate.getTime())}
                            themeType={themeType}
                            funMode={funMode}
                            native={native}
                        />
                        <SevenDayHistory historyDays={historyDays} themeType={themeType} funMode={funMode} />
                        <LabelForm native={native} onChange={onChange} themeType={themeType} dayData={dayData} />
                    </div>

                    {/* Rechte Spalte: Algorithmus-Info + Hinweis */}
                    <div>
                        <TerminalBox title="SENSOR-DETAILS" themeType={themeType}
                            helpText="Technische Details zur Aktivitätserkennung. Score: Vibrationsstärke 50% + Trigger-Dichte 30% + Dauer 20%. Optionaler Garmin-HR-Boost (+10/+15 Punkte).">
                            {todayEvents.length > 0 ? (
                                todayEvents.map((evt, i) => (
                                    <div key={i} style={{ marginBottom: i < todayEvents.length - 1 ? 12 : 0 }}>
                                        <div style={{ fontSize: '0.6rem', color: isDark ? '#666' : '#aaa', marginBottom: 4 }}>
                                            SESSION {i + 1} · {fmtTime(evt.start)}–{fmtTime(evt.end)}
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                                            {[
                                                { lbl: 'PEAK STÄRKE', val: String(evt.peakStrength), col: '#ab47bc' },
                                                { lbl: 'AVG STÄRKE', val: String(evt.avgStrength), col: '#ab47bc' },
                                                { lbl: 'AVG TRIGGER', val: String(evt.avgTrigger)+'/Slot', col: '#ab47bc' }
                                            ].map(m => (
                                                <div key={m.lbl}>
                                                    <div style={{ fontSize: '0.48rem', color: isDark ? '#555' : '#aaa', textTransform: 'uppercase' }}>{m.lbl}</div>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: m.col }}>{m.val}</div>
                                                </div>
                                            ))}
                                        </div>
                                        {evt.garminHRMax !== null && (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                <div>
                                                    <div style={{ fontSize: '0.48rem', color: isDark ? '#555' : '#aaa', textTransform: 'uppercase' }}>⌚ MAX HR</div>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#ef5350' }}>{evt.garminHRMax} bpm</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.48rem', color: isDark ? '#555' : '#aaa', textTransform: 'uppercase' }}>⌚ Ø HR</div>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#ff7043' }}>{evt.garminHRAvg} bpm</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div style={{ fontSize: '0.75rem', color: isDark ? '#333' : '#ccc', textAlign: 'center', padding: '10px 0' }}>
                                    Keine Session heute
                                </div>
                            )}
                        </TerminalBox>

                        <TerminalBox title="ALGORITHMUS" themeType={themeType}>
                            <div style={{ fontSize: '0.68rem', lineHeight: 1.8, color: isDark ? '#666' : '#888' }}>
                                <div style={{ color: isDark ? '#555' : '#aaa', fontSize: '0.58rem', marginBottom: 4 }}>ERKENNUNGS-SCHWELLEN</div>
                                <div>• Zeitfenster: <span style={{ color: isDark ? '#81c784' : '#388e3c' }}>kein Limit</span> <span style={{ color: isDark ? '#444' : '#bbb' }}>(ganzer Tag, Sex ist zeitlos)</span></div>
                                <div>• <b>Pfad A</b> (kurz+intensiv): ≥2×5 Min, Peak ≥<span style={{ color: isDark ? '#ab47bc' : '#7b1fa2' }}>Schwelle A</span> → Quickie / vaginal</div>
                                <div>• <b>Pfad B</b> (länger+moderat): ≥6×5 Min, Peak ≥<span style={{ color: isDark ? '#90caf9' : '#283593' }}>Schwelle B</span> → oral/hand</div>
                                <div style={{ borderTop: `1px dashed ${isDark ? '#222' : '#eee'}`, marginTop: 6, paddingTop: 6, color: isDark ? '#555' : '#aaa', fontSize: '0.58rem' }}>KALIBRIERUNG</div>
                                <div>• Standard-Schwellen: A=50, B=30 (Vibrationsstärke 0–120)</div>
                                <div>• Adaptiv: aus eingetragenen Training-Sessions gelernt</div>
                                <div>• Mehr Sessions eintragen → präzisere Erkennung</div>
                                <div style={{ borderTop: `1px dashed ${isDark ? '#222' : '#eee'}`, marginTop: 6, paddingTop: 6, color: isDark ? '#555' : '#aaa', fontSize: '0.58rem' }}>TYP-KLASSIFIKATION</div>
                                <div>• Peak ≥80 + viele Str/Slot → <span style={{ color: isDark ? '#f48fb1' : '#c2185b' }}>vaginal</span></div>
                                <div>• Peak ≥55 oder Pfad B → <span style={{ color: isDark ? '#90caf9' : '#283593' }}>oral/hand</span></div>
                                <div>• Default → <span style={{ color: '#888' }}>intim</span></div>
                            </div>
                        </TerminalBox>

                        <TerminalBox title="DATENSCHUTZ" themeType={themeType}>
                            <div style={{ fontSize: '0.68rem', lineHeight: 1.8, color: isDark ? '#555' : '#888' }}>
                                <div>🔒 Alle Daten bleiben <strong style={{ color: isDark ? '#888' : '#555' }}>lokal</strong> auf diesem ioBroker-System</div>
                                <div>🚫 Keine Übertragung in die Cloud</div>
                                <div>📁 Gespeichert als tägliche JSON-Datei (History)</div>
                                <div>⚙️ Deaktivierbar in Einstellungen → Module</div>
                                <div style={{ marginTop: 6, fontSize: '0.55rem', color: isDark ? '#333' : '#bbb' }}>
                                    Kein Medizinprodukt · Keine klinische Nutzung
                                </div>
                            </div>
                        </TerminalBox>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SexTab;
