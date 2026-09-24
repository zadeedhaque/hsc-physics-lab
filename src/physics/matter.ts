/** Structural properties of matter: elasticity, surface tension, viscosity. */

export function elasticity(F: number, area: number, L0: number, Y: number) {
  const stress = F / Math.max(area, 1e-12);
  const strain = stress / Y;
  return { stress, strain, dL: strain * L0 };
}

/** Jurin's law: capillary rise h = 2T cos θ / (ρ g r). Negative h = depression (θ > 90°). */
export const capillaryRise = (T: number, theta: number, rho: number, g: number, r: number) =>
  (2 * T * Math.cos(theta)) / (rho * g * Math.max(r, 1e-9));

/** Excess pressure inside a drop ΔP = 2T/r (bubble with two surfaces: 4T/r). */
export const dropExcessPressure = (T: number, r: number) => (2 * T) / Math.max(r, 1e-12);

/** Stokes' drag F = 6πηrv. */
export const stokesDrag = (eta: number, r: number, v: number) => 6 * Math.PI * eta * r * v;

/** Terminal velocity of a sphere v_t = 2r²(ρ − σ)g / 9η. */
export const terminalVelocity = (r: number, rhoSphere: number, rhoFluid: number, g: number, eta: number) =>
  (2 * r * r * (rhoSphere - rhoFluid) * g) / (9 * Math.max(eta, 1e-9));

/** Reynolds number Re = ρvD/η. */
export const reynolds = (rho: number, v: number, D: number, eta: number) => (rho * v * D) / Math.max(eta, 1e-12);
