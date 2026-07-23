import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/previews/lrm-417-live');

test.describe.configure({ mode: 'serial' });

test('LRM-417 narrative pixel lobby wires assets', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.np-lobby[data-theme="narrative-pixel"]')).toBeVisible({
    timeout: 15_000,
  });
  const npCount = await page.locator('img[src*="/narrative-pixel/"]').count();
  expect(npCount).toBeGreaterThan(0);
});

test('LRM-417 narrative lobby — 1920×1080 + 390×844', async ({ browser }) => {
  fs.mkdirSync(outDir, { recursive: true });

  for (const [name, vp] of [
    ['01-lobby-1920x1080.png', { width: 1920, height: 1080 }],
    ['02-lobby-390x844.png', { width: 390, height: 844 }],
  ] as const) {
    const ctx = await browser.newContext({ viewport: vp });
    const p = await ctx.newPage();
    await p.goto('/');
    await p.waitForTimeout(800);
    const scroll = await p.evaluate(() => ({
      docH: document.documentElement.scrollHeight,
      winH: window.innerHeight,
    }));
    if (vp.width === 1920) {
      expect(scroll.docH).toBeLessThanOrEqual(scroll.winH + 2);
    }
    await p.screenshot({ path: path.join(outDir, name), fullPage: false });
    await ctx.close();
  }
});
