import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { C } from '../../engine/colors';
import { cart, distanceTrack, n, sampler } from '../shared';

const sim: SimDefinition = {
  camera: { position: [0, 3.2, 11], target: [0, 0.8, 0], aspect: 1.7 },
  hint: 'Record trials in Experiment mode: keep the force fixed and double the mass — the acceleration halves.',
  params: [
    { kind: 'slider', key: 'F', label: 'Applied force F', unit: 'N', min: 0, max: 50, step: 0.5, default: 10 },
    { kind: 'slider', key: 'm', label: 'Mass m', unit: 'kg', min: 0.5, max: 20, step: 0.5, default: 2 },
    { kind: 'slider', key: 'mu', label: 'Friction coefficient μ', min: 0, max: 0.5, step: 0.01, default: 0 },
  ],
  presets: [
    { label: '10 N on 2 kg', values: { F: 10, m: 2, mu: 0 } },
    { label: '10 N on 4 kg', values: { F: 10, m: 4, mu: 0 } },
    { label: '20 N on 2 kg', values: { F: 20, m: 2, mu: 0 } },
    { label: 'With friction', values: { F: 20, m: 4, mu: 0.2 } },
  ],
  graphs: [
    { id: 'v', title: 'Velocity vs time (slope = a)', x: 't (s)', y: 'v (m/s)', zeroY: true, series: [{ label: 'v', color: C.velocity }] },
    { id: 'aF', title: 'Acceleration vs applied force (current mass)', x: 'F (N)', y: 'a (m/s²)', kind: 'curve', zeroY: true, series: [{ label: 'a = F_net / m', color: C.acceleration }] },
  ],
  learn: {
    concept: 'Newton’s second law: the rate of change of momentum equals the net force, so for constant mass F_net = ma. The acceleration is proportional to the net force and inversely proportional to the mass.',
    variables: [['F', 'applied force (N)'], ['m', 'mass (kg)'], ['a', 'acceleration (m/s²)'], ['f', 'friction μmg (N)'], ['p', 'momentum mv (kg·m/s)']],
    observe: [
      'The v–t graph is a straight line whose slope equals F/m.',
      'Doubling F doubles a; doubling m halves a.',
      'With friction the cart only moves once F exceeds μmg, and a = (F − μmg)/m.',
    ],
    challenge: 'Using Experiment mode, record a for m = 1, 2, 4 and 8 kg at F = 16 N. Plot a against 1/m — what do you get?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, x = 0, v = 0, finished = false;
    const sample = sampler(1 / 20);
    distanceTrack(kit, -10, 400);
    const c = cart(kit, C.bodyAlt);
    const weights = kit.add(new THREE.Group());
    const fArrow = kit.arrow(C.force, { label: 'F', radius: 0.05 });
    const frArrow = kit.arrow(C.friction, { label: 'f', radius: 0.04 });
    const aArrow = kit.arrow(C.acceleration, { label: 'a' });

    const net = () => {
      const F = num(p, 'F'), f = num(p, 'mu') * num(p, 'm') * 9.81;
      if (v <= 1e-9 && F <= f) return { net: 0, f: F, a: 0 };
      return { net: F - f, f, a: (F - f) / num(p, 'm') };
    };

    function drawWeights() {
      kit.clearGroup(weights);
      const count = Math.min(20, Math.round(num(p, 'm') / 1));
      for (let i = 0; i < count; i++) {
        const b = kit.box(0.28, 0.18, 0.28, '#94a3b8', { metalness: 0.5 });
        b.position.set(-0.45 + (i % 4) * 0.3, c.height + 0.1 + Math.floor(i / 4) * 0.19, 0);
        weights.add(b);
      }
      graphs.get('aF').plot(0, 0, 50, (F) => Math.max(0, F - num(p, 'mu') * num(p, 'm') * 9.81) / num(p, 'm'), 200);
      graphs.get('aF').setMarkers([{ x: num(p, 'F'), y: net().a, color: C.acceleration }]);
    }

    const reset = () => { t = 0; x = 0; v = 0; finished = false; sample.reset(); kit.followX(0, 1); drawWeights(); };
    reset();

    return {
      setParams(np) { p = np; drawWeights(); },
      reset,
      step(dt) {
        if (finished) return;
        const a = net().a;
        x += v * dt + 0.5 * a * dt * dt;
        v += a * dt;
        t += dt;
        if (t > 20 || x > 380) finished = true;
        if (sample.due(t)) graphs.get('v').push(t, v);
      },
      render() {
        c.group.position.x = x;
        weights.position.x = x;
        const r = net();
        fArrow.set([x + 0.7, c.height / 2 + 0.1, 0], [Math.min(4, 0.3 + num(p, 'F') * 0.07), 0, 0], `F = ${n(num(p, 'F'))} N`);
        fArrow.visible = num(p, 'F') > 0;
        frArrow.visible = r.f > 0;
        frArrow.set([x - 0.7, 0.2, 0.5], [-Math.min(3, 0.2 + r.f * 0.07), 0, 0], `f = ${n(r.f)} N`);
        aArrow.set([x, c.height + 1.5, 0], [Math.min(4, r.a * 0.3), 0, 0], `a = ${n(r.a)} m/s²`);
        kit.followX(x + 2);
      },
      done: () => finished,
      time: () => t,
      readouts(): Readout[] {
        const r = net();
        return [
          { label: 'Mass', value: num(p, 'm'), unit: 'kg' },
          { label: 'Force', value: num(p, 'F'), unit: 'N' },
          { label: 'Net force', value: r.net, unit: 'N' },
          { label: 'Acceleration', value: r.a, unit: 'm/s²', tone: 'accent' },
          { label: 'Velocity', value: v, unit: 'm/s' },
          { label: 'Momentum p = mv', value: num(p, 'm') * v, unit: 'kg·m/s' },
          { label: 'Distance', value: x, unit: 'm' },
        ];
      },
      equations(): Equation[] {
        const r = net();
        return [
          { expr: 'F_net = m a', sub: `a = ${n(r.net)} / ${n(num(p, 'm'))} = ${n(r.a)} m/s²` },
          { expr: 'F_net = F − μ m g', sub: `= ${n(num(p, 'F'))} − ${n(num(p, 'mu') * num(p, 'm') * 9.81)} = ${n(r.net)} N` },
          { expr: 'F = dp/dt', note: 'The general form; reduces to F = ma when mass is constant.' },
        ];
      },
    };
  },
};

export default sim;
