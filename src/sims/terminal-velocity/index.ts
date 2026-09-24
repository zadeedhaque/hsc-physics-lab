import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { terminalVelocity, stokesDrag, reynolds } from '../../physics/matter';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

const FLUIDS: Record<string, { name: string; eta: number; rho: number; color: string }> = {
  glycerine: { name: 'Glycerine', eta: 1.41, rho: 1260, color: '#e9d5ff' },
  castor: { name: 'Castor oil', eta: 0.99, rho: 961, color: '#fde68a' },
  honey: { name: 'Honey', eta: 10, rho: 1420, color: '#f59e0b' },
  water: { name: 'Water', eta: 1e-3, rho: 1000, color: '#60a5fa' },
};
const COLUMN = 1.2; // m of fluid
const SC = 6 / COLUMN;

const sim: SimDefinition = {
  camera: { position: [0, 3.2, 10], target: [0, 3.2, 0], aspect: 1.1 },
  hint: 'The sphere speeds up until weight = upthrust + viscous drag; after that it falls at constant (terminal) velocity.',
  params: [
    { kind: 'select', key: 'fluid', label: 'Fluid', default: 'glycerine', options: Object.entries(FLUIDS).map(([value, f]) => ({ value, label: f.name })) },
    { kind: 'slider', key: 'r', label: 'Sphere radius', unit: 'mm', min: 0.5, max: 5, step: 0.1, default: 2 },
    { kind: 'slider', key: 'rho', label: 'Sphere density', unit: 'kg/m³', min: 1300, max: 11000, step: 10, default: 7800 },
  ],
  presets: [
    { label: 'Steel ball in glycerine', values: { fluid: 'glycerine', r: 2, rho: 7800 } },
    { label: 'Lead shot in castor oil', values: { fluid: 'castor', r: 1.5, rho: 11300 } },
    { label: 'Glass bead in honey', values: { fluid: 'honey', r: 3, rho: 2500 } },
    { label: 'Double the radius', values: { r: 4 } },
  ],
  graphs: [
    { id: 'v', title: 'Speed vs time', x: 't (s)', y: 'v (cm/s)', zeroY: true, series: [{ label: 'v', color: C.velocity }, { label: 'terminal v', color: '#94a3b8', dashed: true }] },
    { id: 'F', title: 'Forces vs time', x: 't (s)', y: 'F (mN)', zeroY: true, series: [{ label: 'weight', color: C.weight }, { label: 'upthrust', color: C.normal }, { label: 'viscous drag 6πηrv', color: C.friction }] },
  ],
  learn: {
    concept: 'A sphere moving slowly through a viscous fluid feels a drag given by Stokes’ law, F = 6πηrv. As it falls, the drag grows with its speed until weight = upthrust + drag. It then falls at the terminal velocity v_t = 2r²(ρ − σ)g / 9η. Measuring v_t is how η is found in the laboratory.',
    variables: [['η', 'viscosity of the fluid (Pa·s)'], ['r', 'radius of the sphere (m)'], ['ρ', 'density of the sphere (kg/m³)'], ['σ', 'density of the fluid (kg/m³)'], ['v_t', 'terminal velocity (m/s)']],
    observe: [
      'The drag arrow grows until the forces balance.',
      'Doubling the radius makes the terminal velocity four times larger (v_t ∝ r²).',
      'In water the ball is far too fast for Stokes’ law — look at the Reynolds number.',
    ],
    challenge: 'A 2 mm steel ball falls through glycerine. Predict v_t, then time it between two marks.',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, y = 0, v = 0, done = false; // y = distance fallen (m)
    const sample = sampler(1 / 30);
    const jar = kit.cylinder(1.1, 1.1, COLUMN * SC + 0.4, '#e2e8f0', { opacity: 0.15 }, 48);
    jar.position.y = (COLUMN * SC) / 2;
    const fluidMesh = kit.cylinder(1.05, 1.05, COLUMN * SC, '#e9d5ff', { opacity: 0.35 }, 48);
    fluidMesh.position.y = (COLUMN * SC) / 2;
    const ball = kit.sphere(0.2, '#94a3b8', { metalness: 0.6, roughness: 0.3 });
    const W = kit.arrow(C.weight, { label: 'W', radius: 0.04 });
    const U = kit.arrow(C.normal, { label: 'U', radius: 0.04 });
    const Fd = kit.arrow(C.friction, { label: 'F_v', radius: 0.04 });
    const marks = kit.segments('#94a3b8', { width: 1.2 });
    const flat: number[] = [];
    for (let cm = 0; cm <= 120; cm += 10) { const yy = COLUMN * SC - (cm / 100) * SC; flat.push(1.15, yy, 0, 1.45, yy, 0); }
    marks.setSegments(flat);
    [0, 40, 80, 120].forEach((cm) => kit.label(`${cm} cm`, [2, COLUMN * SC - (cm / 100) * SC, 0], { small: true }));

    const fl = () => FLUIDS[str(p, 'fluid')] ?? FLUIDS.glycerine;
    const r = () => num(p, 'r') / 1000;
    const mass = () => (4 / 3) * Math.PI * r() ** 3 * num(p, 'rho');
    const weight = () => mass() * 9.81;
    const upthrust = () => (4 / 3) * Math.PI * r() ** 3 * fl().rho * 9.81;
    const vt = () => terminalVelocity(r(), num(p, 'rho'), fl().rho, 9.81, fl().eta);

    function reset() {
      t = 0; y = 0; v = 0; done = false; sample.reset();
      const f = fl();
      (fluidMesh.material as { color: { set: (c: string) => void } }).color.set(f.color);
      ball.scale.setScalar(0.4 + num(p, 'r') / 5);
    }
    reset();

    return {
      setParams(np) { p = np; graphs.clearLive(); reset(); },
      reset,
      step(dt) {
        if (done) return;
        // Integrate with a stiff-safe exponential step: dv/dt = (W − U − 6πηrv)/m
        const k = (6 * Math.PI * fl().eta * r()) / mass();
        const vinf = vt();
        v = vinf + (v - vinf) * Math.exp(-k * dt);
        y += v * dt;
        t += dt;
        if (y >= COLUMN - 0.02) { y = COLUMN - 0.02; done = true; }
        if (t > 120) done = true;
        if (sample.due(t) || done) {
          graphs.get('v').push(t, v * 100, vinf * 100);
          graphs.get('F').push(t, weight() * 1000, upthrust() * 1000, stokesDrag(fl().eta, r(), v) * 1000);
        }
      },
      render() {
        const yy = COLUMN * SC - y * SC - 0.2;
        ball.position.set(0, yy, 0);
        const sc = 1.5 / weight();
        W.set([0.45, yy, 0], [0, -weight() * sc, 0], `W = ${n(weight() * 1000)} mN`);
        U.set([-0.45, yy, 0], [0, upthrust() * sc, 0], `U = ${n(upthrust() * 1000)} mN`);
        const d = stokesDrag(fl().eta, r(), v);
        Fd.set([0, yy + 0.3, 0.3], [0, d * sc, 0], `6πηrv = ${n(d * 1000)} mN`);
      },
      done: () => done,
      time: () => t,
      readouts(): Readout[] {
        const Re = reynolds(fl().rho, vt(), 2 * r(), fl().eta);
        return [
          { label: 'Terminal velocity v_t', value: vt() * 100, unit: 'cm/s', tone: 'accent' },
          { label: 'Current speed', value: v * 100, unit: 'cm/s' },
          { label: 'Weight', value: weight() * 1000, unit: 'mN' },
          { label: 'Upthrust', value: upthrust() * 1000, unit: 'mN' },
          { label: 'Viscous drag now', value: stokesDrag(fl().eta, r(), v) * 1000, unit: 'mN' },
          { label: 'Time to fall 1 m at v_t', value: 1 / vt(), unit: 's' },
          { label: 'Reynolds number', value: Re, tone: Re > 1 ? 'warn' : 'good' },
          { label: 'Stokes’ law valid?', value: Re < 1 ? 'Yes (Re < 1)' : 'No — flow is not slow enough', tone: Re < 1 ? 'good' : 'warn' },
        ];
      },
      equations(): Equation[] {
        return [
          { expr: 'F = 6 π η r v   (Stokes’ law)', sub: `at v_t: F = ${n(stokesDrag(fl().eta, r(), vt()) * 1000)} mN` },
          { expr: 'Terminal: W = U + 6πηrv_t' },
          { expr: 'v_t = 2 r² (ρ − σ) g / 9 η', sub: `= 2 × ${n(r())}² × (${n(num(p, 'rho'))} − ${n(fl().rho)}) × 9.81 / (9 × ${n(fl().eta)}) = ${n(vt())} m/s` },
        ];
      },
    };
  },
};

export default sim;
