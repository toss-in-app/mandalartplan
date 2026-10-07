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
  /** 콘솔 스마트 발송 기능성 템플릿의 발송 코드(알림 동의문). 비어 있으면 알림 기능 숨김(개발 빌드는 설계 코드) */
  readonly VITE_NOTIFICATION_TEMPLATE_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
