import { useEffect } from 'react';
import { useStore } from '../lib/store';
import { bestStreak, consistencyGrid, currentStreak, topPatterns, weeklySummary } from '../lib/stats';
import { getVerse } from '../content/scripture';
import { limitsFor } from '../lib/entitlements';
import { track } from '../lib/analytics';
import { Icon } from '../ui/kit';
import { openPaywall } from '../ui/overlays';

export function Progress() {
  const s = useStore();
  const summary = weeklySummary(s.renewals, s.truths);
  const grid = consistencyGrid(s.renewals, 12);
  const patterns = topPatterns(s.renewals, 5);
  const maxCount = Math.max(1, ...patterns.map((p) => p.count));
  const premium = limitsFor(s.plan).advancedInsights;
  useEffect(() => { track('progress_opened', {}); }, []);

  // Truths returned to most: verses that appear in more than one renewal.
  const verseCounts = new Map<string, number>();
  for (const r of s.renewals) verseCounts.set(r.verseId, (verseCounts.get(r.verseId) ?? 0) + 1);
  const anchors = [...verseCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Month-over-month shift in focus.
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const recent = topPatterns(s.renewals.filter((r) => r.date >= monthAgo), 1)[0];
  const earlier = topPatterns(s.renewals.filter((r) => r.date < monthAgo), 1)[0];

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Your</p>
        <h1 className="h1">Renewal journey</h1>
      </div>

      <div className="card hero stack-sm">
        <p className="eyebrow">This week</p>
        <p className="h2" style={{ position: 'relative', zIndex: 1 }}>{summary.message}</p>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="num">{s.renewals.length}</div><div className="lbl">Renewals completed</div></div>
        <div className="stat"><div className="num">{s.truths.length}</div><div className="lbl">Truths saved</div></div>
        <div className="stat"><div className="num row" style={{ gap: 6 }}>{currentStreak(s.renewals)}<span style={{ color: 'var(--gold)', display: 'flex' }}><Icon name="flame" size={22} /></span></div><div className="lbl">Current rhythm</div></div>
        <div className="stat"><div className="num">{bestStreak(s.renewals)}</div><div className="lbl">Longest rhythm</div></div>
      </div>

      <section className="card stack">
        <div className="row between"><p className="h3">Consistency</p><span className="tiny muted">Last 12 weeks</span></div>
        <div className="heat" aria-label="Consistency over the last 12 weeks">
          {grid.flat().map((d) => <i key={d.date} title={`${d.date}: ${d.count}`} className={d.future ? 'f' : d.count >= 2 ? 'l2' : d.count === 1 ? 'l1' : ''} />)}
        </div>
        <p className="tiny muted">Missed days are part of every journey. What matters is coming back.</p>
      </section>

      <section className="card stack">
        <p className="h3">Thought patterns you’ve recognized</p>
        {patterns.length === 0 ? <p className="small muted">Complete a renewal to start seeing your patterns.</p> : patterns.map((p) => (
          <div key={p.category} className="stack-sm" style={{ gap: 6 }}>
            <div className="row between small"><span>{p.label}</span><span className="muted">{p.count}</span></div>
            <div className="bar"><div style={{ width: `${(p.count / maxCount) * 100}%` }} /></div>
          </div>
        ))}
      </section>

      <section className="card stack" style={{ position: 'relative' }}>
        <div className="row between"><p className="h3">Insights</p>{!premium && <span className="lock"><Icon name="lock" size={14} /> Premium</span>}</div>
        <div className="stack" style={premium ? undefined : { filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none' }} aria-hidden={!premium}>
          <div>
            <p className="eyebrow">Truths you return to</p>
            {anchors.length ? anchors.map(([id, n]) => <p key={id} className="small mt-8"><span className="ref">{getVerse(id).ref}</span> <span className="muted">· {n}×</span></p>) : <p className="small muted mt-8">Patterns appear after a few renewals.</p>}
          </div>
          <div>
            <p className="eyebrow">How your focus is shifting</p>
            <p className="small mt-8">{recent && earlier && recent.category !== earlier.category
              ? `Earlier you most often wrestled with ${earlier.label.toLowerCase()}. This month it’s been ${recent.label.toLowerCase()}.`
              : recent ? `This month your focus has been ${recent.label.toLowerCase()}. Keep bringing it to God’s Word.` : 'Your trends will appear as you keep renewing.'}</p>
          </div>
          <div><p className="eyebrow">Reflections written</p><p className="small mt-8">{s.renewals.filter((r) => r.reflection).length} personal reflections</p></div>
        </div>
        {!premium && <button className="btn secondary small" style={{ alignSelf: 'center' }} onClick={() => openPaywall('insights')}>Unlock insights</button>}
      </section>
    </div>
  );
}
