import { useEffect, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { getLicensePlates } from '@/api/acaClient';
import { mapPlates, type Plate } from '@/mappers/platesMapper';
import { useStorage } from '@/providers/storage-provider';
import { mapLocations, type Location } from '@/mappers/locationsMapper';
import { getLocations } from '@/api/acaClient';

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
      const data = await getLicensePlates({ manualRefresh: manual });
      const mapped = mapPlates(data, locationsIdx);
      setPlates(mapped);
      setLastSync(Date.now());
      await storage.setItem(CACHE_KEY, JSON.stringify(mapped));
    } catch (e: any) {
      setError(e?.message || 'Failed to sync license plates');
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
