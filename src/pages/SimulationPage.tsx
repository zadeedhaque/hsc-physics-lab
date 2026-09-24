import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { topicById, topicsOf, topicPath, TOPICS } from '../content/catalog';
import { getChapter, getPaper } from '../content/syllabus';
import { isReady, loadSimulation } from '../sims/registry';
import type { SimDefinition } from '../sims/types';
import { actions, useApp } from '../state/store';
import { t } from '../content/strings';
import { SimWorkspace } from '../components/sim/SimWorkspace';
import { TopicCard } from '../components/TopicCard';
import { IconChevronRight, IconStar } from '../components/icons';
import { NotFound } from './NotFound';

export function SimulationPage() {
  const { paper, chapter, simId } = useParams();
  const topic = simId ? topicById(simId) : undefined;
  const valid = topic && topic.paper === Number(paper) && topic.chapter === Number(chapter);
  const [def, setDef] = useState<{ id: string; def: SimDefinition } | null>(null);
  const [failed, setFailed] = useState(false);
  const fav = useApp((s) => (topic ? s.favorites.includes(topic.id) : false));

  useEffect(() => {
    if (!topic || !valid || !isReady(topic)) return;
    let alive = true;
    setFailed(false);
    actions.visit(topic.id);
    loadSimulation(topic)
      .then((d) => { if (alive && d) setDef({ id: topic.id, def: d }); })
      .catch((e) => { console.error(e); if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [topic, valid]);

  useEffect(() => {
    if (topic) document.title = `${topic.title} — Zadeed's Physics Lab`;
    return () => { document.title = "Zadeed's Physics Lab — HSC"; };
  }, [topic]);

  if (!topic || !valid) return <NotFound />;
  const p = getPaper(topic.paper)!;
  const ch = getChapter(topic.paper, topic.chapter)!;
  const ready = isReady(topic);

  // Prev / next across the whole syllabus (ready topics only)
  const readyList = TOPICS.filter(isReady);
  const idx = readyList.findIndex((x) => x.id === topic.id);
  const prev = idx > 0 ? readyList[idx - 1] : undefined;
  const next = idx >= 0 && idx < readyList.length - 1 ? readyList[idx + 1] : undefined;

  return (
    <div className="flex min-h-full flex-col xl:h-full">
      <header className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-line px-4 py-3 md:px-5">
        <div className="min-w-[min(100%,20rem)] flex-1">
          <nav className="flex flex-wrap items-center gap-1 text-xs text-fg-3" aria-label="Breadcrumb">
            <Link to={`/physics/${p.id}`} className="hover:text-fg">{p.title}</Link>
            <IconChevronRight size={11} />
            <Link to={`/physics/${p.id}/chapter/${ch.number}`} className="hover:text-fg">{t('chapter')} {ch.number}</Link>
            <IconChevronRight size={11} />
            <Link to={`/physics/${p.id}/chapter/${ch.number}`} className="hover:text-fg">{ch.title}</Link>
            <IconChevronRight size={11} />
            <span className="text-fg-2">{topic.title}</span>
          </nav>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">{topic.title}</h1>
            <button type="button" onClick={() => actions.toggleFavorite(topic.id)} aria-pressed={fav} aria-label={fav ? 'Remove from favorites' : 'Add to favorites'} title={fav ? 'Remove from favorites' : 'Add to favorites'}
              className={`rounded-lg p-1.5 transition hover:bg-panel-2 ${fav ? 'text-warn' : 'text-fg-3 hover:text-fg'}`}>
              <IconStar size={18} filled={fav} />
            </button>
          </div>
          <p className="text-sm text-fg-2">{topic.summary}</p>
        </div>
        {ready && (
          <div className="flex w-full items-center gap-2 self-center text-xs sm:w-auto">
            {prev && <Link to={topicPath(prev)} className="min-w-0 flex-1 truncate sm:max-w-[12rem] sm:flex-none rounded-lg border border-line px-2.5 py-1.5 text-fg-2 hover:bg-panel-2 hover:text-fg" title={prev.title}>← {prev.title}</Link>}
            {next && <Link to={topicPath(next)} className="min-w-0 flex-1 truncate text-right sm:max-w-[12rem] sm:flex-none sm:text-left rounded-lg border border-line px-2.5 py-1.5 text-fg-2 hover:bg-panel-2 hover:text-fg" title={next.title}>{next.title} →</Link>}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1">
        {!ready ? (
          <div className="mx-auto max-w-4xl px-4 py-12">
            <div className="rounded-2xl border border-dashed border-line-2 bg-panel px-6 py-10 text-center">
              <p className="font-mono text-xs uppercase tracking-widest text-fg-3">{t('inDevelopment')}</p>
              <h2 className="mt-2 text-xl font-semibold text-fg">{t('notReadyTitle')}</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-fg-2">{t('notReadyBody')}</p>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topicsOf(topic.paper, topic.chapter).filter(isReady).map((x) => <TopicCard key={x.id} topic={x} compact />)}
            </div>
          </div>
        ) : failed ? (
          <p role="alert" className="p-8 text-center text-bad">Failed to load this simulation. Check your connection and reload.</p>
        ) : def && def.id === topic.id ? (
          <SimWorkspace key={topic.id} topic={topic} def={def.def} />
        ) : (
          <div className="grid h-64 place-items-center text-sm text-fg-3" role="status">{t('loading')}</div>
        )}
      </div>
    </div>
  );
}
