import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { photoelectric } from '../../physics/modern';
import { c, h, e as eC } from '../../physics/constants';
import { wavelengthToRGB } from '../../physics/optics';
import { C } from '../../engine/colors';
import { n } from '../shared';

const GAP = 5.3; // emitter→collector distance (scene)

const METALS: Record<string, { name: string; phi: number }> = {
  cs: { name: 'Caesium (2.1 eV)', phi: 2.1 },
  na: { name: 'Sodium (2.3 eV)', phi: 2.3 },
  zn: { name: 'Zinc (4.3 eV)', phi: 4.3 },
  cu: { name: 'Copper (4.7 eV)', phi: 4.7 },
  pt: { name: 'Platinum (5.6 eV)', phi: 5.6 },
};

const sim: SimDefinition = {
  camera: { position: [0, 2.5, 10], target: [0, 0.5, 0], aspect: 1.6 },
  hint: 'Below the threshold frequency no electrons come out, however bright the light. Above it, brighter light gives more electrons — not faster ones.',
  params: [
    { kind: 'select', key: 'metal', label: 'Metal surface', default: 'na', options: Object.entries(METALS).map(([value, m]) => ({ value, label: m.name })) },
    { kind: 'slider', key: 'f', label: 'Frequency of light', unit: '×10¹⁴ Hz', min: 3, max: 20, step: 0.05, default: 8 },
    { kind: 'slider', key: 'I', label: 'Intensity (photons per second)', unit: '%', min: 0, max: 100, step: 1, default: 60 },
    { kind: 'slider', key: 'V', label: 'Collector voltage', unit: 'V', min: -5, max: 5, step: 0.05, default: 0, hint: 'Negative = retarding (stopping) potential' },
  ],
  presets: [
    { label: 'Red light on sodium', values: { metal: 'na', f: 4.5 } },
    { label: 'Violet light on sodium', values: { metal: 'na', f: 7.3 } },
    { label: 'UV on zinc', values: { metal: 'zn', f: 12 } },
    { label: 'Find the stopping potential', values: { metal: 'na', f: 8, V: -1 } },
  ],
  graphs: [
    { id: 'KE', title: 'Maximum kinetic energy vs frequency', x: 'f (×10¹⁴ Hz)', y: 'KE_max (eV)', kind: 'curve', xRange: [3, 20], zeroY: true, series: [{ label: 'KE = hf − φ', color: C.accent }] },
    { id: 'IV', title: 'Photocurrent vs collector voltage', x: 'V (V)', y: 'I (relative)', kind: 'curve', xRange: [-5, 5], zeroY: true, series: [{ label: 'photocurrent', color: C.current }] },
  ],
  learn: {
    concept: 'Light behaves as a stream of photons of energy E = hf. An electron escapes a metal only if one photon gives it at least the work function φ; the rest becomes kinetic energy: KE_max = hf − φ (Einstein’s equation). The stopping potential V₀ satisfies eV₀ = KE_max. Intensity sets the number of photons, and so the current — not the electrons’ energy.',
    variables: [['h', 'Planck constant 6.63 × 10⁻³⁴ J·s'], ['f', 'frequency (Hz)'], ['φ', 'work function (eV)'], ['f₀', 'threshold frequency φ/h'], ['V₀', 'stopping potential (V)']],
    observe: [
      'Below f₀ nothing happens, even at 100 % intensity.',
      'The KE–f graph is a straight line of slope h for every metal.',
      'The stopping potential depends on frequency, not on intensity.',
      'Emission is instantaneous — there is no delay even in dim light.',
    ],
    challenge: 'Find the threshold frequency for zinc. What colour (or type) of radiation is needed?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, emitAcc = 0;
    let electrons: { mesh: THREE.Mesh; x: number; y: number; vx: number; vy: number; alive: boolean }[] = [];
    const tube = kit.cylinder(2.2, 2.2, 7, '#e2e8f0', { opacity: 0.08 }, 48);
    tube.rotation.z = Math.PI / 2;
    const cathode = kit.box(0.2, 2.4, 1.6, '#94a3b8', { metalness: 0.7 });
    cathode.position.set(-2.8, 0, 0);
    const anode = kit.box(0.2, 2.4, 1.6, '#64748b', { metalness: 0.7 });
    anode.position.set(2.8, 0, 0);
    kit.label('emitter', [-2.8, 1.6, 0], { small: true });
    kit.label('collector', [2.8, 1.6, 0], { small: true });
    const beam = kit.line('#facc15', [[-6, 3, 0], [-2.9, 0.3, 0]], { width: 4, opacity: 0.8 });
    const meter = kit.label('', [0, -2.4, 0], { color: C.current });

    const metal = () => METALS[str(p, 'metal')] ?? METALS.na;
    const pe = () => photoelectric(num(p, 'f') * 1e14, metal().phi);
    const lambdaNm = () => (c / (num(p, 'f') * 1e14)) * 1e9;
    /** Relative photocurrent: fraction of electrons (KE spread 0..KEmax) that overcome a retarding potential. */
    const current = (V: number) => {
      const r = pe();
      if (!r.emits) return 0;
      const I = num(p, 'I') / 100;
      if (V >= 0) return I * Math.min(1, 0.7 + V * 0.15);
      return I * Math.max(0, 1 - (-V) / r.kMaxEv) * 0.7;
    };

    function curves() {
      const G = graphs.get('KE');
      G.plot(0, 3, 20, (f) => { const r = photoelectric(f * 1e14, metal().phi); return r.emits ? r.kMaxEv : 0; }, 300);
      G.setMarkers([{ x: num(p, 'f'), y: pe().kMaxEv, color: C.accent }]);
      G.setVLines([{ x: pe().f0 / 1e14, label: 'f₀' }]);
      graphs.get('IV').plot(0, -5, 5, current, 200);
      graphs.get('IV').setMarkers([{ x: num(p, 'V'), y: current(num(p, 'V')), color: C.current }]);
    }
    curves();

    function reset() { t = 0; electrons.forEach((e) => { e.mesh.removeFromParent(); }); electrons = []; }

    return {
      setParams(np) { p = np; curves(); },
      reset,
      step(dt) {
        t += dt;
        const r = pe();
        // photons: always arrive; electrons only if hf > φ
        emitAcc += dt * (num(p, 'I') / 100) * 25;
        while (emitAcc >= 1) {
          emitAcc -= 1;
          if (r.emits && electrons.length < 80) {
            const ke = Math.random() * r.kMaxEv; // electrons below the surface lose some energy
            const mesh = kit.sphere(0.08, C.negative, { emissive: 0.6 }, 8);
            // scene units: ½vx² = ke, so a retarding potential |V| stops it exactly when e|V| > KE
            electrons.push({ mesh, x: -2.65, y: (Math.random() - 0.5) * 1.8, vx: Math.sqrt(2 * ke) * 1.5, vy: (Math.random() - 0.5) * 0.3, alive: true });
          }
        }
        // field between plates: acceleration toward collector ∝ V (e is negative → +V pulls electrons right)
        const aField = (num(p, 'V') * 1.5 * 1.5) / GAP; // work over the gap = e·V (scaled)
        for (const el of electrons) {
          el.vx += aField * dt;
          el.x += el.vx * dt; el.y += el.vy * dt;
          if (el.x > 2.65 || el.x < -2.7 || Math.abs(el.y) > 1.9) el.alive = false;
        }
        electrons = electrons.filter((el) => { if (!el.alive) { el.mesh.removeFromParent(); el.mesh.geometry.dispose(); } return el.alive; });
      },
      render() {
        const [r, g, b] = wavelengthToRGB(Math.max(380, Math.min(780, lambdaNm())));
        const visible = lambdaNm() >= 380 && lambdaNm() <= 780;
        beam.setColor(visible ? new THREE.Color(r, g, b).getStyle() : lambdaNm() < 380 ? '#c084fc' : '#7f1d1d');
        for (const el of electrons) el.mesh.position.set(el.x, el.y, 0);
        meter.setText(`photocurrent ∝ ${n(current(num(p, 'V')) * 100)} %`);
      },
      time: () => t,
      readouts(): Readout[] {
        const r = pe();
        return [
          { label: 'Photon energy hf', value: r.photonEv, unit: 'eV' },
          { label: 'Wavelength', value: lambdaNm(), unit: 'nm' },
          { label: 'Work function φ', value: metal().phi, unit: 'eV' },
          { label: 'Threshold frequency f₀', value: r.f0, unit: 'Hz' },
          { label: 'Max kinetic energy', value: r.kMaxEv, unit: 'eV', tone: 'accent' },
          { label: 'Stopping potential V₀', value: r.stoppingV, unit: 'V', tone: 'accent' },
          { label: 'Emission?', value: r.emits ? 'Yes' : 'No — below threshold', tone: r.emits ? 'good' : 'bad' },
          { label: 'Max electron speed', value: Math.sqrt((2 * r.kMaxEv * eC) / 9.109e-31), unit: 'm/s' },
        ];
      },
      equations(): Equation[] {
        const r = pe();
        return [
          { expr: 'E = h f', sub: `= 6.63×10⁻³⁴ × ${n(num(p, 'f') * 1e14)} = ${n(r.photonEv)} eV` },
          { expr: 'KE_max = h f − φ', sub: `= ${n(r.photonEv)} − ${n(metal().phi)} = ${n(r.photonEv - metal().phi)} eV${r.emits ? '' : ' (< 0: no emission)'}` },
          { expr: 'e V₀ = KE_max ,  f₀ = φ / h', sub: `f₀ = ${n(r.f0)} Hz` },
          { expr: `h = ${n(h)} J·s` },
        ];
      },
    };
  },
};

export default sim;
