import { Link } from 'react-router-dom';
import { t } from '../content/strings';

export function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="font-mono text-sm text-accent">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-fg">{t('notFound')}</h1>
      <Link to="/" className="mt-6 inline-block rounded-lg border border-line-2 px-4 py-2 text-sm hover:bg-panel-2">{t('home')}</Link>
    </div>
  );
}
