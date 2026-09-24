import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { kB, u as AMU } from '../../physics/constants';
import { maxwell, vrms, vmean, vmostProbable, meanKE } from '../../physics/thermo';
import { ParticleBox, boxEdges } from '../particles';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const GASES: Record<string, { name: string; M: number }> = {
  h2: { name: 'Hydrogen H₂ (2 u)', M: 2 },
  he: { name: 'Helium (4 u)', M: 4 },
  n2: { name: 'Nitrogen N₂ (28 u)', M: 28 },
  o2: { name: 'Oxygen O₂ (32 u)', M: 32 },
  co2: { name: 'Carbon dioxide (44 u)', M: 44 },
};
const OPTIONS = Object.entries(GASES).map(([value, g]) => ({ value, label: g.name }));
const NP = 500;

const sim: SimDefinition = {
  camera: { position: [0, 2.5, 9], target: [0, 0, 0], aspect: 1.4 },
  hint: 'The histogram is built from the actual simulated molecules and follows the Maxwell curve.',
  params: [
    { kind: 'select', key: 'focus', label: 'Mode', default: 'dist', options: [{ value: 'dist', label: 'One gas' }, { value: 'rms', label: 'Compare speeds' }, { value: 'ke', label: 'Compare energies' }] },
    { kind: 'select', key: 'gas', label: 'Gas', default: 'n2', options: OPTIONS },
    { kind: 'select', key: 'gas2', label: 'Second gas', default: 'he', options: OPTIONS, showIf: (p) => p.focus !== 'dist' },
    { kind: 'slider', key: 'T', label: 'Temperature', unit: 'K', min: 50, max: 2000, step: 10, default: 300 },
  ],
  presets: [
    { label: 'Air at room temp.', values: { focus: 'dist', gas: 'n2', T: 300 } },
    { label: 'Hot (1500 K)', values: { focus: 'dist', gas: 'n2', T: 1500 } },
    { label: 'H₂ vs O₂ speeds', values: { focus: 'rms', gas: 'o2', gas2: 'h2', T: 300 } },
    { label: 'Equal mean KE', values: { focus: 'ke', gas: 'co2', gas2: 'he', T: 300 } },
  ],
  graphs: [
    { id: 'hist', title: 'Speed distribution', x: 'speed (m/s)', y: 'fraction per (m/s)', kind: 'curve', zeroY: true, series: [{ label: 'simulated molecules', color: C.weight }, { label: 'Maxwell (gas 1)', color: C.accent }, { label: 'Maxwell (gas 2)', color: C.acceleration }] },
  ],
  learn: {
    concept: 'Molecules in a gas do not all move at the same speed. Their speeds follow the Maxwell–Boltzmann distribution. Three averages are used: the most probable speed √(2kT/m), the mean speed √(8kT/πm) and the root-mean-square speed √(3kT/m). The mean kinetic energy per molecule, (3/2)kT, depends only on the temperature.',
    variables: [['c_rms', '√(3kT/m) = √(3RT/M)'], ['c̄', 'mean speed √(8kT/πm)'], ['c_p', 'most probable speed √(2kT/m)'], ['M', 'molar mass (kg/mol)'], ['KE', '(3/2)kT per molecule']],
    observe: [
      'Raising T flattens and widens the curve and shifts it to higher speeds.',
      'Lighter molecules are much faster: c_rms ∝ 1/√M.',
      'Different gases at the same T have the same mean kinetic energy.',
      'c_p < c̄ < c_rms always.',
    ],
    challenge: 'At what temperature does nitrogen have the same rms speed that helium has at 300 K?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const sample = sampler(0.25);
    const box = new ParticleBox(kit, NP, 0.05);
    const edges = kit.segments('#94a3b8', { width: 1.2 });
    edges.setSegments(boxEdges(3, 2, 2));
    box.setHalf(3, 2, 2);

    const M1 = () => (GASES[str(p, 'gas')] ?? GASES.n2).M;
    const M2 = () => (GASES[str(p, 'gas2')] ?? GASES.he).M;
    const two = () => str(p, 'focus') !== 'dist';
    const vScale = () => 2.2 / vrms(300, M1() / 1000); // display units per m/s (fixed, so heating visibly speeds molecules up)

    function refill() {
      box.seed(21);
      const sigma = Math.sqrt((kB * num(p, 'T')) / (M1() * AMU));
      box.fill(NP, sigma * vScale());
      curves();
    }
    function curves() {
      const T = num(p, 'T');
      const vmax = 4 * vrms(T, Math.min(M1(), two() ? M2() : M1()) / 1000);
      const G = graphs.get('hist');
      G.plot(1, 0, vmax, (v) => maxwell(v, T, M1() / 1000), 200);
      G.plot(2, 0, vmax, (v) => (two() ? maxwell(v, T, M2() / 1000) : NaN), 200);
      G.setVLines([{ x: vmostProbable(T, M1() / 1000), label: 'cₚ' }, { x: vmean(T, M1() / 1000), label: 'c̄' }, { x: vrms(T, M1() / 1000), label: 'c_rms' }]);
    }
    function histogram() {
      const T = num(p, 'T');
      const vmax = 4 * vrms(T, Math.min(M1(), two() ? M2() : M1()) / 1000);
      const bins = 28, w = vmax / bins;
      const counts = new Array(bins).fill(0);
      for (let i = 0; i < box.count; i++) {
        const v = box.speed(i) / vScale();
        const b = Math.floor(v / w);
        if (b >= 0 && b < bins) counts[b]++;
      }
      const xs: number[] = [], ys: number[] = [];
      counts.forEach((c, b) => { const y = c / (box.count * w); xs.push(b * w, b * w, (b + 1) * w, (b + 1) * w); ys.push(0, y, y, 0); });
      graphs.get('hist').setSeries(0, xs, ys);
    }
    refill();

    return {
      setParams(np) {
        const prevT = num(p, 'T');
        const regen = np.gas !== p.gas;
        p = np;
        if (regen) refill();
        else { box.scaleSpeeds(Math.sqrt(num(p, 'T') / prevT)); curves(); }
      },
      reset() { t = 0; refill(); },
      step(dt) { t += dt; box.step(dt * 0.6); if (sample.due(t)) histogram(); },
      render() { box.render(1, 2.2 * Math.sqrt(num(p, 'T') / 300)); },
      time: () => t,
      readouts(): Readout[] {
        const T = num(p, 'T');
        const out: Readout[] = [
          { label: 'Most probable speed cₚ', value: vmostProbable(T, M1() / 1000), unit: 'm/s' },
          { label: 'Mean speed c̄', value: vmean(T, M1() / 1000), unit: 'm/s' },
          { label: 'rms speed c_rms', value: vrms(T, M1() / 1000), unit: 'm/s', tone: 'accent' },
          { label: 'Mean KE per molecule', value: meanKE(T), unit: 'J', tone: 'accent' },
          { label: 'Mean KE per mole (3/2)RT', value: 1.5 * 8.314 * T, unit: 'J' },
        ];
        if (two()) out.push(
          { label: 'rms speed of gas 2', value: vrms(T, M2() / 1000), unit: 'm/s' },
          { label: 'Speed ratio c₂/c₁ = √(M₁/M₂)', value: Math.sqrt(M1() / M2()) },
          { label: 'KE ratio (gas 2 / gas 1)', value: 1 },
        );
        return out;
      },
      equations(): Equation[] {
        const T = num(p, 'T');
        return [
          { expr: 'c_rms = √(3RT / M)', sub: `= √(3 × 8.314 × ${n(T)} / ${n(M1() / 1000)}) = ${n(vrms(T, M1() / 1000))} m/s` },
          { expr: 'cₚ : c̄ : c_rms = √2 : √(8/π) : √3  ≈ 1 : 1.13 : 1.22' },
          { expr: '½ m c²_rms = (3/2) k T', sub: `= ${n(meanKE(T))} J` },
          { expr: 'Graham: c₁ / c₂ = √(M₂ / M₁)' },
        ];
      },
    };
  },
};

export default sim;
