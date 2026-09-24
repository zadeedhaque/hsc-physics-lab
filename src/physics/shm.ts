/** Simple harmonic motion and pendulums. */
export function springSHM(m: number, kSpring: number) {
  const omega = Math.sqrt(kSpring / Math.max(m, 1e-9));
  return { omega, period: (2 * Math.PI) / omega, frequency: omega / (2 * Math.PI) };
}

/** x, v, a at time t for x = A cos(ωt + φ). */
export function shmState(A: number, omega: number, phase: number, t: number) {
  const th = omega * t + phase;
  return { x: A * Math.cos(th), v: -A * omega * Math.sin(th), a: -omega * omega * A * Math.cos(th) };
}

/** Arithmetic–geometric mean. */
function agm(a: number, b: number) {
  for (let i = 0; i < 40 && Math.abs(a - b) > 1e-15; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  return a;
}

/** Pendulum periods: small-angle T₀ = 2π√(L/g) and the exact large-amplitude period (via AGM). */
export function pendulumPeriod(L: number, g: number, amplitude: number) {
  const T0 = 2 * Math.PI * Math.sqrt(L / Math.max(g, 1e-9));
  const exact = T0 / agm(1, Math.cos(Math.min(amplitude, 3.1) / 2));
  return { T0, exact };
}

/** RK4 step for the nonlinear pendulum θ″ = −(g/L) sin θ − bθ′. */
export function stepPendulum(theta: number, omega: number, dt: number, g: number, L: number, damping = 0) {
  const f = (th: number, w: number) => [w, -(g / L) * Math.sin(th) - damping * w] as const;
  const [a1, b1] = f(theta, omega);
  const [a2, b2] = f(theta + (a1 * dt) / 2, omega + (b1 * dt) / 2);
  const [a3, b3] = f(theta + (a2 * dt) / 2, omega + (b2 * dt) / 2);
  const [a4, b4] = f(theta + a3 * dt, omega + b3 * dt);
  return {
    theta: theta + (dt / 6) * (a1 + 2 * a2 + 2 * a3 + a4),
    omega: omega + (dt / 6) * (b1 + 2 * b2 + 2 * b3 + b4),
  };
}
