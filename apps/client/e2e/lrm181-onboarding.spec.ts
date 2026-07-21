import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/previews/lrm-181');

const scenes = ['identity', 'start', 'bid', 'play', 'settings'] as const;

test.describe.configure({ mode: 'serial' });

test('LRM-181 lobby skip persists across reload', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('ddz_onboarding_v1'));
  await page.reload();
  await expect(page.getByText('先起个昵称、选个头像')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: '跳过' }).click();
  await expect(page.getByText('先起个昵称、选个头像')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('先起个昵称、选个头像')).toHaveCount(0);
});

test('LRM-181 settings reset restores lobby guide', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem(
      'ddz_onboarding_v1',
      JSON.stringify({
        skipped: true,
        seenIdentityTip: true,
        seenStartTip: true,
        seenBidTip: true,
        seenPlayTip: true,
      }),
    );
  });
  await page.reload();
  await expect(page.getByText('先起个昵称、选个头像')).toHaveCount(0);
  await page.getByTitle(/声音设置|已静音/).click();
  await page.getByRole('button', { name: '重置新手引导' }).click();
  await expect(page.getByText('先起个昵称、选个头像')).toBeVisible({ timeout: 10_000 });
});

for (const scene of scenes) {
  test(`LRM-181 preview ${scene}`, async ({ page }) => {
    fs.mkdirSync(outDir, { recursive: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/onboarding-demo?scene=${scene}`);
    await expect(page.locator(`[data-onboarding-scene="${scene}"]`)).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(outDir, `${scene}.png`),
      fullPage: true,
    });
  });
}
