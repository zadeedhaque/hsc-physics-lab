import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num, str } from '../types';
import type { SceneKit } from '../../engine/kit';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';
import { CurrentPath, diode, lightUp, resistor, type P2 } from '../circuitKit';

const F = 50; // mains frequency (Hz)
const SLOW = 0.025; // physical seconds per real second → one 50 Hz cycle takes 0.8 s
const RS = 1; // source + diode resistance (Ω)
const DROP = 0.7; // forward drop per diode (V)

/** AC source symbol: a ring with a sine wave, centred at `at`. */
function acSource(kit: SceneKit, g: THREE.Group, at: P2) {
  const ring = kit.torus(0.55, 0.05, '#e2e8f0');
  ring.position.set(at[0], at[1], 0);
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push([at[0] - 0.35 + 0.7 * u, at[1] + 0.2 * Math.sin(u * Math.PI * 2), 0.05]); }
  const wave = kit.line('#e2e8f0', pts, { width: 2 });
  g.add(ring, wave);
}
function wires(kit: SceneKit, g: THREE.Group, path: P2[]) {
  const l = kit.line('#94a3b8', path.map(([x, y]) => [x, y, 0] as [number, number, number]), { width: 4 });
  g.add(l);
}

const sim: SimDefinition = {
  camera: { position: [0, 0, 14], target: [0, 0, 0], aspect: 1.4 },
  hint: 'A half-wave rectifier passes only the positive half-cycles; a bridge passes both, flipping the negative ones. A capacitor fills in the gaps.',
  params: [
    { kind: 'select', key: 'mode', label: 'Circuit', default: 'full', options: [{ value: 'half', label: 'Half-wave (1 diode)' }, { value: 'full', label: 'Full-wave bridge (4 diodes)' }] },
    { kind: 'slider', key: 'Vp', label: 'AC peak voltage', unit: 'V', min: 3, max: 24, step: 0.5, default: 12 },
    { kind: 'slider', key: 'R', label: 'Load resistance', unit: 'Ω', min: 50, max: 5000, step: 50, default: 500 },
    { kind: 'toggle', key: 'cap', label: 'Smoothing capacitor', default: false },
    { kind: 'slider', key: 'C', label: 'Capacitance', unit: 'µF', min: 10, max: 2000, step: 10, default: 220, showIf: (p) => p.cap === true },
  ],
  presets: [
    { label: 'Half-wave', values: { mode: 'half', cap: false } },
    { label: 'Full-wave bridge', values: { mode: 'full', cap: false } },
    { label: 'Bridge + 470 µF', values: { mode: 'full', cap: true, C: 470 } },
    { label: 'Heavy load, small C', values: { mode: 'full', cap: true, C: 47, R: 100 } },
  ],
  graphs: [
    { id: 'W', title: 'Input and output voltage', x: 't (ms)', y: 'V (V)', window: 60, series: [{ label: 'AC input', color: '#94a3b8' }, { label: 'output (load)', color: C.accent }] },
  ],
  learn: {
    concept: 'A rectifier converts alternating current into direct current using diodes, which conduct in only one direction. A single diode (half-wave) passes only the positive half-cycles. A bridge of four diodes (full-wave) steers both half-cycles through the load in the same direction, so the output pulses at twice the mains frequency. A capacitor across the load charges at each peak and discharges slowly between them, smoothing the output; the remaining ripple is about ΔV ≈ I/(fC).',
    variables: [['V_p', 'peak AC voltage'], ['V_dc', 'average output voltage'], ['ΔV', 'peak-to-peak ripple'], ['f', 'ripple frequency: 50 Hz (half) or 100 Hz (full)'], ['C', 'smoothing capacitance']],
    observe: [
      'In the bridge, a different pair of diodes lights up on each half-cycle.',
      'The bridge output peak is about 1.4 V below the input peak (two diode drops).',
      'A larger capacitor or a lighter load (larger R) gives less ripple.',
    ],
    challenge: 'With a 100 Hz ripple, a 50 mA load and 470 µF, predict the ripple. Check it here.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, tau = 0, vC = 0, iSrc = 0;
    const hist: { v: number; t: number }[] = [];
    const sample = sampler(1 / 60);
    // ── half-wave layout
    const gh = kit.add(new THREE.Group());
    acSource(kit, gh, [-5, 0]);
    wires(kit, gh, [[-5, 0.55], [-5, 3], [5, 3], [5, -3], [-5, -3], [-5, -0.55]]);
    const dh = diode(kit, [-1, 3], 'x+', 'D');
    gh.add(dh.group);
    const pathHalf = new CurrentPath(kit, [[-5, -0.55], [-5, 3], [5, 3], [5, -3], [-5, -3], [-5, -0.55]], C.current);
    // ── bridge layout: AC across L–R inside the diamond, load across T–B outside
    const gf = kit.add(new THREE.Group());
    const L: P2 = [-4, 0], T: P2 = [-1, 2], R: P2 = [2, 0], B: P2 = [-1, -2];
    wires(kit, gf, [L, T, R, B, L]);
    wires(kit, gf, [L, [-1.55, 0]]); wires(kit, gf, [[-0.45, 0], R]);
    acSource(kit, gf, [-1, 0]);
    wires(kit, gf, [T, [-1, 3], [5, 3], [5, -3], [-1, -3], B]);
    const ang = (a: P2, b: P2) => Math.atan2(b[1] - a[1], b[0] - a[0]);
    const mid = (a: P2, b: P2): P2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const d1 = diode(kit, mid(L, T), ang(L, T), 'D1'), d2 = diode(kit, mid(R, T), ang(R, T), 'D2');
    const d3 = diode(kit, mid(B, L), ang(B, L), 'D3'), d4 = diode(kit, mid(B, R), ang(B, R), 'D4');
    [d1, d2, d3, d4].forEach((d) => gf.add(d.group));
    const pathPos = new CurrentPath(kit, [L, T, [-1, 3], [5, 3], [5, -3], [-1, -3], B, R, L], C.current);
    const pathNeg = new CurrentPath(kit, [R, T, [-1, 3], [5, 3], [5, -3], [-1, -3], B, L, R], C.current);
    // ── shared load and capacitor
    const load = resistor(kit, [5, 0], 'y', '');
    const capG = kit.add(new THREE.Group());
    const plate1 = kit.box(1.1, 0.08, 0.5, '#e2e8f0'); plate1.position.set(3.4, 0.18, 0);
    const plate2 = kit.box(1.1, 0.08, 0.5, '#e2e8f0'); plate2.position.set(3.4, -0.18, 0);
    capG.add(plate1, plate2);
    wires(kit, capG, [[3.4, 3], [3.4, 0.18]]); wires(kit, capG, [[3.4, -0.18], [3.4, -3]]);
    const capLabel = kit.label('', [2.3, 0, 0], { small: true });
    capG.add(capLabel);
    const loadPath = new CurrentPath(kit, [[3.4, 3], [5, 3], [5, -3], [3.4, -3], [3.4, 3]], C.current, 0.5, 0.14);
    const outLabel = kit.label('', [6.3, 0.9, 0], { color: C.accent, small: true });
    kit.label('+', [5.4, 2.6, 0], { color: C.positive, small: true });

    const full = () => str(p, 'mode') === 'full';
    const Cf = () => (bool(p, 'cap') ? num(p, 'C') * 1e-6 : 0);
    const vin = () => num(p, 'Vp') * Math.sin(2 * Math.PI * F * tau);
    /** Open-circuit rectified source voltage (after diode drops). */
    const vsrc = () => (full() ? Math.abs(vin()) - 2 * DROP : vin() - DROP);

    function build() {
      gh.visible = !full(); gf.visible = full();
      pathHalf.visible = !full(); pathPos.visible = full(); pathNeg.visible = full();
      capG.visible = bool(p, 'cap'); loadPath.visible = bool(p, 'cap');
      load.label.setText(`${n(num(p, 'R'))} Ω`);
      capLabel.setText(`${n(num(p, 'C'))} µF`);
    }
    function reset() { t = 0; tau = 0; vC = 0; iSrc = 0; hist.length = 0; sample.reset(); build(); }
    reset();

    return {
      setParams(np) { p = np; build(); },
      reset,
      step(dt) {
        t += dt;
        const h = dt * SLOW;
        tau += h;
        const Rl = num(p, 'R'), Vs = vsrc();
        if (Cf() > 0) {
          const conducting = Vs > vC;
          // implicit Euler: C dv/dt = (Vs − v)/Rs·[conducting] − v/R
          const a = h / Cf();
          vC = conducting ? (vC + (a * Vs) / RS) / (1 + a * (1 / RS + 1 / Rl)) : vC / (1 + a / Rl);
          iSrc = conducting ? Math.max(0, (Vs - vC) / RS) : 0;
        } else {
          vC = Math.max(0, (Vs * Rl) / (Rl + RS));
          iSrc = vC / Rl;
        }
        hist.push({ v: vC, t: tau });
        while (hist.length && tau - hist[0].t > 0.02) hist.shift();
        // conventional current dots: speed ∝ current
        const sp = (i: number) => Math.min(6, i * 60) * dt;
        const posHalf = vin() >= 0;
        if (!full()) pathHalf.advance(sp(iSrc));
        else if (posHalf) pathPos.advance(sp(iSrc)); else pathNeg.advance(sp(iSrc));
        loadPath.advance(sp(vC / Rl));
        if (sample.due(t)) graphs.get('W').push(tau * 1000, vin(), vC);
      },
      render() {
        const on = iSrc > 1e-4;
        const pos = vin() >= 0;
        lightUp(dh.mat as THREE.MeshStandardMaterial, !full() && on ? 1 : 0);
        lightUp(d1.mat as THREE.MeshStandardMaterial, full() && on && pos ? 1 : 0);
        lightUp(d4.mat as THREE.MeshStandardMaterial, full() && on && pos ? 1 : 0);
        lightUp(d2.mat as THREE.MeshStandardMaterial, full() && on && !pos ? 1 : 0);
        lightUp(d3.mat as THREE.MeshStandardMaterial, full() && on && !pos ? 1 : 0);
        outLabel.setText(`V_out = ${n(vC)} V`);
        (load.mat as THREE.MeshStandardMaterial).emissive.set('#f97316');
        (load.mat as THREE.MeshStandardMaterial).emissiveIntensity = Math.min(1, (vC * vC) / num(p, 'R') / 1.5);
      },
      time: () => tau,
      readouts(): Readout[] {
        const vs = hist.map((q) => q.v);
        const vmax = vs.length ? Math.max(...vs) : 0, vmin = vs.length ? Math.min(...vs) : 0;
        const vdc = vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : 0;
        const fr = full() ? 2 * F : F;
        return [
          { label: 'Peak output', value: vmax, unit: 'V' },
          { label: 'Average (DC) output', value: vdc, unit: 'V', tone: 'accent' },
          { label: 'Ripple (peak-to-peak)', value: vmax - vmin, unit: 'V', tone: 'accent' },
          { label: 'Ripple frequency', value: fr, unit: 'Hz' },
          { label: 'Load current (average)', value: (vdc / num(p, 'R')) * 1000, unit: 'mA' },
          { label: 'Predicted ripple I/(fC)', value: Cf() > 0 ? vdc / num(p, 'R') / (fr * Cf()) : '— (no capacitor)', unit: Cf() > 0 ? 'V' : undefined },
          { label: 'Conducting diodes', value: iSrc > 1e-4 ? (full() ? (vin() >= 0 ? 'D1 and D4' : 'D2 and D3') : 'D') : 'none' },
        ];
      },
      equations(): Equation[] {
        const Vp = num(p, 'Vp');
        return [
          { expr: full() ? 'V_out(peak) = V_p − 2 × 0.7' : 'V_out(peak) = V_p − 0.7', sub: `= ${n(full() ? Vp - 2 * DROP : Vp - DROP)} V` },
          { expr: full() ? 'V_dc (no C) ≈ 2V_peak / π' : 'V_dc (no C) ≈ V_peak / π', sub: `≈ ${n(((full() ? 2 : 1) * (full() ? Vp - 2 * DROP : Vp - DROP)) / Math.PI)} V` },
          { expr: 'ΔV ≈ I / (f C)', note: 'f = ripple frequency' },
        ];
      },
    };
  },
};

export default sim;
