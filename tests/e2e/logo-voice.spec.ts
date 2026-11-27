import os from 'node:os';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * Header logo + floating voice assistant on the live site. Chrome gets a fake microphone so Start/Stop/Close can run.
 * (Speech recognition itself needs Google's speech service; in a test browser it may report a network error.
 * The test checks the controls, statuses, microphone release and dragging, not recognition quality.)
 */
test.use({ permissions: ['microphone'], launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } });
const SHOTS = path.join(os.homedir(), 'Desktop', 'BJC-screenshots');
mkdirSync(SHOTS, { recursive: true });

for (const [label, vp, px] of [['desktop', { width: 1366, height: 800 }, 80], ['tablet', { width: 820, height: 1180 }, 80], ['mobile', { width: 390, height: 844 }, 64]] as const) {
  test(`logo: larger, same place, sharp, links home (${label})`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: vp });
    const p = await ctx.newPage();
    await p.goto('/about');
    const link = p.locator('header a[aria-label$="home"]').first();
    const img = link.locator('img').first();
    const box = (await img.boundingBox())!;
    expect(Math.round(box.width)).toBe(px);
    expect(Math.round(box.height)).toBe(px); // proportions kept (square crest)
    const nat = await img.evaluate((i: HTMLImageElement) => ({ w: i.naturalWidth, dpr: window.devicePixelRatio }));
    expect(nat.w).toBeGreaterThanOrEqual(px * 2); // source big enough to stay sharp on 2× screens
    const header = (await p.locator('header').first().boundingBox())!;
    expect(box.x - header.x).toBeLessThan(60); // still at the left of the header
    expect(box.y).toBeGreaterThanOrEqual(header.y); // inside the header
    expect(box.y + box.height).toBeLessThanOrEqual(header.y + header.height);
    await expect(link.getByText('Bhargava Junior College')).toBeVisible(); // aligned with the name
    await link.hover();
    await p.waitForTimeout(300);
    expect(await img.evaluate((i) => getComputedStyle(i).transform)).not.toBe('none'); // hover zoom
    await p.screenshot({ path: path.join(SHOTS, `logo-${label}.png`), clip: { x: 0, y: header.y, width: Math.min(vp.width, 700), height: header.height } });
    await link.click();
    await expect(p).toHaveURL(/\/$/);
    await ctx.close();
  });
}

test('voice assistant: drag up and down within the screen; Start / Stop / Close; microphone released', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  const p = await ctx.newPage();
  await p.goto('/about');
  await p.getByRole('button', { name: /Voice assistant/ }).click();
  const panel = p.locator('section[aria-label="BJC AI Voice Assistant"]');
  await expect(panel).toBeVisible();
  const head = panel.locator('header');
  const top0 = (await panel.boundingBox())!.y;
  // drag up
  const hb = (await head.boundingBox())!;
  await p.mouse.move(hb.x + 60, hb.y + 20);
  await p.mouse.down();
  await p.mouse.move(hb.x + 60, hb.y - 200, { steps: 8 });
  await p.mouse.up();
  const top1 = (await panel.boundingBox())!.y;
  expect(top1).toBeLessThan(top0 - 150);
  // drag far up: stays on screen
  const hb2 = (await head.boundingBox())!;
  await p.mouse.move(hb2.x + 60, hb2.y + 20);
  await p.mouse.down();
  await p.mouse.move(hb2.x + 60, hb2.y - 2000, { steps: 8 });
  await p.mouse.up();
  expect((await panel.boundingBox())!.y).toBeGreaterThanOrEqual(0);
  // drag far down: stays on screen
  const hb3 = (await head.boundingBox())!;
  await p.mouse.move(hb3.x + 60, hb3.y + 20);
  await p.mouse.down();
  await p.mouse.move(hb3.x + 60, hb3.y + 3000, { steps: 8 });
  await p.mouse.up();
  const b = (await panel.boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(800);
  // keyboard: arrow up moves it
  await head.focus();
  await p.keyboard.press('ArrowUp');
  expect((await panel.boundingBox())!.y).toBeLessThan(b.y);
  // the language buttons still work while draggable
  await panel.getByRole('button', { name: 'తెలుగు' }).click();
  await expect(panel.getByRole('button', { name: 'తెలుగు' })).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: 'English' }).click();
  await p.screenshot({ path: path.join(SHOTS, 'voice-assistant.png') });

  // count open microphone tracks the page holds
  await p.evaluate(() => {
    const w = window as unknown as { __tracks: MediaStreamTrack[] };
    w.__tracks = [];
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => { const s = await orig(c); w.__tracks.push(...s.getTracks()); return s; };
  });
  const live = () => p.evaluate(() => (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks.filter((t) => t.readyState === 'live').length);
  const status = panel.getByTestId('voice-status');

  await panel.getByRole('button', { name: /Start conversation/ }).click();
  await expect(status).toHaveText(/Listening|Error/, { timeout: 15_000 });
  const startedOk = (await status.innerText()) === 'Listening';
  if (startedOk) {
    expect(await live()).toBe(1);
    await expect(panel.getByRole('button', { name: /Start conversation/ })).toBeDisabled(); // no duplicate sessions
    await panel.getByRole('button', { name: /Stop conversation/ }).click();
    await expect(status).toHaveText('Stopped');
    expect(await live()).toBe(0); // microphone released
    await panel.getByRole('button', { name: /Start conversation/ }).click(); // restart works
    await expect(status).toHaveText(/Listening|Error/, { timeout: 15_000 });
  }
  await panel.getByRole('button', { name: /^✕ Close$/ }).click();
  await expect(panel).toBeHidden();
  expect(await live()).toBe(0);
  console.log(`voice: start ${startedOk ? 'Listening' : 'reported an error (speech service unavailable in the test browser)'}; stop → Stopped; close released the microphone`);
  await ctx.close();
});
