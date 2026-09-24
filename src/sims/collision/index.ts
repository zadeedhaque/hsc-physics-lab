import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { collide1D } from '../../physics/dynamics';
import { C, SERIES } from '../../engine/colors';
import { n, sampler } from '../shared';

const TRACK = 16; // metres of track shown (−8 … +8)

const sim: SimDefinition = {
  camera: { position: [0, 3.5, 12], target: [0, 0.6, 0], aspect: 1.7 },
  hint: 'Watch the total momentum line in the graph stay flat through the collision.',
  params: [
    { kind: 'select', key: 'type', label: 'Collision type', default: 'elastic', options: [
      { value: 'elastic', label: 'Elastic' }, { value: 'inelastic', label: 'Inelastic' }, { value: 'perfect', label: 'Perfectly inelastic' },
    ] },
    { kind: 'slider', key: 'e', label: 'Coefficient of restitution e', min: 0.05, max: 0.95, step: 0.05, default: 0.5, showIf: (p) => p.type === 'inelastic' },
    { kind: 'slider', key: 'm1', label: 'Mass m₁ (blue)', unit: 'kg', min: 0.5, max: 10, step: 0.5, default: 2 },
    { kind: 'slider', key: 'u1', label: 'Initial velocity u₁', unit: 'm/s', min: -6, max: 6, step: 0.1, default: 3 },
    { kind: 'slider', key: 'm2', label: 'Mass m₂ (pink)', unit: 'kg', min: 0.5, max: 10, step: 0.5, default: 2 },
    { kind: 'slider', key: 'u2', label: 'Initial velocity u₂', unit: 'm/s', min: -6, max: 6, step: 0.1, default: 0 },
  ],
  presets: [
    { label: 'Equal masses, elastic', values: { type: 'elastic', m1: 2, u1: 3, m2: 2, u2: 0 } },
    { label: 'Heavy hits light', values: { type: 'elastic', m1: 8, u1: 3, m2: 1, u2: 0 } },
    { label: 'Light hits heavy', values: { type: 'elastic', m1: 1, u1: 4, m2: 8, u2: 0 } },
    { label: 'Head-on', values: { type: 'elastic', m1: 3, u1: 3, m2: 3, u2: -3 } },
    { label: 'Stick together', values: { type: 'perfect', m1: 2, u1: 4, m2: 2, u2: 0 } },
  ],
  graphs: [
    { id: 'p', title: 'Momentum vs time', x: 't (s)', y: 'p (kg·m/s)', series: [{ label: 'p₁', color: SERIES[0] }, { label: 'p₂', color: SERIES[1] }, { label: 'total', color: SERIES[2] }], zeroY: true },
    { id: 'ke', title: 'Kinetic energy vs time', x: 't (s)', y: 'KE (J)', series: [{ label: 'KE₁', color: SERIES[0] }, { label: 'KE₂', color: SERIES[1] }, { label: 'total', color: SERIES[2] }], zeroY: true },
  ],
  learn: {
    concept: 'In every collision the total momentum of an isolated system is conserved. Kinetic energy is conserved only in an elastic collision; in inelastic collisions some becomes heat, sound and deformation. The coefficient of restitution e = (v₂ − v₁)/(u₁ − u₂) measures how “bouncy” the collision is.',
    variables: [['m₁, m₂', 'masses (kg)'], ['u₁, u₂', 'velocities before (m/s)'], ['v₁, v₂', 'velocities after (m/s)'], ['e', 'coefficient of restitution (1 elastic, 0 perfectly inelastic)']],
    observe: [
      'Equal masses in an elastic collision simply swap velocities.',
      'The total-momentum line is flat before and after the impact.',
      'Total KE drops at impact unless the collision is elastic.',
      'A light ball bounces back off a heavy one; a heavy ball barely slows.',
    ],
    challenge: 'In a perfectly inelastic collision with m₁ = m₂ and u₂ = 0, what fraction of the kinetic energy is lost? Predict it, then measure it.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let x1 = -4, x2 = 2, v1 = 0, v2 = 0, t = 0, collided = false, finished = false;
    const sample = sampler(1 / 30);

    const track = kit.box(TRACK + 2, 0.2, 1.6, '#334155', { roughness: 0.9 });
    track.position.y = -0.1;
    for (let i = -8; i <= 8; i += 1) {
      kit.box(0.03, 0.01, i % 2 === 0 ? 0.5 : 0.25, '#64748b').position.set(i, 0.006, 0.7);
      if (i % 2 === 0) kit.label(`${i}`, [i, -0.05, 1.15], { small: true });
    }
    kit.label('x (m)', [9, -0.05, 1.15], { small: true, className: 'plain' });
    const b1 = kit.sphere(1, C.force, { emissive: 0.15 });
    const b2 = kit.sphere(1, C.acceleration, { emissive: 0.15 });
    const a1 = kit.arrow(C.velocity, { label: 'v₁' });
    const a2 = kit.arrow(C.velocity, { label: 'v₂' });
    const l1 = kit.label('', [0, 0, 0], { color: C.force, small: true });
    const l2 = kit.label('', [0, 0, 0], { color: C.acceleration, small: true });
    const bang = kit.label('', [0, 2.4, 0], { color: C.weight });

    const e = () => (str(p, 'type') === 'elastic' ? 1 : str(p, 'type') === 'perfect' ? 0 : num(p, 'e'));
    const r = (m: number) => 0.28 * Math.cbrt(m);
    const result = () => collide1D(num(p, 'm1'), num(p, 'u1'), num(p, 'm2'), num(p, 'u2'), e());

    function reset() {
      const gap = r(num(p, 'm1')) + r(num(p, 'm2'));
      // Start positions so they meet near the middle.
      const u1 = num(p, 'u1'), u2 = num(p, 'u2');
      if (u1 - u2 > 0) {
        // Place the bodies so that they touch at the centre of the track after tMeet seconds.
        const tMeet = Math.min(1.5, 6.5 / Math.max(Math.abs(u1), Math.abs(u2), 1e-6));
        x1 = -gap / 2 - u1 * tMeet;
        x2 = gap / 2 - u2 * tMeet;
      } else { x1 = -2 - gap / 2; x2 = 2 + gap / 2; }
      v1 = u1; v2 = u2; t = 0; collided = false; finished = false; sample.reset();
      bang.setText('');
    }
    reset();

    return {
      setParams(np) { p = np; reset(); graphs.clearLive(); },
      reset,
      step(dt) {
        if (finished) return;
        const m1 = num(p, 'm1'), m2 = num(p, 'm2');
        x1 += v1 * dt; x2 += v2 * dt; t += dt;
        const gap = r(m1) + r(m2);
        if (!collided && x2 - x1 <= gap && v1 - v2 > 0) {
          const res = result();
          v1 = res.v1; v2 = res.v2; collided = true;
          x1 = Math.min(x1, x2 - gap);
          bang.at([(x1 + x2) / 2, 2.2, 0]).setText(str(p, 'type') === 'perfect' ? 'Stick!' : 'Impact');
        }
        if (collided && str(p, 'type') === 'perfect') x1 = x2 - gap;
        if (t > 12 || (Math.abs(x1) > 11 && Math.abs(x2) > 11) || (!collided && v1 - v2 <= 0 && t > 4)) finished = true;
        if (sample.due(t)) {
          graphs.get('p').push(t, m1 * v1, m2 * v2, m1 * v1 + m2 * v2);
          graphs.get('ke').push(t, 0.5 * m1 * v1 * v1, 0.5 * m2 * v2 * v2, 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2);
        }
      },
      render() {
        const m1 = num(p, 'm1'), m2 = num(p, 'm2');
        const r1 = r(m1), r2 = r(m2);
        b1.scale.setScalar(r1); b1.position.set(x1, r1, 0);
        b2.scale.setScalar(r2); b2.position.set(x2, r2, 0);
        a1.set([x1, 2 * r1 + 0.3, 0], [v1 * 0.4, 0, 0], `v₁ = ${n(v1)} m/s`);
        a2.set([x2, 2 * r2 + 0.3, 0], [v2 * 0.4, 0, 0], `v₂ = ${n(v2)} m/s`);
        l1.at([x1, -0.45, 0.9]).setText(`${m1} kg`);
        l2.at([x2, -0.45, 0.9]).setText(`${m2} kg`);
      },
      done: () => finished,
      time: () => t,
      readouts(): Readout[] {
        const res = result();
        const lossPct = res.keBefore > 0 ? (res.keLost / res.keBefore) * 100 : 0;
        if (num(p, 'u1') - num(p, 'u2') <= 0) return [
          { label: 'Status', value: 'Not approaching — no collision', tone: 'warn' },
          { label: 'Momentum (constant)', value: res.pBefore, unit: 'kg·m/s' },
          { label: 'KE (constant)', value: res.keBefore, unit: 'J' },
        ];
        return [
          { label: 'v₁ after', value: res.v1, unit: 'm/s', tone: 'accent' },
          { label: 'v₂ after', value: res.v2, unit: 'm/s', tone: 'accent' },
          { label: 'Momentum before', value: res.pBefore, unit: 'kg·m/s' },
          { label: 'Momentum after', value: res.pAfter, unit: 'kg·m/s' },
          { label: 'KE before', value: res.keBefore, unit: 'J' },
          { label: 'KE after', value: res.keAfter, unit: 'J' },
          { label: 'KE lost', value: lossPct, unit: '%', tone: lossPct > 0.01 ? 'warn' : 'good' },
          { label: 'Restitution e', value: e() },
          { label: 'Current v₁', value: v1, unit: 'm/s' },
          { label: 'Current v₂', value: v2, unit: 'm/s' },
        ];
      },
      equations(): Equation[] {
        const res = result();
        const m1 = num(p, 'm1'), m2 = num(p, 'm2'), u1 = num(p, 'u1'), u2 = num(p, 'u2');
        return [
          { expr: 'm₁u₁ + m₂u₂ = m₁v₁ + m₂v₂', sub: `${n(m1)}×${n(u1)} + ${n(m2)}×${n(u2)} = ${n(res.pBefore)} = ${n(res.pAfter)} kg·m/s` },
          { expr: 'e = (v₂ − v₁) / (u₁ − u₂)', sub: `e = ${n(e())}` },
          { expr: 'v₁ = [m₁u₁ + m₂u₂ + m₂e(u₂ − u₁)] / (m₁ + m₂)', sub: `v₁ = ${n(res.v1)} m/s` },
          { expr: 'v₂ = [m₁u₁ + m₂u₂ + m₁e(u₁ − u₂)] / (m₁ + m₂)', sub: `v₂ = ${n(res.v2)} m/s` },
          { expr: 'ΔKE = KE_before − KE_after', sub: `ΔKE = ${n(res.keLost)} J` },
        ];
      },
    };
  },
};

export default sim;
