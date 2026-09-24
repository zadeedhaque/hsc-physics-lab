/** Semiconductor devices and digital logic. */

/** Shockley diode equation I = Iₛ (e^{V/(nV_T)} − 1). */
export function diodeCurrent(V: number, Is = 1e-12, n = 1.8, T = 300) {
  const VT = (1.380649e-23 * T) / 1.602176634e-19;
  return Is * Math.expm1(Math.min(V / (n * VT), 80));
}

/** Idealised silicon diode used for circuit visuals: knee at Vk, small on-resistance. */
export function idealDiode(V: number, Vk = 0.7, rOn = 0.5) {
  return V > Vk ? (V - Vk) / rOn : 0;
}

/** Zener: blocks between −Vz and Vk; conducts beyond. Returns current (A) for series resistance Rs. */
export function zenerRegulator(Vin: number, Vz: number, Rs: number, Rload: number) {
  const Vopen = (Vin * Rload) / (Rs + Rload);
  if (Vopen < Vz) return { Vout: Vopen, Iz: 0, Is: Vin / (Rs + Rload), IL: Vopen / Rload, regulating: false };
  const Is = (Vin - Vz) / Rs;
  const IL = Vz / Rload;
  return { Vout: Vz, Iz: Is - IL, Is, IL, regulating: true };
}

/** Transistor current relations: I_E = I_B + I_C, β = I_C/I_B, α = I_C/I_E. */
export function transistor(Ib: number, beta: number) {
  const Ic = beta * Ib;
  const Ie = Ib + Ic;
  return { Ic, Ie, alpha: beta / (beta + 1) };
}

export type Gate = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'XNOR';
export function gate(type: Gate, a: boolean, b: boolean): boolean {
  switch (type) {
    case 'AND': return a && b;
    case 'OR': return a || b;
    case 'NOT': return !a;
    case 'NAND': return !(a && b);
    case 'NOR': return !(a || b);
    case 'XOR': return a !== b;
    case 'XNOR': return a === b;
  }
}

/** Rectifier output for a sinusoidal input (ideal diodes with forward drop). */
export function rectify(vin: number, mode: 'half' | 'full', drop = 0.7) {
  if (mode === 'half') return Math.max(0, vin - drop);
  return Math.max(0, Math.abs(vin) - 2 * drop);
}
