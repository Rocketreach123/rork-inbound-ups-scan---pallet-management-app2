import { ParsedLabelPayload } from '@/types/warehouse';

export type TrainingScanResponse = {
  success?: boolean;
  lookup?: Record<string, unknown>;
  confidence?: number;
  [key: string]: unknown;
} | null;

const DEFAULT_TIMEOUT_MS = 6000;

function getApiBase(): string | null {
  const base = (process.env.EXPO_PUBLIC_API_BASE ?? '').trim();
  if (!base) return null;
  try {
    const url = new URL(base);
    return url.toString().replace(/\/$/, '');
  } catch (_e) {
    console.log('[training api] Invalid EXPO_PUBLIC_API_BASE, skipping network');
    return null;
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: NodeJS.Timeout | number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Request timed out')), ms) as unknown as number;
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeoutId !== undefined) clearTimeout(timeoutId as number);
    return result as T;
  } catch (e) {
    if (timeoutId !== undefined) clearTimeout(timeoutId as number);
    throw e;
  }
}

export async function postTrainingScan(payload: ParsedLabelPayload): Promise<TrainingScanResponse> {
  const base = getApiBase();
  if (!base) return null;
  const url = `${base}/api/v1/training/scan`;
  try {
    console.log('[training api] POST', url, payload);
    const res = await withTimeout(
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      DEFAULT_TIMEOUT_MS,
    );
    if (!res.ok) {
      console.log('[training api] scan non-200', res.status);
      return null;
    }
    const data = (await res.json()) as TrainingScanResponse;
    console.log('[training api] scan response', data);
    return data ?? null;
  } catch (e) {
    console.log('[training api] scan error', e);
    return null;
  }
}

export async function postTrainingVerify(sampleId: string, corrected: Record<string, unknown>): Promise<boolean> {
  const base = getApiBase();
  if (!base) return false;
  const url = `${base}/api/v1/training/verify`;
  try {
    console.log('[training api] POST', url, { sampleId, corrected });
    const res = await withTimeout(
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sampleId, data: corrected }),
      }),
      DEFAULT_TIMEOUT_MS,
    );
    if (!res.ok) {
      console.log('[training api] verify non-200', res.status);
      return false;
    }
    const data = (await res.json()) as { success?: boolean };
    console.log('[training api] verify response', data);
    return Boolean(data?.success ?? true);
  } catch (e) {
    console.log('[training api] verify error', e);
    return false;
  }
}
