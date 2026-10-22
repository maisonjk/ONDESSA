import { useState } from 'react';
import { Link, navigate } from '../app/router';
import { useStore } from '../app/store';
import { ARTICLES, CATEGORIES, type Article } from '../content/library';
import { activateToken, previewPassAvailable } from '../data/entitlement';
import { diffDays, forecast, formatLong, formatShort, localToday, phaseOn, PHASE_COPY } from '../engine';
import { tourData } from '../app/tour';
import { ConfidenceBadge, DotRing, Icon, Mark, MedicalNote, PhasePill } from '../ui/components';

export const PRICES = {
  monthly: { amount: 8.99, label: '$8.99', per: 'per month' },
  annual: { amount: 59.99, label: '$59.99', per: 'per year' },
} as const;

export function PublicShell({ children }: { children: React.ReactNode }) {
  const { data, entitlement, tour } = useStore();
  const inApp = data && !tour && entitlement.status === 'active';
  const setUp = data && !tour;
  return (
    <div>
      <header className="topbar">
        <div className="wrap">
          <Link to="/" className="wordmark"><Mark /> Ondessa</Link>
          <nav className="row" style={{ '--gap': '4px' } as React.CSSProperties}>
            <Link to="/library" className="btn ghost">Library</Link>
            <Link to="/plans" className="btn ghost">Pricing</Link>
            {inApp ? <Link to="/app" className="btn">Open</Link> : !setUp && <Link to="/start" className="btn">Start</Link>}
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <div className="wrap stack" style={{ '--gap': '10px' } as React.CSSProperties}>
          <div className="row wrap-row" style={{ '--gap': '18px' } as React.CSSProperties}>
            <Link to="/privacy">Privacy</Link>
            <Link to="/legal">Terms & disclaimers</Link>
            <Link to="/help">Help</Link>
            <Link to="/library">Library</Link>
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
              <h1>Know your rhythm. Keep it yours.</h1>
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

        <section>
          <div className="wrap stack" style={{ '--gap': '28px' } as React.CSSProperties}>
            <h2 style={{ maxWidth: '18ch' }}>Not another period calendar.</h2>
            <div className="pillars">
              {[
                { icon: 'spark', t: 'My Cycle, My Patterns', d: 'Observations drawn only from your logs, with the evidence and limits written next to every one.' },
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
            <h2>Your cycle has four phases. Ondessa shows you where you are.</h2>
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

        <section className="dark-band">
          <div className="wrap stack" style={{ '--gap': '18px', maxWidth: 760 } as React.CSSProperties}>
            <span className="eyebrow">Our privacy architecture</span>
            <h2>We built it so we can’t see your cycle.</h2>
            <ul className="stack" style={{ '--gap': '10px', paddingLeft: 20 } as React.CSSProperties}>
              <li>Your logs, predictions and notes are stored and calculated on your device.</li>
              <li>No advertising or analytics SDKs, and no AI service ever receives your health records.</li>
              <li>Your subscription is checked with a signed key that contains no health information.</li>
              <li>Notifications can use discreet wording that never mentions periods, fertility or pregnancy.</li>
            </ul>
            <p className="small" style={{ opacity: 0.8 }}>The trade-off: if you lose your device without a backup, we cannot restore your data. Ondessa makes encrypted backups easy.</p>
            <div><Link to="/privacy" className="btn on-plum">Read the details</Link></div>
          </div>
        </section>

        <section className="wrap center stack" style={{ '--gap': '14px', alignItems: 'center' } as React.CSSProperties}>
          <h2 style={{ maxWidth: '20ch' }}>Simple pricing. No free tier, no ads, no selling data.</h2>
          <p className="muted" style={{ maxWidth: '52ch' }}>Your subscription is the whole business model. That’s what lets us say no to the rest.</p>
          <div className="row wrap-row" style={{ justifyContent: 'center' }}>
            <span className="serif" style={{ fontSize: '1.4rem' }}>$8.99 / month</span>
            <span className="faint">or</span>
            <span className="serif" style={{ fontSize: '1.4rem' }}>$59.99 / year</span>
          </div>
          <button className="btn" onClick={() => navigate('/plans')}>See plans</button>
        </section>
      </div>
    </PublicShell>
  );
}

export function Plans() {
  const { data, entitlement, refreshEntitlement, usePreviewPass, forecast: f, tour, startTour } = useStore();
  const mine = data && !tour ? f : undefined;
  const hasPrediction = !!mine?.nextPeriod;
  const [plan, setPlan] = useState<'annual' | 'monthly'>('annual');
  const [key, setKey] = useState('');
  const [keyMsg, setKeyMsg] = useState<string>();
  const active = entitlement.status === 'active';
  const saving = Math.round((1 - PRICES.annual.amount / (PRICES.monthly.amount * 12)) * 100);

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
            {hasPrediction ? 'Your first prediction is ready.' : mine ? 'You’re set up.' : 'Choose your plan'}
          </h1>
          <p className="muted" style={{ maxWidth: '50ch' }}>
            {mine && !hasPrediction
              ? 'Predictions start the day you log your period. Everything you entered is saved on this device.'
              : 'Everything is included in both plans. Cancel anytime from your app store or billing account; access continues until the end of the period you paid for.'}
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

        <div className="price-grid">
          {(['annual', 'monthly'] as const).map((p) => (
            <button key={p} type="button" className={`card plan stack ${plan === p ? 'selected' : ''}`} style={{ '--gap': '8px', textAlign: 'left', cursor: 'pointer' } as React.CSSProperties} onClick={() => setPlan(p)} aria-pressed={plan === p}>
              <div className="row between"><span className="eyebrow">{p === 'annual' ? 'Yearly' : 'Monthly'}</span>{p === 'annual' && <span className="badge established">Save {saving}% vs monthly</span>}</div>
              <span className="price">{PRICES[p].label}</span>
              <span className="small muted">{PRICES[p].per}{p === 'annual' ? ` · about $${(PRICES.annual.amount / 12).toFixed(2)} a month` : ''}</span>
              <span className="tiny faint">Renews automatically at {PRICES[p].label} {PRICES[p].per} until you cancel.</span>
            </button>
          ))}
        </div>

        <div className="card stack" style={{ '--gap': '12px' } as React.CSSProperties}>
          <h3>Included</h3>
          <ul className="small muted stack" style={{ '--gap': '6px', paddingLeft: 18 } as React.CSSProperties}>
            <li>Cycle predictions with transparent confidence levels</li>
            <li>Fertile-window estimates with optional LH, temperature and mucus logging</li>
            <li>My Cycle, My Patterns personal insights</li>
            <li>Pregnancy mode with week-by-week calendar and appointment reminders</li>
            <li>Perimenopause and irregular-cycle support</li>
            <li>Passcode encryption, encrypted backups, export and permanent deletion</li>
          </ul>
        </div>

        {active ? (
          <div className="card tint-sage stack" style={{ '--gap': '10px' } as React.CSSProperties}>
            <strong>Your membership is active{entitlement.status === 'active' ? ` until ${formatLong(new Date(entitlement.expires * 1000).toISOString().slice(0, 10))}` : ''}.</strong>
            <button className="btn" onClick={() => navigate(data ? '/app' : '/start')}>{data ? 'Open Ondessa' : 'Set up Ondessa'}</button>
          </div>
        ) : (
          <div className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
            <button className="btn block" disabled title="Checkout is connected in Phase 6">
              Continue with {plan === 'annual' ? 'yearly' : 'monthly'} · {PRICES[plan].label}
            </button>
            <p className="small muted center">Cancel anytime. Full refund within 14 days of a web purchase.</p>
            <p className="tiny faint center">Checkout is not live in this build. Payment is handled by the app store or a PCI-compliant processor; Ondessa never sees your card or health data together.</p>
            {previewPassAvailable && (
              <button className="btn secondary block" onClick={() => { usePreviewPass(); navigate(data ? '/app' : '/start'); }}>
                Use a 14-day preview pass (development build only)
              </button>
            )}
          </div>
        )}

        {!mine && (
          <button className="btn ghost" style={{ alignSelf: 'center' }} onClick={() => { startTour(); navigate('/app'); }}>Not sure yet? Take the 2-minute tour</button>
        )}

        <details className="card flat">
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Restore a purchase with your membership key</summary>
          <div className="stack" style={{ '--gap': '10px', marginTop: 12 } as React.CSSProperties}>
            <p className="small muted">Your key proves your subscription without an account. It contains a random ID, your plan and an expiry date. Nothing else.</p>
            <textarea className="input" value={key} onChange={(e) => setKey(e.target.value)} aria-label="Membership key" spellCheck={false} autoComplete="off" />
            <button className="btn secondary" onClick={restore} disabled={!key.trim()}>Verify key</button>
            {keyMsg && <p className="small" role="status">{keyMsg}</p>}
          </div>
        </details>

        <div className="small muted stack" style={{ '--gap': '6px' } as React.CSSProperties}>
          <p><strong>Refunds.</strong> Purchases through Apple or Google follow their refund processes. Web purchases can be refunded within 14 days by contacting support. Final policy pending legal review.</p>
          <p><strong>No double charges.</strong> If you already have an active membership, checkout will send you to restore it instead of charging again.</p>
        </div>
      </div>
    </PublicShell>
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

export function LibraryList() {
  return (
    <div className="stack" style={{ '--gap': '28px' } as React.CSSProperties}>
      <header className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
        <span className="eyebrow">Library</span>
        <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.6rem)' }}>Clear answers, with sources.</h1>
        <p className="muted">General education, not personal medical advice. Every article lists its sources and its review status.</p>
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
                <Link key={a.slug} to={`/library/${a.slug}`} className="list-btn">
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

export function ReviewBadge({ a }: { a: Article }) {
  return a.review.status === 'reviewed' ? (
    <span className="badge developing">Reviewed by {a.review.reviewer}, {a.review.credentials} · {formatLong(a.review.date)}</span>
  ) : (
    <span className="badge limited">Draft · awaiting clinical review</span>
  );
}

export function ArticleView({ slug }: { slug: string }) {
  const a = ARTICLES.find((x) => x.slug === slug);
  if (!a) return <p>Article not found.</p>;
  return (
    <article className="prose stack" style={{ '--gap': '14px' } as React.CSSProperties}>
      <Link to="/library" className="btn ghost" ><Icon name="back" size={18} /> Library</Link>
      <span className="eyebrow">{CATEGORIES.find((c) => c.id === a.category)?.title} · {a.minutes} min read</span>
      <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)' }}>{a.title}</h1>
      <div><ReviewBadge a={a} /></div>
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
            <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>
          ))}
        </ol>
        <p className="tiny faint">Drafted {formatLong(a.drafted)}. Opening a source leaves Ondessa; no personal data is sent with the link.</p>
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
  ['Do I need an account?', 'No. Ondessa works without an account, email or phone number. Your membership is proven by a signed key stored on your device.'],
  ['Where is my data?', 'In your browser’s storage on this device. It is not uploaded. If you turn on a passcode, it is encrypted with a key derived from that passcode.'],
  ['What if I lose my phone?', 'Without a backup, your data cannot be recovered, by you or by us. Create an encrypted backup from the Privacy center and keep it somewhere safe.'],
  ['What if I forget my passcode?', 'Encrypted data cannot be unlocked without it. You can erase the app and restore from a backup.'],
  ['Why does my prediction say “limited data”?', 'Predictions become more personal after 3 complete cycles and reach “established” after 6 consistent cycles. Until then, Ondessa leans on the cycle length you entered.'],
  ['Can I use Ondessa as birth control?', 'No. Ondessa is not a contraceptive and its fertile-window estimates must not be used to avoid pregnancy.'],
  ['How do I cancel?', 'Through the store or billing account you subscribed with. Cancelling keeps access until the end of the paid period and does not delete your data.'],
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
        <div className="callout sage">Support emails go to a separate inbox. Please do not include health details; we never need them to help with your account.</div>
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
