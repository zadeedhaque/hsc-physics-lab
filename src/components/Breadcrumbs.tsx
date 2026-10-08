import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { IconChevronRight } from './icons';

/** Breadcrumb trail; the last crumb is the current page and is not a link. */
export function Breadcrumbs({ items, className = '' }: { items: { label: string; to?: string }[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={`flex flex-wrap items-center gap-1 text-[12.5px] font-medium text-fg-3 ${className}`}>
      {items.map((c, i) => (
        <Fragment key={i}>
          {i > 0 && <IconChevronRight size={12} className="shrink-0 opacity-70" />}
          {c.to ? <Link to={c.to} className="rounded transition-colors hover:text-fg">{c.label}</Link> : <span className="text-fg-2" aria-current="page">{c.label}</span>}
        </Fragment>
      ))}
    </nav>
  );
}
