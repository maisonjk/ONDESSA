/**
 * Passphrase encryption with Web Crypto only (no third-party crypto code).
 * PBKDF2-SHA256 → AES-256-GCM. Used for app-lock at rest and encrypted backups.
 */
export const KDF_ITERATIONS = 600_000; // OWASP 2023 guidance for PBKDF2-HMAC-SHA256

export interface Envelope {
  format: 'ondessa-aes-gcm';
  v: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export class WrongPassphraseError extends Error {
  constructor() {
    super('That passcode did not unlock this data.');
  }
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase.normalize('NFKC')), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJSON(
  value: unknown,
  passphrase: string,
  iterations = KDF_ITERATIONS,
): Promise<Envelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)));
  return {
    format: 'ondessa-aes-gcm',
    v: 1,
    kdf: 'PBKDF2-SHA256',
    iterations,
    salt: toB64(salt),
    iv: toB64(iv),
    ciphertext: toB64(new Uint8Array(ct)),
  };
}

export function isEnvelope(v: unknown): v is Envelope {
  const e = v as Envelope;
  return (
    typeof v === 'object' && v !== null &&
    e.format === 'ondessa-aes-gcm' && e.v === 1 &&
    typeof e.salt === 'string' && typeof e.iv === 'string' && typeof e.ciphertext === 'string' &&
    Number.isInteger(e.iterations) && e.iterations >= 100_000 && e.iterations <= 10_000_000
  );
}

export async function decryptJSON(envelope: Envelope, passphrase: string): Promise<unknown> {
  const key = await deriveKey(passphrase, fromB64(envelope.salt), envelope.iterations);
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(envelope.iv) }, key, fromB64(envelope.ciphertext));
    return JSON.parse(dec.decode(pt));
  } catch {
    throw new WrongPassphraseError();
  }
}
