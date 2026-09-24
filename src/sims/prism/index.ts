import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num } from '../types';
import { prismTrace, prismMinDeviation, cauchy, wavelengthToRGB } from '../../physics/optics';
import { rad, deg } from '../../lib/num';
import { n } from '../shared';

const SIDE = 4;
const WAVES = [700, 620, 580, 530, 470, 420];

const sim: SimDefinition = {
  camera: { position: [0, 0.5, 11], target: [0.5, 0.3, 0], aspect: 1.6 },
  timeless: true,
  hint: 'Violet light has a slightly larger refractive index than red, so it is deviated more. (Dispersion is exaggerated about 2× so the colours separate visibly.)',
  params: [
    { kind: 'slider', key: 'A', label: 'Prism angle A', unit: '°', min: 30, max: 75, step: 1, default: 60 },
    { kind: 'slider', key: 'i', label: 'Angle of incidence i₁', unit: '°', min: 20, max: 85, step: 0.5, default: 48 },
    { kind: 'slider', key: 'nd', label: 'Refractive index (yellow light)', min: 1.3, max: 1.9, step: 0.01, default: 1.52 },
    { kind: 'toggle', key: 'white', label: 'White light (dispersion)', default: true },
  ],
  presets: [
    { label: 'Minimum deviation', values: { A: 60, nd: 1.52, i: 48.8 } },
    { label: 'Grazing incidence', values: { i: 85 } },
    { label: 'Flint glass', values: { nd: 1.65 } },
    { label: 'Single colour', values: { white: false } },
  ],
  graphs: [
    { id: 'D', title: 'Deviation vs angle of incidence', x: 'i₁ (°)', y: 'δ (°)', kind: 'curve', xRange: [20, 90], series: [{ label: 'yellow', color: '#facc15' }, { label: 'red', color: '#ef4444' }, { label: 'violet', color: '#a78bfa' }] },
  ],
  learn: {
    concept: 'A prism bends light twice. The total deviation δ = i₁ + i₂ − A depends on the angle of incidence and has a minimum value δₘ when the ray passes symmetrically. Then n = sin((A + δₘ)/2) / sin(A/2). Because n depends on wavelength (dispersion), white light splits into a spectrum.',
    variables: [['A', 'angle of the prism'], ['i₁, i₂', 'angles of incidence and emergence'], ['δ', 'angle of deviation'], ['δₘ', 'minimum deviation'], ['n', 'refractive index']],
    observe: [
      'The deviation graph has a minimum — at that point the ray inside is parallel to the base.',
      'Violet is deviated most, red least.',
      'At small angles of incidence the ray may be totally internally reflected at the second face.',
    ],
    challenge: 'For a 60° prism with n = 1.52, find the angle of incidence for minimum deviation and measure δₘ.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    const rays = kit.add(new THREE.Group());
    const prismMesh = new THREE.Mesh(new THREE.BufferGeometry(), kit.mat('#bae6fd', { opacity: 0.25, side: THREE.DoubleSide }));
    kit.add(prismMesh);
    const outline = kit.line('#e2e8f0', [], { width: 2 });
    const screen = kit.box(0.1, 5, 2, '#e2e8f0', { opacity: 0.2 });
    screen.position.set(7, 0, 0);

    function draw() {
      const A = rad(num(p, 'A'));
      // triangle: apex up, base centred at y = −1.2
      const h = (SIDE / 2) / Math.tan(A / 2);
      const apex = new THREE.Vector3(0, -1.2 + h, 0);
      const bl = new THREE.Vector3(-SIDE / 2, -1.2, 0), br = new THREE.Vector3(SIDE / 2, -1.2, 0);
      const shape = new THREE.Shape([new THREE.Vector2(bl.x, bl.y), new THREE.Vector2(br.x, br.y), new THREE.Vector2(apex.x, apex.y)]);
      prismMesh.geometry.dispose();
      prismMesh.geometry = new THREE.ExtrudeGeometry(shape, { depth: 1.5, bevelEnabled: false });
      prismMesh.position.z = -0.75;
      outline.setPoints([bl, br, apex, bl]);
      kit.clearGroup(rays);
      // left face normal (outward), entry point halfway up the left face
      const leftDir = apex.clone().sub(bl).normalize();
      const leftN = new THREE.Vector3(-leftDir.y, leftDir.x, 0); // outward
      const rightDir = apex.clone().sub(br).normalize();
      const rightN = new THREE.Vector3(rightDir.y, -rightDir.x, 0);
      const entry = bl.clone().lerp(apex, 0.45);
      const i1 = rad(num(p, 'i'));
      const inDir = leftN.clone().negate().applyAxisAngle(new THREE.Vector3(0, 0, 1), i1); // incident ray: inward normal rotated toward the apex side
      rays.add(kit.line('#f8fafc', [entry.clone().addScaledVector(inDir, -4), entry], { width: 3 }));
      const colours = bool(p, 'white') ? WAVES : [589];
      for (const wl of colours) {
        const nn = bool(p, 'white') ? num(p, 'nd') + (cauchy(wl) - cauchy(589)) * 2.2 : num(p, 'nd');
        const tr = prismTrace(A, nn, i1);
        const [r, g, b] = wavelengthToRGB(wl);
        const col = bool(p, 'white') ? new THREE.Color(r, g, b).getStyle() : '#facc15';
        if (!tr) continue;
        const inside = leftN.clone().negate().applyAxisAngle(new THREE.Vector3(0, 0, 1), tr.r1);
        // intersect with the right face
        const denom = inside.x * rightDir.y - inside.y * rightDir.x;
        const tHit = ((br.x - entry.x) * rightDir.y - (br.y - entry.y) * rightDir.x) / (denom || 1e-9);
        const exit = entry.clone().addScaledVector(inside, tHit);
        rays.add(kit.line(col, [entry, exit], { width: 2, opacity: 0.9 }));
        const outDir = rightN.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), -tr.e);
        rays.add(kit.line(col, [exit, exit.clone().addScaledVector(outDir, Math.max(1, (7 - exit.x) / Math.max(outDir.x, 0.1)))], { width: 2.5 }));
      }
      const G = graphs.get('D');
      const curve = (nn: number) => (a: number) => { const t = prismTrace(A, nn, rad(a)); return t ? deg(t.deviation) : NaN; };
      G.plot(0, 20, 89.9, curve(num(p, 'nd')), 200);
      G.plot(1, 20, 89.9, curve(num(p, 'nd') + (cauchy(700) - cauchy(589)) * 2.2), 200);
      G.plot(2, 20, 89.9, curve(num(p, 'nd') + (cauchy(420) - cauchy(589)) * 2.2), 200);
      const tr = prismTrace(A, num(p, 'nd'), i1);
      G.setMarkers(tr ? [{ x: num(p, 'i'), y: deg(tr.deviation), color: '#facc15' }] : []);
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        const A = rad(num(p, 'A'));
        const tr = prismTrace(A, num(p, 'nd'), rad(num(p, 'i')));
        const dm = prismMinDeviation(A, num(p, 'nd'));
        const red = prismTrace(A, num(p, 'nd') + (cauchy(700) - cauchy(589)) * 2.2, rad(num(p, 'i')));
        const vio = prismTrace(A, num(p, 'nd') + (cauchy(420) - cauchy(589)) * 2.2, rad(num(p, 'i')));
        return [
          { label: 'Deviation δ (yellow)', value: tr ? deg(tr.deviation) : 'TIR at second face', unit: tr ? '°' : undefined, tone: 'accent' },
          { label: 'Angle of emergence i₂', value: tr ? deg(tr.e) : '—', unit: tr ? '°' : undefined },
          { label: 'Refraction angles r₁, r₂', value: tr ? `${n(deg(tr.r1))}°, ${n(deg(tr.r2))}°` : '—' },
          { label: 'Minimum deviation δₘ', value: dm === null ? '—' : deg(dm), unit: dm === null ? undefined : '°' },
          { label: 'Angular dispersion (violet − red)', value: red && vio ? deg(vio.deviation - red.deviation) : '—', unit: red && vio ? '°' : undefined },
        ];
      },
      equations(): Equation[] {
        const A = num(p, 'A');
        const dm = prismMinDeviation(rad(A), num(p, 'nd'));
        return [
          { expr: 'r₁ + r₂ = A ,  δ = i₁ + i₂ − A' },
          { expr: 'n = sin((A + δₘ)/2) / sin(A/2)', sub: dm === null ? '' : `δₘ = ${n(deg(dm))}° for n = ${n(num(p, 'nd'))}` },
          { expr: 'Dispersion: n_violet > n_red' },
        ];
      },
    };
  },
};

export default sim;
