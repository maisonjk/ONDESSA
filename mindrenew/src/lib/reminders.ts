import type { ReminderPrefs } from './types';

/** Ethical copy only: invitations, never guilt or fear. */
export const REMINDER_MESSAGES = [
  'Before you believe what your thoughts are telling you, discover what God says.',
  'Today’s reminder: your identity is not defined by your past.',
  'Three quiet minutes with God’s truth. Ready when you are.',
  'What is one thought you want to bring to God today?',
  'His mercies are new this morning. So is today’s renewal.',
  'You don’t have to believe every thought. Come renew your mind.',
];

export function reminderMessage(seed = new Date().getDate()): string {
  return REMINDER_MESSAGES[seed % REMINDER_MESSAGES.length];
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

/** Milliseconds until the next reminder, or null if none applies. */
export function msUntilNext(prefs: ReminderPrefs, now = new Date()): number | null {
  if (!prefs.enabled) return null;
  const [h, m] = prefs.time.split(':').map(Number);
  for (let i = 0; i < 8; i++) {
    const t = new Date(now);
    t.setDate(now.getDate() + i);
    t.setHours(h, m, 0, 0);
    const dow = t.getDay();
    if (t > now && (prefs.frequency === 'daily' || (dow >= 1 && dow <= 5))) return t.getTime() - now.getTime();
  }
  return null;
}

/**
 * Web reminder while the app is open or installed as a PWA. Native push (Capacitor or web push)
 * reads the same prefs from the `profiles.reminder` column; see README "Reminders".
 */
export function scheduleInAppReminder(prefs: ReminderPrefs, alreadyRenewedToday: () => boolean): () => void {
  const ms = msUntilNext(prefs);
  if (ms === null || ms > 2_147_000_000) return () => {};
  const timer = setTimeout(() => {
    if (!alreadyRenewedToday() && notificationsSupported() && Notification.permission === 'granted') {
      new Notification('MindRenew', { body: reminderMessage(), icon: '/icon.svg' });
    }
  }, ms);
  return () => clearTimeout(timer);
}
