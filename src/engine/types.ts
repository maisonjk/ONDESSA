import type { ISODate } from './dates';

/** 'unspecified' = bleeding without an intensity (e.g. a start date entered during setup). */
export type Flow = 'spotting' | 'unspecified' | 'light' | 'medium' | 'heavy';
export type Mucus = 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggwhite';
export type LhResult = 'negative' | 'positive';
export type Level = 1 | 2 | 3 | 4 | 5;

export const SYMPTOMS = [
  'cramps', 'headache', 'bloating', 'breast tenderness', 'acne', 'back pain',
  'nausea', 'fatigue', 'cravings', 'hot flush', 'night sweats', 'insomnia',
] as const;
export type Symptom = (typeof SYMPTOMS)[number];

export const MOODS = ['calm', 'happy', 'irritable', 'anxious', 'low', 'sensitive'] as const;
export type Mood = (typeof MOODS)[number];

/** One calendar day of optional observations. Every field except date is optional. */
export interface DayLog {
  date: ISODate;
  flow?: Flow;
  symptoms?: Symptom[];
  mood?: Mood;
  energy?: Level;
  sleep?: Level;
  pain?: 0 | 1 | 2 | 3;
  mucus?: Mucus;
  /** Basal body temperature in °C, stored at 2 decimals. */
  bbt?: number;
  lh?: LhResult;
  /** Only stored when settings.intercourseLogging is enabled. */
  intercourse?: boolean;
  note?: string;
}

export type Goal = 'understand' | 'conceive' | 'pregnant' | 'perimenopause';

export interface CycleSettings {
  /** User-provided typical cycle length; used until history exists. */
  typicalCycleLength: number;
  typicalPeriodLength: number;
}

export interface Pregnancy {
  /** Last menstrual period start used to date the pregnancy. */
  lmp?: ISODate;
  /** Clinician-provided estimated due date; always wins over LMP-based dating. */
  clinicianDueDate?: ISODate;
  startedOn: ISODate;
}

export interface Appointment {
  id: string;
  date: ISODate;
  title: string;
  note?: string;
}

export interface ReminderSettings {
  periodHeadsUp: boolean;
  periodHeadsUpDays: number;
  fertileWindow: boolean;
  dailyLog: boolean;
  pregnancyTestDate?: ISODate;
  /** Discreet wording replaces any health words in notification text. */
  discreet: boolean;
}

export interface Settings {
  goal: Goal;
  cycle: CycleSettings;
  showFertility: boolean;
  fertilitySigns: boolean; // mucus, BBT, LH fields
  intercourseLogging: boolean;
  temperatureUnit: 'C' | 'F';
  weekStartsOn: 0 | 1;
  reminders: ReminderSettings;
}

export interface AppData {
  schemaVersion: 1;
  createdOn: ISODate;
  settings: Settings;
  /** Keyed by ISO date. */
  logs: Record<ISODate, DayLog>;
  pregnancy?: Pregnancy;
  /** Kept after pregnancy mode ends so history is not lost. */
  pastPregnancies: Pregnancy[];
  appointments: Appointment[];
  /** Date of the last backup the user exported, for gentle backup reminders. */
  lastBackupOn?: ISODate;
}

export function defaultSettings(): Settings {
  return {
    goal: 'understand',
    cycle: { typicalCycleLength: 28, typicalPeriodLength: 5 },
    showFertility: true,
    fertilitySigns: false,
    intercourseLogging: false,
    temperatureUnit: 'C',
    weekStartsOn: 1,
    reminders: {
      periodHeadsUp: true,
      periodHeadsUpDays: 2,
      fertileWindow: false,
      dailyLog: false,
      discreet: true,
    },
  };
}

export function emptyData(today: ISODate): AppData {
  return {
    schemaVersion: 1,
    createdOn: today,
    settings: defaultSettings(),
    logs: {},
    pastPregnancies: [],
    appointments: [],
  };
}
