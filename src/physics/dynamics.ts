/** Newtonian dynamics: friction, inclines, pulleys, collisions, momentum. */

export interface FrictionInput { m: number; F: number; muS: number; muK: number; g: number; v: number }

/**
 * Block on a horizontal surface with a horizontal applied force F.
 * Friction is static (balancing F, up to μsN) while at rest, kinetic (μkN, opposing motion) once sliding.
 */
export function frictionBlock({ m, F, muS, muK, g, v }: FrictionInput) {
  const N = m * g;
  const fsMax = muS * N;
  const fk = muK * N;
  const moving = Math.abs(v) > 1e-9;
  const sliding = moving || Math.abs(F) > fsMax;
  let friction: number;
  if (!sliding) friction = -F;
  else friction = -(moving ? Math.sign(v) : Math.sign(F)) * fk;
  const a = (F + friction) / m;
  return { N, fsMax, fk, friction, a, sliding, net: F + friction };
}

/** Block on an incline (angle in rad). Positive values point down the slope. */
export function incline({ m, angle, muS, muK, g, v }: { m: number; angle: number; muS: number; muK: number; g: number; v: number }) {
  const W = m * g;
  const para = W * Math.sin(angle);
  const N = W * Math.cos(angle);
  const fsMax = muS * N;
  const moving = Math.abs(v) > 1e-9;
  const sliding = moving || para > fsMax;
  const friction = sliding ? -(moving ? Math.sign(v) : 1) * muK * N : -para;
  const a = (para + friction) / m;
  return { W, para, N, fsMax, friction, a, sliding };
}

/** Ideal Atwood machine (massless string, frictionless pulley). a > 0 → m₂ descends. */
export function atwood(m1: number, m2: number, g: number) {
  const M = m1 + m2;
  const a = ((m2 - m1) * g) / M;
  const T = (2 * m1 * m2 * g) / M;
  return { a, T, net: (m2 - m1) * g };
}

/**
 * 1D collision with coefficient of restitution e (1 = elastic, 0 = perfectly inelastic).
 * Momentum is conserved for every e; kinetic energy only for e = 1.
 */
export function collide1D(m1: number, u1: number, m2: number, u2: number, e: number) {
  const M = m1 + m2;
  const p = m1 * u1 + m2 * u2;
  const v1 = (p + m2 * e * (u2 - u1)) / M;
  const v2 = (p + m1 * e * (u1 - u2)) / M;
  const keBefore = 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2;
  const keAfter = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
  return { v1, v2, pBefore: p, pAfter: m1 * v1 + m2 * v2, keBefore, keAfter, keLost: keBefore - keAfter };
}

export const momentum = (m: number, v: number) => m * v;
export const impulse = (F: number, dt: number) => F * dt;
