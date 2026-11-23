import { supabase } from './supabase';
import { uid } from './id';

/**
 * Product analytics, first-party. Events go to the `events` table (RLS: insert own rows only)
 * and power the SQL views in supabase/migrations for activation, retention and conversion.
 * Anonymous users get a stable device id so pre-signup funnels are measurable.
 */
export type EventName =
  | 'app_opened' | 'onboarding_started' | 'onboarding_completed'
  | 'renewal_started' | 'renewal_step' | 'renewal_completed' | 'first_renewal_completed'
  | 'truth_saved' | 'truth_favorited' | 'library_opened' | 'library_searched'
  | 'daily_truth_viewed' | 'companion_used' | 'companion_limit_hit' | 'crisis_resources_shown'
  | 'paywall_viewed' | 'checkout_started' | 'signup_prompted' | 'signed_in'
  | 'reminder_enabled' | 'journey_started' | 'progress_opened';

const DEVICE_KEY = 'mr.device';
function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = uid();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'unknown';
  }
}

export function track(name: EventName, props: Record<string, unknown> = {}): void {
  const row = { id: uid(), name, props, device_id: deviceId(), created_at: new Date().toISOString() };
  if (import.meta.env.DEV) console.debug('[track]', name, props);
  if (!supabase) return;
  supabase.auth.getSession().then(({ data }) => {
    const user_id = data.session?.user.id ?? null;
    return supabase!.from('events').insert({ ...row, user_id });
  }).catch(() => {});
}
