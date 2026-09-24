import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { generatorPeak, rms } from '../../physics/induction';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const sim: SimDefinition = {
  camera: { position: [4, 4, 8], target: [0, 0.5, 0], aspect: 1.5 },
  hint: 'The EMF is largest when the coil’s sides cut straight across the field lines (coil plane parallel to B), and zero when they move along them.',
  params: [
    { kind: 'slider', key: 'N', label: 'Turns', min: 1, max: 500, step: 1, default: 100 },
    { kind: 'slider', key: 'B', label: 'Magnetic field', unit: 'T', min: 0.01, max: 1, step: 0.01, default: 0.2 },
    { kind: 'slider', key: 'A', label: 'Coil area', unit: 'cm²', min: 10, max: 400, step: 5, default: 100 },
    { kind: 'slider', key: 'f', label: 'Rotation frequency', unit: 'Hz', min: 0.2, max: 60, step: 0.1, default: 1 },
    { kind: 'slider', key: 'slow', label: 'Display slow-down', unit: '×', min: 1, max: 60, step: 1, default: 1 },
  ],
  presets: [
    { label: 'Slow hand crank', values: { f: 1, slow: 1 } },
    { label: 'Mains (50 Hz)', values: { f: 50, slow: 50 } },
    { label: 'Double speed', values: { f: 2, slow: 1 } },
    { label: 'Strong magnet', values: { B: 0.8 } },
  ],
  graphs: [
    { id: 'emf', title: 'Output EMF vs time', x: 't (s)', y: 'ε (V)', window: 3, zeroY: true, series: [{ label: 'ε = ε₀ sin ωt', color: C.acceleration }, { label: 'flux linkage NΦ (scaled)', color: C.magnetic, dashed: true }] },
  ],
  learn: {
    concept: 'An AC generator (alternator) turns a coil of N turns and area A at angular speed ω in a magnetic field B. The flux through it varies as NBA cos ωt, so the induced EMF is ε = NBAω sin ωt — a sine wave with peak ε₀ = NBAω and frequency equal to the rotation frequency.',
    variables: [['ε₀', 'peak EMF NBAω (V)'], ['ω', '2πf (rad/s)'], ['Φ', 'flux BA cos ωt'], ['V_rms', 'ε₀/√2']],
    observe: [
      'The EMF is zero when the flux is maximum, and maximum when the flux is zero — they are 90° apart.',
      'Doubling the speed doubles both the peak EMF and the frequency.',
      'The EMF reverses every half turn — alternating current.',
    ],
    challenge: 'A 100-turn, 100 cm² coil turns at 50 Hz in a 0.2 T field. Predict the peak and rms EMF.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const sample = sampler(1 / 200);
    const nPole = kit.box(0.8, 2.6, 2.6, C.positive, { opacity: 0.85 });
    nPole.position.set(-2.4, 0.6, 0);
    const sPole = kit.box(0.8, 2.6, 2.6, C.negative, { opacity: 0.85 });
    sPole.position.set(2.4, 0.6, 0);
    kit.label('N', [-2.4, 2.2, 0], { color: C.positive });
    kit.label('S', [2.4, 2.2, 0], { color: C.negative });
    const field = kit.segments(C.magnetic, { width: 1, opacity: 0.45 });
    const f: number[] = [];
    for (let y = -0.4; y <= 1.6; y += 0.5) for (let z = -1; z <= 1; z += 0.5) f.push(-2, y, z, 2, y, z);
    field.setSegments(f);
    const coil = kit.add(new THREE.Group());
    coil.position.y = 0.6;
    const frame = kit.line('#d97706', [], { width: 4 });
    coil.add(frame);
    const axle = kit.cylinder(0.05, 0.05, 4, '#94a3b8');
    axle.rotation.x = Math.PI / 2;
    axle.position.y = 0.6;
    const normal = kit.arrow('#e2e8f0', { label: 'n̂', radius: 0.03 });
    const vA = kit.arrow(C.velocity, { label: 'v', radius: 0.03 });
    const bulb = kit.sphere(0.3, '#fde68a', { emissive: 0.1 });
    bulb.position.set(0, -1.6, 2);
    const emfLabel = kit.label('', [0, 2.6, 0], { color: C.acceleration });

    const side = () => Math.sqrt(num(p, 'A')) * 0.12;
    const omega = () => 2 * Math.PI * num(p, 'f');
    const peak = () => generatorPeak(num(p, 'N'), num(p, 'B'), num(p, 'A') * 1e-4, omega());
    const emfAt = (tt: number) => peak() * Math.sin(omega() * tt);

    function build() {
      const s = side() / 2;
      frame.setPoints([[-s, -s, 0], [s, -s, 0], [s, s, 0], [-s, s, 0], [-s, -s, 0]]);
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; sample.reset(); },
      step(dt) {
        t += dt / num(p, 'slow');
        if (sample.due(t * num(p, 'slow'))) {
          const flux = num(p, 'N') * num(p, 'B') * num(p, 'A') * 1e-4 * Math.cos(omega() * t);
          graphs.get('emf').push(t, emfAt(t), flux * omega());
        }
      },
      render() {
        const th = omega() * t;
        // coil rotates about the z axis; at th = 0 its plane faces the field (max flux)
        coil.rotation.z = th + Math.PI / 2;
        const nrm = new THREE.Vector3(Math.cos(th), Math.sin(th), 0);
        normal.set([0, 0.6, 0], nrm.multiplyScalar(1.2));
        const s = side() / 2;
        const edge = new THREE.Vector3(-Math.sin(th) * s, 0.6 + Math.cos(th) * s, 0);
        vA.set(edge, [-Math.cos(th) * 0.8, -Math.sin(th) * 0.8, 0]);
        const e = emfAt(t);
        const bm = bulb.material as THREE.MeshStandardMaterial;
        bm.emissiveIntensity = Math.min(1.5, 0.05 + Math.abs(e) / (peak() || 1) * 1.2);
        emfLabel.setText(`ε = ${n(e)} V`);
      },
      time: () => t,
      readouts(): Readout[] {
        return [
          { label: 'Peak EMF ε₀ = NBAω', value: peak(), unit: 'V', tone: 'accent' },
          { label: 'rms EMF ε₀/√2', value: rms(peak()), unit: 'V', tone: 'accent' },
          { label: 'Frequency', value: num(p, 'f'), unit: 'Hz' },
          { label: 'Angular speed ω', value: omega(), unit: 'rad/s' },
          { label: 'EMF now', value: emfAt(t), unit: 'V' },
          { label: 'Coil angle', value: ((omega() * t * 180) / Math.PI) % 360, unit: '°' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'Φ = B A cos ωt' },
          { expr: 'ε = −N dΦ/dt = N B A ω sin ωt' },
          { expr: 'ε₀ = N B A ω', sub: `= ${n(num(p, 'N'))} × ${n(num(p, 'B'))} × ${n(num(p, 'A') * 1e-4)} × ${n(omega())} = ${n(peak())} V` },
        ];
      },
    };
  },
};

export default sim;
