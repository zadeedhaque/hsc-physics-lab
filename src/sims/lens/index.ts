import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num, str } from '../types';
import { thinLens } from '../../physics/optics';
import { C } from '../../engine/colors';
import { n } from '../shared';
import { lensMesh } from '../opticsKit';

const SC = 0.12; // scene units per cm
const XMAX = 13; // scene half-width for drawing rays
const LENS_H = 5.2; // lens aperture (scene units)

const sim: SimDefinition = {
  camera: { position: [0, 0.6, 17], target: [0, 0, 0], aspect: 1.9 },
  timeless: true,
  hint: 'Sign convention: real is positive — 1/u + 1/v = 1/f, f > 0 for convex, v < 0 means a virtual image.',
  params: [
    { kind: 'select', key: 'type', label: 'Lens', default: 'convex', options: [{ value: 'convex', label: 'Convex (converging)' }, { value: 'concave', label: 'Concave (diverging)' }] },
    { kind: 'slider', key: 'f', label: 'Focal length |f|', unit: 'cm', min: 5, max: 40, step: 0.5, default: 15 },
    { kind: 'slider', key: 'u', label: 'Object distance u', unit: 'cm', min: 2, max: 100, step: 0.5, default: 40 },
    { kind: 'slider', key: 'h', label: 'Object height', unit: 'cm', min: 2, max: 15, step: 0.5, default: 8 },
    { kind: 'toggle', key: 'rays', label: 'Principal rays', default: true },
    { kind: 'toggle', key: 'bundle', label: 'Bundle of rays from the tip', default: false },
  ],
  presets: [
    { label: 'Beyond 2F', values: { type: 'convex', f: 15, u: 45 } },
    { label: 'At 2F', values: { type: 'convex', f: 15, u: 30 } },
    { label: 'Between F and 2F', values: { type: 'convex', f: 15, u: 22 } },
    { label: 'Inside F (magnifier)', values: { type: 'convex', f: 15, u: 9 } },
    { label: 'Concave lens', values: { type: 'concave', f: 15, u: 30 } },
  ],
  graphs: [
    { id: 'vu', title: 'Image distance v vs object distance u', x: 'u (cm)', y: 'v (cm)', kind: 'curve', xRange: [0, 100], yRange: [-120, 120], series: [{ label: 'v = uf / (u − f)', color: C.accent }] },
  ],
  learn: {
    concept: 'A thin lens bends parallel rays to (convex) or away from (concave) a focal point. Any ray through the optical centre is undeviated. Where the refracted rays actually meet a real image forms; where they only appear to come from, a virtual image forms.',
    variables: [['u', 'object distance (cm)'], ['v', 'image distance (cm), negative if virtual'], ['f', 'focal length (cm), negative for concave'], ['m', 'magnification = v/u'], ['P', 'power = 100/f(cm) dioptre']],
    observe: [
      'At u = 2f the image is real, inverted and the same size (also at v = 2f).',
      'As u approaches f, the image rushes off to infinity.',
      'Inside f a convex lens gives a virtual, erect, magnified image — a magnifying glass.',
      'A concave lens always gives a virtual, erect, diminished image.',
    ],
    challenge: 'With f = 15 cm, find the object distance that gives a real image exactly 3 times the size of the object.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    kit.line('#64748b', [[-XMAX, 0, 0], [XMAX, 0, 0]], { width: 1.5 });
    const lensGroup = kit.add(new THREE.Group());
    const marks = kit.add(new THREE.Group());
    const obj = kit.arrow(C.weight, { radius: 0.06, label: 'Object' });
    const img = kit.arrow(C.acceleration, { radius: 0.06, label: 'Image' });
    const rayGroup = kit.add(new THREE.Group());
    const screen = kit.plane(0.02, 1, '#e2e8f0', { opacity: 0.12 });
    screen.scale.set(1, 1, 1);

    const f = () => (str(p, 'type') === 'concave' ? -1 : 1) * num(p, 'f');

    function build() {
      kit.clearGroup(lensGroup);
      kit.clearGroup(marks);
      kit.clearGroup(rayGroup);
      const convex = str(p, 'type') !== 'concave';
      lensGroup.add(lensMesh(kit, LENS_H, convex));
      const F = Math.abs(f()) * SC;
      for (const [x, t] of [[-F, 'F'], [F, 'F′'], [-2 * F, '2F'], [2 * F, '2F′']] as [number, string][]) {
        if (Math.abs(x) > XMAX) continue;
        const dot = kit.sphere(0.07, '#e2e8f0');
        dot.position.set(x, 0, 0);
        marks.add(dot, kit.label(t, [x, -0.45, 0], { small: true }));
      }

      const u = num(p, 'u'), h = num(p, 'h');
      const r = thinLens(u, f());
      const O = new THREE.Vector3(-u * SC, h * SC, 0);
      obj.set([-u * SC, 0, 0], [0, h * SC, 0], `Object`);

      const addRay = (pts: THREE.Vector3[], color: string, dashed = false) => {
        const l = kit.line(color, pts, { width: dashed ? 1.5 : 2, dashed, opacity: dashed ? 0.7 : 0.95, dashSize: 0.18, gapSize: 0.12 });
        rayGroup.add(l);
      };
      const clipTo = (a: THREE.Vector3, dir: THREE.Vector3) => {
        // extend from a along dir until |x| or |y| hits the drawing bounds
        const tx = dir.x !== 0 ? ((dir.x > 0 ? XMAX : -XMAX) - a.x) / dir.x : Infinity;
        const ty = dir.y !== 0 ? ((dir.y > 0 ? 6 : -6) - a.y) / dir.y : Infinity;
        return a.clone().addScaledVector(dir, Math.max(0, Math.min(tx, ty)));
      };

      const I = r.atInfinity ? null : new THREE.Vector3(r.v * SC, (-h * r.v) / u * SC, 0);
      img.visible = !!I && Math.abs(I.x) < XMAX + 3 && Math.abs(I.y) < 8;
      screen.visible = !!I && r.real && Math.abs(I.x) < XMAX;
      if (I) {
        img.set([I.x, 0, 0], [0, I.y, 0], r.real ? 'Real image' : 'Virtual image');
        if (screen.visible) { screen.position.set(I.x + 0.02, 0, 0); screen.scale.set(1, Math.max(2, Math.abs(I.y) * 2.4), 1); }
      }

      // A ray leaves the object tip, hits the lens at height y, then heads for (or appears to come from) I.
      const traceRay = (hitY: number, color: string, incoming: THREE.Vector3 = O) => {
        const L = new THREE.Vector3(0, hitY, 0);
        if (Math.abs(hitY) > LENS_H / 2 + 1e-6) return;
        addRay([incoming, L], color);
        let dir: THREE.Vector3;
        if (!I) dir = new THREE.Vector3(1, -O.y / Math.max(1e-9, -O.x), 0).normalize(); // parallel to the central ray
        else if (r.real) dir = I.clone().sub(L).normalize();
        else dir = L.clone().sub(I).normalize();
        if (dir.x < 0) dir.negate();
        addRay([L, clipTo(L, dir)], color);
        if (I && !r.real) addRay([L, I], color, true);
      };

      if (bool(p, 'rays')) {
        const fx = f() * SC;
        traceRay(O.y, C.weight); // parallel to axis
        traceRay(0, C.normal); // through centre
        // aimed at the first focal point (convex) / towards the far focal point (concave)
        const Fx = -fx; // x of the focal point on the object side for convex, image side for concave
        const y3 = O.y + (0 - O.x) * ((0 - O.y) / (Fx - O.x || 1e-9));
        if (Number.isFinite(y3)) traceRay(y3, C.acceleration);
      }
      if (bool(p, 'bundle')) {
        for (let i = -3; i <= 3; i++) traceRay((i / 3) * (LENS_H / 2) * 0.95, '#fde68a');
      }

      const G = graphs.get('vu');
      if (f() > 0) {
        const xs: number[] = [], ys: number[] = [];
        for (let uu = 0.5; uu <= 100; uu += 0.25) {
          if (Math.abs(uu - f()) < 0.3) { xs.push(uu); ys.push(NaN); continue; }
          xs.push(uu); ys.push(Math.max(-200, Math.min(200, thinLens(uu, f()).v)));
        }
        G.setSeries(0, xs, ys);
        G.setVLines([{ x: f(), label: 'u = f' }, { x: 2 * f(), label: '2f' }]);
      } else {
        G.plot(0, 0.5, 100, (uu) => thinLens(uu, f()).v, 200);
        G.setVLines([]);
      }
      G.setMarkers(r.atInfinity ? [] : [{ x: u, y: Math.max(-120, Math.min(120, r.v)), label: `v = ${n(r.v)} cm`, color: C.acceleration }]);
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { build(); },
      step() {},
      readouts(): Readout[] {
        const u = num(p, 'u');
        const r = thinLens(u, f());
        if (r.atInfinity) return [
          { label: 'Image distance v', value: '∞', tone: 'warn' },
          { label: 'Nature', value: 'Image at infinity (parallel rays)' },
          { label: 'Power', value: 100 / f(), unit: 'D' },
        ];
        const m = r.v / u;
        return [
          { label: 'Image distance v', value: r.v, unit: 'cm', tone: 'accent' },
          { label: 'Magnification m = v/u', value: m, tone: 'accent' },
          { label: 'Image height', value: Math.abs(m) * num(p, 'h'), unit: 'cm' },
          { label: 'Nature', value: r.real ? 'Real' : 'Virtual' },
          { label: 'Orientation', value: r.real ? 'Inverted' : 'Erect' },
          { label: 'Size', value: Math.abs(Math.abs(m) - 1) < 0.01 ? 'Same size' : Math.abs(m) > 1 ? 'Magnified' : 'Diminished' },
          { label: 'Lens power P', value: 100 / f(), unit: 'D' },
        ];
      },
      equations(): Equation[] {
        const u = num(p, 'u'), ff = f();
        const r = thinLens(u, ff);
        return [
          { expr: '1/u + 1/v = 1/f', sub: r.atInfinity ? 'u = f → v → ∞' : `1/${n(u)} + 1/v = 1/${n(ff)}  ⇒  v = ${n(r.v)} cm` },
          { expr: 'v = u f / (u − f)', sub: r.atInfinity ? '' : `v = ${n(u)} × ${n(ff)} / (${n(u)} − ${n(ff)}) = ${n(r.v)} cm` },
          { expr: 'm = v / u', sub: r.atInfinity ? '' : `m = ${n(r.v)} / ${n(u)} = ${n(r.v / u)}` },
          { expr: 'P = 1 / f (m) = 100 / f (cm)', sub: `P = ${n(100 / ff)} D` },
        ];
      },
    };
  },
};

export default sim;
