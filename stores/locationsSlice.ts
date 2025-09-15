import { useEffect, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { getLocations } from '@/api/acaClient';
import { mapLocations, type Location } from '@/mappers/locationsMapper';
import { useStorage } from '@/providers/storage-provider';

export type SyncHealth = 'green' | 'yellow' | 'red';

const CACHE_KEY = 'aca-v1.locations';

export const [LocationsProvider, useLocations] = createContextHook(() => {
  const storage = useStorage();
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState<boolean>(false);
  const poller = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await storage.getItem(CACHE_KEY);
        if (raw) {
          const cached: Location[] = JSON.parse(raw);
          setLocations(cached);
        }
      } catch (e) {
        console.warn('[locations] cache load failed', e);
      } finally {
        setIsLoading(false);
      }
      refresh();
      startPolling();
    })();

    return () => stopPolling();
  }, []);

  const startPolling = () => {
    stopPolling();
    poller.current = setInterval(() => refresh(), 60000);
  };

  const stopPolling = () => {
    if (poller.current) clearInterval(poller.current as any);
    poller.current = null;
  };

  const refresh = async (manual = false) => {
    try {
      if (manual) setManualRefreshing(true);
      setError(undefined);
      const data = await getLocations({ manualRefresh: manual });
      const mapped = mapLocations(data);

      const rawStrings = new Set<string>();
      for (const it of data) {
        for (const v of Object.values(it ?? {})) {
          if (typeof v === 'string') rawStrings.add(v);
        }
      }
      const dummyPattern = /^LOC-/i;
      const hasDummy = mapped.some((l) => {
        const candidates: string[] = [l.name, l.code ?? ''].filter(Boolean) as string[];
        return candidates.some((s) => dummyPattern.test(s) && !rawStrings.has(s));
      });
      if (hasDummy) {
        throw new Error('Dummy data detected');
      }

      setLocations(mapped);
      setLastSync(Date.now());
      await storage.setItem(CACHE_KEY, JSON.stringify(mapped));
    } catch (e: any) {
      setError(e?.message || 'Failed to sync locations');
    } finally {
      setManualRefreshing(false);
    }
  };

  const health: SyncHealth = useMemo(() => {
    if (!lastSync) return 'red';
    const age = Date.now() - lastSync;
    if (age < 90000) return 'green';
    if (age < 180000) return 'yellow';
    return 'red';
  }, [lastSync]);

  return {
    locations,
    isLoading,
    error,
    lastSync,
    health,
    refresh,
    manualRefreshing,
  } as const;
});
