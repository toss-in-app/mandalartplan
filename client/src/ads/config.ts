/**
 * 광고 그룹 ID (계약 contract/events.md '광고 그룹').
 * 라이브 ID 는 콘솔 인앱 광고에서 만든 광고 그룹의 groupId → `.env.production` 의 VITE_AD_GROUP_* (출시 빌드 `vite build` 가 읽어요).
 *
 * 출시 빌드(MODE=production)에는 테스트 ID 문자열이 한 글자도 들어가면 안 돼요 — 콘솔이 번들을 정적으로 검사해
 * 'ait-ad-test-…' 가 있으면 검토를 자동 반려해요(2026-10-19 반려). 그래서 테스트 ID 는 production 이 아닌 모드
 * (개발 서버·vitest·`npm run build:test-ads`)에서만 코드에 남고, 출시 빌드에서는 아래 상수가 null 로 접혀 번들에서 사라져요.
 * `npm run build` 뒤 `scripts/check-release-bundle.mjs` 가 dist 를 다시 검사해요.
 * 개발·QR 테스트는 테스트 ID 로만 — 라이브 ID 로 테스트하면 정책 위반이에요.
 */
const IS_RELEASE_BUILD = import.meta.env.MODE === 'production';

/** 앱인토스 공식 테스트 광고 그룹 ID. 출시 빌드에서는 null. */
export const TEST_AD_GROUPS: { interstitial: string; rewarded: string; banner: string } | null = IS_RELEASE_BUILD
  ? null
  : {
      interstitial: 'ait-ad-test-interstitial-id',
      rewarded: 'ait-ad-test-rewarded-id',
      banner: 'ait-ad-test-banner-id',
    };

function pick(value: string | undefined, fallback: string | undefined): string {
  const v = (value ?? '').trim();
  return v.length > 0 ? v : (fallback ?? '');
}

export const AD_GROUPS = {
  /** `interstitial-today`: 홈 '기록 보기' → today 전환 (전면, 하루 1회) */
  interstitialToday: pick(import.meta.env.VITE_AD_GROUP_INTERSTITIAL_TODAY, TEST_AD_GROUPS?.interstitial),
  /** `rewarded-hd-image`: 공유 '고화질로 저장' (리워드) */
  rewardedHdImage: pick(import.meta.env.VITE_AD_GROUP_REWARDED_HD_IMAGE, TEST_AD_GROUPS?.rewarded),
  /** `rewarded-extra-board`: 설정 '두 번째 만다라트 판' (리워드, 기능 7) */
  rewardedExtraBoard: pick(import.meta.env.VITE_AD_GROUP_REWARDED_EXTRA_BOARD, TEST_AD_GROUPS?.rewarded),
  /** `banner-today`: 기록 화면 맨 아래, 모든 탭 (배너 1개) */
  bannerToday: pick(import.meta.env.VITE_AD_GROUP_BANNER_TODAY, TEST_AD_GROUPS?.banner),
  /** `rewarded-ai-draft`: AI 초안 만들기·다시 만들기·빈 칸 채우기·실천 추천 (리워드, 2.0 — 광고 1회 = AI 1회) */
  rewardedAiDraft: pick(import.meta.env.VITE_AD_GROUP_REWARDED_AI_DRAFT, TEST_AD_GROUPS?.rewarded),
} as const;

/** 하나라도 비어 있거나 테스트 ID 면 true. 출시 번들에서는 false 여야 해요. */
export const USING_TEST_AD_GROUPS = Object.values(AD_GROUPS).some(
  (id) => id.length === 0 || (TEST_AD_GROUPS !== null && (Object.values(TEST_AD_GROUPS) as string[]).includes(id)),
);
