import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MODULE_BUTTONS, PLATFORM_LINKS } from '@/content/platform';

/** Every platform bar link and module button must point at a page that exists (no dead links). */
function pageExists(href: string) {
  const p = href.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
  const root = path.resolve(__dirname, '..', 'app');
  const candidates = p === ''
    ? [path.join(root, '(site)', 'page.tsx')]
    : [path.join(root, '(site)', p, 'page.tsx'), path.join(root, p, 'page.tsx'), path.join(root, p.replace(/^app\//, 'app/(authed)/'), 'page.tsx')];
  return candidates.some((c) => existsSync(c));
}

describe('platform bar and module buttons', () => {
  it('link only to pages that exist, with no duplicates', () => {
    for (const l of [...PLATFORM_LINKS, ...MODULE_BUTTONS]) expect(pageExists(l.href), l.href).toBe(true);
    expect(new Set(MODULE_BUTTONS.map((m) => m.href)).size).toBe(MODULE_BUTTONS.length);
    expect(MODULE_BUTTONS.some((m) => m.href === '/why-bhargava')).toBe(true);
  });
});
