/**
 * Calendar-date arithmetic.
 *
 * Every health date in Ondessa is a calendar date ("YYYY-MM-DD"), never a timestamp.
 * Arithmetic happens on integer day numbers computed with Date.UTC, so daylight-saving
 * transitions and the device time zone can never shift a date by one.
 */

export type ISODate = string; // "YYYY-MM-DD"

const MS_PER_DAY = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string') return false;
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** Days since 1970-01-01 for a calendar date. */
export function toDayNumber(date: ISODate): number {
  const m = ISO_RE.exec(date);
  if (!m) throw new RangeError('Invalid calendar date');
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_PER_DAY);
}

export function fromDayNumber(day: number): ISODate {
  const d = new Date(day * MS_PER_DAY);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** b − a in whole days. */
export function diffDays(a: ISODate, b: ISODate): number {
  return toDayNumber(b) - toDayNumber(a);
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0; // ISO strings sort lexically
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

export function isBetween(date: ISODate, start: ISODate, end: ISODate): boolean {
  return date >= start && date <= end;
}

/** The user's local calendar date. The only place device time enters the engine. */
export function localToday(now: Date = new Date()): ISODate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 0 = Sunday. */
export function weekday(date: ISODate): number {
  return new Date(toDayNumber(date) * MS_PER_DAY).getUTCDay();
}

export function monthGrid(year: number, month1: number, weekStartsOn: 0 | 1 = 1): ISODate[] {
  const first = `${year}-${String(month1).padStart(2, '0')}-01`;
  const lead = (weekday(first) - weekStartsOn + 7) % 7;
  const start = addDays(first, -lead);
  const total = Math.ceil((lead + daysInMonth(year, month1)) / 7) * 7;
  return Array.from({ length: total }, (_, i) => addDays(start, i));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatShort(date: ISODate): string {
  const [, m, d] = date.split('-');
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

export function formatLong(date: ISODate): string {
  const [y, m, d] = date.split('-');
  return `${MONTHS_LONG[Number(m) - 1]} ${Number(d)}, ${y}`;
}

export function formatRange(start: ISODate, end: ISODate): string {
  if (start === end) return formatShort(start);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return sameMonth
    ? `${formatShort(start)}–${Number(end.slice(8))}`
    : `${formatShort(start)} – ${formatShort(end)}`;
}

export function monthName(month1: number): string {
  return MONTHS_LONG[month1 - 1] ?? '';
}
