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

test('LRM-579 game elements redraw — clean dual viewport shots', async ({ browser }) => {
  fs.mkdirSync(outDir, { recursive: true });

  for (const [scene, fileBase, btn] of [
    ['cards', 'game-cards', '对手牌背'],
    ['turn', 'game-play', '出牌'],
    ['settle', 'game-settle', '再来一局'],
  ] as const) {
    for (const [suffix, vp] of [
      ['1920x1080', { width: 1920, height: 1080 }],
      ['390x844', { width: 390, height: 844 }],
    ] as const) {
      const ctx = await browser.newContext({ viewport: vp });
      const p = await ctx.newPage();
      await seedSkipGuide(p);
      await p.goto(`/fx-demo?scene=${scene}&clean=1`);
      await expect(p.locator('.np-game[data-theme="narrative-pixel"]')).toBeVisible({
        timeout: 15_000,
      });
      await expect(p.locator('.fx-demo[data-clean="1"]')).toBeVisible();
      await expect(p.locator('.fx-demo-bar')).toBeHidden();
      if (scene === 'cards') {
        await expect(p.locator('img.card-back-art, img.card-front-art').first()).toBeVisible();
      } else if (scene === 'settle') {
        await expect(p.getByRole('button', { name: '再来一局', exact: true })).toBeVisible();
      } else {
        await expect(p.getByRole('button', { name: '出牌', exact: true })).toBeVisible();
      }
      await p.waitForTimeout(500);
      // 只截对局视口，避免顶栏/页脚「乱码感」
      const vpEl = p.locator('.np-game__viewport');
      await vpEl.screenshot({ path: path.join(outDir, `${fileBase}-${suffix}.png`) });
      await ctx.close();
    }
  }
});
