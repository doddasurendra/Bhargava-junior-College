import { describe, expect, it } from 'vitest';
import { ROLE_LABELS, ROLES } from '@/lib/crm/types';
import { FAMILY_TYPES, LOGIN_GROUPS } from '@/content/loginTypes';

describe('/login hub', () => {
  const items = LOGIN_GROUPS.flatMap((g) => g.items);

  it('has an entry for every staff role and every family account type', () => {
    for (const r of ROLES) expect(items.some((i) => i.href === `/crm/login?as=${r}`), r).toBe(true);
    for (const f of FAMILY_TYPES) expect(items.some((i) => i.href === `/app/login?as=${f}`), f).toBe(true);
  });

  it('links only to known roles, with unique keys', () => {
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
    for (const i of items) {
      const m = i.href.match(/^\/crm\/login\?as=(.+)$/);
      if (m) expect(ROLE_LABELS[m[1]], i.href).toBeTruthy();
    }
  });
});
