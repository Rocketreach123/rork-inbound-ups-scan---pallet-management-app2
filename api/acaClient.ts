import { env } from '@/lib/env';

export type NormalizedError = {
  message: string;
  status?: number;
};

const mask = (v: string | undefined | null): string => {
  if (!v) return '';
  return v.replace(/.(?=.{4})/g, '*');
};

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

export type ACAItem = Record<string, any>;

type BatchResult = { items: ACAItem[]; next: string | null; etag?: string };

async function fetchBatch(url: string): Promise<BatchResult> {
  for (let i = 0; i < 3; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res: Response = await fetch(url, { method: 'GET', signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        const status: number = res.status;
        const text: string = await res.text();
        let message: string = `HTTP ${status}`;
        try {
          const j: any = text ? JSON.parse(text) : undefined;
          message = (j?.message as string) || (j?.error as string) || message;
        } catch {}
        throw { message, status } as NormalizedError;
      }
      const etag = res.headers.get('ETag') ?? undefined;
      const body: any = await res.json();
      const items: ACAItem[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
      const nextLink: string | null = (body?.links?.next as string | undefined) ?? (body?.meta?.next as string | undefined) ?? (body?.next as string | undefined) ?? null;
      return { items, next: nextLink ?? null, etag };
    } catch (e: any) {
      if (i === 2) {
        const msg = e?.message || (typeof e === 'string' ? e : 'Network error');
        console.error('[ACA] batch fetch failed:', { urlPreview: url.slice(0, 120), err: msg, key: mask(env.ACA_API_KEY) });
        throw new Error(msg);
      }
      await wait([800, 2000][i] ?? 2000);
    } finally {
      clearTimeout(timer);
    }
  }
  return { items: [], next: null };
}

export async function fetchAll(path: string, opts?: { manualRefresh?: boolean; limitQuery?: string }): Promise<ACAItem[]> {
  const base = env.ACA_API_BASE?.replace(/\/$/, '') ?? '';
  const key = encodeURIComponent(env.ACA_API_KEY ?? '');
  if (!base || !key) {
    throw new Error('ACA API not configured');
  }
  let next: string | null = `${base}${path.startsWith('/') ? path : `/${path}`}?service_key=${key}${opts?.limitQuery ? `&${opts.limitQuery}` : ''}${opts?.manualRefresh ? `&_ts=${Date.now()}` : ''}`;
  const out: ACAItem[] = [];
  while (next) {
    const { items, next: n } = await fetchBatch(next);
    out.push(...items);
    await wait(0);
    if (typeof n === 'string' && n.length > 0) {
      next = n.includes('service_key=') ? n : `${n}${n.includes('?') ? '&' : '?'}service_key=${key}`;
    } else {
      next = null;
    }
  }
  return out;
}

export async function fetchAllProgressive(
  path: string,
  opts: { manualRefresh?: boolean; limitQuery?: string; onBatch?: (batch: ACAItem[]) => void } = {}
): Promise<{ total: number }>{
  const base = env.ACA_API_BASE?.replace(/\/$/, '') ?? '';
  const key = encodeURIComponent(env.ACA_API_KEY ?? '');
  if (!base || !key) throw new Error('ACA API not configured');
  let next: string | null = `${base}${path.startsWith('/') ? path : `/${path}`}?service_key=${key}${opts?.limitQuery ? `&${opts.limitQuery}` : ''}${opts?.manualRefresh ? `&_ts=${Date.now()}` : ''}`;
  let total = 0;
  while (next) {
    const { items, next: n } = await fetchBatch(next);
    total += items.length;
    if (items.length) opts.onBatch?.(items);
    await wait(0);
    if (typeof n === 'string' && n.length > 0) {
      next = n.includes('service_key=') ? n : `${n}${n.includes('?') ? '&' : '?'}service_key=${key}`;
    } else {
      next = null;
    }
  }
  return { total };
}

export async function getLocations(opts?: { manualRefresh?: boolean }) {
  return fetchAll('/locations', { manualRefresh: opts?.manualRefresh, limitQuery: 'limit=200' });
}

export async function getLicensePlates(opts?: { manualRefresh?: boolean }) {
  return fetchAll('/license-plates', { manualRefresh: opts?.manualRefresh, limitQuery: 'limit=200' });
}
