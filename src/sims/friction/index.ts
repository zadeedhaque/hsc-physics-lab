import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num } from '../types';
import { frictionBlock } from '../../physics/dynamics';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const sim: SimDefinition = {
  camera: { position: [0, 3.2, 10.5], target: [0, 1, 0], aspect: 1.6 },
  hint: 'Increase the applied force slowly — the block stays put until F exceeds μsN.',
  params: [
    { kind: 'slider', key: 'm', label: 'Mass', unit: 'kg', min: 1, max: 50, step: 0.5, default: 10 },
    { kind: 'slider', key: 'F', label: 'Applied force', unit: 'N', min: 0, max: 400, step: 1, default: 60 },
    { kind: 'slider', key: 'muS', label: 'Coefficient of static friction μs', unit: '', min: 0, max: 1.2, step: 0.01, default: 0.5 },
    { kind: 'slider', key: 'muK', label: 'Coefficient of kinetic friction μk', unit: '', min: 0, max: 1.2, step: 0.01, default: 0.35, hint: 'Normally μk < μs' },
    { kind: 'slider', key: 'g', label: 'Gravity', unit: 'm/s²', min: 1, max: 25, step: 0.01, default: 9.81 },
    { kind: 'toggle', key: 'labels', label: 'Show force values', default: true },
  ],
  presets: [
    { label: 'Just holding', values: { m: 10, F: 48, muS: 0.5, muK: 0.35, g: 9.81 } },
    { label: 'Sliding', values: { m: 10, F: 80, muS: 0.5, muK: 0.35, g: 9.81 } },
    { label: 'Ice', values: { m: 10, F: 10, muS: 0.1, muK: 0.03, g: 9.81 } },
    { label: 'Rubber on concrete', values: { m: 10, F: 120, muS: 1.0, muK: 0.8, g: 9.81 } },
    { label: 'Frictionless', values: { m: 10, F: 20, muS: 0, muK: 0, g: 9.81 } },
  ],
  graphs: [
    { id: 'fF', title: 'Friction vs applied force', x: 'Applied force F (N)', y: 'friction f (N)', kind: 'curve', series: [{ label: 'f', color: C.friction }, { label: 'f = F', color: '#94a3b8', dashed: true }] },
    { id: 'va', title: 'Velocity & acceleration vs time', x: 't (s)', y: '', series: [{ label: 'v (m/s)', color: C.velocity }, { label: 'a (m/s²)', color: C.acceleration }], window: 10, zeroY: true },
  ],
  learn: {
    concept: 'Friction opposes sliding. While the block is at rest, static friction matches the applied force exactly — up to a limit μsN. Once the block slides, kinetic friction takes over with a constant value μkN, usually smaller than the static limit.',
    variables: [['N', 'normal reaction = mg (N)'], ['μs', 'coefficient of static friction'], ['μk', 'coefficient of kinetic friction'], ['f', 'friction force (N)'], ['a', 'acceleration (m/s²)']],
    observe: [
      'At rest, the red friction arrow grows with F — the block does not move.',
      'The moment F exceeds μsN the block breaks free and friction drops to μkN.',
      'Doubling the mass doubles N, and so doubles the maximum friction.',
      'Set F to 0 while sliding: kinetic friction decelerates the block to rest.',
    ],
    challenge: 'With m = 10 kg and μs = 0.5, find the smallest force that starts the block moving. Then predict the acceleration with μk = 0.35 before checking.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let x = 0, v = 0, t = 0;
    const sample = sampler(1 / 20);

    // Long floor with distance markers so motion is visible while the camera follows.
    const floor = kit.box(400, 0.3, 4, '#334155', { roughness: 0.95 });
    floor.position.set(150, -0.15, 0);
    for (let i = -10; i <= 300; i += 1) {
      const tick = kit.box(0.04, 0.01, i % 5 === 0 ? 0.8 : 0.35, '#64748b');
      tick.position.set(i, 0.006, 1.4);
      if (i % 5 === 0 && i >= 0) kit.label(`${i} m`, [i, 0, 2.1], { small: true });
    }
    const block = kit.box(1, 1, 1, '#7dd3fc', { roughness: 0.6 });
    const fArrow = kit.arrow(C.force, { label: 'F', radius: 0.05 });
    const frArrow = kit.arrow(C.friction, { label: 'f', radius: 0.05 });
    const nArrow = kit.arrow(C.normal, { label: 'N', radius: 0.05 });
    const wArrow = kit.arrow(C.weight, { label: 'W', radius: 0.05 });
    const aArrow = kit.arrow(C.acceleration, { label: 'a', radius: 0.04 });
    const state = kit.label('', [0, 0, 0]);

    const physics = () => frictionBlock({ m: num(p, 'm'), F: num(p, 'F'), muS: num(p, 'muS'), muK: num(p, 'muK'), g: num(p, 'g'), v });
    const side = () => 0.55 + 0.25 * Math.cbrt(num(p, 'm') / 10);

    function curve() {
      const N = num(p, 'm') * num(p, 'g');
      const fsMax = num(p, 'muS') * N, fk = num(p, 'muK') * N;
      const Fmax = Math.max(400, fsMax * 1.5);
      const b = graphs.get('fF');
      b.setSeries(0, [0, fsMax, fsMax, Fmax], [0, fsMax, fk, fk]);
      b.setSeries(1, [0, Math.min(Fmax, fsMax * 1.4)], [0, Math.min(Fmax, fsMax * 1.4)]);
      const r = physics();
      b.setMarkers([{ x: num(p, 'F'), y: Math.abs(r.friction), label: r.sliding ? 'sliding' : 'static', color: C.friction }]);
    }
    curve();

    return {
      setParams(np) { p = np; curve(); },
      reset() { x = 0; v = 0; t = 0; sample.reset(); kit.followX(0, 1); curve(); },
      step(dt) {
        const r = physics();
        const vNew = v + r.a * dt;
        // Kinetic friction can stop the block but never reverse it.
        if (v !== 0 && Math.sign(vNew) !== Math.sign(v) && Math.abs(num(p, 'F')) <= r.fsMax) v = 0;
        else v = vNew;
        x += v * dt;
        t += dt;
        if (sample.due(t)) { graphs.get('va').push(t, v, physics().a); curve(); }
      },
      render() {
        const s = side();
        block.scale.setScalar(s);
        block.position.set(x, s / 2, 0);
        const r = physics();
        const W = num(p, 'm') * num(p, 'g');
        const sc = 2.2 / Math.max(W, num(p, 'F'), 1); // arrow scale: biggest force ≈ 2.2 units
        const cx = x, cy = s / 2;
        fArrow.set([cx + s / 2, cy, 0], [num(p, 'F') * sc, 0, 0]);
        frArrow.set([cx - s / 2 * (r.friction < 0 ? 1 : -1), 0.08, 0.3], [r.friction * sc, 0, 0]);
        nArrow.set([cx, s, 0], [0, r.N * sc, 0]);
        wArrow.set([cx, cy, 0.01], [0, -W * sc, 0]);
        aArrow.set([cx, s + 0.35 + r.N * sc, 0], [Math.max(-2.5, Math.min(2.5, r.a * 0.25)), 0, 0]);
        const show = bool(p, 'labels');
        fArrow.label?.setText(show ? `F = ${n(num(p, 'F'))} N` : 'F');
        frArrow.label?.setText(show ? `f = ${n(Math.abs(r.friction))} N` : 'f');
        nArrow.label?.setText(show ? `N = ${n(r.N)} N` : 'N');
        wArrow.label?.setText(show ? `W = ${n(W)} N` : 'W');
        aArrow.label?.setText(show ? `a = ${n(r.a)} m/s²` : 'a');
        state.at([cx, -0.7, 1.8]).setText(r.sliding ? (v > 1e-9 ? 'Sliding — kinetic friction' : 'About to slide') : 'At rest — static friction');
        state.setColor(r.sliding ? C.friction : C.normal);
        kit.followX(x);
      },
      time: () => t,
      readouts(): Readout[] {
        const r = physics();
        return [
          { label: 'Normal force N', value: r.N, unit: 'N' },
          { label: 'Max static friction μsN', value: r.fsMax, unit: 'N' },
          { label: 'Friction acting', value: Math.abs(r.friction), unit: 'N', tone: 'accent' },
          { label: 'Friction type', value: r.sliding ? 'Kinetic' : 'Static' },
          { label: 'Net force', value: r.net, unit: 'N' },
          { label: 'Acceleration', value: r.a, unit: 'm/s²', tone: 'accent' },
          { label: 'Velocity', value: v, unit: 'm/s' },
          { label: 'Distance moved', value: x, unit: 'm' },
        ];
      },
      equations(): Equation[] {
        const r = physics();
        const m = num(p, 'm'), F = num(p, 'F');
        return [
          { expr: 'N = mg', sub: `N = ${n(m)} × ${n(num(p, 'g'))} = ${n(r.N)} N` },
          { expr: 'f_s ≤ μs N', sub: `f_s,max = ${n(num(p, 'muS'))} × ${n(r.N)} = ${n(r.fsMax)} N` },
          { expr: 'f_k = μk N', sub: `f_k = ${n(num(p, 'muK'))} × ${n(r.N)} = ${n(r.fk)} N` },
          { expr: 'a = (F − f) / m', sub: r.sliding ? `a = (${n(F)} − ${n(Math.abs(r.friction))}) / ${n(m)} = ${n(r.a)} m/s²` : `F ≤ μsN → a = 0` },
        ];
      },
    };
  },
};

export default sim;
