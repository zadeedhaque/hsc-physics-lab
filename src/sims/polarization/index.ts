import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num } from '../types';
import { malus } from '../../physics/optics';
import { rad } from '../../lib/num';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const sim: SimDefinition = {
  camera: { position: [-4, 3.5, 9], target: [1, 0, 0], aspect: 1.7 },
  hint: 'Unpolarised light vibrates in all directions; after the polariser only one direction remains. The analyser passes the component along its axis: I = I₀cos²θ.',
  params: [
    { kind: 'slider', key: 'I0', label: 'Intensity of the source', unit: 'W/m²', min: 10, max: 1000, step: 10, default: 200 },
    { kind: 'slider', key: 'theta', label: 'Angle between polariser and analyser θ', unit: '°', min: 0, max: 180, step: 1, default: 30 },
    { kind: 'toggle', key: 'middle', label: 'Insert a middle polaroid at θ/2', default: false },
    { kind: 'toggle', key: 'spin', label: 'Rotate the analyser continuously', default: false },
  ],
  presets: [
    { label: 'Parallel (θ = 0)', values: { theta: 0, middle: false } },
    { label: 'θ = 60°', values: { theta: 60, middle: false } },
    { label: 'Crossed (θ = 90°)', values: { theta: 90, middle: false } },
    { label: 'Three-polaroid surprise', values: { theta: 90, middle: true } },
    { label: 'Spinning analyser', values: { spin: true, middle: false } },
  ],
  graphs: [
    { id: 'I', title: 'Transmitted intensity vs analyser angle', x: 'θ (°)', y: 'I (W/m²)', kind: 'curve', xRange: [0, 180], zeroY: true, series: [{ label: 'I = (I₀/2) cos²θ', color: C.light }, { label: 'with middle polaroid', color: C.acceleration, dashed: true }] },
    { id: 'It', title: 'Detector reading vs time', x: 't (s)', y: 'I (W/m²)', window: 10, zeroY: true, series: [{ label: 'detector', color: C.accent }] },
  ],
  learn: {
    concept: 'Light is a transverse wave, so it can be polarised. A polaroid transmits only the component of the electric field along its axis. Unpolarised light loses half its intensity at the first polaroid. A second (analyser) at angle θ transmits I = I₀cos²θ of the polarised light — Malus’ law.',
    variables: [['I₀', 'intensity reaching the analyser'], ['θ', 'angle between the polaroid axes'], ['I', 'transmitted intensity I₀cos²θ']],
    observe: [
      'Crossed polaroids (θ = 90°) block all the light.',
      'Adding a third polaroid at 45° between crossed ones lets light through again!',
      'The intensity varies as cos²θ — twice per half-turn.',
    ],
    challenge: 'At what analyser angle does exactly a quarter of the polarised light get through?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, spinAngle = 0;
    const sample = sampler(1 / 20);
    const lamp = kit.sphere(0.4, '#fde68a', { emissive: 1 });
    lamp.position.set(-6, 0, 0);
    const polaroid = (x: number) => {
      const g = kit.add(new THREE.Group());
      g.position.x = x;
      const disc = kit.cylinder(1.3, 1.3, 0.06, '#1e293b', { opacity: 0.6 });
      disc.rotation.z = Math.PI / 2;
      const axis = kit.box(0.08, 2.4, 0.08, '#e2e8f0');
      g.add(disc, axis);
      return g;
    };
    polaroid(-3);
    const PM = polaroid(0.5), P2 = polaroid(3);
    kit.label('polariser', [-3, 1.7, 0], { small: true });
    kit.label('analyser', [3, 1.7, 0], { small: true });
    const detector = kit.box(0.4, 1, 1, '#475569');
    detector.position.set(6, 0, 0);
    const meter = kit.label('', [6, 1, 0], { color: C.light });
    // E-field vectors along the beam
    const arrows: ReturnType<typeof kit.arrow>[] = [];
    for (let i = 0; i < 26; i++) arrows.push(kit.arrow(C.light, { radius: 0.025 }));

    const analyser = () => rad(bool(p, 'spin') ? spinAngle : num(p, 'theta'));
    const I1 = () => num(p, 'I0') / 2;
    function out(th = analyser()) {
      if (bool(p, 'middle')) return malus(malus(I1(), th / 2), th / 2);
      return malus(I1(), th);
    }
    function curve() {
      const G = graphs.get('I');
      G.plot(0, 0, 180, (a) => malus(I1(), rad(a)), 180);
      G.plot(1, 0, 180, (a) => (bool(p, 'middle') ? malus(malus(I1(), rad(a) / 2), rad(a) / 2) : NaN), 180);
      G.setMarkers([{ x: num(p, 'theta'), y: out(rad(num(p, 'theta'))), color: C.light }]);
    }
    curve();

    return {
      setParams(np) { p = np; curve(); },
      reset() { t = 0; spinAngle = 0; sample.reset(); },
      step(dt) {
        t += dt;
        if (bool(p, 'spin')) spinAngle = (spinAngle + dt * 30) % 180;
        if (sample.due(t)) graphs.get('It').push(t, out());
      },
      render() {
        const th = analyser();
        P2.rotation.x = th;
        PM.visible = bool(p, 'middle');
        PM.rotation.x = th / 2;
        arrows.forEach((a, i) => {
          const x = -5.6 + i * 0.44;
          const osc = Math.sin(t * 8 - i * 0.9);
          let dir: THREE.Vector3, amp: number;
          if (x < -3) { const ang = (i * 2.39 + t * 3) % (2 * Math.PI); dir = new THREE.Vector3(0, Math.cos(ang), Math.sin(ang)); amp = Math.sqrt(num(p, 'I0') / 1000); }
          else if (x < (bool(p, 'middle') ? 0.5 : 3)) { dir = new THREE.Vector3(0, 1, 0); amp = Math.sqrt(I1() / 1000); }
          else if (x < 3) { dir = new THREE.Vector3(0, Math.cos(th / 2), Math.sin(th / 2)); amp = Math.sqrt(malus(I1(), th / 2) / 1000); }
          else { dir = new THREE.Vector3(0, Math.cos(th), Math.sin(th)); amp = Math.sqrt(out() / 1000); }
          a.set([x, 0, 0], dir.multiplyScalar(1.1 * amp * osc));
        });
        meter.setText(`I = ${n(out())} W/m²`);
      },
      time: () => t,
      readouts(): Readout[] {
        return [
          { label: 'Intensity after polariser I₀/2', value: I1(), unit: 'W/m²' },
          { label: 'Analyser angle', value: (analyser() * 180) / Math.PI, unit: '°' },
          { label: 'Transmitted intensity', value: out(), unit: 'W/m²', tone: 'accent' },
          { label: 'Fraction of polarised light passed', value: out() / I1(), tone: 'accent' },
        ];
      },
      equations(): Equation[] {
        const th = analyser();
        return [
          { expr: 'After polariser: I₁ = I₀ / 2' },
          { expr: 'Malus: I = I₁ cos²θ', sub: `= ${n(I1())} × cos²${n((th * 180) / Math.PI)}° = ${n(malus(I1(), th))} W/m²` },
          ...(bool(p, 'middle') ? [{ expr: 'With a middle polaroid: I = I₁ cos²(θ/2) cos²(θ/2)', sub: `= ${n(out())} W/m²` }] : []),
        ];
      },
    };
  },
};

export default sim;
