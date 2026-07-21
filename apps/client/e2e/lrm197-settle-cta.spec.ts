import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/previews/lrm-197');

test.describe('LRM-197 settle replay CTA', () => {
  test('再来一局 is a single CTA without nested restart badge', async ({ page }) => {
    fs.mkdirSync(outDir, { recursive: true });
    await page.goto('/fx-demo?scene=settle');
    await expect(page.locator('[data-fx="settle"]')).toBeVisible({ timeout: 15_000 });

    const replay = page.locator('.result-actions .btn.primary.cta');
    await expect(replay).toBeVisible();
    await expect(replay).toHaveText('再来一局');
    await expect(replay.locator('img')).toHaveCount(0);
    await expect(replay.locator('svg')).toHaveCount(0);

    await replay.screenshot({ path: path.join(outDir, 'after-single-cta.png') });
    await page.locator('.result-card').screenshot({
      path: path.join(outDir, 'after-settle-card.png'),
    });
  });
});
