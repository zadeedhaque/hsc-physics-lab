import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { bool, num, str } from '../types';
import { dipoleFluxThroughLoop } from '../../physics/induction';
import { coilPoints } from '../../engine/kit';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const COIL_R = 0.03; // m
const SC = 30; // scene units per metre

const sim: SimDefinition = {
  camera: { position: [0, 2.5, 9], target: [0, 0.3, 0], aspect: 1.6 },
  hint: 'The EMF depends on how fast the flux through the coil changes — not on how big the flux is. Watch the galvanometer swing both ways.',
  params: [
    { kind: 'select', key: 'motion', label: 'Magnet motion', default: 'oscillate', options: [{ value: 'oscillate', label: 'In and out' }, { value: 'drop', label: 'Drop through' }, { value: 'still', label: 'Held still' }] },
    { kind: 'slider', key: 'N', label: 'Turns on the coil', min: 10, max: 1000, step: 10, default: 200 },
    { kind: 'slider', key: 'm', label: 'Magnet strength (moment)', unit: 'A·m²', min: 0.5, max: 10, step: 0.1, default: 3 },
    { kind: 'slider', key: 'speed', label: 'Speed of the magnet', unit: 'm/s', min: 0.05, max: 2, step: 0.05, default: 0.5 },
    { kind: 'slider', key: 'R', label: 'Circuit resistance', unit: 'Ω', min: 1, max: 100, step: 1, default: 20 },
    { kind: 'toggle', key: 'lenz', label: 'Show induced poles (Lenz’s law)', default: false },
  ],
  presets: [
    { label: 'Slow', values: { motion: 'oscillate', speed: 0.2 } },
    { label: 'Fast', values: { motion: 'oscillate', speed: 1.5 } },
    { label: 'More turns', values: { N: 800 } },
    { label: 'Magnet held still', values: { motion: 'still' } },
    { label: 'Lenz’s law', values: { lenz: true, motion: 'oscillate', speed: 0.4 } },
  ],
  graphs: [
    { id: 'phi', title: 'Flux linkage and induced EMF vs time', x: 't (s)', y: '', window: 6, zeroY: true, series: [{ label: 'NΦ (mWb)', color: C.magnetic }, { label: 'EMF (mV)', color: C.acceleration }] },
  ],
  learn: {
    concept: 'Faraday’s law: an EMF is induced in a coil whenever the magnetic flux linked with it changes, ε = −N dΦ/dt. Lenz’s law gives the direction: the induced current flows so as to oppose the change that produced it — an approaching N pole makes the near end of the coil an N pole too, repelling it.',
    variables: [['ε', 'induced EMF (V)'], ['N', 'number of turns'], ['Φ', 'flux through one turn (Wb)'], ['dΦ/dt', 'rate of change of flux'], ['I', 'induced current ε/R']],
    observe: [
      'No motion → no change of flux → no EMF.',
      'Faster motion or more turns give a bigger EMF.',
      'The EMF reverses when the magnet reverses direction.',
      'With Lenz on, the coil always makes a pole that opposes the motion.',
    ],
    challenge: 'Double the speed and then double the number of turns. By what factor does the peak EMF change each time?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, z = -0.12, vz = 0, emf = 0, prevLink = 0;
    const sample = sampler(1 / 60);
    kit.line('#d97706', coilPoints(10, COIL_R * SC, 1.8, 24), { width: 3 });
    const magnet = kit.add(new THREE.Group());
    const nP = kit.box(0.6, 0.5, 0.5, C.positive); nP.position.x = 0.3;
    const sP = kit.box(0.6, 0.5, 0.5, C.negative); sP.position.x = -0.3;
    magnet.add(nP, sP, kit.label('N', [0.3, 0.45, 0], { small: true }), kit.label('S', [-0.3, 0.45, 0], { small: true }));
    const galv = kit.cylinder(0.6, 0.6, 0.1, '#0f172a');
    galv.rotation.x = Math.PI / 2; galv.position.set(0, -1.9, 0);
    const needle = kit.box(0.04, 0.5, 0.02, C.friction);
    needle.position.set(0, -1.9, 0.08);
    kit.line('#94a3b8', [[-0.9, -1, 0], [-0.9, -1.9, 0], [-0.6, -1.9, 0]], { width: 2 });
    kit.line('#94a3b8', [[0.9, -1, 0], [0.9, -1.9, 0], [0.6, -1.9, 0]], { width: 2 });
    const ends = [kit.label('', [-1.3, 1.3, 0], { small: true }), kit.label('', [1.3, 1.3, 0], { small: true })];
    const iArrow = kit.arrow(C.current, { label: 'I', radius: 0.04 });

    // magnet position along the coil axis (x) in metres, coil centred at 0
    function kinematics(time: number) {
      const mode = str(p, 'motion');
      if (mode === 'still') return { x: -0.08, v: 0 };
      if (mode === 'drop') { const period = 0.5 / num(p, 'speed'); const u = (time % period) / period; return { x: -0.25 + u * 0.5, v: num(p, 'speed') }; }
      const A = 0.12, w = num(p, 'speed') / A;
      return { x: -0.14 + A * Math.cos(w * time + Math.PI), v: -A * w * Math.sin(w * time + Math.PI) };
    }
    const linkage = (x: number) => num(p, 'N') * dipoleFluxThroughLoop(num(p, 'm'), COIL_R, x);

    function reset() { t = 0; const k = kinematics(0); z = k.x; vz = k.v; prevLink = linkage(z); emf = 0; sample.reset(); }
    reset();

    return {
      setParams(np) { p = np; reset(); graphs.clearLive(); },
      reset,
      step(dt) {
        t += dt;
        const k = kinematics(t);
        z = k.x; vz = k.v;
        const L = linkage(z);
        emf = -(L - prevLink) / dt;
        if (str(p, 'motion') === 'drop' && Math.abs(emf) > 1e3) emf = 0; // wrap-around jump
        prevLink = L;
        if (sample.due(t)) graphs.get('phi').push(t, L * 1000, emf * 1000);
      },
      render() {
        magnet.position.set(z * SC - 0.6, 0, 0);
        const I = emf / num(p, 'R');
        needle.rotation.z = Math.max(-1.2, Math.min(1.2, -emf * 20));
        iArrow.visible = Math.abs(I) > 1e-6;
        iArrow.set([0, 1.2, 0.9], [Math.sign(I) * 0.8, 0, 0], `I = ${n(I * 1000)} mA`);
        const show = bool(p, 'lenz') && Math.abs(emf) > 1e-5;
        // flux increasing (N pole approaching the left end) gives ε < 0: the left end becomes N and repels it
        const leftPole = emf < 0 ? 'N' : 'S';
        ends[0].setText(show ? `${leftPole} (induced)` : '');
        ends[1].setText(show ? `${leftPole === 'N' ? 'S' : 'N'} (induced)` : '');
      },
      time: () => t,
      readouts(): Readout[] {
        return [
          { label: 'Flux linkage NΦ', value: linkage(z) * 1000, unit: 'mWb' },
          { label: 'Induced EMF', value: emf * 1000, unit: 'mV', tone: 'accent' },
          { label: 'Induced current', value: (emf / num(p, 'R')) * 1000, unit: 'mA', tone: 'accent' },
          { label: 'Magnet velocity', value: vz, unit: 'm/s' },
          { label: 'Magnet position', value: z * 100, unit: 'cm' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'ε = − N dΦ/dt', sub: `ε = ${n(emf * 1000)} mV` },
          { expr: 'I = ε / R', sub: `= ${n((emf / num(p, 'R')) * 1000)} mA` },
          { expr: 'Lenz: the induced current opposes the change in flux', note: 'The minus sign in Faraday’s law expresses Lenz’s law.' },
        ];
      },
    };
  },
};

export default sim;
