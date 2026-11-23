import { useStore } from '../lib/store';
import { JOURNEYS } from '../content/journeys';
import { LIE_BY_ID } from '../content/lies';
import { limitsFor, canStartRenewal } from '../lib/entitlements';
import { track } from '../lib/analytics';
import { back, go } from '../router';
import { Icon, TopBar } from '../ui/kit';
import { openPaywall } from '../ui/overlays';

export function Journeys() {
  const s = useStore();
  const unlocked = limitsFor(s.plan).journeys;
  const start = (id: string) => {
    if (!unlocked) return openPaywall('journeys');
    const day = s.journeys[id] ?? 0;
    const j = JOURNEYS.find((x) => x.id === id)!;
    if (day >= j.days.length) return;
    if (!canStartRenewal(s)) return openPaywall('second_renewal');
    if (day === 0) track('journey_started', { id });
    go({ name: 'renewal', lieId: j.days[day].lieId, journeyId: id });
  };
  return (
    <div className="stack">
      <TopBar onBack={() => back()} />
      <div>
        <p className="eyebrow gold">Guided journeys</p>
        <h1 className="h1">Renew one area, seven days at a time.</h1>
      </div>
      {JOURNEYS.map((j) => {
        const day = s.journeys[j.id] ?? 0;
        const finished = day >= j.days.length;
        return (
          <section key={j.id} className="card stack">
            <div className="row between">
              <p className="h2" style={{ fontSize: 21 }}>{j.title.split(':')[0]}</p>
              {!unlocked ? <span className="lock"><Icon name="lock" size={14} /> Premium</span> : finished ? <span className="badge">Complete</span> : day > 0 ? <span className="badge">Day {day + 1}</span> : null}
            </div>
            <p className="small muted">{j.title.split(': ')[1]} · {j.subtitle}</p>
            <div className="bar"><div style={{ width: `${(Math.min(day, 7) / 7) * 100}%` }} /></div>
            <ol className="small" style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-2)' }}>
              {j.days.map((d, i) => <li key={i} style={{ opacity: i < day ? 0.5 : 1, textDecoration: i < day ? 'line-through' : 'none' }}>{d.title} <span className="muted">· {LIE_BY_ID[d.lieId].text}</span></li>)}
            </ol>
            {!finished && <button className="btn primary block" onClick={() => start(j.id)}>{day === 0 ? 'Begin journey' : `Continue: day ${day + 1}`}</button>}
          </section>
        );
      })}
    </div>
  );
}
