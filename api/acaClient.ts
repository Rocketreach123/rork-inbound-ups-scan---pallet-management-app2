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

export async function fetchAll(path: string, opts?: { manualRefresh?: boolean }): Promise<ACAItem[]> {
  const base = env.ACA_API_BASE?.replace(/\/$/, '') ?? '';
  const key = encodeURIComponent(env.ACA_API_KEY ?? '');
  if (!base || !key) {
    throw new Error('ACA API not configured');
  }
  let next: string | null = `${base}${path.startsWith('/') ? path : `/${path}`}?service_key=${key}`;
  const out: ACAItem[] = [];
  let attempt = 0;
  while (next) {
    try {
      const url: string = `${next}${opts?.manualRefresh ? `&_ts=${Date.now()}` : ''}`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 10000);
      const res: Response = await fetch(url, { method: 'GET', signal: controller.signal });
      clearTimeout(t);
      if (!res.ok) {
        const status: number = res.status;
        const text: string = await res.text();
        let message: string = `HTTP ${status}`;
        try {
          const j: any = text ? JSON.parse(text) : undefined;
          message = (j?.message as string) || (j?.error as string) || message;
        } catch {}
        const err: NormalizedError = { message, status };
        throw err;
      }
      const body: any = await res.json();
      const items: any[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
      out.push(...items);
      const nextLink: string | null = (body?.links?.next as string | undefined) ?? (body?.meta?.next as string | undefined) ?? (body?.next as string | undefined) ?? null;
      if (typeof nextLink === 'string' && nextLink.length > 0) {
        next = nextLink.includes('service_key=') ? nextLink : `${nextLink}${nextLink.includes('?') ? '&' : '?'}service_key=${key}`;
      } else {
        next = null;
      }
      attempt = 0;
    } catch (e: any) {
      attempt += 1;
      if (attempt >= 3) {
        const msg = e?.message || (typeof e === 'string' ? e : 'Network error');
        console.error('[ACA] fetch error after retries:', { path, err: msg, key: mask(env.ACA_API_KEY) });
        throw new Error(msg);
      }
      const backoff = [500, 1500, 3000][attempt - 1] ?? 3000;
      await wait(backoff);
    }
  }
  return out;
}

export async function getLocations(opts?: { manualRefresh?: boolean }) {
  return fetchAll('/locations', opts);
}

export async function getLicensePlates(opts?: { manualRefresh?: boolean }) {
  return fetchAll('/license-plates', opts);
}
