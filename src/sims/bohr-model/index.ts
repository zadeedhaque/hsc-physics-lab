import * as THREE from 'three';
import type { Equation, Params, Readout, SimAction, SimDefinition } from '../types';
import { num, str } from '../types';
import { bohrEnergy, bohrRadius, transition, seriesName } from '../../physics/modern';
import { wavelengthToRGB } from '../../physics/optics';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const NMAX = 6;
const RS = 0.16; // scene radius of n = 1 (radii drawn to scale ∝ n²/Z)
const LX = 4.4; // x of the energy-level diagram
const SPEC_Y = -4.2; // spectrum strip height
const SPEC_X0 = -7, SPEC_W = 14, SPEC_NM0 = 80, SPEC_NM1 = 1900;

const specX = (nm: number) => SPEC_X0 + ((Math.log(nm) - Math.log(SPEC_NM0)) / (Math.log(SPEC_NM1) - Math.log(SPEC_NM0))) * SPEC_W;
function lineColor(nm: number) {
  if (nm < 380) return '#a78bfa';
  if (nm > 750) return '#b91c1c';
  const [r, g, b] = wavelengthToRGB(nm);
  return new THREE.Color(r, g, b).getStyle();
}
const levelY = (E: number, Z: number) => 3 + (E / (13.6 * Z * Z)) * 6; // E from −13.6Z² (y = −3) to 0 (y = 3)

const sim: SimDefinition = {
  camera: { position: [-0.1, 0.2, 16], target: [-0.1, -0.5, 0], aspect: 1.75 },
  hint: 'Each jump between allowed orbits emits (or absorbs) one photon with energy exactly equal to the difference in levels — a sharp spectral line.',
  params: [
    { kind: 'select', key: 'focus', label: 'Mode', default: 'atom', options: [{ value: 'atom', label: 'Single atom — chosen transition' }, { value: 'spectrum', label: 'Hot gas — build the line spectrum' }] },
    { kind: 'slider', key: 'n2', label: 'Upper level n₂', min: 2, max: NMAX, step: 1, default: 3, showIf: (p) => p.focus !== 'spectrum' },
    { kind: 'slider', key: 'n1', label: 'Lower level n₁', min: 1, max: NMAX - 1, step: 1, default: 2, showIf: (p) => p.focus !== 'spectrum' },
    { kind: 'select', key: 'Z', label: 'Atom', default: '1', options: [{ value: '1', label: 'Hydrogen (Z = 1)' }, { value: '2', label: 'He⁺ (Z = 2)' }, { value: '3', label: 'Li²⁺ (Z = 3)' }] },
    { kind: 'slider', key: 'rate', label: 'Transitions per second (gas)', min: 1, max: 40, step: 1, default: 12, showIf: (p) => p.focus === 'spectrum' },
  ],
  presets: [
    { label: 'Hα red line (3 → 2)', values: { focus: 'atom', n2: 3, n1: 2 } },
    { label: 'Hβ (4 → 2)', values: { focus: 'atom', n2: 4, n1: 2 } },
    { label: 'Lyman α (2 → 1, UV)', values: { focus: 'atom', n2: 2, n1: 1 } },
    { label: 'Paschen α (4 → 3, IR)', values: { focus: 'atom', n2: 4, n1: 3 } },
    { label: 'Hydrogen discharge tube', values: { focus: 'spectrum', Z: '1' } },
  ],
  graphs: [
    { id: 'S', title: 'Emission spectrum (lines observed)', x: 'λ (nm)', y: 'photon count', kind: 'curve', xRange: [80, 1900], zeroY: true, series: [{ label: 'counts', color: C.accent }] },
    { id: 'n', title: 'Electron energy level vs time', x: 't (s)', y: 'n', window: 15, yRange: [0, NMAX + 0.5], series: [{ label: 'n', color: C.negative }] },
  ],
  learn: {
    concept: 'Bohr’s model of hydrogen: the electron may only occupy orbits whose angular momentum is a whole multiple of h/2π (mvr = nh/2π). These orbits have radii rₙ = 0.529n²/Z Å and energies Eₙ = −13.6Z²/n² eV. Moving from n₂ to n₁ emits a photon of energy hf = E₂ − E₁, giving 1/λ = RZ²(1/n₁² − 1/n₂²). Transitions ending on n = 1, 2, 3 form the Lyman (UV), Balmer (visible) and Paschen (IR) series.',
    variables: [['n', 'principal quantum number'], ['Eₙ', '−13.6 Z²/n² eV'], ['rₙ', '0.529 n²/Z Å'], ['R', 'Rydberg constant 1.097 × 10⁷ m⁻¹'], ['Z', 'nuclear charge']],
    observe: [
      'Orbit radii grow as n², so the levels crowd together near E = 0.',
      'Only the Balmer lines fall in the visible range.',
      'The electron moves more slowly in outer orbits (v ∝ Z/n).',
      'For He⁺ every energy is 4× larger and every wavelength 4× shorter.',
    ],
    challenge: 'Find the ionisation energy of hydrogen from the level diagram, and the shortest Lyman wavelength.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, level = 3, angle = 0, timer = 0, gasAcc = 0;
    const counts = new Map<string, { nm: number; c: number }>();
    const sample = sampler(1 / 10);
    const nucleus = kit.sphere(0.16, C.positive, { emissive: 0.6 });
    nucleus.position.set(-3, 0.3, 0);
    const orbits = Array.from({ length: NMAX }, () => kit.line('#64748b', [], { width: 1, opacity: 0.6 }));
    const oLabels = Array.from({ length: NMAX }, () => kit.label('', [0, 0, 0], { small: true }));
    const electron = kit.sphere(0.13, C.negative, { emissive: 0.7 });
    const levels = Array.from({ length: NMAX }, () => kit.line('#94a3b8', [], { width: 1.5 }));
    const lvLabels = Array.from({ length: NMAX }, () => kit.label('', [0, 0, 0], { small: true }));
    kit.line('#e2e8f0', [[LX - 1.3, 3, 0], [LX + 1.3, 3, 0]], { width: 1, dashed: true });
    kit.label('n = 4, 5, 6 … → 0 eV', [LX + 2.3, 3.35, 0], { small: true });
    const jump = kit.arrow(C.accent, { radius: 0.035 });
    const photon = kit.line('#facc15', [], { width: 2.5 });
    const phLabel = kit.label('', [0, 0, 0], { small: true });
    kit.line('#334155', [[SPEC_X0, SPEC_Y, 0], [SPEC_X0 + SPEC_W, SPEC_Y, 0]], { width: 18, opacity: 0.9 });
    const specLines = kit.add(new THREE.Group());
    kit.label('UV', [specX(150), SPEC_Y - 0.6, 0], { small: true, color: '#a78bfa' });
    kit.label('visible', [specX(560), SPEC_Y - 0.6, 0], { small: true });
    kit.label('infrared', [specX(1300), SPEC_Y - 0.6, 0], { small: true, color: '#f87171' });
    const ph = { on: false, s: 0, nm: 0, dir: 1, absorb: false };

    const Z = () => Number(str(p, 'Z')) || 1;
    const gas = () => str(p, 'focus') === 'spectrum';
    const n1 = () => Math.min(num(p, 'n1'), NMAX - 1);
    const n2 = () => Math.max(num(p, 'n2'), n1() + 1);
    const rScene = (k: number) => (RS * k * k) / Math.sqrt(Z()); // √Z keeps He⁺/Li²⁺ orbits visible; ratios stay ∝ n²

    function geometry() {
      for (let k = 1; k <= NMAX; k++) {
        const r = rScene(k);
        const pts: [number, number, number][] = [];
        for (let a = 0; a <= 64; a++) pts.push([-3 + r * Math.cos((a / 64) * Math.PI * 2), 0.3 + r * Math.sin((a / 64) * Math.PI * 2), 0]);
        orbits[k - 1].setPoints(pts);
        oLabels[k - 1].at([-3 + r * 0.72, 0.3 + r * 0.72, 0]).setText(k <= 4 ? `n=${k}` : '');
        const y = levelY(bohrEnergy(k, Z()), Z());
        levels[k - 1].setPoints([[LX - 1.3, y, 0], [LX + 1.3, y, 0]]);
        lvLabels[k - 1].at([LX + 2.3, y, 0]).setText(k <= 3 ? `n=${k}  ${n(bohrEnergy(k, Z()))} eV` : '');
      }
    }
    function drawSpectrum() {
      kit.clearGroup(specLines);
      const all = gas() ? [...counts.values()] : [{ nm: transition(n1(), n2(), Z()).lambda * 1e9, c: 1 }];
      const maxC = Math.max(1, ...all.map((q) => q.c));
      for (const q of all) {
        if (q.nm < SPEC_NM0 || q.nm > SPEC_NM1) continue;
        const l = kit.line(lineColor(q.nm), [[specX(q.nm), SPEC_Y - 0.28, 0.01], [specX(q.nm), SPEC_Y + 0.28, 0.01]], { width: 2 + 3 * (q.c / maxC), opacity: 0.35 + 0.65 * (q.c / maxC) });
        specLines.add(l);
      }
      const G = graphs.get('S');
      G.plot(0, 80, 1900, (x) => { let y = 0; for (const q of all) y += q.c * Math.exp(-(((x - q.nm) / 6) ** 2)); return y; }, 900);
    }
    function fire(from: number, to: number) {
      const tr = transition(Math.min(from, to), Math.max(from, to), Z());
      ph.on = true; ph.s = 0; ph.nm = tr.lambda * 1e9; ph.absorb = to > from;
      ph.dir = Math.random() * Math.PI * 2;
      if (!ph.absorb && gas()) {
        const key = `${Math.min(from, to)}-${Math.max(from, to)}`;
        const e = counts.get(key) ?? { nm: ph.nm, c: 0 };
        e.c++; counts.set(key, e);
        drawSpectrum();
      }
      photon.setColor(lineColor(ph.nm));
      level = to;
      timer = 0;
    }
    function reset() {
      t = 0; timer = 0; angle = 0; gasAcc = 0; counts.clear(); ph.on = false;
      level = gas() ? 1 : n2();
      sample.reset(); geometry(); drawSpectrum();
    }
    reset();

    return {
      setParams(np) {
        const modeChanged = str(np, 'focus') !== str(p, 'focus') || str(np, 'Z') !== str(p, 'Z');
        p = np;
        if (modeChanged) reset(); else { geometry(); drawSpectrum(); if (!gas() && level !== n1() && level !== n2()) level = n2(); }
      },
      reset,
      step(dt) {
        t += dt; timer += dt;
        // angular speed ω ∝ Z²/n³ (scaled)
        angle += dt * Math.min(14, (9 * Z() * Z()) / level ** 3 + 0.4);
        if (ph.on) { ph.s += dt * 5; if (ph.s > 7) ph.on = false; }
        if (gas()) {
          // random excitation (collisions) and spontaneous decay to any lower level
          gasAcc += dt * num(p, 'rate');
          while (gasAcc >= 1) {
            gasAcc -= 1;
            if (level === 1 || Math.random() < 0.25) level = Math.min(NMAX, level + 1 + Math.floor(Math.random() * (NMAX - level)));
            else fire(level, 1 + Math.floor(Math.random() * (level - 1)));
          }
        } else if (timer > 2.2) {
          if (level === n2()) fire(n2(), n1()); // emission
          else fire(n1(), n2()); // absorption of an incoming photon
        }
        if (sample.due(t)) graphs.get('n').push(t, level);
      },
      render() {
        const r = rScene(level);
        electron.position.set(-3 + r * Math.cos(angle), 0.3 + r * Math.sin(angle), 0);
        orbits.forEach((o, i) => o.setColor(i + 1 === level ? C.negative : '#64748b'));
        levels.forEach((o, i) => o.setColor(i + 1 === level ? C.negative : '#94a3b8'));
        const a = gas() ? null : [n1(), n2()];
        if (a) {
          const y1 = levelY(bohrEnergy(a[0], Z()), Z()), y2 = levelY(bohrEnergy(a[1], Z()), Z());
          const down = level === a[0];
          jump.set([LX, down ? y2 : y1, 0], [0, down ? y1 - y2 : y2 - y1, 0]);
          jump.visible = true;
        } else jump.visible = false;
        if (ph.on) {
          const dx = Math.cos(ph.dir), dy = Math.sin(ph.dir);
          const start = ph.absorb ? 7 - ph.s : ph.s; // absorbed photons travel inward
          const pts: [number, number, number][] = [];
          const vis = 0.12 + 0.25 * Math.log10(ph.nm / 80);
          for (let k = 0; k <= 40; k++) {
            const s = start + (k / 40) * 1.2;
            const w = 0.15 * Math.sin((s / vis) * Math.PI * 2);
            pts.push([-3 + dx * s - dy * w, 0.3 + dy * s + dx * w, 0.05]);
          }
          photon.setPoints(pts); photon.visible = true;
          phLabel.at([-3 + dx * (start + 1.6), 0.3 + dy * (start + 1.6), 0]).setText(`${n(ph.nm)} nm`);
        } else { photon.visible = false; phLabel.setText(''); }
      },
      time: () => t,
      actions(): SimAction[] {
        return [{ id: 'clear', label: 'Clear spectrum', run: () => { counts.clear(); drawSpectrum(); } }];
      },
      readouts(): Readout[] {
        const tr = transition(n1(), n2(), Z());
        const nm = tr.lambda * 1e9;
        return [
          { label: 'Current level n', value: level, tone: 'accent' },
          { label: 'Orbit radius rₙ', value: bohrRadius(level, Z()) * 1e10, unit: 'Å' },
          { label: 'Energy Eₙ', value: bohrEnergy(level, Z()), unit: 'eV' },
          { label: `Photon energy (${n2()} → ${n1()})`, value: tr.dE, unit: 'eV' },
          { label: 'Wavelength', value: nm, unit: 'nm', tone: 'accent' },
          { label: 'Series', value: seriesName(n1()) },
          { label: 'Region', value: nm < 380 ? 'Ultraviolet' : nm > 750 ? 'Infrared' : 'Visible' },
          { label: 'Lines recorded (gas mode)', value: [...counts.values()].reduce((s, q) => s + q.c, 0) },
        ];
      },
      equations(): Equation[] {
        const tr = transition(n1(), n2(), Z());
        return [
          { expr: 'Eₙ = −13.6 Z² / n² eV', sub: `E${n2()} = ${n(bohrEnergy(n2(), Z()))} eV, E${n1()} = ${n(bohrEnergy(n1(), Z()))} eV` },
          { expr: 'h f = E₂ − E₁', sub: `= ${n(tr.dE)} eV` },
          { expr: '1/λ = R Z² (1/n₁² − 1/n₂²)', sub: `λ = ${n(tr.lambda * 1e9)} nm` },
          { expr: 'rₙ = 0.529 n² / Z Å ,  mvr = n h / 2π' },
        ];
      },
    };
  },
};

export default sim;
