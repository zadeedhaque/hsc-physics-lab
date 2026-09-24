/**
 * Shared field-line tracing and contouring used by electric, magnetic and gravitational field sims.
 * Pure geometry (no Three.js) so it is easy to test.
 */
export type Vec2 = [number, number];
export type Field2D = (x: number, y: number) => Vec2;

/** Trace a line along (or against) a 2D field using RK2 with fixed arc-length steps. */
export function trace(field: Field2D, start: Vec2, opts: { step?: number; maxSteps?: number; bounds?: number; backward?: boolean; stop?: (x: number, y: number) => boolean }): Vec2[] {
  const h = opts.step ?? 0.05;
  const max = opts.maxSteps ?? 800;
  const B = opts.bounds ?? 10;
  const dir = opts.backward ? -1 : 1;
  const pts: Vec2[] = [start];
  let [x, y] = start;
  const unit = (px: number, py: number): Vec2 | null => {
    const [fx, fy] = field(px, py);
    const m = Math.hypot(fx, fy);
    if (!(m > 1e-30) || !Number.isFinite(m)) return null;
    return [(dir * fx) / m, (dir * fy) / m];
  };
  for (let i = 0; i < max; i++) {
    const k1 = unit(x, y);
    if (!k1) break;
    const k2 = unit(x + (k1[0] * h) / 2, y + (k1[1] * h) / 2);
    if (!k2) break;
    x += k2[0] * h;
    y += k2[1] * h;
    pts.push([x, y]);
    if (Math.abs(x) > B || Math.abs(y) > B) break;
    if (opts.stop?.(x, y)) break;
  }
  return pts;
}

/**
 * Marching squares: iso-lines of a scalar grid.
 * values[j][i] sampled at x = x0 + i·dx, y = y0 + j·dy. Returns line segments.
 */
export function contour(values: number[][], x0: number, y0: number, dx: number, dy: number, level: number): [Vec2, Vec2][] {
  const segs: [Vec2, Vec2][] = [];
  const ny = values.length, nx = values[0]?.length ?? 0;
  const interp = (xa: number, ya: number, va: number, xb: number, yb: number, vb: number): Vec2 => {
    const t = (level - va) / (vb - va || 1e-30);
    return [xa + (xb - xa) * t, ya + (yb - ya) * t];
  };
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const v0 = values[j][i], v1 = values[j][i + 1], v2 = values[j + 1][i + 1], v3 = values[j + 1][i];
      if (![v0, v1, v2, v3].every(Number.isFinite)) continue;
      const xa = x0 + i * dx, ya = y0 + j * dy, xb = xa + dx, yb = ya + dy;
      const c = (v0 > level ? 1 : 0) | (v1 > level ? 2 : 0) | (v2 > level ? 4 : 0) | (v3 > level ? 8 : 0);
      if (c === 0 || c === 15) continue;
      const e0 = () => interp(xa, ya, v0, xb, ya, v1); // bottom
      const e1 = () => interp(xb, ya, v1, xb, yb, v2); // right
      const e2 = () => interp(xa, yb, v3, xb, yb, v2); // top
      const e3 = () => interp(xa, ya, v0, xa, yb, v3); // left
      switch (c) {
        case 1: case 14: segs.push([e3(), e0()]); break;
        case 2: case 13: segs.push([e0(), e1()]); break;
        case 3: case 12: segs.push([e3(), e1()]); break;
        case 4: case 11: segs.push([e1(), e2()]); break;
        case 6: case 9: segs.push([e0(), e2()]); break;
        case 7: case 8: segs.push([e3(), e2()]); break;
        case 5: segs.push([e3(), e0()], [e1(), e2()]); break;
        case 10: segs.push([e0(), e1()], [e2(), e3()]); break;
      }
    }
  }
  return segs;
}
