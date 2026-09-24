import { describe, expect, it } from 'vitest';
import { projectile, dragTrajectory, circular } from './kinematics';
import { frictionBlock, collide1D, atwood, incline } from './dynamics';
import { add, cross, dot, angleBetween, mag } from './vectors';
import { springSHM, pendulumPeriod } from './shm';
import { stringModes, doppler } from './waves';
import { coulomb, solveCircuit, parallelPlate, fieldAt } from './electricity';
import { wireField, cyclotronMotion, solenoidField } from './magnetism';
import { thinLens, snell, criticalAngle, fringeWidth, doubleSlitIntensity, malus } from './optics';
import { remaining, decayConstant, bindingEnergy } from './nuclear';
import { photoelectric, transition, lorentz, wienPeak } from './modern';
import { processResult, carnotEfficiency, vrms } from './thermo';
import { orbitalVelocity, escapeVelocity } from './gravitation';
import { sigFigs, vernierReading, dimString, QUANTITIES } from './measurement';
import { transformer } from './induction';
import { gate } from './electronics';
import { Mearth, Rearth } from './constants';

const close = (a: number, b: number, rel = 1e-6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(Math.abs(b) * rel + 1e-12);

describe('kinematics', () => {
  it('45° projectile from ground: R = u²/g, H = u²/4g', () => {
    const p = projectile({ u: 20, angle: Math.PI / 4, h0: 0, g: 9.8 });
    close(p.range, 400 / 9.8);
    close(p.maxHeight, 400 / (4 * 9.8));
    close(p.tFlight, (2 * 20 * Math.sin(Math.PI / 4)) / 9.8);
  });
  it('drag integrator matches analytic when k = 0', () => {
    const d = dragTrajectory({ u: 30, angle: 0.6, h0: 5, g: 9.8 }, 0);
    const a = projectile({ u: 30, angle: 0.6, h0: 5, g: 9.8 });
    close(d.range, a.range, 1e-3);
    close(d.maxHeight, a.maxHeight, 1e-3);
  });
  it('drag reduces range', () => {
    const d = dragTrajectory({ u: 30, angle: 0.6, h0: 0, g: 9.8 }, 0.01);
    expect(d.range).toBeLessThan(projectile({ u: 30, angle: 0.6, h0: 0, g: 9.8 }).range);
  });
  it('circular motion', () => {
    const c = circular(2, 4, 3);
    close(c.ac, 8); close(c.Fc, 24); close(c.omega, 2);
  });
});

describe('dynamics', () => {
  it('static friction holds below μsN', () => {
    const r = frictionBlock({ m: 10, F: 20, muS: 0.5, muK: 0.3, g: 10, v: 0 });
    expect(r.sliding).toBe(false); expect(r.a).toBe(0); close(r.friction, -20);
  });
  it('kinetic friction once sliding', () => {
    const r = frictionBlock({ m: 10, F: 60, muS: 0.5, muK: 0.3, g: 10, v: 0 });
    expect(r.sliding).toBe(true); close(r.a, (60 - 30) / 10);
  });
  it('incline frictionless: a = g sinθ', () => {
    close(incline({ m: 2, angle: Math.PI / 6, muS: 0, muK: 0, g: 9.8, v: 0 }).a, 4.9);
  });
  it('elastic equal masses exchange velocities', () => {
    const r = collide1D(1, 5, 1, 0, 1);
    close(r.v1, 0); close(r.v2, 5); close(r.keAfter, r.keBefore);
  });
  it('perfectly inelastic conserves momentum', () => {
    const r = collide1D(2, 3, 1, -3, 0);
    close(r.v1, r.v2); close(r.pAfter, r.pBefore);
  });
  it('atwood', () => {
    const r = atwood(2, 3, 10);
    close(r.a, 2); close(r.T, 24);
  });
});

describe('vectors', () => {
  it('ops', () => {
    expect(add([1, 2, 3], [1, 1, 1])).toEqual([2, 3, 4]);
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
    close(angleBetween([1, 0, 0], [0, 1, 0]), Math.PI / 2);
    expect(angleBetween([0, 0, 0], [1, 0, 0])).toBe(0);
    close(mag([3, 4, 12]), 13);
  });
});

describe('oscillations & waves', () => {
  it('spring period', () => close(springSHM(1, 4 * Math.PI ** 2).period, 1));
  it('pendulum exact > small-angle', () => {
    const p = pendulumPeriod(1, 9.8, 1);
    expect(p.exact).toBeGreaterThan(p.T0);
    close(pendulumPeriod(1, 9.8, 1e-6).exact, p.T0, 1e-9);
    close(p.exact / p.T0, 1.0663, 1e-3); // known ratio for 57.3°
  });
  it('string harmonics', () => {
    const s = stringModes(100, 0.01, 1, 1);
    close(s.v, 100); close(s.fn, 50);
  });
  it('doppler approaching source raises pitch', () => {
    expect(doppler(500, 340, 0, 20)).toBeGreaterThan(500);
    close(doppler(500, 340, 0, 0), 500);
  });
});

describe('electricity', () => {
  it('coulomb 1 µC at 1 m', () => close(coulomb(1e-6, 1e-6, 1), 8.9875517923e-3));
  it('field of a point charge', () => close(fieldAt([{ q: 1e-9, pos: [0, 0, 0] }], [1, 0, 0], 0)[0], 8.9875517923));
  it('capacitor', () => close(parallelPlate(1, 1e-3, 1, 1).C, 8.8541878128e-9));
  it('series circuit via MNA', () => {
    const s = solveCircuit(3, [
      { kind: 'V', id: 'E', neg: 0, pos: 1, V: 12 },
      { kind: 'R', id: 'R1', a: 1, b: 2, R: 4 },
      { kind: 'R', id: 'R2', a: 2, b: 0, R: 2 },
    ]);
    close(s.current.R1, 2); close(s.current.E, 2); close(s.V[2], 4);
  });
  it('balanced wheatstone bridge gives zero galvanometer current', () => {
    const s = solveCircuit(5, [
      { kind: 'V', id: 'E', neg: 0, pos: 1, V: 6 },
      { kind: 'R', id: 'P', a: 1, b: 2, R: 10 },
      { kind: 'R', id: 'Q', a: 2, b: 0, R: 20 },
      { kind: 'R', id: 'R', a: 1, b: 3, R: 30 },
      { kind: 'R', id: 'S', a: 3, b: 0, R: 60 },
      { kind: 'R', id: 'G', a: 2, b: 3, R: 50 },
      { kind: 'R', id: 'dummy', a: 4, b: 0, R: 1 },
    ]);
    expect(Math.abs(s.current.G)).toBeLessThan(1e-12);
  });
});

describe('magnetism & induction', () => {
  it('wire field 1 A at 1 m = 2e-7 T', () => close(wireField(1, 1), 2e-7, 1e-6));
  it('solenoid', () => close(solenoidField(1000, 1, 1), 1.25663706212e-3));
  it('cyclotron radius', () => close(cyclotronMotion(1, 1, 2, 1, Math.PI / 2).r, 2));
  it('transformer', () => { const t = transformer(100, 50, 230, 10); close(t.Vs, 115); close(t.Ip, t.Is / 2); });
});

describe('optics', () => {
  it('thin lens u = 2f gives v = 2f', () => { const r = thinLens(20, 10); close(r.v, 20); close(r.m, 1); expect(r.real).toBe(true); });
  it('u < f gives virtual', () => expect(thinLens(5, 10).real).toBe(false));
  it('snell & critical angle', () => {
    close(snell(1, 1.5, Math.PI / 6)!, Math.asin(1 / 3));
    expect(snell(1.5, 1, 1.2)).toBeNull();
    close(criticalAngle(1.5, 1)!, Math.asin(1 / 1.5));
  });
  it('double slit', () => {
    close(fringeWidth(500e-9, 1, 1e-3), 5e-4);
    close(doubleSlitIntensity(0, 500e-9, 1, 1e-3, 1e-4), 1);
    expect(doubleSlitIntensity(2.5e-4, 500e-9, 1, 1e-3, 1e-5)).toBeLessThan(1e-3);
  });
  it('malus', () => close(malus(10, Math.PI / 3), 2.5));
});

describe('modern & nuclear', () => {
  it('half-life', () => { close(remaining(1000, 5, 5), 500); close(decayConstant(Math.LN2), 1); });
  it('He-4 binding energy ≈ 28.3 MeV', () => close(bindingEnergy(2, 4, 4.002602).BE, 28.3, 0.01));
  it('photoelectric threshold', () => {
    const r = photoelectric(1e15, 2.3);
    close(r.photonEv, 4.1357, 1e-3); close(r.kMaxEv, 1.8357, 1e-3);
    expect(photoelectric(1e14, 2.3).emits).toBe(false);
  });
  it('H-alpha ≈ 656 nm', () => close(transition(2, 3).lambda, 656.1e-9, 2e-3));
  it('lorentz', () => close(lorentz(0.6 * 299792458).gamma, 1.25));
  it('wien: sun ~ 500 nm', () => close(wienPeak(5778), 501.5e-9, 1e-2));
});

describe('thermo & gravitation', () => {
  it('first law holds for every process', () => {
    for (const p of ['isothermal', 'isobaric', 'adiabatic'] as const) {
      const r = processResult(p, 1, 0.02, 300, 0.04, 1.4);
      close(r.Q, r.dU + r.W);
    }
    close(processResult('adiabatic', 1, 0.02, 300, 0.04, 1.4).Q, 0, 1e-6);
  });
  it('carnot', () => close(carnotEfficiency(500, 300), 0.4));
  it('vrms N2 at 300 K ≈ 517 m/s', () => close(vrms(300, 0.028), 517, 2e-3));
  it('earth escape velocity ≈ 11.2 km/s', () => close(escapeVelocity(Mearth, Rearth), 11186, 2e-3));
  it('LEO orbital velocity ≈ 7.9 km/s', () => close(orbitalVelocity(Mearth, Rearth), 7910, 2e-3));
});

describe('measurement & logic', () => {
  it('sig figs', () => {
    expect(sigFigs('0.00450')).toBe(3);
    expect(sigFigs('1200')).toBe(2);
    expect(sigFigs('1200.')).toBe(4);
    expect(sigFigs('3.040')).toBe(4);
    expect(sigFigs('6.02e23')).toBe(3);
  });
  it('vernier with zero error', () => {
    const r = vernierReading(2.34, 0.1, 10, 0.02);
    close(r.lc, 0.01); close(r.raw, 2.36); close(r.corrected, 2.34);
  });
  it('dimension strings', () => expect(dimString(QUANTITIES.force.dim)).toBe('[M L T⁻²]'));
  it('gates', () => {
    expect(gate('XOR', true, false)).toBe(true);
    expect(gate('NAND', true, true)).toBe(false);
    expect(gate('NOT', true, false)).toBe(false);
  });
});
