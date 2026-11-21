import { createArticleAction } from '@/app/crm/kb-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Panel } from '@/components/crm/ui';
import { articleFields } from '@/components/kb/ui';
import { requireStaff } from '@/lib/crm/auth';
import { getLang } from '@/lib/i18n-server';
import { centreById } from '@/lib/kb/centres';
import { kbT } from '@/lib/kb/i18n';
import { listCategories, staffViewer } from '@/lib/kb/service';

export const metadata = { title: 'New article' };

export default async function NewArticlePage({ searchParams }: { searchParams: { centre?: string; title?: string; topic?: string } }) {
  const user = await requireStaff('kb.edit');
  const lang = getLang();
  const t = kbT(lang);
  const v = await staffViewer(user);
  const centre = centreById(searchParams.centre ?? '')?.id ?? 'student';
  const cats = (await listCategories(centre)).map((c) => ({ id: c.id, name: c.data.name.en }));
  const fields = articleFields(v, lang, searchParams.title ? { title: { en: searchParams.title.slice(0, 200) }, topic: searchParams.topic ?? null } : searchParams.topic ? { topic: searchParams.topic } : null, centre, { categories: cats, staff: [] });
  return (
    <Panel title={t.newArticle}>
      <p className="mb-3 text-xs text-muted">Saved as a draft (version 1). Send it for review; an approver publishes it. Live records (attendance, marks, fees) are never typed here: the centres show them from their modules.</p>
      <QuickForm action={createArticleAction} submit="Save draft" fields={fields} reset={false} />
    </Panel>
  );
}
