import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { capillaryRise } from '../../physics/matter';
import { rad } from '../../lib/num';
import { C } from '../../engine/colors';
import { n } from '../shared';

const LIQ: Record<string, { name: string; T: number; theta: number; rho: number; color: string }> = {
  water: { name: 'Water in glass', T: 0.0728, theta: 0, rho: 1000, color: '#60a5fa' },
  mercury: { name: 'Mercury in glass', T: 0.485, theta: 140, rho: 13546, color: '#cbd5e1' },
  alcohol: { name: 'Ethanol in glass', T: 0.0223, theta: 0, rho: 789, color: '#86efac' },
  custom: { name: 'Custom', T: 0.05, theta: 30, rho: 1000, color: '#fbbf24' },
};
const SC = 60; // scene units per metre of rise (1 cm = 0.6 units)

const sim: SimDefinition = {
  camera: { position: [0, 1.6, 10], target: [0, 1, 0], aspect: 1.4 },
  timeless: true,
  hint: 'Three tubes of radius r/2, r and 2r: the rise is inversely proportional to the radius. Mercury is depressed (θ > 90°).',
  params: [
    { kind: 'select', key: 'liq', label: 'Liquid', default: 'water', options: Object.entries(LIQ).map(([value, l]) => ({ value, label: l.name })) },
    { kind: 'slider', key: 'r', label: 'Radius of the middle tube', unit: 'mm', min: 0.1, max: 2, step: 0.01, default: 0.5 },
    { kind: 'slider', key: 'T', label: 'Surface tension', unit: 'N/m', min: 0.01, max: 0.5, step: 0.001, default: 0.05, showIf: (p) => p.liq === 'custom' },
    { kind: 'slider', key: 'theta', label: 'Contact angle θ', unit: '°', min: 0, max: 180, step: 1, default: 30, showIf: (p) => p.liq === 'custom' },
    { kind: 'slider', key: 'rho', label: 'Density', unit: 'kg/m³', min: 500, max: 14000, step: 10, default: 1000, showIf: (p) => p.liq === 'custom' },
  ],
  presets: [
    { label: 'Water, 0.5 mm', values: { liq: 'water', r: 0.5 } },
    { label: 'Water, 0.2 mm', values: { liq: 'water', r: 0.2 } },
    { label: 'Mercury', values: { liq: 'mercury', r: 0.5 } },
    { label: 'θ = 90° (no rise)', values: { liq: 'custom', theta: 90 } },
  ],
  graphs: [
    { id: 'hr', title: 'Capillary rise vs tube radius', x: 'r (mm)', y: 'h (cm)', kind: 'curve', xRange: [0.05, 2], series: [{ label: 'h = 2T cosθ / ρgr', color: C.accent }] },
  ],
  learn: {
    concept: 'In a narrow tube a liquid that wets the glass (θ < 90°) climbs up until the upward pull of surface tension around the rim balances the weight of the raised column. Jurin’s law gives h = 2T cos θ / (ρgr). A non-wetting liquid such as mercury (θ > 90°) is pushed down instead.',
    variables: [['h', 'rise (m), negative for depression'], ['T', 'surface tension (N/m)'], ['θ', 'angle of contact'], ['ρ', 'density (kg/m³)'], ['r', 'tube radius (m)']],
    observe: [
      'The narrowest tube has the highest column: h ∝ 1/r.',
      'The meniscus is concave for water and convex for mercury.',
      'At θ = 90° the surface is flat and there is no rise.',
    ],
    challenge: 'How narrow must a glass tube be for water to rise 10 cm? Use h = 2T/(ρgr) with θ = 0.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    const trough = kit.box(8, 0.8, 3, '#1e3a8a', { opacity: 0.6 });
    trough.position.set(0, -0.4, 0);
    const tubes = kit.add(new THREE.Group());

    const props = () => {
      const l = LIQ[str(p, 'liq')] ?? LIQ.water;
      if (str(p, 'liq') === 'custom') return { ...l, T: num(p, 'T'), theta: num(p, 'theta'), rho: num(p, 'rho') };
      return l;
    };
    const h = (rmm: number) => { const l = props(); return capillaryRise(l.T, rad(l.theta), l.rho, 9.81, rmm / 1000); };

    function draw() {
      kit.clearGroup(tubes);
      const l = props();
      (trough.material as THREE.MeshStandardMaterial).color.set(l.color);
      const radii = [num(p, 'r') / 2, num(p, 'r'), num(p, 'r') * 2];
      radii.forEach((rmm, i) => {
        const x = (i - 1) * 2.4;
        const vis = 0.12 + rmm * 0.15; // visual tube radius
        const hh = Math.max(-0.35, Math.min(5.5, h(rmm) * SC));
        const glass = kit.cylinder(vis, vis, 6.2, '#e2e8f0', { opacity: 0.18 });
        glass.position.set(x, 2.3, 0);
        tubes.add(glass);
        const colH = Math.max(0.01, hh + 0.4);
        const col = kit.cylinder(vis * 0.92, vis * 0.92, colH, l.color, { opacity: 0.85 });
        col.position.set(x, -0.4 + colH / 2, 0);
        tubes.add(col);
        // meniscus: a shallow cap, concave for θ < 90°, convex otherwise
        const cap = kit.sphere(vis * 0.92, l.color, { opacity: 0.85 }, 24);
        const bulge = Math.cos(rad(l.theta));
        cap.scale.set(1, Math.max(0.05, Math.abs(bulge) * 0.6), 1);
        cap.position.set(x, hh + (bulge < 0 ? 0 : 0), 0);
        cap.visible = Math.abs(bulge) > 0.05 && bulge < 0;
        tubes.add(cap);
        tubes.add(kit.label(`r = ${n(rmm)} mm`, [x, -1.1, 1.6], { small: true }));
        tubes.add(kit.label(`h = ${n(h(rmm) * 100)} cm`, [x, Math.max(hh, 0) + 0.6, 0], { color: C.accent, small: true }));
      });
      const G = graphs.get('hr');
      G.plot(0, 0.05, 2, (rmm) => h(rmm) * 100, 200);
      G.setMarkers(radii.map((rmm) => ({ x: rmm, y: h(rmm) * 100, color: C.weight })));
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        const l = props();
        const r = num(p, 'r');
        return [
          { label: 'Rise in middle tube h', value: h(r) * 100, unit: 'cm', tone: 'accent' },
          { label: 'Rise in narrow tube (r/2)', value: h(r / 2) * 100, unit: 'cm' },
          { label: 'Rise in wide tube (2r)', value: h(r * 2) * 100, unit: 'cm' },
          { label: 'Surface tension', value: l.T, unit: 'N/m' },
          { label: 'Contact angle', value: l.theta, unit: '°' },
          { label: 'Meniscus', value: l.theta < 90 ? 'Concave (wets glass)' : l.theta > 90 ? 'Convex (does not wet)' : 'Flat' },
          { label: 'h × r (constant)', value: h(r) * (r / 1000) * 1e6, unit: 'mm²' },
        ];
      },
      equations(): Equation[] {
        const l = props();
        const r = num(p, 'r') / 1000;
        return [
          { expr: 'h = 2 T cos θ / (ρ g r)', sub: `= 2 × ${n(l.T)} × cos ${l.theta}° / (${n(l.rho)} × 9.81 × ${n(r)}) = ${n(h(num(p, 'r')))} m` },
          { expr: 'Upward pull 2πr T cos θ = weight πr²hρg' },
        ];
      },
    };
  },
};

export default sim;
