import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

/**
 * Private document storage (brief §10: encrypted documents; S3 or equivalent). Production: the private
 * Supabase Storage bucket `applicant-docs` (created by migration, no public access; files are served only
 * through short-lived signed URLs after an authorisation check). Local: .data/uploads.
 */
const BUCKET = 'applicant-docs';
export const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_BYTES = 5_000_000;

const sb = () => (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) : null);

/** Magic-byte check so a renamed executable can't pass as a PDF. */
export function sniffType(bytes: Uint8Array): (typeof ALLOWED_TYPES)[number] | null {
  const b = bytes;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

export async function putFile(key: string, bytes: Uint8Array, contentType: string) {
  const client = sb();
  if (client) {
    const { error } = await client.storage.from(BUCKET).upload(key, bytes, { contentType, upsert: true });
    if (error) throw new Error(`upload failed: ${error.message}`);
    return key;
  }
  const file = path.join(process.cwd(), '.data', 'uploads', key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes);
  return key;
}

export async function readFile(key: string): Promise<Uint8Array | null> {
  const client = sb();
  if (client) {
    const { data, error } = await client.storage.from(BUCKET).download(key);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  }
  try {
    return await fs.readFile(path.join(process.cwd(), '.data', 'uploads', key));
  } catch {
    return null;
  }
}
