import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  // @card-game/rules 是 workspace 包，直接以 TS 源码引用（pnpm symlink）。
  // 告诉 Vite 把它当作需转换的源码、不预打包，避免 esbuild dep 阶段卡在 .ts。
  optimizeDeps: {
    exclude: ['@card-game/rules'],
  },
});
