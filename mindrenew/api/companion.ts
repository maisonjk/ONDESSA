import Anthropic from '@anthropic-ai/sdk';
import { detectCrisis } from '../src/lib/matcher.js';
import { weekKey } from '../src/lib/dates.js';
import { LIMITS } from '../src/lib/entitlements.js';
import { json, error, env } from './_lib/http.js';
import { getAdmin, userFromRequest, isPremium } from './_lib/supabase-admin.js';
import {
  SYSTEM_PROMPT, OUTPUT_SCHEMA, CRISIS_RESULT, cleanInput, shapeModelOutput, libraryAnswer, costUsd, cacheKey,
  type ModelOutput,
} from './_lib/companion-core.js';

/**
 * POST /api/companion  { thought, followUpAnswer? }
 *
 * Cost controls, in order: crisis short-circuit (no call), server-side weekly limit,
 * response cache by input hash, short frozen + cached system prompt, no conversation history,
 * low effort, and graceful fallback to the free library match.
 */

const MODEL = env('COMPANION_MODEL') ?? 'claude-opus-5-5';
const localUsage = new Map<string, number>(); // local mode only (no Supabase): per-IP, per-week

export async function POST(req: Request): Promise<Response> {
  let body: { thought?: unknown; followUpAnswer?: unknown };
  try {
    body = await req.json();
  } catch {
    return error(400, 'bad_json', 'Invalid request.');
  }
  const thought = cleanInput(body.thought);
  const followUp = cleanInput(body.followUpAnswer);
  if (thought.length < 3) return error(400, 'too_short', 'Tell me a little more about what’s on your mind.');

  // 1. Safety first. Never spend a model call deciding whether to show crisis resources.
  if (detectCrisis(`${thought} ${followUp}`)) return json({ ...CRISIS_RESULT, remaining: null });

  // 2. Identity and limits (enforced here, never trusted from the client).
  const admin = getAdmin();
  const week = weekKey();
  let userId: string | null = null;
  let limit: number = LIMITS.free.companionPerWeek;
  let used = 0;
  if (admin) {
    const user = await userFromRequest(req);
    if (!user) return error(401, 'auth_required', 'Create a free account to use Truth Companion.');
    userId = user.id;
    if (await isPremium(user.id)) limit = LIMITS.premium.companionPerWeek;
    const { count } = await admin.from('ai_usage').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('week', week);
    used = count ?? 0;
  } else {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
    userId = `local:${ip}`;
    used = localUsage.get(`${userId}:${week}`) ?? 0;
  }
  if (used >= limit) return error(429, 'limit_reached', `You’ve used all ${limit} Truth Companion conversations this week.`);

  const record = async (row: { cached: boolean; input_tokens?: number; output_tokens?: number; cost_usd?: number; source: string }) => {
    used += 1;
    if (admin && userId) await admin.from('ai_usage').insert({ user_id: userId, week, model: MODEL, ...row });
    else localUsage.set(`${userId}:${week}`, used);
  };

  // 3. Cache: identical input returns the stored answer at zero model cost.
  const key = await cacheKey(thought, followUp);
  if (admin) {
    const { data } = await admin.from('ai_cache').select('response').eq('key', key).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (data?.response) {
      await record({ cached: true, source: 'cache' });
      return json({ ...data.response, remaining: Math.max(0, limit - used) });
    }
  }

  // 4. No API key configured: answer from the curated library so the feature still works.
  if (!env('ANTHROPIC_API_KEY')) {
    await record({ cached: false, source: 'library' });
    return json({ ...libraryAnswer(thought), remaining: Math.max(0, limit - used) });
  }

  // 5. One short, stateless model call.
  const client = new Anthropic();
  const userText = followUp ? `Thought: ${thought}\nThey answered your follow-up question: ${followUp}` : `Thought: ${thought}`;
  const supportsFallback = /^claude-(opus|sonnet|fable)/.test(MODEL);
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      ...(supportsFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral', ttl: '1h' } }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      messages: [{ role: 'user', content: userText }],
    });

    const cost = costUsd(MODEL, response.usage);
    const text = response.stop_reason === 'refusal' ? '' : response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    let shaped = null;
    try {
      shaped = text ? shapeModelOutput(JSON.parse(text) as ModelOutput) : null;
    } catch { /* invalid JSON falls through to library */ }

    await record({ cached: false, input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens, cost_usd: cost, source: shaped ? 'ai' : 'library' });
    const result = shaped ?? libraryAnswer(thought);
    if (admin && shaped && shaped.kind === 'answer') {
      await admin.from('ai_cache').upsert({ key, response: result, expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString() });
    }
    return json({ ...result, remaining: Math.max(0, limit - used) });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) console.warn('[companion] rate limited');
    else if (e instanceof Anthropic.APIError) console.error('[companion] API error', e.status, e.message);
    else console.error('[companion]', e);
    // Don't charge the user's quota for our failure; answer from the library.
    return json({ ...libraryAnswer(thought), remaining: Math.max(0, limit - used) });
  }
}
