import Link from 'next/link';
import type { ReactNode } from 'react';
import { logoutAction } from '@/app/crm/actions';
import { ThemeToggle } from '@/components/HeaderControls';
import { RoleSwitcher } from '@/components/crm/RoleSwitcher';
import { Crest } from '@/components/ui';
import { OPERATING_PRINCIPLE } from '@/content/admissionSystem';
import { canUseAssistant } from '@/lib/staffAssistant/service';
import { exportsFor } from '@/lib/school/exports';
import { inboxCounts } from '@/lib/chat/inbox';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { BLOCK_KEYS, canEditBlock } from '@/lib/cms/blocks';
import { ROLE_LABELS } from '@/lib/crm/types';
import { homeFor } from '@/lib/crm/home';

export const dynamic = 'force-dynamic';

export default async function CrmShell({ children }: { children: ReactNode }) {
  const user = await requireStaff();
  const inbox = await inboxCounts(user);
  const allRoles = user.allRoles ?? user.roles;
  const switchable = allRoles.length > 1;
  const roleOptions = allRoles.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  const admissions = can(user, 'lead.call') || can(user, 'lead.viewAll') || can(user, 'visit.view');
  const home = homeFor(user.roles[0]);
  const nav = [
    ...(can(user, 'dashboard.view') ? [{ href: '/crm/dashboard', label: 'Dashboard' }] : []),
    ...(admissions && home === '/crm' ? [{ href: '/crm', label: 'My tasks' }] : []),
    ...(can(user, 'inbox.reply') ? [{ href: '/crm/inbox', label: `Chat inbox${inbox.waiting + inbox.unreadMine > 0 ? ` (${inbox.waiting + inbox.unreadMine})` : ''}` }] : []),
    ...(admissions ? [{ href: '/crm/leads', label: can(user, 'lead.viewAll') ? 'All leads' : 'My leads' }] : []),
    ...(can(user, 'visit.view') ? [{ href: '/crm/visits', label: 'Campus visits' }] : []),
    ...(can(user, 'visitor.log') ? [{ href: '/crm/front-desk', label: 'Front desk' }] : []),
    ...(can(user, 'verify.view') ? [{ href: '/crm/verification', label: 'Verification' }] : []),
    ...(can(user, 'fees.dues') || can(user, 'fees.export') || can(user, 'concession.approve.slab') || can(user, 'refund.approve') ? [{ href: '/crm/accounts', label: 'Accounts' }] : []),
    ...(can(user, 'lead.import') ? [{ href: '/crm/import', label: 'Import leads' }] : []),
    ...(can(user, 'academics.view') ? [{ href: '/crm/academics/overview', label: 'Academic overview' }] : []),
    ...(can(user, 'academics.manage') ? [{ href: '/crm/academics', label: 'Batches & timetable' }] : []),
    ...(can(user, 'attendance.mark') && !can(user, 'academics.manage') ? [{ href: '/crm/academics/my-classes', label: 'My classes' }] : []),
    ...(can(user, 'mentor.notes') ? [{ href: '/crm/mentor', label: 'Mentoring' }] : []),
    ...(can(user, 'students.view') ? [{ href: '/crm/students', label: 'Students' }] : []),
    ...(can(user, 'alumni.manage') ? [{ href: '/crm/alumni', label: 'Alumni' }] : []),
    ...(can(user, 'hostel.manage') ? [{ href: '/crm/hostel', label: 'Hostel' }] : []),
    ...(can(user, 'transport.manage') ? [{ href: '/crm/transport', label: 'Transport' }] : []),
    ...(can(user, 'homework.assign') ? [{ href: '/crm/homework', label: 'Homework' }] : []),
    ...(can(user, 'homework.assign') || can(user, 'academics.view') ? [{ href: '/crm/practice', label: 'Practice' }] : []),
    ...(can(user, 'library.manage') ? [{ href: '/crm/library', label: 'Library' }] : []),
    { href: '/crm/notices', label: 'Notices' },
    { href: '/crm/events', label: 'Events calendar' },
    ...(exportsFor(user).length ? [{ href: '/crm/exports', label: 'Reports & exports' }] : []),
    ...(can(user, 'leave.request') || can(user, 'leave.approve') ? [{ href: '/crm/leave', label: 'Leave' }] : []),
    ...(canUseAssistant(user) ? [{ href: '/crm/college-assistant', label: 'College assistant' }] : []),
    ...(can(user, 'whatsapp.setup') ? [{ href: '/crm/assistant', label: 'Website chat analytics' }] : []),
    ...(can(user, 'whatsapp.setup') ? [{ href: '/crm/whatsapp', label: 'WhatsApp setup' }] : []),
    ...(BLOCK_KEYS.some((k) => canEditBlock(user.roles, k)) ? [{ href: '/crm/cms', label: 'Website content' }] : []),
    ...(can(user, 'marketing.spend') ? [{ href: '/crm/marketing', label: 'Marketing spend' }] : []),
    ...(can(user, 'staff.manage') ? [{ href: '/crm/staff', label: 'Staff accounts' }] : []),
    ...(can(user, 'rbac.manage') ? [{ href: '/crm/permissions', label: 'Permissions' }] : []),
    ...(can(user, 'security.view') ? [{ href: '/crm/security', label: 'Security' }] : []),
  ];
  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[232px_1fr] print:block">
      <aside className="border-b border-line bg-navy-950 text-white/80 print:hidden lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-5 lg:py-6">
          <Link href={home} className="flex items-center gap-2.5">
            <Crest size={36} />
            <span className="leading-tight">
              <span className="block font-display text-white">Bhargava CRM</span>
              <span className="block text-[11px] uppercase tracking-[0.14em] text-gold-300">{admissions ? 'Admissions & staff' : 'Staff portal'}</span>
            </span>
          </Link>
          <nav aria-label="CRM" className="flex gap-1 overflow-x-auto lg:mt-8 lg:flex-col">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/10 hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="hidden border-t border-white/10 px-5 py-4 lg:block">
          <p className="text-sm font-semibold text-white">{user.fullName}</p>
          {switchable ? <RoleSwitcher roles={roleOptions} active={user.roles[0]} /> : <p className="text-xs text-white/60">{ROLE_LABELS[user.roles[0]]}</p>}
          <div className="mt-3 flex gap-4">
            <Link href="/crm/account" className="text-xs text-white/70 underline hover:text-white">
              My account
            </Link>
            <form action={logoutAction}>
              <button className="text-xs text-white/70 underline hover:text-white">Sign out</button>
            </form>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2 print:hidden lg:px-8">
          <p className="truncate text-xs text-muted" title={OPERATING_PRINCIPLE}>
            {OPERATING_PRINCIPLE}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {switchable && (
              <div className="lg:hidden">
                <RoleSwitcher roles={roleOptions} active={user.roles[0]} variant="bar" />
              </div>
            )}
            <Link href="/crm/account" className="text-sm text-muted underline lg:hidden">
              {user.fullName}
            </Link>
            <form action={logoutAction} className="lg:hidden">
              <button className="text-xs underline">Sign out</button>
            </form>
            <ThemeToggle />
          </div>
        </div>
        {user.viewedBy && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 bg-maroon px-4 py-2 text-sm text-white lg:px-8">
            <span>Viewing as <strong>{user.fullName}</strong> ({ROLE_LABELS[user.roles[0]]}): read-only, every page you open is as they see it.</span>
            <a href="/crm/view-as/stop" className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-maroon">Stop viewing</a>
          </div>
        )}
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
