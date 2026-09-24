import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num } from '../types';
import { snell, criticalAngle } from '../../physics/optics';
import { rad, deg } from '../../lib/num';
import { C } from '../../engine/colors';
import { n } from '../shared';

const MEDIA = [['Air', 1.0], ['Water', 1.33], ['Glass', 1.5], ['Diamond', 2.42]] as const;
const name = (v: number) => MEDIA.find(([, m]) => Math.abs(m - v) < 0.005)?.[0] ?? `n = ${v}`;
const L = 4.5;

const sim: SimDefinition = {
  camera: { position: [0, 0, 12], target: [0, 0, 0], aspect: 1.5 },
  timeless: true,
  hint: 'Going into a denser medium the ray bends toward the normal. Going out of a denser medium beyond the critical angle, all light is reflected.',
  params: [
    { kind: 'slider', key: 'n1', label: 'Refractive index n₁ (upper medium)', min: 1, max: 2.5, step: 0.01, default: 1 },
    { kind: 'slider', key: 'n2', label: 'Refractive index n₂ (lower medium)', min: 1, max: 2.5, step: 0.01, default: 1.5 },
    { kind: 'slider', key: 'i', label: 'Angle of incidence i', unit: '°', min: 0, max: 89, step: 0.5, default: 40 },
    { kind: 'toggle', key: 'reflect', label: 'Show partially reflected ray', default: true },
  ],
  presets: [
    { label: 'Air → glass', values: { n1: 1, n2: 1.5, i: 40 } },
    { label: 'Air → water', values: { n1: 1, n2: 1.33, i: 40 } },
    { label: 'Glass → air (below critical)', values: { n1: 1.5, n2: 1, i: 35 } },
    { label: 'Total internal reflection', values: { n1: 1.5, n2: 1, i: 50 } },
    { label: 'Diamond → air', values: { n1: 2.42, n2: 1, i: 30 } },
  ],
  graphs: [
    { id: 'r', title: 'Angle of refraction vs angle of incidence', x: 'i (°)', y: 'r (°)', kind: 'curve', xRange: [0, 90], yRange: [0, 90], series: [{ label: 'r(i)', color: C.accent }, { label: 'r = i', color: '#94a3b8', dashed: true }] },
  ],
  learn: {
    concept: 'Light changes speed when it enters a different medium, and so it bends (refraction). Snell’s law: n₁ sin i = n₂ sin r, where n = c/v. From a denser to a rarer medium the ray bends away from the normal; at the critical angle c (sin c = n₂/n₁) the refracted ray grazes the surface, and beyond it the light is totally internally reflected.',
    variables: [['n', 'refractive index c/v'], ['i', 'angle of incidence'], ['r', 'angle of refraction'], ['c', 'critical angle sin⁻¹(n₂/n₁)'], ['v', 'speed of light in the medium']],
    observe: [
      'A ray along the normal (i = 0) passes straight through.',
      'Light slows down in the denser medium: v = c/n.',
      'Beyond the critical angle, the refracted ray disappears — total internal reflection (used in optical fibres).',
    ],
    challenge: 'Find the critical angle for light leaving water (n = 1.33) into air. Then check it by increasing i until the ray vanishes.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    const top = kit.box(12, 4.5, 3, '#93c5fd', { opacity: 0.08 });
    top.position.y = 2.25;
    const bottom = kit.box(12, 4.5, 3, '#93c5fd', { opacity: 0.25 });
    bottom.position.y = -2.25;
    kit.line('#e2e8f0', [[-6, 0, 0], [6, 0, 0]], { width: 2 });
    kit.line('#94a3b8', [[0, -4.2, 0], [0, 4.2, 0]], { dashed: true, width: 1.2 });
    kit.label('normal', [0.5, 4, 0], { small: true });
    const inc = kit.line(C.light, [], { width: 3 });
    const refr = kit.line(C.light, [], { width: 3 });
    const refl = kit.line(C.light, [], { width: 2, opacity: 0.5 });
    const labels = { top: kit.label('', [-5, 4, 0], { small: true }), bot: kit.label('', [-5, -4, 0], { small: true }), i: kit.label('', [0, 0, 0], { small: true }), r: kit.label('', [0, 0, 0], { small: true }), tir: kit.label('', [0, -1.5, 0], { color: C.friction }) };

    function draw() {
      const n1 = num(p, 'n1'), n2 = num(p, 'n2'), ia = rad(num(p, 'i'));
      labels.top.setText(`${name(n1)} (n₁ = ${n(n1)})`);
      labels.bot.setText(`${name(n2)} (n₂ = ${n(n2)})`);
      (bottom.material as THREE.MeshStandardMaterial).opacity = 0.05 + (n2 - 1) * 0.25;
      (top.material as THREE.MeshStandardMaterial).opacity = 0.05 + (n1 - 1) * 0.25;
      const start = new THREE.Vector3(-L * Math.sin(ia), L * Math.cos(ia), 0);
      inc.setPoints([start, [0, 0, 0]]);
      labels.i.at([-0.9 * Math.sin(ia / 2) - 0.2, 1.2, 0]).setText(`i = ${num(p, 'i')}°`);
      const r = snell(n1, n2, ia);
      refl.visible = bool(p, 'reflect') || r === null;
      refl.setPoints([[0, 0, 0], [L * Math.sin(ia), L * Math.cos(ia), 0]]);
      (refl.material as unknown as { opacity: number }).opacity = r === null ? 1 : 0.45;
      if (r === null) {
        refr.visible = false;
        labels.r.setText('');
        labels.tir.setText('Total internal reflection');
      } else {
        refr.setPoints([[0, 0, 0], [L * Math.sin(r), -L * Math.cos(r), 0]]);
        labels.r.at([0.9 * Math.sin(r / 2) + 0.3, -1.2, 0]).setText(`r = ${n(deg(r))}°`);
        labels.tir.setText('');
      }
      const G = graphs.get('r');
      G.plot(0, 0, 89.9, (a) => { const rr = snell(n1, n2, rad(a)); return rr === null ? NaN : deg(rr); }, 300);
      G.plot(1, 0, 90, (a) => a, 2);
      G.setMarkers(r === null ? [] : [{ x: num(p, 'i'), y: deg(r), color: C.accent }]);
      const c = criticalAngle(n1, n2);
      G.setVLines(c === null ? [] : [{ x: deg(c), label: 'critical' }]);
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        const n1 = num(p, 'n1'), n2 = num(p, 'n2');
        const r = snell(n1, n2, rad(num(p, 'i')));
        const c = criticalAngle(n1, n2);
        return [
          { label: 'Angle of refraction r', value: r === null ? 'none — TIR' : deg(r), unit: r === null ? undefined : '°', tone: 'accent' },
          { label: 'Deviation |i − r|', value: r === null ? 180 - 2 * num(p, 'i') : Math.abs(num(p, 'i') - deg(r)), unit: '°' },
          { label: 'Critical angle', value: c === null ? 'none (n₁ ≤ n₂)' : deg(c), unit: c === null ? undefined : '°' },
          { label: 'Speed in upper medium', value: 299792458 / n1, unit: 'm/s' },
          { label: 'Speed in lower medium', value: 299792458 / n2, unit: 'm/s' },
          { label: 'Relative index n₂/n₁', value: n2 / n1 },
        ];
      },
      equations(): Equation[] {
        const n1 = num(p, 'n1'), n2 = num(p, 'n2');
        const r = snell(n1, n2, rad(num(p, 'i')));
        const c = criticalAngle(n1, n2);
        return [
          { expr: 'n₁ sin i = n₂ sin r', sub: r === null ? `sin r = ${n((n1 / n2) * Math.sin(rad(num(p, 'i'))))} > 1 → no refracted ray` : `${n(n1)} × sin ${num(p, 'i')}° = ${n(n2)} × sin ${n(deg(r))}°` },
          { expr: 'sin c = n₂ / n₁', sub: c === null ? 'no critical angle going into a denser medium' : `c = ${n(deg(c))}°` },
          { expr: 'n = c / v' },
        ];
      },
    };
  },
};

export default sim;
