import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/previews/lrm-209');

test.describe.configure({ mode: 'serial' });

test('LRM-209 timer danger + playFly screenshots', async ({ page }) => {
  fs.mkdirSync(outDir, { recursive: true });

  await page.goto('/fx-demo?scene=timer');
  await expect(page.locator('[data-fx="timer"]')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: '3s 红脉冲' }).click();
  await expect(page.locator('.turn-timer.danger')).toBeVisible();
  await expect(page.locator('[data-timer-danger="1"]')).toBeVisible();
  await page.waitForTimeout(700);
  await page.locator('[data-fx="timer"]').screenshot({
    path: path.join(outDir, '01-timer-danger-pulse.png'),
  });

  await page.goto('/fx-demo?scene=playFly');
  await expect(page.locator('[data-fx="playFly"]')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: '重播出牌飞入' }).click();
  await page.waitForTimeout(180);
  await page.locator('[data-fx="playFly"]').screenshot({
    path: path.join(outDir, '02-play-fly-mid.png'),
  });
  await page.waitForTimeout(200);
  await page.locator('[data-fx="playFly"]').screenshot({
    path: path.join(outDir, '03-play-fly-settled.png'),
  });
});
