import { expect, test, type Browser, type Page } from '@playwright/test';
import { staffFor, staffLogin } from './helpers';

/**
 * The whole admission → College ID → academics workflow across eight staff roles, on a fresh QA family each run:
 * public enquiry → manager qualifies + assigns → counsellor call → public visit booking → counselling + decision →
 * 6 verification sign-offs (counsellor, admission office, accounts, admin office) → receipt + College ID →
 * exam cell batch/mentor/timetable → faculty attendance + marks → exam cell publishes.
 * Opt-in (creates real rows): QA_RUN_WORKFLOW=1 npx playwright test admission-workflow
 */
test.skip(process.env.QA_RUN_WORKFLOW !== '1', 'set QA_RUN_WORKFLOW=1 (creates a new QA student each run)');
test.describe.configure({ mode: 'serial' });
test.setTimeout(10 * 60_000);

const phone = `90000${String(92000 + Math.floor(Math.random() * 7999))}`; // QA range +91 90000 92xxx
const parentName = `QA Workflow Parent ${phone.slice(-4)}`;
let leadUrl = '';
let studentId = '';

async function as(browser: Browser, role: string, fn: (p: Page) => Promise<void>) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await staffLogin(page, staffFor(role));
  try {
    await fn(page);
  } finally {
    await ctx.close();
  }
}
const form = (p: Page, sel: string) => p.locator('form').filter({ has: p.locator(sel) });
const toast = (p: Page, text: RegExp) => expect(p.locator('[role=status],[role=alert]').filter({ hasText: text }).first()).toBeVisible({ timeout: 30_000 });

test('1. public enquiry form creates a lead', async ({ page }) => {
  await page.goto('/contact');
  const f = page.locator('form').first();
  await f.locator('input:not([type=tel]):not([type=checkbox])').first().fill(parentName);
  await f.locator('input[type=tel]').fill(phone);
  await f.locator('select').nth(0).selectOption('iit-jee');
  await f.locator('select').nth(1).selectOption('Completed Class 10');
  await f.locator('textarea').fill('QA automated workflow test. Please ignore.');
  await f.locator('input[type=checkbox]').check();
  const resp = page.waitForResponse((r) => r.url().includes('/api/leads'));
  await f.getByRole('button', { name: 'Send enquiry' }).click();
  expect((await resp).status()).toBe(200);
});

test('2. admission manager qualifies and assigns to the counsellor', async ({ browser }) => {
  await as(browser, 'admission_manager', async (p) => {
    await p.goto(`/crm/leads?q=${phone}`);
    await p.getByRole('link', { name: parentName }).first().click();
    await p.waitForURL(/\/crm\/leads\/[0-9a-f-]{36}/);
    leadUrl = new URL(p.url()).pathname;
    await p.getByRole('button', { name: 'hot', exact: true }).click();
    await toast(p, /Saved/);
    const f = form(p, 'select[name=ownerId]').last();
    await f.locator('select[name=ownerId]').selectOption(staffFor('admission_counsellor').id);
    await f.getByRole('button', { name: 'Assign' }).click();
    await toast(p, /Assigned 1 lead/);
  });
});

test('3. counsellor logs a connected call', async ({ browser }) => {
  await as(browser, 'admission_counsellor', async (p) => {
    await p.goto(leadUrl);
    const f = form(p, 'textarea[name=notes]').first();
    await f.locator('input[name=outcome][value=connected]').check({ force: true });
    await f.locator('input[name=interest][value=hot]').check({ force: true });
    await f.locator('textarea[name=notes]').fill('QA: interested, will visit.');
    await f.getByRole('button', { name: 'Log call' }).click();
    await toast(p, /Call logged/);
  });
});

test('4. family books a campus visit on the public site', async ({ page }) => {
  await page.goto('/visit');
  const f = page.locator('form').first();
  await f.locator('input:not([type=tel]):not([type=checkbox])').first().fill(parentName);
  await f.locator('input[type=tel]').fill(phone);
  await f.locator('select').nth(0).selectOption('iit-jee');
  await f.locator('select[name=campus]').selectOption('boys_kuntloor');
  await f.locator('select').nth(2).selectOption('2');
  await f.locator('button[type=button]').filter({ hasText: /\d/ }).first().click();
  await f.getByRole('button', { name: /10:00|11:30|2:00|3:30/ }).first().click();
  await f.locator('input[type=checkbox]').check();
  const resp = page.waitForResponse((r) => r.url().includes('/api/visits'));
  await f.getByRole('button', { name: 'Confirm visit' }).click();
  expect((await resp).status()).toBe(200);
});

test('5. counsellor records counselling, decision Confirmed, signs off the application', async ({ browser }) => {
  await as(browser, 'admission_counsellor', async (p) => {
    await p.goto(leadUrl);
    const c = form(p, 'select[name=decision]');
    await c.locator('select[name=program]').selectOption('IIT-JEE');
    await c.locator('select[name=decision]').selectOption('confirmed');
    await c.locator('textarea[name=notes]').fill('QA counselling done.');
    await c.getByRole('button', { name: 'Record counselling' }).click();
    await toast(p, /Counselling recorded/);
    const d = form(p, 'input[name=decision][type=radio]');
    await d.locator('input[name=decision][value=confirmed]').check({ force: true });
    await d.getByRole('button', { name: 'Record decision' }).click();
    await toast(p, /Decision recorded/);
    await p.reload();
    const a = form(p, 'input[name=stage][value=application]');
    await a.locator('input[name=note]').fill('QA application complete');
    await a.getByRole('button', { name: /Mark application completed/ }).click();
    await expect(form(p, 'input[name=stage][value=application]')).toHaveCount(0, { timeout: 30_000 });
  });
});

test('6. admission office verifies documents, signs off, records the fee payment', async ({ browser }) => {
  await as(browser, 'admission_office', async (p) => {
    await p.goto(leadUrl);
    for (const k of ['ssc_memo', 'tc', 'study_certificate', 'aadhaar', 'photos']) {
      await form(p, `input[name=docKey][value=${k}]`).getByRole('button', { name: 'Verified' }).click();
      await p.waitForTimeout(2500);
    }
    await form(p, 'input[name=docKey][value=caste_income]').getByRole('button', { name: 'N/A' }).click();
    const d = form(p, 'input[name=stage][value=documents]');
    await expect(d).toHaveCount(1, { timeout: 30_000 });
    await d.locator('input[name=note]').fill('QA originals checked');
    await d.getByRole('button', { name: 'Sign off documents' }).click();
    await expect(form(p, 'input[name=stage][value=documents]')).toHaveCount(0, { timeout: 30_000 });
    const f = form(p, 'input[name=amount]');
    await f.locator('input[name=amount]').fill('25000');
    await f.locator('select[name=mode]').selectOption('upi');
    await f.locator('input[name=reference]').fill(`QA-UPI-${phone.slice(-4)}`);
    await f.locator('input[name=paidOn]').fill(new Date().toISOString().slice(0, 10));
    await f.getByRole('button', { name: 'Record payment' }).click();
    await toast(p, /Accounts must approve/);
  });
});

test('7. accounts approves the payment, confirms the fee and issues the receipt', async ({ browser }) => {
  await as(browser, 'accounts', async (p) => {
    await p.goto(leadUrl);
    await form(p, 'input[name=paymentId]').getByRole('button', { name: 'Approve' }).click();
    const fee = form(p, 'input[name=stage][value=fee]');
    await expect(fee).toHaveCount(1, { timeout: 30_000 });
    await fee.locator('input[name=note]').fill('QA fee confirmed');
    await fee.getByRole('button', { name: 'Confirm fee payment' }).click();
    await p.getByRole('button', { name: 'Generate official receipt' }).click({ timeout: 30_000 });
    await expect(p.locator('body')).toContainText(/BJC\/\d{4}-\d{2}\/\d{5}/, { timeout: 30_000 });
  });
});

test('8. admin office creates the student record (DOB, guardian mobile) and the College ID', async ({ browser }) => {
  await as(browser, 'admin_office', async (p) => {
    await p.goto(leadUrl);
    const f = form(p, 'input[name=fullName]');
    await f.locator('input[name=fullName]').fill(`QA Workflow Student ${phone.slice(-4)}`);
    await f.locator('input[name=dob]').fill('2010-06-15');
    await f.locator('select[name=gender]').selectOption('female');
    await f.locator('select[name=program]').selectOption('iit-jee');
    await f.locator('select[name=stay]').selectOption('day');
    await f.locator('input[name=guardianName]').fill(parentName);
    await f.locator('input[name=guardianPhone]').fill(phone);
    await f.getByRole('button', { name: 'Create student record' }).click();
    await p.getByRole('button', { name: 'Generate College ID' }).click({ timeout: 30_000 });
    await expect(p.locator('body')).toContainText(/BJC-\d{4}-JEE-\d{4}/, { timeout: 30_000 });
    // a College ID locks the sign-offs: nothing left to sign
    await expect(p.locator('input[name=stage]')).toHaveCount(0);
  });
});

test('9. exam cell allots the student to the QA batch; faculty takes attendance', async ({ browser }) => {
  await as(browser, 'academic_coordinator', async (p) => {
    await p.goto('/crm/academics');
    const f = p.locator('form').filter({ has: p.locator('select[name=studentId]') }).filter({ has: p.locator('select[name=batchId]') }).first();
    const opt = f.locator('select[name=studentId] option').filter({ hasText: phone.slice(-4) });
    studentId = (await opt.getAttribute('value'))!;
    await f.locator('select[name=studentId]').selectOption(studentId);
    const batch = await f.locator('select[name=batchId] option').filter({ hasText: 'QA JEE 1A' }).getAttribute('value');
    await f.locator('select[name=batchId]').selectOption(batch!);
    await f.getByRole('button', { name: 'Allot' }).click();
    await toast(p, /Student allotted/);
  });
  await as(browser, 'faculty', async (p) => {
    await p.goto('/crm/academics/my-classes');
    await p.getByRole('link', { name: 'QA JEE 1A' }).first().click(); // the batch page holds today's register
    const reg = p.locator('form').filter({ has: p.getByRole('button', { name: 'Save attendance' }) });
    await reg.getByRole('button', { name: 'Save attendance' }).click();
    // first save of the day: "Attendance saved"; a later save the same day is an audited correction
    await toast(p, /Attendance saved|Register corrected/);
  });
});
