import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { C } from '../../engine/colors';
import { n } from '../shared';
import { CurrentPath, battery, diode, lightUp, meter, resistor, wire } from '../circuitKit';
import type * as THREE from 'three';

const VT = 0.025_85;
const DIODES: Record<string, { name: string; Is: number; nf: number; knee: number }> = {
  si: { name: 'Silicon (1N4148)', Is: 1e-14, nf: 1, knee: 0.7 },
  ge: { name: 'Germanium (OA91)', Is: 1e-6, nf: 1, knee: 0.3 },
};

/** Solve V = I·R + V_d with I = Iₛ(e^{V_d/nV_T} − 1) by bisection on V_d. */
function operate(V: number, R: number, d: { Is: number; nf: number }) {
  const Id = (vd: number) => d.Is * Math.expm1(Math.min(vd / (d.nf * VT), 200));
  let lo = Math.min(V, 0) - 1, hi = Math.max(V, 0) + 1;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if ((V - mid) / R - Id(mid) > 0) lo = mid; else hi = mid;
  }
  const vd = (lo + hi) / 2;
  return { vd, I: Id(vd) };
}

const sim: SimDefinition = {
  camera: { position: [0, 0, 12], target: [0, 0, 0], aspect: 1.4 },
  hint: 'In forward bias almost no current flows until about 0.7 V (Si), then it rises steeply. In reverse only a tiny saturation current leaks through.',
  params: [
    { kind: 'slider', key: 'V', label: 'Supply voltage', unit: 'V', min: -10, max: 5, step: 0.05, default: 2 },
    { kind: 'slider', key: 'R', label: 'Series resistance', unit: 'Ω', min: 10, max: 1000, step: 10, default: 100 },
    { kind: 'select', key: 'type', label: 'Diode', default: 'si', options: Object.entries(DIODES).map(([value, d]) => ({ value, label: d.name })) },
  ],
  presets: [
    { label: 'Below the knee (0.5 V)', values: { V: 0.5 } },
    { label: 'Conducting (2 V)', values: { V: 2 } },
    { label: 'Reverse bias (−8 V)', values: { V: -8 } },
    { label: 'Germanium', values: { type: 'ge', V: 1 } },
  ],
  graphs: [
    { id: 'IV', title: 'Diode characteristic with load line', x: 'V_d (V)', y: 'I (mA)', kind: 'curve', xRange: [-1, 1], yRange: [-5, 50], series: [{ label: 'diode', color: C.current }, { label: 'load line (V − V_d)/R', color: '#94a3b8', dashed: true }] },
    { id: 'L', title: 'log₁₀ |I| vs diode voltage', x: 'V_d (V)', y: 'log₁₀ |I / A|', kind: 'curve', xRange: [-1, 1], series: [{ label: 'log current', color: C.accent }] },
  ],
  learn: {
    concept: 'A junction diode lets current flow easily one way only. In forward bias the current grows exponentially with voltage, I = Iₛ(e^{V/V_T} − 1): it is negligible below the knee voltage (≈0.7 V for silicon, ≈0.3 V for germanium) and large above it. In reverse bias only the tiny saturation current Iₛ flows. With a series resistor, the operating point is where the diode curve meets the load line I = (V − V_d)/R.',
    variables: [['V_d', 'voltage across the diode'], ['Iₛ', 'reverse saturation current'], ['V_T', 'thermal voltage kT/e ≈ 25.9 mV'], ['r_d', 'dynamic resistance ΔV/ΔI = V_T / I']],
    observe: [
      'Once conducting, V_d stays near 0.7 V however much you raise the supply — the resistor takes the rest.',
      'The log plot is a straight line in forward bias: the current is exponential.',
      'Germanium conducts at a lower voltage but leaks far more in reverse.',
    ],
    challenge: 'With a 5 V supply and 220 Ω, estimate the current if the diode drops 0.7 V. Check with the simulation.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    wire(kit, [[-4, -2], [-4, 2], [4, 2], [4, -2], [-4, -2]]);
    const cell = battery(kit, [-4, 0], 'y', '');
    const res = resistor(kit, [-1, 2], 'x', '');
    const D = diode(kit, [2, 2], 'x+', '', '#e2e8f0');
    const am = meter(kit, [4, 0], 'A', [1.4, 0]);
    const vm = meter(kit, [2, 3.3], 'V', [1.3, 0]);
    kit.line('#94a3b8', [[1.4, 2, 0], [1.4, 3.3, 0], [1.66, 3.3, 0]], { width: 1.5, dashed: true });
    kit.line('#94a3b8', [[2.6, 2, 0], [2.6, 3.3, 0], [2.34, 3.3, 0]], { width: 1.5, dashed: true });
    const dots = new CurrentPath(kit, [[-4, -2], [-4, 2], [4, 2], [4, -2], [-4, -2]], C.current);
    const state = kit.label('', [2, 1.1, 0], { small: true });

    const dd = () => DIODES[str(p, 'type')] ?? DIODES.si;
    const op = () => operate(num(p, 'V'), num(p, 'R'), dd());
    function build() {
      const V = num(p, 'V');
      cell.group.rotation.z = V >= 0 ? 0 : Math.PI;
      cell.label.setText(`${n(Math.abs(V))} V`);
      res.label.setText(`${n(num(p, 'R'))} Ω`);
      const d = dd();
      const G = graphs.get('IV');
      G.plot(0, -1, 1, (vd) => Math.min(60, d.Is * Math.expm1(Math.min(vd / (d.nf * VT), 200)) * 1000), 400);
      G.plot(1, -1, 1, (vd) => ((V - vd) / num(p, 'R')) * 1000, 50);
      const o = op();
      G.setMarkers([{ x: o.vd, y: o.I * 1000, color: C.accent }]);
      graphs.get('L').plot(0, -1, 1, (vd) => Math.log10(Math.max(1e-30, Math.abs(d.Is * Math.expm1(Math.min(vd / (d.nf * VT), 200))))), 400);
      graphs.get('L').setMarkers([{ x: o.vd, y: Math.log10(Math.max(1e-30, Math.abs(o.I))), color: C.accent }]);
      lightUp(D.mat as THREE.MeshStandardMaterial, o.I / 0.02, '#fde68a');
      state.setText(o.I > 1e-4 ? 'conducting' : o.I < 0 ? 'reverse: blocking' : 'not yet conducting');
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; },
      step(dt) {
        t += dt;
        dots.advance(Math.sign(op().I) * Math.min(5, Math.abs(op().I) * 250) * dt);
      },
      render() {
        const o = op();
        am.setText(`${n(o.I * 1000)} mA`);
        vm.setText(`${n(o.vd)} V`);
      },
      time: () => t,
      readouts(): Readout[] {
        const o = op();
        return [
          { label: 'Current I', value: o.I * 1000, unit: 'mA', tone: 'accent' },
          { label: 'Diode voltage V_d', value: o.vd, unit: 'V', tone: 'accent' },
          { label: 'Resistor voltage', value: o.I * num(p, 'R'), unit: 'V' },
          { label: 'Dynamic resistance r_d', value: o.I > 1e-9 ? (dd().nf * VT) / o.I : '∞ (blocking)', unit: o.I > 1e-9 ? 'Ω' : undefined },
          { label: 'Static resistance V_d / I', value: Math.abs(o.I) > 0 ? Math.abs(o.vd / o.I) : '∞', unit: Math.abs(o.I) > 0 ? 'Ω' : undefined },
          { label: 'Power in diode', value: o.vd * o.I * 1000, unit: 'mW' },
          { label: 'Reverse saturation Iₛ', value: dd().Is, unit: 'A' },
        ];
      },
      equations(): Equation[] {
        const o = op();
        return [
          { expr: 'I = Iₛ (e^{V_d / V_T} − 1)', sub: `= ${n(dd().Is)} × (e^{${n(o.vd)}/0.0259} − 1) = ${n(o.I * 1000)} mA` },
          { expr: 'V = I R + V_d', sub: `${n(num(p, 'V'))} = ${n(o.I * num(p, 'R'))} + ${n(o.vd)} V` },
          { expr: 'r_d = V_T / I (forward)' },
        ];
      },
    };
  },
};

export default sim;
