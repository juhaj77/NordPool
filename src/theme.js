import { useSyncExternalStore } from 'react';

// Yhteiset värit ja Recharts-tyylit. Teema seuraa käyttöjärjestelmän
// asetusta (prefers-color-scheme), joka toimii Windowsissa, macOS:ssä ja
// Linuxissa. Pidä paletit synkronissa styles.css:n muuttujien kanssa.

const PALETTES = {
    dark: {
        bg: '#0a0f1a',
        panel: '#0f1726',
        border: '#1c2840',
        borderStrong: '#2a3a57',
        text: '#d6deeb',
        textStrong: '#f1f5f9',
        muted: '#7d8aa3',
        blue: '#3b82f6',
        amber: '#e9a23b',
        red: '#ef4444',
        teal: '#38c9b5',
        grid: 'rgba(148, 163, 184, 0.08)',
        cursor: 'rgba(148, 163, 184, 0.10)',
        tooltipBg: '#0b1220',
        tooltipShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        onAccent: '#0a0f1a',
    },
    light: {
        bg: '#f3f5f9',
        panel: '#ffffff',
        border: '#e2e8f0',
        borderStrong: '#cbd5e1',
        text: '#334155',
        textStrong: '#0f172a',
        muted: '#64748b',
        blue: '#2563eb',
        amber: '#d97706',
        red: '#dc2626',
        teal: '#0d9488',
        grid: 'rgba(15, 23, 42, 0.07)',
        cursor: 'rgba(15, 23, 42, 0.06)',
        tooltipBg: '#ffffff',
        tooltipShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
        onAccent: '#ffffff',
    },
};

export const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace";

// ── Käyttöjärjestelmän teeman seuranta ──────────────────────────────────
const QUERY = '(prefers-color-scheme: dark)';
const mql = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY) : null;

const subscribe = (cb) => {
    if (!mql) return () => {};
    mql.addEventListener('change', cb);
    return () => mql.removeEventListener('change', cb);
};
const getSnapshot = () => (mql?.matches ? 'dark' : 'light');

export const useColorScheme = () => useSyncExternalStore(subscribe, getSnapshot, () => 'light');

// Palauttaa nykyisen teeman värit ja valmiit Recharts-tyylit
export const useChartTheme = () => {
    const scheme = useColorScheme();
    const C = PALETTES[scheme];
    return {
        scheme,
        C,
        gridStroke: C.grid,
        axisStroke: C.border,
        axisTick: { fontSize: 11, fill: C.muted, fontFamily: MONO },
        tooltipCursor: { fill: C.cursor },
        tooltipContentStyle: {
            backgroundColor: C.tooltipBg,
            border: `1px solid ${C.borderStrong}`,
            borderRadius: '6px',
            boxShadow: C.tooltipShadow,
            padding: '8px 10px',
        },
        tooltipLabelStyle: {
            color: C.muted,
            fontFamily: MONO,
            fontSize: '11px',
            marginBottom: '4px',
        },
        tooltipItemStyle: {
            color: C.textStrong,
            fontFamily: MONO,
            fontSize: '13px',
            fontWeight: 600,
            padding: 0,
        },
    };
};

// "08:15" -> "08:15 – 08:30"
export const slotRangeLabel = (label) => {
    const [hours, minutes] = label.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0);
    const endDate = new Date(date.getTime() + 15 * 60000);
    const endLabel = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
    return `${label} – ${endLabel}`;
};

// Päivän tunnusluvut KPI-tiiliä varten
export const priceStats = (prices) => {
    if (!prices.length) return null;
    let max = prices[0];
    let min = prices[0];
    let sum = 0;
    for (const p of prices) {
        if (p.price > max.price) max = p;
        if (p.price < min.price) min = p;
        sum += p.price;
    }
    return { max, min, avg: sum / prices.length, count: prices.length };
};
