import { useEffect, useState, type ReactNode } from 'react';
import { getVerse, TRANSLATION } from '../content/scripture';

/* ---------- icons (inline, 24px, 1.6 stroke) ---------- */
const paths = {
  home: 'M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z',
  library: 'M6 4h9a3 3 0 0 1 3 3v13H8a2 2 0 0 1-2-2zM6 18a2 2 0 0 1 2-2h10',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  chart: 'M5 19V11M12 19V5M19 19v-6',
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5 10 17 19 7',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  flame: 'M12 21c4 0 7-2.7 7-6.5 0-4-3-6-4-9.5-2 2-3 3.5-3 5.5-1-1-2-2-2-4C7 9 5 11.5 5 14.5 5 18.3 8 21 12 21z',
  bookmark: 'M7 4h10v16l-5-3.5L7 20z',
  send: 'M5 12 20 4l-4 16-4-7z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a4 4 0 0 1 4-4h6M18 9v6a4 4 0 0 1-4 4H8',
  plus: 'M12 5v14M5 12h14',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, fill = false }: { name: IconName; size?: number; fill?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--hero)" />
      <path d="M32 14c-5 7-12 11-12 20a12 12 0 0 0 24 0c0-9-7-13-12-20z" fill="none" stroke="var(--gold-2)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M32 30v16" stroke="var(--hero-ink)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- scripture ---------- */
export function ScriptureBlock({ verseId, size = 'md', showContext = false, tag = false }: { verseId: string; size?: 'sm' | 'md' | 'lg'; showContext?: boolean; tag?: boolean }) {
  const v = getVerse(verseId);
  return (
    <figure className="verse-card stack-sm" style={{ margin: 0 }}>
      {tag && <span className="label-tag scripture-tag" style={{ alignSelf: 'flex-start' }}>Scripture · {TRANSLATION}</span>}
      <blockquote className={`scripture ${size === 'md' ? '' : size}`} style={{ margin: 0 }}>{v.text}</blockquote>
      <figcaption className="ref">{v.ref}</figcaption>
      {showContext && <p className="small muted mt-8"><strong style={{ color: 'var(--ink-2)' }}>Context.</strong> {v.context}</p>}
    </figure>
  );
}

/* ---------- sheet ---------- */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        {children}
      </div>
    </div>
  );
}

/* ---------- toast ---------- */
let pushToast: ((m: string) => void) | null = null;
export function toast(message: string) {
  pushToast?.(message);
}
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    pushToast = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 2600);
    };
    return () => {
      pushToast = null;
    };
  }, []);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="toggle" onClick={() => onChange(!checked)} />;
}

export function TopBar({ title, onBack, right }: { title?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="row between" style={{ marginBottom: 20, minHeight: 44 }}>
      {onBack ? <button className="icon-btn plain" onClick={onBack} aria-label="Back"><Icon name="back" /></button> : <span style={{ width: 44 }} />}
      {title && <p className="h3">{title}</p>}
      {right ?? <span style={{ width: 44 }} />}
    </div>
  );
}
