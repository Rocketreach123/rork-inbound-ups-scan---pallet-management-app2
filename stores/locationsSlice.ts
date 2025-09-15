import { useEffect, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { fetchAllProgressive } from '@/api/acaClient';
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
  const inFlight = useRef<boolean>(false);

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
    poller.current = setInterval(() => refresh(), 120000);
  };

  const stopPolling = () => {
    if (poller.current) clearInterval(poller.current as any);
    poller.current = null;
  };

  const refresh = async (manual = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      if (manual) setManualRefreshing(true);
      setError(undefined);
      let collectedRaw: any[] = [];
      let collected: Location[] = [];
      await fetchAllProgressive('/locations', {
        manualRefresh: manual,
        limitQuery: 'limit=200',
        onBatch: (batch) => {
          collectedRaw = collectedRaw.concat(batch);
          const mapped = mapLocations(batch);
          collected = collected.concat(mapped);
          setLocations([...collected]);
        },
      });

      const rawStrings = new Set<string>();
      for (const it of collectedRaw) {
        for (const v of Object.values(it ?? {})) {
          if (typeof v === 'string') rawStrings.add(v);
        }
      }
      const dummyPattern = /^LOC-/i;
      const hasDummy = collected.some((l) => {
        const candidates: string[] = [l.name, l.code ?? ''].filter(Boolean) as string[];
        return candidates.some((s) => dummyPattern.test(s) && !rawStrings.has(s));
      });
      if (hasDummy) {
        throw new Error('Dummy data detected');
      }

      setLastSync(Date.now());
      await storage.setItem(CACHE_KEY, JSON.stringify(collected));
    } catch (e: any) {
      setError(e?.message || 'Failed to sync locations');
    } finally {
      inFlight.current = false;
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
