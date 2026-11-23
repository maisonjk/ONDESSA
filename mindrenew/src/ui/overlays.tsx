import { useEffect, useState } from 'react';
import { Icon, Sheet, toast } from './kit';
import { PRICING } from '../lib/entitlements';
import { startCheckout, ApiError } from '../lib/api';
import { supabase, cloudEnabled } from '../lib/supabase';
import { useStore, actions, getState } from '../lib/store';
import { track } from '../lib/analytics';

/* ---------- global open/close ---------- */
type Overlay = { kind: 'paywall'; reason: string } | { kind: 'auth'; reason: string } | null;
let setOverlay: ((o: Overlay) => void) | null = null;

export function openPaywall(reason: string) {
  setOverlay?.({ kind: 'paywall', reason });
}
export function openAuth(reason: string) {
  setOverlay?.({ kind: 'auth', reason });
}

export function OverlayHost() {
  const [o, setO] = useState<Overlay>(null);
  useEffect(() => {
    setOverlay = setO;
    return () => { setOverlay = null; };
  }, []);
  const close = () => setO(null);
  return (
    <>
      <Sheet open={o?.kind === 'paywall'} onClose={close} label="MindRenew Premium">{o?.kind === 'paywall' && <Paywall reason={o.reason} onClose={close} />}</Sheet>
      <Sheet open={o?.kind === 'auth'} onClose={close} label="Create your account">{o?.kind === 'auth' && <AuthForm reason={o.reason} onClose={close} />}</Sheet>
    </>
  );
}

/* ---------- paywall ---------- */
const HEADLINES: Record<string, string> = {
  second_renewal: 'Go deeper, any time you need it.',
  library_full: 'Keep every truth God shows you.',
  companion_limit: 'Talk through anything, every day.',
  journeys: 'Guided journeys for lasting change.',
  insights: 'See how your thinking is changing.',
  settings: 'MindRenew Premium',
};

function Paywall({ reason, onClose }: { reason: string; onClose: () => void }) {
  const s = useStore();
  const [interval, setInterval] = useState<'annual' | 'monthly'>('annual');
  const [busy, setBusy] = useState(false);
  useEffect(() => { track('paywall_viewed', { reason }); }, [reason]);

  const subscribe = async () => {
    if (!cloudEnabled) {
      toast('Billing activates once Supabase and Stripe keys are configured.');
      return;
    }
    if (!s.userId) {
      onClose();
      openAuth('subscribe');
      return;
    }
    setBusy(true);
    track('checkout_started', { interval, reason });
    try {
      const { url } = await startCheckout(interval);
      location.href = url;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Couldn’t start checkout. Try again.');
      setBusy(false);
    }
  };

  if (s.plan === 'premium') {
    return (
      <div className="stack center">
        <p className="eyebrow gold">Premium</p>
        <h2 className="h2">You have everything unlocked.</h2>
        <button className="btn primary block" onClick={onClose}>Continue</button>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="stack-sm">
        <p className="eyebrow gold">MindRenew Premium</p>
        <h2 className="h1" style={{ fontSize: 28 }}>{HEADLINES[reason] ?? HEADLINES.settings}</h2>
      </div>
      <ul className="check-list">
        {[
          'Unlimited daily renewals, whenever a thought hits',
          'Truth Companion for deeper, personal conversations',
          'Unlimited Truth Library with search',
          'Guided 7-day renewal journeys',
          'Weekly insights into your thought patterns',
        ].map((f) => <li key={f}><Icon name="check" size={18} />{f}</li>)}
      </ul>
      <div className="stack-sm mt-8">
        <button className="plan" aria-pressed={interval === 'annual'} onClick={() => setInterval('annual')}>
          <span className="badge save">Save {PRICING.annual.savings}</span>
          <div className="row between">
            <div><p className="h3">Annual</p><p className="small muted">7-day free trial, then {PRICING.annual.label}/year</p></div>
            <div style={{ textAlign: 'right' }}><p className="h3">{PRICING.annual.monthlyEquivalent}</p><p className="tiny muted">per month</p></div>
          </div>
        </button>
        <button className="plan" aria-pressed={interval === 'monthly'} onClick={() => setInterval('monthly')}>
          <div className="row between">
            <div><p className="h3">Monthly</p><p className="small muted">7-day free trial, cancel anytime</p></div>
            <div style={{ textAlign: 'right' }}><p className="h3">{PRICING.monthly.label}</p><p className="tiny muted">per month</p></div>
          </div>
        </button>
      </div>
      <button className="btn primary block" disabled={busy} onClick={subscribe}>{busy ? 'Opening checkout…' : 'Start free trial'}</button>
      <p className="tiny muted center">God’s Word is always free in MindRenew. Premium adds depth, personalization and convenience.</p>
      <button className="btn ghost block" onClick={onClose}>Not now</button>
    </div>
  );
}

/* ---------- auth (magic link) ---------- */
const AUTH_COPY: Record<string, { title: string; body: string }> = {
  first_renewal: { title: 'Keep what God is doing in you.', body: 'Create a free account so your renewals and saved truths are safe and sync across your devices.' },
  companion: { title: 'Create a free account to use Truth Companion.', body: 'Your conversations stay private. Free accounts include 3 Companion conversations a week.' },
  subscribe: { title: 'Create your account first.', body: 'Your subscription is tied to your account so it works on every device.' },
  settings: { title: 'Sign in to MindRenew', body: 'We’ll email you a secure sign-in link. No password needed.' },
};

function AuthForm({ reason, onClose }: { reason: string; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const copy = AUTH_COPY[reason] ?? AUTH_COPY.settings;

  if (!supabase) {
    return (
      <div className="stack">
        <h2 className="h2">Accounts are off in local mode</h2>
        <p className="muted">Everything you do is saved on this device. Add Supabase keys (see README) to enable accounts, sync and subscriptions.</p>
        <button className="btn primary block" onClick={onClose}>Got it</button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: location.origin } });
    setBusy(false);
    if (error) toast(error.message);
    else {
      setSent(true);
      track('signed_in', { method: 'magic_link_sent', reason });
    }
  };

  if (sent) {
    return (
      <div className="stack center">
        <p className="eyebrow gold">Check your email</p>
        <h2 className="h2">We sent a link to {email}</h2>
        <p className="muted">Tap it on this device to sign in. Everything you’ve done so far comes with you.</p>
        <button className="btn secondary block" onClick={onClose}>Close</button>
      </div>
    );
  }
  return (
    <form className="stack" onSubmit={submit}>
      <h2 className="h2">{copy.title}</h2>
      <p className="muted">{copy.body}</p>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <button className="btn primary block" disabled={busy || !email.includes('@')}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
      <button type="button" className="btn ghost block" onClick={onClose}>Maybe later</button>
    </form>
  );
}

/* ---------- crisis ---------- */
export function CrisisCard({ onBack }: { onBack?: () => void }) {
  return (
    <div className="card stack" role="alert" style={{ borderColor: 'var(--lie)' }}>
      <p className="eyebrow" style={{ color: 'var(--lie)' }}>You matter</p>
      <h2 className="h2">It sounds like you’re carrying something really heavy.</h2>
      <p>Please talk to someone who can be with you right now. You don’t have to face this alone, and reaching out is a brave, right thing to do.</p>
      <div className="stack-sm">
        <a className="btn primary block" href="tel:988">Call 988</a>
        <a className="btn secondary block" href="sms:988">Text 988</a>
        <p className="small muted">988 is the US Suicide &amp; Crisis Lifeline, free and available 24/7. Outside the US, call your local emergency number. If you’re in immediate danger, call 911.</p>
      </div>
      <p className="scripture sm">“Yahweh is near to those who have a broken heart, and saves those who have a crushed spirit.”</p>
      <p className="ref">Psalm 34:18</p>
      {onBack && <button className="btn ghost" onClick={onBack}>Go back</button>}
    </div>
  );
}

/** Dev-only helper to preview Premium without Stripe. Not reachable in production builds. */
export function devTogglePremium() {
  actions.setPlan(getState().plan === 'premium' ? 'free' : 'premium');
}
