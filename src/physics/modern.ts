import { c, h, e, me, kB, wienB } from './constants';

/* ───────────── Special relativity ───────────── */
export function lorentz(v: number) {
  const beta = Math.min(Math.abs(v) / c, 0.999_999_999);
  const gamma = 1 / Math.sqrt(1 - beta * beta);
  return { beta, gamma };
}
export const timeDilation = (t0: number, v: number) => t0 * lorentz(v).gamma;
export const lengthContraction = (L0: number, v: number) => L0 / lorentz(v).gamma;
export const relativisticMass = (m0: number, v: number) => m0 * lorentz(v).gamma;
export const restEnergy = (m: number) => m * c * c;

/* ───────────── Quantum ───────────── */
export const photonEnergy = (f: number) => h * f;

/** Photoelectric effect (work function in eV, frequency in Hz). */
export function photoelectric(f: number, phiEv: number) {
  const E = (h * f) / e; // eV
  const kMax = E - phiEv;
  const f0 = (phiEv * e) / h;
  return { photonEv: E, kMaxEv: Math.max(0, kMax), emits: kMax > 0, stoppingV: Math.max(0, kMax), f0 };
}

/** de Broglie wavelength λ = h / p. */
export const deBroglie = (m: number, v: number) => (m * v === 0 ? Infinity : h / (m * v));
/** Electron accelerated through V volts (non-relativistic): λ = h / √(2meV). */
export const electronWavelength = (V: number) => h / Math.sqrt(2 * me * e * Math.max(V, 1e-9));

/** Compton shift Δλ = (h / mₑc)(1 − cos θ). */
export const comptonShift = (theta: number) => (h / (me * c)) * (1 - Math.cos(theta));

/** X-ray tube: Duane–Hunt cut-off λ_min = hc / eV. */
export const xrayCutoff = (V: number) => (h * c) / (e * Math.max(V, 1));

/** Heisenberg: Δp ≥ ħ / 2Δx. */
export const minMomentumUncertainty = (dx: number) => h / (4 * Math.PI * Math.max(dx, 1e-30));

/* ───────────── Bohr model (hydrogen-like) ───────────── */
export const bohrEnergy = (n: number, Z = 1) => (-13.605_693 * Z * Z) / (n * n); // eV
export const bohrRadius = (n: number, Z = 1) => (0.529_177e-10 * n * n) / Z; // m
/** Photon wavelength for a transition n₂ → n₁ (n₂ > n₁). */
export function transition(n1: number, n2: number, Z = 1) {
  const dE = bohrEnergy(n2, Z) - bohrEnergy(n1, Z); // eV (positive for emission)
  const lambda = (h * c) / (Math.abs(dE) * e);
  return { dE, lambda, f: c / lambda };
}
export const seriesName = (n1: number) => ['', 'Lyman', 'Balmer', 'Paschen', 'Brackett', 'Pfund'][n1] ?? `n=${n1}`;

/* ───────────── Blackbody ───────────── */
/** Planck spectral radiance B(λ, T) in W·sr⁻¹·m⁻³. */
export function planck(lambda: number, T: number) {
  const x = (h * c) / (lambda * kB * T);
  if (x > 700) return 0;
  return (2 * h * c * c) / lambda ** 5 / Math.expm1(x);
}
export const wienPeak = (T: number) => wienB / Math.max(T, 1);

/** Approximate sRGB colour (0–1) of a blackbody at temperature T (K), valid ~1000–40000 K. */
export function blackbodyRGB(T: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, T)) / 100;
  const clamp = (v: number) => Math.min(255, Math.max(0, v)) / 255;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp(r), clamp(g), clamp(b)];
}

/** Morgan–Keenan spectral class from surface temperature. */
export function spectralClass(T: number) {
  if (T >= 30000) return 'O';
  if (T >= 10000) return 'B';
  if (T >= 7500) return 'A';
  if (T >= 6000) return 'F';
  if (T >= 5200) return 'G';
  if (T >= 3700) return 'K';
  return 'M';
}
