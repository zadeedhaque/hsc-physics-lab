import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { C, SERIES } from '../../engine/colors';
import { cart, n, sampler } from '../shared';

const sim: SimDefinition = {
  camera: { position: [0, 3.5, 13], target: [0, 0.8, 0], aspect: 1.7 },
  startPaused: true,
  hint: 'Press Play to release the spring. Before and after, the total momentum is exactly zero.',
  params: [
    { kind: 'select', key: 'scenario', label: 'Scenario', default: 'carts', options: [{ value: 'carts', label: 'Carts + spring' }, { value: 'gun', label: 'Gun and bullet' }] },
    { kind: 'slider', key: 'm1', label: 'Mass of body 1 (left)', unit: 'kg', min: 0.5, max: 10, step: 0.1, default: 2, showIf: (p) => p.scenario === 'carts' },
    { kind: 'slider', key: 'm2', label: 'Mass of body 2 (right)', unit: 'kg', min: 0.5, max: 10, step: 0.1, default: 1, showIf: (p) => p.scenario === 'carts' },
    { kind: 'slider', key: 'E', label: 'Energy stored in the spring', unit: 'J', min: 1, max: 60, step: 1, default: 12, showIf: (p) => p.scenario === 'carts' },
    { kind: 'slider', key: 'M', label: 'Mass of gun', unit: 'kg', min: 1, max: 10, step: 0.1, default: 4, showIf: (p) => p.scenario === 'gun' },
    { kind: 'slider', key: 'mb', label: 'Mass of bullet', unit: 'g', min: 2, max: 50, step: 1, default: 10, showIf: (p) => p.scenario === 'gun' },
    { kind: 'slider', key: 'vb', label: 'Muzzle speed of bullet', unit: 'm/s', min: 50, max: 900, step: 10, default: 400, showIf: (p) => p.scenario === 'gun' },
  ],
  presets: [
    { label: 'Equal carts', values: { scenario: 'carts', m1: 2, m2: 2, E: 12 } },
    { label: 'Heavy + light cart', values: { scenario: 'carts', m1: 6, m2: 1, E: 12 } },
    { label: 'Rifle recoil', values: { scenario: 'gun', M: 4, mb: 10, vb: 800 } },
    { label: 'Light pistol', values: { scenario: 'gun', M: 1, mb: 8, vb: 350 } },
  ],
  graphs: [
    { id: 'p', title: 'Momentum vs time', x: 't (s)', y: 'p (kg·m/s)', zeroY: true, series: [{ label: 'p₁', color: SERIES[0] }, { label: 'p₂', color: SERIES[1] }, { label: 'total', color: SERIES[2] }] },
  ],
  learn: {
    concept: 'Momentum p = mv is a vector. When no external force acts on a system, its total momentum stays constant. In an explosion or recoil the system starts at rest, so afterwards the momenta of the parts are equal and opposite: m₁v₁ = −m₂v₂.',
    variables: [['p', 'momentum (kg·m/s)'], ['m₁, m₂', 'masses (kg)'], ['v₁, v₂', 'velocities after separation (m/s)'], ['E', 'energy released (J)']],
    observe: [
      'The two momentum lines are mirror images; the total stays on zero.',
      'The lighter body always moves faster.',
      'A gun recoils slowly because it is far heavier than the bullet — yet its momentum equals the bullet’s.',
    ],
    challenge: 'A 5 kg gun fires a 20 g bullet at 500 m/s. Predict the recoil speed, then set it up and check.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, x1 = -0.9, x2 = 0.9, v1 = 0, v2 = 0, released = false, finished = false;
    const sample = sampler(1 / 30);
    kit.box(40, 0.2, 3, '#334155').position.y = -0.1;
    const c1 = cart(kit, SERIES[0]);
    const c2 = cart(kit, SERIES[1]);
    const gun = kit.box(1.6, 0.4, 0.3, '#475569', { metalness: 0.6 });
    const barrel = kit.cylinder(0.07, 0.07, 1.3, '#94a3b8', { metalness: 0.7 });
    barrel.rotation.z = Math.PI / 2;
    const bullet = kit.sphere(0.08, C.weight, { emissive: 0.5 });
    const spring = kit.line('#e2e8f0', [], { width: 2.5 });
    const a1 = kit.arrow(C.momentum, { label: 'p₁' });
    const a2 = kit.arrow(C.momentum, { label: 'p₂' });

    const gunMode = () => str(p, 'scenario') === 'gun';
    function finals() {
      if (gunMode()) {
        const mb = num(p, 'mb') / 1000, vb = num(p, 'vb'), M = num(p, 'M');
        return { m1: M, m2: mb, v1: -(mb * vb) / M, v2: vb };
      }
      const m1 = num(p, 'm1'), m2 = num(p, 'm2'), E = num(p, 'E');
      const v2f = Math.sqrt((2 * E * m1) / (m2 * (m1 + m2)));
      return { m1, m2, v1: (-m2 * v2f) / m1, v2: v2f };
    }
    const reset = () => { t = 0; x1 = -0.9; x2 = 0.9; v1 = 0; v2 = 0; released = false; finished = false; sample.reset(); };
    reset();

    return {
      setParams(np) { p = np; graphs.clearLive(); reset(); },
      reset,
      step(dt) {
        if (finished) return;
        t += dt;
        if (!released && t > 0.3) { const f = finals(); v1 = f.v1; v2 = f.v2; released = true; }
        // show the bullet in slow motion: visual speed is scaled, momentum values are exact
        const visual2 = gunMode() ? 6 * Math.sign(v2) : v2;
        const visual1 = gunMode() ? v1 * (6 / Math.max(num(p, 'vb'), 1)) * 40 : v1;
        x1 += visual1 * dt; x2 += visual2 * dt;
        if (t > 6 || Math.abs(x1) > 18 || Math.abs(x2) > 18) finished = true;
        if (sample.due(t)) { const f = finals(); graphs.get('p').push(t, f.m1 * v1, f.m2 * v2, f.m1 * v1 + f.m2 * v2); }
      },
      render() {
        const g = gunMode();
        c1.group.visible = c2.group.visible = spring.visible = !g;
        gun.visible = barrel.visible = bullet.visible = g;
        const f = finals();
        if (g) {
          gun.position.set(x1, 1, 0); barrel.position.set(x1 + 1.3, 1.08, 0);
          bullet.position.set(released ? x2 + 1.2 : x1 + 1.95, 1.08, 0);
        } else {
          c1.group.position.x = x1 - 0.7; c2.group.position.x = x2 + 0.7;
          const gap = Math.max(0.05, x2 - x1);
          const pts: [number, number, number][] = [];
          const L = released ? 0.3 : gap;
          for (let i = 0; i <= 40; i++) pts.push([x2 - L + (L * i) / 40, 0.5 + 0.12 * Math.sin(i * 1.6), 0]);
          spring.setPoints(pts);
        }
        const sc = 0.5 / Math.max(Math.abs(f.m1 * f.v1), 1e-6);
        a1.set([g ? x1 : x1 - 0.7, 2.1, 0], [f.m1 * v1 * sc * 2, 0, 0], `p₁ = ${n(f.m1 * v1)}`);
        a2.set([g ? bullet.position.x : x2 + 0.7, 2.1, 0], [f.m2 * v2 * sc * 2, 0, 0], `p₂ = ${n(f.m2 * v2)}`);
      },
      done: () => finished,
      time: () => t,
      readouts(): Readout[] {
        const f = finals();
        return [
          { label: 'v₁ after', value: f.v1, unit: 'm/s', tone: 'accent' },
          { label: 'v₂ after', value: f.v2, unit: 'm/s', tone: 'accent' },
          { label: 'p₁ = m₁v₁', value: f.m1 * f.v1, unit: 'kg·m/s' },
          { label: 'p₂ = m₂v₂', value: f.m2 * f.v2, unit: 'kg·m/s' },
          { label: 'Total momentum', value: f.m1 * f.v1 + f.m2 * f.v2, unit: 'kg·m/s' },
          { label: 'KE of body 1', value: 0.5 * f.m1 * f.v1 ** 2, unit: 'J' },
          { label: 'KE of body 2', value: 0.5 * f.m2 * f.v2 ** 2, unit: 'J' },
        ];
      },
      equations(): Equation[] {
        const f = finals();
        return [
          { expr: 'p = m v' },
          { expr: 'm₁v₁ + m₂v₂ = 0  (system starts at rest)', sub: `${n(f.m1)}×(${n(f.v1)}) + ${n(f.m2)}×${n(f.v2)} = 0` },
          { expr: 'v₁ = − m₂ v₂ / m₁', sub: `v₁ = ${n(f.v1)} m/s` },
          ...(gunMode() ? [{ expr: 'Visual note', note: 'The bullet is shown in heavy slow motion; the numbers use the true speeds.' }] : [{ expr: '½m₁v₁² + ½m₂v₂² = E', sub: `= ${n(num(p, 'E'))} J` }]),
        ];
      },
    };
  },
};

export default sim;
