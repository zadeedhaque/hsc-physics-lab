import { describe, expect, it } from 'vitest';
import { flattenMath, parseMath, type MathNode } from './mathText';

/** Compact notation for assertions: fractions become {num|den}. */
const show = (nodes: MathNode[]): string => nodes.map((n) => (typeof n === 'string' ? n : `{${show(n.num)}|${show(n.den)}}`)).join('');

describe('parseMath', () => {
  const cases: [string, string][] = [
    ['λ = h / p', 'λ = {h|p}'],
    ['1/f = 1/u + 1/v', '{1|f} = {1|u} + {1|v}'],
    ['ω = √(k/m)', 'ω = √({k|m})'],
    ['I = (V − V_f) / R', 'I = {V − V_f|R}'],
    ['d₀ = 1.44 MeV·fm × 2 × 79 / 5 MeV = 45.5 fm', 'd₀ = {1.44 MeV·fm × 2 × 79|5 MeV} = 45.5 fm'],
    ['λ_min = hc / eV = 1.24 / 35 kV = 0.035 nm', 'λ_min = {hc|eV} = {1.24|35 kV} = 0.035 nm'],
    ['γ = 1 / √(1 − v²/c²)', 'γ = {1|√(1 − {v²|c²})}'],
    ['R/R☉ = √(L/L☉) / (T/T☉)²', '{R|R☉} = {√({L|L☉})|({T|T☉})²}'],
    ['e = √((1 + e)/(1 − e))', 'e = √({1 + e|1 − e})'],
    ['δ = sin((A + δₘ)/2)', 'δ = sin({A + δₘ|2})'],
    ['v = 9.8 m/s', 'v = 9.8 m/s'],
    ['μ₀ = 4π×10⁻⁷ T·m/A', 'μ₀ = 4π×10⁻⁷ T·m/A'],
    ['η = 0.98 N·s/m²', 'η = 0.98 N·s/m²'],
    ['v_boat/water = 3', 'v_boat/water = 3'],
    ['ω = √(g/L)', 'ω = √({g|L})'],
    ['E = −dΦ/dt', 'E = −{dΦ|dt}'],
    ['I = I₀ e^(−t/RC)', 'I = I₀ e^(−{t|RC})'],
    ['Δp ≥ 1.055×10⁻³⁴ / (2 × 8e-10) = 6.6e-26', 'Δp ≥ {1.055×10⁻³⁴|2 × 8e-10} = 6.6e-26'],
    ['I_B = (V_BB − 0.7) / R_B', 'I_B = {V_BB − 0.7|R_B}'],
    ['E = γ m₀ c² ,  KE = (γ − 1) m₀ c²', 'E = γ m₀ c² ,  KE = (γ − 1) m₀ c²'],
    ['0.0259 × ln(1e32 / 10²⁰)', '0.0259 × ln({1e32|10²⁰})'],
    ['m v r = n h / 2π', 'm v r = {n h|2π}'],
    ['Eₙ = −13.6 Z² / n² eV', 'Eₙ = {−13.6 Z²|n²} eV'],
    ['rₙ = 0.529 n² / Z Å', 'rₙ = {0.529 n²|Z} Å'],
    ['λ ≈ 1.226 / √V nm', 'λ ≈ {1.226|√V} nm'],
    ['r_d = V_T / I (forward)', 'r_d = {V_T|I} (forward)'],
    ['P = 1 / f (m) = 100 / f (cm)', 'P = {1|f} (m) = {100|f} (cm)'],
    ['I_B = (1.5 − 0.7) / 100 kΩ = 8 µA', 'I_B = {1.5 − 0.7|100 kΩ} = 8 µA'],
    ['% error = (|x̄ − x| / x) × 100', '% error = ({|x̄ − x||x}) × 100'],
    ['v = 12.4 AU²/yr', 'v = 12.4 AU²/yr'],
  ];
  for (const [input, expected] of cases) {
    it(input, () => {
      const nodes = parseMath(input);
      expect(show(nodes)).toBe(expected);
      expect(flattenMath(nodes)).toBe(input);
    });
  }
});
