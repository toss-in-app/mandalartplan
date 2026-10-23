import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import aitDevtools from '@apps-in-toss/devtools/unplugin';
import pkg from './package.json';

export default defineConfig({
  // 테스트(vitest)에서는 브릿지 mock 만 쓰고 플로팅 패널은 넣지 않아요.
  plugins: [aitDevtools.vite({ panel: !process.env.VITEST }), react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // 전면·리워드 광고는 .env 에서 ios(3.0.2; 3.0.1 은 off) — 테스트는 광고 흐름도 계속 검사하려고 on. off·ios 는 vi.stubEnv 로 따로 검사해요(config.test.ts)
    env: { VITE_FULL_SCREEN_ADS: 'on' },
  },
});
