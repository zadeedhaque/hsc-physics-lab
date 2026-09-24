import { R, kB } from './constants';

/* ───────────── Ideal gas & kinetic theory ───────────── */
export const idealPressure = (n: number, T: number, V: number) => (n * R * T) / Math.max(V, 1e-12);
export const vrms = (T: number, molarMass: number) => Math.sqrt((3 * R * T) / molarMass);
export const vmean = (T: number, molarMass: number) => Math.sqrt((8 * R * T) / (Math.PI * molarMass));
export const vmostProbable = (T: number, molarMass: number) => Math.sqrt((2 * R * T) / molarMass);
export const meanKE = (T: number) => 1.5 * kB * T;

/** Maxwell–Boltzmann speed distribution f(v) (per unit speed). */
export function maxwell(v: number, T: number, molarMass: number) {
  const a = molarMass / (2 * R * T);
  return 4 * Math.PI * (a / Math.PI) ** 1.5 * v * v * Math.exp(-a * v * v);
}

/** Heat capacities from degrees of freedom f: Cv = f/2 R, Cp = Cv + R, γ = Cp/Cv. */
export function heatCapacities(f: number) {
  const Cv = (f / 2) * R;
  return { Cv, Cp: Cv + R, gamma: (Cv + R) / Cv };
}

/* ───────────── Thermodynamic processes ───────────── */
export type Process = 'isothermal' | 'isobaric' | 'isochoric' | 'adiabatic';

/**
 * Take n moles from (V1, T1) through a process to a final state set by the target volume (or temperature for
 * isochoric). Returns P, V, T at both ends plus W (by gas), Q (to gas) and ΔU — satisfying Q = ΔU + W.
 */
export function processResult(proc: Process, n: number, V1: number, T1: number, target: number, gamma: number) {
  const Cv = R / (gamma - 1);
  const P1 = (n * R * T1) / V1;
  let V2 = V1, T2 = T1, P2 = P1, W = 0;
  switch (proc) {
    case 'isothermal':
      V2 = target; T2 = T1; P2 = (n * R * T2) / V2; W = n * R * T1 * Math.log(V2 / V1); break;
    case 'isobaric':
      V2 = target; P2 = P1; T2 = (P2 * V2) / (n * R); W = P1 * (V2 - V1); break;
    case 'isochoric':
      T2 = target; V2 = V1; P2 = (n * R * T2) / V2; W = 0; break;
    case 'adiabatic':
      V2 = target; P2 = P1 * (V1 / V2) ** gamma; T2 = (P2 * V2) / (n * R); W = (P1 * V1 - P2 * V2) / (gamma - 1); break;
  }
  const dU = n * Cv * (T2 - T1);
  return { P1, V1, T1, P2, V2, T2, W, dU, Q: dU + W };
}

/** Sample points (V, P) along a process for plotting. */
export function processCurve(proc: Process, n: number, V1: number, T1: number, target: number, gamma: number, steps = 60) {
  const r = processResult(proc, n, V1, T1, target, gamma);
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    let V: number, P: number;
    switch (proc) {
      case 'isothermal': V = V1 + (r.V2 - V1) * s; P = (n * R * T1) / V; break;
      case 'isobaric': V = V1 + (r.V2 - V1) * s; P = r.P1; break;
      case 'isochoric': V = V1; P = r.P1 + (r.P2 - r.P1) * s; break;
      case 'adiabatic': V = V1 + (r.V2 - V1) * s; P = r.P1 * (V1 / V) ** gamma; break;
    }
    pts.push([V, P]);
  }
  return pts;
}

/* ───────────── Heat engines ───────────── */
export const carnotEfficiency = (Th: number, Tc: number) => (Th <= 0 ? 0 : Math.max(0, 1 - Tc / Th));
export const refrigeratorCOP = (Th: number, Tc: number) => (Th <= Tc ? Infinity : Tc / (Th - Tc));

/* ───────────── Heat transfer & expansion ───────────── */
/** Fourier conduction H = kA(T₁ − T₂)/L (W). */
export const conduction = (kCond: number, A: number, dT: number, L: number) => (kCond * A * dT) / Math.max(L, 1e-9);
/** Stefan–Boltzmann radiated power P = εσAT⁴. */
export const radiated = (emissivity: number, A: number, T: number) => emissivity * 5.670374419e-8 * A * T ** 4;
/** Linear expansion ΔL = αL₀ΔT. */
export const linearExpansion = (alpha: number, L0: number, dT: number) => alpha * L0 * dT;
