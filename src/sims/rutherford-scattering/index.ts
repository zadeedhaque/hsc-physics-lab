import * as THREE from 'three';
import type { Equation, Params, Readout, SimAction, SimDefinition } from '../types';
import { bool, num, str } from '../types';
import { deg } from '../../lib/num';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

/** 1 scene unit = 10 fm. kq₁q₂ for α (2e) on Z: 1.44 MeV·fm × 2Z. */
const FM = 10;
const V0 = 4; // scene speed of an incoming α (units/s)
const X_START = -14, R_END = 16;
const BMAX = 6; // beam radius (scene units)
const BINS = 16; // 10° bins from 20° to 180°

const TARGETS: Record<string, { name: string; Z: number; A: number }> = {
  au: { name: 'Gold (Z = 79)', Z: 79, A: 197 },
  ag: { name: 'Silver (Z = 47)', Z: 47, A: 108 },
  cu: { name: 'Copper (Z = 29)', Z: 29, A: 64 },
  al: { name: 'Aluminium (Z = 13)', Z: 13, A: 27 },
};

interface Alpha { pos: THREE.Vector3; vel: THREE.Vector3; mesh: THREE.Mesh; done: boolean }

const sim: SimDefinition = {
  camera: { position: [0, 9, 16], target: [0, 0, 0], aspect: 1.5 },
  hint: 'Most α-particles pass almost straight through; only those aimed very close to the tiny nucleus bounce back.',
  params: [
    { kind: 'slider', key: 'KE', label: 'Alpha kinetic energy', unit: 'MeV', min: 1, max: 10, step: 0.1, default: 5 },
    { kind: 'select', key: 'target', label: 'Target nucleus', default: 'au', options: Object.entries(TARGETS).map(([value, x]) => ({ value, label: x.name })) },
    { kind: 'slider', key: 'b', label: 'Impact parameter b (traced α)', unit: 'fm', min: 0, max: 60, step: 0.5, default: 20 },
    { kind: 'toggle', key: 'beam', label: 'Fire a random beam', default: true },
    { kind: 'slider', key: 'rate', label: 'Beam rate', unit: 'α/s', min: 2, max: 60, step: 1, default: 25, showIf: (p) => p.beam === true },
  ],
  presets: [
    { label: 'Geiger–Marsden (5 MeV on gold)', values: { KE: 5, target: 'au', b: 20 } },
    { label: 'Head-on (b = 0)', values: { b: 0 } },
    { label: 'Glancing (b = 50 fm)', values: { b: 50 } },
    { label: 'Light nucleus (Al)', values: { target: 'al', b: 5 } },
  ],
  graphs: [
    { id: 'H', title: 'Scattered α per 10° (beam)', x: 'θ (°)', y: 'count', kind: 'curve', xRange: [20, 180], zeroY: true, series: [{ label: 'detected', color: C.accent }, { label: 'Rutherford formula', color: '#94a3b8', dashed: true }] },
    { id: 'B', title: 'Scattering angle vs impact parameter', x: 'b (fm)', y: 'θ (°)', kind: 'curve', xRange: [0, 60], yRange: [0, 180], series: [{ label: 'tan(θ/2) = d₀ / 2b', color: C.positive }] },
  ],
  learn: {
    concept: 'Rutherford fired α-particles at thin gold foil. Most went straight through, but about 1 in 8000 bounced back by more than 90°. He concluded that the atom’s positive charge and almost all its mass are packed into a tiny nucleus. Each α follows a hyperbola under the Coulomb repulsion; its deflection depends on how close it is aimed: tan(θ/2) = d₀/2b, where d₀ = 2kZe²/KE is the closest approach in a head-on collision.',
    variables: [['b', 'impact parameter (miss distance if undeflected)'], ['d₀', 'distance of closest approach (head-on)'], ['θ', 'scattering angle'], ['Z', 'atomic number of the target'], ['KE', 'α kinetic energy']],
    observe: [
      'The count of α falls off steeply with angle, roughly as 1/sin⁴(θ/2).',
      'A head-on α (b = 0) comes straight back from a distance d₀.',
      'Faster α or a smaller Z nucleus → smaller d₀ and less deflection.',
    ],
    challenge: 'Calculate d₀ for a 5 MeV α on gold. What does this tell you about the size of the gold nucleus?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, acc = 0, fired = 0, back = 0;
    const hist = new Array<number>(BINS).fill(0);
    let alphas: Alpha[] = [];
    const sample = sampler(1 / 4);
    kit.sphere(0.35, C.positive, { emissive: 0.6 });
    const nLabel = kit.label('', [0, -0.9, 0], { color: C.positive, small: true });
    const trace = kit.trail('#facc15', 800, { width: 2.5 });
    const tracer = kit.sphere(0.14, '#facc15', { emissive: 0.8 });
    const tr = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), running: false, wait: 0 };
    const ring = kit.line('#e2e8f0', [], { width: 1, dashed: true, opacity: 0.6 });
    const bLine = kit.line('#94a3b8', [], { width: 1, dashed: true });
    const bLabel = kit.label('', [0, 0, 0], { small: true });
    const thLabel = kit.label('', [0, 0, 0], { small: true, color: '#facc15' });
    kit.line('#64748b', [[X_START, 0, 0], [R_END, 0, 0]], { width: 1, opacity: 0.4 });

    const tgt = () => TARGETS[str(p, 'target')] ?? TARGETS.au;
    const Z = () => tgt().Z;
    const d0fm = () => (1.44 * 2 * Z()) / num(p, 'KE'); // fm
    const d0 = () => d0fm() / FM; // scene
    const thetaOf = (bfm: number) => (bfm <= 0 ? Math.PI : 2 * Math.atan(d0fm() / (2 * bfm)));
    /** Coulomb acceleration a = (v₀²/2)·d₀ / r² along r̂ (repulsive). */
    function accel(pos: THREE.Vector3, out: THREE.Vector3) {
      const r2 = Math.max(pos.lengthSq(), 1e-4);
      return out.copy(pos).multiplyScalar(((V0 * V0) / 2) * d0() / (r2 * Math.sqrt(r2)));
    }
    const tmp = new THREE.Vector3();
    function advance(pos: THREE.Vector3, vel: THREE.Vector3, dt: number) {
      // velocity Verlet with sub-steps near the nucleus
      const r = pos.length();
      const k = r < 3 ? 8 : 2;
      const h = dt / k;
      for (let i = 0; i < k; i++) {
        accel(pos, tmp); vel.addScaledVector(tmp, h / 2);
        pos.addScaledVector(vel, h);
        accel(pos, tmp); vel.addScaledVector(tmp, h / 2);
      }
    }
    function expected() {
      // uniform disc beam: fraction scattered beyond θ is b(θ)²/Bmax², b(θ) = (d₀/2)cot(θ/2)
      const bOf = (th: number) => Math.min(BMAX, (d0() / 2) / Math.tan(th / 2));
      return (i: number) => {
        const t1 = ((20 + i * 10) * Math.PI) / 180, t2 = ((30 + i * 10) * Math.PI) / 180;
        return fired * (bOf(t1) ** 2 - bOf(t2) ** 2) / (BMAX * BMAX);
      };
    }
    function histogram() {
      const ex = expected();
      const G = graphs.get('H');
      const step = (f: (i: number) => number) => (x: number) => { const i = Math.min(BINS - 1, Math.max(0, Math.floor((x - 20) / 10))); return f(i); };
      G.plot(0, 20, 180, step((i) => hist[i]), 320);
      G.plot(1, 20, 180, step(ex), 320);
    }
    function launchTracer() {
      tr.pos.set(X_START, num(p, 'b') / FM, 0);
      tr.vel.set(V0, 0, 0);
      tr.running = true;
      trace.clearPoints();
    }
    function build() {
      nLabel.setText(`Z = ${Z()}`);
      const pts: [number, number, number][] = [];
      for (let a = 0; a <= 64; a++) pts.push([d0() * Math.cos((a / 64) * Math.PI * 2), d0() * Math.sin((a / 64) * Math.PI * 2), 0]);
      ring.setPoints(pts);
      const b = num(p, 'b') / FM;
      bLine.setPoints([[X_START, b, 0], [0, b, 0]]);
      bLabel.at([X_START + 1.5, b + 0.45, 0]).setText(`b = ${n(num(p, 'b'))} fm`);
      graphs.get('B').plot(0, 0, 60, (bf) => deg(thetaOf(bf)), 300);
      graphs.get('B').setMarkers([{ x: num(p, 'b'), y: deg(thetaOf(num(p, 'b'))), color: '#facc15' }]);
    }
    function clearBeam() {
      alphas.forEach((a) => { a.mesh.removeFromParent(); a.mesh.geometry.dispose(); });
      alphas = []; hist.fill(0); fired = 0; back = 0;
    }
    function reset() { t = 0; acc = 0; clearBeam(); launchTracer(); build(); histogram(); sample.reset(); }
    reset();

    return {
      setParams(np) {
        const physicsChanged = num(np, 'KE') !== num(p, 'KE') || str(np, 'target') !== str(p, 'target');
        const bChanged = num(np, 'b') !== num(p, 'b');
        p = np;
        if (physicsChanged) clearBeam();
        if (physicsChanged || bChanged) launchTracer();
        build(); histogram();
      },
      reset,
      step(dt) {
        t += dt;
        if (tr.running) {
          advance(tr.pos, tr.vel, dt);
          if (tr.pos.length() > R_END) { tr.running = false; tr.wait = 1.2; }
        } else if ((tr.wait -= dt) <= 0) launchTracer();
        if (bool(p, 'beam')) {
          acc += dt * num(p, 'rate');
          while (acc >= 1 && alphas.length < 250) {
            acc -= 1;
            // uniform over a disc of radius BMAX perpendicular to the beam
            const r = BMAX * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
            const mesh = kit.sphere(0.07, C.acceleration, { emissive: 0.7 }, 6);
            alphas.push({ pos: new THREE.Vector3(X_START, r * Math.cos(a), r * Math.sin(a)), vel: new THREE.Vector3(V0, 0, 0), mesh, done: false });
            fired++;
          }
        }
        for (const al of alphas) {
          advance(al.pos, al.vel, dt);
          if (al.pos.length() > R_END || al.pos.x > R_END) {
            al.done = true;
            const th = deg(Math.acos(Math.max(-1, Math.min(1, al.vel.x / al.vel.length()))));
            if (th >= 90) back++;
            if (th >= 20) hist[Math.min(BINS - 1, Math.floor((th - 20) / 10))]++;
          }
        }
        alphas = alphas.filter((al) => { if (al.done) { al.mesh.removeFromParent(); al.mesh.geometry.dispose(); } return !al.done; });
        if (sample.due(t)) histogram();
      },
      render() {
        tracer.position.copy(tr.pos);
        trace.push(tr.pos); trace.flush();
        for (const al of alphas) al.mesh.position.copy(al.pos);
        const th = thetaOf(num(p, 'b'));
        thLabel.at([3 * Math.cos(th), 3 * Math.sin(th) + 0.4, 0]).setText(`θ = ${n(deg(th))}°`);
      },
      time: () => t,
      actions(): SimAction[] {
        return [{ id: 'clear', label: 'Clear counts', run: () => { clearBeam(); histogram(); } }];
      },
      readouts(): Readout[] {
        return [
          { label: 'Closest approach d₀ (head-on)', value: d0fm(), unit: 'fm', tone: 'accent' },
          { label: 'Scattering angle of traced α', value: deg(thetaOf(num(p, 'b'))), unit: '°', tone: 'accent' },
          { label: 'Minimum distance of traced α', value: (d0fm() / 2) * (1 + 1 / Math.sin(thetaOf(num(p, 'b')) / 2)), unit: 'fm' },
          { label: 'α fired (beam)', value: fired },
          { label: 'Scattered beyond 90°', value: back },
          { label: 'Fraction beyond 90°', value: fired ? back / fired : 0 },
          { label: 'Nuclear radius R ≈ 1.2 A^⅓', value: 1.2 * Math.cbrt(tgt().A), unit: 'fm' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'd₀ = 2kZe² / KE', sub: `= 1.44 MeV·fm × 2 × ${Z()} / ${n(num(p, 'KE'))} MeV = ${n(d0fm())} fm` },
          { expr: 'tan(θ/2) = d₀ / 2b', sub: `θ = ${n(deg(thetaOf(num(p, 'b'))))}°` },
          { expr: 'N(θ) ∝ 1 / sin⁴(θ/2)', note: 'Rutherford scattering formula' },
        ];
      },
    };
  },
};

export default sim;
