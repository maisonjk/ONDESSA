import type { Reminder } from '../engine';
import { isNative } from './index';

/**
 * Native local notifications, scheduled on the device. Nothing is sent to a server and
 * the notification text is the reminder engine's discreet-aware wording.
 * Reminders fire at 9:00 local time on their date.
 */
const MAX_SCHEDULED = 20;
const HOUR = 9;

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
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });

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
  await LocalNotifications.schedule({
    notifications: items.map(({ r, i, at }) => ({
      id: i + 1,
      title: 'Ondessa',
      body: r.notification,
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
