import { useEffect, useState } from 'react';

/**
 * Tiny hash router. Routes are screen names only: no dates, statuses or identifiers
 * ever appear in the URL, so browser history and shared links reveal nothing.
 */
export function currentPath(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h.startsWith('/') ? h : '/';
}

export function navigate(path: string, replace = false): void {
  const url = `#${path}`;
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  window.scrollTo({ top: 0 });
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const on = () => setPath(currentPath());
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', on);
    };
  }, []);
  return path;
}

export function Link(props: { to: string; className?: string; children: React.ReactNode; 'aria-current'?: 'page'; onClick?: () => void }) {
  return (
    <a
      href={`#${props.to}`}
      className={props.className}
      aria-current={props['aria-current']}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        props.onClick?.();
        navigate(props.to);
      }}
    >
      {props.children}
    </a>
  );
}
