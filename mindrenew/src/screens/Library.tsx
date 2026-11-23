import { useEffect, useMemo, useState } from 'react';
import { useStore, actions } from '../lib/store';
import { CATEGORY_BY_ID, LIES, type CategoryId } from '../content/lies';
import { getVerse } from '../content/scripture';
import { limitsFor } from '../lib/entitlements';
import { track } from '../lib/analytics';
import { go } from '../router';
import { Icon, ScriptureBlock, Sheet } from '../ui/kit';
import { openPaywall } from '../ui/overlays';
import type { SavedTruth } from '../lib/types';

const LIBRARY_CATEGORIES: CategoryId[] = ['identity', 'fear', 'anxiety', 'control', 'guilt', 'shame', 'purpose', 'rejection', 'comparison', 'unforgiveness', 'loneliness', 'doubt', 'insecurity'];

export function Library() {
  const s = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<CategoryId | 'all' | 'fav'>('all');
  const [open, setOpen] = useState<SavedTruth | null>(null);
  const [browse, setBrowse] = useState(false);
  const limit = limitsFor(s.plan).savedTruths;

  useEffect(() => { track('library_opened', { count: s.truths.length }); }, [s.truths.length]);

  const present = useMemo(() => LIBRARY_CATEGORIES.filter((c) => s.truths.some((t) => t.category === c)), [s.truths]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return s.truths.filter((t) => {
      if (cat === 'fav' && !t.favorite) return false;
      if (cat !== 'all' && cat !== 'fav' && t.category !== cat) return false;
      if (!term) return true;
      const v = getVerse(t.verseId);
      return [t.truth, t.lieText, t.reflection, v.text, v.ref].some((x) => x.toLowerCase().includes(term));
    });
  }, [s.truths, q, cat]);

  return (
    <div className="stack">
      <div className="row between">
        <div>
          <p className="eyebrow">Your</p>
          <h1 className="h1">Truth Library</h1>
        </div>
        {Number.isFinite(limit) && <span className="badge">{s.truths.length}/{limit}</span>}
      </div>
      <p className="muted">Every truth you discover lives here. Over time it becomes your personal collection of God’s promises.</p>

      {s.truths.length > 0 && (
        <>
          <div className="row" style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, color: 'var(--muted)', display: 'flex' }}><Icon name="search" size={18} /></span>
            <input className="input" style={{ paddingLeft: 42 }} placeholder="Search truths, verses, reflections" value={q}
              onChange={(e) => setQ(e.target.value)} onBlur={() => q && track('library_searched', { len: q.length })} aria-label="Search your library" />
          </div>
          <div className="scroll-x" role="tablist">
            <button className="chip sm" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>All</button>
            <button className="chip sm" aria-pressed={cat === 'fav'} onClick={() => setCat('fav')}>♥ Favorites</button>
            {present.map((c) => <button key={c} className="chip sm" aria-pressed={cat === c} onClick={() => setCat(c)}>{CATEGORY_BY_ID[c].label}</button>)}
          </div>
        </>
      )}

      {s.truths.length === 0 ? (
        <div className="card empty stack-sm">
          <p className="h2">Your library starts with one truth.</p>
          <p className="muted">Complete a daily renewal and save what God shows you.</p>
          <button className="btn primary mt-16" onClick={() => go({ name: 'renewal' })}>Start a renewal</button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="muted center" style={{ padding: 32 }}>Nothing matches that yet.</p>
      ) : (
        <div className="stack-sm">
          {filtered.map((t) => (
            <button key={t.id} className="card pressable stack-sm" style={{ padding: 18 }} onClick={() => setOpen(t)}>
              <div className="row between">
                <span className="tiny muted" style={{ fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>{CATEGORY_BY_ID[t.category]?.label}</span>
                {t.favorite && <span style={{ color: 'var(--gold)' }}><Icon name="heart" size={16} fill /></span>}
              </div>
              <p className="truth-statement" style={{ fontSize: 19 }}>{t.truth}</p>
              <p className="small muted" style={{ textDecoration: 'line-through' }}>{t.lieText}</p>
              <p className="ref">{getVerse(t.verseId).ref}</p>
            </button>
          ))}
        </div>
      )}

      <button className="card flat tint pressable row between" onClick={() => setBrowse(true)}>
        <div><p className="h3" style={{ fontSize: 15 }}>Browse all biblical truths</p><p className="small muted">{LIES.length} lies answered with Scripture</p></div>
        {s.plan === 'premium' ? <Icon name="arrow" /> : <span className="lock"><Icon name="lock" size={14} /> Premium</span>}
      </button>

      <Sheet open={!!open} onClose={() => setOpen(null)} label="Saved truth">
        {open && <TruthDetail t={s.truths.find((x) => x.id === open.id) ?? open} onClose={() => setOpen(null)} />}
      </Sheet>
      <Sheet open={browse} onClose={() => setBrowse(false)} label="Browse truths">
        {browse && <Browse onClose={() => setBrowse(false)} />}
      </Sheet>
    </div>
  );
}

function TruthDetail({ t, onClose }: { t: SavedTruth; onClose: () => void }) {
  return (
    <div className="stack">
      <div className="row between">
        <span className="badge">{CATEGORY_BY_ID[t.category]?.label}</span>
        <span className="tiny muted">Saved {new Date(t.savedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
      </div>
      <div className="lie-block"><span className="label-tag lie-tag">The lie</span><p className="lie-text mt-8">“{t.lieText}”</p></div>
      <ScriptureBlock verseId={t.verseId} showContext tag />
      <div className="card flat tint"><p className="eyebrow gold">My truth</p><p className="truth-statement mt-8">{t.truth}</p></div>
      {t.reflection && <div><p className="eyebrow">My reflection</p><p className="mt-8" style={{ whiteSpace: 'pre-wrap' }}>{t.reflection}</p></div>}
      <div className="row">
        <button className="btn secondary grow" onClick={() => { actions.toggleFavorite(t.id); track('truth_favorited', { on: !t.favorite }); }}>
          <Icon name="heart" size={18} fill={t.favorite} /> {t.favorite ? 'Favorited' : 'Favorite'}
        </button>
        <button className="icon-btn" aria-label="Delete truth" onClick={() => { if (confirm('Remove this truth from your library?')) { actions.deleteTruth(t.id); onClose(); } }}><Icon name="trash" size={18} /></button>
      </div>
    </div>
  );
}

function Browse({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [q, setQ] = useState('');
  if (s.plan !== 'premium') {
    return (
      <div className="stack center">
        <p className="eyebrow gold">Premium</p>
        <h2 className="h2">Search every biblical truth in MindRenew</h2>
        <p className="muted">Browse {LIES.length} common lies, each answered with Scripture, context and a practical step. Start a renewal from any of them.</p>
        <button className="btn primary block" onClick={() => { onClose(); openPaywall('library_full'); }}>See Premium</button>
      </div>
    );
  }
  const term = q.toLowerCase();
  const list = LIES.filter((l) => !term || [l.text, l.truth, getVerse(l.verseId).ref, getVerse(l.verseId).text].some((x) => x.toLowerCase().includes(term)));
  return (
    <div className="stack">
      <h2 className="h2">Biblical truths</h2>
      <input className="input" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search truths" />
      <div>
        {list.map((l) => (
          <button key={l.id} className="list-item pressable" style={{ border: 0, background: 'none', borderBottom: '1px solid var(--line)', width: '100%' }} onClick={() => { onClose(); go({ name: 'renewal', lieId: l.id }); }}>
            <div className="grow stack-sm" style={{ gap: 4 }}>
              <p className="small muted" style={{ textDecoration: 'line-through' }}>{l.text}</p>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{l.truth}</p>
              <p className="ref">{getVerse(l.verseId).ref}</p>
            </div>
            <Icon name="arrow" size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}
