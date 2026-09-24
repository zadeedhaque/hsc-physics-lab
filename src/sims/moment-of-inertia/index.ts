import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { rad } from '../../lib/num';
import { SERIES } from '../../engine/colors';
import { n, sampler } from '../shared';

const LEN = 9;
/** k = I / (m r²) for each body. */
const BODIES = [
  { name: 'Sliding block (no rolling)', k: 0, color: '#94a3b8' },
  { name: 'Solid sphere (2/5)', k: 0.4, color: SERIES[0] },
  { name: 'Solid disc (1/2)', k: 0.5, color: SERIES[2] },
  { name: 'Ring (1)', k: 1, color: SERIES[1] },
];

const sim: SimDefinition = {
  camera: { position: [1, 5, 13], target: [1, 1.8, 0], aspect: 1.6 },
  hint: 'All four have the same mass and radius — only how the mass is distributed differs.',
  params: [
    { kind: 'slider', key: 'angle', label: 'Ramp angle', unit: '°', min: 3, max: 45, step: 0.5, default: 20 },
    { kind: 'slider', key: 'm', label: 'Mass of each body', unit: 'kg', min: 0.1, max: 10, step: 0.1, default: 2 },
    { kind: 'slider', key: 'r', label: 'Radius of each body', unit: 'm', min: 0.1, max: 0.5, step: 0.01, default: 0.3 },
    { kind: 'slider', key: 'g', label: 'Gravity', unit: 'm/s²', min: 1, max: 25, step: 0.01, default: 9.81 },
  ],
  presets: [
    { label: 'Gentle slope', values: { angle: 10 } },
    { label: 'Steep slope', values: { angle: 35 } },
    { label: 'Heavy bodies', values: { m: 9 } },
    { label: 'Tiny bodies', values: { r: 0.1 } },
  ],
  graphs: [
    { id: 's', title: 'Distance down the ramp vs time', x: 't (s)', y: 's (m)', zeroY: true, series: BODIES.map((b) => ({ label: b.name.split(' (')[0], color: b.color })) },
  ],
  learn: {
    concept: 'Moment of inertia I = Σmr² measures how hard it is to change a body’s rotation. A body rolling down a slope shares its energy between translation and rotation; the larger I/(mr²), the more energy goes into spinning and the smaller the linear acceleration a = g sin θ / (1 + I/mr²).',
    variables: [['I', 'moment of inertia (kg·m²)'], ['k = I/mr²', 'shape factor'], ['a', 'linear acceleration down the slope'], ['K', 'radius of gyration: I = mK²']],
    observe: [
      'Order of arrival never changes: block, sphere, disc, ring.',
      'Changing mass or radius does not change the order or the times.',
      'The ring puts half its kinetic energy into rotation.',
    ],
    challenge: 'Predict the ratio of the times taken by the ring and the solid sphere to reach the bottom: t_ring / t_sphere = √[(1 + 1)/(1 + 0.4)]. Check it.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    let s = BODIES.map(() => 0);
    let done = false;
    const sample = sampler(1 / 20);
    kit.box(16, 0.2, 7, '#1e293b').position.set(1, -0.1, 0);
    const rampMesh = new THREE.Mesh(new THREE.BufferGeometry(), kit.mat('#475569', { roughness: 0.9 }));
    kit.add(rampMesh);
    const x0 = -3.5;
    const meshes = BODIES.map((b, i) => {
      let m: THREE.Mesh;
      if (b.k === 0) m = kit.box(0.6, 0.6, 0.6, b.color);
      else if (b.k === 0.4) m = kit.sphere(1, b.color);
      else if (b.k === 0.5) m = kit.cylinder(1, 1, 0.35, b.color);
      else m = kit.torus(0.85, 0.15, b.color);
      if (b.k === 0.5) m.rotation.x = Math.PI / 2;
      void i;
      return m;
    });
    const stripes = BODIES.map((b) => { const st = kit.box(0.05, 1, 0.05, '#0f172a'); void b; return st; });
    const lanes = [-2.25, -0.75, 0.75, 2.25];
    BODIES.forEach((b, i) => kit.label(b.name, [x0 - 1.8, 0, lanes[i]], { color: b.color, small: true }));

    const acc = (k: number) => (num(p, 'g') * Math.sin(rad(num(p, 'angle')))) / (1 + k);
    function buildRamp() {
      const th = rad(num(p, 'angle'));
      const bx = x0 + LEN * Math.cos(th), top = LEN * Math.sin(th), d = 3.2;
      const v = [x0, 0, d, bx, 0, d, x0, top, d, x0, 0, -d, bx, 0, -d, x0, top, -d];
      const idx = [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0];
      rampMesh.geometry.dispose();
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      rampMesh.geometry = g;
    }
    const reset = () => { t = 0; s = BODIES.map(() => 0); done = false; sample.reset(); buildRamp(); };
    reset();

    return {
      setParams(np) { p = np; graphs.clearLive(); reset(); },
      reset,
      step(dt) {
        if (done) return;
        t += dt;
        const maxS = LEN - 0.8;
        s = BODIES.map((b) => Math.min(maxS, 0.5 * acc(b.k) * t * t));
        if (s.every((x) => x >= maxS)) done = true;
        if (sample.due(t)) graphs.get('s').push(t, ...s);
      },
      render() {
        const th = rad(num(p, 'angle'));
        const r = num(p, 'r') * 1.2;
        const top = new THREE.Vector3(x0, LEN * Math.sin(th), 0);
        const down = new THREE.Vector3(Math.cos(th), -Math.sin(th), 0);
        const normal = new THREE.Vector3(Math.sin(th), Math.cos(th), 0);
        BODIES.forEach((b, i) => {
          const m = meshes[i];
          const size = b.k === 0 ? 0.6 : r;
          const c = top.clone().addScaledVector(down, 0.5 + s[i]).addScaledVector(normal, size * (b.k === 0 ? 0.5 : 1));
          c.z = lanes[i];
          m.position.copy(c);
          const spin = b.k === 0 ? 0 : -s[i] / r;
          if (b.k === 0) { m.rotation.set(0, 0, -th); stripes[i].visible = false; }
          else {
            m.scale.setScalar(b.k === 1 ? r : r);
            if (b.k === 0.5) { m.scale.set(r, 1, r); m.rotation.set(Math.PI / 2, 0, 0); m.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), spin); }
            else m.rotation.set(0, 0, spin);
            stripes[i].visible = true;
            stripes[i].scale.set(1, 2 * r * 0.98, 1);
            stripes[i].position.copy(c).add(new THREE.Vector3(0, 0, b.k === 0.5 ? 0.2 : r + 0.01));
            stripes[i].rotation.set(0, 0, spin);
          }
        });
      },
      done: () => done,
      time: () => t,
      readouts(): Readout[] {
        const m = num(p, 'm'), r = num(p, 'r');
        const H = LEN * Math.sin(rad(num(p, 'angle')));
        return BODIES.flatMap((b) => {
          const a = acc(b.k);
          const tBottom = Math.sqrt((2 * (LEN - 0.8)) / a);
          const out: Readout[] = [{ label: `${b.name.split(' (')[0]}: a`, value: a, unit: 'm/s²' }, { label: `${b.name.split(' (')[0]}: time to bottom`, value: tBottom, unit: 's', tone: 'accent' }];
          if (b.k === 1) out.push({ label: 'Ring: I = mr²', value: m * r * r, unit: 'kg·m²' }, { label: 'Ring: share of KE in rotation', value: 50, unit: '%' }, { label: 'Ramp height', value: H, unit: 'm' });
          return out;
        });
      },
      equations(): Equation[] {
        const m = num(p, 'm'), r = num(p, 'r');
        return [
          { expr: 'a = g sin θ / (1 + I/mr²)', sub: `sphere: ${n(acc(0.4))}, disc: ${n(acc(0.5))}, ring: ${n(acc(1))} m/s²` },
          { expr: 'I_sphere = ⅖mr² ,  I_disc = ½mr² ,  I_ring = mr²', sub: `ring: I = ${n(m * r * r)} kg·m²` },
          { expr: 'mgh = ½mv² + ½Iω² ,  v = ωr' },
          { expr: 'Radius of gyration: I = mK²', sub: `disc: K = r/√2 = ${n(r / Math.SQRT2)} m` },
        ];
      },
    };
  },
};

export default sim;
