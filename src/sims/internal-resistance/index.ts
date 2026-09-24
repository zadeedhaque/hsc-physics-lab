import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { internalResistance } from '../../physics/electricity';
import { C } from '../../engine/colors';
import { n } from '../shared';
import { CurrentPath, battery, dotSpeed, glow, meter, resistor, wire } from '../circuitKit';

const sim: SimDefinition = {
  camera: { position: [0, -1, 12.5], target: [0, 0, 0], aspect: 1.5 },
  hint: 'The shaded box is inside the battery: its internal resistance “wastes” Ir volts, so the terminal voltage falls as current rises.',
  params: [
    { kind: 'slider', key: 'E', label: 'EMF E', unit: 'V', min: 1, max: 24, step: 0.5, default: 12 },
    { kind: 'slider', key: 'r', label: 'Internal resistance r', unit: 'Ω', min: 0, max: 10, step: 0.1, default: 2 },
    { kind: 'slider', key: 'R', label: 'Load resistance R', unit: 'Ω', min: 0.2, max: 50, step: 0.1, default: 10 },
  ],
  presets: [
    { label: 'New battery', values: { r: 0.2 } },
    { label: 'Old battery', values: { r: 5 } },
    { label: 'Max power (R = r)', values: { r: 2, R: 2 } },
    { label: 'Short circuit', values: { R: 0.2 } },
  ],
  graphs: [
    { id: 'VI', title: 'Terminal voltage vs current (slope = −r)', x: 'I (A)', y: 'V (V)', kind: 'curve', zeroY: true, series: [{ label: 'V = E − Ir', color: C.accent }] },
    { id: 'P', title: 'Power delivered to the load vs R', x: 'R (Ω)', y: 'P (W)', kind: 'curve', xRange: [0, 50], zeroY: true, series: [{ label: 'P = E²R/(R + r)²', color: C.hot }] },
  ],
  learn: {
    concept: 'A real cell has an internal resistance r. When it drives current I, a voltage Ir is lost inside it, so the terminal voltage is V = E − Ir. On open circuit V = E. The load receives maximum power when R = r.',
    variables: [['E', 'EMF (V)'], ['r', 'internal resistance (Ω)'], ['R', 'external load (Ω)'], ['I', 'current E/(R + r)'], ['V', 'terminal voltage (V)']],
    observe: [
      'Lowering R increases I and decreases the terminal voltage.',
      'The V–I line has intercept E and slope −r.',
      'The power curve peaks exactly where R = r.',
    ],
    challenge: 'A 1.5 V cell gives 1.2 V across a 4 Ω lamp. Find its internal resistance, then set it up to check.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const board = kit.box(12.4, 7.4, 0.2, '#0b1220');
    board.position.z = -0.25;
    const cellBox = kit.box(2.2, 3.2, 0.4, '#334155', { opacity: 0.5 });
    cellBox.position.set(-4.5, 0, -0.1);
    kit.label('real cell', [-4.5, 1.9, 0.3], { small: true });
    wire(kit, [[-5, 0.7], [-5, 2.5], [5, 2.5], [5, -2.5], [-5, -2.5], [-5, -1.6]]);
    wire(kit, [[-5, -0.6], [-5, -0.7]]);
    const b = battery(kit, [-5, 0], 'y');
    const rin = resistor(kit, [-4, -1.1], 'y');
    wire(kit, [[-5, -1.6], [-4, -1.6]]);
    wire(kit, [[-4, -0.6], [-5, -0.6]]);
    const load = resistor(kit, [5, 0], 'y');
    const path = new CurrentPath(kit, [[-5, -2.5], [-5, 2.5], [5, 2.5], [5, -2.5], [-5, -2.5]]);
    const vm = meter(kit, [-2, 0], 'V', [1.3, 0]);
    const am = meter(kit, [0, 2.5], 'A', [0, 0.75]);

    const s = () => internalResistance(num(p, 'E'), num(p, 'r'), num(p, 'R'));
    function update() {
      const r = s();
      glow(load.mat, r.Pload, Math.max(r.Pload, r.Pinternal, 1));
      glow(rin.mat, r.Pinternal, Math.max(r.Pload, r.Pinternal, 1));
      load.label.setText(`R = ${n(num(p, 'R'))} Ω · ${n(r.Pload)} W`);
      rin.label.setText(`r = ${n(num(p, 'r'))} Ω`);
      b.label.setText(`E = ${n(num(p, 'E'))} V`);
      vm.setText(`V = ${n(r.terminal)} V`);
      am.setText(`I = ${n(r.I)} A`);
      const E = num(p, 'E'), ri = num(p, 'r');
      const Imax = ri > 0 ? E / ri : E / 0.2;
      graphs.get('VI').plot(0, 0, Math.min(Imax, 60), (I) => E - I * ri, 2);
      graphs.get('VI').setMarkers([{ x: r.I, y: r.terminal, color: C.accent }]);
      graphs.get('P').plot(0, 0, 50, (R) => internalResistance(E, ri, R).Pload, 200);
      graphs.get('P').setMarkers([{ x: num(p, 'R'), y: r.Pload, color: C.hot }]);
      graphs.get('P').setVLines(ri > 0 ? [{ x: ri, label: 'R = r' }] : []);
    }
    update();

    return {
      setParams(np) { p = np; update(); },
      reset() { t = 0; },
      step(dt) { t += dt; path.advance(dotSpeed(s().I) * dt); },
      time: () => t,
      readouts(): Readout[] {
        const r = s();
        return [
          { label: 'Current I', value: r.I, unit: 'A', tone: 'accent' },
          { label: 'Terminal voltage V', value: r.terminal, unit: 'V', tone: 'accent' },
          { label: 'Lost volts Ir', value: r.lost, unit: 'V' },
          { label: 'Power to load', value: r.Pload, unit: 'W' },
          { label: 'Power wasted inside', value: r.Pinternal, unit: 'W' },
          { label: 'Efficiency R/(R + r)', value: r.efficiency * 100, unit: '%' },
          { label: 'Short-circuit current E/r', value: num(p, 'r') > 0 ? num(p, 'E') / num(p, 'r') : 'very large (r = 0)', unit: num(p, 'r') > 0 ? 'A' : undefined },
        ];
      },
      equations(): Equation[] {
        const r = s();
        return [
          { expr: 'I = E / (R + r)', sub: `= ${n(num(p, 'E'))} / (${n(num(p, 'R'))} + ${n(num(p, 'r'))}) = ${n(r.I)} A` },
          { expr: 'V = E − I r = I R', sub: `= ${n(num(p, 'E'))} − ${n(r.I)} × ${n(num(p, 'r'))} = ${n(r.terminal)} V` },
          { expr: 'P_max when R = r:  P = E² / 4r' },
        ];
      },
    };
  },
};

export default sim;
