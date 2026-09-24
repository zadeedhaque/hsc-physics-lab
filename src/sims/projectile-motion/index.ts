import * as THREE from 'three';
import type { SimDefinition, Params, Equation } from '../types';
import { num, bool } from '../types';
import { projectile, projectileAt, stepDrag, dragTrajectory, type State2D } from '../../physics/kinematics';
import { rad } from '../../lib/num';
import { C } from '../../engine/colors';
import { ground, ruler, n, sampler } from '../shared';

const sim: SimDefinition = {
  camera: { position: [9, 6.5, 21], target: [9, 4.8, 0] },
  startPaused: false,
  hint: 'Without air resistance the mass has no effect — switch on drag to see why heavy balls fly further.',
  params: [
    { kind: 'slider', key: 'u', label: 'Initial velocity', unit: 'm/s', min: 1, max: 60, step: 0.5, default: 24 },
    { kind: 'slider', key: 'angle', label: 'Launch angle', unit: '°', min: 0, max: 90, step: 1, default: 45 },
    { kind: 'slider', key: 'h0', label: 'Initial height', unit: 'm', min: 0, max: 60, step: 0.5, default: 0 },
    { kind: 'slider', key: 'g', label: 'Gravity', unit: 'm/s²', min: 1, max: 25, step: 0.01, default: 9.81, hint: 'Earth 9.81 · Moon 1.62 · Mars 3.71 · Jupiter 24.79' },
    { kind: 'slider', key: 'm', label: 'Mass', unit: 'kg', min: 0.05, max: 10, step: 0.05, default: 0.45 },
    { kind: 'toggle', key: 'drag', label: 'Air resistance', default: false, hint: 'Quadratic drag F = b v²' },
    { kind: 'slider', key: 'b', label: 'Drag constant b', unit: 'kg/m', min: 0.0005, max: 0.02, step: 0.0005, default: 0.004, decimals: 4, showIf: (p) => p.drag === true },
    { kind: 'toggle', key: 'components', label: 'Show velocity components', default: true },
  ],
  presets: [
    { label: '45° Standard', values: { u: 24, angle: 45, h0: 0, drag: false } },
    { label: 'Maximum range', values: { u: 40, angle: 45, h0: 0, drag: false } },
    { label: 'High launch', values: { u: 30, angle: 75, h0: 0, drag: false } },
    { label: 'Low launch', values: { u: 30, angle: 15, h0: 0, drag: false } },
    { label: 'Cliff', values: { u: 18, angle: 20, h0: 35, drag: false } },
    { label: 'Horizontal', values: { u: 15, angle: 0, h0: 40, drag: false } },
    { label: 'With air drag', values: { u: 40, angle: 45, h0: 0, drag: true } },
  ],
  graphs: [
    { id: 'pos', title: 'Position vs time', x: 't (s)', y: 'm', series: [{ label: 'x', color: C.x }, { label: 'y', color: C.y }], zeroY: true },
    { id: 'vel', title: 'Velocity components vs time', x: 't (s)', y: 'm/s', series: [{ label: 'vₓ', color: C.x }, { label: 'v_y', color: C.y }], zeroY: true },
  ],
  learn: {
    concept: 'A projectile moves under gravity alone. Horizontally nothing pushes it, so vₓ stays constant; vertically it accelerates downward at g. The two motions are independent and combine into a parabola.',
    variables: [['u', 'launch speed (m/s)'], ['θ', 'launch angle above horizontal'], ['g', 'gravitational acceleration (m/s²)'], ['R', 'horizontal range (m)'], ['H', 'maximum height (m)'], ['T', 'time of flight (s)']],
    observe: [
      'The horizontal velocity arrow never changes length (without drag).',
      'At the top of the path v_y = 0 but the ball is still moving sideways.',
      'Angles that add to 90° (e.g. 30° and 60°) give the same range from ground level.',
      'With drag, the path is no longer symmetric and the best angle drops below 45°.',
    ],
    challenge: 'Set the angle to 45° and find the launch velocity required to reach a range of approximately 50 m. Then check it with R = u²/g.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let s: State2D = { x: 0, y: 0, vx: 0, vy: 0 };
    let t = 0;
    let landed = false;
    let scale = 1;
    let result = { tFlight: 0, range: 0, maxHeight: 0, vFinal: 0 };
    const sample = sampler(1 / 30);

    ground(kit, 70, 16, '#1e293b', 25);
    const rulerX = kit.add(new THREE.Group());
    const rulerY = kit.add(new THREE.Group());

    const tower = kit.box(1.2, 1, 1.2, '#334155', { roughness: 0.9 });
    const cannon = kit.add(new THREE.Group());
    const barrel = kit.cylinder(0.22, 0.28, 1.4, '#64748b', { metalness: 0.5, roughness: 0.4 });
    barrel.rotation.z = -Math.PI / 2;
    barrel.position.x = 0.5;
    cannon.add(barrel);
    const wheel = kit.cylinder(0.35, 0.35, 0.2, '#475569');
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(0, -0.2, 0.3);
    cannon.add(wheel);

    const ball = kit.sphere(0.32, '#f8fafc', { emissive: 0.15 });
    const predicted = kit.line(C.accent, [], { dashed: true, width: 2, opacity: 0.7, dashSize: 0.25, gapSize: 0.18 });
    const ideal = kit.line('#94a3b8', [], { dashed: true, width: 1.5, opacity: 0.45 });
    const trail = kit.trail(C.accent, 2000, { width: 3, opacity: 1 });
    const vArrow = kit.arrow(C.velocity, { label: 'v', radius: 0.05 });
    const vxArrow = kit.arrow(C.x, { label: 'vₓ', radius: 0.035 });
    const vyArrow = kit.arrow(C.y, { label: 'v_y', radius: 0.035 });
    const gArrow = kit.arrow(C.acceleration, { label: 'g', radius: 0.03 });
    const apexLine = kit.line('#94a3b8', [], { dashed: true, width: 1.2, opacity: 0.6 });
    const apexLabel = kit.label('', [0, 0, 0], { color: C.y });
    const rangeLabel = kit.label('', [0, 0, 0], { color: C.x });
    const angleLabel = kit.label('', [0, 0, 0], { small: true });

    const k = () => (bool(p, 'drag') ? num(p, 'b') / Math.max(num(p, 'm'), 1e-6) : 0);
    const pp = () => ({ u: num(p, 'u'), angle: rad(num(p, 'angle')), h0: num(p, 'h0'), g: num(p, 'g') });
    const S = (x: number, y: number) => new THREE.Vector3(x * scale, y * scale, 0);

    function rebuild() {
      const P = pp();
      const drag = k();
      const analytic = projectile(P);
      const traj = drag > 0 ? dragTrajectory(P, drag) : null;
      result = traj ?? { tFlight: analytic.tFlight, range: analytic.range, maxHeight: analytic.maxHeight, vFinal: analytic.vFinal };
      const idealRange = analytic.range;
      // Fit the scene: ~18 units wide and ~10 units high.
      scale = Math.min(18 / Math.max(idealRange, result.range, 8), 10 / Math.max(analytic.maxHeight, P.h0, 4));

      tower.visible = P.h0 > 0.01;
      tower.scale.y = Math.max(P.h0 * scale, 0.01);
      tower.position.set(-0.3, (P.h0 * scale) / 2, 0);
      cannon.position.set(0, P.h0 * scale + 0.05, 0);
      cannon.rotation.z = P.angle;

      // Predicted path
      const pts: THREE.Vector3[] = [];
      if (traj) traj.points.forEach(([x, y]) => pts.push(S(x, y)));
      else for (let i = 0; i <= 120; i++) { const q = projectileAt(P, (analytic.tFlight * i) / 120); pts.push(S(q.x, Math.max(q.y, 0))); }
      predicted.setPoints(pts);
      if (traj) {
        const ip: THREE.Vector3[] = [];
        for (let i = 0; i <= 120; i++) { const q = projectileAt(P, (analytic.tFlight * i) / 120); ip.push(S(q.x, Math.max(q.y, 0))); }
        ideal.setPoints(ip);
      } else ideal.visible = false;

      // Apex + range markers
      const tPeakX = traj ? traj.points.reduce((a, b) => (b[1] > a[1] ? b : a))[0] : analytic.ux * analytic.tPeak;
      apexLine.setPoints([S(tPeakX, 0), S(tPeakX, result.maxHeight)]);
      apexLabel.at(S(tPeakX, result.maxHeight).add(new THREE.Vector3(0, 0.6, 0))).setText(`H = ${n(result.maxHeight)} m`);
      rangeLabel.at(S(result.range, 0).add(new THREE.Vector3(0, 0.9, 0))).setText(`R = ${n(result.range)} m`);
      angleLabel.at(new THREE.Vector3(1.6, P.h0 * scale + 0.5, 0)).setText(`θ = ${num(p, 'angle')}°`);

      const worldW = Math.max(result.range, idealRange, 5) * 1.05;
      ruler(kit, rulerX, { axis: 'x', origin: [0, 0.02, 1.2], length: worldW, scale, unit: 'm' });
      ruler(kit, rulerY, { axis: 'y', origin: [-2.2, 0, 0], length: Math.max(result.maxHeight, P.h0, 2) * 1.1, scale, unit: 'm', target: 4 });
    }

    function reset() {
      const P = pp();
      s = { x: 0, y: P.h0, vx: P.u * Math.cos(P.angle), vy: P.u * Math.sin(P.angle) };
      t = 0;
      landed = false;
      trail.clearPoints();
      sample.reset();
      graphs.clearLive();
    }

    rebuild();
    reset();

    return {
      setParams(np) { p = np; rebuild(); reset(); },
      reset,
      step(dt) {
        if (landed) return;
        const P = pp();
        const drag = k();
        let next: State2D;
        if (drag > 0) next = stepDrag(s, dt, P.g, drag);
        else { const q = projectileAt(P, t + dt); next = { x: q.x, y: q.y, vx: q.vx, vy: q.vy }; }
        if (next.y <= 0 && t + dt > 1e-6) {
          const frac = s.y / Math.max(1e-12, s.y - next.y);
          s = { x: s.x + (next.x - s.x) * frac, y: 0, vx: s.vx + (next.vx - s.vx) * frac, vy: s.vy + (next.vy - s.vy) * frac };
          t += dt * frac;
          landed = true;
        } else { s = next; t += dt; }
        if (sample.due(t) || landed) {
          graphs.get('pos').push(t, s.x, s.y);
          graphs.get('vel').push(t, s.vx, s.vy);
          trail.push(S(s.x, s.y));
        }
      },
      render() {
        const pos = S(s.x, s.y);
        ball.position.copy(pos).add(new THREE.Vector3(0, 0.32, 0));
        trail.flush();
        const u = Math.max(num(p, 'u'), 1);
        const as = 3 / u; // arrow scale: launch velocity ≈ 3 scene units
        const c = ball.position;
        vArrow.set(c, new THREE.Vector3(s.vx * as, s.vy * as, 0));
        const comps = bool(p, 'components');
        vxArrow.visible = comps; vyArrow.visible = comps;
        if (comps) {
          vxArrow.set(c, new THREE.Vector3(s.vx * as, 0, 0));
          vyArrow.set(c, new THREE.Vector3(0, s.vy * as, 0));
        }
        gArrow.set(c.clone().add(new THREE.Vector3(0, -0.4, 0)), new THREE.Vector3(0, -1.1, 0));
      },
      done: () => landed,
      time: () => t,
      actions: () => [{ id: 'launch', label: landed || t > 0 ? 'Launch again' : 'Launch', primary: true, run: reset }],
      readouts() {
        const speed = Math.hypot(s.vx, s.vy);
        return [
          { label: 'Time of flight', value: result.tFlight, unit: 's', tone: 'accent' },
          { label: 'Maximum height', value: result.maxHeight, unit: 'm', tone: 'accent' },
          { label: 'Range', value: result.range, unit: 'm', tone: 'accent' },
          { label: 'Final (landing) speed', value: result.vFinal, unit: 'm/s' },
          { label: 'Launch angle', value: `${num(p, 'angle')}°` },
          { label: 'Horizontal velocity vₓ', value: s.vx, unit: 'm/s' },
          { label: 'Vertical velocity v_y', value: s.vy, unit: 'm/s' },
          { label: 'Current speed |v|', value: speed, unit: 'm/s' },
          { label: 'Position x', value: s.x, unit: 'm' },
          { label: 'Position y', value: s.y, unit: 'm' },
        ];
      },
      equations() {
        const P = pp();
        const th = num(p, 'angle');
        const out: Equation[] = [
          { expr: 'vₓ = u cos θ ,  v_y = u sin θ − g t', sub: `vₓ = ${n(P.u)} × cos ${th}° = ${n(P.u * Math.cos(P.angle))} m/s` },
        ];
        if (P.h0 === 0) {
          out.push(
            { expr: 'R = u² sin 2θ / g', sub: `R = ${n(P.u)}² × sin ${2 * th}° / ${n(P.g)} = ${n((P.u ** 2 * Math.sin(2 * P.angle)) / P.g)} m` },
            { expr: 'H = u² sin²θ / 2g', sub: `H = ${n(P.u)}² × sin²${th}° / (2 × ${n(P.g)}) = ${n((P.u * Math.sin(P.angle)) ** 2 / (2 * P.g))} m` },
            { expr: 'T = 2u sin θ / g', sub: `T = 2 × ${n(P.u)} × sin ${th}° / ${n(P.g)} = ${n((2 * P.u * Math.sin(P.angle)) / P.g)} s` },
          );
        } else {
          out.push(
            { expr: 'y = h₀ + u sin θ · t − ½ g t²', sub: `h₀ = ${n(P.h0)} m` },
            { expr: 'T = [u sin θ + √(u² sin²θ + 2gh₀)] / g', sub: `T = ${n(projectile(P).tFlight)} s` },
            { expr: 'H = h₀ + u² sin²θ / 2g', sub: `H = ${n(projectile(P).maxHeight)} m` },
          );
        }
        if (k() > 0) out.push({ expr: 'm dv/dt = m g − b|v|v', sub: `b/m = ${n(k())} m⁻¹`, note: 'With drag there is no closed form — results come from numerical (RK4) integration. The grey dashed curve is the drag-free path.' });
        return out;
      },
    };
  },
};

export default sim;
