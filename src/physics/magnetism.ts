import { mu0 } from './constants';

/** Field of a long straight wire B = μ₀I / 2πr. */
export const wireField = (I: number, r: number) => (r <= 0 ? 0 : (mu0 * I) / (2 * Math.PI * r));

/** Field inside a long solenoid B = μ₀ n I (n = N/L). */
export const solenoidField = (N: number, L: number, I: number) => (mu0 * N * I) / Math.max(L, 1e-9);

/** Field at the centre of a circular loop of N turns: B = μ₀NI / 2R. */
export const loopField = (N: number, I: number, R: number) => (mu0 * N * I) / (2 * Math.max(R, 1e-9));

/** Force on a straight conductor F = BIL sinθ. */
export const wireForce = (B: number, I: number, L: number, theta: number) => B * I * L * Math.sin(theta);

/** Charged particle in a uniform B field: radius, period, pitch of the helix. */
export function cyclotronMotion(q: number, m: number, v: number, B: number, pitchAngle: number) {
  const aq = Math.abs(q), aB = Math.abs(B);
  const vPerp = v * Math.sin(pitchAngle);
  const vPar = v * Math.cos(pitchAngle);
  if (aq === 0 || aB === 0) return { r: Infinity, T: Infinity, f: 0, omega: 0, pitch: Infinity, vPerp, vPar, F: 0 };
  const omega = (aq * aB) / m;
  const T = (2 * Math.PI) / omega;
  return { r: (m * vPerp) / (aq * aB), T, f: 1 / T, omega, pitch: vPar * T, vPerp, vPar, F: aq * vPerp * aB };
}

/** Magnetic moment of a current loop m = NIA and torque τ = mB sinθ. */
export const loopMoment = (N: number, I: number, A: number) => N * I * A;
