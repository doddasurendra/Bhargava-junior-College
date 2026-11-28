import os from 'node:os';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

/** Read-only: the voice assistant panel and its floating button can be moved without interrupting a conversation. */
const SHOTS = path.join(os.homedir(), 'Desktop', 'BJC-screenshots');
mkdirSync(SHOTS, { recursive: true });
test.setTimeout(4 * 60_000);
test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }, permissions: ['microphone'] });

const box = async (l: Locator) => (await l.boundingBox())!;
async function dragBy(p: Page, handle: Locator, dx: number, dy: number) {
  const b = await box(handle);
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await p.mouse.move(x, y);
  await p.mouse.down();
  for (let i = 1; i <= 8; i++) await p.mouse.move(x + (dx * i) / 8, y + (dy * i) / 8);
  await p.mouse.up();
}

test('desktop: drag in all directions, stays on screen, controls do not drag, keyboard, reset, persistence, minimise, no overlap', async ({ page: p }) => {
  await p.setViewportSize({ width: 1366, height: 900 });
  await p.goto('/');
  await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('bjc_voice_p')) localStorage.removeItem(k); });
  await p.reload();
  await p.getByTestId('voice-pill').click();
  const panel = p.getByTestId('voice-panel');
  await expect(panel).toBeVisible();
  await p.screenshot({ path: path.join(SHOTS, 'task3-voice-original-position.png') });
  const start = await box(panel);

  // start a conversation (fake microphone) and keep it running while we move things
  await panel.getByRole('button', { name: /Start conversation/ }).click();
  await expect(p.getByTestId('voice-status')).toHaveText('Listening', { timeout: 15_000 });
  const statusBefore = await p.getByTestId('voice-status').innerText();

  const header = p.getByTestId('voice-header');
  await dragBy(p, header.locator('[data-drag-handle]').first(), 300, -250); // right + up
  let b = await box(panel);
  expect(b.x).toBeGreaterThan(start.x + 200);
  expect(b.y).toBeLessThan(start.y - 150);
  await dragBy(p, p.getByTestId('voice-move'), -200, 200); // left + down using the Move button
  const b2 = await box(panel);
  expect(b2.x).toBeLessThan(b.x - 150);
  expect(b2.y).toBeGreaterThan(b.y + 150);
  await expect(p.getByTestId('voice-announce')).toHaveText('Voice assistant moved');
  // far beyond the edges: clamped inside the viewport
  await dragBy(p, header.locator('[data-drag-handle]').first(), 5000, 5000);
  b = await box(panel);
  expect(b.x + b.width).toBeLessThanOrEqual(1366);
  expect(b.y + b.height).toBeLessThanOrEqual(900);
  await dragBy(p, header.locator('[data-drag-handle]').first(), -5000, -5000);
  b = await box(panel);
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeGreaterThanOrEqual(0);
  // the conversation was not restarted by moving
  await expect(p.getByTestId('voice-status')).toHaveText(statusBefore);

  // pressing controls does not move the panel
  const before = await box(panel);
  await panel.getByRole('button', { name: 'తెలుగు' }).click();
  await panel.getByRole('button', { name: 'English' }).click();
  expect(await box(panel)).toEqual(before);

  // keyboard: arrows 20 px, Shift 80 px, Home resets
  await dragBy(p, header.locator('[data-drag-handle]').first(), 300, 200);
  const k0 = await box(panel);
  await header.focus();
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('ArrowDown');
  const k1 = await box(panel);
  expect(Math.round(k1.x - k0.x)).toBe(20);
  expect(Math.round(k1.y - k0.y)).toBe(20);
  await p.keyboard.press('Shift+ArrowLeft');
  expect(Math.round((await box(panel)).x - k1.x)).toBe(-80);

  // persistence across reload
  const saved = await box(panel);
  await p.reload();
  await p.getByTestId('voice-pill').click();
  const restored = await box(p.getByTestId('voice-panel'));
  expect(Math.abs(restored.x - saved.x)).toBeLessThan(3);
  expect(Math.abs(restored.y - saved.y)).toBeLessThan(3);
  await p.screenshot({ path: path.join(SHOTS, 'task3-voice-after-drag.png') });

  // reset: Home key, the ↺ button and double-click
  await p.getByTestId('voice-header').focus();
  await p.keyboard.press('Home');
  const r1 = await box(p.getByTestId('voice-panel'));
  expect(Math.abs(r1.x - start.x)).toBeLessThan(3);
  await dragBy(p, p.getByTestId('voice-move'), 200, -200);
  await p.getByTestId('voice-reset').click();
  expect(Math.abs((await box(p.getByTestId('voice-panel'))).y - start.y)).toBeLessThan(3);
  await dragBy(p, p.getByTestId('voice-move'), 200, -200);
  await p.getByTestId('voice-header').locator('p').first().dblclick();
  expect(Math.abs((await box(p.getByTestId('voice-panel'))).x - start.x)).toBeLessThan(3);

  // minimise keeps the header (still draggable) and the conversation; expand again
  await p.getByTestId('voice-minimize').click();
  await expect(p.getByTestId('voice-panel')).toHaveAttribute('data-minimized', 'true');
  expect((await box(p.getByTestId('voice-panel'))).height).toBeLessThan(120);
  await dragBy(p, p.getByTestId('voice-move'), 100, -100);
  await p.getByTestId('voice-minimize').click();
  await expect(p.getByTestId('voice-panel')).toHaveAttribute('data-minimized', 'false');

  // dropping onto the chat button: the panel steps clear of it
  const chat = await box(p.locator('[data-floating-widget="chat"]'));
  const pb = await box(p.getByTestId('voice-panel'));
  await dragBy(p, p.getByTestId('voice-move'), chat.x - pb.x, chat.y - pb.y);
  const after = await box(p.getByTestId('voice-panel'));
  const overlaps = after.x < chat.x + chat.width && after.x + after.width > chat.x && after.y < chat.y + chat.height && after.y + after.height > chat.y;
  expect(overlaps).toBe(false);

  // floating button: drag up and down (no toggle); a tap still opens / closes
  await p.getByTestId('voice-pill').click(); // close
  await expect(p.getByTestId('voice-panel')).toHaveCount(0);
  const pill = p.getByTestId('voice-pill');
  const pb0 = await box(pill);
  await dragBy(p, pill, 0, -250);
  const pb1 = await box(pill);
  expect(pb1.y).toBeLessThan(pb0.y - 150);
  await expect(p.getByTestId('voice-panel')).toHaveCount(0); // dragging did not open it
  await pill.click();
  await expect(p.getByTestId('voice-panel')).toBeVisible();
  await p.reload();
  expect(Math.abs((await box(p.getByTestId('voice-pill'))).y - pb1.y)).toBeLessThan(3);
});

test('mobile 390 px: bottom sheet expands when dragged up and minimises when dragged down', async ({ page: p }) => {
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto('/');
  await p.getByTestId('voice-pill').click();
  const panel = p.getByTestId('voice-panel');
  await expect(panel).toBeVisible();
  const b = await box(panel);
  expect(Math.round(b.x)).toBe(0);
  expect(Math.round(b.width)).toBe(390);
  expect(Math.round(b.y + b.height)).toBeGreaterThanOrEqual(840);
  await p.screenshot({ path: path.join(SHOTS, 'task3-voice-mobile-bottom-sheet.png') });
  const handle = p.getByTestId('voice-header');
  await dragBy(p, handle.locator('p').first(), 0, 120); // down → minimise
  await expect(panel).toHaveAttribute('data-minimized', 'true');
  await dragBy(p, handle.locator('p').first(), 0, -120); // up → expand
  await expect(panel).toHaveAttribute('data-minimized', 'false');
  await expect(panel.getByRole('button', { name: /Start conversation/ })).toBeVisible();
  // Telugu labels on the controls
  await panel.getByRole('button', { name: 'తెలుగు' }).click();
  await expect(p.getByTestId('voice-move')).toHaveAttribute('aria-label', 'వాయిస్ అసిస్టెంట్‌ను కదిలించండి');
});
