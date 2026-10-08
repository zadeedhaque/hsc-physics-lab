import { Link, useParams } from 'react-router-dom';
import { PAPERS, chaptersOf, getPaper, type PaperId } from '../content/syllabus';
import { topicsOf } from '../content/catalog';
import { t } from '../content/strings';
import { Glyph } from '../components/Glyph';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { IconArrowRight } from '../components/icons';
import { NotFound } from './NotFound';
import { readyLabel } from '../lib/labels';

export function PaperPage() {
  const { paper } = useParams();
  const p = getPaper(Number(paper));
  if (!p) return <NotFound />;
  const chapters = chaptersOf(p.id as PaperId);
  const all = chapters.flatMap((ch) => topicsOf(p.id, ch.number));
  const other = PAPERS.find((x) => x.id !== p.id);
  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-6 md:px-8 md:pt-8">
      <Breadcrumbs items={[{ label: t('home'), to: '/' }, { label: p.title }]} />
      <header className="mt-5 max-w-3xl">
        <p className="text-[15px] font-semibold text-accent" lang="bn">{p.bn}</p>
        <h1 className="mt-1 text-4xl md:text-5xl">{p.title}</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-fg-2">{p.tagline}</p>
        <p className="mt-3 text-[13px] font-semibold text-fg-3">{chapters.length} chapters · {readyLabel(all)}</p>
      </header>
      <ol className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {chapters.map((ch) => {
          const topics = topicsOf(p.id, ch.number);
          return (
            <li key={ch.number}>
              <Link to={`/physics/${p.id}/chapter/${ch.number}`} className="group flex h-full gap-4 rounded-xl border border-line bg-panel p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lift">
                <div className="grid-paper grid h-[72px] w-[88px] shrink-0 place-items-center rounded-lg border border-line bg-panel-2">
                  <Glyph name={topics[0]?.glyph ?? 'atom'} className="h-12 transition-transform duration-300 group-hover:scale-[1.06]" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="text-[12px] font-bold text-fg-3">{t('chapter')} <span className="tabular">{ch.number}</span></p>
                  <h2 className="text-[15.5px] leading-snug transition-colors group-hover:text-accent">{ch.title}</h2>
                  <p className="text-[13px] text-fg-3" lang="bn">{ch.bn}</p>
                  <p className="mt-auto pt-1.5 text-[12.5px] font-medium text-fg-2">{readyLabel(topics)}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
      {other && (
        <Link to={`/physics/${other.id}`} className="press group mt-10 flex items-center justify-between gap-4 rounded-2xl border border-line bg-panel px-5 py-4 hover:border-accent/40">
          <span>
            <span className="block text-[12px] font-bold text-fg-3">Continue to</span>
            <span className="text-[16px] font-bold text-fg">{other.title}</span>
          </span>
          <IconArrowRight size={18} className="text-fg-3 transition-transform group-hover:translate-x-1 group-hover:text-accent" />
        </Link>
      )}
    </div>
  );
}
