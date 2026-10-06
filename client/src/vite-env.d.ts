/// <reference types="vite/client" />

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

/** vite.config.ts define — package.json 의 version */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** 광고 그룹 ID (비어 있으면 공식 테스트 ID). 라이브 ID 는 .env.production 에만 */
  readonly VITE_AD_GROUP_INTERSTITIAL_TODAY?: string;
  readonly VITE_AD_GROUP_REWARDED_HD_IMAGE?: string;
  readonly VITE_AD_GROUP_REWARDED_EXTRA_BOARD?: string;
  readonly VITE_AD_GROUP_BANNER_TODAY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
