import type { ACAItem } from '@/api/acaClient';

export type Location = {
  id: string;
  name: string;
  code?: string;
  active?: boolean;
  updated_at?: string;
  extra?: Record<string, any>;
};

export function mapLocation(item: ACAItem): Location | null {
  const name: string | undefined = (item?.name as string) ?? (item?.label as string) ?? undefined;
  const id: string | undefined = (item?.id as string) ?? undefined;
  if (!id || !name) return null;
  const code: string | undefined = (item?.code as string) ?? (item?.slug as string) ?? undefined;
  const activeRaw: any = (item?.active as any) ?? (item?.enabled as any) ?? undefined;
  const active: boolean | undefined = typeof activeRaw === 'boolean' ? activeRaw : undefined;
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
  return items
    .map((it) => mapLocation(it))
    .filter((v): v is Location => v !== null);
}
