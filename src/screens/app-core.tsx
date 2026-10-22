import { useMemo, useState } from 'react';
import { Link, navigate } from '../app/router';
import { useStore } from '../app/store';
import { ARTICLES } from '../content/library';
import {
  addDays, classifyDay, diffDays, formatLong, formatRange, formatShort, monthGrid, monthName, pregnancyStatus,
  upcomingReminders, MOODS, SYMPTOMS,
  type DayLog, type Flow, type ISODate, type Level, type Mucus,
} from '../engine';
import {
  ConfidenceBadge, CycleArc, Icon, Mark, MedicalNote, PageTitle, Toast, useToast,
} from '../ui/components';

const TABS = [
  { to: '/app', label: 'Today', icon: 'home' },
  { to: '/app/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/app/log', label: 'Log', icon: 'plus' },
  { to: '/app/insights', label: 'Patterns', icon: 'spark' },
  { to: '/app/more', label: 'More', icon: 'menu' },
];

export function AppShell({ path, children }: { path: string; children: React.ReactNode }) {
  const { tour, exitTour, today, storageError } = useStore();
  return (
    <div className="app">
      {tour && (
        <div className="tour-banner">
          <div className="wrap">
            <span>Product tour · sample data · nothing is saved</span>
            <button onClick={() => { exitTour(); navigate('/'); }}>Exit tour</button>
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
      <div className="tabbar">
        <nav aria-label="Main">
          {TABS.map((t) => {
            const current = t.to === '/app' ? path === '/app' : path.startsWith(t.to);
            return (
              <Link key={t.to} to={t.to} className={t.icon === 'plus' ? 'log-tab' : undefined} aria-current={current ? 'page' : undefined}>
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
  const { data, forecast: f, insights, today, selectDate } = useStore();
  if (!data || !f) return null;
  if (data.pregnancy) return <PregnancyHome />;

  const showFertility = data.settings.showFertility;
  const next = f.nextPeriod;
  let headline = 'Log your period to begin';
  let sub = 'Tap Log on the day your period starts. Predictions appear right away.';
  if (f.inPeriod) {
    headline = `Period · day ${f.cycleDay}`;
    sub = `Expected to last about ${f.predictedPeriodLength} days.`;
  } else if (next && f.daysPastExpected > 0) {
    headline = `${f.daysPastExpected} day${f.daysPastExpected > 1 ? 's' : ''} past the expected date`;
    sub = `Your period was projected for ${formatShort(next.expected)}. Cycles vary, and stress, illness or travel can shift timing.${data.settings.goal === 'conceive' ? ' If you might be pregnant, a home test is most reliable from now.' : ''}`;
  } else if (next) {
    const days = Math.max(0, diffDays(today, next.expected));
    headline = days === 0 ? 'Period may start today' : `Period expected ${formatRange(next.earliest, next.latest)}`;
    sub = days > 0 ? `About ${days} day${days > 1 ? 's' : ''} away.` : 'It’s within your expected window.';
  }
  const fertileNow = showFertility && f.fertile && today >= f.fertile.start && today <= f.fertile.end;
  const topInsight = insights.find((i) => i.kind !== 'data') ?? insights[0];
  const reminders = upcomingReminders(data, f, today, 21).filter((r) => r.id !== 'daily-log').slice(0, 3);
  const todayLog = data.logs[today];
  const article = ARTICLES.find((a) => a.slug === (data.settings.goal === 'conceive' ? 'ovulation-basics' : data.settings.goal === 'perimenopause' ? 'perimenopause-basics' : 'how-predictions-work'));

  return (
    <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      <section className="card hero-cycle fade-in">
        <CycleArc f={f} showFertility={showFertility} />
        <div className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
          <span className="eyebrow">Today</span>
          <h1 className="status-title">{headline}</h1>
          <p className="muted">{sub}</p>
          <div className="row wrap-row"><ConfidenceBadge level={f.confidence} />{f.irregular && <span className="badge">Wider window: cycles vary</span>}</div>
          {fertileNow && <p className="small" style={{ color: 'var(--sage-ink)' }}>You are in your estimated fertile window{f.ovulation ? `; ovulation estimated around ${formatShort(f.ovulation.expected)}` : ''}.</p>}
          <div className="legend">
            <span><i style={{ background: 'var(--berry)' }} />Period</span>
            {showFertility && <span><i style={{ background: 'var(--sage)' }} />Fertile window (estimate)</span>}
            <span><i style={{ background: 'var(--paper)', boxShadow: 'inset 0 0 0 2px var(--plum)' }} />Today</span>
          </div>
          <details className="small">
            <summary style={{ cursor: 'pointer', color: 'var(--berry-ink)', fontWeight: 600 }}>How is this calculated?</summary>
            <ul className="muted stack" style={{ '--gap': '6px', paddingLeft: 18, marginTop: 8 } as React.CSSProperties}>
              {f.explanation.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </details>
        </div>
      </section>

      <div className="grid-2">
        <section className="card stack" style={{ '--gap': '12px' } as React.CSSProperties}>
          <div className="row between"><h3>Today’s log</h3><button className="btn ghost" onClick={() => { selectDate(today); navigate('/app/log'); }}>Open <Icon name="chevron" size={16} /></button></div>
          <QuickFlow date={today} />
          <p className="small faint">{todayLog ? summarizeLog(todayLog) : 'Nothing logged yet. Everything is optional.'}</p>
        </section>

        {topInsight && (
          <section className="card tint-sage stack" style={{ '--gap': '8px' } as React.CSSProperties}>
            <span className="eyebrow">My Cycle, My Patterns</span>
            <h3>{topInsight.title}</h3>
            <p className="small">{topInsight.body}</p>
            <p className="tiny muted">{topInsight.limitation}</p>
            <Link to="/app/insights" className="btn ghost" >All patterns <Icon name="chevron" size={16} /></Link>
          </section>
        )}

        {reminders.length > 0 && (
          <section className="card stack" style={{ '--gap': '4px' } as React.CSSProperties}>
            <h3 style={{ marginBottom: 6 }}>Coming up</h3>
            {reminders.map((r) => (
              <div key={r.id} className="list-btn" style={{ cursor: 'default' }}>
                <span>{r.title}</span><span className="small faint">{formatShort(r.date)}</span>
              </div>
            ))}
          </section>
        )}

        {showFertility && f.fertile && (
          <Link to="/app/fertility" className="card stack" >
            <span className="eyebrow">Fertility</span>
            <span className="serif" style={{ fontSize: '1.3rem', color: 'var(--ink)' }}>Estimated window {formatRange(f.fertile.start, f.fertile.end)}</span>
            <span className="small muted">An estimate, not a confirmation of ovulation. See details.</span>
          </Link>
        )}

        {article && (
          <Link to={`/app/library/${article.slug}`} className="card stack" >
            <span className="eyebrow">Read</span>
            <span className="serif" style={{ fontSize: '1.2rem', color: 'var(--ink)' }}>{article.title}</span>
            <span className="small muted">{article.minutes} min · {article.summary}</span>
          </Link>
        )}
      </div>
      <MedicalNote />
    </div>
  );
}

function summarizeLog(l: DayLog): string {
  const parts: string[] = [];
  if (l.flow) parts.push(l.flow === 'unspecified' ? 'period' : l.flow === 'spotting' ? 'spotting' : `${l.flow} flow`);
  if (l.symptoms?.length) parts.push(l.symptoms.join(', '));
  if (l.mood) parts.push(l.mood);
  if (l.energy) parts.push(`energy ${l.energy}/5`);
  if (l.note) parts.push('note');
  return parts.length ? `Logged: ${parts.join(' · ')}` : 'Nothing logged yet.';
}

const FLOWS: { v: Flow; label: string }[] = [
  { v: 'spotting', label: 'Spotting' }, { v: 'light', label: 'Light' }, { v: 'medium', label: 'Medium' }, { v: 'heavy', label: 'Heavy' },
];

function QuickFlow({ date }: { date: ISODate }) {
  const { data, setLog } = useStore();
  const log = data?.logs[date] ?? { date };
  return (
    <div className="chips" role="group" aria-label="Flow">
      {FLOWS.map((x) => (
        <button key={x.v} type="button" className="chip berry" aria-pressed={log.flow === x.v} onClick={() => setLog({ ...log, flow: log.flow === x.v ? undefined : x.v })}>{x.label}</button>
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
  const kind = classifyDay(f, data.logs, selectedDate, data.settings.showFertility && !data.pregnancy);
  const kindLabel: Record<string, string> = {
    period: 'Period (logged)', spotting: 'Spotting (logged)', 'predicted-period': 'Predicted period',
    fertile: 'Estimated fertile window', ovulation: 'Estimated ovulation day', none: '',
  };
  const monthPrefix = `${cursor.y}-${String(cursor.m).padStart(2, '0')}`;

  return (
    <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      <section className="card">
        <div className="row between" style={{ marginBottom: 14 }}>
          <button className="btn ghost" aria-label="Previous month" onClick={() => move(-1)}><Icon name="back" /></button>
          <h2 style={{ fontSize: '1.4rem' }} aria-live="polite">{monthName(cursor.m)} {cursor.y}</h2>
          <button className="btn ghost" aria-label="Next month" onClick={() => move(1)}><Icon name="chevron" /></button>
        </div>
        <div className="cal-head" aria-hidden="true">{heads.map((h, i) => <span key={i}>{h}</span>)}</div>
        <div className="cal" role="grid" aria-label={`${monthName(cursor.m)} ${cursor.y}`}>
          {grid.map((d) => {
            const k = classifyDay(f, data.logs, d, data.settings.showFertility && !data.pregnancy);
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
        <div className="legend" style={{ marginTop: 16 }}>
          <span><i style={{ background: 'var(--berry)' }} />Logged period</span>
          <span><i style={{ boxShadow: 'inset 0 0 0 1.5px var(--berry)' }} />Predicted</span>
          {data.settings.showFertility && !data.pregnancy && <span><i style={{ background: 'var(--sage)' }} />Fertile estimate</span>}
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
        {sel ? <p className="small muted">{summarizeLog(sel)}</p> : <p className="small faint">{selectedDate > today ? 'Future dates show estimates only.' : 'Nothing logged.'}</p>}
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
  const { data, setLog, selectedDate, selectDate, today } = useStore();
  const [toast, showToast] = useToast();
  if (!data) return null;
  const date = selectedDate > today ? today : selectedDate;
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
        <LogSection title="Bleeding">
          <div className="chips">
            {FLOWS.map((x) => <button key={x.v} type="button" className="chip berry" aria-pressed={log.flow === x.v} onClick={() => set({ flow: log.flow === x.v ? undefined : x.v })}>{x.label}</button>)}
          </div>
          {log.flow === 'unspecified' && <p className="small faint">Logged as a period day without intensity. Choose one if you like.</p>}
        </LogSection>
      )}

      <LogSection title="Symptoms">
        <div className="chips">
          {SYMPTOMS.filter((x) => s.goal === 'perimenopause' || !['hot flush', 'night sweats'].includes(x) || log.symptoms?.includes(x)).map((x) => {
            const on = !!log.symptoms?.includes(x);
            return <button key={x} type="button" className="chip" aria-pressed={on} onClick={() => set({ symptoms: on ? log.symptoms!.filter((y) => y !== x) : [...(log.symptoms ?? []), x] })}>{x}</button>;
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

      <LogSection title="Mood & energy">
        <div className="chips">
          {MOODS.map((m) => <button key={m} type="button" className="chip" aria-pressed={log.mood === m} onClick={() => set({ mood: log.mood === m ? undefined : m })}>{m}</button>)}
        </div>
        <Scale label="Energy" value={log.energy} onChange={(v) => set({ energy: v })} />
        <Scale label="Sleep quality" value={log.sleep} onChange={(v) => set({ sleep: v })} />
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
          onBlur={(e) => set({ note: e.target.value.trim() || undefined })}
        />
      </LogSection>

      <button className="btn block" onClick={() => { showToast('Saved on this device'); navigate('/app'); }}>Done</button>
      <Toast msg={toast} />
    </div>
  );
}

function LogSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card stack" style={{ '--gap': '12px' } as React.CSSProperties}>
      <div><h3>{title}</h3>{hint && <p className="small faint">{hint}</p>}</div>
      {children}
    </section>
  );
}

function Scale({ label, value, onChange }: { label: string; value?: Level; onChange: (v?: Level) => void }) {
  return (
    <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
      <span className="label">{label}</span>
      <div className="scale" role="group" aria-label={label}>
        {([1, 2, 3, 4, 5] as Level[]).map((n) => (
          <button key={n} type="button" aria-pressed={value === n} aria-label={`${label} ${n} of 5`} onClick={() => onChange(value === n ? undefined : n)}>{n}</button>
        ))}
      </div>
      <div className="row between tiny faint"><span>Low</span><span>High</span></div>
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
