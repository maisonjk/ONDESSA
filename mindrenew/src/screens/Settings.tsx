import { useState } from 'react';
import { actions, useStore } from '../lib/store';
import { CATEGORIES, type CategoryId } from '../content/lies';
import { TRANSLATION_NAME } from '../content/scripture';
import { supabase, cloudEnabled } from '../lib/supabase';
import { openBillingPortal, ApiError } from '../lib/api';
import { requestPermission, notificationsSupported } from '../lib/reminders';
import { track } from '../lib/analytics';
import { back } from '../router';
import { Icon, Toggle, TopBar, toast } from '../ui/kit';
import { devTogglePremium, openAuth, openPaywall } from '../ui/overlays';
import type { ReminderPrefs } from '../lib/types';

export function Settings() {
  const s = useStore();
  const r = s.profile.reminder;
  const [busy, setBusy] = useState(false);

  const setReminder = async (patch: Partial<ReminderPrefs>) => {
    if (patch.enabled) {
      const ok = await requestPermission();
      if (!ok && notificationsSupported()) toast('Notifications are blocked in this browser. Your preference is saved.');
      track('reminder_enabled', { from: 'settings' });
    }
    actions.updateProfile({ reminder: { ...r, ...patch } });
  };

  const toggleCat = (c: CategoryId) => {
    const p = s.profile.patterns;
    actions.updateProfile({ patterns: p.includes(c) ? p.filter((x) => x !== c) : [...p, c] });
  };

  const manage = async () => {
    setBusy(true);
    try {
      const { url } = await openBillingPortal();
      location.href = url;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Couldn’t open billing.');
      setBusy(false);
    }
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), profile: s.profile, renewals: s.renewals, truths: s.truths }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mindrenew-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="stack">
      <TopBar onBack={() => back()} title="Profile & settings" />

      <section className="card">
        <p className="eyebrow" style={{ marginBottom: 4 }}>Account</p>
        <div className="setting">
          <div className="field grow" style={{ gap: 2 }}>
            <label htmlFor="nm" className="small muted" style={{ fontWeight: 500 }}>Name</label>
            <input id="nm" className="input" style={{ border: 0, padding: 0, background: 'none' }} value={s.profile.name} placeholder="Add your name" maxLength={40} onChange={(e) => actions.updateProfile({ name: e.target.value })} />
          </div>
        </div>
        {s.userId ? (
          <div className="setting"><div><p className="small">{s.email}</p><p className="tiny muted">Synced across your devices</p></div><button className="btn ghost small" onClick={() => supabase?.auth.signOut()}>Sign out</button></div>
        ) : (
          <div className="setting"><div><p className="small">{cloudEnabled ? 'Not signed in' : 'Local mode'}</p><p className="tiny muted">{cloudEnabled ? 'Your data is on this device only' : 'Data stays in this browser'}</p></div><button className="btn secondary small" onClick={() => openAuth('settings')}>Sign in</button></div>
        )}
      </section>

      <section className="card">
        <p className="eyebrow" style={{ marginBottom: 4 }}>Plan</p>
        <div className="setting">
          <div><p className="h3">{s.plan === 'premium' ? 'MindRenew Premium' : 'Free'}</p><p className="tiny muted">{s.plan === 'premium' ? 'Everything unlocked' : '1 renewal a day · 15 saved truths · 3 Companion chats a week'}</p></div>
          {s.plan === 'premium' ? <button className="btn ghost small" disabled={busy} onClick={manage}>Manage</button> : <button className="btn primary small" onClick={() => openPaywall('settings')}>Upgrade</button>}
        </div>
        {import.meta.env.DEV && <div className="setting"><p className="tiny muted">Dev: preview plan</p><button className="btn ghost small" onClick={devTogglePremium}>Toggle premium</button></div>}
      </section>

      <section className="card">
        <p className="eyebrow" style={{ marginBottom: 4 }}>Reminders</p>
        <div className="setting"><div><p className="small">Daily renewal reminder</p><p className="tiny muted">A gentle invitation, never guilt</p></div><Toggle checked={r.enabled} onChange={(v) => setReminder({ enabled: v })} label="Daily reminder" /></div>
        {r.enabled && (
          <>
            <div className="setting"><label htmlFor="rt" className="small">Time</label><input id="rt" type="time" className="input" style={{ width: 130, padding: '8px 12px' }} value={r.time} onChange={(e) => setReminder({ time: e.target.value })} /></div>
            <div className="setting"><span className="small">Frequency</span>
              <div className="chips">
                <button className="chip sm" aria-pressed={r.frequency === 'daily'} onClick={() => setReminder({ frequency: 'daily' })}>Every day</button>
                <button className="chip sm" aria-pressed={r.frequency === 'weekdays'} onClick={() => setReminder({ frequency: 'weekdays' })}>Weekdays</button>
              </div>
            </div>
          </>
        )}
        <div className="setting"><div><p className="small">Resurface saved truths</p><p className="tiny muted">Bring back a truth you saved on your home screen</p></div><Toggle checked={r.truthResurfacing} onChange={(v) => setReminder({ truthResurfacing: v })} label="Resurface saved truths" /></div>
        <div className="setting"><div><p className="small">Weekly summary</p><p className="tiny muted">A short recap of your week</p></div><Toggle checked={r.weeklySummary} onChange={(v) => setReminder({ weeklySummary: v })} label="Weekly summary" /></div>
      </section>

      <section className="card stack-sm">
        <p className="eyebrow">Thought patterns to prioritize</p>
        <div className="chips">
          {CATEGORIES.filter((c) => c.id !== 'other').map((c) => <button key={c.id} className="chip sm" aria-pressed={s.profile.patterns.includes(c.id)} onClick={() => toggleCat(c.id)}>{c.label}</button>)}
        </div>
        <div className="setting"><span className="small">Daily time</span>
          <div className="chips">{([3, 5, 10] as const).map((m) => <button key={m} className="chip sm" aria-pressed={s.profile.minutes === m} onClick={() => actions.updateProfile({ minutes: m })}>{m} min</button>)}</div>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow" style={{ marginBottom: 4 }}>Your data</p>
        <div className="setting"><span className="small">Export everything (JSON)</span><button className="btn ghost small" onClick={exportData}>Export</button></div>
        <div className="setting"><span className="small">Erase data on this device</span><button className="btn ghost small" style={{ color: 'var(--lie)' }} onClick={() => confirm('Erase all MindRenew data on this device? Synced data in your account is not deleted.') && actions.resetAll()}>Erase</button></div>
      </section>

      <section className="card flat tint stack-sm">
        <p className="eyebrow">About</p>
        <p className="small">Scripture quotations are from the {TRANSLATION_NAME} (public domain). MindRenew’s reflections and Truth Companion responses are written to help you apply Scripture; they aren’t Scripture and aren’t a word from God.</p>
        <p className="small">MindRenew is a spiritual growth tool, not a substitute for professional mental health care. If you’re struggling, please talk with a pastor, counselor or doctor.</p>
        <p className="small"><strong>In crisis?</strong> Call or text <a href="tel:988" className="link">988</a> (US). Outside the US, contact local emergency services.</p>
        <p className="tiny muted row" style={{ gap: 6 }}><Icon name="lock" size={12} /> Your reflections are private. We never sell your data.</p>
      </section>
    </div>
  );
}
