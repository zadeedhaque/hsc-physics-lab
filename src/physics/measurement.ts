/** Measurement instruments, errors and significant figures. */

/** Vernier caliper: least count = 1 MSD − 1 VSD = s/n. Reading = MSR + VSC × LC − zero error. */
export function vernierReading(trueLength: number, msd: number, nVernier: number, zeroError: number) {
  const lc = msd / nVernier;
  const observed = trueLength + zeroError; // what the instrument shows before correction
  const msr = Math.floor(observed / msd + 1e-9) * msd;
  const vsc = Math.round((observed - msr) / lc);
  const raw = msr + vsc * lc;
  return { lc, msr, vsc, raw, corrected: raw - zeroError };
}

/** Screw gauge: LC = pitch / circular divisions. */
export function screwGaugeReading(trueLength: number, pitch: number, divisions: number, zeroError: number) {
  const lc = pitch / divisions;
  const observed = trueLength + zeroError;
  const lsr = Math.floor(observed / pitch + 1e-9) * pitch;
  const csr = Math.round((observed - lsr) / lc);
  const raw = lsr + csr * lc;
  return { lc, lsr, csr, raw, corrected: raw - zeroError };
}

export function errors(measured: number, trueValue: number) {
  const abs = Math.abs(measured - trueValue);
  const rel = trueValue === 0 ? 0 : abs / Math.abs(trueValue);
  return { abs, rel, percent: rel * 100 };
}

/* ───────────── Significant figures ───────────── */

/** Count significant figures in a numeric string (trailing zeros without a decimal point are ambiguous → not counted). */
export function sigFigs(str: string): number {
  const s = str.trim().replace(/^[+-]/, '').toLowerCase();
  const [mantissa] = s.split('e');
  if (!/^\d*\.?\d*$/.test(mantissa) || mantissa === '' || mantissa === '.') return 0;
  const hasPoint = mantissa.includes('.');
  let digits = mantissa.replace('.', '');
  digits = digits.replace(/^0+/, '');
  if (digits === '') return hasPoint ? Math.max(1, mantissa.split('.')[1]?.length ?? 1) : 1;
  if (!hasPoint) digits = digits.replace(/0+$/, '');
  return digits.length;
}

/** Number of decimal places in a numeric string. */
export function decimalPlaces(str: string): number {
  const [mantissa, exp] = str.trim().toLowerCase().split('e');
  const dp = mantissa.includes('.') ? mantissa.split('.')[1].length : 0;
  return Math.max(0, dp - (exp ? parseInt(exp, 10) : 0));
}

export const roundSig = (v: number, n: number) => (v === 0 ? 0 : Number(v.toPrecision(Math.max(1, Math.min(21, n)))));
export const roundDp = (v: number, dp: number) => Number(v.toFixed(Math.max(0, Math.min(20, dp))));

/* ───────────── Dimensional analysis ───────────── */
/** Dimensions as exponents of [M, L, T, I, Θ]. */
export type Dim = [number, number, number, number, number];
export const QUANTITIES: Record<string, { name: string; dim: Dim; unit: string }> = {
  length: { name: 'Length', dim: [0, 1, 0, 0, 0], unit: 'm' },
  mass: { name: 'Mass', dim: [1, 0, 0, 0, 0], unit: 'kg' },
  time: { name: 'Time', dim: [0, 0, 1, 0, 0], unit: 's' },
  velocity: { name: 'Velocity', dim: [0, 1, -1, 0, 0], unit: 'm s⁻¹' },
  acceleration: { name: 'Acceleration', dim: [0, 1, -2, 0, 0], unit: 'm s⁻²' },
  force: { name: 'Force', dim: [1, 1, -2, 0, 0], unit: 'N' },
  energy: { name: 'Energy / Work', dim: [1, 2, -2, 0, 0], unit: 'J' },
  power: { name: 'Power', dim: [1, 2, -3, 0, 0], unit: 'W' },
  momentum: { name: 'Momentum', dim: [1, 1, -1, 0, 0], unit: 'kg m s⁻¹' },
  pressure: { name: 'Pressure / Stress', dim: [1, -1, -2, 0, 0], unit: 'Pa' },
  frequency: { name: 'Frequency', dim: [0, 0, -1, 0, 0], unit: 'Hz' },
  density: { name: 'Density', dim: [1, -3, 0, 0, 0], unit: 'kg m⁻³' },
  charge: { name: 'Charge', dim: [0, 0, 1, 1, 0], unit: 'C' },
  voltage: { name: 'Potential difference', dim: [1, 2, -3, -1, 0], unit: 'V' },
  resistance: { name: 'Resistance', dim: [1, 2, -3, -2, 0], unit: 'Ω' },
  G: { name: 'Gravitational constant G', dim: [-1, 3, -2, 0, 0], unit: 'N m² kg⁻²' },
  h: { name: 'Planck constant h', dim: [1, 2, -1, 0, 0], unit: 'J s' },
  surfaceTension: { name: 'Surface tension', dim: [1, 0, -2, 0, 0], unit: 'N m⁻¹' },
  viscosity: { name: 'Viscosity η', dim: [1, -1, -1, 0, 0], unit: 'Pa s' },
  temperature: { name: 'Temperature', dim: [0, 0, 0, 0, 1], unit: 'K' },
  springConst: { name: 'Spring constant', dim: [1, 0, -2, 0, 0], unit: 'N m⁻¹' },
  angularVel: { name: 'Angular velocity', dim: [0, 0, -1, 0, 0], unit: 'rad s⁻¹' },
};

export const dimMul = (a: Dim, b: Dim, pb = 1): Dim => a.map((x, i) => x + pb * b[i]) as Dim;
export const dimPow = (a: Dim, p: number): Dim => a.map((x) => x * p) as Dim;
export const dimEq = (a: Dim, b: Dim) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);

export function dimString(d: Dim): string {
  const sym = ['M', 'L', 'T', 'I', 'Θ'];
  const sup = (n: number) => (Number.isInteger(n) ? String(n).replace('-', '⁻').replace(/\d/g, (ch) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+ch]) : `^(${+n.toFixed(3)})`);
  const parts = d.map((p, i) => (Math.abs(p) < 1e-9 ? null : p === 1 ? sym[i] : `${sym[i]}${sup(p)}`)).filter(Boolean);
  return parts.length ? `[${parts.join(' ')}]` : '[dimensionless]';
}
