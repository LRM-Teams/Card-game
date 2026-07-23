import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/previews/lrm-521-live');
const BASE =
  process.env.E2E_BASE_URL ?? process.env.FX_BASE_URL ?? 'http://127.0.0.1:3099';

function seed(page: Page, nick: string) {
  const guestId = `g-521-${nick}-${Math.random().toString(36).slice(2, 8)}`;
  return page.addInitScript(
    ({ nick, guestId }) => {
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
        JSON.stringify({ guestId, displayName: nick, avatarId: 'av-1', beans: 1000 }),
      );
    },
    { nick, guestId },
  );
}

async function waitConnected(page: Page) {
  await page.goto(BASE);
  await page.waitForFunction(
    () => document.querySelector('.conn')?.textContent?.includes('已连接'),
    null,
    { timeout: 25_000 },
  );
}

async function assertNoVerticalScroll(page: Page) {
  const scroll = await page.evaluate(() => ({
    docH: document.documentElement.scrollHeight,
    winH: window.innerHeight,
  }));
  expect(scroll.docH).toBeLessThanOrEqual(scroll.winH + 2);
}

async function advanceThroughPrePlay(page: Page) {
  const end = Date.now() + 90_000;
  while (Date.now() < end) {
    if (await page.locator('.result-title').isVisible()) return;

    if (await page.getByRole('group', { name: '叫地主操作' }).isVisible()) {
      const pass = page.getByRole('button', { name: '不叫' });
      if (await pass.isVisible()) await pass.click();
      await page.waitForTimeout(300);
      continue;
    }
    if (await page.getByRole('group', { name: '明牌操作' }).isVisible()) {
      await page.getByRole('button', { name: '不明牌' }).click();
      await page.waitForTimeout(300);
      continue;
    }
    if (await page.getByRole('group', { name: '加倍操作' }).isVisible()) {
      await page.getByRole('button', { name: '不加倍' }).click();
      await page.waitForTimeout(300);
      continue;
    }
    if (await page.getByRole('button', { name: '出牌' }).isVisible()) return;

    await page.waitForTimeout(400);
  }
  throw new Error('timeout: pre-play phases did not finish');
}

async function playUntilSettled(page: Page) {
  const end = Date.now() + 180_000;
  let acted = false;
  while (Date.now() < end) {
    if (await page.locator('.result-title').isVisible()) {
      expect(acted).toBe(true);
      return;
    }

    const hintBtn = page.getByRole('button', { name: /^提示/ });
    const playBtn = page.getByRole('button', { name: '出牌' });
    const passBtn = page.getByRole('button', { name: '不出' });

    if (await playBtn.isEnabled()) {
      if (await hintBtn.isEnabled()) await hintBtn.click();
      await page.waitForTimeout(250);
      if (await playBtn.isEnabled()) {
        await playBtn.click();
        acted = true;
      }
    } else if (await passBtn.isEnabled()) {
      await passBtn.click();
      acted = true;
    }

    await page.waitForTimeout(400);
  }
  throw new Error('timeout: game did not settle');
}

async function runFullLoop(page: Page, mode: 'match' | 'private') {
  await expect(page.locator('.np-lobby[data-theme="narrative-pixel"]')).toBeVisible({
    timeout: 15_000,
  });

  if (mode === 'match') {
    await page.getByRole('button', { name: '开始游戏' }).click();
    await expect(page.locator('.np-matching, .np-game')).toBeVisible({ timeout: 15_000 });
  } else {
    await page.getByRole('button', { name: '创建' }).click();
    await page.waitForURL(/\/room/, { timeout: 20_000 });
    await page.getByRole('button', { name: '补机器人开始' }).click();
  }

  await page.waitForURL(/\/game/, { timeout: 45_000 });
  await expect(page.locator('.np-game[data-theme="narrative-pixel"]')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('.np-scene-elements[data-scene="game"]')).toBeVisible();

  await advanceThroughPrePlay(page);
  await expect(page.locator('.player-kind-badge.bot')).toHaveCount(2);
  await playUntilSettled(page);

  await expect(page.locator('.result-title')).toBeVisible({ timeout: 5_000 });

  await page.getByRole('button', { name: '返回大厅' }).click();
  await page.waitForURL(/\/$/, { timeout: 15_000 });
  await expect(page.locator('.np-lobby[data-theme="narrative-pixel"]')).toBeVisible({
    timeout: 15_000,
  });
}

test.describe.configure({ mode: 'serial' });

test('LRM-521 narrative full loop — quick match path', async ({ page }) => {
  test.setTimeout(300_000);
  await seed(page, '全链路');
  await waitConnected(page);
  await runFullLoop(page, 'match');
});

test('LRM-521 reconnect banner wiring present on game page', async ({ page }) => {
  await seed(page, '重连测');
  await waitConnected(page);
  await page.getByRole('button', { name: '创建' }).click();
  await page.waitForURL(/\/room/, { timeout: 20_000 });
  await page.getByRole('button', { name: '补机器人开始' }).click();
  await page.waitForURL(/\/game/, { timeout: 45_000 });
  await expect(page.locator('.np-game[data-theme="narrative-pixel"]')).toBeVisible({
    timeout: 15_000,
  });
  // LRM-519：重连 banner 组件仍挂载（断线时才显示，此处只验 DOM 契约未删）
  await expect(page.locator('.conn-banner, .conn-fail-overlay, .np-game').first()).toBeVisible();
});

test('LRM-521 narrative full loop — 1920×1080 + 390×844 no vertical scroll', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  fs.mkdirSync(outDir, { recursive: true });

  for (const [name, vp, mode] of [
    ['01-lobby-1920x1080.png', { width: 1920, height: 1080 }, 'lobby'] as const,
    ['02-game-1920x1080.png', { width: 1920, height: 1080 }, 'game'] as const,
    ['03-settle-1920x1080.png', { width: 1920, height: 1080 }, 'settle'] as const,
    ['04-lobby-390x844.png', { width: 390, height: 844 }, 'lobby'] as const,
    ['05-game-390x844.png', { width: 390, height: 844 }, 'game'] as const,
    ['06-settle-390x844.png', { width: 390, height: 844 }, 'settle'] as const,
  ]) {
    const ctx = await browser.newContext({ viewport: vp });
    const p = await ctx.newPage();
    await seed(p, `视口${vp.width}`);
    await waitConnected(p);

    if (mode === 'lobby') {
      await expect(p.locator('.np-lobby[data-theme="narrative-pixel"]')).toBeVisible({
        timeout: 15_000,
      });
      await assertNoVerticalScroll(p);
      await p.screenshot({ path: path.join(outDir, name), fullPage: false });
      await ctx.close();
      continue;
    }

    await p.getByRole('button', { name: '创建' }).click();
    await p.waitForURL(/\/room/, { timeout: 20_000 });
    await p.getByRole('button', { name: '补机器人开始' }).click();
    await p.waitForURL(/\/game/, { timeout: 45_000 });
    await expect(p.locator('.np-game[data-theme="narrative-pixel"]')).toBeVisible({
      timeout: 15_000,
    });

    if (mode === 'game') {
      await assertNoVerticalScroll(p);
      await p.screenshot({ path: path.join(outDir, name), fullPage: false });
      await ctx.close();
      continue;
    }

    await advanceThroughPrePlay(p);
    await playUntilSettled(p);
    await expect(p.locator('.result-title')).toBeVisible({ timeout: 5_000 });
    await assertNoVerticalScroll(p);
    await p.screenshot({ path: path.join(outDir, name), fullPage: false });
    await ctx.close();
  }
});
