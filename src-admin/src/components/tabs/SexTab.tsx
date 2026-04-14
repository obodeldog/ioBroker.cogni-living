import React, { useState, useEffect, useRef } from 'react';
import { Tooltip as MuiTooltip, IconButton } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import {
    ComposedChart, AreaChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid,
    Tooltip as ReTooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Cell
} from 'recharts';

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
    pyConf?: number; // Python-Klassifikator Konfidenz (0-100), nur wenn Stufe 3 aktiv
}
interface SexTabProps {
    socket: any;
    adapterName: string;
    instance: number;
    themeType: string;
    native: Record<string, any>;
    onChange: (attr: string, value: any) => void;
}

/** Manuell eingetragene Sessions außerhalb des Bettes (sex-manual.json) */
interface ManualSexEntry {
    id: string;
    date: string;
    time?: string;
    durationMin?: number;
    type: 'vaginal' | 'oral_hand' | 'sonstiges';
    createdAt: number;
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

/** Findet das passende manuelle Label für einen Tag + seine Events (±2h Zeitfenster). */
function findMatchingLabel(dStr: string, events: IntimacyEvent[], labels: SexTrainingLabel[]): SexTrainingLabel | null {
    const dayLabels = labels.filter(l => l.date === dStr);
    if (dayLabels.length === 0) return null;
    if (events.length === 0) return dayLabels[0];
    for (const lbl of dayLabels) {
        if (!lbl.time || !/^\d{1,2}:\d{2}$/.test(lbl.time)) continue;
        const [hh, mm] = lbl.time.split(':').map(Number);
        const t0 = new Date(dStr + 'T00:00:00');
        t0.setHours(hh, mm, 0, 0);
        const ms = t0.getTime();
        if (events.some(e => Math.abs(e.start - ms) < 2 * 60 * 60000)) return lbl;
    }
    // Fallback: ein Label für den Tag → passt zum ersten Event
    if (dayLabels.length === 1) return dayLabels[0];
    return null;
}

function saveSexLabels(labels: SexTrainingLabel[], onChange: (attr: string, val: any) => void) {
    onChange('sexTrainingLabels', JSON.stringify(labels, null, 2));
}

/** Findet ein Label das zu einem spezifischen Event passt (+-1h Zeitfenster). */
function findLabelForEvent(dStr: string, evt: IntimacyEvent, labels: SexTrainingLabel[]): SexTrainingLabel | null {
    const dayLabels = labels.filter(l => l.date === dStr);
    if (dayLabels.length === 0) return null;
    for (const lbl of dayLabels) {
        if (!lbl.time || !/^\d{1,2}:\d{2}$/.test(lbl.time)) continue;
        const [hh, mm] = lbl.time.split(':').map(Number);
        const t0 = new Date(dStr + 'T00:00:00');
        t0.setHours(hh, mm, 0, 0);
        if (Math.abs(t0.getTime() - evt.start) < 60 * 60000) return lbl;
    }
    if (dayLabels.length === 1 && !dayLabels[0].time) return dayLabels[0];
    return null;
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
// Typ-Label
const typeLabel = (type: string): string => {
    if (type === 'vaginal')    return '\u2665 Vaginal';
    if (type === 'oral_hand')  return '\ud83d\udc9c Oral / Hand';
    if (type === 'nullnummer') return '\ud83d\udeab Nullnummer';
    return '\ud83d\udc9c Intim';
};
const typeBg = (type: string, isDark: boolean): string => {
    if (type === 'vaginal')    return isDark ? '#880e4f' : '#fce4ec';
    if (type === 'oral_hand')  return isDark ? '#1a237e' : '#e8eaf6';
    if (type === 'nullnummer') return isDark ? '#1a1a1a' : '#f5f5f5';
    return isDark ? '#212121' : '#f5f5f5';
};
const typeColor = (type: string, isDark: boolean): string => {
    if (type === 'vaginal')    return isDark ? '#f48fb1' : '#c2185b';
    if (type === 'oral_hand')  return isDark ? '#90caf9' : '#283593';
    if (type === 'nullnummer') return isDark ? '#555' : '#aaa';
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
const IntimacyBar = ({ events, isDark }: { events: IntimacyEvent[]; isDark: boolean }) => {
    if (events.length === 0) return null;
    // Zeitfenster: 2h vor frühestem Start bis 2h nach spätestem Ende, min. 4h Breite
    const minStart = Math.min(...events.map(e => e.start));
    const maxEnd   = Math.max(...events.map(e => e.end));
    const rawStart = minStart - 2 * 3600000;
    const rawEnd   = maxEnd   + 2 * 3600000;
    const winDur   = Math.max(rawEnd - rawStart, 4 * 3600000);
    // Auf volle Stunden runden für schöne Achse
    const winStart = new Date(rawStart); winStart.setMinutes(0, 0, 0);
    const winStartMs = winStart.getTime();
    const tickCount = Math.round(winDur / 3600000) + 1;
    const ticks = Array.from({ length: tickCount }, (_, i) => winStartMs + i * 3600000);
    // Alle Slots aller Events zusammenführen
    const allSlots = events.flatMap(e => e.slots);

    return (
        <div>
            <div style={{ fontSize: '0.83rem', color: isDark ? '#555' : '#aaa', marginBottom: 3 }}>
                INTENSITÄTS-VERLAUF (5-Min-Slots)
            </div>
            <div style={{ position: 'relative', height: 28, background: isDark ? '#111' : '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                {allSlots.map((sl, i) => {
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
                {/* Start-Markierung für jedes Event */}
                {events.map((evt, i) => (
                    <div key={i} style={{
                        position: 'absolute',
                        left: `${Math.max(0, ((evt.start - winStartMs) / winDur) * 100)}%`,
                        top: 0, width: 2, height: '100%', background: '#f48fb1', opacity: 0.9
                    }} />
                ))}
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
const SexDayCard = ({ events, dateLabel, themeType, funMode, native, labels, curDateStr, onChange }: {
    events: IntimacyEvent[]; dateLabel: string; themeType: string; funMode: boolean;
    native?: Record<string, any>; labels?: SexTrainingLabel[]; curDateStr?: string;
    onChange?: (attr: string, val: any) => void;
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

    // Manuelles Label hat Vorrang über Sensor-Erkennung
    const matchedLabel = (labels && curDateStr) ? findMatchingLabel(curDateStr, events, labels) : null;
    const effectiveType = (matchedLabel && (matchedLabel.type === 'vaginal' || matchedLabel.type === 'oral_hand'))
        ? matchedLabel.type as 'vaginal' | 'oral_hand'
        : evt.type;
    const isManualOverride = matchedLabel != null && matchedLabel.type !== evt.type;

    // Nullnummer: Diese Session war kein Sex — spezielle Ansicht mit Undo
    if (curDateStr && findLabelForEvent(curDateStr, evt, labels || [])?.type === 'nullnummer') {
        return (
            <TerminalBox title={`SEX - ${dateLabel}`} themeType={themeType}>
                <div style={{ textAlign: 'center', padding: '16px 8px' }}>
                    <div style={{ fontSize: '1.6rem', marginBottom: 8, opacity: 0.35 }}>?</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isDark ? '#555' : '#aaa', marginBottom: 4 }}>
                        Nullnummer — Kein Sex
                    </div>
                    <div style={{ fontSize: '0.7rem', color: isDark ? '#3a3a3a' : '#ccc', marginBottom: 10 }}>
                        Sensor meldete {fmtTime(evt.start)}{'\u2013'}{fmtTime(evt.end)}: Fehlauslösung erkannt.
                        Der Algorithmus lernt daraus.
                    </div>
                    {onChange && curDateStr && (
                        <button onClick={() => {
                            if (!onChange || !curDateStr) return;
                            const evtH = new Date(evt.start).getHours();
                            const evtM = new Date(evt.start).getMinutes();
                            const updated = (labels || []).filter(l => {
                                if (l.date !== curDateStr || l.type !== 'nullnummer' || !l.time) return true;
                                const [hh,mm] = l.time.split(':').map(Number);
                                return !(hh === evtH && mm === evtM);
                            });
                            saveSexLabels(updated, onChange);
                        }} style={{ fontSize: '0.7rem', padding: '4px 12px', cursor: 'pointer',
                            background: isDark ? '#1a1a1a' : '#f5f5f5',
                            color: isDark ? '#888' : '#aaa', border: '1px solid',
                            borderColor: isDark ? '#333' : '#ddd', borderRadius: 4
                        }}>
                            ↩ Rückgängig
                        </button>
                    )}
                </div>
            </TerminalBox>
        );
    }

    return (
        <TerminalBox title={`SEX — ${dateLabel}`} themeType={themeType}
            helpText="Erkennt intime Aktivitäten anhand des Vibrationssensors (16:00–02:00 Uhr). Score: Stärke 50% + Dichte 30% + Dauer 20%. Typ-Klassifikation: niedrige Konfidenz. Kein Medizinprodukt.">
            {/* Typ-Banner — gut sichtbar oben */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
                padding: '8px 12px', borderRadius: 5,
                background: typeBg(effectiveType, isDark),
                border: `1px solid ${typeColor(effectiveType, isDark)}44`,
            }}>
                <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>
                    {effectiveType === 'vaginal' ? '🔴' : effectiveType === 'oral_hand' ? '👄' : '💜'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: typeColor(effectiveType, isDark) }}>
                        {effectiveType === 'vaginal' ? 'Vaginal' : effectiveType === 'oral_hand' ? 'Oral / Hand' : 'Intime Aktivität'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: isDark ? '#888' : '#999', marginTop: 1 }}>
                        {fmtTime(evt.start)} – {fmtTime(evt.end)} · ~{evt.duration} Min · Score {evt.score}
                    </div>
                    {isManualOverride && (
                        <div style={{ fontSize: '0.6rem', color: isDark ? '#555' : '#bbb', marginTop: 2 }}>
                            Sensor erkannte: {evt.type === 'vaginal' ? 'Vaginal' : evt.type === 'oral_hand' ? 'Oral/Hand' : 'Intim'}
                        </div>
                    )}
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    {matchedLabel ? (
                        <span style={{
                            fontSize: '0.65rem', padding: '2px 8px', borderRadius: 3,
                            background: isDark ? '#0d2b3e' : '#e3f2fd', color: isDark ? '#64b5f6' : '#1565c0',
                            fontWeight: 'bold', whiteSpace: 'nowrap'
                        }}>✏ Manuell eingetragen</span>
                    ) : (
                        <span style={{
                            fontSize: '0.65rem', padding: '2px 8px', borderRadius: 3,
                            background: isDark ? '#1b5e20' : '#e8f5e9', color: isDark ? '#a5d6a7' : '#1b5e20',
                            fontWeight: 'bold', whiteSpace: 'nowrap'
                        }}>✓ Vom Sensor erkannt</span>
                    )}
                    {evt.pyConf != null && (
                        <span style={{
                            fontSize: '0.6rem', padding: '1px 6px', borderRadius: 3,
                            background: isDark ? '#0d1a2d' : '#e8eaf6', color: isDark ? '#90caf9' : '#3949ab',
                            whiteSpace: 'nowrap'
                        }}>🤖 KI: {evt.pyConf}% Konfidenz</span>
                    )}
                </div>
            </div>

            {/* Score + Meta */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                <ScoreCircle score={evt.score} isDark={isDark} />
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', color: isDark ? '#888' : '#aaa', marginBottom: 3 }}>SENSOR-DETAILS</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: 4 }}>
                        {fmtTime(evt.start)} — {fmtTime(evt.end)}
                        <span style={{ fontSize: '0.6rem', color: isDark ? '#666' : '#aaa', marginLeft: 8 }}>~{evt.duration} Min</span>
                    </div>
                    <div style={{ marginTop: 5, fontSize: '0.83rem', color: isDark ? '#555' : '#aaa' }}>
                        Peak: <span style={{ color: '#ab47bc' }}>{evt.peakStrength}</span> ·
                        Dichte: <span style={{ color: '#ab47bc' }}>{evt.avgTrigger}/5min</span> ·
                        {evt.slots.length} Slots aktiv
                    </div>
                </div>
            </div>

            {/* Intensitäts-Balken */}
            <IntimacyBar events={events} isDark={isDark} />

            {/* Session-Liste: pro Session eigene Nullnummer-Option */}
            {onChange && curDateStr && (
                <div style={{ marginTop: 8 }}>
                    {events.length > 1 && (
                        <div style={{ fontSize: '0.58rem', color: isDark ? '#555' : '#aaa', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Alle Sessions dieses Tages
                        </div>
                    )}
                    {events.map((e, idx) => {
                        const eH = new Date(e.start).getHours();
                        const eM = new Date(e.start).getMinutes();
                        const eTime = String(eH).padStart(2,'0') + ':' + String(eM).padStart(2,'0');
                        const evtLabel = findLabelForEvent(curDateStr!, e, labels || []);
                        const isEvtNull = evtLabel?.type === 'nullnummer';
                        return (
                            <div key={idx} style={{
                                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5,
                                padding: '4px 8px', borderRadius: 4,
                                background: isEvtNull ? (isDark ? '#111' : '#f9f9f9') : 'transparent',
                                border: '1px solid', borderColor: isEvtNull ? (isDark ? '#222' : '#eee') : 'transparent'
                            }}>
                                <div style={{ flex: 1, fontSize: '0.7rem',
                                    color: isEvtNull ? (isDark ? '#444' : '#ccc') : (isDark ? '#888' : '#666'),
                                    textDecoration: isEvtNull ? 'line-through' : 'none'
                                }}>
                                    {events.length > 1 ? ('Session ' + (idx + 1) + ': ') : ''}{fmtTime(e.start)}{'\u2013'}{fmtTime(e.end)}{' \u00b7 Score '}{e.score}
                                </div>
                                {isEvtNull ? (
                                    <button onClick={() => {
                                        const updated = (labels || []).filter(l => {
                                            if (l.date !== curDateStr || l.type !== 'nullnummer' || !l.time) return true;
                                            const [hh,mm] = l.time.split(':').map(Number);
                                            return !(hh === eH && mm === eM);
                                        });
                                        saveSexLabels(updated, onChange!);
                                    }} style={{
                                        fontSize: '0.6rem', padding: '2px 8px', cursor: 'pointer',
                                        background: 'transparent', borderRadius: 3,
                                        color: isDark ? '#555' : '#bbb', border: '1px solid',
                                        borderColor: isDark ? '#333' : '#ddd', whiteSpace: 'nowrap'
                                    }}>
                                        \u21a9 Zur\u00fcck
                                    </button>
                                ) : (
                                    <button onClick={() => {
                                        const newLbl: SexTrainingLabel = { date: curDateStr!, type: 'nullnummer', time: eTime, durationMin: e.duration };
                                        saveSexLabels([...(labels || []), newLbl], onChange!);
                                    }} style={{
                                        fontSize: '0.6rem', padding: '2px 8px', cursor: 'pointer',
                                        background: isDark ? '#1a1a1a' : '#f9f9f9',
                                        color: isDark ? '#666' : '#aaa', border: '1px dashed',
                                        borderColor: isDark ? '#333' : '#ddd', borderRadius: 3, whiteSpace: 'nowrap'
                                    }}>
                                        🚫 Nullnummer
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </TerminalBox>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Monatskalender
// ─────────────────────────────────────────────────────────────────────────────
const MONTH_NAMES_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const DOW_SHORT = ['Mo','Di','Mi','Do','Fr','Sa','So'];

const MonthCalendar: React.FC<{
    month: string;              // 'YYYY-MM'
    summary: Record<string, Array<{type: string; duration: number; score: number}>>;
    manualEntries: ManualSexEntry[];
    labels: any[];
    viewDate: string;
    onDayClick: (d: string) => void;
    onMonthChange: (m: string) => void;
    themeType: string;
}> = ({ month, summary, manualEntries, labels, viewDate, onDayClick, onMonthChange, themeType }) => {
    const isDark = themeType === 'dark';
    const [year, mon] = month.split('-').map(Number);

    const prevMonth = () => {
        const d = new Date(year, mon - 2, 1);
        onMonthChange(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    };
    const nextMonth = () => {
        const d = new Date(year, mon, 1);
        onMonthChange(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    };

    const daysInMonth  = new Date(year, mon, 0).getDate();
    const firstDow     = new Date(year, mon - 1, 1).getDay(); // 0=Sun
    const startOffset  = firstDow === 0 ? 6 : firstDow - 1;  // Monday-first
    const todayStr     = new Date().toISOString().slice(0, 10);

    const cells: React.ReactNode[] = [];

    // Wochentag-Header
    DOW_SHORT.forEach(d => (
        cells.push(
            <div key={`h-${d}`} style={{
                textAlign: 'center', fontSize: '0.6rem',
                color: isDark ? '#444' : '#bbb', fontWeight: 600,
                paddingBottom: 3,
            }}>{d}</div>
        )
    ));

    // Leere Zellen vor dem 1.
    for (let i = 0; i < startOffset; i++) cells.push(<div key={`empty-${i}`} />);

    // Tages-Zellen
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr  = `${year}-${String(mon).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const events      = summary[dateStr] || [];
        const manualDay   = manualEntries.filter(m => m.date === dateStr);
        const hasLabel    = labels.some((l: any) => l.date === dateStr);
        const isToday     = dateStr === todayStr;
        const isView      = dateStr === viewDate;

        // Dominanten Typ bestimmen (erster algorithmischer Event, sonst manuell)
        const domType  = events[0]?.type ?? null;
        const domManual = manualDay[0]?.type ?? null;
        // Algorithmisch erkannt: volle Emojis; nur manuell: hohle Variante
        const emoji    = domType === 'vaginal' ? '♥' : domType === 'oral_hand' ? '👄' : domType ? '💜' : null;
        const emojiManual = !emoji && domManual ? (domManual === 'vaginal' ? '♡' : domManual === 'oral_hand' ? '○' : '◇') : null;

        cells.push(
            <div key={dateStr} onClick={() => onDayClick(dateStr)} style={{
                cursor: 'pointer',
                borderRadius: 4,
                padding: '3px 2px',
                textAlign: 'center',
                minHeight: 36,
                background: isView
                    ? (isDark ? '#1a3a1a' : '#e8f5e9')
                    : isToday
                        ? (isDark ? '#1a1a2e' : '#e8eaf6')
                        : 'transparent',
                border: isToday
                    ? `1px solid ${isDark ? '#3949ab' : '#9fa8da'}`
                    : `1px solid transparent`,
                transition: 'background 0.15s',
            }}>
                <div style={{
                    fontSize: '0.65rem',
                    color: isView
                        ? (isDark ? '#81c784' : '#2e7d32')
                        : (isDark ? '#555' : '#aaa'),
                    fontWeight: isToday || isView ? 700 : 400,
                }}>{d}</div>
                {emoji && (
                    <div style={{ fontSize: '0.7rem', lineHeight: 1.1 }}>
                        {events.length > 1 ? `${emoji}×${events.length}` : emoji}
                        {manualDay.length > 0 && <span style={{ fontSize: '0.5rem', opacity: 0.6 }}>+m</span>}
                    </div>
                )}
                {emojiManual && (
                    <div style={{ fontSize: '0.7rem', lineHeight: 1.1, opacity: 0.6 }}
                         title="Manuell eingetragen (kein Sensor)">
                        {manualDay.length > 1 ? `${emojiManual}×${manualDay.length}` : emojiManual}
                    </div>
                )}
                {!emoji && !emojiManual && hasLabel && (
                    <div style={{ fontSize: '0.5rem', color: isDark ? '#333' : '#ddd' }}>✎</div>
                )}
            </div>
        );
    }

    // Monats-Statistik
    const monthEventsTotal  = Object.entries(summary).filter(([d]) => d.startsWith(month)).reduce((s,[,e]) => s + e.length, 0);
    const monthDaysWithSex  = Object.keys(summary).filter(d => d.startsWith(month) && (summary[d]?.length ?? 0) > 0).length;

    return (
        <TerminalBox title={`SEX — ${MONTH_NAMES_DE[mon-1].toUpperCase()} ${year}`} themeType={themeType}>
            {/* Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <button onClick={prevMonth} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: isDark ? '#555' : '#aaa', fontSize: '0.8rem', padding: '2px 6px',
                }}>◀</button>
                <span style={{ fontSize: '0.72rem', color: isDark ? '#555' : '#aaa', letterSpacing: 1 }}>
                    {monthDaysWithSex > 0
                        ? `${monthDaysWithSex} Tage · ${monthEventsTotal} Session${monthEventsTotal !== 1 ? 's' : ''}`
                        : 'Keine Sessions'}
                </span>
                <button onClick={nextMonth} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: isDark ? '#555' : '#aaa', fontSize: '0.8rem', padding: '2px 6px',
                }}>▶</button>
            </div>

            {/* Kalender-Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 2,
            }}>
                {cells}
            </div>

            {/* Legende */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: '0.6rem', color: isDark ? '#444' : '#bbb' }}>
                <span>♥ vaginal</span>
                <span>👄 oral/hand</span>
                <span>💜 intim</span>
                <span>✎ nur Label</span>
            </div>
        </TerminalBox>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// 7-Tage-History
// ─────────────────────────────────────────────────────────────────────────────
const SevenDayHistory = ({ historyDays, themeType, funMode, labels }: {
    historyDays: Array<{ dateStr: string; label: string; events: IntimacyEvent[] }>;
    themeType: string; funMode: boolean; labels?: SexTrainingLabel[];
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
                    // Manuelles Label hat Vorrang
                    const dayLbl = (labels && hasEvt) ? findMatchingLabel(day.dateStr, day.events, labels) : null;
                    const isNullnummer = dayLbl?.type === 'nullnummer';
                    const effType: string = (dayLbl && (dayLbl.type === 'vaginal' || dayLbl.type === 'oral_hand'))
                        ? dayLbl.type
                        : (evt?.type ?? 'intim');
                    const dotColor = (!hasEvt || isNullnummer) ? (isDark ? '#1a1a1a' : '#f0f0f0') :
                        effType === 'vaginal' ? '#880e4f' : '#4a148c';
                    const dotBorder = (!hasEvt || isNullnummer) ? ('1px dashed ' + (isDark ? '#2a2a2a' : '#ddd')) :
                        effType === 'vaginal' ? '1px solid #c2185b' : '1px solid #7b1fa2';
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
                                fontSize: '0.7rem', opacity: isNullnummer ? 0.45 : 1
                            }}>
                                {isNullnummer ? '\u26d4' : hasEvt ? (effType === 'vaginal' ? '\u2665\ufe0f' : effType === 'oral_hand' ? '\ud83d\udc9c' : '\ud83d\udc9c') : (isToday ? '\u23f3' : '-')}
                            </div>
                            {hasEvt && !isNullnummer && (
                                <>
                                    <div style={{ fontSize: '0.88rem', color: isDark ? '#ce93d8' : '#7b1fa2', fontWeight: 'bold' }}>{evt!.score}</div>
                                    <div style={{ fontSize: '0.45rem', color: isDark ? '#555' : '#aaa' }}>{fmtTime(evt!.start).slice(0,5)}</div>
                                    <div style={{ fontSize: '0.45rem', color: typeColor(effType, isDark), fontWeight: 'bold' }}>
                                        {effType === 'vaginal' ? 'Vaginal' : effType === 'oral_hand' ? 'Oral' : 'Intim'}
                                        {dayLbl && effType !== evt!.type && <span style={{ color: isDark ? '#555' : '#ccc' }}> ?</span>}
                                    </div>
                                </>
                            )}
                            {hasEvt && isNullnummer && (
                                <div style={{ fontSize: '0.45rem', color: isDark ? '#444' : '#ccc', marginTop: 2 }}>Null-<br />nummer</div>
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
                        <div style={{ fontSize: '0.8rem', color: isDark ? '#555' : '#aaa', textTransform: 'uppercase', marginBottom: 2 }}>{m.lbl}</div>
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
const LabelForm = ({ native, onChange, themeType, dayData, loadDay }: {
    native: Record<string, any>;
    onChange: (attr: string, val: any) => void;
    themeType: string;
    dayData: Record<string, IntimacyEvent[]>;
    loadDay: (d: Date) => Promise<void>;
}) => {
    const isDark = themeType === 'dark';
    const today = dateStr(new Date());
    const [formDate, setFormDate] = useState(today);
    const [formTime, setFormTime] = useState('');
    const [formDuration, setFormDuration] = useState('');
    const [formType, setFormType] = useState<'vaginal' | 'oral_hand' | 'none'>('oral_hand');

    const labels = parseSexTrainingLabels(native.sexTrainingLabels);

    // Fehlende Daten für Label-Dates außerhalb des 7-Tage-Fensters nachladen
    useEffect(() => {
        labels.forEach(l => {
            if (dayData[l.date] === undefined) {
                loadDay(new Date(l.date + 'T12:00:00'));
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [labels.length]);

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
        fontFamily: 'monospace', fontSize: '0.88rem',
    };
    const selectStyle = { ...inputStyle, cursor: 'pointer' };

    return (
        <TerminalBox title="SESSION EINTRAGEN (Trainingsdaten)" themeType={themeType}
            helpText="Trage bekannte Sessions manuell ein. Das System lernt daraus die typische Vibrationsstärke deines Sensors (Kalibrierung). Eine Handvoll Einträge reicht für gute Erkennung. Für die reine Dokumentation ohne Training gibt es die Kachel 'Manuelle Session'.">
            {/* Formular */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
                <div>
                    <div style={{ fontSize: '0.8rem', color: isDark ? '#555' : '#aaa', marginBottom: 3 }}>DATUM</div>
                    <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                        style={{ ...inputStyle, width: 130 }} />
                </div>
                <div>
                    <div style={{ fontSize: '0.8rem', color: isDark ? '#555' : '#aaa', marginBottom: 3 }}>UHRZEIT (ca.)</div>
                    <input type="time" value={formTime} onChange={e => setFormTime(e.target.value)}
                        style={{ ...inputStyle, width: 100 }} />
                </div>
                <div>
                    <div style={{ fontSize: '0.8rem', color: isDark ? '#555' : '#aaa', marginBottom: 3 }}>DAUER (Min, opt.)</div>
                    <input type="number" value={formDuration} onChange={e => setFormDuration(e.target.value)}
                        min={1} max={180} placeholder="—"
                        style={{ ...inputStyle, width: 80 }} />
                </div>
                <div>
                    <div style={{ fontSize: '0.8rem', color: isDark ? '#555' : '#aaa', marginBottom: 3 }}>TYP</div>
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
                        fontFamily: 'monospace', fontSize: '0.88rem',
                        cursor: 'pointer', fontWeight: 700, letterSpacing: 1,
                        alignSelf: 'flex-end',
                    }}>
                    + SPEICHERN
                </button>
            </div>

            {/* Liste der eingetragenen Labels */}
            {labels.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: isDark ? '#444' : '#bbb', fontStyle: 'italic' }}>
                    Noch keine Einträge — trage 3–5 bekannte Sessions ein, damit der Algorithmus lernen kann.
                </div>
            ) : (
                <div>
                    <div style={{ fontSize: '0.8rem', color: isDark ? '#444' : '#bbb', marginBottom: 6, letterSpacing: 1 }}>
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
                                <span style={{ fontSize: '0.83rem', flex: 1, color: isDark ? '#ccc' : '#444' }}>
                                    <b>{l.date}</b>
                                    {l.time && <span style={{ color: isDark ? '#888' : '#999' }}> · {l.time}</span>}
                                    {l.durationMin != null && <span style={{ color: isDark ? '#888' : '#999' }}> · ~{l.durationMin} Min</span>}
                                    <span style={{
                                        marginLeft: 8, padding: '1px 6px', borderRadius: 3, fontSize: '0.88rem',
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
                    <div style={{ marginTop: 8, fontSize: '0.83rem', color: isDark ? '#333' : '#bbb' }}>
                        ✓ = vom Sensor erkannt · ⚠ = nicht erkannt (Sensor ggf. neu kalibrieren) · · = kein Datentag geladen
                    </div>
                </div>
            )}
        </TerminalBox>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// VibrationChartPanel — Garmin-Style + Aura-Style
// ─────────────────────────────────────────────────────────────────────────────
interface VibPoint {
    ts: number;
    time: string;
    strength: number | null;
    trigger: number | null;
    smoothed: number | null;
}

const SLOT_MS = 5 * 60 * 1000;

function buildVibSlots(vibRaw: any[], dayStart: number, livePoints: { ts: number; val: number }[]): VibPoint[] {
    const numSlots = 288; // 24h / 5min
    const slots: { maxStr: number; trig: number }[] = Array.from({ length: numSlots }, () => ({ maxStr: 0, trig: 0 }));

    const allEvts = [...(vibRaw || [])];
    // Merge live points as synthetic vibration_strength events
    for (const lp of livePoints) {
        allEvts.push({ type: 'vibration_strength', timestamp: lp.ts, value: lp.val, isVibrationBed: true });
    }

    for (const e of allEvts) {
        const t = e.timestamp || 0;
        if (t < dayStart || t >= dayStart + 24 * 3600 * 1000) continue;
        const idx = Math.floor((t - dayStart) / SLOT_MS);
        if (idx < 0 || idx >= numSlots) continue;
        if (e.type === 'vibration_strength') {
            slots[idx].maxStr = Math.max(slots[idx].maxStr, Number(e.value) || 0);
        } else if (e.type === 'vibration_trigger' && (e.value === true || e.value === 1 || e.value === 'true')) {
            slots[idx].trig++;
        }
    }

    // Moving average (7-slot window = 35 min)
    const points: VibPoint[] = slots.map((sl, i) => {
        const d = new Date(dayStart + i * SLOT_MS);
        const timeLabel = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        return {
            ts: dayStart + i * SLOT_MS,
            time: timeLabel,
            strength: sl.maxStr > 0 ? sl.maxStr : null,
            trigger: sl.trig > 0 ? sl.trig : null,
            smoothed: null,
        };
    });

    const W = 4;
    for (let i = 0; i < points.length; i++) {
        const win = points.slice(Math.max(0, i - W), Math.min(points.length, i + W + 1));
        const vals = win.map(p => p.strength ?? 0);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        points[i].smoothed = avg > 0.5 ? Math.round(avg * 10) / 10 : null;
    }
    return points;
}

function zoomSlice(points: VibPoint[], hours: number, dayStart: number, isToday: boolean): VibPoint[] {
    if (hours >= 24) return points;
    const windowMs = hours * 3600 * 1000;
    const anchor = isToday ? Date.now() : dayStart + 24 * 3600 * 1000;
    const from = anchor - windowMs;
    return points.filter(p => p.ts >= from && p.ts <= anchor);
}

interface VibPanelProps {
    vibRaw: any[];
    sessions: IntimacyEvent[];
    calibA: number;
    calibB: number;
    isDark: boolean;
    dayStart: number;
    isToday: boolean;
    livePoints: { ts: number; val: number }[];
    isLive: boolean;
}

// Benutzerdefinierter Tooltip für Vibrations-Chart
const VibTooltip: React.FC<any> = ({ active, payload, label, calibA, calibB, isDark }) => {
    if (!active || !payload || !payload.length) return null;
    const strEntry = payload.find((p: any) => p.dataKey === 'strength');
    const trigEntry = payload.find((p: any) => p.dataKey === 'triggerMark');
    const val = strEntry?.value ?? 0;
    const hasTrig = !!(trigEntry?.value && trigEntry.value > 0);

    let zone = '';
    let zoneColor = isDark ? '#888' : '#666';
    let hint = '';
    if (val >= calibA) {
        zone = `Intensiv-Zone (≥ A=${calibA})`;
        zoneColor = '#ab47bc';
        hint = `Pfad A braucht ≥ 2 aufeinanderfolgende Slots — kein Session-Kriterium für diesen Slot allein`;
    } else if (val >= calibB) {
        zone = `Moderat-Zone (≥ B=${calibB})`;
        zoneColor = '#f48fb1';
        hint = `Pfad B braucht ≥ 6 aufeinanderfolgende Slots — kein Session-Kriterium für diesen Slot allein`;
    } else if (val > 0) {
        zone = `Unter Schwelle B=${calibB}`;
        zoneColor = isDark ? '#555' : '#999';
        hint = 'Zu schwache Vibration für Session-Erkennung';
    }

    return (
        <div style={{
            background: isDark ? '#1a1a1a' : '#fff',
            border: `1px solid ${isDark ? '#333' : '#ddd'}`,
            borderRadius: 5, padding: '8px 12px', fontSize: '0.78rem',
            fontFamily: "'Roboto Mono','Courier New',monospace",
            maxWidth: 280, lineHeight: 1.6,
        }}>
            <div style={{ color: isDark ? '#aaa' : '#555', fontWeight: 'bold', marginBottom: 4 }}>⏱ {label}</div>
            {val > 0 && <div>Stärke: <strong style={{ color: zoneColor }}>{val}</strong> — {zone}</div>}
            {hasTrig && <div style={{ color: '#00bcd4' }}>▲ Vibrations-Trigger erkannt</div>}
            {hint && <div style={{ color: isDark ? '#444' : '#bbb', fontSize: '0.68rem', marginTop: 4, borderTop: `1px dashed ${isDark ? '#2a2a2a' : '#eee'}`, paddingTop: 4 }}>{hint}</div>}
            {!val && !hasTrig && <div style={{ color: isDark ? '#444' : '#bbb' }}>Keine Aktivität</div>}
        </div>
    );
};

const VibGarmin: React.FC<VibPanelProps & { zoom: number }> = ({ vibRaw, sessions, calibA, calibB, isDark, dayStart, isToday, livePoints, zoom }) => {
    const rawPts = zoomSlice(buildVibSlots(vibRaw, dayStart, livePoints), zoom, dayStart, isToday);
    const gc = isDark ? '#1e1e1e' : '#eeeeee';
    const ax = isDark ? '#555' : '#aaa';
    const maxStr = Math.max(...rawPts.map(p => p.strength ?? 0), calibA + 5);
    const yMax = Math.ceil(maxStr * 1.2 / 5) * 5;
    const xInterval = Math.max(Math.floor(rawPts.length / 10), 1);
    // Trigger-Markierungen: kleiner fester Balken am Boden (5% von yMax)
    const trigHeight = Math.max(Math.round(yMax * 0.05), 1);
    const pts = rawPts.map(p => ({ ...p, triggerMark: (p.trigger ?? 0) > 0 ? trigHeight : null }));

    const sessionAreas = sessions.map((s, i) => {
        const x1 = pts.find(p => p.ts >= s.start)?.time;
        const x2 = pts.find(p => p.ts > s.end)?.time ?? pts[pts.length - 1]?.time;
        if (!x1) return null;
        return <ReferenceArea key={i} x1={x1} x2={x2} fill="rgba(244,143,177,0.22)" stroke="rgba(244,143,177,0.5)" strokeWidth={1} />;
    });

    return (
        <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={pts} margin={{ top: 8, right: 32, left: -10, bottom: 4 }} barCategoryGap={0}>
                <CartesianGrid strokeDasharray="3 6" stroke={gc} vertical={false} />
                <XAxis dataKey="time" stroke={ax} tick={{ fontSize: 11, fill: isDark ? '#666' : '#999' }} interval={xInterval} />
                <YAxis domain={[0, yMax]} stroke={ax} tick={{ fontSize: 11, fill: isDark ? '#666' : '#999' }} width={36} />
                <ReTooltip content={<VibTooltip calibA={calibA} calibB={calibB} isDark={isDark} />} />
                {sessionAreas}
                <ReferenceLine y={calibA} stroke="#ab47bc" strokeDasharray="5 3" strokeWidth={1.5}
                    label={{ value: `Schwelle A = ${calibA}`, position: 'insideTopLeft', fontSize: 10, fill: '#ab47bc', offset: 4 }} />
                <ReferenceLine y={calibB} stroke="#42a5f5" strokeDasharray="5 3" strokeWidth={1.5}
                    label={{ value: `Schwelle B = ${calibB}`, position: 'insideBottomLeft', fontSize: 10, fill: '#42a5f5', offset: 4 }} />
                {/* Trigger-Markierungen (cyan, klein) */}
                <Bar dataKey="triggerMark" name="triggerMark" radius={[1, 1, 0, 0]} maxBarSize={4} isAnimationActive={false} fill="#00bcd4" opacity={0.7} />
                {/* Stärke-Balken (farbkodiert nach Intensitäts-Zone) */}
                <Bar dataKey="strength" name="strength" radius={[2, 2, 0, 0]} maxBarSize={12} isAnimationActive={false}>
                    {pts.map((p, i) => (
                        <Cell key={i} fill={
                            (p.strength || 0) >= calibA ? '#ab47bc' :
                            (p.strength || 0) >= calibB ? '#f48fb1' :
                            (p.strength || 0) > 0 ? (isDark ? '#383838' : '#d0d0d0') :
                            'transparent'
                        } />
                    ))}
                </Bar>
                <Line type="monotone" dataKey="smoothed" name="smoothed" stroke={isDark ? '#607d8b' : '#78909c'} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
            </ComposedChart>
        </ResponsiveContainer>
    );
};


const VibrationChartPanel: React.FC<{
    vibRaw: any[];
    sessions: IntimacyEvent[];
    calibA: number;
    calibB: number;
    isDark: boolean;
    dayStart: number;
    isToday: boolean;
    socket: any;
    strengthId: string | null;
    trigId: string | null;
}> = ({ vibRaw, sessions, calibA, calibB, isDark, dayStart, isToday, socket, strengthId, trigId }) => {
    const [zoom, setZoom] = useState(12);
    const [livePoints, setLivePoints] = useState<{ ts: number; val: number }[]>([]);
    const liveRef = useRef<{ ts: number; val: number }[]>([]);

    useEffect(() => {
        if (!isToday) { setLivePoints([]); liveRef.current = []; return; }
        if (!strengthId) return;

        const handler = (_id: string, state: any) => {
            if (!state || state.val === null || state.val === undefined) return;
            const val = Number(state.val) || 0;
            if (val <= 0) return;
            const newPt = { ts: state.ts || Date.now(), val };
            liveRef.current = [...liveRef.current, newPt].slice(-500);
            setLivePoints([...liveRef.current]);
        };
        try { socket.subscribeState(strengthId, handler); } catch (_) { /* */ }
        return () => { try { socket.unsubscribeState(strengthId, handler); } catch (_) { /* */ } };
    }, [isToday, strengthId, socket]);

    const box: React.CSSProperties = {
        background: isDark ? '#0e0e0e' : '#fff',
        border: `1px solid ${isDark ? '#222' : '#e0e0e0'}`,
        borderRadius: 6, padding: '16px 16px 12px', marginTop: 16,
        fontFamily: "'Roboto Mono','Courier New',monospace",
    };
    const hdr: React.CSSProperties = {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
    };
    const titleStyle: React.CSSProperties = {
        fontSize: '0.75rem', letterSpacing: '0.08em', fontWeight: 600,
        color: isDark ? '#555' : '#999',
    };
    const mkZoomBtns = (active: number, setActive: (h: number) => void, dark: boolean) =>
        [6, 12, 24].map(h => (
            <button key={h} onClick={() => setActive(h)} style={{
                background: active === h ? (dark ? '#2e2e2e' : '#e0e0e0') : 'transparent',
                border: `1px solid ${dark ? '#333' : '#ddd'}`,
                color: active === h ? (dark ? '#ddd' : '#111') : (dark ? '#444' : '#aaa'),
                borderRadius: 3, padding: '3px 10px', fontSize: '0.7rem',
                cursor: 'pointer', fontFamily: 'inherit',
            }}>{h}h</button>
        ));

    const liveIndicator = isToday ? (
        <span style={{ fontSize: '0.7rem', color: '#43a047', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#43a047', display: 'inline-block' }} />
            LIVE
        </span>
    ) : null;

    return (
        <div style={box}>
            <div style={hdr}>
                <span style={titleStyle}>[ VIBRATIONSVERLAUF ]</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {liveIndicator}
                    <div style={{ display: 'flex', gap: 4 }}>{mkZoomBtns(zoom, setZoom, isDark)}</div>
                </div>
            </div>
            {vibRaw.length === 0 && livePoints.length === 0 ? (
                <div style={{ textAlign: 'center', color: isDark ? '#333' : '#ccc', fontSize: '0.8rem', padding: '40px 0' }}>
                    Keine Vibrationsdaten für diesen Tag
                </div>
            ) : (
                <VibGarmin vibRaw={vibRaw} sessions={sessions} calibA={calibA} calibB={calibB}
                    isDark={isDark} dayStart={dayStart} isToday={isToday} livePoints={livePoints} isLive zoom={zoom} />
            )}
            {/* Legende */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, fontSize: '0.7rem', color: isDark ? '#555' : '#aaa' }}>
                <span><span style={{ color: '#ab47bc' }}>▌</span> Intensiv-Zone (≥ A={calibA})</span>
                <span><span style={{ color: '#f48fb1' }}>▌</span> Moderat-Zone (≥ B={calibB})</span>
                <span><span style={{ color: isDark ? '#444' : '#ccc' }}>▌</span> Schwache Bewegung</span>
                <span><span style={{ color: '#00bcd4' }}>▌</span> Trigger erkannt</span>
                <span><span style={{ color: 'rgba(244,143,177,0.7)' }}>░</span> Session erkannt</span>
            </div>
            {/* Wichtiger Hinweis */}
            <div style={{
                marginTop: 8, padding: '6px 10px', borderRadius: 3,
                background: isDark ? '#111' : '#f9f9f9',
                border: `1px solid ${isDark ? '#222' : '#eee'}`,
                fontSize: '0.7rem', color: isDark ? '#444' : '#aaa', lineHeight: 1.6,
            }}>
                ⓘ <strong style={{ color: isDark ? '#555' : '#999' }}>Farbe = Rohwert des Sensors pro 5-Min-Slot</strong> — keine Session-Erkennung.
                Session erkannt = <span style={{ color: 'rgba(244,143,177,0.9)' }}>rosa Hinterlegung</span>.
                Hover über einen Balken für Details und Kontext.
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// ManualSessionForm — Dokumentation von Sessions außerhalb des Bettes
// ─────────────────────────────────────────────────────────────────────────────
const ManualSessionForm: React.FC<{
    themeType: string;
    entries: ManualSexEntry[];
    onAdd: (e: Omit<ManualSexEntry, 'id' | 'createdAt'>) => void;
    onDelete: (id: string) => void;
}> = ({ themeType, entries, onAdd, onDelete }) => {
    const isDark = themeType === 'dark';
    const today = dateStr(new Date());
    const [formDate, setFormDate] = useState(today);
    const [formTime, setFormTime] = useState('');
    const [formDuration, setFormDuration] = useState('');
    const [formType, setFormType] = useState<'vaginal' | 'oral_hand' | 'sonstiges'>('oral_hand');

    const inputStyle = {
        background: isDark ? '#1a1a1a' : '#fff',
        color: isDark ? '#eee' : '#111',
        border: `1px solid ${isDark ? '#444' : '#ccc'}`,
        borderRadius: 3, padding: '4px 8px',
        fontFamily: 'monospace', fontSize: '0.88rem',
    };

    const handleAdd = () => {
        if (!formDate) return;
        onAdd({
            date: formDate,
            type: formType,
            ...(formTime ? { time: formTime } : {}),
            ...(formDuration && parseInt(formDuration) > 0 ? { durationMin: parseInt(formDuration) } : {}),
        });
        setFormTime('');
        setFormDuration('');
    };

    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

    return (
        <TerminalBox title="MANUELLE SESSION" themeType={themeType}
            helpText="Trage Sessions ein die außerhalb des Bettes stattfanden (kein Vibrationssensor vorhanden). Diese dienen nur der Dokumentation und beeinflussen das KI-Training NICHT. Im Kalender als hohle Symbole (♡ ○) dargestellt.">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
                <div>
                    <div style={{ fontSize: '0.6rem', color: isDark ? '#555' : '#aaa', marginBottom: 3, letterSpacing: 1 }}>DATUM</div>
                    <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                        style={{ ...inputStyle, width: 130 }} />
                </div>
                <div>
                    <div style={{ fontSize: '0.6rem', color: isDark ? '#555' : '#aaa', marginBottom: 3, letterSpacing: 1 }}>UHRZEIT (ca.)</div>
                    <input type="time" value={formTime} onChange={e => setFormTime(e.target.value)}
                        style={{ ...inputStyle, width: 90 }} />
                </div>
                <div>
                    <div style={{ fontSize: '0.6rem', color: isDark ? '#555' : '#aaa', marginBottom: 3, letterSpacing: 1 }}>DAUER (Min, opt.)</div>
                    <input type="number" value={formDuration} onChange={e => setFormDuration(e.target.value)}
                        placeholder="–" min={1} max={180}
                        style={{ ...inputStyle, width: 70 }} />
                </div>
                <div>
                    <div style={{ fontSize: '0.6rem', color: isDark ? '#555' : '#aaa', marginBottom: 3, letterSpacing: 1 }}>TYP</div>
                    <select value={formType} onChange={e => setFormType(e.target.value as any)}
                        style={{ ...inputStyle, cursor: 'pointer' }}>
                        <option value="oral_hand">◐ Oral / Hand</option>
                        <option value="vaginal">♥ Vaginal</option>
                        <option value="sonstiges">⬡ Sonstiges</option>
                    </select>
                </div>
                <button onClick={handleAdd} style={{
                    background: '#4a235a', color: '#f3e5f5', border: '1px solid #7b1fa2',
                    borderRadius: 4, padding: '5px 14px', cursor: 'pointer', fontSize: '0.88rem',
                }}>+ Speichern</button>
            </div>
            {sorted.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: isDark ? '#444' : '#bbb', fontStyle: 'italic' }}>
                    Noch keine manuellen Einträge.
                </div>
            ) : (
                <div>
                    <div style={{ fontSize: '0.8rem', color: isDark ? '#444' : '#bbb', marginBottom: 6, letterSpacing: 1 }}>
                        EINGETRAGENE SESSIONS ({sorted.length})
                    </div>
                    {sorted.map(e => (
                        <div key={e.id} style={{
                            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5,
                            padding: '5px 8px',
                            background: isDark ? '#0d1117' : '#f9f9f9',
                            borderLeft: `3px solid ${isDark ? '#4a235a' : '#ce93d8'}`,
                            borderRadius: '0 4px 4px 0',
                        }}>
                            <span style={{ fontSize: '0.7rem', minWidth: 18, color: isDark ? '#7b1fa2' : '#9c27b0' }}>◇</span>
                            <span style={{ fontSize: '0.83rem', flex: 1, color: isDark ? '#ccc' : '#444' }}>
                                <b>{e.date}</b>
                                {e.time && <span style={{ color: isDark ? '#888' : '#999' }}> · {e.time}</span>}
                                {e.durationMin != null && <span style={{ color: isDark ? '#888' : '#999' }}> · ~{e.durationMin} Min</span>}
                                <span style={{
                                    marginLeft: 8, padding: '1px 6px', borderRadius: 3, fontSize: '0.88rem',
                                    background: e.type === 'vaginal' ? (isDark ? '#880e4f' : '#fce4ec') : (isDark ? '#1a237e' : '#e8eaf6'),
                                    color: e.type === 'vaginal' ? (isDark ? '#f48fb1' : '#c2185b') : (isDark ? '#90caf9' : '#283593'),
                                }}>{e.type === 'vaginal' ? '♥ vaginal' : e.type === 'oral_hand' ? '◐ oral/hand' : '⬡ sonstiges'}</span>
                                <span style={{ marginLeft: 6, fontSize: '0.65rem', color: isDark ? '#555' : '#bbb' }}>◇ manuell</span>
                            </span>
                            <button onClick={() => onDelete(e.id)} style={{
                                background: 'transparent', border: 'none', color: isDark ? '#555' : '#bbb',
                                cursor: 'pointer', fontSize: '0.8rem', padding: '0 4px', lineHeight: 1,
                            }} title="Löschen">✕</button>
                        </div>
                    ))}
                    <div style={{ marginTop: 8, fontSize: '0.75rem', color: isDark ? '#333' : '#bbb' }}>
                        ◇ = manuell erfasst · kein Sensor · kein KI-Training · Im Kalender als hohle Symbole (♡ ○)
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

    // Labels aus native-Konfiguration (für MonthCalendar + LabelForm)
    const labels = parseSexTrainingLabels(native.sexTrainingLabels);

    const [cacheGen] = useState(0);

    // Datums-Navigation
    const [viewDate, setViewDate] = useState<Date>(() => {
        const d = new Date(); d.setHours(0, 0, 0, 0); return d;
    });

    // Geladene Daten: { [dateStr]: IntimacyEvent[] }
    const [dayData, setDayData] = useState<Record<string, IntimacyEvent[]>>({});
    const [loading, setLoading]  = useState(true);

    // Monatskalender
    const [calMonth, setCalMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
    const [monthSummary, setMonthSummary] = useState<Record<string, Array<{type:string;duration:number;score:number}>>>({});

    // Kalibrierungs-Info vom letzten gespeicherten Tag
    const [calibInfo, setCalibInfo] = useState<{
        src: string; n: number; calibA: number; calibB: number;
        pyClassifier?: {
            trained: boolean; n: number; counts: Record<string,number>; msg: string;
            feature_importances?: Array<{ name: string; importance: number }>;
            loo_accuracy?: number | null;
        } | null;
    } | null>(null);

    // Rohe Vibrations-Events für Chart: { [dateStr]: any[] }
    const [vibRaw, setVibRaw] = useState<Record<string, any[]>>({});

    // Retroaktive Neu-Analyse (Einzeltag)
    const [reanalyzing, setReanalyzing] = useState(false);
    const [reanalyzeMsg, setReanalyzeMsg] = useState<string | null>(null);

    // Alle Tage neu analysieren
    const [reanalyzingAll, setReanalyzingAll] = useState(false);
    const [reanalyzeAllMsg, setReanalyzeAllMsg] = useState<string | null>(null);

    // Manuelle Sessions (außerhalb Bett)
    const [manualEntries, setManualEntries] = useState<ManualSexEntry[]>([]);

    const loadManualEntries = async () => {
        try {
            const result: any = await socket.sendTo(
                `${adapterName}.${instance}`, 'getManualSexSessions', {}
            );
            if (result?.success) setManualEntries(result.entries ?? []);
        } catch { /* ignorieren */ }
    };

    const handleAddManual = async (entry: Omit<ManualSexEntry, 'id' | 'createdAt'>) => {
        try {
            const result: any = await socket.sendTo(
                `${adapterName}.${instance}`, 'saveManualSexSession', entry
            );
            if (result?.success) setManualEntries(result.entries ?? []);
        } catch { /* ignorieren */ }
    };

    const handleDeleteManual = async (id: string) => {
        try {
            const result: any = await socket.sendTo(
                `${adapterName}.${instance}`, 'deleteManualSexSession', { id }
            );
            if (result?.success) setManualEntries(result.entries ?? []);
        } catch { /* ignorieren */ }
    };

    const reanalyzeDay = async (d: Date) => {
        const ds = dateStr(d);
        setReanalyzing(true);
        setReanalyzeMsg(null);
        try {
            const result: any = await socket.sendTo(
                `${adapterName}.${instance}`, 'reanalyzeSexDay', { date: ds }
            );
            if (result?.success && result?.data) {
                const evts: IntimacyEvent[] = result.data.intimacyEvents ?? [];
                setDayData(prev => ({ ...prev, [ds]: evts }));
                if (result.data.sexCalibInfo) setCalibInfo(result.data.sexCalibInfo);
                const vibEvts = (result.data.eventHistory || []).filter((e: any) =>
                    (e.type === 'vibration_strength' || e.type === 'vibration_trigger') &&
                    (e.isVibrationBed || e.isFP2Bed)
                );
                setVibRaw(prev => ({ ...prev, [ds]: vibEvts }));
                setReanalyzeMsg(evts.length > 0 ? `✓ ${evts.length} Session(s) gefunden` : '✓ Keine Session erkannt');
            } else {
                setReanalyzeMsg('⚠ ' + (result?.error || 'Fehler'));
            }
        } catch (e: any) {
            setReanalyzeMsg('⚠ ' + (e?.message || 'Fehler'));
        }
        setReanalyzing(false);
        setTimeout(() => setReanalyzeMsg(null), 4000);
    };

    const reanalyzeAllDays = async () => {
        setReanalyzingAll(true);
        setReanalyzeAllMsg('Lade Tagesliste...');
        try {
            // Schritt 1: Datumsliste vom Backend holen
            const listResult: any = await socket.sendTo(
                `${adapterName}.${instance}`, 'reanalyzeAllSexDays', {}
            );
            if (!listResult?.success || !listResult?.dates) {
                setReanalyzeAllMsg('✗ ' + (listResult?.error || 'Fehler'));
                setReanalyzingAll(false);
                return;
            }
            const dates: string[] = listResult.dates;
            let sessionsFound = 0;
            let errors = 0;
            // Schritt 2: Jeden Tag einzeln analysieren (sequenziell)
            for (let i = 0; i < dates.length; i++) {
                setReanalyzeAllMsg(`${i + 1}/${dates.length} — ${dates[i]}`);
                try {
                    const r: any = await socket.sendTo(
                        `${adapterName}.${instance}`, 'reanalyzeSexDay', { date: dates[i] }
                    );
                    if (r?.success && r?.data) {
                        const evts = r.data.intimacyEvents ?? [];
                        sessionsFound += evts.length;
                        if (evts.length > 0) setDayData(prev => ({ ...prev, [dates[i]]: evts }));
                    } else { errors++; }
                } catch { errors++; }
            }
            const msg = `✓ ${dates.length} Tage — ${sessionsFound} Sessions${errors > 0 ? ` (${errors} Fehler)` : ''}`;
            setReanalyzeAllMsg(msg);
            // Kalender-Cache leeren und neu laden damit Icons sofort aktuell sind
            setMonthSummary({});
            loadMonth(calMonth);
        } catch (e: any) {
            setReanalyzeAllMsg('✗ ' + (e?.message || 'Fehler'));
        }
        setReanalyzingAll(false);
        setTimeout(() => setReanalyzeAllMsg(null), 8000);
    };

    const loadMonth = async (m: string) => {
        try {
            const result: any = await socket.sendTo(
                `${adapterName}.${instance}`, 'getSexMonthSummary', { month: m }
            );
            if (result?.success && result?.data) {
                setMonthSummary(prev => ({ ...prev, ...result.data }));
            }
        } catch { /* ignorieren */ }
    };

    const loadDay = async (d: Date) => {
        const ds = dateStr(d);
        if (dayData[ds] !== undefined) return;
        try {
            const result: any = await socket.sendTo(
                `${adapterName}.${instance}`, 'getHistoryData', { date: ds, _t: Date.now() }
            );
            const evts: IntimacyEvent[] = result?.data?.intimacyEvents ?? [];
            setDayData(prev => ({ ...prev, [ds]: evts }));
            // Kalibrierungs-Info vom aktuellen (heute/gestern) Tag merken
            if (result?.data?.sexCalibInfo) setCalibInfo(result.data.sexCalibInfo);
            // Vibrations-Events für Chart extrahieren
            const vibEvts = (result?.data?.eventHistory || []).filter((e: any) =>
                (e.type === 'vibration_strength' || e.type === 'vibration_trigger') &&
                (e.isVibrationBed || e.isFP2Bed)
            );
            setVibRaw(prev => ({ ...prev, [ds]: vibEvts }));
        } catch {
            setDayData(prev => ({ ...prev, [ds]: [] }));
            setVibRaw(prev => ({ ...prev, [dateStr(d)]: [] }));
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

    // Monatsdaten laden wenn calMonth sich ändert
    useEffect(() => { loadMonth(calMonth); }, [calMonth]); // eslint-disable-line react-hooks/exhaustive-deps

    // Manuelle Einträge einmalig laden
    useEffect(() => { loadManualEntries(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Vibrations-Sensor IDs aus native.devices
    const vibStrengthId: string | null = ((native.devices || []) as any[]).find(
        (d: any) => (d.type || '').toLowerCase() === 'vibration_strength' && (d.sensorFunction || '') === 'bed'
    )?.id ?? null;
    const vibTrigId: string | null = ((native.devices || []) as any[]).find(
        (d: any) => (d.type || '').toLowerCase() === 'vibration_trigger' && (d.sensorFunction || '') === 'bed'
    )?.id ?? null;

    const viewDayStart = new Date(viewDate).setHours(0, 0, 0, 0);
    const activeCalibA = calibInfo?.calibA ?? 50;
    const activeCalibB = calibInfo?.calibB ?? 30;

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
                    <button onClick={() => reanalyzeDay(viewDate)} disabled={reanalyzing}
                        title="Liest die gespeicherte JSON-Datei erneut ein und führt die Sex-Erkennung auf allen Events des Tages aus — auch Abend-Sessions die bei der Morgen-Analyse fehlten."
                        style={{
                            fontFamily: 'inherit', fontSize: '0.6rem', padding: '2px 8px',
                            background: reanalyzing ? (isDark ? '#111' : '#f5f5f5') : (isDark ? '#0d1a0d' : '#e8f5e9'),
                            border: `1px solid ${isDark ? '#2e7d32' : '#a5d6a7'}`,
                            color: isDark ? '#81c784' : '#2e7d32',
                            cursor: reanalyzing ? 'wait' : 'pointer', borderRadius: 2, opacity: reanalyzing ? 0.5 : 1
                        }}>
                        {reanalyzing ? '⟳ ...' : '⟳ Neu analysieren'}
                    </button>
                    {reanalyzeMsg && (
                        <span style={{ fontSize: '0.6rem', color: reanalyzeMsg.startsWith('✓') ? '#81c784' : '#ffb74d', marginLeft: 4 }}>
                            {reanalyzeMsg}
                        </span>
                    )}
                    <button onClick={reanalyzeAllDays} disabled={reanalyzingAll || reanalyzing}
                        title="Analysiert alle gespeicherten Tage neu und aktualisiert die Sex-Erkennung fuer die gesamte History. Kann einige Minuten dauern."
                        style={{
                            fontFamily: 'inherit', fontSize: '0.6rem', padding: '2px 8px',
                            background: reanalyzingAll ? (isDark ? '#111' : '#f5f5f5') : (isDark ? '#1a0d1a' : '#f3e5f5'),
                            border: `1px solid ${isDark ? '#7b1fa2' : '#ce93d8'}`,
                            color: isDark ? '#ce93d8' : '#7b1fa2',
                            cursor: reanalyzingAll ? 'wait' : 'pointer', borderRadius: 2, opacity: reanalyzingAll ? 0.5 : 1, marginLeft: 4
                        }}>
                        {reanalyzingAll ? '... ' : ' Alle neu analysieren'}
                    </button>
                    {reanalyzeAllMsg && (
                        <span style={{ fontSize: '0.6rem', color: reanalyzeAllMsg.startsWith('✓') ? '#81c784' : '#ffb74d', marginLeft: 4 }}>
                            {reanalyzeAllMsg}
                        </span>
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
                            labels={labels}
                            curDateStr={dateStr(viewDate)}
                            onChange={onChange}
                        />
                        <SevenDayHistory historyDays={historyDays} themeType={themeType} funMode={funMode} labels={labels} />
                        <MonthCalendar
                            month={calMonth}
                            summary={monthSummary}
                            manualEntries={manualEntries}
                            labels={labels}
                            viewDate={dateStr(viewDate)}
                            onDayClick={(d) => setViewDate(new Date(d + 'T12:00:00'))}
                            onMonthChange={(m) => { setCalMonth(m); }}
                            themeType={themeType}
                        />
                        <LabelForm native={native} onChange={onChange} themeType={themeType} dayData={dayData} loadDay={loadDay} />
                        <ManualSessionForm
                            themeType={themeType}
                            entries={manualEntries}
                            onAdd={handleAddManual}
                            onDelete={handleDeleteManual}
                        />
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
                            <div style={{ fontSize: '0.83rem', lineHeight: 1.8, color: isDark ? '#666' : '#888' }}>
                                <div style={{ color: isDark ? '#555' : '#aaa', fontSize: '0.88rem', marginBottom: 4 }}>ERKENNUNGS-SCHWELLEN</div>
                                <div>• Zeitfenster: <span style={{ color: isDark ? '#81c784' : '#388e3c' }}>kein Limit</span> <span style={{ color: isDark ? '#444' : '#bbb' }}>(ganzer Tag, Sex ist zeitlos)</span></div>
                                <div>• <b>Pfad A</b> (kurz+intensiv): ≥2×5 Min, Peak ≥<span style={{ color: isDark ? '#ab47bc' : '#7b1fa2' }}>{calibInfo ? calibInfo.calibA : 50}</span></div>
                                <div>• <b>Pfad B</b> (länger+moderat): ≥6×5 Min, Peak ≥<span style={{ color: isDark ? '#90caf9' : '#283593' }}>{calibInfo ? calibInfo.calibB : 30}</span></div>
                                <div style={{ borderTop: `1px dashed ${isDark ? '#222' : '#eee'}`, marginTop: 6, paddingTop: 6, color: isDark ? '#555' : '#aaa', fontSize: '0.88rem' }}>KALIBRIERUNG</div>
                                {calibInfo ? (
                                    <div style={{
                                        padding: '5px 8px', borderRadius: 3, marginBottom: 4,
                                        background: (calibInfo.src === 'labels' || calibInfo.src === 'labels_typed') ? (isDark ? '#1a2e1a' : '#e8f5e9') :
                                                    calibInfo.src === 'baseline' ? (isDark ? '#1a1a2e' : '#e8eaf6') :
                                                    calibInfo.src === 'manual' ? (isDark ? '#2e1a1a' : '#fce4ec') :
                                                    (isDark ? '#1a1a1a' : '#f5f5f5'),
                                        borderLeft: `3px solid ${(calibInfo.src === 'labels' || calibInfo.src === 'labels_typed') ? '#81c784' : calibInfo.src === 'baseline' ? '#90caf9' : calibInfo.src === 'manual' ? '#f48fb1' : '#666'}`,
                                    }}>
                                        {(calibInfo.src === 'labels' || calibInfo.src === 'labels_typed') && <span style={{ color: isDark ? '#81c784' : '#2e7d32' }}>✓ {calibInfo.src === 'labels_typed' ? 'Stufe-2-Kalibrierung (per Typ)' : 'Kalibriert'} aus {calibInfo.n} Sessions · A={calibInfo.calibA} B={calibInfo.calibB}</span>}
                                        {calibInfo.src === 'baseline' && <span style={{ color: isDark ? '#90caf9' : '#3949ab' }}>~ Anomalie-Baseline aktiv · A={calibInfo.calibA} B={calibInfo.calibB} <span style={{ opacity: 0.7 }}>(Training-Sessions eintragen für mehr Präzision)</span></span>}
                                        {calibInfo.src === 'manual' && <span style={{ color: isDark ? '#f48fb1' : '#c2185b' }}>⚙ Manuell: sexCalibThreshold · A={calibInfo.calibA} B={calibInfo.calibB}</span>}
                                        {calibInfo.src === 'default' && <span style={{ color: isDark ? '#555' : '#aaa' }}>Standard-Schwellen · A={calibInfo.calibA} B={calibInfo.calibB} <span style={{ opacity: 0.7 }}>(Training-Sessions eintragen)</span></span>}
                                    </div>
                                ) : (
                                    <div style={{ color: isDark ? '#444' : '#bbb', fontSize: '0.76rem' }}>
                                        — Kalibrierungsdaten noch nicht geladen (erst nach nächstem täglichen Speichern verfügbar)
                                    </div>
                                )}
                                <div>• Mehr Sessions eintragen → präzisere automatische Schwellen</div>
                               <div style={{ borderTop: `1px dashed ${isDark ? '#222' : '#eee'}`, marginTop: 6, paddingTop: 6, color: isDark ? '#555' : '#aaa', fontSize: '0.88rem' }}>TYP-KLASSIFIKATION (STUFE 1)</div>
                               <div>• Peak ≥ calibA×1.5 + Slots → <span style={{ color: isDark ? '#f48fb1' : '#c2185b' }}>vaginal</span></div>
                               <div>• Peak ≥ calibA oder Pfad B → <span style={{ color: isDark ? '#90caf9' : '#283593' }}>oral/hand</span></div>
                               <div>• Default → <span style={{ color: '#888' }}>intim</span></div>
                               <div style={{ borderTop: `1px dashed ${isDark ? '#222' : '#eee'}`, marginTop: 6, paddingTop: 6, color: isDark ? '#555' : '#aaa', fontSize: '0.88rem' }}>KI-KLASSIFIKATOR (STUFE 3)</div>
                               {calibInfo?.pyClassifier ? (
                                   calibInfo.pyClassifier.trained ? (
                                       <div style={{ padding: '6px 7px', borderRadius: 3, background: isDark ? '#0d1a2d' : '#e8eaf6', borderLeft: '3px solid #90caf9' }}>
                                           <div style={{ color: isDark ? '#90caf9' : '#3949ab', fontWeight: 'bold', marginBottom: 4 }}>
                                               🤖 Aktiv — {calibInfo.pyClassifier.n} Sessions trainiert
                                               {calibInfo.pyClassifier.counts && Object.entries(calibInfo.pyClassifier.counts).length > 0 && (
                                                   <span style={{ opacity: 0.7, fontWeight: 'normal' }}> ({Object.entries(calibInfo.pyClassifier.counts).map(([k,v]) => `${k === 'vaginal' ? '♥' : '◐'} ${v}x`).join(', ')})</span>
                                               )}
                                           </div>
                                           {/* LOO-Genauigkeit */}
                                           {calibInfo.pyClassifier.loo_accuracy != null && (
                                               <div style={{ fontSize: '0.76rem', color: isDark ? '#64b5f6' : '#1565c0', marginBottom: 4 }}>
                                                   📊 Leave-One-Out Genauigkeit:{' '}
                                                   <strong>{Math.round(calibInfo.pyClassifier.loo_accuracy * 100)}%</strong>
                                                   <span style={{ opacity: 0.6, fontSize: '0.7rem' }}> ({calibInfo.pyClassifier.n} Folds)</span>
                                               </div>
                                           )}
                                           {/* Feature-Importance Top 5 */}
                                           {calibInfo.pyClassifier.feature_importances && calibInfo.pyClassifier.feature_importances.length > 0 && (
                                               <div style={{ fontSize: '0.72rem', color: isDark ? '#888' : '#666', marginTop: 2 }}>
                                                   <div style={{ marginBottom: 3, color: isDark ? '#666' : '#aaa' }}>Wichtigste Merkmale:</div>
                                                   {calibInfo.pyClassifier.feature_importances.slice(0, 5).map((f, fi) => (
                                                       <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                                                           <span style={{ width: 90, flexShrink: 0, color: isDark ? '#90caf9' : '#3949ab' }}>{f.name}</span>
                                                           <div style={{ flex: 1, height: 5, background: isDark ? '#1a1a2e' : '#ddd', borderRadius: 3, overflow: 'hidden' }}>
                                                               <div style={{ width: `${Math.round(f.importance * 100)}%`, height: '100%', background: isDark ? '#5c6bc0' : '#7986cb', borderRadius: 3 }} />
                                                           </div>
                                                           <span style={{ width: 32, textAlign: 'right', color: isDark ? '#555' : '#bbb' }}>{Math.round(f.importance * 100)}%</span>
                                                       </div>
                                                   ))}
                                               </div>
                                           )}
                                       </div>
                                   ) : (
                                       <div style={{ padding: '4px 7px', borderRadius: 3, background: isDark ? '#1a1a1a' : '#f5f5f5', borderLeft: '3px solid #555' }}>
                                           <span style={{ color: isDark ? '#666' : '#aaa' }}>⏳ Noch nicht aktiv — {calibInfo.pyClassifier.msg}</span>
                                       </div>
                                   )
                               ) : (
                                   <div style={{ color: isDark ? '#444' : '#bbb', fontSize: '0.76rem' }}>
                                       — Wird aktiv ab 5 Labels (mind. 2× vaginal + 2× oral)
                                   </div>
                               )}
                            </div>
                        </TerminalBox>

                        <TerminalBox title="DATENSCHUTZ" themeType={themeType}>
                            <div style={{ fontSize: '0.83rem', lineHeight: 1.8, color: isDark ? '#555' : '#888' }}>
                                <div>🔒 Alle Daten bleiben <strong style={{ color: isDark ? '#888' : '#555' }}>lokal</strong> auf diesem ioBroker-System</div>
                                <div>🚫 Keine Übertragung in die Cloud</div>
                                <div>📁 Gespeichert als tägliche JSON-Datei (History)</div>
                                <div>⚙️ Deaktivierbar in Einstellungen → Module</div>
                                <div style={{ marginTop: 6, fontSize: '0.83rem', color: isDark ? '#333' : '#bbb' }}>
                                    Kein Medizinprodukt · Keine klinische Nutzung
                                </div>
                            </div>
                        </TerminalBox>
                    </div>
                </div>
            )}

            {/* ── Vibrationsverlauf ── */}
            {funMode && (
                <VibrationChartPanel
                    vibRaw={vibRaw[todayDs] ?? []}
                    sessions={todayEvents}
                    calibA={activeCalibA}
                    calibB={activeCalibB}
                    isDark={isDark}
                    dayStart={viewDayStart}
                    isToday={isToday}
                    socket={socket}
                    strengthId={vibStrengthId}
                    trigId={vibTrigId}
                />
            )}
        </div>
    );
};

export default SexTab;

