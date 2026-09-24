import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { G, c } from '../../physics/constants';
import { escapeVelocity } from '../../physics/gravitation';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const BODIES: Record<string, { name: string; M: number; R: number; color: string }> = {
  earth: { name: 'Earth', M: 5.972e24, R: 6.371e6, color: '#2563eb' },
  moon: { name: 'Moon', M: 7.342e22, R: 1.737e6, color: '#94a3b8' },
  mars: { name: 'Mars', M: 6.417e23, R: 3.39e6, color: '#dc2626' },
  jupiter: { name: 'Jupiter', M: 1.898e27, R: 6.991e7, color: '#d97706' },
  sun: { name: 'Sun', M: 1.989e30, R: 6.957e8, color: '#facc15' },
  neutron: { name: 'Neutron star', M: 2.8e30, R: 1.2e4, color: '#a5f3fc' },
};

const SR = 1.5; // scene radius of the body

const sim: SimDefinition = {
  camera: { position: [0, 5, 16], target: [0, 5, 0], aspect: 1.2 },
  startPaused: true,
  hint: 'Launch straight up. Below vₑ the probe climbs, stops and falls back; at or above vₑ it never returns.',
  params: [
    { kind: 'select', key: 'body', label: 'Body', default: 'earth', options: Object.entries(BODIES).map(([value, b]) => ({ value, label: b.name })) },
    { kind: 'slider', key: 'frac', label: 'Launch speed (fraction of vₑ)', unit: '× vₑ', min: 0.1, max: 1.5, step: 0.01, default: 0.8 },
  ],
  presets: [
    { label: 'Earth: 0.8 vₑ', values: { body: 'earth', frac: 0.8 } },
    { label: 'Earth: exactly vₑ', values: { body: 'earth', frac: 1 } },
    { label: 'Moon: 0.95 vₑ', values: { body: 'moon', frac: 0.95 } },
    { label: 'Jupiter', values: { body: 'jupiter', frac: 0.9 } },
  ],
  graphs: [
    { id: 'h', title: 'Distance from centre vs time', x: 't (scaled)', y: 'r / R', zeroY: true, series: [{ label: 'r / R', color: C.accent }] },
    { id: 'v', title: 'Speed vs distance', x: 'r / R', y: 'v / vₑ', kind: 'curve', zeroY: true, series: [{ label: 'v(r)', color: C.velocity }, { label: 'escape speed at r', color: '#94a3b8', dashed: true }] },
  ],
  learn: {
    concept: 'Escape velocity is the minimum launch speed that lets a body coast away from a planet forever, ignoring air resistance. Its kinetic energy must at least equal the depth of the gravitational potential well: ½mvₑ² = GMm/R, so vₑ = √(2GM/R) — independent of the mass launched.',
    variables: [['vₑ', 'escape velocity (m/s)'], ['M', 'mass of the body (kg)'], ['R', 'radius of the body (m)'], ['r_max', 'highest point reached (from the centre)'], ['r_s', 'Schwarzschild radius 2GM/c²']],
    observe: [
      'At 0.8 vₑ the probe reaches about 2.8 R before falling back.',
      'At exactly vₑ its speed tends to zero only at infinity.',
      'vₑ depends on M/R: a dense neutron star has a huge escape velocity.',
      'If vₑ would exceed c, the object is a black hole.',
    ],
    challenge: 'Using energy conservation, predict the maximum height reached from Earth at 0.5 vₑ, then launch and compare.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, r = 1, v = 0, done = false; // r in body radii, v in units of vₑ
    const sample = sampler(1 / 20);
    const planet = kit.sphere(SR, '#2563eb', { roughness: 0.7 }, 48);
    const rocket = kit.cone('#e2e8f0', 0.15, 0.45);
    const trail = kit.trail(C.weight, 600, { width: 2 });
    const vArrow = kit.arrow(C.velocity, { label: 'v' });
    const gArrow = kit.arrow(C.field, { label: 'g' });
    const marks = kit.segments('#64748b', { width: 1 });
    const labels = [2, 4, 6, 8].map((k) => kit.label(`${k}R`, [0.6, SR * k, 0], { small: true }));
    void labels;
    const flat: number[] = [];
    for (let k = 1; k <= 9; k++) flat.push(-0.3, SR * k, 0, 0.3, SR * k, 0);
    marks.setSegments(flat);

    const body = () => BODIES[str(p, 'body')] ?? BODIES.earth;
    const ve = () => escapeVelocity(body().M, body().R);
    /** Dimensionless equation of motion: dv/dt = −1/(2r²) with r in R and v in vₑ, time in R/vₑ. */
    function reset() {
      t = 0; r = 1; v = num(p, 'frac'); done = false; sample.reset(); trail.clearPoints();
      (planet.material as { color: { set: (c: string) => void } }).color.set(body().color);
      const f = num(p, 'frac');
      const E = f * f - 1; // in units of ½vₑ²
      graphs.get('v').plot(0, 1, 10, (rr) => { const s = f * f - 1 + 1 / rr; return s >= 0 ? Math.sqrt(s) : NaN; }, 200);
      graphs.get('v').plot(1, 1, 10, (rr) => Math.sqrt(1 / rr), 100);
      void E;
    }
    reset();

    return {
      setParams(np) { p = np; graphs.clearLive(); reset(); },
      reset,
      step(dt) {
        if (done) return;
        // one real second = 1.2 R/vₑ of scaled time
        const h = dt * 1.2;
        v += (-0.5 / (r * r)) * h;
        r += v * h;
        t += h;
        if (r <= 1) { r = 1; v = 0; done = true; }
        if (r > 10) done = true;
        trail.push([0.35, r * SR, 0]);
        if (sample.due(t)) graphs.get('h').push(t, r);
      },
      render() {
        rocket.position.set(0, r * SR + 0.2, 0);
        rocket.rotation.z = v >= 0 ? 0 : Math.PI;
        trail.flush();
        vArrow.set([0.6, r * SR, 0], [0, v * 2, 0], `v = ${n(v * ve() / 1000)} km/s`);
        gArrow.set([-0.6, r * SR, 0], [0, -1.2 / (r * r), 0], `g = ${n((G * body().M) / (r * body().R) ** 2)} m/s²`);
      },
      done: () => done,
      time: () => t,
      readouts(): Readout[] {
        const b = body();
        const f = num(p, 'frac');
        const rmax = f < 1 ? 1 / (1 - f * f) : Infinity;
        const rs = (2 * G * b.M) / (c * c);
        return [
          { label: 'Escape velocity vₑ', value: ve() / 1000, unit: 'km/s', tone: 'accent' },
          { label: 'Launch speed', value: (f * ve()) / 1000, unit: 'km/s' },
          { label: 'Outcome', value: f >= 1 ? 'Escapes' : `Rises to ${n(rmax)} R, then falls back`, tone: f >= 1 ? 'good' : 'warn' },
          { label: 'Surface gravity', value: (G * b.M) / (b.R * b.R), unit: 'm/s²' },
          { label: 'Current distance', value: r, unit: 'R' },
          { label: 'Current speed', value: (v * ve()) / 1000, unit: 'km/s' },
          { label: 'Schwarzschild radius 2GM/c²', value: rs, unit: 'm' },
          { label: 'vₑ as a fraction of c', value: ve() / c },
        ];
      },
      equations(): Equation[] {
        const b = body();
        const f = num(p, 'frac');
        return [
          { expr: 'vₑ = √(2 G M / R)', sub: `= √(2 × 6.674×10⁻¹¹ × ${n(b.M)} / ${n(b.R)}) = ${n(ve() / 1000)} km/s` },
          { expr: '½mv² − GMm/R = −GMm/r_max', sub: f < 1 ? `r_max = R / (1 − (v/vₑ)²) = ${n(1 / (1 - f * f))} R` : 'v ≥ vₑ: r_max → ∞' },
          { expr: 'Black hole if R < r_s = 2GM/c²', note: 'Time in the graph is in units of R/vₑ.' },
        ];
      },
    };
  },
};

export default sim;
