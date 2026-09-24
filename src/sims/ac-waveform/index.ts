import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num } from '../types';
import { rms } from '../../physics/induction';
import { rad } from '../../lib/num';
import { C } from '../../engine/colors';
import { n } from '../shared';

const SPAN = 9; // scene width of the waveform

const sim: SimDefinition = {
  camera: { position: [0, 0.5, 12], target: [0.8, 0, 0], aspect: 1.7 },
  hint: 'The rotating phasor (left) projects onto the vertical axis to give the instantaneous value. The dashed line is the rms value.',
  params: [
    { kind: 'slider', key: 'V0', label: 'Peak value V₀', unit: 'V', min: 1, max: 400, step: 1, default: 311 },
    { kind: 'slider', key: 'f', label: 'Frequency', unit: 'Hz', min: 1, max: 100, step: 1, default: 50 },
    { kind: 'slider', key: 'phi', label: 'Phase', unit: '°', min: -180, max: 180, step: 5, default: 0 },
    { kind: 'toggle', key: 'second', label: 'Show a second wave (phase reference)', default: false },
    { kind: 'toggle', key: 'rms', label: 'Show V² and its mean (rms)', default: false },
    { kind: 'slider', key: 'slow', label: 'Display slow-down', unit: '×', min: 1, max: 200, step: 1, default: 50 },
  ],
  presets: [
    { label: 'Bangladesh mains 220 V', values: { V0: 311, f: 50 } },
    { label: 'US mains 120 V, 60 Hz', values: { V0: 170, f: 60 } },
    { label: '90° ahead', values: { phi: 90, second: true } },
    { label: 'RMS', values: { rms: true } },
  ],
  graphs: [
    { id: 'v', title: 'Voltage vs time (two cycles)', x: 't (ms)', y: 'V', kind: 'curve', zeroY: true, series: [{ label: 'v(t)', color: C.acceleration }, { label: 'reference', color: '#94a3b8', dashed: true }, { label: 'v²/V₀ (scaled)', color: C.weight }] },
  ],
  learn: {
    concept: 'Alternating voltage varies sinusoidally: v = V₀ sin(ωt + φ), with ω = 2πf. It can be pictured as a rotating phasor of length V₀. Because the average of a sine wave is zero, AC is measured by its root-mean-square value V_rms = V₀/√2 — the steady DC voltage that would give the same heating.',
    variables: [['V₀', 'peak voltage (V)'], ['f', 'frequency (Hz)'], ['ω', '2πf (rad/s)'], ['φ', 'phase angle'], ['V_rms', 'V₀/√2'], ['T', 'period 1/f']],
    observe: [
      '220 V mains is the rms value; the peak is 311 V.',
      'The mean of v² over a cycle is exactly half of V₀².',
      'A positive phase shifts the wave to the left — it reaches its peak earlier (leads).',
    ],
    challenge: 'A lamp is marked 220 V, 100 W. What peak current flows through it on AC mains?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const circleR = 1.8;
    const cx = -4.6;
    const ring = kit.line('#64748b', [], { width: 1.2 });
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; pts.push(new THREE.Vector3(cx + circleR * Math.cos(a), circleR * Math.sin(a), 0)); }
    ring.setPoints(pts);
    const phasor = kit.arrow(C.acceleration, { label: 'V₀', radius: 0.04 });
    const phasor2 = kit.arrow('#94a3b8', { radius: 0.03 });
    const wave = kit.line(C.acceleration, [], { width: 2.5 });
    const wave2 = kit.line('#94a3b8', [], { width: 1.5, dashed: true });
    const proj = kit.line('#94a3b8', [], { dashed: true, width: 1 });
    const rmsLine = kit.line(C.weight, [], { dashed: true, width: 1.5 });
    const rmsLabel = kit.label('', [0, 0, 0], { color: C.weight, small: true });
    kit.line('#475569', [[-2.4, 0, 0], [-2.4 + SPAN, 0, 0]], { width: 1 });

    const w = () => 2 * Math.PI * num(p, 'f');
    const v = (tt: number, ph = rad(num(p, 'phi'))) => num(p, 'V0') * Math.sin(w() * tt + ph);

    function curves() {
      const T = 1 / num(p, 'f');
      const G = graphs.get('v');
      G.plot(0, 0, 2 * T * 1000, (ms) => v(ms / 1000), 300);
      G.plot(1, 0, 2 * T * 1000, (ms) => (bool(p, 'second') ? v(ms / 1000, 0) : NaN), 300);
      G.plot(2, 0, 2 * T * 1000, (ms) => (bool(p, 'rms') ? v(ms / 1000) ** 2 / num(p, 'V0') : NaN), 300);
    }
    curves();

    return {
      setParams(np) { p = np; curves(); },
      reset() { t = 0; },
      step(dt) { t += dt / num(p, 'slow'); },
      render() {
        const scaleY = circleR / Math.max(num(p, 'V0'), 1);
        const th = w() * t + rad(num(p, 'phi'));
        const tip = new THREE.Vector3(cx + circleR * Math.cos(th), circleR * Math.sin(th), 0);
        phasor.set([cx, 0, 0], tip.clone().sub(new THREE.Vector3(cx, 0, 0)), `V₀ = ${n(num(p, 'V0'))} V`);
        phasor2.visible = wave2.visible = bool(p, 'second');
        const T = 1 / num(p, 'f');
        const a: THREE.Vector3[] = [], b: THREE.Vector3[] = [];
        for (let i = 0; i <= 300; i++) {
          const u = i / 300;
          const tt = t - u * 2 * T; // newest sample at the left, like a scrolling trace
          a.push(new THREE.Vector3(-2.4 + u * SPAN, v(tt) * scaleY, 0));
          b.push(new THREE.Vector3(-2.4 + u * SPAN, v(tt, 0) * scaleY, -0.05));
        }
        wave.setPoints(a);
        if (bool(p, 'second')) {
          wave2.setPoints(b);
          const th2 = w() * t;
          phasor2.set([cx, 0, 0], [circleR * Math.cos(th2), circleR * Math.sin(th2), 0]);
        }
        proj.setPoints([tip, [-2.4, tip.y, 0]]);
        const Vr = rms(num(p, 'V0')) * scaleY;
        rmsLine.visible = rmsLabel.visible = bool(p, 'rms');
        rmsLine.setPoints([[-2.4, Vr, 0.02], [-2.4 + SPAN, Vr, 0.02]]);
        rmsLabel.at([-2.4 + SPAN + 0.8, Vr, 0]).setText(`V_rms = ${n(rms(num(p, 'V0')))} V`);
      },
      time: () => t,
      readouts(): Readout[] {
        return [
          { label: 'Peak V₀', value: num(p, 'V0'), unit: 'V' },
          { label: 'rms value V₀/√2', value: rms(num(p, 'V0')), unit: 'V', tone: 'accent' },
          { label: 'Peak-to-peak', value: 2 * num(p, 'V0'), unit: 'V' },
          { label: 'Period T', value: 1000 / num(p, 'f'), unit: 'ms' },
          { label: 'Angular frequency ω', value: w(), unit: 'rad/s', tone: 'accent' },
          { label: 'Instantaneous value', value: v(t), unit: 'V' },
          { label: 'Mean over a cycle', value: 0, unit: 'V' },
          { label: 'Mean of v² over a cycle', value: num(p, 'V0') ** 2 / 2, unit: 'V²' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'v = V₀ sin(ωt + φ) ,  ω = 2πf', sub: `v = ${n(num(p, 'V0'))} sin(${n(w())}t + ${num(p, 'phi')}°)` },
          { expr: 'V_rms = V₀ / √2 ≈ 0.707 V₀', sub: `= ${n(num(p, 'V0'))} / √2 = ${n(rms(num(p, 'V0')))} V` },
          { expr: 'T = 1 / f', sub: `= ${n(1000 / num(p, 'f'))} ms` },
        ];
      },
    };
  },
};

export default sim;
