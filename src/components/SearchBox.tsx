import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { topicPath, type Topic } from '../content/catalog';
import { searchTopics } from '../lib/search';
import { getChapter } from '../content/syllabus';
import { isReady } from '../sims/registry';
import { t } from '../content/strings';
import { IconSearch } from './icons';
import { Glyph } from './Glyph';

const wide = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(min-width: 768px)') : null;
const subscribeWide = (cb: () => void) => { wide?.addEventListener('change', cb); return () => wide?.removeEventListener('change', cb); };
const isWide = () => wide?.matches ?? true;

export function SearchBox({ onNavigate }: { onNavigate?: () => void }) {
  const roomy = useSyncExternalStore(subscribeWide, isWide, () => true);
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
      <div className="flex h-9 items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 text-fg-3 transition hover:border-line-2 focus-within:border-accent focus-within:bg-panel focus-within:text-fg-2 focus-within:shadow-[0_0_0_3px_var(--accent-soft)]">
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
          placeholder={roomy ? t('searchPlaceholder') : t('searchShort')}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter' && results[active]) go(results[active]);
            else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
          }}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-fg placeholder:font-normal placeholder:text-fg-3 focus:outline-none"
        />
        <kbd className="hidden rounded-md border border-line-2 bg-panel px-1.5 font-mono text-[10.5px] text-fg-3 sm:block">/</kbd>
      </div>
      {open && q.trim().length > 0 && (
        <ul id="search-results" role="listbox" className="fade-in absolute left-0 right-0 top-11 z-50 max-h-[70vh] overflow-auto rounded-xl border border-line-2 bg-panel p-1.5 shadow-lift">
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
                  <Glyph name={tp.glyph} className="grid-paper h-9 w-[54px] shrink-0 rounded-md border border-line bg-panel-2 p-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold text-fg">
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
