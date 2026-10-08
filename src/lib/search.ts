import { TOPICS, type Topic } from '../content/catalog';
import { getChapter } from '../content/syllabus';
import { isReady } from '../sims/registry';

/** Common abbreviations students type. */
const ALIASES: Record<string, string> = {
  shm: 'simple harmonic motion', emf: 'electromotive', ydse: 'young double slit', kcl: 'kirchhoff', kvl: 'kirchhoff',
  'f=ma': 'newton second law', 'e=mc2': 'mass energy', pv: 'gas', ac: 'alternating', led: 'light-emitting diode',
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s: string) => s.toLowerCase().replace(/[’']/g, '');

/** The term as typed, then de-pluralised stems ("waves" → "wave", "gases" → "gas"). */
function forms(term: string) {
  const f = [term];
  if (term.length > 3 && term.endsWith('s')) f.push(term.slice(0, -1));
  if (term.length > 4 && term.endsWith('es')) f.push(term.slice(0, -2));
  return f;
}

/**
 * How well one search term matches a topic (0 = not at all). Word-start matches beat mid-word ones,
 * and the term as typed beats a stem, so "lens" ranks Convex Lens above Lenz's Law and never
 * matches "solenoid" or "equivalence".
 */
function termScore(term: string, title: string, tags: string[], hay: string) {
  let best = 0;
  forms(term).forEach((f, i) => {
    const word = new RegExp(`(^|[^a-z0-9])${escape(f)}`);
    let s = 0;
    if (title.startsWith(f)) s = 6;
    else if (word.test(title)) s = 5;
    else if (tags.some((x) => word.test(x))) s = 2.5;
    else if (word.test(hay)) s = 1.5;
    else if (i === 0 && f.length >= 4 && hay.includes(f)) s = 0.5; // "magnet" inside "electromagnetic"
    best = Math.max(best, i === 0 ? s : s * 0.6);
  });
  return best;
}

function score(topic: Topic, terms: string[]): number {
  const title = norm(topic.title);
  const tags = topic.tags.map(norm);
  const hay = norm(`${topic.title} ${topic.summary} ${topic.tags.join(' ')} ${getChapter(topic.paper, topic.chapter)?.title ?? ''}`);
  let s = 0;
  for (const term of terms) {
    const ts = termScore(term, title, tags, hay);
    if (!ts) return 0;
    s += ts;
  }
  return s + (isReady(topic) ? 1 : 0);
}

export function searchTopics(q: string, limit = 10): Topic[] {
  const raw = norm(q.trim());
  if (!raw) return [];
  const terms = (ALIASES[raw] ?? raw).split(/\s+/).filter((w) => w.length > 0);
  return TOPICS.map((tp) => [tp, score(tp, terms)] as const)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tp]) => tp);
}
