import type { ACAItem } from '@/api/acaClient';

export type Location = {
  id: string;
  name: string;
  code?: string;
  active?: boolean;
  updated_at?: string;
  extra?: Record<string, any>;
};

const hash = (s: string): string => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return `loc_${Math.abs(h)}`;
};

export function mapLocation(item: ACAItem): Location {
  const name: string = (item?.name as string) ?? (item?.label as string) ?? 'Unknown Location';
  const code: string | undefined = (item?.code as string) ?? (item?.slug as string) ?? undefined;
  const activeRaw: any = (item?.active as any) ?? (item?.enabled as any) ?? true;
  const active: boolean = typeof activeRaw === 'boolean' ? activeRaw : String(activeRaw).toLowerCase() !== 'false';
  const id: string = (item?.id as string) ?? hash(((name ?? '') + (code ?? '')).trim() || JSON.stringify(item));

  return {
    id,
    name,
    code,
    active,
    updated_at: (item?.updated_at as string) ?? (item?.updatedAt as string) ?? undefined,
    extra: { ...item },
  };
}

export function mapLocations(items: ACAItem[]): Location[] {
  return items.map(mapLocation);
}
