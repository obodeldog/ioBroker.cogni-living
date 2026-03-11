'use strict';
const fs = require('fs');
const file = 'src-admin/src/components/tabs/LongtermTrendsView.tsx';
let c = fs.readFileSync(file, 'utf8');
let changed = 0;

// ── 1. loadDriftData: uniqueRooms aus History laden ─────────────────────────
const old1 = 'driftDailyData.push({ date: dateStr, activityPercent: totalEvents, gaitSpeed: gs, nightEvents: nightMot, uniqueRooms: 0, bathroomVisits: 0, windowOpenings: 0 });';
const new1 = [
    'const roomsData = response.data.todayRoomMinutes || {};',
    '                        const uniqueRm = Object.keys(roomsData).filter(k => (roomsData[k] || 0) > 2).length;',
    '                        driftDailyData.push({ date: dateStr, activityPercent: totalEvents, gaitSpeed: gs, nightEvents: nightMot, uniqueRooms: uniqueRm, bathroomVisits: 0, windowOpenings: 0 });',
].join('\n');
if (c.includes(old1)) { c = c.replace(old1, new1); changed++; console.log('✅ 1. loadDriftData uniqueRooms'); }
else console.log('❌ 1. loadDriftData uniqueRooms NOT FOUND');

// ── 2. Raum-Mobilität Bar-Farbe: #00bcd4 → #ffcc02 ──────────────────────────
const old2 = 'fill="#00bcd4" opacity={0.7} name="R\u00e4ume"';
const new2 = 'fill="#ffcc02" opacity={0.7} name="R\u00e4ume"';
if (c.includes(old2)) { c = c.replace(old2, new2); changed++; console.log('✅ 2. Raum-Mobilität Farbe'); }
else console.log('❌ 2. Raum-Mobilität Farbe NOT FOUND');

// ── 3. Drift-Monitor: kompletten Block durch neue Version ersetzen ───────────
const startMarker = '{/* DRIFT-MONITOR vollbreite Karte */}';
const endMarker   = "                    <Grid item xs={12} style={{ display: 'none' }}>{/* keeps grid structure */}";
const startIdx = c.indexOf(startMarker);
const endIdx   = c.indexOf(endMarker, startIdx);
if (startIdx < 0 || endIdx < 0) {
    console.error('❌ 3. Drift block not found. startIdx=' + startIdx + ' endIdx=' + endIdx);
    process.exit(1);
}
const endFull = endIdx + endMarker.length;
console.log('✅ 3. Found drift block:', startIdx, '->', endFull);

// Farb-Konstanten (identisch mit Mini-Charts)
// Aktivität: #4fc3f7, Ganggeschw: #00e676, Nacht: #fd7e14, Raum: #ffcc02
const newDriftBlock = [
    '{/* DRIFT-MONITOR vollbreite Karte */}',
    '                    </Grid>',
    '',
    '                    {/* ═══ DRIFT-MONITOR – Langzeit-Trend-Überwachung ═══ */}',
    '                    <Grid item xs={12}>',
    '                        <Paper sx={{',
    '                            p: 2,',
    '                            bgcolor: isDark ? \'#0a0a0a\' : \'#ffffff\',',
    '                            border: `1px solid ${isDark ? \'#333\' : \'#ddd\'}`,',
    '                            borderLeft: \'3px solid #ff9800\'',
    '                        }}>',
    '                            {/* Kopfzeile */}',
    '                            <Box sx={{ display: \'flex\', alignItems: \'center\', justifyContent: \'space-between\', mb: 1.5 }}>',
    '                                <Box sx={{ display: \'flex\', alignItems: \'center\', gap: 1 }}>',
    '                                    <Typography variant="subtitle2" sx={{ fontWeight: \'bold\', color: \'#ff9800\' }}>',
    '                                        \uD83D\uDD2C DRIFT-MONITOR',
    '                                    </Typography>',
    '                                    <ChartHelp text={"Erkennt schleichende Ver\u00e4nderungen \u00fcber Wochen und Monate (Page-Hinkley-Test). Jede Kurve zeigt wie weit sich eine Metrik von ihrer pers\u00f6nlichen Baseline entfernt hat – in Prozent der Alarmschwelle. 0 % = kein Drift, 100 % = Alarm. Die ersten 7–14 Tage sind Kalibrierungsphase (Score = 0). Farben sind identisch mit den Einzelkacheln dar\u00fcber."} />',
    '                                </Box>',
    '                                <Typography variant="caption" sx={{ color: \'text.secondary\', fontSize: \'0.6rem\' }}>',
    '                                    {driftData?.n_days ? `${driftData.n_days} Tage · 0\u2013100\u202f% der pers\u00f6nl. Alarmschwelle` : \'\'}',
    '                                </Typography>',
    '                            </Box>',
    '',
    '                            {driftLoading ? (',
    '                                <Typography variant="caption" sx={{ color: \'text.secondary\', display: \'block\', textAlign: \'center\', py: 3 }}>',
    '                                    Lade Drift-Daten (bis zu 180 Tage)\u2026',
    '                                </Typography>',
    '                            ) : driftData && !driftData.error ? (',
    '                                <>',
    '                                    {/* Status-Chips – normalisiert 0-100 % */}',
    '                                    <Box sx={{ display: \'flex\', gap: 1, flexWrap: \'wrap\', mb: 2 }}>',
    '                                        {([',
    '                                            { key: \'activity\', label: \'Aktivit\u00e4t\',           color: \'#4fc3f7\', icon: \'\uD83C\uDFC3\',',
    '                                              tip: \'Misst ob die Gesamtaktivit\u00e4t \u00fcber Wochen sinkt. 100\u202f% = Alarm. Schwelle = 3 \u00d7 deine-pers\u00f6nl.-Schwankung \u00d7 \u221a(Erkennungstage). Je st\u00e4rker du normalerweise schwankst, desto h\u00f6her die Schwelle.\' },',
    '                                            { key: \'gait\',     label: \'Ganggeschwindigkeit\', color: \'#00e676\', icon: \'\uD83D\uDEB6\',',
    '                                              tip: \'Misst ob du langsam langsamer wirst (l\u00e4ngere Flur-Transitzeiten). Anstieg = ung\u00fcnstig. 100\u202f% = Alarm.\' },',
    '                                            { key: \'night\',    label: \'Nacht-Unruhe\',        color: \'#fd7e14\', icon: \'\uD83D\uDE34\',',
    '                                              tip: \'Misst ob die n\u00e4chtliche Bewegungsaktivit\u00e4t \u00fcber Wochen zunimmt. Mehr Nacht-Events = schlechterer Schlaf. 100\u202f% = Alarm.\' },',
    '                                            { key: \'rooms\',    label: \'Raum-Mobilit\u00e4t\',     color: \'#ffcc02\', icon: \'\uD83C\uDFE0\',',
    '                                              tip: \'Misst ob du langfristig immer weniger R\u00e4ume nutzt. Ein R\u00fcckzug auf wenige R\u00e4ume kann ein Fr\u00fchwarnsignal sein. 100\u202f% = Alarm.\' },',
    '                                        ] as Array<{key:string,label:string,color:string,icon:string,tip:string}>).map(({ key, label, color, icon, tip }) => {',
    '                                            const m = (driftData as any)[key];',
    '                                            if (!m || m.error) return (',
    '                                                <MuiTooltip key={key} title={tip} arrow>',
    '                                                    <Box sx={{ display: \'flex\', alignItems: \'center\', gap: 0.5, px: 1, py: 0.4, borderRadius: 1, bgcolor: isDark ? \'#1a1a1a\' : \'#f5f5f5\', cursor: \'help\' }}>',
    '                                                        <Box sx={{ width: 8, height: 8, borderRadius: \'50%\', bgcolor: color, opacity: 0.4 }} />',
    '                                                        <Typography variant="caption" sx={{ color: \'text.secondary\', fontSize: \'0.65rem\' }}>',
    '                                                            {icon} {label}: {m?.error || \'Keine Daten\'}',
    '                                                        </Typography>',
    '                                                    </Box>',
    '                                                </MuiTooltip>',
    '                                            );',
    '                                            const pct = Math.min(100, Math.round((m.current_score / (m.threshold || 1)) * 100));',
    '                                            const chipColor = m.drift_detected ? \'#dc3545\' : pct > 50 ? \'#fd7e14\' : \'#28a745\';',
    '                                            const status    = m.drift_detected ? \'Drift erkannt\' : pct > 50 ? \'Beobachten\' : \'Stabil\';',
    '                                            return (',
    '                                                <MuiTooltip key={key} title={tip} arrow>',
    '                                                    <Box sx={{ display: \'flex\', alignItems: \'center\', gap: 0.5, px: 1.2, py: 0.4, borderRadius: 1,',
    '                                                        bgcolor: chipColor + \'22\', border: `1px solid ${chipColor}55`, cursor: \'help\' }}>',
    '                                                        <Box sx={{ width: 8, height: 8, borderRadius: \'50%\', bgcolor: color }} />',
    '                                                        <Typography variant="caption" sx={{ fontWeight: \'bold\', color: chipColor, fontSize: \'0.7rem\' }}>',
    '                                                            {icon} {label}',
    '                                                        </Typography>',
    '                                                        <Typography variant="caption" sx={{ color: \'text.secondary\', fontSize: \'0.65rem\' }}>',
    '                                                            {status} · {pct}\u202f%',
    '                                                        </Typography>',
    '                                                    </Box>',
    '                                                </MuiTooltip>',
    '                                            );',
    '                                        })}',
    '                                    </Box>',
    '',
    '                                    {/* Normalisierter 0–100%-Chart */}',
    '                                    {(() => {',
    '                                        const metrics = [',
    '                                            { key: \'activity\', color: \'#4fc3f7\', name: \'act\'   },',
    '                                            { key: \'gait\',     color: \'#00e676\', name: \'gait\'  },',
    '                                            { key: \'night\',    color: \'#fd7e14\', name: \'night\' },',
    '                                            { key: \'rooms\',    color: \'#ffcc02\', name: \'rooms\' },',
    '                                        ];',
    '                                        // Normalisiere jeden Score auf 0-100% seiner eigenen Schwelle',
    '                                        const maxLen = Math.max(...metrics.map(m => (driftData as any)[m.key]?.scores?.length || 0));',
    '                                        if (maxLen === 0) return null;',
    '                                        const chartData = Array.from({ length: maxLen }, (_: any, i: number) => {',
    '                                            const pt: any = { i: i + 1 };',
    '                                            metrics.forEach(({ key, name }) => {',
    '                                                const m = (driftData as any)[key];',
    '                                                if (m?.scores?.[i] != null && m.threshold > 0) {',
    '                                                    pt[name] = Math.min(110, Math.round((m.scores[i] / m.threshold) * 100));',
    '                                                }',
    '                                            });',
    '                                            return pt;',
    '                                        });',
    '                                        return (',
    '                                            <ResponsiveContainer width="100%" height={160}>',
    '                                                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>',
    '                                                    <CartesianGrid strokeDasharray="2 4" stroke={isDark ? \'#222\' : \'#eee\'} />',
    '                                                    <XAxis dataKey="i" stroke={lineColor} style={{ fontSize: \'0.55rem\' }}',
    '                                                        label={{ value: \'Tage (älteste \u2192 neueste)\', position: \'insideBottomRight\', offset: -5, fill: lineColor, fontSize: 9 }} />',
    '                                                    <YAxis stroke={lineColor} style={{ fontSize: \'0.55rem\' }} domain={[0, 110]}',
    '                                                        tickFormatter={(v: number) => `${v}\u202f%`} />',
    '                                                    <Tooltip',
    '                                                        formatter={(v: any, name: string) => {',
    '                                                            const labels: Record<string,string> = { act: \'\uD83C\uDFC3 Aktivit\u00e4t\', gait: \'\uD83D\uDEB6 Ganggeschw.\', night: \'\uD83D\uDE34 Nacht\', rooms: \'\uD83C\uDFE0 R\u00e4ume\' };',
    '                                                            return [v != null ? `${v}\u202f%` : \'\u2013\', labels[name] || name];',
    '                                                        }}',
    '                                                        contentStyle={{ backgroundColor: isDark ? \'#1a1a1a\' : \'#fff\', border: \'1px solid #444\', fontSize: \'0.7rem\' }}',
    '                                                    />',
    '                                                    <ReferenceLine y={100} stroke="#dc3545" strokeDasharray="4 3"',
    '                                                        label={{ value: \'Alarm (100\u202f%)\', position: \'right\', fill: \'#dc3545\', fontSize: 9 }} />',
    '                                                    <ReferenceLine y={50} stroke="#fd7e14" strokeDasharray="2 4" strokeOpacity={0.5} />',
    '                                                    {metrics.map(({ key, color, name }) =>',
    '                                                        (driftData as any)[key]?.scores && (',
    '                                                            <Line key={name} type="monotone" dataKey={name} stroke={color}',
    '                                                                strokeWidth={1.8} dot={false} connectNulls name={name} />',
    '                                                        )',
    '                                                    )}',
    '                                                </LineChart>',
    '                                            </ResponsiveContainer>',
    '                                        );',
    '                                    })()}',
    '',
    '                                    <Typography variant="caption" sx={{ color: \'text.secondary\', fontSize: \'0.6rem\', display: \'block\', mt: 1 }}>',
    '                                        <span style={{ color: \'#4fc3f7\' }}>&#9632;</span> Aktivit\u00e4t\u2002',
    '                                        <span style={{ color: \'#00e676\' }}>&#9632;</span> Ganggeschwindigkeit\u2002',
    '                                        <span style={{ color: \'#fd7e14\' }}>&#9632;</span> Nacht-Unruhe\u2002',
    '                                        <span style={{ color: \'#ffcc02\' }}>&#9632;</span> Raum-Mobilit\u00e4t\u2002\u2002|\u2002\u2002',
    '                                        Gelbe Linie\u202f=\u202f50\u202f% (Beobachten) \u00b7 Rote Linie\u202f=\u202f100\u202f% (Alarm)',
    '                                        {(driftData as any).activity?.calibration_days ? `\u2002|\u2002Erste ${(driftData as any).activity.calibration_days} Tage = Kalibrierung.` : \'\'}',
    '                                    </Typography>',
    '                                </>',
    '                            ) : driftData?.error ? (',
    '                                <Typography variant="caption" sx={{ color: \'text.secondary\', display: \'block\', fontSize: \'0.65rem\' }}>',
    '                                    {driftData.error}',
    '                                </Typography>',
    '                            ) : (',
    '                                <Typography variant="caption" sx={{ color: \'text.secondary\', display: \'block\', textAlign: \'center\', py: 3 }}>',
    '                                    Drift-Analyse l\u00e4dt\u2026 (min. 10 Tage Daten n\u00f6tig)',
    '                                </Typography>',
    '                            )}',
    '                        </Paper>',
    '                    </Grid>',
    '',
    '                    <Grid item xs={12} style={{ display: \'none\' }}>{/* keeps grid structure */',
].join('\n');

c = c.substring(0, startIdx) + newDriftBlock + c.substring(endFull);
changed++;
console.log('✅ 3. Drift-Monitor block replaced');

console.log(`\nTotal changes: ${changed}/3`);
fs.writeFileSync(file, c, 'utf8');
console.log('File written OK. Length:', c.length);
