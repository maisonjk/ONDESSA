import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { forecast } from '../engine';
import { startsFromLengths, withPeriods, addLog } from '../engine/testkit';
import { readBackup, makeBackup, BackupNeedsPassword } from './backup';
import { decryptJSON, deriveKeyInfo, encryptJSON, WrongPassphraseError } from './crypto';
import { Persister } from './persister';
import { b64urlEncode, verifyToken } from './entitlement';
import { eraseEverything, loadPlain, readStored, save, unlock } from './vault';

const FAST = 100_000; // fewer KDF rounds keep tests quick; production uses KDF_ITERATIONS

const sample = () =>
  addLog(withPeriods(startsFromLengths('2026-01-01', [28, 30, 27])), {
    date: '2026-03-20', symptoms: ['headache'], note: 'Private note ✨', mood: 'calm',
  });

describe('encryption', () => {
  it('round-trips and rejects a wrong passphrase', async () => {
    const env = await encryptJSON({ secret: 'ovulation' }, 'correct horse', FAST);
    expect(JSON.stringify(env)).not.toMatch(/secret|ovulation/);
    expect(await decryptJSON(env, 'correct horse')).toEqual({ secret: 'ovulation' });
    await expect(decryptJSON(env, 'wrong')).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it('uses a fresh salt and IV every time', async () => {
    const a = await encryptJSON({ x: 1 }, 'p', FAST);
    const b = await encryptJSON({ x: 1 }, 'p', FAST);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
  });
});

describe('local vault', () => {
  beforeEach(async () => {
    await eraseEverything();
  });

  it('saves and loads plain data', async () => {
    await save(sample());
    const stored = await readStored();
    expect(stored?.mode).toBe('plain');
    const data = await loadPlain(stored as never);
    expect(forecast(data, '2026-04-01').cycles).toHaveLength(3);
  });

  it('stores nothing readable when locked', async () => {
    await save(sample(), await deriveKeyInfo('2468', undefined, FAST));
    const stored = await readStored();
    expect(stored?.mode).toBe('locked');
    expect(JSON.stringify(stored)).not.toMatch(/headache|Private note|2026-03/);
    const { data } = await unlock(stored as never, '2468');
    expect(data.logs['2026-03-20']?.note).toBe('Private note ✨');
    await expect(unlock(stored as never, '1357')).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it('permanently deletes and verifies deletion', async () => {
    await save(sample());
    expect(await readStored()).toBeDefined();
    expect(await eraseEverything()).toBe(true);
    expect(await readStored()).toBeUndefined();
  });
});

describe('export and import', () => {
  it('round-trips a plain export exactly', async () => {
    const data = sample();
    const restored = await readBackup(await makeBackup(data, '2026-10-22'));
    expect(restored).toEqual(data);
  });

  it('round-trips an encrypted export and requires its password', async () => {
    const data = sample();
    const text = await makeBackup(data, '2026-10-22', 'backup pass');
    expect(text).not.toMatch(/headache/);
    await expect(readBackup(text)).rejects.toBeInstanceOf(BackupNeedsPassword);
    expect(await readBackup(text, 'backup pass')).toEqual(data);
  });

  it('rejects files that are not Ondessa backups', async () => {
    await expect(readBackup('not json')).rejects.toThrow(/not an Ondessa backup/);
    await expect(readBackup('{"app":"other"}')).rejects.toThrow(/not an Ondessa backup/);
  });

  it('drops unknown fields and invalid values on import', async () => {
    const data = sample() as unknown as Record<string, unknown>;
    const logs = data.logs as Record<string, Record<string, unknown>>;
    logs['2026-03-20']!.tracker = 'https://evil.example';
    logs['2026-03-20']!.energy = 99;
    (data as Record<string, unknown>).extra = { x: 1 };
    const restored = await readBackup(JSON.stringify({ app: 'ondessa', kind: 'plain', payload: data }));
    expect(restored.logs['2026-03-20']).not.toHaveProperty('tracker');
    expect(restored.logs['2026-03-20']).not.toHaveProperty('energy');
    expect(restored).not.toHaveProperty('extra');
  });

  it('rejects mismatched or impossible dates', async () => {
    const bad = { schemaVersion: 1, createdOn: '2026-01-01', logs: { '2026-02-30': { date: '2026-02-30' } } };
    await expect(readBackup(JSON.stringify({ app: 'ondessa', kind: 'plain', payload: bad }))).rejects.toThrow();
  });

  it('drops intercourse entries when that logging is off', async () => {
    const data = addLog(sample(), { date: '2026-03-21', intercourse: true });
    const restored = await readBackup(await makeBackup(data, '2026-10-22'));
    expect(restored.logs['2026-03-21']?.intercourse).toBeUndefined();
  });

  it('preserves pregnancy mode across export and import', async () => {
    const data = { ...sample(), pregnancy: { startedOn: '2026-05-01', lmp: '2026-03-26' } };
    const restored = await readBackup(await makeBackup(data, '2026-10-22'));
    expect(restored.pregnancy).toEqual({ startedOn: '2026-05-01', lmp: '2026-03-26' });
  });
});

describe('entitlement tokens', () => {
  async function issuer() {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    const sign = async (payload: object) => {
      const body = new TextEncoder().encode(JSON.stringify(payload));
      const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, body);
      return `${b64urlEncode(body)}.${b64urlEncode(new Uint8Array(sig))}`;
    };
    return { jwk, sign };
  }
  const now = 1_790_000_000;

  it('accepts a valid token and exposes no personal data', async () => {
    const { jwk, sign } = await issuer();
    const token = await sign({ v: 1, eid: 'e_8f2a', plan: 'annual', iat: now - 10, exp: now + 86400 });
    expect(await verifyToken(token, jwk, now)).toEqual({ status: 'active', plan: 'annual', expires: now + 86400, eid: 'e_8f2a' });
  });

  it('honours a short renewal grace period, then expires', async () => {
    const { jwk, sign } = await issuer();
    const token = await sign({ v: 1, eid: 'e1', plan: 'monthly', iat: now - 1e6, exp: now - 3600 });
    expect((await verifyToken(token, jwk, now)).status).toBe('active');
    expect((await verifyToken(token, jwk, now + 4 * 86400)).status).toBe('expired');
  });

  it('rejects tampered tokens and foreign keys', async () => {
    const a = await issuer();
    const b = await issuer();
    const token = await a.sign({ v: 1, eid: 'e1', plan: 'monthly', iat: now, exp: now + 100 });
    const forged = b64urlEncode(new TextEncoder().encode(JSON.stringify({ v: 1, eid: 'e1', plan: 'annual', iat: now, exp: now + 1e9 })));
    expect((await verifyToken(`${forged}.${token.split('.')[1]}`, a.jwk, now)).status).toBe('invalid');
    expect((await verifyToken(token, b.jwk, now)).status).toBe('invalid');
    expect((await verifyToken('garbage', a.jwk, now)).status).toBe('invalid');
  });
});

describe('save queue', () => {
  beforeEach(async () => {
    await eraseEverything();
  });

  it('writes saves in order and keeps only the newest state', async () => {
    const writes: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const p = new Persister(async (d) => {
      if (writes.length === 0) await gate; // first write is slow
      writes.push(d.createdOn);
    }, () => {}, 0);
    p.schedule({ ...sample(), createdOn: '2026-01-01' });
    const first = p.flush();
    await new Promise((r) => setTimeout(r, 0)); // the slow first write is now in flight
    p.schedule({ ...sample(), createdOn: '2026-01-02' });
    p.schedule({ ...sample(), createdOn: '2026-01-03' });
    const second = p.flush();
    release();
    await Promise.all([first, second]);
    expect(writes).toEqual(['2026-01-01', '2026-01-03']);
  });

  it('never resurrects data after a delete that waits on close()', async () => {
    const key = await deriveKeyInfo('2468', undefined, FAST);
    const p = new Persister((d, k) => save(d, k), () => {}, 0);
    p.key = key;
    p.schedule(sample());
    const inFlight = p.flush();
    await p.close();
    await inFlight;
    expect(await eraseEverything()).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(await readStored()).toBeUndefined();
    p.schedule(sample());
    await p.flush();
    expect(await readStored()).toBeUndefined();
  });

  it('retries after a failed write', async () => {
    let fail = true;
    const errors: unknown[] = [];
    const saved: string[] = [];
    const p = new Persister(async (d) => {
      if (fail) throw new Error('quota');
      saved.push(d.createdOn);
    }, (e) => errors.push(e), 0);
    p.schedule(sample());
    await p.flush();
    expect(errors).toHaveLength(1);
    fail = false;
    await p.flush();
    expect(saved).toHaveLength(1);
  });

  it('loads stored data leniently, dropping only a damaged entry', async () => {
    const data = sample() as unknown as { logs: Record<string, unknown> };
    data.logs['2026-03-21'] = { date: 'not-a-date' };
    await save(data as never);
    const loaded = await loadPlain((await readStored()) as never);
    expect(loaded.logs['2026-03-21']).toBeUndefined();
    expect(loaded.logs['2026-03-20']?.note).toBe('Private note ✨');
  });
});
