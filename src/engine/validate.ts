import { isISODate, type ISODate } from './dates';
import {
  MOODS, SYMPTOMS, defaultSettings,
  type AppData, type Appointment, type DayLog, type Pregnancy, type Settings,
} from './types';

/**
 * Strict validation for anything that enters storage from outside the UI (imports,
 * restored backups, older schema versions). Unknown fields are dropped, not kept.
 */
export class ValidationError extends Error {}

const FLOWS = ['spotting', 'unspecified', 'light', 'medium', 'heavy'] as const;
const MUCUS = ['dry', 'sticky', 'creamy', 'watery', 'eggwhite'] as const;
const MAX_NOTE = 2000;
const MAX_TITLE = 120;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const oneOf = <T extends string>(v: unknown, opts: readonly T[]): T | undefined =>
  typeof v === 'string' && (opts as readonly string[]).includes(v) ? (v as T) : undefined;
const intIn = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : undefined;
const str = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.trim().length > 0 ? v.slice(0, max) : undefined;

export function sanitizeLog(raw: unknown): DayLog {
  if (!isObj(raw) || !isISODate(raw.date)) throw new ValidationError('Invalid day log');
  const log: DayLog = { date: raw.date };
  const flow = oneOf(raw.flow, FLOWS);
  if (flow) log.flow = flow;
  if (Array.isArray(raw.symptoms)) {
    const s = [...new Set(raw.symptoms.filter((x) => oneOf(x, SYMPTOMS)))] as DayLog['symptoms'];
    if (s && s.length) log.symptoms = s;
  }
  const mood = oneOf(raw.mood, MOODS);
  if (mood) log.mood = mood;
  const energy = intIn(raw.energy, 1, 5);
  if (energy) log.energy = energy as DayLog['energy'];
  const sleep = intIn(raw.sleep, 1, 5);
  if (sleep) log.sleep = sleep as DayLog['sleep'];
  const pain = intIn(raw.pain, 0, 3);
  if (pain !== undefined) log.pain = pain as DayLog['pain'];
  const mucus = oneOf(raw.mucus, MUCUS);
  if (mucus) log.mucus = mucus;
  if (typeof raw.bbt === 'number' && raw.bbt >= 34 && raw.bbt <= 40) log.bbt = Math.round(raw.bbt * 100) / 100;
  const lh = oneOf(raw.lh, ['negative', 'positive'] as const);
  if (lh) log.lh = lh;
  if (raw.intercourse === true) log.intercourse = true;
  const note = str(raw.note, MAX_NOTE);
  if (note) log.note = note;
  return log;
}

function sanitizeSettings(raw: unknown): Settings {
  const d = defaultSettings();
  if (!isObj(raw)) return d;
  const cycle = isObj(raw.cycle) ? raw.cycle : {};
  const rem = isObj(raw.reminders) ? raw.reminders : {};
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  return {
    goal: oneOf(raw.goal, ['understand', 'conceive', 'pregnant', 'perimenopause'] as const) ?? d.goal,
    cycle: {
      typicalCycleLength: intIn(cycle.typicalCycleLength, 15, 90) ?? d.cycle.typicalCycleLength,
      typicalPeriodLength: intIn(cycle.typicalPeriodLength, 1, 15) ?? d.cycle.typicalPeriodLength,
    },
    showFertility: bool(raw.showFertility, d.showFertility),
    fertilitySigns: bool(raw.fertilitySigns, d.fertilitySigns),
    intercourseLogging: bool(raw.intercourseLogging, d.intercourseLogging),
    temperatureUnit: oneOf(raw.temperatureUnit, ['C', 'F'] as const) ?? d.temperatureUnit,
    weekStartsOn: raw.weekStartsOn === 0 ? 0 : 1,
    reminders: {
      periodHeadsUp: bool(rem.periodHeadsUp, d.reminders.periodHeadsUp),
      periodHeadsUpDays: intIn(rem.periodHeadsUpDays, 1, 7) ?? d.reminders.periodHeadsUpDays,
      fertileWindow: bool(rem.fertileWindow, d.reminders.fertileWindow),
      dailyLog: bool(rem.dailyLog, d.reminders.dailyLog),
      pregnancyTestDate: isISODate(rem.pregnancyTestDate) ? rem.pregnancyTestDate : undefined,
      discreet: bool(rem.discreet, d.reminders.discreet),
    },
  };
}

function sanitizePregnancy(raw: unknown): Pregnancy | undefined {
  if (!isObj(raw) || !isISODate(raw.startedOn)) return undefined;
  const p: Pregnancy = { startedOn: raw.startedOn };
  if (isISODate(raw.lmp)) p.lmp = raw.lmp;
  if (isISODate(raw.clinicianDueDate)) p.clinicianDueDate = raw.clinicianDueDate;
  return p.lmp || p.clinicianDueDate ? p : undefined;
}

function sanitizeAppointment(raw: unknown): Appointment | undefined {
  if (!isObj(raw) || !isISODate(raw.date)) return undefined;
  const title = str(raw.title, MAX_TITLE);
  const id = str(raw.id, 64);
  if (!title || !id) return undefined;
  const a: Appointment = { id, date: raw.date, title };
  const note = str(raw.note, MAX_NOTE);
  if (note) a.note = note;
  return a;
}

/**
 * Strict by default (imports). With `lenient`, used when loading the user's own stored data,
 * a damaged individual entry is dropped instead of locking the user out of everything.
 */
export function sanitizeData(raw: unknown, opts: { lenient?: boolean } = {}): AppData {
  if (!isObj(raw)) throw new ValidationError('Not an Ondessa data file');
  if (raw.schemaVersion !== 1) throw new ValidationError('Unsupported data version');
  if (!isISODate(raw.createdOn)) throw new ValidationError('Missing creation date');
  if (!isObj(raw.logs)) throw new ValidationError('Missing logs');

  const logs: Record<ISODate, DayLog> = {};
  for (const [key, value] of Object.entries(raw.logs)) {
    try {
      const log = sanitizeLog(value);
      if (log.date !== key) throw new ValidationError('Log key does not match its date');
      logs[key] = log;
    } catch (e) {
      if (!opts.lenient) throw e;
    }
  }
  const data: AppData = {
    schemaVersion: 1,
    createdOn: raw.createdOn,
    settings: sanitizeSettings(raw.settings),
    logs,
    pastPregnancies: Array.isArray(raw.pastPregnancies)
      ? raw.pastPregnancies.map(sanitizePregnancy).filter((p): p is Pregnancy => !!p)
      : [],
    appointments: Array.isArray(raw.appointments)
      ? raw.appointments.map(sanitizeAppointment).filter((a): a is Appointment => !!a)
      : [],
  };
  if (isISODate(raw.lastBackupOn)) data.lastBackupOn = raw.lastBackupOn;
  const pregnancy = sanitizePregnancy(raw.pregnancy);
  if (pregnancy) data.pregnancy = pregnancy;
  if (!data.settings.intercourseLogging) {
    for (const l of Object.values(logs)) delete l.intercourse;
  }
  return data;
}
