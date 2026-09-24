import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { kB, u as AMU, atm } from '../../physics/constants';
import { ParticleBox, boxEdges } from '../particles';
import { n, sampler } from '../shared';
import { C } from '../../engine/colors';

/*
 * Units inside the simulation: length in nm, time in ps, so speed in nm/ps (= km/s).
 * Pressure is *measured* from the momentum delivered to the walls and compared with P = NkT/V.
 */
const GASES: Record<string, { name: string; M: number }> = {
  he: { name: 'Helium (4 u)', M: 4 },
  n2: { name: 'Nitrogen (28 u)', M: 28 },
  ar: { name: 'Argon (40 u)', M: 40 },
  xe: { name: 'Xenon (131 u)', M: 131 },
};
const MAXN = 600;
const SC = 0.35; // scene units per nm

const sim: SimDefinition = {
  camera: { position: [0, 3, 9], target: [0, 0, 0], aspect: 1.4 },
  hint: 'Colour shows speed (blue slow, orange fast). Pressure is measured from wall collisions and matches NkT/V on average.',
  params: [
    { kind: 'select', key: 'gas', label: 'Gas', default: 'n2', options: Object.entries(GASES).map(([value, g]) => ({ value, label: g.name })) },
    { kind: 'slider', key: 'N', label: 'Number of molecules N', min: 20, max: MAXN, step: 10, default: 200 },
    { kind: 'slider', key: 'T', label: 'Temperature', unit: 'K', min: 50, max: 1500, step: 10, default: 300 },
    { kind: 'slider', key: 'L', label: 'Box side (volume = L³)', unit: 'nm', min: 8, max: 20, step: 0.5, default: 14 },
    { kind: 'slider', key: 'slow', label: 'Display slow-down', unit: 'ps per s', min: 0.5, max: 20, step: 0.5, default: 4 },
  ],
  presets: [
    { label: 'Room temperature', values: { T: 300, N: 200, L: 14 } },
    { label: 'Hot gas', values: { T: 1200 } },
    { label: 'Cold gas', values: { T: 80 } },
    { label: 'Compressed', values: { L: 9 } },
    { label: 'Light helium', values: { gas: 'he', T: 300 } },
  ],
  graphs: [
    { id: 'P', title: 'Measured pressure vs ideal-gas law', x: 't (ps)', y: 'P (atm)', zeroY: true, series: [{ label: 'measured from collisions', color: C.accent }, { label: 'P = NkT/V', color: '#e2e8f0', dashed: true }] },
  ],
  learn: {
    concept: 'An ideal gas is a huge number of tiny molecules in random motion that collide elastically with the walls. Each collision transfers momentum; the average force per unit area is the pressure. Kinetic theory gives P = ⅓ρc̄² which, with ½mc̄² = (3/2)kT, becomes the ideal gas law PV = NkT.',
    variables: [['P', 'pressure (Pa)'], ['V', 'volume (m³)'], ['N', 'number of molecules'], ['T', 'absolute temperature (K)'], ['k', 'Boltzmann constant 1.38 × 10⁻²³ J/K'], ['c_rms', 'root-mean-square speed']],
    observe: [
      'Heating the gas makes the molecules faster and the pressure higher.',
      'Halving the volume (smaller box) at constant T doubles the pressure.',
      'Adding molecules raises the pressure in proportion.',
      'Light helium moves much faster than xenon at the same temperature — but the pressure is the same.',
    ],
    challenge: 'Double N and double the volume at the same time. What happens to the pressure? Test it.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, lastT = 0, lastImpulse = 0, measured = 0;
    const sample = sampler(0.5);
    const box = new ParticleBox(kit, MAXN, 0.07);
    const edges = kit.segments('#94a3b8', { width: 1.5 });
    const piston = kit.box(1, 0.06, 1, '#64748b', { opacity: 0.5 });

    const m = () => (GASES[str(p, 'gas')] ?? GASES.n2).M * AMU;
    /** σ per axis in nm/ps: √(kT/m) m/s ÷ 1000 */
    const sigma = () => Math.sqrt((kB * num(p, 'T')) / m()) / 1000;
    const V = () => (num(p, 'L') * 1e-9) ** 3;
    const Pth = () => (num(p, 'N') * kB * num(p, 'T')) / V();

    function layout() {
      const h = num(p, 'L') / 2;
      box.setHalf(h, h, h);
      edges.setSegments(boxEdges(h * SC, h * SC, h * SC));
      piston.scale.set(2 * h * SC, 1, 2 * h * SC);
      piston.position.y = h * SC + 0.03;
    }
    function refill() {
      box.seed(11);
      layout();
      box.fill(Math.round(num(p, 'N')), sigma());
      t = 0; lastT = 0; lastImpulse = 0; measured = Pth(); sample.reset();
    }
    refill();

    return {
      setParams(np) {
        const prev = p;
        p = np;
        if (np.N !== prev.N || np.gas !== prev.gas) { graphs.clearLive(); refill(); return; }
        if (np.T !== prev.T) box.scaleSpeeds(Math.sqrt(num(np, 'T') / num(prev, 'T')));
        if (np.L !== prev.L) layout();
      },
      reset: refill,
      step(dt) {
        const h = dt * num(p, 'slow'); // ps
        const sub = Math.max(1, Math.ceil(h / 0.2));
        for (let i = 0; i < sub; i++) box.step(h / sub);
        t += h;
        if (t - lastT >= 2) {
          // impulse is in (nm/ps) per unit mass: convert to kg·m/s
          const J = (box.impulse - lastImpulse) * 1000 * m();
          const area = 6 * (num(p, 'L') * 1e-9) ** 2;
          const P = J / ((t - lastT) * 1e-12) / area;
          measured = measured * 0.5 + P * 0.5;
          lastImpulse = box.impulse; lastT = t;
          graphs.get('P').push(t, measured / atm, Pth() / atm);
        }
        void sample;
      },
      render() { box.render(SC, Math.sqrt(3) * sigma()); },
      time: () => t,
      readouts(): Readout[] {
        const crms = Math.sqrt(box.meanSquareSpeed()) * 1000;
        return [
          { label: 'Pressure (ideal gas law)', value: Pth() / atm, unit: 'atm', tone: 'accent' },
          { label: 'Pressure measured from collisions', value: measured / atm, unit: 'atm', tone: 'accent' },
          { label: 'Volume', value: V(), unit: 'm³' },
          { label: 'rms speed (simulated)', value: crms, unit: 'm/s' },
          { label: 'rms speed √(3kT/m)', value: Math.sqrt((3 * kB * num(p, 'T')) / m()), unit: 'm/s' },
          { label: 'Mean KE per molecule (3/2)kT', value: 1.5 * kB * num(p, 'T'), unit: 'J' },
          { label: 'PV / NkT', value: (measured * V()) / (num(p, 'N') * kB * num(p, 'T')) },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'PV = N k T', sub: `P = ${n(num(p, 'N'))} × 1.38×10⁻²³ × ${n(num(p, 'T'))} / ${n(V())} = ${n(Pth())} Pa` },
          { expr: 'P = ⅓ (N m / V) c̄²' },
          { expr: '½ m c̄² = (3/2) k T' },
          { expr: 'c_rms = √(3kT/m)', sub: `= ${n(Math.sqrt((3 * kB * num(p, 'T')) / m()))} m/s` },
        ];
      },
    };
  },
};

export default sim;
