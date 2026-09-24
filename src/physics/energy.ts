/** Work, energy and power. */
export const work = (F: number, s: number, angle: number) => F * s * Math.cos(angle);
export const kinetic = (m: number, v: number) => 0.5 * m * v * v;
export const potential = (m: number, g: number, h: number) => m * g * h;
export const springPE = (kSpring: number, x: number) => 0.5 * kSpring * x * x;
export const power = (W: number, t: number) => (t === 0 ? 0 : W / t);
