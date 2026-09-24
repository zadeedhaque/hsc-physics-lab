import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num, str } from '../types';
import { blackbodyRGB, planck, spectralClass, wienPeak } from '../../physics/modern';
import { rng, gauss } from '../../lib/num';
import { C } from '../../engine/colors';
import { n } from '../shared';

/** Named stars: effective temperature (K) and luminosity (L☉). */
const STARS: Record<string, { name: string; T: number; L: number }> = {
  sun: { name: 'Sun', T: 5778, L: 1 },
  sirius: { name: 'Sirius A', T: 9940, L: 25.4 },
  siriusb: { name: 'Sirius B (white dwarf)', T: 25000, L: 0.056 },
  vega: { name: 'Vega', T: 9602, L: 40 },
  betelgeuse: { name: 'Betelgeuse', T: 3500, L: 126000 },
  rigel: { name: 'Rigel', T: 12100, L: 120000 },
  antares: { name: 'Antares', T: 3400, L: 75900 },
  aldebaran: { name: 'Aldebaran', T: 3910, L: 518 },
  arcturus: { name: 'Arcturus', T: 4286, L: 170 },
  polaris: { name: 'Polaris', T: 6015, L: 1260 },
  deneb: { name: 'Deneb', T: 8525, L: 196000 },
  spica: { name: 'Spica', T: 22400, L: 20500 },
  procyon: { name: 'Procyon A', T: 6530, L: 6.93 },
  procyonb: { name: 'Procyon B (white dwarf)', T: 7740, L: 0.00049 },
  proxima: { name: 'Proxima Centauri', T: 3042, L: 0.0017 },
  acenb: { name: 'Alpha Centauri B', T: 5260, L: 0.5 },
  barnard: { name: 'Barnard’s Star', T: 3134, L: 0.0035 },
  altair: { name: 'Altair', T: 7670, L: 10.6 },
  capella: { name: 'Capella', T: 4970, L: 78.7 },
  eri40b: { name: '40 Eridani B (white dwarf)', T: 16500, L: 0.013 },
};
/** Approximate evolutionary track of a 1 M☉ star: [log T, log L, age label]. */
const SUN_TRACK: [number, number, string][] = [
  [3.76, -0.15, 'zero-age main sequence'], [3.762, 0, 'today (4.6 Gyr)'], [3.76, 0.25, 'end of main sequence (~10 Gyr)'],
  [3.7, 0.4, 'subgiant'], [3.66, 1.2, 'red giant branch'], [3.6, 3.3, 'tip of red giant branch'],
  [3.7, 1.7, 'helium burning (horizontal branch)'], [3.58, 3.6, 'asymptotic giant branch'],
  [4.2, 3.6, 'planetary nebula ejected'], [5.0, 2.0, 'hot core exposed'], [4.9, 0, 'white dwarf'], [4.5, -2.5, 'cooling white dwarf'],
];

const X_HOT = 4.7, X_COOL = 3.4; // log T span, hot on the left
const Y_LO = -4.5, Y_HI = 6;
const sx = (logT: number) => -8 + ((X_HOT - logT) / (X_HOT - X_COOL)) * 16;
const sy = (logL: number) => -5 + ((logL - Y_LO) / (Y_HI - Y_LO)) * 10;
const radius = (T: number, L: number) => Math.sqrt(L) / (T / 5778) ** 2; // R/R☉ from Stefan–Boltzmann

function group(T: number, L: number) {
  const R = radius(T, L);
  if (R < 0.05) return 'White dwarf';
  if (R > 100) return 'Supergiant';
  // main sequence: L ≈ (T/5778)^6.5 roughly
  const ms = 6.5 * Math.log10(T / 5778);
  if (Math.log10(L) > ms + 1.2 && R > 5) return 'Giant';
  return 'Main sequence';
}

const sim: SimDefinition = {
  camera: { position: [0, 0.5, 17], target: [0, 0.3, 0], aspect: 1.6 },
  hint: 'Hot stars are on the left, luminous stars at the top. Most stars (like the Sun) lie on the main-sequence band.',
  params: [
    { kind: 'select', key: 'star', label: 'Highlight a star', default: 'sun', options: [...Object.entries(STARS).map(([value, s]) => ({ value, label: s.name })), { value: 'custom', label: 'Custom star' }] },
    { kind: 'slider', key: 'T', label: 'Surface temperature', unit: 'K', min: 2500, max: 45000, step: 50, default: 8000, showIf: (p) => p.star === 'custom' },
    { kind: 'slider', key: 'logL', label: 'Luminosity log₁₀(L/L☉)', min: -4, max: 6, step: 0.05, default: 1, showIf: (p) => p.star === 'custom' },
    { kind: 'toggle', key: 'radii', label: 'Lines of constant radius', default: true },
    { kind: 'toggle', key: 'evolve', label: 'Animate the Sun’s life story', default: false },
  ],
  presets: [
    { label: 'The Sun', values: { star: 'sun', evolve: false } },
    { label: 'A red supergiant', values: { star: 'betelgeuse' } },
    { label: 'A white dwarf', values: { star: 'siriusb' } },
    { label: 'Future of the Sun', values: { star: 'sun', evolve: true } },
  ],
  graphs: [
    { id: 'S', title: 'Spectrum of the highlighted star', x: 'λ (nm)', y: 'relative intensity', kind: 'curve', xRange: [100, 2500], yRange: [0, 1.05], series: [{ label: 'Planck curve', color: C.accent }] },
  ],
  learn: {
    concept: 'The Hertzsprung–Russell diagram plots stars’ luminosity against surface temperature (hot stars on the left). About 90 % of stars lie on the main sequence, burning hydrogen in their cores; more massive ones are hotter and brighter. Giants and supergiants (top right) are cool but huge; white dwarfs (bottom left) are hot but tiny. Temperature sets a star’s colour and spectral class (O B A F G K M), and L = 4πR²σT⁴ links luminosity, radius and temperature.',
    variables: [['L', 'luminosity (in L☉ = 3.83 × 10²⁶ W)'], ['T', 'surface temperature'], ['R', 'radius (R☉)'], ['O–M', 'spectral classes from hottest to coolest'], ['λ_max', 'Wien peak b/T']],
    observe: [
      'Along any dashed line the radius is the same: going up and right the stars get bigger.',
      'Betelgeuse and Sirius B have very different luminosity even though both are “stars”.',
      'The Sun will swell into a red giant and end as a white dwarf.',
    ],
    challenge: 'Using L = 4πR²σT⁴, show that Betelgeuse is roughly 900 times wider than the Sun.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const rand = rng(7);
    // background population: main sequence + giants + white dwarfs
    const pts: { T: number; L: number }[] = [];
    for (let i = 0; i < 420; i++) {
      const g = gauss(rand);
      const kind = rand();
      if (kind < 0.82) { const logT = 3.47 + rand() * 1.15; const logL = 6.5 * (logT - Math.log10(5778)) * (logT > 4 ? 0.8 : 1) + g * 0.25; pts.push({ T: 10 ** logT, L: 10 ** logL }); }
      else if (kind < 0.93) { const logT = 3.55 + rand() * 0.2; pts.push({ T: 10 ** logT, L: 10 ** (1.5 + rand() * 1.8 + g * 0.2) }); }
      else if (kind < 0.96) { const logT = 3.5 + rand() * 1.0; pts.push({ T: 10 ** logT, L: 10 ** (4.2 + rand() * 1.3) }); }
      else { const logT = 3.85 + rand() * 0.6; pts.push({ T: 10 ** logT, L: 10 ** (-3.8 + rand() * 1.8) }); }
    }
    const all = [...pts, ...Object.values(STARS)];
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }), all.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    all.forEach((s, i) => {
      const r = Math.min(3, Math.max(0.5, 0.8 + 0.25 * Math.log10(radius(s.T, s.L) + 1e-3)));
      m4.makeScale(r, r, r).setPosition(sx(Math.log10(s.T)), sy(Math.log10(s.L)), 0);
      inst.setMatrixAt(i, m4);
      inst.setColorAt(i, col.setRGB(...blackbodyRGB(s.T)));
    });
    kit.add(inst);
    // axes
    kit.line('#64748b', [[-8.3, -5.3, 0], [8.3, -5.3, 0]], { width: 1.5 });
    kit.line('#64748b', [[-8.3, -5.3, 0], [-8.3, 5.3, 0]], { width: 1.5 });
    for (const T of [40000, 20000, 10000, 6000, 4000, 3000]) kit.label(`${T / 1000}k K`, [sx(Math.log10(T)), -5.8, 0], { small: true });
    for (let l = -4; l <= 6; l += 2) kit.label(`10${l < 0 ? '⁻' : ''}${'⁰¹²³⁴⁵⁶⁷⁸⁹'[Math.abs(l)]}`, [-9.1, sy(l), 0], { small: true });
    kit.label('Temperature (hot → cool)', [0, -6.5, 0], { small: true });
    kit.label('L / L☉', [-9.1, 5.8, 0], { small: true });
    ['O', 'B', 'A', 'F', 'G', 'K', 'M'].forEach((c, i) => { const T = [40000, 20000, 8750, 6750, 5600, 4400, 3200][i]; kit.label(c, [sx(Math.log10(T)), 5.7, 0], { small: true, color: new THREE.Color(...blackbodyRGB(T)).getStyle() }); });
    kit.label('Main sequence', [-5.2, 3.7, 0], { small: true, color: '#94a3b8' });
    kit.label('Giants', [5.5, 3.1, 0], { small: true, color: '#94a3b8' });
    kit.label('Supergiants', [3, 5, 0], { small: true, color: '#94a3b8' });
    kit.label('White dwarfs', [-3.5, -4.2, 0], { small: true, color: '#94a3b8' });
    // constant-radius lines: log L = 2 log R + 4 log(T/5778)
    const radiusLines = kit.add(new THREE.Group());
    for (const R of [0.01, 0.1, 1, 10, 100, 1000]) {
      const seg: [number, number, number][] = [];
      for (let lt = X_COOL; lt <= X_HOT + 1e-9; lt += 0.05) { const ll = 2 * Math.log10(R) + 4 * (lt - Math.log10(5778)); if (ll >= Y_LO && ll <= Y_HI) seg.push([sx(lt), sy(ll), -0.05]); }
      if (seg.length > 1) { radiusLines.add(kit.line('#475569', seg, { width: 1, dashed: true })); const end = seg[0]; const l = kit.label(`${R} R☉`, [end[0] - 0.2, end[1] + 0.35, 0], { small: true, color: '#64748b' }); radiusLines.add(l); }
    }
    const marker = kit.torus(0.3, 0.05, '#ffffff');
    const markLabel = kit.label('', [0, 0, 0], { small: true });
    const track = kit.line(C.accent, SUN_TRACK.map(([lt, ll]) => [sx(lt), sy(ll), 0.05] as [number, number, number]), { width: 2, dashed: true });
    const evoDot = kit.sphere(0.25, '#ffffff', { emissive: 1 });

    const custom = () => str(p, 'star') === 'custom';
    const evolving = () => bool(p, 'evolve');
    const evoPos = () => {
      const u = (t / 3) % (SUN_TRACK.length - 1);
      const i = Math.floor(u), f = u - i;
      const a = SUN_TRACK[i], b = SUN_TRACK[i + 1];
      return { logT: a[0] + (b[0] - a[0]) * f, logL: a[1] + (b[1] - a[1]) * f, label: f < 0.5 ? a[2] : b[2] };
    };
    const sel = () => {
      if (evolving()) { const e = evoPos(); return { name: `Sun: ${e.label}`, T: 10 ** e.logT, L: 10 ** e.logL }; }
      if (custom()) return { name: 'Custom star', T: num(p, 'T'), L: 10 ** num(p, 'logL') };
      return STARS[str(p, 'star')] ?? STARS.sun;
    };
    function spectrum() {
      const s = sel();
      const peak = planck(wienPeak(s.T), s.T);
      graphs.get('S').plot(0, 100, 2500, (nm) => planck(nm * 1e-9, s.T) / peak, 300);
      graphs.get('S').setVLines([{ x: 380, label: 'violet' }, { x: 750, label: 'red' }, { x: Math.min(2500, wienPeak(s.T) * 1e9), label: 'λ_max' }]);
    }
    function build() {
      radiusLines.visible = bool(p, 'radii');
      track.visible = evolving(); evoDot.visible = evolving();
      spectrum();
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; build(); },
      step(dt) { t += dt; },
      render() {
        const s = sel();
        const x = sx(Math.log10(s.T)), y = sy(Math.log10(s.L));
        marker.position.set(x, y, 0.1);
        marker.scale.setScalar(1 + 0.15 * Math.sin(t * 4));
        markLabel.at([x + 0.9, y + 0.5, 0]).setText(s.name);
        if (evolving()) {
          evoDot.position.set(x, y, 0.15);
          (evoDot.material as THREE.MeshStandardMaterial).color.setRGB(...blackbodyRGB(s.T));
          (evoDot.material as THREE.MeshStandardMaterial).emissive.setRGB(...blackbodyRGB(s.T));
          spectrum();
        }
      },
      time: () => t,
      readouts(): Readout[] {
        const s = sel();
        return [
          { label: 'Star', value: s.name },
          { label: 'Surface temperature', value: s.T, unit: 'K' },
          { label: 'Luminosity', value: s.L, unit: 'L☉', tone: 'accent' },
          { label: 'Radius (from L = 4πR²σT⁴)', value: radius(s.T, s.L), unit: 'R☉', tone: 'accent' },
          { label: 'Spectral class', value: spectralClass(s.T) },
          { label: 'Type', value: group(s.T, s.L) },
          { label: 'Peak wavelength λ_max', value: wienPeak(s.T) * 1e9, unit: 'nm' },
          { label: 'Luminosity in watts', value: s.L * 3.828e26, unit: 'W' },
        ];
      },
      equations(): Equation[] {
        const s = sel();
        return [
          { expr: 'L = 4πR²σT⁴  ⇒  R/R☉ = √(L/L☉) / (T/T☉)²', sub: `= √${n(s.L)} / (${n(s.T)}/5778)² = ${n(radius(s.T, s.L))} R☉` },
          { expr: 'λ_max = b / T', sub: `= 2.898×10⁻³ / ${n(s.T)} = ${n(wienPeak(s.T) * 1e9)} nm` },
        ];
      },
    };
  },
};

export default sim;
