import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { C } from '../../engine/colors';
import { n } from '../shared';

const FLUIDS: Record<string, { name: string; eta: number; color: string }> = {
  water: { name: 'Water (20 °C)', eta: 1.0e-3, color: '#60a5fa' },
  oil: { name: 'Olive oil', eta: 0.081, color: '#facc15' },
  glycerine: { name: 'Glycerine', eta: 1.41, color: '#e9d5ff' },
  honey: { name: 'Honey', eta: 10, color: '#f59e0b' },
};
const LAYERS = 8;
const W = 8; // scene length of the plates

const sim: SimDefinition = {
  camera: { position: [0, 3, 10], target: [0, 1.2, 0], aspect: 1.6 },
  hint: 'The top plate drags the fluid; each layer slides over the one below. The speed falls linearly to zero at the fixed plate.',
  params: [
    { kind: 'select', key: 'fluid', label: 'Fluid', default: 'glycerine', options: Object.entries(FLUIDS).map(([value, f]) => ({ value, label: f.name })) },
    { kind: 'slider', key: 'v', label: 'Speed of the top plate', unit: 'm/s', min: 0.01, max: 1, step: 0.01, default: 0.2 },
    { kind: 'slider', key: 'd', label: 'Gap between plates', unit: 'mm', min: 0.5, max: 10, step: 0.1, default: 2 },
    { kind: 'slider', key: 'A', label: 'Plate area', unit: 'm²', min: 0.01, max: 1, step: 0.01, default: 0.1 },
  ],
  presets: [
    { label: 'Water', values: { fluid: 'water' } },
    { label: 'Oil', values: { fluid: 'oil' } },
    { label: 'Honey', values: { fluid: 'honey' } },
    { label: 'Thin film', values: { d: 0.5 } },
  ],
  graphs: [
    { id: 'F', title: 'Viscous force vs plate speed', x: 'v (m/s)', y: 'F (N)', kind: 'curve', xRange: [0, 1], zeroY: true, series: [{ label: 'F = ηA v/d', color: C.force }] },
  ],
  learn: {
    concept: 'Viscosity is internal friction in a fluid. When layers slide past each other, a tangential force F = ηA (dv/dx) is needed to keep them moving, where dv/dx is the velocity gradient. The coefficient of viscosity η is large for thick fluids like honey and small for water.',
    variables: [['η', 'coefficient of viscosity (Pa·s = N·s/m²)'], ['A', 'area of the layers (m²)'], ['dv/dx', 'velocity gradient v/d (s⁻¹)'], ['F', 'viscous force (N)']],
    observe: [
      'The arrows show a straight-line velocity profile from 0 to v.',
      'Halving the gap doubles the velocity gradient and the force.',
      'Honey needs ten thousand times more force than water.',
    ],
    challenge: 'What force keeps a 0.1 m² plate moving at 0.2 m/s on a 2 mm layer of glycerine? Predict it, then check.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const bottom = kit.box(W + 1, 0.2, 2, '#475569');
    bottom.position.y = -0.1;
    const top = kit.box(W * 0.6, 0.2, 2, '#94a3b8', { metalness: 0.5 });
    const layers = kit.add(new THREE.Group());
    const arrows = kit.add(new THREE.Group());
    const pull = kit.arrow(C.force, { label: 'F', radius: 0.05 });
    const tracers: THREE.Mesh[] = [];
    for (let i = 0; i < LAYERS * 6; i++) tracers.push(kit.sphere(0.06, '#0f172a', undefined, 8));
    const H = 2.4;
    const fluid = () => FLUIDS[str(p, 'fluid')] ?? FLUIDS.water;
    const force = () => (fluid().eta * num(p, 'A') * num(p, 'v')) / (num(p, 'd') / 1000);

    function build() {
      kit.clearGroup(layers);
      kit.clearGroup(arrows);
      for (let i = 0; i < LAYERS; i++) {
        const l = kit.box(W, H / LAYERS - 0.02, 1.8, fluid().color, { opacity: 0.25 + (0.35 * i) / LAYERS });
        l.position.set(0, (i + 0.5) * (H / LAYERS), 0);
        layers.add(l);
        const a = kit.arrow(C.velocity, { radius: 0.03 });
        a.set([-3.5, (i + 0.5) * (H / LAYERS), 1], [((i + 0.5) / LAYERS) * 2.5, 0, 0]);
        arrows.add(a);
      }
      graphs.get('F').plot(0, 0, 1, (v) => (fluid().eta * num(p, 'A') * v) / (num(p, 'd') / 1000), 2);
      graphs.get('F').setMarkers([{ x: num(p, 'v'), y: force(), color: C.force }]);
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; },
      step(dt) { t += dt; },
      render() {
        const topX = ((t * num(p, 'v') * 4) % 4) - 2;
        top.position.set(topX, H + 0.1, 0);
        pull.set([topX + W * 0.3, H + 0.1, 0], [0.4 + Math.min(2.5, Math.log10(1 + force()) * 0.8), 0, 0], `F = ${n(force())} N`);
        tracers.forEach((tr, k) => {
          const i = k % LAYERS, j = Math.floor(k / LAYERS);
          const speed = ((i + 0.5) / LAYERS) * num(p, 'v') * 4;
          const x = ((((j / 6) * W + t * speed) % W) + W) % W - W / 2;
          tr.position.set(x, (i + 0.5) * (H / LAYERS), 0.92);
        });
      },
      time: () => t,
      readouts(): Readout[] {
        return [
          { label: 'Coefficient of viscosity η', value: fluid().eta, unit: 'Pa·s' },
          { label: 'Velocity gradient v/d', value: num(p, 'v') / (num(p, 'd') / 1000), unit: 's⁻¹' },
          { label: 'Viscous force F', value: force(), unit: 'N', tone: 'accent' },
          { label: 'Shear stress F/A', value: force() / num(p, 'A'), unit: 'Pa' },
          { label: 'Power to keep moving', value: force() * num(p, 'v'), unit: 'W' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'F = η A (dv/dx)', sub: `= ${n(fluid().eta)} × ${n(num(p, 'A'))} × ${n(num(p, 'v'))} / ${n(num(p, 'd') / 1000)} = ${n(force())} N` },
          { expr: 'η = F / (A · dv/dx)   unit: N·s/m² = Pa·s' },
        ];
      },
    };
  },
};

export default sim;
