import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { comptonShift } from '../../physics/modern';
import { c, h, e as eC, me } from '../../physics/constants';
import { deg, rad } from '../../lib/num';
import { C } from '../../engine/colors';
import { n } from '../shared';

const LC = (h / (me * c)) * 1e12; // Compton wavelength in pm (2.426)
const PERIOD = 4; // s per animated collision

const sim: SimDefinition = {
  camera: { position: [0, 2, 12], target: [0, 0, 0], aspect: 1.6 },
  hint: 'The scattered photon always has a longer wavelength. The shift depends only on the scattering angle, not on the incoming wavelength.',
  params: [
    { kind: 'slider', key: 'lam', label: 'Incident wavelength λ', unit: 'pm', min: 1, max: 100, step: 0.5, default: 10 },
    { kind: 'slider', key: 'theta', label: 'Scattering angle θ', unit: '°', min: 0, max: 180, step: 1, default: 90 },
  ],
  presets: [
    { label: 'Compton’s experiment (Mo Kα 71 pm)', values: { lam: 71, theta: 90 } },
    { label: 'Gamma ray, back-scatter', values: { lam: 2, theta: 180 } },
    { label: 'Grazing (θ = 20°)', values: { theta: 20 } },
    { label: 'θ = 90° (Δλ = h/mₑc)', values: { theta: 90 } },
  ],
  graphs: [
    { id: 'D', title: 'Compton shift vs scattering angle', x: 'θ (°)', y: 'Δλ (pm)', kind: 'curve', xRange: [0, 180], zeroY: true, series: [{ label: 'Δλ = (h/mₑc)(1 − cos θ)', color: C.accent }] },
    { id: 'E', title: 'Energy of scattered photon vs angle', x: 'θ (°)', y: 'E′ (keV)', kind: 'curve', xRange: [0, 180], zeroY: true, series: [{ label: 'E′', color: '#c084fc' }, { label: 'electron KE', color: C.negative }] },
  ],
  learn: {
    concept: 'When an X-ray or gamma photon collides with a free electron it behaves like a particle: energy and momentum are both conserved. The electron recoils and the scattered photon has less energy, so a longer wavelength. The increase is Δλ = λ′ − λ = (h/mₑc)(1 − cos θ). This Compton effect was decisive evidence that photons carry momentum p = h/λ.',
    variables: [['λ, λ′', 'incident and scattered wavelengths'], ['θ', 'photon scattering angle'], ['h/mₑc', 'Compton wavelength 2.43 pm'], ['φ', 'electron recoil angle']],
    observe: [
      'At θ = 0 there is no shift; at 180° the shift is largest (4.85 pm).',
      'The shift is the same for every incident wavelength — so it matters most for short wavelengths.',
      'The electron always recoils forward, below the axis when the photon goes up.',
    ],
    challenge: 'For 71 pm X-rays scattered at 90°, what fraction of the photon energy does the electron receive?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const electron = kit.sphere(0.25, C.negative, { emissive: 0.4 });
    const eLabel = kit.label('electron', [0, -0.7, 0], { color: C.negative, small: true });
    const inPh = kit.line('#facc15', [], { width: 2.5 });
    const outPh = kit.line('#c084fc', [], { width: 2.5 });
    const inDir = kit.line('#64748b', [[-8, 0, 0], [0, 0, 0]], { dashed: true, width: 1 });
    void inDir;
    const outDir = kit.line('#c084fc', [], { dashed: true, width: 1, opacity: 0.6 });
    const eDir = kit.line(C.negative, [], { dashed: true, width: 1, opacity: 0.6 });
    const arcT = kit.line('#e2e8f0', [], { width: 1.2 });
    const tLabel = kit.label('', [0, 0, 0], { small: true });
    const lInLabel = kit.label('', [-5, 1, 0], { color: '#facc15', small: true });
    const lOutLabel = kit.label('', [0, 0, 0], { color: '#c084fc', small: true });

    const lamIn = () => num(p, 'lam');
    const dL = () => comptonShift(rad(num(p, 'theta'))) * 1e12;
    const lamOut = () => lamIn() + dL();
    const keV = (lpm: number) => (h * c) / (lpm * 1e-12) / eC / 1000;
    /** Electron recoil angle below the axis: cot φ = (1 + E/mₑc²) tan(θ/2). */
    const phi = () => {
      const th = rad(num(p, 'theta'));
      if (th <= 1e-6) return Math.PI / 2;
      return Math.atan2(1, (1 + keV(lamIn()) / 511) * Math.tan(th / 2));
    };

    /** A photon drawn as a short wave packet whose visual wavelength is proportional to λ. */
    function packet(line: typeof inPh, from: THREE.Vector3, dir: THREE.Vector3, s: number, lpm: number) {
      const vis = (0.5 * lpm) / lamIn();
      const perp = new THREE.Vector3(-dir.y, dir.x, 0);
      const pts: THREE.Vector3[] = [];
      const len = 2.2;
      for (let i = 0; i <= 80; i++) {
        const u = (i / 80) * len;
        const env = Math.sin((Math.PI * u) / len);
        const w = 0.35 * env * Math.sin((2 * Math.PI * u) / vis);
        pts.push(from.clone().addScaledVector(dir, s - len + u).addScaledVector(perp, w));
      }
      line.setPoints(pts);
    }
    function build() {
      const th = rad(num(p, 'theta'));
      const d = new THREE.Vector3(Math.cos(th), Math.sin(th), 0);
      outDir.setPoints([[0, 0, 0], d.clone().multiplyScalar(7)]);
      const ph = phi();
      eDir.setPoints([[0, 0, 0], [5 * Math.cos(ph), -5 * Math.sin(ph), 0]]);
      const arc: [number, number, number][] = [];
      for (let k = 0; k <= 30; k++) { const a = (th * k) / 30; arc.push([1.4 * Math.cos(a), 1.4 * Math.sin(a), 0]); }
      arcT.setPoints(arc);
      tLabel.at([1.9 * Math.cos(th / 2), 1.9 * Math.sin(th / 2) + 0.1, 0]).setText(`θ = ${n(num(p, 'theta'))}°`);
      lInLabel.setText(`λ = ${n(lamIn())} pm`);
      lOutLabel.at(d.clone().multiplyScalar(6).add(new THREE.Vector3(0, 0.7, 0))).setText(`λ′ = ${n(lamOut())} pm`);
      graphs.get('D').plot(0, 0, 180, (a) => comptonShift(rad(a)) * 1e12, 180);
      graphs.get('D').setMarkers([{ x: num(p, 'theta'), y: dL(), color: C.accent }]);
      graphs.get('E').plot(0, 0, 180, (a) => keV(lamIn() + comptonShift(rad(a)) * 1e12), 180);
      graphs.get('E').plot(1, 0, 180, (a) => keV(lamIn()) - keV(lamIn() + comptonShift(rad(a)) * 1e12), 180);
      graphs.get('E').setMarkers([{ x: num(p, 'theta'), y: keV(lamOut()), color: '#c084fc' }]);
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; },
      step(dt) { t += dt; },
      render() {
        const ph = t % PERIOD;
        const th = rad(num(p, 'theta'));
        if (ph < PERIOD / 2) {
          const s = -8 + (ph / (PERIOD / 2)) * 8 + 1.1;
          packet(inPh, new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), s, lamIn());
          inPh.visible = true; outPh.visible = false;
          electron.position.set(0, 0, 0);
        } else {
          const u = (ph - PERIOD / 2) / (PERIOD / 2);
          inPh.visible = false; outPh.visible = true;
          packet(outPh, new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(th), Math.sin(th), 0), 1.1 + u * 6.5, lamOut());
          // recoil speed on screen grows with the electron’s share of the energy
          const frac = 1 - lamIn() / lamOut();
          const r = u * Math.min(6, 30 * frac);
          electron.position.set(r * Math.cos(phi()), -r * Math.sin(phi()), 0);
        }
        eLabel.at(electron.position.clone().add(new THREE.Vector3(0, -0.6, 0)));
      },
      time: () => t,
      readouts(): Readout[] {
        const E = keV(lamIn()), E2 = keV(lamOut());
        return [
          { label: 'Compton shift Δλ', value: dL(), unit: 'pm', tone: 'accent' },
          { label: 'Scattered wavelength λ′', value: lamOut(), unit: 'pm', tone: 'accent' },
          { label: 'Incident photon energy', value: E, unit: 'keV' },
          { label: 'Scattered photon energy', value: E2, unit: 'keV' },
          { label: 'Electron kinetic energy', value: E - E2, unit: 'keV' },
          { label: 'Electron recoil angle φ', value: deg(phi()), unit: '°' },
          { label: 'Fractional energy lost', value: ((E - E2) / E) * 100, unit: '%' },
          { label: 'Incident photon momentum h/λ', value: h / (lamIn() * 1e-12), unit: 'kg·m/s' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'Δλ = (h / mₑc)(1 − cos θ)', sub: `= ${n(LC)} × (1 − cos ${n(num(p, 'theta'))}°) = ${n(dL())} pm` },
          { expr: 'E = hc / λ ,  p = h / λ', sub: `E = ${n(keV(lamIn()))} keV → E′ = ${n(keV(lamOut()))} keV` },
          { expr: 'KE(electron) = E − E′', sub: `= ${n(keV(lamIn()) - keV(lamOut()))} keV` },
        ];
      },
    };
  },
};

export default sim;
