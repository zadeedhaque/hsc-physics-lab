/** Geometrical and physical optics. */

/** Snell's law n₁ sin i = n₂ sin r. Returns null when total internal reflection occurs. */
export function snell(n1: number, n2: number, i: number): number | null {
  const s = (n1 / n2) * Math.sin(i);
  if (Math.abs(s) > 1) return null;
  return Math.asin(s);
}

/** Critical angle for light going from denser n₁ to rarer n₂ (null if n₁ ≤ n₂). */
export const criticalAngle = (n1: number, n2: number) => (n1 <= n2 ? null : Math.asin(n2 / n1));

/**
 * Thin lens in the "real-is-positive" convention used in HSC textbooks:
 *   1/u + 1/v = 1/f,  f > 0 convex, f < 0 concave, u > 0 real object.
 * v > 0 → real image (opposite side), v < 0 → virtual image (same side).
 * Magnification m = v/u (magnitude); real images are inverted.
 */
export function thinLens(u: number, f: number) {
  if (Math.abs(u - f) < 1e-9) return { v: Infinity, m: Infinity, real: false, atInfinity: true };
  const v = (u * f) / (u - f);
  return { v, m: Math.abs(v / u), real: v > 0, atInfinity: false };
}

/** Lens power P = 1/f (f in metres) → dioptres. */
export const lensPower = (f: number) => 1 / f;

/** Two thin lenses in contact: 1/F = 1/f₁ + 1/f₂. */
export const combinedFocal = (f1: number, f2: number) => 1 / (1 / f1 + 1 / f2);

/** Prism: minimum deviation δm and refractive index n = sin((A+δm)/2)/sin(A/2). */
export function prismMinDeviation(A: number, n: number) {
  const s = n * Math.sin(A / 2);
  if (s > 1) return null;
  return 2 * Math.asin(s) - A;
}

/** Trace a ray through a prism of apex angle A for incidence i. Returns emergent angle & deviation or null (TIR). */
export function prismTrace(A: number, n: number, i: number) {
  const r1 = Math.asin(Math.sin(i) / n);
  const r2 = A - r1;
  const s = n * Math.sin(r2);
  if (Math.abs(s) > 1) return null;
  const e = Math.asin(s);
  return { r1, r2, e, deviation: i + e - A };
}

/** Cauchy dispersion model n(λ) = A + B/λ² (λ in nm) — crown-glass-like defaults. */
export const cauchy = (lambdaNm: number, A = 1.5046, B = 4200) => A + B / (lambdaNm * lambdaNm);

/* ───────────── Physical optics ───────────── */

/** Young's double slit: fringe width β = λD/d. */
export const fringeWidth = (lambda: number, D: number, d: number) => (lambda * D) / Math.max(d, 1e-12);

/** Double-slit intensity with single-slit envelope (slit width a). */
export function doubleSlitIntensity(y: number, lambda: number, D: number, d: number, a: number) {
  const sinTh = y / Math.sqrt(y * y + D * D);
  const phi = (Math.PI * d * sinTh) / lambda;
  const beta = (Math.PI * a * sinTh) / lambda;
  const env = beta === 0 ? 1 : (Math.sin(beta) / beta) ** 2;
  return Math.cos(phi) ** 2 * env;
}

/** Single-slit diffraction intensity; minima at a sinθ = nλ. */
export function singleSlitIntensity(y: number, lambda: number, D: number, a: number) {
  const sinTh = y / Math.sqrt(y * y + D * D);
  const beta = (Math.PI * a * sinTh) / lambda;
  return beta === 0 ? 1 : (Math.sin(beta) / beta) ** 2;
}

/** Malus' law I = I₀ cos²θ. */
export const malus = (I0: number, theta: number) => I0 * Math.cos(theta) ** 2;

/** Approximate sRGB colour of a visible wavelength (nm). */
export function wavelengthToRGB(nm: number): [number, number, number] {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else if (nm <= 780) { r = 1; }
  let f = 1;
  if (nm < 420) f = 0.3 + (0.7 * (nm - 380)) / 40;
  else if (nm > 700) f = 0.3 + (0.7 * (780 - nm)) / 80;
  if (nm < 380 || nm > 780) f = 0;
  return [Math.max(0, r * f), Math.max(0, g * f), Math.max(0, b * f)];
}
