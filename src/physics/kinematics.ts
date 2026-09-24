/** Kinematics: uniform / uniformly-accelerated motion, projectiles, circular motion. */
export interface Motion1D { x: number; v: number; a: number }

/** s = ut + ½at², v = u + at  (constant acceleration). */
export function uniformAccel(u: number, a: number, t: number, x0 = 0): Motion1D {
  return { x: x0 + u * t + 0.5 * a * t * t, v: u + a * t, a };
}

export interface ProjectileParams { u: number; angle: number; h0: number; g: number }

/** Closed-form projectile quantities (no air resistance). Angle in radians. */
export function projectile({ u, angle, h0, g }: ProjectileParams) {
  const ux = u * Math.cos(angle);
  const uy = u * Math.sin(angle);
  const gg = Math.max(g, 1e-9);
  const tPeak = Math.max(0, uy / gg);
  const tFlight = (uy + Math.sqrt(uy * uy + 2 * gg * Math.max(0, h0))) / gg;
  const maxHeight = h0 + (uy > 0 ? (uy * uy) / (2 * gg) : 0);
  const range = ux * tFlight;
  const vyFinal = uy - gg * tFlight;
  const vFinal = Math.hypot(ux, vyFinal);
  return { ux, uy, tPeak, tFlight, maxHeight, range, vFinal, vyFinal };
}

/** Position / velocity at time t (no drag). */
export function projectileAt({ u, angle, h0, g }: ProjectileParams, t: number) {
  const ux = u * Math.cos(angle);
  const uy = u * Math.sin(angle);
  return { x: ux * t, y: h0 + uy * t - 0.5 * g * t * t, vx: ux, vy: uy - g * t };
}

export interface State2D { x: number; y: number; vx: number; vy: number }

/**
 * One RK4 integration step with quadratic drag:
 * a = −g ŷ − k|v|v,   k = ½ρC_dA / m  (units 1/m).
 */
export function stepDrag(s: State2D, dt: number, g: number, k: number): State2D {
  const f = (st: State2D) => {
    const sp = Math.hypot(st.vx, st.vy);
    return { dx: st.vx, dy: st.vy, dvx: -k * sp * st.vx, dvy: -g - k * sp * st.vy };
  };
  const step = (st: State2D, d: ReturnType<typeof f>, h: number): State2D => ({
    x: st.x + d.dx * h, y: st.y + d.dy * h, vx: st.vx + d.dvx * h, vy: st.vy + d.dvy * h,
  });
  const k1 = f(s);
  const k2 = f(step(s, k1, dt / 2));
  const k3 = f(step(s, k2, dt / 2));
  const k4 = f(step(s, k3, dt));
  return {
    x: s.x + (dt / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx),
    y: s.y + (dt / 6) * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy),
    vx: s.vx + (dt / 6) * (k1.dvx + 2 * k2.dvx + 2 * k3.dvx + k4.dvx),
    vy: s.vy + (dt / 6) * (k1.dvy + 2 * k2.dvy + 2 * k3.dvy + k4.dvy),
  };
}

/** Integrate a full trajectory with drag until the ground (y = 0). */
export function dragTrajectory(p: ProjectileParams, k: number, dt = 1 / 500) {
  let s: State2D = { x: 0, y: p.h0, vx: p.u * Math.cos(p.angle), vy: p.u * Math.sin(p.angle) };
  let t = 0;
  let maxHeight = p.h0;
  const points: [number, number][] = [[s.x, s.y]];
  for (let i = 0; i < 400_000; i++) {
    const next = stepDrag(s, dt, p.g, k);
    if (next.y < 0) {
      const frac = s.y / Math.max(1e-12, s.y - next.y);
      s = { x: s.x + (next.x - s.x) * frac, y: 0, vx: s.vx + (next.vx - s.vx) * frac, vy: s.vy + (next.vy - s.vy) * frac };
      t += dt * frac;
      points.push([s.x, 0]);
      break;
    }
    s = next;
    t += dt;
    maxHeight = Math.max(maxHeight, s.y);
    if (i % 10 === 0) points.push([s.x, s.y]);
  }
  return { tFlight: t, range: s.x, maxHeight, vFinal: Math.hypot(s.vx, s.vy), points };
}

/** Uniform circular motion. Period is Infinity when speed is 0 (caller should guard display). */
export function circular(radius: number, speed: number, mass: number) {
  const r = Math.max(radius, 1e-9);
  const omega = speed / r;
  const period = speed === 0 ? Infinity : (2 * Math.PI * r) / Math.abs(speed);
  return { omega, period, frequency: speed === 0 ? 0 : 1 / period, ac: (speed * speed) / r, Fc: (mass * speed * speed) / r };
}
