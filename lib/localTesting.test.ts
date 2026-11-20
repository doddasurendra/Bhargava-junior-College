import { afterEach, describe, expect, it, vi } from 'vitest';
import { showCodesOnScreen } from './localTesting';

afterEach(() => vi.unstubAllEnvs());

const env = (vars: Record<string, string | undefined>) => {
  for (const k of ['NODE_ENV', 'VERCEL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'MESSAGING_PROVIDER', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'LOCAL_FILE_STORE']) vi.stubEnv(k, vars[k] ?? '');
};

describe('one-time codes on screen (local testing only)', () => {
  it('shows codes in next dev and in npm run start:local on the local store', () => {
    env({ NODE_ENV: 'development' });
    expect(showCodesOnScreen()).toBe(true);
    env({ NODE_ENV: 'production', LOCAL_FILE_STORE: '1' });
    expect(showCodesOnScreen()).toBe(true);
  });
  it('never in a normal production run, on Vercel, with Supabase, or with WhatsApp connected', () => {
    env({ NODE_ENV: 'production' });
    expect(showCodesOnScreen()).toBe(false);
    env({ NODE_ENV: 'production', LOCAL_FILE_STORE: '1', VERCEL: '1' });
    expect(showCodesOnScreen()).toBe(false);
    env({ NODE_ENV: 'development', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' });
    expect(showCodesOnScreen()).toBe(false);
    env({ NODE_ENV: 'development', MESSAGING_PROVIDER: 'whatsapp_cloud', WHATSAPP_PHONE_NUMBER_ID: '1', WHATSAPP_ACCESS_TOKEN: 't' });
    expect(showCodesOnScreen()).toBe(false);
  });
});
