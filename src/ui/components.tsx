import { useEffect, useState } from 'react';
import { CONFIDENCE_COPY, diffDays, type Confidence, type Forecast } from '../engine';

const PATHS: Record<string, string> = {
  home: 'M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z',
  calendar: 'M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  plus: 'M12 5v14M5 12h14',
  spark: 'M12 3v4m0 10v4M3 12h4m10 0h4M6.3 6.3l2.8 2.8m5.8 5.8 2.8 2.8m0-11.4-2.8 2.8m-5.8 5.8-2.8 2.8',
  menu: 'M4 7h16M4 12h16M4 17h10',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z',
  shield: 'M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6z',
  book: 'M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4zM5 16a4 4 0 0 1 4-4h9',
  leaf: 'M5 19c8 0 14-6 14-14C11 5 5 11 5 19Zm0 0 7-7',
  chevron: 'm9 6 6 6-6 6',
  back: 'm15 6-6 6 6 6',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zm4 4h4',
  download: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
  upload: 'M12 20V9m0 0-4 4m4-4 4 4M5 4h14',
  trash: 'M5 7h14M10 7V5h4v2m-7 0 1 13h8l1-13',
  info: 'M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  check: 'm5 12 5 5 9-10',
};

export function Icon({ name, size = 22, label }: { name: keyof typeof PATHS | string; size?: number; label?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" role={label ? 'img' : undefined}
      aria-hidden={label ? undefined : true} aria-label={label}
    >
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}

export function Mark({ size = 22 }: { size?: number }) {
  // Ondessa mark: a single wave inside a soft circle.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M6 17c3-4 6-4 10 0s7 4 10 0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Switch(props: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span className="switch">
      <input type="checkbox" role="switch" aria-label={props.label} checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span />
    </span>
  );
}

export function ToggleRow(props: { title: string; detail?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="toggle-row">
      <div>
        <div style={{ fontWeight: 600 }}>{props.title}</div>
        {props.detail && <div className="small muted">{props.detail}</div>}
      </div>
      <Switch checked={props.checked} onChange={props.onChange} label={props.title} />
    </div>
  );
}

export function Segmented<T extends string>(props: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={props.label}>
      {props.options.map((o) => (
        <button key={o.value} type="button" aria-pressed={props.value === o.value} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ConfidenceBadge({ level }: { level: Confidence }) {
  const n = level === 'limited' ? 1 : level === 'developing' ? 2 : 3;
  return (
    <span className={`badge ${level}`} title={CONFIDENCE_COPY[level].detail}>
      <span className="dots" aria-hidden="true">
        {[1, 2, 3].map((i) => <i key={i} className={i <= n ? 'on' : ''} />)}
      </span>
      {CONFIDENCE_COPY[level].label}
    </span>
  );
}

/**
 * The cycle ring: one full predicted cycle around a circle, with logged/expected period
 * days in berry, the estimated fertile window in sage and a marker for today.
 */
export function CycleArc({ f, showFertility }: { f: Forecast; showFertility: boolean }) {
  const size = 280;
  const r = 118;
  const c = size / 2;
  const len = Math.max(f.predictedCycleLength, f.cycleDay ?? 0, 1);
  const circ = 2 * Math.PI * r;
  const seg = (fromDay: number, toDay: number) => {
    const a = Math.max(0, fromDay - 1) / len;
    const b = Math.min(len, toDay) / len;
    return { dasharray: `${Math.max(0, b - a) * circ} ${circ}`, offset: -a * circ };
  };
  const start = f.lastPeriod?.start;
  const dayOf = (d?: string) => (start && d ? diffDays(start, d) + 1 : 0);
  const period = seg(1, f.lastPeriod?.length ?? f.predictedPeriodLength);
  const fertile = f.fertile && showFertility ? seg(dayOf(f.fertile.start), dayOf(f.fertile.end)) : undefined;
  const todayAngle = ((Math.min(f.cycleDay ?? 1, len) - 0.5) / len) * 2 * Math.PI - Math.PI / 2;

  return (
    <svg className="arc" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={f.cycleDay ? `Cycle day ${f.cycleDay} of about ${f.predictedCycleLength}` : 'No cycle logged yet'}>
      <g transform={`rotate(-90 ${c} ${c})`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--line)" strokeWidth="14" />
        {start && <circle cx={c} cy={c} r={r} fill="none" stroke="var(--berry)" strokeWidth="14" strokeLinecap="round" strokeDasharray={period.dasharray} strokeDashoffset={period.offset} />}
        {fertile && <circle className="arc-progress" cx={c} cy={c} r={r} fill="none" stroke="var(--sage)" strokeWidth="14" strokeLinecap="round" strokeDasharray={fertile.dasharray} strokeDashoffset={fertile.offset} />}
      </g>
      {f.cycleDay && (
        <circle cx={c + r * Math.cos(todayAngle)} cy={c + r * Math.sin(todayAngle)} r="11" fill="var(--paper)" stroke="var(--plum)" strokeWidth="3" />
      )}
      <text x={c} y={c - 18} textAnchor="middle" fontSize="15" style={{ fill: 'var(--ink-3)', fontFamily: 'var(--sans)', letterSpacing: '0.12em' }}>
        {f.cycleDay ? 'CYCLE DAY' : 'START HERE'}
      </text>
      <text x={c} y={c + 34} textAnchor="middle" fontSize="64">{f.cycleDay ?? '—'}</text>
    </svg>
  );
}

export function MedicalNote({ children }: { children?: React.ReactNode }) {
  return (
    <p className="tiny faint">
      {children ??
        'Ondessa gives estimates for understanding your body, not medical advice or diagnosis. It cannot confirm ovulation or pregnancy and is not a form of contraception.'}
    </p>
  );
}

export function useToast(): [string | undefined, (msg: string) => void] {
  const [msg, setMsg] = useState<string>();
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(undefined), 2600);
    return () => window.clearTimeout(t);
  }, [msg]);
  return [msg, setMsg];
}

export function Toast({ msg }: { msg?: string }) {
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="stack fade-in" style={{ '--gap': '8px', marginBottom: 20 } as React.CSSProperties}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.6rem)' }}>{title}</h1>
      {children && <p className="muted">{children}</p>}
    </header>
  );
}
