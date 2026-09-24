import { G } from './constants';

export const gravForce = (m1: number, m2: number, r: number) => (r <= 0 ? 0 : (G * m1 * m2) / (r * r));
export const fieldStrength = (M: number, r: number) => (r <= 0 ? 0 : (G * M) / (r * r));
export const gravPotential = (M: number, r: number) => (r <= 0 ? 0 : (-G * M) / r);
export const escapeVelocity = (M: number, R: number) => Math.sqrt((2 * G * M) / Math.max(R, 1));
export const orbitalVelocity = (M: number, r: number) => Math.sqrt((G * M) / Math.max(r, 1));
export const orbitalPeriod = (M: number, r: number) => 2 * Math.PI * Math.sqrt(r ** 3 / (G * Math.max(M, 1)));

/** Orbit shape for a tangential launch at distance r with speed v. */
export function orbitFromState(M: number, r: number, v: number) {
  const mu = G * M;
  const energy = (v * v) / 2 - mu / r; // specific orbital energy (J/kg)
  const a = energy < 0 ? -mu / (2 * energy) : Infinity;
  const hSpec = r * v;
  const e = Math.sqrt(Math.max(0, 1 + (2 * energy * hSpec * hSpec) / (mu * mu)));
  return { energy, a, e, bound: energy < 0 };
}

/** RK4 step of a test mass in a central 1/r² field (2D, any consistent units). */
export function stepOrbit(s: { x: number; y: number; vx: number; vy: number }, dt: number, mu: number) {
  const acc = (x: number, y: number) => {
    const r2 = x * x + y * y;
    const r3 = Math.max(r2 * Math.sqrt(r2), 1e-12);
    return [(-mu * x) / r3, (-mu * y) / r3] as const;
  };
  const [ax1, ay1] = acc(s.x, s.y);
  const x2 = s.x + (s.vx * dt) / 2, y2 = s.y + (s.vy * dt) / 2, vx2 = s.vx + (ax1 * dt) / 2, vy2 = s.vy + (ay1 * dt) / 2;
  const [ax2, ay2] = acc(x2, y2);
  const x3 = s.x + (vx2 * dt) / 2, y3 = s.y + (vy2 * dt) / 2, vx3 = s.vx + (ax2 * dt) / 2, vy3 = s.vy + (ay2 * dt) / 2;
  const [ax3, ay3] = acc(x3, y3);
  const x4 = s.x + vx3 * dt, y4 = s.y + vy3 * dt, vx4 = s.vx + ax3 * dt, vy4 = s.vy + ay3 * dt;
  const [ax4, ay4] = acc(x4, y4);
  return {
    x: s.x + (dt / 6) * (s.vx + 2 * vx2 + 2 * vx3 + vx4),
    y: s.y + (dt / 6) * (s.vy + 2 * vy2 + 2 * vy3 + vy4),
    vx: s.vx + (dt / 6) * (ax1 + 2 * ax2 + 2 * ax3 + ax4),
    vy: s.vy + (dt / 6) * (ay1 + 2 * ay2 + 2 * ay3 + ay4),
  };
}
