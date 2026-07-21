import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/previews/lrm-196');

async function waitDealSettled(page: import('@playwright/test').Page) {
  await expect(page.locator('.hand.is-dealing')).toHaveCount(0, { timeout: 5_000 });
  await page.waitForTimeout(50);
}

async function expectLifted(page: import('@playwright/test').Page) {
  // top transition 120ms — wait until selected cards sit clearly above resting ones
  await expect
    .poll(
      async () => {
        const liftedY = await page
          .locator('.hand .card.is-selected')
          .first()
          .evaluate((el) => el.getBoundingClientRect().top);
        const restY = await page
          .locator('.hand .card:not(.is-selected)')
          .first()
          .evaluate((el) => el.getBoundingClientRect().top);
        return restY - liftedY;
      },
      { timeout: 2_000 },
    )
    .toBeGreaterThan(16);
}

test.describe('LRM-196 selected card lift', () => {
  test('hint/select lifts cards; clear drops them', async ({ page }) => {
    fs.mkdirSync(outDir, { recursive: true });
    await page.goto('/fx-demo?scene=select');
    await expect(page.locator('[data-fx="select"]')).toBeVisible({ timeout: 15_000 });

    await waitDealSettled(page);

    const selected = page.locator('.hand .card.is-selected');
    await expect(selected.first()).toBeVisible();
    await expect(selected).toHaveCount(3);
    await expectLifted(page);

    await page.locator('[data-fx="select"]').screenshot({
      path: path.join(outDir, 'select-lifted.png'),
    });

    await page.getByRole('button', { name: '清空' }).click();
    await expect(page.locator('.hand .card.is-selected')).toHaveCount(0);

    await page.locator('[data-fx="select"]').screenshot({
      path: path.join(outDir, 'select-cleared.png'),
    });

    await page.getByRole('button', { name: '重播发牌' }).click();
    await expect(page.locator('.hand.is-dealing')).toHaveCount(1);
    await waitDealSettled(page);
    await page.getByRole('button', { name: '提示 1/3' }).click();
    await expect(page.locator('.hand .card.is-selected')).toHaveCount(3);
    await expectLifted(page);

    await page.locator('[data-fx="select"]').screenshot({
      path: path.join(outDir, 'select-after-deal-hint.png'),
    });
  });
});
