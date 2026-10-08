import { describe, expect, it } from 'vitest';
import { notationRuns, parseNotation, parseRichMath, plainNotation, type RichNode } from './notation';

/** Compact notation for assertions: _[sub] ^[sup] {num|den}. */
const show = (nodes: RichNode[]): string =>
  nodes.map((n) => (typeof n === 'string' ? n : n.kind === 'frac' ? `{${show(n.num)}|${show(n.den)}}` : `${n.kind === 'sub' ? '_' : '^'}[${show(n.children)}]`)).join('');

describe('parseNotation', () => {
  const cases: [string, string][] = [
    ['V_d', 'V_[d]'],
    ['Diode voltage V_d', 'Diode voltage V_[d]'],
    ['KE_rot = ½ I ω²', 'KE_[rot] = ½ I ω²'],
    ['A · B = AₓBₓ + A_yB_y + A_zB_z', 'A · B = AₓBₓ + A_[y]B_[y] + A_[z]B_[z]'],
    ['m_Av_A + m_Bv_B', 'm_[A]v_[A] + m_[B]v_[B]'],
    ['Total energy ½C_eqV²', 'Total energy ½C_[eq]V²'],
    ['V_CE/dV_BB', 'V_[CE]/dV_[BB]'],
    ['v_{boat/water}', 'v_[boat/water]'],
    ['f_{s,max} = 0.4', 'f_[s,max] = 0.4'],
    ['V_out(peak)', 'V_[out](peak)'],
    ['I = Iₛ(e^{V/V_T} − 1)', 'I = Iₛ(e^[V/V_[T]] − 1)'],
    ['N = N₀ e^(−λt)', 'N = N₀ e^[−λt]'],
    ['e^(−√(E_G/E))', 'e^[−√(E_[G]/E)]'],
    ['PV^γ = constant', 'PV^[γ] = constant'],
    ['T = a^1.5', 'T = a^[1.5]'],
    ['R ≈ 1.2 A^⅓', 'R ≈ 1.2 A^[⅓]'],
    ['nᵢ ∝ T^{3/2}', 'nᵢ ∝ T^[3/2]'],
    ['(kT)^(-3/2)', '(kT)^[-3/2]'],
    ['λ_min = hc / eV', 'λ_[min] = hc / eV'],
    ['মোট ভরবেগ m_Av_A শূন্য', 'মোট ভরবেগ m_[A]v_[A] শূন্য'],
    // not notation
    ['plain text', 'plain text'],
    ['a _ b', 'a _ b'],
    ['x^ y', 'x^ y'],
  ];
  for (const [input, expected] of cases) it(input, () => expect(show(parseNotation(input))).toBe(expected));
});

describe('parseRichMath', () => {
  const cases: [string, string][] = [
    ['λ = h / p', 'λ = {h|p}'],
    ['I = (V − V_f) / R', 'I = {V − V_[f]|R}'],
    ['I = Iₛ (e^{V_d / V_T} − 1)', 'I = Iₛ (e^[V_[d] / V_[T]] − 1)'],
    ['N = N₀ (½)^(t/T½)', 'N = N₀ (½)^[t/T½]'],
    ['v_ground = v_{boat/water} + v_river  (vector sum)', 'v_[ground] = v_[boat/water] + v_[river]  (vector sum)'],
    ['r_d = V_T / I (forward)', 'r_[d] = {V_[T]|I} (forward)'],
    ['γ = C_p / C_v', 'γ = {C_[p]|C_[v]}'],
    ['% error = (|x̄ − x_true| / x_true) × 100', '% error = ({|x̄ − x_[true]||x_[true]}) × 100'],
  ];
  for (const [input, expected] of cases) it(input, () => expect(show(parseRichMath(input))).toBe(expected));
});

describe('plainNotation', () => {
  it('uses Unicode scripts where they exist', () => {
    expect(plainNotation('v_x')).toBe('vₓ');
    expect(plainNotation('T^{3/2}')).toBe('T^(3/2)');
    expect(plainNotation('x^2')).toBe('x²');
    expect(plainNotation('V_d')).toBe('V_d');
    expect(plainNotation('no notation')).toBe('no notation');
  });
});

describe('notationRuns', () => {
  it('splits canvas text into baseline and script runs', () => {
    expect(notationRuns('V_d (V)')).toEqual([{ text: 'V', level: 0 }, { text: 'd', level: -1 }, { text: ' (V)', level: 0 }]);
  });
});
