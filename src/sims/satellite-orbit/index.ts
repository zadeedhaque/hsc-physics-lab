import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { G, Mearth, Rearth } from '../../physics/constants';
import { orbitalVelocity, orbitalPeriod, orbitFromState, stepOrbit } from '../../physics/gravitation';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const SC = 1.6 / Rearth; // scene units per metre (Earth radius = 1.6 units)

const sim: SimDefinition = {
  camera: { position: [0, 16, 10], target: [0, 0, 0], aspect: 1.2, maxDistance: 300 },
  hint: 'At exactly the circular speed the orbit is a circle. Faster gives an ellipse (or escape); slower dips toward the planet.',
  params: [
    { kind: 'slider', key: 'M', label: 'Planet mass', unit: 'M⊕', min: 0.1, max: 5, step: 0.01, default: 1 },
    { kind: 'slider', key: 'h', label: 'Altitude at launch', unit: 'km', min: 200, max: 36000, step: 100, default: 2000 },
    { kind: 'slider', key: 'vfac', label: 'Launch speed (× circular speed)', unit: '×', min: 0.5, max: 1.5, step: 0.01, default: 1 },
    { kind: 'slider', key: 'warp', label: 'Time speed-up', unit: '×', min: 100, max: 5000, step: 100, default: 1500 },
  ],
  presets: [
    { label: 'Low Earth orbit (ISS)', values: { M: 1, h: 410, vfac: 1, warp: 600 } },
    { label: 'Geostationary', values: { M: 1, h: 35786, vfac: 1, warp: 5000 } },
    { label: 'Elliptical', values: { M: 1, h: 2000, vfac: 1.2 } },
    { label: 'Escape (√2 ×)', values: { M: 1, h: 2000, vfac: 1.42 } },
    { label: 'Too slow – crash', values: { M: 1, h: 1000, vfac: 0.7 } },
  ],
  graphs: [
    { id: 'rv', title: 'Distance and speed vs time', x: 't (min)', y: '', zeroY: true, series: [{ label: 'r (1000 km)', color: C.accent }, { label: 'v (km/s)', color: C.velocity }] },
  ],
  learn: {
    concept: 'A satellite is in free fall around a planet: gravity supplies exactly the centripetal force needed for a circle when v = √(GM/r). The period is T = 2π√(r³/GM), independent of the satellite’s mass. Launched faster than this the orbit becomes an ellipse; at √2 times the circular speed it escapes.',
    variables: [['v₀', 'circular orbital speed √(GM/r) (m/s)'], ['T', 'orbital period (s)'], ['r', 'distance from the centre = R + h'], ['e', 'eccentricity of the orbit'], ['E', 'specific orbital energy (J/kg)']],
    observe: [
      'Higher orbits are slower and take much longer.',
      'The geostationary orbit has a period of 24 hours.',
      'In an elliptical orbit the satellite is fastest at the closest point.',
      'The gravity arrow always points to the planet’s centre.',
    ],
    challenge: 'Find the altitude at which a satellite orbits the Earth once every 2 hours. Use T² = 4π²r³/GM.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let s = { x: 0, y: 0, vx: 0, vy: 0 }, t = 0, state: 'orbit' | 'crash' | 'escape' = 'orbit';
    const sample = sampler(1 / 10);
    kit.sphere(1.6, '#2563eb', { roughness: 0.7 }, 48);
    const sat = kit.box(0.25, 0.12, 0.25, '#e2e8f0', { metalness: 0.6 });
    const trail = kit.trail(C.weight, 3000, { width: 2 });
    const predicted = kit.line('#64748b', [], { dashed: true, width: 1.2 });
    const vArrow = kit.arrow(C.velocity, { label: 'v' });
    const gArrow = kit.arrow(C.field, { label: 'F_g' });
    kit.grid(40, 40, 'xz', -0.01);

    const mu = () => G * num(p, 'M') * Mearth;
    const r0 = () => Rearth + num(p, 'h') * 1000; // planet radius kept at Earth's for clarity

    function reset() {
      const r = r0();
      const v = orbitalVelocity(num(p, 'M') * Mearth, r) * num(p, 'vfac');
      s = { x: r, y: 0, vx: 0, vy: v };
      t = 0; state = 'orbit'; sample.reset(); trail.clearPoints();
      // predicted orbit (conic) for reference
      const o = orbitFromState(num(p, 'M') * Mearth, r, v);
      const pts: [number, number, number][] = [];
      if (o.bound) {
        let q = { ...s };
        const T = 2 * Math.PI * Math.sqrt(o.a ** 3 / mu());
        const N = 400;
        for (let i = 0; i <= N; i++) { pts.push([q.x * SC, 0, -q.y * SC]); for (let k = 0; k < 8; k++) q = stepOrbit(q, T / N / 8, mu()); }
        predicted.setPoints(pts);
      } else predicted.visible = false;
    }
    reset();

    return {
      setParams(np) { const keep = np.warp !== p.warp && Object.keys(np).every((k) => k === 'warp' || np[k] === p[k]); p = np; if (!keep) { graphs.clearLive(); reset(); } },
      reset,
      step(dt) {
        if (state !== 'orbit') return;
        const h = dt * num(p, 'warp');
        const sub = Math.max(1, Math.ceil(h / 20));
        for (let i = 0; i < sub; i++) s = stepOrbit(s, h / sub, mu());
        t += h;
        const r = Math.hypot(s.x, s.y);
        if (r < Rearth) state = 'crash';
        if (r > 40 * Rearth) state = 'escape';
        trail.push([s.x * SC, 0, -s.y * SC]);
        if (sample.due(t / num(p, 'warp'))) graphs.get('rv').push(t / 60, r / 1e6, Math.hypot(s.vx, s.vy) / 1000);
      },
      render() {
        sat.position.set(s.x * SC, 0, -s.y * SC);
        trail.flush();
        const v = Math.hypot(s.vx, s.vy);
        vArrow.set(sat.position, [(s.vx / v) * 1.2 || 0, 0, (-s.vy / v) * 1.2 || 0], `v = ${n(v / 1000)} km/s`);
        const r = Math.hypot(s.x, s.y);
        gArrow.set(sat.position, [(-s.x / r) * 1.0, 0, (s.y / r) * 1.0], '');
      },
      done: () => state !== 'orbit',
      time: () => t,
      readouts(): Readout[] {
        const r = r0();
        const v = orbitalVelocity(num(p, 'M') * Mearth, r) * num(p, 'vfac');
        const o = orbitFromState(num(p, 'M') * Mearth, r, v);
        return [
          { label: 'Circular orbital speed at launch', value: orbitalVelocity(num(p, 'M') * Mearth, r) / 1000, unit: 'km/s', tone: 'accent' },
          { label: 'Circular orbit period', value: orbitalPeriod(num(p, 'M') * Mearth, r) / 3600, unit: 'h', tone: 'accent' },
          { label: 'Launch speed', value: v / 1000, unit: 'km/s' },
          { label: 'Escape speed at this height', value: Math.sqrt(2) * orbitalVelocity(num(p, 'M') * Mearth, r) / 1000, unit: 'km/s' },
          { label: 'Eccentricity', value: o.e },
          { label: 'Orbit type', value: state === 'crash' ? 'Crashed into the planet' : o.bound ? (o.e < 0.01 ? 'Circle' : 'Ellipse') : 'Escape (open orbit)', tone: state === 'crash' ? 'bad' : 'default' },
          { label: 'Gravitational force on 1000 kg', value: (mu() * 1000) / (r * r), unit: 'N' },
          { label: 'Elapsed (real) time', value: t / 60, unit: 'min' },
        ];
      },
      equations(): Equation[] {
        const r = r0();
        return [
          { expr: 'm v² / r = G M m / r²  ⇒  v = √(G M / r)', sub: `v = ${n(orbitalVelocity(num(p, 'M') * Mearth, r) / 1000)} km/s at r = ${n(r / 1000)} km` },
          { expr: 'T = 2π √(r³ / G M)', sub: `T = ${n(orbitalPeriod(num(p, 'M') * Mearth, r) / 60)} min` },
          { expr: 'E = ½v² − GM/r   (E < 0 bound, E ≥ 0 escapes)' },
        ];
      },
    };
  },
};

export default sim;
