import type { Topic } from '../content/catalog';
import { isReady } from '../sims/registry';
import { t } from '../content/strings';

/** "8 simulations" when every topic is built, otherwise "5 of 8 simulations ready". */
export function readyLabel(topics: Topic[]) {
  const ready = topics.filter(isReady).length;
  const noun = topics.length === 1 ? 'simulation' : t('simulations');
  return ready === topics.length ? `${topics.length} ${noun}` : `${ready} of ${topics.length} ${noun} ${t('ready')}`;
}
