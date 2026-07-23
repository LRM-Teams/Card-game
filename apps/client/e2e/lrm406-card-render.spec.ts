import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/previews/lrm-406');

test.describe.configure({ mode: 'serial' });

test('LRM-406 card glyphs stay inside card bounds', async ({ page }) => {
  await page.goto('/fx-demo?scene=cards');
  await expect(page.locator('[data-fx="cards"]')).toBeVisible({ timeout: 15_000 });
  const within = await page.evaluate(() => {
    const cards = document.querySelectorAll('.hand .card, .last-cards .card, .result-reveal-cards .card');
    return Array.from(cards).every((card) => {
      const cr = card.getBoundingClientRect();
      return Array.from(card.querySelectorAll('.card-corner, .card-suit-center')).every((el) => {
        const r = el.getBoundingClientRect();
        return r.top >= cr.top - 1 && r.bottom <= cr.bottom + 1 && r.left >= cr.left - 1 && r.right <= cr.right + 1;
      });
    });
  });
  expect(within).toBe(true);
});

test('LRM-406 card render screenshots — 1080p + 390×844', async ({ browser }) => {
  fs.mkdirSync(outDir, { recursive: true });

  for (const [name, viewport] of [
    ['01-cards-hand-1920x1080.png', { width: 1920, height: 1080 }],
    ['02-cards-hand-390x844.png', { width: 390, height: 844 }],
  ] as const) {
    const ctx = await browser.newContext({ viewport });
    const p = await ctx.newPage();
    await p.goto('/fx-demo?scene=cards');
    await expect(p.locator('[data-fx="cards"]')).toBeVisible({ timeout: 15_000 });
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(outDir, name), fullPage: false });
    await ctx.close();
  }
});
