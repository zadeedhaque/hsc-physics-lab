import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num } from '../types';
import { rad } from '../../lib/num';
import { C } from '../../engine/colors';
import { n } from '../shared';

const sim: SimDefinition = {
  camera: { position: [0, 7, 9], target: [0, 0, 0.5], aspect: 1.5 },
  timeless: true,
  hint: 'The reflected rays seem to come from a point behind the mirror, as far behind as the object is in front — the virtual image.',
  params: [
    { kind: 'slider', key: 'i', label: 'Angle of incidence', unit: '°', min: 0, max: 85, step: 1, default: 40 },
    { kind: 'slider', key: 'd', label: 'Object distance from mirror', unit: 'cm', min: 5, max: 60, step: 1, default: 25 },
    { kind: 'toggle', key: 'image', label: 'Show image construction', default: true },
  ],
  presets: [
    { label: 'Normal incidence', values: { i: 0 } },
    { label: '45°', values: { i: 45 } },
    { label: 'Grazing', values: { i: 80 } },
  ],
  learn: {
    concept: 'Laws of reflection: the incident ray, the reflected ray and the normal all lie in one plane, and the angle of reflection equals the angle of incidence. A plane mirror forms a virtual, erect, same-size image as far behind the mirror as the object is in front, and laterally inverted.',
    variables: [['i', 'angle of incidence (from the normal)'], ['r', 'angle of reflection'], ['u', 'object distance'], ['v', 'image distance (= u, behind the mirror)']],
    observe: [
      'r always equals i.',
      'All reflected rays from the object, extended backwards, meet at one point: the image.',
      'Moving the object closer moves the image closer by the same amount.',
    ],
    challenge: 'A person stands 1.5 m from a plane mirror. How far are they from their image? If they walk 0.5 m toward the mirror, how far is it then?',
  },

  create({ kit, params }) {
    let p: Params = params;
    const mirror = kit.box(0.1, 1.5, 10, '#cbd5e1', { metalness: 0.9, roughness: 0.1 });
    mirror.position.set(0, 0.75, 0);
    kit.box(0.05, 1.5, 10, '#1e293b').position.set(0.08, 0.75, 0);
    kit.grid(14, 14, 'xz', 0);
    const g = kit.add(new THREE.Group());

    function draw() {
      kit.clearGroup(g);
      const S = 0.12;
      const d = num(p, 'd') * S;
      const obj = new THREE.Vector3(-d, 0.3, 0);
      const img = new THREE.Vector3(d, 0.3, 0);
      const o = kit.cone(C.weight, 0.18, 0.5); o.position.copy(obj).add(new THREE.Vector3(0, 0.25, 0)); g.add(o);
      g.add(kit.label('Object', obj.clone().add(new THREE.Vector3(0, 0.9, 0)), { small: true }));
      const add = (pts: THREE.Vector3[], col: string, dashed = false) => g.add(kit.line(col, pts, { width: dashed ? 1.3 : 2.2, dashed, opacity: dashed ? 0.7 : 1 }));
      // Main ray at the chosen angle, hitting the mirror at z = d·tan i
      const ia = rad(num(p, 'i'));
      const zHit = d * Math.tan(ia);
      const hit = new THREE.Vector3(0, 0.3, Math.min(4.8, zHit));
      add([obj, hit], C.light);
      const out = hit.clone().add(new THREE.Vector3(-Math.cos(ia), 0, Math.sin(ia)).multiplyScalar(4));
      add([hit, out], C.light);
      add([hit.clone().add(new THREE.Vector3(-1.4, 0, 0)), hit.clone().add(new THREE.Vector3(1.4, 0, 0))], '#94a3b8', true);
      g.add(kit.label(`i = ${num(p, 'i')}°`, hit.clone().add(new THREE.Vector3(-1.1, 0.3, -0.5)), { small: true }));
      g.add(kit.label(`r = ${num(p, 'i')}°`, hit.clone().add(new THREE.Vector3(-1.1, 0.3, 0.6)), { small: true }));
      if (bool(p, 'image')) {
        for (const ang of [-35, -15, 20]) {
          const a = rad(ang);
          const z = d * Math.tan(a);
          const h = new THREE.Vector3(0, 0.3, z);
          add([obj, h], '#fde68a');
          add([h, h.clone().add(new THREE.Vector3(-Math.cos(a), 0, Math.sin(a)).multiplyScalar(3))], '#fde68a');
          add([h, img], '#fde68a', true);
        }
        add([hit, img], C.light, true);
        const im = kit.cone(C.acceleration, 0.18, 0.5, ); im.position.copy(img).add(new THREE.Vector3(0, 0.25, 0));
        (im.material as THREE.MeshStandardMaterial).transparent = true;
        (im.material as THREE.MeshStandardMaterial).opacity = 0.6;
        g.add(im, kit.label('Virtual image', img.clone().add(new THREE.Vector3(0, 0.9, 0)), { color: C.acceleration, small: true }));
      }
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        return [
          { label: 'Angle of incidence i', value: num(p, 'i'), unit: '°' },
          { label: 'Angle of reflection r', value: num(p, 'i'), unit: '°', tone: 'accent' },
          { label: 'Deviation of the ray', value: 180 - 2 * num(p, 'i'), unit: '°' },
          { label: 'Image distance (behind mirror)', value: num(p, 'd'), unit: 'cm', tone: 'accent' },
          { label: 'Object–image distance', value: 2 * num(p, 'd'), unit: 'cm' },
          { label: 'Image', value: 'Virtual, erect, same size, laterally inverted' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: '∠i = ∠r', sub: `${num(p, 'i')}° = ${num(p, 'i')}°` },
          { expr: 'Plane mirror: v = u', sub: `v = ${n(num(p, 'd'))} cm` },
          { expr: 'Deviation δ = 180° − 2i' },
        ];
      },
    };
  },
};

export default sim;
