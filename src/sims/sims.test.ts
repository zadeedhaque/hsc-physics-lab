// @vitest-environment happy-dom
/**
 * Smoke-tests every registered simulation headlessly (no WebGL needed):
 * defaults, every preset, extremes and random parameter sets are stepped and rendered,
 * every action button is pressed, and all readouts / equations / graph data must be free of
 * NaN, Infinity and undefined.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import * as THREE from 'three';
import { SceneKit } from '../engine/kit';
import { GraphHub } from '../engine/graph';
import { defaults, sanitize, type Params, type ParamSpec, type ParamValue, type SimDefinition } from './types';
import { TOPICS, moduleOf } from '../content/catalog';
import { rng } from '../lib/num';
import { flattenMath, parseMath } from '../lib/mathText';

const modules = import.meta.glob<{ default: SimDefinition }>('./*/index.ts', { eager: true });

beforeAll(() => {
  // happy-dom has no 2D canvas; provide a minimal stub for canvas textures.
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: () => unknown };
  proto.getContext = function () {
    return {
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      putImageData() {}, fillRect() {}, clearRect() {}, beginPath() {}, arc() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {},
      fillText() {}, setTransform() {}, save() {}, restore() {}, translate() {}, rotate() {}, rect() {}, clip() {}, setLineDash() {},
      createLinearGradient: () => ({ addColorStop() {} }), measureText: () => ({ width: 10 }),
    };
  };
});

const BAD = /NaN|undefined|Infinity|\[object/;

function paramSets(def: SimDefinition): Params[] {
  const base = defaults(def.params);
  const sets: Params[] = [base];
  for (const pr of def.presets ?? []) sets.push({ ...base, ...pr.values });
  const pick = (s: ParamSpec, mode: 'min' | 'max' | number) => {
    if (s.kind === 'slider') return mode === 'min' ? s.min : mode === 'max' ? s.max : s.min + (s.max - s.min) * mode;
    if (s.kind === 'toggle') return mode === 'min' ? false : mode === 'max' ? true : mode > 0.5;
    if (s.kind === 'select') return s.options[mode === 'min' ? 0 : mode === 'max' ? s.options.length - 1 : Math.floor(mode * s.options.length) % s.options.length].value;
    return s.default;
  };
  sets.push(Object.fromEntries(def.params.map((s) => [s.key, pick(s, 'min')])));
  sets.push(Object.fromEntries(def.params.map((s) => [s.key, pick(s, 'max')])));
  const r = rng(1234);
  for (let i = 0; i < 6; i++) sets.push(Object.fromEntries(def.params.map((s) => [s.key, pick(s, r())])));
  // every select option on its own
  for (const s of def.params) if (s.kind === 'select') for (const o of s.options) sets.push({ ...base, [s.key]: o.value });
  return sets.map((ps) => Object.fromEntries(def.params.map((s) => [s.key, sanitize(s, ps[s.key] ?? s.default)])));
}

function check(where: string, def: SimDefinition, rt: ReturnType<SimDefinition['create']>, graphs: GraphHub) {
  for (const r of rt.readouts()) {
    if (typeof r.value === 'number') expect(Number.isFinite(r.value), `${where}: readout "${r.label}" = ${r.value}`).toBe(true);
    else expect(BAD.test(String(r.value)), `${where}: readout "${r.label}" = ${r.value}`).toBe(false);
    expect(BAD.test(r.label), `${where}: label ${r.label}`).toBe(false);
  }
  for (const e of rt.equations()) {
    expect(BAD.test(`${e.expr} ${e.sub ?? ''} ${e.note ?? ''}`), `${where}: equation ${e.expr} | ${e.sub}`).toBe(false);
  }
  for (const b of graphs.buffers.values()) {
    b.xs.forEach((xs) => xs.forEach((x) => expect(Number.isFinite(x), `${where}: graph ${b.spec.id} x`).toBe(true)));
    b.ys.forEach((ys) => ys.forEach((y) => expect(Number.isFinite(y) || Number.isNaN(y), `${where}: graph ${b.spec.id} y=${y}`).toBe(true)));
    b.markers.forEach((m) => expect(Number.isFinite(m.x) && Number.isFinite(m.y), `${where}: marker`).toBe(true));
  }
  const labels = rt.readouts().map((r) => r.label);
  expect(new Set(labels).size, `${where}: duplicate readout labels ${labels.join(' | ')}`).toBe(labels.length);
  // formulas must survive the fraction formatter unchanged (only their layout changes)
  for (const e of rt.equations()) for (const text of [e.expr, e.sub ?? '']) expect(flattenMath(parseMath(text)), `${where}: ${text}`).toBe(text);
  const exprs = rt.equations().map((e) => e.expr);
  expect(new Set(exprs).size, `${where}: duplicate equations`).toBe(exprs.length);
  const t = rt.time?.();
  if (t !== undefined && t !== null) expect(Number.isFinite(t), `${where}: time`).toBe(true);
  void def;
}

describe('simulation modules', () => {
  const entries = Object.entries(modules);
  it('registry is not empty', () => expect(entries.length).toBeGreaterThan(0));

  for (const [path, mod] of entries) {
    const id = path.split('/')[1];
    it(`${id}: runs cleanly for defaults, presets, extremes and random values`, () => {
      const def = mod.default;
      expect(def.learn.observe.length).toBeGreaterThanOrEqual(2);
      expect(new Set(def.learn.observe).size, `${id}: duplicate observations`).toBe(def.learn.observe.length);
      const syms = def.learn.variables.map((v) => v[0]);
      expect(new Set(syms).size, `${id}: duplicate variable symbols`).toBe(syms.length);
      const keys = def.params.map((q) => q.key);
      expect(new Set(keys).size, `${id}: duplicate param keys`).toBe(keys.length);
      expect(def.params.length).toBeGreaterThan(0);
      for (const ps of paramSets(def)) {
        const kit = new SceneKit(new THREE.PerspectiveCamera());
        const graphs = new GraphHub(def.graphs);
        const where = `${id} ${JSON.stringify(ps)}`;
        let live = { ...ps };
        const setParam = (k: string, v: ParamValue) => {
          const spec = def.params.find((q) => q.key === k);
          expect(spec, `${id}: setParam of unknown key ${k}`).toBeTruthy();
          if (!spec) return;
          live = { ...live, [k]: sanitize(spec, v) };
          rt.setParams(live);
        };
        const rt = def.create({ kit, graphs, params: ps, requestPause: () => {}, setParam });
        rt.render?.();
        check(where, def, rt, graphs);
        // click every pickable object in the scene
        for (const onPick of kit.getPickables().values()) { onPick(); rt.step(1 / 60); rt.render?.(); }
        check(where + ' after picks', def, rt, graphs);
        for (let i = 0; i < 240; i++) {
          rt.step(1 / 120);
          if (i % 12 === 0) rt.render?.();
        }
        check(where + ' after run', def, rt, graphs);
        for (const a of rt.actions?.() ?? []) {
          a.run();
          for (let i = 0; i < 60; i++) rt.step(1 / 60);
          rt.render?.();
          check(where + ` after action ${a.id}`, def, rt, graphs);
        }
        // change every parameter once while running
        for (const s of def.params) {
          const v = s.kind === 'slider' ? (s.min + s.max) / 2 : s.kind === 'toggle' ? !ps[s.key] : s.kind === 'select' ? s.options[s.options.length - 1].value : ps[s.key];
          rt.setParams({ ...ps, [s.key]: sanitize(s, v) });
          rt.step(1 / 60);
          rt.render?.();
        }
        check(where + ' after param sweep', def, rt, graphs);
        rt.reset();
        rt.render?.();
        check(where + ' after reset', def, rt, graphs);
        rt.dispose?.();
        kit.dispose();
      }
    });
  }
});

describe('catalog ↔ registry', () => {
  it('every ready topic’s initial values refer to real parameters', () => {
    for (const tp of TOPICS) {
      const mod = modules[`./${moduleOf(tp)}/index.ts`];
      if (!mod || !tp.initial) continue;
      const keys = new Set(mod.default.params.map((p) => p.key));
      for (const k of Object.keys(tp.initial)) expect(keys.has(k), `${tp.id}: initial key "${k}" not a parameter of ${moduleOf(tp)}`).toBe(true);
    }
  });
  it('topic ids are unique', () => {
    const ids = TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
