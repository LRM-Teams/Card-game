import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/previews/lrm-579');

/** Skip onboarding so 390 viewport is not covered by guide overlay (AC#2). */
async function seedSkipGuide(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'ddz_onboarding_v1',
      JSON.stringify({
        skipped: true,
        seenIdentity: true,
        seenStart: true,
        seenBidTip: true,
        seenPlayTip: true,
      }),
    );
    localStorage.setItem(
      'ddz_guest_identity',
      JSON.stringify({
        guestId: 'g-579-preview',
        displayName: '预览客',
        avatarId: 'av-1',
        beans: 1000,
      }),
    );
  });
}

test.describe.configure({ mode: 'serial' });

test('LRM-579 lobby uses locked v3 bake — dual viewport screenshots', async ({ browser }) => {
  fs.mkdirSync(outDir, { recursive: true });

  for (const [name, vp] of [
    ['lobby-live-1920x1080.png', { width: 1920, height: 1080 }],
    ['lobby-live-390x844.png', { width: 390, height: 844 }],
  ] as const) {
    const ctx = await browser.newContext({ viewport: vp });
    const p = await ctx.newPage();
    await seedSkipGuide(p);
    await p.goto('/');
    await expect(p.locator('.np-lobby[data-theme="narrative-pixel"]')).toBeVisible({
      timeout: 15_000,
    });
    // Guide must not cover the lobby for AC#2 (esp. 390).
    await expect(p.getByRole('button', { name: '跳过引导' })).toHaveCount(0);
    await expect(p.locator('.guide-bubble')).toHaveCount(0);
    const full = p.locator('img.np-lobby__layer--full');
    await expect(full).toBeVisible();
    const src = await full.getAttribute('src');
    expect(src).toContain('scene-full-1920x1080.png');
    await expect(p.getByRole('button', { name: '开始游戏' })).toBeVisible();
    await expect
      .poll(async () => full.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await p.waitForTimeout(600);
    const metrics = await p.evaluate(() => {
      const viewport = document.querySelector('.np-lobby__viewport');
      const r = viewport?.getBoundingClientRect();
      return {
        docH: document.documentElement.scrollHeight,
        winH: window.innerHeight,
        vpH: r?.height ?? 0,
        vpW: r?.width ?? 0,
      };
    });
    if (vp.width === 1920) {
      expect(metrics.docH).toBeLessThanOrEqual(metrics.winH + 2);
    }
    if (vp.width === 390) {
      // Scene must fill most of the phone viewport — not a thin 16:9 strip over gray body.
      expect(metrics.vpH).toBeGreaterThan(metrics.winH * 0.7);
      expect(metrics.vpW).toBeGreaterThan(metrics.winH * 0.4);
    }
    await p.screenshot({ path: path.join(outDir, name), fullPage: false });
    await ctx.close();
  }
});
