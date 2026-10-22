import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  findPatterns, forecast, localToday, sanitizeLog, upcomingReminders, ValidationError,
  type AppData, type DayLog, type Forecast, type Goal, type Insight, type ISODate,
} from '../engine';
import { deriveKeyInfo, WrongPassphraseError } from '../data/crypto';
import {
  activatePreviewPass, clearEntitlement, currentEntitlement, type Entitlement,
} from '../data/entitlement';
import { Persister } from '../data/persister';
import { eraseEverything, loadPlain, readStored, reloadWithKey, save, unlock, type Stored } from '../data/vault';
import { tourData } from './tour';
import { tap } from '../platform';
import { disableBiometricUnlock } from '../platform/biometric';
import { syncReminders } from '../platform/notifications';
import { onStoreChange } from '../platform/purchases';
import { useToast } from '../ui/components';

export type Phase = 'loading' | 'new' | 'locked' | 'ready' | 'unavailable';

/** Lock again after the app has been in the background this long (passcode users only). */
const AUTO_LOCK_MS = 5 * 60_000;

interface Store {
  phase: Phase;
  today: ISODate;
  tour: boolean;
  data?: AppData;
  forecast?: Forecast;
  insights: Insight[];
  entitlement: Entitlement;
  locked: boolean;
  selectedDate: ISODate;
  selectDate(d: ISODate): void;
  update(fn: (d: AppData) => AppData): void;
  setLog(log: DayLog): void;
  begin(data: AppData, passcode?: string): Promise<void>;
  unlockWith(code: string): Promise<boolean>;
  setPasscode(code: string | undefined): Promise<void>;
  replaceData(data: AppData): Promise<void>;
  startTour(): void;
  exitTour(): void;
  refreshEntitlement(): Promise<void>;
  usePreviewPass(): void;
  eraseAll(): Promise<boolean>;
  storageError?: string;
  notice?: string;
  notify(msg: string): void;
  /** Goal chosen on the landing page, used to preselect setup. Memory only. */
  startIntent?: Goal;
  setStartIntent(g: Goal | undefined): void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('Store missing');
  return s;
}

class TourWriteError extends Error {
  constructor() {
    super('This is not available in the tour.');
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [today, setToday] = useState(localToday);
  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<AppData>();
  const [tour, setTour] = useState(false);
  const [stored, setStored] = useState<Stored>();
  const [entitlement, setEntitlement] = useState<Entitlement>({ status: 'loading' });
  const [selectedDate, selectDate] = useState(today);
  const [storageError, setStorageError] = useState<string>();
  const [notice, notify] = useToast();
  const [startIntent, setStartIntent] = useState<Goal>();
  const realData = useRef<AppData | undefined>(undefined);
  const tourRef = useRef(false);
  const channel = useRef<BroadcastChannel | undefined>(undefined);

  const persister = useMemo(
    () =>
      new Persister(
        async (d, key) => {
          await save(d, key);
          channel.current?.postMessage('saved');
        },
        () => setStorageError('Your last change could not be saved on this device. Export a backup to be safe.'),
      ),
    [],
  );

  // Keep "today" correct across midnight without reloading.
  useEffect(() => {
    const id = window.setInterval(() => setToday(localToday()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const refreshEntitlement = useCallback(async () => setEntitlement(await currentEntitlement()), []);

  useEffect(() => {
    void refreshEntitlement();
    (async () => {
      try {
        const s = await readStored();
        setStored(s);
        if (!s) setPhase('new');
        else if (s.mode === 'locked') setPhase('locked');
        else {
          setData(await loadPlain(s));
          setPhase('ready');
        }
      } catch (e) {
        setStorageError(
          e instanceof ValidationError || (e instanceof Error && /unreadable/.test(e.message))
            ? 'Your saved data could not be read. It may be from a newer version of Ondessa or damaged.'
            : 'Ondessa can’t open its storage on this device. Private browsing or low storage can cause this.',
        );
        setPhase('unavailable');
      }
    })();
  }, [refreshEntitlement]);

  // Save pending edits whenever the app is hidden or closed, and auto-lock after a while.
  const hiddenAt = useRef<number | undefined>(undefined);
  useEffect(() => {
    const onHide = () => {
      void persister.flush();
    };
    const onVisibility = async () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        void persister.flush();
        return;
      }
      const away = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
      hiddenAt.current = undefined;
      if (persister.key && !tourRef.current && away > AUTO_LOCK_MS) {
        await persister.close();
        persister.reset();
        setData(undefined);
        setStored(await readStored());
        setPhase('locked');
      }
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [persister]);

  // Two open tabs: when another tab saves, reload so this one never overwrites it.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('ondessa');
    channel.current = ch;
    ch.onmessage = async () => {
      if (tourRef.current) return;
      const s = await readStored().catch(() => undefined);
      if (!s) return;
      setStored(s);
      if (s.mode === 'plain') setData(await loadPlain(s));
      else if (persister.key) setData(await reloadWithKey(s, persister.key).catch(() => undefined));
    };
    return () => {
      ch.close();
      channel.current = undefined;
    };
  }, [persister]);

  const update = useCallback(
    (fn: (d: AppData) => AppData) => {
      setData((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        if (!tourRef.current) persister.schedule(next);
        return next;
      });
    },
    [persister],
  );

  const setLog = useCallback(
    (log: DayLog) => {
      tap();
      update((d) => {
        const clean = sanitizeLog(log);
        const logs = { ...d.logs };
        const { date, ...rest } = clean;
        if (Object.keys(rest).length === 0) delete logs[date];
        else logs[date] = clean;
        return { ...d, logs };
      });
    },
    [update],
  );

  const exitTour = useCallback(() => {
    if (!tourRef.current) return;
    tourRef.current = false;
    setTour(false);
    setData(realData.current);
    realData.current = undefined;
  }, []);

  const begin = useCallback(
    async (d: AppData, code?: string) => {
      if (tourRef.current) throw new TourWriteError();
      const key = code ? await deriveKeyInfo(code) : undefined;
      persister.reset(key);
      await persister.saveNow(d, key);
      setStored(await readStored());
      if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
        void navigator.storage.persist();
      }
      setData(d);
      setPhase('ready');
    },
    [persister],
  );

  const unlockWith = useCallback(
    async (code: string) => {
      if (!stored || stored.mode !== 'locked') return false;
      try {
        const { data: d, key } = await unlock(stored, code);
        persister.reset(key);
        setData(d);
        setPhase('ready');
        return true;
      } catch (e) {
        if (e instanceof WrongPassphraseError) return false;
        throw e;
      }
    },
    [stored, persister],
  );

  const setPasscode = useCallback(
    async (code: string | undefined) => {
      if (tourRef.current) throw new TourWriteError();
      if (!data) return;
      const key = code ? await deriveKeyInfo(code) : undefined;
      await persister.saveNow(data, key);
      await disableBiometricUnlock(); // quick unlock must be re-enabled for a new passcode
      setStored(await readStored());
    },
    [data, persister],
  );

  const replaceData = useCallback(
    async (d: AppData) => {
      if (tourRef.current) throw new TourWriteError();
      persister.reset(persister.key);
      await persister.saveNow(d);
      setData(d);
      setPhase('ready');
    },
    [persister],
  );

  const startTour = useCallback(() => {
    if (tourRef.current) return;
    void persister.flush();
    realData.current = data;
    tourRef.current = true;
    setTour(true);
    setData(tourData(today));
  }, [data, today, persister]);

  const eraseAll = useCallback(async () => {
    if (tourRef.current) throw new TourWriteError();
    await persister.close(); // wait for any in-flight save so nothing is written back
    clearEntitlement();
    await disableBiometricUnlock();
    const ok = await eraseEverything();
    persister.reset();
    setData(undefined);
    setStored(undefined);
    setEntitlement({ status: 'none' });
    setPhase('new');
    return ok;
  }, [persister]);

  const usePreviewPass = useCallback(() => setEntitlement(activatePreviewPass()), []);

  const fc = useMemo(() => (data ? forecast(data, today) : undefined), [data, today]);
  const insights = useMemo(() => (fc && data ? findPatterns(fc, data.logs) : []), [fc, data]);

  // Native apps: keep scheduled local notifications in step with the latest predictions.
  useEffect(() => {
    if (tour || !data || !fc) return;
    const t = window.setTimeout(() => void syncReminders(upcomingReminders(data, fc, today, 60), today).catch(() => {}), 1000);
    return () => window.clearTimeout(t);
  }, [data, fc, today, tour]);

  // App Store / Google Play purchases, renewals and refunds update access immediately.
  useEffect(() => onStoreChange(() => void refreshEntitlement()), [refreshEntitlement]);

  const value: Store = {
    phase, today, tour, data, forecast: fc, insights, entitlement,
    locked: stored?.mode === 'locked',
    selectedDate, selectDate, update, setLog, begin, unlockWith, setPasscode, replaceData,
    startTour, exitTour, refreshEntitlement, usePreviewPass, eraseAll, storageError, notice, notify, startIntent, setStartIntent,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
