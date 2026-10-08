import { describe, expect, it } from 'vitest';
import { searchTopics } from './search';

const ids = (q: string) => searchTopics(q).map((t) => t.id);

describe('searchTopics', () => {
  it('ranks lens topics above Lenz’s law and skips mid-word stem matches', () => {
    const r = ids('lens');
    expect(r.slice(0, 3).sort()).toEqual(['concave-lens', 'convex-lens', 'lens-combination'].sort());
    expect(r.indexOf('lenz-law')).toBeGreaterThan(2);
    expect(r).not.toContain('solenoid');
    expect(r).not.toContain('mass-energy');
  });
  it('handles plurals and abbreviations', () => {
    expect(ids('projectiles')[0]).toBe('projectile-motion');
    expect(ids('shm').length).toBeGreaterThan(0);
    expect(ids('kirchhoff')[0]).toBe('kirchhoff');
  });
  it('requires every term to match', () => {
    expect(ids('convex lens')[0]).toBe('convex-lens');
    expect(ids('zzzz')).toEqual([]);
  });
});
