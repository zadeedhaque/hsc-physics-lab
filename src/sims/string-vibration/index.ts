import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { stringModes } from '../../physics/waves';
import { C } from '../../engine/colors';
import { n } from '../shared';

const SPAN = 12;

const sim: SimDefinition = {
  camera: { position: [0, 2.2, 12], target: [0, 0.8, 0], aspect: 1.8 },
  hint: 'A sonometer: the hanging mass sets the tension. The display is slowed so you can see the vibration shape.',
  params: [
    { kind: 'slider', key: 'M', label: 'Hanging mass (tension = Mg)', unit: 'kg', min: 0.5, max: 20, step: 0.1, default: 5 },
    { kind: 'slider', key: 'L', label: 'Vibrating length', unit: 'm', min: 0.2, max: 1.5, step: 0.01, default: 0.8 },
    { kind: 'slider', key: 'mu', label: 'Linear density μ', unit: 'g/m', min: 0.5, max: 20, step: 0.1, default: 2 },
    { kind: 'slider', key: 'n', label: 'Harmonic n', min: 1, max: 6, step: 1, default: 1 },
  ],
  presets: [
    { label: 'Guitar-like', values: { M: 7, L: 0.65, mu: 1.1, n: 1 } },
    { label: 'Four times the tension', values: { M: 20, L: 0.8, mu: 2, n: 1 } },
    { label: 'Half the length', values: { M: 5, L: 0.4, mu: 2, n: 1 } },
    { label: 'Overtone n = 3', values: { n: 3 } },
  ],
  graphs: [
    { id: 'fT', title: 'Fundamental frequency vs √tension', x: '√T (√N)', y: 'f₁ (Hz)', kind: 'curve', zeroY: true, series: [{ label: 'f₁ = (1/2L)√(T/μ)', color: C.accent }] },
  ],
  learn: {
    concept: 'A stretched string clamped at both ends vibrates in standing waves. The wave speed on the string is v = √(T/μ), so its natural frequencies are fₙ = (n/2L)√(T/μ). These are the laws of vibrating strings used in the sonometer: f ∝ 1/L, f ∝ √T and f ∝ 1/√μ.',
    variables: [['T', 'tension (N)'], ['μ', 'mass per unit length (kg/m)'], ['L', 'vibrating length (m)'], ['n', 'harmonic number'], ['v', 'wave speed √(T/μ)']],
    observe: [
      'Quadrupling the tension doubles the frequency.',
      'Halving the length doubles the frequency (law of length).',
      'A heavier string (larger μ) vibrates at a lower pitch.',
    ],
    challenge: 'Tune the string to 256 Hz (C) using L = 0.5 m and μ = 2 g/m. What hanging mass do you need?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const board = kit.box(SPAN + 3, 0.3, 1.5, '#78350f');
    board.position.set(0.5, -0.6, 0);
    const bridge1 = kit.box(0.15, 0.6, 1, '#d6b98c');
    const bridge2 = kit.box(0.15, 0.6, 1, '#d6b98c');
    const string = kit.line('#e2e8f0', [], { width: 2.5 });
    const over = kit.line('#e2e8f0', [], { width: 2 });
    const pulley = kit.torus(0.3, 0.05, '#94a3b8');
    const mass = kit.cylinder(0.4, 0.4, 0.6, '#64748b', { metalness: 0.5 });
    const Tarrow = kit.arrow(C.tension, { label: 'T', radius: 0.04 });
    const lLabel = kit.label('', [0, -1.1, 0.8], { small: true });

    const T = () => num(p, 'M') * 9.81;
    const mode = () => stringModes(T(), num(p, 'mu') / 1000, num(p, 'L'), num(p, 'n'));
    const sc = () => SPAN / 1.5;

    function build() {
      const Ls = num(p, 'L') * sc();
      const x0 = -SPAN / 2, x1 = x0 + Ls;
      bridge1.position.set(x0, -0.15, 0); bridge2.position.set(x1, -0.15, 0);
      pulley.position.set(SPAN / 2 + 1.2, -0.1, 0);
      over.setPoints([[x1, 0.15, 0], [SPAN / 2 + 1.2, 0.2, 0], [SPAN / 2 + 1.5, -0.1, 0], [SPAN / 2 + 1.5, -1.6, 0]]);
      const s = Math.cbrt(num(p, 'M') / 5);
      mass.scale.set(s, s, s);
      mass.position.set(SPAN / 2 + 1.5, -1.9 - 0.3 * s, 0);
      Tarrow.set([SPAN / 2 + 1.5, -1.6, 0.4], [0, 0.5 + T() / 100, 0], `T = ${n(T())} N`);
      lLabel.at([(x0 + x1) / 2, -1.1, 0.8]).setText(`L = ${n(num(p, 'L'))} m`);
      const G = graphs.get('fT');
      G.plot(0, 0, Math.sqrt(200), (s2) => (1 / (2 * num(p, 'L'))) * Math.sqrt((s2 * s2) / (num(p, 'mu') / 1000)), 100);
      G.setMarkers([{ x: Math.sqrt(T()), y: stringModes(T(), num(p, 'mu') / 1000, num(p, 'L'), 1).fn, color: C.accent }]);
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; },
      step(dt) { t += dt; },
      render() {
        const Ls = num(p, 'L') * sc();
        const x0 = -SPAN / 2;
        const nn = num(p, 'n');
        const pts: THREE.Vector3[] = [];
        // displayed at 1.5 visual cycles per second regardless of the true frequency
        const phase = Math.cos(2 * Math.PI * 1.5 * t);
        for (let i = 0; i <= 200; i++) {
          const u = i / 200;
          pts.push(new THREE.Vector3(x0 + u * Ls, 0.15 + 0.6 * Math.sin(nn * Math.PI * u) * phase, 0));
        }
        string.setPoints(pts);
      },
      time: () => t,
      readouts(): Readout[] {
        const m = mode();
        return [
          { label: 'Tension T = Mg', value: T(), unit: 'N' },
          { label: 'Wave speed √(T/μ)', value: m.v, unit: 'm/s' },
          { label: `Frequency f${'₁₂₃₄₅₆'[num(p, 'n') - 1]}`, value: m.fn, unit: 'Hz', tone: 'accent' },
          { label: 'Fundamental f₁', value: m.fn / num(p, 'n'), unit: 'Hz' },
          { label: 'Wavelength on the string', value: m.lambda, unit: 'm' },
          { label: 'Wavelength of the sound in air', value: 343 / m.fn, unit: 'm' },
        ];
      },
      equations(): Equation[] {
        const m = mode();
        return [
          { expr: 'v = √(T / μ)', sub: `= √(${n(T())} / ${n(num(p, 'mu') / 1000)}) = ${n(m.v)} m/s` },
          { expr: 'fₙ = (n / 2L) √(T / μ)', sub: `= (${num(p, 'n')} / ${n(2 * num(p, 'L'))}) × ${n(m.v)} = ${n(m.fn)} Hz` },
          { expr: 'Laws: f ∝ 1/L ,  f ∝ √T ,  f ∝ 1/√μ' },
        ];
      },
    };
  },
};

export default sim;
