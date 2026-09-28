import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  // 콘솔에 등록한 appName (2026-09-29). intoss://mandalartplan 로 열려요. 등록 후에는 바꿀 수 없어요.
  appName: 'mandalartplan',
  brand: {
    primaryColor: '#6B5CFF',
  },
  navigationBar: {
    withBackButton: true,
    withHomeButton: false,
    theme: 'light',
  },
  webView: {
    // 편집 화면에서 당겨서 새로고침이 걸리면 입력이 끊겨서 꺼요.
    pullToRefreshEnabled: false,
    bounces: false,
  },
  permissions: [],
  webBundleDir: 'dist',
});
