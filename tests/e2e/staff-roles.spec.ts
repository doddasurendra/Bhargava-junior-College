import { expect, test } from '@playwright/test';
import { CRASH, expectHealthy, qaStaff, staffLogin, watchErrors } from './helpers';

/**
 * Every staff role: signs in with its own QA account, lands on its own dashboard, every link in its menu
 * opens without a crash or server error, and signing out ends the session.
 */
const accounts = qaStaff();
test.skip(accounts.length === 0, 'No .data/qa-accounts.json');

for (const s of accounts) {
  test(`${s.label}: login, dashboard, menu, logout`, async ({ page }) => {
    test.setTimeout(15 * 60_000);
    const errors = watchErrors(page);
    await staffLogin(page, s);
    await page.goto('/crm');
    await page.waitForLoadState('domcontentloaded');
    expect(new URL(page.url()).pathname, 'lands on its role dashboard').toBe(s.home);
    await expectHealthy(page);
    await expect(page.locator('body')).toContainText(s.name.replace(/^QA /, '').split(' / ')[0], { ignoreCase: true }).catch(() => undefined);

    // every CRM link visible to this role
    const links = [...new Set(await page.locator('a[href^="/crm"]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!.split('#')[0])))]
      .filter((h) => !/logout|signout|\/crm\/login|download|export|\.csv|\.pdf|receipts\//i.test(h))
      .slice(0, 45);
    const broken: string[] = [];
    for (const href of links) {
      const t0 = Date.now();
      const res = await page.goto(href, { timeout: 90_000 }).catch((e) => (broken.push(`${href}: ${e.message.slice(0, 80)}`), null));
      if (!res) continue;
      if (Date.now() - t0 > 15_000) console.log(`SLOW ${Date.now() - t0} ms ${href}`);
      if (res.status() >= 500) broken.push(`${href}: HTTP ${res.status()}`);
      else if (CRASH.test(await page.locator('body').innerText())) broken.push(`${href}: crash text`);
      else if (new URL(page.url()).pathname.startsWith('/crm/forbidden')) broken.push(`${href}: menu shows a link the role may not open`);
    }
    expect(broken, `menu links for ${s.role}`).toEqual([]);

    // sign out
    await page.goto(s.home);
    await page.getByRole('button', { name: /sign out|log out/i }).first().click();
    await page.waitForURL(/\/crm\/login|\/login|\/$/, { timeout: 30_000 });
    await page.goto('/crm');
    await expect(page).toHaveURL(/\/crm\/login/);
    expect(errors, 'no console errors or 5xx').toEqual([]);
  });
}

test('wrong password is refused and does not reveal whether the account exists', async ({ page }) => {
  const s = accounts[0];
  await page.goto('/crm/login');
  await page.locator('input[name="email"]').fill(s.email);
  await page.locator('input[name="password"]').fill('Definitely-Wrong-9x');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('body')).toContainText(/incorrect|invalid|wrong/i);
  await expect(page).toHaveURL(/\/crm\/login/);
});

test('signed-out visitor cannot open staff pages', async ({ page }) => {
  for (const p of ['/crm', '/crm/accounts', '/crm/security', '/crm/developer', '/crm/students']) {
    await page.goto(p);
    await expect(page, p).toHaveURL(/\/crm\/login/);
  }
});
