import { addDays, diffDays, formatShort, type ISODate } from './dates';
import { PHASE_COPY, phaseOn, upcomingFertileWindow, type Forecast } from './predict';

/**
 * Partner updates. Ondessa has no server, so sharing is a message the user sends herself
 * (share sheet, text, email) and an optional calendar file. Only the items she switches on
 * are included, and nothing is sent anywhere by Ondessa.
 */
export interface PartnerShareOptions {
  countdown: boolean;
  phase: boolean;
  fertile: boolean;
}

export function partnerLines(f: Forecast, today: ISODate, o: PartnerShareOptions, showFertility: boolean): string[] {
  const lines: string[] = [];
  if (o.countdown && f.lastPeriod) {
    if (f.inPeriod) lines.push(`Period: day ${f.cycleDay}.`);
    else if (f.daysPastExpected > 0) lines.push('Period: a little later than expected.');
    else if (f.nextPeriod) {
      const n = diffDays(today, f.nextPeriod.expected);
      lines.push(
        n <= 0
          ? `Period may start any day now (window ${formatShort(f.nextPeriod.earliest)} to ${formatShort(f.nextPeriod.latest)}).`
          : `Period expected in about ${n} day${n === 1 ? '' : 's'} (most likely ${formatShort(f.nextPeriod.expected)}).`,
      );
    }
  }
  if (o.phase) {
    const p = phaseOn(f, today, showFertility);
    if (p) lines.push(`Current phase: ${PHASE_COPY[p].short.toLowerCase()}${p === 'menstrual' ? '' : ' (estimate)'}.`);
  }
  if (o.fertile && showFertility) {
    const w = upcomingFertileWindow(f);
    if (w) lines.push(`Estimated fertile window: ${formatShort(w.start)} to ${formatShort(w.end)}. Not a guarantee, and not contraception.`);
  }
  return lines;
}

export function partnerMessage(f: Forecast, today: ISODate, o: PartnerShareOptions, showFertility: boolean): string {
  const lines = partnerLines(f, today, o, showFertility);
  if (!lines.length) return '';
  return [`A quick heads-up from me (${formatShort(today)}):`, ...lines, 'Shared from Ondessa, a private cycle tracker. Estimates only.'].join('\n');
}

/**
 * iCalendar file with the predicted period windows ahead, as all-day events. With discreet
 * titles the events read only "Ondessa", so a shared or synced calendar reveals nothing.
 */
export function predictedPeriodsIcs(f: Forecast, today: ISODate, discreet: boolean): string {
  const windows = [f.nextPeriod, ...f.laterPeriods].filter((w): w is NonNullable<typeof w> => !!w && w.latest >= today).slice(0, 6);
  const day = (d: ISODate) => d.replace(/-/g, '');
  const stamp = `${day(today)}T000000Z`;
  const events = windows.map((w) => [
    'BEGIN:VEVENT',
    `UID:${day(w.expected)}-period@ondessa.local`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${day(w.earliest)}`,
    `DTEND;VALUE=DATE:${day(addDays(w.latest, 1))}`,
    `SUMMARY:${discreet ? 'Ondessa' : 'Period expected (estimate)'}`,
    `DESCRIPTION:${discreet ? 'Reminder from Ondessa.' : `Most likely ${formatShort(w.expected)}. An estimate from Ondessa.`}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ].join('\r\n'));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ondessa//Predicted periods//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR', ''].join('\r\n');
}
