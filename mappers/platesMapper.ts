import type { ACAItem } from '@/api/acaClient';
import { mapLocation } from './locationsMapper';

export type Plate = {
  id: string;
  plate_number: string;
  state?: string;
  location_id?: string;
  status?: string;
  updated_at?: string;
  extra?: Record<string, any>;
};

const hash = (s: string): string => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return `pl_${Math.abs(h)}`;
};

export function mapPlate(item: ACAItem, locationsIndex?: Map<string, string>): Plate {
  const plate_number: string = (item?.plate_number as string) ?? (item?.plate as string) ?? (item?.tag as string) ?? 'UNKNOWN';
  const id: string = (item?.id as string) ?? hash(plate_number);
  const state: string | undefined = (item?.state as string) ?? (item?.region as string) ?? (item?.jurisdiction as string) ?? undefined;

  let location_id: string | undefined = (item?.location_id as string) ?? undefined;
  const locationObj: any = item?.location as any;
  if (!location_id && locationObj) {
    location_id = (locationObj?.id as string) ?? undefined;
    if (!location_id) {
      const name: string | undefined = (locationObj?.name as string) ?? (locationObj?.label as string) ?? undefined;
      if (name) {
        const locId = `loc_${Math.abs(((name ?? '')).split('').reduce((a, c) => (Math.imul(31, a) + c.charCodeAt(0)) | 0, 0))}`;
        location_id = locId;
      }
    }
  }
  if (!location_id && locationsIndex) {
    const key = (item?.location as any)?.name || (item?.location as any)?.label;
    if (key) {
      const found = locationsIndex.get(String(key));
      if (found) location_id = found;
    }
  }

  const status: string | undefined = (item?.status as string) ?? (item?.state_text as string) ?? 'unknown';

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
  return items.map((it) => mapPlate(it, locationsIndex));
}
