import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { seriesCap, parallelCap } from '../../physics/electricity';
import { C } from '../../engine/colors';
import { n } from '../shared';

const sub = (i: number) => '₁₂₃'[i];

const sim: SimDefinition = {
  camera: { position: [0, 0, 12], target: [0, 0, 0], aspect: 1.6 },
  timeless: true,
  hint: 'In series every capacitor has the same charge; in parallel every capacitor has the same voltage.',
  params: [
    { kind: 'select', key: 'mode', label: 'Connection', default: 'series', options: [{ value: 'series', label: 'Series' }, { value: 'parallel', label: 'Parallel' }] },
    { kind: 'slider', key: 'C1', label: 'C₁', unit: 'µF', min: 1, max: 20, step: 0.5, default: 2 },
    { kind: 'slider', key: 'C2', label: 'C₂', unit: 'µF', min: 1, max: 20, step: 0.5, default: 3 },
    { kind: 'slider', key: 'C3', label: 'C₃', unit: 'µF', min: 1, max: 20, step: 0.5, default: 6 },
    { kind: 'slider', key: 'V', label: 'Supply voltage', unit: 'V', min: 1, max: 100, step: 1, default: 12 },
  ],
  presets: [
    { label: 'Series 2, 3, 6 µF', values: { mode: 'series', C1: 2, C2: 3, C3: 6 } },
    { label: 'Parallel 2, 3, 6 µF', values: { mode: 'parallel', C1: 2, C2: 3, C3: 6 } },
    { label: 'Equal in series', values: { mode: 'series', C1: 6, C2: 6, C3: 6 } },
  ],
  graphs: [
    { id: 'E', title: 'Voltage across each capacitor', x: 'capacitor', y: 'V', kind: 'curve', xRange: [0.5, 3.5], zeroY: true, series: [{ label: 'V', color: C.accent }] },
  ],
  learn: {
    concept: 'Capacitors in series share the same charge and the voltages add: 1/C = 1/C₁ + 1/C₂ + 1/C₃, so the combination is smaller than the smallest. In parallel they share the same voltage and the charges add: C = C₁ + C₂ + C₃.',
    variables: [['C_eq', 'equivalent capacitance'], ['Q', 'charge (C)'], ['V', 'voltage (V)'], ['U', 'energy ½CV²']],
    observe: [
      'In series, the smallest capacitor gets the largest share of the voltage.',
      'In parallel, the largest capacitor stores the most charge.',
      'Total energy = ½ C_eq V² in both cases.',
    ],
    challenge: 'Combine three 6 µF capacitors to make 9 µF. (Hint: two in series, then one in parallel — try it on paper.)',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    const g = kit.add(new THREE.Group());
    const Cs = () => [num(p, 'C1'), num(p, 'C2'), num(p, 'C3')].map((c) => c * 1e-6);
    function solve() {
      const cs = Cs(), V = num(p, 'V');
      if (str(p, 'mode') === 'series') {
        const Ceq = seriesCap(cs), Q = Ceq * V;
        return { Ceq, parts: cs.map((c) => ({ C: c, Q, V: Q / c })) };
      }
      const Ceq = parallelCap(cs);
      return { Ceq, parts: cs.map((c) => ({ C: c, Q: c * V, V })) };
    }
    function capAt(x: number, y: number, vertical: boolean, C0: number, label: string, Q: number, Vc: number) {
      const size = 0.5 + Math.sqrt(C0 / 20e-6) * 0.9;
      const pl1 = kit.box(vertical ? size : 0.08, vertical ? 0.08 : size, 0.6, '#cbd5e1', { metalness: 0.5 });
      const pl2 = kit.box(vertical ? size : 0.08, vertical ? 0.08 : size, 0.6, '#cbd5e1', { metalness: 0.5 });
      if (vertical) { pl1.position.set(x, y + 0.12, 0); pl2.position.set(x, y - 0.12, 0); }
      else { pl1.position.set(x - 0.12, y, 0); pl2.position.set(x + 0.12, y, 0); }
      g.add(pl1, pl2);
      // labels: above/below for series (horizontal) capacitors, to the right for parallel (vertical) ones
      const top: [number, number, number] = vertical ? [x + 0.5, y + 0.3, 0.3] : [x, y + size / 2 + 0.5, 0.3];
      const bot: [number, number, number] = vertical ? [x + 0.5, y - 0.3, 0.3] : [x, y - size / 2 - 0.5, 0.3];
      g.add(kit.label(`${label} = ${n(C0 * 1e6)} µF`, top, { small: true }));
      g.add(kit.label(`${n(Vc)} V · ${n(Q * 1e6)} µC`, bot, { color: C.accent, small: true }));
    }

    function draw() {
      kit.clearGroup(g);
      const r = solve();
      const w = (pts: [number, number][]) => g.add(kit.line('#94a3b8', pts.map(([x, y]) => [x, y, 0] as [number, number, number]), { width: 3 }));
      const bat = kit.cylinder(0.25, 0.25, 0.9, '#1f2937');
      bat.position.set(-5, 0, 0); g.add(bat);
      g.add(kit.label(`${n(num(p, 'V'))} V`, [-5.9, 0, 0], { small: true }));
      if (str(p, 'mode') === 'series') {
        w([[-5, 0.45], [-5, 2], [5, 2], [5, -2], [-5, -2], [-5, -0.45]]);
        [-2.5, 0, 2.5].forEach((x, i) => { const pt = r.parts[i]; const cover = kit.box(0.4, 0.3, 0.1, '#0f172a'); cover.position.set(x, 2, 0); g.add(cover); capAt(x, 2, false, pt.C, `C${sub(i)}`, pt.Q, pt.V); });
      } else {
        w([[-5, 0.45], [-5, 2], [4, 2]]); w([[-5, -0.45], [-5, -2], [4, -2]]);
        [0, 2, 4].forEach((x, i) => { w([[x, 2], [x, 0.2]]); w([[x, -0.2], [x, -2]]); const pt = r.parts[i]; capAt(x, 0, true, pt.C, `C${sub(i)}`, pt.Q, pt.V); });
      }
      graphs.get('E').setSeries(0, [1, 2, 3], r.parts.map((pt) => pt.V));
      graphs.get('E').setMarkers(r.parts.map((pt, i) => ({ x: i + 1, y: pt.V, label: `C${sub(i)}`, color: C.accent })));
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        const r = solve();
        const out: Readout[] = [
          { label: 'Equivalent capacitance', value: r.Ceq * 1e6, unit: 'µF', tone: 'accent' },
          { label: 'Total charge from supply', value: r.Ceq * num(p, 'V') * 1e6, unit: 'µC' },
          { label: 'Total energy ½C_eqV²', value: 0.5 * r.Ceq * num(p, 'V') ** 2 * 1e6, unit: 'µJ' },
        ];
        r.parts.forEach((pt, i) => out.push({ label: `C${sub(i)}: V / Q`, value: `${n(pt.V)} V / ${n(pt.Q * 1e6)} µC` }));
        return out;
      },
      equations(): Equation[] {
        const r = solve();
        return str(p, 'mode') === 'series'
          ? [{ expr: '1/C = 1/C₁ + 1/C₂ + 1/C₃', sub: `C = ${n(r.Ceq * 1e6)} µF` }, { expr: 'Q₁ = Q₂ = Q₃ = Q ,  V = V₁ + V₂ + V₃' }]
          : [{ expr: 'C = C₁ + C₂ + C₃', sub: `C = ${n(r.Ceq * 1e6)} µF` }, { expr: 'V₁ = V₂ = V₃ = V ,  Q = Q₁ + Q₂ + Q₃' }];
      },
    };
  },
};

export default sim;
