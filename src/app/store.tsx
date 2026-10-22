import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  findPatterns, forecast, localToday, sanitizeLog,
  type AppData, type DayLog, type Forecast, type Insight, type ISODate,
} from '../engine';
import { WrongPassphraseError } from '../data/crypto';
import {
  activatePreviewPass, clearEntitlement, currentEntitlement, type Entitlement,
} from '../data/entitlement';
import { eraseEverything, loadPlain, readStored, save, unlock, type Stored } from '../data/vault';
import { tourData } from './tour';
import { useToast } from '../ui/components';

export type Phase = 'loading' | 'new' | 'locked' | 'ready' | 'unavailable';

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
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('Store missing');
  return s;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [today, setToday] = useState(localToday);
  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<AppData>();
  const [tour, setTour] = useState(false);
  const [stored, setStored] = useState<Stored>();
  const [entitlement, setEntitlement] = useState<Entitlement>({ status: 'none' });
  const [selectedDate, selectDate] = useState(today);
  const [storageError, setStorageError] = useState<string>();
  const passcode = useRef<string | undefined>(undefined);
  const saveTimer = useRef<number | undefined>(undefined);
  const realData = useRef<AppData | undefined>(undefined);
  const [notice, notify] = useToast();

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
          e instanceof Error && /unreadable|version|Invalid/.test(e.message)
            ? 'Your saved data could not be read. It may be from a newer version or damaged.'
            : 'This browser is not letting Ondessa store data on this device (private browsing can do this).',
        );
        setPhase('unavailable');
      }
    })();
  }, [refreshEntitlement]);

  const persist = useCallback(
    (next: AppData) => {
      if (tour) return;
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        save(next, passcode.current).catch(() =>
          setStorageError('Your last change could not be saved on this device. Export a backup to be safe.'),
        );
      }, 250);
    },
    [tour],
  );

  const update = useCallback(
    (fn: (d: AppData) => AppData) => {
      setData((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const setLog = useCallback(
    (log: DayLog) =>
      update((d) => {
        const clean = sanitizeLog(log);
        const logs = { ...d.logs };
        const { date, ...rest } = clean;
        if (Object.keys(rest).length === 0) delete logs[date];
        else logs[date] = clean;
        return { ...d, logs };
      }),
    [update],
  );

  const begin = useCallback(async (d: AppData, code?: string) => {
    passcode.current = code;
    await save(d, code);
    setStored(await readStored());
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      void navigator.storage.persist();
    }
    setData(d);
    setPhase('ready');
  }, []);

  const unlockWith = useCallback(
    async (code: string) => {
      if (!stored || stored.mode !== 'locked') return false;
      try {
        const d = await unlock(stored, code);
        passcode.current = code;
        setData(d);
        setPhase('ready');
        return true;
      } catch (e) {
        if (e instanceof WrongPassphraseError) return false;
        throw e;
      }
    },
    [stored],
  );

  const setPasscode = useCallback(
    async (code: string | undefined) => {
      passcode.current = code;
      if (data) {
        await save(data, code);
        setStored(await readStored());
      }
    },
    [data],
  );

  const replaceData = useCallback(async (d: AppData) => {
    await save(d, passcode.current);
    setData(d);
    setPhase('ready');
  }, []);

  const startTour = useCallback(() => {
    realData.current = data;
    setTour(true);
    setData(tourData(today));
  }, [data, today]);

  const exitTour = useCallback(() => {
    setTour(false);
    setData(realData.current);
    realData.current = undefined;
  }, []);

  const eraseAll = useCallback(async () => {
    window.clearTimeout(saveTimer.current);
    passcode.current = undefined;
    clearEntitlement();
    const ok = await eraseEverything();
    setData(undefined);
    setStored(undefined);
    setEntitlement({ status: 'none' });
    setPhase('new');
    return ok;
  }, []);

  const usePreviewPass = useCallback(() => setEntitlement(activatePreviewPass()), []);

  const fc = useMemo(() => (data ? forecast(data, today) : undefined), [data, today]);
  const insights = useMemo(() => (fc && data ? findPatterns(fc, data.logs) : []), [fc, data]);

  const value: Store = {
    phase, today, tour, data, forecast: fc, insights, entitlement,
    locked: !!passcode.current || stored?.mode === 'locked',
    selectedDate, selectDate, update, setLog, begin, unlockWith, setPasscode, replaceData,
    startTour, exitTour, refreshEntitlement, usePreviewPass, eraseAll, storageError, notice, notify,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
