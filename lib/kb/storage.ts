import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

/**
 * Knowledge Hub file storage. Production: private Supabase Storage bucket `kb-files` (created by migration
 * 20261121000000_knowledge_hub.sql; no public access, files only leave through the access-checked download
 * route). Local: .data/kb-files. Object keys are opaque (`<fileId>/v<version>-<sha>`), never the file name.
 */
export const KB_BUCKET = 'kb-files';
const LOCAL = () => path.join(process.cwd(), '.data', 'kb-files');

const sb = () => (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) : null);
export const usingSupabaseStorage = () => !!sb();

export async function putKbFile(key: string, bytes: Uint8Array, contentType: string) {
  const client = sb();
  if (client) {
    const { error } = await client.storage.from(KB_BUCKET).upload(key, bytes, { contentType, upsert: false });
    if (error) throw new Error(`upload failed: ${error.message}`);
    return;
  }
  const file = path.join(LOCAL(), key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes);
}

export async function readKbFile(key: string): Promise<Uint8Array | null> {
  const client = sb();
  if (client) {
    const { data, error } = await client.storage.from(KB_BUCKET).download(key);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  }
  try {
    return await fs.readFile(path.join(LOCAL(), key));
  } catch {
    return null;
  }
}

/**
 * Direct browser → Supabase upload for big files (Vercel caps a request body at 4.5 MB): a one-time signed
 * URL for a staging key; the server then reads the staged object, checks and ingests it, and deletes it.
 */
export async function signedUpload(key: string) {
  const client = sb();
  if (!client) return null;
  const { data, error } = await client.storage.from(KB_BUCKET).createSignedUploadUrl(key);
  if (error || !data) throw new Error(`could not sign upload: ${error?.message}`);
  return { url: data.signedUrl, token: data.token, path: data.path };
}

export async function removeKbFile(key: string) {
  const client = sb();
  if (client) {
    await client.storage.from(KB_BUCKET).remove([key]);
    return;
  }
  try {
    await fs.unlink(path.join(LOCAL(), key));
  } catch {
    /* already gone */
  }
}

/** Bytes used and object count (local: walks the folder; Supabase: lists the bucket's top level folders). */
export async function kbStorageUsage(): Promise<{ bytes: number; objects: number; backend: 'supabase' | 'local' }> {
  const client = sb();
  if (client) {
    let bytes = 0;
    let objects = 0;
    const { data: dirs } = await client.storage.from(KB_BUCKET).list('', { limit: 1000 });
    for (const d of dirs ?? []) {
      const { data: files } = await client.storage.from(KB_BUCKET).list(d.name, { limit: 1000 });
      for (const f of files ?? []) {
        objects++;
        bytes += Number((f.metadata as { size?: number } | null)?.size ?? 0);
      }
    }
    return { bytes, objects, backend: 'supabase' };
  }
  let bytes = 0;
  let objects = 0;
  async function walk(dir: string) {
    let entries: import('node:fs').Dirent[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else {
        objects++;
        bytes += (await fs.stat(p)).size;
      }
    }
  }
  await walk(LOCAL());
  return { bytes, objects, backend: 'local' };
}

/** Quota shown on the Supabase screen (free plan: 1 GB storage). Override with KB_STORAGE_QUOTA_MB. */
export const storageQuotaBytes = () => Number(process.env.KB_STORAGE_QUOTA_MB ?? 1024) * 1024 * 1024;
