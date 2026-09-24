import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { solveCircuit, type Element } from '../../physics/electricity';
import { C } from '../../engine/colors';
import { n } from '../shared';
import { battery, meter, resistor, wire } from '../circuitKit';

const WIRE_R = 2; // Ω per metre of bridge wire
const X0 = -5, X1 = 5; // scene ends of the 100 cm wire

const sim: SimDefinition = {
  camera: { position: [0, 1, 12], target: [0, 0.3, 0], aspect: 1.6 },
  hint: 'Slide the jockey along the wire until the galvanometer reads zero. Then X/R = l/(100 − l).',
  params: [
    { kind: 'slider', key: 'X', label: 'Unknown resistance X (left gap)', unit: 'Ω', min: 1, max: 50, step: 0.5, default: 6 },
    { kind: 'slider', key: 'R', label: 'Known resistance R (right gap)', unit: 'Ω', min: 1, max: 50, step: 0.5, default: 4 },
    { kind: 'slider', key: 'l', label: 'Jockey position l', unit: 'cm', min: 1, max: 99, step: 0.1, default: 40 },
    { kind: 'slider', key: 'E', label: 'Cell EMF', unit: 'V', min: 1, max: 6, step: 0.5, default: 2 },
  ],
  presets: [
    { label: 'Find X (start)', values: { X: 6, R: 4, l: 40 } },
    { label: 'Balanced', values: { X: 6, R: 4, l: 60 } },
    { label: 'Equal resistors', values: { X: 5, R: 5, l: 50 } },
  ],
  graphs: [
    { id: 'Ig', title: 'Galvanometer current vs jockey position', x: 'l (cm)', y: 'I_g (mA)', kind: 'curve', xRange: [0, 100], series: [{ label: 'I_g', color: C.acceleration }] },
  ],
  learn: {
    concept: 'The meter bridge is a Wheatstone bridge in which two arms are the two parts of a uniform 1 m wire. Since the wire is uniform, the resistances of its parts are proportional to their lengths. At the null point X/R = l/(100 − l), so X = R·l/(100 − l).',
    variables: [['X', 'unknown resistance (Ω)'], ['R', 'known resistance (Ω)'], ['l', 'balancing length from the X side (cm)'], ['I_g', 'galvanometer current']],
    observe: [
      'The null point moves toward the smaller resistance.',
      'With X = R the balance is exactly at the middle (50 cm).',
      'Balance is most precise near the middle of the wire — choose R close to X.',
    ],
    challenge: 'With R = 4 Ω, the null point is at 60 cm. Predict X, then find the balance point on the wire to check.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    kit.box(12, 5, 0.2, '#0b1220').position.set(0, 0.5, -0.25);
    kit.line('#fbbf24', [[X0, -1, 0], [X1, -1, 0]], { width: 3 });
    const scale = kit.segments('#94a3b8', { width: 1 });
    const flat: number[] = [];
    for (let cm = 0; cm <= 100; cm += 5) { const x = X0 + (cm / 100) * (X1 - X0); flat.push(x, -1.25, 0, x, cm % 10 === 0 ? -1.55 : -1.4, 0); }
    scale.setSegments(flat);
    [0, 50, 100].forEach((cm) => kit.label(`${cm} cm`, [X0 + (cm / 100) * (X1 - X0), -1.9, 0], { small: true }));
    wire(kit, [[X0, -1], [X0, 1.5], [-3.2, 1.5]]);
    wire(kit, [[-1.2, 1.5], [1.2, 1.5]]);
    wire(kit, [[3.2, 1.5], [X1, 1.5], [X1, -1]]);
    const rX = resistor(kit, [-2.2, 1.5], 'x');
    const rR = resistor(kit, [2.2, 1.5], 'x');
    wire(kit, [[X0, -1], [X0 - 0.8, -1], [X0 - 0.8, -2.8], [-0.6, -2.8]]);
    wire(kit, [[0.6, -2.8], [X1 + 0.8, -2.8], [X1 + 0.8, -1], [X1, -1]]);
    const cell = battery(kit, [0, -2.8], 'x');
    const g = meter(kit, [0, 0.4], 'G', [1.4, 0]);
    const galvWire = kit.line('#94a3b8', [], { width: 2.5 });
    const jockey = kit.cone('#e2e8f0', 0.15, 0.4);

    function solve(l = num(p, 'l')) {
      const L1 = (l / 100) * WIRE_R, L2 = ((100 - l) / 100) * WIRE_R;
      // nodes: 0 = right end of the wire (ground), 1 = left end, 2 = junction between X and R, 3 = jockey
      const els: Element[] = [
        { kind: 'V', id: 'E', neg: 0, pos: 1, V: num(p, 'E') },
        { kind: 'R', id: 'X', a: 1, b: 2, R: num(p, 'X') },
        { kind: 'R', id: 'Rk', a: 2, b: 0, R: num(p, 'R') },
        { kind: 'R', id: 'W1', a: 1, b: 3, R: Math.max(L1, 1e-4) },
        { kind: 'R', id: 'W2', a: 3, b: 0, R: Math.max(L2, 1e-4) },
        { kind: 'R', id: 'G', a: 2, b: 3, R: 30 },
      ];
      return solveCircuit(4, els);
    }
    const lBal = () => (100 * num(p, 'X')) / (num(p, 'X') + num(p, 'R'));
    function update() {
      const s = solve();
      rX.label.setText(`X = ${num(p, 'X')} Ω`); rR.label.setText(`R = ${num(p, 'R')} Ω`);
      cell.label.setText(`${n(num(p, 'E'))} V`);
      const Ig = s.current.G * 1000;
      g.setText(Math.abs(Ig) < 1e-4 ? 'null point!' : `I_g = ${n(Ig)} mA`);
      const x = X0 + (num(p, 'l') / 100) * (X1 - X0);
      jockey.position.set(x, -0.7, 0);
      jockey.rotation.z = Math.PI;
      galvWire.setPoints([[0, 0.05, 0], [x, -0.5, 0]]);
      const G = graphs.get('Ig');
      G.plot(0, 1, 99, (l) => solve(l).current.G * 1000, 200);
      G.setMarkers([{ x: num(p, 'l'), y: Ig, color: C.acceleration }]);
      G.setVLines([{ x: lBal(), label: 'null' }]);
    }
    wire(kit, [[0, 1.5], [0, 0.75]]);
    update();

    return {
      setParams(np) { p = np; update(); },
      reset() { update(); },
      step() {},
      readouts(): Readout[] {
        const s = solve();
        const l = num(p, 'l');
        return [
          { label: 'Galvanometer current', value: s.current.G * 1000, unit: 'mA', tone: 'accent' },
          { label: 'Balancing length (theory)', value: lBal(), unit: 'cm' },
          { label: 'X calculated from current l', value: (num(p, 'R') * l) / (100 - l), unit: 'Ω', tone: 'accent' },
          { label: 'Balanced?', value: Math.abs(l - lBal()) < 0.15 ? 'Yes' : 'No', tone: Math.abs(l - lBal()) < 0.15 ? 'good' : 'warn' },
        ];
      },
      equations(): Equation[] {
        const l = num(p, 'l');
        return [
          { expr: 'X / R = l / (100 − l)' },
          { expr: 'X = R l / (100 − l)', sub: `= ${n(num(p, 'R'))} × ${n(l)} / ${n(100 - l)} = ${n((num(p, 'R') * l) / (100 - l))} Ω` },
          { expr: 'Resistance of wire ∝ length (uniform wire)' },
        ];
      },
    };
  },
};

export default sim;
