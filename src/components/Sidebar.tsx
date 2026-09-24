import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useRouteInfo } from '../lib/route';
import { PAPERS, chaptersOf } from '../content/syllabus';
import { topicById, topicsOf, topicPath } from '../content/catalog';
import { isReady } from '../sims/registry';
import { useApp } from '../state/store';
import { t } from '../content/strings';
import { IconChevronRight, IconHome, IconStar } from './icons';

export function Sidebar() {
  const route = useRouteInfo();
  const favorites = useApp((s) => s.favorites);
  const activePaper = route.paper;
  const activeChapter = route.chapter;
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({ [`${activePaper}-${activeChapter}`]: true }));

  useEffect(() => {
    if (activePaper && activeChapter) setOpen((o) => ({ ...o, [`${activePaper}-${activeChapter}`]: true }));
  }, [activePaper, activeChapter]);

  const favTopics = favorites.map(topicById).filter((x) => x !== undefined);

  return (
    <nav className="px-3 py-4 text-sm">
      <NavLink to="/" end className={({ isActive }) => `mb-3 flex items-center gap-2 rounded-lg px-2.5 py-2 ${isActive ? 'bg-accent-soft text-accent' : 'text-fg-2 hover:bg-panel-2 hover:text-fg'}`}>
        <IconHome size={15} /> {t('home')}
      </NavLink>

      {favTopics.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-1 flex items-center gap-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">
            <IconStar size={12} filled className="text-warn" /> {t('favorites')}
          </h2>
          <ul>
            {favTopics.map((tp) => (
              <li key={tp.id}>
                <NavLink to={topicPath(tp)} className={({ isActive }) => `block truncate rounded-md px-2.5 py-1.5 ${isActive ? 'bg-accent-soft text-accent' : 'text-fg-2 hover:bg-panel-2 hover:text-fg'}`}>
                  {tp.title}
                </NavLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {PAPERS.map((paper) => (
        <section key={paper.id} className="mb-4">
          <Link to={`/physics/${paper.id}`} className="mb-1 block px-2.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3 hover:text-fg">
            {paper.title}
          </Link>
          <ul>
            {chaptersOf(paper.id).map((ch) => {
              const key = `${paper.id}-${ch.number}`;
              const isOpen = !!open[key];
              const topics = topicsOf(paper.id, ch.number);
              const isActiveCh = activePaper === paper.id && activeChapter === ch.number;
              return (
                <li key={key}>
                  <div className={`group flex items-center rounded-lg ${isActiveCh && !route.simId ? 'bg-accent-soft' : 'hover:bg-panel-2'}`}>
                    <button
                      type="button"
                      aria-label={`${isOpen ? 'Collapse' : 'Expand'} chapter ${ch.number}`}
                      aria-expanded={isOpen}
                      onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}
                      className="grid h-8 w-7 shrink-0 place-items-center text-fg-3 hover:text-fg"
                    >
                      <IconChevronRight size={14} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </button>
                    <Link to={`/physics/${paper.id}/chapter/${ch.number}`} className={`flex min-w-0 flex-1 items-baseline gap-2 py-1.5 pr-2 ${isActiveCh ? 'text-fg' : 'text-fg-2 group-hover:text-fg'}`}>
                      <span className="w-4 shrink-0 text-right font-mono text-[11px] text-fg-3">{ch.number}</span>
                      <span className="truncate">{ch.title}</span>
                    </Link>
                  </div>
                  {isOpen && (
                    <ul className="mb-1 ml-[22px] border-l border-line pl-2">
                      {topics.map((tp) => {
                        const ready = isReady(tp);
                        return (
                          <li key={tp.id}>
                            <NavLink
                              to={topicPath(tp)}
                              className={({ isActive }) => `flex items-center gap-2 rounded-md px-2 py-1 text-[13px] ${isActive ? 'bg-accent-soft text-accent' : ready ? 'text-fg-2 hover:bg-panel-2 hover:text-fg' : 'text-fg-3 hover:bg-panel-2'}`}
                            >
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ready ? 'bg-good' : 'border border-fg-3'}`} aria-hidden="true" />
                              <span className="truncate">{tp.title}</span>
                              {!ready && <span className="sr-only">({t('inDevelopment')})</span>}
                            </NavLink>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
