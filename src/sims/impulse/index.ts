import type { Equation, Params, Readout, SimDefinition } from '../types';
import { num, str } from '../types';
import { C } from '../../engine/colors';
import { n, sampler } from '../shared';

type Shape = 'rect' | 'tri' | 'sine';

/** Force at time τ into a pulse of peak F and duration T. */
function force(shape: Shape, F: number, T: number, tau: number) {
  if (tau < 0 || tau > T) return 0;
  if (shape === 'rect') return F;
  if (shape === 'tri') return tau < T / 2 ? (2 * F * tau) / T : (2 * F * (T - tau)) / T;
  return F * Math.sin((Math.PI * tau) / T);
}
const impulseOf = (shape: Shape, F: number, T: number) => (shape === 'rect' ? F * T : shape === 'tri' ? 0.5 * F * T : (2 / Math.PI) * F * T);

const T0 = 1; // the pulse starts at t = 1 s so the approach is visible

const sim: SimDefinition = {
  camera: { position: [0, 3, 11], target: [0, 0.8, 0], aspect: 1.7 },
  hint: 'Impulse is the area under the force–time curve. Same area → same change in momentum, whatever the shape.',
  params: [
    { kind: 'select', key: 'shape', label: 'Shape of the force pulse', default: 'sine', options: [{ value: 'rect', label: 'Constant' }, { value: 'tri', label: 'Triangle' }, { value: 'sine', label: 'Smooth (real hit)' }] },
    { kind: 'slider', key: 'F', label: 'Peak force', unit: 'N', min: 10, max: 2000, step: 10, default: 600 },
    { kind: 'slider', key: 'T', label: 'Contact time Δt', unit: 'ms', min: 2, max: 300, step: 1, default: 20 },
    { kind: 'slider', key: 'm', label: 'Mass of ball', unit: 'kg', min: 0.05, max: 2, step: 0.01, default: 0.16 },
    { kind: 'slider', key: 'u', label: 'Initial velocity', unit: 'm/s', min: -20, max: 20, step: 0.5, default: -10 },
  ],
  presets: [
    { label: 'Cricket shot', values: { shape: 'sine', F: 1500, T: 5, m: 0.16, u: -30 } },
    { label: 'Soft catch (long Δt)', values: { shape: 'sine', F: 30, T: 200, m: 0.16, u: -12 } },
    { label: 'Hard catch (short Δt)', values: { shape: 'sine', F: 600, T: 10, m: 0.16, u: -12 } },
    { label: 'Constant push', values: { shape: 'rect', F: 50, T: 200, m: 0.5, u: 0 } },
  ],
  graphs: [
    { id: 'Ft', title: 'Force vs time (area = impulse)', x: 't (s)', y: 'F (N)', zeroY: true, series: [{ label: 'F(t)', color: C.force }] },
    { id: 'pt', title: 'Momentum vs time', x: 't (s)', y: 'p (kg·m/s)', zeroY: true, series: [{ label: 'p = mv', color: C.momentum }] },
  ],
  learn: {
    concept: 'Impulse J is force multiplied by the time it acts, or more generally the area under a force–time graph. Impulse equals the change in momentum: J = FΔt = Δp. Spreading the same change of momentum over a longer time reduces the force — the reason for padding, crumple zones and “giving” with a catch.',
    variables: [['J', 'impulse (N·s)'], ['F', 'force (N)'], ['Δt', 'contact time (s)'], ['Δp', 'change in momentum (kg·m/s)'], ['F_avg', 'average force = Δp/Δt']],
    observe: [
      'The momentum changes only while the force acts.',
      'The step in momentum equals the area under the F–t curve.',
      'A soft catch has a long, low force curve; a hard catch a short, high spike — same area.',
    ],
    challenge: 'A 0.16 kg ball arrives at 12 m/s. Choose Δt so that stopping it needs an average force of only 24 N. What is the impulse?',
  },

  create({ kit, graphs, params }) {
    let p: Params = params;
    let t = 0, v = 0, x = 0, finished = false;
    const sample = sampler(1 / 400);
    kit.box(30, 0.2, 3, '#334155').position.y = -0.1;
    const ball = kit.sphere(0.3, '#f87171', { emissive: 0.15 });
    const bat = kit.box(0.25, 1.6, 0.5, '#d6b98c');
    const fArrow = kit.arrow(C.force, { label: 'F', radius: 0.06 });
    const vArrow = kit.arrow(C.velocity, { label: 'v' });

    const shape = () => str(p, 'shape') as Shape;
    const Tsec = () => num(p, 'T') / 1000;
    const J = () => impulseOf(shape(), num(p, 'F'), Tsec());

    function curve() {
      const T = Tsec();
      graphs.get('Ft').plot(0, T0 - 0.3 * T, T0 + 1.3 * T, (tt) => force(shape(), num(p, 'F'), T, tt - T0), 400);
    }
    const reset = () => { t = 0; v = num(p, 'u'); x = 0; finished = false; sample.reset(); curve(); };
    reset();

    return {
      setParams(np) { p = np; graphs.clearLive(); reset(); },
      reset,
      step(dt) {
        if (finished) return;
        // Sub-step so that even a 2 ms pulse is integrated accurately.
        const k = Math.max(1, Math.ceil(dt / (Tsec() / 80)));
        for (let i = 0; i < k; i++) {
          const h = dt / k;
          const F = force(shape(), num(p, 'F'), Tsec(), t + h / 2 - T0);
          v += (F / num(p, 'm')) * h;
          t += h;
        }
        if (t > T0 + Tsec()) x += v * dt;
        if (t > T0 + Tsec() + 1.5) finished = true;
        if (sample.due(t)) graphs.get('pt').push(t, num(p, 'm') * v);
      },
      render() {
        const hitting = t >= T0 && t <= T0 + Tsec();
        const bx = t < T0 ? 0.3 - num(p, 'u') * (T0 - t) * 0.25 : t <= T0 + Tsec() ? 0.3 : 0.3 + x * 0.25;
        ball.position.set(Math.max(-12, Math.min(14, bx)), 0.8, 0);
        bat.position.set(-0.1, 0.8, 0);
        const F = force(shape(), num(p, 'F'), Tsec(), t - T0);
        fArrow.visible = hitting;
        fArrow.set([0.3, 1.6, 0], [0.5 + (F / 2000) * 3, 0, 0], `F = ${n(F)} N`);
        vArrow.set([ball.position.x, 1.35, 0], [Math.max(-3, Math.min(3, v * 0.1)), 0, 0], `v = ${n(v)} m/s`);
      },
      done: () => finished,
      time: () => t,
      readouts(): Readout[] {
        const m = num(p, 'm'), u = num(p, 'u');
        const vf = u + J() / m;
        return [
          { label: 'Impulse J (area under F–t)', value: J(), unit: 'N·s', tone: 'accent' },
          { label: 'Momentum before', value: m * u, unit: 'kg·m/s' },
          { label: 'Momentum after', value: m * vf, unit: 'kg·m/s' },
          { label: 'Change in momentum Δp', value: m * (vf - u), unit: 'kg·m/s', tone: 'accent' },
          { label: 'Final velocity', value: vf, unit: 'm/s' },
          { label: 'Average force J/Δt', value: J() / Tsec(), unit: 'N' },
        ];
      },
      equations(): Equation[] {
        const m = num(p, 'm'), u = num(p, 'u');
        return [
          { expr: 'J = ∫ F dt = F_avg Δt', sub: `J = ${n(J())} N·s` },
          { expr: 'J = Δp = m v − m u', sub: `v = ${n(u)} + ${n(J())}/${n(m)} = ${n(u + J() / m)} m/s` },
          { expr: shape() === 'rect' ? 'Constant: J = F Δt' : shape() === 'tri' ? 'Triangle: J = ½ F_peak Δt' : 'Half-sine: J = (2/π) F_peak Δt' },
        ];
      },
    };
  },
};

export default sim;
