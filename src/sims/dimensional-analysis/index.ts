import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { QUANTITIES, dimMul, dimPow, dimEq, dimString, type Dim } from '../../physics/measurement';
import { C } from '../../engine/colors';

const EXTRA: Record<string, { name: string; dim: Dim; unit: string }> = {
  linearDensity: { name: 'Linear density μ', dim: [1, -1, 0, 0, 0], unit: 'kg m⁻¹' },
  area: { name: 'Area', dim: [0, 2, 0, 0, 0], unit: 'm²' },
  volume: { name: 'Volume', dim: [0, 3, 0, 0, 0], unit: 'm³' },
  none: { name: '— (unused)', dim: [0, 0, 0, 0, 0], unit: '' },
};
const Q = { ...QUANTITIES, ...EXTRA };
const OPTIONS = Object.entries(Q).map(([value, q]) => ({ value, label: q.name }));
const BASE = ['M', 'L', 'T', 'I', 'Θ'];
const SI_TO_CGS = [1000, 100, 1, 1, 1]; // g per kg, cm per m

const sup = (x: number) => {
  if (x === 1) return '';
  if (!Number.isInteger(x)) return `^(${x})`;
  return String(x).replace('-', '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]);
};

const sim: SimDefinition = {
  camera: { position: [0, 2.5, 12], target: [0, 0.5, 0], aspect: 1.6 },
  timeless: true,
  hint: 'Each pair of bars compares the power of M, L, T, I and Θ on the two sides. Green = they match.',
  params: [
    { kind: 'select', key: 'lhs', label: 'Left-hand side quantity', default: 'time', options: OPTIONS.filter((o) => o.value !== 'none') },
    { kind: 'select', key: 'q1', label: 'Factor 1', default: 'length', options: OPTIONS },
    { kind: 'slider', key: 'e1', label: 'Power of factor 1', min: -3, max: 3, step: 0.5, default: 0.5 },
    { kind: 'select', key: 'q2', label: 'Factor 2', default: 'acceleration', options: OPTIONS },
    { kind: 'slider', key: 'e2', label: 'Power of factor 2', min: -3, max: 3, step: 0.5, default: -0.5 },
    { kind: 'select', key: 'q3', label: 'Factor 3', default: 'mass', options: OPTIONS },
    { kind: 'slider', key: 'e3', label: 'Power of factor 3', min: -3, max: 3, step: 0.5, default: 0 },
  ],
  presets: [
    { label: 'Pendulum T = 2π√(l/g)', values: { lhs: 'time', q1: 'length', e1: 0.5, q2: 'acceleration', e2: -0.5, q3: 'mass', e3: 0 } },
    { label: 'E = mc²', values: { lhs: 'energy', q1: 'mass', e1: 1, q2: 'velocity', e2: 2, q3: 'none', e3: 0 } },
    { label: 'F = mv²/r', values: { lhs: 'force', q1: 'mass', e1: 1, q2: 'velocity', e2: 2, q3: 'length', e3: -1 } },
    { label: 'v = √(T/μ)', values: { lhs: 'velocity', q1: 'force', e1: 0.5, q2: 'linearDensity', e2: -0.5, q3: 'none', e3: 0 } },
    { label: 'Wrong: v = F·t', values: { lhs: 'velocity', q1: 'force', e1: 1, q2: 'time', e2: 1, q3: 'none', e3: 0 } },
  ],
  learn: {
    concept: 'Every physical quantity can be written in terms of base dimensions — mass [M], length [L], time [T], current [I] and temperature [Θ]. A correct equation must have the same dimensions on both sides (principle of homogeneity). This lets you check formulas and even derive the form of an unknown relationship.',
    variables: [['[M]', 'mass'], ['[L]', 'length'], ['[T]', 'time'], ['[I]', 'electric current'], ['[Θ]', 'temperature']],
    observe: [
      'A formula is dimensionally correct only when every pair of bars matches.',
      'Numbers like 2π have no dimensions — dimensional analysis cannot find them.',
      'The unit conversion factor to CGS follows directly from the powers of M and L.',
    ],
    challenge: 'The speed of a wave on a string depends on tension F and linear density μ. Find the powers a and b in v ∝ Fᵃ μᵇ using the bars.',
  },

  create({ kit, params }) {
    let p: Params = params;
    const g = kit.add(new THREE.Group());
    kit.line('#64748b', [[-5.5, 0, 0], [5.5, 0, 0]], { width: 1.5 });

    function compute() {
      const lhs = Q[str(p, 'lhs')] ?? Q.time;
      let rhs: Dim = [0, 0, 0, 0, 0];
      const units: string[] = [];
      for (const i of [1, 2, 3]) {
        const q = Q[str(p, `q${i}`)] ?? Q.none;
        const e = num(p, `e${i}`);
        if (str(p, `q${i}`) === 'none' || e === 0) continue;
        rhs = dimMul(rhs, dimPow(q.dim, e));
        units.push(`(${q.unit})${sup(e)}`);
      }
      return { lhs, rhs, ok: dimEq(lhs.dim, rhs), units: units.join(' ') || '1' };
    }

    function build() {
      kit.clearGroup(g);
      const { lhs, rhs } = compute();
      BASE.forEach((b, i) => {
        const x = -4 + i * 2;
        const match = Math.abs(lhs.dim[i] - rhs[i]) < 1e-9;
        const col = match ? C.normal : C.friction;
        const bar = (v: number, dx: number, color: string) => {
          if (Math.abs(v) < 1e-9) { const flat = kit.box(0.5, 0.04, 0.5, color); flat.position.set(x + dx, 0, 0); g.add(flat); return; }
          const h = v * 0.8;
          const m = kit.box(0.5, Math.abs(h), 0.5, color, { emissive: 0.2 });
          m.position.set(x + dx, h / 2, 0);
          g.add(m);
        };
        bar(lhs.dim[i], -0.3, C.accent);
        bar(rhs[i], 0.3, col);
        g.add(kit.label(`[${b}]`, [x, -3.1, 0.4], { small: true }));
        g.add(kit.label(`${lhs.dim[i]} | ${+rhs[i].toFixed(2)}`, [x, 3.1, 0.4], { color: col, small: true }));
      });
      g.add(kit.label('LHS', [-6.6, 1.5, 0], { color: C.accent, small: true }));
      g.add(kit.label('RHS', [-6.6, 0.8, 0], { color: C.normal, small: true }));
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { build(); },
      step() {},
      readouts(): Readout[] {
        const { lhs, rhs, ok, units } = compute();
        const cgs = SI_TO_CGS.reduce((acc, f, i) => acc * f ** lhs.dim[i], 1);
        return [
          { label: 'LHS dimensions', value: dimString(lhs.dim) },
          { label: 'RHS dimensions', value: dimString(rhs) },
          { label: 'Dimensionally consistent?', value: ok ? 'Yes ✓' : 'No ✗', tone: ok ? 'good' : 'bad' },
          { label: 'LHS SI unit', value: lhs.unit || '—' },
          { label: 'RHS unit product', value: units },
          { label: `1 ${lhs.unit || 'unit'} in CGS units`, value: cgs },
        ];
      },
      equations(): Equation[] {
        const { lhs, rhs, ok } = compute();
        const f = (i: number) => (str(p, `q${i}`) === 'none' || num(p, `e${i}`) === 0 ? '' : `[${(Q[str(p, `q${i}`)] ?? Q.none).name.split(' ')[0]}]${sup(num(p, `e${i}`))}`);
        return [
          { expr: `[${lhs.name}] = ${[f(1), f(2), f(3)].filter(Boolean).join(' ') || '1'}`, sub: `${dimString(lhs.dim)} ${ok ? '=' : '≠'} ${dimString(rhs)}` },
          { expr: 'Principle of homogeneity: every term has the same dimensions' },
          { expr: 'n₂ = n₁ [M₁/M₂]ᵃ [L₁/L₂]ᵇ [T₁/T₂]ᶜ', note: 'Conversion between unit systems uses the dimensional powers a, b, c.' },
        ];
      },
    };
  },
};

export default sim;
