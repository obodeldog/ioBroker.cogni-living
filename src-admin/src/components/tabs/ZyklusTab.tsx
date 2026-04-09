import React, { useState, useMemo } from 'react';
import { Tooltip as MuiTooltip } from '@mui/material';

// Hilfsfunktion: Datum als YYYY-MM-DD
function toDateStr(d: Date): string {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ─────────────────────────────────────────────────────────────────────────────
// ZYKLUS-TAB — Wissenschaftlich fundiertes Zyklustracking (Knaus-Ogino + adaptiver Durchschnitt)
// Alle Berechnungen lokal, keine Cloud-Übertragung
// ─────────────────────────────────────────────────────────────────────────────

interface ZyklusTabProps {
    native: Record<string, any>;
    themeType?: string;
    onChange: (attr: string, value: any) => void;
}

// ── Phasen-Definitionen ───────────────────────────────────────────────────────
interface Phase {
    id: string;
    label: string;
    short: string;
    color: string;
    bg: string;
    emoji: string;
    tip: string;
    startDay: number;
    endDay: number;
}

function calcPhasen(zyklusLen: number): Phase[] {
    // Lutealphase ist konstant ~14 Tage → Eisprung = zyklusLen - 14
    const ovDay = zyklusLen - 14;
    const fertileStart = Math.max(ovDay - 5, 6);
    const fertileEnd = ovDay + 1;
    const pmsStart = zyklusLen - 4;

    return [
        { id: 'mens',     label: 'Menstruation',    short: 'MENS',    color: '#e57373', bg: '#ffebee', emoji: '🩸', tip: 'Blutung, Östrogen und Progesteron tief. Energie niedrig, Wärme und Ruhe tun gut.', startDay: 1, endDay: 5 },
        { id: 'follikel', label: 'Follikelphase',   short: 'FOL',     color: '#4fc3f7', bg: '#e1f5fe', emoji: '📈', tip: 'Östrogen steigt, FSH aktiviert Follikelwachstum. Energie und Libido nehmen zu.', startDay: 6, endDay: fertileStart - 1 },
        { id: 'fruchtbar',label: 'Fruchtbares Fenster', short: 'FRUCHT', color: '#81c784', bg: '#e8f5e9', emoji: '🌿', tip: `Fruchtbarkeitsphase: Spermien überleben 3-5 Tage. Hochfruchtbar ab Tag ${fertileStart}.`, startDay: fertileStart, endDay: ovDay - 1 },
        { id: 'eisprung', label: 'Eisprung',        short: 'OV',      color: '#ffb74d', bg: '#fff8e1', emoji: '🥚', tip: `Eisprung um Tag ${ovDay}. LH-Peak 24-36h vorher. Eizelle 12-24h befruchtungsfähig. Maximale Fruchtbarkeit.`, startDay: ovDay, endDay: fertileEnd },
        { id: 'luteal',   label: 'Lutealphase',     short: 'LUT',     color: '#ce93d8', bg: '#f3e5f5', emoji: '💜', tip: 'Progesteron dominiert. Körpertemperatur +0,4°C. Energie variabel, Stimmung kann schwanken.', startDay: fertileEnd + 1, endDay: pmsStart - 1 },
        { id: 'pms',      label: 'PMS',             short: 'PMS',     color: '#a1887f', bg: '#efebe9', emoji: '😤', tip: 'Progesteron und Östrogen fallen. Mögliche Symptome: Reizbarkeit, Müdigkeit, Wassereinlagerungen.', startDay: pmsStart, endDay: zyklusLen },
    ];
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function parseStartDaten(raw: string): Date[] {
    if (!raw || !raw.trim()) return [];
    return raw.split(',')
        .map(s => s.trim())
        .filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s))
        .map(s => new Date(s + 'T06:00:00'))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime()); // neueste zuerst
}

function calcAvgZyklus(dates: Date[], defaultLen: number): number {
    if (dates.length < 2) return defaultLen;
    const diffs: number[] = [];
    for (let i = 0; i < dates.length - 1; i++) {
        const diff = Math.round((dates[i].getTime() - dates[i + 1].getTime()) / 86400000);
        if (diff >= 21 && diff <= 45) diffs.push(diff);
    }
    if (diffs.length === 0) return defaultLen;
    return Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
}

function getZyklusTag(lastStart: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - lastStart.getTime();
    return Math.max(1, Math.floor(diffMs / 86400000) + 1);
}

function getCurrentPhase(tag: number, phasen: Phase[]): Phase {
    return phasen.find(p => tag >= p.startDay && tag <= p.endDay) ?? phasen[phasen.length - 1];
}

function getNextPeriod(lastStart: Date, zyklusLen: number): Date {
    const d = new Date(lastStart);
    d.setDate(d.getDate() + zyklusLen);
    return d;
}

function formatDate(d: Date): string {
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateShort(d: Date): string {
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function daysUntil(target: Date): number {
    return Math.round((target.getTime() - Date.now()) / 86400000);
}

function konfidenz(dates: Date[]): { label: string; color: string } {
    if (dates.length >= 5) return { label: 'Hoch ✓', color: '#81c784' };
    if (dates.length >= 3) return { label: 'Mittel', color: '#ffb74d' };
    if (dates.length >= 1) return { label: 'Niedrig', color: '#ef9a9a' };
    return { label: 'Keine Daten', color: '#888' };
}

// ── TerminalBox (wie SexTab) ───────────────────────────────────────────────────
const TB = ({ title, children, isDark, borderColor = '#f06292' }: {
    title: string; children: React.ReactNode; isDark: boolean; borderColor?: string;
}) => (
    <div style={{
        border: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
        borderRadius: 6,
        marginBottom: 12,
        overflow: 'hidden',
        boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 1px 4px rgba(0,0,0,0.08)',
    }}>
        <div style={{
            background: isDark ? '#1a1a2e' : '#1a1a2e',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: `2px solid ${borderColor}`,
        }}>
            <div style={{ display: 'flex', gap: 5 }}>
                {['#ff5f57', '#febc2e', '#28c840'].map(c => (
                    <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
                ))}
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: borderColor, letterSpacing: 2, fontWeight: 700 }}>
                {title}
            </span>
        </div>
        <div style={{
            background: isDark ? '#0d1117' : '#fafafa',
            padding: '14px 16px',
            fontFamily: 'monospace',
            fontSize: '0.78rem',
            color: isDark ? '#c9d1d9' : '#24292e',
        }}>
            {children}
        </div>
    </div>
);

// ── Phasenband (horizontale Timeline) ────────────────────────────────────────
const PhasenBand = ({ phasen, zyklusLen, currentTag, isDark }: {
    phasen: Phase[]; zyklusLen: number; currentTag: number; isDark: boolean;
}) => {
    const posPercent = Math.min(99, ((currentTag - 0.5) / zyklusLen) * 100);

    return (
        <div style={{ userSelect: 'none' }}>
            {/* Farbband */}
            <div style={{ display: 'flex', height: 28, borderRadius: 4, overflow: 'hidden', position: 'relative', border: `1px solid ${isDark ? '#333' : '#ddd'}` }}>
                {phasen.map(p => {
                    const widthPct = ((p.endDay - p.startDay + 1) / zyklusLen) * 100;
                    return (
                        <MuiTooltip key={p.id} title={<span style={{fontSize:'0.8rem'}}>{p.emoji} <b>{p.label}</b> (Tag {p.startDay}–{p.endDay}): {p.tip}</span>} arrow>
                            <div style={{
                                width: `${widthPct}%`,
                                background: p.color,
                                opacity: 0.85,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.6rem', color: '#fff', fontWeight: 700, letterSpacing: 1,
                                cursor: 'help',
                            }}>
                                {widthPct > 7 ? p.short : ''}
                            </div>
                        </MuiTooltip>
                    );
                })}
                {/* HEUTE-Markierung */}
                <div style={{
                    position: 'absolute',
                    left: `${posPercent}%`,
                    top: 0, bottom: 0, width: 3,
                    background: '#fff',
                    boxShadow: '0 0 6px 2px rgba(255,255,255,0.8)',
                    borderRadius: 2,
                    zIndex: 2,
                }} />
            </div>

            {/* Tag-Beschriftungen */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: '0.55rem', color: isDark ? '#555' : '#999' }}>
                {[1, 7, 14, 21, zyklusLen].map(t => (
                    <span key={t} style={{ minWidth: 16, textAlign: 'center' }}>{t}</span>
                ))}
            </div>

            {/* Phasen-Legende */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 8 }}>
                {phasen.map(p => (
                    <MuiTooltip key={p.id} title={p.tip} arrow>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'help' }}>
                            <div style={{ width: 10, height: 10, background: p.color, borderRadius: 2, flexShrink: 0 }} />
                            <span style={{ fontSize: '0.65rem', color: isDark ? '#aaa' : '#555' }}>
                                {p.emoji} {p.label} (T{p.startDay}–{p.endDay})
                            </span>
                        </div>
                    </MuiTooltip>
                ))}
            </div>
        </div>
    );
};

// ── 6-Monats-Verlauf ──────────────────────────────────────────────────────────
const ZyklusVerlauf = ({ dates, zyklusLen, isDark }: {
    dates: Date[]; zyklusLen: number; isDark: boolean;
}) => {
    if (dates.length < 2) {
        return (
            <div style={{ color: isDark ? '#555' : '#aaa', fontSize: '0.72rem', padding: '8px 0' }}>
                Mindestens 2 Zyklusstarts nötig für Verlaufsübersicht.
            </div>
        );
    }

    const cycles: Array<{ start: Date; end: Date; len: number }> = [];
    for (let i = 0; i < dates.length - 1; i++) {
        const len = Math.round((dates[i].getTime() - dates[i + 1].getTime()) / 86400000);
        if (len >= 21 && len <= 45) {
            cycles.push({ start: dates[i + 1], end: dates[i], len });
        }
    }

    const avg = calcAvgZyklus(dates, zyklusLen);
    const maxLen = Math.max(...cycles.map(c => c.len), zyklusLen);

    return (
        <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.68rem', color: isDark ? '#81c784' : '#388e3c' }}>
                    Ø Zykluslänge: <b>{avg} Tage</b>
                </span>
                <span style={{ fontSize: '0.68rem', color: isDark ? '#888' : '#666' }}>
                    ({cycles.length} Zyklen ausgewertet)
                </span>
            </div>

            {cycles.slice(0, 6).reverse().map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: '0.62rem', color: isDark ? '#666' : '#999', minWidth: 90 }}>
                        {formatDateShort(c.start)} – {formatDateShort(c.end)}
                    </span>
                    <div style={{
                        flex: 1, height: 12, background: isDark ? '#1a1a2e' : '#f0f0f0',
                        borderRadius: 2, overflow: 'hidden', position: 'relative',
                    }}>
                        <div style={{
                            width: `${(c.len / maxLen) * 100}%`,
                            height: '100%',
                            background: Math.abs(c.len - avg) <= 1 ? '#81c784' :
                                Math.abs(c.len - avg) <= 3 ? '#ffb74d' : '#ef9a9a',
                        }} />
                    </div>
                    <span style={{ fontSize: '0.65rem', minWidth: 50, color: isDark ? '#aaa' : '#555' }}>
                        {c.len} Tage {c.len === avg ? '(Ø)' : c.len < avg ? '▼' : '▲'}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ── 3-Monats-Prognose ─────────────────────────────────────────────────────────
const Prognose = ({ lastStart, zyklusLen, isDark }: {
    lastStart: Date; zyklusLen: number; isDark: boolean;
}) => {
    const ovDay = zyklusLen - 14;
    const forecasts = [0, 1, 2].map(n => {
        const start = new Date(lastStart);
        start.setDate(start.getDate() + n * zyklusLen);
        const ov = new Date(start); ov.setDate(ov.getDate() + ovDay - 1);
        const fertStart = new Date(start); fertStart.setDate(fertStart.getDate() + Math.max(ovDay - 6, 5));
        const fertEnd = new Date(start); fertEnd.setDate(fertEnd.getDate() + ovDay);
        const next = new Date(start); next.setDate(next.getDate() + zyklusLen);
        return { n, start, ov, fertStart, fertEnd, next };
    });

    return (
        <div>
            {forecasts.map(f => {
                const isCurrentCycle = f.n === 0;
                const daysTilOv = daysUntil(f.ov);
                const daysTilNext = daysUntil(f.next);
                return (
                    <div key={f.n} style={{
                        marginBottom: 8, padding: '8px 10px',
                        background: isCurrentCycle ? (isDark ? '#1a2e1a' : '#e8f5e9') : (isDark ? '#111' : '#fafafa'),
                        borderRadius: 4,
                        border: isCurrentCycle ? '1px solid #81c784' : `1px solid ${isDark ? '#222' : '#eee'}`,
                    }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: isCurrentCycle ? '#81c784' : (isDark ? '#888' : '#999'), marginBottom: 4 }}>
                            {isCurrentCycle ? '▶ AKTUELLER ZYKLUS' : `Zyklus +${f.n} (ab ${formatDate(f.start)})`}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                            <span style={{ fontSize: '0.65rem' }}>
                                🩸 Periode: <b style={{ color: '#e57373' }}>{formatDate(f.start)}</b>
                            </span>
                            <span style={{ fontSize: '0.65rem' }}>
                                🌿 Fruchtbar: <b style={{ color: '#81c784' }}>{formatDateShort(f.fertStart)}–{formatDateShort(f.fertEnd)}</b>
                            </span>
                            <span style={{ fontSize: '0.65rem' }}>
                                🥚 Eisprung: <b style={{ color: '#ffb74d' }}>{formatDate(f.ov)}</b>
                                {isCurrentCycle && (
                                    <span style={{ color: daysTilOv < 0 ? '#888' : '#ffb74d', marginLeft: 4 }}>
                                        ({daysTilOv < 0 ? `vor ${Math.abs(daysTilOv)}d` : `in ${daysTilOv}d`})
                                    </span>
                                )}
                            </span>
                            <span style={{ fontSize: '0.65rem' }}>
                                📅 Nächste Periode: <b style={{ color: '#e57373' }}>{formatDate(f.next)}</b>
                                {isCurrentCycle && (
                                    <span style={{ color: daysTilNext < 3 ? '#e57373' : (isDark ? '#888' : '#999'), marginLeft: 4 }}>
                                        ({daysTilNext < 0 ? `vor ${Math.abs(daysTilNext)}d` : `in ${daysTilNext}d`})
                                    </span>
                                )}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ── Zyklusdaten-Management ─────────────────────────────────────────────────────
const ZyklusDatenManager = ({ native, onChange, isDark }: {
    native: Record<string, any>; onChange: (attr: string, val: any) => void; isDark: boolean;
}) => {
    const [newDate, setNewDate] = useState('');
    const rawDaten = native.zyklusStartDaten || '';
    const zyklusLaenge = parseInt(native.zyklusLaenge) || 28;

    const dates = parseStartDaten(rawDaten);
    const dateStrs = dates.map(d => toDateStr(d)).sort((a, b) => b.localeCompare(a));

    const handleAdd = () => {
        if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return;
        if (dateStrs.includes(newDate)) return;
        const updated = [...dateStrs, newDate].sort((a, b) => b.localeCompare(a));
        onChange('zyklusStartDaten', updated.join(', '));
        setNewDate('');
    };

    const handleDelete = (ds: string) => {
        const updated = dateStrs.filter(d => d !== ds);
        onChange('zyklusStartDaten', updated.join(', '));
    };

    const inputStyle = {
        background: isDark ? '#1a1a1a' : '#fff',
        color: isDark ? '#eee' : '#111',
        border: `1px solid ${isDark ? '#444' : '#ccc'}`,
        borderRadius: 3, padding: '4px 8px',
        fontFamily: 'monospace', fontSize: '0.72rem',
    };

    return (
        <TB title="ZYKLUSDATEN VERWALTEN" isDark={isDark} borderColor="#f06292">
            {/* Zykluslänge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: '0.68rem', color: isDark ? '#aaa' : '#555' }}>Standard-Zykluslänge:</span>
                <input type="number" value={zyklusLaenge} min={21} max={45}
                    onChange={e => onChange('zyklusLaenge', parseInt(e.target.value) || 28)}
                    style={{ ...inputStyle, width: 60 }} />
                <span style={{ fontSize: '0.6rem', color: isDark ? '#555' : '#aaa' }}>Tage (adaptiv ab 2 Zyklen)</span>
            </div>

            {/* Neues Datum hinzufügen */}
            <div style={{ fontSize: '0.5rem', color: isDark ? '#555' : '#aaa', marginBottom: 4, letterSpacing: 1 }}>
                ERSTEN BLUTUNGSTAG EINTRAGEN
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                <input type="date" value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    max={toDateStr(new Date())}
                    style={{ ...inputStyle, width: 140 }} />
                <button onClick={handleAdd}
                    style={{
                        background: isDark ? '#1a1a2e' : '#fce4ec',
                        color: isDark ? '#f48fb1' : '#c2185b',
                        border: `1px solid ${isDark ? '#4a148c' : '#f48fb1'}`,
                        borderRadius: 4, padding: '5px 14px',
                        fontFamily: 'monospace', fontSize: '0.72rem',
                        cursor: 'pointer', fontWeight: 700, letterSpacing: 1,
                    }}>
                    🩸 HINZUFÜGEN
                </button>
            </div>

            {/* Liste der Zyklusstarts */}
            <div style={{ fontSize: '0.5rem', color: isDark ? '#444' : '#bbb', marginBottom: 6, letterSpacing: 1 }}>
                EINGETRAGENE ZYKLUSSTARTS ({dateStrs.length})
            </div>
            {dateStrs.length === 0 ? (
                <div style={{ fontSize: '0.65rem', color: isDark ? '#444' : '#bbb', fontStyle: 'italic' }}>
                    Noch keine Daten — trage mindestens einen Zyklusstart ein.
                </div>
            ) : (
                <div>
                    {dateStrs.map((ds, i) => {
                        const isNewest = i === 0;
                        const prev = dateStrs[i + 1];
                        const cycleLen = prev ? Math.round((new Date(ds + 'T06:00:00').getTime() - new Date(prev + 'T06:00:00').getTime()) / 86400000) : null;
                        return (
                            <div key={ds} style={{
                                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5,
                                padding: '5px 8px',
                                background: isDark ? '#0d1117' : '#f9f9f9',
                                borderLeft: `3px solid ${isNewest ? '#f06292' : (isDark ? '#333' : '#ddd')}`,
                                borderRadius: '0 4px 4px 0',
                            }}>
                                <span style={{ fontSize: '0.7rem', minWidth: 18, color: isDark ? '#f48fb1' : '#e91e63' }}>
                                    {isNewest ? '▶' : '·'}
                                </span>
                                <span style={{ fontSize: '0.72rem', flex: 1, fontFamily: 'monospace', color: isDark ? '#ccc' : '#444' }}>
                                    <b>{ds}</b>
                                    {isNewest && <span style={{ fontSize: '0.6rem', color: isDark ? '#888' : '#999', marginLeft: 8 }}>aktuellster</span>}
                                    {cycleLen !== null && cycleLen >= 21 && cycleLen <= 45 && (
                                        <span style={{ fontSize: '0.6rem', color: isDark ? '#888' : '#999', marginLeft: 8 }}>
                                            → {cycleLen}d Zyklus
                                        </span>
                                    )}
                                </span>
                                <button onClick={() => handleDelete(ds)} style={{
                                    background: 'transparent', border: 'none',
                                    color: isDark ? '#555' : '#bbb',
                                    cursor: 'pointer', fontSize: '0.8rem', padding: '0 4px', lineHeight: 1,
                                }} title="Löschen">✕</button>
                            </div>
                        );
                    })}
                    <div style={{ marginTop: 6, fontSize: '0.55rem', color: isDark ? '#333' : '#bbb' }}>
                        ▶ = laufender Zyklus · Zykluslänge wird ab 2 Einträgen adaptiv berechnet
                    </div>
                </div>
            )}
        </TB>
    );
};

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function ZyklusTab({ native, themeType, onChange }: ZyklusTabProps) {
    const isDark = themeType === 'dark';
    const [showWiss, setShowWiss] = useState(false);

    const zyklusLaengeDefault = parseInt(native.zyklusLaenge) || 28;
    const rawDaten = native.zyklusStartDaten || '';

    const dates = useMemo(() => parseStartDaten(rawDaten), [rawDaten]);
    const avgLen = useMemo(() => calcAvgZyklus(dates, zyklusLaengeDefault), [dates, zyklusLaengeDefault]);
    const phasen = useMemo(() => calcPhasen(avgLen), [avgLen]);
    const konf = konfidenz(dates);

    const lastStart = dates.length > 0 ? dates[0] : null;
    const currentTag = lastStart ? getZyklusTag(lastStart) : null;
    const currentPhase = (currentTag && currentTag <= avgLen) ? getCurrentPhase(currentTag, phasen) : null;

    if (!native.moduleZyklus) {
        return (
            <TB title="ZYKLUS — DEAKTIVIERT" isDark={isDark} borderColor="#f06292">
                <div style={{ color: isDark ? '#555' : '#aaa', padding: '20px 0', textAlign: 'center' }}>
                    🌸 Zyklus-Kachel ist deaktiviert.<br />
                    <span style={{ fontSize: '0.7rem' }}>Aktivieren unter Einstellungen → Datenschutz-Module → Zyklus-Kachel</span>
                </div>
            </TB>
        );
    }

    return (
        <div style={{ fontFamily: 'monospace' }}>
            {/* ZYKLUSDATEN VERWALTEN — oben, immer sichtbar */}
            <ZyklusDatenManager native={native} onChange={onChange} isDark={isDark} />

            {/* HEUTE BLOCK */}
            <TB title="ZYKLUS — HEUTE" isDark={isDark} borderColor="#f06292">
                {!lastStart ? (
                    <div style={{ color: isDark ? '#ef9a9a' : '#e57373', padding: '8px 0' }}>
                        ⚠ Kein Zyklusstart eingetragen.<br />
                        <span style={{ fontSize: '0.7rem', color: isDark ? '#666' : '#aaa' }}>
                            Bitte in den Einstellungen den ersten Blutungstag eintragen.
                        </span>
                    </div>
                ) : (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                            {currentPhase && (
                                <div style={{
                                    background: currentPhase.color,
                                    color: '#fff',
                                    borderRadius: 6,
                                    padding: '6px 14px',
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    letterSpacing: 1,
                                }}>
                                    {currentPhase.emoji} {currentPhase.label.toUpperCase()}
                                </div>
                            )}
                            <div>
                                <div style={{ fontSize: '0.72rem', color: isDark ? '#888' : '#999' }}>ZYKLUSTAG</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: isDark ? '#f48fb1' : '#e91e63', lineHeight: 1 }}>
                                    {currentTag !== null ? (currentTag > avgLen ? `+${currentTag - avgLen}` : currentTag) : '—'}
                                </div>
                                <div style={{ fontSize: '0.6rem', color: isDark ? '#555' : '#aaa' }}>von {avgLen}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.72rem', color: isDark ? '#888' : '#999' }}>PROGNOSE-KONFIDENZ</div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: konf.color }}>{konf.label}</div>
                                <div style={{ fontSize: '0.6rem', color: isDark ? '#555' : '#aaa' }}>{dates.length} Zyklen gespeichert</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.72rem', color: isDark ? '#888' : '#999' }}>Ø ZYKLUSLÄNGE</div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: isDark ? '#ce93d8' : '#9c27b0' }}>{avgLen} Tage</div>
                                {avgLen !== zyklusLaengeDefault && (
                                    <div style={{ fontSize: '0.6rem', color: isDark ? '#555' : '#aaa' }}>adaptiv (Einstellung: {zyklusLaengeDefault}d)</div>
                                )}
                            </div>
                        </div>

                        {/* Phasenband */}
                        <PhasenBand phasen={phasen} zyklusLen={avgLen} currentTag={currentTag ?? 1} isDark={isDark} />

                        {/* Kontext-Hinweis */}
                        {currentPhase && (
                            <div style={{
                                marginTop: 10, padding: '6px 10px',
                                background: isDark ? '#111' : '#f9f9f9',
                                borderLeft: `3px solid ${currentPhase.color}`,
                                borderRadius: '0 4px 4px 0',
                                fontSize: '0.7rem', color: isDark ? '#aaa' : '#555',
                            }}>
                                {currentPhase.tip}
                            </div>
                        )}
                    </div>
                )}
            </TB>

            {/* 3-MONATS-PROGNOSE */}
            {lastStart && (
                <TB title="PROGNOSE — NÄCHSTE 3 MONATE" isDark={isDark} borderColor="#ffb74d">
                    <Prognose lastStart={lastStart} zyklusLen={avgLen} isDark={isDark} />
                </TB>
            )}

            {/* VERLAUF */}
            <TB title={`VERLAUF — ${Math.min(dates.length - 1, 6)} AUSGEWERTETE ZYKLEN`} isDark={isDark} borderColor="#ce93d8">
                <ZyklusVerlauf dates={dates} zyklusLen={avgLen} isDark={isDark} />
                {dates.length === 0 && (
                    <div style={{ color: isDark ? '#555' : '#aaa', fontSize: '0.72rem' }}>
                        Noch keine Daten. Trage in den Einstellungen die Startdaten ein.
                    </div>
                )}
                {dates.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: '0.62rem', color: isDark ? '#444' : '#bbb' }}>
                        Eingetragene Daten: {dates.map(d => formatDate(d)).join(' • ')}
                    </div>
                )}
            </TB>

            {/* WISSENSCHAFTLICHE GRUNDLAGEN */}
            <TB title="ALGORITHMUS & WISSENSCHAFT" isDark={isDark} borderColor="#4fc3f7">
                <div
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: showWiss ? 10 : 0 }}
                    onClick={() => setShowWiss(v => !v)}
                >
                    <span style={{ color: '#4fc3f7', fontSize: '0.7rem' }}>{showWiss ? '▼' : '▶'}</span>
                    <span style={{ fontSize: '0.7rem', color: isDark ? '#888' : '#666' }}>
                        Berechnungsgrundlagen anzeigen (Knaus-Ogino, Lutealphase, fertiles Fenster)
                    </span>
                </div>
                {showWiss && (
                    <div style={{ fontSize: '0.68rem', color: isDark ? '#aaa' : '#555', lineHeight: 1.8 }}>
                        <div style={{ color: '#4fc3f7', fontWeight: 700, marginBottom: 4 }}>METHODE: Knaus-Ogino + adaptiver Durchschnitt</div>
                        <div>• <b>Eisprung:</b> Zykluslänge − 14 Tage (Lutealphase konstant ~14d)</div>
                        <div>• <b>Früheste fruchtbare Tag:</b> Eisprung − 5 Tage (Spermien überleben 3–5d)</div>
                        <div>• <b>Letzter fruchtbarer Tag:</b> Eisprung + 1 Tag (Eizelle 12–24h viable)</div>
                        <div>• <b>Fertiles Fenster:</b> 6 Tage gesamt (wissenschaftlicher Konsens)</div>
                        <div>• <b>Adaptiver Ø:</b> Ab 2 Zyklen wird der individuelle Durchschnitt berechnet</div>
                        <div>• <b>Konfidenz:</b> ≥5 Zyklen = Hoch, ≥3 = Mittel, ≥1 = Niedrig</div>
                        <div style={{ marginTop: 6, color: '#e57373', fontSize: '0.62rem' }}>
                            ⚠ Prognosen sind Schätzwerte — nicht zur sicheren Empfängnisverhütung geeignet.
                        </div>
                    </div>
                )}
            </TB>

            {/* DATENSCHUTZ */}
            <TB title="DATENSCHUTZ" isDark={isDark} borderColor="#81c784">
                <div style={{ fontSize: '0.68rem', color: isDark ? '#aaa' : '#555', lineHeight: 1.8 }}>
                    <div>🔒 Alle Zyklus-Daten werden lokal in der Adapter-Konfiguration gespeichert</div>
                    <div>🚫 Keine Cloud-Übertragung, keine externen Server</div>
                    <div>📋 Daten können als CSV exportiert werden (für Gynäkologen)</div>
                </div>
            </TB>
        </div>
    );
}
