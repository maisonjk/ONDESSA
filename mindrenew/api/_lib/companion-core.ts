import { VERSES, VERSE_BY_ID, TRANSLATION } from '../../src/content/scripture.js';
import { LIE_BY_ID } from '../../src/content/lies.js';
import { bestMatch, detectCrisis } from '../../src/lib/matcher.js';
import type { CompanionResult, CompanionVerse } from '../../src/lib/api.js';

/**
 * Truth Companion core. Pure and testable; the HTTP handler wires it to Claude and Supabase.
 *
 * Anti-fabrication design: the model only ever returns verse IDS from our curated catalog.
 * Verse text is rendered from the database, so a quotation can't be invented. Unknown IDs are
 * dropped, and if nothing valid remains we fall back to the deterministic library match.
 */

export const SYSTEM_PROMPT = `You are Truth Companion inside MindRenew, a Christian app that helps people notice beliefs that don't line up with Scripture and replace them with biblical truth (Romans 12:2, 2 Corinthians 10:5, John 8:32).

The user describes a thought, struggle, or situation. Respond with JSON matching the schema.

How to respond:
- "lie": the underlying belief they may be holding, as a short first-person sentence (e.g. "I have to earn God's love."). Offer it tentatively; you are helping them notice, not diagnosing.
- "root": one sentence on what might be feeding it (a fear, experience, or pattern). Compassionate, never accusatory.
- "verse_ids": 1 or 2 ids from the CATALOG below that most directly answer the belief. Use only ids that appear in the catalog, copied exactly. Never write verse text yourself; the app displays the text.
- "explanation": 2-3 sentences on the passage's original context and how it speaks to this belief. This is your reflection, not Scripture, so do not put words in quotation marks as if quoting the Bible.
- "truth": a first-person truth statement grounded in the chosen passage (e.g. "God's grace is enough for me today.").
- "action": one small, concrete thing they can do today.
- "needs_follow_up": true only if the message is too vague to respond to meaningfully (for example a single word). Then put one gentle question in "follow_up_question" and still fill the other fields with your best reading.
- "crisis": true if they mention self-harm, suicide, abuse, or being in danger.

Boundaries:
- Speak warmly and plainly, like a wise, humble friend. 120 words or fewer across all fields.
- Never claim to be God, speak for God, or offer new revelation. Say "Scripture says", not "God is telling you".
- Don't attribute every negative thought to Satan or to sin. Many come from pain, fatigue, or circumstances.
- You are not a therapist or doctor. If they describe ongoing depression, trauma, or abuse, gently encourage talking with a pastor, counselor, or doctor in the action.
- Stay within historic, mainstream Christian teaching. Avoid denominational disputes.

CATALOG (id | reference | themes), ${TRANSLATION}:
${VERSES.map((v) => `${v.id} | ${v.ref} | ${v.tags.join(', ')}`).join('\n')}`;

export const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['needs_follow_up', 'follow_up_question', 'lie', 'root', 'verse_ids', 'explanation', 'truth', 'action', 'crisis'],
  properties: {
    needs_follow_up: { type: 'boolean' },
    follow_up_question: { type: 'string' },
    lie: { type: 'string' },
    root: { type: 'string' },
    verse_ids: { type: 'array', items: { type: 'string' } },
    explanation: { type: 'string' },
    truth: { type: 'string' },
    action: { type: 'string' },
    crisis: { type: 'boolean' },
  },
} as const;

export interface ModelOutput {
  needs_follow_up: boolean;
  follow_up_question: string;
  lie: string;
  root: string;
  verse_ids: string[];
  explanation: string;
  truth: string;
  action: string;
  crisis: boolean;
}

export const MAX_THOUGHT_CHARS = 800;

export function cleanInput(s: unknown): string {
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, MAX_THOUGHT_CHARS) : '';
}

export function toVerse(id: string): CompanionVerse | null {
  const v = VERSE_BY_ID[id];
  return v ? { id: v.id, ref: v.ref, text: v.text, context: v.context } : null;
}

export const CRISIS_RESULT: Omit<CompanionResult, 'remaining'> = {
  kind: 'crisis',
  lie: '',
  root: '',
  followUp: null,
  verses: [toVerse('ps-34-18')!],
  explanation: 'What you’re carrying matters, and you deserve real support right now. Please reach out to someone who can be with you.',
  truth: 'I am not alone, and it is right to ask for help.',
  action: 'In the US, call or text 988 (Suicide & Crisis Lifeline) now. Outside the US, contact your local emergency number. If you’re in immediate danger, call 911.',
  source: 'library',
};

/** Validate and shape model output. Returns null if it can't be trusted, so the caller falls back. */
export function shapeModelOutput(out: ModelOutput): Omit<CompanionResult, 'remaining'> | null {
  if (out.crisis) return CRISIS_RESULT;
  const verses = [...new Set(out.verse_ids)].map(toVerse).filter((v): v is CompanionVerse => !!v).slice(0, 2);
  if (!verses.length || !out.truth.trim()) return null;
  return {
    kind: out.needs_follow_up && out.follow_up_question.trim() ? 'followup' : 'answer',
    lie: out.lie.trim(),
    root: out.root.trim(),
    followUp: out.needs_follow_up ? out.follow_up_question.trim() || null : null,
    verses,
    explanation: out.explanation.trim(),
    truth: out.truth.trim(),
    action: out.action.trim(),
    source: 'ai',
  };
}

/** Zero-cost answer from the curated library. Used when AI is unavailable or output is invalid. */
export function libraryAnswer(thought: string): Omit<CompanionResult, 'remaining'> {
  if (detectCrisis(thought)) return CRISIS_RESULT;
  const lie = bestMatch(thought) ?? LIE_BY_ID['id-not-enough'];
  return {
    kind: 'answer',
    lie: lie.text,
    root: 'This is one of the most common thought patterns people bring to MindRenew.',
    followUp: null,
    verses: [lie.verseId, lie.alsoVerseIds[0]].map((id) => toVerse(id)).filter((v): v is CompanionVerse => !!v),
    explanation: lie.reframe,
    truth: lie.truth,
    action: lie.action,
    source: 'library',
  };
}

/** USD per million tokens [input, output]. Keep in sync with Anthropic pricing. */
const PRICES: Record<string, [number, number]> = {
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
};

export function costUsd(model: string, usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): number {
  const [inP, outP] = PRICES[model] ?? PRICES['claude-opus-5-5'];
  const cached = usage.cache_read_input_tokens ?? 0;
  const written = usage.cache_creation_input_tokens ?? 0;
  const cost = (usage.input_tokens * inP + cached * inP * 0.1 + written * inP * 1.25 + usage.output_tokens * outP) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export async function cacheKey(thought: string, followUp: string): Promise<string> {
  const data = new TextEncoder().encode(`${thought.toLowerCase()}||${followUp.toLowerCase()}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
