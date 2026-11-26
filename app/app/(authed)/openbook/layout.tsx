import Link from 'next/link';
import type { ReactNode } from 'react';
import { getAppUser } from '@/lib/app/service';
import { profileOf } from '@/lib/openbook/challenge';
import { OB_MENU, t } from '@/lib/openbook/i18n';

export const metadata = { title: 'Open Book' };

/** Open Book menu (§13 + §27) for students; parents see only the summary on the home page. */
export default async function OpenBookLayout({ children }: { children: ReactNode }) {
  const u = await getAppUser();
  const student = u?.active?.kind === 'student' ? u.active : null;
  const lang = student ? (await profileOf(student.studentId))?.lang ?? 'en' : 'en';
  return (
    <div className="space-y-4">
      {student && (
        <nav aria-label="Open Book" className="-mx-4 overflow-x-auto border-b border-line px-4 pb-2 print:hidden">
          <ul className="flex gap-1.5 whitespace-nowrap">
            {OB_MENU.map((m) => <li key={m.href}><Link href={m.href} className="chip text-xs">{t(lang, m.key)}</Link></li>)}
          </ul>
        </nav>
      )}
      {children}
    </div>
  );
}
