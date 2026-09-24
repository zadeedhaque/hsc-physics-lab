import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { processResult, processCurve, type Process } from '../../physics/thermo';
import { R } from '../../physics/constants';
import { ParticleBox } from '../particles';
import { C } from '../../engine/colors';
import { n } from '../shared';

const RAD = 1.2, HMAX = 5;
const DURATION = 5; // s of display for the whole process

const sim: SimDefinition = {
  camera: { position: [0, 3.2, 9], target: [0, 2.4, 0], aspect: 1.3 },
  startPaused: true,
  hint: 'Press Play to run the process. The dot moves along the P–V curve; the area under it is the work done by the gas.',
  params: [
    { kind: 'select', key: 'proc', label: 'Process', default: 'isothermal', options: [{ value: 'isothermal', label: 'Isothermal' }, { value: 'isobaric', label: 'Isobaric' }, { value: 'isochoric', label: 'Isochoric' }, { value: 'adiabatic', label: 'Adiabatic' }] },
    { kind: 'select', key: 'gas', label: 'Gas', default: 'di', options: [{ value: 'mono', label: 'Monatomic (γ = 5/3)' }, { value: 'di', label: 'Diatomic (γ = 7/5)' }] },
    { kind: 'slider', key: 'nmol', label: 'Amount', unit: 'mol', min: 0.1, max: 2, step: 0.05, default: 1 },
    { kind: 'slider', key: 'V1', label: 'Initial volume V₁', unit: 'L', min: 5, max: 40, step: 0.5, default: 10 },
    { kind: 'slider', key: 'T1', label: 'Initial temperature T₁', unit: 'K', min: 150, max: 800, step: 5, default: 300 },
    { kind: 'slider', key: 'V2', label: 'Final volume V₂', unit: 'L', min: 5, max: 40, step: 0.5, default: 25, showIf: (p) => p.proc !== 'isochoric' },
    { kind: 'slider', key: 'T2', label: 'Final temperature T₂', unit: 'K', min: 150, max: 800, step: 5, default: 600, showIf: (p) => p.proc === 'isochoric' },
  ],
  presets: [
    { label: 'Isothermal expansion', values: { proc: 'isothermal', V1: 10, V2: 25 } },
    { label: 'Adiabatic expansion', values: { proc: 'adiabatic', V1: 10, V2: 25 } },
    { label: 'Adiabatic compression', values: { proc: 'adiabatic', V1: 30, V2: 10 } },
    { label: 'Heating at constant P', values: { proc: 'isobaric', V1: 10, V2: 20 } },
    { label: 'Heating at constant V', values: { proc: 'isochoric', T1: 300, T2: 600 } },
  ],
  graphs: [
    { id: 'PV', title: 'P–V diagram', x: 'V (L)', y: 'P (kPa)', kind: 'curve', zeroY: true, series: [{ label: 'process', color: C.accent }, { label: 'isotherms (T₁, T₂)', color: '#64748b', dashed: true }] },
  ],
  learn: {
    concept: 'A gas can change state in different ways. Isothermal: T constant, PV = const, all heat becomes work. Isobaric: P constant, W = PΔV. Isochoric: V constant, W = 0, all heat raises U. Adiabatic: no heat exchange, PV^γ = const, work comes from internal energy. In every case the first law holds: Q = ΔU + W.',
    variables: [['Q', 'heat supplied to the gas (J)'], ['W', 'work done by the gas (J)'], ['ΔU', 'change of internal energy nC_vΔT (J)'], ['γ', 'C_p / C_v']],
    observe: [
      'An adiabatic curve is steeper than an isotherm through the same point.',
      'In adiabatic expansion the gas cools; in compression it heats up.',
      'In the isochoric process the P–V “curve” is vertical: no work is done.',
    ],
    challenge: 'For 1 mol expanding from 10 L to 25 L starting at 300 K, which process does the most work: isothermal, isobaric or adiabatic?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let s = 0; // progress 0 → 1
    const cyl = kit.cylinder(RAD, RAD, HMAX + 0.4, '#e2e8f0', { opacity: 0.12 }, 48);
    cyl.position.y = (HMAX + 0.4) / 2;
    const piston = kit.cylinder(RAD * 0.98, RAD * 0.98, 0.2, '#94a3b8', { metalness: 0.5 });
    const box = new ParticleBox(kit, 90, 0.06);
    box.seed(9); box.fill(90, 1.5);
    const heatArrow = kit.arrow(C.hot, { label: 'Q', radius: 0.06 });
    const workArrow = kit.arrow(C.force, { label: 'W', radius: 0.06 });
    const stateLabel = kit.label('', [RAD + 1.5, 3.4, 0], { color: C.accent });

    const gamma = () => (str(p, 'gas') === 'mono' ? 5 / 3 : 7 / 5);
    const proc = () => str(p, 'proc') as Process;
    const target = () => (proc() === 'isochoric' ? num(p, 'T2') : num(p, 'V2') / 1000);
    const res = () => processResult(proc(), num(p, 'nmol'), num(p, 'V1') / 1000, num(p, 'T1'), target(), gamma());
    const curve = () => processCurve(proc(), num(p, 'nmol'), num(p, 'V1') / 1000, num(p, 'T1'), target(), gamma(), 80);
    function stateAt(frac: number) {
      const c = curve();
      const i = Math.min(c.length - 1, Math.floor(frac * (c.length - 1)));
      const [V, P] = c[i];
      return { V, P, T: (P * V) / (num(p, 'nmol') * R) };
    }

    function build() {
      const G = graphs.get('PV');
      const c = curve();
      G.setSeries(0, c.map(([V]) => V * 1000), c.map(([, P]) => P / 1000));
      const r = res();
      const xs: number[] = [], ys: number[] = [];
      for (const T of [r.T1, r.T2]) {
        for (let V = 4; V <= 42; V += 0.5) { xs.push(V); ys.push((num(p, 'nmol') * R * T) / (V / 1000) / 1000); }
        xs.push(42); ys.push(NaN);
      }
      G.setSeries(1, xs, ys);
    }
    build();

    return {
      setParams(np) { p = np; s = 0; build(); },
      reset() { s = 0; },
      step(dt) { s = Math.min(1, s + dt / DURATION); },
      render() {
        const st = stateAt(s);
        const h = Math.min(HMAX, (st.V * 1000 / 42) * HMAX);
        piston.position.y = h + 0.1;
        box.setHalf(RAD * 0.8, h / 2 - 0.08, RAD * 0.55);
        const target = Math.sqrt(st.T / 300) * 1.5;
        const cur = Math.sqrt(box.meanSquareSpeed() / 3) || 1;
        box.scaleSpeeds(1 + (target / cur - 1) * 0.2);
        box.step(1 / 60);
        box.mesh.position.y = h / 2;
        box.render(1, 1.5);
        graphs.get('PV').setMarkers([{ x: st.V * 1000, y: st.P / 1000, label: `${n(st.T)} K`, color: C.weight }]);
        const r = res();
        heatArrow.visible = Math.abs(r.Q) > 1 && s < 1 && s > 0;
        heatArrow.set([0, -1.2, 0], [0, r.Q > 0 ? 0.9 : -0.9, 0], r.Q > 0 ? 'heat in' : 'heat out');
        workArrow.visible = Math.abs(r.W) > 1 && s < 1 && s > 0;
        workArrow.set([0, h + 0.4, 0], [0, r.W > 0 ? 0.9 : -0.9, 0], r.W > 0 ? 'gas does work' : 'work done on gas');
        stateLabel.setText(`P = ${n(st.P / 1000)} kPa · V = ${n(st.V * 1000)} L · T = ${n(st.T)} K`);
      },
      done: () => s >= 1,
      time: () => s * DURATION,
      readouts(): Readout[] {
        const r = res();
        return [
          { label: 'Heat supplied Q', value: r.Q, unit: 'J', tone: 'accent' },
          { label: 'Work done by gas W', value: r.W, unit: 'J', tone: 'accent' },
          { label: 'Change in internal energy ΔU', value: r.dU, unit: 'J', tone: 'accent' },
          { label: 'Q − (ΔU + W)', value: r.Q - (r.dU + r.W), unit: 'J' },
          { label: 'P₁ → P₂', value: `${n(r.P1 / 1000)} → ${n(r.P2 / 1000)} kPa` },
          { label: 'T₁ → T₂', value: `${n(r.T1)} → ${n(r.T2)} K` },
          { label: 'V₁ → V₂', value: `${n(r.V1 * 1000)} → ${n(r.V2 * 1000)} L` },
          { label: 'γ', value: gamma() },
        ];
      },
      equations(): Equation[] {
        const r = res();
        const map: Record<Process, Equation> = {
          isothermal: { expr: 'W = nRT ln(V₂/V₁),  ΔU = 0,  Q = W', sub: `W = ${n(r.W)} J` },
          isobaric: { expr: 'W = P(V₂ − V₁),  Q = nC_pΔT', sub: `W = ${n(r.W)} J` },
          isochoric: { expr: 'W = 0,  Q = ΔU = nC_vΔT', sub: `Q = ${n(r.Q)} J` },
          adiabatic: { expr: 'PV^γ = const,  Q = 0,  W = (P₁V₁ − P₂V₂)/(γ − 1)', sub: `W = ${n(r.W)} J` },
        };
        return [map[proc()], { expr: 'Q = ΔU + W  (first law)', sub: `${n(r.Q)} = ${n(r.dU)} + ${n(r.W)}` }, { expr: 'ΔU = n C_v ΔT', sub: `C_v = ${n(R / (gamma() - 1))} J/(mol·K)` }];
      },
    };
  },
};

export default sim;
