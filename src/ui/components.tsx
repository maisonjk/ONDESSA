import { useEffect, useState } from 'react';
import { CONFIDENCE_COPY, addDays, diffDays, phaseOn, type Confidence, type Forecast, type Phase } from '../engine';

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
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9c1.5-4 4.5-6 8-6s6.5 2 8 6',
  share: 'M12 15V3m0 0L8 7m4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1',
  pulse: 'M3 12h4l2-5 4 10 2-5h6',
  face: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-3.5-6.5c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8M9 9.5h.01M15 9.5h.01',
  people: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 0a3 3 0 1 0 0-6M3 20c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5m1-4.4c2.4.2 4.3 1.6 5 4.4',
  chart: 'M4 20V10m6 10V4m6 16v-7M2 20h20',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v5l3 2',
};

/**
 * Evidence strip: one segment per cycle looked at, filled for each cycle that showed the
 * pattern. The text label carries the same information for screen readers.
 */
export function EvidenceStrip({ hits, total, label }: { hits: number; total: number; label: string }) {
  return (
    <div className="evidence">
      <span className="segs" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => <i key={i} className={i < hits ? 'on' : ''} />)}
      </span>
      <span className="small muted">{label}</span>
    </div>
  );
}

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
      <circle cx="16" cy="16" r="15" fill="currentColor" />
      <path d="M7 17.5c3-5 6-5 9 0s6 5 9 0" fill="none" stroke="var(--paper)" strokeWidth="2.6" strokeLinecap="round" />
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

export function Segmented<T extends string>(props: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; full?: boolean }) {
  return (
    <div className={`segmented${props.full ? ' full' : ''}`} role="group" aria-label={props.label}>
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

const PHASE_VAR: Record<Phase, string> = {
  menstrual: 'var(--berry)', follicular: 'var(--apricot)', fertile: 'var(--sage)', luteal: 'var(--lavender)',
};

/**
 * The dot ring: one dot per day of the predicted cycle, coloured by estimated phase.
 * Days already lived are solid; days ahead are faint; today is enlarged and outlined.
 */
export function DotRing({ f, showFertility, size = 300 }: { f: Forecast; showFertility: boolean; size?: number }) {
  const c = size / 2;
  const r = size / 2 - 22;
  const start = f.lastPeriod?.start;
  const n = Math.max(f.predictedCycleLength, f.cycleDay ?? 0, 1);
  const todayIndex = start ? diffDays(start, f.today) : -1;
  const dotR = Math.max(3.5, Math.min(7, (Math.PI * r) / n - 2.2));
  const label = f.cycleDay
    ? `Cycle day ${f.cycleDay} of about ${f.predictedCycleLength}${f.cycleDay > f.predictedCycleLength ? ', past the expected length' : ''}`
    : 'No cycle logged yet';

  return (
    <svg className="ring" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * 2 * Math.PI - Math.PI / 2;
        const x = c + r * Math.cos(a);
        const y = c + r * Math.sin(a);
        const date = start ? addDays(start, i) : undefined;
        const phase = date ? phaseOn(f, date, showFertility) : undefined;
        const fill = phase ? PHASE_VAR[phase] : 'var(--line)';
        if (i === todayIndex) {
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={dotR + 7} fill="var(--paper)" />
              <circle className="dot-today" cx={x} cy={y} r={dotR + 3} fill={fill} stroke="var(--ink)" strokeWidth="2.5" />
            </g>
          );
        }
        return <circle key={i} cx={x} cy={y} r={dotR} fill={fill} fillOpacity={i < todayIndex || !start ? 1 : 0.32} />;
      })}
      <text x={c} y={c - 34} textAnchor="middle" fontSize="12" style={{ fontFamily: 'var(--mono)', letterSpacing: '0.12em', fill: 'var(--ink-3)' }}>
        {f.cycleDay ? 'CYCLE DAY' : 'NO CYCLE YET'}
      </text>
      <text x={c} y={c + 30} textAnchor="middle" fontSize="76" style={{ fontFamily: 'var(--numeric)', fontWeight: 720, fontStretch: '78%', letterSpacing: '-0.05em' }}>
        {f.cycleDay ?? '—'}
      </text>
      {f.cycleDay && (
        <text x={c} y={c + 56} textAnchor="middle" fontSize="12" style={{ fontFamily: 'var(--mono)', fill: 'var(--ink-3)' }}>
          {`OF ~${f.predictedCycleLength}`}
        </text>
      )}
    </svg>
  );
}

/** Kept for any older import; renders the dot ring. */
export const CycleArc = DotRing;

export function PhasePill({ phase, children }: { phase?: Phase; children: React.ReactNode }) {
  return (
    <span className={`phase-pill phase-${phase ?? 'none'}`}>
      <i aria-hidden="true" />
      {children}
    </span>
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
