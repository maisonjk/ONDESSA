import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, LIE_BY_ID, liesForCategory, type CategoryId, type Lie } from '../content/lies';
import { JOURNEY_BY_ID } from '../content/journeys';
import { getVerse } from '../content/scripture';
import { actions, useStore } from '../lib/store';
import { bestMatch, detectCrisis } from '../lib/matcher';
import { canSaveTruth, canStartRenewal, limitsFor } from '../lib/entitlements';
import { isoDate } from '../lib/dates';
import { currentStreak } from '../lib/stats';
import { uid } from '../lib/id';
import { track } from '../lib/analytics';
import { cloudEnabled } from '../lib/supabase';
import { back, go, type Route } from '../router';
import { Icon, ScriptureBlock, Toggle } from '../ui/kit';
import { CrisisCard, openAuth, openPaywall } from '../ui/overlays';
import { WeekDots } from './Home';

const STEPS = ['Recognize', 'Identify the lie', 'Discover God’s truth', 'Make it personal', 'Live the truth'];

export function Renewal({ route }: { route: Extract<Route, { name: 'renewal' }> }) {
  const s = useStore();
  const preset = route.lieId ? LIE_BY_ID[route.lieId] : undefined;
  const resume = route.resume && s.draft ? s.draft : null;

  const [step, setStep] = useState<number>(resume?.step ?? (preset ? 2 : 0));
  const [category, setCategory] = useState<CategoryId | null>(resume?.category ?? preset?.categories[0] ?? null);
  const [lieId, setLieId] = useState<string | null>(resume?.lieId ?? preset?.id ?? null);
  const [customLie, setCustomLie] = useState(resume?.customLie ?? '');
  const [reflection, setReflection] = useState(resume?.reflection ?? '');
  const [saveIt, setSaveIt] = useState(true);
  const [crisis, setCrisis] = useState(false);
  const [done, setDone] = useState(false);
  const journeyId = resume?.journeyId ?? route.journeyId;
  const started = useRef(false);

  const allowed = canStartRenewal(s) || !!resume;
  const [isFirst] = useState(() => s.renewals.length === 0);

  // Matched lie for a custom thought (deterministic, on-device, free).
  const lie: Lie | null = useMemo(() => {
    if (lieId) return LIE_BY_ID[lieId] ?? null;
    if (customLie.trim().length > 2) return bestMatch(customLie, category ?? undefined);
    return null;
  }, [lieId, customLie, category]);

  useEffect(() => {
    if (!started.current && allowed) {
      started.current = true;
      track('renewal_started', { resume: !!resume, journeyId, preset: !!preset, first: isFirst });
    }
  }, [allowed, resume, journeyId, preset, isFirst]);

  // Persist progress so "Continue" on Home always works.
  useEffect(() => {
    if (done || !allowed || step === 0) return;
    actions.setDraft({ step, category, lieId, customLie, reflection, journeyId, updatedAt: new Date().toISOString() });
  }, [step, category, lieId, customLie, reflection, journeyId, done, allowed]);

  if (!allowed && !done) return <DailyLimit />;

  const next = () => {
    track('renewal_step', { step: step + 1, name: STEPS[step] });
    setStep((n) => n + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const prev = () => (step === 0 || (preset && step === 2) ? back() : setStep((n) => n - 1));

  const continueFromLie = () => {
    if (!lieId && detectCrisis(customLie)) {
      setCrisis(true);
      track('crisis_resources_shown', { from: 'renewal' });
      return;
    }
    if (!lieId && !lie) return;
    next();
  };

  const complete = () => {
    if (!lie) return;
    const lieText = lieId ? lie.text : customLie.trim();
    const now = new Date().toISOString();
    actions.addRenewal({
      id: uid(), date: isoDate(), createdAt: now, category: category ?? lie.categories[0], lieId: lie.id, lieText,
      verseId: lie.verseId, reflection: reflection.trim(), action: lie.action, journeyId,
    });
    if (saveIt && canSaveTruth(s)) {
      actions.saveTruth({ id: uid(), category: category ?? lie.categories[0], lieText, truth: lie.truth, verseId: lie.verseId, reflection: reflection.trim(), savedAt: now, favorite: false, source: 'renewal' });
      track('truth_saved', { source: 'renewal', category });
    }
    track('renewal_completed', { category, lieId: lie.id, custom: !lieId, reflected: !!reflection.trim(), journeyId });
    if (isFirst) track('first_renewal_completed', { category });
    setDone(true);
    window.scrollTo({ top: 0 });
  };

  if (done && lie) return <Complete lie={lie} reflection={reflection} isFirst={isFirst} journeyId={journeyId} />;

  const ordered = [...CATEGORIES].sort((a, b) => Number(s.profile.patterns.includes(b.id)) - Number(s.profile.patterns.includes(a.id)));
  const options = category ? liesForCategory(category) : [];

  return (
    <div className="stack">
      <div className="flow-top">
        <button className="icon-btn plain" onClick={prev} aria-label="Back"><Icon name="back" /></button>
        <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={5} aria-valuenow={step + 1}><div style={{ width: `${((step + 1) / 5) * 100}%` }} /></div>
        <button className="icon-btn plain" onClick={() => go({ name: 'home' })} aria-label="Close"><Icon name="close" /></button>
      </div>

      <p className="step-label">Step {step + 1} · {STEPS[step]}{journeyId && JOURNEY_BY_ID[journeyId] ? ` · ${JOURNEY_BY_ID[journeyId].title.split(':')[0]}` : ''}</p>

      {step === 0 && (
        <div className="stack" key="s0">
          <h1 className="h1 enter">What has been weighing on your mind today?</h1>
          <p className="lead enter-2">Choose what’s closest. There’s no wrong answer.</p>
          <div className="grid2 enter-3">
            {ordered.map((c) => (
              <button key={c.id} className="option" aria-pressed={category === c.id} onClick={() => { setCategory(c.id); setLieId(null); }}>
                <strong>{c.label}</strong>
                <span>{c.hint}</span>
              </button>
            ))}
          </div>
          <div className="flow-footer"><button className="btn primary block" disabled={!category} onClick={next}>Continue</button></div>
        </div>
      )}

      {step === 1 && category && (
        <div className="stack" key="s1">
          <h1 className="h1 enter">What might you be believing about yourself, God, or your situation?</h1>
          <p className="lead enter-2">Pick the thought that sounds most familiar, or put it in your own words.</p>
          {crisis ? <CrisisCard onBack={() => setCrisis(false)} /> : (
            <>
              {options.length > 0 && (
                <div className="stack-sm enter-3" role="radiogroup">
                  {options.map((l) => (
                    <button key={l.id} className="option wide" role="radio" aria-checked={lieId === l.id} aria-pressed={lieId === l.id} onClick={() => { setLieId(l.id); setCustomLie(''); }}>
                      <span style={{ fontFamily: 'var(--serif)', fontSize: 19, color: 'var(--ink)' }}>“{l.text}”</span>
                      <span className="radio">{lieId === l.id && <Icon name="check" size={14} />}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="field enter-4">
                <label htmlFor="own">{options.length ? 'Or in my own words' : 'In my own words'}</label>
                <textarea id="own" className="textarea" placeholder="e.g. “If I slow down, everything will fall apart.”" value={customLie} maxLength={400}
                  onChange={(e) => { setCustomLie(e.target.value); if (e.target.value) setLieId(null); }} />
                {!lieId && customLie.trim().length > 2 && lie && <p className="tiny muted">We’ll match this to the closest pattern in our Scripture library. Nothing you write leaves your device.</p>}
              </div>
              <div className="flow-footer"><button className="btn primary block" disabled={!lieId && customLie.trim().length < 3} onClick={continueFromLie}>See what God says</button></div>
            </>
          )}
        </div>
      )}

      {step === 2 && lie && (
        <div className="stack" key="s2">
          <div className="lie-block enter">
            <span className="label-tag lie-tag">The lie</span>
            <p className="lie-text mt-8">“{lieId ? lie.text : customLie.trim()}”</p>
          </div>
          <div className="card reveal" style={{ padding: 24 }}>
            <p className="eyebrow gold" style={{ marginBottom: 14 }}>What God says</p>
            <ScriptureBlock verseId={lie.verseId} size="lg" tag />
          </div>
          <div className="card flat tint enter-3 stack-sm">
            <span className="label-tag ai-tag" style={{ alignSelf: 'flex-start' }}>Reframe</span>
            <p style={{ fontSize: 17 }}>{lie.reframe}</p>
          </div>
          <details className="enter-4">
            <summary className="small muted" style={{ cursor: 'pointer', padding: '8px 0' }}>Read the context of {getVerse(lie.verseId).ref}</summary>
            <p className="small mt-8" style={{ color: 'var(--ink-2)' }}>{getVerse(lie.verseId).context}</p>
          </details>
          {!lieId && <p className="tiny muted">Matched to the pattern: “{lie.text}”</p>}
          <div className="flow-footer"><button className="btn primary block" onClick={next}>Make it personal</button></div>
        </div>
      )}

      {step === 3 && lie && (
        <div className="stack" key="s3">
          <h1 className="h1 enter">What would change today if you genuinely believed this?</h1>
          <div className="card enter-2 stack-sm">
            <p className="eyebrow gold">Your truth</p>
            <p className="truth-statement">{lie.truth}</p>
            <p className="ref">{getVerse(lie.verseId).ref}</p>
          </div>
          <div className="field enter-3">
            <label htmlFor="ref">{lie.reflect}</label>
            <textarea id="ref" className="textarea" placeholder="Optional. Write as much or as little as you like." value={reflection} maxLength={2000} onChange={(e) => setReflection(e.target.value)} />
          </div>
          <div className="row between card flat enter-4" style={{ padding: 16 }}>
            <div>
              <p className="h3" style={{ fontSize: 15 }}>Save to my Truth Library</p>
              <p className="tiny muted">{canSaveTruth(s) ? 'Revisit it anytime.' : `Free library is full (${limitsFor(s.plan).savedTruths}). Upgrade for unlimited.`}</p>
            </div>
            <Toggle checked={saveIt && canSaveTruth(s)} onChange={(v) => (canSaveTruth(s) ? setSaveIt(v) : openPaywall('library_full'))} label="Save to Truth Library" />
          </div>
          <div className="flow-footer"><button className="btn primary block" onClick={next}>{reflection.trim() ? 'Continue' : 'Skip for now'}</button></div>
        </div>
      )}

      {step === 4 && lie && (
        <div className="stack" key="s4">
          <h1 className="h1 enter">Live the truth today.</h1>
          <p className="lead enter-2">One small step is enough. Truth becomes real when we act on it.</p>
          <div className="card hero enter-3" style={{ padding: 24 }}>
            <p className="eyebrow">Today’s action</p>
            <p className="h2 mt-8" style={{ position: 'relative', zIndex: 1 }}>{lie.action}</p>
          </div>
          <div className="flow-footer"><button className="btn primary block" onClick={complete}><Icon name="check" /> I’ll do this today</button></div>
        </div>
      )}
    </div>
  );
}

function Complete({ lie, reflection, isFirst, journeyId }: { lie: Lie; reflection: string; isFirst: boolean; journeyId?: string }) {
  const s = useStore();
  const streak = currentStreak(s.renewals);
  const journey = journeyId ? JOURNEY_BY_ID[journeyId] : null;
  useEffect(() => {
    if (isFirst && cloudEnabled && !s.userId) {
      const t = setTimeout(() => { openAuth('first_renewal'); track('signup_prompted', { after: 'first_renewal' }); }, 1600);
      return () => clearTimeout(t);
    }
  }, [isFirst, s.userId]);
  return (
    <div className="stack" style={{ paddingTop: 24 }}>
      <div className="center stack-sm enter">
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--gold-soft)', color: 'var(--gold)', display: 'grid', placeItems: 'center', margin: '0 auto' }}><Icon name="check" size={30} /></div>
        <p className="eyebrow gold mt-16">{streak > 1 ? `${streak} days in a row` : isFirst ? 'Your first renewal' : 'Renewed'}</p>
        <h1 className="h1">Today’s mind renewal is complete.</h1>
      </div>
      <div className="card reveal" style={{ padding: 24 }}>
        <ScriptureBlock verseId={lie.verseId} />
        <hr className="divider mt-16" />
        <p className="truth-statement mt-16" style={{ fontSize: 19 }}>{lie.truth}</p>
        {reflection.trim() && <p className="small muted mt-8">“{reflection.trim().slice(0, 160)}{reflection.trim().length > 160 ? '…' : ''}”</p>}
      </div>
      <div className="card flat enter-3"><WeekDots /></div>
      {journey && <p className="small muted center">Day {Math.min(s.journeys[journey.id] ?? 0, 7)} of 7 in {journey.title.split(':')[0]} complete.</p>}
      <p className="small muted center enter-4">Come back tomorrow. One small encounter with God’s truth, every day, changes how you think.</p>
      <div className="flow-footer stack-sm">
        <button className="btn primary block" onClick={() => go({ name: 'home' }, true)}>Done</button>
        <button className="btn ghost block" onClick={() => go({ name: 'library' }, true)}>Open my Truth Library</button>
      </div>
    </div>
  );
}

function DailyLimit() {
  const s = useStore();
  const today = s.renewals.filter((r) => r.date === isoDate()).at(-1);
  useEffect(() => { openPaywall('second_renewal'); }, []);
  return (
    <div className="stack" style={{ paddingTop: 24 }}>
      <button className="icon-btn plain" onClick={() => back()} aria-label="Back"><Icon name="back" /></button>
      <h1 className="h1">You’ve renewed your mind today.</h1>
      <p className="lead">Your free daily renewal is complete. Sit with today’s truth, and come back tomorrow for the next one.</p>
      {today && <div className="card"><ScriptureBlock verseId={today.verseId} /></div>}
      <button className="btn secondary block" onClick={() => openPaywall('second_renewal')}>Unlimited renewals with Premium</button>
      <button className="btn ghost block" onClick={() => go({ name: 'companion' })}>Talk it through with Truth Companion</button>
    </div>
  );
}
