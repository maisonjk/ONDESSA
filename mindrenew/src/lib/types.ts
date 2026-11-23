import type { CategoryId } from '../content/lies.js';

export type Plan = 'free' | 'premium';

export interface ReminderPrefs {
  enabled: boolean;
  /** 24h "HH:MM" local time. */
  time: string;
  frequency: 'daily' | 'weekdays';
  truthResurfacing: boolean;
  weeklySummary: boolean;
}

export interface Profile {
  name: string;
  goals: CategoryId[];
  patterns: CategoryId[];
  minutes: 3 | 5 | 10;
  reminder: ReminderPrefs;
  onboardedAt: string | null;
}

export interface Renewal {
  id: string;
  /** Local calendar date YYYY-MM-DD. */
  date: string;
  createdAt: string;
  category: CategoryId;
  lieId: string | null;
  lieText: string;
  verseId: string;
  reflection: string;
  action: string;
  journeyId?: string;
}

export interface SavedTruth {
  id: string;
  category: CategoryId;
  lieText: string;
  truth: string;
  verseId: string;
  reflection: string;
  savedAt: string;
  favorite: boolean;
  source: 'renewal' | 'companion' | 'daily';
}

/** In-progress renewal so users can pick up where they left off. */
export interface Draft {
  step: number;
  category: CategoryId | null;
  lieId: string | null;
  customLie: string;
  reflection: string;
  journeyId?: string;
  updatedAt: string;
}

export interface AppState {
  version: 1;
  userId: string | null;
  email: string | null;
  plan: Plan;
  profile: Profile;
  renewals: Renewal[];
  truths: SavedTruth[];
  draft: Draft | null;
  journeys: Record<string, number>;
  /** Local mirror of server-side companion usage, for display only. Server enforces. */
  companion: { week: string; used: number };
}
