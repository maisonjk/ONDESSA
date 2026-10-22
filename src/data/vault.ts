import { sanitizeData, type AppData } from '../engine';
import { decryptJSON, encryptJSON, isEnvelope, type Envelope } from './crypto';

/**
 * Local-first storage. All health data lives in one IndexedDB record on this device,
 * either as plain JSON or, when app lock is on, as an AES-GCM envelope. Nothing here
 * talks to the network.
 */
const DB_NAME = 'ondessa';
const STORE = 'vault';
const KEY = 'data';

export type Stored =
  | { mode: 'plain'; data: unknown }
  | { mode: 'locked'; envelope: Envelope };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

export async function readStored(): Promise<Stored | undefined> {
  const raw = (await tx('readonly', (s) => s.get(KEY))) as Stored | undefined;
  if (!raw) return undefined;
  if (raw.mode === 'locked' && isEnvelope(raw.envelope)) return raw;
  if (raw.mode === 'plain') return raw;
  throw new Error('Stored data is unreadable');
}

export async function loadPlain(stored: Stored & { mode: 'plain' }): Promise<AppData> {
  return sanitizeData(stored.data);
}

export async function unlock(stored: Stored & { mode: 'locked' }, passcode: string): Promise<AppData> {
  return sanitizeData(await decryptJSON(stored.envelope, passcode));
}

export async function save(data: AppData, passcode?: string): Promise<void> {
  const value: Stored = passcode
    ? { mode: 'locked', envelope: await encryptJSON(data, passcode) }
    : { mode: 'plain', data };
  await tx('readwrite', (s) => s.put(value, KEY));
}

function deleteDatabase(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

/**
 * Permanently removes the database and every local key Ondessa writes, then re-opens
 * the database to verify nothing remains. Returns true only if verification passes.
 */
export async function eraseEverything(): Promise<boolean> {
  await deleteDatabase();
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('ondessa.')) localStorage.removeItem(k);
    sessionStorage.clear();
  } catch {
    /* storage may be unavailable; nothing to clear */
  }
  if (typeof caches !== 'undefined') {
    for (const name of await caches.keys()) await caches.delete(name);
  }
  const empty = (await readStored()) === undefined;
  await deleteDatabase(); // the check re-creates an empty database; remove it too
  return empty;
}
