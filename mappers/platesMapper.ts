import type { ACAItem } from '@/api/acaClient';

export type Plate = {
  id: string;
  plate_number: string;
  state?: string;
  location_id?: string;
  status?: string;
  updated_at?: string;
  extra?: Record<string, any>;
};

export function mapPlate(item: ACAItem, locationsIndex?: Map<string, string>): Plate | null {
  const plate_number: string | undefined = (item?.plate_number as string) ?? (item?.plate as string) ?? (item?.tag as string) ?? undefined;
  const id: string | undefined = (item?.id as string) ?? undefined;
  if (!id || !plate_number) return null;
  const state: string | undefined = (item?.state as string) ?? (item?.region as string) ?? (item?.jurisdiction as string) ?? undefined;

  let location_id: string | undefined = (item?.location_id as string) ?? undefined;
  const locationObj: any = item?.location as any;
  if (!location_id && locationObj) {
    location_id = (locationObj?.id as string) ?? undefined;
    if (!location_id && locationsIndex) {
      const key = (locationObj?.name as string) ?? (locationObj?.label as string) ?? undefined;
      if (key) {
        const found = locationsIndex.get(String(key));
        if (found) location_id = found;
      }
    }
  }

  const status: string | undefined = (item?.status as string) ?? (item?.state_text as string) ?? undefined;

  return {
    id,
    plate_number,
    state,
    location_id,
    status,
    updated_at: (item?.updated_at as string) ?? (item?.updatedAt as string) ?? undefined,
    extra: { ...item },
  };
}

export function mapPlates(items: ACAItem[], locationsIndex?: Map<string, string>): Plate[] {
  return items
    .map((it) => mapPlate(it, locationsIndex))
    .filter((v): v is Plate => v !== null);
}
