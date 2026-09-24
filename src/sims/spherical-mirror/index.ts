import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { C } from '../../engine/colors';
import { n } from '../shared';

const SC = 0.12; // scene units per cm
const XMIN = -13, XMAX = 6;

/** Mirror formula in the real-is-positive convention: 1/u + 1/v = 1/f (f > 0 concave, f < 0 convex). */
function mirror(u: number, f: number) {
  if (Math.abs(u - f) < 1e-9) return { v: Infinity, atInf: true };
  return { v: (u * f) / (u - f), atInf: false };
}

const sim: SimDefinition = {
  camera: { position: [-3.5, 0.8, 16], target: [-3.5, 0, 0], aspect: 1.9 },
  timeless: true,
  hint: 'Real-is-positive convention: 1/u + 1/v = 1/f = 2/R. A real image forms in front of the mirror; a virtual one behind it.',
  params: [
    { kind: 'select', key: 'type', label: 'Mirror', default: 'concave', options: [{ value: 'concave', label: 'Concave' }, { value: 'convex', label: 'Convex' }] },
    { kind: 'slider', key: 'f', label: 'Focal length |f|', unit: 'cm', min: 5, max: 30, step: 0.5, default: 15 },
    { kind: 'slider', key: 'u', label: 'Object distance u', unit: 'cm', min: 2, max: 100, step: 0.5, default: 45 },
    { kind: 'slider', key: 'h', label: 'Object height', unit: 'cm', min: 2, max: 12, step: 0.5, default: 6 },
  ],
  presets: [
    { label: 'Beyond C', values: { type: 'concave', u: 45 } },
    { label: 'At C', values: { type: 'concave', u: 30 } },
    { label: 'Between F and C', values: { type: 'concave', u: 22 } },
    { label: 'Inside F (shaving mirror)', values: { type: 'concave', u: 8 } },
    { label: 'Convex (car mirror)', values: { type: 'convex', u: 40 } },
  ],
  graphs: [
    { id: 'm', title: 'Magnification vs object distance', x: 'u (cm)', y: 'm (− = inverted)', kind: 'curve', xRange: [0, 100], yRange: [-6, 6], series: [{ label: 'm', color: C.accent }] },
  ],
  learn: {
    concept: 'A spherical mirror focuses parallel rays at its focus F, halfway between the pole and the centre of curvature C (f = R/2). A concave mirror forms real inverted images for objects beyond F and virtual erect magnified images inside F. A convex mirror always gives a virtual, erect, diminished image — useful for a wide field of view.',
    variables: [['u', 'object distance (cm)'], ['v', 'image distance (cm); negative = virtual'], ['f', 'focal length R/2'], ['R', 'radius of curvature'], ['m', 'magnification v/u']],
    observe: [
      'At C (u = 2f) the image is real, inverted and the same size, also at C.',
      'Between F and C the image is real and magnified beyond C.',
      'A convex mirror’s image is always small and upright — it shows a wide area.',
    ],
    challenge: 'Where must an object be placed in front of a 20 cm focal-length concave mirror to get a real image 3 times bigger?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    kit.line('#64748b', [[XMIN, 0, 0], [XMAX, 0, 0]], { width: 1.5 });
    const g = kit.add(new THREE.Group());
    const f = () => (str(p, 'type') === 'convex' ? -1 : 1) * num(p, 'f');

    function draw() {
      kit.clearGroup(g);
      const F = f() * SC, R = 2 * F;
      // mirror surface: circle arc of radius |R| centred at x = −R (object side is −x)
      const arc: THREE.Vector3[] = [];
      const H = 2.6;
      for (let i = 0; i <= 40; i++) {
        const y = -H + (2 * H * i) / 40;
        const x = -R + Math.sign(R) * Math.sqrt(Math.max(0, R * R - y * y)) ;
        arc.push(new THREE.Vector3(Math.abs(R) > 0 ? x : 0, y, 0));
      }
      g.add(kit.line('#cbd5e1', arc, { width: 5 }));
      for (const [x, t] of [[-Math.abs(F), str(p, 'type') === 'convex' ? 'F (virtual)' : 'F'], [-Math.abs(R), str(p, 'type') === 'convex' ? 'C (virtual)' : 'C']] as [number, string][]) {
        const px = str(p, 'type') === 'convex' ? -x : x;
        if (px < XMIN || px > XMAX) continue;
        const dot = kit.sphere(0.07, '#e2e8f0'); dot.position.set(px, 0, 0);
        g.add(dot, kit.label(t, [px, -0.45, 0], { small: true }));
      }
      const u = num(p, 'u'), h = num(p, 'h');
      const r = mirror(u, f());
      const O = new THREE.Vector3(-u * SC, h * SC, 0);
      const obj = kit.arrow(C.weight, { radius: 0.05 }); obj.set([-u * SC, 0, 0], [0, h * SC, 0]); g.add(obj);
      const clip = (a: THREE.Vector3, d: THREE.Vector3) => {
        const tx = d.x !== 0 ? ((d.x > 0 ? XMAX : XMIN) - a.x) / d.x : 1e9;
        const ty = d.y !== 0 ? ((d.y > 0 ? 6 : -6) - a.y) / d.y : 1e9;
        return a.clone().addScaledVector(d, Math.max(0, Math.min(tx, ty)));
      };
      const I = r.atInf ? null : new THREE.Vector3(-r.v * SC, (-h * r.v) / u * SC, 0);
      const ray = (hitY: number, col: string) => {
        const P = new THREE.Vector3(0, hitY, 0);
        g.add(kit.line(col, [O, P], { width: 2 }));
        let d: THREE.Vector3;
        if (!I) d = new THREE.Vector3(-1, O.y / (-O.x || 1e-9) * -1, 0).normalize();
        else if (r.v > 0) d = I.clone().sub(P).normalize();
        else d = P.clone().sub(I).normalize();
        if (d.x > 0) d.negate();
        g.add(kit.line(col, [P, clip(P, d)], { width: 2 }));
        if (I && r.v < 0) g.add(kit.line(col, [P, I], { width: 1.3, dashed: true, opacity: 0.7 }));
      };
      ray(O.y, C.weight); // parallel → through F
      ray(0, C.normal); // at the pole → reflected symmetrically
      if (I) {
        const im = kit.arrow(C.acceleration, { radius: 0.05 });
        im.set([I.x, 0, 0], [0, I.y, 0], r.v > 0 ? 'Real image' : 'Virtual image');
        g.add(im);
        im.visible = Math.abs(I.x) < 20 && Math.abs(I.y) < 8;
      }
      const G = graphs.get('m');
      const xs: number[] = [], ys: number[] = [];
      for (let uu = 0.5; uu <= 100; uu += 0.25) {
        if (Math.abs(uu - f()) < 0.3) { xs.push(uu); ys.push(NaN); continue; }
        const v = mirror(uu, f()).v;
        xs.push(uu); ys.push(Math.max(-8, Math.min(8, -v / uu)));
      }
      G.setSeries(0, xs, ys);
      G.setMarkers(r.atInf ? [] : [{ x: u, y: Math.max(-6, Math.min(6, -r.v / u)), color: C.acceleration }]);
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        const u = num(p, 'u');
        const r = mirror(u, f());
        if (r.atInf) return [{ label: 'Image', value: 'At infinity (reflected rays parallel)', tone: 'warn' }];
        const m = r.v / u;
        return [
          { label: 'Image distance v', value: r.v, unit: 'cm', tone: 'accent' },
          { label: 'Magnification |m| = |v/u|', value: Math.abs(m), tone: 'accent' },
          { label: 'Image height', value: Math.abs(m) * num(p, 'h'), unit: 'cm' },
          { label: 'Nature', value: r.v > 0 ? 'Real, inverted' : 'Virtual, erect' },
          { label: 'Size', value: Math.abs(Math.abs(m) - 1) < 0.01 ? 'Same size' : Math.abs(m) > 1 ? 'Magnified' : 'Diminished' },
          { label: 'Radius of curvature R = 2f', value: 2 * Math.abs(f()), unit: 'cm' },
        ];
      },
      equations(): Equation[] {
        const u = num(p, 'u'), r = mirror(u, f());
        return [
          { expr: '1/u + 1/v = 1/f = 2/R', sub: r.atInf ? 'u = f → v = ∞' : `1/${n(u)} + 1/v = 1/${n(f())}  ⇒  v = ${n(r.v)} cm` },
          { expr: 'm = v / u', sub: r.atInf ? '' : `= ${n(r.v / u)}` },
          { expr: 'f = R / 2' },
        ];
      },
    };
  },
};

export default sim;
