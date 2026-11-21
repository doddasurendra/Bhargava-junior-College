import { CAMPUSES, type CampusKey } from '@/content/brochure';
import { getRecordStore } from './records';
import { campusPreferences, CAMPUS_VALUES } from './records/collections';

/** The family's campus choice (Girls Residential – Bairamalguda / Boys Residential – Kuntloor / Day Scholar – LB Nagar). */
export const CAMPUS_OPTIONS = CAMPUSES.map((c) => ({ value: c.key, label: c.label }));
export const isCampus = (v: unknown): v is CampusKey => typeof v === 'string' && (CAMPUS_VALUES as readonly string[]).includes(v);

export async function setLeadCampus(leadId: string, campus: CampusKey | null, opts: { source: 'visit' | 'crm'; by: string | null }) {
  const store = getRecordStore();
  if (!campus) return campusPreferences.remove(store, leadId).catch(() => undefined);
  await campusPreferences.put(store, { leadId, campus, source: opts.source, setBy: opts.by }, leadId);
}

export async function campusOfLead(leadId: string): Promise<CampusKey | null> {
  const r = await campusPreferences.get(getRecordStore(), leadId);
  return (r?.data.campus as CampusKey | undefined) ?? null;
}

/** Lead ids whose family chose this campus (for the dashboard filter). */
export async function leadIdsForCampus(campus: CampusKey): Promise<Set<string>> {
  const rows = await campusPreferences.list(getRecordStore(), { k1: campus });
  return new Set(rows.map((r) => r.data.leadId));
}
