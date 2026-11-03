/** "Chrome on Windows" from a user-agent string — enough to spot an unfamiliar device in the audit. */
export function shortDevice(ua: string | null): string {
  if (!ua) return '—';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

export const METHOD_LABELS: Record<string, string> = {
  password: 'Password',
  dev: 'Dev picker',
  totp: 'Authenticator',
  recovery: 'Recovery code',
  enrol: '2FA setup',
  logout: 'Sign out',
  admin: 'Admin action',
};
