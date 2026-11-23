import { describe, expect, it, beforeAll } from 'vitest';

// Local mode: no Supabase, no Anthropic key. Exercises the real handler end to end.
beforeAll(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.ANTHROPIC_API_KEY;
});

const call = async (body: unknown, ip = '1.1.1.1') => {
  const { POST } = await import('./companion');
  const res = await POST(new Request('http://x/api/companion', { method: 'POST', headers: { 'x-forwarded-for': ip, 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};

describe('POST /api/companion', () => {
  it('rejects empty input', async () => {
    expect((await call({ thought: 'a' })).status).toBe(400);
  });
  it('short-circuits crisis without counting against the limit', async () => {
    const r = await call({ thought: 'I want to end my life' }, '9.9.9.9');
    expect(r.body.kind).toBe('crisis');
    expect(r.body.action).toMatch(/988/);
  });
  it('answers from the library when no AI key is configured', async () => {
    const r = await call({ thought: 'I feel like I will never change' }, '2.2.2.2');
    expect(r.status).toBe(200);
    expect(r.body.source).toBe('library');
    expect(r.body.verses[0].text.length).toBeGreaterThan(10);
    expect(r.body.remaining).toBe(2);
  });
  it('enforces the free weekly limit server-side', async () => {
    for (let i = 0; i < 3; i++) expect((await call({ thought: `I am anxious ${i}` }, '3.3.3.3')).status).toBe(200);
    const blocked = await call({ thought: 'one more' }, '3.3.3.3');
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('limit_reached');
  });
});
