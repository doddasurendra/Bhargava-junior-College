import { expect, test } from '@playwright/test';
import { CRASH, staffFor, staffLogin } from './helpers';

/** Read-only: Google Books search (title / author / subject / any) and Voyage semantic knowledge search on production. */
test.setTimeout(4 * 60_000);

test('Google Books search by title, author, subject and keyword', async ({ browser }) => {
  const p = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  await staffLogin(p, staffFor('super_admin'));
  await p.goto('/crm/openbook?tab=books');
  await expect(p.locator('body')).not.toContainText(CRASH);
  const status = p.locator('li', { hasText: 'Google Books:' }).first();
  if (await status.count()) console.log('status |', (await status.innerText()).replace(/\s+/g, ' '));
  for (const [field, q] of [['title', 'Concepts of Physics'], ['author', 'H C Verma'], ['subject', 'Chemistry'], ['any', 'NCERT Mathematics class 11']] as const) {
    await p.getByLabel('Search by').selectOption(field);
    await p.getByLabel('Search Google Books').fill(q);
    await p.getByRole('button', { name: 'Search' }).click();
    const done = p.getByText(/results from Google Books|Google Books (refused|rejected|returned|daily)/).first();
    await expect(done).toBeVisible({ timeout: 30_000 });
    const err = p.locator('[role=alert]');
    if (await err.count()) console.log(`${field} "${q}" | ERROR`, await err.first().innerText());
    await expect(err, 'Google Books must answer without an error').toHaveCount(0);
    const total = await p.getByText(/results from Google Books/).first().innerText();
    const firstTitles = await p.locator('img[src*="books.google"], img[src*="googleusercontent"]').count();
    const bodyText = await p.locator('main').innerText();
    const sample = bodyText.split('\n').filter((l) => l.length > 6).slice(0, 0);
    console.log(`${field} "${q}" | ${total} | covers shown: ${firstTitles}`, sample.join(''));
    expect(total).toMatch(/[1-9]/);
  }
  await expect(p.getByRole('link', { name: /preview|google|buy|info/i }).first()).toBeVisible();
});

test('Voyage semantic search finds by meaning across concepts', async ({ browser }) => {
  const p = await (await browser.newContext()).newPage();
  await staffLogin(p, staffFor('super_admin'));
  for (const q of ['admission documents required', 'how much does the hostel cost', 'when do classes start in the morning', 'help for a stressed student', 'can my child stay on campus']) {
    await p.goto(`/crm/knowledge/search?q=${encodeURIComponent(q)}`);
    await expect(p.locator('body')).not.toContainText(CRASH);
    const line = p.getByText(/result\(s\) in \d+ ms/).first();
    await expect(line).toContainText('+ semantic');
    const titles = await p.locator('li.rounded-xl a.font-medium').evaluateAll((as) => as.map((a) => (a.textContent ?? '').trim()).filter((t) => t.length > 3).slice(0, 3));
    console.log(`"${q}" | ${(await line.innerText()).split('·')[0].trim()} | top: ${titles.join(' / ')}`);
  }
});
