import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const clientDist = path.join(repoRoot, 'apps/client/dist');
const livePort = process.env.E2E_PORT ?? '3099';
const liveBase = `http://127.0.0.1:${livePort}`;
const useLiveServer = Boolean(process.env.CI || process.env.E2E_LIVE);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: useLiveServer ? liveBase : (process.env.FX_BASE_URL ?? 'http://127.0.0.1:5173'),
    viewport: { width: 1280, height: 720 },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: useLiveServer
    ? {
        command: `PORT=${livePort} MATCH_FILL_AFTER_MS=500 BOT_THINK_MS_MIN=0 BOT_THINK_MS_MAX=0 CLIENT_DIST=${clientDist} pnpm --filter @card-game/server exec tsx src/index.ts`,
        cwd: repoRoot,
        url: `${liveBase}/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
