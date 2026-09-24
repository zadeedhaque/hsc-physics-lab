import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const sim: SimDefinition = {
  camera: { position: [0, 3.5, 12], target: [0, 1, 0], aspect: 1.7 },
  hint: 'The two force arrows are always equal and opposite — but the lighter skater accelerates more.',
  params: [
    { kind: 'slider', key: 'm1', label: 'Mass of skater A', unit: 'kg', min: 20, max: 120, step: 1, default: 80 },
    { kind: 'slider', key: 'm2', label: 'Mass of skater B', unit: 'kg', min: 20, max: 120, step: 1, default: 40 },
    { kind: 'slider', key: 'F', label: 'Push force', unit: 'N', min: 10, max: 400, step: 5, default: 200 },
    { kind: 'slider', key: 'dt', label: 'Push duration', unit: 's', min: 0.1, max: 1.5, step: 0.05, default: 0.5 },
  ],
  presets: [
    { label: 'Equal skaters', values: { m1: 60, m2: 60 } },
    { label: 'Adult & child', values: { m1: 80, m2: 30 } },
    { label: 'Hard shove', values: { F: 400, dt: 0.4 } },
  ],
  graphs: [
    { id: 'F', title: 'Forces vs time', x: 't (s)', y: 'F (N)', zeroY: true, series: [{ label: 'force on A', color: C.force }, { label: 'force on B', color: C.acceleration }] },
    { id: 'v', title: 'Velocities vs time', x: 't (s)', y: 'v (m/s)', zeroY: true, series: [{ label: 'v_A', color: C.force }, { label: 'v_B', color: C.acceleration }] },
  ],
  learn: {
    concept: 'Newton’s third law: when body A exerts a force on body B, B exerts an equal and opposite force on A. The two forces act on different bodies, so they do not cancel. Because momentum changes are equal and opposite, the total momentum stays zero.',
    variables: [['F_AB, F_BA', 'action–reaction pair (N)'], ['m', 'masses (kg)'], ['a = F/m', 'accelerations'], ['v', 'final velocities (m/s)']],
    observe: [
      'The two force curves are mirror images at every instant.',
      'The lighter skater ends up faster: v ∝ 1/m.',
      'The total momentum m_Av_A + m_Bv_B stays at zero.',
    ],
    challenge: 'Skater A (80 kg) moves off at 1.0 m/s. If skater B moves off at 2.0 m/s, what is B’s mass? Check it here.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, xA = -0.45, xB = 0.45, vA = 0, vB = 0, finished = false;
    const sample = sampler(1 / 40);
    kit.box(40, 0.2, 5, '#bae6fd', { roughness: 0.2, opacity: 0.8 }).position.y = -0.1;
    const skaterA = kit.cylinder(0.35, 0.35, 1.7, C.force, { emissive: 0.1 });
    const skaterB = kit.cylinder(0.3, 0.3, 1.3, C.acceleration, { emissive: 0.1 });
    const headA = kit.sphere(0.25, '#fde68a');
    const headB = kit.sphere(0.21, '#fde68a');
    const fA = kit.arrow(C.force, { label: 'F on A', radius: 0.05 });
    const fB = kit.arrow(C.acceleration, { label: 'F on B', radius: 0.05 });
    const vAr = kit.arrow(C.velocity, { label: 'v_A' });
    const vBr = kit.arrow(C.velocity, { label: 'v_B' });

    const pushing = () => t < num(p, 'dt');
    const reset = () => { t = 0; xA = -0.45; xB = 0.45; vA = 0; vB = 0; finished = false; sample.reset(); };
    reset();

    return {
      setParams(np) { p = np; graphs.clearLive(); reset(); },
      reset,
      step(dt) {
        if (finished) return;
        const F = pushing() ? num(p, 'F') : 0;
        vA -= (F / num(p, 'm1')) * dt;
        vB += (F / num(p, 'm2')) * dt;
        xA += vA * dt; xB += vB * dt;
        t += dt;
        if (t > 8 || Math.abs(xA) > 18 || Math.abs(xB) > 18) finished = true;
        if (sample.due(t)) { graphs.get('F').push(t, -F, F); graphs.get('v').push(t, vA, vB); }
      },
      render() {
        const hA = 1.7 * Math.cbrt(num(p, 'm1') / 80), hB = 1.7 * Math.cbrt(num(p, 'm2') / 80);
        skaterA.scale.set(1, hA / 1.7, 1); skaterA.position.set(xA - 0.3, hA / 2, 0);
        skaterB.scale.set(1, hB / 1.3, 1); skaterB.position.set(xB + 0.3, hB / 2, 0);
        headA.position.set(xA - 0.3, hA + 0.2, 0); headB.position.set(xB + 0.3, hB + 0.2, 0);
        const F = pushing() ? num(p, 'F') : 0;
        const len = 0.4 + (F / 400) * 2;
        fA.visible = fB.visible = F > 0;
        fA.set([xA - 0.3, 1.0, 0.5], [-len, 0, 0], `${n(F)} N`);
        fB.set([xB + 0.3, 1.0, 0.5], [len, 0, 0], `${n(F)} N`);
        vAr.set([xA - 0.3, hA + 0.8, 0], [vA * 0.6, 0, 0], `v_A = ${n(vA)} m/s`);
        vBr.set([xB + 0.3, hB + 0.8, 0], [vB * 0.6, 0, 0], `v_B = ${n(vB)} m/s`);
      },
      done: () => finished,
      time: () => t,
      readouts(): Readout[] {
        const J = num(p, 'F') * num(p, 'dt');
        return [
          { label: 'Force on A', value: -num(p, 'F'), unit: 'N' },
          { label: 'Force on B', value: num(p, 'F'), unit: 'N' },
          { label: 'Acceleration of A (while pushing)', value: -num(p, 'F') / num(p, 'm1'), unit: 'm/s²' },
          { label: 'Acceleration of B (while pushing)', value: num(p, 'F') / num(p, 'm2'), unit: 'm/s²' },
          { label: 'Final v_A', value: -J / num(p, 'm1'), unit: 'm/s', tone: 'accent' },
          { label: 'Final v_B', value: J / num(p, 'm2'), unit: 'm/s', tone: 'accent' },
          { label: 'Total momentum now', value: num(p, 'm1') * vA + num(p, 'm2') * vB, unit: 'kg·m/s' },
        ];
      },
      equations(): Equation[] {
        const J = num(p, 'F') * num(p, 'dt');
        return [
          { expr: 'F_AB = − F_BA', sub: `|F| = ${n(num(p, 'F'))} N on each skater` },
          { expr: 'm_A v_A + m_B v_B = 0', sub: `${n(num(p, 'm1'))}×(${n(-J / num(p, 'm1'))}) + ${n(num(p, 'm2'))}×${n(J / num(p, 'm2'))} = 0` },
          { expr: 'v_A / v_B = − m_B / m_A', sub: `= −${n(num(p, 'm2') / num(p, 'm1'))}` },
        ];
      },
    };
  },
};

export default sim;
