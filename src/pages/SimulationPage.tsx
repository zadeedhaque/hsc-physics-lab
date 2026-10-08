import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { topicById, topicsOf, topicPath, TOPICS, type Topic } from '../content/catalog';
import { getChapter, getPaper } from '../content/syllabus';
import { isReady, loadSimulation } from '../sims/registry';
import type { SimDefinition } from '../sims/types';
import { actions, useApp } from '../state/store';
import { t } from '../content/strings';
import { SimWorkspace } from '../components/sim/SimWorkspace';
import { Notation } from '../components/sim/MathText';
import { TopicCard } from '../components/TopicCard';
import { IconArrowLeft, IconArrowRight, IconStar } from '../components/icons';
import { Breadcrumbs } from '../components/Breadcrumbs';
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
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-4 py-3.5 md:px-5">
        <div className="min-w-[min(100%,20rem)] flex-1">
          <Breadcrumbs items={[{ label: p.title, to: `/physics/${p.id}` }, { label: `${t('chapter')} ${ch.number} · ${ch.title}`, to: `/physics/${p.id}/chapter/${ch.number}` }, { label: topic.title }]} />
          <div className="mt-1.5 flex items-center gap-1.5">
            <h1 className="text-2xl md:text-[1.75rem]">{topic.title}</h1>
            <button type="button" onClick={() => actions.toggleFavorite(topic.id)} aria-pressed={fav} aria-label={fav ? 'Remove from favorites' : 'Add to favorites'} title={fav ? 'Remove from favorites' : 'Add to favorites'}
              className={`press rounded-lg p-1.5 hover:bg-panel-2 ${fav ? 'text-warn' : 'text-fg-3 hover:text-fg'}`}>
              <IconStar size={19} filled={fav} />
            </button>
          </div>
          <p className="mt-0.5 text-[14.5px] text-fg-2"><Notation text={topic.summary} /></p>
        </div>
        {ready && (prev || next) && (
          <nav aria-label="Previous and next simulation" className="flex w-full items-stretch gap-2 sm:w-auto">
            {prev && <SiblingLink topic={prev} dir="prev" />}
            {next && <SiblingLink topic={next} dir="next" />}
          </nav>
        )}
      </header>

      <div className="min-h-0 flex-1">
        {!ready ? (
          <div className="mx-auto max-w-4xl px-4 py-12">
            <div className="grid-paper rounded-2xl border border-dashed border-line-2 bg-panel px-6 py-10 text-center">
              <p className="text-[12.5px] font-bold text-fg-3">{t('inDevelopment')}</p>
              <h2 className="mt-2 text-xl">{t('notReadyTitle')}</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-fg-2">{t('notReadyBody')}</p>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topicsOf(topic.paper, topic.chapter).filter(isReady).map((x) => <TopicCard key={x.id} topic={x} compact />)}
            </div>
          </div>
        ) : failed ? (
          <div role="alert" className="mx-auto max-w-md px-6 py-16 text-center">
            <p className="text-[15px] font-bold text-bad">This simulation didn’t load.</p>
            <p className="mt-1.5 text-sm text-fg-2">Check your internet connection, then try again.</p>
            <button type="button" onClick={() => window.location.reload()} className="press mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-fg hover:bg-accent-2">Reload</button>
          </div>
        ) : def && def.id === topic.id ? (
          <SimWorkspace key={topic.id} topic={topic} def={def.def} />
        ) : (
          <WorkspaceSkeleton />
        )}
      </div>
    </div>
  );
}

function SiblingLink({ topic, dir }: { topic: Topic; dir: 'prev' | 'next' }) {
  return (
    <Link to={topicPath(topic)} title={topic.title}
      className={`press group flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line px-3 py-1.5 hover:border-accent/40 hover:bg-panel-2 sm:w-[11.5rem] sm:flex-none ${dir === 'next' ? 'justify-end text-right' : ''}`}>
      {dir === 'prev' && <IconArrowLeft size={15} className="shrink-0 text-fg-3 transition-transform group-hover:-translate-x-0.5 group-hover:text-accent" />}
      <span className="min-w-0">
        <span className="block text-[11px] font-bold text-fg-3">{dir === 'prev' ? 'Previous' : 'Next'}</span>
        <span className="block truncate text-[13px] font-semibold text-fg-2 group-hover:text-fg">{topic.title}</span>
      </span>
      {dir === 'next' && <IconArrowRight size={15} className="shrink-0 text-fg-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />}
    </Link>
  );
}

/** Placeholder in the shape of the workspace while the simulation module downloads. */
function WorkspaceSkeleton() {
  return (
    <div className="flex flex-col xl:h-full xl:flex-row" role="status" aria-label={t('loading')}>
      <div className="min-w-0 flex-1 space-y-4 p-3 md:p-4">
        <div className="viewport-bg grid h-[52vh] min-h-[320px] place-items-center rounded-2xl border border-line xl:h-[calc(100vh-25rem)] xl:min-h-[400px]" data-theme="dark">
          <span className="text-sm font-semibold text-fg-3">{t('loading')}</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="skeleton h-[200px] rounded-xl" />
          <div className="skeleton hidden h-[200px] rounded-xl lg:block" />
        </div>
      </div>
      <div className="space-y-3 border-t border-line bg-panel p-3 xl:w-[380px] xl:shrink-0 xl:border-l xl:border-t-0">
        <div className="skeleton h-72 rounded-2xl" />
        <div className="skeleton h-28 rounded-xl" />
        <div className="skeleton h-40 rounded-xl" />
      </div>
    </div>
  );
}
