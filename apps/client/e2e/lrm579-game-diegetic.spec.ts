import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/previews/lrm-579-game');

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
  });
}

test.describe.configure({ mode: 'serial' });

test('LRM-579 game diegetic UI — turn + reveal dual viewport', async ({ browser }) => {
  fs.mkdirSync(outDir, { recursive: true });

  for (const [scene, fileBase] of [
    ['turn', 'game-play'],
    ['reveal', 'game-bid'],
  ] as const) {
    for (const [suffix, vp] of [
      ['1920x1080', { width: 1920, height: 1080 }],
      ['390x844', { width: 390, height: 844 }],
    ] as const) {
      const ctx = await browser.newContext({ viewport: vp });
      const p = await ctx.newPage();
      await seedSkipGuide(p);
      await p.goto(`/fx-demo?scene=${scene}`);
      await expect(p.locator('.np-game[data-theme="narrative-pixel"]')).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        p.getByRole('button', { name: scene === 'turn' ? '出牌' : '明牌', exact: true }),
      ).toBeVisible();
      await p.waitForTimeout(500);
      await p.screenshot({
        path: path.join(outDir, `${fileBase}-${suffix}.png`),
        fullPage: false,
      });
      await ctx.close();
    }
  }
});
