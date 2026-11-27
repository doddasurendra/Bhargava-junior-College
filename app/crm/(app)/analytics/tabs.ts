import type { Staff } from '@/lib/crm/types';

/** Analytics tabs added by later modules (mock exams, marketing, sports, motivation, yoga). */
export function extraTabs(_user: Staff): [string, string][] {
  return [];
}
