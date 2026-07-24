import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/previews/lrm-579');

test.describe.configure({ mode: 'serial' });

test('LRM-579 lobby uses locked v3 bake — dual viewport screenshots', async ({ browser }) => {
  fs.mkdirSync(outDir, { recursive: true });

  for (const [name, vp] of [
    ['lobby-live-1920x1080.png', { width: 1920, height: 1080 }],
    ['lobby-live-390x844.png', { width: 390, height: 844 }],
  ] as const) {
    const ctx = await browser.newContext({ viewport: vp });
    const p = await ctx.newPage();
    await p.goto('/');
    await expect(p.locator('.np-lobby[data-theme="narrative-pixel"]')).toBeVisible({
      timeout: 15_000,
    });
    const full = p.locator('img.np-lobby__layer--full');
    await expect(full).toBeVisible();
    const src = await full.getAttribute('src');
    expect(src).toContain('scene-full-1920x1080.png');
    await p.waitForTimeout(600);
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
