import { Link, useParams } from 'react-router-dom';
import { chaptersOf, getPaper, type PaperId } from '../content/syllabus';
import { topicsOf } from '../content/catalog';
import { isReady } from '../sims/registry';
import { t } from '../content/strings';
import { Glyph } from '../components/Glyph';
import { NotFound } from './NotFound';

export function PaperPage() {
  const { paper } = useParams();
  const p = getPaper(Number(paper));
  if (!p) return <NotFound />;
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 md:px-8">
      <nav className="mb-2 text-sm text-fg-3" aria-label="Breadcrumb"><Link to="/" className="hover:text-fg">{t('home')}</Link> / {p.title}</nav>
      <h1 className="text-3xl font-bold tracking-tight text-fg md:text-4xl">{p.title}</h1>
      <p className="text-fg-3">{p.bn}</p>
      <p className="mt-2 max-w-2xl text-fg-2">{p.tagline}</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {chaptersOf(p.id as PaperId).map((ch) => {
          const topics = topicsOf(p.id, ch.number);
          const ready = topics.filter(isReady).length;
          return (
            <Link key={ch.number} to={`/physics/${p.id}/chapter/${ch.number}`} className="group flex gap-4 rounded-xl border border-line bg-panel p-4 transition hover:border-line-2 hover:shadow-panel">
              <div className="grid h-16 w-20 shrink-0 place-items-center rounded-lg bg-panel-2">
                <Glyph name={topics[0]?.glyph ?? 'atom'} className="h-12" />
              </div>
              <div className="min-w-0">
                <p className="font-mono text-xs text-fg-3">{t('chapter')} {ch.number}</p>
                <h2 className="font-semibold leading-snug text-fg group-hover:text-accent">{ch.title}</h2>
                <p className="mt-1 text-xs text-fg-3">{ready}/{topics.length} {t('simulations')} {t('ready')}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
