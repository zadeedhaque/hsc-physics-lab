import type { LearnBnMap } from './types';

let cache: LearnBnMap | null = null;
let pending: Promise<LearnBnMap> | null = null;

/** Lazy-load the Bangla Learn content the first time a student opens the বাংলা tab. */
export function loadLearnBn(): Promise<LearnBnMap> {
  if (cache) return Promise.resolve(cache);
  pending ??= import('./index').then((m) => (cache = m.LEARN_BN));
  return pending;
}
export const cachedLearnBn = () => cache;
