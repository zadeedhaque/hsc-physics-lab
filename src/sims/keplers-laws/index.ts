import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num } from '../types';
import { G, Msun, AU } from '../../physics/constants';
import { C } from '../../engine/colors';
import { n } from '../shared';

const S = 3.2; // scene units per AU
const PLANETS: [string, number, number][] = [['Mercury', 0.387, 0.2408], ['Venus', 0.723, 0.6152], ['Earth', 1, 1], ['Mars', 1.524, 1.881], ['Jupiter', 5.203, 11.86], ['Saturn', 9.537, 29.45]];

/** Solve Kepler's equation M = E − e sin E. */
function eccentricAnomaly(M: number, e: number) {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 30; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}

const sim: SimDefinition = {
  camera: { position: [0, 11, 6], target: [0, 0, 0], aspect: 1.4 },
  hint: 'Each coloured sector is swept in the same time. Close to the Sun they are short and fat; far away long and thin — same area.',
  params: [
    { kind: 'slider', key: 'a', label: 'Semi-major axis a', unit: 'AU', min: 0.3, max: 3, step: 0.01, default: 1.5 },
    { kind: 'slider', key: 'e', label: 'Eccentricity e', min: 0, max: 0.9, step: 0.01, default: 0.5 },
    { kind: 'slider', key: 'M', label: 'Star mass', unit: 'M☉', min: 0.2, max: 3, step: 0.05, default: 1 },
    { kind: 'slider', key: 'sectors', label: 'Number of equal-time sectors', min: 4, max: 16, step: 1, default: 8 },
    { kind: 'toggle', key: 'areas', label: 'Show equal-area sectors', default: true },
  ],
  presets: [
    { label: 'Earth-like (e = 0.017)', values: { a: 1, e: 0.017 } },
    { label: 'Mars-like', values: { a: 1.524, e: 0.093 } },
    { label: 'Comet', values: { a: 2.8, e: 0.85 } },
    { label: 'Heavy star', values: { M: 3 } },
  ],
  graphs: [
    { id: 'T2', title: 'Kepler’s third law: T² vs a³ (solar system + your planet)', x: 'a³ (AU³)', y: 'T² (yr²)', kind: 'curve', series: [{ label: 'T² = a³ / M', color: C.accent }] },
    { id: 'v', title: 'Orbital speed vs time', x: 't (yr)', y: 'v (km/s)', zeroY: true, series: [{ label: 'v', color: C.velocity }] },
  ],
  learn: {
    concept: 'Kepler’s laws: (1) planets move in ellipses with the Sun at one focus; (2) the line from the Sun to a planet sweeps out equal areas in equal times — so planets move fastest at perihelion; (3) the square of the period is proportional to the cube of the semi-major axis, T² ∝ a³.',
    variables: [['a', 'semi-major axis (AU)'], ['e', 'eccentricity (0 = circle)'], ['T', 'orbital period (years)'], ['r_p, r_a', 'perihelion a(1−e) and aphelion a(1+e)'], ['M', 'mass of the star']],
    observe: [
      'The planet speeds up near the star and slows down far away.',
      'All sectors have the same area even though their shapes differ.',
      'Changing e changes the shape but not the period — only a (and M) matter.',
      'Every point in the T²–a³ graph lies on one straight line.',
    ],
    challenge: 'A planet takes 8 years to orbit a Sun-like star. What is its semi-major axis? Set it and check the period.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0; // years
    kit.sphere(0.35, '#facc15', { emissive: 1 });
    const planet = kit.sphere(0.14, '#38bdf8', { emissive: 0.3 });
    const orbit = kit.line('#94a3b8', [], { width: 1.5 });
    const radius = kit.line('#e2e8f0', [], { width: 1.2, opacity: 0.7 });
    const sectors = kit.add(new THREE.Group());
    const focus2 = kit.sphere(0.05, '#64748b');
    const vArrow = kit.arrow(C.velocity, { label: 'v' });
    const lp = kit.label('perihelion', [0, 0, 0], { small: true });
    const la = kit.label('aphelion', [0, 0, 0], { small: true });

    const period = () => Math.sqrt(num(p, 'a') ** 3 / num(p, 'M')); // years
    function posAt(time: number) {
      const a = num(p, 'a'), e = num(p, 'e');
      const Mean = ((2 * Math.PI * time) / period()) % (2 * Math.PI);
      const E = eccentricAnomaly(Mean, e);
      const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E);
      return { x, y };
    }
    const speedKm = (x: number, y: number) => {
      const r = Math.hypot(x, y) * AU;
      const mu = G * num(p, 'M') * Msun;
      return Math.sqrt(mu * (2 / r - 1 / (num(p, 'a') * AU))) / 1000;
    };

    function build() {
      const a = num(p, 'a'), e = num(p, 'e');
      const pts: [number, number, number][] = [];
      for (let i = 0; i <= 200; i++) { const E = (i / 200) * Math.PI * 2; pts.push([a * (Math.cos(E) - e) * S, 0, -a * Math.sqrt(1 - e * e) * Math.sin(E) * S]); }
      orbit.setPoints(pts);
      focus2.position.set(-2 * a * e * S, 0, 0);
      lp.at([a * (1 - e) * S + 0.3, 0.2, 0]);
      la.at([-a * (1 + e) * S - 0.3, 0.2, 0]);
      kit.clearGroup(sectors);
      if (bool(p, 'areas')) {
        const k = Math.round(num(p, 'sectors'));
        const T = period();
        for (let i = 0; i < k; i++) {
          const verts: number[] = [];
          const steps = 24;
          for (let j = 0; j < steps; j++) {
            const q0 = posAt(((i + j / steps) / k) * T), q1 = posAt(((i + (j + 1) / steps) / k) * T);
            verts.push(0, 0.01, 0, q0.x * S, 0.01, -q0.y * S, q1.x * S, 0.01, -q1.y * S);
          }
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
          g.computeVertexNormals();
          const m = new THREE.Mesh(g, kit.mat(i % 2 ? '#38bdf8' : '#f472b6', { opacity: 0.28, side: THREE.DoubleSide }));
          sectors.add(m);
        }
      }
      const G3 = graphs.get('T2');
      G3.plot(0, 0, Math.max(30, a ** 3 * 1.1), (x) => x / num(p, 'M'), 2);
      G3.setMarkers([...PLANETS.filter(([, pa]) => pa ** 3 < Math.max(30, a ** 3 * 1.1)).map(([name, pa, pt]) => ({ x: pa ** 3, y: pt * pt, label: name, color: '#94a3b8' })), { x: a ** 3, y: period() ** 2, label: 'your planet', color: C.accent }]);
    }
    build();
    let lastSample = 0;

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; lastSample = 0; },
      step(dt) {
        t += dt * 0.25; // 1 s of animation = 0.25 yr
        if (t - lastSample >= 0.01) { lastSample = t; const q = posAt(t); graphs.get('v').push(t, speedKm(q.x, q.y)); }
      },
      render() {
        const q = posAt(t);
        planet.position.set(q.x * S, 0, -q.y * S);
        radius.setPoints([[0, 0, 0], planet.position.clone()]);
        const q2 = posAt(t + 0.002 * period());
        const dir = new THREE.Vector3((q2.x - q.x) * S, 0, -(q2.y - q.y) * S).normalize();
        const v = speedKm(q.x, q.y);
        vArrow.set(planet.position, dir.multiplyScalar(0.3 + v / 40), `v = ${n(v)} km/s`);
      },
      time: () => t,
      readouts(): Readout[] {
        const a = num(p, 'a'), e = num(p, 'e');
        const q = posAt(t);
        return [
          { label: 'Period T', value: period(), unit: 'years', tone: 'accent' },
          { label: 'T² / a³', value: period() ** 2 / a ** 3, unit: 'yr²/AU³' },
          { label: 'Perihelion distance', value: a * (1 - e), unit: 'AU' },
          { label: 'Aphelion distance', value: a * (1 + e), unit: 'AU' },
          { label: 'Speed at perihelion', value: speedKm(a * (1 - e), 0), unit: 'km/s' },
          { label: 'Speed at aphelion', value: speedKm(-a * (1 + e), 0), unit: 'km/s' },
          { label: 'Current distance', value: Math.hypot(q.x, q.y), unit: 'AU' },
          { label: 'Areal velocity (constant)', value: (Math.PI * a * a * Math.sqrt(1 - e * e)) / period(), unit: 'AU²/yr' },
        ];
      },
      equations(): Equation[] {
        const a = num(p, 'a'), e = num(p, 'e');
        return [
          { expr: 'T² = (4π² / G M) a³   →   T(yr)² = a(AU)³ / M(M☉)', sub: `T = √(${n(a)}³ / ${n(num(p, 'M'))}) = ${n(period())} yr` },
          { expr: 'dA/dt = L / 2m = constant', sub: `= ${n((Math.PI * a * a * Math.sqrt(1 - e * e)) / period())} AU²/yr` },
          { expr: 'v_p / v_a = r_a / r_p = (1 + e)/(1 − e)', sub: `= ${n((1 + e) / (1 - e))}` },
          { expr: 'v = √[GM (2/r − 1/a)]  (vis-viva)' },
        ];
      },
    };
  },
};

export default sim;
