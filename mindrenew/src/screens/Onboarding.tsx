import { useEffect, useState } from 'react';
import { actions, useStore } from '../lib/store';
import { CATEGORIES, type CategoryId } from '../content/lies';
import { requestPermission } from '../lib/reminders';
import { track } from '../lib/analytics';
import { go } from '../router';
import { Icon, Logo, Toggle } from '../ui/kit';

const GROWTH: { label: string; cats: CategoryId[] }[] = [
  { label: 'Knowing who I am in Christ', cats: ['identity', 'insecurity'] },
  { label: 'Peace instead of anxiety', cats: ['anxiety', 'fear'] },
  { label: 'Freedom from my past', cats: ['shame', 'guilt'] },
  { label: 'Trusting God with control', cats: ['control'] },
  { label: 'Belonging and connection', cats: ['loneliness', 'rejection'] },
  { label: 'Purpose and direction', cats: ['purpose'] },
  { label: 'Forgiving others', cats: ['unforgiveness'] },
  { label: 'A stronger faith', cats: ['doubt'] },
];

/** Under 60 seconds, no account required, ends inside the first renewal. */
export function Onboarding() {
  const s = useStore();
  const [step, setStep] = useState(0);
  const [growth, setGrowth] = useState<number[]>([]);
  const [patterns, setPatterns] = useState<CategoryId[]>([]);
  const [minutes, setMinutes] = useState<3 | 5 | 10>(5);
  const [remind, setRemind] = useState(true);
  const [time, setTime] = useState('07:30');
  const [name, setName] = useState(s.profile.name);

  useEffect(() => { track('onboarding_started', {}); }, []);

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const finish = async () => {
    const goals = [...new Set(growth.flatMap((i) => GROWTH[i].cats))];
    const enabled = remind;
    // Keep the preference even if the browser blocks notifications: native/web push reads it server-side.
    if (remind) await requestPermission().catch(() => false);
    actions.updateProfile({ name: name.trim(), goals, patterns: patterns.length ? patterns : goals, minutes, onboardedAt: new Date().toISOString(),
      reminder: { ...s.profile.reminder, enabled, time } });
    track('onboarding_completed', { goals: goals.length, patterns: patterns.length, minutes, reminder: enabled });
    if (enabled) track('reminder_enabled', { time, from: 'onboarding' });
    go({ name: 'renewal' }, true);
  };

  if (step === 0) {
    return (
      <div className="stack" style={{ minHeight: '88dvh', justifyContent: 'space-between', paddingTop: 24 }}>
        <span className="brand enter"><Logo size={32} /> MindRenew</span>
        <div className="stack">
          <p className="eyebrow gold enter">Think truth. Live free.</p>
          <h1 className="h1 enter-2" style={{ fontSize: 40 }}>What lie are you believing today?</h1>
          <p className="lead enter-3">Stop believing every thought. In 3 to 5 minutes a day, recognize the lies shaping your mind and replace them with what God actually says.</p>
          <div className="card flat tint enter-4">
            <p className="scripture sm">“Be transformed by the renewing of your mind.”</p>
            <p className="ref mt-8">Romans 12:2</p>
          </div>
        </div>
        <div className="stack-sm enter-4">
          <button className="btn primary block" onClick={() => setStep(1)}>Begin <Icon name="arrow" size={18} /></button>
          <p className="tiny muted center">No account needed to start.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="flow-top">
        <button className="icon-btn plain" onClick={() => setStep(step - 1)} aria-label="Back"><Icon name="back" /></button>
        <div className="progress"><div style={{ width: `${(step / 4) * 100}%` }} /></div>
        <span className="tiny muted" style={{ width: 44, textAlign: 'right' }}>{step}/4</span>
      </div>

      {step === 1 && (
        <div className="stack" key="1">
          <h1 className="h1 enter">What do you want to grow in?</h1>
          <p className="lead enter-2">Choose any that resonate.</p>
          <div className="stack-sm enter-3">
            {GROWTH.map((g, i) => (
              <button key={g.label} className="option wide" aria-pressed={growth.includes(i)} onClick={() => setGrowth(toggle(growth, i))}>
                <strong style={{ fontWeight: 500 }}>{g.label}</strong>
                <span className="radio">{growth.includes(i) && <Icon name="check" size={14} />}</span>
              </button>
            ))}
          </div>
          <div className="flow-footer"><button className="btn primary block" disabled={!growth.length} onClick={() => setStep(2)}>Continue</button></div>
        </div>
      )}

      {step === 2 && (
        <div className="stack" key="2">
          <h1 className="h1 enter">Which thought patterns challenge you most?</h1>
          <p className="lead enter-2">We’ll put these first in your daily renewal.</p>
          <div className="chips enter-3">
            {CATEGORIES.filter((c) => c.id !== 'other').map((c) => (
              <button key={c.id} className="chip" aria-pressed={patterns.includes(c.id)} onClick={() => setPatterns(toggle(patterns, c.id))}>{c.label}</button>
            ))}
          </div>
          <div className="flow-footer"><button className="btn primary block" onClick={() => setStep(3)}>{patterns.length ? 'Continue' : 'Skip'}</button></div>
        </div>
      )}

      {step === 3 && (
        <div className="stack" key="3">
          <h1 className="h1 enter">How much time can you give each day?</h1>
          <p className="lead enter-2">Small and consistent beats long and rare.</p>
          <div className="stack-sm enter-3">
            {([3, 5, 10] as const).map((m) => (
              <button key={m} className="option wide" aria-pressed={minutes === m} onClick={() => setMinutes(m)}>
                <div><strong>{m} minutes</strong><br /><span>{m === 3 ? 'A quick daily reset' : m === 5 ? 'Recommended: room to reflect' : 'Go deeper with journaling'}</span></div>
                <span className="radio">{minutes === m && <Icon name="check" size={14} />}</span>
              </button>
            ))}
          </div>
          <div className="flow-footer"><button className="btn primary block" onClick={() => setStep(4)}>Continue</button></div>
        </div>
      )}

      {step === 4 && (
        <div className="stack" key="4">
          <h1 className="h1 enter">Would you like a daily reminder?</h1>
          <p className="lead enter-2">A gentle invitation, never guilt. Change it anytime.</p>
          <div className="card enter-3 stack">
            <div className="row between"><p className="h3">Daily reminder</p><Toggle checked={remind} onChange={setRemind} label="Daily reminder" /></div>
            {remind && (
              <div className="row between">
                <label htmlFor="time" className="small muted">Time</label>
                <input id="time" type="time" className="input" style={{ width: 140 }} value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            )}
            <p className="small muted" style={{ fontStyle: 'italic' }}>“Before you believe what your thoughts are telling you, discover what God says.”</p>
          </div>
          <div className="field enter-4">
            <label htmlFor="name">What should we call you? <span className="muted">(optional)</span></label>
            <input id="name" className="input" value={name} autoComplete="given-name" maxLength={40} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flow-footer"><button className="btn primary block" onClick={finish}>Start my first renewal <Icon name="arrow" size={18} /></button></div>
        </div>
      )}
    </div>
  );
}
