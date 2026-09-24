/** Numeric safety + formatting helpers shared by physics and UI layers. */
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const deg = (rad: number) => (rad * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Return v if finite, otherwise fallback — guarantees no NaN/Infinity reach the UI. */
export const safe = (v: number, fallback = 0) => (Number.isFinite(v) ? v : fallback);

/** Divide with a guard against zero / non-finite results. */
export const div = (a: number, b: number, fallback = 0) => (b === 0 ? fallback : safe(a / b, fallback));

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
export const superscript = (n: number | string) => String(n).split('').map((ch) => SUP[ch] ?? ch).join('');

/**
 * Format a number for display. Uses scientific notation (a × 10ⁿ) for very
 * large/small magnitudes so values like 6.6×10⁻³⁴ stay readable.
 */
export function fmt(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (Number.isInteger(v) && a < 1e5) return String(v);
  if (a >= 1e5 || a < 1e-3) {
    const exp = Math.floor(Math.log10(a));
    const mant = v / 10 ** exp;
    return `${mant.toFixed(Math.max(0, digits - 1))} × 10${superscript(exp)}`;
  }
  const decimals = a >= 100 ? Math.max(0, digits - 3) : a >= 10 ? Math.max(0, digits - 2) : digits - 1 + (a < 1 ? 1 : 0);
  return v.toFixed(Math.min(6, Math.max(0, decimals)));
}

/** Format with an explicit number of decimals (used for slider values). */
export const fixed = (v: number, decimals: number) => (Number.isFinite(v) ? v.toFixed(decimals) : '—');

/** Seeded PRNG (mulberry32) so particle systems are reproducible after reset. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample via Box–Muller. */
export function gauss(rand: () => number) {
  const u1 = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rand());
}
