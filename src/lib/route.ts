import { matchPath, useLocation } from 'react-router-dom';

/** Parse paper/chapter/sim from the URL — usable from layout components outside the matched route. */
export function useRouteInfo() {
  const { pathname } = useLocation();
  const m =
    matchPath('/physics/:paper/chapter/:chapter/:simId', pathname) ??
    matchPath('/physics/:paper/chapter/:chapter', pathname) ??
    matchPath('/physics/:paper', pathname);
  const p = (m?.params ?? {}) as { paper?: string; chapter?: string; simId?: string };
  return { paper: Number(p.paper) || 0, chapter: Number(p.chapter) || 0, simId: p.simId };
}
