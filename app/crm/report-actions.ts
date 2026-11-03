'use server';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/crm/auth';
import { generateDailyReport } from '@/lib/crm/reports';

/** "Preview today's report": builds and stores today's snapshot without sending WhatsApp messages. */
export async function previewReportAction() {
  await requireStaff('dashboard.view');
  const r = await generateDailyReport(new Date(), { send: false });
  redirect(`/crm/reports/${r.date}`);
}
