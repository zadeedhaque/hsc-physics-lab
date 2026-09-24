/** Electromagnetic induction and alternating current. */

/** Peak EMF of a coil (N turns, area A) rotating at ω in field B: ε₀ = NBAω. */
export const generatorPeak = (N: number, B: number, A: number, omega: number) => N * B * A * omega;

/** Instantaneous AC value v = V₀ sin(ωt + φ). */
export const acValue = (V0: number, f: number, t: number, phase = 0) => V0 * Math.sin(2 * Math.PI * f * t + phase);
export const rms = (peak: number) => peak / Math.SQRT2;

/** Ideal transformer: Vs/Vp = Ns/Np, Is/Ip = Np/Ns. */
export function transformer(Np: number, Ns: number, Vp: number, Rload: number) {
  const ratio = Ns / Math.max(Np, 1);
  const Vs = Vp * ratio;
  const Is = Vs / Math.max(Rload, 1e-9);
  const Ip = Is * ratio;
  return { ratio, Vs, Is, Ip, P: Vs * Is };
}

/**
 * On-axis magnetic flux through a coil (radius a) from a small bar magnet modelled as a dipole
 * of moment m at axial distance z: Φ = μ₀ m a² / (2 (a² + z²)^{3/2}) per turn.
 */
export function dipoleFluxThroughLoop(mMoment: number, a: number, z: number) {
  const mu0 = 1.25663706212e-6;
  return (mu0 * mMoment * a * a) / (2 * Math.pow(a * a + z * z, 1.5));
}
