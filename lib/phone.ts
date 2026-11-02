/** Normalise an Indian mobile number to E.164 (+91XXXXXXXXXX). Returns null if invalid. */
export function normalizeIndianMobile(input: string): string | null {
  let d = String(input ?? '').replace(/\D/g, '');
  if (d.length === 14 && d.startsWith('0091')) d = d.slice(4);
  else if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (!/^[6-9]\d{9}$/.test(d)) return null;
  return `+91${d}`;
}

/** Mask a phone for logs and UI: ******7575 */
export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  return d.length < 4 ? '****' : `******${d.slice(-4)}`;
}
