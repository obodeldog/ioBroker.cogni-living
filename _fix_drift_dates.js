const fs = require('fs');
const path = require('path');

const f = path.join(__dirname, 'src-admin/src/components/tabs/LongtermTrendsView.tsx');
let c = fs.readFileSync(f, 'utf8');

// Normalize line endings
c = c.replace(/\r\n/g, '\n');

// ─── 1. Replace chartData building block ────────────────────────────────────
const OLD_CHART = [
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
].join('\n');

const NEW_CHART = [
    '                                        // Build date-indexed chart data (aligned to calendar dates)',
    '                                        const allDates: string[] = (driftData as any).dates || [];',
    '                                        const gaitDates: string[] = (driftData as any).gait_dates || [];',
    '                                        const fmtDate = (iso: string) => { if (!iso) return \'\'; const p = iso.split(\'-\'); return p.length === 3 ? p[2] + \'.\' + p[1] : iso; };',
    '                                        // Map gait scores by date for alignment with other metrics',
    '                                        const gaitByDate: Record<string, number> = {};',
    '                                        const gaitScores: number[] = (driftData as any).gait?.scores || [];',
    '                                        gaitDates.forEach((d: string, i: number) => { if (gaitScores[i] != null) gaitByDate[d] = gaitScores[i]; });',
    '                                        const maxLen = allDates.length > 0 ? allDates.length : Math.max(...metrics.filter(m => m.key !== \'gait\').map(m => (driftData as any)[m.key]?.scores?.length || 0));',
    '                                        if (maxLen === 0) return null;',
    '                                        const chartData = Array.from({ length: maxLen }, (_: any, i: number) => {',
    '                                            const iso = allDates[i] || \'\';',
    '                                            const pt: any = { date: fmtDate(iso) || String(i + 1) };',
    '                                            metrics.forEach(({ key, name }) => {',
    '                                                const m = (driftData as any)[key];',
    '                                                if (key === \'gait\') {',
    '                                                    const gv = iso ? gaitByDate[iso] : m?.scores?.[i];',
    '                                                    if (gv != null && m?.threshold > 0) pt[name] = Math.min(110, Math.round((gv / m.threshold) * 100));',
    '                                                } else if (m?.scores?.[i] != null && m.threshold > 0) {',
    '                                                    pt[name] = Math.min(110, Math.round((m.scores[i] / m.threshold) * 100));',
    '                                                }',
    '                                            });',
    '                                            return pt;',
    '                                        });',
].join('\n');

if (!c.includes(OLD_CHART)) {
    console.log('ERROR: OLD_CHART block not found. Checking partial...');
    const partial = '                                        const pt: any = { i: i + 1 };';
    console.log('Partial match:', c.includes(partial));
    process.exit(1);
}
c = c.replace(OLD_CHART, NEW_CHART);
console.log('✅ chartData block replaced');

// ─── 2. Replace XAxis dataKey="i" -> dataKey="date" ─────────────────────────
// Match the XAxis line with dataKey="i" (with flexible whitespace/content)
const xRe = /(<XAxis dataKey="i" stroke=\{lineColor\} style=\{\{ fontSize: '0\.55rem' \}\})\s*\n\s*label=\{\{ value: [^}]+\}\} \/>/;
const xMatch = c.match(xRe);
if (xMatch) {
    c = c.replace(xRe, '<XAxis dataKey="date" stroke={lineColor} style={{ fontSize: \'0.55rem\' }} interval={Math.max(1, Math.floor(chartData.length / 8))} />');
    console.log('✅ XAxis replaced (multiline match)');
} else {
    // Try single-line match
    const xRe2 = /<XAxis dataKey="i" stroke=\{lineColor\}[^\n]*\/>/;
    if (c.match(xRe2)) {
        c = c.replace(xRe2, '<XAxis dataKey="date" stroke={lineColor} style={{ fontSize: \'0.55rem\' }} interval={Math.max(1, Math.floor(chartData.length / 8))} />');
        console.log('✅ XAxis replaced (single-line match)');
    } else {
        console.log('WARNING: XAxis pattern not found, searching for dataKey="i"...');
        const idx = c.indexOf('dataKey="i"');
        if (idx !== -1) {
            console.log('Found dataKey="i" at idx:', idx, '| Context:', c.substring(idx - 10, idx + 60));
        }
    }
}

// ─── 3. Update Tooltip formatter to show date ────────────────────────────────
// The Tooltip in the drift chart currently has no labelFormatter - add one
const OLD_TOOLTIP = [
    '                                                    <Tooltip',
    '                                                        formatter={(v: any, name: string) => {',
    '                                                            const labels: Record<string,string> = { act: \'',
].join('\n');

// Check if labelFormatter is already present
if (!c.includes('labelFormatter') && c.includes('const labels: Record<string,string> = { act:')) {
    // Find the Tooltip block and add labelFormatter
    const tooltipRe = /(<Tooltip\s*\n\s*formatter=\{[^}]+\}\s*\n[^}]+\}\s*\}\s*\n\s*contentStyle=\{[^}]+\}\s*\})/;
    // Simple approach: just add labelFormatter before contentStyle
    c = c.replace(
        /contentStyle=\{\{ backgroundColor: isDark \? '#1a1a1a' : '#fff', border: '1px solid #444', fontSize: '0\.7rem' \}\}/,
        "labelFormatter={(label: any) => label ? `${label}` : ''}\n                                                        contentStyle={{ backgroundColor: isDark ? '#1a1a1a' : '#fff', border: '1px solid #444', fontSize: '0.7rem' }}"
    );
    console.log('✅ Tooltip labelFormatter added');
} else {
    console.log('ℹ️  Tooltip labelFormatter already present or not needed');
}

// Restore CRLF for Windows
c = c.replace(/\n/g, '\r\n');
fs.writeFileSync(f, c, 'utf8');
console.log('✅ File saved');
