/** 3D vector algebra (pure functions on [x, y, z] tuples). */
export type Vec3 = [number, number, number];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const mag = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

/** Angle between two vectors in radians (0 if either is the zero vector). */
export function angleBetween(a: Vec3, b: Vec3) {
  const m = mag(a) * mag(b);
  if (m === 0) return 0;
  return Math.acos(Math.min(1, Math.max(-1, dot(a, b) / m)));
}

/**
 * Build a vector from magnitude + direction.
 * theta = azimuth in the x–y plane measured from +x, phi = elevation toward +z.
 */
export function fromPolar(magnitude: number, thetaRad: number, phiRad = 0): Vec3 {
  const c = Math.cos(phiRad);
  return [magnitude * c * Math.cos(thetaRad), magnitude * c * Math.sin(thetaRad), magnitude * Math.sin(phiRad)];
}

/** Direction (azimuth in x–y plane, elevation) of a vector, radians. */
export function direction(a: Vec3) {
  return { azimuth: Math.atan2(a[1], a[0]), elevation: Math.atan2(a[2], Math.hypot(a[0], a[1])) };
}
