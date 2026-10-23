import { useEffect, useRef, useState } from 'react';
import { isNative, storeName } from '../platform';
import { biometricUnlockEnabled, biometryAvailable, disableBiometricUnlock, enableBiometricUnlock } from '../platform/biometric';
import { exportBackup } from '../platform/files';
import { notificationPermission, requestNotificationPermission } from '../platform/notifications';
import { manageSubscription, restorePurchases } from '../platform/purchases';
import { Link, navigate } from '../app/router';
import { useStore } from '../app/store';
import { weekNotes } from '../content/library';
import { BackupNeedsPassword, makeBackup, readBackup } from '../data/backup';
import { WrongPassphraseError } from '../data/crypto';
import {
  CONFIDENCE_COPY, RULES, addDays, lastCycleRecap, accuracyHeadline, median, localToday, upcomingFertileWindow, detectThermalShift, dueDateFromLmp, formatLong, formatRange, formatShort,
  pregnancyStatus, upcomingReminders, type AppData, type Confidence, type Goal,
} from '../engine';
import { ConfidenceBadge, EvidenceStrip, Icon, MedicalNote, PageTitle, Segmented, Toast, ToggleRow, useToast } from '../ui/components';
import { getTheme, setTheme, type ThemeChoice } from '../ui/theme';
import { Stepper } from './onboarding';

/* ------------------------------------------------------------------ Fertility */

export function Fertility() {
  const { data, forecast: f, today } = useStore();
  if (!data || !f) return null;
  const win = upcomingFertileWindow(f);
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
  const shift = f.ovulation?.bbtShiftOn ?? (f.ovulation?.method === 'bbt' ? undefined : detectThermalShift(cycleLogs.filter((l) => l.date > f.lastPeriod!.end)));
  const methodCopy = {
    calendar: 'Calendar estimate from your cycle history',
    lh: 'Refined by your positive LH test',
    bbt: 'Refined by your temperature rise',
  };

  return (
    <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      <PageTitle eyebrow="Fertility & ovulation" title={win ? `${win.projected ? 'Next estimated window' : 'Estimated window'} ${formatRange(win.start, win.end)}` : 'No estimate yet'}>
        {win ? `Ovulation estimated around ${formatShort(win.ovulation)}. ${win.projected ? 'Projected from your cycle history.' : `${methodCopy[f.ovulation!.method]}.`}` : 'Log a period to see an estimated fertile window.'}
      </PageTitle>

      <div className="callout">Calendar predictions cannot confirm ovulation, fertility or pregnancy. Ondessa is not a contraceptive and must not be used to avoid pregnancy.</div>

      {f.fertile && f.lastPeriod && (
        <section className="card stack" style={{ '--gap': '14px' } as React.CSSProperties}>
          <div className="row between wrap-row" style={{ '--gap': '8px' } as React.CSSProperties}><h3>This cycle</h3><ConfidenceBadge level={f.confidence} /></div>
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

/**
 * Pregnancy dashboard. Also rendered on Today in pregnancy mode, where `journal` replaces
 * the journal card with one-tap log tiles.
 */
export function PregnancyView({ journal }: { journal?: React.ReactNode } = {}) {
  const { data, update, today } = useStore();
  const [ending, setEnding] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [lmp, setLmp] = useState('');
  const [due, setDue] = useState('');
  if (!data) return null;
  const p = data.pregnancy;
  const dueOk = !!due && due >= today && due <= addDays(today, 280);
  const lmpOk = !!lmp && lmp <= today && lmp >= addDays(today, -300);
  const datesForm = (label: string, apply: () => void) => (
    <div className="card stack" style={{ '--gap': '12px' } as React.CSSProperties}>
      <div className="field"><label htmlFor="pdue">Due date from your doctor or midwife (most accurate)</label><input id="pdue" className="input" type="date" min={today} max={addDays(today, 280)} value={due} onChange={(e) => setDue(e.target.value)} /></div>
      {due && !dueOk && <p className="small" role="alert" style={{ color: 'var(--berry-ink)' }}>Choose a due date between today and 40 weeks from now.</p>}
      <div className="field"><label htmlFor="plmp">Or first day of your last period</label><input id="plmp" className="input" type="date" min={addDays(today, -300)} max={today} value={lmp} onChange={(e) => setLmp(e.target.value)} /></div>
      {lmp && !lmpOk && <p className="small" role="alert" style={{ color: 'var(--berry-ink)' }}>Choose a date in the last 43 weeks.</p>}
      {lmpOk && !dueOk && <p className="small muted">Estimated due date: {formatLong(dueDateFromLmp(lmp, data.settings.cycle.typicalCycleLength))}</p>}
      <button className="btn" disabled={!dueOk && !lmpOk} onClick={apply}>{label}</button>
    </div>
  );
  const dates = () => ({ ...(lmpOk ? { lmp } : {}), ...(dueOk ? { clinicianDueDate: due } : {}) });

  if (!p) {
    return (
      <div className="stack" style={{ '--gap': '16px', maxWidth: 640 } as React.CSSProperties}>
        <PageTitle eyebrow="Pregnancy mode" title="Switch to pregnancy mode">Pauses cycle predictions and shows a week-by-week calendar. Your cycle history is kept, and you can switch back anytime.</PageTitle>
        {datesForm('Start pregnancy mode', () => update((d) => ({ ...d, settings: { ...d.settings, goal: 'pregnant' }, pregnancy: { startedOn: today, ...dates() } })))}
        <MedicalNote>Ondessa is not a substitute for prenatal care. Please contact a midwife or doctor to arrange care.</MedicalNote>
      </div>
    );
  }

  const st = pregnancyStatus(p, today, data.settings.cycle.typicalCycleLength);
  const notes = st ? weekNotes(st.week) : undefined;
  if (!st) {
    return (
      <div className="stack" style={{ '--gap': '16px', maxWidth: 640 } as React.CSSProperties}>
        <PageTitle eyebrow="Pregnancy" title="Let’s update your dates">The dates saved for this pregnancy can’t be used to work out your week. Enter the due date from your doctor or midwife, or your last period.</PageTitle>
        {datesForm('Save dates', () => update((d) => ({ ...d, pregnancy: { startedOn: p.startedOn, ...dates() } })))}
      </div>
    );
  }
  const endPregnancy = () => {
    update((d) => ({ ...d, pregnancy: undefined, pastPregnancies: [...d.pastPregnancies, p], settings: { ...d.settings, goal: 'understand' } }));
    setEnding(false);
  };

  return (
    <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      <section className="card plum stack" style={{ '--gap': '12px' } as React.CSSProperties}>
        <span className="eyebrow">Pregnancy · {st ? `Trimester ${st.trimester}` : 'dates needed'}</span>
        <h1 style={{ fontSize: 'clamp(2.2rem, 7vw, 3.2rem)' }}>{st ? `Week ${st.week}${st.day ? ` + ${st.day}` : ''}` : '—'}</h1>
        {st && (
          <>
            <div className="progress" style={{ background: 'color-mix(in oklab, var(--on-plum) 25%, transparent)' }}><i style={{ width: `${st.progress * 100}%`, background: 'var(--on-plum)' }} /></div>
            <p className="small muted">Estimated due date {formatLong(st.dueDate)} · {st.pastDueDate ? 'past the estimated date' : `${st.daysToGo} days to go`} · {st.source === 'clinician' ? 'date from your doctor or midwife' : 'estimated from your last period'}</p>
          </>
        )}
      </section>

      <div className="callout"><strong>Medical concerns:</strong> contact your midwife, doctor or local emergency services. Seek help promptly for bleeding, severe pain, fluid leaking, severe headache or vision changes, fever, or reduced baby movements. <Link to="/app/library/pregnancy-when-to-call">When to call</Link></div>

      {notes && (
        <section className="card stack" style={{ '--gap': '10px' } as React.CSSProperties}>
          <span className="eyebrow">Weeks {notes.from}–{notes.to}</span>
          <div className="row between wrap-row"><h3>{notes.title}</h3></div>
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
            <button className="btn ghost" style={{ minWidth: 44 }} aria-label={`Remove ${a.title}`} onClick={() => update((d) => ({ ...d, appointments: d.appointments.filter((x) => x.id !== a.id) }))}><Icon name="trash" size={18} /></button>
          </div>
        ))}
        <div className="row wrap-row">
          <input className="input" style={{ flex: '2 1 180px' }} placeholder="e.g. Midwife check-in" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} aria-label="Appointment title" />
          <input className="input" style={{ flex: '1 1 140px' }} type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Appointment date" />
          <button className="btn" disabled={!title.trim() || !date} onClick={() => { update((d) => ({ ...d, appointments: [...d.appointments, { id: crypto.randomUUID(), title: title.trim(), date }] })); setTitle(''); setDate(''); }}>Add</button>
        </div>
      </section>

      {journal ?? (
        <section className="card stack" style={{ '--gap': '10px' } as React.CSSProperties}>
          <h3>Symptom journal</h3>
          <p className="small muted">Log symptoms, mood, sleep and notes any day. They stay private on this device.</p>
          <Link to="/app/log" className="btn secondary">Open today’s journal</Link>
        </section>
      )}

      <div className="row wrap-row">
        <Link to="/app/library/due-date-explained" className="btn secondary">How due dates work</Link>
        {!ending && <button className="btn ghost" onClick={() => setEnding(true)}>End pregnancy mode</button>}
      </div>
      {ending && <EndPregnancySheet onConfirm={endPregnancy} onCancel={() => setEnding(false)} />}
      <MedicalNote>Ondessa is not a medical device and does not replace prenatal care.</MedicalNote>
    </div>
  );
}

/**
 * Ending pregnancy mode, for any reason. Neutral wording, no outcome asked, nothing deleted.
 * An in-app panel rather than a system dialog so it can say this with care.
 */
export function EndPregnancySheet({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <section className="card stack" role="alertdialog" aria-labelledby="end-preg-title" aria-describedby="end-preg-body" style={{ '--gap': '12px' } as React.CSSProperties}>
      <h3 id="end-preg-title">End pregnancy mode?</h3>
      <div id="end-preg-body" className="stack small muted" style={{ '--gap': '8px' } as React.CSSProperties}>
        <p>Whatever the reason, your pregnancy details stay in your history on this device. Nothing is deleted.</p>
        <p>Cycle tracking starts again. Predictions pick up once you log your next period, and they may be less certain for a while.</p>
        <p>If this follows a loss, please be gentle with yourself. Your midwife or doctor can support you, including with your physical recovery.</p>
      </div>
      <div className="row wrap-row">
        <button className="btn" onClick={onConfirm}>Yes, end pregnancy mode</button>
        <button className="btn secondary" autoFocus onClick={onCancel}>Keep pregnancy mode</button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Insights */

export function Insights() {
  const { data, forecast: f, insights, today } = useStore();
  if (!data || !f) return null;
  const recap = lastCycleRecap(data, today);
  const usedLens = f.usedCycleLengths;
  const recentPeriods = f.cycles.filter((c) => c.usable).slice(-6).map((c) => c.periodLength);
  const all = f.cycles.slice(-12);
  const usableCount = f.usableCycleCount;
  const loggedDays = Object.keys(data.logs).length;
  const thisCycle = f.lastPeriod ? Object.values(data.logs).filter((l) => l.date >= f.lastPeriod!.start) : [];
  const symptomCounts = new Map<string, number>();
  for (const l of thisCycle) for (const x of l.symptoms ?? []) symptomCounts.set(x, (symptomCounts.get(x) ?? 0) + 1);
  const topThisCycle = [...symptomCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([x, n]) => `${x} ×${n}`).join(', ');
  const maxLen = Math.max(40, ...all.map((c) => c.length));
  const levels: Confidence[] = ['limited', 'developing', 'established'];

  return (
    <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      <PageTitle eyebrow="Insights" title={usableCount < 3 ? `Your first patterns arrive in ${3 - usableCount} cycle${3 - usableCount === 1 ? '' : 's'}` : 'What your logs show'}>Every observation below comes only from what you logged, says what it’s based on, and never claims a cause.</PageTitle>

      {usedLens.length >= 1 && (
        <div className="stat-grid" role="group" aria-label="Your numbers">
          <div><div className="kicker-num">{f.predictedCycleLength}<small>d</small></div><div className="small muted">Typical cycle</div></div>
          <div><div className="kicker-num">{recentPeriods.length ? Math.round(median(recentPeriods)) : f.predictedPeriodLength}<small>d</small></div><div className="small muted">Typical period</div></div>
          <div><div className="kicker-num">{usedLens.length >= 2 ? Math.max(...usedLens) - Math.min(...usedLens) : '—'}{usedLens.length >= 2 && <small>d</small>}</div><div className="small muted">{usedLens.length < 2 ? 'Spread' : Math.min(...usedLens) === Math.max(...usedLens) ? 'Spread, all equal' : `Spread, ${Math.min(...usedLens)}–${Math.max(...usedLens)} days`}</div></div>
        </div>
      )}

      {recap && (
        <Link to="/app/recap" className="card stack phase-menstrual" >
          <span className="row between"><span className="eyebrow">Last cycle recap</span><Icon name="chevron" size={18} /></span>
          <strong>{accuracyHeadline(recap)}</strong>
          <span className="small muted">{recap.length} days · {recap.daysLogged} days logged{recap.predicted ? ` · predicted ${formatShort(recap.predicted)}, started ${formatShort(recap.nextStart)}` : ''}</span>
        </Link>
      )}

      <section className="card stack" style={{ '--gap': '12px' } as React.CSSProperties}>
        <div className="row between wrap-row"><h3>Prediction confidence</h3><ConfidenceBadge level={f.confidence} /></div>
        <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
          {levels.map((l) => (
            <div key={l} className={`row ${l === f.confidence ? '' : 'muted'}`} style={{ alignItems: 'flex-start' }}>
              <span style={{ marginTop: 2 }}>{l === f.confidence ? <Icon name="check" size={18} /> : <span style={{ display: 'inline-block', width: 18 }} />}</span>
              <span className="small"><strong>{CONFIDENCE_COPY[l].label}.</strong> {CONFIDENCE_COPY[l].detail}</span>
            </div>
          ))}
        </div>
      </section>

      {usableCount < 3 && (
        <section className="card tint-phase phase-luteal stack" style={{ '--gap': '12px' } as React.CSSProperties}>
          <span className="eyebrow">Patterns unlock after 3 complete cycles</span>
          <div className="row" role="img" style={{ '--gap': '6px' } as React.CSSProperties} aria-label={`${usableCount} of 3 cycles complete`}>
            {[0, 1, 2].map((i) => <span key={i} style={{ flex: 1, height: 8, borderRadius: 8, background: i < usableCount ? 'var(--phase)' : 'var(--paper)' }} />)}
          </div>
          <p className="small"><strong>{usableCount} of 3 cycles</strong> · {loggedDays} day{loggedDays === 1 ? '' : 's'} logged so far.</p>
          {topThisCycle && <p className="small muted">Most logged this cycle: {topThisCycle}.</p>}
          <div className="row wrap-row" style={{ '--gap': '8px' } as React.CSSProperties}>
            <Link to="/app/history" className="btn">Skip the wait: add past periods</Link>
            <Link to="/app/log" className="btn secondary">Log today</Link>
          </div>
        </section>
      )}

      {insights.filter((i) => i.id !== 'limited-history' || usableCount >= 3).map((i) => (
        <section key={i.id} className={`card stack ${i.kind === 'care' || i.kind === 'range' ? 'tint-berry' : ''} ${i.kind === 'symptom' ? 'phase-menstrual' : 'phase-fertile'}`} style={{ '--gap': '8px' } as React.CSSProperties}>
          <h3 className="display" style={{ fontFamily: 'var(--display)', fontWeight: 400, fontSize: '1.5rem', lineHeight: 1.1 }}>{i.title}</h3>
          {i.evidence && <EvidenceStrip hits={i.evidence.hits} total={i.evidence.total} label={i.evidence.label} />}
          <p>{i.body}</p>
          <details className="small">
            <summary style={{ cursor: 'pointer', fontWeight: 560, minHeight: 44, display: 'flex', alignItems: 'center' }}>Based on, and what to keep in mind</summary>
            <div className="stack" style={{ '--gap': '6px', marginTop: 4 } as React.CSSProperties}>
              <p className="muted"><strong>Based on:</strong> {i.basis}</p>
              <p className="muted"><strong>Keep in mind:</strong> {i.limitation}</p>
            </div>
          </details>
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
                  <span>{formatShort(c.start).split(' ')[0]}<br />{Number(c.start.slice(8))}</span>
                </div>
              ))}
            </div>
            <p className="tiny faint">Each bar is a cycle, labelled by its start date. The latest is in colour.</p>
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

/* ------------------------------------------------------------------ Settings */

export function Settings() {
  const { data, update, forecast: f, today } = useStore();
  const [pendingGoal, setPendingGoal] = useState<Goal>();
  const [notifState, setNotifState] = useState<'granted' | 'denied' | 'prompt'>();
  useEffect(() => {
    void notificationPermission().then(setNotifState);
  }, []);
  const askNotifications = async () => setNotifState((await requestNotificationPermission()) ? 'granted' : 'denied');
  if (!data || !f) return null;
  const s = data.settings;
  const set = (patch: Partial<AppData['settings']>) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  const setRem = (patch: Partial<AppData['settings']['reminders']>) => {
    set({ reminders: { ...s.reminders, ...patch } });
    // Ask for notification permission when a reminder is turned on, never at launch.
    const turnedOn = Object.entries(patch).some(([k, v]) => k !== 'discreet' && v === true);
    if (turnedOn && notifState === 'prompt') void askNotifications();
  };
  const upcoming = upcomingReminders(data, f, today, 30);
  const applyGoal = (goal: Goal) => update((d) => ({
    ...d,
    ...(d.pregnancy ? { pregnancy: undefined, pastPregnancies: [...d.pastPregnancies, d.pregnancy] } : {}),
    settings: { ...d.settings, goal, ...(goal === 'conceive' ? { showFertility: true, fertilitySigns: true } : {}) },
  }));

  return (
    <div className="stack" style={{ '--gap': '18px', maxWidth: 680 } as React.CSSProperties}>
      <PageTitle eyebrow="Settings" title="Reminders & settings" />

      <section className="card stack" style={{ '--gap': '12px' } as React.CSSProperties}>
        <h3>Life stage</h3>
        <select className="input" value={pendingGoal ?? s.goal} aria-label="Life stage" onChange={(e) => {
          const goal = e.target.value as Goal;
          if (goal === 'pregnant') return navigate('/app/pregnancy');
          if (data.pregnancy) return setPendingGoal(goal);
          applyGoal(goal);
        }}>
          <option value="understand">Understanding my cycle</option>
          <option value="conceive">Planning a pregnancy</option>
          <option value="pregnant">Pregnant</option>
          <option value="perimenopause">Changing cycles / perimenopause</option>
        </select>
        {pendingGoal && <EndPregnancySheet onConfirm={() => { applyGoal(pendingGoal); setPendingGoal(undefined); }} onCancel={() => setPendingGoal(undefined)} />}
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
        <div className="toggle-row" style={{ flexWrap: 'wrap', rowGap: 10 }}><span style={{ fontWeight: 600 }}>Appearance</span><AppearancePicker /></div>
        <div className="toggle-row"><span style={{ fontWeight: 600 }}>Week starts on</span><Segmented label="Week starts on" value={String(s.weekStartsOn) as '0' | '1'} onChange={(v) => set({ weekStartsOn: v === '0' ? 0 : 1 })} options={[{ value: '1', label: 'Mon' }, { value: '0', label: 'Sun' }]} /></div>
      </section>

      <section className="card">
        <h3 style={{ marginBottom: 4 }}>Reminders</h3>
        <ToggleRow title="Period heads-up" detail={`${s.reminders.periodHeadsUpDays} days before your expected window`} checked={s.reminders.periodHeadsUp} onChange={(v) => setRem({ periodHeadsUp: v })} />
        <ToggleRow title="Fertile window" detail="When your estimated window begins" checked={s.reminders.fertileWindow} onChange={(v) => setRem({ fertileWindow: v })} />
        <ToggleRow title="Daily check-in" checked={s.reminders.dailyLog} onChange={(v) => setRem({ dailyLog: v })} />
        <ToggleRow title="Discreet wording" detail="Notifications never mention periods, fertility or pregnancy." checked={s.reminders.discreet} onChange={(v) => setRem({ discreet: v })} />
        <div className="stack small muted" style={{ '--gap': '8px', paddingTop: 12 } as React.CSSProperties}>
          <p>{isNative
            ? 'Reminders are scheduled on this device at 9am on the day. Nothing is sent to a server.'
            : 'Reminders are calculated on your device. On the web they appear in the app and as a notification when you open it.'}</p>
          {notifState === 'prompt' && <button className="btn secondary" onClick={askNotifications}>Allow notifications</button>}
          {notifState === 'denied' && <p>Notifications are turned off for Ondessa in your {isNative ? 'device' : 'browser'} settings.</p>}
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
  const { data, today, locked, setPasscode, replaceData, eraseAll, tour, update } = useStore();
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
    const done = await exportBackup(`ondessa-backup-${today}${encrypted ? '.encrypted' : ''}.json`, text);
    if (!done) return; // cancelled: don't record a backup that wasn't saved
    update((d) => ({ ...d, lastBackupOn: today }));
    showToast(encrypted ? 'Encrypted backup saved' : 'Backup saved');
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
        {tour ? <p className="small muted">This is sample data for the tour. None of it is saved, and it disappears when you leave the tour. Once you set up Ondessa, everything you log is stored only on your device.</p> : <p className="small muted">On this device only: {plural(counts.days, 'logged day')}, {plural(counts.notes, 'note')}, {plural(counts.appts, 'appointment')}, your settings{data.pregnancy ? ' and pregnancy details' : ''}. {locked ? 'Encrypted with your passcode.' : isNative ? 'Not encrypted. Anyone who can unlock this device and open Ondessa can view it.' : 'Not encrypted. Anyone who can open this browser can view it.'}</p>}
        <p className="small muted">Sent to us or anyone else: nothing about your health. No analytics, ads or AI services run in Ondessa.</p>
        <Link to="/privacy" className="btn ghost" >Full privacy summary <Icon name="chevron" size={16} /></Link>
      </section>

      <section className="card stack" style={{ '--gap': '12px' } as React.CSSProperties}>
        <div className="row between"><h3>Passcode lock</h3><span className={`badge ${locked ? 'developing' : 'limited'}`}>{locked ? 'On' : 'Off'}</span></div>
        <p className="small muted">Encrypts everything on this device with AES-256 using a key derived from your passcode. If you forget it, your data cannot be recovered without a backup.</p>
        <div className="row wrap-row">
          <input className="input pin" style={{ maxWidth: 200 }} type="password" inputMode="numeric" autoComplete="new-password" placeholder={locked ? 'New passcode' : '4–8 digits'} aria-label="Passcode" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} />
          <button className="btn" disabled={tour || !/^\d{4,8}$/.test(pin)} onClick={async () => { await setPasscode(pin); setPin(''); showToast(locked ? 'Passcode changed' : 'Passcode on: data encrypted'); }}>{locked ? 'Change' : 'Turn on'}</button>
          {locked && <button className="btn secondary" disabled={tour} onClick={async () => { if (window.confirm('Turn off the passcode? Your data will be stored unencrypted on this device.')) { await setPasscode(undefined); showToast('Passcode off'); } }}>Turn off</button>}
        </div>
        {locked && !tour && <QuickUnlock notify={showToast} />}
      </section>

      <section className="card stack" style={{ '--gap': '12px' } as React.CSSProperties}>
        <h3>Backup & export</h3>
        <p className="small muted">Your data lives only on this device. A backup is the only way to move it or recover it.{isNative ? ' You choose where to save it: Files, AirDrop or another app.' : ''}</p>
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
        <p className="small muted">Permanently removes all Ondessa data and your membership key from this device, then checks that nothing remains. This cannot be undone. It does not cancel a subscription; manage that from Membership.</p>
        <input className="input" placeholder='Type DELETE to confirm' aria-label="Type DELETE to confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
        <button className="btn danger" disabled={confirmText.trim().toUpperCase() !== 'DELETE' || tour} onClick={async () => navigate((await eraseAll()) ? '/deleted' : '/deleted-unverified', true)}><Icon name="trash" size={18} /> Permanently delete</button>
      </section>
      <Toast msg={toast} />
    </div>
  );
}

/* ------------------------------------------------------------------ Membership (in-app) */

export function Membership() {
  const { entitlement, refreshEntitlement, tour } = useStore();
  const [msg, setMsg] = useState<string>();
  if (tour) {
    return (
      <div className="stack" style={{ '--gap': '14px', maxWidth: 640 } as React.CSSProperties}>
        <PageTitle eyebrow="Membership" title="You’re on the tour">No membership is needed to look around. When you set up Ondessa with your own data, you’ll see your plan, renewal date and how to manage it here.</PageTitle>
        <Link to="/plans" className="btn secondary">See plans</Link>
      </div>
    );
  }
  const active = entitlement.status === 'active';
  const planName = !active ? 'None' : entitlement.plan === 'preview' ? 'Preview pass' : entitlement.plan === 'annual' ? 'Yearly' : 'Monthly';
  const renewal = !active ? '—'
    : entitlement.preview ? `Ends ${formatLong(localToday(new Date(entitlement.expires * 1000)))}`
      : entitlement.store ? `Managed by ${storeName}`
        : `Renews or ends ${formatLong(localToday(new Date(entitlement.expires * 1000)))}`;
  return (
    <div className="stack" style={{ '--gap': '14px', maxWidth: 640 } as React.CSSProperties}>
      <PageTitle eyebrow="Membership" title={active ? 'You’re a member' : 'No active membership'} />
      <section className="card stack" style={{ '--gap': '4px' } as React.CSSProperties}>
        <div className="row between toggle-row"><span className="muted">Plan</span><strong>{planName}</strong></div>
        <div className="row between toggle-row"><span className="muted">Renewal</span><strong>{renewal}</strong></div>
      </section>
      {isNative ? (
        <section className="card stack" style={{ '--gap': '10px' } as React.CSSProperties}>
          <h3>Manage or cancel</h3>
          <p className="small muted">Change or cancel your plan in {storeName}. Cancelling keeps access to the end of the paid period and never deletes your data.</p>
          <button className="btn" onClick={() => void manageSubscription()}>Manage subscription</button>
          <button className="btn secondary" onClick={async () => { const p = await restorePurchases(); await refreshEntitlement(); setMsg(p ? 'Your membership is restored.' : 'No active membership was found for this account.'); }}>Restore purchases</button>
          {msg && <p className="small" role="status">{msg}</p>}
        </section>
      ) : (
        <>
          <section className="card stack" style={{ '--gap': '10px' } as React.CSSProperties}>
            <h3>Manage or cancel</h3>
            <p className="small muted">Subscriptions are managed where you bought them. Cancelling keeps access to the end of the paid period and never deletes your data.</p>
          </section>
          <section className="card stack" style={{ '--gap': '10px' } as React.CSSProperties}>
            <h3>Your membership key</h3>
            <p className="small muted">The key on this device proves your subscription without an account. It holds a random ID, your plan and an expiry date, nothing about your health.</p>
            <Link to="/plans" className="btn secondary">Restore or change plan</Link>
          </section>
        </>
      )}
      <p className="small row wrap-row" style={{ '--gap': '16px' } as React.CSSProperties}><Link to="/legal">Terms of Use</Link><Link to="/privacy">Privacy Policy</Link></p>
    </div>
  );
}

/** Face ID / Touch ID unlock, offered once a passcode is set. Native only. */
function QuickUnlock({ notify }: { notify: (m: string) => void }) {
  const [state, setState] = useState<{ available: boolean; label: string; enabled: boolean }>();
  const [pin, setPin] = useState('');
  useEffect(() => {
    void Promise.all([biometryAvailable(), biometricUnlockEnabled()]).then(([b, enabled]) => setState({ ...b, enabled }));
  }, []);
  if (!state?.available) return null;
  return (
    <div className="stack" style={{ '--gap': '8px', paddingTop: 8, borderTop: '1px solid var(--line)' } as React.CSSProperties}>
      <ToggleRow
        title={`Unlock with ${state.label}`}
        detail="Your passcode is kept in this device’s secure keychain and never synced."
        checked={state.enabled}
        onChange={async (v) => {
          if (!v) {
            await disableBiometricUnlock();
            setState({ ...state, enabled: false });
            return;
          }
          if (!/^\d{4,8}$/.test(pin)) return notify('Enter your current passcode first.');
          const ok = await enableBiometricUnlock(pin);
          setPin('');
          setState({ ...state, enabled: ok });
          notify(ok ? `${state.label} unlock is on` : `${state.label} wasn’t turned on`);
        }}
      />
      {!state.enabled && (
        <input className="input pin" style={{ maxWidth: 200 }} type="password" inputMode="numeric" autoComplete="current-password" placeholder="Current passcode" aria-label="Current passcode for quick unlock" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} />
      )}
    </div>
  );
}

function AppearancePicker() {
  const [theme, set] = useState<ThemeChoice>(getTheme);
  return <Segmented full label="Appearance" value={theme} onChange={(v) => { setTheme(v); set(v); }} options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
