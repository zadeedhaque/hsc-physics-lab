/**
 * Semantic colour vocabulary used consistently across every simulation so that
 * a student learns "green arrow = normal force" once and it holds everywhere.
 */
export const C = {
  accent: '#38bdf8',
  velocity: '#22d3ee',
  acceleration: '#f472b6',
  force: '#60a5fa',
  friction: '#f87171',
  normal: '#34d399',
  weight: '#fbbf24',
  tension: '#a78bfa',
  resultant: '#fb923c',
  momentum: '#c084fc',
  positive: '#ef4444',
  negative: '#3b82f6',
  field: '#facc15',
  magnetic: '#2dd4bf',
  current: '#fde047',
  light: '#fef08a',
  neutral: '#94a3b8',
  body: '#cbd5e1',
  bodyAlt: '#7dd3fc',
  metal: '#a1a1aa',
  surface: '#475569',
  glass: '#93c5fd',
  hot: '#f97316',
  cold: '#60a5fa',
  x: '#f87171',
  y: '#4ade80',
  z: '#60a5fa',
} as const;

/** Distinct colours for graph series (pass through readableOn() for the light theme). */
export const SERIES = ['#38bdf8', '#f472b6', '#fbbf24', '#34d399', '#a78bfa', '#fb923c'];

/* ── Contrast on light surfaces ──
 * The palette above is tuned for dark backgrounds (the 3D viewport is always dark). Graphs sit on
 * the page surface, so in the light theme a series colour is darkened (hue kept) until it reaches
 * 3:1 against white — the WCAG minimum for graphical objects.
 */
const lightCache = new Map<string, string>();
const channel = (c: number) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const luminance = (r: number, g: number, b: number) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

export function readableOn(color: string, theme: 'dark' | 'light'): string {
  if (theme === 'dark' || !/^#[0-9a-f]{6}$/i.test(color)) return color;
  let out = lightCache.get(color);
  if (out) return out;
  let r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
  for (let i = 0; i < 24 && 1.05 / (luminance(r, g, b) + 0.05) < 3.2; i++) { r *= 0.92; g *= 0.92; b *= 0.92; }
  out = `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  lightCache.set(color, out);
  return out;
}
