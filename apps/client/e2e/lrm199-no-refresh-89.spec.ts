import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://82.157.184.89:8088';
const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/assets/previews/lrm-199',
);

test.describe('LRM-199 no full-hand refresh @89', () => {
  test.setTimeout(180_000);

  test('出牌后手牌不带 is-dealing', async ({ page }) => {
    fs.mkdirSync(OUT, { recursive: true });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const skip = page.getByRole('button', { name: '跳过引导' });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    const nick = page.locator('input[placeholder*="名字"]');
    if (await nick.isVisible()) await nick.fill(`烟199-${Date.now().toString(36).slice(-4)}`);
    await page.getByRole('button', { name: /开始游戏|快速开始/ }).click();

    for (let i = 0; i < 36; i++) {
      if (await page.getByRole('button', { name: /^提示/ }).isVisible().catch(() => false)) break;
      for (const n of ['叫地主', '抢地主', '不叫', '不抢', '不明牌', '明牌', '不加倍', '加倍'] as const) {
        const btn = page.getByRole('button', { name: n, exact: n === '明牌' || n === '加倍' });
        if (await btn.first().isVisible().catch(() => false)) {
          try {
            await btn.first().click({ timeout: 600 });
          } catch {
            /* ignore */
          }
          await page.waitForTimeout(280);
        }
      }
      await page.waitForTimeout(300);
    }

    const hint = page.getByRole('button', { name: /^提示/ });
    const pass = page.getByRole('button', { name: '不出' });
    const play = page.getByRole('button', { name: '出牌' });
    await expect(hint.or(pass).or(play).first()).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(1400);
    await expect(page.locator('.hand.is-dealing')).toHaveCount(0);

    const countBefore = await page.locator('.hand .card').count();
    await page.locator('.hand').screenshot({ path: path.join(OUT, '01-89-hand-before-play.png') });

    let played = false;
    for (let i = 0; i < 40; i++) {
      if (await page.locator('.hand.is-dealing').count()) {
        // 出牌过程中若出现 is-dealing 即失败
        throw new Error('出牌回合中误触发 is-dealing（整手刷新）');
      }
      if (await pass.isEnabled().catch(() => false)) {
        await pass.click();
        await page.waitForTimeout(650);
        continue;
      }
      if (await hint.isEnabled().catch(() => false)) {
        await hint.click();
        await page.waitForTimeout(350);
      }
      if (await play.isEnabled().catch(() => false)) {
        const before = await page.locator('.hand .card').count();
        await play.click();
        await page.waitForTimeout(700);
        await expect(page.locator('.hand.is-dealing')).toHaveCount(0);
        const after = await page.locator('.hand .card').count();
        if (after < before) {
          played = true;
          await page.locator('.hand').screenshot({ path: path.join(OUT, '02-89-hand-after-play.png') });
          await page.screenshot({ path: path.join(OUT, '03-89-table-after-play.png'), fullPage: true });
          break;
        }
      }
      await page.waitForTimeout(500);
    }

    expect(played, '应成功打出至少一手').toBeTruthy();
    const countAfter = await page.locator('.hand .card').count();
    expect(countAfter).toBeLessThan(countBefore);
    await expect(page.locator('.hand.is-dealing')).toHaveCount(0);
  });
});
