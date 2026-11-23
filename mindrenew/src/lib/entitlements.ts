import type { AppState, Plan } from './types.js';
import { isoDate } from './dates.js';

/** Free tier is genuinely useful: daily renewal, daily Scripture, a real library, basic progress. */
export const LIMITS = {
  free: { renewalsPerDay: 1, savedTruths: 15, companionPerWeek: 3, journeys: false, advancedInsights: false },
  premium: { renewalsPerDay: Infinity, savedTruths: Infinity, companionPerWeek: 60, journeys: true, advancedInsights: true },
} as const;

export const PRICING = {
  monthly: { price: 7.99, label: '$7.99', per: 'month' },
  annual: { price: 59.99, label: '$59.99', per: 'year', monthlyEquivalent: '$5.00', savings: '37%' },
} as const;

export function limitsFor(plan: Plan) {
  return LIMITS[plan];
}

export function renewalsToday(state: AppState, today = isoDate()): number {
  return state.renewals.filter((r) => r.date === today).length;
}

export function canStartRenewal(state: AppState, today = isoDate()): boolean {
  return renewalsToday(state, today) < limitsFor(state.plan).renewalsPerDay;
}

export function canSaveTruth(state: AppState): boolean {
  return state.truths.length < limitsFor(state.plan).savedTruths;
}
