import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { solveCircuit, type Element } from '../../physics/electricity';
import { C } from '../../engine/colors';
import { n } from '../shared';
import { CurrentPath, battery, dotSpeed, meter, resistor, wire } from '../circuitKit';

/* Diamond: A (left, node 1) — P — B (top, 2) — Q — C (right, 0); A — R — D (bottom, 3) — S — C. Galvanometer B–D. */
const RG = 50; // galvanometer resistance

const sim: SimDefinition = {
  camera: { position: [0, 0, 12.5], target: [0, 0, 0], aspect: 1.4 },
  hint: 'Adjust S until the galvanometer reads zero. Then P/Q = R/S and the unknown can be calculated.',
  params: [
    { kind: 'slider', key: 'P', label: 'P (ratio arm)', unit: 'Ω', min: 1, max: 100, step: 1, default: 10 },
    { kind: 'slider', key: 'Q', label: 'Q (ratio arm)', unit: 'Ω', min: 1, max: 100, step: 1, default: 10 },
    { kind: 'slider', key: 'R', label: 'R (unknown)', unit: 'Ω', min: 1, max: 100, step: 0.5, default: 35 },
    { kind: 'slider', key: 'S', label: 'S (standard, adjustable)', unit: 'Ω', min: 1, max: 100, step: 0.5, default: 20 },
    { kind: 'slider', key: 'E', label: 'Battery EMF', unit: 'V', min: 1, max: 12, step: 0.5, default: 6 },
  ],
  presets: [
    { label: 'Unbalanced', values: { P: 10, Q: 10, R: 35, S: 20 } },
    { label: 'Balanced', values: { P: 10, Q: 10, R: 35, S: 35 } },
    { label: 'Ratio 1 : 10', values: { P: 10, Q: 100, R: 4.5, S: 45 } },
  ],
  graphs: [
    { id: 'Ig', title: 'Galvanometer current vs S', x: 'S (Ω)', y: 'I_g (mA)', kind: 'curve', xRange: [1, 100], series: [{ label: 'I_g', color: C.acceleration }] },
  ],
  learn: {
    concept: 'A Wheatstone bridge compares resistances. When the bridge is balanced, B and D are at the same potential so no current flows through the galvanometer. Then P/Q = R/S, giving the unknown R = S·P/Q. Balance does not depend on the battery voltage or the galvanometer’s resistance.',
    variables: [['P, Q', 'ratio arms (Ω)'], ['R', 'unknown resistance (Ω)'], ['S', 'known adjustable resistance (Ω)'], ['I_g', 'galvanometer current (A)']],
    observe: [
      'The galvanometer current changes sign as S passes the balance point.',
      'At balance, changing the battery EMF does not disturb the zero.',
      'Using a 1 : 10 ratio lets you measure small resistances precisely.',
    ],
    challenge: 'With P = Q = 10 Ω, find the value of S that balances the bridge and deduce R.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const A: [number, number] = [-4, 0], B: [number, number] = [0, 2.8], Cn: [number, number] = [4, 0], D: [number, number] = [0, -2.8];
    kit.box(12, 8, 0.2, '#0b1220').position.z = -0.25;
    wire(kit, [A, B]); wire(kit, [B, Cn]); wire(kit, [A, D]); wire(kit, [D, Cn]);
    wire(kit, [B, [0, 0.5]]); wire(kit, [[0, -0.5], D]);
    wire(kit, [A, [-5.5, 0], [-5.5, -3.8]]); wire(kit, [[-5.5, -3.8], [-0.5, -3.8]]); wire(kit, [[0.5, -3.8], [5.5, -3.8], [5.5, 0], Cn]);
    const bat = battery(kit, [0, -3.8], 'x');
    const rP = resistor(kit, [-2, 1.4], 'x'); rP.group.rotation.z = -Math.PI / 2 + Math.atan2(2.8, 4);
    const rQ = resistor(kit, [2, 1.4], 'x'); rQ.group.rotation.z = -Math.PI / 2 - Math.atan2(2.8, 4);
    const rR = resistor(kit, [-2, -1.4], 'x'); rR.group.rotation.z = -Math.PI / 2 - Math.atan2(2.8, 4);
    const rS = resistor(kit, [2, -1.4], 'x'); rS.group.rotation.z = -Math.PI / 2 + Math.atan2(2.8, 4);
    const g = meter(kit, [0, 0], 'G', [1.6, 0]);
    ['A', 'B', 'C', 'D'].forEach((l, i) => kit.label(l, ([[-4.4, 0.3], [0, 3.3], [4.4, 0.3], [0, -3.3]] as [number, number][])[i].concat(0) as [number, number, number], { small: true, className: 'plain' }));
    const pathG = new CurrentPath(kit, [B, D], C.acceleration, 0.4);

    function solve(S = num(p, 'S')) {
      const els: Element[] = [
        { kind: 'V', id: 'E', neg: 0, pos: 1, V: num(p, 'E') },
        { kind: 'R', id: 'P', a: 1, b: 2, R: num(p, 'P') },
        { kind: 'R', id: 'Q', a: 2, b: 0, R: num(p, 'Q') },
        { kind: 'R', id: 'R', a: 1, b: 3, R: num(p, 'R') },
        { kind: 'R', id: 'S', a: 3, b: 0, R: S },
        { kind: 'R', id: 'G', a: 2, b: 3, R: RG },
      ];
      return solveCircuit(4, els);
    }
    function update() {
      const s = solve();
      rP.label.setText(`P = ${num(p, 'P')} Ω`); rQ.label.setText(`Q = ${num(p, 'Q')} Ω`);
      rR.label.setText(`R = ${num(p, 'R')} Ω`); rS.label.setText(`S = ${num(p, 'S')} Ω`);
      bat.label.setText(`${n(num(p, 'E'))} V`);
      const Ig = s.current.G * 1000;
      g.setText(Math.abs(Ig) < 1e-6 ? 'I_g = 0 (balanced)' : `I_g = ${n(Ig)} mA`);
      const G = graphs.get('Ig');
      G.plot(0, 1, 100, (S) => solve(S).current.G * 1000, 200);
      G.setMarkers([{ x: num(p, 'S'), y: Ig, color: C.acceleration }]);
      G.setVLines([{ x: (num(p, 'R') * num(p, 'Q')) / num(p, 'P'), label: 'balance' }]);
    }
    update();

    return {
      setParams(np) { p = np; update(); },
      reset() { t = 0; },
      step(dt) { t += dt; pathG.advance(dotSpeed(solve().current.G * 40) * dt); },
      time: () => t,
      readouts(): Readout[] {
        const s = solve();
        const Sbal = (num(p, 'R') * num(p, 'Q')) / num(p, 'P');
        return [
          { label: 'Galvanometer current', value: s.current.G * 1000, unit: 'mA', tone: 'accent' },
          { label: 'Potential at B', value: s.V[2], unit: 'V' },
          { label: 'Potential at D', value: s.V[3], unit: 'V' },
          { label: 'Balanced?', value: Math.abs(s.current.G) < 1e-7 ? 'Yes' : 'No', tone: Math.abs(s.current.G) < 1e-7 ? 'good' : 'warn' },
          { label: 'S needed for balance', value: Sbal, unit: 'Ω' },
          { label: 'R calculated from S·P/Q', value: (num(p, 'S') * num(p, 'P')) / num(p, 'Q'), unit: 'Ω' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'Balance: P / Q = R / S', sub: `${n(num(p, 'P') / num(p, 'Q'))} vs ${n(num(p, 'R') / num(p, 'S'))}` },
          { expr: 'R = S × P / Q', sub: `= ${n(num(p, 'S'))} × ${n(num(p, 'P'))} / ${n(num(p, 'Q'))} = ${n((num(p, 'S') * num(p, 'P')) / num(p, 'Q'))} Ω (true only at balance)` },
        ];
      },
    };
  },
};

export default sim;
