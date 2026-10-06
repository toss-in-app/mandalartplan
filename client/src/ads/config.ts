/**
 * 광고 그룹 ID (계약 contract/events.md '광고 그룹').
 * 라이브 ID 는 콘솔에서 사업자 정보 등록 뒤 광고 그룹을 만들어 발급받아요(7단계) → `.env.production` 의 VITE_AD_GROUP_* 에 넣어요.
 * 비어 있으면 앱인토스 공식 테스트 ID 를 써요. 개발·QR 테스트는 테스트 ID 로만 — 라이브 ID 로 테스트하면 정책 위반이에요.
 */
export const TEST_AD_GROUPS = {
  interstitial: 'ait-ad-test-interstitial-id',
  rewarded: 'ait-ad-test-rewarded-id',
  banner: 'ait-ad-test-banner-id',
} as const;

function pick(value: string | undefined, fallback: string): string {
  const v = (value ?? '').trim();
  return v.length > 0 ? v : fallback;
}

export const AD_GROUPS = {
  /** `interstitial-today`: 홈 '오늘 기록 보기' → today 전환 (전면, 하루 1회) */
  interstitialToday: pick(import.meta.env.VITE_AD_GROUP_INTERSTITIAL_TODAY, TEST_AD_GROUPS.interstitial),
  /** `rewarded-hd-image`: 공유 '고화질로 저장' (리워드) */
  rewardedHdImage: pick(import.meta.env.VITE_AD_GROUP_REWARDED_HD_IMAGE, TEST_AD_GROUPS.rewarded),
  /** `rewarded-extra-board`: 설정 '두 번째 만다라트 판' (리워드, 기능 7) */
  rewardedExtraBoard: pick(import.meta.env.VITE_AD_GROUP_REWARDED_EXTRA_BOARD, TEST_AD_GROUPS.rewarded),
  /** `banner-today`: 오늘 기록 목록 하단 (배너 1개) */
  bannerToday: pick(import.meta.env.VITE_AD_GROUP_BANNER_TODAY, TEST_AD_GROUPS.banner),
} as const;

/** 하나라도 테스트 ID 면 true. 출시 번들(11단계)에서는 false 여야 해요. */
export const USING_TEST_AD_GROUPS = Object.values(AD_GROUPS).some((id) => (Object.values(TEST_AD_GROUPS) as string[]).includes(id));
