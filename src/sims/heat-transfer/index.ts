import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { conduction, radiated } from '../../physics/thermo';
import { sigmaSB } from '../../physics/constants';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const MATS: Record<string, { name: string; k: number; rho: number; c: number }> = {
  copper: { name: 'Copper (k = 400)', k: 400, rho: 8960, c: 385 },
  aluminium: { name: 'Aluminium (k = 237)', k: 237, rho: 2700, c: 900 },
  steel: { name: 'Steel (k = 50)', k: 50, rho: 7850, c: 490 },
  glass: { name: 'Glass (k = 1)', k: 1, rho: 2500, c: 840 },
  wood: { name: 'Wood (k = 0.15)', k: 0.15, rho: 700, c: 1700 },
};
const NSEG = 40;
const ROD = 8; // scene length

const tempColor = (T: number, lo: number, hi: number) => {
  const f = Math.max(0, Math.min(1, (T - lo) / Math.max(hi - lo, 1e-9)));
  return new THREE.Color('#3b82f6').lerp(new THREE.Color('#f97316'), f);
};

const sim: SimDefinition = {
  camera: { position: [0, 3, 10], target: [0, 0.6, 0], aspect: 1.6 },
  hint: 'Conduction: heat diffuses along the rod until a steady linear temperature gradient forms. Radiation: power ∝ T⁴.',
  params: [
    { kind: 'select', key: 'mode', label: 'Mode', default: 'conduction', options: [{ value: 'conduction', label: 'Conduction' }, { value: 'convection', label: 'Convection' }, { value: 'radiation', label: 'Radiation' }] },
    { kind: 'slider', key: 'Th', label: 'Hot temperature', unit: '°C', min: 30, max: 600, step: 5, default: 100 },
    { kind: 'slider', key: 'Tc', label: 'Cold temperature', unit: '°C', min: 0, max: 100, step: 1, default: 20 },
    { kind: 'select', key: 'mat', label: 'Rod material', default: 'copper', options: Object.entries(MATS).map(([value, m]) => ({ value, label: m.name })), showIf: (p) => p.mode === 'conduction' },
    { kind: 'slider', key: 'L', label: 'Rod length', unit: 'cm', min: 5, max: 50, step: 1, default: 20, showIf: (p) => p.mode === 'conduction' },
    { kind: 'slider', key: 'A', label: 'Cross-section', unit: 'cm²', min: 0.5, max: 10, step: 0.5, default: 2, showIf: (p) => p.mode !== 'convection' },
    { kind: 'slider', key: 'e', label: 'Emissivity ε', min: 0.05, max: 1, step: 0.05, default: 0.9, showIf: (p) => p.mode === 'radiation' },
  ],
  presets: [
    { label: 'Copper rod', values: { mode: 'conduction', mat: 'copper' } },
    { label: 'Wooden rod', values: { mode: 'conduction', mat: 'wood' } },
    { label: 'Convection current', values: { mode: 'convection', Th: 90 } },
    { label: 'Red-hot radiator', values: { mode: 'radiation', Th: 600, e: 0.9 } },
  ],
  graphs: [
    { id: 'profile', title: 'Temperature along the rod (conduction)', x: 'position (cm)', y: 'T (°C)', kind: 'curve', series: [{ label: 'T(x) now', color: C.hot }, { label: 'steady state', color: '#94a3b8', dashed: true }] },
    { id: 'H', title: 'Heat flow rate vs time', x: 't (s)', y: 'H (W)', zeroY: true, series: [{ label: 'into the cold end', color: C.accent }] },
  ],
  learn: {
    concept: 'Heat flows from hot to cold in three ways. Conduction passes energy through a solid from particle to particle: H = kA(θ₁ − θ₂)/L. Convection carries it with a moving fluid — hot fluid rises, cool fluid sinks. Radiation needs no medium: every body emits electromagnetic radiation with power P = εσAT⁴.',
    variables: [['H', 'rate of heat flow (W)'], ['k', 'thermal conductivity (W m⁻¹ K⁻¹)'], ['A', 'area (m²)'], ['L', 'length (m)'], ['σ', 'Stefan–Boltzmann constant 5.67 × 10⁻⁸ W m⁻² K⁻⁴'], ['ε', 'emissivity (0–1)']],
    observe: [
      'Copper reaches its steady gradient quickly; wood hardly conducts at all.',
      'At steady state the temperature falls linearly along the rod.',
      'Doubling the absolute temperature makes radiated power 16 times larger.',
    ],
    challenge: 'What length of steel rod (2 cm²) carries 1 W between 100 °C and 20 °C? Use H = kAΔθ/L.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, T: number[] = [];
    const sample = sampler(0.25);
    const condG = kit.add(new THREE.Group());
    const convG = kit.add(new THREE.Group());
    const radG = kit.add(new THREE.Group());
    // conduction rod made of segments
    const segs: THREE.Mesh[] = [];
    for (let i = 0; i < NSEG; i++) {
      const m = kit.box(ROD / NSEG, 0.6, 0.6, '#64748b', { emissive: 0.3 });
      m.position.set(-ROD / 2 + (i + 0.5) * (ROD / NSEG), 0.8, 0);
      condG.add(m); segs.push(m);
    }
    const hot = kit.box(1, 2, 1.6, C.hot, { emissive: 0.4 });
    hot.position.set(-ROD / 2 - 0.5, 0.8, 0);
    const cold = kit.box(1, 2, 1.6, C.cold, { emissive: 0.3 });
    cold.position.set(ROD / 2 + 0.5, 0.8, 0);
    const flow = kit.arrow(C.hot, { label: 'H', radius: 0.05 });
    condG.add(hot, cold, flow);
    const hotL = kit.label('', [-ROD / 2 - 0.5, 2.2, 0], { color: C.hot, small: true });
    const coldL = kit.label('', [ROD / 2 + 0.5, 2.2, 0], { color: C.cold, small: true });
    condG.add(hotL, coldL);
    // convection loop
    const pan = kit.box(5, 3, 1.5, '#e2e8f0', { opacity: 0.1 });
    pan.position.y = 1.5;
    const flame = kit.cone(C.hot, 0.5, 0.8);
    flame.position.set(-1.4, -0.4, 0);
    const parcels: THREE.Mesh[] = [];
    for (let i = 0; i < 40; i++) { const s = kit.sphere(0.09, '#60a5fa', { emissive: 0.3 }, 10); parcels.push(s); convG.add(s); }
    convG.add(pan, flame);
    // radiation
    const body = kit.sphere(1, C.hot, { emissive: 0.6 }, 48);
    const rays = kit.add(new THREE.Group());
    radG.add(body, rays);
    const photons: { dir: THREE.Vector3; r: number; mesh: THREE.Mesh }[] = [];
    for (let i = 0; i < 60; i++) {
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const m = kit.sphere(0.06, '#fde047', { emissive: 1 }, 8);
      photons.push({ dir: d, r: 1 + Math.random() * 4, mesh: m });
      radG.add(m);
    }
    radG.position.y = 1;

    const mat = () => MATS[str(p, 'mat')] ?? MATS.copper;
    const Lm = () => num(p, 'L') / 100;
    const Am = () => num(p, 'A') / 1e4;
    const Hsteady = () => conduction(mat().k, Am(), num(p, 'Th') - num(p, 'Tc'), Lm());
    const radP = (TC: number) => radiated(num(p, 'e'), Am(), TC + 273.15);

    function reset() {
      t = 0; sample.reset();
      T = new Array(NSEG).fill(num(p, 'Tc'));
      condG.visible = str(p, 'mode') === 'conduction';
      convG.visible = str(p, 'mode') === 'convection';
      radG.visible = str(p, 'mode') === 'radiation';
      graphs.get('profile').plot(1, 0, num(p, 'L'), (x) => num(p, 'Th') + ((num(p, 'Tc') - num(p, 'Th')) * x) / num(p, 'L'), 2);
    }
    reset();

    /** Thermal diffusivity α = k/(ρc); explicit finite differences with stable sub-steps. */
    function diffuse(dt: number) {
      const m = mat();
      const alpha = m.k / (m.rho * m.c);
      const dx = Lm() / NSEG;
      const maxDt = (0.4 * dx * dx) / alpha;
      const steps = Math.min(4000, Math.max(1, Math.ceil(dt / maxDt)));
      const h = Math.min(dt / steps, maxDt); // never exceed the stability limit
      for (let s = 0; s < steps; s++) {
        const next = T.slice();
        for (let i = 0; i < NSEG; i++) {
          const left = i === 0 ? num(p, 'Th') : T[i - 1];
          const right = i === NSEG - 1 ? num(p, 'Tc') : T[i + 1];
          next[i] = T[i] + (alpha * h * (left - 2 * T[i] + right)) / (dx * dx);
        }
        T = next;
      }
    }
    const Hnow = () => (mat().k * Am() * (T[NSEG - 1] - num(p, 'Tc'))) / (Lm() / NSEG / 2);

    return {
      setParams(np) { const r = np.mode !== p.mode || np.mat !== p.mat || np.L !== p.L; p = np; if (r) { graphs.clearLive(); reset(); } else graphs.get('profile').plot(1, 0, num(p, 'L'), (x) => num(p, 'Th') + ((num(p, 'Tc') - num(p, 'Th')) * x) / num(p, 'L'), 2); },
      reset,
      step(dt) {
        // speed-up so that slow conductors still show progress
        const speed = Math.min(400, Math.max(5, (Lm() * Lm()) / (mat().k / (mat().rho * mat().c)) / 40));
        if (str(p, 'mode') === 'conduction') diffuse(dt * speed);
        t += dt * (str(p, 'mode') === 'conduction' ? speed : 1);
        if (sample.due(t / (str(p, 'mode') === 'conduction' ? speed : 1)) && str(p, 'mode') === 'conduction') {
          graphs.get('profile').setSeries(0, T.map((_, i) => ((i + 0.5) / NSEG) * num(p, 'L')), T);
          graphs.get('H').push(t, Hnow());
        }
      },
      render() {
        const mode = str(p, 'mode');
        const Th = num(p, 'Th'), Tc = num(p, 'Tc');
        if (mode === 'conduction') {
          segs.forEach((m, i) => { const c = tempColor(T[i], Tc, Th); const mm = m.material as THREE.MeshStandardMaterial; mm.color.copy(c); mm.emissive.copy(c); });
          flow.set([-ROD / 2 + 0.5, 1.6, 0], [Math.min(ROD - 1, 1 + Math.log10(1 + Hsteady()) * 1.5), 0, 0], `H = ${n(Hsteady())} W (steady)`);
          hotL.setText(`${n(Th)} °C`); coldL.setText(`${n(Tc)} °C`);
        } else if (mode === 'convection') {
          const speed = 0.3 + (Th - Tc) / 100;
          parcels.forEach((s, i) => {
            const ph = ((i / parcels.length) + t * speed * 0.15) % 1;
            // rectangular loop: up on the heated side, across the top, down the cool side, back along the bottom
            let x: number, y: number;
            if (ph < 0.25) { x = -1.4; y = 0.2 + (ph / 0.25) * 2.6; }
            else if (ph < 0.5) { x = -1.4 + ((ph - 0.25) / 0.25) * 2.8; y = 2.8; }
            else if (ph < 0.75) { x = 1.4; y = 2.8 - ((ph - 0.5) / 0.25) * 2.6; }
            else { x = 1.4 - ((ph - 0.75) / 0.25) * 2.8; y = 0.2; }
            s.position.set(x, y, 0);
            const warm = ph < 0.5 ? 1 - ph : ph - 0.5;
            (s.material as THREE.MeshStandardMaterial).color.copy(tempColor(warm, 0.25, 1));
          });
          flame.scale.setScalar(0.5 + (Th - Tc) / 150);
        } else {
          const TK = Th + 273.15;
          const c = new THREE.Color().setHSL(Math.max(0, Math.min(0.12, (TK - 300) / 5000)), 1, Math.min(0.6, 0.15 + TK / 2500));
          const bm = body.material as THREE.MeshStandardMaterial;
          bm.color.copy(c); bm.emissive.copy(c); bm.emissiveIntensity = 0.3 + Math.min(1, TK / 1000);
          const rate = radP(Th) / Math.max(radP(100), 1e-9);
          photons.forEach((ph) => {
            ph.r += 0.05 * (0.5 + Math.min(4, rate * 0.2));
            if (ph.r > 5) ph.r = 1;
            ph.mesh.position.copy(ph.dir).multiplyScalar(ph.r);
            ph.mesh.visible = Math.random() < Math.min(1, 0.2 + rate * 0.1);
          });
        }
      },
      time: () => t,
      readouts(): Readout[] {
        const mode = str(p, 'mode');
        if (mode === 'conduction') return [
          { label: 'Steady heat flow H', value: Hsteady(), unit: 'W', tone: 'accent' },
          { label: 'Heat flow into cold end now', value: Hnow(), unit: 'W' },
          { label: 'Temperature gradient', value: (num(p, 'Th') - num(p, 'Tc')) / Lm(), unit: '°C/m' },
          { label: 'Thermal conductivity k', value: mat().k, unit: 'W/(m·K)' },
          { label: 'Thermal resistance L/kA', value: Lm() / (mat().k * Am()), unit: 'K/W' },
          { label: 'Mid-point temperature now', value: T[NSEG / 2], unit: '°C' },
        ];
        if (mode === 'radiation') {
          const net = radP(num(p, 'Th')) - radiated(num(p, 'e'), Am(), num(p, 'Tc') + 273.15);
          return [
            { label: 'Power radiated εσAT⁴', value: radP(num(p, 'Th')), unit: 'W', tone: 'accent' },
            { label: 'Net loss to surroundings', value: net, unit: 'W' },
            { label: 'Absolute temperature', value: num(p, 'Th') + 273.15, unit: 'K' },
            { label: 'Peak wavelength (Wien)', value: 2.898e-3 / (num(p, 'Th') + 273.15) * 1e6, unit: 'µm' },
          ];
        }
        return [
          { label: 'Temperature difference', value: num(p, 'Th') - num(p, 'Tc'), unit: '°C' },
          { label: 'Circulation', value: 'Hot fluid rises (less dense), cool fluid sinks' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'H = k A (θ₁ − θ₂) / L', sub: `= ${n(mat().k)} × ${n(Am())} × ${n(num(p, 'Th') - num(p, 'Tc'))} / ${n(Lm())} = ${n(Hsteady())} W` },
          { expr: 'P = ε σ A T⁴', sub: `σ = ${n(sigmaSB)} W m⁻² K⁻⁴` },
          { expr: 'Net radiation: P = εσA (T⁴ − T₀⁴)' },
        ];
      },
    };
  },
};

export default sim;
