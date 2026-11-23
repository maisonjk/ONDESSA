import { LIES, type CategoryId, type Lie } from '../content/lies.js';

/**
 * Deterministic "lie detector lite": maps free text to the closest known thought pattern
 * using keyword overlap. Runs on-device, costs nothing, and is the fallback when AI is off.
 */
export interface Match {
  lie: Lie;
  score: number;
}

function normalize(s: string): string {
  return ` ${s.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

const STOP = new Set(['i', 'me', 'my', 'the', 'a', 'an', 'to', 'and', 'is', 'am', 'of', 'it', 'that', 'be', 'in', 'will', 'have', 'this', 'what']);

export function matchThought(text: string, preferCategory?: CategoryId): Match[] {
  const t = normalize(text);
  if (t.trim().length < 2) return [];
  const words = new Set(t.trim().split(' ').filter((w) => w.length > 2 && !STOP.has(w)));
  const results: Match[] = [];
  for (const lie of LIES) {
    let score = 0;
    for (const kw of lie.keywords) {
      const k = normalize(kw);
      const phrase = k.trim().includes(' ');
      // Phrases match whole; single words match as a stem ("worry" hits "worrying").
      if (phrase ? t.includes(k) : t.includes(k.trimEnd())) score += phrase ? 3 : 2;
    }
    for (const w of normalize(lie.text).trim().split(' ')) {
      if (w.length > 3 && words.has(w)) score += 1;
    }
    if (preferCategory && lie.categories.includes(preferCategory)) score += 1.5;
    if (score > 0) results.push({ lie, score });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 3);
}

export function bestMatch(text: string, preferCategory?: CategoryId): Lie | null {
  const [top] = matchThought(text, preferCategory);
  if (top && top.score >= 2) return top.lie;
  if (preferCategory && preferCategory !== 'other') {
    return LIES.find((l) => l.categories[0] === preferCategory) ?? null;
  }
  return top?.lie ?? null;
}

/**
 * Safety: if someone signals self-harm or crisis, the app stops and points to real help
 * before anything else. Deliberately broad. A false positive costs a moment; a miss can cost a life.
 */
const CRISIS = [
  'kill myself', 'suicide', 'suicidal', 'end my life', 'end it all', 'want to die', 'better off dead',
  'better off without me', 'hurt myself', 'self harm', 'self-harm', 'cutting myself', 'no reason to live',
  'don\'t want to be alive', 'dont want to be alive', 'don\'t want to live', 'take my life', 'overdose',
];

export function detectCrisis(text: string): boolean {
  const t = normalize(text).replace(/-/g, ' ');
  return CRISIS.some((c) => t.includes(normalize(c)));
}
