import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { xrayCutoff } from '../../physics/modern';
import { c, h, e as eC, me } from '../../physics/constants';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

/** Anode materials: atomic number and characteristic K lines (keV) with the K-shell ionisation edge. */
const TARGETS: Record<string, { name: string; Z: number; ka: number; kb: number; edge: number }> = {
  w: { name: 'Tungsten (Z = 74)', Z: 74, ka: 59.3, kb: 67.2, edge: 69.5 },
  mo: { name: 'Molybdenum (Z = 42)', Z: 42, ka: 17.48, kb: 19.61, edge: 20.0 },
  cu: { name: 'Copper (Z = 29)', Z: 29, ka: 8.05, kb: 8.9, edge: 8.98 },
};
const HC_KEV_NM = 1.239_842; // hc in keV·nm

const sim: SimDefinition = {
  camera: { position: [0, 2.5, 11], target: [0, -0.3, 0], aspect: 1.6 },
  hint: 'Raising the tube voltage pushes the short-wavelength cut-off lower; the characteristic peaks appear only once eV exceeds the K-shell energy.',
  params: [
    { kind: 'slider', key: 'V', label: 'Tube voltage', unit: 'kV', min: 5, max: 100, step: 1, default: 35 },
    { kind: 'slider', key: 'I', label: 'Tube current', unit: 'mA', min: 1, max: 50, step: 1, default: 20 },
    { kind: 'select', key: 'target', label: 'Target (anode)', default: 'mo', options: Object.entries(TARGETS).map(([value, t]) => ({ value, label: t.name })) },
  ],
  presets: [
    { label: 'Dental X-ray (60 kV, W)', values: { V: 60, target: 'w', I: 8 } },
    { label: 'Mammography (28 kV, Mo)', values: { V: 28, target: 'mo', I: 40 } },
    { label: 'Crystallography (40 kV, Cu)', values: { V: 40, target: 'cu', I: 30 } },
    { label: 'Below K edge (15 kV, Mo)', values: { V: 15, target: 'mo' } },
  ],
  graphs: [
    { id: 'S', title: 'X-ray spectrum', x: 'λ (nm)', y: 'intensity (a.u.)', kind: 'curve', xRange: [0, 0.25], zeroY: true, series: [{ label: 'continuous + characteristic', color: '#c084fc' }] },
    { id: 'L', title: 'Cut-off wavelength vs voltage', x: 'V (kV)', y: 'λ_min (nm)', kind: 'curve', xRange: [5, 100], zeroY: true, series: [{ label: 'λ_min = hc / eV', color: C.accent }] },
  ],
  learn: {
    concept: 'In an X-ray tube, electrons from a hot filament are accelerated through a large voltage V and hit a metal target. Slowing down in the target they emit “braking” radiation (bremsstrahlung) with a continuous spectrum. No photon can carry more than the electron’s whole energy eV, so the spectrum stops sharply at λ_min = hc/eV (Duane–Hunt law). If eV exceeds the K-shell energy, sharp characteristic lines (Kα, Kβ) of the target appear. Over 99 % of the energy becomes heat.',
    variables: [['V', 'accelerating voltage'], ['λ_min', 'cut-off wavelength'], ['f_max', 'maximum frequency eV/h'], ['Z', 'atomic number of the target'], ['I', 'tube current (number of electrons per second)']],
    observe: [
      'Doubling V halves λ_min.',
      'The current changes the intensity (height) but not λ_min.',
      'The characteristic line positions depend only on the target metal.',
      'Higher Z targets give more intense continuous X-rays.',
    ],
    challenge: 'Find the minimum voltage at which tungsten’s Kα line appears.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, emit = 0, xemit = 0;
    const sample = sampler(1 / 30);
    const tube = kit.cylinder(1.6, 1.6, 8, '#e2e8f0', { opacity: 0.08 }, 48);
    tube.rotation.z = Math.PI / 2;
    const fil = kit.torus(0.25, 0.05, C.hot);
    fil.position.set(-3.4, 0, 0); fil.rotation.y = Math.PI / 2;
    const cath = kit.box(0.3, 1.2, 1.2, '#64748b', { metalness: 0.6 });
    cath.position.set(-3.8, 0, 0);
    const anode = kit.box(0.6, 1.6, 1.2, '#b45309', { metalness: 0.7 });
    anode.position.set(3.2, 0, 0); anode.rotation.z = Math.PI / 4;
    const tgtLabel = kit.label('', [3.2, 1.4, 0], { small: true });
    kit.label('filament (cathode)', [-3.6, 1.2, 0], { small: true });
    kit.label('X-rays', [2.3, -3.4, 0], { color: '#c084fc', small: true });
    const win = kit.box(1.2, 0.05, 1.2, '#94a3b8', { opacity: 0.5 });
    win.position.set(2.8, -1.6, 0);
    const vLabel = kit.label('', [0, 1.9, 0], { color: C.accent, small: true });
    const POOL = 60;
    const elec = Array.from({ length: POOL }, () => { const m = kit.sphere(0.06, C.negative, { emissive: 0.8 }, 8); m.visible = false; return { m, x: 0, y: 0, on: false }; });
    const rays = Array.from({ length: 30 }, () => ({ line: kit.line('#c084fc', [], { width: 2 }), s: 0, a: 0, on: false }));
    rays.forEach((r) => (r.line.visible = false));

    const tg = () => TARGETS[str(p, 'target')] ?? TARGETS.mo;
    const lmin = () => xrayCutoff(num(p, 'V') * 1000) * 1e9; // nm
    function spectrum(lam: number) {
      const V = num(p, 'V'), L0 = lmin(), T = tg();
      if (lam <= L0) return 0;
      const brems = (T.Z / 74) * (lam / L0 - 1) / (lam * lam) * 0.004; // Kramers’ law
      let lines = 0;
      if (V > T.edge) {
        const s = Math.pow(V / T.edge - 1, 1.5) * 1.6;
        const g = (l0: number, a: number) => a * Math.exp(-(((lam - l0) / 0.0012) ** 2));
        lines = g(HC_KEV_NM / T.ka, s) + g(HC_KEV_NM / T.kb, s * 0.25);
      }
      return (num(p, 'I') / 20) * (brems + lines);
    }
    function curves() {
      graphs.get('S').plot(0, 0.003, 0.25, spectrum, 600);
      graphs.get('S').setVLines([{ x: lmin(), label: 'λ_min' }]);
      graphs.get('L').plot(0, 5, 100, (V) => xrayCutoff(V * 1000) * 1e9, 200);
      graphs.get('L').setMarkers([{ x: num(p, 'V'), y: lmin(), color: C.accent }]);
      tgtLabel.setText(`target: ${tg().name.split(' ')[0]}`);
      vLabel.setText(`V = ${n(num(p, 'V'))} kV`);
    }
    curves();

    const eSpeed = () => 2 + Math.sqrt(num(p, 'V')) * 0.8; // visual speed grows as √V
    function reset() { t = 0; elec.forEach((e) => { e.on = false; e.m.visible = false; }); rays.forEach((r) => { r.on = false; r.line.visible = false; }); sample.reset(); }

    return {
      setParams(np) { p = np; curves(); },
      reset,
      step(dt) {
        t += dt;
        emit += dt * num(p, 'I') * 1.5;
        while (emit >= 1) {
          emit -= 1;
          const f = elec.find((e) => !e.on);
          if (f) { f.on = true; f.x = -3.3; f.y = (Math.random() - 0.5) * 0.3; f.m.visible = true; }
        }
        for (const el of elec) {
          if (!el.on) continue;
          el.x += eSpeed() * dt;
          el.y *= 1 - dt; // focusing cup narrows the beam
          if (el.x >= 3.0) {
            el.on = false; el.m.visible = false;
            xemit += 0.35 * (tg().Z / 74 + 0.3) * (num(p, 'V') / 60); // efficiency ∝ ZV
            while (xemit >= 1) {
              xemit -= 1;
              const r = rays.find((q) => !q.on);
              if (r) { r.on = true; r.s = 0; r.a = -Math.PI / 2 + (Math.random() - 0.5) * 0.9; }
            }
          }
        }
        for (const r of rays) if (r.on) { r.s += dt * 6; if (r.s > 4) { r.on = false; r.line.visible = false; } }
        if (sample.due(t)) {/* spectrum is a curve */}
      },
      render() {
        for (const el of elec) if (el.on) el.m.position.set(el.x, el.y, 0);
        const lamVis = 0.08 + lmin() * 1.2;
        for (const r of rays) {
          if (!r.on) continue;
          const pts: [number, number, number][] = [];
          const ux = Math.cos(r.a), uy = Math.sin(r.a);
          for (let k = 0; k <= 30; k++) {
            const s = r.s + (k / 30) * 0.9;
            const w = 0.08 * Math.sin((s / lamVis) * Math.PI * 2);
            pts.push([2.9 + ux * s - uy * w, -0.2 + uy * s + ux * w, 0]);
          }
          r.line.setPoints(pts); r.line.visible = true;
        }
      },
      time: () => t,
      readouts(): Readout[] {
        const V = num(p, 'V') * 1000;
        const K = eC * V;
        const gamma = 1 + K / (me * c * c);
        const beta = Math.sqrt(1 - 1 / (gamma * gamma));
        const P = V * num(p, 'I') / 1000;
        const eff = 1.1e-9 * tg().Z * V;
        return [
          { label: 'Cut-off wavelength λ_min', value: lmin(), unit: 'nm', tone: 'accent' },
          { label: 'Maximum frequency eV/h', value: K / h, unit: 'Hz' },
          { label: 'Maximum photon energy', value: num(p, 'V'), unit: 'keV' },
          { label: 'Electron speed at target', value: beta * c, unit: 'm/s' },
          { label: 'v / c', value: beta },
          { label: 'Kα line', value: V / 1000 > tg().edge ? HC_KEV_NM / tg().ka : 'not excited', unit: V / 1000 > tg().edge ? 'nm' : undefined },
          { label: 'Electrical power in', value: P, unit: 'W' },
          { label: 'X-ray efficiency ≈ 1.1×10⁻⁹ ZV', value: eff * 100, unit: '%' },
          { label: 'Heat in the target', value: P * (1 - eff), unit: 'W', tone: 'bad' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'eV = h f_max = hc / λ_min', sub: `λ_min = hc / eV = 1.24 / ${n(num(p, 'V'))} kV = ${n(lmin())} nm` },
          { expr: 'Characteristic: h f = E_L − E_K (Kα)', sub: `${tg().name.split(' ')[0]} Kα = ${n(tg().ka)} keV → λ = ${n(HC_KEV_NM / tg().ka)} nm` },
          { expr: 'Power = V I', sub: `= ${n(num(p, 'V') * 1000)} × ${n(num(p, 'I') / 1000)} = ${n(num(p, 'V') * num(p, 'I'))} W` },
        ];
      },
    };
  },
};

export default sim;
