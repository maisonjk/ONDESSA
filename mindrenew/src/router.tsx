import { useEffect, useState } from 'react';

/** Hash router: works on any static host, supports the back button, zero dependencies. */
export type Route =
  | { name: 'home' } | { name: 'library' } | { name: 'companion' } | { name: 'progress' } | { name: 'settings' }
  | { name: 'renewal'; lieId?: string; journeyId?: string; resume?: boolean } | { name: 'journeys' } | { name: 'onboarding' };

export function parse(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const q = new URLSearchParams(query);
  switch (path) {
    case 'library': return { name: 'library' };
    case 'companion': return { name: 'companion' };
    case 'progress': return { name: 'progress' };
    case 'settings': return { name: 'settings' };
    case 'journeys': return { name: 'journeys' };
    case 'onboarding': return { name: 'onboarding' };
    case 'renewal': return { name: 'renewal', lieId: q.get('lie') ?? undefined, journeyId: q.get('journey') ?? undefined, resume: q.has('resume') };
    default: return { name: 'home' };
  }
}

export function href(r: Route): string {
  if (r.name === 'home') return '#/';
  if (r.name === 'renewal') {
    const q = new URLSearchParams();
    if (r.lieId) q.set('lie', r.lieId);
    if (r.journeyId) q.set('journey', r.journeyId);
    if (r.resume) q.set('resume', '1');
    const s = q.toString();
    return `#/renewal${s ? `?${s}` : ''}`;
  }
  return `#/${r.name}`;
}

export function go(r: Route, replace = false) {
  const h = href(r);
  if (replace) history.replaceState(null, '', h);
  else history.pushState(null, '', h);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  window.scrollTo({ top: 0 });
}

export function back(fallback: Route = { name: 'home' }) {
  if (history.length > 1) history.back();
  else go(fallback, true);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const on = () => setRoute(parse(location.hash));
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', on);
    };
  }, []);
  return route;
}
