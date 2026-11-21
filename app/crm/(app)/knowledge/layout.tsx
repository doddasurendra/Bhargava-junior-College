import type { ReactNode } from 'react';
import { KbLangSwitch, KbSubNav } from '@/components/kb/client';
import { requireStaff } from '@/lib/crm/auth';
import { getLang } from '@/lib/i18n-server';
import { kbT } from '@/lib/kb/i18n';
import { hubNav } from '@/lib/kb/nav';
import { staffViewer } from '@/lib/kb/service';

export const dynamic = 'force-dynamic';

export default async function KnowledgeLayout({ children }: { children: ReactNode }) {
  const user = await requireStaff('kb.view');
  const lang = getLang();
  const t = kbT(lang);
  const v = await staffViewer(user);
  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-2xl text-heading">📚 {t.hub}</p>
        <KbLangSwitch current={lang} label={t.language} />
      </div>
      <KbSubNav items={hubNav(user, v, lang)} />
      {children}
    </div>
  );
}
