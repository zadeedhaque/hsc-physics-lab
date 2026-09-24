import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { transformer } from '../../physics/induction';
import { coilPoints } from '../../engine/kit';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const sim: SimDefinition = {
  camera: { position: [0, 2, 10], target: [0, 0.5, 0], aspect: 1.6 },
  hint: 'The alternating current in the primary makes a changing flux in the iron core, which induces an EMF in every turn of the secondary.',
  params: [
    { kind: 'slider', key: 'Np', label: 'Primary turns Nₚ', min: 10, max: 1000, step: 10, default: 500 },
    { kind: 'slider', key: 'Ns', label: 'Secondary turns Nₛ', min: 10, max: 1000, step: 10, default: 100 },
    { kind: 'slider', key: 'Vp', label: 'Primary voltage (rms)', unit: 'V', min: 1, max: 240, step: 1, default: 220 },
    { kind: 'slider', key: 'R', label: 'Load resistance', unit: 'Ω', min: 1, max: 1000, step: 1, default: 44 },
    { kind: 'slider', key: 'eff', label: 'Efficiency', unit: '%', min: 50, max: 100, step: 1, default: 100 },
  ],
  presets: [
    { label: 'Step-down 220 → 44 V', values: { Np: 500, Ns: 100, Vp: 220 } },
    { label: 'Step-up ×5', values: { Np: 100, Ns: 500, Vp: 220, R: 1000 } },
    { label: 'Phone charger (220 → 5 V)', values: { Np: 880, Ns: 20, Vp: 220, R: 5 } },
    { label: 'Real transformer (95 %)', values: { eff: 95 } },
  ],
  graphs: [
    { id: 'v', title: 'Primary and secondary voltages (instantaneous)', x: 't (s)', y: 'V', window: 0.06, zeroY: true, series: [{ label: 'Vₚ', color: C.accent }, { label: 'Vₛ', color: C.acceleration }] },
  ],
  learn: {
    concept: 'A transformer changes AC voltage using mutual induction. The same changing flux passes through both coils, so the EMF per turn is the same: Vₛ/Vₚ = Nₛ/Nₚ. In an ideal transformer no power is lost, so the currents are in the inverse ratio: Iₛ/Iₚ = Nₚ/Nₛ.',
    variables: [['Nₚ, Nₛ', 'primary and secondary turns'], ['Vₚ, Vₛ', 'voltages (V)'], ['Iₚ, Iₛ', 'currents (A)'], ['η', 'efficiency Pₛ/Pₚ']],
    observe: [
      'More secondary turns than primary: step-up (higher voltage, lower current).',
      'Fewer secondary turns: step-down.',
      'In an ideal transformer VₚIₚ = VₛIₛ.',
      'A transformer does not work with steady DC — the flux must change.',
    ],
    challenge: 'Design a transformer to run a 12 V, 24 W lamp from 220 V mains. Find Nₛ for Nₚ = 1100 and the primary current.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const sample = sampler(1 / 2000);
    // iron core: rectangular ring
    const core = kit.add(new THREE.Group());
    const cm = '#475569';
    const top = kit.box(5, 0.6, 0.8, cm); top.position.y = 2;
    const bot = kit.box(5, 0.6, 0.8, cm); bot.position.y = -1;
    const left = kit.box(0.6, 3.6, 0.8, cm); left.position.set(-2.2, 0.5, 0);
    const right = kit.box(0.6, 3.6, 0.8, cm); right.position.set(2.2, 0.5, 0);
    core.add(top, bot, left, right);
    const prim = kit.line(C.accent, [], { width: 3 });
    const sec = kit.line(C.acceleration, [], { width: 3 });
    const fluxDots: THREE.Mesh[] = [];
    for (let i = 0; i < 16; i++) fluxDots.push(kit.sphere(0.06, C.magnetic, { emissive: 0.6 }, 8));
    const pL = kit.label('', [-3.6, 0.5, 0], { color: C.accent, small: true });
    const sL = kit.label('', [3.6, 0.5, 0], { color: C.acceleration, small: true });
    const bulb = kit.sphere(0.35, '#fde68a');
    bulb.position.set(4.6, -1, 0);

    const tr = () => {
      const r = transformer(num(p, 'Np'), num(p, 'Ns'), num(p, 'Vp'), num(p, 'R'));
      const eta = num(p, 'eff') / 100;
      return { ...r, Ip: r.Ip / eta, Pin: r.P / eta };
    };
    function build() {
      const rot = (pts: THREE.Vector3[], x: number) => pts.map((v) => new THREE.Vector3(x + v.y, v.x + 0.5, v.z));
      const tp = Math.max(4, Math.min(30, Math.round(num(p, 'Np') / 25)));
      const ts = Math.max(4, Math.min(30, Math.round(num(p, 'Ns') / 25)));
      prim.setPoints(rot(coilPoints(tp, 0.6, 2.8, 20), -2.2));
      sec.setPoints(rot(coilPoints(ts, 0.6, 2.8, 20), 2.2));
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; sample.reset(); },
      step(dt) {
        t += dt * 0.02; // 50 Hz shown 50× slower
        if (sample.due(t)) {
          const r = tr();
          const w = 2 * Math.PI * 50;
          graphs.get('v').push(t, num(p, 'Vp') * Math.SQRT2 * Math.sin(w * t), r.Vs * Math.SQRT2 * Math.sin(w * t));
        }
      },
      render() {
        const r = tr();
        const w = 2 * Math.PI * 50;
        const phase = Math.sin(w * t);
        fluxDots.forEach((d, i) => {
          const u = ((i / fluxDots.length) + t * 5 * Math.sign(Math.cos(w * t))) % 1;
          const s = ((u % 1) + 1) % 1;
          // go round the core loop
          let x: number, y: number;
          if (s < 0.25) { x = -2.2 + (s / 0.25) * 4.4; y = 2; }
          else if (s < 0.5) { x = 2.2; y = 2 - ((s - 0.25) / 0.25) * 3; }
          else if (s < 0.75) { x = 2.2 - ((s - 0.5) / 0.25) * 4.4; y = -1; }
          else { x = -2.2; y = -1 + ((s - 0.75) / 0.25) * 3; }
          d.position.set(x, y, 0.45);
          d.scale.setScalar(0.4 + Math.abs(phase));
        });
        pL.setText(`Nₚ = ${num(p, 'Np')} · ${n(num(p, 'Vp'))} V · ${n(r.Ip)} A`);
        sL.setText(`Nₛ = ${num(p, 'Ns')} · ${n(r.Vs)} V · ${n(r.Is)} A`);
        const bm = bulb.material as THREE.MeshStandardMaterial;
        bm.emissive.set('#fde047');
        bm.emissiveIntensity = Math.min(1.5, r.P / 50);
      },
      time: () => t,
      readouts(): Readout[] {
        const r = tr();
        return [
          { label: 'Turns ratio Nₛ/Nₚ', value: r.ratio, tone: 'accent' },
          { label: 'Type', value: r.ratio > 1 ? 'Step-up' : r.ratio < 1 ? 'Step-down' : 'Isolation (1 : 1)' },
          { label: 'Secondary voltage Vₛ', value: r.Vs, unit: 'V', tone: 'accent' },
          { label: 'Secondary current Iₛ', value: r.Is, unit: 'A' },
          { label: 'Primary current Iₚ', value: r.Ip, unit: 'A' },
          { label: 'Output power', value: r.P, unit: 'W' },
          { label: 'Input power', value: r.Pin, unit: 'W' },
        ];
      },
      equations(): Equation[] {
        const r = tr();
        return [
          { expr: 'Vₛ / Vₚ = Nₛ / Nₚ', sub: `Vₛ = ${n(num(p, 'Vp'))} × ${num(p, 'Ns')}/${num(p, 'Np')} = ${n(r.Vs)} V` },
          { expr: 'Ideal: Vₚ Iₚ = Vₛ Iₛ  ⇒  Iₛ / Iₚ = Nₚ / Nₛ' },
          { expr: 'η = Pₛ / Pₚ', sub: `= ${num(p, 'eff')} %` },
        ];
      },
    };
  },
};

export default sim;
