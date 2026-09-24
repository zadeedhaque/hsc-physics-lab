import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { C } from '../../engine/colors';
import { n } from '../shared';

const LIQUIDS: Record<string, { name: string; T: number; color: string }> = {
  water: { name: 'Water (20 °C)', T: 0.0728, color: '#60a5fa' },
  soap: { name: 'Soap solution', T: 0.025, color: '#c4b5fd' },
  mercury: { name: 'Mercury', T: 0.485, color: '#cbd5e1' },
  alcohol: { name: 'Ethanol', T: 0.0223, color: '#a7f3d0' },
};

const sim: SimDefinition = {
  camera: { position: [0, 1.5, 9], target: [0, 0.6, 0], aspect: 1.5 },
  timeless: true,
  hint: 'A film has two surfaces, so the force on the sliding wire is 2TL. Smaller drops have larger excess pressure.',
  params: [
    { kind: 'select', key: 'mode', label: 'Experiment', default: 'frame', options: [{ value: 'frame', label: 'Film on a frame' }, { value: 'drop', label: 'Liquid drop' }, { value: 'bubble', label: 'Soap bubble' }] },
    { kind: 'select', key: 'liq', label: 'Liquid', default: 'soap', options: Object.entries(LIQUIDS).map(([value, l]) => ({ value, label: l.name })) },
    { kind: 'slider', key: 'L', label: 'Length of sliding wire', unit: 'cm', min: 1, max: 10, step: 0.1, default: 5, showIf: (p) => p.mode === 'frame' },
    { kind: 'slider', key: 'r', label: 'Radius', unit: 'mm', min: 0.1, max: 20, step: 0.1, default: 2, showIf: (p) => p.mode !== 'frame' },
  ],
  presets: [
    { label: 'Soap film', values: { mode: 'frame', liq: 'soap', L: 5 } },
    { label: 'Water film', values: { mode: 'frame', liq: 'water', L: 5 } },
    { label: 'Tiny water drop', values: { mode: 'drop', liq: 'water', r: 0.2 } },
    { label: 'Big soap bubble', values: { mode: 'bubble', liq: 'soap', r: 20 } },
  ],
  graphs: [
    { id: 'P', title: 'Excess pressure vs radius', x: 'r (mm)', y: 'ΔP (Pa)', kind: 'curve', xRange: [0, 20], zeroY: true, series: [{ label: 'drop 2T/r', color: C.accent }, { label: 'bubble 4T/r', color: C.acceleration }] },
  ],
  learn: {
    concept: 'Surface tension T is the force per unit length acting along a liquid surface, as if the surface were a stretched skin. It pulls a film on a frame with force 2TL (two surfaces) and makes the pressure inside a curved surface higher than outside: ΔP = 2T/r for a drop and 4T/r for a bubble with two surfaces.',
    variables: [['T', 'surface tension (N/m)'], ['L', 'length of the edge (m)'], ['F', 'force on the wire (N)'], ['ΔP', 'excess pressure (Pa)'], ['r', 'radius (m)']],
    observe: [
      'The film pulls the wire inward with a force proportional to its length.',
      'Mercury has a far larger surface tension than water.',
      'Halving the radius of a drop doubles the pressure inside it.',
    ],
    challenge: 'What length of soap-film wire experiences a force of 5 mN? Use F = 2TL with T = 0.025 N/m.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    const frameG = kit.add(new THREE.Group());
    const dropG = kit.add(new THREE.Group());
    const liquid = () => LIQUIDS[str(p, 'liq')] ?? LIQUIDS.water;

    // Frame
    const u = kit.segments('#e2e8f0', { width: 4 });
    frameG.add(u);
    const film = kit.plane(1, 1, '#c4b5fd', { opacity: 0.35 });
    frameG.add(film);
    const slider = kit.cylinder(0.05, 0.05, 1, '#e2e8f0', { metalness: 0.6 });
    slider.rotation.z = Math.PI / 2;
    frameG.add(slider);
    const pull = kit.arrow(C.force, { label: 'F', radius: 0.05 });
    frameG.add(pull);
    const tArrows = kit.add(new THREE.Group());
    frameG.add(tArrows);
    // Drop
    const drop = kit.sphere(1, '#60a5fa', { opacity: 0.6 }, 48);
    const inner = kit.sphere(1, '#c4b5fd', { opacity: 0.15 }, 48);
    const pIn = kit.label('', [0, 0, 0], { color: C.weight });
    dropG.add(drop, inner, pIn);
    const surfaceArrows = kit.add(new THREE.Group());
    dropG.add(surfaceArrows);

    function draw() {
      const liq = liquid();
      const mode = str(p, 'mode');
      frameG.visible = mode === 'frame';
      dropG.visible = mode !== 'frame';
      if (mode === 'frame') {
        const Lsc = num(p, 'L') * 0.45;
        const H = 2.2;
        u.setSegments([-Lsc / 2, 2.4, 0, Lsc / 2, 2.4, 0, -Lsc / 2, 2.4, 0, -Lsc / 2, -0.4, 0, Lsc / 2, 2.4, 0, Lsc / 2, -0.4, 0]);
        film.scale.set(Lsc, H, 1);
        film.position.set(0, 2.4 - H / 2, 0);
        (film.material as THREE.MeshStandardMaterial).color.set(liq.color);
        slider.scale.set(1, Lsc + 0.3, 1);
        slider.position.set(0, 2.4 - H, 0);
        const F = 2 * liq.T * num(p, 'L') / 100;
        pull.set([0, 2.4 - H - 0.05, 0.1], [0, 0.4 + F * 150, 0], `F = 2TL = ${n(F * 1000)} mN`);
        kit.clearGroup(tArrows);
        for (let i = 0; i < 5; i++) {
          const x = -Lsc / 2 + ((i + 0.5) / 5) * Lsc;
          const a = kit.arrow(C.acceleration, { radius: 0.02 });
          a.set([x, 2.4 - H + 0.05, 0.05], [0, 0.35, 0]);
          tArrows.add(a);
        }
      } else {
        const r = num(p, 'r');
        const R = 0.5 + 1.8 * Math.sqrt(r / 20);
        drop.scale.setScalar(R);
        drop.position.set(0, 1, 0);
        (drop.material as THREE.MeshStandardMaterial).color.set(liq.color);
        inner.visible = mode === 'bubble';
        inner.scale.setScalar(R * 0.96);
        inner.position.copy(drop.position);
        (drop.material as THREE.MeshStandardMaterial).opacity = mode === 'bubble' ? 0.25 : 0.6;
        const dP = (mode === 'bubble' ? 4 : 2) * liq.T / (r / 1000);
        pIn.at([0, 1, 0]).setText(`ΔP = ${n(dP)} Pa`);
        kit.clearGroup(surfaceArrows);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const pos = new THREE.Vector3(R * Math.cos(a), 1 + R * Math.sin(a), 0);
          const ar = kit.arrow(C.acceleration, { radius: 0.02 });
          ar.set(pos, new THREE.Vector3(-Math.cos(a), -Math.sin(a), 0).multiplyScalar(0.35));
          surfaceArrows.add(ar);
        }
      }
      const G = graphs.get('P');
      G.plot(0, 0.2, 20, (r) => (2 * liq.T) / (r / 1000), 200);
      G.plot(1, 0.2, 20, (r) => (4 * liq.T) / (r / 1000), 200);
      G.setMarkers(str(p, 'mode') === 'frame' ? [] : [{ x: num(p, 'r'), y: ((str(p, 'mode') === 'bubble' ? 4 : 2) * liq.T) / (num(p, 'r') / 1000), color: C.weight }]);
    }
    draw();

    return {
      setParams(np) { p = np; draw(); },
      reset() { draw(); },
      step() {},
      readouts(): Readout[] {
        const liq = liquid();
        const mode = str(p, 'mode');
        const out: Readout[] = [{ label: 'Surface tension T', value: liq.T, unit: 'N/m', tone: 'accent' }];
        if (mode === 'frame') {
          const F = (2 * liq.T * num(p, 'L')) / 100;
          out.push({ label: 'Force on wire F = 2TL', value: F * 1000, unit: 'mN', tone: 'accent' }, { label: 'Mass it could support', value: (F / 9.81) * 1e6, unit: 'mg' }, { label: 'Surface energy per area', value: liq.T, unit: 'J/m²' });
        } else {
          const r = num(p, 'r') / 1000;
          const dP = (mode === 'bubble' ? 4 : 2) * liq.T / r;
          out.push({ label: 'Excess pressure ΔP', value: dP, unit: 'Pa', tone: 'accent' }, { label: 'Surface area', value: (mode === 'bubble' ? 2 : 1) * 4 * Math.PI * r * r * 1e6, unit: 'mm²' }, { label: 'Surface energy', value: (mode === 'bubble' ? 2 : 1) * 4 * Math.PI * r * r * liq.T * 1e6, unit: 'µJ' });
        }
        return out;
      },
      equations(): Equation[] {
        const liq = liquid();
        return [
          { expr: 'T = F / L  (force per unit length)' },
          { expr: 'Film: F = 2 T L', sub: `= 2 × ${n(liq.T)} × ${n(num(p, 'L') / 100)} = ${n((2 * liq.T * num(p, 'L')) / 100)} N` },
          { expr: 'Drop: ΔP = 2T / r ,  Bubble: ΔP = 4T / r', sub: `drop of r = ${n(num(p, 'r'))} mm: ${n((2 * liq.T) / (num(p, 'r') / 1000))} Pa` },
        ];
      },
    };
  },
};

export default sim;
