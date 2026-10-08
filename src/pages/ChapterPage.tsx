import { Link, useParams } from 'react-router-dom';
import { CHAPTERS, getChapter, getPaper } from '../content/syllabus';
import { topicsOf } from '../content/catalog';
import { readyLabel } from '../lib/labels';
import { isReady } from '../sims/registry';
import { t } from '../content/strings';
import { TopicCard } from '../components/TopicCard';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { IconArrowLeft, IconArrowRight } from '../components/icons';
import { NotFound } from './NotFound';

export function ChapterPage() {
  const { paper, chapter } = useParams();
  const p = getPaper(Number(paper));
  const ch = getChapter(Number(paper), Number(chapter));
  if (!p || !ch) return <NotFound />;
  const topics = topicsOf(ch.paper, ch.number);
  const sorted = [...topics.filter(isReady), ...topics.filter((x) => !isReady(x))];
  const i = CHAPTERS.indexOf(ch);
  const prev = CHAPTERS[i - 1], next = CHAPTERS[i + 1];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-6 md:px-8 md:pt-8">
      <Breadcrumbs items={[{ label: t('home'), to: '/' }, { label: p.title, to: `/physics/${p.id}` }, { label: `${t('chapter')} ${ch.number}` }]} />
      <header className="mt-5 max-w-3xl">
        <p className="flex flex-wrap items-baseline gap-x-2 text-[15px] font-semibold text-accent">
          <span>{t('chapter')} {ch.number}</span>
          <span className="text-fg-3" aria-hidden="true">·</span>
          <span lang="bn">{ch.bn}</span>
        </p>
        <h1 className="mt-1 text-4xl md:text-5xl">{ch.title}</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-fg-2">{ch.description}</p>
        <p className="mt-3 text-[13px] font-semibold text-fg-3">{readyLabel(topics)}</p>
      </header>
      <div className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((tp) => <TopicCard key={tp.id} topic={tp} />)}
      </div>
      <nav aria-label="Chapters" className="mt-10 grid gap-3 sm:grid-cols-2">
        {prev ? <ChapterLink ch={prev} dir="prev" /> : <span />}
        {next && <ChapterLink ch={next} dir="next" />}
      </nav>
    </div>
  );
}

function ChapterLink({ ch, dir }: { ch: (typeof CHAPTERS)[number]; dir: 'prev' | 'next' }) {
  const paper = getPaper(ch.paper)!;
  return (
    <Link to={`/physics/${ch.paper}/chapter/${ch.number}`}
      className={`press group flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3.5 hover:border-accent/40 ${dir === 'next' ? 'justify-end text-right sm:col-start-2' : ''}`}>
      {dir === 'prev' && <IconArrowLeft size={17} className="shrink-0 text-fg-3 transition-transform group-hover:-translate-x-1 group-hover:text-accent" />}
      <span className="min-w-0">
        <span className="block text-[12px] font-bold text-fg-3">{dir === 'prev' ? 'Previous' : 'Next'} · {paper.title.replace('Physics ', '')}, {t('chapter')} {ch.number}</span>
        <span className="block truncate text-[15px] font-bold text-fg">{ch.title}</span>
      </span>
      {dir === 'next' && <IconArrowRight size={17} className="shrink-0 text-fg-3 transition-transform group-hover:translate-x-1 group-hover:text-accent" />}
    </Link>
  );
}
