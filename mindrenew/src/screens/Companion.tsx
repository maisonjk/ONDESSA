import { useState } from 'react';
import { useStore, actions } from '../lib/store';
import { askCompanion, ApiError, type CompanionResult } from '../lib/api';
import { detectCrisis, bestMatch } from '../lib/matcher';
import { limitsFor, canSaveTruth } from '../lib/entitlements';
import { cloudEnabled } from '../lib/supabase';
import { track } from '../lib/analytics';
import { uid } from '../lib/id';
import { TRANSLATION, getVerse } from '../content/scripture';
import { Icon, toast } from '../ui/kit';
import { CrisisCard, openAuth, openPaywall } from '../ui/overlays';

const PROMPTS = [
  'I keep thinking I’m going to fail at my new job.',
  'I feel like God is far away lately.',
  'I can’t stop comparing my life to my friends’.',
  'I said something I regret and I can’t let it go.',
];

export function Companion() {
  const s = useStore();
  const [thought, setThought] = useState('');
  const [followAns, setFollowAns] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CompanionResult | null>(null);
  const [asked, setAsked] = useState('');
  const limit = limitsFor(s.plan).companionPerWeek;
  const remaining = Math.max(0, limit - s.companion.used);

  const ask = async (text: string, follow?: string) => {
    if (text.trim().length < 3) return;
    if (detectCrisis(`${text} ${follow ?? ''}`)) {
      setResult({ kind: 'crisis', lie: '', root: '', followUp: null, verses: [], explanation: '', truth: '', action: '', source: 'library', remaining: null });
      track('crisis_resources_shown', { from: 'companion' });
      return;
    }
    if (cloudEnabled && !s.userId) {
      openAuth('companion');
      return;
    }
    setBusy(true);
    try {
      const r = await askCompanion(text.trim(), follow?.trim());
      setResult(r);
      setAsked(text.trim());
      if (r.remaining !== null) actions.setCompanionUsed(limit - r.remaining);
      track('companion_used', { source: r.source, kind: r.kind, followUp: !!follow });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'limit_reached') {
        actions.setCompanionUsed(limit);
        track('companion_limit_hit', { plan: s.plan });
        if (s.plan === 'free') openPaywall('companion_limit');
        else toast(e.message);
      } else if (e instanceof ApiError && e.code === 'auth_required') {
        openAuth('companion');
      } else {
        // Offline or no server: fall back to the on-device library match so the user always gets Scripture.
        const lie = bestMatch(text);
        if (lie) {
          setResult({ kind: 'answer', lie: lie.text, root: '', followUp: null, verses: [lie.verseId, lie.alsoVerseIds[0]].filter(Boolean).map((id) => ({ id, ...pick(id) })),
            explanation: lie.reframe, truth: lie.truth, action: lie.action, source: 'library', remaining: null });
          setAsked(text.trim());
        } else toast('Couldn’t reach Truth Companion. Check your connection.');
      }
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!result || !result.verses[0]) return;
    if (!canSaveTruth(s)) return openPaywall('library_full');
    const match = bestMatch(asked);
    actions.saveTruth({ id: uid(), category: match?.categories[0] ?? 'other', lieText: result.lie || asked, truth: result.truth, verseId: result.verses[0].id,
      reflection: asked, savedAt: new Date().toISOString(), favorite: false, source: 'companion' });
    track('truth_saved', { source: 'companion' });
    toast('Saved to your Truth Library');
  };

  const reset = () => { setResult(null); setThought(''); setFollowAns(''); setAsked(''); };

  return (
    <div className="stack">
      <div>
        <p className="eyebrow gold">Truth Companion</p>
        <h1 className="h1">What’s on your mind?</h1>
      </div>
      <p className="muted">Describe a thought or situation. Truth Companion helps you notice the belief underneath it and find what Scripture says.</p>

      {!result && (
        <>
          <div className="field">
            <label htmlFor="thought" className="sr-only">Your thought</label>
            <textarea id="thought" className="textarea" style={{ minHeight: 140 }} placeholder="Write it the way it sounds in your head…" value={thought} maxLength={800} onChange={(e) => setThought(e.target.value)} />
          </div>
          <div className="chips">
            {PROMPTS.map((p) => <button key={p} className="chip sm" onClick={() => setThought(p)}>{p}</button>)}
          </div>
          <button className="btn primary block" disabled={busy || thought.trim().length < 3} onClick={() => ask(thought)}>
            {busy ? <span className="typing" aria-label="Thinking"><span /><span /><span /></span> : <><Icon name="send" size={18} /> Find the truth</>}
          </button>
          <p className="tiny muted center">{remaining} of {limit} conversations left this week{s.plan === 'free' ? ' · ' : ''}{s.plan === 'free' && <button className="link tiny" onClick={() => openPaywall('companion_limit')}>Get more</button>}</p>
        </>
      )}

      {result?.kind === 'crisis' && <CrisisCard onBack={reset} />}

      {result && result.kind !== 'crisis' && (
        <div className="stack">
          <div className="card flat tint"><p className="tiny muted">You shared</p><p className="mt-8" style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>“{asked}”</p></div>

          {result.lie && (
            <div className="lie-block enter">
              <span className="label-tag lie-tag">A belief you might be holding</span>
              <p className="lie-text mt-8" style={{ textDecoration: 'none' }}>“{result.lie}”</p>
              {result.root && <p className="small mt-8" style={{ color: 'var(--ink-2)' }}>{result.root}</p>}
            </div>
          )}

          {result.verses.map((v, i) => (
            <div key={v.id} className={`card ${i === 0 ? 'reveal' : 'enter-3'}`} style={{ padding: 22 }}>
              <span className="label-tag scripture-tag">Scripture · {TRANSLATION}</span>
              <blockquote className={`scripture ${i === 0 ? '' : 'sm'} mt-16`} style={{ margin: '16px 0 0' }}>{v.text}</blockquote>
              <p className="ref mt-8">{v.ref}</p>
            </div>
          ))}

          <div className="card stack-sm enter-3">
            <span className="label-tag ai-tag" style={{ alignSelf: 'flex-start' }}>{result.source === 'ai' ? 'Reflection · AI-generated' : 'Reflection · MindRenew library'}</span>
            <p>{result.explanation}</p>
            <hr className="divider" />
            <p className="eyebrow gold">Your truth</p>
            <p className="truth-statement">{result.truth}</p>
            <hr className="divider" />
            <p className="eyebrow">Today</p>
            <p>{result.action}</p>
          </div>

          {result.kind === 'followup' && result.followUp && (
            <div className="card stack-sm">
              <p className="h3" style={{ fontSize: 16 }}>{result.followUp}</p>
              <textarea className="textarea" style={{ minHeight: 90, fontSize: 16 }} value={followAns} onChange={(e) => setFollowAns(e.target.value)} placeholder="Optional" />
              <button className="btn secondary" disabled={busy || followAns.trim().length < 2} onClick={() => ask(asked, followAns)}>{busy ? 'Thinking…' : 'Go deeper'}</button>
            </div>
          )}

          <div className="row">
            <button className="btn primary grow" onClick={save}><Icon name="bookmark" size={18} /> Save truth</button>
            <button className="btn secondary" onClick={reset}>New thought</button>
          </div>
          <p className="tiny muted center">Scripture is shown from the {TRANSLATION} exactly as written. Reflections are generated to help you apply it and aren’t a word from God. Truth Companion isn’t a substitute for a pastor, counselor or doctor.</p>
        </div>
      )}
    </div>
  );
}

function pick(id: string) {
  const v = getVerse(id);
  return { ref: v.ref, text: v.text, context: v.context };
}
