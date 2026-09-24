import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num } from '../types';
import { blackbodyRGB, planck, wienPeak } from '../../physics/modern';
import { wavelengthToRGB } from '../../physics/optics';
import { c, kB, sigmaSB } from '../../physics/constants';
import { C } from '../../engine/colors';
import { n } from '../shared';

const BARS = 40;
const NM0 = 150, NM1 = 3000; // bar range (nm)
const RSUN = 6.957e8, LSUN = 3.828e26;

/** Fraction of σT⁴ emitted between λ₁ and λ₂ (numerical integral of Planck’s law, per unit solid angle × π). */
function bandFraction(T: number, l1: number, l2: number) {
  const N = 400;
  let s = 0;
  for (let i = 0; i < N; i++) { const l = l1 + ((l2 - l1) * (i + 0.5)) / N; s += planck(l, T); }
  return (Math.PI * s * ((l2 - l1) / N)) / (sigmaSB * T ** 4);
}

const sim: SimDefinition = {
  camera: { position: [0, 3, 14], target: [0, 1.5, 0], aspect: 1.5 },
  timeless: true,
  hint: 'Hotter bodies glow brighter at every wavelength, and their peak moves toward the blue: λ_max = b/T.',
  params: [
    { kind: 'slider', key: 'T', label: 'Temperature', unit: 'K', min: 1000, max: 30000, step: 50, default: 5800 },
    { kind: 'toggle', key: 'cmp', label: 'Compare with a second body', default: false },
    { kind: 'slider', key: 'T2', label: 'Second temperature', unit: 'K', min: 1000, max: 30000, step: 50, default: 3000, showIf: (p) => p.cmp === true },
    { kind: 'toggle', key: 'rj', label: 'Show the classical (Rayleigh–Jeans) prediction', default: false },
    { kind: 'slider', key: 'R', label: 'Radius of the star', unit: 'R☉', min: 0.01, max: 1000, step: 0.01, default: 1 },
  ],
  presets: [
    { label: 'Sun (5800 K)', values: { T: 5800, R: 1 } },
    { label: 'Light bulb filament (2800 K)', values: { T: 2800, R: 0.01 } },
    { label: 'Red dwarf vs Sun', values: { T: 3000, cmp: true, T2: 5800, R: 0.2 } },
    { label: 'Blue star (Rigel, 12 100 K)', values: { T: 12100, R: 79 } },
    { label: 'Ultraviolet catastrophe', values: { T: 5800, rj: true } },
  ],
  graphs: [
    { id: 'B', title: 'Spectral radiance (Planck’s law)', x: 'λ (nm)', y: 'B (×10¹³ W·sr⁻¹·m⁻³)', kind: 'curve', xRange: [100, 3000], zeroY: true, series: [{ label: 'T', color: C.accent }, { label: 'second body', color: '#60a5fa' }, { label: 'Rayleigh–Jeans (classical)', color: '#ef4444', dashed: true }] },
    { id: 'P', title: 'Power per square metre vs temperature', x: 'T (K)', y: 'σT⁴ (MW/m²)', kind: 'curve', xRange: [1000, 30000], zeroY: true, series: [{ label: 'Stefan–Boltzmann', color: C.hot }] },
  ],
  learn: {
    concept: 'Every object emits thermal radiation. An ideal emitter (a blackbody) has a spectrum fixed by temperature alone, given by Planck’s law, which assumes light is emitted in quanta E = hf. Two consequences: the peak wavelength is inversely proportional to temperature (Wien: λ_max = 2.898 × 10⁻³ m·K / T), and the total power per unit area rises as T⁴ (Stefan–Boltzmann: P/A = σT⁴). Classical physics (Rayleigh–Jeans) predicted infinite ultraviolet emission — the “ultraviolet catastrophe” that quantum theory solved.',
    variables: [['T', 'absolute temperature'], ['λ_max', 'wavelength of peak emission'], ['σ', '5.67 × 10⁻⁸ W·m⁻²·K⁻⁴'], ['b', 'Wien constant 2.898 × 10⁻³ m·K'], ['L', 'luminosity 4πR²σT⁴']],
    observe: [
      'Doubling T halves λ_max and multiplies the total power by 16.',
      'Cool stars look red and hot stars blue-white; the Sun peaks in the visible.',
      'A filament bulb emits mostly infrared — most of its energy is not light.',
      'The classical curve agrees at long wavelengths but explodes at short ones.',
    ],
    challenge: 'Your body is at 310 K. At what wavelength does it emit most strongly?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    const star = kit.sphere(1.3, '#ffffff', { emissive: 1 });
    star.position.set(-5, 2.2, 0);
    const halo = kit.sphere(2, '#ffffff', { opacity: 0.15, emissive: 1 });
    halo.position.copy(star.position);
    const star2 = kit.sphere(0.9, '#ffffff', { emissive: 1 });
    star2.position.set(-5, -1.3, 0);
    const tLabel = kit.label('', [-5, 4.1, 0], { small: true });
    const t2Label = kit.label('', [-5, -2.6, 0], { small: true });
    // spectrum bars along x from −2 to 7
    const bars: THREE.Mesh[] = [];
    const geo = new THREE.BoxGeometry(0.2, 1, 0.3);
    geo.translate(0, 0.5, 0);
    for (let i = 0; i < BARS; i++) {
      const nm = NM0 * Math.pow(NM1 / NM0, (i + 0.5) / BARS);
      const color = nm < 380 ? '#7c3aed' : nm > 750 ? '#7f1d1d' : new THREE.Color(...wavelengthToRGB(nm)).getStyle();
      const m = new THREE.Mesh(geo, kit.mat(color, { emissive: 0.5 }));
      m.position.set(-2 + (9 * i) / BARS, -1, 0);
      kit.add(m); bars.push(m);
    }
    const xAt = (nm: number) => -2 + 9 * (Math.log(nm / NM0) / Math.log(NM1 / NM0));
    kit.line('#64748b', [[-2.2, -1, 0], [7.2, -1, 0]], { width: 1.5 });
    for (const nm of [200, 400, 700, 1000, 2000]) kit.label(`${nm} nm`, [xAt(nm), -1.5, 0], { small: true });
    kit.label('UV', [xAt(250), 5.3, 0], { small: true, color: '#a78bfa' });
    kit.label('visible', [xAt(530), 5.3, 0], { small: true });
    kit.label('infrared', [xAt(1500), 5.3, 0], { small: true, color: '#f87171' });
    const peak = kit.line('#ffffff', [], { width: 1.5, dashed: true });
    const peakLabel = kit.label('', [0, 0, 0], { small: true });

    const T = () => num(p, 'T');
    const rj = (l: number, t: number) => (2 * c * kB * t) / l ** 4;
    function build() {
      const t = T();
      const col = new THREE.Color(...blackbodyRGB(t));
      const bright = Math.min(1.6, 0.3 + Math.log10(t / 800));
      for (const m of [star, halo]) { const mt = m.material as THREE.MeshStandardMaterial; mt.color.copy(col); mt.emissive.copy(col); mt.emissiveIntensity = bright; }
      halo.scale.setScalar(0.8 + 0.3 * Math.log10(t / 1000));
      tLabel.setText(`${n(t)} K`);
      star2.visible = bool(p, 'cmp');
      const col2 = new THREE.Color(...blackbodyRGB(num(p, 'T2')));
      const m2 = star2.material as THREE.MeshStandardMaterial;
      m2.color.copy(col2); m2.emissive.copy(col2); m2.emissiveIntensity = Math.min(1.6, 0.3 + Math.log10(num(p, 'T2') / 800));
      t2Label.setText(bool(p, 'cmp') ? `${n(num(p, 'T2'))} K` : '');
      // bars: heights ∝ B(λ, T), normalised to the maximum of both bodies
      const Bmax = Math.max(planck(wienPeak(t), t), bool(p, 'cmp') ? planck(wienPeak(num(p, 'T2')), num(p, 'T2')) : 0);
      bars.forEach((m, i) => {
        const nm = NM0 * Math.pow(NM1 / NM0, (i + 0.5) / BARS);
        m.scale.y = Math.max(0.01, (5.5 * planck(nm * 1e-9, t)) / Bmax);
      });
      const lp = wienPeak(t) * 1e9;
      const inRange = lp >= NM0 && lp <= NM1;
      peak.visible = inRange;
      if (inRange) peak.setPoints([[xAt(lp), -1, 0.2], [xAt(lp), 4.8, 0.2]]);
      peakLabel.at([inRange ? xAt(lp) : 7, 5, 0.2]).setText(inRange ? `λ_max ${n(lp)} nm` : `λ_max ${n(lp)} nm →`);
      const G = graphs.get('B');
      G.plot(0, 100, 3000, (nm) => planck(nm * 1e-9, t) / 1e13, 400);
      G.plot(1, 100, 3000, (nm) => (bool(p, 'cmp') ? planck(nm * 1e-9, num(p, 'T2')) / 1e13 : NaN), 400);
      G.plot(2, 100, 3000, (nm) => (bool(p, 'rj') ? Math.min(rj(nm * 1e-9, t), planck(wienPeak(t), t) * 3) / 1e13 : NaN), 400);
      G.setVLines([{ x: Math.min(3000, lp), label: 'λ_max' }]);
      graphs.get('P').plot(0, 1000, 30000, (x) => (sigmaSB * x ** 4) / 1e6, 300);
      graphs.get('P').setMarkers([{ x: t, y: (sigmaSB * t ** 4) / 1e6, color: C.hot }]);
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { build(); },
      step() {},
      readouts(): Readout[] {
        const t = T();
        const flux = sigmaSB * t ** 4;
        const L = 4 * Math.PI * (num(p, 'R') * RSUN) ** 2 * flux;
        return [
          { label: 'Peak wavelength λ_max', value: wienPeak(t) * 1e9, unit: 'nm', tone: 'accent' },
          { label: 'Power per m² (σT⁴)', value: flux, unit: 'W/m²', tone: 'accent' },
          { label: 'Luminosity 4πR²σT⁴', value: L / LSUN, unit: 'L☉' },
          { label: 'Fraction emitted as visible light', value: bandFraction(t, 380e-9, 750e-9) * 100, unit: '%' },
          { label: 'Fraction emitted as infrared (> 750 nm)', value: Math.max(0, 1 - bandFraction(t, 10e-9, 750e-9)) * 100, unit: '%' },
          { label: 'Power ratio to second body', value: bool(p, 'cmp') ? (t / num(p, 'T2')) ** 4 : '—' },
        ];
      },
      equations(): Equation[] {
        const t = T();
        return [
          { expr: 'λ_max T = b', sub: `λ_max = 2.898×10⁻³ / ${n(t)} = ${n(wienPeak(t) * 1e9)} nm` },
          { expr: 'P / A = σ T⁴', sub: `= 5.67×10⁻⁸ × ${n(t)}⁴ = ${n(sigmaSB * t ** 4)} W/m²` },
          { expr: 'B(λ, T) = (2hc²/λ⁵) · 1 / (e^{hc/λkT} − 1)', note: 'Planck’s law' },
        ];
      },
    };
  },
};

export default sim;
