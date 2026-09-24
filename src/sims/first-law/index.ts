import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num, str } from '../types';
import { R, atm } from '../../physics/constants';
import { ParticleBox } from '../particles';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const RAD = 1.2, AREA = 0.02; // m² piston area (for volume ↔ height)
const DURATION = 4;

const sim: SimDefinition = {
  camera: { position: [0, 3.2, 9], target: [0, 2.2, 0], aspect: 1.3 },
  startPaused: true,
  hint: 'Press Play to supply the heat. With a free piston some of Q becomes work; with the piston locked all of it raises U.',
  params: [
    { kind: 'slider', key: 'Q', label: 'Heat supplied Q', unit: 'J', min: -2000, max: 5000, step: 50, default: 2000 },
    { kind: 'toggle', key: 'lock', label: 'Lock the piston (constant volume)', default: false },
    { kind: 'slider', key: 'P', label: 'Pressure on the piston', unit: 'atm', min: 0.5, max: 3, step: 0.05, default: 1, showIf: (p) => p.lock !== true },
    { kind: 'slider', key: 'nmol', label: 'Amount of gas', unit: 'mol', min: 0.2, max: 2, step: 0.05, default: 1 },
    { kind: 'slider', key: 'T1', label: 'Initial temperature', unit: 'K', min: 150, max: 600, step: 5, default: 300 },
    { kind: 'select', key: 'gas', label: 'Gas', default: 'mono', options: [{ value: 'mono', label: 'Monatomic' }, { value: 'di', label: 'Diatomic' }] },
  ],
  presets: [
    { label: 'Heat at constant P', values: { lock: false, Q: 2000 } },
    { label: 'Heat at constant V', values: { lock: true, Q: 2000 } },
    { label: 'Cooling', values: { lock: false, Q: -1500 } },
  ],
  graphs: [
    { id: 'E', title: 'Energy account during heating', x: 't (s)', y: 'J', zeroY: true, series: [{ label: 'Q supplied', color: C.hot }, { label: 'ΔU', color: C.acceleration }, { label: 'W by gas', color: C.force }] },
  ],
  learn: {
    concept: 'The first law of thermodynamics is conservation of energy for heat engines: heat Q supplied to a gas raises its internal energy by ΔU and lets it do work W on its surroundings, Q = ΔU + W. At constant volume W = 0; at constant pressure W = PΔV.',
    variables: [['Q', 'heat supplied (J), negative if removed'], ['ΔU', 'change in internal energy nC_vΔT (J)'], ['W', 'work done by the gas PΔV (J)'], ['C_v, C_p', 'molar heat capacities']],
    observe: [
      'Locked piston: all the heat goes into internal energy, the temperature rises most.',
      'Free piston: the gas pushes the piston up, so it warms less for the same Q.',
      'C_p > C_v because heating at constant pressure also does work.',
    ],
    challenge: '1 mol of a monatomic gas gets 2000 J at constant pressure. What fraction of the heat becomes work? (Answer: R/C_p = 2/5.)',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let s = 0;
    const sample = sampler(0.05);
    const cyl = kit.cylinder(RAD, RAD, 6.4, '#e2e8f0', { opacity: 0.12 }, 48);
    cyl.position.y = 3.2;
    const piston = kit.cylinder(RAD * 0.98, RAD * 0.98, 0.2, '#94a3b8', { metalness: 0.5 });
    const weight = kit.box(1.2, 0.5, 1.2, '#64748b', { metalness: 0.5 });
    const pin = kit.box(3, 0.1, 0.1, C.friction);
    const flame = kit.cone(C.hot, 0.4, 0.7);
    flame.position.y = -0.5;
    const box = new ParticleBox(kit, 100, 0.06);
    box.seed(4); box.fill(100, 1.5);
    const qArrow = kit.arrow(C.hot, { label: 'Q', radius: 0.06 });
    const wArrow = kit.arrow(C.force, { label: 'W', radius: 0.06 });

    const Cv = () => (str(p, 'gas') === 'mono' ? 1.5 : 2.5) * R;
    const Cp = () => Cv() + R;
    function final() {
      const nmol = num(p, 'nmol'), Q = num(p, 'Q'), T1 = num(p, 'T1');
      if (bool(p, 'lock')) {
        const V = (nmol * R * T1) / (atm * 1);
        const dT = Q / (nmol * Cv());
        return { T2: Math.max(10, T1 + dT), V1: V, V2: V, W: 0, dU: nmol * Cv() * dT, P1: atm, P2: (nmol * R * Math.max(10, T1 + dT)) / V };
      }
      const P = num(p, 'P') * atm;
      const dT = Q / (nmol * Cp());
      const T2 = Math.max(10, T1 + dT);
      const V1 = (nmol * R * T1) / P, V2 = (nmol * R * T2) / P;
      return { T2, V1, V2, W: P * (V2 - V1), dU: nmol * Cv() * (T2 - T1), P1: P, P2: P };
    }
    const hOf = (V: number) => Math.min(6, (V / AREA) * 0.8);

    return {
      setParams(np) { p = np; s = 0; graphs.clearLive(); },
      reset() { s = 0; sample.reset(); },
      step(dt) {
        s = Math.min(1, s + dt / DURATION);
        if (sample.due(s * DURATION)) { const f = final(); graphs.get('E').push(s * DURATION, num(p, 'Q') * s, f.dU * s, f.W * s); }
      },
      render() {
        const f = final();
        const V = f.V1 + (f.V2 - f.V1) * s;
        const T = num(p, 'T1') + (f.T2 - num(p, 'T1')) * s;
        const h = hOf(V);
        piston.position.y = h + 0.1;
        weight.position.y = h + 0.45;
        weight.visible = !bool(p, 'lock');
        pin.visible = bool(p, 'lock');
        pin.position.y = h + 0.3;
        box.setHalf(RAD * 0.8, Math.max(0.1, h / 2 - 0.08), RAD * 0.55);
        const target = Math.sqrt(T / 300) * 1.5;
        const cur = Math.sqrt(box.meanSquareSpeed() / 3) || 1;
        box.scaleSpeeds(1 + (target / cur - 1) * 0.2);
        box.step(1 / 60);
        box.mesh.position.y = h / 2;
        box.render(1, 1.5);
        flame.visible = num(p, 'Q') > 0 && s > 0 && s < 1;
        qArrow.visible = s > 0 && s < 1;
        qArrow.set([0, -0.2, 0.9], [0, num(p, 'Q') > 0 ? 0.9 : -0.9, 0], num(p, 'Q') > 0 ? 'Q in' : 'Q out');
        wArrow.visible = Math.abs(f.W) > 1 && s > 0 && s < 1;
        wArrow.set([0, h + 0.9, 0], [0, f.W > 0 ? 0.8 : -0.8, 0], 'W');
      },
      done: () => s >= 1,
      time: () => s * DURATION,
      readouts(): Readout[] {
        const f = final();
        return [
          { label: 'Heat supplied Q', value: num(p, 'Q'), unit: 'J' },
          { label: 'Change in internal energy ΔU', value: f.dU, unit: 'J', tone: 'accent' },
          { label: 'Work done by the gas W', value: f.W, unit: 'J', tone: 'accent' },
          { label: 'ΔU + W', value: f.dU + f.W, unit: 'J' },
          { label: 'Temperature T₁ → T₂', value: `${n(num(p, 'T1'))} → ${n(f.T2)} K` },
          { label: 'Volume V₁ → V₂', value: `${n(f.V1 * 1000)} → ${n(f.V2 * 1000)} L` },
          { label: 'Fraction of Q turned into work', value: num(p, 'Q') !== 0 ? f.W / num(p, 'Q') : 0 },
        ];
      },
      equations(): Equation[] {
        const f = final();
        return [
          { expr: 'Q = ΔU + W', sub: `${n(num(p, 'Q'))} = ${n(f.dU)} + ${n(f.W)} J` },
          { expr: bool(p, 'lock') ? 'Constant V: W = 0, Q = nC_vΔT' : 'Constant P: W = PΔV, Q = nC_pΔT', sub: `C_v = ${n(Cv())}, C_p = ${n(Cp())} J/(mol·K)` },
          { expr: 'C_p − C_v = R' },
        ];
      },
    };
  },
};

export default sim;
