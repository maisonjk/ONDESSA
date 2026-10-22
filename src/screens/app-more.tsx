import { useRef, useState } from 'react';
import { Link, navigate } from '../app/router';
import { useStore } from '../app/store';
import { weekNotes } from '../content/library';
import { BackupNeedsPassword, makeBackup, readBackup } from '../data/backup';
import { WrongPassphraseError } from '../data/crypto';
import {
  CONFIDENCE_COPY, RULES, addDays, detectThermalShift, dueDateFromLmp, formatLong, formatRange, formatShort,
  pregnancyStatus, upcomingReminders, type AppData, type Confidence, type Goal,
} from '../engine';
import { ConfidenceBadge, Icon, MedicalNote, PageTitle, Segmented, Toast, ToggleRow, useToast } from '../ui/components';
import { Stepper } from './onboarding';

/* ------------------------------------------------------------------ Fertility */

export function Fertility() {
  const { data, forecast: f, today } = useStore();
  if (!data || !f) return null;
  if (!data.settings.showFertility) {
    return (
      <div className="stack">
        <PageTitle eyebrow="Fertility" title="Fertility estimates are off">Turn them on in Settings if you want to see them.</PageTitle>
        <Link to="/app/settings" className="btn">Open settings</Link>
      </div>
    );
  }
  const cycleLogs = f.lastPeriod
    ? Object.values(data.logs).filter((l) => l.date >= f.lastPeriod!.start && l.date <= today).sort((a, b) => (a.date < b.date ? -1 : 1))
    : [];
  const temps = cycleLogs.filter((l) => l.bbt !== undefined);
  const shift = detectThermalShift(cycleLogs);
  const methodCopy = {
    calendar: 'Calendar estimate from your cycle history',
    lh: 'Refined by your positive LH test',
    bbt: 'Refined by your temperature rise',
  };

  return (
    <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      <PageTitle eyebrow="Fertility & ovulation" title={f.fertile ? `Estimated window ${formatRange(f.fertile.start, f.fertile.end)}` : 'No estimate yet'}>
        {f.fertile ? `Ovulation estimated around ${formatShort(f.ovulation!.expected)}. ${methodCopy[f.ovulation!.method]}.` : 'Log a period to see an estimated fertile window.'}
      </PageTitle>

      <div className="callout">Calendar predictions cannot confirm ovulation, fertility or pregnancy. Ondessa is not a contraceptive and must not be used to avoid pregnancy.</div>

      {f.fertile && f.lastPeriod && (
        <section className="card stack" style={{ '--gap': '14px' } as React.CSSProperties}>
          <div className="row between"><h3>This cycle</h3><ConfidenceBadge level={f.confidence} /></div>
          <FertilityStrip start={f.lastPeriod.start} end={f.nextPeriod!.latest} today={today} f={f} />
          <p className="small muted">
            Most likely: {formatRange(f.fertile.start, f.fertile.end)}. Because your next period could fall anywhere from {formatShort(f.nextPeriod!.earliest)} to {formatShort(f.nextPeriod!.latest)}, and the phase after ovulation varies from {RULES.lutealRange.min} to {RULES.lutealRange.max} days, fertile days could fall anywhere from {formatShort(f.fertile.widestStart)} to {formatShort(f.fertile.widestEnd)}.
          </p>
        </section>
      )}

      {data.settings.fertilitySigns ? (
        <section className="card stack" style={{ '--gap': '12px' } as React.CSSProperties}>
          <h3>Temperature this cycle</h3>
          {temps.length >= 3 ? <TempChart temps={temps.map((t) => ({ date: t.date, c: t.bbt! }))} shift={shift} unit={data.settings.temperatureUnit} /> : <p className="small faint">Log your temperature on waking for a few days to see a chart.</p>}
          {shift && <p className="small">A sustained rise from {formatShort(shift)} suggests ovulation likely happened around {formatShort(addDays(shift, -1))}. This is a sign, not a confirmation.</p>}
          <div className="row wrap-row small muted" style={{ '--gap': '16px' } as React.CSSProperties}>
            <span>LH positives: {cycleLogs.filter((l) => l.lh === 'positive').map((l) => formatShort(l.date)).join(', ') || 'none logged'}</span>
            <span>Egg-white mucus: {cycleLogs.filter((l) => l.mucus === 'eggwhite').map((l) => formatShort(l.date)).join(', ') || 'none logged'}</span>
          </div>
        </section>
      ) : (
        <section className="card tint-sage stack" style={{ '--gap': '8px' } as React.CSSProperties}>
          <h3>Add fertility signs</h3>
          <p className="small">LH tests, temperature and cervical mucus can refine the estimate. Turn on fertility-sign logging in Settings.</p>
        </section>
      )}

      {data.settings.goal === 'conceive' && (
        <section className="card stack" style={{ '--gap': '10px' } as React.CSSProperties}>
          <h3>Pregnancy test reminder</h3>
          <p className="small muted">Home tests are most reliable from the day your period is expected{f.nextPeriod ? ` (${formatShort(f.nextPeriod.expected)})` : ''}. Pick a date and Ondessa will remind you.</p>
          <TestDatePicker suggested={f.nextPeriod?.expected} />
        </section>
      )}
      <Link to="/app/library/timing-for-conception" className="btn secondary">Read: timing for conception</Link>
      <MedicalNote />
    </div>
  );
}

function FertilityStrip({ start, end, today, f }: { start: string; end: string; today: string; f: NonNullable<ReturnType<typeof useStore>['forecast']> }) {
  const days: string[] = [];
  for (let d = start; d <= end && days.length < 60; d = addDays(d, 1)) days.push(d);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${days.length}, 1fr)`, gap: 2 }} role="img" aria-label={`Cycle strip from ${formatShort(start)} to ${formatShort(end)}`}>
      {days.map((d) => {
        const period = d >= f.lastPeriod!.start && d <= f.lastPeriod!.end;
        const core = f.fertile && d >= f.fertile.start && d <= f.fertile.end;
        const wide = f.fertile && d >= f.fertile.widestStart && d <= f.fertile.widestEnd;
        const ov = f.ovulation?.expected === d;
        const bg = period ? 'var(--berry)' : ov ? 'var(--sage-ink)' : core ? 'var(--sage)' : wide ? 'var(--sage-soft)' : 'var(--line)';
        return <span key={d} title={formatShort(d)} style={{ height: d === today ? 34 : 24, alignSelf: 'end', borderRadius: 4, background: bg, outline: d === today ? '2px solid var(--plum)' : undefined }} />;
      })}
    </div>
  );
}

function TempChart({ temps, shift, unit }: { temps: { date: string; c: number }[]; shift?: string; unit: 'C' | 'F' }) {
  const conv = (c: number) => (unit === 'C' ? c : (c * 9) / 5 + 32);
  const vals = temps.map((t) => conv(t.c));
  const min = Math.min(...vals) - 0.1;
  const max = Math.max(...vals) + 0.1;
  const W = 320, H = 120;
  const x = (i: number) => (temps.length === 1 ? W / 2 : (i / (temps.length - 1)) * (W - 20) + 10);
  const y = (v: number) => H - 10 - ((v - min) / (max - min)) * (H - 20);
  const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Temperatures from ${formatShort(temps[0]!.date)} to ${formatShort(temps[temps.length - 1]!.date)}, between ${Math.min(...vals).toFixed(2)} and ${Math.max(...vals).toFixed(2)} degrees`}>
      <polyline points={pts} fill="none" stroke="var(--plum)" strokeWidth="2" strokeLinejoin="round" />
      {vals.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={temps[i]!.date === shift ? 5 : 3} fill={temps[i]!.date >= (shift ?? '9') ? 'var(--sage)' : 'var(--plum)'} />
      ))}
    </svg>
  );
}

function TestDatePicker({ suggested }: { suggested?: string }) {
  const { data, update, today } = useStore();
  const value = data?.settings.reminders.pregnancyTestDate ?? '';
  const setDate = (d?: string) => update((x) => ({ ...x, settings: { ...x.settings, reminders: { ...x.settings.reminders, pregnancyTestDate: d } } }));
  return (
    <div className="row wrap-row">
      <input type="date" className="input" style={{ maxWidth: 200 }} min={today} value={value} aria-label="Pregnancy test reminder date" onChange={(e) => setDate(e.target.value || undefined)} />
      {suggested && suggested >= today && value !== suggested && <button className="btn secondary" onClick={() => setDate(suggested)}>Use {formatShort(suggested)}</button>}
      {value && <button className="btn ghost" onClick={() => setDate(undefined)}>Clear</button>}
    </div>
  );
}

/* ------------------------------------------------------------------ Pregnancy */

export function PregnancyView() {
  const { data, update, today } = useStore();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [lmp, setLmp] = useState('');
  const [due, setDue] = useState('');
  if (!data) return null;
  const p = data.pregnancy;

  if (!p) {
    return (
      <div className="stack" style={{ '--gap': '16px', maxWidth: 640 } as React.CSSProperties}>
        <PageTitle eyebrow="Pregnancy mode" title="Switch to pregnancy mode">Pauses cycle predictions and shows a week-by-week calendar. Your cycle history is kept, and you can switch back anytime.</PageTitle>
        <div className="card stack" style={{ '--gap': '12px' } as React.CSSProperties}>
          <div className="field"><label htmlFor="pdue">Due date from your clinician (most accurate)</label><input id="pdue" className="input" type="date" min={today} value={due} onChange={(e) => setDue(e.target.value)} /></div>
          <div className="field"><label htmlFor="plmp">Or first day of your last period</label><input id="plmp" className="input" type="date" max={today} value={lmp} onChange={(e) => setLmp(e.target.value)} /></div>
          {lmp && !due && <p className="small muted">Estimated due date: {formatLong(dueDateFromLmp(lmp, data.settings.cycle.typicalCycleLength))}</p>}
          <button className="btn" disabled={!lmp && !due} onClick={() => update((d) => ({ ...d, settings: { ...d.settings, goal: 'pregnant' }, pregnancy: { startedOn: today, ...(lmp ? { lmp } : {}), ...(due ? { clinicianDueDate: due } : {}) } }))}>Start pregnancy mode</button>
        </div>
        <MedicalNote>Ondessa is not a substitute for prenatal care. Please contact a midwife or doctor to arrange care.</MedicalNote>
      </div>
    );
  }

  const st = pregnancyStatus(p, today, data.settings.cycle.typicalCycleLength);
  const notes = st ? weekNotes(st.week) : undefined;
  const endPregnancy = () => {
    if (!window.confirm('End pregnancy mode? Your pregnancy details are kept in your history, and cycle tracking resumes.')) return;
    update((d) => ({ ...d, pregnancy: undefined, pastPregnancies: [...d.pastPregnancies, p], settings: { ...d.settings, goal: 'understand' } }));
  };

  return (
    <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      <section className="card plum stack" style={{ '--gap': '12px' } as React.CSSProperties}>
        <span className="eyebrow">Pregnancy · {st ? `Trimester ${st.trimester}` : 'dates needed'}</span>
        <h1 style={{ fontSize: 'clamp(2.2rem, 7vw, 3.2rem)' }}>{st ? `Week ${st.week}${st.day ? ` + ${st.day}` : ''}` : '—'}</h1>
        {st && (
          <>
            <div className="progress" style={{ background: 'color-mix(in oklab, var(--on-plum) 25%, transparent)' }}><i style={{ width: `${st.progress * 100}%`, background: 'var(--on-plum)' }} /></div>
            <p className="small muted">Estimated due date {formatLong(st.dueDate)} · {st.pastDueDate ? 'past the estimated date' : `${st.daysToGo} days to go`} · {st.source === 'clinician' ? 'date from your clinician' : 'estimated from your last period'}</p>
          </>
        )}
      </section>

      <div className="callout"><strong>Medical concerns:</strong> contact your midwife, doctor or local emergency services. Seek help promptly for bleeding, severe pain, fluid leaking, severe headache or vision changes, fever, or reduced baby movements. <Link to="/app/library/pregnancy-when-to-call">When to call</Link></div>

      {notes && (
        <section className="card stack" style={{ '--gap': '10px' } as React.CSSProperties}>
          <div className="row between wrap-row"><h3>{notes.title}</h3><span className="badge limited">Draft · awaiting clinical review</span></div>
          <p className="small"><strong>Baby:</strong> {notes.baby}</p>
          <p className="small"><strong>You:</strong> {notes.you}</p>
          <p className="tiny faint">General information for weeks {notes.from}–{notes.to}. Every pregnancy is different.</p>
        </section>
      )}

      <section className="card stack" style={{ '--gap': '12px' } as React.CSSProperties}>
        <h3>Appointments & reminders</h3>
        {data.appointments.length === 0 && <p className="small faint">No appointments yet.</p>}
        {[...data.appointments].sort((a, b) => (a.date < b.date ? -1 : 1)).map((a) => (
          <div key={a.id} className="list-btn" style={{ cursor: 'default' }}>
            <span><strong>{a.title}</strong><span className="small muted"> · {formatLong(a.date)}</span></span>
            <button className="btn ghost" aria-label={`Remove ${a.title}`} onClick={() => update((d) => ({ ...d, appointments: d.appointments.filter((x) => x.id !== a.id) }))}><Icon name="trash" size={18} /></button>
          </div>
        ))}
        <div className="row wrap-row">
          <input className="input" style={{ flex: '2 1 180px' }} placeholder="e.g. Midwife check-in" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} aria-label="Appointment title" />
          <input className="input" style={{ flex: '1 1 140px' }} type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Appointment date" />
          <button className="btn" disabled={!title.trim() || !date} onClick={() => { update((d) => ({ ...d, appointments: [...d.appointments, { id: crypto.randomUUID(), title: title.trim(), date }] })); setTitle(''); setDate(''); }}>Add</button>
        </div>
      </section>

      <section className="card stack" style={{ '--gap': '10px' } as React.CSSProperties}>
        <h3>Symptom journal</h3>
        <p className="small muted">Log symptoms, mood, sleep and notes any day. They stay private on this device.</p>
        <Link to="/app/log" className="btn secondary">Open today’s journal</Link>
      </section>

      <div className="row wrap-row">
        <Link to="/app/library/due-date-explained" className="btn secondary">How due dates work</Link>
        <button className="btn ghost" onClick={endPregnancy}>End pregnancy mode</button>
      </div>
      <MedicalNote>Ondessa is not a medical device and does not replace prenatal care.</MedicalNote>
    </div>
  );
}

/* ------------------------------------------------------------------ Insights */

export function Insights() {
  const { data, forecast: f, insights } = useStore();
  if (!data || !f) return null;
  const all = f.cycles.slice(-12);
  const maxLen = Math.max(40, ...all.map((c) => c.length));
  const levels: Confidence[] = ['limited', 'developing', 'established'];

  return (
    <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      <PageTitle eyebrow="My Cycle, My Patterns" title="What your logs show">Every observation below comes only from what you logged, says what it’s based on, and never claims a cause.</PageTitle>

      <section className="card stack" style={{ '--gap': '12px' } as React.CSSProperties}>
        <div className="row between wrap-row"><h3>Prediction confidence</h3><ConfidenceBadge level={f.confidence} /></div>
        <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
          {levels.map((l) => (
            <div key={l} className="row" style={{ alignItems: 'flex-start', opacity: l === f.confidence ? 1 : 0.55 }}>
              <span style={{ marginTop: 2 }}>{l === f.confidence ? <Icon name="check" size={18} /> : <span style={{ display: 'inline-block', width: 18 }} />}</span>
              <span className="small"><strong>{CONFIDENCE_COPY[l].label}.</strong> {CONFIDENCE_COPY[l].detail}</span>
            </div>
          ))}
        </div>
        <p className="tiny faint">Rules version {RULES.version}. Thresholds are pending clinical sign-off.</p>
      </section>

      {insights.map((i) => (
        <section key={i.id} className={`card stack ${i.kind === 'care' || i.kind === 'range' ? 'tint-berry' : ''}`} style={{ '--gap': '8px' } as React.CSSProperties}>
          <h3>{i.title}</h3>
          <p>{i.body}</p>
          <p className="small muted"><strong>Based on:</strong> {i.basis}</p>
          <p className="small muted"><strong>Keep in mind:</strong> {i.limitation}</p>
        </section>
      ))}

      <section className="card stack" style={{ '--gap': '8px' } as React.CSSProperties}>
        <h3>Cycle history</h3>
        {all.length === 0 ? <p className="small faint">Complete cycles appear here once you log two period starts.</p> : (
          <>
            <div className="bars" role="img" aria-label={`Cycle lengths: ${all.map((c) => c.length).join(', ')} days`}>
              {all.map((c) => (
                <div key={c.start} className="bar">
                  <strong>{c.length}</strong>
                  <span className={`b ${c.usable ? '' : 'excluded'}`} style={{ height: `${(Math.min(c.length, maxLen) / maxLen) * 110}px` }} />
                  <span>{formatShort(c.start).split(' ')[0]}</span>
                </div>
              ))}
            </div>
            {all.some((c) => !c.usable) && <p className="tiny faint">Grey bars were left out of predictions (shorter than {RULES.plausibleCycle.min} or longer than {RULES.plausibleCycle.max} days).</p>}
            <div>
              {[...all].reverse().map((c) => (
                <div key={c.start} className="list-btn" style={{ cursor: 'default' }}>
                  <span>{formatRange(c.start, addDays(c.nextStart, -1))}</span>
                  <span className="small muted">{c.length} days · period {c.periodLength} day{c.periodLength > 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
      <MedicalNote />
    </div>
  );
}

/* ------------------------------------------------------------------ More / Settings */

export function More() {
  const items = [
    { to: '/app/pregnancy', icon: 'heart', t: 'Pregnancy', d: 'Pregnancy mode and calendar' },
    { to: '/app/fertility', icon: 'leaf', t: 'Fertility & ovulation', d: 'Estimated window and signs' },
    { to: '/app/library', icon: 'book', t: 'Library', d: 'Clinician-reviewed education (in review)' },
    { to: '/app/settings', icon: 'bell', t: 'Reminders & settings', d: 'Cycle, reminders, life stage' },
    { to: '/app/privacy', icon: 'shield', t: 'Privacy center', d: 'Passcode, backup, export, delete' },
    { to: '/plans', icon: 'spark', t: 'Membership', d: 'Plan, restore, cancel' },
    { to: '/help', icon: 'info', t: 'Help & legal', d: 'FAQ, terms, disclaimers' },
  ];
  return (
    <div className="stack" style={{ maxWidth: 640 } as React.CSSProperties}>
      <PageTitle title="More" />
      <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {items.map((i) => (
          <Link key={i.to} to={i.to} className="list-btn">
            <span className="row"><span style={{ color: 'var(--berry)' }}><Icon name={i.icon} /></span><span><span style={{ fontWeight: 600, display: 'block' }}>{i.t}</span><span className="small muted">{i.d}</span></span></span>
            <Icon name="chevron" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Settings() {
  const { data, update, forecast: f, today } = useStore();
  const [notifState, setNotifState] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));
  if (!data || !f) return null;
  const s = data.settings;
  const set = (patch: Partial<AppData['settings']>) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  const setRem = (patch: Partial<AppData['settings']['reminders']>) => set({ reminders: { ...s.reminders, ...patch } });
  const upcoming = upcomingReminders(data, f, today, 30);

  return (
    <div className="stack" style={{ '--gap': '18px', maxWidth: 680 } as React.CSSProperties}>
      <PageTitle eyebrow="Settings" title="Reminders & settings" />

      <section className="card stack" style={{ '--gap': '12px' } as React.CSSProperties}>
        <h3>Life stage</h3>
        <select className="input" value={s.goal} aria-label="Life stage" onChange={(e) => {
          const goal = e.target.value as Goal;
          if (goal === 'pregnant') navigate('/app/pregnancy');
          else set({ goal, ...(goal === 'conceive' ? { showFertility: true, fertilitySigns: true } : {}) });
        }}>
          <option value="understand">Understanding my cycle</option>
          <option value="conceive">Planning a pregnancy</option>
          <option value="pregnant">Pregnant</option>
          <option value="perimenopause">Changing cycles / perimenopause</option>
        </select>
        <Stepper label="Usual cycle length (used until you have history)" unit="days" value={s.cycle.typicalCycleLength} min={15} max={90} onChange={(v) => set({ cycle: { ...s.cycle, typicalCycleLength: v } })} />
        <Stepper label="Usual period length" unit="days" value={s.cycle.typicalPeriodLength} min={1} max={15} onChange={(v) => set({ cycle: { ...s.cycle, typicalPeriodLength: v } })} />
      </section>

      <section className="card">
        <h3 style={{ marginBottom: 4 }}>What to show and log</h3>
        <ToggleRow title="Fertility estimates" detail="Show the estimated fertile window and ovulation day." checked={s.showFertility} onChange={(v) => set({ showFertility: v })} />
        <ToggleRow title="Fertility signs" detail="Log cervical mucus, LH tests and temperature." checked={s.fertilitySigns} onChange={(v) => set({ fertilitySigns: v })} />
        <ToggleRow title="Intimacy logging" detail="Off by default. Turning it off later removes existing entries." checked={s.intercourseLogging} onChange={(v) => {
          if (!v && Object.values(data.logs).some((l) => l.intercourse) && !window.confirm('Turning this off deletes intimacy entries already logged. Continue?')) return;
          update((d) => ({
            ...d,
            settings: { ...d.settings, intercourseLogging: v },
            logs: v ? d.logs : Object.fromEntries(Object.entries(d.logs).map(([k, l]) => { const { intercourse: _drop, ...rest } = l; return [k, rest]; })),
          }));
        }} />
        <div className="toggle-row"><span style={{ fontWeight: 600 }}>Temperature unit</span><Segmented label="Temperature unit" value={s.temperatureUnit} onChange={(v) => set({ temperatureUnit: v })} options={[{ value: 'C', label: '°C' }, { value: 'F', label: '°F' }]} /></div>
        <div className="toggle-row"><span style={{ fontWeight: 600 }}>Week starts on</span><Segmented label="Week starts on" value={String(s.weekStartsOn) as '0' | '1'} onChange={(v) => set({ weekStartsOn: v === '0' ? 0 : 1 })} options={[{ value: '1', label: 'Mon' }, { value: '0', label: 'Sun' }]} /></div>
      </section>

      <section className="card">
        <h3 style={{ marginBottom: 4 }}>Reminders</h3>
        <ToggleRow title="Period heads-up" detail={`${s.reminders.periodHeadsUpDays} days before your expected window`} checked={s.reminders.periodHeadsUp} onChange={(v) => setRem({ periodHeadsUp: v })} />
        <ToggleRow title="Fertile window" detail="When your estimated window begins" checked={s.reminders.fertileWindow} onChange={(v) => setRem({ fertileWindow: v })} />
        <ToggleRow title="Daily check-in" checked={s.reminders.dailyLog} onChange={(v) => setRem({ dailyLog: v })} />
        <ToggleRow title="Discreet wording" detail="Notifications never mention periods, fertility or pregnancy." checked={s.reminders.discreet} onChange={(v) => setRem({ discreet: v })} />
        <div className="stack small muted" style={{ '--gap': '8px', paddingTop: 12 } as React.CSSProperties}>
          <p>Reminders are calculated on your device. In the web version, they appear in the app and as a notification when you open it, if you allow notifications. Scheduled background notifications arrive with the iOS and Android apps.</p>
          {notifState === 'default' && <button className="btn secondary" onClick={async () => setNotifState(await Notification.requestPermission())}>Allow notifications</button>}
          {notifState === 'denied' && <p>Notifications are blocked in your browser settings.</p>}
        </div>
      </section>

      <section className="card">
        <h3 style={{ marginBottom: 6 }}>Next 30 days</h3>
        {upcoming.length === 0 ? <p className="small faint">No reminders scheduled.</p> : upcoming.map((r) => (
          <div key={r.id + r.date} className="list-btn" style={{ cursor: 'default' }}><span className="small">{r.title}</span><span className="small faint">{formatShort(r.date)}</span></div>
        ))}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ Privacy center */

export function PrivacyCenter() {
  const { data, today, locked, setPasscode, replaceData, eraseAll, tour } = useStore();
  const [toast, showToast] = useToast();
  const [pin, setPin] = useState('');
  const [backupPass, setBackupPass] = useState('');
  const [importPass, setImportPass] = useState('');
  const [pendingFile, setPendingFile] = useState<string>();
  const [confirmText, setConfirmText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  if (!data) return null;

  const counts = {
    days: Object.keys(data.logs).length,
    notes: Object.values(data.logs).filter((l) => l.note).length,
    appts: data.appointments.length,
  };

  const download = async (encrypted: boolean) => {
    if (tour) return showToast('The tour has nothing to export.');
    const text = await makeBackup(data, today, encrypted ? backupPass : undefined);
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ondessa-backup-${today}${encrypted ? '.encrypted' : ''}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast(encrypted ? 'Encrypted backup downloaded' : 'Backup downloaded');
  };

  const doImport = async (text: string, pass?: string) => {
    try {
      const restored = await readBackup(text, pass);
      const n = Object.keys(restored.logs).length;
      if (!window.confirm(`Replace the data on this device with this backup (${n} logged days)? Current data will be overwritten.`)) return;
      await replaceData(restored);
      setPendingFile(undefined);
      setImportPass('');
      showToast('Backup restored');
    } catch (e) {
      if (e instanceof BackupNeedsPassword) setPendingFile(text);
      else if (e instanceof WrongPassphraseError) showToast('That password did not open the backup.');
      else showToast(e instanceof Error ? e.message : 'Could not read that file.');
    }
  };

  return (
    <div className="stack" style={{ '--gap': '18px', maxWidth: 680 } as React.CSSProperties}>
      <PageTitle eyebrow="Privacy center" title="Your data, your rules" />

      <section className="card stack" style={{ '--gap': '10px' } as React.CSSProperties}>
        <h3>What’s stored, and where</h3>
        <p className="small muted">On this device only: {counts.days} logged days, {counts.notes} notes, {counts.appts} appointments, your settings{data.pregnancy ? ' and pregnancy details' : ''}. {locked ? 'Encrypted with your passcode.' : 'Not encrypted. Anyone who can open this browser can view it.'}</p>
        <p className="small muted">Sent to us or anyone else: nothing about your health. No analytics, ads or AI services run in Ondessa.</p>
        <Link to="/privacy" className="btn ghost" >Full privacy summary <Icon name="chevron" size={16} /></Link>
      </section>

      <section className="card stack" style={{ '--gap': '12px' } as React.CSSProperties}>
        <div className="row between"><h3>Passcode lock</h3><span className={`badge ${locked ? 'developing' : 'limited'}`}>{locked ? 'On' : 'Off'}</span></div>
        <p className="small muted">Encrypts everything on this device with AES-256 using a key derived from your passcode. If you forget it, your data cannot be recovered without a backup.</p>
        <div className="row wrap-row">
          <input className="input pin" style={{ maxWidth: 200 }} type="password" inputMode="numeric" autoComplete="new-password" placeholder={locked ? 'New passcode' : '4–8 digits'} aria-label="Passcode" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} />
          <button className="btn" disabled={tour || !/^\d{4,8}$/.test(pin)} onClick={async () => { await setPasscode(pin); setPin(''); showToast(locked ? 'Passcode changed' : 'Passcode on: data encrypted'); }}>{locked ? 'Change' : 'Turn on'}</button>
          {locked && <button className="btn secondary" onClick={async () => { if (window.confirm('Turn off the passcode? Your data will be stored unencrypted on this device.')) { await setPasscode(undefined); showToast('Passcode off'); } }}>Turn off</button>}
        </div>
      </section>

      <section className="card stack" style={{ '--gap': '12px' } as React.CSSProperties}>
        <h3>Backup & export</h3>
        <p className="small muted">Your data lives only on this device. A backup is the only way to move it or recover it.</p>
        <input className="input" type="password" autoComplete="new-password" placeholder="Backup password (recommended)" aria-label="Backup password" value={backupPass} onChange={(e) => setBackupPass(e.target.value)} />
        <div className="row wrap-row">
          <button className="btn" disabled={backupPass.length < 8} onClick={() => download(true)}><Icon name="download" size={18} /> Encrypted backup</button>
          <button className="btn secondary" onClick={() => { if (window.confirm('An unencrypted export is readable by anyone who gets the file, and by apps or cloud services that store it. Continue?')) void download(false); }}>Unencrypted JSON</button>
        </div>
        {backupPass && backupPass.length < 8 && <p className="small faint">Use at least 8 characters.</p>}
        <hr className="divider" />
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (file) await doImport(await file.text()); e.target.value = ''; }} />
        <button className="btn secondary" disabled={tour} onClick={() => fileRef.current?.click()}><Icon name="upload" size={18} /> Restore from backup</button>
        {pendingFile && (
          <div className="row wrap-row">
            <input className="input" type="password" placeholder="Backup password" aria-label="Backup password to restore" value={importPass} onChange={(e) => setImportPass(e.target.value)} />
            <button className="btn" onClick={() => doImport(pendingFile, importPass)}>Unlock backup</button>
          </div>
        )}
      </section>

      <section className="card stack" style={{ '--gap': '12px', borderColor: '#d9a3a3' } as React.CSSProperties}>
        <h3>Delete everything</h3>
        <p className="small muted">Permanently removes all Ondessa data and your membership key from this device, then checks that nothing remains. This cannot be undone. It does not cancel a subscription; manage that through your store or billing account.</p>
        <input className="input" placeholder='Type DELETE to confirm' aria-label="Type DELETE to confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
        <button className="btn danger" disabled={confirmText !== 'DELETE' || tour} onClick={async () => navigate((await eraseAll()) ? '/deleted' : '/deleted-unverified', true)}><Icon name="trash" size={18} /> Permanently delete</button>
      </section>
      <Toast msg={toast} />
    </div>
  );
}
