import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/previews/lrm-199');

async function waitDealSettled(page: import('@playwright/test').Page) {
  await expect(page.locator('.hand.is-dealing')).toHaveCount(0, { timeout: 5_000 });
  await page.waitForTimeout(50);
}

test.describe('LRM-199 play does not remount whole hand', () => {
  test('出牌后未打出牌 DOM 节点保持，且不重触 is-dealing', async ({ page }) => {
    fs.mkdirSync(outDir, { recursive: true });
    await page.goto('/fx-demo?scene=select');
    await expect(page.locator('[data-fx="select"]')).toBeVisible({ timeout: 15_000 });
    await waitDealSettled(page);

    const beforeCount = await page.locator('.hand .card').count();
    expect(beforeCount).toBeGreaterThan(3);

    // 记录未选中牌的 DOM 身份，出牌后应仍是同一节点（按 data-card-id，display 不唯一）
    const keepIds = await page.evaluate(() => {
      const map = new Map<string, Element>();
      document.querySelectorAll('.hand .card:not(.is-selected)').forEach((el) => {
        const id = el.getAttribute('data-card-id');
        if (id) map.set(id, el);
      });
      (window as unknown as { __lrm199Keep: Map<string, Element> }).__lrm199Keep = map;
      return [...map.keys()];
    });
    expect(keepIds.length).toBeGreaterThan(0);

    const selectedCount = await page.locator('.hand .card.is-selected').count();
    expect(selectedCount).toBe(3);

    await page.locator('[data-fx="select"]').screenshot({
      path: path.join(outDir, 'before-play.png'),
    });

    await page.locator('[data-play-hand]').click();

    // 关键：不得因张数变化重触发牌动效
    await expect(page.locator('.hand.is-dealing')).toHaveCount(0);
    await page.waitForTimeout(200);
    await expect(page.locator('.hand.is-dealing')).toHaveCount(0);

    await expect(page.locator('.hand .card')).toHaveCount(beforeCount - selectedCount);

    const remounted = await page.evaluate(() => {
      const keep = (window as unknown as { __lrm199Keep: Map<string, Element> }).__lrm199Keep;
      const bad: string[] = [];
      document.querySelectorAll('.hand .card').forEach((el) => {
        const id = el.getAttribute('data-card-id');
        if (!id) return;
        const prev = keep.get(id);
        if (prev && prev !== el) bad.push(id);
      });
      return bad;
    });
    expect(remounted, `未打出牌被 remount: ${remounted.join(',')}`).toEqual([]);

    // 连续第二手：再选两张出，剩余仍不 remount
    const first = page.locator('.hand .card').nth(0);
    const second = page.locator('.hand .card').nth(1);
    await page.evaluate(() => {
      const map = new Map<string, Element>();
      document.querySelectorAll('.hand .card').forEach((el) => {
        const id = el.getAttribute('data-card-id');
        if (id) map.set(id, el);
      });
      (window as unknown as { __lrm199Keep2: Map<string, Element> }).__lrm199Keep2 = map;
    });
    await first.click();
    await second.click();
    await expect(page.locator('.hand .card.is-selected')).toHaveCount(2);
    const countBeforeSecond = await page.locator('.hand .card').count();
    await page.locator('[data-play-hand]').click();
    await expect(page.locator('.hand.is-dealing')).toHaveCount(0);

    const remounted2 = await page.evaluate(() => {
      const keep = (window as unknown as { __lrm199Keep2: Map<string, Element> }).__lrm199Keep2;
      const bad: string[] = [];
      document.querySelectorAll('.hand .card').forEach((el) => {
        const id = el.getAttribute('data-card-id');
        if (!id) return;
        const prev = keep.get(id);
        if (prev && prev !== el) bad.push(id);
      });
      return bad;
    });
    expect(remounted2).toEqual([]);
    await expect(page.locator('.hand .card')).toHaveCount(countBeforeSecond - 2);
    await page.locator('[data-fx="select"]').screenshot({
      path: path.join(outDir, 'after-play.png'),
    });
  });
});
