import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num } from '../types';
import { decayConstant, decayProbability, remaining, meanLife } from '../../physics/nuclear';
import { rng } from '../../lib/num';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const PARENT = new THREE.Color('#38bdf8');
const DAUGHTER = new THREE.Color('#334155');
const FLASH = new THREE.Color('#fde047');

const sim: SimDefinition = {
  camera: { position: [0, 9, 14], target: [0, 0, 0], aspect: 1.4 },
  hint: 'Each nucleus decays at random — only the average follows the smooth exponential.',
  params: [
    { kind: 'slider', key: 'N0', label: 'Initial nuclei N₀', unit: '', min: 100, max: 2500, step: 100, default: 1000 },
    { kind: 'slider', key: 'half', label: 'Half-life T½', unit: 's', min: 1, max: 30, step: 0.5, default: 5 },
    { kind: 'slider', key: 'seed', label: 'Random seed', unit: '', min: 1, max: 50, step: 1, default: 7, hint: 'Change to run a different random sample' },
    { kind: 'toggle', key: 'theory', label: 'Show theoretical curve', default: true },
  ],
  presets: [
    { label: 'Fast (T½ = 2 s)', values: { half: 2, N0: 1000 } },
    { label: 'Standard (T½ = 5 s)', values: { half: 5, N0: 1000 } },
    { label: 'Slow (T½ = 15 s)', values: { half: 15, N0: 1000 } },
    { label: 'Small sample (100)', values: { N0: 100, half: 5 } },
    { label: 'Large sample (2500)', values: { N0: 2500, half: 5 } },
  ],
  graphs: [
    { id: 'N', title: 'Undecayed nuclei vs time', x: 't (s)', y: 'N', zeroY: true, series: [{ label: 'simulated N', color: C.accent }, { label: 'N₀ e^(−λt)', color: '#e2e8f0', dashed: true }] },
    { id: 'A', title: 'Activity vs time (decays per second, 0.5 s bins)', x: 't (s)', y: 'A (Bq)', zeroY: true, series: [{ label: 'measured A', color: C.weight }, { label: 'λN (theory)', color: '#e2e8f0', dashed: true }] },
  ],
  learn: {
    concept: 'Radioactive decay is random: you cannot say when a particular nucleus will decay, only the probability per second, λ. For a large number of nuclei this gives an exponential decrease N = N₀e^(−λt). The half-life T½ = ln 2 / λ is the time for half the remaining nuclei to decay.',
    variables: [['N', 'number of undecayed nuclei'], ['N₀', 'initial number'], ['λ', 'decay constant (s⁻¹)'], ['T½', 'half-life (s)'], ['A', 'activity = λN (Bq)'], ['τ', 'mean life = 1/λ']],
    observe: [
      'After one half-life about half remain; after two, a quarter; after three, an eighth.',
      'Small samples fluctuate much more around the theoretical curve.',
      'Activity falls with the same half-life as N.',
      'Change the seed: the curve changes in detail but not on average.',
    ],
    challenge: 'Predict how many nuclei will remain from N₀ = 2000 after 3 half-lives. Run it and compare with your prediction.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    let alive: Uint8Array = new Uint8Array(0);
    let flash: Float32Array = new Float32Array(0);
    let N = 0;
    let decaysInBin = 0;
    let binStart = 0;
    let rand = rng(1);
    const sample = sampler(1 / 10);
    let mesh: THREE.InstancedMesh | null = null;
    const counter = kit.label('', [0, 3.2, 0]);

    function build() {
      if (mesh) { kit.root.remove(mesh); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); mesh.dispose(); }
      const N0 = Math.round(num(p, 'N0'));
      const side = Math.ceil(Math.sqrt(N0));
      const spacing = Math.min(0.42, 11 / side);
      mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(spacing * 0.38, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1 }), N0);
      const o = new THREE.Object3D();
      const jitter = rng(99);
      for (let i = 0; i < N0; i++) {
        const gx = i % side, gz = Math.floor(i / side);
        o.position.set((gx - (side - 1) / 2) * spacing, (jitter() - 0.5) * spacing * 0.3, (gz - (side - 1) / 2) * spacing);
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
        mesh.setColorAt(i, PARENT);
      }
      kit.add(mesh);
      reset();
    }

    function reset() {
      const N0 = Math.round(num(p, 'N0'));
      alive = new Uint8Array(N0).fill(1);
      flash = new Float32Array(N0);
      N = N0;
      t = 0; decaysInBin = 0; binStart = 0;
      rand = rng(Math.round(num(p, 'seed')) * 7919);
      sample.reset();
      if (mesh) { for (let i = 0; i < N0; i++) mesh.setColorAt(i, PARENT); if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
      theory();
      graphs.get('N').push(0, N0);
    }

    function theory() {
      const N0 = num(p, 'N0'), T = num(p, 'half');
      const tEnd = Math.max(5 * T, 10);
      graphs.get('N').plot(1, 0, tEnd, (x) => (bool(p, 'theory') ? remaining(N0, T, x) : NaN), 200);
      graphs.get('A').plot(1, 0, tEnd, (x) => (bool(p, 'theory') ? decayConstant(T) * remaining(N0, T, x) : NaN), 200);
      graphs.get('N').setVLines([1, 2, 3, 4].map((k) => ({ x: k * T, label: `${k}T½` })));
    }

    build();

    return {
      setParams(np) {
        const rebuild = np.N0 !== p.N0;
        const restart = rebuild || np.half !== p.half || np.seed !== p.seed;
        p = np;
        if (rebuild) { graphs.clearLive(); build(); }
        else if (restart) { graphs.clearLive(); reset(); }
        else theory();
      },
      reset,
      step(dt) {
        if (N === 0) return;
        const prob = decayProbability(num(p, 'half'), dt);
        for (let i = 0; i < alive.length; i++) {
          if (alive[i] && rand() < prob) { alive[i] = 0; N--; flash[i] = 0.35; decaysInBin++; }
        }
        t += dt;
        if (t - binStart >= 0.5) {
          graphs.get('A').push(binStart + 0.25, decaysInBin / (t - binStart));
          decaysInBin = 0; binStart = t;
        }
        if (sample.due(t) || N === 0) graphs.get('N').push(t, N);
      },
      render() {
        if (!mesh) return;
        let dirty = false;
        const c = new THREE.Color();
        for (let i = 0; i < alive.length; i++) {
          if (flash[i] > 0) {
            flash[i] = Math.max(0, flash[i] - 1 / 60);
            c.copy(DAUGHTER).lerp(FLASH, flash[i] / 0.35);
            mesh.setColorAt(i, c);
            dirty = true;
          } else if (!alive[i] && flash[i] === 0) {
            flash[i] = -1; // settled
            mesh.setColorAt(i, DAUGHTER);
            dirty = true;
          }
        }
        if (dirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        counter.setText(`N = ${N} / ${Math.round(num(p, 'N0'))}`);
      },
      done: () => N === 0,
      time: () => t,
      readouts(): Readout[] {
        const T = num(p, 'half'), N0 = num(p, 'N0');
        const Nth = remaining(N0, T, t);
        return [
          { label: 'Undecayed N (simulated)', value: N, tone: 'accent' },
          { label: 'N theory N₀e^(−λt)', value: Nth },
          { label: 'Deviation from theory', value: Nth > 0 ? ((N - Nth) / Nth) * 100 : 0, unit: '%' },
          { label: 'Decay constant λ', value: decayConstant(T), unit: 's⁻¹' },
          { label: 'Mean life τ = 1/λ', value: meanLife(T), unit: 's' },
          { label: 'Activity λN', value: decayConstant(T) * N, unit: 'Bq' },
          { label: 'Half-lives elapsed', value: t / T },
          { label: 'Fraction remaining', value: N / N0 },
        ];
      },
      equations(): Equation[] {
        const T = num(p, 'half'), N0 = num(p, 'N0');
        return [
          { expr: 'N = N₀ e^(−λt)', sub: `N = ${n(N0)} × e^(−${n(decayConstant(T))} × ${n(t)}) = ${n(remaining(N0, T, t))}` },
          { expr: 'λ = ln 2 / T½ = 0.693 / T½', sub: `λ = 0.693 / ${n(T)} = ${n(decayConstant(T))} s⁻¹` },
          { expr: 'A = λN = −dN/dt', sub: `A = ${n(decayConstant(T) * N)} Bq` },
          { expr: 'N = N₀ (½)^(t/T½)', sub: `t/T½ = ${n(t / T)}` },
        ];
      },
    };
  },
};

export default sim;
