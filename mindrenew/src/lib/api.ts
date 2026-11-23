import { authHeader } from './supabase.js';

export interface CompanionVerse {
  id: string;
  ref: string;
  text: string;
  context: string;
}

export interface CompanionResult {
  kind: 'answer' | 'followup' | 'crisis';
  /** The belief the user may be holding, phrased in first person. */
  lie: string;
  root: string;
  followUp: string | null;
  verses: CompanionVerse[];
  explanation: string;
  truth: string;
  action: string;
  source: 'ai' | 'library';
  remaining: number | null;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.code ?? 'error', data.message ?? 'Something went wrong.');
  return data as T;
}

export function askCompanion(thought: string, followUpAnswer?: string, deviceId?: string) {
  return post<CompanionResult>('/api/companion', { thought, followUpAnswer, deviceId });
}

export function startCheckout(interval: 'monthly' | 'annual') {
  return post<{ url: string }>('/api/checkout', { interval });
}

export function openBillingPortal() {
  return post<{ url: string }>('/api/portal', {});
}
