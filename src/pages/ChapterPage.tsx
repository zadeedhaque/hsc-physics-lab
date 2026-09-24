import { Link, useParams } from 'react-router-dom';
import { getChapter, getPaper } from '../content/syllabus';
import { topicsOf } from '../content/catalog';
import { isReady } from '../sims/registry';
import { t } from '../content/strings';
import { TopicCard } from '../components/TopicCard';
import { NotFound } from './NotFound';

export function ChapterPage() {
  const { paper, chapter } = useParams();
  const p = getPaper(Number(paper));
  const ch = getChapter(Number(paper), Number(chapter));
  if (!p || !ch) return <NotFound />;
  const topics = topicsOf(ch.paper, ch.number);
  const sorted = [...topics.filter(isReady), ...topics.filter((x) => !isReady(x))];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 md:px-8">
      <nav className="mb-4 text-sm text-fg-3" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-fg">{t('home')}</Link> / <Link to={`/physics/${p.id}`} className="hover:text-fg">{p.title}</Link> / {t('chapter')} {ch.number}
      </nav>
      <p className="font-mono text-sm text-accent">{t('chapter')} {ch.number}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-fg md:text-4xl">{ch.title}</h1>
      <p className="text-fg-3">{ch.bn}</p>
      <p className="mt-2 max-w-2xl text-fg-2">“{ch.description}”</p>
      <p className="mt-3 text-sm text-fg-3">{topics.filter(isReady).length} of {topics.length} {t('simulations')} {t('ready')}</p>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((tp) => <TopicCard key={tp.id} topic={tp} />)}
      </div>
    </div>
  );
}
