import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/previews/lrm-522-live');
const livePort = process.env.E2E_PORT ?? '3099';
const BASE =
  process.env.E2E_BASE_URL ?? process.env.FX_BASE_URL ?? `http://127.0.0.1:${livePort}`;

test('LRM-522 settle live — 1920 + 390 narrative assets visible', async ({ browser }) => {
  fs.mkdirSync(outDir, { recursive: true });

  for (const [name, vp] of [
    ['settle-live-1920x1080.png', { width: 1920, height: 1080 }],
    ['settle-live-390x844.png', { width: 390, height: 844 }],
  ] as const) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/fx-demo?scene=settle`);
    await expect(page.locator('.np-game[data-theme="narrative-pixel"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('.result-title')).toBeVisible();
    await expect(page.locator('.np-settle-fx-stamps img')).toHaveCount(3);
    await expect(page.locator('.result-badge')).toHaveAttribute(
      'src',
      /narrative-pixel\/settle\/victory_illustration/,
    );
    await expect(page.getByRole('button', { name: '再来一局' })).toBeVisible();
    const scroll = await page.evaluate(() => ({
      docH: document.documentElement.scrollHeight,
      winH: window.innerHeight,
    }));
    expect(scroll.docH).toBeLessThanOrEqual(scroll.winH + 2);
    await page.screenshot({ path: path.join(outDir, name), fullPage: false });
    await ctx.close();
  }
});
