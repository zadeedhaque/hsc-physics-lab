import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { h, hbar, me, mp } from '../../physics/constants';
import { C } from '../../engine/colors';
import { n } from '../shared';

const PARTICLES: Record<string, { name: string; m: number }> = {
  electron: { name: 'Electron', m: me },
  proton: { name: 'Proton', m: mp },
};
const X0 = -6; // initial packet centre (nm)
const XMAX = 10; // half-width of the view (nm); 1 scene unit = 1 nm
const NPTS = 1200;

const sim: SimDefinition = {
  camera: { position: [0, 3.5, 13], target: [0, 0.5, 0], aspect: 1.6 },
  hint: 'The packet is a helix: its height is Re ψ and its depth is Im ψ. Squeeze Δx and the momentum spread grows — and the packet then spreads out faster.',
  params: [
    { kind: 'slider', key: 'dx', label: 'Initial position spread Δx', unit: 'nm', min: 0.2, max: 2.5, step: 0.05, default: 0.8 },
    { kind: 'slider', key: 'lam', label: 'de Broglie wavelength λ₀', unit: 'nm', min: 0.4, max: 3, step: 0.05, default: 1 },
    { kind: 'select', key: 'particle', label: 'Particle', default: 'electron', options: Object.entries(PARTICLES).map(([value, pt]) => ({ value, label: pt.name })) },
  ],
  presets: [
    { label: 'Narrow packet', values: { dx: 0.3 } },
    { label: 'Wide packet', values: { dx: 2 } },
    { label: 'Short wavelength', values: { lam: 0.5, dx: 1 } },
    { label: 'Proton (slower spreading)', values: { particle: 'proton' } },
  ],
  graphs: [
    { id: 'x', title: 'Position probability |ψ(x)|²', x: 'x (nm)', y: '|ψ|²', kind: 'curve', xRange: [-XMAX, XMAX], zeroY: true, series: [{ label: 'now', color: C.accent }, { label: 't = 0', color: '#94a3b8', dashed: true }] },
    { id: 'p', title: 'Momentum probability |φ(p)|²', x: 'p (×10⁻²⁴ kg·m/s)', y: '|φ|²', kind: 'curve', zeroY: true, series: [{ label: 'momentum spread (constant)', color: C.acceleration }] },
  ],
  learn: {
    concept: 'Heisenberg’s uncertainty principle: a particle’s position and momentum cannot both be known exactly. For any wave packet Δx·Δp ≥ ħ/2 (often written ΔxΔp ≈ h). A packet localised in a small region must be built from waves with many different wavelengths — a wide range of momenta — so a narrower Δx means a larger Δp. The minimum is reached by a Gaussian packet, which then spreads as it moves.',
    variables: [['Δx', 'uncertainty (spread) in position'], ['Δp', 'uncertainty in momentum'], ['ħ', 'h/2π = 1.055 × 10⁻³⁴ J·s'], ['λ₀', 'central de Broglie wavelength h/p₀']],
    observe: [
      'Halving Δx doubles Δp.',
      'The momentum distribution never changes for a free particle, but the position spread grows.',
      'At t = 0 the product ΔxΔp equals ħ/2 exactly; later it is larger.',
    ],
    challenge: 'An electron is confined to an atom (Δx ≈ 0.1 nm). What is the minimum uncertainty in its speed?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let tau = 0; // time in units of the spreading time T = 2mσ₀²/ħ
    const re = kit.line(C.accent, [], { width: 2 });
    const env = kit.line('#e2e8f0', [], { width: 1.2, opacity: 0.6 });
    const envN = kit.line('#e2e8f0', [], { width: 1.2, opacity: 0.6 });
    kit.line('#64748b', [[-XMAX, 0, 0], [XMAX, 0, 0]], { width: 1 });
    const bar = kit.line(C.acceleration, [], { width: 3 });
    const barLabel = kit.label('', [0, 0, 0], { color: C.acceleration, small: true });
    const tLabel = kit.label('', [-8, 3, 0], { small: true });

    const m = () => (PARTICLES[str(p, 'particle')] ?? PARTICLES.electron).m;
    const s0 = () => num(p, 'dx') * 1e-9;
    const k0 = () => (2 * Math.PI) / (num(p, 'lam') * 1e-9);
    const T = () => (2 * m() * s0() * s0()) / hbar;
    const width = () => num(p, 'dx') * Math.sqrt(1 + tau * tau);
    const centre = () => X0 + 2 * k0() * s0() * s0() * 1e9 * tau; // v·t = (ħk₀/m)(2mσ₀²/ħ)τ
    /** Exact free Gaussian packet ψ(x, τ) (unnormalised, peak 1 at τ = 0), with x in nm. */
    function psi(xnm: number): [number, number] {
      const x = (xnm - X0) * 1e-9, s = s0(), k = k0();
      // a = 1 + iτ ;  ψ = a^(-1/2) exp(−(x − vt)²/(4σ²a) + i k x − i ω t)
      const ar = 1, ai = tau, mag2 = ar * ar + ai * ai;
      const vt = 2 * k * s * s * tau;
      const u = (x - vt) ** 2 / (4 * s * s);
      const Er = -u * ar / mag2, Ei = u * ai / mag2; // −u/a
      const phase = Ei + k * x - k * k * s * s * tau; // ωt = ħk²t/2m = k²σ²τ
      const amp = Math.exp(Er) / Math.pow(mag2, 0.25);
      const ph2 = phase - 0.5 * Math.atan2(ai, ar);
      return [amp * Math.cos(ph2), amp * Math.sin(ph2)];
    }
    const prob = (x: number) => { const [a, b] = psi(x); return a * a + b * b; };
    const prob0 = (x: number) => Math.exp(-(((x - X0) ** 2) / (2 * num(p, 'dx') ** 2)));
    function momentumGraph() {
      const p0 = (h / (num(p, 'lam') * 1e-9)) * 1e24, sp = (hbar / (2 * s0())) * 1e24;
      const G = graphs.get('p');
      G.plot(0, Math.max(0, p0 - 4 * sp), p0 + 4 * sp, (q) => Math.exp(-((q - p0) ** 2) / (2 * sp * sp)), 200);
      G.setVLines([{ x: p0, label: 'p₀' }]);
    }
    momentumGraph();

    function draw() {
      const R: [number, number, number][] = [], E: [number, number, number][] = [], EN: [number, number, number][] = [];
      for (let i = 0; i <= NPTS; i++) {
        const x = -XMAX + (2 * XMAX * i) / NPTS;
        const [a, b] = psi(x);
        const A = Math.hypot(a, b);
        R.push([x, 2 * a, 2 * b]);
        E.push([x, 2 * A, 0]); EN.push([x, -2 * A, 0]);
      }
      re.setPoints(R); env.setPoints(E); envN.setPoints(EN);
      const w = width(), c0 = centre();
      bar.setPoints([[c0 - w, -2.6, 0], [c0 + w, -2.6, 0]]);
      barLabel.at([c0, -3.1, 0]).setText(`Δx = ${n(w)} nm`);
      tLabel.setText(`t = ${n(tau * T())} s`);
      const G = graphs.get('x');
      G.plot(0, -XMAX, XMAX, prob, 600);
      G.plot(1, -XMAX, XMAX, prob0, 300);
    }
    draw();

    return {
      setParams(np) { p = np; momentumGraph(); draw(); },
      reset() { tau = 0; draw(); },
      step(dt) {
        // advance so the packet crosses the view in ~8 s, but never faster than 0.5 T per second
        const speed = 2 * k0() * s0() * s0() * 1e9; // nm per unit τ
        tau += dt * Math.min(0.5, 16 / 8 / Math.max(speed, 1e-9));
      },
      render() { draw(); },
      done: () => centre() - 2 * width() > XMAX || width() > 8,
      time: () => tau * T(),
      readouts(): Readout[] {
        const dp = hbar / (2 * s0());
        const dxNow = width() * 1e-9;
        return [
          { label: 'Δx (initial)', value: num(p, 'dx'), unit: 'nm' },
          { label: 'Minimum Δp = ħ / 2Δx', value: dp, unit: 'kg·m/s', tone: 'accent' },
          { label: 'Minimum Δv = Δp / m', value: dp / m(), unit: 'm/s', tone: 'accent' },
          { label: 'Central momentum p₀ = h/λ₀', value: h / (num(p, 'lam') * 1e-9), unit: 'kg·m/s' },
          { label: 'Group velocity', value: (hbar * k0()) / m(), unit: 'm/s' },
          { label: 'Δx now', value: width(), unit: 'nm' },
          { label: 'Δx·Δp / (ħ/2) now', value: (dxNow * dp) / (hbar / 2) },
          { label: 'Spreading time 2mΔx²/ħ', value: T(), unit: 's' },
        ];
      },
      equations(): Equation[] {
        const dp = hbar / (2 * s0());
        return [
          { expr: 'Δx · Δp ≥ ħ / 2', sub: `Δp ≥ 1.055×10⁻³⁴ / (2 × ${n(s0())}) = ${n(dp)} kg·m/s` },
          { expr: 'Δv = Δp / m', sub: `= ${n(dp / m())} m/s` },
          { expr: 'Δx(t) = Δx₀ √(1 + (ħt / 2mΔx₀²)²)', sub: `= ${n(width())} nm` },
        ];
      },
    };
  },
};

export default sim;
