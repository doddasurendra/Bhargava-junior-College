import { expect, test } from '@playwright/test';
import { qaStaff, staffLogin } from './helpers';

/** Role boundaries: a signed-in role opening another role's page gets the "No access" page, not the data. */
const DENY: Record<string, string[]> = {
  telecaller: ['/crm/accounts', '/crm/security', '/crm/developer', '/crm/staff', '/crm/verification'],
  faculty: ['/crm/accounts', '/crm/security', '/crm/developer', '/crm/staff'],
  class_teacher: ['/crm/accounts', '/crm/security', '/crm/developer', '/crm/staff'],
  front_desk: ['/crm/accounts', '/crm/security', '/crm/developer', '/crm/staff'],
  hostel_warden: ['/crm/accounts', '/crm/security', '/crm/developer'],
  transport_incharge: ['/crm/accounts', '/crm/security', '/crm/developer'],
  sports_coach: ['/crm/accounts', '/crm/security', '/crm/developer'],
  student_counsellor: ['/crm/accounts', '/crm/security', '/crm/developer'],
  data_executive: ['/crm/accounts', '/crm/security', '/crm/developer', '/crm/students'],
  accounts: ['/crm/security', '/crm/developer', '/crm/staff'],
  super_admin: ['/crm/developer'],
};

const accounts = qaStaff();
test.skip(accounts.length === 0, 'No .data/qa-accounts.json');
test.setTimeout(5 * 60_000);

for (const [role, paths] of Object.entries(DENY)) {
  test(`${role} is refused on ${paths.length} restricted pages`, async ({ page }) => {
    const s = accounts.find((a) => a.role === role)!;
    await staffLogin(page, s);
    const leaked: string[] = [];
    for (const p of paths) {
      await page.goto(p);
      const path = new URL(page.url()).pathname;
      if (!path.startsWith('/crm/forbidden') && path !== s.home && !/no access|not allowed|permission|only the .{2,40} (role )?can/i.test(await page.locator('main').innerText())) leaked.push(`${p} -> ${path}`);
    }
    expect(leaked, `${role} opened pages it should not`).toEqual([]);
  });
}
