import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num } from '../types';
import { refrigeratorCOP } from '../../physics/thermo';
import { C } from '../../engine/colors';
import { n } from '../shared';

const sim: SimDefinition = {
  camera: { position: [0, 2.5, 10], target: [0, 1.6, 0], aspect: 1.5 },
  hint: 'A refrigerator is a heat engine run backwards: work W pumps heat Q₂ out of the cold box and dumps Q₁ = Q₂ + W into the room.',
  params: [
    { kind: 'slider', key: 'Tc', label: 'Inside temperature T₂', unit: '°C', min: -30, max: 15, step: 1, default: 4 },
    { kind: 'slider', key: 'Th', label: 'Room temperature T₁', unit: '°C', min: 15, max: 45, step: 1, default: 30 },
    { kind: 'slider', key: 'W', label: 'Electrical work per second', unit: 'W', min: 20, max: 500, step: 5, default: 100 },
    { kind: 'slider', key: 'frac', label: 'Real COP as % of ideal', unit: '%', min: 10, max: 100, step: 1, default: 40 },
  ],
  presets: [
    { label: 'Fridge', values: { Tc: 4, Th: 30 } },
    { label: 'Freezer', values: { Tc: -18, Th: 30 } },
    { label: 'Air-conditioner', values: { Tc: 15, Th: 38 } },
    { label: 'Ideal machine', values: { frac: 100 } },
  ],
  graphs: [
    { id: 'cop', title: 'Ideal COP vs inside temperature', x: 'T₂ (°C)', y: 'COP', kind: 'curve', xRange: [-30, 15], zeroY: true, series: [{ label: 'COP = T₂/(T₁ − T₂)', color: C.cold }] },
  ],
  learn: {
    concept: 'A refrigerator uses work W to move heat Q₂ from a cold region to a hot one, rejecting Q₁ = Q₂ + W. Its performance is measured by the coefficient of performance COP = Q₂/W. The ideal (Carnot) value is T₂/(T₁ − T₂), so it is harder to cool when the temperature difference is large.',
    variables: [['Q₂', 'heat removed from inside (J)'], ['Q₁', 'heat released to the room (J)'], ['W', 'work (electrical energy) input (J)'], ['COP', 'Q₂ / W'], ['T₁, T₂', 'hot and cold temperatures (K)']],
    observe: [
      'The heat dumped into the room is larger than the heat removed from inside.',
      'A freezer has a lower COP than a fridge in the same kitchen.',
      'A hotter room makes the refrigerator work harder.',
    ],
    challenge: 'A freezer at −18 °C in a 30 °C room removes 300 J each second. What minimum electrical power does it need?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0;
    const box = kit.box(2.4, 2.4, 2, C.cold, { opacity: 0.35 });
    box.position.set(-2.5, 1.2, 0);
    kit.label('cold inside', [-2.5, 2.8, 0], { color: C.cold, small: true });
    const room = kit.box(2.4, 2.4, 2, C.hot, { opacity: 0.2 });
    room.position.set(2.5, 1.2, 0);
    kit.label('room', [2.5, 2.8, 0], { color: C.hot, small: true });
    const pump = kit.cylinder(0.6, 0.6, 1, '#64748b', { metalness: 0.5 });
    pump.position.set(0, 1.2, 0);
    const q2 = kit.arrow(C.cold, { label: 'Q₂' });
    const q1 = kit.arrow(C.hot, { label: 'Q₁' });
    const w = kit.arrow(C.force, { label: 'W' });
    const coil = kit.line('#94a3b8', [], { width: 3 });

    const TK = (c: number) => c + 273.15;
    const copIdeal = () => refrigeratorCOP(TK(num(p, 'Th')), TK(num(p, 'Tc')));
    const cop = () => copIdeal() * (num(p, 'frac') / 100);

    function curve() {
      graphs.get('cop').plot(0, -30, 15, (tc) => refrigeratorCOP(TK(num(p, 'Th')), TK(tc)), 100);
      graphs.get('cop').setMarkers([{ x: num(p, 'Tc'), y: copIdeal(), label: 'ideal', color: C.cold }, { x: num(p, 'Tc'), y: cop(), label: 'real', color: C.weight }]);
    }
    curve();

    return {
      setParams(np) { p = np; curve(); },
      reset() { t = 0; },
      step(dt) { t += dt; },
      render() {
        const W = num(p, 'W'), Q2 = cop() * W, Q1 = Q2 + W;
        const sc = 2 / Math.max(Q1, 1);
        q2.set([-1.3, 1.2, 0], [Math.max(0.1, Q2 * sc * 0.5), 0, 0], `Q₂ = ${n(Q2)} W`);
        q1.set([0.6, 1.2, 0], [Math.max(0.1, Q1 * sc * 0.5), 0, 0], `Q₁ = ${n(Q1)} W`);
        w.set([0, 3.2, 0], [0, -Math.max(0.2, W * sc), 0], `W = ${n(W)} W`);
        const pts: [number, number, number][] = [];
        for (let i = 0; i <= 80; i++) { const u = i / 80; pts.push([-3.5 + u * 7, 0.2 + 0.1 * Math.sin(u * 40 - t * 6), 1.1]); }
        coil.setPoints(pts);
        pump.rotation.y = t * 3;
      },
      time: () => t,
      readouts(): Readout[] {
        const W = num(p, 'W');
        return [
          { label: 'Ideal COP T₂/(T₁ − T₂)', value: copIdeal(), tone: 'accent' },
          { label: 'Real COP', value: cop(), tone: 'accent' },
          { label: 'Heat removed per second Q₂', value: cop() * W, unit: 'W' },
          { label: 'Heat released per second Q₁', value: cop() * W + W, unit: 'W' },
          { label: 'Temperature lift T₁ − T₂', value: num(p, 'Th') - num(p, 'Tc'), unit: 'K' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'COP = Q₂ / W' },
          { expr: 'COP_ideal = T₂ / (T₁ − T₂)', sub: `= ${n(TK(num(p, 'Tc')))} / (${n(TK(num(p, 'Th')))} − ${n(TK(num(p, 'Tc')))}) = ${n(copIdeal())}` },
          { expr: 'Q₁ = Q₂ + W' },
        ];
      },
    };
  },
};

export default sim;
