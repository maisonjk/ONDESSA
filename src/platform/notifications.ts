import type { Reminder } from '../engine';
import { isNative } from './index';

/**
 * Native local notifications, scheduled on the device. Nothing is sent to a server and
 * the notification text is the reminder engine's discreet-aware wording.
 * Reminders fire at 9:00 local time on their date.
 */
const MAX_SCHEDULED = 20;
const HOUR = 9;
/** Reserved id for the free-trial ending reminder; never cleared by cycle reminder syncs. */
const TRIAL_ID = 9001;

export async function notificationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!isNative) {
    if (typeof Notification === 'undefined') return 'denied';
    return Notification.permission === 'default' ? 'prompt' : Notification.permission;
  }
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const { display } = await LocalNotifications.checkPermissions();
  return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNative) {
    if (typeof Notification === 'undefined') return false;
    return (await Notification.requestPermission()) === 'granted';
  }
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  return (await LocalNotifications.requestPermissions()).display === 'granted';
}

/** Replace every scheduled Ondessa notification with the given reminders. Native only. */
export async function syncReminders(reminders: Reminder[], today: string): Promise<void> {
  if (!isNative) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
  const pending = await LocalNotifications.getPending();
  const stale = pending.notifications.filter((n) => n.id !== TRIAL_ID);
  if (stale.length) await LocalNotifications.cancel({ notifications: stale.map((n) => ({ id: n.id })) });

  const now = new Date();
  const items = reminders
    .map((r, i) => {
      const [y, m, d] = r.date.split('-').map(Number) as [number, number, number];
      const at = r.id === 'daily-log' ? nextDailyTime(today) : new Date(y, m - 1, d, HOUR, 0, 0);
      return { r, i, at };
    })
    .filter(({ at }) => at > now)
    .slice(0, MAX_SCHEDULED);

  if (!items.length) return;
  if (items.some(({ r }) => r.actions === 'period-check')) await registerActions();
  await LocalNotifications.schedule({
    notifications: items.map(({ r, i, at }) => ({
      id: i + 1,
      title: 'Ondessa',
      body: r.notification,
      ...(r.actions ? { actionTypeId: r.actions, extra: { kind: r.actions } } : {}),
      schedule: r.id === 'daily-log' ? { on: { hour: 20, minute: 0 }, allowWhileIdle: true } : { at, allowWhileIdle: true },
    })),
  });
}

function nextDailyTime(today: string): Date {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const at = new Date(y, m - 1, d, 20, 0, 0);
  if (at <= new Date()) at.setDate(at.getDate() + 1);
  return at;
}

/**
 * Two days before a free trial converts, remind the member at 9:00 that billing starts,
 * as promised on the paywall. Local only; the text contains no health information.
 */
export async function scheduleTrialReminder(trialDays: number): Promise<void> {
  if (!isNative || trialDays < 3) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  let granted = (await LocalNotifications.checkPermissions()).display === 'granted';
  if (!granted) granted = (await LocalNotifications.requestPermissions()).display === 'granted';
  if (!granted) return;
  const at = new Date();
  at.setDate(at.getDate() + trialDays - 2);
  at.setHours(HOUR, 0, 0, 0);
  await LocalNotifications.schedule({
    notifications: [{ id: TRIAL_ID, title: 'Ondessa', body: 'Your free trial ends in 2 days. Manage or cancel any time in your store account.', schedule: { at, allowWhileIdle: true } }],
  });
}

/** Quick replies on the period check-in. Labels stay neutral so the lock screen reveals nothing. */
export type ReminderAction = 'started' | 'spotting' | 'not-yet' | 'open';
let actionsRegistered = false;

async function registerActions(): Promise<void> {
  if (actionsRegistered) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.registerActionTypes({
    types: [{
      id: 'period-check',
      actions: [
        { id: 'started', title: 'Yes, today' },
        { id: 'spotting', title: 'Spotting' },
        { id: 'not-yet', title: 'Not yet' },
      ],
    }],
  });
  actionsRegistered = true;
}

/** Listen for taps on reminder notifications and their quick replies. Native only. */
export function onReminderAction(cb: (a: ReminderAction) => void): () => void {
  if (!isNative) return () => {};
  let remove: (() => void) | undefined;
  let cancelled = false;
  void import('@capacitor/local-notifications').then(async ({ LocalNotifications }) => {
    const h = await LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
      const kind = (e.notification.extra as { kind?: string } | undefined)?.kind;
      if (kind !== 'period-check') return;
      const id = e.actionId;
      cb(id === 'started' || id === 'spotting' || id === 'not-yet' ? id : 'open');
    });
    if (cancelled) void h.remove();
    else remove = () => void h.remove();
  }).catch(() => {});
  return () => {
    cancelled = true;
    remove?.();
  };
}
