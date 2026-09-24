import * as THREE from 'three';
import type { Equation, Params, Readout, SimAction, SimDefinition } from '../types';
import { bool, num } from '../types';
import { MeVperU } from '../../physics/constants';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const HALF = 5; // fuel block half-size (scene units)
const CAPTURE = 0.5; // effective capture radius (cross-section, enlarged for visibility)
const NSPEED = 3;
const MAXN = 260;
// atomic masses (u)
const M = { u235: 235.043_930, n: 1.008_665, ba141: 140.914_411, kr92: 91.926_156 };
const Q_PROMPT = (M.u235 + M.n - (M.ba141 + M.kr92 + 3 * M.n)) * MeVperU; // ≈ 173 MeV
const Q_TOTAL = 200; // MeV including later decays of the fragments

interface Nucleus { pos: THREE.Vector3; fissile: boolean; alive: boolean; mesh: THREE.Mesh }
interface Neutron { pos: THREE.Vector3; vel: THREE.Vector3; mesh: THREE.Mesh; dead: boolean; passed: Nucleus | null }
interface Frag { a: THREE.Mesh; b: THREE.Mesh; dir: THREE.Vector3; age: number; at: THREE.Vector3 }

const sim: SimDefinition = {
  camera: { position: [12, 9, 14], target: [0, 0, 0], aspect: 1.4 },
  hint: 'Each U-235 fission releases 2–3 neutrons. If on average more than one of them causes another fission (k > 1), the reaction grows — a chain reaction.',
  params: [
    { kind: 'slider', key: 'N', label: 'Number of uranium nuclei', min: 20, max: 300, step: 10, default: 220 },
    { kind: 'slider', key: 'enrich', label: 'Fraction that is U-235 (enrichment)', unit: '%', min: 0, max: 100, step: 1, default: 80 },
    { kind: 'slider', key: 'rods', label: 'Control rods (neutron absorption)', unit: '%', min: 0, max: 100, step: 1, default: 0 },
    { kind: 'toggle', key: 'source', label: 'Neutron source (one every 2 s)', default: false },
  ],
  presets: [
    { label: 'Supercritical (bomb-like)', values: { N: 300, enrich: 90, rods: 0 } },
    { label: 'Subcritical', values: { N: 120, enrich: 30, rods: 0 } },
    { label: 'Reactor with control rods', values: { N: 300, enrich: 90, rods: 45, source: true } },
    { label: 'Natural uranium (0.7 %)', values: { N: 300, enrich: 1, rods: 0, source: true } },
  ],
  graphs: [
    { id: 'F', title: 'Chain reaction', x: 't (s)', y: 'count', window: 30, zeroY: true, series: [{ label: 'free neutrons', color: '#e2e8f0' }, { label: 'fissions per second', color: C.hot }] },
  ],
  learn: {
    concept: 'A slow neutron absorbed by U-235 makes the nucleus unstable; it splits into two medium nuclei (e.g. Ba-141 and Kr-92), releasing 2–3 neutrons and about 200 MeV. The energy comes from the mass defect: the products weigh about 0.19 u less than the reactants (E = Δm c²). If each fission causes on average k further fissions, the neutron population grows (k > 1, supercritical), stays steady (k = 1, critical — a reactor) or dies away (k < 1). Control rods absorb neutrons to hold k = 1.',
    variables: [['k', 'multiplication factor'], ['Δm', 'mass defect'], ['Q', 'energy released per fission (~200 MeV)'], ['U-235', 'fissile isotope (0.7 % of natural uranium)']],
    observe: [
      'With little fuel, neutrons escape through the surface before causing fission — there is a critical mass.',
      'Lowering the enrichment makes the reaction die out.',
      'Control rods can hold a steady (critical) reaction when a source keeps supplying neutrons.',
    ],
    challenge: 'How many fissions per second are needed to produce 1000 MW?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, srcTimer = 0, fissions = 0, recentF = 0, fromFission = 0, lost = 0, captured238 = 0;
    let rateF = 0;
    let nuclei: Nucleus[] = [];
    let neutrons: Neutron[] = [];
    let frags: Frag[] = [];
    const grid = new Map<string, Nucleus[]>();
    const sample = sampler(1 / 2);
    const secT = sampler(1);
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2)), new THREE.LineBasicMaterial({ color: '#64748b' }));
    kit.add(box);
    kit.label('U-235', [-HALF, HALF + 0.8, 0], { color: '#4ade80', small: true });
    kit.label('U-238', [HALF, HALF + 0.8, 0], { color: '#94a3b8', small: true });
    const geo = new THREE.SphereGeometry(0.28, 12, 8);
    const mat235 = kit.mat('#4ade80', { emissive: 0.25 }), mat238 = kit.mat('#94a3b8'), matN = kit.mat('#f8fafc', { emissive: 1 });
    const matBa = kit.mat('#f97316', { emissive: 0.6 }), matKr = kit.mat('#a78bfa', { emissive: 0.6 });
    const nGeo = new THREE.SphereGeometry(0.09, 8, 6), fGeo = new THREE.SphereGeometry(0.22, 10, 8);
    const key = (x: number, y: number, z: number) => `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;

    function build() {
      nuclei.forEach((q) => q.mesh.removeFromParent());
      nuclei = []; grid.clear();
      const N = num(p, 'N'), f = num(p, 'enrich') / 100;
      let nf = Math.round(N * f);
      // seeded-looking but random placement with a minimum separation
      let tries = 0;
      while (nuclei.length < N && tries < N * 60) {
        tries++;
        const pos = new THREE.Vector3((Math.random() * 2 - 1) * (HALF - 0.4), (Math.random() * 2 - 1) * (HALF - 0.4), (Math.random() * 2 - 1) * (HALF - 0.4));
        if (nuclei.some((q) => q.pos.distanceToSquared(pos) < 0.7 * 0.7)) continue;
        const fissile = nf > 0 && Math.random() < nf / (N - nuclei.length);
        if (fissile) nf--;
        const mesh = new THREE.Mesh(geo, fissile ? mat235 : mat238);
        mesh.position.copy(pos);
        kit.add(mesh);
        const q = { pos, fissile, alive: true, mesh };
        nuclei.push(q);
        const k = key(pos.x, pos.y, pos.z);
        (grid.get(k) ?? grid.set(k, []).get(k)!).push(q);
      }
    }
    function addNeutron(at: THREE.Vector3, dir?: THREE.Vector3) {
      if (neutrons.length >= MAXN) return false;
      const d = dir ?? new THREE.Vector3().randomDirection();
      const mesh = new THREE.Mesh(nGeo, matN);
      mesh.position.copy(at);
      kit.add(mesh);
      neutrons.push({ pos: at.clone(), vel: d.multiplyScalar(NSPEED), mesh, dead: false, passed: null });
      return true;
    }
    function fire() { addNeutron(new THREE.Vector3(-HALF, 0, 0), new THREE.Vector3(1, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2).normalize()); }
    function fission(q: Nucleus) {
      q.alive = false; q.mesh.visible = false;
      fissions++; recentF++;
      const nOut = Math.random() < 0.43 ? 3 : 2; // average ≈ 2.43
      for (let i = 0; i < nOut; i++) if (addNeutron(q.pos.clone())) fromFission++;
      const dir = new THREE.Vector3().randomDirection();
      const a = new THREE.Mesh(fGeo, matBa), b = new THREE.Mesh(fGeo, matKr);
      b.scale.setScalar(0.85);
      kit.add(a); kit.add(b);
      frags.push({ a, b, dir, age: 0, at: q.pos.clone() });
    }
    function clearMoving() {
      neutrons.forEach((q) => q.mesh.removeFromParent()); neutrons = [];
      frags.forEach((f) => { f.a.removeFromParent(); f.b.removeFromParent(); }); frags = [];
    }
    function reset() {
      t = 0; srcTimer = 0; fissions = 0; recentF = 0; fromFission = 0; lost = 0; captured238 = 0; rateF = 0;
      clearMoving(); build(); sample.reset(); secT.reset();
      fire();
    }
    reset();

    return {
      setParams(np) {
        const rebuild = num(np, 'N') !== num(p, 'N') || num(np, 'enrich') !== num(p, 'enrich');
        p = np;
        if (rebuild) reset();
      },
      reset,
      step(dt) {
        t += dt;
        if (bool(p, 'source')) { srcTimer += dt; if (srcTimer >= 2) { srcTimer = 0; fire(); } }
        const absorb = (num(p, 'rods') / 100) * 1.2 * dt; // probability per step of absorption in the rods
        for (const nt of neutrons) {
          nt.pos.addScaledVector(nt.vel, dt);
          if (Math.abs(nt.pos.x) > HALF || Math.abs(nt.pos.y) > HALF || Math.abs(nt.pos.z) > HALF) { nt.dead = true; lost++; continue; }
          if (absorb > 0 && Math.random() < absorb) { nt.dead = true; lost++; continue; }
          const cx = Math.floor(nt.pos.x), cy = Math.floor(nt.pos.y), cz = Math.floor(nt.pos.z);
          search: for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
            const cell = grid.get(`${cx + i},${cy + j},${cz + k}`);
            if (!cell) continue;
            for (const q of cell) {
              if (!q.alive || q === nt.passed || q.pos.distanceToSquared(nt.pos) > CAPTURE * CAPTURE) continue;
              if (q.fissile) { nt.dead = true; lost++; fission(q); break search; }
              // U-238: one roll per encounter — occasionally captures (→ U-239), otherwise the neutron passes
              nt.passed = q;
              if (Math.random() < 0.15) { nt.dead = true; lost++; captured238++; break search; }
            }
          }
        }
        neutrons = neutrons.filter((q) => { if (q.dead) q.mesh.removeFromParent(); return !q.dead; });
        for (const f of frags) f.age += dt;
        frags = frags.filter((f) => { if (f.age > 1.6) { f.a.removeFromParent(); f.b.removeFromParent(); return false; } return true; });
        if (secT.due(t)) { rateF = recentF; recentF = 0; }
        if (sample.due(t)) graphs.get('F').push(t, neutrons.length, rateF);
      },
      render() {
        for (const nt of neutrons) nt.mesh.position.copy(nt.pos);
        for (const f of frags) {
          const s = f.age * 2.2;
          f.a.position.copy(f.at).addScaledVector(f.dir, s);
          f.b.position.copy(f.at).addScaledVector(f.dir, -s * 1.4);
        }
      },
      time: () => t,
      actions(): SimAction[] {
        return [{ id: 'fire', label: 'Fire a neutron', primary: true, run: fire }];
      },
      readouts(): Readout[] {
        const remaining = nuclei.filter((q) => q.fissile && q.alive).length;
        const k = lost > 0 ? fromFission / lost : 0;
        return [
          { label: 'Fissions so far', value: fissions, tone: 'accent' },
          { label: 'Free neutrons', value: neutrons.length },
          { label: 'U-235 nuclei remaining', value: remaining },
          { label: 'k ≈ fission neutrons ÷ neutrons lost', value: k, tone: k > 1.05 ? 'bad' : k > 0.9 ? 'good' : undefined },
          { label: 'Energy released', value: fissions * Q_TOTAL, unit: 'MeV' },
          { label: 'Energy released (joules)', value: fissions * Q_TOTAL * 1.602e-13, unit: 'J' },
          { label: 'U-238 captures', value: captured238 },
          { label: 'Reaction', value: neutrons.length === 0 ? 'Stopped' : rateF > 0 ? 'Running' : 'Neutrons wandering' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: '¹n + ²³⁵U → ¹⁴¹Ba + ⁹²Kr + 3 ¹n + Q' },
          { expr: 'Δm = (235.04393 + 1.00867) − (140.91441 + 91.92616 + 3 × 1.00867)', sub: `= ${n(Q_PROMPT / MeVperU)} u` },
          { expr: 'Q = Δm × 931.5 MeV', sub: `= ${n(Q_PROMPT)} MeV (≈ 200 MeV with fragment decays)` },
        ];
      },
      dispose() { geo.dispose(); nGeo.dispose(); fGeo.dispose(); },
    };
  },
};

export default sim;
