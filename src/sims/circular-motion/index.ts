import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { circular } from '../../physics/kinematics';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const sim: SimDefinition = {
  camera: { position: [0, 9, 9], target: [0, 0, 0], aspect: 1.3 },
  hint: 'Cut the string and the ball flies off along the tangent — the direction of its velocity at that instant.',
  params: [
    { kind: 'slider', key: 'r', label: 'Radius', unit: 'm', min: 0.3, max: 3, step: 0.05, default: 2 },
    { kind: 'slider', key: 'v', label: 'Speed', unit: 'm/s', min: 0, max: 12, step: 0.1, default: 4 },
    { kind: 'slider', key: 'm', label: 'Mass', unit: 'kg', min: 0.1, max: 5, step: 0.1, default: 1 },
  ],
  presets: [
    { label: 'Slow & wide', values: { r: 2.5, v: 2 } },
    { label: 'Fast & tight', values: { r: 0.8, v: 8 } },
    { label: 'Double speed', values: { r: 2, v: 8 } },
    { label: 'Half radius', values: { r: 1, v: 4 } },
  ],
  graphs: [
    { id: 'xy', title: 'x and y components of position vs time', x: 't (s)', y: 'm', window: 6, zeroY: true, series: [{ label: 'x', color: C.x }, { label: 'y', color: C.y }] },
    { id: 'F', title: 'Centripetal force vs speed (current radius)', x: 'v (m/s)', y: 'F (N)', kind: 'curve', zeroY: true, series: [{ label: 'F = mv²/r', color: C.force }] },
  ],
  learn: {
    concept: 'A body moving in a circle at constant speed is still accelerating, because its direction keeps changing. The acceleration v²/r points to the centre, and a net inward (centripetal) force mv²/r must act — here provided by the string tension.',
    variables: [['r', 'radius (m)'], ['v', 'speed (m/s)'], ['ω', 'angular velocity v/r (rad/s)'], ['T', 'period 2πr/v (s)'], ['a_c', 'centripetal acceleration v²/r'], ['F_c', 'centripetal force mv²/r']],
    observe: [
      'The velocity arrow is always tangent; the force arrow always points to the centre.',
      'Doubling the speed quadruples the force needed.',
      'Halving the radius at the same speed doubles the force.',
      'Released, the ball moves in a straight line (Newton’s first law).',
    ],
    challenge: 'Find the speed at which a 0.5 kg ball on a 1.2 m string needs a tension of exactly 15 N.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, theta = 0, released = false, relPos = { x: 0, z: 0 }, relV = { x: 0, z: 0 };
    const sample = sampler(1 / 30);
    kit.grid(12, 12, 'xz', -0.5);
    const post = kit.cylinder(0.1, 0.1, 1, '#94a3b8');
    post.position.y = -0.2;
    const orbit = kit.line('#64748b', [], { dashed: true, width: 1.2 });
    const ball = kit.sphere(0.2, C.bodyAlt, { emissive: 0.2 });
    const string = kit.line('#e2e8f0', [], { width: 2 });
    const vArrow = kit.arrow(C.velocity, { label: 'v' });
    const fArrow = kit.arrow(C.force, { label: 'T = F_c' });
    const trail = kit.trail(C.weight, 300);

    function drawOrbit() {
      const r = num(p, 'r');
      const pts: [number, number, number][] = [];
      for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; pts.push([r * Math.cos(a), 0, -r * Math.sin(a)]); }
      orbit.setPoints(pts);
      graphs.get('F').plot(0, 0, 12, (v) => (num(p, 'm') * v * v) / r, 100);
      graphs.get('F').setMarkers([{ x: num(p, 'v'), y: circular(r, num(p, 'v'), num(p, 'm')).Fc, color: C.force }]);
    }
    drawOrbit();

    function reset() { t = 0; theta = 0; released = false; trail.clearPoints(); sample.reset(); }

    return {
      setParams(np) { p = np; drawOrbit(); },
      reset,
      step(dt) {
        t += dt;
        const r = num(p, 'r'), v = num(p, 'v');
        if (!released) {
          theta += (v / r) * dt;
          if (sample.due(t)) graphs.get('xy').push(t, r * Math.cos(theta), r * Math.sin(theta));
        } else {
          relPos.x += relV.x * dt; relPos.z += relV.z * dt;
          trail.push([relPos.x, 0, relPos.z]);
        }
      },
      render() {
        const r = num(p, 'r'), v = num(p, 'v');
        const c = circular(r, v, num(p, 'm'));
        if (!released) {
          const x = r * Math.cos(theta), z = -r * Math.sin(theta);
          ball.position.set(x, 0, z);
          string.setPoints([[0, 0, 0], [x, 0, z]]);
          string.visible = true;
          vArrow.set(ball.position, [-Math.sin(theta) * v * 0.25, 0, -Math.cos(theta) * v * 0.25], `v = ${n(v)} m/s`);
          const fl = Math.min(2.5, 0.3 + c.Fc * 0.05);
          fArrow.set(ball.position, [(-x / r) * fl, 0, (-z / r) * fl], `F = ${n(c.Fc)} N`);
        } else {
          ball.position.set(relPos.x, 0, relPos.z);
          string.visible = false;
          fArrow.visible = false;
          vArrow.set(ball.position, [relV.x * 0.25, 0, relV.z * 0.25], `v = ${n(v)} m/s`);
          trail.flush();
        }
      },
      done: () => released && Math.hypot(relPos.x, relPos.z) > 9,
      time: () => t,
      actions: () => [released
        ? { id: 'reattach', label: 'Reattach string', primary: true, run: reset }
        : { id: 'cut', label: 'Cut the string', primary: true, run: () => {
          const r = num(p, 'r'), v = num(p, 'v');
          released = true;
          relPos = { x: r * Math.cos(theta), z: -r * Math.sin(theta) };
          relV = { x: -Math.sin(theta) * v, z: -Math.cos(theta) * v };
        } }],
      readouts(): Readout[] {
        const c = circular(num(p, 'r'), num(p, 'v'), num(p, 'm'));
        const moving = num(p, 'v') > 0;
        return [
          { label: 'Angular velocity ω', value: c.omega, unit: 'rad/s' },
          { label: 'Period T', value: moving ? c.period : 'no motion', unit: moving ? 's' : undefined },
          { label: 'Frequency f', value: c.frequency, unit: 'Hz' },
          { label: 'Centripetal acceleration', value: c.ac, unit: 'm/s²', tone: 'accent' },
          { label: 'Centripetal force (tension)', value: c.Fc, unit: 'N', tone: 'accent' },
          { label: 'State', value: released ? 'String cut — straight-line motion' : 'Circular motion' },
        ];
      },
      equations(): Equation[] {
        const r = num(p, 'r'), v = num(p, 'v'), m = num(p, 'm');
        const c = circular(r, v, m);
        return [
          { expr: 'ω = v / r', sub: `ω = ${n(v)} / ${n(r)} = ${n(c.omega)} rad/s` },
          { expr: 'a_c = v² / r = ω² r', sub: `a_c = ${n(v)}² / ${n(r)} = ${n(c.ac)} m/s²` },
          { expr: 'F_c = m v² / r', sub: `F_c = ${n(m)} × ${n(v)}² / ${n(r)} = ${n(c.Fc)} N` },
          { expr: 'T = 2πr / v ,  f = 1/T', sub: v > 0 ? `T = ${n(c.period)} s` : 'v = 0: no rotation' },
        ];
      },
    };
  },
};

export default sim;
