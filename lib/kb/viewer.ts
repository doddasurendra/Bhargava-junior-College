import 'server-only';
import { getAppUser } from '../app/service';
import { getStaffSession } from '../crm/auth';
import type { Viewer } from './access';
import { staffViewer } from './service';

/**
 * Who is asking, for route handlers shared by the CRM, the student/parent app and the website. A staff
 * session wins; then the app's ACTIVE profile (a parent sees only the child they selected; the profile
 * list is recomputed from the verified phone on every request); otherwise an anonymous visitor.
 */
export async function currentViewer(prefer: 'staff' | 'app' | 'auto' = 'auto'): Promise<Viewer> {
  if (prefer !== 'app') {
    const s = await getStaffSession();
    if (s) return staffViewer(s);
    if (prefer === 'staff') return { kind: 'public' };
  }
  const u = await getAppUser();
  const p = u?.active;
  if (p?.kind === 'student') return { kind: 'student', studentId: p.studentId, collegeId: p.collegeId };
  if (p?.kind === 'parent') return { kind: 'parent', studentIds: [p.studentId], phone: u!.phone };
  return { kind: 'public' };
}
