import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs/assets/fx-demos');

const scenes = [
  { id: 'deal', waitMs: 1600 },
  { id: 'turn', waitMs: 2400 },
  { id: 'bomb', waitMs: 2000 },
  { id: 'settle', waitMs: 1800 },
] as const;

test.describe.configure({ mode: 'serial' });

for (const scene of scenes) {
  test(`LRM-168 record ${scene.id}`, async ({ browser }) => {
    fs.mkdirSync(outDir, { recursive: true });
    const context = await browser.newContext({
      recordVideo: {
        dir: outDir,
        size: { width: 1280, height: 720 },
      },
      viewport: { width: 1280, height: 720 },
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    await page.goto(`/fx-demo?scene=${scene.id}`);
    await expect(page.locator(`[data-fx="${scene.id}"]`)).toBeVisible({ timeout: 15_000 });
    if (scene.id === 'deal') {
      await page.getByRole('button', { name: '重播发牌' }).click();
    }
    await page.waitForTimeout(scene.waitMs);
    const video = page.video();
    await page.close();
    await context.close();
    if (video) {
      const src = await video.path();
      const dest = path.join(outDir, `lrm168-${scene.id}.webm`);
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      fs.renameSync(src, dest);
      // drop leftover playwright temp names if any
      for (const f of fs.readdirSync(outDir)) {
        if (f.endsWith('.webm') && !f.startsWith('lrm168-')) {
          try { fs.unlinkSync(path.join(outDir, f)); } catch { /* ignore */ }
        }
      }
    }
  });
}
