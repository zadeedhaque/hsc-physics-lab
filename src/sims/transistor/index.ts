import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num, str } from '../types';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';
import { CurrentPath, battery, meter, resistor, wire, type P2 } from '../circuitKit';

const VBE = 0.7;
const VA = 100; // Early voltage (V)
const SIGF = 0.5; // signal frequency (Hz, slowed for viewing)

/** Collector current for a given base current and V_CE (saturation knee + Early effect). */
const Ic = (Ib: number, beta: number, Vce: number) => beta * Ib * (1 - Math.exp(-Math.max(0, Vce) / 0.08)) * (1 + Math.max(0, Vce) / VA);
function solve(Vbb: number, Rb: number, Rc: number, Vcc: number, beta: number) {
  const Ib = Math.max(0, (Vbb - VBE) / Rb);
  let lo = 0, hi = Vcc;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (Vcc - mid - Rc * Ic(Ib, beta, mid) > 0) lo = mid; else hi = mid; }
  const Vce = (lo + hi) / 2;
  const I = Ic(Ib, beta, Vce);
  return { Ib, Ic: I, Ie: Ib + I, Vce, region: Ib <= 0 ? 'Cut-off' : Vce < 0.3 ? 'Saturation' : 'Active' };
}

const sim: SimDefinition = {
  camera: { position: [0, 0.5, 14], target: [0, 0.5, 0], aspect: 1.4 },
  hint: 'A tiny base current controls a collector current β times larger. Add a small signal to the base and watch the amplified, inverted copy at the collector.',
  params: [
    { kind: 'select', key: 'type', label: 'Transistor', default: 'npn', options: [{ value: 'npn', label: 'NPN' }, { value: 'pnp', label: 'PNP' }] },
    { kind: 'slider', key: 'Vbb', label: 'Base supply V_BB', unit: 'V', min: 0, max: 5, step: 0.05, default: 1.5 },
    { kind: 'slider', key: 'Rb', label: 'Base resistor R_B', unit: 'kΩ', min: 10, max: 500, step: 5, default: 100 },
    { kind: 'slider', key: 'Rc', label: 'Collector resistor R_C', unit: 'kΩ', min: 0.1, max: 10, step: 0.1, default: 4.7 },
    { kind: 'slider', key: 'Vcc', label: 'Collector supply V_CC', unit: 'V', min: 3, max: 15, step: 0.5, default: 12 },
    { kind: 'slider', key: 'beta', label: 'Current gain β', min: 20, max: 300, step: 5, default: 100 },
    { kind: 'toggle', key: 'sig', label: 'Add an AC signal to the base', default: false },
    { kind: 'slider', key: 'amp', label: 'Signal amplitude', unit: 'mV', min: 10, max: 500, step: 10, default: 100, showIf: (p) => p.sig === true },
  ],
  presets: [
    { label: 'Active region (amplifier)', values: { Vbb: 1.5, Rb: 100, Rc: 4.7, beta: 100 } },
    { label: 'Cut-off (switch OFF)', values: { Vbb: 0.4 } },
    { label: 'Saturation (switch ON)', values: { Vbb: 5, Rb: 20, Rc: 2 } },
    { label: 'Amplify a signal', values: { Vbb: 1.5, Rb: 100, Rc: 4.7, sig: true, amp: 100 } },
  ],
  graphs: [
    { id: 'O', title: 'Output characteristics and load line', x: 'V_CE (V)', y: 'I_C (mA)', kind: 'curve', xRange: [0, 15], zeroY: true, series: [{ label: '⅓ I_B', color: '#475569' }, { label: '⅔ I_B', color: '#64748b' }, { label: 'I_B (now)', color: C.current }, { label: '4⁄3 I_B', color: '#64748b' }, { label: '5⁄3 I_B', color: '#475569' }, { label: 'load line', color: C.accent, dashed: true }] },
    { id: 'S', title: 'Input and output (AC parts)', x: 't (s)', y: 'voltage (V)', window: 8, series: [{ label: 'input signal v_in', color: '#94a3b8' }, { label: 'output v_ce change', color: C.accent }] },
  ],
  learn: {
    concept: 'A bipolar transistor has three regions: emitter, base and collector. A small current into the base (I_B) allows a much larger current to flow from collector to emitter: I_C = β I_B. Since all current leaves by the emitter, I_E = I_B + I_C, and α = I_C / I_E is just below 1. In the active region the transistor is an amplifier; with no base current it is cut off (switch open), and with a large base current it saturates (switch closed). In a common-emitter amplifier a small input change at the base gives a large, inverted change of V_CE.',
    variables: [['I_B, I_C, I_E', 'base, collector, emitter currents'], ['β', 'I_C / I_B (current gain, 20–300)'], ['α', 'I_C / I_E = β/(β + 1)'], ['V_CE', 'collector–emitter voltage']],
    observe: [
      'The base current is tiny (µA) compared with the collector current (mA).',
      'In saturation, raising the base current no longer raises I_C.',
      'The output signal is larger than the input and upside-down (180° out of phase).',
      'For PNP everything is the same but every current and voltage is reversed.',
    ],
    challenge: 'With β = 100 and I_B = 20 µA, find I_C, I_E and α.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const sample = sampler(1 / 30);
    // circuit
    wire(kit, [[-5, 0], [-0.1, 0]]);
    wire(kit, [[-5, 0], [-5, -3], [5, -3], [5, 4], [1, 4], [1, 1]]);
    wire(kit, [[1, -1], [1, -3]]);
    const vbb = battery(kit, [-5, -1.5], 'y', '');
    const vcc = battery(kit, [5, 0.5], 'y', '');
    const rb = resistor(kit, [-2.6, 0], 'x', '');
    const rc = resistor(kit, [1, 2.6], 'y', '');
    // transistor symbol
    kit.torus(1.0, 0.04, '#e2e8f0').position.set(0.75, 0, 0);
    kit.box(0.1, 1.1, 0.1, '#e2e8f0').position.set(0.25, 0, 0);
    wire(kit, [[0.25, 0.25], [1, 0.8], [1, 1]]);
    wire(kit, [[0.25, -0.25], [1, -0.8], [1, -1]]);
    const arrow = kit.cone('#e2e8f0', 0.14, 0.32);
    kit.label('B', [-0.1, 0.35, 0], { small: true }); kit.label('C', [1.4, 1.1, 0], { small: true }); kit.label('E', [1.4, -1.1, 0], { small: true });
    const aB = meter(kit, [-1, 0], 'A', [0, -0.75]);
    const aC = meter(kit, [3, 4], 'A', [0, 0.75]);
    const vCE = meter(kit, [2.6, 0], 'V', [0.9, 0]);
    kit.line('#94a3b8', [[1, 0.9, 0], [2.6, 0.9, 0], [2.6, 0.34, 0]], { width: 1.5, dashed: true });
    kit.line('#94a3b8', [[1, -0.9, 0], [2.6, -0.9, 0], [2.6, -0.34, 0]], { width: 1.5, dashed: true });
    const regionLabel = kit.label('', [0.7, -1.7, 0], { color: C.accent, small: true });
    const basePath = new CurrentPath(kit, [[-5, -3], [-5, 0], [0.25, 0], [1, -0.8], [1, -3], [-5, -3]] as P2[], '#fbbf24', 0.45, 0.16);
    const colPath = new CurrentPath(kit, [[5, -3], [5, 4], [1, 4], [1, 0.8], [0.25, 0], [1, -0.8], [1, -3], [5, -3]] as P2[], C.current, 0.45);

    const pnp = () => str(p, 'type') === 'pnp';
    const Vbb = (tt = t) => num(p, 'Vbb') + (bool(p, 'sig') ? (num(p, 'amp') / 1000) * Math.sin(2 * Math.PI * SIGF * tt) : 0);
    const st = (vb = Vbb()) => solve(vb, num(p, 'Rb') * 1000, num(p, 'Rc') * 1000, num(p, 'Vcc'), num(p, 'beta'));
    const q0 = () => solve(num(p, 'Vbb'), num(p, 'Rb') * 1000, num(p, 'Rc') * 1000, num(p, 'Vcc'), num(p, 'beta'));
    /** Small-signal voltage gain dV_CE/dV_BB. */
    const gain = () => {
      const d = 0.001;
      const a = solve(num(p, 'Vbb') + d, num(p, 'Rb') * 1000, num(p, 'Rc') * 1000, num(p, 'Vcc'), num(p, 'beta')).Vce;
      const b = solve(num(p, 'Vbb') - d, num(p, 'Rb') * 1000, num(p, 'Rc') * 1000, num(p, 'Vcc'), num(p, 'beta')).Vce;
      return (a - b) / (2 * d);
    };

    function build() {
      vbb.group.rotation.z = pnp() ? Math.PI : 0;
      vcc.group.rotation.z = pnp() ? Math.PI : 0;
      vbb.label.setText(`${n(num(p, 'Vbb'))} V`); vcc.label.setText(`${n(num(p, 'Vcc'))} V`);
      rb.label.setText(`${n(num(p, 'Rb'))} kΩ`); rc.label.setText(`${n(num(p, 'Rc'))} kΩ`);
      // emitter arrow: out of the transistor for NPN, into it for PNP
      const dir = new THREE.Vector2(0.75, -0.55).normalize();
      arrow.position.set(0.72, -0.6, 0);
      arrow.rotation.z = Math.atan2(dir.y, dir.x) - Math.PI / 2 + (pnp() ? Math.PI : 0);
      const q = q0();
      const G = graphs.get('O');
      const Ib = q.Ib > 0 ? q.Ib : 10e-6;
      [1, 2, 3, 4, 5].forEach((k, i) => G.plot(i, 0, 15, (v) => Ic((Ib * k) / 3, num(p, 'beta'), v) * 1000, 200));
      G.plot(5, 0, 15, (v) => (v <= num(p, 'Vcc') ? ((num(p, 'Vcc') - v) / (num(p, 'Rc') * 1000)) * 1000 : NaN), 200);
      G.setMarkers([{ x: q.Vce, y: q.Ic * 1000, color: C.accent }]);
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; sample.reset(); },
      step(dt) {
        t += dt;
        const s = st();
        const sgn = pnp() ? -1 : 1;
        basePath.advance(sgn * Math.min(5, s.Ib * 1e5) * dt);
        colPath.advance(sgn * Math.min(5, s.Ic * 600) * dt);
        if (sample.due(t)) {
          const q = q0();
          graphs.get('S').push(t, Vbb() - num(p, 'Vbb'), s.Vce - q.Vce);
        }
      },
      render() {
        const s = st();
        aB.setText(`I_B ${n(s.Ib * 1e6)} µA`);
        aC.setText(`I_C ${n(s.Ic * 1000)} mA`);
        vCE.setText(`${n(pnp() ? -s.Vce : s.Vce)} V`);
        regionLabel.setText(s.region);
      },
      time: () => t,
      readouts(): Readout[] {
        const s = q0();
        const A = gain();
        return [
          { label: 'Base current I_B', value: s.Ib * 1e6, unit: 'µA' },
          { label: 'Collector current I_C', value: s.Ic * 1000, unit: 'mA', tone: 'accent' },
          { label: 'Emitter current I_E = I_B + I_C', value: s.Ie * 1000, unit: 'mA' },
          { label: 'Actual I_C / I_B', value: s.Ib > 0 ? s.Ic / s.Ib : '—' },
          { label: 'α = I_C / I_E', value: s.Ie > 0 ? s.Ic / s.Ie : '—' },
          { label: 'V_CE', value: pnp() ? -s.Vce : s.Vce, unit: 'V' },
          { label: 'Region', value: s.region, tone: s.region === 'Active' ? 'good' : 'accent' },
          { label: 'Voltage gain ΔV_CE / ΔV_in', value: A, tone: 'accent' },
        ];
      },
      equations(): Equation[] {
        const s = q0(), b = num(p, 'beta');
        return [
          { expr: 'I_B = (V_BB − 0.7) / R_B', sub: `= (${n(num(p, 'Vbb'))} − 0.7) / ${n(num(p, 'Rb'))} kΩ = ${n(s.Ib * 1e6)} µA` },
          { expr: 'I_C = β I_B (active)', sub: `= ${n(b)} × ${n(s.Ib * 1e6)} µA = ${n(b * s.Ib * 1000)} mA${s.region === 'Saturation' ? ' → limited by R_C (saturated)' : ''}` },
          { expr: 'I_E = I_B + I_C ,  α = β / (β + 1)', sub: `α = ${n(b / (b + 1))}` },
          { expr: 'V_CE = V_CC − I_C R_C', sub: `= ${n(num(p, 'Vcc'))} − ${n(s.Ic * 1000)} mA × ${n(num(p, 'Rc'))} kΩ = ${n(s.Vce)} V` },
        ];
      },
    };
  },
};

export default sim;
