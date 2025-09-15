import { useEffect, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { fetchAllProgressive, getLocations } from '@/api/acaClient';
import { mapPlates, type Plate } from '@/mappers/platesMapper';
import { useStorage } from '@/providers/storage-provider';
import { mapLocations, type Location } from '@/mappers/locationsMapper';

export type SyncHealth = 'green' | 'yellow' | 'red';

const CACHE_KEY = 'aca-v1.plates';

export const [PlatesProvider, usePlates] = createContextHook(() => {
  const storage = useStorage();
  const [plates, setPlates] = useState<Plate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState<boolean>(false);
  const poller = useRef<ReturnType<typeof setInterval> | null>(null);

  const [locationsIdx, setLocationsIdx] = useState<Map<string, string>>(new Map());
  const inFlight = useRef<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await storage.getItem(CACHE_KEY);
        if (raw) setPlates(JSON.parse(raw) as Plate[]);
      } catch (e) {
        console.warn('[plates] cache load failed', e);
      } finally {
        setIsLoading(false);
      }
      await refreshLocationsIndex();
      refresh();
      startPolling();
    })();
    return () => stopPolling();
  }, []);

  const refreshLocationsIndex = async () => {
    try {
      const locsRaw = await getLocations();
      const locs = mapLocations(locsRaw);
      const idx = new Map<string, string>();
      locs.forEach((l) => {
        if (l.name) idx.set(l.name, l.id);
      });
      setLocationsIdx(idx);
    } catch (e) {
      // ignore
    }
  };

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
      let collected: Plate[] = [];
      await fetchAllProgressive('/license-plates', {
        manualRefresh: manual,
        limitQuery: 'limit=200',
        onBatch: (batch) => {
          collectedRaw = collectedRaw.concat(batch);
          const mapped = mapPlates(batch, locationsIdx);
          collected = collected.concat(mapped);
          setPlates([...collected]);
        },
      });

      const rawStrings = new Set<string>();
      for (const it of collectedRaw) {
        for (const v of Object.values(it ?? {})) {
          if (typeof v === 'string') rawStrings.add(v);
        }
      }
      const dummyPattern = /^(LOC-|LP ?\d)/i;
      const hasDummy = collected.some((p) => {
        const candidates: string[] = [p.plate_number].filter(Boolean) as string[];
        return candidates.some((s) => dummyPattern.test(s) && !rawStrings.has(s));
      });
      if (hasDummy) {
        throw new Error('Dummy data detected');
      }

      setLastSync(Date.now());
      await storage.setItem(CACHE_KEY, JSON.stringify(collected));
    } catch (e: any) {
      setError(e?.message || 'Failed to sync license plates');
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
    plates,
    isLoading,
    error,
    lastSync,
    health,
    refresh,
    manualRefreshing,
    locationsIdx,
  } as const;
});
