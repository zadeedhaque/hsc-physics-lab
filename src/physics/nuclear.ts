import { MeVperU } from './constants';

/** Decay constant λ = ln 2 / T½. */
export const decayConstant = (halfLife: number) => Math.LN2 / Math.max(halfLife, 1e-12);
/** N(t) = N₀ e^{−λt}. */
export const remaining = (N0: number, halfLife: number, t: number) => N0 * Math.exp(-decayConstant(halfLife) * t);
/** Activity A = λN. */
export const activity = (N: number, halfLife: number) => decayConstant(halfLife) * N;
export const meanLife = (halfLife: number) => halfLife / Math.LN2;

/** Probability a single nucleus decays within dt. */
export const decayProbability = (halfLife: number, dt: number) => 1 - Math.exp(-decayConstant(halfLife) * dt);

const M_PROTON_U = 1.007_276_466_621;
const M_NEUTRON_U = 1.008_664_915_95;
const M_ELECTRON_U = 0.000_548_579_909;

/** Binding energy from atomic mass (u): BE = [Z(mp+me) + N mn − M]c². */
export function bindingEnergy(Z: number, A: number, atomicMassU: number) {
  const N = A - Z;
  const defect = Z * (M_PROTON_U + M_ELECTRON_U) + N * M_NEUTRON_U - atomicMassU;
  const BE = defect * MeVperU;
  return { defect, BE, perNucleon: BE / A };
}

/** Semi-empirical (Weizsäcker) binding energy in MeV — used to draw the BE/A curve. */
export function semiEmpiricalBE(Z: number, A: number) {
  if (A < 1) return 0;
  const N = A - Z;
  const aV = 15.75, aS = 17.8, aC = 0.711, aA = 23.7, aP = 11.18;
  let pair = 0;
  if (Z % 2 === 0 && N % 2 === 0) pair = aP / Math.sqrt(A);
  else if (Z % 2 === 1 && N % 2 === 1) pair = -aP / Math.sqrt(A);
  return aV * A - aS * A ** (2 / 3) - (aC * Z * (Z - 1)) / A ** (1 / 3) - (aA * (A - 2 * Z) ** 2) / A + pair;
}

/** Most stable Z for mass number A (from the SEMF). */
export const stableZ = (A: number) => Math.round(A / (2 + 0.0155 * A ** (2 / 3)));

export const massU = { p: M_PROTON_U, n: M_NEUTRON_U, e: M_ELECTRON_U };
