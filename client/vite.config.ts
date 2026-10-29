import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

import aitDevtools from '@apps-in-toss/devtools/unplugin';
import pkg from './package.json';

/**
 * 빌드 때 CSS 파일을 index.html 안 <style> 로 넣어요(3.0.3, Microsoft Clarity).
 * 미니앱 주소는 토스 앱 밖에서 열리지 않아(직접 접속 400) 클라리티가 녹화를 재생할 때 CSS 파일을 다시 받지 못하고 화면이 깨져요.
 * 페이지 안 <style> 은 녹화에 같이 담겨요. 출시 번들 검사(scripts/check-release-bundle.mjs)가 <link rel="stylesheet"> 가 남았는지 봐요.
 */
function inlineCss(): Plugin {
  return {
    name: 'mandalart-inline-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['index.html'];
      if (!html || html.type !== 'asset') return;
      let source = String(html.source);
      for (const [fileName, file] of Object.entries(bundle)) {
        if (file.type !== 'asset' || !fileName.endsWith('.css')) continue;
        const link = new RegExp(`<link rel="stylesheet"[^>]*href="[^"]*${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`);
        if (!link.test(source)) continue;
        source = source.replace(link, () => `<style>${String(file.source)}</style>`);
        delete bundle[fileName];
      }
      html.source = source;
    },
  };
}

export default defineConfig({
  // 테스트(vitest)에서는 브릿지 mock 만 쓰고 플로팅 패널은 넣지 않아요.
  plugins: [aitDevtools.vite({ panel: !process.env.VITEST }), react(), inlineCss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // 광고는 .env 에서 전면·리워드·배너 모두 off(3.0.4; 3.0.3 은 on, 3.0.2 는 ios, 3.0.1 은 off·배너만) — 테스트는 광고 흐름을 계속 검사하려고 on. off·ios 는 vi.stubEnv 로 따로 검사해요(config.test.ts)
    env: { VITE_FULL_SCREEN_ADS: 'on', VITE_BANNER_ADS: 'on' },
  },
});
