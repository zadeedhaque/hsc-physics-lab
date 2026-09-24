import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { beatFrequency } from '../../physics/waves';
import { C } from '../../engine/colors';
import { n } from '../shared';

const WIN = 1; // seconds of signal shown
const SPAN = 16;

const sim: SimDefinition = {
  camera: { position: [0, 0.3, 14], target: [0, 0.3, 0], aspect: 1.8 },
  hint: 'The sum swells and fades |f₁ − f₂| times per second — that is what you hear as beats.',
  params: [
    { kind: 'slider', key: 'f1', label: 'Frequency of fork 1', unit: 'Hz', min: 200, max: 300, step: 0.5, default: 256 },
    { kind: 'slider', key: 'f2', label: 'Frequency of fork 2', unit: 'Hz', min: 200, max: 300, step: 0.5, default: 260 },
    { kind: 'slider', key: 'A', label: 'Amplitude', min: 0.2, max: 1, step: 0.05, default: 0.8 },
    { kind: 'slider', key: 'slow', label: 'Scroll speed', unit: '×', min: 0.02, max: 1, step: 0.01, default: 0.1 },
  ],
  presets: [
    { label: '4 beats/s', values: { f1: 256, f2: 260 } },
    { label: '1 beat/s', values: { f1: 256, f2: 257 } },
    { label: '10 beats/s', values: { f1: 256, f2: 266 } },
    { label: 'In tune', values: { f1: 256, f2: 256 } },
  ],
  graphs: [
    { id: 'y', title: 'Resultant sound at the ear (1 s window)', x: 't (s)', y: 'pressure', kind: 'curve', yRange: [-2.1, 2.1], series: [{ label: 'y₁ + y₂', color: C.weight }, { label: 'envelope', color: C.friction, dashed: true }] },
  ],
  learn: {
    concept: 'When two sound waves of slightly different frequencies overlap, they drift in and out of step. The loudness rises and falls periodically — beats. The number of beats per second equals the difference of the two frequencies, f_beat = |f₁ − f₂|. Musicians use beats to tune instruments.',
    variables: [['f₁, f₂', 'frequencies of the two sources (Hz)'], ['f_beat', '|f₁ − f₂| (Hz)'], ['T_beat', '1 / f_beat (s)']],
    observe: [
      'When f₁ = f₂ the beats disappear — the forks are in tune.',
      'A larger difference means faster beats.',
      'The resultant oscillates at the average frequency (f₁ + f₂)/2.',
    ],
    challenge: 'A fork of 256 Hz gives 4 beats/s with an unknown fork. Loading the unknown fork with wax (lowering its frequency) increases the beats. What was its frequency?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const w1 = kit.line(C.accent, [], { width: 1.5 });
    const w2 = kit.line(C.acceleration, [], { width: 1.5 });
    const sum = kit.line(C.weight, [], { width: 2.2 });
    const envT = kit.line(C.friction, [], { width: 1.5, dashed: true });
    const envB = kit.line(C.friction, [], { width: 1.5, dashed: true });
    kit.label('fork 1', [-9, 3.4, 0], { color: C.accent, small: true });
    kit.label('fork 2', [-9, 1.8, 0], { color: C.acceleration, small: true });
    kit.label('sum', [-9, -1.2, 0], { color: C.weight, small: true });

    return {
      setParams(np) { p = np; },
      reset() { t = 0; },
      step(dt) { t += dt * num(p, 'slow'); },
      render() {
        const f1 = num(p, 'f1'), f2 = num(p, 'f2'), A = num(p, 'A');
        const a: THREE.Vector3[] = [], b: THREE.Vector3[] = [], s: THREE.Vector3[] = [], et: THREE.Vector3[] = [], eb: THREE.Vector3[] = [];
        // zoomed-in 0.05 s window for the individual waves; full 1 s window for the sum
        for (let i = 0; i <= 600; i++) {
          const u = i / 600;
          const X = -SPAN / 2 + u * SPAN;
          const tz = t + u * 0.05;
          a.push(new THREE.Vector3(X, 3.4 + 0.6 * A * Math.sin(2 * Math.PI * f1 * tz), 0));
          b.push(new THREE.Vector3(X, 1.8 + 0.6 * A * Math.sin(2 * Math.PI * f2 * tz), 0));
          const tw = t + u * WIN;
          const y = A * (Math.sin(2 * Math.PI * f1 * tw) + Math.sin(2 * Math.PI * f2 * tw));
          const env = 2 * A * Math.abs(Math.cos(Math.PI * (f1 - f2) * tw));
          s.push(new THREE.Vector3(X, -1.2 + 1.1 * y, 0));
          et.push(new THREE.Vector3(X, -1.2 + 1.1 * env, 0.01));
          eb.push(new THREE.Vector3(X, -1.2 - 1.1 * env, 0.01));
        }
        w1.setPoints(a); w2.setPoints(b); sum.setPoints(s); envT.setPoints(et); envB.setPoints(eb);
        const G = graphs.get('y');
        G.plot(0, 0, WIN, (x) => A * (Math.sin(2 * Math.PI * f1 * (t + x)) + Math.sin(2 * Math.PI * f2 * (t + x))), 1500);
        G.plot(1, 0, WIN, (x) => 2 * A * Math.abs(Math.cos(Math.PI * (f1 - f2) * (t + x))), 300);
      },
      time: () => t,
      readouts(): Readout[] {
        const fb = beatFrequency(num(p, 'f1'), num(p, 'f2'));
        return [
          { label: 'Beat frequency |f₁ − f₂|', value: fb, unit: 'Hz', tone: 'accent' },
          { label: 'Time between beats', value: fb > 0 ? 1 / fb : 'no beats', unit: fb > 0 ? 's' : undefined },
          { label: 'Frequency heard (f₁ + f₂)/2', value: (num(p, 'f1') + num(p, 'f2')) / 2, unit: 'Hz' },
          { label: 'Maximum amplitude', value: 2 * num(p, 'A') },
        ];
      },
      equations(): Equation[] {
        const f1 = num(p, 'f1'), f2 = num(p, 'f2');
        return [
          { expr: 'f_beat = | f₁ − f₂ |', sub: `= |${n(f1)} − ${n(f2)}| = ${n(Math.abs(f1 - f2))} Hz` },
          { expr: 'y = 2A cos(π(f₁ − f₂)t) · sin(π(f₁ + f₂)t)' },
        ];
      },
    };
  },
};

export default sim;
