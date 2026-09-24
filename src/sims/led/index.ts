import * as THREE from 'three';
import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { wavelengthToRGB } from '../../physics/optics';
import { C } from '../../engine/colors';
import { n } from '../shared';
import { CurrentPath, battery, meter, resistor, wire } from '../circuitKit';

const VT = 0.025_85;
const NF = 2; // ideality factor
const RINT = 10; // internal series resistance (Ω)
const ETA = 0.3; // external quantum efficiency (photons per electron)
const IMAX = 0.03; // absolute maximum current (A)

const LEDS: Record<string, { name: string; Eg: number; material: string }> = {
  ir: { name: 'Infrared (GaAs)', Eg: 1.42, material: 'GaAs' },
  red: { name: 'Red', Eg: 1.9, material: 'AlGaInP' },
  orange: { name: 'Orange', Eg: 2.0, material: 'AlGaInP' },
  yellow: { name: 'Yellow', Eg: 2.1, material: 'AlGaInP' },
  green: { name: 'Green', Eg: 2.3, material: 'InGaN' },
  blue: { name: 'Blue', Eg: 2.7, material: 'InGaN' },
  violet: { name: 'Violet', Eg: 3.1, material: 'InGaN' },
};
const lam = (Eg: number) => 1239.84 / Eg; // nm
function colorOf(nm: number) {
  if (nm > 780) return '#7f1d1d';
  const [r, g, b] = wavelengthToRGB(Math.max(380, nm));
  return new THREE.Color(r, g, b).getStyle();
}
const Iof = (Vd: number, Eg: number) => 2e-4 * Math.exp(-Eg / (NF * VT)) * Math.expm1(Math.min(Vd / (NF * VT), 300));
function operate(V: number, R: number, Eg: number) {
  let lo = -1, hi = Math.max(V, 0) + 1;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if ((V - mid) / (R + RINT) - Iof(mid, Eg) > 0) lo = mid; else hi = mid;
  }
  const vd = (lo + hi) / 2;
  return { vd, I: Math.max(0, Iof(vd, Eg)) };
}

const sim: SimDefinition = {
  camera: { position: [0, 0.5, 12], target: [0, 0, 0], aspect: 1.4 },
  hint: 'Each electron that drops across the band gap gives out one photon of energy ≈ E_g, so a wider gap means bluer light — and a higher switch-on voltage.',
  params: [
    { kind: 'select', key: 'led', label: 'LED colour', default: 'red', options: Object.entries(LEDS).map(([value, l]) => ({ value, label: `${l.name} — E_g ${l.Eg} eV` })) },
    { kind: 'slider', key: 'V', label: 'Supply voltage', unit: 'V', min: 0, max: 9, step: 0.05, default: 5 },
    { kind: 'slider', key: 'R', label: 'Series resistor', unit: 'Ω', min: 47, max: 2000, step: 1, default: 220 },
  ],
  presets: [
    { label: 'Red at 5 V / 220 Ω', values: { led: 'red', V: 5, R: 220 } },
    { label: 'Blue needs more voltage', values: { led: 'blue', V: 2.6, R: 100 } },
    { label: 'Green, bright', values: { led: 'green', V: 9, R: 330 } },
    { label: 'No resistor (too much current)', values: { led: 'red', V: 9, R: 47 } },
  ],
  graphs: [
    { id: 'IV', title: 'I–V curves of different LEDs', x: 'V (V)', y: 'I (mA)', kind: 'curve', xRange: [0, 4], yRange: [0, 30], series: Object.values(LEDS).map((l) => ({ label: l.name, color: colorOf(lam(l.Eg)) })) },
    { id: 'S', title: 'Emission spectrum', x: 'λ (nm)', y: 'optical power (mW/nm)', kind: 'curve', xRange: [350, 950], zeroY: true, series: [{ label: 'emission', color: C.accent }] },
  ],
  learn: {
    concept: 'A light-emitting diode is a forward-biased pn junction made from a direct-gap semiconductor. Electrons crossing the junction fall from the conduction band into holes in the valence band (recombination), and each gives out a photon of energy about equal to the band gap: E = hf = hc/λ ≈ E_g. The material sets E_g and so the colour. An LED needs a forward voltage of roughly E_g/e, and a series resistor to limit the current.',
    variables: [['E_g', 'band gap (eV)'], ['λ', 'emitted wavelength hc/E_g'], ['V_f', 'forward voltage'], ['R', 'current-limiting resistor (V − V_f)/I']],
    observe: [
      'Blue and violet LEDs switch on at higher voltages than red ones.',
      'Brightness (photons per second) is proportional to current, not voltage.',
      'Infrared LEDs emit light you cannot see.',
    ],
    challenge: 'Choose a resistor so a green LED runs at 15 mA from a 9 V battery.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, acc = 0;
    wire(kit, [[-5, -2], [-5, 2], [2, 2], [2, -2], [-5, -2]]);
    const cell = battery(kit, [-5, 0], 'y', '');
    const res = resistor(kit, [-1.5, 2], 'x', '');
    const am = meter(kit, [-1.5, -2], 'A', [0, -0.8]);
    // LED body at the right edge of the loop
    const ledG = kit.add(new THREE.Group());
    ledG.position.set(2, 0, 0);
    const domeMat = new THREE.MeshStandardMaterial({ color: '#ef4444', transparent: true, opacity: 0.75, emissive: '#ef4444', emissiveIntensity: 0.1 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.position.y = 0.45;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 24), domeMat);
    ledG.add(dome, body);
    ledG.rotation.z = -Math.PI / 2;
    const halo = kit.sphere(0.9, '#ef4444', { opacity: 0.1, emissive: 1 });
    halo.position.set(2.6, 0, 0);
    const vm = meter(kit, [3.8, -1.8], 'V', [0, -0.8]);
    const photons: { m: THREE.Mesh; v: THREE.Vector3; age: number }[] = [];
    const pGeo = new THREE.SphereGeometry(0.06, 8, 6);
    // band diagram
    const BX = 5.8;
    const cb = kit.box(2.4, 0.12, 0.1, '#60a5fa'); const vb = kit.box(2.4, 0.12, 0.1, '#f59e0b');
    kit.label('conduction band', [BX, 2.6, 0], { small: true, color: '#60a5fa' });
    kit.label('valence band', [BX, -2.1, 0], { small: true, color: '#f59e0b' });
    const gapLabel = kit.label('', [BX + 1.7, 0.3, 0], { small: true });
    const fall = kit.sphere(0.1, C.negative, { emissive: 0.8 });
    const hole = kit.torus(0.1, 0.03, '#f59e0b');
    const squiggle = kit.line('#ef4444', [], { width: 2 });
    const dots = new CurrentPath(kit, [[-5, -2], [-5, 2], [2, 2], [2, -2], [-5, -2]], C.current);

    const L = () => LEDS[str(p, 'led')] ?? LEDS.red;
    const op = () => operate(num(p, 'V'), num(p, 'R'), L().Eg);
    const gapY = () => L().Eg * 1.2; // scene height of the gap

    function build() {
      const l = L(), col = colorOf(lam(l.Eg));
      domeMat.color.set(col); domeMat.emissive.set(col);
      (halo.material as THREE.MeshStandardMaterial).color.set(col);
      (halo.material as THREE.MeshStandardMaterial).emissive.set(col);
      squiggle.setColor(col);
      cb.position.set(BX, -1.7 + gapY(), 0); vb.position.set(BX, -1.7, 0);
      gapLabel.at([BX + 1.7, -1.7 + gapY() / 2, 0]).setText(`E_g = ${n(l.Eg)} eV`);
      cell.label.setText(`${n(num(p, 'V'))} V`);
      res.label.setText(`${n(num(p, 'R'))} Ω`);
      const G = graphs.get('IV');
      Object.values(LEDS).forEach((q, i) => G.plot(i, 0, 4, (v) => Math.min(40, Iof(v, q.Eg) * 1000), 300));
      const o = op();
      G.setMarkers([{ x: o.vd, y: Math.min(30, o.I * 1000), color: col }]);
      const Popt = ETA * Math.min(o.I, IMAX * 2) * l.Eg; // W
      const sig = 12 + lam(l.Eg) * 0.02;
      graphs.get('S').plot(0, 350, 950, (x) => (Popt * 1000 * Math.exp(-((x - lam(l.Eg)) ** 2) / (2 * sig * sig))) / (sig * Math.sqrt(2 * Math.PI)), 400);
    }
    build();

    return {
      setParams(np) { p = np; build(); },
      reset() { t = 0; photons.forEach((q) => q.m.removeFromParent()); photons.length = 0; },
      step(dt) {
        t += dt;
        const o = op();
        dots.advance(Math.min(5, o.I * 200) * dt);
        acc += dt * Math.min(60, o.I * 2000);
        while (acc >= 1) {
          acc -= 1;
          const m = new THREE.Mesh(pGeo, domeMat);
          m.position.set(2.6, 0, 0);
          kit.add(m);
          photons.push({ m, v: new THREE.Vector3().randomDirection().setX(Math.abs(Math.random()) + 0.2).normalize().multiplyScalar(3), age: 0 });
        }
        for (const q of photons) { q.age += dt; q.m.position.addScaledVector(q.v, dt); }
        for (let i = photons.length - 1; i >= 0; i--) if (photons[i].age > 1.2) { photons[i].m.removeFromParent(); photons.splice(i, 1); }
      },
      render() {
        const o = op();
        const on = Math.min(1, o.I / 0.02);
        domeMat.emissiveIntensity = 0.1 + 1.6 * on;
        (halo.material as THREE.MeshStandardMaterial).opacity = 0.05 + 0.3 * on;
        halo.scale.setScalar(1 + on);
        am.setText(`${n(o.I * 1000)} mA`);
        vm.setText(`${n(o.vd)} V`);
        // electron falls across the gap and a photon leaves
        const ph = (t * 0.8) % 1;
        const ybot = -1.7, ytop = -1.7 + gapY();
        fall.visible = hole.visible = o.I > 1e-5;
        fall.position.set(BX - 0.4, ph < 0.5 ? ytop : ytop - (ytop - ybot) * Math.min(1, (ph - 0.5) * 4), 0.1);
        hole.position.set(BX - 0.4, ybot, 0.1);
        if (o.I > 1e-5 && ph > 0.7) {
          const pts: [number, number, number][] = [];
          const lv = 0.12 + (lam(L().Eg) - 380) / 2500;
          for (let k = 0; k <= 30; k++) { const u = k / 30; pts.push([BX - 0.3 + u * 1.3 + (ph - 0.7) * 3, ybot + 0.3 + 0.12 * Math.sin((u * 1.3) / lv * Math.PI * 2), 0.1]); }
          squiggle.setPoints(pts); squiggle.visible = true;
        } else squiggle.visible = false;
      },
      time: () => t,
      readouts(): Readout[] {
        const o = op(), l = L();
        const rate = ETA * o.I / 1.602e-19;
        return [
          { label: 'Wavelength λ = hc/E_g', value: lam(l.Eg), unit: 'nm', tone: 'accent' },
          { label: 'Photon energy', value: l.Eg, unit: 'eV' },
          { label: 'Colour', value: lam(l.Eg) > 780 ? 'Infrared (invisible)' : l.name },
          { label: 'Forward voltage V_f', value: o.vd, unit: 'V', tone: 'accent' },
          { label: 'Current', value: o.I * 1000, unit: 'mA', tone: o.I > IMAX ? 'bad' : undefined },
          { label: 'Photons per second', value: rate, unit: '/s' },
          { label: 'Light output', value: rate * l.Eg * 1.602e-19 * 1000, unit: 'mW' },
          { label: 'Status', value: o.I > IMAX ? 'Over 30 mA — would burn out!' : o.I > 1e-3 ? 'Glowing' : 'Too little current', tone: o.I > IMAX ? 'bad' : o.I > 1e-3 ? 'good' : undefined },
        ];
      },
      equations(): Equation[] {
        const o = op(), l = L();
        return [
          { expr: 'λ = hc / E_g', sub: `= 1240 eV·nm / ${n(l.Eg)} eV = ${n(lam(l.Eg))} nm` },
          { expr: 'I = (V − V_f) / R', sub: `= (${n(num(p, 'V'))} − ${n(o.vd)}) / ${n(num(p, 'R') + RINT)} = ${n(o.I * 1000)} mA` },
          { expr: 'R needed = (V − V_f) / I', sub: `for 15 mA: ${n(Math.max(0, (num(p, 'V') - (l.Eg + 0.2)) / 0.015))} Ω` },
        ];
      },
      dispose() { pGeo.dispose(); },
    };
  },
};

export default sim;
