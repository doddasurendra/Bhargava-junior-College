import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { dismissCodesAction } from '@/app/crm/auth-actions';
import { RecoveryCodeTools } from '@/components/crm/AuthForms';
import { unseal } from '@/lib/auth/totp';
import { requireStaff } from '@/lib/crm/auth';
import { RC_COOKIE } from '@/lib/crm/session';

export const metadata = { title: 'Recovery codes' };

function codesFromCookie(): string[] | null {
  const raw = cookies().get(RC_COOKIE)?.value;
  const json = raw ? unseal(raw) : null;
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) && v.every((c) => typeof c === 'string') ? v : null;
  } catch {
    return null;
  }
}

export default async function RecoveryCodesPage() {
  await requireStaff();
  const codes = codesFromCookie();
  if (!codes) redirect('/crm/account');
  return (
    <div className="max-w-xl space-y-5">
      <h1 className="font-display text-3xl text-heading">Save your recovery codes</h1>
      <p className="text-sm text-ink">
        If you lose your phone, each code gets you into the CRM <strong>once</strong>. This is the only time they’re shown. Keep them somewhere safe and away from your phone, such as printed in your desk or in a password manager.
      </p>
      <div className="card p-5">
        <ol className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-lg text-heading">
          {codes.map((c) => (
            <li key={c} className="select-all">
              {c}
            </li>
          ))}
        </ol>
      </div>
      <div className="print:hidden">
        <RecoveryCodeTools codes={codes} />
      </div>
      <form action={dismissCodesAction} className="print:hidden">
        <button className="btn-primary py-2.5">I’ve saved them, continue</button>
      </form>
    </div>
  );
}
