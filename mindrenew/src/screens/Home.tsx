import { useEffect } from 'react';
import { useStore } from '../lib/store';
import { addDays, greeting, isoDate, weekStart } from '../lib/dates';
import { currentStreak, daysThisWeek, resurfaceTruth } from '../lib/stats';
import { dailyTruthFor, weeklyThemeFor } from '../content/daily';
import { getVerse } from '../content/scripture';
import { LIE_BY_ID } from '../content/lies';
import { JOURNEYS } from '../content/journeys';
import { canStartRenewal } from '../lib/entitlements';
import { track } from '../lib/analytics';
import { go } from '../router';
import { Icon, Logo, ScriptureBlock } from '../ui/kit';
import { openPaywall } from '../ui/overlays';

export function WeekDots() {
  const s = useStore();
  const today = isoDate();
  const start = weekStart(today);
  const done = new Set(s.renewals.map((r) => r.date));
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <div className="week" aria-label={`${daysThisWeek(s.renewals)} renewals this week`}>
      {labels.map((l, i) => {
        const d = addDays(start, i);
        const isDone = done.has(d);
        return (
          <div className="day" key={d}>
            <span className={`dot ${isDone ? 'done' : ''} ${d === today ? 'today' : ''}`}>{isDone && <Icon name="check" size={14} />}</span>
            {l}
          </div>
        );
      })}
    </div>
  );
}

export function Home() {
  const s = useStore();
  const today = isoDate();
  const doneToday = s.renewals.some((r) => r.date === today);
  const todays = s.renewals.filter((r) => r.date === today).at(-1);
  const streak = currentStreak(s.renewals);
  const week = daysThisWeek(s.renewals);
  const daily = dailyTruthFor();
  const theme = weeklyThemeFor();
  const resurfaced = s.profile.reminder.truthResurfacing ? resurfaceTruth(s.truths) : null;
  const draft = s.draft && !doneToday && s.draft.step > 0 ? s.draft : null;
  const name = s.profile.name.trim();

  useEffect(() => { track('daily_truth_viewed', { id: daily.id }); }, [daily.id]);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <header className="row between">
        <span className="brand"><Logo size={28} /> MindRenew</span>
        <button className="avatar" onClick={() => go({ name: 'settings' })} aria-label="Profile and settings">{name ? name[0].toUpperCase() : <Icon name="settings" size={18} />}</button>
      </header>

      <div className="stack-sm enter">
        <h1 className="h1">{greeting()}{name ? `, ${name}` : ''}.</h1>
        <p className="lead">{doneToday ? 'You’ve met with God’s truth today.' : 'Let’s renew your mind.'}</p>
      </div>

      {/* Primary action */}
      <section className="card hero enter-2" style={{ padding: 22 }} aria-label="Today’s renewal">
        <div className="stack" style={{ position: 'relative', zIndex: 1 }}>
          <div className="row between">
            <p className="eyebrow">Today’s renewal · {s.profile.minutes} min</p>
            {streak > 0 && <span className="row" style={{ gap: 4, fontSize: 13, fontWeight: 600 }}><Icon name="flame" size={16} /> {streak}</span>}
          </div>
          {doneToday && todays ? (
            <>
              <p className="scripture sm">{getVerse(todays.verseId).text}</p>
              <p className="ref">{getVerse(todays.verseId).ref}</p>
              <p className="small" style={{ opacity: 0.85 }}>Today: {LIE_BY_ID[todays.lieId ?? '']?.action ?? todays.action}</p>
            </>
          ) : draft ? (
            <>
              <p className="h2">Pick up where you left off.</p>
              <p className="small" style={{ opacity: 0.8 }}>You were on step {draft.step + 1} of 5.</p>
            </>
          ) : (
            <>
              <p className="h2" style={{ fontSize: 26 }}>What lie are you believing today?</p>
              <p className="small" style={{ opacity: 0.8 }}>And what does God say instead?</p>
            </>
          )}
          <WeekDots />
          {doneToday ? (
            <button className="btn primary block" onClick={() => (canStartRenewal(s) ? go({ name: 'renewal' }) : openPaywall('second_renewal'))}>Renew again</button>
          ) : draft ? (
            <button className="btn primary block" onClick={() => go({ name: 'renewal', resume: true })}>Continue renewal <Icon name="arrow" size={18} /></button>
          ) : (
            <button className="btn primary block" onClick={() => go({ name: 'renewal' })}>Start today’s renewal <Icon name="arrow" size={18} /></button>
          )}
        </div>
      </section>

      {/* Daily Truth */}
      <section className="card enter-3 stack" aria-label="Daily truth">
        <div className="row between"><p className="eyebrow gold">Daily truth</p><span className="tiny muted">{new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div>
        <h2 className="h3" style={{ fontSize: 18 }}>{daily.title}</h2>
        <ScriptureBlock verseId={daily.verseId} size="sm" />
        <p className="small" style={{ color: 'var(--ink-2)' }}>{daily.explanation}</p>
        <div className="card flat tint stack-sm" style={{ padding: 16 }}>
          <p className="small"><strong>Reflect.</strong> {daily.question}</p>
          <p className="small"><strong>Apply.</strong> {daily.application}</p>
        </div>
      </section>

      {/* Resurfaced truth */}
      {resurfaced && (
        <button className="card pressable enter-4 stack-sm" onClick={() => go({ name: 'library' })} aria-label="Open a truth you saved">
          <p className="eyebrow">A truth you saved</p>
          <p className="truth-statement" style={{ fontSize: 19 }}>{resurfaced.truth}</p>
          <p className="ref">{getVerse(resurfaced.verseId).ref}</p>
        </button>
      )}

      {/* Progress glance */}
      <div className="stat-grid enter-4">
        <button className="stat pressable" onClick={() => go({ name: 'progress' })}><div className="num">{week}<span className="muted" style={{ fontSize: 18 }}>/7</span></div><div className="lbl">Days this week</div></button>
        <button className="stat pressable" onClick={() => go({ name: 'library' })}><div className="num">{s.truths.length}</div><div className="lbl">Truths saved</div></button>
      </div>

      {/* Weekly theme + journeys */}
      <section className="card flat tint stack-sm">
        <p className="eyebrow">This week’s theme</p>
        <p className="h2" style={{ fontSize: 21 }}>{theme.title}</p>
        <p className="small muted">{theme.subtitle}</p>
        <button className="btn secondary small mt-8" style={{ alignSelf: 'flex-start' }} onClick={() => go({ name: 'journeys' })}><Icon name="route" size={16} /> {JOURNEYS.length} guided journeys</button>
      </section>

      <p className="tiny muted center" style={{ padding: '8px 16px' }}>“Be transformed by the renewing of your mind.” Romans 12:2</p>
    </div>
  );
}
