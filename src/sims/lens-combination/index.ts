import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { thinLens, combinedFocal } from '../../physics/optics';
import { C } from '../../engine/colors';
import { n } from '../shared';
import { lensMesh } from '../opticsKit';

const SC = 0.1;
const XMIN = -12, XMAX = 12;

const sim: SimDefinition = {
  camera: { position: [0, 0.5, 18], target: [0, 0, 0], aspect: 1.9 },
  timeless: true,
  hint: 'The image formed by the first lens acts as the object for the second. For lenses in contact, powers simply add: P = P₁ + P₂.',
  params: [
    { kind: 'slider', key: 'f1', label: 'Focal length f₁ (+ convex, − concave)', unit: 'cm', min: -40, max: 40, step: 1, default: 20 },
    { kind: 'slider', key: 'f2', label: 'Focal length f₂', unit: 'cm', min: -40, max: 40, step: 1, default: 30 },
    { kind: 'slider', key: 'd', label: 'Separation d', unit: 'cm', min: 0, max: 60, step: 1, default: 20 },
    { kind: 'slider', key: 'u', label: 'Object distance from lens 1', unit: 'cm', min: 5, max: 100, step: 1, default: 50 },
  ],
  presets: [
    { label: 'In contact (+20, +30)', values: { f1: 20, f2: 30, d: 0 } },
    { label: 'Achromat-like (+20, −40)', values: { f1: 20, f2: -40, d: 0 } },
    { label: 'Separated', values: { f1: 20, f2: 30, d: 30 } },
    { label: 'Telescope spacing', values: { f1: 40, f2: 10, d: 50, u: 100 } },
  ],
  graphs: [
    { id: 'P', title: 'Combined power vs separation', x: 'd (cm)', y: 'P (D)', kind: 'curve', xRange: [0, 60], series: [{ label: 'P = P₁ + P₂ − dP₁P₂', color: C.accent }] },
  ],
  learn: {
    concept: 'For two thin lenses in contact the combination behaves like one lens with 1/F = 1/f₁ + 1/f₂, i.e. P = P₁ + P₂ (dioptres). When they are separated by d, P = P₁ + P₂ − dP₁P₂, and the image of the first lens becomes the object of the second.',
    variables: [['P', 'power 1/f (dioptre, f in metres)'], ['F', 'equivalent focal length'], ['d', 'separation'], ['m', 'total magnification m₁m₂']],
    observe: [
      'A convex and a concave lens of equal |f| in contact have zero power.',
      'Moving the lenses apart changes the combined power.',
      'The final magnification is the product of the two magnifications.',
    ],
    challenge: 'A +20 cm lens is in contact with a lens of unknown focal length and the combination has power +2 D. Find the unknown focal length.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    kit.line('#64748b', [[XMIN, 0, 0], [XMAX, 0, 0]], { width: 1.5 });
    const g = kit.add(new THREE.Group());
    const P = (f: number) => 100 / f;

    function solve() {
      const f1 = num(p, 'f1') || 1e-6, f2 = num(p, 'f2') || 1e-6;
      const u1 = num(p, 'u');
      const r1 = thinLens(u1, f1);
      const u2 = num(p, 'd') - r1.v; // object distance for lens 2 (negative = virtual object)
      const r2 = r1.atInfinity ? { v: f2, m: 0, real: true, atInfinity: false } : thinLens(u2, f2);
      const m = r1.atInfinity || r2.atInfinity ? NaN : (r1.v / u1) * (r2.v / u2);
      const Ptot = P(f1) + P(f2) - (num(p, 'd') / 100) * P(f1) * P(f2);
      return { r1, u2, r2, m, Ptot };
    }

    function draw() {
      kit.clearGroup(g);
      const s = solve();
      const x1 = -num(p, 'd') * SC / 2, x2 = num(p, 'd') * SC / 2;
      const l1 = lensMesh(kit, 4, num(p, 'f1') > 0); l1.position.x = x1; g.add(l1);
      const l2 = lensMesh(kit, 4, num(p, 'f2') > 0, '#c4b5fd'); l2.position.x = x2; g.add(l2);
      g.add(kit.label(`f₁ = ${num(p, 'f1')} cm`, [x1, 2.5, 0], { small: true }), kit.label(`f₂ = ${num(p, 'f2')} cm`, [x2, 2.9, 0], { small: true }));
      const objX = x1 - num(p, 'u') * SC;
      const obj = kit.arrow(C.weight, { radius: 0.05 }); obj.set([objX, 0, 0], [0, 1, 0], 'Object'); g.add(obj);
      if (!s.r1.atInfinity) {
        const i1x = x1 + s.r1.v * SC;
        if (Math.abs(i1x) < 14) {
          const im1 = kit.arrow('#94a3b8', { radius: 0.03, opacity: 0.6 }); im1.set([i1x, 0, 0], [0, -s.r1.v / num(p, 'u'), 0], 'Image 1'); g.add(im1);
        }
      }
      if (!s.r2.atInfinity && Number.isFinite(s.m)) {
        const ix = x2 + s.r2.v * SC;
        if (Math.abs(ix) < 16) {
          const im = kit.arrow(C.acceleration, { radius: 0.05 }); im.set([ix, 0, 0], [0, -s.m, 0], s.r2.v > 0 ? 'Final image (real)' : 'Final image (virtual)'); g.add(im);
        }
      }
      const G = graphs.get('P');
      G.plot(0, 0, 60, (d) => P(num(p, 'f1') || 1e-6) + P(num(p, 'f2') || 1e-6) - (d / 100) * P(num(p, 'f1') || 1e-6) * P(num(p, 'f2') || 1e-6), 2);
      G.setMarkers([{ x: num(p, 'd'), y: s.Ptot, color: C.accent }]);
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        const s = solve();
        return [
          { label: 'Combined power P', value: s.Ptot, unit: 'D', tone: 'accent' },
          { label: 'Equivalent focal length', value: Math.abs(s.Ptot) > 1e-9 ? 100 / s.Ptot : 'infinite (zero power)', unit: Math.abs(s.Ptot) > 1e-9 ? 'cm' : undefined, tone: 'accent' },
          { label: 'Image 1 distance v₁', value: s.r1.atInfinity ? '∞' : s.r1.v, unit: s.r1.atInfinity ? undefined : 'cm' },
          { label: 'Final image from lens 2', value: s.r2.atInfinity ? '∞' : s.r2.v, unit: s.r2.atInfinity ? undefined : 'cm' },
          { label: 'Total magnification', value: Number.isFinite(s.m) ? s.m : '—' },
          { label: 'In-contact formula F', value: num(p, 'd') === 0 ? combinedFocal(num(p, 'f1') || 1e-6, num(p, 'f2') || 1e-6) : 'lenses separated', unit: num(p, 'd') === 0 ? 'cm' : undefined },
        ];
      },
      equations(): Equation[] {
        const s = solve();
        return [
          { expr: 'In contact: 1/F = 1/f₁ + 1/f₂ ,  P = P₁ + P₂' },
          { expr: 'Separated: P = P₁ + P₂ − d P₁ P₂', sub: `= ${n(P(num(p, 'f1') || 1e-6))} + ${n(P(num(p, 'f2') || 1e-6))} − ${n(num(p, 'd') / 100)} × … = ${n(s.Ptot)} D` },
          { expr: 'm = m₁ × m₂' },
        ];
      },
    };
  },
};

export default sim;
