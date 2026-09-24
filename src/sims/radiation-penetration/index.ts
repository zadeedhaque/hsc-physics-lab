import * as THREE from 'three';
import type { Equation, Params, Readout, SimAction, SimDefinition } from '../types';
import { bool, num, str } from '../types';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

/** 1 scene unit = 1 cm. */
const XS = -8; // source position
const XA = -7; // front face of the absorber (1 cm from the source)
const CONE = (6 * Math.PI) / 180; // collimator half-angle
const APERTURE = 0.5; // detector window radius (cm)

const MATERIALS: Record<string, { name: string; rho: number; muGamma: number; color: string }> = {
  none: { name: 'None (air only)', rho: 0, muGamma: 0, color: '#000' },
  paper: { name: 'Paper', rho: 0.8, muGamma: 0.06, color: '#f5f5f4' },
  al: { name: 'Aluminium', rho: 2.7, muGamma: 0.055, color: '#cbd5e1' },
  pb: { name: 'Lead', rho: 11.35, muGamma: 0.068, color: '#475569' },
};
type Kind = 'alpha' | 'beta' | 'gamma';
const KINDS: Record<Kind, { color: string; speed: number; omega: number; label: string }> = {
  alpha: { color: '#f87171', speed: 3, omega: 0.12, label: 'α (helium nucleus, +2e)' },
  beta: { color: '#60a5fa', speed: 6, omega: -1.4, label: 'β⁻ (fast electron, −e)' },
  gamma: { color: '#facc15', speed: 10, omega: 0, label: 'γ (photon, no charge)' },
};
const ALPHA_RANGE = 4.8; // cm of air for ~5 MeV α

interface Ray { kind: Kind; pos: THREE.Vector3; vel: THREE.Vector3; stopX: number; mesh: THREE.Mesh; dead: boolean }

const sim: SimDefinition = {
  camera: { position: [0, 5, 13], target: [-1, 0, 0], aspect: 1.7 },
  hint: 'α is stopped by a sheet of paper, β by a few millimetres of aluminium, and γ is only reduced — by about half for every centimetre of lead.',
  params: [
    { kind: 'select', key: 'type', label: 'Radiation', default: 'all', options: [{ value: 'all', label: 'Mixed α + β + γ' }, { value: 'alpha', label: 'Alpha only' }, { value: 'beta', label: 'Beta only' }, { value: 'gamma', label: 'Gamma only' }] },
    { kind: 'select', key: 'mat', label: 'Absorber', default: 'paper', options: Object.entries(MATERIALS).map(([value, m]) => ({ value, label: m.name })) },
    { kind: 'slider', key: 'thk', label: 'Absorber thickness', unit: 'mm', min: 0.1, max: 30, step: 0.1, default: 0.1, showIf: (p) => p.mat !== 'none' },
    { kind: 'slider', key: 'd', label: 'Source–detector distance', unit: 'cm', min: 3, max: 16, step: 0.5, default: 6 },
    { kind: 'toggle', key: 'B', label: 'Magnetic field (into the screen)', default: false },
  ],
  presets: [
    { label: 'Sheet of paper', values: { type: 'all', mat: 'paper', thk: 0.1, d: 4 } },
    { label: '3 mm aluminium', values: { type: 'all', mat: 'al', thk: 3, d: 4 } },
    { label: '1 cm lead', values: { type: 'gamma', mat: 'pb', thk: 10, d: 4 } },
    { label: 'α range in air', values: { type: 'alpha', mat: 'none', d: 6 } },
    { label: 'Deflect in a B-field', values: { type: 'all', mat: 'none', B: true, d: 10 } },
  ],
  graphs: [
    { id: 'T', title: 'Transmission through the absorber', x: 'thickness (mm)', y: 'fraction', kind: 'curve', xRange: [0, 30], yRange: [0, 1.05], series: [{ label: 'α', color: KINDS.alpha.color }, { label: 'β', color: KINDS.beta.color }, { label: 'γ', color: KINDS.gamma.color }] },
    { id: 'R', title: 'Detector count rate', x: 't (s)', y: 'counts/s', window: 30, zeroY: true, series: [{ label: 'measured', color: C.accent }] },
  ],
  learn: {
    concept: 'Radioactive nuclei emit three kinds of radiation. α-particles are heavy and doubly charged — strongly ionising, stopped by paper or a few cm of air. β-particles are fast electrons — less ionising, stopped by a few mm of aluminium. γ-rays are high-energy photons — weakly ionising and never completely stopped; their intensity falls exponentially, I = I₀e^(−μx). In a magnetic field α and β bend in opposite directions (β much more), while γ goes straight.',
    variables: [['μ', 'linear attenuation coefficient (cm⁻¹)'], ['x', 'absorber thickness'], ['x½', 'half-value thickness ln2/μ'], ['I₀', 'intensity without absorber']],
    observe: [
      'Moving the detector beyond ~5 cm removes all α, even with no absorber.',
      'The γ transmission curve never reaches zero.',
      'In the field, β curves one way and α slightly the other — so they have opposite charges.',
    ],
    challenge: 'How thick must a lead shield be to cut γ intensity to 1/8?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, acc = 0, hits = 0, recent: number[] = [];
    let rays: Ray[] = [];
    const sample = sampler(1);
    const src = kit.box(0.6, 0.8, 0.8, '#334155', { metalness: 0.5 });
    src.position.set(XS - 0.3, 0, 0);
    kit.label('source', [XS - 0.3, 0.9, 0], { small: true });
    const slab = kit.box(1, 3, 3, '#cbd5e1', { opacity: 0.85 });
    const slabLabel = kit.label('', [0, 0, 0], { small: true });
    const det = kit.cylinder(APERTURE, APERTURE, 1.6, '#64748b', { metalness: 0.4 });
    det.rotation.z = Math.PI / 2;
    const detLabel = kit.label('', [0, 0, 0], { color: C.accent, small: true });
    const field = kit.segments('#94a3b8', { width: 1, opacity: 0.35 });
    const ruler: number[] = [];
    for (let x = 0; x <= 16; x++) ruler.push(XS + x, -2, 0, XS + x, x % 5 === 0 ? -2.4 : -2.2, 0);
    const rl = kit.segments('#94a3b8', { width: 1 }); rl.setSegments(ruler);
    kit.label('0', [XS, -2.8, 0], { small: true }); kit.label('5 cm', [XS + 5, -2.8, 0], { small: true }); kit.label('10 cm', [XS + 10, -2.8, 0], { small: true }); kit.label('15 cm', [XS + 15, -2.8, 0], { small: true });

    const mat = () => MATERIALS[str(p, 'mat')] ?? MATERIALS.none;
    const thkCm = () => (str(p, 'mat') === 'none' ? 0 : num(p, 'thk') / 10);
    const XD = () => XS + num(p, 'd');
    /** Transmission through the absorber (mass thickness ρx in g/cm²). */
    function trans(kind: Kind, mm = num(p, 'thk'), m = mat()) {
      if (m.rho === 0) return 1;
      const rx = m.rho * (mm / 10);
      if (kind === 'alpha') return rx < 0.004 ? 1 : 0; // ~40 µm of paper stops α
      if (kind === 'beta') return Math.exp(-17 * rx) * (rx < 0.8 ? 1 : 0);
      return Math.exp(-m.muGamma * rx);
    }
    const kinds = (): Kind[] => (str(p, 'type') === 'all' ? ['alpha', 'beta', 'gamma'] : [str(p, 'type') as Kind]);

    function build() {
      const w = Math.max(0.03, thkCm());
      slab.visible = str(p, 'mat') !== 'none';
      slab.scale.set(w, 1, 1);
      slab.position.set(XA + w / 2, 0, 0);
      (slab.material as THREE.MeshStandardMaterial).color.set(mat().color);
      slabLabel.at([XA + w / 2, 1.9, 0]).setText(slab.visible ? `${mat().name} ${n(num(p, 'thk'))} mm` : '');
      det.position.set(XD() + 0.8, 0, 0);
      detLabel.at([XD() + 0.8, 1, 0]);
      const f: number[] = [];
      if (bool(p, 'B')) for (let x = -6; x <= 8; x += 2) for (let y = -1.5; y <= 1.5; y += 1.5) f.push(x - 0.12, y - 0.12, 0, x + 0.12, y + 0.12, 0, x - 0.12, y + 0.12, 0, x + 0.12, y - 0.12, 0);
      if (f.length) field.setSegments(f); else field.visible = false;
      const G = graphs.get('T');
      (['alpha', 'beta', 'gamma'] as Kind[]).forEach((k, i) => G.plot(i, 0, 30, (mm) => trans(k, mm), 300));
      G.setVLines(str(p, 'mat') === 'none' ? [] : [{ x: num(p, 'thk'), label: 'now' }]);
    }
    function clear() { rays.forEach((r) => { r.mesh.removeFromParent(); r.mesh.geometry.dispose(); }); rays = []; }
    function reset() { t = 0; acc = 0; hits = 0; recent = []; clear(); sample.reset(); build(); }
    reset();

    return {
      setParams(np) { p = np; build(); recent = []; hits = 0; },
      reset,
      step(dt) {
        t += dt;
        acc += dt * 45;
        const ks = kinds();
        while (acc >= 1 && rays.length < 300) {
          acc -= 1;
          const kind = ks[Math.floor(Math.random() * ks.length)];
          const K = KINDS[kind];
          // random direction inside the collimator cone
          const th = CONE * Math.sqrt(Math.random()), ph = Math.random() * Math.PI * 2;
          const dir = new THREE.Vector3(Math.cos(th), Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph));
          // fate: stopped in the absorber, or by its range in air
          let stopX = Infinity;
          if (Math.random() > trans(kind)) stopX = XA + Math.random() * Math.max(0.03, thkCm());
          if (kind === 'alpha') stopX = Math.min(stopX, XS + ALPHA_RANGE * (0.97 + Math.random() * 0.06));
          const mesh = kit.sphere(kind === 'alpha' ? 0.09 : 0.06, K.color, { emissive: 0.8 }, 6);
          rays.push({ kind, pos: new THREE.Vector3(XS, 0, 0), vel: dir.multiplyScalar(K.speed), stopX, mesh, dead: false });
        }
        const xd = XD();
        for (const r of rays) {
          const K = KINDS[r.kind];
          if (bool(p, 'B') && K.omega !== 0) r.vel.applyAxisAngle(new THREE.Vector3(0, 0, 1), K.omega * dt);
          const x0 = r.pos.x;
          r.pos.addScaledVector(r.vel, dt);
          if (r.pos.x >= r.stopX) { r.dead = true; continue; }
          if (x0 < xd && r.pos.x >= xd) {
            if (Math.hypot(r.pos.y, r.pos.z) <= APERTURE) hits++;
            r.dead = true;
          }
          if (Math.abs(r.pos.y) > 6 || r.pos.x < XS - 1) r.dead = true;
        }
        rays = rays.filter((r) => { if (r.dead) { r.mesh.removeFromParent(); r.mesh.geometry.dispose(); } return !r.dead; });
        if (sample.due(t)) {
          recent.push(hits); hits = 0;
          if (recent.length > 5) recent.shift();
          graphs.get('R').push(t, recent[recent.length - 1]);
        }
      },
      render() {
        for (const r of rays) r.mesh.position.copy(r.pos);
        const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
        detLabel.setText(`GM: ${n(avg)} /s`);
      },
      time: () => t,
      actions(): SimAction[] {
        return [{ id: 'clear', label: 'Reset counter', run: () => { recent = []; hits = 0; } }];
      },
      readouts(): Readout[] {
        const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
        const mu = mat().muGamma * mat().rho;
        return [
          { label: 'Count rate (5 s average)', value: avg, unit: '/s', tone: 'accent' },
          { label: 'α transmitted', value: trans('alpha') * (num(p, 'd') < ALPHA_RANGE ? 1 : 0), tone: 'accent' },
          { label: 'β transmitted', value: trans('beta') },
          { label: 'γ transmitted', value: trans('gamma') },
          { label: 'γ attenuation coefficient μ', value: mu, unit: 'cm⁻¹' },
          { label: 'γ half-value thickness', value: mu > 0 ? (Math.LN2 / mu) * 10 : '—', unit: mu > 0 ? 'mm' : undefined },
          { label: 'α range in air', value: ALPHA_RANGE, unit: 'cm' },
        ];
      },
      equations(): Equation[] {
        const mu = mat().muGamma * mat().rho;
        return [
          { expr: 'γ: I = I₀ e^(−μx)', sub: `= I₀ e^(−${n(mu)} × ${n(thkCm())}) = ${n(trans('gamma'))} I₀` },
          { expr: 'x½ = ln 2 / μ', sub: mu > 0 ? `= ${n((Math.LN2 / mu) * 10)} mm` : 'no absorber' },
          { expr: 'In B: r = mv / qB', note: 'α (heavy) bends little; β (light) bends a lot, the other way; γ is undeflected.' },
        ];
      },
    };
  },
};

export default sim;
