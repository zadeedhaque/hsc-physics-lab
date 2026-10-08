import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useRouteInfo } from '../lib/route';
import { PAPERS, chaptersOf } from '../content/syllabus';
import { topicById, topicsOf, topicPath } from '../content/catalog';
import { isReady } from '../sims/registry';
import { useApp } from '../state/store';
import { t } from '../content/strings';
import { IconChevronRight, IconHome, IconStar } from './icons';

const item = 'press flex items-center gap-2 rounded-lg';

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
    <nav className="px-3 pb-8 pt-4 text-[13.5px]">
      <NavLink to="/" end className={({ isActive }) => `${item} mb-4 px-2.5 py-2 font-semibold ${isActive ? 'bg-accent-soft text-accent' : 'text-fg-2 hover:bg-panel-2 hover:text-fg'}`}>
        <IconHome size={16} /> {t('home')}
      </NavLink>

      {favTopics.length > 0 && (
        <section className="mb-5">
          <h2 className="label mb-1.5 flex items-center gap-1.5 px-2.5">
            <IconStar size={12} filled className="text-warn" /> {t('favorites')}
          </h2>
          <ul className="space-y-px">
            {favTopics.map((tp) => (
              <li key={tp.id}>
                <NavLink to={topicPath(tp)} className={({ isActive }) => `${item} px-2.5 py-1.5 ${isActive ? 'bg-accent-soft font-semibold text-accent' : 'text-fg-2 hover:bg-panel-2 hover:text-fg'}`}>
                  <span className="truncate">{tp.title}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {PAPERS.map((paper) => (
        <section key={paper.id} className="mb-5">
          <Link to={`/physics/${paper.id}`} className="group mb-1.5 flex items-baseline justify-between gap-2 rounded-md px-2.5 py-1">
            <span className="label group-hover:text-fg">{paper.title}</span>
            <span className="text-[11.5px] text-fg-3" lang="bn">{paper.bn.replace('পদার্থবিজ্ঞান ', '')}</span>
          </Link>
          <ul className="space-y-px">
            {chaptersOf(paper.id).map((ch) => {
              const key = `${paper.id}-${ch.number}`;
              const isOpen = !!open[key];
              const topics = topicsOf(paper.id, ch.number);
              const isActiveCh = activePaper === paper.id && activeChapter === ch.number;
              return (
                <li key={key}>
                  <div className={`group flex items-start rounded-lg transition-colors ${isActiveCh && !route.simId ? 'bg-accent-soft' : 'hover:bg-panel-2'}`}>
                    <button
                      type="button"
                      aria-label={`${isOpen ? 'Collapse' : 'Expand'} chapter ${ch.number}`}
                      aria-expanded={isOpen}
                      onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}
                      className="grid h-[34px] w-7 shrink-0 place-items-center text-fg-3 hover:text-fg"
                    >
                      <IconChevronRight size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                    </button>
                    <Link to={`/physics/${paper.id}/chapter/${ch.number}`}
                      className={`flex min-w-0 flex-1 items-baseline gap-2.5 py-[7px] pr-2 leading-snug ${isActiveCh ? 'font-semibold text-fg' : 'text-fg-2 group-hover:text-fg'}`}>
                      <span className={`w-4 shrink-0 text-right font-mono text-[11px] ${isActiveCh ? 'text-accent' : 'text-fg-3'}`}>{ch.number}</span>
                      <span>{ch.title}</span>
                    </Link>
                  </div>
                  {isOpen && (
                    <ul className="mb-2 ml-[33px] mt-0.5 space-y-px border-l border-line">
                      {topics.map((tp) => {
                        const ready = isReady(tp);
                        return (
                          <li key={tp.id}>
                            <NavLink
                              to={topicPath(tp)}
                              className={({ isActive }) => `-ml-px flex items-center gap-2 border-l-2 py-[5px] pl-3 pr-2 text-[13px] leading-snug transition-colors ${isActive ? 'border-accent font-semibold text-accent' : ready ? 'border-transparent text-fg-2 hover:border-line-2 hover:text-fg' : 'border-transparent text-fg-3 hover:text-fg-2'}`}
                            >
                              <span>{tp.title}</span>
                              {!ready && <span className="ml-auto shrink-0 rounded bg-panel-3 px-1 text-[10px] font-medium text-fg-3">{t('soon')}</span>}
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
