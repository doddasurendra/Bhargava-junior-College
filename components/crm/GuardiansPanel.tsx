import { addGuardianAction, removeGuardianAction } from '@/app/crm/guardian-actions';
import type { Guardian } from '@/lib/app/types';
import { RELATIONS } from '@/lib/app/types';
import { formatDateTime } from '@/lib/dates';
import { ActionForm, Submit } from './forms';
import { Panel } from './ui';

export function GuardiansPanel({ leadId, guardians, canManage }: { leadId: string; guardians: Guardian[]; canManage: boolean }) {
  return (
    <Panel title={`Parent app access (${guardians.length})`}>
      <ul className="space-y-2 text-sm">
        {guardians.map((g) => (
          <li key={g.phone} className="flex items-center justify-between gap-2">
            <span>
              <span className="font-medium text-heading">{g.name}</span> <span className="text-xs capitalize text-muted">{g.relation}</span>
              <span className="block font-mono text-xs text-muted">
                {g.phone} · since {formatDateTime(g.addedAt)}
              </span>
            </span>
            {canManage && guardians.length > 1 && (
              <ActionForm action={removeGuardianAction} reset={false} quiet className="shrink-0">
                <input type="hidden" name="leadId" value={leadId} />
                <input type="hidden" name="phone" value={g.phone} />
                <Submit className="text-xs text-red-700 underline dark:text-red-300">Remove</Submit>
              </ActionForm>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <ActionForm action={addGuardianAction} className="mt-4 space-y-2 border-t border-line pt-3">
          <input type="hidden" name="leadId" value={leadId} />
          <p className="text-xs font-semibold text-heading">Add a guardian</p>
          <input name="name" required minLength={2} maxLength={80} placeholder="Name" className="input py-1.5 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input name="phone" required placeholder="Mobile" inputMode="numeric" className="input py-1.5 font-mono text-sm" />
            <select name="relation" required defaultValue="" className="input py-1.5 text-sm">
              <option value="" disabled>
                Relation…
              </option>
              {RELATIONS.map((r) => (
                <option key={r} value={r} className="capitalize">
                  {r}
                </option>
              ))}
            </select>
          </div>
          <Submit className="btn-outline w-full py-1.5">Give app access</Submit>
        </ActionForm>
      )}
    </Panel>
  );
}
