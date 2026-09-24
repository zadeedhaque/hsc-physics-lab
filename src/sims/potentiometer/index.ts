import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { C } from '../../engine/colors';
import { n } from '../shared';
import { battery, meter, wire } from '../circuitKit';

const X0 = -5, X1 = 5; // 100 cm wire (scene)
const WIRE_R = 4; // Ω for the whole metre

const sim: SimDefinition = {
  camera: { position: [0, 0.5, 12], target: [0, 0, 0], aspect: 1.6 },
  hint: 'The driver cell sets a steady potential gradient along the wire. At the null point the test cell’s EMF equals the p.d. across the length l.',
  params: [
    { kind: 'slider', key: 'D', label: 'Driver cell EMF', unit: 'V', min: 2, max: 6, step: 0.1, default: 4 },
    { kind: 'slider', key: 'Rh', label: 'Rheostat in driver circuit', unit: 'Ω', min: 0, max: 20, step: 0.5, default: 2 },
    { kind: 'select', key: 'cell', label: 'Cell being tested', default: 'E1', options: [{ value: 'E1', label: 'Cell 1' }, { value: 'E2', label: 'Cell 2' }] },
    { kind: 'slider', key: 'E1', label: 'EMF of cell 1', unit: 'V', min: 0.5, max: 2.5, step: 0.01, default: 1.5 },
    { kind: 'slider', key: 'E2', label: 'EMF of cell 2', unit: 'V', min: 0.5, max: 2.5, step: 0.01, default: 1.08 },
    { kind: 'slider', key: 'l', label: 'Jockey position l', unit: 'cm', min: 1, max: 100, step: 0.1, default: 40 },
  ],
  presets: [
    { label: 'Test cell 1', values: { cell: 'E1', l: 40 } },
    { label: 'Test cell 2', values: { cell: 'E2', l: 40 } },
    { label: 'Too weak driver', values: { D: 2, Rh: 10, cell: 'E1' } },
  ],
  graphs: [
    { id: 'V', title: 'Potential difference along the wire', x: 'l (cm)', y: 'V (V)', kind: 'curve', xRange: [0, 100], zeroY: true, series: [{ label: 'V(l) = kl', color: C.accent }, { label: 'EMF under test', color: C.acceleration, dashed: true }] },
  ],
  learn: {
    concept: 'A potentiometer compares EMFs without drawing current from the cell under test. A driver cell sends a steady current through a long uniform wire, so the potential falls uniformly: V = kl. At the null point no current flows through the galvanometer, so E = kl. For two cells E₁/E₂ = l₁/l₂.',
    variables: [['k', 'potential gradient (V/m)'], ['l', 'balancing length (m)'], ['E₁, E₂', 'EMFs being compared (V)']],
    observe: [
      'At balance the galvanometer shows zero — the test cell supplies no current, so its internal resistance does not matter.',
      'A larger rheostat resistance lowers k and moves the null point further along.',
      'If the driver p.d. across the whole wire is less than E, no null point exists.',
    ],
    challenge: 'Find the balancing lengths l₁ and l₂ for both cells, then check that E₁/E₂ = l₁/l₂.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    kit.box(12, 6, 0.2, '#0b1220').position.set(0, 0, -0.25);
    kit.line('#fbbf24', [[X0, 0, 0], [X1, 0, 0]], { width: 3 });
    const scale = kit.segments('#94a3b8', { width: 1 });
    const flat: number[] = [];
    for (let cm = 0; cm <= 100; cm += 5) { const x = X0 + (cm / 100) * (X1 - X0); flat.push(x, -0.25, 0, x, cm % 10 === 0 ? -0.55 : -0.4, 0); }
    scale.setSegments(flat);
    [0, 50, 100].forEach((cm) => kit.label(`${cm}`, [X0 + (cm / 100) * (X1 - X0), -0.85, 0], { small: true }));
    wire(kit, [[X0, 0], [X0, 2.2], [-0.6, 2.2]]);
    wire(kit, [[0.6, 2.2], [X1, 2.2], [X1, 0]]);
    const driver = battery(kit, [0, 2.2], 'x');
    wire(kit, [[X0, 0], [X0, -2.2], [-2.6, -2.2]]);
    const test = battery(kit, [-2, -2.2], 'x');
    wire(kit, [[-1.4, -2.2], [0.6, -2.2]]);
    const g = meter(kit, [1, -2.2], 'G', [0, -0.75]);
    const lead = kit.line('#94a3b8', [], { width: 2.5 });
    const jockey = kit.cone('#e2e8f0', 0.15, 0.4);

    const k = () => (num(p, 'D') * (WIRE_R / (WIRE_R + num(p, 'Rh')))) / 100; // V per cm
    const E = () => num(p, str(p, 'cell') === 'E2' ? 'E2' : 'E1');
    const lBal = () => E() / k();
    function update() {
      const x = X0 + (num(p, 'l') / 100) * (X1 - X0);
      jockey.position.set(x, 0.3, 0); jockey.rotation.z = Math.PI;
      lead.setPoints([[1.4, -2.2, 0], [x, -1.2, 0], [x, 0.1, 0]]);
      driver.label.setText(`driver ${n(num(p, 'D'))} V`);
      test.label.setText(`${str(p, 'cell') === 'E2' ? 'E₂' : 'E₁'} = ${n(E())} V`);
      const Vl = k() * num(p, 'l');
      const Ig = (E() - Vl) / 100; // through a 100 Ω protective resistance (mA scale)
      g.setText(Math.abs(Vl - E()) < 0.003 ? 'null point!' : `I_g ∝ ${n(Ig * 1000)} mA`);
      const G = graphs.get('V');
      G.plot(0, 0, 100, (l) => k() * l, 2);
      G.plot(1, 0, 100, () => E(), 2);
      G.setMarkers([{ x: num(p, 'l'), y: Vl, color: C.accent }]);
      G.setVLines(lBal() <= 100 ? [{ x: lBal(), label: 'null' }] : []);
    }
    update();

    return {
      setParams(np) { p = np; update(); },
      reset() { update(); },
      step() {},
      readouts(): Readout[] {
        const l1 = num(p, 'E1') / k(), l2 = num(p, 'E2') / k();
        return [
          { label: 'Potential gradient k', value: k() * 100, unit: 'V/m' },
          { label: 'P.d. across the whole wire', value: k() * 100, unit: 'V' },
          { label: 'P.d. across length l', value: k() * num(p, 'l'), unit: 'V' },
          { label: 'Balancing length for this cell', value: lBal() <= 100 ? lBal() : 'beyond the wire — no null point', unit: lBal() <= 100 ? 'cm' : undefined, tone: 'accent' },
          { label: 'l₁ / l₂', value: l1 / l2 },
          { label: 'E₁ / E₂', value: num(p, 'E1') / num(p, 'E2') },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'V = k l ,  k = V_wire / L', sub: `k = ${n(k() * 100)} V/m` },
          { expr: 'At balance: E = k l', sub: lBal() <= 100 ? `l = ${n(E())} / ${n(k())} = ${n(lBal())} cm` : 'no balance on this wire' },
          { expr: 'E₁ / E₂ = l₁ / l₂' },
        ];
      },
    };
  },
};

export default sim;
