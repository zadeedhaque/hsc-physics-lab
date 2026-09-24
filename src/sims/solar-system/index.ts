import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num, str } from '../types';
import { G, Msun, AU } from '../../physics/constants';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

/** J2000 orbital elements: a (AU), e, T (days), i, Ω (node), ϖ (perihelion), L₀ (mean longitude) in degrees; radius (km). */
const PLANETS = [
  { id: 'mercury', name: 'Mercury', a: 0.387_1, e: 0.205_6, T: 87.969, i: 7.0, node: 48.33, peri: 77.46, L0: 252.25, R: 2440, color: '#a8a29e' },
  { id: 'venus', name: 'Venus', a: 0.723_3, e: 0.006_8, T: 224.70, i: 3.39, node: 76.68, peri: 131.6, L0: 181.98, R: 6052, color: '#fde68a' },
  { id: 'earth', name: 'Earth', a: 1.0, e: 0.016_7, T: 365.256, i: 0, node: 0, peri: 102.94, L0: 100.46, R: 6371, color: '#60a5fa' },
  { id: 'mars', name: 'Mars', a: 1.523_7, e: 0.093_4, T: 686.98, i: 1.85, node: 49.56, peri: 336.04, L0: 355.45, R: 3390, color: '#f87171' },
  { id: 'jupiter', name: 'Jupiter', a: 5.203, e: 0.048_4, T: 4332.6, i: 1.3, node: 100.46, peri: 14.73, L0: 34.4, R: 69911, color: '#fdba74' },
  { id: 'saturn', name: 'Saturn', a: 9.537, e: 0.053_9, T: 10759, i: 2.49, node: 113.67, peri: 92.6, L0: 49.94, R: 58232, color: '#fcd34d' },
  { id: 'uranus', name: 'Uranus', a: 19.19, e: 0.047_3, T: 30687, i: 0.77, node: 74.0, peri: 170.95, L0: 313.23, R: 25362, color: '#67e8f9' },
  { id: 'neptune', name: 'Neptune', a: 30.07, e: 0.008_6, T: 60190, i: 1.77, node: 131.78, peri: 44.97, L0: 304.88, R: 24622, color: '#818cf8' },
];
type Planet = (typeof PLANETS)[number];
const D2R = Math.PI / 180;
const J2000 = Date.UTC(2000, 0, 1, 12);

/** Heliocentric ecliptic position (AU) after `days` from J2000 — Kepler’s equation solved by Newton’s method. */
function position(pl: Planet, days: number): THREE.Vector3 {
  const M = ((pl.L0 - pl.peri) * D2R + (2 * Math.PI * days) / pl.T) % (2 * Math.PI);
  let E = M;
  for (let k = 0; k < 8; k++) E -= (E - pl.e * Math.sin(E) - M) / (1 - pl.e * Math.cos(E));
  const xv = pl.a * (Math.cos(E) - pl.e), yv = pl.a * Math.sqrt(1 - pl.e * pl.e) * Math.sin(E);
  const w = (pl.peri - pl.node) * D2R, O = pl.node * D2R, inc = pl.i * D2R;
  const x1 = xv * Math.cos(w) - yv * Math.sin(w), y1 = xv * Math.sin(w) + yv * Math.cos(w);
  const X = x1 * Math.cos(O) - y1 * Math.cos(inc) * Math.sin(O);
  const Y = x1 * Math.sin(O) + y1 * Math.cos(inc) * Math.cos(O);
  const Z = y1 * Math.sin(inc);
  return new THREE.Vector3(X, Y, Z);
}

const sim: SimDefinition = {
  camera: { position: [0, 36, 46], target: [0, 0, 0], aspect: 1.8 },
  hint: 'Planets are placed at their real positions for the date shown. Inner planets race round; Neptune takes 165 years.',
  params: [
    { kind: 'slider', key: 'speed', label: 'Time speed', unit: 'days/s', min: 1, max: 3650, step: 1, default: 60 },
    { kind: 'select', key: 'scale', label: 'Distance scale', default: 'sqrt', options: [{ value: 'sqrt', label: 'Compressed (√ distance) — all planets' }, { value: 'inner', label: 'True scale — inner planets' }, { value: 'true', label: 'True scale — whole system' }] },
    { kind: 'select', key: 'focus', label: 'Planet to study', default: 'earth', options: PLANETS.map((p) => ({ value: p.id, label: p.name })) },
    { kind: 'toggle', key: 'trail', label: 'Draw orbits', default: true },
  ],
  presets: [
    { label: 'One Earth year per 6 s', values: { speed: 60, scale: 'sqrt', focus: 'earth' } },
    { label: 'Inner planets, true scale', values: { scale: 'inner', speed: 30, focus: 'mercury' } },
    { label: 'Outer giants (10 years/s)', values: { scale: 'true', speed: 3650, focus: 'jupiter' } },
    { label: 'Eccentric Mercury', values: { scale: 'inner', focus: 'mercury', speed: 10 } },
  ],
  graphs: [
    { id: 'K', title: 'Kepler’s third law: T² ∝ a³', x: 'log₁₀ a (AU)', y: 'log₁₀ T (years)', kind: 'curve', xRange: [-0.5, 1.6], series: [{ label: 'T = a^1.5', color: C.accent }] },
    { id: 'r', title: 'Distance of the chosen planet from the Sun', x: 'days', y: 'r (AU)', window: 800, series: [{ label: 'r', color: '#60a5fa' }] },
  ],
  learn: {
    concept: 'The eight planets orbit the Sun on nearly flat, slightly elliptical paths, all in the same direction. Each obeys Kepler’s laws: the orbit is an ellipse with the Sun at a focus, the planet moves fastest at perihelion, and T² = a³ (T in years, a in AU). The speed of a planet follows from gravity: v = √(GM(2/r − 1/a)).',
    variables: [['a', 'semi-major axis (AU)'], ['e', 'eccentricity'], ['T', 'orbital period'], ['r', 'distance from the Sun'], ['v', 'orbital speed (vis-viva)']],
    observe: [
      'All planets lie on the same line T² ∝ a³ in the Kepler graph.',
      'Mercury’s distance from the Sun changes by about 40 % during its year.',
      'On the true scale the outer planets are enormously far apart.',
    ],
    challenge: 'Use T² = a³ to predict the period of a dwarf planet at 39.5 AU (Pluto).',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let days = 0, t = 0;
    const now = (Date.now() - J2000) / 86400000; // start at today’s real configuration
    const sample = sampler(1 / 10);
    const sun = kit.sphere(1, '#fbbf24', { emissive: 1 });
    const glowS = kit.sphere(1.6, '#f59e0b', { emissive: 1, opacity: 0.18 });
    const bodies = PLANETS.map((pl) => {
      const m = kit.sphere(1, pl.color, { emissive: 0.15 });
      const label = kit.label(pl.name, [0, 0, 0], { small: true, color: pl.color });
      const orbit = kit.line(pl.color, [], { width: 1.2, opacity: 0.45 });
      if (pl.id === 'saturn') { const ring = kit.torus(1.8, 0.25, '#fde68a'); m.add(ring); ring.rotation.x = Math.PI / 2 - 0.47; ring.scale.set(1, 1, 0.08); }
      return { pl, m, label, orbit };
    });
    const dateLabel = kit.label('', [0, 0, 0], { small: true });
    const focusRing = kit.torus(1, 0.05, '#e2e8f0');

    const mode = () => str(p, 'scale');
    const toScene = (v: THREE.Vector3) => {
      const r = v.length();
      const k = mode() === 'sqrt' ? (r > 0 ? (6 * Math.sqrt(r)) / r : 0) : mode() === 'inner' ? 7 : 1.1;
      return new THREE.Vector3(v.x * k, v.z * k, -v.y * k); // ecliptic → scene (y up)
    };
    const sizeOf = (pl: Planet) => (mode() === 'true' ? 0.35 : 0.22) + (mode() === 'inner' ? 0.5 : 0.9) * Math.sqrt(pl.R / 69911);
    const focus = () => PLANETS.find((q) => q.id === str(p, 'focus')) ?? PLANETS[2];

    function build() {
      const sunR = mode() === 'inner' ? 0.6 : mode() === 'true' ? 0.8 : 1.2;
      sun.scale.setScalar(sunR); glowS.scale.setScalar(sunR);
      for (const b of bodies) {
        b.m.scale.setScalar(sizeOf(b.pl));
        const pts: THREE.Vector3[] = [];
        for (let k = 0; k <= 180; k++) pts.push(toScene(position(b.pl, (b.pl.T * k) / 180)));
        b.orbit.setPoints(pts);
        b.orbit.visible = bool(p, 'trail') && !(mode() === 'inner' && b.pl.a > 2);
        b.m.visible = !(mode() === 'inner' && b.pl.a > 2);
      }
      const G1 = graphs.get('K');
      G1.plot(0, -0.5, 1.6, (x) => 1.5 * x, 50);
      const f = focus();
      G1.setMarkers([...PLANETS.map((q) => ({ x: Math.log10(q.a), y: Math.log10(q.T / 365.256), color: q.id === f.id ? '#ffffff' : q.color }))]);
      const r = graphs.get('r');
      r.spec.window = Math.max(100, f.T * 2.2);
    }
    build();

    const rNow = (pl: Planet) => position(pl, now + days).length();
    const speed = (pl: Planet) => Math.sqrt(G * Msun * (2 / (rNow(pl) * AU) - 1 / (pl.a * AU)));

    return {
      setParams(np) {
        const refocus = str(np, 'focus') !== str(p, 'focus');
        p = np; build();
        if (refocus) graphs.get('r').clear();
      },
      reset() { days = 0; t = 0; sample.reset(); },
      step(dt) {
        t += dt;
        days += dt * num(p, 'speed');
        if (sample.due(t)) graphs.get('r').push(days, rNow(focus()));
      },
      render() {
        for (const b of bodies) {
          const s = toScene(position(b.pl, now + days));
          b.m.position.copy(s);
          b.m.rotation.y += 0.02;
          b.label.at([s.x, s.y + sizeOf(b.pl) + 0.5, s.z]);
          b.label.visible = b.m.visible;
        }
        const f = bodies.find((b) => b.pl.id === focus().id)!;
        focusRing.position.copy(f.m.position);
        focusRing.rotation.x = Math.PI / 2;
        focusRing.scale.setScalar(sizeOf(f.pl) + 0.4);
        focusRing.visible = f.m.visible;
        const d = new Date(J2000 + (now + days) * 86400000);
        dateLabel.at([0, mode() === 'inner' ? 2 : 3, 0]).setText(d.toISOString().slice(0, 10));
      },
      readouts(): Readout[] {
        const f = focus();
        const r = rNow(f);
        return [
          { label: 'Date shown', value: new Date(J2000 + (now + days) * 86400000).toISOString().slice(0, 10) },
          { label: `${f.name}: distance from Sun`, value: r, unit: 'AU', tone: 'accent' },
          { label: 'Orbital speed now', value: speed(f) / 1000, unit: 'km/s', tone: 'accent' },
          { label: 'Semi-major axis a', value: f.a, unit: 'AU' },
          { label: 'Eccentricity e', value: f.e },
          { label: 'Orbital period T', value: f.T / 365.256, unit: 'years' },
          { label: 'T² / a³ (years², AU³)', value: (f.T / 365.256) ** 2 / f.a ** 3 },
          { label: 'Perihelion / aphelion', value: `${n(f.a * (1 - f.e))} / ${n(f.a * (1 + f.e))} AU` },
          { label: 'Planet radius', value: f.R, unit: 'km' },
        ];
      },
      equations(): Equation[] {
        const f = focus(), r = rNow(f);
        return [
          { expr: 'T² = a³ (T in years, a in AU)', sub: `${n(f.T / 365.256)}² = ${n((f.T / 365.256) ** 2)} ≈ ${n(f.a)}³ = ${n(f.a ** 3)}` },
          { expr: 'v = √(GM (2/r − 1/a))', sub: `= √(GM(2/${n(r)} − 1/${n(f.a)}) AU⁻¹) = ${n(speed(f) / 1000)} km/s` },
          { expr: 'M − e sin E = … (Kepler’s equation)', note: 'Solved each frame to place the planet on its ellipse.' },
        ];
      },
    };
  },
};

export default sim;
