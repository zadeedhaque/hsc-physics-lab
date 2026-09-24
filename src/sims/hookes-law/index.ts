import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { springPoints } from '../../engine/kit';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const G = 9.81;
const S = 8; // scene units per metre of extension

const sim: SimDefinition = {
  camera: { position: [1.8, 0.4, 9], target: [0.6, 0, 0], aspect: 1.3 },
  hint: 'Add mass and the spring oscillates, then settles at the new equilibrium x = mg/k. Past the elastic limit it no longer returns.',
  params: [
    { kind: 'slider', key: 'k', label: 'Spring constant k', unit: 'N/m', min: 10, max: 200, step: 1, default: 50 },
    { kind: 'slider', key: 'm', label: 'Hanging mass', unit: 'kg', min: 0, max: 3, step: 0.05, default: 0.5 },
    { kind: 'slider', key: 'lim', label: 'Elastic limit (max extension)', unit: 'm', min: 0.1, max: 0.6, step: 0.01, default: 0.4 },
  ],
  presets: [
    { label: '100 g steps: 0.1 kg', values: { m: 0.1 } },
    { label: '0.5 kg', values: { m: 0.5 } },
    { label: '1.0 kg', values: { m: 1 } },
    { label: 'Overload', values: { m: 2.5, k: 50 } },
    { label: 'Stiff spring', values: { k: 180, m: 1 } },
  ],
  graphs: [
    { id: 'Fx', title: 'Load vs extension', x: 'extension x (m)', y: 'F (N)', kind: 'curve', xRange: [0, 0.8], zeroY: true, series: [{ label: 'F = kx (to the limit)', color: C.force }] },
    { id: 'xt', title: 'Extension vs time', x: 't (s)', y: 'x (m)', window: 10, zeroY: true, series: [{ label: 'x', color: C.accent }] },
  ],
  learn: {
    concept: 'Hooke’s law: within the elastic limit, the extension of a spring is directly proportional to the stretching force, F = kx. The spring constant k is the force per unit extension. Beyond the elastic limit the spring is permanently deformed.',
    variables: [['F', 'load mg (N)'], ['x', 'extension (m)'], ['k', 'spring constant (N/m)'], ['x_lim', 'extension at the elastic limit']],
    observe: [
      'Each equal step of mass adds an equal step of extension.',
      'A stiffer spring (larger k) stretches less for the same load.',
      'The oscillation always settles at x = mg/k.',
      'Beyond the elastic limit the graph bends and the spring stays longer.',
    ],
    challenge: 'Hang an unknown mass on the k = 50 N/m spring so that x = 0.25 m. What mass is it? Check by setting it.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let x = 0, v = 0, t = 0, setX = 0; // setX = permanent set after overload
    const sample = sampler(1 / 30);
    const beam = kit.box(3, 0.25, 1, '#475569');
    beam.position.set(0, 3.1, 0);
    const spring = kit.line('#cbd5e1', [], { width: 2.5 });
    const hanger = kit.cylinder(0.05, 0.05, 0.3, '#94a3b8');
    const mass = kit.cylinder(0.4, 0.4, 0.5, '#64748b', { metalness: 0.5 });
    const ruler = kit.segments('#94a3b8', { width: 1.2 });
    const zero = kit.line(C.normal, [], { dashed: true, width: 1.5 });
    const eq = kit.line(C.weight, [], { dashed: true, width: 1.5 });
    const xLabel = kit.label('', [0, 0, 0], { color: C.accent, small: true });
    const fS = kit.arrow(C.force, { label: 'kx', radius: 0.04 });
    const fW = kit.arrow(C.weight, { label: 'mg', radius: 0.04 });
    const flat: number[] = [];
    for (let c = 0; c <= 80; c++) { const y = 1.4 - (c / 100) * S; flat.push(1.3, y, 0, c % 10 === 0 ? 1.6 : 1.45, y, 0); }
    ruler.setSegments(flat);
    [0, 20, 40, 60].forEach((c) => kit.label(`${c} cm`, [2.05, 1.4 - (c / 100) * S, 0], { small: true }));

    const force = (xx: number) => {
      const lim = num(p, 'lim'), k = num(p, 'k');
      const e = xx - setX;
      return e <= lim ? k * e : k * lim + k * 0.35 * (e - lim);
    };
    const equilibrium = () => {
      const W = num(p, 'm') * G, k = num(p, 'k'), lim = num(p, 'lim');
      return W <= k * lim ? setX + W / k : setX + lim + (W - k * lim) / (0.35 * k);
    };
    function curve() {
      const k = num(p, 'k'), lim = num(p, 'lim');
      graphs.get('Fx').setSeries(0, [0, lim, 0.8], [0, k * lim, k * lim + 0.35 * k * (0.8 - lim)]);
      graphs.get('Fx').setMarkers([{ x: equilibrium() - setX, y: num(p, 'm') * G, label: `${n(num(p, 'm'))} kg`, color: C.weight }]);
    }
    curve();

    return {
      setParams(np) { p = np; curve(); },
      reset() { x = 0; v = 0; t = 0; setX = 0; sample.reset(); curve(); },
      step(dt) {
        const m = Math.max(num(p, 'm'), 0.02);
        const a = (m * G - force(x)) / m - 1.2 * v; // light damping
        v += a * dt; x += v * dt; t += dt;
        if (x < 0) { x = 0; v = 0; }
        // plastic deformation: once past the limit, part of the stretch becomes permanent
        const over = x - setX - num(p, 'lim');
        if (over > 0) setX += over * 0.002;
        if (sample.due(t)) graphs.get('xt').push(t, x);
      },
      render() {
        const top = 3.0, L0 = 1.4;
        const bottom = top - L0 - x * S;
        spring.setPoints(springPoints([0, top, 0], [0, bottom, 0], 12, 0.22));
        hanger.position.set(0, bottom - 0.15, 0);
        mass.visible = num(p, 'm') > 0;
        mass.scale.set(1, Math.max(0.2, num(p, 'm') / 1), 1);
        mass.position.set(0, bottom - 0.3 - (0.25 * Math.max(0.2, num(p, 'm'))), 0);
        zero.setPoints([[-0.8, top - L0, 0], [1.3, top - L0, 0]]);
        eq.setPoints([[-0.8, top - L0 - equilibrium() * S, 0], [1.3, top - L0 - equilibrium() * S, 0]]);
        xLabel.at([-1.5, bottom, 0]).setText(`x = ${n(x * 100)} cm`);
        fS.set([0.55, bottom, 0], [0, force(x) / 15, 0], `kx = ${n(force(x))} N`);
        fW.set([-0.55, bottom - 0.3, 0], [0, -(num(p, 'm') * G) / 15, 0], `mg = ${n(num(p, 'm') * G)} N`);
      },
      time: () => t,
      readouts(): Readout[] {
        const W = num(p, 'm') * G;
        return [
          { label: 'Load F = mg', value: W, unit: 'N' },
          { label: 'Equilibrium extension', value: equilibrium() * 100, unit: 'cm', tone: 'accent' },
          { label: 'Current extension', value: x * 100, unit: 'cm' },
          { label: 'Elastic limit load', value: num(p, 'k') * num(p, 'lim'), unit: 'N' },
          { label: 'Permanent set', value: setX * 100, unit: 'cm', tone: setX > 1e-4 ? 'bad' : 'default' },
          { label: 'Within elastic limit?', value: W <= num(p, 'k') * num(p, 'lim') ? 'Yes' : 'No', tone: W <= num(p, 'k') * num(p, 'lim') ? 'good' : 'bad' },
          { label: 'Elastic PE stored ½kx²', value: 0.5 * num(p, 'k') * Math.min(x, num(p, 'lim')) ** 2, unit: 'J' },
        ];
      },
      equations(): Equation[] {
        const W = num(p, 'm') * G;
        return [
          { expr: 'F = k x', sub: `x = ${n(W)} / ${n(num(p, 'k'))} = ${n(W / num(p, 'k'))} m (if within the limit)` },
          { expr: 'k = F / x  (slope of the F–x line)', sub: `k = ${n(num(p, 'k'))} N/m` },
          { expr: 'U = ½ k x²' },
        ];
      },
    };
  },
};

export default sim;
