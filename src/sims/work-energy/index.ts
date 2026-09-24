import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { rad } from '../../lib/num';
import { C } from '../../engine/colors';
import { distanceTrack, n, sampler } from '../shared';

const G = 9.81;

const sim: SimDefinition = {
  camera: { position: [0, 3.2, 11], target: [0, 0.8, 0], aspect: 1.7 },
  hint: 'Only the component F cos θ along the motion does work. The vertical component just lightens the block.',
  params: [
    { kind: 'select', key: 'focus', label: 'Show', default: 'work', options: [{ value: 'work', label: 'Work' }, { value: 'theorem', label: 'Work–energy' }, { value: 'power', label: 'Power' }] },
    { kind: 'slider', key: 'F', label: 'Pulling force F', unit: 'N', min: 0, max: 100, step: 1, default: 40 },
    { kind: 'slider', key: 'angle', label: 'Angle of the rope θ', unit: '°', min: 0, max: 80, step: 1, default: 30 },
    { kind: 'slider', key: 'm', label: 'Mass', unit: 'kg', min: 1, max: 20, step: 0.5, default: 5 },
    { kind: 'slider', key: 'mu', label: 'Friction coefficient μ', min: 0, max: 0.6, step: 0.01, default: 0 },
    { kind: 'slider', key: 'S', label: 'Distance pulled s', unit: 'm', min: 1, max: 30, step: 0.5, default: 10 },
  ],
  presets: [
    { label: 'Horizontal pull', values: { angle: 0, mu: 0 } },
    { label: 'Pull at 60°', values: { angle: 60, mu: 0 } },
    { label: 'With friction', values: { angle: 30, mu: 0.2, focus: 'theorem' } },
    { label: 'Heavy block', values: { m: 18, F: 80, mu: 0.1 } },
  ],
  graphs: [
    { id: 'Ws', title: 'Energy vs distance', x: 's (m)', y: 'J', zeroY: true, series: [{ label: 'work by F', color: C.force }, { label: 'work by friction', color: C.friction }, { label: 'kinetic energy', color: C.velocity }] },
    { id: 'P', title: 'Power delivered by F vs time', x: 't (s)', y: 'P (W)', zeroY: true, series: [{ label: 'P = F v cos θ', color: C.hot }] },
  ],
  learn: {
    concept: 'Work is done when a force moves its point of application: W = Fs cos θ. The work–energy theorem says the net work done on a body equals its change in kinetic energy. Power is the rate of doing work, P = W/t = Fv cos θ.',
    variables: [['W', 'work (J)'], ['F', 'force (N)'], ['s', 'displacement (m)'], ['θ', 'angle between F and s'], ['P', 'power (W)'], ['KE', '½mv² (J)']],
    observe: [
      'At θ = 90° the force does no work at all.',
      'Friction does negative work; KE equals the sum of all the work done.',
      'Power grows as the block speeds up even though F is constant.',
    ],
    challenge: 'With F = 50 N and s = 10 m, find the angle at which the rope does exactly 250 J of work.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, x = 0, v = 0, wF = 0, wf = 0, finished = false;
    const sample = sampler(1 / 20);
    distanceTrack(kit, -5, 60);
    const block = kit.box(1, 0.8, 0.9, C.bodyAlt);
    const rope = kit.line('#e2e8f0', [], { width: 2 });
    const fArrow = kit.arrow(C.force, { label: 'F', radius: 0.05 });
    const fx = kit.arrow(C.force, { label: 'F cos θ', radius: 0.03, opacity: 0.7 });
    const fy = kit.arrow(C.force, { label: 'F sin θ', radius: 0.03, opacity: 0.7 });
    const fr = kit.arrow(C.friction, { label: 'f', radius: 0.04 });
    const finish = kit.box(0.08, 1.4, 1.2, C.normal, { opacity: 0.6 });

    const forces = () => {
      const F = num(p, 'F'), th = rad(num(p, 'angle')), m = num(p, 'm');
      const N = Math.max(0, m * G - F * Math.sin(th));
      const f = num(p, 'mu') * N;
      const drive = F * Math.cos(th);
      const moving = v > 1e-9 || drive > f;
      return { F, th, N, f: moving ? f : drive, drive, a: moving ? (drive - f) / m : 0, moving };
    };

    const reset = () => { t = 0; x = 0; v = 0; wF = 0; wf = 0; finished = false; sample.reset(); kit.followX(0, 1); };
    reset();

    return {
      setParams(np) { p = np; graphs.clearLive(); reset(); },
      reset,
      step(dt) {
        if (finished) return;
        const r = forces();
        const dx = v * dt + 0.5 * r.a * dt * dt;
        v = Math.max(0, v + r.a * dt);
        x += dx; t += dt;
        wF += r.drive * dx; wf -= (r.moving ? r.f : 0) * dx;
        if (x >= num(p, 'S')) finished = true;
        if (t > 30) finished = true;
        if (sample.due(t) || finished) {
          graphs.get('Ws').push(x, wF, wf, 0.5 * num(p, 'm') * v * v);
          graphs.get('P').push(t, r.drive * v);
        }
      },
      render() {
        const r = forces();
        block.position.set(x, 0.4, 0);
        finish.position.set(num(p, 'S') + 0.5, 0.7, 0);
        const hook: [number, number, number] = [x + 0.5, 0.5, 0];
        const L = 0.6 + (r.F / 100) * 2.2;
        const dir: [number, number, number] = [Math.cos(r.th), Math.sin(r.th), 0];
        rope.setPoints([hook, [hook[0] + dir[0] * (L + 0.4), hook[1] + dir[1] * (L + 0.4), 0]]);
        fArrow.set(hook, [dir[0] * L, dir[1] * L, 0], `F = ${n(r.F)} N`);
        fx.set([hook[0], hook[1], 0.3], [dir[0] * L, 0, 0], `F cos θ = ${n(r.drive)} N`);
        fy.set([hook[0], hook[1], 0.3], [0, dir[1] * L, 0], `F sin θ = ${n(r.F * Math.sin(r.th))} N`);
        fr.visible = r.f > 1e-6 && num(p, 'mu') > 0;
        fr.set([x - 0.5, 0.1, 0.5], [-(0.3 + (r.f / 100) * 2), 0, 0], `f = ${n(r.f)} N`);
        kit.followX(x + 2);
      },
      done: () => finished,
      time: () => t,
      readouts(): Readout[] {
        const r = forces();
        const KE = 0.5 * num(p, 'm') * v * v;
        const focus = str(p, 'focus');
        const base: Readout[] = [
          { label: 'Work by F (so far)', value: wF, unit: 'J', tone: focus === 'work' ? 'accent' : 'default' },
          { label: 'Work by friction', value: wf, unit: 'J' },
          { label: 'Net work', value: wF + wf, unit: 'J', tone: focus === 'theorem' ? 'accent' : 'default' },
          { label: 'Kinetic energy ½mv²', value: KE, unit: 'J', tone: focus === 'theorem' ? 'accent' : 'default' },
          { label: 'Power now P = Fv cos θ', value: r.drive * v, unit: 'W', tone: focus === 'power' ? 'accent' : 'default' },
          { label: 'Average power W/t', value: t > 0 ? wF / t : 0, unit: 'W' },
          { label: 'Distance moved', value: x, unit: 'm' },
          { label: 'Normal force', value: r.N, unit: 'N' },
        ];
        return base;
      },
      equations(): Equation[] {
        const r = forces();
        const S = num(p, 'S');
        const focus = str(p, 'focus');
        const out: Equation[] = [{ expr: 'W = F s cos θ', sub: `W = ${n(r.F)} × ${n(S)} × cos ${num(p, 'angle')}° = ${n(r.drive * S)} J (over the full ${n(S)} m)` }];
        if (focus !== 'work') out.push({ expr: 'W_net = ΔKE = ½mv² − ½mu²', sub: `${n(wF + wf)} J = ${n(0.5 * num(p, 'm') * v * v)} J` });
        if (focus === 'power') out.push({ expr: 'P = W / t = F v cos θ', sub: `P = ${n(r.drive)} × ${n(v)} = ${n(r.drive * v)} W` });
        out.push({ expr: 'N = mg − F sin θ ,  f = μN', sub: `N = ${n(r.N)} N, f = ${n(num(p, 'mu') * r.N)} N` });
        return out;
      },
    };
  },
};

export default sim;
