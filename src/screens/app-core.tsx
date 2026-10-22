import { useEffect, useMemo, useState } from 'react';
import { Link, navigate } from '../app/router';
import { useStore } from '../app/store';
import { ARTICLES } from '../content/library';
import {
  addDays, classifyDay, commonAroundNow, diffDays, headsUp, phaseOn, upcomingFertileWindow, weekday, PHASE_COPY, formatLong, formatRange, formatShort, monthGrid, monthName, pregnancyStatus,
  upcomingReminders, MOODS, SYMPTOMS,
  type DayLog, type Flow, type ISODate, type Level, type Mucus, type Symptom,
} from '../engine';
import {
  ConfidenceBadge, DotRing, EvidenceStrip, Icon, Mark, MedicalNote, PageTitle, PhasePill, Toast,
} from '../ui/components';

const TABS = [
  { to: '/app', label: 'Today', icon: 'home' },
  { to: '/app/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/app/log', label: 'Log', icon: 'plus' },
  { to: '/app/insights', label: 'Insights', icon: 'spark' },
  { to: '/app/you', label: 'You', icon: 'user' },
];

/** Screens reached from the You tab keep it highlighted. */
const YOU_PATHS = ['/app/you', '/app/more', '/app/settings', '/app/privacy', '/app/membership', '/app/share', '/app/recap', '/app/history', '/app/pregnancy', '/app/fertility', '/app/library'];

/** Section of the log screen to open at, set by the Today tiles. Memory only. */
let pendingLogSection: string | undefined;
export function openLog(section?: string) {
  pendingLogSection = section;
  navigate('/app/log');
}

export function AppShell({ path, children }: { path: string; children: React.ReactNode }) {
  const { tour, exitTour, today, storageError, notice, selectDate } = useStore();
  return (
    <div className="app">
      {tour && (
        <div className="tour-banner">
          <div className="wrap">
            <span>Tour · sample data · nothing is saved</span>
            <span className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
              <button onClick={() => { exitTour(); navigate('/'); }}>Exit</button>
              <button className="primary" onClick={() => { exitTour(); navigate('/start'); }}>Start with my own data</button>
            </span>
          </div>
        </div>
      )}
      <header className="topbar">
        <div className="wrap">
          <Link to="/app" className="wordmark"><Mark /> Ondessa</Link>
          <span className="small faint">{formatLong(today)}</span>
        </div>
      </header>
      {storageError && <div className="wrap" style={{ paddingTop: 12 }}><div className="callout" role="alert">{storageError}</div></div>}
      <main className="wrap main">{children}</main>
      <Toast msg={notice} />
      <div className="tabbar">
        <nav aria-label="Main">
          {TABS.map((t) => {
            const current = t.to === '/app' ? path === '/app' : t.to === '/app/you' ? YOU_PATHS.some((p) => path.startsWith(p)) : path.startsWith(t.to);
            return (
              <Link key={t.to} to={t.to} className={t.icon === 'plus' ? 'log-tab' : undefined} aria-current={current ? 'page' : undefined} onClick={t.icon === 'plus' ? () => selectDate(today) : undefined}>
                <span className={t.icon === 'plus' ? 'plus' : undefined}><Icon name={t.icon} size={t.icon === 'plus' ? 24 : 22} /></span>
                <span>{t.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Home */

export function Home() {
  const { data, forecast: f, insights, today, tour } = useStore();
  if (!data || !f) return null;
  if (data.pregnancy) return <PregnancyHome />;

  const showFertility = data.settings.showFertility;
  const next = f.nextPeriod;
  const late = !!next && f.daysPastExpected > 0;
  const phase = late ? undefined : phaseOn(f, today, showFertility);
  const daysTo = next ? diffDays(today, next.expected) : undefined;

  let big: string | undefined;
  let caption: string;
  let detail: string;
  let pill: string;
  if (!f.lastPeriod) {
    caption = 'Log your period to begin';
    detail = 'Tap Log on the day your period starts. Your first prediction appears right away.';
    pill = 'No cycle logged yet';
  } else if (f.inPeriod) {
    big = String(f.cycleDay);
    caption = 'day of your period';
    detail = `Periods for you usually last about ${f.predictedPeriodLength} days.`;
    pill = 'Period';
  } else if (late) {
    big = String(f.daysPastExpected);
    caption = `day${f.daysPastExpected > 1 ? 's' : ''} past the expected date`;
    detail = `Your period was projected for ${formatShort(next!.expected)}. Cycles vary, and stress, illness or travel can shift timing.${data.settings.goal === 'conceive' ? ' If you might be pregnant, a home test is most reliable from now.' : ''}`;
    pill = 'Past expected date';
  } else if (daysTo !== undefined && daysTo > 0) {
    big = String(daysTo);
    caption = `day${daysTo > 1 ? 's' : ''} until your period`;
    detail = `Expected ${formatRange(next!.earliest, next!.latest)}.`;
    pill = phase ? PHASE_COPY[phase].label : 'Cycle';
  } else {
    caption = 'Your period may start today';
    detail = `It’s within your expected window, ${formatRange(next!.earliest, next!.latest)}.`;
    pill = phase ? PHASE_COPY[phase].label : 'Cycle';
  }

  const heads = headsUp(f, insights, today);
  const topInsight = insights.find((i) => i.kind !== 'data' && (!heads || i.symptom !== heads.symptom)) ?? (heads ? undefined : insights[0]);
  const reminders = upcomingReminders(data, f, today, 21).filter((r) => r.id !== 'daily-log').slice(0, 3);
  const todayLog = data.logs[today];
  const fertileWin = upcomingFertileWindow(f);
  const loggedDays = Object.keys(data.logs).length;
  const backupDue = !tour && loggedDays >= 30 && (!data.lastBackupOn || diffDays(data.lastBackupOn, today) > 90);
  const article = ARTICLES.find((a) => a.slug === (data.settings.goal === 'conceive' ? 'ovulation-basics' : data.settings.goal === 'perimenopause' ? 'perimenopause-basics' : 'how-predictions-work'));

  return (
    <div className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
      <section className={`phase-hero phase-${phase ?? 'none'} fade-in`}>
        <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
          <PhasePill phase={phase}>{pill}</PhasePill>
          <div>
            {big && <div className="big-number" aria-hidden="true">{big}</div>}
            <h1 className="big-caption">{big ? <span className="sr-only">{big} </span> : null}{caption}</h1>
          </div>
          <p className="muted" style={{ maxWidth: '38ch' }}>{detail}</p>
          <div className="row wrap-row" style={{ '--gap': '8px' } as React.CSSProperties}>
            <ConfidenceBadge level={f.confidence} />
            {f.irregular && <span className="badge">Wider window</span>}
          </div>
          <details className="small">
            <summary style={{ cursor: 'pointer', fontWeight: 560 }}>How is this calculated?</summary>
            <ul className="muted stack" style={{ '--gap': '6px', paddingLeft: 18, marginTop: 8 } as React.CSSProperties}>
              {f.explanation.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </details>
        </div>
        <div className="stack" style={{ '--gap': '10px', alignItems: 'center' } as React.CSSProperties}>
          <DotRing f={f} showFertility={showFertility} />
          <div className="legend" style={{ justifyContent: 'center' }}>
            <span><i style={{ background: 'var(--berry)' }} />Period</span>
            <span><i style={{ background: 'var(--apricot)' }} />Follicular</span>
            {showFertility && <span><i style={{ background: 'var(--sage)' }} />Fertile (est.)</span>}
            <span><i style={{ background: 'var(--lavender)' }} />Luteal (est.)</span>
          </div>
        </div>
      </section>

      <WeekStrip />

      {heads && (
        <Link to="/app/insights" className="card plum stack phase-menstrual heads-up" >
          <span className="row between"><span className="eyebrow">Heads up · from your logs</span><Icon name="chevron" size={18} /></span>
          <span className="display" style={{ fontSize: '1.6rem', lineHeight: 1.1 }}>{heads.title}</span>
          <EvidenceStrip hits={heads.hits} total={heads.total} label={`${heads.hits} of your last ${heads.total} cycles`} />
        </Link>
      )}

      <div className="bento">
        {backupDue && (
          <section className="card tint-berry stack span-6" style={{ '--gap': '10px' } as React.CSSProperties}>
            <span className="eyebrow">Keep your history safe</span>
            <h3>{loggedDays} days logged, {data.lastBackupOn ? `last backup ${formatShort(data.lastBackupOn)}` : 'no backup yet'}</h3>
            <p className="small muted">Your data lives only on this device. An encrypted backup is the only way to recover it if you lose your phone.</p>
            <Link to="/app/privacy" className="btn">Create encrypted backup</Link>
          </section>
        )}
        <section className="card stack span-3" style={{ '--gap': '14px' } as React.CSSProperties}>
          <div className="row between">
            <span className="eyebrow">Today’s log</span>
            <span className="tiny faint mono">{formatShort(today).toUpperCase()}</span>
          </div>
          <LogTiles />
          <QuickLog showFlow={showFlowFirst(f, today)} />
          <p className="small faint">{todayLog ? summarizeLog(todayLog, data.settings.temperatureUnit) : 'Nothing logged yet. One tap saves on this device.'}</p>
        </section>

        {topInsight && (
          <Link to="/app/insights" className="card tint-sage stack span-3" >
            <span className="eyebrow" style={{ color: 'var(--sage-ink)' }}>My Cycle, My Patterns</span>
            <h3 style={{ fontSize: '1.35rem' }}>{topInsight.title}</h3>
            <p className="small">{topInsight.body}</p>
            <p className="tiny muted">{topInsight.limitation}</p>
            <span className="small" style={{ fontWeight: 560, marginTop: 'auto' }}>All patterns →</span>
          </Link>
        )}

        {showFertility && fertileWin && (
          <Link to="/app/fertility" className="card stack span-2 phase-fertile" >
            <span className="eyebrow">{fertileWin.projected ? 'Next fertile window · estimate' : 'Fertile window · estimate'}</span>
            <span className="kicker-num">{formatRange(fertileWin.start, fertileWin.end)}</span>
            <span className="small muted">Ovulation estimated around {formatShort(fertileWin.ovulation)}. Not a confirmation.</span>
          </Link>
        )}

        {reminders.length > 0 && (
          <section className="card stack span-2" style={{ '--gap': '6px' } as React.CSSProperties}>
            <span className="eyebrow">Coming up</span>
            {reminders.map((r) => (
              <div key={r.id} className="row between small" style={{ padding: '6px 0' }}>
                <span>{r.title}</span><span className="faint mono tiny" style={{ whiteSpace: 'nowrap' }}>{r.date === today ? 'TODAY' : `REMIND ${formatShort(r.date).toUpperCase()}`}</span>
              </div>
            ))}
          </section>
        )}

        {article && (
          <Link to={`/app/library/${article.slug}`} className="card stack span-2" >
            <span className="eyebrow">Read · {article.minutes} min</span>
            <h3>{article.title}</h3>
            <span className="small muted">{article.summary}</span>
          </Link>
        )}
      </div>
      <MedicalNote />
    </div>
  );
}

/** Four big doors into the log screen, each showing whether that part of today is logged. */
function LogTiles() {
  const { data, today, selectDate } = useStore();
  if (!data) return null;
  const l = data.logs[today];
  const tiles = [
    ...(data.pregnancy ? [] : [{ id: 'log-flow', label: 'Period', icon: 'drop', phase: 'menstrual', done: !!l?.flow }]),
    { id: 'log-symptoms', label: 'Symptoms', icon: 'pulse', phase: 'follicular', done: !!(l?.symptoms?.length || l?.pain !== undefined) },
    { id: 'log-mood', label: 'Mood', icon: 'face', phase: 'luteal', done: !!(l?.mood || l?.energy) },
    { id: 'log-sleep', label: 'Sleep', icon: 'moon', phase: 'fertile', done: !!l?.sleep },
  ];
  return (
    <nav className="log-tiles" aria-label="Log today" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
      {tiles.map((t) => (
        <a key={t.id} href="#/app/log" className={`phase-${t.phase} ${t.done ? 'done' : ''}`} aria-label={`${t.label}${t.done ? ', logged today' : ''}`}
          onClick={(e) => { e.preventDefault(); selectDate(today); openLog(t.id); }}>
          <span className="ico"><Icon name={t.done ? 'check' : t.icon} size={20} /></span>
          <span aria-hidden="true">{t.label}</span>
        </a>
      ))}
    </nav>
  );
}

function WeekStrip() {
  const { data, forecast: f, today, selectDate } = useStore();
  if (!data || !f) return null;
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 3));
  const letters = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <section className="card" style={{ padding: 8 }} aria-label="This week">
      <div className="week-strip">
        {days.map((d) => {
          const logged = data.logs[d]?.flow && data.logs[d]?.flow !== 'spotting';
          const ph = logged ? 'menstrual' : phaseOn(f, d, data.settings.showFertility);
          const future = d > today;
          return (
            <button
              key={d}
              type="button"
              className={`phase-${ph ?? 'none'} ${d === today ? 'is-today' : ''}`}
              aria-current={d === today ? 'date' : undefined}
              onClick={() => { selectDate(d); navigate(future ? '/app/calendar' : '/app/log'); }}
            >
              <span className="wd">{letters[weekday(d)]}</span>{' '}
              <span className="dn">{Number(d.slice(8))}</span>
              <span className="sr-only">, {formatLong(d)}{ph ? `, ${PHASE_COPY[ph].label}${future ? ' (estimate)' : ''}` : ''}</span>
              <span className={`pd ${ph ? (future ? 'predicted' : '') : 'none'}`} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function summarizeLog(l: DayLog, unit: 'C' | 'F' = 'C'): string {
  const parts: string[] = [];
  if (l.flow) parts.push(l.flow === 'unspecified' ? 'period' : l.flow === 'spotting' ? 'spotting' : `${l.flow} flow`);
  if (l.symptoms?.length) parts.push(l.symptoms.join(', '));
  if (l.pain !== undefined) parts.push(`${['no', 'mild', 'moderate', 'severe'][l.pain]} pain`);
  if (l.mood) parts.push(l.mood);
  if (l.energy) parts.push(`energy ${l.energy}/5`);
  if (l.sleep) parts.push(`sleep ${l.sleep}/5`);
  if (l.mucus) parts.push(`${l.mucus === 'eggwhite' ? 'egg-white' : l.mucus} mucus`);
  if (l.lh) parts.push(`LH ${l.lh}`);
  if (l.bbt !== undefined) parts.push(unit === 'C' ? `${l.bbt.toFixed(2)}°C` : `${((l.bbt * 9) / 5 + 32).toFixed(1)}°F`);
  if (l.intercourse) parts.push('intimacy');
  if (l.note) parts.push('note');
  return parts.length ? `Logged: ${parts.join(' · ')}` : 'Nothing logged yet.';
}

/** Flow is the first thing to offer from 2 days before the expected window, during a period, and when late. */
function showFlowFirst(f: NonNullable<ReturnType<typeof useStore>['forecast']>, today: ISODate): boolean {
  if (!f.lastPeriod || f.inPeriod || f.daysPastExpected > 0) return true;
  return !!f.nextPeriod && today >= addDays(f.nextPeriod.earliest, -2);
}

/** One-tap logging for today: flow around periods, otherwise the user's most-logged symptoms and mood. */
function QuickLog({ showFlow }: { showFlow: boolean }) {
  const { data, setLog, today, notify } = useStore();
  if (!data) return null;
  const log = data.logs[today] ?? { date: today };
  if (showFlow) return <QuickFlow date={today} />;
  const counts = new Map<Symptom, number>();
  for (const l of Object.values(data.logs)) for (const x of l.symptoms ?? []) counts.set(x, (counts.get(x) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([x]) => x);
  const symptoms = [...new Set([...top, 'cramps', 'headache', 'bloating', 'fatigue'] as Symptom[])].slice(0, 4);
  const toggle = (x: Symptom) => {
    const on = !!log.symptoms?.includes(x);
    setLog({ ...log, symptoms: on ? log.symptoms!.filter((y) => y !== x) : [...(log.symptoms ?? []), x] });
    notify(on ? 'Removed' : `Logged ${x}`);
  };
  return (
    <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
      <div className="chips" role="group" aria-label="Quick symptoms">
        {symptoms.map((x) => <button key={x} type="button" className="chip" aria-pressed={!!log.symptoms?.includes(x)} onClick={() => toggle(x)}>{x}</button>)}
      </div>
      <div className="chips" role="group" aria-label="Mood">
        {(['calm', 'happy', 'low', 'irritable'] as const).map((m) => (
          <button key={m} type="button" className="chip" aria-pressed={log.mood === m} onClick={() => { setLog({ ...log, mood: log.mood === m ? undefined : m }); notify('Saved on this device'); }}>{m}</button>
        ))}
      </div>
    </div>
  );
}

const FLOWS: { v: Flow; label: string }[] = [
  { v: 'spotting', label: 'Spotting' }, { v: 'light', label: 'Light' }, { v: 'medium', label: 'Medium' }, { v: 'heavy', label: 'Heavy' },
];

function QuickFlow({ date }: { date: ISODate }) {
  const { data, setLog, notify } = useStore();
  const log = data?.logs[date] ?? { date };
  return (
    <div className="chips" role="group" aria-label="Flow">
      {FLOWS.map((x) => (
        <button key={x.v} type="button" className="chip berry" aria-pressed={log.flow === x.v} onClick={() => { setLog({ ...log, flow: log.flow === x.v ? undefined : x.v }); notify(log.flow === x.v ? 'Removed' : 'Saved on this device'); }}>{x.label}</button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Calendar */

export function Calendar() {
  const { data, forecast: f, today, selectedDate, selectDate } = useStore();
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }));
  const grid = useMemo(() => monthGrid(cursor.y, cursor.m, data?.settings.weekStartsOn ?? 1), [cursor, data?.settings.weekStartsOn]);
  if (!data || !f) return null;
  const move = (delta: number) => {
    const m0 = cursor.m - 1 + delta;
    setCursor({ y: cursor.y + Math.floor(m0 / 12), m: ((m0 % 12) + 12) % 12 + 1 });
  };
  const heads = data.settings.weekStartsOn === 1 ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const sel = data.logs[selectedDate];
  // During pregnancy the calendar shows only what was logged, never cycle predictions.
  const kindOf = (d: ISODate) => {
    const k = classifyDay(f, data.logs, d, data.settings.showFertility && !data.pregnancy);
    return data.pregnancy && k !== 'period' && k !== 'spotting' ? 'none' : k;
  };
  const kind = kindOf(selectedDate);
  const kindLabel: Record<string, string> = {
    period: 'Period (logged)', spotting: 'Spotting (logged)', 'predicted-period': 'Predicted period',
    'possible-period': 'Period possible (expected window)', fertile: 'Estimated fertile window', ovulation: 'Estimated ovulation day', none: '',
  };
  const monthPrefix = `${cursor.y}-${String(cursor.m).padStart(2, '0')}`;

  return (
    <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      <section className="card" style={{ padding: 8 }}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <button className="btn ghost" aria-label="Previous month" onClick={() => move(-1)}><Icon name="back" /></button>
          <h2 style={{ fontSize: '1.4rem' }} aria-live="polite">{monthName(cursor.m)} {cursor.y}</h2>
          <button className="btn ghost" aria-label="Next month" onClick={() => move(1)}><Icon name="chevron" /></button>
        </div>
        <div className="cal-head" aria-hidden="true">{heads.map((h, i) => <span key={i}>{h}</span>)}</div>
        <div className="cal" aria-label={`${monthName(cursor.m)} ${cursor.y}`}>
          {grid.map((d) => {
            const k = kindOf(d);
            const l = data.logs[d];
            const hasDetails = !!(l && (l.symptoms?.length || l.mood || l.note || l.lh || l.bbt || l.mucus));
            const cls = ['day', k !== 'none' ? k : '', d.startsWith(monthPrefix) ? '' : 'out', d === today ? 'today' : '', d === selectedDate ? 'selected' : ''].join(' ');
            return (
              <button key={d} type="button" className={cls} onClick={() => selectDate(d)} aria-label={`${formatLong(d)}${kindLabel[k] ? `, ${kindLabel[k]}` : ''}${hasDetails ? ', has notes' : ''}`} aria-pressed={d === selectedDate}>
                {Number(d.slice(8))}
                {hasDetails && <span className="dot" />}
              </button>
            );
          })}
        </div>
        <div className="legend" style={{ marginTop: 16, padding: '0 8px 8px' }}>
          <span><i style={{ background: 'var(--berry)' }} />Logged period</span>
          <span><i style={{ boxShadow: 'inset 0 0 0 1.5px var(--berry)' }} />Most likely</span>
          <span><i style={{ boxShadow: 'inset 0 0 0 1.5px var(--berry)', opacity: 0.45 }} />Possible</span>
          {data.settings.showFertility && !data.pregnancy && <span><i style={{ background: 'var(--sage-soft)', boxShadow: 'inset 0 0 0 1px var(--sage)' }} />Fertile estimate</span>}
          {data.settings.showFertility && !data.pregnancy && <span><i style={{ background: 'var(--sage-ink)' }} />Est. ovulation</span>}
          <span><i style={{ background: 'var(--gold)' }} />Has notes</span>
        </div>
      </section>

      <section className="card stack" style={{ '--gap': '10px' } as React.CSSProperties}>
        <div className="row between">
          <div>
            <h3>{formatLong(selectedDate)}</h3>
            {kindLabel[kind] && <span className="small muted">{kindLabel[kind]}</span>}
          </div>
          {selectedDate <= today && <button className="btn" onClick={() => navigate('/app/log')}>{sel ? 'Edit' : 'Log'}</button>}
        </div>
        {sel ? <p className="small muted">{summarizeLog(sel, data.settings.temperatureUnit)}</p> : <p className="small faint">{selectedDate > today ? 'Future dates show estimates only.' : 'Nothing logged.'}</p>}
        {selectedDate <= today && <QuickFlow date={selectedDate} />}
      </section>
      {f.nextPeriod && !data.pregnancy && (
        <p className="small faint">Predictions further ahead are less certain. Each later cycle’s window widens by a day.</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Log */

const MUCUS: { v: Mucus; label: string }[] = [
  { v: 'dry', label: 'Dry' }, { v: 'sticky', label: 'Sticky' }, { v: 'creamy', label: 'Creamy' }, { v: 'watery', label: 'Watery' }, { v: 'eggwhite', label: 'Egg-white' },
];

export function LogDay() {
  const { data, forecast: f, setLog, selectedDate, selectDate, today, notify: showToast } = useStore();
  useEffect(() => {
    const id = pendingLogSection;
    pendingLogSection = undefined;
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    el.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }, []);
  if (!data) return null;
  const date = selectedDate > today ? today : selectedDate;
  const common = f ? commonAroundNow(f, data.logs, date) : [];
  const usage = new Map<string, number>();
  for (const l of Object.values(data.logs)) for (const x of l.symptoms ?? []) usage.set(x, (usage.get(x) ?? 0) + 1);
  const rank = (x: string) => (common.includes(x as Symptom) ? 1000 - common.indexOf(x as Symptom) : 0) + (usage.get(x) ?? 0);
  const orderedSymptoms = [...SYMPTOMS].sort((a, b) => rank(b) - rank(a) || SYMPTOMS.indexOf(a) - SYMPTOMS.indexOf(b));
  const entryCount = countEntries(data.logs[date]);
  const log: DayLog = data.logs[date] ?? { date };
  const set = (patch: Partial<DayLog>) => setLog({ ...log, ...patch, date });
  const s = data.settings;
  const unit = s.temperatureUnit;
  const shownTemp = log.bbt === undefined ? '' : unit === 'C' ? log.bbt.toFixed(2) : (log.bbt * 9 / 5 + 32).toFixed(2);

  return (
    <div className="stack" style={{ '--gap': '16px', maxWidth: 680 } as React.CSSProperties}>
      <div className="row between">
        <button className="btn ghost" aria-label="Previous day" onClick={() => selectDate(addDays(date, -1))}><Icon name="back" /></button>
        <div className="center">
          <span className="eyebrow">{date === today ? 'Today' : 'Logging for'}</span>
          <h2 style={{ fontSize: '1.4rem' }}>{formatLong(date)}</h2>
        </div>
        <button className="btn ghost" aria-label="Next day" disabled={date >= today} onClick={() => selectDate(addDays(date, 1))}><Icon name="chevron" /></button>
      </div>

      {!data.pregnancy && (
        <LogSection id="log-flow" title="Bleeding">
          <div className="chips">
            {FLOWS.map((x) => <button key={x.v} type="button" className="chip berry" aria-pressed={log.flow === x.v} onClick={() => set({ flow: log.flow === x.v ? undefined : x.v })}>{x.label}</button>)}
          </div>
          {log.flow === 'unspecified' && <p className="small faint">Logged as a period day without intensity. Choose one if you like.</p>}
        </LogSection>
      )}

      <LogSection id="log-symptoms" title="Symptoms" hint={common.length ? 'Ones you often log around this point in your cycle come first.' : undefined}>
        <div className="chips">
          {orderedSymptoms.filter((x) => s.goal === 'perimenopause' || !['hot flush', 'night sweats'].includes(x) || log.symptoms?.includes(x)).map((x) => {
            const on = !!log.symptoms?.includes(x);
            return <button key={x} type="button" className="chip" aria-pressed={on} onClick={() => set({ symptoms: on ? log.symptoms!.filter((y) => y !== x) : [...(log.symptoms ?? []), x] })}>{common.includes(x) && <i className="hint-dot" aria-hidden="true" />}{x}</button>;
          })}
        </div>
        <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
          <span className="label">Pain</span>
          <div className="chips">
            {(['None', 'Mild', 'Moderate', 'Severe'] as const).map((label, i) => (
              <button key={label} type="button" className="chip" aria-pressed={log.pain === i} onClick={() => set({ pain: log.pain === i ? undefined : (i as 0 | 1 | 2 | 3) })}>{label}</button>
            ))}
          </div>
          {log.pain === 3 && <p className="small" style={{ color: 'var(--berry-ink)' }}>Severe or unusual pain is worth discussing with a healthcare professional. Seek urgent care if it is sudden and intense.</p>}
        </div>
      </LogSection>

      <LogSection id="log-mood" title="Mood & energy">
        <div className="chips">
          {MOODS.map((m) => <button key={m} type="button" className="chip" aria-pressed={log.mood === m} onClick={() => set({ mood: log.mood === m ? undefined : m })}>{m}</button>)}
        </div>
        <Scale label="Energy" value={log.energy} onChange={(v) => set({ energy: v })} />
      </LogSection>

      <LogSection id="log-sleep" title="Sleep">
        <Scale label="Sleep quality" value={log.sleep} onChange={(v) => set({ sleep: v })} lowHigh={['Poor', 'Great']} />
      </LogSection>

      {s.fertilitySigns && !data.pregnancy && (
        <LogSection title="Fertility signs" hint="Optional. These refine estimates but never confirm ovulation.">
          <span className="label">Cervical mucus</span>
          <div className="chips">
            {MUCUS.map((m) => <button key={m.v} type="button" className="chip sage" aria-pressed={log.mucus === m.v} onClick={() => set({ mucus: log.mucus === m.v ? undefined : m.v })}>{m.label}</button>)}
          </div>
          <span className="label">LH test</span>
          <div className="chips">
            {(['negative', 'positive'] as const).map((r) => <button key={r} type="button" className="chip sage" aria-pressed={log.lh === r} onClick={() => set({ lh: log.lh === r ? undefined : r })}>{r === 'positive' ? 'Positive' : 'Negative'}</button>)}
          </div>
          <div className="field">
            <label htmlFor="bbt">Basal body temperature (°{unit})</label>
            <input
              id="bbt" key={`${date}-${unit}`} className="input" inputMode="decimal" placeholder={unit === 'C' ? 'e.g. 36.45' : 'e.g. 97.6'} defaultValue={shownTemp}
              onBlur={(e) => {
                const raw = e.target.value.trim().replace(',', '.');
                if (!raw) return set({ bbt: undefined });
                const n = Number(raw);
                const c = unit === 'C' ? n : ((n - 32) * 5) / 9;
                if (Number.isFinite(c) && c >= 34 && c <= 40) set({ bbt: Math.round(c * 100) / 100 });
                else showToast('That temperature looks out of range.');
              }}
            />
          </div>
        </LogSection>
      )}

      {s.intercourseLogging && !data.pregnancy && (
        <LogSection title="Intimacy" hint="Stored only on this device. Turn this off in Settings to hide it.">
          <button type="button" className="chip" aria-pressed={!!log.intercourse} onClick={() => set({ intercourse: log.intercourse ? undefined : true })}>Sex</button>
        </LogSection>
      )}

      <LogSection title="Note">
        <textarea
          key={date} className="input" maxLength={2000} defaultValue={log.note ?? ''} aria-label="Private note" placeholder="Anything you want to remember. Stays on this device."
          onChange={(e) => set({ note: e.target.value.trim() ? e.target.value : undefined })}
        />
      </LogSection>

      <div className="saved-bar">
        <span className="row" style={{ '--gap': '10px' } as React.CSSProperties}>
          <span className="tick" aria-hidden="true"><Icon name="check" size={15} /></span>
          <span className="small" aria-live="polite"><strong>{entryCount ? `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}` : 'Nothing yet'}</strong>{date === today ? ' today' : ''} · saved on this device</span>
        </span>
        <button className="btn" onClick={() => { showToast('Saved on this device'); navigate('/app'); }}>Done</button>
      </div>
    </div>
  );
}

function countEntries(l?: DayLog): number {
  if (!l) return 0;
  const { date: _d, symptoms, ...rest } = l;
  return (symptoms?.length ?? 0) + Object.values(rest).filter((v) => v !== undefined && v !== false && v !== '').length;
}

function LogSection({ id, title, hint, children }: { id?: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card stack" style={{ '--gap': '12px', scrollMarginTop: 16 } as React.CSSProperties}>
      <div><h3>{title}</h3>{hint && <p className="small faint">{hint}</p>}</div>
      {children}
    </section>
  );
}

function Scale({ label, value, onChange, lowHigh = ['Low', 'High'] }: { label: string; value?: Level; onChange: (v?: Level) => void; lowHigh?: [string, string] }) {
  return (
    <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
      <span className="label">{label}</span>
      <div className="scale" role="group" aria-label={label}>
        {([1, 2, 3, 4, 5] as Level[]).map((n) => (
          <button key={n} type="button" aria-pressed={value === n} aria-label={`${label} ${n} of 5`} onClick={() => onChange(value === n ? undefined : n)}>{n}</button>
        ))}
      </div>
      <div className="row between tiny faint"><span>{lowHigh[0]}</span><span>{lowHigh[1]}</span></div>
    </div>
  );
}

/* ------------------------------------------------------------------ Pregnancy home (used by Home) */

function PregnancyHome() {
  const { data, today } = useStore();
  if (!data?.pregnancy) return null;
  const st = pregnancyStatus(data.pregnancy, today, data.settings.cycle.typicalCycleLength);
  return (
    <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      <PageTitle eyebrow="Pregnancy" title={st ? `Week ${st.week}${st.day ? ` + ${st.day}` : ''}` : 'Pregnancy mode'}>
        {st ? `Estimated due date ${formatLong(st.dueDate)}${st.source === 'clinician' ? ' (from your clinician)' : ' (from your last period)'}.` : 'Add a due date or last period date to see your week.'}
      </PageTitle>
      <Link to="/app/pregnancy" className="btn">Open pregnancy calendar</Link>
      <div className="callout">For any medical concern in pregnancy, contact your midwife, doctor or local emergency services. Ondessa cannot assess symptoms.</div>
    </div>
  );
}
