import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TOPICS, topicPath, type Topic } from '../content/catalog';
import { getChapter } from '../content/syllabus';
import { isReady } from '../sims/registry';
import { t } from '../content/strings';
import { IconSearch } from './icons';
import { Glyph } from './Glyph';

/** Common abbreviations students type. */
const ALIASES: Record<string, string> = {
  shm: 'simple harmonic motion', emf: 'electromotive', ydse: 'young double slit', kcl: 'kirchhoff', kvl: 'kirchhoff',
  'f=ma': 'newton second law', 'e=mc2': 'mass energy', pv: 'gas', ac: 'alternating', led: 'light-emitting diode',
};

function score(topic: Topic, terms: string[]): number {
  const chapter = getChapter(topic.paper, topic.chapter)?.title ?? '';
  const title = topic.title.toLowerCase();
  const hay = `${title} ${topic.summary} ${topic.tags.join(' ')} ${chapter}`.toLowerCase().replace(/[’']/g, '');
  let s = 0;
  for (const term of terms) {
    if (!hay.includes(term)) return 0;
    s += title.startsWith(term) ? 6 : title.includes(term) ? 4 : topic.tags.some((x) => x.includes(term)) ? 2 : 1;
  }
  return s + (isReady(topic) ? 1 : 0);
}

export function searchTopics(q: string): Topic[] {
  const raw = q.trim().toLowerCase().replace(/[’']/g, '');
  if (!raw) return [];
  const expanded = ALIASES[raw] ?? raw;
  const terms = expanded.split(/\s+/).map((w) => w.replace(/s$/, '')).filter((w) => w.length > 0);
  return TOPICS.map((tp) => [tp, score(tp, terms)] as const)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tp]) => tp);
}

export function SearchBox({ onNavigate }: { onNavigate?: () => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchTopics(q), [q]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (tp: Topic) => {
    nav(topicPath(tp));
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
    onNavigate?.();
  };

  return (
    <div className="relative w-full max-w-xl">
      <label className="sr-only" htmlFor="global-search">Search simulations</label>
      <div className="flex h-9 items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 text-fg-2 transition focus-within:border-accent/60 focus-within:bg-panel">
        <IconSearch size={15} />
        <input
          ref={inputRef}
          id="global-search"
          role="combobox"
          aria-expanded={open && q.length > 0}
          aria-controls="search-results"
          aria-activedescendant={results[active] ? `sr-${results[active].id}` : undefined}
          autoComplete="off"
          value={q}
          placeholder={t('searchPlaceholder')}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter' && results[active]) go(results[active]);
            else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
          }}
          className="min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-fg-3 focus:outline-none"
        />
        <kbd className="hidden rounded border border-line px-1.5 font-mono text-[10px] text-fg-3 sm:block">/</kbd>
      </div>
      {open && q.trim().length > 0 && (
        <ul id="search-results" role="listbox" className="fade-in absolute left-0 right-0 top-11 z-50 max-h-[70vh] overflow-auto rounded-xl border border-line-2 bg-panel p-1.5 shadow-panel">
          {results.length === 0 && <li className="px-3 py-3 text-sm text-fg-3">{t('searchEmpty')} “{q}”.</li>}
          {results.map((tp, i) => {
            const ch = getChapter(tp.paper, tp.chapter);
            const ready = isReady(tp);
            return (
              <li key={tp.id} id={`sr-${tp.id}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(tp)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left ${i === active ? 'bg-accent-soft' : ''}`}
                >
                  <Glyph name={tp.glyph} className="h-8 w-12 shrink-0 rounded-md bg-panel-3 p-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-fg">
                      <span className="truncate">{tp.title}</span>
                      {!ready && <span className="shrink-0 rounded bg-panel-3 px-1.5 py-px text-[10px] font-normal text-fg-3">{t('inDevelopment')}</span>}
                    </span>
                    <span className="block truncate text-xs text-fg-3">
                      {tp.paper === 1 ? '1st' : '2nd'} Paper · Ch {tp.chapter} {ch?.title}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
