/**
 * Privacy-preserving entitlements (see docs/02-architecture.md, ADR-0003).
 *
 * The purchase server signs a short token containing only a random entitlement id, the
 * plan and an expiry. The app verifies the signature locally with an embedded public key,
 * so checking access never sends anything about the user's body, cycle or usage.
 * Token format: base64url(JSON payload) + "." + base64url(ECDSA P-256 SHA-256 signature).
 */

export type Plan = 'monthly' | 'annual';

export interface EntitlementPayload {
  v: 1;
  eid: string;
  plan: Plan;
  /** Unix seconds. */
  iat: number;
  exp: number;
}

export type Entitlement =
  | { status: 'active'; plan: Plan; expires: number; eid: string; preview?: false }
  | { status: 'active'; plan: 'preview'; expires: number; preview: true }
  | { status: 'loading' | 'expired' | 'none' | 'invalid' };

const STORAGE_KEY = 'ondessa.entitlement';
/** Renewals sync within this window; avoids locking someone out mid-renewal. */
const GRACE_SECONDS = 3 * 86_400;

function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function verifyToken(
  token: string,
  publicJwk: JsonWebKey,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<Entitlement> {
  const parts = token.trim().split('.');
  if (parts.length !== 2 || token.length > 2048) return { status: 'invalid' };
  try {
    const key = await crypto.subtle.importKey('jwk', publicJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
      'verify',
    ]);
    const body = b64urlDecode(parts[0]!);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64urlDecode(parts[1]!), body);
    if (!ok) return { status: 'invalid' };
    const p = JSON.parse(new TextDecoder().decode(body)) as EntitlementPayload;
    if (p.v !== 1 || (p.plan !== 'monthly' && p.plan !== 'annual') || typeof p.exp !== 'number' || typeof p.eid !== 'string') {
      return { status: 'invalid' };
    }
    // Allow a day of clock skew: phones with a slow clock must not lose access.
    if (p.iat > nowSeconds + 86_400) return { status: 'invalid' };
    if (p.exp + GRACE_SECONDS < nowSeconds) return { status: 'expired' };
    return { status: 'active', plan: p.plan, expires: p.exp, eid: p.eid };
  } catch {
    return { status: 'invalid' };
  }
}

function configuredPublicKey(): JsonWebKey | undefined {
  const raw = import.meta.env.VITE_ENTITLEMENT_PUBLIC_JWK as string | undefined;
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as JsonWebKey;
  } catch {
    return undefined;
  }
}

/** Preview passes exist only in development or explicitly-flagged preview builds. */
export const previewPassAvailable =
  import.meta.env.DEV || import.meta.env.VITE_PREVIEW_PASS === 'true';

export async function currentEntitlement(): Promise<Entitlement> {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { status: 'none' };
  }
  if (!stored) return { status: 'none' };
  if (stored.startsWith('preview:')) {
    const expires = Number(stored.slice(8));
    return previewPassAvailable && expires > Date.now() / 1000
      ? { status: 'active', plan: 'preview', expires, preview: true }
      : { status: 'expired' };
  }
  const key = configuredPublicKey();
  return key ? verifyToken(stored, key, trustedNow()) : { status: 'invalid' };
}

/**
 * Never let "now" go backwards: winding the device clock back must not revive an expired
 * membership. Stores only the latest time seen.
 */
function trustedNow(): number {
  const now = Math.floor(Date.now() / 1000);
  try {
    const seen = Number(localStorage.getItem('ondessa.seen') ?? 0);
    const t = Math.max(now, Number.isFinite(seen) ? seen : 0);
    localStorage.setItem('ondessa.seen', String(t));
    return t;
  } catch {
    return now;
  }
}

export async function activateToken(token: string): Promise<Entitlement> {
  const key = configuredPublicKey();
  if (!key) return { status: 'invalid' };
  const e = await verifyToken(token, key);
  if (e.status === 'active') localStorage.setItem(STORAGE_KEY, token.trim());
  return e;
}

export function activatePreviewPass(days = 14): Entitlement {
  if (!previewPassAvailable) return { status: 'invalid' };
  const expires = Math.floor(Date.now() / 1000) + days * 86_400;
  localStorage.setItem(STORAGE_KEY, `preview:${expires}`);
  return { status: 'active', plan: 'preview', expires, preview: true };
}

export function clearEntitlement(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
