import { describe, expect, it } from 'vitest';
import { LEARN_BN } from './index';
import type { SimDefinition } from '../../sims/types';

const modules = import.meta.glob<{ default: SimDefinition }>('../../sims/*/index.ts', { eager: true });
const ids = Object.keys(modules).map((p) => p.split('/')[3]);
const BENGALI = /[ঀ-৿]/;

describe('Bangla Learn content', () => {
  it('exists for every simulation and only for real simulations', () => {
    expect(ids.filter((id) => !LEARN_BN[id]), 'missing Bangla').toEqual([]);
    expect(Object.keys(LEARN_BN).filter((id) => !ids.includes(id)), 'unknown ids').toEqual([]);
  });

  for (const id of ids) {
    it(id, () => {
      const bn = LEARN_BN[id];
      if (!bn) return; // reported above
      const en = modules[`../../sims/${id}/index.ts`].default.learn;
      expect(bn.variables.length, 'one Bangla meaning per variable').toBe(en.variables.length);
      expect(bn.observe.length).toBeGreaterThanOrEqual(2);
      expect(new Set(bn.observe).size, 'observations must be unique').toBe(bn.observe.length);
      for (const text of [bn.concept, bn.challenge, ...bn.variables, ...bn.observe]) {
        expect(text.trim().length).toBeGreaterThan(0);
        expect(BENGALI.test(text), `not Bangla: ${text}`).toBe(true);
      }
    });
  }
});
