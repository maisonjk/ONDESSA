import type { AppData } from '../engine';
import type { KeyInfo } from './crypto';

type Write = (data: AppData, key?: KeyInfo) => Promise<void>;

/**
 * Serialises every save. Writes run one at a time and always write the newest state, so a
 * slow encrypted save can never land after (and overwrite) a newer one. `close()` waits for
 * an in-flight write before anything destructive (like deleting all data) runs.
 */
export class Persister {
  private latest?: AppData;
  private dirty = false;
  private closed = false;
  private timer?: ReturnType<typeof setTimeout>;
  private chain: Promise<void> = Promise.resolve();
  key?: KeyInfo;

  constructor(
    private readonly write: Write,
    private readonly onError: (e: unknown) => void = () => {},
    private readonly delayMs = 250,
  ) {}

  /** Queue a save of `data` after a short debounce. */
  schedule(data: AppData): void {
    if (this.closed) return;
    this.latest = data;
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.delayMs);
  }

  /** Write any pending change now. Resolves once the queue is idle. */
  flush(): Promise<void> {
    clearTimeout(this.timer);
    this.chain = this.chain.then(async () => {
      if (!this.dirty || this.closed || !this.latest) return;
      this.dirty = false;
      const data = this.latest;
      try {
        await this.write(data, this.key);
      } catch (e) {
        this.dirty = true;
        this.onError(e);
      }
    });
    return this.chain;
  }

  /**
   * Save `data` immediately (setup, restore, passcode change).
   * `key`: a KeyInfo encrypts with that key, `null` stores unencrypted, omitted keeps the current key.
   */
  async saveNow(data: AppData, key?: KeyInfo | null): Promise<void> {
    if (this.closed) throw new Error('Storage is closed');
    if (key !== undefined) this.key = key ?? undefined;
    this.latest = data;
    this.dirty = true;
    await this.flush();
  }

  /** Stop accepting writes and wait for any write already running. */
  async close(): Promise<void> {
    this.closed = true;
    clearTimeout(this.timer);
    await this.chain;
  }

  /** Accept writes again with a clean slate (after deletion or locking). */
  reset(key?: KeyInfo): void {
    this.closed = false;
    this.dirty = false;
    this.latest = undefined;
    this.key = key;
  }
}
