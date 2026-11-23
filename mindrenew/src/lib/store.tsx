import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { AppState, Draft, Plan, Profile, Renewal, SavedTruth } from './types';
import { supabase } from './supabase';
import { weekKey } from './dates';

const KEY = 'mr.state.v1';

export const DEFAULT_PROFILE: Profile = {
  name: '',
  goals: [],
  patterns: [],
  minutes: 5,
  reminder: { enabled: false, time: '07:30', frequency: 'daily', truthResurfacing: true, weeklySummary: true },
  onboardedAt: null,
};

export function initialState(): AppState {
  return {
    version: 1, userId: null, email: null, plan: 'free', profile: DEFAULT_PROFILE,
    renewals: [], truths: [], draft: null, journeys: {}, companion: { week: weekKey(), used: 0 },
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as AppState;
    return { ...initialState(), ...parsed, profile: { ...DEFAULT_PROFILE, ...parsed.profile, reminder: { ...DEFAULT_PROFILE.reminder, ...parsed.profile?.reminder } } };
  } catch {
    return initialState();
  }
}

/* ---------- tiny external store ---------- */
let state: AppState = typeof localStorage === 'undefined' ? initialState() : load();
const listeners = new Set<() => void>();

function set(next: AppState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* storage full or blocked: keep in memory */ }
  listeners.forEach((l) => l());
}

export function getState(): AppState {
  return state;
}

/* ---------- cloud sync (no-op in local mode) ---------- */
type Row = Record<string, unknown>;
const renewalRow = (r: Renewal, user_id: string): Row => ({
  id: r.id, user_id, date: r.date, created_at: r.createdAt, category: r.category, lie_id: r.lieId,
  lie_text: r.lieText, verse_id: r.verseId, reflection: r.reflection, action: r.action, journey_id: r.journeyId ?? null,
});
const truthRow = (t: SavedTruth, user_id: string): Row => ({
  id: t.id, user_id, category: t.category, lie_text: t.lieText, truth: t.truth, verse_id: t.verseId,
  reflection: t.reflection, saved_at: t.savedAt, favorite: t.favorite, source: t.source,
});
const profileRow = (p: Profile, id: string): Row => ({
  id, name: p.name, goals: p.goals, patterns: p.patterns, minutes: p.minutes, reminder: p.reminder, onboarded_at: p.onboardedAt,
});

function push(table: string, row: Row | Row[]) {
  if (!supabase || !state.userId) return;
  supabase.from(table).upsert(row).then(({ error }) => {
    if (error) console.warn(`[sync] ${table}`, error.message);
  });
}
function remove(table: string, id: string) {
  if (!supabase || !state.userId) return;
  supabase.from(table).delete().eq('id', id).then(() => {});
}

/** Pull remote data after sign-in, merge with anything done before signing up, push the union. */
export async function syncAfterSignIn(userId: string, email: string | null): Promise<void> {
  if (!supabase) return;
  const [profileRes, renewalsRes, truthsRes, subRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('renewals').select('*').eq('user_id', userId),
    supabase.from('truths').select('*').eq('user_id', userId),
    supabase.from('subscriptions').select('status').eq('user_id', userId).maybeSingle(),
  ]);
  const remoteRenewals: Renewal[] = (renewalsRes.data ?? []).map((r) => ({
    id: r.id, date: r.date, createdAt: r.created_at, category: r.category, lieId: r.lie_id, lieText: r.lie_text,
    verseId: r.verse_id, reflection: r.reflection ?? '', action: r.action ?? '', journeyId: r.journey_id ?? undefined,
  }));
  const remoteTruths: SavedTruth[] = (truthsRes.data ?? []).map((t) => ({
    id: t.id, category: t.category, lieText: t.lie_text, truth: t.truth, verseId: t.verse_id,
    reflection: t.reflection ?? '', savedAt: t.saved_at, favorite: t.favorite, source: t.source,
  }));
  const byId = <T extends { id: string }>(a: T[], b: T[]) => Object.values(Object.fromEntries([...a, ...b].map((x) => [x.id, x]))) as T[];
  const p = profileRes.data;
  const profile: Profile = p
    ? { name: p.name ?? '', goals: p.goals ?? [], patterns: p.patterns ?? [], minutes: p.minutes ?? 5, reminder: { ...DEFAULT_PROFILE.reminder, ...p.reminder }, onboardedAt: p.onboarded_at ?? state.profile.onboardedAt }
    : state.profile;
  const plan: Plan = subRes.data && ['active', 'trialing'].includes(subRes.data.status) ? 'premium' : 'free';
  set({
    ...state, userId, email, plan, profile,
    renewals: byId(remoteRenewals, state.renewals).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    truths: byId(remoteTruths, state.truths).sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
  });
  push('profiles', profileRow(state.profile, userId));
  if (state.renewals.length) push('renewals', state.renewals.map((r) => renewalRow(r, userId)));
  if (state.truths.length) push('truths', state.truths.map((t) => truthRow(t, userId)));
}

/* ---------- actions ---------- */
export const actions = {
  updateProfile(patch: Partial<Profile>) {
    set({ ...state, profile: { ...state.profile, ...patch } });
    if (state.userId) push('profiles', profileRow(state.profile, state.userId));
  },
  setDraft(draft: Draft | null) {
    set({ ...state, draft });
  },
  addRenewal(r: Renewal) {
    const journeys = r.journeyId ? { ...state.journeys, [r.journeyId]: (state.journeys[r.journeyId] ?? 0) + 1 } : state.journeys;
    set({ ...state, renewals: [...state.renewals, r], draft: null, journeys });
    if (state.userId) push('renewals', renewalRow(r, state.userId));
  },
  saveTruth(t: SavedTruth) {
    if (state.truths.some((x) => x.verseId === t.verseId && x.lieText === t.lieText)) return;
    set({ ...state, truths: [t, ...state.truths] });
    if (state.userId) push('truths', truthRow(t, state.userId));
  },
  toggleFavorite(id: string) {
    set({ ...state, truths: state.truths.map((t) => (t.id === id ? { ...t, favorite: !t.favorite } : t)) });
    const t = state.truths.find((x) => x.id === id);
    if (t && state.userId) push('truths', truthRow(t, state.userId));
  },
  deleteTruth(id: string) {
    set({ ...state, truths: state.truths.filter((t) => t.id !== id) });
    remove('truths', id);
  },
  setCompanionUsed(used: number) {
    set({ ...state, companion: { week: weekKey(), used } });
  },
  setPlan(plan: Plan) {
    set({ ...state, plan });
  },
  signedOut() {
    set({ ...initialState(), profile: state.profile });
  },
  resetAll() {
    set(initialState());
  },
};

/* ---------- React bindings ---------- */
const Ctx = createContext<AppState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (u) syncAfterSignIn(u.id, u.email ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user && session.user.id !== state.userId) syncAfterSignIn(session.user.id, session.user.email ?? null);
      if (event === 'SIGNED_OUT') actions.signedOut();
    });
    return () => data.subscription.unsubscribe();
  }, []);
  // Reset the weekly companion counter display when the week rolls over.
  const value = useMemo(() => (snap.companion.week === weekKey() ? snap : { ...snap, companion: { week: weekKey(), used: 0 } }), [snap]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): AppState {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}
