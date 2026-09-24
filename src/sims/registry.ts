import type { SimDefinition } from './types';
import { TOPICS, moduleOf, type Topic } from '../content/catalog';

/**
 * Simulation registry. Every folder `src/sims/<module-id>/index.ts` that default-exports a
 * SimDefinition is discovered automatically and code-split into its own chunk, so adding a
 * simulation is: create the folder, then point a catalog topic at it.
 */
const loaders = import.meta.glob<{ default: SimDefinition }>('./*/index.ts');

const byModule = new Map<string, () => Promise<{ default: SimDefinition }>>();
for (const [path, load] of Object.entries(loaders)) {
  const id = path.split('/')[1];
  byModule.set(id, load);
}

export const isReady = (t: Topic) => byModule.has(moduleOf(t));
export const readyTopics = () => TOPICS.filter(isReady);

export async function loadSimulation(t: Topic): Promise<SimDefinition | null> {
  const load = byModule.get(moduleOf(t));
  if (!load) return null;
  return (await load()).default;
}

export const moduleIds = () => [...byModule.keys()];
