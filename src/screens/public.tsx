import { useEffect, useState } from 'react';
import { Link, navigate } from '../app/router';
import { useStore } from '../app/store';
import { ARTICLES, CATEGORIES } from '../content/library';
import type { Goal } from '../engine';
import { COMPANY } from '../content/company';
import { activateToken, previewPassAvailable } from '../data/entitlement';
import { isNative, openExternal, platform } from '../platform';
import { loadProducts, purchase, restorePurchases, type StorePlan } from '../platform/purchases';
import { scheduleTrialReminder } from '../platform/notifications';
import { diffDays, forecast, formatShort, localToday, phaseOn, pregnancyStatus, PHASE_COPY } from '../engine';
import { tourData } from '../app/tour';
import { ConfidenceBadge, DotRing, Icon, Mark, MedicalNote, PhasePill } from '../ui/components';

export const PRICES = {
  monthly: { amount: 8.99, label: '$8.99', per: 'per month' },
  annual: { amount: 59.99, label: '$59.99', per: 'per year' },
} as const;

/** What a member gets, framed as outcomes, ordered by what the person said they came for. */
const BENEFITS: [string, string][] = [
  ['Know what’s coming', 'Period and fertile-window predictions that show how sure they are, and get sharper every cycle.'],
  ['Understand your body', 'Insights link your symptoms, mood and energy to your own cycle. Never generic averages.'],
  ['Trying to conceive', 'Best days with the honest range, plus optional LH, temperature and mucus tracking.'],
  ['Pregnancy, week by week', 'A calm calendar, appointment reminders and space to note how you feel.'],
  ['Irregular or changing cycles', 'Perimenopause and irregular-cycle support that stays honest when patterns shift.'],
  ['Private, for real', 'No account, no ads, no data sold. Passcode encryption, encrypted backups, delete anytime.'],
];

const BENEFIT_ORDER: Record<Goal, number[]> = {
  understand: [0, 1, 5, 4, 2, 3],
  conceive: [2, 0, 1, 5, 3, 4],
  pregnant: [3, 5, 1, 0, 2, 4],
  perimenopause: [4, 1, 0, 5, 2, 3],
};

function benefitsFor(goal: Goal): [string, string][] {
  return BENEFIT_ORDER[goal].map((i) => BENEFITS[i]!);
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  const { data, entitlement, tour } = useStore();
  const inApp = data && !tour && entitlement.status === 'active';
  const setUp = data && !tour;
  return (
    <div>
      <header className="topbar">
        <div className="wrap">
          {isNative ? (
            <>
              {inApp ? <Link to="/app" className="btn ghost"><Icon name="back" size={18} /> Back</Link>
                : setUp ? <Link to="/app/privacy" className="btn ghost">Your data</Link>
                  : <button className="btn ghost" onClick={() => window.history.back()}><Icon name="back" size={18} /> Back</button>}
              <span className="wordmark"><Mark /> Ondessa</span>
            </>
          ) : (
            <>
              <Link to="/" className="wordmark"><Mark /> Ondessa</Link>
              <nav className="row" style={{ '--gap': '4px' } as React.CSSProperties}>
                <Link to="/library" className="btn ghost hide-narrow">Library</Link>
                <Link to="/plans" className="btn ghost">Pricing</Link>
                {inApp ? <Link to="/app" className="btn">Open</Link> : !setUp && <Link to="/start" className="btn">Start</Link>}
              </nav>
            </>
          )}
        </div>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <div className="wrap stack" style={{ '--gap': '10px' } as React.CSSProperties}>
          <div className="row wrap-row" style={{ '--gap': '18px' } as React.CSSProperties}>
            <Link to="/privacy">Privacy</Link>
            <Link to="/legal">Terms & disclaimers</Link>
            <Link to="/help">Help</Link>
            {!isNative && <Link to="/library">Library</Link>}
          </div>
          <MedicalNote />
          <p className="tiny">Ondessa is a working name pending trademark clearance. © 2026.</p>
        </div>
      </footer>
    </div>
  );
}

export function Landing() {
  const { startTour } = useStore();
  const tour = () => {
    startTour();
    navigate('/app');
  };
  return (
    <PublicShell>
      <div className="landing">
        <section className="hero wrap">
          <div className="hero-grid">
            <div className="stack fade-in" style={{ '--gap': '22px' } as React.CSSProperties}>
              <span className="eyebrow">Cycle · Fertility · Pregnancy</span>
              <h1>Know your rhythm. <em>Keep it yours.</em></h1>
              <p className="lede">
                Ondessa learns your patterns from what you log, explains every prediction, and keeps your data on your device. No account. No ads. No guesswork dressed up as AI.
              </p>
              <div className="row wrap-row">
                <button className="btn" onClick={() => navigate('/start')}>Get started</button>
                <button className="btn secondary" onClick={tour}>Take the tour</button>
              </div>
              <p className="small faint">The tour uses sample data and saves nothing.</p>
            </div>
            <LivePreview />
          </div>
        </section>

        <Audiences />

        <section>
          <div className="wrap stack" style={{ '--gap': '28px' } as React.CSSProperties}>
            <h2 style={{ maxWidth: '18ch' }}>Not another period calendar.</h2>
            <div className="pillars">
              {[
                { icon: 'spark', t: 'Insights from your own logs', d: 'Observations drawn only from your logs, with the evidence and limits written next to every one.' },
                { icon: 'info', t: 'Predictions that show their work', d: 'Three honest confidence levels. Wider windows when your cycles vary. Never a fact when it is an estimate.' },
                { icon: 'shield', t: 'Private by architecture', d: 'Your data lives on your device. Optional passcode encryption. Export or permanently delete in one tap.' },
              ].map((p) => (
                <div key={p.t} className="card stack" style={{ '--gap': '10px', padding: 28 } as React.CSSProperties}>
                  <span style={{ color: 'var(--ink)' }}><Icon name={p.icon} size={26} /></span>
                  <h3>{p.t}</h3>
                  <p className="muted small">{p.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="wrap stack" style={{ '--gap': '24px' } as React.CSSProperties}>
          <div className="stack" style={{ '--gap': '12px', maxWidth: 640 } as React.CSSProperties}>
            <span className="eyebrow">Colour that means something</span>
            <h2>Your cycle has four phases. Ondessa shows you <em>where you are.</em></h2>
            <p className="muted">The app takes on the colour of your current phase, estimated from your own history. Plan a pregnancy, follow a pregnancy week by week, or track changing cycles in perimenopause. You choose what to track, and nothing assumes you want children or have textbook cycles.</p>
          </div>
          <div className="phase-key">
            {([
              ['menstrual', 'Period', 'Logged by you. Day 1 starts each cycle.'],
              ['follicular', 'Follicular', 'After your period, building towards ovulation.'],
              ['fertile', 'Fertile window', 'Estimated. Never a confirmation of ovulation.'],
              ['luteal', 'Luteal', 'Estimated. Where premenstrual patterns often show up.'],
            ] as const).map(([ph, t, d]) => (
              <div key={ph} className={`phase-${ph}`}>
                <span style={{ width: 12, height: 12, borderRadius: 99, background: 'var(--phase)' }} />
                <strong>{t}</strong>
                <span className="small muted">{d}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="wrap center stack" style={{ '--gap': '14px', alignItems: 'center' } as React.CSSProperties}>
          <span className="eyebrow">Membership</span>
          <h2 style={{ maxWidth: '22ch' }}>A tracker that works <em>for you</em>, not for advertisers.</h2>
          <p className="muted" style={{ maxWidth: '54ch' }}>No ads, no data deals, no account. Members fund Ondessa directly, so every feature is built around your body and your privacy.</p>
          <button className="btn" onClick={() => navigate('/plans')}>See what’s included</button>
          <p className="small faint">From $59.99 a year, or $8.99 monthly. Cancel anytime.</p>
        </section>
      </div>
    </PublicShell>
  );
}

export function Plans() {
  const { data, entitlement, refreshEntitlement, usePreviewPass, forecast: f, tour, startTour } = useStore();
  const pregnant = !!(data && !tour && data.pregnancy);
  const preg = pregnant ? pregnancyStatus(data!.pregnancy!, localToday(), data!.settings.cycle.typicalCycleLength) : undefined;
  const goal: Goal = data && !tour ? data.settings.goal : 'understand';
  const mine = data && !tour && !pregnant ? f : undefined;
  const hasPrediction = !!mine?.nextPeriod;
  const [plan, setPlan] = useState<'annual' | 'monthly'>('annual');
  const [key, setKey] = useState('');
  const [keyMsg, setKeyMsg] = useState<string>();
  const active = entitlement.status === 'active';
  const [storePrices, setStorePrices] = useState<Partial<Record<StorePlan, string>>>({});
  const [storeMicros, setStoreMicros] = useState<Partial<Record<StorePlan, number>>>({});
  const [trials, setTrials] = useState<Partial<Record<StorePlan, { days: number; label: string }>>>({});
  useEffect(() => {
    if (!isNative) return;
    void loadProducts().then((ps) => {
      setStorePrices(Object.fromEntries(ps.map((p) => [p.plan, p.price])));
      setStoreMicros(Object.fromEntries(ps.flatMap((p) => (p.priceMicros ? [[p.plan, p.priceMicros]] : []))));
      setTrials(Object.fromEntries(ps.flatMap((p) => (p.trial ? [[p.plan, p.trial]] : []))));
    });
  }, []);
  const trial = trials[plan];
  // The saving must come from the prices actually shown: store prices on native (local currency),
  // the list prices on the web. Hidden if store prices are shown without numeric amounts.
  const saving = storeMicros.annual && storeMicros.monthly
    ? Math.round((1 - storeMicros.annual / (storeMicros.monthly * 12)) * 100)
    : storePrices.annual ? undefined : Math.round((1 - PRICES.annual.amount / (PRICES.monthly.amount * 12)) * 100);
  const priceOf = (p: StorePlan) => storePrices[p] ?? PRICES[p].label;

  const restore = async () => {
    const e = await activateToken(key);
    setKeyMsg(e.status === 'active' ? 'Your subscription is active on this device.' : 'That key could not be verified. Check it and try again.');
    await refreshEntitlement();
  };

  return (
    <PublicShell>
      <div className="wrap main stack" style={{ '--gap': '28px', maxWidth: 820 } as React.CSSProperties}>
        <div className="stack center" style={{ '--gap': '10px', alignItems: 'center' } as React.CSSProperties}>
          <span className="eyebrow">Ondessa membership</span>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)' }}>
            {pregnant ? 'Your pregnancy calendar is ready.' : hasPrediction ? 'Your first prediction is ready.' : mine ? 'You’re set up.' : 'Your cycle, understood. Privately.'}
          </h1>
          <p className="muted" style={{ maxWidth: '50ch' }}>
            {mine && !hasPrediction
              ? 'Predictions start the day you log your period. Everything you entered is saved on this device.'
              : 'Everything is included in both plans. Cancel any time; access continues until the end of the period you paid for.'}
          </p>
        </div>

        {hasPrediction && mine && (
          <section className={`prediction-card phase-${phaseOn(mine, mine.today) ?? 'none'}`} aria-label="Your prediction">
            <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
              <span className="eyebrow">Next period · most likely</span>
              <span className="kicker-num" style={{ fontSize: '2.8rem' }}>{formatShort(mine.nextPeriod!.expected)}</span>
              <span className="small muted">Window {formatShort(mine.nextPeriod!.earliest)} to {formatShort(mine.nextPeriod!.latest)}. Gets more personal as you log: patterns unlock after 3 cycles.</span>
              <ConfidenceBadge level={mine.confidence} />
            </div>
            <DotRing f={mine} showFertility={data!.settings.showFertility} size={200} />
          </section>
        )}

        {pregnant && preg && (
          <section className="prediction-card phase-follicular" aria-label="Your pregnancy">
            <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
              <span className="eyebrow">Pregnancy · trimester {preg.trimester}</span>
              <span className="kicker-num" style={{ fontSize: '2.8rem' }}>Week {preg.week}{preg.day ? ` + ${preg.day}` : ''}</span>
              <span className="small muted">Estimated due date {formatShort(preg.dueDate)}{preg.source === 'clinician' ? ', from your doctor or midwife' : ', from your last period'}. Week-by-week notes, appointments and a symptom journal are ready.</span>
            </div>
          </section>
        )}


        <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
          <span className="eyebrow center">Choose how you’d like to pay</span>
          <div className="price-grid">
            {(['annual', 'monthly'] as const).map((p) => (
              <button key={p} type="button" className={`card plan stack ${plan === p ? 'selected' : ''}`} style={{ '--gap': '6px', textAlign: 'left', cursor: 'pointer' } as React.CSSProperties} onClick={() => setPlan(p)} aria-pressed={plan === p}>
                <div className="row between"><span className="eyebrow">{p === 'annual' ? 'Yearly' : 'Monthly'}</span>{p === 'annual' && (saving && saving > 0 ? <span className="badge established">Best value · save {saving}%</span> : <span className="badge established">Best value</span>)}</div>
                <span className="price">{priceOf(p)}<small>{PRICES[p].per}</small></span>
                <span className="small muted">{p === 'annual' ? (storePrices.annual ? 'One payment covers the whole year.' : `Works out to about $${(PRICES.annual.amount / 12).toFixed(2)} a month.`) : 'Flexible. Stop whenever you like.'}</span>
                <span className="tiny faint">Renews automatically at {priceOf(p)} {PRICES[p].per} until you cancel.</span>
              </button>
            ))}
          </div>
        </div>

        {trial && !active && (
          <section className="card stack" style={{ '--gap': '0px' } as React.CSSProperties} aria-label="How the free trial works">
            <span className="eyebrow" style={{ marginBottom: 12 }}>Free for {trial.label}, then {priceOf(plan)} {PRICES[plan].per}</span>
            <ol className="trial-steps">
              <li><strong>Today</strong><span className="small muted">Full access: predictions, insights, fertility and pregnancy mode.</span></li>
              {trial.days >= 3 && <li><strong>Day {trial.days - 2}</strong><span className="small muted">Ondessa reminds you on this device that the trial ends in 2 days.</span></li>}
              <li><strong>Day {trial.days}</strong><span className="small muted">Your membership starts. Cancel before then and you won’t be charged.</span></li>
            </ol>
          </section>
        )}

        {active ? (
          <div className="card tint-sage stack" style={{ '--gap': '10px' } as React.CSSProperties}>
            <strong>Your membership is active.</strong>
            <button className="btn" onClick={() => navigate(data ? '/app' : '/start')}>{data ? 'Open Ondessa' : 'Set up Ondessa'}</button>
          </div>
        ) : isNative ? (
          <NativeCheckout plan={plan} price={priceOf(plan)} trial={trial} onDone={() => navigate(data ? '/app' : '/start')} />
        ) : (
          <div className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
            <button className="btn block" disabled title="Web checkout is not connected yet">
              Continue with {plan === 'annual' ? 'yearly' : 'monthly'} · {PRICES[plan].label}
            </button>
            <p className="small muted center">Cancel anytime.</p>
            <p className="tiny faint center">Web checkout is not live yet. Ondessa never sees your card or your health data.</p>
            {previewPassAvailable && (
              <button className="btn secondary block" onClick={() => { usePreviewPass(); navigate(data ? '/app' : '/start'); }}>
                Use a 14-day preview pass (development build only)
              </button>
            )}
          </div>
        )}

        <section className="stack" style={{ '--gap': '10px' } as React.CSSProperties} aria-label="What membership includes">
          <span className="eyebrow center">Everything is included in both plans</span>
          <ul className="benefit-list">
            {benefitsFor(goal).map(([t, d]) => (
              <li key={t}><span className="tick" aria-hidden="true"><Icon name="check" size={14} /></span><span><strong>{t}</strong> <span className="small muted">{d}</span></span></li>
            ))}
          </ul>
        </section>

        {data && !tour && !active && (
          <Link to="/app/privacy" className="card stack" >
            <span className="row between"><strong>Your data stays yours</strong><Icon name="chevron" size={18} /></span>
            <span className="small muted">With or without a membership, you can back up, export or permanently delete what you’ve entered.</span>
          </Link>
        )}

        {!mine && !isNative && (
          <button className="btn ghost" style={{ alignSelf: 'center' }} onClick={() => { startTour(); navigate('/app'); }}>Not sure yet? Take the 2-minute tour</button>
        )}

        {!isNative && (
          <details className="card flat">
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Restore a purchase with your membership key</summary>
            <div className="stack" style={{ '--gap': '10px', marginTop: 12 } as React.CSSProperties}>
              <p className="small muted">Your key proves your subscription without an account. It contains a random ID, your plan and an expiry date. Nothing else.</p>
              <textarea className="input" value={key} onChange={(e) => setKey(e.target.value)} aria-label="Membership key" spellCheck={false} autoComplete="off" />
              <button className="btn secondary" onClick={restore} disabled={!key.trim()}>Verify key</button>
              {keyMsg && <p className="small" role="status">{keyMsg}</p>}
            </div>
          </details>
        )}

        <div className="small muted stack" style={{ '--gap': '6px' } as React.CSSProperties}>
          {isNative ? (
            <p>
              Payment is charged to your {platform === 'android' ? 'Google Play' : 'Apple ID'} account when you confirm. The subscription renews automatically at the same price unless you cancel at least 24 hours before the end of the current period. Manage or cancel any time in your {platform === 'android' ? 'Google Play' : 'Apple ID'} settings.
            </p>
          ) : (
            <p><strong>No double charges.</strong> If you already have an active membership, checkout sends you to restore it instead of charging again.</p>
          )}
          <p className="row wrap-row" style={{ '--gap': '16px' } as React.CSSProperties}>
            <Link to="/legal">Terms of Use</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </PublicShell>
  );
}

/** App Store / Google Play checkout with restore. Prices come from the store, localised. */
function NativeCheckout({ plan, price, trial, onDone }: { plan: StorePlan; price: string; trial?: { days: number; label: string }; onDone: () => void }) {
  const { refreshEntitlement } = useStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const buy = async () => {
    setBusy(true);
    setMsg(undefined);
    const r = await purchase(plan);
    await refreshEntitlement();
    setBusy(false);
    if (r === 'purchased') {
      if (trial) void scheduleTrialReminder(trial.days).catch(() => {});
      onDone();
    }
    else if (r === 'unavailable') setMsg('Purchases aren’t available right now. Check your connection and try again.');
    else if (r === 'error') setMsg('The purchase didn’t go through. You have not been charged.');
  };
  const restore = async () => {
    setBusy(true);
    const owned = await restorePurchases();
    await refreshEntitlement();
    setBusy(false);
    if (owned) onDone();
    else setMsg('No active membership was found for this account.');
  };
  return (
    <div className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
      <button className="btn block" disabled={busy} onClick={buy}>
        {busy ? 'One moment…' : trial ? `Start ${trial.label} free trial` : `Subscribe ${plan === 'annual' ? 'yearly' : 'monthly'} · ${price}`}
      </button>
      <button className="btn secondary block" disabled={busy} onClick={restore}>Restore purchases</button>
      {msg && <p className="small center" role="status">{msg}</p>}
    </div>
  );
}

export function LibraryIndex() {
  return (
    <PublicShell>
      <div className="wrap main">
        <LibraryList />
      </div>
    </PublicShell>
  );
}

export function LibraryList({ base = '/library' }: { base?: string }) {
  return (
    <div className="stack" style={{ '--gap': '28px' } as React.CSSProperties}>
      <header className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
        <span className="eyebrow">Library</span>
        <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.6rem)' }}>Clear answers, with sources.</h1>
        <p className="muted">General education, not personal medical advice. Every article lists its sources.</p>
      </header>
      {CATEGORIES.map((c) => {
        const items = ARTICLES.filter((a) => a.category === c.id);
        if (!items.length) return null;
        return (
          <section key={c.id} className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
            <h2 style={{ fontSize: '1.3rem' }}>{c.title}</h2>
            <p className="small faint">{c.blurb}</p>
            <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
              {items.map((a) => (
                <Link key={a.slug} to={`${base}/${a.slug}`} className="list-btn">
                  <span className="stack" style={{ '--gap': '2px' } as React.CSSProperties}>
                    <span style={{ fontWeight: 600 }}>{a.title}</span>
                    <span className="small muted">{a.summary}</span>
                  </span>
                  <Icon name="chevron" />
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}


export function ArticleView({ slug, base = '/library' }: { slug: string; base?: string }) {
  const a = ARTICLES.find((x) => x.slug === slug);
  if (!a) return <p>Article not found.</p>;
  return (
    <article className="prose stack" style={{ '--gap': '14px' } as React.CSSProperties}>
      <Link to={base} className="btn ghost" ><Icon name="back" size={18} /> Library</Link>
      <span className="eyebrow">{CATEGORIES.find((c) => c.id === a.category)?.title} · {a.minutes} min read</span>
      <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)' }}>{a.title}</h1>
      {a.sections.map((s, i) => (
        <section key={i}>
          {s.heading && <h2>{s.heading}</h2>}
          {s.body.map((p, j) => <p key={j}>{p}</p>)}
        </section>
      ))}
      <div className="callout">This is general information, not personal medical advice. If something worries you, talk to a qualified healthcare professional.</div>
      <section>
        <h2 style={{ fontSize: '1.1rem' }}>Sources</h2>
        <ol className="small">
          {a.sources.map((s) => (
            <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isNative) { e.preventDefault(); void openExternal(s.url); } }}>{s.label}</a></li>
          ))}
        </ol>
        <p className="tiny faint">General information, not medical advice. Opening a source leaves Ondessa; no personal data is sent with the link.</p>
      </section>
    </article>
  );
}

export function ArticlePage({ slug }: { slug: string }) {
  return (
    <PublicShell>
      <div className="wrap main"><ArticleView slug={slug} /></div>
    </PublicShell>
  );
}

export function Legal() {
  return (
    <PublicShell>
      <div className="wrap main prose stack" style={{ '--gap': '12px' } as React.CSSProperties}>
        <span className="eyebrow">Draft · pending legal review</span>
        <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)' }}>Terms & disclaimers</h1>
        <h2>Not a medical device</h2>
        <p>Ondessa is a wellness and education product. It is not a medical device, does not diagnose, treat or prevent any condition, and is not a substitute for care from a qualified healthcare professional, including prenatal care.</p>
        <h2>Estimates, not facts</h2>
        <p>Predicted periods, fertile windows and ovulation dates are estimates based on what you log. A predicted fertile window is not proof of ovulation. Ondessa cannot confirm or rule out pregnancy, cannot assess fertility, and must not be used as contraception.</p>
        <h2>Emergencies</h2>
        <p>If you think you may have a medical emergency, contact your local emergency number immediately.</p>
        <h2>Subscriptions</h2>
        <p>Ondessa is a paid subscription at the price shown before purchase. Subscriptions renew automatically until cancelled. You can cancel anytime through the store or billing account you purchased with; access continues to the end of the paid period. Refunds follow the policy shown on the pricing page and any rights you have under local law.</p>
        <h2>Your data</h2>
        <p>Health data you enter is stored on your device. You are responsible for keeping backups if you want to restore data on a new device. See the Privacy page for details.</p>
        <p className="small faint">These terms are a working draft and will be replaced by lawyer-reviewed terms before launch.</p>
      </div>
    </PublicShell>
  );
}

const FAQ: [string, string][] = [
  ['Do I need an account?', 'No. Ondessa works without an account, email or phone number. Your membership is linked to your purchase, not to you.'],
  ['Where is my data?', 'On this device only. It is not uploaded anywhere. If you turn on a passcode, it is encrypted with a key derived from that passcode.'],
  ['What if I lose my phone?', 'Without a backup, your data cannot be recovered, by you or by us. Create an encrypted backup from the Privacy center and keep it somewhere safe.'],
  ['What if I forget my passcode?', 'Encrypted data cannot be unlocked without it. You can erase the app and restore from a backup.'],
  ['Why does my prediction say “limited data”?', 'Predictions become more personal after 3 complete cycles and reach “established” after 6 consistent cycles. Until then, Ondessa leans on the cycle length you entered.'],
  ['Can I use Ondessa as birth control?', 'No. Ondessa is not a contraceptive and its fertile-window estimates must not be used to avoid pregnancy.'],
  ['How do I cancel?', 'You → Membership → Manage subscription. Cancelling keeps access until the end of the paid period and does not delete your data.'],
  ['How do I delete everything?', 'Privacy center → Delete everything. It removes all Ondessa data from this device and verifies the deletion.'],
];

export function Help() {
  return (
    <PublicShell>
      <div className="wrap main stack" style={{ '--gap': '20px', maxWidth: 760 } as React.CSSProperties}>
        <span className="eyebrow">Help center</span>
        <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)' }}>How can we help?</h1>
        <div className="card">
          {FAQ.map(([q, a]) => (
            <details key={q} className="list-btn" style={{ display: 'block' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{q}</summary>
              <p className="muted small" style={{ marginTop: 8 }}>{a}</p>
            </details>
          ))}
        </div>
        {COMPANY.supportEmail && (
          <div className="card stack" style={{ '--gap': '6px' } as React.CSSProperties}>
            <h3>Contact support</h3>
            <p className="small muted">Email us at <a href={`mailto:${COMPANY.supportEmail}?subject=Ondessa%20support`} style={{ fontWeight: 600, userSelect: 'all' }}>{COMPANY.supportEmail}</a>.</p>
          </div>
        )}
        <div className="callout sage">Please do not include health details when you contact support. We never need them to help with your membership or the app.</div>
      </div>
    </PublicShell>
  );
}

export function PrivacyPolicy() {
  return (
    <PublicShell>
      <div className="wrap main prose stack" style={{ '--gap': '12px' } as React.CSSProperties}>
        <span className="eyebrow">Plain-language summary · full policy pending legal review</span>
        <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)' }}>Privacy at Ondessa</h1>
        <h2>What stays on your device</h2>
        <p>Everything you log: periods, symptoms, moods, temperatures, tests, notes, pregnancy details and appointments, along with every prediction and insight. Calculations run on your device.</p>
        <h2>What leaves your device</h2>
        <p>In this version, nothing about your health. Loading the app downloads its files from our static host, which, like any web server, sees your IP address and browser type. When subscriptions go live, the payment provider processes your purchase, and the app may check your membership key. That key contains a random ID, your plan and an expiry date.</p>
        <p>If you choose to share an update, a cycle recap or a calendar file, Ondessa hands it to the app you pick (Messages, email, your calendar) and you send it. We never receive it, and it contains only what you switched on.</p>
        <h2>What we never do</h2>
        <ul>
          <li>Sell or share reproductive health data.</li>
          <li>Run advertising, behavioural ads or third-party analytics.</li>
          <li>Send health records to any AI service.</li>
          <li>Put health information in URLs, logs, crash reports or notification payloads.</li>
        </ul>
        <h2>Honest limits</h2>
        <p>We cannot promise perfect security or anonymity. Anyone who can unlock your device and open the app can see your data unless you set an Ondessa passcode. Browser storage can be cleared by the browser or by you. Keep an encrypted backup.</p>
      </div>
    </PublicShell>
  );
}

export function Deleted({ verified }: { verified: boolean }) {
  return (
    <PublicShell>
      <div className="wrap main">
        <div className="card stack" style={{ '--gap': '12px', maxWidth: 560 } as React.CSSProperties} role="status">
          <h1 style={{ fontSize: '1.9rem' }}>{verified ? 'Everything is deleted.' : 'Deletion could not be verified.'}</h1>
          <p className="muted">
            {verified
              ? 'Verified: no Ondessa data remains in this browser’s storage. Backup files you saved elsewhere are not affected, and any subscription is managed separately by your store or billing account.'
              : 'Please close every Ondessa tab and try again, or clear this site’s data in your browser settings.'}
          </p>
          <button className="btn" onClick={() => navigate('/', true)}>Done</button>
        </div>
      </div>
    </PublicShell>
  );
}

/** A real, rendered Today hero driven by the tour's sample data. */
function LivePreview() {
  const today = localToday();
  const data = tourData(today);
  const f = forecast(data, today);
  const phase = phaseOn(f, today);
  const daysTo = f.nextPeriod ? diffDays(today, f.nextPeriod.expected) : 0;
  return (
    <div className="phone fade-in" aria-label="Preview of the Today screen with sample data" role="img">
      <div className={`phase-hero phase-${phase ?? 'none'}`} style={{ gridTemplateColumns: '1fr', borderRadius: 28 }}>
        <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
          <PhasePill phase={phase}>{phase ? PHASE_COPY[phase].label : 'Cycle'}</PhasePill>
          <div>
            <div className="big-number" style={{ fontSize: '6.5rem' }}>{daysTo}</div>
            <div className="big-caption">days until your period</div>
          </div>
          <ConfidenceBadge level={f.confidence} />
        </div>
        <DotRing f={f} showFertility size={260} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Audience chapters */

type Chapter = 'privacy' | 'conceive' | 'changing';

const CHAPTERS: { id: Chapter; chip: string }[] = [
  { id: 'privacy', chip: 'I want my data private' },
  { id: 'conceive', chip: 'We’re trying for a baby' },
  { id: 'changing', chip: 'My cycles are changing' },
];

function Audiences() {
  const { setStartIntent } = useStore();
  const start = (goal: Goal) => {
    setStartIntent(goal);
    navigate('/start');
  };
  const jump = (id: Chapter) => document.getElementById(`ch-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <section className="wrap stack" style={{ '--gap': '28px' } as React.CSSProperties} aria-labelledby="audiences-title">
      <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
        <span className="eyebrow">Made for where you are</span>
        <h2 id="audiences-title">Which one <em>sounds like you?</em></h2>
        <div className="chips">
          {CHAPTERS.map((c) => <button key={c.id} type="button" className={`chip audience-chip chip-${c.id}`} onClick={() => jump(c.id)}>{c.chip}</button>)}
        </div>
      </div>

      <article id="ch-privacy" className="chapter chapter-dark">
        <div className="chapter-copy">
          <span className="eyebrow">Privacy first</span>
          <h3 className="chapter-title">Your cycle is nobody’s business. <em>Not even ours.</em></h3>
          <p className="chapter-lede">Many period apps keep your cycle on their servers. Ondessa keeps it on your phone, so there is nothing for anyone to sell, leak or hand over.</p>
          <ul className="gets">
            <li><b>No account.</b> No email, name or phone number. Ever.</li>
            <li><b>Lock and encrypt</b> everything with a passcode.</li>
            <li><b>Notifications that never say “period”</b>, so nothing shows on your lock screen.</li>
            <li><b>Delete everything in one tap</b>, and see the deletion verified.</li>
          </ul>
          <div className="row wrap-row">
            <button className="btn chapter-cta" onClick={() => start('understand')}>Start privately</button>
            <Link to="/privacy" className="btn on-plum">How it works</Link>
          </div>
        </div>
        <div className="chapter-visual" aria-label="What Ondessa ever receives: none of your health data" role="img">
          <div className="ledger">
            <div className="ledger-head"><span className="eyebrow">What Ondessa ever receives</span><Icon name="lock" size={18} /></div>
            {[
              ['Period dates', 'Never'],
              ['Symptoms & notes', 'Never'],
              ['Fertility & pregnancy', 'Never'],
              ['Name, email, phone', 'Not collected'],
              ['Ads & trackers', 'None'],
            ].map(([k, v]) => (
              <div key={k} className="ledger-row"><span>{k}</span><span className="ledger-val">{v}</span></div>
            ))}
          </div>
          <div className="notif">
            <span className="notif-icon"><Mark size={22} /></span>
            <span><b>Ondessa</b><span>You have a gentle check-in from Ondessa.</span></span>
            <span className="notif-time mono">now</span>
          </div>
        </div>
      </article>

      <article id="ch-conceive" className="chapter phase-fertile">
        <div className="chapter-copy">
          <span className="eyebrow">Trying to conceive</span>
          <h3 className="chapter-title">Your best days, <em>and how sure we are.</em></h3>
          <p className="chapter-lede">Calendar apps hand you one confident date. Ondessa shows your most likely fertile days, the full possible range, and sharpens the estimate when you log a positive LH test or a temperature rise.</p>
          <ul className="gets">
            <li><b>Most likely and possible days</b>, shown side by side.</li>
            <li><b>LH tests, temperature and mucus</b> refine the estimate.</li>
            <li><b>A test-day reminder</b> on the day a home test is most reliable.</li>
            <li><b>No false promises.</b> It can’t confirm ovulation or pregnancy, and it says so.</li>
          </ul>
          <button className="btn chapter-cta" onClick={() => start('conceive')}>Start for trying to conceive</button>
        </div>
        <div className="chapter-visual" aria-label="Sample: fertile window with most likely and possible days" role="img">
          <div className="mini-card">
            <div className="row between wrap-row" style={{ '--gap': '8px' } as React.CSSProperties}>
              <span className="eyebrow">This cycle · sample</span>
              <ConfidenceBadge level="developing" />
            </div>
            <div className="kicker-num" style={{ fontSize: '3rem' }}>Oct 21–27</div>
            <span className="small muted">Most likely fertile days</span>
            <div className="strip" aria-hidden="true">
              {Array.from({ length: 29 }, (_, i) => {
                // Sample cycle starting Oct 11: most likely days 11–17 (Oct 21–27), ovulation day 16, today day 15.
                const d = i + 1;
                const k = d <= 5 ? 'p' : d === 16 ? 'o' : d >= 11 && d <= 17 ? 'f' : d >= 8 && d <= 20 ? 'w' : 'n';
                return <i key={d} className={`s-${k}${d === 15 ? ' s-today' : ''}`} />;
              })}
            </div>
            <div className="legend">
              <span><i style={{ background: 'var(--berry)' }} />Period</span>
              <span><i style={{ background: 'var(--sage)' }} />Most likely</span>
              <span><i style={{ background: 'var(--sage-soft)', boxShadow: 'inset 0 0 0 1px var(--sage)' }} />Possible</span>
              <span><i style={{ background: 'var(--sage-ink)' }} />Est. ovulation</span>
            </div>
          </div>
          <div className="event-pill">
            <span className="ev-dot" />
            <span><b>Positive LH test logged Oct 25.</b> Ovulation estimate moved to Oct 26.</span>
          </div>
        </div>
      </article>

      <article id="ch-changing" className="chapter phase-luteal">
        <div className="chapter-copy">
          <span className="eyebrow">Changing cycles & perimenopause</span>
          <h3 className="chapter-title">For cycles that <em>don’t follow the textbook.</em></h3>
          <p className="chapter-lede">When your cycle swings from 26 to 52 days, a single predicted date is fiction. Ondessa widens the window, tells you why, and helps you see what is actually changing.</p>
          <ul className="gets">
            <li><b>Honest, wider windows</b> when your cycles vary.</li>
            <li><b>Track hot flushes, night sweats and sleep</b> alongside your cycle.</li>
            <li><b>Patterns from your own logs</b>, never generic advice.</li>
            <li><b>Your full history</b>, exportable any time.</li>
          </ul>
          <button className="btn chapter-cta" onClick={() => start('perimenopause')}>Start for changing cycles</button>
        </div>
        <div className="chapter-visual" aria-label="Sample: irregular cycle lengths and a wider prediction window" role="img">
          <div className="mini-card">
            <span className="eyebrow">Last 6 cycles · sample</span>
            <div className="mini-bars" aria-hidden="true">
              {[27, 34, 26, 45, 31, 52].map((n, i) => (
                <div key={i}><b className="mono">{n}</b><span style={{ height: `${(n / 52) * 96}px` }} /></div>
              ))}
            </div>
            <div className="row between wrap-row" style={{ '--gap': '8px' } as React.CSSProperties}>
              <span className="small"><b>Next period:</b> Nov 3 – Nov 17</span>
              <span className="badge">Wider window</span>
            </div>
            <span className="tiny muted">Your cycles vary by 26 days, so the window is wider.</span>
          </div>
          <div className="event-pill">
            <span className="ev-dot" />
            <span><b>Your pattern:</b> night sweats logged in the week before 3 of your last 4 periods.</span>
          </div>
        </div>
      </article>
    </section>
  );
}
