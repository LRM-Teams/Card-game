import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/previews/lrm-518-live');

test.describe.configure({ mode: 'serial' });

test('LRM-518 narrative pixel game scene wires assets', async ({ page }) => {
  await page.goto('/fx-demo?scene=turn');
  await expect(page.locator('.np-game[data-theme="narrative-pixel"]')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('.np-scene-elements[data-scene="game"]')).toBeVisible();
  const npCount = await page.locator('img[src*="/narrative-pixel/"]').count();
  expect(npCount).toBeGreaterThan(0);
  const wallSrc = await page.locator('.np-game__layer--wall').getAttribute('src');
  expect(wallSrc).toContain('/narrative-pixel/scene/layer-indoor-wall');
});

test('LRM-518 narrative game — 1920×1080 + 390×844 no vertical scroll', async ({ browser }) => {
  fs.mkdirSync(outDir, { recursive: true });

  for (const [name, vp] of [
    ['01-game-1920x1080.png', { width: 1920, height: 1080 }],
    ['02-game-390x844.png', { width: 390, height: 844 }],
  ] as const) {
    const ctx = await browser.newContext({ viewport: vp });
    const p = await ctx.newPage();
    await p.goto('/fx-demo?scene=turn');
    await expect(p.locator('.np-game[data-theme="narrative-pixel"]')).toBeVisible({ timeout: 15_000 });
    await p.waitForTimeout(800);
    const scroll = await p.evaluate(() => ({
      docH: document.documentElement.scrollHeight,
      winH: window.innerHeight,
    }));
    expect(scroll.docH).toBeLessThanOrEqual(scroll.winH + 2);
    await p.screenshot({ path: path.join(outDir, name), fullPage: false });
    await ctx.close();
  }
});
