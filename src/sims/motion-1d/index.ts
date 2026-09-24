import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { C } from '../../engine/colors';
import { cart, distanceTrack, n, sampler } from '../shared';

type Profile = 'uniform' | 'accel' | 'decel' | 'trip';

const sim: SimDefinition = {
  camera: { position: [0, 3.2, 11], target: [0, 0.6, 0], aspect: 1.7 },
  hint: 'Dots are dropped every 0.5 s (a ticker tape): equal gaps mean constant velocity, growing gaps mean acceleration.',
  params: [
    { kind: 'select', key: 'profile', label: 'Type of motion', default: 'accel', options: [
      { value: 'uniform', label: 'Uniform' }, { value: 'accel', label: 'Accelerating' }, { value: 'decel', label: 'Braking' }, { value: 'trip', label: 'Full trip' },
    ] },
    { kind: 'slider', key: 'u', label: 'Initial velocity u', unit: 'm/s', min: 0, max: 20, step: 0.5, default: 2, showIf: (p) => p.profile !== 'trip' },
    { kind: 'slider', key: 'a', label: 'Acceleration a', unit: 'm/s²', min: 0, max: 6, step: 0.1, default: 1.5, showIf: (p) => p.profile === 'accel' || p.profile === 'trip' },
    { kind: 'slider', key: 'b', label: 'Deceleration (braking)', unit: 'm/s²', min: 0.2, max: 8, step: 0.1, default: 2, showIf: (p) => p.profile === 'decel' || p.profile === 'trip' },
    { kind: 'slider', key: 'vmax', label: 'Cruising speed', unit: 'm/s', min: 1, max: 20, step: 0.5, default: 8, showIf: (p) => p.profile === 'trip' },
    { kind: 'slider', key: 'tc', label: 'Cruise time', unit: 's', min: 0, max: 8, step: 0.5, default: 3, showIf: (p) => p.profile === 'trip' },
    { kind: 'slider', key: 'T', label: 'Run time', unit: 's', min: 2, max: 15, step: 0.5, default: 8, showIf: (p) => p.profile === 'uniform' || p.profile === 'accel' },
  ],
  presets: [
    { label: 'Walking (uniform)', values: { profile: 'uniform', u: 1.5, T: 10 } },
    { label: 'Car pulling away', values: { profile: 'accel', u: 0, a: 3, T: 6 } },
    { label: 'Emergency stop', values: { profile: 'decel', u: 15, b: 6 } },
    { label: 'Bus between stops', values: { profile: 'trip', a: 1.5, vmax: 10, tc: 4, b: 2 } },
  ],
  graphs: [
    { id: 'x', title: 'Displacement vs time', x: 't (s)', y: 'x (m)', zeroY: true, series: [{ label: 'x', color: C.x }] },
    { id: 'v', title: 'Velocity vs time (slope = a, area = displacement)', x: 't (s)', y: 'v (m/s)', zeroY: true, series: [{ label: 'v', color: C.velocity }] },
    { id: 'a', title: 'Acceleration vs time', x: 't (s)', y: 'a (m/s²)', zeroY: true, series: [{ label: 'a', color: C.acceleration }] },
  ],
  learn: {
    concept: 'Motion along a straight line is described by displacement x, velocity v = dx/dt and acceleration a = dv/dt. For constant acceleration the three equations of motion connect u, v, a, s and t. On graphs, the slope of x–t is velocity, the slope of v–t is acceleration, and the area under v–t is displacement.',
    variables: [['u', 'initial velocity (m/s)'], ['v', 'velocity at time t (m/s)'], ['a', 'acceleration (m/s²)'], ['s', 'displacement (m)'], ['t', 'time (s)']],
    observe: [
      'Uniform motion: straight x–t line, flat v–t line, zero a.',
      'Constant acceleration: x–t is a parabola and v–t a straight sloping line.',
      'While braking, the ticker-tape gaps shrink until the cart stops.',
      'In the full trip, the area under the v–t graph equals the distance travelled.',
    ],
    challenge: 'A car starts from rest with a = 2 m/s². How long does it take to cover 36 m? Predict with s = ½at², then check.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, x = 0, v = 0, a = 0, finished = false, nextDot = 0;
    const sample = sampler(1 / 30);
    distanceTrack(kit, -10, 320);
    const car = cart(kit, C.bodyAlt);
    const vArrow = kit.arrow(C.velocity, { label: 'v' });
    const aArrow = kit.arrow(C.acceleration, { label: 'a' });
    const dots = kit.add(new THREE.Group());

    const profile = () => str(p, 'profile') as Profile;
    /** Exact kinematic state at time tt for the chosen profile. */
    function stateAt(tt: number) {
      const pr = profile();
      if (pr === 'uniform') return { x: num(p, 'u') * tt, v: num(p, 'u'), a: 0, end: num(p, 'T') };
      if (pr === 'accel') { const u = num(p, 'u'), ac = num(p, 'a'); return { x: u * tt + 0.5 * ac * tt * tt, v: u + ac * tt, a: ac, end: num(p, 'T') }; }
      if (pr === 'decel') {
        const u = num(p, 'u'), b = num(p, 'b');
        const tStop = u / b;
        const tc = Math.min(tt, tStop);
        return { x: u * tc - 0.5 * b * tc * tc, v: Math.max(0, u - b * tt), a: tt < tStop ? -b : 0, end: tStop + 1 };
      }
      const ac = Math.max(num(p, 'a'), 0.05), b = num(p, 'b'), vm = num(p, 'vmax'), tc = num(p, 'tc');
      const t1 = vm / ac, t2 = t1 + tc, t3 = t2 + vm / b;
      if (tt <= t1) return { x: 0.5 * ac * tt * tt, v: ac * tt, a: ac, end: t3 + 1 };
      const x1 = 0.5 * ac * t1 * t1;
      if (tt <= t2) return { x: x1 + vm * (tt - t1), v: vm, a: 0, end: t3 + 1 };
      const x2 = x1 + vm * tc;
      const td = Math.min(tt, t3) - t2;
      return { x: x2 + vm * td - 0.5 * b * td * td, v: Math.max(0, vm - b * (tt - t2)), a: tt < t3 ? -b : 0, end: t3 + 1 };
    }

    function reset() {
      t = 0; finished = false; nextDot = 0; sample.reset();
      const s = stateAt(0); x = s.x; v = s.v; a = s.a;
      kit.clearGroup(dots);
      kit.followX(0, 1);
    }
    reset();

    return {
      setParams(np) { p = np; graphs.clearLive(); reset(); },
      reset,
      step(dt) {
        if (finished) return;
        t += dt;
        const s = stateAt(t);
        x = s.x; v = s.v; a = s.a;
        if (t >= s.end) finished = true;
        if (t >= nextDot) {
          nextDot += 0.5;
          const d = kit.sphere(0.06, C.weight, { emissive: 0.6 }, 10);
          d.position.set(x, 0.02, 0.9);
          dots.add(d);
        }
        if (sample.due(t)) { graphs.get('x').push(t, x); graphs.get('v').push(t, v); graphs.get('a').push(t, a); }
      },
      render() {
        car.group.position.x = x;
        vArrow.set([x, car.height + 0.5, 0], [Math.min(v * 0.3, 5), 0, 0], `v = ${n(v)} m/s`);
        aArrow.set([x, car.height + 1.1, 0], [Math.max(-3, Math.min(3, a * 0.5)), 0, 0], `a = ${n(a)} m/s²`);
        kit.followX(x + 2);
      },
      done: () => finished,
      time: () => t,
      readouts(): Readout[] {
        return [
          { label: 'Time t', value: t, unit: 's' },
          { label: 'Displacement x', value: x, unit: 'm', tone: 'accent' },
          { label: 'Velocity v', value: v, unit: 'm/s', tone: 'accent' },
          { label: 'Acceleration a', value: a, unit: 'm/s²' },
          { label: 'Average velocity x/t', value: t > 0 ? x / t : v, unit: 'm/s' },
        ];
      },
      equations(): Equation[] {
        const pr = profile();
        if (pr === 'uniform') return [{ expr: 'x = v t', sub: `x = ${n(num(p, 'u'))} × ${n(t)} = ${n(x)} m` }, { expr: 'a = 0' }];
        const u = pr === 'trip' ? 0 : num(p, 'u');
        const ac = pr === 'decel' ? -num(p, 'b') : num(p, 'a');
        const out: Equation[] = [
          { expr: 'v = u + a t', sub: pr === 'trip' ? `piecewise: accelerate, cruise at ${n(num(p, 'vmax'))} m/s, brake` : `v = ${n(u)} + (${n(ac)}) × ${n(t)} = ${n(v)} m/s` },
          { expr: 's = u t + ½ a t²', sub: pr === 'trip' ? `s = area under v–t = ${n(x)} m` : `s = ${n(x)} m` },
          { expr: 'v² = u² + 2 a s' },
        ];
        if (pr === 'decel') out.push({ expr: 'Stopping distance s = u² / 2b', sub: `= ${n(u)}² / (2 × ${n(num(p, 'b'))}) = ${n((u * u) / (2 * num(p, 'b')))} m` });
        return out;
      },
    };
  },
};

export default sim;
