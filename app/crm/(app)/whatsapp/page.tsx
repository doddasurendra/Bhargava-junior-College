import { requireStaff } from '@/lib/crm/auth';
import { setupStatus } from '@/lib/whatsapp/crm';
import { TEMPLATES } from '@/lib/whatsapp/templates';

export const metadata = { title: 'WhatsApp setup' };

const CAT: Record<string, string> = { utility: 'Utility', marketing: 'Marketing', authentication: 'Authentication' };

export default async function WhatsAppSetupPage() {
  await requireStaff('whatsapp.setup');
  const s = await setupStatus();
  const Flag = ({ on }: { on: boolean }) => <span className={`font-mono text-xs font-semibold ${on ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>{on ? 'set' : 'missing'}</span>;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl text-heading">WhatsApp setup</h1>
        <p className="mt-1 text-sm text-muted">
          WhatsApp Business Cloud API. Mode: <strong className="font-mono">{s.mode === 'cloud' ? 'live (sending)' : s.mode === 'dev' ? 'development (logging only)' : 'off (not configured)'}</strong>
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-heading">Environment</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {Object.entries(s.env).map(([k, v]) => (
              <li key={k} className="flex justify-between gap-4">
                <span className="font-mono text-xs">{k}{k === 'MESSAGING_PROVIDER' && ' = whatsapp_cloud'}</span>
                <Flag on={v} />
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
          <h2 className="text-sm font-semibold text-heading">Endpoints</h2>
          <p className="mt-2 text-xs text-muted">Webhook (Meta App → WhatsApp → Configuration; subscribe to “messages”)</p>
          <p className="break-all font-mono text-xs">{s.webhookUrl}</p>
          <p className="mt-2 text-xs text-muted">Visit reminders: call every 15 minutes with <span className="font-mono">Authorization: Bearer $CRON_SECRET</span></p>
          <p className="break-all font-mono text-xs">{s.cronUrl}</p>
          <p className="mt-2 text-xs text-muted">Brochure PDFs (content/sample.ts → brochures)</p>
          <ul className="text-xs">
            {s.brochures.map((b) => (
              <li key={b.program} className="flex justify-between">
                <span>{b.program}</span>
                <Flag on={b.configured} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold text-heading">Message templates to submit for approval</h2>
        <p className="mb-3 text-xs text-muted">Create each one in WhatsApp Manager with exactly this name, category, language and body. Messages fail until Meta approves the template.</p>
        <div className="space-y-3">
          {TEMPLATES.map((t) => (
            <article key={t.key} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-sm font-semibold text-heading">{t.name}</p>
                <p className="text-xs text-muted">
                  {CAT[t.category]} · {t.language}
                  {'header' in t && t.header === 'document' && ' · Header: document'}
                  {t.category === 'authentication' && ' · Copy-code button'}
                </p>
              </div>
              <p className="mt-1 text-xs text-muted">{t.description}</p>
              <p className="mt-2 rounded-lg bg-bg p-3 font-mono text-[13px] leading-6">{t.body}</p>
              <p className="mt-2 text-xs text-muted">
                {t.params.map((p, i) => (
                  <span key={i} className="mr-3">
                    <span className="font-mono">{`{{${i + 1}}}`}</span> {p}
                  </span>
                ))}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
