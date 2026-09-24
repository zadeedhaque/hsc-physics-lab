import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { eps0 } from '../../physics/constants';
import { C } from '../../engine/colors';
import { n } from '../shared';

const XL = 7; // half-length of the crystal (scene)
const HY = 1.4; // half-height
const VT = 0.025_85; // thermal voltage at 300 K
const NI = 1e10; // cm⁻³
const EPS = 11.7 * eps0;
const QE = 1.602e-19;
const IS = 1e-14; // reverse saturation current (A)
const HOLE = '#f59e0b';

interface Dot { x: number; y: number; vx: number; vy: number; mesh: THREE.Mesh; life: number }

const sim: SimDefinition = {
  camera: { position: [0, 1.5, 13], target: [0, -0.5, 0], aspect: 1.5 },
  hint: 'Forward bias (p to +) narrows the depletion layer and lowers the barrier, so carriers flood across. Reverse bias widens it and almost no current flows.',
  params: [
    { kind: 'slider', key: 'V', label: 'Applied bias (+ means p side positive)', unit: 'V', min: -5, max: 0.8, step: 0.01, default: 0 },
    { kind: 'slider', key: 'NA', label: 'Acceptor doping (p side), log₁₀', unit: 'cm⁻³', min: 15, max: 18, step: 0.5, default: 16 },
    { kind: 'slider', key: 'ND', label: 'Donor doping (n side), log₁₀', unit: 'cm⁻³', min: 15, max: 18, step: 0.5, default: 16 },
  ],
  presets: [
    { label: 'No bias (equilibrium)', values: { V: 0 } },
    { label: 'Forward 0.65 V', values: { V: 0.65 } },
    { label: 'Reverse −5 V', values: { V: -5 } },
    { label: 'One-sided junction (p⁺n)', values: { NA: 18, ND: 15, V: 0 } },
  ],
  graphs: [
    { id: 'P', title: 'Electric potential across the junction', x: 'x (µm)', y: 'V (V)', kind: 'curve', xRange: [-3, 3], series: [{ label: 'potential', color: C.accent }] },
    { id: 'I', title: 'Current–voltage characteristic', x: 'V (V)', y: 'I (mA)', kind: 'curve', xRange: [-5, 0.8], yRange: [-1, 30], series: [{ label: 'I = Iₛ(e^{V/V_T} − 1)', color: C.current }] },
  ],
  learn: {
    concept: 'Where p-type and n-type silicon meet, electrons diffuse into the p side and holes into the n side, where they recombine. This leaves a depletion layer of fixed ions (− on the p side, + on the n side) with no free carriers. Its electric field sets up a barrier potential V₀ (≈0.7 V for Si) that stops further diffusion. Forward bias lowers the barrier and thins the layer, so current rises exponentially. Reverse bias raises the barrier and widens the layer; only a tiny leakage current flows.',
    variables: [['V₀', 'built-in barrier = V_T ln(N_A N_D / nᵢ²)'], ['W', 'depletion width ∝ √(V₀ − V)'], ['V_T', 'kT/e = 25.9 mV at 300 K'], ['Iₛ', 'reverse saturation current']],
    observe: [
      'At zero bias the depletion layer contains only fixed ions, no moving carriers.',
      'Heavier doping gives a thinner depletion layer and a slightly higher barrier.',
      'In a one-sided junction the layer extends mostly into the lightly-doped side.',
      'The current is negligible until the forward bias approaches V₀.',
    ],
    challenge: 'Show that doubling the reverse voltage (for V ≫ V₀) increases the depletion width by about √2.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, crossAcc = 0;
    let dots: Dot[] = [];
    let crossers: (Dot & { hole: boolean; stop: number })[] = [];
    const pBox = kit.box(XL, HY * 2, 1.2, '#fb7185', { opacity: 0.12 });
    pBox.position.x = -XL / 2;
    const nBox = kit.box(XL, HY * 2, 1.2, '#60a5fa', { opacity: 0.12 });
    nBox.position.x = XL / 2;
    kit.label('p-type', [-XL / 2, HY + 0.5, 0], { color: '#fb7185' });
    kit.label('n-type', [XL / 2, HY + 0.5, 0], { color: '#60a5fa' });
    const dep = kit.box(1, HY * 2 + 0.05, 1.25, '#0f172a', { opacity: 0.55 });
    const depLabel = kit.label('', [0, -HY - 0.5, 0], { small: true });
    const efield = kit.arrow('#e2e8f0', { radius: 0.05 });
    const eLabel = kit.label('E', [0, HY + 0.3, 0], { small: true });
    // fixed ions on a lattice
    const ions: { x: number; mesh: THREE.Mesh }[] = [];
    const ionGeo = new THREE.BoxGeometry(0.16, 0.05, 0.05);
    const negMat = kit.mat('#60a5fa', { emissive: 0.5 }), posMat = kit.mat('#fb7185', { emissive: 0.5 });
    for (let x = -XL + 0.25; x < XL; x += 0.5) for (let y = -HY + 0.35; y < HY; y += 0.7) {
      const m = new THREE.Mesh(ionGeo, x < 0 ? negMat : posMat);
      m.position.set(x, y, 0.62);
      kit.add(m);
      if (x > 0) { const bar = new THREE.Mesh(ionGeo, posMat); bar.rotation.z = Math.PI / 2; m.add(bar); }
      ions.push({ x, mesh: m });
    }
    const dotGeo = new THREE.SphereGeometry(0.09, 10, 8);
    const eMat = kit.mat(C.negative, { emissive: 0.8 }), hMat = kit.mat(HOLE, { emissive: 0.8 });
    // external circuit: battery below
    kit.line('#94a3b8', [[-XL, 0, 0], [-XL - 0.6, 0, 0], [-XL - 0.6, -3, 0], [-0.8, -3, 0]], { width: 3 });
    kit.line('#94a3b8', [[XL, 0, 0], [XL + 0.6, 0, 0], [XL + 0.6, -3, 0], [0.8, -3, 0]], { width: 3 });
    const cell = kit.box(1.6, 0.6, 0.6, '#1f2937');
    cell.position.set(0, -3, 0);
    const polL = kit.label('', [-1.1, -2.5, 0], { small: true });
    const polR = kit.label('', [1.1, -2.5, 0], { small: true });
    const vLabel = kit.label('', [0, -3.7, 0], { color: C.accent, small: true });

    const NA = () => 10 ** num(p, 'NA'), ND = () => 10 ** num(p, 'ND');
    const V0 = () => VT * Math.log((NA() * ND()) / (NI * NI));
    const Veff = () => Math.min(num(p, 'V'), V0() - 0.02);
    /** Depletion width (m), split into x_p and x_n. */
    function widths() {
      const na = NA() * 1e6, nd = ND() * 1e6;
      const W = Math.sqrt(((2 * EPS) / QE) * (V0() - Veff()) * (1 / na + 1 / nd));
      return { W, xp: (W * nd) / (na + nd), xn: (W * na) / (na + nd), Emax: (QE * na * ((W * nd) / (na + nd))) / EPS };
    }
    const current = (V: number) => IS * Math.expm1(Math.min(V, 1) / VT);

    function spawnDots() {
      dots.forEach((d) => d.mesh.removeFromParent()); dots = [];
      for (let i = 0; i < 70; i++) {
        const hole = i % 2 === 0;
        const mesh = new THREE.Mesh(dotGeo, hole ? hMat : eMat);
        kit.add(mesh);
        const x = hole ? -XL + Math.random() * (XL - 0.5) : 0.5 + Math.random() * (XL - 0.5);
        const a = Math.random() * Math.PI * 2;
        dots.push({ x, y: (Math.random() * 2 - 1) * (HY - 0.15), vx: Math.cos(a), vy: Math.sin(a), mesh, life: hole ? 1 : -1 });
      }
    }
    function build() {
      const w = widths(), s = 2.5; // 2.5 scene units per µm
      const xpS = Math.min(XL - 0.3, w.xp * 1e6 * s), xnS = Math.min(XL - 0.3, w.xn * 1e6 * s);
      dep.scale.x = Math.max(0.02, xpS + xnS);
      dep.position.x = (xnS - xpS) / 2;
      depLabel.at([(xnS - xpS) / 2, -HY - 0.5, 0]).setText(`depletion layer W = ${n(w.W * 1e6)} µm`);
      for (const ion of ions) {
        const inside = ion.x > -xpS && ion.x < xnS;
        ion.mesh.scale.setScalar(inside ? 1.6 : 0.8);
      }
      const eLen = Math.min(3, 0.4 + w.Emax / 2e7);
      efield.set([eLen / 2 + (xnS - xpS) / 2, HY + 0.3, 0.7], [-eLen, 0, 0]);
      eLabel.at([(xnS - xpS) / 2 - eLen / 2 - 0.3, HY + 0.3, 0.7]);
      const V = num(p, 'V');
      polL.setText(V >= 0 ? '+' : '−'); polR.setText(V >= 0 ? '−' : '+');
      vLabel.setText(`${V >= 0 ? 'forward' : 'reverse'} bias ${n(Math.abs(V))} V`);
      // potential profile (µm, V)
      const na = NA() * 1e6, nd = ND() * 1e6, xp = w.xp * 1e6, xn = w.xn * 1e6, Vt = V0() - Veff();
      graphs.get('P').plot(0, -3, 3, (xu) => {
        if (xu <= -xp) return 0;
        if (xu <= 0) return ((QE * na) / (2 * EPS)) * ((xu + xp) * 1e-6) ** 2;
        if (xu <= xn) return Vt - ((QE * nd) / (2 * EPS)) * ((xn - xu) * 1e-6) ** 2;
        return Vt;
      }, 400);
      graphs.get('P').setVLines([{ x: -xp, label: '−x_p' }, { x: xn, label: 'x_n' }]);
      graphs.get('I').plot(0, -5, 0.8, (v) => Math.min(40, current(v) * 1000), 400);
      graphs.get('I').setMarkers([{ x: V, y: Math.min(30, current(V) * 1000), color: C.current }]);
      return { xpS, xnS };
    }
    let geom = build();
    function reset() { t = 0; crossAcc = 0; crossers.forEach((c) => c.mesh.removeFromParent()); crossers = []; spawnDots(); geom = build(); }
    reset();

    return {
      setParams(np) { p = np; geom = build(); },
      reset,
      step(dt) {
        t += dt;
        const { xpS, xnS } = geom;
        for (const d of dots) {
          if (Math.random() < dt * 2) { const a = Math.random() * Math.PI * 2; d.vx = Math.cos(a); d.vy = Math.sin(a); }
          d.x += d.vx * dt; d.y += d.vy * dt;
          if (Math.abs(d.y) > HY - 0.12) { d.vy *= -1; d.y = Math.sign(d.y) * (HY - 0.12); }
          if (d.life > 0) { // hole: stays in the neutral p region
            if (d.x < -XL + 0.1) { d.x = -XL + 0.1; d.vx *= -1; }
            if (d.x > -xpS) { d.x = -xpS; d.vx = -Math.abs(d.vx); }
          } else {
            if (d.x > XL - 0.1) { d.x = XL - 0.1; d.vx *= -1; }
            if (d.x < xnS) { d.x = xnS; d.vx = Math.abs(d.vx); }
          }
        }
        // carriers crossing the junction: rate grows with the diode current (log scale for display)
        const I = current(num(p, 'V'));
        const rate = I > 0 ? Math.min(30, 2.2 * Math.max(0, Math.log10(I / 1e-9))) : 0.15;
        crossAcc += dt * rate;
        while (crossAcc >= 1 && crossers.length < 80) {
          crossAcc -= 1;
          const hole = Math.random() < 0.5;
          const forward = I > 0;
          const mesh = new THREE.Mesh(dotGeo, hole ? hMat : eMat);
          kit.add(mesh);
          const y = (Math.random() * 2 - 1) * (HY - 0.2);
          // forward: majority carriers diffuse over the barrier; reverse: minority carriers are swept by the field
          const dir = hole ? (forward ? 1 : -1) : (forward ? -1 : 1);
          const x = hole ? (forward ? -xpS : xnS) : (forward ? xnS : -xpS);
          crossers.push({ x, y, vx: 2.2 * dir, vy: 0, mesh, life: 0, hole, stop: 0.5 + Math.random() * 2.5 });
        }
        for (const c of crossers) { c.x += c.vx * dt; c.life += dt; }
        crossers = crossers.filter((c) => {
          const gone = Math.abs(c.vx * c.life) > (c.stop + (xpS + xnS)) || Math.abs(c.x) > XL;
          if (gone) c.mesh.removeFromParent();
          return !gone;
        });
      },
      render() {
        for (const d of dots) d.mesh.position.set(d.x, d.y, 0.3);
        for (const c of crossers) { c.mesh.position.set(c.x, c.y, 0.35); c.mesh.scale.setScalar(Math.max(0.3, 1 - c.life * 0.25)); }
      },
      time: () => t,
      readouts(): Readout[] {
        const w = widths();
        const I = current(num(p, 'V'));
        return [
          { label: 'Barrier potential V₀', value: V0(), unit: 'V', tone: 'accent' },
          { label: 'Barrier height now V₀ − V', value: V0() - Veff(), unit: 'V' },
          { label: 'Depletion width W', value: w.W * 1e6, unit: 'µm', tone: 'accent' },
          { label: 'Width on p side x_p', value: w.xp * 1e6, unit: 'µm' },
          { label: 'Width on n side x_n', value: w.xn * 1e6, unit: 'µm' },
          { label: 'Peak electric field', value: w.Emax, unit: 'V/m' },
          { label: 'Diode current', value: I * 1000, unit: 'mA', tone: I > 1e-4 ? 'good' : undefined },
          { label: 'Bias', value: num(p, 'V') > 0 ? 'Forward' : num(p, 'V') < 0 ? 'Reverse' : 'None' },
        ];
      },
      equations(): Equation[] {
        const w = widths();
        return [
          { expr: 'V₀ = V_T ln(N_A N_D / nᵢ²)', sub: `= 0.0259 × ln(${n(NA())} × ${n(ND())} / 10²⁰) = ${n(V0())} V` },
          { expr: 'W = √[(2ε/e)(V₀ − V)(1/N_A + 1/N_D)]', sub: `= ${n(w.W * 1e6)} µm` },
          { expr: 'I = Iₛ (e^{V/V_T} − 1)', sub: `= ${n(current(num(p, 'V')) * 1000)} mA` },
        ];
      },
      dispose() { dotGeo.dispose(); ionGeo.dispose(); },
    };
  },
};

export default sim;
