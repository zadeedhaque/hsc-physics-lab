import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { atwood } from '../../physics/dynamics';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const R = 0.6; // pulley radius (scene)
const TOP = 6;

const sim: SimDefinition = {
  camera: { position: [0, 3.4, 11], target: [0, 3, 0], aspect: 1.2 },
  hint: 'Tension is the same on both sides of an ideal pulley; it is always between the two weights.',
  params: [
    { kind: 'slider', key: 'm1', label: 'Mass m₁ (left)', unit: 'kg', min: 0.1, max: 10, step: 0.1, default: 2 },
    { kind: 'slider', key: 'm2', label: 'Mass m₂ (right)', unit: 'kg', min: 0.1, max: 10, step: 0.1, default: 3 },
    { kind: 'slider', key: 'g', label: 'Gravity', unit: 'm/s²', min: 1, max: 25, step: 0.01, default: 9.81 },
  ],
  presets: [
    { label: 'Balanced', values: { m1: 3, m2: 3 } },
    { label: 'Slight imbalance', values: { m1: 2.9, m2: 3.1 } },
    { label: '2 kg vs 3 kg', values: { m1: 2, m2: 3 } },
    { label: 'Nearly free fall', values: { m1: 0.2, m2: 8 } },
  ],
  graphs: [
    { id: 'v', title: 'Speed of the masses vs time', x: 't (s)', y: 'v (m/s)', zeroY: true, series: [{ label: 'v', color: C.velocity }] },
    { id: 'aT', title: 'Acceleration and tension vs m₂ (m₁ fixed)', x: 'm₂ (kg)', y: '', kind: 'curve', zeroY: true, series: [{ label: 'a (m/s²)', color: C.acceleration }, { label: 'T (N)', color: C.tension }] },
  ],
  learn: {
    concept: 'In an Atwood machine two masses hang over a light, frictionless pulley. The heavier mass accelerates down and the lighter one up with the same acceleration a = (m₂ − m₁)g/(m₁ + m₂). The rope tension T = 2m₁m₂g/(m₁ + m₂) lies between the two weights.',
    variables: [['m₁, m₂', 'masses (kg)'], ['a', 'acceleration (m/s²)'], ['T', 'rope tension (N)'], ['g', 'gravity (m/s²)']],
    observe: [
      'Equal masses: no acceleration, tension equals each weight.',
      'A small difference gives a small acceleration — useful for measuring g slowly.',
      'As m₂ becomes huge, a → g and T → 2m₁g.',
    ],
    challenge: 'With m₁ = 2 kg, find m₂ that gives a = 2.0 m/s². Solve (m₂ − 2)g/(m₂ + 2) = 2 and check.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let y = 0, v = 0, t = 0, finished = false; // y = displacement of m2 downward
    const sample = sampler(1 / 20);
    kit.box(8, 0.2, 3, '#1e293b').position.set(0, -0.1, 0);
    const beam = kit.box(4, 0.25, 0.6, '#475569');
    beam.position.set(0, TOP + 1.2, 0);
    const stem = kit.box(0.15, 1.2, 0.15, '#64748b');
    stem.position.set(0, TOP + 0.6, 0);
    const pulley = kit.torus(R, 0.08, '#cbd5e1');
    pulley.position.set(0, TOP, 0);
    const spoke = kit.box(0.08, 2 * R, 0.05, '#94a3b8');
    spoke.position.set(0, TOP, 0);
    const b1 = kit.box(0.7, 0.7, 0.7, C.force);
    const b2 = kit.box(0.7, 0.7, 0.7, C.acceleration);
    const rope = kit.line('#e2e8f0', [], { width: 2 });
    const T1 = kit.arrow(C.tension, { label: 'T', radius: 0.04 });
    const T2 = kit.arrow(C.tension, { label: 'T', radius: 0.04 });
    const W1 = kit.arrow(C.weight, { label: 'm₁g', radius: 0.04 });
    const W2 = kit.arrow(C.weight, { label: 'm₂g', radius: 0.04 });
    const l1 = kit.label('', [0, 0, 0], { color: C.force, small: true });
    const l2 = kit.label('', [0, 0, 0], { color: C.acceleration, small: true });

    const phys = () => atwood(num(p, 'm1'), num(p, 'm2'), num(p, 'g'));
    const reset = () => { y = 0; v = 0; t = 0; finished = false; sample.reset(); curve(); };
    function curve() {
      const m1 = num(p, 'm1'), g = num(p, 'g');
      graphs.get('aT').plot(0, 0.1, 10, (m2) => atwood(m1, m2, g).a, 100);
      graphs.get('aT').plot(1, 0.1, 10, (m2) => atwood(m1, m2, g).T, 100);
      graphs.get('aT').setMarkers([{ x: num(p, 'm2'), y: phys().a, color: C.acceleration }, { x: num(p, 'm2'), y: phys().T, color: C.tension }]);
    }
    reset();

    return {
      setParams(np) { p = np; graphs.clearLive(); reset(); },
      reset,
      step(dt) {
        if (finished) return;
        const a = phys().a;
        v += a * dt; y += v * dt; t += dt;
        if (Math.abs(y) >= 2.4) { y = Math.sign(y) * 2.4; finished = true; }
        if (t > 20) finished = true;
        if (sample.due(t) || finished) graphs.get('v').push(t, Math.abs(v));
      },
      render() {
        const h0 = 3; // rest height of both blocks
        const y1 = h0 + y, y2 = h0 - y;
        b1.position.set(-R, y1, 0); b2.position.set(R, y2, 0);
        const s1 = Math.cbrt(num(p, 'm1') / 3), s2 = Math.cbrt(num(p, 'm2') / 3);
        b1.scale.setScalar(s1); b2.scale.setScalar(s2);
        const arc: [number, number, number][] = [[-R, y1 + 0.35 * s1, 0]];
        for (let i = 0; i <= 16; i++) { const a = Math.PI - (i / 16) * Math.PI; arc.push([R * Math.cos(a), TOP + R * Math.sin(a), 0]); }
        arc.push([R, y2 + 0.35 * s2, 0]);
        rope.setPoints(arc);
        spoke.rotation.z = -y / R;
        const r = phys();
        const sc = 1.6 / Math.max(num(p, 'm1'), num(p, 'm2')) / num(p, 'g');
        T1.set([-R - 0.05, y1 + 0.35 * s1, 0.45], [0, r.T * sc, 0], `T = ${n(r.T)} N`);
        T2.set([R + 0.05, y2 + 0.35 * s2, 0.45], [0, r.T * sc, 0], '');
        W1.set([-R, y1 - 0.35 * s1, 0.45], [0, -num(p, 'm1') * num(p, 'g') * sc, 0], `m₁g = ${n(num(p, 'm1') * num(p, 'g'))} N`);
        W2.set([R, y2 - 0.35 * s2, 0.45], [0, -num(p, 'm2') * num(p, 'g') * sc, 0], `m₂g = ${n(num(p, 'm2') * num(p, 'g'))} N`);
        l1.at([-R - 1.1, y1, 0]).setText(`${n(num(p, 'm1'))} kg`);
        l2.at([R + 1.1, y2, 0]).setText(`${n(num(p, 'm2'))} kg`);
      },
      done: () => finished,
      time: () => t,
      readouts(): Readout[] {
        const r = phys();
        return [
          { label: 'Acceleration a', value: Math.abs(r.a), unit: 'm/s²', tone: 'accent' },
          { label: 'Direction', value: r.a > 0 ? 'm₂ descends' : r.a < 0 ? 'm₁ descends' : 'balanced' },
          { label: 'Tension T', value: r.T, unit: 'N', tone: 'accent' },
          { label: 'Net driving force (m₂ − m₁)g', value: r.net, unit: 'N' },
          { label: 'Speed', value: Math.abs(v), unit: 'm/s' },
        ];
      },
      equations(): Equation[] {
        const m1 = num(p, 'm1'), m2 = num(p, 'm2'), g = num(p, 'g');
        const r = phys();
        return [
          { expr: 'a = (m₂ − m₁) g / (m₁ + m₂)', sub: `a = (${n(m2)} − ${n(m1)}) × ${n(g)} / ${n(m1 + m2)} = ${n(r.a)} m/s²` },
          { expr: 'T = 2 m₁ m₂ g / (m₁ + m₂)', sub: `T = 2 × ${n(m1)} × ${n(m2)} × ${n(g)} / ${n(m1 + m2)} = ${n(r.T)} N` },
          { expr: 'm₂g − T = m₂a ,  T − m₁g = m₁a', note: 'Newton’s second law applied to each mass.' },
        ];
      },
    };
  },
};

export default sim;
