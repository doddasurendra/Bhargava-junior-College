import { can } from '@/lib/crm/permissions';
import type { Staff } from '@/lib/crm/types';

/** Analytics tabs added by later modules; each tab only appears for roles that may use it (checked again on the server). */
export function extraTabs(user: Staff): [string, string][] {
  return [
    ...(can(user, 'ob.teach') ? [['mocks', 'Mock exams'] as [string, string]] : []),
  ];
}
