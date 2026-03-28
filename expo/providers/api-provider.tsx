import React, { useCallback, useEffect, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

interface ApiConfig {
  baseUrl: string | null;
  apiKey: string | null;
}

interface ApiProviderValue {
  config: ApiConfig;
  isEnabled: boolean;
  isLoading: boolean;
  lastError?: string;
  setConfig: (updates: Partial<ApiConfig>) => Promise<void>;
  clearConfig: () => Promise<void>;
  testConnection: () => Promise<{ ok: boolean; message?: string }>; 
  get: <T = any>(path: string, params?: Record<string, unknown>) => Promise<T>;
  post: <T = any>(path: string, body?: unknown) => Promise<T>;
}

const WEB_STORE_KEY = 'api_cfg_v1';

async function webStorageGet(): Promise<ApiConfig | null> {
  try {
    if (Platform.OS === 'web') {
      const raw = window.localStorage.getItem(WEB_STORE_KEY);
      return raw ? (JSON.parse(raw) as ApiConfig) : null;
    }
  } catch (e) {
    console.warn('webStorageGet error', e);
  }
  return null;
}

async function webStorageSet(cfg: ApiConfig): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(WEB_STORE_KEY, JSON.stringify(cfg));
    }
  } catch (e) {
    console.warn('webStorageSet error', e);
  }
}

async function webStorageDelete(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      window.localStorage.removeItem(WEB_STORE_KEY);
    }
  } catch (e) {
    console.warn('webStorageDelete error', e);
  }
}

export const [ApiProvider, useApi] = createContextHook<ApiProviderValue>(() => {
  const [config, setConfigState] = useState<ApiConfig>({ baseUrl: null, apiKey: null });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastError, setLastError] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'web') {
          const cfg = await webStorageGet();
          if (cfg) setConfigState(cfg);
        } else {
          const [baseUrl, apiKey] = await Promise.all([
            SecureStore.getItemAsync('api_base_url'),
            SecureStore.getItemAsync('api_key'),
          ]);
          setConfigState({ baseUrl: baseUrl ?? null, apiKey: apiKey ?? null });
        }
      } catch (e) {
        console.error('Failed to load API config', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (next: ApiConfig) => {
    try {
      if (Platform.OS === 'web') {
        await webStorageSet(next);
      } else {
        await SecureStore.setItemAsync('api_base_url', next.baseUrl ?? '');
        await SecureStore.setItemAsync('api_key', next.apiKey ?? '');
      }
    } catch (e) {
      console.error('Persist API config failed', e);
    }
  }, []);

  const setConfig = useCallback(async (updates: Partial<ApiConfig>) => {
    const next: ApiConfig = { ...config, ...updates };
    setConfigState(next);
    await persist(next);
  }, [config, persist]);

  const clearConfig = useCallback(async () => {
    setConfigState({ baseUrl: null, apiKey: null });
    try {
      if (Platform.OS === 'web') {
        await webStorageDelete();
      } else {
        await Promise.all([
          SecureStore.deleteItemAsync('api_base_url'),
          SecureStore.deleteItemAsync('api_key'),
        ]);
      }
    } catch (e) {
      console.error('Clear API config failed', e);
    }
  }, []);

  const isEnabled = useMemo(() => !!config.baseUrl && config.baseUrl.trim().length > 0, [config.baseUrl]);

  const buildUrl = useCallback((path: string, params?: Record<string, unknown>) => {
    const base = (config.baseUrl ?? '').replace(/\/$/, '');
    const p = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${base}${p}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        url.searchParams.set(k, String(v));
      });
    }
    return url.toString();
  }, [config.baseUrl]);

  const headers = useCallback((): HeadersInit => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiKey) h['Authorization'] = `Bearer ${config.apiKey}`;
    return h;
  }, [config.apiKey]);

  const safeFetch = useCallback(async <T,>(input: string, init?: RequestInit): Promise<T> => {
    setLastError(undefined);
    try {
      const res = await fetch(input, init);
      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) {
        const errMsg = (json && (json.message || json.error)) ? (json.message || json.error) : `HTTP ${res.status}`;
        setLastError(errMsg);
        throw new Error(errMsg);
      }
      return json as T;
    } catch (e: any) {
      console.error('API request failed', e);
      setLastError(e?.message ?? 'Network error');
      throw e;
    }
  }, []);

  const get = useCallback(async <T,>(path: string, params?: Record<string, unknown>): Promise<T> => {
    if (!isEnabled) throw new Error('API not configured');
    const url = buildUrl(path, params);
    return safeFetch<T>(url, { method: 'GET', headers: headers() });
  }, [isEnabled, buildUrl, headers, safeFetch]);

  const post = useCallback(async <T,>(path: string, body?: unknown): Promise<T> => {
    if (!isEnabled) throw new Error('API not configured');
    const url = buildUrl(path);
    return safeFetch<T>(url, { method: 'POST', headers: headers(), body: body ? JSON.stringify(body) : undefined });
  }, [isEnabled, buildUrl, headers, safeFetch]);

  const testConnection = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    if (!isEnabled) return { ok: false, message: 'API not configured' };
    try {
      // Expect backend to have /healthz or /api/health; attempt both
      try {
        const r1 = await get<{ status: string }>('healthz');
        return { ok: true, message: r1?.status ?? 'ok' };
      } catch {
        const r2 = await get<{ status: string }>('api/health');
        return { ok: true, message: r2?.status ?? 'ok' };
      }
    } catch (e: any) {
      return { ok: false, message: e?.message ?? 'Connection failed' };
    }
  }, [get, isEnabled]);

  return {
    config,
    isEnabled,
    isLoading,
    lastError,
    setConfig,
    clearConfig,
    testConnection,
    get,
    post,
  };
});
