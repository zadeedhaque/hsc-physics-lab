import type { ReactNode } from 'react';
import type { Glyph as GlyphName } from '../content/catalog';

/**
 * Schematic line-art preview for each topic family (96×64 viewBox).
 * Kept deliberately simple so cards stay light — the real 3D scene loads on open.
 */
const A = 'var(--glyph-accent)';
const B = 'var(--glyph-b)';
const M = 'var(--glyph-muted)';

const arrowHead = (x: number, y: number, ang: number, c = A) => {
  const s = 5;
  const a1 = ang + Math.PI * 0.82, a2 = ang - Math.PI * 0.82;
  return <path d={`M${x} ${y} L${x + s * Math.cos(a1)} ${y + s * Math.sin(a1)} M${x} ${y} L${x + s * Math.cos(a2)} ${y + s * Math.sin(a2)}`} stroke={c} />;
};
const arrow = (x1: number, y1: number, x2: number, y2: number, c = A) => (
  <g><path d={`M${x1} ${y1} L${x2} ${y2}`} stroke={c} />{arrowHead(x2, y2, Math.atan2(y2 - y1, x2 - x1), c)}</g>
);
const sine = (x0: number, x1: number, y: number, amp: number, cycles: number, phase = 0) => {
  let d = '';
  for (let i = 0; i <= 60; i++) {
    const x = x0 + ((x1 - x0) * i) / 60;
    const yy = y - amp * Math.sin((i / 60) * cycles * Math.PI * 2 + phase);
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${yy.toFixed(1)}`;
  }
  return d;
};

const G: Record<GlyphName, ReactNode> = {
  measure: <g><rect x="10" y="26" width="76" height="12" rx="2" stroke={M} /><path d="M18 26v5M26 26v3M34 26v5M42 26v3M50 26v5M58 26v3M66 26v5M74 26v3" stroke={M} /><rect x="40" y="38" width="30" height="10" rx="2" stroke={A} /><path d="M44 38v4M48 38v3M52 38v4M56 38v3M60 38v4M64 38v3" stroke={A} /></g>,
  sigfig: <g><text x="48" y="38" textAnchor="middle" fontSize="16" fill={A} fontFamily="var(--font-mono)">3.<tspan fill={M}>0</tspan>40</text><path d="M28 44h40" stroke={M} strokeDasharray="2 3" /></g>,
  dimension: <g><text x="48" y="38" textAnchor="middle" fontSize="15" fill={A} fontFamily="var(--font-mono)">[MLT⁻²]</text></g>,
  vector: <g>{arrow(20, 50, 56, 30)}{arrow(56, 30, 76, 14, B)}{arrow(20, 50, 76, 14, 'var(--glyph-c)')}<path d="M20 50 L40 34 L76 14" stroke={M} strokeDasharray="2 3" /></g>,
  motion: <g><path d="M8 48h80" stroke={M} /><rect x="22" y="34" width="20" height="10" rx="2" stroke={A} /><circle cx="27" cy="46" r="2" stroke={A} /><circle cx="37" cy="46" r="2" stroke={A} />{arrow(46, 39, 72, 39, B)}</g>,
  projectile: <g><path d="M8 52h80" stroke={M} /><path d="M12 52 Q46 -8 84 52" stroke={A} strokeDasharray="3 3" /><circle cx="36" cy="24" r="4" fill={A} stroke="none" />{arrow(36, 24, 52, 18, B)}</g>,
  circle: <g><circle cx="48" cy="32" r="20" stroke={M} strokeDasharray="3 3" /><circle cx="62" cy="18" r="4" fill={A} stroke="none" />{arrow(62, 18, 52, 28, 'var(--glyph-c)')}{arrow(62, 18, 76, 30, B)}</g>,
  force: <g><rect x="36" y="22" width="24" height="20" rx="2" stroke={A} /><path d="M8 42h80" stroke={M} />{arrow(60, 32, 84, 32, B)}{arrow(36, 32, 16, 32, 'var(--glyph-c)')}</g>,
  friction: <g><path d="M8 44h80" stroke={M} /><path d="M10 48l4-4M18 48l4-4M26 48l4-4M34 48l4-4M42 48l4-4M50 48l4-4M58 48l4-4M66 48l4-4M74 48l4-4" stroke={M} /><rect x="36" y="24" width="24" height="20" rx="2" stroke={A} />{arrow(60, 34, 82, 34, B)}{arrow(40, 44, 22, 44, 'var(--glyph-c)')}</g>,
  incline: <g><path d="M10 54 L86 54 L86 18 Z" stroke={M} /><rect x="0" y="0" width="16" height="12" rx="2" stroke={A} transform="translate(46 30) rotate(-25)" />{arrow(56, 42, 56, 58, B)}</g>,
  pulley: <g><circle cx="48" cy="14" r="8" stroke={A} /><path d="M40 14v24M56 14v16" stroke={M} /><rect x="33" y="38" width="14" height="14" rx="2" stroke={B} /><rect x="49" y="30" width="14" height="12" rx="2" stroke={A} /></g>,
  collision: <g><path d="M8 48h80" stroke={M} /><circle cx="30" cy="36" r="10" stroke={A} /><circle cx="64" cy="38" r="8" stroke={B} />{arrow(14, 36, 24, 36)}{arrow(82, 38, 74, 38, B)}</g>,
  rotation: <g><circle cx="48" cy="32" r="18" stroke={M} /><path d="M48 32 L66 32" stroke={A} /><path d="M30 20 A 22 22 0 0 1 60 12" stroke={B} />{arrowHead(60, 12, -0.3, B)}</g>,
  energy: <g><path d="M8 20 Q30 60 48 44 T88 24" stroke={M} /><circle cx="30" cy="40" r="4" fill={A} stroke="none" /><rect x="70" y="36" width="6" height="16" fill={A} stroke="none" opacity="0.8" /><rect x="78" y="44" width="6" height="8" fill={B} stroke="none" opacity="0.8" /></g>,
  spring: <g><path d="M10 32 h8 l3 -8 l6 16 l6 -16 l6 16 l6 -16 l6 16 l6 -16 l3 8 h6" stroke={A} /><rect x="66" y="22" width="20" height="20" rx="2" stroke={B} /><path d="M10 18v28" stroke={M} /></g>,
  orbit: <g><ellipse cx="48" cy="32" rx="36" ry="18" stroke={M} strokeDasharray="3 3" /><circle cx="40" cy="32" r="7" fill={A} stroke="none" opacity="0.9" /><circle cx="82" cy="30" r="3" fill={B} stroke="none" /></g>,
  planet: <g><circle cx="48" cy="34" r="14" stroke={A} />{arrow(48, 6, 48, 16, B)}{arrow(78, 34, 66, 34, B)}{arrow(18, 34, 30, 34, B)}{arrow(70, 12, 60, 22, B)}</g>,
  matter: <g><path d="M48 6v8" stroke={M} /><path d="M40 6h16" stroke={M} /><path d="M48 14v28" stroke={A} strokeWidth="3" /><rect x="40" y="42" width="16" height="12" rx="2" stroke={B} />{arrow(48, 54, 48, 62, B)}</g>,
  drop: <g><path d="M48 10 C 40 24 34 30 34 38 a14 14 0 0 0 28 0 c0 -8 -6 -14 -14 -28z" stroke={A} /><path d="M20 56h56" stroke={M} /></g>,
  fluid: <g><rect x="30" y="6" width="36" height="52" rx="3" stroke={M} /><path d="M30 20h36" stroke={M} strokeDasharray="2 3" /><circle cx="48" cy="34" r="5" fill={A} stroke="none" />{arrow(48, 40, 48, 52, B)}{arrow(48, 28, 48, 18, 'var(--glyph-c)')}</g>,
  pendulum: <g><path d="M28 8h40" stroke={M} /><path d="M48 8 L64 44" stroke={A} /><circle cx="64" cy="46" r="5" fill={A} stroke="none" /><path d="M48 8 L48 48" stroke={M} strokeDasharray="2 3" /><path d="M36 42 Q48 52 64 46" stroke={B} strokeDasharray="2 2" /></g>,
  oscillation: <g><path d={sine(8, 88, 32, 16, 2)} stroke={A} /><path d="M8 32h80" stroke={M} strokeDasharray="2 3" /></g>,
  wave: <g><path d={sine(8, 88, 32, 14, 2.5)} stroke={A} /><path d={sine(8, 88, 32, 8, 2.5, 1.6)} stroke={B} opacity="0.8" /></g>,
  sound: <g><path d="M14 22v20h8l10 8V14l-10 8z" stroke={M} /><path d="M44 22a14 14 0 0 1 0 20M54 16a24 24 0 0 1 0 32M64 10a34 34 0 0 1 0 44" stroke={A} /></g>,
  gas: <g><rect x="18" y="8" width="60" height="48" rx="3" stroke={M} />{[[30, 20], [52, 16], [66, 30], [36, 42], [58, 46], [44, 30]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill={i % 2 ? B : A} stroke="none" />)}{arrow(30, 20, 38, 26)}{arrow(58, 46, 50, 40, B)}</g>,
  heat: <g><rect x="12" y="26" width="72" height="12" rx="3" stroke={M} /><path d="M12 30h24" stroke="var(--glyph-hot)" strokeWidth="6" opacity="0.7" /><path d="M20 50c3-4-3-6 0-10M30 50c3-4-3-6 0-10" stroke="var(--glyph-hot)" /></g>,
  engine: <g><rect x="34" y="14" width="28" height="42" rx="2" stroke={M} /><rect x="36" y="28" width="24" height="5" fill={A} stroke="none" /><path d="M48 28V6" stroke={A} /><path d="M40 44h16M40 50h16" stroke="var(--glyph-hot)" /></g>,
  charge: <g><circle cx="28" cy="32" r="10" stroke="var(--glyph-pos)" /><path d="M24 32h8M28 28v8" stroke="var(--glyph-pos)" /><circle cx="68" cy="32" r="10" stroke="var(--glyph-neg)" /><path d="M64 32h8" stroke="var(--glyph-neg)" />{arrow(40, 32, 54, 32, B)}</g>,
  field: <g><circle cx="48" cy="32" r="6" fill="var(--glyph-pos)" stroke="none" />{[0, 45, 90, 135, 180, 225, 270, 315].map((d) => { const r = (d * Math.PI) / 180; return <g key={d}>{arrow(48 + 10 * Math.cos(r), 32 + 10 * Math.sin(r), 48 + 26 * Math.cos(r), 32 + 26 * Math.sin(r), B)}</g>; })}</g>,
  capacitor: <g><path d="M40 12v40M56 12v40" stroke={A} strokeWidth="3" /><path d="M10 32h30M56 32h30" stroke={M} />{arrow(42, 24, 54, 24, B)}{arrow(42, 40, 54, 40, B)}</g>,
  circuit: <g><rect x="14" y="12" width="68" height="40" rx="3" stroke={M} /><path d="M40 8v8M46 10v4" stroke={A} strokeWidth="2" /><path d="M38 52 l3 -5 l4 10 l4 -10 l4 10 l3 -5" stroke={B} fill="var(--panel)" /><circle cx="82" cy="32" r="3" fill={A} stroke="none" /></g>,
  magnet: <g><path d="M48 6v52" stroke={A} strokeWidth="3" /><ellipse cx="48" cy="32" rx="14" ry="5" stroke={B} /><ellipse cx="48" cy="32" rx="28" ry="10" stroke={B} opacity="0.6" />{arrowHead(62, 32, Math.PI / 2, B)}</g>,
  coil: <g><path d="M16 32 C 20 12, 26 12, 28 32 C 30 52, 36 52, 38 32 C 40 12, 46 12, 48 32 C 50 52, 56 52, 58 32 C 60 12, 66 12, 68 32 C 70 52, 76 52, 80 32" stroke={A} /><rect x="6" y="28" width="10" height="8" fill="var(--glyph-pos)" stroke="none" /><rect x="80" y="28" width="10" height="8" fill="var(--glyph-neg)" stroke="none" /></g>,
  ac: <g><circle cx="24" cy="32" r="14" stroke={M} /><path d="M18 32q3-8 6 0t6 0" stroke={A} /><path d={sine(44, 90, 32, 14, 1.5)} stroke={B} /></g>,
  mirror: <g><path d="M48 8v48" stroke={A} strokeWidth="3" /><path d="M14 16 L48 32 L14 48" stroke="var(--glyph-light)" /><path d="M48 32h36" stroke={M} strokeDasharray="2 3" /></g>,
  ray: <g><path d="M8 32h80" stroke={M} /><rect x="8" y="32" width="80" height="26" fill={A} opacity="0.12" stroke="none" /><path d="M20 8 L48 32 L64 58" stroke="var(--glyph-light)" /><path d="M48 12v44" stroke={M} strokeDasharray="2 3" /></g>,
  prism: <g><path d="M48 8 L74 52 H22 Z" stroke={A} /><path d="M6 36 L38 30" stroke="var(--glyph-light)" /><path d="M58 32 L90 22" stroke="#f87171" /><path d="M58 34 L90 30" stroke="#facc15" /><path d="M58 36 L90 38" stroke="#4ade80" /><path d="M58 38 L90 46" stroke="#60a5fa" /></g>,
  lens: <g><path d="M48 8 Q60 32 48 56 Q36 32 48 8" stroke={A} /><path d="M6 32h84" stroke={M} strokeDasharray="2 3" /><path d="M16 20 L48 20 L82 44" stroke="var(--glyph-light)" /><path d="M16 20 L82 44" stroke="var(--glyph-light)" opacity="0.5" /></g>,
  interference: <g><path d="M22 8v18M22 30v4M22 38v18" stroke={M} strokeWidth="2" />{[...Array(9)].map((_, i) => <rect key={i} x="70" y={8 + i * 6} width="10" height="4" fill={A} opacity={1 - Math.abs(i - 4) * 0.2} stroke="none" />)}<path d="M22 28 L70 20M22 36 L70 20" stroke={B} opacity="0.7" /></g>,
  polarize: <g><path d="M8 32h80" stroke={M} strokeDasharray="2 3" /><rect x="30" y="12" width="6" height="40" rx="1" stroke={A} /><path d="M33 16v32" stroke={A} /><rect x="60" y="12" width="6" height="40" rx="1" stroke={B} /><path d="M56 22 L70 42" stroke={B} /></g>,
  relativity: <g><path d="M14 32 L34 22 H66 L82 32 L66 42 H34 Z" stroke={A} /><path d="M8 26h8M4 32h8M8 38h8" stroke={M} /><circle cx="50" cy="32" r="4" stroke={B} /></g>,
  photon: <g><path d={sine(8, 50, 20, 5, 3)} stroke="var(--glyph-light)" /><path d="M50 20l0 0" />{arrowHead(50, 20, 0.35, 'var(--glyph-light)')}<rect x="52" y="30" width="36" height="24" rx="2" stroke={M} /><circle cx="70" cy="22" r="3" fill={B} stroke="none" />{arrow(70, 22, 82, 10, B)}</g>,
  atom: <g><circle cx="48" cy="32" r="4" fill={A} stroke="none" /><ellipse cx="48" cy="32" rx="30" ry="10" stroke={M} /><ellipse cx="48" cy="32" rx="30" ry="10" stroke={M} transform="rotate(60 48 32)" /><ellipse cx="48" cy="32" rx="30" ry="10" stroke={M} transform="rotate(120 48 32)" /><circle cx="78" cy="32" r="2.5" fill={B} stroke="none" /></g>,
  nuclear: <g>{[[44, 28], [52, 28], [48, 35], [40, 35], [56, 35], [44, 42], [52, 42]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" fill={i % 2 ? 'var(--glyph-pos)' : M} stroke="none" opacity="0.9" />)}{arrow(62, 22, 82, 10, B)}</g>,
  semiconductor: <g><rect x="12" y="14" width="34" height="36" rx="2" stroke="var(--glyph-pos)" /><rect x="50" y="14" width="34" height="36" rx="2" stroke="var(--glyph-neg)" /><text x="29" y="37" textAnchor="middle" fontSize="12" fill="var(--glyph-pos)" stroke="none">p</text><text x="67" y="37" textAnchor="middle" fontSize="12" fill="var(--glyph-neg)" stroke="none">n</text><rect x="42" y="14" width="12" height="36" fill={M} opacity="0.2" stroke="none" /></g>,
  diode: <g><path d="M8 32h28M60 32h28" stroke={M} /><path d="M36 18 L58 32 L36 46 Z" stroke={A} /><path d="M60 18v28" stroke={A} strokeWidth="2.5" /></g>,
  logic: <g><path d="M22 14h20a18 18 0 0 1 0 36H22z" stroke={A} /><path d="M8 24h14M8 40h14M60 32h20" stroke={M} /><circle cx="84" cy="32" r="3" fill={B} stroke="none" /></g>,
  star: <g><path d="M10 54 L86 10" stroke={M} strokeDasharray="2 4" />{[[20, 48, 4, '#93c5fd'], [34, 40, 3, '#e0f2fe'], [48, 32, 3.5, '#fef9c3'], [62, 24, 3, '#fde68a'], [74, 18, 2.5, '#fb923c'], [70, 46, 5, '#f87171'], [28, 16, 2, '#e2e8f0']].map(([x, y, r, c], i) => <circle key={i} cx={x as number} cy={y as number} r={r as number} fill={c as string} stroke="none" />)}</g>,
  spectrum: <g><defs><linearGradient id="spec-g" x1="0" x2="1"><stop offset="0" stopColor="#8b5cf6" /><stop offset="0.25" stopColor="#3b82f6" /><stop offset="0.45" stopColor="#22c55e" /><stop offset="0.65" stopColor="#facc15" /><stop offset="1" stopColor="#ef4444" /></linearGradient></defs><rect x="10" y="40" width="76" height="10" rx="2" fill="url(#spec-g)" stroke="none" /><path d="M10 36 Q30 0 50 20 T86 34" stroke={A} /></g>,
};

export function Glyph({ name, className = '' }: { name: GlyphName; className?: string }) {
  return (
    <svg viewBox="0 0 96 64" className={className} fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{
        ['--glyph-accent' as string]: 'var(--accent)', ['--glyph-b' as string]: 'var(--fg-2)', ['--glyph-c' as string]: 'var(--warn)',
        ['--glyph-muted' as string]: 'var(--fg-3)', ['--glyph-pos' as string]: 'var(--bad)', ['--glyph-neg' as string]: 'var(--accent)',
        ['--glyph-light' as string]: '#eab308', ['--glyph-hot' as string]: '#f97316',
      }}>
      {G[name]}
    </svg>
  );
}
