import { k, eps0 } from './constants';
import type { Vec3 } from './vectors';

/* ───────────────────────── Electrostatics ───────────────────────── */

export interface PointCharge { q: number; pos: Vec3 }

/** Coulomb force magnitude (signed: positive = repulsive). */
export const coulomb = (q1: number, q2: number, r: number) => (r <= 0 ? 0 : (k * q1 * q2) / (r * r));

/** Electric field vector at point p due to a set of point charges. */
export function fieldAt(charges: PointCharge[], p: Vec3, soft = 1e-6): Vec3 {
  let ex = 0, ey = 0, ez = 0;
  for (const c of charges) {
    const dx = p[0] - c.pos[0], dy = p[1] - c.pos[1], dz = p[2] - c.pos[2];
    const r2 = dx * dx + dy * dy + dz * dz + soft;
    const inv = (k * c.q) / (r2 * Math.sqrt(r2));
    ex += dx * inv; ey += dy * inv; ez += dz * inv;
  }
  return [ex, ey, ez];
}

/** Electric potential V = Σ kq/r at point p. */
export function potentialAt(charges: PointCharge[], p: Vec3, soft = 1e-6) {
  let V = 0;
  for (const c of charges) {
    const r = Math.sqrt((p[0] - c.pos[0]) ** 2 + (p[1] - c.pos[1]) ** 2 + (p[2] - c.pos[2]) ** 2 + soft);
    V += (k * c.q) / r;
  }
  return V;
}

/** Parallel-plate capacitor. */
export function parallelPlate(area: number, d: number, kappa: number, V: number) {
  const C = (kappa * eps0 * area) / Math.max(d, 1e-9);
  const Q = C * V;
  return { C, Q, U: 0.5 * C * V * V, E: V / Math.max(d, 1e-9), sigma: Q / Math.max(area, 1e-12) };
}

export const seriesCap = (cs: number[]) => 1 / cs.reduce((s, c) => s + 1 / c, 0);
export const parallelCap = (cs: number[]) => cs.reduce((s, c) => s + c, 0);
export const seriesRes = (rs: number[]) => rs.reduce((s, r) => s + r, 0);
export const parallelRes = (rs: number[]) => 1 / rs.reduce((s, r) => s + 1 / r, 0);

/** Electric dipole: moment p = q·2a; far-field on axis E = 2kp/r³, equatorial E = kp/r³. */
export function dipole(q: number, sep: number, r: number) {
  const p = q * sep;
  return { p, axial: (2 * k * p) / r ** 3, equatorial: (k * p) / r ** 3 };
}

/* ───────────────────────── Circuit solver ─────────────────────────
 * Modified nodal analysis for DC networks of resistors and ideal EMF sources.
 * Node 0 is ground. Resistor current is reported flowing a → b.
 * A source raises the potential of node `pos` above node `neg` by V.
 */
export type Element =
  | { kind: 'R'; id: string; a: number; b: number; R: number }
  | { kind: 'V'; id: string; neg: number; pos: number; V: number };

export interface CircuitSolution {
  V: number[];
  current: Record<string, number>;
  ok: boolean;
}

export function solveCircuit(nodeCount: number, elements: Element[]): CircuitSolution {
  const sources = elements.filter((e) => e.kind === 'V');
  const n = nodeCount - 1;
  const size = n + sources.length;
  const A = Array.from({ length: size }, () => new Array<number>(size + 1).fill(0));
  const idx = (node: number) => node - 1; // ground removed

  for (const el of elements) {
    if (el.kind !== 'R') continue;
    const gval = 1 / Math.max(el.R, 1e-9);
    const a = idx(el.a), b = idx(el.b);
    if (a >= 0) A[a][a] += gval;
    if (b >= 0) A[b][b] += gval;
    if (a >= 0 && b >= 0) { A[a][b] -= gval; A[b][a] -= gval; }
  }
  sources.forEach((s, j) => {
    if (s.kind !== 'V') return;
    const row = n + j;
    const p = idx(s.pos), q = idx(s.neg);
    if (p >= 0) { A[p][row] += 1; A[row][p] += 1; }
    if (q >= 0) { A[q][row] -= 1; A[row][q] -= 1; }
    A[row][size] = s.V;
  });

  const x = gaussSolve(A, size);
  const ok = x !== null;
  const sol = x ?? new Array(size).fill(0);
  const V = [0, ...sol.slice(0, n)];
  const current: Record<string, number> = {};
  for (const el of elements) {
    if (el.kind === 'R') current[el.id] = (V[el.a] - V[el.b]) / Math.max(el.R, 1e-9);
  }
  // MNA unknown is current entering the + terminal from the circuit; flip to report current delivered.
  sources.forEach((s, j) => { current[s.id] = -sol[n + j]; });
  return { V, current, ok };
}

function gaussSolve(A: number[][], n: number): number[] | null {
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-14) return null;
    [A[col], A[piv]] = [A[piv], A[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) A[r][c] -= f * A[col][c];
    }
  }
  return A.map((row, i) => row[n] / row[i]);
}

/** Wheatstone bridge balance condition P/Q = R/S. */
export const bridgeBalanced = (P: number, Q: number, R: number, S: number, tol = 1e-3) => Math.abs(P / Q - R / S) < tol * (P / Q);

/** Battery with internal resistance r feeding load R. */
export function internalResistance(emf: number, r: number, R: number) {
  const I = emf / Math.max(R + r, 1e-9);
  return { I, terminal: emf - I * r, lost: I * r, Pload: I * I * R, Pinternal: I * I * r, efficiency: R / (R + r) };
}
