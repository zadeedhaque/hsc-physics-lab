import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { C } from '../../engine/colors';
import { distanceTrack, n, sampler } from '../shared';

const sim: SimDefinition = {
  camera: { position: [0, 3, 10], target: [0, 0.5, 0], aspect: 1.7 },
  hint: 'After the push, no forward force acts. Set μ = 0 and the puck never slows down.',
  params: [
    { kind: 'slider', key: 'u', label: 'Speed after the push', unit: 'm/s', min: 0.5, max: 10, step: 0.1, default: 4 },
    { kind: 'slider', key: 'mu', label: 'Friction coefficient μ', min: 0, max: 0.5, step: 0.005, default: 0.05, decimals: 3 },
    { kind: 'slider', key: 'm', label: 'Mass', unit: 'kg', min: 0.1, max: 10, step: 0.1, default: 2 },
    { kind: 'slider', key: 'g', label: 'Gravity', unit: 'm/s²', min: 1, max: 25, step: 0.01, default: 9.81 },
  ],
  presets: [
    { label: 'Ideal ice (μ = 0)', values: { mu: 0, u: 4 } },
    { label: 'Air-hockey table', values: { mu: 0.01, u: 4 } },
    { label: 'Wooden floor', values: { mu: 0.2, u: 4 } },
    { label: 'Rough carpet', values: { mu: 0.45, u: 4 } },
  ],
  graphs: [
    { id: 'v', title: 'Velocity vs time', x: 't (s)', y: 'v (m/s)', zeroY: true, series: [{ label: 'v', color: C.velocity }] },
  ],
  learn: {
    concept: 'Newton’s first law (law of inertia): a body stays at rest or keeps moving in a straight line at constant speed unless a net external force acts on it. Everyday objects slow down only because friction or air resistance acts on them.',
    variables: [['F_net', 'net external force (N)'], ['μ', 'coefficient of friction'], ['v', 'velocity (m/s)'], ['m', 'mass (kg) — measure of inertia']],
    observe: [
      'With μ = 0 the velocity–time graph is a flat line: no force, no change in velocity.',
      'Any friction makes the line slope down: friction is the net force.',
      'The mass does not change how quickly friction stops the puck (both friction and inertia scale with m).',
    ],
    challenge: 'With u = 4 m/s, what μ makes the puck stop after exactly 8 m? Use v² = u² − 2μgs.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, x = 0, v = 0, stopped = false;
    const sample = sampler(1 / 20);
    distanceTrack(kit, -10, 320, { color: '#1e3a5f' });
    const puck = kit.cylinder(0.45, 0.45, 0.25, C.acceleration, { emissive: 0.15 });
    const vArrow = kit.arrow(C.velocity, { label: 'v' });
    const fArrow = kit.arrow(C.friction, { label: 'f' });
    const note = kit.label('', [0, 1.8, 0]);

    const reset = () => { t = 0; x = 0; v = num(p, 'u'); stopped = false; sample.reset(); kit.followX(0, 1); };
    reset();
    const decel = () => num(p, 'mu') * num(p, 'g');

    return {
      setParams(np) { p = np; graphs.clearLive(); reset(); },
      reset,
      step(dt) {
        if (stopped) return;
        t += dt;
        const a = decel();
        const vNew = v - a * dt;
        if (vNew <= 0) { x += (v * v) / (2 * Math.max(a, 1e-12)); v = 0; stopped = true; }
        else { x += 0.5 * (v + vNew) * dt; v = vNew; }
        if (t > 40 || x > 300) stopped = true;
        if (sample.due(t) || stopped) graphs.get('v').push(t, v);
      },
      render() {
        puck.position.set(x, 0.13, 0);
        vArrow.set([x, 0.5, 0], [Math.min(3, v * 0.35), 0, 0], `v = ${n(v)} m/s`);
        const f = num(p, 'mu') * num(p, 'm') * num(p, 'g');
        fArrow.set([x - 0.45, 0.13, 0.5], [v > 0 ? -Math.min(2, 0.2 + f * 0.05) : 0, 0, 0], `f = ${n(v > 0 ? f : 0)} N`);
        note.at([x, 1.6, 0]).setText(v > 0 && num(p, 'mu') === 0 ? 'No net force → constant velocity' : v > 0 ? 'Friction is the only horizontal force' : 'At rest');
        kit.followX(x + 2);
      },
      done: () => stopped,
      time: () => t,
      readouts(): Readout[] {
        const a = decel();
        return [
          { label: 'Net force', value: v > 0 ? -num(p, 'mu') * num(p, 'm') * num(p, 'g') : 0, unit: 'N', tone: 'accent' },
          { label: 'Acceleration', value: v > 0 ? -a : 0, unit: 'm/s²' },
          { label: 'Velocity', value: v, unit: 'm/s', tone: 'accent' },
          { label: 'Distance', value: x, unit: 'm' },
          { label: 'Predicted stopping distance', value: a > 0 ? (num(p, 'u') ** 2) / (2 * a) : 'never stops', unit: a > 0 ? 'm' : undefined },
        ];
      },
      equations(): Equation[] {
        const a = decel();
        return [
          { expr: 'F_net = 0  ⇒  v = constant', note: 'Newton’s first law.' },
          { expr: 'f = μ m g ,  a = −μ g', sub: `a = −${n(num(p, 'mu'))} × ${n(num(p, 'g'))} = ${n(-a)} m/s²` },
          { expr: 's_stop = u² / 2μg', sub: a > 0 ? `= ${n(num(p, 'u'))}² / (2 × ${n(a)}) = ${n(num(p, 'u') ** 2 / (2 * a))} m` : 'μ = 0 → infinite' },
        ];
      },
    };
  },
};

export default sim;
