import { can, isDeveloper } from '../crm/permissions';
import type { Staff } from '../crm/types';
import type { Lang } from '../i18n';
import { allowedLevels, type Viewer } from './access';
import { CENTRES, type Centre } from './centres';
import { kbT } from './i18n';

/** May this viewer open this centre? (any of their readable levels is one the centre opens for) */
export function canOpenCentre(v: Viewer, c: Centre) {
  if (c.id === 'supabase') return v.kind === 'staff' && (isDeveloper(v.user) || v.user.roles[0] === 'super_admin');
  const lv = allowedLevels(v);
  if (c.id === 'departments' && v.kind === 'staff' && !['faculty', 'class_teacher', 'academic_coordinator', 'principal', 'management', 'super_admin', 'developer'].includes(v.user.roles[0]) && !(v.subjectHeadOf ?? []).length) return false;
  return c.open.some((l) => lv.includes(l));
}

export const centresFor = (v: Viewer) => CENTRES.filter((c) => canOpenCentre(v, c));

/** The "Knowledge" group: hub screens + each content centre the role can see (§23). */
export function hubNav(user: Staff, v: Viewer, lang: Lang) {
  const t = kbT(lang);
  const items = [{ href: '/crm/knowledge', label: t.dashboard }, { href: '/crm/knowledge/search', label: `${t.search} & ${t.ask.split(' ')[0]}` }];
  if (can(user, 'kb.view')) items.push({ href: '/crm/knowledge/repository', label: t.repository }, { href: '/crm/knowledge/documents', label: t.documents });
  if (can(user, 'kb.approve')) items.push({ href: '/crm/knowledge/approvals', label: t.approvals });
  if (can(user, 'kb.analytics')) items.push({ href: '/crm/knowledge/analytics', label: t.analytics }, { href: '/crm/knowledge/audit', label: t.audit });
  if (can(user, 'kb.analytics') || can(user, 'dashboard.view') || can(user, 'students.view')) items.push({ href: '/crm/knowledge/intelligence', label: 'Advanced AI' });
  if (can(user, 'notify.manage')) items.push({ href: '/crm/knowledge/notifications', label: 'Notifications' });
  if (can(user, 'grievance.handle')) items.push({ href: '/crm/knowledge/grievances', label: 'Grievances' });
  if (can(user, 'kb.approve') || can(user, 'kb.admin')) items.push({ href: '/crm/knowledge/security', label: 'Security & governance' });
  if (can(user, 'kb.edit')) items.push({ href: '/crm/knowledge/transfer', label: `${t.import} / ${t.export}` });
  if (canOpenCentre(v, CENTRES.find((c) => c.id === 'supabase')!)) items.push({ href: '/crm/knowledge/supabase', label: t.supabase });
  return items;
}
