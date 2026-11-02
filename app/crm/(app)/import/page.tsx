import { ImportWizard } from '@/components/crm/ImportWizard';
import { Empty } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { IMPORT_SOURCES } from '@/lib/crm/importer';
import { importHistory } from '@/lib/crm/service';
import { formatDateTime } from '@/lib/dates';

export const metadata = { title: 'Import leads' };

export default async function ImportPage() {
  const user = await requireStaff('lead.import');
  const history = await importHistory(user);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-heading">Import leads</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Bring in school data, walk-ins, referrals and other lists. Rows are de-duplicated by mobile number against the file and against existing leads, and every lead keeps its full history.
        </p>
      </div>
      <ImportWizard />
      <section>
        <h2 className="mb-2 text-sm font-semibold text-heading">Recent imports</h2>
        {history.length === 0 ? (
          <Empty>No imports yet.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="table-base min-w-[760px] text-[13px]">
              <thead>
                <tr>
                  <th>When</th>
                  <th>File</th>
                  <th>Source</th>
                  <th>By</th>
                  <th className="text-right">Rows</th>
                  <th className="text-right">New</th>
                  <th className="text-right">Merged</th>
                  <th className="text-right">Dupes</th>
                  <th className="text-right">Rejected</th>
                </tr>
              </thead>
              <tbody>
                {history.map((b) => (
                  <tr key={b.id}>
                    <td>{formatDateTime(b.createdAt)}</td>
                    <td className="max-w-[220px] truncate">{b.fileName}</td>
                    <td>{IMPORT_SOURCES.find((s) => s.value === b.source)?.label ?? b.source}</td>
                    <td>{b.actorName}</td>
                    <td className="text-right font-mono">{b.totalRows}</td>
                    <td className="text-right font-mono text-emerald-700 dark:text-emerald-300">{b.created}</td>
                    <td className="text-right font-mono">{b.merged}</td>
                    <td className="text-right font-mono text-muted">{b.duplicatesInFile}</td>
                    <td className="text-right font-mono text-muted">{b.invalid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
