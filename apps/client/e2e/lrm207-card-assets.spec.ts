import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/previews/lrm-207');

test('LRM-207 card assets fx-demo screenshots', async ({ page }) => {
  fs.mkdirSync(outDir, { recursive: true });
  await page.goto('/fx-demo?scene=cards');
  await expect(page.locator('[data-fx="cards"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.opponent-back-fan .card.is-face-down').first()).toBeVisible();
  await expect(page.locator('.card-joker-art').first()).toBeVisible();
  await expect(page.locator('.card.is-unplayable')).toBeVisible();
  await page.locator('[data-fx="cards"]').screenshot({
    path: path.join(outDir, '01-cards-hand-play-backs.png'),
  });
  await page.locator('.hand').screenshot({
    path: path.join(outDir, '02-hand-selected.png'),
  });
  await page.locator('.opponent-back-fan').first().screenshot({
    path: path.join(outDir, '03-opponent-backs.png'),
  });
});
