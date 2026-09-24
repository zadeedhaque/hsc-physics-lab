import * as THREE from 'three';
import type { Equation, Params, Readout, SimAction, SimDefinition } from '../types';
import { num, str } from '../types';
import { kB, e as eC } from '../../physics/constants';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const HALF = 4;
const RCOL = 0.35; // encounter distance (scene)
const BOOST = 2000; // encounter rate enlarged for visibility (reported in the readouts)

interface Reaction { name: string; a: string; b: string; EG: number; Q: number; product: string; light: string; barrier: number }
/** Gamow energy E_G = (παZ₁Z₂)²·2m_r c² in keV; Q in MeV; Coulomb barrier at ~4 fm in keV. */
const REACTIONS: Record<string, Reaction> = {
  dt: { name: 'D + T → ⁴He + n', a: 'D', b: 'T', EG: 1182, Q: 17.59, product: '⁴He', light: 'n', barrier: 360 },
  dd: { name: 'D + D → ³He + n', a: 'D', b: 'D', EG: 986, Q: 3.27, product: '³He', light: 'n', barrier: 360 },
  dhe3: { name: 'D + ³He → ⁴He + p', a: 'D', b: '³He', EG: 4702, Q: 18.35, product: '⁴He', light: 'p', barrier: 720 },
};
const COLORS: Record<string, string> = { D: '#60a5fa', T: '#4ade80', '³He': '#f472b6', '⁴He': '#facc15', n: '#f8fafc', p: '#f87171' };

interface Ion { kind: string; pos: THREE.Vector3; vel: THREE.Vector3; mesh: THREE.Mesh; fuel: boolean; escape: boolean; dead: boolean }

const sim: SimDefinition = {
  camera: { position: [8, 6, 11], target: [0, 0, 0], aspect: 1.4 },
  hint: 'Nuclei repel each other strongly. Only at tens of millions of kelvin are they fast enough to tunnel through the Coulomb barrier and fuse.',
  params: [
    { kind: 'select', key: 'rx', label: 'Reaction', default: 'dt', options: Object.entries(REACTIONS).map(([value, r]) => ({ value, label: r.name })) },
    { kind: 'slider', key: 'T', label: 'Plasma temperature', unit: 'million K', min: 1, max: 400, step: 1, default: 150 },
    { kind: 'slider', key: 'N', label: 'Number of fuel nuclei', min: 20, max: 90, step: 2, default: 60 },
  ],
  presets: [
    { label: 'Sun’s core (15 million K)', values: { T: 15 } },
    { label: 'ITER tokamak (150 million K)', values: { rx: 'dt', T: 150 } },
    { label: 'D–D needs more heat', values: { rx: 'dd', T: 150 } },
    { label: 'Very hot (400 million K)', values: { T: 400 } },
  ],
  graphs: [
    { id: 'R', title: 'Relative fusion rate vs temperature', x: 'T (million K)', y: 'rate (relative)', kind: 'curve', xRange: [1, 400], zeroY: true, series: [{ label: 'D–T', color: COLORS.T }, { label: 'D–D', color: COLORS.D }, { label: 'D–³He', color: COLORS['³He'] }] },
    { id: 'E', title: 'Energy released', x: 't (s)', y: 'E (MeV)', window: 30, zeroY: true, series: [{ label: 'total', color: C.hot }] },
  ],
  learn: {
    concept: 'In fusion two light nuclei join to form a heavier one. The product is lighter than the reactants, and the mass defect is released as energy (D + T → ⁴He + n gives 17.6 MeV). Because nuclei repel electrically, the fuel must be a plasma at ~10⁸ K so that nuclei collide fast enough to tunnel through the Coulomb barrier. The rate depends extremely steeply on temperature (the Gamow factor e^(−√(E_G/E))). The Sun fuses hydrogen at only 15 million K because its core is so vast and dense.',
    variables: [['T', 'plasma temperature'], ['kT', 'typical thermal energy (8.6 keV at 10⁸ K)'], ['E_G', 'Gamow energy of the pair'], ['Q', 'energy released per reaction']],
    observe: [
      'Below about 30 million K essentially nothing fuses here.',
      'D–T fuses most easily; D–³He needs much higher temperature (charge 2 barrier).',
      'The fast neutron carries most of the energy out of the plasma.',
    ],
    challenge: 'Why must the plasma in a fusion reactor be kept away from the walls?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, fusions = 0, energy = 0, collisions = 0;
    let ions: Ion[] = [];
    const sample = sampler(1 / 4);
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2)), new THREE.LineBasicMaterial({ color: '#f97316', transparent: true, opacity: 0.5 }));
    kit.add(box);
    const glow = kit.box(HALF * 2 - 0.1, HALF * 2 - 0.1, HALF * 2 - 0.1, '#f97316', { opacity: 0.05, emissive: 1 });
    const flashes: { m: THREE.Mesh; age: number }[] = [];
    const geo = new THREE.SphereGeometry(0.16, 12, 8);
    const mats: Record<string, THREE.Material> = {};
    for (const k of Object.keys(COLORS)) mats[k] = kit.mat(COLORS[k], { emissive: 0.5 });

    const rx = () => REACTIONS[str(p, 'rx')] ?? REACTIONS.dt;
    const kTkeV = () => (kB * num(p, 'T') * 1e6) / eC / 1000;
    const vth = () => 0.7 + 2.3 * Math.sqrt(num(p, 'T') / 400); // per-component spread (scene)

    /** Maxwell-averaged rate ∝ (kT)^(-3/2) ∫ exp(−E/kT − √(E_G/E)) dE  (constant S-factor). */
    function rate(EG: number, TM: number) {
      const kT = (kB * TM * 1e6) / eC / 1000;
      let s = 0;
      for (let i = 1; i <= 300; i++) { const E = i * 2; s += Math.exp(-E / kT - Math.sqrt(EG / E)) * 2; }
      return s / Math.pow(kT, 1.5);
    }
    const norm = rate(REACTIONS.dt.EG, 400);
    function curves() {
      const G = graphs.get('R');
      G.plot(0, 1, 400, (T) => rate(REACTIONS.dt.EG, T) / norm, 200);
      G.plot(1, 1, 400, (T) => rate(REACTIONS.dd.EG, T) / norm, 200);
      G.plot(2, 1, 400, (T) => rate(REACTIONS.dhe3.EG, T) / norm, 200);
      G.setVLines([{ x: num(p, 'T'), label: 'now' }]);
      (glow.material as THREE.MeshStandardMaterial).opacity = 0.02 + 0.1 * Math.min(1, num(p, 'T') / 400);
    }
    const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
    function spawn(kind: string, fuel: boolean, pos?: THREE.Vector3, vel?: THREE.Vector3) {
      const mesh = new THREE.Mesh(geo, mats[kind]);
      if (!fuel) mesh.scale.setScalar(kind === 'n' || kind === 'p' ? 0.6 : 1.2);
      kit.add(mesh);
      const s = vth();
      const ion: Ion = {
        kind, fuel, escape: kind === 'n', dead: false, mesh,
        pos: pos ?? new THREE.Vector3((Math.random() * 2 - 1) * (HALF - 0.3), (Math.random() * 2 - 1) * (HALF - 0.3), (Math.random() * 2 - 1) * (HALF - 0.3)),
        vel: vel ?? new THREE.Vector3(gauss() * s, gauss() * s, gauss() * s),
      };
      ions.push(ion);
      return ion;
    }
    function fill() {
      ions.forEach((i) => i.mesh.removeFromParent()); ions = [];
      const N = num(p, 'N');
      for (let i = 0; i < N; i++) spawn(i % 2 === 0 ? rx().a : rx().b, true);
    }
    function rescale(oldV: number) {
      const f = vth() / oldV;
      for (const i of ions) if (!i.escape) i.vel.multiplyScalar(f);
    }
    function reset() { t = 0; fusions = 0; energy = 0; collisions = 0; flashes.forEach((f) => f.m.removeFromParent()); flashes.length = 0; fill(); curves(); sample.reset(); }
    reset();

    return {
      setParams(np) {
        const old = vth();
        const refill = str(np, 'rx') !== str(p, 'rx') || num(np, 'N') !== num(p, 'N');
        p = np;
        if (refill) reset(); else { rescale(old); curves(); }
      },
      reset,
      step(dt) {
        t += dt;
        for (const i of ions) {
          i.pos.addScaledVector(i.vel, dt);
          for (const ax of ['x', 'y', 'z'] as const) {
            if (Math.abs(i.pos[ax]) > HALF) {
              if (i.escape) { i.dead = true; break; }
              i.pos[ax] = Math.sign(i.pos[ax]) * HALF; i.vel[ax] *= -1;
            }
          }
        }
        // collisions between fuel nuclei
        const R = rx(), s2 = vth() * vth();
        for (let a = 0; a < ions.length; a++) {
          const A = ions[a];
          if (!A.fuel || A.dead) continue;
          for (let b = a + 1; b < ions.length; b++) {
            const B = ions[b];
            if (!B.fuel || B.dead) continue;
            const dx = B.pos.x - A.pos.x, dy = B.pos.y - A.pos.y, dz = B.pos.z - A.pos.z;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > RCOL * RCOL) continue;
            const rv = new THREE.Vector3().subVectors(B.vel, A.vel);
            const dir = new THREE.Vector3(dx, dy, dz).normalize();
            const closing = rv.dot(dir);
            if (closing >= 0) continue; // already separating
            collisions++;
            const pair = (A.kind === R.a && B.kind === R.b) || (A.kind === R.b && B.kind === R.a);
            const Erel = (kTkeV() * rv.lengthSq()) / (4 * s2); // ⟨E_rel⟩ = 3/2 kT
            if (pair && Math.random() < Math.min(1, BOOST * Math.exp(-Math.sqrt(R.EG / Math.max(Erel, 1e-6))))) {
              A.dead = true; B.dead = true;
              fusions++; energy += R.Q;
              const at = A.pos.clone().add(B.pos).multiplyScalar(0.5);
              const cm = A.vel.clone().add(B.vel).multiplyScalar(0.5);
              const out = new THREE.Vector3().randomDirection();
              spawn(R.product, false, at.clone(), cm.clone().addScaledVector(out, -1.2));
              const light = spawn(R.light, false, at.clone(), cm.clone().addScaledVector(out, 7));
              light.escape = R.light === 'n';
              const f = kit.sphere(0.5, '#fde68a', { emissive: 1, opacity: 0.8 });
              f.position.copy(at); flashes.push({ m: f, age: 0 });
              break;
            }
            // elastic bounce (equal masses): exchange the velocity components along the line of centres
            A.vel.addScaledVector(dir, closing); B.vel.addScaledVector(dir, -closing);
          }
        }
        ions = ions.filter((i) => { if (i.dead) i.mesh.removeFromParent(); return !i.dead; });
        for (const f of flashes) f.age += dt;
        for (let k = flashes.length - 1; k >= 0; k--) if (flashes[k].age > 0.6) { flashes[k].m.removeFromParent(); flashes.splice(k, 1); }
        if (sample.due(t)) graphs.get('E').push(t, energy);
      },
      render() {
        for (const i of ions) i.mesh.position.copy(i.pos);
        for (const f of flashes) f.m.scale.setScalar(1 + f.age * 3);
      },
      time: () => t,
      actions(): SimAction[] {
        return [{ id: 'refuel', label: 'Refuel', run: fill }];
      },
      readouts(): Readout[] {
        const R = rx();
        const fuel = ions.filter((i) => i.fuel).length;
        const Emean = 1.5 * kTkeV();
        return [
          { label: 'Thermal energy kT', value: kTkeV(), unit: 'keV' },
          { label: 'Coulomb barrier (≈)', value: R.barrier, unit: 'keV' },
          { label: 'Tunnelling factor at 3/2 kT', value: Math.exp(-Math.sqrt(R.EG / Emean)), tone: 'accent' },
          { label: 'Fusions', value: fusions, tone: 'accent' },
          { label: 'Energy released', value: energy, unit: 'MeV' },
          { label: 'Energy per reaction Q', value: R.Q, unit: 'MeV' },
          { label: 'Fuel nuclei left', value: fuel },
          { label: 'Collisions (encounter rate × ' + BOOST + ')', value: collisions },
        ];
      },
      equations(): Equation[] {
        const R = rx();
        return [
          { expr: R.name + ' + Q', sub: `Q = ${n(R.Q)} MeV` },
          { expr: 'kT at T', sub: `= 1.38×10⁻²³ × ${n(num(p, 'T') * 1e6)} = ${n(kTkeV())} keV` },
          { expr: 'P(tunnel) ≈ e^(−√(E_G / E))', sub: `E_G = ${n(R.EG)} keV → at E = 3/2 kT: ${n(Math.exp(-Math.sqrt(R.EG / (1.5 * kTkeV()))))}` },
        ];
      },
      dispose() { geo.dispose(); },
    };
  },
};

export default sim;
