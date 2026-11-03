import QRCode from 'qrcode';
import { MfaEnrolForm } from './AuthForms';

/** Server component: QR + typed key for a new authenticator, then the confirm-code form. */
export async function TotpSetup({ secret, uri }: { secret: string; uri: string }) {
  const svg = await QRCode.toString(uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#151C36', light: '#FFFFFF' } });
  const grouped = secret.match(/.{1,4}/g)?.join(' ') ?? secret;
  return (
    <div className="space-y-5">
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink">
        <li>Open an authenticator app on your phone: Google Authenticator, Microsoft Authenticator or similar.</li>
        <li>Add an account and scan this code.</li>
        <li>Enter the 6-digit code it shows.</li>
      </ol>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        {/* Always on white: phone cameras read dark-on-light codes most reliably. */}
        <div className="h-44 w-44 shrink-0 rounded-xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full" role="img" aria-label="QR code for your authenticator app" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="min-w-0 text-sm">
          <p className="text-muted">Can’t scan? Type this key into the app instead (time-based):</p>
          <p className="mt-1 select-all break-all rounded-lg bg-bg px-3 py-2 font-mono text-[15px] tracking-wider text-heading">{grouped}</p>
        </div>
      </div>
      <MfaEnrolForm />
    </div>
  );
}
