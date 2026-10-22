import { addDays, diffDays, formatShort, type ISODate } from './dates';
import type { Forecast } from './predict';
import type { AppData } from './types';

export interface Reminder {
  id: string;
  date: ISODate;
  /** Shown inside the app, where the user has already unlocked it. */
  title: string;
  /** Used for system notifications. Never contains health words when discreet is on. */
  notification: string;
}

const DISCREET = 'You have a gentle check-in from Ondessa.';

export function upcomingReminders(data: AppData, f: Forecast, today: ISODate, horizonDays = 45): Reminder[] {
  const r = data.settings.reminders;
  const out: Reminder[] = [];
  const say = (plain: string) => (r.discreet ? DISCREET : plain);

  if (!data.pregnancy) {
    if (r.periodHeadsUp && f.nextPeriod) {
      const date = addDays(f.nextPeriod.earliest, -r.periodHeadsUpDays);
      out.push({
        id: 'period-heads-up',
        date,
        title: `Your period may start from ${formatShort(f.nextPeriod.earliest)}`,
        notification: say('Your period may start in the next few days.'),
      });
    }
    if (r.fertileWindow && f.fertile && data.settings.showFertility) {
      out.push({
        id: 'fertile-window',
        date: f.fertile.start,
        title: 'Your estimated fertile window begins',
        notification: say('Your estimated fertile window begins today.'),
      });
    }
    if (r.pregnancyTestDate) {
      out.push({
        id: 'pregnancy-test',
        date: r.pregnancyTestDate,
        title: 'The pregnancy test date you chose',
        notification: say('This is the test date you set.'),
      });
    }
  }
  for (const a of data.appointments) {
    out.push({
      id: `appt-${a.id}`,
      date: a.date,
      title: a.title,
      notification: r.discreet ? 'You have an appointment today.' : `Today: ${a.title}`,
    });
  }
  if (r.dailyLog) {
    out.push({ id: 'daily-log', date: today, title: 'Daily check-in', notification: DISCREET });
  }

  return out
    .filter((x) => diffDays(today, x.date) >= 0 && diffDays(today, x.date) <= horizonDays)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
