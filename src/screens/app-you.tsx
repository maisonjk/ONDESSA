import { useEffect, useState } from 'react';
import { Link, navigate } from '../app/router';
import { useStore } from '../app/store';
import { exportFile, shareText } from '../platform/files';
import {
  RULES, accuracyHeadline, addDays, diffDays, formatLong, formatShort, lastCycleRecap, localToday, partnerLines, partnerMessage,
  predictedPeriodsIcs, recapText, type ISODate, type PartnerShareOptions,
} from '../engine';
import { EvidenceStrip, Icon, MedicalNote, PageTitle, Toast, ToggleRow, useToast } from '../ui/components';

/* ------------------------------------------------------------------ You */

/** Which new features this device has opened, so "New" badges disappear once seen. UI only. */
const VISITED_KEY = 'ondessa.visited';
function visited(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(VISITED_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function useMarkVisited(id: string, skip: boolean) {
  useEffect(() => {
    if (skip) return;
    try {
      const v = visited();
      if (!v.includes(id)) localStorage.setItem(VISITED_KEY, JSON.stringify([...v, id]));
    } catch {
      /* storage unavailable */
    }
  }, [id, skip]);
}

const PHASE_BAR = ['var(--berry)', 'var(--apricot)', 'var(--sage)', 'var(--lavender)'];

export function You() {
  const { data, entitlement, locked, tour } = useStore();
  if (!data) return null;
  const days = Object.keys(data.logs).length;
  const seen = tour ? ['share', 'recap'] : visited();
  const active = entitlement.status === 'active';
  const member = !active
    ? { eyebrow: 'Membership', title: 'No active membership', detail: 'See plans and restore options.' }
    : entitlement.plan === 'preview'
      ? { eyebrow: 'Preview pass', title: `Ends ${formatLong(localToday(new Date(entitlement.expires * 1000)))}`, detail: 'Development builds only.' }
      : {
        eyebrow: `Member · ${entitlement.plan === 'annual' ? 'yearly' : 'monthly'}`,
        title: 'You’re a member',
        detail: entitlement.store ? 'Renewal is managed in your store account.' : `Renews or ends ${formatLong(localToday(new Date(entitlement.expires * 1000)))}.`,
      };

  const groups: { title: string; items: { to: string; icon: string; t: string; d: string; isNew?: boolean }[] }[] = [
    {
      title: 'Share and look back',
      items: [
        { to: '/app/share', icon: 'people', t: 'Partner sharing', d: 'Send a heads-up you choose. Nothing is shared automatically.', isNew: !seen.includes('share') },
        { to: '/app/recap', icon: 'chart', t: 'Cycle recap', d: 'Your last cycle, and how close the prediction was.', isNew: !seen.includes('recap') && days > 0 },
        { to: '/app/history', icon: 'history', t: 'Add past periods', d: 'Earlier dates make predictions sharper sooner.' },
      ],
    },
    {
      title: 'Your cycle',
      items: [
        { to: '/app/pregnancy', icon: 'heart', t: 'Pregnancy', d: 'Pregnancy mode and calendar' },
        { to: '/app/fertility', icon: 'leaf', t: 'Fertility & ovulation', d: 'Estimated window and signs' },
        { to: '/app/library', icon: 'book', t: 'Library', d: 'Guides with sources' },
      ],
    },
    {
      title: 'Settings',
      items: [
        { to: '/app/settings', icon: 'bell', t: 'Reminders & settings', d: 'Cycle, reminders, life stage, appearance' },
        { to: '/app/privacy', icon: 'shield', t: 'Privacy center', d: 'Passcode, backup, export, delete' },
        { to: '/app/membership', icon: 'spark', t: 'Membership', d: 'Plan, renewal, membership key' },
        { to: '/help', icon: 'info', t: 'Help & legal', d: 'FAQ, terms, disclaimers' },
      ],
    },
  ];

  return (
    <div className="stack" style={{ '--gap': '14px', maxWidth: 680 } as React.CSSProperties}>
      <PageTitle title="You" />

      <Link to="/app/membership" className="card plum stack" >
        <span className="row between"><span className="eyebrow">{member.eyebrow}</span><Icon name="chevron" size={18} /></span>
        <strong style={{ fontSize: '1.1rem' }}>{member.title}</strong>
        <span className="small muted">{member.detail}</span>
      </Link>

      <Link to="/app/privacy" className="card stack" >
        <span className="row" style={{ '--gap': '10px' } as React.CSSProperties}>
          <span style={{ color: 'var(--sage-ink)' }}><Icon name="lock" size={20} /></span>
          <strong>{tour ? 'Sample data, nothing is saved' : 'Stored only on this device'}</strong>
        </span>
        <span className="small muted">
          {days} day{days === 1 ? '' : 's'} logged · passcode {locked ? 'on, data encrypted' : 'off'} · {data.lastBackupOn ? `last backup ${formatShort(data.lastBackupOn)}` : 'no backup yet'}
        </span>
      </Link>

      {groups.map((g) => (
        <section key={g.title} className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
          <h2 className="eyebrow" style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', padding: '8px 4px 0' }}>{g.title}</h2>
          <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
            {g.items.map((i) => (
              <Link key={i.to} to={i.to} className="list-btn">
                <span className="row" style={{ flex: '1 1 auto', minWidth: 0, alignItems: 'flex-start' }}><span style={{ color: 'var(--berry)', flex: 'none', marginTop: 2 }}><Icon name={i.icon} /></span><span style={{ minWidth: 0 }}><span style={{ fontWeight: 600, display: 'block' }}>{i.t}</span><span className="small muted">{i.d}</span></span></span>
                <span className="row" style={{ '--gap': '8px', flex: 'none' } as React.CSSProperties}>{i.isNew && <span className="tag">NEW</span>}<Icon name="chevron" /></span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Partner sharing */

export function PartnerShare() {
  const { data, forecast: f, today, tour } = useStore();
  useMarkVisited('share', tour);
  const [opts, setOpts] = useState<PartnerShareOptions>({ countdown: true, phase: true, fertile: false });
  const [toast, showToast] = useToast();
  if (!data || !f) return null;
  const showFertility = data.settings.showFertility && !data.pregnancy;
  const lines = data.pregnancy ? [] : partnerLines(f, today, opts, showFertility);
  const message = data.pregnancy ? '' : partnerMessage(f, today, opts, showFertility);
  const set = (patch: Partial<PartnerShareOptions>) => setOpts((o) => ({ ...o, ...patch }));

  const send = async () => {
    const r = await shareText('A heads-up', message);
    if (r === 'copied') showToast('Copied. Paste it into a message.');
    else if (r === 'unavailable') showToast('Sharing isn’t available here.');
  };
  const calendar = async () => {
    if (tour) return showToast('The tour has nothing to export.');
    const ok = await exportFile(`ondessa-periods-${today}.ics`, predictedPeriodsIcs(f, today, data.settings.reminders.discreet), 'text/calendar', 'Predicted periods');
    if (ok) showToast('Calendar file ready to add');
  };

  if (data.pregnancy) {
    return (
      <div className="stack" style={{ maxWidth: 640 } as React.CSSProperties}>
        <PageTitle eyebrow="Partner sharing" title="Paused in pregnancy mode">Cycle updates aren’t shared while pregnancy mode is on.</PageTitle>
        <Link to="/app/you" className="btn secondary">Back to You</Link>
      </div>
    );
  }

  return (
    <div className="stack" style={{ '--gap': '16px', maxWidth: 640 } as React.CSSProperties}>
      <PageTitle eyebrow="Partner sharing" title="Keep someone in the loop">
        Pick what to include, then send it yourself by text, email or any app. Ondessa has no server: nothing is shared unless you send it.
      </PageTitle>

      <section className="card plum stack" style={{ '--gap': '10px' } as React.CSSProperties} aria-label="Message preview">
        <span className="eyebrow">Preview · what they’ll read</span>
        {lines.length ? <p className="share-preview">{message}</p> : <p className="small muted">Nothing to share yet. Switch on at least one item{!f.lastPeriod ? ', and log a period first' : ''}.</p>}
      </section>

      <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        <ToggleRow title="Period countdown" detail="Days until your next period, or which day it is." checked={opts.countdown} onChange={(v) => set({ countdown: v })} />
        <ToggleRow title="Current phase" detail="Period, follicular, fertile or luteal, marked as an estimate." checked={opts.phase} onChange={(v) => set({ phase: v })} />
        {showFertility && <ToggleRow title="Fertile window" detail="Useful if you’re trying together. Never a guarantee." checked={opts.fertile} onChange={(v) => set({ fertile: v })} />}
        <div className="toggle-row">
          <span className="small muted"><Icon name="lock" size={16} /> Symptoms, mood, notes, intimacy and fertility signs are never included.</span>
        </div>
      </section>

      <button className="btn block" disabled={!lines.length} onClick={send}><Icon name="share" size={18} /> Share update</button>

      <section className="card stack" style={{ '--gap': '10px' } as React.CSSProperties}>
        <h3>Add predicted periods to a calendar</h3>
        <p className="small muted">
          A calendar file with your next predicted windows. Import it into your own calendar, or send it to someone. {data.settings.reminders.discreet ? 'Events are titled only “Ondessa” because discreet wording is on.' : 'Events are titled “Period expected (estimate)”. Turn on discreet wording in Settings for neutral titles.'} It doesn’t update itself: send a new one after your next period.
        </p>
        <button className="btn secondary" disabled={!f.nextPeriod} onClick={calendar}><Icon name="calendar" size={18} /> Create calendar file</button>
      </section>
      <MedicalNote>Shared dates are estimates. Ondessa is not a contraceptive.</MedicalNote>
      <Toast msg={toast} />
    </div>
  );
}

/* ------------------------------------------------------------------ Cycle recap */

export function Recap() {
  const { data, today, tour } = useStore();
  useMarkVisited('recap', tour);
  const [withSymptoms, setWithSymptoms] = useState(false);
  const [toast, showToast] = useToast();
  if (!data) return null;
  const r = lastCycleRecap(data, today);
  if (!r) {
    return (
      <div className="stack" style={{ maxWidth: 640 } as React.CSSProperties}>
        <PageTitle eyebrow="Cycle recap" title="Your first recap is on its way">A recap appears when a full cycle is logged: from one period start to the next.</PageTitle>
        <Link to="/app/history" className="btn">Add past periods</Link>
        <Link to="/app/you" className="btn secondary">Back to You</Link>
      </div>
    );
  }
  const end = addDays(r.nextStart, -1);
  const share = async () => {
    const res = await shareText('My cycle recap', recapText(r, withSymptoms));
    if (res === 'copied') showToast('Copied. Paste it anywhere.');
    else if (res === 'unavailable') showToast('Sharing isn’t available here.');
  };
  // Phase proportions for the strip, using the same calendar rules as predictions.
  const ov = r.length - RULES.lutealDays;
  const fertileStart = Math.max(r.periodLength, ov - RULES.fertileBefore);
  const fertileEnd = Math.min(r.length - 1, ov + RULES.fertileAfter);
  const segments = [r.periodLength, fertileStart - r.periodLength, fertileEnd - fertileStart + 1, r.length - fertileEnd - 1].map((n) => Math.max(0, n));

  return (
    <div className="stack" style={{ '--gap': '16px', maxWidth: 640 } as React.CSSProperties}>
      <PageTitle eyebrow={`Cycle recap · ${formatShort(r.start)} to ${formatShort(end)}`} title={accuracyHeadline(r)}>
        {r.predicted ? `Predicted ${formatShort(r.predicted)}, started ${formatShort(r.nextStart)}.` : 'Next time, Ondessa will score its prediction here.'}
      </PageTitle>

      <section className="card plum stack" style={{ '--gap': '16px' } as React.CSSProperties} aria-label="Recap card">
        <div className="recap-strip" aria-hidden="true" style={{ gridTemplateColumns: segments.filter((n) => n > 0).map((n) => `${n}fr`).join(' ') }}>
          {segments.map((n, i) => (n > 0 ? <i key={i} style={{ background: PHASE_BAR[i] }} /> : null))}
        </div>
        <div className="stat-grid">
          <div style={{ background: 'transparent', borderColor: 'color-mix(in oklab, var(--paper) 25%, transparent)' }}><div className="kicker-num">{r.length}<small>d</small></div><div className="small muted">Cycle</div></div>
          <div style={{ background: 'transparent', borderColor: 'color-mix(in oklab, var(--paper) 25%, transparent)' }}><div className="kicker-num">{r.periodLength}<small>d</small></div><div className="small muted">Period</div></div>
          <div style={{ background: 'transparent', borderColor: 'color-mix(in oklab, var(--paper) 25%, transparent)' }}><div className="kicker-num">{r.daysLogged}</div><div className="small muted">Days logged</div></div>
        </div>
        {withSymptoms && (r.topSymptoms.length > 0 || r.topMood) && (
          <p className="small"><strong>Most logged:</strong> {[...r.topSymptoms, ...(r.topMood ? [r.topMood] : [])].join(', ')}</p>
        )}
      </section>

      <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        <ToggleRow title="Include symptoms and mood" detail="Off by default, here and in anything you share." checked={withSymptoms} onChange={setWithSymptoms} />
      </section>
      <button className="btn block" onClick={share}><Icon name="share" size={18} /> Share recap</button>
      <Link to="/app/insights" className="btn secondary">See all insights</Link>
      <Toast msg={toast} />
    </div>
  );
}

/* ------------------------------------------------------------------ Past periods */

/**
 * Enter earlier period start dates in one go, so a new user's first prediction and first
 * patterns come from real history instead of the default cycle length.
 */
export function PastPeriodsFields({ values, onChange, max, min }: { values: string[]; onChange: (v: string[]) => void; max: ISODate; min: ISODate }) {
  const labels = ['The one before that', 'And the one before that', 'One more, if you know it'];
  return (
    <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
      {values.map((v, i) => (
        <div key={i} className="field">
          <label htmlFor={`past-${i}`}>{labels[i] ?? 'Earlier period'}</label>
          <input id={`past-${i}`} className="input" type="date" min={min} max={max} value={v} onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))} />
        </div>
      ))}
    </div>
  );
}

/** Valid, distinct earlier starts that are at least 15 days apart from each other and from known periods. */
export function cleanPastStarts(values: string[], known: ISODate[], today: ISODate): ISODate[] {
  const ok: ISODate[] = [];
  for (const v of [...values].filter(Boolean).sort().reverse()) {
    if (v > today || v < addDays(today, -730)) continue;
    const near = (d: ISODate) => Math.abs(diffDays(d, v)) < 15;
    if ([...known, ...ok].some(near)) continue;
    ok.push(v);
  }
  return ok;
}

export function PastPeriods() {
  const { data, forecast: f, update, today, tour } = useStore();
  const [values, setValues] = useState(['', '', '']);
  const [toast, showToast] = useToast();
  if (!data || !f) return null;
  const known = f.periods.map((p) => p.start);
  const earliest = known[0];
  const clean = cleanPastStarts(values, known, today);
  const save = () => {
    if (tour) return showToast('Nothing is saved in the tour.');
    update((d) => {
      const logs = { ...d.logs };
      for (const s of clean) logs[s] = { ...logs[s], date: s, flow: logs[s]?.flow ?? 'unspecified' };
      return { ...d, logs };
    });
    setValues(['', '', '']);
    showToast(`Added ${clean.length} period${clean.length === 1 ? '' : 's'}`);
    navigate('/app/insights');
  };

  return (
    <div className="stack" style={{ '--gap': '16px', maxWidth: 640 } as React.CSSProperties}>
      <PageTitle eyebrow="Your history" title="Add past periods">
        Start dates of earlier periods, even rough ones, give you sharper predictions and earlier patterns. Each one is saved only on this device.
      </PageTitle>
      <section className="card stack" style={{ '--gap': '14px' } as React.CSSProperties}>
        <p className="small muted">{earliest ? `Your earliest logged period starts ${formatLong(earliest)}. Add starts before that.` : 'Log your most recent period first from Today or the calendar, then add earlier ones here.'}</p>
        <PastPeriodsFields values={values} onChange={setValues} max={earliest ? addDays(earliest, -15) : today} min={addDays(today, -730)} />
        <EvidenceStrip hits={Math.min(known.length + clean.length, 6)} total={6} label={`${known.length + clean.length} period start${known.length + clean.length === 1 ? '' : 's'} known · 6 give the most personal predictions`} />
        <button className="btn" disabled={clean.length === 0} onClick={save}>Save {clean.length || ''} {clean.length === 1 ? 'period' : 'periods'}</button>
      </section>
      <p className="small faint">Each date is saved as a period day without intensity. You can add detail from the calendar.</p>
      <Toast msg={toast} />
    </div>
  );
}
