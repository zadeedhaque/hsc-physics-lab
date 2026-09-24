/** Mechanical waves and sound. */
export const waveSpeed = (f: number, lambda: number) => f * lambda;
export const waveNumber = (lambda: number) => (2 * Math.PI) / Math.max(lambda, 1e-12);

/** Progressive wave y = A sin(kx − ωt + φ). */
export const travelling = (A: number, lambda: number, f: number, x: number, t: number, phase = 0) =>
  A * Math.sin(waveNumber(lambda) * x - 2 * Math.PI * f * t + phase);

/** Standing wave y = 2A sin(kx) cos(ωt). */
export const standing = (A: number, lambda: number, f: number, x: number, t: number) =>
  2 * A * Math.sin(waveNumber(lambda) * x) * Math.cos(2 * Math.PI * f * t);

/** Transverse wave on a stretched string: v = √(T/μ), fₙ = n v / 2L. */
export function stringModes(T: number, mu: number, L: number, n: number) {
  const v = Math.sqrt(T / Math.max(mu, 1e-12));
  return { v, fn: (n * v) / (2 * L), lambda: (2 * L) / n };
}

/**
 * Doppler shift f′ = f (v + v_o)/(v − v_s).
 * v_o > 0 when the observer moves toward the source, v_s > 0 when the source moves toward the observer.
 */
export function doppler(f: number, v: number, vObserver: number, vSource: number) {
  const denom = v - vSource;
  if (denom <= 0) return Infinity;
  return Math.max(0, (f * (v + vObserver)) / denom);
}

export const beatFrequency = (f1: number, f2: number) => Math.abs(f1 - f2);

/** Speed of sound in air (ideal gas approx): v = 331.3 √(T/273.15). */
export const soundSpeedAir = (T: number) => 331.3 * Math.sqrt(Math.max(T, 1) / 273.15);
