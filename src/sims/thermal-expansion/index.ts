import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { C } from '../../engine/colors';
import { n } from '../shared';

const MATS: Record<string, { name: string; alpha: number; color: string }> = {
  steel: { name: 'Steel (α = 12 × 10⁻⁶)', alpha: 12e-6, color: '#94a3b8' },
  copper: { name: 'Copper (α = 17 × 10⁻⁶)', alpha: 17e-6, color: '#d97706' },
  aluminium: { name: 'Aluminium (α = 23 × 10⁻⁶)', alpha: 23e-6, color: '#cbd5e1' },
  glass: { name: 'Glass (α = 9 × 10⁻⁶)', alpha: 9e-6, color: '#93c5fd' },
  invar: { name: 'Invar (α = 1.2 × 10⁻⁶)', alpha: 1.2e-6, color: '#a3a3a3' },
};
const EXAG = 200; // visual magnification of the change

const sim: SimDefinition = {
  camera: { position: [3, 3.5, 9], target: [0, 0.8, 0], aspect: 1.5 },
  timeless: true,
  hint: 'The change is drawn 200× larger than real so you can see it; the numbers are the real values.',
  params: [
    { kind: 'select', key: 'shape', label: 'Expansion of', default: 'linear', options: [{ value: 'linear', label: 'Length' }, { value: 'area', label: 'Area' }, { value: 'volume', label: 'Volume' }] },
    { kind: 'select', key: 'mat', label: 'Material', default: 'aluminium', options: Object.entries(MATS).map(([value, m]) => ({ value, label: m.name })) },
    { kind: 'slider', key: 'L0', label: 'Original side / length', unit: 'm', min: 0.1, max: 5, step: 0.05, default: 1 },
    { kind: 'slider', key: 'T0', label: 'Initial temperature', unit: '°C', min: -20, max: 100, step: 1, default: 20 },
    { kind: 'slider', key: 'T', label: 'Final temperature', unit: '°C', min: -50, max: 500, step: 1, default: 220 },
  ],
  presets: [
    { label: 'Railway rail in summer', values: { shape: 'linear', mat: 'steel', L0: 5, T0: 20, T: 60 } },
    { label: 'Aluminium plate', values: { shape: 'area', mat: 'aluminium', L0: 1, T: 220 } },
    { label: 'Copper cube', values: { shape: 'volume', mat: 'copper', L0: 1, T: 320 } },
    { label: 'Invar (almost none)', values: { mat: 'invar', T: 220 } },
  ],
  graphs: [
    { id: 'L', title: 'Relative change vs temperature', x: 'T (°C)', y: 'ΔX / X₀ (×10⁻³)', kind: 'curve', xRange: [-50, 500], series: [{ label: 'linear α', color: C.accent }, { label: 'area β = 2α', color: C.acceleration }, { label: 'volume γ = 3α', color: C.weight }] },
  ],
  learn: {
    concept: 'Most solids expand when heated because their atoms vibrate with larger amplitude. For a length L₀, the increase is ΔL = αL₀Δθ where α is the coefficient of linear expansion. Areas grow with β ≈ 2α and volumes with γ ≈ 3α.',
    variables: [['α', 'linear expansion coefficient (K⁻¹)'], ['β', 'superficial (area) coefficient ≈ 2α'], ['γ', 'cubical (volume) coefficient ≈ 3α'], ['Δθ', 'temperature change (K or °C)']],
    observe: [
      'The change is proportional to the original size and to the temperature change.',
      'Cooling below the starting temperature shrinks the object.',
      'Invar, an iron–nickel alloy, barely expands — used in precision clocks.',
    ],
    challenge: 'A 25 m steel rail is laid at 15 °C. How big a gap is needed so that it just closes at 55 °C?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    const block = kit.box(1, 1, 1, '#cbd5e1', { metalness: 0.4, roughness: 0.4 });
    const ghost = kit.box(1, 1, 1, '#e2e8f0', { opacity: 0.15, wireframe: true });
    const dimLine = kit.line(C.resultant, [], { width: 2.5 });
    const dimLabel = kit.label('', [0, 0, 0], { color: C.resultant, small: true });
    const flame = kit.cone(C.hot, 0.4, 0.8);
    kit.box(10, 0.2, 4, '#1e293b').position.y = -0.1;

    const mat = () => MATS[str(p, 'mat')] ?? MATS.steel;
    const dT = () => num(p, 'T') - num(p, 'T0');
    const coeff = () => (str(p, 'shape') === 'linear' ? 1 : str(p, 'shape') === 'area' ? 2 : 3) * mat().alpha;

    function draw() {
      const shape = str(p, 'shape');
      const a = mat().alpha;
      const f = 1 + a * dT() * EXAG; // magnified linear factor
      const base = 2.5;
      const dims = shape === 'linear' ? [base * 2, 0.25, 0.25] : shape === 'area' ? [base, 0.08, base] : [base * 0.8, base * 0.8, base * 0.8];
      ghost.scale.set(dims[0], dims[1], dims[2]);
      ghost.position.y = dims[1] / 2 + 0.05;
      const sx = dims[0] * f, sy = shape === 'volume' ? dims[1] * f : dims[1], sz = shape === 'linear' ? dims[2] : dims[2] * f;
      block.scale.set(sx, sy, sz);
      block.position.y = sy / 2 + 0.05;
      const m = block.material as { color: { set: (c: string) => void }; emissive: { set: (c: string) => void }; emissiveIntensity: number };
      m.color.set(mat().color);
      m.emissive.set('#f97316');
      m.emissiveIntensity = Math.max(0, Math.min(0.8, (num(p, 'T') - 100) / 500));
      dimLine.setPoints([[-dims[0] / 2, sy + 0.4, sz / 2], [-dims[0] / 2 + sx, sy + 0.4, sz / 2]]);
      block.position.x = (sx - dims[0]) / 2;
      dimLabel.at([0, sy + 0.8, sz / 2]).setText(`ΔL (×${EXAG}) = ${n(a * num(p, 'L0') * dT() * 1000)} mm real`);
      flame.position.set(0, -0.5, 0);
      flame.visible = dT() > 0;
      flame.scale.setScalar(Math.min(1.5, 0.3 + dT() / 300));
      const G = graphs.get('L');
      const T0 = num(p, 'T0');
      G.plot(0, -50, 500, (T) => a * (T - T0) * 1000, 2);
      G.plot(1, -50, 500, (T) => 2 * a * (T - T0) * 1000, 2);
      G.plot(2, -50, 500, (T) => 3 * a * (T - T0) * 1000, 2);
      G.setMarkers([{ x: num(p, 'T'), y: coeff() * dT() * 1000, color: C.resultant }]);
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        const L0 = num(p, 'L0'), a = mat().alpha;
        const shape = str(p, 'shape');
        const X0 = shape === 'linear' ? L0 : shape === 'area' ? L0 * L0 : L0 ** 3;
        const unit = shape === 'linear' ? 'm' : shape === 'area' ? 'm²' : 'm³';
        return [
          { label: 'Temperature change Δθ', value: dT(), unit: 'K' },
          { label: 'Coefficient used', value: coeff(), unit: 'K⁻¹' },
          { label: 'Original size', value: X0, unit },
          { label: 'Change in size', value: coeff() * X0 * dT(), unit, tone: 'accent' },
          { label: 'Final size', value: X0 * (1 + coeff() * dT()), unit, digits: 7 },
          { label: 'Change in length of one side', value: a * L0 * dT() * 1000, unit: 'mm' },
        ];
      },
      equations(): Equation[] {
        const L0 = num(p, 'L0'), a = mat().alpha;
        return [
          { expr: 'ΔL = α L₀ Δθ', sub: `= ${n(a)} × ${n(L0)} × ${n(dT())} = ${n(a * L0 * dT())} m` },
          { expr: 'ΔA = β A₀ Δθ ,  β ≈ 2α' },
          { expr: 'ΔV = γ V₀ Δθ ,  γ ≈ 3α' },
        ];
      },
    };
  },
};

export default sim;
