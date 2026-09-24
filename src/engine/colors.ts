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

/** Distinct colours for graph series (validated for contrast on both themes). */
export const SERIES = ['#38bdf8', '#f472b6', '#fbbf24', '#34d399', '#a78bfa', '#fb923c'];
