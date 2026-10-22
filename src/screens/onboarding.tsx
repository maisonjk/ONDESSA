import { useEffect, useState } from 'react';
import { navigate } from '../app/router';
import { useStore } from '../app/store';
import { addDays, emptyData, type Goal } from '../engine';
import { BackupNeedsPassword, readBackup } from '../data/backup';
import { biometricPasscode, biometricUnlockEnabled, biometryAvailable } from '../platform/biometric';
import { WrongPassphraseError } from '../data/crypto';
import { Icon, Mark, MedicalNote, ToggleRow } from '../ui/components';
import { PastPeriodsFields, cleanPastStarts } from './app-you';

const GOALS: { id: Goal; icon: string; title: string; detail: string }[] = [
  { id: 'understand', icon: 'moon', title: 'Understand my cycle', detail: 'Predictions, symptoms and personal patterns.' },
  { id: 'conceive', icon: 'leaf', title: 'Plan a pregnancy', detail: 'Fertile-window estimates with optional LH, temperature and mucus.' },
  { id: 'pregnant', icon: 'heart', title: 'I’m pregnant', detail: 'Week-by-week calendar, due date and appointments.' },
  { id: 'perimenopause', icon: 'drop', title: 'My cycles are changing', detail: 'Perimenopause or irregular cycles, with honest, wider estimates.' },
];

export function Onboarding() {
  const { today, begin, entitlement, startIntent } = useStore();
  const [draft] = useState(readDraft);
  const [step, setStep] = useState(draft?.step ?? 0);
  const [goal, setGoal] = useState<Goal>(draft?.goal ?? startIntent ?? 'understand');
  const [lastStart, setLastStart] = useState(draft?.lastStart ?? '');
  const [unsure, setUnsure] = useState(draft?.unsure ?? false);
  const [cycleLen, setCycleLen] = useState(draft?.cycleLen ?? 28);
  const [periodLen, setPeriodLen] = useState(draft?.periodLen ?? 5);
  const [dueDate, setDueDate] = useState(draft?.dueDate ?? '');
  const [usePin, setUsePin] = useState(false);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [discreet, setDiscreet] = useState(draft?.discreet ?? true);
  const [fertile, setFertile] = useState<boolean | undefined>(draft?.fertile);
  const [earlier, setEarlier] = useState<string[]>(draft?.earlier ?? ['', '']);
  // Keep answers if the page reloads mid-setup (the passcode is never kept).
  useEffect(() => {
    writeDraft({ step, goal, lastStart, unsure, cycleLen, periodLen, dueDate, discreet, fertile, earlier });
  }, [step, goal, lastStart, unsure, cycleLen, periodLen, dueDate, discreet, fertile, earlier]);
  const steps = 4;
  const showFertile = fertile ?? goal === 'conceive';

  const pinOk = !usePin || (/^\d{4,8}$/.test(pin) && pin === pin2);
  const dueOk = !!dueDate && dueDate >= today && dueDate <= addDays(today, 280);
  const lmpOk = !!lastStart && lastStart <= today && lastStart >= addDays(today, goal === 'pregnant' ? -300 : -365);
  const dateOk = goal === 'pregnant' ? dueOk || lmpOk : unsure || lmpOk;

  const finish = async () => {
    const d = emptyData(today);
    d.settings.goal = goal;
    d.settings.cycle = { typicalCycleLength: cycleLen, typicalPeriodLength: periodLen };
    d.settings.showFertility = goal !== 'pregnant' && showFertile;
    d.settings.fertilitySigns = goal === 'conceive';
    d.settings.reminders.discreet = discreet;
    d.settings.reminders.fertileWindow = goal === 'conceive';
    if (lmpOk && !unsure) {
      if (goal === 'pregnant') d.logs[lastStart] = { date: lastStart, flow: 'unspecified' };
      else {
        // Mark the usual number of days for each period entered, never past today.
        for (const s of [lastStart, ...cleanPastStarts(earlier, [lastStart], today)]) {
          for (let i = 0; i < periodLen; i++) {
            const day = addDays(s, i);
            if (day <= today) d.logs[day] = { date: day, flow: 'unspecified' };
          }
        }
      }
    }
    if (goal === 'pregnant') {
      d.pregnancy = { startedOn: today, ...(lmpOk ? { lmp: lastStart } : {}), ...(dueOk ? { clinicianDueDate: dueDate } : {}) };
      d.settings.reminders.periodHeadsUp = false;
    }
    await begin(d, usePin ? pin : undefined);
    clearDraft();
    navigate(entitlement.status === 'active' ? '/app' : '/plans', true);
  };

  return (
    <div className="onboard">
      <header className="wrap row between" style={{ minHeight: 64 }}>
        <span className="wordmark"><Mark /> Ondessa</span>
        <button className="btn ghost" onClick={() => { if (step) setStep(step - 1); else { clearDraft(); navigate('/'); } }}>{step ? 'Back' : 'Close'}</button>
      </header>
      <div className="wrap stack" style={{ '--gap': '8px' } as React.CSSProperties}>
        <div className="progress" aria-hidden="true"><i style={{ width: `${((step + 1) / steps) * 100}%` }} /></div>
        <span className="eyebrow" aria-live="polite">Step {step + 1} of {steps}</span>
      </div>

      <main className="wrap stack fade-in" key={step} style={{ '--gap': '22px', padding: '32px 20px 48px', flex: 1 } as React.CSSProperties}>
        {step === 0 && (
          <>
            <span className="eyebrow">Before we start</span>
            <h1 style={{ fontSize: 'clamp(2rem, 6vw, 2.6rem)' }}>Your data stays with you.</h1>
            <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
              {[
                ['shield', 'No account needed', 'No email, name, phone number or birth date.'],
                ['lock', 'Stored on this device', 'Your logs and predictions never leave it. Add a passcode to encrypt them.'],
                ['info', 'Everything is optional', 'Log only what helps you. Skip anything, anytime.'],
                ['download', 'You’re in control', 'Export or permanently delete your data whenever you want.'],
              ].map(([icon, t, d]) => (
                <div key={t} className="row" style={{ alignItems: 'flex-start', '--gap': '14px' } as React.CSSProperties}>
                  <span className="ico-box"><Icon name={icon!} /></span>
                  <div><div style={{ fontWeight: 600 }}>{t}</div><div className="small muted">{d}</div></div>
                </div>
              ))}
            </div>
            <p className="small muted">Because your data lives only here, losing this device without a backup means losing your history. You can create an encrypted backup anytime.</p>
            <button className="btn block" onClick={() => setStep(1)}>I understand, continue</button>
            <p className="small muted center">Setup is free and stays on this device. You’ll see your first prediction before choosing a membership.</p>
            <RestoreBackup />
          </>
        )}

        {step === 1 && (
          <>
            <span className="eyebrow">Your focus</span>
            <h1 style={{ fontSize: 'clamp(1.8rem, 6vw, 2.4rem)' }}>What brings you to Ondessa?</h1>
            <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties} role="group" aria-label="Goal">
              {GOALS.map((g) => (
                <button key={g.id} type="button" className="option" aria-pressed={goal === g.id} onClick={() => setGoal(g.id)}>
                  <span className="ico"><Icon name={g.icon} /></span>
                  <span><span style={{ fontWeight: 600, display: 'block' }}>{g.title}</span><span className="small muted">{g.detail}</span></span>
                </button>
              ))}
            </div>
            <p className="small faint">You can change this anytime in Settings.</p>
            <button className="btn block" onClick={() => setStep(2)}>Continue</button>
          </>
        )}

        {step === 2 && goal !== 'pregnant' && (
          <>
            <span className="eyebrow">A starting point</span>
            <h1 style={{ fontSize: 'clamp(1.8rem, 6vw, 2.4rem)' }}>When did your last period start?</h1>
            <div className="field">
              <label htmlFor="last">First day of your last period</label>
              <input id="last" className="input" type="date" max={today} min={addDays(today, -365)} value={lastStart} disabled={unsure} onChange={(e) => setLastStart(e.target.value)} />
            </div>
            <label className="check-row small"><input type="checkbox" checked={unsure} onChange={(e) => setUnsure(e.target.checked)} /> I’m not sure. I’ll log my next period.</label>
            {lmpOk && !unsure && (
              <details className="card flat">
                <summary style={{ cursor: 'pointer', fontWeight: 560, minHeight: 44, display: 'flex', alignItems: 'center' }}>Know earlier dates? Add them for a sharper first prediction</summary>
                <div className="stack" style={{ '--gap': '10px', marginTop: 8 } as React.CSSProperties}>
                  <p className="small muted">Rough dates are fine. Two earlier periods give Ondessa your real cycle length from day one.</p>
                  <PastPeriodsFields values={earlier} onChange={setEarlier} max={addDays(lastStart, -15)} min={addDays(today, -730)} />
                </div>
              </details>
            )}
            <Stepper label="Usual cycle length" unit="days" value={cycleLen} min={15} max={90} onChange={setCycleLen} hint="Not sure? 28 is a reasonable start. Ondessa learns your real length as you log." />
            <Stepper label="Usual period length" unit="days" value={periodLen} min={1} max={15} onChange={setPeriodLen} hint={unsure ? undefined : `Ondessa marks ${periodLen} day${periodLen === 1 ? '' : 's'} from each start date as your period. You can change any day later.`} />
            <button className="btn block" disabled={!dateOk} onClick={() => setStep(3)}>Continue</button>
          </>
        )}

        {step === 2 && goal === 'pregnant' && (
          <>
            <span className="eyebrow">Dating your pregnancy</span>
            <h1 style={{ fontSize: 'clamp(1.8rem, 6vw, 2.4rem)' }}>Let’s find your week.</h1>
            <div className="field">
              <label htmlFor="due">Due date from your clinician (most accurate)</label>
              <input id="due" className="input" type="date" min={today} max={addDays(today, 280)} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="lmp">Or the first day of your last period</label>
              <input id="lmp" className="input" type="date" max={today} min={addDays(today, -300)} value={lastStart} onChange={(e) => setLastStart(e.target.value)} />
            </div>
            <p className="small muted">A clinician-provided date always takes priority. Ondessa’s calendar is for information and is not a substitute for prenatal care.</p>
            <button className="btn block" disabled={!dateOk} onClick={() => setStep(3)}>Continue</button>
          </>
        )}

        {step === 3 && (
          <>
            <span className="eyebrow">Privacy & display</span>
            <h1 style={{ fontSize: 'clamp(1.8rem, 6vw, 2.4rem)' }}>Your preferences</h1>
            <div className="card">
              <ToggleRow title="Lock and encrypt with a passcode" detail="Your data is encrypted on this device. Ondessa cannot recover a forgotten passcode." checked={usePin} onChange={setUsePin} />
              {usePin && (
                <div className="stack" style={{ '--gap': '10px', padding: '12px 0' } as React.CSSProperties}>
                  <input className="input pin" inputMode="numeric" type="password" autoComplete="new-password" placeholder="4–8 digits" aria-label="New passcode" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} />
                  <input className="input pin" inputMode="numeric" type="password" autoComplete="new-password" placeholder="Repeat" aria-label="Repeat passcode" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 8))} />
                  {pin2 && pin !== pin2 && <p className="small" style={{ color: 'var(--berry-ink)' }}>Passcodes don’t match.</p>}
                </div>
              )}
              {goal !== 'pregnant' && (
                <ToggleRow title="Show estimated fertile days" detail="Off unless you’re planning a pregnancy. You can change this anytime." checked={showFertile} onChange={setFertile} />
              )}
              <ToggleRow title="Discreet notifications" detail="Reminders never mention periods, fertility or pregnancy." checked={discreet} onChange={setDiscreet} />
            </div>
            <button className="btn block" disabled={!pinOk} onClick={finish}>Finish setup</button>
            <MedicalNote />
          </>
        )}
      </main>
    </div>
  );
}

export function Stepper(props: { label: string; unit: string; value: number; min: number; max: number; onChange: (v: number) => void; hint?: string }) {
  const set = (v: number) => props.onChange(Math.max(props.min, Math.min(props.max, v)));
  return (
    <div className="field">
      <span className="label">{props.label}</span>
      <div className="row" style={{ '--gap': '10px' } as React.CSSProperties}>
        <button type="button" className="btn secondary" aria-label={`Decrease ${props.label}`} onClick={() => set(props.value - 1)}>−</button>
        <output className="serif" style={{ fontSize: '1.8rem', minWidth: 64, textAlign: 'center' }} aria-live="polite">{props.value}</output>
        <button type="button" className="btn secondary" aria-label={`Increase ${props.label}`} onClick={() => set(props.value + 1)}>+</button>
        <span className="muted">{props.unit}</span>
      </div>
      {props.hint && <span className="small faint">{props.hint}</span>}
    </div>
  );
}

export function LockScreen() {
  const { unlockWith, eraseAll } = useStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [armed, setArmed] = useState(false);
  const [failures, setFailures] = useState(() => readLockout().n);
  const [waitUntil, setWaitUntil] = useState(() => readLockout().until);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (waitUntil <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [waitUntil]);
  const waiting = Math.max(0, Math.ceil((waitUntil - now) / 1000));
  const [quick, setQuick] = useState<string>();
  const quickUnlock = async () => {
    const code = await biometricPasscode();
    if (code && !(await unlockWith(code))) setError(true);
  };
  useEffect(() => {
    void Promise.all([biometricUnlockEnabled(), biometryAvailable()]).then(([on, b]) => {
      if (on && b.available) {
        setQuick(b.label);
        void quickUnlock();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (waiting) return;
    setBusy(true);
    const ok = await unlockWith(pin);
    setBusy(false);
    setError(!ok);
    if (!ok) {
      setPin('');
      const n = failures + 1;
      setFailures(n);
      // After 5 wrong tries, wait 30s, doubling each time (capped at 15 minutes).
      const until = n >= 5 ? Date.now() + Math.min(15 * 60, 30 * 2 ** (n - 5)) * 1000 : 0;
      if (until) {
        setWaitUntil(until);
        setNow(Date.now());
      }
      writeLockout({ n, until });
    } else {
      writeLockout({ n: 0, until: 0 });
    }
  };
  return (
    <div className="lock-screen">
      <form className="card stack center" style={{ '--gap': '16px', width: '100%', maxWidth: 380 } as React.CSSProperties} onSubmit={submit}>
        <span style={{ color: 'var(--berry)', margin: '0 auto' }}><Mark size={40} /></span>
        <h2>Welcome back</h2>
        <label htmlFor="unlock-pin" className="label">Passcode</label>
        <input id="unlock-pin" className="input pin" type="password" inputMode="numeric" autoFocus autoComplete="current-password" placeholder="4–8 digits" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} />
        {error && <p className="small" role="alert" style={{ color: 'var(--berry-ink)' }}>{waiting ? `Too many attempts. Try again in ${waiting}s.` : 'That passcode didn’t work.'}</p>}
        <button className="btn block" disabled={pin.length < 4 || busy || waiting > 0}>{busy ? 'Unlocking…' : 'Unlock'}</button>
        {quick && <button type="button" className="btn secondary block" onClick={quickUnlock}>Unlock with {quick}</button>}
        {!forgot ? (
          <button type="button" className="btn ghost" onClick={() => setForgot(true)}>Forgot passcode?</button>
        ) : (
          <div className="stack small muted" style={{ '--gap': '10px' } as React.CSSProperties}>
            <p>Your data is encrypted with your passcode, so it cannot be recovered without it. You can erase Ondessa on this device and restore from a backup.</p>
            <button type="button" className="btn danger" onClick={async () => {
              if (!armed) return setArmed(true);
              await eraseAll();
              navigate('/start', true);
            }}>{armed ? 'Tap again to erase everything' : 'Erase and start over'}</button>
          </div>
        )}
      </form>
    </div>
  );
}

export function Unavailable({ message }: { message?: string }) {
  const { eraseAll } = useStore();
  return (
    <div className="lock-screen">
      <div className="card stack" style={{ '--gap': '14px', maxWidth: 440 } as React.CSSProperties}>
        <h2>We can’t open your data</h2>
        <p className="muted">{message}</p>
        <p className="small muted">Nothing has been deleted. Try reloading, or opening Ondessa outside private browsing. If you have a backup, you can erase local data and restore it from the Privacy center.</p>
        <div className="row wrap-row">
          <button className="btn" onClick={() => window.location.reload()}>Reload</button>
          <button className="btn secondary" onClick={async () => { if (window.confirm('Erase Ondessa data on this device? This cannot be undone.')) { await eraseAll(); navigate('/start', true); } }}>Erase local data</button>
        </div>
      </div>
    </div>
  );
}

/** Restore a backup before buying, so moving to a new device never means starting over. */
function RestoreBackup() {
  const { replaceData } = useStore();
  const [text, setText] = useState<string>();
  const [pass, setPass] = useState('');
  const [msg, setMsg] = useState<string>();
  const load = async (raw: string, password?: string) => {
    try {
      await replaceData(await readBackup(raw, password));
      clearDraft();
      navigate('/plans', true);
    } catch (e) {
      if (e instanceof BackupNeedsPassword) { setText(raw); setMsg('This backup is encrypted. Enter its password.'); }
      else if (e instanceof WrongPassphraseError) setMsg('That password did not open the backup.');
      else setMsg(e instanceof Error ? e.message : 'Could not read that file.');
    }
  };
  return (
    <details className="card flat">
      <summary style={{ cursor: 'pointer', fontWeight: 560 }}>Moving from another device? Restore a backup</summary>
      <div className="stack" style={{ '--gap': '10px', marginTop: 8 } as React.CSSProperties}>
        <input type="file" accept="application/json,.json" aria-label="Backup file" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await load(await f.text()); }} />
        {text && (
          <div className="row wrap-row">
            <input className="input" type="password" aria-label="Backup password" value={pass} onChange={(e) => setPass(e.target.value)} />
            <button className="btn" onClick={() => load(text, pass)}>Unlock backup</button>
          </div>
        )}
        {msg && <p className="small" role="status">{msg}</p>}
      </div>
    </details>
  );
}

/** Failed-unlock count and wait, kept across reloads so the lockout can't be skipped. */
const LOCKOUT_KEY = 'ondessa.unlockAttempts';

function readLockout(): { n: number; until: number } {
  try {
    const v = JSON.parse(localStorage.getItem(LOCKOUT_KEY) ?? '{}') as { n?: unknown; until?: unknown };
    return { n: typeof v.n === 'number' ? v.n : 0, until: typeof v.until === 'number' ? v.until : 0 };
  } catch {
    return { n: 0, until: 0 };
  }
}

function writeLockout(v: { n: number; until: number }): void {
  try {
    localStorage.setItem(LOCKOUT_KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

/** Unfinished setup answers, kept only for this browser session and cleared on finish. */
const DRAFT_KEY = 'ondessa.setupDraft';
interface SetupDraft {
  step: number; goal: Goal; lastStart: string; unsure: boolean; cycleLen: number; periodLen: number;
  dueDate: string; discreet: boolean; fertile?: boolean; earlier: string[];
}

function readDraft(): SetupDraft | undefined {
  try {
    const v = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as Partial<SetupDraft> | null;
    if (!v || typeof v.step !== 'number' || !['understand', 'conceive', 'pregnant', 'perimenopause'].includes(v.goal as string)) return undefined;
    const str = (x: unknown) => (typeof x === 'string' && (x === '' || /^\d{4}-\d{2}-\d{2}$/.test(x)) ? x : '');
    const num = (x: unknown, lo: number, hi: number, dflt: number) => (typeof x === 'number' && x >= lo && x <= hi ? Math.round(x) : dflt);
    return {
      step: num(v.step, 0, 3, 0), goal: v.goal as Goal, lastStart: str(v.lastStart), unsure: v.unsure === true,
      cycleLen: num(v.cycleLen, 15, 90, 28), periodLen: num(v.periodLen, 1, 15, 5), dueDate: str(v.dueDate),
      discreet: v.discreet !== false, fertile: typeof v.fertile === 'boolean' ? v.fertile : undefined,
      earlier: Array.isArray(v.earlier) ? v.earlier.slice(0, 3).map(str) : ['', ''],
    };
  } catch {
    return undefined;
  }
}

function writeDraft(d: SetupDraft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* storage unavailable: setup still works, it just won't survive a reload */
  }
}

function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
