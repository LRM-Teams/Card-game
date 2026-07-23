import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/previews/lrm-466');

test.describe.configure({ mode: 'serial' });

test('LRM-466 disconnect shows tv_screen_error', async ({ page }) => {
  await page.goto('/?npDemo=disconnect');
  await expect(page.locator('.np-lobby--disconnected')).toBeVisible();
  await expect(page.locator('.np-hotspot--tv img')).toHaveAttribute(
    'src',
    /tv_screen_error/,
  );
  await expect(page.locator('.np-tv-error-label')).toHaveText('未连接');
  await expect(page.getByRole('button', { name: '开始游戏' })).toBeVisible();
});

test('LRM-466 API error shows ui_error_stamp', async ({ page }) => {
  await page.goto('/?npDemo=api');
  await expect(page.locator('.np-error-stamp')).toBeVisible();
  await expect(page.locator('.np-error-stamp')).toHaveAttribute('src', /ui_error_stamp/);
  const label = await page.locator('.np-error-stamp__label').textContent();
  expect((label ?? '').length).toBeLessThanOrEqual(12);
});

test('LRM-466 lobby uses pixel error wiring (no text status bar)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.np-lobby[data-theme="narrative-pixel"]')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('.np-status-bar')).toHaveCount(0);

  const tv = page.locator('.np-hotspot--tv img.np-hotspot__frame');
  await expect(tv).toBeVisible();
  const tvSrc = await tv.getAttribute('src');
  expect(tvSrc).toMatch(/\/narrative-pixel\/ui\/states\/tv_screen_/);

  await expect(page.locator('.np-btn-tv')).toBeVisible();
});

test('LRM-466 ui_error_stamp asset is published', async ({ request }) => {
  const res = await request.get('/narrative-pixel/ui/states/ui_error_stamp.png');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/image/);
});

test('LRM-466 error states — 1920×1080 + 390×844', async ({ browser }) => {
  fs.mkdirSync(outDir, { recursive: true });

  for (const [scene, file] of [
    ['disconnect', '01-error-disconnect-1920x1080.png'],
    ['api', '02-error-api-1920x1080.png'],
  ] as const) {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const p = await ctx.newPage();
    await p.goto(`/?npDemo=${scene}`);
    await p.waitForTimeout(600);
    await p.screenshot({ path: path.join(outDir, file), fullPage: false });
    await ctx.close();
  }

  for (const [scene, file] of [
    ['disconnect', '03-error-disconnect-390x844.png'],
    ['api', '04-error-api-390x844.png'],
  ] as const) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.goto(`/?npDemo=${scene}`);
    await p.waitForTimeout(600);
    await p.screenshot({ path: path.join(outDir, file), fullPage: false });
    await ctx.close();
  }
});
