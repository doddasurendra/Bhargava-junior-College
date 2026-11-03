import 'server-only';
import { getRecordStore } from '../records';
import type { Content } from './blocks';
import { loadContent } from './store';

/**
 * Live CMS content for server components, route handlers and server actions. Cached briefly per server
 * instance; a save clears this instance's cache at once, other instances pick it up within TTL_MS.
 */
const TTL_MS = 15_000;
let cached: { at: number; content: Promise<Content> } | null = null;

export function getContent(): Promise<Content> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.content;
  const content = loadContent(getRecordStore()).catch((e) => {
    cached = null;
    throw e;
  });
  cached = { at: Date.now(), content };
  return content;
}

export function invalidateContent() {
  cached = null;
}

export type { Content } from './blocks';
