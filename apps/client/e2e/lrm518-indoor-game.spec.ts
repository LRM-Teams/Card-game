import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/previews/lrm-518');

test.describe.configure({ mode: 'serial' });

test('LRM-518 indoor scene layers load on game demo', async ({ page }) => {
  await page.goto('/fx-demo?scene=turn');
  await expect(page.locator('.np-game[data-theme="narrative-pixel-indoor"]')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('.np-game__layer--wall')).toHaveAttribute(
    'src',
    /layer-wall-1920x1080/,
  );
  await expect(page.locator('[data-fx="turn"]')).toBeVisible();
});

test('LRM-518 indoor game — 1920×1080 + 390×844 no vertical scroll', async ({ browser }) => {
  fs.mkdirSync(outDir, { recursive: true });

  for (const [name, vp] of [
    ['01-indoor-turn-1920x1080.png', { width: 1920, height: 1080 }],
    ['02-indoor-turn-390x844.png', { width: 390, height: 844 }],
  ] as const) {
    const ctx = await browser.newContext({ viewport: vp });
    const p = await ctx.newPage();
    await p.goto('/fx-demo?scene=turn');
    await p.waitForSelector('.np-game__layer--wall', { timeout: 15_000 });
    await p.waitForTimeout(500);
    const scroll = await p.evaluate(() => ({
      docH: document.documentElement.scrollHeight,
      winH: window.innerHeight,
    }));
    expect(scroll.docH).toBeLessThanOrEqual(scroll.winH + 2);
    await p.screenshot({ path: path.join(outDir, name), fullPage: false });
    await ctx.close();
  }
});
