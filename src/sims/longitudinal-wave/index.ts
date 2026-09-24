import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const MEDIA: Record<string, { name: string; v: number }> = {
  air: { name: 'Air (20 °C) — 343 m/s', v: 343 },
  water: { name: 'Water — 1480 m/s', v: 1480 },
  steel: { name: 'Steel — 5960 m/s', v: 5960 },
  slinky: { name: 'Slinky spring — 2 m/s', v: 2 },
};
const COLS = 60, ROWS = 5;
const SPAN = 16; // scene length

const sim: SimDefinition = {
  camera: { position: [0, 2.5, 12], target: [0, 0, 0], aspect: 1.8 },
  hint: 'Particles only jiggle back and forth along the direction of travel. Crowded regions are compressions, sparse ones rarefactions.',
  params: [
    { kind: 'select', key: 'medium', label: 'Medium', default: 'slinky', options: Object.entries(MEDIA).map(([value, m]) => ({ value, label: m.name })) },
    { kind: 'slider', key: 'f', label: 'Frequency f', unit: 'Hz', min: 0.2, max: 2000, step: 0.1, default: 0.5 },
    { kind: 'slider', key: 'A', label: 'Amplitude (fraction of spacing)', min: 0.05, max: 0.45, step: 0.01, default: 0.35 },
    { kind: 'slider', key: 'slow', label: 'Display slow-down', unit: '×', min: 1, max: 5000, step: 1, default: 1, hint: 'Sound is too fast to see — slow the display, not the physics.' },
  ],
  presets: [
    { label: 'Slinky', values: { medium: 'slinky', f: 0.5, slow: 1 } },
    { label: 'Sound in air (340 Hz)', values: { medium: 'air', f: 340, slow: 800 } },
    { label: 'Sound in water', values: { medium: 'water', f: 340, slow: 800 } },
    { label: 'Ultrasound in steel', values: { medium: 'steel', f: 2000, slow: 4000 } },
  ],
  graphs: [
    { id: 'P', title: 'Displacement and pressure along the medium (now)', x: 'x (fraction of window)', y: '', kind: 'curve', xRange: [0, 1], yRange: [-1.1, 1.1], series: [{ label: 'displacement', color: C.accent }, { label: 'pressure variation', color: C.acceleration }] },
  ],
  learn: {
    concept: 'In a longitudinal wave the particles vibrate parallel to the direction the wave travels, forming compressions (high pressure) and rarefactions (low pressure). Sound is a longitudinal wave. Its speed depends on the medium, and v = fλ.',
    variables: [['v', 'wave speed (m/s)'], ['f', 'frequency (Hz)'], ['λ', 'wavelength v/f (m)'], ['A', 'displacement amplitude']],
    observe: [
      'Pressure is highest where neighbouring particles are pushed together.',
      'The pressure wave is 90° out of step with the displacement wave.',
      'At the same frequency, sound has a longer wavelength in water and steel.',
    ],
    challenge: 'Middle C is 262 Hz. What is its wavelength in air and in water? Set it and read λ.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const sample = sampler(1 / 20);
    const tube = kit.cylinder(1.3, 1.3, SPAN + 0.6, '#e2e8f0', { opacity: 0.08 });
    tube.rotation.z = Math.PI / 2;
    const speaker = kit.box(0.4, 2.4, 2.4, '#334155');
    speaker.position.set(-SPAN / 2 - 0.5, 0, 0);
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), kit.mat('#cbd5e1'), COLS * ROWS);
    kit.add(mesh);
    const marker = kit.sphere(0.12, C.friction, { emissive: 0.4 });
    const lamLine = kit.line(C.weight, [], { width: 1.5 });
    const lamLabel = kit.label('', [0, 0, 0], { color: C.weight, small: true });
    const tmp = new THREE.Object3D();
    const col = new THREE.Color();

    const v = () => (MEDIA[str(p, 'medium')] ?? MEDIA.air).v;
    const lambda = () => v() / num(p, 'f');
    /** Window shown = 2.5 wavelengths, so the pattern is always readable. */
    const windowM = () => 2.5 * lambda();
    const spacing = SPAN / COLS;
    const disp = (x0: number, time: number) => num(p, 'A') * spacing * Math.sin((2 * Math.PI * x0) / (SPAN / 2.5) - 2 * Math.PI * num(p, 'f') * time);

    return {
      setParams(np) { p = np; },
      reset() { t = 0; sample.reset(); },
      step(dt) { t += dt / num(p, 'slow'); },
      render() {
        const k = (2 * Math.PI) / (SPAN / 2.5);
        let i = 0;
        for (let c = 0; c < COLS; c++) {
          const x0 = -SPAN / 2 + (c + 0.5) * spacing;
          const dx = disp(x0 + SPAN / 2, t);
          const compression = -Math.cos(k * (x0 + SPAN / 2) - 2 * Math.PI * num(p, 'f') * t); // −∂ξ/∂x sign
          col.set('#64748b').lerp(new THREE.Color(compression > 0 ? C.acceleration : '#60a5fa'), Math.abs(compression) * 0.8);
          for (let r = 0; r < ROWS; r++) {
            const a = (r / ROWS) * Math.PI * 2;
            tmp.position.set(x0 + dx, 0.8 * Math.cos(a) * (r ? 1 : 0), 0.8 * Math.sin(a) * (r ? 1 : 0));
            tmp.updateMatrix();
            mesh.setMatrixAt(i, tmp.matrix);
            mesh.setColorAt(i, col);
            i++;
          }
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        const xm = -SPAN / 2 + 20.5 * spacing;
        marker.position.set(xm + disp(xm + SPAN / 2, t), 1.1, 0);
        speaker.position.x = -SPAN / 2 - 0.5 + 0.15 * Math.sin(-2 * Math.PI * num(p, 'f') * t);
        lamLine.setPoints([[-SPAN / 2, -1.6, 0], [-SPAN / 2 + SPAN / 2.5, -1.6, 0]]);
        lamLabel.at([-SPAN / 2 + SPAN / 5, -1.95, 0]).setText(`λ = ${n(lambda())} m`);
        const G = graphs.get('P');
        G.plot(0, 0, 1, (u) => Math.sin(2 * Math.PI * 2.5 * u - 2 * Math.PI * num(p, 'f') * t), 150);
        G.plot(1, 0, 1, (u) => -Math.cos(2 * Math.PI * 2.5 * u - 2 * Math.PI * num(p, 'f') * t), 150);
      },
      time: () => t,
      readouts(): Readout[] {
        return [
          { label: 'Wave speed v', value: v(), unit: 'm/s' },
          { label: 'Frequency f', value: num(p, 'f'), unit: 'Hz' },
          { label: 'Wavelength λ = v/f', value: lambda(), unit: 'm', tone: 'accent' },
          { label: 'Period T', value: 1 / num(p, 'f'), unit: 's' },
          { label: 'Window shown', value: windowM(), unit: 'm' },
          { label: 'Audible to humans?', value: num(p, 'f') < 20 ? 'No (infrasound, < 20 Hz)' : num(p, 'f') > 20000 ? 'No (ultrasound)' : 'Yes (20 Hz – 20 kHz)' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'v = f λ', sub: `λ = ${n(v())} / ${n(num(p, 'f'))} = ${n(lambda())} m` },
          { expr: 'ξ = A sin(kx − ωt) ,  ΔP ∝ −∂ξ/∂x', note: 'Pressure is 90° out of phase with displacement.' },
          { expr: 'v_air ≈ 331 √(T/273) m/s' },
        ];
      },
    };
  },
};

export default sim;
