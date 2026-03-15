// Patch: LongtermTrendsView.tsx - Nykturie Chart mit dynamischem Schlaffenster
'use strict';
const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'src-admin', 'src', 'components', 'tabs', 'LongtermTrendsView.tsx');
let content = fs.readFileSync(filePath, 'utf8');
let changes = 0;

function replace(old, neu, label) {
    if (content.includes(old)) {
        content = content.replace(old, neu);
        console.log(`✓ ${label}`);
        changes++;
    } else {
        console.error(`✗ NOT FOUND: ${label}`);
    }
}

// ──────────────────────────────────────────────────────────────
// 1. DailyDataPoint: sleepWindowStart + sleepWindowEnd hinzufügen
// ──────────────────────────────────────────────────────────────
replace(
    `    bedPresenceMinutes?: number | null;
    nightVibrationCount?: number | null;
    maxPersonsDetected?: number | null;
    nocturiaCount?: number | null;
    isPartialDay?: boolean;`,
    `    bedPresenceMinutes?: number | null;
    nightVibrationCount?: number | null;
    maxPersonsDetected?: number | null;
    nocturiaCount?: number | null;
    sleepWindowStart?: number | null;   // ms-Timestamp Schlafbeginn
    sleepWindowEnd?: number | null;     // ms-Timestamp Aufwachen
    isPartialDay?: boolean;`,
    '1. DailyDataPoint interface'
);

// ──────────────────────────────────────────────────────────────
// 2. loadLongtermData: sleepWindow-Felder extrahieren
// ──────────────────────────────────────────────────────────────
replace(
    `                        // FP2 + Vibration Schlaf-Metriken (seit v0.33.3, null fuer alte Files)
                        const bedPresenceMinutes = histData.bedPresenceMinutes !== undefined ? Number(histData.bedPresenceMinutes) : null;
                        const nightVibrationCount = histData.nightVibrationCount !== undefined ? Number(histData.nightVibrationCount) : null;
                        const maxPersonsDetected = histData.maxPersonsDetected !== undefined ? Number(histData.maxPersonsDetected) : null;
                        const nocturiaCount = histData.nocturiaCount !== undefined ? Number(histData.nocturiaCount) : null;`,
    `                        // FP2 + Vibration Schlaf-Metriken (seit v0.33.3, null fuer alte Files)
                        const bedPresenceMinutes = histData.bedPresenceMinutes !== undefined ? Number(histData.bedPresenceMinutes) : null;
                        const nightVibrationCount = histData.nightVibrationCount !== undefined ? Number(histData.nightVibrationCount) : null;
                        const maxPersonsDetected = histData.maxPersonsDetected !== undefined ? Number(histData.maxPersonsDetected) : null;
                        const nocturiaCount = histData.nocturiaCount !== undefined ? Number(histData.nocturiaCount) : null;
                        // Dynamisches Schlaffenster (seit v0.33.6, null = kein FP2 oder Fixfenster)
                        const sleepWindowStart = histData.sleepWindowStart || null;
                        const sleepWindowEnd   = histData.sleepWindowEnd   || null;`,
    '2. extract sleepWindow in loadLongtermData'
);

// ──────────────────────────────────────────────────────────────
// 3. dailyData.push: sleepWindow-Felder hinzufügen
// ──────────────────────────────────────────────────────────────
replace(
    `                            bedPresenceMinutes,
                            nightVibrationCount,
                            maxPersonsDetected,
                            nocturiaCount,
                            roomActivity,`,
    `                            bedPresenceMinutes,
                            nightVibrationCount,
                            maxPersonsDetected,
                            nocturiaCount,
                            sleepWindowStart,
                            sleepWindowEnd,
                            roomActivity,`,
    '3. dailyData.push sleepWindow'
);

// ──────────────────────────────────────────────────────────────
// 4. Nykturie Chart: Ø-Fenster im Header + sleepWindow im Tooltip
// ──────────────────────────────────────────────────────────────
replace(
    `                                    {hasNocturiaData && (() => {
                                        const data = makeRawMiniData('nocturiaCount');
                                        const avgN = data.filter((d: any) => d.value != null).map((d: any) => d.value as number);
                                        const meanN = avgN.length > 0 ? Math.round(avgN.reduce((a, b) => a + b, 0) / avgN.length * 10) / 10 : 0;
                                        return (
                                            <Grid item xs={12} md={6} lg={4}>
                                                <Paper sx={{ p: 2, bgcolor: isDark ? '#0a0a0a' : '#ffffff', height: '100%' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                        <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#00acc1' }}>
                                                            NYKTURIE
                                                        </Typography>
                                                        <ChartHelp text={"Zählt eindeutige Nachtstunden (22–06 Uhr) mit Badezimmer-Aktivität. Regelmäßig >2 Besuche/Nacht können auf Nykturie hinweisen — ein Frühzeichen bei Diabetes, Herzinsuffizienz oder Harnwegsinfekt. Nur wenn Bad-Sensor mit Funktion 'Bad/WC' konfiguriert ist."} />
                                                    </Box>
                                                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                                                        Ø {meanN} Nachtstunden/Nacht · 22–06 Uhr
                                                    </Typography>
                                                    <ResponsiveContainer width="100%" height={150}>
                                                        <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                                            <XAxis dataKey="date" stroke={lineColor} style={{ fontSize: '0.6rem' }}
                                                                interval={Math.floor(data.length / 6)} />
                                                            <YAxis stroke={lineColor} style={{ fontSize: '0.6rem' }} domain={[0, 6]} />
                                                            <Tooltip
                                                                formatter={(v: any, name: string) => [
                                                                    name === 'value' ? \`\${v} Stunden\` : \`Ø \${v}\`,
                                                                    name === 'value' ? 'Nachtstunden aktiv' : '7-Tage-Ø'
                                                                ]}
                                                                contentStyle={{ backgroundColor: isDark ? '#1a1a1a' : '#fff', border: \`1px solid \${isDark ? '#444' : '#ddd'}\`, fontSize: '0.7rem' }}
                                                            />
                                                            <ReferenceArea y1={0} y2={2} fill="rgba(40,167,69,0.12)" />
                                                            <ReferenceArea y1={2} y2={6} fill="rgba(253,126,20,0.12)" />
                                                            <ReferenceLine y={2} stroke="#fd7e1455" strokeDasharray="4 3"
                                                                label={{ value: 'Nykturie-Grenze', position: 'insideRight', fontSize: 8, fill: '#fd7e14' }} />
                                                            <Bar dataKey="value" name="value" radius={[2,2,0,0]}>
                                                                {data.map((entry: any, i: number) => {
                                                                    const v = entry.value;
                                                                    const col = v == null ? '#555' : v >= 2 ? '#fd7e14' : '#00acc1';
                                                                    return <Cell key={i} fill={col} opacity={0.8} />;
                                                                })}
                                                            </Bar>
                                                            <Line type="monotone" dataKey="movingAvg" stroke="#006064" strokeWidth={2}
                                                                dot={false} name="movingAvg" connectNulls />
                                                        </ComposedChart>
                                                    </ResponsiveContainer>
                                                </Paper>
                                            </Grid>
                                        );
                                    })()}`,
    `                                    {hasNocturiaData && (() => {
                                        // Daten mit sleepWindow-Info anreichern
                                        const sorted = [...dailyDataRaw].sort((a: any, b: any) => a.date.localeCompare(b.date));
                                        const data = sorted.map((d: any, i: number) => {
                                            const vals = sorted.slice(Math.max(0, i-6), i+1)
                                                .filter((x: any) => x.nocturiaCount != null)
                                                .map((x: any) => Number(x.nocturiaCount));
                                            const avg = vals.length > 0 ? Math.round(vals.reduce((a: number,b: number) => a+b,0) / vals.length * 10) / 10 : null;
                                            // Schlaffenster als HH:MM
                                            const fmtTime = (ts: any) => {
                                                if (!ts) return null;
                                                const dt = new Date(Number(ts));
                                                return dt.getHours().toString().padStart(2,'0') + ':' + dt.getMinutes().toString().padStart(2,'0');
                                            };
                                            return {
                                                date: d.date ? d.date.substring(5) : '',
                                                value: d.nocturiaCount != null ? Number(d.nocturiaCount) : null,
                                                movingAvg: avg,
                                                winStart: fmtTime(d.sleepWindowStart),
                                                winEnd:   fmtTime(d.sleepWindowEnd),
                                            };
                                        }).filter((d: any) => d.date);
                                        const avgN = data.filter((d: any) => d.value != null).map((d: any) => d.value as number);
                                        const meanN = avgN.length > 0 ? Math.round(avgN.reduce((a: number, b: number) => a+b,0) / avgN.length * 10) / 10 : 0;
                                        // Ø Schlaffenster berechnen
                                        const windowEntries = dailyDataRaw.filter((d: any) => d.sleepWindowStart && d.sleepWindowEnd);
                                        const avgWinLabel = (() => {
                                            if (windowEntries.length === 0) return '22:00–06:00 (Fixfenster)';
                                            const startMins = windowEntries.map((d: any) => {
                                                const dt = new Date(Number(d.sleepWindowStart));
                                                return (dt.getHours() * 60 + dt.getMinutes() + (dt.getHours() < 12 ? 1440 : 0)) % 1440;
                                            });
                                            const endMins = windowEntries.map((d: any) => {
                                                const dt = new Date(Number(d.sleepWindowEnd));
                                                return dt.getHours() * 60 + dt.getMinutes();
                                            });
                                            const avgS = Math.round(startMins.reduce((a: number,b: number)=>a+b,0)/startMins.length) % 1440;
                                            const avgE = Math.round(endMins.reduce((a: number,b: number)=>a+b,0)/endMins.length);
                                            const fmt = (m: number) => Math.floor(m/60).toString().padStart(2,'0') + ':' + (m%60).toString().padStart(2,'0');
                                            return fmt(avgS) + '–' + fmt(avgE) + ' (FP2-Fenster, Ø ' + windowEntries.length + 'd)';
                                        })();
                                        const NocturiaTooltip = ({ active, payload, label }: any) => {
                                            if (!active || !payload || !payload.length) return null;
                                            const entry = payload[0]?.payload;
                                            return (
                                                <Paper sx={{ p: 1, bgcolor: isDark ? '#1a1a1a' : '#fff', border: \`1px solid \${isDark ? '#444' : '#ddd'}\`, fontSize: '0.7rem', maxWidth: 200 }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block' }}>{label} <span style={{opacity:0.7}}>{getWeekday(label)}</span></Typography>
                                                    {payload.map((p: any, i: number) => p.value != null && (
                                                        <Typography key={i} variant="caption" sx={{ color: p.color || p.fill, display: 'block' }}>
                                                            {p.name === 'value' ? 'Toilettengänge' : '7-Tage-Ø'}: {p.value}x
                                                        </Typography>
                                                    ))}
                                                    {entry?.winStart && entry?.winEnd && (
                                                        <Typography variant="caption" sx={{ color: '#00acc1', display: 'block', mt: 0.3 }}>
                                                            🛏️ {entry.winStart}–{entry.winEnd} Uhr
                                                        </Typography>
                                                    )}
                                                    {!entry?.winStart && (
                                                        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.3, fontStyle: 'italic' }}>
                                                            Fixfenster 22–06 Uhr
                                                        </Typography>
                                                    )}
                                                </Paper>
                                            );
                                        };
                                        return (
                                            <Grid item xs={12} md={6} lg={4}>
                                                <Paper sx={{ p: 2, bgcolor: isDark ? '#0a0a0a' : '#ffffff', height: '100%' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                        <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#00acc1' }}>
                                                            NYKTURIE
                                                        </Typography>
                                                        <ChartHelp text={"Zählt Toilettenbesuche innerhalb des tatsächlichen Schlaf-Fensters (FP2-Bett-basiert). Ohne FP2: Fixfenster 22–06 Uhr. >2 Besuche/Nacht = Nykturie-Hinweis. Frühzeichen bei Diabetes T2, Herzinsuffizienz, Harnwegsinfekt. Nur wenn Bad-Sensor mit Funktion Bad/WC konfiguriert ist."} />
                                                    </Box>
                                                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                                                        Ø {meanN} Besuche · {avgWinLabel}
                                                    </Typography>
                                                    <ResponsiveContainer width="100%" height={150}>
                                                        <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                                            <XAxis dataKey="date" stroke={lineColor} style={{ fontSize: '0.6rem' }}
                                                                interval={Math.floor(data.length / 6)} />
                                                            <YAxis stroke={lineColor} style={{ fontSize: '0.6rem' }} domain={[0, 6]} />
                                                            <Tooltip content={<NocturiaTooltip />} />
                                                            <ReferenceArea y1={0} y2={2} fill="rgba(40,167,69,0.12)" />
                                                            <ReferenceArea y1={2} y2={6} fill="rgba(253,126,20,0.12)" />
                                                            <ReferenceLine y={2} stroke="#fd7e1455" strokeDasharray="4 3"
                                                                label={{ value: 'Nykturie-Grenze', position: 'insideRight', fontSize: 8, fill: '#fd7e14' }} />
                                                            <Bar dataKey="value" name="value" radius={[2,2,0,0]}>
                                                                {data.map((entry: any, i: number) => {
                                                                    const v = entry.value;
                                                                    const col = v == null ? '#555' : v >= 2 ? '#fd7e14' : '#00acc1';
                                                                    return <Cell key={i} fill={col} opacity={0.8} />;
                                                                })}
                                                            </Bar>
                                                            <Line type="monotone" dataKey="movingAvg" stroke="#006064" strokeWidth={2}
                                                                dot={false} name="movingAvg" connectNulls />
                                                        </ComposedChart>
                                                    </ResponsiveContainer>
                                                </Paper>
                                            </Grid>
                                        );
                                    })()}`,
    '4. Nykturie Chart with dynamic sleep window'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\nDone: ${changes} changes applied.`);
