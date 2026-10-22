import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Privacy disclosures must match the code. These checks fail the build if anyone adds
 * a network call, tracker or logging of state to application code. The only planned
 * network surface is entitlement refresh, which must be added to ALLOWED_NETWORK with an
 * ADR and a privacy-copy update in the same change.
 */
const ALLOWED_NETWORK = new Set<string>([]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) && !/\.test\.ts$/.test(f) ? [p] : [];
  });
}

const src = files(join(__dirname)).map((p) => ({ p, text: readFileSync(p, 'utf8') }));

describe('privacy guarantees in code', () => {
  it('makes no network requests outside the allow-list', () => {
    const network = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|new WebSocket|EventSource\(/;
    const offenders = src.filter((f) => network.test(f.text) && !ALLOWED_NETWORK.has(f.p));
    expect(offenders.map((f) => f.p)).toEqual([]);
  });

  it('contains no analytics, ads or third-party SDKs', () => {
    const trackers = /google-analytics|gtag\(|googletagmanager|segment\.(io|com)|mixpanel|amplitude|facebook\.net|fbq\(|hotjar|sentry|datadog|firebase|appsflyer|adjust\.com|branch\.io/i;
    expect(src.filter((f) => trackers.test(f.text)).map((f) => f.p)).toEqual([]);
  });

  it('never logs to the console', () => {
    expect(src.filter((f) => /console\.(log|info|debug|warn|error)/.test(f.text)).map((f) => f.p)).toEqual([]);
  });

  it('keeps health data out of URLs', () => {
    // Routes carry screen names only; dates and log state live in memory.
    const router = src.find((f) => f.p.endsWith('router.tsx'))!;
    expect(router.text).not.toMatch(/searchParams|URLSearchParams|\?date=/);
  });
});
